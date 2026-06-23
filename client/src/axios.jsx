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

export default api;
