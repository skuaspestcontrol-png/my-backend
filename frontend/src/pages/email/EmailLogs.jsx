import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useColumnResize from '../../components/table/useColumnResize';

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
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'email_logs_table_widths',
    columns: ['dateTime', 'sentBy', 'recipient', 'email', 'type', 'module', 'subject', 'body', 'attachment', 'status', 'response', 'action'],
    defaultColumnWidths: {
      dateTime: 140,
      sentBy: 130,
      recipient: 160,
      email: 200,
      type: 120,
      module: 130,
      subject: 220,
      body: 330,
      attachment: 110,
      status: 110,
      response: 300,
      action: 100
    },
    columnBounds: {
      dateTime: { min: 120, max: 180 },
      sentBy: { min: 110, max: 180 },
      recipient: { min: 140, max: 220 },
      email: { min: 160, max: 260 },
      type: { min: 100, max: 160 },
      module: { min: 110, max: 180 },
      subject: { min: 180, max: 320 },
      body: { min: 240, max: 480 },
      attachment: { min: 100, max: 160 },
      status: { min: 90, max: 140 },
      response: { min: 240, max: 420 },
      action: { min: 90, max: 140 }
    },
    minWidth: 90,
    enabled: true
  });
  const tableMinWidth = ['dateTime', 'sentBy', 'recipient', 'email', 'type', 'module', 'subject', 'body', 'attachment', 'status', 'response', 'action'].reduce((sum, key) => sum + (getColumnWidth(key) || 90), 0);
  const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(1380, tableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => ({ textAlign: align, padding: '8px', fontSize: '11px', position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px` });
  const cellStyle = (key, align = 'left') => ({ padding: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px', position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px`, textAlign: align });

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
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={resetColumns} style={{ minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700, fontSize: '12px' }}>Reset Columns</button>
      </div>
      {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
      <div style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '14px', overflow: 'auto' }}>
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: `${getColumnWidth('dateTime')}px` }} />
            <col style={{ width: `${getColumnWidth('sentBy')}px` }} />
            <col style={{ width: `${getColumnWidth('recipient')}px` }} />
            <col style={{ width: `${getColumnWidth('email')}px` }} />
            <col style={{ width: `${getColumnWidth('type')}px` }} />
            <col style={{ width: `${getColumnWidth('module')}px` }} />
            <col style={{ width: `${getColumnWidth('subject')}px` }} />
            <col style={{ width: `${getColumnWidth('body')}px` }} />
            <col style={{ width: `${getColumnWidth('attachment')}px` }} />
            <col style={{ width: `${getColumnWidth('status')}px` }} />
            <col style={{ width: `${getColumnWidth('response')}px` }} />
            <col style={{ width: `${getColumnWidth('action')}px` }} />
          </colgroup>
          <thead>
            <tr>
              <th style={headStyle('dateTime')}>Date/Time</th>
              <th style={headStyle('sentBy')}>Sent By</th>
              <th style={headStyle('recipient')}>Recipient</th>
              <th style={headStyle('email')}>Email</th>
              <th style={headStyle('type')}>Type</th>
              <th style={headStyle('module')}>Module</th>
              <th style={headStyle('subject')}>Subject</th>
              <th style={headStyle('body')}>Body</th>
              <th style={headStyle('attachment')}>Attachment</th>
              <th style={headStyle('status', 'center')}>Status</th>
              <th style={headStyle('response')}>Provider Response</th>
              <th style={headStyle('action', 'center')}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle('dateTime', 'center')}>{formatDateTime(row.sentAt)}</td>
                <td style={cellStyle('sentBy')}>{row.sentByUser || '-'}</td>
                <td style={cellStyle('recipient')}>{row.recipientName || '-'}</td>
                <td style={cellStyle('email')}>{row.recipientEmail || '-'}</td>
                <td style={cellStyle('type', 'center')}>{row.recipientType || '-'}</td>
                <td style={cellStyle('module')}>{row.moduleName || '-'}</td>
                <td style={cellStyle('subject')}>{row.subject || '-'}</td>
                <td style={{ ...cellStyle('body'), maxWidth: `${getColumnWidth('body')}px`, whiteSpace: 'pre-wrap' }}>{row.body || '-'}</td>
                <td style={cellStyle('attachment', 'center')}>{row.attachmentUrl ? <a href={row.attachmentUrl} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td style={{ ...cellStyle('status', 'center'), fontWeight: 800, color: row.status === 'sent' ? '#166534' : row.status === 'failed' ? '#b91c1c' : '#334155' }}>{String(row.status || '').toUpperCase()}</td>
                <td style={{ ...cellStyle('response'), maxWidth: `${getColumnWidth('response')}px`, whiteSpace: 'pre-wrap' }}>{row.errorMessage || JSON.stringify(row.providerResponse || {})}</td>
                <td style={cellStyle('action', 'center')}>
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
