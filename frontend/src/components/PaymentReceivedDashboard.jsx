import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { IndianRupee, Receipt, WalletCards } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
    borderRadius: '16px',
    padding: '14px',
    boxShadow: 'var(--shadow-sm)'
  },
  statLabel: { margin: 0, color: '#6B7280', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  statValue: { margin: '8px 0 0 0', color: '#111827', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' },
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
  td: { padding: '10px 12px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontSize: '13px', verticalAlign: 'top' }
};

const toNum = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
};

const formatINR = (value) => `₹${toNum(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN');
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

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [paymentsRes, invoicesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/payments`),
          axios.get(`${API_BASE_URL}/api/invoices`)
        ]);
        if (!mounted) return;
        setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
        setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
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

  const rows = useMemo(() => normalizePayments(payments, invoices), [payments, invoices]);

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
  const statsStyle = isMobile ? { ...shell.statsGrid, gridTemplateColumns: '1fr' } : shell.statsGrid;

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Payment Received Dashboard</h2>
        <p style={shell.sub}>{status}</p>
      </div>

      <div style={statsStyle}>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Total Received</p>
          <p style={shell.statValue}><IndianRupee size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalReceived).replace('₹', '')}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Payment Entries</p>
          <p style={shell.statValue}><Receipt size={18} style={{ verticalAlign: 'middle' }} /> {summary.totalEntries}</p>
        </article>
        <article style={shell.stat}>
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
                <th style={shell.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={shell.td} colSpan={6}>No payment records available yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td style={shell.td}>{formatDate(row.date)}</td>
                    <td style={shell.td}>{row.invoiceNo}</td>
                    <td style={shell.td}>{row.customerName}</td>
                    <td style={shell.td}>{row.mode}</td>
                    <td style={{ ...shell.td, fontWeight: 800, color: '#111827' }}>{formatINR(row.amount)}</td>
                    <td style={shell.td}>{row.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
