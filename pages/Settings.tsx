
import React, { useState, useEffect } from 'react';
import { SystemUser, UserRole, CountryData, EducationType, UniversityData } from '../types';
import { MOCK_USERS, MOCK_COUNTRIES, MOCK_UNIVERSITIES } from '../services/mockData';
import { countryService } from '../services/countryService';
import { universityService } from '../services/universityService';
import { systemService } from '../services/systemService';
import { 
    Settings as SettingsIcon, Users, Building, GraduationCap, 
    Shield, CheckCircle, XCircle, Plus, MoreVertical, Edit2, Trash2, 
    Briefcase, Globe, MapPin, Banknote, Users2, ArrowLeft, BookOpen,
    Calendar, FileText, Star, Briefcase as BriefcaseIcon, Clock, Loader2,
    Link as LinkIcon, ExternalLink
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
                <p className="text-sm text-slate-500">{count} records defined</p>
            </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100">
            <MoreVertical className="w-4 h-4" />
        </div>
    </div>
);

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'definitions' | 'career'>('users');
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
        country: '',
        city: '',
        websiteUrl: '',
        departmentsUrl: '',
        tuitionRange: ''
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
            // We also need countries loaded to populate the dropdown in the Add University modal
            loadCountries(); 
            loadTuitionRanges();
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
            country: '',
            city: '',
            websiteUrl: '',
            departmentsUrl: '',
            tuitionRange: ''
        });
        setIsUniversityModalOpen(true);
    };

    const handleEditUniversity = (uni: UniversityData) => {
        setUniversityForm(uni);
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
                                <th className="px-6 py-4 font-semibold">Location</th>
                                <th className="px-6 py-4 font-semibold">Links</th>
                                <th className="px-6 py-4 font-semibold">Tuition Range</th>
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
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                                    {uni.logo ? (
                                                        <img src={uni.logo} alt="" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <GraduationCap className="w-6 h-6 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-800">{uni.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">{uni.city}</span>
                                                <span className="text-xs text-slate-500">{uni.country}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {uni.websiteUrl && (
                                                    <a href={uni.websiteUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 hover:text-indigo-600 transition-colors" title="Official Website">
                                                        <Globe className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {uni.departmentsUrl && (
                                                    <a href={uni.departmentsUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 hover:text-indigo-600 transition-colors" title="Departments / Programs">
                                                        <BookOpen className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                                {uni.tuitionRange || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleEditUniversity(uni)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteUniversity(uni.id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
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
                                                placeholder="Country Name"
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
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleSaveCountry}
                                            disabled={isSavingCountry}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-bold shadow-lg transition-colors flex items-center gap-2 disabled:opacity-70"
                                        >
                                            {isSavingCountry ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />} 
                                            Save
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
                                        <Building className="w-5 h-5 text-slate-500" /> Major Cities
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
                                        <BookOpen className="w-5 h-5 text-slate-500" /> General Education System Note
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

    const availableParents = getAvailableParents(newUser.role);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 h-full">
            {/* Show Header only if not in sub-view */}
            {!selectedDefinitionType && (
                <>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">System Settings</h2>
                        <p className="text-slate-500">Manage users, roles, and global configurations.</p>
                    </div>

                    <div className="flex gap-6 border-b border-slate-200">
                        {[
                            { id: 'users', label: 'User Management', icon: Users },
                            { id: 'definitions', label: 'System Definitions', icon: Building },
                            { id: 'career', label: 'Career Module', icon: Briefcase },
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
                                id="countries"
                                title="Countries" 
                                icon={Globe} 
                                count={countries.length || 0} 
                                onClick={(id: string) => setSelectedDefinitionType(id)} 
                            />
                            <DefinitionCard 
                                id="universities"
                                title="Universities" 
                                icon={GraduationCap} 
                                count={universities.length || 0} 
                                onClick={(id: string) => setSelectedDefinitionType(id)}
                            />
                            <DefinitionCard 
                                id="programs"
                                title="Programs / Majors" 
                                icon={Building} 
                                count={350} 
                                onClick={(id: string) => alert('Program module coming soon')}
                            />
                            <DefinitionCard 
                                id="docs"
                                title="Document Types" 
                                icon={Shield} 
                                count={18} 
                                onClick={(id: string) => alert('Document module coming soon')}
                            />
                        </div>
                    )}

                    {/* Sub Views */}
                    {selectedDefinitionType === 'countries' && renderCountryManager()}
                    {selectedDefinitionType === 'universities' && renderUniversityManager()}
                </>
            )}

            {activeTab === 'career' && !selectedDefinitionType && (
                 <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center animate-fade-in">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Career Module Settings</h3>
                    <p className="text-slate-500 mb-6">Configure BigFive and Holland test parameters here.</p>
                    <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium">
                        Configure Parameters
                    </button>
                 </div>
            )}

            {/* Add User Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Add New User</h3>
                            <button onClick={() => setIsUserModalOpen(false)}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                    <input 
                                        required
                                        value={newUser.firstName} 
                                        onChange={e => setNewUser({...newUser, firstName: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                    <input 
                                        required
                                        value={newUser.lastName} 
                                        onChange={e => setNewUser({...newUser, lastName: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input 
                                    required
                                    type="email"
                                    value={newUser.email} 
                                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
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
                 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                                    <select 
                                        required
                                        value={universityForm.country} 
                                        onChange={e => setUniversityForm({...universityForm, country: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    >
                                        <option value="">Select Country</option>
                                        {countries.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                                    <input 
                                        required
                                        value={universityForm.city} 
                                        onChange={e => setUniversityForm({...universityForm, city: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                        placeholder="Munich"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
                                <input 
                                    value={universityForm.logo} 
                                    onChange={e => setUniversityForm({...universityForm, logo: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tuition Range</label>
                                <select 
                                    value={universityForm.tuitionRange} 
                                    onChange={e => setUniversityForm({...universityForm, tuitionRange: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                >
                                    <option value="">Select Range</option>
                                    {tuitionRanges.map(range => (
                                        <option key={range} value={range}>{range}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsUniversityModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Save University</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
