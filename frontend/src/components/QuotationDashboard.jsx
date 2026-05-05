import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Plus, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const shell = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--color-text)' },
  subtitle: { margin: 0, fontSize: 13, color: 'var(--color-muted)', fontWeight: 600 },
  actions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  primaryBtn: {
    minHeight: 38,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid var(--color-primary)',
    background: 'var(--color-primary)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer'
  },
  ghostBtn: {
    minHeight: 38,
    padding: '0 12px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: '#fff',
    color: 'var(--color-text)',
    fontSize: 13,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 },
  card: {
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    background: '#fff',
    padding: '12px 14px',
    boxShadow: 'var(--shadow-sm)'
  },
  metricLabel: { margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  metricValue: { margin: '6px 0 0', fontSize: 26, fontWeight: 800, color: 'var(--color-text)' },
  panel: {
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    background: '#fff',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden'
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-border)'
  },
  panelTitle: { margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-muted)',
    borderBottom: '1px solid var(--color-border)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '11px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text)',
    borderBottom: '1px solid #eef2f7',
    verticalAlign: 'top'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    border: '1px solid rgba(15,23,42,0.1)',
    background: '#f8fafc',
    color: '#334155'
  }
};

const formatDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB');
};

const formatINR = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹ 0.00';
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function QuotationDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setStatus('');
      const res = await axios.get(`${API_BASE_URL}/api/quotations`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Could not load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const draft = rows.filter((r) => String(r.status || '').toLowerCase() === 'draft').length;
    const final = rows.filter((r) => String(r.status || '').toLowerCase() === 'final').length;
    const totalValue = rows.reduce((sum, r) => sum + (Number(r.grand_total) || 0), 0);
    return { total, draft, final, totalValue };
  }, [rows]);

  return (
    <section style={shell.page}>
      <header style={shell.header}>
        <div>
          <h1 style={shell.title}>Quotation Dashboard</h1>
          <p style={shell.subtitle}>Professional proposal tracking with settings-based numbering, content, and PDF style.</p>
        </div>
        <div style={shell.actions}>
          <button type="button" style={shell.ghostBtn} onClick={load} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" style={shell.primaryBtn} onClick={() => navigate('/quotations/new')}>
            <Plus size={15} /> New Quotation
          </button>
        </div>
      </header>

      <div style={shell.grid}>
        <div style={shell.card}><p style={shell.metricLabel}>Total Quotations</p><p style={shell.metricValue}>{summary.total}</p></div>
        <div style={shell.card}><p style={shell.metricLabel}>Draft</p><p style={shell.metricValue}>{summary.draft}</p></div>
        <div style={shell.card}><p style={shell.metricLabel}>Final</p><p style={shell.metricValue}>{summary.final}</p></div>
        <div style={shell.card}><p style={shell.metricLabel}>Total Quoted Value</p><p style={{ ...shell.metricValue, fontSize: 21 }}>{formatINR(summary.totalValue)}</p></div>
      </div>

      <div style={shell.panel}>
        <div style={shell.panelHeader}>
          <p style={shell.panelTitle}>Recent Quotations</p>
          <span style={shell.badge}>{rows.length} records</span>
        </div>
        <div style={shell.tableWrap}>
          <table style={shell.table}>
            <thead>
              <tr>
                <th style={shell.th}>Quotation #</th>
                <th style={shell.th}>Date</th>
                <th style={shell.th}>Customer</th>
                <th style={shell.th}>Sales Person</th>
                <th style={shell.th}>Status</th>
                <th style={shell.th}>Grand Total</th>
                <th style={shell.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={shell.td} colSpan={7}>{loading ? 'Loading quotations...' : 'No quotations yet. Click New Quotation to create first proposal.'}</td>
                </tr>
              ) : (
                rows.slice(0, 50).map((row) => (
                  <tr key={row.id}>
                    <td style={shell.td}>{row.quotation_number || '-'}</td>
                    <td style={shell.td}>{formatDate(row.quotation_date)}</td>
                    <td style={shell.td}>{row.customer_name || '-'}</td>
                    <td style={shell.td}>{row.sales_person || '-'}</td>
                    <td style={shell.td}><span style={shell.badge}>{row.status || 'Draft'}</span></td>
                    <td style={shell.td}>{formatINR(row.grand_total || 0)}</td>
                    <td style={shell.td}>
                      <button
                        type="button"
                        style={shell.ghostBtn}
                        onClick={() => window.open(`${API_BASE_URL}/api/quotations/${row.id}/pdf`, '_blank')}
                      >
                        <FileText size={14} /> View PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {status ? <p style={{ margin: 0, color: '#dc2626', fontWeight: 700, fontSize: 13 }}>{status}</p> : null}
    </section>
  );
}
