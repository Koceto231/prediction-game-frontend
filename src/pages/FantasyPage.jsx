import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';

const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

const POSITION_COLORS = {
  GK:  { bg: 'rgba(255,180,0,0.15)',  color: '#ffb400' },
  DEF: { bg: 'rgba(30,140,255,0.15)', color: '#4da6ff' },
  MID: { bg: 'rgba(89,255,147,0.15)', color: '#59ff93' },
  FWD: { bg: 'rgba(255,80,80,0.15)',  color: '#ff6060' },
};

function PositionBadge({ pos }) {
  const style = POSITION_COLORS[pos] ?? {};
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: 20, background: style.bg, color: style.color,
    }}>
      {pos}
    </span>
  );
}

export default function FantasyPage() {
  const navigate = useNavigate();

  const [gameweek, setGameweek] = useState(null);
  const [teamData, setTeamData] = useState(null);   // null = loading, false = no team
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create team form
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const gwRes = await api.get('/Fantasy/gameweek/current');
        setGameweek(gwRes.data);

        const teamRes = await api.get('/Fantasy/team');
        if (teamRes.data?.hasTeam === false || !teamRes.data?.fantasyTeamId) {
          setTeamData(false);
        } else {
          setTeamData(teamRes.data);
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          setTeamData(false);
        } else {
          setError(err?.response?.data?.message || 'Failed to load fantasy data.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/Fantasy/team', { teamName: teamName.trim() });
      const teamRes = await api.get('/Fantasy/team');
      setTeamData(teamRes.data?.hasTeam === false ? false : teamRes.data);
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="page-grid">
        <div className="shell-card panel"><div className="empty-box">Loading fantasy...</div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-grid">
        <div className="shell-card panel"><div className="alert alert-error">{error}</div></div>
      </div>
    );
  }

  // No active gameweek
  if (!gameweek) {
    return (
      <div className="page-grid">
        <div className="shell-card panel">
          <div className="empty-box">No active fantasy gameweek right now.</div>
        </div>
      </div>
    );
  }

  // No team yet — show create form
  if (teamData === false) {
    return (
      <div className="page-grid">
        <section className="shell-card panel">
          <div className="section-head">
            <div>
              <h2>⚽ Fantasy Football</h2>
              <p>Gameweek {gameweek.gameWeek} · Deadline: {new Date(gameweek.deadline).toLocaleString()}</p>
            </div>
          </div>

          <div className="fantasy-create-card">
            <div className="fantasy-create-card__icon">🏆</div>
            <h3>Create your fantasy team</h3>
            <p className="muted-text">Pick 11 players (1 GK · 3 DEF · 3 MID · 4 FWD) within a £100 budget.</p>

            <div className="fantasy-create-row">
              <input
                type="text"
                className="bet-amount-input"
                placeholder="Team name"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTeam()}
              />
              <button
                type="button"
                className="primary-button"
                disabled={!teamName.trim() || creating}
                onClick={createTeam}
              >
                {creating ? 'Creating...' : 'Create Team'}
              </button>
            </div>
            {createError && <div className="alert alert-error">{createError}</div>}
          </div>
        </section>
      </div>
    );
  }

  // Has team — show squad
  const players = [...(teamData.players ?? [])].sort(
    (a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
  );

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>⚽ {teamData.teamName}</h2>
            <p>Gameweek {teamData.gameWeek} · {teamData.isLocked ? '🔒 Locked' : '✏️ Open'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/fantasy/leaderboard" className="ghost-button">Leaderboard</Link>
            {!teamData.isLocked && (
              <Link to="/fantasy/draft" className="primary-button">Edit Squad</Link>
            )}
          </div>
        </div>

        {/* Points banner */}
        <div className="fantasy-points-banner">
          <div className="fantasy-points-banner__score">{teamData.weeklyPoints}</div>
          <div className="fantasy-points-banner__label">points this week</div>
          <div className="fantasy-points-banner__budget">
            Budget: <strong>£{Number(teamData.remainingBudget).toFixed(1)}</strong> remaining of £{Number(teamData.budget).toFixed(0)}
          </div>
        </div>

        {/* Deadline bar */}
        <div className="fantasy-deadline-bar">
          <span>Deadline: {new Date(gameweek.deadline).toLocaleString()}</span>
        </div>

        {/* Player list */}
        {players.length === 0 ? (
          <div className="empty-box">
            No players selected yet.{' '}
            <Link to="/fantasy/draft" className="link-accent">Pick your squad →</Link>
          </div>
        ) : (
          <div className="fantasy-squad">
            {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
              const posPlayers = players.filter(p => p.position === pos);
              if (!posPlayers.length) return null;
              return (
                <div key={pos} className="fantasy-squad__row">
                  <div className="fantasy-squad__pos-label">
                    <PositionBadge pos={pos} />
                  </div>
                  <div className="fantasy-squad__players">
                    {posPlayers.map(p => (
                      <div key={p.fantasyPlayerId} className={`fantasy-player-card ${p.isCaptain ? 'fantasy-player-card--captain' : ''}`}>
                        {p.isCaptain && <div className="fantasy-player-card__captain">C</div>}
                        <div className="fantasy-player-card__name">{p.name}</div>
                        <div className="fantasy-player-card__club">{p.teamName}</div>
                        <div className="fantasy-player-card__pts">{p.points} pts</div>
                        <div className="fantasy-player-card__price">£{Number(p.price).toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
