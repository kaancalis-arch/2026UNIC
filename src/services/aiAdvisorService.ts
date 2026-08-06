import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export type AIAdvisorReportType = 'pre_meeting_brief' | 'language_assessment' | 'post_meeting_report';
export type AIAdvisorReportStatus = 'draft' | 'approved' | 'archived';

export type AIAdvisorContent = {
  title: string;
  summary: string;
  observations: string[];
  questions: string[];
  actions: string[];
  warning: string;
};

export type AIAdvisorReport = {
  id: string;
  studentId: string;
  reportType: AIAdvisorReportType;
  status: AIAdvisorReportStatus;
  deterministicResult: Record<string, unknown>;
  generatedContent: AIAdvisorContent;
  counselorContent: AIAdvisorContent;
  provider: string;
  model: string;
  promptVersion: string;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  activeShare?: {
    id: string;
    expiresAt: string;
    maxViews: number | null;
    viewCount: number;
  };
};

export type AIAdvisorRule = {
  id: string;
  reportType: AIAdvisorReportType;
  title: string;
  instruction: string;
  priority: number;
  status: 'active' | 'inactive';
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AIAdvisorContext = {
  meeting_goal?: string;
  counselor_notes?: string;
  exam_type?: string;
  current_score?: string;
  target_score?: string;
  target_date?: string;
  weekly_study_hours?: number;
  focus_area?: string;
};

type EdgeResponse = {
  success?: boolean;
  error?: string;
  report?: unknown;
  reports?: unknown[];
  rule?: unknown;
  rules?: unknown[];
  share_link?: { id: string; token: string; expires_at: string; max_views: number | null };
};

const requireAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
  }
  return data.session.access_token;
};

const parseEdgeError = async (error: unknown, data?: unknown): Promise<never> => {
  let body = data as EdgeResponse | undefined;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      body = await error.context.clone().json();
    } catch {}
  }
  throw new Error(body?.error || 'AI Danışman işlemi tamamlanamadı.');
};

const invoke = async (body: Record<string, unknown>): Promise<EdgeResponse> => {
  const token = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('ai-advisor', {
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (error || !data?.success) await parseEdgeError(error, data);
  return data as EdgeResponse;
};

const mapReport = (value: any): AIAdvisorReport => ({
  id: value.id,
  studentId: value.student_id,
  reportType: value.report_type,
  status: value.status,
  deterministicResult: value.deterministic_result || {},
  generatedContent: value.generated_content,
  counselorContent: value.counselor_content,
  provider: value.provider,
  model: value.model,
  promptVersion: value.prompt_version,
  generatedBy: value.generated_by,
  approvedBy: value.approved_by || undefined,
  approvedAt: value.approved_at || undefined,
  createdAt: value.created_at,
  updatedAt: value.updated_at,
  activeShare: value.active_share ? {
    id: value.active_share.id,
    expiresAt: value.active_share.expires_at,
    maxViews: value.active_share.max_views,
    viewCount: value.active_share.view_count,
  } : undefined,
});

const mapRule = (value: any): AIAdvisorRule => ({
  id: value.id,
  reportType: value.report_type,
  title: value.title,
  instruction: value.instruction,
  priority: value.priority,
  status: value.status,
  version: value.version,
  createdAt: value.created_at,
  updatedAt: value.updated_at,
});

export const aiAdvisorService = {
  async listReports(studentId: string): Promise<AIAdvisorReport[]> {
    const response = await invoke({ operation: 'list_reports', student_id: studentId });
    return (response.reports || []).map(mapReport);
  },

  async generateReport(
    studentId: string,
    reportType: AIAdvisorReportType,
    context: AIAdvisorContext,
  ): Promise<AIAdvisorReport> {
    const response = await invoke({
      operation: 'generate_report', student_id: studentId, report_type: reportType, context,
    });
    if (!response.report) throw new Error('Oluşturulan rapor alınamadı.');
    return mapReport(response.report);
  },

  async updateDraft(reportId: string, content: AIAdvisorContent): Promise<AIAdvisorReport> {
    const response = await invoke({ operation: 'update_draft', report_id: reportId, content });
    if (!response.report) throw new Error('Güncellenen rapor alınamadı.');
    return mapReport(response.report);
  },

  async approveReport(reportId: string): Promise<AIAdvisorReport> {
    const response = await invoke({ operation: 'approve_report', report_id: reportId });
    if (!response.report) throw new Error('Onaylanan rapor alınamadı.');
    return mapReport(response.report);
  },

  async archiveReport(reportId: string): Promise<AIAdvisorReport> {
    const response = await invoke({ operation: 'archive_report', report_id: reportId });
    if (!response.report) throw new Error('Arşivlenen rapor alınamadı.');
    return mapReport(response.report);
  },

  async createShareLink(
    reportId: string,
    expiresInHours: 24 | 72 | 168 = 72,
    maxViews?: number,
  ) {
    const response = await invoke({
      operation: 'create_share_link', report_id: reportId,
      expires_in_hours: expiresInHours, max_views: maxViews ?? null,
    });
    if (!response.share_link?.token) throw new Error('Paylaşım bağlantısı oluşturulamadı.');
    return {
      id: response.share_link.id,
      url: `${window.location.origin}/share/report/${encodeURIComponent(response.share_link.token)}`,
      expiresAt: response.share_link.expires_at,
    };
  },

  async revokeShareLink(shareLinkId: string): Promise<void> {
    await invoke({ operation: 'revoke_share_link', share_link_id: shareLinkId });
  },

  async listRules(): Promise<AIAdvisorRule[]> {
    const response = await invoke({ operation: 'list_rules' });
    return (response.rules || []).map(mapRule);
  },

  async saveRule(values: {
    id?: string;
    reportType: AIAdvisorReportType;
    title: string;
    instruction: string;
    priority: number;
    status: 'active' | 'inactive';
  }): Promise<AIAdvisorRule> {
    const response = await invoke({
      operation: 'save_rule', rule_id: values.id,
      report_type: values.reportType, title: values.title, instruction: values.instruction,
      priority: values.priority, status: values.status,
    });
    if (!response.rule) throw new Error('UNIC AI kuralı kaydedilemedi.');
    return mapRule(response.rule);
  },
};
