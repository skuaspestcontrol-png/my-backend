import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useColumnResize from '../../components/table/useColumnResize';

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
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'whatsapp_templates_table_widths',
    columns: ['name', 'type', 'sendTo', 'officialName', 'attachment', 'status', 'actions'],
    defaultColumnWidths: {
      name: 180,
      type: 170,
      sendTo: 130,
      officialName: 220,
      attachment: 150,
      status: 110,
      actions: 120
    },
    columnBounds: {
      name: { min: 150, max: 260 },
      type: { min: 140, max: 240 },
      sendTo: { min: 110, max: 160 },
      officialName: { min: 180, max: 320 },
      attachment: { min: 120, max: 220 },
      status: { min: 90, max: 140 },
      actions: { min: 100, max: 160 }
    },
    minWidth: 90,
    enabled: true
  });
  const tableKeys = ['name', 'type', 'sendTo', 'officialName', 'attachment', 'status', 'actions'];
  const tableMinWidth = tableKeys.reduce((sum, key) => sum + (getColumnWidth(key) || 90), 0);
  const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(980, tableMinWidth)}px`, tableLayout: 'fixed' };
  const resizeHandleStyle = { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' };
  const headStyle = (key, align = 'left') => ({ textAlign: align, padding: '10px', fontSize: '12px', position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px` });
  const cellStyle = (key, align = 'left') => ({
    padding: key === 'actions' ? '8px 8px' : '10px',
    borderTop: '1px solid #f1f5f9',
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
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={resetColumns} style={{ minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700, fontSize: '12px' }}>Reset Columns</button>
      </div>

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
        <table style={tableStyle}>
          <colgroup>
            {tableKeys.map((key) => <col key={key} style={{ width: `${getColumnWidth(key)}px` }} />)}
          </colgroup>
          <thead><tr><th style={headStyle('name')}>Name<span style={resizeHandleStyle} onPointerDown={(event) => startResize('name', event)} /></th><th style={headStyle('type')}>Type<span style={resizeHandleStyle} onPointerDown={(event) => startResize('type', event)} /></th><th style={headStyle('sendTo', 'center')}>Send To<span style={resizeHandleStyle} onPointerDown={(event) => startResize('sendTo', event)} /></th><th style={headStyle('officialName')}>Official Name<span style={resizeHandleStyle} onPointerDown={(event) => startResize('officialName', event)} /></th><th style={headStyle('attachment')}>Attachment<span style={resizeHandleStyle} onPointerDown={(event) => startResize('attachment', event)} /></th><th style={headStyle('status', 'center')}>Status<span style={resizeHandleStyle} onPointerDown={(event) => startResize('status', event)} /></th><th style={headStyle('actions', 'center')}>Actions<span style={resizeHandleStyle} onPointerDown={(event) => startResize('actions', event)} /></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle('name')}>{row.templateName}</td>
                <td style={cellStyle('type')}>{row.templateType}</td>
                <td style={cellStyle('sendTo', 'center')}>{row.sendToType}</td>
                <td style={cellStyle('officialName')}>{row.officialTemplateName || '-'}</td>
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
