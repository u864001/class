import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Room, RoomStudent } from '../types';

export interface UseRoomOptions {
  studentId?: string;
  onKicked?: () => void;
}

export function useRoom(roomId: string | null, options?: UseRoomOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference to active realtime channel
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Track if student was ever confirmed to be in room (to detect kick after reconnect/wake)
  const wasInRoomRef = useRef(false);
  const onKickedRef = useRef(options?.onKicked);
  onKickedRef.current = options?.onKicked;

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'offline'>(
    navigator.onLine ? 'connecting' : 'offline'
  );

  // 1. Fetch initial room state & students
  const fetchRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId.toUpperCase())
        .single();

      if (roomErr) throw roomErr;
      setRoom(data as Room);

      const { data: studentsData, error: stuErr } = await supabase
        .from('room_students')
        .select('*')
        .eq('room_id', roomId.toUpperCase());

      if (stuErr) throw stuErr;
      const fetchedStudents = (studentsData || []) as RoomStudent[];
      setStudents(fetchedStudents);

      // Student kick detection on server fetch (e.g. after sleep wake):
      if (options?.studentId) {
        const isPresent = fetchedStudents.some((s) => s.student_id === options.studentId);
        if (isPresent) {
          wasInRoomRef.current = true;
        } else if (wasInRoomRef.current) {
          // Student was in the room earlier, but is now removed by teacher!
          onKickedRef.current?.();
        }
      }
    } catch (err: any) {
      console.error('Error fetching room:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roomId, options?.studentId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // iPad 休眠喚醒或斷線重連監聽：自動拉取最新教室狀態
  useEffect(() => {
    const handleWakeSync = () => {
      if (document.visibilityState === 'visible' && roomId) {
        setConnectionStatus('connecting');
        fetchRoom().then(() => setConnectionStatus('connected'));
      }
    };

    const handleOnline = () => {
      setConnectionStatus('connecting');
      if (roomId) {
        fetchRoom().then(() => setConnectionStatus('connected'));
      }
    };

    const handleOffline = () => {
      setConnectionStatus('offline');
    };

    document.addEventListener('visibilitychange', handleWakeSync);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchRoom, roomId]);

  // 2. Realtime subscription for Room and Students
  useEffect(() => {
    if (!roomId) return;
    const normalizedRoomId = roomId.toUpperCase();

    const channel = supabase
      .channel(`room_sync_${normalizedRoomId}`)
      .on(
        'broadcast',
        { event: 'student_kicked' },
        (payload: { payload?: { student_id?: string } }) => {
          const kickedId = payload?.payload?.student_id;
          if (kickedId) {
            setStudents((prev) => prev.filter((s) => s.student_id !== kickedId));
            if (options?.studentId && kickedId === options.studentId) {
              onKickedRef.current?.();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${normalizedRoomId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setRoom(payload.new as Room);
          } else if (payload.eventType === 'DELETE') {
            setRoom(null);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_students', filter: `room_id=eq.${normalizedRoomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as RoomStudent;
            setStudents((prev) => {
              const idx = prev.findIndex((s) => s.student_id === updated.student_id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [...prev, updated];
            });
            if (options?.studentId && updated.student_id === options.studentId) {
              wasInRoomRef.current = true;
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { student_id?: string };
            if (deleted?.student_id) {
              setStudents((prev) => prev.filter((s) => s.student_id !== deleted.student_id));
              if (options?.studentId && deleted.student_id === options.studentId) {
                onKickedRef.current?.();
              }
            } else {
              // If replica identity didn't provide student_id in old payload, fetch fresh list
              fetchRoom();
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          fetchRoom();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (navigator.onLine) {
            setConnectionStatus('connecting');
          } else {
            setConnectionStatus('offline');
          }
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, options?.studentId, fetchRoom]);

  // 3. Room Actions
  const updateRoomState = async (updates: Partial<Room>) => {
    if (!roomId) return;
    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomId.toUpperCase());
    if (error) console.error('Failed to update room:', error);
  };

  const markStudentOnline = async (studentId: string, studentName: string) => {
    if (!roomId) return;
    await supabase.from('room_students').upsert(
      {
        room_id: roomId.toUpperCase(),
        student_id: studentId,
        student_name: studentName,
        is_online: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'room_id, student_id' }
    );
  };

  // 4. Kick student action (removes from active room roster, broadcasts kick to student iPad)
  const kickStudent = async (studentId: string) => {
    if (!roomId) return;
    const cleanRoomId = roomId.toUpperCase();

    // Optimistically update local teacher UI immediately
    setStudents((prev) => prev.filter((s) => s.student_id !== studentId));

    // Send broadcast event so student iPad receives it in sub-50ms
    if (channelRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'student_kicked',
          payload: { student_id: studentId },
        });
      } catch (e) {
        console.warn('Realtime kick broadcast warning:', e);
      }
    }

    // Persist deletion in database
    try {
      const { error: delErr } = await supabase
        .from('room_students')
        .delete()
        .eq('room_id', cleanRoomId)
        .eq('student_id', studentId);

      if (delErr) {
        console.error('Failed to delete student from room_students:', delErr);
        fetchRoom();
      }
    } catch (err) {
      console.error('Exception during kickStudent:', err);
      fetchRoom();
    }
  };

  return {
    room,
    students,
    loading,
    error,
    connectionStatus,
    refresh: fetchRoom,
    updateRoomState,
    markStudentOnline,
    kickStudent,
  };
}

