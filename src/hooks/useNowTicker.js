import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component once per `intervalMs` (default 1000ms).
 * Used to drive the smooth live-clock display between SSE cycles — every
 * tick the component recomputes `liveClockDisplay({...}, Date.now())` and
 * the minute counter advances even if no new server data has arrived.
 *
 * Returns the current Date.now() so consumers can pass it as the second
 * argument to `liveClockDisplay`.
 */
export default function useNowTicker(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
