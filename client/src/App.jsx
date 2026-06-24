import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppProvider, useApp } from './contexts/AppContext';
import api from './axios';
import i18n from './i18n';
import BottomNav from './components/BottomNav';
import Banned from './pages/Banned';
import Pending from './pages/Pending';
import Rejected from './pages/Rejected';
import Home from './pages/Home';
import Contests from './pages/Contests';
import Announces from './pages/Announces';
import Casino from './pages/Casino';
import Settings from './pages/Settings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminContests from './pages/admin/AdminContests';
import AdminBroadcast from './pages/admin/AdminBroadcast';
import AdminStats from './pages/admin/AdminStats';
import AdminPendingChanges from './pages/admin/AdminPendingChanges';
import AdminStreams from './pages/admin/AdminStreams';
import AdminAnnounces from './pages/admin/AdminAnnounces';
import './styles.css';

const AppContent = () => {
  const { user, setUser, loading, setLoading, isAdmin, initKey, lightweightAnimations } = useApp();
  const { i18n: i18nInstance } = useTranslation();
  const [initDone, setInitDone] = useState(false);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    const handleRipple = (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      const rect = btn.getBoundingClientRect();
      ripple.style.left = `${e.clientX - rect.left}px`;
      ripple.style.top = `${e.clientY - rect.top}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };
    document.addEventListener('click', handleRipple);
    return () => document.removeEventListener('click', handleRipple);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const tryGetTelegramUser = () => {
      // Try Telegram WebApp
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id) return tg.initDataUnsafe.user;
      return null;
    };

    const parseUrlForUser = () => {
      try {
        const rawData =
          new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tgWebAppData') ||
          new URLSearchParams(window.location.search).get('tgWebAppData');
        if (rawData) {
          const dataParams = new URLSearchParams(rawData);
          const userStr = dataParams.get('user');
          if (userStr) return JSON.parse(userStr);
        }
      } catch (e) { /* ignore */ }
      return null;
    };

    const run = async () => {
      try {
        // Initialize Telegram WebApp
        const tg = window.Telegram?.WebApp;
        if (tg) { tg.expand(); tg.ready(); }

        // Try Telegram WebApp immediately
        let telegramUser = tryGetTelegramUser();

        // Poll for Telegram WebApp (up to 3s) — fixes refresh race condition
        for (let i = 0; i < 15 && !telegramUser?.id; i++) {
          await sleep(200);
          telegramUser = tryGetTelegramUser();
        }

        // URL fallback
        if (!telegramUser?.id) {
          telegramUser = parseUrlForUser();
        }

        // Last resort: stored telegram_id from previous session
        if (!telegramUser?.id) {
          const storedId = localStorage.getItem('telegram_id');
          if (storedId) {
            telegramUser = { id: parseInt(storedId, 10) };
          }
        }

        if (!telegramUser?.id) {
          setInitError('This app must be opened from Telegram');
          setLoading(false);
          setInitDone(true);
          return;
        }

        const telegramId = telegramUser.id;
        const savedLang = localStorage.getItem('language') || 'uk';

        const res = await api.post('/auth/init', {
          telegram_id: telegramId,
          telegram_username: telegramUser?.username || undefined,
          language: savedLang,
        });
        if (!cancelled) {
          setUser(res.data);
          if (res.data.token) {
            localStorage.setItem('session_token', res.data.token);
          }
          localStorage.setItem('telegram_id', String(telegramId));
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
  if (user.status === 'pending' && !isAdmin) return <Pending />;
  if (user.status === 'rejected' && !isAdmin) return <Rejected />;

  return (
    <HashRouter>
      <div className={`app-container ${lightweightAnimations ? 'lightweight' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/casino/:casinoId" element={<Casino />} />
          <Route path="/contests" element={<Contests />} />
          <Route path="/announces" element={<Announces />} />
          <Route path="/settings" element={<Settings />} />
          {isAdmin && (
            <>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/contests" element={<AdminContests />} />
              <Route path="/admin/broadcast" element={<AdminBroadcast />} />
              <Route path="/admin/stats" element={<AdminStats />} />
              <Route path="/admin/pending-changes" element={<AdminPendingChanges />} />
              <Route path="/admin/streams" element={<AdminStreams />} />
              <Route path="/admin/announces" element={<AdminAnnounces />} />
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
