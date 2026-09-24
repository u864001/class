import React, { useState, useEffect } from 'react';
import { LogIn, School, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchRoster, formatClassLabel } from '../../lib/rosterApi';
import { Room, ClassRosterStudent } from '../../types';
import { parseHomework } from '../../lib/homeworkApi';
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
  const [roomId, setRoomId] = useState(initialRoomId.toUpperCase());
  const [room, setRoom] = useState<Room | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [rosterByClass, setRosterByClass] = useState<Record<string, ClassRosterStudent[]>>({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('1');
  const [nickname, setNickname] = useState('');

  const { t } = useI18n();

  // 1. If roomId present, fetch room details
  useEffect(() => {
    async function checkRoom() {
      if (!roomId.trim()) return;
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
            setSelectedClass(data.selected_classes[0]);
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
  const handleJoin = async () => {
    const cleanRoomId = roomId.trim().toUpperCase();
    if (!cleanRoomId) {
      alert(t('student.enterCode'));
      return;
    }

    let targetRoom = room;
    if (!targetRoom) {
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

    let studentId = '';
    let studentName = '';
    let seatNum = parseInt(selectedSeat, 10) || 1;

    if (targetRoom.custom_class_enabled || !selectedClass) {
      studentId = `temp_${seatNum}`;
      studentName = nickname.trim() || `${seatNum}號同學`;
    } else {
      const classList = rosterByClass[selectedClass] || [];
      const matched = classList.find((s) => s.number === selectedSeat);
      studentId = matched ? `${matched.grade}-${matched.class}-${matched.number}` : `temp_${seatNum}`;
      studentName = matched?.name || nickname.trim() || `${seatNum}號`;
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
    <div className="max-w-md mx-auto px-4 py-8 sm:py-16">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-soft border border-white/60 dark:border-slate-700 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl badge-theme flex items-center justify-center mx-auto shadow-xs">
            <School className="w-7 h-7 text-theme" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {t('student.welcome')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('student.rosterSelect')}
          </p>
        </div>

        {/* Room Code Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('student.enterCode')} (Room Code)
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder={t('student.codePlaceholder')}
              className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-mono font-extrabold text-center tracking-widest text-lg transition"
            />
          </div>

          {/* If room loaded */}
          {room && (
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 dark:text-slate-200 font-bold">
                  🏫 {room.teacher_name} 的{room.status.startsWith('homework_') ? '回家作業' : '教室'}
                </span>
                <span className="text-theme font-semibold">
                  {room.status.startsWith('homework_')
                    ? room.status === 'homework_prep'
                      ? '老師備課中'
                      : '開放作答中'
                    : room.custom_class_enabled
                    ? '自訂座號模式'
                    : '固定名單模式'}
                </span>
              </div>

              {/* Roster Mode */}
              {!room.custom_class_enabled && room.selected_classes?.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    選擇班級與座號：
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                    >
                      {room.selected_classes.map((cls) => (
                        <option key={cls} value={cls}>
                          {formatClassLabel(cls)}
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
                /* Custom Mode */
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

          {/* Join Button */}
          <button
            onClick={handleJoin}
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
    </div>
  );
};
