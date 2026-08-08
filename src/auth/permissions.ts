import { UserRole } from '../types';

const ADMIN_ONLY_PAGES = new Set([
  'settings',
  'department-keyword-rules',
  'university-detail',
]);

const STUDENT_RESTRICTED_PAGES = new Set([
  'students',
  'student-detail',
]);

const LIMITED_USER_MANAGEMENT_ROLES = new Set([
  UserRole.BRANCH_MANAGER,
  UserRole.CONSULTANT,
  UserRole.REPRESENTATIVE,
  UserRole.STUDENT_REPRESENTATIVE,
]);

const STUDENT_ASSIGNMENT_ROLES = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
]);

export const canAccessPage = (role: UserRole, page: string): boolean => {
  // This controls frontend UX only; Supabase RLS remains the security boundary.
  if (ADMIN_ONLY_PAGES.has(page)) {
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  }

  if (page === 'user-management') {
    return LIMITED_USER_MANAGEMENT_ROLES.has(role);
  }

  if (page === 'student-assignments') {
    return STUDENT_ASSIGNMENT_ROLES.has(role);
  }

  if (STUDENT_RESTRICTED_PAGES.has(page)) {
    return role !== UserRole.STUDENT;
  }

  return true;
};
