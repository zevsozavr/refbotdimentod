import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Pending = () => {
  const { t } = useTranslation();
  const { user, setUser } = useApp();
  const [casinoId, setCasinoId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pollingRef = useRef(null);

  useEffect(() => {
    if (user?.casino_id) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await api.get('/user/me');
          if (res.data.status === 'verified') {
            setUser(res.data);
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 10000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user?.casino_id, setUser]);

  const handleSubmit = async () => {
    if (!casinoId.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/user/submit-casino-id', { casino_id: casinoId.trim() });
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.casino_id) {
    return (
      <div className="status-screen">
        <div className="status-icon">⏳</div>
        <h1 className="page-title">{t('pending.title')}</h1>
        <p className="text-secondary">{t('pending.already_submitted')}</p>
        <div className="spinner mt-4" />
      </div>
    );
  }

  return (
    <div className="status-screen">
      <div className="status-icon">📝</div>
      <h1 className="page-title">{t('pending.title')}</h1>
      <p className="text-secondary">{t('pending.description')}</p>
      <div className="w-full" style={{ maxWidth: 320 }}>
        <input
          className="input mb-2"
          placeholder={t('pending.casino_id_placeholder')}
          value={casinoId}
          onChange={(e) => setCasinoId(e.target.value)}
          maxLength={32}
        />
        {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}
        <button
          className="btn btn-primary btn-block mt-2"
          onClick={handleSubmit}
          disabled={submitting || !casinoId.trim()}
        >
          {submitting ? t('common.loading') : t('pending.submit')}
        </button>
      </div>
    </div>
  );
};

export default Pending;
