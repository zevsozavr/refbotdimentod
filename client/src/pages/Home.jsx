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
            <div className="casino-card-overlay" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', background: 'linear-gradient(transparent, rgba(9,20,33,0.85) 40%, rgba(9,20,33,0.95) 100%)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="casino-card-name" style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>{lang === 'uk' ? casino.name_uk : casino.name_ru}</span>
              {levels[casino.id] != null ? (
                <span className={`level-badge ${casino.id}`} style={{ fontSize: 11, padding: '2px 10px', marginLeft: 'auto' }}>
                  {lang === 'uk' ? 'Рівень' : 'Уровень'} {levels[casino.id]}
                </span>
              ) : (
                <span className="level-badge none" style={{ fontSize: 11, padding: '2px 10px', marginLeft: 'auto', background: 'rgba(195,198,211,0.1)', color: 'var(--on-surface-variant)' }}>
                  {lang === 'uk' ? 'Немає рівня' : 'Нет уровня'}
                </span>
              )}
              <span style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
