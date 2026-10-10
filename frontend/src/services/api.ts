import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.endsWith('/api')
    ? import.meta.env.VITE_API_URL
    : `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
    if (error.response && error.response.status === 401) {
      // Clear token if invalid or expired
      const isAuthRequest = error.config.url.includes('/auth/login');
      if (!isAuthRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
