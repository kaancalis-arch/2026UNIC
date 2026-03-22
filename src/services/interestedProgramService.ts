
import { supabase } from './supabaseClient';
import { InterestedProgramData } from '../types';

export const interestedProgramService = {
  async getAll(): Promise<InterestedProgramData[]> {
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
          .from('interested_programs')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
            console.warn('interested_programs table might not exist yet.');
            return [];
        }
        
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description
        }));
    } catch (err) {
        return [];
    }
  },

  async upsert(program: InterestedProgramData): Promise<InterestedProgramData> {
    if (!supabase) return program;

    const dbPayload = {
        name: program.name,
        description: program.description
    };

    // If ID is local, don't send it to let DB generate one
    const isLocal = program.id.startsWith('intp-');
    
    const { data, error } = await supabase
      .from('interested_programs')
      .upsert(isLocal ? dbPayload : { ...dbPayload, id: program.id })
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
      const { error } = await supabase.from('interested_programs').delete().eq('id', id);
      if (error) throw error;
  }
};
