
import { supabase } from './supabaseClient';
import { UniversityData } from '../types';

export const universityService = {
  async getAll(): Promise<UniversityData[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) {
      console.error('Fetch universities failed:', error.message);
      throw error;
    }
    
    return (data || []).map((row: any) => ({
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
  },

  async upsert(university: UniversityData): Promise<UniversityData> {
    if (!supabase) throw new Error('Supabase is not configured');

    const isLocalId = university.id.startsWith('uni-');

    const dbPayload: any = {
        name: university.name,
        logo: university.logo,
        countries: university.countries || [],
        ranking_url: university.rankingUrl,
        website_url: university.websiteUrl,
        departments_url: university.departmentsUrl,
        consulting_type: university.consultingType,
        university_types: university.universityTypes || [],
        shared_institution_id: university.sharedInstitutionId || null,
        programs: university.programs || []
    };

    // Eğer ID mock veri gibi 'uni-' veya 'university-' ile başlıyorsa 
    // veya hiç yoksa yeni kayıt (Insert) işlemi yap
    const isTempId = !university.id || 
                     university.id.startsWith('uni-') || 
                     university.id.startsWith('university-');

    if (isTempId) {
      const { data, error } = await supabase
        .from('universities')
        .insert(dbPayload)
        .select()
        .single();

      if (error) {
        console.error('University Insert Failed:', error.message, error.details, error.hint);
        throw new Error(`Kayıt oluşturulamadı: ${error.message}`);
      }
      // UI tarafında eski (temp) ID ile eşleştirme yapabilmesi için yeni ID'yi dön
      return {
        ...university,
        id: data.id,
        ...data
      };
    } else {
      // Mevcut ID ile güncelle (Update)
      const { data, error } = await supabase
        .from('universities')
        .upsert({ ...dbPayload, id: university.id })
        .select()
        .single();

      if (error) {
        console.error('University Upsert Failed:', error.message, error.details, error.hint);
        throw new Error(`Güncelleme başarısız: ${error.message}`);
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
