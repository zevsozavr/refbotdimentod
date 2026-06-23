import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../axios';

const Announces = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [announces, setAnnounces] = useState([]);
  const [loading, setLoading] = useState(true);
  const lang = i18n.language === 'uk' ? 'uk' : 'ru';

  useEffect(() => {
    api.get('/announcements').then(res => setAnnounces(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1 className="page-title" style={{ margin: 0 }}>{t('nav.announces')}</h1>
      </div>
      {announces.length === 0 ? (
        <p className="text-secondary">{t('announces.empty') || (lang === 'uk' ? 'Немає оголошень' : 'Нет объявлений')}</p>
      ) : (
        announces.map(a => (
          <div key={a.id} className="announce-card">
            {a.banner_image && <img className="announce-banner" src={a.banner_image} alt="" />}
            <div className="announce-title">{lang === 'uk' ? a.title_uk : a.title_ru}</div>
            {(lang === 'uk' ? a.text_uk : a.text_ru) && <div className="announce-text">{lang === 'uk' ? a.text_uk : a.text_ru}</div>}
            <div className="announce-date">{new Date(a.created_at).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default Announces;
