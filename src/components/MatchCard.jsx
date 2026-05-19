import TeamCrest from './TeamCrest';

export default function MatchCard({ match, selected, onSelect }) {
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

  return (
    <button
      className={`match-card ${selected ? 'match-card--selected' : ''}`}
      onClick={() => onSelect?.(match)}
      type="button"
    >
      {/* TIME */}
      <div className="match-card__col match-card__col--time">
        <span className="match-card__time-clock">{timeStr}</span>
        <span className="match-card__time-date">{dayLabel}</span>
      </div>

      {/* FIXTURE — team logo circles inline (stitch "Matches with Live Stats" pass) */}
      <div className="match-card__col match-card__col--fixture">
        <div className="match-card__fixture-row">
          <div className="match-card__side">
            <TeamCrest className="match-card__crest" logoUrl={match.homeTeamLogo} name={match.homeTeamName} />
            <span className="match-card__team-line">{match.homeTeamName}</span>
          </div>
          <span className="match-card__vs">vs</span>
          <div className="match-card__side match-card__side--away">
            <TeamCrest className="match-card__crest" logoUrl={match.awayTeamLogo} name={match.awayTeamName} />
            <span className="match-card__team-line match-card__team-line--away">{match.awayTeamName}</span>
          </div>
        </div>
        {match.leagueName && (
          <span className="match-card__league-tag" style={{ marginLeft: 'auto' }}>
            {match.leagueName}
          </span>
        )}
      </div>

      {/* ODDS */}
      {hasOdds ? (
        <>
          <div className="match-card__col match-card__col--odds">
            <span className="match-card__odds-val">{Number(match.homeOdds).toFixed(2)}</span>
            <span className="match-card__odds-lbl">1</span>
          </div>
          <div className="match-card__col match-card__col--odds">
            <span className="match-card__odds-val">{Number(match.drawOdds).toFixed(2)}</span>
            <span className="match-card__odds-lbl">X</span>
          </div>
          <div className="match-card__col match-card__col--odds">
            <span className="match-card__odds-val">{Number(match.awayOdds).toFixed(2)}</span>
            <span className="match-card__odds-lbl">2</span>
          </div>
        </>
      ) : (
        <div className="match-card__col" style={{ gridColumn: '3 / 6', opacity: 0.35, fontSize: '0.72rem', justifyContent: 'center' }}>
          NO ODDS
        </div>
      )}
    </button>
  );
}
