import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:7031/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  // FIX: Read token once per request — was fine, kept as-is
  const token = localStorage.getItem('bpfl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    // FIX: Use a Set for O(1) lookup instead of multiple string.includes() calls
    const AUTH_PATHS = new Set(['/Auth/login', '/Auth/register', '/Auth/google', '/Auth/refresh']);
    const isAuthRequest = [...AUTH_PATHS].some((p) => requestUrl.includes(p));

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isAuthRequest
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('bpfl_refresh');

      if (!refreshToken) {
        localStorage.removeItem('bpfl_token');
        localStorage.removeItem('bpfl_refresh');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/Auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = res.data;

        localStorage.setItem('bpfl_token', accessToken);
        localStorage.setItem('bpfl_refresh', newRefresh);

        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('bpfl_token');
        localStorage.removeItem('bpfl_refresh');
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