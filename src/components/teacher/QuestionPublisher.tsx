import React, { useState } from 'react';
import { Send, Image as ImageIcon, Clock, Award, CheckCircle2, FileText, Palette, UploadCloud, X, Loader2 } from 'lucide-react';
import { Room, QuestionType } from '../../types';
import { uploadImageFile } from '../../lib/imageCompressor';

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImageFile(file, room.id, `q${room.current_question_num}`);
      setImageUrl(url);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('圖片上傳失敗，請重試');
    } finally {
      setUploading(false);
    }
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
      alert('發布題目失敗：' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 space-y-6">
        {/* Step Header */}
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step 2 / 出題設定</span>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">第 {room.current_question_num} 題設定</h2>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <Award className="w-4 h-4" />
            <span>分數：{score} 分</span>
          </div>
        </div>

        {/* 1. Question Type Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            選擇題型
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: 'choice' as QuestionType, label: '選擇題 ABCD', icon: CheckCircle2, desc: '快速按鈕自動批改' },
              { type: 'text' as QuestionType, label: '文字簡答題', icon: FileText, desc: '學生輸入文字說明' },
              { type: 'image' as QuestionType, label: '畫布/照片畫記', icon: Palette, desc: '畫圖標註或拍照上傳' },
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
                      ? 'bg-indigo-50/80 border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div>
                    <div className={`font-bold text-xs sm:text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Question Prompt / Note */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            題目提示或說明（選填）
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`例如：請看大螢幕投影，選出正確的部首`}
            className="w-full px-4 py-3 rounded-2xl bg-white/80 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium transition"
          />
        </div>

        {/* 3. Reference Image Upload */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            {qType === 'image' ? '畫布底圖 / 題目圖片（學生可在圖上作畫）' : '參考圖片（選填）'}
          </label>
          {imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-48 flex items-center justify-center">
              <img src={imageUrl} alt="Question ref" className="max-h-48 object-contain" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-white/50 hover:bg-indigo-50/20 transition">
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={uploading} />
              {uploading ? (
                <div className="flex items-center space-x-2 text-indigo-600 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>正在壓縮並上傳圖片...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium">
                  <UploadCloud className="w-5 h-5 text-indigo-500" />
                  <span>點擊上傳圖片或拍照（JPG / PNG / WebP）</span>
                </div>
              )}
            </label>
          )}
        </div>

        {/* 4. Score & Timer Selection */}
        <div className="grid grid-cols-2 gap-4">
          {/* Score selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              本題得分權重
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 5].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setScore(pts)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    score === pts
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pts} 分
                </button>
              ))}
            </div>
          </div>

          {/* Timer selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              作答秒數
            </label>
            <div className="flex items-center space-x-2">
              {[15, 20, 30, 60].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeconds(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    seconds === s
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Publish Action Button */}
        <button
          onClick={handlePublish}
          disabled={publishing || uploading}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-base transition shadow-glow-indigo flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {publishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>正在推送到全班學生端...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>發布題目（推送到學生端）</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
