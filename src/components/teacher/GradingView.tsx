import React, { useState, useRef, useEffect } from 'react';
import {
  Award,
  CheckCircle,
  XCircle,
  ArrowRight,
  Eye,
  Send,
  X,
  RefreshCw,
  Undo2,
  Trash2,
  Save,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Room, Submission } from '../../types';
import { supabase } from '../../lib/supabase';
import { uploadAnnotatedCanvas } from '../../lib/imageCompressor';
import { useI18n } from '../../context/I18nContext';

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
  const [activeStudentArtwork, setActiveStudentArtwork] = useState<{
    submissionId: string;
    url: string;
    studentName: string;
    studentId: string;
    earnedScore: number;
  } | null>(null);

  const { t } = useI18n();

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
    if (activeStudentArtwork && activeStudentArtwork.studentId === studentId) {
      setActiveStudentArtwork((prev) => (prev ? { ...prev, earnedScore: newScore } : null));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Mode info */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full badge-theme">
                {t('grading.stepTag', { num: room.current_question_num })}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {t('grading.scoreWeight', { score: room.question_score })}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {room.question_type === 'choice' && t('grading.titleChoice')}
              {room.question_type === 'text' && t('grading.titleText')}
              {room.question_type === 'image' && t('grading.titleImage')}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onNextQuestion}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition shadow-xs flex items-center space-x-1.5"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>{t('grading.nextDirectly')}</span>
            </button>
            <button
              onClick={onGoToLeaderboard}
              className="px-6 py-3 rounded-2xl btn-theme-primary font-bold text-sm transition flex items-center space-x-2 active:scale-95"
            >
              <Award className="w-4 h-4" />
              <span>{t('grading.viewLeaderboard')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Choice Question Reveal Panel */}
      {room.question_type === 'choice' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('grading.clickCorrectHint')}
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
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 shadow-xs'
                    }`}
                  >
                    <span>{opt}</span>
                    {isCorrect && (
                      <span className="text-[11px] font-semibold mt-1">
                        {t('grading.correctAnswerBadge')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Answer Breakdown Grid */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
              {t('grading.submissionDetail')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {submissions.map((sub) => {
                const isHit = selectedCorrect && sub.choice === selectedCorrect;
                const isMiss = selectedCorrect && sub.choice !== selectedCorrect;
                return (
                  <div
                    key={sub.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                      isHit
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300 font-bold'
                        : isMiss
                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-1">
                      <span className="font-mono font-bold mr-1">#{sub.student_id}</span>
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
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
            {t('grading.textReviewTitle', { score: room.question_score })}
          </h3>
          <div className="space-y-2.5">
            {submissions.map((sub) => {
              const isGraded = (sub.earned_score || 0) > 0;
              return (
                <div
                  key={sub.id}
                  onClick={() => handleToggleGrade(sub.student_id, sub.earned_score || 0)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-4 ${
                    isGraded
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isGraded}
                      readOnly
                      className="w-5 h-5 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 min-w-[70px]">
                      {sub.student_name}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">
                      {sub.text_answer || t('grading.noText')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        isGraded
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isGraded
                        ? t('grading.gradedBadge', { score: sub.earned_score })
                        : t('grading.ungradedBadge')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 3: Image / Drawing Gallery with Annotation Modal Trigger */}
      {room.question_type === 'image' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
            {t('grading.imageReviewTitle')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {submissions.map((sub) => {
              const hasImg = !!sub.image_url;
              const isGraded = (sub.earned_score || 0) > 0;
              return (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  {/* Thumbnail / Image Preview */}
                  <div
                    onClick={() =>
                      hasImg &&
                      setActiveStudentArtwork({
                        submissionId: sub.id,
                        url: sub.image_url!,
                        studentName: sub.student_name,
                        studentId: sub.student_id,
                        earnedScore: sub.earned_score || 0,
                      })
                    }
                    className="aspect-4/3 bg-slate-100 dark:bg-slate-900 cursor-pointer flex items-center justify-center overflow-hidden relative group"
                  >
                    {hasImg ? (
                      <>
                        <img
                          src={sub.image_url!}
                          alt={sub.student_name}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>{t('grading.zoomView')}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{t('grading.noImage')}</span>
                    )}
                  </div>

                  {/* Student Info & Grade Checkbox */}
                  <div className="p-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                      {sub.student_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleGrade(sub.student_id, sub.earned_score || 0)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                        isGraded
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {isGraded ? t('grading.gradedBadge', { score: sub.earned_score }) : t('grading.gradeBtn')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher Annotation Canvas Modal for Student Artwork */}
      {activeStudentArtwork && (
        <ArtworkAnnotationModal
          artwork={activeStudentArtwork}
          roomId={room.id}
          questionScore={room.question_score || 2}
          onClose={() => setActiveStudentArtwork(null)}
          onGradeToggle={() =>
            handleToggleGrade(activeStudentArtwork.studentId, activeStudentArtwork.earnedScore)
          }
          onBroadcast={async (url) => {
            await onBroadcastImage(url);
          }}
          onSaved={(newUrl) => {
            setActiveStudentArtwork((prev) => (prev ? { ...prev, url: newUrl } : null));
            // Update submission record in database
            supabase
              .from('submissions')
              .update({ image_url: newUrl })
              .eq('id', activeStudentArtwork.submissionId)
              .then(() => {});
          }}
        />
      )}
    </div>
  );
};

/* --- Interactive Teacher Artwork Annotation Modal --- */
interface ArtworkAnnotationModalProps {
  artwork: {
    submissionId: string;
    url: string;
    studentName: string;
    studentId: string;
    earnedScore: number;
  };
  roomId: string;
  questionScore: number;
  onClose: () => void;
  onGradeToggle: () => void;
  onBroadcast: (url: string) => Promise<void>;
  onSaved: (newUrl: string) => void;
}

const ArtworkAnnotationModal: React.FC<ArtworkAnnotationModalProps> = ({
  artwork,
  roomId,
  questionScore,
  onClose,
  onGradeToggle,
  onBroadcast,
  onSaved,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [penColor, setPenColor] = useState<string>('#ef4444'); // Default teacher red pen
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  const { t } = useI18n();

  // Load and draw student artwork onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImageRef.current = img;
      // Set canvas dimensions based on image aspect ratio
      const maxW = 900;
      const maxH = 600;
      let w = img.width;
      let h = img.height;

      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      canvas.width = w;
      canvas.height = h;

      // Draw initial student artwork
      ctx.drawImage(img, 0, 0, w, h);

      // Save initial clean state
      const initialData = ctx.getImageData(0, 0, w, h);
      setHistory([initialData]);
    };
    img.src = artwork.url;
  }, [artwork.url]);

  // Push state to undo history
  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), data]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextHistory = [...history];
    nextHistory.pop(); // remove current
    const prev = nextHistory[nextHistory.length - 1];
    ctx.putImageData(prev, 0, 0);
    setHistory(nextHistory);
  };

  const handleClearAll = () => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    pushHistory();
  };

  // Helper: Get mouse / touch pos relative to canvas
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    pushHistory();
  };

  // Stamp quick teacher stamps (✔, 💯, ⭕)
  const handleStamp = (type: 'check' | '100' | 'circle') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = penColor;
    ctx.strokeStyle = penColor;

    // Place stamp near top-right
    const x = canvas.width - 120;
    const y = 90;

    if (type === 'check') {
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x, y + 25);
      ctx.lineTo(x + 50, y - 45);
      ctx.stroke();
    } else if (type === '100') {
      ctx.font = 'bold 50px sans-serif';
      ctx.fillText('100', x - 40, y);
      // Underline
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x - 40, y + 15);
      ctx.lineTo(x + 50, y + 15);
      ctx.moveTo(x - 40, y + 25);
      ctx.lineTo(x + 50, y + 25);
      ctx.stroke();
    } else if (type === 'circle') {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(x + 10, y - 10, 45, 45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    pushHistory();
  };

  // Save annotated artwork to Supabase
  const handleSaveAnnotated = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const newUrl = await uploadAnnotatedCanvas(canvas, roomId, artwork.studentId);
      onSaved(newUrl);
      alert(t('grading.saveSuccess'));
    } catch (err: any) {
      alert('儲存失敗：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Broadcast to whole class
  const handleBroadcast = async () => {
    setBroadcasting(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // If canvas has annotations, upload first
      let targetUrl = artwork.url;
      if (history.length > 1) {
        targetUrl = await uploadAnnotatedCanvas(canvas, roomId, artwork.studentId);
        onSaved(targetUrl);
      }
      await onBroadcast(targetUrl);
      alert(t('grading.broadcastSuccess', { name: artwork.studentName }));
    } catch (err: any) {
      alert('廣播失敗：' + err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const isGraded = artwork.earnedScore > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="glass-panel max-w-5xl w-full rounded-3xl p-4 sm:p-6 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-800 dark:text-slate-100 text-base sm:text-lg">
              {t('grading.studentArtworkModalTitle', { name: artwork.studentName })}
            </span>
            <span className="text-xs font-mono text-slate-400">#{artwork.studentId}</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Grade Toggle */}
            <button
              onClick={onGradeToggle}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                isGraded
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>
                {isGraded ? t('grading.gradedBadge', { score: artwork.earnedScore }) : `+${questionScore}分`}
              </span>
            </button>

            {/* Broadcast Button */}
            <button
              onClick={handleBroadcast}
              disabled={broadcasting}
              className="px-3.5 py-1.5 rounded-xl btn-theme-primary text-xs font-bold flex items-center space-x-1 transition shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{broadcasting ? t('grading.broadcasting') : t('grading.broadcastToClass')}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Color picker, stroke width, stamps, undo, save */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
          {/* Colors */}
          <div className="flex items-center space-x-1.5">
            {[
              { color: '#ef4444', label: t('grading.penRed') },
              { color: '#3b82f6', label: t('grading.penBlue') },
              { color: '#10b981', label: t('grading.penGreen') },
              { color: '#1f2937', label: t('grading.penBlack') },
            ].map((p) => (
              <button
                key={p.color}
                type="button"
                onClick={() => setPenColor(p.color)}
                style={{ backgroundColor: p.color }}
                title={p.label}
                className={`w-7 h-7 rounded-full border-2 transition ${
                  penColor === p.color
                    ? 'border-white ring-2 ring-indigo-500 scale-110 shadow-xs'
                    : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              />
            ))}

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* Brush sizes */}
            {[
              { w: 3, label: t('grading.strokeThin') },
              { w: 6, label: t('grading.strokeMedium') },
              { w: 10, label: t('grading.strokeThick') },
            ].map((b) => (
              <button
                key={b.w}
                type="button"
                onClick={() => setLineWidth(b.w)}
                className={`px-2 py-1 rounded-lg font-bold transition ${
                  lineWidth === b.w
                    ? 'badge-theme'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Quick Stamps & Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleStamp('check')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold transition hover:bg-rose-100"
            >
              {t('grading.stampCheck')}
            </button>
            <button
              onClick={() => handleStamp('100')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 font-bold transition hover:bg-amber-100"
            >
              {t('grading.stamp100')}
            </button>
            <button
              onClick={() => handleStamp('circle')}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-theme font-bold transition hover:bg-indigo-100"
            >
              {t('grading.stampCircle')}
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
              title={t('grading.undo')}
            >
              <Undo2 className="w-4 h-4" />
            </button>

            {/* Clear All - ALWAYS Red for safety */}
            <button
              onClick={handleClearAll}
              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
              title={t('grading.clearAll')}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Save Button */}
            <button
              onClick={handleSaveAnnotated}
              disabled={saving}
              className="px-3 py-1 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold flex items-center space-x-1 hover:bg-slate-900 transition shadow-xs"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? t('grading.saving') : t('grading.saveAndUpload')}</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl mt-3 min-h-[350px]"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="cursor-crosshair shadow-lg rounded-xl border border-white/60 dark:border-slate-700 bg-white max-w-full max-h-[60vh] object-contain touch-none"
          />
        </div>
      </div>
    </div>
  );
};
