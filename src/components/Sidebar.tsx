
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Map, 
  FileText, 
  Settings as SettingsIcon,
  Bot,
  LogOut,
  User,
  Shield,
  Briefcase,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
  ShieldCheck,
  ClipboardCheck,
  Award
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  setPage: (page: string) => void;
  currentUser: SystemUser;
  onSwitchUser: () => void;
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
  isCollapsed,
  onToggle
}) => {
  
  // Define nav items based on role
  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ];

    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CONSULTANT || currentUser.role === UserRole.REPRESENTATIVE) {
        baseItems.push({ id: 'students', label: 'Students (CRM)', icon: Users });
    }

    if (currentUser.role === UserRole.STUDENT) {
        baseItems.push({ id: 'my-profile', label: 'My Profile', icon: User });
        baseItems.push({ id: 'my-roadmap', label: 'My Roadmap', icon: Map });
    } else {
        baseItems.push({ id: 'universities', label: 'University Search', icon: GraduationCap });
        baseItems.push({ id: 'roadmap', label: 'Roadmaps', icon: Map });
    }
    
    baseItems.push({ id: 'files', label: 'File Manager', icon: FileText });
    
    // Visa Section
    baseItems.push({ 
      id: 'visa', 
      label: 'Visa', 
      icon: ShieldCheck,
      subItems: [
        { id: 'visa-results', label: 'Results', icon: Award },
        { id: 'visa-checklist', label: 'Checklist', icon: ClipboardCheck },
      ]
    });
    
    return baseItems;
  };

  const navItems = getNavItems();

  const [expandedItems, setExpandedItems] = React.useState<string[]>(['visa']);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className={`h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-xl z-50 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Brand */}
      <div className={`p-6 flex items-center border-b border-slate-800 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'gap-3'}`}>
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
          <Bot className="text-white w-6 h-6" />
        </div>
        {!isCollapsed && (
          <div className="animate-fade-in">
            <h1 className="font-bold text-xl tracking-tight">UNIC</h1>
            <p className="text-xs text-slate-400">Powered by Gemini</p>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button 
        onClick={onToggle}
        className="absolute -right-3 top-20 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-500 transition-colors z-50"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 rotate-180" />}
      </button>

      {/* Navigation */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item: any) => {
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
                className={`w-full flex items-center rounded-xl transition-all duration-200 ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="font-medium text-sm flex-1 text-left truncate">{item.label}</span>
                    {hasSubItems && (
                      isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                    )}
                  </>
                )}
              </button>
              
              {hasSubItems && isExpanded && !isCollapsed && (
                <div className="ml-9 space-y-1 animate-fade-in">
                  {item.subItems.map((subItem: any) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = currentPage === subItem.id;
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => setPage(subItem.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isSubActive 
                            ? 'text-white bg-slate-800' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <SubIcon className="w-4 h-4 shrink-0" />
                        <span className="text-sm truncate">{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Section */}
      <div className={`p-4 border-t border-slate-800 space-y-2 transition-all duration-300 ${isCollapsed ? 'px-2' : ''}`}>
        
        {/* Admin Settings Link */}
        {currentUser.role === UserRole.ADMIN && (
             <button 
                onClick={() => setPage('settings')}
                title={isCollapsed ? 'System Settings' : ''}
                className={`w-full flex items-center rounded-xl transition-colors ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${
                    currentPage === 'settings' 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
                <SettingsIcon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="font-medium text-sm">System Settings</span>}
            </button>
        )}

        {/* User Profile / Role Switcher Demo */}
        <div 
            onClick={onSwitchUser}
            className={`w-full flex items-center bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700 ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-3'}`}
            title={isCollapsed ? `${currentUser.firstName} (${currentUser.role})` : "Click to switch simulated role (Demo)"}
        >
            <div className="relative shrink-0">
                <img src={currentUser.avatarUrl} className="w-8 h-8 rounded-full bg-slate-700" />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    currentUser.role === UserRole.ADMIN ? 'bg-purple-500' :
                    currentUser.role === UserRole.CONSULTANT ? 'bg-indigo-500' :
                    'bg-amber-500'
                }`}></div>
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{currentUser.firstName}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser.role}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </>
            )}
        </div>

        <button 
          title={isCollapsed ? 'Sign Out' : ''}
          className={`w-full flex items-center text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-xl transition-colors text-xs font-medium ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-2'}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
