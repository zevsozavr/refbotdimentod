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
      <div className="home-header">
        <h1 className="page-title">
          {lang === 'uk' ? 'Головна' : 'Главная'}
        </h1>
        <div className="bell-wrapper" style={{ position: 'relative' }}>
          <button className="bell-btn" onClick={() => setShowNotifications(!showNotifications)}>
            🔔
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
          <div key={casino.id} className={`casino-card ${casino.id}`} onClick={() => navigate(`/casino/${casino.id}`)}>
            <div className="casino-card-coin">🪙</div>
            <div className="casino-card-glow" />
            <img className="casino-card-bg" src={casino.photo} alt={casino.id} />
            <div className="casino-card-overlay">
              <span className="casino-card-name">{lang === 'uk' ? casino.name_uk : casino.name_ru}</span>
              <div className="casino-card-actions">
                {levels[casino.id] ? (
                  <div className="level-badge-wrapper">
                    <div className={`level-pulse-ring ${casino.id}`} />
                    <span className={`level-badge ${casino.id}`}>
                      {`${lang === 'uk' ? 'Рівень' : 'Уровень'} ${levels[casino.id]}`}
                    </span>
                  </div>
                ) : (
                  <span className="level-badge none">
                    {lang === 'uk' ? 'Без рівня' : 'Без уровня'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
