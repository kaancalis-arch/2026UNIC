import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';

const BUCKET = 'student-documents';
const SIGNED_URL_SECONDS = 300;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = corsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse(new SafeError('METHOD_NOT_ALLOWED', 'Yalnız POST metodu desteklenir.', 405), headers);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
      throw new SafeError('CONFIGURATION_ERROR', 'Sunucu yapılandırması eksik.', 500);
    }

    let value: unknown;
    try {
      value = await req.json();
    } catch (error) {
      console.error('Paylaşım token gövdesi ayrıştırılamadı:', error);
      throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
    }
    if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value.token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(value.token)) {
      throw new SafeError('VALIDATION_ERROR', 'Geçerli bir token alanı zorunludur.', 400);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const tokenHash = await digestHex(new TextEncoder().encode(value.token));
    const { data, error } = await admin.rpc('consume_student_document_share', {
      p_token_hash: tokenHash,
      p_ip_address: requestIp(req),
      p_user_agent: req.headers.get('user-agent')?.slice(0, 1000) ?? null,
    });
    if (error) {
      console.error('Paylaşım token tüketimi başarısız:', error);
      throw new SafeError('INTERNAL_ERROR', 'Paylaşılan belge açılamadı.', 500);
    }
    const document = data?.[0];
    if (!document) {
      throw new SafeError('TARGET_NOT_FOUND', 'Paylaşım bağlantısı geçersiz, süresi dolmuş veya kullanım limiti dolmuş.', 404);
    }

    const { data: signed, error: signError } = await admin.storage.from(BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);
    if (signError || !signed?.signedUrl) {
      console.error('Paylaşılan belge signed URL oluşturulamadı:', signError);
      throw new SafeError('INTERNAL_ERROR', 'Paylaşılan belge açılamadı.', 500);
    }

    return jsonResponse({
      success: true,
      document: {
        id: document.document_id,
         file_name: document.original_name,
        mime_type: document.mime_type,
        view_url: signed.signedUrl,
        view_url_expires_in: SIGNED_URL_SECONDS,
      },
    }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

async function digestHex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requestIp(req: Request) {
  const value = req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (!value) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255) ? value : null;
  }
  if (!/^[0-9a-f:]+$/i.test(value)) return null;
  try {
    new URL(`http://[${value}]/`);
    return value;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
