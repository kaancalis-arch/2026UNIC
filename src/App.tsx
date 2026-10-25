import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import StudentAssignments from './pages/StudentAssignments';
import VisaResults from './pages/VisaResults';
import VisaChecklist from './pages/VisaChecklist';
import VisaControl from './pages/VisaControl';
import Roadmaps from './pages/Roadmaps';
import UniversitySearch from './pages/UniversitySearch';
import UniversityResearch from './pages/UniversityResearch';
import DepartmentKeywordRules from './pages/DepartmentKeywordRules';
import UniversityDetail from './pages/UniversityDetail';
import CalendarPage from './pages/CalendarPage';
import Statistics from './pages/Statistics';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import SharedStudentDocument from './pages/SharedStudentDocument';
import SharedAIAdvisorReport from './pages/SharedAIAdvisorReport';
import MyProfile from './pages/MyProfile';
import MyRoadmap from './pages/MyRoadmap';
import MyFiles from './pages/MyFiles';
import { Student, UniversityData, UniversitySearchFilters } from './types';
import { useAuth } from './auth/AuthContext';
import { canAccessPage, getDefaultPage } from './auth/permissions';

const getStageFromHash = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash.replace(/^#/, '');
  const [path, queryString] = hash.split('?');

  if (path !== 'students' || !queryString) {
    return null;
  }

  const params = new URLSearchParams(queryString);
  return params.get('stage');
};

const CURRENT_PAGE_STORAGE_KEY = 'unic-current-page';
const SELECTED_UNIVERSITY_STORAGE_KEY = 'unic-selected-university';

const getStoredCurrentPage = () => {
  if (typeof window === 'undefined') return 'dashboard';
  return window.sessionStorage.getItem(CURRENT_PAGE_STORAGE_KEY) || 'dashboard';
};

const getStoredUniversity = (): UniversityData | null => {
  if (typeof window === 'undefined') return null;
  const storedUniversity = window.sessionStorage.getItem(SELECTED_UNIVERSITY_STORAGE_KEY);
  if (!storedUniversity) return null;

  try {
    return JSON.parse(storedUniversity) as UniversityData;
  } catch {
    window.sessionStorage.removeItem(SELECTED_UNIVERSITY_STORAGE_KEY);
    return null;
  }
};

const App: React.FC = () => {
  const { currentUser, isAuthenticated, isLoading, isPasswordRecovery, signOut } = useAuth();
  const { pathname } = useLocation();
  const [currentPage, setCurrentPage] = useState(getStoredCurrentPage);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityData | null>(getStoredUniversity);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [studentStageFilter, setStudentStageFilter] = useState<string | null>(getStageFromHash());
  const [dashboardSearchRequest, setDashboardSearchRequest] = useState<{ filters: UniversitySearchFilters; id: number } | null>(null);
  const shareTokenMatch = pathname.match(/^\/share\/document\/([^/]+)\/?$/);
  const reportShareTokenMatch = pathname.match(/^\/share\/report\/([^/]+)\/?$/);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setCurrentPage('dashboard');
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (currentUser && !canAccessPage(currentUser, currentPage)) {
      setCurrentPage(getDefaultPage(currentUser));
    }
  }, [currentPage, currentUser]);

  useEffect(() => {
    window.sessionStorage.setItem(CURRENT_PAGE_STORAGE_KEY, currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (selectedUniversity) {
      window.sessionStorage.setItem(SELECTED_UNIVERSITY_STORAGE_KEY, JSON.stringify(selectedUniversity));
    } else {
      window.sessionStorage.removeItem(SELECTED_UNIVERSITY_STORAGE_KEY);
    }
  }, [selectedUniversity]);

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setCurrentPage('student-detail');
  };

  const handleBackToStudents = () => {
    setSelectedStudent(null);
    setCurrentPage('students');
  };

  const handleUniversitySelect = (university: UniversityData) => {
    setSelectedUniversity(university);
    setCurrentPage('university-detail');
  };

  const handleBackToUniversities = () => {
    setSelectedUniversity(null);
    setCurrentPage('settings');
  };

  const handleDashboardUniversitySearch = (filters: UniversitySearchFilters) => {
    if (!currentUser || !canAccessPage(currentUser, 'universities')) return;
    setDashboardSearchRequest({ filters, id: Date.now() });
    setCurrentPage('universities');
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Oturum kapatma isteği tamamlanamadı.', error);
    } finally {
      window.sessionStorage.removeItem(CURRENT_PAGE_STORAGE_KEY);
      window.sessionStorage.removeItem(SELECTED_UNIVERSITY_STORAGE_KEY);
      window.sessionStorage.removeItem('unic-settings-active-tab');
      window.sessionStorage.removeItem('unic-settings-selected-view');
      setCurrentPage('dashboard');
    }
  };

  const renderContent = () => {
    if (!canAccessPage(currentUser!, currentPage)) {
      return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-800">Bu sayfayı görüntüleme yetkiniz bulunmuyor.</div>;
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            onUniversitySearch={handleDashboardUniversitySearch}
            canOpenUniversitySearch={canAccessPage(currentUser!, 'universities')}
          />
        );
      case 'students':
        return <StudentList onSelectStudent={handleStudentSelect} initialStageFilter={studentStageFilter} isSidebarCollapsed={isSidebarCollapsed} />;
      case 'student-detail':
        return selectedStudent ? (
          <StudentDetail student={selectedStudent} onBack={handleBackToStudents} isSidebarCollapsed={isSidebarCollapsed} />
        ) : (
            <StudentList onSelectStudent={handleStudentSelect} initialStageFilter={studentStageFilter} isSidebarCollapsed={isSidebarCollapsed} />
          );
      case 'settings':
        return <Settings onUniversitySelect={handleUniversitySelect} onDepartmentKeywordRulesOpen={() => setCurrentPage('department-keyword-rules')} />;
      case 'user-management':
        return <UserManagement />;
      case 'student-assignments':
        return <StudentAssignments />;
      case 'department-keyword-rules':
        return <DepartmentKeywordRules />;
      case 'universities':
        return (
          <UniversitySearch
            initialFilters={dashboardSearchRequest?.filters}
            filterRequestId={dashboardSearchRequest?.id}
            onFilterRequestHandled={() => setDashboardSearchRequest(null)}
          />
        );
      case 'university-research':
        return <UniversityResearch />;
      case 'university-detail':
        return selectedUniversity ? (
          <UniversityDetail university={selectedUniversity} onBack={handleBackToUniversities} onUniversityUpdated={setSelectedUniversity} />
        ) : (
          <Settings />
        );
      case 'roadmap':
        return <Roadmaps />;
      case 'files':
        return <MyFiles userId={currentUser!.id} />;
      case 'my-profile':
        return <MyProfile userId={currentUser!.id} />;
      case 'my-roadmap':
        return <MyRoadmap userId={currentUser!.id} />;
      case 'visa-results':
        return <VisaResults />;
      case 'visa-checklist':
        return <VisaChecklist currentUser={currentUser!} />;
      case 'visa-control':
        return <VisaControl currentUser={currentUser!} />;
      case 'calendar':
        return <CalendarPage currentUser={currentUser!} />;
      case 'statistics':
        return <Statistics />;
      default:
        return (
          <Dashboard
            onUniversitySearch={handleDashboardUniversitySearch}
            canOpenUniversitySearch={canAccessPage(currentUser!, 'universities')}
          />
        );
    }
  };

  if (shareTokenMatch) {
    return <SharedStudentDocument token={shareTokenMatch[1]} />;
  }

  if (reportShareTokenMatch) {
    return <SharedAIAdvisorReport token={reportShareTokenMatch[1]} />;
  }

  if (isPasswordRecovery || pathname === '/reset-password' || pathname === '/reset-password/') {
    return <ResetPassword />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar 
        currentPage={currentPage} 
        setPage={setCurrentPage} 
        currentUser={currentUser}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <main className={`flex-1 p-8 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} transition-[margin] duration-300`}>
        <div className="max-w-6xl mx-auto h-full">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
