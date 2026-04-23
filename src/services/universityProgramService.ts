
import { supabase } from './supabaseClient';
import { UniversityProgramData } from '../types';

export const universityProgramService = {
  async getAll(): Promise<UniversityProgramData[]> {
    if (!supabase) return [];
    
    // Joint query to get names if possible, or we enrich in UI
    const { data, error } = await supabase
      .from('university_programs')
      .select(`
        *,
        universities (name),
        cat1:main_categories!main_category_id (name),
        cat2:main_categories!main_category_2_id (name),
        cat3:main_categories!main_category_3_id (name),
        deg1:programs!main_degree_id (name),
        deg2:programs!main_degree_2_id (name),
        deg3:programs!main_degree_3_id (name)
      `)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Fetch university programs failed:', error.message);
      throw error;
    }
    
    return (data || []).map((row: any) => ({
      id: row.id,
      universityId: row.university_id,
      universityName: row.universities?.name,
      type: row.type || 'Bachelor',
      name: row.name,
      url: row.url,
      mainCategoryId: row.main_category_id,
      mainCategoryName: (row as any).cat1?.name,
      mainCategory2Id: row.main_category_2_id,
      mainCategory2Name: (row as any).cat2?.name,
      mainCategory3Id: row.main_category_3_id,
      mainCategory3Name: (row as any).cat3?.name,
      mainDegreeId: row.main_degree_id,
      mainDegreeName: (row as any).deg1?.name,
      mainDegree2Id: row.main_degree_2_id,
      mainDegree2Name: (row as any).deg2?.name,
      mainDegree3Id: row.main_degree_3_id,
      mainDegree3Name: (row as any).deg3?.name,
      language: row.language,
      tuitionRange: row.tuition_range,
      created_at: row.created_at
    }));
  },

  async upsert(program: UniversityProgramData): Promise<UniversityProgramData> {
    if (!supabase) throw new Error('Supabase is not configured');

    const dbPayload: any = {
        university_id: program.universityId,
        name: program.name,
        url: program.url,
        main_category_id: program.mainCategoryId || null,
        main_category_2_id: program.mainCategory2Id || null,
        main_category_3_id: program.mainCategory3Id || null,
        main_degree_id: program.mainDegreeId || null,
        main_degree_2_id: program.mainDegree2Id || null,
        main_degree_3_id: program.mainDegree3Id || null,
        language: program.language,
        tuition_range: program.tuitionRange
    };

    if (program.id && !program.id.startsWith('new-')) {
        dbPayload.id = program.id;
    }

    const { data, error } = await supabase
      .from('university_programs')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) {
      console.error('University Program Upsert Failed:', error.message);
      throw error;
    }
    
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('university_programs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
