export type ProfileBoxId = 'academic' | 'exams' | 'preferences' | 'languageEducationPreferences' | 'language' | 'budget' | 'social' | 'citizenship';

export interface ProfileBoxConfig {
  id: ProfileBoxId;
  label: string;
  description: string;
  programNames: string[];
}

const STORAGE_KEY = 'unic_profile_boxes_config';

export const DEFAULT_PROFILE_BOXES: ProfileBoxConfig[] = [
  { id: 'academic', label: 'Akademik Bilgiler', description: 'Eğitim durumu, okul, sınıf, alan ve akademik notlar.', programNames: [] },
  { id: 'exams', label: 'Sınavlar', description: 'SAT, AP, IB ve diğer sınav hazırlık/sonuç bilgileri.', programNames: [] },
  { id: 'preferences', label: 'Akademik Eğitim Tercihleri', description: 'Bölüm ve ülke tercihleri ile tercih notları.', programNames: [] },
  { id: 'languageEducationPreferences', label: 'Dil Eğitimi Tercihleri', description: 'Dil eğitimi program tipi, ülke, başlangıç tarihi ve süre bilgileri.', programNames: ['Dil Okulu', 'Yaz Kampı', 'Yaz Okulu', 'Language Course', 'Summer Course'] },
  { id: 'language', label: 'Dil Yeterliliği', description: 'Dil seviyesi, sınav skorları, diğer diller ve dil notları.', programNames: [] },
  { id: 'budget', label: 'Bütçe Aralığı', description: 'Öğrencinin yıllık eğitim bütçesi.', programNames: [] },
  { id: 'social', label: 'Sosyal Faaliyetler', description: 'Spor, sanat, sosyal çalışmalar ve projeler.', programNames: [] },
  { id: 'citizenship', label: 'Vatandaşlık & Pasaport', description: 'Vatandaşlık, pasaport ve oturum bilgileri.', programNames: [] }
];

const normalizeProgramName = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

const mergeWithDefaults = (storedBoxes: Partial<ProfileBoxConfig>[]): ProfileBoxConfig[] => {
  return DEFAULT_PROFILE_BOXES.map(defaultBox => {
    const storedBox = storedBoxes.find(box => box.id === defaultBox.id);

    return {
      ...defaultBox,
      programNames: Array.isArray(storedBox?.programNames) ? storedBox.programNames.filter(Boolean) : defaultBox.programNames
    };
  });
};

export const getVisibleProfileBoxIds = (boxes: ProfileBoxConfig[], selectedPrograms: string[]) => {
  const normalizedSelectedPrograms = selectedPrograms.map(normalizeProgramName).filter(Boolean);

  if (normalizedSelectedPrograms.length === 0) {
    return [];
  }

  return boxes
    .filter(box => {
      if (box.programNames.length === 0) return true;

      return box.programNames.some(programName => normalizedSelectedPrograms.includes(normalizeProgramName(programName)));
    })
    .map(box => box.id);
};

export const profileBoxService = {
  async getAll(): Promise<ProfileBoxConfig[]> {
    if (typeof window === 'undefined') return DEFAULT_PROFILE_BOXES;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_PROFILE_BOXES;

      const parsed = JSON.parse(stored);
      return mergeWithDefaults(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.warn('Failed to load profile box config', error);
      return DEFAULT_PROFILE_BOXES;
    }
  },

  async saveAll(boxes: ProfileBoxConfig[]): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeWithDefaults(boxes)));
  }
};
