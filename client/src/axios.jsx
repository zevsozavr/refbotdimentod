import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData || '';
  config.headers['x-telegram-init-data'] = initData;
  const sessionToken = localStorage.getItem('session_token');
  if (sessionToken) {
    config.headers['x-session-token'] = sessionToken;
  }
  return config;
});

export const adminApi = axios.create({
  baseURL: '/api',
});

adminApi.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData || '';
  const adminToken = sessionStorage.getItem('adminToken') || '';
  const sessionToken = localStorage.getItem('session_token') || '';
  config.headers['x-telegram-init-data'] = initData;
  config.headers['x-admin-token'] = adminToken;
  if (sessionToken) {
    config.headers['x-session-token'] = sessionToken;
  }
  return config;
});

export default api;
