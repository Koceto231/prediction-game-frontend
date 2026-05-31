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
    if (totalPicks === 1) setOpen(true);     // first pick → pop open
    if (totalPicks === 0) setOpen(false);    // last pick removed → collapse, no empty screen
  }, [totalPicks]);

  // ── Pick add / clear event listeners ───────────────────────────────
  // Picks ALWAYS land in the currently active column. Conflict rules
  // apply only WITHIN that column — independent columns can hold the
  // same selection.
  useEffect(() => {
    const onAdd = (e) => {
      const {
        matchId, pick, odds, fixture, leagueLabel, betType, line, scoreHome, scoreAway,
        // Generic path — callers that handle exotic markets pass a ready-built
        // backend leg payload plus display strings, so the slip doesn't need a
        // per-market switch. selKey disambiguates picks that share betType+pick
        // (e.g. two TeamGoals lines, or Corners 8.5 vs 9.5).
        leg, label, chip, selKey,
      } = e.detail || {};
      if (!matchId || !pick || odds == null) return;
      const bt  = betType || 'Winner';
      const key = `${matchId}:${bt}:${pick}:${selKey || line || ''}`;
      const newPick = {
        key, matchId, betType: bt, pick,
        line:      line      || null,
        scoreHome: scoreHome ?? null,
        scoreAway: scoreAway ?? null,
        leg:       leg       || null,    // pre-built DTO (generic markets)
        label:     label     || null,    // display label (generic markets)
        chip:      chip      || null,    // short chip code (generic markets)
        odds: Number(odds),
        fixture, leagueLabel,
      };

      setColumns(prev => prev.map(c => {
        if (c.id !== activeColumnId) return c;
        // Toggle off if exact same selection already in this column
        if (c.picks.some(p => p.key === key)) {
          const removed = c.picks.find(p => p.key === key);
          emitRemoved(removed ? [removed] : []);
          return { ...c, picks: c.picks.filter(p => p.key !== key) };
        }
        // Conflicting picks get dropped — tell the page to de-select them too
        const conflicts = c.picks.filter(p => isConflict(p, newPick));
        if (conflicts.length) emitRemoved(conflicts);
        return { ...c, picks: [...c.picks.filter(p => !isConflict(p, newPick)), newPick] };
      }));
      setError(''); setSuccess('');
    };
    const onClear = () => {
      const fresh = newColumn();
      setColumns([fresh]);
      setActiveColumnId(fresh.id);
    };
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
    const col = columns.find(c => c.id === colId);
    if (col) emitRemoved(col.picks);
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
    const col = columns.find(c => c.id === colId);
    const removed = col?.picks.find(p => p.key === key);
    if (removed) emitRemoved([removed]);
    setColumns(prev => prev.map(c =>
      c.id === colId ? { ...c, picks: c.picks.filter(p => p.key !== key) } : c,
    ));
  };

  // Remove every pick of a single match from the active column.
  const removeMatch = (matchId) => {
    const col = columns.find(c => c.id === activeColumnId);
    emitRemoved((col?.picks || []).filter(p => p.matchId === matchId));
    updateActive(c => ({ picks: c.picks.filter(p => p.matchId !== matchId) }));
  };

  const setColumnStake = (colId, stake) => {
    setColumns(prev => prev.map(c =>
      c.id === colId ? { ...c, stake } : c,
    ));
  };

  const clearAll = (e) => {
    e?.stopPropagation?.();
    emitRemoved(columns.flatMap(c => c.picks));   // de-select on the page too
    // Re-point activeColumnId at the brand-new column. Without this the
    // dispatch handler keeps looking for the now-deleted id (`c.id ===
    // activeColumnId` fails for every column) and silently drops every
    // subsequent pick — bug surfaced after the user clicked Изчисти
    // and then couldn't add new picks.
    const fresh = newColumn();
    setColumns([fresh]);
    setActiveColumnId(fresh.id);
    setError(''); setSuccess('');
    // Collapse the panel so the empty-state "Колонка 1 е празна" screen
    // doesn't linger. Wrapper render check (`totalPicks > 0 || open`)
    // then hides the whole slip; the next odd-click auto-reopens it
    // via the totalPicks === 1 effect.
    setOpen(false);
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
      const fresh = newColumn();
      setColumns([fresh]);
      setActiveColumnId(fresh.id);
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
    if (p.label) return p.label;          // generic market — caller supplied it
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
      case 'HalfTimeCorrectScore':
        return `Резултат на полувремето — ${p.scoreHome}-${p.scoreAway}`;
      default:
        return p.pick;
    }
  };
  const pickChip = (p) => {
    if (p.chip) return p.chip;             // generic market — caller supplied it
    switch (p.betType) {
      case 'Winner':       return pickShort(p.pick);
      case 'DoubleChance': return p.pick === 'HomeOrDraw' ? '1X' : p.pick === 'HomeOrAway' ? '12' : 'X2';
      case 'BTTS':         return p.pick === 'Yes' ? 'ДА' : 'НЕ';
      case 'OverUnder':    return `${p.pick === 'Over' ? 'O' : 'U'}${(p.line || '').replace('Line','').replace(/(\d)(\d)/, '$1.$2')}`;
      case 'ExactScore':   return p.pick;     // e.g. "1-0"
      case 'HalfTimeCorrectScore': return `ПВ ${p.scoreHome}-${p.scoreAway}`;
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
  // Mode label is keyed off the number of distinct MATCHES in a column,
  // not the raw pick count. Two picks on the same fixture (same-game
  // accumulator like Winner + BTTS) is still a "Единичен" because there
  // is only one fixture in play; two picks on two different matches is
  // a "Двоен", and so on.
  const matchCount = (picks) => new Set(picks.map(p => p.matchId)).size;

  const headerLabel = () => {
    const nonEmpty = columns.filter(c => c.picks.length > 0);
    if (nonEmpty.length === 0) return null;
    if (nonEmpty.length === 1) return modeLabel(matchCount(nonEmpty[0].picks));
    return `${nonEmpty.length} колонки`;
  };

  const summaryCombined = columnSummaries
    .filter(s => !s.isEmpty)
    .reduce((acc, s) => acc + s.combined, 0);

  return (
    <>

      {/* Connected slip — only rendered while there are picks, so an empty
          column never shows the "Колонка е празна" screen. */}
      {totalPicks > 0 && (
      <div className={`gvb-slip${open ? ' gvb-slip--open' : ''}`}>
      <div className="gvb-slip__body">
        <div className="gvb-slip-panel__head">
          <button
            type="button"
            className="gvb-slip-panel__head-icon"
            onClick={clearAll}
            title="Изчисти всички"
            aria-label="Clear slip"
          ><TrashIcon size={20} /></button>
          <span className="gvb-slip-panel__title">ФИШ</span>
          {/* Collapse arrow — right-aligned, only the visible affordance
              to close the slip now that the bottom pill is hidden while
              the panel is open. */}
          <button
            type="button"
            className="gvb-slip-panel__head-collapse"
            onClick={() => setOpen(false)}
            title="Затвори фиша"
            aria-label="Close slip"
          >▼</button>
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
                onClick={() => removeMatch(g.matchId)}
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
                <span className="gvb-slip-panel__totalrow-mode">{modeLabel(matchCount(s.picks))}</span>
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
        ><TrashIcon size={16} /></button>
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

/**
 * Tell the rest of the app that some picks left the slip, so a page that
 * mirrors slip state (the match-detail market grid) can de-select the
 * matching buttons. Carries enough to identify the source control.
 */
function emitRemoved(picks) {
  if (!picks || picks.length === 0) return;
  window.dispatchEvent(new CustomEvent('bpfl:slip:remove', {
    detail: {
      picks: picks.map(p => ({
        key: p.key || null, matchId: p.matchId, betType: p.betType, pick: p.pick, line: p.line || null, leg: p.leg || null,
      })),
    },
  }));
}

/** Back-fill `key` / `betType` on a saved pick from before the refactor. */
function backfillPick(p) {
  return {
    ...p,
    betType: p.betType || 'Winner',
    line:    p.line    || null,
    key:     p.key     || `${p.matchId}:${p.betType || 'Winner'}:${p.pick}:${p.line || ''}`,
  };
}

/**
 * Inline trash icon — Feather/Lucide-style line art, sized via the `size`
 * prop and stroke-coloured via `currentColor` so the parent button can
 * theme it with `color`. Used in two places (panel header + collapsed
 * pill) so we don't ship the same SVG twice as a string in the bundle.
 */
function TrashIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
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
  // Generic markets ship a fully-formed leg payload from the caller.
  if (p.leg) return { betType: p.betType, ...p.leg };
  const base = { betType: p.betType || 'Winner' };
  switch (base.betType) {
    case 'Winner':       return { ...base, pick: p.pick };
    case 'DoubleChance': return { ...base, dCPick: p.pick };
    case 'BTTS':         return { ...base, bTTSPick: p.pick === 'Yes' };
    case 'OverUnder':    return { ...base, oULine: p.line, oUPick: p.pick };
    case 'ExactScore':           return { ...base, scoreHome: p.scoreHome, scoreAway: p.scoreAway };
    case 'HalfTimeCorrectScore': return { ...base, scoreHome: p.scoreHome, scoreAway: p.scoreAway };
    default:                     return { ...base, pick: p.pick };
  }
}

/**
 * Conflict detection between two picks on the SAME match within ONE column.
 * Returns true if `existing` should be dropped when `incoming` is added.
 */
function isConflict(existing, incoming) {
  if (existing.matchId !== incoming.matchId) return false;

  const bt = incoming.betType;

  // 0. Two different ExactScore picks on the same match are mutually
  //    exclusive (a match has exactly one final score). The same score
  //    twice is already handled as a key-toggle.
  if (bt === 'ExactScore' && existing.betType === 'ExactScore') return true;

  // 1. Same-market dedupe — only ONE selection per "single-choice" market
  if ((bt === 'Winner' || bt === 'DoubleChance')
      && (existing.betType === 'Winner' || existing.betType === 'DoubleChance')) return true;
  if (bt === 'BTTS'         && existing.betType === 'BTTS')         return true;
  if (bt === 'DrawNoBet'    && existing.betType === 'DrawNoBet')    return true;
  if (bt === 'Handicap'     && existing.betType === 'Handicap')     return true;
  if (bt === 'HalfTime'     && existing.betType === 'HalfTime')     return true;
  if (bt === 'FirstGoal'    && existing.betType === 'FirstGoal')    return true;
  if (bt === 'LastToScore'  && existing.betType === 'LastToScore')  return true;
  if (bt === 'HtFt'         && existing.betType === 'HtFt')         return true;
  if (bt === 'DoubleChance1stHalf' && existing.betType === 'DoubleChance1stHalf') return true;
  if (bt === 'OddEven'      && existing.betType === 'OddEven')      return true;
  if (bt === 'OddEven1stHalf' && existing.betType === 'OddEven1stHalf') return true;
  if (bt === 'Btts1stHalf'  && existing.betType === 'Btts1stHalf')  return true;
  if (bt === 'Btts2ndHalf'  && existing.betType === 'Btts2ndHalf')  return true;

  // 1b. O/U-style ladders — at most ONE line per (market + scope).
  //     • Same direction (Over 1.5 + Over 2.5) → redundant, newer replaces
  //       older (Over 2.5 already implies Over 1.5).
  //     • Opposite direction with an impossible range (Over 1.5 + Under 1.5,
  //       or any Under-line ≤ Over-line) → can never both win.
  //     • Opposite direction with a valid window (Over 1.5 + Under 3.5)
  //       survives as a genuine "goals between" range bet.
  const OU_STYLE = ['OverUnder', 'HalfTimeGoals', 'SecondHalfGoals', 'TeamGoals', 'Corners', 'YellowCards'];
  if (OU_STYLE.includes(bt) && existing.betType === bt) {
    const LINE_MAP = { Line05: 0.5, Line15: 1.5, Line25: 2.5, Line35: 3.5 };
    const dir   = (p) => p.leg?.oUPick || p.pick;                 // 'Over' | 'Under'
    const scope = (p) => bt === 'TeamGoals' ? (p.leg?.pick || '') : '';
    const lineOf = (p) => p.leg?.lineValue != null
      ? Number(p.leg.lineValue)
      : (LINE_MAP[p.line || p.leg?.oULine] ?? null);

    if (scope(incoming) === scope(existing)) {
      if (dir(incoming) === dir(existing)) return true;           // ladder → replace
      const over  = dir(incoming) === 'Over' ? incoming : existing;
      const under = dir(incoming) === 'Over' ? existing : incoming;
      const ol = lineOf(over), ul = lineOf(under);
      if (ol != null && ul != null && ul <= ol) return true;      // impossible window
    }
  }

  // 1c. Per-team single-choice markets (Win to Nil, Clean Sheet,
  //     Team to Score, Team Odd/Even, Win Both Halves) — one pick per team.
  const PER_TEAM = ['WinToNil', 'CleanSheet', 'TeamToScore', 'TeamOddEven', 'WinBothHalves'];
  if (PER_TEAM.includes(bt) && existing.betType === bt) {
    const team = (p) => p.leg?.pick || p.pick;
    if (team(incoming) === team(existing)) return true;
  }

  // 2. Semantic conflicts — derive each pick's logical constraints on the
  //    match and reject combinations whose constraints can't all hold at
  //    once (e.g. "Home win" + "Away wins both halves"). See semanticConflict.
  if (semanticConflict(existing, incoming)) return true;

  return false;
}

/**
 * Translate a single pick into the constraints it imposes on the match:
 *   ft / ht  — the still-possible Full-Time / Half-Time outcomes (Set of
 *              'H' | 'D' | 'A'); null = the pick says nothing about it.
 *   homeScored / awayScored — true/false/null tri-state.
 *   tMin / tMax — bounds on TOTAL goals.
 * Markets we can't model cleanly (Corners, Yellow Cards, Goalscorer,
 * Handicap, Odd/Even, half-goal totals) return all-null = "no constraint".
 */
function constraintsOf(p) {
  // Per-team goal bounds (hMin..hMax, aMin..aMax) + total bounds + outcome
  // sets. Scored/not-scored is expressed through the bounds (hMin≥1 = scored,
  // hMax=0 = didn't score), so there's a single source of truth.
  const c = {
    ft: null, ht: null,
    hMin: 0, hMax: Infinity,
    aMin: 0, aMax: Infinity,
    tMin: 0, tMax: Infinity,
    // Parity constraints — null = unconstrained, 'odd' | 'even' otherwise.
    hParity: null, aParity: null, tParity: null,
  };
  const LINE = { Line05: 0.5, Line15: 1.5, Line25: 2.5, Line35: 3.5 };
  const lineNum = p.leg?.lineValue != null
    ? Number(p.leg.lineValue)
    : (LINE[p.line || p.leg?.oULine] ?? null);
  const ou  = p.leg?.oUPick || (p.betType === 'OverUnder' ? p.pick : null);
  const yes = (v) => v === true || v === 'true' || v === 'Yes';

  switch (p.betType) {
    case 'Winner':
      c.ft = new Set(p.pick === 'Home' ? ['H'] : p.pick === 'Away' ? ['A'] : ['D']);
      break;
    case 'DoubleChance':
      c.ft = new Set(p.pick === 'HomeOrDraw' ? ['H', 'D']
                   : p.pick === 'HomeOrAway' ? ['H', 'A'] : ['D', 'A']);
      break;
    case 'DrawNoBet':                     // wins only on the chosen side
      c.ft = new Set(p.pick === 'Home' ? ['H'] : ['A']);
      break;
    case 'HalfTime':
      c.ht = new Set(p.pick === 'Home' ? ['H'] : p.pick === 'Away' ? ['A'] : ['D']);
      break;
    case 'DoubleChance1stHalf':           // DC at HT — narrows the HT outcome set
      c.ht = new Set(p.pick === 'HomeOrDraw' ? ['H', 'D']
                   : p.pick === 'HomeOrAway' ? ['H', 'A'] : ['D', 'A']);
      break;
    case 'WinBothHalves':                 // win both halves ⇒ win the match
      if (p.pick === 'Home') { c.ft = new Set(['H']); c.ht = new Set(['H']); }
      else                   { c.ft = new Set(['A']); c.ht = new Set(['A']); }
      break;
    case 'WinToNil':                      // win AND opponent scores 0
      if (yes(p.leg?.bTTSPick)) {
        if (p.pick === 'Home') { c.ft = new Set(['H']); c.aMax = 0; }
        else                   { c.ft = new Set(['A']); c.hMax = 0; }
      }
      break;
    case 'HtFt': {                        // 'HA' = HT Home, FT Away …
      const map = { H: 'H', D: 'D', A: 'A' };
      const code = String(p.pick || p.leg?.stringPick || '');
      if (code.length === 2) { c.ht = new Set([map[code[0]]]); c.ft = new Set([map[code[1]]]); }
      break;
    }
    case 'CleanSheet':                    // team concedes 0 ⇒ opponent 0 goals
      if (yes(p.leg?.bTTSPick)) {
        if (p.pick === 'Home') c.aMax = 0; else c.hMax = 0;
      }
      break;
    case 'TeamToScore': {
      const v = yes(p.leg?.bTTSPick);
      if (p.pick === 'Home') { if (v) c.hMin = 1; else c.hMax = 0; }
      else                   { if (v) c.aMin = 1; else c.aMax = 0; }
      break;
    }
    case 'BTTS':
      if (yes(p.pick) || yes(p.leg?.bTTSPick)) { c.hMin = 1; c.aMin = 1; }
      break;
    case 'FirstGoal':
    case 'LastToScore':
      if (p.pick === 'Home') c.hMin = 1;
      else if (p.pick === 'Away') c.aMin = 1;
      else c.tMax = 0;                    // Draw == "No Goal" == 0-0
      break;
    case 'OverUnder':
      if (lineNum != null && ou === 'Over')  c.tMin = Math.floor(lineNum) + 1;
      if (lineNum != null && ou === 'Under') c.tMax = Math.ceil(lineNum) - 1;
      break;
    case 'OddEven':                       // total goals parity; Odd ⇒ ≥1 (0 is even)
      if (p.pick === 'Odd' || yes(p.leg?.bTTSPick)) { c.tParity = 'odd'; c.tMin = Math.max(c.tMin, 1); }
      else                                          { c.tParity = 'even'; }
      break;
    case 'OddEven1stHalf':                // not derivable from ExactScore — skip
      break;
    case 'TeamOddEven': {                 // per-team goals parity
      const isOdd = (p.leg?.bTTSPick === true || p.pick === 'Odd');
      if (p.pick === 'Home' || p.leg?.pick === 'Home') {
        if (isOdd) { c.hParity = 'odd'; c.hMin = Math.max(c.hMin, 1); }
        else c.hParity = 'even';
      } else {
        if (isOdd) { c.aParity = 'odd'; c.aMin = Math.max(c.aMin, 1); }
        else c.aParity = 'even';
      }
      break;
    }
    case 'ExactScore': {                  // tight bounds: exact (h, a) goals
      const h = Number(p.scoreHome), a = Number(p.scoreAway);
      if (Number.isFinite(h) && Number.isFinite(a)) {
        c.hMin = c.hMax = h;
        c.aMin = c.aMax = a;
        c.tMin = c.tMax = h + a;
        c.ft = new Set([h > a ? 'H' : h < a ? 'A' : 'D']);
        c.hParity = h % 2 === 0 ? 'even' : 'odd';
        c.aParity = a % 2 === 0 ? 'even' : 'odd';
        c.tParity = (h + a) % 2 === 0 ? 'even' : 'odd';
      }
      break;
    }
    case 'HalfTimeCorrectScore': {        // HT scoreline → narrows c.ht only
      const h = Number(p.scoreHome), a = Number(p.scoreAway);
      if (Number.isFinite(h) && Number.isFinite(a)) {
        c.ht = new Set([h > a ? 'H' : h < a ? 'A' : 'D']);
        // FT goal bounds: FT goals must be at least the HT total (you can't
        // un-score). This catches conflicts like "HT 3-0" + "Under 1.5 FT".
        c.hMin = Math.max(c.hMin, h);
        c.aMin = Math.max(c.aMin, a);
        c.tMin = Math.max(c.tMin, h + a);
        // Track the HT score itself so two different HTCS picks conflict.
        c.htScore = `${h}-${a}`;
      }
      break;
    }
    case 'TeamGoals':                     // per-team O/U → that team's goal bound
      if (lineNum != null) {
        if (ou === 'Over') {
          const m = Math.floor(lineNum) + 1;
          if (p.pick === 'Home') c.hMin = m; else c.aMin = m;
        } else if (ou === 'Under') {
          const m = Math.ceil(lineNum) - 1;
          if (p.pick === 'Home') c.hMax = m; else c.aMax = m;
        }
      }
      break;
    default:
      break;                              // unmodelled market → no constraint
  }
  return c;
}

/** True when two picks on the same match can never both win. */
function semanticConflict(a, b) {
  const ca = constraintsOf(a), cb = constraintsOf(b);

  // Outcome-set intersections must be non-empty
  const intersect = (x, y) => x && y ? [...x].filter(v => y.has(v)) : null;
  const ft = intersect(ca.ft, cb.ft);
  const ht = intersect(ca.ht, cb.ht);
  if (ft && ft.length === 0) return true;
  if (ht && ht.length === 0) return true;

  // Combine per-team + total goal bounds; any inverted range = impossible
  const hMin = Math.max(ca.hMin, cb.hMin), hMax = Math.min(ca.hMax, cb.hMax);
  const aMin = Math.max(ca.aMin, cb.aMin), aMax = Math.min(ca.aMax, cb.aMax);
  if (hMin > hMax || aMin > aMax) return true;
  const tMin = Math.max(ca.tMin, cb.tMin, hMin + aMin);
  const tMax = Math.min(ca.tMax, cb.tMax, hMax + aMax);
  if (tMin > tMax) return true;

  // Parity intersections — if both sides claim a parity, they must agree.
  const clashParity = (x, y) => x && y && x !== y;
  if (clashParity(ca.hParity, cb.hParity)) return true;
  if (clashParity(ca.aParity, cb.aParity)) return true;
  if (clashParity(ca.tParity, cb.tParity)) return true;

  // Two different HT correct-score picks on the same match can never both win.
  if (ca.htScore && cb.htScore && ca.htScore !== cb.htScore) return true;

  // Outcome ↔ goal couplings on a forced single outcome
  const ftFinal = ca.ft && cb.ft ? new Set(ft) : (ca.ft || cb.ft);
  if (ftFinal && ftFinal.size === 1) {
    if (ftFinal.has('H')) {               // home wins ⇒ home ≥1 AND home > away
      if (hMax < 1) return true;
      if (hMax <= aMin) return true;
    }
    if (ftFinal.has('A')) {               // away wins ⇒ away ≥1 AND away > home
      if (aMax < 1) return true;
      if (aMax <= hMin) return true;
    }
    if (ftFinal.has('D')) {               // draw ⇒ home == away must be reachable
      if (Math.max(hMin, aMin) > Math.min(hMax, aMax)) return true;
    }
  }
  return false;
}
