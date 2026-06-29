import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';
import Chevron from '../../components/Chevron';
import useStaggeredEntrance from '../../hooks/useStaggeredEntrance';

const AdminUsers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);

  useStaggeredEntrance('.user-row', 40);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await adminApi.get('/admin/users', { params });
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (e) {
      console.error('Users fetch error:', e);
      setFetchError(e.response?.data?.error || e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, debouncedSearch]);

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
      <h1 className="page-title metallic-text">{t('admin.users.title')}</h1>

      <div className="admin-search">
        <span className="emoji-icon admin-search-icon">🔍</span>
        <input
          className="glass-input admin-search-input"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.users.search_placeholder')}
        />
        {search && (
          <button className="admin-search-clear" onClick={() => setSearch('')} aria-label="clear">
            <span className="emoji-icon">✕</span>
          </button>
        )}
      </div>

      <div className="filter-bar">
        <select className="glass-input" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={{ width: '100%' }}>
          <option value="">{t('admin.users.filter_status')}: {t('admin.users.all')}</option>
          {Object.entries(statusLabel).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {!loading && !fetchError && (
        <div className="admin-result-count">{t('admin.users.found', { count: total })}</div>
      )}

      {fetchError && (
        <div className="glass-panel" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', marginBottom: 16, padding: 12, borderRadius: 12, color: '#ef4444' }}>
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {users.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon"><span className="emoji-icon">🔍</span></div>
              <p className="text-secondary">{t('admin.users.no_results')}</p>
            </div>
          ) : (
          <div>
            {users.map((u) => (
              <div key={u.id} className="glass-panel user-row" style={{ padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }} onClick={() => navigate(`/admin/users/${u.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)' }}>@{u.telegram_username || `ID: ${u.telegram_id}`}</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                    TM: {u.casino_id_topmatch || '—'} | BL: {u.casino_id_betline || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`status-badge ${getStatusBadge(u.status)}`}>{statusLabel[u.status]}</span>
                    <span className="level-badge" style={{ background: 'rgba(195,198,211,0.1)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 8, fontSize: 12 }}>
                      Рівень {Math.max(u.level_topmatch || 0, u.level_betline || 0)}
                    </span>
                  </div>
                </div>
                <div style={{ color: 'var(--on-surface-variant)', fontSize: 16 }}>→</div>
              </div>
            ))}
          </div>
          )}

          {totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20, paddingBottom: 80 }}>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <Chevron dir="left" />
              </button>
              <span style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>{page} / {totalPages}</span>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <Chevron dir="right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUsers;
