import { FunctionsHttpError } from '@supabase/supabase-js';
import type { StudentDocument } from '../types';
import { supabase } from './supabaseClient';

type DocumentOperation =
  | 'list'
  | 'archive'
  | 'retry_drive_sync'
  | 'create_share_link'
  | 'revoke_share_link'
  | 'permanent_delete';

type EdgeResponse = {
  success?: boolean;
  code?: string;
  error?: string;
  documents?: unknown[];
  document?: unknown;
  share_link?: {
    id: string;
    token: string;
    expires_at: string;
    max_views: number | null;
  };
};

const requireAccessToken = async (): Promise<string> => {
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
  throw new Error(body?.error || 'Belge işlemi tamamlanamadı.');
};

const invoke = async (body: Record<string, unknown> | FormData): Promise<EdgeResponse> => {
  const token = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('student-documents', {
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (error || !data?.success) await parseEdgeError(error, data);
  return data as EdgeResponse;
};

const mapDocument = (value: any): StudentDocument => ({
  id: value.id,
  studentId: value.student_id,
  documentTypeId: value.document_type_id,
  type: value.document_type?.name || 'Belge',
  originalName: value.original_name,
  mimeType: value.mime_type,
  sizeBytes: value.size_bytes,
  checksumSha256: value.checksum_sha256,
  version: value.version,
  status: value.status,
  driveSyncStatus: value.drive_sync_status,
  driveFileId: value.drive_file_id || undefined,
  driveFileName: value.drive_file_name || undefined,
  driveSyncedAt: value.drive_synced_at || undefined,
  driveSyncStartedAt: value.drive_sync_started_at || undefined,
  driveSyncNextRetryAt: value.drive_sync_next_retry_at || undefined,
  uploadedAt: value.created_at,
  archivedAt: value.archived_at || undefined,
  activeShare: value.active_share ? {
    id: value.active_share.id,
    expiresAt: value.active_share.expires_at,
    maxViews: value.active_share.max_views,
    viewCount: value.active_share.view_count,
  } : undefined,
});

const jsonOperation = async (operation: DocumentOperation, values: Record<string, unknown>) =>
  invoke({ operation, ...values });

export const studentDocumentService = {
  async list(studentId: string): Promise<StudentDocument[]> {
    const response = await jsonOperation('list', { student_id: studentId });
    return (response.documents || []).map(mapDocument);
  },

  async upload(studentId: string, documentTypeId: string, file: File): Promise<StudentDocument> {
    const form = new FormData();
    form.append('operation', 'upload');
    form.append('student_id', studentId);
    form.append('document_type_id', documentTypeId);
    form.append('file', file);
    const response = await invoke(form);
    if (!response.document) throw new Error('Yüklenen belge bilgisi alınamadı.');
    return mapDocument(response.document);
  },

  async createViewUrl(studentId: string, documentId: string): Promise<string> {
    const response = await jsonOperation('list', { student_id: studentId, document_id: documentId });
    const viewUrl = (response.document as { view_url?: string } | undefined)?.view_url;
    if (!viewUrl) throw new Error('Belge görüntüleme bağlantısı oluşturulamadı.');
    return viewUrl;
  },

  async archive(documentId: string): Promise<void> {
    await jsonOperation('archive', { document_id: documentId });
  },

  async retryDriveSync(documentId: string): Promise<void> {
    await jsonOperation('retry_drive_sync', { document_id: documentId });
  },

  async createShareLink(
    documentId: string,
    expiresInHours: 24 | 72 | 168 = 72,
    maxViews?: number,
  ): Promise<{ id: string; url: string; expiresAt: string }> {
    const response = await jsonOperation('create_share_link', {
      document_id: documentId,
      expires_in_hours: expiresInHours,
      max_views: maxViews ?? null,
    });
    if (!response.share_link?.token) throw new Error('Paylaşım bağlantısı oluşturulamadı.');
    return {
      id: response.share_link.id,
      url: `${window.location.origin}/share/document/${encodeURIComponent(response.share_link.token)}`,
      expiresAt: response.share_link.expires_at,
    };
  },

  async revokeShareLink(shareLinkId: string): Promise<void> {
    await jsonOperation('revoke_share_link', { share_link_id: shareLinkId });
  },

  async permanentlyDelete(documentId: string): Promise<void> {
    await jsonOperation('permanent_delete', { document_id: documentId });
  },
};
