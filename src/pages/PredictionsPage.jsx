import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const WINNER_MAP = { 1: 'Home', 2: 'Draw', 3: 'Away', Home: 'Home', Draw: 'Draw', Away: 'Away' };
const OU_LINE_MAP = { 1: '1.5', 2: '2.5', 3: '3.5', Line15: '1.5', Line25: '2.5', Line35: '3.5' };
const OU_PICK_MAP = { 1: 'Over', 2: 'Under', Over: 'Over', Under: 'Under' };

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchPredictions = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/Prediction/me');
        if (!cancelled) setPredictions(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || 'Failed to load predictions.');
          setPredictions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPredictions();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell-card panel">
      <div className="section-head">
        <div>
          <h2>My Predictions</h2>
          <p>Your latest score and market predictions.</p>
        </div>
      </div>

      {loading && <div className="empty-box">Loading predictions...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && predictions.length === 0 && (
        <div className="empty-box">No predictions found yet.</div>
      )}

      {!loading && !error && (
        <div className="cards-grid">
          {predictions.map((item) => {
            const {
              id,
              homeTeam,
              awayTeam,
              predictedHomeScore = null,
              predictedAwayScore = null,
              predictionWinner = null,
              predictionOULine = null,
              predictionOUPick = null,
              predictionBTTS = null,
              points = 0,
              createdAt = null,
            } = item;

            const hasExactScore = predictedHomeScore != null && predictedAwayScore != null;

            const winner = predictionWinner == null ? '-' : (WINNER_MAP[predictionWinner] ?? predictionWinner);
            const ouLine = predictionOULine == null ? '-' : (OU_LINE_MAP[predictionOULine] ?? predictionOULine);
            const ouPick = predictionOUPick == null ? '-' : (OU_PICK_MAP[predictionOUPick] ?? predictionOUPick);

            return (
              <div
                key={id}
                className={`prediction-card ${hasExactScore ? 'prediction-card--exact' : 'prediction-card--market'}`}
              >
                <div className="prediction-card__top">
                  <span
                    className={`prediction-card__mode ${
                      hasExactScore ? 'prediction-card__mode--exact' : 'prediction-card__mode--market'
                    }`}
                  >
                    {hasExactScore ? 'Exact Score' : 'Market Pick'}
                  </span>
                  <div className="prediction-card__points">{points} pts</div>
                </div>

                {hasExactScore ? (
                  <div className="prediction-card__scoreboard">
                    <div className="prediction-card__scoreboard-team prediction-card__scoreboard-team--home">
                      {homeTeam}
                    </div>

                    <div className="prediction-card__scorebox">{predictedHomeScore}</div>

                    <div className="prediction-card__divider">:</div>

                    <div className="prediction-card__scorebox">{predictedAwayScore}</div>

                    <div className="prediction-card__scoreboard-team prediction-card__scoreboard-team--away">
                      {awayTeam}
                    </div>
                  </div>
                ) : (
                  <div className="prediction-card__fixture">
                    <div className="prediction-card__fixture-team">{homeTeam}</div>
                    <div className="prediction-card__fixture-vs">vs</div>
                    <div className="prediction-card__fixture-team">{awayTeam}</div>
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
                      <strong>{predictionBTTS == null ? '-' : predictionBTTS ? 'Yes' : 'No'}</strong>
                    </div>
                    <div className="prediction-pill">
                      <span className="prediction-pill__label">OU</span>
                      <strong>{ouPick === '-' || ouLine === '-' ? '-' : `${ouPick} ${ouLine}`}</strong>
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
      )}
    </div>
  );
}