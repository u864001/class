import { useState, useEffect } from 'react';

/**
 * Server-anchored timer hook that never drifts when mobile screens lock or switch tabs.
 */
export function useSyncTimer(
  startedAt: string | null | undefined,
  durationSeconds: number,
  isActive: boolean,
  onExpire?: () => void
) {
  const [remaining, setRemaining] = useState<number>(durationSeconds);

  useEffect(() => {
    if (!isActive || !startedAt) {
      setRemaining(durationSeconds);
      return;
    }

    const startTimestamp = new Date(startedAt).getTime();
    const endTimestamp = startTimestamp + durationSeconds * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
      setRemaining(diffSecs);

      if (diffSecs <= 0) {
        if (onExpire) onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [startedAt, durationSeconds, isActive]);

  return remaining;
}
