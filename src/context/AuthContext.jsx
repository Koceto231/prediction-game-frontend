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
    const newToken = response.data.token ?? response.data.Token;

    if (!newToken) {
      throw new Error('Token was not returned from login response.');
    }

    localStorage.setItem('bpfl_token', newToken);
    setToken(newToken);
  };

  const register = async (username, email, password) => {
    const response = await api.post('/Auth/register', { username, email, password });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('bpfl_token');
    setToken('');
  };

  const value = useMemo(
    () => ({
      token,
      isAuthenticated,
      login,
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