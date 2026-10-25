import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, SafeError, successResponse } from '../_shared/safeErrors.ts';
import { canBranchManagerCreateTarget } from '../_shared/systemUserManagement.ts';
import {
  isSystemUserRole,
  isSystemUserStatus,
  isUuid,
  validateBranch,
  validateHierarchyFields,
  validateUserHierarchy,
} from '../_shared/userHierarchy.ts';

type CreateSystemUserPayload = {
  full_name: string;
  email: string;
  phone: string | null;
  password: string;
  role: string;
  branch_id: string | null;
  parent_user_id: string | null;
  status: 'active' | 'passive';
  avatar_url: string | null;
  student_profile_id: string | null;
};

const payloadFields = new Set([
  'full_name',
  'email',
  'phone',
  'password',
  'role',
  'branch_id',
  'parent_user_id',
  'status',
  'avatar_url',
  'student_profile_id',
]);

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

    if (!['Super Admin', 'Admin', 'Şube Müdürü'].includes(actor.role)) {
      throw new SafeError('FORBIDDEN', 'Bu işlem için yetkiniz bulunmuyor.', 403);
    }
    if (actor.role === 'Admin' && payload.role === 'Super Admin') {
      throw new SafeError('FORBIDDEN', 'Admin kullanıcılar Super Admin oluşturamaz.', 403);
    }
    if (actor.role === 'Şube Müdürü') {
      await assertBranchManagerCanCreate(admin, actor, payload);
    } else {
      await assertGlobalActorCanCreate(admin, actor, payload);
    }

    await validateBranch(admin, payload.branch_id);
    await validateUserHierarchy(admin, hierarchyCandidate('', payload));
    await assertStudentProfileAvailable(admin, payload);

    const { data: existingProfile, error: existingError } = await admin
      .from('system_users')
      .select('id')
      .eq('email', payload.email)
      .maybeSingle();
    if (existingError) {
      console.error('E-posta profil kontrolü başarısız:', existingError);
      throw new SafeError('INTERNAL_ERROR', 'E-posta uygunluğu doğrulanamadı.', 500);
    }
    if (existingProfile) {
      throw new SafeError('EMAIL_ALREADY_EXISTS', 'Bu e-posta adresi zaten kayıtlı.', 409);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      app_metadata: { role: payload.role },
    });
    if (authError) {
      console.error('Auth kullanıcısı oluşturulamadı:', authError);
      if (isDuplicateEmailError(authError)) {
        throw new SafeError('EMAIL_ALREADY_EXISTS', 'Bu e-posta adresi zaten kayıtlı.', 409);
      }
      throw new SafeError('AUTH_CREATE_FAILED', 'Kullanıcı hesabı oluşturulamadı.', 400);
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      console.error('Auth createUser başarılı döndü ancak kullanıcı id dönmedi.');
      throw new SafeError('CONSISTENCY_ERROR', 'Kullanıcı hesabı doğrulanamadı.', 500);
    }

    try {
      // The real Auth id makes the final self/cycle check authoritative.
      if (actor.role === 'Şube Müdürü') {
        await assertBranchManagerCanCreate(admin, actor, payload);
      } else {
        await assertGlobalActorCanCreate(admin, actor, payload);
      }
      await validateUserHierarchy(admin, hierarchyCandidate(authUserId, payload));

      const { data: profile, error: profileError } = await admin
        .from('system_users')
        .insert({
          id: authUserId,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          role: payload.role,
          branch_id: payload.branch_id,
          parent_user_id: payload.parent_user_id,
          status: payload.status,
          avatar_url: payload.avatar_url,
        })
        .select('*')
        .single();

      if (profileError) {
        console.error('Sistem kullanıcı profili oluşturulamadı:', profileError);
        if (profileError.code === '23505') {
          throw new SafeError('EMAIL_ALREADY_EXISTS', 'Bu e-posta adresi zaten kayıtlı.', 409);
        }
        throw new SafeError('PROFILE_CREATE_FAILED', 'Kullanıcı profili oluşturulamadı.', 400);
      }

      if (payload.student_profile_id) {
        const { data: linked, error: linkError } = await admin.rpc('link_student_user', {
          p_student_id: payload.student_profile_id,
          p_student_user_id: authUserId,
        });
        if (linkError || linked !== true) {
          console.error('Öğrenci hesabı CRM profiline bağlanamadı:', linkError);
          throw new SafeError('PROFILE_CREATE_FAILED', 'Öğrenci hesabı CRM profiline bağlanamadı.', 409);
        }
      }

      return successResponse(profile, headers);
    } catch (error) {
      const rolledBack = await rollbackCreatedAuthUser(admin, authUserId);
      if (!rolledBack) {
        throw new SafeError(
          'CONSISTENCY_ERROR',
          'İşlem geri alınamadı; sistem yöneticisinin kontrolü gerekiyor.',
          500,
        );
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error, headers);
  }
});

async function parsePayload(req: Request): Promise<CreateSystemUserPayload> {
  let value: unknown;
  try {
    value = await req.json();
  } catch (error) {
    console.error('Create payload JSON olarak ayrıştırılamadı:', error);
    throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeError('VALIDATION_ERROR', 'Geçersiz istek gövdesi.', 400);
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((field) => !payloadFields.has(field))) {
    throw new SafeError('VALIDATION_ERROR', 'İstek gövdesinde desteklenmeyen alan var.', 400);
  }
  if (typeof input.full_name !== 'string' || !input.full_name.trim()) {
    throw new SafeError('VALIDATION_ERROR', 'Ad Soyad zorunludur.', 400);
  }
  if (typeof input.email !== 'string' || !isEmail(input.email.trim())) {
    throw new SafeError('VALIDATION_ERROR', 'Geçerli bir e-posta adresi zorunludur.', 400);
  }
  if (input.phone !== undefined && input.phone !== null && typeof input.phone !== 'string') {
    throw new SafeError('VALIDATION_ERROR', 'Telefon metin olmalıdır.', 400);
  }
  if (typeof input.phone === 'string' && input.phone.trim() && !/^05\d{9}$/.test(input.phone.trim())) {
    throw new SafeError('VALIDATION_ERROR', 'Telefon 05 ile başlamalı ve ardından 9 rakam içermelidir.', 400);
  }
  if (typeof input.password !== 'string' || input.password.length < 6) {
    throw new SafeError('VALIDATION_ERROR', 'Şifre en az 6 karakter olmalıdır.', 400);
  }
  if (!isSystemUserRole(input.role)) {
    throw new SafeError('INVALID_ROLE', 'Geçersiz kullanıcı rolü.', 400);
  }
  if (input.status !== undefined && !isSystemUserStatus(input.status)) {
    throw new SafeError('VALIDATION_ERROR', 'Durum active veya passive olmalıdır.', 400);
  }
  validateNullableUuid(input.branch_id, 'Şube id');
  validateNullableUuid(input.parent_user_id, 'Üst kullanıcı id');
  validateNullableUuid(input.student_profile_id, 'Öğrenci profil id');
  if (input.avatar_url !== undefined && input.avatar_url !== null && typeof input.avatar_url !== 'string') {
    throw new SafeError('VALIDATION_ERROR', 'Avatar URL metin olmalıdır.', 400);
  }

  const payload: CreateSystemUserPayload = {
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: typeof input.phone === 'string' ? input.phone.trim() || null : null,
    password: input.password,
    role: input.role,
    branch_id: (input.branch_id as string | null | undefined) ?? null,
    parent_user_id: (input.parent_user_id as string | null | undefined) ?? null,
    status: (input.status as 'active' | 'passive' | undefined) ?? 'active',
    avatar_url: typeof input.avatar_url === 'string' ? input.avatar_url.trim() || null : null,
    student_profile_id: (input.student_profile_id as string | null | undefined) ?? null,
  };
  if (payload.role === 'Öğrenci' && !payload.student_profile_id) {
    throw new SafeError('VALIDATION_ERROR', 'Öğrenci hesabı için CRM öğrenci profili seçilmelidir.', 400);
  }
  if (payload.role !== 'Öğrenci' && payload.student_profile_id) {
    throw new SafeError('VALIDATION_ERROR', 'CRM öğrenci profili yalnız Öğrenci rolüne bağlanabilir.', 400);
  }
  const hierarchyError = validateHierarchyFields(hierarchyCandidate('', payload));
  if (hierarchyError) throw new SafeError('INVALID_HIERARCHY', hierarchyError, 400);
  return payload;
}

function hierarchyCandidate(id: string, payload: CreateSystemUserPayload) {
  return {
    id,
    role: payload.role,
    status: payload.status,
    branch_id: payload.branch_id,
    parent_user_id: payload.parent_user_id,
  };
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

async function rollbackCreatedAuthUser(admin: any, userId: string): Promise<boolean> {
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('KRİTİK: Oluşturulan Auth kullanıcısı rollback ile silinemedi:', { userId, error });
      return false;
    }
    const { error: profileError } = await admin.from('system_users').delete().eq('id', userId);
    if (profileError) {
      console.error('KRİTİK: Auth rollback sonrası sistem kullanıcı profili temizlenemedi:', { userId, profileError });
      return false;
    }
    return true;
  } catch (error) {
    console.error('KRİTİK: Auth kullanıcı rollback isteği tamamlanamadı:', { userId, error });
    return false;
  }
}

async function assertGlobalActorCanCreate(
  admin: any,
  actor: { id: string; role: string },
  payload: CreateSystemUserPayload,
): Promise<void> {
  if (!['Super Admin', 'Admin'].includes(actor.role)) return;
  if (!payload.parent_user_id) {
    throw new SafeError('FORBIDDEN', 'Yeni kullanıcı mevcut yönetim hiyerarşinizde bir üst hesaba bağlanmalıdır.', 403);
  }

  const visited = new Set<string>();
  let currentId: string | null = payload.parent_user_id;
  while (currentId) {
    if (currentId === actor.id) return;
    if (visited.has(currentId) || visited.size >= 64) break;
    visited.add(currentId);
    const { data: current, error } = await admin
      .from('system_users')
      .select('id, parent_user_id, status')
      .eq('id', currentId)
      .maybeSingle();
    if (error) {
      console.error('Kullanıcı oluşturma hiyerarşisi doğrulanamadı:', error);
      throw new SafeError('INTERNAL_ERROR', 'Yönetim hiyerarşisi doğrulanamadı.', 500);
    }
    if (!current || current.status !== 'active') break;
    currentId = current.parent_user_id;
  }
  throw new SafeError('FORBIDDEN', 'Yalnızca kendi aktif kullanıcı hiyerarşiniz altında hesap oluşturabilirsiniz.', 403);
}

async function assertStudentProfileAvailable(admin: any, payload: CreateSystemUserPayload): Promise<void> {
  if (!payload.student_profile_id) return;
  const { data: student, error } = await admin
    .from('student_profiles')
    .select('id, branch_id, counselor_id, student_user_id')
    .eq('id', payload.student_profile_id)
    .maybeSingle();
  if (error) {
    console.error('CRM öğrenci profili doğrulanamadı:', error);
    throw new SafeError('INTERNAL_ERROR', 'CRM öğrenci profili doğrulanamadı.', 500);
  }
  if (!student) throw new SafeError('TARGET_NOT_FOUND', 'CRM öğrenci profili bulunamadı.', 404);
  if (student.student_user_id) throw new SafeError('CONFLICT', 'CRM öğrenci profili zaten bir hesaba bağlı.', 409);
  if (!payload.branch_id || student.branch_id !== payload.branch_id) {
    throw new SafeError('INVALID_BRANCH', 'Öğrenci hesabı ve CRM profili aynı şubede olmalıdır.', 400);
  }
  if (!payload.parent_user_id || student.counselor_id !== payload.parent_user_id) {
    throw new SafeError('INVALID_HIERARCHY', 'Öğrenci hesabı CRM profilinin sorumlu kullanıcısına bağlanmalıdır.', 400);
  }
}

async function assertBranchManagerCanCreate(
  admin: any,
  actor: { id: string; role: string; branch_id: string | null },
  payload: CreateSystemUserPayload,
): Promise<void> {
  let selectedParent = null;
  if (payload.role === 'Temsilci' && payload.parent_user_id !== actor.id) {
    const { data: parent, error: parentError } = await admin
      .from('system_users')
      .select('id, role, branch_id, parent_user_id, status')
      .eq('id', payload.parent_user_id)
      .maybeSingle();
    if (parentError) {
      console.error('Temsilci üst yöneticisi doğrulanamadı:', parentError);
      throw new SafeError('INTERNAL_ERROR', 'Üst yönetici bilgisi doğrulanamadı.', 500);
    }
    selectedParent = parent;
  }
  if (!canBranchManagerCreateTarget(actor, hierarchyCandidate('', payload), selectedParent)) {
    throw new SafeError(
      'FORBIDDEN',
      'Şube Müdürü yalnızca kendi aktif şubesinde izin verilen Danışman veya Temsilciyi oluşturabilir.',
      403,
    );
  }
}
