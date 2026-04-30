import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const empty = {
  mailProvider: 'SMTP',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpPassword: '',
  fromEmail: '',
  fromName: '',
  replyToEmail: '',
  active: false,
  testEmailAddress: ''
};

export default function EmailSettings() {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/settings/email`);
      setForm({ ...empty, ...(res.data || {}) });
    } catch (error) {
      setStatus('Could not load email settings.');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setStatus('Saving...');
      await axios.post(`${API_BASE_URL}/api/settings/email`, form);
      setStatus('Email settings saved.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    try {
      setBusy(true);
      setStatus('Sending test email...');
      await axios.post(`${API_BASE_URL}/api/settings/email/test`, {
        testEmailAddress: form.testEmailAddress,
        sentByUser: localStorage.getItem('portal_user_name') || 'Admin'
      });
      setStatus('Test email sent.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Test failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>Email API / SMTP Settings</h4>
      <form onSubmit={save} style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '14px', padding: '12px', display: 'grid', gap: '8px' }}>
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>Mail Provider<select value={form.mailProvider} onChange={(e) => setForm((p) => ({ ...p, mailProvider: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }}><option>SMTP</option><option>Gmail SMTP</option><option>Custom API</option></select></label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>SMTP Host<input value={form.smtpHost} onChange={(e) => setForm((p) => ({ ...p, smtpHost: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>SMTP Port<input value={form.smtpPort} onChange={(e) => setForm((p) => ({ ...p, smtpPort: Number(e.target.value || 0) }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, marginTop: '22px' }}><input type="checkbox" checked={form.smtpSecure} onChange={(e) => setForm((p) => ({ ...p, smtpSecure: e.target.checked }))} /> SMTP Secure</label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>SMTP Username<input value={form.smtpUsername} onChange={(e) => setForm((p) => ({ ...p, smtpUsername: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>SMTP Password<input type="password" value={form.smtpPassword} onChange={(e) => setForm((p) => ({ ...p, smtpPassword: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>From Email<input value={form.fromEmail} onChange={(e) => setForm((p) => ({ ...p, fromEmail: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>From Name<input value={form.fromName} onChange={(e) => setForm((p) => ({ ...p, fromName: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>Reply-To Email<input value={form.replyToEmail} onChange={(e) => setForm((p) => ({ ...p, replyToEmail: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, marginTop: '22px' }}><input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>
          <label style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700 }}>Test Email Address<input value={form.testEmailAddress} onChange={(e) => setForm((p) => ({ ...p, testEmailAddress: e.target.value }))} style={{ minHeight: '36px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px' }} /></label>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={busy} style={{ minHeight: '34px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: '#fff', padding: '0 12px', fontWeight: 800, fontSize: '12px' }}>Save</button>
          <button type="button" onClick={sendTest} disabled={busy} style={{ minHeight: '34px', borderRadius: '8px', border: '1px solid #16a34a', background: '#ecfdf5', color: '#166534', padding: '0 12px', fontWeight: 800, fontSize: '12px' }}>Send Test Email</button>
        </div>
        {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
      </form>
    </section>
  );
}
