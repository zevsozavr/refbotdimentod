import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Casino = () => {
  const { casinoId } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();
  const [casinoData, setCasinoData] = useState(null);
  const [casinoIdInput, setCasinoIdInput] = useState('');
  const [idSubmitMsg, setIdSubmitMsg] = useState('');
  const lang = user?.language || 'uk';

  useEffect(() => {
    api.get(`/casino/${casinoId}/me`).then(res => setCasinoData(res.data));
  }, [casinoId]);

  const submitCasinoId = async () => {
    try {
      const res = await api.post(`/casino/${casinoId}/submit-id`, {
        casino_account_id: casinoIdInput.trim(),
      });
      setCasinoData(prev => ({ ...prev, casino_account_id: res.data.casino_account_id, level: res.data.level }));
      setCasinoIdInput('');
      setIdSubmitMsg(lang === 'uk' ? '✅ ID збережено!' : '✅ ID сохранён!');
      setTimeout(() => setIdSubmitMsg(''), 3000);
    } catch (err) {
      setIdSubmitMsg(lang === 'uk' ? '❌ Помилка. Перевірте ID.' : '❌ Ошибка. Проверьте ID.');
      setTimeout(() => setIdSubmitMsg(''), 3000);
    }
  };

  if (!casinoData) return <div className="loading">{lang === 'uk' ? 'Завантаження...' : 'Загрузка...'}</div>;

  return (
    <div className="page">
      <div className={`casino-hero ${casinoId}`}>
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <img className="casino-hero-img" src={`/photos/${casinoId}.jpg`} alt={casinoId} />
        <div className="casino-hero-overlay">
          <span className="casino-hero-title">{casinoId === 'topmatch' ? 'TopMatch' : 'TonPlay'}</span>
          <span className={`level-badge ${casinoData?.level ? casinoId : 'none'}`}>
            {casinoData?.level ? `${lang === 'uk' ? 'Рівень' : 'Уровень'} ${casinoData.level}` : (lang === 'uk' ? 'Без рівня' : 'Без уровня')}
          </span>
        </div>
      </div>

      <div className="referral-card">
        <p className="referral-label">{lang === 'uk' ? 'Реферальне посилання' : 'Реферальная ссылка'}</p>
        <button className={`btn btn-${casinoId}`} onClick={() => {
          let link = casinoData?.referral_link;
          if (!link) return;
          if (!link.startsWith('http://') && !link.startsWith('https://')) link = 'https://' + link;
          if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(link);
          } else {
            window.open(link, '_blank', 'noopener,noreferrer');
          }
        }}>
          🎰 {lang === 'uk' ? 'Відкрити казино' : 'Открыть казино'}
        </button>
      </div>

      <div className="casino-id-section">
        <p className="casino-id-label">{lang === 'uk' ? 'Ваш ID в казино' : 'Ваш ID в казино'}</p>
        {casinoData.casino_account_id && (
          <p className="casino-id-current">
            {lang === 'uk' ? 'Поточний ID:' : 'Текущий ID:'} <strong>{casinoData.casino_account_id}</strong>
          </p>
        )}
        <input
          type="text"
          className="casino-id-input"
          placeholder={lang === 'uk' ? 'Введіть ваш ID' : 'Введите ваш ID'}
          value={casinoIdInput}
          onChange={e => setCasinoIdInput(e.target.value)}
          maxLength={32}
        />
        <button
          className="btn btn-primary"
          onClick={submitCasinoId}
          disabled={!casinoIdInput.trim()}
        >
          {lang === 'uk' ? 'Підтвердити ID' : 'Подтвердить ID'}
        </button>
        {idSubmitMsg && <p className="casino-id-msg">{idSubmitMsg}</p>}
      </div>
    </div>
  );
};

export default Casino;