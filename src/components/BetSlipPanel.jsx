import { useEffect, useState, useMemo } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

/**
 * Global floating Bet Slip — collects 1/X/2 picks from any match (Matches
 * page, Live page, anywhere). Two modes:
 *
 *   • SINGLE  (1 pick)  — places a plain Winner bet via POST /Bet
 *   • ACCUM   (2+ picks) — places a multi-match accumulator via
 *     POST /Bet/accumulator with one leg per pick, each carrying its
 *     own matchId so the backend settles them against the right fixtures.
 *
 * Picks come in via the `bpfl:slip:add` custom event so any UI element
 * (MatchCard odd buttons, LivePage odds, etc.) can opt in without prop
 * drilling:
 *
 *   window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
 *     detail: { matchId, pick, odds, fixture, leagueLabel },
 *   }));
 *
 * Only ONE pick per match is allowed (re-adding from the same match
 * replaces the previous pick).
 */

const LS_KEY = 'bpfl:slip:items';

export default function BetSlipPanel() {
  const { balance, refreshBalance } = useWallet();
  const [items,   setItems]   = useState([]);     // [{ matchId, pick, odds, fixture, leagueLabel }]
  const [open,    setOpen]    = useState(false);
  const [stake,   setStake]   = useState('10');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Hydrate from localStorage on mount. Backfill `key` and `betType` for
  // any picks saved before the same-game-accumulator refactor so old slips
  // keep working after upgrade.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed.map((p) => ({
            ...p,
            betType: p.betType || 'Winner',
            key:     p.key     || `${p.matchId}:${p.betType || 'Winner'}:${p.pick}`,
          })));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist on every change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  // Open the slip automatically when the first pick is added
  useEffect(() => {
    if (items.length === 1) setOpen(true);
  }, [items.length]);

  // Custom-event listener — picks flow in from MatchCard / LivePage / MatchDetail.
  //
  // Same-game accumulator: multiple picks from the SAME match are allowed,
  // as long as they target different markets. We dedupe by a composite key
  //   `${matchId}:${betType}:${pick}:${line || ''}`
  // so re-clicking the exact same selection removes it (toggle).
  //
  // Beyond exact-key toggling, the following CONFLICTS still apply within
  // the same match (adding a new pick removes the conflicting one):
  //   • Winner ↔ Double Chance   — pick one or the other, not both
  //   • BTTS Yes ↔ BTTS No       — only one BTTS pick per match
  //   • OverUnder Over@line ↔ Under@line — only one O/U pick per line
  useEffect(() => {
    const onAdd = (e) => {
      const { matchId, pick, odds, fixture, leagueLabel, betType, line } = e.detail || {};
      if (!matchId || !pick || odds == null) return;
      const bt  = betType || 'Winner';
      const key = `${matchId}:${bt}:${pick}:${line || ''}`;

      setItems(prev => {
        // Exact-same selection already there → toggle off
        if (prev.some(p => p.key === key)) {
          return prev.filter(p => p.key !== key);
        }

        // Determine which existing picks (if any) conflict with this new one
        const isConflict = (p) => {
          if (p.matchId !== matchId) return false;
          if (bt === 'Winner' || bt === 'DoubleChance')
            return p.betType === 'Winner' || p.betType === 'DoubleChance';
          if (bt === 'BTTS')
            return p.betType === 'BTTS';
          if (bt === 'OverUnder')
            return p.betType === 'OverUnder' && (p.line || '') === (line || '');
          return false;
        };

        const filtered = prev.filter(p => !isConflict(p));
        return [...filtered, {
          key,
          matchId,
          betType: bt,
          pick,
          line:    line || null,
          odds:    Number(odds),
          fixture,
          leagueLabel,
        }];
      });
      setError(''); setSuccess('');
    };
    const onClear = () => setItems([]);
    window.addEventListener('bpfl:slip:add',   onAdd);
    window.addEventListener('bpfl:slip:clear', onClear);
    return () => {
      window.removeEventListener('bpfl:slip:add',   onAdd);
      window.removeEventListener('bpfl:slip:clear', onClear);
    };
  }, []);

  const remove = (key) =>
    setItems(prev => prev.filter(p => p.key !== key));

  const stakeNum = Number(stake) || 0;
  const combined = useMemo(
    () => items.reduce((acc, p) => acc * (Number(p.odds) || 1), 1),
    [items],
  );

  // Group picks by match — render one card per fixture with sub-rows inside.
  // Insertion order is preserved by stamping the first-seen order.
  const grouped = useMemo(() => {
    const byMatch = new Map();
    items.forEach((p) => {
      const list = byMatch.get(p.matchId);
      if (list) list.push(p);
      else byMatch.set(p.matchId, [p]);
    });
    return Array.from(byMatch.entries()).map(([matchId, picks]) => ({
      matchId,
      fixture:     picks[0].fixture,
      leagueLabel: picks[0].leagueLabel,
      picks,
    }));
  }, [items]);
  const potential   = stakeNum > 0 ? stakeNum * combined : 0;
  const overBalance = balance != null && stakeNum > Number(balance);
  const isAccum     = items.length >= 2;

  /**
   * Build a leg DTO shape the backend understands for a given slip pick.
   * Mirrors the field layout in PlaceBetDTO / AccumulatorLegDTO.
   */
  const toLegPayload = (p) => {
    const base = { betType: p.betType || 'Winner' };
    switch (base.betType) {
      case 'Winner':
        return { ...base, pick: p.pick };
      case 'DoubleChance':
        return { ...base, dCPick: p.pick };
      case 'BTTS':
        return { ...base, bTTSPick: p.pick === 'Yes' };
      case 'OverUnder':
        return { ...base, oULine: p.line, oUPick: p.pick };
      default:
        return { ...base, pick: p.pick };
    }
  };

  const handlePlace = async () => {
    if (items.length === 0 || stakeNum <= 0 || loading || overBalance) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      if (isAccum) {
        const dto = {
          matchId: items[0].matchId,        // anchor; per-leg matchId overrides it
          amount:  stakeNum,
          legs:    items.map(p => ({ matchId: p.matchId, ...toLegPayload(p) })),
        };
        await api.post('/Bet/accumulator', dto, {
          headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        });
      } else {
        const p = items[0];
        await api.post(
          '/Bet',
          { matchId: p.matchId, ...toLegPayload(p), amount: stakeNum },
          { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
        );
      }
      await refreshBalance();
      setSuccess(isAccum ? `Заложен ${modeLabel(items.length).toLowerCase()}!` : 'Залогът е приет!');
      setItems([]);
      setTimeout(() => { setSuccess(''); setOpen(false); }, 1400);
    } catch (err) {
      setError(err?.response?.data?.message || 'Грешка при залагане.');
    } finally {
      setLoading(false);
    }
  };

  const pickShort = (pick) => pick === 'Home' ? '1' : pick === 'Away' ? '2' : 'X';

  /** Human label for the pick code shown in slip rows. */
  const pickLabel = (p) => {
    switch (p.betType) {
      case 'Winner':
        return p.pick === 'Home' ? 'Краен резултат — 1'
             : p.pick === 'Away' ? 'Краен резултат — 2'
             :                     'Краен резултат — X';
      case 'DoubleChance':
        return p.pick === 'HomeOrDraw' ? 'Двоен шанс — 1X'
             : p.pick === 'HomeOrAway' ? 'Двоен шанс — 12'
             :                           'Двоен шанс — X2';
      case 'BTTS':
        return `И двата отбора отбелязват — ${p.pick === 'Yes' ? 'Да' : 'Не'}`;
      case 'OverUnder':
        return `Голове ${p.pick === 'Over' ? 'над' : 'под'} ${(p.line || '').replace('Line','').replace(/(\d)(\d)/, '$1.$2')}`;
      default:
        return p.marketLabel || p.pick;
    }
  };

  /** Short chip code (used in collapsed bar). */
  const pickChip = (p) => {
    switch (p.betType) {
      case 'Winner':       return pickShort(p.pick);
      case 'DoubleChance': return p.pick === 'HomeOrDraw' ? '1X' : p.pick === 'HomeOrAway' ? '12' : 'X2';
      case 'BTTS':         return p.pick === 'Yes' ? 'ДА' : 'НЕ';
      case 'OverUnder':    return `${p.pick === 'Over' ? 'O' : 'U'}${(p.line || '').replace('Line','').replace(/(\d)(\d)/, '$1.$2')}`;
      default:             return pickShort(p.pick);
    }
  };

  // Bulgarian label for accumulator type based on legs count
  const modeLabel = (n) =>
    n === 1 ? 'Единичен'
    : n === 2 ? 'Двоен'
    : n === 3 ? 'Троен'
    : n === 4 ? 'Четворен'
    : `Системен (${n})`;

  const clearAll = (e) => {
    e?.stopPropagation?.();
    setItems([]);
    setError(''); setSuccess('');
  };

  return (
    <>
      {/* Compact bottom bar — visible whenever there are picks. Click to expand. */}
      {items.length > 0 && !open && (
        <div
          className="gvb-slip-bar"
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}
        >
          <button
            type="button"
            className="gvb-slip-bar__trash"
            onClick={clearAll}
            title="Изчисти всички"
            aria-label="Clear slip"
          >🗑</button>
          <span className="gvb-slip-bar__mode">{modeLabel(items.length)}</span>
          <div className="gvb-slip-bar__chips">
            {items.map(p => (
              <span key={p.key} className="gvb-slip-bar__chip" title={p.fixture}>
                {pickChip(p)}
              </span>
            ))}
          </div>
          <span className="gvb-slip-bar__total">
            Общ коеф: <strong>{combined.toFixed(2)}</strong>
          </span>
          <span className="gvb-slip-bar__chevron" aria-hidden="true">▲</span>
        </div>
      )}

      {/* Tiny FAB shown only when slip is empty, so user can still open it */}
      {items.length === 0 && !open && (
        <button
          type="button"
          className="gvb-slip-fab gvb-slip-fab--empty"
          onClick={() => setOpen(true)}
          title="Bet Slip"
        >
          <span className="gvb-slip-fab__icon">🎟</span>
          <span className="gvb-slip-fab__label">Slip</span>
        </button>
      )}

      {/* Slide-in panel from the RIGHT */}
      <div className={`gvb-slip-panel${open ? ' gvb-slip-panel--open' : ''}`}>
        <div className="gvb-slip-panel__head">
          <button
            type="button"
            className="gvb-slip-panel__head-icon"
            onClick={clearAll}
            title="Изчисти всички"
            disabled={items.length === 0}
          >🗑</button>
          <span className="gvb-slip-panel__title">
            ФИШ {items.length > 0 && <span className="gvb-slip-panel__count">{items.length}</span>}
          </span>
          <button type="button" className="gvb-slip-panel__close" onClick={() => setOpen(false)}>⌄</button>
        </div>

        {/* Tabs row — only Single + Multi are real modes for now */}
        <div className="gvb-slip-panel__tabs" role="tablist">
          <button type="button" role="tab"
            className={`gvb-slip-panel__tab${!isAccum ? ' gvb-slip-panel__tab--active' : ''}`}
            disabled
          >Единични</button>
          <button type="button" role="tab"
            className={`gvb-slip-panel__tab${isAccum ? ' gvb-slip-panel__tab--active' : ''}`}
            disabled
          >Множествени</button>
          <button type="button" role="tab"
            className="gvb-slip-panel__tab"
            disabled
            title="Скоро"
          >Системи</button>
        </div>

        <div className="gvb-slip-panel__list">
          {items.length === 0 && (
            <div className="gvb-slip-panel__empty">
              <div className="gvb-slip-panel__empty-icon">🎯</div>
              <div className="gvb-slip-panel__empty-text">Фишът е празен</div>
              <div className="gvb-slip-panel__empty-hint">
                Натисни <strong>1 / X / 2</strong> на който и да е мач, за да го добавиш тук.
                Добави втори pick от друг мач, за да направиш колонка.
              </div>
            </div>
          )}

          {grouped.map(g => (
            <div key={g.matchId} className="gvb-slip-pick">
              <button
                type="button"
                className="gvb-slip-pick__remove"
                onClick={() => setItems(prev => prev.filter(p => p.matchId !== g.matchId))}
                aria-label="Премахни мача"
                title="Премахни всички picks от мача"
              >×</button>
              <div className="gvb-slip-pick__body">
                <div className="gvb-slip-pick__fixture">{g.fixture || `Match #${g.matchId}`}</div>
                {g.leagueLabel && <div className="gvb-slip-pick__league">{g.leagueLabel}</div>}
                {g.picks.map(p => (
                  <div key={p.key} className="gvb-slip-pick__row gvb-slip-pick__row--sub">
                    <span className="gvb-slip-pick__sel">
                      <span className="gvb-slip-pick__sel-code">{pickChip(p)}</span>
                      <span className="gvb-slip-pick__sel-label">{pickLabel(p)}</span>
                    </span>
                    <span className="gvb-slip-pick__odds">{Number(p.odds).toFixed(2)}</span>
                    <button
                      type="button"
                      className="gvb-slip-pick__row-remove"
                      onClick={() => remove(p.key)}
                      aria-label="Премахни pick"
                      title="Премахни този pick"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <>
            {/* Mode + combined odds banner — mimics "Двоен  9.21" row */}
            <div className="gvb-slip-panel__totalrow">
              <span className="gvb-slip-panel__totalrow-mode">{modeLabel(items.length)}</span>
              <span className="gvb-slip-panel__totalrow-odds">{combined.toFixed(2)}</span>
            </div>

            <div className="gvb-slip-panel__stake">
              <label className="gvb-slip-panel__stake-label">ЗАЛОГ</label>
              <div className="gvb-slip-panel__stake-input">
                <input
                  type="text"
                  inputMode="decimal"
                  value={stake}
                  onChange={(e) => { setStake(e.target.value.replace(/[^\d.]/g, '')); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePlace(); }}
                />
                <span>€</span>
              </div>
              <div className="gvb-slip-panel__chips">
                {[5, 10, 20, 50, 100].map(v => (
                  <button type="button" key={v} className="gvb-slip-panel__chip" onClick={() => setStake(String(v))}>
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            <div className="gvb-slip-panel__summary">
              <div className="gvb-slip-panel__summary-row">
                <span>Общ залог</span><strong>€{stakeNum.toFixed(2)}</strong>
              </div>
              <div className="gvb-slip-panel__summary-row">
                <span>Общ коефициент</span><strong>{combined.toFixed(2)}</strong>
              </div>
              <div className="gvb-slip-panel__summary-row gvb-slip-panel__summary-row--big">
                <span>Възможна печалба</span>
                <strong className="gvb-slip-panel__potential">€{potential.toFixed(2)}</strong>
              </div>
            </div>

            {balance != null && (
              <div className={`gvb-slip-panel__balance${overBalance ? ' gvb-slip-panel__balance--over' : ''}`}>
                Баланс: €{Number(balance).toFixed(2)}
                {overBalance && <span> — недостатъчни средства</span>}
              </div>
            )}

            {error   && <div className="gvb-slip-panel__feedback gvb-slip-panel__feedback--error">{error}</div>}
            {success && <div className="gvb-slip-panel__feedback gvb-slip-panel__feedback--ok">{success}</div>}

            <div className="gvb-slip-panel__actions">
              <button
                type="button"
                className="gvb-slip-panel__btn gvb-slip-panel__btn--ghost"
                onClick={() => { setItems([]); setStake('10'); setError(''); }}
                disabled={loading}
              >Изчисти</button>
              <button
                type="button"
                className="gvb-slip-panel__btn gvb-slip-panel__btn--gold"
                onClick={handlePlace}
                disabled={loading || stakeNum <= 0 || overBalance}
              >
                {loading
                  ? 'Залагане…'
                  : isAccum
                    ? `Заложи ${modeLabel(items.length).toLowerCase()} €${stakeNum.toFixed(2)}`
                    : `Заложи €${stakeNum.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>

    </>
  );
}
