import { createContext, useContext, useMemo, useState } from 'react';
import api, { setAccessToken, clearAccessToken } from '../api/apiClient';

const AuthContext = createContext(null);

function loadUser() {
  try {
    const raw = localStorage.getItem('bpfl_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// On startup: restore token from localStorage into axios (for cookie-blocked browsers)
const _savedToken = localStorage.getItem('bpfl_token');
if (_savedToken) setAccessToken(_savedToken);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const isAuthenticated = !!user;
  const isAdmin         = user?.role === 'Admin';

  const _applyAuth = (data) => {
    // Response shape: { user: {...}, accessToken: '...' }  OR legacy { id, username, ... }
    const userInfo    = data.user ?? data;
    const accessToken = data.accessToken ?? null;

    localStorage.setItem('bpfl_user', JSON.stringify(userInfo));
    if (accessToken) {
      localStorage.setItem('bpfl_token', accessToken);
      setAccessToken(accessToken);
    }
    setUser(userInfo);
  };

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const response = await api.post('/Auth/login', { email, password });
    _applyAuth(response.data);
  };

  // ── Google login ───────────────────────────────────────────────────
  const loginWithGoogle = async (idToken) => {
    const response = await api.post('/Auth/google', { idToken });
    _applyAuth(response.data);
  };

  // ── Register ───────────────────────────────────────────────────────
  const register = async (username, email, password) => {
    const response = await api.post('/Auth/register', { username, email, password });
    return response.data;
  };

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.post('/Auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('bpfl_user');
    localStorage.removeItem('bpfl_token');
    clearAccessToken();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isAuthenticated, isAdmin, login, loginWithGoogle, register, logout }),
    [user, isAuthenticated, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
