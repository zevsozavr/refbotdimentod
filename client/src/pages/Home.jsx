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
    <div className="page">
      <h1 className="page-title">{lang === 'uk' ? 'Головна' : 'Главная'}</h1>
      <div className="casino-list">
        {casinos.map(casino => (
          <div key={casino.id} className={`casino-card ${casino.id}`} onClick={() => navigate(`/casino/${casino.id}`)}>
            <img className="casino-card-bg" src={casino.photo} alt={casino.id} />
            <div className="casino-card-overlay">
              <span className="casino-card-name">{lang === 'uk' ? casino.name_uk : casino.name_ru}</span>
              <span className={`level-badge ${levels[casino.id] ? casino.id : 'none'}`}>
                {levels[casino.id] ? `${lang === 'uk' ? 'Рівень' : 'Уровень'} ${levels[casino.id]}` : (lang === 'uk' ? 'Без рівня' : 'Без уровня')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;