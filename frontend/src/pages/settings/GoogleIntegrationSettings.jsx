import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const card = {
  border: '1px solid var(--border)',
  borderRadius: '14px',
  background: '#fff',
  padding: '16px',
  display: 'grid',
  gap: '12px'
};

export default function GoogleIntegrationSettings() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [integration, setIntegration] = useState({
    connected: false,
    syncEnabled: false,
    googleEmail: '',
    tasklistId: ''
  });

  const load = async () => {
    setLoading(true);
    setStatus('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/google/integration/status`);
      setIntegration(res.data || {});
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Could not load Google integration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleConnected') === '1') {
      setStatus('Google account connected successfully.');
      params.delete('googleConnected');
      const next = params.toString();
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, document.title, nextUrl);
      load();
    }
  }, []);

  const connectUrl = useMemo(() => {
    const redirect = encodeURIComponent('/settings');
    return `${API_BASE_URL}/api/google/oauth/start?redirect=${redirect}`;
  }, []);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={card}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>Google Integration</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
          Connect Google Tasks to auto-sync CRM job schedules and completion status.
        </p>

        <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: 'var(--text)' }}>
          <div><strong>Connected:</strong> {integration.connected ? 'Yes' : 'No'}</div>
          <div><strong>Google Account:</strong> {integration.googleEmail || '-'}</div>
          <div><strong>Task List:</strong> {integration.tasklistId ? 'SKUAS CRM Tasks' : '-'}</div>
          <div><strong>Sync Enabled:</strong> {integration.syncEnabled ? 'Yes' : 'No'}</div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href={connectUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '38px',
              minWidth: '210px',
              borderRadius: '10px',
              padding: '0 14px',
              textDecoration: 'none',
              color: '#fff',
              background: 'var(--color-primary)'
            }}
          >
            Connect Google Account
          </a>
          <button type="button" onClick={load} disabled={loading} style={{ minHeight: '38px', minWidth: '120px' }}>
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        {status ? (
          <div style={{ color: status.toLowerCase().includes('could not') ? '#dc2626' : '#166534', fontSize: '14px' }}>
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );
}
