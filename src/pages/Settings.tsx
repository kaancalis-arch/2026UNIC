
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SystemUser, UserRole, CountryData, EducationType, UniversityData, MainDegreeData, MainCategoryData, InterestedProgramData, SharedInstitutionData, AIAgent, UniversityProgramData, Branch, Student } from '../types';
import { MOCK_BRANCHES, MOCK_COUNTRIES, MOCK_UNIVERSITIES } from '../services/mockData';
import { countryService } from '../services/countryService';
import { universityService } from '../services/universityService';
import { universityTypeService } from '../services/universityTypeService';
import { mainDegreeService } from '../services/mainDegreeService';
import { mainCategoryService } from '../services/mainCategoryService';
import { interestedProgramService } from '../services/interestedProgramService';
import { sharedInstitutionService } from '../services/sharedInstitutionService';
import { universityProgramService } from '../services/universityProgramService';
import { systemService } from '../services/systemService';
import { studentService } from '../services/studentService';
import { ProfileBoxConfig, profileBoxService } from '../services/profileBoxService';
import { SchoolNameRecord, SchoolNameType, schoolNameService } from '../services/schoolNameService';
import { DocumentTypeDefinition, documentTypeService } from '../services/documentTypeService';
import { getPublicStorageUrl, supabase } from '../services/supabaseClient';
import { 
    Settings as SettingsIcon, Users, Building, GraduationCap, 
    Shield, CheckCircle, XCircle, Plus, PlusCircle, MoreVertical, Edit2, Trash2, 
    Briefcase, Globe, MapPin, Banknote, Users2, ArrowLeft, BookOpen, Edit,
    Calendar, FileText, Star, Briefcase as BriefcaseIcon, Clock, Loader2, ClipboardList,
    Link as LinkIcon, ExternalLink, Cpu, Key, Save, X, Database, RefreshCw, Download, Search, Upload,
    Sun, MessageCircle, School
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatTitleCase } from '../lib/utils';
import {
    getAllowedParentRoles,
    roleRequiresBranch,
    roleRequiresSameBranch,
    validateUserHierarchy,
    wouldCreateHierarchyCycle
} from '../auth/userHierarchy';
import { useAuth } from '../auth/AuthContext';

const DEFAULT_UNIC_LOGO_URL = getPublicStorageUrl('Unic_Main', 'UNIC The Uni Counsllor Logo.png');
const DEFAULT_USER_AVATAR_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=UNICUser';

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

const DefinitionCard = ({ id, title, icon: Icon, count, onClick, color = "text-indigo-600", bg = "bg-indigo-50" }: any) => (
    <div 
        onClick={() => onClick(id)}
        className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer"
    >
        <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${bg} ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{id.replace('_', ' ')}</p>
            <h4 className="text-lg font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">{title}</h4>
            <div className="mt-4 flex items-end justify-between">
                <div className="flex flex-col">
                    <span className="text-3xl font-black text-slate-900">{count}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Yönetmek için tıkla</span>
                </div>
                <span className="text-xs font-medium text-slate-400 mb-1">Kayıt</span>
            </div>
        </div>
    </div>
);

type DepartmentKeywordRule = {
    id: string;
    keyword: string | null;
    matched_department: string | null;
    department_name: string | null;
    major_keywords: string[] | null;
    required_match_keywords: string[] | null;
    rule_notes: string | null;
    is_active: boolean | null;
    priority: number | null;
};

type DepartmentKeywordRuleForm = {
    id: string;
    department_name: string;
    major_keywords: string;
    required_match_keywords: string;
    rule_notes: string;
    is_active: boolean;
    priority: string;
};

const emptyDepartmentKeywordRuleForm: DepartmentKeywordRuleForm = {
    id: '',
    department_name: '',
    major_keywords: '',
    required_match_keywords: '',
    rule_notes: '',
    is_active: true,
    priority: '100'
};

const parseCommaSeparatedKeywords = (value: string) => value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const formatKeywordArray = (value: string[] | null | undefined) => (value || []).join(', ');

const normalizeDepartmentName = (value: string) => value.trim().toLocaleLowerCase('tr');

type UniversitySortKey = 'name' | 'countries' | 'types' | 'links' | 'programs';
type UniversitySortDirection = 'asc' | 'desc';
type UniversitySortConfig = {
    key: UniversitySortKey;
    direction: UniversitySortDirection;
};

const Settings: React.FC<{
    onUniversitySelect?: (university: UniversityData) => void;
    onDepartmentKeywordRulesOpen?: () => void;
}> = ({ onUniversitySelect, onDepartmentKeywordRulesOpen }) => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'definitions' | 'career' | 'data' | 'institutions'>('users');
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [branches, setBranches] = useState<Branch[]>(MOCK_BRANCHES);
    const [crmStudents, setCrmStudents] = useState<Student[]>([]);
    const [isLoadingCrmStudents, setIsLoadingCrmStudents] = useState(false);
    const [schoolNames, setSchoolNames] = useState<SchoolNameRecord[]>([]);
    const [schoolNameInput, setSchoolNameInput] = useState('');
    const highSchoolNamesFileInputRef = React.useRef<HTMLInputElement>(null);
    const universitySchoolNamesFileInputRef = React.useRef<HTMLInputElement>(null);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [branchForm, setBranchForm] = useState<Partial<Branch>>({
        name: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        status: 'active'
    });
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [newUserPassword, setNewUserPassword] = useState('');
    
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
        parserProfile: 'auto',
        consultingType: '',
        universityTypes: [],
        sharedInstitutionId: '',
        programs: []
    });
    
    // University Filter State
    const [universitySearchTerm, setUniversitySearchTerm] = useState('');
    const [universitySortConfig, setUniversitySortConfig] = useState<UniversitySortConfig | null>(null);
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
    const [departmentKeywordRules, setDepartmentKeywordRules] = useState<DepartmentKeywordRule[]>([]);
    const [departmentKeywordRuleForm, setDepartmentKeywordRuleForm] = useState<DepartmentKeywordRuleForm>(emptyDepartmentKeywordRuleForm);
    
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
    const [isLoadingMainDegrees, setIsLoadingMainDegrees] = useState(false);

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
    const [profileBoxes, setProfileBoxes] = useState<ProfileBoxConfig[]>([]);
    const [isLoadingProfileBoxes, setIsLoadingProfileBoxes] = useState(false);

    // Document Types State
    const [documentTypes, setDocumentTypes] = useState<DocumentTypeDefinition[]>([]);
    const [isLoadingDocumentTypes, setIsLoadingDocumentTypes] = useState(false);
    const [isDocumentTypeModalOpen, setIsDocumentTypeModalOpen] = useState(false);
    const [isSavingDocumentType, setIsSavingDocumentType] = useState(false);
    const [documentTypeForm, setDocumentTypeForm] = useState<DocumentTypeDefinition>({
        id: '',
        name: '',
        englishName: '',
        note: '',
        fileType: '',
        allowMultiple: false,
        isActive: true,
        isRequired: false,
        sortOrder: 0
    });

    // Shared Institutions State (New)
    const [sharedInstitutions, setSharedInstitutions] = useState<SharedInstitutionData[]>([]);
    const [isLoadingSharedInstitutions, setIsLoadingSharedInstitutions] = useState(false);
    const [isSharedInstitutionModalOpen, setIsSharedInstitutionModalOpen] = useState(false);
    const [sharedInstitutionForm, setSharedInstitutionForm] = useState<SharedInstitutionData>({
        id: '',
        name: '',
        phone: '',
        email: '',
        notes: '',
        authorizedPerson: '',
        description: ''
    });
    
    // Tuition Ranges State
    const [tuitionRanges, setTuitionRanges] = useState<string[]>([]);

    // Budget Ranges State (CRUD)
    const [budgetRangesList, setBudgetRangesList] = useState<any[]>([]);
    const [isLoadingBudgetRanges, setIsLoadingBudgetRanges] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [budgetForm, setBudgetForm] = useState({ id: '', label: '', sort_order: 0 });

    // University Programs State
    const [universityPrograms, setUniversityPrograms] = useState<UniversityProgramData[]>([]);
    const [isLoadingUniversityPrograms, setIsLoadingUniversityPrograms] = useState(false);
    const [isUniversityProgramModalOpen, setIsUniversityProgramModalOpen] = useState(false);
    const [universityProgramForm, setUniversityProgramForm] = useState<UniversityProgramData>({
        id: '', universityId: '', type: 'Bachelor', name: '', url: '', 
        mainCategoryId: '', mainCategory2Id: '', mainCategory3Id: '',
        mainDegreeId: '', mainDegree2Id: '', mainDegree3Id: '',
        language: '', tuitionRange: ''
    });
    const [selectedProgramFilterCountry, setSelectedProgramFilterCountry] = useState<string>('');
    const [universityProgramSearchTerm, setUniversityProgramSearchTerm] = useState('');

    // Country Edit/Create State
    const [isEditingCountry, setIsEditingCountry] = useState(false);
    const [countryForm, setCountryForm] = useState<CountryData>(MOCK_COUNTRIES[0]);
    const [isSavingCountry, setIsSavingCountry] = useState(false);

    // User Form State
    const [newUser, setNewUser] = useState<Partial<SystemUser>>({
        full_name: '',
        email: '',
        phone: '',
        avatarUrl: '',
        role: undefined,
        branch_id: '',
        status: 'active',
        parent_user_id: ''
    });

    useEffect(() => {
        loadUsers();
        loadBranches();
        loadCrmStudents();
        loadSchoolNames();
    }, []);

    useEffect(() => {
        if (!supabase) return;

        const reloadCrmStudents = () => {
            loadCrmStudents();
        };

        const crmStudentsChannel = supabase
            .channel('settings-crm-students-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_profiles' }, reloadCrmStudents)
            .subscribe();

        const systemUsersChannel = supabase
            .channel('settings-system-users-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, () => {
                loadUsers();
                reloadCrmStudents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(crmStudentsChannel);
            supabase.removeChannel(systemUsersChannel);
        };
    }, []);

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
            loadDepartmentKeywordRules();
        } else if (selectedDefinitionType === 'interested_programs') {
            loadInterestedPrograms();
        } else if (selectedDefinitionType === 'profile_boxes') {
            loadInterestedPrograms();
            loadProfileBoxes();
        } else if (selectedDefinitionType === 'docs') {
            loadDocumentTypes();
        } else if (selectedDefinitionType === 'shared_institutions') {
            loadSharedInstitutions();
        } else if (selectedDefinitionType === 'all_programs') {
            loadUniversities();
            loadTuitionRanges();
            loadMainDegrees();
        } else if (selectedDefinitionType === 'budget') {
            loadBudgetRangesList();
        } else if (selectedDefinitionType === 'university_programs') {
            loadUniversityPrograms();
            loadUniversities();
            loadMainDegrees();
            loadBudgetRangesList();
            loadTuitionRanges();
        } else if (selectedDefinitionType === 'university_types') {
            loadUniversityTypes();
        } else if (selectedDefinitionType === 'branches') {
            loadUsers();
            loadCrmStudents();
        } else if (selectedDefinitionType === 'high_school_names' || selectedDefinitionType === 'university_school_names') {
            loadSchoolNames();
        }
    }, [selectedDefinitionType]);

    // Pre-load data for overview cards when navigating to the tabs
    useEffect(() => {
        if (activeTab === 'definitions' && !selectedDefinitionType) {
            loadInterestedPrograms();
            loadProfileBoxes();
            loadSharedInstitutions();
            loadUniversityTypes();
            loadBudgetRangesList();
            loadDocumentTypes();
        } else if (activeTab === 'data' && !selectedDefinitionType) {
            loadCountries();
            loadUniversities();
            loadMainDegrees();
            loadSchoolNames();
        }
    }, [activeTab, selectedDefinitionType]);

    const loadUniversityPrograms = async () => {
        setIsLoadingUniversityPrograms(true);
        try {
            const data = await universityProgramService.getAll();
            setUniversityPrograms(data);
        } catch (error) {
            console.error("Failed to load university programs", error);
        } finally {
            setIsLoadingUniversityPrograms(false);
        }
    };

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
            const degrees = await mainDegreeService.getAll();
            setMainDegrees(degrees as MainDegreeData[]);
        } catch (error) {
            console.error('Failed to load degrees data', error);
        } finally {
            setIsLoadingMainDegrees(false);
        }
    };

    const loadDepartmentKeywordRules = async () => {
        try {
            const { data, error } = await supabase
                .from('department_keyword_rules')
                .select('id, keyword, matched_department, department_name, major_keywords, required_match_keywords, rule_notes, is_active, priority')
                .order('priority', { ascending: true });

            if (error) throw error;

            setDepartmentKeywordRules((data || []) as DepartmentKeywordRule[]);
        } catch (error) {
            console.error('Failed to load department keyword rules', error);
            setDepartmentKeywordRules([]);
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

    const loadBranches = async () => {
        const data = await systemService.getBranches();
        setBranches(data);
    };

    const loadCrmStudents = async () => {
        setIsLoadingCrmStudents(true);
        try {
            const data = await studentService.getAll();
            setCrmStudents(data);
        } catch (error) {
            console.error('Failed to load CRM students for branches', error);
            setCrmStudents([]);
        } finally {
            setIsLoadingCrmStudents(false);
        }
    };

    const loadProfileBoxes = async () => {
        setIsLoadingProfileBoxes(true);
        try {
            const data = await profileBoxService.getAll();
            setProfileBoxes(data);
        } catch (error) {
            console.error('Failed to load profile boxes', error);
        } finally {
            setIsLoadingProfileBoxes(false);
        }
    };

    const loadSchoolNames = async () => {
        try {
            const data = await schoolNameService.getAll();
            setSchoolNames(data);
        } catch (error) {
            console.error('Failed to load school names', error);
        }
    };

    const getSchoolNamesByType = (type: SchoolNameType) => schoolNames.filter(record => record.type === type);

    const handleAddSchoolName = async (type: SchoolNameType) => {
        try {
            await schoolNameService.add(type, schoolNameInput);
            setSchoolNameInput('');
            await loadSchoolNames();
        } catch (error: any) {
            alert(error?.message || 'Okul adı eklenemedi.');
        }
    };

    const handleDeleteSchoolName = async (id: string) => {
        await schoolNameService.delete(id);
        await loadSchoolNames();
    };

    const getSchoolNameTitle = (type: SchoolNameType) => type === 'high_school' ? 'Türkiye Liseleri' : 'Türkiye Üniversiteleri';

    const getSchoolNameFileInputRef = (type: SchoolNameType) => type === 'high_school'
        ? highSchoolNamesFileInputRef
        : universitySchoolNamesFileInputRef;

    const handleExportSchoolNames = (type: SchoolNameType) => {
        const title = getSchoolNameTitle(type);
        const rows = getSchoolNamesByType(type).map(record => ({
            'Okul Adı': record.name,
            'Tür': title
        }));

        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Okul Adı': '', 'Tür': title }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportSchoolNames = async (type: SchoolNameType, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            try {
                const data = new Uint8Array(readerEvent.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet) as any[];
                const names = rows
                    .map(row => String(row['Okul Adı'] || row['School Name'] || row['Name'] || row['name'] || Object.values(row)[0] || '').trim())
                    .filter(Boolean);

                if (names.length === 0) {
                    alert('Excel dosyasında okul adı bulunamadı. "Okul Adı" sütunu kullanabilirsiniz.');
                    return;
                }

                await schoolNameService.bulkUpsert(type, names);
                await loadSchoolNames();
                alert(`${names.length} okul adı yüklendi.`);
            } catch (error: any) {
                console.error('School names import failed', error);
                alert(error?.message || 'Excel yüklenirken hata oluştu.');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const loadUsers = async () => {
        try {
            const data = await systemService.getSystemUsers();
            setUsers(data);
        } catch (error) {
            console.error('Kullanıcılar yüklenemedi.', error);
            alert(error instanceof Error ? error.message : 'Kullanıcılar yüklenemedi. Lütfen tekrar deneyin.');
        }
    };

    const getStudentSourceBranchId = (branch: Branch) => {
        if (branch.name.trim().toLocaleLowerCase('tr') === 'bale kıyafet') {
            return branches.find(item => item.name.trim().toLocaleLowerCase('tr') === 'bale')?.id || branch.id;
        }

        return branch.id;
    };

    const getBranchCrmStudents = (branch: Branch) => {
        const sourceBranchId = getStudentSourceBranchId(branch);
        return crmStudents.filter(student => student.branchId === sourceBranchId);
    };

    const loadDocumentTypes = async () => {
        setIsLoadingDocumentTypes(true);
        try {
            setDocumentTypes(await documentTypeService.getAll());
        } catch (error) {
            console.error('Failed to load document types', error);
            setDocumentTypes([]);
        } finally {
            setIsLoadingDocumentTypes(false);
        }
    };

    // User Actions
    const resetUserForm = () => {
        setEditingUserId(null);
        setNewUserPassword('');
        setNewUser({
            full_name: '',
            email: '',
            phone: '',
            avatarUrl: '',
            role: undefined,
            branch_id: '',
            status: 'active',
            parent_user_id: ''
        });
    };

    const openAddUserModal = () => {
        resetUserForm();
        setIsUserModalOpen(true);
    };

    const openEditUserModal = (user: SystemUser) => {
        setEditingUserId(user.id);
        setNewUserPassword('');
        setNewUser({
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            role: user.role,
            branch_id: user.branch_id,
            status: user.status,
            parent_user_id: user.parent_user_id
        });
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.role) {
            alert('Rol seçimi zorunludur.');
            return;
        }

        const createdUser: SystemUser = {
            id: editingUserId || `user-${Date.now()}`,
            full_name: newUser.full_name || '',
            email: newUser.email || '',
            phone: newUser.phone || '',
            role: newUser.role,
            branch_id: roleRequiresBranch(newUser.role) ? newUser.branch_id || '' : '',
            parent_user_id: newUser.parent_user_id,
            status: newUser.status || 'active',
            avatarUrl: newUser.avatarUrl || DEFAULT_USER_AVATAR_URL,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            if (!editingUserId && !newUserPassword) {
                alert('Sisteme giriş şifresi zorunludur.');
                return;
            }

            const parentUser = users.find(user => user.id === createdUser.parent_user_id);
            const hierarchyValidation = validateUserHierarchy(createdUser, parentUser, users);
            if (!hierarchyValidation.valid) {
                alert(hierarchyValidation.error);
                return;
            }

            const userPayload = {
                full_name: createdUser.full_name,
                email: createdUser.email,
                phone: createdUser.phone,
                role: createdUser.role,
                branch_id: createdUser.branch_id,
                parent_user_id: createdUser.parent_user_id,
                status: createdUser.status,
                avatarUrl: createdUser.avatarUrl
            };

            const savedUser = editingUserId
                ? await systemService.updateSystemUser(editingUserId, userPayload)
                : await systemService.addSystemUserWithAuth(userPayload, newUserPassword);

            setUsers(editingUserId
                ? users.map(user => user.id === editingUserId ? savedUser : user)
                : [savedUser, ...users]
            );
            setIsUserModalOpen(false);
            resetUserForm();
        } catch (error) {
            console.error('Failed to save user to system_users', error);
            const message = error instanceof Error ? error.message : JSON.stringify(error);
            alert(`Kullanıcı kaydedilemedi: ${message}`);
        }
    };

    const handleAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        const now = new Date().toISOString();
        const createdBranch: Branch = {
            id: `branch-${Date.now()}`,
            name: branchForm.name || '',
            country: 'Türkiye',
            city: branchForm.city || '',
            address: branchForm.address || '',
            phone: branchForm.phone || '',
            email: branchForm.email || '',
            status: branchForm.status || 'active',
            manager_id: branchForm.manager_id || '',
            created_at: now,
            updated_at: now
        };

        try {
            const savedBranch = await systemService.addBranch({
                name: createdBranch.name,
                country: createdBranch.country,
                city: createdBranch.city,
                address: createdBranch.address,
                phone: createdBranch.phone,
                email: createdBranch.email,
                status: createdBranch.status,
                manager_id: createdBranch.manager_id
            });
            setBranches([savedBranch, ...branches]);
        } catch (error) {
            console.warn('Branch could not be saved to Supabase. Keeping local record.', error);
            setBranches([createdBranch, ...branches]);
        } finally {
            setIsBranchModalOpen(false);
            setBranchForm({
                name: '',
                city: '',
                address: '',
                phone: '',
                email: '',
                status: 'active'
            });
        }
    };

    const toggleBranchStatus = async (id: string) => {
        const branch = branches.find(b => b.id === id);
        if (!branch) return;

        const nextStatus = branch.status === 'active' ? 'passive' : 'active';
        setBranches(branches.map(b => b.id === id ? { ...b, status: nextStatus, updated_at: new Date().toISOString() } : b));

        try {
            await systemService.updateBranchStatus(id, nextStatus);
        } catch (error) {
            console.warn('Branch status could not be saved to Supabase. Keeping local update.', error);
        }
    };

    const toggleUserStatus = async (id: string) => {
        const user = users.find(u => u.id === id);
        if (!user || user.status !== 'passive') return;

        const nextStatus = 'active';
        setUsers(users.map(u => u.id === id ? { ...u, status: nextStatus, updated_at: new Date().toISOString() } : u));

        try {
            await systemService.updateSystemUserStatus(id, nextStatus);
        } catch (error) {
            console.error('Failed to update system_users status', error);
            alert('Kullanıcı durumu Supabase üzerinde güncellenemedi.');
            setUsers(users);
        }
    };

    const deactivateUser = async (user: SystemUser) => {
        if (user.status === 'passive') return;
        if (!window.confirm(`${user.full_name} adlı kullanıcıyı kaldırmak istediğinizden emin misiniz? Kullanıcı pasif duruma alınacaktır.`)) return;

        try {
            await systemService.deactivateSystemUser(user.id);
            setUsers(current => current.map(item => item.id === user.id
                ? { ...item, status: 'passive', updated_at: new Date().toISOString() }
                : item
            ));
        } catch (error) {
            console.error('Kullanıcı pasif duruma alınamadı.', error);
            alert(error instanceof Error ? error.message : 'Kullanıcı kaldırılamadı. Lütfen tekrar deneyin.');
        }
    };

    const permanentlyDeleteUser = async (user: SystemUser) => {
        const confirmed = window.confirm(
            `${user.full_name} adlı kullanıcı kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`
        );
        if (!confirmed) return;

        const enteredName = window.prompt(
            `Kalıcı silmeyi onaylamak için kullanıcının tam adını yazın: ${user.full_name}`
        );
        if (enteredName !== user.full_name) {
            if (enteredName !== null) alert('Girilen kullanıcı adı eşleşmedi. Kalıcı silme iptal edildi.');
            return;
        }

        try {
            await systemService.permanentlyDeleteSystemUser(user.id);
            setUsers(current => current.filter(item => item.id !== user.id));
        } catch (error) {
            console.error('Kullanıcı kalıcı olarak silinemedi.', error);
            alert(error instanceof Error ? error.message : 'Kullanıcı kalıcı olarak silinemedi. Lütfen tekrar deneyin.');
        }
    };

    const getAvailableParents = (role?: UserRole) => {
        const allowedRoles = getAllowedParentRoles(role);
        return users
            .filter(user => allowedRoles.includes(user.role))
            .filter(user => user.status === 'active')
            .filter(user => user.id !== editingUserId)
            .filter(user => {
                if (roleRequiresSameBranch(role)) return user.branch_id === newUser.branch_id;
                return !newUser.branch_id || !user.branch_id || user.branch_id === newUser.branch_id;
            })
            .filter(user => !wouldCreateHierarchyCycle(editingUserId || undefined, user.id, users))
            .sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr-TR'));
    };

    // --- UNIVERSITY LOGIC ---
    const handleAddUniversity = async () => {
        await loadUniversityTypes();
        setUniversityForm({
            id: `uni-${Date.now()}`,
            name: '',
            logo: DEFAULT_UNIC_LOGO_URL,
            countries: [],
            rankingUrl: '',
            websiteUrl: '',
            departmentsUrl: '',
            parserProfile: 'auto',
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
            parserProfile: uni.parserProfile || 'auto',
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
            await loadUniversities();
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

    const getUniversitySortValue = (uni: UniversityData, key: UniversitySortKey) => {
        switch (key) {
            case 'countries':
                return (uni.countries || []).join(', ');
            case 'types':
                return (uni.universityTypes || []).join(', ');
            case 'links':
                return [uni.websiteUrl, uni.departmentsUrl, uni.rankingUrl].filter(Boolean).length;
            case 'programs':
                return (uni.programs || []).length;
            case 'name':
            default:
                return uni.name || '';
        }
    };

    const sortedUniversities = universitySortConfig
        ? [...filteredUniversities].sort((first, second) => {
            const firstValue = getUniversitySortValue(first, universitySortConfig.key);
            const secondValue = getUniversitySortValue(second, universitySortConfig.key);
            const sortResult = typeof firstValue === 'number' && typeof secondValue === 'number'
                ? firstValue - secondValue
                : String(firstValue).localeCompare(String(secondValue), 'tr', { numeric: true, sensitivity: 'base' });

            return universitySortConfig.direction === 'asc' ? sortResult : -sortResult;
        })
        : filteredUniversities;

    const handleUniversitySort = (key: UniversitySortKey) => {
        setUniversitySortConfig(prev => ({
            key,
            direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const renderUniversitySortHeader = (key: UniversitySortKey, label: string, className = '') => {
        const isActive = universitySortConfig?.key === key;

        return (
            <button
                type="button"
                onClick={() => handleUniversitySort(key)}
                className={`inline-flex items-center gap-1 font-semibold transition-colors hover:text-indigo-700 ${className}`}
            >
                <span>{label}</span>
                <span className={`text-[10px] ${isActive ? 'text-indigo-700' : 'text-slate-300'}`}>
                    {isActive ? (universitySortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                </span>
            </button>
        );
    };

    const handleExportUniversities = () => {
        const exportData = sortedUniversities.map(uni => ({
            'ID': uni.id,
            'Üniversite Adı': uni.name,
            'Logo URL': uni.logo || '',
            'Website': uni.websiteUrl || '',
            'Departments URL': uni.departmentsUrl || '',
            'Parser Profile': uni.parserProfile || 'auto',
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
                let updatedCount = 0;
                const defaultLogo = DEFAULT_UNIC_LOGO_URL;

                for (const row of jsonData) {
                    const uniName = (row['Üniversite Adı'] || row['University Name'] || '').trim();
                    if (!uniName) continue;

                    // Mevcut üniversiteyi isim bazında ara
                    const existing = universities.find(u => u.name.toLowerCase() === uniName.toLowerCase());

                    const uniData: UniversityData = {
                        id: existing?.id || `uni-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: uniName,
                        logo: row['Logo URL'] || row['Logo'] || existing?.logo || defaultLogo,
                        websiteUrl: row['Website'] || row['Website URL'] || existing?.websiteUrl || '',
                        departmentsUrl: row['Departments URL'] || row['Departments'] || existing?.departmentsUrl || '',
                        parserProfile: row['Parser Profile'] || existing?.parserProfile || 'auto',
                        rankingUrl: row['Ranking URL'] || row['Ranking'] || existing?.rankingUrl || '',
                        countries: row['Ülkeler'] ? String(row['Ülkeler']).split(',').map((s: string) => s.trim()) : (existing?.countries || []),
                        universityTypes: row['Üniversite Tipleri'] ? String(row['Üniversite Tipleri']).split(',').map((s: string) => s.trim()) : (existing?.universityTypes || []),
                        consultingType: row['Danışmanlık Türü'] || row['Consulting Type'] || existing?.consultingType || '',
                        sharedInstitutionId: row['Paylaşımlı Kurum'] || row['Shared Institution'] || existing?.sharedInstitutionId || '',
                        programs: existing?.programs || []
                    };

                    try {
                        const saved = await universityService.upsert(uniData);
                        setUniversities(prev => {
                            const idx = prev.findIndex(u => u.name.toLowerCase() === uniName.toLowerCase());
                            if (idx >= 0) {
                                const updated = [...prev];
                                updated[idx] = saved;
                                return updated;
                            }
                            return [saved, ...prev];
                        });
                        if (existing) {
                            updatedCount++;
                        } else {
                            importedCount++;
                        }
                    } catch (err) {
                        console.error('Failed to import university:', uniName, err);
                    }
                }

                alert(`${importedCount} yeni üniversite eklendi, ${updatedCount} mevcut üniversite güncellendi.`);
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

    const updateUniversityField = (field: keyof UniversityData, value: any) => {
        const urlFields: string[] = ['rankingUrl', 'websiteUrl', 'logo', 'departmentsUrl'];
        const formattedValue = (typeof value === 'string' && !urlFields.includes(field)) ? formatTitleCase(value) : value;
        setUniversityForm(prev => ({ ...prev, [field]: formattedValue }));
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
    const getDepartmentKeywordRuleForDegree = (degreeName: string) => {
        const normalizedDegreeName = normalizeDepartmentName(degreeName);

        return departmentKeywordRules.find(rule =>
            normalizeDepartmentName(rule.department_name || '') === normalizedDegreeName ||
            normalizeDepartmentName(rule.matched_department || '') === normalizedDegreeName
        );
    };

    const setDepartmentKeywordRuleFormFromDegree = (degreeName: string) => {
        const rule = getDepartmentKeywordRuleForDegree(degreeName);

        setDepartmentKeywordRuleForm(rule ? {
            id: rule.id,
            department_name: rule.department_name || degreeName,
            major_keywords: formatKeywordArray(rule.major_keywords),
            required_match_keywords: formatKeywordArray(rule.required_match_keywords),
            rule_notes: rule.rule_notes || '',
            is_active: rule.is_active ?? true,
            priority: String(rule.priority ?? 100)
        } : {
            ...emptyDepartmentKeywordRuleForm,
            department_name: degreeName
        });
    };

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
        setDepartmentKeywordRuleForm(emptyDepartmentKeywordRuleForm);
        setIsMainDegreeModalOpen(true);
    };

    const handleEditMainDegree = (deg: MainDegreeData) => {
        setMainDegreeForm(deg);
        setDepartmentKeywordRuleFormFromDegree(deg.name);
        setIsMainDegreeModalOpen(true);
    };

    const handleExportMainDegrees = async () => {
        try {
            const { data: latestKeywordRules, error: keywordRuleError } = await supabase
                .from('department_keyword_rules')
                .select('id, keyword, matched_department, department_name, major_keywords, required_match_keywords, rule_notes, is_active, priority')
                .order('priority', { ascending: true });

            if (keywordRuleError) throw keywordRuleError;

            const exportKeywordRules = (latestKeywordRules || []) as DepartmentKeywordRule[];
            setDepartmentKeywordRules(exportKeywordRules);

            const getExportKeywordRuleForDegree = (degreeName: string) => {
                const normalizedDegreeName = normalizeDepartmentName(degreeName);

                return exportKeywordRules.find(rule =>
                    normalizeDepartmentName(rule.department_name || '') === normalizedDegreeName ||
                    normalizeDepartmentName(rule.matched_department || '') === normalizedDegreeName
                );
            };

            const exportData = mainDegrees.map(deg => {
                const keywordRule = getExportKeywordRuleForDegree(deg.name);

                return {
                    'ID': deg.id.startsWith('deg-') ? '' : deg.id,
                    'Bölüm Adı': deg.name,
                    'Major Keywords': (keywordRule?.major_keywords || []).join(', '),
                    'Zorunlu Eşleşme Kelimeleri': (keywordRule?.required_match_keywords || []).join(', '),
                    'Bölüm Tanımı': deg.description,
                    'Kariyer Fırsatları': deg.careerOpportunities,
                    'Lisans Bölümleri': deg.aiImpact,
                    'Öne Çıkan Firmalar': deg.topCompanies,
                    "Türkiye'de Sektörün Durumu": deg.sectorStatusTR,
                    'Resim URL': deg.imageUrl
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Bölümler");
            XLSX.writeFile(wb, `bolumler_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error("Excel export failed", error);
            alert("Export failed");
        }
    };

    const handleImportMainDegrees = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Excel'deki veriler sisteme yüklenecek. Devam edilsin mi?")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                let successCount = 0;
                let keywordRuleSuccessCount = 0;

                const getCellValue = (row: Record<string, any>, columns: string[]) => {
                    for (const column of columns) {
                        if (row[column] !== undefined && row[column] !== null) {
                            return String(row[column]).trim();
                        }
                    }

                    return '';
                };

                for (const row of data) {
                    try {
                        const rowName = String(row['Bölüm Adı'] || row['Alt Başlık Adı'] || '').trim();
                        if (!rowName) continue;

                        const existingDegree = mainDegrees.find(d => d.name.toLowerCase() === rowName.toLowerCase());
                        const majorKeywords = parseCommaSeparatedKeywords(getCellValue(row, ['Major Keywords', 'Major Keyword', 'Anahtar Kelimeler']));
                        const requiredMatchKeywords = parseCommaSeparatedKeywords(getCellValue(row, ['Zorunlu Eşleşme Kelimeleri', 'Required Match Keywords', 'Required Keywords']));
                        const ruleNotes = getCellValue(row, ['Notlar', 'Rule Notes', 'Kural Notları']);
                        
                        const dbPayload: MainDegreeData = {
                            id: row['ID'] || existingDegree?.id || `deg-new-${Date.now()}-${successCount}`,
                            name: rowName,
                            description: String(row['Bölüm Tanımı'] || row['Açıklama'] || ''),
                            careerOpportunities: String(row['Kariyer Fırsatları'] || ''),
                            aiImpact: String(row['Lisans Bölümleri'] || row['AI Etkisi'] || ''),
                            topCompanies: String(row['Öne Çıkan Firmalar'] || ''),
                            sectorStatusTR: String(row["Türkiye'de Sektörün Durumu"] || row['Sektör Durumu (TR)'] || ''),
                            imageUrl: String(row['Resim URL'] || ''),
                            categoryIds: existingDegree?.categoryIds || []
                        };

                        await mainDegreeService.upsert(dbPayload);

                        if (majorKeywords.length > 0 || requiredMatchKeywords.length > 0 || ruleNotes) {
                            const keyword = majorKeywords[0] || requiredMatchKeywords[0] || rowName;
                            const keywordRulePayload = {
                                department_name: rowName,
                                matched_department: rowName,
                                keyword,
                                major_keywords: majorKeywords,
                                required_match_keywords: requiredMatchKeywords,
                                rule_notes: ruleNotes || null,
                                is_active: true,
                                priority: 100,
                                updated_at: new Date().toISOString()
                            };
                            const { error: keywordRuleError } = await supabase
                                .from('department_keyword_rules')
                                .upsert(keywordRulePayload, { onConflict: 'department_name' });

                            if (keywordRuleError) throw keywordRuleError;

                            keywordRuleSuccessCount++;
                        }

                        successCount++;
                    } catch (err) {
                        console.error("Row import failed", row, err);
                    }
                }

                alert(`${successCount} adet alt başlık başarıyla yüklendi. ${keywordRuleSuccessCount} adet bölüm eşleşme kuralı güncellendi.`);
                await loadMainDegrees();
                await loadDepartmentKeywordRules();
            } catch (error) {
                console.error("Excel import failed", error);
                alert("Import failed");
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveMainDegree = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const degreeName = departmentKeywordRuleForm.department_name.trim() || mainDegreeForm.name.trim();

            if (!degreeName) {
                alert('Bölüm adı zorunludur.');
                return;
            }

            const savedDeg = await mainDegreeService.upsert({ ...mainDegreeForm, name: degreeName });
            const departmentName = degreeName;
            const majorKeywords = parseCommaSeparatedKeywords(departmentKeywordRuleForm.major_keywords);
            const requiredMatchKeywords = parseCommaSeparatedKeywords(departmentKeywordRuleForm.required_match_keywords);
            const hasKeywordRuleData = departmentKeywordRuleForm.id || majorKeywords.length > 0 || requiredMatchKeywords.length > 0 || departmentKeywordRuleForm.rule_notes.trim();

            if (hasKeywordRuleData) {
                const priority = Number(departmentKeywordRuleForm.priority || 100);
                const keyword = majorKeywords[0] || requiredMatchKeywords[0] || departmentName;
                const keywordRulePayload = {
                    department_name: departmentName,
                    matched_department: departmentName,
                    keyword,
                    major_keywords: majorKeywords,
                    required_match_keywords: requiredMatchKeywords,
                    rule_notes: departmentKeywordRuleForm.rule_notes.trim() || null,
                    is_active: departmentKeywordRuleForm.is_active,
                    priority: Number.isFinite(priority) ? priority : 100,
                    updated_at: new Date().toISOString()
                };
                const existingKeywordRule = departmentKeywordRuleForm.id
                    ? null
                    : departmentKeywordRules.find(rule => normalizeDepartmentName(rule.department_name || '') === normalizeDepartmentName(departmentName));
                const keywordRuleId = departmentKeywordRuleForm.id || existingKeywordRule?.id;

                const { error: keywordRuleError } = keywordRuleId
                    ? await supabase.from('department_keyword_rules').update(keywordRulePayload).eq('id', keywordRuleId)
                    : await supabase.from('department_keyword_rules').upsert(keywordRulePayload, { onConflict: 'department_name' });

                if (keywordRuleError) throw keywordRuleError;
                await loadDepartmentKeywordRules();
            }

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
        } catch (error: any) {
            console.error("Failed to save main degree detail:", error);
            const errorMsg = error?.message || (typeof error === 'string' ? error : "Unknown error");
            const errorDetail = error?.details || error?.hint || "";
            alert(`Failed to save main degree: ${errorMsg} ${errorDetail}`);
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

    // --- DOCUMENT TYPE LOGIC ---
    const handleAddDocumentType = () => {
        setDocumentTypeForm({ id: '', name: '', englishName: '', note: '', fileType: '', allowMultiple: false, isActive: true, isRequired: false, sortOrder: 0 });
        setIsDocumentTypeModalOpen(true);
    };

    const handleEditDocumentType = (documentType: DocumentTypeDefinition) => {
        setDocumentTypeForm(documentType);
        setIsDocumentTypeModalOpen(true);
    };

    const handleSaveDocumentType = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingDocumentType(true);
        try {
            const savedDocumentType = await documentTypeService.save(documentTypeForm);
            setDocumentTypes(prev => {
                const exists = prev.some(item => item.id === savedDocumentType.id);
                const next = exists
                    ? prev.map(item => item.id === savedDocumentType.id ? savedDocumentType : item)
                    : [...prev, savedDocumentType];
                return next.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
            });
            setIsDocumentTypeModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save document type', error);
            alert(error?.code === '23505' ? 'Bu evrak adı zaten tanımlı.' : `Evrak türü kaydedilemedi: ${error?.message || 'Bilinmeyen hata'}`);
        } finally {
            setIsSavingDocumentType(false);
        }
    };

    const handleDeleteDocumentType = async (id: string) => {
        if (!window.confirm('Bu evrak türünü silmek istediğinize emin misiniz?')) return;
        try {
            await documentTypeService.delete(id);
            setDocumentTypes(prev => prev.filter(item => item.id !== id));
        } catch (error: any) {
            console.error('Failed to delete document type', error);
            alert(`Evrak türü silinemedi: ${error?.message || 'Bilinmeyen hata'}`);
        }
    };

    const handleToggleProfileBoxProgram = async (boxId: string, programName: string) => {
        const nextBoxes = profileBoxes.map(box => {
            if (box.id !== boxId) return box;

            const isSelected = box.programNames.some(name => name.toLocaleLowerCase('tr-TR') === programName.toLocaleLowerCase('tr-TR'));
            const programNames = isSelected
                ? box.programNames.filter(name => name.toLocaleLowerCase('tr-TR') !== programName.toLocaleLowerCase('tr-TR'))
                : [...box.programNames, programName].sort((a, b) => a.localeCompare(b, 'tr-TR'));

            return { ...box, programNames };
        });

        setProfileBoxes(nextBoxes);
        await profileBoxService.saveAll(nextBoxes);
    };

    const handleClearProfileBoxPrograms = async (boxId: string) => {
        const nextBoxes = profileBoxes.map(box => box.id === boxId ? { ...box, programNames: [] } : box);
        setProfileBoxes(nextBoxes);
        await profileBoxService.saveAll(nextBoxes);
    };

    const getInterestedProgramLogo = (programName: string) => {
        const normalizedName = programName.toLocaleLowerCase('tr-TR');

        if (normalizedName.includes('yaz') || normalizedName.includes('summer') || normalizedName.includes('kamp')) {
            return { Icon: Sun, bg: 'bg-amber-50', color: 'text-amber-600', withStar: false };
        }

        if (normalizedName.includes('yüksek lisans') || normalizedName.includes('master') || normalizedName.includes('graduate')) {
            return { Icon: GraduationCap, bg: 'bg-purple-50', color: 'text-purple-600', withStar: true };
        }

        if (normalizedName.includes('dil') || normalizedName.includes('language')) {
            return { Icon: MessageCircle, bg: 'bg-sky-50', color: 'text-sky-600', withStar: false };
        }

        if (normalizedName.includes('lise') || normalizedName.includes('high school') || normalizedName.includes('secondary')) {
            return { Icon: School, bg: 'bg-emerald-50', color: 'text-emerald-600', withStar: false };
        }

        if (normalizedName.includes('üniversite') || normalizedName.includes('universite') || normalizedName.includes('university') || normalizedName.includes('lisans') || normalizedName.includes('undergraduate')) {
            return { Icon: GraduationCap, bg: 'bg-indigo-50', color: 'text-indigo-600', withStar: false };
        }

        return { Icon: Briefcase, bg: 'bg-slate-100', color: 'text-slate-600', withStar: false };
    };

    // --- SHARED INSTITUTION LOGIC ---
    const handleAddSharedInstitution = () => {
        setSharedInstitutionForm({
            id: `shint-${Date.now()}`,
            name: '',
            phone: '',
            email: '',
            notes: '',
            authorizedPerson: '',
            description: ''
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
        } catch (error: any) {
            console.error("Failed to save shared institution", error);
            alert('Kurum kaydedilirken hata oluştu: ' + (error?.message || JSON.stringify(error)));
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
            educationSystemDescription: '',
            bachelorTypes: [],
            masterTypes: [],
            postGradWorkPermit: '',
            studentWorkPermit: '',
            yksRequirement: '',
            population: '',
            popularSectors: '',
            generalApplicationRequirements: '',
            examRequirements: '',
            foundationRequirements: '',
            visaTypes: []
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
        const formattedValue = typeof value === 'string' ? formatTitleCase(value) : value;
        setCountryForm(prev => ({ ...prev, [field]: formattedValue }));
    };

    const updateEducationType = (
        degree: 'bachelor' | 'master', 
        index: number, 
        field: keyof EducationType, 
        value: string
    ) => {
        const targetList = degree === 'bachelor' ? 'bachelorTypes' : 'masterTypes';
        const newList = [...countryForm[targetList]];
        newList[index] = { ...newList[index], [field]: formatTitleCase(value) };
        setCountryForm(prev => ({ ...prev, [targetList]: newList }));
    };

    const addEducationType = (degree: 'bachelor' | 'master') => {
        const targetList = degree === 'bachelor' ? 'bachelorTypes' : 'masterTypes';
        const limit = 5; // Updated limit to 5

        if (countryForm[targetList].length >= limit) return;

        setCountryForm(prev => ({
            ...prev,
            [targetList]: [...prev[targetList], { duration: '', description: '' }]
        }));
    };

    const removeEducationType = (degree: 'bachelor' | 'master', index: number) => {
        const targetList = degree === 'bachelor' ? 'bachelorTypes' : 'masterTypes';
        setCountryForm(prev => ({
            ...prev,
            [targetList]: prev[targetList].filter((_, i) => i !== index)
        }));
    };

    const addVisaType = () => {
        const newVisa = { id: `v-${Date.now()}`, name: '', description: '' };
        setCountryForm(prev => ({
            ...prev,
            visaTypes: [...(prev.visaTypes || []), newVisa]
        }));
    };

    const removeVisaType = (id: string) => {
        setCountryForm(prev => ({
            ...prev,
            visaTypes: (prev.visaTypes || []).filter(v => v.id !== id)
        }));
    };

    const updateVisaType = (id: string, field: 'name' | 'description', value: string) => {
        const formattedValue = formatTitleCase(value);
        setCountryForm(prev => ({
            ...prev,
            visaTypes: (prev.visaTypes || []).map(v => v.id === id ? { ...v, [field]: formattedValue } : v)
        }));
    };

    // --- RENDERERS ---

    const renderUserManagement = () => (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Kullanıcı Yönetimi</h3>
                    <p className="text-sm text-slate-500">Admin, danışman ve temsilci kullanıcılarını yönetin.</p>
                </div>
                <button 
                    onClick={openAddUserModal}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Kullanıcı Ekle
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                            <th className="px-6 py-4 font-semibold">Kullanıcı</th>
                            <th className="px-6 py-4 font-semibold">Rol</th>
                            <th className="px-6 py-4 font-semibold">Bağlı Olduğu Yönetici</th>
                            <th className="px-6 py-4 font-semibold">Durum</th>
                            <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => {
                            const parent = users.find(u => u.id === user.parent_user_id);
                            return (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name}`} alt="" className="w-10 h-10 rounded-full bg-slate-100" />
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
                                                <img src={parent.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${parent.full_name}`} className="w-5 h-5 rounded-full" />
                                                <span className="font-medium text-slate-700">{parent.full_name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                         <button
                                             onClick={() => toggleUserStatus(user.id)}
                                             disabled={user.status === 'active'}
                                             title={user.status === 'passive' ? 'Kullanıcıyı yeniden etkinleştir' : 'Kullanıcı aktif'}
                                             aria-label={user.status === 'passive' ? `${user.full_name} kullanıcısını yeniden etkinleştir` : `${user.full_name} kullanıcısı aktif`}
                                             className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                             user.status === 'active'
                                                 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                                                 : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                        }`}>
                                            {user.status === 'active' ? (
                                                <><CheckCircle className="w-3 h-3" /> Aktif</>
                                            ) : (
                                                <><XCircle className="w-3 h-3" /> Pasif</>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                             <button
                                                 onClick={() => openEditUserModal(user)}
                                                 title="Kullanıcıyı düzenle"
                                                 aria-label={`${user.full_name} kullanıcısını düzenle`}
                                                 className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                              <button
                                                  onClick={() => deactivateUser(user)}
                                                  disabled={user.status === 'passive' || currentUser?.id === user.id}
                                                  title={currentUser?.id === user.id ? 'Kendi hesabınızı kaldıramazsınız' : user.status === 'passive' ? 'Kullanıcı zaten kaldırılmış' : 'Kullanıcıyı kaldır'}
                                                 aria-label={`${user.full_name} kullanıcısını kaldır`}
                                                 className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                             >
                                                 <Trash2 className="w-4 h-4" />
                                             </button>
                                             {currentUser?.role === UserRole.SUPER_ADMIN && currentUser.id !== user.id && (
                                                 <button
                                                     onClick={() => permanentlyDeleteUser(user)}
                                                     title="Kullanıcıyı kalıcı olarak sil"
                                                     aria-label={`${user.full_name} kullanıcısını kalıcı olarak sil`}
                                                     className="p-2 text-rose-600 bg-rose-50 hover:text-white hover:bg-rose-600 rounded-lg transition-colors"
                                                 >
                                                     <XCircle className="w-4 h-4" />
                                                 </button>
                                             )}
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
                                    <th className="px-6 py-4">{renderUniversitySortHeader('name', 'University')}</th>
                                    <th className="px-6 py-4">{renderUniversitySortHeader('countries', 'Countries')}</th>
                                    <th className="px-6 py-4">{renderUniversitySortHeader('types', 'Type')}</th>
                                    <th className="px-6 py-4">{renderUniversitySortHeader('links', 'Links & Ranking')}</th>
                                    <th className="px-6 py-4">{renderUniversitySortHeader('programs', 'Programs')}</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingUniversities ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-slate-500">Loading universities...</td>
                                    </tr>
                                ) : sortedUniversities.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-slate-500">No universities found. Add one to get started.</td>
                                    </tr>
                                ) : (
                                    sortedUniversities.map(uni => (
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
                                                    <div className="flex flex-col gap-2">
                                                        {uni.consultingType && (
                                                            <span className="w-fit px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-100">
                                                                {uni.consultingType}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-1">
                                                        {(uni.universityTypes || []).map(t => (
                                                            <span key={t} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium border border-indigo-200">{t}</span>
                                                        ))}
                                                        {(uni.universityTypes || []).length === 0 && <span className="text-slate-400 italic text-[10px]">-</span>}
                                                        </div>
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
                                                    <td colSpan={6} className="px-6 py-4 bg-indigo-50/30 border-b border-indigo-100">
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
                                                                                    <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                                        Ücret: {prog.tuitionRange || 'Belirtilmedi'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            {prog.link && (
                                                                                <a href={prog.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                                            {(prog.groupNames || []).length > 0 ? (
                                                                                prog.groupNames.map((gn: string) => (
                                                                                    <span key={gn} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-medium">
                                                                                        {gn}
                                                                                    </span>
                                                                                ))
                                                                            ) : (
                                                                                <span className="text-[9px] text-slate-300 italic">Gruplanmamış</span>
                                                                            )}
                                                                        </div>
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
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-800">Bölümler</h3>
                            <div className="flex gap-2">
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-purple-100">
                                    {mainDegrees.length} Bölüm
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Akademik programları düzenleyin.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <>
                        <button
                            onClick={handleExportMainDegrees}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                            title="Bölümleri Excel'e aktar"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel İndir</span>
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportMainDegrees}
                                className="hidden"
                                id="degree-excel-upload"
                            />
                            <label
                                htmlFor="degree-excel-upload"
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-100 cursor-pointer transition-colors"
                                title="Excel'den toplu bölüm yükle"
                            >
                                <Upload className="w-4 h-4" />
                                <span className="hidden sm:inline">Excel Yükle</span>
                            </label>
                        </div>
                    </>
                    
                    <button 
                        onClick={handleAddMainDegree}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Yeni Bölüm Ekle
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold">Bölüm Adı</th>
                                <th className="px-6 py-4 font-semibold">Major Keywords</th>
                                <th className="px-6 py-4 font-semibold">Zorunlu Eşleşme Kelimeleri</th>
                                <th className="px-6 py-4 font-semibold">Notlar</th>
                                <th className="px-6 py-4 font-semibold">Açıklama</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingMainDegrees ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500 italic">Veriler yükleniyor...</td>
                                </tr>
                            ) : mainDegrees.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Henüz bölüm tanımlanmamış.</td></tr>
                            ) : mainDegrees.map(deg => {
                                const keywordRule = getDepartmentKeywordRuleForDegree(deg.name);

                                return (
                                    <tr key={deg.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                                                    {deg.imageUrl ? <img src={deg.imageUrl} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-6 h-6 text-slate-300" />}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800">{keywordRule?.department_name || deg.name}</span>
                                                    {keywordRule && (
                                                        <div className={`mt-1 text-[10px] font-black uppercase tracking-wider ${keywordRule.is_active ?? true ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {keywordRule.is_active ?? true ? 'Aktif' : 'Pasif'} · Öncelik {keywordRule.priority ?? 100}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex max-w-xs flex-wrap gap-1.5">
                                                {(keywordRule?.major_keywords || []).length > 0 ? keywordRule?.major_keywords?.map((keyword, index) => (
                                                    <span key={`${keyword}-${index}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{keyword}</span>
                                                )) : <span className="text-xs text-slate-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex max-w-xs flex-wrap gap-1.5">
                                                {(keywordRule?.required_match_keywords || []).length > 0 ? keywordRule?.required_match_keywords?.map((keyword, index) => (
                                                    <span key={`${keyword}-${index}`} className="rounded-full border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 px-2.5 py-1 text-xs font-black text-rose-700 shadow-sm">{keyword}</span>
                                                )) : <span className="text-xs text-slate-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <span className="line-clamp-2 text-sm text-slate-500">{keywordRule?.rule_notes || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-500">{deg.description || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEditMainDegree(deg)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteMainDegree(deg.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
                                interestedPrograms.map(prog => {
                                    const logo = getInterestedProgramLogo(prog.name);
                                    const ProgramLogoIcon = logo.Icon;

                                    return (
                                        <tr key={prog.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${logo.bg} ${logo.color}`}>
                                                        <ProgramLogoIcon className="h-5 w-5" />
                                                        {logo.withStar && (
                                                            <Star className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white fill-amber-400 p-0.5 text-amber-400 shadow-sm" />
                                                        )}
                                                    </div>
                                                    <span>{prog.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{prog.description}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEditInterestedProgram(prog)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteInterestedProgram(prog.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderDocumentTypeManager = () => (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Evrak Türleri</h3>
                        <p className="text-sm text-slate-500">Sistemde kullanılacak evrakları ve yükleme biçimlerini tanımlayın.</p>
                    </div>
                </div>
                <button
                    onClick={handleAddDocumentType}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Evrak Tanımı
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold">Evrak Adı</th>
                                <th className="px-6 py-4 font-semibold">İngilizce Adı</th>
                                <th className="px-6 py-4 font-semibold">Evrak Notu</th>
                                <th className="px-6 py-4 font-semibold">Dosya Türü</th>
                                <th className="px-6 py-4 font-semibold">Evrak Adedi</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingDocumentTypes ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">
                                        <Loader2 className="inline-block w-5 h-5 mr-2 animate-spin" />
                                        Evrak türleri yükleniyor...
                                    </td>
                                </tr>
                            ) : documentTypes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">Henüz evrak türü tanımlanmadı.</td>
                                </tr>
                            ) : documentTypes.map(documentType => (
                                <tr key={documentType.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <span className="font-bold text-slate-800">{documentType.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">{documentType.englishName}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs">
                                        <p className="line-clamp-2">{documentType.note || '-'}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">{documentType.fileType}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${documentType.allowMultiple ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {documentType.allowMultiple ? 'Birden Çok Evrak' : 'Tek Evrak'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleEditDocumentType(documentType)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" aria-label="Evrak türünü düzenle">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteDocumentType(documentType.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" aria-label="Evrak türünü sil">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderProfileBoxManager = () => (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Profil Kutuları</h3>
                        <p className="text-sm text-slate-500">Öğrenci profilinde hangi kutuların hangi Program Tanımları için görüneceğini yönetin.</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold w-[28%]">Profil Kutusu</th>
                                <th className="px-6 py-4 font-semibold">Program Tanımları Eşleşmesi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingProfileBoxes ? (
                                <tr>
                                    <td colSpan={2} className="p-10 text-center text-slate-500">Profil kutuları yükleniyor...</td>
                                </tr>
                            ) : profileBoxes.map(box => (
                                <tr key={box.id} className="align-top hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <p className="font-bold text-slate-800">{box.label}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{box.description}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        {interestedPrograms.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">Önce Program Tanımları ekleyin.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {interestedPrograms.map(program => {
                                                        const checked = box.programNames.some(name => name.toLocaleLowerCase('tr-TR') === program.name.toLocaleLowerCase('tr-TR'));

                                                        return (
                                                            <label
                                                                key={`${box.id}-${program.id}`}
                                                                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${checked ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => handleToggleProfileBoxProgram(box.id, program.name)}
                                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                {program.name}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                                    <span>{box.programNames.length === 0 ? 'Eşleşme seçilmezse tüm program tiplerinde görünür.' : `${box.programNames.length} program tipiyle eşleşiyor.`}</span>
                                                    {box.programNames.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleClearProfileBoxPrograms(box.id)}
                                                            className="font-bold text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            Tümünde göster
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
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
                                <th className="px-6 py-4 font-semibold">Yetkili</th>
                                <th className="px-6 py-4 font-semibold">Telefon</th>
                                <th className="px-6 py-4 font-semibold">E-mail</th>
                                <th className="px-6 py-4 font-semibold">Not</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingSharedInstitutions ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">Yükleniyor...</td>
                                </tr>
                            ) : sharedInstitutions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">Henüz kurum eklenmedi.</td>
                                </tr>
                            ) : (
                                sharedInstitutions.map(inst => (
                                    <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{inst.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{inst.authorizedPerson || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{inst.phone || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{inst.email || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400 italic">
                                            <div className="max-w-[200px] truncate" title={inst.notes}>{inst.notes || '-'}</div>
                                        </td>
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

    const handleExportCountries = () => {
        try {
            const exportData = countries.map(c => ({
                'ID': c.id,
                'Ülke': c.name,
                'Bayrak': c.flag,
                'Başkent': c.capital,
                'Para Birimi': c.currency,
                'Nüfus': c.population,
                'Sektörler': c.popularSectors,
                'Mezuniyet Sonrası Çalışma İzni': c.postGradWorkPermit,
                'Öğrenci Çalışma İzni': c.studentWorkPermit,
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ülkeler");
            XLSX.writeFile(wb, "ulkeler.xlsx");
        } catch (error) {
            console.error("Export error:", error);
            alert("Dışa aktarma sırasında hata oluştu.");
        }
    };

    const handleImportCountries = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                let successCount = 0;
                for (const row of data) {
                    try {
                        const countryName = String(row['Ülke'] || '');
                        if (!countryName) continue;

                        const id = row['ID'] || countryName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                        
                        const dbPayload = {
                            id: id,
                            name: countryName,
                            flag: row['Bayrak'] || '🏳️',
                            capital: row['Başkent'] || '',
                            currency: row['Para Birimi'] || '',
                            population: row['Nüfus'] || '',
                            popular_sectors: row['Sektörler'] || '',
                            post_grad_work_permit: row['Mezuniyet Sonrası Çalışma İzni'] || '',
                            student_work_permit: row['Öğrenci Çalışma İzni'] || ''
                        };

                        await countryService.upsert(dbPayload as any);
                        successCount++;
                    } catch (err) {
                        console.error("Error importing country:", err);
                    }
                }
                alert(`${successCount} ülke başarıyla içe aktarıldı.`);
                loadCountries();
            };
            reader.readAsBinaryString(file);
        } catch (error) {
            console.error("Import error:", error);
            alert("İçe aktarma sırasında hata oluştu.");
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const renderCountryManager = () => {
        const selectedCountry = countries.find(c => c.id === selectedCountryId) || (countries.length > 0 ? countries[0] : countryForm);
        const dataToShow = isEditingCountry ? countryForm : selectedCountry;

        return (
            <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
                {/* Back Button, Title & Actions */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
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
                                {isEditingCountry ? (countryForm.id.startsWith('country-') ? 'Yeni Ülke Ekle' : 'Ülkeyi Düzenle') : 'Ülke Tanımları'}
                            </h3>
                            <p className="text-sm text-slate-500">Eğitim sistemlerini, gereksinimleri ve ülke detaylarını yönetin.</p>
                        </div>
                    </div>
                    {!isEditingCountry && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportCountries}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Excel İndir</span>
                            </button>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleImportCountries}
                                    className="hidden"
                                    id="countries-excel-upload"
                                />
                                <label
                                    htmlFor="countries-excel-upload"
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-100 cursor-pointer transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span className="hidden sm:inline">Excel Yükle</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {isLoadingCountries ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> Ülkeler yükleniyor...
                    </div>
                ) : (
                    <div className="flex flex-1 gap-6 overflow-hidden">
                        {/* Sidebar List (Disabled when editing) */}
                        <div className={`w-64 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-opacity ${isEditingCountry ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Ülke Listesi</h4>
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
                                {countries.length === 0 && <div className="p-4 text-center text-sm text-slate-400">Henüz ülke eklenmemiş.</div>}
                            </div>
                            <div className="p-3 border-t border-slate-100">
                                <button 
                                    onClick={handleCreateNewCountry}
                                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Ülke Ekle
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
                                            <label className="text-xs font-bold text-slate-500 uppercase">Nüfus</label>
                                            <input value={countryForm.population || ''} onChange={(e) => updateCountryField('population', e.target.value)} className="w-full border p-2 rounded-lg text-sm" placeholder="Örn: 83 Milyon" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Öne Çıkan Sektörler</label>
                                            <input value={countryForm.popularSectors || ''} onChange={(e) => updateCountryField('popularSectors', e.target.value)} className="w-full border p-2 rounded-lg text-sm" placeholder="Örn: Teknoloji, Finans" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <MapPin className="w-4 h-4" /> Capital
                                            </div>
                                            <p className="text-lg font-semibold text-slate-800">{dataToShow.capital || '-'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <Banknote className="w-4 h-4" /> Currency
                                            </div>
                                            <p className="text-lg font-semibold text-slate-800">{dataToShow.currency || '-'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <Globe className="w-4 h-4" /> Nüfus
                                            </div>
                                            <p className="text-lg font-semibold text-slate-800">{dataToShow.population || '-'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-2">
                                                <BriefcaseIcon className="w-4 h-4" /> Sektörler
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800">{dataToShow.popularSectors || '-'}</p>
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
                                                        {/* Duration */}
                                                        <div className="md:col-span-1">
                                                            {isEditingCountry ? (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Eğitim Süresi</label>
                                                                    <input 
                                                                        type="text"
                                                                        value={type.duration || ''}
                                                                        onChange={(e) => updateEducationType('bachelor', index, 'duration', e.target.value)}
                                                                        className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-2 focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                                                        placeholder="Örn: 3 Yıl, 4 Yıl"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <h5 className="font-bold text-slate-800 text-lg">{type.duration || '-'}</h5>
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

                                            <div className="space-y-4 mt-4">
                                                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <FileText className="w-4 h-4 text-slate-400" />
                                                        <span className="font-bold text-sm text-slate-700">YKS Şartları (Türkiye)</span>
                                                    </div>
                                                    {isEditingCountry ? (
                                                        <textarea rows={2} value={countryForm.yksRequirement || ''} onChange={e => updateCountryField('yksRequirement', e.target.value)} className="w-full text-sm border p-2 rounded" />
                                                    ) : (
                                                        <p className="text-sm text-slate-600">{dataToShow.yksRequirement || '-'}</p>
                                                    )}
                                                </div>

                                                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <FileText className="w-4 h-4 text-slate-400" />
                                                        <span className="font-bold text-sm text-slate-700">Genel Başvuru Kriterleri</span>
                                                    </div>
                                                    {isEditingCountry ? (
                                                        <textarea rows={2} value={countryForm.generalApplicationRequirements || ''} onChange={e => updateCountryField('generalApplicationRequirements', e.target.value)} className="w-full text-sm border p-2 rounded" placeholder="Örn: Yüksek lise ortalaması, niyet mektubu" />
                                                    ) : (
                                                        <p className="text-sm text-slate-600">{dataToShow.generalApplicationRequirements || '-'}</p>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <FileText className="w-4 h-4 text-slate-400" />
                                                            <span className="font-bold text-sm text-slate-700">Sınav ve Belge Şartları (IB, AP, SAT vb.)</span>
                                                        </div>
                                                        {isEditingCountry ? (
                                                            <textarea rows={2} value={countryForm.examRequirements || ''} onChange={e => updateCountryField('examRequirements', e.target.value)} className="w-full text-sm border p-2 rounded" placeholder="Örn: AP veya IB diploması istenebilir" />
                                                        ) : (
                                                            <p className="text-sm text-slate-600">{dataToShow.examRequirements || '-'}</p>
                                                        )}
                                                    </div>

                                                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <FileText className="w-4 h-4 text-slate-400" />
                                                            <span className="font-bold text-sm text-slate-700">Foundation (Hazırlık) Programları</span>
                                                        </div>
                                                        {isEditingCountry ? (
                                                            <textarea rows={2} value={countryForm.foundationRequirements || ''} onChange={e => updateCountryField('foundationRequirements', e.target.value)} className="w-full text-sm border p-2 rounded" placeholder="Örn: Türk lise diplomaları için 1 yıl zorunlu" />
                                                        ) : (
                                                            <p className="text-sm text-slate-600">{dataToShow.foundationRequirements || '-'}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
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
                                                        {/* Duration */}
                                                        <div className="md:col-span-1">
                                                            {isEditingCountry ? (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Eğitim Süresi</label>
                                                                    <input 
                                                                        type="text"
                                                                        value={type.duration || ''}
                                                                        onChange={(e) => updateEducationType('master', index, 'duration', e.target.value)}
                                                                        className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-2 focus:ring-2 focus:ring-purple-500/20 text-sm"
                                                                        placeholder="Örn: 1 Yıl, 2 Yıl"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <h5 className="font-bold text-slate-800 text-lg">{type.duration || '-'}</h5>
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

                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm md:col-span-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BriefcaseIcon className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold text-sm text-slate-700">Öğrenciyken Çalışma İzni</span>
                                            </div>
                                            {isEditingCountry ? (
                                                <textarea rows={3} value={countryForm.studentWorkPermit} onChange={e => updateCountryField('studentWorkPermit', e.target.value)} className="w-full text-sm border p-2 rounded" />
                                            ) : (
                                                <p className="text-sm text-slate-600">{dataToShow.studentWorkPermit || '-'}</p>
                                            )}
                                        </div>

                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm md:col-span-2">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-4 h-4 text-slate-400" />
                                                    <span className="font-bold text-sm text-slate-700">Vize Tipleri (Visa Types)</span>
                                                </div>
                                                {isEditingCountry && (
                                                    <button 
                                                        onClick={addVisaType}
                                                        className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" /> Vize Tipi Ekle
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                {(dataToShow.visaTypes || []).length === 0 && (
                                                    <p className="text-xs text-slate-400 italic py-2 text-center border border-dashed border-slate-100 rounded-lg">Henüz vize tipi tanımlanmamış.</p>
                                                )}
                                                {(dataToShow.visaTypes || []).map((vt, idx) => (
                                                    <div key={vt.id || idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl relative group">
                                                        {isEditingCountry && (
                                                            <button 
                                                                onClick={() => removeVisaType(vt.id)}
                                                                className="absolute -top-2 -right-2 p-1 bg-white text-rose-500 border border-rose-100 rounded-full hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                                            <div className="md:col-span-1 flex items-center justify-center">
                                                                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center">
                                                                    {idx + 1}
                                                                </span>
                                                            </div>
                                                            <div className="md:col-span-4">
                                                                {isEditingCountry ? (
                                                                    <input 
                                                                        value={vt.name} 
                                                                        onChange={(e) => updateVisaType(vt.id, 'name', e.target.value)}
                                                                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1.5"
                                                                        placeholder="Vize Adı (Örn: F-1)"
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-slate-800">{vt.name}</span>
                                                                )}
                                                            </div>
                                                            <div className="md:col-span-7">
                                                                {isEditingCountry ? (
                                                                    <input 
                                                                        value={vt.description} 
                                                                        onChange={(e) => updateVisaType(vt.id, 'description', e.target.value)}
                                                                        className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5"
                                                                        placeholder="Açıklama"
                                                                    />
                                                                ) : (
                                                                    <span className="text-xs text-slate-500">{vt.description || '-'}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
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
                                                } catch (error: any) {
                                                    console.error('Failed to delete university type', error);
                                                    alert('Silme işlemi başarısız oldu: ' + (error?.message || JSON.stringify(error)));
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

    const handleExportUniversityPrograms = () => {
        try {
            const exportData = universityPrograms.map(prog => ({
                'ID': prog.id.startsWith('new-') ? '' : prog.id,
                'Üniversite': prog.universityName,
                'Bölüm Adı': prog.name,
                'Bölüm Linki': prog.url,
                'Ana Bölüm 1': prog.mainCategoryName,
                'Alt Başlık 1': prog.mainDegreeName,
                'Ana Bölüm 2': prog.mainCategory2Name,
                'Alt Başlık 2': prog.mainDegree2Name,
                'Ana Bölüm 3': prog.mainCategory3Name,
                'Alt Başlık 3': prog.mainDegree3Name,
                'Dil': prog.language,
                'Eğitim Bütçesi': prog.tuitionRange
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Üniversite Bölümleri");
            XLSX.writeFile(wb, `universite_bolumleri_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error("Excel export failed", error);
            alert("Export failed");
        }
    };

    const handleImportUniversityPrograms = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Excel'deki veriler sisteme yüklenecek. Devam edilsin mi?")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                let successCount = 0;
                for (const row of data) {
                    try {
                        const uniName = String(row['Üniversite'] || '');
                        const university = universities.find(u => u.name.toLowerCase() === uniName.toLowerCase());
                        if (!university) {
                            console.warn(`Üniversite bulunamadı: ${uniName}`);
                            continue;
                        }

                        const degName = String(row['Alt Başlık 1'] || row['Bölüm 1'] || row['Alt Başlık'] || '');
                        const degree = mainDegrees.find(d => d.name.toLowerCase() === degName.toLowerCase());

                        const deg2Name = String(row['Alt Başlık 2'] || row['Bölüm 2'] || '');
                        const degree2 = mainDegrees.find(d => d.name.toLowerCase() === deg2Name.toLowerCase());

                        const deg3Name = String(row['Alt Başlık 3'] || row['Bölüm 3'] || '');
                        const degree3 = mainDegrees.find(d => d.name.toLowerCase() === deg3Name.toLowerCase());

                        const dbPayload: any = {
                            id: row['ID'] || `new-${Date.now()}-${successCount}`,
                            universityId: university.id,
                            type: (row['Bölüm Türü'] === 'Master' || row['Tür'] === 'Master') ? 'Master' : 'Bachelor',
                            name: String(row['Bölüm Adı'] || ''),
                            url: String(row['Bölüm Linki'] || ''),
                            mainDegreeId: degree?.id || '',
                            mainDegree2Id: degree2?.id || '',
                            mainDegree3Id: degree3?.id || '',
                            language: String(row['Dil'] || ''),
                            tuitionRange: String(row['Eğitim Bütçesi'] || '')
                        };

                        await universityProgramService.upsert(dbPayload);
                        successCount++;
                    } catch (err) {
                        console.error("Row import failed", row, err);
                    }
                }

                alert(`${successCount} adet bölüm başarıyla yüklendi.`);
                loadUniversityPrograms();
            } catch (error) {
                console.error("Excel import failed", error);
                alert("Import failed");
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const renderUniversityProgramManager = () => {
        const filteredPrograms = universityPrograms.filter(prog => {
            if (!universityProgramSearchTerm) return true;
            const search = universityProgramSearchTerm.toLowerCase();
            return (
                prog.name?.toLowerCase().includes(search) ||
                prog.universityName?.toLowerCase().includes(search) ||
                prog.mainCategoryName?.toLowerCase().includes(search) ||
                prog.mainDegreeName?.toLowerCase().includes(search)
            );
        });

        return (
            <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Üniversite Bölümleri</h3>
                            <p className="text-sm text-slate-500 mt-1">Üniversite bazlı bölümleri, ana kategorileri ve bütçe bilgilerini yönetin.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportUniversityPrograms}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel İndir</span>
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportUniversityPrograms}
                                className="hidden"
                                id="uni-prog-excel-upload"
                            />
                            <label
                                htmlFor="uni-prog-excel-upload"
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-100 cursor-pointer transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                <span className="hidden sm:inline">Excel Yükle</span>
                            </label>
                        </div>
                        <button 
                            onClick={() => {
                                setUniversityProgramForm({
                                    id: '', universityId: '', type: 'Bachelor', name: '', url: '', 
                                    mainCategoryId: '', mainCategory2Id: '', mainCategory3Id: '',
                                    mainDegreeId: '', mainDegree2Id: '', mainDegree3Id: '',
                                    language: '', tuitionRange: ''
                                });
                                setSelectedProgramFilterCountry('');
                                setIsUniversityProgramModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Yeni Bölüm Ekle
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-extrabold border border-indigo-200">
                                {filteredPrograms.length} KAYIT
                            </span>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Bölüm veya üniversite ara..."
                                value={universityProgramSearchTerm}
                                onChange={(e) => setUniversityProgramSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none w-64"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Üniversite</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bölüm Adı</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bölüm Gruplandırma (Max 3)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dil & Bütçe</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingUniversityPrograms ? (
                                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
                                ) : filteredPrograms.length === 0 ? (
                                    <tr><td colSpan={5} className="py-20 text-center text-slate-500">Sonuç bulunamadı.</td></tr>
                                ) : filteredPrograms.map(prog => (
                                    <tr key={prog.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                    <Building className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <div className="text-sm font-bold text-slate-700">{prog.universityName}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-bold text-slate-800">{prog.name}</div>
                                                {prog.url && (
                                                    <a href={prog.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 mt-1">
                                                        <LinkIcon className="w-3 h-3" /> Linke Git
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {prog.mainDegreeId && (
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100 w-fit">
                                                        {mainDegrees.find(d => d.id === prog.mainDegreeId)?.name || prog.mainDegreeName || '-'}
                                                    </span>
                                                )}
                                                {prog.mainDegree2Id && (
                                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-bold border border-purple-100 w-fit">
                                                        {mainDegrees.find(d => d.id === prog.mainDegree2Id)?.name || '-'}
                                                    </span>
                                                )}
                                                {prog.mainDegree3Id && (
                                                    <span className="px-2 py-0.5 bg-pink-50 text-pink-600 rounded text-[10px] font-bold border border-pink-100 w-fit">
                                                        {mainDegrees.find(d => d.id === prog.mainDegree3Id)?.name || '-'}
                                                    </span>
                                                )}
                                                {!prog.mainDegreeId && !prog.mainDegree2Id && !prog.mainDegree3Id && (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-xs font-bold text-slate-700">{prog.language || '-'}</div>
                                                <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">
                                                    {prog.tuitionRange || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => {
                                                        // Try to find the university's primary country to pre-set the filter
                                                        const uni = universities.find(u => u.id === prog.universityId);
                                                        if (uni && uni.countries && uni.countries.length > 0) {
                                                            setSelectedProgramFilterCountry(uni.countries[0]);
                                                        }
                                                        setUniversityProgramForm({...prog});
                                                        setIsUniversityProgramModalOpen(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        if (window.confirm("Bu bölümü silmek istediğinizden emin misiniz?")) {
                                                            await universityProgramService.delete(prog.id);
                                                            await loadUniversityPrograms();
                                                        }
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderInstitutions = () => {
        return (
            <div className="space-y-6 animate-fade-in pb-20">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Building className="w-5 h-5 text-indigo-600" /> Kurumlar
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Şubeler ve kurum bilgilerini yönetin.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DefinitionCard
                            id="branches"
                            title="Şubeler"
                            icon={MapPin}
                            count={branches.length}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                            onClick={(id: string) => setSelectedDefinitionType(id)}
                        />
                        <DefinitionCard
                            id="shared_institutions"
                            title="Paylaşımlı Kurumlar"
                            icon={Building}
                            count={sharedInstitutions.length || 0}
                            color="text-amber-600"
                            bg="bg-amber-50"
                            onClick={(id: string) => setSelectedDefinitionType(id)}
                        />
                    </div>
                </div>

                {selectedDefinitionType === 'branches' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSelectedDefinitionType(null)}
                                    className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <h3 className="text-lg font-bold text-slate-800">Şubeler</h3>
                            </div>
                            <button 
                                onClick={() => setIsBranchModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" />
                                Yeni Şube
                            </button>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                     <th className="px-6 py-4 font-semibold">Şube Adı</th>
                                     <th className="px-6 py-4 font-semibold">CRM Öğrencileri</th>
                                     <th className="px-6 py-4 font-semibold">Şehir</th>
                                     <th className="px-6 py-4 font-semibold">Adres</th>
                                     <th className="px-6 py-4 font-semibold">Telefon</th>
                                    <th className="px-6 py-4 font-semibold">E-posta</th>
                                    <th className="px-6 py-4 font-semibold">Durum</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                 {branches.map(branch => {
                                     const branchStudents = getBranchCrmStudents(branch);

                                     return (
                                         <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors">
                                             <td className="px-6 py-4 font-bold text-slate-800">{branch.name}</td>
                                             <td className="px-6 py-4">
                                                 <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                                                     {isLoadingCrmStudents ? 'Yükleniyor...' : `${branchStudents.length} öğrenci`}
                                                 </div>
                                                 <div className="mt-2 max-w-[260px] space-y-1">
                                                     {!isLoadingCrmStudents && branchStudents.length === 0 && (
                                                         <span className="text-xs text-slate-400">CRM kaydı yok</span>
                                                     )}
                                                     {branchStudents.slice(0, 5).map(student => (
                                                         <div key={student.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs">
                                                             <span className="truncate font-semibold text-slate-700">
                                                                 {student.firstName} {student.lastName}
                                                             </span>
                                                             <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${student.pipelineStage === 'Not Interested' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                 {student.pipelineStage === 'Not Interested' ? 'Pasif' : student.pipelineStage}
                                                             </span>
                                                         </div>
                                                     ))}
                                                     {branchStudents.length > 5 && (
                                                         <div className="text-xs font-semibold text-slate-400">+{branchStudents.length - 5} öğrenci daha</div>
                                                     )}
                                                 </div>
                                             </td>
                                             <td className="px-6 py-4 text-sm text-slate-600">{branch.city}</td>
                                             <td className="px-6 py-4 text-sm text-slate-600">{branch.address}</td>
                                             <td className="px-6 py-4 text-sm text-slate-600">{branch.phone}</td>
                                             <td className="px-6 py-4 text-sm text-slate-600">{branch.email}</td>
                                             <td className="px-6 py-4">
                                                 <button
                                                     type="button"
                                                     onClick={() => toggleBranchStatus(branch.id)}
                                                     className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                                                         branch.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'
                                                     }`}
                                                     aria-label={`${branch.name} durumunu değiştir`}
                                                 >
                                                     <span
                                                         className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                                             branch.status === 'active' ? 'translate-x-8' : 'translate-x-1'
                                                         }`}
                                                     />
                                                 </button>
                                                 <span className={`ml-2 text-xs font-semibold ${branch.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                     {branch.status === 'active' ? 'Aktif' : 'Pasif'}
                                                 </span>
                                             </td>
                                         </tr>
                                     );
                                 })}
                             </tbody>
                         </table>
                     </div>
                )}

                {selectedDefinitionType === 'shared_institutions' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSelectedDefinitionType(null)}
                                    className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <h3 className="text-lg font-bold text-slate-800">Paylaşımlı Kurumlar</h3>
                            </div>
                            <button 
                                onClick={() => setIsSharedInstitutionModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" />
                                Yeni Kurum Ekle
                            </button>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                    <th className="px-6 py-4 font-semibold">Kurum Adı</th>
                                    <th className="px-6 py-4 font-semibold">Telefon</th>
                                    <th className="px-6 py-4 font-semibold">E-posta</th>
                                    <th className="px-6 py-4 font-semibold">Yetkili Kişi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sharedInstitutions.map(inst => (
                                    <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{inst.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{inst.phone}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{inst.email}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{inst.authorizedPerson}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderSchoolNameManager = (type: SchoolNameType) => {
        const title = getSchoolNameTitle(type);
        const description = type === 'high_school'
            ? 'Türkiye lise okul isimlerini buradan ekleyip yönetin.'
            : 'Türkiye üniversite okul isimlerini buradan ekleyip yönetin.';
        const records = getSchoolNamesByType(type);
        const fileInputRef = getSchoolNameFileInputRef(type);

        return (
            <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedDefinitionType(null)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                            <p className="text-sm text-slate-500">{description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(event) => handleImportSchoolNames(type, event)}
                        />
                        <button
                            type="button"
                            onClick={() => handleExportSchoolNames(type)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                            <Download className="h-4 w-4" />
                            Excel İndir
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700"
                        >
                            <Upload className="h-4 w-4" />
                            Excel Yükle
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleAddSchoolName(type);
                        }}
                        className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row"
                    >
                        <input
                            value={schoolNameInput}
                            onChange={(event) => setSchoolNameInput(event.target.value)}
                            placeholder={`${title} okul adı ekle`}
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                        />
                        <button
                            type="submit"
                            disabled={!schoolNameInput.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                            <Plus className="h-4 w-4" />
                            Ekle
                        </button>
                    </form>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white border-b border-slate-200 text-xs text-slate-500 uppercase">
                                    <th className="px-6 py-4 font-semibold">Okul Adı</th>
                                    <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="p-10 text-center text-sm text-slate-400">Henüz okul adı eklenmedi.</td>
                                    </tr>
                                ) : records.map(record => (
                                    <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{record.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSchoolName(record.id)}
                                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                title="Sil"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderDataManager = () => {
        const stats = [
            { id: 'countries', name: 'Ülkeler', table: 'countries', icon: Globe, count: countries.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { id: 'universities', name: 'Üniversiteler', table: 'universities', icon: GraduationCap, count: universities.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { id: 'high_school_names', name: 'Türkiye Liseleri', table: 'school_names', icon: School, count: getSchoolNamesByType('high_school').length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { id: 'university_school_names', name: 'Türkiye Üniversiteleri', table: 'school_names', icon: Building, count: getSchoolNamesByType('university').length, color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { id: 'degrees', name: 'Bölümler', table: 'main_degrees', icon: BookOpen, count: mainDegrees.length, color: 'text-purple-600', bg: 'bg-purple-50' },
            { id: 'university_programs', name: 'Üniversite Bölümleri', table: 'university_programs', icon: BookOpen, count: universityPrograms.length, color: 'text-blue-600', bg: 'bg-blue-50' }
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
                                loadSchoolNames();
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
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Yönetmek için tıkla</span>
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
    const showSettingsBackButton = activeTab !== 'users' || !!selectedDefinitionType;

    const returnToSettingsHome = () => {
        setActiveTab('users');
        setSelectedDefinitionType(null);
        setSelectedCountryId(null);
        setUniversitySearchTerm('');
        setExpandedUniversityId(null);
    };

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

                <div className="relative z-10 flex items-start gap-4">
                    {showSettingsBackButton && (
                        <button
                            type="button"
                            onClick={returnToSettingsHome}
                            className="mt-1 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
                            aria-label="System Settings ana sayfasına dön"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                            System Settings
                        </h1>
                        <p className="text-purple-300/70 mt-1 text-sm">Kullanıcıları, rolleri ve genel tanımlamaları buradan yönetebilirsiniz.</p>
                    </div>
                </div>
            </motion.div>

            {/* Show Tabs only if not in sub-view */}
            {!selectedDefinitionType && (
                <>
                    <div className="flex gap-6 border-b border-slate-200">
                        {[
                            { id: 'users', label: 'Kullanıcı Yönetimi', icon: Users },
                            { id: 'institutions', label: 'Kurumlar', icon: Building },
                            { id: 'definitions', label: 'Sistem Tanımları', icon: Building },
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

            {activeTab === 'institutions' && renderInstitutions()}

            {activeTab === 'definitions' && (
                <>
                    {/* Grid View (Main Menu) */}
                    {!selectedDefinitionType && (
                        <div className="space-y-6 animate-fade-in pb-20">
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                            <Building className="w-5 h-5 text-indigo-600" /> Sistem Tanımları
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1">Sistem üzerinde kullanılan programlar, kurumlar ve bütçe aralıkları gibi temel tanımları yönetin.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <DefinitionCard 
                                        id="interested_programs"
                                        title="Program Tanımları" 
                                        icon={Briefcase} 
                                        count={interestedPrograms.length || 0} 
                                        color="text-indigo-600"
                                        bg="bg-indigo-50"
                                        onClick={(id: string) => setSelectedDefinitionType(id)}
                                    />
                                    <DefinitionCard 
                                        id="profile_boxes"
                                        title="Profil Kutuları" 
                                        icon={ClipboardList} 
                                        count={profileBoxes.length || 0} 
                                        color="text-cyan-600"
                                        bg="bg-cyan-50"
                                        onClick={(id: string) => setSelectedDefinitionType(id)}
                                    />
                                    <DefinitionCard 
                                        id="budget"
                                        title="Eğitim Bütçesi" 
                                        icon={Banknote} 
                                        count={budgetRangesList.length || 0} 
                                        color="text-amber-600"
                                        bg="bg-amber-50"
                                        onClick={(id: string) => setSelectedDefinitionType(id)}
                                    />
                                    <DefinitionCard 
                                        id="university_types"
                                        title="Üniversite Tipleri" 
                                        icon={GraduationCap} 
                                        count={universityTypesList.length || 0} 
                                        color="text-purple-600"
                                        bg="bg-purple-50"
                                        onClick={(id: string) => setSelectedDefinitionType(id)}
                                    />
                                    <DefinitionCard 
                                        id="docs"
                                        title="Evrak Türleri" 
                                        icon={FileText}
                                        count={documentTypes.length || 0}
                                        color="text-rose-600"
                                        bg="bg-rose-50"
                                        onClick={(id: string) => setSelectedDefinitionType(id)}
                                    />
                                    <DefinitionCard 
                                        id="department_keyword_rules"
                                        title="Bölüm Eşleşme Kuralları" 
                                        icon={Key} 
                                        count={0} 
                                        color="text-teal-600"
                                        bg="bg-teal-50"
                                        onClick={() => onDepartmentKeywordRulesOpen?.()}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sub Views for Definitions Tab */}
                    {selectedDefinitionType === 'interested_programs' && renderInterestedProgramManager()}
                    {selectedDefinitionType === 'profile_boxes' && renderProfileBoxManager()}
                    {selectedDefinitionType === 'shared_institutions' && renderSharedInstitutionManager()}
                    {selectedDefinitionType === 'budget' && renderBudgetManager()}
                    {selectedDefinitionType === 'university_types' && renderUniversityTypesManager()}
                    {selectedDefinitionType === 'docs' && renderDocumentTypeManager()}
                </>
            )}

            {activeTab === 'data' && (
                <>
                    {!selectedDefinitionType && renderDataManager()}
                    {selectedDefinitionType === 'countries' && renderCountryManager()}
                    {selectedDefinitionType === 'universities' && renderUniversityManager()}
                    {selectedDefinitionType === 'degrees' && renderMainDegreeManager()}
                    {selectedDefinitionType === 'university_programs' && renderUniversityProgramManager()}
                    {selectedDefinitionType === 'all_programs' && renderAllProgramsManager()}
                    {selectedDefinitionType === 'high_school_names' && renderSchoolNameManager('high_school')}
                    {selectedDefinitionType === 'university_school_names' && renderSchoolNameManager('university')}
                </>
            )}

            {/* University Program Modal */}
            {isUniversityProgramModalOpen && (
                <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-start justify-start z-[9999] p-4 pt-[100px] pl-[75px] overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {universityProgramForm.id ? 'Bölüm Düzenle' : 'Yeni Bölüm Ekle'}
                            </h3>
                            <button onClick={() => setIsUniversityProgramModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                const saved = await universityProgramService.upsert(universityProgramForm);
                                await loadUniversityPrograms();
                                setIsUniversityProgramModalOpen(false);
                            } catch (error) {
                                console.error("University Program Save Error:", error);
                                alert("Kaydetme sırasında hata oluştu.");
                            }
                        }} className="p-6 space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ülke Filtresi</label>
                                    <select 
                                        value={selectedProgramFilterCountry} 
                                        onChange={e => setSelectedProgramFilterCountry(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm bg-slate-50"
                                    >
                                        <option value="">Tüm Ülkeler</option>
                                        {countries.map(c => <option key={c.id} value={c.name}>{c.flag} {c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Üniversite Seçimi</label>
                                    <select 
                                        required
                                        value={universityProgramForm.universityId} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, universityId: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm"
                                    >
                                        <option value="">Üniversite Seçiniz</option>
                                        {universities
                                            .filter(uni => !selectedProgramFilterCountry || uni.countries?.includes(selectedProgramFilterCountry))
                                            .map(uni => <option key={uni.id} value={uni.id}>{uni.name}</option>)
                                        }
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bölüm Türü</label>
                                    <select 
                                        value={universityProgramForm.type} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, type: e.target.value as 'Bachelor' | 'Master'})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm bg-slate-50"
                                    >
                                        <option value="Bachelor">Bachelor (Lisans)</option>
                                        <option value="Master">Master (Yüksek Lisans)</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bölüm Adı</label>
                                    <input 
                                        required
                                        value={universityProgramForm.name} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, name: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm" 
                                        placeholder="Örn: Computer Science"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bölüm Linki</label>
                                <input 
                                    value={universityProgramForm.url || ''} 
                                    onChange={e => setUniversityProgramForm({...universityProgramForm, url: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm" 
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bölüm Gruplandırma (Max 3)</label>
                                
                                {/* Slot 1 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <select 
                                        value={universityProgramForm.mainDegreeId || ''} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, mainDegreeId: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-xs bg-white col-span-2"
                                    >
                                        <option value="">1. Bölüm Seçin</option>
                                        {mainDegrees.map(deg => <option key={deg.id} value={deg.id}>{deg.name}</option>)}
                                    </select>
                                </div>

                                {/* Slot 2 */}
                                <div className="grid grid-cols-1 gap-3">
                                    <select 
                                        value={universityProgramForm.mainDegree2Id || ''} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, mainDegree2Id: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-xs bg-white"
                                    >
                                        <option value="">2. Bölüm (Opsiyonel)</option>
                                        {mainDegrees.map(deg => <option key={deg.id} value={deg.id}>{deg.name}</option>)}
                                    </select>
                                </div>

                                {/* Slot 3 */}
                                <div className="grid grid-cols-1 gap-3">
                                    <select 
                                        value={universityProgramForm.mainDegree3Id || ''} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, mainDegree3Id: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-xs bg-white"
                                    >
                                        <option value="">3. Bölüm (Opsiyonel)</option>
                                        {mainDegrees.map(deg => <option key={deg.id} value={deg.id}>{deg.name}</option>)
                                        }
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dil</label>
                                    <select 
                                        value={universityProgramForm.language || ''} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, language: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm"
                                    >
                                        <option value="">Seçiniz</option>
                                        <option value="İngilizce">İngilizce</option>
                                        <option value="Almanca">Almanca</option>
                                        <option value="Fransızca">Fransızca</option>
                                        <option value="İspanyolca">İspanyolca</option>
                                        <option value="İtalyanca">İtalyanca</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bütçe Aralığı</label>
                                    <select 
                                        value={universityProgramForm.tuitionRange || ''} 
                                        onChange={e => setUniversityProgramForm({...universityProgramForm, tuitionRange: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm"
                                    >
                                        <option value="">Seçiniz</option>
                                        {budgetRangesList
                                            .filter(r => r.label !== 'Bütçe Konusunda Kararsızım')
                                            .map(range => <option key={range.id} value={range.label}>{range.label}</option>)
                                        }
                                    </select>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsUniversityProgramModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Vazgeç</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm px-4 py-6">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl p-6 md:p-8 animate-fade-in">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">{editingUserId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</h2>
                                <p className="mt-1 text-sm text-slate-500">Kullanıcı bilgilerini, rolünü ve bağlı olduğu yöneticiyi belirleyin.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsUserModalOpen(false); resetUserForm(); }}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveUser} className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-indigo-600">Kullanıcı Bilgileri</h3>
                                <div className="mb-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                                    <img
                                        src={newUser.avatarUrl || DEFAULT_USER_AVATAR_URL}
                                        alt="Kullanıcı resmi"
                                        className="h-16 w-16 rounded-full border border-slate-200 bg-slate-100 object-cover"
                                    />
                                    <div className="flex-1">
                                        <label className="mb-2 block text-sm font-medium text-slate-700">Kullanıcı Resmi</label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                                <Upload className="h-4 w-4" />
                                                 Avatar Seç
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const reader = new FileReader();
                                                        reader.onload = () => setNewUser({...newUser, avatarUrl: String(reader.result)});
                                                        reader.readAsDataURL(file);
                                                    }}
                                                />
                                            </label>
                                            {newUser.avatarUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNewUser({...newUser, avatarUrl: ''})}
                                                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                                >
                                                    Kaldır
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                        <select
                                            required
                                            value={newUser.role || ''}
                                            onChange={e => {
                                                const role = e.target.value as UserRole;
                                                setNewUser({
                                                    ...newUser,
                                                    role,
                                                    branch_id: roleRequiresBranch(role) ? newUser.branch_id : '',
                                                    parent_user_id: ''
                                                });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        >
                                            <option value="">Rol Seçin</option>
                                            <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                                            <option value={UserRole.ADMIN}>Admin</option>
                                            <option value={UserRole.BRANCH_MANAGER}>Şube Müdürü</option>
                                            <option value={UserRole.CONSULTANT}>Danışman</option>
                                            <option value={UserRole.REPRESENTATIVE}>Temsilci</option>
                                            <option value={UserRole.STUDENT_REPRESENTATIVE}>Öğrenci Temsilcisi</option>
                                            <option value={UserRole.STUDENT}>Öğrenci</option>
                                        </select>
                                    </div>
                                    {newUser.role && roleRequiresBranch(newUser.role) && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Şube</label>
                                            <select
                                                required={roleRequiresBranch(newUser.role)}
                                                value={newUser.branch_id}
                                                onChange={e => setNewUser({ ...newUser, branch_id: e.target.value, parent_user_id: '' })}
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
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                    {!editingUserId && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Sisteme Giriş Şifresi</label>
                                            <input
                                                required
                                                minLength={6}
                                                type="password"
                                                value={newUserPassword}
                                                onChange={e => setNewUserPassword(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                placeholder="En az 6 karakter"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {newUser.role && getAllowedParentRoles(newUser.role).length > 0 && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Bağlı Olduğu Yönetici
                                    </label>
                                    <select
                                        required
                                        value={newUser.parent_user_id || ''}
                                        onChange={e => setNewUser({...newUser, parent_user_id: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    >
                                        <option value="">Yönetici Seçin</option>
                                        {availableParents.map(parent => (
                                            <option key={parent.id} value={parent.id}>
                                                {parent.full_name} ({parent.role})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {newUser.role === UserRole.ADMIN ? 'Admin kullanıcıları Super Admin altında çalışır.' :
                                         newUser.role === UserRole.BRANCH_MANAGER ? 'Şube Müdürleri Admin altında çalışır.' :
                                         newUser.role === UserRole.CONSULTANT ? 'Danışmanlar Şube Müdürüne bağlıdır.' :
                                         newUser.role === UserRole.REPRESENTATIVE ? 'Temsilciler aynı şubedeki Danışman veya Şube Müdürüne bağlıdır.' :
                                         newUser.role === UserRole.STUDENT_REPRESENTATIVE ? 'Öğrenci Temsilcileri yalnızca aynı şubedeki Danışmana bağlıdır.' :
                                         'Öğrenciler aynı şubedeki Danışman, Temsilci veya Öğrenci Temsilcisine bağlıdır.'}
                                    </p>
                                </div>
                            )}

                            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                                <button type="button" onClick={() => { setIsUserModalOpen(false); resetUserForm(); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">İptal</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">{editingUserId ? 'Kullanıcıyı Güncelle' : 'Kullanıcı Oluştur'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Branch Modal */}
            {isBranchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm px-4 py-6">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl p-6 md:p-8">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">Yeni Şube Ekle</h2>
                                <p className="mt-1 text-sm text-slate-500">Şube bilgilerini girerek listeye yeni kayıt ekleyin.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBranchModalOpen(false)}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddBranch} className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-indigo-600">Şube Bilgileri</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Şube Adı</label>
                                        <input
                                            required
                                            value={branchForm.name || ''}
                                            onChange={e => setBranchForm({...branchForm, name: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            placeholder="Örn: İstanbul Şubesi"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Şehir</label>
                                        <input
                                            required
                                            value={branchForm.city || ''}
                                            onChange={e => setBranchForm({...branchForm, city: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            placeholder="Örn: İstanbul"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                                        <textarea
                                            required
                                            value={branchForm.address || ''}
                                            onChange={e => setBranchForm({...branchForm, address: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[90px]"
                                            placeholder="Şube adresi"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                                        <input
                                            value={branchForm.phone || ''}
                                            onChange={e => setBranchForm({...branchForm, phone: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            placeholder="+90 ..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                                        <input
                                            type="email"
                                            value={branchForm.email || ''}
                                            onChange={e => setBranchForm({...branchForm, email: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            placeholder="sube@unic.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
                                        <select
                                            value={branchForm.status || 'active'}
                                            onChange={e => setBranchForm({...branchForm, status: e.target.value as 'active' | 'passive'})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        >
                                            <option value="active">Aktif</option>
                                            <option value="passive">Pasif</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                                <button type="button" onClick={() => setIsBranchModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">İptal</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Şube Oluştur</button>
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
                                        onChange={e => updateUniversityField('name', e.target.value)}
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
                                        onChange={e => updateUniversityField('rankingUrl', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://www.topuniversities.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Web Sitesi</label>
                                    <input 
                                        value={universityForm.websiteUrl} 
                                        onChange={e => updateUniversityField('websiteUrl', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Parser Profili</label>
                                    <select
                                        value={universityForm.parserProfile || 'auto'}
                                        onChange={e => setUniversityForm({ ...universityForm, parserProfile: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    >
                                        <option value="auto">Auto</option>
                                        <option value="generic">Generic</option>
                                        <option value="birmingham_course_index">Birmingham Course Index</option>
                                    </select>
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
            {isMainDegreeModalOpen && (
                 <div className="fixed top-0 left-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto animate-fade-in-only">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[calc(100vh-80px)] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {mainDegrees.find(d => d.id === mainDegreeForm.id) ? 'Alt Başlık Düzenle' : 'Yeni Alt Başlık Ekle'}
                            </h3>
                            <button onClick={() => setIsMainDegreeModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveMainDegree} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                                    <div className="mb-4">
                                        <h4 className="text-sm font-black uppercase tracking-widest text-indigo-700">Bölüm Eşleşme Keywordleri</h4>
                                        <p className="mt-1 text-xs text-slate-500">Program adında geçen kelimelere göre otomatik bölüm eşleşmesi yapılır.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Bölüm Adı</label>
                                            <input
                                                required
                                                value={departmentKeywordRuleForm.department_name}
                                                onChange={e => setDepartmentKeywordRuleForm({...departmentKeywordRuleForm, department_name: formatTitleCase(e.target.value)})}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                                placeholder="Örn: Bilgisayar Bilimleri"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Major Keywords</label>
                                            <input
                                                value={departmentKeywordRuleForm.major_keywords}
                                                onChange={e => setDepartmentKeywordRuleForm({...departmentKeywordRuleForm, major_keywords: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                                placeholder="computer, software, data"
                                            />
                                            <p className="mt-1 text-xs text-slate-400">Virgülle ayırarak girin.</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Zorunlu Eşleşme Kelimeleri</label>
                                            <input
                                                value={departmentKeywordRuleForm.required_match_keywords}
                                                onChange={e => setDepartmentKeywordRuleForm({...departmentKeywordRuleForm, required_match_keywords: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-rose-200 bg-white rounded-xl focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                                                placeholder="engineering, computer"
                                            />
                                            <p className="mt-1 text-xs font-semibold text-rose-500">Program isminde geçerse ilgili bölümle mutlaka eşleşir.</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Öncelik</label>
                                            <input
                                                type="number"
                                                value={departmentKeywordRuleForm.priority}
                                                onChange={e => setDepartmentKeywordRuleForm({...departmentKeywordRuleForm, priority: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            />
                                        </div>
                                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={departmentKeywordRuleForm.is_active}
                                                onChange={e => setDepartmentKeywordRuleForm({...departmentKeywordRuleForm, is_active: e.target.checked})}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            Aktif
                                        </label>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Notlar</label>
                                            <textarea
                                                rows={3}
                                                value={departmentKeywordRuleForm.rule_notes}
                                                onChange={e => setDepartmentKeywordRuleForm({...departmentKeywordRuleForm, rule_notes: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                                placeholder="Kural hakkında notlar..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Atanan Ana Gruplar kaldırıldı */}

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Bölüm Tanımı</label>
                                    <textarea 
                                        required
                                        rows={3}
                                        value={mainDegreeForm.description} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, description: formatTitleCase(e.target.value)})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="Bölüm hakkında genel bilgi..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Kariyer Fırsatları</label>
                                    <textarea 
                                        rows={4}
                                        value={mainDegreeForm.careerOpportunities} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, careerOpportunities: formatTitleCase(e.target.value)})}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                                        placeholder="Mezunlar hangi pozisyonlarda çalışabilir?"
                                    />
                                </div>



                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Türkiye'de Sektörün Durumu</label>
                                    <textarea 
                                        rows={3}
                                        value={mainDegreeForm.sectorStatusTR} 
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, sectorStatusTR: formatTitleCase(e.target.value)})}
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

            {/* Document Type Modal */}
            {isDocumentTypeModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm px-4 py-6">
                    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl animate-fade-in">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    {documentTypeForm.id ? 'Evrak Tanımını Düzenle' : 'Yeni Evrak Tanımı'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">Evrak bilgilerini ve izin verilen yükleme adedini belirleyin.</p>
                            </div>
                            <button type="button" onClick={() => setIsDocumentTypeModalOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveDocumentType} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Evrak Adı</label>
                                <input
                                    required
                                    autoFocus
                                    value={documentTypeForm.name}
                                    onChange={e => setDocumentTypeForm({ ...documentTypeForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                                    placeholder="Örn: Pasaport"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">İngilizce Adı</label>
                                <input
                                    required
                                    value={documentTypeForm.englishName}
                                    onChange={e => setDocumentTypeForm({ ...documentTypeForm, englishName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                                    placeholder="Örn: Passport"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Evrak Notu</label>
                                <textarea
                                    rows={3}
                                    value={documentTypeForm.note}
                                    onChange={e => setDocumentTypeForm({ ...documentTypeForm, note: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all resize-none"
                                    placeholder="Evrakla ilgili açıklama veya dikkat edilmesi gerekenler..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Dosya Türü</label>
                                <input
                                    required
                                    value={documentTypeForm.fileType}
                                    onChange={e => setDocumentTypeForm({ ...documentTypeForm, fileType: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                                    placeholder="Örn: PDF, JPG, PNG"
                                />
                            </div>
                            <fieldset>
                                <legend className="block text-sm font-bold text-slate-700 mb-3">Evrak Adedi</legend>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <label className={`cursor-pointer rounded-2xl border p-4 transition-all ${!documentTypeForm.allowMultiple ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input
                                            type="radio"
                                            name="documentQuantity"
                                            checked={!documentTypeForm.allowMultiple}
                                            onChange={() => setDocumentTypeForm({ ...documentTypeForm, allowMultiple: false })}
                                            className="sr-only"
                                        />
                                        <span className="block text-sm font-extrabold text-slate-800">TEK EVRAK</span>
                                        <span className="mt-1 block text-xs text-slate-500">Bu tür için yalnızca bir dosya yüklenir.</span>
                                    </label>
                                    <label className={`cursor-pointer rounded-2xl border p-4 transition-all ${documentTypeForm.allowMultiple ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input
                                            type="radio"
                                            name="documentQuantity"
                                            checked={documentTypeForm.allowMultiple}
                                            onChange={() => setDocumentTypeForm({ ...documentTypeForm, allowMultiple: true })}
                                            className="sr-only"
                                        />
                                        <span className="block text-sm font-extrabold text-slate-800">BİRDEN ÇOK EVRAK</span>
                                        <span className="mt-1 block text-xs text-slate-500">Aynı türde birden fazla dosya yüklenebilir.</span>
                                    </label>
                                </div>
                            </fieldset>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                                    <input
                                        type="checkbox"
                                        checked={documentTypeForm.isActive}
                                        onChange={event => setDocumentTypeForm({ ...documentTypeForm, isActive: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-rose-600"
                                    />
                                    <span className="text-sm font-bold text-slate-700">Aktif</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                                    <input
                                        type="checkbox"
                                        checked={documentTypeForm.isRequired}
                                        onChange={event => setDocumentTypeForm({ ...documentTypeForm, isRequired: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-rose-600"
                                    />
                                    <span className="text-sm font-bold text-slate-700">Zorunlu</span>
                                </label>
                                <label className="block rounded-xl border border-slate-200 p-3">
                                    <span className="text-xs font-bold text-slate-500">Sıra</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={documentTypeForm.sortOrder}
                                        onChange={event => setDocumentTypeForm({ ...documentTypeForm, sortOrder: Math.max(0, Number(event.target.value) || 0) })}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                    />
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                                <button type="button" onClick={() => setIsDocumentTypeModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Vazgeç</button>
                                <button type="submit" disabled={isSavingDocumentType} className="flex items-center gap-2 px-8 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-rose-500/20 transition-all">
                                    {isSavingDocumentType && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Shared Institution Form Modal (Kurumlar) */}
            {isSharedInstitutionModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm px-4 py-6">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl p-6 md:p-8 animate-fade-in">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {sharedInstitutions.find(p => p.id === sharedInstitutionForm.id) ? 'Kurum Düzenle' : 'Yeni Kurum Ekle'}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">Paylaşımlı kurum iletişim ve yetkili bilgilerini yönetin.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSharedInstitutionModalOpen(false)}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSharedInstitution} className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-indigo-600">Kurum Bilgileri</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Kurum Adı</label>
                                        <input 
                                            required
                                            value={sharedInstitutionForm.name} 
                                            onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, name: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                            placeholder="Örn: X Danışmanlık A.Ş."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Yetkili</label>
                                        <input 
                                            value={sharedInstitutionForm.authorizedPerson || ''} 
                                            onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, authorizedPerson: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                            placeholder="Örn: Ahmet Bey"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                                        <input 
                                            value={sharedInstitutionForm.phone || ''} 
                                            onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, phone: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                            placeholder="05xx..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                                        <input 
                                            type="email"
                                            value={sharedInstitutionForm.email || ''} 
                                            onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, email: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                            placeholder="kurum@mail.com"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Not</label>
                                        <textarea 
                                            rows={3}
                                            value={sharedInstitutionForm.notes || ''} 
                                            onChange={e => setSharedInstitutionForm({...sharedInstitutionForm, notes: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                            placeholder="Kurum hakkında notlar..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                                <button type="button" onClick={() => setIsSharedInstitutionModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Vazgeç</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Kaydet</button>
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
