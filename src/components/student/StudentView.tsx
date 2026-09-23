import React, { useState, useEffect } from 'react';
import {
  Bell,
  Lock,
  Unlock,
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
  Minimize2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Room } from '../../types';
import { useRoom } from '../../hooks/useRoom';
import { useSubmissions } from '../../hooks/useSubmissions';
import { useSyncTimer } from '../../hooks/useSyncTimer';
import { StudentCanvas } from './StudentCanvas';
import { compressAndUploadCanvas } from '../../lib/imageCompressor';
import { supabase } from '../../lib/supabase';
import { parseBroadcastDeck } from '../../lib/broadcastDeck';


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

  // Broadcast image & slide deck modal
  const deck = parseBroadcastDeck(room?.broadcast_image_url);
  const [studentSlideIndex, setStudentSlideIndex] = useState(0);
  const [dismissBroadcastImage, setDismissBroadcastImage] = useState(false);
  const [isMinimizedBroadcast, setIsMinimizedBroadcast] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

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
  }, [room?.current_round_id]);

  // Sync / Free mode tracking
  useEffect(() => {
    if (!deck || deck.slides.length === 0) return;

    if (deck.mode === 'sync') {
      // 老師強制同步中：學生機強制鎖定跳轉到老師當前頁
      setStudentSlideIndex(deck.currentIndex);
    } else {
      // 自由溫習模式：確保頁碼在合法範圍內
      setStudentSlideIndex((prev) => Math.min(prev, deck.slides.length - 1));
    }
    setZoomLevel(1);
  }, [deck?.mode, deck?.currentIndex, deck?.slides.length, deck?.updatedAt]);

  // When teacher pushes new broadcast snapshot or slide deck, wake up and display
  useEffect(() => {
    if (room?.broadcast_image_url) {
      setDismissBroadcastImage(false);
      setZoomLevel(1);
    }
  }, [room?.broadcast_image_url]);



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

      {/* Overlay 4: Teacher Broadcasted Screen Snapshot Slide Deck */}
      {room.broadcast_image_url && !dismissBroadcastImage && (() => {
        const slideCount = deck?.slides.length || 1;
        const currentSlideIndex = deck
          ? deck.mode === 'sync'
            ? deck.currentIndex
            : Math.max(0, Math.min(studentSlideIndex, slideCount - 1))
          : 0;
        const currentSlideUrl = deck?.slides[currentSlideIndex] || room.broadcast_image_url;

        return isMinimizedBroadcast ? (
          /* Minimized Floating Picture-in-Picture Thumbnail */
          <div
            onClick={() => setIsMinimizedBroadcast(false)}
            className="fixed bottom-6 right-6 z-50 glass-panel p-2 rounded-2xl shadow-soft border border-indigo-300 bg-white/95 cursor-pointer flex items-center space-x-2 animate-bounce hover:scale-105 transition"
            title="點擊展開講義畫面"
          >
            <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center flex-shrink-0">
              <img src={currentSlideUrl} alt="Thumbnail" className="w-full h-full object-cover" />
            </div>
            <div className="pr-1 text-left">
              <div className="text-[11px] font-extrabold text-indigo-700 flex items-center space-x-1">
                <Monitor className="w-3 h-3" />
                <span>老師講義</span>
              </div>
              <div className="text-[9px] text-slate-400">
                第 {currentSlideIndex + 1} / {slideCount} 頁
              </div>
            </div>
          </div>
        ) : (
          /* True Full-Viewport iPad Optimized Immersive Broadcast Viewer */
          <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex-shrink-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between shadow-md">
              {/* Left: Mode Badge & Page Indicator */}
              <div className="flex items-center space-x-2 text-left flex-wrap gap-y-1">
                <div className="flex items-center space-x-1.5 text-white font-extrabold text-xs sm:text-sm">
                  <Monitor className="w-4 h-4 text-indigo-400" />
                  <span>老師講義</span>
                </div>

                {deck?.mode === 'sync' ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>全班同步 (第 {currentSlideIndex + 1} / {slideCount} 頁)</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                    <Unlock className="w-3 h-3" />
                    <span>自由溫習 (第 {currentSlideIndex + 1} / {slideCount} 頁)</span>
                  </span>
                )}

                {/* Jump back button in free mode */}
                {deck?.mode === 'free' && deck.currentIndex !== currentSlideIndex && (
                  <button
                    onClick={() => setStudentSlideIndex(deck.currentIndex)}
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 hover:bg-indigo-500/50 transition border border-indigo-400/40"
                    title="對齊老師講解進度"
                  >
                    回到老師頁 (第 {deck.currentIndex + 1} 頁)
                  </button>
                )}
              </div>

              {/* Right: Multi-level Zoom Controls + PiP + Close */}
              <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                {/* Zoom Out Button */}
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.5))}
                  disabled={zoomLevel <= 1}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition text-xs flex items-center space-x-1 border border-white/10"
                  title="縮小"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                {/* Zoom Level Indicator / Quick Reset */}
                <button
                  onClick={() => setZoomLevel(1)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition border ${
                    zoomLevel > 1
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                      : 'bg-slate-800 text-slate-300 border-white/10'
                  }`}
                  title="點擊還原為全幅最適畫面 (100%)"
                >
                  <span>{Math.round(zoomLevel * 100)}%</span>
                  {zoomLevel > 1 && <span className="text-[10px] ml-1 opacity-80">還原</span>}
                </button>

                {/* Zoom In Button */}
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(2.5, prev + 0.5))}
                  disabled={zoomLevel >= 2.5}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition text-xs flex items-center space-x-1 border border-white/10"
                  title="放大"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-5 bg-white/15 mx-1" />

                {/* Minimize PiP */}
                <button
                  onClick={() => setIsMinimizedBroadcast(true)}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition text-xs font-semibold flex items-center space-x-1"
                  title="縮小為小窗，方便邊看邊作答"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">縮小</span>
                </button>

                {/* Close */}
                <button
                  onClick={() => setDismissBroadcastImage(true)}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-400 border border-white/10 transition"
                  title="關閉講義"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Immersive Canvas Area (徹底解決左半邊裁切問題) */}
            <div
              className="flex-1 relative w-full h-full overflow-auto touch-pan-x touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {zoomLevel === 1 ? (
                /* 100% 最適畫面：完整利用 iPad 螢幕，上下左右完全置中 */
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
                  <img
                    src={currentSlideUrl}
                    alt={`Slide ${currentSlideIndex + 1}`}
                    className="w-auto h-auto max-w-full max-h-[calc(100vh-130px)] sm:max-h-[calc(100vh-120px)] object-contain rounded-xl shadow-2xl transition-all duration-150 select-none pointer-events-none"
                  />
                </div>
              ) : (
                /* 放大模式 (150% ~ 250%)：座標從 0 開始，左側與右側 100% 完整無裁切，手指可任意平移 */
                <div className="p-4 sm:p-8 min-w-full min-h-full flex flex-col items-center">
                  <img
                    src={currentSlideUrl}
                    alt={`Slide ${currentSlideIndex + 1}`}
                    style={{
                      width: `${zoomLevel * 100}%`,
                      maxWidth: 'none',
                    }}
                    className="rounded-xl shadow-2xl select-none mx-auto block transition-all duration-150"
                  />
                </div>
              )}
            </div>

            {/* Bottom Floating Bar */}
            {deck && slideCount > 1 ? (
              deck.mode === 'free' ? (
                /* 自由翻頁模式：深色質感觸控大按鈕 */
                <div className="flex-shrink-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-lg">
                  <button
                    onClick={() => setStudentSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1.5 border border-white/10 shadow-xs transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>上一頁</span>
                  </button>

                  {/* Slide page pills */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto max-w-[240px] sm:max-w-md py-0.5 px-1 scrollbar-none">
                    {deck.slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setStudentSlideIndex(idx)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center flex-shrink-0 ${
                          idx === currentSlideIndex
                            ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setStudentSlideIndex((prev) => Math.min(slideCount - 1, prev + 1))
                    }
                    disabled={currentSlideIndex >= slideCount - 1}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1.5 border border-white/10 shadow-xs transition"
                  >
                    <span>下一頁</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* 全班同步鎖定模式 */
                <div className="flex-shrink-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 shadow-lg">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-semibold">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>老師正在引導翻頁，請跟隨講解</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {deck.slides.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentSlideIndex ? 'bg-indigo-500 w-5' : 'bg-slate-700 w-2'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="flex-shrink-0 bg-slate-900/80 text-[11px] text-slate-400 py-1.5 text-center">
                點擊右上角「縮小」可將講義變為懸浮小窗，邊看題目邊作答
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
};
