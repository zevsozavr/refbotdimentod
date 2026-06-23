import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminUserDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topMatchLevel, setTopMatchLevel] = useState('');
  const [tonPlayLevel, setTonPlayLevel] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminApi.get(`/admin/users/${id}`);
        setUser(res.data);
        setTopMatchLevel(res.data.level_topmatch ? String(res.data.level_topmatch) : '');
        setTonPlayLevel(res.data.level_tonplay ? String(res.data.level_tonplay) : '');
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
          res = await adminApi.post(`/admin/users/${id}/verify`, { action: 'approve' });
          break;
        case 'reject':
          res = await adminApi.post(`/admin/users/${id}/verify`, { action: 'reject' });
          break;
        case 'ban':
          res = await adminApi.post(`/admin/users/${id}/ban`);
          break;
        case 'unban':
          res = await adminApi.post(`/admin/users/${id}/unban`);
          break;
        default:
          return;
      }
      setUser(res.data);
    } catch (e) {
      console.error('Action error:', e);
    }
  };

  const setLevel = async (casino, level) => {
    if (!level) return;
    try {
      await adminApi.post(`/admin/users/${id}/set-level`, { casino, level: parseInt(level) });
      const res = await adminApi.get(`/admin/users/${id}`);
      setUser(res.data);
      setTopMatchLevel(res.data.level_topmatch ? String(res.data.level_topmatch) : '');
      setTonPlayLevel(res.data.level_tonplay ? String(res.data.level_tonplay) : '');
    } catch (e) {
      console.error('Set level error:', e);
    }
  };

  const statusLabel = {
    pending: t('admin.users.pending'),
    verified: t('admin.users.verified'),
    rejected: t('admin.users.rejected'),
    banned: t('admin.users.banned'),
  };

  const getStatusBadge = (status) => {
    const map = { pending: 'pending', verified: 'verified', rejected: 'rejected', banned: 'banned' };
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
          <span className="form-label">TopMatch ID</span>
          <span>{user.casino_id_topmatch || t('settings.not_set')}</span>
        </div>
        <div className="form-group">
          <span className="form-label">TonPlay ID</span>
          <span>{user.casino_id_tonplay || t('settings.not_set')}</span>
        </div>
        <div className="form-group">
          <span className="form-label">{t('admin.user_detail.status')}</span>
          <span className={`status-badge ${getStatusBadge(user.status)}`}>{statusLabel[user.status]}</span>
        </div>
        <div className="form-group">
          <span className="form-label">TopMatch {t('admin.user_detail.referral_type')}</span>
          <span>{user.level_topmatch || '—'}</span>
        </div>
        <div className="form-group">
          <span className="form-label">TonPlay {t('admin.user_detail.referral_type')}</span>
          <span>{user.level_tonplay || '—'}</span>
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

      <div className="card mb-4">
        <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>TopMatch {t('admin.user_detail.set_type')}</h3>
        <p className="text-sm text-secondary mb-2">{t('admin.user_detail.current')}: {user.level_topmatch || '—'}</p>
        <div className="flex gap-2">
          <select className="select" value={topMatchLevel} onChange={(e) => setTopMatchLevel(e.target.value)} style={{ flex: 1 }}>
            <option value="">— {t('admin.users.no_level')} —</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setLevel('topmatch', topMatchLevel)} disabled={!topMatchLevel}>
            {t('admin.user_detail.set_type')}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>TonPlay {t('admin.user_detail.set_type')}</h3>
        <p className="text-sm text-secondary mb-2">{t('admin.user_detail.current')}: {user.level_tonplay || '—'}</p>
        <div className="flex gap-2">
          <select className="select" value={tonPlayLevel} onChange={(e) => setTonPlayLevel(e.target.value)} style={{ flex: 1 }}>
            <option value="">— {t('admin.users.no_level')} —</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setLevel('tonplay', tonPlayLevel)} disabled={!tonPlayLevel}>
            {t('admin.user_detail.set_type')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetail;
