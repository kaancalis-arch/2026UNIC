import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Edit3, Loader2, LockKeyhole, Plus, Save, ShieldCheck, X } from 'lucide-react';
import {
  aiAdvisorService,
  type AIAdvisorReportType,
  type AIAdvisorRule,
} from '../services/aiAdvisorService';

const TYPE_LABELS: Record<AIAdvisorReportType, string> = {
  pre_meeting_brief: 'Görüşme Öncesi',
  language_assessment: 'Dil Değerlendirmesi',
  post_meeting_report: 'Görüşme Sonrası',
};

type RuleForm = {
  id?: string;
  reportType: AIAdvisorReportType;
  title: string;
  instruction: string;
  priority: number;
  status: 'active' | 'inactive';
};

const EMPTY_FORM: RuleForm = {
  reportType: 'language_assessment',
  title: '',
  instruction: '',
  priority: 100,
  status: 'active',
};

export default function AIAdvisorSettings() {
  const [rules, setRules] = useState<AIAdvisorRule[]>([]);
  const [form, setForm] = useState<RuleForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void aiAdvisorService.listRules()
      .then(items => { if (active) setRules(items); })
      .catch(loadError => { if (active) setError(messageOf(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const editRule = (rule: AIAdvisorRule) => setForm({
    id: rule.id,
    reportType: rule.reportType,
    title: rule.title,
    instruction: rule.instruction,
    priority: rule.priority,
    status: rule.status,
  });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await aiAdvisorService.saveRule(form);
      setRules(previous => [...previous.filter(rule => rule.id !== saved.id), saved]
        .sort((left, right) => left.reportType.localeCompare(right.reportType) || left.priority - right.priority));
      setForm(null);
      setNotice('UNIC AI kuralı kaydedildi. Yeni raporlar bu kuralın güncel sürümünü kullanacak.');
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.2),_transparent_35%),linear-gradient(135deg,_#071923,_#0f172a_62%,_#102a2b)] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Bot className="h-7 w-7" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-300">UNIC AI Danışman Ayarları</p>
              <h2 className="mt-2 text-2xl font-black">Kurallar UNIC tarafından, sağlayıcı sistem tarafından yönetilir</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Buradaki kurallar yalnız yeni taslaklara eklenir. API anahtarı tarayıcıya girilmez ve kullanıcı model seçemez.</p>
            </div>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><LockKeyhole className="h-4 w-4 text-teal-300" /> OpenAI · sunucu secret’ı</div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><ShieldCheck className="h-4 w-4 text-teal-300" /> Dış araştırma ve araçlar kapalı</div>
          </div>
        </div>
      </section>

      {(error || notice) && <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>{error || notice}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div><h3 className="font-black text-slate-900">UNIC değerlendirme kuralları</h3><p className="mt-1 text-xs text-slate-500">AI yalnız aktif kuralları, kesin hesaplamayı ve minimize öğrenci verisini görür.</p></div>
          <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-black text-white hover:bg-teal-800"><Plus className="h-4 w-4" /> Yeni Kural</button>
        </div>

        {loading && <div className="flex min-h-52 items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kurallar yükleniyor...</div>}
        {!loading && rules.length === 0 && <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center text-slate-400"><CheckCircle2 className="mb-3 h-10 w-10 text-slate-300" /><p className="font-bold">Henüz özel UNIC kuralı yok</p><p className="mt-1 max-w-md text-xs">Sistem güvenlik ve kısa rapor kurallarıyla çalışır. Kuruma özgü değerlendirme bilgisini buradan ekleyebilirsiniz.</p></div>}
        {!loading && rules.length > 0 && (
          <div className="divide-y divide-slate-100">
            {rules.map(rule => (
              <div key={rule.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-black text-teal-700">{TYPE_LABELS[rule.reportType]}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${rule.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rule.status === 'active' ? 'Aktif' : 'Pasif'}</span><span className="text-[10px] text-slate-400">Öncelik {rule.priority} · v{rule.version}</span></div>
                  <h4 className="mt-2 font-black text-slate-900">{rule.title}</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{rule.instruction}</p>
                </div>
                <button type="button" onClick={() => editRule(rule)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"><Edit3 className="h-4 w-4" /> Düzenle</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {form && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h3 className="font-black text-slate-900">{form.id ? 'UNIC AI Kuralını Düzenle' : 'Yeni UNIC AI Kuralı'}</h3><p className="mt-1 text-xs text-slate-500">Talimatı kesin, kısa ve doğrulanabilir yazın.</p></div><button type="button" onClick={() => setForm(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Rapor Türü</span><select value={form.reportType} onChange={event => setForm({ ...form, reportType: event.target.value as AIAdvisorReportType })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400">{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Durum</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400"><option value="active">Aktif</option><option value="inactive">Pasif</option></select></label>
              </div>
              <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Kural Başlığı</span><input value={form.title} maxLength={120} onChange={event => setForm({ ...form, title: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" placeholder="Örn. IELTS hedef farkı yorumu" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">UNIC Talimatı</span><textarea value={form.instruction} maxLength={2000} rows={6} onChange={event => setForm({ ...form, instruction: event.target.value })} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-teal-400" placeholder="Örn. Hedef farkı 0 ise öğrencinin hedef skoru karşıladığını belirt; resmi okul kabulü hakkında sonuç çıkarma." /></label>
              <label className="block max-w-40"><span className="mb-1.5 block text-xs font-black text-slate-500">Öncelik</span><input type="number" min={1} max={1000} value={form.priority} onChange={event => setForm({ ...form, priority: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" /></label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><button type="button" onClick={() => setForm(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600">Vazgeç</button><button type="button" onClick={save} disabled={saving || form.title.trim().length < 3 || form.instruction.trim().length < 10} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-black text-white hover:bg-teal-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'UNIC AI kural işlemi tamamlanamadı.';
}
