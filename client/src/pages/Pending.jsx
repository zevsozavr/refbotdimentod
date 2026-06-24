import React from 'react';
import { useTranslation } from 'react-i18next';

const Pending = () => {
  const { t } = useTranslation();
  return (
    <div className="status-screen">
      <div className="status-icon"><span className="emoji-icon">⌛</span></div>
      <h1 className="page-title">{t('pending.title')}</h1>
      <p className="text-secondary" style={{ marginBottom: 16 }}>{t('pending.description')}</p>
      <div className="wallet-pending-badge" style={{ display: 'inline-block', padding: '6px 12px', fontSize: 14 }}>
        {t('pending.waiting')}
      </div>
    </div>
  );
};

export default Pending;
