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
  const panelRef = useRef(null);
  const lang = i18n.language === 'uk' ? 'uk' : 'ru';

  useEffect(() => {
    if (!open) return;
    api.get('/announcements').then(r => setAnnounces(r.data.slice(0, 5))).catch(() => {});
    api.get('/streams').then(r => setStreams(r.data.slice(0, 5))).catch(() => {});
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (location.pathname !== '/') return null;

  const total = announces.length + streams.length;

  return (
    <>
      <button className="notif-bell" onClick={() => setOpen(!open)}>
        🔔
        {total > 0 && <span className="notif-badge">{total}</span>}
      </button>

      {open && (
        <div className="notif-overlay" onClick={() => setOpen(false)}>
          <div className="notif-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
            <div className="notif-panel-header">
              <span>{lang === 'uk' ? '🔔 Сповіщення' : '🔔 Уведомления'}</span>
              <button className="notif-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            {announces.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title">📢 {lang === 'uk' ? 'Оголошення' : 'Объявления'}</div>
                {announces.map(a => (
                  <div key={`a-${a.id}`} className="notif-item" onClick={() => { navigate('/announces'); setOpen(false); }}>
                    {a.banner_image && <img className="notif-item-img" src={a.banner_image} alt="" />}
                    <div className="notif-item-body">
                      <div className="notif-item-title">{lang === 'uk' ? a.title_uk : a.title_ru}</div>
                      {((lang === 'uk' ? a.text_uk : a.text_ru) || '').length > 0 && (
                        <div className="notif-item-text">{(lang === 'uk' ? a.text_uk : a.text_ru || '').slice(0, 80)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {streams.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title">📺 {lang === 'uk' ? 'Стріми' : 'Стримы'}</div>
{streams.map(s => {
                  const startTime = new Date(s.start_time);
                  const timeStr = startTime.toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-RU', { timeZone: 'Europe/Kyiv' });
                  const openLink = (link) => {
                    if (window.Telegram?.WebApp?.openLink) {
                      window.Telegram.WebApp.openLink(link);
                    } else {
                      window.open(link, '_blank');
                    }
                    setOpen(false);
                  };
                  return (
                    <div key={`s-${s.id}`} className="notif-item" onClick={() => openLink(s.link)}>
                      {s.banner_image && <img className="notif-item-img" src={s.banner_image} alt="" />}
                      <div className="notif-item-body">
                        <div className="notif-item-title">
                          {s.text_uk && lang === 'uk' ? s.text_uk : s.text_ru || '📺 Stream'}
                        </div>
                        <div className="notif-item-text">🕐 {timeStr}</div>
                      </div>
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
                {lang === 'uk' ? '📢 Всі сповіщення →' : '📢 Все уведомления →'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationsPanel;
