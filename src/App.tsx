import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { TeacherView } from './components/teacher/TeacherView';
import { StudentJoin } from './components/student/StudentJoin';
import { StudentView } from './components/student/StudentView';
import { StudentHomeworkView } from './components/student/homework/StudentHomeworkView';
import { TeacherAuthModal } from './components/teacher/TeacherAuthModal';
import { isTeacherAuthorized } from './lib/rosterApi';
import { useTheme } from './context/ThemeContext';

export const App: React.FC = () => {
  // Synchronous initial role determination:
  // ONLY authorized teacher devices open directly in teacher mode.
  // ALL unverified devices (student devices, direct root URL) open safely in student mode!
  const [role, setRole] = useState<'teacher' | 'student'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      const roleParam = params.get('role');
      if (roleParam === 'student' || roomParam) return 'student';
      if (roleParam === 'teacher' && isTeacherAuthorized()) return 'teacher';
      return isTeacherAuthorized() ? 'teacher' : 'student';
    } catch {
      return 'student';
    }
  });

  // Strict student lock: hides role switcher from unverified devices on the root URL
  const [isStudentLocked, setIsStudentLocked] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      const roleParam = params.get('role');
      if (roleParam === 'student' || roomParam) return true;
      return !isTeacherAuthorized();
    } catch {
      return true;
    }
  });

  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
  const [studentSession, setStudentSession] = useState<{
    roomId: string;
    studentId: string;
    studentName: string;
    seatNum: number;
    isHomework?: boolean;
  } | null>(null);

  const { theme } = useTheme();

  // Check URL query parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role');

    if (roleParam === 'student' || roomParam) {
      setRole('student');
      setIsStudentLocked(true);
    } else if (roleParam === 'teacher') {
      if (isTeacherAuthorized()) {
        setRole('teacher');
        setIsStudentLocked(false);
      } else {
        setRole('student');
        setIsStudentLocked(true);
        setShowTeacherAuthModal(true);
      }
    } else {
      if (isTeacherAuthorized()) {
        setRole('teacher');
        setIsStudentLocked(false);
      } else {
        setRole('student');
        setIsStudentLocked(true);
      }
    }
  }, []);

  const handleSwitchRole = (targetRole: 'teacher' | 'student') => {
    if (targetRole === 'student') {
      setRole('student');
    } else {
      if (isTeacherAuthorized()) {
        setRole('teacher');
        setStudentSession(null);
      } else {
        setShowTeacherAuthModal(true);
      }
    }
  };

  const handleTeacherAuthSuccess = () => {
    setShowTeacherAuthModal(false);
    setRole('teacher');
    setStudentSession(null);
    setIsStudentLocked(false);
  };

  const queryRoom = new URLSearchParams(window.location.search).get('room') || '';

  return (
    <div className="min-h-screen app-theme-bg flex flex-col font-sans transition-colors duration-300">
      {/* Universal Top Header */}
      <Header
        role={role}
        hideRoleSwitch={isStudentLocked}
        onSwitchRole={handleSwitchRole}
        onExitRoom={
          studentSession
            ? () => setStudentSession(null)
            : undefined
        }
      />

      {/* Teacher Authentication Modal */}
      <TeacherAuthModal
        isOpen={showTeacherAuthModal}
        onClose={() => setShowTeacherAuthModal(false)}
        onSuccess={handleTeacherAuthSuccess}
      />

      {/* Optional Halloween decorative floating badge */}
      {theme === 'halloween' && (
        <div className="fixed bottom-4 right-4 z-30 pointer-events-none flex items-center space-x-2 text-2xl animate-pumpkin-float opacity-80 select-none">
          <span>🎃</span>
          <span>👻</span>
          <span>✨</span>
        </div>
      )}

      {/* Main App Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4">
        {role === 'teacher' ? (
          <TeacherView initialRoomId={null} />
        ) : !studentSession ? (
          <StudentJoin
            initialRoomId={queryRoom}
            onTeacherLoginClick={() => setShowTeacherAuthModal(true)}
            onJoined={(session) => setStudentSession(session)}
          />
        ) : studentSession.isHomework ? (
          <StudentHomeworkView
            roomId={studentSession.roomId}
            studentId={studentSession.studentId}
            studentName={studentSession.studentName}
            onLeave={() => setStudentSession(null)}
          />
        ) : (
          <StudentView
            roomId={studentSession.roomId}
            studentId={studentSession.studentId}
            studentName={studentSession.studentName}
            onLeave={() => setStudentSession(null)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
