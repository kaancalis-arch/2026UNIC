import React, { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, ExternalLink, Loader2, Search, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ProgramLevel } from '../agents/universityProgramResearchAgent';
import { mainDegreeService } from '../services/mainDegreeService';
import { supabase } from '../services/supabaseClient';
import { systemService, type BudgetRange } from '../services/systemService';
import { universityService } from '../services/universityService';

const programLevelLabels: Record<ProgramLevel, string> = {
  all: 'Tümü',
  undergraduate: 'Sadece Lisans',
  master: 'Sadece Master',
};

type MatchStatus = 'matched' | 'needs_manual_review';
type MatchStatusFilter = 'all' | MatchStatus;
type SortDirection = 'asc' | 'desc';
type SortKey = 'programName' | 'matchedDepartments' | 'matchStatus' | 'degree' | 'durationYears' | 'tuition' | 'language' | 'applicationStatus' | 'sourceUrl';

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

const matchStatusFilterLabels: Record<MatchStatusFilter, string> = {
  all: 'Tümü',
  matched: 'Eşleşti',
  needs_manual_review: 'Manuel kontrol',
};

const maxMatchedDepartments = 3;

const tuitionCurrencyOptions = ['GBP', 'EUR', 'USD', 'CAD', 'AUD'];

const UNIC_MAIN_DEPARTMENTS = [
  'Bilgisayar Bilimleri',
  'Matematik Temelli Bilim',
  'Biyoloji Temelli Bilimler',
  'Ekonomi / Finans',
  'İşletme / Yönetim Bilimleri',
  'Sosyal Bilimler',
  'Mühendislik',
  'Mimarlık ve Tasarım',
  'Sanat, Yaratıcı Alanlar',
  'Dil Bilimleri',
  'Tıp ve Sağlık Bilimleri',
  'Hukuk',
  'Eğitim Bilimleri',
  'Medya ve İletişim',
  'Spor Bilimleri',
  'Havacılık',
  'Fen Bilimleri',
] as const;

interface ResearchResult {
  id: string;
  universityId: string;
  universityName: string;
  programName: string;
  level: 'Lisans' | 'Master';
  faculty: string;
  duration: string;
  tuition: string;
  tuitionBudgetRange?: string;
  tuitionCurrency?: string;
  language: string;
  applicationStatus: string;
  sourceUrl: string;
  matchedDepartments?: string[];
  matchStatus?: MatchStatus;
  matchNotes?: string;
  degree: string;
  durationYears: number | null;
  placementYear: boolean;
  internship: boolean;
  studyAbroad: boolean;
  foundationRequired: boolean;
  portfolioRequired: boolean;
  deliveryMode: string;
}

type UniversityOption = {
  id: string;
  name: string;
};

type UniversityResearchApiResponse = UniversityResearchResult[] | {
  success?: boolean;
  data?: UniversityResearchResult[];
  programs?: UniversityResearchResult[];
  error?: string;
  json?: unknown;
  output?: unknown;
};

type UniversityResearchResult = {
  program_name?: string;
  degree?: string;
  degree_type?: string;
  faculty_or_school?: string;
  duration?: string;
  tuition_fee?: string;
  language_requirement?: string;
  notes?: string;
  url?: string;
  source_url?: string;
  level?: 'undergraduate' | 'master';
  program_level?: 'undergraduate' | 'master';
  matched_departments?: string[];
  match_status?: MatchStatus;
  match_notes?: string;
  tuition_budget_range?: string;
  tuition_currency?: string;
  duration_years?: number | null;
  placement_year?: boolean;
  internship?: boolean;
  study_abroad?: boolean;
  foundation_required?: boolean;
  portfolio_required?: boolean;
  delivery_mode?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonString(value: string) {
  try {
    const normalizedValue = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(normalizedValue);
  } catch {
    return value;
  }
}

function normalizeUniversityResearchPayload(payload: unknown): UniversityResearchResult[] {
  const parsedPayload = typeof payload === 'string' ? parseJsonString(payload) : payload;

  if (Array.isArray(parsedPayload)) {
    if (parsedPayload.length === 1 && isRecord(parsedPayload[0]) && ('data' in parsedPayload[0] || 'success' in parsedPayload[0] || 'json' in parsedPayload[0] || 'output' in parsedPayload[0])) {
      return normalizeUniversityResearchPayload(parsedPayload[0]);
    }

    return parsedPayload as UniversityResearchResult[];
  }

  if (isRecord(parsedPayload)) {
    if (parsedPayload.success === false) {
      throw new Error(typeof parsedPayload.error === 'string' ? parsedPayload.error : 'Üniversite araştırma isteği başarısız oldu.');
    }

    if (Array.isArray(parsedPayload.data)) {
      return parsedPayload.data as UniversityResearchResult[];
    }

    if (Array.isArray(parsedPayload.programs)) {
      return parsedPayload.programs as UniversityResearchResult[];
    }

    if (typeof parsedPayload.data === 'string' || isRecord(parsedPayload.data)) {
      return normalizeUniversityResearchPayload(parsedPayload.data);
    }

    if ('json' in parsedPayload) {
      return normalizeUniversityResearchPayload(parsedPayload.json);
    }

    if ('output' in parsedPayload) {
      return normalizeUniversityResearchPayload(parsedPayload.output);
    }
  }

  throw new Error('Üniversite araştırma cevabı beklenen formatta değil. Beklenen format: { success: true, data: [...] }.');
}

async function getEdgeFunctionErrorMessage(error: unknown) {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const payload = await error.context.clone().json();
      if (isRecord(payload) && typeof payload.error === 'string') {
        return payload.error;
      }
    } catch {
      // Fall through to the SDK error message when the response is not JSON.
    }
  }

  return error instanceof Error ? error.message : 'Üniversite araştırma isteği başarısız oldu.';
}

function sanitizeMatchedDepartments(departments: string[] | undefined, validDepartmentNames: string[]) {
  if (!departments || validDepartmentNames.length === 0) return [];

  const validNames = new Set(validDepartmentNames.map((department) => department.toLocaleLowerCase('tr')));
  const uniqueDepartments = new Set<string>();

  departments.forEach((department) => {
    const trimmedDepartment = department.trim();
    if (trimmedDepartment && validNames.has(trimmedDepartment.toLocaleLowerCase('tr'))) {
      const canonicalDepartment = validDepartmentNames.find((name) => name.toLocaleLowerCase('tr') === trimmedDepartment.toLocaleLowerCase('tr')) || trimmedDepartment;
      uniqueDepartments.add(canonicalDepartment);
    }
  });

  return Array.from(uniqueDepartments).slice(0, maxMatchedDepartments);
}

function formatDurationYears(durationYears: number | null, fallbackDuration: string) {
  return durationYears ? `${durationYears} yıl` : fallbackDuration;
}

function formatBooleanValue(value: boolean) {
  return value ? 'Evet' : 'Hayır';
}

function mapResearchResultToUI(
  result: UniversityResearchResult,
  universityId: string,
  universityName: string,
  validDepartmentNames: string[],
): ResearchResult {
  const programName = result.program_name || 'İsimsiz Program';
  const programLevel = result.level || result.program_level || 'undergraduate';
  const sanitizedDepartments = sanitizeMatchedDepartments(result.matched_departments, validDepartmentNames);
  const matchedDepartments = result.match_status === 'needs_manual_review' ? [] : sanitizedDepartments;
  const matchStatus: MatchStatus = matchedDepartments.length > 0 ? 'matched' : 'needs_manual_review';

  return {
    id: crypto.randomUUID(),
    universityId,
    universityName,
    programName,
    level: programLevel === 'undergraduate' ? 'Lisans' : 'Master',
    faculty: result.faculty_or_school || result.degree || result.degree_type || 'Belirtilmemiş',
    duration: result.duration || '-',
    tuition: result.tuition_fee || '-',
    tuitionBudgetRange: result.tuition_budget_range || '',
    tuitionCurrency: result.tuition_currency || '',
    language: result.language_requirement || '-',
    applicationStatus: matchStatus === 'matched' ? 'Eşleşme onaylı' : 'Manuel kontrol gerekli',
    sourceUrl: result.source_url || result.url || '#',
    matchedDepartments,
    matchStatus,
    matchNotes: result.match_notes || 'Güvenli bölüm eşleşmesi bulunamadı; manuel kontrol gerekli.',
    degree: result.degree || result.degree_type || '-',
    durationYears: result.duration_years ?? null,
    placementYear: Boolean(result.placement_year),
    internship: Boolean(result.internship),
    studyAbroad: Boolean(result.study_abroad),
    foundationRequired: Boolean(result.foundation_required),
    portfolioRequired: Boolean(result.portfolio_required),
    deliveryMode: result.delivery_mode || '-',
  };
}

function getResearchResultSortValue(result: ResearchResult, key: SortKey) {
  switch (key) {
    case 'matchedDepartments':
      return (result.matchedDepartments || []).join(', ');
    case 'matchStatus':
      return result.matchStatus === 'matched' ? 'Eşleşti' : 'Manuel kontrol';
    case 'tuition':
      return [result.tuitionBudgetRange, result.tuitionCurrency].filter(Boolean).join(' ');
    default:
      return String(result[key] || '');
  }
}

const UniversityResearch: React.FC = () => {
  const [universityName, setUniversityName] = useState('');
  const [programLevel, setProgramLevel] = useState<ProgramLevel>('all');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [matchStatusFilter, setMatchStatusFilter] = useState<MatchStatusFilter>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [isResearching, setIsResearching] = useState(false);
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [universityOptions, setUniversityOptions] = useState<UniversityOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [budgetRanges, setBudgetRanges] = useState<BudgetRange[]>([]);
  const [selectedBudgetRange, setSelectedBudgetRange] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('GBP');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [detailResultId, setDetailResultId] = useState<string | null>(null);
  const [temporaryDepartments, setTemporaryDepartments] = useState<string[]>([]);

  const selectedResults = results.filter((result) => selectedResultIds.includes(result.id));
  const matchedResults = results.filter((result) => result.matchStatus === 'matched');
  const manualReviewResults = results.filter((result) => result.matchStatus !== 'matched');
  const filteredResults = matchStatusFilter === 'all'
    ? results
    : results.filter((result) => result.matchStatus === matchStatusFilter);
  const sortedFilteredResults = sortConfig
    ? [...filteredResults].sort((first, second) => {
        const firstValue = getResearchResultSortValue(first, sortConfig.key);
        const secondValue = getResearchResultSortValue(second, sortConfig.key);
        const sortResult = firstValue.localeCompare(secondValue, 'tr', { numeric: true, sensitivity: 'base' });

        return sortConfig.direction === 'asc' ? sortResult : -sortResult;
      })
    : filteredResults;
  const filteredMatchedResults = filteredResults.filter((result) => result.matchStatus === 'matched');
  const editingResult = results.find((result) => result.id === editingResultId);
  const detailResult = results.find((item) => item.id === detailResultId);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const renderSortableHeader = (key: SortKey, label: string) => {
    const isActive = sortConfig?.key === key;

    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 font-black text-slate-500 transition hover:text-teal-700"
      >
        <span>{label}</span>
        <span className={`text-[10px] ${isActive ? 'text-teal-700' : 'text-slate-300'}`}>
          {isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    );
  };

  useEffect(() => {
    const loadOptions = async () => {
      setIsLoadingUniversities(true);
      try {
        const [universities, departments, budgets] = await Promise.all([
          universityService.getAll(),
          mainDegreeService.getAll(),
          systemService.getBudgetRangesRaw(),
        ]);
        const options = universities
          .filter((university) => university.id && university.name)
          .map((university) => ({ id: university.id, name: university.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        setUniversityOptions(options);
        setDepartmentOptions(Array.from(new Set(departments.map((department) => department.name).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, 'tr')));
        setBudgetRanges(budgets);
      } catch (error) {
        console.error('University research options failed to load', error);
        setUniversityOptions([]);
        setDepartmentOptions([]);
        setBudgetRanges([]);
      } finally {
        setIsLoadingUniversities(false);
      }
    };

    loadOptions();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUniversityName = universityName.trim();
    if (!trimmedUniversityName) {
      return;
    }

    setIsResearching(true);
    setSaveMessage('');

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured');
      }

      const selectedUniversity = universityOptions.find((university) => university.name.toLocaleLowerCase('tr') === trimmedUniversityName.toLocaleLowerCase('tr'));
      const selectedUniversityId = selectedUniversity?.id;

      if (!selectedUniversityId) {
        throw new Error('Lütfen listeden kayıtlı bir üniversite seçin.');
      }

      const { data, error } = await supabase.functions.invoke('university-research', {
        body: {
          university_id: selectedUniversityId,
          level: programLevel === 'master' ? 'master' : 'undergraduate',
        },
      });

      if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(error));
      }

      const payload = data as UniversityResearchApiResponse;
      console.debug('University research edge function response:', payload);
      const responseData = normalizeUniversityResearchPayload(payload);

      const uiResults = responseData.map((result) => mapResearchResultToUI(
        result,
        selectedUniversityId,
        selectedUniversity.name,
        departmentOptions,
      ));
      setResults(uiResults);
      setSelectedResultIds(uiResults.filter((result) => result.matchStatus === 'matched').map((result) => result.id));
    } catch (error) {
      console.error('University research request failed', error);
      setResults([]);
      setSelectedResultIds([]);
      setSaveMessage(error instanceof Error ? error.message : 'Üniversite araştırma isteği başarısız oldu.');
    } finally {
      setIsResearching(false);
    }
  };

  const toggleResultSelection = (id: string) => {
    const result = results.find((item) => item.id === id);
    if (result?.matchStatus !== 'matched') return;

    setSelectedResultIds((prev) => prev.includes(id) ? prev.filter((resultId) => resultId !== id) : [...prev, id]);
  };

  const toggleAllResults = () => {
    const matchedResultIds = filteredMatchedResults.map((result) => result.id);
    setSelectedResultIds((prev) => matchedResultIds.every((id) => prev.includes(id))
      ? prev.filter((id) => !matchedResultIds.includes(id))
      : Array.from(new Set([...prev, ...matchedResultIds])));
  };

  const updateResultDepartments = (id: string, selectedDepartments: string[]) => {
    const limitedDepartments = Array.from(new Set(selectedDepartments)).slice(0, maxMatchedDepartments);

    setResults((prev) => prev.map((result) => {
      if (result.id !== id) return result;

      const matchStatus: MatchStatus = limitedDepartments.length > 0 ? 'matched' : 'needs_manual_review';

      return {
        ...result,
        matchedDepartments: limitedDepartments,
        matchStatus,
        applicationStatus: matchStatus === 'matched' ? 'Eşleşme onaylı' : 'Manuel kontrol gerekli',
        matchNotes: limitedDepartments.length > 0
          ? 'Manuel olarak onaylandı. Seçim yalnızca bu ekranın state içinde güncellendi.'
          : 'Bölüm eşleşmesi kaldırıldı; manuel kontrol gerekli.',
      };
    }));

    setSelectedResultIds((prev) => limitedDepartments.length > 0 ? prev : prev.filter((resultId) => resultId !== id));
  };

  const applyBudgetToSelectedResults = () => {
    if (selectedResultIds.length === 0) {
      setSaveMessage('Eğitim bütçesi atamak için en az bir program seçin.');
      return;
    }

    if (!selectedBudgetRange) {
      setSaveMessage('Lütfen uygulanacak bütçe aralığını seçin.');
      return;
    }

    setResults((prev) => prev.map((result) => selectedResultIds.includes(result.id)
      ? {
          ...result,
          tuitionBudgetRange: selectedBudgetRange,
          tuitionCurrency: selectedCurrency,
        }
      : result));
    setSaveMessage(`${selectedResultIds.length} seçili programa eğitim bütçesi atandı.`);
  };

  const openDepartmentMatchingModal = (result: ResearchResult) => {
    setEditingResultId(result.id);
    setTemporaryDepartments(result.matchedDepartments || []);
    console.log('Edit department matching:', result);
  };

  const closeDepartmentMatchingModal = () => {
    setEditingResultId(null);
    setTemporaryDepartments([]);
  };

  const saveDepartmentMatching = async () => {
    if (!editingResultId) return;
    if (!editingResult) return;

    try {
      if (temporaryDepartments.length > 0) {
        const { error } = await supabase
          .from('program_department_mapping_rules')
          .insert({
            program_name_pattern: editingResult.programName,
            matched_departments: temporaryDepartments,
          });

        if (error) throw error;
      }

      setResults((prev) => prev.map((item) => item.id === editingResultId
        ? {
            ...item,
            matchedDepartments: temporaryDepartments,
            matchStatus: temporaryDepartments.length > 0 ? 'matched' : 'needs_manual_review',
            matchNotes: temporaryDepartments.length > 0
              ? 'Manually corrected by user'
              : 'No department selected',
          }
        : item));

      setEditingResultId(null);
      setTemporaryDepartments([]);
      setSaveMessage(temporaryDepartments.length > 0 ? 'Manuel bölüm eşleştirme kuralı Supabase\'e kaydedildi.' : 'Bölüm eşleşmesi kaldırıldı.');
    } catch (error) {
      console.error('Department mapping rule insert failed', error);
      setSaveMessage(error instanceof Error ? error.message : 'Bölüm eşleştirme kuralı Supabase\'e kaydedilemedi.');
    }
  };

  const toggleTemporaryDepartment = (department: string) => {
    setTemporaryDepartments((prev) => {
      if (prev.includes(department)) {
        return prev.filter((item) => item !== department);
      }

      return [...prev, department].slice(0, maxMatchedDepartments);
    });
  };

  const exportToExcel = () => {
    if (selectedResults.length === 0) {
      alert('Excel indirmek için en az bir sonuç seçin.');
      return;
    }

    const rows = selectedResults.map((result) => ({
      'Üniversite': result.universityName,
      'Program': result.programName,
      'Seviye': result.level,
      'Eşleşen Bölümler': (result.matchedDepartments || []).join(', '),
      'Eşleşme Durumu': result.matchStatus === 'matched' ? 'Eşleşti' : 'Manuel Kontrol Gerekli',
      'Eşleşme Notu': result.matchNotes,
      'Fakülte / Okul': result.faculty,
      'Degree': result.degree,
      'Süre': formatDurationYears(result.durationYears, result.duration),
      'Ücret': result.tuitionBudgetRange || '',
      'Para Birimi': result.tuitionCurrency || '',
      'Dil Şartı': result.language,
      'Başvuru Notu': result.applicationStatus,
      'Kaynak': result.sourceUrl,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Araştırma Sonuçları');
    XLSX.writeFile(workbook, `UNIC_Universite_Arastirma_${Date.now()}.xlsx`);
  };

  const saveToSupabase = async () => {
    console.log('SAVE_CLICKED');
    console.log('selectedResultIds:', selectedResultIds);
    console.log('selectedResults:', selectedResults);
    setSaveSuccess(false);

    if (selectedResults.length === 0) {
      setSaveMessage('Lütfen önce kaydetmek için program seçin.');
      return;
    }

    setIsSaving(true);
    setSaveMessage('Seçili programlar Supabase\'e kaydediliyor...');

    try {
      for (const result of selectedResults) {
        const assignedTuitionRange = [result.tuitionBudgetRange, result.tuitionCurrency].filter(Boolean).join(' ').trim();
        const updatePayload = {
          is_approved: true,
          approved_at: new Date().toISOString(),
          tuition_range: assignedTuitionRange || null,
          tuition_budget_range: result.tuitionBudgetRange || null,
          tuition_currency: result.tuitionCurrency || null,
        };
        let { data, error } = await supabase
          .from('university_programs')
          .update(updatePayload)
          .eq('university_id', result.universityId)
          .eq('url', result.sourceUrl)
          .select();

        if (!error && (!data || data.length === 0)) {
          const fallbackUpdate = await supabase
            .from('university_programs')
            .update(updatePayload)
            .eq('university_id', result.universityId)
            .eq('source_url', result.sourceUrl)
            .select();
          data = fallbackUpdate.data;
          error = fallbackUpdate.error;
        }

        if (!error && (!data || data.length === 0)) {
          const fallbackUpdate = await supabase
            .from('university_programs')
            .update(updatePayload)
            .eq('university_id', result.universityId)
            .eq('name', result.programName)
            .select();
          data = fallbackUpdate.data;
          error = fallbackUpdate.error;
        }

        console.log('SAVE_UPDATE_RESULT:', {
          resultId: result.id,
          universityId: result.universityId,
          sourceUrl: result.sourceUrl,
          assignedTuitionRange,
          tuitionBudgetRange: result.tuitionBudgetRange,
          tuitionCurrency: result.tuitionCurrency,
          data,
          error,
        });

        if (error) {
          console.error('SAVE_ERROR:', error);
          setSaveSuccess(false);
          setSaveMessage(`Kaydetme hatası: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          setSaveSuccess(false);
          setSaveMessage(`Kaydedilecek program bulunamadı: ${result.programName}`);
          return;
        }
      }

      setSaveSuccess(true);
      setSaveMessage('Seçili programlar Supabase\'e kaydedildi.');
    } catch (error) {
      console.error('University program approval update failed', error);
      setSaveSuccess(false);
      setSaveMessage(error instanceof Error ? error.message : 'Programlar Supabase\'de onaylanamadı.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-100">
              <Sparkles className="h-4 w-4" />
              AI Agent Hazırlık Modülü
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Üniversite Araştırma</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
              Üniversite adı girerek lisans ve master programlarını araştırın. Sonuçları kontrol edip Excel olarak indirebilir veya Supabase'e kaydedebilirsiniz.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200 backdrop-blur">
            <div className="text-3xl font-black text-white">{results.length}</div>
            <div>Sonuç</div>
            {results.length > 0 && (
              <div className="mt-2 text-xs text-teal-100">
                {matchedResults.length} onaylı, {manualReviewResults.length} manuel kontrol
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px_auto] lg:items-end">
          <div>
            <label htmlFor="university-name" className="mb-2 block text-sm font-bold text-slate-700">
              Üniversite Adı
            </label>
            <input
              id="university-name"
              list="university-name-options"
              value={universityName}
              onChange={(event) => setUniversityName(event.target.value)}
              required
              placeholder={isLoadingUniversities ? 'Üniversiteler yükleniyor...' : 'Örn: University of Manchester'}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
            <datalist id="university-name-options">
              {universityOptions.map((university) => (
                <option key={university.id} value={university.name} />
              ))}
            </datalist>
            <p className="mt-2 text-xs text-slate-500">
              {isLoadingUniversities ? 'Data > Üniversiteler ve bölüm tanımları yükleniyor.' : `${universityOptions.length} üniversite, ${departmentOptions.length} bölüm tanımı listelendi.`}
            </p>
          </div>

          <div>
            <label htmlFor="program-level" className="mb-2 block text-sm font-bold text-slate-700">
              Program Seviyesi
            </label>
            <select
              id="program-level"
              value={programLevel}
              onChange={(event) => setProgramLevel(event.target.value as ProgramLevel)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
            >
              {Object.entries(programLevelLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isResearching}
            className="inline-flex h-[46px] items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isResearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Araştır
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Araştırma Sonuçları</h2>
            <p className="mt-1 text-sm text-slate-500">
              Her program için en fazla 3 ana bölüm seçebilirsiniz. Seçimler sadece bu ekranın state içinde güncellenir; kalıcı kayıt yapılmaz.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
              <span className="whitespace-nowrap">Durum</span>
              <select
                value={matchStatusFilter}
                onChange={(event) => setMatchStatusFilter(event.target.value as MatchStatusFilter)}
                className="bg-transparent text-sm font-bold text-slate-800 outline-none"
              >
                {Object.entries(matchStatusFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={exportToExcel}
              disabled={results.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Excel İndir
            </button>
            <button
              type="button"
              onClick={saveToSupabase}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition ${saveSuccess ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Database className="h-4 w-4" />}
              {isSaving ? 'Kaydediliyor...' : saveSuccess ? 'Kaydedildi' : 'Supabase\'e Kaydet'}
            </button>
          </div>
        </div>

        {saveMessage && (
          <div className={`mx-6 mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${isSaving ? 'border-sky-100 bg-sky-50 text-sky-800' : saveMessage.includes('kaydedilemez') || saveMessage.includes('başarısız') || saveMessage.includes('Lütfen') || saveMessage.includes('hatası') ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-teal-100 bg-teal-50 text-teal-800'}`}>
            {isSaving ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : saveMessage.includes('kaydedilemez') || saveMessage.includes('başarısız') || saveMessage.includes('Lütfen') || saveMessage.includes('hatası') ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{saveMessage}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">Seçili Programlara Eğitim Bütçesi Ata</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Seçili {selectedResults.length} programa aynı bütçe aralığı ve para birimi uygulanır.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_140px_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Bütçe Aralığı</span>
                  <select
                    value={selectedBudgetRange}
                    onChange={(event) => setSelectedBudgetRange(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  >
                    <option value="">Bütçe seç</option>
                    {budgetRanges.map((budget) => (
                      <option key={budget.id} value={budget.label}>{budget.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Para Birimi</span>
                  <select
                    value={selectedCurrency}
                    onChange={(event) => setSelectedCurrency(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  >
                    {tuitionCurrencyOptions.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={applyBudgetToSelectedResults}
                  disabled={selectedResults.length === 0 || !selectedBudgetRange}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Seçilenlere Uygula
                </button>
              </div>
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Henüz araştırma yapılmadı</h3>
            <p className="mt-2 text-sm text-slate-500">Üniversite adı girip program seviyesini seçerek dummy sonuçları oluşturun.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={filteredMatchedResults.length > 0 && filteredMatchedResults.every((result) => selectedResultIds.includes(result.id))}
                      onChange={toggleAllResults}
                      disabled={filteredMatchedResults.length === 0}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </th>
                  <th className="px-6 py-4">{renderSortableHeader('programName', 'Program')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('matchedDepartments', 'Bölüm Eşleşmesi')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('degree', 'Degree')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('durationYears', 'Süre')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('tuition', 'Ücret')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('language', 'Dil Şartı')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('matchStatus', 'Eşleşme Durumu')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('applicationStatus', 'Not')}</th>
                  <th className="px-6 py-4">{renderSortableHeader('sourceUrl', 'Kaynak')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedFilteredResults.map((result) => (
                    <tr key={result.id} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedResultIds.includes(result.id)}
                          onChange={() => toggleResultSelection(result.id)}
                          disabled={result.matchStatus !== 'matched'}
                          title={result.matchStatus !== 'matched' ? 'Önce bölüm eşleşmesini manuel onaylayın.' : undefined}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{result.programName}</div>
                        <div className="text-xs text-slate-500">{result.universityName}</div>
                        <button
                          type="button"
                          onClick={() => setDetailResultId(result.id)}
                          className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                        >
                          Detay
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          multiple
                          value={result.matchedDepartments || []}
                          onChange={(event) => updateResultDepartments(
                            result.id,
                            Array.from(event.currentTarget.selectedOptions).map((option) => (option as HTMLOptionElement).value),
                          )}
                          disabled={departmentOptions.length === 0}
                          className="min-h-[82px] w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          {departmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(result.matchedDepartments || []).length > 0 ? (result.matchedDepartments || []).map((department) => (
                            <span key={department} className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700">
                              {department}
                            </span>
                          )) : (
                            <span className="text-xs font-semibold text-amber-600">Bölüm seçin</span>
                          )}
                        </div>
                        <div className="mt-1 text-[10px] font-semibold text-slate-400">
                          {(result.matchedDepartments || []).length}/{maxMatchedDepartments} seçildi
                        </div>
                        <button
                          type="button"
                          onClick={() => openDepartmentMatchingModal(result)}
                          className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                        >
                          Eşleştir / Düzenle
                        </button>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{result.degree}</td>
                      <td className="px-6 py-4 text-slate-600">{formatDurationYears(result.durationYears, result.duration)}</td>
                      <td className="px-6 py-4">
                        <div className="min-w-48">
                          <div className="font-semibold text-slate-800">
                            {result.tuitionBudgetRange
                              ? `${result.tuitionBudgetRange} ${result.tuitionCurrency || ''}`.trim()
                              : 'Belirlenmedi'}
                          </div>
                          {result.tuition !== '-' && (
                            <span className="text-[10px] font-semibold text-slate-400">Kaynak: {result.tuition}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{result.language}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${result.matchStatus === 'matched' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                          {result.matchStatus === 'matched' ? 'Eşleşti' : 'Manuel kontrol'}
                        </span>
                        <div className="mt-2 max-w-[220px] text-xs leading-5 text-slate-500">{result.matchNotes}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{result.applicationStatus}</td>
                      <td className="px-6 py-4">
                        <a
                          href={result.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-800"
                        >
                          Aç
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm font-semibold text-slate-500">
                      Seçili eşleşme durumunda sonuç bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Program Detayı</h3>
                <p className="mt-1 text-sm text-slate-500">{detailResult.programName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailResultId(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>

            <div className="grid gap-3 py-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Degree</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{detailResult.degree}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Süre</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatDurationYears(detailResult.durationYears, detailResult.duration)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Danışman Bütçe Aralığı</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {[detailResult.tuitionBudgetRange, detailResult.tuitionCurrency].filter(Boolean).join(' ') || '-'}
                </p>
                {detailResult.tuition !== '-' && (
                  <p className="mt-1 text-xs font-semibold text-slate-400">Kaynak ücret: {detailResult.tuition}</p>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Placement</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatBooleanValue(detailResult.placementYear)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Internship</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatBooleanValue(detailResult.internship)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Yurtdışı Yılı</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatBooleanValue(detailResult.studyAbroad)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Foundation</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatBooleanValue(detailResult.foundationRequired)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Portfolio</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatBooleanValue(detailResult.portfolioRequired)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Delivery Mode</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{detailResult.deliveryMode}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Bölüm Eşleşmesi</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {(detailResult.matchedDepartments || []).length > 0 ? (detailResult.matchedDepartments || []).join(', ') : 'Bölüm eşleşmesi yok'}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{detailResult.matchNotes}</p>
            </div>
          </div>
        </div>
      )}

      {editingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Bölüm Eşleştirme</h3>
                <p className="mt-1 text-sm text-slate-500">{editingResult.programName}</p>
              </div>
              <button
                type="button"
                onClick={closeDepartmentMatchingModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>

            <div className="py-5">
              <p className="text-sm font-bold text-slate-700">Geçici seçili bölümler</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {temporaryDepartments.length > 0 ? temporaryDepartments.map((department) => (
                  <span key={department} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                    {department}
                  </span>
                )) : (
                  <span className="text-sm text-slate-500">Henüz bölüm seçilmedi.</span>
                )}
              </div>
              <div className="mt-5 grid max-h-72 gap-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
                {UNIC_MAIN_DEPARTMENTS.map((department) => {
                  const isChecked = temporaryDepartments.includes(department);
                  const isDisabled = !isChecked && temporaryDepartments.length >= maxMatchedDepartments;

                  return (
                    <label
                      key={department}
                      className={`flex items-center gap-2 rounded-xl border bg-white p-3 text-xs font-bold transition ${isChecked ? 'border-teal-200 text-teal-700' : 'border-slate-100 text-slate-700'} ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-teal-200 hover:text-teal-700'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => toggleTemporaryDepartment(department)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{department}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {temporaryDepartments.length}/{maxMatchedDepartments} bölüm seçildi
              </p>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={saveDepartmentMatching}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityResearch;
