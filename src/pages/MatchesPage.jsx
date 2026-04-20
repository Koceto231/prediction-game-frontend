import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import { useWallet } from '../context/WalletContext';

// ── Enum maps ────────────────────────────────────────────────────
const WINNER_PICK_MAP = { Home: 1, Draw: 2, Away: 3 };
const WINNER_MAP      = { Home: 1, Draw: 2, Away: 3 };
const BET_TYPE        = { Winner: 1, ExactScore: 2, BTTS: 3, OverUnder: 4 };
const OU_LINE_MAP     = { Line15: 1, Line25: 2, Line35: 3 };
const OU_PICK_MAP     = { Over: 1, Under: 2 };

const parseScore = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const EMPTY_PREDICTION = { homeScore: '', awayScore: '', winner: '', btts: '', ouLine: '', ouPick: '' };

// ── Fetch one market's odds ───────────────────────────────────────
async function fetchOdds(matchId, betType, params = {}) {
  const qs = new URLSearchParams({ betType, ...params });
  try {
    const r = await api.get(`/Odds/${matchId}?${qs}`);
    return r.data ?? null;
  } catch { return null; }
}

// ── Simplified BetPanel (1/X/2 only) ────────────────────────────
function BetPanel({ match }) {
  const { balance, refreshBalance } = useWallet();
  const [pick, setPick]         = useState('');
  const [amount, setAmount]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => { setPick(''); setAmount(''); setFeedback(''); }, [match?.id]);

  const odds = { Home: match.homeOdds, Draw: match.drawOdds, Away: match.awayOdds };
  const selectedOdds = pick ? odds[pick] : null;
  const potential = amount > 0 && selectedOdds ? (Number(amount) * Number(selectedOdds)).toFixed(2) : null;

  const placeBet = async () => {
    if (!pick || !amount || Number(amount) <= 0) return;
    setLoading(true); setFeedback('');
    try {
      const res = await api.post('/Bet', {
        matchId: match.id,
        betType: BET_TYPE.Winner,
        pick: WINNER_PICK_MAP[pick],
        amount: Number(amount),
      });
      await refreshBalance();
      setFeedback(`✅ Bet placed! Potential: ${Number(res.data.potentialPayout).toFixed(2)} 🪙`);
      setPick(''); setAmount('');
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to place bet.');
    } finally { setLoading(false); }
  };

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

      <div className="bet-picks">
        {[
          { key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
          { key: 'Draw', label: 'Draw',             odds: match.drawOdds  },
          { key: 'Away', label: match.awayTeamName, odds: match.awayOdds  },
        ].map(({ key, label, odds: o }) => (
          <button key={key} type="button"
            className={`bet-pick-btn ${pick === key ? 'bet-pick-btn--active' : ''}`}
            onClick={() => setPick(pick === key ? '' : key)}
          >
            <span className="bet-pick-btn__label">{label}</span>
            <span className="bet-pick-btn__odds">{o != null ? Number(o).toFixed(2) : '—'}</span>
          </button>
        ))}
      </div>

      {pick && (
        <div className="bet-amount-row">
          <input
            type="number" min="1" placeholder="Amount (coins)"
            value={amount} onChange={e => setAmount(e.target.value)}
            className="bet-amount-input"
          />
          {potential && <span className="bet-potential">→ {potential} 🪙</span>}
        </div>
      )}

      <button type="button" className="primary-button"
        disabled={!pick || !amount || Number(amount) <= 0 || loading}
        onClick={placeBet}
      >
        {loading ? 'Placing...' : 'Place Bet'}
      </button>

      {feedback && (
        <div className={`alert ${feedback.startsWith('✅') ? 'alert-info' : 'alert-error'}`}>
          {feedback}
        </div>
      )}
    </div>
  );
}

// ── InlineBet: small bet form shown inside prediction modes ──────
// betBody  = single bet  { matchId, betType, ... }
// betBodies = array of   { body: {...}, odds, label } for multi-market accumulators
function InlineBet({ betBody, betBodies, oddsValue, label, onDone }) {
  const { refreshBalance } = useWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  // For multi-market: combine odds; for single: use oddsValue
  const isMulti    = Array.isArray(betBodies) && betBodies.length > 0;
  const displayOdds = isMulti
    ? betBodies.reduce((acc, b) => acc * Number(b.odds), 1)
    : oddsValue;
  const potential = amount > 0 && displayOdds ? (Number(amount) * Number(displayOdds)).toFixed(2) : null;

  const place = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (!isMulti && !betBody) return;
    setLoading(true); setFeedback('');
    try {
      if (isMulti) {
        // Place one bet per market (each with the same stake)
        for (const { body } of betBodies) {
          await api.post('/Bet', { ...body, amount: amt });
        }
      } else {
        await api.post('/Bet', { ...betBody, amount: amt });
      }
      await refreshBalance();
      const totalPotential = potential ?? '—';
      setFeedback(`✅ ${isMulti ? betBodies.length + ' bets placed!' : 'Bet placed!'} Potential: ${totalPotential} 🪙`);
      setAmount('');
      if (onDone) onDone();
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to place bet.');
    } finally { setLoading(false); }
  };

  return (
    <div className="inline-bet">
      <div className="inline-bet__odds">
        <span className="muted-text">Odds{label ? ` for ${label}` : ''}:</span>
        <strong style={{ color: 'var(--accent)', fontSize: '1.2rem', marginLeft: 8 }}>
          {displayOdds ? Number(displayOdds).toFixed(2) : '—'}
        </strong>
      </div>
      <div className="bet-amount-row" style={{ marginTop: 8 }}>
        <input type="number" min="1" placeholder="Bet amount (coins)"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="bet-amount-input"
        />
        {potential && <span className="bet-potential">→ {potential} 🪙</span>}
      </div>
      <button type="button" className="ghost-button"
        style={{ marginTop: 8, width: '100%' }}
        disabled={!amount || Number(amount) <= 0 || !displayOdds || loading}
        onClick={place}
      >
        {loading ? 'Placing...' : '🎰 Bet on this'}
      </button>
      {feedback && (
        <div className={`alert ${feedback.startsWith('✅') ? 'alert-info' : 'alert-error'}`}
          style={{ marginTop: 8 }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function MatchesPage() {
  const [matches, setMatches]           = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [predictionMode, setPredictionMode] = useState('');
  const [fields, setFields]             = useState(EMPTY_PREDICTION);
  const [feedback, setFeedback]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [loadError, setLoadError]       = useState('');
  const [aiPrediction, setAiPrediction] = useState(null);
  const [showNilNilPrompt, setShowNilNilPrompt] = useState(false);
  const [pageLoading, setPageLoading]   = useState(false);

  // Exact score betting odds (fetched live as user types score)
  const [exactBetOdds, setExactBetOdds] = useState(null);
  const [exactOddsLoading, setExactOddsLoading] = useState(false);

  // Market pick betting odds
  const [mpBetOdds, setMpBetOdds]     = useState({ winner: null, btts: null, ou: null });
  const [mpOddsLoading, setMpOddsLoading] = useState(false);

  const predictionRef  = useRef(null);
  const aiPredictionRef = useRef(null);

  const setField = useCallback((key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  }, []);

  // Load matches
  useEffect(() => {
    const load = async () => {
      try { setPageLoading(true); setLoadError('');
        const r = await api.get('/Match/upcoming?take=20');
        setMatches(r.data);
      } catch (e) {
        setLoadError(e?.response?.data?.message || 'Failed to load matches.');
        setMatches([]);
      } finally { setPageLoading(false); }
    };
    load();
  }, []);

  const resetAll = useCallback(() => {
    setFields(EMPTY_PREDICTION);
    setShowNilNilPrompt(false);
    setPredictionMode('');
    setAiPrediction(null);
    setFeedback('');
    setExactBetOdds(null);
    setMpBetOdds({ winner: null, btts: null, ou: null });
  }, []);

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;
  const home         = parseScore(homeScore);
  const away         = parseScore(awayScore);
  const hasExactScore = home != null && away != null;
  const isExactMode  = predictionMode === 'exact';
  const isMarketMode = predictionMode === 'market';
  const isDrawNoBtts = !hasExactScore && winner === 'Draw' && btts === 'false';
  const isDrawYesBtts = !hasExactScore && winner === 'Draw' && btts === 'true';

  useEffect(() => {
    setShowNilNilPrompt(isMarketMode && winner === 'Draw' && btts === 'false' && homeScore === '' && awayScore === '');
  }, [winner, btts, homeScore, awayScore, isMarketMode]);

  useEffect(() => {
    if (isMarketMode && isDrawNoBtts && ouLine) setField('ouPick', 'Under');
  }, [isMarketMode, isDrawNoBtts, ouLine, setField]);

  // Live odds for Exact Score mode
  useEffect(() => {
    if (!isExactMode || !selectedMatch?.homeOdds) return;
    if (home === null || away === null) { setExactBetOdds(null); return; }
    let cancelled = false;
    setExactOddsLoading(true);
    fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: home, scoreAway: away })
      .then(r => { if (!cancelled) setExactBetOdds(r); })
      .finally(() => { if (!cancelled) setExactOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isExactMode, selectedMatch?.id, home, away]);

  // Live odds for Market Pick mode
  useEffect(() => {
    if (!isMarketMode || !selectedMatch?.homeOdds) return;
    let cancelled = false;
    setMpOddsLoading(true);
    const winnerOdds = winner === 'Home' ? selectedMatch.homeOdds
                     : winner === 'Draw' ? selectedMatch.drawOdds
                     : winner === 'Away' ? selectedMatch.awayOdds
                     : null;
    Promise.all([
      Promise.resolve(winnerOdds),
      btts ? fetchOdds(selectedMatch.id, BET_TYPE.BTTS, { btts }).then(r => r?.odds ?? null)
           : Promise.resolve(null),
      ouLine && ouPick
        ? fetchOdds(selectedMatch.id, BET_TYPE.OverUnder, { ouLine: OU_LINE_MAP[ouLine], ouPick: OU_PICK_MAP[ouPick] }).then(r => r?.odds ?? null)
        : Promise.resolve(null),
    ]).then(([w, b, o]) => {
      if (!cancelled) setMpBetOdds({ winner: w, btts: b, ou: o });
    }).finally(() => { if (!cancelled) setMpOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isMarketMode, selectedMatch?.id, winner, btts, ouLine, ouPick]);

  const mpSelected = [winner && mpBetOdds.winner, btts && mpBetOdds.btts, ouLine && ouPick && mpBetOdds.ou].filter(Boolean);
  const combinedOdds = mpSelected.length ? mpSelected.reduce((a, o) => a * Number(o), 1) : null;

  const submitPrediction = async () => {
    if (!selectedMatch) return;
    setLoading(true); setFeedback('');
    try {
      const body = {
        matchId: selectedMatch.id,
        predictionHomeScore: isExactMode ? home : null,
        predictionAwayScore: isExactMode ? away : null,
        predictionWinner:    isMarketMode && winner ? WINNER_MAP[winner] : null,
        predictionBTTS:      isMarketMode && btts !== '' ? btts === 'true' : null,
        predictionOULine:    isMarketMode && ouLine ? ouLine : null,
        predictionOUPick:    isMarketMode && ouPick ? ouPick : null,
      };
      const res = await api.post('/Prediction', body);
      const ai = res.data?.aiPredictionResponseDTO ?? null;
      setAiPrediction(ai);
      setFeedback('Prediction saved!');
      if (ai) {
        setTimeout(() => {
          aiPredictionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => window.scrollBy({ top: 120, behavior: 'smooth' }), 250);
        }, 200);
      }
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to save prediction.');
    } finally { setLoading(false); }
  };

  const hasBettingOdds = selectedMatch?.homeOdds != null;

  return (
    <div className="page-grid">
      {/* ── Match list ── */}
      <section className="shell-card panel">
        <div className="section-head">
          <div><h2>Upcoming Matches</h2><p>Select a match to make your prediction.</p></div>
        </div>
        {loadError && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}
        {!pageLoading && !matches.length && !loadError && <div className="empty-box">No upcoming matches found.</div>}
        <div className="cards-grid">
          {matches.map(match => (
            <MatchCard key={match.id} match={match}
              selected={selectedMatch?.id === match.id}
              onSelect={() => {
                if (selectedMatch?.id === match.id) { setSelectedMatch(null); resetAll(); }
                else {
                  setSelectedMatch(match); resetAll();
                  setTimeout(() => predictionRef.current?.scrollIntoView({ behavior: 'smooth', top: document.body.scrollHeight }), 150);
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* ── Prediction + Bet panel ── */}
      {selectedMatch && (
        <section className="shell-card panel" ref={predictionRef}>
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
          {!predictionMode && (
            <div className="premium-mode-grid">
              <button type="button" className="premium-mode-card premium-mode-card--exact"
                onClick={() => setPredictionMode('exact')}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">🎯</span>
                  <span className="premium-mode-card__points">5 pts</span>
                </div>
                <div className="premium-mode-card__title">Exact Score</div>
                <div className="premium-mode-card__text">Predict the final score and earn maximum points.</div>
              </button>
              <button type="button" className="premium-mode-card premium-mode-card--market"
                onClick={() => setPredictionMode('market')}>
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
            {isExactMode && (
              <>
                <div className="mode-card mode-card--exact">
                  <div className="mode-card__top">
                    <span className="mode-badge">EXACT SCORE MODE</span>
                    <span className="mode-points">5 PTS</span>
                  </div>
                  <div className="mode-card__title">Exact score prediction</div>
                  <div className="mode-card__text">Predict the exact final score for this match.</div>
                  <button type="button" className="mode-card__button"
                    onClick={() => { setPredictionMode(''); setFields(EMPTY_PREDICTION); }}>
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

                {/* Live odds + inline bet for exact score */}
                {hasBettingOdds && hasExactScore && (
                  <div className="inline-bet-wrapper">
                    {exactOddsLoading && <div className="muted-text" style={{ textAlign: 'center' }}>Calculating odds...</div>}
                    {exactBetOdds && !exactOddsLoading && (
                      <InlineBet
                        matchId={selectedMatch.id}
                        label={`${homeScore}–${awayScore}`}
                        oddsValue={exactBetOdds.odds}
                        betBody={{ matchId: selectedMatch.id, betType: BET_TYPE.ExactScore, scoreHome: home, scoreAway: away }}
                      />
                    )}
                  </div>
                )}

                <button className="primary-button" onClick={submitPrediction} disabled={loading} type="button">
                  {loading ? 'Saving...' : 'Create Prediction'}
                </button>
              </>
            )}

            {/* ── Market Pick mode ── */}
            {isMarketMode && (
              <>
                <div className="mode-card mode-card--market">
                  <div className="mode-card__top">
                    <span className="mode-badge">MARKET MODE</span>
                    <span className="mode-points">UP TO 3 PTS</span>
                  </div>
                  <div className="mode-card__title">Market prediction</div>
                  <div className="mode-card__text">Predict Winner, BTTS and Over / Under for this match.</div>
                  <button type="button" className="mode-card__button"
                    onClick={() => { setPredictionMode(''); setFields(EMPTY_PREDICTION); setShowNilNilPrompt(false); }}>
                    Change type
                  </button>
                </div>

                {showNilNilPrompt && (
                  <div className="alert alert-info">
                    Draw + BTTS No allows only 0:0. Autofill score to 0:0?
                    <div className="button-row" style={{ marginTop: '12px' }}>
                      <button type="button" className="primary-button"
                        onClick={() => { setFields(p => ({ ...p, homeScore: '0', awayScore: '0' })); setShowNilNilPrompt(false); setPredictionMode('exact'); }}>
                        Yes, autofill
                      </button>
                      <button type="button" className="ghost-button" onClick={() => setShowNilNilPrompt(false)}>
                        No, keep manual
                      </button>
                    </div>
                  </div>
                )}

                {!hasExactScore && (
                  <div className="prediction-options">
                    {/* Winner */}
                    <div className="option-card">
                      <span className="option-card__label">Winner</span>
                      <div className="pick-row">
                        {['Home', 'Draw', 'Away'].map(w => (
                          <button key={w} type="button"
                            className={`pick-chip ${winner === w ? 'pick-chip--active' : ''}`}
                            onClick={() => setField('winner', winner === w ? '' : w)}>
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BTTS */}
                    <div className="option-card">
                      <span className="option-card__label">Both teams to score</span>
                      <div className="pick-row">
                        {[['true', 'Yes'], ['false', 'No']].map(([val, label]) => (
                          <button key={val} type="button"
                            className={`pick-chip ${btts === val ? 'pick-chip--active' : ''}`}
                            onClick={() => setField('btts', btts === val ? '' : val)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* O/U Pick */}
                    <div className="option-card option-card--compact">
                      <div className="option-card__header">
                        <span className="option-card__label">Over / Under Pick</span>
                      </div>
                      <div className="pick-row pick-row--compact">
                        <button type="button"
                          className={`pick-chip ${ouPick === 'Over' ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouPick', ouPick === 'Over' ? '' : 'Over')}
                          disabled={isDrawNoBtts || (isDrawYesBtts && ouLine === 'Line15')}>
                          Over
                        </button>
                        <button type="button"
                          className={`pick-chip ${ouPick === 'Under' ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouPick', ouPick === 'Under' ? '' : 'Under')}>
                          Under
                        </button>
                      </div>
                    </div>

                    {/* O/U Line */}
                    <div className="option-card option-card--compact">
                      <div className="option-card__header">
                        <span className="option-card__label">Over / Under Goals</span>
                      </div>
                      <div className="pick-row pick-row--compact">
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
                )}

                {/* Combined odds display + inline bet */}
                {hasBettingOdds && (winner || btts || (ouLine && ouPick)) && (
                  <div className="inline-bet-wrapper">
                    {mpOddsLoading && <div className="muted-text">Calculating odds...</div>}
                    {!mpOddsLoading && (
                      <div className="mp-odds-breakdown">
                        {winner && mpBetOdds.winner != null && (
                          <div className="mp-odds-row">
                            <span>Winner — {winner === 'Home' ? selectedMatch.homeTeamName : winner === 'Away' ? selectedMatch.awayTeamName : 'Draw'}</span>
                            <strong>{Number(mpBetOdds.winner).toFixed(2)}</strong>
                          </div>
                        )}
                        {btts && mpBetOdds.btts != null && (
                          <div className="mp-odds-row">
                            <span>BTTS {btts === 'true' ? 'Yes' : 'No'}</span>
                            <strong>{Number(mpBetOdds.btts).toFixed(2)}</strong>
                          </div>
                        )}
                        {ouLine && ouPick && mpBetOdds.ou != null && (
                          <div className="mp-odds-row">
                            <span>{ouPick} {ouLine.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}</span>
                            <strong>{Number(mpBetOdds.ou).toFixed(2)}</strong>
                          </div>
                        )}
                        {combinedOdds != null && mpSelected.length >= 2 && (
                          <div className="mp-odds-row mp-odds-row--total">
                            <span>Combined odds</span>
                            <strong style={{ color: 'var(--accent)', fontSize: '1.15rem' }}>
                              {combinedOdds.toFixed(2)}
                            </strong>
                          </div>
                        )}
                        {mpSelected.length > 0 && (() => {
                          const bodies = [
                            winner && mpBetOdds.winner != null && {
                              body: { matchId: selectedMatch.id, betType: BET_TYPE.Winner, pick: WINNER_PICK_MAP[winner] },
                              odds: mpBetOdds.winner,
                              label: `Winner: ${winner}`,
                            },
                            btts && mpBetOdds.btts != null && {
                              body: { matchId: selectedMatch.id, betType: BET_TYPE.BTTS, btts: btts === 'true' },
                              odds: mpBetOdds.btts,
                              label: `BTTS: ${btts === 'true' ? 'Yes' : 'No'}`,
                            },
                            ouLine && ouPick && mpBetOdds.ou != null && {
                              body: { matchId: selectedMatch.id, betType: BET_TYPE.OverUnder, ouLine: OU_LINE_MAP[ouLine], ouPick: OU_PICK_MAP[ouPick] },
                              odds: mpBetOdds.ou,
                              label: `${ouPick} ${ouLine.replace('Line','').replace(/(\d)(\d)/,'$1.$2')}`,
                            },
                          ].filter(Boolean);
                          return (
                            <InlineBet
                              betBodies={bodies}
                              label={bodies.length === 1 ? bodies[0].label : `${bodies.length} markets`}
                            />
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <button className="primary-button" onClick={submitPrediction} disabled={loading} type="button">
                  {loading ? 'Saving...' : 'Create Prediction'}
                </button>
              </>
            )}

            {feedback && <div className="alert alert-info">{feedback}</div>}

            {aiPrediction && (
              <div ref={aiPredictionRef} className="ai-card">
                <h3>AI Prediction</h3>
                {aiPrediction.aiAnalysis && <p className="ai-analysis">{aiPrediction.aiAnalysis}</p>}
                <div className="ai-grid">
                  <div><span className="muted-text">Predicted Score</span>
                    <div className="ai-value">{aiPrediction.predictedHomeScore} – {aiPrediction.predictedAwayScore}</div></div>
                  <div><span className="muted-text">Pick</span><div className="ai-value">{aiPrediction.pick}</div></div>
                  <div><span className="muted-text">Confidence</span><div className="ai-value">{aiPrediction.confidence}%</div></div>
                  <div><span className="muted-text">Home Win</span><div className="ai-value">{aiPrediction.homeWinProbability}%</div></div>
                  <div><span className="muted-text">Draw</span><div className="ai-value">{aiPrediction.drawProbability}%</div></div>
                  <div><span className="muted-text">Away Win</span><div className="ai-value">{aiPrediction.awayWinProbability}%</div></div>
                </div>
              </div>
            )}

            {/* Simple 1/X/2 bet panel */}
            {hasBettingOdds && <BetPanel match={selectedMatch} />}
          </div>
        </section>
      )}
    </div>
  );
}
