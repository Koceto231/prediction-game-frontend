import { useCallback, useEffect, useRef, useState } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import LiveNowSidebar from '../components/LiveNowSidebar';
import QuickStakeModal from '../components/QuickStakeModal';
import QuickBetPanel from '../components/QuickBetPanel';
import { useWallet } from '../context/WalletContext';
import {
  BET_TYPE, WINNER_MAP, OU_LINE_MAP, OU_PICK_MAP, DC_OPTIONS,
  CORNER_LINES, YELLOW_LINES, TEAM_GOAL_LINES,
  EMPTY_FORM as EMPTY, lineToKey, parseScore, fetchOdds, LEAGUE_LIST,
} from './MatchesPage.constants';

// ── Main page ────────────────────────────────────────────────────
export default function MatchesPage() {
  const { refreshBalance } = useWallet();

  const [matches, setMatches]             = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  // Quick Stake modal — opens when the user taps a 1/X/2 odd in a match card
  const [quickStake, setQuickStake] = useState(null);  // { match, pick, odds } | null
  // Default to 'market' so opening a match lands directly on the Main
  // markets tab — the Gridiron Velocity tabs do the switching now and
  // there's no in-between mode picker.
  const [mode, setMode]                   = useState('market');
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
  const [mpOdds, setMpOdds]                     = useState({ winner: null, btts: null, ou: null, dc: null, corners: null, yellows: null, oddEven: null, dnb: null, wtn: null, hcp: null, homeGoals: null, awayGoals: null, ht: null, cs: null, fg: null, btts1h: null, btts2h: null, htGoals: null, shGoals: null, homeOE: null, awayOE: null, oe1h: null, homeTs: null, awayTs: null, wbhHome: null, wbhAway: null, lastScore: null, htft: null });
  const [mpOddsLoading, setMpOddsLoading]       = useState(false);

  // New market pick fields
  const [dcPick, setDCPick]                   = useState('');
  const [cornersLine, setCornersLine]         = useState('');
  const [cornersOU, setCornersOU]             = useState('');
  const [yellowsLine, setYellowsLine]         = useState('');
  const [yellowsOU, setYellowsOU]             = useState('');
  const [scorerPicks, setScorerPicks]         = useState(() => new Set());  // Set<playerId> — multiple goalscorers allowed
  const [scorerPlayers, setScorerPlayers]     = useState([]);
  const [scorerLoading, setScorerLoading]     = useState(false);

  // Phase 1 markets
  const [oddEvenPick, setOddEvenPick]   = useState('');   // '' | 'true' (Odd) | 'false' (Even)
  const [dnbPick, setDnbPick]           = useState('');   // '' | 'Home' | 'Away'
  const [wtnTeam, setWtnTeam]           = useState('');   // '' | 'Home' | 'Away'
  const [wtnYN, setWtnYN]               = useState('');   // '' | 'true' (Yes) | 'false' (No)
  const [hcpPick, setHcpPick]           = useState('');   // '' | 'Home' | 'Draw' | 'Away'
  const [hGoalsLine, setHGoalsLine]     = useState('');   // '' | '0.5' | '1.5' | '2.5'
  const [hGoalsOU, setHGoalsOU]         = useState('');   // '' | 'Over' | 'Under'
  const [aGoalsLine, setAGoalsLine]     = useState('');
  const [aGoalsOU, setAGoalsOU]         = useState('');

  // Phase 2 markets
  const [htPick, setHtPick]             = useState('');   // '' | 'Home' | 'Draw' | 'Away'
  const [csPick, setCsPick]             = useState('');   // '' | 'Home' | 'Away'
  const [csYN, setCsYN]                 = useState('');   // '' | 'true' | 'false'
  const [fgPick, setFgPick]             = useState('');   // '' | 'Home' | 'Draw' | 'Away'

  // Phase 3 markets
  const [btts1hPick, setBtts1hPick]       = useState('');   // '' | 'true' | 'false'
  const [btts2hPick, setBtts2hPick]       = useState('');
  const [htGoalsLine, setHtGoalsLine]     = useState('');   // '' | '0.5' | '1.5' | '2.5'
  const [htGoalsOU, setHtGoalsOU]         = useState('');
  const [shGoalsLine, setShGoalsLine]     = useState('');
  const [shGoalsOU, setShGoalsOU]         = useState('');
  const [homeOEPick, setHomeOEPick]       = useState('');   // '' | 'true' (Odd) | 'false' (Even)
  const [awayOEPick, setAwayOEPick]       = useState('');
  const [oe1hPick, setOe1hPick]           = useState('');
  const [homeTsPick, setHomeTsPick]       = useState('');   // '' | 'true' (Yes) | 'false' (No)
  const [awayTsPick, setAwayTsPick]       = useState('');
  const [wbhHomePick, setWbhHomePick]     = useState('');   // '' | 'true' | 'false'
  const [wbhAwayPick, setWbhAwayPick]     = useState('');
  const [lastScorePick, setLastScorePick] = useState('');   // '' | 'Home' | 'Draw' | 'Away'
  const [htftPick, setHtftPick]           = useState('');   // '' | 'HH' | 'HD' | 'HA' | ...

  // Market table — pre-fetched odds + collapse state
  const [preOdds, setPreOdds]               = useState({});
  const [preOddsLoading, setPreOddsLoading] = useState(false);
  const [cornersPreOdds, setCornersPreOdds] = useState({});
  const [yellowsPreOdds, setYellowsPreOdds] = useState({});
  const INIT_COLLAPSED = { winner: false, dc: false, goals: false, btts: false, corners: true, yellows: true, scorer: true, oddEven: true, dnb: true, wtn: true, hcp: true, homeGoals: true, awayGoals: true, ht: true, cs: true, fg: true, btts1h: true, btts2h: true, htGoals: true, shGoals: true, teamOE: true, oe1h: true, teamTs: true, wbh: true, lastScore: true, htft: true };
  const [collapsed, setCollapsed] = useState(INIT_COLLAPSED);
  const toggleSection = (k) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  // Market category tabs (mockup upgraded_my_bets_overview_4).
  // Same pattern as LivePage — drives [data-cat] CSS filtering on .market-table.
  const [marketCategory, setMarketCategory] = useState('main');
  const MARKET_TABS = [
    { id: 'main',    label: 'Main'    },
    { id: 'goals',   label: 'Goals'   },
    { id: 'halves',  label: 'Halves'  },
    { id: 'corners', label: 'Corners' },
    { id: 'special', label: 'Special' },
  ];

  const panelRef  = useRef(null);
  const aiRef     = useRef(null);
  const aiCache   = useRef({});   // matchId → AIPredictionResponseDTO
  const setField  = useCallback((k, v) => setFields(p => ({ ...p, [k]: v })), []);

  /**
   * Dispatch a pick into the global Bet Slip. Exotic markets pass a
   * pre-built `leg` payload (the exact AccumulatorLegDTO fields minus
   * matchId) plus display `label` / `chip`, so the slip stays generic.
   * `selKey` disambiguates picks that share betType+pick (e.g. two
   * different O/U lines, Corners 8.5 vs 9.5). Pass odds == null to no-op.
   */
  const addToSlip = useCallback((detail) => {
    if (!selectedMatch || detail?.odds == null) return;
    window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
      detail: {
        matchId:     selectedMatch.id,
        fixture:     `${selectedMatch.homeTeamName} vs ${selectedMatch.awayTeamName}`,
        leagueLabel: selectedMatch.leagueName ?? null,
        ...detail,
        odds: Number(detail.odds),
      },
    }));
  }, [selectedMatch]);

  // Mirror slip removals back onto the market grid: when a pick is removed
  // from the Bet Slip (its ×, a conflicting O/U replacing it, clear-all, …)
  // the matching market button here must de-select. Listens for the
  // `bpfl:slip:remove` event the slip emits.
  useEffect(() => {
    const onRemove = (e) => {
      const picks = e.detail?.picks || [];
      for (const { matchId, betType, pick, line, leg } of picks) {
        if (!selectedMatch || matchId !== selectedMatch.id) continue;
        const team = leg?.pick;     // 'Home' | 'Away' for per-team markets
        // Pick-aware clears via functional updaters: only blank the field when
        // it still holds the SELF-SAME selection being removed. This stops a
        // conflict-eviction (e.g. switching Winner Home → Draw evicts Home and
        // emits a remove) from wiping the value we just set to the new pick.
        const bttsLocal = pick === 'Yes' ? 'true' : 'No' === pick ? 'false' : pick;
        switch (betType) {
          case 'Winner':       setFields(p => p.winner === pick ? { ...p, winner: '' } : p); break;
          case 'DoubleChance': setDCPick(v => v === pick ? '' : v); break;
          case 'BTTS':         setFields(p => p.btts === bttsLocal ? { ...p, btts: '' } : p); break;
          case 'DrawNoBet':    setDnbPick(v => v === pick ? '' : v); break;
          case 'Handicap':     setHcpPick(v => v === pick ? '' : v); break;
          case 'HalfTime':     setHtPick(v => v === pick ? '' : v); break;
          case 'FirstGoal':    setFgPick(v => v === pick ? '' : v); break;
          case 'LastToScore':  setLastScorePick(v => v === pick ? '' : v); break;
          case 'HtFt':         setHtftPick(v => v === pick ? '' : v); break;
          case 'OverUnder':
            setFields(p => (p.ouPick === pick && p.ouLine === line) ? { ...p, ouLine: '', ouPick: '' } : p);
            break;
          case 'ExactScore':      setField('homeScore', ''); setField('awayScore', ''); break;
          case 'Corners':         setCornersLine(''); setCornersOU(''); break;
          case 'YellowCards':     setYellowsLine(''); setYellowsOU(''); break;
          case 'OddEven':         setOddEvenPick(''); break;
          case 'CleanSheet':      setCsPick(''); setCsYN(''); break;
          case 'Btts1stHalf':     setBtts1hPick(''); break;
          case 'Btts2ndHalf':     setBtts2hPick(''); break;
          case 'HalfTimeGoals':   setHtGoalsLine(''); setHtGoalsOU(''); break;
          case 'SecondHalfGoals': setShGoalsLine(''); setShGoalsOU(''); break;
          case 'OddEven1stHalf':  setOe1hPick(''); break;
          case 'WinToNil':        setWtnTeam(''); setWtnYN(''); break;
          case 'Goalscorer':
            setScorerPicks(s => {
              const id = Number(pick);
              if (!s.has(id)) return s;
              const n = new Set(s); n.delete(id); return n;
            });
            break;
          case 'TeamGoals':
            if (team === 'Home') { setHGoalsLine(''); setHGoalsOU(''); }
            else                 { setAGoalsLine(''); setAGoalsOU(''); }
            break;
          case 'TeamOddEven':
            if (team === 'Home') setHomeOEPick(''); else setAwayOEPick('');
            break;
          case 'TeamToScore':
            if (team === 'Home') setHomeTsPick(''); else setAwayTsPick('');
            break;
          case 'WinBothHalves':
            if (team === 'Home') setWbhHomePick(''); else setWbhAwayPick('');
            break;
          default: break;
        }
      }
    };
    window.addEventListener('bpfl:slip:remove', onRemove);
    return () => window.removeEventListener('bpfl:slip:remove', onRemove);
  }, [selectedMatch, setField]);

  // Scroll to bet/AI panel whenever a match is selected
  useEffect(() => {
    if (!selectedMatch) return;
    // The list/sidebar hide entirely while a match is open, so scroll the
    // window itself to the top instead of into the panel — this feels like
    // a "new page" instead of a long scroll on the same page.
    const t = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 40);
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
    api.get('/Match/upcoming?take=50')
      .then(r => setMatches(r.data))
      .catch(e => setLoadError(e?.response?.data?.message || 'Failed to load matches.'))
      .finally(() => setPageLoading(false));
  }, []);


  const resetPanel = useCallback(() => {
    setMode('market'); setMarketCategory('main');
    setFields(EMPTY); setAmount(''); setFeedback(null); setAiPrediction(null); setAiError(false);
    setExactOdds(null); exactOddsCache.current.clear();
    setMpOdds({ winner: null, btts: null, ou: null, dc: null, corners: null, yellows: null, oddEven: null, dnb: null, wtn: null, hcp: null, homeGoals: null, awayGoals: null, ht: null, cs: null, fg: null, btts1h: null, btts2h: null, htGoals: null, shGoals: null, homeOE: null, awayOE: null, oe1h: null, homeTs: null, awayTs: null, wbhHome: null, wbhAway: null, lastScore: null, htft: null });
    setDCPick(''); setCornersLine(''); setCornersOU(''); setYellowsLine(''); setYellowsOU('');
    setScorerPicks(new Set()); setScorerPlayers([]);
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

  // Live odds — Exact Score.
  // Cached per "h-a" score (cleared when the match changes) + debounced, so
  // rapid +/- stepping reads instantly from cache and fires at most one
  // request once the user pauses, instead of one round-trip per click.
  const exactOddsCache = useRef(new Map());
  useEffect(() => {
    // NB: don't gate on hasBetOdds — that flag means "1X2 winner odds exist".
    // Exact-score odds are priced independently. Also coerce empty → 0 so the
    // chip matches the stepper, which shows 0 for an unset field (the parsed
    // `home`/`away` are null on an empty input, which used to blank the chip
    // at the default 0:0).
    if (!isExact || !selectedMatch) { setExactOdds(null); return; }
    const h = Math.max(0, Math.min(20, Number(homeScore) || 0));
    const a = Math.max(0, Math.min(20, Number(awayScore) || 0));
    const key = `${h}-${a}`;
    if (exactOddsCache.current.has(key)) {        // instant — no network
      setExactOdds(exactOddsCache.current.get(key));
      setExactOddsLoading(false);
      return;
    }
    let cancelled = false;
    setExactOddsLoading(true);
    const t = setTimeout(() => {
      fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: h, scoreAway: a })
        .then(r => { if (!cancelled) { if (r) exactOddsCache.current.set(key, r); setExactOdds(r); } })
        .finally(() => { if (!cancelled) setExactOddsLoading(false); });
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isExact, selectedMatch?.id, homeScore, awayScore]);

  // Prefetch the common scorelines the moment the Exact Score tab opens, in
  // parallel, into the same cache. By the time the user steps to any of them
  // the price is already there → the CTA odds chip shows with no lag. One-off
  // burst per match; the backend output-caches /Odds so it's cheap.
  useEffect(() => {
    if (!isExact || !selectedMatch) return;
    // Every scoreline up to 4-4 (25 combinations) → instant chip while
    // stepping anywhere in that range.
    const common = [];
    for (let hh = 0; hh <= 4; hh++) for (let aa = 0; aa <= 4; aa++) common.push([hh, aa]);
    let cancelled = false;
    Promise.all(common.map(async ([hh, aa]) => {
      const k = `${hh}-${aa}`;
      if (exactOddsCache.current.has(k)) return;
      const r = await fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: hh, scoreAway: aa });
      if (r) exactOddsCache.current.set(k, r);
    })).then(() => {
      if (cancelled) return;
      // refresh the chip for the currently shown score (empty → 0)
      const ck = `${Number(homeScore) || 0}-${Number(awayScore) || 0}`;
      if (exactOddsCache.current.has(ck)) setExactOdds(exactOddsCache.current.get(ck));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExact, selectedMatch?.id]);

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

  // Live odds — Odd/Even
  useEffect(() => {
    if (!isMarket || !oddEvenPick) { setMpOdds(p => ({ ...p, oddEven: null })); return; }
    setMpOdds(p => ({ ...p, oddEven: preOdds.oddEven?.[oddEvenPick] ?? null }));
  }, [isMarket, selectedMatch?.id, oddEvenPick, preOdds]);

  // Live odds — Draw No Bet
  useEffect(() => {
    if (!isMarket || !dnbPick) { setMpOdds(p => ({ ...p, dnb: null })); return; }
    setMpOdds(p => ({ ...p, dnb: preOdds.dnb?.[dnbPick] ?? null }));
  }, [isMarket, selectedMatch?.id, dnbPick, preOdds]);

  // Live odds — Win to Nil
  useEffect(() => {
    if (!isMarket || !wtnTeam || !wtnYN) { setMpOdds(p => ({ ...p, wtn: null })); return; }
    setMpOdds(p => ({ ...p, wtn: preOdds.wtn?.[wtnTeam]?.[wtnYN] ?? null }));
  }, [isMarket, selectedMatch?.id, wtnTeam, wtnYN, preOdds]);

  // Live odds — Handicap
  useEffect(() => {
    if (!isMarket || !hcpPick) { setMpOdds(p => ({ ...p, hcp: null })); return; }
    setMpOdds(p => ({ ...p, hcp: preOdds.hcp?.[hcpPick] ?? null }));
  }, [isMarket, selectedMatch?.id, hcpPick, preOdds]);

  // Live odds — Home Team Goals
  useEffect(() => {
    if (!isMarket || !hGoalsLine || !hGoalsOU) { setMpOdds(p => ({ ...p, homeGoals: null })); return; }
    setMpOdds(p => ({ ...p, homeGoals: preOdds.homeGoals?.[hGoalsLine]?.[hGoalsOU] ?? null }));
  }, [isMarket, selectedMatch?.id, hGoalsLine, hGoalsOU, preOdds]);

  // Live odds — Away Team Goals
  useEffect(() => {
    if (!isMarket || !aGoalsLine || !aGoalsOU) { setMpOdds(p => ({ ...p, awayGoals: null })); return; }
    setMpOdds(p => ({ ...p, awayGoals: preOdds.awayGoals?.[aGoalsLine]?.[aGoalsOU] ?? null }));
  }, [isMarket, selectedMatch?.id, aGoalsLine, aGoalsOU, preOdds]);

  // Live odds — Half Time
  useEffect(() => {
    if (!isMarket || !htPick) { setMpOdds(p => ({ ...p, ht: null })); return; }
    setMpOdds(p => ({ ...p, ht: preOdds.ht?.[htPick] ?? null }));
  }, [isMarket, selectedMatch?.id, htPick, preOdds]);

  // Live odds — Clean Sheet
  useEffect(() => {
    if (!isMarket || !csPick || !csYN) { setMpOdds(p => ({ ...p, cs: null })); return; }
    setMpOdds(p => ({ ...p, cs: preOdds.cs?.[csPick]?.[csYN] ?? null }));
  }, [isMarket, selectedMatch?.id, csPick, csYN, preOdds]);

  // Live odds — First Goal
  useEffect(() => {
    if (!isMarket || !fgPick) { setMpOdds(p => ({ ...p, fg: null })); return; }
    setMpOdds(p => ({ ...p, fg: preOdds.fg?.[fgPick] ?? null }));
  }, [isMarket, selectedMatch?.id, fgPick, preOdds]);

  // Live odds — BTTS 1st Half
  useEffect(() => {
    if (!isMarket || !btts1hPick) { setMpOdds(p => ({ ...p, btts1h: null })); return; }
    setMpOdds(p => ({ ...p, btts1h: preOdds.btts1h?.[btts1hPick] ?? null }));
  }, [isMarket, selectedMatch?.id, btts1hPick, preOdds]);

  // Live odds — BTTS 2nd Half
  useEffect(() => {
    if (!isMarket || !btts2hPick) { setMpOdds(p => ({ ...p, btts2h: null })); return; }
    setMpOdds(p => ({ ...p, btts2h: preOdds.btts2h?.[btts2hPick] ?? null }));
  }, [isMarket, selectedMatch?.id, btts2hPick, preOdds]);

  // Live odds — 1st Half Goals O/U
  useEffect(() => {
    if (!isMarket || !htGoalsLine || !htGoalsOU) { setMpOdds(p => ({ ...p, htGoals: null })); return; }
    setMpOdds(p => ({ ...p, htGoals: preOdds.htGoals?.[htGoalsLine]?.[htGoalsOU] ?? null }));
  }, [isMarket, selectedMatch?.id, htGoalsLine, htGoalsOU, preOdds]);

  // Live odds — 2nd Half Goals O/U
  useEffect(() => {
    if (!isMarket || !shGoalsLine || !shGoalsOU) { setMpOdds(p => ({ ...p, shGoals: null })); return; }
    setMpOdds(p => ({ ...p, shGoals: preOdds.shGoals?.[shGoalsLine]?.[shGoalsOU] ?? null }));
  }, [isMarket, selectedMatch?.id, shGoalsLine, shGoalsOU, preOdds]);

  // Live odds — Home Team Odd/Even
  useEffect(() => {
    if (!isMarket || !homeOEPick) { setMpOdds(p => ({ ...p, homeOE: null })); return; }
    setMpOdds(p => ({ ...p, homeOE: preOdds.homeOE?.[homeOEPick] ?? null }));
  }, [isMarket, selectedMatch?.id, homeOEPick, preOdds]);

  // Live odds — Away Team Odd/Even
  useEffect(() => {
    if (!isMarket || !awayOEPick) { setMpOdds(p => ({ ...p, awayOE: null })); return; }
    setMpOdds(p => ({ ...p, awayOE: preOdds.awayOE?.[awayOEPick] ?? null }));
  }, [isMarket, selectedMatch?.id, awayOEPick, preOdds]);

  // Live odds — Odd/Even 1st Half
  useEffect(() => {
    if (!isMarket || !oe1hPick) { setMpOdds(p => ({ ...p, oe1h: null })); return; }
    setMpOdds(p => ({ ...p, oe1h: preOdds.oe1h?.[oe1hPick] ?? null }));
  }, [isMarket, selectedMatch?.id, oe1hPick, preOdds]);

  // Live odds — Home Team to Score
  useEffect(() => {
    if (!isMarket || !homeTsPick) { setMpOdds(p => ({ ...p, homeTs: null })); return; }
    setMpOdds(p => ({ ...p, homeTs: preOdds.homeTs?.[homeTsPick] ?? null }));
  }, [isMarket, selectedMatch?.id, homeTsPick, preOdds]);

  // Live odds — Away Team to Score
  useEffect(() => {
    if (!isMarket || !awayTsPick) { setMpOdds(p => ({ ...p, awayTs: null })); return; }
    setMpOdds(p => ({ ...p, awayTs: preOdds.awayTs?.[awayTsPick] ?? null }));
  }, [isMarket, selectedMatch?.id, awayTsPick, preOdds]);

  // Live odds — Win Both Halves (Home)
  useEffect(() => {
    if (!isMarket || !wbhHomePick) { setMpOdds(p => ({ ...p, wbhHome: null })); return; }
    setMpOdds(p => ({ ...p, wbhHome: preOdds.wbh?.Home?.[wbhHomePick] ?? null }));
  }, [isMarket, selectedMatch?.id, wbhHomePick, preOdds]);

  // Live odds — Win Both Halves (Away)
  useEffect(() => {
    if (!isMarket || !wbhAwayPick) { setMpOdds(p => ({ ...p, wbhAway: null })); return; }
    setMpOdds(p => ({ ...p, wbhAway: preOdds.wbh?.Away?.[wbhAwayPick] ?? null }));
  }, [isMarket, selectedMatch?.id, wbhAwayPick, preOdds]);

  // Live odds — Last Team to Score
  useEffect(() => {
    if (!isMarket || !lastScorePick) { setMpOdds(p => ({ ...p, lastScore: null })); return; }
    setMpOdds(p => ({ ...p, lastScore: preOdds.lastScore?.[lastScorePick] ?? null }));
  }, [isMarket, selectedMatch?.id, lastScorePick, preOdds]);

  // Live odds — HT/FT
  useEffect(() => {
    if (!isMarket || !htftPick) { setMpOdds(p => ({ ...p, htft: null })); return; }
    setMpOdds(p => ({ ...p, htft: preOdds.htft?.[htftPick] ?? null }));
  }, [isMarket, selectedMatch?.id, htftPick, preOdds]);


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
      oddEven: { true: m.oddGoals ?? null, false: m.evenGoals ?? null },
      dnb:     { Home: m.dnbHome ?? null, Away: m.dnbAway ?? null },
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
      // Phase 3
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
      htft:      (() => { try { return m.htFtOddsJson ? JSON.parse(m.htFtOddsJson) : {}; } catch { return {}; } })(),
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
    winner                       ? mpOdds.winner    : null,
    btts                         ? mpOdds.btts      : null,
    (ouLine && ouPick)           ? mpOdds.ou        : null,
    dcPick                       ? mpOdds.dc        : null,
    (cornersLine && cornersOU)   ? mpOdds.corners   : null,
    (yellowsLine && yellowsOU)   ? mpOdds.yellows   : null,
    null, /* goalscorers flow through the global slip, not this aggregate */
    oddEvenPick                  ? mpOdds.oddEven   : null,
    dnbPick                      ? mpOdds.dnb       : null,
    (wtnTeam && wtnYN)           ? mpOdds.wtn       : null,
    hcpPick                      ? mpOdds.hcp       : null,
    (hGoalsLine && hGoalsOU)     ? mpOdds.homeGoals : null,
    (aGoalsLine && aGoalsOU)     ? mpOdds.awayGoals : null,
    htPick                       ? mpOdds.ht        : null,
    (csPick && csYN)             ? mpOdds.cs        : null,
    fgPick                       ? mpOdds.fg        : null,
    btts1hPick                   ? mpOdds.btts1h    : null,
    btts2hPick                   ? mpOdds.btts2h    : null,
    (htGoalsLine && htGoalsOU)   ? mpOdds.htGoals   : null,
    (shGoalsLine && shGoalsOU)   ? mpOdds.shGoals   : null,
    homeOEPick                   ? mpOdds.homeOE    : null,
    awayOEPick                   ? mpOdds.awayOE    : null,
    oe1hPick                     ? mpOdds.oe1h      : null,
    homeTsPick                   ? mpOdds.homeTs    : null,
    awayTsPick                   ? mpOdds.awayTs    : null,
    wbhHomePick                  ? mpOdds.wbhHome   : null,
    wbhAwayPick                  ? mpOdds.wbhAway   : null,
    lastScorePick                ? mpOdds.lastScore : null,
    htftPick                     ? mpOdds.htft      : null,
  ].filter(v => v != null && Number(v) > 0);

  const combinedOdds    = allSelectedOdds.length ? allSelectedOdds.reduce((a, o) => a * Number(o), 1) : null;
  const betAmt          = Number(amount);
  const exactPotential  = exactOdds && betAmt > 0 ? betAmt * Number(exactOdds.odds) : null;
  const marketPotential = combinedOdds && betAmt > 0 ? betAmt * combinedOdds : null;

  const anyMarketSelected = winner || btts || (ouLine && ouPick) || dcPick ||
    (cornersLine && cornersOU) || (yellowsLine && yellowsOU) || scorerPicks.size > 0 ||
    oddEvenPick || dnbPick || (wtnTeam && wtnYN) || hcpPick ||
    (hGoalsLine && hGoalsOU) || (aGoalsLine && aGoalsOU) ||
    htPick || (csPick && csYN) || fgPick ||
    btts1hPick || btts2hPick || (htGoalsLine && htGoalsOU) || (shGoalsLine && shGoalsOU) ||
    homeOEPick || awayOEPick || oe1hPick || homeTsPick || awayTsPick ||
    wbhHomePick || wbhAwayPick || lastScorePick || htftPick;


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

      const idemKey = newIdempotencyKey();
      const idemCfg = { headers: { 'X-Idempotency-Key': idemKey } };
      let betPlaced = false;
      if (betAmt > 0 && hasBetOdds) {
        if (isExact && home !== null && away !== null) {
          await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.ExactScore, scoreHome: home, scoreAway: away, amount: betAmt }, idemCfg);
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
          for (const goalscorerId of scorerPicks)
            legs.push({ betType: BET_TYPE.Goalscorer, goalscorerId });
          if (oddEvenPick && mpOdds.oddEven != null)
            legs.push({ betType: BET_TYPE.OddEven, bTTSPick: oddEvenPick === 'true' });
          if (dnbPick && mpOdds.dnb != null)
            legs.push({ betType: BET_TYPE.DrawNoBet, pick: dnbPick });
          if (wtnTeam && wtnYN && mpOdds.wtn != null)
            legs.push({ betType: BET_TYPE.WinToNil, pick: wtnTeam, bTTSPick: wtnYN === 'true' });
          if (hcpPick && mpOdds.hcp != null)
            legs.push({ betType: BET_TYPE.Handicap, pick: hcpPick, lineValue: Number(preOdds.hcp?.line ?? 0) });
          if (hGoalsLine && hGoalsOU && mpOdds.homeGoals != null)
            legs.push({ betType: BET_TYPE.TeamGoals, pick: 'Home', lineValue: Number(hGoalsLine), oUPick: hGoalsOU });
          if (aGoalsLine && aGoalsOU && mpOdds.awayGoals != null)
            legs.push({ betType: BET_TYPE.TeamGoals, pick: 'Away', lineValue: Number(aGoalsLine), oUPick: aGoalsOU });
          if (htPick && mpOdds.ht != null)
            legs.push({ betType: BET_TYPE.HalfTime, pick: htPick });
          if (csPick && csYN && mpOdds.cs != null)
            legs.push({ betType: BET_TYPE.CleanSheet, pick: csPick, bTTSPick: csYN === 'true' });
          if (fgPick && mpOdds.fg != null)
            legs.push({ betType: BET_TYPE.FirstGoal, pick: fgPick === 'Draw' ? 'Draw' : fgPick });
          if (btts1hPick && mpOdds.btts1h != null)
            legs.push({ betType: BET_TYPE.Btts1stHalf, bTTSPick: btts1hPick === 'true' });
          if (btts2hPick && mpOdds.btts2h != null)
            legs.push({ betType: BET_TYPE.Btts2ndHalf, bTTSPick: btts2hPick === 'true' });
          if (htGoalsLine && htGoalsOU && mpOdds.htGoals != null)
            legs.push({ betType: BET_TYPE.HalfTimeGoals, oULine: lineToKey(htGoalsLine), oUPick: htGoalsOU });
          if (shGoalsLine && shGoalsOU && mpOdds.shGoals != null)
            legs.push({ betType: BET_TYPE.SecondHalfGoals, oULine: lineToKey(shGoalsLine), oUPick: shGoalsOU });
          if (homeOEPick && mpOdds.homeOE != null)
            legs.push({ betType: BET_TYPE.TeamOddEven, pick: 'Home', bTTSPick: homeOEPick === 'true' });
          if (awayOEPick && mpOdds.awayOE != null)
            legs.push({ betType: BET_TYPE.TeamOddEven, pick: 'Away', bTTSPick: awayOEPick === 'true' });
          if (oe1hPick && mpOdds.oe1h != null)
            legs.push({ betType: BET_TYPE.OddEven1stHalf, bTTSPick: oe1hPick === 'true' });
          if (homeTsPick && mpOdds.homeTs != null)
            legs.push({ betType: BET_TYPE.TeamToScore, pick: 'Home', bTTSPick: homeTsPick === 'true' });
          if (awayTsPick && mpOdds.awayTs != null)
            legs.push({ betType: BET_TYPE.TeamToScore, pick: 'Away', bTTSPick: awayTsPick === 'true' });
          if (wbhHomePick && mpOdds.wbhHome != null)
            legs.push({ betType: BET_TYPE.WinBothHalves, pick: 'Home', bTTSPick: wbhHomePick === 'true' });
          if (wbhAwayPick && mpOdds.wbhAway != null)
            legs.push({ betType: BET_TYPE.WinBothHalves, pick: 'Away', bTTSPick: wbhAwayPick === 'true' });
          if (lastScorePick && mpOdds.lastScore != null)
            legs.push({ betType: BET_TYPE.LastToScore, pick: lastScorePick });
          if (htftPick && mpOdds.htft != null)
            legs.push({ betType: BET_TYPE.HtFt, stringPick: htftPick });

          if (legs.length === 1) {
            // Single market — use normal endpoint
            const leg = legs[0];
            await api.post('/Bet', { matchId: selectedMatch.id, ...leg, amount: betAmt }, idemCfg);
            betPlaced = true;
          } else if (legs.length > 1) {
            // Multi-market — accumulator endpoint
            await api.post('/Bet/accumulator', { matchId: selectedMatch.id, legs, amount: betAmt }, idemCfg);
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

  // ── Accumulator conflict prevention ────────────────────────────
  const groupAPicked =
       (winner       ? 'Match Result'      : null)
    || (dcPick       ? 'Double Chance'     : null)
    || (dnbPick      ? 'Draw No Bet'       : null)
    || (htftPick     ? 'HT/FT'             : null)
    || (wtnTeam      ? 'Win to Nil'        : null)
    || (wbhHomePick || wbhAwayPick ? 'Win Both Halves' : null)
    || (hcpPick      ? 'Handicap'          : null);
  const groupBPicked =
       (htPick       ? 'Half-time Result'  : null)
    || (htftPick     ? 'HT/FT'             : null);
  const dis = {
    winner: groupAPicked && !winner,
    dc:     groupAPicked && !dcPick,
    dnb:    groupAPicked && !dnbPick,
    htft:   (groupAPicked && !htftPick) || (groupBPicked && !htftPick),
    wtn:    groupAPicked && !wtnTeam,
    wbh:    groupAPicked && !(wbhHomePick || wbhAwayPick),
    hcp:    groupAPicked && !hcpPick,
    ht:     groupBPicked && !htPick,
  };
  const LiveLock = ({ reason }) => (
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8, fontStyle: 'italic' }}>
      🔒 {reason}
    </span>
  );

  // ── Render ────────────────────────────────────────────────────
  const filteredMatches = selectedLeague
    ? matches.filter(m => m.leagueCode === selectedLeague)
    : matches;

  return (
    <div className={`gvm-page${selectedMatch ? ' gvm-page--detail-open' : ''}`}>

      {/* Main column (8/12): heading + filter pills + matches list.
          When a match is selected, this whole column hides so the detail
          panel below renders as a full-width "page". */}
      <div className="gvm-page__main">
        <div className="gvm-page__head">
          <h2 className="gvm-page__title">Upcoming Matches</h2>
          <div className="gvm-page__filters">
            {LEAGUE_LIST.map(({ code, label }) => (
              <button
                key={code ?? 'all'}
                type="button"
                className={`gvm-filter-pill${selectedLeague === code ? ' gvm-filter-pill--active' : ''}`}
                onClick={() => { setSelectedLeague(code); setSelectedMatch(null); resetPanel(); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Match list */}
        {loadError && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}
        {!pageLoading && !filteredMatches.length && !loadError && <div className="empty-box">No upcoming matches found.</div>}
        <div className="gvm-list">
          {filteredMatches.length > 0 && (
            <div className="matches-table-head" style={{ display: 'none' }}>
              <span>TIME</span>
              <span>FIXTURE</span>
              <span style={{ textAlign: 'center' }}>1</span>
              <span style={{ textAlign: 'center' }}>X</span>
              <span style={{ textAlign: 'center' }}>2</span>
            </div>
          )}
          {filteredMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              selected={selectedMatch?.id === match.id}
              onSelect={() => {
                if (selectedMatch?.id === match.id) { setSelectedMatch(null); resetPanel(); }
                else { setSelectedMatch(match); resetPanel(); }
              }}
              /* odd clicks dispatch to the global Bet Slip panel via
                 `bpfl:slip:add` — see BetSlipPanel.jsx mounted in App.jsx. */
            />
          ))}
        </div>

      {/* Bet + prediction panel */}
      {selectedMatch && (
        <section className="shell-card panel" ref={panelRef} style={{ scrollMarginTop: 64 }}>

          {/* ── Match Detail HERO — Gridiron Velocity style ───────────── */}
          <div className="gvmd-hero">
            <button
              type="button"
              className="gvmd-hero__back"
              onClick={() => { setSelectedMatch(null); resetPanel(); }}
              aria-label="All matches"
              title="All matches"
            >←</button>

            <div className="gvmd-hero__row">
              {/* HOME shield + name */}
              <div className="gvmd-hero__team">
                <div className="gvmd-hero__shield gvmd-hero__shield--home">
                  {selectedMatch.homeTeamLogo
                    ? <img src={selectedMatch.homeTeamLogo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <span className="gvmd-hero__shield-fallback">
                        {selectedMatch.homeTeamName?.split(/\s+/).filter(w => !/^(FC|CF|AC|SC|AFC)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}
                      </span>}
                </div>
                <div className="gvmd-hero__teamname">{selectedMatch.homeTeamName}</div>
              </div>

              {/* CENTER — time + date only. Venue moves to its own row
                  below so it doesn't squeeze the team columns on mobile. */}
              <div className="gvmd-hero__center">
                <div className="gvmd-hero__time">
                  {new Date(selectedMatch.matchDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="gvmd-hero__date">
                  {new Date(selectedMatch.matchDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
                </div>
              </div>

              {/* AWAY shield + name */}
              <div className="gvmd-hero__team">
                <div className="gvmd-hero__shield">
                  {selectedMatch.awayTeamLogo
                    ? <img src={selectedMatch.awayTeamLogo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <span className="gvmd-hero__shield-fallback">
                        {selectedMatch.awayTeamName?.split(/\s+/).filter(w => !/^(FC|CF|AC|SC|AFC)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}
                      </span>}
                </div>
                <div className="gvmd-hero__teamname">{selectedMatch.awayTeamName}</div>
              </div>
            </div>

            {/* Venue line — sits BELOW the team row so it can span the full
                width on mobile without squeezing the team names. */}
            {selectedMatch.venueName && (
              <div className="gvmd-hero__venue">
                📍 {selectedMatch.venueName.toUpperCase()}{selectedMatch.venueCity ? ` · ${selectedMatch.venueCity}` : ''}
              </div>
            )}
          </div>

          {/* AI Prediction card removed per request. */}

          {/* ── Top-level market tabs (Gridiron Velocity match detail) ──
              Replaces the old Exact / Market mode picker. Clicking a tab
              sets the active section directly:
                • "Exact Score" → mode='exact'  → score-tile grid
                • all others   → mode='market' + marketCategory=<id>
              Stays in sync with the existing isExact/isMarket state so the
              old market-section JSX keeps working untouched. */}
          <div className="gvmd-tabs">
            <button
              type="button"
              className={`gvmd-tab${marketCategory === 'main' && !isExact ? ' gvmd-tab--active' : ''}`}
              onClick={() => { setMode('market'); setMarketCategory('main'); setFields(EMPTY); }}
            >Main</button>
            <button
              type="button"
              className={`gvmd-tab${isExact ? ' gvmd-tab--active' : ''}`}
              onClick={() => { setMode('exact'); }}
            >Exact Score</button>
            {['goals', 'halves', 'corners', 'special'].map(cat => (
              <button
                key={cat}
                type="button"
                className={`gvmd-tab${marketCategory === cat && !isExact ? ' gvmd-tab--active' : ''}`}
                onClick={() => { setMode('market'); setMarketCategory(cat); setFields(EMPTY); }}
              >{cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
            ))}
          </div>

          <div className="prediction-form">

            {/* ── Exact Score ── */}
            {isExact && (
              <>
                {/* The legacy "EXACT SCORE — 5 PTS" header + "Change type"
                    button are hidden because the top-level Gridiron Velocity
                    tabs above already let the user switch sections. */}

                {/* Score stepper — two per-team +/- counters, then one CTA
                    that fetches the price and adds the exact score to the
                    global Bet Slip. */}
                {(() => {
                  const h = Math.max(0, Math.min(20, Number(homeScore) || 0));
                  const a = Math.max(0, Math.min(20, Number(awayScore) || 0));
                  const stepH = (d) => setField('homeScore', String(Math.max(0, Math.min(20, h + d))));
                  const stepA = (d) => setField('awayScore', String(Math.max(0, Math.min(20, a + d))));
                  const addExact = async () => {
                    try {
                      const ck = `${h}-${a}`;
                      // Reuse the odds the live effect already fetched/cached for
                      // this score — avoids a second round-trip before the pick
                      // lands in the slip. Only hit the network on a cache miss.
                      let r = exactOddsCache.current.get(ck)
                        || (exactOdds?.odds != null ? exactOdds : null);
                      if (r?.odds == null) {
                        r = await fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: h, scoreAway: a });
                        if (r) exactOddsCache.current.set(ck, r);
                      }
                      if (r?.odds != null) {
                        window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
                          detail: {
                            matchId:     selectedMatch.id,
                            betType:     'ExactScore',
                            pick:        `${h}-${a}`,
                            scoreHome:   h,
                            scoreAway:   a,
                            odds:        Number(r.odds),
                            fixture:     `${selectedMatch.homeTeamName} vs ${selectedMatch.awayTeamName}`,
                            leagueLabel: selectedMatch.leagueName ?? null,
                          },
                        }));
                      }
                    } catch { /* offline / 404 → no-op */ }
                  };
                  return (
                    <div className="es-stepper">
                      <div className="es-stepper__teams">
                        {[
                          { name: selectedMatch.homeTeamName, logo: selectedMatch.homeTeamLogo, val: h, step: stepH },
                          { name: selectedMatch.awayTeamName, logo: selectedMatch.awayTeamLogo, val: a, step: stepA },
                        ].map((t, i) => (
                          <div className="es-stepper__team" key={i}>
                            <div className="es-stepper__name">
                              {t.logo && <img src={t.logo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                              <span>{t.name}</span>
                            </div>
                            <div className="es-stepper__counter">
                              <button type="button" className="es-stepper__btn" onClick={() => t.step(-1)} aria-label="−">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
                              </button>
                              <span className="es-stepper__val">{t.val}</span>
                              <button type="button" className="es-stepper__btn" onClick={() => t.step(+1)} aria-label="+">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button type="button" className="es-stepper__cta" onClick={addExact}>
                        Добави {h}:{a}
                        {exactOdds?.odds != null && <span className="es-stepper__cta-odds">{Number(exactOdds.odds).toFixed(2)}</span>}
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── Market Pick ── */}
            {isMarket && (
              <>
                {/* Legacy mode-card + nested market-tabs are hidden — the
                    top-level .gvmd-tabs above already drives both mode and
                    marketCategory. */}

                <div className="market-table" data-cat={marketCategory}>

                  {/* Match Result */}
                  <div data-cat="main" className={`market-section ${collapsed.winner ? 'market-section--collapsed' : ''}${dis.winner ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.winner && toggleSection('winner')} style={dis.winner ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">Match Result</span>
                      {dis.winner && <LiveLock reason={`${groupAPicked} already picked`} />}
                      <span className="market-section__toggle">{!dis.winner && (collapsed.winner ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.winner && !dis.winner && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName, odds: selectedMatch.homeOdds },
                          { key: 'Draw', label: 'Draw',                    odds: selectedMatch.drawOdds  },
                          { key: 'Away', label: selectedMatch.awayTeamName, odds: selectedMatch.awayOdds  },
                        ].map(({ key, label, odds }) => (
                          <button key={key} type="button"
                            className={`market-option ${winner === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              setField('winner', winner === key ? '' : key);
                              // Always dispatch (even on toggle-off): the slip's
                              // onAdd adds a new pick or toggles an existing one
                              // off, so de-selecting here also removes it there.
                              if (odds != null) addToSlip({ betType: BET_TYPE.Winner, pick: key, odds });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{odds != null ? Number(odds).toFixed(2) : '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Double Chance */}
                  <div data-cat="main" className={`market-section ${collapsed.dc ? 'market-section--collapsed' : ''}${dis.dc ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.dc && toggleSection('dc')} style={dis.dc ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">Double Chance</span>
                      {dis.dc && <LiveLock reason={`${groupAPicked} already picked`} />}
                      <span className="market-section__toggle">{!dis.dc && (collapsed.dc ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.dc && !dis.dc && (
                      <div className="market-options market-options--3">
                        {DC_OPTIONS.map(({ key }) => {
                          const [a, b] = key === 'HomeOrDraw' ? [selectedMatch.homeTeamName, 'Draw']
                                       : key === 'DrawOrAway' ? ['Draw', selectedMatch.awayTeamName]
                                       : [selectedMatch.homeTeamName, selectedMatch.awayTeamName];
                          const dcOdds = preOdds.dc?.[key];
                          return (
                            <button key={key} type="button"
                              className={`market-option market-option--htft ${dcPick === key ? 'market-option--active' : ''}`}
                              title={`${a} or ${b}`}
                              onClick={() => {
                                setDCPick(dcPick === key ? '' : key);
                                // Always dispatch — slip adds or toggles off.
                                if (dcOdds != null) addToSlip({ betType: BET_TYPE.DoubleChance, pick: key, odds: dcOdds });
                              }}>
                              <div className="market-option__label htft-stack">
                                <span className="htft-stack__line">{a}</span>
                                <span className="htft-stack__sep">or</span>
                                <span className="htft-stack__line">{b}</span>
                              </div>
                              <div className="market-option__odds">
                                {dcOdds != null ? Number(dcOdds).toFixed(2) : preOddsLoading ? '…' : '—'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Goals O/U */}
                  <div data-cat="goals" className={`market-section ${collapsed.goals ? 'market-section--collapsed' : ''}`}>
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
                            {['Over', 'Under'].map(pick => {
                              const ouOdds = preOdds.ou?.[line]?.[pick];
                              return (
                                <button key={pick} type="button"
                                  className={`ou-cell ${ouLine === line && ouPick === pick ? 'ou-cell--active' : ''}`}
                                  onClick={() => {
                                    const isToggleOff = ouLine === line && ouPick === pick;
                                    if (isToggleOff) { setField('ouLine', ''); setField('ouPick', ''); }
                                    else             { setField('ouLine', line); setField('ouPick', pick); }
                                    // Always dispatch — slip adds or toggles off this exact line.
                                    if (ouOdds != null) addToSlip({ betType: BET_TYPE.OverUnder, pick, line, odds: ouOdds });
                                  }}>
                                  {ouOdds != null ? Number(ouOdds).toFixed(2) : preOddsLoading ? '…' : '—'}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BTTS */}
                  <div data-cat="main" className={`market-section ${collapsed.btts ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts')}>
                      <span className="market-section__name">Both Teams to Score</span>
                      {btts && <span className="market-section__badge">{btts === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => {
                          const bttsOdds = preOdds.btts?.[val];
                          return (
                            <button key={val} type="button"
                              className={`market-option ${btts === val ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setField('btts', btts === val ? '' : val);
                                // Always dispatch — slip adds or toggles off.
                                if (bttsOdds != null) addToSlip({ betType: BET_TYPE.BTTS, pick: val === 'true' ? 'Yes' : 'No', odds: bttsOdds });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">
                                {bttsOdds != null ? Number(bttsOdds).toFixed(2) : preOddsLoading ? '…' : '—'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Corners */}
                  <div data-cat="corners" className={`market-section ${collapsed.corners ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('corners')}>
                      <span className="market-section__name">⌐ Corners — Over / Under</span>
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
                                  else {
                                    setCornersLine(String(l)); setCornersOU(pick);
                                    addToSlip({
                                      betType: BET_TYPE.Corners, pick, selKey: `COR-${l}`,
                                      odds: cornersPreOdds[l]?.[pick],
                                      leg: { lineValue: Number(l), oUPick: pick },
                                      label: `Корнери ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                      chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                    });
                                  }
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
                  <div data-cat="special" className={`market-section ${collapsed.yellows ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('yellows')}>
                      <span className="market-section__name">▬ Yellow Cards — Over / Under</span>
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
                                  else {
                                    setYellowsLine(String(l)); setYellowsOU(pick);
                                    addToSlip({
                                      betType: BET_TYPE.YellowCards, pick, selKey: `YC-${l}`,
                                      odds: yellowsPreOdds[l]?.[pick],
                                      leg: { lineValue: Number(l), oUPick: pick },
                                      label: `Жълти картони ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                      chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                    });
                                  }
                                }}>
                                {yellowsPreOdds[l]?.[pick] != null ? Number(yellowsPreOdds[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Odd / Even Goals */}
                  <div data-cat="goals" className={`market-section ${collapsed.oddEven ? 'market-section--collapsed' : ''}`}>
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
                            onClick={() => {
                              const next = oddEvenPick === val ? '' : val;
                              setOddEvenPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.OddEven, pick: val === 'true' ? 'Odd' : 'Even',
                                odds: preOdds.oddEven?.[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `Голове — ${val === 'true' ? 'Нечетен' : 'Четен'}`,
                                chip: val === 'true' ? 'НЕЧ' : 'ЧЕТ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {preOdds.oddEven?.[val] != null ? Number(preOdds.oddEven[val]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Draw No Bet */}
                  <div data-cat="main" className={`market-section ${collapsed.dnb ? 'market-section--collapsed' : ''}${dis.dnb ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.dnb && toggleSection('dnb')} style={dis.dnb ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">⊖ Draw No Bet</span>
                      {dis.dnb ? <LiveLock reason={`${groupAPicked} already picked`} /> : dnbPick && <span className="market-section__badge">{dnbPick === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName}</span>}
                      <span className="market-section__toggle">{!dis.dnb && (collapsed.dnb ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.dnb && !dis.dnb && (
                      <>
                        <div className="muted-text" style={{ fontSize: '0.74rem', padding: '4px 16px 0' }}>If the match ends in a draw, the bet is voided and stake returned.</div>
                        <div className="market-options market-options--2">
                          {[{ val: 'Home', lbl: selectedMatch.homeTeamName }, { val: 'Away', lbl: selectedMatch.awayTeamName }].map(({ val, lbl }) => (
                            <button key={val} type="button"
                              className={`market-option ${dnbPick === val ? 'market-option--active' : ''}`}
                              onClick={() => {
                                const next = dnbPick === val ? '' : val;
                                setDnbPick(next);
                                if (next) addToSlip({
                                  betType: BET_TYPE.DrawNoBet, pick: val,
                                  odds: preOdds.dnb?.[val],
                                  leg: { pick: val },
                                  label: `Без равен — ${lbl}`,
                                  chip: val === 'Home' ? '1' : '2',
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">
                                {preOdds.dnb?.[val] != null ? Number(preOdds.dnb[val]).toFixed(2) : '—'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Win to Nil */}
                  <div data-cat="special" className={`market-section ${collapsed.wtn ? 'market-section--collapsed' : ''}${dis.wtn ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.wtn && toggleSection('wtn')} style={dis.wtn ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">⊘ Win to Nil</span>
                      {dis.wtn ? <LiveLock reason={`${groupAPicked} already picked`} /> : wtnTeam && wtnYN && <span className="market-section__badge">{wtnTeam === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName} {wtnYN === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{!dis.wtn && (collapsed.wtn ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.wtn && !dis.wtn && (
                      <div style={{ padding: '0 16px 12px' }}>
                        <div className="muted-text" style={{ fontSize: '0.74rem', marginBottom: 8 }}>Team wins AND concedes 0 goals.</div>
                        {[{ val: 'Home', lbl: selectedMatch.homeTeamName }, { val: 'Away', lbl: selectedMatch.awayTeamName }].map(({ val, lbl }) => (
                          <div key={val} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{lbl}</div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${wtnTeam === val && wtnYN === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    if (wtnTeam === val && wtnYN === yn) { setWtnTeam(''); setWtnYN(''); }
                                    else {
                                      setWtnTeam(val); setWtnYN(yn);
                                      addToSlip({
                                        betType: BET_TYPE.WinToNil, pick: val, selKey: `WTN-${val}`,
                                        odds: preOdds.wtn?.[val]?.[yn],
                                        leg: { pick: val, bTTSPick: yn === 'true' },
                                        label: `Победа на нула — ${lbl} ${yn === 'true' ? 'Да' : 'Не'}`,
                                        chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                      });
                                    }
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {preOdds.wtn?.[val]?.[yn] != null ? Number(preOdds.wtn[val][yn]).toFixed(2) : '—'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Handicap */}
                  <div data-cat="special" className={`market-section ${collapsed.hcp ? 'market-section--collapsed' : ''}${dis.hcp ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.hcp && toggleSection('hcp')} style={dis.hcp ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">± Handicap {preOdds.hcp?.line ? `(${preOdds.hcp.line})` : '(-1)'}</span>
                      {dis.hcp ? <LiveLock reason={`${groupAPicked} already picked`} /> : hcpPick && <span className="market-section__badge">{hcpPick}</span>}
                      <span className="market-section__toggle">{!dis.hcp && (collapsed.hcp ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.hcp && !dis.hcp && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'Draw' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${hcpPick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = hcpPick === key ? '' : key;
                              setHcpPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.Handicap, pick: key,
                                odds: preOdds.hcp?.[key],
                                leg: { pick: key, lineValue: Number(preOdds.hcp?.line ?? -1) },
                                label: `Хандикап ${preOdds.hcp?.line ?? '-1'} — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'X',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {preOdds.hcp?.[key] != null ? Number(preOdds.hcp[key]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Home Team Goals O/U */}
                  <div data-cat="goals" className={`market-section ${collapsed.homeGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('homeGoals')}>
                      <span className="market-section__name">△ {selectedMatch.homeTeamName} Goals</span>
                      {hGoalsLine && hGoalsOU && <span className="market-section__badge">{hGoalsOU} {hGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.homeGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.homeGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {TEAM_GOAL_LINES.map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${hGoalsLine === String(l) && hGoalsOU === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (hGoalsLine === String(l) && hGoalsOU === pick) { setHGoalsLine(''); setHGoalsOU(''); }
                                  else {
                                    setHGoalsLine(String(l)); setHGoalsOU(pick);
                                    addToSlip({
                                      betType: BET_TYPE.TeamGoals, pick: 'Home', selKey: `TGH-${l}`,
                                      odds: preOdds.homeGoals?.[l]?.[pick],
                                      leg: { pick: 'Home', lineValue: Number(l), oUPick: pick },
                                      label: `${selectedMatch.homeTeamName} голове ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                      chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                    });
                                  }
                                }}>
                                {preOdds.homeGoals?.[l]?.[pick] != null ? Number(preOdds.homeGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Away Team Goals O/U */}
                  <div data-cat="goals" className={`market-section ${collapsed.awayGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('awayGoals')}>
                      <span className="market-section__name">▽ {selectedMatch.awayTeamName} Goals</span>
                      {aGoalsLine && aGoalsOU && <span className="market-section__badge">{aGoalsOU} {aGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.awayGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.awayGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {TEAM_GOAL_LINES.map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${aGoalsLine === String(l) && aGoalsOU === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (aGoalsLine === String(l) && aGoalsOU === pick) { setAGoalsLine(''); setAGoalsOU(''); }
                                  else {
                                    setAGoalsLine(String(l)); setAGoalsOU(pick);
                                    addToSlip({
                                      betType: BET_TYPE.TeamGoals, pick: 'Away', selKey: `TGA-${l}`,
                                      odds: preOdds.awayGoals?.[l]?.[pick],
                                      leg: { pick: 'Away', lineValue: Number(l), oUPick: pick },
                                      label: `${selectedMatch.awayTeamName} голове ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                      chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                    });
                                  }
                                }}>
                                {preOdds.awayGoals?.[l]?.[pick] != null ? Number(preOdds.awayGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Half Time Result */}
                  <div data-cat="halves" className={`market-section ${collapsed.ht ? 'market-section--collapsed' : ''}${dis.ht ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.ht && toggleSection('ht')} style={dis.ht ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◑ Half Time Result</span>
                      {dis.ht ? <LiveLock reason={`${groupBPicked} already picked`} /> : htPick && <span className="market-section__badge">{htPick === 'Home' ? selectedMatch.homeTeamName : htPick === 'Away' ? selectedMatch.awayTeamName : 'Draw'}</span>}
                      <span className="market-section__toggle">{!dis.ht && (collapsed.ht ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.ht && !dis.ht && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'Draw' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${htPick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = htPick === key ? '' : key;
                              setHtPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.HalfTime, pick: key,
                                odds: preOdds.ht?.[key],
                                leg: { pick: key },
                                label: `Полувреме — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'X',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {preOdds.ht?.[key] != null ? Number(preOdds.ht[key]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clean Sheet */}
                  <div data-cat="special" className={`market-section ${collapsed.cs ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('cs')}>
                      <span className="market-section__name">○ Clean Sheet</span>
                      {csPick && csYN && <span className="market-section__badge">{csPick === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName} {csYN === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.cs ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.cs && (
                      <div style={{ padding: '0 16px 12px' }}>
                        <div className="muted-text" style={{ fontSize: '0.74rem', marginBottom: 8 }}>Team concedes 0 goals.</div>
                        {[{ val: 'Home', lbl: selectedMatch.homeTeamName }, { val: 'Away', lbl: selectedMatch.awayTeamName }].map(({ val, lbl }) => (
                          <div key={val} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{lbl}</div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${csPick === val && csYN === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    if (csPick === val && csYN === yn) { setCsPick(''); setCsYN(''); }
                                    else {
                                      setCsPick(val); setCsYN(yn);
                                      addToSlip({
                                        betType: BET_TYPE.CleanSheet, pick: val, selKey: `CS-${val}`,
                                        odds: preOdds.cs?.[val]?.[yn],
                                        leg: { pick: val, bTTSPick: yn === 'true' },
                                        label: `Суха мрежа — ${lbl} ${yn === 'true' ? 'Да' : 'Не'}`,
                                        chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                      });
                                    }
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {preOdds.cs?.[val]?.[yn] != null ? Number(preOdds.cs[val][yn]).toFixed(2) : '—'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* First Goal */}
                  <div data-cat="goals" className={`market-section ${collapsed.fg ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('fg')}>
                      <span className="market-section__name">◎ First Goal</span>
                      {fgPick && <span className="market-section__badge">{fgPick === 'Home' ? selectedMatch.homeTeamName : fgPick === 'Away' ? selectedMatch.awayTeamName : 'No Goal'}</span>}
                      <span className="market-section__toggle">{collapsed.fg ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.fg && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'No Goal' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${fgPick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = fgPick === key ? '' : key;
                              setFgPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.FirstGoal, pick: key,
                                odds: preOdds.fg?.[key],
                                leg: { pick: key },
                                label: `Първи гол — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'НГ',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {preOdds.fg?.[key] != null ? Number(preOdds.fg[key]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BTTS 1st Half */}
                  <div data-cat="halves" className={`market-section ${collapsed.btts1h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts1h')}>
                      <span className="market-section__name">◐ BTTS — 1st Half</span>
                      {btts1hPick && <span className="market-section__badge">{btts1hPick === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts1h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts1h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts1hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = btts1hPick === val ? '' : val;
                              setBtts1hPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.Btts1stHalf, pick: val === 'true' ? 'Yes' : 'No',
                                odds: preOdds.btts1h?.[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `И двата отбора бележат 1-во полувреме — ${val === 'true' ? 'Да' : 'Не'}`,
                                chip: val === 'true' ? 'ДА' : 'НЕ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {preOdds.btts1h?.[val] != null ? Number(preOdds.btts1h[val]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BTTS 2nd Half */}
                  <div data-cat="halves" className={`market-section ${collapsed.btts2h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts2h')}>
                      <span className="market-section__name">◑ BTTS — 2nd Half</span>
                      {btts2hPick && <span className="market-section__badge">{btts2hPick === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts2h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts2h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts2hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = btts2hPick === val ? '' : val;
                              setBtts2hPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.Btts2ndHalf, pick: val === 'true' ? 'Yes' : 'No',
                                odds: preOdds.btts2h?.[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `И двата отбора бележат 2-ро полувреме — ${val === 'true' ? 'Да' : 'Не'}`,
                                chip: val === 'true' ? 'ДА' : 'НЕ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {preOdds.btts2h?.[val] != null ? Number(preOdds.btts2h[val]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 1st Half Goals O/U */}
                  <div data-cat="halves" className={`market-section ${collapsed.htGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('htGoals')}>
                      <span className="market-section__name">◐ 1st Half Goals — Over / Under</span>
                      {htGoalsLine && htGoalsOU && <span className="market-section__badge">{htGoalsOU} {htGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.htGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.htGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {['0.5', '1.5', '2.5'].map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${htGoalsLine === l && htGoalsOU === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (htGoalsLine === l && htGoalsOU === pick) { setHtGoalsLine(''); setHtGoalsOU(''); }
                                  else {
                                    setHtGoalsLine(l); setHtGoalsOU(pick);
                                    addToSlip({
                                      betType: BET_TYPE.HalfTimeGoals, pick, selKey: `HTG-${l}`,
                                      odds: preOdds.htGoals?.[l]?.[pick],
                                      leg: { oULine: lineToKey(l), oUPick: pick },
                                      label: `Голове 1-во полувреме ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                      chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                    });
                                  }
                                }}>
                                {preOdds.htGoals?.[l]?.[pick] != null ? Number(preOdds.htGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2nd Half Goals O/U */}
                  <div data-cat="halves" className={`market-section ${collapsed.shGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('shGoals')}>
                      <span className="market-section__name">◑ 2nd Half Goals — Over / Under</span>
                      {shGoalsLine && shGoalsOU && <span className="market-section__badge">{shGoalsOU} {shGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.shGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.shGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {['0.5', '1.5', '2.5'].map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].map(pick => (
                              <button key={pick} type="button"
                                className={`ou-cell ${shGoalsLine === l && shGoalsOU === pick ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  if (shGoalsLine === l && shGoalsOU === pick) { setShGoalsLine(''); setShGoalsOU(''); }
                                  else {
                                    setShGoalsLine(l); setShGoalsOU(pick);
                                    addToSlip({
                                      betType: BET_TYPE.SecondHalfGoals, pick, selKey: `SHG-${l}`,
                                      odds: preOdds.shGoals?.[l]?.[pick],
                                      leg: { oULine: lineToKey(l), oUPick: pick },
                                      label: `Голове 2-ро полувреме ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                      chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                    });
                                  }
                                }}>
                                {preOdds.shGoals?.[l]?.[pick] != null ? Number(preOdds.shGoals[l][pick]).toFixed(2) : '—'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team Odd / Even Goals */}
                  <div data-cat="goals" className={`market-section ${collapsed.teamOE ? 'market-section--collapsed' : ''}`}>
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
                        ].map(({ val, lbl, pick: teamPick, setPick, key }) => (
                          <div key={val} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{lbl}</div>
                            <div className="market-options market-options--2">
                              {[{ oe: 'true', lbl2: 'Odd' }, { oe: 'false', lbl2: 'Even' }].map(({ oe, lbl2 }) => (
                                <button key={oe} type="button"
                                  className={`market-option ${teamPick === oe ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    const next = teamPick === oe ? '' : oe;
                                    setPick(next);
                                    if (next) addToSlip({
                                      betType: BET_TYPE.TeamOddEven, pick: val, selKey: `TOE-${val}`,
                                      odds: preOdds[key]?.[oe],
                                      leg: { pick: val, bTTSPick: oe === 'true' },
                                      label: `${lbl} голове — ${oe === 'true' ? 'Нечетен' : 'Четен'}`,
                                      chip: `${val === 'Home' ? '1' : '2'}${oe === 'true' ? 'Н' : 'Ч'}`,
                                    });
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {preOdds[key]?.[oe] != null ? Number(preOdds[key][oe]).toFixed(2) : '—'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Odd / Even Goals — 1st Half */}
                  <div data-cat="halves" className={`market-section ${collapsed.oe1h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('oe1h')}>
                      <span className="market-section__name">≈ Odd / Even Goals — 1st Half</span>
                      {oe1hPick && <span className="market-section__badge">{oe1hPick === 'true' ? 'Odd' : 'Even'}</span>}
                      <span className="market-section__toggle">{collapsed.oe1h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.oe1h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Odd' }, { val: 'false', lbl: 'Even' }].map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${oe1hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = oe1hPick === val ? '' : val;
                              setOe1hPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.OddEven1stHalf, pick: val === 'true' ? 'Odd' : 'Even',
                                odds: preOdds.oe1h?.[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `Голове 1-во полувреме — ${val === 'true' ? 'Нечетен' : 'Четен'}`,
                                chip: val === 'true' ? 'НЕЧ' : 'ЧЕТ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {preOdds.oe1h?.[val] != null ? Number(preOdds.oe1h[val]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team to Score */}
                  <div data-cat="special" className={`market-section ${collapsed.teamTs ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('teamTs')}>
                      <span className="market-section__name">→ Team to Score</span>
                      {(homeTsPick || awayTsPick) && <span className="market-section__badge">selected</span>}
                      <span className="market-section__toggle">{collapsed.teamTs ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.teamTs && (
                      <div style={{ padding: '0 16px 12px' }}>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, pick: homeTsPick, setPick: setHomeTsPick, key: 'homeTs' },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, pick: awayTsPick, setPick: setAwayTsPick, key: 'awayTs' },
                        ].map(({ val, lbl, pick: teamPick, setPick, key }) => (
                          <div key={val} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{lbl}</div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${teamPick === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    const next = teamPick === yn ? '' : yn;
                                    setPick(next);
                                    if (next) addToSlip({
                                      betType: BET_TYPE.TeamToScore, pick: val, selKey: `TS-${val}`,
                                      odds: preOdds[key]?.[yn],
                                      leg: { pick: val, bTTSPick: yn === 'true' },
                                      label: `${lbl} да отбележи — ${yn === 'true' ? 'Да' : 'Не'}`,
                                      chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                    });
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {preOdds[key]?.[yn] != null ? Number(preOdds[key][yn]).toFixed(2) : '—'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Win Both Halves */}
                  <div data-cat="halves" className={`market-section ${collapsed.wbh ? 'market-section--collapsed' : ''}${dis.wbh ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.wbh && toggleSection('wbh')} style={dis.wbh ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◆ Win Both Halves</span>
                      {dis.wbh ? <LiveLock reason={`${groupAPicked} already picked`} /> : (wbhHomePick || wbhAwayPick) && <span className="market-section__badge">selected</span>}
                      <span className="market-section__toggle">{!dis.wbh && (collapsed.wbh ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.wbh && !dis.wbh && (
                      <div style={{ padding: '0 16px 12px' }}>
                        <div className="muted-text" style={{ fontSize: '0.74rem', marginBottom: 8 }}>Team wins both the 1st and 2nd half.</div>
                        {[
                          { val: 'Home', lbl: selectedMatch.homeTeamName, pick: wbhHomePick, setPick: v => { setWbhHomePick(v); } },
                          { val: 'Away', lbl: selectedMatch.awayTeamName, pick: wbhAwayPick, setPick: v => { setWbhAwayPick(v); } },
                        ].map(({ val, lbl, pick: teamPick, setPick }) => (
                          <div key={val} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{lbl}</div>
                            <div className="market-options market-options--2">
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${teamPick === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    const next = teamPick === yn ? '' : yn;
                                    setPick(next);
                                    if (next) addToSlip({
                                      betType: BET_TYPE.WinBothHalves, pick: val, selKey: `WBH-${val}`,
                                      odds: preOdds.wbh?.[val]?.[yn],
                                      leg: { pick: val, bTTSPick: yn === 'true' },
                                      label: `${lbl} печели и двете полувремена — ${yn === 'true' ? 'Да' : 'Не'}`,
                                      chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                    });
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {preOdds.wbh?.[val]?.[yn] != null ? Number(preOdds.wbh[val][yn]).toFixed(2) : '—'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Last Team to Score */}
                  <div data-cat="main" className={`market-section ${collapsed.lastScore ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('lastScore')}>
                      <span className="market-section__name">◇ Last Team to Score</span>
                      {lastScorePick && <span className="market-section__badge">{lastScorePick === 'Home' ? selectedMatch.homeTeamName : lastScorePick === 'Away' ? selectedMatch.awayTeamName : 'No Goal'}</span>}
                      <span className="market-section__toggle">{collapsed.lastScore ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.lastScore && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'No Goal' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${lastScorePick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = lastScorePick === key ? '' : key;
                              setLastScorePick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.LastToScore, pick: key,
                                odds: preOdds.lastScore?.[key],
                                leg: { pick: key },
                                label: `Последен гол — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'НГ',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {preOdds.lastScore?.[key] != null ? Number(preOdds.lastScore[key]).toFixed(2) : '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* HT / FT */}
                  <div data-cat="main" className={`market-section ${collapsed.htft ? 'market-section--collapsed' : ''}${dis.htft ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.htft && toggleSection('htft')} style={dis.htft ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">↕ Half Time / Full Time</span>
                      {dis.htft ? <LiveLock reason={`${groupAPicked || groupBPicked} already picked`} /> : htftPick && <span className="market-section__badge">{htftPick}</span>}
                      <span className="market-section__toggle">{!dis.htft && (collapsed.htft ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.htft && !dis.htft && (() => {
                      const H = selectedMatch.homeTeamName, D = 'Draw', A = selectedMatch.awayTeamName;
                      const htftOptions = [
                        { key: 'HH', ht: H, ft: H }, { key: 'HD', ht: H, ft: D }, { key: 'HA', ht: H, ft: A },
                        { key: 'DH', ht: D, ft: H }, { key: 'DD', ht: D, ft: D }, { key: 'DA', ht: D, ft: A },
                        { key: 'AH', ht: A, ft: H }, { key: 'AD', ht: A, ft: D }, { key: 'AA', ht: A, ft: A },
                      ];
                      return (
                        <div className="market-options market-options--3">
                          {htftOptions.map(({ key, ht, ft }) => (
                            <button key={key} type="button"
                              className={`market-option market-option--htft ${htftPick === key ? 'market-option--active' : ''}`}
                              title={`${ht} / ${ft}`}
                              onClick={() => {
                                const next = htftPick === key ? '' : key;
                                setHtftPick(next);
                                if (next) addToSlip({
                                  betType: BET_TYPE.HtFt, pick: key,
                                  odds: preOdds.htft?.[key],
                                  leg: { stringPick: key },
                                  label: `Полувреме/Край — ${ht} / ${ft}`,
                                  chip: key,
                                });
                              }}>
                              <div className="market-option__label htft-stack">
                                <span className="htft-stack__line">{ht}</span>
                                <span className="htft-stack__sep">↓</span>
                                <span className="htft-stack__line">{ft}</span>
                              </div>
                              <div className="market-option__odds">
                                {preOdds.htft?.[key] != null ? Number(preOdds.htft[key]).toFixed(2) : '—'}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Goalscorer */}
                  <div data-cat="goals" className={`market-section ${collapsed.scorer ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('scorer')}>
                      <span className="market-section__name">◉ Goalscorer</span>
                      {scorerPicks.size > 0 && <span className="market-section__badge">{scorerPicks.size}</span>}
                      <span className="market-section__toggle">{collapsed.scorer ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.scorer && (
                      <div style={{ padding: '12px 16px' }}>
                        {scorerLoading && <div className="muted-text" style={{ fontSize: '0.82rem' }}>Loading players...</div>}
                        {!scorerLoading && scorerPlayers.length === 0 && (
                          <div className="muted-text" style={{ fontSize: '0.78rem' }}>No players found — sync via Admin → Sync Players.</div>
                        )}
                        {!scorerLoading && scorerPlayers.length > 0 && (
                          <div className="gs-list">
                            {[...scorerPlayers].sort((a, b) => (a.odds ?? 99) - (b.odds ?? 99)).map(p => {
                              const logo = p.isHome ? selectedMatch.homeTeamLogo : selectedMatch.awayTeamLogo;
                              const team = p.isHome ? selectedMatch.homeTeamName : selectedMatch.awayTeamName;
                              const active = scorerPicks.has(p.playerId);
                              return (
                                <button key={p.playerId} type="button" className={`gs-row${active ? ' gs-row--active' : ''}`}
                                  onClick={() => {
                                    // Toggle local selection; the slip toggles by the same selKey.
                                    setScorerPicks(s => {
                                      const n = new Set(s);
                                      n.has(p.playerId) ? n.delete(p.playerId) : n.add(p.playerId);
                                      return n;
                                    });
                                    addToSlip({
                                      betType: BET_TYPE.Goalscorer, pick: String(p.playerId), selKey: `GS-${p.playerId}`,
                                      odds: p.odds,
                                      leg: { goalscorerId: p.playerId },
                                      label: `Голмайстор — ${p.name}`,
                                      chip: '⚽',
                                    });
                                  }}>
                                  <span className="gs-row__crest">
                                    {logo
                                      ? <img src={logo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                      : <span className="gs-row__crest-fallback">{(team || '?').slice(0, 1)}</span>}
                                  </span>
                                  <span className="gs-row__name">{p.name}</span>
                                  <span className="gs-row__odds">{Number(p.odds).toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>{/* end market-table */}

                {/* Legacy inline "Market Pick" bet-slip used to render here
                    (with its own amount input + Place Bet CTA). It duplicated
                    the global Bet Slip panel on the right, so it's been removed.
                    All picks now flow exclusively through the global slip. */}
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
      </div>{/* end .gvm-page__main */}

      {/* Right sidebar — Live Now */}
      <LiveNowSidebar />

      {/* Quick Stake modal — opens when the user taps an odd */}
      <QuickStakeModal
        open={!!quickStake}
        match={quickStake?.match}
        pick={quickStake?.pick}
        odds={quickStake?.odds}
        onClose={() => setQuickStake(null)}
      />
    </div>
  );
}
