import { supabase } from './supabaseClient';

export type SchoolNameType = 'high_school' | 'university';

export interface SchoolNameRecord {
  id: string;
  type: SchoolNameType;
  name: string;
}

const STORAGE_KEY = 'unic_school_names';

const readRecords = (): SchoolNameRecord[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(record => record?.id && record?.type && record?.name) : [];
  } catch (error) {
    console.warn('Failed to load school names', error);
    return [];
  }
};

const writeRecords = (records: SchoolNameRecord[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const mapSchoolNameRow = (row: any): SchoolNameRecord => ({
  id: `school_names:${row.id}`,
  type: row.type,
  name: row.name
});

const mapTurkeyUniversityRow = (row: any): SchoolNameRecord => ({
  id: `turkey_universities:${row.id}`,
  type: 'university',
  name: row.name
});

const mapTurkeyHighSchoolRow = (row: any): SchoolNameRecord => ({
  id: `turkey_high_schools:${row.id}`,
  type: 'high_school',
  name: row.name
});

const mergeUniqueRecords = (records: SchoolNameRecord[]) => {
  const seen = new Set<string>();

  return records
    .filter(record => {
      const key = `${record.type}:${record.name.toLocaleLowerCase('tr-TR')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
};

const addLocalRecord = (type: SchoolNameType, name: string) => {
  const records = readRecords();
  const exists = records.some(record => record.type === type && record.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
  if (exists) throw new Error('Bu okul adı zaten ekli.');

  const record = { id: `school-${Date.now()}`, type, name };
  writeRecords([...records, record]);
  return record;
};

export const schoolNameService = {
  async getAll(type?: SchoolNameType): Promise<SchoolNameRecord[]> {
    if (!type) {
      const [highSchools, universities] = await Promise.all([
        this.getAll('high_school'),
        this.getAll('university')
      ]);

      return mergeUniqueRecords([...highSchools, ...universities]);
    }

    if (supabase) {
      try {
        if (type === 'high_school') {
          const [{ data: highSchoolData, error: highSchoolError }, { data: legacyData }] = await Promise.all([
            supabase.from('turkey_high_schools').select('*').order('name', { ascending: true }),
            supabase.from('school_names').select('*').eq('type', 'high_school').order('name', { ascending: true })
          ]);

          if (highSchoolError) throw highSchoolError;

          return mergeUniqueRecords([
            ...(highSchoolData || []).map(mapTurkeyHighSchoolRow),
            ...(legacyData || []).map(mapSchoolNameRow)
          ]);
        }

        if (type === 'university') {
          const [{ data: universityData, error: universityError }, { data: legacyData }] = await Promise.all([
            supabase.from('turkey_universities').select('*').order('name', { ascending: true }),
            supabase.from('school_names').select('*').eq('type', 'university').order('name', { ascending: true })
          ]);

          if (universityError) throw universityError;

          return mergeUniqueRecords([
            ...(universityData || []).map(mapTurkeyUniversityRow),
            ...(legacyData || []).map(mapSchoolNameRow)
          ]);
        }

        const { data, error } = await supabase
          .from('school_names')
          .select('*')
          .eq('type', type)
          .order('name', { ascending: true });
        if (error) throw error;

        return (data || []).map(mapSchoolNameRow);
      } catch (error) {
        console.warn('school names table unavailable. Using local data.', error);
      }
    }

    const records = readRecords().sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
    return type ? records.filter(record => record.type === type) : records;
  },

  async add(type: SchoolNameType, name: string): Promise<SchoolNameRecord> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Okul adı boş olamaz.');

    if (supabase) {
      try {
        if (type === 'high_school') {
          const { data, error } = await supabase
            .from('turkey_high_schools')
            .upsert({ name: trimmedName }, { onConflict: 'name' })
            .select('*')
            .single();

          if (error) throw error;
          return mapTurkeyHighSchoolRow(data);
        }

        if (type === 'university') {
          const { data, error } = await supabase
            .from('turkey_universities')
            .upsert({ name: trimmedName }, { onConflict: 'name' })
            .select('*')
            .single();

          if (error) throw error;
          return mapTurkeyUniversityRow(data);
        }

        const { data, error } = await supabase
          .from('school_names')
          .upsert({ type, name: trimmedName }, { onConflict: 'type,name' })
          .select('*')
          .single();

        if (error) throw error;
        return mapSchoolNameRow(data);
      } catch (error) {
        console.warn('school names insert failed. Using local data.', error);
      }
    }

    return addLocalRecord(type, trimmedName);
  },

  async bulkUpsert(type: SchoolNameType, names: string[]): Promise<void> {
    const uniqueNames = Array.from(new Set(names.map(name => name.trim()).filter(Boolean)));
    if (uniqueNames.length === 0) return;

    if (supabase) {
      try {
        if (type === 'high_school') {
          const { error } = await supabase
            .from('turkey_high_schools')
            .upsert(uniqueNames.map(name => ({ name })), { onConflict: 'name' });

          if (error) throw error;
          return;
        }

        if (type === 'university') {
          const { error } = await supabase
            .from('turkey_universities')
            .upsert(uniqueNames.map(name => ({ name })), { onConflict: 'name' });

          if (error) throw error;
          return;
        }

        const { error } = await supabase
          .from('school_names')
          .upsert(uniqueNames.map(name => ({ type, name })), { onConflict: 'type,name' });

        if (error) throw error;
        return;
      } catch (error) {
        console.warn('school names bulk upsert failed. Using local data.', error);
      }
    }

    let records = readRecords();
    uniqueNames.forEach(name => {
      const exists = records.some(record => record.type === type && record.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
      if (!exists) {
        records = [...records, { id: `school-${Date.now()}-${records.length}`, type, name }];
      }
    });
    writeRecords(records);
  },

  async delete(id: string): Promise<void> {
    if (supabase && id.includes(':')) {
      try {
        const [table, recordId] = id.split(':');
        const { error } = await supabase.from(table).delete().eq('id', recordId);
        if (error) throw error;
        return;
      } catch (error) {
        console.warn('school names delete failed. Using local data.', error);
      }
    }

    writeRecords(readRecords().filter(record => record.id !== id));
  }
};
