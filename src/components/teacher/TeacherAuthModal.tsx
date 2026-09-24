import React, { useState } from 'react';
import { GraduationCap, X, KeyRound, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { verifyTeacherPin, setTeacherAuthorized } from '../../lib/rosterApi';
import { useI18n } from '../../context/I18nContext';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const { t } = useI18n();

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyTeacherPin(pin)) {
      setError(false);
      if (rememberDevice) {
        setTeacherAuthorized(true);
      }
      setPin('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-panel max-w-sm w-full rounded-3xl p-6 shadow-2xl relative border border-white/80 dark:border-slate-700 text-center space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition"
          title={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl badge-theme text-theme flex items-center justify-center mx-auto shadow-2xs border border-white/60">
          <GraduationCap className="w-8 h-8" />
        </div>

        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">
            教師身分驗證
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
            進入教師主控台請輸入 4 位數教師通行碼
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 pt-1">
          <div className="relative">
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(false);
              }}
              placeholder="請輸入教師碼 (預設: 8888)"
              className={`w-full px-4 py-3 rounded-2xl border text-center font-mono font-bold tracking-widest text-slate-800 dark:text-slate-100 dark:bg-slate-800 outline-none transition text-base ${
                error
                  ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 ring-2 ring-rose-200'
                  : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800'
              }`}
            />
          </div>

          {error && (
            <div className="flex items-center justify-center space-x-1 text-xs text-rose-500 font-semibold animate-shake">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>通行碼錯誤，請重新輸入</span>
            </div>
          )}

          {/* Remember this device checkbox */}
          <label className="flex items-center justify-center space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            <span>在此裝置保持授權（下次免輸入）</span>
          </label>

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl btn-theme-primary text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95"
            >
              <span>切換教師端</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            💡 預設教師碼為 <span className="font-mono font-bold text-slate-600 dark:text-slate-300">8888</span>（或使用校務管理密碼）
          </div>
        </form>
      </div>
    </div>
  );
};
