
import React, { useState, useMemo, useEffect } from 'react';
import { Student, AnalysisResult, RoadmapStep, ExamDetails, PipelineStage, AnalysisReport, StudentDocument, AnalyseStatus, ApplicationStatus, UniversityApplication, MainDegreeData } from '../types';
import { analyzeStudentProfile, generateStudentRoadmap, askUNIC } from '../services/geminiService';
import { studentService } from '../services/studentService';
import { systemService } from '../services/systemService';
import { interestedProgramService } from '../services/interestedProgramService';
import { mainDegreeService } from '../services/mainDegreeService';
import { countryService } from '../services/countryService';
import { universityService } from '../services/universityService';
import { getFlagEmoji, getCountryCode } from '../utils/countryUtils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { MOCK_TUITION_RANGES } from '../services/mockData';
import { 
  ArrowLeft, 
  BrainCircuit, 
  FileText, 
  Map as MapIcon, 
  Download,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertOctagon,
  Sparkles,
  User,
  GraduationCap,
  School,
  Globe,
  Activity,
  CreditCard,
  BookOpen,
  ChevronDown,
  PieChart,
  AlertCircle,
  FileWarning,
  Phone,
  Mail,
  Edit2,
  Save,
  X,
  ClipboardList,
  Calendar,
  AlertTriangle,
  Printer,
  FileDown,
  Loader2,
  Plus,
  Users,
  Coins,
  Flag,
  FileCheck
} from 'lucide-react';

interface StudentDetailProps {
  student: Student;
  onBack: () => void;
}

// Options will be loaded from services

const formatPhone = (phone: string | undefined) => {
    if (!phone) return '-';
    // Sadece sayıları al
    const cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.length === 11) {
        // Örn: 0500 123 45 67
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
    } else if (cleaned.length === 10) {
        // 500 ile başlıyorsa ve baştaki 0 eksikse
        return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
    return phone;
};

const formatExamDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear().toString().slice(-2);
    return `${d} ${m} ${y}`;
};

const isExamExpired = (dateString?: string): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return date < twoYearsAgo;
};
const StudentDetail: React.FC<StudentDetailProps> = ({ student: initialStudent, onBack }) => {
  // Local state to handle updates immediately
  const [student, setStudent] = useState<Student>(initialStudent);
  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'analysis' | 'roadmap'>('profile');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [currentStage, setCurrentStage] = useState<PipelineStage>(student.pipelineStage);
  
  // PDF Loading State
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Tuition Ranges
  const [tuitionRanges, setTuitionRanges] = useState<string[]>([]);

  // Document State
  const [studentDocuments, setStudentDocuments] = useState<StudentDocument[]>(student.documents || []);

  // Analysis Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<string>('language');
  const [editForm, setEditForm] = useState<AnalysisReport>({
    language: {},
    academic: { exams: {} },
    social: {},
    preferences: {},
    budget: {}
  });

  // GPA Validation State
  const [gpaScale, setGpaScale] = useState<'100' | '4.0'>('100');
  const [gpaError, setGpaError] = useState<string>('');
  const [editAcademicInfo, setEditAcademicInfo] = useState({
    schoolName: student.schoolName || '',
    currentGrade: student.currentGrade || '',
    educationStatus: student.educationStatus || ''
  });
  const [editContactInfo, setEditContactInfo] = useState({
      phone: student.phone || '',
      email: student.email || '',
      parentName: student.parentInfo?.fullName || '',
      parentPhone: student.parentInfo?.phone || '',
      parentEmail: student.parentInfo?.email || '',
      parent2Name: student.parent2Info?.fullName || '',
      parent2Phone: student.parent2Info?.phone || '',
      parent2Email: student.parent2Info?.email || ''
  });

  const [activeAnalyseStatus, setActiveAnalyseStatus] = useState<AnalyseStatus>(student.analyseStatus || 'Mid');
  const [showAnalyseStatus, setShowAnalyseStatus] = useState(false);
  
  // School Application State
  const [newApp, setNewApp] = useState<Partial<UniversityApplication>>({
    universityName: '',
    programName: '',
    status: 'Başvuru Aşamasında',
    notes: ''
  });
  const [showAppForm, setShowAppForm] = useState(false);
  
  // Dynamic Options
  const [allPrograms, setAllPrograms] = useState<string[]>([]);
  const [allMainDegrees, setAllMainDegrees] = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [allUniversities, setAllUniversities] = useState<any[]>([]);
  const [mainDegreeDetails, setMainDegreeDetails] = useState<MainDegreeData[]>([]);

  useEffect(() => {
    setStudent(initialStudent);
    setCurrentStage(initialStudent.pipelineStage);
    setStudentDocuments(initialStudent.documents || []);
    loadTuitionRanges();
    loadOptions();
  }, [initialStudent]);

  const loadOptions = async () => {
    try {
        const [programs, mainDegs, countries, universities] = await Promise.all([
            interestedProgramService.getAll(),
            mainDegreeService.getAll(),
            countryService.getAll(),
            universityService.getAll()
        ]);
        setAllPrograms(programs.map(p => p.name));
        setAllMainDegrees(mainDegs.map(d => d.name));
        setMainDegreeDetails(mainDegs);
        setAllCountries(countries.map(c => c.name));
        setAllUniversities(universities);
    } catch (error) {
        console.error("Failed to load options", error);
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

  const handleStageChange = async (newStage: PipelineStage) => {
      // Logic for automatic stage transitions based on actions is handled in specific buttons
      // But we keep this for manual override if needed (though user asked for not manually selected)
      setCurrentStage(newStage);
      try {
        await studentService.update(student.id, { pipelineStage: newStage });
        setStudent(prev => ({ ...prev, pipelineStage: newStage }));
      } catch (e) {
        console.error("Failed to update stage", e);
      }
  };

  const handleSetAnalyseStatus = async (status: AnalyseStatus) => {
    setActiveAnalyseStatus(status);
    try {
        await studentService.update(student.id, { analyseStatus: status });
        setStudent(prev => ({ ...prev, analyseStatus: status }));
    } catch (e) {
        console.error("Failed to update analyse status", e);
    }
  };

  const handleAddApplication = async () => {
    if (!newApp.universityName || !newApp.programName) return;
    const application: UniversityApplication = {
        id: Math.random().toString(36).substr(2, 9),
        universityName: newApp.universityName!,
        programName: newApp.programName!,
        status: newApp.status as ApplicationStatus,
        notes: newApp.notes
    };
    const updatedApps = [...(student.applications || []), application];
    try {
        await studentService.update(student.id, { applications: updatedApps });
        setStudent(prev => ({ ...prev, applications: updatedApps }));
        setNewApp({ universityName: '', programName: '', status: 'Başvuru Aşamasında', notes: '' });
        setShowAppForm(false);
    } catch (e) {
        console.error("Failed to add application", e);
    }
  };

  const addSuggestedUniversityAsOffer = async (uni: { name: string, country: string }) => {
    const application: UniversityApplication = {
        id: Math.random().toString(36).substr(2, 9),
        universityName: uni.name,
        programName: student.analysis?.preferences?.program1 || 'Genel Başvuru',
        status: 'Başvuru Aşamasında',
    };
    const updatedApps = [...(student.applications || []), application];
    try {
        await studentService.update(student.id, { applications: updatedApps });
        setStudent(prev => ({ ...prev, applications: updatedApps }));
        // Optionally switch tab to applications? No, let's stay on analysis
    } catch (e) {
        console.error("Failed to add suggested university", e);
    }
  };

  const updateAppStatus = async (appId: string, status: ApplicationStatus) => {
    const updatedApps = student.applications?.map(app => 
        app.id === appId ? { ...app, status } : app
    );
    try {
        await studentService.update(student.id, { applications: updatedApps });
        setStudent(prev => ({ ...prev, applications: updatedApps }));
    } catch (e) {
        console.error("Failed to update app status", e);
    }
  };

  const handleEnrollment = async (appId: string) => {
    try {
        await studentService.update(student.id, { pipelineStage: PipelineStage.ENROLLMENT });
        setStudent(prev => ({ ...prev, pipelineStage: PipelineStage.ENROLLMENT }));
        setCurrentStage(PipelineStage.ENROLLMENT);
        setActiveTab('enrollment');
    } catch (e) {
        console.error("Failed to start enrollment", e);
    }
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('student-printable-area');
    if (!input) return;

    setIsGeneratingPDF(true);
    try {
        // Use html2canvas to capture the element
        const canvas = await html2canvas(input, {
            scale: 2, // Improve quality
            useCORS: true, // Allow external images (if configured properly)
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Calculate ratio to fit width
        const ratio = pdfWidth / imgWidth;
        const scaledHeight = imgHeight * ratio;

        let heightLeft = scaledHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;

        // Add subsequent pages if content is long
        while (heightLeft >= 0) {
            position = heightLeft - scaledHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`${student.firstName}_${student.lastName}_Report.pdf`);
    } catch (error) {
        console.error("PDF Generation failed", error);
        alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
        setIsGeneratingPDF(false);
    }
  };

  // --- Document Logic Start ---
  
  // Helper to simulate uploading/toggling a document
  const handleToggleDocument = (docId: string, docLabel: string) => {
    const exists = studentDocuments.find(d => d.id === docId);
    if (exists) {
        // Remove
        setStudentDocuments(prev => prev.filter(d => d.id !== docId));
    } else {
        // Add (Upload simulation)
        setStudentDocuments(prev => [
            ...prev,
            { id: docId, type: docLabel, uploadedAt: new Date().toISOString().split('T')[0] }
        ]);
    }
    // In a real app, this would trigger an API call
  };

  const handleDocDateChange = (docId: string, date: string) => {
      setStudentDocuments(prev => prev.map(d => 
        d.id === docId ? { ...d, expiryDate: date } : d
      ));
      // In a real app, auto-save or save button needed
  };

  const getExpiryStatus = (expiryDate?: string) => {
      if (!expiryDate) return { status: 'none', color: 'text-slate-400', bg: 'bg-slate-100', label: '' };
      
      const today = new Date();
      const expiry = new Date(expiryDate);
      const monthsUntilExpiry = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (expiry < today) {
          return { status: 'expired', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', label: 'Süresi Dolmuş' };
      } else if (monthsUntilExpiry < 6) {
          return { status: 'warning', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Süresi Doluyor' };
      } else {
          return { status: 'valid', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Geçerli' };
      }
  };

  const documentStatus = useMemo(() => {
    const required = [
      { id: 'passport', label: 'Pasaport', category: 'Identity', hasExpiry: true },
      { id: 'transcript', label: 'Transkript (Not Dökümü)', category: 'Academic' }
    ];

    if (student.targetDegree === 'Master' || student.targetDegree === 'PhD' || student.educationStatus === 'University' || student.educationStatus === 'Graduate') {
        required.push({ id: 'cv', label: 'CV / Özgeçmiş', category: 'Academic' });
        required.push({ id: 'diploma', label: 'Mezuniyet Belgesi / Diploma', category: 'Academic' });
        required.push({ id: 'ref_letters', label: 'Referans Mektupları (2 Adet)', category: 'Academic' });
    }

    const targets = [
        ...(student.targetCountries || []),
        student.analysis?.preferences?.country1,
        student.analysis?.preferences?.country2
    ].join(' ').toLowerCase();

    if (targets.includes('usa') || targets.includes('uk') || targets.includes('kanada') || targets.includes('canada') || targets.includes('amerika') || targets.includes('ingiltere')) {
        required.push({ id: 'sop', label: 'Niyet Mektubu (SoP)', category: 'Essay' });
    }

    if (student.analysis?.language?.hasTakenExam || student.englishLevel) {
        required.push({ id: 'ielts_result', label: 'Dil Yeterlilik Belgesi', category: 'Language', hasExpiry: true });
    }

    const total = required.length;
    const uploadedIds = studentDocuments.map(d => d.id);
    const completed = required.filter(r => uploadedIds.includes(r.id)).length;
    const missing = required.filter(r => !uploadedIds.includes(r.id));
    const percentage = Math.round((completed / total) * 100);

    return { required, completed, total, percentage, missing };
  }, [student, studentDocuments]);

  const getProgressColor = (percent: number) => {
      if (percent === 100) return 'text-emerald-600 bg-emerald-600';
      if (percent >= 50) return 'text-indigo-600 bg-indigo-600';
      return 'text-amber-500 bg-amber-500';
  };
  
  const getProgressBg = (percent: number) => {
      if (percent === 100) return 'bg-emerald-100 border-emerald-200';
      if (percent >= 50) return 'bg-indigo-50 border-indigo-100';
      return 'bg-amber-50 border-amber-100';
  };
  // --- Document Logic End ---

  const openEditModal = (tab?: string) => {
      if (tab) setActiveEditTab(tab);

      // Determine initial GPA scale
      const currentGpa = student.analysis?.academic?.gpa;
      if (currentGpa) {
          const num = parseFloat(currentGpa);
          if (!isNaN(num) && num <= 4.0 && num > 0) {
              setGpaScale('4.0');
          } else {
              setGpaScale('100');
          }
      } else {
          setGpaScale('100');
      }
      setGpaError('');

      setEditForm({
          language: student.analysis?.language || {},
          academic: student.analysis?.academic || { exams: {} },
          social: student.analysis?.social || {},
          preferences: student.analysis?.preferences || {},
          budget: student.analysis?.budget || { ranges: student.analysis?.budget?.range ? [student.analysis.budget.range] : [] }
      });
      setEditAcademicInfo({
          schoolName: student.schoolName || '',
          currentGrade: student.currentGrade || '',
          educationStatus: student.educationStatus || ''
      });
      setEditContactInfo({
          phone: student.phone || '',
          email: student.email || '',
          parentName: student.parentInfo?.fullName || '',
          parentPhone: student.parentInfo?.phone || '',
          parentEmail: student.parentInfo?.email || '',
          parent2Name: student.parent2Info?.fullName || '',
          parent2Phone: student.parent2Info?.phone || '',
          parent2Email: student.parent2Info?.email || ''
      });
      setIsEditModalOpen(true);
  };

  const updateEditField = (section: keyof AnalysisReport, field: string, value: any) => {
    setEditForm(prev => ({
        ...prev,
        [section]: {
            ...(prev as any)[section],
            [field]: value
        }
    }));
  };

  const updateNestedExam = (key: string, field: string, value: any) => {
    setEditForm(prev => {
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
    updateEditField('academic', 'gpa', value);

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


  const handleSaveAnalysis = async () => {
      if (gpaError) {
          alert("Lütfen hatalı alanları düzeltiniz.");
          return;
      }

      const updatedData: Partial<Student> = {
          schoolName: editAcademicInfo.schoolName,
          currentGrade: editAcademicInfo.currentGrade,
          educationStatus: editAcademicInfo.educationStatus as any,
          phone: editContactInfo.phone,
          email: editContactInfo.email,
          parentInfo: {
              ...student.parentInfo,
              fullName: editContactInfo.parentName,
              phone: editContactInfo.parentPhone,
              email: editContactInfo.parentEmail,
          },
          parent2Info: {
              ...student.parent2Info,
              fullName: editContactInfo.parent2Name,
              phone: editContactInfo.parent2Phone,
              email: editContactInfo.parent2Email,
          },
          analysis: editForm
      };

      try {
          await studentService.update(student.id, updatedData);
          setStudent(prev => ({ ...prev, ...updatedData }));
          setIsEditModalOpen(false);
      } catch (error) {
          console.error("Failed to save analysis", error);
          alert("Failed to save changes.");
      }
  };

  // --- Render Functions for Edit Modal ---
  const renderEditLanguage = () => (
    <div className="space-y-6 animate-fade-in">
        {/* Exam Taken? */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Sınav Durumu</h4>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-slate-600 mb-2">Dil seviyeni belirleyecek bir sınava girdin mi?</label>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => updateEditField('language', 'hasTakenExam', true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${editForm.language.hasTakenExam === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Evet, Girdim
                        </button>
                        <button 
                            onClick={() => updateEditField('language', 'hasTakenExam', false)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${editForm.language.hasTakenExam === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Hayır, Girmedim
                        </button>
                    </div>
                </div>

                {editForm.language.hasTakenExam && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">1. Sınav Skoru / Detayı</label>
                                <input 
                                    type="text"
                                    value={editForm.language.examScore || ''}
                                    onChange={(e) => updateEditField('language', 'examScore', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    placeholder="Örn: IELTS 6.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Sınav Tarihi</label>
                                <input 
                                    type="date"
                                    value={editForm.language.pastExamDate || ''}
                                    onChange={(e) => updateEditField('language', 'pastExamDate', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">2. Sınav Skoru (İsteğe Bağlı)</label>
                                <input 
                                    type="text"
                                    value={editForm.language.examScore2 || ''}
                                    onChange={(e) => updateEditField('language', 'examScore2', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Sınav Tarihi</label>
                                <input 
                                    type="date"
                                    value={editForm.language.pastExamDate2 || ''}
                                    onChange={(e) => updateEditField('language', 'pastExamDate2', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">3. Sınav Skoru (İsteğe Bağlı)</label>
                                <input 
                                    type="text"
                                    value={editForm.language.examScore3 || ''}
                                    onChange={(e) => updateEditField('language', 'examScore3', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Sınav Tarihi</label>
                                <input 
                                    type="date"
                                    value={editForm.language.pastExamDate3 || ''}
                                    onChange={(e) => updateEditField('language', 'pastExamDate3', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {editForm.language.hasTakenExam === false && (
                     <div>
                        <label className="block text-sm text-slate-600 mb-1">Tahmini İngilizce Seviyen Nedir?</label>
                        <select 
                            value={editForm.language.estimatedLevel || ''}
                            onChange={(e) => updateEditField('language', 'estimatedLevel', e.target.value)}
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
                        {editForm.language.hasTakenExam ? "Tekrar Sınava girecek misin?" : "Hazırlandığın bir dil sınavı var mı?"}
                    </label>
                    <div className="flex gap-4">
                         <button 
                            onClick={() => updateEditField('language', 'isPreparingForExam', true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${editForm.language.isPreparingForExam === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Evet
                        </button>
                        <button 
                            onClick={() => updateEditField('language', 'isPreparingForExam', false)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${editForm.language.isPreparingForExam === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                        >
                            Hayır
                        </button>
                    </div>
                 </div>

                 {editForm.language.isPreparingForExam && (
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm text-slate-600 mb-1">Hedeflenen Sınav</label>
                            <input 
                                type="text"
                                value={editForm.language.targetExam || ''}
                                onChange={(e) => updateEditField('language', 'targetExam', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                placeholder="Örn: IELTS UKVI"
                            />
                         </div>
                         <div>
                            <label className="block text-sm text-slate-600 mb-1">Planlanan Tarih</label>
                            <input 
                                type="date"
                                value={editForm.language.examDate || ''}
                                onChange={(e) => updateEditField('language', 'examDate', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                         </div>
                     </div>
                 )}
             </div>
        </div>

        {/* Tutoring & Support */}
        {!(editForm.language.hasTakenExam === true && editForm.language.isPreparingForExam === false) && (
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
                                onClick={() => updateEditField('language', 'wantsTutoring', true)}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    editForm.language.wantsTutoring === true 
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-200 scale-105' 
                                    : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-100'
                                }`}
                            >
                                Evet, İstiyorum
                            </button>
                            <button 
                                onClick={() => updateEditField('language', 'wantsTutoring', false)}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    editForm.language.wantsTutoring === false 
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
                value={editForm.language.languageNotes || ''}
                onChange={(e) => updateEditField('language', 'languageNotes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[100px] resize-y"
                placeholder="Bu öğrencinin dil durumu ile ilgili ek notlar..."
             />
        </div>
    </div>
  );

  const renderEditAcademic = () => {
    const getGradeOptions = () => {
        switch(editAcademicInfo.educationStatus) {
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
        const currentExams = editForm.academic.exams || {};
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
                        value={editAcademicInfo.schoolName}
                        onChange={(e) => setEditAcademicInfo(prev => ({ ...prev, schoolName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        placeholder="Örn: Robert Koleji"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Mevcut Eğitimi</label>
                         <select 
                            value={editAcademicInfo.educationStatus}
                            onChange={(e) => setEditAcademicInfo(prev => ({ 
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
                            value={editAcademicInfo.currentGrade}
                            onChange={(e) => setEditAcademicInfo(prev => ({ ...prev, currentGrade: e.target.value }))}
                            disabled={!editAcademicInfo.educationStatus}
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
                {editAcademicInfo.educationStatus === 'High School' && (
                     <div>
                        <label className="block text-sm text-slate-600 mb-1">Bölümü (Alan)</label>
                        <select 
                            value={editForm.academic.educationField || ''}
                            onChange={(e) => updateEditField('academic', 'educationField', e.target.value)}
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

                {(editAcademicInfo.educationStatus === 'University' || editAcademicInfo.educationStatus === 'Master' || editAcademicInfo.educationStatus === 'Graduate') && (
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Bölümü / Programı</label>
                         <input 
                            type="text"
                            value={editForm.academic.educationField || ''}
                            onChange={(e) => updateEditField('academic', 'educationField', e.target.value)}
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
                        value={editForm.academic.gpa || ''}
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
                {['SAT', 'AP', 'IB', 'Diğer'].map(exam => {
                    const exams = editForm.academic.exams as Record<string, ExamDetails> | undefined;
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
                {Object.entries(editForm.academic.exams as Record<string, ExamDetails>).map(([key, details]) => {
                    if (!details.selected) return null;
                    return (
                        <div key={key} className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fade-in">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="font-bold text-sm text-slate-700">{key} Detayları</h5>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {key !== 'AP' && key !== 'IB' && (
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
                                )}
                                {key !== 'AP' && key !== 'IB' && details.status === 'Taken' && (
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
                                {key !== 'AP' && key !== 'IB' && (
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Tarih</label>
                                        <input 
                                            type="date" 
                                            value={details.date || ''}
                                            onChange={(e) => updateNestedExam(key, 'date', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm rounded border border-slate-300" 
                                        />
                                    </div>
                                )}

                                {key === 'AP' && (
                                    <div className="col-span-2 space-y-3 mt-2 border-t pt-3 border-slate-200">
                                        <label className="block text-xs font-semibold text-slate-700">Dersler ve Durumları</label>
                                        {(details.apSubjects?.length ? details.apSubjects : (details.subject ? [{ subject: details.subject, status: details.status || '', grade: '' }] : [{ subject: '', status: '', grade: '' }])).map((apSub, idx, arr) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <div className="flex-1">
                                                    <select 
                                                        value={apSub.subject}
                                                        onChange={(e) => {
                                                            const newSubjects = [...arr];
                                                            newSubjects[idx] = { ...newSubjects[idx], subject: e.target.value };
                                                            updateNestedExam(key, 'apSubjects', newSubjects);
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300" 
                                                    >
                                                        <option value="">Select AP Course</option>
                                                        <optgroup label="Mathematics">
                                                            <option value="AP Precalculus">Precalculus</option>
                                                            <option value="AP Calculus AB">Calculus AB</option>
                                                            <option value="AP Calculus BC">Calculus BC</option>
                                                            <option value="AP Statistics">Statistics</option>
                                                        </optgroup>
                                                        <optgroup label="Sciences">
                                                            <option value="AP Biology">Biology</option>
                                                            <option value="AP Chemistry">Chemistry</option>
                                                            <option value="AP Environmental Science">Environmental Science</option>
                                                            <option value="AP Physics 1">Physics 1</option>
                                                            <option value="AP Physics 2">Physics 2</option>
                                                            <option value="AP Physics C: Mechanics">Physics C: Mechanics</option>
                                                            <option value="AP Physics C: Electricity & Magnetism">Physics C: Electricity & Magnetism</option>
                                                        </optgroup>
                                                        <optgroup label="Computer Science">
                                                            <option value="AP Computer Science A">Computer Science A</option>
                                                            <option value="AP Computer Science Principles">Computer Science Principles</option>
                                                        </optgroup>
                                                        <optgroup label="Social Sciences">
                                                            <option value="AP Macroeconomics">Macroeconomics</option>
                                                            <option value="AP Microeconomics">Microeconomics</option>
                                                            <option value="AP Psychology">Psychology</option>
                                                            <option value="AP Human Geography">Human Geography</option>
                                                            <option value="AP Comparative Government">Comparative Government & Politics</option>
                                                            <option value="AP US Government">US Government & Politics</option>
                                                        </optgroup>
                                                        <optgroup label="English">
                                                            <option value="AP English Language">English Language & Composition</option>
                                                            <option value="AP English Literature">English Literature & Composition</option>
                                                        </optgroup>
                                                        <optgroup label="History & Humanities">
                                                            <option value="AP World History: Modern">World History: Modern</option>
                                                            <option value="AP European History">European History</option>
                                                            <option value="AP US History">US History</option>
                                                            <option value="AP Art History">Art History</option>
                                                        </optgroup>
                                                        <optgroup label="Arts">
                                                            <option value="AP Music Theory">Music Theory</option>
                                                            <option value="AP 2-D Art and Design">2-D Art and Design</option>
                                                            <option value="AP 3-D Art and Design">3-D Art and Design</option>
                                                            <option value="AP Drawing">Drawing</option>
                                                        </optgroup>
                                                        <optgroup label="Capstone">
                                                            <option value="AP Research">Research</option>
                                                            <option value="AP Seminar">Seminar</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div className="w-1/4">
                                                    <select 
                                                        value={apSub.grade || ''}
                                                        onChange={(e) => {
                                                            const newSubjects = [...arr];
                                                            newSubjects[idx] = { ...newSubjects[idx], grade: e.target.value };
                                                            updateNestedExam(key, 'apSubjects', newSubjects);
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                    >
                                                        <option value="">Sınıf</option>
                                                        <option value="9. Sınıf">9. Sınıf</option>
                                                        <option value="10. Sınıf">10. Sınıf</option>
                                                        <option value="11. Sınıf">11. Sınıf</option>
                                                        <option value="12. Sınıf">12. Sınıf</option>
                                                        <option value="Mezun">Mezun</option>
                                                    </select>
                                                </div>
                                                <div className="w-1/4">
                                                    <select 
                                                        value={apSub.status}
                                                        onChange={(e) => {
                                                            const newSubjects = [...arr];
                                                            newSubjects[idx] = { ...newSubjects[idx], status: e.target.value };
                                                            updateNestedExam(key, 'apSubjects', newSubjects);
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300" 
                                                    >
                                                        <option value="">Durum</option>
                                                        <option value="Hazırlanıyor">Hazırlanıyor</option>
                                                        <option value="1">1</option>
                                                        <option value="2">2</option>
                                                        <option value="3">3</option>
                                                        <option value="4">4</option>
                                                        <option value="5">5</option>
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newSubjects = arr.filter((_, i) => i !== idx);
                                                        updateNestedExam(key, 'apSubjects', newSubjects);
                                                    }}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded mt-0.5 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentSubjects = details.apSubjects?.length ? details.apSubjects : (details.subject ? [{ subject: details.subject, status: details.status || '', grade: '' }] : [{ subject: '', status: '', grade: '' }]);
                                                updateNestedExam(key, 'apSubjects', [...currentSubjects, { subject: '', status: '', grade: '' }]);
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Ek Ders Ekle
                                        </button>
                                    </div>
                                )}
                                {key === 'IB' && (
                                    <div className="col-span-2 space-y-3 mt-1 border-t pt-3 border-slate-200">
                                        <label className="block text-xs font-semibold text-slate-700">Subjects, Level and Status</label>
                                        {(details.ibSubjects?.length ? details.ibSubjects : [{ subject: '', level: '', status: '' }]).map((ibSub, idx, arr) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <div className="flex-1 min-w-0">
                                                    <select 
                                                        value={ibSub.subject}
                                                        onChange={(e) => {
                                                            const n = [...arr]; n[idx] = { ...n[idx], subject: e.target.value };
                                                            updateNestedExam(key, 'ibSubjects', n);
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                    >
                                                        <option value="">Select IB Course</option>
                                                        <optgroup label="Language A">
                                                            <option value="IB Language A: Language and Literature">Language A: Language and Literature</option>
                                                            <option value="IB Language A: Literature">Language A: Literature</option>
                                                        </optgroup>
                                                        <optgroup label="Language Acquisition">
                                                            <option value="IB Language B (English)">Language B (English)</option>
                                                            <option value="IB Language B (French)">Language B (French)</option>
                                                            <option value="IB Language B (Spanish)">Language B (Spanish)</option>
                                                            <option value="IB Language B (German)">Language B (German)</option>
                                                            <option value="IB Language B (Mandarin)">Language B (Mandarin)</option>
                                                            <option value="IB Language B (Arabic)">Language B (Arabic)</option>
                                                            <option value="IB Language B (Turkish)">Language B (Turkish)</option>
                                                            <option value="IB Language Ab Initio (French)">Ab Initio (French)</option>
                                                            <option value="IB Language Ab Initio (Spanish)">Ab Initio (Spanish)</option>
                                                            <option value="IB Language Ab Initio (German)">Ab Initio (German)</option>
                                                        </optgroup>
                                                        <optgroup label="Individuals and Societies">
                                                            <option value="IB Business Management">Business Management</option>
                                                            <option value="IB Economics">Economics</option>
                                                            <option value="IB Geography">Geography</option>
                                                            <option value="IB Global Politics">Global Politics</option>
                                                            <option value="IB History">History</option>
                                                            <option value="IB ITGS">Information Technology in a Global Society</option>
                                                            <option value="IB Philosophy">Philosophy</option>
                                                            <option value="IB Psychology">Psychology</option>
                                                            <option value="IB Social and Cultural Anthropology">Social and Cultural Anthropology</option>
                                                            <option value="IB World Religions">World Religions</option>
                                                        </optgroup>
                                                        <optgroup label="Sciences">
                                                            <option value="IB Biology">Biology</option>
                                                            <option value="IB Chemistry">Chemistry</option>
                                                            <option value="IB Computer Science">Computer Science</option>
                                                            <option value="IB Design Technology">Design Technology</option>
                                                            <option value="IB Environmental Systems and Societies">Environmental Systems and Societies</option>
                                                            <option value="IB Physics">Physics</option>
                                                            <option value="IB Sports, Exercise and Health Science">Sports, Exercise and Health Science</option>
                                                        </optgroup>
                                                        <optgroup label="Mathematics">
                                                            <option value="IB Mathematics: Analysis and Approaches">Mathematics: Analysis and Approaches</option>
                                                            <option value="IB Mathematics: Applications and Interpretation">Mathematics: Applications and Interpretation</option>
                                                        </optgroup>
                                                        <optgroup label="The Arts">
                                                            <option value="IB Dance">Dance</option>
                                                            <option value="IB Film">Film</option>
                                                            <option value="IB Music">Music</option>
                                                            <option value="IB Theatre">Theatre</option>
                                                            <option value="IB Visual Arts">Visual Arts</option>
                                                        </optgroup>
                                                        <optgroup label="Core Components">
                                                            <option value="IB Theory of Knowledge (TOK)">Theory of Knowledge (TOK)</option>
                                                            <option value="IB Extended Essay (EE)">Extended Essay (EE)</option>
                                                            <option value="IB Creativity, Activity, Service (CAS)">Creativity, Activity, Service (CAS)</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div className="w-24 shrink-0">
                                                    <select
                                                        value={ibSub.level}
                                                        onChange={(e) => {
                                                            const n = [...arr]; n[idx] = { ...n[idx], level: e.target.value };
                                                            updateNestedExam(key, 'ibSubjects', n);
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                    >
                                                        <option value="">Level</option>
                                                        <option value="HL">HL</option>
                                                        <option value="SL">SL</option>
                                                    </select>
                                                </div>
                                                <div className="w-28 shrink-0">
                                                    <select
                                                        value={ibSub.status}
                                                        onChange={(e) => {
                                                            const n = [...arr]; n[idx] = { ...n[idx], status: n[idx].status };
                                                            const updated = [...arr];
                                                            updated[idx] = { ...updated[idx], status: e.target.value };
                                                            updateNestedExam(key, 'ibSubjects', updated);
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                    >
                                                        <option value="">Status</option>
                                                        <option value="Preparing">Preparing</option>
                                                        <option value="1">1</option>
                                                        <option value="2">2</option>
                                                        <option value="3">3</option>
                                                        <option value="4">4</option>
                                                        <option value="5">5</option>
                                                        <option value="6">6</option>
                                                        <option value="7">7</option>
                                                    </select>
                                                </div>
                                                <button type="button" onClick={() => { const n = arr.filter((_, i) => i !== idx); updateNestedExam(key, 'ibSubjects', n); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded mt-0.5 transition-colors shrink-0">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => { const cur = details.ibSubjects?.length ? details.ibSubjects : [{ subject: '', level: '', status: '' }]; updateNestedExam(key, 'ibSubjects', [...cur, { subject: '', level: '', status: '' }]); }} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Add IB Course
                                        </button>
                                    </div>
                                )}
                                {key === 'Diğer' && (
                                    <div className="col-span-2 space-y-2">
                                        <label className="block text-xs text-slate-500">Not / Detay</label>
                                        <textarea
                                            value={details.notes || ''}
                                            onChange={(e) => updateNestedExam(key, 'notes', e.target.value)}
                                            placeholder="Sınav adı, tarih veya skor gibi detayları buraya yazabilirsiniz..."
                                            className="w-full px-3 py-2 text-sm rounded border border-slate-300 min-h-[80px]"
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
                value={editForm.academic.academicNotes || ''}
                onChange={(e) => updateEditField('academic', 'academicNotes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[80px] resize-y"
                placeholder="Akademik durumu ile ilgili ek notlar..."
             />
        </div>
    </div>
  )};

   const renderEditPreferences = () => (
      <div className="space-y-6 animate-fade-in">

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Bölüm Tercihleri</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                         <label className="block text-sm text-slate-600 mb-1">1. Tercih</label>
                         <select 
                             value={editForm.preferences.program1 || ''}
                             onChange={(e) => updateEditField('preferences', 'program1', e.target.value)}
                             className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                         >
                             <option value="">Seçiniz</option>
                             <option value="Bölüm konusunda kesin kararlı değilim">Bölüm konusunda kesin kararlı değilim</option>
                             {allMainDegrees.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="block text-sm text-slate-600 mb-1">2. Tercih</label>
                          <select 
                             value={editForm.preferences.program2 || ''}
                             onChange={(e) => updateEditField('preferences', 'program2', e.target.value)}
                             className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                         >
                             <option value="">Seçiniz</option>
                             <option value="Bölüm konusunda kesin kararlı değilim">Bölüm konusunda kesin kararlı değilim</option>
                             {allMainDegrees.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                         </select>
                     </div>
                </div>

                {/* Coaching Support Request */}
                {(editForm.preferences.program1 === "Bölüm konusunda kesin kararlı değilim" || editForm.preferences.program2 === "Bölüm konusunda kesin kararlı değilim") && (
                    <div className="bg-violet-50 p-6 rounded-xl border border-violet-200 shadow-sm relative overflow-hidden mt-6 animate-fade-in">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-100 rounded-bl-full opacity-50 -mr-8 -mt-8"></div>
                        <div className="relative z-10 flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-violet-600 mt-1">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-base font-semibold text-violet-900 mb-3 leading-tight">
                                    Bölüm çalışması konusunda Koçluk desteği almak ister misiniz?
                                </label>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => updateEditField('preferences', 'wantsCoaching', true)}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                            editForm.preferences.wantsCoaching === true 
                                            ? 'bg-violet-600 text-white shadow-md shadow-violet-200 scale-105' 
                                            : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-100'
                                        }`}
                                    >
                                        Evet, İstiyorum
                                    </button>
                                    <button 
                                        onClick={() => updateEditField('preferences', 'wantsCoaching', false)}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                            editForm.preferences.wantsCoaching === false 
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
            </div>

           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h4 className="text-sm font-semibold text-slate-700 mb-3">Ülke Tercihleri</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i}>
                            <label className="block text-sm text-slate-600 mb-1">{i}. Ülke</label>
                            <select 
                                value={(editForm.preferences as any)[`country${i}`] || ''}
                                onChange={(e) => updateEditField('preferences', `country${i}`, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            >
                                <option value="">Seçiniz</option>
                                {allCountries.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
               </div>
           </div>

           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h4 className="text-sm font-semibold text-slate-700 mb-3">Tercih Notları</h4>
               <textarea 
                  value={editForm.preferences.notes || ''} 
                  onChange={(e) => updateEditField('preferences', 'notes', e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[80px]" 
                  placeholder="Tercihlere dair ek notlar..."
               />
           </div>
      </div>
   );

  const renderEditCitizenship = () => (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Flag className="w-4 h-4 text-indigo-500" />
                Vatandaşlık ve Pasaport Bilgileri
            </h4>
            <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={editForm.citizenship?.isTurkishCitizen !== false}
                        onChange={(e) => updateEditField('citizenship', 'isTurkishCitizen', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Türk Vatandaşı</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={!!editForm.citizenship?.hasGreenPassport}
                        onChange={(e) => updateEditField('citizenship', 'hasGreenPassport', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Yeşil Pasaportu Var</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={!!editForm.citizenship?.hasBlackPassport}
                        onChange={(e) => updateEditField('citizenship', 'hasBlackPassport', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Siyah Pasaportu Var</span>
                </label>
                
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={!!editForm.citizenship?.hasResidencePermit}
                            onChange={(e) => {
                                updateEditField('citizenship', 'hasResidencePermit', e.target.checked);
                                if(!e.target.checked) updateEditField('citizenship', 'residencePermitNote', '');
                            }}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Oturum İzni Var</span>
                    </label>
                    {editForm.citizenship?.hasResidencePermit && (
                        <div className="ml-8">
                            <input 
                                value={editForm.citizenship?.residencePermitNote || ''}
                                onChange={(e) => updateEditField('citizenship', 'residencePermitNote', e.target.value)}
                                placeholder="Hangi ülkeye ait, bitiş tarihi vb. detaylar..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={!!editForm.citizenship?.hasForeignCitizenship}
                            onChange={(e) => {
                                updateEditField('citizenship', 'hasForeignCitizenship', e.target.checked);
                                if(!e.target.checked) updateEditField('citizenship', 'foreignCitizenshipNote', '');
                            }}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Farklı bir Vatandaşlığı Var</span>
                    </label>
                    {editForm.citizenship?.hasForeignCitizenship && (
                        <div className="ml-8">
                            <input 
                                value={editForm.citizenship?.foreignCitizenshipNote || ''}
                                onChange={(e) => updateEditField('citizenship', 'foreignCitizenshipNote', e.target.value)}
                                placeholder="Hangi ülke vatandaşı (Örn: Almanya)"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
  );

  const renderEditContact = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-500" />
                  Öğrenci İletişim
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm text-slate-600 mb-1">Telefon</label>
                      <input value={editContactInfo.phone} onChange={e => setEditContactInfo({...editContactInfo, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"/>
                  </div>
                  <div>
                      <label className="block text-sm text-slate-600 mb-1">E-posta</label>
                      <input value={editContactInfo.email} onChange={e => setEditContactInfo({...editContactInfo, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"/>
                  </div>
              </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">1. Veli</h4>
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm text-slate-600 mb-1">Veli Adı Soyadı</label>
                      <input value={editContactInfo.parentName} onChange={e => setEditContactInfo({...editContactInfo, parentName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">Telefon</label>
                          <input value={editContactInfo.parentPhone} onChange={e => setEditContactInfo({...editContactInfo, parentPhone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"/>
                      </div>
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">E-posta</label>
                          <input value={editContactInfo.parentEmail} onChange={e => setEditContactInfo({...editContactInfo, parentEmail: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"/>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">2. Veli</h4>
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm text-slate-600 mb-1">Veli Adı Soyadı</label>
                      <input value={editContactInfo.parent2Name} onChange={e => setEditContactInfo({...editContactInfo, parent2Name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">Telefon</label>
                          <input value={editContactInfo.parent2Phone} onChange={e => setEditContactInfo({...editContactInfo, parent2Phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"/>
                      </div>
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">E-posta</label>
                          <input value={editContactInfo.parent2Email} onChange={e => setEditContactInfo({...editContactInfo, parent2Email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"/>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderEditSocial = () => (
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
                                value={editForm.social.sports || ''}
                                onChange={(e) => updateEditField('social', 'sports', e.target.value)}
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
                                value={editForm.social.arts || ''}
                                onChange={(e) => updateEditField('social', 'arts', e.target.value)}
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
                                value={editForm.social.socialWork || ''}
                                onChange={(e) => updateEditField('social', 'socialWork', e.target.value)}
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
                                value={editForm.social.projects || ''}
                                onChange={(e) => updateEditField('social', 'projects', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none h-[88px]"
                                placeholder="TÜBİTAK, Erasmus vb."
                            />
                       </div>
                   </div>
               </div>
          </div>
      </div>
  );

  const renderEditBudget = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                 <Coins className="w-4 h-4 text-emerald-500" />
                 Yıllık Eğitim Bütçesi (Yaşam Hariç)
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tuitionRanges.map((option) => {
                    const isSelected = editForm.budget?.range === option || editForm.budget?.ranges?.includes(option);
                    return (
                        <label key={option} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                            isSelected 
                            ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                            : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                        }`}>
                            <input
                                type="radio"
                                name="budget_range_edit"
                                checked={isSelected}
                                onChange={() => {
                                    updateEditField('budget', 'range', option);
                                    updateEditField('budget', 'ranges', [option]);
                                }}
                                className="w-5 h-5 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                            />
                            <span className={`text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                                {option}
                            </span>
                        </label>
                    );
                })}
             </div>
             <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                 <div>
                     <p className="text-sm font-semibold text-amber-900">Bütçe Hakkında Not</p>
                     <p className="text-xs text-amber-700 mt-1">
                         Belirtilen bütçe aralıkları sadece yıllık eğitim ücretini (tuition) kapsammaktadır. 
                         Konaklama, yemek ve diğer yaşam giderleri bu tutarlara dahil değildir.
                     </p>
                 </div>
             </div>
        </div>
    </div>
  );

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analyzeStudentProfile(student);
      setAnalysis(result);
      
      // Automatic Transition to Analyse Stage
      if (currentStage === PipelineStage.FOLLOW) {
          await studentService.update(student.id, { pipelineStage: PipelineStage.ANALYSE });
          setStudent(prev => ({ ...prev, pipelineStage: PipelineStage.ANALYSE }));
          setCurrentStage(PipelineStage.ANALYSE);
      }
      
      setActiveTab('analysis');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterRecord = async () => {
      try {
          await studentService.update(student.id, { pipelineStage: PipelineStage.PROCESS });
          setStudent(prev => ({ ...prev, pipelineStage: PipelineStage.PROCESS }));
          setCurrentStage(PipelineStage.PROCESS);
          setActiveTab('contracts');
      } catch (e) {
          console.error("Failed to register record", e);
      }
  };

  const handleGenerateRoadmap = async () => {
    setLoading(true);
    try {
      const result = await generateStudentRoadmap(student);
      setRoadmap(result);
      setActiveTab('roadmap');
    } catch (e) {
        console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAskAI = async () => {
    if(!chatQuery) return;
    setChatResponse("Thinking...");
    const res = await askUNIC(chatQuery, JSON.stringify(student));
    setChatResponse(res);
  };

  const DisplayField = ({ label, value, fullWidth = false }: { label: string, value?: string | number, fullWidth?: boolean }) => (
    <div className={`${fullWidth ? 'col-span-2' : ''}`}>
        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{label}</label>
        <p className="text-sm font-medium text-slate-800 break-words">{value || '-'}</p>
    </div>
  );

  return (
    <div className="space-y-6 h-full flex flex-col student-detail-container">
       <style>{`
        @media print {
            @page { margin: 0.5cm; size: portrait; }
            body { 
                visibility: hidden; 
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .student-detail-container {
                visibility: visible;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 0;
                background: white;
                height: auto !important;
                display: block !important;
            }
            .student-detail-container * {
                visibility: visible;
            }
            aside, nav, .print\\:hidden, button:not(.print\\:show) {
                display: none !important;
            }
            .overflow-y-auto, .overflow-hidden, .h-screen, .h-full, .flex-1 {
                height: auto !important;
                overflow: visible !important;
                flex: none !important;
                width: 100% !important;
            }
            .student-content-area {
                padding-bottom: 0 !important;
                overflow: visible !important;
                display: block !important;
            }
            .bg-slate-50, .bg-indigo-50, .bg-emerald-50, .bg-amber-50 {
                background-color: white !important;
                border: 1px solid #e2e8f0 !important; 
            }
            .text-indigo-600, .text-emerald-600, .text-amber-600 {
                color: #000 !important;
            }
        }
      `}</style>
      
      {/* Compact Header */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 border-b border-slate-200 pb-4 print:border-none">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors print:hidden shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-4">
              <h2 className="text-2xl font-bold text-slate-800 truncate">{student.firstName} {student.lastName}</h2>
              <button 
                  onClick={() => openEditModal('contact')}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
              >
                  <Edit2 className="w-3.5 h-3.5" />
                  Düzenle
              </button>

              <div className="flex items-center gap-3 text-sm text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {formatPhone(student.phone) || '-'}
                  </div>
                  <div className="w-px h-4 bg-slate-200"></div>
                  <div className="flex items-center gap-1.5 break-all">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {student.email || '-'}
                  </div>
              </div>
            </div>
            
            <div className="mt-3 flex flex-col gap-2">
                
                {/* Veli Bilgileri */}
                {student.parentInfo?.fullName && (
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium whitespace-nowrap overflow-x-auto print:whitespace-normal">
                        <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md text-[10px]">1. Veli</span>
                        <span className="text-slate-800">{student.parentInfo.fullName} <span className="text-slate-400 text-xs font-normal">({student.parentInfo.relationship || 'Belirtilmemiş'})</span></span>
                        <span className="text-slate-300 mx-1">|</span>
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {formatPhone(student.parentInfo.phone)}</span>
                        {student.parentInfo.email && (
                             <>
                                <span className="text-slate-300 mx-1">|</span>
                                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> {student.parentInfo.email}</span>
                             </>
                        )}
                    </div>
                )}
                
                {student.parent2Info?.fullName && (
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium whitespace-nowrap overflow-x-auto print:whitespace-normal">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md text-[10px]">2. Veli</span>
                        <span className="text-slate-800">{student.parent2Info.fullName} <span className="text-slate-400 text-xs font-normal">({student.parent2Info.relationship || 'Belirtilmemiş'})</span></span>
                        <span className="text-slate-300 mx-1">|</span>
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {formatPhone(student.parent2Info.phone)}</span>
                        {student.parent2Info.email && (
                             <>
                                <span className="text-slate-300 mx-1">|</span>
                                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> {student.parent2Info.email}</span>
                             </>
                        )}
                    </div>
                )}
            </div>
          </div>
        </div>
          
          {/* Action Area for Stages */}
        <div className="flex flex-col items-end gap-3 print:hidden shrink-0 mt-2 xl:mt-0">
             <div className="flex flex-wrap items-center justify-end gap-2">
                 <div className="relative print:hidden shrink-0 mr-1">
                    <select
                        value={currentStage}
                        onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                        className={`appearance-none cursor-pointer pl-3 pr-8 py-2 rounded-lg text-xs font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-offset-1 transition-all shadow-sm border border-transparent hover:brightness-95 ${
                            currentStage === PipelineStage.STUDENT ? 'bg-emerald-100 text-emerald-700 focus:ring-emerald-500' :
                            currentStage === PipelineStage.ENROLLMENT ? 'bg-purple-100 text-purple-700 focus:ring-purple-500' :
                            currentStage === PipelineStage.NOT_INTERESTED ? 'bg-slate-200 text-slate-700 focus:ring-slate-500' :
                            'bg-indigo-100 text-indigo-700 focus:ring-indigo-500'
                        }`}
                    >
                        {Object.values(PipelineStage).map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-current" />
                 </div>


                 <button 
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm text-xs font-bold"
                >
                {loading ? <span className="animate-spin text-sm">⟳</span> : <BrainCircuit className="w-4 h-4" />}
                UNIC Analizi Yap
              </button>
             </div>

             {currentStage === PipelineStage.ANALYSE && (
                <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm w-full lg:w-auto">
                    {(['Mid', 'Hot', 'Super Hot'] as AnalyseStatus[]).map(status => (
                        <button 
                            key={status}
                            onClick={() => handleSetAnalyseStatus(status)}
                            className={`flex-1 lg:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeAnalyseStatus === status 
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 ring-1 ring-slate-100' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-slate-300 mx-2"></div>
                    <button 
                        onClick={handleRegisterRecord}
                        className="flex-1 lg:flex-none px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 hover:shadow-md transition-all shadow-sm text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Process
                    </button>
                </div>
             )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 print:hidden">
        {[
          { id: 'profile', label: 'Profil', icon: User, visible: true },
          { id: 'analysis', label: 'AI Analiz', icon: Sparkles, visible: currentStage === PipelineStage.ANALYSE || currentStage === PipelineStage.PROCESS },
          { id: 'contracts', label: 'Sözleşme', icon: FileText, visible: currentStage === PipelineStage.PROCESS || currentStage === PipelineStage.ENROLLMENT },
          { id: 'application', label: 'Başvurular', icon: Globe, visible: currentStage === PipelineStage.PROCESS || currentStage === PipelineStage.ENROLLMENT },
          { id: 'enrollment', label: 'Kabul & İşlem', icon: CheckCircle, visible: currentStage === PipelineStage.ENROLLMENT },
          { id: 'visa', label: 'Vize', icon: CreditCard, visible: currentStage === PipelineStage.ENROLLMENT || currentStage === PipelineStage.STUDENT },
          { id: 'accommodation', label: 'Konaklama', icon: BookOpen, visible: currentStage === PipelineStage.ENROLLMENT },
        ].filter(t => t.visible).map((tab) => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
                <tab.icon className="w-4 h-4" />
                {tab.label}
            </button>
        ))}
      </div>

      {/* Content Area */}
      <div id="student-printable-area" className="flex-1 overflow-y-auto pr-2 pb-10 student-content-area">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in print:block print:space-y-6">
            
            <div className="lg:col-span-2 space-y-6">
                 {/* Academic Info */}
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Akademik Bilgiler</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('academic')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Eğitim Durumu</label>
                            <div className="text-[14px] font-medium text-slate-800 flex items-center gap-1 flex-wrap">
                                {(() => {
                                    const statusMap: Record<string, string> = {
                                        'Primary': 'İlköğretim',
                                        'High School': 'Lise',
                                        'University': 'Üniversite',
                                        'Master': 'Yüksek Lisans',
                                        'Graduate': 'Mezun'
                                    };
                                    return statusMap[student.educationStatus || ''] || student.educationStatus || '-';
                                })()}
                                <span> - </span>
                                {student.schoolName || '-'}
                                <span> - </span>
                                {student.currentGrade || '-'}
                                <span> - </span>
                                {student.analysis?.academic?.educationField || '-'}
                            </div>
                            <div className="text-[13px] text-slate-600 flex items-center gap-1 flex-wrap">
                                <span>Yaklaşık Not Ortalaması: <strong className="text-slate-800">{student.analysis?.academic?.gpa || '-'}</strong></span>
                            </div>
                        </div>
                        <DisplayField label="Akademik Notlar" value={student.analysis?.academic?.academicNotes} fullWidth />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Sınavlar</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('academic')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>

                    {student.analysis?.academic?.exams && Object.keys(student.analysis.academic.exams).length > 0 ? (
                         <div className="space-y-4">
                            {Object.entries(student.analysis.academic.exams as Record<string, ExamDetails>).map(([examName, details]) => {
                                if (!details.selected) return null;
                                return (
                                    <div key={examName} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 print:bg-white print:border-slate-300">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-slate-700">{examName}</span>
                                            {examName !== 'AP' && examName !== 'IB' && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${details.status === 'Taken' ? 'bg-emerald-100 text-emerald-700 print:bg-emerald-50 print:border print:border-emerald-200' : 'bg-amber-100 text-amber-700 print:bg-amber-50 print:border print:border-amber-200'}`}>
                                                    {details.status === 'Taken' ? 'Girdi' : 'Hazırlanıyor'}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {examName === 'AP' ? (
                                            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 space-y-2">
                                                {(details.apSubjects?.length ? details.apSubjects : (details.subject ? [{ subject: details.subject, status: details.status || '', grade: '' }] : [])).map((sub, idx) => sub.subject && (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm gap-2">
                                                        <span className="text-xs font-bold text-slate-700 flex-1">{sub.subject}</span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {sub.grade && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-slate-50 text-slate-600 border-slate-200">
                                                                    {sub.grade}
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${sub.status === 'Hazırlanıyor' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                {sub.status || '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : examName === 'IB' ? (
                                            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 space-y-2">
                                                {(details.ibSubjects?.length ? details.ibSubjects : []).map((sub, idx) => sub.subject && (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm gap-2">
                                                        <span className="text-xs font-bold text-slate-700 flex-1 min-w-0 truncate">{sub.subject.replace(/^IB /, '')}</span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {sub.level && (
                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${sub.level === 'HL' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                                    {sub.level}
                                                                </span>
                                                            )}
                                                            {sub.status && (
                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${sub.status === 'Hazırlanıyor' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                    {sub.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                                <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 grid grid-cols-2 gap-y-2.5 gap-x-2">
                                                    {details.subject && (
                                                        <div className="col-span-2">
                                                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Branş / Konu</p>
                                                            <p className="text-xs font-medium text-slate-800">{details.subject}</p>
                                                        </div>
                                                    )}
                                                    {details.date && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Tarih</p>
                                                            <p className="text-xs font-medium text-slate-800">{formatExamDate(details.date)}</p>
                                                        </div>
                                                    )}
                                                    {details.score && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Alınan Skor / Hedef</p>
                                                            <p className="text-xs font-bold text-indigo-600">{details.score}</p>
                                                        </div>
                                                    )}
                                                    {details.notes && (
                                                        <div className="col-span-2">
                                                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Not / Detay</p>
                                                            <p className="text-xs text-slate-700 mt-1 whitespace-pre-line">{details.notes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        }
                                    </div>
                                )
                            })}
                         </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Kayıtlı sınav bilgisi yok.</p>
                    )}
                </div>

                {/* Preferences */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none max-w-2xl">
                     <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Eğitim Tercihleri</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('preferences')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bölüm Tercihleri</label>
                            <div className="space-y-2.5">
                                {student.analysis?.preferences?.program1 ? (
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 flex items-center gap-3 print:bg-transparent print:border-slate-300">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">1</div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">1. Tercih</span>
                                            <span className="font-medium">{student.analysis.preferences.program1}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">Bölüm tercihi girilmedi.</p>
                                )}
                                {student.analysis?.preferences?.program2 && (
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 flex items-center gap-3 print:bg-transparent print:border-slate-300">
                                        <div className="w-6 h-6 rounded-lg bg-slate-400 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">2</div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">2. Tercih</span>
                                            <span className="font-medium">{student.analysis.preferences.program2}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ülke Tercihleri</label>
                              <div className="grid grid-cols-1 gap-2.5">
                                {student.analysis?.preferences?.country1 && (
                                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl shadow-sm print:shadow-none print:border-slate-300">
                                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0">
                                            {getCountryCode(student.analysis.preferences.country1) ? (
                                                <img src={`https://flagcdn.com/w40/${getCountryCode(student.analysis.preferences.country1)}.png`} className="w-full h-full object-cover" alt={student.analysis.preferences.country1} />
                                            ) : (
                                                <span className="text-xl">{getFlagEmoji(student.analysis.preferences.country1)}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">1. Ülke</span>
                                            <span className="font-bold truncate">{student.analysis.preferences.country1}</span>
                                        </div>
                                    </div>
                                )}
                                {student.analysis?.preferences?.country2 && (
                                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl shadow-sm print:shadow-none print:border-slate-300">
                                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0">
                                            {getCountryCode(student.analysis.preferences.country2) ? (
                                                <img src={`https://flagcdn.com/w40/${getCountryCode(student.analysis.preferences.country2)}.png`} className="w-full h-full object-cover" alt={student.analysis.preferences.country2} />
                                            ) : (
                                                <span className="text-xl">{getFlagEmoji(student.analysis.preferences.country2)}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">2. Ülke</span>
                                            <span className="font-bold truncate">{student.analysis.preferences.country2}</span>
                                        </div>
                                    </div>
                                )}
                                {student.analysis?.preferences?.country3 && (
                                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl shadow-sm print:shadow-none print:border-slate-300">
                                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0">
                                            {getCountryCode(student.analysis.preferences.country3) ? (
                                                <img src={`https://flagcdn.com/w40/${getCountryCode(student.analysis.preferences.country3)}.png`} className="w-full h-full object-cover" alt={student.analysis.preferences.country3} />
                                            ) : (
                                                <span className="text-xl">{getFlagEmoji(student.analysis.preferences.country3)}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">3. Ülke</span>
                                            <span className="font-bold truncate">{student.analysis.preferences.country3}</span>
                                        </div>
                                    </div>
                                )}
                                {!student.analysis?.preferences?.country1 && <p className="text-xs text-slate-400 italic">Ülke tercihi girilmedi.</p>}
                              </div>
                        </div>
                    </div>
                    {student.analysis?.preferences?.notes && (
                        <div className="mt-6 pt-4 border-t border-slate-100">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tercih Notları</label>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{student.analysis.preferences.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6 print:mt-6">
                {(currentStage === PipelineStage.PROCESS || currentStage === PipelineStage.ENROLLMENT) && (
                    <div className={`p-6 rounded-2xl border shadow-sm transition-all ${getProgressBg(documentStatus.percentage)} print:border-slate-300 print:bg-white`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                    <PieChart className={`w-5 h-5 ${getProgressColor(documentStatus.percentage).split(' ')[0]}`} />
                                    <h3 className="font-bold text-slate-800">Evrak Durumu</h3>
                            </div>
                            <span className={`text-lg font-bold ${getProgressColor(documentStatus.percentage).split(' ')[0]}`}>
                                {documentStatus.percentage}%
                            </span>
                        </div>
                        <div className="w-full bg-white/50 rounded-full h-2 mb-4 overflow-hidden print:bg-slate-100 print:border print:border-slate-200">
                            <div className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(documentStatus.percentage).split(' ')[1]} print:bg-slate-600`} style={{width: `${documentStatus.percentage}%`}}></div>
                        </div>
                    </div>
                )}



                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                     <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Dil Yeterliliği</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('language')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>

                    <div className="space-y-4">
                        {student.analysis?.language?.hasTakenExam ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className={`p-3 rounded-lg border print:bg-white print:border-slate-300 ${isExamExpired(student.analysis.language.pastExamDate) ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <p className={`text-[10px] font-bold uppercase mb-1 print:text-slate-600 ${isExamExpired(student.analysis.language.pastExamDate) ? 'text-red-600' : 'text-emerald-600'}`}>Sınav 1 {isExamExpired(student.analysis.language.pastExamDate) && <span className="text-[9px] bg-red-100 px-1 py-0.5 rounded ml-1 text-red-700">Süresi Doldu</span>}</p>
                                    <p className={`text-sm font-bold print:text-black ${isExamExpired(student.analysis.language.pastExamDate) ? 'text-red-800' : 'text-emerald-800'}`}>{student.analysis.language.examScore || '-'}</p>
                                    <p className={`text-xs mt-1 print:text-slate-500 ${isExamExpired(student.analysis.language.pastExamDate) ? 'text-red-600 inline-block px-1.5 py-0.5 bg-red-100/50 rounded' : 'text-emerald-600'}`}>{formatExamDate(student.analysis.language.pastExamDate)}</p>
                                </div>
                                {(student.analysis.language.examScore2 || student.analysis.language.pastExamDate2) && (
                                    <div className={`p-3 rounded-lg border print:bg-white print:border-slate-300 ${isExamExpired(student.analysis.language.pastExamDate2) ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <p className={`text-[10px] font-bold uppercase mb-1 print:text-slate-600 ${isExamExpired(student.analysis.language.pastExamDate2) ? 'text-red-600' : 'text-emerald-600'}`}>Sınav 2 {isExamExpired(student.analysis.language.pastExamDate2) && <span className="text-[9px] bg-red-100 px-1 py-0.5 rounded ml-1 text-red-700">Süresi Doldu</span>}</p>
                                        <p className={`text-sm font-bold print:text-black ${isExamExpired(student.analysis.language.pastExamDate2) ? 'text-red-800' : 'text-emerald-800'}`}>{student.analysis.language.examScore2 || '-'}</p>
                                        <p className={`text-xs mt-1 print:text-slate-500 ${isExamExpired(student.analysis.language.pastExamDate2) ? 'text-red-600 inline-block px-1.5 py-0.5 bg-red-100/50 rounded' : 'text-emerald-600'}`}>{formatExamDate(student.analysis.language.pastExamDate2)}</p>
                                    </div>
                                )}
                                {(student.analysis.language.examScore3 || student.analysis.language.pastExamDate3) && (
                                    <div className={`p-3 rounded-lg border print:bg-white print:border-slate-300 ${isExamExpired(student.analysis.language.pastExamDate3) ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <p className={`text-[10px] font-bold uppercase mb-1 print:text-slate-600 ${isExamExpired(student.analysis.language.pastExamDate3) ? 'text-red-600' : 'text-emerald-600'}`}>Sınav 3 {isExamExpired(student.analysis.language.pastExamDate3) && <span className="text-[9px] bg-red-100 px-1 py-0.5 rounded ml-1 text-red-700">Süresi Doldu</span>}</p>
                                        <p className={`text-sm font-bold print:text-black ${isExamExpired(student.analysis.language.pastExamDate3) ? 'text-red-800' : 'text-emerald-800'}`}>{student.analysis.language.examScore3 || '-'}</p>
                                        <p className={`text-xs mt-1 print:text-slate-500 ${isExamExpired(student.analysis.language.pastExamDate3) ? 'text-red-600 inline-block px-1.5 py-0.5 bg-red-100/50 rounded' : 'text-emerald-600'}`}>{formatExamDate(student.analysis.language.pastExamDate3)}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                             <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Tahmini Seviye</label>
                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-md print:border print:border-slate-200">
                                    {student.analysis?.language?.estimatedLevel || '-'}
                                </span>
                             </div>
                        )}

                        {student.analysis?.language?.wantsTutoring && (
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-2 print:bg-white print:border-slate-300">
                                <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 print:text-slate-800 shrink-0" />
                                <p className="text-sm text-indigo-800 font-medium print:text-slate-700">Öğrenci deneme sınavına katılmak ve özel ders hakkında bilgi almak istiyor.</p>
                            </div>
                        )}
                    </div>
                </div>



                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                     <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Bütçe Aralığı</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('budget')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>
                    <DisplayField label="Yıllık Bütçe Aralığı" value={student.analysis?.budget?.range} />
                </div>

                {/* Social Activities */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Sosyal Faaliyetler</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('social')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <DisplayField label="Spor" value={student.analysis?.social?.sports} />
                        <DisplayField label="Sanat" value={student.analysis?.social?.arts} />
                        <DisplayField label="Sosyal Çalışmalar" value={student.analysis?.social?.socialWork} />
                        <DisplayField label="Projeler" value={student.analysis?.social?.projects} />
                    </div>
                </div>

                {/* Citizenship Info */}
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                     <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Flag className="w-5 h-5 text-indigo-600 print:text-black" />
                            <h3 className="font-bold text-slate-800">Vatandaşlık & Pasaport</h3>
                        </div>
                        <button 
                            onClick={() => openEditModal('citizenship')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
                        >
                            <Edit2 className="w-3 h-3" />
                            Düzenle
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {student.analysis?.citizenship?.isTurkishCitizen !== false && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                    <CheckCircle className="w-3.5 h-3.5" /> Türk Vatandaşı
                                </span>
                            )}
                            {student.analysis?.citizenship?.hasGreenPassport && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                    <CheckCircle className="w-3.5 h-3.5" /> Yeşil Pasaport
                                </span>
                            )}
                            {student.analysis?.citizenship?.hasBlackPassport && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                                    <CheckCircle className="w-3.5 h-3.5" /> Siyah Pasaport
                                </span>
                            )}
                        </div>
                        
                        {student.analysis?.citizenship?.hasResidencePermit && (
                            <div className="text-sm">
                                <span className="font-bold text-slate-700">Oturum İzni:</span> 
                                <span className="ml-2 text-slate-600">{student.analysis.citizenship.residencePermitNote || 'Var'}</span>
                            </div>
                        )}
                        
                        {student.analysis?.citizenship?.hasForeignCitizenship && (
                            <div className="text-sm">
                                <span className="font-bold text-slate-700">Diğer Vatandaşlık:</span> 
                                <span className="ml-2 text-slate-600">{student.analysis.citizenship.foreignCitizenshipNote || 'Var'}</span>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 mt-4 print:hidden">
                            {studentDocuments.find(d => d.id === 'passport') ? (
                                <button 
                                    onClick={() => setActiveTab('documents')}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors rounded-xl text-sm font-bold border border-emerald-200 shadow-sm"
                                >
                                    <FileCheck className="w-4 h-4" />
                                    Pasaport Yüklendi (Görüntüle)
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setActiveTab('documents')}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-indigo-600 hover:bg-slate-50 transition-colors rounded-xl text-sm font-bold border border-slate-200 shadow-sm"
                                >
                                    <FileDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                    Pasaport Yükle
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

          </div>
        )}

        {activeTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in print:block">
                 <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-slate-300">
                        <h3 className="font-bold text-slate-800 mb-4">Required Documents</h3>
                        <div className="space-y-3">
                            {documentStatus.required.map((req, i) => {
                                const doc = studentDocuments.find(d => d.id === req.id);
                                const isCompleted = !!doc;
                                return (
                                    <div key={i} className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-xl border transition-all duration-300 print:bg-white print:border-slate-200 ${isCompleted ? 'border-slate-200' : 'border-dashed border-slate-300'}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="hidden print:block p-1">
                                                 {isCompleted ? <CheckCircle className="w-4 h-4 text-black" /> : <FileText className="w-4 h-4 text-slate-300" />}
                                            </div>
                                            <div>
                                                <span className={`block text-sm font-medium ${isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>{req.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                 </div>
            </div>
        )}

        {activeTab === 'application' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Okul Başvuruları</h3>
                    <button 
                        onClick={() => setShowAppForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> Başvuru Ekle
                    </button>
                </div>

                {showAppForm && (
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                             <input placeholder="Okul Adı" value={newApp.universityName} onChange={e => setNewApp({...newApp, universityName: e.target.value})} className="border p-2 rounded text-sm"/>
                             <input placeholder="Bölüm Adı" value={newApp.programName} onChange={e => setNewApp({...newApp, programName: e.target.value})} className="border p-2 rounded text-sm"/>
                         </div>
                         <div className="flex gap-4">
                             <select value={newApp.status} onChange={e => setNewApp({...newApp, status: e.target.value as any})} className="border p-2 rounded text-sm flex-1">
                                 <option value="Başvuru Aşamasında">Başvuru Aşamasında</option>
                                 <option value="Sonuç Bekleniyor">Sonuç Bekleniyor</option>
                                 <option value="Şartlı Kabul">Şartlı Kabul</option>
                                 <option value="Kabul">Kabul</option>
                                 <option value="Red">Red</option>
                             </select>
                             <button onClick={handleAddApplication} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Ekle</button>
                         </div>
                     </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {student.applications?.map(app => (
                        <div key={app.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                                    <GraduationCap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{app.universityName}</h4>
                                    <p className="text-sm text-slate-500">{app.programName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <select 
                                    value={app.status} 
                                    onChange={(e) => updateAppStatus(app.id, e.target.value as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        app.status === 'Kabul' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        app.status === 'Red' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                        'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    <option value="Başvuru Aşamasında">Başvuru Aşamasında</option>
                                    <option value="Sonuç Bekleniyor">Sonuç Bekleniyor</option>
                                    <option value="Şartlı Kabul">Şartlı Kabul</option>
                                    <option value="Kabul">Kabul</option>
                                    <option value="Red">Red</option>
                                </select>
                                {app.status === 'Kabul' && (
                                    <button 
                                        onClick={() => handleEnrollment(app.id)}
                                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md"
                                    >
                                        İşlem Sürecine Geç
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {(!student.applications || student.applications.length === 0) && (
                        <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                            Henüz başvuru girişi yapılmadı.
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'enrollment' && (
            <div className="p-10 text-center bg-emerald-50 border border-emerald-100 rounded-2xl">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-emerald-900">Kayıt & İşlem Süreci</h3>
                <p className="text-emerald-700 mt-2">Öğrenci okuldan kabul aldığı için kayıt ve vize işlemleri başlatılmıştır.</p>
            </div>
        )}

        {activeTab === 'visa' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/50">
                    <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                        <div className="p-3 bg-indigo-50 rounded-2xl">
                             <CreditCard className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Vize Sonuç Takibi</h3>
                            <p className="text-slate-500 text-sm font-medium">Öğrencinin vize başvuru sürecini buradan yönetebilirsiniz.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 1. Date Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Vize Başvuru Tarihi (date)
                            </label>
                            <input 
                                type="date" 
                                value={student.visaApplicationDate || ''} 
                                onChange={async (e) => {
                                    const date = e.target.value;
                                    setStudent(prev => ({ ...prev, visaApplicationDate: date }));
                                    try {
                                        await studentService.update(student.id, { visaApplicationDate: date });
                                    } catch (err) { console.error(err); }
                                }}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>

                        {/* 2. Country Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Ülke
                            </label>
                            <select 
                                value={student.visaCountry || ''} 
                                onChange={async (e) => {
                                    const country = e.target.value;
                                    setStudent(prev => ({ ...prev, visaCountry: country }));
                                    try {
                                        await studentService.update(student.id, { visaCountry: country });
                                    } catch (err) { console.error(err); }
                                }}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Seçiniz...</option>
                                {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* 3. Visa Type */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Vize Tipi
                            </label>
                            <input 
                                type="text" 
                                placeholder="Örn: F-1 Student Visa"
                                value={student.visaType || ''} 
                                onChange={async (e) => {
                                    const type = e.target.value;
                                    setStudent(prev => ({ ...prev, visaType: type }));
                                    try {
                                        await studentService.update(student.id, { visaType: type });
                                    } catch (err) { console.error(err); }
                                }}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>

                        {/* 4. Visa Status Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Vize Sonucu (Status)
                            </label>
                            <select 
                                value={student.visaStatus || 'Pending'} 
                                onChange={async (e) => {
                                    const status = e.target.value as 'Pending' | 'Approved' | 'Rejected';
                                    const updates: Partial<Student> = { visaStatus: status };
                                    if (status === 'Approved') {
                                        updates.pipelineStage = PipelineStage.STUDENT;
                                        setCurrentStage(PipelineStage.STUDENT);
                                    }
                                    setStudent(prev => ({ ...prev, ...updates }));
                                    try {
                                        await studentService.update(student.id, updates);
                                    } catch (err) { console.error(err); }
                                }}
                                className={`w-full px-5 py-3.5 border rounded-2xl text-sm font-bold focus:ring-4 outline-none transition-all appearance-none cursor-pointer ${
                                    student.visaStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500/10' : 
                                    student.visaStatus === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-700 focus:ring-rose-500/10' : 
                                    'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-500/10'
                                }`}
                            >
                                <option value="Pending">Pending</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Approved">Approved</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'contracts' && (
             <div className="p-10 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                 <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-slate-800">Sözleşme Bölümü</h3>
                 <p className="text-slate-500 mt-2">Bu bölümdeki sözleşmeler ve finansal belgeler yakında eklenecek.</p>
             </div>
        )}

        {activeTab === 'accommodation' && (
             <div className="p-10 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                 <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-slate-800">Accommodation</h3>
                 <p className="text-slate-500 mt-2">Konaklama bilgileri ve başvuru detayları yakında eklenecek.</p>
             </div>
        )}

        {activeTab === 'analysis' && (
           <div className="space-y-6 animate-fade-in">
               {!analysis && (
                   <div className="p-10 text-center text-slate-400">
                        Henüz AI Analizi yapılmadı. Lütfen üstteki "Run UNIC Analysis" butonuna tıklayın.
                   </div>
               )}
               {analysis && (
                   <>
                    {/* Preferred Degrees Details */}
                    {student.analysis?.preferences && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {[student.analysis.preferences.program1, student.analysis.preferences.program2]
                                .filter((p): p is string => !!p)
                                .map((progName, idx) => {
                                    const degree = mainDegreeDetails.find(d => d.name === progName);
                                    if (!degree) return null;
                                    return (
                                        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none h-full">
                                            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-100">
                                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                    <GraduationCap className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{degree.name}</h3>
                                                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Tercih Edilen Program {idx + 1}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Açıklama</label>
                                                    <p className="text-sm text-slate-600 leading-relaxed">{degree.description}</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Kariyer Fırsatları</label>
                                                        <p className="text-sm text-slate-600">{degree.careerOpportunities}</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">AI Etkisi</label>
                                                        <p className="text-sm text-slate-600 italic">{degree.aiImpact}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-3 border-t border-slate-100">
                                                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">En İyi Şirketler</label>
                                                     <p className="text-sm font-medium text-slate-700">{degree.topCompanies}</p>
                                                </div>
                                                <div className="pt-3 border-t border-slate-100">
                                                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Türkiye'de Sektör Durumu</label>
                                                     <p className="text-sm text-slate-600">{degree.sectorStatusTR}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* Suggested Universities – filtered from system */}
                    {(() => {
                        const prefCountries = [
                            student.analysis?.preferences?.country1,
                            student.analysis?.preferences?.country2,
                            student.analysis?.preferences?.country3,
                        ].filter(Boolean) as string[];

                        const prefPrograms = [
                            student.analysis?.preferences?.program1,
                            student.analysis?.preferences?.program2,
                        ].filter(Boolean) as string[];

                        const prefBudget = student.analysis?.preferences?.budget || student.budget;

                        // Parse budget ceiling from student's budget range string
                        const budgetCeiling = (() => {
                            if (typeof prefBudget === 'number') return prefBudget;
                            if (typeof prefBudget === 'string') {
                                const m = String(prefBudget).replace(/\./g, '').match(/\d+/g);
                                if (m) return parseInt(m[m.length - 1], 10);
                            }
                            return Infinity;
                        })();

                        const filteredUnis = allUniversities.filter((uni: any) => {
                            const uniCountries: string[] = uni.countries || [];
                            const matchesCountry = prefCountries.length === 0 || 
                                uniCountries.some(c => prefCountries.includes(c));

                            const uniPrograms: any[] = uni.programs || [];
                            const matchesProgram = prefPrograms.length === 0 ||
                                uniPrograms.some((p: any) => prefPrograms.includes(p.groupNames?.[0] || p.name));

                            const uniTuition = uni.tuitionRange || '';
                            const matchesBudget = (() => {
                                if (!uniTuition || budgetCeiling === Infinity) return true;
                                const nums = uniTuition.replace(/\./g, '').match(/\d+/g);
                                if (!nums) return true;
                                const minTuition = parseInt(nums[0], 10);
                                return minTuition <= budgetCeiling;
                            })();

                            return matchesCountry && matchesProgram && matchesBudget;
                        });

                        return (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <GraduationCap className="w-5 h-5 text-indigo-600" />
                                            Önerilen Üniversiteler
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Tercihlerinize uyan partner üniversitelerimiz</p>
                                    </div>
                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100 uppercase tracking-wider">
                                        {filteredUnis.length} Okul
                                    </span>
                                </div>

                                {filteredUnis.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                                        <p className="text-sm text-slate-500 italic">Tercihlerinize uyan üniversite bulunamadı.</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Üniversite Arama'dan manuel ekleyebilirsiniz.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredUnis.map((uni: any, idx: number) => {
                                            const isAdded = student.applications?.some(app => app.universityName === uni.name);
                                            const countryName = (uni.countries || [])[0] || '';
                                            const countryCode = getCountryCode(countryName);
                                            const programNames = (uni.programs || []).slice(0, 2).map((p: any) => p.name).join(', ');

                                            return (
                                                <div key={idx} className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                                    {/* Flag */}
                                                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                        {countryCode ? (
                                                            <img src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`} className="w-full h-full object-cover" alt={countryName} />
                                                        ) : (
                                                            <GraduationCap className="w-5 h-5 text-slate-300" />
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{uni.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                            {countryName && (
                                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{countryName}</span>
                                                            )}
                                                            {uni.tuitionRange && (
                                                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">💶 {uni.tuitionRange}</span>
                                                            )}
                                                            {programNames && (
                                                                <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{programNames}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Action */}
                                                    <button
                                                        onClick={() => addSuggestedUniversityAsOffer({ name: uni.name, country: countryName })}
                                                        disabled={isAdded}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                                            isAdded
                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default'
                                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-indigo-500/20'
                                                        }`}
                                                    >
                                                        {isAdded ? (
                                                            <><CheckCircle className="w-3.5 h-3.5" /> Eklendi</>
                                                        ) : (
                                                            <><Plus className="w-3.5 h-3.5" /> Teklif Ekle</>
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                </>
            )}
        </div>
    )}
  </div>




      {/* Edit Analysis Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in-only print:hidden">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                             <BrainCircuit className="w-6 h-6" />
                         </div>
                         <div>
                             <h3 className="text-lg font-bold text-slate-800">Öğrenci Analizi</h3>
                             <p className="text-sm text-slate-500">{student.firstName} {student.lastName}</p>
                         </div>
                    </div>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                 <div className="flex flex-1 overflow-hidden">
                    <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-2 overflow-y-auto">
                        {[
                            { id: 'contact', label: 'İletişim Bilgileri', icon: Phone },
                            { id: 'language', label: 'Dil Yeterliliği', icon: Globe },
                            { id: 'academic', label: 'Akademik Durum', icon: GraduationCap },
                            { id: 'citizenship', label: 'Vatandaşlık', icon: Flag },
                            { id: 'preferences', label: 'Tercihler', icon: BookOpen },
                            { id: 'social', label: 'Sosyal & Spor', icon: Activity },
                            { id: 'budget', label: 'Eğitim Bütçesi', icon: Coins },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveEditTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    activeEditTab === tab.id 
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {activeEditTab === 'contact' && renderEditContact()}
                        {activeEditTab === 'language' && renderEditLanguage()}
                        {activeEditTab === 'academic' && renderEditAcademic()}
                        {activeEditTab === 'citizenship' && renderEditCitizenship()}
                        {activeEditTab === 'preferences' && renderEditPreferences()}
                        {activeEditTab === 'social' && renderEditSocial()}
                        {activeEditTab === 'budget' && renderEditBudget()}
                    </div>
                </div>

                <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">Vazgeç</button>
                    <button onClick={handleSaveAnalysis} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2">
                        <Save className="w-4 h-4" /> Analizi Kaydet
                    </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetail;
