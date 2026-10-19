
import { supabase } from './supabaseClient';
import { UniversityData } from '../types';

const formatProgramTuitionRange = (program: any) => [
  program.tuition_budget_range,
  program.tuition_currency,
].filter(Boolean).join(' ').trim();

const mapUniversityRow = (row: any, fallbackPrograms: UniversityData['programs'] = []): UniversityData => ({
  id: row.id,
  name: row.name,
  logo: row.logo,
  countries: row.countries || [],
  campuses: row.campuses || [],
  rankingUrl: row.ranking_url || '',
  websiteUrl: row.website_url || '',
  universityTypes: row.university_types ?? row.universityTypes ?? [],
  programs: row.university_programs
    ? row.university_programs.map((p: any) => ({
        id: p.id,
        name: p.name,
        link: p.url,
        type: p.level === 'master' ? 'Master' : 'Bachelor',
        tuitionRange: p.tuition_range || formatProgramTuitionRange(p),
        matched_departments: p.matched_departments || [],
        groupNames: [
          p.main_degree?.name,
          p.main_degree2?.name,
          p.main_degree3?.name,
          ...(p.matched_departments || [])
        ].filter(Boolean)
      }))
    : fallbackPrograms
});

export const universityService = {
  async getAll(): Promise<UniversityData[]> {
    if (!supabase) return [];
    
    // Fetch universities and their programs from the relational table
    const { data, error } = await supabase
      .from('universities')
      .select(`
        *,
        university_programs (
          id,
          name,
          url,
          level,
          language,
          tuition_range,
          tuition_budget_range,
          tuition_currency,
          matched_departments,
          main_degree:programs!main_degree_id (name),
          main_degree2:programs!main_degree_2_id (name),
          main_degree3:programs!main_degree_3_id (name)
        )
      `)
      .order('name', { ascending: true });
      
    if (error) {
      console.error('Fetch universities failed:', error.message);
      throw error;
    }
    
    return (data || []).map((row: any) => mapUniversityRow(row));
  },

  async upsert(university: UniversityData): Promise<UniversityData> {
    if (!supabase) throw new Error('Supabase is not configured');

    const dbPayload: any = {
        name: university.name.trim(),
        logo: university.logo,
        countries: university.countries || [],
        campuses: (university.campuses || []).filter(Boolean),
        ranking_url: university.rankingUrl,
        website_url: university.websiteUrl,
        university_types: (university.universityTypes || []).filter(Boolean),
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
        const message = error.code === '23505'
          ? 'Bu üniversite zaten kayıtlı.'
          : error.message;
        throw new Error(`Üniversite kaydedilemedi: ${message}`);
      }
      // UI tarafında eski (temp) ID ile eşleştirme yapabilmesi için yeni ID'yi dön
      return mapUniversityRow(data, university.programs || []);
    } else {
      // Mevcut ID ile güncelle (Update)
      const { data, error } = await supabase
        .from('universities')
        .update(dbPayload)
        .eq('id', university.id)
        .select()
        .single();

      if (error) {
        console.error('University Upsert Failed:', error.message, error.details, error.hint);
        throw new Error(`Güncelleme başarısız: ${error.message}`);
      }
      return mapUniversityRow(data, university.programs || []);
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
