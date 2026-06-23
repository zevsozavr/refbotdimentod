import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../axios';
import AdminNav from '../../components/AdminNav';

const AdminContests = () => {
  const { t } = useTranslation();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title_uk: '', title_ru: '', description_uk: '', description_ru: '',
    prize_uk: '', prize_ru: '', referral_type: '1', casino: 'topmatch', start_date: '', end_date: '',
  });
  const [error, setError] = useState('');

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
    setForm({ title_uk: '', title_ru: '', description_uk: '', description_ru: '', prize_uk: '', prize_ru: '', referral_type: '1', casino: 'topmatch', start_date: '', end_date: '' });
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
      start_date: contest.start_date.slice(0, 16), end_date: contest.end_date.slice(0, 16),
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
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
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

  const handlePickWinner = async (id) => {
    try {
      await adminApi.post(`/admin/contests/${id}/pick-winner`);
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
          <div className="flex gap-2 mt-3">
            {c.status === 'active' && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>{t('admin.contests.edit')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>{t('admin.contests.delete')}</button>
              </>
            )}
            {c.status !== 'winner_picked' && new Date(c.end_date) < new Date() && (
              <button className="btn btn-success btn-sm" onClick={() => handlePickWinner(c.id)}>
                {t('admin.contests.pick_winner')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminContests;
