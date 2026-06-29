import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminBroadcast = () => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSend = async () => {
    setSending(true);
    setError('');
    setShowConfirm(false);
    try {
      const res = await adminApi.post('/admin/broadcast', {
        message,
        target_referral_type: targetType || null,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const canSend = message.trim();

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title">{t('admin.broadcast.title')}</h1>

      <div className="glass-panel mb-4">
        <div className="form-group">
          <label className="form-label">{t('admin.broadcast.message')}</label>
          <textarea className="glass-input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('admin.broadcast.target')}</label>
          <select className="glass-input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="">{t('admin.broadcast.all')}</option>
            <option value="1">{t('contests.level')} 1</option>
            <option value="2">{t('contests.level')} 2</option>
            <option value="3">{t('contests.level')} 3</option>
          </select>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</p>}
        {result && (
          <p className="text-sm" style={{ color: 'var(--tertiary)', marginBottom: 12 }}>
            {t('admin.broadcast.sent', { count: result.sentCount })}
          </p>
        )}

        <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={sending || !canSend}>
          {sending ? t('common.loading') : t('admin.broadcast.send')}
        </button>
      </div>

      {message && (
        <div className="glass-panel mb-4">
          <div className="form-label" style={{ marginBottom: 10 }}>{t('admin.broadcast.preview')}</div>
          <div className="text-sm">{message}</div>
        </div>
      )}

      {showConfirm && (
        <div className="confirm-row">
          <span className="confirm-text">{t('admin.broadcast.confirm', { count: '?' })}</span>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending}>
              {sending ? t('common.loading') : t('admin.broadcast.send')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowConfirm(false)}>
              {t('admin.contests.form.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBroadcast;
