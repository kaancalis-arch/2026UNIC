
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    Search, Filter, Globe, GraduationCap, MapPin, 
    Share2, FileDown, CheckCircle2, Building, 
    ExternalLink, BookOpen, Star, Phone,
    Check, X, Loader2, ChevronRight, ClipboardCopy, Upload, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UniversityData, UniversityProgram, MainDegreeData, MainCategoryData } from '../types';
import { universityService } from '../services/universityService';
import { mainDegreeService } from '../services/mainDegreeService';
import { mainCategoryService } from '../services/mainCategoryService';
import { systemService, BudgetRange } from '../services/systemService';
import { jsPDF } from 'jspdf';
import { getCountryCode, getFlagEmoji } from '../utils/countryUtils';

const UniversitySearch: React.FC = () => {
    const [universities, setUniversities] = useState<UniversityData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mainDegrees, setMainDegrees] = useState<MainDegreeData[]>([]);
    const [mainCategories, setMainCategories] = useState<MainCategoryData[]>([]);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedDegree, setSelectedDegree] = useState<string>('');
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedBudget, setSelectedBudget] = useState<string>('');
    const [budgetRanges, setBudgetRanges] = useState<BudgetRange[]>([]);
    
    // Selection
    const [selectedUnis, setSelectedUnis] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [uniData, degreeData, cats, junctions, rawBudgets] = await Promise.all([
                universityService.getAll(),
                mainDegreeService.getAll(),
                mainCategoryService.getAll(),
                mainCategoryService.getJunctions(),
                systemService.getBudgetRangesRaw()
            ]);
            
            // Enrich degrees with category IDs
            const enrichedDegrees = degreeData.map(d => ({
                ...d,
                categoryIds: junctions.filter(j => j.program_id === d.id).map(j => j.category_id)
            }));

            setUniversities(uniData);
            setMainDegrees(enrichedDegrees as MainDegreeData[]);
            setMainCategories(cats);
            setBudgetRanges(rawBudgets);
        } catch (error) {
            console.error("Failed to load search data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const countries = Array.from(new Set(universities.flatMap(u => u.countries || []))).sort();

    const hasAnyFilter = searchTerm.trim() !== '' || 
                         selectedCategory !== '' ||
                         selectedDegree !== '' || 
                         selectedCountry !== '' || 
                         selectedType !== '' || 
                         selectedBudget !== '';

    // If no filter is active, we don't calculate results to be double-safe
    const filteredUniversities = !hasAnyFilter ? [] : universities.filter(uni => {
        const matchesSearch = uni.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCountry = !selectedCountry || (uni.countries || []).includes(selectedCountry);
        
        // Filter by Category/Degree
        let matchesDegree = true;
        if (selectedDegree) {
            matchesDegree = (uni.programs || []).some(prog => 
                prog.name.toLowerCase().includes(selectedDegree.toLowerCase()) || 
                (prog.groupNames || []).some(gn => gn.toLowerCase() === selectedDegree.toLowerCase())
            );
        } else if (selectedCategory) {
            // Filter by Category if no specific degree selected
            const degreesInCategory = mainDegrees
                .filter(d => (d.categoryIds || []).includes(selectedCategory))
                .map(d => d.name.toLowerCase());
            
            matchesDegree = (uni.programs || []).some(prog => 
                (prog.groupNames || []).some(gn => degreesInCategory.includes(gn.toLowerCase()))
            );
        }

        // More filters
        const matchesType = !selectedType || (uni.programs || []).some(prog => prog.type === selectedType);
        
        const matchesBudget = (() => {
            if (!selectedBudget) return true;
            
            const selectedObj = budgetRanges.find(b => b.label === selectedBudget);
            if (!selectedObj) return true; // Skip if invalid
            
            if (selectedObj.sort_order === 1) return true;
            
            return (uni.programs || []).some(prog => {
                const progBudgetObj = budgetRanges.find(b => b.label === prog.tuitionRange);
                if (!progBudgetObj) return false;
                
                if (selectedObj.sort_order >= 100) {
                    return progBudgetObj.sort_order === selectedObj.sort_order;
                }
                
                return progBudgetObj.sort_order <= selectedObj.sort_order;
            });
        })();
        
        return matchesSearch && matchesCountry && matchesDegree && matchesType && matchesBudget;
    });

    const toggleSelection = (id: string) => {
        setSelectedUnis(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const exportAllProgramsToExcel = () => {
        const allPrograms: any[] = [];
        universities.forEach(uni => {
            (uni.programs || []).forEach(prog => {
                allPrograms.push({
                    'Üniversite': uni.name,
                    'Ülke': uni.countries?.join(', ') || '',
                    'Bölüm Adı': prog.name || '',
                    'Tür': prog.type || '',
                    'Puan Türü': prog.groupNames?.join(', ') || '',
                    'Link': prog.link || '',
                    'Ücret Aralığı': prog.tuitionRange || '',
                    'Kampüs': prog.campusLocation || '',
                    'Başvuru Kriterleri': prog.applicationCriteria || '',
                    'Dil Puanı': prog.languageScore || '',
                    'Notlar': prog.notes || ''
                });
            });
        });
        if (allPrograms.length === 0) {
            alert('Excel\'e aktarılacak bölüm bulunmuyor.');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(allPrograms);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tüm Bölümler');
        XLSX.writeFile(wb, `UNIC_Tüm_Bölümler_${Date.now()}.xlsx`);
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
                let importedCount = 0;
                const updatedUniversities = universities.map(uni => {
                    const uniPrograms = jsonData.filter(row => row['Üniversite'] === uni.name);
                    if (uniPrograms.length > 0) {
                        importedCount += uniPrograms.length;
                        const newPrograms: UniversityProgram[] = uniPrograms.map((row, idx) => ({
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
                        return { ...uni, programs: [...(uni.programs || []), ...newPrograms] };
                    }
                    return uni;
                });
                setUniversities(updatedUniversities);
                alert(`${importedCount} bölüm import edildi.`);
            } catch (error) {
                console.error('Excel import error', error);
                alert('Excel dosyası okunurken hata oluştu.');
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportPDF = () => {
        if (selectedUnis.length === 0) {
            alert("Lütfen önce okul seçiniz.");
            return;
        }

        const doc = new jsPDF();
        const selectedData = universities.filter(u => selectedUnis.includes(u.id));

        doc.setFontSize(22);
        doc.setTextColor(63, 81, 181);
        doc.text("UNIC University Recommendations", 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Hazırlanma Tarihi: ${new Date().toLocaleDateString()}`, 20, 30);
        
        let y = 50;
        selectedData.forEach((uni, idx) => {
            if (y > 250) { doc.addPage(); y = 20; }
            
            doc.setFontSize(16);
            doc.setTextColor(33);
            doc.text(`${idx + 1}. ${uni.name}`, 20, y);
            y += 8;
            
            doc.setFontSize(10);
            doc.setTextColor(80);
            doc.text(`Ülke: ${uni.countries?.join(', ') || '-'}`, 25, y);
            y += 6;
            
            if (uni.websiteUrl) {
                doc.text(`Web: ${uni.websiteUrl}`, 25, y);
                y += 6;
            }

            if (uni.programs && uni.programs.length > 0) {
                doc.setFontSize(11);
                doc.setTextColor(50);
                doc.text("Available Programs:", 25, y);
                y += 6;
                doc.setFontSize(9);
                uni.programs.slice(0, 5).forEach(prog => {
                    doc.text(`- ${prog.name} (${prog.type}) - ${prog.tuitionRange || 'N/A'}`, 30, y);
                    y += 5;
                });
            }
            
            y += 10;
        });

        doc.save(`UNIC_University_List_${Date.now()}.pdf`);
    };

    const handleShareWhatsApp = () => {
        if (selectedUnis.length === 0) {
            alert("Lütfen önce okul seçiniz.");
            return;
        }

        const selectedData = universities.filter(u => selectedUnis.includes(u.id));
        let text = "*UNIC Üniversite Tavsiye Listesi*\n\n";
        
        selectedData.forEach((uni, idx) => {
            text += `${idx + 1}. *${uni.name}*\n`;
            text += `📍 Ülke: ${uni.countries?.join(', ') || '-'}\n`;
            if (uni.websiteUrl) text += `🌐 Website: ${uni.websiteUrl}\n`;
            
            if (uni.programs && uni.programs.length > 0) {
                text += `🎓 Programlar:\n`;
                uni.programs.slice(0, 3).forEach(p => {
                    text += `   • ${p.name} (${p.type})\n`;
                });
            }
            text += `\n`;
        });
        
        text += "Daha fazla bilgi için danışmanınızla iletişime geçebilirsiniz.";
        
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const handleCopyToClipboard = () => {
        if (selectedUnis.length === 0) return;
        
        const selectedData = universities.filter(u => selectedUnis.includes(u.id));
        let text = "*UNIC Üniversite Tavsiye Listesi*\n\n";
        
        selectedData.forEach((uni, idx) => {
            text += `${idx + 1}. *${uni.name}*\n`;
            text += `📍 Ülke: ${uni.countries?.join(', ') || '-'}\n`;
            if (uni.websiteUrl) text += `🌐 Website: ${uni.websiteUrl}\n`;
            if (uni.programs && uni.programs.length > 0) {
                text += `🎓 Programlar:\n`;
                uni.programs.slice(0, 3).forEach(p => {
                    text += `   • ${p.name} (${p.type})\n`;
                });
            }
            text += `\n`;
        });
        
        navigator.clipboard.writeText(text);
        alert("Metin panoya kopyalandı!");
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950 via-rose-900 to-slate-900 p-6 md:p-8"
            >
                {/* Background decorations */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                            University Search
                        </h1>
                        <p className="text-rose-300/70 mt-1 text-sm">Discover programs and partner universities worldwide.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedUnis.length > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                                <CheckCircle2 className="w-4 h-4 text-rose-400" />
                                <span className="text-sm font-semibold text-white">{selectedUnis.length}</span>
                                <span className="text-xs font-medium text-white/50">Üniversite Seçildi</span>
                            </div>
                        )}
                        <button 
                            onClick={exportAllProgramsToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                        >
                            <Download className="w-4 h-4" />
                            <span className="text-sm font-semibold">Excel İndir</span>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx,.xls"
                            onChange={importProgramsFromExcel}
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 cursor-pointer"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="text-sm font-semibold">Excel Ekle</span>
                        </button>
                        <button 
                            onClick={handleExportPDF}
                            disabled={selectedUnis.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <FileDown className="w-4 h-4 text-rose-400" />
                            <span className="text-sm font-semibold">PDF</span>
                        </button>
                        <button 
                            onClick={handleShareWhatsApp}
                            disabled={selectedUnis.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Phone className="w-4 h-4" />
                            <span className="text-sm font-semibold">WhatsApp</span>
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Search and Filters */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Üniversite ara..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                        />
                    </div>
                    
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setSelectedDegree(''); // Reset degree when category changes
                            }}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm appearance-none cursor-pointer"
                        >
                            <option value="">Ana Bölüm Seçiniz</option>
                            {mainCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={selectedDegree}
                            onChange={(e) => setSelectedDegree(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm appearance-none cursor-pointer"
                        >
                            <option value="">Alt Başlık Seçiniz</option>
                            {mainDegrees
                                .filter(deg => !selectedCategory || (deg.categoryIds || []).includes(selectedCategory))
                                .map(deg => (
                                    <option key={deg.id} value={deg.name}>{deg.name}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm appearance-none cursor-pointer"
                        >
                            <option value="">Tüm Ülkeler</option>
                            {countries.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm appearance-none cursor-pointer"
                        >
                            <option value="">Tüm Türler</option>
                            <option value="Bachelor">Bachelor (Lisans)</option>
                            <option value="Master">Master (Yüksek Lisans)</option>
                        </select>
                    </div>

                    <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={selectedBudget}
                            onChange={(e) => setSelectedBudget(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm appearance-none cursor-pointer"
                        >
                            <option value="">Bütçe Seçiniz</option>
                            {budgetRanges.map(b => (
                                <option key={b.id} value={b.label}>{b.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    <p className="text-slate-500 font-medium">Bağlantıda olduğumuz üniversiteler hazırlanıyor...</p>
                </div>
            ) : !hasAnyFilter ? (
                <div className="bg-white p-20 text-center rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-8 h-8 text-indigo-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Üniversite Aramak İçin Kriter Belirleyin</h3>
                    <p className="text-slate-500 mt-2">Bölüm, ülke veya üniversite adı seçerek aramaya başlayabilirsiniz.</p>
                </div>
            ) : filteredUniversities.length === 0 ? (
                <div className="bg-white p-20 text-center rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Sonuç Bulunamadı</h3>
                    <p className="text-slate-500 mt-2">Arama kriterlerinizi değiştirmeyi deneyin.</p>
                </div>
            ) : (
                <>
                    {/* Results Header */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Bulunan Üniversiteler</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    <span className="text-slate-800 font-bold">{filteredUniversities.length}</span> üniversite bulundu
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {selectedUnis.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-semibold text-slate-700">{selectedUnis.length} üniversite seçildi</span>
                                    </div>
                                )}
                                {selectedUnis.length > 0 && (
                                    <button
                                        onClick={() => setSelectedUnis([])}
                                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                                    >
                                        Seçimleri Temizle
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* University Grid Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-semibold text-slate-700">Üniversite Listesi</h4>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Building className="w-4 h-4" />
                            <span>Detay için tıklayın</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredUniversities.map(uni => {
                            const isSelected = selectedUnis.includes(uni.id);
                            return (
                                <div 
                                    key={uni.id}
                                    onClick={() => toggleSelection(uni.id)}
                                    className={`group bg-white rounded-3xl border-2 transition-all p-5 cursor-pointer flex flex-col h-full ${
                                        isSelected 
                                            ? 'border-indigo-600 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50' 
                                            : 'border-slate-100 hover:border-indigo-200 hover:shadow-lg'
                                    }`}
                                >
                                    {/* Selection Badge */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-40 h-40 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-2 group-hover:scale-110 transition-transform">
                                            {uni.logo ? (
                                                <img src={uni.logo} alt="" className="w-full h-full object-contain" />
                                            ) : (
                                                <img 
                                                    src={`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(uni.name)}&backgroundColor=f1f5f9`} 
                                                    alt="" 
                                                    className="w-full h-full object-cover opacity-60" 
                                                />
                                            )}
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'
                                        }`}>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                        {uni.name}
                                    </h3>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {(uni.countries || []).map(c => {
                                            const infoMap: Record<string, { flag: string, currency: string }> = {
                                                'İtalya': { flag: '🇮🇹', currency: 'EUR' },
                                                'Almanya': { flag: '🇩🇪', currency: 'EUR' },
                                                'ABD': { flag: '🇺🇸', currency: 'USD' },
                                                'İngiltere': { flag: '🇬🇧', currency: 'GBP' },
                                                'Kanada': { flag: '🇨🇦', currency: 'CAD' },
                                                'Fransa': { flag: '🇫🇷', currency: 'EUR' },
                                                'İspanya': { flag: '🇪🇸', currency: 'EUR' },
                                                'Hollanda': { flag: '🇳🇱', currency: 'EUR' },
                                                'Polonya': { flag: '🇵🇱', currency: 'PLN' },
                                                'Macaristan': { flag: '🇭🇺', currency: 'HUF' },
                                                'Switzerland': { flag: '🇨🇭', currency: 'CHF' },
                                                'Germany': { flag: '🇩🇪', currency: 'EUR' },
                                                'Italy': { flag: '🇮🇹', currency: 'EUR' },
                                                'USA': { flag: '🇺🇸', currency: 'USD' },
                                                'UK': { flag: '🇬🇧', currency: 'GBP' },
                                                'Spain': { flag: '🇪🇸', currency: 'EUR' },
                                                'France': { flag: '🇫🇷', currency: 'EUR' },
                                            };
                                            const info = infoMap[c] || { flag: '🌍', currency: 'EUR' };
                                            
                                            // Get matching budgets for this uni
                                            const matchedBudgets = Array.from(new Set((uni.programs || []).filter(p => {
                                                const matchDegree = !selectedDegree || 
                                                                    p.name.toLowerCase().includes(selectedDegree.toLowerCase()) || 
                                                                    (p.groupNames || []).some(gn => gn.toLowerCase() === selectedDegree.toLowerCase());
                                                const matchType = !selectedType || p.type === selectedType;
                                                const matchBudget = (() => {
                                                    if (!selectedBudget) return true;
                                                    const selectedObj = budgetRanges.find(b => b.label === selectedBudget);
                                                    if (!selectedObj) return true;
                                                    
                                                    if (selectedObj.sort_order === 1) return true;

                                                    const progBudgetObj = budgetRanges.find(b => b.label === p.tuitionRange);
                                                    if (!progBudgetObj) return false;
                                                    
                                                    if (selectedObj.sort_order >= 100) {
                                                        return progBudgetObj.sort_order === selectedObj.sort_order;
                                                    }
                                                    
                                                    return progBudgetObj.sort_order <= selectedObj.sort_order;
                                                })();
                                                return matchDegree && matchType && matchBudget;
                                            }).map(p => p.tuitionRange)));

                                            return (
                                                <div key={c} className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200/50">
                                                    <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-200 shrink-0 shadow-sm">
                                                        {getCountryCode(c) ? (
                                                            <img src={`https://flagcdn.com/w40/${getCountryCode(c).toLowerCase()}.png`} className="w-full h-full object-cover" alt={c} />
                                                        ) : (
                                                            <span className="text-xs">{getFlagEmoji(c)}</span>
                                                        )}
                                                    </div>
                                                    <span>{c}</span>
                                                    <span className="text-slate-400 mx-1">•</span>
                                                    <span className="text-indigo-600">{info.currency}</span>
                                                    {matchedBudgets.length > 0 && (
                                                        <>
                                                            <span className="text-slate-400 mx-1">|</span>
                                                            <span className="text-emerald-600 italic font-medium">{matchedBudgets[0]}</span>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Programs Preview */}
                                    <div className="flex-1 space-y-3 mb-6">
                                        {(() => {
                                            const filteredPrograms = (uni.programs || []).filter(prog => {
                                                const matchDegree = !selectedDegree || 
                                                                    prog.name.toLowerCase().includes(selectedDegree.toLowerCase()) || 
                                                                    (prog.groupNames || []).some(gn => gn.toLowerCase() === selectedDegree.toLowerCase());
                                                const matchType = !selectedType || prog.type === selectedType;
                                                
                                                const matchBudget = (() => {
                                                    if (!selectedBudget) return true;
                                                    const selectedObj = budgetRanges.find(b => b.label === selectedBudget);
                                                    if (!selectedObj) return true;

                                                    if (selectedObj.sort_order === 1) return true;

                                                    const progBudgetObj = budgetRanges.find(b => b.label === prog.tuitionRange);
                                                    if (!progBudgetObj) return false;
                                                    
                                                    if (selectedObj.sort_order >= 100) {
                                                        return progBudgetObj.sort_order === selectedObj.sort_order;
                                                    }
                                                    
                                                    return progBudgetObj.sort_order <= selectedObj.sort_order;
                                                })();
                                                
                                                return matchDegree && matchType && matchBudget;
                                            });

                                            return filteredPrograms.length > 0 ? (
                                                <>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Matching Programs</div>
                                                    <div className="space-y-2">
                                                        {filteredPrograms.slice(0, 3).map(prog => (
                                                            <div key={prog.id} className="flex items-start gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-slate-700 leading-tight">{prog.name}</p>
                                                                    <p className="text-[10px] text-slate-500 uppercase">{prog.type} • {prog.tuitionRange}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {filteredPrograms.length > 3 && (
                                                            <p className="text-[10px] font-medium text-indigo-500 ml-3">+{filteredPrograms.length - 3} more matches</p>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                                    <BookOpen className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                                                    <p className="text-[10px] text-slate-400">No matching programs</p>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Footer Links */}
                                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
                                        {uni.websiteUrl && (
                                            <a 
                                                href={uni.websiteUrl} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Official Website"
                                            >
                                                <Globe className="w-4 h-4" />
                                            </a>
                                        )}
                                        {uni.departmentsUrl && (
                                            <a 
                                                href={uni.departmentsUrl} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Course Directory"
                                            >
                                                <BookOpen className="w-4 h-4" />
                                            </a>
                                        )}
                                        {uni.rankingUrl && (
                                            <a 
                                                href={uni.rankingUrl} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="World Rankings"
                                            >
                                                <Star className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

        </div>
    );
};

export default UniversitySearch;
