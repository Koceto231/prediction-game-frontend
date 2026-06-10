import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { getAccessToken } from '../api/apiClient';
import { useAuth } from './AuthContext';

const WalletContext = createContext({
  balance: null,
  refreshBalance: () => {},
  setBalanceDirectly: () => {},
});

export function WalletProvider({ children }) {
  const { user, authReady } = useAuth();
  const [balance, setBalance] = useState(null);

  const refreshBalance = useCallback(async () => {
    if (!user || !getAccessToken()) return;
    try {
      const res = await api.get('/Wallet');
      setBalance(res.data.balance);
    } catch {
      // silent — session may have expired; AuthContext bootstrap handles logout
    }
  }, [user]);

  /**
   * Optimistic update: skip the API roundtrip when the caller already
   * knows the new balance (e.g. /Wallet/topup, /admin/wallet/* and the
   * bet endpoints all return { balance } on success).
   */
  const setBalanceDirectly = useCallback((next) => {
    if (next == null) return;
    const n = Number(next);
    if (!Number.isFinite(n)) return;
    setBalance(n);
  }, []);

  useEffect(() => {
    if (authReady && user) {
      refreshBalance();
    } else if (!user) {
      setBalance(null);
    }
  }, [user, authReady, refreshBalance]);

  // Listen for a global "wallet changed" signal — anywhere in the app
  // can dispatch this after a balance-affecting action (admin adjust,
  // bet placed, bet settled) and the header / profile re-fetch picks up
  // the new value immediately.
  useEffect(() => {
    if (!authReady || !user) return undefined;
    const onSignal = (e) => {
      const next = e?.detail?.balance;
      if (next != null) setBalanceDirectly(next);
      else refreshBalance();
    };
    window.addEventListener('bpfl:wallet:refresh', onSignal);
    return () => window.removeEventListener('bpfl:wallet:refresh', onSignal);
  }, [user, authReady, refreshBalance, setBalanceDirectly]);

  // Light polling while the tab is active so async server-side changes
  // (e.g. a bet that settled minutes after placement) propagate without
  // requiring the user to refresh. Pauses when the tab is hidden so we
  // don't burn API calls in background tabs.
  useEffect(() => {
    if (!authReady || !user) return undefined;
    let timer = null;
    const tick = () => {
      if (document.visibilityState === 'visible') refreshBalance();
    };
    timer = window.setInterval(tick, 30_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshBalance(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, authReady, refreshBalance]);

  return (
    <WalletContext.Provider value={{ balance, refreshBalance, setBalanceDirectly }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
