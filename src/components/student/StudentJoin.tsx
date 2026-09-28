import React, { useState, useEffect } from 'react';
import { LogIn, School, Loader2, BookOpen, Sparkles, Check, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchRoster, formatClassLabel } from '../../lib/rosterApi';
import { Room, ClassRosterStudent } from '../../types';
import {
  parseHomework,
  WUTAI_PRESETS,
  LIGU_PRESETS,
  FIXED_ROOM_PRESETS,
  fetchActiveHomeworkSummary,
  ActiveHomeworkSummary,
  ActiveHomeworkItem,
  FixedRoomPreset,
  parseRoomCode,
} from '../../lib/homeworkApi';
import { useI18n } from '../../context/I18nContext';
import { maskStudentName, generateIndigenousNickname } from '../../lib/nicknameGenerator';

interface StudentJoinProps {
  initialRoomId?: string;
  onTeacherLoginClick?: () => void;
  onJoined: (studentInfo: {
    roomId: string;
    studentId: string;
    studentName: string;
    seatNum: number;
    isHomework?: boolean;
  }) => void;
}

export const StudentJoin: React.FC<StudentJoinProps> = ({
  initialRoomId = '',
  onTeacherLoginClick,
  onJoined,
}) => {
  const [entryMode, setEntryMode] = useState<'wutai' | 'ligu' | 'custom' | 'manual'>(
    initialRoomId ? 'manual' : 'wutai'
  );
  const [roomId, setRoomId] = useState(initialRoomId.toUpperCase());
  const [room, setRoom] = useState<Room | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [rosterByClass, setRosterByClass] = useState<Record<string, ClassRosterStudent[]>>({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('1');
  const [nickname, setNickname] = useState(() => generateIndigenousNickname());

  // Active Homework Summary across all classes, subjects & custom rooms
  const [activeSummary, setActiveSummary] = useState<ActiveHomeworkSummary>({
    byClass: {},
    byRoomId: {},
    customRooms: [],
  });
  const [activeHwMap, setActiveHwMap] = useState<Record<string, { title: string; count: number }>>({});
  const [selectedPresetCode, setSelectedPresetCode] = useState<string>('WT0601');

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
    fetchActiveHomeworkSummary().then((summary) => {
      setActiveSummary(summary);
      const map: Record<string, { title: string; count: number }> = {};
      Object.values(summary.byRoomId).forEach((it) => {
        map[it.roomId] = { title: it.title, count: it.count };
      });
      Object.entries(summary.byClass).forEach(([baseCode, items]) => {
        if (items.length > 0) {
          const names = items.map((i) => i.subjectName).join('、');
          map[baseCode] = {
            title: `${names}等 ${items.length} 份作業`,
            count: items.reduce((acc, it) => acc + it.count, 0),
          };
        }
      });
      setActiveHwMap(map);

      // Auto-focus class with active homework if initialRoomId is not provided
      if (!initialRoomId) {
        const firstActivePreset = FIXED_ROOM_PRESETS.find(
          (p) => summary.byClass[p.code]?.length > 0
        );
        if (firstActivePreset) {
          if (firstActivePreset.campus === 'wutai') {
            setEntryMode('wutai');
          } else if (firstActivePreset.campus === 'ligu') {
            setEntryMode('ligu');
          }
          setSelectedPresetCode(firstActivePreset.code);
          setSelectedClass(firstActivePreset.classKey);
          const firstSub = summary.byClass[firstActivePreset.code][0];
          setRoomId(firstSub.roomId);
        } else if (!roomId) {
          setSelectedPresetCode('WT0601');
          setSelectedClass('6-1');
          setRoomId('WT0601CH');
        }
      }
    });

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
  }, [initialRoomId]);

  // When a preset class is clicked
  const handleSelectPresetClass = (preset: FixedRoomPreset) => {
    setSelectedPresetCode(preset.code);
    setSelectedClass(preset.classKey);

    const activeSubs = activeSummary.byClass[preset.code] || [];
    if (activeSubs.length > 0) {
      // Pick first active subject
      setRoomId(activeSubs[0].roomId);
    } else {
      // Default to CH (Chinese)
      setRoomId(`${preset.code}CH`);
    }
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

  const currentSelectedPreset = FIXED_ROOM_PRESETS.find((p) => p.code === selectedPresetCode);
  const currentParsedRoom = parseRoomCode(roomId);

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
        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setEntryMode('wutai');
              handleSelectPresetClass(WUTAI_PRESETS[5]); // default 六甲
            }}
            className={`flex-1 py-2 rounded-xl transition ${
              entryMode === 'wutai'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            霧臺 (甲班)
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('ligu');
              handleSelectPresetClass(LIGU_PRESETS[4]); // default 五乙
            }}
            className={`flex-1 py-2 rounded-xl transition ${
              entryMode === 'ligu'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            勵古 (乙班)
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('custom');
              setSelectedPresetCode('');
              if (activeSummary.customRooms.length > 0) {
                setRoomId(activeSummary.customRooms[0].roomId);
              }
            }}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center space-x-1 ${
              entryMode === 'custom'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>社團/跨班</span>
            {activeSummary.customRooms.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('manual');
              setSelectedPresetCode('');
            }}
            className={`flex-1 py-2 rounded-xl transition ${
              entryMode === 'manual'
                ? 'bg-white dark:bg-slate-700 text-theme shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            輸入代碼
          </button>
        </div>

        {/* Preset Class Grid for Wutai */}
        {entryMode === 'wutai' && (
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 block px-1">
              點擊您的班級 (綠標為有作業，點選後於下方挑選科目)：
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {WUTAI_PRESETS.map((p) => {
                const isSelected = selectedPresetCode === p.code;
                const classHws = activeSummary.byClass[p.code] || [];
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => handleSelectPresetClass(p)}
                    className={`relative p-2 rounded-2xl border text-center transition ${
                      isSelected
                        ? 'badge-theme border-current shadow-xs font-black scale-105'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-xs font-black">{p.shortLabel}</span>
                    {classHws.length > 0 ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse">
                        {classHws.length}科作業
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">無作業</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subject Selector Drawer for Selected Class */}
            {selectedPresetCode && (
              <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                      📚 {currentSelectedPreset?.shortLabel} 作業科目：
                    </span>
                    {activeSummary.byClass[selectedPresetCode]?.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold animate-pulse">
                        {activeSummary.byClass[selectedPresetCode].length} 科開放作答
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">點選科目進入</span>
                </div>

                {activeSummary.byClass[selectedPresetCode]?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeSummary.byClass[selectedPresetCode].map((item) => {
                      const isRoomSelected = roomId === item.roomId;
                      return (
                        <button
                          key={item.roomId}
                          type="button"
                          onClick={() => setRoomId(item.roomId)}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            isRoomSelected
                              ? 'bg-white dark:bg-slate-800 border-indigo-600 shadow-sm ring-2 ring-indigo-500'
                              : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-xl flex-shrink-0">{item.subjectIcon}</span>
                            <div className="truncate">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                  {item.subjectName}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {item.roomId}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {item.title}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex-shrink-0 ml-1.5 border border-emerald-200 dark:border-emerald-800">
                            {item.count} 題
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-2.5 px-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-400 text-center">
                    目前 {currentSelectedPreset?.shortLabel} 尚無進行中的回家作業
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preset Class Grid for Ligu */}
        {entryMode === 'ligu' && (
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 block px-1">
              點擊您的班級 (綠標為有作業，點選後於下方挑選科目)：
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {LIGU_PRESETS.map((p) => {
                const isSelected = selectedPresetCode === p.code;
                const classHws = activeSummary.byClass[p.code] || [];
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => handleSelectPresetClass(p)}
                    className={`relative p-2 rounded-2xl border text-center transition ${
                      isSelected
                        ? 'badge-theme border-current shadow-xs font-black scale-105'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-xs font-black">{p.shortLabel}</span>
                    {classHws.length > 0 ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse">
                        {classHws.length}科作業
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">無作業</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subject Selector Drawer for Selected Class */}
            {selectedPresetCode && (
              <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                      📚 {currentSelectedPreset?.shortLabel} 作業科目：
                    </span>
                    {activeSummary.byClass[selectedPresetCode]?.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold animate-pulse">
                        {activeSummary.byClass[selectedPresetCode].length} 科開放作答
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">點選科目進入</span>
                </div>

                {activeSummary.byClass[selectedPresetCode]?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeSummary.byClass[selectedPresetCode].map((item) => {
                      const isRoomSelected = roomId === item.roomId;
                      return (
                        <button
                          key={item.roomId}
                          type="button"
                          onClick={() => setRoomId(item.roomId)}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            isRoomSelected
                              ? 'bg-white dark:bg-slate-800 border-indigo-600 shadow-sm ring-2 ring-indigo-500'
                              : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-xl flex-shrink-0">{item.subjectIcon}</span>
                            <div className="truncate">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                  {item.subjectName}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {item.roomId}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {item.title}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex-shrink-0 ml-1.5 border border-emerald-200 dark:border-emerald-800">
                            {item.count} 題
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-2.5 px-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-400 text-center">
                    目前 {currentSelectedPreset?.shortLabel} 尚無進行中的回家作業
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom / Mixed-Grade Clubs Section */}
        {entryMode === 'custom' && (
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 block px-1">
              進行中的社團或跨班/課後班作業：
            </span>
            {activeSummary.customRooms.length > 0 ? (
              <div className="space-y-2">
                {activeSummary.customRooms.map((cr) => {
                  const isSelected = roomId === cr.roomId;
                  return (
                    <button
                      key={cr.roomId}
                      type="button"
                      onClick={() => setRoomId(cr.roomId)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-white dark:bg-slate-800 border-indigo-600 shadow-sm ring-2 ring-indigo-500'
                          : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{cr.subjectIcon}</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-black text-xs text-theme bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                              {cr.roomId}
                            </span>
                            <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                              {cr.teacherName ? `${cr.teacherName}` : '任課老師'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
                            {cr.title}
                          </h4>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        {cr.count} 題
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="text-xs text-slate-500 font-bold">目前尚無進行中的社團或跨班作業</p>
                <p className="text-[11px] text-slate-400">若有任課老師提供專屬代碼，請點擊上方「輸入代碼」直接進入</p>
              </div>
            )}
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
                🏫 {currentParsedRoom.isFixed ? currentParsedRoom.displayLabel : `${room.teacher_name} 的課堂/作業 (${roomId})`}
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
                <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between">
                  <span>點選您的座號與姓名：</span>
                  {room.selected_classes.length > 1 && (
                    <span className="text-[10px] text-theme font-bold bg-theme/10 px-2 py-0.5 rounded-md">
                      跨班 / 混齡名單 ({room.selected_classes.length} 班)
                    </span>
                  )}
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
                        {s.number} 號 - {maskStudentName(s.name)}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {t('student.nameLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setNickname(generateIndigenousNickname())}
                      className="text-[11px] font-bold text-theme hover:underline flex items-center space-x-0.5 active:scale-95 transition"
                      title="隨機換一個原鄉山林動物暱稱"
                    >
                      <span>🎲 換山林暱稱</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="可自訂姓名或使用山林暱稱"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
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

        {/* Subtle Teacher Entrance for Unverified Devices */}
        {onTeacherLoginClick && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onTeacherLoginClick}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition underline decoration-dotted"
            >
              我是授課教師？登入教師主控台
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
