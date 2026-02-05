
import { supabase } from './supabaseClient';
import { CountryData } from '../types';
import { MOCK_COUNTRIES } from './mockData';

export const countryService = {
  async getAll(): Promise<CountryData[]> {
    if (!supabase) return MOCK_COUNTRIES;
    
    try {
        const { data, error } = await supabase
          .from('countries')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
          console.warn('Supabase fetch countries failed (likely table missing). Using mock data.', error.message);
          return MOCK_COUNTRIES; 
        }
        
        if (!data || data.length === 0) return MOCK_COUNTRIES;

        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          flag: row.flag,
          capital: row.capital,
          currency: row.currency,
          population: row.population,
          imageUrl: row.image_url,
          educationSystemDescription: row.education_system_description,
          postGradWorkPermit: row.post_grad_work_permit,
          yksRequirement: row.yks_requirement,
          cities: row.cities || [],
          popularJobs: row.popular_jobs || [],
          bachelorTypes: row.bachelor_types || [],
          masterTypes: row.master_types || []
        }));
    } catch (err) {
        console.warn('Unexpected error in countryService.getAll. Using mock data.', err);
        return MOCK_COUNTRIES;
    }
  },

  async upsert(country: CountryData): Promise<CountryData> {
    if (!supabase) return country;

    const dbPayload = {
        id: country.id,
        name: country.name,
        flag: country.flag,
        capital: country.capital,
        currency: country.currency,
        population: country.population,
        image_url: country.imageUrl,
        education_system_description: country.educationSystemDescription,
        post_grad_work_permit: country.postGradWorkPermit,
        yks_requirement: country.yksRequirement,
        cities: country.cities,
        popular_jobs: country.popularJobs,
        bachelor_types: country.bachelorTypes,
        master_types: country.masterTypes
    };

    const { data, error } = await supabase
      .from('countries')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    
    // Return mapped back to ensure consistency
    return {
          id: data.id,
          name: data.name,
          flag: data.flag,
          capital: data.capital,
          currency: data.currency,
          population: data.population,
          imageUrl: data.image_url,
          educationSystemDescription: data.education_system_description,
          postGradWorkPermit: data.post_grad_work_permit,
          yksRequirement: data.yks_requirement,
          cities: data.cities || [],
          popularJobs: data.popular_jobs || [],
          bachelorTypes: data.bachelor_types || [],
          masterTypes: data.master_types || []
    };
  },
  
  async delete(id: string): Promise<void> {
      if (!supabase) return;
      const { error } = await supabase.from('countries').delete().eq('id', id);
      if (error) throw error;
  }
};
