import { useEffect, useState } from 'react';
import api from '../api/apiClient';
import { useWallet } from '../context/WalletContext';
import { isActive } from '../utils/liveState';
import TeamCrest from '../components/TeamCrest';

// ── Constants ────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  Pending:   { label: 'Pending',     cls: 'mybet-pill--pending' },
  Won:       { label: 'Won',         cls: 'mybet-pill--won'     },
  Lost:      { label: 'Lost',        cls: 'mybet-pill--lost'    },
  Void:      { label: 'Void',        cls: 'mybet-pill--void'    },
  CashedOut: { label: 'Cashed Out',  cls: 'mybet-pill--cashed'  },
};

const BET_TYPE_LABEL = {
  Winner:        '1X2',
  ExactScore:    'Exact Score',
  BTTS:          'Both Teams to Score',
  OverUnder:     'Goals Over/Under',
  Goalscorer:    'Anytime Goalscorer',
  Corners:       'Corners Over/Under',
  YellowCards:   'Yellow Cards Over/Under',
  DoubleChance:  'Double Chance',
  HtFt:          'Half-Time / Full-Time',
  ResultBtts:    'Result + BTTS',
  Accumulator:   'Accumulator',
  DrawNoBet:     'Draw No Bet',
};

const LEAGUE_LABEL = {
  PL:  'Premier League',
  BGL: 'efbet Liga',
  BL1: 'Bundesliga',
  SA:  'Serie A',
  PD:  'La Liga',
};

// ── Helpers ──────────────────────────────────────────────────────────────
function formatPick(bet) {
  if (bet.betType === 'Accumulator') {
    const n = bet.accumulatorLegs?.length ?? 0;
    return `${n}-leg accumulator`;
  }
  if (bet.betType === 'Winner') {
    if (bet.betDescription?.includes('Home')) return `${bet.homeTeam} Win`;
    if (bet.betDescription?.includes('Away')) return `${bet.awayTeam} Win`;
    return 'Draw';
  }
  return bet.betDescription;
}

function isMatchLive(bet) {
  if (bet.matchStatus === 'IN_PLAY') return true;
  return isActive(bet.liveState);
}

function formatLeagueAndTime(bet) {
  const league = LEAGUE_LABEL[bet.leagueCode] ?? bet.leagueCode ?? '';
  const d = bet.matchKickoff ? new Date(bet.matchKickoff) : null;
  if (!d) return league;
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const target   = new Date(d); target.setHours(0, 0, 0, 0);
  let when;
  if (target.getTime() === today.getTime())    when = 'TODAY';
  else if (target.getTime() === tomorrow.getTime()) when = 'TOMORROW';
  else when = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${league} • ${when} ${time}`;
}

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatSettledDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const yest     = new Date(today); yest.setDate(yest.getDate() - 1);
  const target   = new Date(d); target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return 'TODAY';
  if (target.getTime() === yest.getTime())  return 'YESTERDAY';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
}

// ── Cash-out CTA (3 visual states) — preserved from previous version ────
function CashOutCta({ bet, onCashedOut, variant = 'live' }) {
  const [quote, setQuote]     = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { refreshBalance }    = useWallet();

  useEffect(() => {
    let cancelled = false;
    const fetch = () =>
      api.get(`/Bet/${bet.id}/cash-out-value`)
        .then(r => { if (!cancelled) setQuote(r.data); })
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 5_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [bet.id]);

  const handleConfirm = async () => {
    if (!quote?.eligible) return;
    setLoading(true); setError('');
    try {
      const r = await api.post(`/Bet/${bet.id}/cash-out`, { expectedValue: quote.value });
      await refreshBalance();
      setConfirm(false);
      onCashedOut?.(bet.id, r.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Cash-out failed.');
    } finally { setLoading(false); }
  };

  if (!quote) {
    return <button type="button" className="gvb-cashout-btn gvb-cashout-btn--muted" disabled>Loading…</button>;
  }
  if (!quote.eligible) {
    return <button type="button" className="gvb-cashout-btn gvb-cashout-btn--muted" disabled title={quote.reason || ''}>Unavailable</button>;
  }

  const value  = Number(quote.value);
  const stake  = Number(bet.amount);
  const profit = value - stake;
  const isLoss = profit < -0.01;

  return (
    <>
      <button
        type="button"
        className={`gvb-cashout-btn ${variant === 'live' ? 'gvb-cashout-btn--gold' : 'gvb-cashout-btn--ghost'}`}
        onClick={() => setConfirm(true)}
      >
        Cash Out €{value.toFixed(2)}
      </button>

      {confirm && (
        <div className="cashout-modal-overlay" onClick={() => !loading && setConfirm(false)}>
          <div className="cashout-modal" onClick={e => e.stopPropagation()}>
            <div className="cashout-modal__header">
              <h3>Confirm Cash Out</h3>
              <button type="button" className="cashout-modal__close"
                onClick={() => !loading && setConfirm(false)}>×</button>
            </div>
            <div className="cashout-modal__body">
              <div className="cashout-modal__row"><span>Pick</span><strong>{bet.betDescription}</strong></div>
              <div className="cashout-modal__row"><span>Stake</span><strong>€{stake.toFixed(2)}</strong></div>
              <div className="cashout-modal__row"><span>Original Odds</span><strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong></div>
              <div className="cashout-modal__row"><span>Potential Payout</span><strong>€{Number(bet.potentialPayout).toFixed(2)}</strong></div>
              <div className={`cashout-modal__big ${isLoss ? 'cashout-badge--loss' : 'cashout-badge--profit'}`}>
                <span>Cash out for</span>
                <strong>€{value.toFixed(2)}</strong>
                <span className={`cashout-modal__delta ${isLoss ? 'cashout-badge--loss' : 'cashout-badge--profit'}`}>
                  {profit >= 0 ? `+€${profit.toFixed(2)} profit` : `−€${Math.abs(profit).toFixed(2)} loss recovered`}
                </span>
              </div>
              {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
            </div>
            <div className="cashout-modal__footer">
              <button type="button" className="cashout-modal__btn cashout-modal__btn--secondary"
                disabled={loading} onClick={() => setConfirm(false)}>Cancel</button>
              <button type="button" className="cashout-modal__btn cashout-modal__btn--primary"
                disabled={loading} onClick={handleConfirm}>
                {loading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Active bet card (stitch "Gold Edition" pass) ───────────────────────
function ActiveBetCard({ bet, onCashedOut }) {
  const live = isMatchLive(bet);
  const placedAgo = relativeTime(bet.createdAt);

  return (
    <div className={`gvb-bet${live ? ' gvb-bet--live' : ''}`}>
      <div className="gvb-bet__body">
        <div className="gvb-bet__head">
          <div className="gvb-bet__head-left">
            <div className="gvb-bet__crest-box">
              <TeamCrest className="gvb-bet__crest" logoUrl={bet.homeTeamLogo} name={bet.homeTeam} />
            </div>
            <div className="gvb-bet__title-wrap">
              <p className="gvb-bet__fixture">{bet.homeTeam} vs {bet.awayTeam}</p>
              <p className="gvb-bet__meta">{formatLeagueAndTime(bet)}</p>
            </div>
          </div>
          {live && <span className="gvb-bet__live-pill">LIVE</span>}
        </div>

        <div className="gvb-bet__stats">
          <div className="gvb-bet__stat">
            <span className="gvb-bet__stat-label">SELECTION</span>
            <span className="gvb-bet__stat-val">{formatPick(bet)}</span>
          </div>
          <div className="gvb-bet__stat">
            <span className="gvb-bet__stat-label">ODDS</span>
            <span className="gvb-bet__stat-val gvb-bet__stat-val--accent">{Number(bet.oddsAtBetTime).toFixed(2)}</span>
          </div>
          <div className="gvb-bet__stat">
            <span className="gvb-bet__stat-label">STAKE</span>
            <span className="gvb-bet__stat-val">€{Number(bet.amount).toFixed(2)}</span>
          </div>
          <div className="gvb-bet__stat">
            <span className="gvb-bet__stat-label">RETURN</span>
            <span className="gvb-bet__stat-val">€{Number(bet.potentialPayout).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="gvb-bet__foot">
        <div className="gvb-bet__placed">
          <span className="gvb-bet__placed-icon">{live ? '⏱' : '📅'}</span>
          <span>{live ? `Bet placed ${placedAgo}` : 'Pending Start'}</span>
        </div>
        <CashOutCta bet={bet} onCashedOut={onCashedOut} variant={live ? 'live' : 'pending'} />
      </div>
    </div>
  );
}

// ── Settled bet row in the right sidebar ────────────────────────────────
function SettledBetRow({ bet }) {
  const won = bet.status === 'Won' || bet.status === 'CashedOut';
  const payout = Number(bet.actualPayout ?? bet.cashedOutAmount ?? 0);
  const stake  = Number(bet.amount ?? 0);
  const profit = payout - stake;
  const dateLabel = formatSettledDate(bet.createdAt);
  const resultLabel = bet.status === 'CashedOut' ? 'CASHED OUT' : (won ? 'WIN' : bet.status === 'Lost' ? 'LOSS' : bet.status.toUpperCase());

  return (
    <div className={`gvb-settled${won ? ' gvb-settled--win' : ' gvb-settled--loss'}`}>
      <div className="gvb-settled__top">
        <span className="gvb-settled__date">{dateLabel} • {resultLabel}</span>
        <span className={`gvb-settled__amount${won ? ' gvb-settled__amount--win' : ' gvb-settled__amount--loss'}`}>
          {won ? `+€${Math.max(0, profit).toFixed(2)}` : `−€${Number(stake).toFixed(2)}`}
        </span>
      </div>
      <p className="gvb-settled__fixture">{bet.homeTeam} vs {bet.awayTeam}</p>
      <p className="gvb-settled__pick">{formatPick(bet)} • Odds {Number(bet.oddsAtBetTime).toFixed(2)}</p>
      <div className="gvb-settled__bar" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────
export default function BetsPage() {
  const [bets, setBets]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/Bet/me')
      .then(r => setBets(r.data ?? []))
      .catch(() => setError('Failed to load bets.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCashedOut = (betId, result) => {
    setBets(prev => prev.map(b => b.id === betId
      ? { ...b, status: 'CashedOut', cashedOutAmount: result?.cashedOutAmount, actualPayout: result?.cashedOutAmount }
      : b));
  };

  const activeBets  = bets.filter(b => b.status === 'Pending');
  const settledBets = bets.filter(b => b.status !== 'Pending')
                          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // ── Overview stats ─────────────────────────────────────────
  const totalExposure  = activeBets.reduce((s, b) => s + Number(b.amount), 0);
  const projectedProfit = activeBets.reduce(
    (s, b) => s + (Number(b.potentialPayout ?? 0) - Number(b.amount)),
    0
  );

  // Win rate (last 30 days) — count won + lost only, ignore void
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = settledBets.filter(b => new Date(b.createdAt).getTime() >= cutoff);
  const wins   = recent.filter(b => b.status === 'Won' || b.status === 'CashedOut').length;
  const losses = recent.filter(b => b.status === 'Lost').length;
  const wr     = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

  if (loading) return (
    <div className="gvb-page">
      <div className="empty-box" style={{ gridColumn: '1 / -1' }}>Loading bets…</div>
    </div>
  );

  return (
    <div className="gvb-page-wrap">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Betting Overview heading + 3 stat cards */}
      <section className="gvb-overview">
        <h1 className="gvb-overview__title">Betting Overview</h1>
        <div className="gvb-overview__grid">
          <div className="gvb-stat">
            <div className="gvb-stat__bg-icon">💼</div>
            <p className="gvb-stat__label">TOTAL EXPOSURE</p>
            <p className="gvb-stat__value">€{totalExposure.toFixed(2)}</p>
            <p className="gvb-stat__hint">
              <span className="gvb-stat__hint-icon">ℹ</span> Active stakes across all markets
            </p>
          </div>
          <div className="gvb-stat">
            <div className="gvb-stat__bg-icon">📈</div>
            <p className="gvb-stat__label">PROJECTED PROFIT</p>
            <p className="gvb-stat__value gvb-stat__value--accent">
              {projectedProfit >= 0 ? '+' : ''}€{projectedProfit.toFixed(2)}
            </p>
            <p className="gvb-stat__hint">
              <span className="gvb-stat__hint-icon">⚡</span> Calculated at current odds
            </p>
          </div>
          <div className="gvb-stat">
            <div className="gvb-stat__bg-icon">📊</div>
            <p className="gvb-stat__label">WIN RATE (LAST 30D)</p>
            <p className="gvb-stat__value">{wr.toFixed(1)}%</p>
            <div className="gvb-stat__bar">
              <div className="gvb-stat__bar-fill" style={{ width: `${Math.max(0, Math.min(100, wr))}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Main bento: Current Bets (8) + Settled Bets sidebar (4) */}
      <div className="gvb-page">
        <div className="gvb-page__main">
          <div className="gvb-current-head">
            <h2 className="gvb-current-head__title">Current Bets</h2>
            <span className="gvb-current-head__pill">{activeBets.length} ACTIVE</span>
          </div>

          {activeBets.length === 0 && (
            <div className="empty-box" style={{ padding: '40px 0' }}>
              No active bets. Head to Matches to place your first bet!
            </div>
          )}

          <div className="gvb-bets-list">
            {activeBets.map(bet => (
              <ActiveBetCard key={bet.id} bet={bet} onCashedOut={handleCashedOut} />
            ))}
          </div>
        </div>

        <aside className="gvb-settled-aside">
          <div className="gvb-settled-aside__head">
            <h2 className="gvb-settled-aside__title">SETTLED BETS</h2>
          </div>
          <div className="gvb-settled-aside__list">
            {settledBets.length === 0 && (
              <div className="gvb-settled-aside__empty">No settled bets yet.</div>
            )}
            {settledBets.slice(0, 8).map(bet => (
              <SettledBetRow key={bet.id} bet={bet} />
            ))}
          </div>
          {settledBets.length > 0 && (
            <button className="gvb-settled-aside__viewall" type="button">
              View Betting History →
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
