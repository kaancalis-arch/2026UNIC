import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Map,
  Settings as SettingsIcon,
  LogOut,
  User,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
  ShieldCheck,
  ClipboardCheck,
  Award,
  CalendarDays,
  CheckCircle,
  UserRoundCog,
  FolderOpen,
  Settings2,
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';
import { canAccessPage } from '../auth/permissions';
import { getPublicStorageUrl } from '../services/supabaseClient';

const UNIC_DARK_LOGO_URL = getPublicStorageUrl('Unic_Main', 'UNIC Dark Logo.png');

const ResearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`${className || ''} inline-flex items-center justify-center text-base leading-none`}>📊</span>
);

interface SidebarProps {
  currentPage: string;
  setPage: (page: string) => void;
  currentUser: SystemUser;
  onLogout: () => void | Promise<void>;
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  subItems?: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setPage,
  currentUser,
  onLogout,
  isCollapsed,
  onToggle
}: SidebarProps) => {
  const getNavItems = (): NavItem[] => {
    const role = currentUser.role;
    const baseItems: NavItem[] = [];

    if (canAccessPage(currentUser, 'dashboard')) {
      baseItems.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
    }

    if (canAccessPage(currentUser, 'students')) {
      baseItems.push({ id: 'students', label: 'CRM Öğrenci Takip', icon: Users });
    }

    if (role === UserRole.STUDENT) {
      baseItems.push({ id: 'my-profile', label: 'Profilim', icon: User });
      baseItems.push({ id: 'my-roadmap', label: 'Yol Haritam', icon: Map });
      baseItems.push({ id: 'files', label: 'Dosyalarım', icon: FolderOpen });
    } else {
      baseItems.push({ id: 'universities', label: 'Üniversite Araştırması', icon: GraduationCap });
      baseItems.push({ id: 'calendar', label: 'Takvim', icon: CalendarDays });
      baseItems.push({ id: 'roadmap', label: 'Yol Haritası', icon: Map });
    }

    baseItems.push({
      id: 'visa',
      label: 'Vize',
      icon: ShieldCheck,
      subItems: [
        { id: 'visa-results', label: 'Sonuçlar', icon: Award },
        { id: 'visa-checklist', label: 'Kontrol Listesi', icon: ClipboardCheck },
        { id: 'visa-control', label: 'Vize Kontrol Formu', icon: CheckCircle },
      ]
    });

    const systemItems: NavItem[] = [];
    if (canAccessPage(currentUser, 'student-assignments')) {
      systemItems.push({ id: 'student-assignments', label: 'Öğrenci Atamaları', icon: UserRoundCog });
    }
    if (canAccessPage(currentUser, 'university-research')) {
      systemItems.push({ id: 'university-research', label: 'Üniversite Araştırma', icon: ResearchIcon });
    }
    if (canAccessPage(currentUser, 'user-management') && !canAccessPage(currentUser, 'settings')) {
      systemItems.push({ id: 'user-management', label: 'Kullanıcı Yönetimi', icon: Users });
    }
    if (systemItems.length > 0) {
      baseItems.push({ id: 'system', label: 'Sistem', icon: Settings2, subItems: systemItems });
    }

    return baseItems
      .map((item) => ({
        ...item,
        subItems: item.subItems?.filter((subItem) => canAccessPage(currentUser, subItem.id)),
      }))
      .filter((item) => item.subItems ? item.subItems.length > 0 : canAccessPage(currentUser, item.id));
  };

  const navItems = getNavItems();
  const [expandedItems, setExpandedItems] = React.useState<string[]>(['visa', 'system']);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  return (
    <div className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white shadow-xl transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center border-b border-slate-800 p-4 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-center'}`}>
        <img
          src={UNIC_DARK_LOGO_URL}
          alt="UNIC logo"
          className={`${isCollapsed ? 'h-14 w-14' : 'h-28 w-auto max-w-[260px]'} shrink-0 rounded-2xl bg-transparent object-contain`}
        />
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-500"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rotate-180" />}
      </button>

      <div className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isActive = currentPage === item.id
            || (hasSubItems && item.subItems!.some((subItem) => subItem.id === currentPage));
          const isExpanded = expandedItems.includes(item.id);

          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  if (hasSubItems) {
                    if (isCollapsed) {
                      setPage(item.subItems![0].id);
                    } else {
                      toggleExpand(item.id);
                    }
                  } else {
                    setPage(item.id);
                  }
                }}
                title={isCollapsed ? item.label : ''}
                className={`w-full rounded-xl transition-all duration-200 ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} flex items-center ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate text-left text-sm font-medium">{item.label}</span>
                    {hasSubItems && (isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                  </>
                )}
              </button>

              {hasSubItems && isExpanded && !isCollapsed && (
                <div className="ml-9 space-y-1 animate-fade-in">
                  {item.subItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = currentPage === subItem.id;

                    return (
                      <button
                        key={subItem.id}
                        onClick={() => setPage(subItem.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 ${isSubActive ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}`}
                      >
                        <SubIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm">{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`space-y-2 border-t border-slate-800 p-4 transition-all duration-300 ${isCollapsed ? 'px-2' : ''}`}>
        {canAccessPage(currentUser, 'settings') && (
          <button
            onClick={() => setPage('settings')}
            title={isCollapsed ? 'Sistem Ayarları' : ''}
            className={`w-full rounded-xl transition-colors ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} flex items-center ${currentPage === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <SettingsIcon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Sistem Ayarları</span>}
          </button>
        )}

        <div
          className={`flex w-full items-center rounded-xl border border-slate-800 bg-slate-800/50 ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-3'}`}
          title={isCollapsed ? `${currentUser.full_name} (${currentUser.role})` : undefined}
        >
          <div className="relative shrink-0">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="h-8 w-8 rounded-full bg-slate-700 object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                <User className="h-4 w-4" />
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-slate-900 ${
              currentUser.role === UserRole.SUPER_ADMIN ? 'bg-red-500' :
              currentUser.role === UserRole.ADMIN ? 'bg-purple-500' :
              currentUser.role === UserRole.BRANCH_MANAGER ? 'bg-blue-500' :
              currentUser.role === UserRole.CONSULTANT ? 'bg-indigo-500' :
              currentUser.role === UserRole.REPRESENTATIVE ? 'bg-green-500' :
              currentUser.role === UserRole.STUDENT_REPRESENTATIVE ? 'bg-yellow-500' :
              'bg-amber-500'
            }`} />
          </div>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{currentUser.full_name}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{currentUser.role}</p>
              </div>
            </>
          )}
        </div>

         <button
           onClick={() => void onLogout()}
           title={isCollapsed ? 'Çıkış Yap' : ''}
           className={`w-full rounded-xl text-xs font-medium text-rose-400 transition-colors hover:bg-slate-800 hover:text-rose-300 ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-2'} flex items-center`}
         >
           <LogOut className="h-4 w-4 shrink-0" />
           {!isCollapsed && <span>Çıkış Yap</span>}
         </button>
      </div>
    </div>
  );
};

export default Sidebar;
