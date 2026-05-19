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

const PICK_SHORTHAND = {
  Home: '1', Draw: 'X', Away: '2',
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

// ── Helpers ──────────────────────────────────────────────────────────────
function formatPick(bet) {
  if (bet.betType === 'Accumulator') {
    const n = bet.accumulatorLegs?.length ?? 0;
    return `${n}-leg accumulator`;
  }
  if (bet.betType === 'Winner') {
    if (bet.betDescription?.includes('Home')) return `1 - ${bet.homeTeam}`;
    if (bet.betDescription?.includes('Away')) return `2 - ${bet.awayTeam}`;
    return 'X - Draw';
  }
  return bet.betDescription;
}

function isMatchLive(bet) {
  if (bet.matchStatus === 'IN_PLAY') return true;
  return isActive(bet.liveState);
}

// ── The right-side Cash Out CTA (3 visual states) ────────────────────────
function CashOutCta({ bet, onCashedOut }) {
  const [quote, setQuote]     = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { refreshBalance }    = useWallet();

  // Poll the cash-out value every 5s while the match is live
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

  // ── Loading / Suspended ───────────────────────────────────────
  if (!quote) {
    return (
      <div className="mybet-cashout mybet-cashout--suspended">
        <span className="spinner-dot" />
        <div className="mybet-cashout__suspended-label">Loading…</div>
      </div>
    );
  }

  if (!quote.eligible) {
    return (
      <div className="mybet-cashout mybet-cashout--suspended">
        <div className="mybet-cashout__suspended-title">Unavailable</div>
        <div className="mybet-cashout__suspended-sub">{quote.reason || 'Not available'}</div>
      </div>
    );
  }

  // ── Active cash-out (green / red) ─────────────────────────────
  const value  = Number(quote.value);
  const stake  = Number(bet.amount);
  const profit = value - stake;
  const isLoss = profit < -0.01;
  const variant = isLoss ? 'mybet-cashout--loss' : 'mybet-cashout--profit';

  return (
    <>
      <button
        type="button"
        className={`mybet-cashout ${variant}`}
        onClick={() => setConfirm(true)}
      >
        <div className="mybet-cashout__label">Cash Out</div>
        <div className="mybet-cashout__value">€{value.toFixed(2)}</div>
        <div className="mybet-cashout__delta">
          {profit >= 0
            ? <>+{profit.toFixed(2)}</>
            : <>-{Math.abs(profit).toFixed(2)}</>}
        </div>
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

// ── The right-side panel for non-live / settled bets ─────────────────────
function SettledCta({ bet }) {
  const status = STATUS_LABELS[bet.status] ?? { label: bet.status };

  if (bet.status === 'Pending') {
    return (
      <div className="mybet-cashout mybet-cashout--suspended">
        <div className="mybet-cashout__suspended-title">Pre-match</div>
        <div className="mybet-cashout__suspended-sub">
          {new Date(bet.matchDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </div>
    );
  }

  if (bet.status === 'Won') {
    return (
      <div className="mybet-cashout mybet-cashout--profit mybet-cashout--static">
        <div className="mybet-cashout__label">Won</div>
        <div className="mybet-cashout__value">€{Number(bet.actualPayout ?? 0).toFixed(2)}</div>
        <div className="mybet-cashout__delta">+{(Number(bet.actualPayout ?? 0) - Number(bet.amount)).toFixed(2)}</div>
      </div>
    );
  }

  if (bet.status === 'Lost') {
    return (
      <div className="mybet-cashout mybet-cashout--loss mybet-cashout--static">
        <div className="mybet-cashout__label">Lost</div>
        <div className="mybet-cashout__value">-€{Number(bet.amount).toFixed(2)}</div>
        <div className="mybet-cashout__delta">stake lost</div>
      </div>
    );
  }

  if (bet.status === 'CashedOut') {
    const v = Number(bet.cashedOutAmount ?? bet.actualPayout ?? 0);
    const p = v - Number(bet.amount);
    return (
      <div className={`mybet-cashout mybet-cashout--static ${p >= 0 ? 'mybet-cashout--profit' : 'mybet-cashout--loss'}`}>
        <div className="mybet-cashout__label">Cashed Out</div>
        <div className="mybet-cashout__value">€{v.toFixed(2)}</div>
        <div className="mybet-cashout__delta">{p >= 0 ? `+${p.toFixed(2)}` : p.toFixed(2)}</div>
      </div>
    );
  }

  return (
    <div className="mybet-cashout mybet-cashout--suspended">
      <div className="mybet-cashout__suspended-title">{status.label}</div>
      <div className="mybet-cashout__suspended-sub">Refunded</div>
    </div>
  );
}

// ── One My Bets card ─────────────────────────────────────────────────────
function MyBetCard({ bet, onCashedOut }) {
  const live      = isMatchLive(bet);
  const isAccum   = bet.betType === 'Accumulator';
  const status    = STATUS_LABELS[bet.status] ?? { label: bet.status, cls: '' };
  const subtitle  = isAccum
    ? `Accumulator ${bet.accumulatorLegs?.length ?? 0} legs`
    : BET_TYPE_LABEL[bet.betType] ?? bet.betType;
  const maxPts    = bet.maxPoints ?? 3;

  return (
    <div className="mybet-card">
      <div className="mybet-card__body">
        <div className="mybet-card__top">
          <div className="mybet-card__title-wrap">
            <h3 className="mybet-card__fixture">
              <TeamCrest className="mybet-card__crest" logoUrl={bet.homeTeamLogo} name={bet.homeTeam} />
              {bet.homeTeam}
              <span className="mybet-card__vs">vs</span>
              <TeamCrest className="mybet-card__crest" logoUrl={bet.awayTeamLogo} name={bet.awayTeam} />
              {bet.awayTeam}
            </h3>
            <div className="mybet-card__subtitle">{subtitle}</div>
          </div>

          <span className={`mybet-pill ${status.cls}`}>{status.label}</span>

          <div className="mybet-card__points">
            <span className="mybet-card__points-label">POINTS</span>
            <span className="mybet-card__points-value">0/{maxPts} pts possible</span>
          </div>
        </div>

        <div className="mybet-card__stats">
          <div className="mybet-card__stat">
            <span>Pick:</span>
            <strong>{formatPick(bet)}</strong>
          </div>
          <div className="mybet-card__stat">
            <span>Odds:</span>
            <strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong>
          </div>
          <div className="mybet-card__stat">
            <span>Stake:</span>
            <strong>{Number(bet.amount).toFixed(0)} €</strong>
          </div>
          <div className="mybet-card__stat">
            <span>Potential:</span>
            <strong className="mybet-card__stat--gold">
              {Number(bet.potentialPayout).toFixed(2)} €
            </strong>
          </div>
          {live && (bet.homeScore != null || bet.awayScore != null) && (
            <div className="mybet-card__stat">
              <span>Score:</span>
              <strong>{bet.homeScore ?? 0} : {bet.awayScore ?? 0}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="mybet-card__cashout-wrap">
        {bet.status === 'Pending' && live
          ? <CashOutCta bet={bet} onCashedOut={onCashedOut} />
          : <SettledCta bet={bet} />}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────
export default function BetsPage() {
  const [bets, setBets]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('active');  // active | history

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
  const historyBets = bets.filter(b => b.status !== 'Pending');
  const list        = filter === 'active' ? activeBets : historyBets;

  if (loading) return (
    <div style={{ padding: '12px 22px 80px' }}>
      <div className="shell-card panel"><div className="empty-box">Loading bets…</div></div>
    </div>
  );

  const totalStaked    = activeBets.reduce((s, b) => s + Number(b.amount), 0);
  const totalPotential = activeBets.reduce((s, b) => s + Number(b.potentialPayout ?? 0), 0);

  return (
    <div style={{ padding: '12px 22px 80px' }}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>My Bets</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Cash out live bets or browse your history.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="mybets-summary">
        <div className="mybets-summary__card">
          <span className="mybets-summary__label">Active Bets</span>
          <strong className="mybets-summary__value">{activeBets.length}</strong>
        </div>
        <div className="mybets-summary__card">
          <span className="mybets-summary__label">Total Staked</span>
          <strong className="mybets-summary__value">{totalStaked.toFixed(0)} €</strong>
        </div>
        <div className="mybets-summary__card">
          <span className="mybets-summary__label">Potential Win</span>
          <strong className="mybets-summary__value mybets-summary__value--gold">
            {totalPotential.toFixed(2)} €
          </strong>
        </div>
      </div>

      <div className="mybets-tabs">
        <button type="button"
          className={`mybets-tab ${filter === 'active' ? 'mybets-tab--active' : ''}`}
          onClick={() => setFilter('active')}>
          Active ({activeBets.length})
        </button>
        <button type="button"
          className={`mybets-tab ${filter === 'history' ? 'mybets-tab--active' : ''}`}
          onClick={() => setFilter('history')}>
          History ({historyBets.length})
        </button>
      </div>

      {list.length === 0 && (
        <div className="empty-box" style={{ padding: '40px 0' }}>
          {filter === 'active'
            ? 'No active bets. Head to Matches to place your first bet!'
            : 'No bet history yet.'}
        </div>
      )}

      <div className="mybets-list">
        {list.map(bet => (
          <MyBetCard key={bet.id} bet={bet} onCashedOut={handleCashedOut} />
        ))}
      </div>
    </div>
  );
}
