import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { TeacherView } from './components/teacher/TeacherView';
import { StudentJoin } from './components/student/StudentJoin';
import { StudentView } from './components/student/StudentView';

export const App: React.FC = () => {
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [studentSession, setStudentSession] = useState<{
    roomId: string;
    studentId: string;
    studentName: string;
    seatNum: number;
  } | null>(null);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
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
