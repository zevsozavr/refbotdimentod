import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';
import NotificationDropdown from '../components/NotificationDropdown';
import useStaggeredEntrance from '../hooks/useStaggeredEntrance';

const Home = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [casinos, setCasinos] = useState([]);
  const [levels, setLevels] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const lang = user?.language || 'uk';

  useStaggeredEntrance('.casino-card', 120);

  useEffect(() => {
    api.get('/casinos').then(res => {
      setCasinos(res.data);
      res.data.forEach(casino => {
        api.get(`/casino/${casino.id}/me`).then(r => {
          setLevels(prev => ({ ...prev, [casino.id]: r.data.level }));
        });
      });
    });
  }, []);

  useEffect(() => {
    api.get('/notifications').then(res => {
      setUnreadCount(res.data.unread_count || 0);
    });
  }, []);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ fontSize: 24, marginBottom: 0 }}>
          {lang === 'uk' ? 'Головна' : 'Главная'}
        </h1>
        <div className="bell-wrapper" style={{ position: 'relative' }}>
          <button className="bell-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <span className="emoji-icon">🔔</span>
            {unreadCount > 0 && (
              <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <NotificationDropdown onClose={() => {
              setShowNotifications(false);
              setUnreadCount(0);
            }} />
          )}
        </div>
      </div>

      <div className="casino-list">
        {casinos.map(casino => (
          <div key={casino.id} className={`casino-card ${casino.id} ${casino.id === 'topmatch' ? 'banner-float' : 'banner-float-delayed'}`} onClick={() => navigate(`/casino/${casino.id}`)}>
            <div className="casino-card-glow" />
            <img className="casino-card-bg" src={casino.photo} alt={casino.id} />
            <div className="casino-card-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(9,20,33,0.45)', textAlign: 'center' }}>
              <span className="casino-card-name" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{lang === 'uk' ? casino.name_uk : casino.name_ru}</span>
              {levels[casino.id] != null ? (
                <span className={`level-badge ${casino.id}`} style={{ fontSize: 12, padding: '3px 14px', marginTop: 8 }}>
                  {lang === 'uk' ? 'Рівень' : 'Уровень'} {levels[casino.id]}
                </span>
              ) : (
                <span className="level-badge none" style={{ fontSize: 12, padding: '3px 14px', marginTop: 8, background: 'rgba(195,198,211,0.12)', color: 'var(--on-surface-variant)' }}>
                  {lang === 'uk' ? 'Немає рівня' : 'Нет уровня'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
