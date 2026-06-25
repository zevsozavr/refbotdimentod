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

        // Try Telegram WebApp immediately, then poll briefly (up to 1s)
        let telegramUser = tryGetTelegramUser();
        for (let i = 0; i < 5 && !telegramUser?.id; i++) {
          await sleep(200);
          if (cancelled) return;
          telegramUser = tryGetTelegramUser();
        }

        // URL fallback
        if (!telegramUser?.id) {
          if (cancelled) return;
          telegramUser = parseUrlForUser();
        }

        // Last resort: stored telegram_id from previous session
        if (!telegramUser?.id) {
          if (cancelled) return;
          const storedId = localStorage.getItem('telegram_id');
          if (storedId) {
            telegramUser = { id: parseInt(storedId, 10) };
          }
        }

        if (!telegramUser?.id) {
          if (cancelled) return;
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
        if (!cancelled) {
          console.error('Init error:', err);
          setInitError(err.response?.data?.error || 'Connection failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitDone(true);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [initKey]);

  if (loading || !initDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--surface-dim)] to-[var(--surface)]">
        <div className="space-y-6 text-center">
          <div className="flex items-center justify-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
              <span className="emoji-icon text-2xl">🎰</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[var(--on-surface)]">Casino Referral Bot</h2>
              <p className="text-[var(--on-surface-variant)]">Initializing...</p>
            </div>
          </div>
          
          <div className="w-full max-w-md">
            <div className="space-y-3">
              <div className="h-4 bg-[var(--surface)]/30 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-[var(--surface)]/30 rounded w-[70%] animate-pulse"></div>
              <div className="flex space-x-3">
                <div className="h-4 bg-[var(--surface)]/30 rounded w-[40%] animate-pulse"></div>
                <div className="h-4 bg-[var(--surface)]/30 rounded w-[60%] animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
        <div className="space-y-6 text-center">
          <div className="flex items-center justify-center space-x-4">
            <div className="w-14 h-14 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
              <span className="emoji-icon text-3xl">🎰</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[var(--on-surface)]">Initializing...</h2>
              {initError && (
                <p className="text-[var(--error)] mb-2">{initError}</p>
              )}
              <p className="text-[var(--on-surface-variant)]">Please ensure you're accessing this app through Telegram</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user.status === 'banned') return <Banned />;
  if (user.status === 'pending' && !isAdmin) return <Pending />;
  if (user.status === 'rejected' && !isAdmin) return <Rejected />;

  return (
    <HashRouter>
      <div className={`app-container ${lightweightAnimations ? 'lightweight' : ''} min-h-screen bg-[var(--surface)]`}>
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