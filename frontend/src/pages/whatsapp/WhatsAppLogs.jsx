import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const formatDateTime = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function WhatsAppLogs() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('Loading...');
  const [retryBusyId, setRetryBusyId] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/whatsapp/logs`);
      setRows(Array.isArray(res.data) ? res.data : []);
      setStatus('');
    } catch (error) {
      setStatus('Could not load logs.');
    }
  };

  useEffect(() => { load(); }, []);

  const retry = async (id) => {
    try {
      setRetryBusyId(id);
      await axios.post(`${API_BASE_URL}/api/whatsapp/logs/${id}/retry`, {
        sentByUser: localStorage.getItem('portal_user_name') || 'User'
      });
      await load();
      setStatus('Retry sent.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Retry failed.');
    } finally {
      setRetryBusyId('');
    }
  };

  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#111827' }}>WhatsApp Message Logs</h2>
      {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
      <div style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '16px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1300px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Date/Time</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Sent By</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Recipient</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Phone</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Module</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Message</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Attachment</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>API Response</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{formatDateTime(row.sentAt)}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.sentByUser || '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.recipientName || '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.recipientPhone || '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.recipientType || '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.moduleName || '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9', maxWidth: '360px', whiteSpace: 'pre-wrap' }}>{row.message || '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>{row.attachmentUrl ? <a href={row.attachmentUrl} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9', fontWeight: 800, color: row.status === 'sent' ? '#166534' : row.status === 'failed' ? '#b91c1c' : '#334155' }}>{String(row.status || '').toUpperCase()}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9', maxWidth: '320px', whiteSpace: 'pre-wrap' }}>{row.errorMessage || JSON.stringify(row.apiResponse || {})}</td>
                <td style={{ padding: '10px', borderTop: '1px solid #f1f5f9' }}>
                  {row.status === 'failed' ? (
                    <button type="button" onClick={() => retry(row.id)} disabled={retryBusyId === row.id} style={{ minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700 }}>{retryBusyId === row.id ? 'Retrying...' : 'Retry'}</button>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
