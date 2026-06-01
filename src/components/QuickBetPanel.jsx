import { useEffect, useState } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

/**
 * Inline 1 / X / 2 quick-bet panel. Lives at the bottom of the match-detail
 * view when no mode is selected — gives the user one-tap access to a Match
 * Result bet without going through the global slip.
 *
 * Stays a self-contained widget: own pick / amount / loading / feedback
 * state, fires POST /Bet directly, refreshes wallet on success.
 *
 * Extracted from MatchesPage.jsx where it lived as an inner function and
 * inflated the parent module to ~2 000 lines.
 */
export default function QuickBetPanel({ match, onBetPlaced }) {
  const { refreshBalance } = useWallet();
  const [pick,     setPick]     = useState('');
  const [amount,   setAmount]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Reset whenever the caller switches matches — stops a stale pick from
  // the previous fixture leaking into the next bet.
  useEffect(() => { setPick(''); setAmount(''); setFeedback(null); }, [match?.id]);

  const oddsMap  = { Home: match.homeOdds,      Draw: match.drawOdds, Away: match.awayOdds };
  const labelMap = { Home: match.homeTeamName,  Draw: 'Draw',         Away: match.awayTeamName };
  const selectedOdds = pick ? Number(oddsMap[pick]) : null;
  const stakeNum     = Number(amount);
  const potential    = selectedOdds && stakeNum > 0 ? selectedOdds * stakeNum : null;

  const place = async () => {
    if (!pick || stakeNum <= 0) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post(
        '/Bet',
        { matchId: match.id, betType: 'Winner', pick, amount: stakeNum },
        { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
      );
      await refreshBalance();
      setFeedback({ ok: true, text: 'Bet placed!' });
      setPick(''); setAmount('');
      onBetPlaced?.(match.id);
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || 'Failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quick-bet-panel">
      <div className="quick-bet-panel__title">Quick Bet — 1 / X / 2</div>
      <div className="bet-picks">
        {[
          { key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
          { key: 'Draw', label: 'Draw',             odds: match.drawOdds },
          { key: 'Away', label: match.awayTeamName, odds: match.awayOdds },
        ].map(({ key, label, odds }) => (
          <button
            key={key}
            type="button"
            className={`bet-pick-btn ${pick === key ? 'bet-pick-btn--active' : ''}`}
            onClick={() => { setPick(pick === key ? '' : key); setFeedback(null); }}
          >
            <span className="bet-pick-btn__label">{label}</span>
            <span className="bet-pick-btn__odds">{odds != null ? Number(odds).toFixed(2) : '—'}</span>
          </button>
        ))}
      </div>

      {pick && (
        <div className="bet-slip">
          <div className="bet-slip__header">
            <button
              type="button"
              className="bet-slip__remove"
              onClick={() => { setPick(''); setAmount(''); setFeedback(null); }}
            >✕</button>
            <div className="bet-slip__info">
              <span className="bet-slip__pick">{labelMap[pick]}</span>
              <span className="bet-slip__desc">
                Match Result · {match.homeTeamName} vs. {match.awayTeamName}
              </span>
            </div>
            <span className="bet-slip__odds">{selectedOdds?.toFixed(2)}</span>
          </div>

          <div className="bet-slip__stake-row">
            <div className="bet-slip__stake-wrap">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                className="bet-slip__stake-input"
                onKeyDown={(e) => e.key === 'Enter' && place()}
                autoFocus
              />
              <span className="bet-slip__stake-coin">🪙</span>
            </div>
            <div className="bet-slip__quick-adds">
              {[5, 20, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="bet-slip__quick-add"
                  onClick={() => setAmount((a) => String((Number(a) || 0) + n))}
                >+{n}</button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="bet-slip__cta"
            disabled={stakeNum <= 0 || loading}
            onClick={place}
          >
            <span>{loading ? 'Залагане...' : `Заложи ${stakeNum > 0 ? stakeNum : ''} монети`}</span>
            {potential && (
              <span className="bet-slip__cta-sub">
                Потенциална печалба: {Number(potential).toFixed(2)} монети
              </span>
            )}
          </button>
        </div>
      )}

      {feedback && (
        <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`}
          style={{ marginTop: 10 }}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}
