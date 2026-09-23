import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Submission } from '../types';

export function useSubmissions(roomId: string | null, roundId: string | null) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef<boolean>(false);

  const fetchSubmissions = useCallback(async () => {
    if (!roomId || !roundId) {
      setSubmissions([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('room_id', roomId.toUpperCase())
        .eq('round_id', roundId);

      if (error) throw error;
      setSubmissions((data as Submission[]) || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, roundId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // iPad 休眠喚醒或網路重連時，主動重新同步作答名單與狀態
  useEffect(() => {
    const handleWakeSync = () => {
      if (document.visibilityState === 'visible' && roomId && roundId) {
        fetchSubmissions();
      }
    };
    const handleOnlineSync = () => {
      if (roomId && roundId) {
        fetchSubmissions();
      }
    };

    document.addEventListener('visibilitychange', handleWakeSync);
    window.addEventListener('online', handleOnlineSync);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeSync);
      window.removeEventListener('online', handleOnlineSync);
    };
  }, [fetchSubmissions, roomId, roundId]);

  // Realtime subscription for submissions
  useEffect(() => {
    if (!roomId || !roundId) return;
    const normalizedRoomId = roomId.toUpperCase();

    const channel = supabase
      .channel(`submissions_${normalizedRoomId}_${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `room_id=eq.${normalizedRoomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSub = payload.new as Submission;
            if (newSub.round_id === roundId) {
              setSubmissions((prev) => {
                if (prev.some((s) => s.id === newSub.id || s.student_id === newSub.student_id)) {
                  return prev.map((s) => (s.student_id === newSub.student_id ? newSub : s));
                }
                return [...prev, newSub];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Submission;
            if (updated.round_id === roundId) {
              setSubmissions((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setSubmissions((prev) => prev.filter((s) => s.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, roundId]);

  // Map for O(1) student submission lookup
  const submissionMap = useMemo(() => {
    const map: Record<string, Submission> = {};
    for (const sub of submissions) {
      map[sub.student_id] = sub;
    }
    return map;
  }, [submissions]);

  // Submit answer (from student with strict deduplication & score protection)
  const submitAnswer = async (submission: {
    student_id: string;
    student_name: string;
    choice?: string | null;
    text_answer?: string | null;
    image_url?: string | null;
  }) => {
    if (!roomId || !roundId) return;

    // 防止學生連續快點兩次造成並發寫入衝突
    if (isSubmittingRef.current) {
      console.warn('作答送出中，請勿重複點擊');
      return;
    }

    try {
      isSubmittingRef.current = true;

      // 嚴格規範學生送出資料結構，不傳入 earned_score（由後端預設或教師批改）
      const { error } = await supabase.from('submissions').upsert(
        {
          room_id: roomId.toUpperCase(),
          round_id: roundId,
          student_id: submission.student_id,
          student_name: submission.student_name,
          choice: submission.choice || null,
          text_answer: submission.text_answer || null,
          image_url: submission.image_url || null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'room_id, round_id, student_id' }
      );

      if (error) {
        console.error('Error submitting answer:', error);
        throw error;
      }

      // 送出成功後主動重新拉取，確保本地狀態即時吻合
      await fetchSubmissions();
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 500);
    }
  };

  // Grade student answer (from teacher)
  const awardScore = async (studentId: string, earnedScore: number) => {
    if (!roomId || !roundId) return;

    await supabase
      .from('submissions')
      .update({ earned_score: earnedScore })
      .eq('room_id', roomId.toUpperCase())
      .eq('round_id', roundId)
      .eq('student_id', studentId);
  };

  return {
    submissions,
    submissionMap,
    loading,
    submitAnswer,
    awardScore,
    refresh: fetchSubmissions,
  };
}
