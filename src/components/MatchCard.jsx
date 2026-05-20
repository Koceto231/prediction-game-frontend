import TeamCrest from './TeamCrest';

/**
 * Match row card — stitch "Gridiron Velocity" Matches design.
 * Layout: TIME column | Teams (crest+name | VS | crest+name) | 3 odds buttons.
 *
 * On selection, the left border turns amber (3px) and the background
 * lifts. Clicking either the card body OR one of the odd buttons selects
 * the match; the odd button additionally dispatches the
 * `bpfl:quickbet:place` event when Quick Bet Mode is on (handled by
 * QuickBetSidebar elsewhere).
 */
export default function MatchCard({ match, selected, onSelect, onOddPick }) {
  const hasOdds = match.homeOdds != null;

  const dateObj = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const dayLabel = (() => {
    if (!dateObj) return '';
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const target   = new Date(dateObj); target.setHours(0, 0, 0, 0);
    if (target.getTime() === today.getTime())    return 'TODAY';
    if (target.getTime() === tomorrow.getTime()) return 'TOMORROW';
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  })();

  const handleOddClick = (e, pick, oddVal) => {
    e.stopPropagation();
    if (oddVal == null) return;
    // Quick Bet Mode: dispatch event for QuickBetSidebar to place a bet immediately
    const qb = window.bpflQuickBet;
    if (qb?.enabled) {
      window.dispatchEvent(new CustomEvent('bpfl:quickbet:place', {
        detail: {
          matchId: match.id,
          pick,
          betType: 'Winner',
          meta: {
            fixture: `${match.homeTeamName} vs ${match.awayTeamName}`,
            pickLabel: pick === 'Home' ? match.homeTeamName : pick === 'Away' ? match.awayTeamName : 'Draw',
            odds: oddVal,
          },
        },
      }));
      return;
    }
    // Default behaviour: add the pick to the global BetSlipPanel.
    // The slip auto-opens, lets the user adjust stake, and supports building
    // multi-match accumulators by adding picks from more matches.
    window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
      detail: {
        matchId: match.id,
        pick,
        odds: oddVal,
        fixture: `${match.homeTeamName} vs ${match.awayTeamName}`,
        leagueLabel: match.leagueName ?? null,
      },
    }));
    // Legacy callback path — kept for backwards compatibility with any caller
    // that still wants its own modal flow instead of the slip.
    if (onOddPick) onOddPick(match, pick, oddVal);
  };

  return (
    <div
      className={`gvm-card${selected ? ' gvm-card--selected' : ''}`}
      onClick={() => onSelect?.(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(match); }}
    >
      <div className="gvm-card__row">
        {/* TIME column */}
        <div className="gvm-card__time">
          <div className={`gvm-card__time-clock${selected ? ' gvm-card__time-clock--accent' : ''}`}>{timeStr}</div>
          <div className="gvm-card__time-day">{dayLabel}</div>
        </div>

        {/* Teams */}
        <div className="gvm-card__teams">
          <div className="gvm-card__team">
            <TeamCrest className="gvm-card__crest" logoUrl={match.homeTeamLogo} name={match.homeTeamName} />
            <span className="gvm-card__team-name">{match.homeTeamName}</span>
          </div>
          <span className="gvm-card__vs">VS</span>
          <div className="gvm-card__team">
            <TeamCrest className="gvm-card__crest" logoUrl={match.awayTeamLogo} name={match.awayTeamName} />
            <span className="gvm-card__team-name">{match.awayTeamName}</span>
          </div>
        </div>

        {/* Odds */}
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
          <div className="gvm-card__odds gvm-card__odds--missing">
            <span>NO ODDS YET</span>
          </div>
        )}
      </div>
    </div>
  );
}
