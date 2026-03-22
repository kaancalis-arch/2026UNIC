
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import Settings from './pages/Settings';
import VisaResults from './pages/VisaResults';
import VisaChecklist from './pages/VisaChecklist';
import Roadmaps from './pages/Roadmaps';
import { Student, SystemUser, UserRole } from './types';
import { MOCK_USERS } from './services/mockData';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Auth Simulation
  const [currentUser, setCurrentUser] = useState<SystemUser>(MOCK_USERS[0]); // Default to Admin
  
  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setCurrentPage('student-detail');
  };

  const handleBackToStudents = () => {
    setSelectedStudent(null);
    setCurrentPage('students');
  };

  // Demo: Switch between Admin, Consultant, Rep, Student
  const rotateUser = () => {
      const currentIndex = MOCK_USERS.findIndex(u => u.id === currentUser.id);
      const nextIndex = (currentIndex + 1) % MOCK_USERS.length;
      setCurrentUser(MOCK_USERS[nextIndex]);
      // Reset page to dashboard to avoid permission conflicts on current page
      setCurrentPage('dashboard');
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'students':
        if (currentUser.role === UserRole.STUDENT) return <div className="p-10 text-slate-500">Access Denied. Students cannot view the CRM list.</div>;
        return <StudentList onSelectStudent={handleStudentSelect} />;
      case 'student-detail':
        return selectedStudent ? (
          <StudentDetail student={selectedStudent} onBack={handleBackToStudents} />
        ) : (
           currentUser.role !== UserRole.STUDENT ? <StudentList onSelectStudent={handleStudentSelect} /> : <Dashboard />
        );
      case 'settings':
        if (currentUser.role !== UserRole.ADMIN) return <div className="p-10 text-red-500">Access Denied: Admin only.</div>;
        return <Settings />;
      case 'universities':
        return <div className="p-10 text-center text-slate-500">University Search Module (Coming Soon)</div>;
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
        return <VisaChecklist />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar 
        currentPage={currentPage} 
        setPage={setCurrentPage} 
        currentUser={currentUser}
        onSwitchUser={rotateUser}
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
