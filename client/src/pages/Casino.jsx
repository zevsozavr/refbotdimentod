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
    const hero = document.querySelector('.casino-hero-img');
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
      <div className={`casino-hero ${casinoId}`} style={{ minHeight: 240, borderRadius: '0 0 24px 24px', overflow: 'hidden', position: 'relative' }}>
        <button className="back-btn" onClick={() => navigate('/')} style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 10, background: 'rgba(5,15,28,0.5)', backdropFilter: 'blur(6px)', border: '1px solid rgba(195,198,211,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', color: '#fff' }}>
          <span className="emoji-icon" style={{ fontSize: 16, lineHeight: 1, filter: 'none' }}>◀</span>
        </button>
        <img className="casino-hero-img" src={`/photos/${casinoId}.jpg`} alt={casinoId} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        <div className="casino-hero-overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(9,20,33,0.9) 85%, var(--surface-dim) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px 20px' }}>
          <span className="casino-hero-title metallic-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{casinoId === 'topmatch' ? 'TopMatch' : 'TonPlay'}</span>
          {casinoData?.level ? (
            <span className={`level-badge ${casinoId}`} style={{ alignSelf: 'flex-start', margin: 0 }}>
              {`LEVEL ${casinoData.level}`}
            </span>
          ) : (
            <span className="level-badge none" style={{ alignSelf: 'flex-start', margin: 0 }}>
              NO LEVEL
            </span>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ margin: '16px 16px 0', padding: '16px', textAlign: 'center' }}>
        <p style={{ marginBottom: 12, fontSize: 14, color: 'var(--on-surface-variant)' }}>
          <span className="emoji-icon" style={{ marginRight: 6 }}>🔗</span>
          {lang === 'uk' ? 'Реферальне посилання' : 'Реферальная ссылка'}
        </p>
        <button className={`btn btn-block btn-${casinoId}`} onClick={() => {
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

      <div className="glass-panel stagger-item" style={{ margin: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="emoji-icon" style={{ fontSize: 24 }}>👤</div>
          <div>
            <div className="wallet-card-title" style={{ fontWeight: 700, fontSize: 16 }}>{lang === 'uk' ? 'ID в казино' : 'ID в казино'}</div>
            {casinoData.casino_account_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span className="wallet-current-id" style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace' }}>{casinoData.casino_account_id}</span>
                {idPending === 'pending' && <span className="wallet-pending-badge">{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
            )}
          </div>
        </div>
        <input
          className="glass-input"
          placeholder={lang === 'uk' ? 'Введіть новий ID' : 'Введите новый ID'}
          value={casinoIdInput}
          onChange={e => setCasinoIdInput(e.target.value)}
          maxLength={32}
          disabled={idPending === 'pending'}
        />
        <button
          className="btn btn-primary btn-sm wallet-btn"
          style={{ marginTop: 10 }}
          onClick={submitCasinoId}
          disabled={!casinoIdInput.trim() || savingId || idPending === 'pending'}
        >
          {idPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingId ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
        </button>
        {idPending === 'pending' && <p className="wallet-card-msg" style={{ color: 'var(--warning)' }}><span className="emoji-icon">⌛</span> {lang === 'uk' ? 'Запит на зміну очікує підтвердження адміністратора' : 'Запрос на изменение ожидает подтверждения администратора'}</p>}
        {idMsg && <p className="wallet-card-msg">{idMsgType === 'success' ? <span className="emoji-icon">✅</span> : <span className="emoji-icon">❌</span>} {idMsg}</p>}
      </div>

      <div className="glass-panel stagger-item" style={{ margin: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="emoji-icon" style={{ fontSize: 24 }}>💰</div>
          <div>
            <div className="wallet-card-title" style={{ fontWeight: 700, fontSize: 16 }}>TRC20 USDT {lang === 'uk' ? 'Гаманець' : 'Кошелек'}</div>
            {currentWallet ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span className="wallet-current-id wallet-address" style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace' }}>{currentWallet}</span>
                {walletPending === 'pending' && <span className="wallet-pending-badge">{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
            )}
          </div>
        </div>
        <input
          className="glass-input"
          placeholder={lang === 'uk' ? 'Введіть TRC20 адресу' : 'Введите TRC20 адрес'}
          value={walletInput}
          onChange={e => setWalletInput(e.target.value)}
          style={{ fontFamily: 'monospace' }}
          disabled={walletPending === 'pending'}
        />
        <button
          className="btn btn-primary btn-sm wallet-btn"
          style={{ marginTop: 10 }}
          onClick={submitWallet}
          disabled={!walletInput.trim() || savingWallet || walletPending === 'pending'}
        >
          {walletPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingWallet ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
        </button>
        {walletPending === 'pending' && <p className="wallet-card-msg" style={{ color: 'var(--warning)' }}><span className="emoji-icon">⌛</span> {lang === 'uk' ? 'Запит на зміну очікує підтвердження адміністратора' : 'Запрос на изменение ожидает подтверждения администратора'}</p>}
        <p className="wallet-card-note" style={{ marginTop: 12, fontSize: 12, color: 'var(--on-surface-variant)', textAlign: 'center' }}>
          {lang === 'uk'
            ? 'Адміністратор підтвердить зміни перед застосуванням'
            : 'Администратор подтвердит изменения перед применением'}
        </p>
        {walletMsg && <p className="wallet-card-msg">{walletMsgType === 'success' ? <span className="emoji-icon">✅</span> : <span className="emoji-icon">❌</span>} {walletMsg}</p>}
      </div>

      <button
        className="btn btn-block btn-secondary"
        style={{ margin: '16px 16px 80px' }}
        onClick={() => navigate(`/contests?casino=${casinoId}`)}
      >
        <span className="emoji-icon">🏆</span> {lang === 'uk' ? 'Конкурси' : 'Конкурсы'}
      </button>
      <p className="contest-note" style={{ fontSize: 12, color: 'var(--on-surface-variant)', textAlign: 'center', margin: '-64px 16px 80px' }}>
        <span className="emoji-icon">💰</span> {lang === 'uk'
          ? 'Для участі в конкурсах потрібен TRC20 USDT гаманець'
          : 'Для участия в конкурсах требуется TRC20 USDT кошелек'}
      </p>
    </div>
  );
};

export default Casino;
