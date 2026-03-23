
import { supabase } from './supabaseClient';
import { MainCategoryData } from '../types';

export const mainCategoryService = {
  async getAll(): Promise<MainCategoryData[]> {
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
          .from('main_categories')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) throw error;
        
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description
        }));
    } catch (err) {
        console.error('mainCategoryService.getAll failed', err);
        return [];
    }
  },

  async upsert(cat: MainCategoryData): Promise<MainCategoryData> {
    if (!supabase) return cat;

    const dbPayload = {
        name: cat.name,
        description: cat.description
    } as any;

    if (!cat.id.startsWith('cat-')) {
        dbPayload.id = cat.id;
    }

    const { data, error } = await supabase
      .from('main_categories')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    
    return {
          id: data.id,
          name: data.name,
          description: data.description
    };
  },
  
  async delete(id: string): Promise<void> {
      if (!supabase) return;
      const { error } = await supabase.from('main_categories').delete().eq('id', id);
      if (error) throw error;
  },

  // Junction management
  async getJunctions(): Promise<Array<{program_id: string, category_id: string}>> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('program_category_junction').select('*');
    if (error) throw error;
    return data;
  },

  async updateAssignments(programId: string, categoryIds: string[]): Promise<void> {
    if (!supabase) return;
    
    // 1. Delete old
    const { error: delError } = await supabase.from('program_category_junction').delete().eq('program_id', programId);
    if (delError) throw delError;

    if (categoryIds.length === 0) return;

    // 2. Insert new
    const payload = categoryIds.map(catId => ({
        program_id: programId,
        category_id: catId
    }));

    const { error: insError } = await supabase.from('program_category_junction').insert(payload);
    if (insError) throw insError;
  }
};
