import { MainDegreeData, UniversityProgramData } from '../types';

export const UNIVERSITY_PROGRAM_EXCEL_HEADERS = [
  'ID',
  'Üniversite',
  'Bölüm Adı',
  'Bölüm Linki',
  'Alt Başlık 1',
  'Alt Başlık 2',
  'Alt Başlık 3',
  'Dil',
  'Eğitim Bütçesi',
];

export const toUniversityProgramExcelRow = (program: UniversityProgramData) => ({
  'ID': program.id.startsWith('new-') ? '' : program.id,
  'Üniversite': program.universityName || '',
  'Bölüm Adı': program.name,
  'Bölüm Linki': program.url || '',
  'Alt Başlık 1': program.mainDegreeName || '',
  'Alt Başlık 2': program.mainDegree2Name || '',
  'Alt Başlık 3': program.mainDegree3Name || '',
  'Dil': program.language || '',
  'Eğitim Bütçesi': program.tuitionRange || '',
});

const normalize = (value: unknown) => String(value || '').toLocaleLowerCase('tr-TR').trim();

export const parseUniversityProgramExcelRow = (
  row: Record<string, unknown>,
  university: { id: string; name: string },
  mainDegrees: MainDegreeData[],
  fallbackId: string,
): UniversityProgramData => {
  const findDegree = (...columns: string[]) => {
    const name = columns.map(column => row[column]).find(Boolean);
    return mainDegrees.find(degree => normalize(degree.name) === normalize(name));
  };
  const degree1 = findDegree('Alt Başlık 1', 'Bölüm 1', 'Alt Başlık');
  const degree2 = findDegree('Alt Başlık 2', 'Bölüm 2');
  const degree3 = findDegree('Alt Başlık 3', 'Bölüm 3');

  return {
    id: String(row['ID'] || fallbackId),
    universityId: university.id,
    universityName: university.name,
    type: row['Bölüm Türü'] === 'Master' || row['Tür'] === 'Master' ? 'Master' : 'Bachelor',
    name: String(row['Bölüm Adı'] || ''),
    url: String(row['Bölüm Linki'] || ''),
    mainDegreeId: degree1?.id || '',
    mainDegreeName: degree1?.name,
    mainDegree2Id: degree2?.id || '',
    mainDegree2Name: degree2?.name,
    mainDegree3Id: degree3?.id || '',
    mainDegree3Name: degree3?.name,
    language: String(row['Dil'] || ''),
    tuitionRange: String(row['Eğitim Bütçesi'] || ''),
  };
};

export const getExcelUniversityName = (row: Record<string, unknown>) => String(row['Üniversite'] || '').trim();
