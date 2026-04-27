import { useState } from 'react';
import api from '../api/apiClient';

const LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL'];

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
  const [seedLeague, setSeedLeague]           = useState('PL');
  const [seedSeason, setSeedSeason]           = useState('2024');
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

          {/* ── Teams & Matches ── */}
          <AdminSection title="Teams & Matches">
            <div className="admin-row">
              <label className="admin-label">Competition code</label>
              <input
                className="admin-input"
                value={competitionCode}
                onChange={e => setCompetitionCode(e.target.value.toUpperCase())}
                placeholder="PL, PD, SA…"
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

          {/* ── Seed Players ── */}
          <AdminSection title="Seed Fantasy Players (api-sports)">
            <div className="admin-row">
              <label className="admin-label">League</label>
              <select className="admin-input" value={seedLeague} onChange={e => setSeedLeague(e.target.value)}>
                {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="admin-row">
              <label className="admin-label">Season</label>
              <input className="admin-input" value={seedSeason}
                onChange={e => setSeedSeason(e.target.value)} placeholder="2024" />
            </div>
            <div className="admin-actions">
              <button className="admin-btn admin-btn--accent" type="button" disabled={loading === 'seed'}
                onClick={() => run('seed', () => api.post(`/admin/sync/seed-players?league=${seedLeague}&season=${seedSeason}`))}>
                {loading === 'seed' ? 'Seeding…' : `Seed ${seedLeague} Players`}
              </button>
            </div>
            <p className="admin-hint">Uses ~21 api-sports requests per league. Run once per season.</p>
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
