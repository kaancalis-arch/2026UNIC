
import { supabase } from './supabaseClient';
import { MOCK_TUITION_RANGES } from './mockData';

export const systemService = {
  async getTuitionRanges(): Promise<string[]> {
    if (!supabase) return MOCK_TUITION_RANGES;

    try {
      // Fetching from 'tuition_list' table, column 'range'
      const { data, error } = await supabase
        .from('budget_ranges')
        .select('label')
        .order('sort_order', { ascending: true }); 

      if (error) {
        console.warn('Supabase fetch tuition ranges failed. Using mock data.', error.message);
        return MOCK_TUITION_RANGES;
      }

      if (!data || data.length === 0) return MOCK_TUITION_RANGES;

      return data.map((item: any) => item.label);
    } catch (err) {
      console.warn('Unexpected error in systemService.getTuitionRanges. Using mock data.', err);
      return MOCK_TUITION_RANGES;
    }
  }
};
