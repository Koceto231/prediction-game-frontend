import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const STATUS_LABELS = {
  Pending: { label: 'Pending', cls: 'bet-status--pending' },
  Won:     { label: 'Won ✅',  cls: 'bet-status--won'     },
  Lost:    { label: 'Lost ❌', cls: 'bet-status--lost'    },
  Void:    { label: 'Void',    cls: 'bet-status--void'    },
};

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
  const [bets, setBets]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.get('/Bet/me')
      .then(r => setBets(r.data))
      .catch(() => setError('Failed to load bets.'))
      .finally(() => setLoading(false));
  }, []);

  const [tab, setTab] = useState('pending');

  const pendingBets  = bets.filter(b => b.status === 'Pending');
  const settledBets  = bets.filter(b => b.status !== 'Pending');
  const displayBets  = tab === 'pending' ? pendingBets : settledBets;

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

        {/* Tabs */}
        <div className="fantasy-view-toggle" style={{ marginBottom: 16 }}>
          <button type="button"
            className={`fantasy-view-btn${tab === 'pending' ? ' fantasy-view-btn--active' : ''}`}
            onClick={() => setTab('pending')}>
            ⏳ Active ({pendingBets.length})
          </button>
          <button type="button"
            className={`fantasy-view-btn${tab === 'history' ? ' fantasy-view-btn--active' : ''}`}
            onClick={() => setTab('history')}>
            📋 History ({settledBets.length})
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {tab === 'pending' && pendingBets.length > 0 && (
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

        {tab === 'pending' && pendingBets.length === 0 && !error && (
          <div className="empty-box">No active bets. Head to Matches to place your first bet!</div>
        )}
        {tab === 'history' && settledBets.length === 0 && !error && (
          <div className="empty-box">No settled bets yet.</div>
        )}

        <div className="bets-list">
          {displayBets.map(bet => {
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
                  {bet.status === 'Pending'
                    ? <div>Potential: <strong>{Number(bet.potentialPayout).toFixed(2)} €</strong></div>
                    : <div>Payout: <strong style={{ color: bet.status === 'Won' ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {bet.actualPayout ? `${Number(bet.actualPayout).toFixed(2)} €` : '—'}
                      </strong></div>
                  }
                  {tab === 'history' && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: #{bet.id}</div>
                  )}
                </div>

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
