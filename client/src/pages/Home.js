import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Home = () => {
  const { t } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contestsRes, linkRes] = await Promise.allSettled([
          api.get('/contests'),
          api.get('/user/referral-link'),
        ]);
        if (contestsRes.status === 'fulfilled') {
          setContests(contestsRes.value.data.slice(0, 3));
        }
        if (linkRes.status === 'fulfilled') {
          setReferralLink(linkRes.value.data.link);
        }
      } catch (e) {
        console.error('Home fetch error:', e);
      }
    };
    if (user?.status === 'verified') fetchData();
  }, [user]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  if (!user) return null;

  return (
    <div className="page">
      <h1 className="page-title">{t('home.title')}</h1>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-secondary">{t('home.referral_type')}</span>
          {user.referral_type ? (
            <span className="badge badge-type">Type {user.referral_type}</span>
          ) : (
            <span className="badge badge-pending">—</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-secondary">{t('home.casino_id')}</span>
          <span>{user.casino_id || '—'}</span>
        </div>
      </div>

      {referralLink && (
        <div className="card mb-4">
          <h3 className="text-sm text-secondary mb-2">{t('home.referral_link')}</h3>
          <div className="referral-link-card mb-2">{referralLink}</div>
          <button className="btn btn-primary btn-sm" onClick={handleCopy}>
            {copied ? t('home.link_copied') : t('home.copy_link')}
          </button>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3>{t('home.active_contests')}</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/contests')}>
            {t('home.see_all')}
          </button>
        </div>
        {contests.length === 0 ? (
          <p className="text-secondary text-sm">{t('home.no_contests')}</p>
        ) : (
          contests.map((c) => (
            <div key={c.id} className="contest-card">
              <div className="contest-title">{c.title}</div>
              <div className="contest-desc">{c.description}</div>
              <div className="contest-meta">
                <span className="badge badge-type">Type {c.eligible_referral_type}</span>
                <span className="countdown">
                  {new Date(c.end_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Home;
