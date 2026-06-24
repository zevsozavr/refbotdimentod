import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../axios';

const NotificationsPanel = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [announces, setAnnounces] = useState([]);
  const [streams, setStreams] = useState([]);
  const [clearedIds, setClearedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('cleared_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const panelRef = useRef(null);
  const lang = i18n.language === 'uk' ? 'uk' : 'ru';

  const fetchNotifications = () => {
    api.get('/announcements')
      .then(r => {
        // filter out streams from announcements endpoint response
        const onlyAnnounces = r.data.filter(x => x.type === 'announce');
        setAnnounces(onlyAnnounces.slice(0, 5));
      })
      .catch(() => {});
    api.get('/streams')
      .then(r => setStreams(r.data.slice(0, 5)))
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (location.pathname !== '/') return null;

  const clearNotification = (e, type, id) => {
    e.stopPropagation();
    const key = `${type}-${id}`;
    const next = [...clearedIds, key];
    setClearedIds(next);
    localStorage.setItem('cleared_notifications', JSON.stringify(next));
  };

  const clearAllNotifications = () => {
    const next = [
      ...clearedIds,
      ...announces.map(a => `announce-${a.id}`),
      ...streams.map(s => `stream-${s.id}`)
    ];
    const uniqueNext = Array.from(new Set(next));
    setClearedIds(uniqueNext);
    localStorage.setItem('cleared_notifications', JSON.stringify(uniqueNext));
  };

  const openLink = (link) => {
    const isTelegramLink = link.includes('t.me') || link.includes('telegram.me');
    if (isTelegramLink && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(link);
    } else {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  };

  const activeAnnounces = announces.filter(a => !clearedIds.includes(`announce-${a.id}`));
  const activeStreams = streams.filter(s => !clearedIds.includes(`stream-${s.id}`));
  const total = activeAnnounces.length + activeStreams.length;

  return (
    <>
      <button className="notif-bell" onClick={() => setOpen(!open)}>
        <span className="icon icon-bell"></span>
        {total > 0 && <span className="notif-badge">{total}</span>}
      </button>

      {open && (
        <div className="notif-overlay" onClick={() => setOpen(false)}>
          <div className="notif-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
            <div className="notif-panel-header">
              <span><span className="icon icon-bell"></span> {lang === 'uk' ? 'Сповіщення' : 'Уведомления'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {total > 0 && (
                  <button className="notif-clear-all" onClick={clearAllNotifications}>
                    {lang === 'uk' ? 'Очистити все' : 'Очистить все'}
                  </button>
                )}
                <button className="notif-close" onClick={() => setOpen(false)}><span className="icon icon-close"></span></button>
              </div>
            </div>

            {activeAnnounces.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title"><span className="icon icon-megaphone"></span> {lang === 'uk' ? 'Оголошення' : 'Объявления'}</div>
                {activeAnnounces.map(a => (
                  <div key={`a-${a.id}`} className="notif-item" onClick={() => { navigate('/announces'); setOpen(false); }}>
                    {a.banner_image && <img className="notif-item-img" src={a.banner_image} alt="" />}
                    <div className="notif-item-body">
                      <div className="notif-item-title">{lang === 'uk' ? a.title_uk : a.title_ru}</div>
                      {((lang === 'uk' ? a.text_uk : a.text_ru) || '').length > 0 && (
                        <div className="notif-item-text">{(lang === 'uk' ? a.text_uk : a.text_ru || '').slice(0, 80)}</div>
                      )}
                    </div>
                    <button className="notif-item-clear" onClick={(e) => clearNotification(e, 'announce', a.id)}><span className="icon icon-close"></span></button>
                  </div>
                ))}
              </div>
            )}

            {activeStreams.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title"><span className="icon icon-monitor"></span> {lang === 'uk' ? 'Стріми' : 'Стримы'}</div>
                {activeStreams.map(s => {
                  const startTime = new Date(s.start_time);
                  const timeStr = startTime.toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-RU', { timeZone: 'Europe/Kyiv' });
                  return (
                    <div key={`s-${s.id}`} className="notif-item" onClick={() => openLink(s.link)}>
                      {s.banner_image && <img className="notif-item-img" src={s.banner_image} alt="" />}
                      <div className="notif-item-body">
                        <div className="notif-item-title">
                          {s.text_uk && lang === 'uk' ? s.text_uk : s.text_ru || (lang === 'uk' ? 'Стрім' : 'Стрим')}
                        </div>
                        <div className="notif-item-text"><span className="icon icon-clock"></span> {timeStr}</div>
                      </div>
                      <button className="notif-item-clear" onClick={(e) => clearNotification(e, 'stream', s.id)}><span className="icon icon-close"></span></button>
                    </div>
                  );
                })}
              </div>
            )}

            {total === 0 && (
              <div className="notif-empty">{lang === 'uk' ? 'Немає сповіщень' : 'Нет уведомлений'}</div>
            )}

            {total > 0 && (
              <div className="notif-view-all" onClick={() => { navigate('/announces'); setOpen(false); }}>
                {lang === 'uk' ? <><span className="icon icon-megaphone"></span> Всі сповіщення &rarr;</> : <><span className="icon icon-megaphone"></span> Все уведомления &rarr;</>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationsPanel;
