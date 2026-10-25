import { ROLE_PERMISSION_PAGE_IDS, RolePermissionPageId } from '../auth/permissions';
import { UserRole } from '../types';
import { supabase } from './supabaseClient';

type PermissionRow = {
  role: UserRole;
  page_id: string;
  can_view: boolean;
};

export const permissionService = {
  async getRolePermissions(roles: UserRole[]): Promise<Record<string, RolePermissionPageId[] | null>> {
    const result: Record<string, RolePermissionPageId[] | null> = Object.fromEntries(roles.map(role => [role, null]));
    if (roles.length === 0) return result;

    const { data, error } = await supabase
      .from('role_page_permissions')
      .select('role,page_id,can_view')
      .in('role', roles);
    if (error) throw new Error('Rol yetkileri yüklenemedi. Lütfen tekrar deneyin.');

    const rowsByRole = new Map<UserRole, PermissionRow[]>();
    for (const row of (data || []) as PermissionRow[]) {
      rowsByRole.set(row.role, [...(rowsByRole.get(row.role) || []), row]);
    }
    for (const [role, rows] of rowsByRole) {
      result[role] = rows
        .filter(row => row.can_view && ROLE_PERMISSION_PAGE_IDS.includes(row.page_id as RolePermissionPageId))
        .map(row => row.page_id as RolePermissionPageId);
    }
    return result;
  },

  async getCurrentRolePermissions(role: UserRole): Promise<RolePermissionPageId[] | null> {
    const result = await this.getRolePermissions([role]);
    return result[role] ?? null;
  },

  async saveRolePermissions(role: UserRole, allowedPages: RolePermissionPageId[]): Promise<void> {
    const allowed = new Set(allowedPages);
    const { error } = await supabase
      .from('role_page_permissions')
      .upsert(
        ROLE_PERMISSION_PAGE_IDS.map(pageId => ({
          role,
          page_id: pageId,
          can_view: allowed.has(pageId),
        })),
        { onConflict: 'role,page_id' }
      );
    if (error) throw new Error('Yetki değişiklikleri kaydedilemedi. Lütfen tekrar deneyin.');
  },
};
