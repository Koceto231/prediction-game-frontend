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

        setError(
          err?.response?.data?.message ||
            err.message ||
            'Failed to load predictions.'
        );
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
          <p>Your latest score and market predictions.</p>
        </div>
      </div>

      {error && <div className="alert alert-info">{error}</div>}

      {!error && predictions.length === 0 && (
        <div className="empty-box">No predictions found yet.</div>
      )}

      <div className="cards-grid">
        {predictions.map((item) => {
          const id = item.id ?? item.Id;

          const homeTeam = item.homeTeam ?? item.HomeTeam;
          const awayTeam = item.awayTeam ?? item.AwayTeam;

          const predictedHomeScore =
            item.predictedHomeScore ?? item.PredictedHomeScore ?? null;
          const predictedAwayScore =
            item.predictedAwayScore ?? item.PredictedAwayScore ?? null;

          const winnerRaw =
            item.predictionWinner ?? item.PredictionWinner ?? null;
          const ouLineRaw =
            item.predictionOULine ?? item.PredictionOULine ?? null;
          const ouPickRaw =
            item.predictionOUPick ?? item.PredictionOUPick ?? null;
          const btts = item.predictionBTTS ?? item.PredictionBTTS ?? null;
          const points = item.points ?? item.Points ?? 0;
          const createdAt = item.createdAt ?? item.CreatedAt ?? null;

          const winnerMap = {
            1: 'Home',
            2: 'Draw',
            3: 'Away'
          };

          const ouLineMap = {
            1: '1.5',
            2: '2.5',
            3: '3.5',
            Line15: '1.5',
            Line25: '2.5',
            Line35: '3.5'
          };

          const ouPickMap = {
            1: 'Over',
            2: 'Under',
            Over: 'Over',
            Under: 'Under'
          };

          const winner =
            winnerRaw == null ? '-' : winnerMap[winnerRaw] ?? winnerRaw;

          const ouLine =
            ouLineRaw == null ? '-' : ouLineMap[ouLineRaw] ?? ouLineRaw;

          const ouPick =
            ouPickRaw == null ? '-' : ouPickMap[ouPickRaw] ?? ouPickRaw;

          const hasExactScore =
            predictedHomeScore != null && predictedAwayScore != null;

          return (
            <div
              key={id}
              className={`prediction-card ${
                hasExactScore
                  ? 'prediction-card--exact'
                  : 'prediction-card--market'
              }`}
            >
              <div className="prediction-card__top">
                <span
                  className={`prediction-card__mode ${
                    hasExactScore
                      ? 'prediction-card__mode--exact'
                      : 'prediction-card__mode--market'
                  }`}
                >
                  {hasExactScore ? 'Exact Score' : 'Market Pick'}
                </span>

                <div className="prediction-card__points">{points} pts</div>
              </div>

              {hasExactScore ? (
                <div className="prediction-card__scorebox">
                  <div className="prediction-card__team">
                    <span className="prediction-card__team-name">
                      {homeTeam}
                    </span>
                    <span className="prediction-card__score">
                      {predictedHomeScore}
                    </span>
                  </div>

                  <div className="prediction-card__divider">:</div>

                  <div className="prediction-card__team prediction-card__team--away">
                    <span className="prediction-card__score">
                      {predictedAwayScore}
                    </span>
                    <span className="prediction-card__team-name">
                      {awayTeam}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="prediction-card__fixture">
                  <div className="prediction-card__fixture-team">
                    {homeTeam}
                  </div>
                  <div className="prediction-card__fixture-vs">vs</div>
                  <div className="prediction-card__fixture-team">
                    {awayTeam}
                  </div>
                </div>
              )}

              {!hasExactScore && (
                <div className="market-grid">
                  <div className="prediction-pill">
                    <span className="prediction-pill__label">Winner</span>
                    <strong>{winner}</strong>
                  </div>

                  <div className="prediction-pill">
                    <span className="prediction-pill__label">BTTS</span>
                    <strong>
                      {btts === null || btts === undefined
                        ? '-'
                        : btts
                        ? 'Yes'
                        : 'No'}
                    </strong>
                  </div>

                  <div className="prediction-pill">
                    <span className="prediction-pill__label">OU</span>
                    <strong>
                      {ouPick === '-' || ouLine === '-'
                        ? '-'
                        : `${ouPick} ${ouLine}`}
                    </strong>
                  </div>
                </div>
              )}

              <div className="prediction-card__footer">
                {createdAt ? new Date(createdAt).toLocaleString() : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}