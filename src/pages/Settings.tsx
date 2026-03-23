
import React, { useState, useEffect } from 'react';
import { SystemUser, UserRole, CountryData, EducationType, UniversityData, MainDegreeData, MainCategoryData, InterestedProgramData } from '../types';
import { MOCK_USERS, MOCK_COUNTRIES, MOCK_UNIVERSITIES } from '../services/mockData';
import { countryService } from '../services/countryService';
import { universityService } from '../services/universityService';
import { mainDegreeService } from '../services/mainDegreeService';
import { mainCategoryService } from '../services/mainCategoryService';
import { interestedProgramService } from '../services/interestedProgramService';
import { systemService } from '../services/systemService';
import { 
    Settings as SettingsIcon, Users, Building, GraduationCap, 
    Shield, CheckCircle, XCircle, Plus, MoreVertical, Edit2, Trash2, 
    Briefcase, Globe, MapPin, Banknote, Users2, ArrowLeft, BookOpen,
    Calendar, FileText, Star, Briefcase as BriefcaseIcon, Clock, Loader2,
    Link as LinkIcon, ExternalLink, Cpu, Key, Save, X, Database, RefreshCw, Download
} from 'lucide-react';

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

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'definitions' | 'career' | 'data'>('users');
    const [users, setUsers] = useState<SystemUser[]>(MOCK_USERS);
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
        programs: []
    });

    // Main Degree / Category State
    const [mainDegrees, setMainDegrees] = useState<MainDegreeData[]>([]);
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
    
    // Tuition Ranges State
    const [tuitionRanges, setTuitionRanges] = useState<string[]>([]);

    // Country Edit/Create State
    const [isEditingCountry, setIsEditingCountry] = useState(false);
    const [countryForm, setCountryForm] = useState<CountryData>(MOCK_COUNTRIES[0]);
    const [isSavingCountry, setIsSavingCountry] = useState(false);

    // User Form State
    const [newUser, setNewUser] = useState<Partial<SystemUser>>({
        firstName: '',
        lastName: '',
        email: '',
        role: UserRole.CONSULTANT,
        isActive: true,
        parentId: ''
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
        } else if (selectedDefinitionType === 'degrees') {
            loadMainDegrees();
        } else if (selectedDefinitionType === 'interested_programs') {
            loadInterestedPrograms();
        } else if (selectedDefinitionType === 'all_programs') {
            loadUniversities();
            loadTuitionRanges();
            loadMainDegrees();
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

    const loadTuitionRanges = async () => {
        try {
            const ranges = await systemService.getTuitionRanges();
            setTuitionRanges(ranges);
        } catch (error) {
            console.error('Failed to load tuition ranges', error);
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

    // User Actions
    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        const createdUser: SystemUser = {
            id: `user-${Date.now()}`,
            firstName: newUser.firstName || '',
            lastName: newUser.lastName || '',
            email: newUser.email || '',
            role: newUser.role || UserRole.CONSULTANT,
            isActive: newUser.isActive || false,
            parentId: newUser.parentId,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.firstName}`
        };
        setUsers([...users, createdUser]);
        setIsUserModalOpen(false);
        setNewUser({
            firstName: '',
            lastName: '',
            email: '',
            role: UserRole.CONSULTANT,
            isActive: true,
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
            case UserRole.REPRESENTATIVE:
                return users.filter(u => u.role === UserRole.CONSULTANT);
            case UserRole.CONSULTANT:
                return users.filter(u => u.role === UserRole.ADMIN);
            case UserRole.STUDENT:
                return users.filter(u => u.role === UserRole.CONSULTANT || u.role === UserRole.REPRESENTATIVE);
            default:
                return [];
        }
    };

    // --- UNIVERSITY LOGIC ---
    const handleAddUniversity = () => {
        setUniversityForm({
            id: `uni-${Date.now()}`,
            name: '',
            logo: '',
            countries: [],
            rankingUrl: '',
            websiteUrl: '',
            departmentsUrl: '',
            programs: []
        });
        setIsUniversityModalOpen(true);
    };

    const handleEditUniversity = (uni: UniversityData) => {
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
                                                <p className="font-bold text-slate-800">{user.firstName} {user.lastName}</p>
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
                                                <span className="font-medium text-slate-700">{parent.firstName} {parent.lastName}</span>
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

    const renderUniversityManager = () => (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
             {/* Header */}
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedDefinitionType(null)}
                        className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">University Management</h3>
                        <p className="text-sm text-slate-500">Add, edit or remove partner universities.</p>
                    </div>
                </div>
                <button 
                    onClick={handleAddUniversity}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    New University
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                                <th className="px-6 py-4 font-semibold">University</th>
                                <th className="px-6 py-4 font-semibold">Countries</th>
                                <th className="px-6 py-4 font-semibold">Links & Ranking</th>
                                <th className="px-6 py-4 font-semibold">Programs</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingUniversities ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-500">Loading universities...</td>
                                </tr>
                            ) : universities.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-500">No universities found. Add one to get started.</td>
                                </tr>
                            ) : (
                                universities.map(uni => (
                                    <tr key={uni.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
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
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-3">
                                                    {uni.websiteUrl && <a href={uni.websiteUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Website"><Globe className="w-4 h-4" /></a>}
                                                    {uni.departmentsUrl && <a href={uni.departmentsUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Departments"><BookOpen className="w-4 h-4" /></a>}
                                                    {uni.rankingUrl && <a href={uni.rankingUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ranking"><Star className="w-4 h-4" /></a>}
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
                                                <button onClick={() => handleEditUniversity(uni)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteUniversity(uni.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
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
        const allProgs = universities.flatMap(u => (u.programs || []).map(p => ({ ...p, universityId: u.id, universityName: u.name })));

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
                                    <th className="px-6 py-4 font-semibold">Bölüm Adı</th>
                                    <th className="px-6 py-4 font-semibold">Üniversite</th>
                                    <th className="px-6 py-4 font-semibold">Tür</th>
                                    <th className="px-6 py-4 font-semibold">Bütçe</th>
                                    <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allProgs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-slate-500">Henüz hiç bölüm tanımlanmamış.</td>
                                    </tr>
                                ) : (
                                    allProgs.map(prog => (
                                        <tr key={prog.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="font-bold text-slate-800">{prog.name}</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(prog.groupNames || []).length > 0 ? (
                                                            prog.groupNames.map(gn => (
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
                                                <span className="text-sm text-slate-600 font-medium">{prog.universityName}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${prog.type === 'Master' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {prog.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">{prog.tuitionRange || 'N/A'}</span>
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
                                            onChange={(e) => setAllProgramForm({...allProgramForm, name: e.target.value})}
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

    const renderBudgetManager = () => {
        const budgetOptions = [
            "Bütçe Konusunda Kararsızım",
            "5.000'e kadar",
            "10.000'e kadar",
            "15.000'e kadar",
            "20.000'e kadar",
            "20.000 üzeri uygundur"
        ];

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

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-600" /> Mevcut Bütçe Seçenekleri
                        </h4>
                        <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all">
                             Yeni Seçenek Ekle
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {budgetOptions.map((opt, idx) => (
                            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                        {idx + 1}
                                    </div>
                                    <span className="font-medium text-slate-700">{opt}</span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-200">
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
            {/* Show Header only if not in sub-view */}
            {!selectedDefinitionType && (
                <>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sistem Ayarları</h2>
                        <p className="text-slate-500">Kullanıcıları, rolleri ve genel tanımlamaları buradan yönetebilirsiniz.</p>
                    </div>

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
                                id="budget"
                                title="Eğitim Bütçesi" 
                                icon={Banknote} 
                                count={6} 
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
                 <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Cpu className="w-32 h-32" />
                        </div>
                        
                        <div className="relative">
                            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-indigo-600" /> AI Servis Ayarları
                            </h3>
                            <p className="text-slate-500 mb-8 border-b border-slate-100 pb-4">
                                Platform genelinde kullanılan yapay zeka servislerinin API bağlantılarını buradan yönetebilirsiniz.
                            </p>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            Google Gemini API Key
                                        </label>
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Aktif Model: Gemini 2.5 Flash</span>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                            <Key className="w-4 h-4" />
                                        </div>
                                        <input 
                                            type="password"
                                            value={localStorage.getItem('gemini_api_key') || ''}
                                            onChange={(e) => {
                                                localStorage.setItem('gemini_api_key', e.target.value);
                                                // Trigger a re-render if needed or just rely on the next refresh/page change
                                            }}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-mono text-sm" 
                                            placeholder="AI analizleri için API anahtarınızı giriniz..."
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                        * API anahtarı yerel olarak (Local Storage) saklanır ve sadece AI analizleri tetiklendiğinde kullanılır.
                                    </p>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            alert('API Ayarları başarıyla güncellendi!');
                                            window.location.reload();
                                        }}
                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Değişiklikleri Kaydet
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900 text-sm mb-1">Güvenlik Notu</h4>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                API anahtarlarınızı kimseyle paylaşmayınız. Platform, analizlerinizi otomatize etmek için bu anahtarı kullanır. Gelecekte bu ayarlar merkezi bir "Secret Manager" üzerinden yönetilebilir olacaktır.
                            </p>
                        </div>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ad</label>
                                    <input 
                                        required
                                        value={newUser.firstName} 
                                        onChange={e => setNewUser({...newUser, firstName: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Soyad</label>
                                    <input 
                                        required
                                        value={newUser.lastName} 
                                        onChange={e => setNewUser({...newUser, lastName: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    />
                                </div>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select 
                                    value={newUser.role} 
                                    onChange={e => {
                                        const newRole = e.target.value as UserRole;
                                        setNewUser({
                                            ...newUser, 
                                            role: newRole, 
                                            parentId: '' // Reset parent when role changes to ensure validity
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                >
                                    <option value={UserRole.ADMIN}>Admin</option>
                                    <option value={UserRole.CONSULTANT}>Consultant</option>
                                    <option value={UserRole.REPRESENTATIVE}>Representative</option>
                                    <option value={UserRole.STUDENT}>Student</option>
                                </select>
                            </div>
                            
                            {/* Reports To Selection */}
                            {(newUser.role === UserRole.CONSULTANT || newUser.role === UserRole.REPRESENTATIVE || newUser.role === UserRole.STUDENT) && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Reports To (Manager)
                                    </label>
                                    <select 
                                        value={newUser.parentId || ''}
                                        onChange={e => setNewUser({...newUser, parentId: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    >
                                        <option value="">Select Manager</option>
                                        {availableParents.map(parent => (
                                            <option key={parent.id} value={parent.id}>
                                                {parent.firstName} {parent.lastName} ({parent.role})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {newUser.role === UserRole.REPRESENTATIVE ? 'Representatives must report to a Consultant.' : 
                                         newUser.role === UserRole.CONSULTANT ? 'Consultants must report to an Admin.' :
                                         'Students are assigned to a Consultant or Representative.'}
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
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100vh-160px)] overflow-y-auto mb-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">
                                {universityForm.id.startsWith('uni-') && !universities.find(u => u.id === universityForm.id) ? 'Add New University' : 'Edit University'}
                            </h3>
                            <button onClick={() => setIsUniversityModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveUniversity} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">University Name</label>
                                <input 
                                    required
                                    value={universityForm.name} 
                                    onChange={e => setUniversityForm({...universityForm, name: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    placeholder="e.g. Technical University of Munich"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Countries (Select Multiple)</label>
                                <select 
                                    multiple
                                    required
                                    value={universityForm.countries} 
                                    onChange={e => {
                                        const select = e.target as HTMLSelectElement;
                                        const values = Array.from(select.selectedOptions, (option: HTMLOptionElement) => option.value);
                                        setUniversityForm({...universityForm, countries: values});
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]" 
                                >
                                    {countries.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1 italic">Birden fazla seçim için Ctrl tuşuna basılı tutun.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Üniversite Logosu</label>
                                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden p-2 shadow-sm shrink-0">
                                        {universityForm.logo ? (
                                            <img src={universityForm.logo} alt="" className="w-full h-full object-contain" />
                                        ) : (
                                            <Building className="w-8 h-8 text-slate-300" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-500 mb-2">Önerilen: Kare, şeffaf arka planlı PNG.</p>
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    try {
                                                        const url = await universityService.uploadLogo(file);
                                                        setUniversityForm({...universityForm, logo: url});
                                                    } catch (err: any) {
                                                        alert("Logo yüklenirken bir hata oluştu: " + err.message);
                                                    }
                                                }
                                            }}
                                            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ranking Link</label>
                                    <input 
                                        value={universityForm.rankingUrl} 
                                        onChange={e => setUniversityForm({...universityForm, rankingUrl: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://www.topuniversities.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Website Link</label>
                                    <input 
                                        value={universityForm.websiteUrl} 
                                        onChange={e => setUniversityForm({...universityForm, websiteUrl: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Departments Link</label>
                                    <input 
                                        value={universityForm.departmentsUrl} 
                                        onChange={e => setUniversityForm({...universityForm, departmentsUrl: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="https://..."
                                    />
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
                                    onChange={e => setMainCategoryForm({...mainCategoryForm, name: e.target.value})}
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
                                        onChange={e => setMainDegreeForm({...mainDegreeForm, name: e.target.value})}
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
                                    onChange={e => setInterestedProgramForm({...interestedProgramForm, name: e.target.value})}
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

        </div>
    );
};

export default Settings;
