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
  ExternalLink,
} from 'lucide-react';
import { Room, RoomStudent } from '../../types';
import { fetchRoster } from '../../lib/rosterApi';

interface LiveJoinLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  students: RoomStudent[];
}

export const LiveJoinLobbyModal: React.FC<LiveJoinLobbyModalProps> = ({
  isOpen,
  onClose,
  room,
  students,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unjoined' | 'joined'>('all');
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expectedList, setExpectedList] = useState<{ id: string; seatNum: number; name: string }[]>([]);
  const prevJoinedCountRef = useRef<number>(0);

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
    return expectedList.map((expected) => {
      const match = students?.find(
        (s) =>
          s.student_id === expected.id ||
          s.student_id === `temp_${expected.seatNum}` ||
          s.student_id === String(expected.seatNum) ||
          s.student_name === expected.name
      );
      const isJoined = !!match && match.is_online !== false;
      return {
        ...expected,
        displayName: match?.student_name || expected.name,
        isJoined,
      };
    });
  }, [expectedList, students]);

  const joinedStudents = useMemo(() => lobbyStudents.filter((s) => s.isJoined), [lobbyStudents]);
  const unjoinedStudents = useMemo(() => lobbyStudents.filter((s) => !s.isJoined), [lobbyStudents]);

  const joinedCount = joinedStudents.length;
  const totalCount = lobbyStudents.length;
  const progressPercent = totalCount > 0 ? Math.round((joinedCount / totalCount) * 100) : 0;

  // 3. Kahoot! 風格音效：每當有新同學加入時播放輕快音效
  useEffect(() => {
    if (!isOpen) return;

    if (joinedCount > prevJoinedCountRef.current && soundEnabled && prevJoinedCountRef.current > 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } catch (e) {
        // 忽略自動播放限制
      }
    }
    prevJoinedCountRef.current = joinedCount;
  }, [joinedCount, isOpen, soundEnabled]);

  if (!isOpen) return null;

  // 學生加入的完整網址
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
      <div className="glass-panel max-w-4xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/80 max-h-[92vh] overflow-y-auto space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition shadow-2xs"
          title="關閉大廳"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 pr-10">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-xl flex items-center space-x-2">
              <span>學生掃碼報到大廳</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                即時同步中
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              請投影本畫面於大螢幕，學生使用 iPad 掃描 QR Code 或輸入房號即可即時報到！
            </p>
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: QR Code & Room PIN Card */}
          <div className="md:col-span-5 bg-white/90 rounded-3xl p-5 border border-slate-200 shadow-soft text-center space-y-4">
            <div className="p-3 bg-white rounded-2xl inline-block shadow-xs border border-slate-100">
              <QRCodeSVG value={studentJoinUrl} size={190} level="M" />
            </div>

            <div>
              <div className="text-xs text-slate-400 font-semibold mb-1">首頁輸入 6 碼教室代碼：</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-indigo-600 tracking-widest bg-indigo-50/80 py-1.5 px-4 rounded-2xl border border-indigo-100/80 inline-block shadow-xs">
                {room.id}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                onClick={copyJoinLink}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? '已複製連結！' : '複製加入網址'}</span>
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl border transition shadow-2xs ${
                  soundEnabled
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
                title={soundEnabled ? '點擊靜音' : '點擊開啟加入音效'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm transition shadow-glow-indigo flex items-center justify-center space-x-2"
              >
                <span>開始課堂互動</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Live Student Waiting Roster */}
          <div className="md:col-span-7 space-y-4">
            {/* Progress & Live Counter Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-2xl p-4 border border-indigo-100/80 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-700 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>全班報到進度</span>
                </span>
                <span className="text-slate-800 font-mono">
                  已加入 <span className="text-emerald-600 text-base">{joinedCount}</span> / {totalCount} 人
                  <span className="text-slate-400 font-normal ml-1">({progressPercent}%)</span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'all'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  全部名單 ({totalCount})
                </button>
                <button
                  onClick={() => setActiveTab('unjoined')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'unjoined'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-amber-600'
                  }`}
                >
                  尚未加入 ({unjoinedStudents.length})
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

              {unjoinedStudents.length > 0 && activeTab === 'unjoined' && (
                <div className="text-xs text-amber-700 font-semibold hidden sm:block">
                  提示：可提醒未到同學開啟相機掃描
                </div>
              )}
            </div>

            {/* Student Grid Roster */}
            <div className="max-h-72 sm:max-h-80 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {displayedList.map((st) => (
                  <div
                    key={st.id}
                    className={`px-3 py-2 rounded-2xl border transition-all duration-300 flex items-center justify-between text-xs ${
                      st.isJoined
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-2xs scale-[1.02] ring-2 ring-emerald-500/20'
                        : 'bg-white/60 border-slate-200/80 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`w-6 h-6 rounded-lg text-[11px] font-mono font-extrabold flex items-center justify-center flex-shrink-0 ${
                          st.isJoined
                            ? 'bg-emerald-500 text-white shadow-2xs'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {st.seatNum}
                      </span>
                      <span className="font-bold truncate" title={st.displayName}>
                        {st.displayName}
                      </span>
                    </div>

                    <div>
                      {st.isJoined ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {displayedList.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  {activeTab === 'unjoined' ? '🎉 太棒了！全班同學皆已全員加入教室！' : '目前尚無學生'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
