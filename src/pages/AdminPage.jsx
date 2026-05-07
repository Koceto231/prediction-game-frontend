import { useState, useEffect } from 'react';
import api from '../api/apiClient';

const SM_LEAGUES = ['BGL', 'PL', 'BL1', 'SA', 'PD'];

// Format a Date as yyyy-MM-dd for <input type="date">
function toDateInput(d) {
  return d.toISOString().slice(0, 10);
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
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState('');

  useEffect(() => {
    api.get('/Fantasy/admin/gameweeks').then(r => setGameweeks(r.data ?? [])).catch(() => {});
  }, []);

  const run = async (key, fn) => {
    setLoading(key);
    setFeedback(null);
    try {
      const res = await fn();
      setFeedback({ ok: true, text: typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data) });
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || err?.response?.data || 'Failed.' });
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
          </AdminSection>

          {/* ── Historical match import ── */}
          <AdminSection title="Import Match History (Sportmonks)">
            <div className="admin-row">
              <label className="admin-label">League</label>
              <select className="admin-input" value={histLeague} onChange={e => setHistLeague(e.target.value)}>
                {SM_LEAGUES.map(l => (
                  <option key={l} value={l}>{l === 'BGL' ? 'BGL — efbet Liga' : l}</option>
                ))}
              </select>
            </div>
            <div className="admin-row">
              <label className="admin-label">Days back</label>
              <input className="admin-input" value={histDaysBack}
                onChange={e => setHistDaysBack(e.target.value)} placeholder="365" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'history'}
                onClick={() => run('history', () =>
                  api.post(`/admin/sync/matches/history?leagueCode=${histLeague}&daysBack=${histDaysBack}`))}>
                {loading === 'history' ? 'Importing…' : `Import ${histLeague} History`}
              </button>
            </div>
            <p className="admin-hint">Вкарва свършените мачове за последните N дни. Пусни веднъж за коректни коефиценти.</p>
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

            <div className="admin-row" style={{ marginTop: 10 }}>
              <label className="admin-label">Anchor date</label>
              <input type="date" className="admin-input" value={gwAnchorDate}
                onChange={e => setGwAnchorDate(e.target.value)} />
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'force-gw' || !gwAnchorDate}
                onClick={() => run('force-gw', () =>
                  api.post(`/Fantasy/admin/gameweek/force?anchorDate=${gwAnchorDate}`))}>
                {loading === 'force-gw' ? 'Creating…' : '📅 Force Create GW (no matches needed)'}
              </button>
            </div>
            <p className="admin-hint">Създава GW от избраната дата дори без мачове в DB. Петък 10:00 → следващ Вторник 10:00.</p>
          </AdminSection>

          {/* ── Fantasy: Complete Gameweek ── */}
          <AdminSection title="Fantasy — Gameweek Status">
            {gameweeks.length === 0 ? (
              <p className="admin-hint">No gameweeks found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...gameweeks].reverse().slice(0, 5).map(gw => (
                  <div key={gw.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.80rem' }}>
                    <span style={{ minWidth: 40, fontWeight: 700, color: 'var(--accent)' }}>GW{gw.gameWeek}</span>
                    <span style={{ flex: 1, color: 'var(--text-soft)' }}>
                      {new Date(gw.deadline).toLocaleDateString()}
                    </span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px',
                      borderRadius: 3, letterSpacing: '0.06em',
                      background: gw.isCompleted ? 'rgba(255,255,255,0.06)' : gw.isLocked ? 'rgba(255,96,96,0.15)' : 'rgba(240,197,25,0.15)',
                      color: gw.isCompleted ? 'var(--text-soft)' : gw.isLocked ? '#ff6060' : 'var(--accent)',
                    }}>
                      {gw.isCompleted ? 'DONE' : gw.isLocked ? 'LOCKED' : 'ACTIVE'}
                    </span>
                    {!gw.isCompleted && (
                      <button className="admin-btn" type="button"
                        style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                        disabled={loading === `complete-${gw.id}`}
                        onClick={() => run(`complete-${gw.id}`, async () => {
                          const r = await api.post(`/Fantasy/admin/gameweek/${gw.id}/complete`);
                          setGameweeks(prev => prev.map(g => g.id === gw.id ? { ...g, isCompleted: true, isLocked: true } : g));
                          return r;
                        })}>
                        {loading === `complete-${gw.id}` ? '…' : '✓ Complete'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="admin-hint" style={{ marginTop: 8 }}>Mark a GW as completed to unlock the next one for users.</p>
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

          {/* ── Score Predictions ── */}
          <AdminSection title="Score Predictions">
            <div className="admin-row">
              <label className="admin-label">Match ID</label>
              <input className="admin-input" value={matchId}
                onChange={e => setMatchId(e.target.value)} placeholder="Match ID" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'score' || !matchId}
                onClick={() => run('score', () => api.post(`/admin/sync/score/predictions/${matchId}`))}>
                {loading === 'score' ? 'Scoring…' : 'Score Predictions'}
              </button>
            </div>
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
