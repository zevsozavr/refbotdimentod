import React from 'react';
import { useTranslation } from 'react-i18next';

const Banned = () => {
  const { t } = useTranslation();
  return (
    <div className="status-screen">
      <div className="status-icon"><span className="icon icon-prohibited"></span></div>
      <h1 className="page-title">{t('banned.title')}</h1>
      <p className="text-secondary">{t('banned.description')}</p>
    </div>
  );
};

export default Banned;
