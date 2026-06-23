import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import { toLocalDatetime, withTimezone } from '../../utils/timezone';

const AdminStreams = () => {
  const { t } = useTranslation();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ banner_image: '', link: '', start_time: '', text_ru: '', text_uk: '' });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await adminApi.post('/upload', fd);
      setForm({ ...form, banner_image: res.data.url });
    } catch (e) { setError(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const removeBanner = () => {
    setForm({ ...form, banner_image: '' });
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => { fetchStreams(); }, []);

  const fetchStreams = async () => {
    try { const res = await adminApi.get('/admin/streams'); setStreams(res.data); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    now.setHours(now.getHours() + 1);
    setForm({ banner_image: '', link: '', start_time: toLocalDatetime(now.toISOString()), text_ru: '', text_uk: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      banner_image: s.banner_image || '',
      link: s.link,
      start_time: toLocalDatetime(s.start_time),
      text_ru: s.text_ru || '',
      text_uk: s.text_uk || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.link || !form.start_time) { setError('Link and start time are required'); return; }
    try {
      const payload = { ...form, start_time: withTimezone(form.start_time) };
      if (editing) await adminApi.put(`/admin/streams/${editing.id}`, payload);
      else await adminApi.post('/admin/streams', payload);
      setShowForm(false);
      fetchStreams();
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return;
    try { await adminApi.delete(`/admin/streams/${id}`); fetchStreams(); } catch (e) { console.error(e); }
  };

  const setStatus = async (id, status) => {
    try { await adminApi.put(`/admin/streams/${id}`, { status }); fetchStreams(); } catch (e) { console.error(e); }
  };

  if (loading) return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1 className="page-title" style={{ margin: 0 }}>📺 Streams</h1>
      </div>
      <button className="btn btn-primary btn-sm mb-4" onClick={openCreate}>Create Stream</button>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Banner Image</label>
            <input ref={fileRef} className="input" type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploading} />
            {uploading && <p className="text-secondary text-sm mt-1">Uploading...</p>}
            {form.banner_image && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                <img src={form.banner_image} alt="" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 'var(--radius-sm)' }} />
                <button type="button" onClick={removeBanner} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--error)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12 }}>×</button>
              </div>
            )}
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

      {streams.map(s => (
        <div key={s.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          {s.banner_image && <img src={s.banner_image} alt="" style={{ width: '100%', borderRadius: 'var(--radius-sm)', maxHeight: 120, objectFit: 'cover', marginBottom: 8 }} />}
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{s.link}</a>
          </div>
          <div className="text-secondary" style={{ fontSize: 12, marginBottom: 4 }}>{s.text_ru}{s.text_uk ? ` / ${s.text_uk}` : ''}</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>🕐 {new Date(s.start_time).toLocaleString([], { timeZone: 'Europe/Kyiv' })}</div>
          <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className={`badge ${s.status === 'scheduled' ? 'badge-primary' : s.status === 'live' ? 'badge-success' : 'badge-secondary'}`}>
              {s.status === 'scheduled' ? 'Scheduled' : s.status === 'live' ? '🔴 Live' : 'Ended'}
            </span>
            {s.status === 'scheduled' && <button className="btn btn-success btn-xs" onClick={() => setStatus(s.id, 'live')}>Set Live</button>}
            {s.status === 'live' && <button className="btn btn-secondary btn-xs" onClick={() => setStatus(s.id, 'ended')}>End</button>}
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>{t('admin.contests.edit')}</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>{t('admin.contests.delete')}</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminStreams;
