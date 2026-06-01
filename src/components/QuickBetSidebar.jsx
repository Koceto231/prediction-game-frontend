import { useEffect, useState } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import { useWallet } from '../context/WalletContext';

const LS_QUICKBET_ENABLED = 'bpfl:quickbet:enabled';
const LS_QUICKBET_STAKE   = 'bpfl:quickbet:stake';

/**
 * Quick Bet sidebar — slide-in right panel that mirrors the stitch mockup
 * `upgraded_my_bets_overview_6`. Lets the user:
 *   • Toggle "Quick Bet Mode" — when on, clicking any 1/X/2 odd in the
 *     matches/live grids places a bet for the saved default stake without
 *     opening the full bet-slip flow.
 *   • Set a default stake (persisted to localStorage).
 *   • See the last placed bet at a glance.
 *
 * The toggle state is exposed via a small `window.bpflQuickBet` global so
 * the existing odds-click handlers in MatchesPage / LivePage can opt in
 * without prop-drilling. Anyone listening to the `bpfl:quickbet:place`
 * custom event will receive `{ matchId, pick, stake }` to perform the bet.
 */
export default function QuickBetSidebar() {
  const { refreshBalance } = useWallet();
  const [open, setOpen]         = useState(false);
  const [enabled, setEnabled]   = useState(false);
  const [stake, setStake]       = useState(10);
  const [lastBet, setLastBet]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const e = localStorage.getItem(LS_QUICKBET_ENABLED);
      const s = localStorage.getItem(LS_QUICKBET_STAKE);
      if (e === '1') setEnabled(true);
      if (s) setStake(Math.max(1, Number(s) || 10));
    } catch { /* ignore */ }
  }, []);

  // Persist + expose state on the window so non-React code can read it
  useEffect(() => {
    try { localStorage.setItem(LS_QUICKBET_ENABLED, enabled ? '1' : '0'); } catch {}
    window.bpflQuickBet = { ...(window.bpflQuickBet || {}), enabled, stake };
  }, [enabled, stake]);

  useEffect(() => {
    try { localStorage.setItem(LS_QUICKBET_STAKE, String(stake)); } catch {}
    window.bpflQuickBet = { ...(window.bpflQuickBet || {}), enabled, stake };
  }, [stake, enabled]);

  // Listen for "quick bet requested" events from the rest of the app
  useEffect(() => {
    const handler = async (e) => {
      const { matchId, pick, betType = 'Winner', meta } = e.detail || {};
      if (!matchId || !pick || stake <= 0) return;
      setFeedback({ kind: 'loading', text: 'Placing…' });
      try {
        const body = { matchId, betType, pick, amount: Number(stake) };
        await api.post('/Bet', body, { headers: { 'X-Idempotency-Key': newIdempotencyKey() } });
        await refreshBalance();
        setLastBet({
          fixture: meta?.fixture ?? `Match #${matchId}`,
          pick:    meta?.pickLabel ?? pick,
          odds:    meta?.odds ?? null,
          stake,
          when:    Date.now(),
        });
        setFeedback({ kind: 'ok', text: '✅ Bet placed!' });
      } catch (err) {
        setFeedback({ kind: 'error', text: err?.response?.data?.message || 'Failed.' });
      }
    };
    window.addEventListener('bpfl:quickbet:place', handler);
    return () => window.removeEventListener('bpfl:quickbet:place', handler);
  }, [stake, refreshBalance]);

  // Auto-dismiss feedback after 3s
  useEffect(() => {
    if (!feedback || feedback.kind === 'loading') return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  return (
    <>
      {/* Floating launcher pill */}
      <button
        type="button"
        className={`quickbet-fab${enabled ? ' quickbet-fab--on' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={enabled ? 'Quick Bet ON — click to configure' : 'Open Quick Bet'}
      >
        <span className="quickbet-fab__icon">⚡</span>
        <span className="quickbet-fab__label">Quick Bet</span>
        {enabled && <span className="quickbet-fab__dot" />}
      </button>

      {/* Slide-in panel */}
      <div className={`quickbet-panel${open ? ' quickbet-panel--open' : ''}`}>
        <div className="quickbet-panel__head">
          <span className="quickbet-panel__title">QUICK BET</span>
          <button type="button" className="quickbet-panel__close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="quickbet-panel__row">
          <span>Quick Bet Mode</span>
          <button
            type="button"
            className={`quickbet-toggle${enabled ? ' quickbet-toggle--on' : ''}`}
            onClick={() => setEnabled(v => !v)}
            aria-pressed={enabled}
          >
            <span className="quickbet-toggle__knob" />
          </button>
        </div>

        <div className="quickbet-panel__field">
          <label className="quickbet-panel__label">DEFAULT STAKE</label>
          <div className="quickbet-panel__stake">
            <input
              type="text"
              inputMode="numeric"
              value={stake}
              onChange={e => setStake(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1))}
            />
            <span>🪙</span>
          </div>
          <div className="quickbet-panel__quick-adds">
            {[5, 10, 20, 50].map(v => (
              <button type="button" key={v} className="quickbet-panel__quick-add"
                      onClick={() => setStake(v)}>{v}</button>
            ))}
          </div>
        </div>

        <div className="quickbet-panel__last">
          <div className="quickbet-panel__last-head">LAST PLACED BET</div>
          {lastBet ? (
            <div className="quickbet-panel__last-card">
              <div className="quickbet-panel__last-fixture">{lastBet.fixture}</div>
              <div className="quickbet-panel__last-meta">
                <span className="quickbet-panel__last-pick">{lastBet.pick}</span>
                {lastBet.odds != null && (
                  <span className="quickbet-panel__last-odds">@ {Number(lastBet.odds).toFixed(2)}</span>
                )}
                <span className="quickbet-panel__last-stake">{lastBet.stake} монети</span>
              </div>
            </div>
          ) : (
            <div className="quickbet-panel__last-empty">No bets placed yet.</div>
          )}
        </div>

        {feedback && (
          <div className={`quickbet-panel__feedback quickbet-panel__feedback--${feedback.kind}`}>
            {feedback.text}
          </div>
        )}

        <div className="quickbet-panel__hint">
          {enabled
            ? 'Tap any 1 / X / 2 odd in Matches or Live to place a bet for your default stake instantly.'
            : 'Toggle ON, then tap any odd to bet without opening the full slip.'}
        </div>
      </div>

      {open && <div className="quickbet-panel__scrim" onClick={() => setOpen(false)} />}
    </>
  );
}
