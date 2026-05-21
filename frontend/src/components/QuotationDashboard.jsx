import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import PdfPreviewModal from './PdfPreviewModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const quotationColumns = [
  { key: 'srNo', label: 'Sr No' },
  { key: 'quotationNumber', label: 'Quotation #' },
  { key: 'date', label: 'Date' },
  { key: 'customer', label: 'Customer' },
  { key: 'salesPerson', label: 'Sales Person' },
  { key: 'status', label: 'Status' },
  { key: 'grandTotal', label: 'Grand Total' },
  { key: 'action', label: 'Action' }
];
const quotationDefaultWidths = {
  srNo: 72,
  quotationNumber: 170,
  date: 110,
  customer: 190,
  salesPerson: 150,
  status: 110,
  grandTotal: 130,
  action: 122
};
const quotationColumnBounds = {
  srNo: { min: 64, max: 90 },
  quotationNumber: { min: 140, max: 240 },
  date: { min: 96, max: 140 },
  customer: { min: 160, max: 280 },
  salesPerson: { min: 130, max: 220 },
  status: { min: 90, max: 150 },
  grandTotal: { min: 110, max: 180 },
  action: { min: 110, max: 150 }
};

const shell = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' },
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
  rowIconBtn: {
    width: 30,
    height: 30,
    minWidth: 30,
    minHeight: 30,
    padding: 0,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: '#fff',
    color: '#334155',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  rowIconDangerBtn: {
    width: 30,
    height: 30,
    minWidth: 30,
    minHeight: 30,
    padding: 0,
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  summaryWrap: {
    background: 'rgba(255,255,255,0.82)',
    borderRadius: '16px',
    border: '1px solid rgba(159, 23, 77, 0.14)',
    padding: '12px',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(12px)',
    display: 'grid',
    gap: '10px'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  card: {
    border: '1px solid rgba(17,17,17,0.08)',
    borderRadius: '10px',
    background: '#fff',
    padding: '8px 10px',
    display: 'grid',
    gap: '4px'
  },
  metricLabel: { margin: 0, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 },
  metricValue: { margin: 0, color: '#111111', fontSize: '24px', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em' },
  metricSub: { margin: 0, color: '#7c8797', fontSize: '10px', fontWeight: 700 },
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
  resizeHandle: { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' },
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

class QuotationDashboardBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: String(error?.message || 'Failed to load quotation dashboard.') };
  }

  componentDidCatch(error) {
    console.error('Quotation dashboard crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section style={shell.page}>
          <div style={{ ...shell.panel, padding: '16px' }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>Quotation module failed to load</p>
            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#64748b', fontWeight: 600 }}>{this.state.errorMessage}</p>
            <button
              type="button"
              style={{ ...shell.ghostBtn, marginTop: '12px' }}
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function QuotationDashboardInner() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '' });
  const perPage = 20;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = async (options = {}) => {
    try {
      if (!options.silent) setLoading(true);
      setStatus('');
      const res = await axios.get(`${API_BASE_URL}/api/quotations`);
      const nextRows = Array.isArray(res.data) ? res.data : [];
      setRows(nextRows);
      if (!options.preservePage) setPage(1);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Could not load quotations');
    } finally {
      if (!options.silent) setLoading(false);
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

  const openQuotationPdfPreview = (row) => {
    if (!row?.id) return;
    const quotationNumber = String(row.quotation_number || row.quotationNumber || row.quotationNo || row.quotation_no || row.id || 'Quotation').trim();
    const pdfUrl = `${API_BASE_URL}/api/quotations/${row.id}/pdf`;
    setPdfPreview({
      open: true,
      title: `Quotation - ${quotationNumber}`,
      pdfUrl,
      downloadFileName: `${quotationNumber.replace(/[^\w.-]+/g, '_')}.pdf`,
      publicShareUrl: pdfUrl
    });
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(() => load({ silent: true, preservePage: true }));

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
  const {
    getColumnWidth,
    startResize,
    resetColumns: resetQuotationColumns
  } = useColumnResize({
    storageKey: 'quotations_column_widths',
    columns: quotationColumns.map((column) => column.key),
    defaultColumnWidths: quotationDefaultWidths,
    columnBounds: quotationColumnBounds,
    minWidth: 72,
    enabled: true
  });

  const headerStyle = isMobile
    ? { ...shell.header, flexDirection: 'column', alignItems: 'stretch', gap: 12 }
    : shell.header;
  const titleStyle = isTiny
    ? { ...shell.title, lineHeight: 1.2 }
    : isMobile
      ? { ...shell.title, lineHeight: 1.2 }
      : shell.title;
  const subtitleStyle = isMobile
    ? { ...shell.subtitle, fontSize: 12, lineHeight: 1.45, marginTop: 4 }
    : shell.subtitle;
  const actionsStyle = isMobile
    ? { ...shell.actions, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
    : shell.actions;
  const ghostBtnStyle = isMobile ? { ...shell.ghostBtn, justifyContent: 'center', width: '100%' } : shell.ghostBtn;
  const primaryBtnStyle = isMobile ? { ...shell.primaryBtn, justifyContent: 'center', width: '100%' } : shell.primaryBtn;
  const summaryWrapStyle = isMobile
    ? { ...shell.summaryWrap, padding: '10px' }
    : shell.summaryWrap;
  const summaryGridStyle = isMobile
    ? { ...shell.grid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : { ...shell.grid, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' };
  const summaryCardStyle = isMobile
    ? { ...shell.card, minHeight: 108 }
    : { ...shell.card, minHeight: 112 };
  const summaryValueStyle = isMobile
    ? { ...shell.metricValue, fontSize: 22 }
    : shell.metricValue;
  const totalValueStyle = isMobile
    ? { ...summaryValueStyle, fontSize: 19, lineHeight: 1.15, wordBreak: 'break-word' }
    : { ...shell.metricValue, fontSize: 22, lineHeight: 1.15, wordBreak: 'break-word' };
  const rowActionWrapStyle = isMobile
    ? { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }
    : { display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end' };
  const quotationMobileColumns = quotationColumns.map((column) => `${getColumnWidth(column.key)}px`).join(' ');
  const quotationTableMinWidth = quotationColumns.reduce((sum, column) => sum + getColumnWidth(column.key), 0);
  const tableStyle = {
    ...shell.table,
    minWidth: `${Math.max(isMobile ? 996 : 900, quotationTableMinWidth)}px`,
    tableLayout: 'fixed',
    '--mobile-table-columns': quotationMobileColumns,
    '--mobile-table-min-width': `${Math.max(996, quotationTableMinWidth)}px`
  };
  const actionColumnStyle = isMobile
    ? {}
    : { width: 122, minWidth: 122, maxWidth: 122, textAlign: 'right', overflow: 'visible' };

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

      <div style={summaryWrapStyle}>
        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <p style={shell.metricLabel}>Total Quotations</p>
            <p style={summaryValueStyle}>{summary.total}</p>
            <p style={shell.metricSub}>Records matching current filters</p>
          </div>
          <div style={summaryCardStyle}>
            <p style={shell.metricLabel}>Draft</p>
            <p style={summaryValueStyle}>{summary.draft}</p>
            <p style={shell.metricSub}>Pending finalization</p>
          </div>
          <div style={summaryCardStyle}>
            <p style={shell.metricLabel}>Final</p>
            <p style={summaryValueStyle}>{summary.final}</p>
            <p style={shell.metricSub}>Ready to share with customers</p>
          </div>
          <div style={summaryCardStyle}>
            <p style={shell.metricLabel}>Total Quoted Value</p>
            <p style={totalValueStyle}>{formatINR(summary.totalValue)}</p>
            <p style={shell.metricSub}>Combined value of visible quotations</p>
          </div>
        </div>
      </div>

      <div style={shell.panel}>
        <div style={shell.panelHeader}>
          <p style={shell.panelTitle}>Recent Quotations</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={shell.badge}>{rows.length} records</span>
            <button
              type="button"
              onClick={resetQuotationColumns}
              style={{
                minHeight: 28,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary-dark)',
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Reset Columns
            </button>
          </div>
        </div>
        <div style={{ ...shell.tableWrap, overflowX: 'auto' }} className="crm-table-shell">
          <table style={tableStyle} className="crm-compact-table crm-stack-mobile">
            <colgroup>
              {quotationColumns.map((column) => (
                <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...shell.th, width: `${getColumnWidth('srNo')}px`, minWidth: `${getColumnWidth('srNo')}px` }}>
                  Sr No
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('srNo', event)} />
                </th>
                <th style={{ ...shell.th, width: `${getColumnWidth('quotationNumber')}px`, minWidth: `${getColumnWidth('quotationNumber')}px` }}>
                  Quotation #
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('quotationNumber', event)} />
                </th>
                <th style={{ ...shell.th, width: `${getColumnWidth('date')}px`, minWidth: `${getColumnWidth('date')}px` }}>
                  Date
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('date', event)} />
                </th>
                <th style={{ ...shell.th, width: `${getColumnWidth('customer')}px`, minWidth: `${getColumnWidth('customer')}px` }}>
                  Customer
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('customer', event)} />
                </th>
                <th style={{ ...shell.th, width: `${getColumnWidth('salesPerson')}px`, minWidth: `${getColumnWidth('salesPerson')}px` }}>
                  Sales Person
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('salesPerson', event)} />
                </th>
                <th style={{ ...shell.th, width: `${getColumnWidth('status')}px`, minWidth: `${getColumnWidth('status')}px` }}>
                  Status
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('status', event)} />
                </th>
                <th style={{ ...shell.th, width: `${getColumnWidth('grandTotal')}px`, minWidth: `${getColumnWidth('grandTotal')}px` }}>
                  Grand Total
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('grandTotal', event)} />
                </th>
                <th style={{ ...shell.th, ...actionColumnStyle, width: `${getColumnWidth('action')}px`, minWidth: `${getColumnWidth('action')}px` }}>
                  Action
                  <span style={shell.resizeHandle} onMouseDown={(event) => startResize('action', event)} />
                </th>
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
                    <td style={shell.td} data-label="Sr No">{(safePage - 1) * perPage + idx + 1}</td>
                    <td style={shell.td} data-label="Quotation #"><span className="crm-cell-wrap">{row.quotation_number || '-'}</span></td>
                    <td style={shell.td} data-label="Date">{formatDate(row.quotation_date)}</td>
                    <td style={shell.td} data-label="Customer"><span className="crm-table-primary crm-cell-wrap">{row.customer_name || '-'}</span></td>
                    <td style={shell.td} data-label="Sales Person">{row.sales_person || '-'}</td>
                    <td style={shell.td} data-label="Status"><span style={shell.badge}>{row.status || 'Draft'}</span></td>
                    <td style={shell.td} data-label="Grand Total">{formatINR(row.grand_total || 0)}</td>
                    <td style={{ ...shell.td, ...actionColumnStyle }} data-label="Action">
                      <div style={rowActionWrapStyle}>
                        <button
                          type="button"
                          className="crm-icon-action-btn"
                          style={shell.rowIconBtn}
                          onClick={() => navigate(`/quotations/new?id=${row.id}`)}
                          aria-label="Edit quotation"
                          title="Edit quotation"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="crm-icon-action-btn"
                          style={shell.rowIconDangerBtn}
                          onClick={() => deleteQuotation(row.id)}
                          aria-label="Delete quotation"
                          title="Delete quotation"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="crm-icon-action-btn"
                          style={shell.rowIconBtn}
                          onClick={() => openQuotationPdfPreview(row)}
                          aria-label="View PDF"
                          title="View PDF"
                        >
                          <FileText size={15} />
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" style={{ ...shell.ghostBtn, width: 34, minWidth: 34, padding: 0, justifyContent: 'center' }} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} /></button>
              <button type="button" style={{ ...shell.ghostBtn, width: 34, minWidth: 34, padding: 0, justifyContent: 'center' }} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page" title="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        ) : null}
      </div>

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '' })}
        publicShareUrl={pdfPreview.publicShareUrl}
      />

      {status ? <p style={{ margin: 0, color: '#dc2626', fontWeight: 700, fontSize: 13 }}>{status}</p> : null}
    </section>
  );
}

export default function QuotationDashboard() {
  return (
    <QuotationDashboardBoundary>
      <QuotationDashboardInner />
    </QuotationDashboardBoundary>
  );
}
