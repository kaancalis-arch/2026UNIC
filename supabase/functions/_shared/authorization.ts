import { SafeError } from './safeErrors.ts';

export type AuthorizedActor = {
  id: string;
  full_name: string;
  email: string;
  role: 'Super Admin' | 'Admin';
  branch_id: string | null;
  status: string;
};

export const CANONICAL_USER_ROLES = [
  'Super Admin',
  'Admin',
  'Şube Müdürü',
  'Danışman',
  'Temsilci',
  'Öğrenci Temsilci',
  'Öğrenci',
] as const;

export type UserRole = (typeof CANONICAL_USER_ROLES)[number];

export type AuthenticatedActor = {
  id: string;
  role: UserRole;
  branch_id: string | null;
  status: 'active';
};

type AdminClient = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  from: (table: string) => any;
};

export async function authorizeActor(admin: AdminClient, req: Request): Promise<AuthorizedActor> {
  const authorization = req.headers.get('Authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    throw new SafeError(
      'UNAUTHORIZED',
      'Authorization başlığı tam olarak Bearer <token> biçiminde olmalıdır.',
      401,
    );
  }

  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) {
    throw new SafeError('INVALID_TOKEN', 'Oturum bilgisi geçersiz veya süresi dolmuş.', 401);
  }

  const { data: profile, error: profileError } = await admin
    .from('system_users')
    .select('id, full_name, email, role, branch_id, status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Actor profili okunamadı:', profileError);
    throw new SafeError('INTERNAL_ERROR', 'Yetki bilgileri doğrulanamadı.', 500);
  }
  if (!profile) {
    throw new SafeError('FORBIDDEN', 'Bu hesap için yönetim yetkisi bulunmuyor.', 403);
  }
  if (profile.status !== 'active') {
    throw new SafeError('ACTOR_INACTIVE', 'Pasif kullanıcılar bu işlemi yapamaz.', 403);
  }
  if (profile.role !== 'Super Admin' && profile.role !== 'Admin') {
    throw new SafeError('FORBIDDEN', 'Bu işlem için yetkiniz bulunmuyor.', 403);
  }

  return profile as AuthorizedActor;
}

export async function authorizeAuthenticatedActor(
  admin: AdminClient,
  req: Request,
): Promise<AuthenticatedActor> {
  const authorization = req.headers.get('Authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    throw new SafeError(
      'UNAUTHORIZED',
      'Authorization başlığı tam olarak Bearer <token> biçiminde olmalıdır.',
      401,
    );
  }

  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) {
    throw new SafeError('INVALID_TOKEN', 'Oturum bilgisi geçersiz veya süresi dolmuş.', 401);
  }

  const { data: profile, error: profileError } = await admin
    .from('system_users')
    .select('id, role, branch_id, status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Actor yetki profili okunamadı:', profileError);
    throw new SafeError('INTERNAL_ERROR', 'Yetki bilgileri doğrulanamadı.', 500);
  }
  if (!profile) throw new SafeError('FORBIDDEN', 'Bu hesap için erişim profili bulunmuyor.', 403);
  if (profile.status !== 'active') {
    throw new SafeError('ACTOR_INACTIVE', 'Pasif kullanıcılar bu işlemi yapamaz.', 403);
  }
  if (!CANONICAL_USER_ROLES.includes(profile.role as UserRole)) {
    throw new SafeError('FORBIDDEN', 'Kullanıcı rolü geçerli değil.', 403);
  }

  const role = profile.role as UserRole;
  const branchRequired = !['Super Admin', 'Admin'].includes(role);
  if (branchRequired && !profile.branch_id) {
    throw new SafeError('FORBIDDEN', 'Bu kullanıcı rolü için aktif bir şube zorunludur.', 403);
  }

  if (profile.branch_id) {
    const { data: branch, error: branchError } = await admin
      .from('branches')
      .select('id, status')
      .eq('id', profile.branch_id)
      .maybeSingle();
    if (branchError) {
      console.error('Actor şubesi doğrulanamadı:', branchError);
      throw new SafeError('INTERNAL_ERROR', 'Şube bilgisi doğrulanamadı.', 500);
    }
    if (!branch || branch.status !== 'active') {
      throw new SafeError('FORBIDDEN', 'Kullanıcının şubesi bulunamadı veya aktif değil.', 403);
    }
  }

  return {
    id: profile.id,
    role,
    branch_id: profile.branch_id,
    status: 'active',
  };
}
