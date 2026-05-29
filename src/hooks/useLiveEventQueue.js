import { useEffect, useRef, useState } from 'react';

/**
 * Watches a live match's `liveStats` + `goalScorers` for changes and
 * surfaces the latest event as a single { team, kind, title, sub }
 * object that the caller can render. Re-uses the detection logic
 * from the old MiniPitch:
 *
 *   • GOAL   — fires on home/away SCORE increase (more reliable than
 *              `goalScorers.length` because Sportmonks updates the
 *              score before pushing the goal event). Player name +
 *              minute are added when available from `goalScorers`.
 *   • CARD   — fires when `liveStats.cardEvents.length` grows; uses
 *              the newest cardEvent's `type` ("yellow" / "red") and
 *              `playerName`.
 *   • CORNER — fires on `liveStats.corners.{home|away}` increase.
 *   • SHOT ON TARGET — fires on `liveStats.shotsOnTarget.{home|away}` increase.
 *   • DANGEROUS ATTACK — fires on `liveStats.dangerousAttacks.{home|away}`
 *              increase.
 *   • FOUL   — fires on `liveStats.fouls.{home|away}` increase, but
 *              ONLY when nothing else fired in the same cycle (fouls
 *              are noisy and lower-priority than the other markers).
 *
 * Events queue up; one is shown for `displayMs` (default 5_000 ms)
 * before the next pops. When the queue is empty the hook returns null.
 *
 * Switching to a different match resets the queue + skips one cycle
 * of diff detection (otherwise the previous match's stats vs the new
 * match's stats produce a flood of phantom events).
 */
export default function useLiveEventQueue(match, { displayMs = 5_000 } = {}) {
  const [active, setActive] = useState(null);
  const prevRef  = useRef(null);
  const queueRef = useRef([]);

  // Detect new events on every match snapshot
  useEffect(() => {
    if (!match) { setActive(null); queueRef.current = []; prevRef.current = null; return; }
    const stats = match.liveStats;
    const goals = match.goalScorers ?? [];
    const cards = stats?.cardEvents ?? [];
    const varEvents = (stats?.extraEvents ?? []).filter(e => e.kind === 'var');
    const lastVar   = varEvents[varEvents.length - 1] ?? null;

    const curr = {
      matchId:     match.id,
      homeScore:   match.homeScore ?? 0,
      awayScore:   match.awayScore ?? 0,
      cardsCount:  cards.length,
      cornersHome: stats?.corners?.home ?? 0,
      cornersAway: stats?.corners?.away ?? 0,
      sotHome:     stats?.shotsOnTarget?.home ?? 0,
      sotAway:     stats?.shotsOnTarget?.away ?? 0,
      shotsHome:   stats?.shots?.home ?? 0,
      shotsAway:   stats?.shots?.away ?? 0,
      dangerHome:  stats?.dangerousAttacks?.home ?? 0,
      dangerAway:  stats?.dangerousAttacks?.away ?? 0,
      foulsHome:   stats?.fouls?.home ?? 0,
      foulsAway:   stats?.fouls?.away ?? 0,
      lastCard:    cards[cards.length - 1] ?? null,
      varKey:      lastVar ? `${lastVar.minute}|${lastVar.detail ?? ''}` : null,
    };
    const prev = prevRef.current;
    prevRef.current = curr;

    // Switching matches — flush queue, skip first-snapshot detection
    if (!prev || prev.matchId !== curr.matchId) {
      queueRef.current = [];
      setActive(null);
      return;
    }

    const newEvents = [];
    const home = match.homeTeamName, away = match.awayTeamName;

    // VAR — fire when a new VAR event arrives (review or decision). High
    // priority so it isn't crowded out by stat-delta events in the same cycle.
    if (curr.varKey && prev.varKey !== curr.varKey) {
      newEvents.push({
        team: lastVar.team, kind: 'var',
        title: 'VAR CHECK',
        sub: lastVar.detail ? `${lastVar.detail} (${lastVar.minute}')` : `(${lastVar.minute}')`,
      });
    }
    // GOAL — fire on score change (most reliable on Sportmonks)
    if (curr.homeScore > prev.homeScore) {
      const lastHomeGoal = [...goals].reverse().find(g => g.team === 'home');
      newEvents.push({
        team: 'home', kind: 'goal',
        title: lastHomeGoal?.isOwnGoal ? 'OWN GOAL' : 'GOAL!',
        sub: lastHomeGoal
          ? `${home} (${lastHomeGoal.minute}') – ${lastHomeGoal.playerName}`
          : home,
      });
    }
    if (curr.awayScore > prev.awayScore) {
      const lastAwayGoal = [...goals].reverse().find(g => g.team === 'away');
      newEvents.push({
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
      newEvents.push({
        team: c.team, kind: c.type,
        title: c.type === 'red' ? 'RED CARD' : 'YELLOW CARD',
        sub: `${c.team === 'home' ? home : away}${c.playerName ? ' — ' + c.playerName : ''}`,
      });
    }
    // CORNER
    if (curr.cornersHome > prev.cornersHome) newEvents.push({ team: 'home', kind: 'corner', title: 'Corner Kick',     sub: home });
    if (curr.cornersAway > prev.cornersAway) newEvents.push({ team: 'away', kind: 'corner', title: 'Corner Kick',     sub: away });
    // SHOT ON TARGET
    if (curr.sotHome > prev.sotHome)         newEvents.push({ team: 'home', kind: 'shot',   title: 'Shot on Target', sub: home });
    if (curr.sotAway > prev.sotAway)         newEvents.push({ team: 'away', kind: 'shot',   title: 'Shot on Target', sub: away });
    // SHOT OFF TARGET — total shots rose but on-target didn't
    if (curr.shotsHome > prev.shotsHome && curr.sotHome === prev.sotHome) newEvents.push({ team: 'home', kind: 'shotoff', title: 'Shot off Target', sub: home });
    if (curr.shotsAway > prev.shotsAway && curr.sotAway === prev.sotAway) newEvents.push({ team: 'away', kind: 'shotoff', title: 'Shot off Target', sub: away });
    // DANGEROUS ATTACK
    if (curr.dangerHome > prev.dangerHome)   newEvents.push({ team: 'home', kind: 'danger', title: 'Dangerous Attack', sub: home });
    if (curr.dangerAway > prev.dangerAway)   newEvents.push({ team: 'away', kind: 'danger', title: 'Dangerous Attack', sub: away });
    // FOUL — only if no higher-priority event fired this cycle
    if (newEvents.length === 0) {
      if (curr.foulsHome > prev.foulsHome) newEvents.push({ team: 'home', kind: 'foul', title: 'Foul', sub: home });
      if (curr.foulsAway > prev.foulsAway) newEvents.push({ team: 'away', kind: 'foul', title: 'Foul', sub: away });
    }

    if (newEvents.length > 0) queueRef.current.push(...newEvents);
  }, [match]);

  // Drain the queue — show one event at a time for `displayMs`
  useEffect(() => {
    if (active) return; // wait until current finishes
    const timer = setInterval(() => {
      if (queueRef.current.length > 0) {
        setActive(queueRef.current.shift());
      }
    }, 250);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(null), displayMs);
    return () => clearTimeout(t);
  }, [active, displayMs]);

  return active;
}
