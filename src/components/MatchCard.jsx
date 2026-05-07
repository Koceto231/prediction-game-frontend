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

      {/* FIXTURE */}
      <div className="match-card__col match-card__col--fixture">
        <span>{match.homeTeamName}</span>
        <span className="match-card__vs-sep">vs</span>
        <span>{match.awayTeamName}</span>
        {match.leagueName && (
          <span className="match-card__league-tag" style={{ marginLeft: 'auto' }}>
            {match.leagueName}
          </span>
        )}
      </div>

      {/* SCORE / STATUS */}
      <div className="match-card__col match-card__col--score">
        {match.status === 'FINISHED'
          ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}`
          : match.status === 'IN_PLAY' || match.status === 'LIVE'
            ? <span style={{ color: '#ff6060', fontSize: '0.68rem', letterSpacing: '0.06em' }}>● LIVE</span>
            : '—'}
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
        <div className="match-card__col" style={{ gridColumn: '4 / 7', opacity: 0.35, fontSize: '0.72rem', justifyContent: 'center' }}>
          NO ODDS
        </div>
      )}
    </button>
  );
}
