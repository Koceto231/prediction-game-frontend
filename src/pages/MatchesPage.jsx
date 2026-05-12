import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import { useWallet } from '../context/WalletContext';

// ── Enums ────────────────────────────────────────────────────────
const BET_TYPE    = { Winner: 'Winner', ExactScore: 'ExactScore', BTTS: 'BTTS', OverUnder: 'OverUnder', Goalscorer: 'Goalscorer', Corners: 'Corners', YellowCards: 'YellowCards', DoubleChance: 'DoubleChance' };
const WINNER_MAP  = { Home: 'Home', Draw: 'Draw', Away: 'Away' };
const OU_LINE_MAP = { Line15: 'Line15', Line25: 'Line25', Line35: 'Line35' };
const OU_PICK_MAP = { Over: 'Over', Under: 'Under' };
const DC_OPTIONS  = [{ key: 'HomeOrDraw', label: '1X' }, { key: 'HomeOrAway', label: '12' }, { key: 'DrawOrAway', label: 'X2' }];
const CORNER_LINES = [8.5, 9.5, 10.5];
const YELLOW_LINES = [2.5, 3.5, 4.5];
const POS_ORDER   = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

const parseScore = v => { if (v === '' || v == null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; };
const EMPTY = { homeScore: '', awayScore: '', winner: '', btts: '', ouLine: '', ouPick: '' };

async function fetchOdds(matchId, betType, params = {}) {
  const qs = new URLSearchParams({ betType, ...params });
  try { const r = await api.get(`/Odds/${matchId}?${qs}`); return r.data ?? null; }
  catch { return null; }
}

// ── Shared stake + CTA ───────────────────────────────────────────
function BetSlipStake({ amount, setAmount, potential, onPlace, loading, disabled }) {
  const stakeNum = Number(amount);
  return (
    <div className="bet-slip" style={{ marginTop: 14 }}>
      <div className="bet-slip__stake-row">
        <div className="bet-slip__stake-wrap">
          <input type="text" inputMode="numeric" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
            className="bet-slip__stake-input"
            onKeyDown={e => e.key === 'Enter' && !disabled && onPlace()} />
          <span className="bet-slip__stake-coin">€</span>
        </div>
        <div className="bet-slip__quick-adds">
          {[5, 20, 50].map(n => (
            <button key={n} type="button" className="bet-slip__quick-add"
              onClick={() => setAmount(a => String((Number(a) || 0) + n))}>+{n}</button>
          ))}
        </div>
      </div>
      <button type="button" className="bet-slip__cta" disabled={disabled || stakeNum <= 0 || loading} onClick={onPlace}>
        <span>{loading ? 'Placing...' : `Place bet ${stakeNum > 0 ? stakeNum : ''} €`}</span>
        {potential != null && potential > 0 && (
          <span className="bet-slip__cta-sub">Potential win: {Number(potential).toFixed(2)} €</span>
        )}
      </button>
    </div>
  );
}

// ── Quick 1/X/2 ──────────────────────────────────────────────────
function QuickBetPanel({ match, onBetPlaced }) {
  const { refreshBalance } = useWallet();
  const [pick, setPick]       = useState('');
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { setPick(''); setAmount(''); setFeedback(null); }, [match?.id]);

  const oddsMap  = { Home: match.homeOdds, Draw: match.drawOdds, Away: match.awayOdds };
  const labelMap = { Home: match.homeTeamName, Draw: 'Draw', Away: match.awayTeamName };
  const selectedOdds = pick ? Number(oddsMap[pick]) : null;
  const stakeNum = Number(amount);
  const potential = selectedOdds && stakeNum > 0 ? selectedOdds * stakeNum : null;

  const place = async () => {
    if (!pick || stakeNum <= 0) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post('/Bet', { matchId: match.id, betType: 'Winner', pick, amount: stakeNum });
      await refreshBalance();
      setFeedback({ ok: true, text: 'Bet placed!' });
      setPick(''); setAmount('');
      // Fetch AI prediction and scroll to it
      onBetPlaced?.(match.id);
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || 'Failed.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="quick-bet-panel">
      <div className="quick-bet-panel__title">Quick Bet — 1 / X / 2</div>
      <div className="bet-picks">
        {[{ key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
          { key: 'Draw', label: 'Draw',             odds: match.drawOdds  },
          { key: 'Away', label: match.awayTeamName, odds: match.awayOdds  }
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
        <div className="bet-slip">
          <div className="bet-slip__header">
            <button className="bet-slip__remove" type="button"
              onClick={() => { setPick(''); setAmount(''); setFeedback(null); }}>✕</button>
            <div className="bet-slip__info">
              <span className="bet-slip__pick">{labelMap[pick]}</span>
              <span className="bet-slip__desc">Match Result · {match.homeTeamName} vs. {match.awayTeamName}</span>
            </div>
            <span className="bet-slip__odds">{selectedOdds?.toFixed(2)}</span>
          </div>
          <div className="bet-slip__stake-row">
            <div className="bet-slip__stake-wrap">
              <input type="text" inputMode="numeric" placeholder="0" value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                className="bet-slip__stake-input" onKeyDown={e => e.key === 'Enter' && place()} autoFocus />
              <span className="bet-slip__stake-coin">€</span>
            </div>
            <div className="bet-slip__quick-adds">
              {[5, 20, 50].map(n => (
                <button key={n} type="button" className="bet-slip__quick-add"
                  onClick={() => setAmount(a => String((Number(a) || 0) + n))}>+{n}</button>
              ))}
            </div>
          </div>
          <button type="button" className="bet-slip__cta" disabled={stakeNum <= 0 || loading} onClick={place}>
            <span>{loading ? 'Placing...' : `Place bet ${stakeNum > 0 ? stakeNum : ''} €`}</span>
            {potential && <span className="bet-slip__cta-sub">Potential win: {Number(potential).toFixed(2)} €</span>}
          </button>
        </div>
      )}
      {feedback && (
        <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function MatchesPage() {
  const { refreshBalance } = useWallet();

  const [matches, setMatches]             = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mode, setMode]                   = useState('');
  const [fields, setFields]               = useState(EMPTY);
  const [amount, setAmount]               = useState('');
  const [loading, setLoading]             = useState(false);
  const [feedback, setFeedback]           = useState(null);
  const [aiPrediction, setAiPrediction]   = useState(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiError, setAiError]             = useState(false);
  const [pageLoading, setPageLoading]     = useState(false);
  const [loadError, setLoadError]         = useState('');

  // Existing odds
  const [exactOdds, setExactOdds]               = useState(null);
  const [exactOddsLoading, setExactOddsLoading] = useState(false);
  const [mpOdds, setMpOdds]                     = useState({ winner: null, btts: null, ou: null, dc: null, corners: null, yellows: null });
  const [mpOddsLoading, setMpOddsLoading]       = useState(false);

  // New market pick fields
  const [dcPick, setDCPick]                   = useState('');
  const [cornersLine, setCornersLine]         = useState('');
  const [cornersOU, setCornersOU]             = useState('');
  const [yellowsLine, setYellowsLine]         = useState('');
  const [yellowsOU, setYellowsOU]             = useState('');
  const [scorerPlayer, setScorerPlayer]       = useState(null);  // { playerId, name, odds }
  const [scorerPlayers, setScorerPlayers]     = useState([]);
  const [scorerLoading, setScorerLoading]     = useState(false);
  const [scorerPosFilter, setScorerPosFilter] = useState('FWD');

  // Market table — pre-fetched odds + collapse state
  const [preOdds, setPreOdds]               = useState({});
  const [preOddsLoading, setPreOddsLoading] = useState(false);
  const [cornersPreOdds, setCornersPreOdds] = useState({});
  const [yellowsPreOdds, setYellowsPreOdds] = useState({});
  const INIT_COLLAPSED = { winner: false, dc: false, goals: false, btts: false, corners: true, yellows: true, scorer: true };
  const [collapsed, setCollapsed] = useState(INIT_COLLAPSED);
  const toggleSection = (k) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  const panelRef  = useRef(null);
  const aiRef     = useRef(null);
  const aiCache   = useRef({});   // matchId → AIPredictionResponseDTO
  const setField  = useCallback((k, v) => setFields(p => ({ ...p, [k]: v })), []);

  // Scroll to bet/AI panel whenever a match is selected
  useEffect(() => {
    if (!selectedMatch) return;
    // Small delay so React has time to render the panel before we scroll to it
    const t = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedMatch?.id]);

  // Load AI analysis when a match is selected — uses cache
  useEffect(() => {
    if (!selectedMatch) return;
    const cached = aiCache.current[selectedMatch.id];
    if (cached) { setAiPrediction(cached); setAiError(false); setAiLoading(false); return; }

    setAiPrediction(null);
    setAiError(false);
    setAiLoading(true);
    api.get(`/Prediction/analysis/${selectedMatch.id}`)
      .then(r => {
        if (r.data) {
          aiCache.current[selectedMatch.id] = r.data;
          setAiPrediction(r.data);
        } else {
          setAiError(true);
        }
      })
      .catch(() => setAiError(true))
      .finally(() => setAiLoading(false));
  }, [selectedMatch?.id]);

  // Called after any bet — updates cache, scrolls to AI card
  const fetchAndShowAI = useCallback(async (matchId) => {
    setAiLoading(true); setAiError(false);
    try {
      const r = await api.get(`/Prediction/analysis/${matchId}`);
      if (r.data) {
        aiCache.current[matchId] = r.data;
        setAiPrediction(r.data);
      } else {
        setAiError(true);
      }
    } catch { setAiError(true); }
    finally { setAiLoading(false); }
    setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }, []);

  useEffect(() => {
    setPageLoading(true);
    api.get('/Match/upcoming?take=20')
      .then(r => setMatches(r.data))
      .catch(e => setLoadError(e?.response?.data?.message || 'Failed to load matches.'))
      .finally(() => setPageLoading(false));
  }, []);

  const resetPanel = useCallback(() => {
    setMode(''); setFields(EMPTY); setAmount(''); setFeedback(null); setAiPrediction(null); setAiError(false);
    setExactOdds(null);
    setMpOdds({ winner: null, btts: null, ou: null, dc: null, corners: null, yellows: null });
    setDCPick(''); setCornersLine(''); setCornersOU(''); setYellowsLine(''); setYellowsOU('');
    setScorerPlayer(null); setScorerPlayers([]); setScorerPosFilter('FWD');
    setPreOdds({}); setCornersPreOdds({}); setYellowsPreOdds({});
    setCollapsed(INIT_COLLAPSED);
  }, []);

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;
  const home       = parseScore(homeScore);
  const away       = parseScore(awayScore);
  const hasScore   = home != null && away != null;
  const isExact    = mode === 'exact';
  const isMarket   = mode === 'market';
  const hasBetOdds = selectedMatch?.homeOdds != null;

  // Load players when scorer section is expanded
  useEffect(() => {
    if (collapsed.scorer || !isMarket || !selectedMatch) return;
    setScorerPlayers([]); setScorerLoading(true);
    api.get(`/Match/${selectedMatch.id}/players`)
      .then(r => setScorerPlayers(r.data ?? []))
      .catch(() => {})
      .finally(() => setScorerLoading(false));
  }, [collapsed.scorer, isMarket, selectedMatch?.id]);

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

  // Live odds — all markets from real Sportmonks data (no API calls)
  useEffect(() => {
    if (!isMarket) return;
    const winnerOdds = winner === 'Home' ? selectedMatch?.homeOdds
                     : winner === 'Draw' ? selectedMatch?.drawOdds
                     : winner === 'Away' ? selectedMatch?.awayOdds : null;
    const bttsOdds = btts === 'true'  ? (preOdds.btts?.['true']  ?? null)
                   : btts === 'false' ? (preOdds.btts?.['false'] ?? null) : null;
    const ouOdds   = (ouLine && ouPick) ? (preOdds.ou?.[ouLine]?.[ouPick] ?? null) : null;
    setMpOdds(prev => ({ ...prev, winner: winnerOdds, btts: bttsOdds, ou: ouOdds }));
  }, [isMarket, selectedMatch?.id, winner, btts, ouLine, ouPick, preOdds]);

  // Live odds — Double Chance
  useEffect(() => {
    if (!isMarket) { setMpOdds(p => ({ ...p, dc: null })); return; }
    const odds = dcPick ? (preOdds.dc?.[dcPick] ?? null) : null;
    setMpOdds(p => ({ ...p, dc: odds }));
  }, [isMarket, selectedMatch?.id, dcPick, preOdds]);

  // Live odds — Corners (from real Sportmonks data on match object)
  useEffect(() => {
    if (!isMarket || !cornersLine || !cornersOU) { setMpOdds(p => ({ ...p, corners: null })); return; }
    const odds = cornersPreOdds[cornersLine]?.[cornersOU] ?? null;
    setMpOdds(p => ({ ...p, corners: odds }));
  }, [isMarket, selectedMatch?.id, cornersLine, cornersOU, cornersPreOdds]);

  // Live odds — Yellow Cards (from real Sportmonks data on match object)
  useEffect(() => {
    if (!isMarket || !yellowsLine || !yellowsOU) { setMpOdds(p => ({ ...p, yellows: null })); return; }
    const odds = yellowsPreOdds[yellowsLine]?.[yellowsOU] ?? null;
    setMpOdds(p => ({ ...p, yellows: odds }));
  }, [isMarket, selectedMatch?.id, yellowsLine, yellowsOU, yellowsPreOdds]);

  // Build all market odds from real Sportmonks data on the match object — no API calls
  useEffect(() => {
    if (!selectedMatch) { setPreOdds({}); setCornersPreOdds({}); setYellowsPreOdds({}); return; }
    const m = selectedMatch;
    setPreOdds({
      dc: {
        HomeOrDraw: m.dcHomeOrDraw ?? null,
        DrawOrAway: m.dcDrawOrAway ?? null,
        HomeOrAway: m.dcHomeOrAway ?? null,
      },
      btts: {
        true:  m.bttsYes ?? null,
        false: m.bttsNo  ?? null,
      },
      ou: {
        Line15: { Over: m.over15 ?? null, Under: m.under15 ?? null },
        Line25: { Over: m.over25 ?? null, Under: m.under25 ?? null },
        Line35: { Over: m.over35 ?? null, Under: m.under35 ?? null },
      },
    });
    setCornersPreOdds({
      8.5:  { Over: m.cornersOver85  ?? null, Under: m.cornersUnder85  ?? null },
      9.5:  { Over: m.cornersOver95  ?? null, Under: m.cornersUnder95  ?? null },
      10.5: { Over: m.cornersOver105 ?? null, Under: m.cornersUnder105 ?? null },
    });
    setYellowsPreOdds({
      2.5: { Over: m.yellowOver25 ?? null, Under: m.yellowUnder25 ?? null },
      3.5: { Over: m.yellowOver35 ?? null, Under: m.yellowUnder35 ?? null },
      4.5: { Over: m.yellowOver45 ?? null, Under: m.yellowUnder45 ?? null },
    });
    setPreOddsLoading(false);
  }, [selectedMatch?.id]);

  // All selected odds (for combined slip)
  // Only include a market's odds if that market is actually chosen AND the odds value
  // is a valid positive number. Empty-string fields from EMPTY ('') would otherwise
  // survive the old `!= null && !== false` filter and turn into Number('')=0.
  const allSelectedOdds = [
    winner                       ? mpOdds.winner  : null,
    btts                         ? mpOdds.btts    : null,
    (ouLine && ouPick)           ? mpOdds.ou      : null,
    dcPick                       ? mpOdds.dc      : null,
    (cornersLine && cornersOU)   ? mpOdds.corners : null,
    (yellowsLine && yellowsOU)   ? mpOdds.yellows : null,
    scorerPlayer                 ? scorerPlayer.odds : null,
  ].filter(v => v != null && Number(v) > 0);

  const combinedOdds    = allSelectedOdds.length ? allSelectedOdds.reduce((a, o) => a * Number(o), 1) : null;
  const betAmt          = Number(amount);
  const exactPotential  = exactOdds && betAmt > 0 ? betAmt * Number(exactOdds.odds) : null;
  const marketPotential = combinedOdds && betAmt > 0 ? betAmt * combinedOdds : null;

  const anyMarketSelected = winner || btts || (ouLine && ouPick) || dcPick ||
    (cornersLine && cornersOU) || (yellowsLine && yellowsOU) || scorerPlayer;

  // Position list from loaded players
  const scorerPositions = [...new Set(scorerPlayers.map(p => p.position))]
    .sort((a, b) => (POS_ORDER[a] ?? 9) - (POS_ORDER[b] ?? 9));
  const scorerFiltered = scorerPlayers.filter(p => p.position === scorerPosFilter);

  // ── Place Bet ────────────────────────────────────────────────
  const placeBet = async () => {
    if (!selectedMatch || loading) return;
    setLoading(true); setFeedback(null); setAiPrediction(null);

    try {
      // Prediction (try, don't abort on failure)
      let ai = null;
      try {
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
        ai = predRes.data?.aiPredictionResponseDTO ?? null;
      } catch {
        try { const r = await api.get(`/Prediction/analysis/${selectedMatch.id}`); ai = r.data ?? null; }
        catch { /* AI unavailable */ }
      }
      if (ai) setAiPrediction(ai);

      let betPlaced = false;
      if (betAmt > 0 && hasBetOdds) {
        if (isExact && home !== null && away !== null) {
          await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.ExactScore, scoreHome: home, scoreAway: away, amount: betAmt });
          betPlaced = true;
        } else if (isMarket) {
          // Build legs array — one entry per selected market
          const legs = [];
          if (winner && mpOdds.winner != null)
            legs.push({ betType: BET_TYPE.Winner, pick: WINNER_MAP[winner] });
          if (dcPick && mpOdds.dc != null)
            legs.push({ betType: BET_TYPE.DoubleChance, dCPick: dcPick });
          if (btts && mpOdds.btts != null)
            legs.push({ betType: BET_TYPE.BTTS, bTTSPick: btts === 'true' });
          if (ouLine && ouPick && mpOdds.ou != null)
            legs.push({ betType: BET_TYPE.OverUnder, oULine: OU_LINE_MAP[ouLine], oUPick: OU_PICK_MAP[ouPick] });
          if (cornersLine && cornersOU && mpOdds.corners != null)
            legs.push({ betType: BET_TYPE.Corners, lineValue: Number(cornersLine), oUPick: cornersOU });
          if (yellowsLine && yellowsOU && mpOdds.yellows != null)
            legs.push({ betType: BET_TYPE.YellowCards, lineValue: Number(yellowsLine), oUPick: yellowsOU });
          if (scorerPlayer)
            legs.push({ betType: BET_TYPE.Goalscorer, goalscorerId: scorerPlayer.playerId });

          if (legs.length === 1) {
            // Single market — use normal endpoint
            const leg = legs[0];
            await api.post('/Bet', { matchId: selectedMatch.id, ...leg, amount: betAmt });
            betPlaced = true;
          } else if (legs.length > 1) {
            // Multi-market — accumulator endpoint
            await api.post('/Bet/accumulator', { matchId: selectedMatch.id, legs, amount: betAmt });
            betPlaced = true;
          }
        }
        if (betPlaced) await refreshBalance();
      }

      setFeedback({ type: 'ok', msg: betPlaced ? '✅ Bet placed!' : '✅ Prediction saved!' });
      // Always scroll to AI section after submit (ref exists regardless of aiPrediction)
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (err) {
      setFeedback({ type: 'err', msg: err?.response?.data?.message || 'Failed to place bet.' });
    } finally { setLoading(false); }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page-grid">

      {/* Match list */}
      <section className="shell-card panel">
        <div className="section-head">
          <div><h2>Upcoming Matches</h2><p>Select a match to place your bet.</p></div>
        </div>
        {loadError && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}
        {!pageLoading && !matches.length && !loadError && <div className="empty-box">No upcoming matches found.</div>}
        <div className="cards-grid">
          {matches.length > 0 && (
            <div className="matches-table-head">
              <span>TIME</span>
              <span>FIXTURE</span>
              <span style={{ textAlign: 'center' }}>1</span>
              <span style={{ textAlign: 'center' }}>X</span>
              <span style={{ textAlign: 'center' }}>2</span>
            </div>
          )}
          {matches.map(match => (
            <MatchCard key={match.id} match={match} selected={selectedMatch?.id === match.id}
              onSelect={() => {
                if (selectedMatch?.id === match.id) { setSelectedMatch(null); resetPanel(); }
                else { setSelectedMatch(match); resetPanel(); }
              }} />
          ))}
        </div>
      </section>

      {/* Bet + prediction panel */}
      {selectedMatch && (
        <section className="shell-card panel" ref={panelRef} style={{ scrollMarginTop: 64 }}>

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

          {/* AI card — loading / ready / error */}
          <div ref={aiRef} style={{ scrollMarginTop: 80 }}>
            <div className="ai-card" style={{ marginTop: 16, marginBottom: 24 }}>
              <h3>🤖 AI Prediction</h3>
              {aiLoading && (
                <p className="ai-analysis" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Analysing match...</p>
              )}
              {!aiLoading && aiPrediction?.aiAnalysis && (
                <p className="ai-analysis">{aiPrediction.aiAnalysis}</p>
              )}
              {!aiLoading && !aiPrediction?.aiAnalysis && !aiError && (
                <p className="ai-analysis" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No analysis available for this match.</p>
              )}
              {!aiLoading && aiError && (
                <p className="ai-analysis" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Could not load analysis.</p>
              )}
            </div>
          </div>

          {/* Mode selector */}
          {!mode && (
            <div className="premium-mode-grid">
              <button type="button" className="premium-mode-card premium-mode-card--exact" onClick={() => setMode('exact')}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">🎯</span>
                  <span className="premium-mode-card__points">5 pts</span>
                </div>
                <div className="premium-mode-card__title">Exact Score</div>
                <div className="premium-mode-card__text">Predict the final score and earn maximum points.</div>
              </button>
              <button type="button" className="premium-mode-card premium-mode-card--market" onClick={() => setMode('market')}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">📈</span>
                  <span className="premium-mode-card__points">up to 3 pts</span>
                </div>
                <div className="premium-mode-card__title">Market Pick</div>
                <div className="premium-mode-card__text">Combine any markets — winner, BTTS, corners, goalscorer and more.</div>
              </button>
            </div>
          )}

          <div className="prediction-form">

            {/* ── Exact Score ── */}
            {isExact && (
              <>
                <div className="mode-card mode-card--exact">
                  <div className="mode-card__top"><span className="mode-badge">EXACT SCORE — 5 PTS</span></div>
                  <div className="mode-card__title">Predict the exact final score</div>
                  <button type="button" className="mode-card__button" onClick={() => { setMode(''); setFields(EMPTY); }}>Change type</button>
                </div>
                <div className="scoreboard-card">
                  <div className="scoreboard-card__head"><span className="scoreboard-card__eyebrow">Enter predicted result</span></div>
                  <div className="scoreboard">
                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.homeTeamName}</div>
                      <div className="scorebox"><input type="number" min="0" max="20" placeholder="0" value={homeScore} onChange={e => setField('homeScore', e.target.value)} /></div>
                    </div>
                    <div className="scoreboard__separator">:</div>
                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.awayTeamName}</div>
                      <div className="scorebox"><input type="number" min="0" max="20" placeholder="0" value={awayScore} onChange={e => setField('awayScore', e.target.value)} /></div>
                    </div>
                  </div>
                </div>
                {hasBetOdds && hasScore && (
                  <div className="inline-bet-wrapper">
                    {exactOddsLoading && <div className="muted-text" style={{ textAlign: 'center' }}>Calculating odds...</div>}
                    {exactOdds && !exactOddsLoading && (
                      <>
                        <div className="mp-odds-row">
                          <span>Odds for {homeScore}–{awayScore}</span>
                          <strong style={{ color: 'var(--amber)', fontSize: '1.1rem' }}>{Number(exactOdds.odds).toFixed(2)}</strong>
                        </div>
                        <BetSlipStake amount={amount} setAmount={setAmount} potential={exactPotential} onPlace={placeBet} loading={loading} disabled={!hasScore} />
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Market Pick ── */}
            {isMarket && (
              <>
                <div className="mode-card mode-card--market">
                  <div className="mode-card__top"><span className="mode-badge">MARKET PICK — UP TO 3 PTS</span></div>
                  <div className="mode-card__title">Pick any combination of markets</div>
                  <button type="button" className="mode-card__button" onClick={() => { setMode(''); setFields(EMPTY); setDCPick(''); setCornersLine(''); setCornersOU(''); setYellowsLine(''); setYellowsOU(''); setScorerPlayer(null); setShowScorer(false); }}>Change type</button>
                </div>

                <div className="market-table">

                  {/* Match Result */}
                  <div className={`market-section ${collapsed.winner ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('winner')}>
                      <span className="market-section__name">Match Result</span>
                      {dcPick && <span className="market-section__lock">🔒 Double Chance active</span>}
                      <span className="market-section__toggle">{collapsed.winner ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.winner && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName, odds: selectedMatch.homeOdds },
                          { key: 'Draw', label: 'Draw',                    odds: selectedMatch.drawOdds  },
                          { key: 'Away', label: selectedMatch.awayTeamName, odds: selectedMatch.awayOdds  },
                        ].map(({ key, label, odds }) => (
                          <button key={key} type="button"
                            className={`market-option ${winner === key ? 'market-option--active' : ''} ${dcPick ? 'market-option--disabled' : ''}`}
                            disabled={!!dcPick}
                            onClick={() => setField('winner', winner === key ? '' : key)}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{odds != null ? Number(odds).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Double Chance */}
                  <div className={`market-section ${collapsed.dc ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('dc')}>
                      <span className="market-section__name">Double Chance</span>
                      {winner && <span className="market-section__lock">🔒 Match Result active</span>}
                      <span className="market-section__toggle">{collapsed.dc ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.dc && (
                      <div className="market-options market-options--3">
                        {DC_OPTIONS.map(({ key, label }) => {
                          const lbl = key === 'HomeOrDraw' ? `${selectedMatch.homeTeamName} or Draw`
                                    : key === 'DrawOrAway' ? `Draw or ${selectedMatch.awayTeamName}`
                                    : `${selectedMatch.homeTeamName} or ${selectedMatch.awayTeamName}`;
                          return (
                            <button key={key} type="button"
                              className={`market-option ${dcPick === key ? 'market-option--active' : ''} ${winner ? 'market-option--disabled' : ''}`}
                              disabled={!!winner}
                              onClick={() => setDCPick(dcPick === key ? '' : key)}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">
                                {preOdds.dc?.[key] != null ? Number(preOdds.dc[key]).toFixed(2) : preOddsLoading ? '…' : '—'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Goals O/U */}
                  <div className={`market-section ${collapsed.goals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('goals')}>
                      <span className="market-section__name">Goals — Over / Under</span>
                      {ouLine && ouPick && <span className="market-section__badge">{ouPick} {ouLine.replace('Line','').replace(/(\d)(\d)/,'$1.$2')}</span>}
                      <span className="market-section__toggle">{collapsed.goals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.goals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {[{ line: 'Line15', label: '1.5' }, { line: 'Line25', label: '2.5' }, { line: 'Line35', label: '3.5' }].map(({ line, label }) => (
                          <div key={line} className="ou-table__row">
                            <span className="ou-table__line">{label}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouLine === line && ouPick === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (ouLine === line && ouPick === pick) { setField('ouLine',''); setField('ouPick',''); }
                                  else { setField('ouLine', line); setField('ouPick', pick); }
                                }}>
                                {preOdds.ou?.[line]?.[pick] != null ? Number(preOdds.ou[line][pick]).toFixed(2) : preOddsLoading ? '…' : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BTTS */}
                  <div className={`market-section ${collapsed.btts ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts')}>
                      <span className="market-section__name">Both Teams to Score</span>
                      {btts && <span className="market-section__badge">{btts === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts === val ? 'market-option--active' : ''}`}
                            onClick={() => setField('btts', btts === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {preOdds.btts?.[val] != null ? Number(preOdds.btts[val]).toFixed(2) : preOddsLoading ? '…' : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Corners */}
                  <div className={`market-section ${collapsed.corners ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('corners')}>
                      <span className="market-section__name">🚩 Corners — Over / Under</span>
                      {cornersLine && cornersOU && <span className="market-section__badge">{cornersOU} {cornersLine}</span>}
                      <span className="market-section__toggle">{collapsed.corners ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.corners && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {CORNER_LINES.map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${cornersLine === String(l) && cornersOU === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (cornersLine === String(l) && cornersOU === pick) { setCornersLine(''); setCornersOU(''); }
                                  else { setCornersLine(String(l)); setCornersOU(pick); }
                                }}>
                                {cornersPreOdds[l]?.[pick] != null ? Number(cornersPreOdds[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Yellow Cards */}
                  <div className={`market-section ${collapsed.yellows ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('yellows')}>
                      <span className="market-section__name">🟨 Yellow Cards — Over / Under</span>
                      {yellowsLine && yellowsOU && <span className="market-section__badge">{yellowsOU} {yellowsLine}</span>}
                      <span className="market-section__toggle">{collapsed.yellows ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.yellows && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {YELLOW_LINES.map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${yellowsLine === String(l) && yellowsOU === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (yellowsLine === String(l) && yellowsOU === pick) { setYellowsLine(''); setYellowsOU(''); }
                                  else { setYellowsLine(String(l)); setYellowsOU(pick); }
                                }}>
                                {yellowsPreOdds[l]?.[pick] != null ? Number(yellowsPreOdds[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Goalscorer */}
                  <div className={`market-section ${collapsed.scorer ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('scorer')}>
                      <span className="market-section__name">⚽ Goalscorer</span>
                      {scorerPlayer && <span className="market-section__badge">{scorerPlayer.name} · {Number(scorerPlayer.odds).toFixed(2)}</span>}
                      <span className="market-section__toggle">{collapsed.scorer ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.scorer && (
                      <div style={{ padding: '12px 16px' }}>
                        {scorerPlayer ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.88rem' }}>{scorerPlayer.name} to score</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{Number(scorerPlayer.odds).toFixed(2)}</span>
                            <button type="button" onClick={() => setScorerPlayer(null)}
                              style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 8px', cursor: 'pointer', borderRadius: 3 }}>
                              Clear
                            </button>
                          </div>
                        ) : (
                          <>
                            {scorerLoading && <div className="muted-text" style={{ fontSize: '0.82rem' }}>Loading players...</div>}
                            {!scorerLoading && scorerPlayers.length === 0 && (
                              <div className="muted-text" style={{ fontSize: '0.78rem' }}>No players found — sync via Admin → Sync Players.</div>
                            )}
                            {!scorerLoading && scorerPlayers.length > 0 && (
                              <>
                                <div className="pos-tabs">
                                  {scorerPositions.map(pos => (
                                    <button key={pos} type="button"
                                      className={`pos-tab ${scorerPosFilter === pos ? 'pos-tab--active' : ''}`}
                                      onClick={() => setScorerPosFilter(pos)}>{pos}</button>
                                  ))}
                                </div>
                                <div className="player-grid">
                                  {scorerFiltered.map(p => (
                                    <button key={p.playerId} type="button" className="player-card"
                                      onClick={() => setScorerPlayer({ playerId: p.playerId, name: p.name, odds: p.odds })}>
                                      <span className="player-card__team">{p.isHome ? selectedMatch.homeTeamName : selectedMatch.awayTeamName}</span>
                                      <span className="player-card__name">{p.name}</span>
                                      <span className="player-card__odds">{Number(p.odds).toFixed(2)}</span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                </div>{/* end market-table */}

                {/* Combined slip */}
                {hasBetOdds && anyMarketSelected && (
                  <div className="inline-bet-wrapper">
                    {mpOddsLoading && <div className="muted-text">Calculating odds...</div>}
                    {!mpOddsLoading && (
                      <div className="bet-slip">
                        <div className="bet-slip__header">
                          <div className="bet-slip__info">
                            <span className="bet-slip__pick">Market Pick</span>
                            <div className="bet-slip__legs">
                              {winner && mpOdds.winner != null && (
                                <span className="bet-slip__leg">
                                  {winner === 'Home' ? selectedMatch.homeTeamName : winner === 'Away' ? selectedMatch.awayTeamName : 'Draw'}
                                  <em>{Number(mpOdds.winner).toFixed(2)}</em>
                                </span>
                              )}
                              {dcPick && mpOdds.dc != null && (
                                <span className="bet-slip__leg">
                                  {DC_OPTIONS.find(d => d.key === dcPick)?.label} Double Chance
                                  <em>{Number(mpOdds.dc).toFixed(2)}</em>
                                </span>
                              )}
                              {btts && mpOdds.btts != null && (
                                <span className="bet-slip__leg">
                                  BTTS {btts === 'true' ? 'Yes' : 'No'}
                                  <em>{Number(mpOdds.btts).toFixed(2)}</em>
                                </span>
                              )}
                              {ouLine && ouPick && mpOdds.ou != null && (
                                <span className="bet-slip__leg">
                                  Goals {ouPick} {ouLine.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                                  <em>{Number(mpOdds.ou).toFixed(2)}</em>
                                </span>
                              )}
                              {cornersLine && cornersOU && mpOdds.corners != null && (
                                <span className="bet-slip__leg">
                                  Corners {cornersOU} {cornersLine}
                                  <em>{Number(mpOdds.corners).toFixed(2)}</em>
                                </span>
                              )}
                              {yellowsLine && yellowsOU && mpOdds.yellows != null && (
                                <span className="bet-slip__leg">
                                  Yellow Cards {yellowsOU} {yellowsLine}
                                  <em>{Number(mpOdds.yellows).toFixed(2)}</em>
                                </span>
                              )}
                              {scorerPlayer && (
                                <span className="bet-slip__leg">
                                  {scorerPlayer.name} to score
                                  <em>{Number(scorerPlayer.odds).toFixed(2)}</em>
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="bet-slip__odds" style={{ color: 'var(--amber)' }}>
                            {combinedOdds != null ? combinedOdds.toFixed(2) : '—'}
                          </span>
                        </div>

                        <div className="bet-slip__stake-row">
                          <div className="bet-slip__stake-wrap">
                            <input type="text" inputMode="numeric" placeholder="0" value={amount}
                              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAmount(v); }}
                              className="bet-slip__stake-input"
                              onKeyDown={e => e.key === 'Enter' && placeBet()} />
                            <span className="bet-slip__stake-coin">€</span>
                          </div>
                          <div className="bet-slip__quick-adds">
                            {[5, 20, 50].map(n => (
                              <button key={n} type="button" className="bet-slip__quick-add"
                                onClick={() => setAmount(a => String((Number(a) || 0) + n))}>+{n}</button>
                            ))}
                          </div>
                        </div>

                        <button type="button" className="bet-slip__cta" disabled={betAmt <= 0 || loading} onClick={placeBet}>
                          <span>{loading ? 'Placing...' : `Place bet ${betAmt > 0 ? betAmt : ''} €`}</span>
                          {marketPotential != null && marketPotential > 0 && (
                            <span className="bet-slip__cta-sub">Potential win: {Number(marketPotential).toFixed(2)} €</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {feedback && (
              <div className={`alert ${feedback.type === 'ok' ? 'alert-info' : 'alert-error'}`} style={{ marginTop: 12 }}>
                {feedback.msg}
              </div>
            )}
          </div>

          {/* Quick 1X2 */}
          {hasBetOdds && !mode && (
            <>
              <div className="quick-bet-divider"><span>or place a quick bet</span></div>
              <QuickBetPanel match={selectedMatch} onBetPlaced={fetchAndShowAI} />
            </>
          )}

        </section>
      )}
    </div>
  );
}
