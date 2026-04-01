import { useState } from 'react';
import api from '../api/apiClient';

export default function CreatePredictionForm({ match, onSuccess }) {
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');

  const [btts, setBtts] = useState('');
  const [winner, setWinner] = useState('');
  const [ouLine, setOuLine] = useState('');
  const [ouPick, setOuPick] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = {
        matchId: match.id,
        predictionHomeScore: homeScore !== '' ? Number(homeScore) : null,
        predictionAwayScore: awayScore !== '' ? Number(awayScore) : null,
        predictionWinner: winner || null,
        predictionBTTS: btts === '' ? null : btts === 'true',
        predictionOULine: ouLine || null,
        predictionOUPick: ouPick || null
      };

      const res = await api.post('/Prediction', payload);

      console.log('Prediction result:', res.data);

      onSuccess?.();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Failed to create prediction');
    } finally {
      setLoading(false);
    }
  };

  if (!match) return null;

  return (
    <div className="prediction-form panel">
      <h3>Make Prediction</h3>

      <div className="score-predict">
        <div className="score-team score-team--home">
          <span className="score-team__name">{match.homeTeamName}</span>
          <input
            type="number"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
          />
        </div>

        <div className="score-separator">:</div>

        <div className="score-team score-team--away">
          <input
            type="number"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
          />
          <span className="score-team__name">{match.awayTeamName}</span>
        </div>
      </div>

      {/* WINNER */}
      <label>
        Winner
        <select value={winner} onChange={(e) => setWinner(e.target.value)}>
          <option value="">-- optional --</option>
          <option value="Home">Home</option>
          <option value="Draw">Draw</option>
          <option value="Away">Away</option>
        </select>
      </label>

      {/* BTTS */}
      <label>
        BTTS (Both Teams To Score)
        <select value={btts} onChange={(e) => setBtts(e.target.value)}>
          <option value="">-- optional --</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>

      {/* OU LINE */}
      <label>
        Over/Under Line
        <select value={ouLine} onChange={(e) => setOuLine(e.target.value)}>
          <option value="">-- optional --</option>
          <option value="Line15">1.5</option>
          <option value="Line25">2.5</option>
          <option value="Line35">3.5</option>
        </select>
      </label>

      {/* OU PICK */}
      <label>
        Over / Under
        <select value={ouPick} onChange={(e) => setOuPick(e.target.value)}>
          <option value="">-- optional --</option>
          <option value="Over">Over</option>
          <option value="Under">Under</option>
        </select>
      </label>

      <button
        className="primary-button"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Submit Prediction'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}