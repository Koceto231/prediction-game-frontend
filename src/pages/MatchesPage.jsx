import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';

// FIX: Extracted constants — were magic strings scattered in the component
const WINNER_MAP = { Home: 1, Draw: 2, Away: 3 };
const OU_LINE_MAP = { Line15: 1, Line25: 2, Line35: 3 };
const OU_PICK_MAP = { Over: 1, Under: 2 };

const parseScore = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const EMPTY_PREDICTION = {
  homeScore: '',
  awayScore: '',
  winner: '',
  btts: '',
  ouLine: '',
  ouPick: '',
};

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [predictionMode, setPredictionMode] = useState('');
  const [fields, setFields] = useState(EMPTY_PREDICTION);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [aiPrediction, setAiPrediction] = useState(null);
  const [showNilNilPrompt, setShowNilNilPrompt] = useState(false);
  const [betPick, setBetPick] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [betFeedback, setBetFeedback] = useState('');
  const [userBalance, setUserBalance] = useState(null);

  // FIX: Added pagination state
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const predictionRef = useRef(null);
  const aiPredictionRef = useRef(null);

  // FIX: Stable field setter — avoids re-creating lambdas on every render
  const setField = useCallback((key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  // FIX: Matches now use paginated endpoint
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoadError('');
        setPageLoading(true);
        const response = await api.get(`/Match/upcoming?take=20`);
        setMatches(response.data);
      } catch (error) {
        setLoadError(
          error?.response?.data?.message || error?.message || 'Failed to load matches.'
        );
        setMatches([]);
      } finally {
        setPageLoading(false);
      }
    };

    fetchMatches();
  }, []);

  useEffect(() => {
    api.get('/Wallet').then(r => setUserBalance(r.data.balance)).catch(() => {});
  }, []);

  const resetPredictionFields = useCallback(() => {
    setFields(EMPTY_PREDICTION);
    setShowNilNilPrompt(false);
    setPredictionMode('');
    setAiPrediction(null);
    setFeedback('');
    setBetPick('');
    setBetAmount('');
    setBetFeedback('');
  }, []);

  const placeBet = async () => {
    if (!betPick || !betAmount || !selectedMatch) return;
    setBetLoading(true);
    setBetFeedback('');
    const PICK_MAP = { Home: 1, Draw: 2, Away: 3 };
    try {
      const res = await api.post('/Bet', {
        matchId: selectedMatch.id,
        pick: PICK_MAP[betPick],
        amount: Number(betAmount),
      });
      setUserBalance(res.data.potentialPayout != null ? userBalance - Number(betAmount) : userBalance);
      api.get('/Wallet').then(r => setUserBalance(r.data.balance)).catch(() => {});
      setBetFeedback(`✅ Bet placed! Potential payout: ${Number(res.data.potentialPayout).toFixed(2)} coins`);
      setBetPick('');
      setBetAmount('');
    } catch (err) {
      setBetFeedback(err?.response?.data?.message || 'Failed to place bet.');
    } finally {
      setBetLoading(false);
    }
  };

  const selectedOdds = selectedMatch
    ? { Home: selectedMatch.homeOdds, Draw: selectedMatch.drawOdds, Away: selectedMatch.awayOdds }
    : {};

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;

  const home = parseScore(homeScore);
  const away = parseScore(awayScore);
  const hasExactScore = home != null && away != null;
  const isExactMode = predictionMode === 'exact';
  const isMarketMode = predictionMode === 'market';
  const isDrawNoBtts = !hasExactScore && winner === 'Draw' && btts === 'false';
  const isDrawYesBtts = !hasExactScore && winner === 'Draw' && btts === 'true';

  useEffect(() => {
    const noManualScore = homeScore === '' && awayScore === '';
    setShowNilNilPrompt(isMarketMode && winner === 'Draw' && btts === 'false' && noManualScore);
  }, [winner, btts, homeScore, awayScore, isMarketMode]);

  useEffect(() => {
    if (!isMarketMode) return;
    if (isDrawNoBtts && ouLine) {
      setField('ouPick', 'Under');
    }
  }, [isMarketMode, isDrawNoBtts, ouLine, setField]);

  const submitPrediction = async () => {
    if (!selectedMatch) return;
    setLoading(true);
    setFeedback('');

    try {
      const body = {
        matchId: selectedMatch.id,
        predictionHomeScore: isExactMode ? home : null,
        predictionAwayScore: isExactMode ? away : null,
        predictionWinner: isMarketMode && winner ? WINNER_MAP[winner] : null,
        predictionBTTS: isMarketMode && btts !== '' ? btts === 'true' : null,
        predictionOULine: isMarketMode && ouLine ? ouLine : null,
        predictionOUPick: isMarketMode && ouPick ? ouPick : null,
      };

      const res = await api.post('/Prediction', body);
      const nextAiPrediction = res.data?.aiPredictionResponseDTO ?? null;

      setAiPrediction(nextAiPrediction);
      setFeedback('Prediction saved!');

      if (nextAiPrediction) {
  setTimeout(() => {
    aiPredictionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });

    setTimeout(() => {
      window.scrollBy({
        top: 120,
        behavior: 'smooth',
      });
    }, 250);
  }, 200);
}
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to save prediction.');
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
            <p>Select a match to make your prediction.</p>
          </div>
        </div>

        {loadError && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}

        {!pageLoading && matches.length === 0 && !loadError && (
          <div className="empty-box">No upcoming matches found.</div>
        )}

        <div className="cards-grid">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              selected={selectedMatch?.id === match.id}
              onSelect={() => {
                if (selectedMatch?.id === match.id) {
                  setSelectedMatch(null);
                  resetPredictionFields();
                } else {
                  setSelectedMatch(match);
                  resetPredictionFields();
                  setTimeout(() => {
  predictionRef.current?.scrollIntoView({
 top: document.body.scrollHeight,
  behavior: 'smooth',
  });
}, 150);
                }
              }}
            />
          ))}
        </div>
      </section>

      {selectedMatch && (
        <section className="shell-card panel" ref={predictionRef}>
          <div className="match-hero">
            <div className="match-hero__badge">Selected Match</div>

            <h2 className="match-hero__title">
              <span>{selectedMatch.homeTeamName}</span>
              <span className="match-hero__vs">vs</span>
              <span>{selectedMatch.awayTeamName}</span>
            </h2>

            <div className="match-hero__meta">
              <span className="match-hero__date">
                {new Date(selectedMatch.matchDate).toLocaleString()}
              </span>
            </div>
          </div>

          {!predictionMode && (
            <div className="premium-mode-grid">
              <button
                type="button"
                className="premium-mode-card premium-mode-card--exact"
                onClick={() => setPredictionMode('exact')}
              >
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">🎯</span>
                  <span className="premium-mode-card__points">5 pts</span>
                </div>

                <div className="premium-mode-card__title">Exact Score</div>
                <div className="premium-mode-card__text">
                  Predict the final score and earn maximum points.
                </div>
              </button>

              <button
                type="button"
                className="premium-mode-card premium-mode-card--market"
                onClick={() => setPredictionMode('market')}
              >
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">📈</span>
                  <span className="premium-mode-card__points">up to 3 pts</span>
                </div>

                <div className="premium-mode-card__title">Market Pick</div>
                <div className="premium-mode-card__text">
                  Predict winner, BTTS and Over / Under outcomes.
                </div>
              </button>
            </div>
          )}

          <div className="prediction-form">
            {isExactMode && (
              <>
                <div className="mode-card mode-card--exact">
                  <div className="mode-card__top">
                    <span className="mode-badge">EXACT SCORE MODE</span>
                    <span className="mode-points">5 PTS</span>
                  </div>

                  <div className="mode-card__title">Exact score prediction</div>

                  <div className="mode-card__text">
                    Predict the exact final score for this match.
                  </div>

                  <button
                    type="button"
                    className="mode-card__button"
                    onClick={() => {
                      setPredictionMode('');
                      setFields(EMPTY_PREDICTION);
                    }}
                  >
                    Change type
                  </button>
                </div>

                <div className="scoreboard-card">
                  <div className="scoreboard-card__head">
                    <span className="scoreboard-card__eyebrow">Enter predicted result</span>
                  </div>

                  <div className="scoreboard">
                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.homeTeamName}</div>
                      <div className="scorebox">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          placeholder="0"
                          value={homeScore}
                          onChange={(e) => setField('homeScore', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="scoreboard__separator">:</div>

                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.awayTeamName}</div>
                      <div className="scorebox">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          placeholder="0"
                          value={awayScore}
                          onChange={(e) => setField('awayScore', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
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
                    className="mode-card__button"
                    onClick={() => {
                      setPredictionMode('');
                      setFields(EMPTY_PREDICTION);
                      setShowNilNilPrompt(false);
                    }}
                  >
                    Change type
                  </button>
                </div>

                {showNilNilPrompt && (
                  <div className="alert alert-info">
                    Draw + BTTS No allows only 0:0. Autofill score to 0:0?
                    <div className="button-row" style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          setFields((p) => ({ ...p, homeScore: '0', awayScore: '0' }));
                          setShowNilNilPrompt(false);
                          setPredictionMode('exact');
                        }}
                      >
                        Yes, autofill
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setShowNilNilPrompt(false)}
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
                        {['Home', 'Draw', 'Away'].map((w) => (
                          <button
                            key={w}
                            type="button"
                            className={`pick-chip ${winner === w ? 'pick-chip--active' : ''}`}
                            onClick={() => setField('winner', winner === w ? '' : w)}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="option-card">
                      <span className="option-card__label">Both teams to score</span>
                      <div className="pick-row">
                        {[['true', 'Yes'], ['false', 'No']].map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            className={`pick-chip ${btts === val ? 'pick-chip--active' : ''}`}
                            onClick={() => setField('btts', btts === val ? '' : val)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="option-card option-card--compact">
                      <div className="option-card__header">
                        <span className="option-card__label">Over / Under Pick</span>
                      </div>
                      <div className="pick-row pick-row--compact">
                        <button
                          type="button"
                          className={`pick-chip ${ouPick === 'Over' ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouPick', ouPick === 'Over' ? '' : 'Over')}
                          disabled={isDrawNoBtts || (isDrawYesBtts && ouLine === 'Line15')}
                        >
                          Over
                        </button>
                        <button
                          type="button"
                          className={`pick-chip ${ouPick === 'Under' ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouPick', ouPick === 'Under' ? '' : 'Under')}
                        >
                          Under
                        </button>
                      </div>
                    </div>

                    <div className="option-card option-card--compact">
                      <div className="option-card__header">
                        <span className="option-card__label">Over / Under Goals</span>
                      </div>
                      <div className="pick-row pick-row--compact">
                        {['Line15', 'Line25', 'Line35'].map((line) => (
                          <button
                            key={line}
                            type="button"
                            className={`pick-chip ${ouLine === line ? 'pick-chip--active' : ''}`}
                            onClick={() => setField('ouLine', ouLine === line ? '' : line)}
                          >
                            {line.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                          </button>
                        ))}
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
              <div ref={aiPredictionRef} className="ai-card">
                <h3>AI Prediction</h3>
                {aiPrediction.aiAnalysis && (
                  <p className="ai-analysis">{aiPrediction.aiAnalysis}</p>
                )}
                <div className="ai-grid">
                  <div>
                    <span className="muted-text">Predicted Score</span>
                    <div className="ai-value">
                      {aiPrediction.predictedHomeScore} – {aiPrediction.predictedAwayScore}
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

            {selectedMatch?.homeOdds != null && (
              <div className="bet-panel">
                <div className="bet-panel__header">
                  <h3>Place a Bet</h3>
                  {userBalance != null && (
                    <span className="wallet-badge">
                      <span className="wallet-icon">🪙</span>
                      <span className="wallet-amount">{Number(userBalance).toLocaleString()}</span>
                    </span>
                  )}
                </div>

                <div className="bet-picks">
                  {[
                    { key: 'Home', label: selectedMatch.homeTeamName, odds: selectedMatch.homeOdds },
                    { key: 'Draw', label: 'Draw', odds: selectedMatch.drawOdds },
                    { key: 'Away', label: selectedMatch.awayTeamName, odds: selectedMatch.awayOdds },
                  ].map(({ key, label, odds }) => (
                    <button
                      key={key}
                      type="button"
                      className={`bet-pick-btn ${betPick === key ? 'bet-pick-btn--active' : ''}`}
                      onClick={() => setBetPick(betPick === key ? '' : key)}
                    >
                      <span className="bet-pick-btn__label">{label}</span>
                      <span className="bet-pick-btn__odds">{Number(odds).toFixed(2)}</span>
                    </button>
                  ))}
                </div>

                {betPick && (
                  <div className="bet-amount-row">
                    <input
                      type="number"
                      min="1"
                      placeholder="Amount (coins)"
                      value={betAmount}
                      onChange={e => setBetAmount(e.target.value)}
                      className="bet-amount-input"
                    />
                    {betAmount > 0 && selectedOdds[betPick] && (
                      <span className="bet-potential">
                        → {(Number(betAmount) * Number(selectedOdds[betPick])).toFixed(2)} coins
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="primary-button"
                  disabled={!betPick || !betAmount || betLoading}
                  onClick={placeBet}
                >
                  {betLoading ? 'Placing...' : 'Place Bet'}
                </button>

                {betFeedback && (
                  <div className={`alert ${betFeedback.startsWith('✅') ? 'alert-info' : 'alert-error'}`}>
                    {betFeedback}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}