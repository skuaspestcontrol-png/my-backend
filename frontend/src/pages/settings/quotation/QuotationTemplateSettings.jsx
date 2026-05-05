import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const defaultState = {
  logo_url: '', logo_width: 90, logo_height: 70, header_alignment: 'left',
  company_name: '', company_address: '', phone: '', email: '', website: '', gstin: '',
  header_line_color: '#9F174D', primary_color: '#9F174D', border_color: '#cbd5e1',
  font_family: 'Helvetica', font_size: 10, heading_font_size: 14, body_font_size: 10, table_font_size: 9,
  footer_text: '', signature_image_url: '', default_sales_person: '', default_designation: '', default_mobile: '',
  show_logo: 1, show_gstin: 1, show_signature: 1, show_page_number: 1
};

const input = { width: '100%', minHeight: 42, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14 };

export default function QuotationTemplateSettings() {
  const [form, setForm] = useState(defaultState);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);
  const signRef = useRef(null);

  const load = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/settings/quotation-template`);
    setForm((prev) => ({ ...prev, ...(res.data || {}) }));
  };

  useEffect(() => {
    load().catch(() => setStatus('Could not load quotation template settings'));
  }, []);

  const upload = async (file) => {
    const fd = new FormData();
    fd.append('brandingImage', file);
    const res = await axios.post(`${API_BASE_URL}/api/settings/upload-branding-image`, fd);
    return String(res.data?.imageUrl || '').trim();
  };

  const save = async () => {
    setStatus('Saving...');
    await axios.put(`${API_BASE_URL}/api/settings/quotation-template`, form);
    setStatus('Quotation template settings saved');
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Header Logo</p><div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => fileRef.current?.click()}>Upload</button><input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); setForm((p) => ({ ...p, logo_url: url }));
        }} /></div><input style={{ ...input, marginTop: 8 }} value={form.logo_url || ''} onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))} placeholder="Logo URL" /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Signature Image</p><div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => signRef.current?.click()}>Upload</button><input ref={signRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); setForm((p) => ({ ...p, signature_image_url: url }));
        }} /></div><input style={{ ...input, marginTop: 8 }} value={form.signature_image_url || ''} onChange={(e) => setForm((p) => ({ ...p, signature_image_url: e.target.value }))} placeholder="Signature URL" /></div>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontWeight: 700 }}>Header Alignment</label>
          <select style={input} value={form.header_alignment || 'left'} onChange={(e) => setForm((p) => ({ ...p, header_alignment: e.target.value }))}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input style={input} type="number" value={form.logo_width || 90} onChange={(e) => setForm((p) => ({ ...p, logo_width: Number(e.target.value) || 90 }))} placeholder="Logo width" />
            <input style={input} type="number" value={form.logo_height || 70} onChange={(e) => setForm((p) => ({ ...p, logo_height: Number(e.target.value) || 70 }))} placeholder="Logo height" />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {['company_name','phone','email','website','gstin','default_sales_person','default_designation','default_mobile'].map((key) => (
          <div key={key}><p style={{ margin: '0 0 6px', fontWeight: 700, textTransform: 'capitalize' }}>{key.replaceAll('_', ' ')}</p><input style={input} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} /></div>
        ))}
      </div>

      <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Company Address</p><textarea style={{ ...input, minHeight: 72 }} value={form.company_address || ''} onChange={(e) => setForm((p) => ({ ...p, company_address: e.target.value }))} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Primary Color</p><input style={input} value={form.primary_color || ''} onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Header Line Color</p><input style={input} value={form.header_line_color || ''} onChange={(e) => setForm((p) => ({ ...p, header_line_color: e.target.value }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Border Color</p><input style={input} value={form.border_color || ''} onChange={(e) => setForm((p) => ({ ...p, border_color: e.target.value }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Font Size</p><input type="number" style={input} value={form.font_size || 10} onChange={(e) => setForm((p) => ({ ...p, font_size: Number(e.target.value) || 10 }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Heading Size</p><input type="number" style={input} value={form.heading_font_size || 14} onChange={(e) => setForm((p) => ({ ...p, heading_font_size: Number(e.target.value) || 14 }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Table Size</p><input type="number" style={input} value={form.table_font_size || 9} onChange={(e) => setForm((p) => ({ ...p, table_font_size: Number(e.target.value) || 9 }))} /></div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[
          ['show_logo', 'Show Logo'], ['show_gstin', 'Show GSTIN'], ['show_signature', 'Show Signature'], ['show_page_number', 'Show Page Number']
        ].map(([key, label]) => (
          <label key={key} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
            <input type="checkbox" checked={Number(form[key] || 0) === 1} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked ? 1 : 0 }))} />
            {label}
          </label>
        ))}
      </div>

      <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Footer Text</p><textarea style={{ ...input, minHeight: 62 }} value={form.footer_text || ''} onChange={(e) => setForm((p) => ({ ...p, footer_text: e.target.value }))} /></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, color: status.toLowerCase().includes('could') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p>
        <button type="button" onClick={save} style={{ minHeight: 38, minWidth: 130 }}>Save Template Settings</button>
      </div>
    </div>
  );
}
