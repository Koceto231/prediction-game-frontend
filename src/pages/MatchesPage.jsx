import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import { useWallet } from '../context/WalletContext';

// ── Enum maps (must match backend enums) ────────────────────────
const WINNER_PICK_MAP = { Home: 1, Draw: 2, Away: 3 };
const BET_TYPE = { Winner: 1, ExactScore: 2, BTTS: 3, OverUnder: 4 };
const OU_LINE_MAP = { Line15: 1, Line25: 2, Line35: 3 };
const OU_PICK_MAP = { Over: 1, Under: 2 };

// Prediction maps
const WINNER_MAP = { Home: 1, Draw: 2, Away: 3 };

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

// ── Bet panel sub-component ──────────────────────────────────────
function BetPanel({ match, onBetPlaced }) {
  const { balance, refreshBalance } = useWallet();

  const [betType, setBetType] = useState('Winner');
  // Winner
  const [winnerPick, setWinnerPick] = useState('');
  // ExactScore
  const [scoreH, setScoreH] = useState('');
  const [scoreA, setScoreA] = useState('');
  // BTTS
  const [bttsPick, setBttsPick] = useState(''); // 'true' | 'false'
  // OverUnder
  const [ouLine, setOuLine] = useState('');
  const [ouPick, setOuPick] = useState('');

  const [dynamicOdds, setDynamicOdds] = useState(null);
  const [oddsLoading, setOddsLoading] = useState(false);

  const [betAmount, setBetAmount] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [betFeedback, setBetFeedback] = useState('');

  // Reset all picks when match or betType changes
  useEffect(() => {
    setWinnerPick('');
    setScoreH('');
    setScoreA('');
    setBttsPick('');
    setOuLine('');
    setOuPick('');
    setDynamicOdds(null);
    setBetFeedback('');
    setBetAmount('');
  }, [match?.id, betType]);

  // Fetch dynamic odds for ExactScore / BTTS / OverUnder
  useEffect(() => {
    if (betType === 'Winner') {
      setDynamicOdds(null);
      return;
    }

    const params = new URLSearchParams({ betType: BET_TYPE[betType] });

    if (betType === 'ExactScore') {
      const h = parseScore(scoreH);
      const a = parseScore(scoreA);
      if (h === null || a === null) { setDynamicOdds(null); return; }
      params.set('scoreHome', h);
      params.set('scoreAway', a);
    } else if (betType === 'BTTS') {
      if (!bttsPick) { setDynamicOdds(null); return; }
      params.set('btts', bttsPick);
    } else if (betType === 'OverUnder') {
      if (!ouLine || !ouPick) { setDynamicOdds(null); return; }
      params.set('ouLine', OU_LINE_MAP[ouLine]);
      params.set('ouPick', OU_PICK_MAP[ouPick]);
    }

    let cancelled = false;
    setOddsLoading(true);
    api.get(`/Odds/${match.id}?${params}`)
      .then(r => { if (!cancelled) setDynamicOdds(r.data); })
      .catch(() => { if (!cancelled) setDynamicOdds(null); })
      .finally(() => { if (!cancelled) setOddsLoading(false); });

    return () => { cancelled = true; };
  }, [match?.id, betType, scoreH, scoreA, bttsPick, ouLine, ouPick]);

  // Determine effective odds to display
  const effectiveOdds = (() => {
    if (betType === 'Winner') {
      const map = { Home: match.homeOdds, Draw: match.drawOdds, Away: match.awayOdds };
      return winnerPick ? map[winnerPick] : null;
    }
    return dynamicOdds?.odds ?? null;
  })();

  const isReadyToBet = (() => {
    if (!betAmount || Number(betAmount) <= 0) return false;
    if (betType === 'Winner') return !!winnerPick && effectiveOdds != null;
    if (betType === 'ExactScore') return parseScore(scoreH) !== null && parseScore(scoreA) !== null && effectiveOdds != null;
    if (betType === 'BTTS') return !!bttsPick && effectiveOdds != null;
    if (betType === 'OverUnder') return !!ouLine && !!ouPick && effectiveOdds != null;
    return false;
  })();

  const placeBet = async () => {
    if (!isReadyToBet) return;
    setBetLoading(true);
    setBetFeedback('');

    const body = {
      matchId: match.id,
      betType: BET_TYPE[betType],
      amount: Number(betAmount),
    };

    if (betType === 'Winner') {
      body.pick = WINNER_PICK_MAP[winnerPick];
    } else if (betType === 'ExactScore') {
      body.scoreHome = parseScore(scoreH);
      body.scoreAway = parseScore(scoreA);
    } else if (betType === 'BTTS') {
      body.bttsPick = bttsPick === 'true';
    } else if (betType === 'OverUnder') {
      body.ouLine = OU_LINE_MAP[ouLine];
      body.ouPick = OU_PICK_MAP[ouPick];
    }

    try {
      const res = await api.post('/Bet', body);
      await refreshBalance();
      setBetFeedback(`✅ Bet placed! Potential payout: ${Number(res.data.potentialPayout).toFixed(2)} 🪙`);
      setBetAmount('');
      if (onBetPlaced) onBetPlaced();
    } catch (err) {
      setBetFeedback(err?.response?.data?.message || 'Failed to place bet.');
    } finally {
      setBetLoading(false);
    }
  };

  const BET_TYPES = ['Winner', 'ExactScore', 'BTTS', 'OverUnder'];
  const BET_TYPE_LABELS = { Winner: '1 / X / 2', ExactScore: 'Exact Score', BTTS: 'BTTS', OverUnder: 'Over/Under' };

  return (
    <div className="bet-panel">
      <div className="bet-panel__header">
        <h3>Place a Bet</h3>
        {balance !== null && (
          <span className="wallet-badge">
            <span className="wallet-icon">🪙</span>
            <span className="wallet-amount">{Number(balance).toLocaleString()}</span>
          </span>
        )}
      </div>

      {/* Bet type tabs */}
      <div className="bet-type-tabs">
        {BET_TYPES.map(t => (
          <button
            key={t}
            type="button"
            className={`bet-type-tab ${betType === t ? 'bet-type-tab--active' : ''}`}
            onClick={() => setBetType(t)}
          >
            {BET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Winner picks */}
      {betType === 'Winner' && (
        <div className="bet-picks">
          {[
            { key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
            { key: 'Draw', label: 'Draw', odds: match.drawOdds },
            { key: 'Away', label: match.awayTeamName, odds: match.awayOdds },
          ].map(({ key, label, odds }) => (
            <button
              key={key}
              type="button"
              className={`bet-pick-btn ${winnerPick === key ? 'bet-pick-btn--active' : ''}`}
              onClick={() => setWinnerPick(winnerPick === key ? '' : key)}
            >
              <span className="bet-pick-btn__label">{label}</span>
              <span className="bet-pick-btn__odds">{odds != null ? Number(odds).toFixed(2) : '—'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Exact Score picks */}
      {betType === 'ExactScore' && (
        <div className="bet-exact-score">
          <div className="scoreboard">
            <div className="scoreboard-team">
              <div className="scoreboard-team__name">{match.homeTeamName}</div>
              <div className="scorebox">
                <input
                  type="number" min="0" max="20" placeholder="0"
                  value={scoreH}
                  onChange={e => setScoreH(e.target.value)}
                />
              </div>
            </div>
            <div className="scoreboard__separator">:</div>
            <div className="scoreboard-team">
              <div className="scoreboard-team__name">{match.awayTeamName}</div>
              <div className="scorebox">
                <input
                  type="number" min="0" max="20" placeholder="0"
                  value={scoreA}
                  onChange={e => setScoreA(e.target.value)}
                />
              </div>
            </div>
          </div>
          {oddsLoading && <div className="muted-text" style={{ textAlign: 'center' }}>Calculating odds...</div>}
          {dynamicOdds && (
            <div className="bet-dynamic-odds">
              Odds for {scoreH}-{scoreA}: <strong>{Number(dynamicOdds.odds).toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {/* BTTS picks */}
      {betType === 'BTTS' && (
        <div className="bet-picks">
          {[['true', 'BTTS Yes'], ['false', 'BTTS No']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`bet-pick-btn ${bttsPick === val ? 'bet-pick-btn--active' : ''}`}
              onClick={() => setBttsPick(bttsPick === val ? '' : val)}
            >
              <span className="bet-pick-btn__label">{label}</span>
              {bttsPick === val && dynamicOdds && (
                <span className="bet-pick-btn__odds">{Number(dynamicOdds.odds).toFixed(2)}</span>
              )}
            </button>
          ))}
          {oddsLoading && <div className="muted-text">Calculating odds...</div>}
        </div>
      )}

      {/* Over/Under picks */}
      {betType === 'OverUnder' && (
        <div className="bet-ou">
          <div className="bet-ou__row">
            <span className="option-card__label">Goals</span>
            <div className="pick-row">
              {['Line15', 'Line25', 'Line35'].map(line => (
                <button
                  key={line}
                  type="button"
                  className={`pick-chip ${ouLine === line ? 'pick-chip--active' : ''}`}
                  onClick={() => setOuLine(ouLine === line ? '' : line)}
                >
                  {line.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                </button>
              ))}
            </div>
          </div>
          <div className="bet-ou__row">
            <span className="option-card__label">Pick</span>
            <div className="pick-row">
              {['Over', 'Under'].map(p => (
                <button
                  key={p}
                  type="button"
                  className={`pick-chip ${ouPick === p ? 'pick-chip--active' : ''}`}
                  onClick={() => setOuPick(ouPick === p ? '' : p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {oddsLoading && <div className="muted-text">Calculating odds...</div>}
          {dynamicOdds && (
            <div className="bet-dynamic-odds">
              Odds ({ouPick} {ouLine?.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}): <strong>{Number(dynamicOdds.odds).toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Amount + payout */}
      <div className="bet-amount-row">
        <input
          type="number"
          min="1"
          placeholder="Amount (coins)"
          value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          className="bet-amount-input"
        />
        {betAmount > 0 && effectiveOdds != null && (
          <span className="bet-potential">
            → {(Number(betAmount) * Number(effectiveOdds)).toFixed(2)} 🪙
          </span>
        )}
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={!isReadyToBet || betLoading}
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
  );
}

// ── Main page ────────────────────────────────────────────────────
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

  const [pageLoading, setPageLoading] = useState(false);

  const predictionRef = useRef(null);
  const aiPredictionRef = useRef(null);

  const setField = useCallback((key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

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

  const resetPredictionFields = useCallback(() => {
    setFields(EMPTY_PREDICTION);
    setShowNilNilPrompt(false);
    setPredictionMode('');
    setAiPrediction(null);
    setFeedback('');
  }, []);

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
            window.scrollBy({ top: 120, behavior: 'smooth' });
          }, 250);
        }, 200);
      }
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to save prediction.');
    } finally {
      setLoading(false);
    }
  };

  const hasBettingOdds = selectedMatch?.homeOdds != null;

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
                          type="number" min="0" max="20" placeholder="0"
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
                          type="number" min="0" max="20" placeholder="0"
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

            {hasBettingOdds && (
              <BetPanel match={selectedMatch} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
