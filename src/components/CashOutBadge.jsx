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
export default function CashOutBadge({ bet, onCashedOut, compact = false }) {
  const [quote, setQuote]     = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { refreshBalance }    = useWallet();

  useEffect(() => {
    let cancelled = false;
    const fetch = () => {
      api.get(`/Bet/${bet.id}/cash-out-value`)
        .then(r => { if (!cancelled) setQuote(r.data); })
        .catch(() => {});
    };
    fetch();
    const id = setInterval(fetch, 5_000);
    return () => { cancelled = true; clearInterval(id); };
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

  return (
    <>
      <button
        type="button"
        className={`cashout-badge ${colorClass}${compact ? ' cashout-badge--compact' : ''}`}
        onClick={(e) => { e.stopPropagation(); setConfirm(true); }}
      >
        <span className="cashout-badge__label">💰 Cash Out</span>
        <span className="cashout-badge__value">€{value.toFixed(2)}</span>
        {profit !== 0 && (
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
