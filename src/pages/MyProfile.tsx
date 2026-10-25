import { AlertCircle, BookOpen, GraduationCap, Loader2, Mail, MapPin, Phone, School, UserRound } from 'lucide-react';
import { useMyStudentProfile } from '../hooks/useMyStudentProfile';

const valueOrDash = (value?: string | number) => value === undefined || value === null || value === '' ? '-' : String(value);

export default function MyProfile({ userId }: { userId: string }) {
  const { student, isLoading, error } = useMyStudentProfile(userId);

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Profiliniz yükleniyor...</div>;
  if (error) return <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"><AlertCircle className="h-5 w-5" />{error}</div>;
  if (!student) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Hesabınıza bağlı bir öğrenci profili bulunamadı. Sistem yöneticinizden hesabınızı CRM profilinizle eşleştirmesini isteyin.</div>;

  const preferences = student.analysis?.preferences;
  const countries = Array.from(new Set([...(student.targetCountries || []), preferences?.country1, preferences?.country2, preferences?.country3].filter(Boolean) as string[]));
  const programs = Array.from(new Set([...(student.targetPrograms || []), preferences?.program1, preferences?.program2].filter(Boolean) as string[]));

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-7 text-white shadow-xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-2xl font-black">
            {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="h-full w-full object-cover" /> : `${student.firstName[0] || ''}${student.lastName[0] || ''}`}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Öğrenci Profili</p>
            <h1 className="mt-1 text-3xl font-black">{student.firstName} {student.lastName}</h1>
            <p className="mt-2 text-sm text-slate-300">Başvuru aşaması: <span className="font-bold text-white">{student.pipelineStage}</span></p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 font-black text-slate-800"><UserRound className="h-5 w-5 text-indigo-600" /> İletişim Bilgileri</h2>
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-3 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /><span>{valueOrDash(student.email)}</span></p>
            <p className="flex items-center gap-3 text-slate-600"><Phone className="h-4 w-4 text-slate-400" /><span>{valueOrDash(student.phone)}</span></p>
            <p className="flex items-center gap-3 text-slate-600"><MapPin className="h-4 w-4 text-slate-400" /><span>{countries.join(', ') || '-'}</span></p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 font-black text-slate-800"><School className="h-5 w-5 text-indigo-600" /> Eğitim Bilgileri</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs font-bold uppercase text-slate-400">Okul</dt><dd className="mt-1 font-semibold text-slate-700">{valueOrDash(student.schoolName)}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-400">Sınıf</dt><dd className="mt-1 font-semibold text-slate-700">{valueOrDash(student.currentGrade)}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-400">Not Ortalaması</dt><dd className="mt-1 font-semibold text-slate-700">{valueOrDash(student.gpa)}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-400">İngilizce</dt><dd className="mt-1 font-semibold text-slate-700">{valueOrDash(student.englishLevel)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-2 font-black text-indigo-900"><GraduationCap className="h-5 w-5 text-indigo-600" /> Eğitim Tercihlerim</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500">Ülkeler</p><div className="flex flex-wrap gap-2">{countries.length ? countries.map(country => <span key={country} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 ring-1 ring-indigo-100">{country}</span>) : <span className="text-sm text-slate-500">Tercih girilmedi.</span>}</div></div>
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500">Program ve Bölümler</p><div className="flex flex-wrap gap-2">{programs.length ? programs.map(program => <span key={program} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 ring-1 ring-indigo-100">{program}</span>) : <span className="text-sm text-slate-500">Tercih girilmedi.</span>}</div></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-2 font-black text-slate-800"><BookOpen className="h-5 w-5 text-indigo-600" /> Başvurularım</h2>
        {student.applications?.length ? <div className="space-y-3">{student.applications.map(application => <div key={application.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center"><div><p className="font-bold text-slate-800">{application.universityName}</p><p className="text-sm text-slate-500">{application.programName}</p></div><span className="w-fit rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{application.status}</span></div>)}</div> : <p className="text-sm text-slate-500">Henüz kayıtlı bir üniversite başvurunuz bulunmuyor.</p>}
      </section>
    </div>
  );
}
