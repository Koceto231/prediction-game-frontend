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
  const [historyUser, setHistoryUser] = useState(null);

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

  const setRole = async (userId, nextRole) => {
    if (!window.confirm(nextRole === 'Admin'
        ? 'Направи този потребител админ?'
        : 'Махни admin правата на този потребител?')) return;
    setFeedback('');
    try {
      const r = await api.post('/admin/wallet/set-role', { userId, role: nextRole });
      setUsers(us => us.map(u => u.id === userId ? { ...u, role: r.data.role } : u));
      setFeedback(nextRole === 'Admin' ? 'Потребителят вече е админ.' : 'Admin правата са премахнати.');
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Промяната на роля се провали.');
    }
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm(
      `Изтрий "${username}" завинаги? Залозите, прогнозите и fantasy данните се изтриват необратимо.`
    )) return;
    setFeedback('');
    try {
      await api.delete(`/admin/wallet/users/${userId}`);
      setUsers(us => us.filter(u => u.id !== userId));
      setFeedback('Потребителят е изтрит.');
    } catch (e) {
      setFeedback(e?.response?.data?.message || 'Изтриването се провали.');
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
      // Notify the rest of the app — the navbar / profile read this
      // signal and update without a page refresh.
      window.dispatchEvent(new CustomEvent('bpfl:wallet:refresh', {
        detail: { balance: r.data.balance },
      }));
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
      <div className="admin-self-topup">
        <span className="admin-self-topup__label">На себе си</span>
        <input className="admin-input admin-self-topup__amount" value={selfAmount}
          onChange={e => setSelfAmount(e.target.value)}
          type="number" min="1" />
        <button className="admin-btn admin-btn--accent admin-self-topup__btn"
          type="button" onClick={selfTopUp}>
          Добави
        </button>
      </div>

      {/* Filter + reload */}
      <div className="admin-filter-bar">
        <input className="admin-input admin-filter-bar__input"
          placeholder="Търси потребител…"
          value={filter} onChange={e => setFilter(e.target.value)} />
        <button className="admin-btn admin-filter-bar__reload" type="button"
          title="Презареди списъка" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      {feedback && (
        <p className="admin-hint" style={{ color: 'var(--accent)' }}>{feedback}</p>
      )}

      {/* User list — overflowX:auto so the fixed-width grid stays aligned
          and just adds a horizontal scrollbar if the row is wider than the
          container. */}
      <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'auto',
                    border: '1px solid var(--border)', borderRadius: 6 }}>
        {filtered.map(u => (
          <UserBalanceRow key={u.id} user={u}
            onAdjust={adjust} onSetRole={setRole} onDelete={deleteUser}
            onShowHistory={() => setHistoryUser(h => h?.id === u.id ? null : u)}
            historyActive={historyUser?.id === u.id} />
        ))}
        {filtered.length === 0 && (
          <p className="admin-hint" style={{ padding: 10 }}>Няма потребители за показване.</p>
        )}
      </div>

      {/* Inline bet-history panel — opens right below the list instead of
          a centred modal so the admin sees both the users and the
          selected user's history without leaving the page flow. */}
      {historyUser && (
        <UserBetHistoryPanel user={historyUser} onClose={() => setHistoryUser(null)} />
      )}
    </div>
  );
}

function UserBalanceRow({ user, onAdjust, onSetRole, onDelete, onShowHistory, historyActive }) {
  const [delta, setDelta] = useState('100');
  const isAdmin = user.role === 'Admin';

  return (
    <div className="admin-user-row">
      <div className="admin-user-row__head">
        <div className="admin-user-row__identity">
          <div className="admin-user-row__name">
            {user.username}
            {isAdmin && <span className="admin-user-row__admin-tag">admin</span>}
          </div>
          <div className="admin-user-row__email">{user.email}</div>
        </div>
        <div className="admin-user-row__balance">
          {Number(user.balance).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="admin-user-row__balance-unit">монети</span>
        </div>
      </div>

      <div className="admin-user-row__adjust">
        <input className="admin-input admin-user-row__delta" type="number" value={delta}
          onChange={e => setDelta(e.target.value)} />
        <button className="admin-btn admin-btn--accent admin-user-row__icon-btn" type="button"
          title="Добави" onClick={() => onAdjust(user.id, Number(delta))}>+</button>
        <button className="admin-btn admin-btn--danger admin-user-row__icon-btn" type="button"
          title="Извади" onClick={() => onAdjust(user.id, -Math.abs(Number(delta)))}>−</button>
      </div>

      <div className="admin-user-row__actions">
        <button className={`admin-btn admin-user-row__action${historyActive ? ' admin-user-row__action--active' : ''}`}
          type="button" title={`Виж залозите на ${user.username}`}
          onClick={onShowHistory}>📊 История</button>
        <button className="admin-btn admin-user-row__action" type="button"
          title={isAdmin ? `Махни admin от ${user.username}` : `Направи ${user.username} admin`}
          onClick={() => onSetRole(user.id, isAdmin ? 'User' : 'Admin')}>
          {isAdmin ? '★ Махни' : '☆ Admin'}
        </button>
        <button className="admin-btn admin-btn--danger admin-user-row__action" type="button"
          title={`Изтрий профила на ${user.username}`}
          onClick={() => onDelete(user.id, user.username)}>🗑 Изтрий</button>
      </div>
    </div>
  );
}

/** Inline panel that loads /admin/wallet/users/{id}/bets — renders right
    below the user list so the admin sees both side by side, no modal. */
function UserBetHistoryPanel({ user, onClose }) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('all'); // '24h' | '7d' | '30d' | 'all'

  useEffect(() => {
    let cancelled = false;
    api.get(`/admin/wallet/users/${user.id}/bets`)
      .then(r => { if (!cancelled) { setData(r.data); setLoading(false); } })
      .catch(e => {
        if (cancelled) return;
        setError(e?.response?.data?.message || 'Зареждането се провали.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user.id]);

  // Numbers only — the panel already labels itself "в монети" so we
  // don't repeat the unit on every line. Use bg-BG locale so 4449 → 4 449.
  const fmtNum = (n) => Number(n ?? 0).toLocaleString('bg-BG', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const fmtDate  = (d) => d ? new Date(d).toLocaleString('bg-BG', {
    dateStyle: 'short', timeStyle: 'short',
  }) : '—';

  const statusLabel = (s) => {
    switch (s) {
      case 'Pending':   return 'Очаква';
      case 'Won':       return 'Спечелен';
      case 'Lost':      return 'Загубен';
      case 'Void':      return 'Анулиран';
      case 'CashedOut': return 'Изтеглен';
      default:          return s;
    }
  };
  const statusColor = (s) => {
    if (s === 'Won' || s === 'CashedOut') return '#27c76f';
    if (s === 'Lost')    return '#e74c3c';
    return 'var(--text-muted)';
  };

  // Time-period filter — cutoff in ms from now.
  const cutoffMs = (() => {
    const DAY = 24 * 60 * 60 * 1000;
    if (period === '24h') return Date.now() - DAY;
    if (period === '7d')  return Date.now() - 7 * DAY;
    if (period === '30d') return Date.now() - 30 * DAY;
    return 0; // all-time
  })();
  const filteredBets = (data?.bets ?? []).filter(b => {
    if (!cutoffMs) return true;
    return new Date(b.createdAt).getTime() >= cutoffMs;
  });
  // Re-aggregate stats over the filtered window so the strip matches
  // what's actually shown below it.
  const filteredStats = filteredBets.reduce((acc, b) => ({
    totalBets:     acc.totalBets + 1,
    totalStaked:   acc.totalStaked + Number(b.amount),
    totalWon:      acc.totalWon + ((b.status === 'Won' || b.status === 'CashedOut') ? Number(b.actualPayout ?? 0) : 0),
    pendingStaked: acc.pendingStaked + (b.status === 'Pending' ? Number(b.amount) : 0),
  }), { totalBets: 0, totalStaked: 0, totalWon: 0, pendingStaked: 0 });
  filteredStats.netProfit = filteredStats.totalWon - filteredStats.totalStaked + filteredStats.pendingStaked;

  return (
    <div style={{
      marginTop: 16,
      background: 'var(--surface, #161616)',
      border: '1px solid var(--accent)', borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border, #2a2a2a)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              История на залозите — {user.username}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {user.email} · всички суми в монети 🪙
            </div>
          </div>
          <button type="button" className="admin-btn" onClick={onClose}
            style={{ padding: '4px 10px' }}>×</button>
        </div>

        {data?.stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
            padding: '12px 18px', borderBottom: '1px solid var(--border, #2a2a2a)',
            fontSize: '0.82rem',
          }}>
            <Stat label="Залози" value={filteredStats.totalBets} />
            <Stat label="Заложено общо" value={fmtNum(filteredStats.totalStaked)} />
            <Stat label="Спечелено общо" value={fmtNum(filteredStats.totalWon)} color="#27c76f" />
            <Stat label="Очаква" value={fmtNum(filteredStats.pendingStaked)} />
            <Stat label="Нетна печалба"
              value={fmtNum(filteredStats.netProfit)}
              color={filteredStats.netProfit >= 0 ? '#27c76f' : '#e74c3c'} />
          </div>
        )}

        {/* Time-period filter pill row */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px',
                      borderBottom: '1px solid var(--border, #2a2a2a)',
                      flexWrap: 'wrap' }}>
          {[
            { key: '24h', label: '24 часа' },
            { key: '7d',  label: '7 дни'   },
            { key: '30d', label: 'Месец'   },
            { key: 'all', label: 'Всичко'  },
          ].map(({ key, label }) => {
            const active = period === key;
            return (
              <button key={key} type="button"
                onClick={() => setPeriod(key)}
                style={{
                  padding: '4px 12px', fontSize: '0.74rem',
                  border: '1px solid var(--border, #2a2a2a)',
                  borderRadius: 14,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#0a0a0a' : 'var(--text-muted)',
                  fontWeight: 700, cursor: 'pointer',
                }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ overflowY: 'auto', maxHeight: 340, padding: '10px 18px' }}>
          {loading && <p className="admin-hint">Зарежда…</p>}
          {error   && <p className="admin-hint" style={{ color: '#e74c3c' }}>{error}</p>}
          {!loading && !error && filteredBets.length === 0 && (
            <p className="admin-hint">
              {data?.bets?.length === 0
                ? 'Този потребител няма залози.'
                : 'Няма залози в избрания период.'}
            </p>
          )}
          {!loading && filteredBets.map(b => (
            <BetHistoryRow key={b.id} bet={b}
              fmtNum={fmtNum} fmtDate={fmtDate}
              statusLabel={statusLabel} statusColor={statusColor} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One row in the bet-history list. Accumulators show a chevron + "Колонка"
    badge; clicking expands the embedded leg list parsed from
    accumulatorLegsJson. */
function BetHistoryRow({ bet, fmtNum, fmtDate, statusLabel, statusColor }) {
  const [open, setOpen] = useState(false);
  const isAccum = bet.betType === 'Accumulator';
  const legs = (() => {
    if (!isAccum || !bet.accumulatorLegsJson) return [];
    try { return JSON.parse(bet.accumulatorLegsJson) || []; }
    catch { return []; }
  })();

  return (
    <div style={{
      padding: '10px 0', borderBottom: '1px solid var(--border, #2a2a2a)',
      fontSize: '0.86rem',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
                    alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            {isAccum && (
              <button type="button" onClick={() => setOpen(o => !o)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)',
                         cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}>
                {open ? '▾' : '▸'}
              </button>
            )}
            {isAccum && (
              <span style={{ background: 'var(--accent)', color: '#0a0a0a',
                             padding: '1px 6px', borderRadius: 4,
                             fontSize: '0.68rem', fontWeight: 800 }}>
                КОЛОНКА · {legs.length || '—'}
              </span>
            )}
            <span>{bet.homeTeam} vs {bet.awayTeam}</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {bet.leagueCode} · {fmtDate(bet.matchDate)}
          </div>
          {!isAccum && (
            <div style={{ marginTop: 4, fontSize: '0.82rem' }}>
              {bet.betType} → {' '}
              {bet.pick || bet.stringPick || (bet.scoreHome != null
                ? `${bet.scoreHome}-${bet.scoreAway}` : '—')}
              {' '} @ {Number(bet.oddsAtBetTime).toFixed(2)}
            </div>
          )}
          {isAccum && (
            <div style={{ marginTop: 4, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Общ коефициент @ {Number(bet.oddsAtBetTime).toFixed(2)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 130 }}>
          <div style={{ fontWeight: 700 }}>Залог: {fmtNum(bet.amount)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {bet.status === 'Pending'
              ? `Възм. ${fmtNum(bet.potentialPayout)}`
              : `Изплатено ${fmtNum(bet.actualPayout)}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: statusColor(bet.status), fontWeight: 700 }}>
            {statusLabel(bet.status)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {fmtDate(bet.createdAt)}
          </div>
        </div>
      </div>

      {isAccum && open && legs.length > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 6,
          fontSize: '0.82rem',
        }}>
          {legs.map((l, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 8,
              padding: '6px 0',
              borderBottom: i < legs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{l.description || '—'}</div>
                {(l.homeTeam || l.awayTeam) && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {l.homeTeam ?? '—'} vs {l.awayTeam ?? '—'}
                  </div>
                )}
              </div>
              <span style={{ color: 'var(--accent)', fontWeight: 700,
                             fontFamily: 'monospace' }}>
                {l.odds != null ? Number(l.odds).toFixed(2) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
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

  const fmtCreated = (d) => new Date(d).toLocaleString('bg-BG', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const fmtExpires = (d) => new Date(d).toLocaleDateString('bg-BG', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <div>
      {/* Send-invite form — email input full-width on mobile, two
          buttons share a row below. */}
      <div className="admin-invite-send">
        <input className="admin-input admin-invite-send__email"
          placeholder="email@example.com"
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()} />
        <div className="admin-invite-send__buttons">
          <button className="admin-btn admin-btn--accent admin-invite-send__primary"
            type="button" onClick={send}>
            Изпрати покана
          </button>
          <button className="admin-btn admin-invite-send__reload" type="button"
            title="Презареди списъка" onClick={load} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {feedback && (
        <p className="admin-hint" style={{ color: 'var(--accent)' }}>{feedback}</p>
      )}

      <div className="admin-invite-list">
        {invites.map(i => (
          <div key={i.id} className="admin-invite-row">
            <div className="admin-invite-row__main">
              <div className="admin-invite-row__email-line">
                <span className="admin-invite-row__email">{i.email}</span>
                <span className="admin-invite-row__status">{statusBadge(i.status)}</span>
              </div>
              <div className="admin-invite-row__meta">
                <span>📅 {fmtCreated(i.createdAt)}</span>
                <span>⏳ изтича {fmtExpires(i.expiresAt)}</span>
              </div>
            </div>
            <button className="admin-btn admin-btn--danger admin-invite-row__revoke"
              type="button" title="Премахни поканата"
              onClick={() => revoke(i.id)}>🗑️</button>
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
  const [debugFixtureId, setDebugFixtureId] = useState('');
  const [fdTeamSearch, setFdTeamSearch]     = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState('');

  // Gameweeks endpoint removed along with the Fantasy feature.
  useEffect(() => { setGameweeks([]); }, []);

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
    <div className="admin-page">
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

          {/* ── Sync Players (Goalscorer / Assist markets) ── */}
          <AdminSection title="Sync Players (Голмайстори / Асистенция)">
            <div className="admin-row">
              <label className="admin-label">League</label>
              <select className="admin-input" value={smLeague} onChange={e => setSmLeague(e.target.value)}>
                {SM_LEAGUES.map(l => (
                  <option key={l} value={l}>{l === 'BGL' ? 'BGL — efbet Liga' : l}</option>
                ))}
              </select>
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'sync-players'}
                onClick={() => run('sync-players', () =>
                  api.post(`/admin/sync/players/sync-squads?leagueCode=${smLeague}`))}>
                {loading === 'sync-players' ? 'Syncing…' : `⚽ Sync ${smLeague} Players`}
              </button>
            </div>
            <p className="admin-hint">Дърпа актуалните съставите от Sportmonks и добавя/обновява играчите в базата. Пусни веднъж за всяка лига — след това играчите ще се показват в секциите Голмайстори, Асистенция и Гол или асистенция.</p>
          </AdminSection>

          {/* ── Debug Odds (bookmaker check) ── */}
          <AdminSection title="Debug Odds (Bookmaker Check)">
            <div className="admin-row">
              <label className="admin-label">Sportmonks Fixture ID</label>
              <input className="admin-input" type="number" placeholder="e.g. 19134660"
                value={debugFixtureId} onChange={e => setDebugFixtureId(e.target.value)} />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button"
                disabled={loading === 'debug-odds' || !debugFixtureId}
                onClick={() => run('debug-odds', () => api.get(`/admin/debug/odds/${debugFixtureId}`))}>
                {loading === 'debug-odds' ? 'Loading…' : '🔍 Check Odds'}
              </button>
            </div>
            <p className="admin-hint">Shows raw Bet365 odds from Sportmonks for a fixture. Use this to verify bookmaker IDs and odds values match real Bet365.</p>
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

          {/* ── Flush matches cache ───────────────────────────────────── */}
          <AdminSection title="🧹 Изчисти кеша на мачовете">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button"
                disabled={loading === 'flush-cache'}
                onClick={() => run('flush-cache', () => api.post('/admin/sync/matches/flush-cache'))}>
                {loading === 'flush-cache' ? 'Чисти…' : '🧹 Изчисти кеша сега'}
              </button>
            </div>
            <p className="admin-hint">
              Когато синкнеш odds или промениш нещо в БД, frontend-ът може да показва кеширани данни още до ~1 минута.
              Този бутон веднага изчиства кеша → следващото отваряне на „Мачове" зарежда пресни данни.
            </p>
          </AdminSection>

          {/* ── Preview Bet365 odds before sync ───────────────────────── */}
          <AdminSection title="👁 Преглед на Bet365 коефициенти (преди синк)">
            <div className="admin-row">
              <label className="admin-label">Match ID</label>
              <input className="admin-input" value={matchId}
                onChange={e => setMatchId(e.target.value)} placeholder="Internal Match ID (не ExternalId)" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button"
                disabled={loading === 'preview-odds' || !matchId}
                onClick={() => run('preview-odds', () => api.get(`/admin/sync/odds/preview/${matchId}`))}>
                {loading === 'preview-odds' ? 'Зарежда…' : '👁 Покажи Bet365 преглед'}
              </button>
            </div>
            <p className="admin-hint">
              Връща пълния списък с пазари + коефициенти на Bet365 за този мач — <strong>без</strong> да записва нищо в БД.
              Чудесно за проверка преди да решиш дали да пуснеш истинско синкване.
            </p>
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
