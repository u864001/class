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
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [isStudentLocked, setIsStudentLocked] = useState(false);
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
      // Direct student entrance via QR Code / Shared Link:
      // Completely locks student view and hides all teacher toggle controls
      setRole('student');
      setIsStudentLocked(true);
    } else if (roleParam === 'teacher') {
      if (isTeacherAuthorized()) {
        setRole('teacher');
        setIsStudentLocked(false);
      } else {
        setRole('student');
        setIsStudentLocked(false);
        setShowTeacherAuthModal(true);
      }
    } else {
      // Default entrance without query params:
      // If this device was already verified as teacher, land on teacher view.
      // Otherwise, default safely to student mode (with PIN guard to switch).
      if (isTeacherAuthorized()) {
        setRole('teacher');
        setIsStudentLocked(false);
      } else {
        setRole('student');
        setIsStudentLocked(false);
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
