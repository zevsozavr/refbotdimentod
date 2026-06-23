import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const TRC20_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const Casino = () => {
  const { casinoId } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();
  const lang = user?.language || 'uk';
  const [casinoData, setCasinoData] = useState(null);
  const [casinoIdInput, setCasinoIdInput] = useState('');
  const [walletInput, setWalletInput] = useState('');
  const [idMsg, setIdMsg] = useState('');
  const [walletMsg, setWalletMsg] = useState('');
  const [pendingChanges, setPendingChanges] = useState([]);
  const [savingId, setSavingId] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);

  const walletColumn = casinoId === 'topmatch' ? 'wallet_topmatch' : 'wallet_tonplay';
  const idColumn = casinoId === 'topmatch' ? 'casino_id_topmatch' : 'casino_id_tonplay';

  const fetchData = useCallback(() => {
    api.get(`/casino/${casinoId}/me`).then(res => setCasinoData(res.data));
    api.get('/user/pending-changes').then(res => setPendingChanges(res.data));
  }, [casinoId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getPendingStatus = (field) => {
    const pc = pendingChanges.find(p => p.field === field);
    if (!pc) return null;
    return pc.status === 'pending' ? 'pending' : pc.status;
  };

  const submitCasinoId = async () => {
    setSavingId(true);
    setIdMsg('');
    try {
      await api.post(`/casino/${casinoId}/submit-id`, {
        casino_account_id: casinoIdInput.trim(),
      });
      setCasinoIdInput('');
      setIdMsg(lang === 'uk'
        ? '✅ Запит на зміну ID надіслано адміністратору'
        : '✅ Запрос на изменение ID отправлен администратору');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || (lang === 'uk' ? '❌ Помилка' : '❌ Ошибка');
      setIdMsg(msg);
    } finally {
      setSavingId(false);
    }
    setTimeout(() => setIdMsg(''), 4000);
  };

  const submitWallet = async () => {
    if (walletInput && !TRC20_REGEX.test(walletInput)) {
      setWalletMsg(lang === 'uk' ? '❌ Невірна TRC20 адреса' : '❌ Неверный TRC20 адрес');
      setTimeout(() => setWalletMsg(''), 3000);
      return;
    }
    setSavingWallet(true);
    setWalletMsg('');
    try {
      await api.post(`/wallet/${casinoId}/submit`, {
        casino: casinoId,
        wallet_address: walletInput,
      });
      setWalletInput('');
      setWalletMsg(lang === 'uk'
        ? '✅ Запит на зміну гаманця надіслано адміністратору'
        : '✅ Запрос на изменение кошелька отправлен администратору');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message
        || err.response?.data?.error
        || (lang === 'uk' ? '❌ Помилка' : '❌ Ошибка');
      setWalletMsg(msg);
    } finally {
      setSavingWallet(false);
    }
    setTimeout(() => setWalletMsg(''), 4000);
  };

  const currentWallet = user?.[walletColumn];
  const walletPending = getPendingStatus(walletColumn);
  const idPending = getPendingStatus(idColumn);

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

      <div className="wallet-card">
        <div className="wallet-card-header">
          <div className="wallet-card-icon">👤</div>
          <div>
            <div className="wallet-card-title">{lang === 'uk' ? 'ID в казино' : 'ID в казино'}</div>
            {casinoData.casino_account_id ? (
              <div className="wallet-card-value">
                <span className="wallet-current-label">{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span className="wallet-current-id">{casinoData.casino_account_id}</span>
                {idPending === 'pending' && <span className="wallet-pending-badge">{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <div className="wallet-card-value">
                <span className="wallet-not-set">{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
              </div>
            )}
          </div>
        </div>
        <input
          className="input"
          placeholder={lang === 'uk' ? 'Введіть новий ID' : 'Введите новый ID'}
          value={casinoIdInput}
          onChange={e => setCasinoIdInput(e.target.value)}
          maxLength={32}
          disabled={idPending === 'pending'}
        />
        <button
          className="btn btn-primary btn-sm wallet-btn"
          onClick={submitCasinoId}
          disabled={!casinoIdInput.trim() || savingId || idPending === 'pending'}
        >
          {idPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingId ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
        </button>
        {idPending === 'pending' && <p className="wallet-card-msg" style={{ color: 'var(--warning)' }}>{lang === 'uk' ? '⏳ Запит на зміну очікує підтвердження адміністратора' : '⏳ Запрос на изменение ожидает подтверждения администратора'}</p>}
        {idMsg && <p className="wallet-card-msg">{idMsg}</p>}
      </div>

      <div className="wallet-card">
        <div className="wallet-card-header">
          <div className="wallet-card-icon">💰</div>
          <div>
            <div className="wallet-card-title">TRC20 USDT {lang === 'uk' ? 'Гаманець' : 'Кошелек'}</div>
            {currentWallet ? (
              <div className="wallet-card-value">
                <span className="wallet-current-label">{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span className="wallet-current-id wallet-address">{currentWallet}</span>
                {walletPending === 'pending' && <span className="wallet-pending-badge">{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <div className="wallet-card-value">
                <span className="wallet-not-set">{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
              </div>
            )}
          </div>
        </div>
        <input
          className="input"
          placeholder={lang === 'uk' ? 'Введіть TRC20 адресу' : 'Введите TRC20 адрес'}
          value={walletInput}
          onChange={e => setWalletInput(e.target.value)}
          style={{ fontFamily: 'monospace' }}
          disabled={walletPending === 'pending'}
        />
        <button
          className="btn btn-primary btn-sm wallet-btn"
          onClick={submitWallet}
          disabled={!walletInput.trim() || savingWallet || walletPending === 'pending'}
        >
          {walletPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingWallet ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
        </button>
        {walletPending === 'pending' && <p className="wallet-card-msg" style={{ color: 'var(--warning)' }}>{lang === 'uk' ? '⏳ Запит на зміну очікує підтвердження адміністратора' : '⏳ Запрос на изменение ожидает подтверждения администратора'}</p>}
        <p className="wallet-card-note">
          {lang === 'uk'
            ? 'Адміністратор підтвердить зміни перед застосуванням'
            : 'Администратор подтвердит изменения перед применением'}
        </p>
        {walletMsg && <p className="wallet-card-msg">{walletMsg}</p>}
      </div>

      <button
        className={`btn btn-block btn-${casinoId}`}
        onClick={() => navigate(`/contests?casino=${casinoId}`)}
      >
        🏆 {lang === 'uk' ? 'Конкурси' : 'Конкурсы'}
      </button>
      <p className="contest-note">
        💰 {lang === 'uk'
          ? 'Для участі в конкурсах потрібен TRC20 USDT гаманець'
          : 'Для участия в конкурсах требуется TRC20 USDT кошелек'}
      </p>
    </div>
  );
};

export default Casino;
