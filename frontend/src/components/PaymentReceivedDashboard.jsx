import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, ListOrdered, WalletCards } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { useColumnResize } from './table/useColumnResize';
import { triggerSalesPerformanceRefresh } from '../pages/sales-performance/salesPerformanceApi';
import SortChevronIcon from './ui/SortChevronIcon';
import RupeeSymbol from './ui/RupeeSymbol';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const PAYMENT_PAGE_SIZE = 20;

const shell = {
  page: {
    display: 'grid',
    gap: '16px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0
  },
  hero: {
    display: 'grid',
    gap: '10px',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    background: 'var(--color-primary)',
    borderRadius: '20px',
    padding: '18px'
  },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff' },
  sub: { margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600 },
  statsGrid: { display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
  stat: {
    border: '1px solid rgba(159, 23, 77, 0.18)',
    background: '#fff',
    borderRadius: '12px',
    padding: '12px 14px',
    minHeight: '96px',
    boxShadow: 'var(--shadow-sm)'
  },
  statLabel: { margin: 0, color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.25 },
  statValue: { margin: '12px 0 0 0', color: '#111827', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 },
  tablePanel: {
    border: '1px solid var(--color-border)',
    background: '#fff',
    borderRadius: '18px',
    overflow: 'hidden'
  },
  tableHeadBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--color-border)' },
  tableHead: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' },
  tableHeadButton: { minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '720px' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary-dark)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontSize: '13px', verticalAlign: 'top' },
  pagination: { padding: '10px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: '#fff' },
  paginationInfo: { color: '#64748b', fontSize: '12px', fontWeight: 700 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  paginationBtn: { width: '34px', minWidth: '34px', minHeight: '32px', height: '32px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: 'var(--color-primary)', padding: 0, fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  paginationBtnDisabled: { opacity: 0.48, cursor: 'not-allowed' }
  , actionButton: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    borderRadius: '8px',
    minHeight: '32px',
    height: '32px',
    minWidth: '74px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  }
};

const toNum = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
};

const formatINR = (value) => {
  const amount = toNum(value);
  const formatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted}`;
};

const normalizeDepositTo = (value, invoiceType = 'GST') => {
  const raw = String(value || '').trim().toLowerCase();
  const defaultValue = String(invoiceType || '').trim().toUpperCase() === 'NON GST' ? 'Saving Account' : 'Current Account';
  if (!raw) return defaultValue;
  if (['cash', 'billing', 'undeposited funds', 'undeposited fund'].includes(raw)) return 'Cash';
  if (['current account', 'current', 'bank', 'bank transfer'].includes(raw)) return 'Current Account';
  if (['saving account', 'savings account', 'saving', 'savings'].includes(raw)) return 'Saving Account';
  return defaultValue;
};

const formatDate = (value) => {
  if (!value) return '-';
  const raw = String(value).trim();
  const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const paymentColumns = ['date', 'invoice', 'customer', 'mode', 'depositTo', 'amount', 'action'];
const paymentColumnWidths = {
  date: 120,
  invoice: 160,
  customer: 120,
  mode: 140,
  depositTo: 110,
  amount: 130,
  action: 110
};
const paymentColumnBounds = {
  date: { min: 100, max: 180 },
  invoice: { min: 120, max: 240 },
  customer: { min: 120, max: 240 },
  mode: { min: 100, max: 180 },
  depositTo: { min: 100, max: 150 },
  amount: { min: 100, max: 180 },
  action: { min: 100, max: 150 }
};

const PAYMENT_RECEIVED_CACHE_KEY = 'payment_received_dashboard_cache_v1';

const readPaymentReceivedCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PAYMENT_RECEIVED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mergePaymentReceivedCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readPaymentReceivedCache() || {};
    window.sessionStorage.setItem(PAYMENT_RECEIVED_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best effort only.
  }
};

const normalizePayments = (paymentsRaw, invoicesRaw) => {
  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : [];
  const invoiceMap = new Map();
  invoices.forEach((inv) => {
    [inv?._id, inv?.id, inv?.external_id, inv?.externalId, inv?.invoiceNumber, inv?.invoice_no, inv?.invoiceNo].forEach((key) => {
      if (key === undefined || key === null || key === '') return;
      invoiceMap.set(String(key).toLowerCase(), inv);
    });
  });
  const paymentRows = [];

  const directPayments = Array.isArray(paymentsRaw) ? paymentsRaw : [];
  directPayments.forEach((payment, idx) => {
    const linkedInvoiceKey = String(
      payment.invoiceId ||
      payment.linked_invoice_external_id ||
      payment.linkedInvoiceExternalId ||
      payment.invoice_external_id ||
      payment.invoiceExternalId ||
      payment.invoiceNumber ||
      payment.invoice_no ||
      payment.invoiceNo ||
      ''
    ).trim().toLowerCase();
    const invoice = invoiceMap.get(linkedInvoiceKey);
    const invoiceType = String(invoice?.invoiceType || (toNum(invoice?.totalTax || 0) > 0 ? 'GST' : 'NON GST')).trim().toUpperCase() === 'NON GST' ? 'NON GST' : 'GST';
    paymentRows.push({
      id: payment._id || payment.id || payment.external_id || `pay-${idx}`,
      sourceType: 'payment_received',
      sourceId: payment.external_id || payment.id || payment._id || `pay-${idx}`,
      date: payment.paymentDate || payment.payment_date || payment.date || payment.createdAt,
      invoiceNo: payment.invoiceNumber || payment.invoice_no || payment.invoiceNo || invoice?.invoiceNumber || invoice?.invoice_no || '-',
      customerName: payment.customerName || payment.customer_name || invoice?.customerName || invoice?.customer_name || '-',
      mode: payment.mode || payment.paymentMode || payment.payment_mode || '-',
      depositTo: normalizeDepositTo(
        payment.depositTo || payment.deposit_to || payment.paymentDepositTo || payment.payment_deposit_to || invoice?.depositTo || invoice?.deposit_to || '',
        invoiceType
      ),
      amount: toNum(payment.amount),
      note: payment.note || payment.notes || payment.reference || payment.reference_number || '-',
      rowSource: payment
    });
  });

  // Fallback: create rows from invoice payment splits when dedicated payment rows are absent
  if (paymentRows.length === 0) {
    invoices.forEach((invoice) => {
      const splits = Array.isArray(invoice.paymentSplits) ? invoice.paymentSplits : [];
      splits.forEach((split, idx) => {
        const invoiceType = String(invoice?.invoiceType || (toNum(invoice?.totalTax || 0) > 0 ? 'GST' : 'NON GST')).trim().toUpperCase() === 'NON GST' ? 'NON GST' : 'GST';
        paymentRows.push({
          id: `${invoice._id || invoice.invoiceNumber || 'inv'}-split-${idx}`,
          sourceType: 'legacy_payments',
          sourceId: `${invoice._id || invoice.invoiceNumber || 'inv'}-split-${idx}`,
          date: split.date || invoice.updatedAt || invoice.date || invoice.createdAt,
          invoiceNo: invoice.invoiceNumber || '-',
          customerName: invoice.customerName || '-',
          mode: split.mode || '-',
          depositTo: normalizeDepositTo(split.depositTo || split.deposit_to || '', invoiceType),
          amount: toNum(split.amount),
          note: split.reference || split.note || '-',
          rowSource: split
        });
      });
    });
  }

  return paymentRows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};

export default function PaymentReceivedDashboard() {
  const [cachedDashboard] = useState(() => readPaymentReceivedCache());
  const [payments, setPayments] = useState(() => Array.isArray(cachedDashboard?.payments) ? cachedDashboard.payments : []);
  const [invoices, setInvoices] = useState(() => Array.isArray(cachedDashboard?.invoices) ? cachedDashboard.invoices : []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [status, setStatus] = useState(() => (cachedDashboard ? 'Live payment data' : 'Loading payments...'));
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const loadRequestRef = useRef(null);

  const loadPaymentsData = async (options = {}) => {
    if (loadRequestRef.current) return loadRequestRef.current;
    const request = (async () => {
      try {
        if (!options.silent) setStatus('Loading payments...');
        const [paymentsRes, invoicesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/payment-received`).catch(async () => axios.get(`${API_BASE_URL}/api/payments`)),
          axios.get(`${API_BASE_URL}/api/invoices`)
        ]);
        const nextPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
        const nextInvoices = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];
        setPayments(nextPayments);
        setInvoices(nextInvoices);
        mergePaymentReceivedCache({ payments: nextPayments, invoices: nextInvoices });
      } catch (error) {
        if (!options.silent && !cachedDashboard) {
          setStatus('Could not load payment data right now.');
          setPayments([]);
          setInvoices([]);
        }
        throw error;
      }
    })();
    loadRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (loadRequestRef.current === request) loadRequestRef.current = null;
    }
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await loadPaymentsData({ silent: Boolean(cachedDashboard) });
        setStatus('Live payment data');
      } catch (error) {
        console.error('Payment received load failed', error);
        if (!cachedDashboard) setStatus('Could not load payment data right now.');
      }
    };
    load();
  }, [cachedDashboard]);

  useAutoRefresh(async () => {
    await loadPaymentsData({ silent: true });
    setStatus('Live payment data');
  });

  const deletePayment = async (paymentId) => {
    if (!paymentId) return;
    const sure = window.confirm('Delete this payment entry?');
    if (!sure) return;
    try {
      const row = rows.find((item) => String(item.id) === String(paymentId) || String(item.sourceId) === String(paymentId));
      const deleteUrl = row?.sourceType === 'payment_received'
        ? `${API_BASE_URL}/api/payment-received/${encodeURIComponent(String(row.sourceId || paymentId))}`
        : `${API_BASE_URL}/api/payments/${paymentId}`;
      await axios.delete(deleteUrl);
      await loadPaymentsData({ silent: true });
      triggerSalesPerformanceRefresh();
    } catch (error) {
      console.error('Delete payment failed', error);
      alert(error?.response?.data?.error || 'Unable to delete payment');
    }
  };

  const rows = useMemo(() => normalizePayments(payments, invoices), [payments, invoices]);
  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((left, right) => {
      const leftValue = (() => {
        switch (sortConfig.key) {
          case 'date': return new Date(left.date || 0).getTime() || 0;
          case 'invoice': return String(left.invoiceNo || '');
          case 'customer': return String(left.customerName || '');
          case 'mode': return String(left.mode || '');
          case 'depositTo': return String(left.depositTo || '');
          case 'amount': return Number(left.amount || 0);
          default: return String(left[sortConfig.key] || '');
        }
      })();
      const rightValue = (() => {
        switch (sortConfig.key) {
          case 'date': return new Date(right.date || 0).getTime() || 0;
          case 'invoice': return String(right.invoiceNo || '');
          case 'customer': return String(right.customerName || '');
          case 'mode': return String(right.mode || '');
          case 'depositTo': return String(right.depositTo || '');
          case 'amount': return Number(right.amount || 0);
          default: return String(right[sortConfig.key] || '');
        }
      })();
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return sortConfig.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [rows, sortConfig]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAYMENT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAYMENT_PAGE_SIZE;
    return sortedRows.slice(start, start + PAYMENT_PAGE_SIZE);
  }, [sortedRows, safePage]);
  const firstRecord = sortedRows.length ? ((safePage - 1) * PAYMENT_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * PAYMENT_PAGE_SIZE, sortedRows.length);
  const paginationText = sortedRows.length ? `${firstRecord}-${lastRecord} of ${sortedRows.length} records` : '0 records';

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const toggleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const summary = useMemo(() => {
    const totalReceived = rows.reduce((sum, row) => sum + toNum(row.amount), 0);
    const unpaidInvoices = invoices.filter((invoice) => toNum(invoice.balanceDue) > 0.01).length;
    return {
      totalReceived,
      totalEntries: rows.length,
      unpaidInvoices
    };
  }, [rows, invoices]);

  const isMobile = viewportWidth < 768;
  const isTiny = viewportWidth < 390;
  const statsStyle = isMobile ? { ...shell.statsGrid, gridTemplateColumns: isTiny ? '1fr' : 'repeat(2, minmax(0, 1fr))' } : shell.statsGrid;
  const statStyle = isMobile ? { ...shell.stat, minHeight: '104px' } : shell.stat;
  const paginationStyle = isMobile ? { ...shell.pagination, flexDirection: 'column', alignItems: 'stretch' } : shell.pagination;
  const paginationActionsStyle = isMobile ? { ...shell.paginationActions, justifyContent: 'flex-end' } : shell.paginationActions;
  const {
    getColumnWidth,
    resetColumns,
    startResize
  } = useColumnResize({
    storageKey: 'skuas-table-widths-payment-received',
    columns: paymentColumns,
    defaultColumnWidths: paymentColumnWidths,
    columnBounds: paymentColumnBounds,
    minWidth: 100,
    enabled: true
  });
  const tableMinWidth = paymentColumns.reduce((sum, key) => sum + (getColumnWidth(key) || paymentColumnWidths[key] || 100), 0);
  const tableStyle = { ...shell.table, minWidth: `${Math.max(720, tableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => {
    const width = getColumnWidth(key) || paymentColumnWidths[key] || 100;
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const cellStyle = (key, align = 'left') => {
    const width = getColumnWidth(key) || paymentColumnWidths[key] || 100;
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Payment Received Dashboard</h2>
        <p style={shell.sub}>{status}</p>
      </div>

      <div style={statsStyle}>
        <article style={statStyle}>
          <p style={shell.statLabel}>Total Received</p>
          <p style={shell.statValue}><RupeeSymbol size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalReceived).replace('₹', '')}</p>
        </article>
        <article style={statStyle}>
          <p style={shell.statLabel}>Payment Entries</p>
          <p style={shell.statValue}><ListOrdered size={18} style={{ verticalAlign: 'middle' }} /> {summary.totalEntries}</p>
        </article>
        <article style={statStyle}>
          <p style={shell.statLabel}>Unpaid Invoices</p>
          <p style={shell.statValue}><WalletCards size={18} style={{ verticalAlign: 'middle' }} /> {summary.unpaidInvoices}</p>
        </article>
      </div>

      <div style={shell.tablePanel}>
        <div style={shell.tableHeadBar}>
          <h3 style={shell.tableHead}>Recent Payments</h3>
        </div>
        <div className="responsive-table">
          <table style={tableStyle}>
            <colgroup>{paymentColumns.map((key) => <col key={key} style={{ width: `${getColumnWidth(key) || paymentColumnWidths[key] || 100}px` }} />)}</colgroup>
            <thead>
              <tr>
                {['date', 'invoice', 'customer', 'mode', 'depositTo', 'amount'].map((key) => {
                  const labels = { date: 'Date', invoice: 'Invoice', customer: 'Customer', mode: 'Mode', depositTo: 'Deposit To', amount: 'Amount' };
                  const centerKeys = new Set(['mode', 'depositTo', 'amount']);
                  const active = sortConfig.key === key;
                  return (
                    <th key={key} style={headStyle(key, centerKeys.has(key) ? 'center' : 'left')} aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          color: 'inherit',
                          font: 'inherit',
                          fontWeight: 'inherit',
                          cursor: 'pointer'
                        }}
                        aria-label={`Sort ${labels[key]} ${active && sortConfig.direction === 'asc' ? 'descending' : 'ascending'}`}
                        title={`Sort ${labels[key]} ${active && sortConfig.direction === 'asc' ? 'descending' : 'ascending'}`}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {labels[key]} <SortChevronIcon size={12} color="#111827" />
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th style={headStyle('action', 'center')}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={shell.td} colSpan={7}>No payment records available yet.</td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={cellStyle('date')}>{formatDate(row.date)}</td>
                    <td style={cellStyle('invoice')}>{row.invoiceNo}</td>
                    <td style={cellStyle('customer')} title={row.customerName}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customerName}</div>
                    </td>
                    <td style={cellStyle('mode', 'center')}>{row.mode}</td>
                    <td style={cellStyle('depositTo', 'center')}>{row.depositTo || '-'}</td>
                    <td style={{ ...cellStyle('amount', 'center'), fontWeight: 800, color: '#111827' }}>{formatINR(row.amount)}</td>
                    <td style={cellStyle('action', 'center')}>
                      <button type="button" style={shell.actionButton} onClick={() => deletePayment(row.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={paginationStyle}>
          <div style={shell.paginationInfo}>{paginationText}</div>
          <div style={paginationActionsStyle}>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
