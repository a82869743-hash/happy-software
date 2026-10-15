import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gms_token');
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — handle 401 (auto logout)
let isRedirecting = false;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const reqUrl = error.config?.url || '';
    // Don't redirect on login attempts — let the Login page handle its own errors
    const isLoginRequest = reqUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest && !isRedirecting) {
      console.warn('401 Unauthorized - clearing session');
      isRedirecting = true;
      localStorage.removeItem('gms_token');
      localStorage.removeItem('gms_user');
      localStorage.removeItem('gms_login_time');
      // Debounce: only redirect once, prevent cascade from parallel 401s
      setTimeout(() => {
        isRedirecting = false;
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }, 100);
    }
    return Promise.reject(error);
  }
);

export default api;
