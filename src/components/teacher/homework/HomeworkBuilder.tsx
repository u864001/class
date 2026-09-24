import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Sparkles,
  Camera,
  Upload,
  Monitor,
  Image as ImageIcon,
  Loader2,
  FileQuestion,
  HelpCircle,
  PenTool,
} from 'lucide-react';
import { Room, HomeworkQuestion, QuestionType } from '../../../types';
import { serializeHomework, parseHomework } from '../../../lib/homeworkApi';
import {
  isScreenCaptureSupported,
  captureAndUploadScreenSnapshot,
  uploadSlideFromFile,
} from '../../../lib/imageCompressor';
import { supabase } from '../../../lib/supabase';
import { useI18n } from '../../../context/I18nContext';

interface HomeworkBuilderProps {
  room: Room;
  onPublished: () => void;
  onCancel?: () => void;
}

export const HomeworkBuilder: React.FC<HomeworkBuilderProps> = ({
  room,
  onPublished,
}) => {
  const { t } = useI18n();

  // Load existing questions if editing
  const existingHw = parseHomework(room.question_note);

  const [title, setTitle] = useState(existingHw?.title || '課堂回家作業');
  const [questions, setQuestions] = useState<HomeworkQuestion[]>(
    existingHw?.questions && existingHw.questions.length > 0
      ? existingHw.questions
      : [
          {
            id: 'HW_Q1',
            num: 1,
            type: 'choice',
            note: '請根據課堂所學，選出最適合的選項：',
            score: 2,
            imageUrl: null,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
          },
        ]
  );

  const [publishing, setPublishing] = useState(false);
  const [capturingImgIdx, setCapturingImgIdx] = useState<number | null>(null);

  // Add Question
  const handleAddQuestion = (type: QuestionType) => {
    const nextNum = questions.length + 1;
    const newQ: HomeworkQuestion = {
      id: `HW_Q${nextNum}_${Date.now().toString(36).slice(-4)}`,
      num: nextNum,
      type,
      note:
        type === 'choice'
          ? '請選擇正確選項：'
          : type === 'text'
          ? '請以簡短語句回答以下問題：'
          : '請在畫布上進行繪圖作答，或拍照上傳作品：',
      score: 2,
      imageUrl: null,
      options: type === 'choice' ? ['A', 'B', 'C', 'D'] : undefined,
      correctAnswer: type === 'choice' ? 'A' : null,
    };
    setQuestions([...questions, newQ]);
  };

  // Remove Question
  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('作業至少需保留 1 道題目！');
      return;
    }
    const updated = questions
      .filter((_, i) => i !== idx)
      .map((q, i) => ({ ...q, num: i + 1 }));
    setQuestions(updated);
  };

  // Move Question
  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const copy = [...questions];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;
    setQuestions(copy.map((q, i) => ({ ...q, num: i + 1 })));
  };

  // Update specific field of a question
  const updateQuestion = (idx: number, fields: Partial<HomeworkQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...fields } : q))
    );
  };

  // Image Upload Handlers
  const handleUploadImage = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturingImgIdx(idx);
    try {
      const url = await uploadSlideFromFile(room.id, idx + 1, file);
      updateQuestion(idx, { imageUrl: url });
    } catch (err: any) {
      alert('上傳失敗：' + err.message);
    } finally {
      setCapturingImgIdx(null);
      e.target.value = '';
    }
  };

  const handleScreenCapture = async (idx: number) => {
    setCapturingImgIdx(idx);
    try {
      const url = await captureAndUploadScreenSnapshot(room.id);
      updateQuestion(idx, { imageUrl: url });
    } catch (err: any) {
      alert('螢幕擷取取消或失敗：' + err.message);
    } finally {
      setCapturingImgIdx(null);
    }
  };

  // Publish Homework
  const handlePublish = async () => {
    if (!title.trim()) {
      alert('請填寫作業主題名稱！');
      return;
    }
    if (questions.length === 0) {
      alert('請至少新增 1 道題目！');
      return;
    }

    setPublishing(true);
    try {
      const assignmentId =
        existingHw?.assignment_id ||
        `ASG_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // Ensure each question ID is reliably scoped to this assignment
      const normalizedQuestions = questions.map((q, idx) => {
        const qId = q.id.startsWith(assignmentId)
          ? q.id
          : `${assignmentId}_Q${idx + 1}`;
        return {
          ...q,
          id: qId,
          num: idx + 1,
        };
      });

      const serialized = serializeHomework(title, normalizedQuestions, assignmentId);
      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'homework_active',
          question_note: serialized,
          current_question_num: normalizedQuestions.length,
          answering_started_at: new Date().toISOString(),
        })
        .eq('id', room.id.toUpperCase());

      if (error) throw error;
      alert(t('homework.publishSuccess'));
      onPublished();
    } catch (err: any) {
      console.error('Publish homework error:', err);
      alert('發布作業失敗：' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Header Info */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-700/80 pb-6 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full badge-theme text-xs font-bold font-mono">
                {room.id}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('homework.modeHomework')}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
              {t('homework.builderTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('homework.builderSubtitle')}
            </p>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="btn-theme-primary px-6 py-3.5 rounded-2xl font-bold text-sm shadow-md active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('homework.publishing')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{t('homework.publishBtn')}</span>
              </>
            )}
          </button>
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {t('homework.homeworkTitleLabel')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('homework.homeworkTitlePlaceholder')}
            className="w-full px-4 py-3 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-bold text-base transition"
          />
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-5">
        {questions.map((q, idx) => (
          <div
            key={q.id || idx}
            className="glass-panel rounded-3xl p-5 sm:p-7 shadow-soft border border-white/60 dark:border-slate-700 space-y-4"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-xl btn-theme-primary font-black text-sm flex items-center justify-center shadow-xs">
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {q.type === 'choice'
                    ? '選擇題 (Multiple Choice)'
                    : q.type === 'text'
                    ? '問答簡答題 (Short Answer)'
                    : '繪圖/上傳題 (Drawing / Photo)'}
                </span>
              </div>

              {/* Move & Delete Actions */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleMoveQuestion(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-500 disabled:opacity-25"
                  title="上移"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveQuestion(idx, 'down')}
                  disabled={idx === questions.length - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-500 disabled:opacity-25"
                  title="下移"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(idx)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500"
                  title="刪除此題"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Type selector & score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  題型切換
                </label>
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/60 dark:border-slate-700">
                  {(['choice', 'text', 'image'] as QuestionType[]).map((tType) => (
                    <button
                      key={tType}
                      type="button"
                      onClick={() =>
                        updateQuestion(idx, {
                          type: tType,
                          options: tType === 'choice' ? ['A', 'B', 'C', 'D'] : undefined,
                          correctAnswer: tType === 'choice' ? q.correctAnswer || 'A' : null,
                        })
                      }
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        q.type === tType
                          ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {tType === 'choice' ? '選擇' : tType === 'text' ? '簡答' : '繪圖'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  配分 (Points)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={q.score}
                    onChange={(e) =>
                      updateQuestion(idx, {
                        score: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-24 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 text-center outline-none"
                  />
                  <span className="text-xs text-slate-400">分</span>
                </div>
              </div>
            </div>

            {/* Note / Prompt */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                題目說明 / 題目文字
              </label>
              <textarea
                rows={2}
                value={q.note}
                onChange={(e) => updateQuestion(idx, { note: e.target.value })}
                placeholder="請輸入題目敘述..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none transition"
              />
            </div>

            {/* If Choice: set correct answer */}
            {q.type === 'choice' && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-2">
                  設定標準答案 (點選設定，評分時自動對答案)：
                </span>
                <div className="flex items-center space-x-2">
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateQuestion(idx, { correctAnswer: opt })}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition flex items-center justify-center ${
                        q.correctAnswer === opt
                          ? 'btn-theme-primary shadow-xs scale-105'
                          : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateQuestion(idx, { correctAnswer: null })}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      !q.correctAnswer
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    自由作答(無標準答案)
                  </button>
                </div>
              </div>
            )}

            {/* Reference Image Attachment */}
            <div className="pt-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                題目圖片 / 參考圖片 (選填)
              </label>

              {q.imageUrl ? (
                <div className="relative inline-block border rounded-2xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-800 max-w-sm">
                  <img
                    src={q.imageUrl}
                    alt="題目圖片"
                    className="max-h-48 w-auto object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => updateQuestion(idx, { imageUrl: null })}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition"
                    title="移除圖片"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* File Upload */}
                  <label className="cursor-pointer px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition">
                    <Upload className="w-3.5 h-3.5 text-theme" />
                    <span>上傳圖片檔案</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(idx, e)}
                    />
                  </label>

                  {/* Rear / Front Camera Photo */}
                  <label className="cursor-pointer px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>相機拍照</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleUploadImage(idx, e)}
                    />
                  </label>

                  {/* Desktop Screen Capture */}
                  {isScreenCaptureSupported() && (
                    <button
                      type="button"
                      onClick={() => handleScreenCapture(idx)}
                      disabled={capturingImgIdx === idx}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition"
                    >
                      {capturingImgIdx === idx ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Monitor className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>擷取電腦螢幕/講義</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Question Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {t('homework.addQuestionBtn')}：
        </span>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleAddQuestion('choice')}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-indigo-400 active:scale-95 transition flex items-center space-x-1.5"
          >
            <HelpCircle className="w-4 h-4 text-theme" />
            <span>+ 選擇題</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddQuestion('text')}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-indigo-400 active:scale-95 transition flex items-center space-x-1.5"
          >
            <FileQuestion className="w-4 h-4 text-emerald-600" />
            <span>+ 簡答題</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddQuestion('image')}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-indigo-400 active:scale-95 transition flex items-center space-x-1.5"
          >
            <PenTool className="w-4 h-4 text-amber-600" />
            <span>+ 繪圖/作品題</span>
          </button>
        </div>
      </div>

      {/* Bottom Publish Bar */}
      <div className="sticky bottom-4 z-20 pt-4">
        <div className="glass-panel rounded-2xl p-4 shadow-xl border border-white/80 dark:border-slate-700 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            共 <span className="font-bold text-theme">{questions.length}</span> 道題目，
            總配分{' '}
            <span className="font-bold text-emerald-600">
              {questions.reduce((acc, q) => acc + (q.score || 0), 0)}
            </span>{' '}
            分
          </div>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="btn-theme-primary px-6 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 flex items-center space-x-2"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('homework.publishing')}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('homework.publishBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
