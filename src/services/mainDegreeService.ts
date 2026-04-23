
import { supabase } from './supabaseClient';
import { MainDegreeData } from '../types';

export const mainDegreeService = {
  async getAll(): Promise<MainDegreeData[]> {
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
          .from('programs') // Still using 'programs' table but mapped to MainDegree
          .select('*')
          .order('name', { ascending: true });
          
        if (error) throw error;
        
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          careerOpportunities: row.career_opportunities,
          aiImpact: row.ai_impact,
          topCompanies: row.top_companies,
          sectorStatusTR: row.sector_status_tr,
          imageUrl: row.image_url
        }));
    } catch (err) {
        console.error('mainDegreeService.getAll failed', err);
        return [];
    }
  },

  async upsert(degree: MainDegreeData): Promise<MainDegreeData> {
    if (!supabase) return degree;

    const dbPayload = {
        name: degree.name,
        description: degree.description,
        career_opportunities: degree.careerOpportunities,
        ai_impact: degree.aiImpact,
        top_companies: degree.topCompanies,
        sector_status_tr: degree.sectorStatusTR,
        image_url: degree.imageUrl
    } as any;

    if (!degree.id.startsWith('deg-')) {
        dbPayload.id = degree.id;
    }

    console.log('mainDegreeService.upsert - degree.id:', degree.id);
    console.log('mainDegreeService.upsert - dbPayload:', dbPayload);

    const { data, error } = await supabase
      .from('programs')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    
    return {
          id: data.id,
          name: data.name,
          description: data.description,
          careerOpportunities: data.career_opportunities,
          aiImpact: data.ai_impact,
          topCompanies: data.top_companies,
          sectorStatusTR: data.sector_status_tr,
          imageUrl: data.image_url
    };
  },
  
  async delete(id: string): Promise<void> {
      if (!supabase) return;
      const { error } = await supabase.from('programs').delete().eq('id', id);
      if (error) throw error;
  }
};
