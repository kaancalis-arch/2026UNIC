
import { supabase } from './supabaseClient';
import { MOCK_TUITION_RANGES } from './mockData';

export interface BudgetRange {
    id: string;
    label: string;
    sort_order: number;
}

export const systemService = {
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
