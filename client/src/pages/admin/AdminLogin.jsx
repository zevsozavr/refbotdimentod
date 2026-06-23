import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';

const AdminLogin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    sessionStorage.setItem('adminToken', token);
    try {
      await adminApi.get('/admin/stats');
      navigate('/admin/stats');
    } catch (err) {
      sessionStorage.removeItem('adminToken');
      setError(t('admin.login.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <h1 className="page-title">{t('admin.login.title')}</h1>
      <div className="w-full" style={{ maxWidth: 320 }}>
        <input
          className="input mb-2"
          placeholder={t('admin.login.token_placeholder')}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
        />
        {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}
        <button
          className="btn btn-primary btn-block mt-2"
          onClick={handleLogin}
          disabled={loading || !token.trim()}
        >
          {loading ? t('common.loading') : t('admin.login.submit')}
        </button>
      </div>
    </div>
  );
};

export default AdminLogin;
