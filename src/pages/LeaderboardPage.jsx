import { useEffect, useState } from 'react';
import api from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

const rankClass = (rank) => {
  if (rank === 1) return 'leaderboard-rank--gold';
  if (rank === 2) return 'leaderboard-rank--silver';
  if (rank === 3) return 'leaderboard-rank--bronze';
  return '';
};

const fmtPct = (n) => {
  const v = Number(n ?? 0);
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
};
const fmtMoney = (n) => `€${Number(n ?? 0).toFixed(2)}`;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/Leaderboard');
        if (!cancelled) setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Зареждането на класирането се провали.');
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
          <h2>Класиране</h2>
          <p>Подредени по процент печалба от заложените средства.</p>
        </div>
      </div>

      {loading && <div className="empty-box">Зарежда…</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="empty-box">Все още няма приключили залози.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="leaderboard-table">
          <div className="leaderboard-row leaderboard-head">
            <span>#</span>
            <span>Играч</span>
            <span>Печалба %</span>
          </div>

          {rows.map((row, index) => {
            const rank   = index + 1;
            const isMe   = user && row.username === user.username;
            const pctVal = Number(row.profitPercent ?? 0);
            const pctClr = pctVal > 0 ? '#27c76f' : pctVal < 0 ? '#e74c3c' : 'var(--text-muted)';

            return (
              <div
                className={`leaderboard-row ${isMe ? 'leaderboard-row--me' : ''} ${rank <= 3 ? 'leaderboard-row--top' : ''}`}
                key={row.userId}
              >
                <div className={`leaderboard-rank ${rankClass(rank)}`}>
                  {MEDAL[rank] ?? rank}
                </div>

                <div className="leaderboard-user">
                  <div className="leaderboard-name">
                    {row.username}
                    {isMe && <span className="leaderboard-you-badge">Аз</span>}
                  </div>
                  <div className="leaderboard-mobile-stats" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {row.settledBets} залога · {fmtMoney(row.totalStaked)} заложено · {fmtMoney(row.netProfit)} {pctVal >= 0 ? 'печалба' : 'загуба'}
                  </div>
                </div>

                <div className="leaderboard-points" style={{ color: pctClr, fontWeight: 800 }}>
                  {fmtPct(pctVal)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
