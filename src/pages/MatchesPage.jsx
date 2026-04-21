import { useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import { useWallet } from '../context/WalletContext';

// ── BetPanel (1 / X / 2 only) ───────────────────────────────────
function BetPanel({ match, onBetPlaced }) {
  const { balance, refreshBalance } = useWallet();
  const [pick, setPick]       = useState('');
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, msg }

  // Reset when match changes
  useEffect(() => {
    setPick('');
    setAmount('');
    setFeedback(null);
  }, [match?.id]);

  const oddsMap = {
    Home: match.homeOdds,
    Draw: match.drawOdds,
    Away: match.awayOdds,
  };
  const PICK_MAP = { Home: 1, Draw: 2, Away: 3 };

  const selectedOdds = pick ? Number(oddsMap[pick]) : null;
  const potential    = selectedOdds && Number(amount) > 0
    ? (selectedOdds * Number(amount)).toFixed(2)
    : null;

  const place = async () => {
    if (!pick || Number(amount) <= 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.post('/Bet', {
        matchId:  match.id,
        betType:  1, // Winner
        pick:     PICK_MAP[pick],
        amount:   Number(amount),
      });
      await refreshBalance();
      setFeedback({
        type: 'ok',
        msg: `✅ Bet placed! Potential payout: ${Number(res.data.potentialPayout).toLocaleString()} 🪙`,
      });
      setPick('');
      setAmount('');
      if (onBetPlaced) onBetPlaced();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err?.response?.data?.message || 'Failed to place bet.',
      });
    } finally {
      setLoading(false);
    }
  };

  const picks = [
    { key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
    { key: 'Draw', label: 'Draw',             odds: match.drawOdds  },
    { key: 'Away', label: match.awayTeamName, odds: match.awayOdds  },
  ];

  return (
    <div className="bet-panel">
      {/* Header */}
      <div className="bet-panel__header">
        <h3>Place a Bet</h3>
        {balance !== null && (
          <span className="wallet-badge">
            <span className="wallet-icon">🪙</span>
            <span className="wallet-amount">{Number(balance).toLocaleString()}</span>
          </span>
        )}
      </div>

      {/* 1 / X / 2 buttons */}
      <div className="bet-picks">
        {picks.map(({ key, label, odds }) => (
          <button
            key={key}
            type="button"
            className={`bet-pick-btn ${pick === key ? 'bet-pick-btn--active' : ''}`}
            onClick={() => { setPick(pick === key ? '' : key); setFeedback(null); }}
          >
            <span className="bet-pick-btn__label">{label}</span>
            <span className="bet-pick-btn__odds">
              {odds != null ? Number(odds).toFixed(2) : '—'}
            </span>
          </button>
        ))}
      </div>

      {/* Amount + potential */}
      {pick && (
        <div className="bet-amount-row" style={{ marginTop: 14 }}>
          <input
            type="number"
            min="1"
            placeholder="Stake (coins)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bet-amount-input"
            onKeyDown={e => e.key === 'Enter' && place()}
          />
          {potential && (
            <span className="bet-potential">→ {potential} 🪙</span>
          )}
        </div>
      )}

      <button
        type="button"
        className="primary-button"
        style={{ marginTop: 14 }}
        disabled={!pick || Number(amount) <= 0 || loading}
        onClick={place}
      >
        {loading ? 'Placing...' : 'Place Bet'}
      </button>

      {feedback && (
        <div className={`alert ${feedback.type === 'ok' ? 'alert-info' : 'alert-error'}`}
             style={{ marginTop: 12 }}>
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function MatchesPage() {
  const [matches, setMatches]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError]     = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    setPageLoading(true);
    setLoadError('');
    api.get('/Match/upcoming?take=20')
      .then(r => setMatches(r.data))
      .catch(e => setLoadError(e?.response?.data?.message || 'Failed to load matches.'))
      .finally(() => setPageLoading(false));
  }, []);

  const selectMatch = (match) => {
    if (selected?.id === match.id) {
      setSelected(null);
    } else {
      setSelected(match);
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  };

  return (
    <div className="page-grid">

      {/* ── Match list ── */}
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Upcoming Matches</h2>
            <p>Select a match to place your bet.</p>
          </div>
        </div>

        {loadError  && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}
        {!pageLoading && !matches.length && !loadError && (
          <div className="empty-box">No upcoming matches found.</div>
        )}

        <div className="cards-grid">
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              selected={selected?.id === match.id}
              onSelect={() => selectMatch(match)}
            />
          ))}
        </div>
      </section>

      {/* ── Bet panel ── */}
      {selected && (
        <section className="shell-card panel" ref={panelRef}>
          {/* Match hero */}
          <div className="match-hero">
            <div className="match-hero__badge">Selected Match</div>
            <h2 className="match-hero__title">
              <span>{selected.homeTeamName}</span>
              <span className="match-hero__vs">vs</span>
              <span>{selected.awayTeamName}</span>
            </h2>
            <div className="match-hero__meta">
              <span className="match-hero__date">
                {new Date(selected.matchDate).toLocaleString()}
              </span>
            </div>
          </div>

          {selected.homeOdds != null ? (
            <BetPanel
              match={selected}
              onBetPlaced={() => {/* balance already refreshed inside BetPanel */}}
            />
          ) : (
            <div className="empty-box">Odds not available for this match yet.</div>
          )}
        </section>
      )}
    </div>
  );
}
