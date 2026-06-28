import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminSettings = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  const fetch = async () => {
    try {
      const res = await adminApi.get('/admin/settings');
      setSettings(res.data);
    } catch (e) {
      console.error('Settings fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async (key) => {
    const value = settings[key]?.value;
    if (!value || isNaN(parseFloat(value))) return;
    setSaving(true);
    setMsg('');
    try {
      await adminApi.put('/admin/settings', { key, value });
      setMsgType('success');
      setMsg(t('common.saved'));
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
      setTimeout(() => { setMsg(''); }, 3000);
    }
  };

  const updateValue = (key, val) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value: val },
    }));
  };

  if (loading) {
    return (
      <div className="page">
        <AdminNav />
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title metallic-text">Settings</h1>

      <div className="glass-panel mb-4" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {t('admin.settings.deposit_thresholds')}
        </h3>
        <p className="text-sm text-secondary mb-4">
          {t('admin.settings.deposit_thresholds_desc')}
        </p>

        {['deposit_threshold_topmatch', 'deposit_threshold_betline'].map((key) => {
          const casinoName = key === 'deposit_threshold_topmatch' ? 'TopMatch' : 'Betline';
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                {casinoName} — {t('admin.settings.level3_threshold')}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="glass-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings[key]?.value || ''}
                  onChange={(e) => updateValue(key, e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 10 }}
                  placeholder="1000"
                />
                <button
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 18px', fontSize: 13, borderRadius: 10, whiteSpace: 'nowrap' }}
                  onClick={() => handleSave(key)}
                  disabled={saving}
                >
                  {saving ? '⋯' : t('admin.settings.save')}
                </button>
              </div>
              {settings[key]?.updated_at && (
                <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                  {t('admin.settings.last_updated')}: {new Date(settings[key].updated_at).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}

        {msg && (
          <p style={{ fontSize: 13, color: msgType === 'success' ? 'var(--tertiary)' : 'var(--error)', marginTop: 8 }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;