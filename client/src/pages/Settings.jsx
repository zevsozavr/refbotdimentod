import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import api from '../axios';

const TRC20_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, setUser, theme, toggleTheme } = useApp();
  const [walletTopMatch, setWalletTopMatch] = useState(user?.wallet_topmatch || '');
  const [walletTonPlay, setWalletTonPlay] = useState(user?.wallet_tonplay || '');
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);

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

  const validate = (addr) => !addr || TRC20_REGEX.test(addr);

  const submitWallet = async (casino, address) => {
    if (address && !validate(address)) {
      setError(t('settings.wallet_invalid'));
      return;
    }
    setError(null);
    setSaving(casino);
    setSaved(null);
    try {
      const res = await api.post(`/wallet/${casino}/submit`, { casino, wallet_address: address });
      setUser((prev) => ({ ...prev, ...res.data }));
      setSaved(casino);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      setError(e.response?.data?.errors?.[0]?.message || t('common.error'));
    } finally {
      setSaving(null);
    }
  };

  const WalletField = ({ casino, label, value, onChange }) => (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <span className="settings-value" style={{ fontWeight: 600 }}>{label}</span>
      <div className="flex gap-2" style={{ alignItems: 'center' }}>
        <input
          className="input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('settings.wallet_placeholder')}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => submitWallet(casino, value)}
          disabled={saving === casino}
          style={{ whiteSpace: 'nowrap' }}
        >
          {saving === casino ? '...' : (saved === casino ? t('settings.wallet_saved') : t('settings.wallet_save'))}
        </button>
      </div>
      <p className="text-sm text-secondary">{t('settings.wallet_note')}</p>
    </div>
  );

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
      </div>

      {error && <p className="text-danger" style={{ margin: '8px 0' }}>{error}</p>}

      <div className="settings-section">
        <h2 className="settings-section-title">{t('settings.wallet_title')}</h2>
        <WalletField
          casino="topmatch"
          label={t('settings.wallet_topmatch')}
          value={walletTopMatch}
          onChange={setWalletTopMatch}
        />
        <div style={{ height: 12 }} />
        <WalletField
          casino="tonplay"
          label={t('settings.wallet_tonplay')}
          value={walletTonPlay}
          onChange={setWalletTonPlay}
        />
      </div>
    </div>
  );
};

export default Settings;
