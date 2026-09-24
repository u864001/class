import React, { useState, useEffect } from 'react';
import { School, CheckSquare, Square, Loader2, Sparkles, BookOpen, Radio } from 'lucide-react';
import { fetchRoster, formatClassLabel } from '../../lib/rosterApi';
import { FIXED_ROOM_PRESETS, WUTAI_PRESETS, LIGU_PRESETS } from '../../lib/homeworkApi';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../context/I18nContext';

interface RoomSetupProps {
  onRoomCreated: (roomId: string) => void;
}

export const RoomSetup: React.FC<RoomSetupProps> = ({ onRoomCreated }) => {
  const [sessionMode, setSessionMode] = useState<'live' | 'homework'>('live');
  const [teacherName, setTeacherName] = useState('陳老師');

  // Live Mode settings
  const [customMode, setCustomMode] = useState(false);
  const [customCount, setCustomCount] = useState(20);
  const [rosterClasses, setRosterClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);

  // Homework Fixed Room settings
  const [campusTab, setCampusTab] = useState<'wutai' | 'ligu' | 'custom'>('wutai');
  const [fixedRoomCode, setFixedRoomCode] = useState('WT0601');
  const [selectedPreset, setSelectedPreset] = useState<string>('WT0601');

  const [creating, setCreating] = useState(false);

  const { t } = useI18n();

  useEffect(() => {
    async function load() {
      setLoadingRoster(true);
      const { rosterByClass } = await fetchRoster();
      const keys = Object.keys(rosterByClass).sort();
      setRosterClasses(keys);
      if (keys.length > 0 && selectedClasses.length === 0) {
        setSelectedClasses([keys[0]]);
      } else if (keys.length === 0) {
        setCustomMode(true);
      }
      setLoadingRoster(false);
    }
    load();

    const handleRosterChange = () => {
      load();
    };
    window.addEventListener('roster-changed', handleRosterChange);
    return () => window.removeEventListener('roster-changed', handleRosterChange);
  }, []);

  const toggleClass = (classKey: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classKey) ? prev.filter((k) => k !== classKey) : [...prev, classKey]
    );
  };

  const handleSelectPreset = (preset: typeof FIXED_ROOM_PRESETS[0]) => {
    setSelectedPreset(preset.code);
    setFixedRoomCode(preset.code);
    setSelectedClasses([preset.classKey]);
    setCustomMode(false);
  };

  const handleCreateRoom = async () => {
    if (!teacherName.trim()) {
      alert('請填寫教師姓名 / Please enter teacher name');
      return;
    }

    setCreating(true);
    try {
      if (sessionMode === 'live') {
        // --- 1. Live Interactive Mode (Random Code) ---
        if (!customMode && selectedClasses.length === 0) {
          alert('請至少勾選一個班級，或開啟自訂人數模式');
          setCreating(false);
          return;
        }

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
      } else {
        // --- 2. Homework Fixed Code Mode ---
        const codeToUse = fixedRoomCode.trim().toUpperCase();
        if (!codeToUse) {
          alert('請輸入或選擇固定教室代碼！');
          setCreating(false);
          return;
        }

        // Check if room already exists in Supabase
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', codeToUse)
          .single();

        if (existingRoom) {
          // If room exists, verify or update teacher name if needed
          await supabase
            .from('rooms')
            .update({ teacher_name: teacherName.trim() })
            .eq('id', codeToUse);

          onRoomCreated(codeToUse);
        } else {
          // Create new fixed room in homework_prep status
          const { error } = await supabase.from('rooms').insert({
            id: codeToUse,
            teacher_name: teacherName.trim(),
            status: 'homework_prep',
            current_question_num: 1,
            question_type: 'choice',
            question_score: 2,
            timer_seconds: 20,
            custom_class_enabled: customMode,
            custom_student_count: customCount,
            selected_classes: selectedClasses,
            cumulative_scores: {},
            groups: ['第 1 組', '第 2 組', '第 3 組', '第 4 組'],
            group_scores: { '第 1 組': 0, '第 2 組': 0, '第 3 組': 0, '第 4 組': 0 },
          });

          if (error) throw error;
          onRoomCreated(codeToUse);
        }
      }
    } catch (err: any) {
      console.error('Failed to create room:', err);
      alert('建立教室失敗：' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700">
        {/* Header Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl badge-theme flex items-center justify-center shadow-xs">
            <School className="w-6 h-6 text-theme" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {t('setup.title')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t('setup.subtitle')}
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1.5 border border-slate-200/80 dark:border-slate-700 mb-6">
          <button
            type="button"
            onClick={() => setSessionMode('live')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-2 ${
              sessionMode === 'live'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{t('homework.modeLive')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSessionMode('homework');
              // Auto set default preset
              if (FIXED_ROOM_PRESETS.length > 0) {
                handleSelectPreset(FIXED_ROOM_PRESETS[0]);
              }
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-2 ${
              sessionMode === 'homework'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t('homework.modeHomework')}</span>
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Teacher Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              教師稱謂 / 姓名
            </label>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="例如：陳老師"
              className="w-full px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium transition"
            />
          </div>

          {/* Mode Specific Configuration */}
          {sessionMode === 'homework' ? (
            /* Homework Fixed Code Settings */
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 space-y-4">
              {/* Campus Selector Sub-Tabs */}
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs block mb-2">
                  選擇校區與班級 (或科任自訂)：
                </span>
                <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-700/60 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setCampusTab('wutai');
                      handleSelectPreset(WUTAI_PRESETS[5]); // default 六甲
                    }}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      campusTab === 'wutai'
                        ? 'bg-white dark:bg-slate-800 text-theme shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    霧臺校區 (甲班)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCampusTab('ligu');
                      handleSelectPreset(LIGU_PRESETS[4]); // default 五乙
                    }}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      campusTab === 'ligu'
                        ? 'bg-white dark:bg-slate-800 text-theme shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    勵古校區 (乙班)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCampusTab('custom');
                      setSelectedPreset('');
                    }}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      campusTab === 'custom'
                        ? 'bg-white dark:bg-slate-800 text-theme shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    科任自訂開班
                  </button>
                </div>
              </div>

              {campusTab === 'wutai' && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                  {WUTAI_PRESETS.map((p) => {
                    const isSelected = selectedPreset === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          isSelected
                            ? 'badge-theme border-current shadow-xs font-bold scale-105'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-xs font-black text-slate-800 dark:text-slate-100">{p.shortLabel}</span>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{p.code}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {campusTab === 'ligu' && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                  {LIGU_PRESETS.map((p) => {
                    const isSelected = selectedPreset === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          isSelected
                            ? 'badge-theme border-current shadow-xs font-bold scale-105'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-xs font-black text-slate-800 dark:text-slate-100">{p.shortLabel}</span>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{p.code}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {campusTab === 'custom' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                      科任自訂教室代碼 (例如 NAT01, ENG02)：
                    </label>
                    <input
                      type="text"
                      value={fixedRoomCode}
                      onChange={(e) => {
                        setFixedRoomCode(e.target.value.toUpperCase());
                        setSelectedPreset('');
                      }}
                      placeholder="例如：NAT01"
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-mono font-bold tracking-widest outline-none text-center"
                    />
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      指派作答班級名單：
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                      {rosterClasses.map((clsKey) => {
                        const isSelected = selectedClasses.includes(clsKey);
                        return (
                          <button
                            key={clsKey}
                            type="button"
                            onClick={() => toggleClass(clsKey)}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-xs font-medium transition text-left ${
                              isSelected
                                ? 'badge-theme border-current font-bold'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span>{formatClassLabel(clsKey, true)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {campusTab !== 'custom' && (
                <div className="pt-2 text-xs flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-400">目前選定班級代碼：</span>
                  <span className="font-mono font-bold text-theme bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    {fixedRoomCode}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Live Class Configuration */
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                    {t('setup.customClassToggle')}
                  </span>
                  <p className="text-xs text-slate-400">
                    若無固定班級名單，讓學生自由以座號入座
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customMode}
                    onChange={(e) => setCustomMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {customMode ? (
                <div className="flex items-center space-x-3 pt-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t('setup.customStudentCount')}：
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customCount}
                    onChange={(e) => setCustomCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 20)))}
                    className="w-24 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-center outline-none"
                  />
                  <span className="text-xs text-slate-400">人 (1 ~ 50 {t('common.people')})</span>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {t('setup.selectClass')}：
                  </div>
                  {loadingRoster ? (
                    <div className="flex items-center space-x-2 py-4 text-xs text-slate-400 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-theme" />
                      <span>{t('setup.loadingRoster')}</span>
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
                                ? 'badge-theme border-current shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-theme flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            )}
                            <span>{formatClassLabel(clsKey)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600">
                      {t('setup.noRosterAlert')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleCreateRoom}
            disabled={creating}
            className="w-full py-4 rounded-2xl btn-theme-primary active:scale-[0.99] font-bold text-base transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('setup.creating')}</span>
              </>
            ) : sessionMode === 'homework' ? (
              <>
                <BookOpen className="w-5 h-5" />
                <span>進入固定教室作業管理 ({fixedRoomCode})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{t('setup.startClassroom')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
