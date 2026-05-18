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

// Specific phase helpers — each accepts either the long or short form.
export const is1H = s => s === 'INPLAY_1ST_HALF' || s === '1H';
export const is2H = s => s === 'INPLAY_2ND_HALF' || s === '2H';
export const isHT = s => s === 'HT' || s === 'INT' || s === 'INTERRUPTED' || s === 'BREAK';
export const isET = s => s === 'INPLAY_ET' || s === 'ET' || s === 'EXTRA_TIME_BREAK';
export const isFT = s => s === 'FT' || s === 'AET' || s === 'FT_PEN' || s === 'FTP';
export const isFinal = s => FINAL_STATES.has(s);
export const isActive = s => ACTIVE_STATES.has(s);
