import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  studentAssignmentService,
  type StudentAssignmentBranch,
  type StudentAssignmentInput,
  type StudentAssignmentUser,
} from '../services/studentAssignmentService';
import { studentService } from '../services/studentService';
import type { Student } from '../types';
import { UserRole } from '../types';

const UNCHANGED = '__unchanged__';
const CLEAR = '__clear__';

const StudentAssignments = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<StudentAssignmentBranch[]>([]);
  const [users, setUsers] = useState<StudentAssignmentUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [branchAction, setBranchAction] = useState(UNCHANGED);
  const [userAction, setUserAction] = useState(UNCHANGED);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isBranchManager = currentUser?.role === UserRole.BRANCH_MANAGER;

  const fetchData = async () => {
    const [studentRows, options] = await Promise.all([
      studentService.getAll(),
      studentAssignmentService.getOptions(),
    ]);
    setStudents(studentRows);
    setBranches(options.branches);
    setUsers(options.users);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      await fetchData();
      setRequiresRefresh(false);
      setSelectedIds([]);
      setBranchAction(UNCHANGED);
      setUserAction(UNCHANGED);
    } catch (loadError) {
      setRequiresRefresh(true);
      setError(loadError instanceof Error ? loadError.message : 'Öğrenci atama bilgileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const branchName = (id?: string) => branches.find(branch => branch.id === id)?.name || 'Atanmamış';
  const userName = (id?: string) => users.find(user => user.id === id)?.fullName || (id ? 'Uygun olmayan sorumlu' : 'Atanmamış');
  const normalizedSearch = search.trim().toLocaleLowerCase('tr');
  const filteredStudents = students.filter(student => {
    const contact = `${student.firstName} ${student.lastName} ${student.email || ''} ${student.phone || ''}`
      .toLocaleLowerCase('tr');
    if (normalizedSearch && !contact.includes(normalizedSearch)) return false;
    if (branchFilter && (student.branchId || '') !== branchFilter) return false;
    if (userFilter && (student.assignedUserId || '') !== userFilter) return false;
    if (unassignedOnly && student.assignedUserId) return false;
    return true;
  });

  const selectedStudents = students.filter(student => selectedIds.includes(student.id));
  const selectedBranchIds = Array.from(new Set(selectedStudents.map(student => student.branchId || '')));
  const effectiveTargetBranch = isBranchManager
    ? currentUser?.branch_id || ''
    : branchAction !== UNCHANGED && branchAction !== CLEAR
      ? branchAction
      : branchAction === UNCHANGED && selectedBranchIds.length === 1
        ? selectedBranchIds[0]
        : '';
  const availableUsers = users.filter(user => user.branchId === effectiveTargetBranch);
  const visibleIds = filteredStudents.map(student => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const hasAssignmentChange = (!isBranchManager && branchAction !== UNCHANGED) || userAction !== UNCHANGED;

  useEffect(() => {
    if (userAction !== UNCHANGED && userAction !== CLEAR && !availableUsers.some(user => user.id === userAction)) {
      setUserAction(UNCHANGED);
    }
  }, [effectiveTargetBranch, userAction, users]);

  const toggleStudent = (id: string) => {
    setSelectedIds(current => {
      if (current.includes(id)) return current.filter(studentId => studentId !== id);
      if (current.length >= 100) {
        alert('Bir toplu işlemde en fazla 100 öğrenci seçilebilir.');
        return current;
      }
      return [...current, id];
    });
  };

  const toggleVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(current => current.filter(id => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds(current => {
      const additions = visibleIds.filter(id => !current.includes(id));
      const capacity = 100 - current.length;
      if (additions.length > capacity) alert('En fazla 100 öğrenci seçildi.');
      return [...current, ...additions.slice(0, capacity)];
    });
  };

  const handleBranchAction = (value: string) => {
    setBranchAction(value);
    if (value === CLEAR) setUserAction(CLEAR);
    if (value !== UNCHANGED && value !== CLEAR) {
      const selectedUser = users.find(user => user.id === userAction);
      if (selectedUser && selectedUser.branchId !== value) setUserAction(UNCHANGED);
    }
  };

  const applyAssignment = async () => {
    if (!currentUser || selectedIds.length === 0 || !hasAssignmentChange || isProcessing || requiresRefresh) return;
    const branchText = isBranchManager || branchAction === UNCHANGED
      ? 'şube değişmeden'
      : branchAction === CLEAR
        ? 'şube ataması kaldırılarak'
        : `${branchName(branchAction)} şubesine`;
    const userText = userAction === UNCHANGED
      ? 'sorumlu ataması korunarak'
      : userAction === CLEAR
        ? 'sorumlu ataması kaldırılarak'
        : `${userName(userAction)} sorumluluğuna`;
    if (!window.confirm(`${selectedIds.length} öğrenci ${branchText}, ${userText} güncellenecek. Devam etmek istiyor musunuz?`)) return;

    const input: StudentAssignmentInput = { studentIds: selectedIds };
    if (!isBranchManager && branchAction !== UNCHANGED) {
      input.branchId = branchAction === CLEAR ? null : branchAction;
    }
    if (userAction !== UNCHANGED) input.assignedUserId = userAction === CLEAR ? null : userAction;

    setIsProcessing(true);
    setError('');
    setSuccess('');
    let changedCount: number;
    try {
      const result = await studentAssignmentService.assign(input);
      changedCount = result.changedCount;
      setSelectedIds([]);
      setBranchAction(UNCHANGED);
      setUserAction(UNCHANGED);
      setRequiresRefresh(true);
    } catch (assignmentError) {
      setError(assignmentError instanceof Error ? assignmentError.message : 'Öğrenci ataması tamamlanamadı.');
      setIsProcessing(false);
      return;
    }

    try {
      await fetchData();
      setRequiresRefresh(false);
      setSuccess(`${changedCount} öğrencinin atama bilgisi güncellendi. Liste veritabanından yenilendi.`);
    } catch (refreshError) {
      setError(`Atama tamamlandı ancak liste yenilenemedi. Yeni işlem yapmadan önce Yenile'yi kullanın. ${refreshError instanceof Error ? refreshError.message : ''}`.trim());
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-teal-950 px-6 py-8 text-white shadow-xl sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15"><UserRoundCog className="h-7 w-7 text-teal-300" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">Rol Bazlı Yönetim</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Öğrenci Atamaları</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Öğrencilerin şube ve sorumlu kullanıcı atamalarını güvenli toplu işlemlerle yönetin.</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={isProcessing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
        </div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ad, e-posta veya telefon ara" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400" />
          </label>
          <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
            <option value="">Tüm şubeler</option>
            {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <select value={userFilter} onChange={event => setUserFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
            <option value="">Tüm sorumlular</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={unassignedOnly} onChange={event => setUnassignedOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" /> Atanmamış öğrenciler
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-slate-800"><UsersRound className="h-5 w-5 text-indigo-600" />{selectedIds.length} öğrenci seçildi <span className="text-xs font-normal text-slate-500">(en fazla 100)</span></div>
          {selectedIds.length > 0 && <button type="button" onClick={() => setSelectedIds([])} disabled={isProcessing} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">Seçimi temizle</button>}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          {isBranchManager ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><Building2 className="h-4 w-4 text-slate-400" />{branchName(currentUser?.branch_id)} <span className="ml-auto text-xs text-slate-400">Sabit</span></div>
          ) : (
            <select value={branchAction} onChange={event => handleBranchAction(event.target.value)} disabled={isProcessing} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value={UNCHANGED}>Şubeyi değiştirme</option>
              <option value={CLEAR}>Şube atamasını kaldır</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name} şubesine ata</option>)}
            </select>
          )}
          <select value={userAction} onChange={event => setUserAction(event.target.value)} disabled={isProcessing} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100">
            <option value={UNCHANGED}>Sorumluyu değiştirme</option>
            <option value={CLEAR}>Sorumlu atamasını kaldır</option>
            {availableUsers.map(user => <option key={user.id} value={user.id}>{user.fullName} ({user.role})</option>)}
          </select>
          <button type="button" onClick={() => void applyAssignment()} disabled={isProcessing || requiresRefresh || selectedIds.length === 0 || !hasAssignmentChange} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCog className="h-4 w-4" />}{isProcessing ? 'Atanıyor...' : requiresRefresh ? 'Önce Listeyi Yenileyin' : 'Seçilenleri Güncelle'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={isProcessing || visibleIds.length === 0} className="h-4 w-4 rounded border-slate-300 text-indigo-600" /> Görünenleri seç</label>
          <span>{filteredStudents.length} öğrenci</span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Filtrelere uygun öğrenci bulunamadı.</div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {filteredStudents.map(student => (
                <article key={student.id} className={`rounded-2xl border p-4 ${selectedIds.includes(student.id) ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} disabled={isProcessing} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    <div className="min-w-0 flex-1"><h2 className="font-bold text-slate-800">{student.firstName} {student.lastName}</h2><p className="truncate text-xs text-slate-500">{student.email || '-'} · {student.phone || '-'}</p></div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Şube</dt><dd className="mt-1 font-semibold text-slate-700">{branchName(student.branchId)}</dd></div><div><dt className="text-slate-400">Sorumlu</dt><dd className="mt-1 font-semibold text-slate-700">{userName(student.assignedUserId)}</dd></div></dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="w-12 px-5 py-3"></th><th className="px-5 py-3">Öğrenci</th><th className="px-5 py-3">İletişim</th><th className="px-5 py-3">Mevcut Şube</th><th className="px-5 py-3">Mevcut Sorumlu</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className={selectedIds.includes(student.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                      <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} disabled={isProcessing} className="h-4 w-4 rounded border-slate-300 text-indigo-600" /></td>
                      <td className="px-5 py-4 font-semibold text-slate-800">{student.firstName} {student.lastName}</td>
                      <td className="px-5 py-4 text-slate-500"><div>{student.email || '-'}</div><div className="text-xs">{student.phone || '-'}</div></td>
                      <td className="px-5 py-4 text-slate-700">{branchName(student.branchId)}</td>
                      <td className="px-5 py-4 text-slate-700">{userName(student.assignedUserId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default StudentAssignments;
