import { useId, useState } from 'react';
import { Archive, CircleX, Copy, Eye, FileCheck, Link2, Link2Off, RefreshCw, Upload } from 'lucide-react';
import type { StudentDocument } from '../types';

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = 'application/pdf,image/png,image/jpeg,image/webp';
const DRIVE_PROCESSING_STALE_MS = 15 * 60 * 1000;

const isStaleDriveProcessing = (document: StudentDocument) =>
  document.driveSyncStatus === 'processing'
  && (!document.driveSyncStartedAt || Date.parse(document.driveSyncStartedAt) <= Date.now() - DRIVE_PROCESSING_STALE_MS);

const isDriveBackoffActive = (document: StudentDocument) =>
  document.driveSyncStatus === 'failed'
  && !!document.driveSyncNextRetryAt
  && Date.parse(document.driveSyncNextRetryAt) > Date.now();

interface DocumentUploadFieldProps {
  documentTypeId: string;
  label: string;
  description?: string;
  required?: boolean;
  multiple?: boolean;
  documents: StudentDocument[];
  onUpload: (file: File) => Promise<void>;
  onView: (document: StudentDocument) => Promise<void>;
  onArchive: (document: StudentDocument) => Promise<void>;
  onRetryDriveSync: (document: StudentDocument) => Promise<void>;
  onCreateShare: (document: StudentDocument, hours: 24 | 72 | 168) => Promise<string>;
  onRevokeShare: (document: StudentDocument) => Promise<void>;
}

export default function DocumentUploadField({
  documentTypeId,
  label,
  description,
  required = false,
  multiple = false,
  documents,
  onUpload,
  onView,
  onArchive,
  onRetryDriveSync,
  onCreateShare,
  onRevokeShare,
}: DocumentUploadFieldProps) {
  const inputId = useId();
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [shareHours, setShareHours] = useState<24 | 72 | 168>(72);
  const [createdShareUrl, setCreatedShareUrl] = useState('');
  const matchingDocuments = documents.filter((item) => item.documentTypeId === documentTypeId && item.status !== 'archived');

  const run = async (action: () => Promise<void>) => {
    setError('');
    setIsBusy(true);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Belge işlemi tamamlanamadı.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    if (!multiple && selectedFiles.length > 1) {
      setError('Bu evrak türü için yalnız bir dosya yüklenebilir.');
      return;
    }
    if (selectedFiles.some(file => !ACCEPTED_FILE_TYPES.split(',').includes(file.type))) {
      setError('Yalnız PDF, PNG, JPG veya WEBP dosyası yükleyebilirsiniz.');
      return;
    }
    if (selectedFiles.some(file => file.size > MAX_FILE_SIZE)) {
      setError('Dosya boyutu en fazla 3 MB olabilir.');
      return;
    }
    await run(async () => {
      for (const file of selectedFiles) await onUpload(file);
    });
  };

  const createShare = (document: StudentDocument) => run(async () => {
    const url = await onCreateShare(document, shareHours);
    setCreatedShareUrl(url);
    await navigator.clipboard.writeText(url);
  });

  return (
    <div className={`rounded-xl border p-4 transition-colors ${matchingDocuments.length > 0 ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
      <div className="flex flex-wrap items-start gap-2">
        {matchingDocuments.length > 0 ? <FileCheck className="mt-0.5 h-4 w-4 text-emerald-600" /> : <CircleX className="mt-0.5 h-4 w-4 text-rose-500" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${required ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
              {required ? 'Zorunlu' : 'İsteğe Bağlı'}
            </span>
          </div>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
        </div>
        <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
          <Upload className="h-4 w-4" />
          {isBusy ? 'İşleniyor...' : matchingDocuments.length && !multiple ? 'Yeni Sürüm Yükle' : 'Evrak Yükle'}
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple={multiple}
          className="hidden"
          disabled={isBusy}
          onChange={(event) => {
            void handleFileChange(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">PDF veya görsel, en fazla 3 MB. Dosya türü sunucuda doğrulanır.</p>

      {matchingDocuments.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          {matchingDocuments.map(document => (
            <div key={document.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700">{document.originalName || document.fileName || document.type}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">Sürüm {document.version || 1} · {document.sizeBytes ? `${(document.sizeBytes / 1024).toFixed(0)} KB` : 'Legacy kayıt'}</p>
                  {document.driveSyncStatus === 'processing' && !isStaleDriveProcessing(document) && (
                    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Drive Bekliyor</span>
                  )}
                  {document.driveSyncStatus === 'synced' && (
                    <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Drive Eşitlendi</span>
                  )}
                  {document.driveSyncStatus === 'deleting' && (
                    <span className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">Drive Siliniyor</span>
                  )}
                  {isDriveBackoffActive(document) && (
                    <span className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      Tekrar deneme: {new Date(document.driveSyncNextRetryAt!).toLocaleString('tr-TR')}
                    </span>
                  )}
                  {(document.driveSyncStatus === 'pending' || isStaleDriveProcessing(document) || (document.driveSyncStatus === 'failed' && !isDriveBackoffActive(document))) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${document.driveSyncStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {document.driveSyncStatus === 'failed' ? 'Drive Hatası' : 'Drive Bekliyor'}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void run(() => onRetryDriveSync(document))}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3 w-3" /> Tekrar Dene
                      </button>
                    </div>
                  )}
                </div>
                <button type="button" disabled={isBusy} onClick={() => void run(() => onView(document))} className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50" title="Görüntüle"><Eye className="h-4 w-4" /></button>
                {document.activeShare ? (
                  <button type="button" disabled={isBusy} onClick={() => void run(() => onRevokeShare(document))} className="rounded-md p-1.5 text-amber-700 hover:bg-amber-50" title="Paylaşım linkini iptal et"><Link2Off className="h-4 w-4" /></button>
                ) : (
                  <div className="flex items-center gap-1">
                    <select value={shareHours} onChange={event => setShareHours(Number(event.target.value) as 24 | 72 | 168)} disabled={isBusy} className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600">
                      <option value={24}>24 saat</option>
                      <option value={72}>72 saat</option>
                      <option value={168}>7 gün</option>
                    </select>
                    <button type="button" disabled={isBusy} onClick={() => void createShare(document)} className="rounded-md p-1.5 text-indigo-700 hover:bg-indigo-50" title="Paylaşım linki oluştur ve kopyala"><Link2 className="h-4 w-4" /></button>
                  </div>
                )}
                <button type="button" disabled={isBusy} onClick={() => void run(() => onArchive(document))} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50" title="Arşivle"><Archive className="h-4 w-4" /></button>
              </div>
              {document.activeShare && <p className="mt-1 text-[10px] font-medium text-amber-700">Paylaşım {new Date(document.activeShare.expiresAt).toLocaleString('tr-TR')} tarihine kadar açık.</p>}
            </div>
          ))}
        </div>
      )}
      {createdShareUrl && (
        <button type="button" onClick={() => void navigator.clipboard.writeText(createdShareUrl)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
          <Copy className="h-3 w-3" /> Son oluşturulan linki tekrar kopyala
        </button>
      )}
      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
