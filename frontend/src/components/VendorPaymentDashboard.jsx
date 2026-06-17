import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { WalletCards } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { useColumnResize } from './table/useColumnResize';
import RupeeSymbol from './ui/RupeeSymbol';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const VENDOR_PAYMENT_CACHE_KEY = 'vendor_payment_dashboard_cache_v1';

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
    letterSpacing: '0.03em',
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
    lineHeight: 1.25,
    minHeight: '42px',
    height: 'auto'
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontSize: '13px', verticalAlign: 'top' },
  actionButton: {
    border: '1px solid rgba(220,38,38,0.25)',
    background: '#fff5f5',
    color: '#b91c1c',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 700,
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

const paymentColumns = ['date', 'billNo', 'vendorName', 'mode', 'amount', 'status', 'action'];
const paymentColumnWidths = {
  date: 120,
  billNo: 140,
  vendorName: 240,
  mode: 160,
  amount: 140,
  status: 120,
  action: 110
};
const paymentColumnBounds = {
  date: { min: 100, max: 180 },
  billNo: { min: 120, max: 220 },
  vendorName: { min: 180, max: 360 },
  mode: { min: 120, max: 220 },
  amount: { min: 100, max: 180 },
  status: { min: 100, max: 160 },
  action: { min: 100, max: 150 }
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
          billId: bill._id || '',
          splitIndex,
          entryType: 'split',
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
        billId: bill._id || '',
        splitIndex: -1,
        entryType: 'total',
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

const readVendorPaymentCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(VENDOR_PAYMENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mergeVendorPaymentCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readVendorPaymentCache() || {};
    window.sessionStorage.setItem(VENDOR_PAYMENT_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best effort only.
  }
};

export default function VendorPaymentDashboard() {
  const [cachedDashboard] = useState(() => readVendorPaymentCache());
  const [vendorBills, setVendorBills] = useState(() => Array.isArray(cachedDashboard?.vendorBills) ? cachedDashboard.vendorBills : []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [status, setStatus] = useState(() => (cachedDashboard ? 'Live vendor expense payment data' : 'Loading vendor payment data...'));
  const loadRequestRef = useRef(null);

  const loadData = async (options = {}) => {
    if (loadRequestRef.current) return loadRequestRef.current;
    const request = (async () => {
      try {
        if (!options.silent) setStatus('Loading vendor payment data...');
        const billsRes = await axios.get(`${API_BASE_URL}/api/vendor-bills`);
        const nextBills = Array.isArray(billsRes.data) ? billsRes.data : [];
        setVendorBills(nextBills);
        mergeVendorPaymentCache({ vendorBills: nextBills });
      } catch (error) {
        if (!options.silent && !cachedDashboard) {
          setStatus('Could not load vendor payment data right now.');
          setVendorBills([]);
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
    const run = async () => {
      try {
        await loadData({ silent: Boolean(cachedDashboard) });
        setStatus('Live vendor expense payment data');
      } catch (error) {
        console.error('Vendor payment load failed', error);
        if (!cachedDashboard) setStatus('Could not load vendor payment data right now.');
      }
    };
    run();
  }, [cachedDashboard]);

  useAutoRefresh(async () => {
    await loadData({ silent: true });
    setStatus('Live vendor expense payment data');
  });

  const rows = useMemo(() => normalizeVendorPayments(vendorBills), [vendorBills]);

  const summary = useMemo(() => {
    const totalPaid = vendorBills.reduce((sum, bill) => sum + toNum(bill.paymentMadeTotal), 0);
    const totalDue = vendorBills.reduce((sum, bill) => sum + toNum(bill.balanceDue), 0);
    return {
      totalPaid,
      totalDue,
      paymentEntries: rows.length
    };
  }, [rows, vendorBills]);

  const deletePaymentEntry = async (row) => {
    if (!row?.billId) return;
    if (!window.confirm('Delete this payment entry?')) return;
    try {
      const bill = vendorBills.find((entry) => String(entry._id || '') === String(row.billId || ''));
      if (!bill) {
        window.alert('Related vendor bill not found.');
        return;
      }

      const currentSplits = Array.isArray(bill.paymentSplits) ? bill.paymentSplits : [];
      let nextSplits = currentSplits;
      if (row.entryType === 'split' && row.splitIndex >= 0) {
        nextSplits = currentSplits.filter((_, idx) => idx !== row.splitIndex);
      } else {
        nextSplits = [];
      }
      const nextPaidTotal = Number(nextSplits.reduce((sum, split) => sum + toNum(split?.amount), 0).toFixed(2));

      await axios.put(`${API_BASE_URL}/api/vendor-bills/${row.billId}`, {
        ...bill,
        paymentSplits: nextSplits,
        paymentMadeEnabled: nextPaidTotal > 0,
        paymentMadeTotal: nextPaidTotal
      });
      await loadData({ silent: true });
      setStatus('Vendor payment entry deleted.');
    } catch (error) {
      window.alert(error?.response?.data?.error || 'Unable to delete vendor payment entry');
    }
  };

  const isMobile = viewportWidth < 768;
  const statsStyle = isMobile ? { ...shell.statsGrid, gridTemplateColumns: '1fr' } : shell.statsGrid;
  const {
    getColumnWidth,
    resetColumns,
    startResize
  } = useColumnResize({
    storageKey: 'skuas-table-widths-vendor-payment',
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
        <h2 style={shell.title}>Vendor Payment Dashboard</h2>
        <p style={shell.sub}>{status}</p>
      </div>

      <div style={statsStyle}>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Total Paid to Vendors</p>
          <p style={shell.statValue}><RupeeSymbol size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalPaid).replace('₹', '')}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Outstanding Vendor Due</p>
          <p style={shell.statValue}><WalletCards size={18} style={{ verticalAlign: 'middle' }} /> {formatINR(summary.totalDue).replace('₹', '')}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Payment Entries</p>
          <p style={shell.statValue}><RupeeSymbol size={18} style={{ verticalAlign: 'middle' }} /> {summary.paymentEntries}</p>
        </article>
      </div>

      <div style={shell.tablePanel}>
      <div style={shell.tableHeadBar}>
        <h3 style={shell.tableHead}>Recent Vendor Payments (Expense Tracking)</h3>
      </div>
        <div className="responsive-table">
          <table style={tableStyle}>
            <colgroup>{paymentColumns.map((key) => <col key={key} style={{ width: `${getColumnWidth(key) || paymentColumnWidths[key] || 100}px` }} />)}</colgroup>
            <thead>
              <tr>
                <th style={headStyle('date')}>Date</th>
                <th style={headStyle('billNo')}>Bill No</th>
                <th style={headStyle('vendorName')}>Vendor</th>
                <th style={headStyle('mode', 'center')}>Mode</th>
                <th style={headStyle('amount', 'center')}>Amount Paid</th>
                <th style={headStyle('status', 'center')}>Bill Status</th>
                <th style={headStyle('action', 'center')}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={shell.td} colSpan={7}>No vendor payment records available yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td style={cellStyle('date')}>{formatDate(row.date)}</td>
                    <td style={cellStyle('billNo')}>{row.billNo}</td>
                    <td style={cellStyle('vendorName')}>{row.vendorName}</td>
                    <td style={cellStyle('mode', 'center')}>{row.mode}</td>
                    <td style={{ ...cellStyle('amount', 'center'), fontWeight: 800, color: '#111827' }}>{formatINR(row.amount)}</td>
                    <td style={cellStyle('status', 'center')}>{row.status}</td>
                    <td style={cellStyle('action', 'center')}>
                      <button type="button" style={shell.actionButton} onClick={() => deletePaymentEntry(row)}>
                        Delete
                      </button>
                    </td>
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
