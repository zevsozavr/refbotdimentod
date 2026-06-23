import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../axios';

const Announces = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lang = i18n.language === 'uk' ? 'uk' : 'ru';

  const fetchItems = () => {
    setLoading(true);
    setError('');
    api.get('/announcements')
      .then(res => setItems(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  if (loading) return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1 className="page-title" style={{ margin: 0 }}>{t('nav.announces')}</h1>
      </div>

      {error ? (
        <div className="error-state">
          <p className="text-secondary" style={{ marginBottom: 8 }}>{error}</p>
          <button className="btn btn-primary btn-sm" onClick={fetchItems}>{t('common.retry') || 'Retry'}</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-secondary">{t('announces.empty') || (lang === 'uk' ? 'Немає оголошень' : 'Нет объявлений')}</p>
      ) : (
        items.map(item => (
          item.type === 'stream' ? (
            <div key={`s-${item.id}`} className="announce-card stream-card" onClick={() => { window.open(item.link, '_blank'); }}>
              {item.banner_image && <img className="announce-banner" src={item.banner_image} alt="" />}
              <div className="announce-type-badge">📺 {lang === 'uk' ? 'Стрім' : 'Стрим'}</div>
              <div className="announce-title">{lang === 'uk' ? item.text_uk : item.text_ru || 'Stream'}</div>
              {item.link && <div className="announce-text">🔗 {item.link}</div>}
              <div className="announce-date">🕐 {new Date(item.start_time).toLocaleString([], { timeZone: 'Europe/Kyiv' })}</div>
            </div>
          ) : (
            <div key={`a-${item.id}`} className="announce-card">
              {item.banner_image && <img className="announce-banner" src={item.banner_image} alt="" />}
              <div className="announce-type-badge announce-badge">📢 {lang === 'uk' ? 'Оголошення' : 'Объявление'}</div>
              <div className="announce-title">{lang === 'uk' ? item.title_uk : item.title_ru}</div>
              {(lang === 'uk' ? item.text_uk : item.text_ru) && <div className="announce-text">{lang === 'uk' ? item.text_uk : item.text_ru}</div>}
              <div className="announce-date">{new Date(item.created_at).toLocaleString()}</div>
            </div>
          )
        ))
      )}
    </div>
  );
};

export default Announces;
