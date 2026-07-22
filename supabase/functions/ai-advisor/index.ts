import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor, type AuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';
import { isUuid } from '../_shared/userHierarchy.ts';
import { getAdvisorProvider } from './provider.ts';
import { buildSystemInstructions, type AdvisorReportType } from './prompts.ts';
import { sanitizeContent } from './providers/openai.ts';
import type { AdvisorReportContent } from './providers/types.ts';

const MAX_BODY_BYTES = 20 * 1024;
const PROMPT_VERSION = 'unic-ai-advisor-v1';
const SHARE_HOURS = new Set([24, 72, 168]);
const REPORT_TYPES = new Set<AdvisorReportType>([
  'pre_meeting_brief',
  'language_assessment',
  'post_meeting_report',
]);

type AdminClient = ReturnType<typeof createClient>;
type StudentRow = {
  id: string;
  branch_id: string | null;
  counselor_id: string | null;
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

type ReportRow = {
  id: string;
  student_id: string;
  branch_id: string;
  report_type: AdvisorReportType;
  status: 'draft' | 'approved' | 'archived';
  deterministic_result: Record<string, unknown>;
  generated_content: AdvisorReportContent;
  counselor_content: AdvisorReportContent;
  provider: string;
  model: string;
  prompt_version: string;
  generated_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  ai_advisor_report_share_links?: Array<{
    id: string;
    expires_at: string;
    max_views: number | null;
    view_count: number;
    revoked_at: string | null;
  }>;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = corsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse(new SafeError('METHOD_NOT_ALLOWED', 'Yalnız POST metodu desteklenir.', 405), headers);
  }

  try {
    const admin = createAdminClient();
    const actor = await authorizeAuthenticatedActor(admin, req);
    if (actor.role === 'Öğrenci') {
      throw new SafeError('FORBIDDEN', 'Öğrenci rolü AI Danışman modülüne erişemez.', 403);
    }
    const body = await readBody(req);
    const result = await handleOperation(admin, actor, body, req);
    return jsonResponse({ success: true, ...result }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

function createAdminClient(): AdminClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new SafeError('CONFIGURATION_ERROR', 'Sunucu yapılandırması eksik.', 500);
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new SafeError('PAYLOAD_TOO_LARGE', 'İstek gövdesi en fazla 20KB olabilir.', 413);
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new SafeError('PAYLOAD_TOO_LARGE', 'İstek gövdesi en fazla 20KB olabilir.', 413);
  }
  try {
    const body: unknown = JSON.parse(text);
    if (!isRecord(body) || typeof body.operation !== 'string') throw new Error('invalid body');
    return body;
  } catch (error) {
    console.error('AI Danışman istek gövdesi ayrıştırılamadı:', error);
    throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
  }
}

async function handleOperation(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  switch (body.operation) {
    case 'list_reports':
      return listReports(admin, actor, body);
    case 'generate_report':
      return generateReport(admin, actor, body, req);
    case 'update_draft':
      return updateDraft(admin, actor, body, req);
    case 'approve_report':
      return approveReport(admin, actor, body, req);
    case 'archive_report':
      return archiveReport(admin, actor, body, req);
    case 'create_share_link':
      return createShareLink(admin, actor, body, req);
    case 'revoke_share_link':
      return revokeShareLink(admin, actor, body, req);
    case 'list_rules':
      return listRules(admin, actor);
    case 'save_rule':
      return saveRule(admin, actor, body, req);
    default:
      throw new SafeError('VALIDATION_ERROR', 'Desteklenmeyen operation değeri.', 400);
  }
}

async function listReports(admin: AdminClient, actor: AuthenticatedActor, body: Record<string, unknown>) {
  const student = await authorizeStudent(admin, actor, requiredUuid(body.student_id, 'student_id'));
  const { data, error } = await admin.from('ai_advisor_reports')
    .select('*, ai_advisor_report_share_links(id, expires_at, max_views, view_count, revoked_at)')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false });
  if (error) internalFailure('AI Danışman raporları listelenemedi', error);
  return { reports: (data ?? []).map((row: ReportRow) => publicReport(row)) };
}

async function generateReport(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const student = await authorizeStudent(admin, actor, requiredUuid(body.student_id, 'student_id'));
  const reportType = requiredReportType(body.report_type);
  const context = sanitizeContext(body.context);
  const deterministicResult = deterministicAssessment(reportType, student, context);

  const { data: ruleRows, error: rulesError } = await admin.from('ai_advisor_rules')
    .select('id, report_type, title, instruction, priority, version')
    .eq('report_type', reportType)
    .eq('status', 'active')
    .order('priority', { ascending: true })
    .limit(30);
  if (rulesError) internalFailure('UNIC kuralları okunamadı', rulesError);
  const rules = (ruleRows ?? []).map((rule: Record<string, unknown>) => ({
    id: rule.id,
    title: rule.title,
    instruction: rule.instruction,
    priority: rule.priority,
    version: rule.version,
  }));

  const requestId = crypto.randomUUID();
  const { data: limitRows, error: limitError } = await admin.rpc('begin_ai_request', {
    p_actor_user_id: actor.id,
    p_operation: reportType,
    p_request_id: requestId,
  });
  if (limitError) internalFailure('AI istek limiti doğrulanamadı', limitError);
  const limit = Array.isArray(limitRows) ? limitRows[0] : limitRows;
  if (!limit || limit.allowed !== true) {
    throw new SafeError('RATE_LIMITED', 'AI istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.', 429);
  }

  const provider = getAdvisorProvider();
  const generatedContent = await provider.generateReport({
    systemInstructions: buildSystemInstructions(reportType),
    dataBlock: {
      report_type: reportType,
      student: minimizeStudent(student),
      deterministic_assessment: deterministicResult,
      counselor_context: context,
      unic_rules: rules.map(({ title, instruction }) => ({ title, instruction })),
    },
  });

  const { data: report, error: insertError } = await admin.from('ai_advisor_reports')
    .insert({
      student_id: student.id,
      branch_id: student.branch_id,
      report_type: reportType,
      deterministic_result: deterministicResult,
      generated_content: generatedContent,
      counselor_content: generatedContent,
      rules_snapshot: rules,
      provider: provider.name,
      model: provider.model,
      prompt_version: PROMPT_VERSION,
      generated_by: actor.id,
    })
    .select('*')
    .single();
  if (insertError || !report) internalFailure('AI Danışman raporu kaydedilemedi', insertError);

  try {
    await writeAudit(admin, {
      report_id: report.id,
      student_id: student.id,
      actor_user_id: actor.id,
      event_type: 'report_generated',
      ...requestAuditFields(req),
      metadata: { report_type: reportType, provider: provider.name, model: provider.model, request_id: requestId },
    });
  } catch (error) {
    const { error: rollbackError } = await admin.from('ai_advisor_reports').delete().eq('id', report.id);
    if (rollbackError) console.error('KRİTİK: Audit hatası sonrası AI raporu rollback başarısız:', rollbackError);
    throw error;
  }

  const { error: completionError } = await admin.rpc('complete_ai_request', { p_request_id: requestId });
  if (completionError) console.error('AI istek tamamlama kaydı başarısız:', completionError);
  return { report: publicReport(report as ReportRow) };
}

async function updateDraft(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const report = await authorizedReport(admin, actor, requiredUuid(body.report_id, 'report_id'));
  if (report.status !== 'draft') {
    throw new SafeError('VALIDATION_ERROR', 'Yalnız taslak rapor düzenlenebilir.', 409);
  }
  const content = sanitizeContent(body.content);
  if (!content) throw new SafeError('VALIDATION_ERROR', 'Rapor içeriği geçersiz.', 400);
  const { data, error } = await admin.from('ai_advisor_reports')
    .update({ counselor_content: content })
    .eq('id', report.id)
    .eq('status', 'draft')
    .select('*')
    .maybeSingle();
  if (error) internalFailure('AI Danışman taslağı güncellenemedi', error);
  if (!data) throw new SafeError('CONFLICT', 'Rapor durumu eşzamanlı olarak değişti.', 409);
  try {
    await writeAudit(admin, {
      report_id: report.id, student_id: report.student_id, actor_user_id: actor.id,
      event_type: 'draft_updated', ...requestAuditFields(req), metadata: {},
    });
  } catch (auditError) {
    const { error: rollbackError } = await admin.from('ai_advisor_reports')
      .update({ counselor_content: report.counselor_content }).eq('id', report.id).eq('status', 'draft');
    if (rollbackError) console.error('KRİTİK: Taslak audit hatası sonrası rollback başarısız:', rollbackError);
    throw auditError;
  }
  return { report: publicReport(data as ReportRow) };
}

async function approveReport(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const report = await authorizedReport(admin, actor, requiredUuid(body.report_id, 'report_id'));
  if (report.status !== 'draft') {
    throw new SafeError('VALIDATION_ERROR', 'Yalnız taslak rapor onaylanabilir.', 409);
  }
  const now = new Date().toISOString();
  const { data, error } = await admin.from('ai_advisor_reports')
    .update({ status: 'approved', approved_by: actor.id, approved_at: now })
    .eq('id', report.id)
    .eq('status', 'draft')
    .select('*')
    .maybeSingle();
  if (error) internalFailure('AI Danışman raporu onaylanamadı', error);
  if (!data) throw new SafeError('CONFLICT', 'Rapor durumu eşzamanlı olarak değişti.', 409);
  try {
    await writeAudit(admin, {
      report_id: report.id, student_id: report.student_id, actor_user_id: actor.id,
      event_type: 'report_approved', ...requestAuditFields(req), metadata: {},
    });
  } catch (auditError) {
    const { error: rollbackError } = await admin.from('ai_advisor_reports')
      .update({ status: 'draft', approved_by: null, approved_at: null })
      .eq('id', report.id).eq('status', 'approved');
    if (rollbackError) console.error('KRİTİK: Rapor onay audit hatası sonrası rollback başarısız:', rollbackError);
    throw auditError;
  }
  return { report: publicReport(data as ReportRow) };
}

async function archiveReport(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const report = await authorizedReport(admin, actor, requiredUuid(body.report_id, 'report_id'));
  if (report.status !== 'approved') {
    throw new SafeError('VALIDATION_ERROR', 'Yalnız onaylı rapor arşivlenebilir.', 409);
  }
  const { data, error } = await admin.from('ai_advisor_reports')
    .update({ status: 'archived' })
    .eq('id', report.id)
    .eq('status', 'approved')
    .select('*')
    .maybeSingle();
  if (error) internalFailure('AI Danışman raporu arşivlenemedi', error);
  if (!data) throw new SafeError('CONFLICT', 'Rapor durumu eşzamanlı olarak değişti.', 409);
  try {
    await writeAudit(admin, {
      report_id: report.id, student_id: report.student_id, actor_user_id: actor.id,
      event_type: 'report_archived', ...requestAuditFields(req), metadata: {},
    });
  } catch (auditError) {
    const { error: rollbackError } = await admin.from('ai_advisor_reports')
      .update({ status: 'approved' }).eq('id', report.id).eq('status', 'archived');
    if (rollbackError) console.error('KRİTİK: Rapor arşiv audit hatası sonrası rollback başarısız:', rollbackError);
    throw auditError;
  }
  await revokeReportShares(admin, report.id, actor.id);
  return { report: publicReport(data as ReportRow) };
}

async function createShareLink(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const report = await authorizedReport(admin, actor, requiredUuid(body.report_id, 'report_id'));
  if (report.status !== 'approved') {
    throw new SafeError('VALIDATION_ERROR', 'Yalnız danışman tarafından onaylanmış rapor paylaşılabilir.', 409);
  }
  const expiresInHours = requiredAllowedInteger(body.expires_in_hours, SHARE_HOURS, 'expires_in_hours');
  const maxViews = body.max_views === null || body.max_views === undefined
    ? null
    : positiveInteger(body.max_views, 'max_views', 10000);
  const token = randomToken();
  const tokenHash = await digestHex(new TextEncoder().encode(token));
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from('ai_advisor_report_share_links').insert({
    report_id: report.id,
    token_hash: tokenHash,
    created_by: actor.id,
    expires_at: expiresAt,
    max_views: maxViews,
  }).select('id, expires_at, max_views').single();
  if (error || !data) internalFailure('Rapor paylaşım bağlantısı oluşturulamadı', error);
  try {
    await writeAudit(admin, {
      report_id: report.id, share_link_id: data.id, student_id: report.student_id,
      actor_user_id: actor.id, event_type: 'share_created', ...requestAuditFields(req),
      metadata: { expires_in_hours: expiresInHours, max_views: maxViews },
    });
  } catch (auditError) {
    const { error: rollbackError } = await admin.from('ai_advisor_report_share_links').delete().eq('id', data.id);
    if (rollbackError) console.error('KRİTİK: Paylaşım audit hatası sonrası rollback başarısız:', rollbackError);
    throw auditError;
  }
  return { share_link: { ...data, token } };
}

async function revokeShareLink(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const shareId = requiredUuid(body.share_link_id, 'share_link_id');
  const { data: share, error } = await admin.from('ai_advisor_report_share_links')
    .select('id, report_id, revoked_at, ai_advisor_reports(student_id)')
    .eq('id', shareId)
    .maybeSingle();
  if (error) internalFailure('Rapor paylaşımı okunamadı', error);
  if (!share) throw new SafeError('TARGET_NOT_FOUND', 'Paylaşım bağlantısı bulunamadı.', 404);
  const report = await authorizedReport(admin, actor, share.report_id);
  if (share.revoked_at) throw new SafeError('VALIDATION_ERROR', 'Paylaşım bağlantısı zaten iptal edilmiş.', 409);
  const { error: updateError } = await admin.from('ai_advisor_report_share_links')
    .update({ revoked_at: new Date().toISOString(), revoked_by: actor.id })
    .eq('id', shareId)
    .is('revoked_at', null);
  if (updateError) internalFailure('Rapor paylaşımı iptal edilemedi', updateError);
  try {
    await writeAudit(admin, {
      report_id: report.id, share_link_id: shareId, student_id: report.student_id,
      actor_user_id: actor.id, event_type: 'share_revoked', ...requestAuditFields(req), metadata: {},
    });
  } catch (auditError) {
    const { error: rollbackError } = await admin.from('ai_advisor_report_share_links')
      .update({ revoked_at: null, revoked_by: null }).eq('id', shareId).eq('revoked_by', actor.id);
    if (rollbackError) console.error('KRİTİK: Paylaşım iptal audit hatası sonrası rollback başarısız:', rollbackError);
    throw auditError;
  }
  return { share_link_id: shareId, revoked: true };
}

async function listRules(admin: AdminClient, actor: AuthenticatedActor) {
  requireRuleManager(actor);
  const { data, error } = await admin.from('ai_advisor_rules')
    .select('id, report_type, title, instruction, priority, status, version, created_at, updated_at')
    .order('report_type')
    .order('priority');
  if (error) internalFailure('UNIC AI kuralları listelenemedi', error);
  return { rules: data ?? [] };
}

async function saveRule(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  requireRuleManager(actor);
  const ruleId = optionalUuid(body.rule_id, 'rule_id');
  const reportType = requiredReportType(body.report_type);
  const title = requiredString(body.title, 'title', 3, 120);
  const instruction = requiredString(body.instruction, 'instruction', 10, 2000);
  const priority = positiveInteger(body.priority, 'priority', 1000);
  if (body.status !== 'active' && body.status !== 'inactive') {
    throw new SafeError('VALIDATION_ERROR', 'status active veya inactive olmalıdır.', 400);
  }

  let rule: Record<string, unknown> | null = null;
  let previousRule: Record<string, unknown> | null = null;
  if (ruleId) {
    const { data: existing, error: existingError } = await admin.from('ai_advisor_rules')
      .select('*').eq('id', ruleId).maybeSingle();
    if (existingError) internalFailure('UNIC AI kuralı okunamadı', existingError);
    if (!existing) throw new SafeError('TARGET_NOT_FOUND', 'UNIC AI kuralı bulunamadı.', 404);
    previousRule = existing;
    const { data, error } = await admin.from('ai_advisor_rules').update({
      report_type: reportType, title, instruction, priority, status: body.status,
      version: existing.version + 1, updated_by: actor.id,
    }).eq('id', ruleId).select('*').single();
    if (error || !data) internalFailure('UNIC AI kuralı güncellenemedi', error);
    rule = data;
  } else {
    const { data, error } = await admin.from('ai_advisor_rules').insert({
      report_type: reportType, title, instruction, priority, status: body.status,
      created_by: actor.id, updated_by: actor.id,
    }).select('*').single();
    if (error || !data) internalFailure('UNIC AI kuralı oluşturulamadı', error);
    rule = data;
  }

  try {
    await writeAudit(admin, {
      actor_user_id: actor.id,
      event_type: ruleId ? 'rule_updated' : 'rule_created',
      ...requestAuditFields(req),
      metadata: { rule_id: rule.id, report_type: reportType, version: rule.version },
    });
  } catch (auditError) {
    const rollback = ruleId && previousRule
      ? admin.from('ai_advisor_rules').update(previousRule).eq('id', ruleId)
      : admin.from('ai_advisor_rules').delete().eq('id', rule.id);
    const { error: rollbackError } = await rollback;
    if (rollbackError) console.error('KRİTİK: Kural audit hatası sonrası rollback başarısız:', rollbackError);
    throw auditError;
  }
  return { rule };
}

async function authorizeStudent(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
): Promise<StudentRow & { branch_id: string }> {
  const { data: student, error } = await admin.from('student_profiles')
    .select('id, branch_id, counselor_id, education_status, current_grade, gpa, target_degree, target_countries, target_programs, budget, english_level, interests, pipeline_stage, analysis')
    .eq('id', studentId)
    .maybeSingle();
  if (error) internalFailure('Öğrenci bilgisi okunamadı', error);
  if (!student) throw new SafeError('STUDENT_NOT_FOUND', 'Öğrenci bulunamadı.', 404);
  if (!student.branch_id) throw new SafeError('INVALID_BRANCH', 'Öğrencinin aktif bir şubesi bulunmuyor.', 409);
  const { data: branch, error: branchError } = await admin.from('branches')
    .select('id, status').eq('id', student.branch_id).maybeSingle();
  if (branchError) internalFailure('Öğrenci şubesi doğrulanamadı', branchError);
  if (!branch || branch.status !== 'active') {
    throw new SafeError('INVALID_BRANCH', 'Öğrencinin şubesi aktif değil.', 403);
  }

  let allowed = actor.role === 'Super Admin' || actor.role === 'Admin';
  if (actor.role === 'Şube Müdürü') allowed = actor.branch_id === student.branch_id;
  if (actor.role === 'Danışman' || actor.role === 'Temsilci' || actor.role === 'Öğrenci Temsilci') {
    allowed = actor.branch_id === student.branch_id && student.counselor_id === actor.id;
  }
  if (!allowed) throw new SafeError('FORBIDDEN', 'Bu öğrenci için AI Danışman erişim yetkiniz yok.', 403);
  return student as StudentRow & { branch_id: string };
}

async function authorizedReport(admin: AdminClient, actor: AuthenticatedActor, reportId: string) {
  const { data, error } = await admin.from('ai_advisor_reports')
    .select('*, ai_advisor_report_share_links(id, expires_at, max_views, view_count, revoked_at)')
    .eq('id', reportId).maybeSingle();
  if (error) internalFailure('AI Danışman raporu okunamadı', error);
  if (!data) throw new SafeError('TARGET_NOT_FOUND', 'AI Danışman raporu bulunamadı.', 404);
  await authorizeStudent(admin, actor, data.student_id);
  return data as ReportRow;
}

function deterministicAssessment(
  reportType: AdvisorReportType,
  student: StudentRow,
  context: Record<string, string | number | boolean | null>,
): Record<string, unknown> {
  if (reportType === 'language_assessment') {
    const current = parseScore(context.current_score);
    const target = parseScore(context.target_score);
    if (current === null || target === null) {
      return { status: 'insufficient_data', current_score: context.current_score ?? null, target_score: context.target_score ?? null };
    }
    const gap = Math.round((target - current) * 100) / 100;
    return {
      status: gap <= 0 ? 'target_met' : 'target_gap',
      current_score: current,
      target_score: target,
      score_gap: Math.max(0, gap),
      calculation: 'target_score - current_score',
    };
  }

  if (reportType === 'pre_meeting_brief') {
    const missingFields: string[] = [];
    if (!student.education_status) missingFields.push('Eğitim durumu');
    if (!student.target_countries) missingFields.push('Hedef ülke');
    if (!student.target_programs && !student.target_degree) missingFields.push('Hedef program');
    if (!student.budget) missingFields.push('Bütçe');
    return { status: 'prepared', missing_profile_fields: missingFields.slice(0, 10) };
  }

  return {
    status: context.counselor_notes ? 'notes_received' : 'insufficient_data',
    has_counselor_notes: Boolean(context.counselor_notes),
  };
}

function minimizeStudent(student: StudentRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  copySafe(result, student, [
    'education_status', 'current_grade', 'gpa', 'target_degree', 'target_countries',
    'target_programs', 'budget', 'english_level', 'interests', 'pipeline_stage',
  ]);
  if (isRecord(student.analysis) && isRecord(student.analysis.language)) {
    const language: Record<string, unknown> = {};
    copySafe(language, student.analysis.language, [
      'examType', 'examScore', 'examType2', 'examScore2', 'examType3', 'examScore3',
      'estimatedLevel', 'targetExam', 'pastExamDate', 'pastExamDate2', 'pastExamDate3',
    ]);
    if (Object.keys(language).length) result.language = language;
  }
  return result;
}

function sanitizeContext(value: unknown): Record<string, string | number | boolean | null> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new SafeError('VALIDATION_ERROR', 'context nesne olmalıdır.', 400);
  const allowed = new Set([
    'meeting_goal', 'counselor_notes', 'exam_type', 'current_score', 'target_score',
    'target_date', 'weekly_study_hours', 'focus_area',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new SafeError('VALIDATION_ERROR', 'context desteklenmeyen alan içeriyor.', 400);
  }
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || typeof item === 'boolean') result[key] = item;
    else if (typeof item === 'number' && Number.isFinite(item)) result[key] = item;
    else if (typeof item === 'string') {
      const maximum = key === 'counselor_notes' ? 3000 : 500;
      result[key] = redactDirectIdentifiers(item).trim().slice(0, maximum);
    } else throw new SafeError('VALIDATION_ERROR', `context.${key} geçersiz.`, 400);
  }
  return result;
}

function redactDirectIdentifiers(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[E-POSTA KALDIRILDI]')
    .replace(/(?:\+?\d[\s().-]?){10,15}/g, '[TELEFON KALDIRILDI]');
}

function publicReport(row: ReportRow) {
  const activeShare = (row.ai_advisor_report_share_links ?? [])
    .filter((share) => !share.revoked_at && new Date(share.expires_at).getTime() > Date.now())
    .sort((left, right) => right.expires_at.localeCompare(left.expires_at))[0];
  return {
    id: row.id,
    student_id: row.student_id,
    report_type: row.report_type,
    status: row.status,
    deterministic_result: row.deterministic_result,
    generated_content: row.generated_content,
    counselor_content: row.counselor_content,
    provider: row.provider,
    model: row.model,
    prompt_version: row.prompt_version,
    generated_by: row.generated_by,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    active_share: activeShare ? {
      id: activeShare.id,
      expires_at: activeShare.expires_at,
      max_views: activeShare.max_views,
      view_count: activeShare.view_count,
    } : null,
  };
}

async function revokeReportShares(admin: AdminClient, reportId: string, actorId: string) {
  const { error } = await admin.from('ai_advisor_report_share_links')
    .update({ revoked_at: new Date().toISOString(), revoked_by: actorId })
    .eq('report_id', reportId)
    .is('revoked_at', null);
  if (error) internalFailure('Rapor paylaşımları iptal edilemedi', error);
}

async function writeAudit(admin: AdminClient, values: Record<string, unknown>) {
  const { error } = await admin.from('ai_advisor_audit_log').insert(values);
  if (error) internalFailure('AI Danışman güvenlik kaydı oluşturulamadı', error);
}

function requireRuleManager(actor: AuthenticatedActor) {
  if (actor.role !== 'Super Admin' && actor.role !== 'Admin') {
    throw new SafeError('FORBIDDEN', 'UNIC AI kurallarını yalnız yönetici rolleri düzenleyebilir.', 403);
  }
}

function requiredReportType(value: unknown): AdvisorReportType {
  if (typeof value !== 'string' || !REPORT_TYPES.has(value as AdvisorReportType)) {
    throw new SafeError('VALIDATION_ERROR', 'report_type geçersiz.', 400);
  }
  return value as AdvisorReportType;
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new SafeError('VALIDATION_ERROR', `${field} geçerli bir UUID olmalıdır.`, 400);
  }
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredUuid(value, field);
}

function requiredString(value: unknown, field: string, minimum: number, maximum: number) {
  if (typeof value !== 'string') throw new SafeError('VALIDATION_ERROR', `${field} metin olmalıdır.`, 400);
  const cleaned = value.trim();
  if (cleaned.length < minimum || cleaned.length > maximum) {
    throw new SafeError('VALIDATION_ERROR', `${field} ${minimum}-${maximum} karakter olmalıdır.`, 400);
  }
  return cleaned;
}

function positiveInteger(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > maximum) {
    throw new SafeError('VALIDATION_ERROR', `${field} 1 ile ${maximum} arasında tam sayı olmalıdır.`, 400);
  }
  return value;
}

function requiredAllowedInteger(value: unknown, allowed: Set<number>, field: string) {
  const integer = positiveInteger(value, field, Math.max(...allowed));
  if (!allowed.has(integer)) throw new SafeError('VALIDATION_ERROR', `${field} desteklenmeyen bir değer.`, 400);
  return integer;
}

function parseScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const score = Number(normalized);
  return Number.isFinite(score) && score >= 0 && score <= 1000 ? score : null;
}

function copySafe(target: Record<string, unknown>, source: object, fields: string[]) {
  const record = source as Record<string, unknown>;
  for (const field of fields) {
    const value = safeValue(record[field]);
    if (value !== undefined) target[field] = value;
  }
}

function safeValue(value: unknown): string | number | boolean | string[] | undefined {
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.slice(0, 20).map((item) => item.slice(0, 200));
  }
  return undefined;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function digestHex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requestAuditFields(req: Request) {
  const candidate = req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;
  return {
    ip_address: candidate && isIp(candidate) ? candidate : null,
    user_agent: req.headers.get('user-agent')?.slice(0, 1000) ?? null,
  };
}

function isIp(value: string) {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255);
  }
  if (!/^[0-9a-f:]+$/i.test(value)) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function internalFailure(context: string, error: unknown): never {
  console.error(`${context}:`, error);
  throw new SafeError('INTERNAL_ERROR', 'AI Danışman işlemi tamamlanamadı.', 500);
}
