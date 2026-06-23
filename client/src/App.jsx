import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppProvider, useApp } from './contexts/AppContext';
import api from './axios';
import i18n from './i18n';
import BottomNav from './components/BottomNav';
import Banned from './pages/Banned';
import Home from './pages/Home';
import Contests from './pages/Contests';
import Casino from './pages/Casino';
import Settings from './pages/Settings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminContests from './pages/admin/AdminContests';
import AdminBroadcast from './pages/admin/AdminBroadcast';
import AdminStats from './pages/admin/AdminStats';
import AdminPendingChanges from './pages/admin/AdminPendingChanges';
import './styles.css';

const AppContent = () => {
  const { user, setUser, loading, setLoading, isAdmin, initKey } = useApp();
  const { i18n: i18nInstance } = useTranslation();
  const [initDone, setInitDone] = useState(false);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        if (tg) { tg.expand(); tg.ready(); }

        // Try multiple sources for Telegram user data
        let telegramUser = tg?.initDataUnsafe?.user;

        // Fallback: parse tgWebAppData from URL hash directly
        if (!telegramUser?.id) {
          try {
            const hashStr = window.location.hash.replace(/^#/, '');
            const hashParams = new URLSearchParams(hashStr);
            const rawData = hashParams.get('tgWebAppData');
            if (rawData) {
              const dataParams = new URLSearchParams(rawData);
              const userStr = dataParams.get('user');
              if (userStr) telegramUser = JSON.parse(userStr);
            }
          } catch (e) { /* ignore */ }
        }

        // Fallback: query param
        if (!telegramUser?.id) {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const rawData = urlParams.get('tgWebAppData');
            if (rawData) {
              const dataParams = new URLSearchParams(rawData);
              const userStr = dataParams.get('user');
              if (userStr) telegramUser = JSON.parse(userStr);
            }
          } catch (e) { /* ignore */ }
        }

        const telegramId = telegramUser?.id || 1;

        const res = await api.post('/auth/init', {
          telegram_id: telegramId,
          telegram_username: telegramUser?.username || 'dev',
          language: 'uk',
        });
        if (!cancelled) {
          setUser(res.data);
          if (res.data.token) {
            localStorage.setItem('session_token', res.data.token);
          }
          const userLang = res.data.language || 'uk';
          localStorage.setItem('language', userLang);
          i18nInstance.changeLanguage(userLang);
        }
      } catch (err) {
        console.error('Init error:', err);
        if (!cancelled) setInitError(err.response?.data?.error || 'Connection failed');
      } finally {
        if (!cancelled) { setLoading(false); setInitDone(true); }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [initKey]);

  if (loading || !initDone) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="status-screen">
        <div className="spinner" />
        {initError && <p className="text-secondary mt-4">{initError}</p>}
      </div>
    );
  }

  if (user.status === 'banned') return <Banned />;

  return (
    <HashRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/casino/:casinoId" element={<Casino />} />
          <Route path="/contests" element={<Contests />} />
          <Route path="/settings" element={<Settings />} />
          {isAdmin && (
            <>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/contests" element={<AdminContests />} />
              <Route path="/admin/broadcast" element={<AdminBroadcast />} />
              <Route path="/admin/stats" element={<AdminStats />} />
              <Route path="/admin/pending-changes" element={<AdminPendingChanges />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <BottomNav />
      </div>
    </HashRouter>
  );
};

const App = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
