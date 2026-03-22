import { useEffect, useState } from 'react';
import api from '../api/apiClient';

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setError('');

        const response = await api.get('/Prediction/me');
        console.log('Predictions response:', response.data);

        const data = Array.isArray(response.data) ? response.data : [];
        setPredictions(data);
      } catch (err) {
        console.error('Predictions error:', err);
        console.error('Status:', err?.response?.status);
        console.error('Data:', err?.response?.data);

        setError(err?.response?.data?.message || err.message || 'Failed to load predictions.');
        setPredictions([]);
      }
    };

    fetchPredictions();
  }, []);

  return (
    <div className="shell-card panel">
      <div className="section-head">
        <div>
          <h2>My Predictions</h2>
          <p>Your latest score predictions.</p>
        </div>
      </div>

      {error && <div className="alert alert-info">{error}</div>}

      {!error && predictions.length === 0 && (
        <div className="empty-box">No predictions found yet.</div>
      )}
      
      <div className="cards-grid">
        {predictions.map((item) => (
          <div key={item.id} className="match-card">
            <div className="match-card__teams">
              <div className="team-row">
                <span>{item.homeTeam}</span>
                <span>{item.predictedHomeScore}</span>
              </div>
              <div className="team-row">
                <span>{item.awayTeam}</span>
                <span>{item.predictedAwayScore}</span>
              </div>
            </div>
            <div className="muted-text">
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}