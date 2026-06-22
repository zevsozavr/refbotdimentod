import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';

const BottomNav = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useApp();

  if (!user || user.status !== 'verified') return null;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const items = [
    { path: '/', icon: '🏠', label: t('nav.home') },
    { path: '/contests', icon: '🏆', label: t('nav.contests') },
    { path: '/referral', icon: '🔗', label: t('nav.referral') },
    { path: '/settings', icon: '⚙️', label: t('nav.settings') },
  ];

  if (isAdmin) {
    const adminPath = location.pathname;
    const isOnAdmin = adminPath.startsWith('/admin');
    items.push({ path: isOnAdmin ? adminPath : '/admin/stats', icon: '📊', label: t('nav.admin') });
  }

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
