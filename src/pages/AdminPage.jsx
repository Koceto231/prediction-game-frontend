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
  const [competitionCode, setCompetitionCode] = useState('PL');
  const [matchId, setMatchId]                 = useState('');
  const [smLeague, setSmLeague]               = useState('BGL');
  const [smDays, setSmDays]                   = useState('30');
  const [feedback, setFeedback]               = useState(null);
  const [loading, setLoading]                 = useState('');

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

          {/* ── Teams & Matches (football-data.org) ── */}
          <AdminSection title="Teams & Matches (football-data.org)">
            <div className="admin-row">
              <label className="admin-label">Competition code</label>
              <input
                className="admin-input"
                value={competitionCode}
                onChange={e => setCompetitionCode(e.target.value.toUpperCase())}
                placeholder="PL, PD, SA, BL1…"
              />
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" disabled={loading === 'teams'}
                onClick={() => run('teams', () => api.post(`/admin/sync/teams?competitionIdOrCode=${competitionCode}`))}>
                {loading === 'teams' ? 'Importing…' : 'Import Teams'}
              </button>
              <button className="admin-btn" type="button" disabled={loading === 'matches'}
                onClick={() => run('matches', () => api.post(`/admin/sync/matches?competitionIdOrCode=${competitionCode}`))}>
                {loading === 'matches' ? 'Importing…' : 'Import Matches'}
              </button>
            </div>
          </AdminSection>

          {/* ── Sportmonks — efbet Liga & other leagues ── */}
          <AdminSection title="Matches via Sportmonks (efbet Liga, PL, …)">
            <div className="admin-row">
              <label className="admin-label">League</label>
              <select className="admin-input" value={smLeague} onChange={e => setSmLeague(e.target.value)}>
                {SM_LEAGUES.map(l => <option key={l} value={l}>{l === 'BGL' ? 'BGL — efbet Liga' : l}</option>)}
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

          {/* ── Fantasy Players ── */}
          <AdminSection title="Fantasy Players">
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'sync-players'}
                onClick={() => run('sync-players', () => api.post('/admin/sync/sync-players'))}>
                {loading === 'sync-players' ? 'Syncing…' : 'Sync Players from Squads'}
              </button>
            </div>
            <p className="admin-hint">Fetches squad data from football-data.org for all teams. Run once per season.</p>
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
