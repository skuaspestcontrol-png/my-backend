import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const emptyForm = {
  templateName: '',
  templateType: '',
  sendToType: 'Customer',
  emailSubject: '',
  emailBody: '',
  attachmentOption: 'None',
  isActive: true
};

export default function EmailTemplates() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/email/templates`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setStatus('Could not load email templates.');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editingId) await axios.put(`${API_BASE_URL}/api/email/templates/${editingId}`, form);
      else await axios.post(`${API_BASE_URL}/api/email/templates`, form);
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
      await axios.delete(`${API_BASE_URL}/api/email/templates/${id}`);
      await load();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>Email Templates</h4>

      <form onSubmit={save} style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '14px', padding: '12px', display: 'grid', gap: '8px' }}>
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
          <input placeholder="Template name" value={form.templateName} onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value }))} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '0 10px' }} />
          <input placeholder="Template type (e.g. invoice_send)" value={form.templateType} onChange={(e) => setForm((p) => ({ ...p, templateType: e.target.value }))} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '0 10px' }} />
          <select value={form.sendToType} onChange={(e) => setForm((p) => ({ ...p, sendToType: e.target.value }))} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '0 10px' }}><option>Customer</option><option>Technician</option><option>Sales</option><option>Admin</option></select>
          <select value={form.attachmentOption} onChange={(e) => setForm((p) => ({ ...p, attachmentOption: e.target.value }))} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '0 10px' }}><option>None</option><option>Invoice PDF</option><option>Quotation PDF</option><option>Service Report PDF</option><option>Manual Upload</option></select>
        </div>
        <input placeholder="Email Subject" value={form.emailSubject} onChange={(e) => setForm((p) => ({ ...p, emailSubject: e.target.value }))} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '0 10px' }} />
        <textarea placeholder="Email Body (HTML supported)" value={form.emailBody} onChange={(e) => setForm((p) => ({ ...p, emailBody: e.target.value }))} style={{ minHeight: '110px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '8px 10px' }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px' }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" style={{ minHeight: '34px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: '#fff', padding: '0 12px', fontWeight: 800, fontSize: '12px' }}>{editingId ? 'Update' : 'Add'}</button>
          {editingId ? <button type="button" onClick={() => { setEditingId(''); setForm(emptyForm); }} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', padding: '0 12px', fontWeight: 700, fontSize: '12px' }}>Cancel</button> : null}
        </div>
      </form>

      <div style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '14px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Name</th><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Type</th><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Send To</th><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Subject</th><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Attachment</th><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Status</th><th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.templateName}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.templateType}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.sendToType}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.emailSubject}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.attachmentOption}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>
                  <button type="button" onClick={() => { setEditingId(row.id); setForm({ ...emptyForm, ...row }); }} style={{ marginRight: '6px', fontSize: '12px' }}>Edit</button>
                  <button type="button" onClick={() => remove(row.id)} style={{ fontSize: '12px' }}>Delete</button>
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
