import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { roleRequiresBranch } from '../auth/userHierarchy';
import { SystemUser, UserRole } from '../types';
import { supabase } from './supabaseClient';

export type AuthServiceErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'PASSIVE_ACCOUNT'
  | 'PROFILE_NOT_FOUND'
  | 'INVALID_PROFILE'
  | 'BRANCH_NOT_FOUND'
  | 'PASSIVE_BRANCH'
  | 'AUTH_ERROR';

const ERROR_MESSAGES: Record<AuthServiceErrorCode, string> = {
  INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
  PASSIVE_ACCOUNT: 'Hesabınız pasif durumdadır. Sistem yöneticinizle iletişime geçin.',
  PROFILE_NOT_FOUND: 'Kullanıcı profiliniz bulunamadı. Sistem yöneticinizle iletişime geçin.',
  INVALID_PROFILE: 'Kullanıcı profiliniz geçersiz. Yöneticinizle iletişime geçin.',
  BRANCH_NOT_FOUND: 'Kullanıcı profilinize bağlı şube bulunamadı.',
  PASSIVE_BRANCH: 'Bağlı olduğunuz şube pasif durumda.',
  AUTH_ERROR: 'Kimlik doğrulama işlemi tamamlanamadı. Lütfen tekrar deneyin.'
};

export class AuthServiceError extends Error {
  readonly code: AuthServiceErrorCode;

  constructor(code: AuthServiceErrorCode, options?: ErrorOptions) {
    super(ERROR_MESSAGES[code], options);
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

export interface SignInResult {
  session: Session;
  authUser: User;
  currentUser: SystemUser;
}

const ALLOWED_ROLES = new Set<string>(Object.values(UserRole));

function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && ALLOWED_ROLES.has(role);
}

function mapSystemUser(profile: Record<string, unknown>): SystemUser {
  return {
    id: profile.id as string,
    full_name: typeof profile.full_name === 'string' ? profile.full_name : '',
    email: typeof profile.email === 'string' ? profile.email : '',
    phone: typeof profile.phone === 'string' ? profile.phone : '',
    role: profile.role as UserRole,
    branch_id: typeof profile.branch_id === 'string' ? profile.branch_id : '',
    parent_user_id: typeof profile.parent_user_id === 'string' ? profile.parent_user_id : undefined,
    status: 'active',
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined,
    created_at: typeof profile.created_at === 'string' ? profile.created_at : '',
    updated_at: typeof profile.updated_at === 'string' ? profile.updated_at : ''
  };
}

function asAuthServiceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  console.error('Supabase auth işlemi başarısız oldu.', error);
  return new AuthServiceError('AUTH_ERROR', { cause: error });
}

export async function loadSystemUser(authUserId: string): Promise<SystemUser> {
  try {
    const { data: profile, error } = await supabase
      .from('system_users')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) throw new AuthServiceError('PROFILE_NOT_FOUND');
    if (profile.status !== 'active') throw new AuthServiceError('PASSIVE_ACCOUNT');
    if (!isUserRole(profile.role)) throw new AuthServiceError('INVALID_PROFILE');

    const branchId = typeof profile.branch_id === 'string' ? profile.branch_id.trim() : '';
    if (roleRequiresBranch(profile.role) && !branchId) {
      throw new AuthServiceError('INVALID_PROFILE');
    }

    if (branchId) {
      let { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id,status')
        .eq('id', branchId)
        .maybeSingle();

      if (branchError && isMissingStatusColumn(branchError)) {
        const fallback = await supabase.from('branches').select('id').eq('id', branchId).maybeSingle();
        branch = fallback.data ? { ...fallback.data, status: undefined } : null;
        branchError = fallback.error;
      }

      if (branchError) throw branchError;
      if (!branch) throw new AuthServiceError('BRANCH_NOT_FOUND');
      if (branch.status !== undefined && branch.status !== 'active') throw new AuthServiceError('PASSIVE_BRANCH');
    }

    return mapSystemUser({ ...profile, branch_id: branchId });
  } catch (error) {
    throw asAuthServiceError(error);
  }
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error || !data.session || !data.user) {
    if (error) console.error('Supabase giriş işlemi reddedildi.', error);
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  try {
    const currentUser = await loadSystemUser(data.user.id);
    return { session: data.session, authUser: data.user, currentUser };
  } catch (error) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error('Geçersiz profil oturumu kapatılamadı.', signOutError);
    throw asAuthServiceError(error);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw asAuthServiceError(error);
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw asAuthServiceError(error);
  return data.session;
}

export async function getAuthenticatedUser(): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw asAuthServiceError(error);
  return data.user;
}

export async function getCurrentSystemUser(): Promise<SystemUser> {
  const authUser = await getAuthenticatedUser();
  return loadSystemUser(authUser.id);
}

export async function resetPassword(email: string): Promise<void> {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim().replace(/\/$/, '');
  const appUrl = configuredUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  if (!appUrl) throw new AuthServiceError('AUTH_ERROR');

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${appUrl}/reset-password`
  });
  if (error) throw asAuthServiceError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw asAuthServiceError(error);
}

export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback).data.subscription;
}

function isMissingStatusColumn(error: { code?: string; message?: string }): boolean {
  return (error.code === '42703' || error.code === 'PGRST204') && /status/i.test(error.message ?? '');
}

export const authService = {
  signIn,
  signOut,
  getSession,
  getAuthenticatedUser,
  getCurrentSystemUser,
  loadSystemUser,
  resetPassword,
  updatePassword,
  subscribeToAuthChanges
};
