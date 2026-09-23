import React, { useState } from 'react';
import { Lock, X, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { getAdminPassword } from '../../lib/rosterApi';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPassword = getAdminPassword();
    if (password.trim() === correctPassword) {
      setError(false);
      setPassword('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-panel max-w-sm w-full rounded-3xl p-6 shadow-soft relative border border-white/80 text-center space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
          <KeyRound className="w-7 h-7" />
        </div>

        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">系統管理員驗證</h3>
          <p className="text-xs text-slate-400 mt-1">請輸入管理員密碼以進入隱藏設定後台</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-3 pt-1">
          <div className="relative">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              placeholder="請輸入管理密碼..."
              className={`w-full px-4 py-3 rounded-2xl border text-center font-mono font-bold tracking-widest text-slate-800 outline-none transition text-base ${
                error
                  ? 'border-rose-400 bg-rose-50/50 ring-2 ring-rose-200'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white'
              }`}
            />
          </div>

          {error && (
            <div className="flex items-center justify-center space-x-1 text-xs text-rose-500 font-semibold animate-shake">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>密碼錯誤，請重新輸入</span>
            </div>
          )}

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95"
            >
              <span>進入後台</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
