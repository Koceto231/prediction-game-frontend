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

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
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

  // Custom-event listener — picks flow in from MatchCard / LivePage etc.
  useEffect(() => {
    const onAdd = (e) => {
      const { matchId, pick, odds, fixture, leagueLabel } = e.detail || {};
      if (!matchId || !pick || odds == null) return;
      setItems(prev => {
        // Replace any existing pick on the same match
        const filtered = prev.filter(p => p.matchId !== matchId);
        return [...filtered, { matchId, pick, odds: Number(odds), fixture, leagueLabel }];
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

  const remove = (matchId) =>
    setItems(prev => prev.filter(p => p.matchId !== matchId));

  const stakeNum = Number(stake) || 0;
  const combined = useMemo(
    () => items.reduce((acc, p) => acc * (Number(p.odds) || 1), 1),
    [items],
  );
  const potential   = stakeNum > 0 ? stakeNum * combined : 0;
  const overBalance = balance != null && stakeNum > Number(balance);
  const isAccum     = items.length >= 2;

  const handlePlace = async () => {
    if (items.length === 0 || stakeNum <= 0 || loading || overBalance) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      if (isAccum) {
        // Multi-match accumulator
        const dto = {
          matchId: items[0].matchId, // anchor — backend allows per-leg matchId override
          amount: stakeNum,
          legs: items.map(p => ({
            matchId: p.matchId,
            betType: 'Winner',
            pick:    p.pick,
          })),
        };
        await api.post('/Bet/accumulator', dto, {
          headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        });
      } else {
        const p = items[0];
        await api.post(
          '/Bet',
          { matchId: p.matchId, betType: 'Winner', pick: p.pick, amount: stakeNum },
          { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
        );
      }
      await refreshBalance();
      setSuccess(isAccum ? `${items.length}-leg accumulator placed!` : 'Bet placed!');
      setItems([]);
      setTimeout(() => { setSuccess(''); setOpen(false); }, 1400);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to place bet.');
    } finally {
      setLoading(false);
    }
  };

  const pickShort = (pick) => pick === 'Home' ? '1' : pick === 'Away' ? '2' : 'X';

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
              <span key={p.matchId} className="gvb-slip-bar__chip" title={p.fixture}>
                {pickShort(p.pick)}
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

          {items.map(p => (
            <div key={p.matchId} className="gvb-slip-pick">
              <button
                type="button"
                className="gvb-slip-pick__remove"
                onClick={() => remove(p.matchId)}
                aria-label="Премахни"
              >×</button>
              <div className="gvb-slip-pick__body">
                <div className="gvb-slip-pick__fixture">{p.fixture || `Match #${p.matchId}`}</div>
                {p.leagueLabel && <div className="gvb-slip-pick__league">{p.leagueLabel}</div>}
                <div className="gvb-slip-pick__row">
                  <span className="gvb-slip-pick__sel">
                    <span className="gvb-slip-pick__sel-code">{pickShort(p.pick)}</span>
                    <span className="gvb-slip-pick__sel-label">
                      {p.pick === 'Home' ? 'Краен резултат — 1' : p.pick === 'Away' ? 'Краен резултат — 2' : 'Краен резултат — X'}
                    </span>
                  </span>
                  <span className="gvb-slip-pick__odds">{Number(p.odds).toFixed(2)}</span>
                </div>
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
