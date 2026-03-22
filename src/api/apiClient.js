import axios from 'axios';

const api = axios.create({
  baseURL: 'https://localhost:7031/api',
  timeout: 10000 // по желание (10 сек)
});


api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bpfl_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const hasToken = !!localStorage.getItem('bpfl_token');

    const isAuthRequest =
      requestUrl.includes('/Auth/login') ||
      requestUrl.includes('/Auth/register');


    if (
      !isAuthRequest &&
      hasToken &&
      (!error.response || error.response.status === 401)
    ) {
      console.warn('Auto logout triggered');

      localStorage.removeItem('bpfl_token');

      // избягва infinite loop
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;