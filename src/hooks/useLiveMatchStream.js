import { useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7031/api';

/**
 * Subscribes to the backend's Server-Sent Events stream of live-match updates.
 * Falls back to plain HTTP polling if the stream fails to open or drops too often.
 *
 * Returns:
 *   matches    — latest live-match array from the server
 *   loading    — true until the first event arrives
 *   connected  — true while the EventSource is open
 *   mode       — 'sse' | 'polling' (current transport in use)
 */
export default function useLiveMatchStream() {
  const [matches,   setMatches]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);
  const [mode,      setMode]      = useState('sse');
  const [error,     setError]     = useState(null);

  const failureCountRef = useRef(0);
  const esRef           = useRef(null);
  const pollIdRef       = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const startPollingFallback = () => {
      setMode('polling');
      const fetchOnce = () =>
        api.get('/Match/live')
          .then(r => {
            if (!cancelled) {
              setMatches(r.data ?? []);
              setLoading(false);
              setError(null);
            }
          })
          .catch(err => {
            if (!cancelled) {
              // Stop the infinite spinner — show empty list with an error flag
              setLoading(false);
              setError(err?.message ?? 'Failed to load live matches');
            }
          });
      fetchOnce();
      pollIdRef.current = setInterval(fetchOnce, 5_000);
    };

    const openSse = () => {
      setMode('sse');
      // EventSource doesn't support custom headers — auth via cookies (withCredentials)
      const url = `${API_BASE_URL}/Match/stream`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        failureCountRef.current = 0;
        setConnected(true);
      };

      es.addEventListener('live-update', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (!cancelled) {
            setMatches(Array.isArray(data) ? data : []);
            setLoading(false);
          }
        } catch { /* malformed payload — ignore this tick */ }
      });

      es.onerror = () => {
        setConnected(false);
        failureCountRef.current += 1;
        // Browser auto-reconnects after a brief delay. If we've failed 3+ times,
        // give up and fall back to polling — likely a CORS or proxy issue.
        if (failureCountRef.current >= 3) {
          try { es.close(); } catch {}
          esRef.current = null;
          if (!cancelled && pollIdRef.current == null) startPollingFallback();
        }
      };
    };

    openSse();

    return () => {
      cancelled = true;
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      if (pollIdRef.current) {
        clearInterval(pollIdRef.current);
        pollIdRef.current = null;
      }
    };
  }, []);

  return { matches, loading, connected, mode, error };
}
