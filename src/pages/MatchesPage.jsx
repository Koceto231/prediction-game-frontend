import { useEffect, useState, useRef } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [homeScore, setHomeScore] = useState('1');
  const [awayScore, setAwayScore] = useState('0');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [aiPrediction, setAiPrediction] = useState(null);
  const predictionRef = useRef(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoadError('');
        const response = await api.get('/Match/upcoming?take=20');
        setMatches(response.data);
      } catch (error) {
        setLoadError(error?.response?.data?.message || error?.message || 'Failed to load matches.');
        setMatches([]);
      }
    };

    fetchMatches();
  }, []);

  const submitPrediction = async () => {
    if (!selectedMatch) return;

    setLoading(true);
    setFeedback('');
    setAiPrediction(null);

    try {
      const response = await api.post('/Prediction', {
        matchId: selectedMatch.id,
        predictionHomeScore: Number(homeScore),
        predictionAwayScore: Number(awayScore)
      });

      console.log('Prediction response:', response.data);

      const result = response.data;
      const rawAi = result.aiPredictionResponseDTO || result.AIPredictionResponseDTO || null;

      const aiResult = rawAi
        ? {
          predictedHomeScore: rawAi.predictedHomeScore ?? rawAi.PredictedHomeScore,
          predictedAwayScore: rawAi.predictedAwayScore ?? rawAi.PredictedAwayScore,
          pick: rawAi.pick ?? rawAi.Pick,
          confidence: rawAi.confidence ?? rawAi.Confidence,
          homeWinProbability: rawAi.homeWinProbability ?? rawAi.HomeWinProbability,
          drawProbability: rawAi.drawProbability ?? rawAi.DrawProbability,
          awayWinProbability: rawAi.awayWinProbability ?? rawAi.AwayWinProbability
        }
        : null;

      console.log('Normalized AI:', aiResult);

      setAiPrediction({ ...aiResult });
      setFeedback('Prediction created successfully.');
    } catch (err) {
      console.error('Prediction error:', err);
      setFeedback(err?.response?.data?.message || err.message || 'Could not create prediction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Upcoming Matches</h2>
            <p>Choose a fixture and create your score prediction.</p>
          </div>
        </div>

        {loadError && <div className="alert alert-info">{loadError}</div>}

        <div className="cards-grid">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              selected={selectedMatch?.id === match.id}
              onSelect={(pickedMatch) => {
                setSelectedMatch(pickedMatch);
                setAiPrediction(null);
                setFeedback('');

                setTimeout(() => {
                  predictionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                  });
                }, 100);
              }}
            />
          ))}
          {matches.length === 0 && !loadError && <div className="empty-box">No matches available yet.</div>}
        </div>
      </section>

      <section ref={predictionRef} className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Prediction Builder</h2>
            <p>Quick, focused and easy to use.</p>
          </div>
        </div>

        {!selectedMatch ? (
          <div className="empty-box">Select a match to start predicting.</div>
        ) : (
          <div className="prediction-form">
            <div className="selected-match">
              <strong>{selectedMatch.homeTeamName} vs {selectedMatch.awayTeamName}</strong>
            </div>

            <div className="score-predict">
              <div className="score-team score-team--home">
                <span className="score-team__name">{selectedMatch.homeTeamName}</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="score-separator">:</div>

              <div className="score-team score-team--away">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <span className="score-team__name">{selectedMatch.awayTeamName}</span>
              </div>
            </div>

            <button className="primary-button" onClick={submitPrediction} disabled={loading} type="button">
              {loading ? 'Saving...' : 'Create Prediction'}
            </button>

            {feedback && <div className="alert alert-info">{feedback}</div>}

            {aiPrediction && (
              <div className="ai-card">
                <h3>AI Prediction</h3>
                <div className="ai-grid">
                  <div>
                    <span className="muted-text">Predicted Score</span>
                    <div className="ai-value">
                      {aiPrediction.predictedHomeScore} - {aiPrediction.predictedAwayScore}
                    </div>
                  </div>

                  <div>
                    <span className="muted-text">Pick</span>
                    <div className="ai-value">{aiPrediction.pick}</div>
                  </div>

                  <div>
                    <span className="muted-text">Confidence</span>
                    <div className="ai-value">{aiPrediction.confidence}%</div>
                  </div>

                  <div>
                    <span className="muted-text">Home Win</span>
                    <div className="ai-value">{aiPrediction.homeWinProbability}%</div>
                  </div>

                  <div>
                    <span className="muted-text">Draw</span>
                    <div className="ai-value">{aiPrediction.drawProbability}%</div>
                  </div>

                  <div>
                    <span className="muted-text">Away Win</span>
                    <div className="ai-value">{aiPrediction.awayWinProbability}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}