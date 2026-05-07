import { useEffect, useState } from 'react';
import api from '../api/apiClient';

export default function OddsTicker() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    api.get('/Match/upcoming?take=12')
      .then(r => setMatches(r.data ?? []))
      .catch(() => {});
  }, []);

  if (!matches.length) return null;

  // Duplicate items so the seamless loop works
  const items = [...matches, ...matches];

  return (
    <div className="odds-ticker">
      <div className="odds-ticker__label">LIVE ODDS</div>
      <div className="odds-ticker__track">
        <div className="odds-ticker__inner">
          {items.map((m, i) => (
            <span key={i} className="odds-ticker__item">
              <span className="odds-ticker__fixture">
                {m.homeTeamName} <span className="odds-ticker__vs-sep">vs</span> {m.awayTeamName}
              </span>
              {m.homeOdds != null && (
                <>
                  <span className="odds-ticker__sep">·</span>
                  <span>1</span>
                  <span className="odds-ticker__odd">{Number(m.homeOdds).toFixed(2)}</span>
                  <span className="odds-ticker__sep">X</span>
                  <span className="odds-ticker__odd">{Number(m.drawOdds).toFixed(2)}</span>
                  <span className="odds-ticker__sep">2</span>
                  <span className="odds-ticker__odd">{Number(m.awayOdds).toFixed(2)}</span>
                </>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
