import { useEffect, useState } from 'react';
import useLiveMatchStream from '../hooks/useLiveMatchStream';
import { isActive, isFinal } from '../utils/liveState';

/**
 * Right-rail "Live Now" sidebar for the MatchesPage — stitch
 * "Gridiron Velocity" Matches design.
 *
 * Shows the FIRST currently-live match (if any) with:
 *   • Fixture + score + minute header
 *   • Possession bar
 *   • Match Events timeline (goals + cards, newest first, max 4)
 *   • Match Statistics (Corners / Shots on Target / Cards)
 *
 * Falls back to an empty-state pill when nothing is live right now.
 */
export default function LiveNowSidebar() {
  const { matches: rawLive } = useLiveMatchStream();
  // First active (in-play) match — pick the freshest live game
  const live = (() => {
    const list = (rawLive ?? []).filter(m => {
      if (isFinal(m.liveState)) return false;
      const elapsed = (Date.now() - new Date(m.matchDate).getTime()) / 60000;
      if (elapsed > 150) return false;
      return m.status === 'IN_PLAY' || isActive(m.liveState);
    });
    return list[0] ?? null;
  })();

  const stats = live?.liveStats;
  const goals = live?.goalScorers ?? [];

  // Combine events (goals + cards) newest first, max 4
  const events = [
    ...goals.map(g => ({ minute: g.minute, team: g.team, kind: g.isOwnGoal ? 'og' : 'goal', name: g.playerName })),
    ...(stats?.cardEvents ?? []).map(c => ({ minute: c.minute, team: c.team, kind: c.type, name: c.playerName })),
  ].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0)).slice(0, 4);

  const minuteDisplay = (() => {
    if (!live) return '';
    if (live.liveState === 'HT' || live.liveState === 'BREAK') return 'HT';
    if (live.liveState === 'FT') return 'FT';
    if (live.liveMinute != null) return `${live.liveMinute}'`;
    return 'LIVE';
  })();

  const homeName = live?.homeTeamName ?? '';
  const awayName = live?.awayTeamName ?? '';
  const ph = stats?.possession?.home;
  const pa = stats?.possession?.away;
  const hasPoss = ph != null && pa != null;

  return (
    <aside className="gvm-livenow">
      <div className="gvm-livenow__head">
        <span className="gvm-livenow__title">
          <span className="gvm-livenow__pulse" />
          LIVE NOW
        </span>
        {/* VIEW ALL → /live */}
        <a className="gvm-livenow__viewall" href="/live">VIEW ALL</a>
      </div>

      {!live && (
        <div className="gvm-livenow__empty">No live matches right now.</div>
      )}

      {live && (
        <>
          {/* Fixture mini header */}
          <div className="gvm-livenow__match">
            <div className="gvm-livenow__fixture">{homeName} vs {awayName}</div>
            <div className="gvm-livenow__score">
              <span className="gvm-livenow__min">{minuteDisplay}</span>
              <span className="gvm-livenow__sval">{live.homeScore ?? 0} - {live.awayScore ?? 0}</span>
            </div>
          </div>

          {/* Possession bar */}
          {hasPoss && (
            <div className="gvm-livenow__block">
              <div className="gvm-livenow__block-title">POSSESSION</div>
              <div className="gvm-livenow__poss">
                <span className="gvm-livenow__poss-h">{ph}%</span>
                <div className="gvm-livenow__poss-bar">
                  <div className="gvm-livenow__poss-bar-h" style={{ width: `${ph}%` }} />
                  <div className="gvm-livenow__poss-bar-a" style={{ width: `${pa}%` }} />
                </div>
                <span className="gvm-livenow__poss-a">{pa}%</span>
              </div>
            </div>
          )}

          {/* Match Events timeline */}
          {events.length > 0 && (
            <div className="gvm-livenow__block">
              <div className="gvm-livenow__block-title">MATCH EVENTS</div>
              <div className="gvm-livenow__events">
                {events.map((e, i) => (
                  <div key={i} className="gvm-livenow__event">
                    <span className={`gvm-livenow__event-dot gvm-livenow__event-dot--${e.kind}`} />
                    <span className="gvm-livenow__event-min">{e.minute}'</span>
                    <div className="gvm-livenow__event-body">
                      <span className="gvm-livenow__event-kind">
                        {e.kind === 'goal' ? 'Goal:' : e.kind === 'og' ? 'OG:' : e.kind === 'red' ? 'Red Card:' : 'Yellow Card:'}
                      </span>
                      <span className="gvm-livenow__event-team">{e.team === 'home' ? homeName : awayName}</span>
                      {e.name && <span className="gvm-livenow__event-name">({e.name})</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match Statistics */}
          {stats && (stats.corners || stats.shotsOnTarget || stats.yellowCards) && (
            <div className="gvm-livenow__block">
              <div className="gvm-livenow__block-title">MATCH STATISTICS</div>
              <div className="gvm-livenow__statgrid">
                {stats.corners && (
                  <div className="gvm-livenow__stat">
                    <span className="gvm-livenow__stat-h">{stats.corners.home ?? 0}</span>
                    <span className="gvm-livenow__stat-label">CORNERS</span>
                    <span className="gvm-livenow__stat-a">{stats.corners.away ?? 0}</span>
                  </div>
                )}
                {stats.shotsOnTarget && (
                  <div className="gvm-livenow__stat">
                    <span className="gvm-livenow__stat-h">{stats.shotsOnTarget.home ?? 0}</span>
                    <span className="gvm-livenow__stat-label">SHOTS ON TARGET</span>
                    <span className="gvm-livenow__stat-a">{stats.shotsOnTarget.away ?? 0}</span>
                  </div>
                )}
                {(stats.yellowCards || stats.redCards) && (
                  <div className="gvm-livenow__stat">
                    <span className="gvm-livenow__stat-h">
                      {(stats.yellowCards?.home ?? 0) + (stats.redCards?.home ?? 0)}
                    </span>
                    <span className="gvm-livenow__stat-label">CARDS</span>
                    <span className="gvm-livenow__stat-a">
                      {(stats.yellowCards?.away ?? 0) + (stats.redCards?.away ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
