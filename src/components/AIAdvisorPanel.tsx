import { useEffect, useMemo, useState } from 'react';
import {
  Archive, Bot, CheckCircle2, ClipboardCheck, Copy, FilePenLine, Loader2,
  LockKeyhole, MessageSquareText, RefreshCw, Send, ShieldCheck, Sparkles, Unlink,
} from 'lucide-react';
import type { Student } from '../types';
import {
  aiAdvisorService,
  type AIAdvisorContent,
  type AIAdvisorContext,
  type AIAdvisorReport,
  type AIAdvisorReportType,
} from '../services/aiAdvisorService';

const REPORT_LABELS: Record<AIAdvisorReportType, string> = {
  pre_meeting_brief: 'Görüşme Öncesi',
  language_assessment: 'Dil Değerlendirmesi',
  post_meeting_report: 'Görüşme Sonrası',
};

const emptyContext: AIAdvisorContext = {};

export default function AIAdvisorPanel({ student }: { student: Student }) {
  const language = student.analysis?.language;
  const firstExamScore = language?.examScore || '';
  const firstExamType = language?.examType || language?.targetExam || '';
  const [reportType, setReportType] = useState<AIAdvisorReportType>('pre_meeting_brief');
  const [context, setContext] = useState<AIAdvisorContext>({
    ...emptyContext,
    exam_type: firstExamType,
    current_score: firstExamScore,
  });
  const [reports, setReports] = useState<AIAdvisorReport[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<AIAdvisorContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createdShare, setCreatedShare] = useState<{ reportId: string; url: string } | null>(null);

  const selected = useMemo(
    () => reports.find(report => report.id === selectedId) || reports[0] || null,
    [reports, selectedId],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    void aiAdvisorService.listReports(student.id)
      .then(items => {
        if (!active) return;
        setReports(items);
        setSelectedId(items[0]?.id || '');
      })
      .catch(loadError => { if (active) setError(messageOf(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student.id]);

  useEffect(() => {
    setDraft(selected ? cloneContent(selected.counselorContent) : null);
  }, [selected]);

  const replaceReport = (report: AIAdvisorReport) => {
    setReports(previous => [report, ...previous.filter(item => item.id !== report.id)]);
    setSelectedId(report.id);
  };

  const loadReports = async () => {
    const items = await aiAdvisorService.listReports(student.id);
    setReports(items);
    setSelectedId(previous => items.some(item => item.id === previous) ? previous : (items[0]?.id || ''));
  };

  const run = async (action: () => Promise<void>) => {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setWorking(false);
    }
  };

  const generate = () => run(async () => {
    if (reportType === 'language_assessment' && (!context.current_score || !context.target_score)) {
      throw new Error('Dil değerlendirmesi için mevcut skor ve hedef skor zorunludur.');
    }
    if (reportType === 'post_meeting_report' && !context.counselor_notes?.trim()) {
      throw new Error('Görüşme sonrası rapor için danışman notu zorunludur.');
    }
    const report = await aiAdvisorService.generateReport(student.id, reportType, context);
    replaceReport(report);
    setNotice('AI taslağı oluşturuldu. Onaylamadan önce mutlaka gözden geçirin.');
  });

  const saveDraft = () => run(async () => {
    if (!selected || !draft) return;
    const report = await aiAdvisorService.updateDraft(selected.id, draft);
    replaceReport(report);
    setNotice('Danışman düzenlemeleri kaydedildi.');
  });

  const approve = () => run(async () => {
    if (!selected) return;
    if (!window.confirm('Bu raporu danışman onayıyla kilitlemek istiyor musunuz? Onaydan sonra içerik değiştirilemez.')) return;
    const report = await aiAdvisorService.approveReport(selected.id);
    replaceReport(report);
    setNotice('Rapor onaylandı. Artık salt okunur bağlantı oluşturabilirsiniz.');
  });

  const createShare = () => run(async () => {
    if (!selected) return;
    const share = await aiAdvisorService.createShareLink(selected.id, 72);
    setCreatedShare({ reportId: selected.id, url: share.url });
    try {
      await navigator.clipboard.writeText(share.url);
      setNotice('72 saatlik salt okunur bağlantı panoya kopyalandı.');
    } catch {
      setNotice('Bağlantı oluşturuldu. Aşağıdaki alandan kopyalayabilirsiniz.');
    }
    replaceReport({
      ...selected,
      activeShare: { id: share.id, expiresAt: share.expiresAt, maxViews: null, viewCount: 0 },
    });
  });

  const copyActiveShare = () => run(async () => {
    if (!selected?.activeShare) return;
    if (!createdShare || createdShare.reportId !== selected.id) {
      setNotice('Güvenlik nedeniyle önceki bağlantının tokenı tekrar gösterilemez. Yeni link için mevcut paylaşımı iptal edin.');
      return;
    }
    await navigator.clipboard.writeText(createdShare.url);
    setNotice('Paylaşım bağlantısı panoya kopyalandı.');
  });

  const revokeShare = () => run(async () => {
    if (!selected?.activeShare) return;
    await aiAdvisorService.revokeShareLink(selected.activeShare.id);
    setCreatedShare(null);
    replaceReport({ ...selected, activeShare: undefined });
    setNotice('Paylaşım bağlantısı iptal edildi.');
  });

  const archive = () => run(async () => {
    if (!selected) return;
    if (!window.confirm('Rapor arşivlensin ve aktif paylaşım bağlantıları kapatılsın mı?')) return;
    replaceReport(await aiAdvisorService.archiveReport(selected.id));
    setNotice('Rapor arşivlendi.');
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.22),_transparent_34%),linear-gradient(135deg,_#071923,_#0f172a_62%,_#102a2b)] p-6 text-white shadow-xl">
        <div className="absolute -left-12 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200 shadow-inner">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-300">UNIC AI Danışman</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">Dış araştırma kapalı</span>
              </div>
              <h2 className="mt-2 text-2xl font-black">Gerçek danışmanın görüşme ve raporlama asistanı</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">UNIC kuralları ve kayıtlı öğrenci verisiyle kısa bir taslak hazırlar. Karar vermez, işlem başlatmaz ve danışman onayı olmadan paylaşılmaz.</p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-xs">
            <StatusPill icon={LockKeyhole} label="Sağlayıcı sistemde" />
            <StatusPill icon={ShieldCheck} label="PII minimize" />
          </div>
        </div>
      </section>

      {(error || notice) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
          {error || notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div><h3 className="font-black text-slate-900">Yeni danışman taslağı</h3><p className="mt-1 text-xs text-slate-500">Amaç seçin ve yalnız gerekli görüşme bilgisini girin.</p></div>
            <Sparkles className="h-5 w-5 text-teal-600" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(REPORT_LABELS) as AIAdvisorReportType[]).map(type => (
              <button key={type} type="button" onClick={() => setReportType(type)}
                className={`rounded-xl border px-2 py-3 text-[11px] font-black transition ${reportType === type ? 'border-teal-600 bg-teal-50 text-teal-800 ring-1 ring-teal-100' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {REPORT_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {reportType === 'pre_meeting_brief' && (
              <TextArea label="Görüşme amacı" value={context.meeting_goal || ''} maxLength={500}
                placeholder="Örn. Dil hedefini ve başvuru takvimini netleştirmek"
                onChange={value => setContext(previous => ({ ...previous, meeting_goal: value }))} />
            )}

            {reportType === 'language_assessment' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Sınav" value={context.exam_type || ''} placeholder="IELTS, TOEFL..." onChange={value => setContext(previous => ({ ...previous, exam_type: value }))} />
                  <Input label="Hedef tarih" type="date" value={context.target_date || ''} onChange={value => setContext(previous => ({ ...previous, target_date: value }))} />
                  <Input label="Mevcut skor *" value={context.current_score || ''} placeholder="6.0" onChange={value => setContext(previous => ({ ...previous, current_score: value }))} />
                  <Input label="Hedef skor *" value={context.target_score || ''} placeholder="6.5" onChange={value => setContext(previous => ({ ...previous, target_score: value }))} />
                </div>
                <Input label="Odak alanı" value={context.focus_area || ''} placeholder="Writing, Speaking..." onChange={value => setContext(previous => ({ ...previous, focus_area: value }))} />
              </>
            )}

            {reportType === 'post_meeting_report' && (
              <TextArea label="Yapılandırılmış danışman notu *" value={context.counselor_notes || ''} maxLength={3000}
                placeholder="Görüşmede konuşulan kararlar, açık sorular ve takip adımları..."
                onChange={value => setContext(previous => ({ ...previous, counselor_notes: value }))} />
            )}

            <button type="button" onClick={generate} disabled={working}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
              Danışman taslağı oluştur
            </button>
            <p className="text-center text-[11px] leading-5 text-slate-400">Not alanlarına öğrenci adı, telefon veya e-posta yazmayın. Rapor taslak kaydedilir; öğrencinin aşaması veya başka hiçbir kayıt otomatik değiştirilmez.</p>
          </div>
        </section>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div><h3 className="font-black text-slate-900">Danışman raporları</h3><p className="text-xs text-slate-500">Taslak → düzenle → onayla → paylaş</p></div>
            <button type="button" disabled={loading || working} onClick={() => void run(async () => { await loadReports(); setNotice('Rapor listesi yenilendi.'); })} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading || working ? 'animate-spin' : ''}`} /></button>
          </div>

          {loading && <div className="flex min-h-72 items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Raporlar yükleniyor...</div>}
          {!loading && reports.length === 0 && <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center text-slate-400"><Bot className="mb-3 h-10 w-10 text-slate-300" /><p className="font-bold">Henüz rapor yok</p><p className="mt-1 text-xs">Soldaki alandan ilk danışman taslağını oluşturabilirsiniz.</p></div>}

          {!loading && reports.length > 0 && selected && draft && (
            <div className="grid min-h-[560px] lg:grid-cols-[190px_minmax(0,1fr)]">
              <div className="border-b border-slate-100 p-3 lg:border-b-0 lg:border-r">
                <div className="space-y-2">
                  {reports.map(report => (
                    <button key={report.id} type="button" onClick={() => setSelectedId(report.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${selected.id === report.id ? 'border-teal-300 bg-teal-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <p className="text-[11px] font-black text-slate-800">{REPORT_LABELS[report.reportType]}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{new Date(report.createdAt).toLocaleString('tr-TR')}</p>
                      <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusClass(report.status)}`}>{statusLabel(report.status)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{REPORT_LABELS[selected.reportType]}</p><p className="mt-1 text-xs text-slate-400">{selected.status === 'draft' ? 'Danışman düzenlemesi bekleniyor' : 'Danışman tarafından kilitlendi'}</p></div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500">OpenAI · model sistemde</span>
                </div>

                <EditableContent content={draft} disabled={selected.status !== 'draft'} onChange={setDraft} />

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {selected.status === 'draft' && (
                    <>
                      <ActionButton icon={FilePenLine} label="Taslağı Kaydet" onClick={saveDraft} disabled={working} />
                      <ActionButton icon={CheckCircle2} label="Danışman Onayı" onClick={approve} disabled={working} primary />
                    </>
                  )}
                  {selected.status === 'approved' && !selected.activeShare && <ActionButton icon={Send} label="72 Saatlik Link" onClick={createShare} disabled={working} primary />}
                  {selected.status === 'approved' && selected.activeShare && (
                    <>
                      <ActionButton icon={Copy} label="Link Güvenliği" onClick={copyActiveShare} disabled={working} />
                      <ActionButton icon={Unlink} label="Paylaşımı İptal Et" onClick={revokeShare} disabled={working} />
                    </>
                  )}
                  {selected.status === 'approved' && <ActionButton icon={Archive} label="Arşivle" onClick={archive} disabled={working} />}
                </div>
                {selected.activeShare && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Salt okunur paylaşım aktif · {new Date(selected.activeShare.expiresAt).toLocaleString('tr-TR')} tarihinde sona erer.</p>}
                {selected.activeShare && createdShare?.reportId === selected.id && (
                  <div className="flex gap-2 rounded-xl border border-teal-200 bg-teal-50 p-2">
                    <input readOnly value={createdShare.url} className="min-w-0 flex-1 bg-transparent px-2 text-xs text-teal-900 outline-none" />
                    <button type="button" onClick={() => void copyActiveShare()} className="rounded-lg bg-white p-2 text-teal-700 shadow-sm" title="Bağlantıyı kopyala"><Copy className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EditableContent({ content, disabled, onChange }: { content: AIAdvisorContent; disabled: boolean; onChange: (content: AIAdvisorContent) => void }) {
  const updateList = (field: 'observations' | 'questions' | 'actions', value: string) => {
    onChange({ ...content, [field]: value.split('\n').map(item => item.trim()).filter(Boolean).slice(0, 4) });
  };
  return (
    <div className="space-y-4">
      <Input label="Başlık" value={content.title} disabled={disabled} maxLength={120} onChange={value => onChange({ ...content, title: value })} />
      <TextArea label="Kısa değerlendirme" value={content.summary} disabled={disabled} maxLength={600} onChange={value => onChange({ ...content, summary: value })} />
      <TextArea label="Gözlemler · her satır bir madde" value={content.observations.join('\n')} disabled={disabled} maxLength={900} onChange={value => updateList('observations', value)} />
      <TextArea label="Görüşmede sorulacaklar · her satır bir madde" value={content.questions.join('\n')} disabled={disabled} maxLength={900} onChange={value => updateList('questions', value)} />
      <TextArea label="Takip adımları · her satır bir madde" value={content.actions.join('\n')} disabled={disabled} maxLength={900} onChange={value => updateList('actions', value)} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><ClipboardCheck className="mr-2 inline h-4 w-4" />{content.warning}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, disabled, maxLength = 500 }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; disabled?: boolean; maxLength?: number }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span><input type={type} value={value} disabled={disabled} maxLength={maxLength} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-600" /></label>;
}

function TextArea({ label, value, onChange, placeholder, disabled, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; maxLength: number }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span><textarea value={value} disabled={disabled} maxLength={maxLength} rows={3} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-600" /></label>;
}

function ActionButton({ icon: Icon, label, onClick, disabled, primary }: { icon: typeof Sparkles; label: string; onClick: () => void; disabled: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${primary ? 'bg-teal-700 text-white hover:bg-teal-800' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function StatusPill({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300"><Icon className="h-4 w-4 text-teal-300" />{label}</div>;
}

function cloneContent(content: AIAdvisorContent): AIAdvisorContent {
  return { ...content, observations: [...content.observations], questions: [...content.questions], actions: [...content.actions] };
}

function statusLabel(status: AIAdvisorReport['status']) {
  return status === 'draft' ? 'Taslak' : status === 'approved' ? 'Onaylı' : 'Arşiv';
}

function statusClass(status: AIAdvisorReport['status']) {
  return status === 'draft' ? 'bg-amber-100 text-amber-700' : status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600';
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'AI Danışman işlemi tamamlanamadı.';
}
