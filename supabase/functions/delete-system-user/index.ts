import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';
import { assertNoUserDependencies } from '../_shared/userDependencies.ts';
import { assertNotSelfTarget, canManageDirectTarget } from '../_shared/systemUserManagement.ts';
import { isUuid } from '../_shared/userHierarchy.ts';

type SystemUserSnapshot = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  branch_id: string | null;
  parent_user_id: string | null;
  status: string;
  avatar_url: string | null;
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const actor = await authorizeAuthenticatedActor(admin, req);
    const payload = await parsePayload(req);
    const targetId = payload.id;

    assertNotSelfTarget(actor.id, targetId, 'SELF_DELETE_RESTRICTED');

    const { data: snapshot, error: targetError } = await admin
      .from('system_users')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();
    if (targetError) {
      console.error('Silinecek kullanıcı profili okunamadı:', targetError);
      throw new SafeError('INTERNAL_ERROR', 'Kullanıcı bilgileri okunamadı.', 500);
    }
    if (!snapshot) throw new SafeError('TARGET_NOT_FOUND', 'Kullanıcı bulunamadı.', 404);
    if (!canManageDirectTarget(actor, snapshot)) {
      throw new SafeError('FORBIDDEN', 'Yalnız doğrudan bağlı kullanıcılar kalıcı olarak silinebilir.', 403);
    }
    if (payload.full_name !== snapshot.full_name) {
      throw new SafeError('VALIDATION_ERROR', 'Kalıcı silme onayındaki kullanıcı adı eşleşmiyor.', 400);
    }

    await assertNoUserDependencies(admin, targetId, { includeCalendar: true, includePermanentRecords: true });

    let deleteQuery = admin
      .from('system_users')
      .delete()
      .eq('id', targetId)
      .eq('parent_user_id', actor.id);
    if (actor.role !== 'Super Admin' && actor.role !== 'Admin') {
      deleteQuery = deleteQuery.eq('branch_id', actor.branch_id);
    }
    const { data: deletedProfile, error: profileError } = await deleteQuery
      .select('id')
      .maybeSingle();
    if (!profileError && !deletedProfile) {
      throw new SafeError('FORBIDDEN', 'Kullanıcı artık doğrudan hesabınıza bağlı değil.', 403);
    }
    if (profileError) {
      console.error('Sistem kullanıcı profili silinemedi:', profileError);
      if (isSuperAdminProtectionError(profileError)) {
        throw new SafeError('SUPER_ADMIN_PROTECTED', 'Son aktif Super Admin silinemez.', 409);
      }
      throw new SafeError('PROFILE_DELETE_FAILED', 'Kullanıcı profili silinemedi.', 400);
    }

    let authError: { code?: string; message?: string; status?: number } | null = null;
    try {
      const result = await admin.auth.admin.deleteUser(targetId);
      authError = result.error;
    } catch (error) {
      console.error('Auth kullanıcı silme isteği tamamlanamadı:', error);
      authError = { message: 'Auth delete request failed' };
    }
    if (authError && !isAuthUserNotFoundError(authError)) {
      console.error('Auth kullanıcısı silinemedi:', authError);
      const rolledBack = await rollbackProfile(admin, snapshot as SystemUserSnapshot);
      if (!rolledBack) {
        throw new SafeError(
          'CONSISTENCY_ERROR',
          'İşlem geri alınamadı; sistem yöneticisinin kontrolü gerekiyor.',
          500,
        );
      }
      throw new SafeError('AUTH_DELETE_FAILED', 'Kullanıcı hesabı silinemedi.', 500);
    }

    return jsonResponse({ success: true }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

async function parsePayload(req: Request): Promise<{ id: string; full_name: string }> {
  let value: unknown;
  try {
    value = await req.json();
  } catch (error) {
    console.error('Delete payload JSON olarak ayrıştırılamadı:', error);
    throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeError('VALIDATION_ERROR', 'Geçersiz istek gövdesi.', 400);
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(input, 'id') ||
    !Object.prototype.hasOwnProperty.call(input, 'full_name') ||
    !isUuid(input.id) ||
    typeof input.full_name !== 'string' ||
    !input.full_name
  ) {
    throw new SafeError('VALIDATION_ERROR', 'İstek gövdesi geçerli id ve tam full_name alanlarını içermelidir.', 400);
  }
  return { id: input.id, full_name: input.full_name };
}

function isSuperAdminProtectionError(error: { message?: string; details?: string } | null): boolean {
  return /SUPER_ADMIN_PROTECTED/.test(`${error?.message ?? ''} ${error?.details ?? ''}`);
}

function isAuthUserNotFoundError(error: { code?: string; message?: string; status?: number }): boolean {
  return error.status === 404 || error.code === 'user_not_found' || /user.*not.*found/i.test(error.message ?? '');
}

async function rollbackProfile(admin: any, snapshot: SystemUserSnapshot): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('system_users')
      .insert(snapshot)
      .select('id')
      .single();
    if (!error && data?.id === snapshot.id) return true;
    console.error('KRİTİK: Silinen kullanıcı profili rollback ile geri yüklenemedi:', {
      userId: snapshot.id,
      error,
    });
    return false;
  } catch (error) {
    console.error('KRİTİK: Kullanıcı profili rollback isteği tamamlanamadı:', { userId: snapshot.id, error });
    return false;
  }
}
