import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor, type AuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';
import { isUuid } from '../_shared/userHierarchy.ts';

const BUCKET = 'student-documents';
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 64 * 1024;
const VIEW_URL_SECONDS = 300;
const SHARE_HOURS = new Set([24, 72, 168]);

type AdminClient = ReturnType<typeof createClient>;
type StudentRow = { id: string; branch_id: string | null; counselor_id: string | null };
type DocumentRow = {
  id: string;
  student_id: string;
  document_type_id: string;
  branch_id: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  version: number;
  status: 'uploaded' | 'approved' | 'rejected' | 'archived';
  archived_at: string | null;
  created_at: string;
  document_types?: unknown;
  student_document_share_links?: Array<{
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
      throw new SafeError('FORBIDDEN', 'Öğrenci rolü belge modülüne erişemez.', 403);
    }

    const contentType = req.headers.get('content-type') ?? '';
    const result = contentType.toLowerCase().startsWith('multipart/form-data')
      ? await handleUpload(admin, actor, req)
      : await handleJsonOperation(admin, actor, req);

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

async function handleJsonOperation(admin: AdminClient, actor: AuthenticatedActor, req: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await req.json();
    if (!isRecord(value)) throw new Error('body is not an object');
    body = value;
  } catch (error) {
    console.error('Student document JSON ayrıştırılamadı:', error);
    throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
  }

  switch (body.operation) {
    case 'list':
      return await listDocuments(admin, actor, body, req);
    case 'archive':
      return await archiveDocument(admin, actor, body, req);
    case 'create_share_link':
      return await createShareLink(admin, actor, body, req);
    case 'revoke_share_link':
      return await revokeShareLink(admin, actor, body, req);
    case 'permanent_delete':
      return await permanentlyDeleteDocument(admin, actor, body, req);
    default:
      throw new SafeError('VALIDATION_ERROR', 'Desteklenmeyen operation değeri.', 400);
  }
}

async function handleUpload(admin: AdminClient, actor: AuthenticatedActor, req: Request) {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    throw new SafeError('PAYLOAD_TOO_LARGE', 'Belge en fazla 3 MB olabilir.', 413);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch (error) {
    console.error('Belge multipart gövdesi ayrıştırılamadı:', error);
    throw new SafeError('VALIDATION_ERROR', 'Geçerli bir multipart form gönderilmelidir.', 400);
  }

  if (form.get('operation') !== 'upload') {
    throw new SafeError('VALIDATION_ERROR', 'Multipart isteklerde operation upload olmalıdır.', 400);
  }
  const studentId = requiredUuid(form.get('student_id'), 'student_id');
  const documentTypeId = requiredUuid(form.get('document_type_id'), 'document_type_id');
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1) {
    throw new SafeError('VALIDATION_ERROR', 'Boş olmayan bir file alanı zorunludur.', 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new SafeError('PAYLOAD_TOO_LARGE', 'Belge en fazla 3 MB olabilir.', 413);
  }

  const student = await authorizeStudent(admin, actor, studentId);
  const { data: definition, error: typeError } = await admin
    .from('document_types')
    .select('id, is_active')
    .eq('id', documentTypeId)
    .maybeSingle();
  if (typeError) internalFailure('Belge türü okunamadı', typeError);
  if (!definition || !definition.is_active) {
    throw new SafeError('VALIDATION_ERROR', 'Belge türü bulunamadı veya aktif değil.', 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectFileType(bytes);
  if (!detected || file.type !== detected.mime) {
    throw new SafeError(
      'VALIDATION_ERROR',
      'Dosya içeriği PDF, PNG, JPEG veya WEBP olmalı ve bildirilen MIME türüyle eşleşmelidir.',
      400,
    );
  }

  const documentId = crypto.randomUUID();
  const storagePath = `${student.branch_id}/${student.id}/${documentId}/${crypto.randomUUID()}.${detected.extension}`;
  const sha256 = await digestHex(bytes);
  const originalFileName = normalizeOriginalName(file.name);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: detected.mime,
    cacheControl: 'private, max-age=0',
    upsert: false,
  });
  if (uploadError) {
    console.error('Belge Storage yüklemesi başarısız:', uploadError);
    throw new SafeError('INTERNAL_ERROR', 'Belge yüklenemedi.', 500);
  }

  const auditFields = requestAuditFields(req);
  const { data: registeredDocuments, error: insertError } = await admin.rpc('register_student_document', {
    p_id: documentId,
    p_student_id: student.id,
    p_branch_id: student.branch_id,
    p_document_type_id: documentTypeId,
    p_storage_path: storagePath,
    p_original_name: originalFileName,
    p_mime_type: detected.mime,
    p_size_bytes: file.size,
    p_checksum_sha256: sha256,
    p_uploaded_by: actor.id,
    p_ip_address: auditFields.ip_address,
    p_user_agent: auditFields.user_agent,
  });
  const document = registeredDocuments?.[0];
  if (insertError || !document) {
    await rollbackUploadedFile(admin, storagePath, documentId, insertError);
    throw new SafeError('CONSISTENCY_ERROR', 'Belge kaydı oluşturulamadı; yükleme geri alındı.', 500);
  }

  return { document: publicDocument(document as DocumentRow) };
}

async function listDocuments(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const studentId = requiredUuid(body.student_id, 'student_id');
  const student = await authorizeStudent(admin, actor, studentId);
  const documentId = optionalUuid(body.document_id, 'document_id');

  let query = admin
    .from('student_documents')
     .select('*, document_types(id, name, english_name, note, file_type, allow_multiple, is_required, sort_order), student_document_share_links(id, expires_at, max_views, view_count, revoked_at)')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false });
  if (documentId) query = query.eq('id', documentId);

  const { data, error } = await query;
  if (error) internalFailure('Belgeler listelenemedi', error);
  if (documentId && (!data || data.length !== 1)) {
    throw new SafeError('TARGET_NOT_FOUND', 'Belge bulunamadı.', 404);
  }

  const documents = (data ?? []).map((row: DocumentRow) => publicDocument(row));
  if (!documentId) return { documents };

  const row = data![0] as DocumentRow;
   if (row.status === 'archived') {
    throw new SafeError('VALIDATION_ERROR', 'Arşivlenmiş belge için görüntüleme bağlantısı oluşturulamaz.', 409);
  }
  const { data: signed, error: signError } = await admin.storage.from(BUCKET)
    .createSignedUrl(row.storage_path, VIEW_URL_SECONDS);
  if (signError || !signed?.signedUrl) internalFailure('Görüntüleme bağlantısı oluşturulamadı', signError);
  await writeAudit(admin, {
    document_id: row.id,
    student_id: row.student_id,
    actor_user_id: actor.id,
    event_type: 'internal_view_url_created',
    ...requestAuditFields(req),
    metadata: { ttl_seconds: VIEW_URL_SECONDS },
  });

  return { document: { ...documents[0], view_url: signed.signedUrl, view_url_expires_in: VIEW_URL_SECONDS } };
}

async function archiveDocument(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const document = await authorizedDocument(admin, actor, requiredUuid(body.document_id, 'document_id'));
  if (document.status === 'archived') {
    throw new SafeError('VALIDATION_ERROR', 'Belge zaten arşivlenmiş.', 409);
  }
  const auditFields = requestAuditFields(req);
  const { data: archived, error } = await admin.rpc('archive_student_document', {
    p_document_id: document.id,
    p_actor_user_id: actor.id,
    p_ip_address: auditFields.ip_address,
    p_user_agent: auditFields.user_agent,
  });
  if (error) internalFailure('Belge arşivlenemedi', error);
  if (!archived) throw new SafeError('VALIDATION_ERROR', 'Belge durumu eşzamanlı olarak değişti.', 409);
  return { document_id: document.id, status: 'archived' };
}

async function createShareLink(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const document = await authorizedDocument(admin, actor, requiredUuid(body.document_id, 'document_id'));
   if (document.status !== 'uploaded' && document.status !== 'approved') {
     throw new SafeError('VALIDATION_ERROR', 'Yalnız yüklenmiş veya onaylanmış belgeler paylaşılabilir.', 409);
  }
  const hours = body.expires_in_hours === undefined ? 72 : body.expires_in_hours;
  if (typeof hours !== 'number' || !SHARE_HOURS.has(hours)) {
    throw new SafeError('VALIDATION_ERROR', 'expires_in_hours 24, 72 veya 168 olmalıdır.', 400);
  }
  const maxViews = body.max_views === undefined || body.max_views === null
    ? null
    : positiveInteger(body.max_views, 'max_views', 10000);
  const token = randomToken();
  const tokenHash = await digestHex(new TextEncoder().encode(token));
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { data: share, error } = await admin.from('student_document_share_links').insert({
    document_id: document.id,
    token_hash: tokenHash,
    created_by: actor.id,
    expires_at: expiresAt,
    max_views: maxViews,
  }).select('id, expires_at, max_views').single();
  if (error || !share) internalFailure('Paylaşım bağlantısı oluşturulamadı', error);
  try {
    await writeAudit(admin, {
      document_id: document.id, share_link_id: share.id, student_id: document.student_id,
      actor_user_id: actor.id, event_type: 'share_created', ...requestAuditFields(req),
      metadata: { expires_in_hours: hours, max_views: maxViews },
    });
  } catch (auditError) {
    const { error: rollbackError } = await admin.from('student_document_share_links').delete().eq('id', share.id);
    if (rollbackError) {
      console.error('KRİTİK: Audit hatasından sonra paylaşım bağlantısı rollback edilemedi:', {
        shareLinkId: share.id, auditError, rollbackError,
      });
    }
    throw auditError;
  }
  return { share_link: { id: share.id, token, expires_at: share.expires_at, max_views: share.max_views } };
}

async function revokeShareLink(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  const shareId = requiredUuid(body.share_link_id, 'share_link_id');
  const { data: share, error: readError } = await admin.from('student_document_share_links')
    .select('id, document_id, revoked_at, student_documents!inner(id, student_id, branch_id, status)')
    .eq('id', shareId)
    .maybeSingle();
  if (readError) internalFailure('Paylaşım bağlantısı okunamadı', readError);
  if (!share) throw new SafeError('TARGET_NOT_FOUND', 'Paylaşım bağlantısı bulunamadı.', 404);
  const joined = share.student_documents as unknown as DocumentRow;
  await authorizeStudent(admin, actor, joined.student_id);
  if (share.revoked_at) throw new SafeError('VALIDATION_ERROR', 'Paylaşım bağlantısı zaten iptal edilmiş.', 409);

  const auditFields = requestAuditFields(req);
  const { data: revoked, error } = await admin.rpc('revoke_student_document_share', {
    p_share_link_id: shareId,
    p_actor_user_id: actor.id,
    p_ip_address: auditFields.ip_address,
    p_user_agent: auditFields.user_agent,
  });
  if (error) internalFailure('Paylaşım bağlantısı iptal edilemedi', error);
  if (!revoked) throw new SafeError('VALIDATION_ERROR', 'Paylaşım bağlantısı eşzamanlı olarak değişti.', 409);
  return { share_link_id: shareId, revoked: true };
}

async function permanentlyDeleteDocument(
  admin: AdminClient,
  actor: AuthenticatedActor,
  body: Record<string, unknown>,
  req: Request,
) {
  if (actor.role !== 'Super Admin') {
    throw new SafeError('FORBIDDEN', 'Kalıcı silme yalnız Super Admin tarafından yapılabilir.', 403);
  }
  const document = await authorizedDocument(admin, actor, requiredUuid(body.document_id, 'document_id'));
  const { error: storageError } = await admin.storage.from(BUCKET).remove([document.storage_path]);
  if (storageError) internalFailure('Belge dosyası kalıcı olarak silinemedi', storageError);

  const { data: deleted, error } = await admin.from('student_documents')
    .delete().eq('id', document.id).select('id').maybeSingle();
  if (error || !deleted) {
    console.error('KRİTİK: Storage dosyası silindi ancak belge veritabanı kaydı silinemedi:', {
      documentId: document.id, storagePath: document.storage_path, error,
    });
    throw new SafeError('CONSISTENCY_ERROR', 'Dosya silindi ancak belge kaydı silinemedi; yönetici kontrolü gerekiyor.', 500);
  }
  await writeAudit(admin, {
    document_id: null, student_id: document.student_id, actor_user_id: actor.id,
    event_type: 'permanently_deleted', ...requestAuditFields(req),
     metadata: { document_id: document.id, storage_path: document.storage_path, checksum_sha256: document.checksum_sha256 },
  });
  return { document_id: document.id, permanently_deleted: true };
}

async function authorizeStudent(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
): Promise<StudentRow & { branch_id: string }> {
  const { data: student, error } = await admin.from('student_profiles')
    .select('id, branch_id, counselor_id')
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
    allowed = student.counselor_id === actor.id;
  }
  if (!allowed) throw new SafeError('FORBIDDEN', 'Bu öğrenci için belge erişim yetkiniz yok.', 403);
  return student as StudentRow & { branch_id: string };
}

async function authorizedDocument(admin: AdminClient, actor: AuthenticatedActor, documentId: string) {
  const { data, error } = await admin.from('student_documents').select('*').eq('id', documentId).maybeSingle();
  if (error) internalFailure('Belge bilgisi okunamadı', error);
  if (!data) throw new SafeError('TARGET_NOT_FOUND', 'Belge bulunamadı.', 404);
  await authorizeStudent(admin, actor, data.student_id);
  return data as DocumentRow;
}

async function writeAudit(admin: AdminClient, values: Record<string, unknown>) {
  const { error } = await admin.from('student_document_audit_log').insert(values);
  if (error) internalFailure('Belge güvenlik kaydı oluşturulamadı', error);
}

async function rollbackUploadedFile(
  admin: AdminClient,
  storagePath: string,
  documentId: string,
  insertError: unknown,
) {
  const { error } = await admin.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    console.error('KRİTİK: Metadata insert hatasından sonra Storage rollback başarısız:', {
      documentId, storagePath, insertError, rollbackError: error,
    });
  }
}

function publicDocument(row: DocumentRow) {
  const activeShare = (row.student_document_share_links ?? [])
    .filter((share) => !share.revoked_at && new Date(share.expires_at).getTime() > Date.now())
    .sort((left, right) => right.expires_at.localeCompare(left.expires_at))[0];

  return {
    id: row.id,
    student_id: row.student_id,
    document_type_id: row.document_type_id,
     original_name: row.original_name,
    mime_type: row.mime_type,
     size_bytes: row.size_bytes,
     checksum_sha256: row.checksum_sha256,
     version: row.version,
    status: row.status,
    archived_at: row.archived_at,
    created_at: row.created_at,
     document_type: row.document_types ?? undefined,
     active_share: activeShare ? {
       id: activeShare.id,
       expires_at: activeShare.expires_at,
       max_views: activeShare.max_views,
       view_count: activeShare.view_count,
     } : null,
  };
}

function detectFileType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
      bytes[3] === 0x46 && bytes[4] === 0x2d) return { mime: 'application/pdf', extension: 'pdf' };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value)) return { mime: 'image/png', extension: 'png' };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}

function normalizeOriginalName(value: string) {
  return value.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim().slice(0, 240) || 'document';
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
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const connecting = req.headers.get('cf-connecting-ip')?.trim();
  const candidate = connecting || forwarded || null;
  return {
    ip_address: candidate && isIp(candidate) ? candidate : null,
    user_agent: req.headers.get('user-agent')?.slice(0, 1000) ?? null,
  };
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

function positiveInteger(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > maximum) {
    throw new SafeError('VALIDATION_ERROR', `${field} 1 ile ${maximum} arasında tam sayı olmalıdır.`, 400);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function internalFailure(context: string, error: unknown): never {
  console.error(`${context}:`, error);
  throw new SafeError('INTERNAL_ERROR', 'Belge işlemi tamamlanamadı.', 500);
}
