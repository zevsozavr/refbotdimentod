import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import { useApp } from '../contexts/AppContext';
import useStaggeredEntrance from '../hooks/useStaggeredEntrance';

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
  const [idMsgType, setIdMsgType] = useState('');
  const [walletMsg, setWalletMsg] = useState('');
  const [walletMsgType, setWalletMsgType] = useState('');
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

  useStaggeredEntrance('.wallet-card, .referral-card, .btn-block', 80);

  useEffect(() => {
    const hero = document.querySelector('.casino-hero-bg');
    if (!hero) return;
    const handleScroll = () => {
      hero.style.transform = `translateY(${window.scrollY * 0.3}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getPendingStatus = (field) => {
    const pc = pendingChanges.find(p => p.field === field);
    if (!pc) return null;
    return pc.status === 'pending' ? 'pending' : pc.status;
  };

  const submitCasinoId = async () => {
    setSavingId(true);
    setIdMsg('');
    setIdMsgType('');
    try {
      await api.post(`/casino/${casinoId}/submit-id`, {
        casino_account_id: casinoIdInput.trim(),
      });
      setCasinoIdInput('');
      setIdMsg(lang === 'uk'
        ? 'Запит на зміну ID надіслано адміністратору'
        : 'Запрос на изменение ID отправлен администратору');
      setIdMsgType('success');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || (lang === 'uk' ? 'Помилка' : 'Ошибка');
      setIdMsg(msg);
      setIdMsgType('error');
    } finally {
      setSavingId(false);
    }
    setTimeout(() => { setIdMsg(''); setIdMsgType(''); }, 4000);
  };

  const submitWallet = async () => {
    if (walletInput && !TRC20_REGEX.test(walletInput)) {
      setWalletMsg(lang === 'uk' ? 'Невірна TRC20 адреса' : 'Неверный TRC20 адрес');
      setWalletMsgType('error');
      setTimeout(() => { setWalletMsg(''); setWalletMsgType(''); }, 3000);
      return;
    }
    setSavingWallet(true);
    setWalletMsg('');
    setWalletMsgType('');
    try {
      await api.post(`/casino/${casinoId}/submit-wallet`, {
        wallet_address: walletInput,
      });
      setWalletInput('');
      setWalletMsg(lang === 'uk'
        ? 'Запит на зміну гаманця надіслано адміністратору'
        : 'Запрос на изменение кошелька отправлен администратору');
      setWalletMsgType('success');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message
        || err.response?.data?.error
        || (lang === 'uk' ? 'Помилка' : 'Ошибка');
      setWalletMsg(msg);
      setWalletMsgType('error');
    } finally {
      setSavingWallet(false);
    }
    setTimeout(() => { setWalletMsg(''); setWalletMsgType(''); }, 4000);
  };

  const currentWallet = user?.[walletColumn];
  const walletPending = getPendingStatus(walletColumn);
  const idPending = getPendingStatus(idColumn);

  if (!casinoData) return <div className="loading">{lang === 'uk' ? 'Завантаження...' : 'Загрузка...'}</div>;

  return (
    <div className="page">
      <div className={`casino-hero ${casinoId} hover-lift`} style={{ minHeight: 240, borderRadius: '0 0 24px 24px', overflow: 'hidden', position: 'relative' }}>
        <button onClick={() => navigate('/')} className="hero-back-btn" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div className={`casino-hero-bg casino-bg-${casinoId}`} style={{ position: 'absolute', inset: 0 }} />
        <div className="casino-hero-overlay">
          {casinoData?.level ? (
            <span className={`level-badge ${casinoId} badge-pulse`}>
              {`LEVEL ${casinoData.level}`}
            </span>
          ) : (
            <span className="level-badge none">
              {lang === 'uk' ? 'Немає рівня' : 'Нет уровня'}
            </span>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ margin: '20px 20px 0', padding: '20px', textAlign: 'center' }}>
        <p style={{ marginBottom: 16, fontSize: 15, color: 'var(--on-surface-variant)' }}>
          <span className="emoji-icon" style={{ marginRight: 8 }}>🔗</span>
          {lang === 'uk' ? 'Реферальне посилання' : 'Реферальная ссылка'}
        </p>
        <button className={`btn btn-block btn-${casinoId} btn-hover-lift`} onClick={() => {
          let link = casinoData?.referral_link;
          if (!link) return;
          if (!link.startsWith('http://') && !link.startsWith('https://')) link = 'https://' + link;
          if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(link);
          } else {
            window.open(link, '_blank', 'noopener,noreferrer');
          }
        }}>
          <span className="emoji-icon">🎰</span> {lang === 'uk' ? 'Відкрити казино' : 'Открыть казино'}
        </button>
      </div>

      <div className="glass-panel stagger-item" style={{ margin: '16px 20px 0', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div className="info-icon">
            <span className="emoji-icon" style={{ fontSize: 24 }}>👤</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{lang === 'uk' ? 'ID в казино' : 'ID в казино'}</div>
            {casinoData.casino_account_id ? (
              <div className="info-content" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                <span className="info-label">{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span className="info-value wallet-address">{casinoData.casino_account_id}</span>
                {idPending === 'pending' && <span className="status-badge status-pending">{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <span className="info-placeholder">{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
            )}
          </div>
        </div>
        
        <div className="input-group" style={{ marginTop: 16 }}>
          <input
            className="glass-input input-enhanced"
            placeholder={lang === 'uk' ? 'Новий ID' : 'Новый ID'}
            value={casinoIdInput}
            onChange={e => setCasinoIdInput(e.target.value)}
            maxLength={32}
            disabled={idPending === 'pending'}
          />
          <div className="button-group">
            <button
              className="btn btn-primary btn-enhanced btn-hover-lift"
              onClick={submitCasinoId}
              disabled={!casinoIdInput.trim() || savingId || idPending === 'pending'}
            >
              {idPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingId ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
            </button>
          </div>
        </div>
        
        {idPending === 'pending' && <p className="status-message status-pending">{lang === 'uk' ? 'Запит на зміну очікує підтвердження адміністратора' : 'Запрос на изменение ожидает подтверждения администратора'}</p>}
        
        {idMsg && <p className={`status-message status-${idMsgType}`}>{idMsgType === 'success' ? <span className="emoji-icon" style={{ fontSize: 14, marginRight: 6 }}>✅</span> : <span className="emoji-icon" style={{ fontSize: 14, marginRight: 6 }}>❌</span>}{idMsg}</p>}
      </div>

      <div className="glass-panel stagger-item" style={{ margin: '16px 20px 0', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div className="info-icon">
            <span className="emoji-icon" style={{ fontSize: 24 }}>💰</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>TRC20 USDT {lang === 'uk' ? 'Гаманець' : 'Кошелек'}</div>
            {currentWallet ? (
              <div className="info-content" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                <span className="info-label">{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span className="info-value wallet-address">{currentWallet}</span>
                {walletPending === 'pending' && <span className="status-badge status-pending">{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <span className="info-placeholder">{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
            )}
          </div>
        </div>
        
        <div className="input-group" style={{ marginTop: 16 }}>
          <input
            className="glass-input input-enhanced"
            placeholder={lang === 'uk' ? 'TRC20 адреса' : 'TRC20 адрес'}
            value={walletInput}
            onChange={e => setWalletInput(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 10, fontFamily: 'monospace' }}
            disabled={walletPending === 'pending'}
          />
          <div className="button-group">
            <button
              className="btn btn-primary btn-enhanced btn-hover-lift"
              onClick={submitWallet}
              disabled={!walletInput.trim() || savingWallet || walletPending === 'pending'}
            >
              {walletPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingWallet ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
            </button>
          </div>
        </div>
        
        {walletPending === 'pending' && <p className="status-message status-pending">{lang === 'uk' ? 'Запит на зміну очікує підтвердження адміністратора' : 'Запрос на изменение ожидает подтверждения администратора'}</p>}
        
        {walletMsg && <p className={`status-message status-${walletMsgType}`}>{walletMsgType === 'success' ? <span className="emoji-icon" style={{ fontSize: 14, marginRight: 6 }}>✅</span> : <span className="emoji-icon" style={{ fontSize: 14, marginRight: 6 }}>❌</span>}{walletMsg}</p>}
        
        <p className="help-text">{lang === 'uk'
          ? 'Адміністратор підтвердить зміни перед застосуванням'
          : 'Администратор подтвердит изменения перед применением'}
        </p>
      </div>

      <div className="action-section">
        <button
          className="btn btn-block btn-secondary btn-hover-lift"
          onClick={() => navigate(`/contests?casino=${casinoId}`)}
        >
          <span className="emoji-icon">🏆</span> {lang === 'uk' ? 'Конкурси' : 'Конкурсы'}
        </button>
        <p className="help-text">
          <span className="emoji-icon">💰</span> {lang === 'uk'
            ? 'Для участі в конкурсах потрібен TRC20 USDT гаманець'
            : 'Для участия в конкурсах требуется TRC20 USDT кошелек'}
        </p>
      </div>
    </div>
  );
};

export default Casino;