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
// Frontend safety-net translation for descriptions that were written
// before the backend was localised. New bets already ship Bulgarian text.
// ──────────────────────────────────────────────────────────────────
// shortPickDesc — chip + clean Bulgarian label WITHOUT team names.
// When a bet card already shows the fixture header at the top, we don't
// want every leg below to repeat "Мексико печели" / "Мексико отбелязва".
// Returns `{ chip, label }` — the chip is a small yellow badge like
// "1" / "X" / "2" / "ДА" / "НЕ" / "Над 2.5"; the label is the market
// description without the team name baked in.
// Falls back to translatePickDesc for less common markets so nothing
// renders as undefined.
// ──────────────────────────────────────────────────────────────────
function shortPickDesc(bet, leg) {
  // For single bets, the relevant fields live on the bet; for accumulator
  // legs, the API ships them on each leg entry.
  const src       = leg ?? bet;
  const betType   = src?.betType ?? bet?.betType;
  const pick      = src?.pick;
  const bttsPick  = src?.bttsPick;
  const dcPick    = src?.dCPick    ?? src?.dcPick;
  const ouLine    = src?.oULine    ?? src?.ouLine;
  const ouPick    = src?.oUPick    ?? src?.ouPick;
  const lineValue = src?.lineValue;
  const stringPick = src?.stringPick;
  const scoreHome = src?.scoreHome;
  const scoreAway = src?.scoreAway;

  const lineNum = (() => {
    if (typeof ouLine === 'string') {
      const m = ouLine.match(/Line(\d{1,2})/);
      if (m) return `${m[1][0]}.${m[1].slice(1) || '5'}`;
    }
    if (lineValue != null) return String(lineValue);
    return '';
  })();

  switch (betType) {
    case 'Winner':
      if (pick === 'Home') return { chip: '1', label: 'Краен резултат — 1' };
      if (pick === 'Away') return { chip: '2', label: 'Краен резултат — 2' };
      if (pick === 'Draw') return { chip: 'X', label: 'Краен резултат — X' };
      break;
    case 'BTTS':
      return bttsPick
        ? { chip: 'ДА', label: 'И двата отбора отбелязват — Да' }
        : { chip: 'НЕ', label: 'И двата отбора отбелязват — Не' };
    case 'OverUnder':
      if (ouPick === 'Over')  return { chip: `Над ${lineNum}`,  label: `Голове над ${lineNum}` };
      if (ouPick === 'Under') return { chip: `Под ${lineNum}`, label: `Голове под ${lineNum}` };
      break;
    case 'DoubleChance':
      if (dcPick === 'HomeOrDraw') return { chip: '1X', label: 'Двоен шанс — 1X' };
      if (dcPick === 'HomeOrAway') return { chip: '12', label: 'Двоен шанс — 12' };
      if (dcPick === 'DrawOrAway') return { chip: 'X2', label: 'Двоен шанс — X2' };
      break;
    case 'DrawNoBet':
      if (pick === 'Home') return { chip: '1', label: 'Без равенство — 1' };
      if (pick === 'Away') return { chip: '2', label: 'Без равенство — 2' };
      break;
    case 'HalfTime':
      if (pick === 'Home') return { chip: '1', label: 'Резултат на полувремето — 1' };
      if (pick === 'Away') return { chip: '2', label: 'Резултат на полувремето — 2' };
      if (pick === 'Draw') return { chip: 'X', label: 'Резултат на полувремето — X' };
      break;
    case 'ExactScore': {
      const score = `${scoreHome ?? '?'}-${scoreAway ?? '?'}`;
      return { chip: score, label: `Точен резултат — ${score}` };
    }
    case 'HalfTimeCorrectScore': {
      const score = `${scoreHome ?? '?'}-${scoreAway ?? '?'}`;
      return { chip: score, label: `Точен резултат на полувремето — ${score}` };
    }
    case 'OddEven':
      return bttsPick
        ? { chip: 'НЕЧ', label: 'Нечетен брой голове' }
        : { chip: 'ЧЕТ', label: 'Четен брой голове' };
    case 'Btts1stHalf':
      return bttsPick
        ? { chip: 'ДА', label: 'И двата отбора бележат 1-во полувреме — Да' }
        : { chip: 'НЕ', label: 'И двата отбора бележат 1-во полувреме — Не' };
    case 'Btts2ndHalf':
      return bttsPick
        ? { chip: 'ДА', label: 'И двата отбора бележат 2-ро полувреме — Да' }
        : { chip: 'НЕ', label: 'И двата отбора бележат 2-ро полувреме — Не' };
    case 'HalfTimeGoals':
      if (ouPick === 'Over')  return { chip: `Над ${lineNum}`,  label: `Голове 1-во полувреме над ${lineNum}` };
      if (ouPick === 'Under') return { chip: `Под ${lineNum}`, label: `Голове 1-во полувреме под ${lineNum}` };
      break;
    case 'SecondHalfGoals':
      if (ouPick === 'Over')  return { chip: `Над ${lineNum}`,  label: `Голове 2-ро полувреме над ${lineNum}` };
      if (ouPick === 'Under') return { chip: `Под ${lineNum}`, label: `Голове 2-ро полувреме под ${lineNum}` };
      break;
    case 'Corners':
      if (ouPick === 'Over')  return { chip: `Над ${lineNum}`,  label: `Корнери над ${lineNum}` };
      if (ouPick === 'Under') return { chip: `Под ${lineNum}`, label: `Корнери под ${lineNum}` };
      break;
    case 'YellowCards':
      if (ouPick === 'Over')  return { chip: `Над ${lineNum}`,  label: `Жълти картони над ${lineNum}` };
      if (ouPick === 'Under') return { chip: `Под ${lineNum}`, label: `Жълти картони под ${lineNum}` };
      break;
    case 'AsianHandicap':
    case 'AsianHandicap1H': {
      const ln = lineValue != null
        ? (pick === 'Away' ? -Number(lineValue) : Number(lineValue))
        : 0;
      const sign = ln >= 0 ? '+' : '';
      const teamChip = pick === 'Home' ? '1' : '2';
      const halfSuffix = betType === 'AsianHandicap1H' ? ' 1H' : '';
      return {
        chip:  `${teamChip} ${sign}${ln}`,
        label: `Азиатски хендикап${halfSuffix} — ${teamChip} ${sign}${ln}`,
      };
    }
    case 'TeamToScorePenalty':
      return {
        chip:  pick === 'Home' ? '1 ⚽' : '2 ⚽',
        label: pick === 'Home' ? 'Домакин отбелязва дузпа' : 'Гост отбелязва дузпа',
      };
    case 'TeamToMissPenalty':
      return {
        chip:  pick === 'Home' ? '1 ✗' : '2 ✗',
        label: pick === 'Home' ? 'Домакин пропуска дузпа' : 'Гост пропуска дузпа',
      };
    default:
      break;
  }

  // Fallback — strip the team name when present so the description
  // doesn't repeat what the fixture header already says.
  const fallbackDesc = leg?.description ?? bet?.betDescription;
  const homeName = bet?.homeTeam || (leg?.homeTeam);
  const awayName = bet?.awayTeam || (leg?.awayTeam);
  let cleaned = String(fallbackDesc ?? '');
  if (homeName) cleaned = cleaned.replace(new RegExp(homeName, 'gi'), '').trim();
  if (awayName) cleaned = cleaned.replace(new RegExp(awayName, 'gi'), '').trim();
  cleaned = cleaned.replace(/^[—–-]+\s*/, '').replace(/\s{2,}/g, ' ').trim();
  return { chip: null, label: cleaned || fallbackDesc };
}

function translatePickDesc(desc, bet) {
  if (!desc) return desc;
  const t = String(desc).trim();
  const homeName = bet?.homeTeam || 'Домакин';
  const awayName = bet?.awayTeam || 'Гост';

  const map = {
    'Home':                 `${homeName} печели`,
    'Away':                 `${awayName} печели`,
    'Draw':                 'Равен',
    'BTTS Yes':             'И двата отбора бележат — Да',
    'BTTS No':              'И двата отбора бележат — Не',
    'Over 0.5':             'Голове над 0.5',
    'Over 1.5':             'Голове над 1.5',
    'Over 2.5':             'Голове над 2.5',
    'Over 3.5':             'Голове над 3.5',
    'Under 0.5':            'Голове под 0.5',
    'Under 1.5':            'Голове под 1.5',
    'Under 2.5':            'Голове под 2.5',
    'Under 3.5':            'Голове под 3.5',
    'Odd Goals':            'Нечетен брой голове',
    'Even Goals':           'Четен брой голове',
    'Half Time — Home':     `Резултат на полувремето — ${homeName}`,
    'Half Time — Draw':     'Резултат на полувремето — Равен',
    'Half Time — Away':     `Резултат на полувремето — ${awayName}`,
    'BTTS 1st Half Yes':    'И двата отбора бележат 1-во полувреме — Да',
    'BTTS 1st Half No':     'И двата отбора бележат 1-во полувреме — Не',
    'BTTS 2nd Half Yes':    'И двата отбора бележат 2-ро полувреме — Да',
    'BTTS 2nd Half No':     'И двата отбора бележат 2-ро полувреме — Не',
    'No Goal':              'Без гол',
    'Pending Start':        'Чака начало',
  };
  if (map[t]) return map[t];
  // Quick replacements for common substrings on multi-word descriptions
  return t
    .replace(/^Over\s+([\d.]+)$/i,  (_, n) => `Голове над ${n}`)
    .replace(/^Under\s+([\d.]+)$/i, (_, n) => `Голове под ${n}`);
}

function formatPick(bet) {
  if (bet.betType === 'Accumulator') {
    const n = bet.accumulatorLegs?.length ?? 0;
    return `${n} избора`;
  }
  if (bet.betType === 'Winner') {
    const desc = String(bet.betDescription ?? '');
    if (bet.homeTeam && desc.toLowerCase().includes(bet.homeTeam.toLowerCase())) return `${bet.homeTeam} печели`;
    if (bet.awayTeam && desc.toLowerCase().includes(bet.awayTeam.toLowerCase())) return `${bet.awayTeam} печели`;
    if (/\bhome\b/i.test(desc)) return `${bet.homeTeam} печели`;
    if (/\baway\b/i.test(desc)) return `${bet.awayTeam} печели`;
    if (/\bdraw\b/i.test(desc)) return 'Равен';
    return desc || 'Победител';
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
  const head = `${league} • ${when} ${time}`;
  if (bet.venueName) {
    return `${head} • 📍 ${bet.venueName}${bet.venueCity ? `, ${bet.venueCity}` : ''}`;
  }
  return head;
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

  // 15 s cadence + tab-visibility gate — see CashOutBadge for the rationale.
  // Cash-out value barely moves once a match isn't live; 5 s was wasted load.
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    const fetchOnce = () => {
      if (document.hidden) return;
      api.get(`/Bet/${bet.id}/cash-out-value`)
        .then(r => {
          if (cancelled) return;
          setQuote(r.data);
          if (r.data && r.data.eligible === false && intervalId) {
            clearInterval(intervalId); intervalId = null;
          }
        })
        .catch(() => {});
    };
    fetchOnce();
    intervalId = setInterval(fetchOnce, 15_000);
    const onVisibility = () => { if (!document.hidden) fetchOnce(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
    return <button type="button" className="gvb-cashout-btn gvb-cashout-btn--muted" disabled>Зарежда…</button>;
  }
  if (!quote.eligible) {
    return <button type="button" className="gvb-cashout-btn gvb-cashout-btn--muted" disabled title={quote.reason || ''}>Недостъпно</button>;
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
        Изтегли {value.toFixed(2)} монети
      </button>

      {confirm && (
        <div className="cashout-modal-overlay" onClick={() => !loading && setConfirm(false)}>
          <div className="cashout-modal" onClick={e => e.stopPropagation()}>
            <div className="cashout-modal__header">
              <h3>Потвърди изтегляне</h3>
              <button type="button" className="cashout-modal__close"
                onClick={() => !loading && setConfirm(false)}>×</button>
            </div>
            <div className="cashout-modal__body">
              <div className="cashout-modal__row"><span>Залог</span><strong>{bet.betDescription}</strong></div>
              <div className="cashout-modal__row"><span>Заложена сума</span><strong>{stake.toFixed(2)} монети</strong></div>
              <div className="cashout-modal__row"><span>Първоначален коефициент</span><strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong></div>
              <div className="cashout-modal__row"><span>Възможна печалба</span><strong>{Number(bet.potentialPayout).toFixed(2)} монети</strong></div>
              <div className={`cashout-modal__big ${isLoss ? 'cashout-badge--loss' : 'cashout-badge--profit'}`}>
                <span>Изтегли за</span>
                <strong>{value.toFixed(2)} монети</strong>
                <span className={`cashout-modal__delta ${isLoss ? 'cashout-badge--loss' : 'cashout-badge--profit'}`}>
                  {profit >= 0 ? `+${profit.toFixed(2)} монети печалба` : `−${Math.abs(profit).toFixed(2)} монети възстановени`}
                </span>
              </div>
              {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
            </div>
            <div className="cashout-modal__footer">
              <button type="button" className="cashout-modal__btn cashout-modal__btn--secondary"
                disabled={loading} onClick={() => setConfirm(false)}>Отказ</button>
              <button type="button" className="cashout-modal__btn cashout-modal__btn--primary"
                disabled={loading} onClick={handleConfirm}>
                {loading ? 'Обработва…' : 'Потвърди'}
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
  const isAccum   = bet.betType === 'Accumulator';
  const legs      = bet.accumulatorLegs ?? [];
  const [legsOpen, setLegsOpen] = useState(true); // open by default for accumulators

  // Distinct fixtures referenced by this bet — single-match bets just show
  // their home / away pair; multi-match accumulators dedupe the legs and
  // render one badge per fixture. Legs that don't carry team data (legacy
  // bets placed before the upgrade) inherit the parent bet's home / away
  // so we don't end up with "null vs null".
  const fixtures = (() => {
    if (isAccum && legs.some(l => l.matchId && (l.homeTeam || l.awayTeam))) {
      const seen = new Map();
      legs.forEach(l => {
        if (!l.matchId || seen.has(l.matchId)) return;
        if (!l.homeTeam && !l.awayTeam) return;
        seen.set(l.matchId, {
          home: l.homeTeam, away: l.awayTeam,
          homeLogo: l.homeTeamLogo, awayLogo: l.awayTeamLogo,
        });
      });
      if (seen.size > 0) return [...seen.values()];
    }
    return [{
      home: bet.homeTeam, away: bet.awayTeam,
      homeLogo: bet.homeTeamLogo, awayLogo: bet.awayTeamLogo,
    }];
  })();

  // Build the picks list — for single bets we synthesise a single-leg
  // entry so the same component renders both shapes the same way.
  const renderedLegs = isAccum ? legs : [{
    description: formatPick(bet),
    odds:        Number(bet.oddsAtBetTime),
    homeTeam:    bet.homeTeam,
    awayTeam:    bet.awayTeam,
    homeTeamLogo: bet.homeTeamLogo,
    awayTeamLogo: bet.awayTeamLogo,
  }];

  // Show the dual-crest header when the entire bet sits on one fixture —
  // both for plain single bets and for single-match accumulators where
  // every leg references the same matchId.
  const showSingleFixtureHeader = fixtures.length === 1
    && (fixtures[0].home || fixtures[0].away);

  return (
    <div className={`gvb-bet${live ? ' gvb-bet--live' : ''}`}>
      <div className="gvb-bet__body">

        {showSingleFixtureHeader && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '4px 4px 12px', marginBottom: 8,
            borderBottom: '1px solid var(--border, #2a2a2a)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TeamCrest className="gvb-bet__crest" logoUrl={fixtures[0].homeLogo} name={fixtures[0].home} />
              <TeamCrest className="gvb-bet__crest" logoUrl={fixtures[0].awayLogo} name={fixtures[0].away} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem',
                            wordBreak: 'break-word' }}>
                {fixtures[0].home} vs {fixtures[0].away}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {formatLeagueAndTime(bet)}
              </div>
            </div>
          </div>
        )}

        {/* Picks block — same shape for single + accumulator. */}
        <div className="gvb-bet__legs">
          <button
            type="button"
            className="gvb-bet__legs-toggle"
            onClick={() => setLegsOpen(o => !o)}
            style={{ fontSize: '0.92rem', padding: '10px 13px' }}
          >
            <span>{legsOpen ? '▾' : '▸'} Избори ({renderedLegs.length})</span>
            <span className="gvb-bet__legs-sum">Общо {Number(bet.oddsAtBetTime).toFixed(2)}</span>
          </button>
          {legsOpen && (
            <div className="gvb-bet__legs-list">
              {renderedLegs.map((leg, i) => {
                // Single-fixture layout: chip badge + clean label (no team
                // names duplicated from the card header). Cross-fixture
                // accumulators fall back to the per-leg fixture row so the
                // reader can still tell which match each pick is on.
                const { chip, label } = shortPickDesc(bet, leg);
                return (
                  <div key={i} className="gvb-bet__leg" style={{ padding: '10px 13px' }}>
                    {chip ? (
                      <span className="gvb-bet__leg-chip">{chip}</span>
                    ) : (
                      <span className="gvb-bet__leg-no">{i + 1}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gvb-bet__leg-desc" style={{ fontSize: '0.98rem' }}>
                        {label}
                      </div>
                      {!showSingleFixtureHeader && (leg.homeTeam || leg.awayTeam) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)',
                                      marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {leg.homeTeamLogo && (
                            <img src={leg.homeTeamLogo} alt=""
                              style={{ width: 16, height: 16, objectFit: 'contain' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          )}
                          <span>{leg.homeTeam ?? '—'} vs {leg.awayTeam ?? '—'}</span>
                          {leg.awayTeamLogo && (
                            <img src={leg.awayTeamLogo} alt=""
                              style={{ width: 16, height: 16, objectFit: 'contain' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="gvb-bet__leg-odds" style={{ fontSize: '1rem' }}>
                      {Number(leg.odds).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom stats — only STAKE + RETURN, the combined odds live in
            the legs header so they don't need a second slot. */}
        <div className="gvb-bet__stats" style={{ fontSize: '0.92rem' }}>
          <div className="gvb-bet__stat">
            <span className="gvb-bet__stat-label" style={{ fontSize: '0.78rem' }}>ЗАЛОГ</span>
            <span className="gvb-bet__stat-val" style={{ fontSize: '1.05rem' }}>{Number(bet.amount).toFixed(2)} монети</span>
          </div>
          {/* Label switches between "Потенциална печалба" (un-settled) and
                "Печалба" (settled) so it's obvious whether the number is a
                promise or a payout. Settlement is all-or-nothing for
                accumulators on the backend — losing one leg makes
                actualPayout 0 — so a partly-correct acc naturally shows
                0 монети here without any partial-credit logic. */}
          {(() => {
            const settled = bet.status && bet.status !== 'Pending';
            const value   = settled
              ? Number(bet.actualPayout ?? 0)
              : Number(bet.potentialPayout ?? 0);
            return (
              <div className="gvb-bet__stat">
                <span className="gvb-bet__stat-label" style={{ fontSize: '0.78rem' }}>
                  {settled ? 'ПЕЧАЛБА' : 'ПОТЕНЦИАЛНА ПЕЧАЛБА'}
                </span>
                <span className="gvb-bet__stat-val" style={{ fontSize: '1.05rem' }}>
                  {value.toFixed(2)} монети
                </span>
              </div>
            );
          })()}
        </div>

        {live && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <span className="gvb-bet__live-pill">НА ЖИВО</span>
          </div>
        )}
      </div>

      <div className="gvb-bet__foot">
        <div className="gvb-bet__placed">
          <span className="gvb-bet__placed-icon">{live ? '⏱' : '📅'}</span>
          <span>{live ? `Залогът е поставен преди ${placedAgo}` : 'Чака начало'}</span>
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
          {won ? `+${Math.max(0, profit).toFixed(2)} монети` : `−${Number(stake).toFixed(2)} монети`}
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
        <h1 className="gvb-overview__title">Преглед на залозите</h1>
        <div className="gvb-overview__grid">
          <div className="gvb-stat">
            <div className="gvb-stat__bg-icon">💼</div>
            <p className="gvb-stat__label">ОБЩО ЗАЛОЖЕНО</p>
            <p className="gvb-stat__value">{totalExposure.toFixed(2)} монети</p>
          </div>
          <div className="gvb-stat">
            <div className="gvb-stat__bg-icon">📈</div>
            <p className="gvb-stat__label">ПРОГНОЗНА ПЕЧАЛБА</p>
            <p className="gvb-stat__value gvb-stat__value--accent">
              {projectedProfit >= 0 ? '+' : ''}{projectedProfit.toFixed(2)} монети
            </p>
          </div>
          <div className="gvb-stat">
            <div className="gvb-stat__bg-icon">📊</div>
            <p className="gvb-stat__label">% ПЕЧЕЛИВШИ (ПОСЛ. 30 ДНИ)</p>
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
