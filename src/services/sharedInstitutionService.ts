
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
          phone: row.phone,
          email: row.email,
          notes: row.notes,
          authorizedPerson: row.authorized_person,
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
        phone: institution.phone,
        email: institution.email,
        notes: institution.notes,
        authorized_person: institution.authorizedPerson,
        description: institution.description,
        contact_name: institution.contactName,
        contact_info: institution.contactInfo
    };

    // If ID is local, generate a proper UUID
    const isLocal = institution.id.startsWith('shint-');
    const finalId = isLocal ? crypto.randomUUID() : institution.id;
    
    const { data, error } = await supabase
      .from('shared_institutions')
      .upsert({ ...dbPayload, id: finalId })
      .select()
      .single();

    if (error) throw error;
    
    return {
          id: data.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          notes: data.notes,
          authorizedPerson: data.authorized_person,
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
