import React, { useState, useEffect } from 'react';
import { QrCode, ArrowLeft } from 'lucide-react';
import { RoomSetup } from './RoomSetup';
import { QuestionPublisher } from './QuestionPublisher';
import { LiveAnswerWall } from './LiveAnswerWall';
import { GradingView } from './GradingView';
import { Leaderboard } from './Leaderboard';
import { FloatingDock } from './FloatingDock';
import { LiveJoinLobbyModal } from './LiveJoinLobbyModal';
import { HomeworkBuilder } from './homework/HomeworkBuilder';
import { HomeworkReview } from './homework/HomeworkReview';
import { parseHomework } from '../../lib/homeworkApi';
import { useRoom } from '../../hooks/useRoom';
import { useSubmissions } from '../../hooks/useSubmissions';
import { QuestionType } from '../../types';
import { useI18n } from '../../context/I18nContext';

interface TeacherViewProps {
  initialRoomId?: string | null;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ initialRoomId }) => {
  const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);
  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [advancingQuestion, setAdvancingQuestion] = useState(false);
  const [hwView, setHwView] = useState<'builder' | 'review'>('builder');

  const { t } = useI18n();

  const { room, students, updateRoomState, kickStudent } = useRoom(roomId);
  const { submissions, submissionMap, awardScore } = useSubmissions(
    roomId,
    room?.current_round_id || null
  );

  const isHomeworkMode = Boolean(
    room?.status?.startsWith('homework_') || (room && parseHomework(room.question_note))
  );

  useEffect(() => {
    if (room?.status === 'homework_active' || room?.status === 'homework_closed') {
      setHwView('review');
    } else if (room?.status === 'homework_prep') {
      setHwView('builder');
    }
  }, [room?.status]);

  // If no room created yet, show Setup (Step 1 entry gate)
  if (!roomId || !room) {
    return (
      <RoomSetup
        onRoomCreated={(newId) => {
          setRoomId(newId);
          setStep(2);
        }}
      />
    );
  }

  // --- Homework Mode View ---
  if (isHomeworkMode) {
    return (
      <div className="pb-20 space-y-4">
        {/* Top Navbar */}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-4 flex items-center justify-between">
          <button
            onClick={() => setRoomId(null)}
            className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5 hover:border-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回選擇教室</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHwView('builder')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                hwView === 'builder'
                  ? 'btn-theme-primary shadow-xs'
                  : 'bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              出題布題
            </button>
            <button
              onClick={() => setHwView('review')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                hwView === 'review'
                  ? 'btn-theme-primary shadow-xs'
                  : 'bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              作答檢閱與下載
            </button>
          </div>
        </div>

        {hwView === 'builder' ? (
          <HomeworkBuilder
            room={room}
            onPublished={() => {
              setHwView('review');
              updateRoomState({ status: 'homework_active' });
            }}
          />
        ) : (
          <HomeworkReview
            room={room}
            onReopenBuilder={() => {
              setHwView('builder');
              updateRoomState({ status: 'homework_prep' });
            }}
            onRefreshRoom={() => updateRoomState({})}
          />
        )}
      </div>
    );
  }

  // --- Step 2: Publish Question ---
  const handlePublishQuestion = async (qData: {
    question_type: QuestionType;
    question_note: string;
    question_score: number;
    question_image_url: string | null;
    timer_seconds: number;
  }) => {
    const roundId = `R${String(room.current_question_num).padStart(3, '0')}_${Date.now().toString(36).toUpperCase()}`;

    await updateRoomState({
      current_round_id: roundId,
      question_type: qData.question_type,
      question_note: qData.question_note,
      question_score: qData.question_score,
      question_image_url: qData.question_image_url,
      timer_seconds: qData.timer_seconds,
      status: 'published',
      revealed_answer: null,
      answering_started_at: null,
    });

    setStep(3);
  };

  // --- Step 3: Answering Controls ---
  const handleStartAnswering = async () => {
    await updateRoomState({
      status: 'answering',
      answering_started_at: new Date().toISOString(),
    });
  };

  const handleStopAnswering = async () => {
    await updateRoomState({
      status: 'stopped',
    });
  };

  const handleExtendTime = async (extraSeconds: number) => {
    await updateRoomState({
      timer_seconds: (room.timer_seconds || 20) + extraSeconds,
    });
  };

  // --- Step 4: Grading Controls ---
  const handleRevealAnswer = async (correctChoice: string) => {
    const qScore = room.question_score || 2;
    const scores = { ...(room.cumulative_scores || {}) };

    for (const sub of submissions) {
      const prevEarned = sub.earned_score || 0;
      const isCorrect = sub.choice === correctChoice;
      const newEarned = isCorrect ? qScore : 0;
      scores[sub.student_id] = Math.max(0, (scores[sub.student_id] || 0) - prevEarned + newEarned);
      await awardScore(sub.student_id, newEarned);
    }

    await updateRoomState({
      revealed_answer: correctChoice,
      cumulative_scores: scores,
    });
  };

  const handleAwardScore = async (studentId: string, earnedScore: number) => {
    const scores = { ...(room.cumulative_scores || {}) };
    const prevEarned = submissionMap[studentId]?.earned_score || 0;
    scores[studentId] = Math.max(0, (scores[studentId] || 0) - prevEarned + earnedScore);

    await awardScore(studentId, earnedScore);
    await updateRoomState({ cumulative_scores: scores });
  };

  const handleBroadcastImage = async (imageUrl: string) => {
    await updateRoomState({
      broadcast_image_url: imageUrl,
    });
  };

  const handleNextQuestion = async () => {
    if (advancingQuestion) return;
    setAdvancingQuestion(true);
    try {
      await updateRoomState({
        current_question_num: room.current_question_num + 1,
        status: 'idle',
        revealed_answer: null,
        broadcast_image_url: '',
      });
      setStep(2);
    } finally {
      setAdvancingQuestion(false);
    }
  };

  const handleResetScores = async () => {
    if (!confirm('確定要清除全班的累計積分嗎？ / Clear all cumulative scores?')) return;
    await updateRoomState({
      cumulative_scores: {},
    });
  };

  const stepItems = [
    { s: 2, label: t('steps.step2') },
    { s: 3, label: t('steps.step3') },
    { s: 4, label: t('steps.step4') },
    { s: 5, label: t('steps.step5') },
  ];

  return (
    <div className="pb-28">
      {/* Top Step Dots Navigation & Lobby Shortcut */}
      <div className="max-w-xl mx-auto px-4 pt-5 pb-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('steps.flowTitle')}
          </span>
          <button
            onClick={() => setShowLobbyModal(true)}
            className="px-3 py-1 rounded-full badge-theme text-xs font-bold border transition shadow-2xs flex items-center space-x-1.5 active:scale-95"
            title="開啟學生掃碼加入大廳 / Open Lobby"
          >
            <QrCode className="w-3.5 h-3.5 text-theme" />
            <span>
              {t('steps.projectLobby')} ({t('steps.studentsJoined', { count: students.length })})
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          {stepItems.map((item, idx) => (
            <React.Fragment key={item.s}>
              <button
                onClick={() => setStep(item.s as any)}
                className="flex flex-col items-center space-y-1 group"
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition ${
                    step === item.s
                      ? 'btn-theme-primary scale-110 shadow-glow-theme'
                      : step > item.s
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {item.s - 1}
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    step === item.s ? 'text-theme font-bold' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
              {idx < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full ${
                    step > item.s ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Step View */}
      {step === 2 && (
        <QuestionPublisher room={room} onPublish={handlePublishQuestion} />
      )}

      {step === 3 && (
        <LiveAnswerWall
          room={room}
          students={students}
          submissions={submissions}
          submissionMap={submissionMap}
          onStartAnswering={handleStartAnswering}
          onStopAnswering={handleStopAnswering}
          onExtendTime={handleExtendTime}
          onGoToGrading={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <GradingView
          room={room}
          submissions={submissions}
          submissionMap={submissionMap}
          onRevealAnswer={handleRevealAnswer}
          onAwardScore={handleAwardScore}
          onBroadcastImage={handleBroadcastImage}
          onGoToLeaderboard={() => setStep(5)}
          onNextQuestion={handleNextQuestion}
        />
      )}

      {step === 5 && (
        <Leaderboard
          room={room}
          submissions={submissions}
          onNextQuestion={handleNextQuestion}
          onResetScores={handleResetScores}
        />
      )}

      {/* Floating Tools Dock */}
      <FloatingDock
        room={room}
        onUpdateRoom={updateRoomState}
        students={students}
        onKickStudent={kickStudent}
      />

      {/* Kahoot!-style Live Join Lobby Modal */}
      <LiveJoinLobbyModal
        isOpen={showLobbyModal}
        onClose={() => setShowLobbyModal(false)}
        room={room}
        students={students}
        onKickStudent={kickStudent}
      />
    </div>
  );
};
