import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Casino = () => {
  const { casinoId } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();
  const [casinoData, setCasinoData] = useState(null);
  const [contests, setContests] = useState([]);
  const [casinoIdInput, setCasinoIdInput] = useState('');
  const [idSubmitMsg, setIdSubmitMsg] = useState('');
  const lang = user?.language || 'uk';

  useEffect(() => {
    api.get(`/casino/${casinoId}/me`).then(res => setCasinoData(res.data));
    api.get(`/contests?casino=${casinoId}`).then(res => setContests(res.data)).catch(() => setContests([]));
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
    <div className="casino-page">
      <button className="back-btn" onClick={() => navigate('/')}>←</button>
      <img src={`/photos/${casinoId}.jpg`} alt={casinoId} className="casino-header-photo" />

      <div className="level-section">
        <span className="level-badge">
          {casinoData.level
            ? `${lang === 'uk' ? 'Рівень' : 'Уровень'} ${casinoData.level}`
            : lang === 'uk' ? 'Без рівня' : 'Без уровня'}
        </span>
      </div>

      <div className="referral-card">
        <p className="referral-label">{lang === 'uk' ? 'Реферальне посилання' : 'Реферальная ссылка'}</p>
        <a
          href={casinoData.referral_link}
          target="_blank"
          rel="noopener noreferrer"
          className="referral-link-btn"
        >
          {lang === 'uk' ? '🎰 Відкрити казино' : '🎰 Открыть казино'}
        </a>
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
          className="casino-id-submit-btn"
          onClick={submitCasinoId}
          disabled={!casinoIdInput.trim()}
        >
          {lang === 'uk' ? 'Підтвердити ID' : 'Подтвердить ID'}
        </button>
        {idSubmitMsg && <p className="casino-id-msg">{idSubmitMsg}</p>}
      </div>

      <div className="contests-section">
        <div className="contests-header">
          <h2>{lang === 'uk' ? 'Активні конкурси' : 'Активные конкурсы'}</h2>
          <button onClick={() => navigate(`/contests?casino=${casinoId}`)}>
            {lang === 'uk' ? 'Всі конкурси' : 'Все конкурсы'}
          </button>
        </div>
        {contests.length === 0
          ? <p>{lang === 'uk' ? 'Немає активних конкурсів' : 'Нет активных конкурсов'}</p>
          : contests.slice(0, 3).map(c => (
            <div key={c.id} className="contest-card">
              <h3>{c.title}</h3>
              <p>{c.prize}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Casino;