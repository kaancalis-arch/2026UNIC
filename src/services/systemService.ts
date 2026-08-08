
import { supabase } from './supabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { MOCK_BRANCHES, MOCK_TUITION_RANGES } from './mockData';
import { Branch, SystemUser, UserRole } from '../types';
import { validateUserHierarchy } from '../auth/userHierarchy';

export interface BudgetRange {
    id: string;
    label: string;
    sort_order: number;
}

type SystemUserPayload = Omit<SystemUser, 'id' | 'created_at' | 'updated_at'>;

const SESSION_EXPIRED_MESSAGE = 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.';
const EDGE_FALLBACK_MESSAGE = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';

const EDGE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: SESSION_EXPIRED_MESSAGE,
  INVALID_TOKEN: SESSION_EXPIRED_MESSAGE,
  ACTOR_INACTIVE: 'Hesabınız aktif olmadığı için bu işlemi yapamazsınız.',
  FORBIDDEN: 'Bu işlem için yetkiniz bulunmuyor.',
  INVALID_ROLE: 'Geçersiz kullanıcı rolü seçildi.',
  INVALID_HIERARCHY: 'Kullanıcı hiyerarşisi geçersiz.',
  INVALID_BRANCH: 'Geçersiz şube seçildi.',
  TARGET_NOT_FOUND: 'İşlem yapılacak kullanıcı bulunamadı.',
  SUPER_ADMIN_PROTECTED: 'Süper yönetici hesabı bu işlemden korunmaktadır.',
  SELF_UPDATE_RESTRICTED: 'Kendi hesabınızda bu değişikliği yapamazsınız.',
  SELF_DELETE_RESTRICTED: 'Kendi hesabınızı kalıcı olarak silemezsiniz.',
  EMAIL_ALREADY_EXISTS: 'Bu e-posta adresi zaten kullanılıyor.',
  DEPENDENT_RECORDS: 'Bu kullanıcıya bağlı kayıtlar var. Önce alt kullanıcı ve öğrenci sorumluluklarını devredin.',
  AUTH_DELETE_FAILED: 'Kullanıcının giriş hesabı silinemedi. Lütfen tekrar deneyin.',
  PROFILE_DELETE_FAILED: 'Kullanıcı profili silinemedi. Lütfen tekrar deneyin.',
  CONSISTENCY_ERROR: 'İşlem sırasında veri tutarlılığı sağlanamadı. Lütfen sistem yöneticisine başvurun.',
  INTERNAL_ERROR: 'İşlem sırasında bir sunucu hatası oluştu. Lütfen tekrar deneyin.'
};

interface EdgeErrorBody {
  success: false;
  code: string;
  error: string;
}

interface EdgeSuccessBody {
  success: true;
  user: unknown;
}

const isEdgeErrorBody = (value: unknown): value is EdgeErrorBody => {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return body.success === false && typeof body.code === 'string' && typeof body.error === 'string';
};

const isEdgeSuccessBody = (value: unknown): value is EdgeSuccessBody => {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return body.success === true && !!body.user && typeof body.user === 'object';
};

const isEdgeDeleteSuccessBody = (value: unknown): value is { success: true } => {
  if (!value || typeof value !== 'object') return false;
  return (value as Record<string, unknown>).success === true;
};

const edgeErrorMessage = (code?: string): string =>
  (code && EDGE_ERROR_MESSAGES[code]) || EDGE_FALLBACK_MESSAGE;

async function throwSafeEdgeError(error: unknown, data?: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    let body: unknown;
    try {
      body = await error.context.clone().json();
    } catch {}
    if (isEdgeErrorBody(body)) throw new Error(edgeErrorMessage(body.code));
  }

  if (isEdgeErrorBody(data)) throw new Error(edgeErrorMessage(data.code));
  throw new Error(EDGE_FALLBACK_MESSAGE);
}

async function requireAccessToken(): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    const isExpired = session?.expires_at !== undefined && session.expires_at * 1000 <= Date.now();
    if (error || !session?.access_token || isExpired) throw new Error(SESSION_EXPIRED_MESSAGE);
    return session.access_token;
  } catch {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
}

const mapSystemUser = (user: any): SystemUser => ({
  id: user.id,
  full_name: user.full_name || '',
  email: user.email || '',
  phone: user.phone || '',
  role: user.role as UserRole,
  branch_id: user.branch_id || '',
  parent_user_id: user.parent_user_id || '',
  status: user.status || 'active',
  avatarUrl: user.avatar_url || '',
  created_at: user.created_at || '',
  updated_at: user.updated_at || ''
});

async function validateHierarchyWrite(id: string | undefined, user: Partial<SystemUserPayload>): Promise<void> {
  if (!supabase) throw new Error('Supabase is not initialized');

  const { data: rows, error } = await supabase.from('system_users').select('*');
  if (error) throw new Error(EDGE_FALLBACK_MESSAGE);

  const users = (rows || []).map(mapSystemUser);
  const currentUser = id ? users.find(candidate => candidate.id === id) : undefined;
  const childUser: SystemUser = {
    id: id || '',
    full_name: user.full_name ?? currentUser?.full_name ?? '',
    email: user.email ?? currentUser?.email ?? '',
    phone: user.phone ?? currentUser?.phone ?? '',
    role: user.role ?? currentUser?.role ?? UserRole.CONSULTANT,
    branch_id: user.branch_id ?? currentUser?.branch_id ?? '',
    parent_user_id: user.parent_user_id ?? currentUser?.parent_user_id ?? '',
    status: user.status ?? currentUser?.status ?? 'active',
    avatarUrl: user.avatarUrl ?? currentUser?.avatarUrl,
    created_at: currentUser?.created_at ?? '',
    updated_at: currentUser?.updated_at ?? ''
  };
  const parentUser = users.find(candidate => candidate.id === childUser.parent_user_id);
  const validation = validateUserHierarchy(childUser, parentUser, users);
  if (!validation.valid) throw new Error(validation.error);
}

export const systemService = {
  async getSystemUsers(): Promise<SystemUser[]> {
    if (!supabase) throw new Error(EDGE_FALLBACK_MESSAGE);

    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching system_users:', error);
      throw new Error('Kullanıcılar yüklenemedi. Lütfen tekrar deneyin.');
    }

    return (data || []).map(mapSystemUser);
  },

  async getDirectReports(parentUserId: string): Promise<SystemUser[]> {
    if (!supabase) throw new Error(EDGE_FALLBACK_MESSAGE);

    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .eq('parent_user_id', parentUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching direct reports:', error);
      throw new Error('Bağlı kullanıcılar yüklenemedi. Lütfen tekrar deneyin.');
    }

    return (data || [])
      .map(mapSystemUser)
      .filter(user => user.parent_user_id === parentUserId);
  },

  async addSystemUserWithAuth(user: SystemUserPayload, password: string): Promise<SystemUser> {
    if (!supabase) throw new Error('Supabase is not initialized');
    await validateHierarchyWrite(undefined, user);
    const accessToken = await requireAccessToken();

    const { data, error } = await supabase.functions.invoke('create-system-user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        full_name: user.full_name,
        email: user.email,
        password,
        role: user.role,
        branch_id: user.branch_id || null,
        parent_user_id: user.parent_user_id || null,
        status: user.status,
        avatar_url: user.avatarUrl || null
      }
    });

    if (error) await throwSafeEdgeError(error, data);
    if (isEdgeErrorBody(data)) await throwSafeEdgeError(undefined, data);
    if (!isEdgeSuccessBody(data)) throw new Error(EDGE_FALLBACK_MESSAGE);

    return mapSystemUser(data.user);
  },

  async updateSystemUser(id: string, user: Partial<SystemUserPayload>): Promise<SystemUser> {
    if (!supabase) throw new Error('Supabase is not initialized');
    await validateHierarchyWrite(id, user);
    const accessToken = await requireAccessToken();

    const body: Record<string, unknown> = { id };
    const addDefinedField = (sourceKey: keyof SystemUserPayload, targetKey: string = sourceKey): void => {
      if (!Object.prototype.hasOwnProperty.call(user, sourceKey) || user[sourceKey] === undefined) return;
      const value = user[sourceKey];
      body[targetKey] = ['branch_id', 'parent_user_id', 'avatarUrl'].includes(sourceKey) && value === ''
        ? null
        : value;
    };
    addDefinedField('full_name');
    addDefinedField('email');
    addDefinedField('role');
    addDefinedField('branch_id');
    addDefinedField('parent_user_id');
    addDefinedField('status');
    addDefinedField('avatarUrl', 'avatar_url');

    const { data, error } = await supabase.functions.invoke('update-system-user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body
    });

    if (error) await throwSafeEdgeError(error, data);
    if (isEdgeErrorBody(data)) await throwSafeEdgeError(undefined, data);
    if (!isEdgeSuccessBody(data)) throw new Error(EDGE_FALLBACK_MESSAGE);
    return mapSystemUser(data.user);
  },

  async updateSystemUserStatus(id: string, status: 'active' | 'passive'): Promise<void> {
    if (!supabase) throw new Error('Supabase is not initialized');
    const accessToken = await requireAccessToken();

    const { data, error } = await supabase.functions.invoke('update-system-user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { id, status }
    });

    if (error) await throwSafeEdgeError(error, data);
    if (isEdgeErrorBody(data)) await throwSafeEdgeError(undefined, data);
    if (!isEdgeSuccessBody(data)) throw new Error(EDGE_FALLBACK_MESSAGE);
  },

  async deactivateSystemUser(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not initialized');
    const accessToken = await requireAccessToken();

    const { data, error } = await supabase.functions.invoke('update-system-user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { id, status: 'passive' }
    });

    if (error) await throwSafeEdgeError(error, data);
    if (isEdgeErrorBody(data)) await throwSafeEdgeError(undefined, data);
    if (!isEdgeSuccessBody(data)) throw new Error(EDGE_FALLBACK_MESSAGE);
  },

  async permanentlyDeleteSystemUser(id: string, fullName: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not initialized');
    const accessToken = await requireAccessToken();

    const { data, error } = await supabase.functions.invoke('delete-system-user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { id, full_name: fullName }
    });

    if (error) await throwSafeEdgeError(error, data);
    if (isEdgeErrorBody(data)) await throwSafeEdgeError(undefined, data);
    if (!isEdgeDeleteSuccessBody(data)) throw new Error(EDGE_FALLBACK_MESSAGE);
  },

  async getBranches(): Promise<Branch[]> {
    if (!supabase) return MOCK_BRANCHES;

    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching branches. Using mock data.', error);
      return MOCK_BRANCHES;
    }

    return (data || []).map(branch => ({
      id: branch.id,
      name: branch.name || '',
      country: branch.country || 'Türkiye',
      city: branch.city || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      status: branch.status || 'active',
      manager_id: branch.manager_id || '',
      created_at: branch.created_at || '',
      updated_at: branch.updated_at || ''
    }));
  },

  async addBranch(branch: Omit<Branch, 'id' | 'created_at' | 'updated_at'>): Promise<Branch> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { data, error } = await supabase
      .from('branches')
      .insert([{ ...branch, manager_id: branch.manager_id || null }])
      .select('*')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name || '',
      country: data.country || 'Türkiye',
      city: data.city || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      status: data.status || 'active',
      manager_id: data.manager_id || '',
      created_at: data.created_at || '',
      updated_at: data.updated_at || ''
    };
  },

  async updateBranchStatus(id: string, status: 'active' | 'passive'): Promise<void> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { error } = await supabase
      .from('branches')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  },

  async getTuitionRanges(): Promise<string[]> {
    if (!supabase) return MOCK_TUITION_RANGES;

    try {
      const ranges = await this.getBudgetRangesRaw();
      if (!ranges || ranges.length === 0) return MOCK_TUITION_RANGES;
      return ranges.map(r => r.label);
    } catch (err) {
      console.warn('Unexpected error in systemService.getTuitionRanges. Using mock data.', err);
      return MOCK_TUITION_RANGES;
    }
  },

  async getBudgetRangesRaw(): Promise<BudgetRange[]> {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('budget_ranges')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) {
          console.warn('Error fetching budget_ranges:', error);
          return [];
      }
      return data || [];
  },

  async addBudgetRange(label: string, sort_order: number): Promise<BudgetRange> {
      if (!supabase) throw new Error("Supabase is not initialized");
      const { data, error } = await supabase
        .from('budget_ranges')
        .insert([{ label, sort_order }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
  },

  async updateBudgetRange(id: string, label: string): Promise<void> {
      if (!supabase) throw new Error("Supabase is not initialized");
      const { error } = await supabase
        .from('budget_ranges')
        .update({ label })
        .eq('id', id);
        
      if (error) throw error;
  },

  async deleteBudgetRange(id: string): Promise<void> {
      if (!supabase) throw new Error("Supabase is not initialized");
      const { error } = await supabase
        .from('budget_ranges')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
  }
};
