import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/apiClient';
import { useAuth } from './AuthContext';

const WalletContext = createContext({ balance: null, refreshBalance: () => {} });

export function WalletProvider({ children }) {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await api.get('/Wallet');
      setBalance(res.data.balance);
    } catch {
      // silent — user might not be logged in yet
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshBalance();
    } else {
      setBalance(null);
    }
  }, [user, refreshBalance]);

  return (
    <WalletContext.Provider value={{ balance, refreshBalance }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
