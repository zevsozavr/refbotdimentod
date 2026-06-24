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
      <div className={`casino-hero ${casinoId}`} style={{ minHeight: 220, borderRadius: '0 0 24px 24px', overflow: 'hidden', position: 'relative' }}>
        <button className="back-btn" onClick={() => navigate('/')} style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 10, background: 'rgba(5,15,28,0.5)', backdropFilter: 'blur(6px)', border: '1px solid rgba(195,198,211,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', color: '#fff' }}>
          <span className="emoji-icon" style={{ fontSize: 16, lineHeight: 1, filter: 'none' }}>◀</span>
        </button>
        <img className="casino-hero-img" src={`/photos/${casinoId}.${casinoId === 'topmatch' ? 'png' : 'jpg'}`} alt={casinoId} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        <div className="casino-hero-overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(9,20,33,0.9) 85%, var(--surface-dim) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px 20px' }}>
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

      <div className="glass-panel stagger-item" style={{ margin: '12px 16px 0', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(195,198,211,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            <span className="emoji-icon" style={{ filter: 'none' }}>👤</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{lang === 'uk' ? 'ID в казино' : 'ID в казино'}</div>
            {casinoData.casino_account_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: 'var(--tertiary)' }}>{casinoData.casino_account_id}</span>
                {idPending === 'pending' && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(233,195,73,0.15)', color: '#e9c349' }}>{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="glass-input"
            placeholder={lang === 'uk' ? 'Новий ID' : 'Новый ID'}
            value={casinoIdInput}
            onChange={e => setCasinoIdInput(e.target.value)}
            maxLength={32}
            disabled={idPending === 'pending'}
            style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 10 }}
          />
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '10px 18px', fontSize: 13, borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={submitCasinoId}
            disabled={!casinoIdInput.trim() || savingId || idPending === 'pending'}
          >
            {idPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingId ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
          </button>
        </div>
        {idPending === 'pending' && <p style={{ fontSize: 12, color: '#e9c349', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><span className="emoji-icon" style={{ fontSize: 12 }}>⌛</span> {lang === 'uk' ? 'Запит на зміну очікує підтвердження адміністратора' : 'Запрос на изменение ожидает подтверждения администратора'}</p>}
        {idMsg && <p style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, color: idMsgType === 'success' ? 'var(--tertiary)' : 'var(--error)' }}>{idMsgType === 'success' ? <span className="emoji-icon" style={{ fontSize: 12 }}>✅</span> : <span className="emoji-icon" style={{ fontSize: 12 }}>❌</span>} {idMsg}</p>}
      </div>

      <div className="glass-panel stagger-item" style={{ margin: '12px 16px 0', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(195,198,211,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            <span className="emoji-icon" style={{ filter: 'none' }}>💰</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>TRC20 USDT {lang === 'uk' ? 'Гаманець' : 'Кошелек'}</div>
            {currentWallet ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Поточний:' : 'Текущий:'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'var(--tertiary)', wordBreak: 'break-all' }}>{currentWallet}</span>
                {walletPending === 'pending' && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(233,195,73,0.15)', color: '#e9c349' }}>{lang === 'uk' ? 'Очікує' : 'Ожидает'}</span>}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{lang === 'uk' ? 'Не вказано' : 'Не указан'}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="glass-input"
            placeholder={lang === 'uk' ? 'TRC20 адреса' : 'TRC20 адрес'}
            value={walletInput}
            onChange={e => setWalletInput(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 10, fontFamily: 'monospace' }}
            disabled={walletPending === 'pending'}
          />
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '10px 18px', fontSize: 13, borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={submitWallet}
            disabled={!walletInput.trim() || savingWallet || walletPending === 'pending'}
          >
            {walletPending === 'pending' ? (lang === 'uk' ? 'Очікує...' : 'Ожидает...') : (savingWallet ? '⋯' : (lang === 'uk' ? 'Надіслати' : 'Отправить'))}
          </button>
        </div>
        {walletPending === 'pending' && <p style={{ fontSize: 12, color: '#e9c349', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><span className="emoji-icon" style={{ fontSize: 12 }}>⌛</span> {lang === 'uk' ? 'Запит на зміну очікує підтвердження адміністратора' : 'Запрос на изменение ожидает подтверждения администратора'}</p>}
        {walletMsg && <p style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, color: walletMsgType === 'success' ? 'var(--tertiary)' : 'var(--error)' }}>{walletMsgType === 'success' ? <span className="emoji-icon" style={{ fontSize: 12 }}>✅</span> : <span className="emoji-icon" style={{ fontSize: 12 }}>❌</span>} {walletMsg}</p>}
        <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: 10, opacity: 0.7 }}>
          {lang === 'uk'
            ? 'Адміністратор підтвердить зміни перед застосуванням'
            : 'Администратор подтвердит изменения перед применением'}
        </p>
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
