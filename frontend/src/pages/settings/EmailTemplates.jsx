import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useColumnResize from '../../components/table/useColumnResize';

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
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'email_templates_table_widths',
    columns: ['name', 'type', 'sendTo', 'subject', 'attachment', 'status', 'actions'],
    defaultColumnWidths: {
      name: 180,
      type: 170,
      sendTo: 130,
      subject: 240,
      attachment: 150,
      status: 110,
      actions: 120
    },
    columnBounds: {
      name: { min: 150, max: 260 },
      type: { min: 140, max: 240 },
      sendTo: { min: 110, max: 160 },
      subject: { min: 180, max: 320 },
      attachment: { min: 120, max: 220 },
      status: { min: 90, max: 140 },
      actions: { min: 100, max: 160 }
    },
    minWidth: 90,
    enabled: true
  });
  const tableKeys = ['name', 'type', 'sendTo', 'subject', 'attachment', 'status', 'actions'];
  const tableMinWidth = tableKeys.reduce((sum, key) => sum + (getColumnWidth(key) || 90), 0);
  const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(980, tableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => ({ textAlign: align, padding: '8px', fontSize: '11px', position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px` });
  const cellStyle = (key, align = 'left') => ({
    padding: key === 'actions' ? '6px 8px' : '8px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '12px',
    position: 'relative',
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align,
    verticalAlign: 'middle'
  });
  const actionButtonStyle = {
    minHeight: '28px',
    padding: '0 8px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#334155',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1
  };

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
        <table style={tableStyle}>
          <colgroup>
            {tableKeys.map((key) => <col key={key} style={{ width: `${getColumnWidth(key)}px` }} />)}
          </colgroup>
          <thead><tr><th style={headStyle('name')}>Name</th><th style={headStyle('type')}>Type</th><th style={headStyle('sendTo', 'center')}>Send To</th><th style={headStyle('subject')}>Subject</th><th style={headStyle('attachment')}>Attachment</th><th style={headStyle('status', 'center')}>Status</th><th style={headStyle('actions', 'center')}>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle('name')}>{row.templateName}</td>
                <td style={cellStyle('type')}>{row.templateType}</td>
                <td style={cellStyle('sendTo', 'center')}>{row.sendToType}</td>
                <td style={cellStyle('subject')}>{row.emailSubject}</td>
                <td style={cellStyle('attachment')}>{row.attachmentOption}</td>
                <td style={cellStyle('status', 'center')}>{row.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ ...cellStyle('actions', 'center'), whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                    <button type="button" onClick={() => { setEditingId(row.id); setForm({ ...emptyForm, ...row }); }} style={actionButtonStyle}>Edit</button>
                    <button type="button" onClick={() => remove(row.id)} style={actionButtonStyle}>Delete</button>
                  </div>
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
