import React, { useState } from 'react';
import { RoomSetup } from './RoomSetup';
import { QuestionPublisher } from './QuestionPublisher';
import { LiveAnswerWall } from './LiveAnswerWall';
import { GradingView } from './GradingView';
import { Leaderboard } from './Leaderboard';
import { FloatingDock } from './FloatingDock';
import { useRoom } from '../../hooks/useRoom';
import { useSubmissions } from '../../hooks/useSubmissions';
import { QuestionType } from '../../types';

interface TeacherViewProps {
  initialRoomId?: string | null;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ initialRoomId }) => {
  const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);

  const { room, students, updateRoomState } = useRoom(roomId);
  const { submissions, submissionMap, awardScore } = useSubmissions(
    roomId,
    room?.current_round_id || null
  );

  // If no room created yet, show Setup
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
      if (sub.choice === correctChoice) {
        scores[sub.student_id] = (scores[sub.student_id] || 0) + qScore;
        await awardScore(sub.student_id, qScore);
      } else {
        await awardScore(sub.student_id, 0);
      }
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
    await updateRoomState({
      current_question_num: room.current_question_num + 1,
      status: 'idle',
      revealed_answer: null,
      broadcast_image_url: '',
    });
    setStep(2);
  };

  const handleResetScores = async () => {
    if (!confirm('確定要清除全班的累計積分嗎？')) return;
    await updateRoomState({
      cumulative_scores: {},
    });
  };

  return (
    <div className="pb-28">
      {/* Top Step Dots Navigation */}
      <div className="max-w-xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          {[
            { s: 2, label: '出題設定' },
            { s: 3, label: '即時作答' },
            { s: 4, label: '批改給分' },
            { s: 5, label: '榮譽排行' },
          ].map((item, idx) => (
            <React.Fragment key={item.s}>
              <button
                onClick={() => setStep(item.s as any)}
                className="flex flex-col items-center space-y-1 group"
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition ${
                    step === item.s
                      ? 'bg-indigo-600 text-white shadow-glow-indigo scale-110'
                      : step > item.s
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {item.s - 1}
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    step === item.s ? 'text-indigo-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
              {idx < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full ${
                    step > item.s ? 'bg-emerald-300' : 'bg-slate-200'
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
      <FloatingDock room={room} onUpdateRoom={updateRoomState} />
    </div>
  );
};
