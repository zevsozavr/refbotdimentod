import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';

const LanguageSelect = () => {
  const { t, i18n } = useTranslation();
  const { triggerInit } = useApp();

  const selectLanguage = (lang) => {
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    triggerInit();
  };

  return (
    <div className="lang-select">
      <h1 className="page-title">{t('language.select')}</h1>
      <button className="lang-btn" onClick={() => selectLanguage('uk')}>
        🇺🇦 {t('language.uk')}
      </button>
      <button className="lang-btn" onClick={() => selectLanguage('ru')}>
        🇷🇺 {t('language.ru')}
      </button>
    </div>
  );
};

export default LanguageSelect;
