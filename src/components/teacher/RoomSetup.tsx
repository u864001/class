import React, { useState, useEffect } from 'react';
import { School, CheckSquare, Square, Loader2, Sparkles, BookOpen, Radio } from 'lucide-react';
import { fetchRoster, formatClassLabel } from '../../lib/rosterApi';
import {
  FIXED_ROOM_PRESETS,
  WUTAI_PRESETS,
  LIGU_PRESETS,
  SUBJECT_PRESETS,
  getSubjectsForGrade,
  parseRoomCode,
} from '../../lib/homeworkApi';
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
  const [selectedPreset, setSelectedPreset] = useState<string>('WT0601');
  const [selectedSubject, setSelectedSubject] = useState<string>('CH');
  const [fixedRoomCode, setFixedRoomCode] = useState('WT0601CH');

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

  const currentPreset = FIXED_ROOM_PRESETS.find((p) => p.code === selectedPreset);
  const availableSubjects = getSubjectsForGrade(currentPreset?.grade);
  const parsedCurrentRoom = parseRoomCode(fixedRoomCode);

  const handleSelectPreset = (preset: typeof FIXED_ROOM_PRESETS[0], subCode?: string) => {
    const allowed = getSubjectsForGrade(preset.grade);
    let sub = subCode !== undefined ? subCode : selectedSubject;
    if (!allowed.some((s) => s.code === sub)) {
      sub = allowed[0]?.code || 'CH';
    }
    setSelectedSubject(sub);
    setSelectedPreset(preset.code);
    setFixedRoomCode(`${preset.code}${sub}`);
    setSelectedClasses([preset.classKey]);
    setCustomMode(false);
  };

  const handleSelectSubject = (subCode: string) => {
    setSelectedSubject(subCode);
    if (selectedPreset) {
      setFixedRoomCode(`${selectedPreset}${subCode}`);
    }
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

              {campusTab !== 'custom' && (
                <>
                  {/* Subject Selector Pills */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                        選擇作業科目 (避免多科同日撞房)：
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        代碼後綴: +{selectedSubject}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSubjects.map((sub) => {
                        const isSubSelected = selectedSubject === sub.code;
                        return (
                          <button
                            key={sub.code}
                            type="button"
                            onClick={() => handleSelectSubject(sub.code)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                              isSubSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                            }`}
                          >
                            <span>{sub.icon}</span>
                            <span>{sub.name}</span>
                            <span className="text-[10px] opacity-75 font-mono">({sub.code})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Room Code & Class Preview Card */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        固定作業教室預覽
                      </span>
                      <span className="font-mono font-black text-theme text-xs px-2.5 py-0.5 rounded-lg badge-theme">
                        {fixedRoomCode}
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                      <span>{parsedCurrentRoom.displayLabel}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      💡 自動綁定名冊，學生進入直接點選座號姓名；出新作業時若同科目已有舊作業，系統會貼心提醒並可一鍵覆蓋或封存。
                    </p>
                  </div>
                </>
              )}

              {campusTab === 'custom' && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    💡 <strong>混齡社團 / 跨班課後班模式：</strong>
                    <br />
                    在此自訂專屬代碼（如 <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">CLUB01</code>、<code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">CARE01</code>），並於下方<strong>複選多個班級</strong>（例如同時勾選三甲與四甲）。
                    系統會智慧整合跨班學生名單，學生進入時可依所屬班級點選座號姓名，作答與統計互不干擾！
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                      科任 / 社團自訂教室代碼 (例如 CLUB01, ENG02)：
                    </label>
                    <input
                      type="text"
                      value={fixedRoomCode}
                      onChange={(e) => {
                        setFixedRoomCode(e.target.value.toUpperCase());
                        setSelectedPreset('');
                      }}
                      placeholder="例如：CLUB01"
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-mono font-bold tracking-widest outline-none text-center"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        指派作答班級名單（可複選多個班級組成混齡名單）：
                      </span>
                      <span className="text-[11px] text-theme font-bold">
                        已選 {selectedClasses.length} 班
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                      {rosterClasses.map((clsKey) => {
                        const isSelected = selectedClasses.includes(clsKey);
                        return (
                          <button
                            key={clsKey}
                            type="button"
                            onClick={() => toggleClass(clsKey)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition text-left ${
                              isSelected
                                ? 'badge-theme border-current font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span>{formatClassLabel(clsKey, true)}</span>
                            {isSelected && <CheckSquare className="w-3.5 h-3.5 text-theme flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
