
import { supabase } from './supabaseClient';
import { SharedInstitutionData } from '../types';

export const sharedInstitutionService = {
  async getAll(): Promise<SharedInstitutionData[]> {
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
          .from('shared_institutions')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
            console.warn('shared_institutions table might not exist yet.');
            return [];
        }
        
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          contactName: row.contact_name,
          contactInfo: row.contact_info
        }));
    } catch (err) {
        return [];
    }
  },

  async upsert(institution: SharedInstitutionData): Promise<SharedInstitutionData> {
    if (!supabase) return institution;

    const dbPayload = {
        name: institution.name,
        description: institution.description,
        contact_name: institution.contactName,
        contact_info: institution.contactInfo
    };

    // If ID is local, don't send it to let DB generate one
    const isLocal = institution.id.startsWith('shint-');
    
    const { data, error } = await supabase
      .from('shared_institutions')
      .upsert(isLocal ? dbPayload : { ...dbPayload, id: institution.id })
      .select()
      .single();

    if (error) throw error;
    
    return {
          id: data.id,
          name: data.name,
          description: data.description,
          contactName: data.contact_name,
          contactInfo: data.contact_info
    };
  },
  
  async delete(id: string): Promise<void> {
      if (!supabase) return;
      const { error } = await supabase.from('shared_institutions').delete().eq('id', id);
      if (error) throw error;
  }
};
