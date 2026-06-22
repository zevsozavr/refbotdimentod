import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';

const Referral = () => {
  const { t } = useTranslation();
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notVerified, setNotVerified] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/user/referral-link');
        setLink(res.data.link);
      } catch (err) {
        if (err.response?.status === 403) {
          setNotVerified(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">{t('referral.title')}</h1>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  if (notVerified) {
    return (
      <div className="page">
        <h1 className="page-title">{t('referral.title')}</h1>
        <div className="card">
          <p className="text-secondary">{t('referral.not_verified')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('referral.title')}</h1>
      <div className="card">
        <h3 className="text-sm text-secondary mb-2">{t('referral.link')}</h3>
        <div className="referral-link-card mb-2">{link}</div>
        <button className="btn btn-primary" onClick={handleCopy}>
          {copied ? t('referral.copied') : t('referral.copy')}
        </button>
      </div>
    </div>
  );
};

export default Referral;
