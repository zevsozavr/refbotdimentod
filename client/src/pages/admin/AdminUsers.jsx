import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../axios';

const AdminUsers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = { page, limit: 20 };
        if (filterStatus) params.status = filterStatus;
        if (filterType) params.referral_type = filterType;
        const res = await api.get('/admin/users', { params });
        setUsers(res.data.users);
        setTotalPages(res.data.pagination.totalPages);
      } catch (e) {
        console.error('Users fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page, filterStatus, filterType]);

  const getStatusBadge = (status) => {
    const map = { pending: 'badge-pending', verified: 'badge-verified', rejected: 'badge-rejected', banned: 'badge-banned' };
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
      <h1 className="page-title">{t('admin.users.title')}</h1>

      <div className="filter-bar">
        <select className="select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">{t('admin.users.filter_status')}: {t('admin.users.all')}</option>
          {Object.entries(statusLabel).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select className="select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">{t('admin.users.filter_type')}: {t('admin.users.all')}</option>
          <option value="1">Type 1</option>
          <option value="2">Type 2</option>
          <option value="3">Type 3</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <div className="card">
            {users.map((u) => (
              <div key={u.id} className="user-row" onClick={() => navigate(`/admin/users/${u.id}`)}>
                <div className="user-row-info">
                  <span className="user-row-name">@{u.telegram_username || `ID: ${u.telegram_id}`}</span>
                  <div className="user-row-meta">
                    <span className={`badge ${getStatusBadge(u.status)}`}>{statusLabel[u.status]}</span>
                    {u.referral_type && <span className="badge badge-type">Type {u.referral_type}</span>}
                  </div>
                </div>
                <span className="text-sm text-secondary">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ←
              </button>
              <span className="text-sm">{page} / {totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUsers;
