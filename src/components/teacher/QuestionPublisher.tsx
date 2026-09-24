import React, { useState, useRef } from 'react';
import {
  Send,
  Award,
  CheckCircle2,
  FileText,
  Palette,
  UploadCloud,
  Camera,
  FolderOpen,
  User,
  X,
  Loader2,
} from 'lucide-react';
import { Room, QuestionType } from '../../types';
import { uploadImageFile } from '../../lib/imageCompressor';
import { useI18n } from '../../context/I18nContext';

interface QuestionPublisherProps {
  room: Room;
  onPublish: (questionData: {
    question_type: QuestionType;
    question_note: string;
    question_score: number;
    question_image_url: string | null;
    timer_seconds: number;
  }) => Promise<void>;
}

export const QuestionPublisher: React.FC<QuestionPublisherProps> = ({ room, onPublish }) => {
  const [qType, setQType] = useState<QuestionType>('choice');
  const [note, setNote] = useState('');
  const [score, setScore] = useState(room.question_score || 2);
  const [seconds, setSeconds] = useState(room.timer_seconds || 20);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraBackInputRef = useRef<HTMLInputElement>(null);
  const cameraFrontInputRef = useRef<HTMLInputElement>(null);

  const { t } = useI18n();

  const handleProcessFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file, room.id, `q${room.current_question_num}`);
      setImageUrl(url);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('圖片上傳失敗，請重試 / Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
    e.target.value = '';
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish({
        question_type: qType,
        question_note: note.trim() || `第 ${room.current_question_num} 題`,
        question_score: score,
        question_image_url: imageUrl,
        timer_seconds: seconds,
      });
    } catch (err: any) {
      alert(t('publisher.publishFailed') + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hidden file inputs for smart displays / tablets / PC */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraBackInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraFrontInputRef}
        accept="image/*"
        capture="user"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700 space-y-6">
        {/* Step Header */}
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700 pb-4">
          <div>
            <span className="text-xs font-bold text-theme uppercase tracking-wider">
              {t('publisher.stepTag')}
            </span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {t('publisher.questionTitle', { num: room.current_question_num })}
            </h2>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl badge-theme text-xs font-semibold">
            <Award className="w-4 h-4" />
            <span>{t('publisher.scoreLabel', { score })}</span>
          </div>
        </div>

        {/* 1. Question Type Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
            {t('publisher.questionType')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                type: 'choice' as QuestionType,
                label: t('publisher.typeChoice'),
                icon: CheckCircle2,
                desc: t('publisher.typeChoiceDesc'),
              },
              {
                type: 'text' as QuestionType,
                label: t('publisher.typeText'),
                icon: FileText,
                desc: t('publisher.typeTextDesc'),
              },
              {
                type: 'image' as QuestionType,
                label: t('publisher.typeImage'),
                icon: Palette,
                desc: t('publisher.typeImageDesc'),
              },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = qType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setQType(item.type)}
                  className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                    isSelected
                      ? 'badge-theme border-current ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-2 ${
                      isSelected ? 'text-theme' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div>
                    <div
                      className={`font-bold text-xs sm:text-sm ${
                        isSelected
                          ? 'text-theme font-extrabold'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 hidden sm:block">
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Question Prompt / Note */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {t('publisher.promptNote')}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('publisher.promptPlaceholder')}
            className="w-full px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-800 dark:text-slate-100 font-medium transition"
          />
        </div>

        {/* 3. Reference Image Upload with Mobile/Tablet Camera Support */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {qType === 'image'
              ? t('publisher.imageLabelImageMode')
              : t('publisher.imageLabelOtherMode')}
          </label>

          {imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 max-h-52 flex items-center justify-center p-2">
              <img
                src={imageUrl}
                alt="Question ref"
                className="max-h-48 object-contain rounded-xl"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {uploading ? (
                <div className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-2xl p-6 flex items-center justify-center space-x-2 text-theme text-xs font-bold bg-indigo-50/20">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('publisher.uploadingImg')}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Option 1: File picker / Album */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 transition flex flex-col items-center justify-center text-center space-y-1 shadow-2xs group"
                  >
                    <FolderOpen className="w-5 h-5 text-theme group-hover:scale-110 transition" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('publisher.uploadDoc')}
                    </span>
                    <span className="text-[10px] text-slate-400">JPG / PNG / WebP</span>
                  </button>

                  {/* Option 2: Rear Camera / Photograph Textbook */}
                  <button
                    type="button"
                    onClick={() => cameraBackInputRef.current?.click()}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-300 transition flex flex-col items-center justify-center text-center space-y-1 shadow-2xs group"
                  >
                    <Camera className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('publisher.takePhotoBack')}
                    </span>
                    <span className="text-[10px] text-emerald-600/80 font-medium">平板後鏡頭/相機</span>
                  </button>

                  {/* Option 3: Front Camera */}
                  <button
                    type="button"
                    onClick={() => cameraFrontInputRef.current?.click()}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 transition flex flex-col items-center justify-center text-center space-y-1 shadow-2xs group"
                  >
                    <User className="w-5 h-5 text-slate-500 group-hover:scale-110 transition" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('publisher.takePhotoFront')}
                    </span>
                    <span className="text-[10px] text-slate-400">前置鏡頭</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Score & Timer Selection */}
        <div className="grid grid-cols-2 gap-4">
          {/* Score selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('publisher.scoreWeight')}
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 5].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setScore(pts)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    score === pts
                      ? 'btn-theme-primary'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {pts} {t('common.points')}
                </button>
              ))}
            </div>
          </div>

          {/* Timer selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('publisher.timerSeconds')}
            </label>
            <div className="flex items-center space-x-2">
              {[15, 20, 30, 60].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeconds(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    seconds === s
                      ? 'btn-theme-primary'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {s}{t('common.seconds')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Publish Action Button */}
        <button
          onClick={handlePublish}
          disabled={publishing || uploading}
          className="w-full py-4 rounded-2xl btn-theme-primary active:scale-[0.99] font-bold text-base transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {publishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('publisher.publishingBtn')}</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{t('publisher.publishBtn')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
