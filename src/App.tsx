import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import UniversityDetail from './pages/UniversityDetail';
import CalendarPage from './pages/CalendarPage';
import Statistics from './pages/Statistics';
import Login from './pages/Login';
import { Student, SystemUser, UserRole, UniversityData } from './types';
import { MOCK_USERS } from './services/mockData';

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
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [studentStageFilter, setStudentStageFilter] = useState<string | null>(getStageFromHash());
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  // Demo: Switch between Admin, Consultant, Rep, Student
  const rotateUser = () => {
    if (!currentUser) return;
    const currentIndex = MOCK_USERS.findIndex(u => u.id === currentUser.id);
    const nextIndex = (currentIndex + 1) % MOCK_USERS.length;
    setCurrentUser(MOCK_USERS[nextIndex]);
    // Reset page to dashboard to avoid permission conflicts on current page
    setCurrentPage('dashboard');
  };

  const handleLogin = (user: SystemUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'students':
        if (currentUser && currentUser.role === UserRole.STUDENT) {
          return <div className="p-10 text-slate-500">Access Denied. Students cannot view the CRM list.</div>;
        }
        return <StudentList onSelectStudent={handleStudentSelect} initialStageFilter={studentStageFilter} isSidebarCollapsed={isSidebarCollapsed} />;
      case 'student-detail':
        return selectedStudent ? (
          <StudentDetail student={selectedStudent} onBack={handleBackToStudents} isSidebarCollapsed={isSidebarCollapsed} />
        ) : (
            currentUser && currentUser.role !== UserRole.STUDENT ? <StudentList onSelectStudent={handleStudentSelect} initialStageFilter={studentStageFilter} isSidebarCollapsed={isSidebarCollapsed} /> : <Dashboard />
          );
      case 'settings':
        if (!currentUser || (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.ADMIN)) {
          return <div className="p-10 text-red-500">Access Denied: Admin only.</div>;
        }
        return <Settings onUniversitySelect={handleUniversitySelect} />;
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
        return <CalendarPage />;
      case 'statistics':
        return <Statistics />;
      default:
        return <Dashboard />;
    }
  };

  if (!isAuthenticated || !currentUser) {
    return (
      <Routes>
        <Route path="/*" element={<Login onLogin={handleLogin} />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar 
        currentPage={currentPage} 
        setPage={setCurrentPage} 
        currentUser={currentUser}
        onSwitchUser={rotateUser}
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
