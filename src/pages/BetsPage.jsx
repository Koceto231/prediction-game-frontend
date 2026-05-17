import { useEffect, useState, useRef } from 'react';
import api from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

const STATUS_LABELS = {
  Pending:   { label: 'Pending',     cls: 'bet-status--pending'  },
  Won:       { label: 'Won ✅',      cls: 'bet-status--won'      },
  Lost:      { label: 'Lost ❌',     cls: 'bet-status--lost'     },
  Void:      { label: 'Void',        cls: 'bet-status--void'     },
  CashedOut: { label: 'Cashed Out 💰', cls: 'bet-status--cashed' },
};

// ── Cash-Out badge — polls live value, opens confirm modal ────────────────
function CashOutBadge({ bet, onCashedOut }) {
  const [quote, setQuote]     = useState(null);    // { eligible, value, reason, originalStake, ... }
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { refreshBalance }    = useWallet();

  // Poll cash-out value every 5s
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

  const value     = Number(quote.value);
  const stake     = Number(bet.amount);
  const profit    = value - stake;
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
        className={`cashout-badge ${colorClass}`}
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
              <div className="cashout-modal__big">
                <span>Cash out for</span>
                <strong className={colorClass}>€{value.toFixed(2)}</strong>
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

const BET_TYPE_LABELS = {
  Winner:       '1/X/2',
  ExactScore:   'Exact Score',
  BTTS:         'BTTS',
  OverUnder:    'Over/Under',
  DoubleChance: 'Double Chance',
  Corners:      'Corners',
  YellowCards:  'Yellow Cards',
  Goalscorer:   'Goalscorer',
  Accumulator:  'Accumulator',
};

export default function BetsPage() {
  const [bets, setBets]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadBets = () => {
    api.get('/Bet/me')
      .then(r => setBets(r.data))
      .catch(() => setError('Failed to load bets.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBets(); }, []);

  // Called after a successful cash-out — flips local state so the card moves out of Pending
  const handleCashedOut = (betId) => {
    setBets(prev => prev.map(b => b.id === betId ? { ...b, status: 'CashedOut' } : b));
  };

  const pendingBets    = bets.filter(b => b.status === 'Pending');
  const totalStaked    = pendingBets.reduce((s, b) => s + b.amount, 0);
  const totalPotential = pendingBets.reduce((s, b) => s + (b.potentialPayout ?? 0), 0);

  if (loading) return (
    <div className="page-grid">
      <div className="shell-card panel"><div className="empty-box">Loading bets...</div></div>
    </div>
  );

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>My Bets</h2>
            <p>Your active bets on upcoming matches.</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {pendingBets.length > 0 && (
          <div className="bets-summary">
            <div className="shell-card profile-stat-card">
              <span>Active Bets</span>
              <strong>{pendingBets.length}</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Total Staked</span>
              <strong>{Number(totalStaked).toLocaleString()} €</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Potential Win</span>
              <strong style={{ color: 'var(--accent)' }}>{Number(totalPotential).toFixed(2)} €</strong>
            </div>
          </div>
        )}

        {pendingBets.length === 0 && !error && (
          <div className="empty-box">No active bets. Head to Matches to place your first bet!</div>
        )}

        <div className="bets-list">
          {pendingBets.map(bet => {
            const typeLabel  = BET_TYPE_LABELS[bet.betType] ?? bet.betType;
            const maxPts     = bet.maxPoints ?? 0;
            const isAccum    = bet.betType === 'Accumulator';
            const legs       = bet.accumulatorLegs ?? [];
            const isExpanded = expandedId === bet.id;
            const statusInfo = STATUS_LABELS[bet.status] ?? { label: bet.status, cls: '' };

            const displayLegs = isAccum ? legs : [{
              description: bet.betDescription,
              betType:     bet.betType,
              odds:        bet.oddsAtBetTime,
            }];

            return (
              <div key={bet.id}
                className="bet-card shell-card bet-card--expandable"
                onClick={() => setExpandedId(isExpanded ? null : bet.id)}>

                <div className="bet-card__header">
                  <div>
                    <span className="bet-card__fixture">{bet.homeTeam} vs {bet.awayTeam}</span>
                    <span className="bet-card__type-badge">{typeLabel}</span>
                    {isAccum && <span className="bet-card__type-badge" style={{ marginLeft: 4 }}>{legs.length} legs</span>}
                  </div>
                  <span className={`bet-status ${statusInfo.cls}`}>{statusInfo.label}</span>
                  <span className={`bet-card__chevron ${isExpanded ? 'bet-card__chevron--open' : ''}`}>▼</span>
                </div>

                <div className="bet-card__date">
                  {new Date(bet.matchDate).toLocaleDateString()} · Placed {new Date(bet.createdAt).toLocaleDateString()}
                </div>

                <div className="bet-card__details">
                  <div className="bet-card__pick">Pick: <strong>{bet.betDescription}</strong></div>
                  <div>Odds: <strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong></div>
                  <div>Stake: <strong>{Number(bet.amount).toLocaleString()} €</strong></div>
                  <div>Potential: <strong style={{ color: 'var(--accent)' }}>{Number(bet.potentialPayout).toFixed(2)} €</strong></div>
                </div>

                <CashOutBadge bet={bet} onCashedOut={handleCashedOut} />

                {isExpanded && (
                  <div className="bet-card__legs">
                    {displayLegs.map((leg, i) => (
                      <div key={i} className="bet-card__leg">
                        <span className="bet-card__leg-desc">{leg.description}</span>
                        <span className="bet-card__leg-type">{BET_TYPE_LABELS[leg.betType] ?? leg.betType}</span>
                        <span className="bet-card__leg-odds">× {Number(leg.odds).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {maxPts > 0 && (
                  <div className="bet-card__points">
                    <span className="bet-card__points-label">POINTS</span>
                    <span className="bet-card__points-value">
                      <span className="muted-text">0</span> / <strong>{maxPts} pts</strong> possible
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
