import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface SharedDocumentResult {
  id: string;
  fileName: string;
  mimeType: string;
  viewUrl: string;
}

const pendingRequests = new Map<string, Promise<SharedDocumentResult>>();

const resolveToken = async (token: string): Promise<SharedDocumentResult> => {
  const { data, error } = await supabase.functions.invoke('student-document-share', {
    body: { token },
  });
  if (error) {
    let message = 'Paylaşım bağlantısı geçersiz veya süresi dolmuş.';
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        if (typeof body?.error === 'string') message = body.error;
      } catch {}
    }
    throw new Error(message);
  }
  if (!data?.success || !data.document?.view_url) {
    throw new Error('Paylaşılan belge açılamadı.');
  }
  return {
    id: data.document.id,
    fileName: data.document.file_name,
    mimeType: data.document.mime_type,
    viewUrl: data.document.view_url,
  };
};

export const studentDocumentShareService = {
  resolve(token: string): Promise<SharedDocumentResult> {
    const existing = pendingRequests.get(token);
    if (existing) return existing;
    const request = resolveToken(token)
      .then(result => {
        window.setTimeout(() => pendingRequests.delete(token), 1000);
        return result;
      })
      .catch(error => {
        pendingRequests.delete(token);
        throw error;
      });
    pendingRequests.set(token, request);
    return request;
  },
};
