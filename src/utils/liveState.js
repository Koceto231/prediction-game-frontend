// ──────────────────────────────────────────────────────────────────────────
// Sportmonks-v3 state helpers
// ──────────────────────────────────────────────────────────────────────────
// The backend now passes through Sportmonks' raw `developer_name` value in
// Match.LiveState. Sportmonks v3 uses LONG names (INPLAY_1ST_HALF), but
// older data already in the DB plus a few backend fallback paths still emit
// the short legacy aliases (1H). Treat both as equivalent everywhere on
// the client.
// ──────────────────────────────────────────────────────────────────────────

export const ACTIVE_STATES = new Set([
  // v3 long names
  'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_PENALTIES',
  'HT', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK',
  'INTERRUPTED', 'SUSPENDED',
  // short legacy aliases
  'LIVE', '1H', '2H', 'ET', 'PEN_LIVE', 'INT',
]);

export const FINAL_STATES = new Set([
  // v3 long names
  'FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED',
  'WALKOVER', 'WO', 'AWARDED', 'DELETED',
  // short legacy aliases
  'FTP', 'ABD', 'CANC', 'AWRD',
]);

// Derive 1-3 letter initials from a club name for use as a fallback crest
// inside team-shield circles when there's no Sportmonks logo URL yet.
export function getTeamInitials(name) {
  if (!name) return '?';
  const words = String(name).trim().split(/\s+/).filter(w => !/^(FC|CF|AC|SC|AFC|CFR|JK|KS|US|RB)$/i.test(w));
  if (words.length === 0) return String(name).slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0] + (words[2]?.[0] ?? '')).toUpperCase();
}

// Specific phase helpers — each accepts either the long or short form.
export const is1H = s => s === 'INPLAY_1ST_HALF' || s === '1H';
export const is2H = s => s === 'INPLAY_2ND_HALF' || s === '2H';
export const isHT = s => s === 'HT' || s === 'INT' || s === 'INTERRUPTED' || s === 'BREAK';
export const isET = s => s === 'INPLAY_ET' || s === 'ET' || s === 'EXTRA_TIME_BREAK';
export const isFT = s => s === 'FT' || s === 'AET' || s === 'FT_PEN' || s === 'FTP';
export const isFinal = s => FINAL_STATES.has(s);
export const isActive = s => ACTIVE_STATES.has(s);

// ──────────────────────────────────────────────────────────────────────────
// Live clock helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns a string suitable for the LIVE minute badge.
 * Inputs:
 *   liveMinute         — Sportmonks `periods.minutes` (cumulative — 67 means 67th min overall)
 *   liveSeconds        — `periods.seconds` at the moment the API was sampled
 *   liveClockUpdatedAt — ISO UTC string of when we received those values
 *   liveState          — for HT / FT / pre-match short-circuits
 *
 * Display rules (per user request):
 *   • Round UP — at 45:01 we show "46'", not "45'".
 *   • Once the rounded value exceeds 90, switch to "90+N'" injury-time format.
 *   • Once the rounded value exceeds 45 (and we're still in 1H), switch to "45+N'".
 *   • Interpolate locally — between API cycles we keep ticking by adding
 *     (now − liveClockUpdatedAt) onto the snapshot, so the badge feels smooth.
 *   • Returns null if we don't have the data — callers should fall back.
 */
export function liveClockDisplay({
  liveMinute,
  liveSeconds,
  liveClockUpdatedAt,
  liveState,
}, nowMs = Date.now()) {
  if (isHT(liveState)) return 'HT';
  if (isFT(liveState)) return 'FT';
  if (liveMinute == null) return null;

  const baseSec   = liveMinute * 60 + (liveSeconds ?? 0);
  const elapsedMs = liveClockUpdatedAt
    ? Math.max(0, nowMs - new Date(liveClockUpdatedAt).getTime())
    : 0;
  // Cap interpolation at +90s — if backend hasn't refreshed in 90s the value
  // is probably stale (Sportmonks dropped data) and we don't want to drift forever.
  const totalSec  = baseSec + Math.min(elapsedMs, 90_000) / 1000;
  // Round UP per user request: 45:01 → 46
  const display   = Math.floor(totalSec / 60) + (totalSec % 60 > 0 ? 1 : 0);

  // 2H stoppage time
  if (display > 90) return `90+${display - 90}'`;
  // 1H stoppage time (still in 1H)
  if (display > 45 && is1H(liveState)) return `45+${display - 45}'`;
  return `${display}'`;
}

/**
 * Same inputs as liveClockDisplay but returns a ticking "MM:SS" string for a
 * stopwatch-style clock (e.g. "11:34"). Returns "HT"/"FT" on breaks and null
 * when we have no clock data (caller falls back to the minute-only display).
 */
export function liveClockSeconds({
  liveMinute,
  liveSeconds,
  liveClockUpdatedAt,
  liveState,
}, nowMs = Date.now()) {
  if (isHT(liveState)) return 'HT';
  if (isFT(liveState)) return 'FT';
  if (liveMinute == null) return null;

  const baseSec   = liveMinute * 60 + (liveSeconds ?? 0);
  const elapsedMs = liveClockUpdatedAt
    ? Math.max(0, nowMs - new Date(liveClockUpdatedAt).getTime())
    : 0;
  const totalSec  = Math.floor(baseSec + Math.min(elapsedMs, 90_000) / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
