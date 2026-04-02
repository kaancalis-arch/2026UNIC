import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    ArrowLeft, Globe, BookOpen, Star, ExternalLink, 
    MapPin, Edit2, Trash2, Plus, Save, X, GraduationCap,
    Link as LinkIcon, Loader2, Info, Upload, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UniversityData, UniversityProgram } from '../types';
import { universityService } from '../services/universityService';
import { mainDegreeService } from '../services/mainDegreeService';
import { universityTypeService, UniversityType } from '../services/universityTypeService';
import { MainDegreeData } from '../types';
import { formatTitleCase } from '../lib/utils';

interface UniversityDetailProps {
    university: UniversityData;
    onBack: () => void;
}

const UniversityDetail: React.FC<UniversityDetailProps> = ({ university, onBack }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedUniversity, setEditedUniversity] = useState<UniversityData>(university);
    const [mainDegrees, setMainDegrees] = useState<MainDegreeData[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [universityTypes, setUniversityTypes] = useState<UniversityType[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const exportProgramsToExcel = () => {
        if (!editedUniversity.programs || editedUniversity.programs.length === 0) {
            alert('Excel\'e aktarılacak bölüm bulunmuyor.');
            return;
        }
        const data = editedUniversity.programs.map(p => ({
            'Bölüm Adı': p.name || '',
            'Tür': p.type || '',
            'Puan Türü': p.groupNames?.join(', ') || '',
            'Link': p.link || '',
            'Ücret Aralığı': p.tuitionRange || '',
            'Kampüs': p.campusLocation || '',
            'Başvuru Kriterleri': p.applicationCriteria || '',
            'Dil Puanı': p.languageScore || '',
            'Notlar': p.notes || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bölümler');
        XLSX.writeFile(wb, `${editedUniversity.name}_Bölümler_${Date.now()}.xlsx`);
    };

    const importProgramsFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];
                const newPrograms: UniversityProgram[] = jsonData.map((row, idx) => ({
                    id: `prog-${Date.now()}-${idx}`,
                    type: row['Tür'] || 'Bachelor',
                    name: row['Bölüm Adı'] || '',
                    groupNames: row['Puan Türü'] ? row['Puan Türü'].split(',').map((s: string) => s.trim()) : [],
                    link: row['Link'] || '',
                    tuitionRange: row['Ücret Aralığı'] || '',
                    campusLocation: row['Kampüs'] || '',
                    applicationCriteria: row['Başvuru Kriterleri'] || '',
                    languageScore: row['Dil Puanı'] || '',
                    notes: row['Notlar'] || ''
                }));
                setEditedUniversity(prev => ({
                    ...prev,
                    programs: [...(prev.programs || []), ...newPrograms]
                }));
                alert(`${newPrograms.length} bölüm import edildi.`);
            } catch (error) {
                console.error('Excel import error', error);
                alert('Excel dosyası okunurken hata oluştu.');
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    React.useEffect(() => {
        loadMainDegrees();
        loadUniversityTypes();
    }, []);

    const loadMainDegrees = async () => {
        try {
            const degrees = await mainDegreeService.getAll();
            setMainDegrees(degrees);
        } catch (error) {
            console.error('Failed to load main degrees', error);
        }
    };

    const loadUniversityTypes = async () => {
        try {
            const types = await universityTypeService.getAll();
            setUniversityTypes(types);
        } catch (error) {
            console.error('Failed to load university types', error);
        }
    };

    const getTypeDescription = (typeName: string): string => {
        const type = universityTypes.find(t => t.name === typeName);
        return type?.description || '';
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await universityService.upsert(editedUniversity);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save university', error);
            alert('Kaydedilirken bir hata oluştu.');
        } finally {
            setIsSaving(false);
        }
    };

    const addProgram = () => {
        const newProgram: UniversityProgram = {
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
        setEditedUniversity(prev => ({
            ...prev,
            programs: [...(prev.programs || []), newProgram]
        }));
    };

    const updateProgram = (id: string, field: keyof UniversityProgram, value: any) => {
        setEditedUniversity(prev => ({
            ...prev,
            programs: (prev.programs || []).map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    const removeProgram = (id: string) => {
        setEditedUniversity(prev => ({
            ...prev,
            programs: (prev.programs || []).filter(p => p.id !== id)
        }));
    };

    const updateField = (field: keyof UniversityData, value: any) => {
        setEditedUniversity(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{university.name}</h1>
                        <p className="text-sm text-slate-500">Üniversite Detayları ve Bölüm Yönetimi</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <>
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Kaydet
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                            <Edit2 className="w-4 h-4" />
                            Düzenle
                        </button>
                    )}
                </div>
            </div>

            {/* University Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {university.logo ? (
                            <img src={university.logo} alt={university.name} className="w-full h-full object-contain" />
                        ) : (
                            <img 
                                src={`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(university.name)}&backgroundColor=f1f5f9`} 
                                alt="" 
                                className="w-full h-full object-cover opacity-60" 
                            />
                        )}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isEditing ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Üniversite Adı</label>
                                    <input 
                                        value={editedUniversity.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Logo URL</label>
                                    <input 
                                        value={editedUniversity.logo}
                                        onChange={(e) => updateField('logo', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Website</label>
                                    <input 
                                        value={editedUniversity.websiteUrl}
                                        onChange={(e) => updateField('websiteUrl', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Departments URL</label>
                                    <input 
                                        value={editedUniversity.departmentsUrl}
                                        onChange={(e) => updateField('departmentsUrl', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ranking URL</label>
                                    <input 
                                        value={editedUniversity.rankingUrl}
                                        onChange={(e) => updateField('rankingUrl', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ülkeler</label>
                                    <input 
                                        value={editedUniversity.countries?.join(', ') || ''}
                                        onChange={(e) => updateField('countries', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        placeholder="Ülke1, Ülke2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Üniversite Tipleri</label>
                                    <input 
                                        value={editedUniversity.universityTypes?.join(', ') || ''}
                                        onChange={(e) => updateField('universityTypes', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        placeholder="Ivy League, Russell Group"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Website</p>
                                        {university.websiteUrl ? (
                                            <a href={university.websiteUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                                                {university.websiteUrl}
                                            </a>
                                        ) : <span className="text-sm text-slate-400">-</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <BookOpen className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Departments</p>
                                        {university.departmentsUrl ? (
                                            <a href={university.departmentsUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                                                {university.departmentsUrl}
                                            </a>
                                        ) : <span className="text-sm text-slate-400">-</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Star className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Ranking</p>
                                        {university.rankingUrl ? (
                                            <a href={university.rankingUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                                                View Rankings
                                            </a>
                                        ) : <span className="text-sm text-slate-400">-</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Ülkeler</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(university.countries || []).map(c => (
                                                <span key={c} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <GraduationCap className="w-5 h-5 text-slate-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Üniversite Tipleri</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(university.universityTypes || []).map((type, idx) => (
                                                <div key={idx} className="group relative">
                                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium cursor-help">
                                                        {type}
                                                    </span>
                                                    {getTypeDescription(type) && (
                                                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
                                                            <div className="px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap">
                                                                {getTypeDescription(type)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {(university.universityTypes || []).length === 0 && (
                                                <span className="text-sm text-slate-400">-</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Programs Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-indigo-600" />
                        Bölümler ({editedUniversity.programs?.length || 0})
                    </h2>
                    <div className="flex items-center gap-2">
                        {(editedUniversity.programs && editedUniversity.programs.length > 0) && (
                            <button 
                                onClick={exportProgramsToExcel}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Excel İndir
                            </button>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx,.xls"
                            onChange={importProgramsFromExcel}
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            Excel Ekle
                        </button>
                        {isEditing && (
                            <button 
                                onClick={addProgram}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Bölüm Ekle
                            </button>
                        )}
                    </div>
                </div>

                {(editedUniversity.programs && editedUniversity.programs.length > 0) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {editedUniversity.programs.map((prog, index) => (
                            <div key={prog.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bölüm Adı</label>
                                            <input 
                                                value={prog.name}
                                                onChange={(e) => updateProgram(prog.id, 'name', formatTitleCase(e.target.value))}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-medium"
                                                placeholder="Bölüm adı"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tür</label>
                                            <div className="flex gap-1">
                                                {['Bachelor', 'Master'].map(t => (
                                                    <button 
                                                        key={t}
                                                        type="button"
                                                        onClick={() => updateProgram(prog.id, 'type', t)}
                                                        className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${prog.type === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bütçe</label>
                                            <input 
                                                value={prog.tuitionRange || ''}
                                                onChange={(e) => updateProgram(prog.id, 'tuitionRange', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                                                placeholder="örn: €0-5000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link</label>
                                            <input 
                                                value={prog.link || ''}
                                                onChange={(e) => updateProgram(prog.id, 'link', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                                                placeholder="Program linki"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Alt Başlıklar</label>
                                            <select 
                                                multiple
                                                value={prog.groupNames || []}
                                                onChange={(e) => {
                                                    const select = e.target as HTMLSelectElement;
                                                    const values = Array.from(select.selectedOptions, (option: HTMLOptionElement) => option.value);
                                                    updateProgram(prog.id, 'groupNames', values);
                                                }}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs min-h-[60px]"
                                            >
                                                {mainDegrees.map(deg => (
                                                    <option key={deg.id} value={deg.name}>{deg.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button 
                                            onClick={() => removeProgram(prog.id)}
                                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-rose-600 text-xs font-medium hover:bg-rose-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Sil
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-bold text-slate-800">{prog.name}</h3>
                                            {prog.link && (
                                                <a href={prog.link} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-indigo-600">
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${prog.type === 'Master' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {prog.type}
                                            </span>
                                            {prog.tuitionRange && (
                                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    {prog.tuitionRange}
                                                </span>
                                            )}
                                        </div>
                                        {prog.groupNames && prog.groupNames.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {prog.groupNames.map((gn: string) => (
                                                    <span key={gn} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-medium">
                                                        {gn}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm">Bu üniversite için henüz bölüm tanımlanmamış.</p>
                        {isEditing && (
                            <button 
                                onClick={addProgram}
                                className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
                            >
                                Bölüm eklemek için tıklayın
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniversityDetail;
