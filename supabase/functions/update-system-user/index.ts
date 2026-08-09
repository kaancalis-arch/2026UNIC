import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, SafeError, successResponse } from '../_shared/safeErrors.ts';
import { assertNoUserDependencies } from '../_shared/userDependencies.ts';
import {
  isSystemUserRole,
  isSystemUserStatus,
  isUuid,
  validateBranch,
  validateDirectChildren,
  validateUserHierarchy,
} from '../_shared/userHierarchy.ts';

type UpdateSystemUserPayload = {
  id: string;
  full_name?: string;
  email?: string;
  role?: string;
  branch_id?: string | null;
  parent_user_id?: string | null;
  status?: string;
  avatar_url?: string | null;
};

const profileFields = [
  'full_name',
  'email',
  'role',
  'branch_id',
  'parent_user_id',
  'status',
  'avatar_url',
] as const;
const payloadFields = new Set(['id', ...profileFields]);

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

    const { data: snapshot, error: targetError } = await admin
      .from('system_users')
      .select('id, full_name, email, role, branch_id, parent_user_id, status, avatar_url')
      .eq('id', payload.id)
      .maybeSingle();
    if (targetError) {
      console.error('Hedef kullanıcı profili okunamadı:', targetError);
      throw new SafeError('INTERNAL_ERROR', 'Kullanıcı bilgileri okunamadı.', 500);
    }
    if (!snapshot) throw new SafeError('TARGET_NOT_FOUND', 'Kullanıcı bulunamadı.', 404);

    const isSelfUpdate = actor.id === snapshot.id;
    const isGlobalAdmin = actor.role === 'Super Admin' || actor.role === 'Admin';
    if (!isSelfUpdate && snapshot.parent_user_id !== actor.id) {
      throw new SafeError('FORBIDDEN', 'Yalnız doğrudan bağlı kullanıcılar yönetilebilir.', 403);
    }
    if (!isGlobalAdmin && (Object.keys(payload).length !== 2 || payload.status === undefined)) {
      throw new SafeError('FORBIDDEN', 'Bu rol yalnız doğrudan alt kullanıcıların durumunu değiştirebilir.', 403);
    }

    if (actor.role === 'Admin' && snapshot.role === 'Super Admin') {
      throw new SafeError('SUPER_ADMIN_PROTECTED', 'Admin kullanıcılar Super Admin hesaplarını değiştiremez.', 403);
    }
    if (actor.role === 'Admin' && payload.role === 'Super Admin') {
      throw new SafeError('SUPER_ADMIN_PROTECTED', 'Admin kullanıcılar kimseyi Super Admin yapamaz.', 403);
    }
    if (payload.role === 'Super Admin' && actor.role !== 'Super Admin') {
      throw new SafeError('FORBIDDEN', 'Yalnız Super Admin bu rolü atayabilir.', 403);
    }

    const updates: Record<string, unknown> = {};
    for (const field of profileFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== snapshot[field]) {
        updates[field] = payload[field];
      }
    }
    if (isSelfUpdate) {
      if (Object.keys(updates).length > 0) {
        throw new SafeError('SELF_UPDATE_RESTRICTED', 'Kendi kullanıcı kaydınızı değiştiremezsiniz.', 403);
      }
    }

    const merged = { ...snapshot, ...updates };
    if (!isSelfUpdate && merged.parent_user_id !== actor.id) {
      throw new SafeError('FORBIDDEN', 'Kullanıcı yalnız mevcut doğrudan yöneticisine bağlı kalabilir.', 403);
    }
    const statusChanged = merged.status !== snapshot.status;
    if (snapshot.status === 'active' && merged.status === 'passive') {
      await assertNoUserDependencies(admin, payload.id, { activeChildrenOnly: true });
    }
    await validateBranch(admin, merged.branch_id);
    await validateUserHierarchy(admin, merged);
    if (merged.role !== snapshot.role || merged.branch_id !== snapshot.branch_id || merged.status !== snapshot.status) {
      await validateDirectChildren(admin, merged);
    }

    if (Object.keys(updates).length === 0) return successResponse(snapshot, headers);

    const emailChanged = merged.email !== snapshot.email;
    const roleChanged = merged.role !== snapshot.role;
    let authSnapshot: {
      email?: string;
      app_metadata: Record<string, unknown>;
      profileStatus: string;
    } | null = null;

    if (emailChanged || roleChanged || statusChanged) {
      const { data: authData, error: authReadError } = await admin.auth.admin.getUserById(payload.id);
      if (authReadError || !authData.user) {
        console.error('Auth kullanıcı snapshot bilgisi okunamadı:', authReadError);
        throw new SafeError('CONSISTENCY_ERROR', 'Kullanıcının hesap bilgileri doğrulanamadı.', 500);
      }
      authSnapshot = {
        email: authData.user.email,
        app_metadata: { ...(authData.user.app_metadata ?? {}) },
        profileStatus: snapshot.status,
      };

      const authChanges: Record<string, unknown> = {};
      if (emailChanged) authChanges.email = merged.email;
      if (roleChanged) authChanges.app_metadata = { ...authSnapshot.app_metadata, role: merged.role };
      // Auth bans block refresh/new sessions, but do not instantly revoke an already issued access JWT.
      if (statusChanged) authChanges.ban_duration = merged.status === 'passive' ? '876000h' : 'none';
      const { error: authError } = await admin.auth.admin.updateUserById(payload.id, authChanges);
      if (authError) {
        console.error('Auth kullanıcısı güncellenemedi:', authError);
        if (isDuplicateEmailError(authError)) {
          throw new SafeError('EMAIL_ALREADY_EXISTS', 'Bu e-posta adresi zaten kayıtlı.', 409);
        }
        throw new SafeError('AUTH_UPDATE_FAILED', 'Kullanıcı hesap bilgileri güncellenemedi.', 400);
      }
    }

    let profile: unknown;
    let profileError: any;
    try {
      let profileQuery = admin
        .from('system_users')
        .update(updates)
        .eq('id', payload.id);
      if (!isSelfUpdate) profileQuery = profileQuery.eq('parent_user_id', actor.id);
      const result = await profileQuery
        .select('*')
        .maybeSingle();
      profile = result.data;
      profileError = result.error;
    } catch (error) {
      console.error('Sistem kullanıcı profili güncelleme isteği tamamlanamadı:', error);
      if (authSnapshot && !(await rollbackAuthUser(admin, payload.id, authSnapshot))) {
        throw new SafeError(
          'CONSISTENCY_ERROR',
          'İşlem geri alınamadı; sistem yöneticisinin kontrolü gerekiyor.',
          500,
        );
      }
      throw new SafeError('PROFILE_UPDATE_FAILED', 'Kullanıcı profili güncellenemedi.', 500);
    }

    if (profileError || !profile) {
      console.error('Sistem kullanıcı profili güncellenemedi:', profileError);
      if (authSnapshot) {
        const rolledBack = await rollbackAuthUser(admin, payload.id, authSnapshot);
        if (!rolledBack) {
          throw new SafeError(
            'CONSISTENCY_ERROR',
            'İşlem geri alınamadı; sistem yöneticisinin kontrolü gerekiyor.',
            500,
          );
        }
      }
      if (isSuperAdminProtectionError(profileError)) {
        throw new SafeError(
          'SUPER_ADMIN_PROTECTED',
          'Son aktif Super Admin pasif yapılamaz veya rolü değiştirilemez.',
          409,
        );
      }
      if (profileError?.code === '23505') {
        throw new SafeError('EMAIL_ALREADY_EXISTS', 'Bu e-posta adresi zaten kayıtlı.', 409);
      }
      if (!profile) {
        throw new SafeError('FORBIDDEN', 'Kullanıcı artık doğrudan hesabınıza bağlı değil.', 403);
      }
      throw new SafeError('PROFILE_UPDATE_FAILED', 'Kullanıcı profili güncellenemedi.', 400);
    }

    return successResponse(profile, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

async function parsePayload(req: Request): Promise<UpdateSystemUserPayload> {
  let value: unknown;
  try {
    value = await req.json();
  } catch (error) {
    console.error('Update payload JSON olarak ayrıştırılamadı:', error);
    throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeError('VALIDATION_ERROR', 'Geçersiz istek gövdesi.', 400);
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((field) => !payloadFields.has(field))) {
    throw new SafeError('VALIDATION_ERROR', 'İstek gövdesinde desteklenmeyen alan var.', 400);
  }
  if (!isUuid(input.id)) {
    throw new SafeError('VALIDATION_ERROR', 'Kullanıcı id geçerli bir UUID olmalıdır.', 400);
  }
  if (input.full_name !== undefined && (typeof input.full_name !== 'string' || !input.full_name.trim())) {
    throw new SafeError('VALIDATION_ERROR', 'Ad Soyad boş olamaz.', 400);
  }
  if (input.email !== undefined && (typeof input.email !== 'string' || !isEmail(input.email.trim()))) {
    throw new SafeError('VALIDATION_ERROR', 'Geçerli bir e-posta adresi girilmelidir.', 400);
  }
  if (input.role !== undefined && !isSystemUserRole(input.role)) {
    throw new SafeError('INVALID_ROLE', 'Geçersiz kullanıcı rolü.', 400);
  }
  if (input.status !== undefined && !isSystemUserStatus(input.status)) {
    throw new SafeError('VALIDATION_ERROR', 'Durum active veya passive olmalıdır.', 400);
  }
  validateNullableUuid(input.branch_id, 'Şube id');
  validateNullableUuid(input.parent_user_id, 'Üst kullanıcı id');
  if (input.avatar_url !== undefined && input.avatar_url !== null && typeof input.avatar_url !== 'string') {
    throw new SafeError('VALIDATION_ERROR', 'Avatar URL metin olmalıdır.', 400);
  }

  const payload: UpdateSystemUserPayload = { id: input.id };
  if (input.full_name !== undefined) payload.full_name = (input.full_name as string).trim();
  if (input.email !== undefined) payload.email = (input.email as string).trim().toLowerCase();
  if (input.role !== undefined) payload.role = input.role as string;
  if (input.status !== undefined) payload.status = input.status as string;
  if (Object.prototype.hasOwnProperty.call(input, 'branch_id')) payload.branch_id = input.branch_id as string | null;
  if (Object.prototype.hasOwnProperty.call(input, 'parent_user_id')) {
    payload.parent_user_id = input.parent_user_id as string | null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'avatar_url')) {
    payload.avatar_url = typeof input.avatar_url === 'string' ? input.avatar_url.trim() || null : null;
  }
  return payload;
}

function validateNullableUuid(value: unknown, label: string): void {
  if (value !== undefined && value !== null && !isUuid(value)) {
    throw new SafeError('VALIDATION_ERROR', `${label} geçerli bir UUID olmalıdır.`, 400);
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isDuplicateEmailError(error: { code?: string; message?: string; status?: number }): boolean {
  return error.code === 'email_exists' || error.code === 'user_already_exists' ||
    (error.status === 422 && /already|registered|exists/i.test(error.message ?? ''));
}

function isSuperAdminProtectionError(error: { message?: string; details?: string }): boolean {
  return /SUPER_ADMIN_PROTECTED/.test(`${error.message ?? ''} ${error.details ?? ''}`);
}

async function rollbackAuthUser(
  admin: any,
  userId: string,
  snapshot: { email?: string; app_metadata: Record<string, unknown>; profileStatus: string },
): Promise<boolean> {
  const rollback: Record<string, unknown> = {
    app_metadata: snapshot.app_metadata,
    ban_duration: snapshot.profileStatus === 'passive' ? '876000h' : 'none',
  };
  if (snapshot.email) rollback.email = snapshot.email;
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, rollback);
    if (!error) return true;
    console.error('KRİTİK: Auth kullanıcı güncellemesi rollback edilemedi:', { userId, error });
    return false;
  } catch (error) {
    console.error('KRİTİK: Auth kullanıcı rollback isteği tamamlanamadı:', { userId, error });
    return false;
  }
}
