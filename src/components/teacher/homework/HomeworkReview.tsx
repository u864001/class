import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  Trash2,
  RefreshCw,
  Edit3,
  CheckCircle2,
  Clock,
  UserCheck,
  FileQuestion,
  Image as ImageIcon,
  Check,
  X,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react';
import { Room, Submission, ClassRosterStudent } from '../../../types';
import { parseHomework, cleanRoomAllAssetsAndSubmissions } from '../../../lib/homeworkApi';
import { fetchRoster, formatClassLabel } from '../../../lib/rosterApi';
import { exportRoomResults } from '../../../lib/exportExcel';
import { supabase } from '../../../lib/supabase';
import { useI18n } from '../../../context/I18nContext';

interface HomeworkReviewProps {
  room: Room;
  onReopenBuilder: () => void;
  onRefreshRoom?: () => void;
}

export const HomeworkReview: React.FC<HomeworkReviewProps> = ({
  room,
  onReopenBuilder,
  onRefreshRoom,
}) => {
  const { t } = useI18n();

  const hwData = useMemo(() => parseHomework(room.question_note), [room.question_note]);
  const questions = useMemo(() => hwData?.questions || [], [hwData]);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [rosterStudents, setRosterStudents] = useState<ClassRosterStudent[]>([]);
  const [activeTab, setActiveTab] = useState<'byQuestion' | 'byStudent' | 'roster'>('byQuestion');
  const [selectedQIdx, setSelectedQIdx] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  // Clearing / Exporting states
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  // 1. Fetch Submissions for this room
  const loadSubmissions = useCallback(async () => {
    try {
      setLoadingSubs(true);
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('room_id', room.id.toUpperCase())
        .order('created_at', { ascending: true });

      if (!error && data) {
        setSubmissions(data as Submission[]);
      }
    } catch (err) {
      console.warn('Error loading submissions:', err);
    } finally {
      setLoadingSubs(false);
    }
  }, [room.id]);

  // 2. Fetch class roster for expected students
  useEffect(() => {
    async function initRoster() {
      if (!room.custom_class_enabled && room.selected_classes?.length > 0) {
        const { rosterByClass } = await fetchRoster();
        const combined: ClassRosterStudent[] = [];
        for (const clsKey of room.selected_classes) {
          if (rosterByClass[clsKey]) {
            combined.push(...rosterByClass[clsKey]);
          }
        }
        setRosterStudents(combined);
        if (combined.length > 0) {
          const first = combined[0];
          setSelectedStudentId(`${first.grade}-${first.class}-${first.number}`);
        }
      } else {
        // Custom Mode
        const count = room.custom_student_count || 20;
        const tempStudents: ClassRosterStudent[] = Array.from({ length: count }, (_, i) => ({
          grade: '1',
          class: '1',
          number: String(i + 1),
          name: `${i + 1}號同學`,
        }));
        setRosterStudents(tempStudents);
        setSelectedStudentId('temp_1');
      }
    }
    initRoster();
    loadSubmissions();
  }, [room, loadSubmissions]);

  // Group submissions by studentId
  const studentSubmissionsMap = useMemo(() => {
    const map = new Map<string, Map<string, Submission>>();
    for (const sub of submissions) {
      if (!map.has(sub.student_id)) {
        map.set(sub.student_id, new Map());
      }
      map.get(sub.student_id)!.set(sub.round_id, sub);
    }
    return map;
  }, [submissions]);

  // Total expected students count
  const totalStudents = rosterStudents.length;

  // Fully completed students count (submitted all questions)
  const completedStudentCount = useMemo(() => {
    if (questions.length === 0) return 0;
    let count = 0;
    for (const s of rosterStudents) {
      const sId = room.custom_class_enabled
        ? `temp_${s.number}`
        : `${s.grade}-${s.class}-${s.number}`;
      const subMap = studentSubmissionsMap.get(sId);
      if (subMap && questions.every((q) => subMap.has(q.id))) {
        count++;
      }
    }
    return count;
  }, [questions, rosterStudents, room.custom_class_enabled, studentSubmissionsMap]);

  // At least 1 question submitted count
  const startedStudentCount = useMemo(() => {
    let count = 0;
    for (const s of rosterStudents) {
      const sId = room.custom_class_enabled
        ? `temp_${s.number}`
        : `${s.grade}-${s.class}-${s.number}`;
      const subMap = studentSubmissionsMap.get(sId);
      if (subMap && subMap.size > 0) {
        count++;
      }
    }
    return count;
  }, [rosterStudents, room.custom_class_enabled, studentSubmissionsMap]);

  const completionPercent = totalStudents > 0 ? Math.round((completedStudentCount / totalStudents) * 100) : 0;

  // Current selected question
  const currentQ = questions[selectedQIdx];

  // Inline score award for a submission
  const handleAwardScore = async (submissionId: string, earnedScore: number) => {
    try {
      await supabase
        .from('submissions')
        .update({ earned_score: earnedScore })
        .eq('id', submissionId);

      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, earned_score: earnedScore } : s))
      );
    } catch (e) {
      console.warn('Award score error:', e);
    }
  };

  // Export Results
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportRoomResults(room, submissions);
    } catch (err: any) {
      alert('匯出失敗：' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Red Safety Download & Clear
  const handleSafetyDownloadAndClear = async () => {
    const ok = confirm(t('homework.safetyClearConfirm'));
    if (!ok) return;

    setClearing(true);
    try {
      // 1. Download export package first
      await exportRoomResults(room, submissions);

      // 2. Clean cloud storage assets & DB submissions
      const { success, error } = await cleanRoomAllAssetsAndSubmissions(room.id);
      if (!success) {
        throw new Error(error || '清理雲端資源失敗');
      }

      alert(t('homework.clearedSuccess'));
      onRefreshRoom?.();
      onReopenBuilder();
    } catch (err: any) {
      console.error('Safety clear error:', err);
      alert('清空失敗：' + err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Overview */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-700/80 pb-6 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full badge-theme text-xs font-bold font-mono">
                {room.id}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {room.selected_classes?.length > 0
                  ? room.selected_classes.map(formatClassLabel).join(', ')
                  : '自訂座號'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
              {hwData?.title || '回家作業成果檢閱'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              共 {questions.length} 道題目・非同步作答模式
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadSubmissions}
              disabled={loadingSubs}
              className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200 active:scale-95 transition"
              title="重新整理作答紀錄"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSubs ? 'animate-spin text-theme' : ''}`} />
            </button>

            <button
              onClick={onReopenBuilder}
              className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center space-x-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-theme" />
              <span>編修題目</span>
            </button>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2.5 rounded-2xl btn-theme-primary font-bold text-xs shadow-xs active:scale-95 transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>匯出成果 (Excel/ZIP)</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Alert */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-200">
              {t('homework.submissionProgress', {
                submitted: completedStudentCount,
                total: totalStudents,
                percent: completionPercent,
              })}
            </span>
            <span className="text-slate-400">
              (至少繳交 1 題者：{startedStudentCount} 人)
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {/* Submission Alert */}
          {completedStudentCount === totalStudents && totalStudents > 0 ? (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{t('homework.allSubmittedAlert')}</span>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{t('homework.waitingStudentsAlert')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigator */}
      <div className="flex items-center space-x-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-2">
        <button
          onClick={() => setActiveTab('byQuestion')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeTab === 'byQuestion'
              ? 'badge-theme border-current shadow-2xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>{t('homework.byQuestionTab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('byStudent')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeTab === 'byStudent'
              ? 'badge-theme border-current shadow-2xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('homework.byStudentTab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeTab === 'roster'
              ? 'badge-theme border-current shadow-2xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{t('homework.rosterStatusTab')}</span>
        </button>
      </div>

      {/* View 1: By Question */}
      {activeTab === 'byQuestion' && currentQ && (
        <div className="space-y-4">
          {/* Question Selector Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {questions.map((q, idx) => (
              <button
                key={q.id || idx}
                onClick={() => setSelectedQIdx(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
                  selectedQIdx === idx
                    ? 'btn-theme-primary shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>第 {idx + 1} 題</span>
                <span className="text-[10px] opacity-75">
                  ({q.type === 'choice' ? '選擇' : q.type === 'text' ? '簡答' : '繪圖'})
                </span>
              </button>
            ))}
          </div>

          {/* Current Question Info Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-soft border border-white/60 dark:border-slate-700 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-theme uppercase tracking-wider">
                  第 {currentQ.num} 題・配分 {currentQ.score} 分
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {currentQ.note}
                </h3>
              </div>

              {currentQ.correctAnswer && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex-shrink-0">
                  標準答案：{currentQ.correctAnswer}
                </div>
              )}
            </div>

            {currentQ.imageUrl && (
              <div className="pt-2">
                <img
                  src={currentQ.imageUrl}
                  alt="題目附圖"
                  className="max-h-48 rounded-xl object-contain border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90"
                  onClick={() =>
                    setZoomedImage({ url: currentQ.imageUrl!, title: `第 ${currentQ.num} 題附圖` })
                  }
                />
              </div>
            )}
          </div>

          {/* Question Answers Details */}
          {currentQ.type === 'choice' ? (
            /* Choice Breakdown */
            <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-soft border border-white/60 dark:border-slate-700 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                選項分佈與學生名單：
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['A', 'B', 'C', 'D'].map((opt) => {
                  const matchingSubs = submissions.filter(
                    (s) => s.round_id === currentQ.id && s.choice === opt
                  );
                  const isCorrect = currentQ.correctAnswer === opt;
                  return (
                    <div
                      key={opt}
                      className={`p-4 rounded-2xl border ${
                        isCorrect
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {opt}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {matchingSubs.length} 人
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 max-h-32 overflow-y-auto">
                        {matchingSubs.map((s) => (
                          <div key={s.id} className="truncate">
                            {s.student_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : currentQ.type === 'text' ? (
            /* Text Answers List */
            <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-soft border border-white/60 dark:border-slate-700 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                簡答作答與評分：
              </h4>
              <div className="space-y-3">
                {submissions
                  .filter((s) => s.round_id === currentQ.id)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {sub.student_name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(sub.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {sub.text_answer || '(未填寫文字)'}
                        </p>
                      </div>

                      {/* Score control */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-xs text-slate-400">得分：</span>
                        <button
                          type="button"
                          onClick={() => handleAwardScore(sub.id, 0)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold border transition ${
                            sub.earned_score === 0
                              ? 'bg-rose-100 border-rose-400 text-rose-700'
                              : 'border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAwardScore(sub.id, currentQ.score)}
                          className={`px-2.5 h-7 rounded-lg text-xs font-bold border transition ${
                            sub.earned_score === currentQ.score
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
                              : 'border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          +{currentQ.score}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Image Gallery */
            <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-soft border border-white/60 dark:border-slate-700 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                學生作品畫廊 (點擊可放大檢視)：
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {submissions
                  .filter((s) => s.round_id === currentQ.id && s.image_url)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() =>
                        setZoomedImage({
                          url: sub.image_url!,
                          title: `${sub.student_name} 的繪圖作品`,
                        })
                      }
                      className="group cursor-pointer rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs hover:border-indigo-400 transition"
                    >
                      <div className="aspect-square bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                        <img
                          src={sub.image_url!}
                          alt={sub.student_name}
                          className="w-full h-full object-contain group-hover:scale-105 transition"
                        />
                      </div>
                      <div className="p-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                          {sub.student_name}
                        </span>
                        <ZoomIn className="w-3.5 h-3.5 text-slate-400 group-hover:text-theme transition" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View 2: By Student */}
      {activeTab === 'byStudent' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Student Selector List */}
          <div className="glass-panel rounded-3xl p-4 shadow-soft border border-white/60 dark:border-slate-700 max-h-[600px] overflow-y-auto space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">
              學生名單
            </span>
            {rosterStudents.map((s) => {
              const sId = room.custom_class_enabled
                ? `temp_${s.number}`
                : `${s.grade}-${s.class}-${s.number}`;
              const subMap = studentSubmissionsMap.get(sId);
              const submittedCount = subMap ? subMap.size : 0;
              const isSelected = selectedStudentId === sId;

              return (
                <button
                  key={sId}
                  onClick={() => setSelectedStudentId(sId)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-bold transition flex items-center justify-between ${
                    isSelected
                      ? 'btn-theme-primary shadow-xs'
                      : 'bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>
                    {s.number}號 {s.name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      submittedCount === questions.length && questions.length > 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : submittedCount > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {submittedCount} / {questions.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Student Detail Panel */}
          <div className="md:col-span-2 glass-panel rounded-3xl p-6 shadow-soft border border-white/60 dark:border-slate-700 space-y-4">
            {selectedStudentId ? (
              (() => {
                const subMap = studentSubmissionsMap.get(selectedStudentId);
                const student = rosterStudents.find(
                  (s) =>
                    (room.custom_class_enabled
                      ? `temp_${s.number}`
                      : `${s.grade}-${s.class}-${s.number}`) === selectedStudentId
                );

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          {student?.name || '學生作答明細'}
                        </h3>
                        <span className="text-xs text-slate-400">
                          座號：{student?.number} 號
                        </span>
                      </div>
                      <div className="text-xs font-bold text-emerald-600">
                        已繳交 {subMap ? subMap.size : 0} / {questions.length} 題
                      </div>
                    </div>

                    <div className="space-y-3">
                      {questions.map((q) => {
                        const sub = subMap?.get(q.id);
                        return (
                          <div
                            key={q.id}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                第 {q.num} 題 ({q.type === 'choice' ? '選擇' : q.type === 'text' ? '簡答' : '繪圖'})
                              </span>
                              {sub ? (
                                <span className="text-emerald-600 font-bold flex items-center space-x-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>已送出</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-bold">未作答</span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500">{q.note}</p>

                            {/* Content */}
                            {sub ? (
                              <div className="pt-1 text-xs font-medium text-slate-800 dark:text-slate-100">
                                {q.type === 'choice' && (
                                  <div className="flex items-center space-x-2">
                                    <span>學生選擇：</span>
                                    <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">
                                      {sub.choice}
                                    </span>
                                    {q.correctAnswer && (
                                      <span className="text-slate-400">
                                        (標準答案: {q.correctAnswer})
                                      </span>
                                    )}
                                  </div>
                                )}

                                {q.type === 'text' && (
                                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 whitespace-pre-wrap">
                                    {sub.text_answer || '(未填寫文字)'}
                                  </div>
                                )}

                                {q.type === 'image' && sub.image_url && (
                                  <div className="pt-1">
                                    <img
                                      src={sub.image_url}
                                      alt="作品"
                                      className="max-h-40 rounded-xl object-contain border cursor-pointer"
                                      onClick={() =>
                                        setZoomedImage({
                                          url: sub.image_url!,
                                          title: `${student?.name} 第 ${q.num} 題作品`,
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                請由左側點選學生檢視作答詳情
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 3: Roster Matrix Status */}
      {activeTab === 'roster' && (
        <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-soft border border-white/60 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                <th className="pb-3 px-2">座號</th>
                <th className="pb-3 px-2">姓名</th>
                {questions.map((q) => (
                  <th key={q.id} className="pb-3 px-2 text-center">
                    第 {q.num} 題
                  </th>
                ))}
                <th className="pb-3 px-2 text-right">進度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rosterStudents.map((s) => {
                const sId = room.custom_class_enabled
                  ? `temp_${s.number}`
                  : `${s.grade}-${s.class}-${s.number}`;
                const subMap = studentSubmissionsMap.get(sId);
                const subCount = subMap ? subMap.size : 0;
                const isAll = subCount === questions.length && questions.length > 0;

                return (
                  <tr key={sId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-300">
                      {s.number}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">
                      {s.name}
                    </td>
                    {questions.map((q) => {
                      const hasSub = subMap?.has(q.id);
                      return (
                        <td key={q.id} className="py-2.5 px-2 text-center">
                          {hasSub ? (
                            <span className="inline-flex w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          isAll
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : subCount > 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                      >
                        {subCount} / {questions.length}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Red Safety Zone: Download Package and Clear Storage */}
      <div className="pt-6">
        <div className="p-6 rounded-3xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">
                危險操作區・儲存空間清空與歸零
              </h4>
              <p className="text-xs text-rose-600/90 dark:text-rose-300/80 mt-0.5">
                為嚴格守護 Supabase 免費 1GB 額度，請於本輪作業結束後執行清空。系統將先為您打包匯出全部成果 Excel 與圖檔 ZIP，隨後徹底刪除雲端圖檔，將 Storage 歸零重置！
              </p>
            </div>
          </div>

          <button
            onClick={handleSafetyDownloadAndClear}
            disabled={clearing}
            className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {clearing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('homework.clearingProgress')}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                <span>{t('homework.safetyDownloadAndClear')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Zoomed Image Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="glass-panel max-w-3xl max-h-[90vh] rounded-3xl p-4 overflow-hidden border border-white/20 flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-bold text-white">{zoomedImage.title}</span>
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/40 rounded-2xl p-2">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
