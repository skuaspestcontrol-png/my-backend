import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useColumnResize from '../../components/table/useColumnResize';

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
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'whatsapp_logs_table_widths',
    columns: ['dateTime', 'sentBy', 'recipient', 'phone', 'type', 'module', 'message', 'attachment', 'status', 'response', 'action'],
    defaultColumnWidths: {
      dateTime: 140,
      sentBy: 130,
      recipient: 160,
      phone: 130,
      type: 120,
      module: 130,
      message: 360,
      attachment: 110,
      status: 110,
      response: 320,
      action: 100
    },
    columnBounds: {
      dateTime: { min: 120, max: 180 },
      sentBy: { min: 110, max: 180 },
      recipient: { min: 140, max: 220 },
      phone: { min: 110, max: 160 },
      type: { min: 100, max: 160 },
      module: { min: 110, max: 180 },
      message: { min: 260, max: 520 },
      attachment: { min: 100, max: 160 },
      status: { min: 90, max: 140 },
      response: { min: 260, max: 480 },
      action: { min: 90, max: 140 }
    },
    minWidth: 90,
    enabled: true
  });
  const tableKeys = ['dateTime', 'sentBy', 'recipient', 'phone', 'type', 'module', 'message', 'attachment', 'status', 'response', 'action'];
  const tableMinWidth = tableKeys.reduce((sum, key) => sum + (getColumnWidth(key) || 90), 0);
  const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(1300, tableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => ({ textAlign: align, padding: '10px', fontSize: '12px', position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px` });
  const cellStyle = (key, align = 'left') => ({ padding: '10px', borderTop: '1px solid #f1f5f9', position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px`, textAlign: align });

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
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={resetColumns} style={{ minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700, fontSize: '12px' }}>Reset Columns</button>
      </div>
      {status ? <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{status}</p> : null}
      <div style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '16px', overflow: 'auto' }}>
        <table style={tableStyle}>
          <colgroup>
            {tableKeys.map((key) => <col key={key} style={{ width: `${getColumnWidth(key)}px` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={headStyle('dateTime')}>Date/Time</th>
              <th style={headStyle('sentBy')}>Sent By</th>
              <th style={headStyle('recipient')}>Recipient</th>
              <th style={headStyle('phone')}>Phone</th>
              <th style={headStyle('type')}>Type</th>
              <th style={headStyle('module')}>Module</th>
              <th style={headStyle('message')}>Message</th>
              <th style={headStyle('attachment')}>Attachment</th>
              <th style={headStyle('status', 'center')}>Status</th>
              <th style={headStyle('response')}>API Response</th>
              <th style={headStyle('action', 'center')}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle('dateTime', 'center')}>{formatDateTime(row.sentAt)}</td>
                <td style={cellStyle('sentBy')}>{row.sentByUser || '-'}</td>
                <td style={cellStyle('recipient')}>{row.recipientName || '-'}</td>
                <td style={cellStyle('phone')}>{row.recipientPhone || '-'}</td>
                <td style={cellStyle('type', 'center')}>{row.recipientType || '-'}</td>
                <td style={cellStyle('module')}>{row.moduleName || '-'}</td>
                <td style={{ ...cellStyle('message'), whiteSpace: 'pre-wrap' }}>{row.message || '-'}</td>
                <td style={cellStyle('attachment', 'center')}>{row.attachmentUrl ? <a href={row.attachmentUrl} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td style={{ ...cellStyle('status', 'center'), fontWeight: 800, color: row.status === 'sent' ? '#166534' : row.status === 'failed' ? '#b91c1c' : '#334155' }}>{String(row.status || '').toUpperCase()}</td>
                <td style={{ ...cellStyle('response'), whiteSpace: 'pre-wrap' }}>{row.errorMessage || JSON.stringify(row.apiResponse || {})}</td>
                <td style={cellStyle('action', 'center')}>
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
