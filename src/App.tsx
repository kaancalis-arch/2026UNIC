import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import Settings from './pages/Settings';
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
import { Student, UniversityData } from './types';
import { useAuth } from './auth/AuthContext';
import { canAccessPage } from './auth/permissions';

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

const App: React.FC = () => {
  const { currentUser, isAuthenticated, isLoading, isPasswordRecovery, signOut } = useAuth();
  const { pathname } = useLocation();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [studentStageFilter, setStudentStageFilter] = useState<string | null>(getStageFromHash());

  useEffect(() => {
    if (!isAuthenticated) setCurrentPage('dashboard');
  }, [isAuthenticated]);

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

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Oturum kapatma isteği tamamlanamadı.', error);
    } finally {
      setCurrentPage('dashboard');
    }
  };

  const renderContent = () => {
    if (!canAccessPage(currentUser!.role, currentPage)) {
      return <div className="p-10 text-red-500">Access Denied.</div>;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
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
      case 'department-keyword-rules':
        return <DepartmentKeywordRules />;
      case 'universities':
        return <UniversitySearch />;
      case 'university-research':
        return <UniversityResearch />;
      case 'university-detail':
        return selectedUniversity ? (
          <UniversityDetail university={selectedUniversity} onBack={handleBackToUniversities} />
        ) : (
          <Settings />
        );
      case 'roadmap':
        return <Roadmaps />;
      case 'files':
        return <div className="p-10 text-center text-slate-500">Global File Manager (Coming Soon)</div>;
      case 'my-profile':
        // For student view simulation
        return <div className="p-10 text-center text-slate-500">My Student Profile View (Under Construction)</div>;
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
        return <Dashboard />;
    }
  };

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
