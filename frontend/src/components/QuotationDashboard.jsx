import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

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
    minHeight: 34,
    padding: '0 10px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: '#fff',
    color: 'var(--color-text)',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer'
  },
  dangerBtn: {
    minHeight: 34,
    padding: '0 10px',
    borderRadius: 10,
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 },
  card: {
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    background: '#fff',
    padding: '12px 14px',
    boxShadow: 'var(--shadow-sm)',
    minHeight: 122,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
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
  const [page, setPage] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const perPage = 25;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setStatus('');
      const res = await axios.get(`${API_BASE_URL}/api/quotations`);
      const nextRows = Array.isArray(res.data) ? res.data : [];
      setRows(nextRows);
      setPage(1);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Could not load quotations');
    } finally {
      setLoading(false);
    }
  };

  const deleteQuotation = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this quotation? This action cannot be undone.');
    if (!ok) return;
    try {
      setStatus('');
      await axios.delete(`${API_BASE_URL}/api/quotations/${id}`);
      await load();
      setStatus('Quotation deleted successfully');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Could not delete quotation');
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

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * perPage, safePage * perPage);
  const isMobile = viewportWidth <= 900;
  const isTiny = viewportWidth <= 420;

  const headerStyle = isMobile
    ? { ...shell.header, flexDirection: 'column', alignItems: 'stretch', gap: 12 }
    : shell.header;
  const titleStyle = isTiny
    ? { ...shell.title, fontSize: 22, lineHeight: 1.2 }
    : isMobile
      ? { ...shell.title, fontSize: 24, lineHeight: 1.2 }
      : shell.title;
  const subtitleStyle = isMobile
    ? { ...shell.subtitle, fontSize: 12, lineHeight: 1.45, marginTop: 4 }
    : shell.subtitle;
  const actionsStyle = isMobile
    ? { ...shell.actions, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
    : shell.actions;
  const ghostBtnStyle = isMobile ? { ...shell.ghostBtn, justifyContent: 'center', width: '100%' } : shell.ghostBtn;
  const primaryBtnStyle = isMobile ? { ...shell.primaryBtn, justifyContent: 'center', width: '100%' } : shell.primaryBtn;
  const summaryGridStyle = isMobile
    ? { ...shell.grid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }
    : shell.grid;
  const summaryCardStyle = isMobile
    ? { ...shell.card, minHeight: 132, padding: '14px 14px' }
    : shell.card;
  const summaryValueStyle = isMobile
    ? { ...shell.metricValue, marginTop: 8, fontSize: 38, lineHeight: 1 }
    : shell.metricValue;
  const totalValueStyle = isMobile
    ? { ...summaryValueStyle, fontSize: 31, lineHeight: 1.1, wordBreak: 'break-word' }
    : { ...shell.metricValue, fontSize: 21 };
  const rowGhostBtnStyle = isMobile
    ? { ...shell.ghostBtn, minHeight: 30, padding: '0 8px', fontSize: 11, borderRadius: 9, gap: 5, whiteSpace: 'nowrap' }
    : shell.ghostBtn;
  const rowDangerBtnStyle = isMobile
    ? { ...shell.dangerBtn, minHeight: 30, padding: '0 8px', fontSize: 11, borderRadius: 9, gap: 5, whiteSpace: 'nowrap' }
    : shell.dangerBtn;
  const rowActionWrapStyle = isMobile
    ? { display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center' }
    : { display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' };

  return (
    <section style={shell.page}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Quotation Dashboard</h1>
          <p style={subtitleStyle}>Professional proposal tracking with settings-based numbering, content, and PDF style.</p>
        </div>
        <div style={actionsStyle}>
          <button type="button" style={ghostBtnStyle} onClick={load} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" style={primaryBtnStyle} onClick={() => navigate('/quotations/new')}>
            <Plus size={15} /> New Quotation
          </button>
        </div>
      </header>

      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}><p style={shell.metricLabel}>Total Quotations</p><p style={summaryValueStyle}>{summary.total}</p></div>
        <div style={summaryCardStyle}><p style={shell.metricLabel}>Draft</p><p style={summaryValueStyle}>{summary.draft}</p></div>
        <div style={summaryCardStyle}><p style={shell.metricLabel}>Final</p><p style={summaryValueStyle}>{summary.final}</p></div>
        <div style={summaryCardStyle}><p style={shell.metricLabel}>Total Quoted Value</p><p style={totalValueStyle}>{formatINR(summary.totalValue)}</p></div>
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
                <th style={shell.th}>Sr No</th>
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
                  <td style={shell.td} colSpan={8}>{loading ? 'Loading quotations...' : 'No quotations yet. Click New Quotation to create first proposal.'}</td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={shell.td}>{(safePage - 1) * perPage + idx + 1}</td>
                    <td style={shell.td}>{row.quotation_number || '-'}</td>
                    <td style={shell.td}>{formatDate(row.quotation_date)}</td>
                    <td style={shell.td}>{row.customer_name || '-'}</td>
                    <td style={shell.td}>{row.sales_person || '-'}</td>
                    <td style={shell.td}><span style={shell.badge}>{row.status || 'Draft'}</span></td>
                    <td style={shell.td}>{formatINR(row.grand_total || 0)}</td>
                    <td style={shell.td}>
                      <div style={rowActionWrapStyle}>
                        <button
                          type="button"
                          style={rowGhostBtnStyle}
                          onClick={() => navigate(`/quotations/new?id=${row.id}`)}
                        >
                          <Pencil size={isMobile ? 12 : 14} /> Edit
                        </button>
                        <button
                          type="button"
                          style={rowDangerBtnStyle}
                          onClick={() => deleteQuotation(row.id)}
                        >
                          <Trash2 size={isMobile ? 12 : 14} /> {isMobile ? 'Del' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          style={rowGhostBtnStyle}
                          onClick={() => window.open(`${API_BASE_URL}/api/quotations/${row.id}/pdf`, '_blank')}
                        >
                          <FileText size={isMobile ? 12 : 14} /> {isMobile ? 'PDF' : 'View PDF'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > perPage ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)' }}>
              Showing {(safePage - 1) * perPage + 1} to {Math.min(safePage * perPage, rows.length)} of {rows.length}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" style={shell.ghostBtn} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>Page {safePage} / {totalPages}</span>
              <button type="button" style={shell.ghostBtn} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        ) : null}
      </div>

      {status ? <p style={{ margin: 0, color: '#dc2626', fontWeight: 700, fontSize: 13 }}>{status}</p> : null}
    </section>
  );
}
