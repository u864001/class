import React, { useState } from 'react';
import { Award, CheckCircle, XCircle, ArrowRight, Eye, Radio, Sparkles, Send, X, RefreshCw } from 'lucide-react';
import { Room, Submission } from '../../types';
import { supabase } from '../../lib/supabase';

interface GradingViewProps {
  room: Room;
  submissions: Submission[];
  submissionMap: Record<string, Submission>;
  onRevealAnswer: (correctChoice: string) => Promise<void>;
  onAwardScore: (studentId: string, score: number) => Promise<void>;
  onBroadcastImage: (imageUrl: string) => Promise<void>;
  onGoToLeaderboard: () => void;
  onNextQuestion: () => void;
}

export const GradingView: React.FC<GradingViewProps> = ({
  room,
  submissions,
  submissionMap,
  onRevealAnswer,
  onAwardScore,
  onBroadcastImage,
  onGoToLeaderboard,
  onNextQuestion,
}) => {
  const [selectedCorrect, setSelectedCorrect] = useState<string | null>(room.revealed_answer);
  const [previewImage, setPreviewImage] = useState<{ url: string; studentName: string; studentId: string } | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  // Handle choice reveal
  const handleSelectAnswer = async (choice: string) => {
    setSelectedCorrect(choice);
    await onRevealAnswer(choice);
  };

  // Handle manual grade toggle
  const handleToggleGrade = async (studentId: string, currentScore: number) => {
    const qScore = room.question_score || 2;
    const newScore = currentScore > 0 ? 0 : qScore;
    await onAwardScore(studentId, newScore);
  };

  // Broadcast student work to class
  const handleBroadcastCurrent = async () => {
    if (!previewImage) return;
    setBroadcasting(true);
    try {
      await onBroadcastImage(previewImage.url);
      alert(`已將 ${previewImage.studentName} 的作品推播至全班學生螢幕！`);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Mode info */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                第 {room.current_question_num} 題 批改與得分
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                本題權重：{room.question_score} 分
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
              {room.question_type === 'choice' && '公布正確解答並自動結算'}
              {room.question_type === 'text' && '檢閱文字作答並評分'}
              {room.question_type === 'image' && '學生畫作成果畫廊與廣播'}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onNextQuestion}
              className="px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition shadow-xs flex items-center space-x-1.5"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>直接出下一題</span>
            </button>
            <button
              onClick={onGoToLeaderboard}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-glow-indigo flex items-center space-x-2 active:scale-95"
            >
              <Award className="w-4 h-4" />
              <span>查看班級排行榜</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Choice Question Reveal Panel */}
      {room.question_type === 'choice' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
              點擊正確答案按鈕（系統將自動計算並發放分數）：
            </h3>
            <div className="flex items-center justify-center gap-4 max-w-md mx-auto pt-2">
              {['A', 'B', 'C', 'D'].map((opt) => {
                const isCorrect = selectedCorrect === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectAnswer(opt)}
                    className={`flex-1 py-4 rounded-2xl font-extrabold text-2xl transition border active:scale-95 flex flex-col items-center justify-center ${
                      isCorrect
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-glow-emerald ring-4 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30 shadow-xs'
                    }`}
                  >
                    <span>{opt}</span>
                    {isCorrect && <span className="text-[11px] font-semibold mt-1">正確解答</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Answer Breakdown Grid */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 mb-3">學生作答結果明細：</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {submissions.map((sub) => {
                const isHit = selectedCorrect && sub.choice === selectedCorrect;
                const isMiss = selectedCorrect && sub.choice !== selectedCorrect;
                return (
                  <div
                    key={sub.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                      isHit
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold'
                        : isMiss
                        ? 'bg-rose-50/60 border-rose-200 text-rose-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-1">
                      <span className="font-mono font-bold mr-1">{sub.student_id}</span>
                      <span>{sub.student_name}</span>
                    </div>
                    <div className="flex items-center space-x-1 font-mono font-bold">
                      <span>{sub.choice || '-'}</span>
                      {isHit && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 inline" />}
                      {isMiss && <XCircle className="w-3.5 h-3.5 text-rose-500 inline" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Text Q&A Review List */}
      {room.question_type === 'text' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2">學生簡答列表（勾選給予 {room.question_score} 分）：</h3>
          <div className="space-y-2.5">
            {submissions.map((sub) => {
              const isGraded = (sub.earned_score || 0) > 0;
              return (
                <div
                  key={sub.id}
                  onClick={() => handleToggleGrade(sub.student_id, sub.earned_score || 0)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-4 ${
                    isGraded
                      ? 'bg-emerald-50/80 border-emerald-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isGraded}
                      readOnly
                      className="w-5 h-5 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <div className="font-bold text-sm text-slate-800 min-w-[70px]">
                      {sub.student_name}
                    </div>
                    <p className="text-sm text-slate-600 truncate flex-1">{sub.text_answer || '(未填寫文字)'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isGraded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isGraded ? `+${sub.earned_score} 分` : '未給分'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 3: Image / Drawing Gallery */}
      {room.question_type === 'image' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2">學生畫作成果畫廊（點擊可放大並推播給全班）：</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {submissions.map((sub) => {
              const hasImg = !!sub.image_url;
              const isGraded = (sub.earned_score || 0) > 0;
              return (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  {/* Thumbnail / Image Preview */}
                  <div
                    onClick={() => hasImg && setPreviewImage({ url: sub.image_url!, studentName: sub.student_name, studentId: sub.student_id })}
                    className="aspect-4/3 bg-slate-100 cursor-pointer flex items-center justify-center overflow-hidden relative group"
                  >
                    {hasImg ? (
                      <>
                        <img src={sub.image_url!} alt={sub.student_name} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                          <Eye className="w-4 h-4 mr-1" /> 放大檢視
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">(未送出作品)</span>
                    )}
                  </div>

                  {/* Student Info & Grade Checkbox */}
                  <div className="p-3 flex items-center justify-between border-t border-slate-100 bg-slate-50/50">
                    <span className="font-bold text-xs text-slate-800 truncate">{sub.student_name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleGrade(sub.student_id, sub.earned_score || 0)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                        isGraded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {isGraded ? `+${sub.earned_score}分` : '給分'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox / Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-4xl w-full rounded-3xl p-6 overflow-hidden flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-4 border-b border-slate-200/60 mb-4">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 text-base">{previewImage.studentName} 的畫作</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleBroadcastCurrent}
                  disabled={broadcasting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>廣播給全班觀摩</span>
                </button>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Big image */}
            <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-white shadow-inner p-2">
              <img src={previewImage.url} alt="Enlarged artwork" className="max-h-[66vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
