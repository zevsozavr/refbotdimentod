import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminUserDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [referralType, setReferralType] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/admin/users/${id}`);
        setUser(res.data);
        setReferralType(res.data.referral_type ? String(res.data.referral_type) : '');
      } catch (e) {
        console.error('User detail error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleAction = async (action) => {
    try {
      let res;
      switch (action) {
        case 'approve':
          res = await api.post(`/admin/users/${id}/verify`, { action: 'approve' });
          break;
        case 'reject':
          res = await api.post(`/admin/users/${id}/verify`, { action: 'reject' });
          break;
        case 'ban':
          res = await api.post(`/admin/users/${id}/ban`);
          break;
        case 'unban':
          res = await api.post(`/admin/users/${id}/unban`);
          break;
        default:
          return;
      }
      setUser(res.data);
    } catch (e) {
      console.error('Action error:', e);
    }
  };

  const handleSetType = async () => {
    if (!referralType) return;
    try {
      const res = await api.post(`/admin/users/${id}/set-referral-type`, { referral_type: parseInt(referralType) });
      setUser(res.data);
    } catch (e) {
      console.error('Set type error:', e);
    }
  };

  const statusLabel = {
    pending: t('admin.users.pending'),
    verified: t('admin.users.verified'),
    rejected: t('admin.users.rejected'),
    banned: t('admin.users.banned'),
  };

  const getStatusBadge = (status) => {
    const map = { pending: 'badge-pending', verified: 'badge-verified', rejected: 'badge-rejected', banned: 'badge-banned' };
    return map[status] || '';
  };

  if (loading) {
    return (
      <div className="page">
        <AdminNav />
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <AdminNav />
        <p className="text-secondary">{t('common.error')}</p>
        <button className="btn btn-secondary mt-2" onClick={() => navigate('/admin/users')}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <AdminNav />
      <button className="btn btn-secondary btn-sm mb-4" onClick={() => navigate('/admin/users')}>
        ← {t('admin.users.title')}
      </button>

      <h1 className="page-title">{t('admin.user_detail.title')}</h1>

      <div className="card mb-4">
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.telegram_id')}</span>
          <span>{user.telegram_id}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.username')}</span>
          <span>@{user.telegram_username || t('settings.not_set')}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.casino_id')}</span>
          <span>{user.casino_id || t('settings.not_set')}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.status')}</span>
          <span className={`badge ${getStatusBadge(user.status)}`}>{statusLabel[user.status]}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.referral_type')}</span>
          <span>{user.referral_type ? `Type ${user.referral_type}` : '—'}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.language')}</span>
          <span>{user.language === 'uk' ? 'Українська' : 'Русский'}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.created')}</span>
          <span>{new Date(user.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="mb-4" style={{ fontSize: 16, fontWeight: 600 }}>{t('admin.users.actions')}</h3>
        <div className="flex flex-col gap-2">
          {(user.status === 'pending' || user.status === 'rejected') && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => handleAction('approve')}>
                {t('admin.user_detail.approve')}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleAction('reject')}>
                {t('admin.user_detail.reject')}
              </button>
            </>
          )}
          {user.status !== 'banned' ? (
            <button className="btn btn-danger btn-sm" onClick={() => handleAction('ban')}>
              {t('admin.user_detail.ban')}
            </button>
          ) : (
            <button className="btn btn-success btn-sm" onClick={() => handleAction('unban')}>
              {t('admin.user_detail.unban')}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>{t('admin.user_detail.set_type')}</h3>
        <div className="flex gap-2">
          <select className="select" value={referralType} onChange={(e) => setReferralType(e.target.value)} style={{ flex: 1 }}>
            <option value="">—</option>
            <option value="1">Type 1</option>
            <option value="2">Type 2</option>
            <option value="3">Type 3</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleSetType} disabled={!referralType}>
            {t('admin.user_detail.set_type')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetail;
