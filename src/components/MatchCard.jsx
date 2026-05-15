export default function MatchCard({ match, selected, onSelect }) {
  const hasOdds = match.homeOdds != null;

  const dateObj = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : '';

  return (
    <button
      className={`match-card ${selected ? 'match-card--selected' : ''}`}
      onClick={() => onSelect?.(match)}
      type="button"
    >
      {/* TIME */}
      <div className="match-card__col match-card__col--time">
        <span>{timeStr}</span>
        <span className="match-card__league-tag">{dateStr}</span>
      </div>

      {/* FIXTURE — home above, away below for compact horizontal footprint */}
      <div className="match-card__col match-card__col--fixture">
        <div className="match-card__teams-stack">
          <span className="match-card__team-line">{match.homeTeamName}</span>
          <span className="match-card__team-line match-card__team-line--away">{match.awayTeamName}</span>
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
