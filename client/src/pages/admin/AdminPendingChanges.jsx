import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminPendingChanges = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'uk' ? 'uk' : 'ru';
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const res = await adminApi.get('/admin/pending-changes');
      setChanges(res.data);
    } catch (e) {
      console.error('Fetch pending changes error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleApprove = async (id) => {
    try {
      await adminApi.post(`/admin/pending-changes/${id}/approve`);
      fetch();
    } catch (e) {
      alert(e.response?.data?.error || t('common.error'));
    }
  };

  const handleReject = async (id) => {
    try {
      await adminApi.post(`/admin/pending-changes/${id}/reject`);
      fetch();
    } catch (e) {
      alert(e.response?.data?.error || t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="page">
        <AdminNav />
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title metallic-text">{lang === 'uk' ? 'Очікувані зміни' : 'Ожидающие изменения'}</h1>

      {changes.length === 0 ? (
        <p className="text-secondary">{lang === 'uk' ? 'Немає очікуваних змін' : 'Нет ожидающих изменений'}</p>
      ) : (
        changes.map((c) => (
          <div key={c.id} className="glass-panel pending-change-row" style={{ padding: '16px', marginBottom: '12px' }}>
            <div className="pending-change-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${c.change_type === 'wallet' ? 'badge-success' : 'badge-primary'}`}>
                  {c.change_type === 'wallet' ? <><span className="emoji-icon">💰</span> Wallet</> : <><span className="emoji-icon">🎰</span> Casino ID</>}
                </span>
                {c.casino && <span className="badge badge-secondary">{c.casino.toUpperCase()}</span>}
              </div>
              <span className="pending-change-field">
                {c.change_type === 'wallet'
                  ? (c.casino === 'topmatch' ? 'TopMatch TRC20' : 'TonPlay TRC20')
                  : (c.casino === 'topmatch' ? 'TopMatch ID' : 'TonPlay ID')}
              </span>
            </div>
            <div className="pending-change-user">@{c.telegram_username || `ID: ${c.telegram_id}`}</div>
            <div className="pending-change-values">
              {c.old_value ? (
                <>
                  <span className="pending-change-old">{c.old_value}</span>
                  <span className="pending-change-arrow"><span className="emoji-icon">▶</span></span>
                </>
              ) : null}
              <span className="pending-change-new">{c.new_value}</span>
            </div>
            <div className="text-caption" style={{ fontSize: 11, marginBottom: 8 }}>
              {new Date(c.created_at).toLocaleString('uk-UA')}
            </div>
            <div className="pending-change-actions">
              <button className="btn btn-success btn-sm" onClick={() => handleApprove(c.id)}>
                <span className="emoji-icon">✅</span> {lang === 'uk' ? 'Підтвердити' : 'Подтвердить'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleReject(c.id)}>
                <span className="emoji-icon">❌</span> {lang === 'uk' ? 'Відхилити' : 'Отклонить'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminPendingChanges;
