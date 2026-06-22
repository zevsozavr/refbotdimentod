import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData || '';
  config.headers['x-telegram-init-data'] = initData;
  const adminToken = sessionStorage.getItem('adminToken');
  if (adminToken) {
    config.headers['x-admin-token'] = adminToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAdminRoute = error.config.url?.startsWith('/admin');
      if (isAdminRoute) {
        sessionStorage.removeItem('adminToken');
        window.location.hash = '#/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
