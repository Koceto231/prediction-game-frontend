import { useEffect, useState } from 'react';
import api from '../api/apiClient';

// Backend serialises BetStatus as strings (JsonStringEnumConverter)
const STATUS_LABELS = {
  Pending: { label: 'Pending', cls: 'bet-status--pending' },
  Won:     { label: 'Won ✅',  cls: 'bet-status--won'     },
  Lost:    { label: 'Lost ❌', cls: 'bet-status--lost'    },
  Void:    { label: 'Void',    cls: 'bet-status--void'    },
};

const BET_TYPE_LABELS = {
  Winner:     '1/X/2',
  ExactScore: 'Exact Score',
  BTTS:       'BTTS',
  OverUnder:  'Over/Under',
};

export default function BetsPage() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/Bet/me')
      .then(r => setBets(r.data))
      .catch(() => setError('Failed to load bets.'))
      .finally(() => setLoading(false));
  }, []);

  const totalWon    = bets.filter(b => b.status === 'Won').reduce((s, b) => s + (b.actualPayout ?? 0), 0);
  const totalStaked = bets.reduce((s, b) => s + b.amount, 0);
  const totalPts    = bets.filter(b => b.status === 'Won').reduce((s, b) => s + (b.maxPoints ?? 0), 0);

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
            <p>History of all your placed bets.</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {bets.length > 0 && (
          <div className="bets-summary">
            <div className="shell-card profile-stat-card">
              <span>Total Bets</span>
              <strong>{bets.length}</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Total Staked</span>
              <strong>{Number(totalStaked).toLocaleString()} €</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Total Won</span>
              <strong>{Number(totalWon).toLocaleString()} €</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Points Earned</span>
              <strong>{totalPts} pts</strong>
            </div>
          </div>
        )}

        {bets.length === 0 && !error && (
          <div className="empty-box">No bets yet. Head to Matches to place your first bet!</div>
        )}

        <div className="bets-list">
          {bets.map(bet => {
            const status     = STATUS_LABELS[bet.status] ?? { label: bet.status ?? 'Pending', cls: 'bet-status--pending' };
            const typeLabel  = BET_TYPE_LABELS[bet.betType] ?? bet.betType;
            const isWon      = bet.status === 'Won';
            const isPending  = bet.status === 'Pending';
            const earnedPts  = isWon ? (bet.maxPoints ?? 0) : 0;
            const maxPts     = bet.maxPoints ?? 0;

            return (
              <div key={bet.id} className="bet-card shell-card">
                {/* Header */}
                <div className="bet-card__header">
                  <div>
                    <span className="bet-card__fixture">
                      {bet.homeTeam} vs {bet.awayTeam}
                    </span>
                    <span className="bet-card__type-badge">{typeLabel}</span>
                  </div>
                  <span className={`bet-status ${status.cls}`}>{status.label}</span>
                </div>

                <div className="bet-card__date">
                  {new Date(bet.matchDate).toLocaleDateString()} · Placed {new Date(bet.createdAt).toLocaleDateString()}
                </div>

                {/* Main details */}
                <div className="bet-card__details">
                  <div className="bet-card__pick">
                    Pick: <strong>{bet.betDescription}</strong>
                  </div>
                  <div>Odds: <strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong></div>
                  <div>Stake: <strong>{Number(bet.amount).toLocaleString()} €</strong></div>
                  <div>
                    {isWon
                      ? <>Payout: <strong className="text-won">{Number(bet.actualPayout).toLocaleString()} €</strong></>
                      : <>Potential: <strong>{Number(bet.potentialPayout).toLocaleString()} €</strong></>
                    }
                  </div>
                </div>

                {/* Points row */}
                {maxPts > 0 && (
                  <div className="bet-card__points">
                    <span className="bet-card__points-label">Points</span>
                    <span className="bet-card__points-value">
                      {isPending
                        ? <><span className="muted-text">0</span> / <strong>{maxPts} pts</strong> possible</>
                        : isWon
                          ? <strong style={{ color: 'var(--accent)' }}>+{earnedPts} pts earned</strong>
                          : <span className="muted-text">0 / {maxPts} pts</span>
                      }
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
