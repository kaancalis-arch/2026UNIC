// @ts-ignore Supabase Edge Runtime resolves remote imports.
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.30.0';
// @ts-ignore Supabase Edge Runtime resolves remote imports.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor, type AuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';
import { buildPrompt } from './prompts.ts';
import {
  parseAiRequest,
  sanitizeAnalysis,
  sanitizeAnswer,
  sanitizeRoadmap,
} from './schemas.ts';

const MODEL = 'gemini-2.5-flash';
const MAX_BODY_BYTES = 8 * 1024;
const STUDENT_COLUMNS = 'id,branch_id,counselor_id,representative_id,student_user_id,education_status,current_grade,gpa,target_degree,target_countries,target_programs,budget,english_level,interests,pipeline_stage,analysis';

type StudentRow = {
  id: string;
  branch_id: string | null;
  counselor_id: string | null;
  representative_id: string | null;
  student_user_id: string | null;
  education_status: unknown;
  current_grade: unknown;
  gpa: unknown;
  target_degree: unknown;
  target_countries: unknown;
  target_programs: unknown;
  budget: unknown;
  english_level: unknown;
  interests: unknown;
  pipeline_stage: unknown;
  analysis: unknown;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = corsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse(new SafeError('METHOD_NOT_ALLOWED', 'Yalnız POST metodu desteklenir.', 405), headers);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new SafeError('CONFIGURATION_ERROR', 'Sunucu yapılandırması eksik.', 500);
    }

    const payload = await readPayload(req);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const actor = await authorizeAuthenticatedActor(admin, req);

    const { data: student, error: studentError } = await admin
      .from('student_profiles')
      .select(STUDENT_COLUMNS)
      .eq('id', payload.student_id)
      .maybeSingle<StudentRow>();
    if (studentError) {
      console.error('AI öğrenci kapsam sorgusu başarısız:', studentError);
      throw new SafeError('INTERNAL_ERROR', 'Öğrenci erişimi doğrulanamadı.', 500);
    }
    if (!student) throw new SafeError('STUDENT_NOT_FOUND', 'Öğrenci bulunamadı.', 404);
    enforceStudentScope(actor, student);

    const requestId = crypto.randomUUID();
    const { data: limitData, error: limitError } = await admin.rpc('begin_ai_request', {
      p_actor_user_id: actor.id,
      p_operation: payload.operation,
      p_request_id: requestId,
    });
    if (limitError) {
      console.error('AI rate limit doğrulaması başarısız:', limitError);
      throw new SafeError('INTERNAL_ERROR', 'İstek limiti doğrulanamadı.', 500);
    }
    const limit = Array.isArray(limitData) ? limitData[0] : limitData;
    if (!limit || limit.allowed !== true) {
      throw new SafeError('RATE_LIMITED', 'AI istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.', 429);
    }

    let result: unknown;
    try {
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        throw new SafeError('CONFIGURATION_ERROR', 'AI hizmeti yapılandırılmamış.', 500);
      }
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(payload.operation, minimizeStudent(student), payload.question),
        config: payload.operation === 'ask_unic' ? undefined : { responseMimeType: 'application/json' },
      });
      const text = response.text;
      if (payload.operation === 'ask_unic') {
        result = sanitizeAnswer(text);
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text ?? '');
        } catch {
          throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
        }
        result = payload.operation === 'analyze_student'
          ? sanitizeAnalysis(parsed)
          : sanitizeRoadmap(parsed);
      }
      if (result === null) throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
    } catch (error) {
      if (error instanceof SafeError) throw error;
      throw new SafeError('AI_UNAVAILABLE', 'AI hizmetine şu anda ulaşılamıyor.', 503);
    }

    const { error: completionError } = await admin.rpc('complete_ai_request', {
      p_request_id: requestId,
    });
    if (completionError) console.error('AI istek tamamlama kaydı başarısız:', completionError);

    return jsonResponse({ success: true, data: result }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

async function readPayload(req: Request) {
  const contentLength = req.headers.get('Content-Length');
  if (contentLength !== null) {
    const statedBytes = Number(contentLength);
    if (!Number.isFinite(statedBytes) || statedBytes < 0) {
      throw new SafeError('VALIDATION_ERROR', 'Content-Length geçersiz.', 400);
    }
    if (statedBytes > MAX_BODY_BYTES) {
      throw new SafeError('PAYLOAD_TOO_LARGE', 'İstek gövdesi en fazla 8KB olabilir.', 413);
    }
  }

  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new SafeError('PAYLOAD_TOO_LARGE', 'İstek gövdesi en fazla 8KB olabilir.', 413);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SafeError('INVALID_JSON', 'İstek gövdesi geçerli JSON olmalıdır.', 400);
  }
  const payload = parseAiRequest(raw);
  if (!payload) throw new SafeError('VALIDATION_ERROR', 'İstek alanları geçersiz.', 400);
  return payload;
}

function enforceStudentScope(actor: AuthenticatedActor, student: StudentRow): void {
  if (actor.role === 'Super Admin' || actor.role === 'Admin') return;
  if (!actor.branch_id || !student.branch_id || actor.branch_id !== student.branch_id) {
    throw new SafeError('FORBIDDEN', 'Bu öğrenciye erişim yetkiniz bulunmuyor.', 403);
  }
  if (actor.role === 'Şube Müdürü') return;
  if (actor.role === 'Danışman' || actor.role === 'Temsilci' || actor.role === 'Öğrenci Temsilci') {
    if (student.counselor_id === actor.id || student.representative_id === actor.id) return;
  } else if (actor.role === 'Öğrenci' && student.student_user_id === actor.id) {
    return;
  }
  throw new SafeError('FORBIDDEN', 'Bu öğrenciye erişim yetkiniz bulunmuyor.', 403);
}

function minimizeStudent(student: StudentRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  copyDefined(result, student, [
    'education_status', 'current_grade', 'gpa', 'target_degree', 'target_countries',
    'target_programs', 'budget', 'english_level', 'interests', 'pipeline_stage',
  ]);

  if (!isRecord(student.analysis)) return result;
  const analysis: Record<string, unknown> = {};
  const academicSource = isRecord(student.analysis.academic) ? student.analysis.academic : null;
  if (academicSource) {
    const academic: Record<string, unknown> = {};
    copyDefined(academic, academicSource, ['gpa', 'educationField']);
    const ibCourses = sanitizeSelectedArray(academicSource.ibCourses ?? academicSource.ibSubjects,
      ['name', 'subject', 'status', 'score', 'grade', 'level']);
    if (ibCourses.length) academic.ibCourses = ibCourses;
    if (isRecord(academicSource.exams)) {
      const exams: Record<string, unknown> = {};
      for (const [examName, examValue] of Object.entries(academicSource.exams).slice(0, 20)) {
        if (!isRecord(examValue)) continue;
        const selected = selectFields(examValue, ['subject', 'status', 'score', 'grade', 'level']);
        const subjects = sanitizeSelectedArray(examValue.apSubjects ?? examValue.ibSubjects,
          ['subject', 'status', 'score', 'grade', 'level']);
        if (subjects.length) selected.subjects = subjects;
        if (Object.keys(selected).length) exams[examName.slice(0, 100)] = selected;
      }
      if (Object.keys(exams).length) academic.exams = exams;
    }
    if (Object.keys(academic).length) analysis.academic = academic;
  }

  const languageSource = isRecord(student.analysis.language) ? student.analysis.language : null;
  if (languageSource) {
    const language = selectFields(languageSource, [
      'examType', 'examScore', 'examType2', 'examScore2', 'examType3', 'examScore3',
      'estimatedLevel', 'targetExam',
    ]);
    if (Object.keys(language).length) analysis.language = language;
  }

  const preferencesSource = isRecord(student.analysis.preferences) ? student.analysis.preferences : null;
  if (preferencesSource) {
    const preferences = selectFields(preferencesSource, [
      'program1Category', 'program1', 'program2Category', 'program2',
      'country1', 'country2', 'country3', 'country4', 'country5',
    ]);
    if (Object.keys(preferences).length) analysis.preferences = preferences;
  }
  if (Object.keys(analysis).length) result.analysis = analysis;
  return result;
}

function sanitizeSelectedArray(value: unknown, fields: string[]): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).filter(isRecord).map((item) => selectFields(item, fields))
    .filter((item) => Object.keys(item).length > 0);
}

function selectFields(source: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const selected: Record<string, unknown> = {};
  copyDefined(selected, source, fields);
  return selected;
}

function copyDefined(target: Record<string, unknown>, source: object, fields: string[]) {
  const record = source as Record<string, unknown>;
  for (const field of fields) {
    const value = safePromptValue(record[field]);
    if (value !== undefined) target[field] = value;
  }
}

function safePromptValue(value: unknown): string | number | boolean | string[] | undefined {
  if (typeof value === 'string') return value.slice(0, 1000);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.slice(0, 30).map((item) => item.slice(0, 300));
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
