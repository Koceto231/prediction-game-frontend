import { useEffect, useRef, useState } from 'react';

/**
 * Anti-cheat live odds suspension.
 *
 * A user watching the broadcast sees a goal / VAR check / dangerous attack a
 * few seconds before our odds catch up, so they could bet at stale odds.
 * To prevent that we LOCK live betting for a short window whenever one of
 * these moments is detected from the live snapshot:
 *
 *   • GOAL            — home/away score increased        (lock ~12s)
 *   • VAR             — a new `extraEvents` var entry      (lock ~18s)
 *   • DANGEROUS ATTACK— `dangerousAttacks.{home|away}` rose (lock ~5s)
 *
 * Returns `null` when betting is open, otherwise `{ kind, reason, until }`.
 * A longer/higher-priority lock is never shortened by a weaker one.
 */
const DURATION = { goal: 12_000, var: 18_000, danger: 5_000 };
const PRIORITY = { goal: 3, var: 2, danger: 1 };
const REASON   = {
  goal:   'Гол — коефициентите се обновяват',
  var:    'VAR проверка',
  danger: 'Опасна атака',
};

export default function useOddsSuspension(match) {
  const [lock, setLock] = useState(null); // { kind, reason, until } | null
  const prevRef = useRef(null);

  // Detect a trigger on each live snapshot
  useEffect(() => {
    if (!match) { prevRef.current = null; setLock(null); return; }

    const stats = match.liveStats;
    const curr = {
      matchId:    match.id,
      homeScore:  match.homeScore ?? 0,
      awayScore:  match.awayScore ?? 0,
      dangerHome: stats?.dangerousAttacks?.home ?? 0,
      dangerAway: stats?.dangerousAttacks?.away ?? 0,
      varCount:   (stats?.extraEvents ?? []).filter(e => e.kind === 'var').length,
    };
    const prev = prevRef.current;
    prevRef.current = curr;

    // Switching matches — reset, skip first-snapshot diff (avoids phantom locks)
    if (!prev || prev.matchId !== curr.matchId) { setLock(null); return; }

    let kind = null;
    if (curr.homeScore > prev.homeScore || curr.awayScore > prev.awayScore) kind = 'goal';
    else if (curr.varCount > prev.varCount)                                  kind = 'var';
    else if (curr.dangerHome > prev.dangerHome || curr.dangerAway > prev.dangerAway) kind = 'danger';

    if (!kind) return;

    const until = Date.now() + DURATION[kind];
    setLock(cur => {
      // Keep the existing lock if it's stronger AND still lasts longer.
      if (cur && PRIORITY[cur.kind] >= PRIORITY[kind] && cur.until >= until) return cur;
      return { kind, reason: REASON[kind], until };
    });
  }, [match]);

  // Auto-release when the window elapses
  useEffect(() => {
    if (!lock) return;
    const ms = lock.until - Date.now();
    if (ms <= 0) { setLock(null); return; }
    const t = setTimeout(() => setLock(null), ms);
    return () => clearTimeout(t);
  }, [lock]);

  return lock;
}
