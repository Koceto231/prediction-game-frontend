import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/apiClient';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function FantasyLeaderboardPage() {
  const [data, setData]       = useState(null); // { gameweek, leaderboard }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/Fantasy/leaderboard/current')
      .then(r => setData(r.data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load leaderboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-grid">
      <div className="shell-card panel"><div className="empty-box">Loading leaderboard...</div></div>
    </div>
  );

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>🏆 Fantasy Leaderboard</h2>
            {data?.gameweek && (
              <p>Gameweek {data.gameweek.gameWeek}</p>
            )}
          </div>
          <Link to="/fantasy" className="ghost-button">My Team</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!error && data?.leaderboard?.length === 0 && (
          <div className="empty-box">No scores yet for this gameweek.</div>
        )}

        {data?.leaderboard?.length > 0 && (
          <div className="fantasy-leaderboard">
            {/* Header */}
            <div className="fantasy-lb-header">
              <span style={{ width: 40 }}>#</span>
              <span style={{ flex: 1 }}>Team</span>
              <span style={{ width: 80, textAlign: 'right' }}>Points</span>
            </div>

            {data.leaderboard.map(row => (
              <div key={row.userId} className={`fantasy-lb-row ${row.rank <= 3 ? 'fantasy-lb-row--top' : ''}`}>
                <span className="fantasy-lb-row__rank">
                  {MEDAL[row.rank] ?? row.rank}
                </span>
                <div className="fantasy-lb-row__info">
                  <span className="fantasy-lb-row__team">{row.fantasyTeamName}</span>
                  <span className="fantasy-lb-row__user">{row.username}</span>
                </div>
                <span className="fantasy-lb-row__pts">{row.weeklyPoints}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
