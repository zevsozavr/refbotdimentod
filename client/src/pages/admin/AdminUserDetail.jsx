import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';
import { invalidateAdminCounts } from '../../hooks/useAdminCounts';

const CopyField = ({ label, value, mono }) => {
  const [copied, setCopied] = useState(false);
  const empty = !value || value === '—';
  const handleCopy = async () => {
    if (empty) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* clipboard unavailable */ }
  };
  return (
    <div className="detail-field">
      <span className="form-label">{label}</span>
      <button
        type="button"
        className={`detail-value ${empty ? 'is-empty' : 'is-copyable'} ${mono ? 'is-mono' : ''}`}
        onClick={handleCopy}
        disabled={empty}
        title={empty ? '' : 'Copy'}
      >
        <span className="detail-value-text">{value}</span>
        {!empty && <span className="emoji-icon detail-copy-icon">{copied ? '✓' : '⧉'}</span>}
      </button>
    </div>
  );
};

const AdminUserDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topMatchLevel, setTopMatchLevel] = useState('');
  const [betlineLevel, setBetlineLevel] = useState('');
  const [levelError, setLevelError] = useState('');
  const [confirmBan, setConfirmBan] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminApi.get(`/admin/users/${id}`);
        setUser(res.data);
        setTopMatchLevel(res.data.level_topmatch ? String(res.data.level_topmatch) : '');
        setBetlineLevel(res.data.level_tonplay ? String(res.data.level_tonplay) : '');
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
      invalidateAdminCounts();
    } catch (e) {
      console.error('Action error:', e);
    }
  };

  const setLevel = async (casino, level) => {
    if (!level) return;
    setLevelError('');
    try {
      await adminApi.post(`/admin/users/${id}/set-level`, { casino, level: parseInt(level) });
      const res = await adminApi.get(`/admin/users/${id}`);
      setUser(res.data);
      setTopMatchLevel(res.data.level_topmatch ? String(res.data.level_topmatch) : '');
      setBetlineLevel(res.data.level_tonplay ? String(res.data.level_tonplay) : '');
    } catch (e) {
      const msg = e.response?.data?.errors?.[0]?.message || e.response?.data?.error || 'Failed to set level';
      setLevelError(msg);
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
        <span className="emoji-icon">◀</span> {t('admin.users.title')}
      </button>

      <div className="detail-hero glass-panel mb-4">
        <div className="detail-hero-main">
          <div className="detail-hero-name">@{user.telegram_username || `ID ${user.telegram_id}`}</div>
          <span className={`status-badge ${getStatusBadge(user.status)}`}>{statusLabel[user.status]}</span>
        </div>
        {user.telegram_username && (
          <a
            className="btn btn-secondary btn-sm detail-tg-link"
            href={`https://t.me/${user.telegram_username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="emoji-icon">✈</span> Telegram
          </a>
        )}
      </div>

      <div className="glass-panel mb-4">
        <CopyField label={t('admin.user_detail.telegram_id')} value={user.telegram_id} mono />
        <CopyField label={t('admin.user_detail.username')} value={user.telegram_username ? `@${user.telegram_username}` : '—'} />
        <CopyField label="TopMatch ID" value={user.casino_id_topmatch || '—'} mono />
        <CopyField label="Betline ID" value={user.casino_id_tonplay || '—'} mono />
        <div className="detail-field">
          <span className="form-label">TopMatch {t('admin.user_detail.referral_type')}</span>
          <span>{user.level_topmatch || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="form-label">Betline {t('admin.user_detail.referral_type')}</span>
          <span>{user.level_tonplay || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="form-label">{t('admin.user_detail.language')}</span>
          <span>{user.language === 'uk' ? 'Українська' : 'Русский'}</span>
        </div>
        <div className="detail-field">
          <span className="form-label">{t('admin.user_detail.created')}</span>
          <span>{new Date(user.created_at).toLocaleString()}</span>
        </div>
        <CopyField label={t('admin.user_detail.wallet_topmatch')} value={user.wallet_topmatch || '—'} mono />
        <CopyField label={t('admin.user_detail.wallet_tonplay')} value={user.wallet_tonplay || '—'} mono />
      </div>

      <div className="glass-panel mb-4">
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
            confirmBan ? (
              <div className="confirm-row">
                <span className="confirm-text">{t('admin.user_detail.confirm_ban')}</span>
                <div className="flex gap-2">
                  <button className="btn btn-danger btn-sm" onClick={() => { setConfirmBan(false); handleAction('ban'); }}>
                    {t('admin.user_detail.ban')}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmBan(false)}>
                    {t('admin.contests.form.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmBan(true)}>
                {t('admin.user_detail.ban')}
              </button>
            )
          ) : (
            <button className="btn btn-success btn-sm" onClick={() => handleAction('unban')}>
              {t('admin.user_detail.unban')}
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel mb-4">
        <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>TopMatch {t('admin.user_detail.set_type')}</h3>
        <p className="text-sm text-secondary mb-2">{t('admin.user_detail.current')}: {user.level_topmatch || '—'}</p>
        <select className="glass-input" value={topMatchLevel} onChange={(e) => setTopMatchLevel(e.target.value)} style={{ width: '100%' }}>
          <option value="">— {t('admin.users.no_level')} —</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setLevel('topmatch', topMatchLevel)} disabled={!topMatchLevel}>
          {t('admin.user_detail.set_type')}
        </button>
      </div>

      <div className="glass-panel">
        <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>Betline {t('admin.user_detail.set_type')}</h3>
        <p className="text-sm text-secondary mb-2">{t('admin.user_detail.current')}: {user.level_tonplay || '—'}</p>
        <select className="glass-input" value={betlineLevel} onChange={(e) => setBetlineLevel(e.target.value)} style={{ width: '100%' }}>
          <option value="">— {t('admin.users.no_level')} —</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setLevel('tonplay', betlineLevel)} disabled={!betlineLevel}>
          {t('admin.user_detail.set_type')}
        </button>
        {levelError && <p className="text-sm" style={{ color: 'var(--error)', marginTop: 8 }}>{levelError}</p>}
      </div>
    </div>
  );
};

export default AdminUserDetail;
