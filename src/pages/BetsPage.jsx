import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const STATUS_LABELS = {
  0: { label: 'Pending', cls: 'bet-status--pending' },
  1: { label: 'Won', cls: 'bet-status--won' },
  2: { label: 'Lost', cls: 'bet-status--lost' },
  3: { label: 'Void', cls: 'bet-status--void' },
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

  const totalWon = bets.filter(b => b.status === 1).reduce((s, b) => s + (b.actualPayout ?? 0), 0);
  const totalStaked = bets.reduce((s, b) => s + b.amount, 0);

  if (loading) return <div className="page-grid"><div className="shell-card panel"><h2>Loading bets...</h2></div></div>;

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
              <strong>{Number(totalStaked).toLocaleString()} 🪙</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Total Won</span>
              <strong>{Number(totalWon).toLocaleString()} 🪙</strong>
            </div>
          </div>
        )}

        {bets.length === 0 && !error && (
          <div className="empty-box">No bets yet. Head to Matches to place your first bet!</div>
        )}

        <div className="bets-list">
          {bets.map(bet => {
            const status = STATUS_LABELS[bet.status] ?? { label: 'Unknown', cls: '' };
            return (
              <div key={bet.id} className="bet-card shell-card">
                <div className="bet-card__header">
                  <span className="bet-card__fixture">
                    {bet.homeTeam} vs {bet.awayTeam}
                  </span>
                  <span className={`bet-status ${status.cls}`}>{status.label}</span>
                </div>

                <div className="bet-card__date">
                  {new Date(bet.matchDate).toLocaleDateString()} · Placed {new Date(bet.createdAt).toLocaleDateString()}
                </div>

                <div className="bet-card__details">
                  <div className="bet-card__pick">
                    Pick: <strong>{bet.betDescription}</strong>
                  </div>
                  <div>Odds: <strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong></div>
                  <div>Stake: <strong>{Number(bet.amount).toLocaleString()} 🪙</strong></div>
                  <div>
                    {bet.status === 1
                      ? <>Payout: <strong className="text-won">{Number(bet.actualPayout).toLocaleString()} 🪙</strong></>
                      : <>Potential: <strong>{Number(bet.potentialPayout).toLocaleString()} 🪙</strong></>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
