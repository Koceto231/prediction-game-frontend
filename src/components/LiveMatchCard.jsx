import TeamCrest from './TeamCrest';

/**
 * Live match row card — mirrors the visual structure of `MatchCard`
 * (TIME col | TEAMS col | ODDS col) but with live-specific tweaks:
 *
 *   • Time column shows the LIVE MINUTE (e.g. "21'") + pulsing red LIVE
 *     label, in place of clock + TODAY/TOMORROW.
 *   • Teams are wrapped around the BIG amber score instead of "VS".
 *   • Optional stats chips (goals / yellows / corners) below the score.
 *   • Red left border instead of amber so the live state is immediately
 *     recognisable in the sidebar / list.
 *   • A red "LIVE" pill on the far right (after the odds).
 *
 * Clicking an odd dispatches `bpfl:slip:add` exactly like `MatchCard`,
 * so live picks flow into the same Bet Slip flow as pre-match picks
 * (multi-match accumulators across live + pre-match work seamlessly).
 */
export default function LiveMatchCard({
  match,
  selected,
  onSelect,
  minuteText,        // pre-computed via LivePage.displayMinute(match)
  goalChip,          // e.g. "⚽ 1-0"
  ycChip,            // e.g. "🟨 1-0"
  cornerChip,        // e.g. "⛳ 3-2"
  leagueChip,        // { flag: '🇧🇬', short: 'EFBET LIGA' } or null
}) {
  const hasOdds = match.homeOdds != null;

  const handleOddClick = (e, pick, oddVal) => {
    e.stopPropagation();
    e.preventDefault?.();
    if (e.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
    if (oddVal == null) return;
    window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
      detail: {
        matchId: match.id,
        pick,
        odds: oddVal,
        fixture: `${match.homeTeamName} vs ${match.awayTeamName}`,
        leagueLabel: leagueChip?.short ?? null,
      },
    }));
  };

  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;

  return (
    <div
      className={`gvm-card gvm-card--live${selected ? ' gvm-card--selected' : ''}`}
      onClick={() => onSelect?.(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(match); }}
    >
      <div className="gvm-card__row">
        {/* TIME column — live minute + LIVE label */}
        <div className="gvm-card__time gvm-card__time--live">
          {leagueChip && (
            <span className="gvm-card__live-league">
              <span className="gvm-card__live-league-flag">{leagueChip.flag}</span>
              <span className="gvm-card__live-league-name">{leagueChip.short}</span>
            </span>
          )}
          <div className="gvm-card__time-clock gvm-card__time-clock--live">
            <span className="gvm-card__live-dot" />
            {minuteText}
          </div>
        </div>

        {/* TEAMS — crest + name | SCORE | name + crest */}
        <div className="gvm-card__teams gvm-card__teams--live">
          <div className="gvm-card__team">
            <TeamCrest className="gvm-card__crest" logoUrl={match.homeTeamLogo} name={match.homeTeamName} />
            <span className="gvm-card__team-name">{match.homeTeamName}</span>
          </div>
          <span className="gvm-card__live-score">{homeScore} : {awayScore}</span>
          <div className="gvm-card__team">
            <TeamCrest className="gvm-card__crest" logoUrl={match.awayTeamLogo} name={match.awayTeamName} />
            <span className="gvm-card__team-name">{match.awayTeamName}</span>
          </div>
        </div>

        {/* ODDS */}
        {hasOdds ? (
          <div className="gvm-card__odds">
            <button type="button" className="gvm-odd" onClick={(e) => handleOddClick(e, 'Home', match.homeOdds)}>
              <span className="gvm-odd__label">1</span>
              <span className="gvm-odd__val">{Number(match.homeOdds).toFixed(2)}</span>
            </button>
            <button type="button" className="gvm-odd" onClick={(e) => handleOddClick(e, 'Draw', match.drawOdds)}>
              <span className="gvm-odd__label">X</span>
              <span className="gvm-odd__val">{Number(match.drawOdds).toFixed(2)}</span>
            </button>
            <button type="button" className="gvm-odd" onClick={(e) => handleOddClick(e, 'Away', match.awayOdds)}>
              <span className="gvm-odd__label">2</span>
              <span className="gvm-odd__val">{Number(match.awayOdds).toFixed(2)}</span>
            </button>
          </div>
        ) : (
          <div className="gvm-card__odds gvm-card__odds--missing"><span>NO ODDS</span></div>
        )}
      </div>

      {/* Optional stats chips row */}
      {(goalChip || ycChip || cornerChip) && (
        <div className="gvm-card__live-chips">
          {goalChip   && <span className="gvm-card__live-chip">{goalChip}</span>}
          {ycChip     && <span className="gvm-card__live-chip gvm-card__live-chip--yellow">{ycChip}</span>}
          {cornerChip && <span className="gvm-card__live-chip">{cornerChip}</span>}
        </div>
      )}
    </div>
  );
}
