import { SafeError, type SafeErrorCode } from './safeErrors.ts';

export type ManagementActor = {
  id: string;
  role: string;
  branch_id: string | null;
};

export type ManagementTarget = {
  id?: string;
  role: string;
  branch_id: string | null;
  parent_user_id: string | null;
  status?: string;
};

export function canManageDirectTarget(actor: ManagementActor, target: ManagementTarget): boolean {
  if (target.id === actor.id || target.parent_user_id !== actor.id) return false;
  if (actor.role === 'Super Admin' || actor.role === 'Admin') return true;
  if (!['Şube Müdürü', 'Danışman', 'Temsilci', 'Öğrenci Temsilci'].includes(actor.role)) return false;
  return !!actor.branch_id && target.branch_id === actor.branch_id;
}

export function canUpdateTargetFields(actorRole: string, fields: string[]): boolean {
  if (actorRole === 'Super Admin' || actorRole === 'Admin') return true;
  if (actorRole === 'Şube Müdürü') {
    return fields.every((field) => !['role', 'branch_id', 'parent_user_id'].includes(field));
  }
  return fields.length === 1 && fields[0] === 'status';
}

export function assertNotSelfTarget(actorId: string, targetId: string, code: SafeErrorCode): void {
  if (actorId === targetId) throw new SafeError(code, 'Kendi hesabınızda bu işlemi yapamazsınız.', 403);
}

export function canBranchManagerCreateTarget(
  actor: ManagementActor,
  target: ManagementTarget,
  parent: ManagementTarget | null,
): boolean {
  if (actor.role !== 'Şube Müdürü' || !actor.branch_id || target.branch_id !== actor.branch_id) return false;
  if (target.role === 'Danışman') return target.parent_user_id === actor.id;
  if (target.role !== 'Temsilci') return false;
  if (target.parent_user_id === actor.id) return true;
  return !!parent
    && parent.id === target.parent_user_id
    && parent.role === 'Danışman'
    && parent.status === 'active'
    && parent.branch_id === actor.branch_id
    && parent.parent_user_id === actor.id;
}
