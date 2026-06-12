import { useEffect, useRef, useState } from 'react';

/**
 * Anti-cheat live odds suspension.
 *
 * A user watching the broadcast sees a goal / VAR check a few seconds before
 * our odds catch up, so they could bet at stale odds. To prevent that we LOCK
 * live betting for a short window whenever one of these moments is detected:
 *
 *   • GOAL — home/away score increased          (lock ~12s)
 *   • VAR  — a "under review" var event          (lock until resolved,
 *             capped at ~25s as a safety net)
 *
 * The backend also sets SuspendedUntil (45s for goals, 25s for VAR) via
 * LiveScoreDetectorJob — this hook acts as a fast client-side complement.
 *
 * VAR is special: Sportmonks emits the review start ("Goal under review") and
 * later the decision ("Goal Confirmed/Disallowed", "Penalty Awarded/Cancelled")
 * in the event's `addition` text (surfaced as `extraEvents[].detail`). We lock
 * while the review is pending and REOPEN betting the moment a decision arrives.
 *
 * Returns `null` when betting is open, otherwise `{ kind, reason, until }`.
 * A longer/higher-priority lock is never shortened by a weaker one.
 */
const DURATION = { goal: 12_000, var: 25_000 };
const PRIORITY = { goal: 2, var: 1 };
const REASON   = {
  goal: 'Гол — коефициентите се обновяват',
  var:  'VAR проверка',
};

// A VAR event whose decision text names an outcome means the review is DONE.
// Anything else (incl. "under review" or no text) is treated as still pending.
function isVarResolved(detail) {
  if (!detail) return false;
  return /(confirm|cancel|disallow|award|overturn|stands|given|no penalty|no goal)/i.test(detail);
}

export default function useOddsSuspension(match) {
  const [lock, setLock] = useState(null); // { kind, reason, until } | null
  const prevRef = useRef(null);

  // Detect a trigger on each live snapshot
  useEffect(() => {
    if (!match) { prevRef.current = null; setLock(null); return; }

    const stats = match.liveStats;
    const varEvents = (stats?.extraEvents ?? []).filter(e => e.kind === 'var');
    const lastVar = varEvents[varEvents.length - 1] ?? null;
    const curr = {
      matchId:   match.id,
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      varKey:    lastVar ? `${lastVar.minute}|${lastVar.detail ?? ''}` : null,
    };
    const prev = prevRef.current;
    prevRef.current = curr;

    // Switching matches — reset, skip first-snapshot diff (avoids phantom locks)
    if (!prev || prev.matchId !== curr.matchId) { setLock(null); return; }

    const applyLock = (kind) => {
      const until = Date.now() + DURATION[kind];
      setLock(cur => {
        // Keep the existing lock if it's stronger AND still lasts longer.
        if (cur && PRIORITY[cur.kind] >= PRIORITY[kind] && cur.until >= until) return cur;
        return { kind, reason: REASON[kind], until };
      });
    };

    // VAR transition first — a resolution REOPENS betting immediately.
    if (curr.varKey && curr.varKey !== prev.varKey) {
      if (isVarResolved(lastVar.detail)) {
        setLock(cur => (cur?.kind === 'var' ? null : cur)); // lift the VAR lock if active
        // fall through — a confirmed goal still locks via the score change below
      } else {
        applyLock('var');
        return;
      }
    }

    if (curr.homeScore > prev.homeScore || curr.awayScore > prev.awayScore) { applyLock('goal'); }
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
