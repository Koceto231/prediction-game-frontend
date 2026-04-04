import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

export default function LeaguePage() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/League/${leagueId}/leaderboard`);
        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load leaderboard.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [leagueId]);

  const topThree = useMemo(() => rows.slice(0, 3), [rows]);

  const currentUserRow = useMemo(() => {
    return rows.find(
      (row) =>
        Number(row.userId) === Number(user?.id) ||
        row.username === user?.username
    );
  }, [rows, user]);

  const getMedal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="league-page">
      <section className="shell-card panel league-hero">
        <div className="league-hero__content">
          <div>
            <div className="hero-chip">Private League</div>
            <h1>League Standings</h1>
            <p>Track rankings, top performers, and your current position.</p>
          </div>

          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              onClick={() => navigate('/leagues')}
            >
              ← Back to Leagues
            </button>
          </div>
        </div>

        {currentUserRow && (
          <div className="league-summary">
            <div className="summary-card summary-card--accent">
              <span className="summary-label">Your Rank</span>
              <strong>{currentUserRow.rank}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Your Points</span>
              <strong>{currentUserRow.totalPoints}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Correct Results</span>
              <strong>{currentUserRow.correctResults}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Predictions</span>
              <strong>{currentUserRow.totalPredictions}</strong>
            </div>
          </div>
        )}
      </section>

      {loading && (
        <section className="shell-card panel">
          <div className="empty-box">Loading leaderboard...</div>
        </section>
      )}

      {error && (
        <section className="shell-card panel">
          <div className="alert alert-error">{error}</div>
        </section>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <section className="shell-card panel">
            <div className="section-head">
              <div>
                <h2>Top 3</h2>
                <p>The strongest performers in this league.</p>
              </div>
            </div>

            <div className="podium-grid">
              {topThree.map((player) => {
                const isCurrentUser =
                  Number(player.userId) === Number(user?.id) ||
                  player.username === user?.username;

                return (
                  <article
                    key={player.userId}
                    className={`podium-card podium-card--${player.rank} ${
                      isCurrentUser ? 'podium-card--current' : ''
                    }`}
                  >
                    <div className="podium-card__glow" />
                    <div className="podium-medal">{getMedal(player.rank)}</div>
                    <div className="podium-rank">Rank #{player.rank}</div>
                    <h3 className="podium-name">
                      {player.username}
                      {isCurrentUser ? ' (You)' : ''}
                    </h3>

                    <div className="podium-stats">
                      <div className="podium-stat">
                        <span>Points</span>
                        <strong>{player.totalPoints}</strong>
                      </div>
                      <div className="podium-stat">
                        <span>Correct</span>
                        <strong>{player.correctResults}</strong>
                      </div>
                      <div className="podium-stat">
                        <span>Predictions</span>
                        <strong>{player.totalPredictions}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="shell-card panel">
            <div className="section-head">
              <div>
                <h2>Full Standings</h2>
                <p>Complete league ranking.</p>
              </div>
            </div>

            <div className="modern-table">
              <div className="modern-table__row modern-table__head">
                <span>Rank</span>
                <span>User</span>
                <span>Points</span>
                <span>Correct</span>
                <span>Predictions</span>
              </div>

              {rows.map((row) => {
                const isCurrentUser =
                  Number(row.userId) === Number(user?.id) ||
                  row.username === user?.username;

                return (
                  <div
                    key={row.userId}
                    className={`modern-table__row ${
                      isCurrentUser ? 'modern-table__row--current' : ''
                    }`}
                  >
                    <div className="modern-table__rank">
                      <span className="rank-pill">{getMedal(row.rank)}</span>
                    </div>

                    <div className="modern-table__user">
                      <div className="modern-table__username">
                        {row.username}
                        {isCurrentUser ? ' (You)' : ''}
                      </div>

                      <div className="modern-table__mobile-stats">
                        <span>{row.totalPoints} pts</span>
                        <span>{row.correctResults} correct</span>
                        <span>{row.totalPredictions} preds</span>
                      </div>
                    </div>

                    <div className="modern-table__points">{row.totalPoints}</div>
                    <div className="modern-table__correct">{row.correctResults}</div>
                    <div className="modern-table__predictions">{row.totalPredictions}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {!loading && !error && rows.length === 0 && (
        <section className="shell-card panel">
          <div className="empty-box">No leaderboard data available yet.</div>
        </section>
      )}
    </div>
  );
}