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
};

/** Pick options for the Exact Total Goals (market 93) tile grid. */
export const EXACT_TOTAL_GOALS_PICKS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

/** Winning Margin picks — short codes the backend understands. */
export const WINNING_MARGIN_PICKS = ['H1', 'H2', 'H3+', 'A1', 'A2', 'A3+', 'Draw', 'NoGoal'];

export const WINNER_MAP  = { Home: 'Home', Draw: 'Draw', Away: 'Away' };
export const OU_LINE_MAP = { Line05: 'Line05', Line15: 'Line15', Line25: 'Line25', Line35: 'Line35' };
export const OU_PICK_MAP = { Over: 'Over', Under: 'Under' };

export const DC_OPTIONS = [
  { key: 'HomeOrDraw', label: '1X' },
  { key: 'HomeOrAway', label: '12' },
  { key: 'DrawOrAway', label: 'X2' },
];

export const CORNER_LINES    = [8.5, 9.5, 10.5];
export const YELLOW_LINES    = [2.5, 3.5, 4.5];
export const TEAM_GOAL_LINES = [0.5, 1.5, 2.5];

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
