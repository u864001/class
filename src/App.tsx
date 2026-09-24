import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { TeacherView } from './components/teacher/TeacherView';
import { StudentJoin } from './components/student/StudentJoin';
import { StudentView } from './components/student/StudentView';
import { useTheme } from './context/ThemeContext';

export const App: React.FC = () => {
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [studentSession, setStudentSession] = useState<{
    roomId: string;
    studentId: string;
    studentName: string;
    seatNum: number;
  } | null>(null);

  const { theme } = useTheme();

  // Check URL query parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role');

    if (roomParam) {
      setRole('student');
    } else if (roleParam === 'teacher') {
      setRole('teacher');
    }
  }, []);

  const queryRoom = new URLSearchParams(window.location.search).get('room') || '';

  return (
    <div className="min-h-screen app-theme-bg flex flex-col font-sans transition-colors duration-300">
      {/* Universal Top Header */}
      <Header
        role={role}
        onSwitchRole={(r) => {
          setRole(r);
          if (r === 'teacher') setStudentSession(null);
        }}
        onExitRoom={
          studentSession
            ? () => setStudentSession(null)
            : undefined
        }
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
