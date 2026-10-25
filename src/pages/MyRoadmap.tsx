import { AlertCircle, Loader2 } from 'lucide-react';
import { useMyStudentProfile } from '../hooks/useMyStudentProfile';
import Roadmaps from './Roadmaps';

export default function MyRoadmap({ userId }: { userId: string }) {
  const { student, isLoading, error } = useMyStudentProfile(userId);

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Yol haritanız hazırlanıyor...</div>;
  if (error) return <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"><AlertCircle className="h-5 w-5" />{error}</div>;
  if (!student) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Hesabınıza bağlı bir öğrenci profili bulunamadı. Sistem yöneticinizden hesabınızı CRM profilinizle eşleştirmesini isteyin.</div>;

  return <Roadmaps student={student} />;
}
