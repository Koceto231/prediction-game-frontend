import { useState } from 'react';
import api from '../api/apiClient';

export default function AdminPage() {
  const [competitionIdOrCode, setCompetitionIdOrCode] = useState('PL');
  const [matchId, setMatchId] = useState('1');
  const [feedback, setFeedback] = useState('');

  const importTeams = async () => {
    try {
      const res = await api.post(`/admin/sync/teams?competitionIdOrCode=${competitionIdOrCode}`);
      setFeedback(JSON.stringify(res.data));
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Import teams failed.');
    }
  };

  const importMatches = async () => {
    try {
      const res = await api.post(`/admin/sync/matches?competitionIdOrCode=${competitionIdOrCode}`);
      setFeedback(JSON.stringify(res.data));
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Import matches failed.');
    }
  };

  const scorePredictions = async () => {
    try {
      const res = await api.post(`/admin/sync/score/predictions/${matchId}`);
      setFeedback(JSON.stringify(res.data));
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Scoring failed.');
    }
  };

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Admin Panel</h2>
            <p>Sync data and score predictions.</p>
          </div>
        </div>

        <div className="prediction-form">
          <label>
            Competition code
            <input value={competitionIdOrCode} onChange={(e) => setCompetitionIdOrCode(e.target.value)} />
          </label>

          <button className="primary-button" type="button" onClick={importTeams}>
            Import Teams
          </button>

          <button className="primary-button" type="button" onClick={importMatches}>
            Import Matches
          </button>

          <label>
            Match ID
            <input value={matchId} onChange={(e) => setMatchId(e.target.value)} />
          </label>

          <button className="primary-button" type="button" onClick={scorePredictions}>
            Score Predictions
          </button>

          {feedback && <div className="alert alert-info">{feedback}</div>}
        </div>
      </section>
    </div>
  );
}