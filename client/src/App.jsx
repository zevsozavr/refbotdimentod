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
  const { user, setUser, loading, setLoading, isAdmin } = useApp();
  const { i18n: i18nInstance } = useTranslation();
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        if (tg) {
          tg.expand();
          tg.ready();
        }

        const savedLang = localStorage.getItem('language');
        if (!savedLang) {
          setLoading(false);
          setInitDone(true);
          return;
        }

        i18nInstance.changeLanguage(savedLang);

        const tgUser = tg?.initDataUnsafe?.user;
        if (!tgUser?.id) {
          setLoading(false);
          setInitDone(true);
          return;
        }

        const res = await api.post('/auth/init', {
          telegram_id: tgUser.id,
          telegram_username: tgUser.username || '',
          language: savedLang,
        });
        setUser(res.data);
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
        setInitDone(true);
      }
    };
    init();
  }, [setUser, setLoading]);

  if (loading || !initDone) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const hasLanguage = !!localStorage.getItem('language');
  if (!hasLanguage) return <LanguageSelect />;

  if (!user) {
    return (
      <div className="status-screen">
        <div className="status-icon">⚠️</div>
        <h1 className="page-title">Connection Error</h1>
        <p className="text-secondary">Failed to load user data. Check console for details.</p>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Retry
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
