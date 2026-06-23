import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppProvider, useApp } from './contexts/AppContext';
import api from './axios';
import i18n from './i18n';
import BottomNav from './components/BottomNav';
import LanguageSelect from './pages/LanguageSelect';
import Pending from './pages/Pending';
import Banned from './pages/Banned';
import Rejected from './pages/Rejected';
import Home from './pages/Home';
import Contests from './pages/Contests';
import Referral from './pages/Referral';
import Settings from './pages/Settings';
import AdminLogin from './pages/admin/AdminLogin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminContests from './pages/admin/AdminContests';
import AdminBroadcast from './pages/admin/AdminBroadcast';
import AdminStats from './pages/admin/AdminStats';
import './styles.css';

const AppContent = () => {
  const { user, setUser, loading, setLoading, isAdmin, initKey, triggerInit } = useApp();
  const { i18n: i18nInstance } = useTranslation();
  const [initDone, setInitDone] = useState(false);
  const [devInput, setDevInput] = useState('');
  const [devError, setDevError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        if (tg) { tg.expand(); tg.ready(); }

        const savedLang = localStorage.getItem('language');
        if (!savedLang) {
          if (!cancelled) { setLoading(false); setInitDone(true); }
          return;
        }

        i18nInstance.changeLanguage(savedLang);

        const tgUser = tg?.initDataUnsafe?.user;
        const devId = localStorage.getItem('dev_telegram_id');
        const telegramId = tgUser?.id || (devId ? parseInt(devId) : null);

        if (!telegramId) {
          if (!cancelled) { setLoading(false); setInitDone(true); }
          return;
        }

        const res = await api.post('/auth/init', {
          telegram_id: telegramId,
          telegram_username: tgUser?.username || 'dev',
          language: savedLang,
        });
        if (!cancelled) setUser(res.data);
      } catch (err) {
        console.error('Init error:', err);
        if (!cancelled) setDevError(err.response?.data?.error || 'Connection failed');
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

  const hasLanguage = !!localStorage.getItem('language');
  if (!hasLanguage) return <LanguageSelect />;

  // No user yet — try dev login or show error
  if (!user) {
    const devId = localStorage.getItem('dev_telegram_id');
    if (!devId) {
      return (
        <div className="lang-select">
          <h1 className="page-title">Dev Login</h1>
          <p className="text-secondary mb-4">Enter your Telegram ID:</p>
          <input
            className="input mb-2"
            placeholder="Telegram ID"
            value={devInput}
            onChange={(e) => setDevInput(e.target.value)}
            type="number"
          />
          {devError && <p className="text-sm" style={{ color: 'var(--error)' }}>{devError}</p>}
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (devInput.trim()) {
                localStorage.setItem('dev_telegram_id', devInput.trim());
                triggerInit();
              }
            }}
            disabled={!devInput.trim()}
          >
            Submit
          </button>
        </div>
      );
    }
    // devId exists but auth failed
    return (
      <div className="lang-select">
        <h1 className="page-title">Auth Error</h1>
        <p className="text-secondary mb-4">{devError || 'Failed to authenticate. Check your Telegram ID.'}</p>
        <button className="btn btn-primary btn-block" onClick={() => { localStorage.removeItem('dev_telegram_id'); window.location.reload(); }}>
          Try Again
        </button>
      </div>
    );
  }

  if (user.status === 'banned') return <Banned />;

  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={
            user.status === 'pending' ? <Pending /> :
            user.status === 'rejected' ? <Rejected /> :
            <Home />
          } />
          <Route path="/contests" element={<Contests />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          {isAdmin && (
            <>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/contests" element={<AdminContests />} />
              <Route path="/admin/broadcast" element={<AdminBroadcast />} />
              <Route path="/admin/stats" element={<AdminStats />} />
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
