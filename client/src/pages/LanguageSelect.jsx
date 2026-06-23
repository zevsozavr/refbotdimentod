import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const LanguageSelect = () => {
  const { t, i18n } = useTranslation();
  const { setUser, setLoading } = useApp();
  const [showDevInput, setShowDevInput] = useState(false);
  const [devId, setDevId] = useState(localStorage.getItem('dev_telegram_id') || '');
  const [error, setError] = useState('');

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
        return;
      }

      // No Telegram — show dev login
      if (devId) {
        const res = await api.post('/auth/init', {
          telegram_id: parseInt(devId),
          telegram_username: 'dev',
          language: lang,
        });
        setUser(res.data);
      } else {
        setShowDevInput(true);
      }
    } catch (err) {
      console.error('Auth init error:', err);
      setError(err.response?.data?.error || 'Connection failed');
      setLoading(false);
    }
  };

  const handleDevSubmit = async () => {
    if (!devId.trim()) return;
    localStorage.setItem('dev_telegram_id', devId.trim());
    setShowDevInput(false);
    await selectLanguage(localStorage.getItem('language') || 'uk');
  };

  if (showDevInput) {
    return (
      <div className="lang-select">
        <h1 className="page-title">{t('language.select')}</h1>
        <p className="text-secondary mb-4">Enter your Telegram ID for development:</p>
        <input
          className="input mb-2"
          placeholder="Telegram ID"
          value={devId}
          onChange={(e) => setDevId(e.target.value)}
          type="number"
        />
        {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}
        <button className="btn btn-primary btn-block" onClick={handleDevSubmit} disabled={!devId.trim()}>
          Submit
        </button>
      </div>
    );
  }

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
