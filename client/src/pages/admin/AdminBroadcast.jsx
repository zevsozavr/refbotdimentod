import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../axios';

const AdminBroadcast = () => {
  const { t } = useTranslation();
  const [messageUk, setMessageUk] = useState('');
  const [messageRu, setMessageRu] = useState('');
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
      const res = await api.post('/admin/broadcast', {
        message_uk: messageUk,
        message_ru: messageRu,
        target_referral_type: targetType || null,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const openConfirm = () => {
    if (!messageUk.trim() || !messageRu.trim()) return;
    setShowConfirm(true);
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('admin.broadcast.title')}</h1>

      <div className="card mb-4">
        <div className="form-group">
          <label className="form-label">{t('admin.broadcast.message_uk')}</label>
          <textarea className="input" rows={4} value={messageUk} onChange={(e) => setMessageUk(e.target.value)} maxLength={1000} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('admin.broadcast.message_ru')}</label>
          <textarea className="input" rows={4} value={messageRu} onChange={(e) => setMessageRu(e.target.value)} maxLength={1000} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('admin.broadcast.target')}</label>
          <select className="select" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="">{t('admin.broadcast.all')}</option>
            <option value="1">Type 1</option>
            <option value="2">Type 2</option>
            <option value="3">Type 3</option>
          </select>
        </div>

        {(messageUk || messageRu) && (
          <div className="card mb-3" style={{ background: 'var(--surface-2)' }}>
            <div className="form-label mb-2">{t('admin.broadcast.preview')}</div>
            {messageUk && <div className="text-sm mb-2"><strong>UK:</strong> {messageUk}</div>}
            {messageRu && <div className="text-sm"><strong>RU:</strong> {messageRu}</div>}
          </div>
        )}

        {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}

        {result && (
          <p className="text-sm mb-2" style={{ color: 'var(--success)' }}>
            {t('admin.broadcast.sent', { count: result.sentCount })}
          </p>
        )}

        <button className="btn btn-primary btn-block" onClick={openConfirm} disabled={sending || !messageUk.trim() || !messageRu.trim()}>
          {sending ? t('common.loading') : t('admin.broadcast.send')}
        </button>
      </div>

      {showConfirm && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="mb-4">{t('admin.broadcast.confirm', { count: '?' })}</p>
          <div className="flex gap-2 justify-center">
            <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
              {sending ? t('common.loading') : t('admin.broadcast.send')}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
              {t('admin.contests.form.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBroadcast;
