import { useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2, ShieldCheck } from 'lucide-react';
import DocumentUploadField from '../components/DocumentUploadField';
import { useMyStudentProfile } from '../hooks/useMyStudentProfile';
import { documentTypeService, type DocumentTypeDefinition } from '../services/documentTypeService';
import { studentDocumentService } from '../services/studentDocumentService';
import type { StudentDocument } from '../types';

export default function MyFiles({ userId }: { userId: string }) {
  const { student, isLoading: isProfileLoading, error: profileError } = useMyStudentProfile(userId);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const reloadDocuments = async (studentId: string) => {
    setDocuments(await studentDocumentService.list(studentId));
  };

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');
    void Promise.all([studentDocumentService.list(student.id), documentTypeService.getAll()])
      .then(([loadedDocuments, definitions]) => {
        if (cancelled) return;
        setDocuments(loadedDocuments);
        setDocumentTypes(definitions.filter(definition => definition.isActive));
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Belgeler yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [student]);

  if (isProfileLoading) return <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Belgeleriniz yükleniyor...</div>;
  if (profileError) return <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"><AlertCircle className="h-5 w-5" />{profileError}</div>;
  if (!student) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Hesabınıza bağlı bir öğrenci profili bulunamadı. Sistem yöneticinizden hesabınızı CRM profilinizle eşleştirmesini isteyin.</div>;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 p-7 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Güvenli Belge Alanı</p>
          <h1 className="mt-2 text-3xl font-black">Belgelerim</h1>
          <p className="mt-2 text-sm text-slate-300">Başvuru belgelerinizi görüntüleyin ve eksik dosyaları güvenli şekilde yükleyin.</p>
        </div>
        <ShieldCheck className="h-12 w-12 text-indigo-300" />
      </div>

      {error && <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700"><AlertCircle className="h-5 w-5" />{error}</div>}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Belge listesi hazırlanıyor...</div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {documentTypes.map(definition => (
            <DocumentUploadField
              key={definition.id}
              documentTypeId={definition.id}
              label={definition.name}
              description={definition.note}
              required={definition.isRequired}
              multiple={definition.allowMultiple}
              documents={documents}
              canArchive={false}
              canShare={false}
              onUpload={async file => {
                await studentDocumentService.upload(student.id, definition.id, file);
                await reloadDocuments(student.id);
              }}
              onView={async document => {
                const url = await studentDocumentService.createViewUrl(student.id, document.id);
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            />
          ))}
          {documentTypes.length === 0 && <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-500"><FileText className="h-8 w-8 text-slate-300" /><p>Aktif belge türü tanımlanmamış.</p></div>}
        </div>
      )}
    </div>
  );
}
