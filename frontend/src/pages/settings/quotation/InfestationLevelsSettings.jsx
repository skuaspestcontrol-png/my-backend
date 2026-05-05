import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const input = { width: '100%', minHeight: 40, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' };
const blank = { level_name: '', description: '', recommendation_text: '', image_url: '', sort_order: 0, is_active: 1 };

export default function InfestationLevelsSettings() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/settings/infestation-levels`);
    setRows(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => { load().catch(() => setStatus('Could not load infestation levels')); }, []);

  const upload = async (file) => {
    const fd = new FormData();
    fd.append('brandingImage', file);
    const res = await axios.post(`${API_BASE_URL}/api/settings/upload-branding-image`, fd);
    return String(res.data?.imageUrl || '').trim();
  };

  const save = async () => {
    if (!String(form.level_name || '').trim()) {
      setStatus('Level name is required');
      return;
    }
    if (editingId) {
      await axios.put(`${API_BASE_URL}/api/settings/infestation-levels/${editingId}`, form);
      setStatus('Infestation level updated');
    } else {
      await axios.post(`${API_BASE_URL}/api/settings/infestation-levels`, form);
      setStatus('Infestation level created');
    }
    setEditingId(null);
    setForm(blank);
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Level Name</p><input style={input} value={form.level_name} onChange={(e) => setForm((p) => ({ ...p, level_name: e.target.value }))} /></div>
        <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Sort Order</p><input type="number" style={input} value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><input type="checkbox" checked={Number(form.is_active || 0) === 1} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />Active</label>
      </div>
      <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Description</p><textarea style={{ ...input, minHeight: 56 }} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
      <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Recommendation Text</p><textarea style={{ ...input, minHeight: 56 }} value={form.recommendation_text} onChange={(e) => setForm((p) => ({ ...p, recommendation_text: e.target.value }))} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}><input style={input} value={form.image_url} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} placeholder="Image URL" /><button type="button" onClick={() => fileRef.current?.click()}>Upload Image</button><input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); setForm((p) => ({ ...p, image_url: url })); }} /></div>
      <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={save}>{editingId ? 'Update Level' : 'Add Level'}</button><button type="button" onClick={() => { setForm(blank); setEditingId(null); }}>Reset</button></div>
      <p style={{ margin: 0, color: status.toLowerCase().includes('could') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Level','Description','Image','Sort','Active','Actions'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>)}</tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td style={{ padding: 8 }}>{r.level_name}</td><td style={{ padding: 8 }}>{r.description}</td><td style={{ padding: 8 }}>{r.image_url ? <img src={r.image_url} alt={r.level_name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : '-'}</td><td style={{ padding: 8 }}>{r.sort_order}</td><td style={{ padding: 8 }}>{Number(r.is_active || 0) ? 'Yes' : 'No'}</td><td style={{ padding: 8, display: 'flex', gap: 6 }}><button type="button" onClick={() => { setEditingId(r.id); setForm({ ...blank, ...r }); }}>Edit</button><button type="button" onClick={async () => { await axios.delete(`${API_BASE_URL}/api/settings/infestation-levels/${r.id}`); await load(); }}>Delete</button></td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
