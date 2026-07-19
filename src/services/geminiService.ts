import { FunctionsHttpError } from '@supabase/supabase-js';
import { AnalysisResult, RoadmapStep, Student } from '../types';
import { supabase } from './supabaseClient';

const SESSION_EXPIRED_MESSAGE = 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.';
const AI_UNAVAILABLE_MESSAGE = 'AI hizmeti şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
const AI_REQUEST_FAILED_MESSAGE = 'AI isteği tamamlanamadı. Lütfen tekrar deneyin.';

const AI_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: SESSION_EXPIRED_MESSAGE,
  INVALID_TOKEN: SESSION_EXPIRED_MESSAGE,
  AI_UNAVAILABLE: AI_UNAVAILABLE_MESSAGE,
  CONFIGURATION_ERROR: AI_UNAVAILABLE_MESSAGE,
  AI_RESPONSE_INVALID: AI_UNAVAILABLE_MESSAGE,
  INTERNAL_ERROR: AI_UNAVAILABLE_MESSAGE,
  FORBIDDEN: 'Bu öğrenci için AI işlemi yapma yetkiniz bulunmuyor.',
  RATE_LIMITED: 'AI istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.',
  STUDENT_NOT_FOUND: 'Öğrenci bulunamadı.',
  INVALID_REQUEST: 'AI isteği geçersiz. Lütfen bilgileri kontrol edip tekrar deneyin.',
  VALIDATION_ERROR: 'AI isteği geçersiz. Lütfen bilgileri kontrol edip tekrar deneyin.',
};

interface EdgeErrorBody {
  success: false;
  code: string;
  error: string;
}

interface EdgeSuccessBody {
  success: true;
  data: unknown;
}

const isEdgeErrorBody = (value: unknown): value is EdgeErrorBody => {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return body.success === false && typeof body.code === 'string' && typeof body.error === 'string';
};

const isEdgeSuccessBody = (value: unknown): value is EdgeSuccessBody => {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return body.success === true && 'data' in body;
};

const safeErrorMessage = (code?: string): string =>
  (code && AI_ERROR_MESSAGES[code]) || AI_REQUEST_FAILED_MESSAGE;

async function requireAccessToken(): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    const isExpired = session?.expires_at !== undefined && session.expires_at * 1000 <= Date.now();
    if (error || !session?.access_token || isExpired) throw new Error(SESSION_EXPIRED_MESSAGE);
    return session.access_token;
  } catch {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
}

async function throwSafeEdgeError(error: unknown, data?: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    let body: unknown;
    try {
      body = await error.context.clone().json();
    } catch {}
    if (isEdgeErrorBody(body)) throw new Error(safeErrorMessage(body.code));
  }

  if (isEdgeErrorBody(data)) throw new Error(safeErrorMessage(data.code));
  throw new Error(AI_REQUEST_FAILED_MESSAGE);
}

async function invokeAI<T>(
  body: Record<string, string>,
  isValidData: (value: unknown) => value is T,
): Promise<T> {
  const accessToken = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('ai-counselor', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

  if (error) await throwSafeEdgeError(error, data);
  if (isEdgeErrorBody(data)) await throwSafeEdgeError(undefined, data);
  if (!isEdgeSuccessBody(data) || !isValidData(data.data)) {
    throw new Error(AI_REQUEST_FAILED_MESSAGE);
  }

  return data.data;
}

const isAnalysisResult = (value: unknown): value is AnalysisResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return Array.isArray(result.recommendedPrograms)
    && typeof result.visaRiskScore === 'number'
    && typeof result.visaRiskReasoning === 'string'
    && typeof result.scholarshipProbability === 'number'
    && Array.isArray(result.suggestedUniversities)
    && typeof result.overallAssessment === 'string';
};

const isRoadmapResult = (value: unknown): value is { steps: RoadmapStep[] } => {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as Record<string, unknown>).steps);
};
const isAnswer = (value: unknown): value is string => typeof value === 'string';

export const analyzeStudentProfile = async (student: Student): Promise<AnalysisResult> =>
  invokeAI(
    { operation: 'analyze_student', student_id: student.id },
    isAnalysisResult,
  );

export const generateStudentRoadmap = async (student: Student): Promise<RoadmapStep[]> => {
  const result = await invokeAI(
    { operation: 'generate_roadmap', student_id: student.id },
    isRoadmapResult,
  );
  return result.steps;
};

export const askUNIC = async (question: string, student: Student): Promise<string> => {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion || normalizedQuestion.length > 2000) {
    throw new Error('Soru boş olmamalı ve en fazla 2000 karakter içermelidir.');
  }

  return invokeAI(
    { operation: 'ask_unic', student_id: student.id, question: normalizedQuestion },
    isAnswer,
  );
};
