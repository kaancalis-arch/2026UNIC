
export enum PipelineStage {
  FOLLOW = 'Follow',
  ANALYSE = 'Analyse',
  PROCESS = 'Process',
  ENROLLMENT = 'Enrollment',
  STUDENT = 'Student',
  NOT_INTERESTED = 'Not Interested'
}

export type AnalyseStatus = 'Mid' | 'Hot' | 'Super Hot';

export type ApplicationStatus = 'Başvuru Aşamasında' | 'Sonuç Bekleniyor' | 'Şartlı Kabul' | 'Kabul' | 'Red';

export interface UniversityApplication {
  id: string;
  universityName: string;
  programName: string;
  status: ApplicationStatus;
  notes?: string;
}

export enum UserRole {
  ADMIN = 'Admin',
  CONSULTANT = 'Consultant',
  REPRESENTATIVE = 'Representative',
  STUDENT = 'Student'
}

export interface SystemUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  parentId?: string; // ID of the consultant (if Representative) or Admin (if Consultant)
  phone?: string;
}

export interface ParentInfo {
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface ExamDetails {
  selected: boolean;
  status?: 'Taken' | 'Preparing';
  score?: string;
  date?: string;
  subject?: string; // Only for AP
}

export interface AnalysisReport {
  // 1. Dil Yeterliliği
  language: {
    hasTakenExam?: boolean; // Dil seviyeni belirleyecek bir sınava girdin mi?
    examScore?: string; // If yes, score/details
    pastExamDate?: string; // Sınava girdiği tarih
    estimatedLevel?: string; // Tahmini İngilizce Seviyen Nedir? (A1-C2, Unknown)
    isPreparingForExam?: boolean; // Hazırlandığın bir dil sınavı var mı? OR Tekrar Sınava girecek misin?
    targetExam?: string; // e.g., IELTS UKVI
    examDate?: string; // Ne zaman sınava girmeyi planlıyorsun? (Future)
    wantsTutoring?: boolean; // Deneme Sınavına Katılmak ve Özel Ders hakkında bilgi almak ister misin?
    languageNotes?: string; // Bu aşamaya bir not kutucuğu ekle
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
    program1?: string;
    program2?: string;
    country1?: string;
    country2?: string;
    country3?: string;
    country4?: string;
    country5?: string;
  };
  // 6. Bütçe Aralığı
  budget: {
    range?: string; // 0-6000, 6000-12000 etc.
  };
}

export interface StudentDocument {
  id: string; // e.g., 'passport', 'transcript'
  type: string; // Display name
  url?: string;
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
  
  // Education Details
  educationStatus?: 'Primary' | 'High School' | 'University' | 'Master' | 'Graduate';
  currentGrade?: string;
  schoolName?: string;
  
  // Parent Details
  parentInfo?: ParentInfo;

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
  targetDegree?: 'Summer Course' | 'Language Course' | 'High School' | 'Undergraduate' | 'Master';
  targetCountries: string[];
  budget: number;
  englishLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  interests: string[];
  avatarUrl?: string;
  counselorNotes?: string;
  
  // Hierarchy
  counselorId?: string; // The ID of the Consultant managing this student
  representativeId?: string; // The ID of the Representative (if applicable)

  // Stage Specific Data
  analyseStatus?: AnalyseStatus;
  applications?: UniversityApplication[];
  visaStatus?: 'Pending' | 'Approved' | 'Rejected';
  visaApplicationDate?: string;
  visaType?: string;
  visaCountry?: string;
}

export interface AnalysisResult {
  recommendedPrograms: string[];
  visaRiskScore: number; // 0-100
  visaRiskReasoning: string;
  scholarshipProbability: number; // 0-100
  suggestedUniversities: Array<{
    name: string;
    country: string;
    matchScore: number;
    tuition: number;
  }>;
  overallAssessment: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  category: 'document' | 'application' | 'visa' | 'financial';
}

export interface CareerTestResult {
  type: 'BigFive' | 'Holland';
  scores: Record<string, number>;
  summary: string;
}

// Gemini Response Schema Types
export interface AIAnalysisResponse {
  analysis: AnalysisResult;
}

export interface AIRoadmapResponse {
  steps: RoadmapStep[];
}

// System Definitions Types
export interface EducationType {
    name: string;
    description: string;
}

export interface CountryData {
    id: string;
    name: string;
    flag: string;
    capital: string;
    currency: string;
    population: string;
    cities: string[];
    imageUrl: string;
    educationSystemDescription: string;
    
    // Detailed Fields
    bachelorTypes: EducationType[];
    masterTypes: EducationType[];
    
    postGradWorkPermit: string;
    yksRequirement: string;
    popularJobs: string[];
}

export interface UniversityData {
    id: string;
    name: string;
    logo: string;
    country: string;
    city: string;
    websiteUrl: string;
    departmentsUrl: string;
    tuitionRange: string;
}
