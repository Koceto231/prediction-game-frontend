import { createContext, useContext, useMemo, useState } from 'react';
import api from '../api/apiClient';

const AuthContext = createContext(null);

// Load persisted user info (id, username, email, role) — NOT the token
function loadUser() {
  try {
    const raw = localStorage.getItem('bpfl_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const isAuthenticated = !!user;
  const isAdmin         = user?.role === 'Admin';

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    // Server sets access_token + refresh_token as HttpOnly cookies.
    // Response body contains only user info (id, username, email, role).
    const response = await api.post('/Auth/login', { email, password });
    const userInfo  = response.data;

    localStorage.setItem('bpfl_user', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  // ── Google login ───────────────────────────────────────────────────
  const loginWithGoogle = async (idToken) => {
    const response = await api.post('/Auth/google', { idToken });
    const userInfo  = response.data;

    localStorage.setItem('bpfl_user', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  // ── Register ───────────────────────────────────────────────────────
  const register = async (username, email, password) => {
    const response = await api.post('/Auth/register', { username, email, password });
    return response.data;
  };

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      // Server revokes the refresh_token cookie and clears both cookies
      await api.post('/Auth/logout');
    } catch {
      // Even if the request fails, clear local state
    }
    localStorage.removeItem('bpfl_user');
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
