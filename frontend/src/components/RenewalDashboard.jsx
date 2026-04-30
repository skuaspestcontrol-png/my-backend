import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarClock, Eye, FileText, MessageSquare, RefreshCcw, UserCheck, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const renewalStatuses = ['Upcoming', 'Contacted', 'Follow-up', 'Confirmed', 'Renewed', 'Lost'];
const paymentStatuses = ['Pending', 'Partial', 'Paid'];
const bucketOptions = [
  { value: 'all', label: 'All Buckets' },
  { value: 'today', label: 'Today' },
  { value: '7_days', label: '7 Days' },
  { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' },
  { value: 'expired', label: 'Expired' },
  { value: 'later', label: 'Later' }
];

const shell = {
  page: { display: 'grid', gap: '12px', width: '100%', padding: 0, border: 'none', borderRadius: 0, background: 'transparent' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '34px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827' },
  subtitle: { margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 },
  actionBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#334155', borderRadius: '8px', minHeight: '34px', padding: '0 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' },
  card: { border: '1px solid var(--color-primary-soft)', background: '#fff', borderRadius: '12px', padding: '10px' },
  cardLabel: { fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  cardValue: { marginTop: '4px', fontSize: '26px', color: '#0f172a', fontWeight: 800 },
  panel: { border: '1px solid rgba(15,23,42,0.08)', background: '#fff', borderRadius: '12px', overflow: 'hidden' },
  panelHead: { borderBottom: '1px solid var(--color-border)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  panelTitle: { margin: 0, fontSize: '18px', color: '#334155', fontWeight: 800 },
  filterGrid: { padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  field: { display: 'grid', gap: '4px' },
  label: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  input: { width: '100%', minHeight: '32px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '0 8px', fontSize: '12px', color: '#334155', background: '#fff', boxSizing: 'border-box' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', borderTop: '1px solid var(--color-border)', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', minWidth: '1240px', borderCollapse: 'separate', borderSpacing: 0 },
  th: { textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', textTransform: 'uppercase' },
  td: { fontSize: '12px', color: '#1f2937', padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  rowAction: { border: '1px solid #F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '7px', minHeight: '26px', padding: '0 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' },
  statusPill: { borderRadius: '999px', padding: '4px 8px', fontSize: '10px', fontWeight: 800, display: 'inline-flex', alignItems: 'center' },
  detail: { padding: '12px', display: 'grid', gap: '10px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' },
  subGrid: { display: 'grid', gap: '6px' },
  empty: { padding: '24px 12px', textAlign: 'center', color: '#64748b', fontWeight: 700 }
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseRoleFlags = () => {
  const role = String(localStorage.getItem('portal_user_role') || 'Admin').trim().toLowerCase();
  const isAdmin = role === 'admin' || role === '';
  const isTechnician = role.includes('technician');
  const canWrite = isAdmin || role.includes('sales') || role.includes('operations') || role.includes('staff');
  return { isAdmin, isTechnician, canWrite: canWrite && !isTechnician };
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export default function RenewalDashboard() {
  const role = useMemo(() => parseRoleFlags(), []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [renewals, setRenewals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({ status: 'Upcoming', paymentStatus: 'Pending', lostReason: '', followUpNote: '', quoteAmount: '', quoteValidTill: '', quoteNotes: '', reminderMessage: '', technicians: [] });
  const [filters, setFilters] = useState({ from: '', to: '', customer: '', serviceType: '', technician: '', status: 'all', paymentStatus: 'all', bucket: 'all' });
  const [historyDrawer, setHistoryDrawer] = useState({ open: false, row: null });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [renewalRes, employeeRes] = await Promise.all([
        axios.get(`${API_BASE}/api/renewals`, { params: { t: Date.now() } }),
        axios.get(`${API_BASE}/api/employees`, { params: { t: Date.now() } })
      ]);
      const nextRenewals = Array.isArray(renewalRes.data) ? renewalRes.data : [];
      setRenewals(nextRenewals);
      setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      if (!selectedId && nextRenewals.length > 0) setSelectedId(nextRenewals[0]._id);
      if (selectedId && !nextRenewals.some((entry) => entry._id === selectedId)) setSelectedId(nextRenewals[0]?._id || '');
    } catch (error) {
      console.error('Failed to load renewals', error);
      setLoadError('Unable to load renewal dashboard right now.');
      setRenewals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, 20000);
    return () => window.clearInterval(intervalId);
  }, []);

  const filtered = useMemo(() => {
    return renewals.filter((entry) => {
      const endDate = entry.contractEndDate ? new Date(entry.contractEndDate) : null;
      const from = filters.from ? new Date(filters.from) : null;
      const to = filters.to ? new Date(filters.to) : null;
      if (from && endDate && endDate < from) return false;
      if (to && endDate && endDate > to) return false;
      if (filters.customer && !`${entry.customerName || ''} ${entry.mobileNumber || ''}`.toLowerCase().includes(filters.customer.toLowerCase())) return false;
      if (filters.serviceType && !String(entry.serviceType || '').toLowerCase().includes(filters.serviceType.toLowerCase())) return false;
      if (filters.technician) {
        const names = Array.isArray(entry.technicianAssignments) ? entry.technicianAssignments.join(' ').toLowerCase() : '';
        if (!names.includes(filters.technician.toLowerCase())) return false;
      }
      if (filters.status !== 'all' && String(entry.status || '') !== filters.status) return false;
      if (filters.paymentStatus !== 'all' && String(entry.paymentStatus || '') !== filters.paymentStatus) return false;
      if (filters.bucket !== 'all' && String(entry.expiryBucket || '') !== filters.bucket) return false;
      return true;
    });
  }, [filters, renewals]);

  const selected = useMemo(() => filtered.find((entry) => entry._id === selectedId) || renewals.find((entry) => entry._id === selectedId) || filtered[0] || null, [filtered, renewals, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      status: selected.status || 'Upcoming',
      paymentStatus: selected.paymentStatus || 'Pending',
      lostReason: selected.lostReason || '',
      followUpNote: '',
      quoteAmount: selected.quotation?.amount ? String(selected.quotation.amount) : '',
      quoteValidTill: selected.quotation?.validTill || '',
      quoteNotes: selected.quotation?.notes || '',
      reminderMessage: `Dear ${selected.customerName || 'Customer'}, your pest control contract is expiring on ${formatDate(selected.contractEndDate)}. Please confirm renewal.`,
      technicians: []
    }));
    setHistory([]);
  }, [selected?._id]);

  const counts = useMemo(() => {
    const today = renewals.filter((entry) => Number(entry.daysToExpiry) === 0).length;
    const d7 = renewals.filter((entry) => Number(entry.daysToExpiry) >= 0 && Number(entry.daysToExpiry) <= 7).length;
    const d15 = renewals.filter((entry) => Number(entry.daysToExpiry) >= 0 && Number(entry.daysToExpiry) <= 15).length;
    const d30 = renewals.filter((entry) => Number(entry.daysToExpiry) >= 0 && Number(entry.daysToExpiry) <= 30).length;
    return { today, d7, d15, d30 };
  }, [renewals]);
  const isMobile = viewportWidth <= 768;
  const cardGridStyle = isMobile ? { ...shell.cardGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.cardGrid;
  const filterGridStyle = isMobile ? { ...shell.filterGrid, gridTemplateColumns: '1fr' } : shell.filterGrid;
  const tableWrapStyle = isMobile ? { ...shell.tableWrap, WebkitOverflowScrolling: 'touch' } : shell.tableWrap;
  const tableStyle = isMobile ? { ...shell.table, minWidth: '1040px' } : shell.table;
  const detailGridStyle = isMobile ? { ...shell.detailGrid, gridTemplateColumns: '1fr' } : shell.detailGrid;

  const technicianOptions = useMemo(
    () => employees.filter((entry) => String(entry.role || '').trim().toLowerCase() === 'technician'),
    [employees]
  );

  const refreshHistory = async () => {
    if (!selected) return;
    try {
      setHistoryLoading(true);
      const res = await axios.get(`${API_BASE}/api/renewals/${selected._id}/history`);
      setHistory(Array.isArray(res.data?.history) ? res.data.history : []);
    } catch (error) {
      console.error('Failed to load history', error);
      window.alert('Unable to load renewal history right now.');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveStatus = async () => {
    if (!selected || !role.canWrite) return;
    if (form.status === 'Lost' && !form.lostReason.trim()) {
      window.alert('Lost renewal reason is required.');
      return;
    }
    try {
      setBusy(true);
      await axios.put(`${API_BASE}/api/renewals/${selected._id}`, {
        status: form.status,
        paymentStatus: form.paymentStatus,
        lostReason: form.lostReason,
        updatedBy: localStorage.getItem('portal_user_name') || 'User'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update renewal status', error);
      window.alert(error?.response?.data?.error || 'Unable to update renewal.');
    } finally {
      setBusy(false);
    }
  };

  const addFollowUp = async () => {
    if (!selected || !role.canWrite) return;
    if (!form.followUpNote.trim()) {
      window.alert('Follow-up note cannot be empty.');
      return;
    }
    try {
      setBusy(true);
      await axios.put(`${API_BASE}/api/renewals/${selected._id}`, {
        followUpNote: form.followUpNote,
        updatedBy: localStorage.getItem('portal_user_name') || 'User'
      });
      setForm((prev) => ({ ...prev, followUpNote: '' }));
      await loadData();
    } catch (error) {
      console.error('Failed to save follow-up', error);
      window.alert(error?.response?.data?.error || 'Unable to save follow-up note.');
    } finally {
      setBusy(false);
    }
  };

  const sendReminder = async (channel) => {
    if (!selected || !role.canWrite) return;
    try {
      setBusy(true);
      const recipient = window.prompt(`Recipient for ${channel.toUpperCase()} reminder`, channel === 'email' ? selected.email || '' : channel === 'whatsapp' ? selected.whatsappNumber || '' : selected.mobileNumber || '');
      if (recipient == null) return;
      await axios.post(`${API_BASE}/api/renewals/${selected._id}/send-reminder`, {
        channel,
        recipient,
        message: form.reminderMessage,
        updatedBy: localStorage.getItem('portal_user_name') || 'User'
      });
      await loadData();
      window.alert(`${channel.toUpperCase()} reminder processed.`);
    } catch (error) {
      console.error('Reminder failed', error);
      window.alert(error?.response?.data?.error || 'Unable to send reminder.');
    } finally {
      setBusy(false);
    }
  };

  const generateQuotation = async () => {
    if (!selected || !role.canWrite) return;
    const amount = Number(form.quoteAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('Enter a valid quotation amount.');
      return;
    }
    try {
      setBusy(true);
      await axios.post(`${API_BASE}/api/renewals/${selected._id}/quotation`, {
        amount,
        validTill: form.quoteValidTill,
        notes: form.quoteNotes,
        updatedBy: localStorage.getItem('portal_user_name') || 'User'
      });
      await loadData();
      window.alert('Renewal quotation generated.');
    } catch (error) {
      console.error('Quotation generation failed', error);
      window.alert(error?.response?.data?.error || 'Unable to generate quotation.');
    } finally {
      setBusy(false);
    }
  };

  const convertToInvoice = async () => {
    if (!selected || !role.canWrite) return;
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/renewals/${selected._id}/convert-invoice`, {
        amount: Number(form.quoteAmount || selected.totalAmount || 0),
        updatedBy: localStorage.getItem('portal_user_name') || 'User'
      });
      await loadData();
      window.alert(`Renewal converted to invoice ${res.data?.invoice?.invoiceNumber || ''}`.trim());
    } catch (error) {
      console.error('Convert invoice failed', error);
      window.alert(error?.response?.data?.error || 'Unable to convert renewal to invoice.');
    } finally {
      setBusy(false);
    }
  };

  const assignTechnicians = async () => {
    if (!selected || !role.canWrite) return;
    if (!Array.isArray(form.technicians) || form.technicians.length === 0) {
      window.alert('Select at least one technician.');
      return;
    }
    try {
      setBusy(true);
      await axios.post(`${API_BASE}/api/renewals/${selected._id}/assign-technician`, {
        technicianIds: form.technicians,
        notes: form.followUpNote || form.quoteNotes || '',
        updatedBy: localStorage.getItem('portal_user_name') || 'User'
      });
      await loadData();
      window.alert('Renewal services assigned to technician.');
    } catch (error) {
      console.error('Assign technician failed', error);
      window.alert(error?.response?.data?.error || 'Unable to assign technician.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const source = filtered;
    if (source.length === 0) {
      window.alert('No renewal data available to export.');
      return;
    }
    const headers = ['Customer', 'Invoice#', 'Service Type', 'Contract End', 'Days To Expiry', 'Status', 'Payment Status', 'Total', 'Paid', 'Balance', 'Technicians'];
    const rows = [
      headers.join(','),
      ...source.map((entry) => [
        csvEscape(entry.customerName),
        csvEscape(entry.invoiceNumber),
        csvEscape(entry.serviceType),
        csvEscape(entry.contractEndDate),
        csvEscape(entry.daysToExpiry),
        csvEscape(entry.status),
        csvEscape(entry.paymentStatus),
        csvEscape(entry.totalAmount),
        csvEscape(entry.paidAmount),
        csvEscape(entry.balanceDue),
        csvEscape(Array.isArray(entry.technicianAssignments) ? entry.technicianAssignments.join(' | ') : '')
      ].join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `renewals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section style={shell.page}>
      <div style={shell.head}>
        <div>
          <h1 style={shell.title}>Renewal Dashboard</h1>
          <p style={shell.subtitle}>Track expiring contracts, follow-ups, renewal conversion, reminders, and field assignment in one module.</p>
        </div>
        <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={shell.actionBtn} onClick={loadData}><RefreshCcw size={14} style={{ verticalAlign: 'middle' }} /> Refresh</button>
          <button type="button" style={shell.actionBtn} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div style={cardGridStyle}>
        <div style={shell.card}><div style={shell.cardLabel}>Expiring Today</div><div style={shell.cardValue}>{counts.today}</div></div>
        <div style={shell.card}><div style={shell.cardLabel}>Within 7 Days</div><div style={shell.cardValue}>{counts.d7}</div></div>
        <div style={shell.card}><div style={shell.cardLabel}>Within 15 Days</div><div style={shell.cardValue}>{counts.d15}</div></div>
        <div style={shell.card}><div style={shell.cardLabel}>Within 30 Days</div><div style={shell.cardValue}>{counts.d30}</div></div>
      </div>

      <div style={shell.panel}>
        <div style={shell.panelHead}>
          <h3 style={shell.panelTitle}>Renewal Pipeline</h3>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>{role.canWrite ? 'Role Access: Admin/Staff (Write)' : 'Role Access: Technician (Read Only)'}</span>
        </div>
        <div style={filterGridStyle}>
          <div style={shell.field}><p style={shell.label}>From</p><input type="date" style={shell.input} value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>To</p><input type="date" style={shell.input} value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Customer</p><input style={shell.input} value={filters.customer} onChange={(event) => setFilters((prev) => ({ ...prev, customer: event.target.value }))} placeholder="name or mobile" /></div>
          <div style={shell.field}><p style={shell.label}>Service Type</p><input style={shell.input} value={filters.serviceType} onChange={(event) => setFilters((prev) => ({ ...prev, serviceType: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Technician</p><input style={shell.input} value={filters.technician} onChange={(event) => setFilters((prev) => ({ ...prev, technician: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Status</p><select style={shell.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="all">All</option>{renewalStatuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Payment</p><select style={shell.input} value={filters.paymentStatus} onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}><option value="all">All</option>{paymentStatuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Expiry Bucket</p><select style={shell.input} value={filters.bucket} onChange={(event) => setFilters((prev) => ({ ...prev, bucket: event.target.value }))}>{bucketOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div>
        </div>

        <div style={tableWrapStyle}>
          {loading ? <div style={shell.empty}>Loading renewals...</div> : null}
          {!loading && loadError ? <div style={shell.empty}>{loadError}</div> : null}
          {!loading && !loadError && filtered.length === 0 ? <div style={shell.empty}>No renewal records match current filters.</div> : null}
          {!loading && !loadError && filtered.length > 0 ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={shell.th}>Customer</th>
                  <th style={shell.th}>Invoice#</th>
                  <th style={shell.th}>Service</th>
                  <th style={shell.th}>Contract End</th>
                  <th style={shell.th}>Expiry</th>
                  <th style={shell.th}>Renewal Status</th>
                  <th style={shell.th}>Payment</th>
                  <th style={shell.th}>Assigned Technician</th>
                  <th style={shell.th}>Amounts</th>
                  <th style={shell.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry._id} style={{ background: selected?._id === entry._id ? 'rgba(252,231,243,0.55)' : 'transparent' }}>
                    <td style={shell.td}>
                      <button type="button" onClick={() => setSelectedId(entry._id)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--color-primary-dark)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                        {entry.customerName}
                      </button>
                      <div style={{ color: '#64748b' }}>{entry.mobileNumber || '-'}</div>
                    </td>
                    <td style={shell.td}>{entry.invoiceNumber || '-'}</td>
                    <td style={shell.td}>{entry.serviceType || '-'}</td>
                    <td style={shell.td}>{formatDate(entry.contractEndDate)}</td>
                    <td style={shell.td}>{Number.isFinite(Number(entry.daysToExpiry)) ? `${entry.daysToExpiry} day(s)` : '-'}</td>
                    <td style={shell.td}><span style={{ ...shell.statusPill, background: 'rgba(159,23,77,0.12)', color: 'var(--color-primary-dark)' }}>{entry.status}</span></td>
                    <td style={shell.td}><span style={{ ...shell.statusPill, background: 'rgba(22,163,74,0.12)', color: '#166534' }}>{entry.paymentStatus}</span></td>
                    <td style={shell.td}>{Array.isArray(entry.technicianAssignments) && entry.technicianAssignments.length > 0 ? entry.technicianAssignments.join(', ') : '-'}</td>
                    <td style={shell.td}>{`${formatINR(entry.totalAmount)} / ${formatINR(entry.balanceDue)}`}</td>
                    <td style={shell.td}>
                      <div style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button type="button" style={shell.rowAction} onClick={() => { setSelectedId(entry._id); refreshHistory(); }}>History</button>
                        <button type="button" style={shell.rowAction} onClick={() => { setHistoryDrawer({ open: true, row: entry }); setSelectedId(entry._id); refreshHistory(); }}><Eye size={12} /></button>
                        <button type="button" style={shell.rowAction} onClick={() => sendReminder('whatsapp')} disabled={!role.canWrite || busy}>WA</button>
                        <button type="button" style={shell.rowAction} onClick={() => sendReminder('email')} disabled={!role.canWrite || busy}>Email</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div style={shell.panel}>
          <div style={shell.panelHead}>
            <h3 style={shell.panelTitle}>{selected.invoiceNumber || selected.customerName}</h3>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>{busy ? 'Saving...' : 'Ready'}</span>
          </div>
          <div style={shell.detail}>
            <div style={detailGridStyle}>
              <div style={shell.subGrid}>
                <p style={shell.label}>Renewal Status</p>
                <select style={shell.input} value={form.status} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  {renewalStatuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Payment Status</p>
                <select style={shell.input} value={form.paymentStatus} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, paymentStatus: event.target.value }))}>
                  {paymentStatuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Lost Reason</p>
                <input style={shell.input} value={form.lostReason} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, lostReason: event.target.value }))} placeholder="Required if status is Lost" />
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Actions</p>
                <button type="button" style={shell.actionBtn} onClick={saveStatus} disabled={!role.canWrite || busy}>Save Status</button>
              </div>
            </div>

            <div style={detailGridStyle}>
              <div style={shell.subGrid}>
                <p style={shell.label}>Follow-up Note</p>
                <input style={shell.input} value={form.followUpNote} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, followUpNote: event.target.value }))} placeholder="Call summary / next action" />
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Quotation Amount</p>
                <input type="number" min="0" step="0.01" style={shell.input} value={form.quoteAmount} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, quoteAmount: event.target.value }))} />
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Quotation Valid Till</p>
                <input type="date" style={shell.input} value={form.quoteValidTill} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, quoteValidTill: event.target.value }))} />
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Quotation Notes</p>
                <input style={shell.input} value={form.quoteNotes} disabled={!role.canWrite || busy} onChange={(event) => setForm((prev) => ({ ...prev, quoteNotes: event.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={shell.actionBtn} onClick={addFollowUp} disabled={!role.canWrite || busy}>Add Follow-up</button>
              <button type="button" style={shell.actionBtn} onClick={generateQuotation} disabled={!role.canWrite || busy}><FileText size={14} style={{ verticalAlign: 'middle' }} /> Generate Quotation</button>
              <button type="button" style={shell.actionBtn} onClick={convertToInvoice} disabled={!role.canWrite || busy}>Convert to Invoice</button>
            </div>

            <div style={detailGridStyle}>
              <div style={shell.subGrid}>
                <p style={shell.label}>Assign Technician(s) After Renewal</p>
                <select
                  multiple
                  style={{ ...shell.input, minHeight: '100px', padding: '8px' }}
                  disabled={!role.canWrite || busy}
                  value={form.technicians}
                  onChange={(event) => {
                    const next = Array.from(event.target.selectedOptions).map((option) => option.value);
                    setForm((prev) => ({ ...prev, technicians: next }));
                  }}
                >
                  {technicianOptions.map((entry) => (
                    <option key={entry._id} value={entry._id}>
                      {[entry.firstName, entry.lastName].filter(Boolean).join(' ').trim() || entry.empCode || 'Technician'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Reminder Message</p>
                <textarea style={{ ...shell.input, minHeight: '100px', padding: '8px' }} disabled={!role.canWrite || busy} value={form.reminderMessage} onChange={(event) => setForm((prev) => ({ ...prev, reminderMessage: event.target.value }))} />
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Reminder Actions</p>
                <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" style={shell.actionBtn} onClick={() => sendReminder('whatsapp')} disabled={!role.canWrite || busy}><MessageSquare size={14} style={{ verticalAlign: 'middle' }} /> WhatsApp</button>
                  <button type="button" style={shell.actionBtn} onClick={() => sendReminder('email')} disabled={!role.canWrite || busy}>Email</button>
                </div>
              </div>
              <div style={shell.subGrid}>
                <p style={shell.label}>Service Assignment</p>
                <button type="button" style={shell.actionBtn} onClick={assignTechnicians} disabled={!role.canWrite || busy}><UserCheck size={14} style={{ verticalAlign: 'middle' }} /> Assign Technician</button>
              </div>
            </div>

            <div style={shell.panel}>
              <div style={shell.panelHead}>
                <h3 style={{ ...shell.panelTitle, fontSize: '15px' }}><CalendarClock size={15} style={{ verticalAlign: 'middle' }} /> Customer Renewal History</h3>
                <button type="button" style={shell.actionBtn} onClick={refreshHistory}>Reload History</button>
              </div>
              {historyLoading ? <div style={shell.empty}>Loading history...</div> : null}
              {!historyLoading && history.length === 0 ? <div style={shell.empty}>No contract renewal history available.</div> : null}
              {!historyLoading && history.length > 0 ? (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={shell.th}>Invoice#</th>
                        <th style={shell.th}>Contract Start</th>
                        <th style={shell.th}>Contract End</th>
                        <th style={shell.th}>Status</th>
                        <th style={shell.th}>Amount</th>
                        <th style={shell.th}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry) => (
                        <tr key={entry.invoiceId || entry.invoiceNumber}>
                          <td style={shell.td}>{entry.invoiceNumber || '-'}</td>
                          <td style={shell.td}>{formatDate(entry.contractStartDate)}</td>
                          <td style={shell.td}>{formatDate(entry.contractEndDate)}</td>
                          <td style={shell.td}>{entry.status || '-'}</td>
                          <td style={shell.td}>{formatINR(entry.totalAmount)}</td>
                          <td style={shell.td}>{formatINR(entry.balanceDue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {historyDrawer.open ? (
        <div onClick={() => setHistoryDrawer({ open: false, row: null })} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', zIndex: 5000 }}>
          <aside onClick={(event) => event.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, width: 'min(520px,95vw)', height: '100%', background: '#fff', borderLeft: '1px solid var(--color-border)', padding: 12, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{historyDrawer.row?.customerName || 'Customer'} History</h3>
              <button type="button" style={shell.rowAction} onClick={() => setHistoryDrawer({ open: false, row: null })}><X size={14} /></button>
            </div>
            {historyLoading ? <div style={shell.empty}>Loading history...</div> : null}
            {!historyLoading && history.length === 0 ? <div style={shell.empty}>No contract renewal history available.</div> : null}
            {!historyLoading && history.length > 0 ? (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead><tr><th style={shell.th}>Invoice#</th><th style={shell.th}>Start</th><th style={shell.th}>End</th><th style={shell.th}>Status</th><th style={shell.th}>Amount</th></tr></thead>
                  <tbody>{history.map((entry) => <tr key={entry.invoiceId || entry.invoiceNumber}><td style={shell.td}>{entry.invoiceNumber || '-'}</td><td style={shell.td}>{formatDate(entry.contractStartDate)}</td><td style={shell.td}>{formatDate(entry.contractEndDate)}</td><td style={shell.td}>{entry.status || '-'}</td><td style={shell.td}>{formatINR(entry.totalAmount)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
