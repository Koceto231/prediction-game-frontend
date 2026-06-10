/**
 * Constants and tiny helpers extracted from MatchesPage.jsx.
 *
 * The page used to declare these inline alongside ~2 000 lines of JSX,
 * which made it impossible to find anything. They're all data — no React
 * state, no DOM — so they belong in their own pure module.
 */
import api from '../api/apiClient';

// ── Enum mirrors of the C# BetType / MatchWinner / … types ───────────
// String-named so they JSON-serialise straight into the request DTOs.
export const BET_TYPE = {
  Winner:           'Winner',
  ExactScore:       'ExactScore',
  BTTS:             'BTTS',
  OverUnder:        'OverUnder',
  Goalscorer:       'Goalscorer',
  Corners:          'Corners',
  YellowCards:      'YellowCards',
  DoubleChance:     'DoubleChance',
  OddEven:          'OddEven',
  DrawNoBet:        'DrawNoBet',
  Handicap:         'Handicap',
  WinToNil:         'WinToNil',
  TeamGoals:        'TeamGoals',
  HalfTime:         'HalfTime',
  CleanSheet:       'CleanSheet',
  FirstGoal:        'FirstGoal',
  Btts1stHalf:      'Btts1stHalf',
  Btts2ndHalf:      'Btts2ndHalf',
  HalfTimeGoals:    'HalfTimeGoals',
  SecondHalfGoals:  'SecondHalfGoals',
  TeamOddEven:      'TeamOddEven',
  OddEven1stHalf:   'OddEven1stHalf',
  TeamToScore:      'TeamToScore',
  WinBothHalves:    'WinBothHalves',
  LastToScore:      'LastToScore',
  HtFt:             'HtFt',
  DoubleChance1stHalf:  'DoubleChance1stHalf',
  HalfTimeCorrectScore: 'HalfTimeCorrectScore',
  ExactTotalGoals:      'ExactTotalGoals',
  WinningMargin:        'WinningMargin',
  NumberOfGoals:        'NumberOfGoals',
  BttsHalfByHalf:       'BttsHalfByHalf',
  HtResultBtts:         'HtResultBtts',
  SecondHalfOddEven:    'SecondHalfOddEven',
  ScoreBothHalves:      'ScoreBothHalves',
  HalfWithMostGoals:    'HalfWithMostGoals',
  TeamHighestScoringHalf: 'TeamHighestScoringHalf',
  ResultTotalGoals:     'ResultTotalGoals',
  WinEitherHalf:        'WinEitherHalf',
  // ── WC knockout ────────────────────────────────────────────────
  ToQualify:            'ToQualify',
  ExtraTime:            'ExtraTime',
  Penalties:            'Penalties',
  MethodOfVictory:      'MethodOfVictory',
  AsianHandicap:        'AsianHandicap',
  AsianHandicap1H:      'AsianHandicap1H',
  TeamToScorePenalty:   'TeamToScorePenalty',
  TeamToMissPenalty:    'TeamToMissPenalty',
  // ── Phase 8 (Stats markets) ────────────────────────────────────────
  TeamShotsOnTarget:    'TeamShotsOnTarget',
  TeamShots:            'TeamShots',
  TeamOffsides:         'TeamOffsides',
  TeamTackles:          'TeamTackles',
  MatchShotsOnTarget:   'MatchShotsOnTarget',
  MatchShots:           'MatchShots',
  MatchOffsides:        'MatchOffsides',
  MatchTackles:         'MatchTackles',
  PlayerAssist:         'PlayerAssist',
  PlayerScoreOrAssist:  'PlayerScoreOrAssist',
  // ── Phase 9 (First Goal / Team Exact Goals) ──────────────────────────
  FirstGoalMethod:      'FirstGoalMethod',
  HomeTeamExactGoals:   'HomeTeamExactGoals',
  AwayTeamExactGoals:   'AwayTeamExactGoals',
};

/** Pick options for the Exact Total Goals (market 93) tile grid. */
export const EXACT_TOTAL_GOALS_PICKS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

/** Winning Margin picks — short codes the backend understands. */
export const WINNING_MARGIN_PICKS = ['H1', 'H2', 'H3+', 'A1', 'A2', 'A3+', 'Draw', 'NoGoal'];

export const WINNER_MAP      = { Home: 'Home', Draw: 'Draw', Away: 'Away' };
export const OU_LINE_MAP     = { Line05: 'Line05', Line15: 'Line15', Line25: 'Line25', Line35: 'Line35' };
export const OU_LINE_DECIMAL = { Line05: '0.5', Line15: '1.5', Line25: '2.5', Line35: '3.5' };
export const OU_DECIMAL_TO_LINE = { '0.5': 'Line05', '1.5': 'Line15', '2.5': 'Line25', '3.5': 'Line35' };
export const OU_PICK_MAP = { Over: 'Over', Under: 'Under' };

export const DC_OPTIONS = [
  { key: 'HomeOrDraw', label: '1X' },
  { key: 'HomeOrAway', label: '12' },
  { key: 'DrawOrAway', label: 'X2' },
];

export const CORNER_LINES    = [8.5, 9.5, 10.5];
export const YELLOW_LINES    = [2.5, 3.5, 4.5];
export const TEAM_GOAL_LINES = [0.5, 1.5, 2.5];

// Phase 8 stat market lines
export const TEAM_SOT_LINES    = [2.5, 3.5, 4.5];   // shots on target per team
export const TEAM_SHOTS_LINES  = [10.5, 12.5, 14.5]; // shots per team
export const TEAM_OFFSIDES_LINES = [1.5, 2.5, 3.5];
export const TEAM_TACKLES_LINES  = [14.5, 17.5, 20.5];
export const MATCH_SOT_LINES    = [6.5, 8.5, 10.5];  // total match shots on target
export const MATCH_SHOTS_LINES  = [22.5, 25.5, 28.5];
export const MATCH_OFFSIDES_LINES = [3.5, 4.5, 5.5];
export const MATCH_TACKLES_LINES  = [29.5, 33.5, 37.5];

// ── Client-side Poisson odds (mirrors server-side PoissonCdfOver + ToOdds) ──
// Precomputed so stat market buttons show prices instantly without API calls.
const _HOUSE = 0.90;
const _MIN   = 1.05;

function _cdfOver(lambda, k) {
  const n = Math.floor(k);
  let sum = 0, term = Math.exp(-lambda);
  sum = term;
  for (let i = 1; i <= n; i++) { term *= lambda / i; sum += term; }
  return 1 - sum;
}

function _toOdds(p) {
  if (p <= 0) return _MIN;
  return Math.max(Math.round(_HOUSE / p * 100) / 100, _MIN);
}

/** Returns { [line]: { Over: decimal, Under: decimal } } for a given Poisson λ and line list. */
export function buildStatLineOdds(lambda, lines) {
  const r = {};
  for (const l of lines) {
    const p = _cdfOver(lambda, l);
    r[l] = { Over: _toOdds(p), Under: _toOdds(1 - p) };
  }
  return r;
}

// Server-side averages (must stay in sync with OddsService.cs constants)
export const STAT_AVGS = {
  TeamShotsOnTarget:  4.2,
  TeamShots:         13.0,
  TeamOffsides:       2.3,
  TeamTackles:       17.0,
  MatchShotsOnTarget: 8.4,
  MatchShots:        26.0,
  MatchOffsides:      4.6,
  MatchTackles:      34.0,
};

export const POS_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/** Empty form state shared by `setField` resets across the bet panel. */
export const EMPTY_FORM = {
  homeScore: '',
  awayScore: '',
  winner:    '',
  btts:      '',
  ouLine:    '',
  ouPick:    '',
};

/** Convert a numeric goal line like 2.5 to the enum key form "Line25". */
export const lineToKey = (l) => `Line${String(l).replace('.', '')}`;

/** Number-or-null parser for score inputs. */
export const parseScore = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Fetch price for a given market from the backend; swallows network errors. */
export async function fetchOdds(matchId, betType, params = {}) {
  const qs = new URLSearchParams({ betType, ...params });
  try {
    const r = await api.get(`/Odds/${matchId}?${qs}`);
    return r.data ?? null;
  } catch {
    return null;
  }
}

// ── Leagues ──────────────────────────────────────────────────────────
export const LEAGUE_LIST = [
  { code: null,  label: 'All Leagues',    flag: '◈' },
  { code: 'PL',  label: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'BL1', label: 'Bundesliga',     flag: '🇩🇪' },
  { code: 'SA',  label: 'Serie A',        flag: '🇮🇹' },
  { code: 'PD',  label: 'La Liga',        flag: '🇪🇸' },
  { code: 'BGL', label: 'Efbet Liga',     flag: '🇧🇬' },
  { code: 'WC',  label: 'World Cup',      flag: '🏆' },
];
