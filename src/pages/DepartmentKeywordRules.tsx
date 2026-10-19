import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Edit2, Loader2, Plus, RefreshCw, Search, TestTube2, Trash2, Upload, X, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';
import { containsMatchPhrase } from '../lib/departmentMatching';

type DepartmentKeywordRule = {
  id: string;
  keyword: string;
  matched_department: string;
  department_name: string | null;
  major_keywords: string[] | null;
  required_match_keywords: string[] | null;
  rule_notes: string | null;
  priority: number | null;
  is_active: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RuleForm = {
  keyword: string;
  matched_department: string;
  department_name: string;
  major_keywords: string;
  required_match_keywords: string;
  rule_notes: string;
  priority: string;
  is_active: boolean;
  notes: string;
};

type ImportReportStatus = 'created' | 'updated' | 'unchanged' | 'failed';

type ImportReportEntry = {
  rowNumber: number;
  departmentName: string;
  previousValue: string;
  nextValue: string;
  status: ImportReportStatus;
  error?: string;
};

type ImportReport = {
  createdAt: string;
  fileName: string;
  entries: ImportReportEntry[];
};

const IMPORT_STATUS_LABELS: Record<ImportReportStatus, string> = {
  created: 'Eklendi',
  updated: 'Güncellendi',
  unchanged: 'Değişmedi',
  failed: 'Başarısız',
};

const IMPORT_STATUS_STYLES: Record<ImportReportStatus, string> = {
  created: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  updated: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unchanged: 'border-slate-200 bg-slate-50 text-slate-600',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

const emptyForm: RuleForm = {
  keyword: '',
  matched_department: '',
  department_name: '',
  major_keywords: '',
  required_match_keywords: '',
  rule_notes: '',
  priority: '100',
  is_active: true,
  notes: '',
};

const parseCommaSeparated = (value: string) => value
  .split(/[,;/]/)
  .map((item) => item.trim())
  .filter(Boolean);

const formatArrayForInput = (value: string[] | null) => (value || []).join(', ');

const formatDate = (value: string | null) => {
  if (!value) return '-';

  return new Date(value).toLocaleString('tr-TR');
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

const getExcelCell = (row: Record<string, unknown>, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalize);
  const key = Object.keys(row).find((column) => normalizedAliases.includes(normalize(column)));
  return key === undefined ? undefined : row[key];
};

const parseExcelBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  return ['evet', 'true', '1', 'aktif'].includes(normalize(String(value)));
};

const formatRuleSummary = (rule: Pick<DepartmentKeywordRule, 'keyword' | 'matched_department' | 'major_keywords' | 'required_match_keywords' | 'priority' | 'is_active' | 'notes' | 'rule_notes'>) => [
  `Keyword: ${rule.keyword || '-'}`,
  `Bölüm: ${rule.matched_department || '-'}`,
  `Major: ${(rule.major_keywords || []).join(', ') || '-'}`,
  `Zorunlu: ${(rule.required_match_keywords || []).join(', ') || '-'}`,
  `Öncelik: ${rule.priority ?? 100}`,
  `Durum: ${(rule.is_active ?? true) ? 'Aktif' : 'Pasif'}`,
  `Not: ${rule.notes || '-'}`,
  `Notlar: ${rule.rule_notes || '-'}`,
].join('\n');

const DepartmentKeywordRules: React.FC = () => {
  const [rules, setRules] = useState<DepartmentKeywordRule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [testProgramName, setTestProgramName] = useState('Computer Engineering with AI');
  const [testMatches, setTestMatches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DepartmentKeywordRule | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRules = rules.filter((rule) => {
    const search = searchTerm.trim().toLocaleLowerCase('tr');
    if (!search) return true;

    return rule.keyword.toLocaleLowerCase('tr').includes(search)
      || rule.matched_department.toLocaleLowerCase('tr').includes(search)
      || (rule.department_name || '').toLocaleLowerCase('tr').includes(search);
  });

  const loadRules = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('department_keyword_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('keyword', { ascending: true });

      if (error) throw error;

      setRules((data || []) as DepartmentKeywordRule[]);
    } catch (error) {
      console.error('Department keyword rules failed to load', error);
      setMessage(error instanceof Error ? error.message : 'Bölüm eşleşme kuralları yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: DepartmentKeywordRule) => {
    setEditingRule(rule);
    setForm({
      keyword: rule.keyword,
      matched_department: rule.matched_department,
      department_name: rule.department_name || '',
      major_keywords: formatArrayForInput(rule.major_keywords),
      required_match_keywords: formatArrayForInput(rule.required_match_keywords),
      rule_notes: rule.rule_notes || '',
      priority: String(rule.priority ?? 100),
      is_active: rule.is_active ?? true,
      notes: rule.notes || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const departmentName = form.department_name.trim();
    const majorKeywords = parseCommaSeparated(form.major_keywords);
    const requiredMatchKeywords = parseCommaSeparated(form.required_match_keywords);
    const keyword = form.keyword.trim() || majorKeywords[0] || requiredMatchKeywords[0] || departmentName;
    const matchedDepartment = form.matched_department.trim() || departmentName;
    const priority = Number(form.priority || 100);

    if (!departmentName) {
      setMessage('Department name zorunludur.');
      return;
    }

    setIsSaving(true);
    setMessage('');

    const payload = {
      keyword,
      matched_department: matchedDepartment,
      department_name: departmentName,
      major_keywords: majorKeywords,
      required_match_keywords: requiredMatchKeywords,
      rule_notes: form.rule_notes.trim() || null,
      priority: Number.isFinite(priority) ? priority : 100,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = editingRule
        ? await supabase.from('department_keyword_rules').update(payload).eq('id', editingRule.id)
        : await supabase.from('department_keyword_rules').upsert(payload, { onConflict: 'department_name' });

      if (error) throw error;

      closeModal();
      await loadRules();
      setMessage(editingRule ? 'Kural güncellendi.' : 'Kural department_name üzerinden kaydedildi.');
    } catch (error) {
      console.error('Department keyword rule save failed', error);
      setMessage(error instanceof Error ? error.message : 'Kural kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRule = async (rule: DepartmentKeywordRule) => {
    if (!window.confirm(`"${rule.keyword}" kuralı silinsin mi?`)) return;

    setMessage('');

    try {
      const { error } = await supabase
        .from('department_keyword_rules')
        .delete()
        .eq('id', rule.id);

      if (error) throw error;

      await loadRules();
      setMessage('Kural silindi.');
    } catch (error) {
      console.error('Department keyword rule delete failed', error);
      setMessage(error instanceof Error ? error.message : 'Kural silinemedi.');
    }
  };

  const toggleRuleStatus = async (rule: DepartmentKeywordRule) => {
    setMessage('');

    try {
      const { error } = await supabase
        .from('department_keyword_rules')
        .update({
          is_active: !(rule.is_active ?? true),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id);

      if (error) throw error;

      await loadRules();
      setMessage('Kural durumu güncellendi.');
    } catch (error) {
      console.error('Department keyword rule status update failed', error);
      setMessage(error instanceof Error ? error.message : 'Kural durumu güncellenemedi.');
    }
  };

  const exportRules = () => {
    const rows = filteredRules.map((rule) => ({
      Keyword: rule.keyword,
      Bölüm: rule.matched_department,
      'Bölüm Adı': rule.department_name || '',
      'Major Keywords': (rule.major_keywords || []).join(', '),
      'Zorunlu Eşleşme Kelimeleri': (rule.required_match_keywords || []).join(', '),
      Öncelik: rule.priority ?? 100,
      Aktif: rule.is_active ?? true ? 'Evet' : 'Hayır',
      Not: rule.notes || '',
      Notlar: rule.rule_notes || '',
      'Oluşturulma Tarihi': formatDate(rule.created_at),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bölüm Eşleşme Kuralları');
    XLSX.writeFile(workbook, `UNIC_Bolum_Eslesme_Kurallari_${Date.now()}.xlsx`);
  };

  const importRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Excel'deki bölüm eşleşme kuralları mevcut verilerle karşılaştırılarak güncellenecek. Devam edilsin mi?")) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      setIsImporting(true);
      setMessage('');

      try {
        const workbook = XLSX.read(new Uint8Array(loadEvent.target?.result as ArrayBuffer), { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        const knownRules = new Map(rules.map((rule) => [normalize(rule.department_name || ''), rule]));
        const entries: ImportReportEntry[] = [];

        for (const [index, row] of rows.entries()) {
          const rowNumber = index + 2;
          const departmentName = String(getExcelCell(row, ['Bölüm Adı', 'Department Name', 'department_name']) || '').trim();

          if (!departmentName) {
            entries.push({
              rowNumber,
              departmentName: '-',
              previousValue: '-',
              nextValue: '-',
              status: 'failed',
              error: 'Bölüm Adı boş olamaz.',
            });
            continue;
          }

          const existing = knownRules.get(normalize(departmentName));
          const majorCell = getExcelCell(row, ['Major Keywords', 'major_keywords']);
          const requiredCell = getExcelCell(row, ['Zorunlu Eşleşme Kelimeleri', 'Required Match Keywords', 'required_match_keywords']);
          const priorityCell = getExcelCell(row, ['Öncelik', 'Priority', 'priority']);
          const parsedPriority = Number(priorityCell);
          const majorKeywords = majorCell === undefined ? (existing?.major_keywords || []) : parseCommaSeparated(String(majorCell));
          const requiredMatchKeywords = requiredCell === undefined ? (existing?.required_match_keywords || []) : parseCommaSeparated(String(requiredCell));
          const keywordCell = getExcelCell(row, ['Keyword', 'keyword']);
          const matchedDepartmentCell = getExcelCell(row, ['Bölüm', 'Matched Department', 'matched_department']);
          const notesCell = getExcelCell(row, ['Not', 'Notes', 'notes']);
          const ruleNotesCell = getExcelCell(row, ['Notlar', 'Rule Notes', 'rule_notes']);
          const activeCell = getExcelCell(row, ['Aktif', 'Active', 'is_active']);
          const payload = {
            keyword: String(keywordCell ?? existing?.keyword ?? '').trim() || majorKeywords[0] || requiredMatchKeywords[0] || departmentName,
            matched_department: String(matchedDepartmentCell ?? existing?.matched_department ?? '').trim() || departmentName,
            department_name: departmentName,
            major_keywords: majorKeywords,
            required_match_keywords: requiredMatchKeywords,
            rule_notes: ruleNotesCell === undefined ? (existing?.rule_notes || null) : String(ruleNotesCell).trim() || null,
            priority: priorityCell === undefined || !Number.isFinite(parsedPriority) ? (existing?.priority ?? 100) : parsedPriority,
            is_active: parseExcelBoolean(activeCell, existing?.is_active ?? true),
            notes: notesCell === undefined ? (existing?.notes || null) : String(notesCell).trim() || null,
            updated_at: new Date().toISOString(),
          };
          const previousValue = existing ? formatRuleSummary(existing) : '-';
          const nextValue = formatRuleSummary(payload);

          try {
            if (existing && previousValue === nextValue) {
              entries.push({ rowNumber, departmentName, previousValue, nextValue, status: 'unchanged' });
              continue;
            }

            const { data, error } = existing
              ? await supabase.from('department_keyword_rules').update(payload).eq('id', existing.id).select().single()
              : await supabase.from('department_keyword_rules').insert(payload).select().single();

            if (error) throw error;

            knownRules.set(normalize(departmentName), data as DepartmentKeywordRule);
            entries.push({
              rowNumber,
              departmentName,
              previousValue,
              nextValue,
              status: existing ? 'updated' : 'created',
            });
          } catch (error) {
            console.error('Department keyword rule row import failed', row, error);
            entries.push({
              rowNumber,
              departmentName,
              previousValue,
              nextValue,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Satır güncellenemedi.',
            });
          }
        }

        setImportReport({ createdAt: new Date().toISOString(), fileName: file.name, entries });
        await loadRules();
        setMessage(`${entries.filter((entry) => entry.status === 'updated').length} kural güncellendi, ${entries.filter((entry) => entry.status === 'created').length} kural eklendi.`);
      } catch (error) {
        console.error('Department keyword rules Excel import failed', error);
        setMessage(error instanceof Error ? error.message : 'Excel dosyası okunamadı.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportImportReport = () => {
    if (!importReport) return;

    const worksheet = XLSX.utils.json_to_sheet(importReport.entries.map((entry) => ({
      'Satır': entry.rowNumber,
      'Bölüm Adı': entry.departmentName,
      'Önceki': entry.previousValue,
      'Yeni': entry.nextValue,
      'Durum': IMPORT_STATUS_LABELS[entry.status],
      'Hata': entry.error || '',
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Güncelleme Raporu');
    XLSX.writeFile(workbook, `bolum_eslesme_kurallari_guncelleme_raporu_${new Date(importReport.createdAt).toISOString().split('T')[0]}.xlsx`);
  };

  const testRules = () => {
    const matchedDepartments = new Set<string>();

    rules
      .filter((rule) => rule.is_active ?? true)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
      .forEach((rule) => {
        const ruleKeywords = [
          rule.keyword,
          ...(rule.major_keywords || []),
          ...(rule.required_match_keywords || []),
        ];

        if (ruleKeywords.some((keyword) => containsMatchPhrase(testProgramName, keyword))) {
          matchedDepartments.add(rule.department_name || rule.matched_department);
        }
      });

    setTestMatches(Array.from(matchedDepartments));
  };

  const isErrorMessage = message.includes('zorunludur') || message.includes('yüklenemedi') || message.includes('kaydedilemedi') || message.includes('silinemedi') || message.includes('güncellenemedi');

  return (
    <div className="space-y-6 pb-20">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-100">
              <Zap className="h-4 w-4" />
              Sistem Tanımları
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Bölüm Eşleşme Kuralları</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Program isimlerinde geçen kelimelere göre otomatik bölüm eşleşmeleri yönetilir.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Yeni Kural Ekle
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={importRules}
              disabled={isImporting}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isImporting ? 'Yükleniyor...' : 'Excel Yükle'}
            </button>
            <button
              type="button"
              onClick={exportRules}
              disabled={filteredRules.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Excel Export
            </button>
            <button
              type="button"
              onClick={loadRules}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Yenile
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <TestTube2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Program Adı Testi</h2>
            <p className="text-sm text-slate-500">Aktif keyword kurallarını frontend tarafında test edin.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={testProgramName}
            onChange={(event) => setTestProgramName(event.target.value)}
            placeholder="Computer Engineering with AI"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={testRules}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <TestTube2 className="h-4 w-4" />
            Kuralları Test Et
          </button>
        </div>
        {testMatches.length > 0 && (
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Eşleşen Bölümler</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {testMatches.map((department) => (
                <span key={department} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-700 shadow-sm">
                  {department}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Kurallar</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredRules.length} kayıt listeleniyor.</p>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Bölüm adı veya keyword ara..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </div>

        {message && (
          <div className={`mx-6 mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${isErrorMessage ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-teal-100 bg-teal-50 text-teal-800'}`}>
            {isErrorMessage ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{message}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1540px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-4 font-black">Keyword</th>
                <th className="px-6 py-4 font-black">Bölüm</th>
                <th className="px-6 py-4 font-black">Bölüm Adı</th>
                <th className="px-6 py-4 font-black">Major Keywords</th>
                <th className="px-6 py-4 font-black">Zorunlu Eşleşme Kelimeleri</th>
                <th className="px-6 py-4 font-black">Öncelik</th>
                <th className="px-6 py-4 font-black">Aktif</th>
                <th className="px-6 py-4 font-black">Not</th>
                <th className="px-6 py-4 font-black">Notlar</th>
                <th className="px-6 py-4 font-black">Oluşturulma Tarihi</th>
                <th className="px-6 py-4 font-black">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-indigo-600" />
                    Kurallar yükleniyor...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">Kural bulunamadı.</td>
                </tr>
              ) : filteredRules.map((rule) => (
                <tr key={rule.id} className="transition hover:bg-slate-50/80">
                  <td className="px-6 py-4 font-bold text-slate-900">{rule.keyword}</td>
                  <td className="px-6 py-4 text-slate-700">{rule.matched_department}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{rule.department_name || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex max-w-xs flex-wrap gap-1.5">
                      {(rule.major_keywords || []).length > 0 ? (rule.major_keywords || []).map((keyword, index) => (
                        <span key={`${keyword}-${index}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                          {keyword}
                        </span>
                      )) : <span className="text-xs text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex max-w-xs flex-wrap gap-1.5">
                      {(rule.required_match_keywords || []).length > 0 ? (rule.required_match_keywords || []).map((keyword, index) => (
                        <span key={`${keyword}-${index}`} className="rounded-full border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 px-2.5 py-1 text-xs font-black text-rose-700 shadow-sm">
                          {keyword}
                        </span>
                      )) : <span className="text-xs text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{rule.priority ?? 100}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${(rule.is_active ?? true) ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                      {(rule.is_active ?? true) ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="max-w-xs px-6 py-4 text-slate-600">
                    <span className="line-clamp-2">{rule.notes || '-'}</span>
                  </td>
                  <td className="max-w-xs px-6 py-4 text-slate-600">
                    <span className="line-clamp-2">{rule.rule_notes || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(rule.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(rule)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRuleStatus(rule)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                      >
                        {(rule.is_active ?? true) ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule(rule)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">{editingRule ? 'Kural Düzenle' : 'Yeni Kural Ekle'}</h3>
                <p className="mt-1 text-sm text-slate-500">Keyword ve eşleşecek bölümü tanımlayın.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Keyword</label>
                <input
                  value={form.keyword}
                  onChange={(event) => setForm((prev) => ({ ...prev, keyword: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs font-semibold text-slate-400">Boş bırakılırsa ilk major/required keyword veya department_name kullanılır.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">matched_department</label>
                <input
                  value={form.matched_department}
                  onChange={(event) => setForm((prev) => ({ ...prev, matched_department: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs font-semibold text-slate-400">Boş bırakılırsa department_name kullanılır.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">department_name</label>
                <input
                  value={form.department_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, department_name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">major_keywords</label>
                <input
                  value={form.major_keywords}
                  onChange={(event) => setForm((prev) => ({ ...prev, major_keywords: event.target.value }))}
                  placeholder="computer, software, AI"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs font-semibold text-slate-400">Virgülle ayırarak girin.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">required_match_keywords</label>
                <input
                  value={form.required_match_keywords}
                  onChange={(event) => setForm((prev) => ({ ...prev, required_match_keywords: event.target.value }))}
                  placeholder="engineering, computer"
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100"
                />
                <p className="mt-1 text-xs font-semibold text-rose-500">Program isminde geçerse ilgili bölümle mutlaka eşleşir.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">priority</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  is_active
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">rule_notes</label>
                <textarea
                  value={form.rule_notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, rule_notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importReport && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 backdrop-blur-sm">
          <div className="mb-10 flex max-h-[calc(100vh-100px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-5">
              <div>
                <h3 className="text-lg font-black text-slate-800">Bölüm Eşleşme Kuralları Güncelleme Raporu</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(importReport.createdAt).toLocaleString('tr-TR')} tarihinde {importReport.fileName} dosyasından oluşturuldu.
                </p>
              </div>
              <button type="button" onClick={() => setImportReport(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-5 sm:grid-cols-5">
              {[
                { label: 'Taranan', value: importReport.entries.length, style: 'bg-indigo-50 text-indigo-700' },
                { label: 'Eklendi', value: importReport.entries.filter((entry) => entry.status === 'created').length, style: 'bg-blue-50 text-blue-700' },
                { label: 'Güncellendi', value: importReport.entries.filter((entry) => entry.status === 'updated').length, style: 'bg-emerald-50 text-emerald-700' },
                { label: 'Değişmedi', value: importReport.entries.filter((entry) => entry.status === 'unchanged').length, style: 'bg-slate-100 text-slate-700' },
                { label: 'Başarısız', value: importReport.entries.filter((entry) => entry.status === 'failed').length, style: 'bg-rose-50 text-rose-700' },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl px-4 py-3 ${item.style}`}>
                  <div className="text-2xl font-black">{item.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-3">Satır / Bölüm</th>
                    <th className="px-5 py-3">Önceki</th>
                    <th className="px-5 py-3">Yeni</th>
                    <th className="px-5 py-3">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importReport.entries.map((entry) => (
                    <tr key={`${entry.rowNumber}-${entry.departmentName}`} className="align-top hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="text-xs font-semibold text-slate-500">Excel satırı {entry.rowNumber}</div>
                        <div className="mt-1 text-sm font-bold text-slate-800">{entry.departmentName}</div>
                        {entry.error && <div className="mt-1 text-xs text-rose-600">{entry.error}</div>}
                      </td>
                      <td className="whitespace-pre-line px-5 py-4 text-xs leading-5 text-slate-600">{entry.previousValue}</td>
                      <td className="whitespace-pre-line px-5 py-4 text-xs font-semibold leading-5 text-slate-700">{entry.nextValue}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black ${IMPORT_STATUS_STYLES[entry.status]}`}>
                          {IMPORT_STATUS_LABELS[entry.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
              <p className="text-xs text-slate-500">Her Excel satırının önceki ve yeni değerleri karşılaştırmalı olarak gösterilir.</p>
              <div className="flex gap-2">
                <button type="button" onClick={exportImportReport} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                  <Download className="h-4 w-4" /> Raporu Excel İndir
                </button>
                <button type="button" onClick={() => setImportReport(null)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentKeywordRules;
