import React, { useState, useEffect, useCallback } from 'react';
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

  const fetch = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Stats fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
        <h1 className="page-title metallic-text" style={{ marginBottom: 0 }}>{t('admin.stats.title')}</h1>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} onClick={fetch}>{t('admin.stats.refresh')}</button>
      </div>

      <div className="admin-stat-grid">
        <div className="glass-panel admin-stat-card total" style={{ padding: '16px 20px' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, background: 'linear-gradient(135deg, #c3c6d3, #e9c349)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{totalCount}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.total')}</div>
        </div>
        <div className="glass-panel admin-stat-card pending" style={{ padding: '16px 20px' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: '#e9c349' }}>{pendingCount}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.pending')}</div>
        </div>
        <div className="glass-panel admin-stat-card verified" style={{ padding: '16px 20px' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: '#4edea3' }}>{verifiedCount}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.verified')}</div>
        </div>
        <div className="glass-panel admin-stat-card banned" style={{ padding: '16px 20px' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: '#ef4444' }}>{bannedCount}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.banned')}</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--primary)' }}>TopMatch</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Рівень 1: {stats.levelsByCasino?.topmatch?.level1 || 0}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Рівень 2: {stats.levelsByCasino?.topmatch?.level2 || 0}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Рівень 3: {stats.levelsByCasino?.topmatch?.level3 || 0}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--primary)' }}>Betline</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Рівень 1: {stats.levelsByCasino?.tonplay?.level1 || 0}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Рівень 2: {stats.levelsByCasino?.tonplay?.level2 || 0}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Рівень 3: {stats.levelsByCasino?.tonplay?.level3 || 0}</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="glass-panel admin-stat-card contests" style={{ padding: '16px 20px' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: '#e9c349' }}>{activeContestsCount}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.active_contests')}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{stats.winnersPicked}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.winners_picked')}</div>
        </div>
        <div className="glass-panel admin-stat-card broadcasts" style={{ padding: '16px 20px', gridColumn: '1 / -1' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: '#4edea3' }}>{broadcastsCount}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>{t('admin.stats.broadcasts')}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', gridColumn: '1 / -1' }}>
          <div className="admin-stat-number" style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{stats.pendingChanges || 0}</div>
          <div className="admin-stat-label" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>Pending Changes</div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
