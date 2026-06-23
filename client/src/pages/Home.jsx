import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Home = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [casinos, setCasinos] = useState([]);
  const [levels, setLevels] = useState({});
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
  }, []);

  return (
    <div className="home-page">
      <h1>{lang === 'uk' ? 'Головна' : 'Главная'}</h1>
      <div className="casino-list">
        {casinos.map(casino => (
          <div key={casino.id} className="casino-card" onClick={() => navigate(`/casino/${casino.id}`)}>
            <img src={casino.photo} alt={casino.name_uk} className="casino-photo" />
            <div className="casino-info">
              <h2>{lang === 'uk' ? casino.name_uk : casino.name_ru}</h2>
              <span className="level-badge">
                {levels[casino.id]
                  ? `${lang === 'uk' ? 'Рівень' : 'Уровень'} ${levels[casino.id]}`
                  : lang === 'uk' ? 'Без рівня' : 'Без уровня'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;