import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Rejected = () => {
  const { t } = useTranslation();
  const { user, setUser } = useApp();
  const [casinoId, setCasinoId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!casinoId.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/user/submit-casino-id', { casino_id: casinoId.trim() });
      setUser(res.data);
    } catch (err) {
      console.error('Resubmit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="status-screen">
      <div className="status-icon">❌</div>
      <h1 className="page-title">{t('rejected.title')}</h1>
      <p className="text-secondary">{t('rejected.description')}</p>
      <div className="w-full" style={{ maxWidth: 320 }}>
        <input
          className="input mb-2"
          placeholder={t('pending.casino_id_placeholder')}
          value={casinoId}
          onChange={(e) => setCasinoId(e.target.value)}
          maxLength={32}
        />
        <button
          className="btn btn-primary btn-block"
          onClick={handleSubmit}
          disabled={submitting || !casinoId.trim()}
        >
          {submitting ? t('common.loading') : t('rejected.resubmit')}
        </button>
      </div>
    </div>
  );
};

export default Rejected;
