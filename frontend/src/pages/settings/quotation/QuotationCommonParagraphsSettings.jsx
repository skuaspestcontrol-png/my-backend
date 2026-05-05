import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const input = { width: '100%', minHeight: 72, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14 };

const fields = [
  ['opening_paragraph', 'Opening Paragraph'],
  ['payment_terms', 'Payment Terms'],
  ['general_terms', 'General Terms'],
  ['warranty_paragraph', 'Warranty Paragraph'],
  ['disclaimer_paragraph', 'Disclaimer Paragraph'],
  ['closing_paragraph', 'Closing Paragraph'],
  ['relationship_closing_paragraph', 'Relationship Closing Paragraph']
];

export default function QuotationCommonParagraphsSettings() {
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('');

  const load = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/settings/quotation-common-paragraphs`);
    setForm(res.data || {});
  };

  useEffect(() => { load().catch(() => setStatus('Could not load common paragraphs')); }, []);

  const save = async () => {
    setStatus('Saving...');
    await axios.put(`${API_BASE_URL}/api/settings/quotation-common-paragraphs`, form);
    setStatus('Common paragraphs saved');
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {fields.map(([key, label]) => (
        <div key={key}><p style={{ margin: '0 0 6px', fontWeight: 700 }}>{label}</p><textarea style={input} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} /></div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><p style={{ margin: 0, color: status.toLowerCase().includes('could') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p><button type="button" onClick={save}>Save Common Paragraphs</button></div>
    </div>
  );
}
