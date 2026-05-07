import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:7031/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send HttpOnly cookies automatically on every request
});

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

api.interceptors.response.use(
  (response) => response,
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
