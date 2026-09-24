import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  HelpCircle,
  FileQuestion,
  PenTool,
  Camera,
  Upload,
  ArrowLeft,
  Sparkles,
  Check,
  ZoomIn,
  X,
  AlertCircle,
  Lock,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { Room, Submission, HomeworkQuestion } from '../../../types';
import {
  parseHomework,
  lockStudentHomework,
  LOCK_ROUND_ID,
  LockMetadata,
  uploadStudentHomeworkImage,
} from '../../../lib/homeworkApi';
import { supabase } from '../../../lib/supabase';
import { StudentCanvas } from '../StudentCanvas';
import { useI18n } from '../../../context/I18nContext';

interface StudentHomeworkViewProps {
  roomId: string;
  studentId: string;
  studentName: string;
  onLeave: () => void;
}

export const StudentHomeworkView: React.FC<StudentHomeworkViewProps> = ({
  roomId,
  studentId,
  studentName,
  onLeave,
}) => {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [hwTitle, setHwTitle] = useState('課堂回家作業');
  const [assignmentId, setAssignmentId] = useState<string>('ASG_DEFAULT');

  const [currentIdx, setCurrentIdx] = useState(0);

  // Local answers state: questionId -> { choice, text, imageUrl, canvasEl }
  const [answers, setAnswers] = useState<
    Record<
      string,
      {
        choice?: string;
        text?: string;
        imageUrl?: string;
        canvasEl?: HTMLCanvasElement;
        submittedAt?: string;
      }
    >
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showFinishedModal, setShowFinishedModal] = useState(false);
  const [showIdentityConfirmModal, setShowIdentityConfirmModal] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'draw' | 'photo'>('draw');

  // Homework Lock States
  const [isLocked, setIsLocked] = useState(false);
  const [lockMeta, setLockMeta] = useState<LockMetadata | null>(null);
  const [locking, setLocking] = useState(false);

  // Load homework data & student submissions (100% REST, NO WebSocket!)
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const cleanRoomId = roomId.trim().toUpperCase();

        // 1. Fetch Room definition
        const { data: roomData, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', cleanRoomId)
          .single();

        if (roomErr || !roomData) {
          alert('找不到此作業教室！');
          onLeave();
          return;
        }

        setRoom(roomData as Room);

        const parsed = parseHomework(roomData.question_note);
        if (!parsed || parsed.questions.length === 0) {
          alert(t('homework.studentPrepAlert'));
          onLeave();
          return;
        }

        const asgId = parsed.assignment_id || 'ASG_DEFAULT';
        setAssignmentId(asgId);
        setQuestions(parsed.questions);
        setHwTitle(parsed.title || '課堂回家作業');

        // 2. Fetch existing submissions for this student
        const { data: subsData } = await supabase
          .from('submissions')
          .select('*')
          .eq('room_id', cleanRoomId)
          .eq('student_id', studentId);

        if (subsData && subsData.length > 0) {
          const loadedAnswers: typeof answers = {};
          const lockRoundId = `${asgId}_LOCK`;

          for (const sub of subsData as Submission[]) {
            if (sub.round_id === lockRoundId || sub.round_id === LOCK_ROUND_ID) {
              setIsLocked(true);
              try {
                if (sub.text_answer) {
                  setLockMeta(JSON.parse(sub.text_answer));
                }
              } catch {
                // ignore
              }
              continue;
            }
            loadedAnswers[sub.round_id] = {
              choice: sub.choice || undefined,
              text: sub.text_answer || undefined,
              imageUrl: sub.image_url || undefined,
              submittedAt: sub.created_at,
            };
          }
          setAnswers(loadedAnswers);
        }
      } catch (err) {
        console.error('Failed to load homework:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [roomId, studentId, onLeave, t]);

  // Final Lock Homework Submission
  const handleLockHomework = async () => {
    if (uploadingImg || submitting) {
      alert('尚有圖片或作答正在儲存中，請稍候幾秒後再確認送出！');
      return;
    }

    // Auto-flush current question if edited but not yet submitted
    const currentAns = currentQ ? answers[currentQ.id] : undefined;
    const hasUnsubmittedInput =
      currentAns &&
      !currentAns.submittedAt &&
      (currentAns.choice ||
        (currentAns.text && currentAns.text.trim()) ||
        currentAns.imageUrl ||
        currentAns.canvasEl);

    if (hasUnsubmittedInput) {
      const shouldSave = confirm(
        '目前題目有尚未儲存的作答內容，系統將先為您儲存此題，再鎖定答案。是否繼續？'
      );
      if (!shouldSave) return;
      await handleSubmitCurrent();
    }

    // Open big identity confirmation card to prevent tampering & accidental submissions
    setShowFinishedModal(false);
    setShowIdentityConfirmModal(true);
  };

  const executeFinalLock = async () => {
    setLocking(true);
    try {
      const res = await lockStudentHomework(roomId, studentId, studentName, assignmentId);
      if (!res.success) throw new Error(res.error || '鎖定失敗');

      setIsLocked(true);
      setShowIdentityConfirmModal(false);
      setShowFinishedModal(false);
      alert(t('homework.lockedSuccess'));
    } catch (err: any) {
      alert('鎖定作答失敗：' + err.message);
    } finally {
      setLocking(false);
    }
  };

  const currentQ = questions[currentIdx];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const isCurrentSubmitted = Boolean(currentAnswer?.submittedAt);

  // Total completed count
  const completedCount = useMemo(() => {
    return questions.filter((q) => answers[q.id]?.submittedAt).length;
  }, [questions, answers]);

  // Handle Choice Selection
  const handleSelectChoice = (opt: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        choice: opt,
      },
    }));
  };

  // Handle Text Change
  const handleTextChange = (val: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        text: val,
      },
    }));
  };

  // Handle Canvas Drawing Save
  const handleCanvasSave = (canvas: HTMLCanvasElement) => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        canvasEl: canvas,
      },
    }));
  };

  // Handle Photo / File Upload (Client-side automatic compression to WebP 1440px)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentQ) return;
    setUploadingImg(true);
    try {
      const url = await uploadStudentHomeworkImage(
        roomId,
        assignmentId,
        currentQ.id,
        studentId,
        file
      );
      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: {
          ...prev[currentQ.id],
          imageUrl: url,
        },
      }));
    } catch (err: any) {
      alert('上傳照片失敗：' + err.message);
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  // Submit Current Question
  const handleSubmitCurrent = async () => {
    if (!currentQ) return;
    if (isLocked) {
      alert('您的作答已鎖定，若需修改請洽任課老師解除鎖定！');
      return;
    }

    const ans = answers[currentQ.id];

    // Validation
    if (currentQ.type === 'choice' && !ans?.choice) {
      alert('請先點選一個選項再送出！');
      return;
    }
    if (currentQ.type === 'text' && (!ans?.text || !ans.text.trim())) {
      alert('請先輸入簡答文字再送出！');
      return;
    }
    if (currentQ.type === 'image' && !ans?.imageUrl && !ans?.canvasEl) {
      alert('請先在畫布繪圖或拍照上傳作品再送出！');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Double-check if student has already been locked in DB for this assignment
      const cleanRoomId = roomId.trim().toUpperCase();
      const lockRoundIds =
        assignmentId !== 'ASG_DEFAULT' ? [`${assignmentId}_LOCK`] : [LOCK_ROUND_ID];
      const { data: lockCheck } = await supabase
        .from('submissions')
        .select('id')
        .eq('room_id', cleanRoomId)
        .in('round_id', lockRoundIds)
        .eq('student_id', studentId)
        .maybeSingle();

      if (lockCheck) {
        setIsLocked(true);
        alert('您的作答已鎖定，若需修改請洽任課老師解除鎖定！');
        return;
      }

      let finalImageUrl = ans?.imageUrl || null;

      // If user drew on canvas, compress and upload WebP
      if (currentQ.type === 'image' && ans?.canvasEl && !ans?.imageUrl) {
        finalImageUrl = await uploadStudentHomeworkImage(
          roomId,
          assignmentId,
          currentQ.id,
          studentId,
          ans.canvasEl
        );
      }

      // Check auto-grade score for choice questions if teacher configured standard answer
      let earnedScore = 0;
      if (currentQ.type === 'choice' && currentQ.correctAnswer) {
        earnedScore = ans?.choice === currentQ.correctAnswer ? currentQ.score : 0;
      }

      // Upsert into Supabase submissions table
      const { error } = await supabase.from('submissions').upsert(
        {
          room_id: cleanRoomId,
          round_id: currentQ.id,
          student_id: studentId,
          student_name: studentName,
          choice: ans?.choice || null,
          text_answer: ans?.text?.trim() || null,
          image_url: finalImageUrl,
          earned_score: earnedScore,
        },
        {
          onConflict: 'room_id,round_id,student_id',
        }
      );

      if (error) throw error;

      // Update local state with submittedAt timestamp
      const nowIso = new Date().toISOString();
      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: {
          ...prev[currentQ.id],
          imageUrl: finalImageUrl || undefined,
          submittedAt: nowIso,
        },
      }));

      // Check if all questions completed
      const newCompleted = completedCount + (isCurrentSubmitted ? 0 : 1);
      if (newCompleted === questions.length) {
        setShowFinishedModal(true);
      } else if (currentIdx < questions.length - 1) {
        // Automatically go to next question for smooth mobile flow
        setCurrentIdx(currentIdx + 1);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      alert('送出作答失敗，請檢查網路連線：' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-theme mx-auto" />
        <p className="text-sm font-bold text-slate-500">{t('student.joining')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 pb-20">
      {/* Top Header Card */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 shadow-soft border border-white/60 dark:border-slate-700 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onLeave}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            title="離開作業"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full badge-theme text-[11px] font-mono font-bold">
                {roomId}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {studentName}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-sm mt-0.5">
              {hwTitle}
            </h2>
          </div>
        </div>

        {/* Progress Pill */}
        <div className="text-right flex-shrink-0">
          <span className="text-[11px] font-bold text-slate-400 block">作答進度</span>
          <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            {completedCount} / {questions.length} 題
          </span>
        </div>
      </div>

      {/* Question Navigation Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
        {questions.map((q, idx) => {
          const isDone = Boolean(answers[q.id]?.submittedAt);
          const isSelected = currentIdx === idx;
          return (
            <button
              key={q.id || idx}
              onClick={() => setCurrentIdx(idx)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 ${
                isSelected
                  ? 'btn-theme-primary shadow-xs scale-105'
                  : isDone
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>{idx + 1}</span>
              {isDone && <Check className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>

      {/* Main Question Card */}
      {currentQ && (
        <div className="glass-panel rounded-3xl p-5 sm:p-7 shadow-soft border border-white/60 dark:border-slate-700 space-y-5">
          {/* Locked Notice Banner */}
          {isLocked && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-start space-x-2.5">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span>{t('homework.lockedBanner')}</span>
                {lockMeta?.locked_at && (
                  <span className="block text-[10px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                    鎖定時間：{new Date(lockMeta.locked_at).toLocaleString()}（{lockMeta.device}）
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Card Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full btn-theme-primary text-[10px] font-black uppercase">
                  {t('homework.questionIndex', {
                    current: currentIdx + 1,
                    total: questions.length,
                  })}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {currentQ.type === 'choice'
                    ? '選擇題'
                    : currentQ.type === 'text'
                    ? '問答簡答題'
                    : '繪圖/作品上傳題'}{' '}
                  ・ {currentQ.score} 分
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                {currentQ.note}
              </h3>
            </div>

            {/* Submitted status badge */}
            {isCurrentSubmitted && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex-shrink-0">
                <Check className="w-3 h-3" />
                <span>{isLocked ? '已鎖定' : '已送出'}</span>
              </span>
            )}
          </div>

          {/* Reference Image Attachment */}
          {currentQ.imageUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 max-h-56 flex items-center justify-center">
              <img
                src={currentQ.imageUrl}
                alt="題目參考圖"
                className="max-h-56 w-auto object-contain cursor-pointer hover:opacity-95 transition"
                onClick={() => setZoomedImage(currentQ.imageUrl)}
              />
              <button
                type="button"
                onClick={() => setZoomedImage(currentQ.imageUrl)}
                className="absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-sm text-white text-xs font-medium flex items-center space-x-1"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>點擊放大</span>
              </button>
            </div>
          )}

          {/* Answering Controls */}
          {currentQ.type === 'choice' && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                請點選您的答案：
              </span>
              <div className="grid grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((opt) => {
                  const isSelected = currentAnswer?.choice === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleSelectChoice(opt)}
                      className={`py-4 rounded-2xl font-black text-lg transition flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'btn-theme-primary shadow-glow-theme scale-[1.02]'
                          : 'bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center text-sm">
                        {opt}
                      </span>
                      <span>選項 {opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentQ.type === 'text' && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                請輸入您的簡答說明：
              </label>
              <textarea
                rows={4}
                disabled={isLocked}
                value={currentAnswer?.text || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={t('student.submitTextPlaceholder')}
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium text-sm transition disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900"
              />
            </div>
          )}

          {currentQ.type === 'image' && (
            <div className="space-y-3 pt-2">
              {/* Toggle Mode: Draw or Camera Upload */}
              {!isLocked && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    作答方式：
                  </span>
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/60 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('draw')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                        imageInputMode === 'draw'
                          ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>觸控繪圖</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode('photo')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                        imageInputMode === 'photo'
                          ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>相機/照片上傳</span>
                    </button>
                  </div>
                </div>
              )}

              {imageInputMode === 'draw' ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                  <StudentCanvas disabled={isLocked} onSaveCanvas={handleCanvasSave} />
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
                  {currentAnswer?.imageUrl ? (
                    <div className="space-y-3">
                      <img
                        src={currentAnswer.imageUrl}
                        alt="已上傳的照片"
                        className="max-h-56 mx-auto rounded-xl object-contain border"
                      />
                      <span className="text-xs font-bold text-emerald-600 block">
                        ✓ 照片已就緒
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      拍攝課本、習作或作業紙本照片上傳
                    </p>
                  )}

                  {!isLocked && (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <label className="cursor-pointer px-4 py-2.5 rounded-xl btn-theme-primary text-xs font-bold shadow-xs active:scale-95 transition flex items-center space-x-2">
                        <Camera className="w-4 h-4" />
                        <span>相機拍照</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>

                      <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:border-slate-300 active:scale-95 transition flex items-center space-x-2">
                        <Upload className="w-4 h-4 text-theme" />
                        <span>從相簿選擇</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Action for this question */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
            {isLocked ? (
              <div className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 select-none">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>作業已確認鎖定 (唯讀狀態，防止竄改)</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleSubmitCurrent}
                  disabled={submitting || uploadingImg}
                  className={`w-full py-4 rounded-2xl font-black text-base shadow-md active:scale-[0.99] transition flex items-center justify-center space-x-2 ${
                    isCurrentSubmitted
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'btn-theme-primary'
                  }`}
                >
                  {submitting || uploadingImg ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('homework.savingThisQuestion')}</span>
                    </>
                  ) : isCurrentSubmitted ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>更新送出此題作答 (覆蓋舊答案)</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>{t('homework.saveThisQuestion')}</span>
                    </>
                  )}
                </button>

                {isCurrentSubmitted && (
                  <p className="text-center text-[11px] text-slate-400 mt-2">
                    {t('homework.studentSubmittedBadge')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-30 active:scale-95 transition flex items-center space-x-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('homework.prevQuestion')}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFinishedModal(true)}
          className="px-4 py-2.5 rounded-2xl badge-theme text-xs font-bold border transition active:scale-95"
        >
          <span>{t('homework.completeAllBtn')}</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
          disabled={currentIdx === questions.length - 1}
          className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-30 active:scale-95 transition flex items-center space-x-1"
        >
          <span>{t('homework.nextQuestion')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Completed All Questions Modal */}
      {showFinishedModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/60 dark:border-slate-700 text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl badge-theme flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-8 h-8 text-theme" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                {completedCount === questions.length
                  ? t('homework.studentAllFinished')
                  : '作業作答總覽'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('homework.studentReviseHint')}
              </p>
            </div>

            {/* Checklist of all questions */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 space-y-2 text-left max-h-48 overflow-y-auto">
              {questions.map((q, idx) => {
                const isDone = Boolean(answers[q.id]?.submittedAt);
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setCurrentIdx(idx);
                      setShowFinishedModal(false);
                    }}
                    className="cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700/60 flex items-center justify-between text-xs transition"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                      第 {idx + 1} 題：{q.note}
                    </span>
                    {isDone ? (
                      <span className="text-emerald-600 font-bold flex items-center space-x-1 flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>已完成</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold flex-shrink-0">
                        未作答 (點擊前往)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* If all completed and not locked yet, provide the Lock Submission button */}
            {!isLocked && completedCount === questions.length ? (
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleLockHomework}
                  disabled={locking}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {locking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span>{t('homework.lockSubmitBtn')}</span>
                </button>
                <p className="text-[11px] text-slate-400">
                  送出鎖定後答案將不可再修改，可徹底防止被他人冒用覆蓋。
                </p>
              </div>
            ) : isLocked ? (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>作業已確認送出並鎖定保護中</span>
              </div>
            ) : null}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFinishedModal(false)}
                className="flex-1 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 active:scale-95 transition"
              >
                繼續檢查作答
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="flex-1 py-3 rounded-2xl btn-theme-primary text-xs font-bold shadow-xs active:scale-95 transition"
              >
                儲存離開
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Big Identity Confirmation Modal before Final Lock */}
      {showIdentityConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel max-w-lg w-full rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-amber-300 dark:border-amber-600 text-center space-y-6">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                ⚠️ 請確認您的座號與姓名
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                送出後將永久鎖定作答內容，系統將嚴格記錄您的繳交身分與時間
              </p>
            </div>

            {/* Big Identity Display Card */}
            <div className="p-5 rounded-2xl bg-amber-50/90 dark:bg-slate-800/90 border-2 border-amber-200 dark:border-amber-800/60 space-y-2">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-400">
                目前準備繳交作業的學生：
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-wide py-1">
                {studentName}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                班級代碼：{roomId} ｜ 作業完成數：{completedCount} / {questions.length} 題
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              ⚠️ 請注意：若非本人作答，請勿替他人送出！故意頂替繳交或竄改他人作業將有系統紀錄。
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={executeFinalLock}
                disabled={locking}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-base shadow-lg transition flex items-center justify-center space-x-2"
              >
                {locking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
                <span>確定是我本人【{studentName}】，送出鎖定！</span>
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowIdentityConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
                >
                  返回檢查題目
                </button>
                <button
                  type="button"
                  onClick={onLeave}
                  className="flex-1 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold transition flex items-center justify-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>不是我，重新選座號</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="glass-panel max-w-2xl max-h-[85vh] rounded-3xl p-4 overflow-hidden border border-white/20 flex flex-col space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/40 rounded-2xl p-2">
              <img
                src={zoomedImage}
                alt="放大檢視"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
