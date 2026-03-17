
import React, { useState, useEffect } from 'react';
import { studentService } from '../services/studentService';
import { systemService } from '../services/systemService';
import { Student, PipelineStage, AnalysisReport, ExamDetails } from '../types';
import { 
  Search, Plus, Filter, ChevronRight, X, ChevronDown, ChevronUp, 
  User, Phone, Mail, Calendar, School, Users, Globe, FileCheck, 
  ClipboardList, Save, CheckCircle, AlertCircle, Trash2, Sparkles,
  GraduationCap, BookOpen, Coins, Activity, BrainCircuit
} from 'lucide-react';

interface StudentListProps {
  onSelectStudent: (student: Student) => void;
}

const PROGRAM_OPTIONS = [
  "Mühendislik", "Tıp", "Hukuk", "İşletme & Ekonomi", 
  "Psikoloji", "Mimarlık", "Sanat & Tasarım", 
  "Bilgisayar Bilimleri", "Sosyal Bilimler", "Diğer"
];

const COUNTRY_OPTIONS = [
  "Amerika Birleşik Devletleri", "Birleşik Krallık", "Kanada", 
  "Almanya", "Hollanda", "İtalya", "Fransa", "Avustralya", "İrlanda", "Diğer"
];

const getFlagEmoji = (countryName: string) => {
  const flags: Record<string, string> = {
    "Amerika Birleşik Devletleri": "🇺🇸",
    "USA": "🇺🇸",
    "United States": "🇺🇸",
    "Birleşik Krallık": "🇬🇧",
    "UK": "🇬🇧",
    "United Kingdom": "🇬🇧",
    "Kanada": "🇨🇦",
    "Canada": "🇨🇦",
    "Almanya": "🇩🇪",
    "Germany": "🇩🇪",
    "Hollanda": "🇳🇱",
    "Netherlands": "🇳🇱",
    "İtalya": "🇮🇹",
    "Italy": "🇮🇹",
    "Fransa": "🇫🇷",
    "France": "🇫🇷",
    "Avustralya": "🇦🇺",
    "Australia": "🇦🇺",
    "İrlanda": "🇮🇪",
    "Ireland": "🇮🇪"
  };
  return flags[countryName] || "🏳️";
};

const StudentList: React.FC<StudentListProps> = ({ onSelectStudent }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Tuition Ranges State
  const [tuitionRanges, setTuitionRanges] = useState<string[]>([]);

  // Analysis Modal State
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedStudentForAnalysis, setSelectedStudentForAnalysis] = useState<Student | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<string>('language');
  const [analysisForm, setAnalysisForm] = useState<AnalysisReport>({
    language: {},
    academic: { exams: {} },
    social: {},
    preferences: {},
    budget: {}
  });
  
  // GPA Validation State
  const [gpaScale, setGpaScale] = useState<'100' | '4.0'>('100');
  const [gpaError, setGpaError] = useState<string>('');
  
  // State for root student fields edited in Analysis
  const [studentAcademicInfo, setStudentAcademicInfo] = useState({
    schoolName: '',
    currentGrade: '',
    educationStatus: ''
  });

  const [showParentInfo, setShowParentInfo] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState<string>('');

  // Form State for New Student
  const [formData, setFormData] = useState<Partial<Student>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    educationStatus: undefined,
    currentGrade: '',
    schoolName: '',
    hasForeignCitizenship: false,
    foreignCitizenshipNote: '',
    hasGreenPassport: false,
    parentInfo: {
      fullName: '',
      relationship: '',
      phone: '',
      email: ''
    }
  });

  useEffect(() => {
    loadStudents();
    loadTuitionRanges();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
        const data = await studentService.getAll();
        setStudents(data);
    } catch (error: any) {
        const msg = error?.message || JSON.stringify(error);
        console.error("Failed to load students:", msg);
    } finally {
        setIsLoading(false);
    }
  };

  const loadTuitionRanges = async () => {
      try {
          const ranges = await systemService.getTuitionRanges();
          setTuitionRanges(ranges);
      } catch (error) {
          console.error("Failed to load tuition ranges", error);
      }
  };

  // Update age when DOB changes
  useEffect(() => {
    if (formData.dob) {
      const birthDate = new Date(formData.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setCalculatedAge(age.toString());
    } else {
      setCalculatedAge('');
    }
  }, [formData.dob]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const newStudentPayload: Partial<Student> = {
            ...formData,
            pipelineStage: PipelineStage.FOLLOW,
            targetCountries: [],
            interests: [],
            budget: 0,
            analysis: {
                language: {},
                academic: { exams: {} },
                social: {},
                preferences: {},
                budget: {}
            }
        };

        const createdStudent = await studentService.create(newStudentPayload);
        setStudents(prev => [createdStudent, ...prev]);
        setIsModalOpen(false);
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            dob: '',
            parentInfo: { fullName: '', relationship: '', phone: '', email: '' }
        });
    } catch (error: any) {
        const msg = error?.message || JSON.stringify(error);
        console.error("Error creating student:", msg);
        alert(`Failed to create student. Error: ${msg}`);
    }
  };

  const openAnalysisModal = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudentForAnalysis(student);
    setAnalysisForm({
        language: student.analysis?.language || {},
        academic: student.analysis?.academic || { exams: {} },
        social: student.analysis?.social || {},
        preferences: student.analysis?.preferences || {},
        budget: student.analysis?.budget || {}
    });
    setStudentAcademicInfo({
        schoolName: student.schoolName || '',
        currentGrade: student.currentGrade || '',
        educationStatus: student.educationStatus || ''
    });

    // Determine initial GPA scale
    const currentGpa = student.analysis?.academic?.gpa;
    if (currentGpa) {
        const num = parseFloat(currentGpa);
        // Heuristic: if <= 4.0 and > 0, assume 4.0 scale
        if (!isNaN(num) && num <= 4.0 && num > 0) {
            setGpaScale('4.0');
        } else {
            setGpaScale('100');
        }
    } else {
        setGpaScale('100');
    }
    setGpaError('');

    setIsAnalysisModalOpen(true);
  };

  const saveAnalysis = async () => {
    if (!selectedStudentForAnalysis) return;
    
    // Do not save if there is a validation error
    if (gpaError) {
      alert("Lütfen hatalı alanları düzeltiniz.");
      return;
    }

    const updatedData: Partial<Student> = {
        schoolName: studentAcademicInfo.schoolName,
        currentGrade: studentAcademicInfo.currentGrade,
        educationStatus: studentAcademicInfo.educationStatus as any,
        analysis: analysisForm 
    };

    try {
        // Optimistic update
        const updatedStudents = students.map(s => 
            s.id === selectedStudentForAnalysis.id ? { ...s, ...updatedData } : s
        );
        setStudents(updatedStudents);
        setIsAnalysisModalOpen(false);

        // DB Update
        await studentService.update(selectedStudentForAnalysis.id, updatedData);
    } catch (error: any) {
        console.error("Error saving analysis:", error);
        alert(`Failed to save analysis: ${error.message || "Unknown error"}`);
        // Revert or alert in real app
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(window.confirm("Are you sure you want to delete this student?")) {
          try {
              await studentService.delete(id);
              setStudents(prev => prev.filter(s => s.id !== id));
          } catch (err: any) {
              console.error("Error deleting student", err);
              alert(`Failed to delete student: ${err.message || "Unknown error"}`);
          }
      }
  }

  const updateAnalysisField = (section: keyof AnalysisReport, field: string, value: any) => {
    setAnalysisForm(prev => ({
        ...prev,
        [section]: {
            ...(prev as any)[section],
            [field]: value
        }
    }));
  };

  const updateNestedExam = (key: string, field: string, value: any) => {
    setAnalysisForm(prev => {
      const currentExams = prev.academic.exams || {};
      return {
        ...prev,
        academic: {
          ...prev.academic,
          exams: {
            ...currentExams,
            [key]: {
              ...currentExams[key],
              [field]: value
            }
          }
        }
      };
    });
  };

  const handleGpaChange = (value: string) => {
    setGpaError('');
    updateAnalysisField('academic', 'gpa', value);

    if (!value) return;

    const num = parseFloat(value);
    if (gpaScale === '100') {
        if (num < 0 || num > 100) {
            setGpaError('0 - 100 arasında geçerli bir değer giriniz.');
        }
    } else {
        if (num < 0 || num > 4.0) {
            setGpaError('0 - 4.00 arasında geçerli bir değer giriniz.');
        }
    }
  };

  const renderLanguageTab = () => (
    <div className="space-y-6 animate-fade-in">
        {/* Exam Taken? */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Sınav Durumu</h4>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-slate-600 mb-2">Dil seviyeni belirleyecek bir sınava girdin mi?</label>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => updateAnalysisField('language', 'hasTakenExam', true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${analysisForm.language.hasTakenExam === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Evet, Girdim
                        </button>
                        <button 
                            onClick={() => updateAnalysisField('language', 'hasTakenExam', false)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${analysisForm.language.hasTakenExam === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Hayır, Girmedim
                        </button>
                    </div>
                </div>

                {analysisForm.language.hasTakenExam && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">Sınav Skoru / Detayı</label>
                            <input 
                                type="text"
                                value={analysisForm.language.examScore || ''}
                                onChange={(e) => updateAnalysisField('language', 'examScore', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                placeholder="Örn: IELTS 6.5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">Sınav Tarihi</label>
                            <input 
                                type="date"
                                value={analysisForm.language.pastExamDate || ''}
                                onChange={(e) => updateAnalysisField('language', 'pastExamDate', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                    </div>
                )}

                {analysisForm.language.hasTakenExam === false && (
                     <div>
                        <label className="block text-sm text-slate-600 mb-1">Tahmini İngilizce Seviyen Nedir?</label>
                        <select 
                            value={analysisForm.language.estimatedLevel || ''}
                            onChange={(e) => updateAnalysisField('language', 'estimatedLevel', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            <option value="A1">A1 - Başlangıç</option>
                            <option value="A2">A2 - Temel</option>
                            <option value="B1">B1 - Orta</option>
                            <option value="B2">B2 - İyi</option>
                            <option value="C1">C1 - İleri</option>
                            <option value="C2">C2 - Yetkin</option>
                            <option value="Unknown">Seviyemi Bilmiyorum</option>
                        </select>
                    </div>
                )}
            </div>
        </div>

        {/* Preparation */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h4 className="text-sm font-semibold text-slate-700 mb-3">Sınav Hazırlığı</h4>
             <div className="space-y-4">
                 <div>
                    <label className="block text-sm text-slate-600 mb-2">
                        {analysisForm.language.hasTakenExam ? "Tekrar Sınava girecek misin?" : "Hazırlandığın bir dil sınavı var mı?"}
                    </label>
                    <div className="flex gap-4">
                         <button 
                            onClick={() => updateAnalysisField('language', 'isPreparingForExam', true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${analysisForm.language.isPreparingForExam === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Evet
                        </button>
                        <button 
                            onClick={() => updateAnalysisField('language', 'isPreparingForExam', false)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${analysisForm.language.isPreparingForExam === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Hayır
                        </button>
                    </div>
                 </div>

                 {analysisForm.language.isPreparingForExam && (
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm text-slate-600 mb-1">Hedeflenen Sınav</label>
                            <input 
                                type="text"
                                value={analysisForm.language.targetExam || ''}
                                onChange={(e) => updateAnalysisField('language', 'targetExam', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                placeholder="Örn: IELTS UKVI"
                            />
                         </div>
                         <div>
                            <label className="block text-sm text-slate-600 mb-1">Planlanan Tarih</label>
                            <input 
                                type="date"
                                value={analysisForm.language.examDate || ''}
                                onChange={(e) => updateAnalysisField('language', 'examDate', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                         </div>
                     </div>
                 )}
             </div>
        </div>

        {/* Tutoring & Support */}
        {!(analysisForm.language.hasTakenExam === true && analysisForm.language.isPreparingForExam === false) && (
            <div className="bg-violet-50 p-6 rounded-xl border border-violet-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-100 rounded-bl-full opacity-50 -mr-8 -mt-8"></div>
                <div className="relative z-10 flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-violet-600 mt-1">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <label className="block text-base font-semibold text-violet-900 mb-3 leading-tight">
                            Deneme Sınavına Katılmak ve Özel Ders hakkında bilgi almak ister misin?
                        </label>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => updateAnalysisField('language', 'wantsTutoring', true)}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    analysisForm.language.wantsTutoring === true 
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-200 scale-105' 
                                    : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-100'
                                }`}
                            >
                                Evet, İstiyorum
                            </button>
                            <button 
                                onClick={() => updateAnalysisField('language', 'wantsTutoring', false)}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    analysisForm.language.wantsTutoring === false 
                                    ? 'bg-slate-600 text-white' 
                                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                Hayır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Language Notes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-400" />
                Dil Yeterliliği Notları
             </label>
             <textarea 
                value={analysisForm.language.languageNotes || ''}
                onChange={(e) => updateAnalysisField('language', 'languageNotes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[100px] resize-y"
                placeholder="Bu öğrencinin dil durumu ile ilgili ek notlar..."
             />
        </div>
    </div>
  );

  const renderAcademicTab = () => {
    const getGradeOptions = () => {
        switch(studentAcademicInfo.educationStatus) {
          case 'Primary':
              return ['1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', '5. Sınıf', '6. Sınıf', '7. Sınıf', '8. Sınıf'];
          case 'High School':
              return ['Hazırlık', '9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Mezun'];
          case 'University':
              return ['Hazırlık', '1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', 'Uzatmalı', 'Mezun'];
          case 'Master':
               return ['Ders Dönemi', 'Tez Dönemi', 'Mezun'];
          case 'Graduate':
               return ['Mezun'];
          default:
               return [];
        }
      };

      // Helper to toggle exam selection
      const toggleExam = (key: string) => {
        const currentExams = analysisForm.academic.exams || {};
        const isSelected = currentExams[key]?.selected;
        updateNestedExam(key, 'selected', !isSelected);
      };

    return (
    <div className="space-y-6 animate-fade-in">
         {/* School Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Okul Bilgileri</h4>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-slate-600 mb-1">Okul Adı</label>
                    <input 
                        type="text"
                        value={studentAcademicInfo.schoolName}
                        onChange={(e) => setStudentAcademicInfo(prev => ({ ...prev, schoolName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        placeholder="Örn: Robert Koleji"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Mevcut Eğitimi</label>
                         <select 
                            value={studentAcademicInfo.educationStatus}
                            onChange={(e) => setStudentAcademicInfo(prev => ({ 
                                ...prev, 
                                educationStatus: e.target.value, 
                                currentGrade: '' 
                            }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            <option value="Primary">İlköğretim</option>
                            <option value="High School">Lise</option>
                            <option value="University">Üniversite</option>
                            <option value="Master">Yüksek Lisans</option>
                            <option value="Graduate">Mezun</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Sınıfı</label>
                         <select 
                            value={studentAcademicInfo.currentGrade}
                            onChange={(e) => setStudentAcademicInfo(prev => ({ ...prev, currentGrade: e.target.value }))}
                            disabled={!studentAcademicInfo.educationStatus}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                        >
                            <option value="">Seçiniz</option>
                            {getGradeOptions().map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Dynamic Field/Department Input */}
                {studentAcademicInfo.educationStatus === 'High School' && (
                     <div>
                        <label className="block text-sm text-slate-600 mb-1">Bölümü (Alan)</label>
                        <select 
                            value={analysisForm.academic.educationField || ''}
                            onChange={(e) => updateAnalysisField('academic', 'educationField', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            <option value="Sayısal">Sayısal</option>
                            <option value="Eşit Ağırlıklı">Eşit Ağırlıklı</option>
                            <option value="Dil">Dil</option>
                            <option value="IB">IB</option>
                        </select>
                    </div>
                )}

                {(studentAcademicInfo.educationStatus === 'University' || studentAcademicInfo.educationStatus === 'Master' || studentAcademicInfo.educationStatus === 'Graduate') && (
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Bölümü / Programı</label>
                         <input 
                            type="text"
                            value={analysisForm.academic.educationField || ''}
                            onChange={(e) => updateAnalysisField('academic', 'educationField', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            placeholder="Örn: Bilgisayar Mühendisliği"
                        />
                    </div>
                )}
            </div>
        </div>

        {/* Academic Success */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Akademik Başarı</h4>
            
            <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${gpaScale === '100' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                        {gpaScale === '100' && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                    </div>
                    <input 
                        type="radio" 
                        name="gpaScale" 
                        value="100" 
                        checked={gpaScale === '100'} 
                        onChange={() => { setGpaScale('100'); setGpaError(''); }}
                        className="hidden"
                    />
                    <span className={`text-sm ${gpaScale === '100' ? 'text-indigo-700 font-medium' : 'text-slate-600'}`}>100'lük Sistem</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                     <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${gpaScale === '4.0' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                        {gpaScale === '4.0' && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                    </div>
                    <input 
                        type="radio" 
                        name="gpaScale" 
                        value="4.0" 
                        checked={gpaScale === '4.0'} 
                        onChange={() => { setGpaScale('4.0'); setGpaError(''); }}
                        className="hidden"
                    />
                    <span className={`text-sm ${gpaScale === '4.0' ? 'text-indigo-700 font-medium' : 'text-slate-600'}`}>4.0'lık Sistem</span>
                </label>
            </div>

            <div>
                <label className="block text-sm text-slate-600 mb-1">Mevcut Not Ortalaması</label>
                <div className="relative">
                    <input 
                        type="number"
                        step={gpaScale === '4.0' ? "0.01" : "1"}
                        value={analysisForm.academic.gpa || ''}
                        onChange={(e) => handleGpaChange(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${gpaError ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-500/20'} focus:outline-none focus:ring-2 text-sm`}
                        placeholder={gpaScale === '100' ? "Örn: 85" : "Örn: 3.50"}
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 bg-white px-1">
                        {gpaScale === '100' ? '100 üzerinden' : '4.00 üzerinden'}
                    </span>
                </div>
                {gpaError && (
                    <div className="flex items-center gap-1 mt-1.5 text-red-500">
                        <AlertCircle className="w-3 h-3" />
                        <span className="text-xs font-medium">{gpaError}</span>
                    </div>
                )}
            </div>
        </div>

        {/* Exam Selections */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h4 className="text-sm font-semibold text-slate-700 mb-1">Girdiğin veya gireceğin sınavları ekle</h4>
             <p className="text-xs text-slate-400 mb-3">Örn: SAT, AP</p>
             <div className="grid grid-cols-2 gap-3 mb-4">
                {['SAT', 'AP', 'IB', 'A-Level', 'TR-YOS'].map(exam => {
                    const exams = analysisForm.academic.exams as Record<string, ExamDetails> | undefined;
                    const isSelected = exams?.[exam]?.selected;
                    return (
                        <button
                            key={exam}
                            onClick={() => toggleExam(exam)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                                isSelected 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                        >
                            {isSelected && <CheckCircle className="inline w-3 h-3 mr-1" />}
                            {exam}
                        </button>
                    )
                })}
             </div>

             {/* Exam Details Inputs */}
             <div className="space-y-4">
                {Object.entries(analysisForm.academic.exams as Record<string, ExamDetails>).map(([key, details]) => {
                    if (!details.selected) return null;
                    return (
                        <div key={key} className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fade-in">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="font-bold text-sm text-slate-700">{key} Detayları</h5>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Durum</label>
                                    <select 
                                        value={details.status || ''}
                                        onChange={(e) => updateNestedExam(key, 'status', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                    >
                                        <option value="">Seçiniz</option>
                                        <option value="Taken">Girdim</option>
                                        <option value="Preparing">Hazırlanıyorum</option>
                                    </select>
                                </div>
                                {details.status === 'Taken' && (
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Skor</label>
                                        <input 
                                            type="text" 
                                            value={details.score || ''}
                                            onChange={(e) => updateNestedExam(key, 'score', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm rounded border border-slate-300" 
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Tarih</label>
                                    <input 
                                        type="date" 
                                        value={details.date || ''}
                                        onChange={(e) => updateNestedExam(key, 'date', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300" 
                                    />
                                </div>
                                {key === 'AP' && (
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-500 mb-1">Ders(ler)</label>
                                        <input 
                                            type="text" 
                                            value={details.subject || ''}
                                            onChange={(e) => updateNestedExam(key, 'subject', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm rounded border border-slate-300" 
                                            placeholder="Calculus BC, Physics C..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
             </div>
        </div>

        {/* Academic Notes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-400" />
                Akademik Notlar
             </label>
             <textarea 
                value={analysisForm.academic.academicNotes || ''}
                onChange={(e) => updateAnalysisField('academic', 'academicNotes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[80px] resize-y"
                placeholder="Akademik durumu ile ilgili ek notlar..."
             />
        </div>
    </div>
  )};

   const renderPreferencesTab = () => (
      <div className="space-y-6 animate-fade-in">
           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h4 className="text-sm font-semibold text-slate-700 mb-3">Bölüm Tercihleri</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">1. Tercih</label>
                        <select 
                            value={analysisForm.preferences.program1 || ''}
                            onChange={(e) => updateAnalysisField('preferences', 'program1', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            {PROGRAM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">2. Tercih</label>
                         <select 
                            value={analysisForm.preferences.program2 || ''}
                            onChange={(e) => updateAnalysisField('preferences', 'program2', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            {PROGRAM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
               </div>
           </div>

           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h4 className="text-sm font-semibold text-slate-700 mb-3">Ülke Tercihleri</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i}>
                            <label className="block text-sm text-slate-600 mb-1">{i}. Ülke</label>
                            <select 
                                value={(analysisForm.preferences as any)[`country${i}`] || ''}
                                onChange={(e) => updateAnalysisField('preferences', `country${i}`, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            >
                                <option value="">Seçiniz</option>
                                {COUNTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
               </div>
           </div>
      </div>
   );

  const renderSocialTab = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                   <Users className="w-4 h-4 text-indigo-500" />
                   Sosyal & Dışı Faaliyetler
               </h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                               <Activity className="w-3.5 h-3.5 text-slate-400" />
                               Spor Faaliyetleri
                           </label>
                           <input 
                                type="text"
                                value={analysisForm.social.sports || ''}
                                onChange={(e) => updateAnalysisField('social', 'sports', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                placeholder="Lisanslı sporcu mu? Branş?"
                            />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                               <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                               Sanat / Müzik
                           </label>
                           <input 
                                type="text"
                                value={analysisForm.social.arts || ''}
                                onChange={(e) => updateAnalysisField('social', 'arts', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                placeholder="Enstrüman, Resim vb."
                            />
                       </div>
                   </div>
                   <div className="space-y-4">
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                               <Globe className="w-3.5 h-3.5 text-slate-400" />
                               Sosyal Sorumluluk
                           </label>
                           <input 
                                type="text"
                                value={analysisForm.social.socialWork || ''}
                                onChange={(e) => updateAnalysisField('social', 'socialWork', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                placeholder="Gönüllülük projeleri"
                            />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                               <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                               Projeler / Sertifikalar
                           </label>
                           <textarea 
                                value={analysisForm.social.projects || ''}
                                onChange={(e) => updateAnalysisField('social', 'projects', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none h-[88px]"
                                placeholder="TÜBİTAK, Erasmus vb."
                            />
                       </div>
                   </div>
               </div>
          </div>
      </div>
  );

  const renderBudgetTab = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                 <Coins className="w-4 h-4 text-emerald-500" />
                 Yıllık Eğitim Bütçesi (Yaşam Hariç)
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tuitionRanges.length > 0 ? tuitionRanges.map((option) => (
                    <label key={option} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                        analysisForm.budget.range === option 
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            analysisForm.budget.range === option ? 'border-emerald-600' : 'border-slate-300'
                        }`}>
                            {analysisForm.budget.range === option && <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full" />}
                        </div>
                        <input
                            type="radio"
                            name="budget_range"
                            value={option}
                            checked={analysisForm.budget.range === option}
                            onChange={(e) => updateAnalysisField('budget', 'range', e.target.value)}
                            className="hidden"
                        />
                        <span className={`text-sm font-medium ${analysisForm.budget.range === option ? 'text-emerald-900' : 'text-slate-700'}`}>
                            {option}
                        </span>
                    </label>
                )) : (
                    <div className="col-span-2 flex items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 italic text-sm">
                        Bütçe aralıkları yükleniyor...
                    </div>
                )}
             </div>
             <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                 <div>
                     <p className="text-sm font-semibold text-amber-900">Bütçe Hakkında Not</p>
                     <p className="text-xs text-amber-700 mt-1">
                         Belirtilen bütçe aralıkları sadece yıllık eğitim ücretini (tuition) kapsamaktadır. 
                         Konaklama, yemek ve diğer yaşam giderleri bu tutarlara dahil değildir.
                     </p>
                 </div>
             </div>
        </div>
    </div>
  );

  // Filter logic
  const [searchQuery, setSearchQuery] = useState('');
  const filteredStudents = students.filter(student => {
    const searchLower = searchQuery.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower) ||
      student.phone.includes(searchQuery)
    );
  });

  if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse">Öğrenci listesi yükleniyor...</p>
        </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="İsim, e-posta veya telefon ile ara..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Student
          </button>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200 bg-slate-50/50">
              <th className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider">Student Name</th>
              <th className="py-4 font-semibold text-xs uppercase tracking-wider">Stage</th>
              <th className="py-4 font-semibold text-xs uppercase tracking-wider">Interested</th>
              <th className="py-4 font-semibold text-xs uppercase tracking-wider">Education</th>
              <th className="py-4 pr-6 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.map((student) => (
              <tr 
                key={student.id} 
                className="group hover:bg-indigo-50/30 transition-all cursor-pointer"
                onClick={() => onSelectStudent(student)}
              >
                <td className="py-4 pl-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-200">
                      {student.avatarUrl ? (
                        <img src={student.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{student.firstName[0]}{student.lastName[0]}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{student.firstName} {student.lastName}</p>
                      <div className="flex flex-col gap-0.5 mt-1">
                         <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3 h-3" /> {student.phone}
                         </p>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    student.pipelineStage === PipelineStage.FOLLOW ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    student.pipelineStage === PipelineStage.ANALYSE ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                    student.pipelineStage === PipelineStage.PROCESS ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    student.pipelineStage === PipelineStage.ENROLLMENT ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    student.pipelineStage === PipelineStage.STUDENT ? 'bg-violet-50 text-violet-600 border-violet-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {student.pipelineStage}
                  </span>
                </td>
                {/* Interested Column - Countries & Programs */}
                <td className="py-4">
                   <div className="flex flex-col gap-2">
                       {/* Countries */}
                       {(student.targetCountries?.length > 0 || student.analysis?.preferences?.country1) && (
                           <div className="flex flex-wrap gap-1">
                                {(student.analysis?.preferences?.country1 ? [
                                    student.analysis.preferences.country1,
                                    student.analysis.preferences.country2,
                                    student.analysis.preferences.country3
                                ].filter(Boolean) : student.targetCountries).slice(0, 2).map((country, i) => (
                                   <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                      <span className="mr-1">{getFlagEmoji(country)}</span> {country}
                                   </span>
                                ))}
                           </div>
                       )}
                       
                       {/* Programs */}
                       {(student.interests?.length > 0 || student.analysis?.preferences?.program1) && (
                           <div className="text-xs text-slate-600 font-medium">
                               {student.analysis?.preferences?.program1 || student.interests[0]}
                               {student.analysis?.preferences?.program2 && <span className="text-slate-400">, {student.analysis.preferences.program2}</span>}
                           </div>
                       )}

                       {(!student.targetCountries?.length && !student.analysis?.preferences?.country1 && !student.interests?.length && !student.analysis?.preferences?.program1) && (
                           <span className="text-xs text-slate-400 italic">Henüz tercih girilmedi</span>
                       )}
                   </div>
                </td>
                {/* Education Column */}
                <td className="py-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{student.schoolName || '-'}</span>
                        <span className="text-xs text-slate-500">
                            {student.educationStatus ? `${student.educationStatus}` : ''}
                            {student.currentGrade ? ` • ${student.currentGrade}` : ''}
                        </span>
                    </div>
                </td>
                <td className="py-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={(e) => openAnalysisModal(student, e)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                            title="Analysis"
                        >
                            <ClipboardList className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => handleDelete(e, student.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                         <ChevronRight className="w-4 h-4 text-slate-300 ml-2" />
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredStudents.length === 0 && (
            <div className="p-10 text-center text-slate-500 bg-slate-50">
                <p>No students found matching your criteria.</p>
            </div>
        )}
      </div>

      {/* Add Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-800">Add New Student</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              {/* Personal Info Section */}
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Kişisel Bilgiler
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Adı</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        required
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="Örn: Ahmet"
                        className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Soyadı</label>
                    <input
                      required
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Örn: Yılmaz"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">E-posta</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="ahmet@example.com"
                        className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefon</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+90 5xx xxx xx xx"
                        className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Doğum Tarihi</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                      />
                    </div>
                    {calculatedAge && <p className="text-xs text-indigo-600 font-medium mt-1.5 ml-1">Yaş: {calculatedAge}</p>}
                  </div>
                </div>
              </div>

              {/* Education Section */}
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Eğitim Bilgileri
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Eğitim Durumu</label>
                        <select
                            name="educationStatus"
                            value={formData.educationStatus || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                        >
                            <option value="">Seçiniz</option>
                            <option value="High School">Lise</option>
                            <option value="University">Üniversite</option>
                            <option value="Master">Yüksek Lisans</option>
                            <option value="Graduate">Mezun</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Okul Adı</label>
                        <div className="relative">
                          <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                              name="schoolName"
                              value={formData.schoolName}
                              onChange={handleInputChange}
                              className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
                              placeholder="Örn: Robert Koleji"
                          />
                        </div>
                    </div>
                </div>
              </div>
              
              {/* Parent Info Toggle */}
              <div>
                  <button 
                    type="button"
                    onClick={() => setShowParentInfo(!showParentInfo)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                      {showParentInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showParentInfo ? 'Hide Parent Information' : 'Add Parent Information'}
                  </button>
                  
                  {showParentInfo && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Name</label>
                            <input
                                name="parentInfo.fullName"
                                value={formData.parentInfo?.fullName}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
                            <input
                                name="parentInfo.relationship"
                                value={formData.parentInfo?.relationship}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Mother, Father, etc."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Phone</label>
                            <input
                                name="parentInfo.phone"
                                value={formData.parentInfo?.phone}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Email</label>
                            <input
                                name="parentInfo.email"
                                value={formData.parentInfo?.email}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                      </div>
                  )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white pb-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all"
                >
                  Create Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {isAnalysisModalOpen && selectedStudentForAnalysis && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                             <BrainCircuit className="w-6 h-6" />
                         </div>
                         <div>
                             <h3 className="text-lg font-bold text-slate-800">Öğrenci Analizi</h3>
                             <p className="text-sm text-slate-500">{selectedStudentForAnalysis.firstName} {selectedStudentForAnalysis.lastName}</p>
                         </div>
                    </div>
                    <button onClick={() => setIsAnalysisModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-2 overflow-y-auto">
                        {[
                            { id: 'language', label: 'Dil Yeterliliği', icon: Globe },
                            { id: 'academic', label: 'Akademik Durum', icon: GraduationCap },
                            { id: 'preferences', label: 'Tercihler', icon: BookOpen },
                            { id: 'social', label: 'Sosyal & Spor', icon: Activity },
                            { id: 'budget', label: 'Eğitim Bütçesi', icon: Coins },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveAnalysisTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    activeAnalysisTab === tab.id 
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {activeAnalysisTab === 'language' && renderLanguageTab()}
                        {activeAnalysisTab === 'academic' && renderAcademicTab()}
                        {activeAnalysisTab === 'preferences' && renderPreferencesTab()}
                        {activeAnalysisTab === 'social' && renderSocialTab()}
                        {activeAnalysisTab === 'budget' && renderBudgetTab()}
                    </div>
                </div>

                <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-center">
                    <div className="text-xs text-slate-400">
                        Last saved: Just now
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsAnalysisModalOpen(false)}
                            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            Vazgeç
                        </button>
                        <button 
                            onClick={saveAnalysis}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Analizi Kaydet
                        </button>
                    </div>
                </div>
             </div>
        </div>
      )}

    </div>
  );
};

export default StudentList;
