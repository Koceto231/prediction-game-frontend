export default function MatchCard({ match, selected, onSelect }) {
  const hasOdds = match.homeOdds != null;

  return (
    <button
      className={`match-card ${selected ? 'match-card--selected' : ''}`}
      onClick={() => onSelect?.(match)}
      type="button"
    >
      <div className="match-card__top">
        <span className="tag">{match.status ?? 'Match'}</span>
        <span className="muted-text">
          {match.matchDate ? new Date(match.matchDate).toLocaleString() : 'TBD'}
        </span>
      </div>

      <div className="match-card__teams">
        <div className="team-row">
          <span>{match.homeTeamName}</span>
          <span className="team-side">Home</span>
        </div>
        <div className="team-row">
          <span>{match.awayTeamName}</span>
          <span className="team-side">Away</span>
        </div>
      </div>

      {hasOdds && (
        <div className="match-card__odds">
          <div className="odds-chip">
            <span className="odds-chip__label">1</span>
            <span className="odds-chip__value">{Number(match.homeOdds).toFixed(2)}</span>
          </div>
          <div className="odds-chip odds-chip--draw">
            <span className="odds-chip__label">X</span>
            <span className="odds-chip__value">{Number(match.drawOdds).toFixed(2)}</span>
          </div>
          <div className="odds-chip">
            <span className="odds-chip__label">2</span>
            <span className="odds-chip__value">{Number(match.awayOdds).toFixed(2)}</span>
          </div>
        </div>
      )}
    </button>
  );
}
