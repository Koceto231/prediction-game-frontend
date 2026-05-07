import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient';

// GK at top → DEF → MID → FWD at bottom  (same as FPL)
const ROWS     = ['GK', 'DEF', 'MID', 'FWD'];
const REQUIRED = { GK: 1, DEF: 3, MID: 3, FWD: 4 };
const BUDGET   = 100;

const POS_COLORS = {
  GK:  { bg: 'rgba(255,180,0,0.22)',  border: '#ffb400', text: '#ffb400' },
  DEF: { bg: 'rgba(30,140,255,0.22)', border: '#4da6ff', text: '#4da6ff' },
  MID: { bg: 'rgba(89,255,147,0.22)', border: '#59ff93', text: '#59ff93' },
  FWD: { bg: 'rgba(255,80,80,0.22)',  border: '#ff6060', text: '#ff6060' },
};

const LEAGUES = {
  PL:  { label: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  BGL: { label: 'efbet Liga',     flag: '🇧🇬' },
  BL1: { label: 'Bundesliga',     flag: '🇩🇪' },
  SA:  { label: 'Serie A',        flag: '🇮🇹' },
  PD:  { label: 'La Liga',        flag: '🇪🇸' },
};

const RULES = [
  { icon: '🧤', text: '1 goalkeeper (GK)' },
  { icon: '🛡️', text: '3 defenders (DEF)' },
  { icon: '⚙️', text: '3 midfielders (MID)' },
  { icon: '⚡', text: '4 forwards (FWD)' },
  { icon: '💰', text: 'Budget: £100' },
  { icon: '🏢', text: 'Max 3 players per club' },
  { icon: '👑', text: 'Captain scores 2× points' },
  { icon: '⚽', text: 'Goal: GK/DEF +6, MID +5, FWD +4' },
  { icon: '🎯', text: 'Assist: +3 pts' },
  { icon: '🟨', text: 'Yellow card: −1 pt' },
  { icon: '🟥', text: 'Red card: −3 pts' },
];

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function PosBadge({ pos }) {
  const c = POS_COLORS[pos] ?? {};
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: c.bg, color: c.text, flexShrink: 0,
    }}>{pos}</span>
  );
}

// ── Player photo circle (FPL style) ───────────────────────────────────────────

function FpPhoto({ player, isCaptain }) {
  const [err, setErr] = useState(false);
  const c = POS_COLORS[player.position] ?? {};
  return (
    <div
      className={`fp-photo${isCaptain ? ' fp-photo--captain' : ''}`}
      style={{ borderColor: c.border }}
    >
      {player.photoUrl && !err
        ? <img src={player.photoUrl} alt={player.name} onError={() => setErr(true)} />
        : <span className="fp-photo__initials" style={{ color: c.text }}>
            {initials(player.name)}
          </span>
      }
    </div>
  );
}

// ── Filled player slot ────────────────────────────────────────────────────────

function FpPlayer({ player, isCaptain, onCaptain, onRemove }) {
  const lastName = player.name.split(' ').slice(-1)[0];
  return (
    <div className="fp-player">
      <FpPhoto player={player} isCaptain={isCaptain} />
      <div className="fp-label">
        <span className="fp-label__name">{lastName}</span>
        <span className="fp-label__sub">£{Number(player.price).toFixed(1)}</span>
      </div>
      <div className="fp-actions">
        <button
          type="button"
          className={`fp-btn fp-btn--captain${isCaptain ? ' active' : ''}`}
          onClick={onCaptain}
          title="Captain (2× pts)"
        >C</button>
        <button type="button" className="fp-btn fp-btn--remove" onClick={onRemove}>×</button>
      </div>
    </div>
  );
}

// ── Empty slot ────────────────────────────────────────────────────────────────

function FpEmpty({ pos, onClick }) {
  const c = POS_COLORS[pos] ?? {};
  return (
    <div className="fp-empty" onClick={onClick}>
      <div className="fp-empty__circle" style={{ borderColor: c.border, color: c.text }}>+</div>
      <span className="fp-empty__label" style={{ color: c.text }}>{pos}</span>
    </div>
  );
}

// ── SVG pitch markings ────────────────────────────────────────────────────────

function PitchLines() {
  return (
    <svg className="fp-pitch__svg" viewBox="0 0 400 560" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5">
        {/* Outer border */}
        <rect x="2" y="2" width="396" height="556" rx="8" />
        {/* Halfway line */}
        <line x1="2" y1="280" x2="398" y2="280" />
        {/* Center circle */}
        <circle cx="200" cy="280" r="55" />
        {/* Center spot */}
        <circle cx="200" cy="280" r="2.5" fill="rgba(255,255,255,0.55)" />
        {/* Top penalty box */}
        <rect x="100" y="2" width="200" height="95" />
        {/* Top goal area */}
        <rect x="150" y="2" width="100" height="42" />
        {/* Top penalty spot */}
        <circle cx="200" cy="75" r="2.5" fill="rgba(255,255,255,0.55)" />
        {/* Bottom penalty box */}
        <rect x="100" y="463" width="200" height="95" />
        {/* Bottom goal area */}
        <rect x="150" y="516" width="100" height="42" />
        {/* Bottom penalty spot */}
        <circle cx="200" cy="485" r="2.5" fill="rgba(255,255,255,0.55)" />
        {/* Corner arcs */}
        <path d="M2,2 a8,8 0 0 1 8,8" />
        <path d="M398,2 a8,8 0 0 0 -8,8" />
        <path d="M2,558 a8,8 0 0 0 8,-8" />
        <path d="M398,558 a8,8 0 0 1 -8,-8" />
      </g>
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FantasyDraftPage() {
  const navigate = useNavigate();

  const [gameweek, setGameweek]         = useState(null);
  const [allPlayers, setAllPlayers]     = useState([]);
  const [selected, setSelected]         = useState([]);
  const [captain, setCaptain]           = useState(null);
  const [filterLeague, setFilterLeague] = useState('All');
  const [filterPos, setFilterPos]       = useState('All');
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [showRules, setShowRules]       = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // 1. Load all available players
        const playersRes = await api.get('/Fantasy/players');
        const allP = playersRes.data ?? [];
        setAllPlayers(allP);

        // 2. Load current gameweek
        try {
          const gwRes = await api.get('/Fantasy/gameweek/current');
          setGameweek(gwRes.data);
        } catch { /* no active GW yet */ }

        // 3. Load latest squad (carries over from previous GW if current GW is empty)
        //    Endpoint returns { players: [...], captainId: int|null }
        try {
          const squadRes = await api.get('/Fantasy/team/squad');
          const { players: squadPlayers, captainId } = squadRes.data ?? {};

          if (squadPlayers?.length) {
            // Match squad players to full player objects from allPlayers (to get price etc.)
            const squadIds = new Set(squadPlayers.map(p => p.id));
            const preSelected = allP.filter(p => squadIds.has(p.id));
            setSelected(preSelected);
            if (captainId != null) setCaptain(captainId);
          }
        } catch { /* no existing squad */ }

      } catch (err) {
        const status = err?.response?.status;
        const msg    = err?.response?.data?.message || err?.message || 'Unknown error';
        setError(`Could not load players (${status ?? 'network'}: ${msg})`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const spent     = selected.reduce((s, p) => s + Number(p.price), 0);
  const remaining = BUDGET - spent;
  const counts    = useMemo(() => {
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    selected.forEach(p => { if (p.position in c) c[p.position]++; });
    return c;
  }, [selected]);
  const isComplete = selected.length === 11
    && counts.GK === 1 && counts.DEF === 3 && counts.MID === 3 && counts.FWD === 4
    && captain != null;
  const selectedIds = useMemo(() => new Set(selected.map(p => p.id)), [selected]);

  const presentLeagues = useMemo(() => {
    const codes = new Set(allPlayers.map(p => p.leagueCode).filter(Boolean));
    return ['All', ...Object.keys(LEAGUES).filter(k => codes.has(k))];
  }, [allPlayers]);

  const canAdd = (player) =>
    !selectedIds.has(player.id) &&
    selected.length < 11 &&
    counts[player.position] < REQUIRED[player.position] &&
    selected.filter(p => p.teamId === player.teamId).length < 3 &&
    remaining >= Number(player.price);

  const filtered = useMemo(() => allPlayers.filter(p => {
    if (filterLeague !== 'All' && p.leagueCode !== filterLeague) return false;
    if (filterPos    !== 'All' && p.position   !== filterPos)    return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())
        && !p.teamName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allPlayers, filterLeague, filterPos, search]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const togglePlayer = (player) => {
    if (selectedIds.has(player.id)) {
      setSelected(prev => prev.filter(p => p.id !== player.id));
      if (captain === player.id) setCaptain(null);
    } else if (canAdd(player)) {
      setSelected(prev => [...prev, player]);
    }
  };

  const saveSelection = async () => {
    if (!isComplete || !gameweek) return;
    setSaving(true); setError(''); setSuccessMsg('');
    try {
      await api.post('/Fantasy/selection', {
        fantasyGameweekId: gameweek.id,
        selectedPlayerIds: selected.map(p => p.id),
        captainPlayerId:   captain,
      });
      setSuccessMsg('Squad saved! ✅');
      setTimeout(() => navigate('/fantasy'), 1200);
    } catch (err) {
      const msg = err?.response?.data?.message
               || err?.response?.data
               || err?.message
               || 'Failed to save selection.';
      setError(`Save failed (${err?.response?.status ?? 'network'}): ${JSON.stringify(msg)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading players…</div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '0 8px', minHeight: '80vh' }}>

      {/* ══ Left: Pitch ══ */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div className="shell-card" style={{ padding: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>Your XI</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.83rem' }}>{selected.length}/11 selected</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(REQUIRED).map(([pos, req]) => (
                <div key={pos} className={`fantasy-formation-slot ${counts[pos] === req ? 'fantasy-formation-slot--done' : ''}`}>
                  <PosBadge pos={pos} /><span>{counts[pos]}/{req}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget bar */}
          <div className="fantasy-budget-bar" style={{ marginBottom: 12 }}>
            <div className="fantasy-budget-bar__label">
              <span>Budget</span>
              <span style={{ color: remaining < 0 ? '#ff6060' : 'var(--accent)' }}>£{remaining.toFixed(1)} left</span>
            </div>
            <div className="fantasy-budget-bar__track">
              <div className="fantasy-budget-bar__fill" style={{
                width: `${Math.min((spent / BUDGET) * 100, 100)}%`,
                background: remaining < 0 ? '#ff6060' : 'var(--accent)',
              }} />
            </div>
            <div className="fantasy-budget-bar__detail">£{spent.toFixed(1)} of £{BUDGET} used</div>
          </div>

          {/* ── FPL-style pitch ── */}
          <div className="fp-pitch">
            <PitchLines />

            {/* Top goal */}
            <div className="fp-goal fp-goal--top" />

            {/* Player rows: GK → DEF → MID → FWD */}
            {ROWS.map(pos => {
              const group      = selected.filter(p => p.position === pos);
              const emptyCount = REQUIRED[pos] - group.length;
              return (
                <div key={pos} className="fp-row">
                  {group.map(p => (
                    <FpPlayer
                      key={p.id}
                      player={p}
                      isCaptain={captain === p.id}
                      onCaptain={() => setCaptain(prev => prev === p.id ? null : p.id)}
                      onRemove={() => togglePlayer(p)}
                    />
                  ))}
                  {Array.from({ length: emptyCount }).map((_, i) => (
                    <FpEmpty
                      key={i}
                      pos={pos}
                      onClick={() => { setFilterPos(pos); setFilterLeague('All'); }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Bottom goal */}
            <div className="fp-goal fp-goal--bottom" />
          </div>

          {/* Captain + validation */}
          {captain != null && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 10 }}>
              👑 Captain: <strong style={{ color: 'var(--accent)' }}>{selected.find(p => p.id === captain)?.name}</strong> (2× pts)
            </div>
          )}
          {!isComplete && selected.length === 11 && (
            <div className="alert alert-error" style={{ marginTop: 8 }}>
              {captain == null ? 'Избери капитан (натисни C върху играч).' : 'Невалидна формация.'}
            </div>
          )}
          {error      && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
          {successMsg && <div className="alert alert-info"  style={{ marginTop: 8 }}>{successMsg}</div>}

          <button type="button" className="primary-button"
            style={{ marginTop: 14, width: '100%' }}
            disabled={!isComplete || saving || !gameweek}
            onClick={saveSelection}
            title={!gameweek ? 'No active gameweek yet' : undefined}>
            {saving ? 'Saving…' : !gameweek ? 'No active gameweek' : 'Save Squad ✅'}
          </button>
        </div>
      </div>

      {/* ══ Right: Picker + Rules ══ */}
      <div style={{ width: 380, flexShrink: 0 }}>

        {/* Rules */}
        <div className="shell-card" style={{ padding: 16, marginBottom: 12 }}>
          <button type="button" onClick={() => setShowRules(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer',
              fontSize: '0.95rem', fontWeight: 700, padding: 0 }}>
            <span>📖 Rules</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{showRules ? '▲ hide' : '▼ show'}</span>
          </button>
          {showRules && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {RULES.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>{r.icon}</span><span>{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Player picker */}
        <div className="shell-card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 10px' }}>📋 Pick Your Squad</h3>

          {/* League tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {presentLeagues.map(code => {
              const meta = LEAGUES[code];
              return (
                <button key={code} type="button"
                  className={`bet-type-tab ${filterLeague === code ? 'bet-type-tab--active' : ''}`}
                  onClick={() => setFilterLeague(code)}
                  style={{ fontSize: '0.75rem' }}>
                  {meta ? `${meta.flag} ${code}` : 'All'}
                </button>
              );
            })}
          </div>

          {/* Position tabs + search */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {['All', 'GK', 'DEF', 'MID', 'FWD'].map(pos => (
              <button key={pos} type="button"
                className={`bet-type-tab ${filterPos === pos ? 'bet-type-tab--active' : ''}`}
                onClick={() => setFilterPos(pos)}
                style={{ fontSize: '0.75rem' }}>{pos}</button>
            ))}
            <input type="text" className="bet-amount-input" placeholder="Search…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 100, fontSize: '0.8rem' }} />
          </div>

          {/* Player list */}
          <div className="fantasy-player-list" style={{ maxHeight: 480 }}>
            {filtered.map(player => {
              const isSel   = selectedIds.has(player.id);
              const addable = canAdd(player);
              const c = POS_COLORS[player.position] ?? {};
              return (
                <div key={player.id}
                  className={`fantasy-list-row ${isSel ? 'fantasy-list-row--selected' : ''} ${!isSel && !addable ? 'fantasy-list-row--disabled' : ''}`}
                  onClick={() => togglePlayer(player)}>

                  {/* Mini photo */}
                  <MiniPhoto player={player} />

                  <PosBadge pos={player.position} />

                  <div className="fantasy-list-row__info">
                    <span className="fantasy-list-row__name">{player.name}</span>
                    <span className="fantasy-list-row__club">
                      {player.teamName}
                      {player.leagueCode && LEAGUES[player.leagueCode] &&
                        <span style={{ marginLeft: 4, opacity: 0.7 }}>{LEAGUES[player.leagueCode].flag}</span>}
                    </span>
                  </div>

                  <span className="fantasy-list-row__price">£{Number(player.price).toFixed(1)}</span>
                  <span className={`fantasy-list-row__btn ${isSel ? 'fantasy-list-row__btn--remove' : ''}`}>
                    {isSel ? '−' : '+'}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="empty-box">No players match your filter.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini photo for list rows ───────────────────────────────────────────────────

function MiniPhoto({ player }) {
  const [err, setErr] = useState(false);
  const c = POS_COLORS[player.position] ?? {};
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      overflow: 'hidden', border: `2px solid ${c.border}`,
      background: c.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: c.text,
    }}>
      {player.photoUrl && !err
        ? <img src={player.photoUrl} alt="" onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(player.name)}
    </div>
  );
}
