import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';
import { toLocalDatetime, withTimezone } from '../../utils/timezone';

const AdminContests = () => {
  const { t } = useTranslation();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title_uk: '', title_ru: '', description_uk: '', description_ru: '',
    prize_uk: '', prize_ru: '', referral_type: '1', casino: 'topmatch', start_date: '', end_date: '',
    winner_count: '1', banner_image: '',
  });
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
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeBanner = () => {
    setForm({ ...form, banner_image: '' });
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const fetchContests = async () => {
    try {
      const res = await adminApi.get('/admin/contests');
      setContests(res.data);
    } catch (e) {
      console.error('Fetch contests error:', e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    const startStr = toLocalDatetime(now.toISOString());
    const endObj = new Date();
    endObj.setHours(23, 59);
    const endStr = toLocalDatetime(endObj.toISOString());
    setForm({ title_uk: '', title_ru: '', description_uk: '', description_ru: '', prize_uk: '', prize_ru: '', referral_type: '1', casino: 'topmatch', start_date: startStr, end_date: endStr, winner_count: '1', banner_image: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (contest) => {
    setEditing(contest);
    setForm({
      title_uk: contest.title_uk, title_ru: contest.title_ru,
      description_uk: contest.description_uk, description_ru: contest.description_ru,
      prize_uk: contest.prize_uk, prize_ru: contest.prize_ru,
      referral_type: String(contest.eligible_referral_type),
      casino: contest.casino || 'topmatch',
      start_date: toLocalDatetime(contest.start_date), end_date: toLocalDatetime(contest.end_date),
      winner_count: String(contest.winner_count || 1),
      banner_image: contest.banner_image || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    setError('');
    try {
      const payload = {
        ...form,
        referral_type: parseInt(form.referral_type),
        casino: form.casino,
        start_date: withTimezone(form.start_date),
        end_date: withTimezone(form.end_date),
      };

      if (editing) {
        await adminApi.put(`/admin/contests/${editing.id}`, payload);
      } else {
        await adminApi.post('/admin/contests', payload);
      }
      setShowForm(false);
      fetchContests();
    } catch (e) {
      setError(e.response?.data?.error || t('common.error'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/contests/${id}`);
      fetchContests();
    } catch (e) {
      alert(e.response?.data?.error || t('common.error'));
    }
  };

  const statusBadge = (status) => {
    const map = { active: 'badge-active', ended: 'badge-ended', winner_picked: 'badge-winner' };
    return map[status] || '';
  };

  const statusLabel = (status) => {
    const map = { active: t('admin.contests.active'), ended: t('admin.contests.ended'), winner_picked: t('admin.contests.winner_picked') };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="page">
        <AdminNav />
        <h1 className="page-title">{t('admin.contests.title')}</h1>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <AdminNav />
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('admin.contests.title')}</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>{t('admin.contests.create')}</button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="mb-3" style={{ fontSize: 18, fontWeight: 600 }}>
            {editing ? t('admin.contests.edit') : t('admin.contests.create')}
          </h3>

          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.title_uk')}</label>
            <input className="input" value={form.title_uk} onChange={(e) => setForm({ ...form, title_uk: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.title_ru')}</label>
            <input className="input" value={form.title_ru} onChange={(e) => setForm({ ...form, title_ru: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.desc_uk')}</label>
            <textarea className="input" value={form.description_uk} onChange={(e) => setForm({ ...form, description_uk: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.desc_ru')}</label>
            <textarea className="input" value={form.description_ru} onChange={(e) => setForm({ ...form, description_ru: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.prize_uk')}</label>
            <input className="input" value={form.prize_uk} onChange={(e) => setForm({ ...form, prize_uk: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.prize_ru')}</label>
            <input className="input" value={form.prize_ru} onChange={(e) => setForm({ ...form, prize_ru: e.target.value })} maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.casino')}</label>
            <select className="select" value={form.casino} onChange={(e) => setForm({ ...form, casino: e.target.value })}>
              <option value="topmatch">TopMatch</option>
              <option value="tonplay">TonPlay</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.type')}</label>
            <select className="select" value={form.referral_type} onChange={(e) => setForm({ ...form, referral_type: e.target.value })}>
              <option value="1">{t('contests.level')} 1</option>
              <option value="2">{t('contests.level')} 2</option>
              <option value="3">{t('contests.level')} 3</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Winner Count</label>
            <input className="input" type="number" min="1" max="100" value={form.winner_count} onChange={(e) => setForm({ ...form, winner_count: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Banner Image</label>
            <input ref={fileRef} className="input" type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploading} />
            {uploading && <p className="text-secondary text-sm mt-1">Uploading...</p>}
            {form.banner_image && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                <img src={form.banner_image} alt="banner preview" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 'var(--radius-sm)' }} />
                <button type="button" onClick={removeBanner} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--error)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="icon icon-close" style={{ color: '#fff' }}></span></button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.start')}</label>
            <input className="input" type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.contests.form.end')}</label>
            <input className="input" type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}

          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary btn-sm" onClick={handleSave}>{t('admin.contests.form.save')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('admin.contests.form.cancel')}</button>
          </div>
        </div>
      )}

      {contests.map((c) => (
        <div key={c.id} className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="contest-title">{c.title_uk}</div>
            <span className={`badge ${statusBadge(c.status)}`}>{statusLabel(c.status)}</span>
          </div>
          <div className="contest-desc">{c.description_uk}</div>
          <div className="contest-meta mt-2">
            <span className="badge badge-type">{c.casino === 'topmatch' ? 'TopMatch' : 'TonPlay'} — {t('contests.level')} {c.eligible_level}</span>
            <span className="text-sm text-secondary">
              {new Date(c.start_date).toLocaleDateString()} — {new Date(c.end_date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
            {c.status === 'active' && (
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>{t('admin.contests.edit')}</button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>{t('admin.contests.delete')}</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminContests;
