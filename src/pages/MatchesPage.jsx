import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import { useWallet } from '../context/WalletContext';

// ── Enums (string values — backend uses JsonStringEnumConverter) ─
const WINNER_MAP   = { Home: 'Home', Draw: 'Draw', Away: 'Away' };
const BET_TYPE     = { Winner: 'Winner', ExactScore: 'ExactScore', BTTS: 'BTTS', OverUnder: 'OverUnder' };
const OU_LINE_MAP  = { Line15: 'Line15', Line25: 'Line25', Line35: 'Line35' };
const OU_PICK_MAP  = { Over: 'Over', Under: 'Under' };

const parseScore = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const EMPTY = { homeScore: '', awayScore: '', winner: '', btts: '', ouLine: '', ouPick: '' };

// ── Fetch odds from backend ──────────────────────────────────────
async function fetchOdds(matchId, betType, params = {}) {
  const qs = new URLSearchParams({ betType, ...params });
  try {
    const r = await api.get(`/Odds/${matchId}?${qs}`);
    return r.data ?? null;
  } catch { return null; }
}

// ── Quick 1/X/2 bet panel ────────────────────────────────────────
function QuickBetPanel({ match }) {
  const { balance, refreshBalance } = useWallet();
  const [pick, setPick]       = useState('');
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { setPick(''); setAmount(''); setFeedback(null); }, [match?.id]);

  const oddsMap = { Home: match.homeOdds, Draw: match.drawOdds, Away: match.awayOdds };
  const selectedOdds = pick ? Number(oddsMap[pick]) : null;
  const potential = selectedOdds && Number(amount) > 0
    ? (selectedOdds * Number(amount)).toFixed(2) : null;

  const place = async () => {
    if (!pick || Number(amount) <= 0) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post('/Bet', {
        matchId: match.id, betType: 'Winner',
        pick: pick, // 'Home' | 'Draw' | 'Away'
        amount: Number(amount),
      });
      await refreshBalance();
      setFeedback('✅ Bet placed! Check My Bets for details.');
      setPick(''); setAmount('');
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to place bet.');
    } finally { setLoading(false); }
  };

  return (
    <div className="quick-bet-panel">
      <div className="quick-bet-panel__title">Quick Bet — 1 / X / 2</div>
      <div className="bet-picks">
        {[
          { key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
          { key: 'Draw', label: 'Draw',             odds: match.drawOdds  },
          { key: 'Away', label: match.awayTeamName, odds: match.awayOdds  },
        ].map(({ key, label, odds }) => (
          <button key={key} type="button"
            className={`bet-pick-btn ${pick === key ? 'bet-pick-btn--active' : ''}`}
            onClick={() => { setPick(pick === key ? '' : key); setFeedback(null); }}>
            <span className="bet-pick-btn__label">{label}</span>
            <span className="bet-pick-btn__odds">{odds != null ? Number(odds).toFixed(2) : '—'}</span>
          </button>
        ))}
      </div>
      {pick && (
        <div className="bet-amount-row" style={{ marginTop: 12 }}>
          <input type="number" min="1" placeholder="Stake (coins)"
            value={amount} onChange={e => setAmount(e.target.value)}
            className="bet-amount-input"
            onKeyDown={e => e.key === 'Enter' && place()} />
          {potential && <span className="bet-potential">→ {potential} 🪙</span>}
        </div>
      )}
      <button type="button" className="primary-button" style={{ marginTop: 12 }}
        disabled={!pick || Number(amount) <= 0 || loading}
        onClick={place}>
        {loading ? 'Placing...' : 'Place Bet'}
      </button>
      {feedback && <div className="alert alert-error" style={{ marginTop: 10 }}>{feedback}</div>}
    </div>
  );
}

// ── Inline bet amount row used in both modes ─────────────────────
function StakeRow({ amount, setAmount, potential }) {
  return (
    <div className="bet-amount-row" style={{ marginTop: 14 }}>
      <input
        type="number" min="1" placeholder="Stake (coins)"
        value={amount} onChange={e => setAmount(e.target.value)}
        className="bet-amount-input"
      />
      {potential != null && (
        <span className="bet-potential">→ {Number(potential).toFixed(2)} 🪙</span>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function MatchesPage() {
  const { refreshBalance } = useWallet();

  const [matches, setMatches]           = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mode, setMode]                 = useState('');   // '' | 'exact' | 'market'
  const [fields, setFields]             = useState(EMPTY);
  const [amount, setAmount]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [feedback, setFeedback]         = useState(null); // {type, msg}
  const [aiPrediction, setAiPrediction] = useState(null);
  const [pageLoading, setPageLoading]   = useState(false);
  const [loadError, setLoadError]       = useState('');

  // Live odds
  const [exactOdds, setExactOdds]       = useState(null);
  const [exactOddsLoading, setExactOddsLoading] = useState(false);
  const [mpOdds, setMpOdds]             = useState({ winner: null, btts: null, ou: null });
  const [mpOddsLoading, setMpOddsLoading] = useState(false);

  const panelRef = useRef(null);
  const setField = useCallback((k, v) => setFields(p => ({ ...p, [k]: v })), []);

  // Load matches
  useEffect(() => {
    setPageLoading(true);
    api.get('/Match/upcoming?take=20')
      .then(r => setMatches(r.data))
      .catch(e => setLoadError(e?.response?.data?.message || 'Failed to load matches.'))
      .finally(() => setPageLoading(false));
  }, []);

  const aiRef = useRef(null);

  const resetPanel = useCallback(() => {
    setMode(''); setFields(EMPTY); setAmount(''); setFeedback(null);
    setAiPrediction(null);
    setExactOdds(null); setMpOdds({ winner: null, btts: null, ou: null });
  }, []);

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;
  const home = parseScore(homeScore);
  const away = parseScore(awayScore);
  const hasScore   = home != null && away != null;
  const isExact    = mode === 'exact';
  const isMarket   = mode === 'market';
  const hasBetOdds = selectedMatch?.homeOdds != null;

  // Live odds — Exact Score
  useEffect(() => {
    if (!isExact || !hasBetOdds || home === null || away === null) { setExactOdds(null); return; }
    let cancelled = false;
    setExactOddsLoading(true);
    fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: home, scoreAway: away })
      .then(r => { if (!cancelled) setExactOdds(r); })
      .finally(() => { if (!cancelled) setExactOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isExact, selectedMatch?.id, home, away, hasBetOdds]);

  // Live odds — Market Pick
  useEffect(() => {
    if (!isMarket || !hasBetOdds) return;
    let cancelled = false;
    setMpOddsLoading(true);
    const winnerOdds = winner === 'Home' ? selectedMatch.homeOdds
                     : winner === 'Draw' ? selectedMatch.drawOdds
                     : winner === 'Away' ? selectedMatch.awayOdds : null;
    Promise.all([
      Promise.resolve(winnerOdds),
      btts
        ? fetchOdds(selectedMatch.id, BET_TYPE.BTTS, { btts }).then(r => r?.odds ?? null)
        : Promise.resolve(null),
      ouLine && ouPick
        ? fetchOdds(selectedMatch.id, BET_TYPE.OverUnder,
            { ouLine: OU_LINE_MAP[ouLine], ouPick: OU_PICK_MAP[ouPick] }).then(r => r?.odds ?? null)
        : Promise.resolve(null),
    ]).then(([w, b, o]) => {
      if (!cancelled) setMpOdds({ winner: w, btts: b, ou: o });
    }).finally(() => { if (!cancelled) setMpOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isMarket, selectedMatch?.id, winner, btts, ouLine, ouPick, hasBetOdds]);

  // Combined odds for market pick
  const mpSelected = [
    winner && mpOdds.winner,
    btts    && mpOdds.btts,
    ouLine  && ouPick && mpOdds.ou,
  ].filter(Boolean);
  const combinedOdds = mpSelected.length
    ? mpSelected.reduce((a, o) => a * Number(o), 1) : null;

  // Potential payout
  const betAmt = Number(amount);
  const exactPotential  = exactOdds && betAmt > 0 ? betAmt * Number(exactOdds.odds) : null;
  const marketPotential = combinedOdds && betAmt > 0 ? betAmt * combinedOdds : null;

  // ── Place Bet (prediction + optional bet stake) ───────────────
  const placeBet = async () => {
    if (!selectedMatch || loading) return;
    setLoading(true); setFeedback(null); setAiPrediction(null);

    try {
      // 1. Save prediction (for points) — get AI analysis back
      const predBody = {
        matchId: selectedMatch.id,
        predictionHomeScore: isExact ? home : null,
        predictionAwayScore: isExact ? away : null,
        predictionWinner:    isMarket && winner ? WINNER_MAP[winner] : null,
        predictionBTTS:      isMarket && btts !== '' ? btts === 'true' : null,
        predictionOULine:    isMarket && ouLine ? ouLine : null,
        predictionOUPick:    isMarket && ouPick ? ouPick : null,
      };
      const predRes = await api.post('/Prediction', predBody);
      const ai = predRes.data?.aiPredictionResponseDTO ?? null;
      if (ai) setAiPrediction(ai);

      // 2. Place bet(s) for My Bets (if stake entered)
      if (betAmt > 0 && hasBetOdds) {
        if (isExact && home !== null && away !== null) {
          await api.post('/Bet', {
            matchId: selectedMatch.id, betType: BET_TYPE.ExactScore,
            scoreHome: home, scoreAway: away, amount: betAmt,
          });
        } else if (isMarket) {
          if (winner && mpOdds.winner != null)
            await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.Winner,
              pick: WINNER_MAP[winner], amount: betAmt });
          if (btts && mpOdds.btts != null)
            await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.BTTS,
              bttsPick: btts === 'true', amount: betAmt }); // ← bttsPick (not btts)
          if (ouLine && ouPick && mpOdds.ou != null)
            await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.OverUnder,
              ouLine: OU_LINE_MAP[ouLine], ouPick: OU_PICK_MAP[ouPick], amount: betAmt });
        }
        await refreshBalance();
      }

      setFeedback({ type: 'ok', msg: betAmt > 0 ? '✅ Bet placed!' : '✅ Prediction saved!' });

      // Scroll to AI prediction
      if (ai) {
        setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      }
    } catch (err) {
      setFeedback({ type: 'err', msg: err?.response?.data?.message || 'Failed to place bet.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="page-grid">

      {/* Match list */}
      <section className="shell-card panel">
        <div className="section-head">
          <div><h2>Upcoming Matches</h2><p>Select a match to place your bet.</p></div>
        </div>
        {loadError && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}
        {!pageLoading && !matches.length && !loadError && (
          <div className="empty-box">No upcoming matches found.</div>
        )}
        <div className="cards-grid">
          {matches.map(match => (
            <MatchCard key={match.id} match={match}
              selected={selectedMatch?.id === match.id}
              onSelect={() => {
                if (selectedMatch?.id === match.id) { setSelectedMatch(null); resetPanel(); }
                else {
                  setSelectedMatch(match); resetPanel();
                  setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* Bet + prediction panel */}
      {selectedMatch && (
        <section className="shell-card panel" ref={panelRef}>

          {/* Match hero */}
          <div className="match-hero">
            <div className="match-hero__badge">Selected Match</div>
            <h2 className="match-hero__title">
              <span>{selectedMatch.homeTeamName}</span>
              <span className="match-hero__vs">vs</span>
              <span>{selectedMatch.awayTeamName}</span>
            </h2>
            <div className="match-hero__meta">
              <span className="match-hero__date">{new Date(selectedMatch.matchDate).toLocaleString()}</span>
            </div>
          </div>

          {/* Mode selector */}
          {!mode && (
            <div className="premium-mode-grid">
              <button type="button" className="premium-mode-card premium-mode-card--exact"
                onClick={() => setMode('exact')}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">🎯</span>
                  <span className="premium-mode-card__points">5 pts</span>
                </div>
                <div className="premium-mode-card__title">Exact Score</div>
                <div className="premium-mode-card__text">Predict the final score and earn maximum points.</div>
              </button>
              <button type="button" className="premium-mode-card premium-mode-card--market"
                onClick={() => setMode('market')}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">📈</span>
                  <span className="premium-mode-card__points">up to 3 pts</span>
                </div>
                <div className="premium-mode-card__title">Market Pick</div>
                <div className="premium-mode-card__text">Predict winner, BTTS and Over / Under outcomes.</div>
              </button>
            </div>
          )}

          <div className="prediction-form">

            {/* ── Exact Score mode ── */}
            {isExact && (
              <>
                <div className="mode-card mode-card--exact">
                  <div className="mode-card__top">
                    <span className="mode-badge">EXACT SCORE — 5 PTS</span>
                  </div>
                  <div className="mode-card__title">Predict the exact final score</div>
                  <button type="button" className="mode-card__button"
                    onClick={() => { setMode(''); setFields(EMPTY); }}>
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
                        <input type="number" min="0" max="20" placeholder="0"
                          value={homeScore} onChange={e => setField('homeScore', e.target.value)} />
                      </div>
                    </div>
                    <div className="scoreboard__separator">:</div>
                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.awayTeamName}</div>
                      <div className="scorebox">
                        <input type="number" min="0" max="20" placeholder="0"
                          value={awayScore} onChange={e => setField('awayScore', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Odds + stake for exact score */}
                {hasBetOdds && hasScore && (
                  <div className="inline-bet-wrapper">
                    {exactOddsLoading && <div className="muted-text" style={{ textAlign: 'center' }}>Calculating odds...</div>}
                    {exactOdds && !exactOddsLoading && (
                      <>
                        <div className="mp-odds-row">
                          <span>Odds for {homeScore}–{awayScore}</span>
                          <strong style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                            {Number(exactOdds.odds).toFixed(2)}
                          </strong>
                        </div>
                        <StakeRow amount={amount} setAmount={setAmount} potential={exactPotential} />
                      </>
                    )}
                  </div>
                )}

                <button className="primary-button" style={{ marginTop: 14 }}
                  onClick={placeBet} disabled={loading || !hasScore} type="button">
                  {loading ? 'Placing...' : 'Place Bet'}
                </button>
              </>
            )}

            {/* ── Market Pick mode ── */}
            {isMarket && (
              <>
                <div className="mode-card mode-card--market">
                  <div className="mode-card__top">
                    <span className="mode-badge">MARKET PICK — UP TO 3 PTS</span>
                  </div>
                  <div className="mode-card__title">Predict Winner, BTTS and Over / Under</div>
                  <button type="button" className="mode-card__button"
                    onClick={() => { setMode(''); setFields(EMPTY); }}>
                    Change type
                  </button>
                </div>

                <div className="prediction-options">
                  {/* Winner */}
                  <div className="option-card">
                    <span className="option-card__label">Winner</span>
                    <div className="pick-row">
                      {['Home', 'Draw', 'Away'].map(w => (
                        <button key={w} type="button"
                          className={`pick-chip ${winner === w ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('winner', winner === w ? '' : w)}>
                          {w === 'Home' ? selectedMatch.homeTeamName : w === 'Away' ? selectedMatch.awayTeamName : 'Draw'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* BTTS */}
                  <div className="option-card">
                    <span className="option-card__label">Both teams to score</span>
                    <div className="pick-row">
                      {[['true', 'Yes'], ['false', 'No']].map(([val, lbl]) => (
                        <button key={val} type="button"
                          className={`pick-chip ${btts === val ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('btts', btts === val ? '' : val)}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* O/U Pick */}
                  <div className="option-card option-card--compact">
                    <span className="option-card__label">Over / Under Pick</span>
                    <div className="pick-row">
                      {['Over', 'Under'].map(p => (
                        <button key={p} type="button"
                          className={`pick-chip ${ouPick === p ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouPick', ouPick === p ? '' : p)}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* O/U Line */}
                  <div className="option-card option-card--compact">
                    <span className="option-card__label">Goals line</span>
                    <div className="pick-row">
                      {['Line15', 'Line25', 'Line35'].map(line => (
                        <button key={line} type="button"
                          className={`pick-chip ${ouLine === line ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouLine', ouLine === line ? '' : line)}>
                          {line.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Odds breakdown + stake */}
                {hasBetOdds && (winner || btts || (ouLine && ouPick)) && (
                  <div className="inline-bet-wrapper">
                    {mpOddsLoading && <div className="muted-text">Calculating odds...</div>}
                    {!mpOddsLoading && (
                      <div className="mp-odds-breakdown">
                        {winner && mpOdds.winner != null && (
                          <div className="mp-odds-row">
                            <span>Winner — {winner === 'Home' ? selectedMatch.homeTeamName : winner === 'Away' ? selectedMatch.awayTeamName : 'Draw'}</span>
                            <strong>{Number(mpOdds.winner).toFixed(2)}</strong>
                          </div>
                        )}
                        {btts && mpOdds.btts != null && (
                          <div className="mp-odds-row">
                            <span>BTTS {btts === 'true' ? 'Yes' : 'No'}</span>
                            <strong>{Number(mpOdds.btts).toFixed(2)}</strong>
                          </div>
                        )}
                        {ouLine && ouPick && mpOdds.ou != null && (
                          <div className="mp-odds-row">
                            <span>{ouPick} {ouLine.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}</span>
                            <strong>{Number(mpOdds.ou).toFixed(2)}</strong>
                          </div>
                        )}
                        {combinedOdds != null && mpSelected.length >= 2 && (
                          <div className="mp-odds-row mp-odds-row--total">
                            <span>Combined odds</span>
                            <strong style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                              {combinedOdds.toFixed(2)}
                            </strong>
                          </div>
                        )}
                        <StakeRow amount={amount} setAmount={setAmount} potential={marketPotential} />
                      </div>
                    )}
                  </div>
                )}

                <button className="primary-button" style={{ marginTop: 14 }}
                  onClick={placeBet}
                  disabled={loading || (!winner && !btts && !ouLine)} type="button">
                  {loading ? 'Placing...' : 'Place Bet'}
                </button>
              </>
            )}

            {feedback && (
              <div className={`alert ${feedback.type === 'ok' ? 'alert-info' : 'alert-error'}`}
                style={{ marginTop: 12 }}>
                {feedback.msg}
              </div>
            )}
          </div>

          {/* AI Prediction card */}
          {aiPrediction && (
            <div ref={aiRef} className="ai-card" style={{ marginTop: 16 }}>
              <h3>🤖 AI Prediction</h3>
              {aiPrediction.aiAnalysis && (
                <p className="ai-analysis">{aiPrediction.aiAnalysis}</p>
              )}
              <div className="ai-grid">
                <div>
                  <span className="muted-text">Predicted Score</span>
                  <div className="ai-value">{aiPrediction.predictedHomeScore} – {aiPrediction.predictedAwayScore}</div>
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

          {/* Quick 1/X/2 bet — always visible below prediction modes */}
          {hasBetOdds && (
            <>
              <div className="quick-bet-divider">
                <span>or place a quick bet</span>
              </div>
              <QuickBetPanel match={selectedMatch} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
