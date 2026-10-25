import { SystemUser, UserRole } from '../types';

export const ROLE_PERMISSION_GROUPS = [
  { id: 'dashboard', label: 'Dashboard', pages: [{ id: 'dashboard', label: 'Dashboard' }] },
  { id: 'students', label: 'CRM Öğrenci Takip', pages: [{ id: 'students', label: 'CRM Öğrenci Takip' }] },
  { id: 'universities', label: 'Üniversite Araştırması', pages: [{ id: 'universities', label: 'Üniversite Araştırması' }] },
  { id: 'calendar', label: 'Takvim', pages: [{ id: 'calendar', label: 'Takvim' }] },
  { id: 'roadmap', label: 'Yol Haritası', pages: [{ id: 'roadmap', label: 'Yol Haritası' }] },
  {
    id: 'visa',
    label: 'Vize',
    pages: [
      { id: 'visa-results', label: 'Sonuçlar' },
      { id: 'visa-checklist', label: 'Kontrol Listesi' },
      { id: 'visa-control', label: 'Vize Kontrol Formu' },
    ],
  },
  {
    id: 'system',
    label: 'Sistem',
    pages: [
      { id: 'student-assignments', label: 'Öğrenci Atamaları' },
      { id: 'university-research', label: 'Üniversite Araştırma' },
      { id: 'user-management', label: 'Kullanıcı Yönetimi' },
    ],
  },
  {
    id: 'student',
    label: 'Öğrenci Alanı',
    pages: [
      { id: 'my-profile', label: 'Profilim' },
      { id: 'my-roadmap', label: 'Yol Haritam' },
      { id: 'files', label: 'Dosyalarım' },
    ],
  },
] as const;

export type RolePermissionPageId = (typeof ROLE_PERMISSION_GROUPS)[number]['pages'][number]['id'];

export const ROLE_PERMISSION_PAGE_IDS = ROLE_PERMISSION_GROUPS.flatMap(group =>
  group.pages.map(page => page.id)
) as RolePermissionPageId[];

const ADMIN_ONLY_PAGES = new Set<string>([
  'department-keyword-rules',
  'university-detail',
]);

const SETTINGS_ROLES = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
]);

const STAFF_PAGES = new Set<string>([
  'dashboard',
  'students',
  'student-detail',
  'statistics',
  'universities',
  'university-research',
  'calendar',
  'roadmap',
  'visa',
  'visa-results',
  'visa-checklist',
  'visa-control',
]);

const STUDENT_PAGES = new Set<string>(['my-profile', 'my-roadmap', 'files']);

const LIMITED_USER_MANAGEMENT_ROLES = new Set([
  UserRole.CONSULTANT,
  UserRole.REPRESENTATIVE,
  UserRole.STUDENT_REPRESENTATIVE,
]);

const STUDENT_ASSIGNMENT_ROLES = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
]);

const resolvePermissionPage = (page: string): string => {
  if (page === 'student-detail') return 'students';
  return page;
};

export const canRoleAccessPage = (role: UserRole, page: string): boolean => {
  // This controls frontend UX only; Supabase RLS remains the security boundary.
  let roleAllowsPage = false;
  if (page === 'settings') {
    roleAllowsPage = SETTINGS_ROLES.has(role);
  } else if (ADMIN_ONLY_PAGES.has(page)) {
    roleAllowsPage = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  } else if (page === 'user-management') {
    roleAllowsPage = LIMITED_USER_MANAGEMENT_ROLES.has(role);
  } else if (page === 'student-assignments') {
    roleAllowsPage = STUDENT_ASSIGNMENT_ROLES.has(role);
  } else if (STAFF_PAGES.has(page)) {
    roleAllowsPage = role !== UserRole.STUDENT;
  } else if (STUDENT_PAGES.has(page)) {
    roleAllowsPage = role === UserRole.STUDENT;
  }

  return roleAllowsPage;
};

export const canAccessPage = (user: SystemUser | UserRole, page: string): boolean => {
  const role = typeof user === 'string' ? user : user.role;
  const roleAllowsPage = canRoleAccessPage(role, page);
  if (!roleAllowsPage || typeof user === 'string' || user.page_permissions == null) return roleAllowsPage;

  const permissionPage = resolvePermissionPage(page);
  if (!ROLE_PERMISSION_PAGE_IDS.includes(permissionPage as RolePermissionPageId)) return roleAllowsPage;
  return user.page_permissions.includes(permissionPage);
};

export const getDefaultPage = (user: SystemUser): string => {
  if (user.role === UserRole.STUDENT) return 'my-profile';
  return ROLE_PERMISSION_PAGE_IDS.find(page => canAccessPage(user, page)) || 'dashboard';
};
