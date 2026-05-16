import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { IndianRupee, Receipt, WalletCards } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';

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
  tableHead: { margin: 0, padding: '14px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '16px', fontWeight: 800, color: '#111827' },
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
  paginationBtn: { minHeight: '32px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: 'var(--color-primary)', padding: '0 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
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

const formatINR = (value) => `₹${toNum(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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

const normalizePayments = (paymentsRaw, invoicesRaw) => {
  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : [];
  const invoiceMap = new Map(invoices.map((inv) => [String(inv._id || ''), inv]));
  const paymentRows = [];

  const directPayments = Array.isArray(paymentsRaw) ? paymentsRaw : [];
  directPayments.forEach((payment, idx) => {
    const invoice = invoiceMap.get(String(payment.invoiceId || ''));
    paymentRows.push({
      id: payment._id || `pay-${idx}`,
      date: payment.paymentDate || payment.date || payment.createdAt,
      invoiceNo: payment.invoiceNumber || invoice?.invoiceNumber || '-',
      customerName: payment.customerName || invoice?.customerName || '-',
      mode: payment.mode || payment.paymentMode || '-',
      amount: toNum(payment.amount),
      note: payment.note || payment.notes || payment.reference || '-'
    });
  });

  // Fallback: create rows from invoice payment splits when dedicated payment rows are absent
  if (paymentRows.length === 0) {
    invoices.forEach((invoice) => {
      const splits = Array.isArray(invoice.paymentSplits) ? invoice.paymentSplits : [];
      splits.forEach((split, idx) => {
        paymentRows.push({
          id: `${invoice._id || invoice.invoiceNumber || 'inv'}-split-${idx}`,
          date: split.date || invoice.updatedAt || invoice.date || invoice.createdAt,
          invoiceNo: invoice.invoiceNumber || '-',
          customerName: invoice.customerName || '-',
          mode: split.mode || '-',
          amount: toNum(split.amount),
          note: split.reference || split.note || '-'
        });
      });
    });
  }

  return paymentRows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};

export default function PaymentReceivedDashboard() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [status, setStatus] = useState('Loading payments...');
  const [page, setPage] = useState(1);

  const loadPaymentsData = async () => {
    const [paymentsRes, invoicesRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/payments`),
      axios.get(`${API_BASE_URL}/api/invoices`)
    ]);
    setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
    setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await loadPaymentsData();
        if (!mounted) return;
        setStatus('Live payment data');
      } catch (error) {
        if (!mounted) return;
        console.error('Payment received load failed', error);
        setStatus('Could not load payment data right now.');
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useAutoRefresh(async () => {
    await loadPaymentsData();
    setStatus('Live payment data');
  });

  const deletePayment = async (paymentId) => {
    if (!paymentId) return;
    const sure = window.confirm('Delete this payment entry?');
    if (!sure) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/payments/${paymentId}`);
      await loadPaymentsData();
    } catch (error) {
      console.error('Delete payment failed', error);
      alert(error?.response?.data?.error || 'Unable to delete payment');
    }
  };

  const rows = useMemo(() => normalizePayments(payments, invoices), [payments, invoices]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAYMENT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAYMENT_PAGE_SIZE;
    return rows.slice(start, start + PAYMENT_PAGE_SIZE);
  }, [rows, safePage]);
  const firstRecord = rows.length ? ((safePage - 1) * PAYMENT_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * PAYMENT_PAGE_SIZE, rows.length);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

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

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Payment Received Dashboard</h2>
        <p style={shell.sub}>{status}</p>
      </div>

      <div style={statsStyle}>
        <article style={statStyle}>
          <p style={shell.statLabel}>Total Received</p>
          <p style={shell.statValue}><IndianRupee size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalReceived).replace('₹', '')}</p>
        </article>
        <article style={statStyle}>
          <p style={shell.statLabel}>Payment Entries</p>
          <p style={shell.statValue}><Receipt size={18} style={{ verticalAlign: 'middle' }} /> {summary.totalEntries}</p>
        </article>
        <article style={statStyle}>
          <p style={shell.statLabel}>Unpaid Invoices</p>
          <p style={shell.statValue}><WalletCards size={18} style={{ verticalAlign: 'middle' }} /> {summary.unpaidInvoices}</p>
        </article>
      </div>

      <div style={shell.tablePanel}>
        <h3 style={shell.tableHead}>Recent Payments</h3>
        <div className="responsive-table">
          <table style={shell.table}>
            <thead>
              <tr>
                <th style={shell.th}>Date</th>
                <th style={shell.th}>Invoice</th>
                <th style={shell.th}>Customer</th>
                <th style={shell.th}>Mode</th>
                <th style={shell.th}>Amount</th>
                <th style={shell.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={shell.td} colSpan={6}>No payment records available yet.</td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={shell.td}>{formatDate(row.date)}</td>
                    <td style={shell.td}>{row.invoiceNo}</td>
                    <td style={shell.td}>{row.customerName}</td>
                    <td style={shell.td}>{row.mode}</td>
                    <td style={{ ...shell.td, fontWeight: 800, color: '#111827' }}>{formatINR(row.amount)}</td>
                    <td style={shell.td}>
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
        <div style={shell.pagination}>
          <span style={shell.paginationInfo}>
            {rows.length ? `${firstRecord}-${lastRecord} of ${rows.length} payments • 20 per page` : '20 per page'}
          </span>
          <div style={shell.paginationActions}>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
