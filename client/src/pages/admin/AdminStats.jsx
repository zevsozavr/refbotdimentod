import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';
import useStaggeredEntrance from '../../hooks/useStaggeredEntrance';
import useCountUp from '../../hooks/useCountUp';

const AdminStats = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useStaggeredEntrance('.admin-stat-card', 60);

  const totalCount = useCountUp(stats?.totalUsers || 0);
  const pendingCount = useCountUp(stats?.pending || 0);
  const verifiedCount = useCountUp(stats?.verified || 0);
  const bannedCount = useCountUp(stats?.banned || 0);
  const activeContestsCount = useCountUp(stats?.activeContests || 0);
  const broadcastsCount = useCountUp(stats?.broadcastsSent || 0);

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
        <div className="admin-stat-card total">
          <div className="admin-stat-number">{totalCount}</div>
          <div className="admin-stat-label">{t('admin.stats.total')}</div>
        </div>
        <div className="admin-stat-card pending">
          <div className="admin-stat-number">{pendingCount}</div>
          <div className="admin-stat-label">{t('admin.stats.pending')}</div>
        </div>
        <div className="admin-stat-card verified">
          <div className="admin-stat-number">{verifiedCount}</div>
          <div className="admin-stat-label">{t('admin.stats.verified')}</div>
        </div>
        <div className="admin-stat-card banned">
          <div className="admin-stat-number">{bannedCount}</div>
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
        <div className="admin-stat-card contests">
          <div className="admin-stat-number">{activeContestsCount}</div>
          <div className="admin-stat-label">{t('admin.stats.active_contests')}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{stats.winnersPicked}</div>
          <div className="admin-stat-label">{t('admin.stats.winners_picked')}</div>
        </div>
        <div className="admin-stat-card broadcasts" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-stat-number">{broadcastsCount}</div>
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