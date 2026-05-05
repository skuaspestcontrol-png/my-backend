import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const input = { width: '100%', minHeight: 40, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' };
const blank = { service_name: '', service_code: '', pest_name: '', quotation_title: '', about_pest: '', what_we_do: '', treatment_points: '', default_infestation_level: '', default_frequency: '', default_recommendation: '', default_gst_percentage: 18, default_rate_without_gst: 0, default_rate_with_gst: 0, warranty_note: '', service_terms: '', is_active: 1 };

export default function QuotationServiceTemplatesSettings() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');

  const load = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/settings/quotation-services`);
    setRows(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => { load().catch(() => setStatus('Could not load quotation services')); }, []);

  const save = async () => {
    if (!String(form.service_name || '').trim()) {
      setStatus('Service name is required');
      return;
    }
    if (editingId) {
      await axios.put(`${API_BASE_URL}/api/settings/quotation-services/${editingId}`, form);
      setStatus('Service template updated');
    } else {
      await axios.post(`${API_BASE_URL}/api/settings/quotation-services`, form);
      setStatus('Service template created');
    }
    setForm(blank);
    setEditingId(null);
    await load();
  };

  const activeCount = useMemo(() => rows.filter((r) => Number(r.is_active || 0) === 1).length, [rows]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontWeight: 800 }}>Active Templates: {activeCount} / {rows.length}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {['service_name','service_code','pest_name','quotation_title','default_infestation_level','default_frequency'].map((k) => (
          <div key={k}><p style={{ margin: '0 0 5px', fontWeight: 700, textTransform: 'capitalize' }}>{k.replaceAll('_', ' ')}</p><input style={input} value={form[k] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} /></div>
        ))}
        <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>GST %</p><input type="number" style={input} value={form.default_gst_percentage || 18} onChange={(e) => setForm((p) => ({ ...p, default_gst_percentage: Number(e.target.value) || 0 }))} /></div>
        <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Rate Without GST</p><input type="number" style={input} value={form.default_rate_without_gst || 0} onChange={(e) => setForm((p) => ({ ...p, default_rate_without_gst: Number(e.target.value) || 0 }))} /></div>
        <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Rate With GST</p><input type="number" style={input} value={form.default_rate_with_gst || 0} onChange={(e) => setForm((p) => ({ ...p, default_rate_with_gst: Number(e.target.value) || 0 }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><input type="checkbox" checked={Number(form.is_active || 0) === 1} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />Is Active</label>
      </div>
      {['about_pest','what_we_do','treatment_points','default_recommendation','warranty_note','service_terms'].map((k) => (
        <div key={k}><p style={{ margin: '0 0 5px', fontWeight: 700, textTransform: 'capitalize' }}>{k.replaceAll('_', ' ')}</p><textarea style={{ ...input, minHeight: 54 }} value={form[k] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} /></div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={save}>{editingId ? 'Update Service Template' : 'Add Service Template'}</button><button type="button" onClick={() => { setForm(blank); setEditingId(null); }}>Reset</button></div>
      <p style={{ margin: 0, color: status.toLowerCase().includes('could') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Service','Code','Pest','Default Frequency','Rate','GST','Status','Actions'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>)}</tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td style={{ padding: 8 }}>{r.service_name}</td><td style={{ padding: 8 }}>{r.service_code}</td><td style={{ padding: 8 }}>{r.pest_name}</td><td style={{ padding: 8 }}>{r.default_frequency}</td><td style={{ padding: 8 }}>{r.default_rate_with_gst}</td><td style={{ padding: 8 }}>{r.default_gst_percentage}%</td><td style={{ padding: 8 }}>{Number(r.is_active || 0) === 1 ? 'Active' : 'Inactive'}</td><td style={{ padding: 8, display: 'flex', gap: 6 }}><button type="button" onClick={() => { setEditingId(r.id); setForm({ ...blank, ...r }); }}>Edit</button><button type="button" onClick={async () => { await axios.delete(`${API_BASE_URL}/api/settings/quotation-services/${r.id}`); await load(); }}>Delete</button></td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
