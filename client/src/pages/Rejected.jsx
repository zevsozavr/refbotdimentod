import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../axios';
import { useApp } from '../contexts/AppContext';

const Rejected = () => {
  const { t } = useTranslation();
  const { setUser } = useApp();
  const [casino, setCasino] = useState('topmatch');
  const [casinoIdInput, setCasinoIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!casinoIdInput.trim()) return;

    setLoading(true);
    setMsg('');
    setErrorMsg('');

    try {
      await api.post(`/casino/${casino}/submit-id`, {
        casino_account_id: casinoIdInput.trim(),
      });
      
      setMsg(t('pending.waiting'));
      setTimeout(() => {
        setUser((prev) => ({ ...prev, status: 'pending' }));
      }, 1500);
    } catch (err) {
      const errorText = err.response?.data?.error || t('common.error');
      setErrorMsg(errorText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="status-screen">
      <div className="status-icon"><span className="emoji-icon">❌</span></div>
      <h1 className="page-title">{t('rejected.title')}</h1>
      <p className="text-secondary" style={{ marginBottom: 20 }}>{t('rejected.description')}</p>
      
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, textAlign: 'left' }}>
        <div className="form-group">
          <label className="form-label">{t('admin.contests.form.casino') || 'Casino'}</label>
          <select 
            className="select" 
            value={casino} 
            onChange={(e) => setCasino(e.target.value)}
            disabled={loading}
          >
            <option value="topmatch">TopMatch</option>
            <option value="tonplay">TonPlay</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{t('pending.enter_casino_id')}</label>
          <input
            className="input"
            type="text"
            placeholder={t('pending.casino_id_placeholder')}
            value={casinoIdInput}
            onChange={(e) => setCasinoIdInput(e.target.value)}
            disabled={loading}
            maxLength={32}
          />
        </div>

        <button 
          className={`btn btn-primary btn-block btn-${casino}`} 
          type="submit" 
          disabled={loading || !casinoIdInput.trim()}
          style={{ marginTop: 16 }}
        >
          {loading ? '⋯' : t('rejected.resubmit')}
        </button>

        {msg && <p className="wallet-card-msg" style={{ color: 'var(--success)', textAlign: 'center' }}>{msg}</p>}
        {errorMsg && <p className="wallet-card-msg" style={{ color: 'var(--error)', textAlign: 'center' }}>{errorMsg}</p>}
      </form>
    </div>
  );
};

export default Rejected;
