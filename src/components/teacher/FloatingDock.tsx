import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Megaphone,
  Lock,
  Unlock,
  Timer,
  Dices,
  UserCheck,
  Vote,
  Users2,
  Bell,
  X,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  MonitorUp,
  Camera,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  RefreshCw,
  Layers,
  Crown,
  GripHorizontal,
  Minimize2,
  Maximize2,
  History,
  Trophy,
  Flame,
} from 'lucide-react';
import { Room, RoomStudent, BuzzEntry } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureScreenSlide } from '../../lib/imageCompressor';
import {
  parseBroadcastDeck,
  serializeBroadcastDeck,
  deleteRoomSlideDeck,
  BroadcastDeckState,
} from '../../lib/broadcastDeck';
import { LiveJoinLobbyModal } from './LiveJoinLobbyModal';

// Web Audio API 音效產生器（免依賴外部音檔，跨平台穩定發聲）
const playSound = (type: 'dice' | 'tick' | 'ding' | 'winner' | 'buzz_go') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (type === 'dice') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'buzz_go') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'winner' || type === 'ding') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    }
  } catch (e) {
    // 忽略自動播放限制
  }
};

// 擬真 3D 點數骰子元件
const renderDiceFace = (num: number, size: 'large' | 'small' = 'large') => {
  const isLarge = size === 'large';
  const containerClass = isLarge
    ? 'w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-200 border-4 border-slate-300 shadow-2xl p-3 sm:p-4 grid grid-cols-3 grid-rows-3 select-none mx-auto'
    : 'w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-2xs p-0.5 grid grid-cols-3 grid-rows-3 select-none';

  const dotClass = isLarge
    ? 'rounded-full place-self-center shadow-inner'
    : 'rounded-full place-self-center';

  const dotMap: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const activeDots = dotMap[num] || dotMap[1];

  return (
    <div className={containerClass}>
      {Array.from({ length: 9 }).map((_, idx) => {
        const isActive = activeDots.includes(idx);
        if (!isActive) return <div key={idx} />;
        const isOne = num === 1 && idx === 4;
        const color = isOne
          ? isLarge ? 'bg-rose-500 w-8 h-8' : 'bg-rose-500 w-2 h-2'
          : isLarge ? 'bg-slate-800 w-5 h-5' : 'bg-slate-800 w-1.5 h-1.5';
        return <div key={idx} className={`${dotClass} ${color}`} />;
      })}
    </div>
  );
};

interface FloatingDockProps {
  room: Room;
  onUpdateRoom: (updates: Partial<Room>) => Promise<void>;
  students?: RoomStudent[];
  onKickStudent?: (studentId: string, studentName?: string) => Promise<void>;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  room,
  onUpdateRoom,
  students,
  onKickStudent,
}) => {
  const [activeTool, setActiveTool] = useState<
    'qr' | 'broadcast' | 'timer' | 'dice' | 'picker' | 'vote' | 'group' | 'buzz' | 'screenshare' | null
  >(null);
  const [snappingScreen, setSnappingScreen] = useState(false);
  const [isCleaningDeck, setIsCleaningDeck] = useState(false);

  // Timer tool local state
  const [timerVal, setTimerVal] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Dice state (大尺寸 + 歷史投擲紀錄)
  const [diceNum, setDiceNum] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [diceHistory, setDiceHistory] = useState<number[]>([]);

  // Picker state (線上母池 + 重複/排除模式 + 大字全名)
  const [pickedStudent, setPickedStudent] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'repeat' | 'exclude'>('repeat');
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  // Buzzer state (大螢幕呼吸燈倒數 + 即時龍虎榜)
  const [buzzSecs, setBuzzSecs] = useState(5);
  const [buzzerPhase, setBuzzerPhase] = useState<'idle' | 'counting' | 'active' | 'finished'>('idle');
  const [countdownRemaining, setCountdownRemaining] = useState(5);
  const [buzzList, setBuzzList] = useState<BuzzEntry[]>([]);

  // Group Scoring state (橫向組別 + 皇冠領先 + 縮小可拖曳懸浮窗)
  const [groupMinimized, setGroupMinimized] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 20, y: 100 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Poll local state
  const [pollOptions, setPollOptions] = useState<string[]>(['選項 A', '選項 B']);
  const [newOption, setNewOption] = useState('');

  // Broadcast local state
  const [broadcastInput, setBroadcastInput] = useState(room.broadcast_text || '');

  // Parse current slide deck state
  const deck = parseBroadcastDeck(room.broadcast_image_url);

  // --- Actions ---
  const toggleLockScreen = async () => {
    await onUpdateRoom({ screen_locked: !room.screen_locked });
  };

  const handleBroadcast = async () => {
    await onUpdateRoom({ broadcast_text: broadcastInput.trim() });
    setActiveTool(null);
  };

  // --- Slide Deck Actions ---
  const handleCaptureNewSlide = async () => {
    const currentSlides = deck?.slides || [];
    if (currentSlides.length >= 25) {
      alert('單次課堂最多支援 25 頁快照講義，以維護學生連線品質與免費額度。');
      return;
    }
    setSnappingScreen(true);
    try {
      const nextIndex = currentSlides.length;
      const url = await captureScreenSlide(room.id, nextIndex);
      const nextState: BroadcastDeckState = {
        version: 2,
        slides: [...currentSlides, url],
        currentIndex: nextIndex,
        mode: deck?.mode || 'sync',
        updatedAt: Date.now(),
      };
      await onUpdateRoom({ broadcast_image_url: serializeBroadcastDeck(nextState) });
      setActiveTool('screenshare');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error('Screen capture failed:', err);
        alert('螢幕快照擷取失敗：' + (err.message || '請確認瀏覽器分享權限'));
      }
    } finally {
      setSnappingScreen(false);
    }
  };

  const handleRecaptureCurrentSlide = async () => {
    if (!deck || deck.slides.length === 0) return;
    setSnappingScreen(true);
    try {
      const currentIdx = deck.currentIndex;
      const url = await captureScreenSlide(room.id, currentIdx);
      const nextSlides = [...deck.slides];
      nextSlides[currentIdx] = url;
      const nextState: BroadcastDeckState = {
        ...deck,
        slides: nextSlides,
        updatedAt: Date.now(),
      };
      await onUpdateRoom({ broadcast_image_url: serializeBroadcastDeck(nextState) });
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error('Screen recapture failed:', err);
        alert('重拍螢幕快照失敗：' + (err.message || '請確認權限'));
      }
    } finally {
      setSnappingScreen(false);
    }
  };

  const handlePrevSlide = async () => {
    if (!deck || deck.currentIndex <= 0) return;
    const nextState: BroadcastDeckState = {
      ...deck,
      currentIndex: deck.currentIndex - 1,
      updatedAt: Date.now(),
    };
    await onUpdateRoom({ broadcast_image_url: serializeBroadcastDeck(nextState) });
  };

  const handleNextSlide = async () => {
    if (!deck || deck.currentIndex >= deck.slides.length - 1) return;
    const nextState: BroadcastDeckState = {
      ...deck,
      currentIndex: deck.currentIndex + 1,
      updatedAt: Date.now(),
    };
    await onUpdateRoom({ broadcast_image_url: serializeBroadcastDeck(nextState) });
  };

  const handleSelectSlide = async (targetIndex: number) => {
    if (!deck || targetIndex < 0 || targetIndex >= deck.slides.length) return;
    if (targetIndex === deck.currentIndex) return;
    const nextState: BroadcastDeckState = {
      ...deck,
      currentIndex: targetIndex,
      updatedAt: Date.now(),
    };
    await onUpdateRoom({ broadcast_image_url: serializeBroadcastDeck(nextState) });
  };

  const handleToggleMode = async () => {
    if (!deck) return;
    const nextMode = deck.mode === 'sync' ? 'free' : 'sync';
    const nextState: BroadcastDeckState = {
      ...deck,
      mode: nextMode,
      updatedAt: Date.now(),
    };
    await onUpdateRoom({ broadcast_image_url: serializeBroadcastDeck(nextState) });
  };

  const handleEndAndCleanup = async () => {
    if (
      !window.confirm(
        '確定結束螢幕廣播並銷毀全部講義快照？\n這將立即清空雲端儲存空間（容量歸零），學生機也將同步關閉講義視窗。'
      )
    ) {
      return;
    }
    setIsCleaningDeck(true);
    try {
      await deleteRoomSlideDeck(room.id, deck?.slides);
      await onUpdateRoom({ broadcast_image_url: '' });
      setActiveTool(null);
    } catch (err) {
      console.error('Error cleaning slides:', err);
      await onUpdateRoom({ broadcast_image_url: '' });
      setActiveTool(null);
    } finally {
      setIsCleaningDeck(false);
    }
  };


  // --- 1. 課堂擲骰子（大顆 3D 擬真點數 + 滾動音效 + 歷史紀錄） ---
  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setDiceNum(Math.floor(Math.random() * 6) + 1);
      playSound('dice');
      count++;
      if (count > 10) {
        clearInterval(interval);
        const finalVal = Math.floor(Math.random() * 6) + 1;
        setDiceNum(finalVal);
        setRolling(false);
        setDiceHistory((prev) => [finalVal, ...prev].slice(0, 10));
        playSound('ding');
      }
    }, 70);
  };

  // --- 2. 隨機點名（目前已在線學生母池 + 排除/放回模式 + 大字全名） ---
  const onlineCandidates = useMemo(() => {
    const online = (students || []).filter((s) => s.is_online !== false);
    if (online.length > 0) {
      return online.map((s) => ({
        id: s.student_id,
        name: s.student_name,
      }));
    }
    const total = room.custom_class_enabled ? room.custom_student_count || 20 : 30;
    return Array.from({ length: total }, (_, i) => ({
      id: `temp_${i + 1}`,
      name: `${i + 1} 號同學`,
    }));
  }, [students, room.custom_class_enabled, room.custom_student_count]);

  const availableCandidates = useMemo(() => {
    if (pickerMode === 'repeat') return onlineCandidates;
    return onlineCandidates.filter((s) => !excludedStudentIds.includes(s.id));
  }, [onlineCandidates, pickerMode, excludedStudentIds]);

  const pickRandomStudent = () => {
    if (isPicking || availableCandidates.length === 0) return;
    setIsPicking(true);
    let count = 0;
    const interval = setInterval(() => {
      const rand = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
      setPickedStudent(rand.name);
      playSound('tick');
      count++;
      if (count > 14) {
        clearInterval(interval);
        const finalCandidate = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
        setPickedStudent(finalCandidate.name);
        if (pickerMode === 'exclude') {
          setExcludedStudentIds((prev) => [...prev, finalCandidate.id]);
        }
        setIsPicking(false);
        playSound('winner');
      }
    }, 60);
  };

  const resetExcludedStudents = () => {
    setExcludedStudentIds([]);
    setPickedStudent(null);
  };

  // --- 3. 搶答控制台（大螢幕呼吸燈倒數 + 即時龍虎榜） ---
  // 監聽學生送出的搶答紀錄
  useEffect(() => {
    if (!room?.id) return;
    const normalizedRoomId = room.id.toUpperCase();

    const channel = supabase
      .channel(`buzz_dock_${normalizedRoomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'buzzes', filter: `room_id=eq.${normalizedRoomId}` },
        (payload) => {
          const entry = payload.new as BuzzEntry;
          setBuzzList((prev) => {
            if (prev.some((b) => b.student_id === entry.student_id)) return prev;
            const updated = [...prev, entry].sort(
              (a, b) => new Date(a.buzz_time).getTime() - new Date(b.buzz_time).getTime()
            );
            if (prev.length === 0) {
              playSound('winner');
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // 開啟搶答工具時拉取已有搶答紀錄
  useEffect(() => {
    if (activeTool === 'buzz' && room?.id) {
      supabase
        .from('buzzes')
        .select('*')
        .eq('room_id', room.id.toUpperCase())
        .order('buzz_time', { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setBuzzList(data as BuzzEntry[]);
            if (!room.buzz_active) {
              setBuzzerPhase('finished');
            }
          }
        });
    }
  }, [activeTool, room?.id, room?.buzz_active]);

  // 搶答大螢幕呼吸燈倒數
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (buzzerPhase === 'counting' && countdownRemaining > 0) {
      timer = setTimeout(() => {
        setCountdownRemaining((prev) => {
          if (prev <= 1) {
            setBuzzerPhase('active');
            playSound('buzz_go');
            return 0;
          }
          playSound('tick');
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [buzzerPhase, countdownRemaining]);

  const startBuzzer = async () => {
    try {
      await supabase.from('buzzes').delete().eq('room_id', room.id.toUpperCase());
    } catch (e) {
      console.warn('Failed to clear buzzes:', e);
    }
    setBuzzList([]);
    setCountdownRemaining(buzzSecs);
    setBuzzerPhase('counting');
    playSound('tick');
    await onUpdateRoom({
      buzz_active: true,
      buzz_countdown: buzzSecs,
    });
  };

  const stopBuzzer = async () => {
    await onUpdateRoom({ buzz_active: false });
    setBuzzerPhase('finished');
  };

  // --- 4. 分組加扣分（橫向並排 + 皇冠領先 + 縮小可拖曳懸浮窗） ---
  const currentGroups = useMemo(() => {
    return room.groups && room.groups.length > 0
      ? room.groups
      : ['第 1 組', '第 2 組', '第 3 組', '第 4 組'];
  }, [room.groups]);

  const groupScores = room.group_scores || {};
  const maxGroupScore = useMemo(() => {
    const scores = Object.values(groupScores);
    if (scores.length === 0) return 0;
    return Math.max(0, ...scores);
  }, [groupScores]);

  const updateGroupScore = async (groupName: string, delta: number) => {
    const scores = { ...(room.group_scores || {}) };
    scores[groupName] = Math.max(0, (scores[groupName] || 0) + delta);
    await onUpdateRoom({ group_scores: scores });
  };

  const handleAddGroup = async () => {
    const nextGroupNum = currentGroups.length + 1;
    const newGroupName = `第 ${nextGroupNum} 組`;
    const nextGroups = [...currentGroups, newGroupName];
    const scores = { ...(room.group_scores || {}), [newGroupName]: 0 };
    await onUpdateRoom({ groups: nextGroups, group_scores: scores });
  };

  const handleDeleteGroup = async (targetGroup: string) => {
    if (currentGroups.length <= 1) {
      alert('至少需保留一個組別！');
      return;
    }
    if (!window.confirm(`確定要刪除「${targetGroup}」嗎？其分數紀錄將被清除。`)) return;
    const nextGroups = currentGroups.filter((g) => g !== targetGroup);
    const scores = { ...(room.group_scores || {}) };
    delete scores[targetGroup];
    await onUpdateRoom({ groups: nextGroups, group_scores: scores });
  };

  const handleResetGroupScores = async () => {
    if (!window.confirm('確定要將所有組別的分數重設為 0 分嗎？')) return;
    const scores = currentGroups.reduce((acc, g) => ({ ...acc, [g]: 0 }), {});
    await onUpdateRoom({ group_scores: scores });
  };

  // 縮小視窗之滑鼠與觸控拖曳監聽
  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: clientX - dragPos.x,
      y: clientY - dragPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const nextX = Math.max(10, Math.min(window.innerWidth - 300, e.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffsetRef.current.y));
      setDragPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length === 0) return;
      const touch = e.touches[0];
      const nextX = Math.max(10, Math.min(window.innerWidth - 300, touch.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(10, Math.min(window.innerHeight - 80, touch.clientY - dragOffsetRef.current.y));
      setDragPos({ x: nextX, y: nextY });
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const startPoll = async () => {
    await onUpdateRoom({
      vote_active: true,
      vote_options: pollOptions,
      vote_results: pollOptions.reduce((acc, opt) => ({ ...acc, [opt]: 0 }), {}),
    });
  };

  const stopPoll = async () => {
    await onUpdateRoom({ vote_active: false });
  };

  const studentJoinUrl = `${window.location.origin}?room=${room.id}`;

  return (
    <>
      {/* Floating Bottom Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="glass-panel px-3 py-2 rounded-2xl shadow-soft flex items-center space-x-1 sm:space-x-1.5 border border-white/80">
          <button
            onClick={() => setActiveTool('qr')}
            title="學生 QR Code"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <QrCode className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('broadcast')}
            title="跑馬燈文字廣播"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <Megaphone className="w-5 h-5" />
          </button>

          {/* 螢幕快照廣播按鈕 */}
          <button
            onClick={() => setActiveTool('screenshare')}
            title="一鍵廣播螢幕快照講義至學生 iPad"
            className={`p-2.5 rounded-xl relative transition ${
              deck && deck.slides.length > 0
                ? deck.mode === 'free'
                  ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
                  : 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                : 'hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600'
            }`}
          >
            <MonitorUp className="w-5 h-5" />
            {deck && deck.slides.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {deck.slides.length}
              </span>
            )}
          </button>

          <button
            onClick={toggleLockScreen}
            title={room.screen_locked ? '解鎖全班螢幕' : '鎖定全班螢幕'}
            className={`p-2.5 rounded-xl transition ${
              room.screen_locked
                ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-500/30'
                : 'hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600'
            }`}
          >
            {room.screen_locked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>

          <div className="w-[1px] h-6 bg-slate-200/80" />

          <button
            onClick={() => setActiveTool('timer')}
            title="課堂獨立計時器"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <Timer className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('dice')}
            title="骰子"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <Dices className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('picker')}
            title="隨機抽籤點名"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <UserCheck className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('vote')}
            title="即時投票"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <Vote className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('group')}
            title="分組計分"
            className="p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600 transition"
          >
            <Users2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('buzz')}
            title="搶答工具"
            className={`p-2.5 rounded-xl transition ${
              room.buzz_active
                ? 'bg-amber-100 text-amber-700 animate-pulse'
                : 'hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600'
            }`}
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Dialog for Active Tool */}
      {/* Kahoot!-style Live Join Lobby Modal */}
      <LiveJoinLobbyModal
        isOpen={activeTool === 'qr'}
        onClose={() => setActiveTool(null)}
        room={room}
        students={students || []}
        onKickStudent={onKickStudent}
      />

      {/* Modal Dialog for Other Active Tools */}
      {activeTool && activeTool !== 'qr' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`glass-panel ${
              activeTool === 'group'
                ? 'max-w-2xl sm:max-w-3xl'
                : activeTool === 'screenshare' || activeTool === 'buzz' || activeTool === 'picker'
                ? 'max-w-lg'
                : 'max-w-md'
            } w-full rounded-3xl p-6 shadow-soft relative border border-white/80 max-h-[90vh] overflow-y-auto`}
          >
            {/* Top Close / Minimize controls */}
            {activeTool === 'group' ? (
              <div className="absolute top-5 right-5 flex items-center space-x-2">
                <button
                  onClick={() => {
                    setGroupMinimized(true);
                    setActiveTool(null);
                  }}
                  title="縮小為浮動橫條"
                  className="p-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition flex items-center space-x-1 text-xs font-bold shadow-2xs"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">縮小</span>
                </button>
                <button
                  onClick={() => {
                    setGroupMinimized(false);
                    setActiveTool(null);
                  }}
                  title="關閉分組視窗"
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTool(null)}
                className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Broadcast Modal */}
            {activeTool === 'broadcast' && (
              <div className="space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg flex items-center space-x-2">
                  <Megaphone className="w-5 h-5 text-indigo-600" />
                  <span>發送跑馬燈廣播</span>
                </h3>
                <textarea
                  rows={3}
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  placeholder="請輸入欲廣播給全班學生頂部的跑馬燈訊息..."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 outline-none text-sm text-slate-800"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => { setBroadcastInput(''); onUpdateRoom({ broadcast_text: '' }); setActiveTool(null); }}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
                  >
                    清除廣播
                  </button>
                  <button
                    onClick={handleBroadcast}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs"
                  >
                    推播至學生端
                  </button>
                </div>
              </div>
            )}

            {/* Screen Share / Slide Deck Modal */}
            {activeTool === 'screenshare' && (
              <div className="space-y-4 pt-1 text-center">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-base sm:text-lg">
                    <MonitorUp className="w-5 h-5 text-indigo-600" />
                    <span>螢幕快照講義簿</span>
                  </div>
                  {deck && deck.slides.length > 0 && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        deck.mode === 'sync'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {deck.mode === 'sync' ? '🔒 全班同步' : '🔓 學生自翻'}
                    </span>
                  )}
                </div>

                {!deck || deck.slides.length === 0 ? (
                  <div className="py-4 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                      <MonitorUp className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">
                        大螢幕故障？直接將畫面推送到學生 iPad！
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        擷取教師當前的電子書、PPT 或教材畫面，支援多頁翻頁、學生自由溫習與下課一鍵清空。
                      </p>
                    </div>

                    <button
                      onClick={handleCaptureNewSlide}
                      disabled={snappingScreen}
                      className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
                    >
                      {snappingScreen ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在擷取螢幕畫面...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>開始擷取第 1 頁講義</span>
                        </>
                      )}
                    </button>

                    <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-left">
                      💡 採用超高壓縮比 WebP（每頁僅 ~40KB），且下課銷毀時自動清空，嚴守免費帳號配額。
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Slide Image Preview with current index overlay */}
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center min-h-[180px] max-h-56">
                      <img
                        src={deck.slides[deck.currentIndex]}
                        alt={`Slide ${deck.currentIndex + 1}`}
                        className="max-h-52 w-auto object-contain rounded-xl"
                      />
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-white text-xs font-bold flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        <span>
                          第 {deck.currentIndex + 1} / {deck.slides.length} 頁
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold">
                        全班推送中
                      </div>
                    </div>

                    {/* Slide Navigation Bar (上一頁 / 下一頁 / 頁碼點) */}
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
                      <button
                        onClick={handlePrevSlide}
                        disabled={deck.currentIndex === 0}
                        className="px-3 py-1.5 rounded-xl bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1 border border-slate-200 shadow-2xs"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>上一頁</span>
                      </button>

                      {/* Slide Thumbnail Dots / Pills */}
                      <div className="flex items-center space-x-1 overflow-x-auto max-w-[190px] py-0.5 px-1 scrollbar-none">
                        {deck.slides.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectSlide(idx)}
                            className={`w-6 h-6 rounded-lg text-[11px] font-bold transition flex items-center justify-center flex-shrink-0 ${
                              idx === deck.currentIndex
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleNextSlide}
                        disabled={deck.currentIndex >= deck.slides.length - 1}
                        className="px-3 py-1.5 rounded-xl bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1 border border-slate-200 shadow-2xs"
                      >
                        <span>下一頁</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Slide Manipulation: Add next slide OR Recapture this slide */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleCaptureNewSlide}
                        disabled={snappingScreen || deck.slides.length >= 25}
                        className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50"
                      >
                        {snappingScreen ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>擷取中...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>拍攝下一頁 ({deck.slides.length + 1})</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleRecaptureCurrentSlide}
                        disabled={snappingScreen}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                        title="以新快照覆寫目前這頁內容"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>重拍目前這頁</span>
                      </button>
                    </div>

                    {/* Mode Control Card: Free review vs Forced sync */}
                    {deck.mode === 'sync' ? (
                      <button
                        onClick={handleToggleMode}
                        className="w-full p-3 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 flex items-center justify-between text-left transition group"
                      >
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-xs flex items-center space-x-1.5 text-amber-800">
                            <Unlock className="w-3.5 h-3.5 text-amber-600" />
                            <span>暫停同步：開放學生自由翻頁</span>
                          </div>
                          <div className="text-[11px] text-amber-700/80">
                            學生端可自行在 iPad 上點選上一頁、下一頁自主溫習
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-500 group-hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-2xs whitespace-nowrap ml-2">
                          開放自翻
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={handleToggleMode}
                        className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-emerald-900 flex items-center justify-between text-left transition group ring-2 ring-emerald-400/40"
                      >
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-xs flex items-center space-x-1.5 text-emerald-800">
                            <Lock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>收回主控權：恢復全班強制同步</span>
                          </div>
                          <div className="text-[11px] text-emerald-700/80">
                            立即將所有學生畫面拉回老師目前這頁 (第 {deck.currentIndex + 1} 頁)
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-600 group-hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs whitespace-nowrap ml-2">
                          收回主控
                        </span>
                      </button>
                    )}

                    {/* End broadcast & purge storage */}
                    <button
                      onClick={handleEndAndCleanup}
                      disabled={isCleaningDeck}
                      className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                    >
                      {isCleaningDeck ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在釋放雲端儲存空間...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>結束廣播並清空全部講義 (釋放空間)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}


            {/* Timer Modal */}
            {activeTool === 'timer' && (
              <div className="text-center space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">課堂獨立計時器</h3>
                <div className="text-5xl font-mono font-black text-indigo-600 py-4">
                  {timerVal} <span className="text-lg text-slate-400 font-sans font-normal">秒</span>
                </div>
                <div className="flex justify-center space-x-2">
                  {[30, 60, 120, 300].map((s) => (
                    <button
                      key={s}
                      onClick={() => setTimerVal(s)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {s >= 60 ? `${s / 60}分` : `${s}秒`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1. 課堂擲骰子（大尺寸 3D 擬真點數 + 翻滾動畫 + 歷史投擲紀錄橫列） */}
            {activeTool === 'dice' && (
              <div className="text-center space-y-5 pt-2">
                <div className="flex items-center justify-center space-x-2">
                  <Dices className="w-6 h-6 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-800 text-xl">課堂擲骰子</h3>
                </div>

                {/* Big 3D Dice Display */}
                <div className="py-2">
                  <div
                    className={`transition-all duration-300 inline-block ${
                      rolling ? 'scale-110 rotate-12 animate-bounce' : 'scale-100'
                    }`}
                  >
                    {renderDiceFace(diceNum || 1, 'large')}
                  </div>
                  {diceNum ? (
                    <div className="text-xl font-mono font-black text-indigo-600 mt-3 flex items-center justify-center space-x-1">
                      <span>擲出</span>
                      <span className="text-3xl text-indigo-700 underline underline-offset-4">{diceNum}</span>
                      <span>點！</span>
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-slate-400 mt-3">請點擊下方按鈕擲骰子</div>
                  )}
                </div>

                <button
                  onClick={rollDice}
                  disabled={rolling}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-base shadow-glow-indigo transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Dices className={`w-5 h-5 ${rolling ? 'animate-spin' : ''}`} />
                  <span>{rolling ? '骰子翻滾中...' : '🎲 擲骰子！'}</span>
                </button>

                {/* History Row */}
                <div className="pt-2 border-t border-slate-100 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2 px-1">
                    <span className="flex items-center space-x-1.5">
                      <History className="w-3.5 h-3.5" />
                      <span>前 {diceHistory.length} 次投擲紀錄</span>
                    </span>
                    {diceHistory.length > 0 && (
                      <button
                        onClick={() => setDiceHistory([])}
                        className="text-[11px] text-slate-400 hover:text-rose-600 transition underline"
                      >
                        清空紀錄
                      </button>
                    )}
                  </div>
                  {diceHistory.length > 0 ? (
                    <div className="flex items-center space-x-2.5 overflow-x-auto py-1 px-1 scrollbar-thin">
                      {diceHistory.map((val, idx) => (
                        <div
                          key={idx}
                          className="flex-shrink-0 flex flex-col items-center p-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs"
                        >
                          {renderDiceFace(val, 'small')}
                          <span className="text-[10px] font-mono text-slate-600 mt-1 font-extrabold">{val}點</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-slate-300 text-xs font-semibold">尚無投擲紀錄</div>
                  )}
                </div>
              </div>
            )}

            {/* 2. 隨機抽籤點名（在線學生母池 + 排除模式 + 大字全名） */}
            {activeTool === 'picker' && (
              <div className="text-center space-y-5 pt-2">
                <div className="flex items-center justify-center space-x-2">
                  <UserCheck className="w-6 h-6 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-800 text-xl">隨機抽籤點名</h3>
                </div>

                {/* Mode Selector */}
                <div className="bg-slate-100 p-1 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-600 max-w-sm mx-auto">
                  <button
                    onClick={() => setPickerMode('repeat')}
                    className={`flex-1 py-1.5 px-3 rounded-xl transition ${
                      pickerMode === 'repeat'
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'hover:text-slate-800'
                    }`}
                  >
                    每輪重新隨機（放回）
                  </button>
                  <button
                    onClick={() => setPickerMode('exclude')}
                    className={`flex-1 py-1.5 px-3 rounded-xl transition ${
                      pickerMode === 'exclude'
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'hover:text-slate-800'
                    }`}
                  >
                    排除已選取模式（不放回）
                  </button>
                </div>

                {/* Candidate Pool Banner */}
                <div className="flex items-center justify-between text-xs bg-indigo-50/60 border border-indigo-100 rounded-xl px-3.5 py-2 text-indigo-900 font-semibold">
                  <span>
                    待選名單：<strong className="text-indigo-600">{availableCandidates.length}</strong> 人
                    {pickerMode === 'exclude' && (
                      <span className="text-slate-400 font-normal ml-1">
                        （已抽出 {excludedStudentIds.length} 人）
                      </span>
                    )}
                  </span>
                  {pickerMode === 'exclude' && excludedStudentIds.length > 0 && (
                    <button
                      onClick={resetExcludedStudents}
                      className="text-indigo-600 hover:text-indigo-800 underline font-bold flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>重新洗牌</span>
                    </button>
                  )}
                </div>

                {/* Big Full Name Display */}
                <div className="py-6 px-4 rounded-3xl bg-gradient-to-b from-indigo-50/40 to-slate-50 border border-slate-200 shadow-inner min-h-[140px] flex flex-col items-center justify-center">
                  {pickedStudent ? (
                    <div className="animate-in zoom-in-75 duration-200 text-center space-y-1">
                      <div className="flex items-center justify-center space-x-1.5 text-amber-500 text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        <span>幸運同學出爐</span>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-3xl sm:text-5xl font-black text-indigo-600 tracking-tight py-2 drop-shadow-xs">
                        {pickedStudent}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 font-bold text-sm">
                      {availableCandidates.length === 0
                        ? '🎉 全員皆已抽過一輪！請點擊「重新洗牌」開始下一輪。'
                        : '點擊下方按鈕，揭曉回答同學！'}
                    </div>
                  )}
                </div>

                {/* Action button */}
                <button
                  onClick={pickRandomStudent}
                  disabled={isPicking || availableCandidates.length === 0}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-base shadow-glow-indigo transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Sparkles className={`w-5 h-5 ${isPicking ? 'animate-spin text-amber-300' : ''}`} />
                  <span>{isPicking ? '高速輪盤抽籤中...' : '抽一位同學回答！'}</span>
                </button>
              </div>
            )}

            {/* 3. 分組加扣分（橫向左右並列 + 皇冠領先 + 縮小可拖曳懸浮窗） */}
            {activeTool === 'group' && (
              <div className="space-y-5 pt-2">
                {/* Header info & actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 pr-20">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xl flex items-center space-x-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span>全班分組計分競賽</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      按上 ▲ 加分、按下 ▼ 減分，最高分組別即時標示皇冠！
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleAddGroup}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition flex items-center space-x-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增組別</span>
                    </button>
                    <button
                      onClick={handleResetGroupScores}
                      className="px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 font-semibold text-xs transition"
                    >
                      重設分數
                    </button>
                  </div>
                </div>

                {/* Horizontal Groups Container (左右橫向並列) */}
                <div className="flex flex-row overflow-x-auto gap-3.5 py-2 px-1 scrollbar-thin items-stretch min-h-[260px]">
                  {currentGroups.map((grp) => {
                    const sc = groupScores[grp] || 0;
                    const isLeader = sc === maxGroupScore && maxGroupScore > 0;
                    return (
                      <div
                        key={grp}
                        className={`min-w-[150px] max-w-[180px] flex-1 rounded-3xl p-4 border transition-all duration-300 flex flex-col justify-between items-center text-center shadow-soft relative ${
                          isLeader
                            ? 'bg-gradient-to-b from-amber-50/80 via-white to-amber-50/20 border-amber-300 ring-4 ring-amber-400/30 shadow-glow-amber'
                            : 'bg-white border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        {/* Leader Crown Badge */}
                        {isLeader && (
                          <div className="absolute -top-3 px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] shadow-xs flex items-center space-x-1">
                            <Crown className="w-3 h-3 fill-current" />
                            <span>領先</span>
                          </div>
                        )}

                        {/* Top Row: Group Name & Delete */}
                        <div className="w-full flex items-center justify-between pt-1">
                          <span className="font-extrabold text-sm text-slate-700 truncate">{grp}</span>
                          {currentGroups.length > 1 && (
                            <button
                              onClick={() => handleDeleteGroup(grp)}
                              title="刪除此組"
                              className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Score Display */}
                        <div className="my-3">
                          <div className="text-4xl sm:text-5xl font-mono font-black text-indigo-600 tracking-tight">
                            {sc}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 mt-0.5">積分</div>
                        </div>

                        {/* Up / Down Buttons (按上加分、按下減分) */}
                        <div className="w-full space-y-1.5">
                          <button
                            onClick={() => updateGroupScore(grp, 1)}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1"
                          >
                            <ChevronUp className="w-4 h-4" />
                            <span>加 1 分</span>
                          </button>
                          <button
                            onClick={() => updateGroupScore(grp, -1)}
                            disabled={sc <= 0}
                            className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold text-xs transition flex items-center justify-center space-x-1 disabled:opacity-40"
                          >
                            <ChevronDown className="w-4 h-4" />
                            <span>扣 1 分</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. 搶答控制台（大螢幕呼吸燈倒數 + 結算特大第一名與 2~10 名次） */}
            {activeTool === 'buzz' && (
              <div className="text-center space-y-5 pt-2">
                <div className="flex items-center justify-center space-x-2">
                  <Bell className="w-6 h-6 text-amber-500" />
                  <h3 className="font-extrabold text-slate-800 text-xl">全班搶答控制台</h3>
                </div>

                {/* Phase 1: Setup & Ready */}
                {buzzerPhase === 'idle' && (
                  <div className="space-y-4 py-2">
                    <p className="text-xs text-slate-500">
                      按下開始後，大螢幕與學生機將同步巨型呼吸燈倒數，倒數歸零時即刻開放搶答！
                    </p>
                    <div className="flex justify-center items-center space-x-3 py-2">
                      <span className="text-xs text-slate-600 font-bold">倒數準備秒數：</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={buzzSecs}
                        onChange={(e) => setBuzzSecs(parseInt(e.target.value) || 5)}
                        className="w-16 px-2 py-1.5 text-center font-black font-mono border border-slate-300 rounded-xl text-lg text-indigo-600 focus:border-indigo-500 outline-none"
                      />
                      <span className="text-xs text-slate-400 font-bold">秒</span>
                    </div>

                    <button
                      onClick={startBuzzer}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-black text-base shadow-lg shadow-amber-500/25 transition flex items-center justify-center space-x-2"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>開始搶答倒數！</span>
                    </button>
                  </div>
                )}

                {/* Phase 2: Counting Down (巨型呼吸燈倒數) */}
                {buzzerPhase === 'counting' && (
                  <div className="py-4 space-y-4 flex flex-col items-center">
                    <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-amber-500/15 border-4 border-amber-500 flex flex-col items-center justify-center animate-pulse shadow-glow-amber">
                      <span className="text-6xl sm:text-7xl font-black font-mono text-amber-600 tracking-tighter">
                        {countdownRemaining}
                      </span>
                      <span className="text-xs font-bold text-amber-700 mt-1 uppercase tracking-widest">
                        呼吸燈倒數中
                      </span>
                    </div>
                    <div className="text-xs text-amber-700 font-semibold animate-pulse">
                      全班學生機同步緊張倒數中，歸零瞬間解鎖按鈕！
                    </div>
                    <button
                      onClick={stopBuzzer}
                      className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs"
                    >
                      取消搶答
                    </button>
                  </div>
                )}

                {/* Phase 3: Active (開放搶答中) */}
                {buzzerPhase === 'active' && (
                  <div className="py-4 space-y-4 flex flex-col items-center">
                    <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex flex-col items-center justify-center animate-bounce shadow-glow-emerald">
                      <Flame className="w-12 h-12 text-emerald-600 animate-pulse" />
                      <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                        立即搶答！
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600">BUZZ NOW</span>
                    </div>

                    <div className="text-xs text-slate-600 font-bold">
                      已收到 <span className="text-emerald-600 text-lg font-mono">{buzzList.length}</span> 人搶答按鍵
                    </div>

                    <button
                      onClick={stopBuzzer}
                      className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-xs transition"
                    >
                      結束搶答並公布排名
                    </button>
                  </div>
                )}

                {/* Phase 4: Finished (搶答龍虎榜：第一名大本名 + 2~10名次) */}
                {buzzerPhase === 'finished' && (
                  <div className="space-y-4 text-left">
                    {buzzList.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm font-semibold">
                        本輪無人搶答
                      </div>
                    ) : (
                      <>
                        {/* 👑 冠軍（第 1 名）大本名卡片 */}
                        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-white shadow-xl text-center space-y-1 relative overflow-hidden">
                          <div className="flex items-center justify-center space-x-1.5 text-yellow-100 text-xs font-bold uppercase tracking-wider">
                            <Crown className="w-4 h-4 fill-yellow-200" />
                            <span>搶答反應最快 冠軍</span>
                            <Crown className="w-4 h-4 fill-yellow-200" />
                          </div>
                          <div className="text-3xl sm:text-4xl font-black drop-shadow-md py-1">
                            {buzzList[0].student_name}
                          </div>
                          <div className="text-xs font-mono font-bold text-amber-100 bg-black/20 inline-block px-3 py-1 rounded-full">
                            反應時間：{new Date(buzzList[0].buzz_time).toLocaleTimeString()}
                          </div>
                        </div>

                        {/* 🥈 2 ~ 10 名列表 */}
                        {buzzList.length > 1 && (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            <div className="text-xs text-slate-400 font-bold px-1 mb-1">接續名次：</div>
                            {buzzList.slice(1, 10).map((b, idx) => {
                              const rank = idx + 2;
                              const timeDiffMs =
                                new Date(b.buzz_time).getTime() - new Date(buzzList[0].buzz_time).getTime();
                              const diffSec = (timeDiffMs / 1000).toFixed(2);
                              return (
                                <div
                                  key={b.id || idx}
                                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className={`w-5 h-5 rounded-lg text-[11px] font-bold flex items-center justify-center ${
                                        rank === 2
                                          ? 'bg-slate-300 text-slate-800'
                                          : rank === 3
                                          ? 'bg-amber-700/20 text-amber-800'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {rank}
                                    </span>
                                    <span className="font-bold text-slate-800">{b.student_name}</span>
                                  </div>
                                  <span className="text-slate-400 font-mono text-[11px]">
                                    +{diffSec}s
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    <button
                      onClick={() => setBuzzerPhase('idle')}
                      className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-xs transition"
                    >
                      🔄 發起下一輪搶答
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Poll / Voting */}
            {activeTool === 'vote' && (
              <div className="space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">即時投票</h3>
                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[idx] = e.target.value;
                          setPollOptions(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, `選項 ${String.fromCharCode(65 + pollOptions.length)}`])}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    + 新增選項
                  </button>
                </div>
                <div className="flex space-x-2 pt-2">
                  {room.vote_active ? (
                    <button
                      onClick={stopPoll}
                      className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                    >
                      結束並公布結果
                    </button>
                  ) : (
                    <button
                      onClick={startPoll}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                    >
                      發起全班即時投票
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 縮小後的可拖曳迷你懸浮橫條（即時呈現各組成績與皇冠，可任意拖曳） */}
      {groupMinimized && (
        <div
          style={{ left: `${dragPos.x}px`, top: `${dragPos.y}px` }}
          className="fixed z-50 select-none shadow-2xl rounded-2xl bg-white/95 backdrop-blur-md border border-indigo-200/90 p-2.5 flex items-center space-x-3 transition-shadow ring-2 ring-indigo-500/10"
        >
          {/* 拖曳手把 */}
          <div
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
            }}
            className="cursor-grab active:cursor-grabbing p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            title="按住拖曳位置"
          >
            <GripHorizontal className="w-4 h-4" />
          </div>

          {/* 橫向各組成績徽章 */}
          <div className="flex items-center space-x-2 max-w-sm sm:max-w-md md:max-w-lg overflow-x-auto py-0.5 scrollbar-none">
            {currentGroups.map((grp) => {
              const sc = groupScores[grp] || 0;
              const isLead = sc === maxGroupScore && maxGroupScore > 0;
              return (
                <div
                  key={grp}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1.5 flex-shrink-0 border ${
                    isLead
                      ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs ring-1 ring-amber-400/40'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {isLead && <span>👑</span>}
                  <span>{grp}：</span>
                  <span className="font-mono font-extrabold text-indigo-600">{sc}分</span>
                </div>
              );
            })}
          </div>

          {/* 展開與關閉控制 */}
          <div className="flex items-center space-x-1 pl-1 border-l border-slate-200">
            <button
              onClick={() => {
                setGroupMinimized(false);
                setActiveTool('group');
              }}
              title="展開分組加扣分視窗"
              className="p-1.5 rounded-xl hover:bg-indigo-50 text-indigo-600 transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setGroupMinimized(false)}
              title="關閉分組成績"
              className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-500 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
