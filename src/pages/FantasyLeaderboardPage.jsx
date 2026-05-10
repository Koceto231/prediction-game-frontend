import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/apiClient';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function FantasyLeaderboardPage() {
  const [gwData, setGwData]         = useState(null);   // { gameweek, leaderboard }
  const [allTime, setAllTime]       = useState(null);   // FantasyLeaderboardRowDTO[]
  const [tab, setTab]               = useState('alltime'); // 'gw' | 'alltime'
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [gwRes, atRes] = await Promise.all([
          api.get('/Fantasy/leaderboard/current').catch(() => null),
          api.get('/Fantasy/leaderboard/alltime'),
        ]);
        if (gwRes) setGwData(gwRes.data);
        setAllTime(atRes.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load leaderboard.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="page-grid">
      <div className="shell-card panel"><div className="empty-box">Loading leaderboard...</div></div>
    </div>
  );

  const rows     = tab === 'gw' ? gwData?.leaderboard : allTime;
  const gwNumber = gwData?.gameweek?.gameWeek;

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>🏆 Fantasy Leaderboard</h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {tab === 'alltime' ? 'Total Points' : `Gameweek ${gwNumber ?? '—'}`}
            </p>
          </div>
          <Link to="/fantasy" className="ghost-button">My Team</Link>
        </div>

        {/* Tabs */}
        <div className="fantasy-view-toggle" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`fantasy-view-btn${tab === 'alltime' ? ' fantasy-view-btn--active' : ''}`}
            onClick={() => setTab('alltime')}
          >
            🏅 All Time
          </button>
          <button
            type="button"
            className={`fantasy-view-btn${tab === 'gw' ? ' fantasy-view-btn--active' : ''}`}
            onClick={() => setTab('gw')}
            disabled={!gwData?.leaderboard?.length}
          >
            📅 This GW {gwNumber ? `(GW${gwNumber})` : ''}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!error && (!rows || rows.length === 0) && (
          <div className="empty-box">
            {tab === 'gw'
              ? 'No points yet for this gameweek.'
              : 'No gameweeks played yet.'}
          </div>
        )}

        {rows?.length > 0 && (
          <div className="fantasy-leaderboard">
            {/* Header */}
            <div className="fantasy-lb-header">
              <span style={{ width: 40 }}>#</span>
              <span style={{ flex: 1 }}>Team</span>
              {tab === 'alltime' ? (
                <>
                  <span style={{ width: 70, textAlign: 'right', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Last GW</span>
                  <span style={{ width: 80, textAlign: 'right' }}>Total</span>
                </>
              ) : (
                <>
                  <span style={{ width: 70, textAlign: 'right' }}>GW Pts</span>
                  <span style={{ width: 80, textAlign: 'right', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total</span>
                </>
              )}
            </div>

            {rows.map(row => (
              <div key={row.userId} className={`fantasy-lb-row ${row.rank <= 3 ? 'fantasy-lb-row--top' : ''}`}>
                <span className="fantasy-lb-row__rank">
                  {MEDAL[row.rank] ?? row.rank}
                </span>
                <div className="fantasy-lb-row__info">
                  <span className="fantasy-lb-row__team">{row.fantasyTeamName}</span>
                  <span className="fantasy-lb-row__user">{row.username}</span>
                </div>
                {tab === 'alltime' ? (
                  <>
                    <span style={{ width: 70, textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.80rem' }}>
                      {row.weeklyPoints}
                    </span>
                    <span className="fantasy-lb-row__pts">{row.totalPoints}</span>
                  </>
                ) : (
                  <>
                    <span className="fantasy-lb-row__pts">{row.weeklyPoints}</span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.80rem' }}>
                      {row.totalPoints}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
