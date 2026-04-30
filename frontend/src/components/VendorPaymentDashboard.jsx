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

const normalizeVendorPayments = (vendorBillsRaw) => {
  const bills = Array.isArray(vendorBillsRaw) ? vendorBillsRaw : [];
  const rows = [];

  bills.forEach((bill, billIndex) => {
    const splits = Array.isArray(bill.paymentSplits) ? bill.paymentSplits : [];
    if (splits.length > 0) {
      splits.forEach((split, splitIndex) => {
        rows.push({
          id: `${bill._id || `bill-${billIndex}`}-split-${splitIndex}`,
          date: split.date || bill.updatedAt || bill.date || bill.createdAt,
          billNo: bill.billNumber || '-',
          vendorName: bill.vendorName || '-',
          mode: split.mode || 'Payment',
          amount: toNum(split.amount),
          status: String(bill.status || 'OPEN').toUpperCase()
        });
      });
      return;
    }

    const paidAmount = toNum(bill.paymentMadeTotal);
    if (paidAmount > 0) {
      rows.push({
        id: `${bill._id || `bill-${billIndex}`}-paid`,
        date: bill.updatedAt || bill.date || bill.createdAt,
        billNo: bill.billNumber || '-',
        vendorName: bill.vendorName || '-',
        mode: 'Bill Payment',
        amount: paidAmount,
        status: String(bill.status || 'OPEN').toUpperCase()
      });
    }
  });

  return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};

export default function VendorPaymentDashboard() {
  const [vendorBills, setVendorBills] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [status, setStatus] = useState('Loading vendor payment data...');

  const loadData = async () => {
    const billsRes = await axios.get(`${API_BASE_URL}/api/vendor-bills`);
    setVendorBills(Array.isArray(billsRes.data) ? billsRes.data : []);
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await loadData();
        if (!mounted) return;
        setStatus('Live vendor expense payment data');
      } catch (error) {
        if (!mounted) return;
        console.error('Vendor payment load failed', error);
        setStatus('Could not load vendor payment data right now.');
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => normalizeVendorPayments(vendorBills), [vendorBills]);

  const summary = useMemo(() => {
    const totalPaid = vendorBills.reduce((sum, bill) => sum + toNum(bill.paymentMadeTotal), 0);
    const totalDue = vendorBills.reduce((sum, bill) => sum + toNum(bill.balanceDue), 0);
    const unpaidBills = vendorBills.filter((bill) => toNum(bill.balanceDue) > 0.01).length;
    return {
      totalPaid,
      totalDue,
      unpaidBills,
      paymentEntries: rows.length
    };
  }, [rows, vendorBills]);

  const isMobile = viewportWidth < 768;
  const statsStyle = isMobile ? { ...shell.statsGrid, gridTemplateColumns: '1fr' } : shell.statsGrid;

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Vendor Payment Dashboard</h2>
        <p style={shell.sub}>{status}</p>
      </div>

      <div style={statsStyle}>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Total Paid to Vendors</p>
          <p style={shell.statValue}><IndianRupee size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalPaid).replace('₹', '')}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Outstanding Vendor Due</p>
          <p style={shell.statValue}><WalletCards size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalDue).replace('₹', '')}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Payment Entries</p>
          <p style={shell.statValue}><Receipt size={18} style={{ verticalAlign: 'middle' }} /> {summary.paymentEntries}</p>
        </article>
      </div>

      <div style={shell.tablePanel}>
        <h3 style={shell.tableHead}>Recent Vendor Payments (Expense Tracking)</h3>
        <div className="responsive-table">
          <table style={shell.table}>
            <thead>
              <tr>
                <th style={shell.th}>Date</th>
                <th style={shell.th}>Bill No</th>
                <th style={shell.th}>Vendor</th>
                <th style={shell.th}>Mode</th>
                <th style={shell.th}>Amount Paid</th>
                <th style={shell.th}>Bill Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={shell.td} colSpan={6}>No vendor payment records available yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td style={shell.td}>{formatDate(row.date)}</td>
                    <td style={shell.td}>{row.billNo}</td>
                    <td style={shell.td}>{row.vendorName}</td>
                    <td style={shell.td}>{row.mode}</td>
                    <td style={{ ...shell.td, fontWeight: 800, color: '#111827' }}>{formatINR(row.amount)}</td>
                    <td style={shell.td}>{row.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={shell.tablePanel}>
        <h3 style={shell.tableHead}>Vendor Bills Due Snapshot</h3>
        <div style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
          Open Vendor Bills: <strong>{summary.unpaidBills}</strong>
        </div>
      </div>
    </section>
  );
}
