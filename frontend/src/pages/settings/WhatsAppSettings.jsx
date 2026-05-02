import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const empty = {
  apiBaseUrl: '',
  phoneNumber: '',
  instanceId: '',
  accessToken: '',
  active: false,
  testNumber: '',
  providerType: 'custom'
};

export default function WhatsAppSettings() {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/settings/whatsapp`);
      setForm({ ...empty, ...(res.data || {}) });
    } catch (error) {
      setStatus('Could not load WhatsApp settings.');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setStatus('Saving...');
      await axios.post(`${API_BASE_URL}/api/settings/whatsapp`, form);
      setStatus('WhatsApp settings saved.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    try {
      setBusy(true);
      setStatus('Sending test message...');
      await axios.post(`${API_BASE_URL}/api/settings/whatsapp/test`, {
        testNumber: form.testNumber,
        sentByUser: localStorage.getItem('portal_user_name') || 'Admin'
      });
      setStatus('Test message sent.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Test send failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>WhatsApp API Settings</h2>
      <form onSubmit={save} style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '12px', padding: '12px', display: 'grid', gap: '10px' }}>
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>API Base URL<input value={form.apiBaseUrl} onChange={(e) => setForm((p) => ({ ...p, apiBaseUrl: e.target.value }))} style={{ minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 11px' }} /></label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>Phone Number<input value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} style={{ minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 11px' }} /></label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>Instance ID<input value={form.instanceId} onChange={(e) => setForm((p) => ({ ...p, instanceId: e.target.value }))} style={{ minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 11px' }} /></label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>Access Token<input value={form.accessToken} onChange={(e) => setForm((p) => ({ ...p, accessToken: e.target.value }))} style={{ minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 11px' }} /></label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>Provider Type<select value={form.providerType} onChange={(e) => setForm((p) => ({ ...p, providerType: e.target.value }))} style={{ minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 11px' }}><option value="custom">Custom</option><option value="meta">Meta Graph</option></select></label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>Test Number<input value={form.testNumber} onChange={(e) => setForm((p) => ({ ...p, testNumber: e.target.value }))} style={{ minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 11px' }} /></label>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '12px' }}><input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={busy} style={{ minHeight: '36px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: '#fff', padding: '0 14px', fontWeight: 700, fontSize: '12px' }}>Save Settings</button>
          <button type="button" onClick={sendTest} disabled={busy} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid #16a34a', background: '#ecfdf5', color: '#166534', padding: '0 14px', fontWeight: 700, fontSize: '12px' }}>Send Test Message</button>
        </div>
        {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
      </form>
    </section>
  );
}
