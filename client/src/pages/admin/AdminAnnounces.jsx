import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminAnnounces = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', text: '', banner_image: '' });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try { const r = await adminApi.get('/admin/announcements'); setItems(r.data); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', text: '', banner_image: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ title: item.title_uk || item.title_ru || '', text: item.text_uk || item.text_ru || '', banner_image: item.banner_image || '' });
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError(t('admin.contests.form.title')); return; }
    try {
      if (editing) await adminApi.put(`/admin/announcements/${editing.id}`, form);
      else await adminApi.post('/admin/announcements', form);
      setShowForm(false);
      fetchItems();
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('admin.contests.delete') + '?')) return;
    try { await adminApi.delete(`/admin/announcements/${id}`); fetchItems(); } catch (e) { console.error(e); }
  };

  if (loading) return <div className="page"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <AdminNav />
      <h1 className="page-title metallic-text">{t('admin.announces.title')}</h1>
      <button className="btn btn-primary btn-sm mb-4" onClick={openCreate}>{t('admin.announces.create')}</button>

      {showForm && (
        <div className="glass-panel" style={{ padding: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.title')}</label>
            <input className="glass-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.text')}</label>
            <textarea className="glass-input" rows={3} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.banner')}</label>
            <input ref={fileRef} className="glass-input" type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploading} />
            {uploading && <p className="text-secondary text-sm mt-1">Uploading...</p>}
            {form.banner_image && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                <img src={form.banner_image} alt="" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 'var(--radius-sm)' }} />
                <button type="button" onClick={removeBanner} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--error)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="emoji-icon" style={{ color: '#fff' }}>✕</span></button>
              </div>
            )}
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}
          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary btn-sm" onClick={handleSave}>{t('admin.contests.form.save')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('admin.contests.form.cancel')}</button>
          </div>
        </div>
      )}

      {items.map(item => (
        <div key={item.id} className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
          {item.banner_image && <img src={item.banner_image} alt="" style={{ width: '100%', borderRadius: 'var(--radius-sm)', maxHeight: 120, objectFit: 'cover', marginBottom: 8 }} />}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{i18n.language === 'uk' ? item.title_uk : item.title_ru}</div>
          {(i18n.language === 'uk' ? item.text_uk : item.text_ru) && <div className="text-secondary" style={{ fontSize: 13, marginBottom: 6 }}>{i18n.language === 'uk' ? item.text_uk : item.text_ru}</div>}
          <div className="text-secondary" style={{ fontSize: 11 }}>{new Date(item.created_at).toLocaleString()}</div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>{t('admin.contests.edit')}</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>{t('admin.contests.delete')}</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminAnnounces;
