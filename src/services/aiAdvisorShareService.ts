import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { AIAdvisorContent, AIAdvisorReportType } from './aiAdvisorService';

export type SharedAIAdvisorReport = {
  id: string;
  reportType: AIAdvisorReportType;
  content: AIAdvisorContent;
  approvedAt: string;
};

export const aiAdvisorShareService = {
  async resolve(token: string): Promise<SharedAIAdvisorReport> {
    const { data, error } = await supabase.functions.invoke('ai-advisor-share', { body: { token } });
    let message = data?.error;
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      try {
        message = (await error.context.clone().json()).error || message;
      } catch {}
    }
    if (error || !data?.success || !data.report) {
      throw new Error(message || 'Paylaşılan rapor açılamadı.');
    }
    return {
      id: data.report.id,
      reportType: data.report.report_type,
      content: data.report.content,
      approvedAt: data.report.approved_at,
    };
  },
};
