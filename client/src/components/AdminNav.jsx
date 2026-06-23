import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AdminNav = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { path: '/admin/stats', label: t('admin.stats.title') },
    { path: '/admin/users', label: t('admin.users.title') },
    { path: '/admin/contests', label: t('admin.contests.title') },
    { path: '/admin/broadcast', label: t('admin.broadcast.title') },
  ];

  return (
    <div className="admin-nav">
      {items.map((item) => (
        <button
          key={item.path}
          className={`admin-nav-item ${location.pathname === item.path || location.pathname.startsWith(item.path + '/') ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default AdminNav;