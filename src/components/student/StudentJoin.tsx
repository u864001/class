import React, { useState, useEffect } from 'react';
import { LogIn, School, Loader2, BookOpen, Sparkles, Check, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchRoster, formatClassLabel } from '../../lib/rosterApi';
import { Room, ClassRosterStudent } from '../../types';
import {
  parseHomework,
  WUTAI_PRESETS,
  LIGU_PRESETS,
  fetchActiveHomeworkMap,
  FixedRoomPreset,
} from '../../lib/homeworkApi';
import { useI18n } from '../../context/I18nContext';

interface StudentJoinProps {
  initialRoomId?: string;
  onJoined: (studentInfo: {
    roomId: string;
    studentId: string;
    studentName: string;
    seatNum: number;
    isHomework?: boolean;
  }) => void;
}

export const StudentJoin: React.FC<StudentJoinProps> = ({ initialRoomId = '', onJoined }) => {
  const [entryMode, setEntryMode] = useState<'wutai' | 'ligu' | 'manual'>(
    initialRoomId ? 'manual' : 'wutai'
  );
  const [roomId, setRoomId] = useState(initialRoomId.toUpperCase());
  const [room, setRoom] = useState<Room | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [rosterByClass, setRosterByClass] = useState<Record<string, ClassRosterStudent[]>>({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('1');
  const [nickname, setNickname] = useState('');

  // Active Homework Map across all 12 classes: { WT0601: { title, count }, ... }
  const [activeHwMap, setActiveHwMap] = useState<Record<string, { title: string; count: number }>>({});
  const [selectedPresetCode, setSelectedPresetCode] = useState<string>('');

  // Remembered student identity from localStorage
  const [lastStudent, setLastStudent] = useState<{
    code: string;
    classLabel: string;
    seatNum: string;
    studentName: string;
    studentId: string;
  } | null>(null);

  const { t } = useI18n();

  // Load active homework status & remembered student on mount
  useEffect(() => {
    fetchActiveHomeworkMap().then((map) => setActiveHwMap(map));

    try {
      const raw = localStorage.getItem('classqna_last_student');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.code && parsed?.studentName) {
          setLastStudent(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load remembered student:', e);
    }
  }, []);

  // When a preset class is clicked
  const handleSelectPresetClass = async (preset: FixedRoomPreset) => {
    setSelectedPresetCode(preset.code);
    setRoomId(preset.code);
    setSelectedClass(preset.classKey);
  };

  // Fetch room details whenever roomId changes
  useEffect(() => {
    async function checkRoom() {
      if (!roomId.trim()) {
        setRoom(null);
        return;
      }
      setLoadingRoom(true);
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId.trim().toUpperCase())
          .single();

        if (!error && data) {
          setRoom(data as Room);
          // Load roster if room uses selected classes
          if (!data.custom_class_enabled && data.selected_classes?.length > 0) {
            const { rosterByClass: roster } = await fetchRoster();
            setRosterByClass(roster);
            // Default selected class to room's first class if not set
            if (!selectedClass || !data.selected_classes.includes(selectedClass)) {
              setSelectedClass(data.selected_classes[0]);
            }
          }
        }
      } catch (err) {
        console.warn('Room check error:', err);
      } finally {
        setLoadingRoom(false);
      }
    }
    checkRoom();
  }, [roomId]);

  // Handle submit join
  const handleJoin = async (overrideRoomId?: string, overrideSeat?: string) => {
    const cleanRoomId = (overrideRoomId || roomId).trim().toUpperCase();
    if (!cleanRoomId) {
      alert(t('student.enterCode'));
      return;
    }

    let targetRoom = room;
    if (!targetRoom || targetRoom.id !== cleanRoomId) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', cleanRoomId)
        .single();
      if (error || !data) {
        alert('找不到此教室，請確認代碼是否正確！ / Classroom not found');
        return;
      }
      targetRoom = data as Room;
    }

    const isHomework = Boolean(
      targetRoom.status?.startsWith('homework_') || parseHomework(targetRoom.question_note)
    );

    // If homework is still in prep mode, block students from entering
    if (targetRoom.status === 'homework_prep') {
      alert(t('homework.studentPrepAlert'));
      return;
    }

    const seatToUse = overrideSeat || selectedSeat;
    let studentId = '';
    let studentName = '';
    let seatNum = parseInt(seatToUse, 10) || 1;

    if (targetRoom.custom_class_enabled || !selectedClass) {
      studentId = `temp_${seatNum}`;
      studentName = nickname.trim() || `${seatNum}號同學`;
    } else {
      const classList = rosterByClass[selectedClass] || [];
      const matched = classList.find((s) => s.number === seatToUse);
      studentId = matched ? `${matched.grade}-${matched.class}-${matched.number}` : `temp_${seatNum}`;
      studentName = matched?.name || nickname.trim() || `${seatNum}號`;
    }

    // Remember student identity in localStorage for effortless return
    try {
      localStorage.setItem(
        'classqna_last_student',
        JSON.stringify({
          code: cleanRoomId,
          classLabel: formatClassLabel(selectedClass || '1-1', true),
          seatNum: seatToUse,
          studentName,
          studentId,
        })
      );
    } catch {
      // ignore
    }

    // Only register presence in room_students if NOT homework mode (to keep homework 100% REST)
    if (!isHomework) {
      await supabase.from('room_students').upsert({
        room_id: cleanRoomId,
        student_id: studentId,
        student_name: studentName,
        is_online: true,
        last_seen: new Date().toISOString(),
      });
    }

    onJoined({
      roomId: cleanRoomId,
      studentId,
      studentName,
      seatNum,
      isHomework,
    });
  };

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-6 sm:py-12 space-y-4">
      {/* Returning Student Quick Login Banner */}
      {lastStudent && (
        <div className="p-4 rounded-3xl glass-panel border border-white/60 dark:border-slate-700 shadow-soft flex items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-400 block">
              👋 歡迎回來
            </span>
            <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
              <span className="text-theme font-black">{lastStudent.classLabel}</span>{' '}
              {lastStudent.seatNum} 號 {lastStudent.studentName}
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('classqna_last_student');
                } catch {}
                setLastStudent(null);
              }}
              className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800"
              title="切換其他同學或清除記住的身分"
            >
              不是我
            </button>
            <button
              type="button"
              onClick={() => handleJoin(lastStudent.code, lastStudent.seatNum)}
              className="px-4 py-2 rounded-xl btn-theme-primary font-bold text-xs shadow-xs active:scale-95 transition flex items-center space-x-1.5"
            >
              <span>一鍵進入</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Join Card */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 shadow-soft border border-white/60 dark:border-slate-700 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl badge-theme flex items-center justify-center mx-auto shadow-xs">
            <School className="w-6 h-6 text-theme" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {t('student.welcome')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            請選擇您的班級與姓名座號以進入作答
          </p>
        </div>

        {/* Campus Tabs */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setEntryMode('wutai');
              handleSelectPresetClass(WUTAI_PRESETS[5]); // default 六甲
            }}
            className={`flex-1 py-2 rounded-xl font-bold text-xs transition ${
              entryMode === 'wutai'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            霧臺校區 (甲班)
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('ligu');
              handleSelectPresetClass(LIGU_PRESETS[4]); // default 五乙
            }}
            className={`flex-1 py-2 rounded-xl font-bold text-xs transition ${
              entryMode === 'ligu'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            勵古校區 (乙班)
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('manual');
              setSelectedPresetCode('');
            }}
            className={`flex-1 py-2 rounded-xl font-bold text-xs transition ${
              entryMode === 'manual'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            輸入代碼
          </button>
        </div>

        {/* Preset Class Grid for Wutai / Ligu */}
        {entryMode === 'wutai' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block px-1">
              點擊您的班級 (亮綠標者代表有進行中的回家作業)：
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {WUTAI_PRESETS.map((p) => {
                const isSelected = selectedPresetCode === p.code || roomId === p.code;
                const activeHw = activeHwMap[p.code];
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => handleSelectPresetClass(p)}
                    className={`relative p-2.5 rounded-2xl border text-center transition ${
                      isSelected
                        ? 'badge-theme border-current shadow-xs font-black scale-105'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-xs font-black">{p.shortLabel}</span>
                    {activeHw ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse">
                        有作業
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">無作業</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {entryMode === 'ligu' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block px-1">
              點擊您的班級 (亮綠標者代表有進行中的回家作業)：
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {LIGU_PRESETS.map((p) => {
                const isSelected = selectedPresetCode === p.code || roomId === p.code;
                const activeHw = activeHwMap[p.code];
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => handleSelectPresetClass(p)}
                    className={`relative p-2.5 rounded-2xl border text-center transition ${
                      isSelected
                        ? 'badge-theme border-current shadow-xs font-black scale-105'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-xs font-black">{p.shortLabel}</span>
                    {activeHw ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse">
                        有作業
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">無作業</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Manual Code Input */}
        {entryMode === 'manual' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('student.enterCode')} (課堂代碼或科任代碼)
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder={t('student.codePlaceholder')}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-mono font-extrabold text-center tracking-widest text-lg transition"
            />
          </div>
        )}

        {/* Active Homework Announcement Banner if room has active homework */}
        {activeHwMap[roomId] && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-bold">
            <BookOpen className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span>進行中作業：</span>
              <span className="underline decoration-emerald-500 underline-offset-2 ml-1">
                {activeHwMap[roomId].title} (共 {activeHwMap[roomId].count} 題)
              </span>
            </div>
          </div>
        )}

        {/* Room Student Identity Selector */}
        {room && (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-800 dark:text-slate-200 font-bold">
                🏫 {room.teacher_name} 的{room.status.startsWith('homework_') ? '回家作業' : '課堂'}
              </span>
              <span className="text-theme font-semibold">
                {room.status.startsWith('homework_')
                  ? room.status === 'homework_prep'
                    ? '老師備課中'
                    : '開放作答中'
                  : '即時連線'}
              </span>
            </div>

            {/* Roster Mode: Pick Class & Seat/Name */}
            {!room.custom_class_enabled && room.selected_classes?.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  點選您的座號與姓名：
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {room.selected_classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {formatClassLabel(cls, true)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedSeat}
                    onChange={(e) => setSelectedSeat(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {(rosterByClass[selectedClass] || []).map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number} 號 - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Custom Mode: Pick seat or type nickname */
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    {t('student.seatLabel')}
                  </label>
                  <select
                    value={selectedSeat}
                    onChange={(e) => setSelectedSeat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {Array.from({ length: room.custom_student_count || 20 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {i + 1} 號
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    {t('student.nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="選填姓名"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Join Action Button */}
        <button
          onClick={() => handleJoin()}
          disabled={loadingRoom}
          className="w-full py-4 rounded-2xl btn-theme-primary active:scale-[0.99] font-bold text-base transition flex items-center justify-center space-x-2"
        >
          {loadingRoom ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>{t('student.joinClassBtn')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
