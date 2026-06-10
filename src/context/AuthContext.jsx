import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAccessToken, clearAccessToken, bootstrapSession } from '../api/apiClient';

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
  // Gate wallet / profile calls until startup refresh finishes so an expired
  // access token doesn't flash a 401 before the refresh cookie is exchanged.
  const [authReady, setAuthReady] = useState(() => !loadUser());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await bootstrapSession();
      if (cancelled) return;
      if (!ok) setUser(null);
      setAuthReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

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

  // ── Register ───────────────────────────────────────────────────────
  // Open registration is closed — every signup must carry an inviteToken
  // issued by an admin. The /register page reads it from the URL query.
  const register = async (username, email, password, inviteToken) => {
    const response = await api.post('/Auth/register', {
      username, email, password, inviteToken,
    });
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
    () => ({ user, authReady, isAuthenticated, isAdmin, login, register, logout }),
    [user, authReady, isAuthenticated, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
