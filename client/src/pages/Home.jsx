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
      <header className="fixed top-0 w-full z-50" style={{ background: 'rgba(5,15,28,0.8)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(195,198,211,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: '64px', left: 0, right: 0, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(195,198,211,0.2)' }}>
            <span className="emoji-icon" style={{ fontSize: 18 }}>👤</span>
          </div>
          <h1 className="metallic-text" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>PRO REFERRAL</h1>
        </div>
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
      </header>

      <div style={{ paddingTop: '80px' }}>
        <h2 className="page-title" style={{ fontSize: 24, marginBottom: 20, textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
          {lang === 'uk' ? 'Головна' : 'Главная'}
        </h2>

        <div className="casino-list">
          {casinos.map(casino => (
            <div key={casino.id} className={`casino-card ${casino.id} ${casino.id === 'topmatch' ? 'banner-float' : 'banner-float-delayed'}`} onClick={() => navigate(`/casino/${casino.id}`)}>
              <div className="casino-card-glow" />
              <img className="casino-card-bg" src={casino.photo} alt={casino.id} />
              <div className="casino-card-overlay">
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                  {levels[casino.id] ? (
                    <span className={`level-badge ${casino.id} pulse-badge`}>
                      {`LEVEL ${levels[casino.id]}`}
                    </span>
                  ) : (
                    <span className="level-badge none">
                      NO LEVEL
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(22,32,46,0.6)', padding: '10px 16px', borderRadius: 12, backdropFilter: 'blur(8px)', marginTop: 'auto' }}>
                  <span className="casino-card-name">{lang === 'uk' ? casino.name_uk : casino.name_ru}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 18 }}>→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
