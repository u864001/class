import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Submission } from '../types';

export function useSubmissions(roomId: string | null, roundId: string | null) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

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
                if (prev.some((s) => s.id === newSub.id)) return prev;
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

  // Submit answer (from student)
  const submitAnswer = async (submission: {
    student_id: string;
    student_name: string;
    choice?: string | null;
    text_answer?: string | null;
    image_url?: string | null;
  }) => {
    if (!roomId || !roundId) return;

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
