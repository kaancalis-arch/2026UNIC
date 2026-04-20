
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { studentService } from '../services/studentService';
import { systemService } from '../services/systemService';
import { interestedProgramService } from '../services/interestedProgramService';
import { mainDegreeService } from '../services/mainDegreeService';
import { countryService } from '../services/countryService';
import { Student, PipelineStage, AnalysisReport, ExamDetails } from '../types';
import {
    Search, Plus, Filter, ChevronRight, X, ChevronDown, ChevronUp,
    User, Phone, Mail, Calendar, School, Users, Globe, FileCheck,
    ClipboardList, Save, CheckCircle, AlertCircle, Trash2, Sparkles,
    GraduationCap, BookOpen, Coins, Activity, BrainCircuit, Flag
} from 'lucide-react';
import { getFlagEmoji, getCountryCode } from '../utils/countryUtils';

interface StudentListProps {
    onSelectStudent: (student: Student) => void;
    initialStageFilter?: string | null;
}

// Options will be loaded from services


const getLanguageLevelColor = (level?: string) => {
    if (!level || level === '-') return 'bg-slate-100 text-slate-600 border-slate-200';
    const warningLevels = ['A1', 'A2', 'B1'];
    const successLevels = ['B2', 'C1', 'C2', 'C2+'];

    const baseLevel = level.split(' ')[0];

    if (warningLevels.includes(baseLevel)) {
        return 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-100/50';
    }
    if (successLevels.includes(baseLevel)) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-100/50';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
};

const StudentList: React.FC<StudentListProps> = ({ onSelectStudent, initialStageFilter }) => {
    const PHONE_ERROR_MESSAGE = 'Telefon numarası 0’dan sonra 10 haneli olmalıdır.';
    const EMAIL_ERROR_MESSAGE = 'Lütfen geçerli bir e-posta adresi girin.';

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
    const [studentContactInfo, setStudentContactInfo] = useState({
        phone: '',
        email: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        parent2Name: '',
        parent2Phone: '',
        parent2Email: ''
    });

    const [showParentInfo, setShowParentInfo] = useState(false);
    const [calculatedAge, setCalculatedAge] = useState<string>('');
    const [duplicateWarning, setDuplicateWarning] = useState<string>('');
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [formErrors, setFormErrors] = useState<{ email?: string; phone?: string; targetPrograms?: string }>({});

    // Dynamic Options
    const [allPrograms, setAllPrograms] = useState<string[]>([]);
    const [allMainDegrees, setAllMainDegrees] = useState<string[]>([]);
    const [allCountries, setAllCountries] = useState<string[]>([]);
    const todayIso = new Date().toISOString().split('T')[0];
    const getInitialStage = () => {
        const validStages = Object.values(PipelineStage) as string[];
        if (initialStageFilter && validStages.includes(initialStageFilter)) {
            return initialStageFilter as PipelineStage;
        }

        return PipelineStage.FOLLOW;
    };

    const [activeStageTab, setActiveStageTab] = useState<PipelineStage>(getInitialStage);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFutureReminderFilter, setShowFutureReminderFilter] = useState(false);
    const [futureReminderUntil, setFutureReminderUntil] = useState(todayIso);

    useEffect(() => {
        const validStages = Object.values(PipelineStage) as string[];
        if (initialStageFilter && validStages.includes(initialStageFilter)) {
            setActiveStageTab(initialStageFilter as PipelineStage);
        }
    }, [initialStageFilter]);

    // Form State for New Student
    const [formData, setFormData] = useState<Partial<Student>>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '0',
        dob: '',
        hasForeignCitizenship: false,
        foreignCitizenshipNote: '',
        hasGreenPassport: false,
        parentInfo: {
            fullName: '',
            relationship: '',
            phone: '',
            email: ''
        },
        parent2Info: {
            fullName: '',
            relationship: '',
            phone: '',
            email: ''
        },
        targetPrograms: []
    });

    const formatReminderDate = (date?: string) => {
        if (!date) return '-';

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) return date;

        return parsedDate.toLocaleDateString('tr-TR');
    };

    const normalizeSearchValue = (value?: string | null) => (value || '').trim().toLocaleLowerCase('tr-TR');

    const getReminderMeta = (date?: string) => {
        if (!date) {
            return { isVisible: false, isOverdue: false, isCritical: false };
        }

        const normalizedToday = new Date(todayIso);
        const reminderDate = new Date(date);

        if (Number.isNaN(reminderDate.getTime())) {
            return { isVisible: true, isOverdue: false, isCritical: false };
        }

        const diffInDays = Math.floor((normalizedToday.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));
        const isVisible = reminderDate.getTime() <= normalizedToday.getTime();
        const isOverdue = isVisible && diffInDays >= 0;
        const isCritical = isVisible && diffInDays > 3;

        return { isVisible, isOverdue, isCritical };
    };

    const handleReminderDateUpdate = async (student: Student, reminderDate: string) => {
        const normalizedReminderDate = reminderDate || null;

        setStudents(prev => prev.map(item =>
            item.id === student.id
                ? { ...item, reminderDate: normalizedReminderDate || undefined }
                : item
        ));

        try {
            await studentService.update(student.id, { reminderDate: normalizedReminderDate || undefined });
        } catch (error: any) {
            setStudents(prev => prev.map(item =>
                item.id === student.id
                    ? { ...item, reminderDate: student.reminderDate }
                    : item
            ));
            const msg = error?.message || JSON.stringify(error);
            alert(`Reminder date güncellenemedi: ${msg}`);
        }
    };

    const getReminderFilterLimitDate = () => {
        if (!showFutureReminderFilter) {
            return todayIso;
        }

        return futureReminderUntil || todayIso;
    };

    const matchesReminderFilter = (date?: string) => {
        if (!date) {
            return false;
        }

        const reminderDate = new Date(date);
        const limitDate = new Date(getReminderFilterLimitDate());

        if (Number.isNaN(reminderDate.getTime()) || Number.isNaN(limitDate.getTime())) {
            return false;
        }

        return reminderDate.getTime() <= limitDate.getTime();
    };

    const getStudentSearchableText = (student: Student) => {
        const preferredCountries = student.analysis?.preferences
            ? [
                student.analysis.preferences.country1,
                student.analysis.preferences.country2,
                student.analysis.preferences.country3
            ]
            : [];

        const preferredPrograms = student.analysis?.preferences
            ? [
                student.analysis.preferences.program1,
                student.analysis.preferences.program2
            ]
            : [];

        return [
            student.firstName,
            student.lastName,
            `${student.firstName} ${student.lastName}`,
            student.email,
            student.phone,
            ...(student.targetCountries || []),
            ...(student.targetPrograms || []),
            ...(student.interests || []),
            ...preferredCountries,
            ...preferredPrograms
        ]
            .filter(Boolean)
            .map(value => normalizeSearchValue(String(value)))
            .join(' ');
    };

    useEffect(() => {
        loadStudents();
        loadTuitionRanges();
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            const [programs, mainDegs, countries] = await Promise.all([
                interestedProgramService.getAll(),
                mainDegreeService.getAll(),
                countryService.getAll()
            ]);
            setAllPrograms(programs.map(p => p.name));
            setAllMainDegrees(mainDegs.map(d => d.name));
            setAllCountries(countries.map(c => c.name));
        } catch (error) {
            console.error("Failed to load options", error);
        }
    };

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

    const validatePhone = (phone?: string) => {
        const normalizedPhone = phone?.trim() || '';

        if (!normalizedPhone || !/^0\d{10}$/.test(normalizedPhone)) {
            return PHONE_ERROR_MESSAGE;
        }

        return '';
    };

    const validateOptionalParentPhone = (phone?: string) => {
        const normalizedPhone = phone?.trim() || '';

        if (!normalizedPhone) {
            return '';
        }

        if (!/^0\d{10}$/.test(normalizedPhone)) {
            return 'Veli telefonu 0 ile başlamalı ve 11 haneli olmalıdır.';
        }

        return '';
    };

    const validateEmail = (email?: string) => {
        const normalizedEmail = email?.trim().toLowerCase() || '';

        if (!normalizedEmail) {
            return 'E-posta zorunludur.';
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return EMAIL_ERROR_MESSAGE;
        }

        return '';
    };

    const setFieldError = (field: 'email' | 'phone', message: string) => {
        setFormErrors(prev => ({
            ...prev,
            [field]: message || undefined
        }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        resetDuplicateWarning(name);

        if (name === 'email') {
            setFieldError('email', validateEmail(value));
        }

        if (name === 'parentInfo.phone' || name === 'parent2Info.phone') {
            let normalizedValue = value.replace(/\D/g, '');

            if (normalizedValue && !normalizedValue.startsWith('0')) {
                normalizedValue = `0${normalizedValue}`;
            }

            if (normalizedValue.length > 11) {
                normalizedValue = normalizedValue.slice(0, 11);
            }

            const errorMessage = validateOptionalParentPhone(normalizedValue);
            if (errorMessage) {
                alert(errorMessage);
            }

            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev as any)[parent],
                    [child]: normalizedValue
                }
            }));
            return;
        }

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

    const resetDuplicateWarning = (fieldName?: string) => {
        if (!fieldName || fieldName === 'email' || fieldName === 'phone') {
            setDuplicateWarning('');
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;

        // If user tries to delete the starting 0, put it back
        if (!value.startsWith('0')) {
            value = '0' + value.replace(/\D/g, '');
        } else {
            // Keep only digits
            value = '0' + value.substring(1).replace(/\D/g, '');
        }

        // Limit to 11 digits (0 + 10)
        if (value.length > 11) {
            value = value.substring(0, 11);
        }

        setFormData(prev => ({
            ...prev,
            phone: value
        }));

        resetDuplicateWarning('phone');
        setFieldError('phone', validatePhone(value));
    };

    const handleDobPartChange = (field: 'day' | 'month' | 'year', value: string) => {
        const currentDob = formData.dob || '';
        let [y = '', m = '', d = ''] = currentDob.split('-');

        const normalizedValue = value ? (field === 'year' ? value : value.padStart(2, '0')) : '';

        if (field === 'year') y = normalizedValue;
        if (field === 'month') m = normalizedValue;
        if (field === 'day') d = normalizedValue;

        if (!y && !m && !d) {
            setFormData(prev => ({
                ...prev,
                dob: ''
            }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            dob: [y, m, d].filter(Boolean).join('-')
        }));
    };

    const validateRequiredFields = () => {
        const emailError = validateEmail(formData.email);
        const phoneError = validatePhone(formData.phone);
        const targetProgramsError = !formData.targetPrograms || formData.targetPrograms.length === 0
            ? 'En az bir program seçmelisiniz.'
            : '';

        setFormErrors({
            email: emailError || undefined,
            phone: phoneError || undefined,
            targetPrograms: targetProgramsError || undefined
        });

        return !emailError && !phoneError && !targetProgramsError;
    };

    const checkDuplicateContact = async () => {
        const email = formData.email?.trim();
        const phone = formData.phone?.trim();

        if (!email && (!phone || phone === '0')) {
            return false;
        }

        setIsCheckingDuplicate(true);
        try {
            const duplicateStudent = await studentService.findDuplicateContact(email, phone);

            if (duplicateStudent) {
                const fullName = `${duplicateStudent.firstName} ${duplicateStudent.lastName}`.trim();
                const sameEmail = email && duplicateStudent.email?.trim().toLowerCase() === email.toLowerCase();
                const samePhone = phone && duplicateStudent.phone === phone;

                let warningMessage = '';
                if (sameEmail && samePhone) {
                    warningMessage = `Bu e-posta ve telefon daha önce ${fullName} adına kaydedilmiş.`;
                } else if (sameEmail) {
                    warningMessage = `Bu e-posta daha önce ${fullName} adına kaydedilmiş.`;
                } else if (samePhone) {
                    warningMessage = `Bu telefon daha önce ${fullName} adına kaydedilmiş.`;
                }

                setDuplicateWarning(warningMessage);
                alert(warningMessage);
                return true;
            }

            setDuplicateWarning('');
            return false;
        } catch (error: any) {
            const message = error?.message || 'Mükerrer kayıt kontrolü sırasında bir hata oluştu.';
            alert(message);
            return true;
        } finally {
            setIsCheckingDuplicate(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent, goToAnalysis: boolean = false) => {
        if (e) e.preventDefault();

        if (!validateRequiredFields()) {
            return;
        }

        const hasDuplicate = await checkDuplicateContact();
        if (hasDuplicate) {
            return;
        }

        try {
            // Sanitize DOB: only allow complete YYYY-MM-DD
            let sanitizedDob = null;
            if (formData.dob) {
                const parts = formData.dob.split('-');
                if (parts.length === 3 && parts.every(p => p.length > 0)) {
                    sanitizedDob = formData.dob;
                }
            }

            const newStudentPayload: Partial<Student> = {
                ...formData,
                dob: sanitizedDob,
                reminderDate: todayIso,
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
                phone: '0',
                dob: '',
                hasForeignCitizenship: false,
                foreignCitizenshipNote: '',
                hasGreenPassport: false,
                parentInfo: { fullName: '', relationship: '', phone: '', email: '' },
                parent2Info: { fullName: '', relationship: '', phone: '', email: '' },
                targetPrograms: []
            });
            setDuplicateWarning('');

            if (goToAnalysis) {
                // Open analysis modal for the newly created student
                // We need a small delay or use the direct object
                setTimeout(() => {
                    const dummyEvent = { stopPropagation: () => { } } as any;
                    openAnalysisModal(createdStudent, dummyEvent);
                }, 100);
            }

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
            budget: student.analysis?.budget || { ranges: student.analysis?.budget?.range ? [student.analysis.budget.range] : [] }
        });
        setStudentAcademicInfo({
            schoolName: student.schoolName || '',
            currentGrade: student.currentGrade || '',
            educationStatus: student.educationStatus || ''
        });
        setStudentContactInfo({
            phone: student.phone || '',
            email: student.email || '',
            parentName: student.parentInfo?.fullName || '',
            parentPhone: student.parentInfo?.phone || '',
            parentEmail: student.parentInfo?.email || '',
            parent2Name: student.parent2Info?.fullName || '',
            parent2Phone: student.parent2Info?.phone || '',
            parent2Email: student.parent2Info?.email || ''
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
            targetDegree: selectedStudentForAnalysis?.targetDegree,
            phone: studentContactInfo.phone,
            email: studentContactInfo.email,
            parentInfo: {
                ...selectedStudentForAnalysis.parentInfo,
                fullName: studentContactInfo.parentName,
                relationship: selectedStudentForAnalysis.parentInfo?.relationship || '',
                phone: studentContactInfo.parentPhone,
                email: studentContactInfo.parentEmail,
            },
            parent2Info: {
                ...selectedStudentForAnalysis.parent2Info,
                fullName: studentContactInfo.parent2Name,
                relationship: selectedStudentForAnalysis.parent2Info?.relationship || '',
                phone: studentContactInfo.parent2Phone,
                email: studentContactInfo.parent2Email,
            },
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
        if (window.confirm("Are you sure you want to delete this student?")) {
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
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">1. Sınav Skoru / Detayı</label>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">2. Sınav Skoru (İsteğe Bağlı)</label>
                                    <input
                                        type="text"
                                        value={analysisForm.language.examScore2 || ''}
                                        onChange={(e) => updateAnalysisField('language', 'examScore2', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">Sınav Tarihi</label>
                                    <input
                                        type="date"
                                        value={analysisForm.language.pastExamDate2 || ''}
                                        onChange={(e) => updateAnalysisField('language', 'pastExamDate2', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">3. Sınav Skoru (İsteğe Bağlı)</label>
                                    <input
                                        type="text"
                                        value={analysisForm.language.examScore3 || ''}
                                        onChange={(e) => updateAnalysisField('language', 'examScore3', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">Sınav Tarihi</label>
                                    <input
                                        type="date"
                                        value={analysisForm.language.pastExamDate3 || ''}
                                        onChange={(e) => updateAnalysisField('language', 'pastExamDate3', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {analysisForm.language.hasTakenExam === false && (
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">Tahmini İngilizce Seviyen Nedir?</label>
                            <select
                                value={analysisForm.language.estimatedLevel || ''}
                                onChange={(e) => updateAnalysisField('language', 'estimatedLevel', e.target.value)}
                                className={`w-full px-3 py-2.5 rounded-lg border font-bold focus:outline-none focus:ring-2 transition-all shadow-sm ${getLanguageLevelColor(analysisForm.language.estimatedLevel)}`}
                            >
                                <option value="">Seçiniz</option>
                                <option value="A1">A1 - Başlangıç</option>
                                <option value="A2">A2 - Temel</option>
                                <option value="B1">B1 - Orta</option>
                                <option value="B2">B2 - İyi</option>
                                <option value="C1">C1 - İleri</option>
                                <option value="C2">C2 - Yetkin</option>
                                <option value="Bilinmiyor">Seviyemi Bilmiyorum</option>

                            </select>
                        </div>
                    )}
                </div>

                {/* Other Languages Entry */}
                <div className="mt-6 p-4 bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Globe className="w-3.5 h-3.5" /></span>
                            Bildiğin Farklı Diller
                        </label>
                        <button 
                            onClick={() => {
                                const current = analysisForm.language.otherLanguages || [];
                                updateAnalysisField('language', 'otherLanguages', [...current, { language: '', level: '' }]);
                            }}
                            className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg transition-all hover:bg-indigo-100 active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" /> Farklı Dil Ekle
                        </button>
                    </div>
                    <div className="space-y-3">
                        {(analysisForm.language.otherLanguages || []).map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
                                <select 
                                    value={item.language}
                                    onChange={(e) => {
                                        const list = [...(analysisForm.language.otherLanguages || [])];
                                        list[idx] = { ...list[idx], language: e.target.value };
                                        updateAnalysisField('language', 'otherLanguages', list);
                                    }}
                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium text-slate-700 bg-slate-50/50"
                                >
                                    <option value="">Dil Seçiniz</option>
                                    <option value="Almanca">Almanca</option>
                                    <option value="Fransızca">Fransızca</option>
                                    <option value="İtalyanca">İtalyanca</option>
                                    <option value="İspanyolca">İspanyolca</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                                <select 
                                    value={item.level}
                                    onChange={(e) => {
                                        const list = [...(analysisForm.language.otherLanguages || [])];
                                        list[idx] = { ...list[idx], level: e.target.value };
                                        updateAnalysisField('language', 'otherLanguages', list);
                                    }}
                                    className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-indigo-600 bg-indigo-50/10"
                                >
                                    <option value="">Seviye</option>
                                    <option value="A1">A1</option>
                                    <option value="A2">A2</option>
                                    <option value="B1">B1</option>
                                    <option value="B2">B2</option>
                                    <option value="C1">C1</option>
                                    <option value="C2">C2</option>
                                </select>
                                <button 
                                    onClick={() => {
                                        const list = (analysisForm.language.otherLanguages || []).filter((_, i) => i !== idx);
                                        updateAnalysisField('language', 'otherLanguages', list);
                                    }}
                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                    title="Sil"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {(!analysisForm.language.otherLanguages || analysisForm.language.otherLanguages.length === 0) && (
                            <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                                <div className="text-slate-300 mb-1"><Globe className="w-6 h-6 opacity-30" /></div>
                                <p className="text-[11px] font-medium text-slate-400">Herhangi bir farklı dil eklenmedi.</p>
                            </div>
                        )}
                    </div>
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
                                <select 
                                    value={analysisForm.language.targetExam || ''}
                                    onChange={(e) => updateAnalysisField('language', 'targetExam', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                >
                                    <option value="">Seçiniz</option>
                                    <option value="IELTS">IELTS</option>
                                    <option value="TOEFL">TOEFL</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm text-slate-600 mb-1">Hazırlık Notları</label>
                                <textarea 
                                    value={analysisForm.language.preparationNotes || ''}
                                    onChange={(e) => updateAnalysisField('language', 'preparationNotes', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[80px]"
                                    placeholder="Hazırlık süreci ile ilgili notlar..."
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
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${analysisForm.language.wantsTutoring === true
                                        ? 'bg-violet-600 text-white shadow-md shadow-violet-200 scale-105'
                                        : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-100'
                                        }`}
                                >
                                    Evet, İstiyorum
                                </button>
                                <button
                                    onClick={() => updateAnalysisField('language', 'wantsTutoring', false)}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${analysisForm.language.wantsTutoring === false
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
            switch (studentAcademicInfo.educationStatus) {
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
                                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${isSelected
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
                                            <label className="block text-xs text-slate-500 mb-1">{key === 'AP' ? 'Lise Sınıfı' : 'Tarih'}</label>
                                            {key === 'AP' ? (
                                                <select
                                                    value={details.date || ''}
                                                    onChange={(e) => updateNestedExam(key, 'date', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                >
                                                    <option value="">Seçiniz</option>
                                                    <option value="9. Sınıf">9. Sınıf</option>
                                                    <option value="10. Sınıf">10. Sınıf</option>
                                                    <option value="11. Sınıf">11. Sınıf</option>
                                                    <option value="12. Sınıf">12. Sınıf</option>
                                                    <option value="Mezun">Mezun</option>
                                                </select>
                                            ) : (
                                                <input
                                                    type="date"
                                                    value={details.date || ''}
                                                    onChange={(e) => updateNestedExam(key, 'date', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                />
                                            )}
                                        </div>
                                        {key === 'AP' && (
                                            <div className="col-span-2">
                                                <label className="block text-xs text-slate-500 mb-1">Ders</label>
                                                <select
                                                    value={details.subject || ''}
                                                    onChange={(e) => updateNestedExam(key, 'subject', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm rounded border border-slate-300"
                                                >
                                                    <option value="">AP Dersi Seçiniz</option>
                                                    <option value="AP Precalculus">AP Precalculus</option>
                                                    <option value="AP Calculus AB">AP Calculus AB</option>
                                                    <option value="AP Calculus BC">AP Calculus BC</option>
                                                    <option value="AP Statistics">AP Statistics</option>
                                                    <option value="AP Biology">AP Biology</option>
                                                    <option value="AP Chemistry">AP Chemistry</option>
                                                    <option value="AP Environmental Science">AP Environmental Science</option>
                                                    <option value="AP Physics 1">AP Physics 1</option>
                                                    <option value="AP Physics 2">AP Physics 2</option>
                                                    <option value="AP Physics C: Mechanics">AP Physics C: Mechanics</option>
                                                    <option value="AP Physics C: Electricity & Magnetism">AP Physics C: Electricity & Magnetism</option>
                                                    <option value="AP Computer Science A">AP Computer Science A</option>
                                                    <option value="AP Computer Science Principles">AP Computer Science Principles</option>
                                                    <option value="AP Macroeconomics">AP Macroeconomics</option>
                                                    <option value="AP Microeconomics">AP Microeconomics</option>
                                                    <option value="AP Psychology">AP Psychology</option>
                                                    <option value="AP English Language">AP English Language</option>
                                                    <option value="AP English Literature">AP English Literature</option>
                                                    <option value="AP World History: Modern">AP World History: Modern</option>
                                                    <option value="AP European History">AP European History</option>
                                                    <option value="AP US History">AP US History</option>
                                                    <option value="AP Human Geography">AP Human Geography</option>
                                                    <option value="AP Comparative Government">AP Comparative Government</option>
                                                    <option value="AP US Government">AP US Government</option>
                                                    <option value="AP Art History">AP Art History</option>
                                                    <option value="AP Music Theory">AP Music Theory</option>
                                                    <option value="AP 2-D Art and Design">AP 2-D Art and Design</option>
                                                    <option value="AP 3-D Art and Design">AP 3-D Art and Design</option>
                                                    <option value="AP Drawing">AP Drawing</option>
                                                    <option value="AP Research">AP Research</option>
                                                    <option value="AP Seminar">AP Seminar</option>
                                                </select>
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
        )
    };

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
                            <option value="Bölüm konusunda kesin kararlı değilim">Bölüm konusunda kesin kararlı değilim</option>
                            {allMainDegrees.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                            <option value="Bölüm konusunda kesin kararlı değilim">Bölüm konusunda kesin kararlı değilim</option>
                            {allMainDegrees.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>

                {/* Coaching Support Request */}
                {(analysisForm.preferences.program1 === "Bölüm konusunda kesin kararlı değilim" || analysisForm.preferences.program2 === "Bölüm konusunda kesin kararlı değilim") && (
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
                                        onClick={() => updateAnalysisField('preferences', 'wantsCoaching', true)}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                            analysisForm.preferences.wantsCoaching === true
                                            ? 'bg-violet-600 text-white shadow-md shadow-violet-200 scale-105'
                                            : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-100'
                                        }`}
                                    >
                                        Evet, İstiyorum
                                    </button>
                                    <button
                                        onClick={() => updateAnalysisField('preferences', 'wantsCoaching', false)}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                            analysisForm.preferences.wantsCoaching === false
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
                                value={(analysisForm.preferences as any)[`country${i}`] || ''}
                                onChange={(e) => updateAnalysisField('preferences', `country${i}`, e.target.value)}
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
                    value={analysisForm.preferences.notes || ''}
                    onChange={(e) => updateAnalysisField('preferences', 'notes', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm min-h-[80px]"
                    placeholder="Tercihlere dair ek notlar..."
                />
            </div>
        </div>
    );

    const renderCitizenshipTab = () => (
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
                            checked={!!analysisForm.citizenship?.isTurkishCitizen}
                            onChange={(e) => updateAnalysisField('citizenship', 'isTurkishCitizen', e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Türk Vatandaşı</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!analysisForm.citizenship?.hasGreenPassport}
                            onChange={(e) => updateAnalysisField('citizenship', 'hasGreenPassport', e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Yeşil Pasaportu Var</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!analysisForm.citizenship?.hasBlackPassport}
                            onChange={(e) => updateAnalysisField('citizenship', 'hasBlackPassport', e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Siyah Pasaportu Var</span>
                    </label>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!analysisForm.citizenship?.hasResidencePermit}
                                onChange={(e) => {
                                    updateAnalysisField('citizenship', 'hasResidencePermit', e.target.checked);
                                    if (!e.target.checked) updateAnalysisField('citizenship', 'residencePermitNote', '');
                                }}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Oturum İzni Var</span>
                        </label>
                        {analysisForm.citizenship?.hasResidencePermit && (
                            <div className="ml-8">
                                <input
                                    value={analysisForm.citizenship?.residencePermitNote || ''}
                                    onChange={(e) => updateAnalysisField('citizenship', 'residencePermitNote', e.target.value)}
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
                                checked={!!analysisForm.citizenship?.hasForeignCitizenship}
                                onChange={(e) => {
                                    updateAnalysisField('citizenship', 'hasForeignCitizenship', e.target.checked);
                                    if (!e.target.checked) updateAnalysisField('citizenship', 'foreignCitizenshipNote', '');
                                }}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Farklı bir Vatandaşlığı Var</span>
                        </label>
                        {analysisForm.citizenship?.hasForeignCitizenship && (
                            <div className="ml-8">
                                <input
                                    value={analysisForm.citizenship?.foreignCitizenshipNote || ''}
                                    onChange={(e) => updateAnalysisField('citizenship', 'foreignCitizenshipNote', e.target.value)}
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

    const renderContactTab = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    Öğrenci İletişim
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Telefon</label>
                        <input value={studentContactInfo.phone} onChange={e => setStudentContactInfo({ ...studentContactInfo, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">E-posta</label>
                        <input value={studentContactInfo.email} onChange={e => setStudentContactInfo({ ...studentContactInfo, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" />
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">1. Veli</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Veli Adı Soyadı</label>
                        <input value={studentContactInfo.parentName} onChange={e => setStudentContactInfo({ ...studentContactInfo, parentName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">Telefon</label>
                            <input value={studentContactInfo.parentPhone} onChange={e => setStudentContactInfo({ ...studentContactInfo, parentPhone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">E-posta</label>
                            <input value={studentContactInfo.parentEmail} onChange={e => setStudentContactInfo({ ...studentContactInfo, parentEmail: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">2. Veli</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Veli Adı Soyadı</label>
                        <input value={studentContactInfo.parent2Name} onChange={e => setStudentContactInfo({ ...studentContactInfo, parent2Name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">Telefon</label>
                            <input value={studentContactInfo.parent2Phone} onChange={e => setStudentContactInfo({ ...studentContactInfo, parent2Phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 mb-1">E-posta</label>
                            <input value={studentContactInfo.parent2Email} onChange={e => setStudentContactInfo({ ...studentContactInfo, parent2Email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                        </div>
                    </div>
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
                    {tuitionRanges.map((option) => {
                        const isSelected = analysisForm.budget?.range === option || analysisForm.budget?.ranges?.includes(option);
                        return (
                            <label key={option} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${isSelected
                                ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                                }`}>
                                <input
                                    type="radio"
                                    name="budget_range_analysis"
                                    checked={isSelected}
                                    onChange={() => {
                                        updateAnalysisField('budget', 'range', option);
                                        updateAnalysisField('budget', 'ranges', [option]);
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

    const filteredStudents = students.filter(student => {
        const normalizedSearchQuery = normalizeSearchValue(searchQuery);
        const searchableText = getStudentSearchableText(student);
        const matchesSearch = !normalizedSearchQuery || searchableText.includes(normalizedSearchQuery);
        const matchesStage = student.pipelineStage === activeStageTab;
        const matchesReminderDate = matchesReminderFilter(student.reminderDate);

        return matchesSearch && matchesStage && matchesReminderDate;
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
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8"
            >
                {/* Background decorations */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                            CRM
                        </h1>
                        <p className="text-indigo-300/70 mt-1 text-sm">Öğrenci Yönetim Sistemi</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                            <Users className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-semibold text-white">{students.length}</span>
                            <span className="text-xs font-medium text-white/50">Toplam Öğrenci</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1 w-full space-y-3 max-w-3xl">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="İsim, e-posta, telefon, ülke veya bölüm ile ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700 select-none">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={showFutureReminderFilter}
                                onClick={() => setShowFutureReminderFilter(prev => !prev)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showFutureReminderFilter ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${showFutureReminderFilter ? 'translate-x-5' : 'translate-x-1'}`}
                                />
                            </button>
                            İleri tarihli dataları göster
                        </label>

                        {showFutureReminderFilter && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">Tarihe kadar:</span>
                                <input
                                    type="date"
                                    value={futureReminderUntil}
                                    min={todayIso}
                                    onChange={(e) => setFutureReminderUntil(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Yeni Öğrenci
                    </button>
                </div>
            </div>

            {/* Stage Tabs */}
            <div className="flex gap-8 border-b border-slate-200 mb-2">
                {[
                    { id: PipelineStage.FOLLOW, label: 'FOLLOW' },
                    { id: PipelineStage.ANALYSE, label: 'ANALYSE' },
                    { id: PipelineStage.PROCESS, label: 'PROCESS' },
                    { id: PipelineStage.ENROLLMENT, label: 'ENROLLMENT' },
                ].map(stage => (
                    <button
                        key={stage.id}
                        onClick={() => setActiveStageTab(stage.id as PipelineStage)}
                        className={`pb-4 px-2 text-sm font-bold tracking-wider transition-all relative ${activeStageTab === stage.id
                            ? 'text-indigo-600'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {stage.label}
                        {activeStageTab === stage.id && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full animate-in fade-in slide-in-from-bottom-1" />
                        )}
                    </button>
                ))}
            </div>

            {/* Student Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-slate-500 border-b border-slate-200 bg-slate-50/50">
                            <th className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider w-[25%]">Öğrenci Adı</th>
                            <th className="py-4 font-semibold text-xs uppercase tracking-wider w-[20%]">Programlar</th>
                            <th className="py-4 font-semibold text-xs uppercase tracking-wider w-[25%]">Tercihler</th>
                            <th className="py-4 font-semibold text-xs uppercase tracking-wider w-[20%]">Reminder Date</th>
                            <th className="py-4 pr-6 font-semibold text-xs uppercase tracking-wider text-right w-[10%]">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((student) => (
                            (() => {
                                const reminderMeta = getReminderMeta(student.reminderDate);
                                return (
                                    <tr
                                        key={student.id}
                                        className="group hover:bg-indigo-50/30 transition-all cursor-pointer"
                                        onClick={() => onSelectStudent(student)}
                                    >
                                        <td className="py-4 pl-6">
                                            <div>
                                                <p className="font-bold text-slate-800 leading-tight">{student.firstName}</p>
                                                <p className="font-bold text-slate-800 leading-tight">{student.lastName}</p>
                                                <div className="flex flex-col gap-0.5 mt-1">
                                                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                        <Phone className="w-3 h-3" /> {student.phone}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Programlar Column */}
                                        <td className="py-4">
                                            <div className="flex flex-col gap-1">
                                                {student.targetPrograms?.slice(0, 4).map((p, idx) => (
                                                    <span key={idx} className="w-fit px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold truncate max-w-[180px]">
                                                        {p}
                                                    </span>
                                                ))}
                                                {(!student.targetPrograms || student.targetPrograms.length === 0) && (
                                                    <span className="text-slate-400 text-xs italic">-</span>
                                                )}
                                            </div>
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
                                                        ].filter(Boolean) : student.targetCountries).slice(0, 3).map((country, i) => {
                                                            const code = getCountryCode(country);
                                                            return (
                                                                <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-xs ring-1 ring-slate-100/50">
                                                                    {code ? (
                                                                        <img
                                                                            src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                                                                            alt={country}
                                                                            className="w-4 h-4 rounded-full object-cover border border-slate-100"
                                                                        />
                                                                    ) : (
                                                                        <span className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded-full text-[8px]">{getFlagEmoji(country)}</span>
                                                                    )}
                                                                    {country}
                                                                </span>
                                                            );
                                                        })}

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
                                            <div className="flex flex-col items-start gap-1.5">
                                                <input
                                                    type="date"
                                                    value={student.reminderDate || ''}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => handleReminderDateUpdate(student, e.target.value)}
                                                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[13px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-slate-500">{formatReminderDate(student.reminderDate)}</span>
                                                    {reminderMeta.isCritical && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                                                </div>
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
                                );
                            })()
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
                <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-160px)] overflow-y-auto mb-10 animate-fade-in">
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Personal Info Section */}
                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Kişisel Bilgiler
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
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
                                                required
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="ahmet@example.com"
                                                className={`w-full pl-10 pr-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white ${formErrors.email ? 'border-rose-300' : 'border-slate-300'}`}
                                            />
                                        </div>
                                        {formErrors.email && <p className="text-xs text-rose-600 mt-1.5">{formErrors.email}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefon</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                required
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handlePhoneChange}
                                                placeholder="05xx xxx xx xx"
                                                maxLength={11}
                                                className={`w-full pl-10 pr-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white font-mono ${formErrors.phone ? 'border-rose-300' : 'border-slate-300'}`}
                                            />
                                        </div>
                                        {formErrors.phone && <p className="text-xs text-rose-600 mt-1.5">{formErrors.phone}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Doğum Tarihi</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative">
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                <select
                                                    value={formData.dob?.split('-')[2] || ''}
                                                    onChange={(e) => handleDobPartChange('day', e.target.value)}
                                                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none hover:border-indigo-300 transition-all bg-white text-sm"
                                                >
                                                    <option value="">Gün</option>
                                                    {Array.from({ length: 31 }, (_, i) => (
                                                        <option key={i + 1} value={(i + 1).toString().padStart(2, '0')}>{i + 1}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <select
                                                    value={formData.dob?.split('-')[1] || ''}
                                                    onChange={(e) => handleDobPartChange('month', e.target.value)}
                                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none hover:border-indigo-300 transition-all bg-white text-sm"
                                                >
                                                    <option value="">Ay</option>
                                                    {['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'].map((month, i) => (
                                                        <option key={i + 1} value={(i + 1).toString().padStart(2, '0')}>{month}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <select
                                                    value={formData.dob?.split('-')[0] || ''}
                                                    onChange={(e) => handleDobPartChange('year', e.target.value)}
                                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none hover:border-indigo-300 transition-all bg-white text-sm"
                                                >
                                                    <option value="">Yıl</option>
                                                    {Array.from({ length: 81 }, (_, i) => {
                                                        const year = 2030 - i;
                                                        return <option key={year} value={year.toString()}>{year}</option>;
                                                    })}
                                                </select>
                                            </div>
                                        </div>
                                        {calculatedAge && <p className="text-xs text-indigo-600 font-medium mt-1.5 ml-1">Yaş: {calculatedAge}</p>}
                                        <p className="text-xs text-slate-500 mt-1.5 ml-1">İsteğe bağlıdır.</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        {duplicateWarning && (
                                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                                <span>{duplicateWarning}</span>
                                            </div>
                                        )}
                                        {isCheckingDuplicate && (
                                            <p className="text-xs text-slate-500 mt-2">E-posta ve telefon veritabanında kontrol ediliyor...</p>
                                        )}
                                    </div>
                                </div>
                            </div>


                            {/* Target Programs Section */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Programlar
                                </h4>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">İlgilenilen Bölümler (Birden fazla seçebilirsiniz)</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {allPrograms.map(program => (
                                            <label
                                                key={program}
                                                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.targetPrograms?.includes(program)
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.targetPrograms?.includes(program)}
                                                    onChange={(e) => {
                                                        const current = formData.targetPrograms || [];
                                                        const updatedPrograms = e.target.checked
                                                            ? [...current, program]
                                                            : current.filter(p => p !== program);

                                                        setFormErrors(prev => ({
                                                            ...prev,
                                                            targetPrograms: updatedPrograms.length === 0 ? 'En az bir program seçmelisiniz.' : undefined
                                                        }));

                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, targetPrograms: updatedPrograms });
                                                        } else {
                                                            setFormData({ ...formData, targetPrograms: updatedPrograms });
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm font-medium">{program}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {formErrors.targetPrograms && (
                                        <p className="mt-3 text-sm text-rose-600 font-medium">{formErrors.targetPrograms}</p>
                                    )}
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
                                    {showParentInfo ? 'Veli Bilgilerini Gizle' : 'Veli Bilgisi Ekle'}
                                </button>

                                {showParentInfo && (
                                    <div className="space-y-6 animate-fade-in">
                                        {/* Parent 1 */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <h5 className="text-xs font-bold text-slate-400 uppercase mb-4">1. Veli Bilgileri</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Veli Adı Soyadı</label>
                                                    <input
                                                        name="parentInfo.fullName"
                                                        value={formData.parentInfo?.fullName}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Yakınlık Derecesi</label>
                                                    <input
                                                        name="parentInfo.relationship"
                                                        value={formData.parentInfo?.relationship}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                        placeholder="Anne, Baba, vb."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Veli Telefon</label>
                                                    <input
                                                        name="parentInfo.phone"
                                                        value={formData.parentInfo?.phone}
                                                        onChange={handleInputChange}
                                                        maxLength={11}
                                                        placeholder="05xx xxx xx xx"
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Veli E-posta</label>
                                                    <input
                                                        name="parentInfo.email"
                                                        value={formData.parentInfo?.email}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Parent 2 */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <h5 className="text-xs font-bold text-slate-400 uppercase mb-4">2. Veli Bilgileri</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Veli Adı Soyadı</label>
                                                    <input
                                                        name="parent2Info.fullName"
                                                        value={formData.parent2Info?.fullName}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Yakınlık Derecesi</label>
                                                    <input
                                                        name="parent2Info.relationship"
                                                        value={formData.parent2Info?.relationship}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                        placeholder="Anne, Baba, vb."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Veli Telefon</label>
                                                    <input
                                                        name="parent2Info.phone"
                                                        value={formData.parent2Info?.phone}
                                                        onChange={handleInputChange}
                                                        maxLength={11}
                                                        placeholder="05xx xxx xx xx"
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Veli E-posta</label>
                                                    <input
                                                        name="parent2Info.email"
                                                        value={formData.parent2Info?.email}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
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
                                    İptal
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleSubmit(e as any, true)}
                                    className="px-5 py-2.5 rounded-xl border border-indigo-200 text-indigo-600 font-medium hover:bg-indigo-50 transition-all flex items-center gap-2"
                                >
                                    <ClipboardList className="w-4 h-4" />
                                    Detaylı Analiz
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Analysis Modal */}
            {isAnalysisModalOpen && selectedStudentForAnalysis && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in">
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
                                        onClick={() => setActiveAnalysisTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeAnalysisTab === tab.id
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
                                {activeAnalysisTab === 'contact' && renderContactTab()}
                                {activeAnalysisTab === 'language' && renderLanguageTab()}
                                {activeAnalysisTab === 'academic' && renderAcademicTab()}
                                {activeAnalysisTab === 'citizenship' && renderCitizenshipTab()}
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
