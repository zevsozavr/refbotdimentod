import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import useStaggeredEntrance from '../hooks/useStaggeredEntrance';

const Announces = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);

  useStaggeredEntrance('.announcement-card', 100);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const lang = i18n.language === 'uk' ? 'uk' : 'ru';
  const timerRef = useRef();

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/announcements')
      .then(res => setItems(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const openLink = (link) => {
    const isTelegramLink = link.includes('t.me') || link.includes('telegram.me');
    if (isTelegramLink && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(link);
    } else {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const getCountdown = (scheduledAt) => {
    const diff = new Date(scheduledAt) - now;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}г ${m}хв ${s}с`;
  };

  const isLive = (startTime) => new Date(startTime) <= now;

  const allItems = (items || []).map(item => ({
    ...item,
    itemType: item.type === 'stream' ? 'stream' : 'announcement',
    sortDate: item.type === 'stream' ? (item.start_time || item.created_at) : item.created_at,
  })).sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.itemType === filter);

  if (loading) return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <h1 className="page-title">{t('nav.announces')}</h1>

      <div className="filter-tabs">
        {['all', 'announcement', 'stream'].map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? (lang === 'uk' ? 'Всі' : 'Все')
              : f === 'announcement' ? (lang === 'uk' ? 'Оголошення' : 'Объявления')
              : (lang === 'uk' ? 'Стріми' : 'Стримы')}
          </button>
        ))}
      </div>

      {error ? (
        <div className="error-state">
          <p className="text-secondary" style={{ marginBottom: 8 }}>{error}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>{t('common.retry') || 'Retry'}</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-secondary">{lang === 'uk' ? 'Немає оголошень' : 'Нет объявлений'}</p>
      ) : (
        filtered.map(item => (
          <div
            key={`${item.itemType}-${item.id}`}
            className={`announcement-card ${item.itemType}`}
            onClick={() => item.itemType === 'stream' && item.link ? openLink(item.link) : null}
          >
            {item.banner_image && <img className="announcement-banner" src={item.banner_image} alt="" />}
            <div className="announcement-body">
              {item.itemType === 'stream' ? (
                <>
                  <div className="announcement-type-badge stream"><span className="emoji-icon">🖥️</span> {lang === 'uk' ? 'Стрім' : 'Стрим'}</div>
                  <div className="announcement-title">{lang === 'uk' ? item.text_uk : item.text_ru || 'Stream'}</div>
                  {item.link && <div className="announcement-content"><span className="emoji-icon">🔗</span> {item.link}</div>}
                  <div className="stream-countdown">
                    {isLive(item.start_time) ? (
                      <>
                        <span className="live-dot"></span>
                        {lang === 'uk' ? 'Зараз в ефірі' : 'Сейчас в эфире'}
                      </>
                    ) : (
                      <><span className="emoji-icon">⏱️</span> {getCountdown(item.start_time)}</>
                    )}
                  </div>
                  <div className="announcement-date"><span className="emoji-icon">🕐</span> {new Date(item.start_time).toLocaleString([], { timeZone: 'Europe/Kyiv' })}</div>
                </>
              ) : (
                <>
                  <div className="announcement-type-badge announcement"><span className="emoji-icon">📢</span> {lang === 'uk' ? 'Оголошення' : 'Объявление'}</div>
                  <div className="announcement-title">{lang === 'uk' ? item.title_uk : item.title_ru}</div>
                  {(lang === 'uk' ? item.text_uk : item.text_ru) && <div className="announcement-content">{lang === 'uk' ? item.text_uk : item.text_ru}</div>}
                  <div className="announcement-date">{new Date(item.created_at).toLocaleString([], { timeZone: 'Europe/Kyiv' })}</div>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Announces;
