import { createContext, useContext, useMemo, useState } from 'react';
import api from '../api/apiClient';

const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    if (!token) return null;

    const payload = JSON.parse(atob(token.split('.')[1]));

    const role =
      payload.role ||
      payload.Role ||
      payload.roles ||
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      '';

    const username =
      payload.unique_name ||
      payload.name ||
      payload.username ||
      payload.sub ||
      'User';

    return {
      ...payload,
      role,
      username
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('bpfl_token') || '');

  const isAuthenticated = !!token;
  const user = parseJwt(token);
  const isAdmin = user?.role === 'Admin';

 const login = async (email, password) => {
  const response = await api.post('/Auth/login', { email, password });

  const { accessToken, refreshToken } = response.data;

  if (!accessToken || !refreshToken) {
    throw new Error('Tokens not returned');
  }

  localStorage.setItem('bpfl_token', accessToken);
  localStorage.setItem('bpfl_refresh', refreshToken);

  setToken(accessToken);
};

 const loginWithGoogle = async (idToken) => {
  const response = await api.post('/Auth/google', { idToken });

  const { accessToken, refreshToken } = response.data;

  if (!accessToken || !refreshToken) {
    throw new Error('Tokens not returned');
  }

  localStorage.setItem('bpfl_token', accessToken);
  localStorage.setItem('bpfl_refresh', refreshToken);

  setToken(accessToken);
};

  const register = async (username, email, password) => {
    const response = await api.post('/Auth/register', { username, email, password });
    return response.data;
  };

  const logout = async () => {
  const refreshToken = localStorage.getItem('bpfl_refresh');

  try {
    if (refreshToken) {
      await api.post('/Auth/logout', {
        refreshToken
      });
    }
  } catch {}

  localStorage.removeItem('bpfl_token');
  localStorage.removeItem('bpfl_refresh');
  setToken('');
};

  const value = useMemo(
  () => ({
    token,
    isAuthenticated,
    login,
    loginWithGoogle,
    register,
    logout,
    user,
    isAdmin
  }),
  [token, isAuthenticated, user, isAdmin]
);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}