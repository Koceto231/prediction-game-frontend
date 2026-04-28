import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient';

const ROWS      = ['FWD', 'MID', 'DEF', 'GK'];   // top → bottom on pitch
const REQUIRED  = { GK: 1, DEF: 3, MID: 3, FWD: 4 };
const POSITIONS = ['All', 'GK', 'DEF', 'MID', 'FWD'];
const BUDGET    = 100;

const POS_COLORS = {
  GK:  { bg: 'rgba(255,180,0,0.20)',  border: '#ffb400', text: '#ffb400' },
  DEF: { bg: 'rgba(30,140,255,0.20)', border: '#4da6ff', text: '#4da6ff' },
  MID: { bg: 'rgba(89,255,147,0.20)', border: '#59ff93', text: '#59ff93' },
  FWD: { bg: 'rgba(255,80,80,0.20)',  border: '#ff6060', text: '#ff6060' },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function PosBadge({ pos }) {
  const c = POS_COLORS[pos] ?? {};
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 20, background: c.bg, color: c.text, flexShrink: 0,
    }}>
      {pos}
    </span>
  );
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Pitch avatar — shows photo or letter-initials fallback ────────────────────

function PitchAvatar({ player, isCaptain, size = 54 }) {
  const c = POS_COLORS[player.position] ?? {};
  return (
    <div
      className={`pitch-avatar${isCaptain ? ' pitch-avatar--captain' : ''}`}
      style={{
        width: size, height: size,
        background: c.bg,
        border: `2.5px solid ${c.border}`,
        overflow: 'hidden',
        color: c.text,
      }}
    >
      {player.photoUrl
        ? <img
            src={player.photoUrl}
            alt={player.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
          />
        : null}
      <span
        style={{
          display: player.photoUrl ? 'none' : 'flex',
          width: '100%', height: '100%',
          alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.29,
        }}
      >
        {initials(player.name)}
      </span>
    </div>
  );
}

// ── Empty slot button ─────────────────────────────────────────────────────────

function EmptySlot({ pos, onClick }) {
  const c = POS_COLORS[pos] ?? {};
  return (
    <div className="pitch-player" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div
        className="pitch-avatar"
        style={{
          width: 54, height: 54,
          background: 'rgba(0,0,0,0.3)',
          border: `2px dashed ${c.border}`,
          color: c.text,
          fontSize: '1.3rem',
        }}
      >
        +
      </div>
      <span className="pitch-player__name" style={{ color: c.text, opacity: 0.8 }}>{pos}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FantasyDraftPage() {
  const navigate = useNavigate();

  const [gameweek, setGameweek]   = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [selected, setSelected]   = useState([]);
  const [captain, setCaptain]     = useState(null);
  const [filterPos, setFilterPos] = useState('All');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/Fantasy/players');
        setAllPlayers(res.data ?? []);
      } catch (err) {
        const status = err?.response?.status;
        const msg    = err?.response?.data?.message || err?.message || 'Unknown error';
        setError(`Could not load players (${status ?? 'network'}: ${msg})`);
      }

      try {
        const gwRes = await api.get('/Fantasy/gameweek/current');
        setGameweek(gwRes.data);

        const teamRes = await api.get('/Fantasy/team');
        if (teamRes.data?.players?.length) {
          const existingIds = new Set(teamRes.data.players.map(p => p.fantasyPlayerId));
          const pr2 = await api.get('/Fantasy/players');
          const existing = pr2.data.filter(p => existingIds.has(p.id));
          setSelected(existing);
          const cap = teamRes.data.players.find(p => p.isCaptain);
          if (cap) setCaptain(cap.fantasyPlayerId);
        }
      } catch {
        // No active gameweek — that's fine
      }

      setLoading(false);
    };
    load();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const spent     = selected.reduce((s, p) => s + Number(p.price), 0);
  const remaining = BUDGET - spent;

  const counts = useMemo(() => {
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    selected.forEach(p => { if (p.position in c) c[p.position]++; });
    return c;
  }, [selected]);

  const isComplete = selected.length === 11
    && counts.GK === 1 && counts.DEF === 3 && counts.MID === 3 && counts.FWD === 4
    && captain != null;

  const selectedIds = useMemo(() => new Set(selected.map(p => p.id)), [selected]);

  const canAdd = (player) => {
    if (selectedIds.has(player.id)) return false;
    if (selected.length >= 11) return false;
    if (counts[player.position] >= REQUIRED[player.position]) return false;
    if (selected.filter(p => p.teamId === player.teamId).length >= 3) return false;
    if (remaining < Number(player.price)) return false;
    return true;
  };

  const filtered = useMemo(() => allPlayers.filter(p => {
    if (filterPos !== 'All' && p.position !== filterPos) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())
        && !p.teamName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allPlayers, filterPos, search]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const togglePlayer = (player) => {
    if (selectedIds.has(player.id)) {
      setSelected(prev => prev.filter(p => p.id !== player.id));
      if (captain === player.id) setCaptain(null);
    } else if (canAdd(player)) {
      setSelected(prev => [...prev, player]);
    }
  };

  const toggleCaptain = (playerId, e) => {
    e?.stopPropagation();
    setCaptain(prev => prev === playerId ? null : playerId);
  };

  const focusPosition = (pos) => setFilterPos(pos);

  const saveSelection = async () => {
    if (!isComplete || !gameweek) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/Fantasy/selection', {
        fantasyGameweekId: gameweek.id,
        selectedPlayerIds: selected.map(p => p.id),
        captainPlayerId:   captain,
      });
      setSuccessMsg('Squad saved! ✅');
      setTimeout(() => navigate('/fantasy'), 1200);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save selection.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="page-grid">
      <div className="shell-card panel"><div className="empty-box">Loading players...</div></div>
    </div>
  );

  return (
    <div className="page-grid">

      {/* ── Left: player picker ── */}
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
            const isSel  = selectedIds.has(player.id);
            const addable = canAdd(player);
            const c = POS_COLORS[player.position] ?? {};
            return (
              <div
                key={player.id}
                className={`fantasy-list-row ${isSel ? 'fantasy-list-row--selected' : ''} ${!isSel && !addable ? 'fantasy-list-row--disabled' : ''}`}
                onClick={() => togglePlayer(player)}
              >
                {/* Mini avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden', border: `2px solid ${c.border}`,
                  background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 800, color: c.text,
                }}>
                  {player.photoUrl
                    ? <img src={player.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(player.name)}
                </div>

                <PosBadge pos={player.position} />

                <div className="fantasy-list-row__info">
                  <span className="fantasy-list-row__name">{player.name}</span>
                  <span className="fantasy-list-row__club">{player.teamName}</span>
                </div>
                <span className="fantasy-list-row__price">£{Number(player.price).toFixed(1)}</span>
                <span className={`fantasy-list-row__btn ${isSel ? 'fantasy-list-row__btn--remove' : ''}`}>
                  {isSel ? '−' : '+'}
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-box">No players match your filter.</div>
          )}
        </div>
      </section>

      {/* ── Right: pitch + squad info ── */}
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

        {/* ── Pitch ── */}
        <div className="fantasy-pitch">
          {/* Decorative pitch markings */}
          <div className="fantasy-pitch__lines" aria-hidden="true">
            <div className="fantasy-pitch__midline" />
            <div className="fantasy-pitch__circle" />
            <div className="fantasy-pitch__box fantasy-pitch__box--top" />
            <div className="fantasy-pitch__box fantasy-pitch__box--bottom" />
          </div>

          {/* Rows: FWD → MID → DEF → GK */}
          {ROWS.map(pos => {
            const group = selected.filter(p => p.position === pos);
            const emptyCount = REQUIRED[pos] - group.length;
            return (
              <div key={pos} className="fantasy-pitch__row">
                {/* Filled slots */}
                {group.map(p => (
                  <div key={p.id} className="pitch-player">
                    <PitchAvatar player={p} isCaptain={captain === p.id} />
                    <span className="pitch-player__name">
                      {p.name.split(' ').slice(-1)[0]}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        style={{
                          fontSize: '0.6rem', padding: '1px 5px', borderRadius: 10,
                          cursor: 'pointer', fontWeight: 700,
                          background: captain === p.id ? '#ffd700' : 'rgba(255,215,0,0.15)',
                          border: '1px solid #ffd700',
                          color: captain === p.id ? '#1a0e00' : '#ffd700',
                        }}
                        onClick={e => toggleCaptain(p.id, e)}
                        title="Set as captain (2× points)"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        style={{
                          fontSize: '0.6rem', padding: '1px 5px', borderRadius: 10,
                          cursor: 'pointer', fontWeight: 700,
                          background: 'rgba(255,80,80,0.15)',
                          border: '1px solid #ff6060', color: '#ff6060',
                        }}
                        onClick={() => togglePlayer(p)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: emptyCount }).map((_, i) => (
                  <EmptySlot key={`empty-${pos}-${i}`} pos={pos} onClick={() => focusPosition(pos)} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Captain display */}
        {captain != null && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 10 }}>
            👑 Captain:{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {selected.find(p => p.id === captain)?.name}
            </strong>{' '}
            (2× points)
          </div>
        )}

        {/* Validation messages */}
        {!isComplete && selected.length === 11 && (
          <div className="alert alert-error" style={{ marginTop: 10 }}>
            {captain == null ? 'Please select a captain (tap C on any player).' : 'Invalid formation.'}
          </div>
        )}

        {error    && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
        {successMsg && <div className="alert alert-info" style={{ marginTop: 10 }}>{successMsg}</div>}

        <button
          type="button"
          className="primary-button"
          style={{ marginTop: 14 }}
          disabled={!isComplete || saving || !gameweek}
          onClick={saveSelection}
          title={!gameweek ? 'No active gameweek yet' : undefined}
        >
          {saving ? 'Saving...' : !gameweek ? 'No active gameweek' : 'Save Squad'}
        </button>
      </section>
    </div>
  );
}
