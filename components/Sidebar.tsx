
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
  ChevronRight
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  setPage: (page: string) => void;
  currentUser: SystemUser;
  onSwitchUser: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setPage, currentUser, onSwitchUser }) => {
  
  // Define nav items based on role
  const getNavItems = () => {
    const baseItems = [
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
    
    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-xl z-50">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Bot className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight">UNIC</h1>
          <p className="text-xs text-slate-400">Powered by Gemini</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        
        {/* Admin Settings Link */}
        {currentUser.role === UserRole.ADMIN && (
             <button 
                onClick={() => setPage('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    currentPage === 'settings' 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
                <SettingsIcon className="w-5 h-5" />
                <span className="font-medium text-sm">System Settings</span>
            </button>
        )}

        {/* User Profile / Role Switcher Demo */}
        <div 
            onClick={onSwitchUser}
            className="w-full flex items-center gap-3 px-3 py-3 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700"
            title="Click to switch simulated role (Demo)"
        >
            <div className="relative">
                <img src={currentUser.avatarUrl} className="w-8 h-8 rounded-full bg-slate-700" />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    currentUser.role === UserRole.ADMIN ? 'bg-purple-500' :
                    currentUser.role === UserRole.CONSULTANT ? 'bg-indigo-500' :
                    'bg-amber-500'
                }`}></div>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentUser.firstName}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser.role}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>

        <button className="w-full flex items-center gap-3 px-4 py-2 text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-xl transition-colors text-xs font-medium">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
