import { useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import api from '../api/apiClient';

const HUB_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5193/api')
  .replace(/\/api\/?$/, '');

/**
 * Connects to the BetStatusHub SignalR endpoint and routes
 * BetAccepted / BetRejected / BetCancelled events to callbacks.
 *
 * Falls back to polling GET /api/Bet/{id}/status every 2 s when SignalR
 * cannot connect or is not supported.
 *
 * @param {Object} handlers
 *   .onAccepted(payload)   — { betId, lockedOdds }
 *   .onRejected(payload)   — { betId, reason, offeredOdds, offeredOddsExpiry }
 *   .onCancelled(payload)  — { betId }
 * @param {number[]} watchIds — bet IDs to poll (fallback only; SignalR is push)
 */
export default function useBetStatusHub({ onAccepted, onRejected, onCancelled, watchIds = [] }) {
  const connRef      = useRef(null);
  const pollRefs     = useRef({});   // betId → intervalId
  const modeRef      = useRef('signalr'); // 'signalr' | 'polling'

  // ── Stable callback refs so the effect doesn't re-run on every render ──
  const acceptedRef  = useRef(onAccepted);
  const rejectedRef  = useRef(onRejected);
  const cancelledRef = useRef(onCancelled);
  useEffect(() => { acceptedRef.current  = onAccepted;  }, [onAccepted]);
  useEffect(() => { rejectedRef.current  = onRejected;  }, [onRejected]);
  useEffect(() => { cancelledRef.current = onCancelled; }, [onCancelled]);

  // ── Polling fallback ────────────────────────────────────────────────────
  const startPolling = useCallback((betId) => {
    if (pollRefs.current[betId]) return; // already polling
    pollRefs.current[betId] = setInterval(async () => {
      try {
        const { data } = await api.get(`/Bet/${betId}/status`);
        const status = data?.status ?? data?.Status;
        if (status === 'Pending') {
          clearInterval(pollRefs.current[betId]);
          delete pollRefs.current[betId];
          acceptedRef.current?.({ betId, lockedOdds: data.oddsAtBetTime ?? data.OddsAtBetTime });
        } else if (status === 'Rejected') {
          clearInterval(pollRefs.current[betId]);
          delete pollRefs.current[betId];
          rejectedRef.current?.({
            betId,
            reason:             data.rejectionReason    ?? data.RejectionReason    ?? '',
            offeredOdds:        data.offeredOdds        ?? data.OfferedOdds        ?? null,
            offeredOddsExpiry:  data.offeredOddsExpiry  ?? data.OfferedOddsExpiry  ?? null,
          });
        } else if (status === 'Cancelled') {
          clearInterval(pollRefs.current[betId]);
          delete pollRefs.current[betId];
          cancelledRef.current?.({ betId });
        }
      } catch { /* keep polling */ }
    }, 2000);
  }, []);

  const stopPolling = useCallback((betId) => {
    if (pollRefs.current[betId]) {
      clearInterval(pollRefs.current[betId]);
      delete pollRefs.current[betId];
    }
  }, []);

  // ── SignalR connection ──────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('bpfl_token');
    if (!token) {
      // Not authenticated — can't connect; rely on polling for any watched IDs
      modeRef.current = 'polling';
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HUB_BASE_URL}/hubs/bet-status`, {
        accessTokenFactory: () => localStorage.getItem('bpfl_token') ?? '',
        // Prefer WebSockets; fall back to SSE then long-polling automatically
        transport: signalR.HttpTransportType.WebSockets
          | signalR.HttpTransportType.ServerSentEvents
          | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('BetAccepted', (payload) => {
      const betId = payload?.betId ?? payload?.BetId;
      stopPolling(betId);
      acceptedRef.current?.(payload);
    });

    connection.on('BetRejected', (payload) => {
      const betId = payload?.betId ?? payload?.BetId;
      stopPolling(betId);
      rejectedRef.current?.(payload);
    });

    connection.on('BetCancelled', (payload) => {
      const betId = payload?.betId ?? payload?.BetId;
      stopPolling(betId);
      cancelledRef.current?.(payload);
    });

    connection.onreconnecting(() => { modeRef.current = 'reconnecting'; });
    connection.onreconnected(() => { modeRef.current = 'signalr'; });
    connection.onclose(() => {
      modeRef.current = 'polling';
      // Fall back to polling for any remaining watched IDs
      watchIds.forEach(id => startPolling(id));
    });

    connection.start()
      .then(() => { modeRef.current = 'signalr'; })
      .catch(() => {
        modeRef.current = 'polling';
        watchIds.forEach(id => startPolling(id));
      });

    connRef.current = connection;

    return () => {
      connection.stop().catch(() => {});
      connRef.current = null;
      Object.values(pollRefs.current).forEach(clearInterval);
      pollRefs.current = {};
    };
    // Intentionally only run once on mount — watchIds changes are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start/stop polling when watchIds changes ───────────────────────────
  // Only used in the 'polling' fallback mode; in SignalR mode the server
  // pushes events and we don't need to poll.
  useEffect(() => {
    if (modeRef.current !== 'polling') return;
    watchIds.forEach(id => startPolling(id));
    return () => { watchIds.forEach(id => stopPolling(id)); };
  }, [watchIds, startPolling, stopPolling]);

  // ── Public: start polling a specific bet ID immediately ───────────────
  // Used right after placing a bet when SignalR might not have connected yet.
  const ensureWatching = useCallback((betId) => {
    if (modeRef.current === 'signalr' && connRef.current?.state === signalR.HubConnectionState.Connected) {
      return; // SignalR is live — no need to poll
    }
    startPolling(betId);
  }, [startPolling]);

  return { ensureWatching, stopPolling };
}
