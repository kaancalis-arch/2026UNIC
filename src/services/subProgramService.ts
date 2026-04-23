
import { supabase } from './supabaseClient';
import { SubProgramData } from '../types';

export const subProgramService = {
  async getAll(): Promise<SubProgramData[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('sub_programs')
        .select(`
          *,
          interested_programs!inner ( name )
        `)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('sub_programs table might not exist yet:', error.message);
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        parentProgramId: row.parent_program_id,
        parentProgramName: row.interested_programs?.name || '',
        description: row.description || '',
        sortOrder: row.sort_order || 0
      }));
    } catch (err) {
      console.error('Failed to load sub_programs:', err);
      return [];
    }
  },

  async getByParentId(parentProgramId: string): Promise<SubProgramData[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('sub_programs')
        .select('*')
        .eq('parent_program_id', parentProgramId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('Failed to load sub_programs by parent:', error.message);
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        parentProgramId: row.parent_program_id,
        description: row.description || '',
        sortOrder: row.sort_order || 0
      }));
    } catch (err) {
      console.error('Failed to load sub_programs by parent:', err);
      return [];
    }
  },

  async upsert(subProgram: SubProgramData): Promise<SubProgramData> {
    if (!supabase) return subProgram;

    const dbPayload: any = {
      name: subProgram.name,
      parent_program_id: subProgram.parentProgramId,
      description: subProgram.description || null,
      sort_order: subProgram.sortOrder || 0
    };

    const isLocal = subProgram.id.startsWith('subp-');

    const { data, error } = await supabase
      .from('sub_programs')
      .upsert(isLocal ? dbPayload : { ...dbPayload, id: subProgram.id })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      parentProgramId: data.parent_program_id,
      description: data.description || '',
      sortOrder: data.sort_order || 0
    };
  },

  async delete(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('sub_programs').delete().eq('id', id);
    if (error) throw error;
  }
};
