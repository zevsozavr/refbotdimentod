import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../axios';

const AdminStats = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">{t('admin.stats.title')}</h1>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page">
        <h1 className="page-title">{t('admin.stats.title')}</h1>
        <p className="text-secondary">{t('common.error')}</p>
        <button className="btn btn-secondary mt-2" onClick={fetch}>{t('common.retry')}</button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('admin.stats.title')}</h1>
        <button className="btn btn-secondary btn-sm" onClick={fetch}>{t('admin.stats.refresh')}</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">{t('admin.stats.total')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">{t('admin.stats.pending')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.verified}</div>
          <div className="stat-label">{t('admin.stats.verified')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.banned}</div>
          <div className="stat-label">{t('admin.stats.banned')}</div>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="admin-section-title">{t('admin.stats.by_type')}</h3>
        {[1, 2, 3].map((type) => {
          const key = `type${type}`;
          return (
            <div key={type} className="user-row">
              <span>{t('admin.stats.type')} {type}</span>
              <span className="badge badge-type">{stats.usersByType[key] || 0}</span>
            </div>
          );
        })}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.activeContests}</div>
          <div className="stat-label">{t('admin.stats.active_contests')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.winnersPicked}</div>
          <div className="stat-label">{t('admin.stats.winners_picked')}</div>
        </div>
        <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
          <div className="stat-value">{stats.broadcastsSent}</div>
          <div className="stat-label">{t('admin.stats.broadcasts')}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
