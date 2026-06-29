import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAdminCounts from '../hooks/useAdminCounts';

const AdminNav = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useAdminCounts();

  const items = [
    { path: '/admin/stats', label: t('admin.stats.title'), icon: '📊' },
    { path: '/admin/users', label: t('admin.users.title'), icon: '👤', badge: counts.pendingUsers },
    { path: '/admin/contests', label: t('admin.contests.title'), icon: '🏆' },
    { path: '/admin/winners', label: t('admin.winners.title'), icon: '🥇' },
    { path: '/admin/deposits', label: t('admin.deposits.title'), icon: '💰' },
    { path: '/admin/pending-changes', label: 'Pending', icon: '⏳', badge: counts.pendingChanges },
    { path: '/admin/broadcast', label: t('admin.broadcast.title'), icon: '📢' },
    { path: '/admin/streams', label: t('admin.streams.title'), icon: '📺' },
    { path: '/admin/announces', label: t('admin.announces.title'), icon: '📣' },
    { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="admin-nav">
      {items.map((item) => {
        const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        return (
          <button
            key={item.path}
            className={`admin-nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="emoji-icon admin-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge > 0 && <span className="admin-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default AdminNav;
