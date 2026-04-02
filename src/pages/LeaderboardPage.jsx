import { useEffect, useState } from 'react';
import api from '../api/apiClient';

export default function LeaderboardPage() {
  const [rows, setRows] = useState([]);
  // FIX: Added loading and error states — original showed nothing while loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false; // FIX: Prevent state update on unmounted component

    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/Leaderboard');
        if (!cancelled) setRows(response.data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load leaderboard.');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLeaderboard();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="shell-card panel">
      <div className="section-head">
        <div>
          <h2>Leaderboard</h2>
          <p>Current ranking by total points.</p>
        </div>
      </div>

      {loading && <div className="empty-box">Loading leaderboard...</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="empty-box">No predictions yet.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="leaderboard-table">
          <div className="leaderboard-row leaderboard-head">
            <span>#</span>
            <span>Username</span>
            <span>Points</span>
            <span>Correct</span>
          </div>

          {rows.map((row, index) => (
            <div className="leaderboard-row" key={row.userId}>
              <span>{index + 1}</span>
              <span>{row.username}</span>
              <span>{row.totalPoints}</span>
              <span>{row.correctResults}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}