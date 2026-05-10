import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const LEAGUE_ORDER = ['BGL', 'PL', 'BL1', 'SA', 'PD'];

const LEAGUE_META = {
  BGL: { label: '🇧🇬 BGL', full: 'Bulgarian Premier League' },
  PL:  { label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 PL',  full: 'Premier League' },
  BL1: { label: '🇩🇪 BL',  full: 'Bundesliga' },
  SA:  { label: '🇮🇹 SA',  full: 'Serie A' },
  PD:  { label: '🇪🇸 PD',  full: 'La Liga' },
};

function WinnerDot({ side, homeScore, awayScore }) {
  if (homeScore == null || awayScore == null) return null;
  const won = side === 'home' ? homeScore > awayScore
            : side === 'away' ? awayScore > homeScore
            : false;
  if (!won) return null;
  return (
    <span style={{
      display: 'inline-block',
      width: 6, height: 6,
      borderRadius: '50%',
      background: 'var(--accent)',
      marginLeft: 4,
      verticalAlign: 'middle',
    }} title="Winner" />
  );
}

function GoalList({ goals, team }) {
  const mine = goals.filter(g => g.team === team);
  if (mine.length === 0) return null;
  return (
    <div className="result-card__scorers">
      {mine.map((g, i) => (
        <span key={i} className="result-card__scorer">
          {g.isOwnGoal ? '(og) ' : ''}{g.playerName} <span className="result-card__scorer-min">{g.minute}'</span>
        </span>
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const [tab, setTab]         = useState('BGL');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/Match/results?leagueCode=${tab}&take=50`)
      .then(r => setResults(r.data))
      .catch(() => setError('Failed to load results.'))
      .finally(() => setLoading(false));
  }, [tab]);

  const league = LEAGUE_META[tab] ?? { label: tab, full: tab };

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Results</h2>
            <p>Latest finished matches and goal scorers.</p>
          </div>
        </div>

        {/* League tabs */}
        <div className="fantasy-view-toggle" style={{ marginBottom: 20 }}>
          {LEAGUE_ORDER.map(code => (
            <button key={code} type="button"
              className={`fantasy-view-btn${tab === code ? ' fantasy-view-btn--active' : ''}`}
              onClick={() => setTab(code)}>
              {LEAGUE_META[code]?.label ?? code}
            </button>
          ))}
        </div>

        {loading && <div className="empty-box">Loading results…</div>}
        {error   && <div className="alert alert-error">{error}</div>}

        {!loading && !error && results.length === 0 && (
          <div className="empty-box">No results yet for {league.full}.</div>
        )}

        {!loading && results.length > 0 && (
          <div className="results-list">
            {results.map(m => {
              const isDraw = m.homeScore === m.awayScore;
              const goals  = m.goalScorers ?? [];
              const date   = new Date(m.matchDate);

              return (
                <div key={m.id} className="result-card shell-card">
                  <div className="result-card__date">
                    {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {m.matchDay ? <span className="result-card__round">Round {m.matchDay}</span> : null}
                  </div>

                  <div className="result-card__row">
                    {/* Home */}
                    <div className="result-card__team result-card__team--home">
                      <span className={`result-card__name${m.homeScore > m.awayScore ? ' result-card__name--winner' : ''}`}>
                        {m.homeTeamName}
                      </span>
                      <WinnerDot side="home" homeScore={m.homeScore} awayScore={m.awayScore} />
                    </div>

                    {/* Score */}
                    <div className={`result-card__score${isDraw ? ' result-card__score--draw' : ''}`}>
                      <span>{m.homeScore}</span>
                      <span className="result-card__score-sep">–</span>
                      <span>{m.awayScore}</span>
                    </div>

                    {/* Away */}
                    <div className="result-card__team result-card__team--away">
                      <WinnerDot side="away" homeScore={m.homeScore} awayScore={m.awayScore} />
                      <span className={`result-card__name${m.awayScore > m.homeScore ? ' result-card__name--winner' : ''}`}>
                        {m.awayTeamName}
                      </span>
                    </div>
                  </div>

                  {/* Goal scorers */}
                  {goals.length > 0 && (
                    <div className="result-card__goals">
                      <GoalList goals={goals} team="home" />
                      <GoalList goals={goals} team="away" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
