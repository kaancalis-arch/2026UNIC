import { SystemUser, UserRole } from '../types';

export type HierarchyUser = Pick<SystemUser, 'id' | 'role' | 'branch_id' | 'parent_user_id' | 'status'>;

export type HierarchyValidationResult = {
  valid: boolean;
  error?: string;
};

const HIERARCHY_RULES: Record<UserRole, {
  parentRoles: UserRole[];
  requiresBranch: boolean;
  requiresSameBranch: boolean;
}> = {
  [UserRole.SUPER_ADMIN]: { parentRoles: [], requiresBranch: false, requiresSameBranch: false },
  [UserRole.ADMIN]: { parentRoles: [UserRole.SUPER_ADMIN], requiresBranch: false, requiresSameBranch: false },
  [UserRole.BRANCH_MANAGER]: { parentRoles: [UserRole.ADMIN], requiresBranch: true, requiresSameBranch: false },
  [UserRole.CONSULTANT]: { parentRoles: [UserRole.BRANCH_MANAGER], requiresBranch: true, requiresSameBranch: true },
  [UserRole.REPRESENTATIVE]: { parentRoles: [UserRole.BRANCH_MANAGER, UserRole.CONSULTANT], requiresBranch: true, requiresSameBranch: true },
  [UserRole.STUDENT_REPRESENTATIVE]: { parentRoles: [UserRole.CONSULTANT], requiresBranch: true, requiresSameBranch: true },
  [UserRole.STUDENT]: {
    parentRoles: [UserRole.CONSULTANT, UserRole.REPRESENTATIVE, UserRole.STUDENT_REPRESENTATIVE],
    requiresBranch: true,
    requiresSameBranch: true
  }
};

export function getAllowedParentRoles(role?: UserRole): UserRole[] {
  return role ? [...HIERARCHY_RULES[role].parentRoles] : [];
}

export function canAssignParent(childRole: UserRole, parentRole: UserRole): boolean {
  return HIERARCHY_RULES[childRole].parentRoles.includes(parentRole);
}

export function roleRequiresBranch(role?: UserRole): boolean {
  return role ? HIERARCHY_RULES[role].requiresBranch : false;
}

export function roleRequiresSameBranch(role?: UserRole): boolean {
  return role ? HIERARCHY_RULES[role].requiresSameBranch : false;
}

export function wouldCreateHierarchyCycle(
  userId: string | undefined,
  parentUserId: string | undefined,
  users: HierarchyUser[] = []
): boolean {
  if (!userId || !parentUserId) return false;
  if (userId === parentUserId) return true;

  const usersById = new Map(users.map(user => [user.id, user]));
  const visited = new Set<string>();
  let currentId: string | undefined = parentUserId;

  while (currentId && !visited.has(currentId)) {
    if (currentId === userId) return true;
    visited.add(currentId);
    currentId = usersById.get(currentId)?.parent_user_id || undefined;
  }

  return false;
}

export function validateUserHierarchy(
  childUser: HierarchyUser,
  parentUser?: HierarchyUser | null,
  users: HierarchyUser[] = []
): HierarchyValidationResult {
  const allowedParentRoles = getAllowedParentRoles(childUser.role);

  if (roleRequiresBranch(childUser.role) && !childUser.branch_id) {
    return { valid: false, error: 'Seçilen rol için şube zorunludur.' };
  }

  if (allowedParentRoles.length === 0) {
    return childUser.parent_user_id
      ? { valid: false, error: 'Super Admin için üst kullanıcı seçilemez.' }
      : { valid: true };
  }

  if (!childUser.parent_user_id || !parentUser) {
    return { valid: false, error: 'Seçilen rol için bağlı olduğu kullanıcı zorunludur.' };
  }

  if (childUser.id === parentUser.id) {
    return { valid: false, error: 'Bir kullanıcı kendisine bağlanamaz.' };
  }

  if (!canAssignParent(childUser.role, parentUser.role)) {
    return { valid: false, error: 'Seçilen üst kullanıcının rolü bu kullanıcı rolü için uygun değildir.' };
  }

  if (parentUser.status !== 'active') {
    return { valid: false, error: 'Pasif bir kullanıcı üst kullanıcı olarak seçilemez.' };
  }

  const hasDifferentBranches = childUser.branch_id && parentUser.branch_id
    && childUser.branch_id !== parentUser.branch_id;
  if (hasDifferentBranches || (roleRequiresSameBranch(childUser.role) && childUser.branch_id !== parentUser.branch_id)) {
    return { valid: false, error: 'Alt kullanıcı ile üst kullanıcı aynı şubede olmalıdır.' };
  }

  if (wouldCreateHierarchyCycle(childUser.id, parentUser.id, users)) {
    return { valid: false, error: 'Bu seçim kullanıcı hiyerarşisinde döngü oluşturur.' };
  }

  return { valid: true };
}
