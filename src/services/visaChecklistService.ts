
import { supabase } from './supabaseClient';

export interface VisaChecklistItem {
  id?: string;
  country_name: string;
  visa_type_name: string;
  category: string;
  task: string;
  description: string;
  required: boolean;
  translation_required: boolean;
  example_url?: string;
}

export interface VisaMetadata {
  id?: string;
  country_name: string;
  visa_type_name: string;
  institution?: string;
  locations?: string;
  method?: string;
  pricing?: string;
  durations?: string;
  additional_info?: string;
}

export const visaChecklistService = {
  // --- Metadata (İletişim Kutusu) ---
  async getMetadata(countryName: string, visaTypeName: string): Promise<VisaMetadata | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('country_visa_checklists')
      .select('institution, locations, method, pricing, durations, additional_info')
      .eq('country_name', countryName)
      .eq('visa_type_name', visaTypeName)
      .maybeSingle();

    if (error) {
      console.error('Error fetching metadata:', error);
      return null;
    }
    return data;
  },

  async saveMetadata(data: VisaMetadata): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('country_visa_checklists')
      .upsert({
        country_name: data.country_name,
        visa_type_name: data.visa_type_name,
        institution: data.institution || '',
        locations: data.locations || '',
        method: data.method || '',
        pricing: data.pricing || '',
        durations: data.durations || '',
        additional_info: data.additional_info || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'country_name,visa_type_name'
      });

    if (error) throw error;
  },

  async getAllMetadata(): Promise<VisaMetadata[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('country_visa_checklists')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  // --- Items (Belge Listesi - Her biri bir satır) ---
  async getItems(countryName: string, visaTypeName: string): Promise<VisaChecklistItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('visa_checklist_items')
      .select('*')
      .eq('country_name', countryName)
      .eq('visa_type_name', visaTypeName)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching items:', error);
      return [];
    }
    return data || [];
  },

  async getAllItems(): Promise<VisaChecklistItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('visa_checklist_items')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async saveItem(item: any): Promise<VisaChecklistItem | null> {
    if (!supabase) return null;
    
    // UI'dan gelen toplu işlem alanlarını veritabanına gönderme
    const { applyGlobally, applyToCountry, ...dbData } = item;

    const { data, error } = await supabase
      .from('visa_checklist_items')
      .upsert({
        ...dbData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async saveBulkItems(items: VisaChecklistItem[]): Promise<void> {
    if (!supabase) return;
    
    // UI state'lerini temizle
    const cleanItems = items.map(({ applyGlobally, applyToCountry, ...rest }: any) => ({
      ...rest,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('visa_checklist_items')
      .upsert(cleanItems, {
        onConflict: 'country_name,visa_type_name,category,task'
      });

    if (error) throw error;
  },

  async deleteItem(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('visa_checklist_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async applyItemToCountryVisas(countryName: string, item: any): Promise<void> {
    if (!supabase) return;
    
    const { applyGlobally, applyToCountry, ...cleanItem } = item;

    // Implementation for cloning item across country visas
    const { data: countryData } = await supabase.from('countries').select('visa_types').eq('name', countryName).single();
    if (!countryData?.visa_types) return;

    const itemsToInsert = countryData.visa_types.map((vt: any) => ({
      ...cleanItem,
      id: undefined, 
      visa_type_name: vt.name,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('visa_checklist_items').upsert(itemsToInsert, { onConflict: 'country_name,visa_type_name,category,task' });
    if (error) throw error;
  },

  async applyItemToAllVisasGlobally(item: any): Promise<void> {
    if (!supabase) return;
    
    const { applyGlobally, applyToCountry, ...cleanItem } = item;

    const { data: allCountries } = await supabase.from('countries').select('name, visa_types');
    if (!allCountries) return;

    const itemsToInsert: any[] = [];
    allCountries.forEach(c => {
      (c.visa_types || []).forEach((vt: any) => {
        itemsToInsert.push({
          ...cleanItem,
          id: undefined,
          country_name: c.name,
          visa_type_name: vt.name,
          updated_at: new Date().toISOString()
        });
      });
    });

    const { error } = await supabase.from('visa_checklist_items').upsert(itemsToInsert, { onConflict: 'country_name,visa_type_name,category,task' });
    if (error) throw error;
  },

  async uploadExampleFile(file: File, path: string): Promise<string | null> {
    if (!supabase) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('visa-examples')
      .upload(filePath, file);

    if (uploadError) {
      console.error('File upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('visa-examples')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
