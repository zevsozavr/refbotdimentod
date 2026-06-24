import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';
import useStaggeredEntrance from '../../hooks/useStaggeredEntrance';

const AdminUsers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);

  useStaggeredEntrance('.user-row', 40);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [fetchError, setFetchError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      const res = await adminApi.get('/admin/users', { params });
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error('Users fetch error:', e);
      setFetchError(e.response?.data?.error || e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { fetch(); }, [fetch]);

  const getStatusBadge = (status) => {
    const map = { pending: 'pending', verified: 'verified', rejected: 'rejected', banned: 'banned' };
    return map[status] || '';
  };

  const statusLabel = {
    pending: t('admin.users.pending'),
    verified: t('admin.users.verified'),
    rejected: t('admin.users.rejected'),
    banned: t('admin.users.banned'),
  };

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title">{t('admin.users.title')}</h1>

      <div className="filter-bar">
        <select className="select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">{t('admin.users.filter_status')}: {t('admin.users.all')}</option>
          {Object.entries(statusLabel).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {fetchError && (
        <div className="card" style={{ background: 'var(--error)', color: 'white', marginBottom: 16, padding: 12, borderRadius: 12 }}>
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <div>
            {users.map((u) => (
              <div key={u.id} className="user-row" onClick={() => navigate(`/admin/users/${u.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>@{u.telegram_username || `ID: ${u.telegram_id}`}</div>
                  <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>
                    TM: {u.casino_id_topmatch || '—'} | TP: {u.casino_id_tonplay || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`status-badge ${getStatusBadge(u.status)}`}>{statusLabel[u.status]}</span>
                    <span className={`level-badge`}>
                      Рівень {Math.max(u.level_topmatch || 0, u.level_tonplay || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <span className="emoji-icon">◀</span>
              </button>
              <span className="text-sm">{page} / {totalPages}</span>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <span className="emoji-icon">▶</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUsers;