import { useEffect, useState } from 'react';
import { Clock3, Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { type SharedDocumentResult, studentDocumentShareService } from '../services/studentDocumentShareService';

export default function SharedStudentDocument({ token }: { token: string }) {
  const [document, setDocument] = useState<SharedDocumentResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void studentDocumentShareService.resolve(token)
      .then(result => { if (active) setDocument(result); })
      .catch(resolveError => { if (active) setError(resolveError instanceof Error ? resolveError.message : 'Belge açılamadı.'); });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_30%),linear-gradient(145deg,_#071923,_#0f172a_55%,_#102a2b)] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300 ring-1 ring-teal-300/20"><FileCheck2 className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-300">UNIC Güvenli Belge</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">Salt okunur belge paylaşımı</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-slate-300">
            <Clock3 className="h-4 w-4 text-teal-300" /> Görüntüleme bağlantısı en fazla 5 dakika geçerlidir.
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
          {!document && !error && <div className="flex min-h-[65vh] items-center justify-center text-sm font-semibold text-slate-500">Belge güvenli olarak hazırlanıyor...</div>}
          {error && (
            <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 px-6 text-center text-slate-700">
              <ShieldCheck className="h-12 w-12 text-rose-500" />
              <h2 className="text-xl font-black">Belge görüntülenemiyor</h2>
              <p className="max-w-md text-sm text-slate-500">{error}</p>
            </div>
          )}
          {document && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 text-slate-800">
                <div className="min-w-0"><p className="truncate text-sm font-black">{document.fileName}</p><p className="text-xs text-slate-400">Bu ekran başka öğrenci veya profil bilgisi içermez.</p></div>
                <a href={document.viewUrl} download={document.fileName} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-black text-white hover:bg-teal-800"><Download className="h-4 w-4" /> İndir</a>
              </div>
              {document.mimeType === 'application/pdf' ? (
                <iframe title={document.fileName} src={document.viewUrl} className="h-[72vh] w-full bg-slate-100" />
              ) : (
                <div className="flex min-h-[65vh] items-center justify-center bg-slate-100 p-4"><img src={document.viewUrl} alt={document.fileName} className="max-h-[72vh] max-w-full object-contain" /></div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
