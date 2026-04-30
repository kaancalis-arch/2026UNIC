import React, { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Database, Download, ExternalLink, Loader2, Search, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ProgramLevel, UniversityProgramResearchResult } from '../agents/universityProgramResearchAgent';
import { universityService } from '../services/universityService';

const programLevelLabels: Record<ProgramLevel, string> = {
  all: 'Tümü',
  undergraduate: 'Sadece Lisans',
  master: 'Sadece Master',
};

interface ResearchResult {
  id: string;
  universityName: string;
  programName: string;
  level: 'Lisans' | 'Master';
  faculty: string;
  duration: string;
  tuition: string;
  language: string;
  applicationStatus: string;
  sourceUrl: string;
}

type UniversityResearchApiResponse = {
  success: boolean;
  data: UniversityProgramResearchResult[];
  error?: string;
};

function mapAgentToUI(result: UniversityProgramResearchResult): ResearchResult {
  return {
    id: crypto.randomUUID(),
    universityName: result.university_name,
    programName: result.program_name,
    level: result.program_level === 'undergraduate' ? 'Lisans' : 'Master',
    faculty: result.faculty_or_school || 'Belirtilmemiş',
    duration: result.duration || '-',
    tuition: result.tuition_fee || '-',
    language: result.language_requirement || '-',
    applicationStatus: result.notes || 'Kontrol gerekli',
    sourceUrl: result.source_url || '#',
  };
}

const UniversityResearch: React.FC = () => {
  const [universityName, setUniversityName] = useState('');
  const [programLevel, setProgramLevel] = useState<ProgramLevel>('all');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [isResearching, setIsResearching] = useState(false);
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [universityOptions, setUniversityOptions] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState('');

  const selectedResults = results.filter((result) => selectedResultIds.includes(result.id));

  useEffect(() => {
    const loadUniversityOptions = async () => {
      setIsLoadingUniversities(true);
      try {
        const universities = await universityService.getAll();
        const names = Array.from(new Set(universities.map((university) => university.name).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, 'tr'));
        setUniversityOptions(names);
      } catch (error) {
        console.error('University research options failed to load', error);
        setUniversityOptions([]);
      } finally {
        setIsLoadingUniversities(false);
      }
    };

    loadUniversityOptions();
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
      const response = await fetch('/api/university-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          university_name: trimmedUniversityName,
          program_level: programLevel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Üniversite araştırma isteği başarısız oldu: ${response.status}`);
      }

      const payload = await response.json() as UniversityResearchApiResponse;
      if (!payload.success) {
        throw new Error(payload.error || 'Üniversite araştırma isteği başarısız oldu.');
      }

      const uiResults = payload.data.map(mapAgentToUI);
      setResults(uiResults);
      setSelectedResultIds(uiResults.map((result) => result.id));
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
    setSelectedResultIds((prev) => prev.includes(id) ? prev.filter((resultId) => resultId !== id) : [...prev, id]);
  };

  const toggleAllResults = () => {
    setSelectedResultIds((prev) => prev.length === results.length ? [] : results.map((result) => result.id));
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
      'Fakülte / Okul': result.faculty,
      'Süre': result.duration,
      'Ücret': result.tuition,
      'Dil Şartı': result.language,
      'Başvuru Notu': result.applicationStatus,
      'Kaynak': result.sourceUrl,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Araştırma Sonuçları');
    XLSX.writeFile(workbook, `UNIC_Universite_Arastirma_${Date.now()}.xlsx`);
  };

  const saveToSupabase = () => {
    if (selectedResults.length === 0) {
      setSaveMessage('Supabase kaydı için en az bir sonuç seçin.');
      return;
    }

    setSaveMessage(`${selectedResults.length} sonuç Supabase'e kaydedilmek üzere hazırlandı. Bu aşamada gerçek kayıt yapılmaz.`);
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
            <div>Dummy sonuç</div>
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
              {universityOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="mt-2 text-xs text-slate-500">
              {isLoadingUniversities ? 'Data > Üniversiteler listesi yükleniyor.' : `${universityOptions.length} üniversite listelendi.`}
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
              AI bağlantısı eklenene kadar tablo dummy data ile doldurulur. Seçili kayıtlar Excel ve Supabase aksiyonlarına dahil edilir.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
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
              disabled={results.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Database className="h-4 w-4" />
              Supabase'e Kaydet
            </button>
          </div>
        </div>

        {saveMessage && (
          <div className="mx-6 mt-6 flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{saveMessage}</span>
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
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedResultIds.length === results.length}
                      onChange={toggleAllResults}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </th>
                  <th className="px-6 py-4 font-black">Program</th>
                  <th className="px-6 py-4 font-black">Seviye</th>
                  <th className="px-6 py-4 font-black">Fakülte / Okul</th>
                  <th className="px-6 py-4 font-black">Süre</th>
                  <th className="px-6 py-4 font-black">Ücret</th>
                  <th className="px-6 py-4 font-black">Dil Şartı</th>
                  <th className="px-6 py-4 font-black">Not</th>
                  <th className="px-6 py-4 font-black">Kaynak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result) => (
                    <tr key={result.id} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedResultIds.includes(result.id)}
                          onChange={() => toggleResultSelection(result.id)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{result.programName}</div>
                        <div className="text-xs text-slate-500">{result.universityName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${result.level === 'Lisans' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                          {result.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{result.faculty}</td>
                      <td className="px-6 py-4 text-slate-600">{result.duration}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{result.tuition}</td>
                      <td className="px-6 py-4 text-slate-600">{result.language}</td>
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversityResearch;
