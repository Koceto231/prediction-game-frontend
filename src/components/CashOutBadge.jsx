import { useEffect, useState } from 'react';
import api from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

/**
 * Live polling Cash-Out button + confirmation modal for a single Pending bet.
 *
 * Props:
 *   bet          — the bet object (needs id, amount, oddsAtBetTime, potentialPayout, betDescription)
 *   onCashedOut  — optional callback (betId, result) → caller updates local state
 *   compact      — boolean, if true renders a smaller variant for the live page
 */
export default function CashOutBadge({ bet, onCashedOut, compact = false, lock = null }) {
  const [quote, setQuote]     = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { refreshBalance }    = useWallet();

  // Cash-out value only changes while the underlying match is live (odds
  // move). Even then a 5s tick was 10–20× more than humans care about.
  //
  // Backend-friendly schedule:
  //   • Fetch once on mount.
  //   • Refresh every 15s while the tab is VISIBLE.
  //   • Pause completely when the tab is hidden (saves ~70 % of req/min in
  //     practice — users tab-switch all the time).
  //   • Stop polling once the badge becomes ineligible (game over / paused
  //     by backend) — there's nothing left to update.
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const fetchOnce = () => {
      if (document.hidden) return;
      api.get(`/Bet/${bet.id}/cash-out-value`)
        .then(r => {
          if (cancelled) return;
          setQuote(r.data);
          // Backend says it's no longer eligible → kill the timer entirely
          if (r.data && r.data.eligible === false && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        })
        .catch(() => {});
    };

    fetchOnce();
    intervalId = setInterval(fetchOnce, 15_000);

    // Refresh immediately when the tab is re-shown so a returning user
    // doesn't see a stale price.
    const onVisibility = () => { if (!document.hidden) fetchOnce(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [bet.id]);

  if (!quote || !quote.eligible) return null;

  const value      = Number(quote.value);
  const stake      = Number(bet.amount);
  const profit     = value - stake;
  const colorClass = profit > 0.01 ? 'cashout-badge--profit'
                   : profit < -0.01 ? 'cashout-badge--loss'
                   : 'cashout-badge--even';

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      const r = await api.post(`/Bet/${bet.id}/cash-out`, { expectedValue: value });
      await refreshBalance();
      setConfirm(false);
      onCashedOut?.(bet.id, r.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Cash-out failed.');
    } finally { setLoading(false); }
  };

  const locked = !!lock;
  return (
    <>
      <button
        type="button"
        className={`cashout-badge ${colorClass}${compact ? ' cashout-badge--compact' : ''}${locked ? ' cashout-badge--locked' : ''}`}
        onClick={(e) => { e.stopPropagation(); if (!locked) setConfirm(true); }}
        disabled={locked}
        title={locked ? lock.reason : ''}
        style={locked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
      >
        <span className="cashout-badge__label">{locked ? `🔒 ${lock.reason}` : '💰 Cash Out'}</span>
        {!locked && <span className="cashout-badge__value">€{value.toFixed(2)}</span>}
        {!locked && profit !== 0 && (
          <span className="cashout-badge__delta">
            {profit > 0 ? '+' : ''}{profit.toFixed(2)} €
          </span>
        )}
      </button>

      {confirm && (
        <div className="cashout-modal-overlay" onClick={() => !loading && setConfirm(false)}>
          <div className="cashout-modal" onClick={e => e.stopPropagation()}>
            <div className="cashout-modal__header">
              <h3>Cash Out Confirmation</h3>
              <button type="button" className="cashout-modal__close"
                onClick={() => !loading && setConfirm(false)}>×</button>
            </div>
            <div className="cashout-modal__body">
              <div className="cashout-modal__row">
                <span>Pick</span>
                <strong>{bet.betDescription}</strong>
              </div>
              <div className="cashout-modal__row">
                <span>Stake</span>
                <strong>€{stake.toFixed(2)}</strong>
              </div>
              <div className="cashout-modal__row">
                <span>Original Odds</span>
                <strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong>
              </div>
              <div className="cashout-modal__row">
                <span>Potential Payout</span>
                <strong>€{Number(bet.potentialPayout).toFixed(2)}</strong>
              </div>
              <div className={`cashout-modal__big ${colorClass}`}>
                <span>Cash out for</span>
                <strong>€{value.toFixed(2)}</strong>
                <span className={`cashout-modal__delta ${colorClass}`}>
                  {profit >= 0 ? `+€${profit.toFixed(2)} profit` : `−€${Math.abs(profit).toFixed(2)} loss recovered`}
                </span>
              </div>
              {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
            </div>
            <div className="cashout-modal__footer">
              <button type="button" className="cashout-modal__btn cashout-modal__btn--secondary"
                disabled={loading} onClick={() => setConfirm(false)}>Cancel</button>
              <button type="button" className="cashout-modal__btn cashout-modal__btn--primary"
                disabled={loading} onClick={handleConfirm}>
                {loading ? 'Processing…' : 'Confirm Cash Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
