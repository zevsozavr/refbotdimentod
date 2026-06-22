import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import api from '../axios';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, setUser, theme, toggleTheme } = useApp();

  const changeLanguage = async (lang) => {
    try {
      await api.post('/auth/language', { language: lang });
      localStorage.setItem('language', lang);
      i18n.changeLanguage(lang);
      setUser((prev) => ({ ...prev, language: lang }));
    } catch (err) {
      console.error('Language change error:', err);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('settings.title')}</h1>

      <div className="card mb-4">
        <div className="toggle-row">
          <span>{t('settings.language')}</span>
          <div className="flex gap-2">
            <button
              className={`btn btn-sm ${user?.language === 'uk' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => changeLanguage('uk')}
            >
              UK
            </button>
            <button
              className={`btn btn-sm ${user?.language === 'ru' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => changeLanguage('ru')}
            >
              RU
            </button>
          </div>
        </div>

        <div className="toggle-row">
          <span>{t('settings.theme')}</span>
          <button className={`toggle ${theme === 'light' ? 'on' : ''}`} onClick={toggleTheme}>
            <div className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toggle-row">
          <span className="text-sm text-secondary">{t('settings.username')}</span>
          <span>@{user?.telegram_username || t('settings.not_set')}</span>
        </div>
        <div className="toggle-row">
          <span className="text-sm text-secondary">{t('settings.casino_id')}</span>
          <span>{user?.casino_id || t('settings.not_set')}</span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
