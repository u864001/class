import React, { useState } from 'react';
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
} from 'lucide-react';
import { Room } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureAndUploadScreenSnapshot } from '../../lib/imageCompressor';

interface FloatingDockProps {
  room: Room;
  onUpdateRoom: (updates: Partial<Room>) => Promise<void>;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({ room, onUpdateRoom }) => {
  const [activeTool, setActiveTool] = useState<
    'qr' | 'broadcast' | 'timer' | 'dice' | 'picker' | 'vote' | 'group' | 'buzz' | 'screenshare' | null
  >(null);
  const [snappingScreen, setSnappingScreen] = useState(false);

  // Timer tool local state
  const [timerVal, setTimerVal] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Dice local state
  const [diceNum, setDiceNum] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  // Picker local state
  const [pickedStudent, setPickedStudent] = useState<string | null>(null);

  // Poll local state
  const [pollOptions, setPollOptions] = useState<string[]>(['選項 A', '選項 B']);
  const [newOption, setNewOption] = useState('');

  // Buzzer local state
  const [buzzSecs, setBuzzSecs] = useState(5);

  // Broadcast local state
  const [broadcastInput, setBroadcastInput] = useState(room.broadcast_text || '');

  // --- Actions ---
  const toggleLockScreen = async () => {
    await onUpdateRoom({ screen_locked: !room.screen_locked });
  };

  const handleBroadcast = async () => {
    await onUpdateRoom({ broadcast_text: broadcastInput.trim() });
    setActiveTool(null);
  };

  const handleCaptureAndBroadcast = async () => {
    setSnappingScreen(true);
    try {
      const url = await captureAndUploadScreenSnapshot(room.id);
      await onUpdateRoom({
        broadcast_image_url: url,
      });
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

  const handleStopScreenBroadcast = async () => {
    await onUpdateRoom({ broadcast_image_url: '' });
    setActiveTool(null);
  };

  const rollDice = () => {
    setRolling(true);
    setTimeout(() => {
      setDiceNum(Math.floor(Math.random() * 6) + 1);
      setRolling(false);
    }, 600);
  };

  const pickRandomStudent = () => {
    const total = room.custom_class_enabled ? room.custom_student_count || 20 : 30;
    const randSeat = Math.floor(Math.random() * total) + 1;
    setPickedStudent(`${randSeat} 號同學`);
  };

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

  const startBuzzer = async () => {
    await onUpdateRoom({
      buzz_active: true,
      buzz_countdown: buzzSecs,
    });
  };

  const stopBuzzer = async () => {
    await onUpdateRoom({ buzz_active: false });
  };

  const updateGroupScore = async (groupName: string, delta: number) => {
    const scores = { ...(room.group_scores || {}) };
    scores[groupName] = Math.max(0, (scores[groupName] || 0) + delta);
    await onUpdateRoom({ group_scores: scores });
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
            title="一鍵廣播螢幕快照至學生 iPad"
            className={`p-2.5 rounded-xl transition ${
              room.broadcast_image_url
                ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 animate-pulse'
                : 'hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-600'
            }`}
          >
            <MonitorUp className="w-5 h-5" />
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
      {activeTool && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-3xl p-6 shadow-soft relative border border-white/80">
            {/* Close button */}
            <button
              onClick={() => setActiveTool(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* QR Code Modal */}
            {activeTool === 'qr' && (
              <div className="text-center space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">學生掃描加入教室</h3>
                <div className="p-4 bg-white rounded-2xl inline-block shadow-xs border border-slate-100">
                  <QRCodeSVG value={studentJoinUrl} size={220} level="M" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold mb-1">或請學生在首頁輸入房號：</div>
                  <div className="text-3xl font-mono font-black text-indigo-600 tracking-wider">
                    {room.id}
                  </div>
                </div>
              </div>
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

            {/* Screen Share / Snapshot Modal */}
            {activeTool === 'screenshare' && (
              <div className="space-y-4 pt-2 text-center">
                <div className="flex items-center justify-center space-x-2 text-slate-800 font-extrabold text-lg">
                  <MonitorUp className="w-6 h-6 text-indigo-600" />
                  <span>一鍵廣播螢幕快照</span>
                </div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  適合在大黑板/投影故障時，將教師當前的電子書、PPT 或網頁畫面快照推送到所有學生的 iPad 螢幕！
                </p>

                {room.broadcast_image_url ? (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-1.5 max-h-48 flex items-center justify-center">
                      <img
                        src={room.broadcast_image_url}
                        alt="Current Broadcast"
                        className="max-h-44 object-contain rounded-xl"
                      />
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
                        全班推送中
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCaptureAndBroadcast}
                        disabled={snappingScreen}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50"
                      >
                        {snappingScreen ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>擷取中...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4" />
                            <span>更新最新快照</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleStopScreenBroadcast}
                        className="py-3 px-4 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs"
                      >
                        停止廣播
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                      <MonitorUp className="w-8 h-8" />
                    </div>
                    <button
                      onClick={handleCaptureAndBroadcast}
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
                          <span>開始擷取並推播至全班</span>
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

            {/* Dice Modal */}
            {activeTool === 'dice' && (
              <div className="text-center space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">課堂擲骰子</h3>
                <div className={`text-6xl py-6 transition-transform ${rolling ? 'animate-bounce' : ''}`}>
                  {diceNum ? ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][diceNum - 1] : '🎲'}
                </div>
                <button
                  onClick={rollDice}
                  disabled={rolling}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs"
                >
                  {rolling ? '擲骰子中...' : '擲！'}
                </button>
              </div>
            )}

            {/* Lucky Student Picker */}
            {activeTool === 'picker' && (
              <div className="text-center space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">隨機抽籤點名</h3>
                <div className="text-3xl font-extrabold text-indigo-600 py-8">
                  {pickedStudent || '點擊下方按鈕開始抽籤'}
                </div>
                <button
                  onClick={pickRandomStudent}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs"
                >
                  抽一位同學回答！
                </button>
              </div>
            )}

            {/* Group Scoring */}
            {activeTool === 'group' && (
              <div className="space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">分組加扣分</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(room.groups || []).map((grp) => {
                    const sc = (room.group_scores || {})[grp] || 0;
                    return (
                      <div key={grp} className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-700">{grp}</div>
                          <div className="font-mono font-extrabold text-lg text-indigo-600">{sc} 分</div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => updateGroupScore(grp, -1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                          >
                            -
                          </button>
                          <button
                            onClick={() => updateGroupScore(grp, 1)}
                            className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Buzzer Tool */}
            {activeTool === 'buzz' && (
              <div className="text-center space-y-4 pt-2">
                <h3 className="font-extrabold text-slate-800 text-lg">搶答控制台</h3>
                <p className="text-xs text-slate-500">啟動後學生手機端將出現震動搶答按鈕</p>
                <div className="flex justify-center items-center space-x-3 py-2">
                  <span className="text-xs text-slate-600 font-semibold">倒數秒數：</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={buzzSecs}
                    onChange={(e) => setBuzzSecs(parseInt(e.target.value) || 5)}
                    className="w-16 px-2 py-1 text-center font-bold font-mono border rounded-lg"
                  />
                  <span className="text-xs text-slate-400">秒</span>
                </div>
                <div className="flex space-x-2">
                  {room.buzz_active ? (
                    <button
                      onClick={stopBuzzer}
                      className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
                    >
                      結束搶答
                    </button>
                  ) : (
                    <button
                      onClick={startBuzzer}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-xs"
                    >
                      開始搶答倒數！
                    </button>
                  )}
                </div>
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
    </>
  );
};
