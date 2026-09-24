import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Download, ArrowRight, Loader2 } from 'lucide-react';
import { Room, Submission } from '../../types';
import { exportRoomResults } from '../../lib/exportExcel';
import { useI18n } from '../../context/I18nContext';

interface LeaderboardProps {
  room: Room;
  submissions: Submission[];
  onNextQuestion: () => void;
  onResetScores: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  room,
  submissions,
  onNextQuestion,
}) => {
  const [exporting, setExporting] = useState(false);
  const { t } = useI18n();

  // Fire celebratory confetti on mount
  useEffect(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  // Compute rankings from room.cumulative_scores
  const scoresMap = room.cumulative_scores || {};
  const sortedStudents = Object.entries(scoresMap)
    .map(([id, score]) => {
      const sub = submissions.find((s) => s.student_id === id);
      return {
        id,
        name: sub?.student_name || id,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const top1 = sortedStudents[0];
  const top2 = sortedStudents[1];
  const top3 = sortedStudents[2];

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportRoomResults(room, submissions);
      alert(t('leaderboard.exportSuccess'));
    } catch (err: any) {
      alert('匯出失敗：' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner & Actions */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t('leaderboard.title')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t('leaderboard.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition shadow-xs flex items-center space-x-2 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-theme" />
                <span>{t('leaderboard.exportingBtn')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-theme" />
                <span>{t('leaderboard.exportBtn')}</span>
              </>
            )}
          </button>
          <button
            onClick={onNextQuestion}
            className="px-6 py-3 rounded-2xl btn-theme-primary font-bold text-sm transition flex items-center space-x-2 active:scale-95"
          >
            <span>{t('leaderboard.nextQuestionBtn')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {sortedStudents.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end pt-4">
          {/* 2nd Place */}
          {top2 && (
            <div className="glass-card rounded-3xl p-4 sm:p-6 text-center border-slate-300 dark:border-slate-700 shadow-soft h-52 flex flex-col justify-between">
              <div className="text-3xl sm:text-4xl">🥈</div>
              <div>
                <div className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate">
                  {top2.name}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">#{top2.id}</span>
              </div>
              <div className="font-mono font-extrabold text-lg sm:text-xl text-slate-700 dark:text-slate-300">
                {top2.score} <span className="text-xs font-normal text-slate-400">{t('common.points')}</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top1 && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6 text-center border-amber-300 dark:border-amber-700/80 bg-amber-50/40 dark:bg-amber-950/20 shadow-glow-theme h-64 flex flex-col justify-between scale-105 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-xs">
                {t('leaderboard.champion')}
              </div>
              <div className="text-4xl sm:text-5xl mt-2">👑</div>
              <div>
                <div className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">
                  {top1.name}
                </div>
                <span className="text-xs text-amber-700/80 dark:text-amber-400 font-mono font-bold">
                  #{top1.id}
                </span>
              </div>
              <div className="font-mono font-black text-2xl sm:text-3xl text-theme">
                {top1.score} <span className="text-xs font-normal opacity-70">{t('common.points')}</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3 && (
            <div className="glass-card rounded-3xl p-4 sm:p-6 text-center border-amber-800/20 dark:border-amber-900/40 shadow-soft h-44 flex flex-col justify-between">
              <div className="text-3xl sm:text-4xl">🥉</div>
              <div>
                <div className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate">
                  {top3.name}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">#{top3.id}</span>
              </div>
              <div className="font-mono font-extrabold text-lg sm:text-xl text-slate-700 dark:text-slate-300">
                {top3.score} <span className="text-xs font-normal text-slate-400">{t('common.points')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="glass-card rounded-3xl p-6 shadow-soft">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
          {t('leaderboard.rankingListTitle')}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sortedStudents.map((st, index) => (
            <div key={st.id} className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="w-8 font-mono font-extrabold text-slate-400 text-center">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{st.name}</span>
                <span className="text-xs text-slate-400 font-mono">({st.id})</span>
              </div>
              <div className="font-mono font-extrabold text-base text-theme">
                {st.score} <span className="text-xs font-normal text-slate-400">{t('common.points')}</span>
              </div>
            </div>
          ))}
          {sortedStudents.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm">
              {t('leaderboard.noRecords')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
