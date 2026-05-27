import { useEffect, useState, useMemo } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

/**
 * Global floating Bet Slip — collects picks from any match and places one
 * or more bets at the same time.
 *
 *   • Each "column" (Bulgarian: "колонка") is an independent ticket
 *     with its own picks and stake. A column with 1 pick places a SINGLE
 *     bet via POST /Bet; a column with 2+ picks places an ACCUMULATOR
 *     via POST /Bet/accumulator.
 *
 *   • Multiple columns can exist side-by-side. Clicking the global
 *     "Заложи всички" button submits every non-empty column with a
 *     valid stake in parallel.
 *
 *   • Picks flow in via a `bpfl:slip:add` CustomEvent and are appended to
 *     the ACTIVE column. The active column is highlighted in the tab row;
 *     the user can switch by clicking a different tab. "+ Нова колонка"
 *     creates a fresh empty ticket and makes it active.
 *
 *   • Same-game accumulators are allowed inside a single column: a match
 *     can contribute multiple picks (different markets) as long as they
 *     don't conflict. See `isConflict` for the rules.
 */

const LS_KEY = 'bpfl:slip:columns';
const LS_KEY_LEGACY = 'bpfl:slip:items';                  // pre-multi-column layout

const newColumn = (id = Date.now()) => ({ id, picks: [], stake: '10' });

export default function BetSlipPanel() {
  const { balance, refreshBalance } = useWallet();
  const [columns,        setColumns]        = useState([newColumn(1)]);
  const [activeColumnId, setActiveColumnId] = useState(1);
  const [open,           setOpen]           = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');

  // ── Hydrate ────────────────────────────────────────────────────────
  // Read the new multi-column shape if present; otherwise migrate the
  // legacy flat-picks shape into a single column so existing slips
  // survive the refactor.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumns(parsed.map((c, i) => ({
            id:    c.id    ?? Date.now() + i,
            stake: c.stake ?? '10',
            picks: (c.picks || []).map(backfillPick),
          })));
          setActiveColumnId(parsed[0]?.id ?? 1);
          return;
        }
      }
      const legacyRaw = localStorage.getItem(LS_KEY_LEGACY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (Array.isArray(legacy) && legacy.length > 0) {
          const col = { id: 1, stake: '10', picks: legacy.map(backfillPick) };
          setColumns([col]);
          setActiveColumnId(1);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist on every change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(columns)); } catch { /* ignore */ }
  }, [columns]);

  // ── Helpers to mutate the active column ────────────────────────────
  const updateActive = (updater) => {
    setColumns(prev => prev.map(c =>
      c.id === activeColumnId ? { ...c, ...updater(c) } : c,
    ));
  };

  const activeColumn = columns.find(c => c.id === activeColumnId) || columns[0];

  // Open the slip automatically when the very first pick is added.
  const totalPicks = useMemo(
    () => columns.reduce((acc, c) => acc + c.picks.length, 0),
    [columns],
  );
  useEffect(() => {
    if (totalPicks === 1) setOpen(true);
  }, [totalPicks]);

  // ── Pick add / clear event listeners ───────────────────────────────
  // Picks ALWAYS land in the currently active column. Conflict rules
  // apply only WITHIN that column — independent columns can hold the
  // same selection.
  useEffect(() => {
    const onAdd = (e) => {
      const { matchId, pick, odds, fixture, leagueLabel, betType, line, scoreHome, scoreAway } = e.detail || {};
      if (!matchId || !pick || odds == null) return;
      const bt  = betType || 'Winner';
      const key = `${matchId}:${bt}:${pick}:${line || ''}`;
      const newPick = {
        key, matchId, betType: bt, pick,
        line:      line      || null,
        scoreHome: scoreHome ?? null,
        scoreAway: scoreAway ?? null,
        odds: Number(odds),
        fixture, leagueLabel,
      };

      setColumns(prev => prev.map(c => {
        if (c.id !== activeColumnId) return c;
        // Toggle off if exact same selection already in this column
        if (c.picks.some(p => p.key === key)) {
          return { ...c, picks: c.picks.filter(p => p.key !== key) };
        }
        const filtered = c.picks.filter(p => !isConflict(p, newPick));
        return { ...c, picks: [...filtered, newPick] };
      }));
      setError(''); setSuccess('');
    };
    const onClear = () => setColumns([newColumn()]);
    window.addEventListener('bpfl:slip:add',   onAdd);
    window.addEventListener('bpfl:slip:clear', onClear);
    return () => {
      window.removeEventListener('bpfl:slip:add',   onAdd);
      window.removeEventListener('bpfl:slip:clear', onClear);
    };
  }, [activeColumnId]);

  // ── Column-level actions ───────────────────────────────────────────
  const addColumn = () => {
    const id = Date.now();
    setColumns(prev => [...prev, newColumn(id)]);
    setActiveColumnId(id);
  };

  const removeColumn = (colId) => {
    setColumns(prev => {
      const remaining = prev.filter(c => c.id !== colId);
      if (remaining.length === 0) return [newColumn()];
      return remaining;
    });
    if (colId === activeColumnId) {
      const next = columns.find(c => c.id !== colId);
      if (next) setActiveColumnId(next.id);
    }
  };

  const removePick = (colId, key) => {
    setColumns(prev => prev.map(c =>
      c.id === colId ? { ...c, picks: c.picks.filter(p => p.key !== key) } : c,
    ));
  };

  const setColumnStake = (colId, stake) => {
    setColumns(prev => prev.map(c =>
      c.id === colId ? { ...c, stake } : c,
    ));
  };

  const clearAll = (e) => {
    e?.stopPropagation?.();
    setColumns([newColumn()]);
    setError(''); setSuccess('');
  };

  // ── Derived per-column data ────────────────────────────────────────
  const columnSummaries = useMemo(() => columns.map(c => {
    const combined  = c.picks.reduce((acc, p) => acc * (Number(p.odds) || 1), 1);
    const stakeNum  = Number(c.stake) || 0;
    const potential = stakeNum > 0 ? stakeNum * combined : 0;
    return {
      id: c.id,
      picks: c.picks,
      stake: c.stake,
      stakeNum,
      combined,
      potential,
      isAccum: c.picks.length >= 2,
      isEmpty: c.picks.length === 0,
    };
  }), [columns]);

  const totalStake = columnSummaries
    .filter(s => !s.isEmpty)
    .reduce((acc, s) => acc + s.stakeNum, 0);
  const totalPotential = columnSummaries
    .filter(s => !s.isEmpty)
    .reduce((acc, s) => acc + s.potential, 0);
  const overBalance = balance != null && totalStake > Number(balance);
  const placeableCount = columnSummaries.filter(s => !s.isEmpty && s.stakeNum > 0).length;

  // ── Submit ─────────────────────────────────────────────────────────
  const handlePlaceAll = async () => {
    if (loading || placeableCount === 0 || overBalance) return;

    // Exact Score legs can only be placed as single bets — backend's
    // AccumulatorLegDTO has no scoreHome/scoreAway fields. Block submit
    // if any column tries to combine ExactScore with other picks.
    const badEsColumn = columns.find(c =>
      c.picks.length >= 2 && c.picks.some(p => p.betType === 'ExactScore'),
    );
    if (badEsColumn) {
      setError('Точен резултат не може да се комбинира с други маркети в една колонка. Премести го в собствена колонка.');
      return;
    }

    setLoading(true); setError(''); setSuccess('');
    try {
      const placements = columnSummaries
        .filter(s => !s.isEmpty && s.stakeNum > 0)
        .map(async (s) => {
          if (s.isAccum) {
            const dto = {
              matchId: s.picks[0].matchId,
              amount:  s.stakeNum,
              legs:    s.picks.map(p => ({ matchId: p.matchId, ...toLegPayload(p) })),
            };
            return api.post('/Bet/accumulator', dto, {
              headers: { 'X-Idempotency-Key': newIdempotencyKey() },
            });
          }
          const p = s.picks[0];
          return api.post(
            '/Bet',
            { matchId: p.matchId, ...toLegPayload(p), amount: s.stakeNum },
            { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
          );
        });
      await Promise.all(placements);
      await refreshBalance();
      setSuccess(
        placeableCount === 1
          ? 'Залогът е приет!'
          : `${placeableCount} колонки приети!`,
      );
      setColumns([newColumn()]);
      setTimeout(() => { setSuccess(''); setOpen(false); }, 1600);
    } catch (err) {
      setError(err?.response?.data?.message || 'Грешка при залагане.');
    } finally {
      setLoading(false);
    }
  };

  // ── Rendering helpers ──────────────────────────────────────────────
  const pickShort = (pick) => pick === 'Home' ? '1' : pick === 'Away' ? '2' : 'X';
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
      case 'ExactScore':
        return `Точен резултат — ${p.pick}`;
      default:
        return p.pick;
    }
  };
  const pickChip = (p) => {
    switch (p.betType) {
      case 'Winner':       return pickShort(p.pick);
      case 'DoubleChance': return p.pick === 'HomeOrDraw' ? '1X' : p.pick === 'HomeOrAway' ? '12' : 'X2';
      case 'BTTS':         return p.pick === 'Yes' ? 'ДА' : 'НЕ';
      case 'OverUnder':    return `${p.pick === 'Over' ? 'O' : 'U'}${(p.line || '').replace('Line','').replace(/(\d)(\d)/, '$1.$2')}`;
      case 'ExactScore':   return p.pick;     // e.g. "1-0"
      default:             return pickShort(p.pick);
    }
  };

  // Group picks within a column by match → one card per fixture
  const groupColumn = (picks) => {
    const byMatch = new Map();
    picks.forEach(p => {
      const list = byMatch.get(p.matchId);
      if (list) list.push(p); else byMatch.set(p.matchId, [p]);
    });
    return Array.from(byMatch.entries()).map(([matchId, list]) => ({
      matchId,
      fixture: list[0].fixture,
      leagueLabel: list[0].leagueLabel,
      picks: list,
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────
  const headerLabel = () => {
    const nonEmpty = columns.filter(c => c.picks.length > 0);
    if (nonEmpty.length === 0) return null;
    if (nonEmpty.length === 1) return modeLabel(nonEmpty[0].picks.length);
    return `${nonEmpty.length} колонки`;
  };

  const summaryCombined = columnSummaries
    .filter(s => !s.isEmpty)
    .reduce((acc, s) => acc + s.combined, 0);

  return (
    <>
      {/* Tiny FAB shown only when slip is totally empty */}
      {totalPicks === 0 && !open && (
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

      {/* Connected slip — pill at the bottom is always visible, full
          panel body grows out of it upward when open. */}
      {(totalPicks > 0 || open) && (
      <div className={`gvb-slip${open ? ' gvb-slip--open' : ''}`}>
      <div className="gvb-slip__body">
        <div className="gvb-slip-panel__head">
          <button
            type="button"
            className="gvb-slip-panel__head-icon"
            onClick={clearAll}
            title="Изчисти всички"
            aria-label="Clear slip"
          >🗑</button>
          <span className="gvb-slip-panel__title">ФИШ</span>
        </div>

        {/* Active column — picks list + per-column stake */}
        <div className="gvb-slip-panel__list">
          {activeColumn.picks.length === 0 && (
            <div className="gvb-slip-panel__empty">
              <div className="gvb-slip-panel__empty-icon">🎯</div>
              <div className="gvb-slip-panel__empty-text">
                Колонка {columns.findIndex(c => c.id === activeColumnId) + 1} е празна
              </div>
              <div className="gvb-slip-panel__empty-hint">
                Натисни който и да е коефициент на мач, за да го добавиш в активната колонка.
                Натисни <strong>+</strong> горе, за да започнеш нова колонка.
              </div>
            </div>
          )}

          {groupColumn(activeColumn.picks).map(g => (
            <div key={g.matchId} className="gvb-slip-pick">
              <button
                type="button"
                className="gvb-slip-pick__remove"
                onClick={() => updateActive((c) => ({
                  picks: c.picks.filter(p => p.matchId !== g.matchId),
                }))}
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
                      onClick={() => removePick(activeColumnId, p.key)}
                      aria-label="Премахни pick"
                      title="Премахни този pick"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {activeColumn.picks.length > 0 && (() => {
          const s = columnSummaries.find(x => x.id === activeColumnId);
          return (
            <>
              <div className="gvb-slip-panel__totalrow">
                <span className="gvb-slip-panel__totalrow-mode">{modeLabel(s.picks.length)}</span>
                <span className="gvb-slip-panel__totalrow-odds">{s.combined.toFixed(2)}</span>
              </div>

              <div className="gvb-slip-panel__stake">
                <label className="gvb-slip-panel__stake-label">ЗАЛОГ НА КОЛОНКАТА</label>
                <div className="gvb-slip-panel__stake-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={s.stake}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, '');
                      setColumnStake(activeColumnId, v);
                      setError('');
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePlaceAll(); }}
                  />
                  <span>€</span>
                </div>
                <div className="gvb-slip-panel__chips">
                  {[5, 10, 20, 50, 100].map(v => (
                    <button type="button" key={v} className="gvb-slip-panel__chip"
                      onClick={() => setColumnStake(activeColumnId, String(v))}>
                      +{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gvb-slip-panel__summary">
                <div className="gvb-slip-panel__summary-row">
                  <span>Залог за тази колонка</span><strong>€{s.stakeNum.toFixed(2)}</strong>
                </div>
                <div className="gvb-slip-panel__summary-row">
                  <span>Коефициент</span><strong>{s.combined.toFixed(2)}</strong>
                </div>
                <div className="gvb-slip-panel__summary-row gvb-slip-panel__summary-row--big">
                  <span>Възможна печалба</span>
                  <strong className="gvb-slip-panel__potential">€{s.potential.toFixed(2)}</strong>
                </div>
              </div>
            </>
          );
        })()}

        {totalPicks > 0 && (
          <>
            {columns.filter(c => c.picks.length > 0).length > 1 && (
              <div className="gvb-slip-panel__totals">
                <span>Общо ({placeableCount} колонки):</span>
                <strong>€{totalStake.toFixed(2)} → €{totalPotential.toFixed(2)}</strong>
              </div>
            )}

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
                onClick={clearAll}
                disabled={loading}
              >Изчисти</button>
              <button
                type="button"
                className="gvb-slip-panel__btn gvb-slip-panel__btn--gold"
                onClick={handlePlaceAll}
                disabled={loading || placeableCount === 0 || overBalance}
              >
                {loading
                  ? 'Залагане…'
                  : placeableCount > 1
                    ? `Заложи всички (€${totalStake.toFixed(2)})`
                    : `Заложи €${totalStake.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Always-visible bottom pill — toggles the panel above */}
      <div
        className="gvb-slip__pill"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o); }}
      >
        <button
          type="button"
          className="gvb-slip-bar__trash"
          onClick={clearAll}
          title="Изчисти всички"
          aria-label="Clear slip"
          disabled={totalPicks === 0}
        >🗑</button>
        <span className="gvb-slip-bar__mode">
          {headerLabel() || 'ФИШ'}
        </span>
        {totalPicks > 0 && (
          <span className="gvb-slip-bar__total">
            Общ коеф: <strong>{summaryCombined.toFixed(2)}</strong>
          </span>
        )}
        <span className={`gvb-slip-bar__chevron${open ? ' gvb-slip-bar__chevron--open' : ''}`} aria-hidden="true">▲</span>
      </div>
      </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Back-fill `key` / `betType` on a saved pick from before the refactor. */
function backfillPick(p) {
  return {
    ...p,
    betType: p.betType || 'Winner',
    line:    p.line    || null,
    key:     p.key     || `${p.matchId}:${p.betType || 'Winner'}:${p.pick}:${p.line || ''}`,
  };
}

/** Bulgarian word for an N-leg accumulator. */
function modeLabel(n) {
  return n === 1 ? 'Единичен'
       : n === 2 ? 'Двоен'
       : n === 3 ? 'Троен'
       : n === 4 ? 'Четворен'
       :           `Системен (${n})`;
}

/**
 * Build the leg DTO shape the backend understands for a given pick.
 * Mirrors PlaceBetDTO / AccumulatorLegDTO.
 */
function toLegPayload(p) {
  const base = { betType: p.betType || 'Winner' };
  switch (base.betType) {
    case 'Winner':       return { ...base, pick: p.pick };
    case 'DoubleChance': return { ...base, dCPick: p.pick };
    case 'BTTS':         return { ...base, bTTSPick: p.pick === 'Yes' };
    case 'OverUnder':    return { ...base, oULine: p.line, oUPick: p.pick };
    case 'ExactScore':   return { ...base, scoreHome: p.scoreHome, scoreAway: p.scoreAway };
    default:             return { ...base, pick: p.pick };
  }
}

/**
 * Conflict detection between two picks on the SAME match within ONE column.
 * Returns true if `existing` should be dropped when `incoming` is added.
 */
function isConflict(existing, incoming) {
  if (existing.matchId !== incoming.matchId) return false;

  const bt = incoming.betType;

  // 0. ExactScore is exclusive — it determines the winner, BTTS and all
  //    O/U lines, so combining it with anything else on the same match
  //    is either redundant or impossible. The backend also can't carry
  //    an Exact Score leg inside an accumulator. So ExactScore CLAIMS
  //    the match in a column: adding it drops every other pick, and any
  //    other market added later drops the ExactScore.
  if (bt === 'ExactScore' || existing.betType === 'ExactScore') return true;

  // 1. Same-market dedupe
  if ((bt === 'Winner' || bt === 'DoubleChance')
      && (existing.betType === 'Winner' || existing.betType === 'DoubleChance')) return true;
  if (bt === 'BTTS' && existing.betType === 'BTTS') return true;
  if (bt === 'OverUnder' && existing.betType === 'OverUnder'
      && (existing.line || '') === (incoming.line || '')) return true;

  // 2. Semantic conflicts — combinations that can never both win
  const isUnder05 = (p) => p.betType === 'OverUnder'
    && p.pick === 'Under' && p.line === 'Line05';
  const needsAtLeastOneGoal = (p) =>
       (p.betType === 'Winner'       && (p.pick === 'Home' || p.pick === 'Away'))
    || (p.betType === 'DoubleChance' && p.pick === 'HomeOrAway');

  if (needsAtLeastOneGoal(incoming) && isUnder05(existing)) return true;
  if (needsAtLeastOneGoal(existing) && isUnder05(incoming)) return true;

  return false;
}
