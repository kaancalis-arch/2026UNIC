
export enum PipelineStage {
  FOLLOW = 'Follow',
  ANALYSE = 'Analyse',
  PROCESS = 'Process',
  ENROLLMENT = 'Enrollment',
  STUDENT = 'Student',
  NOT_INTERESTED = 'Not Interested'
}

export type AnalyseStatus = 'Mid' | 'Hot' | 'Super Hot';

export interface Branch {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  status: 'active' | 'passive';
  manager_id: string;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'Başvuru Aşamasında' | 'Sonuç Bekleniyor' | 'Şartlı Kabul' | 'Kabul' | 'Red';

export interface UniversityApplication {
  id: string;
  universityName: string;
  programName: string;
  status: ApplicationStatus;
  notes?: string;
}

export enum UserRole {
  SUPER_ADMIN = 'Super Admin',
  ADMIN = 'Admin',
  BRANCH_MANAGER = 'Şube Müdürü',
  CONSULTANT = 'Danışman',
  REPRESENTATIVE = 'Temsilci',
  STUDENT_REPRESENTATIVE = 'Öğrenci Temsilci',
  STUDENT = 'Öğrenci'
}

export interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch_id: string;
  parent_user_id?: string;
  status: 'active' | 'passive';
  avatarUrl?: string;
  created_at: string;
  updated_at: string;
}

export interface ParentInfo {
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface ExamDetails {
  selected: boolean;
  status?: 'Taken' | 'Preparing' | string;
  score?: string;
  date?: string;
  subject?: string; // Legacy
  apSubjects?: Array<{ subject: string; status: string; grade?: string }>; // Updated: added grade
  ibSubjects?: Array<{ subject: string; level: string; status: string }>;
  notes?: string; // For "Other" exam notes
}

export interface StudentProfileNote {
  id: string;
  studentId: string;
  text: string;
  completed: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedBy: string | null;
}

export interface AnalysisReport {
  // 1. Dil Yeterliliği
  language: {
    hasTakenExam?: boolean; // Dil seviyeni belirleyecek bir sınava girdin mi?
    examType?: string;
    examScore?: string;
    examOtherNote?: string;
    pastExamDate?: string; // Sınava girdiği tarih
    examType2?: string;
    examScore2?: string;
    examOtherNote2?: string;
    pastExamDate2?: string;
    examType3?: string;
    examScore3?: string;
    examOtherNote3?: string;
    pastExamDate3?: string;
    estimatedLevel?: string; // Tahmini İngilizce Seviyen Nedir? (A1-C2, Unknown)
    isPreparingForExam?: boolean; // Hazırlandığın bir dil sınavı var mı? OR Tekrar Sınava girecek misin?
    targetExam?: string; // e.g., IELTS UKVI
    examDate?: string; // Ne zaman sınava girmeyi planlıyorsun? (Future)
    hasRegisteredForExam?: boolean;
    examRegistrationDate?: string;
    wantsTutoring?: boolean; // Deneme Sınavına Katılmak ve Özel Ders hakkında bilgi almak ister misin?
    languageNotes?: string; // Bu aşamaya bir not kutucuğu ekle
    preparationNotes?: string;
    otherLanguages?: Array<{ language: string; level: string }>;

  };
  // 2. Akademik Yeterlilik
  academic: {
    gpa?: string; // Mevcut Not Ortamalan kaç?
    educationField?: string; // Eğitim Aldığın alan Nedir?
    ibCourses?: Array<{ name: string; grade: string }>; // For IB
    exams?: {
      [key: string]: ExamDetails; // Key: 'SAT', 'AP', 'CeNT-S', 'Other'
    };
    academicNotes?: string;
  };
  // 3. Sosyal Çalışmalar
  social: {
    sports?: string;
    arts?: string;
    socialWork?: string; // "Sosyal Çalışmalar"
    projects?: string;
  };
  // 5. Bölüm ve Ülke Tercihi
  preferences: {
    program1Category?: string;
    program1?: string;
    program2Category?: string;
    program2?: string;
    country1?: string;
    country2?: string;
    country3?: string;
    country4?: string;
    country5?: string;
    notes?: string;
    wantsCoaching?: boolean;
    budget?: number | string;
  };
  languageProgramPreference?: {
    preferredProgramType?: string;
    preferredCountry?: string;
    duration?: string;
    weekCount?: string;
    startDate?: string;
    notes?: string;
  };
  highSchoolProgramPreference?: {
    preferredProgramType?: string;
    preferredCountry?: string;
    schoolType?: string;
    duration?: string;
    notes?: string;
  };
  // 6. Bütçe Aralığı
  budget: {
    range?: string; // 0-6000, 6000-12000 etc.
    ranges?: string[]; // Multiple budget ranges
  };
  // 7. Vatandaşlık & Pasaport
  citizenship?: {
    isTurkishCitizen?: boolean;
    hasGreenPassport?: boolean;
    hasBlackPassport?: boolean;
    hasResidencePermit?: boolean;
    residencePermitNote?: string;
    hasForeignCitizenship?: boolean;
    foreignCitizenshipNote?: string;
    notes?: string;
  };
  documents?: StudentDocument[];
}

export interface StudentDocument {
  id: string;
  studentId?: string;
  documentTypeId?: string;
  groupId?: string; // Legacy analysis.documents grouping only
  type: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  version?: number;
  status?: 'uploaded' | 'approved' | 'rejected' | 'archived';
  archivedAt?: string;
  activeShare?: {
    id: string;
    expiresAt: string;
    maxViews: number | null;
    viewCount: number;
  };
  // Legacy fields are read-only compatibility for analysis.documents.
  url?: string;
  fileName?: string;
  storagePath?: string;
  uploadedAt: string;
  expiryDate?: string; // ISO Date string YYYY-MM-DD
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string; // Now optional in form, but kept as string in type (can be empty)
  phone: string;
  dob?: string; // Date of birth
  reminderDate?: string;

  // Education Details
  educationStatus?: 'Primary' | 'High School' | 'University' | 'Master' | 'Graduate';
  currentGrade?: string;
  schoolName?: string;

  // Parent Details
  parentInfo?: ParentInfo;
  parent2Info?: ParentInfo;

  // Citizenship & Passport
  hasForeignCitizenship?: boolean;
  foreignCitizenshipNote?: string;
  hasGreenPassport?: boolean;

  // Analysis Report
  analysis?: AnalysisReport;

  // Documents
  documents?: StudentDocument[];

  // System/Pipeline Fields
  pipelineStage: PipelineStage;
  gpa?: number;
  targetDegree?: 'Summer Course' | 'Language Course' | 'High School' | 'Undergraduate' | 'Master' | 'PhD';
  targetCountries: string[];
  budget: number;
  englishLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  interests: string[];
  targetPrograms: string[];
  avatarUrl?: string;
  counselorNotes?: string;

  // Assignment (stored in the legacy student_profiles.counselor_id column)
  branchId?: string;
  assignedUserId?: string;

  // Stage Specific Data
  analyseStatus?: AnalyseStatus;
  applications?: UniversityApplication[];
  visaStatus?: 'Pending' | 'Approved' | 'Rejected';
  visaApplicationDate?: string;
  visaType?: string;
  visaCountry?: string;
  visaReports?: any[];
}

export interface CareerTestResult {
  type: 'BigFive' | 'Holland';
  scores: Record<string, number>;
  summary: string;
}

// System Definitions Types
export interface EducationType {
  duration: string;
  description: string;
}

export interface VisaType {
  id: string;
  name: string;
  description: string;
}

export interface CountryData {
  id: string;
  name: string;
  flag: string;
  imageUrl?: string;
  capital: string;
  currency: string;
  educationSystemDescription: string;

  // Detailed Fields
  bachelorTypes: EducationType[];
  masterTypes: EducationType[];

  postGradWorkPermit: string;
  studentWorkPermit: string;
  yksRequirement: string;

  population: string;
  popularSectors: string;

  generalApplicationRequirements: string;
  examRequirements: string;
  foundationRequirements: string;
  
  visaTypes?: VisaType[]; 
}

export interface UniversityProgram {
  id: string;
  type: 'Bachelor' | 'Master';
  name: string;
  groupNames: string[]; // Refs to MainDegreeData.name (Selection from Bölüm Tanımları)
  matched_departments?: string[];
  educationType?: string;
  link: string;
  tuitionRange: string; // Refs to tuition options (Eğitim Bütçesi)
  campusLocation: string;
  applicationCriteria: string;
  languageScore: string;
  notes: string;
}

export interface UniversityProgramData {
    id: string;
    universityId: string;
    universityName?: string;
    type: 'Bachelor' | 'Master';
    name: string;
    url?: string;
    mainCategoryId?: string;
    mainCategoryName?: string;
    mainCategory2Id?: string;
    mainCategory2Name?: string;
    mainCategory3Id?: string;
    mainCategory3Name?: string;
    mainDegreeId?: string;
    mainDegreeName?: string;
    mainDegree2Id?: string;
    mainDegree2Name?: string;
    mainDegree3Id?: string;
    mainDegree3Name?: string;
    language?: string;
    tuitionRange?: string;
    created_at?: string;
}

export interface SharedInstitutionData {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  authorizedPerson?: string;
  description?: string;
  contactName?: string;
  contactInfo?: string;
}

export interface UniversityData {
  id: string;
  name: string;
  logo: string;
  countries: string[];
  rankingUrl?: string;
  websiteUrl: string;
  departmentsUrl: string;
  parserProfile?: string;
  tuitionRange?: string;
  consultingType?: string;
  universityTypes?: string[];
  sharedInstitutionId?: string;
  programs?: UniversityProgram[];
}
export interface MainCategoryData {
  id: string;
  name: string;
  description?: string;
}

export interface MainDegreeData {
  id: string;
  name: string;
  description: string;
  careerOpportunities: string;
  aiImpact: string;
  topCompanies: string;
  sectorStatusTR: string;
  imageUrl: string;
  categoryIds?: string[]; // Multiple categories (Many-to-Many)
}

export interface InterestedProgramData {
  id: string;
  name: string;
  description: string;
}

export interface SubProgramData {
  id: string;
  name: string;
  parentProgramId: string;
  parentProgramName?: string;
  description?: string;
  sortOrder?: number;
}
