export default function MatchCard({ match, selected, onSelect }) {
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
    </button>
  );
}
