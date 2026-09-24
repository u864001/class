import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  LogOut,
  ShieldAlert,
  Sun,
  Moon,
  Globe,
  Palette,
} from 'lucide-react';
import { Room } from '../../types';
import { AdminAuthModal } from '../admin/AdminAuthModal';
import { AdminModal } from '../admin/AdminModal';
import { getStoredSchoolName } from '../../lib/rosterApi';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';

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
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Hidden admin console triggers
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const { theme, setTheme, isDark, toggleDark } = useTheme();
  const { lang, toggleLang, t } = useI18n();

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

  const themeList: { key: AppTheme; label: string; color: string; emoji?: string }[] = [
    { key: 'indigo', label: t('header.themeIndigo'), color: '#4f46e5' },
    { key: 'slate', label: t('header.themeSlate'), color: '#475569' },
    { key: 'rose', label: t('header.themeRose'), color: '#a25872' },
    { key: 'sage', label: t('header.themeSage'), color: '#4a7c59' },
    { key: 'halloween', label: t('header.themeHalloween'), color: '#ea580c', emoji: '🎃' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/40 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">
          {/* Left: Brand / School Logo */}
          <div className="flex items-center space-x-2 sm:space-x-3">
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
                title={t('header.adminTip')}
              >
                <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-base sm:text-lg group-hover:text-indigo-600 transition">
                  {schoolName}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-theme">
                  {t('header.schoolSystem')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 hidden sm:block">
                {t('header.subTitle')}
              </p>
            </div>
          </div>

          {/* Center/Right: Tools & Room Info */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* Theme Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu((prev) => !prev)}
                className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 transition shadow-xs flex items-center space-x-1 text-xs font-semibold"
                title={t('header.theme')}
              >
                <Palette className="w-4 h-4 text-theme" />
                <span className="hidden md:inline">
                  {themeList.find((it) => it.key === theme)?.label}
                </span>
              </button>

              {showThemeMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThemeMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-44 rounded-2xl glass-card border border-white/60 dark:border-slate-700 shadow-soft p-1.5 z-50 space-y-1">
                    <div className="px-2 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {t('header.theme')}
                    </div>
                    {themeList.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setTheme(item.key);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                          theme === item.key
                            ? 'badge-theme'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shadow-xs border border-white"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.emoji && <span>{item.emoji}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 transition shadow-xs"
              title={isDark ? t('header.lightMode') : t('header.darkMode')}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Language Toggle (ZH / EN) */}
            <button
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 transition shadow-xs text-xs font-bold flex items-center space-x-1"
              title="切換語言 / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{lang === 'zh' ? '繁中' : 'EN'}</span>
            </button>

            {/* Room info badge */}
            {room && (
              <>
                {/* Room Code Badge */}
                <button
                  onClick={copyRoomCode}
                  title="點擊複製教室代碼 / Copy room code"
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 transition shadow-xs text-xs sm:text-sm font-mono font-bold"
                >
                  <span className="text-slate-400 text-xs font-sans font-normal hidden sm:inline">
                    {t('header.roomCode')}:
                  </span>
                  <span className="text-theme">{room.id}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {/* Online Count */}
                <div className="flex items-center space-x-1 px-2 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  <span>{onlineCount}</span>
                  <span className="text-[11px] text-emerald-500 hidden sm:inline">
                    {t('header.online')}
                  </span>
                </div>
              </>
            )}

            {/* Screen Locked Badge */}
            {room?.screen_locked && (
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-semibold animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('header.screenLocked')}</span>
              </div>
            )}

            {/* Role switcher or Exit */}
            {onExitRoom ? (
              <button
                onClick={onExitRoom}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                title={t('header.exitRoom')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs font-semibold">
                <button
                  onClick={() => onSwitchRole('teacher')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    role === 'teacher'
                      ? 'bg-white dark:bg-slate-700 text-theme font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('header.teacherRole')}
                </button>
                <button
                  onClick={() => onSwitchRole('student')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    role === 'student'
                      ? 'bg-white dark:bg-slate-700 text-theme font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('header.studentRole')}
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
