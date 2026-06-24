import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';

const NAV_ICONS = {
  '/': <span className="emoji-icon">🏠</span>,
  '/announces': <span className="emoji-icon">📢</span>,
  '/settings': <span className="emoji-icon">⚙️</span>,
};

const BottomNav = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useApp();

  if (!user) return null;

  const mainPaths = ['/', '/announces', '/settings'];
  const isActive = (path) => location.pathname === path;

  const adminPath = location.pathname;
  const isOnAdmin = adminPath.startsWith('/admin');

  return (
    <nav className="bottom-nav">
      {mainPaths.map((path) => (
        <button
          key={path}
          className={`nav-item ${isActive(path) ? 'active' : ''}`}
          onClick={() => navigate(path)}
        >
          <span className="nav-icon">{NAV_ICONS[path]}</span>
          <span>{t(`nav.${path === '/' ? 'home' : path.replace('/', '')}`)}</span>
        </button>
      ))}
      {isAdmin && (
        <button
          className={`nav-item ${isOnAdmin ? 'active' : ''}`}
          onClick={() => navigate(isOnAdmin ? adminPath : '/admin/stats')}
        >
          <span className="nav-icon"><span className="emoji-icon">🛡️</span></span>
          <span>{t('nav.admin')}</span>
        </button>
      )}
    </nav>
  );
};

export default BottomNav;
