import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Medal, Download, ArrowRight, RefreshCcw, Sparkles } from 'lucide-react';
import { Room, Submission } from '../../types';
import { exportRoomResults } from '../../lib/exportExcel';

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
  onResetScores,
}) => {
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

  const handleExport = () => {
    exportRoomResults(room, submissions);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner & Actions */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">班級榮譽排行榜</h2>
            <p className="text-xs sm:text-sm text-slate-500">即時累計作答積分與全班排名</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition shadow-xs flex items-center space-x-2"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>匯出成果 (Excel / ZIP)</span>
          </button>
          <button
            onClick={onNextQuestion}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-glow-indigo flex items-center space-x-2 active:scale-95"
          >
            <span>進行下一題</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {sortedStudents.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end pt-4">
          {/* 2nd Place */}
          {top2 && (
            <div className="glass-card rounded-3xl p-4 sm:p-6 text-center border-slate-300 shadow-soft h-52 flex flex-col justify-between">
              <div className="text-3xl sm:text-4xl">🥈</div>
              <div>
                <div className="font-extrabold text-sm sm:text-base text-slate-800 truncate">{top2.name}</div>
                <span className="text-[11px] text-slate-400 font-mono">#{top2.id}</span>
              </div>
              <div className="font-mono font-extrabold text-lg sm:text-xl text-slate-700">
                {top2.score} <span className="text-xs font-normal text-slate-400">分</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top1 && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6 text-center border-amber-300 bg-amber-50/40 shadow-glow-indigo h-64 flex flex-col justify-between scale-105 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-xs">
                CHAMPION
              </div>
              <div className="text-4xl sm:text-5xl mt-2">👑</div>
              <div>
                <div className="font-extrabold text-base sm:text-lg text-slate-900 truncate">{top1.name}</div>
                <span className="text-xs text-amber-700/80 font-mono font-bold">#{top1.id}</span>
              </div>
              <div className="font-mono font-black text-2xl sm:text-3xl text-indigo-600">
                {top1.score} <span className="text-xs font-normal text-indigo-400">分</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3 && (
            <div className="glass-card rounded-3xl p-4 sm:p-6 text-center border-amber-800/20 shadow-soft h-44 flex flex-col justify-between">
              <div className="text-3xl sm:text-4xl">🥉</div>
              <div>
                <div className="font-extrabold text-sm sm:text-base text-slate-800 truncate">{top3.name}</div>
                <span className="text-[11px] text-slate-400 font-mono">#{top3.id}</span>
              </div>
              <div className="font-mono font-extrabold text-lg sm:text-xl text-slate-700">
                {top3.score} <span className="text-xs font-normal text-slate-400">分</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="glass-card rounded-3xl p-6 shadow-soft">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">全班得分總名次</h3>
        <div className="divide-y divide-slate-100">
          {sortedStudents.map((st, index) => (
            <div key={st.id} className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="w-8 font-mono font-extrabold text-slate-400 text-center">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                </span>
                <span className="font-bold text-slate-800">{st.name}</span>
                <span className="text-xs text-slate-400 font-mono">({st.id})</span>
              </div>
              <div className="font-mono font-extrabold text-base text-indigo-600">
                {st.score} <span className="text-xs font-normal text-slate-400">分</span>
              </div>
            </div>
          ))}
          {sortedStudents.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm">目前尚無累計積分紀錄</div>
          )}
        </div>
      </div>
    </div>
  );
};
