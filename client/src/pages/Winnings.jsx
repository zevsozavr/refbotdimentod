import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import Chevron from '../components/Chevron';

const Winnings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/winnings')
      .then(res => setWinnings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const casinoName = (c) => (c === 'topmatch' ? 'TopMatch' : 'Betline');

  if (loading) {
    return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}>
          <Chevron />
        </button>
        <h1 className="page-title metallic-text" style={{ marginBottom: 0 }}>{t('winnings.title')}</h1>
      </div>

      {winnings.length === 0 ? (
        <div className="glass-panel" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}><span className="emoji-icon">🏆</span></div>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14 }}>{t('winnings.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {winnings.map(w => (
            <div key={w.id} className={`glass-panel contest-card ${w.casino}`} style={{ padding: 16 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="contest-title">{w.title}</div>
                <span className="badge badge-type">{casinoName(w.casino)}</span>
              </div>
              <div className="contest-prize">{t('winnings.prize')}: {w.prize}</div>
              <div className="text-secondary" style={{ fontSize: 11, marginTop: 8 }}>
                <span className="emoji-icon">🕐</span> {new Date(w.picked_at).toLocaleString([], { timeZone: 'Europe/Kyiv' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Winnings;
