import React, { useEffect, useState, useRef } from 'react';
import api from '../axios';

const NotificationDropdown = ({ onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef();

  useEffect(() => {
    api.get('/notifications').then(res => {
      setItems(res.data.items || []);
      setLoading(false);
    });

    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const clearAll = async () => {
    await api.post('/notifications/clear');
    setItems([]);
    onClose();
  };

  return (
    <div className="notification-dropdown" ref={ref}>
      <div className="notification-dropdown-header">
        <span className="notification-dropdown-title"><span className="emoji-icon">🔔</span> Сповіщення</span>
        {items.length > 0 && (
          <button className="notification-clear-btn" onClick={clearAll}>
            Очистити
          </button>
        )}
      </div>
      {loading ? (
        <div className="notification-loading">Завантаження...</div>
      ) : items.length === 0 ? (
        <div className="notification-empty">Немає нових сповіщень</div>
      ) : (
        <div className="notification-list">
          {items.map(item => (
            <div key={`${item.type}-${item.id}`} className={`notification-item ${item.type}`}>
              <span className="notification-type-badge">
                {item.type === 'stream' ? <><span className="emoji-icon">🖥️</span> Стрім</> : <><span className="emoji-icon">📢</span> Оголошення</>}
              </span>
              <p className="notification-item-title">
                {item.type === 'stream'
                  ? (item.text_uk || item.text_ru || 'Stream')
                  : (item.title_uk || item.title_ru)}
              </p>
              {(item.text_uk || item.text_ru) && (
                <p className="notification-item-content">
                  {item.type === 'stream'
                    ? (item.text_uk || item.text_ru)
                    : (item.text_uk || item.text_ru)}
                </p>
              )}
              <span className="notification-item-date">
                {new Date(item.created_at).toLocaleString('uk-UA')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
