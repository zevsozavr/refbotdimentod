import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminStats = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/stats');
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
        <AdminNav />
        <h1 className="page-title">{t('admin.stats.title')}</h1>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page">
        <AdminNav />
        <h1 className="page-title">{t('admin.stats.title')}</h1>
        <p className="text-secondary">{t('common.error')}</p>
        <button className="btn btn-secondary mt-2" onClick={fetch}>{t('common.retry')}</button>
      </div>
    );
  }

  return (
    <div className="page">
      <AdminNav />
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('admin.stats.title')}</h1>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} onClick={fetch}>{t('admin.stats.refresh')}</button>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.totalUsers}</div>
          <div className="admin-stat-label">{t('admin.stats.total')}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.pending}</div>
          <div className="admin-stat-label">{t('admin.stats.pending')}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.verified}</div>
          <div className="admin-stat-label">{t('admin.stats.verified')}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.banned}</div>
          <div className="admin-stat-label">{t('admin.stats.banned')}</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-section-title" style={{ fontSize: 13, marginBottom: 8 }}>TopMatch</div>
          <div className="admin-stat-label">Рівень 1: {stats.levelsByCasino?.topmatch?.level1 || 0}</div>
          <div className="admin-stat-label">Рівень 2: {stats.levelsByCasino?.topmatch?.level2 || 0}</div>
          <div className="admin-stat-label">Рівень 3: {stats.levelsByCasino?.topmatch?.level3 || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-section-title" style={{ fontSize: 13, marginBottom: 8 }}>TonPlay</div>
          <div className="admin-stat-label">Рівень 1: {stats.levelsByCasino?.tonplay?.level1 || 0}</div>
          <div className="admin-stat-label">Рівень 2: {stats.levelsByCasino?.tonplay?.level2 || 0}</div>
          <div className="admin-stat-label">Рівень 3: {stats.levelsByCasino?.tonplay?.level3 || 0}</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.activeContests}</div>
          <div className="admin-stat-label">{t('admin.stats.active_contests')}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.winnersPicked}</div>
          <div className="admin-stat-label">{t('admin.stats.winners_picked')}</div>
        </div>
        <div className="admin-stat-card" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-stat-number">{stats.broadcastsSent}</div>
          <div className="admin-stat-label">{t('admin.stats.broadcasts')}</div>
        </div>
        <div className="admin-stat-card" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-stat-number">{stats.pendingChanges || 0}</div>
          <div className="admin-stat-label">Pending Changes</div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;