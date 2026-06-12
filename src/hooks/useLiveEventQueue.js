import { useEffect, useRef, useState } from 'react';

/**
 * Watches a live match for important events and surfaces one at a time:
 *
 *   • GOAL   — home/away score increased
 *   • CARD   — yellow or red card (cardEvents length grows)
 *   • VAR    — new VAR event (review start or decision)
 *
 * Each event shows for `displayMs` (default 5 000 ms).
 * Events queue up; a goal/card/VAR never gets lost behind another.
 * Switching to a different match resets everything.
 */
export default function useLiveEventQueue(match, { displayMs = 5_000 } = {}) {
  const [active, setActive] = useState(null);
  const prevRef  = useRef(null);
  const queueRef = useRef([]);

  // Detect new events on every match snapshot
  useEffect(() => {
    if (!match) { setActive(null); queueRef.current = []; prevRef.current = null; return; }

    const stats     = match.liveStats;
    const goals     = match.goalScorers ?? [];
    const cards     = stats?.cardEvents ?? [];
    const varEvents = (stats?.extraEvents ?? []).filter(e => e.kind === 'var');
    const lastVar   = varEvents[varEvents.length - 1] ?? null;

    const curr = {
      matchId:    match.id,
      homeScore:  match.homeScore ?? 0,
      awayScore:  match.awayScore ?? 0,
      cardsCount: cards.length,
      lastCard:   cards[cards.length - 1] ?? null,
      varKey:     lastVar ? `${lastVar.minute}|${lastVar.detail ?? ''}` : null,
    };
    const prev = prevRef.current;
    prevRef.current = curr;

    // Switching matches — flush queue, skip first-snapshot detection
    if (!prev || prev.matchId !== curr.matchId) {
      queueRef.current = [];
      setActive(null);
      return;
    }

    const home = match.homeTeamName;
    const away = match.awayTeamName;

    // VAR
    if (curr.varKey && prev.varKey !== curr.varKey) {
      queueRef.current.push({
        team: lastVar.team, kind: 'var',
        title: 'VAR CHECK',
        sub: lastVar.detail ? `${lastVar.detail} (${lastVar.minute}')` : `(${lastVar.minute}')`,
      });
    }
    // GOAL
    if (curr.homeScore > prev.homeScore) {
      const lastHomeGoal = [...goals].reverse().find(g => g.team === 'home');
      queueRef.current.push({
        team: 'home', kind: 'goal',
        title: lastHomeGoal?.isOwnGoal ? 'OWN GOAL' : 'GOAL!',
        sub: lastHomeGoal
          ? `${home} (${lastHomeGoal.minute}') – ${lastHomeGoal.playerName}`
          : home,
      });
    }
    if (curr.awayScore > prev.awayScore) {
      const lastAwayGoal = [...goals].reverse().find(g => g.team === 'away');
      queueRef.current.push({
        team: 'away', kind: 'goal',
        title: lastAwayGoal?.isOwnGoal ? 'OWN GOAL' : 'GOAL!',
        sub: lastAwayGoal
          ? `${away} (${lastAwayGoal.minute}') – ${lastAwayGoal.playerName}`
          : away,
      });
    }
    // CARD
    if (curr.cardsCount > prev.cardsCount && curr.lastCard) {
      const c = curr.lastCard;
      queueRef.current.push({
        team: c.team, kind: c.type,
        title: c.type === 'red' ? 'RED CARD' : 'YELLOW CARD',
        sub: `${c.team === 'home' ? home : away}${c.playerName ? ' — ' + c.playerName : ''}`,
      });
    }
  }, [match]);

  // Drain the queue — show one event at a time
  useEffect(() => {
    if (active) return;
    if (queueRef.current.length > 0) {
      setActive(queueRef.current.shift());
      return;
    }
    const timer = setInterval(() => {
      if (queueRef.current.length > 0) setActive(queueRef.current.shift());
    }, 250);
    return () => clearInterval(timer);
  }, [active]);

  // Auto-dismiss after displayMs
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(null), displayMs);
    return () => clearTimeout(t);
  }, [active, displayMs]);

  return active;
}
