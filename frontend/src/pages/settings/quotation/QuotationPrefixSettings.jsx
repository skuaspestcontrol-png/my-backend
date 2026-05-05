import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const input = { width: '100%', minHeight: 42, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14 };
const defaultMap = {
  'Cockroach Control': 'CC',
  'Termite Control': 'TC',
  'Rodent Control': 'RC',
  'General Pest Control': 'GPC',
  'Bed Bug Control': 'BBC',
  'Mosquito Control': 'MC',
  'AMC Pest Control': 'AMC'
};

export default function QuotationPrefixSettings() {
  const [form, setForm] = useState({ prefix: 'SPC/', financial_year: String(new Date().getFullYear()), enable_service_code: 1, next_number: 20, padding_digits: 4, format_template: '{{prefix}}{{year}}/{{service_code}}/{{number}}', service_code_map_json: JSON.stringify(defaultMap, null, 2) });
  const [status, setStatus] = useState('');

  const load = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/settings/quotation-prefixes`);
    const r = res.data || {};
    setForm((prev) => ({ ...prev, ...r, service_code_map_json: typeof r.service_code_map_json === 'string' && r.service_code_map_json ? r.service_code_map_json : JSON.stringify(defaultMap, null, 2) }));
  };

  useEffect(() => { load().catch(() => setStatus('Could not load quotation prefix settings')); }, []);

  const example = useMemo(() => {
    let map = defaultMap;
    try { map = JSON.parse(form.service_code_map_json || '{}'); } catch (_e) {}
    const code = form.enable_service_code ? (map['Cockroach Control'] || 'CC') : '';
    return `${form.prefix || 'SPC/'}${form.financial_year || new Date().getFullYear()}${form.enable_service_code ? `/${code}` : ''}/${String(form.next_number || 1).padStart(Number(form.padding_digits || 4), '0')}`;
  }, [form]);

  const save = async () => {
    setStatus('Saving...');
    await axios.put(`${API_BASE_URL}/api/settings/quotation-prefixes`, { ...form });
    setStatus('Quotation prefix settings saved');
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Prefix</p><input style={input} value={form.prefix || ''} onChange={(e) => setForm((p) => ({ ...p, prefix: e.target.value }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Financial Year</p><input style={input} value={form.financial_year || ''} onChange={(e) => setForm((p) => ({ ...p, financial_year: e.target.value }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><input type="checkbox" checked={Number(form.enable_service_code || 0) === 1} onChange={(e) => setForm((p) => ({ ...p, enable_service_code: e.target.checked ? 1 : 0 }))} />Enable Service Short Code</label>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Next Number</p><input type="number" style={input} value={form.next_number || 1} onChange={(e) => setForm((p) => ({ ...p, next_number: Number(e.target.value) || 1 }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Padding Digits</p><input type="number" style={input} value={form.padding_digits || 4} onChange={(e) => setForm((p) => ({ ...p, padding_digits: Number(e.target.value) || 4 }))} /></div>
        <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Format Template</p><input style={input} value={form.format_template || ''} onChange={(e) => setForm((p) => ({ ...p, format_template: e.target.value }))} /></div>
      </div>

      <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Service Code Map (JSON)</p><textarea style={{ ...input, minHeight: 180 }} value={form.service_code_map_json || ''} onChange={(e) => setForm((p) => ({ ...p, service_code_map_json: e.target.value }))} /></div>
      <p style={{ margin: 0, fontWeight: 800 }}>Example Preview: {example}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><p style={{ margin: 0, color: status.toLowerCase().includes('could') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p><button type="button" onClick={save}>Save Prefix Settings</button></div>
    </div>
  );
}
