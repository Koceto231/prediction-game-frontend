import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';

const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

const POSITION_COLORS = {
  GK:  { bg: '#ffb400', ring: '#ffd966', text: '#1a0e00' },
  DEF: { bg: '#4da6ff', ring: '#82c2ff', text: '#001a33' },
  MID: { bg: '#59ff93', ring: '#9dffc0', text: '#002214' },
  FWD: { bg: '#ff6060', ring: '#ff9898', text: '#1a0000' },
};

// ── Avatar circle with initials ──────────────────────────────────
function PlayerAvatar({ name, position, isCaptain, points, price, small = false }) {
  const col = POSITION_COLORS[position] ?? { bg: '#aaa', ring: '#ccc', text: '#000' };
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const size = small ? 42 : 56;

  return (
    <div className="pitch-player">
      <div
        className={`pitch-avatar${isCaptain ? ' pitch-avatar--captain' : ''}`}
        style={{
          width: size, height: size,
          background: col.bg,
          boxShadow: `0 0 0 3px ${col.ring}`,
          color: col.text,
        }}
      >
        {initials}
        {isCaptain && <span className="pitch-avatar__c">C</span>}
      </div>
      <div className="pitch-player__name">{name?.split(' ').slice(-1)[0] ?? name}</div>
      {points != null && <div className="pitch-player__pts">{points} pts</div>}
    </div>
  );
}

// ── Pitch formation view ─────────────────────────────────────────
// Formation rows: FWD → MID → DEF → GK (attack at top, GK at bottom)
function PitchView({ players }) {
  const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
  players.forEach(p => { if (byPos[p.position]) byPos[p.position].push(p); });

  const rows = [
    { pos: 'FWD', label: 'Forwards'    },
    { pos: 'MID', label: 'Midfielders' },
    { pos: 'DEF', label: 'Defenders'   },
    { pos: 'GK',  label: 'Goalkeeper'  },
  ];

  return (
    <div className="fantasy-pitch">
      {/* Pitch markings */}
      <div className="fantasy-pitch__lines">
        <div className="fantasy-pitch__circle" />
        <div className="fantasy-pitch__midline" />
        <div className="fantasy-pitch__box fantasy-pitch__box--top" />
        <div className="fantasy-pitch__box fantasy-pitch__box--bottom" />
      </div>

      {rows.map(({ pos, label }) => (
        <div key={pos} className="fantasy-pitch__row">
          {byPos[pos].map(p => (
            <PlayerAvatar
              key={p.fantasyPlayerId}
              name={p.name}
              position={p.position}
              isCaptain={p.isCaptain}
              points={p.points}
              price={p.price}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function FantasyPage() {
  const navigate = useNavigate();

  const [gameweek, setGameweek] = useState(null);
  const [teamData, setTeamData] = useState(null);   // null = loading, false = no team
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pitchView, setPitchView] = useState(true); // toggle pitch / list view

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
            <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '1rem' }}>
              {teamData.teamName}
            </h2>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              GW{teamData.gameWeek} · {teamData.isLocked ? '⬛ LOCKED' : '✏️ OPEN'}
            </p>
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

        {/* View toggle */}
        {players.length > 0 && (
          <div className="fantasy-view-toggle">
            <button
              type="button"
              className={`fantasy-view-btn${pitchView ? ' fantasy-view-btn--active' : ''}`}
              onClick={() => setPitchView(true)}
            >
              ⚽ Pitch
            </button>
            <button
              type="button"
              className={`fantasy-view-btn${!pitchView ? ' fantasy-view-btn--active' : ''}`}
              onClick={() => setPitchView(false)}
            >
              📋 List
            </button>
          </div>
        )}

        {/* Player display */}
        {players.length === 0 ? (
          <div className="empty-box">
            No players selected yet.{' '}
            <Link to="/fantasy/draft" className="link-accent">Pick your squad →</Link>
          </div>
        ) : pitchView ? (
          <PitchView players={players} />
        ) : (
          /* List view */
          <div className="fantasy-squad">
            {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
              const posPlayers = players.filter(p => p.position === pos);
              if (!posPlayers.length) return null;
              return (
                <div key={pos} className="fantasy-squad__row">
                  <div className="fantasy-squad__pos-label">
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                      borderRadius: 20,
                      background: POSITION_COLORS[pos]?.bg + '26',
                      color: POSITION_COLORS[pos]?.bg,
                    }}>{pos}</span>
                  </div>
                  <div className="fantasy-squad__players">
                    {posPlayers.map(p => (
                      <div key={p.fantasyPlayerId} className={`fantasy-player-card ${p.isCaptain ? 'fantasy-player-card--captain' : ''}`}>
                        {p.isCaptain && <div className="fantasy-player-card__captain">C</div>}
                        {/* Mini avatar */}
                        <div className="fantasy-player-card__avatar" style={{
                          background: POSITION_COLORS[p.position]?.bg,
                          color: POSITION_COLORS[p.position]?.text,
                        }}>
                          {p.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
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
