
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SystemUser, UserRole, CountryData, EducationType, UniversityData, MainDegreeData, MainCategoryData, InterestedProgramData, SharedInstitutionData, AIAgent } from '../types';
import { MOCK_USERS, MOCK_BRANCHES, MOCK_COUNTRIES, MOCK_UNIVERSITIES } from '../services/mockData';
import { countryService } from '../services/countryService';
import { universityService } from '../services/universityService';
import { universityTypeService } from '../services/universityTypeService';
import { mainDegreeService } from '../services/mainDegreeService';
import { mainCategoryService } from '../services/mainCategoryService';
import { interestedProgramService } from '../services/interestedProgramService';
import { sharedInstitutionService } from '../services/sharedInstitutionService';
import { systemService } from '../services/systemService';
import { 
    Settings as SettingsIcon, Users, Building, GraduationCap, 
    Shield, CheckCircle, XCircle, Plus, MoreVertical, Edit2, Trash2, 
    Briefcase, Globe, MapPin, Banknote, Users2, ArrowLeft, BookOpen,
    Calendar, FileText, Star, Briefcase as BriefcaseIcon, Clock, Loader2,
    Link as LinkIcon, ExternalLink, Cpu, Key, Save, X, Database, RefreshCw, Download, Search, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatTitleCase } from '../lib/utils';

// University Types with Descriptions (default values)
const DEFAULT_UNIVERSITY_TYPES = [
    { id: 'ut-001', name: "Araştırma Üniversitesi", description: "Yoğun araştırma faaliyetleri yürüten, güçlü akademik kadroya sahip üniversiteler", link: "" },
    { id: 'ut-002', name: "Russell Group", description: "Birleşik Krallık'ın önde gelen 24 araştırma üniversitesinin birliği", link: "https://russellgroup.ac.uk/" },
    { id: 'ut-003', name: "Ivy League", description: "ABD'nin sekiz en prestijli üniversitesinin oluşturduğu lig", link: "https://www.ivyleague.com/" },
    { id: 'ut-004', name: "TU9", description: "Almanya'nın dokuz lider teknik üniversitesinin birliği", link: "https://www.tu9.de/" },
    { id: 'ut-005', name: "Uygulamalı Bilimler", description: "Pratik ve uygulamaya yönelik eğitim veren üniversiteler (Fachhochschule)", link: "" },
    { id: 'ut-006', name: "Tasarım Üniversiteleri", description: "Görsel sanatlar, tasarım ve mimarlık alanında uzmanlaşmış üniversiteler", link: "" },
    { id: 'ut-007', name: "Top 100", description: "Dünya genelinde en iyi 100 üniversite arasında yer alanlar", link: "" },
    { id: 'ut-008', name: "Top 200", description: "Dünya genelinde en iyi 200 üniversite arasında yer alanlar", link: "" },
    { id: 'ut-009', name: "Top 500", description: "Dünya genelinde en iyi 500 üniversite arasında yer alanlar", link: "" },
    { id: 'ut-010', name: "Devlet Üniversitesi", description: "Devlet tarafından finanse edilen üniversiteler", link: "" },
    { id: 'ut-011', name: "Özel Üniversite", description: "Özel sektör tarafından finanse edilen üniversiteler", link: "" },
    { name: "Community College", description: "2 yıllık ön lisans programları sunan kolejler", link: "" }
];

// Standard list for Dropdown
const STANDARD_EDUCATION_TYPES = [
    "Devlet Üniversitesi (State University)",
    "Özel Üniversite (Private University)",
    "Araştırma Üniversitesi (Research University)",
    "Uygulamalı Bilimler (Applied Sciences / Fachhochschule)",
    "Teknik Üniversite (Technical University)",
    "Community College (2 Yıllık)",
    "Sanat Okulu / Konservatuar (Conservatory)",
    "İşletme Okulu (Business School)",
    "Hukuk Okulu (Law School)",
    "Tıp Fakültesi (Medical School)",
    "Polytechnic",
    "Liberal Arts College",
    "Meslek Yüksekokulu (Vocational School)"
];

const DefinitionCard = ({ id, title, icon: Icon, count, onClick }: any) => (
    <div 
        onClick={() => onClick(id)}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group"
    >
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h4 className="font-bold text-slate-800">{title}</h4>
                <p className="text-sm text-slate-500">{count} kayıt tanımlı</p>
            </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100">
            <MoreVertical className="w-4 h-4" />
        </div>
    </div>
);

const Settings: React.FC<{ onUniversitySelect?: (university: UniversityData) => void }> = ({ onUniversitySelect }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'definitions' | 'career' | 'data'>('users');
    const [users, setUsers] = useState<SystemUser[]>(MOCK_USERS);
    const [branches] = useState(MOCK_BRANCHES);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    
    // Definitions State
    const [selectedDefinitionType, setSelectedDefinitionType] = useState<string | null>(null);
    const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
    const [countries, setCountries] = useState<CountryData[]>([]);
    const [isLoadingCountries, setIsLoadingCountries] = useState(false);

    // University State
    const [universities, setUniversities] = useState<UniversityData[]>([]);
    const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
    const [isUniversityModalOpen, setIsUniversityModalOpen] = useState(false);
    const [universityForm, setUniversityForm] = useState<UniversityData>({
        id: '',
        name: '',
        logo: '',
        countries: [],
        rankingUrl: '',
        websiteUrl: '',
        departmentsUrl: '',
        consultingType: '',
        universityTypes: [],
        sharedInstitutionId: '',
        programs: []
    });
    
    // University Filter State
    const [universitySearchTerm, setUniversitySearchTerm] = useState('');
    const [expandedUniversityId, setExpandedUniversityId] = useState<string | null>(null);
    const [isImportingUniversities, setIsImportingUniversities] = useState(false);
    const [showLogoUpload, setShowLogoUpload] = useState(false);
    
    // University Types State
    const [universityTypesList, setUniversityTypesList] = useState<typeof DEFAULT_UNIVERSITY_TYPES>([]);
    const [isUniversityTypeModalOpen, setIsUniversityTypeModalOpen] = useState(false);
    const [universityTypeForm, setUniversityTypeForm] = useState({ id: '', name: '', description: '', link: '' });
    const [editingUniversityTypeIndex, setEditingUniversityTypeIndex] = useState<number | null>(null);
    const [isLoadingUniversityTypes, setIsLoadingUniversityTypes] = useState(false);

    // Main Degree / Category State
    const [mainDegrees, setMainDegrees] = useState<MainDegreeData[]>([]);
    
    // AI Agents State
    const [aiAgents, setAiAgents] = useState<AIAgent[]>([
        { id: 'agent-1', name: 'Danışman Asistanı', jobTitle: 'Senior Advisor', workDescription: 'Öğrencilere üniversite başvuru süreçlerinde rehberlik eder.', aiModel: 'gemini-2.5-flash', apiKey: '', permissions: ['students.read', 'universities.read'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Danışman1' },
        { id: 'agent-2', name: 'Belge Analisti', jobTitle: 'Document Analyst', workDescription: 'Başvuru belgelerini analiz eder ve değerlendirir.', aiModel: 'gemini-2.5-flash', apiKey: '', permissions: ['documents.read', 'documents.write'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Belge1' },
        { id: 'agent-3', name: 'Kariyer Koçu', jobTitle: 'Career Coach', workDescription: 'Öğrencilere kariyer planlaması konusunda rehberlik eder.', aiModel: 'gemini-2.5-flash', apiKey: '', permissions: ['students.read', 'universities.read'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kariyer1' },
        { id: 'agent-4', name: 'Başvuru Uzmanı', jobTitle: 'Application Specialist', workDescription: 'Üniversite başvuru süreçlerini yönetir ve takip eder.', aiModel: 'gemini-2.5-flash', apiKey: '', permissions: ['students.read', 'documents.write'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Başvuru1' }
    ]);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentForm, setAgentForm] = useState<AIAgent>({
        id: '', name: '', jobTitle: '', workDescription: '', aiModel: 'gemini-2.5-flash', apiKey: '', permissions: []
    });
    const [mainCategories, setMainCategories] = useState<MainCategoryData[]>([]);
    const [degreeSubTab, setDegreeSubTab] = useState<'main' | 'sub'>('sub');
    const [isLoadingMainDegrees, setIsLoadingMainDegrees] = useState(false);
    
    const [isMainCategoryModalOpen, setIsMainCategoryModalOpen] = useState(false);
    const [mainCategoryForm, setMainCategoryForm] = useState<MainCategoryData>({
        id: '',
        name: '',
        description: ''
    });

    const [isMainDegreeModalOpen, setIsMainDegreeModalOpen] = useState(false);
    const [mainDegreeForm, setMainDegreeForm] = useState<MainDegreeData>({
        id: '',
        name: '',
        description: '',
        careerOpportunities: '',
        aiImpact: '',
        topCompanies: '',
        sectorStatusTR: '',
        imageUrl: '',
        categoryIds: []
    });

    // Interested Program State (New)
    const [interestedPrograms, setInterestedPrograms] = useState<InterestedProgramData[]>([]);
    const [isLoadingInterestedPrograms, setIsLoadingInterestedPrograms] = useState(false);
    const [isInterestedProgramModalOpen, setIsInterestedProgramModalOpen] = useState(false);
    const [interestedProgramForm, setInterestedProgramForm] = useState<InterestedProgramData>({
        id: '',
        name: '',
        description: ''
    });

    // Shared Institutions State (New)
    const [sharedInstitutions, setSharedInstitutions] = useState<SharedInstitutionData[]>([]);
    const [isLoadingSharedInstitutions, setIsLoadingSharedInstitutions] = useState(false);
    const [isSharedInstitutionModalOpen, setIsSharedInstitutionModalOpen] = useState(false);
    const [sharedInstitutionForm, setSharedInstitutionForm] = useState<SharedInstitutionData>({
        id: '',
        name: '',
        description: ''
    });
    
    // Tuition Ranges State
    const [tuitionRanges, setTuitionRanges] = useState<string[]>([]);

    // Budget Ranges State (CRUD)
    const [budgetRangesList, setBudgetRangesList] = useState<any[]>([]);
    const [isLoadingBudgetRanges, setIsLoadingBudgetRanges] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [budgetForm, setBudgetForm] = useState({ id: '', label: '', sort_order: 0 });

    // Country Edit/Create State
    const [isEditingCountry, setIsEditingCountry] = useState(false);
    const [countryForm, setCountryForm] = useState<CountryData>(MOCK_COUNTRIES[0]);
    const [isSavingCountry, setIsSavingCountry] = useState(false);

    // User Form State
    const [newUser, setNewUser] = useState<Partial<SystemUser>>({
        full_name: '',
        email: '',
        phone: '',
        role: UserRole.CONSULTANT,
        branch_id: '',
        status: 'active',
        parent_user_id: ''
    });

    // Load definitions
    useEffect(() => {
        if (selectedDefinitionType === 'countries') {
            loadCountries();
        } else if (selectedDefinitionType === 'universities') {
            loadUniversities();
            loadCountries(); 
            loadTuitionRanges();
            loadMainDegrees(); // Added to fix empty dropdown in university programs
            loadSharedInstitutions(); // Added to support selection dropdown
        } else if (selectedDefinitionType === 'degrees') {
            loadMainDegrees();
        } else if (selectedDefinitionType === 'interested_programs') {
            loadInterestedPrograms();
        } else if (selectedDefinitionType === 'shared_institutions') {
            loadSharedInstitutions();
        } else if (selectedDefinitionType === 'all_programs') {
            loadUniversities();
            loadTuitionRanges();
            loadMainDegrees();
        } else if (selectedDefinitionType === 'budget') {
            loadBudgetRangesList();
        } else if (selectedDefinitionType === 'university_types') {
            loadUniversityTypes();
        }
    }, [selectedDefinitionType]);

    const loadCountries = async () => {
        setIsLoadingCountries(true);
        try {
            const data = await countryService.getAll();
            setCountries(data);
            if (data.length > 0 && !selectedCountryId) {
                setSelectedCountryId(data[0].id);
            }
        } catch (error) {
            console.error('Failed to load countries', error);
        } finally {
            setIsLoadingCountries(false);
        }
    };

    const loadUniversities = async () => {
        setIsLoadingUniversities(true);
        try {
            const data = await universityService.getAll();
            setUniversities(data);
        } catch (error) {
            console.error('Failed to load universities', error);
        } finally {
            setIsLoadingUniversities(false);
        }
    };

    const loadUniversityTypes = async () => {
        setIsLoadingUniversityTypes(true);
        try {
            const data = await universityTypeService.getAll();
            setUniversityTypesList(data);
        } catch (error) {
            console.error('Failed to load university types', error);
        } finally {
            setIsLoadingUniversityTypes(false);
        }
    };

    const loadTuitionRanges = async () => {
        try {
            const ranges = await systemService.getTuitionRanges();
            setTuitionRanges(ranges);
        } catch (error) {
            console.error('Failed to load tuition ranges', error);
        }
    };

    const loadBudgetRangesList = async () => {
        setIsLoadingBudgetRanges(true);
        try {
            const ranges = await systemService.getBudgetRangesRaw();
            setBudgetRangesList(ranges);
        } catch (error) {
            console.error('Failed to load budget ranges', error);
        } finally {
            setIsLoadingBudgetRanges(false);
        }
    };

    const loadMainDegrees = async () => {
        setIsLoadingMainDegrees(true);
        try {
            const [degrees, cats, junctions] = await Promise.all([
                mainDegreeService.getAll(),
                mainCategoryService.getAll(),
                mainCategoryService.getJunctions()
            ]);
            
            // Map junctions to degrees
            const enrichedDegrees = degrees.map(deg => ({
                ...deg,
                categoryIds: junctions
                    .filter(j => j.program_id === deg.id)
                    .map(j => j.category_id)
            }));
            
            setMainDegrees(enrichedDegrees as MainDegreeData[]);
            setMainCategories(cats);
        } catch (error) {
            console.error('Failed to load degrees data', error);
        } finally {
            setIsLoadingMainDegrees(false);
        }
    };

    const loadInterestedPrograms = async () => {
        setIsLoadingInterestedPrograms(true);
        try {
            const data = await interestedProgramService.getAll();
            setInterestedPrograms(data);
        } catch (error) {
            console.error('Failed to load interested programs', error);
        } finally {
            setIsLoadingInterestedPrograms(false);
        }
    };

    const loadSharedInstitutions = async () => {
        setIsLoadingSharedInstitutions(true);
        try {
            const data = await sharedInstitutionService.getAll();
            setSharedInstitutions(data);
        } catch (error) {
            console.error('Failed to load shared institutions', error);
        } finally {
            setIsLoadingSharedInstitutions(false);
        }
    };

    // User Actions
    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        const createdUser: SystemUser = {
            id: `user-${Date.now()}`,
            full_name: newUser.full_name || '',
            email: newUser.email || '',
            phone: newUser.phone || '',
            role: newUser.role || UserRole.CONSULTANT,
            branch_id: newUser.branch_id || '',
            parent_user_id: newUser.parent_user_id,
            status: newUser.status || 'active',
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.full_name}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        setUsers([...users, createdUser]);
        setIsUserModalOpen(false);
        setNewUser({
            full_name: '',
            email: '',
            phone: '',
            role: UserRole.CONSULTANT,
            branch_id: '',
            status: 'active',
            parentId: ''
        });
    };

    const toggleUserStatus = (id: string) => {
        setUsers(users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));
    };

    const deleteUser = (id: string) => {
        if(window.confirm('Are you sure you want to delete this user?')) {
            setUsers(users.filter(u => u.id !== id));
        }
    };

    const getAvailableParents = (role?: UserRole) => {
        switch (role) {
            case UserRole.ADMIN:
                return users.filter(u => u.role === UserRole.SUPER_ADMIN);
            case UserRole.BRANCH_MANAGER:
                return users.filter(u => u.role === UserRole.ADMIN);
            case UserRole.CONSULTANT:
                return users.filter(u => u.role === UserRole.BRANCH_MANAGER);
            case UserRole.REPRESENTATIVE:
                return users.filter(u => u.role === UserRole.CONSULTANT || u.role === UserRole.BRANCH_MANAGER);
            case UserRole.STUDENT_REPRESENTATIVE:
                return users.filter(u => u.role === UserRole.REPRESENTATIVE || u.role === UserRole.CONSULTANT || u.role === UserRole.BRANCH_MANAGER);
            case UserRole.STUDENT:
                return users.filter(u => u.role === UserRole.REPRESENTATIVE || u.role === UserRole.CONSULTANT || u.role === UserRole.BRANCH_MANAGER);
            default:
                return [];
        }
    };

    // --- UNIVERSITY LOGIC ---
    const handleAddUniversity = async () => {
        await loadUniversityTypes();
        setUniversityForm({
            id: `uni-${Date.now()}`,
            name: '',
            logo: 'https://qwualszqafxjorumgttv.supabase.co/storage/v1/object/sign/Unic_Main/UNIC%20The%20Uni%20Counsllor%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yZjYzOGI0OC0wNTc0LTQ2OTItYmQwZi1lZDk3NzM3Njk2ODkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJVbmljX01haW4vVU5JQyBUaGUgVW5pIENvdW5zbGxvciBMb2dvLnBuZyIsImlhdCI6MTc3NTA1NDcyOCwiZXhwIjoxODYxNDU0NzI4fQ.pJMQfiNoz3LZcj8Uq_cG9iEJvhWacE4kmUmxDcRqvq8',
            countries: [],
            rankingUrl: '',
            websiteUrl: '',
            departmentsUrl: '',
            consultingType: '',
            universityTypes: [],
            programs: []
        });
        setIsUniversityModalOpen(true);
    };

    const handleEditUniversity = async (uni: UniversityData) => {
        await loadUniversityTypes();
        setUniversityForm({
            ...uni,
            programs: uni.programs || []
        });
        setIsUniversityModalOpen(true);
    };

    const handleSaveUniversity = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const savedUni = await universityService.upsert(universityForm);
            setUniversities(prev => {
                const idx = prev.findIndex(u => u.id === savedUni.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = savedUni;
                    return updated;
                }
                return [savedUni, ...prev];
            });
            setIsUniversityModalOpen(false);
        } catch (error) {
            console.error("Failed to save university", error);
            alert("Failed to save university");
        }
    };

    const handleDeleteUniversity = async (id: string) => {
        if(!window.confirm("Are you sure you want to delete this university?")) return;
        try {
            await universityService.delete(id);
            setUniversities(prev => prev.filter(u => u.id !== id));
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    // --- AI AGENT LOGIC ---
    const handleAddAgent = () => {
        setAgentForm({
            id: `agent-${Date.now()}`,
            name: '',
            jobTitle: '',
            workDescription: '',
            aiModel: 'gemini-2.5-flash',
            apiKey: '',
            permissions: []
        });
        setEditingAgentId(null);
        setIsAgentModalOpen(true);
    };

    const handleEditAgent = (agentId: string) => {
        const agent = aiAgents.find(a => a.id === agentId);
        if (agent) {
            setAgentForm(agent);
            setEditingAgentId(agentId);
            setIsAgentModalOpen(true);
        }
    };

    const handleSaveAgent = () => {
        if (editingAgentId) {
            setAiAgents(prev => prev.map(a => a.id === editingAgentId ? agentForm : a));
        } else {
            setAiAgents(prev => [...prev, agentForm]);
        }
        setIsAgentModalOpen(false);
        setAgentForm({ id: '', name: '', jobTitle: '', workDescription: '', aiModel: 'gemini-2.5-flash', apiKey: '', permissions: [] });
        setEditingAgentId(null);
    };

    const handleDeleteAgent = (agentId: string) => {
        if (window.confirm('Bu agenti silmek istediğinize emin misiniz?')) {
            setAiAgents(prev => prev.filter(a => a.id !== agentId));
        }
    };

    // --- EXCEL IMPORT/EXPORT LOGIC ---
    const filteredUniversities = universities.filter(uni => 
        !universitySearchTerm || 
        uni.name?.toLowerCase().includes(universitySearchTerm.toLowerCase()) ||
        uni.countries?.some(c => c.toLowerCase().includes(universitySearchTerm.toLowerCase()))
    );

    const handleExportUniversities = () => {
        const exportData = filteredUniversities.map(uni => ({
            'ID': uni.id,
            'Üniversite Adı': uni.name,
            'Logo URL': uni.logo || '',
            'Website': uni.websiteUrl || '',
            'Departments URL': uni.departmentsUrl || '',
            'Ranking URL': uni.rankingUrl || '',
            'Ülkeler': uni.countries?.join(', ') || '',
            'Üniversite Tipleri': uni.universityTypes?.join(', ') || '',
            'Danışmanlık Türü': uni.consultingType || '',
            'Paylaşımlı Kurum': uni.sharedInstitutionId || '',
            'Bölüm Sayısı': uni.programs?.length || 0
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Üniversiteler');
        XLSX.writeFile(wb, `UNIC_Universiteler_${Date.now()}.xlsx`);
    };

    const handleExportPrograms = () => {
        const allPrograms: any[] = [];
        filteredUniversities.forEach(uni => {
            (uni.programs || []).forEach(prog => {
                allPrograms.push({
                    'Üniversite ID': uni.id,
                    'Üniversite': uni.name,
                    'Ülke': uni.countries?.join(', ') || '',
                    'Üniversite Tipi': uni.universityTypes?.join(', ') || '',
                    'Bölüm Adı': prog.name,
                    'Bölüm Türü': prog.type,
                    'Bütçe': prog.tuitionRange || '',
                    'Eğitim Türü': prog.educationType || '',
                    'Link': prog.link || '',
                    'Kampüs': prog.campusLocation || '',
                    'Başvuru Kriterleri': prog.applicationCriteria || '',
                    'Dil Skoru': prog.languageScore || '',
                    'Alt Başlıklar': prog.groupNames?.join(', ') || '',
                    'Notlar': prog.notes || ''
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(allPrograms);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bölümler');
        XLSX.writeFile(wb, `UNIC_Bolumler_${Date.now()}.xlsx`);
    };

    const handleImportUniversities = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImportingUniversities(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

                let importedCount = 0;
                const defaultLogo = 'https://qwualszqafxjorumgttv.supabase.co/storage/v1/object/sign/Unic_Main/UNIC%20The%20Uni%20Counsllor%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yZjYzOGI0OC0wNTc0LTQ2OTItYmQwZi1lZDk3NzM3Njk2ODkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJVbmljX01haW4vVU5JQyBUaGUgVW5pIENvdW5zbGxvciBMb2dvLnBuZyIsImlhdCI6MTc3NTA1NDcyOCwiZXhwIjoxODYxNDU0NzI4fQ.pJMQfiNoz3LZcj8Uq_cG9iEJvhWacE4kmUmxDcRqvq8';
                for (const row of jsonData) {
                    const newUni: UniversityData = {
                        id: row['ID'] || `uni-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: row['Üniversite Adı'] || row['University Name'] || 'Unknown',
                        logo: row['Logo URL'] || row['Logo'] || defaultLogo,
                        websiteUrl: row['Website'] || row['Website URL'] || '',
                        departmentsUrl: row['Departments URL'] || row['Departments'] || '',
                        rankingUrl: row['Ranking URL'] || row['Ranking'] || '',
                        countries: row['Ülkeler'] ? String(row['Ülkeler']).split(',').map((s: string) => s.trim()) : [],
                        universityTypes: row['Üniversite Tipleri'] ? String(row['Üniversite Tipleri']).split(',').map((s: string) => s.trim()) : [],
                        consultingType: row['Danışmanlık Türü'] || row['Consulting Type'] || '',
                        sharedInstitutionId: row['Paylaşımlı Kurum'] || row['Shared Institution'] || '',
                        programs: []
                    };

                    try {
                        await universityService.upsert(newUni);
                        setUniversities(prev => {
                            const exists = prev.find(u => u.id === newUni.id);
                            if (exists) {
                                return prev.map(u => u.id === newUni.id ? newUni : u);
                            }
                            return [newUni, ...prev];
                        });
                        importedCount++;
                    } catch (err) {
                        console.error('Failed to import university:', newUni.name, err);
                    }
                }

                alert(`${importedCount} üniversite başarıyla içe aktarıldı!`);
            } catch (error) {
                console.error('Failed to parse Excel file', error);
                alert('Excel dosyası okunurken bir hata oluştu.');
            } finally {
                setIsImportingUniversities(false);
                e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- UNIVERSITY PROGRAM LOGIC ---
    const addUniversityProgram = () => {
        const newProgram: any = {
            id: `prog-${Date.now()}`,
            type: 'Bachelor',
            name: '',
            groupNames: [],
            link: '',
            tuitionRange: '',
            campusLocation: '',
            applicationCriteria: '',
            languageScore: '',
            notes: ''
        };
        setUniversityForm(prev => ({
            ...prev,
            programs: [...(prev.programs || []), newProgram]
        }));
    };

    const updateUniversityProgram = (id: string, field: string, value: any) => {
        setUniversityForm(prev => ({
            ...prev,
            programs: (prev.programs || []).map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    const removeUniversityProgram = (id: string) => {
        setUniversityForm(prev => ({
            ...prev,
            programs: (prev.programs || []).filter(p => p.id !== id)
        }));
    };

    // --- ALL PROGRAMS LOGIC (CENTRAL) ---
    const [isAllProgramModalOpen, setIsAllProgramModalOpen] = useState(false);
    const [allProgramForm, setAllProgramForm] = useState<any>({
        id: '',
        universityId: '',
        type: 'Bachelor',
        name: '',
        groupNames: [],
        link: '',
        tuitionRange: '',
        campusLocation: '',
        applicationCriteria: '',
        languageScore: '',
        notes: ''
    });

    const handleAddCentralProgram = () => {
        setAllProgramForm({
            id: `prog-${Date.now()}`,
            universityId: '',
            type: 'Bachelor',
            name: '',
            groupNames: [],
            link: '',
            tuitionRange: '',
            campusLocation: '',
            applicationCriteria: '',
            languageScore: '',
            notes: ''
        });
        setIsAllProgramModalOpen(true);
    };

    const handleEditCentralProgram = (prog: any, universityId: string) => {
        setAllProgramForm({
            ...prog,
            universityId
        });
        setIsAllProgramModalOpen(true);
    };

    const handleSaveCentralProgram = async () => {
        if (!allProgramForm.universityId) {
            alert("Lütfen bir üniversite seçiniz.");
            return;
        }

        const uni = universities.find(u => u.id === allProgramForm.universityId);
        if (!uni) return;

        let updatedPrograms = [...(uni.programs || [])];
        const index = updatedPrograms.findIndex(p => p.id === allProgramForm.id);

        const { universityId, ...programData } = allProgramForm;

        if (index > -1) {
            updatedPrograms[index] = programData;
        } else {
            updatedPrograms.push(programData);
        }

        const updatedUni = { ...uni, programs: updatedPrograms };
        
        try {
            await universityService.upsert(updatedUni);
            setUniversities(prev => prev.map(u => u.id === uni.id ? updatedUni : u));
            setIsAllProgramModalOpen(false);
        } catch (error) {
            console.error("Program kaydedilemedi", error);
            alert("Kaydedilirken bir hata oluştu.");
        }
    };

    const handleDeleteCentralProgram = async (progId: string, universityId: string) => {
         if (!window.confirm("Bu programı silmek istediğinize emin misiniz?")) return;
         
         const uni = universities.find(u => u.id === universityId);
         if (!uni) return;

         const updatedUni = {
             ...uni,
             programs: (uni.programs || []).filter(p => p.id !== progId)
         };

         try {
             await universityService.upsert(updatedUni);
             setUniversities(prev => prev.map(u => u.id === universityId ? updatedUni : u));
         } catch (error) {
             console.error("Program silinemedi", error);
         }
    };

    // --- MAIN DEGREE LOGIC ---
    const handleAddMainDegree = () => {
        setMainDegreeForm({
            id: `deg-${Date.now()}`,
            name: '',
            description: '',
            careerOpportunities: '',
            aiImpact: '',
            topCompanies: '',
            sectorStatusTR: '',
            imageUrl: '',
            categoryIds: []
        });
        setIsMainDegreeModalOpen(true);
    };

    const handleEditMainDegree = (deg: MainDegreeData) => {
        setMainDegreeForm(deg);
        setIsMainDegreeModalOpen(true);
    };

    const handleAddMainCategory = () => {
        setMainCategoryForm({ id: `cat-${Date.now()}`, name: '', description: '' });
        setIsMainCategoryModalOpen(true);
    };

    const handleEditMainCategory = (cat: MainCategoryData) => {
        setMainCategoryForm(cat);
        setIsMainCategoryModalOpen(true);
    };

    const handleSaveMainCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const saved = await mainCategoryService.upsert(mainCategoryForm);
            setMainCategories(prev => {
                const idx = prev.findIndex(c => c.id === saved.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = saved;
                    return updated;
                }
                return [saved, ...prev];
            });
            setIsMainCategoryModalOpen(false);
        } catch (error) {
            console.error("Failed to save category", error);
            alert("Kategori kaydedilemedi");
        }
    };

    const handleDeleteMainCategory = async (id: string) => {
        if (!confirm("Bu ana bölümü silmek istediğinize emin misiniz?")) return;
        try {
            await mainCategoryService.delete(id);
            setMainCategories(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error("Delete category failed", error);
        }
    };

    const handleSaveMainDegree = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const savedDeg = await mainDegreeService.upsert(mainDegreeForm);

            // Update junction assignments
            if (mainDegreeForm.categoryIds) {
                await mainCategoryService.updateAssignments(savedDeg.id, mainDegreeForm.categoryIds);
            }

            // Sync local state
            setMainDegrees(prev => {
                const enriched = { ...savedDeg, categoryIds: mainDegreeForm.categoryIds };
                const idx = prev.findIndex(d => d.id === savedDeg.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = enriched;
                    return updated;
                }
                return [enriched, ...prev];
            });
            setIsMainDegreeModalOpen(false);
        } catch (error) {
            console.error("Failed to save main degree", error);
            alert("Failed to save main degree");
        }
    };

    const handleDeleteMainDegree = async (id: string) => {
        if(!window.confirm("Are you sure you want to delete this degree?")) return;
        try {
            await mainDegreeService.delete(id);
            setMainDegrees(prev => prev.filter(d => d.id !== id));
        } catch (error) {
            console.error("Failed to delete main degree", error);
        }
    };

    // --- INTERESTED PROGRAM LOGIC ---
    const handleAddInterestedProgram = () => {
        setInterestedProgramForm({
            id: `intp-${Date.now()}`,
            name: '',
            description: ''
        });
        setIsInterestedProgramModalOpen(true);
    };

    const handleEditInterestedProgram = (prog: InterestedProgramData) => {
        setInterestedProgramForm(prog);
        setIsInterestedProgramModalOpen(true);
    };

    const handleSaveInterestedProgram = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const savedProg = await interestedProgramService.upsert(interestedProgramForm);
            setInterestedPrograms(prev => {
                const idx = prev.findIndex(p => p.id === savedProg.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = savedProg;
                    return updated;
                }
                return [savedProg, ...prev];
            });
            setIsInterestedProgramModalOpen(false);
        } catch (error) {
            console.error("Failed to save interested program", error);
        }
    };

    const handleDeleteInterestedProgram = async (id: string) => {
        if(!window.confirm("Are you sure?")) return;
        try {
            await interestedProgramService.delete(id);
            setInterestedPrograms(prev => prev.filter(p => p.id !== id));
        } catch (error) { console.error(error); }
    };

    // --- SHARED INSTITUTION LOGIC ---
    const handleAddSharedInstitution = () => {
        setSharedInstitutionForm({
            id: `shint-${Date.now()}`,
            name: '',
            contactName: '',
            contactInfo: ''
        });
        setIsSharedInstitutionModalOpen(true);
    };

    const handleEditSharedInstitution = (inst: SharedInstitutionData) => {
        setSharedInstitutionForm(inst);
        setIsSharedInstitutionModalOpen(true);
    };

    const handleSaveSharedInstitution = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const savedInst = await sharedInstitutionService.upsert(sharedInstitutionForm);
            setSharedInstitutions(prev => {
                const idx = prev.findIndex(p => p.id === savedInst.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = savedInst;
                    return updated;
                }
                return [savedInst, ...prev];
            });
            setIsSharedInstitutionModalOpen(false);
        } catch (error) {
            console.error("Failed to save shared institution", error);
        }
    };

    const handleDeleteSharedInstitution = async (id: string) => {
        if(!window.confirm("Bu kurumu silmek istediğinize emin misiniz?")) return;
        try {
            await sharedInstitutionService.delete(id);
            setSharedInstitutions(prev => prev.filter(p => p.id !== id));
        } catch (error) { console.error(error); }
    };

    // --- COUNTRY MANAGEMENT LOGIC ---

    const handleCreateNewCountry = () => {
        const newCountry: CountryData = {
            id: `country-${Date.now()}`,
            name: 'New Country',
            flag: '🏳️',
            capital: '',
            currency: '',
            population: '',
            cities: [],
            imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop',
            educationSystemDescription: '',
            bachelorTypes: [],
            masterTypes: [],
            postGradWorkPermit: '',
            yksRequirement: '',
            popularJobs: []
        };
        setCountryForm(newCountry);
        setIsEditingCountry(true);
        setSelectedCountryId(newCountry.id); 
    };

    const handleEditCountry = (country: CountryData) => {
        setCountryForm(country);
        setIsEditingCountry(true);
    };

    const handleSaveCountry = async () => {
        setIsSavingCountry(true);
        try {
            const savedCountry = await countryService.upsert(countryForm);
            
            setCountries(prev => {
                const index = prev.findIndex(c => c.id === savedCountry.id);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = savedCountry;
                    return updated;
                } else {
                    return [...prev, savedCountry];
                }
            });
            
            setIsEditingCountry(false);
            setSelectedCountryId(savedCountry.id);
        } catch (error: any) {
            alert("Failed to save country: " + error.message);
        } finally {
            setIsSavingCountry(false);
        }
    };

    const updateCountryField = (field: keyof CountryData, value: any) => {
        setCountryForm(prev => ({ ...prev, [field]: value }));
    };

    const updateEducationType = (
        degree: 'bachelor' | 'master', 
        index: number, 
        field: keyof EducationType, 
        value: string
    ) => {
        const targetList = degree === 'bachelor' ? 'bachelorTypes' : 'masterTypes';
        const newList = [...countryForm[targetList]];
        newList[index] = { ...newList[index], [field]: value };
        setCountryForm(prev => ({ ...prev, [targetList]: newList }));
    };

    const addEducationType = (degree: 'bachelor' | 'master') => {
        const targetList = degree === 'bachelor' ? 'bachelorTypes' : 'masterTypes';
        const limit = 5; // Updated limit to 5

        if (countryForm[targetList].length >= limit) return;

        setCountryForm(prev => ({
            ...prev,
            [targetList]: [...prev[targetList], { name: '', description: '' }]
        }));
    };

    const removeEducationType = (degree: 'bachelor' | 'master', index: number) => {
        const targetList = degree === 'bachelor' ? 'bachelorTypes' : 'masterTypes';
        setCountryForm(prev => ({
            ...prev,
            [targetList]: prev[targetList].filter((_, i) => i !== index)
        }));
    };

    // --- RENDERERS ---

    const renderUserManagement = () => (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">User Management</h3>
                    <p className="text-sm text-slate-500">Manage admins, consultants, and representatives.</p>
                </div>
                <button 
                    onClick={() => setIsUserModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                            <th className="px-6 py-4 font-semibold">User</th>
                            <th className="px-6 py-4 font-semibold">Role</th>
                            <th className="px-6 py-4 font-semibold">Reports To</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => {
                            const parent = users.find(u => u.id === user.parentId);
                            return (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full bg-slate-100" />
                                            <div>
                                                <p className="font-bold text-slate-800">{user.full_name}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                            user.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            user.role === UserRole.CONSULTANT ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            user.role === UserRole.REPRESENTATIVE ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {parent ? (
                                            <div className="flex items-center gap-2">
                                                <img src={parent.avatarUrl} className="w-5 h-5 rounded-full" />
                                                <span className="font-medium text-slate-700">{parent.full_name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => toggleUserStatus(user.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                            user.isActive 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                        }`}>
                                            {user.isActive ? (
                                                <><CheckCircle className="w-3 h-3" /> Active</>
                                            ) : (
                                                <><XCircle className="w-3 h-3" /> Passive</>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => deleteUser(user.id)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderUniversityManager = () => {
        return (
            <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
                 {/* Header */}
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                setSelectedDefinitionType(null);
                                setUniversitySearchTerm('');
                                setExpandedUniversityId(null);
                            }}
                            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">University Management</h3>
                            <p className="text-sm text-slate-500">Add, edit or remove partner universities.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer">
                            {isImportingUniversities ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Excel Yükle
                            <input 
                                type="file" 
                                accept=".xlsx,.xls" 
                                onChange={handleImportUniversities}
                                className="hidden"
                            />
                        </label>
                        <button 
                            onClick={handleExportUniversities}
                            className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Excel İndir
                        </button>
                        <button 
                            onClick={handleExportPrograms}
                            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded-xl hover:bg-orange-700 transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Bölümleri İndir
                        </button>
                        <button 
                            onClick={handleAddUniversity}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            New University
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Üniversite ara..." 
                            value={universitySearchTerm}
                            onChange={(e) => setUniversitySearchTerm(e.target.value)}
                            className="w-full sm:w-80 pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                {/* Results Count */}
                <div className="mb-4">
                    <p className="text-sm font-medium text-slate-500">
                        <span className="text-slate-800 font-bold">{filteredUniversities.length}</span> üniversite bulundu
                    </p>
                </div>

                {/* Table */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                    <th className="px-6 py-4 font-semibold">University</th>
                                    <th className="px-6 py-4 font-semibold">Countries</th>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold">Links & Ranking</th>
                                    <th className="px-6 py-4 font-semibold">Programs</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingUniversities ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-slate-500">Loading universities...</td>
                                    </tr>
                                ) : filteredUniversities.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-slate-500">No universities found. Add one to get started.</td>
                                    </tr>
                                ) : (
                                    filteredUniversities.map(uni => (
                                        <React.Fragment key={uni.id}>
                                            <tr 
                                                onClick={() => {
                                                    if (onUniversitySelect) {
                                                        onUniversitySelect(uni);
                                                    } else {
                                                        setExpandedUniversityId(expandedUniversityId === uni.id ? null : uni.id);
                                                    }
                                                }}
                                                className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedUniversityId === uni.id ? 'bg-indigo-50/30' : ''}`}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-24 h-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                            {uni.logo ? (
                                                                <img src={uni.logo} alt={uni.name} className="w-full h-full object-contain" />
                                                            ) : (
                                                                <img 
                                                                    src={`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(uni.name)}&backgroundColor=f1f5f9`} 
                                                                    alt="" 
                                                                    className="w-full h-full object-cover opacity-60" 
                                                                />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 leading-tight">{uni.name}</div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">{uni.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(uni.countries || []).map(c => (
                                                            <span key={c} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">{c}</span>
                                                        ))}
                                                        {(uni.countries || []).length === 0 && <span className="text-slate-400 italic text-[10px]">No country</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(uni.universityTypes || []).map(t => (
                                                            <span key={t} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium border border-indigo-200">{t}</span>
                                                        ))}
                                                        {(uni.universityTypes || []).length === 0 && <span className="text-slate-400 italic text-[10px]">-</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-3">
                                                            {uni.websiteUrl && <a href={uni.websiteUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Website"><Globe className="w-4 h-4" /></a>}
                                                            {uni.departmentsUrl && <a href={uni.departmentsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Departments"><BookOpen className="w-4 h-4" /></a>}
                                                            {uni.rankingUrl && <a href={uni.rankingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ranking"><Star className="w-4 h-4" /></a>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100">
                                                            {(uni.programs || []).length} Programs
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditUniversity(uni); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteUniversity(uni.id); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Expanded Department View */}
                                            {expandedUniversityId === uni.id && (
                                                <tr key={`${uni.id}-expanded`}>
                                                    <td colSpan={5} className="px-6 py-4 bg-indigo-50/30 border-b border-indigo-100">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                                <BookOpen className="w-4 h-4 text-indigo-600" />
                                                                Bölümler ({uni.programs?.length || 0})
                                                            </h4>
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleEditUniversity(uni);
                                                                }}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                Bölüm Ekle
                                                            </button>
                                                        </div>
                                                        {(uni.programs && uni.programs.length > 0) ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {uni.programs.map(prog => (
                                                                    <div key={prog.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1">
                                                                                <h5 className="font-bold text-slate-800 text-sm">{prog.name}</h5>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${prog.type === 'Master' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                                        {prog.type}
                                                                                    </span>
                                                                                    {prog.tuitionRange && (
                                                                                        <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                                            {prog.tuitionRange}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {prog.link && (
                                                                                <a href={prog.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                        {prog.groupNames && prog.groupNames.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                                {prog.groupNames.map((gn: string) => (
                                                                                    <span key={gn} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-medium">
                                                                                        {gn}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8 text-slate-500">
                                                                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                                <p className="text-sm">Bu üniversite için henüz bölüm tanımlanmamış.</p>
                                                                <button 
                                                                    onClick={() => handleEditUniversity(uni)}
                                                                    className="mt-2 text-indigo-600 text-sm font-medium hover:underline"
                                                                >
                                                                    Bölüm eklemek için tıklayın
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderMainDegreeManager = () => (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Bölüm Grupları</h3>
                        <p className="text-sm text-slate-500">Akademik programları Ana Bölümler ve Alt Başlıklar halinde düzenleyin.</p>
                    </div>
                </div>
                <button 
                    onClick={degreeSubTab === 'main' ? handleAddMainCategory : handleAddMainDegree}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 shadow-indigo-500/20 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    {degreeSubTab === 'main' ? 'Yeni Ana Bölüm Ekle' : 'Yeni Alt Başlık Ekle'}
                </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-6">
                <button 
                    onClick={() => setDegreeSubTab('main')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                        degreeSubTab === 'main' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Ana Bölümler
                </button>
                <button 
                    onClick={() => setDegreeSubTab('sub')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                        degreeSubTab === 'sub' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Alt Başlıklar
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold">{degreeSubTab === 'main' ? 'Ana Bölüm Adı' : 'Alt Başlık Adı'}</th>
                                <th className="px-6 py-4 font-semibold">{degreeSubTab === 'main' ? 'Açıklama' : 'Atanan Gruplar'}</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingMainDegrees ? (
                                <tr>
                                    <td colSpan={3} className="p-10 text-center text-slate-500 italic">Veriler yükleniyor...</td>
                                </tr>
                            ) : degreeSubTab === 'main' ? (
                                mainCategories.length === 0 ? (
                                    <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">Henüz ana bölüm tanımlanmamış.</td></tr>
                                ) : mainCategories.map(cat => (
                                    <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                    <Shield className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <span className="font-bold text-slate-800">{cat.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-500 text-sm">
                                            {cat.description || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEditMainCategory(cat)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteMainCategory(cat.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                mainDegrees.length === 0 ? (
                                    <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">Henüz alt başlık tanımlanmamış.</td></tr>
                                ) : mainDegrees.map(deg => (
                                    <tr key={deg.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                                                    {deg.imageUrl ? <img src={deg.imageUrl} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-6 h-6 text-slate-300" />}
                                                </div>
                                                <span className="font-bold text-slate-800">{deg.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(deg.categoryIds || []).length > 0 ? (
                                                    deg.categoryIds?.map(catId => {
                                                        const cat = mainCategories.find(c => c.id === catId);
                                                        return cat ? (
                                                            <span key={catId} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100 uppercase">
                                                                {cat.name}
                                                            </span>
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">Gruplanmamış</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEditMainDegree(deg)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteMainDegree(deg.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderAllProgramsManager = () => {
        const allProgs = universities.flatMap(u => (u.programs || []).map(p => ({ 
            ...p, 
            universityId: u.id, 
            universityName: u.name,
            country: (u.countries && u.countries.length > 0) ? u.countries[0] : '-' 
        })));

        return (
            <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Bölümler</h3>
                            <p className="text-sm text-slate-500">Tüm üniversitelerin programlarını tek bir listeden yönetin.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleAddCentralProgram}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Yeni Bölüm Ekle
                    </button>
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                    <th className="px-6 py-4 font-semibold">Üniversite</th>
                                    <th className="px-6 py-4 font-semibold">Ülke</th>
                                    <th className="px-6 py-4 font-semibold">Tür</th>
                                    <th className="px-6 py-4 font-semibold">Bölüm Adı</th>
                                    <th className="px-6 py-4 font-semibold">Bütçe</th>
                                    <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allProgs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-slate-500">Henüz hiç bölüm tanımlanmamış.</td>
                                    </tr>
                                ) : (
                                    allProgs.map(prog => (
                                        <tr key={prog.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-800 font-bold">{prog.universityName}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-600 font-medium">{prog.country}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${prog.type === 'Master' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {prog.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="font-bold text-slate-800">{prog.name}</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(prog.groupNames || []).length > 0 ? (
                                                            prog.groupNames.map((gn: string) => (
                                                                <span key={gn} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold border border-indigo-100 uppercase">
                                                                    {gn}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[9px] text-slate-300 italic">Gruplanmamış</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{prog.tuitionRange || 'N/A'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEditCentralProgram(prog, prog.universityId)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteCentralProgram(prog.id, prog.universityId)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* CENTRAL PROGRAM MODAL */}
                {isAllProgramModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                                <h3 className="text-xl font-bold text-slate-800">Bölüm Düzenle</h3>
                                <button onClick={() => setIsAllProgramModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Üniversite Seçin</label>
                                        <select 
                                            value={allProgramForm.universityId}
                                            onChange={(e) => setAllProgramForm({...allProgramForm, universityId: e.target.value})}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="">Üniversite Seçin...</option>
                                            {universities.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bölüm Adı</label>
                                        <input 
                                            value={allProgramForm.name}
                                            onChange={(e) => setAllProgramForm({...allProgramForm, name: formatTitleCase(e.target.value)})}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bölüm Türü</label>
                                        <div className="flex gap-2">
                                            {['Bachelor', 'Master'].map(t => (
                                                <button 
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setAllProgramForm({...allProgramForm, type: t as any})}
                                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${allProgramForm.type === t ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-indigo-200'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alt Başlıklar (Bölüm Grupları)</label>
                                        <select 
                                            multiple
                                            value={allProgramForm.groupNames}
                                            onChange={(e) => {
                                                const select = e.target as HTMLSelectElement;
                                                const values = Array.from(select.selectedOptions, (option: HTMLOptionElement) => option.value);
                                                setAllProgramForm({...allProgramForm, groupNames: values});
                                            }}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm min-h-[100px] focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                        >
                                            {mainDegrees.map(deg => (
                                                <option key={deg.id} value={deg.name}>{deg.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1 italic">Bu bölümün hangi ana kategorilerde/gruplarda listeleneceğini seçin.</p>
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bölüm Linki</label>
                                        <input 
                                            value={allProgramForm.link}
                                            onChange={(e) => setAllProgramForm({...allProgramForm, link: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Eğitim Bütçesi</label>
                                        <select 
                                            value={allProgramForm.tuitionRange}
                                            onChange={(e) => setAllProgramForm({...allProgramForm, tuitionRange: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        >
                                            <option value="">Bütçe Seç...</option>
                                            {tuitionRanges.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                    <button onClick={() => setIsAllProgramModalOpen(false)} className="px-6 py-2 text-slate-600 font-medium">İptal</button>
                                    <button onClick={handleSaveCentralProgram} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">Kaydet</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderInterestedProgramManager = () => (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Program Tanımları</h3>
                        <p className="text-sm text-slate-500">Öğrenci tercihlerinde listelenecek ana akademik alanları tanımlayın.</p>
                    </div>
                </div>
                <button 
                    onClick={handleAddInterestedProgram}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Program Tanımı
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold">Program Adı</th>
                                <th className="px-6 py-4 font-semibold">Açıklama</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingInterestedPrograms ? (
                                <tr>
                                    <td colSpan={3} className="p-10 text-center text-slate-500">Loading programs...</td>
                                </tr>
                            ) : interestedPrograms.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-10 text-center text-slate-500">No programs defined yet.</td>
                                </tr>
                            ) : (
                                interestedPrograms.map(prog => (
                                    <tr key={prog.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{prog.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{prog.description}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEditInterestedProgram(prog)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteInterestedProgram(prog.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderSharedInstitutionManager = () => (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Kurumlar</h3>
                        <p className="text-sm text-slate-500">Sistemdeki kurum tanımlarını (paylaşımlı vb.) buradan yönetin.</p>
                    </div>
                </div>
                <button 
                    onClick={handleAddSharedInstitution}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Kurum
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold">Kurum Adı</th>
                                <th className="px-6 py-4 font-semibold">Yetkili Adı</th>
                                <th className="px-6 py-4 font-semibold">İletişim Bilgileri</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingSharedInstitutions ? (
                                <tr>
                                    <td colSpan={4} className="p-10 text-center text-slate-500">Yükleniyor...</td>
                                </tr>
                            ) : sharedInstitutions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-10 text-center text-slate-500">Henüz kurum eklenmedi.</td>
                                </tr>
                            ) : (
                                sharedInstitutions.map(inst => (
                                    <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{inst.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{inst.contactName || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{inst.contactInfo || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEditSharedInstitution(inst)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteSharedInstitution(inst.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderCountryManager = () => {
        const selectedCountry = countries.find(c => c.id === selectedCountryId) || (countries.length > 0 ? countries[0] : countryForm);
        const dataToShow = isEditingCountry ? countryForm : selectedCountry;

        return (
            <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
                {/* Back Button & Title */}
                <div className="flex items-center gap-4 mb-6">
                    <button 
                        onClick={() => {
                            if (isEditingCountry) {
                                if (window.confirm("Changes will be lost. Exit?")) setIsEditingCountry(false);
                            } else {
                                setSelectedDefinitionType(null);
                            }
                        }}
                        className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">
                            {isEditingCountry ? (countryForm.id.startsWith('country-') ? 'Add New Country' : 'Edit Country') : 'Country Definitions'}
                        </h3>
                        <p className="text-sm text-slate-500">Manage education systems, requirements, and country details.</p>
                    </div>
                </div>

                {isLoadingCountries ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> Loading countries...
                    </div>
                ) : (
                    <div className="flex flex-1 gap-6 overflow-hidden">
                        {/* Sidebar List (Disabled when editing) */}
                        <div className={`w-64 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-opacity ${isEditingCountry ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Countries List</h4>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                {countries.map(country => (
                                    <button
                                        key={country.id}
                                        onClick={() => setSelectedCountryId(country.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                                            selectedCountryId === country.id 
                                            ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                        }`}
                                    >
                                        <span className="text-lg">{country.flag}</span>
                                        <span className="font-medium text-sm">{country.name}</span>
                                    </button>
                                ))}
                                {countries.length === 0 && <div className="p-4 text-center text-sm text-slate-400">No countries found.</div>}
                            </div>
                            <div className="p-3 border-t border-slate-100">
                                <button 
                                    onClick={handleCreateNewCountry}
                                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Country
                                </button>
                            </div>
                        </div>

                        {/* Main Content Area (View or Edit) */}
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto custom-scrollbar relative">
                            
                            {/* COVER IMAGE & HEADER */}
                            <div className="h-48 w-full relative group">
                                <img src={dataToShow.imageUrl} className="w-full h-full object-cover" alt={dataToShow.name} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                
                                <div className="absolute bottom-6 left-6 text-white w-full pr-12">
                                    {isEditingCountry ? (
                                        <div className="flex items-center gap-3">
                                            <input 
                                                value={countryForm.flag} 
                                                onChange={(e) => updateCountryField('flag', e.target.value)}
                                                className="bg-white/20 border border-white/30 text-center rounded-lg w-12 h-12 text-2xl focus:outline-none focus:ring-2 focus:ring-white"
                                                placeholder="🏳️"
                                            />
                                            <input 
                                                value={countryForm.name} 
                                                onChange={(e) => updateCountryField('name', e.target.value)}
                                                className="bg-transparent border-b border-white/50 text-3xl font-bold text-white placeholder-white/50 focus:outline-none focus:border-white w-full max-w-md"
                                                placeholder="Ülke Adı"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-4xl">{dataToShow.flag}</span>
                                            <h2 className="text-3xl font-bold tracking-tight">{dataToShow.name}</h2>
                                        </div>
                                    )}
                                </div>

                                {!isEditingCountry && countries.length > 0 && (
                                    <button 
                                        onClick={() => handleEditCountry(dataToShow)}
                                        className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-lg text-white transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                )}

                                {isEditingCountry && (
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button 
                                            onClick={() => setIsEditingCountry(false)}
                                            className="px-4 py-2 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                                        >
                                            İptal
                                        </button>
                                        <button 
                                            onClick={handleSaveCountry}
                                            disabled={isSavingCountry}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-bold shadow-lg transition-colors flex items-center gap-2 disabled:opacity-70"
                                        >
                                            {isSavingCountry ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />} 
                                            Değişiklikleri Kaydet
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* CONTENT BODY */}
                            <div className="p-8 space-y-8">
                                
                                {/* SECTION 1: BASIC STATS */}
                                {isEditingCountry ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Capital</label>
                                            <input value={countryForm.capital} onChange={(e) => updateCountryField('capital', e.target.value)} className="w-full border p-2 rounded-lg text-sm" placeholder="Capital City" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Currency</label>
                                            <input value={countryForm.currency} onChange={(e) => updateCountryField('currency', e.target.value)} className="w-full border p-2 rounded-lg text-sm" placeholder="e.g. USD ($)" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Population</label>
                                            <input value={countryForm.population} onChange={(e) => updateCountryField('population', e.target.value)} className="w-full border p-2 rounded-lg text-sm" placeholder="e.g. 80 Million" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Image URL</label>
                                            <input value={countryForm.imageUrl} onChange={(e) => updateCountryField('imageUrl', e.target.value)} className="w-full border p-2 rounded-lg text-sm" placeholder="https://..." />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <MapPin className="w-4 h-4" /> Capital
                                            </div>
                                            <p className="text-lg font-semibold text-slate-800">{dataToShow.capital}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <Banknote className="w-4 h-4" /> Currency
                                            </div>
                                            <p className="text-lg font-semibold text-slate-800">{dataToShow.currency}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <Users2 className="w-4 h-4" /> Population
                                            </div>
                                            <p className="text-lg font-semibold text-slate-800">{dataToShow.population}</p>
                    </div>
                </div>
            )}

                                {/* SECTION 2: BACHELOR'S DEGREE (LISANS) */}
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg border-b border-slate-100 pb-2">
                                        <GraduationCap className="w-5 h-5 text-indigo-600" /> Lisans Eğitimi (Bachelor's)
                                    </h4>
                                    <div className="space-y-4">
                                        {/* Types Loop */}
                                        <div className="space-y-4">
                                            {dataToShow.bachelorTypes.length === 0 && (
                                                <p className="text-slate-400 italic text-sm">No bachelor types defined.</p>
                                            )}
                                            {dataToShow.bachelorTypes.map((type, index) => (
                                                <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative group">
                                                    {isEditingCountry && (
                                                        <button 
                                                            onClick={() => removeEducationType('bachelor', index)}
                                                            className="absolute top-2 right-2 p-1.5 bg-white text-rose-500 border border-rose-100 rounded-md hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                                        {/* Type Name */}
                                                        <div className="md:col-span-1">
                                                            {isEditingCountry ? (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tür Adı</label>
                                                                    <select 
                                                                        value={type.name}
                                                                        onChange={(e) => updateEducationType('bachelor', index, 'name', e.target.value)}
                                                                        className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-2 focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                                                    >
                                                                        <option value="">Seçiniz</option>
                                                                        {STANDARD_EDUCATION_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <h5 className="font-bold text-slate-800 text-lg">{type.name}</h5>
                                                            )}
                                                        </div>

                                                        {/* Description */}
                                                        <div className="md:col-span-2">
                                                            {isEditingCountry ? (
                                                                <div>
                                                                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Açıklama</label>
                                                                     <textarea 
                                                                        rows={3}
                                                                        value={type.description}
                                                                        onChange={(e) => updateEducationType('bachelor', index, 'description', e.target.value)}
                                                                        className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20"
                                                                        placeholder="Bu eğitim türü hakkında detaylı açıklama..."
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-slate-600 leading-relaxed">{type.description || 'Açıklama girilmedi.'}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {isEditingCountry && (
                                                countryForm.bachelorTypes.length < 5 ? (
                                                    <button 
                                                        onClick={() => addEducationType('bachelor')}
                                                        className="w-full py-2 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-500 font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Plus className="w-4 h-4" /> Yeni Lisans Türü Ekle
                                                    </button>
                                                ) : (
                                                    <div className="text-center py-2 text-xs text-indigo-400 font-medium border border-transparent">
                                                        Maksimum 5 adet lisans eğitim türü eklenebilir.
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: MASTER'S DEGREE (YUKSEK LISANS) */}
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg border-b border-slate-100 pb-2">
                                        <BookOpen className="w-5 h-5 text-purple-600" /> Yüksek Lisans (Master's)
                                    </h4>
                                    <div className="space-y-4">
                                        {/* Types Loop */}
                                        <div className="space-y-4">
                                            {dataToShow.masterTypes.length === 0 && (
                                                <p className="text-slate-400 italic text-sm">No master types defined.</p>
                                            )}
                                            {dataToShow.masterTypes.map((type, index) => (
                                                <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative group">
                                                    {isEditingCountry && (
                                                        <button 
                                                            onClick={() => removeEducationType('master', index)}
                                                            className="absolute top-2 right-2 p-1.5 bg-white text-rose-500 border border-rose-100 rounded-md hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    
                                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                                        {/* Type Name */}
                                                        <div className="md:col-span-1">
                                                            {isEditingCountry ? (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tür Adı</label>
                                                                    <select 
                                                                        value={type.name}
                                                                        onChange={(e) => updateEducationType('master', index, 'name', e.target.value)}
                                                                        className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-2 focus:ring-2 focus:ring-purple-500/20 text-sm"
                                                                    >
                                                                        <option value="">Seçiniz</option>
                                                                        {STANDARD_EDUCATION_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <h5 className="font-bold text-slate-800 text-lg">{type.name}</h5>
                                                            )}
                                                        </div>

                                                        {/* Description */}
                                                        <div className="md:col-span-2">
                                                            {isEditingCountry ? (
                                                                <div>
                                                                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Açıklama</label>
                                                                     <textarea 
                                                                        rows={3}
                                                                        value={type.description}
                                                                        onChange={(e) => updateEducationType('master', index, 'description', e.target.value)}
                                                                        className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500/20"
                                                                        placeholder="Bu eğitim türü hakkında detaylı açıklama..."
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-slate-600 leading-relaxed">{type.description || 'Açıklama girilmedi.'}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {isEditingCountry && (
                                                countryForm.masterTypes.length < 5 ? (
                                                    <button 
                                                        onClick={() => addEducationType('master')}
                                                        className="w-full py-2 border-2 border-dashed border-purple-200 rounded-xl text-purple-500 font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Plus className="w-4 h-4" /> Yeni Master Türü Ekle
                                                    </button>
                                                ) : (
                                                    <div className="text-center py-2 text-xs text-purple-400 font-medium border border-transparent">
                                                        Maksimum 5 adet master eğitim türü eklenebilir.
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>

                                    {/* SECTION 4: GENERAL REQUIREMENTS & INFO */}
                                    <div>
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg border-b border-slate-100 pb-2">
                                        <Globe className="w-5 h-5 text-emerald-600" /> Genel Bilgiler & Şartlar
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BriefcaseIcon className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold text-sm text-slate-700">Mezuniyette Çalışma İzni</span>
                                            </div>
                                            {isEditingCountry ? (
                                                <textarea rows={3} value={countryForm.postGradWorkPermit} onChange={e => updateCountryField('postGradWorkPermit', e.target.value)} className="w-full text-sm border p-2 rounded" />
                                            ) : (
                                                <p className="text-sm text-slate-600">{dataToShow.postGradWorkPermit || '-'}</p>
                                            )}
                                        </div>

                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileText className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold text-sm text-slate-700">YKS Şartları (Türkiye)</span>
                                            </div>
                                            {isEditingCountry ? (
                                                <textarea rows={3} value={countryForm.yksRequirement} onChange={e => updateCountryField('yksRequirement', e.target.value)} className="w-full text-sm border p-2 rounded" />
                                            ) : (
                                                <p className="text-sm text-slate-600">{dataToShow.yksRequirement || '-'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 5: POPULAR JOBS */}
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Star className="w-5 h-5 text-amber-500" /> Öne Çıkan Meslekler
                                    </h4>
                                    {isEditingCountry ? (
                                        <div className="space-y-2">
                                            <textarea 
                                                rows={2} 
                                                value={countryForm.popularJobs.join(', ')} 
                                                onChange={(e) => updateCountryField('popularJobs', e.target.value.split(',').map(s => s.trim()))}
                                                className="w-full border p-2 rounded-lg text-sm"
                                                placeholder="Comma separated list (e.g. Engineering, Medicine, CS)"
                                            />
                                            <p className="text-xs text-slate-400">Virgül ile ayırarak yazınız.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {dataToShow.popularJobs.length > 0 ? dataToShow.popularJobs.map(job => (
                                                <span key={job} className="px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg text-sm font-medium">
                                                    {job}
                                                </span>
                                            )) : <span className="text-slate-400 italic text-sm">Veri yok</span>}
                                        </div>
                                    )}
                                </div>

                                {/* CITIES */}
                                    <div>
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Building className="w-5 h-5 text-slate-500" /> Önemli Şehirler
                                    </h4>
                                    {isEditingCountry ? (
                                        <textarea 
                                            rows={2}
                                            value={countryForm.cities.join(', ')}
                                            onChange={(e) => updateCountryField('cities', e.target.value.split(',').map(s => s.trim()))}
                                            className="w-full border p-2 rounded text-sm"
                                        />
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {dataToShow.cities.map(city => (
                                                <span key={city} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm shadow-sm">
                                                    {city}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                    {/* Education System Desc */}
                                    <div>
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-slate-500" /> Genel Eğitim Sistemi Notu
                                    </h4>
                                    {isEditingCountry ? (
                                        <textarea 
                                            rows={4} 
                                            value={countryForm.educationSystemDescription}
                                            onChange={(e) => updateCountryField('educationSystemDescription', e.target.value)}
                                            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    ) : (
                                        <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed text-sm">
                                            {dataToShow.educationSystemDescription || 'No description available.'}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const handleAddBudget = () => {
        setBudgetForm({ id: '', label: '', sort_order: budgetRangesList.length + 1 });
        setIsBudgetModalOpen(true);
    };

    const handleEditBudget = (item: any) => {
        setBudgetForm({ ...item });
        setIsBudgetModalOpen(true);
    };

    const handleSaveBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (budgetForm.id) {
                await systemService.updateBudgetRange(budgetForm.id, budgetForm.label);
            } else {
                await systemService.addBudgetRange(budgetForm.label, budgetForm.sort_order);
            }
            await loadBudgetRangesList();
            setIsBudgetModalOpen(false);
        } catch (error: any) {
            alert('Bütçe aralığı kaydedilirken hata oluştu: ' + error.message);
        }
    };

    const handleDeleteBudget = async (id: string) => {
        if (!window.confirm("Bu bütçe seçeneğini silmek istediğinizden emin misiniz?")) return;
        try {
            await systemService.deleteBudgetRange(id);
            await loadBudgetRangesList();
        } catch (error: any) {
            alert('Bütçe aralığı silinirken hata oluştu: ' + error.message);
        }
    };

    const renderBudgetManager = () => {
        return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Eğitim Bütçesi Tanımları</h3>
                        <p className="text-sm text-slate-500">Sistem genelinde kullanılan bütçe aralıklarını yönetin.</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-600" /> Mevcut Bütçe Seçenekleri
                        </h4>
                        <button 
                            onClick={handleAddBudget}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1"
                        >
                             <Plus className="w-3 h-3" /> Yeni Seçenek Ekle
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                        {isLoadingBudgetRanges ? (
                             <div className="p-10 text-center text-slate-500 flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor...
                            </div>
                        ) : budgetRangesList.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">
                                Henüz bütçe aralığı eklenmemiş.
                            </div>
                        ) : budgetRangesList.map((opt, idx) => (
                            <div key={opt.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                        {opt.sort_order}
                                    </div>
                                    <span className="font-medium text-slate-700">{opt.label}</span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditBudget(opt)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteBudget(opt.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-200">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                    <p className="text-xs text-slate-500 text-center leading-relaxed">
                        Bu bütçe seçenekleri, öğrenci kayıt formları ve üniversite programı tanımlamalarında standart aralıklar olarak sunulur. 
                        Pactole CRM, bu değerleri finansal raporlamalar ve AI önerileri için temel alır.
                    </p>
                </div>

                {isBudgetModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-sm animate-fade-in overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-bold text-slate-800">
                                    {budgetForm.id ? 'Bütçe Seçeneği Düzenle' : 'Yeni Bütçe Seçeneği'}
                                </h3>
                                <button onClick={() => setIsBudgetModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                            <form onSubmit={handleSaveBudget} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Bütçe Aralığı</label>
                                    <input 
                                        value={budgetForm.label}
                                        onChange={e => setBudgetForm({...budgetForm, label: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        placeholder="örn: €5.000 - €10.000"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsBudgetModalOpen(false)} className="px-3 py-1.5 text-slate-500 text-sm font-medium hover:text-slate-700">İptal</button>
                                    <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Kaydet</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const renderUniversityTypesManager = () => {
        return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Üniversite Tipleri</h3>
                        <p className="text-sm text-slate-500">Üniversitelerin sınıflandırma tiplerini yönetin.</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-indigo-600" /> Mevcut Tipler
                        </h4>
                        <button 
                            onClick={() => {
                                setUniversityTypeForm({ id: '', name: '', description: '', link: '' });
                                setEditingUniversityTypeIndex(null);
                                setIsUniversityTypeModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1"
                        >
                             <Plus className="w-3 h-3" /> Yeni Tip Ekle
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {isLoadingUniversityTypes ? (
                            <div className="p-10 text-center text-slate-500 flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor...
                            </div>
                        ) : universityTypesList.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">
                                Henüz üniversite tipi eklenmemiş.
                            </div>
                        ) : universityTypesList.map((type, idx) => (
                            <div key={type.id || idx} className="p-4 hover:bg-slate-50 transition-colors flex items-start justify-between group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800">{type.name}</span>
                                        {type.link && (
                                            <a href={type.link} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">{type.description}</p>
                                    {type.link && <p className="text-xs text-indigo-500 mt-1 truncate">{type.link}</p>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => {
                                            setUniversityTypeForm({ id: type.id, name: type.name, description: type.description, link: type.link || '' });
                                            setEditingUniversityTypeIndex(idx);
                                            setIsUniversityTypeModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (window.confirm('Bu tipi silmek istediğinize emin misiniz?')) {
                                                try {
                                                    if (type.id) {
                                                        await universityTypeService.delete(type.id);
                                                    }
                                                    setUniversityTypesList(prev => prev.filter((_, i) => i !== idx));
                                                } catch (error) {
                                                    console.error('Failed to delete university type', error);
                                                    alert('Silme işlemi başarısız oldu.');
                                                }
                                            }
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-200"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {isUniversityTypeModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-sm animate-fade-in overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-bold text-slate-800">
                                    {editingUniversityTypeIndex !== null ? 'Üniversite Tipi Düzenle' : 'Yeni Üniversite Tipi'}
                                </h3>
                                <button onClick={() => setIsUniversityTypeModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (universityTypeForm.name.trim()) {
                                    try {
                                        const typeData = {
                                            id: universityTypeForm.id || `ut-${Date.now()}`,
                                            name: universityTypeForm.name,
                                            description: universityTypeForm.description,
                                            link: universityTypeForm.link || ''
                                        };
                                        
                                        await universityTypeService.upsert(typeData);
                                        
                                        if (editingUniversityTypeIndex !== null) {
                                            setUniversityTypesList(prev => prev.map((t, i) => i === editingUniversityTypeIndex ? typeData : t));
                                        } else {
                                            setUniversityTypesList(prev => [...prev, typeData]);
                                        }
                                        
                                        setIsUniversityTypeModalOpen(false);
                                        setUniversityTypeForm({ id: '', name: '', description: '', link: '' });
                                        setEditingUniversityTypeIndex(null);
                                    } catch (error) {
                                        console.error('Failed to save university type', error);
                                        alert('Kaydetme işlemi başarısız oldu.');
                                    }
                                }
                            }} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tip Adı</label>
                                    <input 
                                        value={universityTypeForm.name}
                                        onChange={e => setUniversityTypeForm({...universityTypeForm, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        placeholder="örn: Ivy League"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Açıklama</label>
                                    <textarea 
                                        value={universityTypeForm.description}
                                        onChange={e => setUniversityTypeForm({...universityTypeForm, description: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm min-h-[80px]"
                                        placeholder="Bu tipin açıklamasını yazın..."
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Link</label>
                                    <input 
                                        value={universityTypeForm.link}
                                        onChange={e => setUniversityTypeForm({...universityTypeForm, link: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsUniversityTypeModalOpen(false)} className="px-3 py-1.5 text-slate-500 text-sm font-medium hover:text-slate-700">İptal</button>
                                    <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Kaydet</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const renderDataManager = () => {
        const stats = [
            { id: 'countries', name: 'Ülkeler', table: 'countries', icon: Globe, count: countries.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { id: 'universities', name: 'Üniversiteler', table: 'universities', icon: GraduationCap, count: universities.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { id: 'degrees', name: 'Bölüm Grupları', table: 'main_degrees', icon: BookOpen, count: mainDegrees.length, color: 'text-purple-600', bg: 'bg-purple-50' },
            { id: 'all_programs', name: 'Bölümler', table: 'programs', icon: GraduationCap, count: universities.reduce((acc, u) => acc + (u.programs?.length || 0), 0), color: 'text-amber-600', bg: 'bg-amber-50' }
        ];

        return (
            <div className="space-y-6 animate-fade-in pb-20">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-600" /> Veri Yönetimi
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Sistem üzerindeki ham verileri ve tablo istatistiklerini kontrol edin.</p>
                        </div>
                        <button 
                            onClick={() => {
                                loadCountries();
                                loadUniversities();
                                loadMainDegrees();
                                loadInterestedPrograms();
                                alert('Veriler tazelendi!');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 font-medium"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Verileri Tazele
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stats.map(stat => (
                            <div 
                                key={stat.table} 
                                onClick={() => setSelectedDefinitionType(stat.id)}
                                className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                        <stat.icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); /* export logic */ }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                            title="Export CSV"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.table}</p>
                                    <h4 className="text-lg font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">{stat.name}</h4>
                                    <div className="mt-4 flex items-end justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-3xl font-black text-slate-900">{stat.count}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Yönetmek için tıkla</span>
                                        </div>
                                        <span className="text-xs font-medium text-slate-400 mb-1">Kaydolmuş Satır</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl overflow-hidden relative">
                         <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Database className="w-32 h-32" />
                        </div>
                        <div className="relative">
                            <h4 className="text-lg font-bold mb-2">Veritabanı Sağlığı</h4>
                            <p className="text-slate-400 text-sm mb-6">Supabase bağlantısı aktif ve senkronize durumda. Tüm tablolar RLS politikalarıyla korunmaktadır.</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 text-sm">
                                    <span className="text-slate-400">Bağlantı Durumu</span>
                                    <span className="flex items-center gap-2 text-emerald-400 font-bold">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                        CONNECTED
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 text-sm">
                                    <span className="text-slate-400">Ortalama Yanıt Süresi</span>
                                    <span className="text-indigo-400 font-bold">124ms</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 mb-2">Toplu Veri İşlemleri</h4>
                            <p className="text-slate-500 text-sm">Üniversite listelerini veya öğrenci verilerini toplu olarak içeri aktarın.</p>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">CSV / Excel İçe Aktar</button>
                            <button className="flex-1 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95">Tüm Veriyi Yedekle</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const availableParents = getAvailableParents(newUser.role);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 h-full">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-6 md:p-8"
            >
                {/* Background decorations */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                        System Settings
                    </h1>
                    <p className="text-purple-300/70 mt-1 text-sm">Kullanıcıları, rolleri ve genel tanımlamaları buradan yönetebilirsiniz.</p>
                </div>
            </motion.div>

            {/* Show Tabs only if not in sub-view */}
            {!selectedDefinitionType && (
                <>
                    <div className="flex gap-6 border-b border-slate-200">
                        {[
                            { id: 'users', label: 'Kullanıcı Yönetimi', icon: Users },
                            { id: 'definitions', label: 'Sistem Tanımları', icon: Building },
                            { id: 'career', label: 'AI Ayarları', icon: Cpu },
                            { id: 'data', label: 'DATA', icon: Database },
                        ].map((tab) => (
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
                </>
            )}

            {activeTab === 'users' && !selectedDefinitionType && renderUserManagement()}

            {activeTab === 'definitions' && (
                <>
                    {/* Grid View (Main Menu) */}
                    {!selectedDefinitionType && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <DefinitionCard 
                                id="interested_programs"
                                title="Program Tanımları" 
                                icon={Briefcase} 
                                count={interestedPrograms.length || 0} 
                                onClick={(id: string) => setSelectedDefinitionType(id)}
                            />
                            <DefinitionCard 
                                id="shared_institutions"
                                title="Kurumlar" 
                                icon={Building} 
                                count={sharedInstitutions.length || 0} 
                                onClick={(id: string) => setSelectedDefinitionType(id)}
                            />
                            <DefinitionCard 
                                id="budget"
                                title="Eğitim Bütçesi" 
                                icon={Banknote} 
                                count={6} 
                                onClick={(id: string) => setSelectedDefinitionType(id)}
                            />
                            <DefinitionCard 
                                id="university_types"
                                title="Üniversite Tipleri" 
                                icon={GraduationCap} 
                                count={universityTypesList.length || 0} 
                                onClick={(id: string) => setSelectedDefinitionType(id)}
                            />
                            <DefinitionCard 
                                id="docs"
                                title="Evrak Türleri" 
                                icon={Shield} 
                                count={18} 
                                onClick={(id: string) => alert('Evrak modülü yakında eklenecek')}
                            />
                        </div>
                    )}

                    {/* Sub Views for Definitions Tab */}
                    {selectedDefinitionType === 'interested_programs' && renderInterestedProgramManager()}
                    {selectedDefinitionType === 'budget' && renderBudgetManager()}
                    {selectedDefinitionType === 'university_types' && renderUniversityTypesManager()}
                </>
            )}

            {activeTab === 'data' && (
                <>
                    {!selectedDefinitionType && renderDataManager()}
                    {selectedDefinitionType === 'countries' && renderCountryManager()}
                    {selectedDefinitionType === 'universities' && renderUniversityManager()}
                    {selectedDefinitionType === 'degrees' && renderMainDegreeManager()}
                    {selectedDefinitionType === 'all_programs' && renderAllProgramsManager()}
                </>
            )}
            {activeTab === 'career' && !selectedDefinitionType && (
                 <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-indigo-600" /> AI Agent Ofisi
                        </h3>
                        
                        {/* AI Office with Background Image */}
                        <div 
                            className="relative rounded-2xl overflow-hidden" 
                            style={{ 
                                height: '500px',
                                backgroundColor: '#e2e8f0',
                                backgroundImage: 'url("https://qwualszqafxjorumgttv.supabase.co/storage/v1/object/public/AI%20Ofis/AI%20Ofis.png")',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        >                            
                            {/* Draggable AI Agents */}
                            {aiAgents.slice(0, 4).map((agent, idx) => (
                                <div
                                    key={agent.id}
                                    draggable
                                    onDragEnd={(e) => {
                                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                        if (rect) {
                                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                                            // Update agent position - you can save this to state
                                            console.log(`Agent ${agent.id} at: ${x.toFixed(1)}%, ${y.toFixed(1)}%`);
                                        }
                                    }}
                                    onClick={() => handleEditAgent(agent.id)}
                                    className="absolute cursor-move group"
                                    style={{
                                        top: idx === 0 ? '15%' : idx === 1 ? '15%' : idx === 2 ? '55%' : '55%',
                                        left: idx === 0 ? '10%' : idx === 1 ? '55%' : idx === 2 ? '10%' : '55%'
                                    }}
                                >
                                    <div className="w-16 h-16 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-200 hover:scale-110 transition-transform">
                                        {agent.avatar ? (
                                            <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-indigo-500 flex items-center justify-center">
                                                <Users className="w-8 h-8 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    {/* Status indicator */}
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${agent.apiKey ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    {/* Name tag */}
                                    <div className="absolute -bottom-8 -left-8 w-32 text-center">
                                        <div className="text-sm font-bold text-white drop-shadow-lg">{agent.name}</div>
                                        <div className={`text-xs ${agent.apiKey ? 'text-emerald-300' : 'text-rose-300'}`}>
                                            {agent.apiKey ? '● Aktif' : '● Pasif'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Add Agent Button */}
                            {aiAgents.length < 4 && (
                                <div
                                    onClick={handleAddAgent}
                                    className="absolute cursor-pointer group"
                                    style={{ top: '80%', left: '50%' }}
                                >
                                    <div className="w-16 h-16 rounded-full border-4 border-dashed border-white/50 bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                                        <Plus className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="absolute -bottom-6 -left-8 w-32 text-center">
                                        <div className="text-sm font-bold text-white drop-shadow-lg">Yeni Agent</div>
                                    </div>
                                </div>
                            )}
                        </div>
                            
                            {/* Floor */}
                            <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-b from-amber-100 to-amber-200"></div>
                            
                            {/* === TOP ROW - 3 DESKS === */}
                            {/* Top Left */}
                            <div onClick={() => handleEditAgent('agent-1')} className="absolute top-12 left-3 cursor-pointer">
                                <div className="w-20 h-2.5 bg-amber-600 rounded shadow flex items-center justify-center">
                                    <div className="w-5 h-3 bg-slate-800 rounded -mt-2.5">
                                        <div className="w-3.5 h-2 bg-slate-700 rounded-sm"></div>
                                    </div>
                                </div>
                                <div className="absolute top-1 left-3 flex flex-col items-center">
                                    <div className="w-4 h-4 rounded-full shadow border border-white overflow-hidden">
                                        {aiAgents[0]?.avatar ? <img src={aiAgents[0].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-400"></div>}
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full border border-white ${aiAgents[0]?.apiKey ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    <div className="absolute -bottom-4 -left-2 w-14 text-center">
                                        <div className="text-[5px] font-bold text-slate-800">{aiAgents[0]?.name?.slice(0,6) || '-'}</div>
                                        <div className={`text-[3px] ${aiAgents[0]?.apiKey ? 'text-emerald-600' : 'text-rose-600'}`}>{aiAgents[0]?.apiKey ? '●A' : '●P'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Top Center */}
                            <div onClick={() => handleEditAgent('agent-2')} className="absolute top-12 left-1/2 -translate-x-1/2 cursor-pointer">
                                <div className="w-20 h-2.5 bg-amber-600 rounded shadow flex items-center justify-center">
                                    <div className="w-5 h-3 bg-slate-800 rounded -mt-2.5">
                                        <div className="w-3.5 h-2 bg-slate-700 rounded-sm"></div>
                                    </div>
                                </div>
                                <div className="absolute top-1 left-3 flex flex-col items-center">
                                    <div className="w-4 h-4 rounded-full shadow border border-white overflow-hidden">
                                        {aiAgents[1]?.avatar ? <img src={aiAgents[1].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-emerald-400"></div>}
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full border border-white ${aiAgents[1]?.apiKey ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    <div className="absolute -bottom-4 -left-2 w-14 text-center">
                                        <div className="text-[5px] font-bold text-slate-800">{aiAgents[1]?.name?.slice(0,6) || '-'}</div>
                                        <div className={`text-[3px] ${aiAgents[1]?.apiKey ? 'text-emerald-600' : 'text-rose-600'}`}>{aiAgents[1]?.apiKey ? '●A' : '●P'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Top Right */}
                            <div onClick={() => handleEditAgent('agent-3')} className="absolute top-12 right-3 cursor-pointer">
                                <div className="w-20 h-2.5 bg-amber-600 rounded shadow flex items-center justify-center">
                                    <div className="w-5 h-3 bg-slate-800 rounded -mt-2.5">
                                        <div className="w-3.5 h-2 bg-slate-700 rounded-sm"></div>
                                    </div>
                                </div>
                                <div className="absolute top-1 left-3 flex flex-col items-center">
                                    <div className="w-4 h-4 rounded-full shadow border border-white overflow-hidden">
                                        {aiAgents[2]?.avatar ? <img src={aiAgents[2].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-amber-400"></div>}
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full border border-white ${aiAgents[2]?.apiKey ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    <div className="absolute -bottom-4 -left-2 w-14 text-center">
                                        <div className="text-[5px] font-bold text-slate-800">{aiAgents[2]?.name?.slice(0,6) || '-'}</div>
                                        <div className={`text-[3px] ${aiAgents[2]?.apiKey ? 'text-emerald-600' : 'text-rose-600'}`}>{aiAgents[2]?.apiKey ? '●A' : '●P'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* === BOTTOM ROW - 3 DESKS === */}
                            {/* Bottom Left */}
                            <div onClick={() => handleEditAgent('agent-4')} className="absolute bottom-3 left-3 cursor-pointer">
                                <div className="w-20 h-2.5 bg-amber-600 rounded shadow flex items-center justify-center">
                                    <div className="w-5 h-3 bg-slate-800 rounded -mt-2.5">
                                        <div className="w-3.5 h-2 bg-slate-700 rounded-sm"></div>
                                    </div>
                                </div>
                                <div className="absolute top-1 left-3 flex flex-col items-center">
                                    <div className="w-4 h-4 rounded-full shadow border border-white overflow-hidden">
                                        {aiAgents[3]?.avatar ? <img src={aiAgents[3].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-pink-400"></div>}
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full border border-white ${aiAgents[3]?.apiKey ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    <div className="absolute -bottom-4 -left-2 w-14 text-center">
                                        <div className="text-[5px] font-bold text-slate-800">{aiAgents[3]?.name?.slice(0,6) || '-'}</div>
                                        <div className={`text-[3px] ${aiAgents[3]?.apiKey ? 'text-emerald-600' : 'text-rose-600'}`}>{aiAgents[3]?.apiKey ? '●A' : '●P'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bottom Center */}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer">
                                <div className="w-20 h-2.5 bg-slate-200 rounded shadow border border-dashed border-slate-300">
                                    <div className="w-5 h-3 bg-slate-300 rounded -mt-2.5">
                                        <div className="w-3.5 h-2 bg-slate-400 rounded-sm"></div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bottom Right */}
                            <div className="absolute bottom-3 right-3 cursor-pointer">
                                <div className="w-20 h-2.5 bg-slate-200 rounded shadow border border-dashed border-slate-300">
                                    <div className="w-5 h-3 bg-slate-300 rounded -mt-2.5">
                                        <div className="w-3.5 h-2 bg-slate-400 rounded-sm"></div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* UNIC Sign */}
                            <div className="absolute top-1 left-1/2 -translate-x-1/2">
                                <div className="bg-indigo-900 px-3 py-0.5 rounded">
                                    <span className="text-white text-[8px] font-bold">UNIC</span>
                                </div>
                            </div>
                            
                            {/* Floor line */}
                            <div className="absolute bottom-14 left-0 right-0 h-0.5 bg-amber-300"></div>
                            <div className="absolute top-6 left-1/2 -translate-x-1/2">
                                <div className="bg-indigo-900 px-8 py-2 rounded-lg shadow-lg">
                                    <span className="text-white font-bold text-xl tracking-widest">UNIC</span>
                                    <span className="text-indigo-300 text-xs ml-2">AI OFFICE</span>
                                </div>
                            </div>
                            
                            {/* Decor - Plant */}
                            <div className="absolute bottom-4 left-4">
                                <div className="w-8 h-10 bg-green-600 rounded-t-full"></div>
                                </div>
                        
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            AI Agent'ları sürükleyerek istediğiniz yere taşıyabilirsiniz. Yeşil = Aktif | Kırmızı = Pasif
                        </p>
                    </div>
                 </div>
            )}


            {/* Add User Modal */}
            {isUserModalOpen && (
                <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100vh-160px)] overflow-y-auto mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Yeni Kullanıcı Ekle</h3>
                            <button onClick={() => setIsUserModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                                <input
                                    required
                                    value={newUser.full_name}
                                    onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                                <input 
                                    required
                                    type="email"
                                    value={newUser.email} 
                                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                                <input
                                    value={newUser.phone}
                                    onChange={e => setNewUser({...newUser, phone: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Şube</label>
                                <select
                                    value={newUser.branch_id}
                                    onChange={e => setNewUser({...newUser, branch_id: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                >
                                    <option value="">Şube Seçin</option>
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => {
                                        const newRole = e.target.value as UserRole;
                                        setNewUser({
                                            ...newUser,
                                            role: newRole,
                                            parent_user_id: '' // Reset parent when role changes to ensure validity
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                >
                                    <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                                    <option value={UserRole.ADMIN}>Admin</option>
                                    <option value={UserRole.BRANCH_MANAGER}>Şube Müdürü</option>
                                    <option value={UserRole.CONSULTANT}>Danışman</option>
                                    <option value={UserRole.REPRESENTATIVE}>Temsilci</option>
                                    <option value={UserRole.STUDENT_REPRESENTATIVE}>Öğrenci Temsilci</option>
                                    <option value={UserRole.STUDENT}>Öğrenci</option>
                                </select>
                            </div>
                            
                            {/* Reports To Selection */}
                            {(newUser.role === UserRole.ADMIN || newUser.role === UserRole.BRANCH_MANAGER || newUser.role === UserRole.CONSULTANT || newUser.role === UserRole.REPRESENTATIVE || newUser.role === UserRole.STUDENT_REPRESENTATIVE || newUser.role === UserRole.STUDENT) && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Reports To (Manager)
                                    </label>
                                    <select
                                        value={newUser.parent_user_id || ''}
                                        onChange={e => setNewUser({...newUser, parent_user_id: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    >
                                        <option value="">Select Manager</option>
                                        {availableParents.map(parent => (
                                            <option key={parent.id} value={parent.id}>
                                                {parent.full_name} ({parent.role})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {newUser.role === UserRole.ADMIN ? 'Admins report to Super Admin.' :
                                         newUser.role === UserRole.BRANCH_MANAGER ? 'Branch Managers report to Admin.' :
                                         newUser.role === UserRole.CONSULTANT ? 'Consultants report to Branch Manager.' :
                                         newUser.role === UserRole.REPRESENTATIVE ? 'Representatives report to Consultant or Branch Manager.' :
                                         newUser.role === UserRole.STUDENT_REPRESENTATIVE ? 'Student Representatives report to Representative, Consultant, or Branch Manager.' :
                                         'Students are assigned to Representative, Consultant, or Branch Manager.'}
                                    </p>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* University Add/Edit Modal */}
            {isUniversityModalOpen && (
                 <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100vh-160px)] overflow-y-auto mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">Yeni Üniversite Ekle</h3>
                            <button onClick={() => setIsUniversityModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveUniversity} className="p-6 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Üniversite Adı</label>
                                    <input 
                                        required
                                        value={universityForm.name} 
                                        onChange={e => setUniversityForm({...universityForm, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="Örn: Technical University of Munich"
                                    />
                                </div>
                                <div className="shrink-0">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Logo</label>
                                    {showLogoUpload ? (
                                        <div className="w-40 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-3">
                                            <input 
                                                type="file"
                                                accept="image/*"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        try {
                                                            const url = await universityService.uploadLogo(file);
                                                            setUniversityForm({...universityForm, logo: url});
                                                            setShowLogoUpload(false);
                                                        } catch (err: any) {
                                                            alert("Logo yüklenirken bir hata oluştu: " + err.message);
                                                        }
                                                    }
                                                }}
                                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowLogoUpload(false)}
                                                className="mt-2 w-full text-xs text-slate-500 hover:text-slate-700"
                                            >
                                                İptal
                                            </button>
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={() => setShowLogoUpload(true)}
                                            className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                                        >
                                            {universityForm.logo ? (
                                                <img src={universityForm.logo} alt="" className="w-full h-full object-contain" />
                                            ) : (
                                                <Building className="w-8 h-8 text-slate-300" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Ülkeler</label>
                                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                                    {countries.map(c => (
                                        <label key={c.id} className="flex items-center gap-1 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                                            <input 
                                                type="checkbox"
                                                checked={universityForm.countries?.includes(c.name) || false}
                                                onChange={e => {
                                                    const isChecked = e.target.checked;
                                                    setUniversityForm(prev => ({
                                                        ...prev,
                                                        countries: isChecked 
                                                            ? [...(prev.countries || []), c.name]
                                                            : (prev.countries || []).filter(name => name !== c.name)
                                                    }));
                                                }}
                                                className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-slate-700">{c.flag}</span>
                                            <span className="text-xs text-slate-700 truncate">{c.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

<div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">Danışmanlık Tipi</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['Depozito', 'Danışmanlık', 'Kabul Sonrası Danışmanlık', 'Depozito - Paylaşımlı'].map(type => (
                                        <label key={type} className="flex items-center gap-1 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                            <input 
                                                type="radio"
                                                name="consultingType"
                                                checked={universityForm.consultingType === type}
                                                onChange={e => {
                                                    setUniversityForm({
                                                        ...universityForm, 
                                                        consultingType: type,
                                                        sharedInstitutionId: type === 'Depozito - Paylaşımlı' ? universityForm.sharedInstitutionId : ''
                                                    });
                                                }}
                                                className="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-slate-700">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {universityForm.consultingType === 'Depozito - Paylaşımlı' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Paylaşımlı Kurum Seçimi</label>
                                    <select 
                                        value={universityForm.sharedInstitutionId || ''} 
                                        onChange={e => setUniversityForm({...universityForm, sharedInstitutionId: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    >
                                        <option value="">Kurum Seçiniz...</option>
                                        {sharedInstitutions.map(inst => (
                                            <option key={inst.id} value={inst.id}>{inst.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sıralama Linki (Ranking)</label>
                                    <input 
                                        value={universityForm.rankingUrl} 
                                        onChange={e => setUniversityForm({...universityForm, rankingUrl: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://www.topuniversities.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Web Sitesi</label>
                                    <input 
                                        value={universityForm.websiteUrl} 
                                        onChange={e => setUniversityForm({...universityForm, websiteUrl: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">Üniversite Tipi</label>
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                                    {universityTypesList.map((type) => (
                                        <label key={type.name} className="flex items-center gap-1 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                                            <input 
                                                type="checkbox"
                                                checked={universityForm.universityTypes?.includes(type.name) || false}
                                                onChange={e => {
                                                    const isChecked = e.target.checked;
                                                    setUniversityForm(prev => ({
                                                        ...prev,
                                                        universityTypes: isChecked 
                                                            ? [...(prev.universityTypes || []), type.name]
                                                            : (prev.universityTypes || []).filter(t => t !== type.name)
                                                    }));
                                                }}
                                                className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-slate-700 truncate" title={type.description}>{type.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsUniversityModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">İptal</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Üniversiteyi Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Main Degree Add/Edit Modal */}
            {isMainCategoryModalOpen && (
                 <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-[100px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-fade-in overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {mainCategories.find(c => c.id === mainCategoryForm.id) ? 'Ana Bölüm Düzenle' : 'Yeni Ana Bölüm Ekle'}
                            </h3>
                            <button onClick={() => setIsMainCategoryModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveMainCategory} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ana Bölüm Adı</label>
                                <input 
                                    required
                                    value={mainCategoryForm.name} 
                                    onChange={e => setMainCategoryForm({...mainCategoryForm, name: formatTitleCase(e.target.value)})}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium" 
                                    placeholder="e.g. Mühendislik"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Açıklama (Opsiyonel)</label>
                                <textarea 
                                    rows={3}
                                    value={mainCategoryForm.description} 
                                    onChange={e => setMainCategoryForm({...mainCategoryForm, description: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium" 
                                    placeholder="Bu kategori hakkında kısa bilgi..."
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsMainCategoryModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Vazgeç</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">Kaydet</button>
                            </div>
                        </form>
                    </div>
                 </div>
            )}

            {isMainDegreeModalOpen && (
                 <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100vh-160px)] overflow-y-auto mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {mainDegrees.find(d => d.id === mainDegreeForm.id) ? 'Alt Başlık Düzenle' : 'Yeni Alt Başlık Ekle'}
                            </h3>
                            <button onClick={() => setIsMainDegreeModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveMainDegree} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Alt Başlık Adı (Sub-Major Name)</label>
                                    <input 
                                        required
                                        value={mainDegreeForm.name} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, name: formatTitleCase(e.target.value)})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="e.g. Bilgisayar Mühendisliği"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Atanan Ana Gruplar (Bir veya birden fazla seçebilirsiniz)</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {mainCategories.map(cat => (
                                            <label 
                                                key={cat.id} 
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                                    (mainDegreeForm.categoryIds || []).includes(cat.id)
                                                        ? 'border-indigo-600 bg-indigo-50/50'
                                                        : 'border-slate-100 bg-slate-50/30 hover:border-slate-200'
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={(mainDegreeForm.categoryIds || []).includes(cat.id)}
                                                    onChange={(e) => {
                                                        const current = mainDegreeForm.categoryIds || [];
                                                        if (e.target.checked) {
                                                            setMainDegreeForm({...mainDegreeForm, categoryIds: [...current, cat.id]});
                                                        } else {
                                                            setMainDegreeForm({...mainDegreeForm, categoryIds: current.filter(id => id !== cat.id)});
                                                        }
                                                    }}
                                                />
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                    (mainDegreeForm.categoryIds || []).includes(cat.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {(mainDegreeForm.categoryIds || []).includes(cat.id) && <CheckCircle className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                                    (mainDegreeForm.categoryIds || []).includes(cat.id) ? 'text-indigo-700' : 'text-slate-500'
                                                }`}>
                                                    {cat.name}
                                                </span>
                                            </label>
                                        ))}
                                        {mainCategories.length === 0 && (
                                            <p className="col-span-full text-xs text-rose-500 italic p-4 bg-rose-50 rounded-xl border border-rose-100">
                                                Lütfen önce 'Ana Bölümler' sekmesinden en az bir grup oluşturun.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Bölüm Tanımı</label>
                                    <textarea 
                                        required
                                        rows={3}
                                        value={mainDegreeForm.description} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, description: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="Bölüm hakkında genel bilgi..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Kariyer Fırsatları</label>
                                    <textarea 
                                        rows={4}
                                        value={mainDegreeForm.careerOpportunities} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, careerOpportunities: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="Mezunlar hangi pozisyonlarda çalışabilir?"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Yapay Zekanın Etkisi</label>
                                    <textarea 
                                        rows={4}
                                        value={mainDegreeForm.aiImpact} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, aiImpact: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="AI bu mesleği nasıl dönüştürüyor?"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Dünyada Öne Çıkan Firmalar</label>
                                    <textarea 
                                        rows={3}
                                        value={mainDegreeForm.topCompanies} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, topCompanies: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="Google, Tesla, Goldman Sachs, etc."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Türkiye'de Sektörün Durumu</label>
                                    <textarea 
                                        rows={3}
                                        value={mainDegreeForm.sectorStatusTR} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, sectorStatusTR: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="Türkiye'deki iş imkanları ve sektör büyüklüğü..."
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Resim URL</label>
                                    <div className="flex gap-4">
                                        <input 
                                            value={mainDegreeForm.imageUrl} 
                                            onChange={e => setMainDegreeForm({...mainDegreeForm, imageUrl: e.target.value})}
                                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                            placeholder="https://images.unsplash.com/..."
                                        />
                                        {mainDegreeForm.imageUrl && (
                                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                                <img src={mainDegreeForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsMainDegreeModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Vazgeç</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Interested Program Modal (New) */}
            {isInterestedProgramModalOpen && (
                 <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {interestedPrograms.find(p => p.id === interestedProgramForm.id) ? 'Edit Interested Program' : 'New Interested Program'}
                            </h3>
                            <button onClick={() => setIsInterestedProgramModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveInterestedProgram} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Program Adı (Subject)</label>
                                <input 
                                    required
                                    value={interestedProgramForm.name} 
                                    onChange={e => setInterestedProgramForm({...interestedProgramForm, name: formatTitleCase(e.target.value)})}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                    placeholder="e.g. Computer Science"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Açıklama</label>
                                <textarea 
                                    rows={3}
                                    value={interestedProgramForm.description} 
                                    onChange={e => setInterestedProgramForm({...interestedProgramForm, description: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                    placeholder="Bölüm hakkında kısa bilgi..."
                                />
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsInterestedProgramModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Vazgeç</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Shared Institution Form Modal (Kurumlar) */}
            {isSharedInstitutionModalOpen && (
                 <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {sharedInstitutions.find(p => p.id === sharedInstitutionForm.id) ? 'Kurum Düzenle' : 'Yeni Kurum Ekle'}
                            </h3>
                            <button onClick={() => setIsSharedInstitutionModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveSharedInstitution} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Kurum Adı</label>
                                <input 
                                    required
                                    value={sharedInstitutionForm.name} 
                                    onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, name: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                    placeholder="Örn: X Danışmanlık A.Ş."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Yetkili Adı</label>
                                <input 
                                    value={sharedInstitutionForm.contactName || ''} 
                                    onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, contactName: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                    placeholder="Örn: Ahmet Bey"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">İletişim Bilgileri</label>
                                <textarea 
                                    rows={3}
                                    value={sharedInstitutionForm.contactInfo || ''} 
                                    onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, contactInfo: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                    placeholder="Telefon, E-posta, Adres vb."
                                />
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsSharedInstitutionModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Vazgeç</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AI Agent Modal */}
            {isAgentModalOpen && (
                <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {editingAgentId ? 'AI Agent Düzenle' : 'Yeni AI Agent Ekle'}
                            </h3>
                            <button onClick={() => setIsAgentModalOpen(false)}>
                                <XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSaveAgent(); }} className="p-4 space-y-3">
                            {/* Avatar Bucket Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Avatar Seç</label>
                                <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                                    {['https://api.dicebear.com/7.x/avataaars/svg?seed=Agent1', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent2', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent3', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent4', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent5', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent6', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent7', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent8', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent9', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent10', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent11', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent12', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent13', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent14', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent15', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent16'].map((avatar, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => setAgentForm({...agentForm, avatar})}
                                            className={`w-10 h-10 rounded-full overflow-hidden cursor-pointer hover:scale-110 transition-transform border-2 ${agentForm.avatar === avatar ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-transparent'}`}
                                        >
                                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    required
                                    value={agentForm.name}
                                    onChange={(e) => setAgentForm({...agentForm, name: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                                    placeholder="örn: Danışman Asistanı"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Job Title</label>
                                <input
                                    required
                                    value={agentForm.jobTitle}
                                    onChange={(e) => setAgentForm({...agentForm, jobTitle: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                                    placeholder="örn: Senior Advisor"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Work Description</label>
                                <textarea
                                    required
                                    value={agentForm.workDescription}
                                    onChange={(e) => setAgentForm({...agentForm, workDescription: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                                    placeholder="Agentin görevlerini açıklayın..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">AI Model</label>
                                <select
                                    value={agentForm.aiModel}
                                    onChange={(e) => setAgentForm({...agentForm, aiModel: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                                >
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                    <option value="gpt-4o">GPT-4o</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={agentForm.apiKey}
                                    onChange={(e) => setAgentForm({...agentForm, apiKey: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono text-sm"
                                    placeholder="API anahtarınızı giriniz..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-2">Yetki Alanları</label>
                                <div className="grid grid-cols-2 gap-1">
                                    {['students.read', 'students.write', 'universities.read', 'universities.write', 'documents.read', 'documents.write', 'applications.read', 'applications.write'].map(perm => (
                                        <label key={perm} className="flex items-center gap-1 p-1.5 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={agentForm.permissions?.includes(perm) || false}
                                                onChange={(e) => {
                                                    const isChecked = e.target.checked;
                                                    setAgentForm(prev => ({
                                                        ...prev,
                                                        permissions: isChecked
                                                            ? [...(prev.permissions || []), perm]
                                                            : (prev.permissions || []).filter(p => p !== perm)
                                                    }));
                                                }}
                                                className="w-3 h-3 text-indigo-600 rounded border-slate-300"
                                            />
                                            <span className="text-[10px] text-slate-700">{perm}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 flex justify-between">
                                {editingAgentId && (
                                    <button
                                        type="button"
                                        onClick={() => { handleDeleteAgent(editingAgentId); setIsAgentModalOpen(false); }}
                                        className="px-3 py-1.5 text-rose-600 font-medium hover:bg-rose-50 rounded-lg text-sm"
                                    >
                                        Sil
                                    </button>
                                )}
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" onClick={() => setIsAgentModalOpen(false)} className="px-3 py-1.5 text-slate-600 font-medium text-sm">İptal</button>
                                    <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm">Kaydet</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Settings;
