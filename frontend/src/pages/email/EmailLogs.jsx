import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const formatDateTime = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function EmailLogs() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('Loading...');
  const [retryBusyId, setRetryBusyId] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/email/logs`);
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
      await axios.post(`${API_BASE_URL}/api/email/logs/${id}/retry`, {
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
    <section style={{ display: 'grid', gap: '10px' }}>
      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>Email Logs</h4>
      {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
      <div style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '14px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1380px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Date/Time</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Sent By</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Recipient</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Module</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Subject</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Body</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Attachment</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Provider Response</th>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{formatDateTime(row.sentAt)}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.sentByUser || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.recipientName || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.recipientEmail || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.recipientType || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.moduleName || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.subject || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px', maxWidth: '330px', whiteSpace: 'pre-wrap' }}>{row.body || '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>{row.attachmentUrl ? <a href={row.attachmentUrl} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px', fontWeight: 800, color: row.status === 'sent' ? '#166534' : row.status === 'failed' ? '#b91c1c' : '#334155' }}>{String(row.status || '').toUpperCase()}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px', maxWidth: '300px', whiteSpace: 'pre-wrap' }}>{row.errorMessage || JSON.stringify(row.providerResponse || {})}</td>
                <td style={{ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>
                  {row.status === 'failed' ? (
                    <button type="button" onClick={() => retry(row.id)} disabled={retryBusyId === row.id} style={{ minHeight: '30px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700, fontSize: '12px' }}>{retryBusyId === row.id ? 'Retrying...' : 'Retry'}</button>
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
