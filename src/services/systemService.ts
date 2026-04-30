
import { supabase } from './supabaseClient';
import { MOCK_BRANCHES, MOCK_TUITION_RANGES } from './mockData';
import { Branch, SystemUser, UserRole } from '../types';

export interface BudgetRange {
    id: string;
    label: string;
    sort_order: number;
}

type SystemUserPayload = Omit<SystemUser, 'id' | 'created_at' | 'updated_at'>;

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

export const systemService = {
  async getSystemUsers(): Promise<SystemUser[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching system_users:', error);
      return [];
    }

    return (data || []).map(mapSystemUser);
  },

  async addSystemUser(user: SystemUserPayload): Promise<SystemUser> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { data, error } = await supabase
      .from('system_users')
      .insert([{
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id || null,
        parent_user_id: user.parent_user_id || null,
        status: user.status,
        avatar_url: user.avatarUrl || null
      }])
      .select('*')
      .single();

    if (error) {
      if (error.message?.includes('Failed to send a request')) {
        throw new Error('create-system-user Edge Function deploy edilmemiş veya erişilemiyor. Supabase Functions deploy ve SUPABASE_SERVICE_ROLE_KEY secret ayarını kontrol edin.');
      }
      throw error;
    }
    return mapSystemUser(data);
  },

  async addSystemUserWithAuth(user: SystemUserPayload, password: string): Promise<SystemUser> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { data, error } = await supabase.functions.invoke('create-system-user', {
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

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.user) throw new Error('Kullanıcı oluşturuldu ancak profil bilgisi dönmedi.');

    return mapSystemUser(data.user);
  },

  async updateSystemUser(id: string, user: Partial<SystemUserPayload>): Promise<SystemUser> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { data, error } = await supabase
      .from('system_users')
      .update({
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id || null,
        parent_user_id: user.parent_user_id || null,
        status: user.status,
        avatar_url: user.avatarUrl || null
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapSystemUser(data);
  },

  async updateSystemUserStatus(id: string, status: 'active' | 'passive'): Promise<void> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { error } = await supabase
      .from('system_users')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteSystemUser(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not initialized');

    const { error } = await supabase
      .from('system_users')
      .delete()
      .eq('id', id);

    if (error) throw error;
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
