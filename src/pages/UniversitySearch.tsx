
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    Search, Filter, Globe, GraduationCap, MapPin, 
    Share2, FileDown, CheckCircle2, Building, 
    ExternalLink, BookOpen, Star, Phone,
    Check, X, Loader2, ChevronRight, ClipboardCopy, Upload, Download, RotateCcw, PencilLine
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UniversityData, UniversityProgram, MainDegreeData } from '../types';
import { universityService } from '../services/universityService';
import { mainDegreeService } from '../services/mainDegreeService';
import { systemService, BudgetRange } from '../services/systemService';
import { jsPDF } from 'jspdf';
import { getCountryCode, getFlagEmoji } from '../utils/countryUtils';

const normalizeDepartment = (value?: string) =>
    (value || '')
        .toLocaleLowerCase('tr-TR')
        .trim();

type PdfImage = { dataUrl: string; aspectRatio: number };

type OfferProgramDraft = Pick<UniversityProgram, 'id' | 'name' | 'type' | 'tuitionRange' | 'campusLocation' | 'link'>;

interface OfferUniversityDraft {
    id: string;
    name: string;
    logo: string;
    countries: string;
    campuses: string;
    websiteUrl: string;
    programs: OfferProgramDraft[];
}

interface UniversityOfferDraft {
    title: string;
    intro: string;
    closing: string;
    universities: OfferUniversityDraft[];
}

const loadImageAsPng = (src: string) => new Promise<PdfImage | null>((resolve) => {
    if (!src) {
        resolve(null);
        return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
        try {
            const maxSize = 512;
            const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d');

            if (!context) {
                resolve(null);
                return;
            }

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve({
                dataUrl: canvas.toDataURL('image/png'),
                aspectRatio: canvas.width / canvas.height,
            });
        } catch (error) {
            console.warn('University logo could not be added to PDF.', error);
            resolve(null);
        }
    };
    image.onerror = () => resolve(null);
    image.src = src;
});

const UniversitySearch: React.FC = () => {
    const [universities, setUniversities] = useState<UniversityData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImportingExcel, setIsImportingExcel] = useState(false);
    const [mainDegrees, setMainDegrees] = useState<MainDegreeData[]>([]);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDegree, setSelectedDegree] = useState<string>('');
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedBudget, setSelectedBudget] = useState<string>('');
    const [budgetRanges, setBudgetRanges] = useState<BudgetRange[]>([]);
    
    // Selection
    const [selectedUnis, setSelectedUnis] = useState<string[]>([]);
    const [selectedPrograms, setSelectedPrograms] = useState<Record<string, string[]>>({});
    const [isSharePreviewOpen, setIsSharePreviewOpen] = useState(false);
    const [isShareTextCopied, setIsShareTextCopied] = useState(false);
    const [isOfferEditorOpen, setIsOfferEditorOpen] = useState(false);
    const [offerDraft, setOfferDraft] = useState<UniversityOfferDraft | null>(null);
    const [isOfferTextCopied, setIsOfferTextCopied] = useState(false);
    const [expandedProgramCards, setExpandedProgramCards] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [uniData, degreeData, rawBudgets] = await Promise.all([
                universityService.getAll(),
                mainDegreeService.getAll(),
                systemService.getBudgetRangesRaw()
            ]);

            setUniversities(uniData);
            setMainDegrees(degreeData as MainDegreeData[]);
            setBudgetRanges(rawBudgets);
        } catch (error) {
            console.error("Failed to load search data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const matchesDegree = (program: UniversityProgram, degreeId: string) => {
        if (!degreeId) return true;

        const degreeName = mainDegrees.find(degree => degree.id === degreeId)?.name;
        if (!degreeName) return false;

        const normalizedDepartment = normalizeDepartment(degreeName);
        const programDepartments = [
            ...(program.groupNames || []),
            ...(program.matched_departments || []),
        ];

        return normalizeDepartment(program.name).includes(normalizedDepartment) ||
            programDepartments.some(department => normalizeDepartment(department) === normalizedDepartment);
    };

    const matchesBudget = (program: UniversityProgram, budgetLabel: string) => {
        if (!budgetLabel) return true;

        const selectedBudgetRange = budgetRanges.find(budget => budget.label === budgetLabel);
        if (!selectedBudgetRange) return false;
        if (selectedBudgetRange.sort_order === 1) return true;

        const programBudgetRange = budgetRanges.find(budget => budget.label === program.tuitionRange);
        if (!programBudgetRange) return false;

        return selectedBudgetRange.sort_order >= 100
            ? programBudgetRange.sort_order === selectedBudgetRange.sort_order
            : programBudgetRange.sort_order <= selectedBudgetRange.sort_order;
    };

    const matchesProgramFilters = (
        program: UniversityProgram,
        degreeId: string,
        type: string,
        budgetLabel: string,
    ) => matchesDegree(program, degreeId) &&
        (!type || program.type === type) &&
        matchesBudget(program, budgetLabel);

    const matchesUniversityFilters = (
        university: UniversityData,
        degreeId: string,
        country: string,
        type: string,
        budgetLabel: string,
    ) => {
        const searchWords = normalizeDepartment(searchTerm).split(/\s+/).filter(Boolean);
        const searchableText = normalizeDepartment([university.name, ...(university.campuses || [])].join(' '));
        const matchesSearch = searchWords.every(word => searchableText.includes(word));
        const matchesCountry = !country || (university.countries || []).includes(country);
        const hasProgramFilter = Boolean(degreeId || type || budgetLabel);
        const matchesPrograms = !hasProgramFilter || (university.programs || []).some(program =>
            matchesProgramFilters(program, degreeId, type, budgetLabel)
        );

        return matchesSearch && matchesCountry && matchesPrograms;
    };

    const hasAnyFilter = searchTerm.trim() !== '' || 
                         selectedDegree !== '' || 
                         selectedCountry !== '' || 
                         selectedType !== '' || 
                         selectedBudget !== '';

    const availableDegrees = mainDegrees.filter(degree =>
        degree.id === selectedDegree || universities.some(university =>
            matchesUniversityFilters(university, degree.id, selectedCountry, selectedType, selectedBudget)
        )
    );
    const availableCountries = Array.from(new Set(
        universities
            .filter(university => matchesUniversityFilters(
                university,
                selectedDegree,
                '',
                selectedType,
                selectedBudget,
            ))
            .flatMap(university => university.countries || [])
    ));
    if (selectedCountry && !availableCountries.includes(selectedCountry)) {
        availableCountries.push(selectedCountry);
    }
    availableCountries.sort((a, b) => a.localeCompare(b, 'tr'));

    const universityTypes: UniversityProgram['type'][] = ['Bachelor', 'Master'];
    const availableTypes = universityTypes.filter(type =>
        type === selectedType || universities.some(university =>
            matchesUniversityFilters(university, selectedDegree, selectedCountry, type, selectedBudget)
        )
    );
    const availableBudgets = budgetRanges.filter(budget =>
        budget.label === selectedBudget || universities.some(university =>
            matchesUniversityFilters(university, selectedDegree, selectedCountry, selectedType, budget.label)
        )
    );

    // Keep the empty state until the user chooses at least one criterion.
    const filteredUniversities = !hasAnyFilter ? [] : universities.filter(university =>
        matchesUniversityFilters(
            university,
            selectedDegree,
            selectedCountry,
            selectedType,
            selectedBudget,
        )
    );

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedDegree('');
        setSelectedCountry('');
        setSelectedType('');
        setSelectedBudget('');
    };

    const getMatchingPrograms = (university: UniversityData) =>
        (university.programs || []).filter(program =>
            matchesProgramFilters(program, selectedDegree, selectedType, selectedBudget)
        );

    const getReportPrograms = (university: UniversityData) => {
        const programIds = selectedPrograms[university.id] || [];
        if (programIds.length > 0) {
            return (university.programs || []).filter(program => programIds.includes(program.id));
        }

        const matchingPrograms = getMatchingPrograms(university);
        return matchingPrograms.length === 1 ? matchingPrograms : [];
    };

    const toggleSelection = (university: UniversityData) => {
        const isSelected = selectedUnis.includes(university.id);
        setSelectedUnis(prev =>
            isSelected ? prev.filter(id => id !== university.id) : [...prev, university.id]
        );

        setSelectedPrograms(prev => {
            const next = { ...prev };
            if (isSelected) {
                delete next[university.id];
            } else {
                const matchingPrograms = getMatchingPrograms(university);
                next[university.id] = matchingPrograms.length === 1 ? [matchingPrograms[0].id] : [];
            }
            return next;
        });
    };

    const toggleProgramSelection = (universityId: string, programId: string) => {
        setSelectedPrograms(prev => {
            const current = prev[universityId] || [];
            return {
                ...prev,
                [universityId]: current.includes(programId)
                    ? current.filter(id => id !== programId)
                    : [...current, programId],
            };
        });
    };

    const clearSelections = () => {
        setSelectedUnis([]);
        setSelectedPrograms({});
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
        setIsImportingExcel(true);
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
            } finally {
                setIsImportingExcel(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportPDF = async () => {
        if (selectedUnis.length === 0) {
            alert("Lütfen önce okul seçiniz.");
            return;
        }

        const doc = new jsPDF();
        const selectedData = universities.filter(u => selectedUnis.includes(u.id));
        const universityLogos = await Promise.all(selectedData.map(uni => loadImageAsPng(uni.logo)));

        doc.setFontSize(22);
        doc.setTextColor(63, 81, 181);
        doc.text("UNIC University Recommendations", 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Hazırlanma Tarihi: ${new Date().toLocaleDateString()}`, 20, 30);
        
        let y = 50;
        selectedData.forEach((uni, idx) => {
            if (y > 250) { doc.addPage(); y = 20; }

            const headerTop = y;
            const logoSize = 24;
            const logoData = universityLogos[idx];

            if (logoData) {
                const logoWidth = logoData.aspectRatio >= 1 ? logoSize : logoSize * logoData.aspectRatio;
                const logoHeight = logoData.aspectRatio >= 1 ? logoSize / logoData.aspectRatio : logoSize;
                const logoX = 20 + (logoSize - logoWidth) / 2;
                const logoY = headerTop + (logoSize - logoHeight) / 2;
                doc.addImage(logoData.dataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
            } else {
                doc.setFillColor(238, 242, 255);
                doc.setDrawColor(99, 102, 241);
                doc.roundedRect(20, headerTop, logoSize, logoSize, 2, 2, 'FD');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(67, 56, 202);
                doc.text(uni.name.trim().charAt(0).toUpperCase() || 'U', 32, headerTop + 15.5, { align: 'center' });
            }

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33);
            const titleLines = doc.splitTextToSize(`${idx + 1}. ${uni.name}`, 138) as string[];
            doc.text(titleLines, 50, headerTop + 6);
            let headerTextY = headerTop + 6 + titleLines.length * 6;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80);
            doc.text(`Ülke: ${uni.countries?.join(', ') || '-'}`, 50, headerTextY);
            headerTextY += 6;
            
            if (uni.websiteUrl) {
                doc.setTextColor(37, 99, 235);
                doc.textWithLink('Web: Tıklayınız', 50, headerTextY, { url: uni.websiteUrl });
                headerTextY += 6;
            }

            y = Math.max(headerTop + logoSize, headerTextY) + 6;

            const reportPrograms = getReportPrograms(uni);
            if (reportPrograms.length > 0) {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50);
                doc.text("Seçili Bölümler:", 25, y);
                y += 8;
                reportPrograms.forEach(prog => {
                    if (y > 260) { doc.addPage(); y = 20; }

                    doc.setFillColor(59, 130, 246);
                    doc.circle(28, y - 1.2, 1.6, 'F');
                    doc.setFont('helvetica', 'bolditalic');
                    doc.setFontSize(10);
                    doc.setTextColor(30, 41, 59);
                    doc.text(prog.name, 33, y);
                    y += 6;

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(71, 85, 105);
                    const degreeType = prog.type === 'Bachelor' ? 'Lisans' : 'Yüksek Lisans';
                    doc.text(`${degreeType}${prog.tuitionRange ? `  |  Ücret: ${prog.tuitionRange}` : ''}`, 33, y);
                    y += 5;

                    if (prog.campusLocation) {
                        doc.text(`Kampüs: ${prog.campusLocation}`, 33, y);
                        y += 5;
                    }
                    if (prog.link) {
                        doc.setTextColor(37, 99, 235);
                        doc.textWithLink('Bölüm Websitesi: Tıklayınız', 33, y, { url: prog.link });
                        y += 5;
                    }
                    y += 3;
                });
            }
            
            if (idx < selectedData.length - 1) {
                if (y > 275) {
                    doc.addPage();
                    y = 20;
                } else {
                    y += 3;
                }

                doc.setDrawColor(71, 85, 105);
                doc.setLineWidth(0.7);
                doc.line(20, y, 190, y);
                y += 11;
            }
        });

        doc.save(`UNIC_University_List_${Date.now()}.pdf`);
    };

    const buildUniversityShareText = () => {
        const selectedData = universities.filter(u => selectedUnis.includes(u.id));
        const lines = [
            '🎓 *UNIC ÜNİVERSİTE ÖNERİLERİ*',
            '✨ Sizin için seçilen üniversite ve bölüm bilgileri',
            '',
        ];

        selectedData.forEach((uni, idx) => {
            const campuses = uni.campuses || [];
            const countries = (uni.countries || [])
                .map(country => `${getFlagEmoji(country)} ${country}`)
                .join(', ');
            const reportPrograms = getReportPrograms(uni);

            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push(`🏫 *${idx + 1}. ${uni.name}*`);
            lines.push(`🌍 *Ülke:* ${countries || '-'}`);
            if (campuses.length > 0) {
                lines.push(`📍 *Kampüs:* ${campuses.join(', ')}`);
            }

            if (reportPrograms.length > 0) {
                lines.push('', '📚 *Bölümler*');
                reportPrograms.forEach(program => {
                    const degreeType = program.type === 'Bachelor' ? 'Lisans' : 'Yüksek Lisans';
                    lines.push(`🔵 *_${program.name}_*`);
                    lines.push(`   🎓 ${degreeType}${program.tuitionRange ? `  |  💰 ${program.tuitionRange}` : ''}`);
                    if (program.campusLocation) lines.push(`   📌 ${program.campusLocation}`);
                    if (program.link) lines.push(`   ➡️ 📲 *Bölüm Websitesi:* ${program.link}`);
                });
            }

            if (uni.websiteUrl) lines.push('', `🌐 *Üniversite web sitesi:* ${uni.websiteUrl}`);
            lines.push('');
        });

        lines.push('💬 Detaylı bilgi ve başvuru desteği için danışmanınızla iletişime geçebilirsiniz.');
        return lines.join('\n');
    };

    const handleShareWhatsApp = () => {
        if (selectedUnis.length === 0) {
            alert("Lütfen önce okul seçiniz.");
            return;
        }

        setIsShareTextCopied(false);
        setIsSharePreviewOpen(true);
    };

    const handleEditOffer = () => {
        if (selectedUnis.length === 0) {
            alert('Lütfen önce okul seçiniz.');
            return;
        }

        setOfferDraft({
            title: 'UNIC ÜNİVERSİTE TEKLİFİ',
            intro: 'Sizin için seçilen üniversite ve bölüm seçeneklerini aşağıda inceleyebilirsiniz.',
            closing: 'Detaylı bilgi ve başvuru desteği için danışmanınızla iletişime geçebilirsiniz.',
            universities: universities
                .filter(university => selectedUnis.includes(university.id))
                .map(university => ({
                    id: university.id,
                    name: university.name,
                    logo: university.logo,
                    countries: (university.countries || []).join(', '),
                    campuses: (university.campuses || []).join(', '),
                    websiteUrl: university.websiteUrl,
                    programs: getReportPrograms(university).map(program => ({
                        id: program.id,
                        name: program.name,
                        type: program.type,
                        tuitionRange: program.tuitionRange,
                        campusLocation: program.campusLocation,
                        link: program.link,
                    })),
                })),
        });
        setIsOfferTextCopied(false);
        setIsOfferEditorOpen(true);
    };

    const updateOfferUniversity = (universityId: string, changes: Partial<OfferUniversityDraft>) => {
        setOfferDraft(current => current ? {
            ...current,
            universities: current.universities.map(university =>
                university.id === universityId ? { ...university, ...changes } : university
            ),
        } : current);
        setIsOfferTextCopied(false);
    };

    const updateOfferProgram = (
        universityId: string,
        programId: string,
        changes: Partial<OfferProgramDraft>,
    ) => {
        setOfferDraft(current => current ? {
            ...current,
            universities: current.universities.map(university =>
                university.id === universityId
                    ? {
                        ...university,
                        programs: university.programs.map(program =>
                            program.id === programId ? { ...program, ...changes } : program
                        ),
                    }
                    : university
            ),
        } : current);
        setIsOfferTextCopied(false);
    };

    const buildOfferText = () => {
        if (!offerDraft) return '';

        const lines = [`🎓 *${offerDraft.title}*`, `✨ ${offerDraft.intro}`, ''];
        offerDraft.universities.forEach((university, index) => {
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push(`🏫 *${index + 1}. ${university.name}*`);
            lines.push(`🌍 *Ülke:* ${university.countries || '-'}`);
            if (university.campuses) lines.push(`📍 *Kampüs:* ${university.campuses}`);
            if (university.programs.length > 0) lines.push('', '📚 *Bölümler*');
            university.programs.forEach(program => {
                const degreeType = program.type === 'Bachelor' ? 'Lisans' : 'Yüksek Lisans';
                lines.push(`🔵 *_${program.name}_*`);
                lines.push(`   🎓 ${degreeType}${program.tuitionRange ? `  |  💰 ${program.tuitionRange}` : ''}`);
                if (program.campusLocation) lines.push(`   📌 ${program.campusLocation}`);
                if (program.link) lines.push('   ➡️ 📲 *Bölüm Websitesi:* Tıklayınız');
            });
            if (university.websiteUrl) lines.push('', '🌐 *Üniversite web sitesi:* Tıklayınız');
            lines.push('');
        });
        lines.push(`💬 ${offerDraft.closing}`);
        return lines.join('\n');
    };

    const handleCopyOffer = async () => {
        if (!offerDraft) return;

        try {
            await navigator.clipboard.writeText(buildOfferText());
            setIsOfferTextCopied(true);
        } catch (error) {
            console.error('Teklif metni panoya kopyalanamadı', error);
            alert('Otomatik kopyalama başarısız oldu.');
        }
    };

    const handleCopyToClipboard = async () => {
        if (selectedUnis.length === 0) return;

        try {
            await navigator.clipboard.writeText(buildUniversityShareText());
            setIsShareTextCopied(true);
        } catch (error) {
            console.error('Metin panoya kopyalanamadı', error);
            alert('Otomatik kopyalama başarısız oldu. Metni seçerek manuel kopyalayabilirsiniz.');
        }
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

                    <div className="flex flex-wrap items-center gap-3">
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
                            disabled={isImportingExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isImportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span className="text-sm font-semibold">{isImportingExcel ? 'Yükleniyor...' : 'Excel Ekle'}</span>
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
                        <button
                            type="button"
                            onClick={handleEditOffer}
                            disabled={selectedUnis.length === 0}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <PencilLine className="h-4 w-4" />
                            <span className="text-sm font-semibold">Teklif Düzenle</span>
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Search and Filters */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${searchTerm.trim() ? 'text-blue-600' : 'text-slate-400'}`} />
                        <input 
                            type="text" 
                            placeholder="Üniversite veya kampüs ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl outline-none transition-all text-sm focus:ring-2 focus:ring-blue-500 ${searchTerm.trim() ? 'bg-blue-50 border border-blue-500 text-blue-900' : 'bg-slate-50 border border-slate-100 focus:bg-white'}`}
                        />
                    </div>
                    
                    <div className="relative">
                        <GraduationCap className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${selectedDegree ? 'text-blue-600' : 'text-slate-400'}`} />
                        <select 
                            value={selectedDegree}
                            onChange={(e) => setSelectedDegree(e.target.value)}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl outline-none transition-all text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 ${selectedDegree ? 'bg-blue-50 border border-blue-500 text-blue-900 font-semibold' : 'bg-slate-50 border border-slate-100 focus:bg-white'}`}
                        >
                            <option value="">Bölüm Seçiniz</option>
                            {availableDegrees.map(deg => (
                                <option key={deg.id} value={deg.id}>{deg.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Globe className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${selectedCountry ? 'text-blue-600' : 'text-slate-400'}`} />
                        <select 
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl outline-none transition-all text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 ${selectedCountry ? 'bg-blue-50 border border-blue-500 text-blue-900 font-semibold' : 'bg-slate-50 border border-slate-100 focus:bg-white'}`}
                        >
                            <option value="">Tüm Ülkeler</option>
                            {availableCountries.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <BookOpen className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${selectedType ? 'text-blue-600' : 'text-slate-400'}`} />
                        <select 
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl outline-none transition-all text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 ${selectedType ? 'bg-blue-50 border border-blue-500 text-blue-900 font-semibold' : 'bg-slate-50 border border-slate-100 focus:bg-white'}`}
                        >
                            <option value="">Tüm Türler</option>
                            {availableTypes.map(type => (
                                <option key={type} value={type}>
                                    {type === 'Bachelor' ? 'Bachelor (Lisans)' : 'Master (Yüksek Lisans)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Building className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${selectedBudget ? 'text-blue-600' : 'text-slate-400'}`} />
                        <select 
                            value={selectedBudget}
                            onChange={(e) => setSelectedBudget(e.target.value)}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl outline-none transition-all text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 ${selectedBudget ? 'bg-blue-50 border border-blue-500 text-blue-900 font-semibold' : 'bg-slate-50 border border-slate-100 focus:bg-white'}`}
                        >
                            <option value="">Bütçe Seçiniz</option>
                            {availableBudgets.map(b => (
                                <option key={b.id} value={b.label}>{b.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasAnyFilter}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Tüm Filtreleri Sıfırla
                    </button>
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
                                        onClick={clearSelections}
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
                            <span>Seçim için yuvarlak alana tıklayın</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredUniversities.map(uni => {
                            const isSelected = selectedUnis.includes(uni.id);
                            const matchingPrograms = getMatchingPrograms(uni);
                            const selectedProgramIds = selectedPrograms[uni.id] || [];
                            const areProgramsExpanded = expandedProgramCards.includes(uni.id);
                            return (
                                <div 
                                    key={uni.id}
                                    className={`group bg-white rounded-3xl border-2 transition-all p-5 flex flex-col ${
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
                                        <button
                                            type="button"
                                            onClick={() => toggleSelection(uni)}
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                             isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'
                                            }`}
                                            aria-label={`${uni.name} üniversitesini ${isSelected ? 'seçimden kaldır' : 'seç'}`}
                                            aria-pressed={isSelected}
                                        >
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                                        </button>
                                    </div>

                                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                        {uni.name}
                                    </h3>

                                    {(uni.campuses || []).length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs text-slate-500">
                                            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                            {(uni.campuses || []).map(campus => (
                                                <span key={campus} className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
                                                    {campus}
                                                </span>
                                            ))}
                                        </div>
                                    )}

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
                                            const matchedBudgets = Array.from(new Set(
                                                (uni.programs || [])
                                                    .filter(program => matchesProgramFilters(
                                                        program,
                                                        selectedDegree,
                                                        selectedType,
                                                        selectedBudget,
                                                    ))
                                                    .map(program => program.tuitionRange)
                                            ));

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
                                            const filteredPrograms = matchingPrograms;

                                            return filteredPrograms.length > 0 ? (
                                                <>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Matching Programs</div>
                                                        {isSelected && filteredPrograms.length > 1 && (
                                                            <span className="text-[10px] font-bold text-indigo-600">
                                                                {selectedProgramIds.length} bölüm seçildi
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        {(areProgramsExpanded ? filteredPrograms : filteredPrograms.slice(0, 3)).map(prog => (
                                                            <div key={prog.id} className="flex items-start gap-2">
                                                                {isSelected && filteredPrograms.length > 1 ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            toggleProgramSelection(uni.id, prog.id);
                                                                        }}
                                                                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                                                            selectedProgramIds.includes(prog.id)
                                                                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                                                                : 'border-slate-300 bg-white hover:border-indigo-400'
                                                                        }`}
                                                                        aria-label={`${prog.name} bölümünü seç`}
                                                                    >
                                                                        {selectedProgramIds.includes(prog.id) && <Check className="h-3 w-3" />}
                                                                    </button>
                                                                ) : (
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                                                )}
                                                                <div>
                                                                    <p className="text-xs font-semibold text-slate-700 leading-tight">{prog.name}</p>
                                                                    <p className="text-[10px] text-slate-500 uppercase">{prog.type} • {prog.tuitionRange}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {filteredPrograms.length > 3 && (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setExpandedProgramCards(current =>
                                                                        current.includes(uni.id)
                                                                            ? current.filter(id => id !== uni.id)
                                                                            : [...current, uni.id]
                                                                    );
                                                                 }}
                                                                 className="ml-3 text-left text-[10px] font-bold text-indigo-500 transition hover:text-indigo-700 hover:underline"
                                                                 aria-expanded={areProgramsExpanded}
                                                             >
                                                                 {areProgramsExpanded
                                                                     ? 'Show less'
                                                                     : `+${filteredPrograms.length - 3} more matches`}
                                                             </button>
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

            {isOfferEditorOpen && offerDraft && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 md:p-6">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                        <PencilLine className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">Teklif Formunu Düzenle</h3>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">Alanları düzenleyin. Teklif, WhatsApp mesaj görünümünde hazırlanır.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOfferEditorOpen(false)}
                                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                                aria-label="Teklif formunu kapat"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-auto bg-[#efeae2] p-4 md:p-7">
                            <div className="ml-auto max-w-[94%] space-y-3 rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm md:p-5">
                                <input
                                    value={offerDraft.title}
                                    onChange={event => {
                                        setOfferDraft(current => current ? { ...current, title: event.target.value } : current);
                                        setIsOfferTextCopied(false);
                                    }}
                                    className="w-full border-b border-emerald-700/20 bg-transparent text-lg font-black text-slate-900 outline-none focus:border-emerald-700"
                                    aria-label="Teklif başlığı"
                                />
                                <textarea
                                    value={offerDraft.intro}
                                    onChange={event => {
                                        setOfferDraft(current => current ? { ...current, intro: event.target.value } : current);
                                        setIsOfferTextCopied(false);
                                    }}
                                    rows={2}
                                    className="w-full resize-y border-b border-emerald-700/20 bg-transparent text-sm leading-6 text-slate-700 outline-none focus:border-emerald-700"
                                    aria-label="Teklif açıklaması"
                                />
                            </div>

                            <div className="mt-4 space-y-4">
                                {offerDraft.universities.map((university, universityIndex) => (
                                    <div key={university.id} className="ml-auto max-w-[94%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm md:p-5">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-800/10 bg-white p-2 shadow-sm">
                                                {university.logo ? (
                                                    <img src={university.logo} alt={`${university.name} logosu`} className="h-full w-full object-contain" />
                                                ) : (
                                                    <span className="text-3xl font-black text-emerald-700">{university.name.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="flex items-center gap-2 text-slate-900">
                                                    <span className="font-black">{universityIndex + 1}.</span>
                                                    <input
                                                        value={university.name}
                                                        onChange={event => updateOfferUniversity(university.id, { name: event.target.value })}
                                                        className="min-w-0 flex-1 border-b border-emerald-700/20 bg-transparent text-base font-black outline-none focus:border-emerald-700"
                                                        aria-label={`${universityIndex + 1}. üniversite adı`}
                                                    />
                                                </div>
                                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                                    <span className="shrink-0 font-bold">🌍 Ülke:</span>
                                                    <input
                                                        value={university.countries}
                                                        onChange={event => updateOfferUniversity(university.id, { countries: event.target.value })}
                                                        className="min-w-0 flex-1 border-b border-emerald-700/20 bg-transparent outline-none focus:border-emerald-700"
                                                    />
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                                    <span className="shrink-0 font-bold">📍 Kampüs:</span>
                                                    <input
                                                        value={university.campuses}
                                                        onChange={event => updateOfferUniversity(university.id, { campuses: event.target.value })}
                                                        placeholder="Kampüs bilgisi"
                                                        className="min-w-0 flex-1 border-b border-emerald-700/20 bg-transparent outline-none placeholder:text-slate-400 focus:border-emerald-700"
                                                    />
                                                </label>
                                                {university.websiteUrl && (
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        🌐 Üniversite web sitesi:{' '}
                                                        <a
                                                            href={university.websiteUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="font-black text-blue-700 underline underline-offset-2"
                                                        >
                                                            Tıklayınız
                                                        </a>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {university.programs.length > 0 && (
                                            <div className="mt-5 border-t border-emerald-900/10 pt-4">
                                                <h4 className="mb-3 text-sm font-black text-slate-800">📚 Bölümler</h4>
                                                <div className="space-y-4">
                                                    {university.programs.map(program => (
                                                        <div key={program.id} className="rounded-xl bg-white/55 p-3">
                                                            <div className="flex items-start gap-2">
                                                                <span className="mt-1 text-xs">🔵</span>
                                                                <div className="min-w-0 flex-1 space-y-2">
                                                                    <input
                                                                        value={program.name}
                                                                        onChange={event => updateOfferProgram(university.id, program.id, { name: event.target.value })}
                                                                        className="w-full border-b border-emerald-700/20 bg-transparent text-sm font-black italic text-slate-800 outline-none focus:border-emerald-700"
                                                                        aria-label="Bölüm adı"
                                                                    />
                                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                                        <select
                                                                            value={program.type}
                                                                            onChange={event => updateOfferProgram(university.id, program.id, { type: event.target.value as UniversityProgram['type'] })}
                                                                            className="rounded-lg border border-emerald-900/10 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600"
                                                                            aria-label="Program türü"
                                                                        >
                                                                            <option value="Bachelor">Lisans</option>
                                                                            <option value="Master">Yüksek Lisans</option>
                                                                        </select>
                                                                        <input
                                                                            value={program.tuitionRange}
                                                                            onChange={event => updateOfferProgram(university.id, program.id, { tuitionRange: event.target.value })}
                                                                            placeholder="Ücret bilgisi"
                                                                            className="rounded-lg border border-emerald-900/10 bg-white/70 px-2 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-600"
                                                                            aria-label="Program ücret bilgisi"
                                                                        />
                                                                    </div>
                                                                    <input
                                                                        value={program.campusLocation}
                                                                        onChange={event => updateOfferProgram(university.id, program.id, { campusLocation: event.target.value })}
                                                                        placeholder="Kampüs bilgisi"
                                                                        className="w-full rounded-lg border border-emerald-900/10 bg-white/70 px-2 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-600"
                                                                        aria-label="Program kampüs bilgisi"
                                                                    />
                                                                    {program.link && (
                                                                        <p className="text-xs font-semibold text-slate-700">
                                                                            📲 Bölüm Websitesi:{' '}
                                                                            <a
                                                                                href={program.link}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="font-black text-blue-700 underline underline-offset-2"
                                                                            >
                                                                                Tıklayınız
                                                                            </a>
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="ml-auto mt-4 max-w-[94%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm">
                                <textarea
                                    value={offerDraft.closing}
                                    onChange={event => {
                                        setOfferDraft(current => current ? { ...current, closing: event.target.value } : current);
                                        setIsOfferTextCopied(false);
                                    }}
                                    rows={2}
                                    className="w-full resize-y border-b border-emerald-700/20 bg-transparent text-sm leading-6 text-slate-700 outline-none focus:border-emerald-700"
                                    aria-label="Teklif kapanış metni"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                            <p className={`text-sm font-semibold ${isOfferTextCopied ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {isOfferTextCopied ? 'Düzenlenen teklif metni panoya kopyalandı.' : 'Bağlantılar teklifte “Tıklayınız” olarak gösterilir.'}
                            </p>
                            <button
                                type="button"
                                onClick={handleCopyOffer}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                            >
                                {isOfferTextCopied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                                {isOfferTextCopied ? 'Kopyalandı' : 'Teklifi Kopyala'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSharePreviewOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 md:p-6">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                        <Phone className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">WhatsApp Paylaşım Önizlemesi</h3>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">Metni kopyalayıp istediğiniz görüşmeye manuel olarak yapıştırabilirsiniz.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSharePreviewOpen(false)}
                                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                                aria-label="Önizlemeyi kapat"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-auto bg-[#efeae2] p-4 md:p-6">
                            <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm">
                                <textarea
                                    readOnly
                                    value={buildUniversityShareText()}
                                    onFocus={event => event.currentTarget.select()}
                                    className="h-[50vh] min-h-80 w-full resize-none bg-transparent text-sm leading-6 text-slate-800 outline-none"
                                    aria-label="WhatsApp paylaşım metni"
                                />
                                <p className="mt-2 text-right text-[11px] font-medium text-slate-500">Metne tıklayarak tamamını seçebilirsiniz</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                            <p className={`text-sm font-semibold ${isShareTextCopied ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {isShareTextCopied ? 'Metin panoya kopyalandı.' : 'WhatsApp uygulaması otomatik olarak açılmaz.'}
                            </p>
                            <button
                                type="button"
                                onClick={handleCopyToClipboard}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                            >
                                {isShareTextCopied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                                {isShareTextCopied ? 'Kopyalandı' : 'Metni Kopyala'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversitySearch;
