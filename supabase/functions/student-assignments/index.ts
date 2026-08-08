import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';
import {
  assertAssignScope,
  assertAssignmentRole,
  type AssignPayload,
  parseStudentAssignmentPayload,
  type OptionsPayload,
} from './validation.ts';

const ASSIGNABLE_ROLES = ['Danışman', 'Temsilci', 'Öğrenci Temsilci'];

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
    assertAssignmentRole(actor.role, actor.branch_id);
    const payload = await parsePayload(req);

    if (payload.action === 'options') {
      const options = await loadOptions(admin, actor, payload);
      return jsonResponse({ success: true, ...options }, 200, headers);
    }

    const result = await assignStudents(admin, actor, payload);
    return jsonResponse({ success: true, changed_count: result.changedCount }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

async function parsePayload(req: Request) {
  let value: unknown;
  try {
    value = await req.json();
  } catch (error) {
    console.error('Öğrenci atama payload bilgisi ayrıştırılamadı:', error);
    throw new SafeError('INVALID_JSON', 'Geçerli bir JSON istek gövdesi gönderilmelidir.', 400);
  }
  return parseStudentAssignmentPayload(value);
}

async function loadOptions(admin: any, actor: { role: string; branch_id: string | null }, payload: OptionsPayload) {
  let branchQuery = admin
    .from('branches')
    .select('id, name')
    .eq('status', 'active')
    .order('name');
  if (actor.role === 'Şube Müdürü') branchQuery = branchQuery.eq('id', actor.branch_id);

  const { data: branches, error: branchError } = await branchQuery;
  if (branchError) {
    console.error('Öğrenci atama şube seçenekleri okunamadı:', branchError);
    throw new SafeError('INTERNAL_ERROR', 'Atama seçenekleri yüklenemedi.', 500);
  }

  const branchIds = (branches ?? []).map((branch: { id: string }) => branch.id);
  const selectedBranchId = payload.branch_id ?? null;
  if (selectedBranchId && !branchIds.includes(selectedBranchId)) {
    throw new SafeError('FORBIDDEN', 'Bu şube için atama yetkiniz bulunmuyor.', 403);
  }

  const visibleBranchIds = selectedBranchId ? [selectedBranchId] : branchIds;
  let users: unknown[] = [];
  if (visibleBranchIds.length > 0) {
    const { data, error } = await admin
      .from('system_users')
      .select('id, full_name, role, branch_id')
      .eq('status', 'active')
      .in('role', ASSIGNABLE_ROLES)
      .in('branch_id', visibleBranchIds)
      .order('full_name');
    if (error) {
      console.error('Öğrenci atama kullanıcı seçenekleri okunamadı:', error);
      throw new SafeError('INTERNAL_ERROR', 'Atama seçenekleri yüklenemedi.', 500);
    }
    users = data ?? [];
  }

  return { branches: branches ?? [], users };
}

async function assignStudents(
  admin: any,
  actor: { id: string; role: string; branch_id: string | null },
  payload: AssignPayload,
): Promise<{ changedCount: number }> {
  assertAssignScope(actor.role, payload);

  const { data: students, error: studentError } = await admin
    .from('student_profiles')
    .select('id, branch_id, counselor_id')
    .in('id', payload.student_ids);
  if (studentError) {
    console.error('Atanacak öğrenciler doğrulanamadı:', studentError);
    throw new SafeError('INTERNAL_ERROR', 'Öğrenci ataması doğrulanamadı.', 500);
  }
  if ((students?.length ?? 0) !== payload.student_ids.length) {
    throw new SafeError('STUDENT_NOT_FOUND', 'Atanacak öğrencilerden biri bulunamadı.', 404);
  }
  if (actor.role === 'Şube Müdürü' && students.some((student: any) => student.branch_id !== actor.branch_id)) {
    throw new SafeError('FORBIDDEN', 'Yalnız kendi şubenizdeki öğrencileri yönetebilirsiniz.', 403);
  }

  if (payload.branchSupplied && payload.branch_id) {
    const { data: branch, error } = await admin
      .from('branches')
      .select('id')
      .eq('id', payload.branch_id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) {
      console.error('Hedef şube doğrulanamadı:', error);
      throw new SafeError('INTERNAL_ERROR', 'Öğrenci ataması doğrulanamadı.', 500);
    }
    if (!branch) throw new SafeError('INVALID_BRANCH', 'Yalnız aktif bir şube seçilebilir.', 400);
  }

  if (payload.assignedUserSupplied && payload.assigned_user_id) {
    const { data: assignedUser, error } = await admin
      .from('system_users')
      .select('id, role, status, branch_id')
      .eq('id', payload.assigned_user_id)
      .maybeSingle();
    if (error) {
      console.error('Hedef sorumlu kullanıcı doğrulanamadı:', error);
      throw new SafeError('INTERNAL_ERROR', 'Öğrenci ataması doğrulanamadı.', 500);
    }
    if (!assignedUser || assignedUser.status !== 'active' || !ASSIGNABLE_ROLES.includes(assignedUser.role)) {
      throw new SafeError('VALIDATION_ERROR', 'Yalnız aktif ve uygun role sahip bir sorumlu seçilebilir.', 400);
    }
    const effectiveBranchId = payload.branchSupplied ? payload.branch_id : assignedUser.branch_id;
    if (!effectiveBranchId || assignedUser.branch_id !== effectiveBranchId ||
      (!payload.branchSupplied && students.some((student: any) => student.branch_id !== assignedUser.branch_id))) {
      throw new SafeError('INVALID_HIERARCHY', 'Öğrenci ve sorumlu kullanıcı aynı aktif şubede olmalıdır.', 400);
    }
    const { data: activeBranch, error: activeBranchError } = await admin
      .from('branches')
      .select('id')
      .eq('id', assignedUser.branch_id)
      .eq('status', 'active')
      .maybeSingle();
    if (activeBranchError) {
      console.error('Sorumlu kullanıcı şubesi doğrulanamadı:', activeBranchError);
      throw new SafeError('INTERNAL_ERROR', 'Öğrenci ataması doğrulanamadı.', 500);
    }
    if (!activeBranch) throw new SafeError('INVALID_BRANCH', 'Sorumlu kullanıcının şubesi aktif değil.', 400);
  }

  const { data, error } = await admin.rpc('apply_student_assignments', {
    p_actor_user_id: actor.id,
    p_student_ids: payload.student_ids,
    p_branch_supplied: payload.branchSupplied,
    p_branch_id: payload.branch_id,
    p_assigned_user_supplied: payload.assignedUserSupplied,
    p_assigned_user_id: payload.assigned_user_id,
  });
  if (error) throw mapRpcError(error);

  const changedCount = Array.isArray(data) ? data[0]?.changed_count : data?.changed_count;
  if (!Number.isInteger(changedCount) || changedCount < 0 || changedCount > payload.student_ids.length) {
    console.error('Öğrenci atama RPC yanıtı geçersiz:', data);
    throw new SafeError('INTERNAL_ERROR', 'Öğrenci ataması tamamlanamadı.', 500);
  }
  return { changedCount };
}

function mapRpcError(error: { code?: string; message?: string; details?: string }): SafeError {
  const detail = `${error.message ?? ''} ${error.details ?? ''}`;
  console.error('Öğrenci atama RPC işlemi başarısız:', error);
  if (error.code === '40P01' || error.code === '40001') {
    return new SafeError('CONFLICT', 'Atama başka bir işlemle çakıştı. Listeyi yenileyip tekrar deneyin.', 409);
  }
  if (/ASSIGNMENT_FORBIDDEN/.test(detail)) {
    return new SafeError('FORBIDDEN', 'Bu öğrenciler için atama yetkiniz bulunmuyor.', 403);
  }
  if (/ASSIGNMENT_STUDENT_NOT_FOUND/.test(detail)) {
    return new SafeError('STUDENT_NOT_FOUND', 'Atanacak öğrencilerden biri bulunamadı.', 404);
  }
  if (/ASSIGNMENT_INVALID_BRANCH/.test(detail)) {
    return new SafeError('INVALID_BRANCH', 'Yalnız aktif bir şube seçilebilir.', 400);
  }
  if (/ASSIGNMENT_INVALID_ASSIGNEE|ASSIGNMENT_BRANCH_MISMATCH/.test(detail)) {
    return new SafeError('INVALID_HIERARCHY', 'Öğrenci ve sorumlu kullanıcı aynı aktif şubede olmalıdır.', 400);
  }
  if (/ASSIGNMENT_INVALID_PAYLOAD/.test(detail)) {
    return new SafeError('VALIDATION_ERROR', 'Atama isteği geçersiz.', 400);
  }
  return new SafeError('INTERNAL_ERROR', 'Öğrenci ataması tamamlanamadı.', 500);
}
