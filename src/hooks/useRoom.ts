import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Room, RoomStudent } from '../types';

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setStudents(studentsData as RoomStudent[]);
    } catch (err: any) {
      console.error('Error fetching room:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

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
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { student_id: string };
            setStudents((prev) => prev.filter((s) => s.student_id !== deleted.student_id));
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

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

  return {
    room,
    students,
    loading,
    error,
    connectionStatus,
    refresh: fetchRoom,
    updateRoomState,
    markStudentOnline,
  };
}
