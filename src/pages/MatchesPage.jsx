import { useCallback, useEffect, useRef, useState } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import LiveNowSidebar from '../components/LiveNowSidebar';
import QuickStakeModal from '../components/QuickStakeModal';
import QuickBetPanel from '../components/QuickBetPanel';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import {
  BET_TYPE, WINNER_MAP, OU_LINE_MAP, OU_LINE_DECIMAL, OU_DECIMAL_TO_LINE, OU_PICK_MAP, DC_OPTIONS,
  TEAM_SOT_LINES, TEAM_SHOTS_LINES, TEAM_OFFSIDES_LINES, TEAM_TACKLES_LINES,
  MATCH_SOT_LINES, MATCH_SHOTS_LINES, MATCH_OFFSIDES_LINES, MATCH_TACKLES_LINES,
  EMPTY_FORM as EMPTY, lineToKey, parseScore, fetchOdds, LEAGUE_LIST,
} from './MatchesPage.constants';

// ── Main page ────────────────────────────────────────────────────
export default function MatchesPage() {
  const { refreshBalance } = useWallet();
  const { isAdmin } = useAuth();

  const [matches, setMatches]             = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  // Quick Stake modal — opens when the user taps a 1/X/2 odd in a match card
  const [quickStake, setQuickStake] = useState(null);  // { match, pick, odds } | null
  // Default to 'market' so opening a match lands directly on the Main
  // markets tab — the Gridiron Velocity tabs do the switching now and
  // there's no in-between mode picker.
  const [mode, setMode]                   = useState('market');
  // Inside Exact Score: 'ft' (final) or 'ht' (half-time). Drives which
  // BetType the stepper submits and which odds endpoint we poll.
  const [exactKind, setExactKind]         = useState('ft');
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
  const [dc1hPick, setDc1hPick]               = useState('');
  const [cornersLine, setCornersLine]         = useState('');
  const [cornersOU, setCornersOU]             = useState('');
  const [yellowsLine, setYellowsLine]         = useState('');
  const [yellowsOU, setYellowsOU]             = useState('');
  const [ouPicks, setOuPicks]                 = useState(() => new Set());  // Set<`${line}:${pick}`> — multiple O/U picks, mirrors the slip
  const [scorerPicks, setScorerPicks]         = useState(() => new Set());  // Set<playerId> — multiple goalscorers allowed
  const [scorerPlayers, setScorerPlayers]     = useState([]);
  const [scorerLoading, setScorerLoading]     = useState(false);
  const [assistOdds, setAssistOdds]           = useState({});  // { [playerId]: odds }
  const [soaOdds, setSoaOdds]                 = useState({});  // { [playerId]: odds }

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
  // Phase 8 stat market odds — fetched from API when section is expanded
  // Structure: { [betType]: { [side_or_match]: { [line]: { Over, Under } } } }
  const [statOdds, setStatOdds] = useState({});
  const INIT_COLLAPSED = { winner: false, dc: false, goals: false, btts: false, corners: true, yellows: true, scorer: true, oddEven: true, dnb: true, wtn: true, hcp: true, homeGoals: true, awayGoals: true, ht: true, cs: true, fg: true, btts1h: true, btts2h: true, htGoals: true, shGoals: true, teamOE: true, oe1h: true, teamTs: true, wbh: true, lastScore: true, htft: true, etg: true, wm: true, nog: true, bhh: true, htrb: true, oe2h: true, sbh: true, hwmg: true, thshHome: true, thshAway: true, rtg: true, weh: true, qualify: false, extraTime: true, penalties: true, methodVic: true, ah: true, ahAlt: true, ah1h: true, ah1hAlt: true, scorePen: true, missPen: true, teamSot: true, teamShots: true, teamOffsides: true, teamTackles: true, matchSot: true, matchShots: true, matchOffsides: true, matchTackles: true, playerAssist: true, playerSoa: true, sh2: true, earlyGoal: true, lateGoal: true, fgm: true, htExact: true, shExact: true, homeExact: true, awayExact: true, ttg: true, fgsSection: true, lgsSection: true, pbSection: true, fpbSection: true, tgsSection: true, assistSection: true };
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

  const panelRef         = useRef(null);
  const aiRef            = useRef(null);
  const aiCache          = useRef({});   // matchId → AIPredictionResponseDTO
  const playersFetchedRef = useRef(false); // prevent duplicate /players fetches per match
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
      for (const { key, matchId, betType, pick, line, leg } of picks) {
        if (!selectedMatch || matchId !== selectedMatch.id) continue;
        // Generic: any O/U cell mirrors the slip by its full key — drop it when removed.
        if (key) setOuPicks(s => { if (!s.has(key)) return s; const n = new Set(s); n.delete(key); return n; });
        const team = leg?.pick;     // 'Home' | 'Away' for per-team markets
        // Pick-aware clears via functional updaters: only blank the field when
        // it still holds the SELF-SAME selection being removed. This stops a
        // conflict-eviction (e.g. switching Winner Home → Draw evicts Home and
        // emits a remove) from wiping the value we just set to the new pick.
        const bttsLocal = pick === 'Yes' ? 'true' : 'No' === pick ? 'false' : pick;
        switch (betType) {
          case 'Winner':       setFields(p => p.winner === pick ? { ...p, winner: '' } : p); break;
          case 'DoubleChance': setDCPick(v => v === pick ? '' : v); break;
          case 'DoubleChance1stHalf': setDc1hPick(v => v === pick ? '' : v); break;
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
    setDCPick(''); setDc1hPick(''); setCornersLine(''); setCornersOU(''); setYellowsLine(''); setYellowsOU('');
    setOuPicks(new Set()); setScorerPicks(new Set()); setScorerPlayers([]);
    setAssistOdds({}); setSoaOdds({});
    playersFetchedRef.current = false;
    setOddEvenPick(''); setDnbPick(''); setWtnTeam(''); setWtnYN(''); setHcpPick('');
    setHGoalsLine(''); setHGoalsOU(''); setAGoalsLine(''); setAGoalsOU('');
    setHtPick(''); setCsPick(''); setCsYN(''); setFgPick('');
    setBtts1hPick(''); setBtts2hPick('');
    setHtGoalsLine(''); setHtGoalsOU(''); setShGoalsLine(''); setShGoalsOU('');
    setHomeOEPick(''); setAwayOEPick(''); setOe1hPick('');
    setHomeTsPick(''); setAwayTsPick('');
    setWbhHomePick(''); setWbhAwayPick('');
    setLastScorePick(''); setHtftPick('');
    setPreOdds({}); setCornersPreOdds({}); setYellowsPreOdds({}); setStatOdds({});
    setCollapsed(INIT_COLLAPSED);
  }, []);

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;
  const home       = parseScore(homeScore);
  const away       = parseScore(awayScore);
  const hasScore   = home != null && away != null;
  const isExact    = mode === 'exact';
  const isMarket   = mode === 'market';
  const hasBetOdds = selectedMatch?.homeOdds != null;

  // Pre-fetch players as soon as a match is selected so the scorer / assist /
  // score-or-assist sections show instantly when expanded.
  useEffect(() => {
    if (!isMarket || !selectedMatch) return;
    if (playersFetchedRef.current) return;
    playersFetchedRef.current = true;
    setScorerPlayers([]); setScorerLoading(true);
    const mid = selectedMatch.id;
    api.get(`/Match/${mid}/players`)
      .then(r => {
        const players = r.data ?? [];
        setScorerPlayers(players);
        if (players.length === 0) return;
        // AssistOdds and SoaOdds are returned directly in each player object.
        setAssistOdds(Object.fromEntries(
          players.filter(p => p.assistOdds != null).map(p => [p.playerId, p.assistOdds])
        ));
        setSoaOdds(Object.fromEntries(
          players.filter(p => p.soaOdds != null).map(p => [p.playerId, p.soaOdds])
        ));
      })
      .catch(() => setScorerPlayers([]))
      .finally(() => setScorerLoading(false));
  }, [isMarket, selectedMatch?.id]);


  // Live odds — Exact Score.
  // Cached per "h-a" score (cleared when the match changes) + debounced, so
  // rapid +/- stepping reads instantly from cache and fires at most one
  // request once the user pauses, instead of one round-trip per click.
  // FT and HT scorelines are priced from different Sportmonks markets, so
  // we keep them in separate caches keyed by "h-a". The cache key is also
  // namespaced by `exactKind` so the same scoreline can hold both prices.
  const exactOddsCache = useRef(new Map());
  const currentExactBetType = exactKind === 'ht'
    ? BET_TYPE.HalfTimeCorrectScore
    : BET_TYPE.ExactScore;

  useEffect(() => {
    if (!isExact || !selectedMatch) { setExactOdds(null); return; }
    const h = Math.max(0, Math.min(20, Number(homeScore) || 0));
    const a = Math.max(0, Math.min(20, Number(awayScore) || 0));
    const key = `${exactKind}:${h}-${a}`;
    if (exactOddsCache.current.has(key)) {
      setExactOdds(exactOddsCache.current.get(key));
      setExactOddsLoading(false);
      return;
    }
    let cancelled = false;
    setExactOddsLoading(true);
    const t = setTimeout(() => {
      fetchOdds(selectedMatch.id, currentExactBetType, { scoreHome: h, scoreAway: a })
        .then(r => { if (!cancelled) { if (r) exactOddsCache.current.set(key, r); setExactOdds(r); } })
        .finally(() => { if (!cancelled) setExactOddsLoading(false); });
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isExact, selectedMatch?.id, homeScore, awayScore, exactKind, currentExactBetType]);

  // Prefetch 0..4 × 0..4 for whichever kind (FT/HT) is currently active so
  // stepping inside that range pulls from cache with no lag. Switching to
  // the other kind triggers its own burst on first visit.
  useEffect(() => {
    if (!isExact || !selectedMatch) return;
    const common = [];
    for (let hh = 0; hh <= 4; hh++) for (let aa = 0; aa <= 4; aa++) common.push([hh, aa]);
    let cancelled = false;
    Promise.all(common.map(async ([hh, aa]) => {
      const k = `${exactKind}:${hh}-${aa}`;
      if (exactOddsCache.current.has(k)) return;
      const r = await fetchOdds(selectedMatch.id, currentExactBetType, { scoreHome: hh, scoreAway: aa });
      if (r) exactOddsCache.current.set(k, r);
    })).then(() => {
      if (cancelled) return;
      const ck = `${exactKind}:${Number(homeScore) || 0}-${Number(awayScore) || 0}`;
      if (exactOddsCache.current.has(ck)) setExactOdds(exactOddsCache.current.get(ck));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExact, selectedMatch?.id, exactKind]);

  // Live odds — all markets from real Sportmonks data (no API calls)
  useEffect(() => {
    if (!isMarket) return;
    const winnerOdds = winner === 'Home' ? selectedMatch?.homeOdds
                     : winner === 'Draw' ? selectedMatch?.drawOdds
                     : winner === 'Away' ? selectedMatch?.awayOdds : null;
    const bttsOdds = btts === 'true'  ? (preOdds.btts?.['true']  ?? null)
                   : btts === 'false' ? (preOdds.btts?.['false'] ?? null) : null;
    const ouOdds   = (ouLine && ouPick) ? (preOdds.ou?.[OU_LINE_DECIMAL[ouLine]]?.[ouPick] ?? null) : null;
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
    if (!selectedMatch) { setPreOdds({}); setCornersPreOdds({}); setYellowsPreOdds({}); setStatOdds({}); return; }
    const m = selectedMatch;

    // Parse market 86 TTG — supports both old flat format {"HomeOver05":x} and
    // new nested format {"Home":{"0.5":{"Over":x,"Under":y}}}
    const ttgNorm = (() => {
      try {
        if (!m.teamTotalGoalsOddsJson) return {};
        const raw = JSON.parse(m.teamTotalGoalsOddsJson);
        if (raw.Home && typeof raw.Home === 'object') return raw; // new nested format
        // Old flat format: convert HomeOver05 → Home.0.5.Over
        const result = {};
        for (const [k, v] of Object.entries(raw)) {
          const team = k.startsWith('Home') ? 'Home' : k.startsWith('Away') ? 'Away' : null;
          if (!team) continue;
          const rest = k.slice(team.length);
          const pick = rest.startsWith('Over') ? 'Over' : rest.startsWith('Under') ? 'Under' : null;
          const lp = rest.replace(/^(Over|Under)/, '');
          const line = lp.length === 2 ? `${lp[0]}.${lp[1]}` : null;
          if (!pick || !line) continue;
          if (!result[team]) result[team] = {};
          if (!result[team][line]) result[team][line] = {};
          result[team][line][pick] = v;
        }
        return result;
      } catch { return {}; }
    })();
    setPreOdds({
      dc: {
        HomeOrDraw: m.dcHomeOrDraw ?? null,
        DrawOrAway: m.dcDrawOrAway ?? null,
        HomeOrAway: m.dcHomeOrAway ?? null,
      },
      dc1h: {
        HomeOrDraw: m.dc1HHomeOrDraw ?? null,
        DrawOrAway: m.dc1HDrawOrAway ?? null,
        HomeOrAway: m.dc1HHomeOrAway ?? null,
      },
      btts: {
        true:  m.bttsYes ?? null,
        false: m.bttsNo  ?? null,
      },
      ou: (() => { try { return m.goalsOuOddsJson ? JSON.parse(m.goalsOuOddsJson) : {}; } catch { return {}; } })(),
      oddEven: { true: m.oddGoals ?? null, false: m.evenGoals ?? null },
      dnb:     { Home: m.dnbHome ?? null, Away: m.dnbAway ?? null },
      wtn: {
        Home: { true: m.wtnHomeYes ?? null, false: m.wtnHomeNo ?? null },
        Away: { true: m.wtnAwayYes ?? null, false: m.wtnAwayNo ?? null },
      },
      hcp: { Home: m.hcpHomeOdds ?? null, Draw: m.hcpDrawOdds ?? null, Away: m.hcpAwayOdds ?? null, line: m.hcpLine ?? null },
      homeGoals: (() => { try { return m.homeGoalsOuOddsJson ? JSON.parse(m.homeGoalsOuOddsJson) : (ttgNorm.Home ?? {}); } catch { return ttgNorm.Home ?? {}; } })(),
      awayGoals: (() => { try { return m.awayGoalsOuOddsJson ? JSON.parse(m.awayGoalsOuOddsJson) : (ttgNorm.Away ?? {}); } catch { return ttgNorm.Away ?? {}; } })(),
      ht: { Home: m.htHomeOdds ?? null, Draw: m.htDrawOdds ?? null, Away: m.htAwayOdds ?? null },
      cs: {
        Home: { true: m.csHomeYes ?? null, false: m.csHomeNo ?? null },
        Away: { true: m.csAwayYes ?? null, false: m.csAwayNo ?? null },
      },
      fg: { Home: m.fgHome ?? null, Draw: m.fgNone ?? null, Away: m.fgAway ?? null },
      // Phase 3
      btts1h:    { true: m.btts1HYes ?? null, false: m.btts1HNo ?? null },
      btts2h:    { true: m.btts2HYes ?? null, false: m.btts2HNo ?? null },
      htGoals: (() => { try { return m.htGoalsOuOddsJson ? JSON.parse(m.htGoalsOuOddsJson) : {}; } catch { return {}; } })(),
      shGoals: (() => { try { return m.shGoalsOuOddsJson ? JSON.parse(m.shGoalsOuOddsJson) : {}; } catch { return {}; } })(),
      homeOE:    { true: m.homeOddGoals ?? null, false: m.homeEvenGoals ?? null },
      awayOE:    { true: m.awayOddGoals ?? null, false: m.awayEvenGoals ?? null },
      oe1h:      { true: m.oddGoals1H   ?? null, false: m.evenGoals1H   ?? null },
      oe2h:      { true: m.oddGoals2H   ?? null, false: m.evenGoals2H   ?? null },
      sbh: (() => {
        try {
          const d = m.scoreInHalfOddsJson ? JSON.parse(m.scoreInHalfOddsJson) : null;
          if (!d) return {};
          const pick = (team, yn) => d[team]?.['1H']?.[yn] ?? d[team]?.['2H']?.[yn] ?? null;
          return {
            Home: { true: pick('Home', 'Yes'), false: pick('Home', 'No') },
            Away: { true: pick('Away', 'Yes'), false: pick('Away', 'No') },
          };
        } catch { return {}; }
      })(),
      hwmg: { '1stHalf': m.hwMG1H ?? null, '2ndHalf': m.hwMG2H ?? null, Tie: m.hwMGTie ?? null },
      thsh: {
        Home: { '1stHalf': m.homeHsH1H ?? null, '2ndHalf': m.homeHsH2H ?? null, Tie: m.homeHsHTie ?? null },
        Away: { '1stHalf': m.awayHsH1H ?? null, '2ndHalf': m.awayHsH2H ?? null, Tie: m.awayHsHTie ?? null },
      },
      rtg: (() => { try { return m.resultTotalGoalsOddsJson ? JSON.parse(m.resultTotalGoalsOddsJson) : {}; } catch { return {}; } })(),
      weh: { Home: m.winEitherHome ?? null, Away: m.winEitherAway ?? null },
      // ── WC knockout markets — only present for knockout fixtures ──
      qualify: { Home: m.qualifyHomeOdds ?? null, Away: m.qualifyAwayOdds ?? null },
      ah: {
        line: m.ahMainLine ?? null,
        Home: m.ahHomeOdds ?? null,
        Away: m.ahAwayOdds ?? null,
        alt:  (() => { try { return m.alternativeAhOddsJson ? JSON.parse(m.alternativeAhOddsJson) : {}; } catch { return {}; } })(),
      },
      ah1h: {
        line: m.ah1HMainLine ?? null,
        Home: m.ah1HHomeOdds ?? null,
        Away: m.ah1HAwayOdds ?? null,
        alt:  (() => { try { return m.alternative1HAhOddsJson ? JSON.parse(m.alternative1HAhOddsJson) : {}; } catch { return {}; } })(),
      },
      // Penalty events per team (phase 7)
      scorePen: { Home: m.teamScorePenHomeOdds ?? null, Away: m.teamScorePenAwayOdds ?? null },
      missPen:  { Home: m.teamMissPenHomeOdds  ?? null, Away: m.teamMissPenAwayOdds  ?? null },
      extraTime: { true: m.extraTimeYesOdds ?? null, false: m.extraTimeNoOdds ?? null },
      penalties: { true: m.penaltiesYesOdds ?? null, false: m.penaltiesNoOdds ?? null },
      methodVic: {
        Regulation: m.methodRegulationOdds ?? null,
        ExtraTime:  m.methodExtraTimeOdds  ?? null,
        Penalties:  m.methodPenaltiesOdds  ?? null,
      },
      homeTs:    { true: m.homeToScoreYes ?? null, false: m.homeToScoreNo ?? null },
      awayTs:    { true: m.awayToScoreYes ?? null, false: m.awayToScoreNo ?? null },
      wbh: {
        Home: { true: m.winBothHomeYes ?? null, false: m.winBothHomeNo ?? null },
        Away: { true: m.winBothAwayYes ?? null, false: m.winBothAwayNo ?? null },
      },
      lastScore: { Home: m.lastTeamHome ?? null, Draw: m.lastTeamNone ?? null, Away: m.lastTeamAway ?? null },
      htft:      (() => { try { return m.htFtOddsJson ? JSON.parse(m.htFtOddsJson) : {}; } catch { return {}; } })(),
      // Exact Total Goals (market 93) — backend ships a {"0".."6"/"7+": odds}
      // dict, we just thread it through to the tile grid.
      etg:       (() => { try { return m.exactTotalGoalsOddsJson ? JSON.parse(m.exactTotalGoalsOddsJson) : {}; } catch { return {}; } })(),
      // Winning Margin (market 126) — { H1,H2,H3+,A1,A2,A3+,Draw,NoGoal }.
      wm:        (() => { try { return m.winningMarginOddsJson ? JSON.parse(m.winningMarginOddsJson) : {}; } catch { return {}; } })(),
      // Number of Goals in Match (market 83) — { Under2, TwoOrThree, Over3 }.
      nog:       (() => { try { return m.numberOfGoalsOddsJson ? JSON.parse(m.numberOfGoalsOddsJson) : {}; } catch { return {}; } })(),
      // BTTS 1H/2H combo (market 125) — { YesYes, YesNo, NoYes, NoNo }.
      bhh:       (() => { try { return m.bttsHalfByHalfOddsJson ? JSON.parse(m.bttsHalfByHalfOddsJson) : {}; } catch { return {}; } })(),
      // HT Result/BTTS combo (market 122).
      htrb:      (() => { try { return m.htResultBttsOddsJson ? JSON.parse(m.htResultBttsOddsJson) : {}; } catch { return {}; } })(),
      // New Bet365 markets
      sh2:       { Home: m.sh2Home ?? null, Draw: m.sh2Draw ?? null, Away: m.sh2Away ?? null },
      earlyGoal: (() => { try { return m.earlyGoalOddsJson ? JSON.parse(m.earlyGoalOddsJson) : {}; } catch { return {}; } })(),
      lateGoal:  (() => { try { return m.lateGoalOddsJson  ? JSON.parse(m.lateGoalOddsJson)  : {}; } catch { return {}; } })(),
      fgm:       (() => { try { return m.firstGoalMethodOddsJson   ? JSON.parse(m.firstGoalMethodOddsJson)   : {}; } catch { return {}; } })(),
      htExact:   (() => { try { return m.firstHalfExactGoalsJson   ? JSON.parse(m.firstHalfExactGoalsJson)   : {}; } catch { return {}; } })(),
      shExact:   (() => { try { return m.secondHalfExactGoalsJson  ? JSON.parse(m.secondHalfExactGoalsJson)  : {}; } catch { return {}; } })(),
      homeExact: (() => { try { return m.homeTeamExactGoalsJson    ? JSON.parse(m.homeTeamExactGoalsJson)    : {}; } catch { return {}; } })(),
      awayExact: (() => { try { return m.awayTeamExactGoalsJson    ? JSON.parse(m.awayTeamExactGoalsJson)    : {}; } catch { return {}; } })(),
      ttg:       ttgNorm,
      fgsOdds:   (() => { try { return m.firstGoalScorerOddsJson   ? JSON.parse(m.firstGoalScorerOddsJson)   : {}; } catch { return {}; } })(),
      lgsOdds:   (() => { try { return m.lastGoalScorerOddsJson    ? JSON.parse(m.lastGoalScorerOddsJson)    : {}; } catch { return {}; } })(),
      pbOdds:    (() => { try { return m.playerBookedOddsJson      ? JSON.parse(m.playerBookedOddsJson)      : {}; } catch { return {}; } })(),
      fpbOdds:   (() => { try { return m.firstPlayerBookedOddsJson ? JSON.parse(m.firstPlayerBookedOddsJson) : {}; } catch { return {}; } })(),
      tgsOdds:   (() => { try { return m.teamGoalscorerOddsJson    ? JSON.parse(m.teamGoalscorerOddsJson)    : {}; } catch { return {}; } })(),
      assistOdds:(() => { try { return m.assistOddsJson            ? JSON.parse(m.assistOddsJson)            : {}; } catch { return {}; } })(),
    });
    setCornersPreOdds((() => { try { return m.cornersOuOddsJson ? JSON.parse(m.cornersOuOddsJson) : {}; } catch { return {}; } })());
    setYellowsPreOdds((() => { try { return m.yellowsOuOddsJson ? JSON.parse(m.yellowsOuOddsJson) : {}; } catch { return {}; } })());
    setPreOddsLoading(false);

    // Parse stat market odds directly from match JSON — no API calls needed
    const parseTeamStatJson = (json) => {
      if (!json) return {};
      try {
        const raw = JSON.parse(json);
        const result = {};
        for (const [key, odds] of Object.entries(raw)) {
          const parts = key.split('_');
          if (parts.length !== 3) continue;
          const [team, line, pick] = parts;
          const side = team.toLowerCase() === 'home' ? 'Home' : 'Away';
          result[side] ??= {};
          result[side][line] ??= {};
          result[side][line][pick] = odds;
        }
        return result;
      } catch { return {}; }
    };
    const parseMatchStatJson = (json) => {
      if (!json) return {};
      try {
        const raw = JSON.parse(json);
        const result = {};
        for (const [key, odds] of Object.entries(raw)) {
          const lastUnderscore = key.lastIndexOf('_');
          if (lastUnderscore === -1) continue;
          const line = key.substring(0, lastUnderscore);
          const pick = key.substring(lastUnderscore + 1);
          result[line] ??= {};
          result[line][pick] = odds;
        }
        return result;
      } catch { return {}; }
    };
    setStatOdds({
      [BET_TYPE.TeamShotsOnTarget]:  parseTeamStatJson(m.teamSotOddsJson),
      [BET_TYPE.TeamShots]:          parseTeamStatJson(m.teamShotsOddsJson),
      [BET_TYPE.TeamOffsides]:       parseTeamStatJson(m.teamOffsidesOddsJson),
      [BET_TYPE.TeamTackles]:        parseTeamStatJson(m.teamTacklesOddsJson),
      [BET_TYPE.MatchShotsOnTarget]: parseMatchStatJson(m.matchSotOddsJson),
      [BET_TYPE.MatchShots]:         parseMatchStatJson(m.matchShotsOddsJson),
      [BET_TYPE.MatchOffsides]:      parseMatchStatJson(m.matchOffsidesOddsJson),
      [BET_TYPE.MatchTackles]:       parseMatchStatJson(m.matchTacklesOddsJson),
    });
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
          await api.post('/Bet', { matchId: selectedMatch.id, betType: currentExactBetType, scoreHome: home, scoreAway: away, amount: betAmt }, idemCfg);
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

  const dis = { winner: false, dc: false, dnb: false, htft: false, wtn: false, wbh: false, hcp: false, ht: false };
  const LiveLock = () => null;
  const mHas = obj => obj != null && Object.values(obj).some(v => v != null);
  const mHasKeys = obj => obj != null && Object.keys(obj).length > 0;

  const mv = {
    winner:    selectedMatch ? (selectedMatch.homeOdds != null || selectedMatch.drawOdds != null || selectedMatch.awayOdds != null) : false,
    dc:        mHas(preOdds.dc),
    dc1h:      mHas(preOdds.dc1h),
    ou:        mHasKeys(preOdds.ou),
    btts:      mHas(preOdds.btts),
    corners:   mHasKeys(cornersPreOdds),
    yellows:   mHasKeys(yellowsPreOdds),
    oddEven:   mHas(preOdds.oddEven),
    htrb:      mHas(preOdds.htrb),
    bhh:       mHas(preOdds.bhh),
    nog:       mHas(preOdds.nog),
    etg:       mHas(preOdds.etg),
    wm:        mHas(preOdds.wm),
    dnb:       mHas(preOdds.dnb),
    wtn:       mHas(preOdds.wtn?.Home) || mHas(preOdds.wtn?.Away),
    hcp:       preOdds.hcp?.Home != null || preOdds.hcp?.Draw != null || preOdds.hcp?.Away != null,
    homeGoals: mHasKeys(preOdds.homeGoals),
    awayGoals: mHasKeys(preOdds.awayGoals),
    ht:        mHas(preOdds.ht),
    cs:        mHas(preOdds.cs?.Home) || mHas(preOdds.cs?.Away),
    fg:        mHas(preOdds.fg),
    btts1h:    mHas(preOdds.btts1h),
    btts2h:    mHas(preOdds.btts2h),
    htGoals:   mHasKeys(preOdds.htGoals),
    shGoals:   mHasKeys(preOdds.shGoals),
    teamOE:    mHas(preOdds.homeOE) || mHas(preOdds.awayOE),
    oe1h:      mHas(preOdds.oe1h),
    oe2h:      mHas(preOdds.oe2h),
    weh:       mHas(preOdds.weh),
    rtg:       mHasKeys(preOdds.rtg),
    thshHome:  mHas(preOdds.thsh?.Home),
    thshAway:  mHas(preOdds.thsh?.Away),
    hwmg:      mHas(preOdds.hwmg),
    sbh:       mHas(preOdds.sbh?.Home) || mHas(preOdds.sbh?.Away),
    teamTs:    mHas(preOdds.homeTs) || mHas(preOdds.awayTs),
    wbh:       mHas(preOdds.wbh?.Home) || mHas(preOdds.wbh?.Away),
    lastScore: mHas(preOdds.lastScore),
    htft:      mHasKeys(preOdds.htft),
    ttg:       false, // market 86 data is shown via homeGoals/awayGoals fallback
  };

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
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                   stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>

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
            {isAdmin && selectedMatch.externalId > 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #888)', marginTop: 4, textAlign: 'center', letterSpacing: '0.04em' }}>
                SM ID: <strong>{selectedMatch.externalId}</strong>
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
            >Основни</button>
            <button
              type="button"
              className={`gvmd-tab${isExact ? ' gvmd-tab--active' : ''}`}
              onClick={() => { setMode('exact'); }}
            >Точен резултат</button>
            {[
              { key: 'goals',    label: 'Голове' },
              { key: 'halves',   label: 'Полувремена' },
              { key: 'corners',  label: 'Корнери' },
              { key: 'special',  label: 'Специални' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`gvmd-tab${marketCategory === key && !isExact ? ' gvmd-tab--active' : ''}`}
                onClick={() => { setMode('market'); setMarketCategory(key); setFields(EMPTY); }}
              >{label}</button>
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
                      const ck = `${exactKind}:${h}-${a}`;
                      let r = exactOddsCache.current.get(ck)
                        || (exactOdds?.odds != null ? exactOdds : null);
                      if (r?.odds == null) {
                        r = await fetchOdds(selectedMatch.id, currentExactBetType, { scoreHome: h, scoreAway: a });
                        if (r) exactOddsCache.current.set(ck, r);
                      }
                      if (r?.odds != null) {
                        const isHt = exactKind === 'ht';
                        window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
                          detail: {
                            matchId:     selectedMatch.id,
                            betType:     isHt ? 'HalfTimeCorrectScore' : 'ExactScore',
                            pick:        isHt ? `HT ${h}-${a}` : `${h}-${a}`,
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
                      {/* FT/HT toggle — same stepper UI, just swaps the
                          BetType + the pricing endpoint. The "HT" choice
                          maps to Sportmonks market 30 (Half Time Correct
                          Score); "FT" stays on market 57. */}
                      <div className="es-stepper__kind" role="tablist" aria-label="Exact score type">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={exactKind === 'ft'}
                          className={`es-stepper__kind-btn${exactKind === 'ft' ? ' es-stepper__kind-btn--active' : ''}`}
                          onClick={() => setExactKind('ft')}
                        >90 Минути</button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={exactKind === 'ht'}
                          className={`es-stepper__kind-btn${exactKind === 'ht' ? ' es-stepper__kind-btn--active' : ''}`}
                          onClick={() => setExactKind('ht')}
                        >1-во Полувреме</button>
                      </div>
                      <div className="es-stepper__teams">
                        {[
                          { name: selectedMatch.homeTeamName, logo: selectedMatch.homeTeamLogo, val: h, step: stepH, side: 'home' },
                          { name: selectedMatch.awayTeamName, logo: selectedMatch.awayTeamLogo, val: a, step: stepA, side: 'away' },
                        ].map((t, i) => (
                          <div className={`es-stepper__team es-stepper__team--${t.side}`} key={i}>
                            <div className="es-stepper__name">
                              {/* Home: logo on the left of the name. Away:
                                  logo on the right, so the two teams mirror
                                  outward like the badges in the hero. */}
                              {t.side === 'home' && t.logo && (
                                <img src={t.logo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              )}
                              <span>{t.name}</span>
                              {t.side === 'away' && t.logo && (
                                <img src={t.logo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              )}
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
                        Добави {exactKind === 'ht' ? 'ПВ ' : ''}{h}:{a}
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
                  {mv.winner && (
                  <div data-cat="main" className={`market-section ${collapsed.winner ? 'market-section--collapsed' : ''}${dis.winner ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.winner && toggleSection('winner')} style={dis.winner ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">Краен резултат (1Х2)</span>
                      {dis.winner && <LiveLock reason={`${groupAPicked} already picked`} />}
                      <span className="market-section__toggle">{!dis.winner && (collapsed.winner ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.winner && !dis.winner && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName, odds: selectedMatch.homeOdds },
                          { key: 'Draw', label: 'Draw',                    odds: selectedMatch.drawOdds  },
                          { key: 'Away', label: selectedMatch.awayTeamName, odds: selectedMatch.awayOdds  },
                        ].filter(({ odds }) => odds != null).map(({ key, label, odds }) => (
                          <button key={key} type="button"
                            className={`market-option ${winner === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              setField('winner', winner === key ? '' : key);
                              addToSlip({ betType: BET_TYPE.Winner, pick: key, odds });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">{Number(odds).toFixed(2)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Double Chance */}
                  {mv.dc && (
                  <div data-cat="main" className={`market-section ${collapsed.dc ? 'market-section--collapsed' : ''}${dis.dc ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.dc && toggleSection('dc')} style={dis.dc ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">Двоен шанс</span>
                      {dis.dc && <LiveLock reason={`${groupAPicked} already picked`} />}
                      <span className="market-section__toggle">{!dis.dc && (collapsed.dc ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.dc && !dis.dc && (
                      <div className="market-options market-options--3">
                        {DC_OPTIONS.filter(({ key }) => preOdds.dc?.[key] != null).map(({ key }) => {
                          const [a, b] = key === 'HomeOrDraw' ? [selectedMatch.homeTeamName, 'Draw']
                                       : key === 'DrawOrAway' ? ['Draw', selectedMatch.awayTeamName]
                                       : [selectedMatch.homeTeamName, selectedMatch.awayTeamName];
                          const dcOdds = preOdds.dc[key];
                          return (
                            <button key={key} type="button"
                              className={`market-option market-option--htft ${dcPick === key ? 'market-option--active' : ''}`}
                              title={`${a} or ${b}`}
                              onClick={() => {
                                setDCPick(dcPick === key ? '' : key);
                                addToSlip({ betType: BET_TYPE.DoubleChance, pick: key, odds: dcOdds });
                              }}>
                              <div className="market-option__label htft-stack">
                                <span className="htft-stack__line">{a}</span>
                                <span className="htft-stack__sep">or</span>
                                <span className="htft-stack__line">{b}</span>
                              </div>
                              <div className="market-option__odds">
                                {Number(dcOdds).toFixed(2)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Double Chance — 1st Half */}
                  {mv.dc1h && (
                  <div data-cat="halves" className={`market-section ${collapsed.dc1h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('dc1h')}>
                      <span className="market-section__name">◐ Двоен шанс — 1-во полувреме</span>
                      {dc1hPick && <span className="market-section__badge">{dc1hPick === 'HomeOrDraw' ? '1X' : dc1hPick === 'HomeOrAway' ? '12' : 'X2'}</span>}
                      <span className="market-section__toggle">{collapsed.dc1h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.dc1h && (
                      <div className="market-options market-options--3">
                        {DC_OPTIONS.filter(({ key }) => preOdds.dc1h?.[key] != null).map(({ key }) => {
                          const [a, b] = key === 'HomeOrDraw' ? [selectedMatch.homeTeamName, 'Draw']
                                       : key === 'DrawOrAway' ? ['Draw', selectedMatch.awayTeamName]
                                       : [selectedMatch.homeTeamName, selectedMatch.awayTeamName];
                          const dc1Odds = preOdds.dc1h[key];
                          return (
                            <button key={key} type="button"
                              className={`market-option market-option--htft ${dc1hPick === key ? 'market-option--active' : ''}`}
                              title={`1st Half: ${a} or ${b}`}
                              onClick={() => {
                                setDc1hPick(dc1hPick === key ? '' : key);
                                addToSlip({
                                  betType: BET_TYPE.DoubleChance1stHalf, pick: key, selKey: `DC1H-${key}`,
                                  odds: dc1Odds,
                                  leg: { dCPick: key },
                                  label: `Двоен шанс 1-во полувреме — ${key === 'HomeOrDraw' ? '1X' : key === 'HomeOrAway' ? '12' : 'X2'}`,
                                  chip: key === 'HomeOrDraw' ? '1X' : key === 'HomeOrAway' ? '12' : 'X2',
                                });
                              }}>
                              <div className="market-option__label htft-stack">
                                <span className="htft-stack__line">{a}</span>
                                <span className="htft-stack__sep">or</span>
                                <span className="htft-stack__line">{b}</span>
                              </div>
                              <div className="market-option__odds">
                                {Number(dc1Odds).toFixed(2)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Goals O/U */}
                  {mv.ou && (
                  <div data-cat="goals" className={`market-section ${collapsed.goals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('goals')}>
                      <span className="market-section__name">Голове — Над / Под</span>
                      {ouPicks.size > 0 && <span className="market-section__badge">{ouPicks.size}</span>}
                      <span className="market-section__toggle">{collapsed.goals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.goals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(preOdds.ou ?? {}).sort((a,b) => parseFloat(a)-parseFloat(b))
                          .filter(label => preOdds.ou[label]?.Over != null || preOdds.ou[label]?.Under != null)
                          .map(label => {
                          const line = OU_DECIMAL_TO_LINE[label] ?? null;
                          return (
                          <div key={label} className="ou-table__row">
                            <span className="ou-table__line">{label}</span>
                            {['Over', 'Under'].filter(pick => preOdds.ou[label]?.[pick] != null).map(pick => {
                              const cellOdds = preOdds.ou[label][pick];
                              const k = `${selectedMatch.id}:${BET_TYPE.OverUnder}:${pick}:${label}`;
                              return (
                                <button key={pick} type="button"
                                  disabled={!line}
                                  className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}${!line ? ' ou-cell--disabled' : ''}`}
                                  onClick={() => {
                                    if (!line) return;
                                    setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                    addToSlip({ betType: BET_TYPE.OverUnder, pick, line, odds: cellOdds });
                                  }}>
                                  {Number(cellOdds).toFixed(2)}
                                </button>
                              );
                            })}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* BTTS */}
                  {mv.btts && (
                  <div data-cat="main" className={`market-section ${collapsed.btts ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts')}>
                      <span className="market-section__name">И двата отбора бележат</span>
                      {btts && <span className="market-section__badge">{btts === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].filter(({ val }) => preOdds.btts?.[val] != null).map(({ val, lbl }) => {
                          const bttsOdds = preOdds.btts[val];
                          return (
                            <button key={val} type="button"
                              className={`market-option ${btts === val ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setField('btts', btts === val ? '' : val);
                                addToSlip({ betType: BET_TYPE.BTTS, pick: val === 'true' ? 'Yes' : 'No', odds: bttsOdds });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(bttsOdds).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Corners */}
                  {mv.corners && (
                  <div data-cat="corners" className={`market-section ${collapsed.corners ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('corners')}>
                      <span className="market-section__name">⌐ Корнери — Над / Под</span>
                      {cornersLine && cornersOU && <span className="market-section__badge">{cornersOU} {cornersLine}</span>}
                      <span className="market-section__toggle">{collapsed.corners ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.corners && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(cornersPreOdds).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => cornersPreOdds[l]?.Over != null || cornersPreOdds[l]?.Under != null).map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].filter(pick => cornersPreOdds[l]?.[pick] != null).map(pick => {
                              const k = `${selectedMatch.id}:${BET_TYPE.Corners}:${pick}:COR-${l}`;
                              return (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.Corners, pick, selKey: `COR-${l}`,
                                    odds: cornersPreOdds[l][pick],
                                    leg: { lineValue: Number(l), oUPick: pick },
                                    label: `Корнери ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                    chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                  });
                                }}>
                                {Number(cornersPreOdds[l][pick]).toFixed(2)}
                              </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Yellow Cards */}
                  {mv.yellows && (
                  <div data-cat="special" className={`market-section ${collapsed.yellows ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('yellows')}>
                      <span className="market-section__name">▬ Жълти картони — Над / Под</span>
                      {yellowsLine && yellowsOU && <span className="market-section__badge">{yellowsOU} {yellowsLine}</span>}
                      <span className="market-section__toggle">{collapsed.yellows ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.yellows && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(yellowsPreOdds).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => yellowsPreOdds[l]?.Over != null || yellowsPreOdds[l]?.Under != null).map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].filter(pick => yellowsPreOdds[l]?.[pick] != null).map(pick => {
                              const k = `${selectedMatch.id}:${BET_TYPE.YellowCards}:${pick}:YC-${l}`;
                              return (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.YellowCards, pick, selKey: `YC-${l}`,
                                    odds: yellowsPreOdds[l][pick],
                                    leg: { lineValue: Number(l), oUPick: pick },
                                    label: `Жълти картони ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                    chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                  });
                                }}>
                                {Number(yellowsPreOdds[l][pick]).toFixed(2)}
                              </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Odd / Even Goals */}
                  {mv.oddEven && (
                  <div data-cat="goals" className={`market-section ${collapsed.oddEven ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('oddEven')}>
                      <span className="market-section__name">≈ Голове — Нечетен / Четен</span>
                      {oddEvenPick && <span className="market-section__badge">{oddEvenPick === 'true' ? 'Odd' : 'Even'}</span>}
                      <span className="market-section__toggle">{collapsed.oddEven ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.oddEven && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Odd' }, { val: 'false', lbl: 'Even' }].filter(({ val }) => preOdds.oddEven?.[val] != null).map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${oddEvenPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = oddEvenPick === val ? '' : val;
                              setOddEvenPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.OddEven, pick: val === 'true' ? 'Odd' : 'Even',
                                odds: preOdds.oddEven[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `Голове — ${val === 'true' ? 'Нечетен' : 'Четен'}`,
                                chip: val === 'true' ? 'НЕЧ' : 'ЧЕТ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{Number(preOdds.oddEven[val]).toFixed(2)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* HT Result / BTTS combo (Sportmonks market 122) — 6 tiles */}
                  {mv.htrb && (
                  <div data-cat="halves" className={`market-section ${collapsed.htrb ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('htrb')}>
                      <span className="market-section__name">◐ HT Резултат + BTTS 1-во полувреме</span>
                      <span className="market-section__toggle">{collapsed.htrb ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.htrb && (
                      <div className="exact-score-grid">
                        {[
                          { k: 'HomeYes', lbl: `${selectedMatch.homeTeamName} / Да` },
                          { k: 'HomeNo',  lbl: `${selectedMatch.homeTeamName} / Не` },
                          { k: 'DrawYes', lbl: 'Равен / Да' },
                          { k: 'DrawNo',  lbl: 'Равен / Не' },
                          { k: 'AwayYes', lbl: `${selectedMatch.awayTeamName} / Да` },
                          { k: 'AwayNo',  lbl: `${selectedMatch.awayTeamName} / Не` },
                        ].filter(({ k }) => preOdds.htrb?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.htrb[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.HtResultBtts}:${k}:HTRB`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.HtResultBtts, pick: k, selKey: 'HTRB',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `HT Резултат + BTTS 1H — ${lbl}`,
                                  chip: `${k.startsWith('Home') ? '1' : k.startsWith('Draw') ? 'X' : '2'}/${k.endsWith('Yes') ? 'Y' : 'N'}`,
                                });
                              }}>
                              <div className="exact-score-tile__label">{lbl}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* BTTS 1H/2H combo (Sportmonks market 125) — 4 tiles */}
                  {mv.bhh && (
                  <div data-cat="halves" className={`market-section ${collapsed.bhh ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('bhh')}>
                      <span className="market-section__name">⊞ BTTS 1-во / 2-ро полувреме</span>
                      <span className="market-section__toggle">{collapsed.bhh ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.bhh && (
                      <div className="exact-score-grid">
                        {[
                          { k: 'YesYes', lbl: 'Да / Да' },
                          { k: 'YesNo',  lbl: 'Да / Не' },
                          { k: 'NoYes',  lbl: 'Не / Да' },
                          { k: 'NoNo',   lbl: 'Не / Не' },
                        ].filter(({ k }) => preOdds.bhh?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.bhh[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.BttsHalfByHalf}:${k}:BHH`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.BttsHalfByHalf, pick: k, selKey: 'BHH',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `BTTS 1-во/2-ро полувреме — ${lbl}`,
                                  chip: lbl.replace(/\s/g, ''),
                                });
                              }}>
                              <div className="exact-score-tile__label">{lbl}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Second Half Result (market 97) */}
                  {(preOdds.sh2?.Home != null || preOdds.sh2?.Draw != null || preOdds.sh2?.Away != null) && (
                  <div data-cat="halves" className={`market-section ${collapsed.sh2 ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('sh2')}>
                      <span className="market-section__name">◑ Резултат 2-ро полувреме</span>
                      <span className="market-section__toggle">{collapsed.sh2 ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.sh2 && (
                      <div className="market-options market-options--3">
                        {[
                          { k: 'Home', lbl: selectedMatch.homeTeamName, o: preOdds.sh2?.Home },
                          { k: 'Draw', lbl: 'Равен',                   o: preOdds.sh2?.Draw },
                          { k: 'Away', lbl: selectedMatch.awayTeamName, o: preOdds.sh2?.Away },
                        ].filter(({ o }) => o != null).map(({ k, lbl, o }) => (
                          <button key={k} type="button" className="market-option" disabled>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Early Goal Yes/No (market 84) */}
                  {(preOdds.earlyGoal?.Yes != null || preOdds.earlyGoal?.No != null) && (
                  <div data-cat="goals" className={`market-section ${collapsed.earlyGoal ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('earlyGoal')}>
                      <span className="market-section__name">⏱ Ранен гол (до 10 мин)</span>
                      <span className="market-section__toggle">{collapsed.earlyGoal ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.earlyGoal && (
                      <div className="market-options market-options--2">
                        {[{ k: 'Yes', lbl: 'Да' }, { k: 'No', lbl: 'Не' }].filter(({ k }) => preOdds.earlyGoal?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.earlyGoal[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.EarlyGoal}:${k}:EG`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`market-option ${active ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.EarlyGoal, pick: k, selKey: 'EG',
                                  odds: o,
                                  leg: { bTTSPick: k === 'Yes' },
                                  label: `Ранен гол — ${lbl}`,
                                  chip: k === 'Yes' ? 'РГ✓' : 'РГ✗',
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Late Goal Yes/No (market 85) */}
                  {(preOdds.lateGoal?.Yes != null || preOdds.lateGoal?.No != null) && (
                  <div data-cat="goals" className={`market-section ${collapsed.lateGoal ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('lateGoal')}>
                      <span className="market-section__name">⏰ Късен гол (след 80 мин)</span>
                      <span className="market-section__toggle">{collapsed.lateGoal ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.lateGoal && (
                      <div className="market-options market-options--2">
                        {[{ k: 'Yes', lbl: 'Да' }, { k: 'No', lbl: 'Не' }].filter(({ k }) => preOdds.lateGoal?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.lateGoal[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.LateGoal}:${k}:LG`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`market-option ${active ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.LateGoal, pick: k, selKey: 'LG',
                                  odds: o,
                                  leg: { bTTSPick: k === 'Yes' },
                                  label: `Късен гол — ${lbl}`,
                                  chip: k === 'Yes' ? 'КГ✓' : 'КГ✗',
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* First Goal Method (market 250) */}
                  {Object.keys(preOdds.fgm ?? {}).length > 0 && (
                  <div data-cat="goals" className={`market-section ${collapsed.fgm ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('fgm')}>
                      <span className="market-section__name">🎯 Метод за първи гол</span>
                      <span className="market-section__toggle">{collapsed.fgm ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.fgm && (
                      <div className="pick-list">
                        {(() => {
                          const ORDER = ['Header', 'Free Kick', 'Penalty', 'Own Goal', 'No Goal'];
                          return Object.entries(preOdds.fgm)
                            .filter(([_, o]) => o != null)
                            .sort((a, b) => {
                              const ai = ORDER.indexOf(a[0]); const bi = ORDER.indexOf(b[0]);
                              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                            })
                            .map(([k, o]) => {
                              const slipKey = `${selectedMatch.id}:${BET_TYPE.FirstGoalMethod}:${k}:FGM`;
                              const active  = ouPicks.has(slipKey);
                              return (
                                <button key={k} type="button"
                                  className={`pick-list__row${active ? ' pick-list__row--active' : ''}`}
                                  onClick={() => {
                                    setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                    addToSlip({
                                      betType: BET_TYPE.FirstGoalMethod, pick: k, selKey: 'FGM',
                                      odds: o,
                                      leg: { stringPick: k },
                                      label: `Метод за първи гол — ${k}`,
                                      chip: k.slice(0, 3),
                                    });
                                  }}>
                                  <span className="pick-list__label">{k}</span>
                                  <span className="pick-list__odds">{Number(o).toFixed(2)}</span>
                                </button>
                              );
                            });
                        })()}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 1st Half Exact Goals (market 33) */}
                  {Object.keys(preOdds.htExact ?? {}).length > 0 && (
                  <div data-cat="halves" className={`market-section ${collapsed.htExact ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('htExact')}>
                      <span className="market-section__name">1️⃣ Точен брой голове 1-во полувреме</span>
                      <span className="market-section__toggle">{collapsed.htExact ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.htExact && (
                      <div className="exact-score-grid">
                        {Object.entries(preOdds.htExact).filter(([_, o]) => o != null)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([k, o]) => (
                            <button key={k} type="button" className="exact-score-tile" disabled>
                              <div className="exact-score-tile__label">{k}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 2nd Half Exact Goals (market 38) */}
                  {Object.keys(preOdds.shExact ?? {}).length > 0 && (
                  <div data-cat="halves" className={`market-section ${collapsed.shExact ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('shExact')}>
                      <span className="market-section__name">2️⃣ Точен брой голове 2-ро полувреме</span>
                      <span className="market-section__toggle">{collapsed.shExact ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.shExact && (
                      <div className="exact-score-grid">
                        {Object.entries(preOdds.shExact).filter(([_, o]) => o != null)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([k, o]) => (
                            <button key={k} type="button" className="exact-score-tile" disabled>
                              <div className="exact-score-tile__label">{k}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Home Team Exact Goals (market 18) */}
                  {Object.keys(preOdds.homeExact ?? {}).length > 0 && (
                  <div data-cat="goals" className={`market-section ${collapsed.homeExact ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('homeExact')}>
                      <span className="market-section__name">🏠 Точен брой голове — {selectedMatch.homeTeamName}</span>
                      <span className="market-section__toggle">{collapsed.homeExact ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.homeExact && (
                      <div className="pick-list">
                        {Object.entries(preOdds.homeExact).filter(([_, o]) => o != null)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([k, o]) => {
                            const slipKey = `${selectedMatch.id}:${BET_TYPE.HomeTeamExactGoals}:${k}:HTEG`;
                            const active  = ouPicks.has(slipKey);
                            return (
                              <button key={k} type="button"
                                className={`pick-list__row${active ? ' pick-list__row--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.HomeTeamExactGoals, pick: k, selKey: 'HTEG',
                                    odds: o,
                                    leg: { stringPick: k },
                                    label: `${selectedMatch.homeTeamName} — точно ${k} гола`,
                                    chip: `Д${k}⚽`,
                                  });
                                }}>
                                <span className="pick-list__label">{k}</span>
                                <span className="pick-list__odds">{Number(o).toFixed(2)}</span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Away Team Exact Goals (market 19) */}
                  {Object.keys(preOdds.awayExact ?? {}).length > 0 && (
                  <div data-cat="goals" className={`market-section ${collapsed.awayExact ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('awayExact')}>
                      <span className="market-section__name">✈️ Точен брой голове — {selectedMatch.awayTeamName}</span>
                      <span className="market-section__toggle">{collapsed.awayExact ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.awayExact && (
                      <div className="pick-list">
                        {Object.entries(preOdds.awayExact).filter(([_, o]) => o != null)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([k, o]) => {
                            const slipKey = `${selectedMatch.id}:${BET_TYPE.AwayTeamExactGoals}:${k}:ATEG`;
                            const active  = ouPicks.has(slipKey);
                            return (
                              <button key={k} type="button"
                                className={`pick-list__row${active ? ' pick-list__row--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.AwayTeamExactGoals, pick: k, selKey: 'ATEG',
                                    odds: o,
                                    leg: { stringPick: k },
                                    label: `${selectedMatch.awayTeamName} — точно ${k} гола`,
                                    chip: `Г${k}⚽`,
                                  });
                                }}>
                                <span className="pick-list__label">{k}</span>
                                <span className="pick-list__odds">{Number(o).toFixed(2)}</span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Team Total Goals O/U (market 86) */}
                  {mv.ttg && (
                  <div data-cat="goals" className={`market-section ${collapsed.ttg ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('ttg')}>
                      <span className="market-section__name">⚽ Голове на отбор (над/под)</span>
                      <span className="market-section__toggle">{collapsed.ttg ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.ttg && (
                      <div>
                        {[['Home', selectedMatch.homeTeamName, 'TTH'], ['Away', selectedMatch.awayTeamName, 'TTA']].map(([team, name, prefix]) =>
                          preOdds.ttg?.[team] && Object.keys(preOdds.ttg[team]).length > 0 ? (
                          <div key={team}>
                            <div className="ou-table__subheader" style={{paddingLeft:'8px'}}><span>{name}</span><span>OVER</span><span>UNDER</span></div>
                            <div className="ou-table">
                              {Object.keys(preOdds.ttg[team]).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => preOdds.ttg[team][l]?.Over != null || preOdds.ttg[team][l]?.Under != null).map(l => (
                                <div key={l} className="ou-table__row">
                                  <span className="ou-table__line">{l}</span>
                                  {['Over', 'Under'].filter(pick => preOdds.ttg[team][l]?.[pick] != null).map(pick => {
                                    const k = `${selectedMatch.id}:${BET_TYPE.TeamGoals}:${team}:${prefix}-${l}-${pick}`;
                                    return (
                                    <button key={pick} type="button"
                                      className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                      onClick={() => {
                                        setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                        addToSlip({
                                          betType: BET_TYPE.TeamGoals, pick: team, selKey: `${prefix}-${l}-${pick}`,
                                          odds: preOdds.ttg[team][l][pick],
                                          leg: { pick: team, lineValue: Number(l), oUPick: pick },
                                          label: `${name} голове ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                          chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                        });
                                      }}>
                                      {Number(preOdds.ttg[team][l][pick]).toFixed(2)}
                                    </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  {/* First Goal Scorer (market 251) */}
                  {Object.keys(preOdds.fgsOdds ?? {}).length > 0 && (
                  <div data-cat="special" className={`market-section ${collapsed.fgsSection ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('fgsSection')}>
                      <span className="market-section__name">🥇 Първи голмайстор</span>
                      <span className="market-section__toggle">{collapsed.fgsSection ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.fgsSection && (
                      <div className="gs-list">
                        {Object.entries(preOdds.fgsOdds).sort((a,b)=>a[1]-b[1]).map(([name, o]) => (
                          <div key={name} className="gs-row">
                            <span className="gs-row__name">{name}</span>
                            <span className="gs-row__odds">{Number(o).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Last Goal Scorer (market 252) */}
                  {Object.keys(preOdds.lgsOdds ?? {}).length > 0 && (
                  <div data-cat="special" className={`market-section ${collapsed.lgsSection ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('lgsSection')}>
                      <span className="market-section__name">🏁 Последен голмайстор</span>
                      <span className="market-section__toggle">{collapsed.lgsSection ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.lgsSection && (
                      <div className="gs-list">
                        {Object.entries(preOdds.lgsOdds).sort((a,b)=>a[1]-b[1]).map(([name, o]) => (
                          <div key={name} className="gs-row">
                            <span className="gs-row__name">{name}</span>
                            <span className="gs-row__odds">{Number(o).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Player to be Booked (market 64) */}
                  {Object.keys(preOdds.pbOdds ?? {}).length > 0 && (
                  <div data-cat="special" className={`market-section ${collapsed.pbSection ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('pbSection')}>
                      <span className="market-section__name">🟨 Играч да получи картон</span>
                      <span className="market-section__toggle">{collapsed.pbSection ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.pbSection && (
                      <div className="gs-list">
                        {Object.entries(preOdds.pbOdds).sort((a,b)=>a[1]-b[1]).map(([name, o]) => (
                          <div key={name} className="gs-row">
                            <span className="gs-row__name">{name}</span>
                            <span className="gs-row__odds">{Number(o).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* First Player Booked (market 65) */}
                  {Object.keys(preOdds.fpbOdds ?? {}).length > 0 && (
                  <div data-cat="special" className={`market-section ${collapsed.fpbSection ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('fpbSection')}>
                      <span className="market-section__name">🟨 Първи играч с картон</span>
                      <span className="market-section__toggle">{collapsed.fpbSection ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.fpbSection && (
                      <div className="gs-list">
                        {Object.entries(preOdds.fpbOdds).sort((a,b)=>a[1]-b[1]).map(([name, o]) => (
                          <div key={name} className="gs-row">
                            <span className="gs-row__name">{name}</span>
                            <span className="gs-row__odds">{Number(o).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Team Goalscorer (market 92) */}
                  {Object.keys(preOdds.tgsOdds ?? {}).length > 0 && (
                  <div data-cat="special" className={`market-section ${collapsed.tgsSection ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('tgsSection')}>
                      <span className="market-section__name">⚽ Голмайстор на отбор</span>
                      <span className="market-section__toggle">{collapsed.tgsSection ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.tgsSection && (
                      <div className="gs-list">
                        {Object.entries(preOdds.tgsOdds).sort((a,b)=>a[1]-b[1]).map(([name, o]) => (
                          <div key={name} className="gs-row">
                            <span className="gs-row__name">{name}</span>
                            <span className="gs-row__odds">{Number(o).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Player to Assist (market 332) */}
                  {Object.keys(preOdds.assistOdds ?? {}).length > 0 && (
                  <div data-cat="special" className={`market-section ${collapsed.assistSection ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('assistSection')}>
                      <span className="market-section__name">🅰️ Играч с асистенция</span>
                      <span className="market-section__toggle">{collapsed.assistSection ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.assistSection && (
                      <div className="gs-list">
                        {Object.entries(preOdds.assistOdds).sort((a,b)=>a[1]-b[1]).map(([name, o]) => (
                          <div key={name} className="gs-row">
                            <span className="gs-row__name">{name}</span>
                            <span className="gs-row__odds">{Number(o).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Number of Goals in Match (Sportmonks market 83) — 3 buckets */}
                  {mv.nog && (
                  <div data-cat="goals" className={`market-section ${collapsed.nog ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('nog')}>
                      <span className="market-section__name">⊜ Брой голове</span>
                      <span className="market-section__toggle">{collapsed.nog ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.nog && (
                      <div className="market-options market-options--3">
                        {[
                          { k: 'Under2',     lbl: 'Под 2 голa' },
                          { k: 'TwoOrThree', lbl: '2 или 3 голa' },
                          { k: 'Over3',      lbl: 'Над 3 голa' },
                        ].filter(({ k }) => preOdds.nog?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.nog[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.NumberOfGoals}:${k}:NOG`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`market-option ${active ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.NumberOfGoals, pick: k, selKey: 'NOG',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `Брой голове — ${lbl}`,
                                  chip: k === 'Under2' ? '<2' : k === 'Over3' ? '>3' : '2-3',
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Exact Total Goals (Sportmonks market 93) — 0..7+ tile grid */}
                  {mv.etg && (
                  <div data-cat="goals" className={`market-section ${collapsed.etg ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('etg')}>
                      <span className="market-section__name">Σ Точен брой голове</span>
                      <span className="market-section__toggle">{collapsed.etg ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.etg && (
                      <div className="exact-score-grid">
                        {['0','1','2','3','4','5','6','7+'].filter(k => preOdds.etg?.[k] != null).map(k => {
                          const o = preOdds.etg[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.ExactTotalGoals}:${k}:ETG`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.ExactTotalGoals, pick: k, selKey: 'ETG',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `Точно ${k} голa в мача`,
                                  chip: `${k}⚽`,
                                });
                              }}>
                              <div className="exact-score-tile__label">{k}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Winning Margin (Sportmonks market 126) — special tab */}
                  {mv.wm && (
                  <div data-cat="special" className={`market-section ${collapsed.wm ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('wm')}>
                      <span className="market-section__name">▭ Печалба с разлика</span>
                      <span className="market-section__toggle">{collapsed.wm ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.wm && (
                      <div className="exact-score-grid">
                        {[
                          { k: 'H1',     lbl: `${selectedMatch.homeTeamName} +1` },
                          { k: 'H2',     lbl: `${selectedMatch.homeTeamName} +2` },
                          { k: 'H3+',    lbl: `${selectedMatch.homeTeamName} +3` },
                          { k: 'A1',     lbl: `${selectedMatch.awayTeamName} +1` },
                          { k: 'A2',     lbl: `${selectedMatch.awayTeamName} +2` },
                          { k: 'A3+',    lbl: `${selectedMatch.awayTeamName} +3` },
                          { k: 'Draw',   lbl: 'Score Draw' },
                          { k: 'NoGoal', lbl: '0-0' },
                        ].filter(({ k }) => preOdds.wm?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.wm[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.WinningMargin}:${k}:WM`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.WinningMargin, pick: k, selKey: 'WM',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `Печалба с разлика — ${lbl}`,
                                  chip: k === 'NoGoal' ? '0-0' : k === 'Draw' ? 'X' : k,
                                });
                              }}>
                              <div className="exact-score-tile__label">{lbl}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Draw No Bet */}
                  {mv.dnb && (
                  <div data-cat="main" className={`market-section ${collapsed.dnb ? 'market-section--collapsed' : ''}${dis.dnb ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.dnb && toggleSection('dnb')} style={dis.dnb ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">⊖ Без равен</span>
                      {dis.dnb ? <LiveLock reason={`${groupAPicked} already picked`} /> : dnbPick && <span className="market-section__badge">{dnbPick === 'Home' ? selectedMatch.homeTeamName : selectedMatch.awayTeamName}</span>}
                      <span className="market-section__toggle">{!dis.dnb && (collapsed.dnb ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.dnb && !dis.dnb && (
                      <>
                        <div className="muted-text" style={{ fontSize: '0.74rem', padding: '4px 16px 0' }}>If the match ends in a draw, the bet is voided and stake returned.</div>
                        <div className="market-options market-options--2">
                          {[{ val: 'Home', lbl: selectedMatch.homeTeamName }, { val: 'Away', lbl: selectedMatch.awayTeamName }].filter(({ val }) => preOdds.dnb?.[val] != null).map(({ val, lbl }) => (
                            <button key={val} type="button"
                              className={`market-option ${dnbPick === val ? 'market-option--active' : ''}`}
                              onClick={() => {
                                const next = dnbPick === val ? '' : val;
                                setDnbPick(next);
                                if (next) addToSlip({
                                  betType: BET_TYPE.DrawNoBet, pick: val,
                                  odds: preOdds.dnb[val],
                                  leg: { pick: val },
                                  label: `Без равен — ${lbl}`,
                                  chip: val === 'Home' ? '1' : '2',
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">
                                {Number(preOdds.dnb[val]).toFixed(2)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  )}

                  {/* Win to Nil */}
                  {mv.wtn && (
                  <div data-cat="special" className={`market-section ${collapsed.wtn ? 'market-section--collapsed' : ''}${dis.wtn ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.wtn && toggleSection('wtn')} style={dis.wtn ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">⊘ Печели на нула</span>
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
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].filter(({ yn }) => preOdds.wtn?.[val]?.[yn] != null).map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${wtnTeam === val && wtnYN === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    if (wtnTeam === val && wtnYN === yn) { setWtnTeam(''); setWtnYN(''); }
                                    else {
                                      setWtnTeam(val); setWtnYN(yn);
                                      addToSlip({
                                        betType: BET_TYPE.WinToNil, pick: val, selKey: `WTN-${val}`,
                                        odds: preOdds.wtn[val][yn],
                                        leg: { pick: val, bTTSPick: yn === 'true' },
                                        label: `Победа на нула — ${lbl} ${yn === 'true' ? 'Да' : 'Не'}`,
                                        chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                      });
                                    }
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {Number(preOdds.wtn[val][yn]).toFixed(2)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Handicap */}
                  {mv.hcp && (
                  <div data-cat="special" className={`market-section ${collapsed.hcp ? 'market-section--collapsed' : ''}${dis.hcp ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.hcp && toggleSection('hcp')} style={dis.hcp ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">± Хандикап {preOdds.hcp?.line ? `(${preOdds.hcp.line})` : '(-1)'}</span>
                      {dis.hcp ? <LiveLock reason={`${groupAPicked} already picked`} /> : hcpPick && <span className="market-section__badge">{hcpPick}</span>}
                      <span className="market-section__toggle">{!dis.hcp && (collapsed.hcp ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.hcp && !dis.hcp && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'Draw' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].filter(({ key }) => preOdds.hcp?.[key] != null).map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${hcpPick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = hcpPick === key ? '' : key;
                              setHcpPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.Handicap, pick: key,
                                odds: preOdds.hcp[key],
                                leg: { pick: key, lineValue: Number(preOdds.hcp?.line ?? -1) },
                                label: `Хандикап ${preOdds.hcp?.line ?? '-1'} — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'X',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.hcp[key]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Home Team Goals O/U */}
                  {mv.homeGoals && (
                  <div data-cat="goals" className={`market-section ${collapsed.homeGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('homeGoals')}>
                      <span className="market-section__name">△ Голове на {selectedMatch.homeTeamName}</span>
                      {hGoalsLine && hGoalsOU && <span className="market-section__badge">{hGoalsOU} {hGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.homeGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.homeGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(preOdds.homeGoals ?? {}).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => preOdds.homeGoals?.[l]?.Over != null || preOdds.homeGoals?.[l]?.Under != null).map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].filter(pick => preOdds.homeGoals?.[l]?.[pick] != null).map(pick => {
                              const k = `${selectedMatch.id}:${BET_TYPE.TeamGoals}:Home:TGH-${l}-${pick}`;
                              return (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.TeamGoals, pick: 'Home', selKey: `TGH-${l}-${pick}`,
                                    odds: preOdds.homeGoals[l][pick],
                                    leg: { pick: 'Home', lineValue: Number(l), oUPick: pick },
                                    label: `${selectedMatch.homeTeamName} голове ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                    chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                  });
                                }}>
                                {Number(preOdds.homeGoals[l][pick]).toFixed(2)}
                              </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Away Team Goals O/U */}
                  {mv.awayGoals && (
                  <div data-cat="goals" className={`market-section ${collapsed.awayGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('awayGoals')}>
                      <span className="market-section__name">▽ Голове на {selectedMatch.awayTeamName}</span>
                      {aGoalsLine && aGoalsOU && <span className="market-section__badge">{aGoalsOU} {aGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.awayGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.awayGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(preOdds.awayGoals ?? {}).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => preOdds.awayGoals?.[l]?.Over != null || preOdds.awayGoals?.[l]?.Under != null).map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].filter(pick => preOdds.awayGoals?.[l]?.[pick] != null).map(pick => {
                              const k = `${selectedMatch.id}:${BET_TYPE.TeamGoals}:Away:TGA-${l}-${pick}`;
                              return (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.TeamGoals, pick: 'Away', selKey: `TGA-${l}-${pick}`,
                                    odds: preOdds.awayGoals[l][pick],
                                    leg: { pick: 'Away', lineValue: Number(l), oUPick: pick },
                                    label: `${selectedMatch.awayTeamName} голове ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                    chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                  });
                                }}>
                                {Number(preOdds.awayGoals[l][pick]).toFixed(2)}
                              </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Half Time Result */}
                  {mv.ht && (
                  <div data-cat="halves" className={`market-section ${collapsed.ht ? 'market-section--collapsed' : ''}${dis.ht ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.ht && toggleSection('ht')} style={dis.ht ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◑ Резултат на полувремето</span>
                      {dis.ht ? <LiveLock reason={`${groupBPicked} already picked`} /> : htPick && <span className="market-section__badge">{htPick === 'Home' ? selectedMatch.homeTeamName : htPick === 'Away' ? selectedMatch.awayTeamName : 'Draw'}</span>}
                      <span className="market-section__toggle">{!dis.ht && (collapsed.ht ? '▼' : '▲')}</span>
                    </div>
                    {!collapsed.ht && !dis.ht && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'Draw' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].filter(({ key }) => preOdds.ht?.[key] != null).map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${htPick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = htPick === key ? '' : key;
                              setHtPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.HalfTime, pick: key,
                                odds: preOdds.ht[key],
                                leg: { pick: key },
                                label: `Полувреме — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'X',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.ht[key]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Clean Sheet */}
                  {mv.cs && (
                  <div data-cat="special" className={`market-section ${collapsed.cs ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('cs')}>
                      <span className="market-section__name">○ Суха мрежа</span>
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
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].filter(({ yn }) => preOdds.cs?.[val]?.[yn] != null).map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${csPick === val && csYN === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    if (csPick === val && csYN === yn) { setCsPick(''); setCsYN(''); }
                                    else {
                                      setCsPick(val); setCsYN(yn);
                                      addToSlip({
                                        betType: BET_TYPE.CleanSheet, pick: val, selKey: `CS-${val}`,
                                        odds: preOdds.cs[val][yn],
                                        leg: { pick: val, bTTSPick: yn === 'true' },
                                        label: `Суха мрежа — ${lbl} ${yn === 'true' ? 'Да' : 'Не'}`,
                                        chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                      });
                                    }
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {Number(preOdds.cs[val][yn]).toFixed(2)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* First Goal */}
                  {mv.fg && (
                  <div data-cat="goals" className={`market-section ${collapsed.fg ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('fg')}>
                      <span className="market-section__name">◎ Първи гол</span>
                      {fgPick && <span className="market-section__badge">{fgPick === 'Home' ? selectedMatch.homeTeamName : fgPick === 'Away' ? selectedMatch.awayTeamName : 'No Goal'}</span>}
                      <span className="market-section__toggle">{collapsed.fg ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.fg && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'No Goal' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].filter(({ key }) => preOdds.fg?.[key] != null).map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${fgPick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = fgPick === key ? '' : key;
                              setFgPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.FirstGoal, pick: key,
                                odds: preOdds.fg[key],
                                leg: { pick: key },
                                label: `Първи гол — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'НГ',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.fg[key]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* BTTS 1st Half */}
                  {mv.btts1h && (
                  <div data-cat="halves" className={`market-section ${collapsed.btts1h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts1h')}>
                      <span className="market-section__name">◐ И двата бележат — 1-во полувреме</span>
                      {btts1hPick && <span className="market-section__badge">{btts1hPick === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts1h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts1h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].filter(({ val }) => preOdds.btts1h?.[val] != null).map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts1hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = btts1hPick === val ? '' : val;
                              setBtts1hPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.Btts1stHalf, pick: val === 'true' ? 'Yes' : 'No',
                                odds: preOdds.btts1h[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `И двата отбора бележат 1-во полувреме — ${val === 'true' ? 'Да' : 'Не'}`,
                                chip: val === 'true' ? 'ДА' : 'НЕ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.btts1h[val]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* BTTS 2nd Half */}
                  {mv.btts2h && (
                  <div data-cat="halves" className={`market-section ${collapsed.btts2h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('btts2h')}>
                      <span className="market-section__name">◑ И двата бележат — 2-ро полувреме</span>
                      {btts2hPick && <span className="market-section__badge">{btts2hPick === 'true' ? 'Yes' : 'No'}</span>}
                      <span className="market-section__toggle">{collapsed.btts2h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.btts2h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Yes' }, { val: 'false', lbl: 'No' }].filter(({ val }) => preOdds.btts2h?.[val] != null).map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${btts2hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = btts2hPick === val ? '' : val;
                              setBtts2hPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.Btts2ndHalf, pick: val === 'true' ? 'Yes' : 'No',
                                odds: preOdds.btts2h[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `И двата отбора бележат 2-ро полувреме — ${val === 'true' ? 'Да' : 'Не'}`,
                                chip: val === 'true' ? 'ДА' : 'НЕ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.btts2h[val]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 1st Half Goals O/U */}
                  {mv.htGoals && (
                  <div data-cat="halves" className={`market-section ${collapsed.htGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('htGoals')}>
                      <span className="market-section__name">◐ Голове 1-во полувреме — Над / Под</span>
                      {htGoalsLine && htGoalsOU && <span className="market-section__badge">{htGoalsOU} {htGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.htGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.htGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(preOdds.htGoals ?? {}).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => preOdds.htGoals?.[l]?.Over != null || preOdds.htGoals?.[l]?.Under != null).map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].filter(pick => preOdds.htGoals?.[l]?.[pick] != null).map(pick => {
                              const k = `${selectedMatch.id}:${BET_TYPE.HalfTimeGoals}:${pick}:HTG-${l}`;
                              return (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.HalfTimeGoals, pick, selKey: `HTG-${l}`,
                                    odds: preOdds.htGoals[l][pick],
                                    leg: { oULine: lineToKey(l), oUPick: pick },
                                    label: `Голове 1-во полувреме ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                    chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                  });
                                }}>
                                {Number(preOdds.htGoals[l][pick]).toFixed(2)}
                              </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 2nd Half Goals O/U */}
                  {mv.shGoals && (
                  <div data-cat="halves" className={`market-section ${collapsed.shGoals ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('shGoals')}>
                      <span className="market-section__name">◑ Голове 2-ро полувреме — Над / Под</span>
                      {shGoalsLine && shGoalsOU && <span className="market-section__badge">{shGoalsOU} {shGoalsLine}</span>}
                      <span className="market-section__toggle">{collapsed.shGoals ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.shGoals && (
                      <div className="ou-table">
                        <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                        {Object.keys(preOdds.shGoals ?? {}).sort((a,b) => parseFloat(a)-parseFloat(b)).filter(l => preOdds.shGoals?.[l]?.Over != null || preOdds.shGoals?.[l]?.Under != null).map(l => (
                          <div key={l} className="ou-table__row">
                            <span className="ou-table__line">{l}</span>
                            {['Over', 'Under'].filter(pick => preOdds.shGoals?.[l]?.[pick] != null).map(pick => {
                              const k = `${selectedMatch.id}:${BET_TYPE.SecondHalfGoals}:${pick}:SHG-${l}`;
                              return (
                              <button key={pick} type="button"
                                className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                  addToSlip({
                                    betType: BET_TYPE.SecondHalfGoals, pick, selKey: `SHG-${l}`,
                                    odds: preOdds.shGoals[l][pick],
                                    leg: { oULine: lineToKey(l), oUPick: pick },
                                    label: `Голове 2-ро полувреме ${pick === 'Over' ? 'над' : 'под'} ${l}`,
                                    chip: `${pick === 'Over' ? 'O' : 'U'}${l}`,
                                  });
                                }}>
                                {Number(preOdds.shGoals[l][pick]).toFixed(2)}
                              </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Team Odd / Even Goals */}
                  {mv.teamOE && (
                  <div data-cat="goals" className={`market-section ${collapsed.teamOE ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('teamOE')}>
                      <span className="market-section__name">≈ Голове на отбор — Нечетен / Четен</span>
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
                              {[{ oe: 'true', lbl2: 'Odd' }, { oe: 'false', lbl2: 'Even' }].filter(({ oe }) => preOdds[key]?.[oe] != null).map(({ oe, lbl2 }) => (
                                <button key={oe} type="button"
                                  className={`market-option ${teamPick === oe ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    const next = teamPick === oe ? '' : oe;
                                    setPick(next);
                                    if (next) addToSlip({
                                      betType: BET_TYPE.TeamOddEven, pick: val, selKey: `TOE-${val}`,
                                      odds: preOdds[key][oe],
                                      leg: { pick: val, bTTSPick: oe === 'true' },
                                      label: `${lbl} голове — ${oe === 'true' ? 'Нечетен' : 'Четен'}`,
                                      chip: `${val === 'Home' ? '1' : '2'}${oe === 'true' ? 'Н' : 'Ч'}`,
                                    });
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {Number(preOdds[key][oe]).toFixed(2)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Odd / Even Goals — 1st Half */}
                  {mv.oe1h && (
                  <div data-cat="halves" className={`market-section ${collapsed.oe1h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('oe1h')}>
                      <span className="market-section__name">≈ Голове — Нечетен / Четен — 1-во полувреме</span>
                      {oe1hPick && <span className="market-section__badge">{oe1hPick === 'true' ? 'Odd' : 'Even'}</span>}
                      <span className="market-section__toggle">{collapsed.oe1h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.oe1h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Odd' }, { val: 'false', lbl: 'Even' }].filter(({ val }) => preOdds.oe1h?.[val] != null).map(({ val, lbl }) => (
                          <button key={val} type="button"
                            className={`market-option ${oe1hPick === val ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = oe1hPick === val ? '' : val;
                              setOe1hPick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.OddEven1stHalf, pick: val === 'true' ? 'Odd' : 'Even',
                                odds: preOdds.oe1h[val],
                                leg: { bTTSPick: val === 'true' },
                                label: `Голове 1-во полувреме — ${val === 'true' ? 'Нечетен' : 'Четен'}`,
                                chip: val === 'true' ? 'НЕЧ' : 'ЧЕТ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.oe1h[val]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Asian Handicap (Sportmonks market 6) */}
                  {preOdds.ah?.line != null && preOdds.ah?.Home != null && preOdds.ah?.Away != null && (
                    <div data-cat="special" className={`market-section ${collapsed.ah ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection('ah')}>
                        <span className="market-section__name">
                          ⚖ Азиатски хендикап ({preOdds.ah.line > 0 ? '+' : ''}{Number(preOdds.ah.line).toFixed(preOdds.ah.line % 1 === 0 ? 0 : 1)})
                        </span>
                        <span className="market-section__toggle">{collapsed.ah ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed.ah && (
                        <div className="market-options market-options--2">
                          {[
                            { side: 'Home', lbl: selectedMatch.homeTeamName, line: preOdds.ah.line },
                            { side: 'Away', lbl: selectedMatch.awayTeamName, line: -preOdds.ah.line },
                          ].map(({ side, lbl, line }) => {
                            const o = preOdds.ah[side];
                            const slipKey = `${selectedMatch.id}:${BET_TYPE.AsianHandicap}:${side}:AH:${preOdds.ah.line}`;
                            const active  = ouPicks.has(slipKey);
                            const sign = line > 0 ? '+' : '';
                            const lineStr = line % 1 === 0 ? line.toFixed(0) : line.toFixed(2).replace(/0$/, '');
                            return (
                              <button key={side} type="button"
                                className={`market-option ${active ? 'market-option--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                  if (o == null) return;
                                  // We store the home-side line on the leg so the
                                  // backend can settle from a single source. For
                                  // an "Away" pick the user sees the flipped sign
                                  // but we send the home-perspective value.
                                  addToSlip({
                                    betType: BET_TYPE.AsianHandicap, pick: side, selKey: `AH:${preOdds.ah.line}`,
                                    odds: o,
                                    leg: { pick: side, lineValue: preOdds.ah.line },
                                    label: `${lbl} ${sign}${lineStr} (AH)`,
                                    chip: side === 'Home' ? `1 ${sign}${lineStr}` : `2 ${sign}${lineStr}`,
                                  });
                                }}>
                                <div className="market-option__label">{lbl} {sign}{lineStr}</div>
                                <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Alternative Asian Handicap (Sportmonks market 104) */}
                  {Object.keys(preOdds.ah?.alt ?? {}).length > 0 && (
                    <div data-cat="special" className={`market-section ${collapsed.ahAlt ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection('ahAlt')}>
                        <span className="market-section__name">⚖ AH — алтернативни линии</span>
                        <span className="market-section__toggle">{collapsed.ahAlt ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed.ahAlt && (
                        <div className="exact-score-grid">
                          {Object.entries(preOdds.ah.alt)
                            .map(([lineStr, pair]) => ({ line: Number(lineStr), pair }))
                            .filter(({ line }) => Number.isFinite(line))
                            .sort((a, b) => a.line - b.line)
                            .flatMap(({ line, pair }) => ([
                              { side: 'Home', line, odds: pair.home, lbl: selectedMatch.homeTeamName },
                              { side: 'Away', line: -line, homeLine: line, odds: pair.away, lbl: selectedMatch.awayTeamName },
                            ]))
                            .filter(({ odds }) => odds != null)
                            .map(({ side, line, homeLine, odds, lbl }) => {
                              const storedLine = side === 'Home' ? line : homeLine;
                              const sign = line > 0 ? '+' : '';
                              const lineStr = line % 1 === 0 ? line.toFixed(0) : line.toFixed(1);
                              const slipKey = `${selectedMatch.id}:${BET_TYPE.AsianHandicap}:${side}:AH:${storedLine}`;
                              const active  = ouPicks.has(slipKey);
                              return (
                                <button key={`${side}:${storedLine}`} type="button"
                                  className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                                  onClick={() => {
                                    setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                    addToSlip({
                                      betType: BET_TYPE.AsianHandicap, pick: side, selKey: `AH:${storedLine}`,
                                      odds,
                                      leg: { pick: side, lineValue: storedLine },
                                      label: `${lbl} ${sign}${lineStr} (AH)`,
                                      chip: `${side === 'Home' ? '1' : '2'} ${sign}${lineStr}`,
                                    });
                                  }}>
                                  <div className="exact-score-tile__label">{lbl} {sign}{lineStr}</div>
                                  <div className="exact-score-tile__odds">{Number(odds).toFixed(2)}</div>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1st Half Asian Handicap — main line (Sportmonks market 26) */}
                  {preOdds.ah1h?.line != null && preOdds.ah1h?.Home != null && preOdds.ah1h?.Away != null && (
                    <div data-cat="special" className={`market-section ${collapsed.ah1h ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection('ah1h')}>
                        <span className="market-section__name">
                          ⚖ AH 1-во полувреме ({preOdds.ah1h.line > 0 ? '+' : ''}{Number(preOdds.ah1h.line).toFixed(preOdds.ah1h.line % 1 === 0 ? 0 : 1)})
                        </span>
                        <span className="market-section__toggle">{collapsed.ah1h ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed.ah1h && (
                        <div className="market-options market-options--2">
                          {[
                            { side: 'Home', lbl: selectedMatch.homeTeamName, line: preOdds.ah1h.line },
                            { side: 'Away', lbl: selectedMatch.awayTeamName, line: -preOdds.ah1h.line },
                          ].map(({ side, lbl, line }) => {
                            const o = preOdds.ah1h[side];
                            const slipKey = `${selectedMatch.id}:${BET_TYPE.AsianHandicap1H}:${side}:AH1H:${preOdds.ah1h.line}`;
                            const active  = ouPicks.has(slipKey);
                            const sign = line > 0 ? '+' : '';
                            const lineStr = line % 1 === 0 ? line.toFixed(0) : line.toFixed(2).replace(/0$/, '');
                            return (
                              <button key={side} type="button"
                                className={`market-option ${active ? 'market-option--active' : ''}`}
                                onClick={() => {
                                  setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                  if (o == null) return;
                                  addToSlip({
                                    betType: BET_TYPE.AsianHandicap1H, pick: side, selKey: `AH1H:${preOdds.ah1h.line}`,
                                    odds: o,
                                    leg: { pick: side, lineValue: preOdds.ah1h.line },
                                    label: `${lbl} ${sign}${lineStr} (AH 1H)`,
                                    chip: `${side === 'Home' ? '1' : '2'} ${sign}${lineStr} 1H`,
                                  });
                                }}>
                                <div className="market-option__label">{lbl} {sign}{lineStr}</div>
                                <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Alternative 1H AH (Sportmonks market 106) */}
                  {Object.keys(preOdds.ah1h?.alt ?? {}).length > 0 && (
                    <div data-cat="special" className={`market-section ${collapsed.ah1hAlt ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection('ah1hAlt')}>
                        <span className="market-section__name">⚖ AH 1H — алтернативни линии</span>
                        <span className="market-section__toggle">{collapsed.ah1hAlt ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed.ah1hAlt && (
                        <div className="exact-score-grid">
                          {Object.entries(preOdds.ah1h.alt)
                            .map(([lineStr, pair]) => ({ line: Number(lineStr), pair }))
                            .filter(({ line }) => Number.isFinite(line))
                            .sort((a, b) => a.line - b.line)
                            .flatMap(({ line, pair }) => ([
                              { side: 'Home', line, odds: pair.home, lbl: selectedMatch.homeTeamName },
                              { side: 'Away', line: -line, homeLine: line, odds: pair.away, lbl: selectedMatch.awayTeamName },
                            ]))
                            .filter(({ odds }) => odds != null)
                            .map(({ side, line, homeLine, odds, lbl }) => {
                              const storedLine = side === 'Home' ? line : homeLine;
                              const sign = line > 0 ? '+' : '';
                              const lineStr = line % 1 === 0 ? line.toFixed(0) : line.toFixed(1);
                              const slipKey = `${selectedMatch.id}:${BET_TYPE.AsianHandicap1H}:${side}:AH1H:${storedLine}`;
                              const active  = ouPicks.has(slipKey);
                              return (
                                <button key={`${side}:${storedLine}`} type="button"
                                  className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                                  onClick={() => {
                                    setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                    addToSlip({
                                      betType: BET_TYPE.AsianHandicap1H, pick: side, selKey: `AH1H:${storedLine}`,
                                      odds,
                                      leg: { pick: side, lineValue: storedLine },
                                      label: `${lbl} ${sign}${lineStr} (AH 1H)`,
                                      chip: `${side === 'Home' ? '1' : '2'} ${sign}${lineStr} 1H`,
                                    });
                                  }}>
                                  <div className="exact-score-tile__label">{lbl} {sign}{lineStr}</div>
                                  <div className="exact-score-tile__odds">{Number(odds).toFixed(2)}</div>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}


                  {/* ── WC Knockout markets ── */}
                  {(() => {
                    const hasKnockout =
                      preOdds.extraTime?.true != null || preOdds.extraTime?.false != null ||
                      preOdds.penalties?.true != null || preOdds.penalties?.false != null ||
                      preOdds.methodVic?.Regulation != null;
                    if (!hasKnockout) return null;
                    return (
                      <>
                        {/* Going to Extra Time */}
                        <div data-cat="special" className={`market-section ${collapsed.extraTime ? 'market-section--collapsed' : ''}`}>
                          <div className="market-section__header" onClick={() => toggleSection('extraTime')}>
                            <span className="market-section__name">⏱ Мачът отива в продължения</span>
                            <span className="market-section__toggle">{collapsed.extraTime ? '▼' : '▲'}</span>
                          </div>
                          {!collapsed.extraTime && (
                            <div className="market-options market-options--2">
                              {[
                                { val: 'true',  lbl: 'Да' },
                                { val: 'false', lbl: 'Не' },
                              ].filter(({ val }) => preOdds.extraTime?.[val] != null).map(({ val, lbl }) => {
                                const o = preOdds.extraTime[val];
                                const slipKey = `${selectedMatch.id}:${BET_TYPE.ExtraTime}:${val}:ET`;
                                const active  = ouPicks.has(slipKey);
                                return (
                                  <button key={val} type="button"
                                    className={`market-option ${active ? 'market-option--active' : ''}`}
                                    onClick={() => {
                                      setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                      addToSlip({
                                        betType: BET_TYPE.ExtraTime, pick: val, selKey: 'ET',
                                        odds: o,
                                        leg: { bTTSPick: val === 'true' },
                                        label: `Продължения — ${lbl}`,
                                        chip: val === 'true' ? 'ET✓' : 'ET✗',
                                      });
                                    }}>
                                    <div className="market-option__label">{lbl}</div>
                                    <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Going to Penalties */}
                        <div data-cat="special" className={`market-section ${collapsed.penalties ? 'market-section--collapsed' : ''}`}>
                          <div className="market-section__header" onClick={() => toggleSection('penalties')}>
                            <span className="market-section__name">🥅 Мачът отива на дузпи</span>
                            <span className="market-section__toggle">{collapsed.penalties ? '▼' : '▲'}</span>
                          </div>
                          {!collapsed.penalties && (
                            <div className="market-options market-options--2">
                              {[
                                { val: 'true',  lbl: 'Да' },
                                { val: 'false', lbl: 'Не' },
                              ].filter(({ val }) => preOdds.penalties?.[val] != null).map(({ val, lbl }) => {
                                const o = preOdds.penalties[val];
                                const slipKey = `${selectedMatch.id}:${BET_TYPE.Penalties}:${val}:PEN`;
                                const active  = ouPicks.has(slipKey);
                                return (
                                  <button key={val} type="button"
                                    className={`market-option ${active ? 'market-option--active' : ''}`}
                                    onClick={() => {
                                      setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                      addToSlip({
                                        betType: BET_TYPE.Penalties, pick: val, selKey: 'PEN',
                                        odds: o,
                                        leg: { bTTSPick: val === 'true' },
                                        label: `Дузпи — ${lbl}`,
                                        chip: val === 'true' ? 'PEN✓' : 'PEN✗',
                                      });
                                    }}>
                                    <div className="market-option__label">{lbl}</div>
                                    <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Method of Victory */}
                        <div data-cat="special" className={`market-section ${collapsed.methodVic ? 'market-section--collapsed' : ''}`}>
                          <div className="market-section__header" onClick={() => toggleSection('methodVic')}>
                            <span className="market-section__name">🎲 Начин на победа</span>
                            <span className="market-section__toggle">{collapsed.methodVic ? '▼' : '▲'}</span>
                          </div>
                          {!collapsed.methodVic && (
                            <div className="market-options market-options--3">
                              {[
                                { k: 'Regulation', lbl: 'Редовно време' },
                                { k: 'ExtraTime',  lbl: 'Продължения'   },
                                { k: 'Penalties',  lbl: 'Дузпи'          },
                              ].filter(({ k }) => preOdds.methodVic?.[k] != null).map(({ k, lbl }) => {
                                const o = preOdds.methodVic[k];
                                const slipKey = `${selectedMatch.id}:${BET_TYPE.MethodOfVictory}:${k}:MOV`;
                                const active  = ouPicks.has(slipKey);
                                return (
                                  <button key={k} type="button"
                                    className={`market-option ${active ? 'market-option--active' : ''}`}
                                    onClick={() => {
                                      setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                      addToSlip({
                                        betType: BET_TYPE.MethodOfVictory, pick: k, selKey: 'MOV',
                                        odds: o,
                                        leg: { stringPick: k },
                                        label: `Решен в — ${lbl}`,
                                        chip: k === 'Regulation' ? 'REG' : k === 'ExtraTime' ? 'ET' : 'PEN',
                                      });
                                    }}>
                                    <div className="market-option__label">{lbl}</div>
                                    <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Result / Total Goals 2.5 combo (Sportmonks market 37) */}
                  {mv.rtg && (
                  <div data-cat="special" className={`market-section ${collapsed.rtg ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('rtg')}>
                      <span className="market-section__name">⊗ Резултат + Голове 2.5</span>
                      <span className="market-section__toggle">{collapsed.rtg ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.rtg && (
                      <div className="exact-score-grid">
                        {[
                          { k: 'HomeOver25',  lbl: `${selectedMatch.homeTeamName} & над 2.5` },
                          { k: 'HomeUnder25', lbl: `${selectedMatch.homeTeamName} & под 2.5` },
                          { k: 'DrawOver25',  lbl: 'Равен & над 2.5' },
                          { k: 'DrawUnder25', lbl: 'Равен & под 2.5' },
                          { k: 'AwayOver25',  lbl: `${selectedMatch.awayTeamName} & над 2.5` },
                          { k: 'AwayUnder25', lbl: `${selectedMatch.awayTeamName} & под 2.5` },
                        ].filter(({ k }) => preOdds.rtg?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.rtg[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.ResultTotalGoals}:${k}:RTG`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.ResultTotalGoals, pick: k, selKey: 'RTG',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `Резултат + 2.5 голa — ${lbl}`,
                                  chip: `${k.startsWith('Home') ? '1' : k.startsWith('Draw') ? 'X' : '2'}/${k.endsWith('Over25') ? 'O' : 'U'}2.5`,
                                });
                              }}>
                              <div className="exact-score-tile__label">{lbl}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Team Highest Scoring Half — Home (Sportmonks market 120) */}
                  {mv.thshHome && (
                  <div data-cat="halves" className={`market-section ${collapsed.thshHome ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('thshHome')}>
                      <span className="market-section__name">⊕ {selectedMatch.homeTeamName} — полувреме с повече голове</span>
                      <span className="market-section__toggle">{collapsed.thshHome ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.thshHome && (
                      <div className="market-options market-options--3">
                        {[
                          { k: '1stHalf', lbl: '1-во' },
                          { k: '2ndHalf', lbl: '2-ро' },
                          { k: 'Tie',     lbl: 'Равни' },
                        ].filter(({ k }) => preOdds.thsh?.Home?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.thsh.Home[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.TeamHighestScoringHalf}:Home${k}:THSH`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`market-option ${active ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.TeamHighestScoringHalf, pick: `Home${k}`, selKey: 'THSH',
                                  odds: o,
                                  leg: { pick: 'Home', stringPick: k },
                                  label: `${selectedMatch.homeTeamName} — повече голове в ${lbl}`,
                                  chip: `${selectedMatch.homeTeamName.slice(0,3)} ${lbl}`,
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Team Highest Scoring Half — Away (Sportmonks market 121) */}
                  {mv.thshAway && (
                  <div data-cat="halves" className={`market-section ${collapsed.thshAway ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('thshAway')}>
                      <span className="market-section__name">⊕ {selectedMatch.awayTeamName} — полувреме с повече голове</span>
                      <span className="market-section__toggle">{collapsed.thshAway ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.thshAway && (
                      <div className="market-options market-options--3">
                        {[
                          { k: '1stHalf', lbl: '1-во' },
                          { k: '2ndHalf', lbl: '2-ро' },
                          { k: 'Tie',     lbl: 'Равни' },
                        ].filter(({ k }) => preOdds.thsh?.Away?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.thsh.Away[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.TeamHighestScoringHalf}:Away${k}:THSH`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`market-option ${active ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.TeamHighestScoringHalf, pick: `Away${k}`, selKey: 'THSH',
                                  odds: o,
                                  leg: { pick: 'Away', stringPick: k },
                                  label: `${selectedMatch.awayTeamName} — повече голове в ${lbl}`,
                                  chip: `${selectedMatch.awayTeamName.slice(0,3)} ${lbl}`,
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Half with Most Goals (Sportmonks market 101) */}
                  {mv.hwmg && (
                  <div data-cat="halves" className={`market-section ${collapsed.hwmg ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('hwmg')}>
                      <span className="market-section__name">⊕ Полувреме с повече голове</span>
                      <span className="market-section__toggle">{collapsed.hwmg ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.hwmg && (
                      <div className="market-options market-options--3">
                        {[
                          { k: '1stHalf', lbl: '1-во полувреме' },
                          { k: '2ndHalf', lbl: '2-ро полувреме' },
                          { k: 'Tie',     lbl: 'Равни' },
                        ].filter(({ k }) => preOdds.hwmg?.[k] != null).map(({ k, lbl }) => {
                          const o = preOdds.hwmg[k];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.HalfWithMostGoals}:${k}:HWMG`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={k} type="button"
                              className={`market-option ${active ? 'market-option--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.HalfWithMostGoals, pick: k, selKey: 'HWMG',
                                  odds: o,
                                  leg: { stringPick: k },
                                  label: `Полувреме с повече голове — ${lbl}`,
                                  chip: k === '1stHalf' ? '1H>' : k === '2ndHalf' ? '2H>' : '1H=2H',
                                });
                              }}>
                              <div className="market-option__label">{lbl}</div>
                              <div className="market-option__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Score in Both Halves (Sportmonks market 88) */}
                  {mv.sbh && (
                  <div data-cat="special" className={`market-section ${collapsed.sbh ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('sbh')}>
                      <span className="market-section__name">⋈ Отбор бележи в двете полувремена</span>
                      <span className="market-section__toggle">{collapsed.sbh ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.sbh && (
                      <div className="exact-score-grid">
                        {[
                          { side: 'Home', yn: 'true',  lbl: `${selectedMatch.homeTeamName} / Да` },
                          { side: 'Home', yn: 'false', lbl: `${selectedMatch.homeTeamName} / Не` },
                          { side: 'Away', yn: 'true',  lbl: `${selectedMatch.awayTeamName} / Да` },
                          { side: 'Away', yn: 'false', lbl: `${selectedMatch.awayTeamName} / Не` },
                        ].filter(({ side, yn }) => preOdds.sbh?.[side]?.[yn] != null).map(({ side, yn, lbl }) => {
                          const o = preOdds.sbh[side][yn];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.ScoreBothHalves}:${side}${yn === 'true' ? 'Yes' : 'No'}:SBH`;
                          const active  = ouPicks.has(slipKey);
                          return (
                            <button key={`${side}-${yn}`} type="button"
                              className={`exact-score-tile ${active ? 'exact-score-tile--active' : ''}`}
                              onClick={() => {
                                setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                addToSlip({
                                  betType: BET_TYPE.ScoreBothHalves,
                                  pick: side, selKey: 'SBH',
                                  odds: o,
                                  leg: { pick: side, bTTSPick: yn === 'true' },
                                  label: `Бележи в двете полувремена — ${lbl}`,
                                  chip: `${side === 'Home' ? '1' : '2'}↔${yn === 'true' ? 'Y' : 'N'}`,
                                });
                              }}>
                              <div className="exact-score-tile__label">{lbl}</div>
                              <div className="exact-score-tile__odds">{Number(o).toFixed(2)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Odd / Even Goals — 2nd Half (Sportmonks market 124) */}
                  {mv.oe2h && (
                  <div data-cat="halves" className={`market-section ${collapsed.oe2h ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('oe2h')}>
                      <span className="market-section__name">≈ Голове — Нечетен / Четен — 2-ро полувреме</span>
                      <span className="market-section__toggle">{collapsed.oe2h ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.oe2h && (
                      <div className="market-options market-options--2">
                        {[{ val: 'true', lbl: 'Odd' }, { val: 'false', lbl: 'Even' }].filter(({ val }) => preOdds.oe2h?.[val] != null).map(({ val, lbl }) => {
                          const o = preOdds.oe2h[val];
                          const slipKey = `${selectedMatch.id}:${BET_TYPE.SecondHalfOddEven}:${val === 'true' ? 'Odd' : 'Even'}:OE2H`;
                          const active = ouPicks.has(slipKey);
                          return (
                          <button key={val} type="button"
                            className={`market-option ${active ? 'market-option--active' : ''}`}
                            onClick={() => {
                              setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                              addToSlip({
                                betType: BET_TYPE.SecondHalfOddEven, pick: val === 'true' ? 'Odd' : 'Even', selKey: 'OE2H',
                                odds: o,
                                leg: { bTTSPick: val === 'true' },
                                label: `Голове 2-ро полувреме — ${val === 'true' ? 'Нечетен' : 'Четен'}`,
                                chip: val === 'true' ? '2H НЕЧ' : '2H ЧЕТ',
                              });
                            }}>
                            <div className="market-option__label">{lbl}</div>
                            <div className="market-option__odds">
                              {Number(o).toFixed(2)}
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Team to Score */}
                  {mv.teamTs && (
                  <div data-cat="special" className={`market-section ${collapsed.teamTs ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('teamTs')}>
                      <span className="market-section__name">→ Отбор отбелязва</span>
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
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].filter(({ yn }) => preOdds[key]?.[yn] != null).map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${teamPick === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    const next = teamPick === yn ? '' : yn;
                                    setPick(next);
                                    if (next) addToSlip({
                                      betType: BET_TYPE.TeamToScore, pick: val, selKey: `TS-${val}`,
                                      odds: preOdds[key][yn],
                                      leg: { pick: val, bTTSPick: yn === 'true' },
                                      label: `${lbl} да отбележи — ${yn === 'true' ? 'Да' : 'Не'}`,
                                      chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                    });
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {Number(preOdds[key][yn]).toFixed(2)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Win Both Halves */}
                  {mv.wbh && (
                  <div data-cat="halves" className={`market-section ${collapsed.wbh ? 'market-section--collapsed' : ''}${dis.wbh ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.wbh && toggleSection('wbh')} style={dis.wbh ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">◆ Печели и двете полувремена</span>
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
                              {[{ yn: 'true', lbl2: 'Yes' }, { yn: 'false', lbl2: 'No' }].filter(({ yn }) => preOdds.wbh?.[val]?.[yn] != null).map(({ yn, lbl2 }) => (
                                <button key={yn} type="button"
                                  className={`market-option ${teamPick === yn ? 'market-option--active' : ''}`}
                                  onClick={() => {
                                    const next = teamPick === yn ? '' : yn;
                                    setPick(next);
                                    if (next) addToSlip({
                                      betType: BET_TYPE.WinBothHalves, pick: val, selKey: `WBH-${val}`,
                                      odds: preOdds.wbh[val][yn],
                                      leg: { pick: val, bTTSPick: yn === 'true' },
                                      label: `${lbl} печели и двете полувремена — ${yn === 'true' ? 'Да' : 'Не'}`,
                                      chip: `${val === 'Home' ? '1' : '2'}${yn === 'true' ? '✓' : '✗'}`,
                                    });
                                  }}>
                                  <div className="market-option__label">{lbl2}</div>
                                  <div className="market-option__odds">
                                    {Number(preOdds.wbh[val][yn]).toFixed(2)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Last Team to Score */}
                  {mv.lastScore && (
                  <div data-cat="main" className={`market-section ${collapsed.lastScore ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('lastScore')}>
                      <span className="market-section__name">◇ Последен гол на</span>
                      {lastScorePick && <span className="market-section__badge">{lastScorePick === 'Home' ? selectedMatch.homeTeamName : lastScorePick === 'Away' ? selectedMatch.awayTeamName : 'No Goal'}</span>}
                      <span className="market-section__toggle">{collapsed.lastScore ? '▼' : '▲'}</span>
                    </div>
                    {!collapsed.lastScore && (
                      <div className="market-options market-options--3">
                        {[
                          { key: 'Home', label: selectedMatch.homeTeamName },
                          { key: 'Draw', label: 'No Goal' },
                          { key: 'Away', label: selectedMatch.awayTeamName },
                        ].filter(({ key }) => preOdds.lastScore?.[key] != null).map(({ key, label }) => (
                          <button key={key} type="button"
                            className={`market-option ${lastScorePick === key ? 'market-option--active' : ''}`}
                            onClick={() => {
                              const next = lastScorePick === key ? '' : key;
                              setLastScorePick(next);
                              if (next) addToSlip({
                                betType: BET_TYPE.LastToScore, pick: key,
                                odds: preOdds.lastScore[key],
                                leg: { pick: key },
                                label: `Последен гол — ${label}`,
                                chip: key === 'Home' ? '1' : key === 'Away' ? '2' : 'НГ',
                              });
                            }}>
                            <div className="market-option__label">{label}</div>
                            <div className="market-option__odds">
                              {Number(preOdds.lastScore[key]).toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* HT / FT */}
                  {mv.htft && (
                  <div data-cat="main" className={`market-section ${collapsed.htft ? 'market-section--collapsed' : ''}${dis.htft ? ' market-section--locked' : ''}`}>
                    <div className="market-section__header" onClick={() => !dis.htft && toggleSection('htft')} style={dis.htft ? { cursor: 'default', opacity: 0.45 } : {}}>
                      <span className="market-section__name">↕ Полувреме / Краен резултат</span>
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
                          {htftOptions.filter(({ key }) => preOdds.htft?.[key] != null).map(({ key, ht, ft }) => (
                            <button key={key} type="button"
                              className={`market-option market-option--htft ${htftPick === key ? 'market-option--active' : ''}`}
                              title={`${ht} / ${ft}`}
                              onClick={() => {
                                const next = htftPick === key ? '' : key;
                                setHtftPick(next);
                                if (next) addToSlip({
                                  betType: BET_TYPE.HtFt, pick: key,
                                  odds: preOdds.htft[key],
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
                                {Number(preOdds.htft[key]).toFixed(2)}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  )}

                  {/* Goalscorer */}
                  <div data-cat="goals" className={`market-section ${collapsed.scorer ? 'market-section--collapsed' : ''}`}>
                    <div className="market-section__header" onClick={() => toggleSection('scorer')}>
                      <span className="market-section__name">◉ Голмайстор</span>
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

                  {/* ── Phase 8: Team Shots on Target O/U ── */}
                  {[
                    { key: 'teamSot',      bt: BET_TYPE.TeamShotsOnTarget,  label: 'Удари в рамката (отбор)' },
                    { key: 'teamShots',    bt: BET_TYPE.TeamShots,          label: 'Удари (отбор)' },
                    { key: 'teamOffsides', bt: BET_TYPE.TeamOffsides,       label: 'Засади (отбор)' },
                    { key: 'teamTackles',  bt: BET_TYPE.TeamTackles,        label: 'Откраднати топки (отбор)' },
                  ].map(({ key, bt, label }) => (
                    <div key={key} data-cat="special" className={`market-section ${collapsed[key] ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection(key)}>
                        <span className="market-section__name">📊 {label}</span>
                        <span className="market-section__toggle">{collapsed[key] ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed[key] && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 14px' }}>
                          {[{ side: 'Home', teamName: selectedMatch.homeTeamName }, { side: 'Away', teamName: selectedMatch.awayTeamName }].map(({ side, teamName }) => (
                            <div key={side}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>{teamName}</div>
                              <div className="ou-table">
                                <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                                {Object.entries(statOdds[bt]?.[side] ?? {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([l, picks]) => (
                                  <div key={l} className="ou-table__row">
                                    <span className="ou-table__line">{l}</span>
                                    {['Over', 'Under'].filter(p => picks[p] != null).map(p => {
                                      const k = `${selectedMatch.id}:${bt}:${p}:${side}-${l}`;
                                      const preO = picks[p];
                                      return (
                                        <button key={p} type="button"
                                          className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                          onClick={() => {
                                            setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                            addToSlip({
                                              betType: bt, pick: p, selKey: `${side}-${l}`,
                                              odds: preO,
                                              leg: { pick: side, lineValue: l, oUPick: p },
                                              label: `${teamName} ${label} ${p === 'Over' ? 'над' : 'под'} ${l}`,
                                              chip: `${p === 'Over' ? 'O' : 'U'}${l}`,
                                            });
                                          }}>
                                          {Number(preO).toFixed(2)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* ── Phase 8: Match-level stat O/U ── */}
                  {[
                    { key: 'matchSot',      bt: BET_TYPE.MatchShotsOnTarget, label: 'Удари в рамката (мач)' },
                    { key: 'matchShots',    bt: BET_TYPE.MatchShots,         label: 'Удари (мач)' },
                    { key: 'matchOffsides', bt: BET_TYPE.MatchOffsides,      label: 'Засади (мач)' },
                    { key: 'matchTackles',  bt: BET_TYPE.MatchTackles,       label: 'Откраднати топки (мач)' },
                  ].map(({ key, bt, label }) => (
                    <div key={key} data-cat="special" className={`market-section ${collapsed[key] ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection(key)}>
                        <span className="market-section__name">📊 {label}</span>
                        <span className="market-section__toggle">{collapsed[key] ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed[key] && (
                        <div className="ou-table" style={{ padding: '10px 14px' }}>
                          <div className="ou-table__subheader"><span></span><span>OVER</span><span>UNDER</span></div>
                          {Object.entries(statOdds[bt] ?? {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([l, picks]) => (
                            <div key={l} className="ou-table__row">
                              <span className="ou-table__line">{l}</span>
                              {['Over', 'Under'].filter(p => picks[p] != null).map(p => {
                                const k = `${selectedMatch.id}:${bt}:${p}:MST-${l}`;
                                const preO = picks[p];
                                return (
                                  <button key={p} type="button"
                                    className={`ou-cell ${ouPicks.has(k) ? 'ou-cell--active' : ''}`}
                                    onClick={() => {
                                      setOuPicks(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
                                      addToSlip({
                                        betType: bt, pick: p, selKey: `MST-${l}`,
                                        odds: preO,
                                        leg: { lineValue: l, oUPick: p },
                                        label: `${label} ${p === 'Over' ? 'над' : 'под'} ${l}`,
                                        chip: `${p === 'Over' ? 'O' : 'U'}${l}`,
                                      });
                                    }}>
                                    {Number(preO).toFixed(2)}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* ── Phase 8: Player to Assist / Score or Assist ── */}
                  {[
                    { key: 'playerAssist', bt: BET_TYPE.PlayerAssist,        label: '🅰️ Асистенция', chipLabel: 'AST' },
                    { key: 'playerSoa',    bt: BET_TYPE.PlayerScoreOrAssist, label: '⚡ Гол или асистенция', chipLabel: 'G/A' },
                  ].map(({ key, bt, label, chipLabel }) => (
                    <div key={key} data-cat="goals" className={`market-section ${collapsed[key] ? 'market-section--collapsed' : ''}`}>
                      <div className="market-section__header" onClick={() => toggleSection(key)}>
                        <span className="market-section__name">{label}</span>
                        <span className="market-section__toggle">{collapsed[key] ? '▼' : '▲'}</span>
                      </div>
                      {!collapsed[key] && (
                        <div style={{ padding: '12px 16px' }}>
                          {scorerLoading && <div className="muted-text" style={{ fontSize: '0.82rem' }}>Loading players...</div>}
                          {!scorerLoading && scorerPlayers.length === 0 && (
                            <div className="muted-text" style={{ fontSize: '0.78rem' }}>No players found</div>
                          )}
                          {!scorerLoading && scorerPlayers.length > 0 && (
                            <div className="gs-list">
                              {(() => {
                                const oddsMap = key === 'playerAssist' ? assistOdds : soaOdds;
                                return [...scorerPlayers]
                                  .filter(p => oddsMap[p.playerId] != null)
                                  .sort((a, b) => oddsMap[a.playerId] - oddsMap[b.playerId])
                                  .map(p => {
                                    const logo = p.isHome ? selectedMatch.homeTeamLogo : selectedMatch.awayTeamLogo;
                                    const team = p.isHome ? selectedMatch.homeTeamName : selectedMatch.awayTeamName;
                                    const slipKey = `${selectedMatch.id}:${bt}:${p.playerId}:${chipLabel}`;
                                    const active = ouPicks.has(slipKey);
                                    const preOddsVal = oddsMap[p.playerId];
                                    return (
                                      <button key={p.playerId} type="button" className={`gs-row${active ? ' gs-row--active' : ''}`}
                                        onClick={() => {
                                          setOuPicks(s => { const n = new Set(s); n.has(slipKey) ? n.delete(slipKey) : n.add(slipKey); return n; });
                                          addToSlip({
                                            betType: bt, pick: String(p.playerId), selKey: `${chipLabel}-${p.playerId}`,
                                            odds: preOddsVal,
                                            leg: { goalscorerId: p.playerId },
                                            label: `${label} — ${p.name}`,
                                            chip: chipLabel,
                                          });
                                        }}>
                                        <span className="gs-row__crest">
                                          {logo
                                            ? <img src={logo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                            : <span className="gs-row__crest-fallback">{(team || '?').slice(0, 1)}</span>}
                                        </span>
                                        <span className="gs-row__name">{p.name}</span>
                                        <span className="gs-row__odds">{Number(preOddsVal).toFixed(2)}</span>
                                      </button>
                                    );
                                  });
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

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
