import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:7031/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send HttpOnly cookies automatically on every request
});

// ── Idempotency key generator ─────────────────────────────────────────────────
// Use the same key on retries of the same logical bet — the backend will return
// the existing bet instead of creating a duplicate. Generate ONCE per user
// action (e.g. when "Place Bet" is clicked).
export function newIdempotencyKey() {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// ── In-memory token store ─────────────────────────────────────────────────────
// Used as fallback when cross-origin HttpOnly cookies are blocked
// (Safari ITP, Brave shields, Chrome strict privacy mode).
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

export function getAccessToken() {
  return _accessToken ?? localStorage.getItem('bpfl_token');
}

/** Restore a valid access token before protected calls on page load. */
export async function bootstrapSession() {
  if (!localStorage.getItem('bpfl_user')) return true;

  try {
    const refreshRes = await axios.post(
      `${API_BASE_URL}/Auth/refresh`,
      {},
      { withCredentials: true }
    );
    const newToken = refreshRes.data?.accessToken;
    if (newToken) {
      _accessToken = newToken;
      localStorage.setItem('bpfl_token', newToken);
    }
    return true;
  } catch {
    localStorage.removeItem('bpfl_user');
    localStorage.removeItem('bpfl_token');
    _accessToken = null;
    return false;
  }
}

// ── Request interceptor: attach Bearer header when cookie may be blocked ──────
api.interceptors.request.use((config) => {
  if (_accessToken && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${_accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

// Auth endpoints that should never trigger a refresh retry
const AUTH_PATHS = new Set(['/Auth/login', '/Auth/register', '/Auth/google', '/Auth/refresh', '/Auth/logout']);

// URLs whose successful response should bump the wallet balance — placing
// a bet debits, cashing out credits. Listing endpoints (GET /Bet) are
// excluded so we don't ping the wallet on every page load.
const WALLET_AFFECTING_PATHS = ['/Bet', '/Wallet/topup', '/admin/wallet'];

api.interceptors.response.use(
  (response) => {
    try {
      const cfg     = response.config || {};
      const url     = cfg.url || '';
      const method  = (cfg.method || '').toLowerCase();
      const writes  = method === 'post' || method === 'put' || method === 'delete';
      if (writes && WALLET_AFFECTING_PATHS.some((p) => url.includes(p))) {
        // Forward the new balance when the API ships it; otherwise the
        // listener falls back to fetching fresh.
        const next = response.data?.balance ?? response.data?.newBalance ?? null;
        window.dispatchEvent(new CustomEvent('bpfl:wallet:refresh', {
          detail: next != null ? { balance: next } : {},
        }));
      }
    } catch {
      // Never let analytics-style side effects break the response chain.
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl      = originalRequest?.url || '';
    const isAuthRequest   = [...AUTH_PATHS].some((p) => requestUrl.includes(p));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      // Queue any parallel requests while refreshing
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(api(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Browser sends refresh_token cookie automatically (Path=/api/Auth)
        const refreshRes = await axios.post(
          `${API_BASE_URL}/Auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Update in-memory token + localStorage for cookie-blocked browsers
        const newToken = refreshRes.data?.accessToken;
        if (newToken) {
          _accessToken = newToken;
          localStorage.setItem('bpfl_token', newToken);
        }

        processQueue(null);
        return api(originalRequest); // retry original request
      } catch (err) {
        processQueue(err);
        // Refresh failed — clear auth state and redirect to login
        localStorage.removeItem('bpfl_user');
        localStorage.removeItem('bpfl_token');
        _accessToken = null;
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
