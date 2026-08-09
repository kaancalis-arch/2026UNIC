import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Trash2, UserRoundCheck, Users, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { systemService } from '../services/systemService';
import type { SystemUser } from '../types';

const UserManagement = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      setError('');
      try {
        const visibleUsers = await systemService.getSystemUsers();
        if (active) setUsers(visibleUsers);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Bağlı kullanıcılar yüklenemedi.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadUsers();
    return () => {
      active = false;
    };
  }, [currentUser]);

  const toggleStatus = async (user: SystemUser) => {
    if (!currentUser || user.parent_user_id !== currentUser.id || statusUserId) return;

    const nextStatus = user.status === 'active' ? 'passive' : 'active';
    const action = nextStatus === 'passive' ? 'pasife almak' : 'yeniden aktifleştirmek';
    if (!window.confirm(`${user.full_name} adlı kullanıcıyı ${action} istediğinizden emin misiniz?`)) return;

    setStatusUserId(user.id);
    try {
      await systemService.updateSystemUserStatus(user.id, nextStatus);
      setUsers(current => current.map(item => item.id === user.id
        ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
        : item));
    } catch (updateError) {
      alert(updateError instanceof Error ? updateError.message : 'Kullanıcı durumu güncellenemedi.');
    } finally {
      setStatusUserId(null);
    }
  };

  const permanentlyDelete = async (user: SystemUser) => {
    if (!currentUser || user.parent_user_id !== currentUser.id || deletingUserId) return;
    if (!window.confirm(`${user.full_name} adlı kullanıcı kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`)) return;

    const enteredName = window.prompt(`Kalıcı silmeyi onaylamak için kullanıcının tam adını yazın: ${user.full_name}`);
    if (enteredName !== user.full_name) {
      if (enteredName !== null) alert('Girilen kullanıcı adı eşleşmedi. Kalıcı silme iptal edildi.');
      return;
    }

    setDeletingUserId(user.id);
    try {
      await systemService.permanentlyDeleteSystemUser(user.id, enteredName);
      setUsers(current => current.filter(item => item.id !== user.id));
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : 'Kullanıcı kalıcı olarak silinemedi.');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-6 py-8 text-white shadow-xl sm:px-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <UserRoundCheck className="h-7 w-7 text-teal-300" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">Sınırlı Yetki</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Kullanıcı Yönetimi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Kendi hiyerarşinizdeki tüm kullanıcıları görüntüleyebilirsiniz. İşlemler yalnız doğrudan bağlı hesaplarla sınırlıdır.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : users.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Users className="h-9 w-9 text-slate-300" />
          <h2 className="mt-3 font-semibold text-slate-700">Görüntülenebilir kullanıcı yok</h2>
          <p className="mt-1 text-sm text-slate-500">Hiyerarşinizde görüntülenebilir hesap bulunamadı.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.map(user => {
            const isSelf = currentUser?.id === user.id;
            const isDirectReport = currentUser?.id === user.parent_user_id;
            const isUpdating = statusUserId === user.id;
            const isDeleting = deletingUserId === user.id;
            return (
              <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <img
                    src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name}`}
                    alt=""
                    className="h-11 w-11 rounded-xl bg-slate-100"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold text-slate-800">{user.full_name}</h2>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs font-semibold text-teal-700">{user.role}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      {isSelf ? 'Kendi hesabınız' : isDirectReport ? 'Doğrudan bağlı' : 'Dolaylı bağlı · salt okunur'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => void toggleStatus(user)}
                    disabled={!isDirectReport || statusUserId !== null || deletingUserId !== null}
                    title={isDirectReport ? 'Kullanıcı durumunu değiştir' : 'Yalnız doğrudan bağlı kullanıcıların durumu değiştirilebilir'}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${user.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 enabled:hover:bg-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-600 enabled:hover:bg-slate-100'}`}
                  >
                    {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.status === 'active' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {isUpdating ? 'Güncelleniyor' : user.status === 'active' ? 'Aktif' : 'Pasif'}
                  </button>
                  {isDirectReport && (
                    <button
                      type="button"
                      onClick={() => void permanentlyDelete(user)}
                      disabled={deletingUserId !== null || statusUserId !== null}
                      title="Kullanıcıyı kalıcı olarak sil"
                      aria-label={`${user.full_name} kullanıcısını kalıcı olarak sil`}
                      className="rounded-xl bg-rose-50 p-2.5 text-rose-600 transition-colors hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
