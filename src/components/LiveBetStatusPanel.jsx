import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import api from '../api/apiClient';

/**
 * Shown inside the Bet Slip after a live bet is placed and enters the
 * 15-second acceptance queue (Status = "Queued").
 *
 * States:
 *   queued     — counting down, Cancel button visible
 *   accepted   — green flash, auto-dismisses after 2.5s
 *   rejected   — red banner with reason
 *   new-odds   — odds changed, "Accept X.XX?" button with 8s expiry countdown
 *   cancelled  — user cancelled, brief confirmation then dismiss
 *   expired    — ExpiresAt passed with no update (failsafe)
 */
const LiveBetStatusPanel = forwardRef(function LiveBetStatusPanel({ bet, onDismiss }, ref) {
  const { id, expiresAt, odds, fixture } = bet;

  // Seconds remaining until ExpiresAt
  const [secsLeft,     setSecsLeft]     = useState(() => calcSecsLeft(expiresAt));
  const [phase,        setPhase]        = useState('queued'); // queued|accepted|rejected|new-odds|cancelled|expired
  const [rejReason,    setRejReason]    = useState('');
  const [newOdds,      setNewOdds]      = useState(null);
  const [newOddsExpiry, setNewOddsExpiry] = useState(null);
  const [newOddsLeft,  setNewOddsLeft]  = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,  setActionError]  = useState('');

  const tickRef    = useRef(null);
  const dismissRef = useRef(null);
  const newTickRef = useRef(null);

  // ── Expose handlers for the parent (BetSlipPanel) to call ─────────────
  // Parent calls these when SignalR/poll events arrive.
  const handleAccepted = useCallback(() => {
    clearInterval(tickRef.current);
    setPhase('accepted');
    dismissRef.current = setTimeout(() => onDismiss?.(id), 2500);
  }, [id, onDismiss]);

  const handleRejected = useCallback(({ reason, offeredOdds, offeredOddsExpiry }) => {
    clearInterval(tickRef.current);
    if (offeredOdds) {
      setNewOdds(offeredOdds);
      setNewOddsExpiry(offeredOddsExpiry ? new Date(offeredOddsExpiry) : null);
      setNewOddsLeft(offeredOddsExpiry ? calcSecsLeft(offeredOddsExpiry) : 8);
      setPhase('new-odds');
    } else {
      setRejReason(reason || 'Залогът е отхвърлен.');
      setPhase('rejected');
      dismissRef.current = setTimeout(() => onDismiss?.(id), 6000);
    }
  }, [id, onDismiss]);

  const handleCancelled = useCallback(() => {
    clearInterval(tickRef.current);
    setPhase('cancelled');
    dismissRef.current = setTimeout(() => onDismiss?.(id), 2000);
  }, [id, onDismiss]);

  // Expose handlers to parent via ref so BetSlipPanel can forward SignalR events
  useImperativeHandle(ref, () => ({ handleAccepted, handleRejected, handleCancelled }),
    [handleAccepted, handleRejected, handleCancelled]);

  // ── Countdown tick ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'queued') return;
    tickRef.current = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) {
          clearInterval(tickRef.current);
          // If still queued after expiry, show "expired" failsafe
          setPhase(p => p === 'queued' ? 'expired' : p);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [phase]);

  // ── New-odds offer countdown tick ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'new-odds') return;
    newTickRef.current = setInterval(() => {
      setNewOddsLeft(s => {
        if (s <= 1) {
          clearInterval(newTickRef.current);
          setPhase('rejected');
          setRejReason('Прозорецът за приемане на новите коефициенти изтече.');
          dismissRef.current = setTimeout(() => onDismiss?.(id), 5000);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(newTickRef.current);
  }, [phase, id, onDismiss]);

  // ── Cleanup ────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(tickRef.current);
      clearInterval(newTickRef.current);
      clearTimeout(dismissRef.current);
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    setActionLoading(true); setActionError('');
    try {
      await api.delete(`/Bet/${id}`);
      handleCancelled();
    } catch (e) {
      setActionError(e?.response?.data?.message || 'Грешка при отказ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptNewOdds = async () => {
    setActionLoading(true); setActionError('');
    try {
      await api.post(`/Bet/${id}/accept-new-odds`);
      clearInterval(newTickRef.current);
      handleAccepted();
    } catch (e) {
      setActionError(e?.response?.data?.message || 'Грешка при приемане на коефициента.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Progress bar width (0→100%) ────────────────────────────────────────
  const totalSecs = calcSecsLeft(expiresAt) > 0
    ? Math.max(15, calcSecsLeft(expiresAt))
    : 15;
  const barPct = phase === 'queued' ? Math.round((secsLeft / totalSecs) * 100) : 0;

  return (
    <div className={`lbsp lbsp--${phase}`}>
      {/* Header */}
      <div className="lbsp__header">
        <span className="lbsp__pulse" />
        <span className="lbsp__title">
          {phase === 'queued'    && 'Залогът се обработва…'}
          {phase === 'accepted'  && '✓ Залогът е приет!'}
          {phase === 'rejected'  && '✗ Залогът е отхвърлен'}
          {phase === 'new-odds'  && '⚠ Коефициентът се промени'}
          {phase === 'cancelled' && 'Залогът е анулиран'}
          {phase === 'expired'   && 'Изчакване на отговор…'}
        </span>
        {(phase === 'rejected' || phase === 'cancelled' || phase === 'accepted') && (
          <button className="lbsp__close" onClick={() => onDismiss?.(id)} aria-label="Затвори">×</button>
        )}
      </div>

      {/* Fixture */}
      <div className="lbsp__fixture">{fixture}</div>

      {/* ── QUEUED phase: countdown bar + cancel ── */}
      {phase === 'queued' && (
        <>
          <div className="lbsp__countdown">
            <div className="lbsp__countdown-track">
              <div className="lbsp__countdown-fill" style={{ width: `${barPct}%` }} />
            </div>
            <span className="lbsp__countdown-secs">{secsLeft}s</span>
          </div>
          <div className="lbsp__odds-row">
            <span className="lbsp__odds-label">Коефициент</span>
            <span className="lbsp__odds-val">{Number(odds).toFixed(2)}</span>
          </div>
          {actionError && <div className="lbsp__error">{actionError}</div>}
          <button
            className="lbsp__btn lbsp__btn--cancel"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            {actionLoading ? 'Анулиране…' : 'Анулирай залога'}
          </button>
        </>
      )}

      {/* ── ACCEPTED phase ── */}
      {phase === 'accepted' && (
        <div className="lbsp__odds-row">
          <span className="lbsp__odds-label">Заключен коефициент</span>
          <span className="lbsp__odds-val">{Number(odds).toFixed(2)}</span>
        </div>
      )}

      {/* ── REJECTED phase ── */}
      {phase === 'rejected' && (
        <div className="lbsp__reason">{rejReason}</div>
      )}

      {/* ── NEW-ODDS phase ── */}
      {phase === 'new-odds' && (
        <>
          <div className="lbsp__odds-change">
            <span className="lbsp__odds-old">{Number(odds).toFixed(2)}</span>
            <span className="lbsp__odds-arrow">→</span>
            <span className="lbsp__odds-new">{Number(newOdds).toFixed(2)}</span>
          </div>
          <div className="lbsp__countdown">
            <div className="lbsp__countdown-track lbsp__countdown-track--warn">
              <div
                className="lbsp__countdown-fill lbsp__countdown-fill--warn"
                style={{ width: `${Math.round((newOddsLeft / 8) * 100)}%` }}
              />
            </div>
            <span className="lbsp__countdown-secs">{newOddsLeft}s</span>
          </div>
          {actionError && <div className="lbsp__error">{actionError}</div>}
          <div className="lbsp__new-odds-actions">
            <button
              className="lbsp__btn lbsp__btn--accept"
              onClick={handleAcceptNewOdds}
              disabled={actionLoading}
            >
              {actionLoading ? 'Приемане…' : `Приеми ${Number(newOdds).toFixed(2)}`}
            </button>
            <button
              className="lbsp__btn lbsp__btn--cancel"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Откажи
            </button>
          </div>
        </>
      )}

      {/* ── CANCELLED phase ── */}
      {phase === 'cancelled' && (
        <div className="lbsp__reason lbsp__reason--ok">Залогът е успешно анулиран. Сумата е върната в баланса ви.</div>
      )}

      {/* ── EXPIRED phase ── */}
      {phase === 'expired' && (
        <div className="lbsp__reason">Изчакване на потвърждение от сървъра…</div>
      )}
    </div>
  );
}

});

export default LiveBetStatusPanel;

function calcSecsLeft(expiresAt) {
  if (!expiresAt) return 15;
  const diff = Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}
