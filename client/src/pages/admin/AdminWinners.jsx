import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminWinners = () => {
  const { t } = useTranslation();
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [casino, setCasino] = useState('');

  useEffect(() => { fetchWinners(); }, [casino]);

  const fetchWinners = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/winners' + (casino ? `?casino=${casino}` : ''));
      setWinners(res.data);
    } catch (e) {
      console.error('Fetch winners error:', e);
    } finally {
      setLoading(false);
    }
  };

  const casinoName = (c) => (c === 'topmatch' ? 'TopMatch' : 'Betline');

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title metallic-text"><span className="emoji-icon">🏆</span> {t('admin.winners.title')}</h1>

      <div className="filter-tabs" style={{ marginBottom: 16 }}>
        {['', 'topmatch', 'betline'].map(c => (
          <button key={c || 'all'} className={`filter-tab ${casino === c ? 'active' : ''}`} onClick={() => setCasino(c)}>
            {c === '' ? t('admin.users.all') : casinoName(c)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : winners.length === 0 ? (
        <p className="text-secondary">{t('admin.winners.empty')}</p>
      ) : (
        winners.map(w => (
          <div key={w.id} className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2">
              <div style={{ fontSize: 15, fontWeight: 700 }}>{w.contest_title}</div>
              <span className="badge badge-type">{casinoName(w.casino)} — {t('contests.level')} {w.level}</span>
            </div>
            <div className="text-secondary" style={{ fontSize: 13, marginBottom: 6 }}>
              <span className="emoji-icon">🎁</span> {w.prize}
            </div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              <span className="emoji-icon">👤</span> {w.telegram_username ? `@${w.telegram_username}` : `ID ${w.telegram_id}`}
            </div>
            <div className="text-secondary" style={{ fontSize: 12, marginBottom: 2 }}>Telegram ID: {w.telegram_id}</div>
            {w.casino_account_id && <div className="text-secondary" style={{ fontSize: 12, marginBottom: 2 }}>Casino ID: {w.casino_account_id}</div>}
            {w.wallet && <div className="text-secondary" style={{ fontSize: 12, marginBottom: 2, wordBreak: 'break-all' }}>TRC20: {w.wallet}</div>}
            <div className="text-secondary" style={{ fontSize: 11, marginTop: 6 }}>
              <span className="emoji-icon">🕐</span> {new Date(w.picked_at).toLocaleString([], { timeZone: 'Europe/Kyiv' })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminWinners;
