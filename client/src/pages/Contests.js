import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';

const Contests = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [activeRes, historyRes] = await Promise.all([
          api.get('/contests'),
          api.get('/contests/history'),
        ]);
        setActive(activeRes.data);
        setHistory(historyRes.data);
      } catch (e) {
        console.error('Contests fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const getTimeRemaining = (endDate) => {
    const diff = new Date(endDate) - new Date();
    if (diff <= 0) return t('contests.ended');
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">{t('contests.title')}</h1>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('contests.title')}</h1>

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          {t('contests.active')} ({active.length})
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          {t('contests.history')} ({history.length})
        </button>
      </div>

      {tab === 'active' && (
        active.length === 0 ? (
          <p className="text-secondary">{t('contests.no_active')}</p>
        ) : (
          active.map((c) => (
            <div key={c.id} className="card mb-4">
              <div className="contest-title">{c.title}</div>
              <div className="contest-desc mt-2">{c.description}</div>
              <div className="contest-meta mt-2">
                <span className="badge badge-active">{t('contests.prize')}: {c.prize}</span>
                <span className="badge badge-type">Type {c.eligible_referral_type}</span>
              </div>
              <div className="countdown mt-2">{t('contests.ends_in')}: {getTimeRemaining(c.end_date)}</div>
            </div>
          ))
        )
      )}

      {tab === 'history' && (
        history.length === 0 ? (
          <p className="text-secondary">{t('contests.no_history')}</p>
        ) : (
          history.map((c) => (
            <div key={c.id} className="card mb-4">
              <div className="contest-title">{c.title}</div>
              <div className="contest-desc mt-2">{c.description}</div>
              <div className="contest-meta mt-2">
                <span className="badge badge-ended">{t('contests.prize')}: {c.prize}</span>
                <span className={`badge ${c.status === 'winner_picked' ? 'badge-winner' : 'badge-ended'}`}>
                  {c.status === 'winner_picked' ? t('contests.winner') : t('contests.ended')}
                </span>
              </div>
              {c.winner && (
                <div className="mt-2 text-sm" style={{ color: 'var(--warning)' }}>
                  {t('contests.winner')}: @{c.winner.telegram_username}
                </div>
              )}
            </div>
          ))
        )
      )}
    </div>
  );
};

export default Contests;
