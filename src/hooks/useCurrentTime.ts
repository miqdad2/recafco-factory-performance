import { useEffect, useState } from 'react';

/** Real wall-clock time, refreshed every `intervalMs`. The timer is cleared on unmount. */
export function useCurrentTime(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
