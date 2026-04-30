import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const emptyForm = {
  templateName: '',
  templateType: '',
  sendToType: 'Customer',
  messageBody: '',
  attachmentOption: 'None',
  isActive: true,
  officialTemplateName: ''
};

export default function WhatsAppTemplates() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/whatsapp/templates`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setStatus('Could not load templates.');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/whatsapp/templates/${editingId}`, form);
      } else {
        await axios.post(`${API_BASE_URL}/api/whatsapp/templates`, form);
      }
      setForm(emptyForm);
      setEditingId('');
      setStatus('Template saved.');
      await load();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Save failed.');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/whatsapp/templates/${id}`);
      await load();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#111827' }}>WhatsApp Templates</h2>

      <form onSubmit={save} style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '16px', padding: '14px', display: 'grid', gap: '10px' }}>
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
          <input placeholder="Template name" value={form.templateName} onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value }))} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
          <input placeholder="Template type (e.g. invoice_send)" value={form.templateType} onChange={(e) => setForm((p) => ({ ...p, templateType: e.target.value }))} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
          <select value={form.sendToType} onChange={(e) => setForm((p) => ({ ...p, sendToType: e.target.value }))} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }}>
            <option>Customer</option><option>Technician</option><option>Sales</option><option>Admin</option>
          </select>
          <select value={form.attachmentOption} onChange={(e) => setForm((p) => ({ ...p, attachmentOption: e.target.value }))} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }}>
            <option>None</option><option>Invoice PDF</option><option>Quotation PDF</option><option>Service Report PDF</option><option>Manual Upload</option>
          </select>
        </div>
        <input placeholder="Official template name (optional)" value={form.officialTemplateName} onChange={(e) => setForm((p) => ({ ...p, officialTemplateName: e.target.value }))} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
        <textarea placeholder="Message body with variables" value={form.messageBody} onChange={(e) => setForm((p) => ({ ...p, messageBody: e.target.value }))} style={{ minHeight: '120px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '10px 12px' }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ minHeight: '40px', borderRadius: '10px', border: 'none', background: 'var(--color-primary)', color: '#fff', padding: '0 14px', fontWeight: 800 }}>{editingId ? 'Update Template' : 'Add Template'}</button>
          {editingId ? <button type="button" onClick={() => { setEditingId(''); setForm(emptyForm); }} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', padding: '0 14px', fontWeight: 700 }}>Cancel</button> : null}
        </div>
      </form>

      <div style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '16px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Name</th><th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Type</th><th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Send To</th><th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Attachment</th><th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Status</th><th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.templateName}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.templateType}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.sendToType}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.attachmentOption}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <button type="button" onClick={() => { setEditingId(row.id); setForm({ ...emptyForm, ...row }); }} style={{ marginRight: '8px' }}>Edit</button>
                  <button type="button" onClick={() => remove(row.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
    </section>
  );
}
