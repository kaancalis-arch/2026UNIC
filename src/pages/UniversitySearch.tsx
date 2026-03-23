
import React, { useState, useEffect } from 'react';
import { 
    Search, Filter, Globe, GraduationCap, MapPin, 
    Share2, FileDown, CheckCircle2, Building, 
    ExternalLink, BookOpen, Star, Phone,
    Check, X, Loader2, ChevronRight, ClipboardCopy
} from 'lucide-react';
import { UniversityData, UniversityProgram, MainDegreeData, MainCategoryData } from '../types';
import { universityService } from '../services/universityService';
import { mainDegreeService } from '../services/mainDegreeService';
import { mainCategoryService } from '../services/mainCategoryService';
import { systemService } from '../services/systemService';
import { jsPDF } from 'jspdf';

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
    const [allBudgets, setAllBudgets] = useState<string[]>([]);
    
    // Selection
    const [selectedUnis, setSelectedUnis] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [uniData, degreeData, cats, junctions, budgetData] = await Promise.all([
                universityService.getAll(),
                mainDegreeService.getAll(),
                mainCategoryService.getAll(),
                mainCategoryService.getJunctions(),
                systemService.getTuitionRanges()
            ]);
            
            // Enrich degrees with category IDs
            const enrichedDegrees = degreeData.map(d => ({
                ...d,
                categoryIds: junctions.filter(j => j.program_id === d.id).map(j => j.category_id)
            }));

            setUniversities(uniData);
            setMainDegrees(enrichedDegrees as MainDegreeData[]);
            setMainCategories(cats);
            setAllBudgets(budgetData);
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
            if (!selectedBudget || selectedBudget === "Bütçe Konusunda Kararsızım" || selectedBudget === "20.000 üzeri uygundur") return true;
            
            const acceptableRangesMap: Record<string, string[]> = {
                "5.000'e kadar": ["5.000'e kadar"],
                "10.000'e kadar": ["5.000'e kadar", "10.000'e kadar"],
                "15.000'e kadar": ["5.000'e kadar", "10.000'e kadar", "15.000'e kadar"],
                "20.000'e kadar": ["5.000'e kadar", "10.000'e kadar", "15.000'e kadar", "20.000'e kadar"]
            };
            
            const acceptable = acceptableRangesMap[selectedBudget] || [selectedBudget];
            return (uni.programs || []).some(prog => acceptable.includes(prog.tuitionRange));
        })();
        
        return matchesSearch && matchesCountry && matchesDegree && matchesType && matchesBudget;
    });

    const toggleSelection = (id: string) => {
        setSelectedUnis(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
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
            {/* Header */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">University Search</h2>
                        <p className="text-slate-500 mt-1">Discover programs and partner universities worldwide.</p>
                        {selectedUnis.length > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 uppercase tracking-wider">
                                    {selectedUnis.length} Üniversite Seçildi
                                </span>
                                <button 
                                    onClick={() => setSelectedUnis([])}
                                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider transition-colors"
                                >
                                    Seçimleri Temizle
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExportPDF}
                            disabled={selectedUnis.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-[10px] uppercase"
                        >
                            <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                            PDF
                        </button>
                        <button 
                            onClick={handleShareWhatsApp}
                            disabled={selectedUnis.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-[10px] uppercase"
                        >
                            <Phone className="w-3.5 h-3.5" />
                            WhatsApp
                        </button>
                        <button 
                            onClick={handleCopyToClipboard}
                            disabled={selectedUnis.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-[10px] uppercase"
                        >
                            <ClipboardCopy className="w-3.5 h-3.5 text-indigo-600" />
                            Kopyala
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
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
                            {allBudgets.map(b => (
                                <option key={b} value={b}>{b}</option>
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
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            <span className="text-slate-800 font-bold">{filteredUniversities.length}</span> üniversite listeleniyor
                        </p>
                        {selectedUnis.length > 0 && (
                            <button 
                                onClick={() => setSelectedUnis([])}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                            >
                                Seçimleri Temizle ({selectedUnis.length})
                            </button>
                        )}
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
                                        <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-2 group-hover:scale-110 transition-transform">
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
                                                    if (!selectedBudget || selectedBudget === "Bütçe Konusunda Kararsızım" || selectedBudget === "20.000 üzeri uygundur") return true;
                                                    const acceptableRangesMap: Record<string, string[]> = {
                                                        "5.000'e kadar": ["5.000'e kadar"],
                                                        "10.000'e kadar": ["5.000'e kadar", "10.000'e kadar"],
                                                        "15.000'e kadar": ["5.000'e kadar", "10.000'e kadar", "15.000'e kadar"],
                                                        "20.000'e kadar": ["5.000'e kadar", "10.000'e kadar", "15.000'e kadar", "20.000'e kadar"]
                                                    };
                                                    const acceptable = acceptableRangesMap[selectedBudget] || [selectedBudget];
                                                    return acceptable.includes(p.tuitionRange);
                                                })();
                                                return matchDegree && matchType && matchBudget;
                                            }).map(p => p.tuitionRange)));

                                            return (
                                                <div key={c} className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200/50">
                                                    <span>{info.flag}</span>
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
                                                    if (!selectedBudget || selectedBudget === "Bütçe Konusunda Kararsızım" || selectedBudget === "20.000 üzeri uygundur") return true;
                                                    const acceptableRangesMap: Record<string, string[]> = {
                                                        "5.000'e kadar": ["5.000'e kadar"],
                                                        "10.000'e kadar": ["5.000'e kadar", "10.000'e kadar"],
                                                        "15.000'e kadar": ["5.000'e kadar", "10.000'e kadar", "15.000'e kadar"],
                                                        "20.000'e kadar": ["5.000'e kadar", "10.000'e kadar", "15.000'e kadar", "20.000'e kadar"]
                                                    };
                                                    const acceptable = acceptableRangesMap[selectedBudget] || [selectedBudget];
                                                    return acceptable.includes(prog.tuitionRange);
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
