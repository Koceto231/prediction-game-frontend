import { useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [predictionMode, setPredictionMode] = useState('');

  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');

  const [winner, setWinner] = useState('');
  const [btts, setBtts] = useState('');
  const [ouLine, setOuLine] = useState('');
  const [ouPick, setOuPick] = useState('');

  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [aiPrediction, setAiPrediction] = useState(null);
  const [showNilNilPrompt, setShowNilNilPrompt] = useState(false);

  const predictionRef = useRef(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoadError('');
        const response = await api.get('/Match/upcoming?take=20');
        setMatches(response.data);
      } catch (error) {
        setLoadError(
          error?.response?.data?.message ||
            error?.message ||
            'Failed to load matches.'
        );
        setMatches([]);
      }
    };

    fetchMatches();
  }, []);

  const parseScore = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
  };

  const resetPredictionFields = () => {
    setHomeScore('');
    setAwayScore('');
    setWinner('');
    setBtts('');
    setOuLine('');
    setOuPick('');
    setShowNilNilPrompt(false);
    setPredictionMode('');
  };

  const dismissNilNilPrompt = () => {
    setShowNilNilPrompt(false);
  };

  const home = parseScore(homeScore);
  const away = parseScore(awayScore);
  const hasExactScore = home != null && away != null;

  const isExactMode = predictionMode === 'exact';
  const isMarketMode = predictionMode === 'market';

  const isDrawNoBtts =
    !hasExactScore && winner === 'Draw' && btts === 'false';

  const isDrawYesBtts =
    !hasExactScore && winner === 'Draw' && btts === 'true';

  useEffect(() => {
    const noManualScore = homeScore === '' && awayScore === '';

    if (
      isMarketMode &&
      winner === 'Draw' &&
      btts === 'false' &&
      noManualScore
    ) {
      setShowNilNilPrompt(true);
    } else {
      setShowNilNilPrompt(false);
    }
  }, [winner, btts, homeScore, awayScore, isMarketMode]);

  useEffect(() => {
    if (!isMarketMode) return;

    if (isDrawNoBtts && ouLine) {
      setOuPick('Under');
      return;
    }

    if (isDrawYesBtts && ouLine === 'Line15') {
      setOuPick('Over');
    }
  }, [isDrawNoBtts, isDrawYesBtts, ouLine, isMarketMode]);

  const submitPrediction = async () => {
    if (!selectedMatch) return;

    if (!predictionMode) {
      setFeedback('Choose prediction type first.');
      return;
    }

    if (isExactMode && (homeScore === '' || awayScore === '')) {
      setFeedback('Enter both score fields for Exact Score mode.');
      return;
    }

    if (
      isMarketMode &&
      winner === '' &&
      btts === '' &&
      ouLine === '' &&
      ouPick === ''
    ) {
      setFeedback('Choose at least one market prediction.');
      return;
    }

    if (isMarketMode) {
      if (isDrawNoBtts && ouPick === 'Over') {
        setFeedback(
          'Draw + BTTS No implies only 0:0, so Over/Under Pick must be Under.'
        );
        return;
      }

      if (isDrawYesBtts && ouLine === 'Line15' && ouPick === 'Under') {
        setFeedback(
          'Draw + BTTS Yes means both teams score, so Under 1.5 is impossible.'
        );
        return;
      }
    }

    setLoading(true);
    setFeedback('');
    setAiPrediction(null);

    try {
      const winnerMap = {
        Home: 1,
        Draw: 2,
        Away: 3
      };

      const ouLineMap = {
        Line15: 1,
        Line25: 2,
        Line35: 3
      };

      const ouPickMap = {
        Over: 1,
        Under: 2
      };

      const payload = {
        matchId: selectedMatch.id,
        predictionHomeScore:
          isExactMode && homeScore !== '' ? Number(homeScore) : null,
        predictionAwayScore:
          isExactMode && awayScore !== '' ? Number(awayScore) : null,
        predictionWinner:
          isMarketMode && winner !== '' ? winnerMap[winner] : null,
        predictionBTTS:
          isMarketMode && btts !== '' ? btts === 'true' : null,
        predictionOULine:
          isMarketMode && ouLine !== '' ? ouLineMap[ouLine] : null,
        predictionOUPick:
          isMarketMode && ouPick !== '' ? ouPickMap[ouPick] : null
      };

      console.log('Prediction payload:', payload);

      const response = await api.post('/Prediction', payload);

      console.log('Prediction response:', response.data);

      const result = response.data;
      const rawAi =
        result.aiPredictionResponseDTO ||
        result.AIPredictionResponseDTO ||
        null;

      const aiResult = rawAi
        ? {
            predictedHomeScore:
              rawAi.predictedHomeScore ?? rawAi.PredictedHomeScore,
            predictedAwayScore:
              rawAi.predictedAwayScore ?? rawAi.PredictedAwayScore,
            pick: rawAi.pick ?? rawAi.Pick,
            confidence: rawAi.confidence ?? rawAi.Confidence,
            homeWinProbability:
              rawAi.homeWinProbability ?? rawAi.HomeWinProbability,
            drawProbability:
              rawAi.drawProbability ?? rawAi.DrawProbability,
            awayWinProbability:
              rawAi.awayWinProbability ?? rawAi.AwayWinProbability
          }
        : null;

      setAiPrediction(aiResult);
      setFeedback('Prediction created successfully.');
      resetPredictionFields();
    } catch (err) {
      console.error('Prediction error:', err);
      console.error('Prediction error data:', err?.response?.data);

      setFeedback(
        err?.response?.data?.message ||
          err.message ||
          'Could not create prediction.'
      );
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
            <p>Choose a fixture and create your prediction.</p>
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
                resetPredictionFields();

                setTimeout(() => {
                  predictionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                  });
                }, 100);
              }}
            />
          ))}

          {matches.length === 0 && !loadError && (
            <div className="empty-box">No matches available yet.</div>
          )}
        </div>
      </section>

      <section ref={predictionRef} className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Prediction Builder</h2>
            <p>Choose your prediction type and make your pick.</p>
          </div>
        </div>

        {!selectedMatch ? (
          <div className="empty-box">Select a match to start predicting.</div>
        ) : (
          <div className="prediction-form">
            <div className="selected-match">
              <strong>
                {selectedMatch.homeTeamName} vs {selectedMatch.awayTeamName}
              </strong>
            </div>

            {!predictionMode && (
              <div className="mode-picker">
                <div className="mode-picker__header">
                  <h3>Choose prediction type</h3>
                  <p>Select how you want to predict this match.</p>
                </div>

                <div className="mode-picker__grid">
                  <button
                    type="button"
                    className="mode-option"
                    onClick={() => {
                      setPredictionMode('exact');
                      setFeedback('');
                    }}
                  >
                    <span className="mode-option__badge">5 PTS</span>
                    <div className="mode-option__title">Exact Score</div>
                    <div className="mode-option__text">
                      Predict the final score exactly. High risk, high reward.
                    </div>
                  </button>

                  <button
                    type="button"
                    className="mode-option"
                    onClick={() => {
                      setPredictionMode('market');
                      setFeedback('');
                    }}
                  >
                    <span className="mode-option__badge">UP TO 3 PTS</span>
                    <div className="mode-option__title">Market Pick</div>
                    <div className="mode-option__text">
                      Predict Winner, BTTS and Over / Under.
                    </div>
                  </button>
                </div>
              </div>
            )}

            {isExactMode && (
              <>
                <div className="score-predict">
                  <div className="score-team score-team--home">
                    <span className="score-team__name">
                      {selectedMatch.homeTeamName}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
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
                      placeholder="0"
                    />
                    <span className="score-team__name">
                      {selectedMatch.awayTeamName}
                    </span>
                  </div>
                </div>

                <div className="mode-card mode-card--exact">
                  <div className="mode-card__top">
                    <span className="mode-badge">EXACT MODE</span>
                    <span className="mode-points">5 PTS</span>
                  </div>

                  <div className="mode-card__title">Exact score prediction</div>

                  <div className="mode-card__text">
                    Hit the exact final score to win full points.
                  </div>

                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setPredictionMode('');
                      setHomeScore('');
                      setAwayScore('');
                    }}
                  >
                    Change type
                  </button>
                </div>
              </>
            )}

            {isMarketMode && (
              <>
                <div className="mode-card mode-card--market">
                  <div className="mode-card__top">
                    <span className="mode-badge">MARKET MODE</span>
                    <span className="mode-points">UP TO 3 PTS</span>
                  </div>

                  <div className="mode-card__title">Market prediction</div>

                  <div className="mode-card__text">
                    Predict Winner, BTTS and Over / Under for this match.
                  </div>

                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setPredictionMode('');
                      setWinner('');
                      setBtts('');
                      setOuLine('');
                      setOuPick('');
                      setShowNilNilPrompt(false);
                    }}
                  >
                    Change type
                  </button>
                </div>

                {!hasExactScore && showNilNilPrompt && (
                  <div className="alert alert-info">
                    Draw + BTTS No allows only 0:0. Autofill score to 0:0?
                    <div className="button-row" style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          setHomeScore('0');
                          setAwayScore('0');
                          setShowNilNilPrompt(false);
                          setPredictionMode('exact');
                        }}
                      >
                        Yes, autofill
                      </button>

                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setShowNilNilPrompt(false);
                        }}
                      >
                        No, keep manual
                      </button>
                    </div>
                  </div>
                )}

                {!hasExactScore && (
                  <div className="prediction-options">
                    <div className="option-card">
                      <span className="option-card__label">Winner</span>
                      <div className="pick-row">
                        <button
                          type="button"
                          className={`pick-chip ${
                            winner === 'Home' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setWinner(winner === 'Home' ? '' : 'Home');
                          }}
                        >
                          Home
                        </button>
                        <button
                          type="button"
                          className={`pick-chip ${
                            winner === 'Draw' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setWinner(winner === 'Draw' ? '' : 'Draw');
                          }}
                        >
                          Draw
                        </button>
                        <button
                          type="button"
                          className={`pick-chip ${
                            winner === 'Away' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setWinner(winner === 'Away' ? '' : 'Away');
                          }}
                        >
                          Away
                        </button>
                      </div>
                    </div>

                    <div className="option-card">
                      <span className="option-card__label">BTTS</span>
                      <div className="pick-row">
                        <button
                          type="button"
                          className={`pick-chip ${
                            btts === 'true' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setBtts(btts === 'true' ? '' : 'true');
                          }}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`pick-chip ${
                            btts === 'false' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setBtts(btts === 'false' ? '' : 'false');
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="option-card option-card--compact">
                      <div className="option-card__header">
                        <span className="option-card__label">
                          Over / Under Pick
                        </span>
                        <span className="option-card__hint">Choose side</span>
                      </div>

                      <div className="pick-row pick-row--compact">
                        <button
                          type="button"
                          className={`pick-chip ${
                            ouPick === 'Over' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setOuPick(ouPick === 'Over' ? '' : 'Over');
                          }}
                          disabled={
                            isDrawNoBtts ||
                            (isDrawYesBtts && ouLine === 'Line15')
                          }
                        >
                          Over
                        </button>

                        <button
                          type="button"
                          className={`pick-chip ${
                            ouPick === 'Under' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setOuPick(ouPick === 'Under' ? '' : 'Under');
                          }}
                        >
                          Under
                        </button>
                      </div>
                    </div>

                    <div className="option-card option-card--compact">
                      <div className="option-card__header">
                        <span className="option-card__label">
                          Over / Under Line
                        </span>
                        <span className="option-card__hint">Choose line</span>
                      </div>

                      <div className="pick-row pick-row--compact">
                        <button
                          type="button"
                          className={`pick-chip ${
                            ouLine === 'Line15' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setOuLine(ouLine === 'Line15' ? '' : 'Line15');
                          }}
                        >
                          1.5
                        </button>

                        <button
                          type="button"
                          className={`pick-chip ${
                            ouLine === 'Line25' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setOuLine(ouLine === 'Line25' ? '' : 'Line25');
                          }}
                        >
                          2.5
                        </button>

                        <button
                          type="button"
                          className={`pick-chip ${
                            ouLine === 'Line35' ? 'pick-chip--active' : ''
                          }`}
                          onClick={() => {
                            dismissNilNilPrompt();
                            setOuLine(ouLine === 'Line35' ? '' : 'Line35');
                          }}
                        >
                          3.5
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {predictionMode && (
              <button
                className="primary-button"
                onClick={submitPrediction}
                disabled={loading}
                type="button"
              >
                {loading ? 'Saving...' : 'Create Prediction'}
              </button>
            )}

            {feedback && <div className="alert alert-info">{feedback}</div>}

            {aiPrediction && (
              <div className="ai-card">
                <h3>AI Prediction</h3>
                <div className="ai-grid">
                  <div>
                    <span className="muted-text">Predicted Score</span>
                    <div className="ai-value">
                      {aiPrediction.predictedHomeScore} -{' '}
                      {aiPrediction.predictedAwayScore}
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
                    <div className="ai-value">
                      {aiPrediction.homeWinProbability}%
                    </div>
                  </div>

                  <div>
                    <span className="muted-text">Draw</span>
                    <div className="ai-value">
                      {aiPrediction.drawProbability}%
                    </div>
                  </div>

                  <div>
                    <span className="muted-text">Away Win</span>
                    <div className="ai-value">
                      {aiPrediction.awayWinProbability}%
                    </div>
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