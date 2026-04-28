import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient';

const POSITIONS = ['All', 'GK', 'DEF', 'MID', 'FWD'];
const REQUIRED = { GK: 1, DEF: 3, MID: 3, FWD: 4 };
const BUDGET = 100;

const POSITION_COLORS = {
  GK:  { bg: 'rgba(255,180,0,0.15)',  color: '#ffb400' },
  DEF: { bg: 'rgba(30,140,255,0.15)', color: '#4da6ff' },
  MID: { bg: 'rgba(89,255,147,0.15)', color: '#59ff93' },
  FWD: { bg: 'rgba(255,80,80,0.15)',  color: '#ff6060' },
};

function PosBadge({ pos }) {
  const s = POSITION_COLORS[pos] ?? {};
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0,
    }}>
      {pos}
    </span>
  );
}

export default function FantasyDraftPage() {
  const navigate = useNavigate();

  const [gameweek, setGameweek] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [selected, setSelected]   = useState([]); // array of player objects
  const [captain, setCaptain]      = useState(null); // player id
  const [filterPos, setFilterPos]  = useState('All');
  const [search, setSearch]        = useState('');
  const [loading, setLoading]      = useState(true);
  const [saving, setSaving]        = useState(false);
  const [error, setError]          = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pre-load players + gameweek independently so a missing gameweek doesn't block the list
  useEffect(() => {
    const load = async () => {
      // Players are always loaded — not dependent on gameweek
      try {
        const playersRes = await api.get('/Fantasy/players');
        setAllPlayers(playersRes.data);
      } catch {
        setError('Could not load players.');
      }

      // Gameweek + existing team — optional, failures are silent
      try {
        const gwRes = await api.get('/Fantasy/gameweek/current');
        setGameweek(gwRes.data);

        const teamRes = await api.get('/Fantasy/team');
        if (teamRes.data?.players?.length) {
          const existingIds = new Set(teamRes.data.players.map(p => p.fantasyPlayerId));
          const playersRes2 = await api.get('/Fantasy/players');
          const existing = playersRes2.data.filter(p => existingIds.has(p.id));
          setSelected(existing);
          const cap = teamRes.data.players.find(p => p.isCaptain);
          if (cap) setCaptain(cap.fantasyPlayerId);
        }
      } catch {
        // No active gameweek yet — that's fine, players still shown
      }

      setLoading(false);
    };
    load();
  }, []);

  // Derived state
  const spent   = selected.reduce((s, p) => s + Number(p.price), 0);
  const remaining = BUDGET - spent;
  const counts  = useMemo(() => {
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    selected.forEach(p => { if (p.position in c) c[p.position]++; });
    return c;
  }, [selected]);
  const isComplete = selected.length === 11
    && counts.GK === 1 && counts.DEF === 3 && counts.MID === 3 && counts.FWD === 4
    && captain != null;

  const selectedIds = useMemo(() => new Set(selected.map(p => p.id)), [selected]);

  const filtered = useMemo(() => {
    return allPlayers.filter(p => {
      if (filterPos !== 'All' && p.position !== filterPos) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())
          && !p.teamName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allPlayers, filterPos, search]);

  const canAdd = (player) => {
    if (selectedIds.has(player.id)) return false;
    if (selected.length >= 11) return false;
    if (counts[player.position] >= REQUIRED[player.position]) return false;
    if (selected.filter(p => p.teamId === player.teamId).length >= 3) return false;
    if (remaining < Number(player.price)) return false;
    return true;
  };

  const togglePlayer = (player) => {
    if (selectedIds.has(player.id)) {
      setSelected(prev => prev.filter(p => p.id !== player.id));
      if (captain === player.id) setCaptain(null);
    } else {
      if (canAdd(player)) setSelected(prev => [...prev, player]);
    }
  };

  const setCaptainPlayer = (playerId, e) => {
    e.stopPropagation();
    setCaptain(prev => prev === playerId ? null : playerId);
  };

  const saveSelection = async () => {
    if (!isComplete || !gameweek) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/Fantasy/selection', {
        fantasyGameweekId: gameweek.id,
        selectedPlayerIds: selected.map(p => p.id),
        captainPlayerId: captain,
      });
      setSuccessMsg('Squad saved! ✅');
      setTimeout(() => navigate('/fantasy'), 1200);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save selection.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="page-grid">
      <div className="shell-card panel"><div className="empty-box">Loading players...</div></div>
    </div>
  );

  return (
    <div className="page-grid">
      {/* ── Left: available players ── */}
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>📋 Pick Your Squad</h2>
            <p>1 GK · 3 DEF · 3 MID · 4 FWD — Budget: £{BUDGET}</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {POSITIONS.map(pos => (
            <button
              key={pos}
              type="button"
              className={`bet-type-tab ${filterPos === pos ? 'bet-type-tab--active' : ''}`}
              onClick={() => setFilterPos(pos)}
            >
              {pos}
            </button>
          ))}
          <input
            type="text"
            className="bet-amount-input"
            placeholder="Search player / club..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
        </div>

        {/* Player list */}
        <div className="fantasy-player-list">
          {filtered.map(player => {
            const isSelected = selectedIds.has(player.id);
            const addable    = canAdd(player);
            return (
              <div
                key={player.id}
                className={`fantasy-list-row ${isSelected ? 'fantasy-list-row--selected' : ''} ${!isSelected && !addable ? 'fantasy-list-row--disabled' : ''}`}
                onClick={() => togglePlayer(player)}
              >
                <PosBadge pos={player.position} />
                <div className="fantasy-list-row__info">
                  <span className="fantasy-list-row__name">{player.name}</span>
                  <span className="fantasy-list-row__club">{player.teamName}</span>
                </div>
                <span className="fantasy-list-row__price">£{Number(player.price).toFixed(1)}</span>
                <span className={`fantasy-list-row__btn ${isSelected ? 'fantasy-list-row__btn--remove' : ''}`}>
                  {isSelected ? '−' : '+'}
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-box">No players match your filter.</div>
          )}
        </div>
      </section>

      {/* ── Right: selected squad ── */}
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Your XI</h2>
            <p>{selected.length}/11 selected</p>
          </div>
        </div>

        {/* Budget bar */}
        <div className="fantasy-budget-bar">
          <div className="fantasy-budget-bar__label">
            <span>Budget</span>
            <span style={{ color: remaining < 0 ? '#ff6060' : 'var(--accent)' }}>
              £{remaining.toFixed(1)} left
            </span>
          </div>
          <div className="fantasy-budget-bar__track">
            <div
              className="fantasy-budget-bar__fill"
              style={{
                width: `${Math.min((spent / BUDGET) * 100, 100)}%`,
                background: remaining < 0 ? '#ff6060' : 'var(--accent)',
              }}
            />
          </div>
          <div className="fantasy-budget-bar__detail">
            £{spent.toFixed(1)} of £{BUDGET} used
          </div>
        </div>

        {/* Formation counters */}
        <div className="fantasy-formation-row">
          {Object.entries(REQUIRED).map(([pos, req]) => (
            <div key={pos} className={`fantasy-formation-slot ${counts[pos] === req ? 'fantasy-formation-slot--done' : ''}`}>
              <PosBadge pos={pos} />
              <span>{counts[pos]}/{req}</span>
            </div>
          ))}
        </div>

        {/* Selected players by position */}
        {selected.length === 0 && (
          <div className="empty-box" style={{ marginTop: 12 }}>Add players from the list.</div>
        )}

        {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
          const group = selected.filter(p => p.position === pos);
          if (!group.length) return null;
          return (
            <div key={pos} style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>{pos}</div>
              {group.map(p => (
                <div
                  key={p.id}
                  className={`fantasy-selected-row ${captain === p.id ? 'fantasy-selected-row--captain' : ''}`}
                >
                  <span className="fantasy-selected-row__name">{p.name}</span>
                  <span className="fantasy-selected-row__club">{p.teamName}</span>
                  <span className="fantasy-selected-row__price">£{Number(p.price).toFixed(1)}</span>
                  <button
                    type="button"
                    className={`fantasy-captain-btn ${captain === p.id ? 'fantasy-captain-btn--active' : ''}`}
                    onClick={e => setCaptainPlayer(p.id, e)}
                    title="Set as captain (2x points)"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    className="fantasy-remove-btn"
                    onClick={e => { e.stopPropagation(); togglePlayer(p); }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          );
        })}

        {!isComplete && selected.length === 11 && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {captain == null ? 'Please select a captain.' : 'Invalid formation.'}
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
        {successMsg && <div className="alert alert-info" style={{ marginTop: 12 }}>{successMsg}</div>}

        <button
          type="button"
          className="primary-button"
          style={{ marginTop: 16 }}
          disabled={!isComplete || saving}
          onClick={saveSelection}
        >
          {saving ? 'Saving...' : 'Save Squad'}
        </button>

        {captain != null && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
            👑 Captain: <strong style={{ color: 'var(--accent)' }}>
              {selected.find(p => p.id === captain)?.name}
            </strong> (2× points)
          </div>
        )}
      </section>
    </div>
  );
}
