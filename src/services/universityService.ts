
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
          console.warn('Supabase fetch universities failed. Error:', error.message);
          return MOCK_UNIVERSITIES; 
        }
        
        if (!data || data.length === 0) return MOCK_UNIVERSITIES;

        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          logo: row.logo,
          countries: row.countries || [],
          rankingUrl: row.ranking_url || '',
          websiteUrl: row.website_url,
          departmentsUrl: row.departments_url, // Fixed mapping
          programs: row.programs || [] // Fallback if missing
        }));
    } catch (err) {
        console.warn('Unexpected error in universityService.getAll. Using mock data.', err);
        return MOCK_UNIVERSITIES;
    }
  },

  async upsert(university: UniversityData): Promise<UniversityData> {
    if (!supabase) return university;

    // Local ID check (e.g. uni-123456789) - Supabase IDs are UUIDs.
    // If it's a local ID, we omit it to let Supabase generate a real UUID.
    const isLocalId = university.id.startsWith('uni-');

    const dbPayload: any = {
        name: university.name,
        logo: university.logo,
        countries: university.countries,
        ranking_url: university.rankingUrl,
        website_url: university.websiteUrl,
        departments_url: university.departmentsUrl,
        programs: university.programs || []
    };

    if (!isLocalId) {
        dbPayload.id = university.id;
    }

    try {
        const { data, error } = await supabase
          .from('universities')
          .upsert(dbPayload)
          .select()
          .single();

        if (error) {
            console.error('Supabase upsert failed:', error.message, 'Code:', error.code);
            
            // Helpful message for RLS Permission issue
            if (error.code === '42501') {
                throw new Error("VERİTABANI YETKİ HATASI: Kayıt yapılamadı. Lütfen Supabase'de 'universities' tablosu için INSERT/UPDATE RLS Policy (İzinleri) eklediğinizden emin olun.");
            }
            throw new Error(error.message);
        }
        
        return {
            id: data.id,
            name: data.name,
            logo: data.logo,
            countries: data.countries || [],
            rankingUrl: data.ranking_url || '',
            websiteUrl: data.website_url,
            departmentsUrl: data.departments_url,
            programs: data.programs || []
        };
    } catch (err: any) {
        console.error('Error in universityService.upsert:', err);
        throw err;
    }
  },
  
  async uploadLogo(file: File): Promise<string> {
      if (!supabase) throw new Error("Supabase is not configured.");
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`; // bucket is university-logos
      
      const { error: uploadError } = await supabase.storage
          .from('university-logos')
          .upload(filePath, file);
          
      if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw new Error(uploadError.message);
      }
      
      const { data: { publicUrl } } = supabase.storage
          .from('university-logos')
          .getPublicUrl(filePath);
          
      return publicUrl;
  },

  async delete(id: string): Promise<void> {
      if (!supabase) return;
      try {
        const { error } = await supabase.from('universities').delete().eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        console.error('Error in universityService.delete:', err);
        throw err;
      }
  }
};
