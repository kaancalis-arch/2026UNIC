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
  ChartPie,
  CheckCircle,
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';

const ResearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`${className || ''} inline-flex items-center justify-center text-base leading-none`}>📊</span>
);

interface SidebarProps {
  currentPage: string;
  setPage: (page: string) => void;
  currentUser: SystemUser;
  onSwitchUser: () => void;
  onLogout: () => void;
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
  onSwitchUser,
  onLogout,
  isCollapsed,
  onToggle
}: SidebarProps) => {
  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ];

    if (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.BRANCH_MANAGER || currentUser.role === UserRole.CONSULTANT || currentUser.role === UserRole.REPRESENTATIVE || currentUser.role === UserRole.STUDENT_REPRESENTATIVE) {
      baseItems.push({ id: 'students', label: 'CRM', icon: Users });
    }

    if (currentUser.role === UserRole.STUDENT) {
      baseItems.push({ id: 'my-profile', label: 'My Profile', icon: User });
      baseItems.push({ id: 'my-roadmap', label: 'My Roadmap', icon: Map });
    } else {
      baseItems.push({ id: 'statistics', label: 'Statistics', icon: ChartPie });
      baseItems.push({ id: 'universities', label: 'University Search', icon: GraduationCap });
      baseItems.push({ id: 'university-research', label: 'Üniversite Araştırma', icon: ResearchIcon });
      baseItems.push({ id: 'calendar', label: 'Calendar', icon: CalendarDays });
      baseItems.push({ id: 'roadmap', label: 'Roadmaps', icon: Map });
    }

    baseItems.push({
      id: 'visa',
      label: 'Visa',
      icon: ShieldCheck,
      subItems: [
        { id: 'visa-results', label: 'Results', icon: Award },
        { id: 'visa-checklist', label: 'Checklist', icon: ClipboardCheck },
        { id: 'visa-control', label: 'Vize Kontrol Formu', icon: CheckCircle },
      ]
    });

    return baseItems;
  };

  const navItems = getNavItems();
  const [expandedItems, setExpandedItems] = React.useState<string[]>(['visa']);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  return (
    <div className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white shadow-xl transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center border-b border-slate-800 p-4 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-center'}`}>
        <img
          src="https://qwualszqafxjorumgttv.supabase.co/storage/v1/object/sign/Unic_Main/UNIC%20Dark%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yZjYzOGI0OC0wNTc0LTQ2OTItYmQwZi1lZDk3NzM3Njk2ODkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJVbmljX01haW4vVU5JQyBEYXJrIExvZ28ucG5nIiwiaWF0IjoxNzc0OTc5NDE5LCJleHAiOjI2Mzg5Nzk0MTl9.8gNdL0DIenvyeJ9eopJ0Qfm_5m_ggT-FB-KhVUpnzg0"
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
          const isActive = currentPage === item.id;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedItems.includes(item.id);

          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  if (hasSubItems && !isCollapsed) {
                    toggleExpand(item.id);
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
        {(currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN) && (
          <button
            onClick={() => setPage('settings')}
            title={isCollapsed ? 'System Settings' : ''}
            className={`w-full rounded-xl transition-colors ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} flex items-center ${currentPage === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <SettingsIcon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">System Settings</span>}
          </button>
        )}

        <div
          onClick={onSwitchUser}
          className={`w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-800/50 transition-colors hover:border-slate-700 hover:bg-slate-800 ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-3'} flex items-center`}
          title={isCollapsed ? `${currentUser.full_name} (${currentUser.role})` : 'Click to switch simulated role (Demo)'}
        >
          <div className="relative shrink-0">
            <img src={currentUser.avatarUrl} className="h-8 w-8 rounded-full bg-slate-700" />
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
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </>
          )}
        </div>

         <button
           onClick={onLogout}
           title={isCollapsed ? 'Sign Out' : ''}
           className={`w-full rounded-xl text-xs font-medium text-rose-400 transition-colors hover:bg-slate-800 hover:text-rose-300 ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-2'} flex items-center`}
         >
           <LogOut className="h-4 w-4 shrink-0" />
           {!isCollapsed && <span>Sign Out</span>}
         </button>
      </div>
    </div>
  );
};

export default Sidebar;
