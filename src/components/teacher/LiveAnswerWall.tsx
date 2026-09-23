import React, { useState } from 'react';
import { Play, Square, Plus, ArrowRight, CheckCircle, Clock, Users, Sparkles, UserX, Copy, Check, Filter, X } from 'lucide-react';
import { Room, RoomStudent, Submission } from '../../types';
import { useSyncTimer } from '../../hooks/useSyncTimer';

interface LiveAnswerWallProps {
  room: Room;
  students: RoomStudent[];
  submissions: Submission[];
  submissionMap: Record<string, Submission>;
  onStartAnswering: () => void;
  onStopAnswering: () => void;
  onExtendTime: (seconds: number) => void;
  onGoToGrading: () => void;
}

export const LiveAnswerWall: React.FC<LiveAnswerWallProps> = ({
  room,
  students,
  submissions,
  submissionMap,
  onStartAnswering,
  onStopAnswering,
  onExtendTime,
  onGoToGrading,
}) => {
  const isAnswering = room.status === 'answering';
  const isStopped = room.status === 'stopped';
  const [filterMode, setFilterMode] = useState<'all' | 'unsubmitted'>('all');
  const [showUnsubmittedDrawer, setShowUnsubmittedDrawer] = useState(false);
  const [copied, setCopied] = useState(false);

  // Server-synced timer
  const remainingSeconds = useSyncTimer(
    room.answering_started_at,
    room.timer_seconds || 20,
    isAnswering,
    onStopAnswering
  );

  // Generate complete seat list
  const totalSeats = room.custom_class_enabled ? room.custom_student_count || 20 : 30;
  const seats = Array.from({ length: totalSeats }, (_, i) => {
    const seatId = `temp_${i + 1}`;
    const sub = submissionMap[seatId] || submissionMap[String(i + 1)];
    const studentOnline = students.find((s) => s.student_id === seatId || s.student_id === String(i + 1));
    return {
      seatNum: i + 1,
      seatId,
      name: sub?.student_name || studentOnline?.student_name || `${i + 1}號`,
      isSubmitted: !!sub,
      submission: sub,
      isOnline: !!studentOnline?.is_online,
    };
  });

  const submittedCount = submissions.length;
  const progressPercent = totalSeats > 0 ? Math.round((submittedCount / totalSeats) * 100) : 0;

  const unsubmittedSeats = seats.filter((s) => !s.isSubmitted);
  const displayedSeats = filterMode === 'unsubmitted' ? unsubmittedSeats : seats;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Controls & Status Bar */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Question Title & Info */}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                第 {room.current_question_num} 題
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {room.question_type === 'choice' && '選擇題 ABCD'}
                {room.question_type === 'text' && '文字作答題'}
                {room.question_type === 'image' && '畫布/照片題'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
              {room.question_note || `請進行第 ${room.current_question_num} 題作答`}
            </h2>
            {/* Live Counter & Unsubmitted Pill */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-slate-600">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>已繳交：</span>
                <span className="text-emerald-600 font-bold text-base">{submittedCount}</span>
                <span className="text-slate-400">/ {totalSeats} 人 ({progressPercent}%)</span>
              </div>
              <div className="w-28 sm:w-36 h-2 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Unsubmitted List Button */}
              {unsubmittedSeats.length > 0 && (
                <button
                  onClick={() => setShowUnsubmittedDrawer(true)}
                  className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition flex items-center space-x-1 shadow-xs active:scale-95"
                >
                  <UserX className="w-3.5 h-3.5 text-amber-600" />
                  <span>未交卷名單 ({unsubmittedSeats.length}人)</span>
                </button>
              )}
            </div>
          </div>

          {/* Center: Large Synchronized Timer */}
          <div className="flex items-center space-x-4">
            <div
              className={`w-28 h-28 rounded-3xl flex flex-col items-center justify-center border transition-all ${
                isAnswering
                  ? remainingSeconds <= 5
                    ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse ring-4 ring-rose-500/20'
                    : 'bg-indigo-50/80 border-indigo-200 text-indigo-700 shadow-glow-indigo'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              <span className="text-4xl font-extrabold font-mono tracking-tighter">
                {isAnswering ? remainingSeconds : isStopped ? '⏹️' : '⏱️'}
              </span>
              <span className="text-[11px] font-bold mt-0.5">
                {isAnswering ? '剩餘秒數' : isStopped ? '作答已結束' : '等待開始'}
              </span>
            </div>
          </div>

          {/* Right: Flow Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {!isAnswering ? (
              <button
                onClick={onStartAnswering}
                className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-glow-emerald flex items-center space-x-2 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isStopped ? '重新開始作答' : '開始計時作答'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => onExtendTime(10)}
                  className="px-4 py-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition flex items-center space-x-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>加 10 秒</span>
                </button>
                <button
                  onClick={onStopAnswering}
                  className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition shadow-xs flex items-center space-x-2 active:scale-95"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>立即截止</span>
                </button>
              </>
            )}

            <button
              onClick={onGoToGrading}
              className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-glow-indigo flex items-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              <span>前往批改/對答案</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Student Cards Grid (Real-time Feedback Wall) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="font-bold text-slate-700 text-sm sm:text-base flex items-center space-x-2">
              <span>全班即時作答進度牆</span>
              <span className="text-xs font-normal text-slate-400 hidden sm:inline">（學生送出答案即刻亮起綠燈）</span>
            </h3>

            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterMode === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                全部 ({seats.length})
              </button>
              <button
                onClick={() => setFilterMode('unsubmitted')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterMode === 'unsubmitted'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-amber-600'
                }`}
              >
                未交卷 ({unsubmittedSeats.length})
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>已送出</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>思考作答中</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
              <span>未就緒</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {displayedSeats.map((seat) => {
            const hasSub = seat.isSubmitted;
            const sub = seat.submission;
            return (
              <div
                key={seat.seatNum}
                className={`p-3.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[96px] ${
                  hasSub
                    ? 'bg-emerald-50/90 border-emerald-300 shadow-xs scale-[1.02]'
                    : seat.isOnline && isAnswering
                    ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                    : 'bg-white/70 border-slate-200/70 opacity-60'
                }`}
              >
                {/* Seat Number & Status Indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold font-mono text-slate-700">
                    #{seat.seatNum}
                  </span>
                  {hasSub ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : seat.isOnline && isAnswering ? (
                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  ) : null}
                </div>

                {/* Student Name */}
                <div className="my-1">
                  <div className="font-bold text-xs text-slate-800 truncate" title={seat.name}>
                    {seat.name}
                  </div>
                </div>

                {/* Answer preview badge */}
                <div className="text-[11px] font-semibold">
                  {hasSub ? (
                    <span className="text-emerald-700 font-mono">
                      {room.question_type === 'choice' && `已選 ${sub?.choice}`}
                      {room.question_type === 'text' && `📝 已簡答`}
                      {room.question_type === 'image' && `🎨 畫作已繳`}
                    </span>
                  ) : seat.isOnline && isAnswering ? (
                    <span className="text-amber-600">作答中...</span>
                  ) : (
                    <span className="text-slate-400">未作答</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unsubmitted Students Drawer / Modal */}
      {showUnsubmittedDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <UserX className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">尚未交卷學生名單</h4>
                  <p className="text-xs text-slate-400">目前共 {unsubmittedSeats.length} 位同學尚未送出</p>
                </div>
              </div>
              <button
                onClick={() => setShowUnsubmittedDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {unsubmittedSeats.length === 0 ? (
                <div className="text-center py-6 text-emerald-600 font-bold text-sm">
                  🎉 太棒了！全班同學皆已完成作答！
                </div>
              ) : (
                unsubmittedSeats.map((seat) => (
                  <div
                    key={seat.seatNum}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-100 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                        #{seat.seatNum}
                      </span>
                      <span className="font-bold text-slate-700">{seat.name}</span>
                    </div>
                    <div>
                      {seat.isOnline ? (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          🟢 連線中未送出
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                          ⚪ 離線/未加入
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                onClick={() => {
                  const text = unsubmittedSeats.map((s) => `${s.seatNum}號 ${s.name}`).join('、');
                  navigator.clipboard.writeText(`未交卷學生（${unsubmittedSeats.length}人）：${text}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? '已複製名單！' : '複製未交名單'}</span>
              </button>

              <button
                onClick={() => setShowUnsubmittedDrawer(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
