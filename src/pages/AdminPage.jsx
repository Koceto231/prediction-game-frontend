import { useState } from 'react';
import api from '../api/apiClient';

const SM_LEAGUES = ['BGL', 'PL', 'BL1', 'SA', 'PD'];

function AdminSection({ title, children }) {
  return (
    <div className="admin-section">
      <div className="admin-section__title">{title}</div>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [smLeague, setSmLeague]       = useState('BGL');
  const [smDays, setSmDays]           = useState('30');
  const [histLeague, setHistLeague]   = useState('BGL');
  const [histDaysBack, setHistDaysBack] = useState('365');
  const [matchId, setMatchId]         = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState('');

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
