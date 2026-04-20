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

// ── Fetch one market's odds from API ────────────────────────────
async function fetchMarketOdds(matchId, betType, params) {
  const qs = new URLSearchParams({ betType, ...params });
  try {
    const r = await api.get(`/Odds/${matchId}?${qs}`);
    return r.data?.odds ?? null;
  } catch {
    return null;
  }
}

// ── Bet panel sub-component ──────────────────────────────────────
function BetPanel({ match }) {
  const { balance, refreshBalance } = useWallet();

  const [tab, setTab] = useState('Winner'); // 'Winner' | 'ExactScore' | 'MarketPick'

  // ── Winner state ─────────────────────────────────────────────
  const [winnerPick, setWinnerPick] = useState('');

  // ── Exact Score state ────────────────────────────────────────
  const [scoreH, setScoreH] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [exactOdds, setExactOdds] = useState(null);
  const [exactLoading, setExactLoading] = useState(false);

  // ── Market Pick state ────────────────────────────────────────
  const [mpWinner, setMpWinner] = useState('');   // 'Home'|'Draw'|'Away'|''
  const [mpBTTS, setMpBTTS] = useState('');        // 'true'|'false'|''
  const [mpOULine, setMpOULine] = useState('');    // 'Line15'|'Line25'|'Line35'|''
  const [mpOUPick, setMpOUPick] = useState('');    // 'Over'|'Under'|''
  const [mpOdds, setMpOdds] = useState({ winner: null, btts: null, ou: null });
  const [mpLoading, setMpLoading] = useState(false);

  // ── Shared ───────────────────────────────────────────────────
  const [betAmount, setBetAmount] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [betFeedback, setBetFeedback] = useState('');

  // Reset on tab or match change
  useEffect(() => {
    setWinnerPick('');
    setScoreH(''); setScoreA(''); setExactOdds(null);
    setMpWinner(''); setMpBTTS(''); setMpOULine(''); setMpOUPick('');
    setMpOdds({ winner: null, btts: null, ou: null });
    setBetAmount(''); setBetFeedback('');
  }, [match?.id, tab]);

  // Fetch exact score odds when score changes
  useEffect(() => {
    if (tab !== 'ExactScore') return;
    const h = parseScore(scoreH), a = parseScore(scoreA);
    if (h === null || a === null) { setExactOdds(null); return; }
    let cancelled = false;
    setExactLoading(true);
    fetchMarketOdds(match.id, BET_TYPE.ExactScore, { scoreHome: h, scoreAway: a })
      .then(o => { if (!cancelled) setExactOdds(o); })
      .finally(() => { if (!cancelled) setExactLoading(false); });
    return () => { cancelled = true; };
  }, [tab, match?.id, scoreH, scoreA]);

  // Fetch market pick odds whenever any market selection changes
  useEffect(() => {
    if (tab !== 'MarketPick') return;
    let cancelled = false;
    setMpLoading(true);

    const fetches = [
      // Winner — use stored match odds directly (no extra API call)
      Promise.resolve(
        mpWinner === 'Home' ? match.homeOdds :
        mpWinner === 'Draw' ? match.drawOdds :
        mpWinner === 'Away' ? match.awayOdds : null
      ),
      // BTTS
      mpBTTS
        ? fetchMarketOdds(match.id, BET_TYPE.BTTS, { btts: mpBTTS })
        : Promise.resolve(null),
      // Over/Under
      mpOULine && mpOUPick
        ? fetchMarketOdds(match.id, BET_TYPE.OverUnder, {
            ouLine: OU_LINE_MAP[mpOULine],
            ouPick: OU_PICK_MAP[mpOUPick],
          })
        : Promise.resolve(null),
    ];

    Promise.all(fetches).then(([winner, btts, ou]) => {
      if (!cancelled) setMpOdds({ winner, btts, ou });
    }).finally(() => { if (!cancelled) setMpLoading(false); });

    return () => { cancelled = true; };
  }, [tab, match?.id, mpWinner, mpBTTS, mpOULine, mpOUPick]);

  // ── Combined odds (product of all selected markets) ──────────
  const selectedMpOdds = Object.values(mpOdds).filter(o => o != null);
  const combinedOdds = selectedMpOdds.length > 0
    ? selectedMpOdds.reduce((acc, o) => acc * Number(o), 1)
    : null;

  // How many bets will be placed in Market Pick
  const mpBetCount = [mpWinner, mpBTTS, (mpOULine && mpOUPick) ? 'ou' : '']
    .filter(Boolean).length;

  // ── Ready checks ─────────────────────────────────────────────
  const amount = Number(betAmount);
  const isReady = (() => {
    if (!betAmount || amount <= 0) return false;
    if (tab === 'Winner')     return !!winnerPick;
    if (tab === 'ExactScore') return exactOdds != null;
    if (tab === 'MarketPick') return mpBetCount > 0 && combinedOdds != null;
    return false;
  })();

  // ── Place bet ────────────────────────────────────────────────
  const placeBet = async () => {
    if (!isReady) return;
    setBetLoading(true);
    setBetFeedback('');

    try {
      if (tab === 'Winner') {
        const res = await api.post('/Bet', {
          matchId: match.id,
          betType: BET_TYPE.Winner,
          pick: WINNER_PICK_MAP[winnerPick],
          amount,
        });
        setBetFeedback(`✅ Bet placed! Potential: ${Number(res.data.potentialPayout).toFixed(2)} 🪙`);

      } else if (tab === 'ExactScore') {
        const res = await api.post('/Bet', {
          matchId: match.id,
          betType: BET_TYPE.ExactScore,
          scoreHome: parseScore(scoreH),
          scoreAway: parseScore(scoreA),
          amount,
        });
        setBetFeedback(`✅ Bet placed! Potential: ${Number(res.data.potentialPayout).toFixed(2)} 🪙`);

      } else if (tab === 'MarketPick') {
        // Place one bet per selected market
        const bets = [];
        if (mpWinner) bets.push({ betType: BET_TYPE.Winner, pick: WINNER_PICK_MAP[mpWinner] });
        if (mpBTTS)   bets.push({ betType: BET_TYPE.BTTS, bttsPick: mpBTTS === 'true' });
        if (mpOULine && mpOUPick) bets.push({
          betType: BET_TYPE.OverUnder,
          ouLine: OU_LINE_MAP[mpOULine],
          ouPick: OU_PICK_MAP[mpOUPick],
        });

        let totalPayout = 0;
        for (const extra of bets) {
          const res = await api.post('/Bet', { matchId: match.id, amount, ...extra });
          totalPayout += Number(res.data.potentialPayout);
        }
        setBetFeedback(`✅ ${bets.length} bet(s) placed! Total potential: ${totalPayout.toFixed(2)} 🪙`);
      }

      await refreshBalance();
      setBetAmount('');
    } catch (err) {
      setBetFeedback(err?.response?.data?.message || 'Failed to place bet.');
    } finally {
      setBetLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  const winnerOdds = { Home: match.homeOdds, Draw: match.drawOdds, Away: match.awayOdds };

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

      {/* Tabs */}
      <div className="bet-type-tabs">
        {[['Winner', '1 / X / 2'], ['ExactScore', 'Exact Score'], ['MarketPick', 'Market Pick']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`bet-type-tab ${tab === key ? 'bet-type-tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: 1/X/2 ── */}
      {tab === 'Winner' && (
        <div className="bet-picks">
          {[
            { key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
            { key: 'Draw', label: 'Draw',             odds: match.drawOdds },
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

      {/* ── Tab: Exact Score ── */}
      {tab === 'ExactScore' && (
        <div className="bet-exact-score">
          <div className="scoreboard">
            <div className="scoreboard-team">
              <div className="scoreboard-team__name">{match.homeTeamName}</div>
              <div className="scorebox">
                <input type="number" min="0" max="20" placeholder="0"
                  value={scoreH} onChange={e => setScoreH(e.target.value)} />
              </div>
            </div>
            <div className="scoreboard__separator">:</div>
            <div className="scoreboard-team">
              <div className="scoreboard-team__name">{match.awayTeamName}</div>
              <div className="scorebox">
                <input type="number" min="0" max="20" placeholder="0"
                  value={scoreA} onChange={e => setScoreA(e.target.value)} />
              </div>
            </div>
          </div>
          {exactLoading && <div className="muted-text" style={{ textAlign: 'center' }}>Calculating odds...</div>}
          {exactOdds != null && !exactLoading && (
            <div className="bet-dynamic-odds">
              Odds for {scoreH}–{scoreA}: <strong>{Number(exactOdds).toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Market Pick ── */}
      {tab === 'MarketPick' && (
        <div className="bet-market-pick">
          {/* Winner row */}
          <div className="bet-mp-row">
            <span className="bet-mp-label">Winner</span>
            <div className="pick-row">
              {['Home', 'Draw', 'Away'].map(w => (
                <button key={w} type="button"
                  className={`pick-chip ${mpWinner === w ? 'pick-chip--active' : ''}`}
                  onClick={() => setMpWinner(mpWinner === w ? '' : w)}
                >
                  {w === 'Home' ? match.homeTeamName : w === 'Away' ? match.awayTeamName : 'Draw'}
                  {winnerOdds[w] != null && (
                    <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 700 }}>
                      {Number(winnerOdds[w]).toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* BTTS row */}
          <div className="bet-mp-row">
            <span className="bet-mp-label">BTTS</span>
            <div className="pick-row">
              {[['true', 'Yes'], ['false', 'No']].map(([val, lbl]) => (
                <button key={val} type="button"
                  className={`pick-chip ${mpBTTS === val ? 'pick-chip--active' : ''}`}
                  onClick={() => setMpBTTS(mpBTTS === val ? '' : val)}
                >
                  {lbl}
                  {mpBTTS === val && mpOdds.btts != null && (
                    <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 700 }}>
                      {Number(mpOdds.btts).toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Over/Under row */}
          <div className="bet-mp-row">
            <span className="bet-mp-label">O/U Line</span>
            <div className="pick-row">
              {['Line15', 'Line25', 'Line35'].map(line => (
                <button key={line} type="button"
                  className={`pick-chip ${mpOULine === line ? 'pick-chip--active' : ''}`}
                  onClick={() => setMpOULine(mpOULine === line ? '' : line)}
                >
                  {line.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                </button>
              ))}
            </div>
          </div>

          {mpOULine && (
            <div className="bet-mp-row">
              <span className="bet-mp-label">O/U Pick</span>
              <div className="pick-row">
                {['Over', 'Under'].map(p => (
                  <button key={p} type="button"
                    className={`pick-chip ${mpOUPick === p ? 'pick-chip--active' : ''}`}
                    onClick={() => setMpOUPick(mpOUPick === p ? '' : p)}
                  >
                    {p}
                    {mpOUPick === p && mpOdds.ou != null && (
                      <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 700 }}>
                        {Number(mpOdds.ou).toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mpLoading && <div className="muted-text">Calculating odds...</div>}

          {/* Combined odds display */}
          {combinedOdds != null && !mpLoading && (
            <div className="bet-combined-odds">
              <div className="bet-combined-odds__rows">
                {mpOdds.winner != null && (
                  <div className="bet-combined-odds__line">
                    <span>Winner ({mpWinner})</span>
                    <span>{Number(mpOdds.winner).toFixed(2)}</span>
                  </div>
                )}
                {mpOdds.btts != null && (
                  <div className="bet-combined-odds__line">
                    <span>BTTS {mpBTTS === 'true' ? 'Yes' : 'No'}</span>
                    <span>{Number(mpOdds.btts).toFixed(2)}</span>
                  </div>
                )}
                {mpOdds.ou != null && (
                  <div className="bet-combined-odds__line">
                    <span>{mpOUPick} {mpOULine.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}</span>
                    <span>{Number(mpOdds.ou).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="bet-combined-odds__total">
                Combined: <strong>{combinedOdds.toFixed(2)}</strong>
                <span className="muted-text" style={{ marginLeft: 8, fontSize: '0.78rem' }}>
                  ({mpBetCount} separate bet{mpBetCount > 1 ? 's' : ''})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Amount row */}
      <div className="bet-amount-row">
        <input
          type="number" min="1" placeholder="Amount (coins)"
          value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          className="bet-amount-input"
        />
        {amount > 0 && (() => {
          if (tab === 'Winner' && winnerPick)
            return <span className="bet-potential">→ {(amount * Number(winnerOdds[winnerPick])).toFixed(2)} 🪙</span>;
          if (tab === 'ExactScore' && exactOdds)
            return <span className="bet-potential">→ {(amount * Number(exactOdds)).toFixed(2)} 🪙</span>;
          if (tab === 'MarketPick' && combinedOdds)
            return <span className="bet-potential">→ {(amount * combinedOdds).toFixed(2)} 🪙</span>;
          return null;
        })()}
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={!isReady || betLoading}
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
