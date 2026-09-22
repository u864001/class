import React, { useState, useEffect } from 'react';
import { School, Users, PlusCircle, CheckSquare, Square, Loader2, Sparkles } from 'lucide-react';
import { fetchRoster, formatClassLabel } from '../../lib/rosterApi';
import { supabase } from '../../lib/supabase';
import { ClassRosterStudent } from '../../types';

interface RoomSetupProps {
  onRoomCreated: (roomId: string) => void;
}

export const RoomSetup: React.FC<RoomSetupProps> = ({ onRoomCreated }) => {
  const [teacherName, setTeacherName] = useState('陳老師');
  const [customMode, setCustomMode] = useState(false);
  const [customCount, setCustomCount] = useState(20);
  const [rosterClasses, setRosterClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingRoster(true);
      const { rosterByClass } = await fetchRoster();
      const keys = Object.keys(rosterByClass).sort();
      setRosterClasses(keys);
      if (keys.length > 0) {
        setSelectedClasses([keys[0]]);
      } else {
        setCustomMode(true);
      }
      setLoadingRoster(false);
    }
    load();
  }, []);

  const toggleClass = (classKey: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classKey) ? prev.filter((k) => k !== classKey) : [...prev, classKey]
    );
  };

  const handleCreateRoom = async () => {
    if (!teacherName.trim()) {
      alert('請填寫教師姓名');
      return;
    }

    if (!customMode && selectedClasses.length === 0) {
      alert('請至少勾選一個班級，或開啟自訂人數模式');
      return;
    }

    setCreating(true);
    try {
      // Generate clean 6-character room code
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const codeLetter = letters[Math.floor(Math.random() * letters.length)];
      const codeNums = Math.floor(100 + Math.random() * 900);
      const roomId = `WT${codeLetter}${codeNums}`;

      const { error } = await supabase.from('rooms').insert({
        id: roomId,
        teacher_name: teacherName.trim(),
        status: 'idle',
        current_question_num: 1,
        question_type: 'choice',
        question_score: 1,
        timer_seconds: 20,
        custom_class_enabled: customMode,
        custom_student_count: customCount,
        selected_classes: selectedClasses,
        cumulative_scores: {},
        groups: ['第 1 組', '第 2 組', '第 3 組', '第 4 組'],
        group_scores: { '第 1 組': 0, '第 2 組': 0, '第 3 組': 0, '第 4 組': 0 },
      });

      if (error) throw error;
      onRoomCreated(roomId);
    } catch (err: any) {
      console.error('Failed to create room:', err);
      alert('建立教室失敗：' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60">
        {/* Header Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shadow-xs">
            <School className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">建立即時互動教室</h2>
            <p className="text-xs sm:text-sm text-slate-500">掃描 QR Code 免登入加入，支援作答、搶答與畫布批改</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Teacher Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              教師稱謂 / 姓名
            </label>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="例如：陳老師"
              className="w-full px-4 py-3 rounded-2xl bg-white/80 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium transition"
            />
          </div>

          {/* Mode Switcher */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700 text-sm">自訂人數模式</span>
                <p className="text-xs text-slate-400">若無固定班級名單，讓學生自由入座</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={customMode}
                  onChange={(e) => setCustomMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {customMode ? (
              <div className="flex items-center space-x-3 pt-2">
                <span className="text-xs font-medium text-slate-600">開放座位數：</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 20)))}
                  className="w-24 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-center outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">人 (1 ~ 50 人)</span>
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">勾選上課班級（可多選）：</div>
                {loadingRoster ? (
                  <div className="flex items-center space-x-2 py-4 text-xs text-slate-400 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>正在同步學校學生名單...</span>
                  </div>
                ) : rosterClasses.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {rosterClasses.map((clsKey) => {
                      const isSelected = selectedClasses.includes(clsKey);
                      return (
                        <button
                          key={clsKey}
                          type="button"
                          onClick={() => toggleClass(clsKey)}
                          className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition text-left ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-300 text-indigo-700 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                          <span>{formatClassLabel(clsKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">目前無法取得線上名單，建議切換為自訂人數模式</p>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleCreateRoom}
            disabled={creating}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-base transition shadow-glow-indigo flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>正在建立教室...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>立即開啟教室</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
