import React, { useState, useEffect } from 'react';
import {
  Bell,
  Lock,
  Megaphone,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  X,
  Vote,
  Sparkles,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { Room } from '../../types';
import { useRoom } from '../../hooks/useRoom';
import { useSubmissions } from '../../hooks/useSubmissions';
import { useSyncTimer } from '../../hooks/useSyncTimer';
import { StudentCanvas } from './StudentCanvas';
import { compressAndUploadCanvas } from '../../lib/imageCompressor';
import { supabase } from '../../lib/supabase';

interface StudentViewProps {
  roomId: string;
  studentId: string;
  studentName: string;
  onLeave: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  roomId,
  studentId,
  studentName,
  onLeave,
}) => {
  const { room, loading } = useRoom(roomId);
  const { submissionMap, submitAnswer } = useSubmissions(roomId, room?.current_round_id || null);

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Buzzer states
  const [buzzCountdown, setBuzzCountdown] = useState<number>(5);
  const [buzzed, setBuzzed] = useState(false);

  // Poll states
  const [selectedVoteOption, setSelectedVoteOption] = useState<string | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  // Broadcast image modal
  const [dismissBroadcastImage, setDismissBroadcastImage] = useState(false);

  const currentSubmission = submissionMap[studentId];
  const isAnswering = room?.status === 'answering';
  const isStopped = room?.status === 'stopped';

  // Server-synced countdown timer
  const remainingSeconds = useSyncTimer(
    room?.answering_started_at,
    room?.timer_seconds || 20,
    isAnswering
  );

  // Reset local inputs when round changes
  useEffect(() => {
    setSelectedChoice(null);
    setTextAnswer('');
    setDismissBroadcastImage(false);
  }, [room?.current_round_id]);

  // Handle buzzer countdown
  useEffect(() => {
    if (!room?.buzz_active) {
      setBuzzed(false);
      return;
    }
    setBuzzCountdown(room.buzz_countdown || 5);
    const interval = setInterval(() => {
      setBuzzCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [room?.buzz_active]);

  // Submit Answer
  const handleSubmit = async () => {
    if (!room || !room.current_round_id || submitting) return;
    setSubmitting(true);

    try {
      if (room.question_type === 'choice') {
        if (!selectedChoice) {
          alert('請先點選一個選項');
          return;
        }
        await submitAnswer({
          student_id: studentId,
          student_name: studentName,
          choice: selectedChoice,
        });
      } else if (room.question_type === 'text') {
        if (!textAnswer.trim()) {
          alert('請先填寫答案');
          return;
        }
        await submitAnswer({
          student_id: studentId,
          student_name: studentName,
          text_answer: textAnswer.trim(),
        });
      } else if (room.question_type === 'image') {
        if (!canvasElement) {
          alert('請在畫布上作畫後送出');
          return;
        }
        const uploadedUrl = await compressAndUploadCanvas(
          canvasElement,
          room.id,
          `${room.current_round_id}_${studentId}`
        );
        await submitAnswer({
          student_id: studentId,
          student_name: studentName,
          image_url: uploadedUrl,
        });
      }
    } catch (err: any) {
      alert('送出失敗，請重試：' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Buzz
  const handleBuzzClick = async () => {
    if (buzzCountdown > 0 || buzzed) return;
    setBuzzed(true);
    await supabase.from('buzzes').insert({
      room_id: roomId.toUpperCase(),
      student_id: studentId,
      student_name: studentName,
      buzz_time: new Date().toISOString(),
    });
  };

  // Submit Vote
  const handleVoteSubmit = async () => {
    if (!selectedVoteOption || voteSubmitted) return;
    setVoteSubmitted(true);
    await supabase.from('votes').upsert(
      {
        room_id: roomId.toUpperCase(),
        student_id: studentId,
        student_name: studentName,
        option: selectedVoteOption,
      },
      { onConflict: 'room_id, student_id' }
    );
  };

  if (loading || !room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold text-slate-500">正在同步課堂狀態...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-12">
      {/* Student Top Mini Bar */}
      <div className="glass-panel px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-xs border border-white/60">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center font-mono">
            {studentId.replace('temp_', '')}
          </div>
          <div>
            <div className="font-bold text-xs text-slate-800">{studentName}</div>
            <div className="text-[10px] text-slate-400 font-mono">房號：{room.id}</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            {room.cumulative_scores?.[studentId] || 0} 分
          </span>
          <button
            onClick={onLeave}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
            title="離開教室"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Marquee Broadcast Banner */}
      {room.broadcast_text && (
        <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center space-x-2 animate-pulse overflow-hidden">
          <Megaphone className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="font-bold truncate">{room.broadcast_text}</span>
        </div>
      )}

      {/* Question Card */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-soft border border-white/60 space-y-4">
        {/* Status indicator / Countdown */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              第 {room.current_question_num} 題
            </span>
            <span className="text-xs font-bold text-slate-500">
              {room.question_score} 分
            </span>
          </div>

          {/* Sync Timer */}
          {isAnswering ? (
            <div className="flex items-center space-x-1.5 font-mono font-black text-sm text-indigo-600 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>{remainingSeconds}s</span>
            </div>
          ) : isStopped ? (
            <span className="text-xs font-bold text-slate-400 px-2.5 py-1 rounded-xl bg-slate-100">
              已停止作答
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-600 px-2.5 py-1 rounded-xl bg-amber-50">
              等待老師開始
            </span>
          )}
        </div>

        {/* Question Prompt Note */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
            {room.question_note || `請進行第 ${room.current_question_num} 題作答`}
          </h3>
        </div>

        {/* Question Image (if choice/text question with reference image) */}
        {room.question_image_url && room.question_type !== 'image' && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-52 flex items-center justify-center">
            <img src={room.question_image_url} alt="Question ref" className="max-h-52 object-contain" />
          </div>
        )}

        {/* Answer Area */}
        {currentSubmission ? (
          /* Submitted State */
          <div className="py-8 text-center space-y-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <div className="font-extrabold text-base text-emerald-900">您已成功繳交本題！</div>
              <p className="text-xs text-emerald-700/80 mt-0.5">請等待老師公布答案或結算</p>
            </div>
            {currentSubmission.choice && (
              <div className="font-mono font-black text-xl text-emerald-800">
                已選擇：{currentSubmission.choice}
              </div>
            )}
          </div>
        ) : (
          /* Answering Inputs */
          <div className="space-y-4 pt-2">
            {/* Mode 1: Choice ABCD */}
            {room.question_type === 'choice' && (
              <div className="grid grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((opt) => {
                  const isSelected = selectedChoice === opt;
                  const isRevealedCorrect = room.revealed_answer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={!isAnswering || isStopped}
                      onClick={() => setSelectedChoice(opt)}
                      className={`h-20 rounded-2xl font-black text-2xl transition border active:scale-95 flex items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-glow-indigo ring-4 ring-indigo-500/20'
                          : isRevealedCorrect
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                      } disabled:opacity-60`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Mode 2: Text Question */}
            {room.question_type === 'text' && (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  disabled={!isAnswering || isStopped}
                  placeholder="請在此輸入您的作答文字..."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-800 text-sm disabled:opacity-60"
                />
                <div className="text-right text-[11px] text-slate-400">{textAnswer.length} 字</div>
              </div>
            )}

            {/* Mode 3: Image / Canvas Question */}
            {room.question_type === 'image' && (
              <StudentCanvas
                bgImageUrl={room.question_image_url}
                disabled={!isAnswering || isStopped}
                onSaveCanvas={setCanvasElement}
              />
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!isAnswering || submitting}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-base transition shadow-glow-indigo flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>正在送出答案...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>送出答案</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Overlay 1: Screen Locked */}
      {room.screen_locked && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black">老師已鎖定全班螢幕</h2>
          <p className="text-sm text-slate-300">請注意看前方大螢幕或聽老師講解！</p>
        </div>
      )}

      {/* Overlay 2: Buzzer (搶答) */}
      {room.buzz_active && (
        <div className="fixed inset-0 z-50 bg-indigo-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">CLASS BUZZER</span>
            <h2 className="text-2xl font-black">課堂即時搶答</h2>
          </div>

          {buzzCountdown > 0 ? (
            <div className="w-36 h-36 rounded-full bg-white/10 border-2 border-white/20 flex flex-col items-center justify-center animate-pulse">
              <span className="text-6xl font-black font-mono">{buzzCountdown}</span>
              <span className="text-xs text-slate-300 mt-1">預備...</span>
            </div>
          ) : (
            <button
              onClick={handleBuzzClick}
              disabled={buzzed}
              className={`w-44 h-44 rounded-full font-black text-2xl transition-transform active:scale-90 shadow-2xl flex flex-col items-center justify-center border-4 ${
                buzzed
                  ? 'bg-emerald-500 border-emerald-300 text-white'
                  : 'bg-gradient-to-tr from-rose-600 to-amber-500 border-white text-white animate-bounce'
              }`}
            >
              <Bell className="w-10 h-10 mb-2 fill-current" />
              <span>{buzzed ? '搶答完成！' : '搶答！'}</span>
            </button>
          )}

          {buzzed && <p className="text-xs text-emerald-300 font-semibold">您已成功按下搶答按鈕，請注意大螢幕排名！</p>}
        </div>
      )}

      {/* Overlay 3: Live Poll (即時投票) */}
      {room.vote_active && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-sm w-full rounded-3xl p-6 space-y-4 text-center">
            <div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold text-base">
              <Vote className="w-5 h-5" />
              <span>全班即時投票</span>
            </div>

            {voteSubmitted ? (
              <div className="py-6 space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <div className="font-bold text-slate-800">已成功投票！</div>
                <div className="text-xs text-slate-500">已選擇：{selectedVoteOption}</div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                {(room.vote_options || []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedVoteOption(opt)}
                    className={`w-full py-3.5 px-4 rounded-2xl border text-sm font-bold transition ${
                      selectedVoteOption === opt
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
                <button
                  onClick={handleVoteSubmit}
                  disabled={!selectedVoteOption}
                  className="w-full py-3.5 mt-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 transition"
                >
                  確認投票
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay 4: Teacher Broadcasted Artwork */}
      {room.broadcast_image_url && !dismissBroadcastImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-3xl p-5 space-y-3 relative text-center">
            <button
              onClick={() => setDismissBroadcastImage(true)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-slate-800 flex items-center justify-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>老師分享了優秀作品</span>
            </div>
            <div className="rounded-2xl overflow-hidden bg-white p-2 border border-slate-200 max-h-[60vh] flex items-center justify-center">
              <img src={room.broadcast_image_url} alt="Broadcast artwork" className="max-h-[56vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
