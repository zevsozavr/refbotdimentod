import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../axios';

const Contests = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const casinoId = searchParams.get('casino');
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);

  useEffect(() => {
    if (!casinoId) {
      navigate('/');
      return;
    }
    const fetch = async () => {
      try {
        setWalletError(false);
        const [activeRes, historyRes] = await Promise.all([
          api.get(`/contests?casino=${casinoId}`),
          api.get(`/contests/history?casino=${casinoId}`),
        ]);
        setActive(activeRes.data);
        setHistory(historyRes.data);
      } catch (e) {
        if (e.response?.status === 403) {
          setWalletError(true);
        } else {
          console.error('Contests fetch error:', e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [casinoId, navigate]);

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

  if (walletError) {
    return (
      <div className="page">
        <h1 className="page-title">{t('contests.title')}</h1>
        <div className="card" style={{ padding: 20, textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {t('settings.wallet_title')}
          </p>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
            {t('settings.wallet_note')}
          </p>
          <button className={`btn btn-${casinoId}`} onClick={() => navigate(`/casino/${casinoId}`)}>
            {t('settings.wallet_save')}
          </button>
        </div>
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
            <div key={c.id} className={`contest-card ${c.casino}`}>
              <div className="contest-title">{c.title}</div>
              <div className="contest-prize">{t('contests.prize')}: {c.prize}</div>
              <div className="contest-timer">{t('contests.ends_in')}: {getTimeRemaining(c.end_date)}</div>
            </div>
          ))
        )
      )}

      {tab === 'history' && (
        history.length === 0 ? (
          <p className="text-secondary">{t('contests.no_history')}</p>
        ) : (
          history.map((c) => (
            <div key={c.id} className={`contest-card ${c.casino || ''}`}>
              <div className="contest-title">{c.title}</div>
              <div className="contest-prize">{t('contests.prize')}: {c.prize}</div>
              {c.winner && (
                <div className="contest-timer" style={{ color: 'var(--warning)' }}>
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
