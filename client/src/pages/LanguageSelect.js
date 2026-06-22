import React from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const LanguageSelect = () => {
  const { t, i18n } = useTranslation();
  const { setUser, setLoading } = useApp();

  const selectLanguage = async (lang) => {
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);

    try {
      const tg = window.Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser?.id) {
        const res = await api.post('/auth/init', {
          telegram_id: tgUser.id,
          telegram_username: tgUser.username || '',
          language: lang,
        });
        setUser(res.data);
      }
    } catch (err) {
      console.error('Auth init error:', err);
      setLoading(false);
    }
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
