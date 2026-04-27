export default function MatchCard({ match, selected, onSelect }) {
  const hasOdds = match.homeOdds != null;

  return (
    <button
      className={`match-card ${selected ? 'match-card--selected' : ''}`}
      onClick={() => onSelect?.(match)}
      type="button"
    >
      <div className="match-card__top">
        <span className="match-card__badge">{match.leagueName ?? match.status ?? 'Match'}</span>
        <span className="match-card__time">
          {match.matchDate ? new Date(match.matchDate).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
          }) : 'TBD'}
        </span>
      </div>

      <div className="match-card__vs-row">
        <div className="match-card__team match-card__team--home">
          <div className="match-card__team-name">{match.homeTeamName}</div>
          <div className="match-card__team-label">Home</div>
        </div>
        <div className="match-card__vs">VS</div>
        <div className="match-card__team match-card__team--away">
          <div className="match-card__team-name">{match.awayTeamName}</div>
          <div className="match-card__team-label">Away</div>
        </div>
      </div>

      {hasOdds && (
        <div className="match-card__odds">
          <div className="odds-chip">
            <span className="odds-chip__label">1 — Home</span>
            <span className="odds-chip__value">{Number(match.homeOdds).toFixed(2)}</span>
          </div>
          <div className="odds-chip">
            <span className="odds-chip__label">X — Draw</span>
            <span className="odds-chip__value">{Number(match.drawOdds).toFixed(2)}</span>
          </div>
          <div className="odds-chip">
            <span className="odds-chip__label">2 — Away</span>
            <span className="odds-chip__value">{Number(match.awayOdds).toFixed(2)}</span>
          </div>
        </div>
      )}
    </button>
  );
}
