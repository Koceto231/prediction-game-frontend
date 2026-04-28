import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/apiClient';
import MatchCard from '../components/MatchCard';
import { useWallet } from '../context/WalletContext';

// ── Enums (string values — backend uses JsonStringEnumConverter) ─
const BET_TYPE    = { Winner: 'Winner', ExactScore: 'ExactScore', BTTS: 'BTTS', OverUnder: 'OverUnder', Goalscorer: 'Goalscorer', Corners: 'Corners', YellowCards: 'YellowCards', DoubleChance: 'DoubleChance' };
const WINNER_MAP  = { Home: 'Home', Draw: 'Draw', Away: 'Away' };
const OU_LINE_MAP = { Line15: 'Line15', Line25: 'Line25', Line35: 'Line35' };
const OU_PICK_MAP = { Over: 'Over', Under: 'Under' };
const DC_PICKS    = [
  { key: 'HomeOrDraw', label: '1X — Home or Draw' },
  { key: 'HomeOrAway', label: '12 — Home or Away'  },
  { key: 'DrawOrAway', label: 'X2 — Draw or Away'  },
];
const CORNER_LINES   = [8.5, 9.5, 10.5];
const YELLOW_LINES   = [2.5, 3.5, 4.5];
const POS_ORDER      = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const POS_LABELS     = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };

const parseScore = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const EMPTY = { homeScore: '', awayScore: '', winner: '', btts: '', ouLine: '', ouPick: '' };

// ── Fetch odds from backend ──────────────────────────────────────
async function fetchOdds(matchId, betType, params = {}) {
  const qs = new URLSearchParams({ betType, ...params });
  try {
    const r = await api.get(`/Odds/${matchId}?${qs}`);
    return r.data ?? null;
  } catch { return null; }
}

// ── Shared: stake row + CTA ──────────────────────────────────────
function BetSlipStake({ amount, setAmount, potential, onPlace, loading, disabled }) {
  const stakeNum = Number(amount);
  return (
    <div className="bet-slip" style={{ marginTop: 14 }}>
      <div className="bet-slip__stake-row">
        <div className="bet-slip__stake-wrap">
          <input
            type="text" inputMode="numeric" placeholder="0"
            value={amount}
            onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAmount(v); }}
            className="bet-slip__stake-input"
            onKeyDown={e => e.key === 'Enter' && !disabled && onPlace()}
          />
          <span className="bet-slip__stake-coin">€</span>
        </div>
        <div className="bet-slip__quick-adds">
          {[5, 20, 50].map(n => (
            <button key={n} type="button" className="bet-slip__quick-add"
              onClick={() => setAmount(a => String((Number(a) || 0) + n))}>
              +{n}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button" className="bet-slip__cta"
        disabled={disabled || stakeNum <= 0 || loading}
        onClick={onPlace}
      >
        <span>{loading ? 'Placing...' : `Place bet ${stakeNum > 0 ? stakeNum : ''} €`}</span>
        {potential != null && potential > 0 && (
          <span className="bet-slip__cta-sub">Potential win: {Number(potential).toFixed(2)} €</span>
        )}
      </button>
    </div>
  );
}

// ── Quick 1/X/2 bet panel ────────────────────────────────────────
function QuickBetPanel({ match }) {
  const { refreshBalance } = useWallet();
  const [pick, setPick]       = useState('');
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { setPick(''); setAmount(''); setFeedback(null); }, [match?.id]);

  const oddsMap  = { Home: match.homeOdds, Draw: match.drawOdds, Away: match.awayOdds };
  const labelMap = { Home: match.homeTeamName, Draw: 'Draw', Away: match.awayTeamName };
  const selectedOdds = pick ? Number(oddsMap[pick]) : null;
  const stakeNum = Number(amount);
  const potential = selectedOdds && stakeNum > 0 ? (selectedOdds * stakeNum).toFixed(2) : null;

  const place = async () => {
    if (!pick || stakeNum <= 0) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post('/Bet', { matchId: match.id, betType: 'Winner', pick, amount: stakeNum });
      await refreshBalance();
      setFeedback({ ok: true, text: 'Bet placed!' });
      setPick(''); setAmount('');
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || 'Failed.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="quick-bet-panel">
      <div className="quick-bet-panel__title">Quick Bet — 1 / X / 2</div>
      <div className="bet-picks">
        {[{ key: 'Home', label: match.homeTeamName, odds: match.homeOdds },
          { key: 'Draw', label: 'Draw',             odds: match.drawOdds  },
          { key: 'Away', label: match.awayTeamName, odds: match.awayOdds  },
        ].map(({ key, label, odds }) => (
          <button key={key} type="button"
            className={`bet-pick-btn ${pick === key ? 'bet-pick-btn--active' : ''}`}
            onClick={() => { setPick(pick === key ? '' : key); setFeedback(null); }}>
            <span className="bet-pick-btn__label">{label}</span>
            <span className="bet-pick-btn__odds">{odds != null ? Number(odds).toFixed(2) : '—'}</span>
          </button>
        ))}
      </div>

      {pick && (
        <div className="bet-slip">
          <div className="bet-slip__header">
            <button className="bet-slip__remove" type="button"
              onClick={() => { setPick(''); setAmount(''); setFeedback(null); }} title="Remove">✕</button>
            <div className="bet-slip__info">
              <span className="bet-slip__pick">{labelMap[pick]}</span>
              <span className="bet-slip__desc">
                Match Result · {match.homeTeamName} vs. {match.awayTeamName}
              </span>
            </div>
            <span className="bet-slip__odds">{selectedOdds?.toFixed(2)}</span>
          </div>
          <div className="bet-slip__stake-row">
            <div className="bet-slip__stake-wrap">
              <input type="text" inputMode="numeric" placeholder="0" value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                className="bet-slip__stake-input" onKeyDown={e => e.key === 'Enter' && place()} autoFocus />
              <span className="bet-slip__stake-coin">€</span>
            </div>
            <div className="bet-slip__quick-adds">
              {[5, 20, 50].map(n => (
                <button key={n} type="button" className="bet-slip__quick-add"
                  onClick={() => setAmount(a => String((Number(a) || 0) + n))}>+{n}</button>
              ))}
            </div>
          </div>
          <button type="button" className="bet-slip__cta" disabled={stakeNum <= 0 || loading} onClick={place}>
            <span>{loading ? 'Placing...' : `Place bet ${stakeNum > 0 ? stakeNum : ''} €`}</span>
            {potential && <span className="bet-slip__cta-sub">Potential win: {Number(potential).toFixed(2)} €</span>}
          </button>
        </div>
      )}
      {feedback && (
        <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

// ── Double Chance panel ──────────────────────────────────────────
function DoubleChancePanel({ match }) {
  const { refreshBalance } = useWallet();
  const [dcPick, setDCPick]   = useState('');
  const [odds, setOdds]       = useState(null);
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { setDCPick(''); setOdds(null); setAmount(''); setFeedback(null); }, [match?.id]);

  useEffect(() => {
    if (!dcPick) { setOdds(null); return; }
    let cancelled = false;
    fetchOdds(match.id, BET_TYPE.DoubleChance, { dcPick }).then(r => { if (!cancelled) setOdds(r); });
    return () => { cancelled = true; };
  }, [match?.id, dcPick]);

  const stakeNum  = Number(amount);
  const potential = odds && stakeNum > 0 ? stakeNum * Number(odds.odds) : null;

  const place = async () => {
    if (!dcPick || stakeNum <= 0 || !odds) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post('/Bet', { matchId: match.id, betType: BET_TYPE.DoubleChance, dCPick: dcPick, amount: stakeNum });
      await refreshBalance();
      setFeedback({ ok: true, text: 'Bet placed!' });
      setDCPick(''); setAmount('');
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || 'Failed.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="special-bet-panel">
      <div className="bet-picks">
        {DC_PICKS.map(({ key, label }) => (
          <button key={key} type="button"
            className={`bet-pick-btn ${dcPick === key ? 'bet-pick-btn--active' : ''}`}
            onClick={() => { setDCPick(dcPick === key ? '' : key); setFeedback(null); }}>
            <span className="bet-pick-btn__label">{label}</span>
          </button>
        ))}
      </div>
      {dcPick && odds && (
        <>
          <div className="mp-odds-row">
            <span>{DC_PICKS.find(d => d.key === dcPick)?.label}</span>
            <strong style={{ color: 'var(--amber)' }}>{Number(odds.odds).toFixed(2)}</strong>
          </div>
          <BetSlipStake amount={amount} setAmount={setAmount} potential={potential}
            onPlace={place} loading={loading} disabled={!dcPick || !odds} />
        </>
      )}
      {feedback && (
        <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

// ── Goalscorer panel ─────────────────────────────────────────────
function GoalscorerPanel({ match }) {
  const { refreshBalance } = useWallet();
  const [players, setPlayers]     = useState([]);
  const [pLoading, setPLoading]   = useState(false);
  const [pError, setPError]       = useState('');
  const [posFilter, setPosFilter] = useState('FWD');
  const [selected, setSelected]   = useState(null);  // { playerId, name, odds }
  const [amount, setAmount]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [feedback, setFeedback]   = useState(null);

  useEffect(() => {
    setPlayers([]); setSelected(null); setAmount(''); setFeedback(''); setPError('');
    setPLoading(true);
    api.get(`/Match/${match.id}/players`)
      .then(r => setPlayers(r.data ?? []))
      .catch(() => setPError('Could not load players. Make sure players are synced via Admin → Sync Players.'))
      .finally(() => setPLoading(false));
  }, [match?.id]);

  const positions = [...new Set(players.map(p => p.position))].sort((a, b) => (POS_ORDER[a] ?? 9) - (POS_ORDER[b] ?? 9));
  const filtered  = players.filter(p => p.position === posFilter);

  const stakeNum  = Number(amount);
  const potential = selected && stakeNum > 0 ? stakeNum * Number(selected.odds) : null;

  const place = async () => {
    if (!selected || stakeNum <= 0) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post('/Bet', { matchId: match.id, betType: BET_TYPE.Goalscorer, goalscorerId: selected.playerId, amount: stakeNum });
      await refreshBalance();
      setFeedback({ ok: true, text: `Bet placed on ${selected.name} to score!` });
      setSelected(null); setAmount('');
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || 'Failed.' });
    } finally { setLoading(false); }
  };

  if (pLoading) return <div className="muted-text" style={{ padding: '12px 0' }}>Loading players...</div>;
  if (pError)   return <div className="alert alert-error">{pError}</div>;
  if (!players.length) return <div className="muted-text">No players found for this match.</div>;

  return (
    <div className="special-bet-panel">
      {/* Position tabs */}
      <div className="pos-tabs">
        {positions.map(pos => (
          <button key={pos} type="button"
            className={`pos-tab ${posFilter === pos ? 'pos-tab--active' : ''}`}
            onClick={() => { setPosFilter(pos); setSelected(null); }}>
            {POS_LABELS[pos] ?? pos}
          </button>
        ))}
      </div>

      {/* Player grid */}
      <div className="player-grid">
        {filtered.map(p => (
          <button key={p.playerId} type="button"
            className={`player-card ${selected?.playerId === p.playerId ? 'player-card--active' : ''}`}
            onClick={() => { setSelected(selected?.playerId === p.playerId ? null : { playerId: p.playerId, name: p.name, odds: p.odds }); setFeedback(null); }}>
            <span className="player-card__team">{p.isHome ? match.homeTeamName : match.awayTeamName}</span>
            <span className="player-card__name">{p.name}</span>
            <span className="player-card__odds">{Number(p.odds).toFixed(2)}</span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="mp-odds-row" style={{ marginTop: 12 }}>
            <span>{selected.name} to score</span>
            <strong style={{ color: 'var(--amber)' }}>{Number(selected.odds).toFixed(2)}</strong>
          </div>
          <BetSlipStake amount={amount} setAmount={setAmount} potential={potential}
            onPlace={place} loading={loading} disabled={!selected} />
        </>
      )}
      {feedback && (
        <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

// ── Corners / Yellow Cards O/U panel ────────────────────────────
function SpecialOUPanel({ match, betType, lines, label }) {
  const { refreshBalance } = useWallet();
  const [line, setLine]     = useState('');
  const [pick, setPick]     = useState('');  // Over / Under
  const [odds, setOdds]     = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { setLine(''); setPick(''); setOdds(null); setAmount(''); setFeedback(null); }, [match?.id, betType]);

  useEffect(() => {
    if (!line || !pick) { setOdds(null); return; }
    let cancelled = false;
    fetchOdds(match.id, betType, { lineValue: line, ouPick: pick }).then(r => { if (!cancelled) setOdds(r); });
    return () => { cancelled = true; };
  }, [match?.id, betType, line, pick]);

  const stakeNum  = Number(amount);
  const potential = odds && stakeNum > 0 ? stakeNum * Number(odds.odds) : null;

  const place = async () => {
    if (!line || !pick || stakeNum <= 0 || !odds) return;
    setLoading(true); setFeedback(null);
    try {
      await api.post('/Bet', { matchId: match.id, betType, lineValue: Number(line), ouPick: pick, amount: stakeNum });
      await refreshBalance();
      setFeedback({ ok: true, text: 'Bet placed!' });
      setLine(''); setPick(''); setAmount('');
    } catch (err) {
      setFeedback({ ok: false, text: err?.response?.data?.message || 'Failed.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="special-bet-panel">
      <div className="option-card">
        <span className="option-card__label">{label} line</span>
        <div className="pick-row">
          {lines.map(l => (
            <button key={l} type="button"
              className={`pick-chip ${line === String(l) ? 'pick-chip--active' : ''}`}
              onClick={() => { setLine(line === String(l) ? '' : String(l)); setFeedback(null); }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="option-card option-card--compact">
        <span className="option-card__label">Over / Under</span>
        <div className="pick-row">
          {['Over', 'Under'].map(p => (
            <button key={p} type="button"
              className={`pick-chip ${pick === p ? 'pick-chip--active' : ''}`}
              onClick={() => { setPick(pick === p ? '' : p); setFeedback(null); }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {line && pick && (
        <>
          {odds
            ? (
              <>
                <div className="mp-odds-row">
                  <span>{label} {pick} {line}</span>
                  <strong style={{ color: 'var(--amber)' }}>{Number(odds.odds).toFixed(2)}</strong>
                </div>
                <BetSlipStake amount={amount} setAmount={setAmount} potential={potential}
                  onPlace={place} loading={loading} disabled={!odds} />
              </>
            )
            : <div className="muted-text" style={{ textAlign: 'center', marginTop: 8 }}>Calculating odds...</div>
          }
        </>
      )}
      {feedback && (
        <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
const SPECIAL_TABS = [
  { key: 'dc',      label: 'Double Chance' },
  { key: 'scorer',  label: '⚽ Goalscorer'  },
  { key: 'corners', label: '🚩 Corners'     },
  { key: 'yellows', label: '🟨 Yellow Cards' },
];

export default function MatchesPage() {
  const { refreshBalance } = useWallet();

  const [matches, setMatches]           = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mode, setMode]                 = useState('');   // '' | 'exact' | 'market'
  const [specialTab, setSpecialTab]     = useState('');   // '' | 'dc' | 'scorer' | 'corners' | 'yellows'
  const [fields, setFields]             = useState(EMPTY);
  const [amount, setAmount]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [feedback, setFeedback]         = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [pageLoading, setPageLoading]   = useState(false);
  const [loadError, setLoadError]       = useState('');

  // Live odds
  const [exactOdds, setExactOdds]               = useState(null);
  const [exactOddsLoading, setExactOddsLoading] = useState(false);
  const [mpOdds, setMpOdds]                     = useState({ winner: null, btts: null, ou: null });
  const [mpOddsLoading, setMpOddsLoading]       = useState(false);

  const panelRef = useRef(null);
  const aiRef    = useRef(null);
  const setField = useCallback((k, v) => setFields(p => ({ ...p, [k]: v })), []);

  useEffect(() => {
    setPageLoading(true);
    api.get('/Match/upcoming?take=20')
      .then(r => setMatches(r.data))
      .catch(e => setLoadError(e?.response?.data?.message || 'Failed to load matches.'))
      .finally(() => setPageLoading(false));
  }, []);

  const resetPanel = useCallback(() => {
    setMode(''); setSpecialTab(''); setFields(EMPTY); setAmount(''); setFeedback(null);
    setAiPrediction(null);
    setExactOdds(null); setMpOdds({ winner: null, btts: null, ou: null });
  }, []);

  const { homeScore, awayScore, winner, btts, ouLine, ouPick } = fields;
  const home        = parseScore(homeScore);
  const away        = parseScore(awayScore);
  const hasScore    = home != null && away != null;
  const isExact     = mode === 'exact';
  const isMarket    = mode === 'market';
  const hasBetOdds  = selectedMatch?.homeOdds != null;

  // Live odds — Exact Score
  useEffect(() => {
    if (!isExact || !hasBetOdds || home === null || away === null) { setExactOdds(null); return; }
    let cancelled = false;
    setExactOddsLoading(true);
    fetchOdds(selectedMatch.id, BET_TYPE.ExactScore, { scoreHome: home, scoreAway: away })
      .then(r => { if (!cancelled) setExactOdds(r); })
      .finally(() => { if (!cancelled) setExactOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isExact, selectedMatch?.id, home, away, hasBetOdds]);

  // Live odds — Market Pick
  useEffect(() => {
    if (!isMarket || !hasBetOdds) return;
    let cancelled = false;
    setMpOddsLoading(true);
    const winnerOdds = winner === 'Home' ? selectedMatch.homeOdds
                     : winner === 'Draw' ? selectedMatch.drawOdds
                     : winner === 'Away' ? selectedMatch.awayOdds : null;
    Promise.all([
      Promise.resolve(winnerOdds),
      btts
        ? fetchOdds(selectedMatch.id, BET_TYPE.BTTS, { btts }).then(r => r?.odds ?? null)
        : Promise.resolve(null),
      ouLine && ouPick
        ? fetchOdds(selectedMatch.id, BET_TYPE.OverUnder,
            { ouLine: OU_LINE_MAP[ouLine], ouPick: OU_PICK_MAP[ouPick] }).then(r => r?.odds ?? null)
        : Promise.resolve(null),
    ]).then(([w, b, o]) => {
      if (!cancelled) setMpOdds({ winner: w, btts: b, ou: o });
    }).finally(() => { if (!cancelled) setMpOddsLoading(false); });
    return () => { cancelled = true; };
  }, [isMarket, selectedMatch?.id, winner, btts, ouLine, ouPick, hasBetOdds]);

  // Combined odds for market pick
  const mpSelected = [
    winner && mpOdds.winner,
    btts    && mpOdds.btts,
    ouLine  && ouPick && mpOdds.ou,
  ].filter(Boolean);
  const combinedOdds = mpSelected.length
    ? mpSelected.reduce((a, o) => a * Number(o), 1) : null;

  const betAmt          = Number(amount);
  const exactPotential  = exactOdds && betAmt > 0 ? betAmt * Number(exactOdds.odds) : null;
  const marketPotential = combinedOdds && betAmt > 0 ? betAmt * combinedOdds : null;

  // ── Place prediction bet ────────────────────────────────────────
  const placeBet = async () => {
    if (!selectedMatch || loading) return;
    setLoading(true); setFeedback(null); setAiPrediction(null);

    try {
      let ai = null;
      try {
        const predBody = {
          matchId: selectedMatch.id,
          predictionHomeScore: isExact ? home : null,
          predictionAwayScore: isExact ? away : null,
          predictionWinner:    isMarket && winner ? WINNER_MAP[winner] : null,
          predictionBTTS:      isMarket && btts !== '' ? btts === 'true' : null,
          predictionOULine:    isMarket && ouLine ? ouLine : null,
          predictionOUPick:    isMarket && ouPick ? ouPick : null,
        };
        const predRes = await api.post('/Prediction', predBody);
        ai = predRes.data?.aiPredictionResponseDTO ?? null;
      } catch {
        try {
          const analysisRes = await api.get(`/Prediction/analysis/${selectedMatch.id}`);
          ai = analysisRes.data ?? null;
        } catch { /* AI unavailable */ }
      }
      if (ai) setAiPrediction(ai);

      let betsPlaced = 0;
      if (betAmt > 0 && hasBetOdds) {
        if (isExact && home !== null && away !== null) {
          await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.ExactScore, scoreHome: home, scoreAway: away, amount: betAmt });
          betsPlaced++;
        } else if (isMarket) {
          if (winner && mpOdds.winner != null) {
            await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.Winner, pick: WINNER_MAP[winner], amount: betAmt });
            betsPlaced++;
          }
          if (btts && mpOdds.btts != null) {
            await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.BTTS, bttsPick: btts === 'true', amount: betAmt });
            betsPlaced++;
          }
          if (ouLine && ouPick && mpOdds.ou != null) {
            await api.post('/Bet', { matchId: selectedMatch.id, betType: BET_TYPE.OverUnder, ouLine: OU_LINE_MAP[ouLine], ouPick: OU_PICK_MAP[ouPick], amount: betAmt });
            betsPlaced++;
          }
        }
        if (betsPlaced > 0) await refreshBalance();
      }

      const msg = betsPlaced > 0
        ? `✅ ${betsPlaced} bet${betsPlaced > 1 ? 's' : ''} placed!`
        : '✅ Prediction saved!';
      setFeedback({ type: 'ok', msg });

      if (ai) setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (err) {
      setFeedback({ type: 'err', msg: err?.response?.data?.message || 'Failed to place bet.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="page-grid">

      {/* Match list */}
      <section className="shell-card panel">
        <div className="section-head">
          <div><h2>Upcoming Matches</h2><p>Select a match to place your bet.</p></div>
        </div>
        {loadError && <div className="alert alert-error">{loadError}</div>}
        {pageLoading && <div className="empty-box">Loading matches...</div>}
        {!pageLoading && !matches.length && !loadError && (
          <div className="empty-box">No upcoming matches found.</div>
        )}
        <div className="cards-grid">
          {matches.map(match => (
            <MatchCard key={match.id} match={match}
              selected={selectedMatch?.id === match.id}
              onSelect={() => {
                if (selectedMatch?.id === match.id) { setSelectedMatch(null); resetPanel(); }
                else {
                  setSelectedMatch(match); resetPanel();
                  setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* Bet + prediction panel */}
      {selectedMatch && (
        <section className="shell-card panel" ref={panelRef}>

          {/* Match hero */}
          <div className="match-hero">
            <div className="match-hero__badge">Selected Match</div>
            <h2 className="match-hero__title">
              <span>{selectedMatch.homeTeamName}</span>
              <span className="match-hero__vs">vs</span>
              <span>{selectedMatch.awayTeamName}</span>
            </h2>
            <div className="match-hero__meta">
              <span className="match-hero__date">{new Date(selectedMatch.matchDate).toLocaleString()}</span>
            </div>
          </div>

          {/* ── Prediction modes (Exact / Market) ────────────────────── */}
          {!mode && (
            <div className="premium-mode-grid">
              <button type="button" className="premium-mode-card premium-mode-card--exact"
                onClick={() => { setMode('exact'); setSpecialTab(''); }}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">🎯</span>
                  <span className="premium-mode-card__points">5 pts</span>
                </div>
                <div className="premium-mode-card__title">Exact Score</div>
                <div className="premium-mode-card__text">Predict the final score and earn maximum points.</div>
              </button>
              <button type="button" className="premium-mode-card premium-mode-card--market"
                onClick={() => { setMode('market'); setSpecialTab(''); }}>
                <div className="premium-mode-card__top">
                  <span className="premium-mode-card__icon">📈</span>
                  <span className="premium-mode-card__points">up to 3 pts</span>
                </div>
                <div className="premium-mode-card__title">Market Pick</div>
                <div className="premium-mode-card__text">Predict winner, BTTS and Over / Under outcomes.</div>
              </button>
            </div>
          )}

          <div className="prediction-form">

            {/* ── Exact Score mode ── */}
            {isExact && (
              <>
                <div className="mode-card mode-card--exact">
                  <div className="mode-card__top"><span className="mode-badge">EXACT SCORE — 5 PTS</span></div>
                  <div className="mode-card__title">Predict the exact final score</div>
                  <button type="button" className="mode-card__button"
                    onClick={() => { setMode(''); setFields(EMPTY); }}>Change type</button>
                </div>

                <div className="scoreboard-card">
                  <div className="scoreboard-card__head">
                    <span className="scoreboard-card__eyebrow">Enter predicted result</span>
                  </div>
                  <div className="scoreboard">
                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.homeTeamName}</div>
                      <div className="scorebox">
                        <input type="number" min="0" max="20" placeholder="0"
                          value={homeScore} onChange={e => setField('homeScore', e.target.value)} />
                      </div>
                    </div>
                    <div className="scoreboard__separator">:</div>
                    <div className="scoreboard-team">
                      <div className="scoreboard-team__name">{selectedMatch.awayTeamName}</div>
                      <div className="scorebox">
                        <input type="number" min="0" max="20" placeholder="0"
                          value={awayScore} onChange={e => setField('awayScore', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                {hasBetOdds && hasScore && (
                  <div className="inline-bet-wrapper">
                    {exactOddsLoading && <div className="muted-text" style={{ textAlign: 'center' }}>Calculating odds...</div>}
                    {exactOdds && !exactOddsLoading && (
                      <>
                        <div className="mp-odds-row">
                          <span>Odds for {homeScore}–{awayScore}</span>
                          <strong style={{ color: 'var(--amber)', fontSize: '1.1rem' }}>
                            {Number(exactOdds.odds).toFixed(2)}
                          </strong>
                        </div>
                        <BetSlipStake amount={amount} setAmount={setAmount} potential={exactPotential}
                          onPlace={placeBet} loading={loading} disabled={!hasScore} />
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Market Pick mode ── */}
            {isMarket && (
              <>
                <div className="mode-card mode-card--market">
                  <div className="mode-card__top"><span className="mode-badge">MARKET PICK — UP TO 3 PTS</span></div>
                  <div className="mode-card__title">Predict Winner, BTTS and Over / Under</div>
                  <button type="button" className="mode-card__button"
                    onClick={() => { setMode(''); setFields(EMPTY); }}>Change type</button>
                </div>

                <div className="prediction-options">
                  <div className="option-card">
                    <span className="option-card__label">Winner</span>
                    <div className="pick-row">
                      {['Home', 'Draw', 'Away'].map(w => (
                        <button key={w} type="button"
                          className={`pick-chip ${winner === w ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('winner', winner === w ? '' : w)}>
                          {w === 'Home' ? selectedMatch.homeTeamName : w === 'Away' ? selectedMatch.awayTeamName : 'Draw'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="option-card">
                    <span className="option-card__label">Both teams to score</span>
                    <div className="pick-row">
                      {[['true', 'Yes'], ['false', 'No']].map(([val, lbl]) => (
                        <button key={val} type="button"
                          className={`pick-chip ${btts === val ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('btts', btts === val ? '' : val)}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="option-card option-card--compact">
                    <span className="option-card__label">Over / Under Pick</span>
                    <div className="pick-row">
                      {['Over', 'Under'].map(p => (
                        <button key={p} type="button"
                          className={`pick-chip ${ouPick === p ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouPick', ouPick === p ? '' : p)}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="option-card option-card--compact">
                    <span className="option-card__label">Goals line</span>
                    <div className="pick-row">
                      {['Line15', 'Line25', 'Line35'].map(line => (
                        <button key={line} type="button"
                          className={`pick-chip ${ouLine === line ? 'pick-chip--active' : ''}`}
                          onClick={() => setField('ouLine', ouLine === line ? '' : line)}>
                          {line.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {hasBetOdds && (winner || btts || (ouLine && ouPick)) && (
                  <div className="inline-bet-wrapper">
                    {mpOddsLoading && <div className="muted-text">Calculating odds...</div>}
                    {!mpOddsLoading && (
                      <div className="bet-slip">
                        <div className="bet-slip__header">
                          <div className="bet-slip__info">
                            <span className="bet-slip__pick">Market Pick</span>
                            <div className="bet-slip__legs">
                              {winner && mpOdds.winner != null && (
                                <span className="bet-slip__leg">
                                  {winner === 'Home' ? selectedMatch.homeTeamName : winner === 'Away' ? selectedMatch.awayTeamName : 'Draw'}
                                  <em>{Number(mpOdds.winner).toFixed(2)}</em>
                                </span>
                              )}
                              {btts && mpOdds.btts != null && (
                                <span className="bet-slip__leg">
                                  BTTS {btts === 'true' ? 'Yes' : 'No'}
                                  <em>{Number(mpOdds.btts).toFixed(2)}</em>
                                </span>
                              )}
                              {ouLine && ouPick && mpOdds.ou != null && (
                                <span className="bet-slip__leg">
                                  {ouPick} {ouLine.replace('Line', '').replace(/(\d)(\d)/, '$1.$2')}
                                  <em>{Number(mpOdds.ou).toFixed(2)}</em>
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="bet-slip__odds" style={{ color: 'var(--amber)' }}>
                            {combinedOdds != null ? combinedOdds.toFixed(2) : (mpSelected[0] ? Number(mpSelected[0]).toFixed(2) : '—')}
                          </span>
                        </div>

                        <div className="bet-slip__stake-row">
                          <div className="bet-slip__stake-wrap">
                            <input type="text" inputMode="numeric" placeholder="0" value={amount}
                              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAmount(v); }}
                              className="bet-slip__stake-input"
                              onKeyDown={e => e.key === 'Enter' && placeBet()} />
                            <span className="bet-slip__stake-coin">€</span>
                          </div>
                          <div className="bet-slip__quick-adds">
                            {[5, 20, 50].map(n => (
                              <button key={n} type="button" className="bet-slip__quick-add"
                                onClick={() => setAmount(a => String((Number(a) || 0) + n))}>+{n}</button>
                            ))}
                          </div>
                        </div>

                        <button type="button" className="bet-slip__cta"
                          disabled={betAmt <= 0 || loading} onClick={placeBet}>
                          <span>{loading ? 'Placing...' : `Place bet ${betAmt > 0 ? betAmt : ''} €`}</span>
                          {marketPotential != null && marketPotential > 0 && (
                            <span className="bet-slip__cta-sub">Potential win: {Number(marketPotential).toFixed(2)} €</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {feedback && (
              <div className={`alert ${feedback.type === 'ok' ? 'alert-info' : 'alert-error'}`} style={{ marginTop: 12 }}>
                {feedback.msg}
              </div>
            )}
          </div>

          {/* AI card */}
          {aiPrediction && (
            <div ref={aiRef} className="ai-card" style={{ marginTop: 16 }}>
              <h3>🤖 AI Prediction</h3>
              {aiPrediction.aiAnalysis && <p className="ai-analysis">{aiPrediction.aiAnalysis}</p>}
              <div className="ai-grid">
                <div><span className="muted-text">Predicted Score</span><div className="ai-value">{aiPrediction.predictedHomeScore} – {aiPrediction.predictedAwayScore}</div></div>
                <div><span className="muted-text">Pick</span><div className="ai-value">{aiPrediction.pick}</div></div>
                <div><span className="muted-text">Confidence</span><div className="ai-value">{aiPrediction.confidence}%</div></div>
                <div><span className="muted-text">Home Win</span><div className="ai-value">{aiPrediction.homeWinProbability}%</div></div>
                <div><span className="muted-text">Draw</span><div className="ai-value">{aiPrediction.drawProbability}%</div></div>
                <div><span className="muted-text">Away Win</span><div className="ai-value">{aiPrediction.awayWinProbability}%</div></div>
              </div>
            </div>
          )}

          {/* Quick 1X2 */}
          {hasBetOdds && !mode && !specialTab && (
            <>
              <div className="quick-bet-divider"><span>or place a quick bet</span></div>
              <QuickBetPanel match={selectedMatch} />
            </>
          )}

          {/* ── Special Bets ─────────────────────────────────────────── */}
          {hasBetOdds && (
            <div className="special-bets-section">
              <div className="special-bets-header">
                <span className="special-bets-title">Special Bets</span>
              </div>

              {/* Tab row */}
              <div className="special-tabs">
                {SPECIAL_TABS.map(({ key, label }) => (
                  <button key={key} type="button"
                    className={`special-tab ${specialTab === key ? 'special-tab--active' : ''}`}
                    onClick={() => {
                      setSpecialTab(specialTab === key ? '' : key);
                      if (mode) setMode('');
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Panels */}
              {specialTab === 'dc'      && <DoubleChancePanel match={selectedMatch} />}
              {specialTab === 'scorer'  && <GoalscorerPanel   match={selectedMatch} />}
              {specialTab === 'corners' && (
                <SpecialOUPanel match={selectedMatch} betType={BET_TYPE.Corners}
                  lines={CORNER_LINES} label="Corners" />
              )}
              {specialTab === 'yellows' && (
                <SpecialOUPanel match={selectedMatch} betType={BET_TYPE.YellowCards}
                  lines={YELLOW_LINES} label="Yellow Cards" />
              )}
            </div>
          )}

        </section>
      )}
    </div>
  );
}
