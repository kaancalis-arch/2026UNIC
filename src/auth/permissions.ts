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

export const canAccessPage = (role: UserRole, page: string): boolean => {
  // This controls frontend UX only; Supabase RLS remains the security boundary.
  if (ADMIN_ONLY_PAGES.has(page)) {
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  }

  if (STUDENT_RESTRICTED_PAGES.has(page)) {
    return role !== UserRole.STUDENT;
  }

  return true;
};
