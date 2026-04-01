
import { supabase } from './supabaseClient';

export interface UniversityType {
  id: string;
  name: string;
  description: string;
  link: string;
}

export const universityTypeService = {
  async getAll(): Promise<UniversityType[]> {
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .from('university_types')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) {
        console.warn('Supabase fetch university_types failed:', error.message);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.warn('Error in universityTypeService.getAll:', err);
      return [];
    }
  },

  async upsert(type: UniversityType): Promise<UniversityType> {
    if (!supabase) return type;

    const { data, error } = await supabase
      .from('university_types')
      .upsert(type)
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert university_types failed:', error);
      throw new Error(error.message);
    }
    
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('university_types').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error in universityTypeService.delete:', err);
      throw err;
    }
  }
};
