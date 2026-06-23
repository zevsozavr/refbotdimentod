import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';

const AdminStreams = () => {
  const { t } = useTranslation();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ banner_image: '', link: '', start_time: '', text_ru: '', text_uk: '' });
  const [error, setError] = useState('');

  useEffect(() => { fetchStreams(); }, []);

  const fetchStreams = async () => {
    try {
      const res = await adminApi.get('/admin/streams');
      setStreams(res.data);
    } catch (e) { console.error('Fetch streams error:', e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ banner_image: '', link: '', start_time: '', text_ru: '', text_uk: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      banner_image: s.banner_image || '',
      link: s.link,
      start_time: new Date(s.start_time).toISOString().slice(0, 16),
      text_ru: s.text_ru || '',
      text_uk: s.text_uk || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.link || !form.start_time) {
      setError('Link and start time are required');
      return;
    }
    try {
      if (editing) {
        await adminApi.put(`/admin/streams/${editing.id}`, form);
      } else {
        await adminApi.post('/admin/streams', form);
      }
      setShowForm(false);
      fetchStreams();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('admin.contests.delete') + '?')) return;
    try {
      await adminApi.delete(`/admin/streams/${id}`);
      fetchStreams();
    } catch (e) { console.error('Delete stream error:', e); }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scheduled': return t('admin.contests.active');
      case 'live': return 'Live';
      case 'ended': return t('admin.contests.ended');
      default: return status;
    }
  };

  if (loading) return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <h1 className="page-title">📺 Streams</h1>
      <button className="btn btn-primary btn-sm mb-4" onClick={openCreate}>Create Stream</button>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Banner Image URL</label>
            <input className="input" placeholder="https://..." value={form.banner_image} onChange={(e) => setForm({ ...form, banner_image: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">Stream Link *</label>
            <input className="input" placeholder="https://..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">Start Time *</label>
            <input className="input" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Text (RU)</label>
            <textarea className="input" rows={3} value={form.text_ru} onChange={(e) => setForm({ ...form, text_ru: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Text (UK)</label>
            <textarea className="input" rows={3} value={form.text_uk} onChange={(e) => setForm({ ...form, text_uk: e.target.value })} />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}
          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary btn-sm" onClick={handleSave}>{t('admin.contests.form.save')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('admin.contests.form.cancel')}</button>
          </div>
        </div>
      )}

      {streams.map((s) => (
        <div key={s.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          {s.banner_image && <img src={s.banner_image} alt="" style={{ width: '100%', borderRadius: 'var(--radius-sm)', maxHeight: 120, objectFit: 'cover', marginBottom: 8 }} />}
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.link}</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>{new Date(s.start_time).toLocaleString()}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            <span className={`badge ${s.status === 'scheduled' ? 'badge-primary' : s.status === 'live' ? 'badge-success' : 'badge-secondary'}`}>{getStatusText(s.status)}</span>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>{t('admin.contests.edit')}</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>{t('admin.contests.delete')}</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminStreams;
