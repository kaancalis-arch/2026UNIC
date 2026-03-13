
import { supabase } from './supabaseClient';
import { UniversityData } from '../types';
import { MOCK_UNIVERSITIES } from './mockData';

export const universityService = {
  async getAll(): Promise<UniversityData[]> {
    if (!supabase) return MOCK_UNIVERSITIES;
    
    try {
        const { data, error } = await supabase
          .from('universities')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
          console.warn('Supabase fetch universities failed. Using mock data.', error.message);
          return MOCK_UNIVERSITIES; 
        }
        
        if (!data || data.length === 0) return MOCK_UNIVERSITIES;

        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          logo: row.logo,
          country: row.country,
          city: row.city,
          websiteUrl: row.website_url,
          departmentsUrl: row.departments_url,
          tuitionRange: row.tuition_range
        }));
    } catch (err) {
        console.warn('Unexpected error in universityService.getAll. Using mock data.', err);
        return MOCK_UNIVERSITIES;
    }
  },

  async upsert(university: UniversityData): Promise<UniversityData> {
    if (!supabase) return university;

    const dbPayload = {
        id: university.id,
        name: university.name,
        logo: university.logo,
        country: university.country,
        city: university.city,
        website_url: university.websiteUrl,
        departments_url: university.departmentsUrl,
        tuition_range: university.tuitionRange
    };

    const { data, error } = await supabase
      .from('universities')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        logo: data.logo,
        country: data.country,
        city: data.city,
        websiteUrl: data.website_url,
        departmentsUrl: data.departments_url,
        tuitionRange: data.tuition_range
    };
  },
  
  async delete(id: string): Promise<void> {
      if (!supabase) return;
      const { error } = await supabase.from('universities').delete().eq('id', id);
      if (error) throw error;
  }
};
