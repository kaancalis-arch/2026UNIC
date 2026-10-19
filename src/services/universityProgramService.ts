
import { supabase } from './supabaseClient';
import { UniversityProgramData } from '../types';

const formatProgramTuitionRange = (row: any) => [
  row.tuition_budget_range,
  row.tuition_currency,
].filter(Boolean).join(' ').trim();

export const universityProgramService = {
  async getAll(): Promise<UniversityProgramData[]> {
    if (!supabase) return [];

    const rows: any[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('university_programs')
        .select(`
          *,
          universities (name),
          deg1:programs!main_degree_id (name),
          deg2:programs!main_degree_2_id (name),
          deg3:programs!main_degree_3_id (name)
        `)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Fetch university programs failed:', error.message);
        throw error;
      }

      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    return rows.map((row: any) => ({
      id: row.id,
      universityId: row.university_id,
      universityName: row.universities?.name,
      type: row.type || 'Bachelor',
      name: row.name,
      url: row.url,
      mainDegreeId: row.main_degree_id,
      mainDegreeName: (row as any).deg1?.name,
      mainDegree2Id: row.main_degree_2_id,
      mainDegree2Name: (row as any).deg2?.name,
      mainDegree3Id: row.main_degree_3_id,
      mainDegree3Name: (row as any).deg3?.name,
      language: row.language,
      tuitionRange: row.tuition_range || formatProgramTuitionRange(row),
      created_at: row.created_at
    }));
  },

  async upsert(program: UniversityProgramData): Promise<UniversityProgramData> {
    if (!supabase) throw new Error('Supabase is not configured');

    const dbPayload: any = {
        university_id: program.universityId,
        name: program.name,
        url: program.url,
        main_degree_id: program.mainDegreeId || null,
        main_degree_2_id: program.mainDegree2Id || null,
        main_degree_3_id: program.mainDegree3Id || null,
        language: program.language,
        tuition_range: program.tuitionRange,
        tuition_budget_range: program.tuitionRange || null
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

  async updateGrouping(id: string, degreeIds: string[]): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured');

    const { data, error } = await supabase
      .from('university_programs')
      .update({
        main_degree_id: degreeIds[0] || null,
        main_degree_2_id: degreeIds[1] || null,
        main_degree_3_id: degreeIds[2] || null,
      })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Güncellenecek üniversite bölümü bulunamadı.');
  },

  async clearGroupings(ids: string[]): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured');
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from('university_programs')
      .update({
        main_degree_id: null,
        main_degree_2_id: null,
        main_degree_3_id: null,
      })
      .in('id', ids)
      .select('id');

    if (error) throw error;
    if ((data || []).length !== ids.length) {
      throw new Error('Bazı üniversite bölümlerinin eski gruplandırmaları temizlenemedi.');
    }
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
