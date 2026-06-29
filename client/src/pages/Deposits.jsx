import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';
import Chevron from '../components/Chevron';

const Deposits = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const lang = user?.language || 'uk';
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/deposits').then(res => {
      setDeposits(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getCasinoName = (casinoId) => {
    const names = { topmatch: 'TopMatch', betline: 'Betline' };
    return names[casinoId] || casinoId;
  };

  if (loading) {
    return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}>
          <Chevron />
        </button>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {lang === 'uk' ? 'Мої депозити' : 'Мои депозиты'}
        </h1>
      </div>

      {deposits.length === 0 ? (
        <div className="glass-panel" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}><span className="emoji-icon">💰</span></div>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14 }}>
            {lang === 'uk' ? 'Немає даних про депозити' : 'Нет данных о депозитах'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deposits.map((d) => {
            const progress = Math.min((d.total_amount / d.threshold) * 100, 100);
            const level = d.total_amount >= d.threshold ? 3 : (d.total_amount > 0 ? 2 : 1);
            return (
              <div key={d.casino} className="glass-panel" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                    {getCasinoName(d.casino)}
                    <span className={`level-badge ${d.casino}`} style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px' }}>
                      LEVEL {level}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                    {lang === 'uk' ? 'Загальна сума' : 'Общая сумма'}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: d.total_amount > 0 ? 'var(--tertiary)' : 'var(--on-surface-variant)' }}>
                    ${d.total_amount.toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                    {lang === 'uk' ? 'Транзакцій' : 'Транзакций'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                    {d.transaction_count}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                    {lang === 'uk' ? 'Поріг рівня 3' : 'Порог уровня 3'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                    ${d.threshold.toFixed(2)}
                  </span>
                </div>

                <div className="progress-bar-bg" style={{ height: 8, borderRadius: 999, background: 'rgba(195,198,211,0.1)', overflow: 'hidden' }}>
                  <div className="progress-bar-fill" style={{ height: '100%', borderRadius: 999, background: d.total_amount >= d.threshold ? 'var(--tertiary)' : 'linear-gradient(90deg, var(--tertiary), #e9c349)', width: `${progress}%`, transition: 'width 0.6s ease' }} />
                </div>

                {d.total_amount >= d.threshold && (
                  <p style={{ fontSize: 12, color: 'var(--tertiary)', marginTop: 6, fontWeight: 600 }}>
                    {lang === 'uk' ? '✅ Досягнуто рівня 3!' : '✅ Достигнут уровень 3!'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Deposits;