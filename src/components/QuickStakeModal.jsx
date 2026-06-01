import { useEffect, useState } from 'react';
import api, { newIdempotencyKey } from '../api/apiClient';
import { useWallet } from '../context/WalletContext';
import TeamCrest from './TeamCrest';

/**
 * Center modal that opens when the user taps an odd on the Matches page.
 * Pre-fills the pick + odds and asks for a stake; on confirm it places
 * a Winner bet via /Bet and refreshes the wallet balance.
 *
 * Props:
 *   open       — controls visibility
 *   match      — { id, homeTeamName, awayTeamName, homeTeamLogo, awayTeamLogo, ... }
 *   pick       — 'Home' | 'Draw' | 'Away'
 *   odds       — number — the odd that was clicked
 *   onClose    — called when modal should close (after place / cancel / outside-click)
 *   onPlaced   — optional, called with the API response after a successful bet
 */
export default function QuickStakeModal({ open, match, pick, odds, onClose, onPlaced }) {
  const { balance, refreshBalance } = useWallet();
  const [amount, setAmount]   = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Reset state every time the modal opens with a new pick
  useEffect(() => {
    if (open) {
      setAmount('10');
      setError('');
      setSuccess('');
    }
  }, [open, match?.id, pick]);

  if (!open || !match || !pick) return null;

  const stakeNum  = Number(amount) || 0;
  const potential = stakeNum > 0 && odds ? stakeNum * Number(odds) : 0;

  const pickLabel  = pick === 'Home' ? match.homeTeamName
                   : pick === 'Away' ? match.awayTeamName
                   : 'Draw';
  const pickShort  = pick === 'Home' ? '1' : pick === 'Away' ? '2' : 'X';
  const pickedLogo = pick === 'Home' ? match.homeTeamLogo
                   : pick === 'Away' ? match.awayTeamLogo
                   : null;
  const pickedName = pick === 'Home' ? match.homeTeamName
                   : pick === 'Away' ? match.awayTeamName
                   : 'Draw';

  const overBalance = balance != null && stakeNum > Number(balance);

  const handlePlace = async () => {
    if (stakeNum <= 0 || loading || overBalance) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const r = await api.post(
        '/Bet',
        { matchId: match.id, betType: 'Winner', pick, amount: stakeNum },
        { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
      );
      await refreshBalance();
      setSuccess('Bet placed!');
      onPlaced?.(r.data);
      // Close after a short success flash
      setTimeout(() => { onClose?.(); }, 900);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to place bet.');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (e) => {
    const v = e.target.value.replace(/[^\d.]/g, '');
    setAmount(v);
    setError('');
  };

  return (
    <div className="gvb-stake-overlay" onClick={() => !loading && onClose?.()}>
      <div className="gvb-stake-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="gvb-stake-modal__close"
          onClick={() => !loading && onClose?.()}
          aria-label="Close"
        >×</button>

        <div className="gvb-stake-modal__head">
          <span className="gvb-stake-modal__eyebrow">QUICK BET — 1/X/2</span>
          <h3 className="gvb-stake-modal__fixture">{match.homeTeamName} vs {match.awayTeamName}</h3>
        </div>

        <div className="gvb-stake-modal__pick">
          <div className="gvb-stake-modal__pick-left">
            {pick === 'Draw'
              ? <span className="gvb-stake-modal__pick-x">X</span>
              : <TeamCrest className="gvb-stake-modal__pick-crest" logoUrl={pickedLogo} name={pickedName} />}
            <div className="gvb-stake-modal__pick-info">
              <span className="gvb-stake-modal__pick-short">{pickShort}</span>
              <span className="gvb-stake-modal__pick-label">{pickLabel}</span>
            </div>
          </div>
          <span className="gvb-stake-modal__pick-odds">{Number(odds).toFixed(2)}</span>
        </div>

        <div className="gvb-stake-modal__stake">
          <label className="gvb-stake-modal__stake-label">STAKE</label>
          <div className="gvb-stake-modal__stake-input">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePlace(); }}
              autoFocus
            />
            <span>🪙</span>
          </div>
          <div className="gvb-stake-modal__chips">
            {[5, 10, 20, 50, 100].map(v => (
              <button
                type="button"
                key={v}
                className="gvb-stake-modal__chip"
                onClick={() => setAmount(String(v))}
              >+{v}</button>
            ))}
          </div>
        </div>

        <div className="gvb-stake-modal__summary">
          <div className="gvb-stake-modal__summary-row">
            <span>Stake</span>
            <strong>{stakeNum.toFixed(2)} монети</strong>
          </div>
          <div className="gvb-stake-modal__summary-row">
            <span>Odds</span>
            <strong>{Number(odds).toFixed(2)}</strong>
          </div>
          <div className="gvb-stake-modal__summary-row gvb-stake-modal__summary-row--big">
            <span>Potential Win</span>
            <strong className="gvb-stake-modal__potential">{potential.toFixed(2)} монети</strong>
          </div>
        </div>

        {balance != null && (
          <div className={`gvb-stake-modal__balance${overBalance ? ' gvb-stake-modal__balance--over' : ''}`}>
            Wallet: {Number(balance).toFixed(2)} монети
            {overBalance && <span> — insufficient funds</span>}
          </div>
        )}

        {error   && <div className="gvb-stake-modal__feedback gvb-stake-modal__feedback--error">{error}</div>}
        {success && <div className="gvb-stake-modal__feedback gvb-stake-modal__feedback--ok">{success}</div>}

        <div className="gvb-stake-modal__actions">
          <button
            type="button"
            className="gvb-stake-modal__btn gvb-stake-modal__btn--ghost"
            onClick={() => !loading && onClose?.()}
            disabled={loading}
          >Cancel</button>
          <button
            type="button"
            className="gvb-stake-modal__btn gvb-stake-modal__btn--gold"
            onClick={handlePlace}
            disabled={loading || stakeNum <= 0 || overBalance}
          >
            {loading ? 'Залагане…' : `Заложи ${stakeNum.toFixed(2)} монети`}
          </button>
        </div>
      </div>
    </div>
  );
}
