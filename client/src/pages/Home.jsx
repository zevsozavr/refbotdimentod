import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Home = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [casinos, setCasinos] = useState([]);
  const [levels, setLevels] = useState({});
  const [feed, setFeed] = useState([]);
  const lang = user?.language || 'uk';

  useEffect(() => {
    api.get('/casinos').then(res => {
      setCasinos(res.data);
      res.data.forEach(casino => {
        api.get(`/casino/${casino.id}/me`).then(r => {
          setLevels(prev => ({ ...prev, [casino.id]: r.data.level }));
        });
      });
    });
    api.get('/announcements').then(res => setFeed(res.data.slice(0, 4))).catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          {lang === 'uk' ? 'Головна' : 'Главная'}
        </h1>
      </div>

      {feed.length > 0 && (
        <div className="dashboard-section">
          <div className="section-header">
            <span>{lang === 'uk' ? '📢 Останні події' : '📢 Последние события'}</span>
            <button className="section-link" onClick={() => navigate('/announces')}>
              {lang === 'uk' ? 'Всі' : 'Все'} →
            </button>
          </div>
          {feed.map(item => (
            item.type === 'stream' ? (
              <div key={`s-${item.id}`} className="dashboard-announce" onClick={() => window.open(item.link, '_blank')}>
                {item.banner_image && <img className="dash-announce-banner" src={item.banner_image} alt="" />}
                <div className="dash-announce-body">
                  <div className="dash-announce-title">📺 {lang === 'uk' ? item.text_uk || 'Стрім' : item.text_ru || 'Стрим'}</div>
                  <div className="dash-announce-text">🕐 {new Date(item.start_time).toLocaleString([], { timeZone: 'Europe/Kyiv' })}</div>
                </div>
              </div>
            ) : (
              <div key={`a-${item.id}`} className="dashboard-announce" onClick={() => navigate('/announces')}>
                {item.banner_image && <img className="dash-announce-banner" src={item.banner_image} alt="" />}
                <div className="dash-announce-body">
                  <div className="dash-announce-title">{lang === 'uk' ? item.title_uk : item.title_ru}</div>
                  <div className="dash-announce-text">{(lang === 'uk' ? item.text_uk : item.text_ru || '').slice(0, 80)}</div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <div className="dashboard-section">
        <div className="section-header">
          <span>{lang === 'uk' ? '🎰 Казино' : '🎰 Казино'}</span>
        </div>
        <div className="casino-list">
          {casinos.map(casino => (
            <div key={casino.id} className={`casino-card ${casino.id}`} onClick={() => navigate(`/casino/${casino.id}`)}>
              <img className="casino-card-bg" src={casino.photo} alt={casino.id} />
              <div className="casino-card-overlay">
                <span className="casino-card-name">{lang === 'uk' ? casino.name_uk : casino.name_ru}</span>
                <div className="casino-card-actions">
                  <span className={`level-badge ${levels[casino.id] ? casino.id : 'none'}`}>
                    {levels[casino.id] ? `${lang === 'uk' ? 'Рівень' : 'Уровень'} ${levels[casino.id]}` : (lang === 'uk' ? 'Без рівня' : 'Без уровня')}
                  </span>
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
