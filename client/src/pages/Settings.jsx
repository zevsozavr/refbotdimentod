import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import api from '../axios';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, setUser, theme, toggleTheme, lightweightAnimations, toggleLightweightAnimations } = useApp();
  const lang = user?.language || 'uk';

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

      <div className="settings-section">
        <div className="settings-row">
          <span className="settings-label">{t('settings.language')}</span>
          <div className="lang-toggle">
            <button
              className={`lang-btn ${user?.language === 'uk' ? 'active' : ''}`}
              onClick={() => changeLanguage('uk')}
            >
              UK
            </button>
            <button
              className={`lang-btn ${user?.language === 'ru' ? 'active' : ''}`}
              onClick={() => changeLanguage('ru')}
            >
              RU
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t('settings.theme')}</span>
          <button className={`theme-toggle ${theme === 'light' ? 'active' : ''}`} onClick={toggleTheme}>
            <div className="theme-toggle-knob" />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <span className="settings-label">
              {lang === 'uk' ? 'Легкі анімації' : 'Лёгкие анимации'}
            </span>
            <p className="settings-caption">
              {lang === 'uk'
                ? 'Вимкнути частинки та складні ефекти'
                : 'Отключить частицы и сложные эффекты'}
            </p>
          </div>
          <div
            className={`theme-toggle ${lightweightAnimations ? 'active' : ''}`}
            onClick={toggleLightweightAnimations}
          >
            <div className="theme-toggle-knob" />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-row">
          <span className="settings-value">{t('settings.username')}</span>
          <span className="settings-value">@{user?.telegram_username || t('settings.not_set')}</span>
        </div>
        <div className="settings-row">
          <span className="settings-value">TopMatch ID</span>
          <span className="settings-value">{user?.casino_id_topmatch || t('settings.not_set')}</span>
        </div>
        <div className="settings-row">
          <span className="settings-value">TonPlay ID</span>
          <span className="settings-value">{user?.casino_id_tonplay || t('settings.not_set')}</span>
        </div>
        <div className="settings-row">
          <span className="settings-value">TopMatch TRC20</span>
          <span className="settings-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {user?.wallet_topmatch || t('settings.not_set')}
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-value">TonPlay TRC20</span>
          <span className="settings-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {user?.wallet_tonplay || t('settings.not_set')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
