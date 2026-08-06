import { useEffect, useState } from 'react';
import { Bot, CalendarClock, CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react';
import { aiAdvisorShareService, type SharedAIAdvisorReport } from '../services/aiAdvisorShareService';

const TYPE_LABELS = {
  pre_meeting_brief: 'Görüşme Öncesi Hazırlık',
  language_assessment: 'Dil Yeterliliği Değerlendirmesi',
  post_meeting_report: 'Görüşme Sonrası Rapor',
};

export default function SharedAIAdvisorReport({ token }: { token: string }) {
  const [report, setReport] = useState<SharedAIAdvisorReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void aiAdvisorShareService.resolve(token)
      .then(result => { if (active) setReport(result); })
      .catch(resolveError => { if (active) setError(resolveError instanceof Error ? resolveError.message : 'Rapor açılamadı.'); });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_30%),linear-gradient(145deg,_#071923,_#0f172a_55%,_#102a2b)] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300 ring-1 ring-teal-300/20"><Bot className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.28em] text-teal-300">UNIC AI Danışman</p><h1 className="mt-1 text-xl font-black sm:text-2xl">Danışman onaylı salt okunur rapor</h1><p className="mt-2 text-xs leading-5 text-slate-400">Bu sayfa öğrenci profiline veya başka sistem kayıtlarına erişim sağlamaz.</p></div></div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-800 shadow-2xl">
          {!report && !error && <div className="flex min-h-[55vh] items-center justify-center text-sm font-semibold text-slate-500">Rapor güvenli olarak hazırlanıyor...</div>}
          {error && <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 px-6 text-center"><ShieldCheck className="h-12 w-12 text-rose-500" /><h2 className="text-xl font-black">Rapor görüntülenemiyor</h2><p className="max-w-md text-sm text-slate-500">{error}</p></div>}
          {report && (
            <div>
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-5"><p className="text-[10px] font-black uppercase tracking-widest text-teal-700">{TYPE_LABELS[report.reportType]}</p><h2 className="mt-2 text-2xl font-black text-slate-900">{report.content.title}</h2><p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><CalendarClock className="h-4 w-4" /> Danışman onayı: {new Date(report.approvedAt).toLocaleString('tr-TR')}</p></div>
              <div className="space-y-6 p-6 sm:p-8">
                <p className="text-sm leading-7 text-slate-700">{report.content.summary}</p>
                <ReportList title="Gözlemler" items={report.content.observations} />
                <ReportList title="Görüşme Soruları" items={report.content.questions} />
                <ReportList title="Takip Adımları" items={report.content.actions} />
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800"><ShieldCheck className="mr-2 inline h-4 w-4" />{report.content.warning}</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return <section><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><ClipboardList className="h-4 w-4 text-teal-700" />{title}</h3><ul className="space-y-2">{items.map((item, index) => <li key={`${title}-${index}`} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-600" />{item}</li>)}</ul></section>;
}
