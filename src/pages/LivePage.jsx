import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

// ── Quick 1/X/2 bet panel (reused from MatchesPage) ─────────────
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
      setFeedback({ ok: true, text: '✅ Bet placed!' });
      setPick(''); setAmount('');
      onBetPlaced?.();
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

// ── Enums ────────────────────────────────────────────────────────
const BET_TYPE    = { Winner: 'Winner', ExactScore: 'ExactScore', BTTS: 'BTTS', OverUnder: 'OverUnder', Goalscorer: 'Goalscorer', Corners: 'Corners', YellowCards: 'YellowCards', DoubleChance: 'DoubleChance', OddEven: 'OddEven', DrawNoBet: 'DrawNoBet', Handicap: 'Handicap', WinToNil: 'WinToNil', TeamGoals: 'TeamGoals', HalfTime: 'HalfTime', CleanSheet: 'CleanSheet', FirstGoal: 'FirstGoal', Btts1stHalf: 'Btts1stHalf', Btts2ndHalf: 'Btts2ndHalf', HalfTimeGoals: 'HalfTimeGoals', SecondHalfGoals: 'SecondHalfGoals', TeamOddEven: 'TeamOddEven', OddEven1stHalf: 'OddEven1stHalf', TeamToScore: 'TeamToScore', WinBothHalves: 'WinBothHalves', LastToScore: 'LastToScore', HtFt: 'HtFt' };
const WINNER_MAP  = { Home: 'Home', Draw: 'Draw', Away: 'Away' };
const OU_LINE_MAP = { Line05: 'Line05', Line15: 'Line15', Line25: 'Line25', Line35: 'Line35' };
const lineToKey   = l => `Line${String(l).replace('.', '')}`;
const OU_PICK_MAP = { Over: 'Over', Under: 'Under' };
const DC_OPTIONS  = [{ key: 'HomeOrDraw', label: '1X' }, { key: 'HomeOrAway', label: '12' }, { key: 'DrawOrAway', label: 'X2' }];
const CORNER_LINES  = [8.5, 9.5, 10.5];
const YELLOW_LINES  = [2.5, 3.5, 4.5];
const TEAM_GOAL_LINES = [0.5, 1.5, 2.5];
const POS_ORDER   = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

const parseScore = v => { if (v === '' || v == null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; };
const EMPTY = { homeScore: '', awayScore: '', winner: '', btts: '', ouLine: '', ouPick: '' };

async function fetchOdds(matchId, betType, params = {}) {
  const qs = new URLSearchParams({ betType, ...params });
  try { const r = await api.get(`/Odds/${matchId}?${qs}`); return r.data ?? null; }
  catch { return null; }
}

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

export default function LivePage() {
  const { refreshBalance } = useWallet();

  const [liveMatches, setLiveMatches]     = useState([]);
  const [loadingLive, setLoadingLive]     = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mode, setMode]                   = useState('');
  const [fields, setFields]               = useState(EMPTY);
  const [amount, setAmount]               = useState('');
  const [loading, setLoading]             = useState(false);
  const [feedback, setFeedback]           = useState(null);

  // Odds state
  const [exactOdds, setExactOdds]               = useState(null);
  const [exactOddsLoading, setExactOddsLoading] = useState(false);
  const [mpOdds, setMpOdds]                     = useState({ winner: null, btts: null, ou: null, dc: null, corners: null, yellows: null, oddEven: null, dnb: null, wtn: null, hcp: null, homeGoals: null, awayGoals: null, ht: null, cs: null, fg: null, btts1h: null, btts2h: null, htGoals: null, shGoals: null, homeOE: null, awayOE: null, oe1h: null, homeTs: null, awayTs: null, wbhHome: null, wbhAway: null, lastScore: null, htft: null });

  const [dcPick, setDCPick]                   = useState('');
  const [cornersLine, setCornersLine]         = useState('');
  const [cornersOU, setCornersOU]             = useState('');
  const [yellowsLine, setYellowsLine]         = useState('');
  const [yellowsOU, setYellowsOU]             = useState('');
  const [scorerPlayer, setScorerPlayer]       = useState(null);
  const [scorerPlayers, setScorerPlayers]     = useState([]);
  const [scorerLoading, setScorerLoading]     = useState(false);
  const [scorerPosFilter, setScorerPosFilter] = useState('FWD');

  const [oddEvenPick, setOddEvenPick]   = useState('');
  const [dnbPick, setDnbPick]           = useState('');
  const [wtnTeam, setWtnTeam]           = useState('');
  const [wtnYN, setWtnYN]               = useState('');
  const [hcpPick, setHcpPick]           = useState('');
  const [hGoalsLine, setHGoalsLine]     = useState('');
  const [hGoalsOU, setHGoalsOU]         = useState('');
  const [aGoalsLine, setAGoalsLine]     = useState('');
  const [aGoalsOU, setAGoalsOU]         = useState('');
  const [htPick, setHtPick]             = useState('');
  const [csPick, setCsPick]             = useState('');
  const [csYN, setCsYN]                 = useState('');
  const [fgPick, setFgPick]             = useState('');
  const [btts1hPick, setBtts1hPick]     = useState('');
  const [btts2hPick, setBtts2hPick]     = useState('');
  const [htGoalsLine, setHtGoalsLine]   = useState('');
  const [htGoalsOU, setHtGoalsOU]       = useState('');
  const [shGoalsLine, setShGoalsLine]   = useState('');
  const [shGoalsOU, setShGoalsOU]       = useState('');
  const [homeOEPick, setHomeOEPick]     = useState('');
  const [awayOEPick, setAwayOEPick]     = useState('');
  const [oe1hPick, setOe1hPick]         = useState('');
  const [homeTsPick, setHomeTsPick]     = useState('');
  const [awayTsPick, setAwayTsPick]     = useState('');
  const [wbhHomePick, setWbhHomePick]   = useState('');
  const [wbhAwayPick, setWbhAwayPick]   = useState('');
  const [lastScorePick, setLastScorePick] = useState('');
  const [htftPick, setHtftPick]         = useState('');

  const [preOdds, setPreOdds]               = useState({});
  const [cornersPreOdds, setCornersPreOdds] = useState({});
  const [yellowsPreOdds, setYellowsPreOdds] = useState({});
  const INIT_COLLAPSED = { winner: false, dc: false, goals: false, btts: false, corners: true, yellows: true, scorer: true, oddEven: true, dnb: true, wtn: true, hcp: true, homeGoals: true, awayGoals: true, ht: true, cs: true, fg: true, btts1h: true, btts2h: true, htGoals: true, shGoals: true, teamOE: true, oe1h: true, teamTs: true, wbh: true, lastScore: true, htft: true };
  const [collapsed, setCollapsed] = useState(INIT_COLLAPSED);
  const toggleSection = k => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  const panelRef = useRef(null);
  const setField = useCallback((k, v) => setFields(p => ({ ...p, [k]: v })), []);

  // Wall-clock estimate — used only when Sportmonks gives us a phase (1H/2H)
  // but no clock.minute. Slightly conservative (small buffer) so we never
  // show a minute AHEAD of the real game state — being a minute behind is
  // always safer for betting decisions than being ahead.
  const estimateMinute = (matchDate) => {
    const kickoff = new Date(matchDate);
    const elapsed = Math.floor((Date.now() - kickoff.getTime()) / 60000);
    if (elapsed <= 0)  return null;
    if (elapsed <= 45) return Math.max(1, elapsed - 2);       // 1H: -2 buffer
    if (elapsed <= 60) return 45;                             // HT zone fallback
    return Math.min(85, elapsed - 20);                        // 2H: -15 HT - 5 buffer
  };
  // Display priority:
  //   1. Sportmonks says HT          → "HT"
  //   2. Sportmonks gives real clock → "67'"
  //   3. Sportmonks knows phase only → "~67'"
  //   4. Nothing                     → "LIVE"
  const displayMinute = (m) => {
    if (m.liveState === 'HT' || m.liveState === 'BREAK') return 'HT';
    if (m.liveState === 'FT' || m.liveState === 'AET')   return 'FT';
    if (m.liveMinute != null) return `${m.liveMinute}'`;
    const est = estimateMinute(m.matchDate);
    return est != null ? `~${est}'` : 'LIVE';
  };

  // ── Fetch live matches every 5 s — DB query is cheap; backend syncs every 15 s ───
  useEffect(() => {
    const fetchLive = () => {
      api.get('/Match/live')
        .then(r => { setLiveMatches(r.data ?? []); setLoadingLive(false); })
        .catch(() => setLoadingLive(false));
    };
    fetchLive();
    const id = setInterval(fetchLive, 5_000);
    return () => clearInterval(id);
  }, []);

  // Keep selectedMatch in sync with refreshed live data
  useEffect(() => {
    if (!selectedMatch) return;
    const updated = liveMatches.find(m => m.id === selectedMatch.id);
    if (updated) setSelectedMatch(updated);
    else { setSelectedMatch(null); resetPanel(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMatches]);

  // Scroll to panel on selection
  useEffect(() => {
    if (!selectedMatch) return;
    const t = setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [selectedMatch?.id]);

  // Load players when scorer expanded
  useEffect(() => {
    if (collapsed.scorer || mode !== 'market' || !selectedMatch) return;
    setScorerPlayers([]); setScorerLoading(true);
    api.get(`/Match/${selectedMatch.id}/players`)
      .then(r => setScorerPlayers(r.data ?? []))
      .catch(() => {})
      .finally(() => setScorerLoading(false));
  }, [collapsed.scorer, mode, selectedMatch?.id]);

  const resetPanel = useCallback(() => {
    setMode(''); setFields(EMPTY); setAmount(''); setFeedback(null);
    setExactOdds(null);
    setMpOdds({ winner: null, btts: null, ou: null, dc: null, corners: null, yellows: null, oddEven: null, dnb: null, wtn: null, hcp: null, homeGoals: null, awayGoals: null, ht: null, cs: null, fg: null, btts1h: null, btts2h: null, htGoals: null, shGoals: null, homeOE: null, awayOE: null, oe1h: null, homeTs: null, awayTs: null, wbhHome: null, wbhAway: null, lastScore: null, htft: null });
    setDCPick(''); setCornersLine(''); setCornersOU(''); setYellowsLine(''); setYellowsOU('');
    setScorerPlayer(null); setScorerPlayers([]); setScorerPosFilter('FWD');
    setOddEvenPick(''); setDnbPick(''); setWtnTeam(''); setWtnYN(''); setHcpPick('');
    setHGoalsLine(''); setHGoalsOU(''); setAGoalsLine(''); setAGoalsOU('');
    setHtPick(''); setCsPick(''); setCsYN(''); setFgPick('');
    setBtts1hPick(''); setBtts2hPick('');
    setHtGoalsLine(''); setHtGoalsOU(''); setShGoalsLine(''); setShGoalsOU('');
    setHomeOEPick(''); setAwayOEPick(''); setOe1hPick('');
    setHomeTsPick(''); setAwayTsPick('');
    setWbhHomePick(''); setWbhAwayPick('');
    setLastScorePick(''); setHtftPick('');
    setPreOdds({}); setCornersPreOdds({}); setYellowsPreOdds({});
    setCollapsed(INIT_COLLAPSED);
  }, []);

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;
  const home     = parseScore(homeScore);
  const away     = parseScore(awayScore);
  const hasScore = home != null && away != null;
  const isExact  = mode === 'exact';
  const isMarket = mode === 'market';
  const hasBetOdds = selectedMatch?.homeOdds != null;

  // Exact score odds
  useEffect(() => {
    if (!isExact || !hasBetOdds || home === null || away === null) { setExactOdds(null); return; }
    let cancelled = false;
    setExactOddsLoading(true);
    fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: home, scoreAway: away })
      .then(r => { if (!cancelled) setExactOdds(r); })
      .finally(() => { if (!cancelled) setExactOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isExact, selectedMatch?.id, home, away, hasBetOdds]);

  // Build preOdds from match object
  useEffect(() => {
    if (!selectedMatch) { setPreOdds({}); setCornersPreOdds({}); setYellowsPreOdds({}); return; }
    const m = selectedMatch;
    setPreOdds({
      dc: { HomeOrDraw: m.dcHomeOrDraw ?? null, DrawOrAway: m.dcDrawOrAway ?? null, HomeOrAway: m.dcHomeOrAway ?? null },
      btts: { true: m.bttsYes ?? null, false: m.bttsNo ?? null },
      ou: {
        Line15: { Over: m.over15 ?? null, Under: m.under15 ?? null },
        Line25: { Over: m.over25 ?? null, Under: m.under25 ?? null },
        Line35: { Over: m.over35 ?? null, Under: m.under35 ?? null },
      },
      oddEven: { true: m.oddGoals ?? null, false: m.evenGoals ?? null },
      dnb: { Home: m.dnbHome ?? null, Away: m.dnbAway ?? null },
      wtn: {
        Home: { true: m.wtnHomeYes ?? null, false: m.wtnHomeNo ?? null },
        Away: { true: m.wtnAwayYes ?? null, false: m.wtnAwayNo ?? null },
      },
      hcp: { Home: m.hcpHomeOdds ?? null, Draw: m.hcpDrawOdds ?? null, Away: m.hcpAwayOdds ?? null, line: m.hcpLine ?? null },
      homeGoals: {
        0.5: { Over: m.homeGoalsOver05 ?? null, Under: m.homeGoalsUnder05 ?? null },
        1.5: { Over: m.homeGoalsOver15 ?? null, Under: m.homeGoalsUnder15 ?? null },
        2.5: { Over: m.homeGoalsOver25 ?? null, Under: m.homeGoalsUnder25 ?? null },
      },
      awayGoals: {
        0.5: { Over: m.awayGoalsOver05 ?? null, Under: m.awayGoalsUnder05 ?? null },
        1.5: { Over: m.awayGoalsOver15 ?? null, Under: m.awayGoalsUnder15 ?? null },
        2.5: { Over: m.awayGoalsOver25 ?? null, Under: m.awayGoalsUnder25 ?? null },
      },
      ht: { Home: m.htHomeOdds ?? null, Draw: m.htDrawOdds ?? null, Away: m.htAwayOdds ?? null },
      cs: {
        Home: { true: m.csHomeYes ?? null, false: m.csHomeNo ?? null },
        Away: { true: m.csAwayYes ?? null, false: m.csAwayNo ?? null },
      },
      fg: { Home: m.fgHome ?? null, Draw: m.fgNone ?? null, Away: m.fgAway ?? null },
      btts1h:    { true: m.btts1HYes ?? null, false: m.btts1HNo ?? null },
      btts2h:    { true: m.btts2HYes ?? null, false: m.btts2HNo ?? null },
      htGoals: {
        '0.5': { Over: m.htGoalsOver05 ?? null, Under: m.htGoalsUnder05 ?? null },
        '1.5': { Over: m.htGoalsOver15 ?? null, Under: m.htGoalsUnder15 ?? null },
        '2.5': { Over: m.htGoalsOver25 ?? null, Under: m.htGoalsUnder25 ?? null },
      },
      shGoals: {
        '0.5': { Over: m.shGoalsOver05 ?? null, Under: m.shGoalsUnder05 ?? null },
        '1.5': { Over: m.shGoalsOver15 ?? null, Under: m.shGoalsUnder15 ?? null },
        '2.5': { Over: m.shGoalsOver25 ?? null, Under: m.shGoalsUnder25 ?? null },
      },
      homeOE:    { true: m.homeOddGoals ?? null, false: m.homeEvenGoals ?? null },
      awayOE:    { true: m.awayOddGoals ?? null, false: m.awayEvenGoals ?? null },
      oe1h:      { true: m.oddGoals1H   ?? null, false: m.evenGoals1H   ?? null },
      homeTs:    { true: m.homeToScoreYes ?? null, false: m.homeToScoreNo ?? null },
      awayTs:    { true: m.awayToScoreYes ?? null, false: m.awayToScoreNo ?? null },
      wbh: {
        Home: { true: m.winBothHomeYes ?? null, false: m.winBothHomeNo ?? null },
        Away: { true: m.winBothAwayYes ?? null, false: m.winBothAwayNo ?? null },
      },
      lastScore: { Home: m.lastTeamHome ?? null, Draw: m.lastTeamNone ?? null, Away: m.lastTeamAway ?? null },
      htft: (() => { try { return m.htFtOddsJson ? JSON.parse(m.htFtOddsJson) : {}; } catch { return {}; } })(),
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
  }, [selectedMatch?.id]);

  // mpOdds derivation
  useEffect(() => {
    if (!isMarket) return;
    const winnerOdds = winner === 'Home' ? selectedMatch?.homeOdds : winner === 'Draw' ? selectedMatch?.drawOdds : winner === 'Away' ? selectedMatch?.awayOdds : null;
    const bttsOdds   = btts === 'true' ? (preOdds.btts?.['true'] ?? null) : btts === 'false' ? (preOdds.btts?.['false'] ?? null) : null;
    const ouOdds     = (ouLine && ouPick) ? (preOdds.ou?.[ouLine]?.[ouPick] ?? null) : null;
    setMpOdds(p => ({ ...p, winner: winnerOdds, btts: bttsOdds, ou: ouOdds }));
  }, [isMarket, selectedMatch?.id, winner, btts, ouLine, ouPick, preOdds]);

  useEffect(() => { if (!isMarket) { setMpOdds(p => ({ ...p, dc: null })); return; } setMpOdds(p => ({ ...p, dc: dcPick ? (preOdds.dc?.[dcPick] ?? null) : null })); }, [isMarket, selectedMatch?.id, dcPick, preOdds]);
  useEffect(() => { if (!isMarket || !cornersLine || !cornersOU) { setMpOdds(p => ({ ...p, corners: null })); return; } setMpOdds(p => ({ ...p, corners: cornersPreOdds[cornersLine]?.[cornersOU] ?? null })); }, [isMarket, selectedMatch?.id, cornersLine, cornersOU, cornersPreOdds]);
  useEffect(() => { if (!isMarket || !yellowsLine || !yellowsOU) { setMpOdds(p => ({ ...p, yellows: null })); return; } setMpOdds(p => ({ ...p, yellows: yellowsPreOdds[yellowsLine]?.[yellowsOU] ?? null })); }, [isMarket, selectedMatch?.id, yellowsLine, yellowsOU, yellowsPreOdds]);
  useEffect(() => { if (!isMarket || !oddEvenPick) { setMpOdds(p => ({ ...p, oddEven: null })); return; } setMpOdds(p => ({ ...p, oddEven: preOdds.oddEven?.[oddEvenPick] ?? null })); }, [isMarket, selectedMatch?.id, oddEvenPick, preOdds]);
  useEffect(() => { if (!isMarket || !dnbPick) { setMpOdds(p => ({ ...p, dnb: null })); return; } setMpOdds(p => ({ ...p, dnb: preOdds.dnb?.[dnbPick] ?? null })); }, [isMarket, selectedMatch?.id, dnbPick, preOdds]);
  useEffect(() => { if (!isMarket || !wtnTeam || !wtnYN) { setMpOdds(p => ({ ...p, wtn: null })); return; } setMpOdds(p => ({ ...p, wtn: preOdds.wtn?.[wtnTeam]?.[wtnYN] ?? null })); }, [isMarket, selectedMatch?.id, wtnTeam, wtnYN, preOdds]);
  useEffect(() => { if (!isMarket || !hcpPick) { setMpOdds(p => ({ ...p, hcp: null })); return; } setMpOdds(p => ({ ...p, hcp: preOdds.hcp?.[hcpPick] ?? null })); }, [isMarket, selectedMatch?.id, hcpPick, preOdds]);
  useEffect(() => { if (!isMarket || !hGoalsLine || !hGoalsOU) { setMpOdds(p => ({ ...p, homeGoals: null })); return; } setMpOdds(p => ({ ...p, homeGoals: preOdds.homeGoals?.[hGoalsLine]?.[hGoalsOU] ?? null })); }, [isMarket, selectedMatch?.id, hGoalsLine, hGoalsOU, preOdds]);
  useEffect(() => { if (!isMarket || !aGoalsLine || !aGoalsOU) { setMpOdds(p => ({ ...p, awayGoals: null })); return; } setMpOdds(p => ({ ...p, awayGoals: preOdds.awayGoals?.[aGoalsLine]?.[aGoalsOU] ?? null })); }, [isMarket, selectedMatch?.id, aGoalsLine, aGoalsOU, preOdds]);
  useEffect(() => { if (!isMarket || !htPick) { setMpOdds(p => ({ ...p, ht: null })); return; } setMpOdds(p => ({ ...p, ht: preOdds.ht?.[htPick] ?? null })); }, [isMarket, selectedMatch?.id, htPick, preOdds]);
  useEffect(() => { if (!isMarket || !csPick || !csYN) { setMpOdds(p => ({ ...p, cs: null })); return; } setMpOdds(p => ({ ...p, cs: preOdds.cs?.[csPick]?.[csYN] ?? null })); }, [isMarket, selectedMatch?.id, csPick, csYN, preOdds]);
  useEffect(() => { if (!isMarket || !fgPick) { setMpOdds(p => ({ ...p, fg: null })); return; } setMpOdds(p => ({ ...p, fg: preOdds.fg?.[fgPick] ?? null })); }, [isMarket, selectedMatch?.id, fgPick, preOdds]);
  useEffect(() => { if (!isMarket || !btts1hPick) { setMpOdds(p => ({ ...p, btts1h: null })); return; } setMpOdds(p => ({ ...p, btts1h: preOdds.btts1h?.[btts1hPick] ?? null })); }, [isMarket, selectedMatch?.id, btts1hPick, preOdds]);
  useEffect(() => { if (!isMarket || !btts2hPick) { setMpOdds(p => ({ ...p, btts2h: null })); return; } setMpOdds(p => ({ ...p, btts2h: preOdds.btts2h?.[btts2hPick] ?? null })); }, [isMarket, selectedMatch?.id, btts2hPick, preOdds]);
  useEffect(() => { if (!isMarket || !htGoalsLine || !htGoalsOU) { setMpOdds(p => ({ ...p, htGoals: null })); return; } setMpOdds(p => ({ ...p, htGoals: preOdds.htGoals?.[htGoalsLine]?.[htGoalsOU] ?? null })); }, [isMarket, selectedMatch?.id, htGoalsLine, htGoalsOU, preOdds]);
  useEffect(() => { if (!isMarket || !shGoalsLine || !shGoalsOU) { setMpOdds(p => ({ ...p, shGoals: null })); return; } setMpOdds(p => ({ ...p, shGoals: preOdds.shGoals?.[shGoalsLine]?.[shGoalsOU] ?? null })); }, [isMarket, selectedMatch?.id, shGoalsLine, shGoalsOU, preOdds]);
  useEffect(() => { if (!isMarket || !homeOEPick) { setMpOdds(p => ({ ...p, homeOE: null })); return; } setMpOdds(p => ({ ...p, homeOE: preOdds.homeOE?.[homeOEPick] ?? null })); }, [isMarket, selectedMatch?.id, homeOEPick, preOdds]);
  useEffect(() => { if (!isMarket || !awayOEPick) { setMpOdds(p => ({ ...p, awayOE: null })); return; } setMpOdds(p => ({ ...p, awayOE: preOdds.awayOE?.[awayOEPick] ?? null })); }, [isMarket, selectedMatch?.id, awayOEPick, preOdds]);
  useEffect(() => { if (!isMarket || !oe1hPick) { setMpOdds(p => ({ ...p, oe1h: null })); return; } setMpOdds(p => ({ ...p, oe1h: preOdds.oe1h?.[oe1hPick] ?? null })); }, [isMarket, selectedMatch?.id, oe1hPick, preOdds]);
  useEffect(() => { if (!isMarket || !homeTsPick) { setMpOdds(p => ({ ...p, homeTs: null })); return; } setMpOdds(p => ({ ...p, homeTs: preOdds.homeTs?.[homeTsPick] ?? null })); }, [isMarket, selectedMatch?.id, homeTsPick, preOdds]);
  useEffect(() => { if (!isMarket || !awayTsPick) { setMpOdds(p => ({ ...p, awayTs: null })); return; } setMpOdds(p => ({ ...p, awayTs: preOdds.awayTs?.[awayTsPick] ?? null })); }, [isMarket, selectedMatch?.id, awayTsPick, preOdds]);
  useEffect(() => { if (!isMarket || !wbhHomePick) { setMpOdds(p => ({ ...p, wbhHome: null })); return; } setMpOdds(p => ({ ...p, wbhHome: preOdds.wbh?.Home?.[wbhHomePick] ?? null })); }, [isMarket, selectedMatch?.id, wbhHomePick, preOdds]);
  useEffect(() => { if (!isMarket || !wbhAwayPick) { setMpOdds(p => ({ ...p, wbhAway: null })); return; } setMpOdds(p => ({ ...p, wbhAway: preOdds.wbh?.Away?.[wbhAwayPick] ?? null })); }, [isMarket, selectedMatch?.id, wbhAwayPick, preOdds]);
  useEffect(() => { if (!isMarket || !lastScorePick) { setMpOdds(p => ({ ...p, lastScore: null })); return; } setMpOdds(p => ({ ...p, lastScore: preOdds.lastScore?.[lastScorePick] ?? null })); }, [isMarket, selectedMatch?.id, lastScorePick, preOdds]);
  useEffect(() => { if (!isMarket || !htftPick) { setMpOdds(p => ({ ...p, htft: null })); return; } setMpOdds(p => ({ ...p, htft: preOdds.htft?.[htftPick] ?? null })); }, [isMarket, selectedMatch?.id, htftPick, preOdds]);

  const allSelectedOdds = [
    winner ? mpOdds.winner : null,
    btts   ? mpOdds.btts   : null,
    (ouLine && ouPick)         ? mpOdds.ou        : null,
    dcPick                     ? mpOdds.dc        : null,
    (cornersLine && cornersOU) ? mpOdds.corners   : null,
    (yellowsLine && yellowsOU) ? mpOdds.yellows   : null,
    scorerPlayer               ? scorerPlayer.odds : null,
    oddEvenPick                ? mpOdds.oddEven   : null,
    dnbPick                    ? mpOdds.dnb       : null,
    (wtnTeam && wtnYN)         ? mpOdds.wtn       : null,
    hcpPick                    ? mpOdds.hcp       : null,
    (hGoalsLine && hGoalsOU)   ? mpOdds.homeGoals : null,
    (aGoalsLine && aGoalsOU)   ? mpOdds.awayGoals : null,
    htPick                     ? mpOdds.ht        : null,
    (csPick && csYN)           ? mpOdds.cs        : null,
    fgPick                     ? mpOdds.fg        : null,
    btts1hPick                 ? mpOdds.btts1h    : null,
    btts2hPick                 ? mpOdds.btts2h    : null,
    (htGoalsLine && htGoalsOU) ? mpOdds.htGoals   : null,
    (shGoalsLine && shGoalsOU) ? mpOdds.shGoals   : null,
    homeOEPick                 ? mpOdds.homeOE    : null,
    awayOEPick                 ? mpOdds.awayOE    : null,
    oe1hPick                   ? mpOdds.oe1h      : null,
    homeTsPick                 ? mpOdds.homeTs    : null,
    awayTsPick                 ? mpOdds.awayTs    : null,
    wbhHomePick                ? mpOdds.wbhHome   : null,
    wbhAwayPick                ? mpOdds.wbhAway   : null,
    lastScorePick              ? mpOdds.lastScore : null,
    htftPick                   ? mpOdds.htft      : null,
  ].filter(v => v != null && Number(v) > 0);

  const combinedOdds    = allSelectedOdds.length ? allSelectedOdds.reduce((a, o) => a * Number(o), 1) : null;
  const betAmt          = Number(amount);
  const exactPotential  = exactOdds && betAmt > 0 ? betAmt * Number(exactOdds.odds) : null;
  const marketPotential = combinedOdds && betAmt > 0 ? betAmt * combinedOdds : null;

  const anyMarketSelected = winner || btts || (ouLine && ouPick) || dcPick ||
    (cornersLine && cornersOU) || (yellowsLine && yellowsOU) || scorerPlayer ||
    oddEvenPick || dnbPick || (wtnTeam && wtnYN) || hcpPick ||
    (hGoalsLine && hGoalsOU) || (aGoalsLine && aGoalsOU) ||
    htPick || (csPick && csYN) || fgPick ||
    btts1hPick || btts2hPick || (htGoalsLine && htGoalsOU) || (shGoalsLine && shGoalsOU) ||
    homeOEPick || awayOEPick || oe1hPick || homeTsPick || awayTsPick ||
    wbhHomePick || wbhAwayPick || lastScorePick || htftPick;

  const scorerPositions = [...new Set(scorerPlayers.map(p => p.position))].sort((a, b) => (POS_ORDER[a] ?? 9) - (POS_ORDER[b] ?? 9));
  const scorerFiltered  = scorerPlayers.filter(p => p.position === scorerPosFilter);

  // ── Place Bet ──────────────────────────────────────────────────
  const placeBet = async () => {
    if (!selectedMatch || loading) return;
    setLoading(true); setFeedback(null);
    try {
      let betPlaced = false;
      if (betAmt > 0 && hasBetOdds) {
        if (isExact && home !== null && away !== null) {
          await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.ExactScore, scoreHome: home, scoreAway: away, amount: betAmt });
          betPlaced = true;
        } else if (isMarket) {
          const legs = [];
          if (winner && mpOdds.winner != null) legs.push({ betType: BET_TYPE.Winner, pick: WINNER_MAP[winner] });
          if (dcPick && mpOdds.dc != null) legs.push({ betType: BET_TYPE.DoubleChance, dCPick: dcPick });
          if (btts && mpOdds.btts != null) legs.push({ betType: BET_TYPE.BTTS, bTTSPick: btts === 'true' });
          if (ouLine && ouPick && mpOdds.ou != null) legs.push({ betType: BET_TYPE.OverUnder, oULine: OU_LINE_MAP[ouLine], oUPick: OU_PICK_MAP[ouPick] });
          if (cornersLine && cornersOU && mpOdds.corners != null) legs.push({ betType: BET_TYPE.Corners, lineValue: Number(cornersLine), oUPick: cornersOU });
          if (yellowsLine && yellowsOU && mpOdds.yellows != null) legs.push({ betType: BET_TYPE.YellowCards, lineValue: Number(yellowsLine), oUPick: yellowsOU });
          if (scorerPlayer) legs.push({ betType: BET_TYPE.Goalscorer, goalscorerId: scorerPlayer.playerId });
          if (oddEvenPick && mpOdds.oddEven != null) legs.push({ betType: BET_TYPE.OddEven, bTTSPick: oddEvenPick === 'true' });
          if (dnbPick && mpOdds.dnb != null) legs.push({ betType: BET_TYPE.DrawNoBet, pick: dnbPick });
          if (wtnTeam && wtnYN && mpOdds.wtn != null) legs.push({ betType: BET_TYPE.WinToNil, pick: wtnTeam, bTTSPick: wtnYN === 'true' });
          if (hcpPick && mpOdds.hcp != null) legs.push({ betType: BET_TYPE.Handicap, pick: hcpPick, lineValue: Number(preOdds.hcp?.line ?? 0) });
          if (hGoalsLine && hGoalsOU && mpOdds.homeGoals != null) legs.push({ betType: BET_TYPE.TeamGoals, pick: 'Home', lineValue: Number(hGoalsLine), oUPick: hGoalsOU });
          if (aGoalsLine && aGoalsOU && mpOdds.awayGoals != null) legs.push({ betType: BET_TYPE.TeamGoals, pick: 'Away', lineValue: Number(aGoalsLine), oUPick: aGoalsOU });
          if (htPick && mpOdds.ht != null) legs.push({ betType: BET_TYPE.HalfTime, pick: htPick });
          if (csPick && csYN && mpOdds.cs != null) legs.push({ betType: BET_TYPE.CleanSheet, pick: csPick, bTTSPick: csYN === 'true' });
          if (fgPick && mpOdds.fg != null) legs.push({ betType: BET_TYPE.FirstGoal, pick: fgPick === 'Draw' ? 'Draw' : fgPick });
          if (btts1hPick && mpOdds.btts1h != null) legs.push({ betType: BET_TYPE.Btts1stHalf, bTTSPick: btts1hPick === 'true' });
          if (btts2hPick && mpOdds.btts2h != null) legs.push({ betType: BET_TYPE.Btts2ndHalf, bTTSPick: btts2hPick === 'true' });
          if (htGoalsLine && htGoalsOU && mpOdds.htGoals != null) legs.push({ betType: BET_TYPE.HalfTimeGoals, oULine: lineToKey(htGoalsLine), oUPick: htGoalsOU });
          if (shGoalsLine && shGoalsOU && mpOdds.shGoals != null) legs.push({ betType: BET_TYPE.SecondHalfGoals, oULine: lineToKey(shGoalsLine), oUPick: shGoalsOU });
          if (homeOEPick && mpOdds.homeOE != null) legs.push({ betType: BET_TYPE.TeamOddEven, pick: 'Home', bTTSPick: homeOEPick === 'true' });
          if (awayOEPick && mpOdds.awayOE != null) legs.push({ betType: BET_TYPE.TeamOddEven, pick: 'Away', bTTSPick: awayOEPick === 'true' });
          if (oe1hPick && mpOdds.oe1h != null) legs.push({ betType: BET_TYPE.OddEven1stHalf, bTTSPick: oe1hPick === 'true' });
          if (homeTsPick && mpOdds.homeTs != null) legs.push({ betType: BET_TYPE.TeamToScore, pick: 'Home', bTTSPick: homeTsPick === 'true' });
          if (awayTsPick && mpOdds.awayTs != null) legs.push({ betType: BET_TYPE.TeamToScore, pick: 'Away', bTTSPick: awayTsPick === 'true' });
          if (wbhHomePick && mpOdds.wbhHome != null) legs.push({ betType: BET_TYPE.WinBothHalves, pick: 'Home', bTTSPick: wbhHomePick === 'true' });
          if (wbhAwayPick && mpOdds.wbhAway != null) legs.push({ betType: BET_TYPE.WinBothHalves, pick: 'Away', bTTSPick: wbhAwayPick === 'true' });
          if (lastScorePick && mpOdds.lastScore != null) legs.push({ betType: BET_TYPE.LastToScore, pick: lastScorePick });
          if (htftPick && mpOdds.htft != null) legs.push({ betType: BET_TYPE.HtFt, stringPick: htftPick });

          if (legs.length === 1) {
            await api.post('/Bet', { matchId: selectedMatch.id, ...legs[0], amount: betAmt });
            betPlaced = true;
          } else if (legs.length > 1) {
            await api.post('/Bet/accumulator', { matchId: selectedMatch.id, legs, amount: betAmt });
            betPlaced = true;
          }
        }
        if (betPlaced) await refreshBalance();
      }
      setFeedback({ type: 'ok', msg: betPlaced ? '✅ Bet placed!' : '✅ Done!' });
    } catch (err) {
      setFeedback({ type: 'err', msg: err?.response?.data?.message || 'Failed to place bet.' });
    } finally { setLoading(false); }
  };

  // ── Live restrictions ─────────────────────────────────────────
  // Prefer Sportmonks phase ('1H'/'HT'/'2H'/'ET') when available — it's the
  // authoritative signal. Fall back to minute > 45 only when phase is missing.
  const liveMin       = selectedMatch?.liveMinute ?? null;
  const liveState     = selectedMatch?.liveState ?? null;
  const isHalfTime    = liveState === 'HT' || liveState === 'BREAK';
  // "isSecondHalf" = 1H is done (HT, BREAK, 2H, ET all qualify). Used to lock
  // every 1H market deterministically — no more minute-based guessing.
  const isSecondHalf  = liveState === 'HT' || liveState === 'BREAK'
                     || liveState === '2H' || liveState === 'ET'
                     || (liveState == null && liveMin != null && liveMin > 45);
  const liveHomeScore = selectedMatch?.homeScore ?? 0;
  const liveAwayScore = selectedMatch?.awayScore ?? 0;
  const totalGoals    = liveHomeScore + liveAwayScore;
  const hasHomeGoal   = liveHomeScore > 0;
  const hasAwayGoal   = liveAwayScore > 0;
  const hasAnyGoal    = totalGoals > 0;
  const bothScored    = hasHomeGoal && hasAwayGoal;

  // Derive 1H score from goalScorers (events with minute ≤ 45)
  const goalsArr      = selectedMatch?.goalScorers ?? [];
  const goals1H       = goalsArr.filter(g => (g.minute ?? 0) <= 45);
  const home1H        = goals1H.filter(g => g.team === 'home').length;
  const away1H        = goals1H.filter(g => g.team === 'away').length;
  const total1H       = home1H + away1H;
  const both1HScored  = home1H > 0 && away1H > 0;

  // 2H score = total − 1H (only meaningful once 2H started)
  const home2H        = isSecondHalf ? Math.max(0, liveHomeScore - home1H) : 0;
  const away2H        = isSecondHalf ? Math.max(0, liveAwayScore - away1H) : 0;
  const total2H       = home2H + away2H;
  const both2HScored  = home2H > 0 && away2H > 0;

  // HT result — only known once 2H started
  const htResult      = isSecondHalf
    ? (home1H > away1H ? 'Home' : home1H < away1H ? 'Away' : 'Draw')
    : null;

  // Helper: O/U cell is locked when score crosses the line
  // (Over guaranteed AND Under impossible — both sides of the bet are determined)
  const isOULocked = (line, total) => total >= Math.ceil(Number(line));

  // Live stats from Sportmonks (null when API hasn't returned them yet)
  const liveCorners = selectedMatch?.totalCorners ?? null;
  const liveYellows = selectedMatch?.totalYellowCards ?? null;

  // Wraps a market section header to show a lock message when disabled
  const LiveLock = ({ reason }) => (
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8, fontStyle: 'italic' }}>
      🔒 {reason}
    </span>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page-grid">

      {/* Live match list */}
      <section className="shell-card panel">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="live-dot" />
            <div>
              <h2 style={{ margin: 0 }}>Live Now</h2>
              <p style={{ margin: 0 }}>Select a match to place a live bet.</p>
            </div>
          </div>
        </div>

        {loadingLive && <div className="empty-box">Checking for live matches…</div>}

        {!loadingLive && liveMatches.length === 0 && (
          <div className="empty-box" style={{ padding: '40px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📺</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No live matches right now</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This page refreshes every 5 seconds.</div>
          </div>
        )}

        {liveMatches.length > 0 && (
          <div className="cards-grid">
            <div className="matches-table-head">
              <span>MIN</span>
              <span>FIXTURE</span>
              <span style={{ textAlign: 'center' }}>1</span>
              <span style={{ textAlign: 'center' }}>X</span>
              <span style={{ textAlign: 'center' }}>2</span>
            </div>
            {liveMatches.map(match => (
              <React.Fragment key={match.id}>
              <div
                className={`match-card match-card--live${selectedMatch?.id === match.id ? ' match-card--selected' : ''}`}
                onClick={() => {
                  if (selectedMatch?.id === match.id) { setSelectedMatch(null); resetPanel(); }
                  else { setSelectedMatch(match); resetPanel(); }
                }}
              >
                <span className="match-card__time" style={{ color: 'var(--red, #e53e3e)', fontWeight: 700 }}>
                  {displayMinute(match)}
                </span>
                <span className="match-card__fixture" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span>
                    {match.homeTeamName} <strong style={{ margin: '0 6px' }}>{match.homeScore ?? 0} – {match.awayScore ?? 0}</strong> {match.awayTeamName}
                  </span>
                  {match.goalScorers?.length > 0 && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 3, fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                      {match.goalScorers.map((g, i) => (
                        <span key={i} style={{ whiteSpace: 'nowrap' }}>
                          {g.team === 'home'
                            ? <>⚽ {g.isOwnGoal ? <em>(OG) </em> : null}{g.playerName} {g.minute}&apos;</>
                            : <>{g.playerName}{g.isOwnGoal ? <em> (OG)</em> : null} {g.minute}&apos; ⚽</>}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="match-card__odds">{match.homeOdds ? Number(match.homeOdds).toFixed(2) : '—'}</span>
                <span className="match-card__odds">{match.drawOdds ? Number(match.drawOdds).toFixed(2) : '—'}</span>
                <span className="match-card__odds">{match.awayOdds ? Number(match.awayOdds).toFixed(2) : '—'}</span>
              </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </section>

      {/* Bet panel */}
      {selectedMatch && (
        <section className="shell-card panel" ref={panelRef} style={{ scrollMarginTop: 64 }}>

          <div className="match-hero">
            <div className="match-hero__badge" style={{ background: 'var(--red, #e53e3e)', color: '#fff' }}>
              <span className="live-dot" style={{ marginRight: 6 }} />
              LIVE — {displayMinute(selectedMatch)}
            </div>
            <h2 className="match-hero__title">
              <span>{selectedMatch.homeTeamName}</span>
              <span className="match-hero__vs">{selectedMatch.homeScore ?? 0} – {selectedMatch.awayScore ?? 0}</span>
              <span>{selectedMatch.awayTeamName}</span>
            </h2>
            {selectedMatch.goalScorers?.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)', gap: 8 }}>
                {/* Home goals — left-aligned */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedMatch.goalScorers.filter(g => g.team === 'home').map((g, i) => (
                    <span key={i}>⚽ {g.isOwnGoal ? <em>(OG) </em> : null}{g.playerName} {g.minute}&apos;</span>
                  ))}
                </div>
                {/* Away goals — right-aligned */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  {selectedMatch.goalScorers.filter(g => g.team === 'away').map((g, i) => (
                    <span key={i}>{g.playerName}{g.isOwnGoal ? <em> (OG)</em> : null} {g.minute}&apos; ⚽</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {feedback && (
            <div className={`alert ${feedback.type === 'ok' ? 'alert-success' : 'alert-error'}`} style={{ margin: '12px 0' }}>
              {feedback.msg}
            </div>
          )}

          {!mode && (
            <>
              <div className="premium-mode-grid">
                <button
                  type="button"
                  className="premium-mode-card premium-mode-card--exact"
                  onClick={() => setMode('exact')}
                  disabled
                  style={{ opacity: 0.38, cursor: 'not-allowed', filter: 'grayscale(0.5)' }}
                  title="Not available during live play"
                >
                  <div className="premium-mode-card__top">
                    <span className="premium-mode-card__icon">🎯</span>
                    <span className="premium-mode-card__points">5 pts</span>
                  </div>
                  <div className="premium-mode-card__title">Exact Score</div>
                  <div className="premium-mode-card__text">Not available during live play.</div>
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
              {selectedMatch.homeOdds != null && (
                <>
                  <div className="quick-bet-divider"><span>or place a quick bet</span></div>
                  <QuickBetPanel match={selectedMatch} />
                </>
              )}
            </>
          )}

          <div className="prediction-form">

            {/* Exact Score */}
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

            {/* Market Pick */}
            {isMarket && (
              <>
                <div className="mode-card mode-card--market">
                  <div className="mode-card__top"><span className="mode-badge">MARKET PICK — UP TO 3 PTS</span></div>
                  <div className="mode-card__title">Pick any combination of markets</div>
                  <button type="button" className="mode-card__button" onClick={() => { setMode(''); resetPanel(); }}>Change type</button>
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
                        {DC_OPTIONS.map(({ key }) => {
                          const lbl = key === 'HomeOrDraw' ? `${selectedMatch.homeTeamName} or Draw`
                                    : key === 'DrawOrAway' ? `Draw or ${selectedMatch.awayTeamName}`
                                    : `${selectedMatch.homeTeamName} or ${selectedMatch.awayTeamName}`;
                          return (
                            <button key={key} type="button"
                              className={`market-option ${dcPick === key ? 'market-option--active' : ''} ${winner ? 'market-option--disabled' : ''}`}
                              disabled={!!winner}
                              onClick={() => setDCPick(dcPick === key ? '' : key)}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{preOdds.dc?.[key] != null ? Number(preOdds.dc[key]).toFixed(2) : '—'}</div>
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
                        {[{ line: 'Line15', label: '1.5' }, { line: 'Line25', label: '2.5' }, { line: 'Line35', label: '3.5' }].map(({ line, label }) => {
                          const cellLocked = isOULocked(label, totalGoals);
                          return (
                          <div key={line} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{label}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${ouLine === line && ouPick === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (ouLine === line && ouPick === pick) { setField('ouLine',''); setField('ouPick',''); } else { setField('ouLine', line); setField('ouPick', pick); } }}>
                                {preOdds.ou?.[line]?.[pick] != null ? Number(preOdds.ou[line][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* BTTS */}
                  <div className={`market-section ${collapsed.btts ? 'market-section--collapsed' : ''}${bothScored ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !bothScored && toggleSection('btts')} style={bothScored ? { cursor: 'default' } : {}}>
                      <span className="market-section__name">Both Teams to Score</span>
                      {bothScored ? <LiveLock reason="both teams have scored" /> : btts && <span className="market-section__badge">{btts === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{!bothScored && (collapsed.btts ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.btts && !bothScored && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts === val ? 'market-option--active' : ''}`}
                            onClick={() => setField('btts', btts === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{preOdds.btts?.[val] != null ? Number(preOdds.btts[val]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Corners */}
                  <div className={`market-section ${collapsed.corners ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('corners')}>
                      <span className="market-section__name">⌐ Corners — Over / Under{liveCorners != null && <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>({liveCorners} so far)</span>}</span>
                      {cornersLine && cornersOU && <span className="market-section__badge">{cornersOU} {cornersLine}</span>}
                      <span className="market-section__toggle">{collapsed.corners ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.corners && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {CORNER_LINES.map(l => {
                          const cellLocked = liveCorners != null && isOULocked(l, liveCorners);
                          return (
                          <div key={l} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{l}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${cornersLine === String(l) && cornersOU === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (cornersLine === String(l) && cornersOU === pick) { setCornersLine(''); setCornersOU(''); } else { setCornersLine(String(l)); setCornersOU(pick); } }}>
                                {cornersPreOdds[l]?.[pick] != null ? Number(cornersPreOdds[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Yellow Cards */}
                  <div className={`market-section ${collapsed.yellows ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('yellows')}>
                      <span className="market-section__name">▬ Yellow Cards — Over / Under{liveYellows != null && <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>({liveYellows} so far)</span>}</span>
                      {yellowsLine && yellowsOU && <span className="market-section__badge">{yellowsOU} {yellowsLine}</span>}
                      <span className="market-section__toggle">{collapsed.yellows ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.yellows && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {YELLOW_LINES.map(l => {
                          const cellLocked = liveYellows != null && isOULocked(l, liveYellows);
                          return (
                          <div key={l} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{l}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${yellowsLine === String(l) && yellowsOU === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (yellowsLine === String(l) && yellowsOU === pick) { setYellowsLine(''); setYellowsOU(''); } else { setYellowsLine(String(l)); setYellowsOU(pick); } }}>
                                {yellowsPreOdds[l]?.[pick] != null ? Number(yellowsPreOdds[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Odd / Even Goals */}
                  <div className={`market-section ${collapsed.oddEven ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('oddEven')}>
                      <span className="market-section__name">≈ Odd / Even Goals</span>
                      {oddEvenPick && <span className="market-section__badge">{oddEvenPick === 'true' ? 'Odd' : 'Even'}</span>}
                      <span className="market-section__toggle">{collapsed.oddEven ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.oddEven && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Odd' }, { val: 'false', lbl: 'Even' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${oddEvenPick === val ? 'market-option--active' : ''}`}
                            onClick={() => setOddEvenPick(oddEvenPick === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{preOdds.oddEven?.[val] != null ? Number(preOdds.oddEven[val]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Draw No Bet */}
                  <div className={`market-section ${collapsed.dnb ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('dnb')}>
                      <span className="market-section__name">⊖ Draw No Bet</span>
                      {dnbPick && <span className="market-section__badge">{dnbPick === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName}</span>}
                      <span className="market-section__toggle">{collapsed.dnb ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.dnb && (
                      <div className="market-options market-options--2">
                        {[{ val: 'Home', lbl: selectedMatch.homeTeamName }, { val: 'Away', lbl: selectedMatch.awayTeamName }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${dnbPick === val ? 'market-option--active' : ''}`}
                            onClick={() => setDnbPick(dnbPick === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{preOdds.dnb?.[val] != null ? Number(preOdds.dnb[val]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Win to Nil */}
                  <div className={`market-section ${collapsed.wtn ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('wtn')}>
                      <span className="market-section__name">⊘ Win to Nil</span>
                      {wtnTeam && wtnYN && <span className="market-section__badge">{wtnTeam === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName} {wtnYN === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.wtn ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.wtn && (
                      <div style={{ padding: '0 16px 12px' }}>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, locked: hasAwayGoal, lockReason: `${selectedMatch.awayTeamName} already scored` },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, locked: hasHomeGoal, lockReason: `${selectedMatch.homeTeamName} already scored` },
                        ].map(({ val, lbl, locked, lockReason }) => (
                          <div key={val} style={{ marginBottom: 8, opacity: locked ? 0.45 : 1 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {lbl}{locked && <LiveLock reason={lockReason} />}
                            </div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  disabled={locked}
                                  className={`market-option ${wtnTeam === val && wtnYN === yn ? 'market-option--active' : ''}${locked ? ' market-option--disabled' : ''}`}
                                  onClick={() => { if (locked) return; if (wtnTeam === val && wtnYN === yn) { setWtnTeam(''); setWtnYN(''); } else { setWtnTeam(val); setWtnYN(yn); } }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">{preOdds.wtn?.[val]?.[yn] != null ? Number(preOdds.wtn[val][yn]).toFixed(2) : '—'}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Handicap */}
                  <div className={`market-section ${collapsed.hcp ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('hcp')}>
                      <span className="market-section__name">± Handicap {preOdds.hcp?.line ? `(${preOdds.hcp.line})` : '(-1)'}</span>
                      {hcpPick && <span className="market-section__badge">{hcpPick}</span>}
                      <span className="market-section__toggle">{collapsed.hcp ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.hcp && (
                      <div className="market-options market-options--3">
                        {[{ key: 'Home', label: selectedMatch.homeTeamName }, { key: 'Draw', label: 'Draw' }, { key: 'Away', label: selectedMatch.awayTeamName }].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${hcpPick === key ? 'market-option--active' : ''}`}
                            onClick={() => setHcpPick(hcpPick === key ? '' : key)}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{preOdds.hcp?.[key] != null ? Number(preOdds.hcp[key]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Home Goals */}
                  <div className={`market-section ${collapsed.homeGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('homeGoals')}>
                      <span className="market-section__name">△ {selectedMatch.homeTeamName} Goals</span>
                      {hGoalsLine && hGoalsOU && <span className="market-section__badge">{hGoalsOU} {hGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.homeGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.homeGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {TEAM_GOAL_LINES.map(l => {
                          const cellLocked = isOULocked(l, liveHomeScore);
                          return (
                          <div key={l} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{l}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${hGoalsLine === String(l) && hGoalsOU === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (hGoalsLine === String(l) && hGoalsOU === pick) { setHGoalsLine(''); setHGoalsOU(''); } else { setHGoalsLine(String(l)); setHGoalsOU(pick); } }}>
                                {preOdds.homeGoals?.[l]?.[pick] != null ? Number(preOdds.homeGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Away Goals */}
                  <div className={`market-section ${collapsed.awayGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('awayGoals')}>
                      <span className="market-section__name">▽ {selectedMatch.awayTeamName} Goals</span>
                      {aGoalsLine && aGoalsOU && <span className="market-section__badge">{aGoalsOU} {aGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.awayGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.awayGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {TEAM_GOAL_LINES.map(l => {
                          const cellLocked = isOULocked(l, liveAwayScore);
                          return (
                          <div key={l} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{l}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${aGoalsLine === String(l) && aGoalsOU === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (aGoalsLine === String(l) && aGoalsOU === pick) { setAGoalsLine(''); setAGoalsOU(''); } else { setAGoalsLine(String(l)); setAGoalsOU(pick); } }}>
                                {preOdds.awayGoals?.[l]?.[pick] != null ? Number(preOdds.awayGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Half Time Result */}
                  <div className={`market-section ${collapsed.ht ? 'market-section--collapsed' : ''}${isSecondHalf ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !isSecondHalf && toggleSection('ht')} style={isSecondHalf ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◑ Half Time Result</span>
                      {isSecondHalf ? <LiveLock reason="2nd half — result already set" /> : htPick && <span className="market-section__badge">{htPick === 'Home' ? selectedMatch.homeTeamName : htPick === 'Away' ? selectedMatch.awayTeamName : 'Draw'}</span>}
                      <span className="market-section__toggle">{!isSecondHalf && (collapsed.ht ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.ht && !isSecondHalf && (
                      <div className="market-options market-options--3">
                        {[{ key: 'Home', label: selectedMatch.homeTeamName }, { key: 'Draw', label: 'Draw' }, { key: 'Away', label: selectedMatch.awayTeamName }].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${htPick === key ? 'market-option--active' : ''}`}
                            onClick={() => setHtPick(htPick === key ? '' : key)}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{preOdds.ht?.[key] != null ? Number(preOdds.ht[key]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clean Sheet */}
                  <div className={`market-section ${collapsed.cs ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('cs')}>
                      <span className="market-section__name">○ Clean Sheet</span>
                      {csPick && csYN && <span className="market-section__badge">{csPick === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName} {csYN === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.cs ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.cs && (
                      <div style={{ padding: '0 16px 12px' }}>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, locked: hasAwayGoal, lockReason: `${selectedMatch.awayTeamName} already scored` },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, locked: hasHomeGoal, lockReason: `${selectedMatch.homeTeamName} already scored` },
                        ].map(({ val, lbl, locked, lockReason }) => (
                          <div key={val} style={{ marginBottom: 8, opacity: locked ? 0.45 : 1 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {lbl}{locked && <LiveLock reason={lockReason} />}
                            </div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  disabled={locked}
                                  className={`market-option ${csPick === val && csYN === yn ? 'market-option--active' : ''}${locked ? ' market-option--disabled' : ''}`}
                                  onClick={() => { if (locked) return; if (csPick === val && csYN === yn) { setCsPick(''); setCsYN(''); } else { setCsPick(val); setCsYN(yn); } }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">{preOdds.cs?.[val]?.[yn] != null ? Number(preOdds.cs[val][yn]).toFixed(2) : '—'}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* First Goal */}
                  <div className={`market-section ${collapsed.fg ? 'market-section--collapsed' : ''}${hasAnyGoal ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !hasAnyGoal && toggleSection('fg')} style={hasAnyGoal ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◎ First Goal</span>
                      {hasAnyGoal ? <LiveLock reason="goal already scored" /> : fgPick && <span className="market-section__badge">{fgPick === 'Home' ? selectedMatch.homeTeamName : fgPick === 'Away' ? selectedMatch.awayTeamName : 'No Goal'}</span>}
                      <span className="market-section__toggle">{!hasAnyGoal && (collapsed.fg ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.fg && !hasAnyGoal && (
                      <div className="market-options market-options--3">
                        {[{ key: 'Home', label: selectedMatch.homeTeamName }, { key: 'Draw', label: 'No Goal' }, { key: 'Away', label: selectedMatch.awayTeamName }].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${fgPick === key ? 'market-option--active' : ''}`}
                            onClick={() => setFgPick(fgPick === key ? '' : key)}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{preOdds.fg?.[key] != null ? Number(preOdds.fg[key]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BTTS 1st Half */}
                  <div className={`market-section ${collapsed.btts1h ? 'market-section--collapsed' : ''}${(isSecondHalf || both1HScored) ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !(isSecondHalf || both1HScored) && toggleSection('btts1h')} style={(isSecondHalf || both1HScored) ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◐ BTTS — 1st Half</span>
                      {both1HScored && !isSecondHalf ? <LiveLock reason="both scored in 1H" /> : isSecondHalf ? <LiveLock reason="2nd half" /> : btts1hPick && <span className="market-section__badge">{btts1hPick === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{!(isSecondHalf || both1HScored) && (collapsed.btts1h ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.btts1h && !isSecondHalf && !both1HScored && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts1hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => setBtts1hPick(btts1hPick === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{preOdds.btts1h?.[val] != null ? Number(preOdds.btts1h[val]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BTTS 2nd Half */}
                  <div className={`market-section ${collapsed.btts2h ? 'market-section--collapsed' : ''}${both2HScored ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !both2HScored && toggleSection('btts2h')} style={both2HScored ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◑ BTTS — 2nd Half</span>
                      {both2HScored ? <LiveLock reason="both scored in 2H" /> : btts2hPick && <span className="market-section__badge">{btts2hPick === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{!both2HScored && (collapsed.btts2h ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.btts2h && !both2HScored && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts2hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => setBtts2hPick(btts2hPick === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{preOdds.btts2h?.[val] != null ? Number(preOdds.btts2h[val]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 1st Half Goals O/U */}
                  <div className={`market-section ${collapsed.htGoals ? 'market-section--collapsed' : ''}${isSecondHalf ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !isSecondHalf && toggleSection('htGoals')} style={isSecondHalf ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◐ 1st Half Goals — Over / Under</span>
                      {isSecondHalf ? <LiveLock reason="2nd half" /> : htGoalsLine && htGoalsOU && <span className="market-section__badge">{htGoalsOU} {htGoalsLine}</span>}
                      <span className="market-section__toggle">{!isSecondHalf && (collapsed.htGoals ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.htGoals && !isSecondHalf && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {['0.5', '1.5', '2.5'].map(l => {
                          const cellLocked = isOULocked(l, total1H);
                          return (
                          <div key={l} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{l}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${htGoalsLine === l && htGoalsOU === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (htGoalsLine === l && htGoalsOU === pick) { setHtGoalsLine(''); setHtGoalsOU(''); } else { setHtGoalsLine(l); setHtGoalsOU(pick); } }}>
                                {preOdds.htGoals?.[l]?.[pick] != null ? Number(preOdds.htGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2nd Half Goals O/U */}
                  <div className={`market-section ${collapsed.shGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('shGoals')}>
                      <span className="market-section__name">◑ 2nd Half Goals — Over / Under</span>
                      {shGoalsLine && shGoalsOU && <span className="market-section__badge">{shGoalsOU} {shGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.shGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.shGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {['0.5', '1.5', '2.5'].map(l => {
                          // Only meaningful when 2H has started — otherwise total2H is 0 and nothing locks
                          const cellLocked = isSecondHalf && isOULocked(l, total2H);
                          return (
                          <div key={l} className="ou-table__row" style={cellLocked ? { opacity: 0.4 } : {}}>
                            <span className="ou-table__line">{l}{cellLocked && ' 🔒'}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                disabled={cellLocked}
                                className={`ou-cell ${shGoalsLine === l && shGoalsOU === pick ? 'ou-cell--active' : ''}${cellLocked ? ' ou-cell--disabled' : ''}`}
                                onClick={() => { if (cellLocked) return; if (shGoalsLine === l && shGoalsOU === pick) { setShGoalsLine(''); setShGoalsOU(''); } else { setShGoalsLine(l); setShGoalsOU(pick); } }}>
                                {preOdds.shGoals?.[l]?.[pick] != null ? Number(preOdds.shGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Team Odd/Even */}
                  <div className={`market-section ${collapsed.teamOE ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('teamOE')}>
                      <span className="market-section__name">≈ Team Goals — Odd / Even</span>
                      {(homeOEPick || awayOEPick) && <span className="market-section__badge">selected</span>}
                      <span className="market-section__toggle">{collapsed.teamOE ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.teamOE && (
                      <div style={{ padding: '0 16px 12px' }}>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, pick: homeOEPick, setPick: setHomeOEPick, key: 'homeOE' },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, pick: awayOEPick, setPick: setAwayOEPick, key: 'awayOE' },
                        ].map(({ val, lbl, pick: tp, setPick, key }) => (
                          <div key={val} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{lbl}</div>
                            <div className="market-options market-options--2">
                              {[{ oe: 'true', lbl2: 'Odd' }, { oe: 'false', lbl2: 'Even' }].map(({ oe, lbl2 }) => (
                                <button key={oe} type="button"
                                  className={`market-option ${tp === oe ? 'market-option--active' : ''}`}
                                  onClick={() => setPick(tp === oe ? '' : oe)}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">{preOdds[key]?.[oe] != null ? Number(preOdds[key][oe]).toFixed(2) : '—'}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Odd/Even 1st Half */}
                  <div className={`market-section ${collapsed.oe1h ? 'market-section--collapsed' : ''}${isSecondHalf ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !isSecondHalf && toggleSection('oe1h')} style={isSecondHalf ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">≈ Odd / Even Goals — 1st Half</span>
                      {isSecondHalf ? <LiveLock reason="2nd half" /> : oe1hPick && <span className="market-section__badge">{oe1hPick === 'true' ? 'Odd' : 'Even'}</span>}
                      <span className="market-section__toggle">{!isSecondHalf && (collapsed.oe1h ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.oe1h && !isSecondHalf && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Odd' }, { val: 'false', lbl: 'Even' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${oe1hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => setOe1hPick(oe1hPick === val ? '' : val)}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{preOdds.oe1h?.[val] != null ? Number(preOdds.oe1h[val]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team to Score */}
                  <div className={`market-section ${collapsed.teamTs ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('teamTs')}>
                      <span className="market-section__name">→ Team to Score</span>
                      {(homeTsPick || awayTsPick) && <span className="market-section__badge">selected</span>}
                      <span className="market-section__toggle">{collapsed.teamTs ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.teamTs && (
                      <div style={{ padding: '0 16px 12px' }}>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, pick: homeTsPick, setPick: setHomeTsPick, key: 'homeTs', locked: hasHomeGoal },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, pick: awayTsPick, setPick: setAwayTsPick, key: 'awayTs', locked: hasAwayGoal },
                        ].map(({ val, lbl, pick: tp, setPick, key, locked }) => (
                          <div key={val} style={{ marginBottom: 8, opacity: locked ? 0.45 : 1 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {lbl}{locked && <LiveLock reason="already scored" />}
                            </div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  disabled={locked}
                                  className={`market-option ${tp === yn ? 'market-option--active' : ''}${locked ? ' market-option--disabled' : ''}`}
                                  onClick={() => { if (locked) return; setPick(tp === yn ? '' : yn); }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">{preOdds[key]?.[yn] != null ? Number(preOdds[key][yn]).toFixed(2) : '—'}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Win Both Halves */}
                  <div className={`market-section ${collapsed.wbh ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('wbh')}>
                      <span className="market-section__name">◆ Win Both Halves</span>
                      {(wbhHomePick || wbhAwayPick) && <span className="market-section__badge">selected</span>}
                      <span className="market-section__toggle">{collapsed.wbh ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.wbh && (
                      <div style={{ padding: '0 16px 12px' }}>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, pick: wbhHomePick, setPick: setWbhHomePick, locked: htResult != null && htResult !== 'Home', reason: htResult === 'Draw' ? '1H was a draw' : htResult === 'Away' ? `${selectedMatch.awayTeamName} won 1H` : '' },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, pick: wbhAwayPick, setPick: setWbhAwayPick, locked: htResult != null && htResult !== 'Away', reason: htResult === 'Draw' ? '1H was a draw' : htResult === 'Home' ? `${selectedMatch.homeTeamName} won 1H` : '' },
                        ].map(({ val, lbl, pick: tp, setPick, locked, reason }) => (
                          <div key={val} style={{ marginBottom: 8, opacity: locked ? 0.45 : 1 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {lbl}{locked && <LiveLock reason={reason} />}
                            </div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  disabled={locked}
                                  className={`market-option ${tp === yn ? 'market-option--active' : ''}${locked ? ' market-option--disabled' : ''}`}
                                  onClick={() => { if (locked) return; setPick(tp === yn ? '' : yn); }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">{preOdds.wbh?.[val]?.[yn] != null ? Number(preOdds.wbh[val][yn]).toFixed(2) : '—'}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Last Team to Score */}
                  <div className={`market-section ${collapsed.lastScore ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('lastScore')}>
                      <span className="market-section__name">◇ Last Team to Score</span>
                      {lastScorePick && <span className="market-section__badge">{lastScorePick === 'Home' ? selectedMatch.homeTeamName : lastScorePick === 'Away' ? selectedMatch.awayTeamName : 'No Goal'}</span>}
                      <span className="market-section__toggle">{collapsed.lastScore ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.lastScore && (
                      <div className="market-options market-options--3">
                        {[{ key: 'Home', label: selectedMatch.homeTeamName }, { key: 'Draw', label: 'No Goal' }, { key: 'Away', label: selectedMatch.awayTeamName }].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${lastScorePick === key ? 'market-option--active' : ''}`}
                            onClick={() => setLastScorePick(lastScorePick === key ? '' : key)}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{preOdds.lastScore?.[key] != null ? Number(preOdds.lastScore[key]).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* HT/FT — when HT result known, only valid combinations remain unlocked */}
                  <div className={`market-section ${collapsed.htft ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('htft')}>
                      <span className="market-section__name">↕ Half Time / Full Time</span>
                      {htResult && <LiveLock reason={`HT: ${htResult}`} />}
                      {!htResult && htftPick && <span className="market-section__badge">{htftPick}</span>}
                      <span className="market-section__toggle">{collapsed.htft ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.htft && (() => {
                      const H = selectedMatch.homeTeamName, D = 'Draw', A = selectedMatch.awayTeamName;
                      const opts = [
                        { key: 'HH', label: `${H} / ${H}` }, { key: 'HD', label: `${H} / ${D}` }, { key: 'HA', label: `${H} / ${A}` },
                        { key: 'DH', label: `${D} / ${H}` }, { key: 'DD', label: `${D} / ${D}` }, { key: 'DA', label: `${D} / ${A}` },
                        { key: 'AH', label: `${A} / ${H}` }, { key: 'AD', label: `${A} / ${D}` }, { key: 'AA', label: `${A} / ${A}` },
                      ];
                      // First letter of key encodes HT outcome: H/D/A
                      const htLetter = htResult === 'Home' ? 'H' : htResult === 'Away' ? 'A' : htResult === 'Draw' ? 'D' : null;
                      return (
                        <div className="market-options market-options--3">
                          {opts.map(({ key, label }) => {
                            const optLocked = htLetter != null && key[0] !== htLetter;
                            return (
                            <button key={key} type="button"
                              disabled={optLocked}
                              className={`market-option ${htftPick === key ? 'market-option--active' : ''}${optLocked ? ' market-option--disabled' : ''}`}
                              style={optLocked ? { opacity: 0.4 } : {}}
                              onClick={() => { if (optLocked) return; setHtftPick(htftPick === key ? '' : key); }}>
                              <div className="market-option__label" style={{ fontSize: '0.72rem' }}>{label}</div>
                              <div className="market-option__odds">{preOdds.htft?.[key] != null ? Number(preOdds.htft[key]).toFixed(2) : '—'}</div>
                            </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Goalscorer */}
                  <div className={`market-section ${collapsed.scorer ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('scorer')}>
                      <span className="market-section__name">◉ Goalscorer</span>
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
                              <div className="muted-text" style={{ fontSize: '0.78rem' }}>No players found.</div>
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
                    <div className="bet-slip">
                      <div className="bet-slip__header">
                        <div className="bet-slip__info">
                          <span className="bet-slip__pick">Market Pick</span>
                          <div className="bet-slip__legs">
                            {winner && mpOdds.winner != null && <span className="bet-slip__leg">{winner === 'Home' ? selectedMatch.homeTeamName : winner === 'Away' ? selectedMatch.awayTeamName : 'Draw'}<em>{Number(mpOdds.winner).toFixed(2)}</em></span>}
                            {dcPick && mpOdds.dc != null && <span className="bet-slip__leg">{DC_OPTIONS.find(d => d.key === dcPick)?.label} DC<em>{Number(mpOdds.dc).toFixed(2)}</em></span>}
                            {btts && mpOdds.btts != null && <span className="bet-slip__leg">BTTS {btts === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.btts).toFixed(2)}</em></span>}
                            {ouLine && ouPick && mpOdds.ou != null && <span className="bet-slip__leg">Goals {ouPick} {ouLine.replace('Line','').replace(/(\d)(\d)/,'$1.$2')}<em>{Number(mpOdds.ou).toFixed(2)}</em></span>}
                            {cornersLine && cornersOU && mpOdds.corners != null && <span className="bet-slip__leg">Corners {cornersOU} {cornersLine}<em>{Number(mpOdds.corners).toFixed(2)}</em></span>}
                            {yellowsLine && yellowsOU && mpOdds.yellows != null && <span className="bet-slip__leg">YC {yellowsOU} {yellowsLine}<em>{Number(mpOdds.yellows).toFixed(2)}</em></span>}
                            {scorerPlayer && <span className="bet-slip__leg">{scorerPlayer.name} to score<em>{Number(scorerPlayer.odds).toFixed(2)}</em></span>}
                            {oddEvenPick && mpOdds.oddEven != null && <span className="bet-slip__leg">{oddEvenPick === 'true' ? 'Odd' : 'Even'} Goals<em>{Number(mpOdds.oddEven).toFixed(2)}</em></span>}
                            {dnbPick && mpOdds.dnb != null && <span className="bet-slip__leg">DNB {dnbPick}<em>{Number(mpOdds.dnb).toFixed(2)}</em></span>}
                            {wtnTeam && wtnYN && mpOdds.wtn != null && <span className="bet-slip__leg">WtN {wtnTeam} {wtnYN === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.wtn).toFixed(2)}</em></span>}
                            {hcpPick && mpOdds.hcp != null && <span className="bet-slip__leg">HCP {hcpPick}<em>{Number(mpOdds.hcp).toFixed(2)}</em></span>}
                            {hGoalsLine && hGoalsOU && mpOdds.homeGoals != null && <span className="bet-slip__leg">H Goals {hGoalsOU} {hGoalsLine}<em>{Number(mpOdds.homeGoals).toFixed(2)}</em></span>}
                            {aGoalsLine && aGoalsOU && mpOdds.awayGoals != null && <span className="bet-slip__leg">A Goals {aGoalsOU} {aGoalsLine}<em>{Number(mpOdds.awayGoals).toFixed(2)}</em></span>}
                            {htPick && mpOdds.ht != null && <span className="bet-slip__leg">HT {htPick}<em>{Number(mpOdds.ht).toFixed(2)}</em></span>}
                            {csPick && csYN && mpOdds.cs != null && <span className="bet-slip__leg">CS {csPick} {csYN === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.cs).toFixed(2)}</em></span>}
                            {fgPick && mpOdds.fg != null && <span className="bet-slip__leg">First Goal {fgPick}<em>{Number(mpOdds.fg).toFixed(2)}</em></span>}
                            {btts1hPick && mpOdds.btts1h != null && <span className="bet-slip__leg">BTTS 1H {btts1hPick === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.btts1h).toFixed(2)}</em></span>}
                            {btts2hPick && mpOdds.btts2h != null && <span className="bet-slip__leg">BTTS 2H {btts2hPick === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.btts2h).toFixed(2)}</em></span>}
                            {htGoalsLine && htGoalsOU && mpOdds.htGoals != null && <span className="bet-slip__leg">1H Goals {htGoalsOU} {htGoalsLine}<em>{Number(mpOdds.htGoals).toFixed(2)}</em></span>}
                            {shGoalsLine && shGoalsOU && mpOdds.shGoals != null && <span className="bet-slip__leg">2H Goals {shGoalsOU} {shGoalsLine}<em>{Number(mpOdds.shGoals).toFixed(2)}</em></span>}
                            {homeOEPick && mpOdds.homeOE != null && <span className="bet-slip__leg">H O/E {homeOEPick === 'true' ? 'Odd' : 'Even'}<em>{Number(mpOdds.homeOE).toFixed(2)}</em></span>}
                            {awayOEPick && mpOdds.awayOE != null && <span className="bet-slip__leg">A O/E {awayOEPick === 'true' ? 'Odd' : 'Even'}<em>{Number(mpOdds.awayOE).toFixed(2)}</em></span>}
                            {oe1hPick && mpOdds.oe1h != null && <span className="bet-slip__leg">O/E 1H {oe1hPick === 'true' ? 'Odd' : 'Even'}<em>{Number(mpOdds.oe1h).toFixed(2)}</em></span>}
                            {homeTsPick && mpOdds.homeTs != null && <span className="bet-slip__leg">H to Score {homeTsPick === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.homeTs).toFixed(2)}</em></span>}
                            {awayTsPick && mpOdds.awayTs != null && <span className="bet-slip__leg">A to Score {awayTsPick === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.awayTs).toFixed(2)}</em></span>}
                            {wbhHomePick && mpOdds.wbhHome != null && <span className="bet-slip__leg">WBH Home {wbhHomePick === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.wbhHome).toFixed(2)}</em></span>}
                            {wbhAwayPick && mpOdds.wbhAway != null && <span className="bet-slip__leg">WBH Away {wbhAwayPick === 'true' ? 'Yes' : 'No'}<em>{Number(mpOdds.wbhAway).toFixed(2)}</em></span>}
                            {lastScorePick && mpOdds.lastScore != null && <span className="bet-slip__leg">Last to Score {lastScorePick}<em>{Number(mpOdds.lastScore).toFixed(2)}</em></span>}
                            {htftPick && mpOdds.htft != null && <span className="bet-slip__leg">HT/FT {htftPick}<em>{Number(mpOdds.htft).toFixed(2)}</em></span>}
                          </div>
                        </div>
                        {combinedOdds && (
                          <span className="bet-slip__odds">{combinedOdds.toFixed(2)}</span>
                        )}
                      </div>
                      <BetSlipStake amount={amount} setAmount={setAmount} potential={marketPotential} onPlace={placeBet} loading={loading} disabled={!anyMarketSelected} />
                    </div>
                  </div>
                )}
              </>
            )}

          </div>{/* end prediction-form */}
        </section>
      )}

    </div>
  );
}
