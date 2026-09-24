import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Copy,
  Check,
  Users,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  UserX,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Room, RoomStudent } from '../../types';
import { fetchRoster } from '../../lib/rosterApi';
import { useI18n } from '../../context/I18nContext';

interface LiveJoinLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  students: RoomStudent[];
  onKickStudent?: (studentId: string, studentName?: string) => Promise<void>;
}

export const LiveJoinLobbyModal: React.FC<LiveJoinLobbyModalProps> = ({
  isOpen,
  onClose,
  room,
  students,
  onKickStudent,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unjoined' | 'joined'>('all');
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expectedList, setExpectedList] = useState<{ id: string; seatNum: number; name: string }[]>([]);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const prevJoinedCountRef = useRef<number>(0);

  const { t } = useI18n();

  // 1. 取得本教室的完整應到名單（依據選擇的班級或自訂人數）
  useEffect(() => {
    async function loadExpected() {
      if (room.custom_class_enabled) {
        const count = room.custom_student_count || 20;
        const list = Array.from({ length: count }, (_, i) => ({
          id: `temp_${i + 1}`,
          seatNum: i + 1,
          name: `${i + 1}號`,
        }));
        setExpectedList(list);
      } else if (room.selected_classes && room.selected_classes.length > 0) {
        const { rosterByClass } = await fetchRoster();
        const list: { id: string; seatNum: number; name: string }[] = [];
        for (const clsKey of room.selected_classes) {
          const classStudents = rosterByClass[clsKey] || [];
          for (const s of classStudents) {
            list.push({
              id: `${s.grade}-${s.class}-${s.number}`,
              seatNum: parseInt(s.number, 10),
              name: s.name,
            });
          }
        }
        setExpectedList(list);
      } else {
        const list = Array.from({ length: 25 }, (_, i) => ({
          id: `temp_${i + 1}`,
          seatNum: i + 1,
          name: `${i + 1}號`,
        }));
        setExpectedList(list);
      }
    }
    loadExpected();
  }, [room.custom_class_enabled, room.custom_student_count, room.selected_classes]);

  // 2. 比對目前即時連線的學生名單
  const lobbyStudents = useMemo(() => {
    const matchedIds = new Set<string>();
    const list = expectedList.map((expected) => {
      const match = students?.find(
        (s) =>
          s.student_id === expected.id ||
          s.student_id === `temp_${expected.seatNum}` ||
          s.student_id === String(expected.seatNum) ||
          s.student_name === expected.name
      );
      if (match) matchedIds.add(match.student_id);
      const isJoined = !!match && match.is_online !== false;
      return {
        ...expected,
        matchedStudentId: match?.student_id || expected.id,
        displayName: match?.student_name || expected.name,
        isJoined,
      };
    });

    // 檢查是否有不在預期名冊內的額外加入學生
    students?.forEach((s) => {
      if (!matchedIds.has(s.student_id) && s.is_online !== false) {
        list.push({
          id: s.student_id,
          seatNum: 0,
          name: s.student_name || s.student_id,
          matchedStudentId: s.student_id,
          displayName: s.student_name || s.student_id,
          isJoined: true,
        });
      }
    });

    return list;
  }, [expectedList, students]);

  const joinedStudents = useMemo(() => lobbyStudents.filter((s) => s.isJoined), [lobbyStudents]);
  const unjoinedStudents = useMemo(() => lobbyStudents.filter((s) => !s.isJoined), [lobbyStudents]);

  const joinedCount = joinedStudents.length;
  const totalCount = lobbyStudents.length;
  const progressPercent = totalCount > 0 ? Math.round((joinedCount / totalCount) * 100) : 0;

  // 踢除點錯或冒用座號的學生（維持嚴格紅色警示）
  const handleKickClick = async (
    matchedStudentId: string,
    seatNum: number,
    displayName: string
  ) => {
    if (!onKickStudent) return;
    const ok = window.confirm(
      t('lobby.kickConfirm', { name: displayName, id: seatNum })
    );
    if (!ok) return;

    try {
      setKickingId(matchedStudentId);
      await onKickStudent(matchedStudentId, displayName);
    } finally {
      setKickingId(null);
    }
  };

  // 3. Kahoot! 風格音效：每當有新同學加入時播放輕快音效
  useEffect(() => {
    if (!isOpen) return;

    if (joinedCount > prevJoinedCountRef.current && soundEnabled && prevJoinedCountRef.current > 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } catch (e) {
        // Ignore autoplay policy
      }
    }
    prevJoinedCountRef.current = joinedCount;
  }, [joinedCount, isOpen, soundEnabled]);

  if (!isOpen) return null;

  const studentJoinUrl = `${window.location.origin}${window.location.pathname}?room=${room.id}`;

  const displayedList =
    activeTab === 'joined' ? joinedStudents : activeTab === 'unjoined' ? unjoinedStudents : lobbyStudents;

  const copyJoinLink = () => {
    navigator.clipboard.writeText(studentJoinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="glass-panel max-w-4xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/80 dark:border-slate-700 max-h-[92vh] overflow-y-auto space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition shadow-2xs"
          title={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 pr-10">
          <div className="w-10 h-10 rounded-2xl badge-theme flex items-center justify-center shadow-2xs">
            <Users className="w-5 h-5 text-theme" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xl flex items-center space-x-2">
              <span>{t('lobby.title')}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                Live
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('lobby.subtitle')}
            </p>
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: QR Code & Room PIN Card */}
          <div className="md:col-span-5 bg-white/90 dark:bg-slate-800/90 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-soft text-center space-y-4">
            <div className="p-3 bg-white rounded-2xl inline-block shadow-xs border border-slate-100">
              <QRCodeSVG value={studentJoinUrl} size={190} level="M" />
            </div>

            <div>
              <div className="text-xs text-slate-400 font-semibold mb-1">
                {t('lobby.roomCode')}：
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-theme tracking-widest badge-theme py-1.5 px-4 rounded-2xl inline-block shadow-xs">
                {room.id}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                onClick={copyJoinLink}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? t('common.copied') : t('common.copy')}</span>
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl border transition shadow-2xs ${
                  soundEnabled
                    ? 'badge-theme'
                    : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400'
                }`}
                title={soundEnabled ? '靜音 / Mute' : '開啟音效 / Unmute'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-theme" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl btn-theme-primary active:scale-95 font-bold text-sm transition flex items-center justify-center space-x-2"
              >
                <span>{t('common.confirm')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Live Student Waiting Roster */}
          <div className="md:col-span-7 space-y-4">
            {/* Progress & Live Counter Banner */}
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{t('lobby.joinedStudents', { count: joinedCount })}</span>
                </span>
                <span className="text-slate-800 dark:text-slate-300 font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 text-base">{joinedCount}</span> / {totalCount} {t('common.people')}
                  <span className="text-slate-400 font-normal ml-1">({progressPercent}%)</span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-slate-700 text-theme shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  全部 ({totalCount})
                </button>
                <button
                  onClick={() => setActiveTab('unjoined')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'unjoined'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-amber-600'
                  }`}
                >
                  未報到 ({unjoinedStudents.length})
                </button>
                <button
                  onClick={() => setActiveTab('joined')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'joined'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  已就緒 ({joinedCount})
                </button>
              </div>
            </div>

            {/* Student Grid Roster */}
            <div className="max-h-72 sm:max-h-80 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {displayedList.map((st) => (
                  <div
                    key={st.id}
                    className={`px-3 py-2 rounded-2xl border transition-all duration-300 flex items-center justify-between text-xs ${
                      st.isJoined
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-2xs scale-[1.02] ring-2 ring-emerald-500/20'
                        : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`w-6 h-6 rounded-lg text-[11px] font-mono font-extrabold flex items-center justify-center flex-shrink-0 ${
                          st.isJoined
                            ? 'bg-emerald-500 text-white shadow-2xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        {st.seatNum}
                      </span>
                      <span className="font-bold truncate" title={st.displayName}>
                        {st.displayName}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {st.isJoined ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          {/* Kick Student - ALWAYS Rose/Red for Safety */}
                          {onKickStudent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleKickClick(st.matchedStudentId, st.seatNum, st.displayName);
                              }}
                              disabled={kickingId === st.matchedStudentId}
                              title={`${t('lobby.kickStudentBtn')} ${st.displayName}`}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition active:scale-90 ml-0.5"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {displayedList.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  {activeTab === 'unjoined' ? '🎉 太棒了！全班同學皆已全員加入教室！' : t('lobby.waitingToJoin')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
