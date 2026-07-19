import { SafeError } from './safeErrors.ts';

export const SYSTEM_USER_ROLES = [
  'Super Admin',
  'Admin',
  'Şube Müdürü',
  'Danışman',
  'Temsilci',
  'Öğrenci Temsilci',
  'Öğrenci',
] as const;

export const SYSTEM_USER_STATUSES = ['active', 'passive'] as const;

export type SystemUserRole = (typeof SYSTEM_USER_ROLES)[number];
export type SystemUserStatus = (typeof SYSTEM_USER_STATUSES)[number];

export type HierarchyUser = {
  id: string;
  role: string;
  status: string;
  branch_id: string | null;
  parent_user_id: string | null;
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parentRoles: Record<SystemUserRole, readonly SystemUserRole[]> = {
  'Super Admin': [],
  Admin: ['Super Admin'],
  'Şube Müdürü': ['Admin'],
  Danışman: ['Şube Müdürü'],
  Temsilci: ['Şube Müdürü', 'Danışman'],
  'Öğrenci Temsilci': ['Danışman'],
  Öğrenci: ['Danışman', 'Temsilci', 'Öğrenci Temsilci'],
};

const branchRequiredRoles: readonly SystemUserRole[] = [
  'Şube Müdürü',
  'Danışman',
  'Temsilci',
  'Öğrenci Temsilci',
  'Öğrenci',
];

const sameBranchRoles: readonly SystemUserRole[] = [
  'Danışman',
  'Temsilci',
  'Öğrenci Temsilci',
  'Öğrenci',
];

export function isSystemUserRole(value: unknown): value is SystemUserRole {
  return typeof value === 'string' && SYSTEM_USER_ROLES.includes(value as SystemUserRole);
}

export function isSystemUserStatus(value: unknown): value is SystemUserStatus {
  return typeof value === 'string' && SYSTEM_USER_STATUSES.includes(value as SystemUserStatus);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export async function validateBranch(admin: SupabaseLikeClient, branchId: string | null): Promise<void> {
  if (!branchId) return;

  let result = await admin.from('branches').select('id, status').eq('id', branchId).maybeSingle();
  if (result.error && isMissingStatusColumn(result.error)) {
    result = await admin.from('branches').select('id').eq('id', branchId).maybeSingle();
  }

  if (result.error) {
    console.error('Şube doğrulama sorgusu başarısız:', result.error);
    throw new SafeError('INTERNAL_ERROR', 'Şube bilgisi doğrulanamadı.', 500);
  }
  if (!result.data) throw new SafeError('INVALID_BRANCH', 'Seçilen şube bulunamadı.', 400);
  if ('status' in result.data && result.data.status !== 'active') {
    throw new SafeError('INVALID_BRANCH', 'Seçilen şube aktif olmalıdır.', 400);
  }
}

export function validateHierarchyFields(user: HierarchyUser): string | null {
  if (!isSystemUserRole(user.role)) return 'Geçersiz kullanıcı rolü.';
  if (!isSystemUserStatus(user.status)) return 'Durum active veya passive olmalıdır.';

  if (branchRequiredRoles.includes(user.role) && !user.branch_id) {
    return `${user.role} rolü için şube zorunludur.`;
  }

  if (user.role === 'Super Admin') {
    if (user.parent_user_id) return 'Super Admin için üst kullanıcı seçilemez.';
  } else if (!user.parent_user_id) {
    return `${user.role} rolü için üst kullanıcı zorunludur.`;
  }

  if (user.parent_user_id && user.parent_user_id === user.id) {
    return 'Kullanıcı kendisinin üst kullanıcısı olamaz.';
  }

  return null;
}

export async function validateUserHierarchy(
  admin: SupabaseLikeClient,
  candidate: HierarchyUser,
  overrides: HierarchyUser[] = [],
): Promise<void> {
  const fieldError = validateHierarchyFields(candidate);
  if (fieldError) throw new SafeError('INVALID_HIERARCHY', fieldError, 400);

  const { data, error } = await admin
    .from('system_users')
    .select('id, role, status, branch_id, parent_user_id');

  if (error) {
    console.error('Kullanıcı hiyerarşisi okunamadı:', error);
    throw new SafeError('INTERNAL_ERROR', 'Kullanıcı hiyerarşisi doğrulanamadı.', 500);
  }

  const users = [...(data ?? [])];
  const usersById = new Map(users.map((user) => [user.id, user]));
  for (const user of overrides) usersById.set(user.id, user);
  usersById.set(candidate.id, candidate);

  if (!candidate.parent_user_id) return;

  const parent = usersById.get(candidate.parent_user_id);
  if (!parent) throw new SafeError('INVALID_HIERARCHY', 'Seçilen üst kullanıcı bulunamadı.', 400);
  if (parent.status !== 'active') {
    throw new SafeError('INVALID_HIERARCHY', 'Üst kullanıcı aktif olmalıdır.', 400);
  }

  const role = candidate.role as SystemUserRole;
  if (!parentRoles[role].includes(parent.role as SystemUserRole)) {
    throw new SafeError(
      'INVALID_HIERARCHY',
      `${candidate.role} rolü için seçilen üst kullanıcı rolü geçersizdir.`,
      400,
    );
  }

  const hasDifferentBranches = candidate.branch_id && parent.branch_id
    && candidate.branch_id !== parent.branch_id;
  if (hasDifferentBranches || (sameBranchRoles.includes(role) && candidate.branch_id !== parent.branch_id)) {
    throw new SafeError('INVALID_HIERARCHY', 'Kullanıcı ile üst kullanıcı aynı şubede olmalıdır.', 400);
  }

  const visited = new Set<string>([candidate.id]);
  let ancestor: HierarchyUser | undefined = parent;
  while (ancestor) {
    if (visited.has(ancestor.id)) {
      throw new SafeError('INVALID_HIERARCHY', 'Kullanıcı hiyerarşisinde döngü oluşturulamaz.', 400);
    }
    visited.add(ancestor.id);
    ancestor = ancestor.parent_user_id ? usersById.get(ancestor.parent_user_id) : undefined;
  }
}

export async function validateDirectChildren(
  admin: SupabaseLikeClient,
  mergedParent: HierarchyUser,
): Promise<void> {
  const { data, error } = await admin
    .from('system_users')
    .select('id, role, status, branch_id, parent_user_id')
    .eq('parent_user_id', mergedParent.id);

  if (error) {
    console.error('Doğrudan alt kullanıcılar okunamadı:', error);
    throw new SafeError('INTERNAL_ERROR', 'Alt kullanıcı hiyerarşisi doğrulanamadı.', 500);
  }

  for (const child of data ?? []) {
    await validateUserHierarchy(admin, child, [mergedParent]);
  }
}

function isMissingStatusColumn(error: { code?: string; message?: string }): boolean {
  const missingColumnCode = error.code === '42703' || error.code === 'PGRST204';
  return missingColumnCode && /status/i.test(error.message ?? '');
}
