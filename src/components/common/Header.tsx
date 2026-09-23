import React, { useState, useEffect } from 'react';
import { Sparkles, Users, Copy, Check, LogOut, ShieldAlert } from 'lucide-react';
import { Room } from '../../types';
import { AdminAuthModal } from '../admin/AdminAuthModal';
import { AdminModal } from '../admin/AdminModal';
import { getStoredSchoolName } from '../../lib/rosterApi';

interface HeaderProps {
  room?: Room | null;
  onlineCount?: number;
  role: 'teacher' | 'student';
  onSwitchRole: (role: 'teacher' | 'student') => void;
  onExitRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  onlineCount = 0,
  role,
  onSwitchRole,
  onExitRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [schoolName, setSchoolName] = useState(getStoredSchoolName());

  // Hidden admin console triggers
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Sync school name changes
  useEffect(() => {
    const handleNameChange = () => {
      setSchoolName(getStoredSchoolName());
    };
    window.addEventListener('school-name-changed', handleNameChange);
    return () => window.removeEventListener('school-name-changed', handleNameChange);
  }, []);

  const handleTitleClick = () => {
    const now = Date.now();
    // 兩秒半內連續點擊
    if (now - lastClickTime > 2500) {
      setClickCount(1);
      setLastClickTime(now);
      return;
    }

    const nextCount = clickCount + 1;
    setLastClickTime(now);
    setClickCount(nextCount);

    if (nextCount >= 5) {
      setClickCount(0);
      setShowAuthModal(true);
    }
  };

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left: Brand / School Logo */}
          <div className="flex items-center space-x-3">
            <img
              src="/logo.jpg"
              alt="School Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-xs border border-white/60"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div
                onClick={handleTitleClick}
                className="flex items-center space-x-1.5 cursor-pointer select-none group"
                title="點擊 5 下開啟管理員後台"
              >
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg group-hover:text-indigo-600 transition">
                  {schoolName}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                  ClassQnA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">即時教學互動系統</p>
            </div>
          </div>


        {/* Center/Right: Room info badge */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {room && (
            <>
              {/* Room Code Badge */}
              <button
                onClick={copyRoomCode}
                title="點擊複製教室代碼"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200/80 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 transition shadow-xs text-xs sm:text-sm font-mono font-bold"
              >
                <span className="text-slate-400 text-xs font-sans font-normal">房號:</span>
                <span className="text-indigo-600">{room.id}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {/* Online Count */}
              <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-xs sm:text-sm font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span>{onlineCount}</span>
                <span className="text-[11px] text-emerald-500 hidden sm:inline">在線</span>
              </div>
            </>
          )}

          {/* Screen Locked Badge */}
          {room?.screen_locked && (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">全班鎖定中</span>
            </div>
          )}

          {/* Role switcher or Exit */}
          {onExitRoom ? (
            <button
              onClick={onExitRoom}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="離開教室"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs font-semibold">
              <button
                onClick={() => onSwitchRole('teacher')}
                className={`px-3 py-1 rounded-lg transition ${
                  role === 'teacher' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                教師端
              </button>
              <button
                onClick={() => onSwitchRole('student')}
                className={`px-3 py-1 rounded-lg transition ${
                  role === 'student' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                學生端
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Admin Authentication Modal */}
    <AdminAuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      onSuccess={() => {
        setShowAuthModal(false);
        setShowAdminModal(true);
      }}
    />

    {/* Admin Console Modal */}
    <AdminModal
      isOpen={showAdminModal}
      onClose={() => setShowAdminModal(false)}
    />
  </>
  );
};

