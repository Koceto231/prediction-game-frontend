import { useEffect, useState } from 'react';
import api from '../api/apiClient';

export default function LeaderboardPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await api.get('/Leaderboard');
        setRows(response.data);
      } catch {
        setRows([]);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="shell-card panel">
      <div className="section-head">
        <div>
          <h2>Leaderboard</h2>
          <p>Current ranking by total points.</p>
        </div>
      </div>

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
    </div>
  );
}