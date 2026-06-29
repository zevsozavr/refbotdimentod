import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const CASINOS = ['topmatch', 'betline'];

const AdminDeposits = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get('/admin/deposits')
      .then(res => setUsers(res.data.users || []))
      .catch(e => console.error('Fetch deposits error:', e))
      .finally(() => setLoading(false));
  }, []);

  const casinoName = (c) => (c === 'topmatch' ? 'TopMatch' : 'Betline');

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title metallic-text"><span className="emoji-icon">💰</span> {t('admin.deposits.title')}</h1>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <p className="text-secondary">{t('admin.deposits.empty')}</p>
      ) : (
        users.map(u => (
          <div key={u.user_id} className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2">
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {u.telegram_username ? `@${u.telegram_username}` : `ID ${u.telegram_id}`}
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tertiary)' }}>
                ${u.grand_total.toFixed(2)}
              </span>
            </div>
            <div className="text-secondary" style={{ fontSize: 11, marginBottom: 8 }}>Telegram ID: {u.telegram_id}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CASINOS.map(c => {
                const d = u.casinos[c];
                if (!d) return null;
                return (
                  <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span className="badge badge-type">{casinoName(c)}</span>
                    <span>
                      <span style={{ color: 'var(--tertiary)', fontWeight: 600 }}>${d.total_amount.toFixed(2)}</span>
                      <span className="text-secondary" style={{ marginLeft: 8 }}>{t('admin.deposits.transactions')}: {d.transaction_count}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminDeposits;
