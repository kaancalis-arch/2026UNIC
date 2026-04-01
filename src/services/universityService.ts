
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
          departmentsUrl: row.departments_url,
          consultingType: row.consulting_type,
          universityTypes: row.university_types || [],
          sharedInstitutionId: row.shared_institution_id,
          programs: row.programs || []
        }));
    } catch (err) {
        console.warn('Unexpected error in universityService.getAll. Using mock data.', err);
        return MOCK_UNIVERSITIES;
    }
  },

  async upsert(university: UniversityData): Promise<UniversityData> {
    // Supabase bağlantısı yoksa mock data kullan
    if (!supabase) {
      console.warn('Supabase not configured, using local mock data');
      return university;
    }

    const isLocalId = university.id.startsWith('uni-');

    const dbPayload: any = {
        name: university.name,
        logo: university.logo,
        countries: university.countries,
        ranking_url: university.rankingUrl,
        website_url: university.websiteUrl,
        departments_url: university.departmentsUrl,
        consulting_type: university.consultingType,
        university_types: university.universityTypes || [],
        shared_institution_id: university.sharedInstitutionId,
        programs: university.programs || []
    };

    // Yeni kayıt için ID oluştur, güncelleme için mevcut ID'yi kullan
    if (isLocalId) {
      // Önce insert deneme
      const { data, error } = await supabase
        .from('universities')
        .insert({ ...dbPayload, id: university.id })
        .select()
        .single();

      if (error) {
        // 23505 = unique_violation (duplicate key), upsert'e geç
        if (error.code !== '23505') {
          console.error('Insert failed:', error);
          throw new Error(error.message);
        }
        // Upsert dene
        const { data: upsertData, error: upsertError } = await supabase
          .from('universities')
          .upsert({ ...dbPayload, id: university.id })
          .select()
          .single();
        
        if (upsertError) {
          console.error('Upsert failed:', upsertError);
          throw new Error(upsertError.message);
        }
        return upsertData;
      }
      return data;
    } else {
      // Mevcut ID ile güncelleme
      const { data, error } = await supabase
        .from('universities')
        .upsert(dbPayload)
        .select()
        .single();

      if (error) {
        console.error('Upsert failed:', error);
        throw new Error(error.message);
      }
      return data;
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
