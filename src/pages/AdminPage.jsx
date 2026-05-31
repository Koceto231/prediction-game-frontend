import { useState, useEffect } from 'react';
import api from '../api/apiClient';

const SM_LEAGUES = ['BGL', 'PL', 'BL1', 'SA', 'PD', 'WC'];

function TeamMatchSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults(null);
    try { const r = await api.get(`/admin/sync/debug/team-matches?team=${encodeURIComponent(query)}`); setResults(r.data); }
    catch { setResults([]); }
    finally { setLoading(false); }
  };

  const del = async (id) => {
    if (!window.confirm(`Delete match ID ${id}?`)) return;
    setDeleting(id);
    try { await api.delete(`/admin/sync/matches/${id}`); setResults(r => r.filter(m => m.id !== id)); }
    catch (e) { alert(e?.response?.data?.message || 'Error'); }
    finally { setDeleting(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="admin-input" placeholder="Търси отбор…" value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{ flex: 1 }} />
        <button className="admin-btn" type="button" onClick={search} disabled={loading}>
          {loading ? '…' : '🔍'}
        </button>
      </div>
      {results && results.length === 0 && <p className="admin-hint">Няма предстоящи мачове.</p>}
      {results && results.map(m => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
          <span>
            <b>#{m.id}</b> · {m.fixture} · {new Date(m.date).toLocaleDateString()} · {m.leagueCode ?? '—'} · кръг {m.matchDay ?? '—'}
          </span>
          <button className="admin-btn admin-btn--danger" type="button" style={{ padding: '2px 10px', fontSize: '0.75rem' }}
            disabled={deleting === m.id} onClick={() => del(m.id)}>
            {deleting === m.id ? '…' : '🗑️'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Venue lookup: search Sportmonks for stadium photo + meta ─────
function VenueLookup() {
  const [query, setQuery]     = useState('Vivacom');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setError(''); setResults(null);
    try {
      const r = await api.get(`/admin/sync/debug/venue/${encodeURIComponent(q)}`);
      setResults(r.data?.results ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to fetch.');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="admin-input"
          placeholder="Stadium name (e.g. Vivacom, Anfield, Camp Nou)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          style={{ flex: 1 }}
        />
        <button className="admin-btn" type="button" onClick={search} disabled={loading}>
          {loading ? '…' : '🔍'}
        </button>
      </div>

      {error && <p className="admin-hint" style={{ color: '#f87171' }}>{error}</p>}
      {results && results.length === 0 && <p className="admin-hint">No venues match that name.</p>}

      {results && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
          {results.map(v => (
            <div key={v.id} style={{ background: 'var(--surface-2, #1c1b1b)', border: '1px solid var(--border-soft, #4d4633)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {v.imagePath ? (
                <img
                  src={v.imagePath}
                  alt={v.name ?? ''}
                  loading="lazy"
                  style={{ width: '100%', height: 140, objectFit: 'cover', background: '#0a0a0a' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: '100%', height: 140, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  No image
                </div>
              )}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.86rem' }}>{v.name ?? '—'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {[v.city, v.capacity != null ? `${v.capacity.toLocaleString()} seats` : null].filter(Boolean).join(' · ') || '—'}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--accent)', wordBreak: 'break-all', marginTop: 4 }}>#{v.id}</div>
                {v.imagePath && (
                  <button
                    type="button"
                    className="admin-btn"
                    style={{ marginTop: 6, fontSize: '0.72rem', padding: '4px 8px' }}
                    onClick={() => { navigator.clipboard?.writeText(v.imagePath); }}
                    title="Copy CDN URL to clipboard"
                  >📋 Copy URL</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Format a Date as yyyy-MM-dd for <input type="date">
function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

function GwRow({ gw, loading, onComplete, onEdit }) {
  const [editNum, setEditNum]   = useState('');
  const [editDl,  setEditDl]    = useState('');
  const [open,    setOpen]      = useState(false);

  const statusColor = gw.isCompleted ? 'var(--text-soft)'
                    : gw.isLocked    ? '#ff6060'
                    :                  'var(--accent)';
  const statusBg    = gw.isCompleted ? 'rgba(255,255,255,0.06)'
                    : gw.isLocked    ? 'rgba(255,96,96,0.15)'
                    :                  'rgba(240,197,25,0.15)';
  const statusLabel = gw.isCompleted ? 'DONE' : gw.isLocked ? 'LOCKED' : 'ACTIVE';

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.80rem' }}>
        <span style={{ minWidth: 40, fontWeight: 700, color: 'var(--accent)' }}>GW{gw.gameWeek}</span>
        <span style={{ flex: 1, color: 'var(--text-soft)' }}>
          {new Date(gw.deadline).toLocaleDateString()} {new Date(gw.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', background: statusBg, color: statusColor }}>
          {statusLabel}
        </span>
        <button className="admin-btn" type="button"
          style={{ padding: '2px 8px', fontSize: '0.70rem' }}
          onClick={() => setOpen(v => !v)}>
          {open ? '▲' : '✎ Edit'}
        </button>
        {!gw.isCompleted && (
          <button className="admin-btn" type="button"
            style={{ padding: '2px 8px', fontSize: '0.70rem' }}
            disabled={loading === `complete-${gw.id}`}
            onClick={onComplete}>
            {loading === `complete-${gw.id}` ? '…' : '✓'}
          </button>
        )}
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginTop: 6, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-soft)', marginBottom: 2 }}>GW номер</div>
            <input className="admin-input" type="number" placeholder={gw.gameWeek}
              value={editNum} onChange={e => setEditNum(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.78rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-soft)', marginBottom: 2 }}>Deadline</div>
            <input className="admin-input" type="datetime-local"
              value={editDl} onChange={e => setEditDl(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.78rem' }} />
          </div>
          <button className="admin-btn admin-btn--accent" type="button"
            disabled={(!editNum && !editDl) || loading === `edit-${gw.id}`}
            style={{ padding: '4px 12px', fontSize: '0.78rem', alignSelf: 'end' }}
            onClick={() => { onEdit(editNum, editDl); setOpen(false); }}>
            {loading === `edit-${gw.id}` ? '…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Wallet management — lists every user with their balance and lets the
 * admin credit or debit any account. A separate "Self top-up" lane is
 * pinned to the top so the admin can give themselves an arbitrary amount
 * with a single button click.
 */
function WalletManagement() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selfAmount, setSelfAmount] = useState('10000');
  const [filter, setFilter]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/wallet/users');
      setUsers(r.data ?? []);
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Зареждането се провали.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const adjust = async (userId, rawAmount) => {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setFeedback('Въведи валидна сума (≠ 0).');
      return;
    }
    setFeedback('');
    try {
      const r = await api.post('/admin/wallet/adjust', { userId, amount });
      setUsers(us => us.map(u => u.id === userId ? { ...u, balance: r.data.balance } : u));
      setFeedback(`Балансът на потребителя е ${amount > 0 ? 'увеличен' : 'намален'} с ${Math.abs(amount)}.`);
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Корекцията се провали.');
    }
  };

  const selfTopUp = async () => {
    const amount = Number(selfAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback('Сумата за себе си трябва да е положителна.');
      return;
    }
    setFeedback('');
    try {
      const r = await api.post('/admin/wallet/self-topup', { userId: 0, amount });
      setFeedback(`Балансът ти е сега ${r.data.balance}.`);
      // refresh list so the new self balance shows
      load();
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Self top-up се провали.');
    }
  };

  const filtered = users.filter(u =>
    !filter.trim()
      || u.username?.toLowerCase().includes(filter.toLowerCase())
      || u.email?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      {/* Self top-up — pinned at the top so it's always one click away. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
                    padding: '10px 12px', background: 'rgba(240, 197, 25, 0.08)',
                    border: '1px solid rgba(240, 197, 25, 0.3)', borderRadius: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>На себе си</span>
        <input className="admin-input" value={selfAmount}
          onChange={e => setSelfAmount(e.target.value)}
          style={{ width: 110 }} type="number" min="1" />
        <button className="admin-btn admin-btn--accent" type="button" onClick={selfTopUp}>
          Добави
        </button>
      </div>

      {/* Filter + reload */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input className="admin-input" placeholder="Търси потребител…"
          value={filter} onChange={e => setFilter(e.target.value)}
          style={{ flex: 1 }} />
        <button className="admin-btn" type="button" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      {feedback && (
        <p className="admin-hint" style={{ color: 'var(--accent)' }}>{feedback}</p>
      )}

      {/* User list */}
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)',
                    borderRadius: 6 }}>
        {filtered.map(u => (
          <UserBalanceRow key={u.id} user={u} onAdjust={adjust} />
        ))}
        {filtered.length === 0 && (
          <p className="admin-hint" style={{ padding: 10 }}>Няма потребители за показване.</p>
        )}
      </div>
    </div>
  );
}

function UserBalanceRow({ user, onAdjust }) {
  const [delta, setDelta] = useState('100');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      borderBottom: '1px solid var(--border)', fontSize: '0.82rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.username}
          {user.role === 'Admin' && (
            <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--accent)' }}>(admin)</span>
          )}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{user.email}</div>
      </div>
      <div style={{ fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}>
        {Number(user.balance).toFixed(2)}
      </div>
      <input className="admin-input" type="number" value={delta}
        onChange={e => setDelta(e.target.value)}
        style={{ width: 80 }} />
      <button className="admin-btn admin-btn--accent" type="button"
        onClick={() => onAdjust(user.id, Number(delta))}
        style={{ padding: '4px 10px' }}>+</button>
      <button className="admin-btn admin-btn--danger" type="button"
        onClick={() => onAdjust(user.id, -Math.abs(Number(delta)))}
        style={{ padding: '4px 10px' }}>−</button>
    </div>
  );
}

/**
 * Email-invitation management. Lets the admin issue, list and revoke
 * registration invitations. Open registration is disabled — every
 * signup must redeem one of these tokens.
 */
function InvitationsManagement() {
  const [email, setEmail]       = useState('');
  const [feedback, setFeedback] = useState('');
  const [invites, setInvites]   = useState([]);
  const [loading, setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/invitations');
      setInvites(r.data ?? []);
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Зареждането се провали.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!email.trim()) { setFeedback('Въведи имейл.'); return; }
    setFeedback('');
    try {
      const r = await api.post('/admin/invitations', { email: email.trim() });
      setFeedback(r.data?.message || 'Поканата е изпратена.');
      setEmail('');
      load();
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Изпращането се провали.');
    }
  };

  const revoke = async (id) => {
    if (!window.confirm('Премахни тази покана?')) return;
    try {
      await api.delete(`/admin/invitations/${id}`);
      setInvites(arr => arr.filter(i => i.id !== id));
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Премахването се провали.');
    }
  };

  const statusBadge = (s) => {
    if (s === 'used')    return <span style={{ color: 'var(--text-muted)' }}>използвана</span>;
    if (s === 'expired') return <span style={{ color: '#e74c3c' }}>изтекла</span>;
    return <span style={{ color: 'var(--accent)' }}>чака</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="admin-input" placeholder="email@example.com"
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1 }} />
        <button className="admin-btn admin-btn--accent" type="button" onClick={send}>
          Изпрати покана
        </button>
        <button className="admin-btn" type="button" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      {feedback && (
        <p className="admin-hint" style={{ color: 'var(--accent)' }}>{feedback}</p>
      )}

      <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)',
                    borderRadius: 6 }}>
        {invites.map(i => (
          <div key={i.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            borderBottom: '1px solid var(--border)', fontSize: '0.82rem',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.email}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                създадена {new Date(i.createdAt).toLocaleString()} · изтича {new Date(i.expiresAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ minWidth: 90, textAlign: 'right' }}>{statusBadge(i.status)}</div>
            <button className="admin-btn admin-btn--danger" type="button"
              onClick={() => revoke(i.id)}
              style={{ padding: '2px 8px', fontSize: '0.72rem' }}>🗑️</button>
          </div>
        ))}
        {invites.length === 0 && (
          <p className="admin-hint" style={{ padding: 10 }}>Няма покани.</p>
        )}
      </div>
    </div>
  );
}

function AdminSection({ title, children }) {
  return (
    <div className="admin-section">
      <div className="admin-section__title">{title}</div>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [gameweeks, setGameweeks]     = useState([]);
  const [smLeague, setSmLeague]       = useState('BGL');
  const [smDays, setSmDays]           = useState('30');
  const [histLeague, setHistLeague]   = useState('BGL');
  const [histDaysBack, setHistDaysBack] = useState('365');
  const [matchId, setMatchId]         = useState('');
  const [gwAnchorDate, setGwAnchorDate] = useState(toDateInput(new Date()));
  const [gwNumber, setGwNumber]         = useState('');
  const [gwDeadline, setGwDeadline]     = useState('');
  const [reResolveBetId, setReResolveBetId] = useState('');
  const [fdTeamSearch, setFdTeamSearch]     = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState('');

  useEffect(() => {
    api.get('/Fantasy/admin/gameweeks').then(r => setGameweeks(r.data ?? [])).catch(() => {});
  }, []);

  const toStr = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  };

  const run = async (key, fn) => {
    setLoading(key);
    setFeedback(null);
    try {
      const res = await fn();
      let text = toStr(res.data);
      if (text.length > 4000) text = text.slice(0, 4000) + '\n\n… (truncated)';
      setFeedback({ ok: true, text });
    } catch (err) {
      let text = toStr(err?.response?.data?.message) || toStr(err?.response?.data) || err?.message || 'Request failed.';
      if (text.length > 4000) text = text.slice(0, 4000) + '\n\n… (truncated)';
      setFeedback({ ok: false, text });
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Admin Panel</h2>
            <p>Sync data, seed players and score predictions.</p>
          </div>
        </div>

        <div className="admin-grid">

          {/* ── Wallet management ── */}
          <AdminSection title="Управление на баланси">
            <WalletManagement />
          </AdminSection>

          {/* ── Email invitations ── */}
          <AdminSection title="Покани за регистрация">
            <InvitationsManagement />
          </AdminSection>

          {/* ── Matches via Sportmonks ── */}
          <AdminSection title="Import Matches (Sportmonks)">
            <div className="admin-row">
              <label className="admin-label">League</label>
              <select className="admin-input" value={smLeague} onChange={e => setSmLeague(e.target.value)}>
                {SM_LEAGUES.map(l => (
                  <option key={l} value={l}>{l === 'BGL' ? 'BGL — efbet Liga' : l}</option>
                ))}
              </select>
            </div>
            <div className="admin-row">
              <label className="admin-label">Days ahead</label>
              <input className="admin-input" value={smDays}
                onChange={e => setSmDays(e.target.value)} placeholder="30" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'sm-matches'}
                onClick={() => run('sm-matches', () =>
                  api.post(`/admin/sync/matches/sportmonks?leagueCode=${smLeague}&daysAhead=${smDays}`))}>
                {loading === 'sm-matches' ? 'Importing…' : `Import ${smLeague} Matches`}
              </button>
            </div>
            <p className="admin-hint">Covers 7 days back + selected days ahead. Safe to re-run.</p>

            {/* Diagnostics: does Sportmonks actually return WC (league 732) data? */}
            <div className="admin-actions" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
              <button className="admin-btn" type="button" disabled={loading === 'wc-league'}
                onClick={() => run('wc-league', () => api.get('/admin/sync/debug/raw?path=leagues/732'))}>
                {loading === 'wc-league' ? 'Checking…' : 'Check WC league (732)'}
              </button>
              <button className="admin-btn" type="button" disabled={loading === 'wc-fix'}
                onClick={() => run('wc-fix', () => {
                  const from = new Date().toISOString().slice(0, 10);
                  const to   = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
                  return api.get(`/admin/sync/debug/raw?path=${encodeURIComponent(`fixtures/between/${from}/${to}?filters=fixtureLeagues:732&include=participants;league&per_page=20`)}`);
                })}>
                {loading === 'wc-fix' ? 'Checking…' : 'Check WC fixtures (next 200d)'}
              </button>
              <button className="admin-btn" type="button" disabled={loading === 'wc-sub'}
                onClick={() => run('wc-sub', () => api.get('/admin/sync/debug/raw?path=' + encodeURIComponent('leagues?per_page=200')))}>
                {loading === 'wc-sub' ? 'Checking…' : 'List my plan leagues'}
              </button>
              <button className="admin-btn" type="button" disabled={loading === 'wc-odds'}
                onClick={() => {
                  const fid = prompt('Enter a WC fixture ID (from "Check WC fixtures" response):');
                  if (!fid) return Promise.resolve({ data: 'cancelled' });
                  return run('wc-odds', () => api.get(`/admin/sync/debug/odds/${fid}`));
                }}>
                {loading === 'wc-odds' ? 'Checking…' : 'Check odds for fixture'}
              </button>
            </div>
            <p className="admin-hint">If "Check WC league" errors → your plan has no World Cup access. If fixtures count is 0 → no WC matches scheduled in your data yet.</p>

            {/* Force the Sportmonks 1X2 odds sync now (instead of waiting for the cron). */}
            <div className="admin-actions" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'odds-now'}
                onClick={() => run('odds-now', () => api.post('/admin/sync/odds/sync-1x2'))}>
                {loading === 'odds-now' ? 'Syncing odds…' : 'Sync odds now'}
              </button>
              <button className="admin-btn" type="button" disabled={loading === 'odds-diag'}
                onClick={() => {
                  const mid = prompt('Internal match id to diagnose (e.g. 2369):');
                  if (!mid) return Promise.resolve({ data: 'cancelled' });
                  return run('odds-diag', () => api.post(`/admin/sync/odds/diagnose/${mid}`));
                }}>
                {loading === 'odds-diag' ? 'Diagnosing…' : 'Diagnose odds for match'}
              </button>
            </div>
            <p className="admin-hint">Pulls real Sportmonks 1X2 odds for all upcoming matches in the 60-day window. Safe to re-run.</p>
          </AdminSection>

          {/* ── Historical match import ── */}
          <AdminSection title="Import Match History (Sportmonks)">
            <div className="admin-row">
              <label className="admin-label">Days back</label>
              <input className="admin-input" value={histDaysBack}
                onChange={e => setHistDaysBack(e.target.value)} placeholder="365" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'history-all'}
                onClick={() => run('history-all', () =>
                  api.post(`/admin/sync/matches/history/all?daysBack=${histDaysBack}`))}>
                {loading === 'history-all' ? 'Importing all…' : '🌍 Import ALL Leagues History'}
              </button>
            </div>
            <div className="admin-row" style={{ marginTop: 8 }}>
              <label className="admin-label">Single league</label>
              <select className="admin-input" value={histLeague} onChange={e => setHistLeague(e.target.value)}>
                {SM_LEAGUES.map(l => (
                  <option key={l} value={l}>{l === 'BGL' ? 'BGL — efbet Liga' : l}</option>
                ))}
              </select>
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'history'}
                onClick={() => run('history', () =>
                  api.post(`/admin/sync/matches/history?leagueCode=${histLeague}&daysBack=${histDaysBack}`))}>
                {loading === 'history' ? 'Importing…' : `Import ${histLeague} History`}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'debug-between'}
                onClick={() => run('debug-between', () =>
                  api.get(`/admin/sync/debug/between?leagueCode=${histLeague}&daysBack=${histDaysBack}`))}>
                {loading === 'debug-between' ? 'Checking…' : `🔍 Test API (${histLeague})`}
              </button>
            </div>
            <p className="admin-hint">Imports finished matches for the past N days. Run once to populate standings. Runs in background — check logs.</p>
          </AdminSection>

          {/* ── Standings debug ── */}
          <AdminSection title="Debug Standings Data">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'fix-team-leagues'}
                onClick={() => run('fix-team-leagues', () => api.post('/admin/sync/teams/fix-league-codes'))}>
                {loading === 'fix-team-leagues' ? 'Fixing…' : '🔧 Fix Team LeagueCodes (от мачовете им)'}
              </button>
            </div>
            <p className="admin-hint">Попълва LeagueCode на отбори с null — Werder Bremen, Hoffenheim и т.н. Взима кода от мачовете им. Пусни преди да изтриваш фантомни мачове!</p>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'delete-orphan-teams'}
                onClick={() => run('delete-orphan-teams', () => api.delete('/admin/sync/teams/orphaned'))}>
                {loading === 'delete-orphan-teams' ? 'Deleting…' : '🗑️ Delete Orphaned Teams (null LeagueCode + no matches)'}
              </button>
            </div>
            <p className="admin-hint">Изтрива отбори без LeagueCode И без нито един мач — чисто сираци. Пусни след Fix Team LeagueCodes.</p>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'no-league-dry'}
                onClick={() => run('no-league-dry', () => api.delete('/admin/sync/teams/no-league?dryRun=true'))}>
                {loading === 'no-league-dry' ? 'Checking…' : '🔍 Preview — отбори без лига + техните мачове'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'no-league-delete'}
                onClick={() => run('no-league-delete', () => api.delete('/admin/sync/teams/no-league?dryRun=false'))}>
                {loading === 'no-league-delete' ? 'Deleting…' : '🗑️ Delete — отбори без лига + мачовете им'}
              </button>
            </div>
            <p className="admin-hint">Изтрива отбори с null LeagueCode ЗАЕДНО с всичките им мачове, бетове, предикции и фентъзи данни. За Ligue 1 и др. неподдържани лиги.</p>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'fix-leagues'}
                onClick={() => run('fix-leagues', () => api.post('/admin/sync/matches/fix-league-codes'))}>
                {loading === 'fix-leagues' ? 'Fixing…' : '🔧 Fix League Codes on Old Matches'}
              </button>
            </div>
            <p className="admin-hint">One-time fix: copies LeagueCode from team onto all matches that are missing it (~1587 old matches). Run once.</p>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'fix-statuses'}
                onClick={() => run('fix-statuses', () => api.post('/admin/sync/matches/fix-statuses'))}>
                {loading === 'fix-statuses' ? 'Fixing…' : '🔧 Fix Match Statuses'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'bgl-status'}
                onClick={() => run('bgl-status', () => api.get('/admin/sync/debug/bgl-status'))}>
                {loading === 'bgl-status' ? 'Checking…' : '🔍 Check BGL Match Status'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'standings-check'}
                onClick={() => run('standings-check', () => api.get('/admin/sync/debug/standings-check'))}>
                {loading === 'standings-check' ? 'Checking…' : '🔍 Check Standings Data'}
              </button>
            </div>
          </AdminSection>

          {/* ── Dedup matches ── */}
          <AdminSection title="Fix Duplicate Matches">
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'dedup'}
                onClick={() => run('dedup', () => api.post('/admin/sync/matches/dedup'))}>
                {loading === 'dedup' ? 'Cleaning…' : 'Remove Duplicates'}
              </button>
            </div>
            <p className="admin-hint">Изтрива дублирани мачове (от стария football-data.org import). Пусни веднъж.</p>
          </AdminSection>

          {/* ── Player dedup ── */}
          <AdminSection title="Fix Duplicate Players">
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'dup-check'}
                onClick={() => run('dup-check', () => api.get('/admin/sync/players/duplicates'))}>
                {loading === 'dup-check' ? 'Checking…' : '🔍 Find Duplicate Players'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'dup-dry'}
                onClick={() => run('dup-dry', () => api.post('/admin/sync/players/dedup?dryRun=true'))}>
                {loading === 'dup-dry' ? 'Checking…' : '🔍 Dry-run Merge (preview only)'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'dup-merge'}
                onClick={() => run('dup-merge', () => api.post('/admin/sync/players/dedup?dryRun=false'))}>
                {loading === 'dup-merge' ? 'Merging…' : '⚡ Merge Duplicates'}
              </button>
            </div>
            <p className="admin-hint">Keeps the player with the longer (more complete) name, reassigns all bets + fantasy stats to it, deletes the shorter-name duplicate. Run dry-run first to preview.</p>
          </AdminSection>

          {/* ── Purge football-data.org players ── */}
          <AdminSection title="Purge Football-Data.org Players">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'fd-stamp'}
                onClick={() => run('fd-stamp', () => api.post('/admin/sync/players/stamp-sources'))}>
                {loading === 'fd-stamp' ? 'Stamping…' : '🏷 Стъпка 1 — Маркирай Sources'}
              </button>
            </div>
            <p className="admin-hint" style={{ marginBottom: 8 }}>Пусни ПЪРВО — маркира всеки играч като "sportmonks" или "footballdata" по PhotoUrl. Еднократно.</p>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'fd-debug'}
                onClick={() => run('fd-debug', () => api.get('/admin/sync/players/footballdata-debug'))}>
                {loading === 'fd-debug' ? 'Loading…' : '🔍 Debug — виж team имена'}
              </button>
            </div>
            <div className="admin-row" style={{ marginTop: 8 }}>
              <label className="admin-label">Търси отбор</label>
              <input className="admin-input" value={fdTeamSearch} onChange={e => setFdTeamSearch(e.target.value)} placeholder="напр. Barcelona" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'fd-team' || !fdTeamSearch}
                onClick={() => run('fd-team', () => api.get(`/admin/sync/players/footballdata-debug?team=${encodeURIComponent(fdTeamSearch)}`))}>
                {loading === 'fd-team' ? 'Търсене…' : '🔍 Виж играчи на отбора'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'fd-dry'}
                onClick={() => run('fd-dry', () => api.delete('/admin/sync/players/footballdata?dryRun=true'))}>
                {loading === 'fd-dry' ? 'Checking…' : '🔍 Preview (dry-run)'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'fd-purge'}
                onClick={() => run('fd-purge', () => api.delete('/admin/sync/players/footballdata?dryRun=false'))}>
                {loading === 'fd-purge' ? 'Deleting…' : '🗑 Delete football-data.org Players'}
              </button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginBottom: 6 }}>Втори проход — за останалите дубликати</div>
              <div className="admin-actions">
                <button className="admin-btn" type="button" disabled={loading === 'fd2-dry'}
                  onClick={() => run('fd2-dry', () => api.delete('/admin/sync/players/footballdata-remaining?dryRun=true'))}>
                  {loading === 'fd2-dry' ? 'Checking…' : '🔍 Preview втори проход'}
                </button>
              </div>
              <div className="admin-actions" style={{ marginTop: 8 }}>
                <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'fd2-purge'}
                  onClick={() => run('fd2-purge', () => api.delete('/admin/sync/players/footballdata-remaining?dryRun=false'))}>
                  {loading === 'fd2-purge' ? 'Deleting…' : '🗑 Delete останалите (втори проход)'}
                </button>
              </div>
            </div>
            <p className="admin-hint">Изтрива всички играчи от старото API (football-data.org) и пренасочва залозите/статистиките към съответния Sportmonks играч. Пусни Preview първо.</p>
          </AdminSection>

          {/* ── Players via Sportmonks ── */}
          <AdminSection title="Sync Players (Sportmonks)">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'sm-players'}
                onClick={() => run('sm-players', () => api.post('/admin/sync/sync-players/sportmonks'))}>
                {loading === 'sm-players' ? 'Syncing…' : 'Sync Players from Sportmonks'}
              </button>
            </div>
            <p className="admin-hint">Синква играчите за всички отбори. Пускай след Import Matches.</p>
          </AdminSection>

          {/* ── Fantasy: Advance Gameweek ── */}
          <AdminSection title="Fantasy — Advance Gameweek">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'advance-gw'}
                onClick={() => run('advance-gw', () => api.post('/Fantasy/admin/gameweek/advance'))}>
                {loading === 'advance-gw' ? 'Creating…' : '⏭ Auto-Create Next GW'}
              </button>
            </div>
            <p className="admin-hint">Търси предстоящи мачове в DB и им създава GW прозорец. Пускай след Import Matches.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <div className="admin-row">
                <label className="admin-label">GW номер</label>
                <input className="admin-input" type="number" min="1" placeholder="auto"
                  value={gwNumber} onChange={e => setGwNumber(e.target.value)} />
              </div>
              <div className="admin-row">
                <label className="admin-label">Deadline (дата+час)</label>
                <input className="admin-input" type="datetime-local"
                  value={gwDeadline} onChange={e => setGwDeadline(e.target.value)} />
              </div>
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'force-gw'}
                onClick={() => {
                  const params = new URLSearchParams({ anchorDate: gwAnchorDate });
                  if (gwNumber) params.set('gwNumber', gwNumber);
                  if (gwDeadline) params.set('deadline', new Date(gwDeadline).toISOString());
                  run('force-gw', () => api.post(`/Fantasy/admin/gameweek/force?${params}`));
                }}>
                {loading === 'force-gw' ? 'Creating…' : '📅 Force Create GW'}
              </button>
            </div>
            <p className="admin-hint">GW номер и Deadline са незадължителни. Ако зададеш Deadline, датите се изчисляват около него (±3/4 дни).</p>
          </AdminSection>

          {/* ── Fantasy: Gameweek Status + Edit ── */}
          <AdminSection title="Fantasy — Gameweek Status">
            {gameweeks.length === 0 ? (
              <p className="admin-hint">No gameweeks found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...gameweeks].reverse().slice(0, 8).map(gw => (
                  <GwRow key={gw.id} gw={gw} loading={loading}
                    onComplete={() => run(`complete-${gw.id}`, async () => {
                      const r = await api.post(`/Fantasy/admin/gameweek/${gw.id}/complete`);
                      setGameweeks(prev => prev.map(g => g.id === gw.id ? { ...g, isCompleted: true, isLocked: true } : g));
                      return r;
                    })}
                    onEdit={(num, dl) => run(`edit-${gw.id}`, async () => {
                      const params = new URLSearchParams();
                      if (num) params.set('gwNumber', num);
                      if (dl)  params.set('deadline', new Date(dl).toISOString());
                      const r = await api.patch(`/Fantasy/admin/gameweek/${gw.id}?${params}`);
                      setGameweeks(prev => prev.map(g => g.id === gw.id
                        ? { ...g, gameWeek: num ? Number(num) : g.gameWeek, deadline: dl ? new Date(dl).toISOString() : g.deadline }
                        : g));
                      return r;
                    })}
                  />
                ))}
              </div>
            )}
            <p className="admin-hint" style={{ marginTop: 8 }}>✓ Complete = lock forever. Edit = fix GW number or deadline.</p>
          </AdminSection>

          {/* ── Recalculate Prices ── */}
          <AdminSection title="Recalculate Player Prices">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'recalc-prices'}
                onClick={() => run('recalc-prices', () => api.post('/Fantasy/admin/recalc-prices'))}>
                {loading === 'recalc-prices' ? 'Calculating…' : 'Recalculate Prices'}
              </button>
            </div>
            <p className="admin-hint">Изчислява цените на играчите по сила на отбора (от историята на мачовете). Пускай след Import History.</p>
          </AdminSection>

          {/* ── News: Generate images ── */}
          <AdminSection title="News — Generate Cover Images">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'backfill-images'}
                onClick={() => run('backfill-images', () => api.post('/News/backfill-images'))}>
                {loading === 'backfill-images' ? 'Generating…' : '🖼 Generate Missing Images'}
              </button>
              <button className="admin-btn" type="button" disabled={loading === 'backfill-force'}
                onClick={() => run('backfill-force', () => api.post('/News/backfill-images?force=true'))}>
                {loading === 'backfill-force' ? 'Regenerating…' : '🔄 Regenerate All Images'}
              </button>
            </div>
            <p className="admin-hint">Generate Missing — само статии без снимка. Regenerate All — презаписва всички (Stability AI → Cloudinary).</p>
          </AdminSection>

          {/* ── Re-resolve Bet ── */}
          <AdminSection title="Re-resolve Bet">
            <div className="admin-row">
              <label className="admin-label">Bet ID</label>
              <input className="admin-input" type="number" placeholder="e.g. 42"
                value={reResolveBetId} onChange={e => setReResolveBetId(e.target.value)} />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button"
                disabled={loading === 're-resolve' || !reResolveBetId}
                onClick={() => run('re-resolve', () => api.post(`/admin/sync/bets/${reResolveBetId}/re-resolve`))}>
                {loading === 're-resolve' ? 'Re-resolving…' : '🔄 Re-resolve Bet'}
              </button>
            </div>
            <p className="admin-hint">Resets a wrongly-settled bet to Pending and re-scores it with the current final match score. Find the Bet ID in My Bets → History tab.</p>
          </AdminSection>

          {/* ── Bulk stats sync ── */}
          <AdminSection title="Sync Goal Scorers (Bulk)">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'bulk-stats-7'}
                onClick={() => run('bulk-stats-7', () => api.post('/admin/sync/matches/sync-stats-bulk?daysBack=7'))}>
                {loading === 'bulk-stats-7' ? 'Starting…' : '⚡ Sync Stats — последните 7 дни'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'bulk-stats-30'}
                onClick={() => run('bulk-stats-30', () => api.post('/admin/sync/matches/sync-stats-bulk?daysBack=30'))}>
                {loading === 'bulk-stats-30' ? 'Starting…' : '⚡ Sync Stats — последните 30 дни'}
              </button>
            </div>
            <p className="admin-hint">Синква голмайсторите от Sportmonks за всички приключили мачове. Работи в background — провери Results страницата след ~2 мин.</p>
          </AdminSection>

          {/* ── GoalsJson bulk sync ── */}
          <AdminSection title="⚽ Sync Голмайстори в Results (всички мачове)">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'goals-bulk-30'}
                onClick={() => run('goals-bulk-30', () => api.post('/admin/sync/matches/sync-goals-bulk?daysBack=30'))}>
                {loading === 'goals-bulk-30' ? 'Starting…' : '⚽ Sync Goals — последните 30 дни'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'goals-bulk-365'}
                onClick={() => run('goals-bulk-365', () => api.post('/admin/sync/matches/sync-goals-bulk?daysBack=365'))}>
                {loading === 'goals-bulk-365' ? 'Starting…' : '⚽ Sync Goals — целият сезон'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'goals-force'}
                onClick={() => run('goals-force', () => api.post('/admin/sync/matches/sync-goals-bulk?daysBack=365&force=true'))}>
                {loading === 'goals-force' ? 'Starting…' : '🔄 Force Re-sync Goals — презапиши всички'}
              </button>
            </div>
            <p className="admin-hint">Пише голмайсторите (GoalsJson) за всички завършени мачове без тях. Работи в background — може да отнеме няколко минути.</p>
          </AdminSection>

          {/* ── Cleanup phantom matches ── */}
          <AdminSection title="🧹 Почисти фантомни мачове (грешна лига)">
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'phantom-debug'}
                onClick={() => run('phantom-debug', () => api.get('/admin/sync/debug/upcoming-phantom'))}>
                {loading === 'phantom-debug' ? 'Checking…' : '🔍 Debug — виж LeagueCodes на предстоящите мачове'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'phantom-dry'}
                onClick={() => run('phantom-dry', () => api.delete('/admin/sync/matches/cleanup-phantom?dryRun=true'))}>
                {loading === 'phantom-dry' ? 'Checking…' : '🔍 Preview — покажи фантомните за изтриване'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'phantom-delete'}
                onClick={() => run('phantom-delete', () => api.delete('/admin/sync/matches/cleanup-phantom?dryRun=false'))}>
                {loading === 'phantom-delete' ? 'Deleting…' : '🗑️ Изтрий фантомните мачове'}
              </button>
            </div>
            <p className="admin-hint">Debug показва homeLeague/awayLeague за всеки предстоящ мач. Изтриването маха мачове с различни лиги без залози/прогнози.</p>
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 8 }}>
              Мачове, при които <b>и двата</b> отбора имат и друг мач на същия ден — сигурни фантоми (Newcastle vs Fulham тип)
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'same-day-dry'}
                onClick={() => run('same-day-dry', () => api.delete('/admin/sync/matches/same-day-phantoms?dryRun=true'))}>
                {loading === 'same-day-dry' ? 'Checking…' : '🔍 Preview — same-day фантоми'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'same-day-delete'}
                onClick={() => run('same-day-delete', () => api.delete('/admin/sync/matches/same-day-phantoms?dryRun=false'))}>
                {loading === 'same-day-delete' ? 'Deleting…' : '🗑️ Изтрий same-day фантоми'}
              </button>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 8 }}>
              Мачове без кръг (MatchDay = null) — Sportmonks не ги е върнал = не съществуват
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'no-round-dry'}
                onClick={() => run('no-round-dry', () => api.delete('/admin/sync/matches/no-round-phantoms?dryRun=true'))}>
                {loading === 'no-round-dry' ? 'Checking…' : '🔍 Preview — мачове без кръг'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'no-round-delete'}
                onClick={() => run('no-round-delete', () => api.delete('/admin/sync/matches/no-round-phantoms?dryRun=false'))}>
                {loading === 'no-round-delete' ? 'Deleting…' : '🗑️ Изтрий мачове без кръг'}
              </button>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 8 }}>
              <b>Duplicate teams</b> — обедини "Leeds United" + "Leeds United FC" в едно. Преади matches/bets/predictions, после изтрива дублиращия Team ред.
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'dup-teams-preview'}
                onClick={() => run('dup-teams-preview', () => api.get('/admin/sync/cleanup/duplicate-teams-preview'))}>
                {loading === 'dup-teams-preview' ? 'Loading…' : '🔍 Preview duplicate teams'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn" type="button" disabled={loading === 'dup-teams-dry'}
                onClick={() => run('dup-teams-dry', () => api.post('/admin/sync/cleanup/duplicate-teams?dryRun=true'))}>
                {loading === 'dup-teams-dry' ? 'Checking…' : '🔍 Dry run merge plan'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'dup-teams-merge'}
                onClick={() => {
                  if (!window.confirm('Това ще обедини duplicate teams и ще изтрие дублиращите Match рoeve. Сигурен ли си?')) return;
                  run('dup-teams-merge', () => api.post('/admin/sync/cleanup/duplicate-teams?dryRun=false'));
                }}>
                {loading === 'dup-teams-merge' ? 'Merging…' : '🔧 Merge duplicate teams'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 8 }}>
              <b>Stuck statuses</b> — IN_PLAY/TIMED мачове с MatchDate &gt; 6 ч назад → FINISHED, IN_PLAY мачове &gt; 12 ч напред → TIMED. Поправя Liverpool-from-Friday и Arsenal-tomorrow видими като live.
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'stuck-dry'}
                onClick={() => run('stuck-dry', () => api.post('/admin/sync/cleanup/fix-stuck-statuses?dryRun=true'))}>
                {loading === 'stuck-dry' ? 'Checking…' : '🔍 Preview stuck statuses'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--danger" type="button" disabled={loading === 'stuck-fix'}
                onClick={() => run('stuck-fix', () => api.post('/admin/sync/cleanup/fix-stuck-statuses?dryRun=false'))}>
                {loading === 'stuck-fix' ? 'Fixing…' : '🔧 Fix stuck statuses'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 8 }}>
              Намери мач по отбор → виж ID → изтрий го директно
            </div>
            <TeamMatchSearch />
          </AdminSection>

          {/* ── Venue / Stadium Images ── */}
          <AdminSection title="Venue / Stadium Images">
            <p className="admin-hint" style={{ marginTop: 0 }}>
              Търси стадион по име в Sportmonks и виж снимката, която ще се покаже в match detail-а.
            </p>
            <VenueLookup />
          </AdminSection>

          {/* ── Real Odds (Sportmonks) ── */}
          <AdminSection title="Real Odds (Sportmonks)">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'sync-odds'}
                onClick={() => run('sync-odds', () => api.post('/admin/sync/odds/sync-1x2'))}>
                {loading === 'sync-odds' ? 'Syncing…' : '📊 Sync 1X2 Odds Now'}
              </button>
            </div>
            <p className="admin-hint">Дърпа реални коефициенти от Sportmonks за всички предстоящи мачове (следващите 7 дни). Автоматично се пуска на 15 мин, но тук може ръчно.</p>
            <div className="admin-row" style={{ marginTop: 12 }}>
              <label className="admin-label">Fixture ID</label>
              <input className="admin-input" value={matchId}
                onChange={e => setMatchId(e.target.value)} placeholder="Sportmonks fixture ID" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'debug-odds' || !matchId}
                onClick={() => run('debug-odds', () => api.get(`/admin/sync/debug/odds/${matchId}`))}>
                {loading === 'debug-odds' ? 'Checking…' : '🔍 Debug — виж суровите коефициенти'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'debug-odds-raw' || !matchId}
                onClick={() => run('debug-odds-raw', () => api.get(`/admin/sync/debug/odds-raw/${matchId}`))}>
                {loading === 'debug-odds-raw' ? 'Fetching…' : '📄 Raw Response — виж точния Sportmonks отговор'}
              </button>
            </div>
            <p className="admin-hint">Debug odds — показва всички пазари и коефициенти от Sportmonks за конкретен fixture. Използвай ExternalId на мача.</p>
          </AdminSection>

          {/* ── Score Predictions ── */}
          <AdminSection title="Score Predictions / Force Re-sync Stats">
            <div className="admin-row">
              <label className="admin-label">Match ID</label>
              <input className="admin-input" value={matchId}
                onChange={e => setMatchId(e.target.value)} placeholder="Match ID" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'debug-match-stats' || !matchId}
                onClick={() => run('debug-match-stats', () => api.get(`/admin/sync/debug/match-stats/${matchId}`))}>
                {loading === 'debug-match-stats' ? 'Checking…' : '🔍 Debug — виж Sportmonks events за мача'}
              </button>
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'score' || !matchId}
                onClick={() => run('score', () => api.post(`/admin/sync/score/predictions/${matchId}`))}>
                {loading === 'score' ? 'Scoring…' : 'Score Predictions'}
              </button>
            </div>
            <div className="admin-actions" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'force-stats' || !matchId}
                onClick={() => run('force-stats', () => api.post(`/admin/sync/matches/${matchId}/force-sync-stats`))}>
                {loading === 'force-stats' ? 'Syncing…' : '⚡ Force Re-sync Stats + Re-resolve Bets'}
              </button>
            </div>
            <p className="admin-hint">Force Re-sync — изтрива старите статистики и ги дърпа наново от Sportmonks, после пренасмята всички залози за мача (включително изгубени голмайстори).</p>
          </AdminSection>

        </div>

        {feedback && (
          <pre className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'} admin-feedback`}>
            {feedback.text}
          </pre>
        )}
      </section>
    </div>
  );
}
