
import React, { useState, useMemo, useEffect } from 'react';
import { Student, AnalysisResult, RoadmapStep, ExamDetails, PipelineStage, AnalysisReport, StudentDocument, AnalyseStatus, ApplicationStatus, UniversityApplication } from '../types';
import { analyzeStudentProfile, generateStudentRoadmap, askUNIC } from '../services/geminiService';
import { studentService } from '../services/studentService';
import { systemService } from '../services/systemService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
  Plus
} from 'lucide-react';

interface StudentDetailProps {
  student: Student;
  onBack: () => void;
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
  const [editAcademicInfo, setEditAcademicInfo] = useState({
    schoolName: '',
    currentGrade: '',
    educationStatus: ''
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

  useEffect(() => {
    setStudent(initialStudent);
    setCurrentStage(initialStudent.pipelineStage);
    setStudentDocuments(initialStudent.documents || []);
    loadTuitionRanges();
  }, [initialStudent]);

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

  // --- Analysis Edit Logic ---
  const openEditModal = () => {
      setEditForm({
          language: student.analysis?.language || {},
          academic: student.analysis?.academic || { exams: {} },
          social: student.analysis?.social || {},
          preferences: student.analysis?.preferences || {},
          budget: student.analysis?.budget || {}
      });
      setEditAcademicInfo({
          schoolName: student.schoolName || '',
          currentGrade: student.currentGrade || '',
          educationStatus: student.educationStatus || ''
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

  const handleSaveAnalysis = async () => {
      const updatedData: Partial<Student> = {
          schoolName: editAcademicInfo.schoolName,
          currentGrade: editAcademicInfo.currentGrade,
          educationStatus: editAcademicInfo.educationStatus as any,
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
      <div className="space-y-4">
          <div>
                <label className="block text-sm text-slate-600 mb-1">Tahmini İngilizce Seviyesi</label>
                <select 
                    value={editForm.language.estimatedLevel || ''}
                    onChange={(e) => updateEditField('language', 'estimatedLevel', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                    <option value="">Seçiniz</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                </select>
            </div>
            <div>
                <label className="block text-sm text-slate-600 mb-1">Sınava Girdi mi?</label>
                <div className="flex gap-4">
                    <button onClick={() => updateEditField('language', 'hasTakenExam', true)} className={`px-3 py-1 rounded text-sm border ${editForm.language.hasTakenExam ? 'bg-indigo-600 text-white' : 'bg-white'}`}>Evet</button>
                    <button onClick={() => updateEditField('language', 'hasTakenExam', false)} className={`px-3 py-1 rounded text-sm border ${!editForm.language.hasTakenExam ? 'bg-indigo-600 text-white' : 'bg-white'}`}>Hayır</button>
                </div>
            </div>
            {editForm.language.hasTakenExam && (
                <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Skor (örn: IELTS 6.5)" value={editForm.language.examScore || ''} onChange={e => updateEditField('language', 'examScore', e.target.value)} className="border p-2 rounded text-sm"/>
                    <input type="date" value={editForm.language.pastExamDate || ''} onChange={e => updateEditField('language', 'pastExamDate', e.target.value)} className="border p-2 rounded text-sm"/>
                </div>
            )}
             <textarea placeholder="Notlar..." value={editForm.language.languageNotes || ''} onChange={e => updateEditField('language', 'languageNotes', e.target.value)} className="w-full border p-2 rounded text-sm h-24"/>
      </div>
  );

  const renderEditAcademic = () => (
      <div className="space-y-4">
            <input placeholder="Okul Adı" value={editAcademicInfo.schoolName} onChange={e => setEditAcademicInfo({...editAcademicInfo, schoolName: e.target.value})} className="w-full border p-2 rounded text-sm"/>
            <div className="grid grid-cols-2 gap-4">
                <select value={editAcademicInfo.educationStatus} onChange={e => setEditAcademicInfo({...editAcademicInfo, educationStatus: e.target.value})} className="border p-2 rounded text-sm">
                    <option value="">Eğitim Durumu</option>
                    <option value="High School">Lise</option>
                    <option value="University">Üniversite</option>
                    <option value="Master">Yüksek Lisans</option>
                </select>
                <input placeholder="Sınıf" value={editAcademicInfo.currentGrade} onChange={e => setEditAcademicInfo({...editAcademicInfo, currentGrade: e.target.value})} className="border p-2 rounded text-sm"/>
            </div>
             <input placeholder="Bölüm" value={editForm.academic.educationField || ''} onChange={e => updateEditField('academic', 'educationField', e.target.value)} className="w-full border p-2 rounded text-sm"/>
             <input placeholder="GPA (Not Ortalaması)" value={editForm.academic.gpa || ''} onChange={e => updateEditField('academic', 'gpa', e.target.value)} className="w-full border p-2 rounded text-sm"/>
             
             <div className="space-y-2">
                 <label className="text-sm font-bold">Sınavlar</label>
                 <div className="flex flex-wrap gap-2">
                     {['SAT', 'AP', 'IB', 'TR-YOS'].map(ex => {
                         const isSel = editForm.academic.exams?.[ex]?.selected;
                         return (
                            <button key={ex} onClick={() => updateNestedExam(ex, 'selected', !isSel)} className={`px-3 py-1 rounded text-xs border ${isSel ? 'bg-indigo-100 border-indigo-500' : 'bg-white'}`}>{ex}</button>
                         )
                     })}
                 </div>
             </div>
      </div>
  );

  const renderEditPreferences = () => (
      <div className="space-y-4">
          <select value={editForm.preferences.program1 || ''} onChange={e => updateEditField('preferences', 'program1', e.target.value)} className="w-full border p-2 rounded text-sm">
              <option value="">1. Bölüm Tercihi</option>
              {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={editForm.preferences.program2 || ''} onChange={e => updateEditField('preferences', 'program2', e.target.value)} className="w-full border p-2 rounded text-sm">
              <option value="">2. Bölüm Tercihi</option>
              {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="grid grid-cols-1 gap-2">
             {[1,2,3].map(i => (
                 <select key={i} value={(editForm.preferences as any)[`country${i}`] || ''} onChange={e => updateEditField('preferences', `country${i}`, e.target.value)} className="w-full border p-2 rounded text-sm">
                     <option value="">{i}. Ülke Tercihi</option>
                     {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
             ))}
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
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4 print:border-none">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors print:hidden">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800">{student.firstName} {student.lastName}</h2>
            <div className="relative print:hidden">
                <select
                    value={currentStage}
                    onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                    className={`appearance-none cursor-pointer pl-3 pr-8 py-1 rounded-full text-xs font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
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
                <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-current" />
            </div>
            <div className="hidden print:block text-sm font-bold uppercase tracking-wider text-slate-500 border border-slate-300 px-2 py-0.5 rounded">
                Stage: {currentStage}
            </div>
          </div>
          
          <div className="mt-3 space-y-2 text-lg text-slate-600">
             <div className="flex items-center gap-6">
                 <div className="flex items-center gap-1.5">
                     <Phone className="w-4 h-4 text-slate-400" />
                     <span className="font-bold">{student.phone}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                     <Mail className="w-4 h-4 text-slate-400" />
                     {student.email}
                 </div>
             </div>
             {student.parentInfo?.fullName && (
                 <div className="flex items-center gap-3 text-slate-600 pt-2 border-t border-slate-100/50">
                    <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{student.parentInfo.fullName}</span>
                    </div>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-sm print:bg-slate-50 print:border print:border-slate-200">{student.parentInfo.relationship}</span>
                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400"/> <span className="font-bold">{student.parentInfo.phone}</span></span>
                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400"/> {student.parentInfo.email}</span>
                 </div>
             )}
          
          {/* Action Area for Stages */}
          <div className="mt-4 flex gap-3 print:hidden">
              {currentStage === PipelineStage.ANALYSE && (
                  <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                      <span className="text-xs font-bold text-indigo-700 ml-2">Analyse Status:</span>
                      {(['Mid', 'Hot', 'Super Hot'] as AnalyseStatus[]).map(status => (
                          <button 
                            key={status}
                            onClick={() => handleSetAnalyseStatus(status)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                activeAnalyseStatus === status 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                              {status}
                          </button>
                      ))}
                      <div className="w-px h-6 bg-indigo-200 mx-2" />
                      <button 
                         onClick={handleRegisterRecord}
                         className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-xs font-bold"
                      >
                          <Save className="w-3.5 h-3.5" />
                          Kayıt Oluştur
                      </button>
                  </div>
              )}
          </div>
       </div>
        </div>
        <div className="flex gap-2 print:hidden">
             <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors shadow-sm text-sm font-medium"
            >
                <Printer className="w-4 h-4" />
                Yazdır
            </button>
             <button 
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm text-sm font-medium"
            >
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4" />}
                PDF
            </button>
             <button 
                onClick={openEditModal}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
            >
                <Edit2 className="w-4 h-4" />
                Analizi Güncelle
            </button>
             <button 
                onClick={handleAnalyze}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20 text-sm font-medium"
            >
            {loading ? <span className="animate-spin">⟳</span> : <BrainCircuit className="w-4 h-4" />}
            Run UNIC Analysis
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 print:hidden">
        {[
          { id: 'profile', label: 'Profil', icon: User, visible: true },
          { id: 'analysis', label: 'AI Analiz', icon: Sparkles, visible: currentStage === PipelineStage.ANALYSE || currentStage === PipelineStage.PROCESS },
          { id: 'contracts', label: 'Sözleşme', icon: FileText, visible: currentStage === PipelineStage.PROCESS || currentStage === PipelineStage.ENROLLMENT },
          { id: 'application', label: 'Application', icon: Globe, visible: currentStage === PipelineStage.PROCESS || currentStage === PipelineStage.ENROLLMENT },
          { id: 'enrollment', label: 'Enrollment', icon: CheckCircle, visible: currentStage === PipelineStage.ENROLLMENT },
          { id: 'visa', label: 'Vize Seçıon', icon: CreditCard, visible: currentStage === PipelineStage.ENROLLMENT },
          { id: 'accommodation', label: 'Accommodation', icon: BookOpen, visible: currentStage === PipelineStage.ENROLLMENT },
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
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <GraduationCap className="w-5 h-5 text-indigo-600 print:text-black" />
                        <h3 className="font-bold text-slate-800">Akademik Bilgiler</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <DisplayField label="Okul Adı" value={student.schoolName} />
                        <DisplayField label="Sınıf / Seviye" value={student.currentGrade} />
                        <DisplayField label="Eğitim Durumu" value={student.educationStatus} />
                        <DisplayField label="Alan / Bölüm" value={student.analysis?.academic?.educationField} />
                        <DisplayField label="Not Ortalaması (GPA)" value={student.analysis?.academic?.gpa} />
                        <DisplayField label="Akademik Notlar" value={student.analysis?.academic?.academicNotes} fullWidth />
                    </div>
                </div>

                {/* Preferences */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                     <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <BookOpen className="w-5 h-5 text-indigo-600 print:text-black" />
                        <h3 className="font-bold text-slate-800 text-lg">Eğitim Tercihleri</h3>
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
                                        <span className="text-2xl">{getFlagEmoji(student.analysis.preferences.country1)}</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">1. Ülke</span>
                                            <span className="font-bold">{student.analysis.preferences.country1}</span>
                                        </div>
                                    </div>
                                )}
                                {student.analysis?.preferences?.country2 && (
                                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl shadow-sm print:shadow-none print:border-slate-300">
                                        <span className="text-2xl">{getFlagEmoji(student.analysis.preferences.country2)}</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">2. Ülke</span>
                                            <span className="font-bold">{student.analysis.preferences.country2}</span>
                                        </div>
                                    </div>
                                )}
                                {student.analysis?.preferences?.country3 && (
                                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl shadow-sm print:shadow-none print:border-slate-300">
                                        <span className="text-2xl">{getFlagEmoji(student.analysis.preferences.country3)}</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">3. Ülke</span>
                                            <span className="font-bold">{student.analysis.preferences.country3}</span>
                                        </div>
                                    </div>
                                )}
                                {!student.analysis?.preferences?.country1 && <p className="text-xs text-slate-400 italic">Ülke tercihi girilmedi.</p>}
                              </div>
                        </div>
                    </div>
                </div>

                {/* Social Activities */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <Activity className="w-5 h-5 text-indigo-600 print:text-black" />
                        <h3 className="font-bold text-slate-800">Sosyal Faaliyetler</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DisplayField label="Spor" value={student.analysis?.social?.sports} />
                        <DisplayField label="Sanat" value={student.analysis?.social?.arts} />
                        <DisplayField label="Sosyal Çalışmalar" value={student.analysis?.social?.socialWork} />
                        <DisplayField label="Projeler" value={student.analysis?.social?.projects} />
                    </div>
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
                     <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <Globe className="w-5 h-5 text-indigo-600 print:text-black" />
                        <h3 className="font-bold text-slate-800">Dil Yeterliliği</h3>
                    </div>
                    <div className="space-y-4">
                        {student.analysis?.language?.hasTakenExam ? (
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 print:bg-white print:border-slate-300">
                                <p className="text-xs text-emerald-600 font-medium mb-1 print:text-slate-600">Sınav Skoru</p>
                                <p className="text-sm font-bold text-emerald-800 print:text-black">{student.analysis.language.examScore}</p>
                                <p className="text-xs text-emerald-600 mt-1 print:text-slate-500">{student.analysis.language.pastExamDate}</p>
                            </div>
                        ) : (
                             <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Tahmini Seviye</label>
                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-md print:border print:border-slate-200">
                                    {student.analysis?.language?.estimatedLevel || '-'}
                                </span>
                             </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <FileText className="w-5 h-5 text-indigo-600 print:text-black" />
                        <h3 className="font-bold text-slate-800">Sınavlar</h3>
                    </div>
                    {student.analysis?.academic?.exams && Object.keys(student.analysis.academic.exams).length > 0 ? (
                         <div className="space-y-4">
                            {Object.entries(student.analysis.academic.exams as Record<string, ExamDetails>).map(([examName, details]) => {
                                if (!details.selected) return null;
                                return (
                                    <div key={examName} className="bg-slate-50 p-3 rounded-xl border border-slate-100 print:bg-white print:border-slate-300">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-700">{examName}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${details.status === 'Taken' ? 'bg-emerald-100 text-emerald-700 print:bg-white print:border print:border-slate-300' : 'bg-amber-100 text-amber-700 print:bg-white print:border print:border-slate-300'}`}>
                                                {details.status === 'Taken' ? 'Girdi' : 'Hazırlanıyor'}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                         </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Kayıtlı sınav bilgisi yok.</p>
                    )}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border print:border-slate-300 print:shadow-none">
                     <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <CreditCard className="w-5 h-5 text-indigo-600 print:text-black" />
                        <h3 className="font-bold text-slate-800">Bütçe</h3>
                    </div>
                    <DisplayField label="Yıllık Bütçe Aralığı" value={student.analysis?.budget?.range} />
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
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-600" />
                        Vize Sonuç Takibi
                    </h3>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                         <div>
                             <p className="text-sm font-bold text-indigo-900">Vize Sonucu</p>
                             <p className="text-xs text-indigo-700">Vize onaylandığında öğrenci statüsünü güncelleyin.</p>
                         </div>
                         <button 
                            onClick={async () => {
                                try {
                                    await studentService.update(student.id, { pipelineStage: PipelineStage.STUDENT });
                                    setStudent(prev => ({ ...prev, pipelineStage: PipelineStage.STUDENT }));
                                    setCurrentStage(PipelineStage.STUDENT);
                                } catch (e) {
                                    console.error("Failed to approve visa", e);
                                }
                            }}
                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                         >
                             Vize Onaylandı (Approved)
                         </button>
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
                    <div className="grid grid-cols-3 gap-6 print:grid-cols-1 print:gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center print:border-slate-300 print:shadow-none print:flex-row print:justify-start print:gap-4 print:text-left">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2 print:mb-0 ${analysis.visaRiskScore > 50 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {analysis.visaRiskScore}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 uppercase">Visa Risk Score</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                        <h3 className="font-bold text-slate-800 mb-4">Suggested Universities</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 print:bg-white print:border-b print:border-slate-300">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">University</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Country</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {analysis.suggestedUniversities.map((uni, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-medium text-slate-700">{uni.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{uni.country}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                   </>
               )}
           </div> 
        )}
      </div>

      {/* Edit Analysis Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 print:hidden">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
                    <h3 className="text-lg font-bold text-slate-800">Öğrenci Analizini Güncelle</h3>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-56 bg-slate-50 border-r border-slate-200 p-3 space-y-1">
                        {[
                            { id: 'language', label: 'Dil Yeterliliği', icon: Globe },
                            { id: 'academic', label: 'Akademik', icon: GraduationCap },
                            { id: 'preferences', label: 'Tercihler', icon: BookOpen },
                            { id: 'social', label: 'Sosyal & Spor', icon: Activity },
                            { id: 'budget', label: 'Bütçe', icon: CreditCard },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveEditTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    activeEditTab === tab.id 
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                                    : 'text-slate-500 hover:bg-white/50'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {activeEditTab === 'language' && renderEditLanguage()}
                        {activeEditTab === 'academic' && renderEditAcademic()}
                        {activeEditTab === 'preferences' && renderEditPreferences()}
                        {activeEditTab === 'social' && (
                             <div className="space-y-4">
                                <input placeholder="Spor" value={editForm.social.sports || ''} onChange={e => updateEditField('social', 'sports', e.target.value)} className="w-full border p-2 rounded text-sm"/>
                             </div>
                        )}
                    </div>
                </div>

                <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium">Vazgeç</button>
                    <button onClick={handleSaveAnalysis} className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Kaydet
                    </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetail;
