import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  BadgeIndianRupee,
  CalendarCheck,
  Users,
  Wallet
} from 'lucide-react';
import useColumnResize from './table/useColumnResize';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const now = new Date();

const shell = {
  page: { display: 'grid', gap: '14px' },
  hero: {
    borderRadius: '20px',
    border: '1px solid rgba(159, 23, 77, 0.26)',
    background: 'var(--color-primary)',
    padding: '16px',
    display: 'grid',
    gap: '10px'
  },
  title: { margin: 0, fontSize: '27px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' },
  subtitle: { margin: 0, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.92)' },
  panel: {
    borderRadius: '16px',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: 'var(--shadow-soft)',
    padding: '14px',
    display: 'grid',
    gap: '10px'
  },
  panelTitle: { margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '7px' },
  panelSub: { margin: 0, fontSize: '12px', color: '#475569' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' },
  field: { display: 'grid', gap: '4px' },
  label: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', minHeight: '35px', borderRadius: '9px', border: '1px solid #D1D5DB', padding: '8px 10px', fontSize: '13px', background: '#fff' },
  btn: {
    border: '1px solid rgba(159, 23, 77, 0.36)',
    borderRadius: '9px',
    minHeight: '35px',
    padding: '0 11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer'
  },
  btnLight: {
    border: '1px solid #D1D5DB',
    borderRadius: '9px',
    minHeight: '35px',
    padding: '0 11px',
    fontSize: '12px',
    fontWeight: 700,
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer'
  },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  statCard: { borderRadius: '13px', border: '1px solid rgba(159, 23, 77, 0.2)', background: '#fff', padding: '10px', display: 'grid', gap: '6px' },
  statLabel: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' },
  split2: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '10px' },
  chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '10px' },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '8px' },
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    border: '1px solid rgba(159, 23, 77, 0.16)',
    borderRadius: '10px',
    padding: '8px 10px',
    background: '#fff'
  },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', border: '1px solid rgba(159, 23, 77, 0.25)', padding: '3px 8px', fontSize: '11px', fontWeight: 700 },
  kanbanBoard: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))', gap: '10px', overflowX: 'auto', paddingBottom: '4px' },
  kanbanCol: { minHeight: '240px', borderRadius: '13px', border: '1px solid rgba(159, 23, 77, 0.2)', background: 'rgba(248,250,252,0.92)', padding: '8px', display: 'grid', gap: '8px', alignContent: 'start' },
  kanbanHead: { margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  card: { borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.18)', background: '#fff', padding: '8px', display: 'grid', gap: '6px', cursor: 'pointer' },
  tiny: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 },
  cardTitle: { margin: 0, fontSize: '13px', color: '#0f172a', fontWeight: 800 },
  tableWrap: { borderRadius: '12px', border: '1px solid var(--color-primary-soft)', overflowX: 'auto', background: '#fff' },
  table: { width: '100%', minWidth: '760px', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 9px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  td: { padding: '8px 9px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600, verticalAlign: 'top' },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.46)', display: 'grid', placeItems: 'center', zIndex: 99, padding: '14px' },
  modal: { width: 'min(860px, 100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.2)', background: '#fff', padding: '14px', display: 'grid', gap: '10px' },
  modalGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }
};

const monthOptions = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: new Date(2026, index, 1).toLocaleString('en-IN', { month: 'long' })
}));

const leaveOptions = [
  { value: 'Casual Leave (CL)', label: 'Casual Leave (CL)' },
  { value: 'Sick Leave (SL)', label: 'Sick Leave (SL)' },
  { value: 'Paid Leave', label: 'Paid Leave' },
  { value: 'Unpaid Leave (LWP)', label: 'Unpaid Leave (LWP)' },
  { value: 'Half Day Leave', label: 'Half Day Leave' },
  { value: 'Weekly Off', label: 'Weekly Off' },
  { value: 'Public Holiday', label: 'Public Holiday' },
  { value: 'Outdoor Duty', label: 'Outdoor Duty' },
  { value: 'Absent', label: 'Absent' }
];

const roleFlags = () => {
  const roleRaw = String(localStorage.getItem('portal_user_role') || 'Admin').trim().toLowerCase();
  const isAdmin = roleRaw === 'admin' || roleRaw === '';
  const isHr = roleRaw.includes('hr');
  const isManager = roleRaw.includes('manager');
  const isAccount = roleRaw.includes('account');
  const canManage = isAdmin || isHr;
  const canViewTeam = isAdmin || isHr || isManager || isAccount;
  return { roleRaw, canManage, canViewTeam };
};

const hrLeaveColumns = [
  { key: 'employee', label: 'Employee' },
  { key: 'type', label: 'Type' },
  { key: 'period', label: 'From/To' },
  { key: 'days', label: 'Days' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: 'Action' }
];
const hrLeaveWidths = {
  employee: 180,
  type: 140,
  period: 180,
  days: 90,
  status: 110,
  action: 170
};
const hrLeaveBounds = {
  employee: { min: 150, max: 260 },
  type: { min: 120, max: 180 },
  period: { min: 150, max: 240 },
  days: { min: 80, max: 120 },
  status: { min: 90, max: 140 },
  action: { min: 140, max: 220 }
};

const hrBalanceColumns = [
  { key: 'employee', label: 'Employee' },
  { key: 'paid', label: 'Paid Leave Balance' },
  { key: 'sick', label: 'Sick Leave Balance' },
  { key: 'unpaid', label: 'Unpaid Used' }
];
const hrBalanceWidths = {
  employee: 180,
  paid: 150,
  sick: 150,
  unpaid: 120
};
const hrBalanceBounds = {
  employee: { min: 150, max: 260 },
  paid: { min: 130, max: 220 },
  sick: { min: 130, max: 220 },
  unpaid: { min: 100, max: 160 }
};

const hrPayrollColumns = [
  { key: 'employee', label: 'Pending Employee' },
  { key: 'amount', label: 'Amount' }
];
const hrPayrollWidths = {
  employee: 240,
  amount: 120
};
const hrPayrollBounds = {
  employee: { min: 180, max: 320 },
  amount: { min: 100, max: 180 }
};

const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const baseHeaders = () => ({
  'x-role': localStorage.getItem('portal_user_role') || 'Admin',
  'x-user-name': localStorage.getItem('portal_user_name') || 'System',
  'x-user-id': localStorage.getItem('portal_user_id') || ''
});

function MiniBarChart({ rows = [], nameKey = 'name', valueKey = 'value', color = 'var(--color-primary)' }) {
  if (!rows.length) return <p style={shell.panelSub}>No data available.</p>;
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const percent = Math.max(3, Math.round((value / max) * 100));
        return (
          <div key={`${row[nameKey]}-${value}`} style={{ display: 'grid', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{row[nameKey]}</span>
              <span style={{ color: '#334155', fontWeight: 700 }}>{value}</span>
            </div>
            <div style={{ height: '8px', background: 'var(--color-border)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${percent}%`, height: '100%', background: color || 'var(--color-primary)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InsightList({ title, rows = [], valuePrefix = '' }) {
  return (
    <div style={shell.panel}>
      <h3 style={shell.panelTitle}>{title}</h3>
      <ul style={shell.list}>
        {rows.length === 0 ? <li style={shell.panelSub}>No items.</li> : null}
        {rows.map((row) => (
          <li key={`${row.employeeId}-${row.employeeName}`} style={shell.listRow}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{row.employeeName}</p>
              {row.date ? <p style={shell.tiny}>Date: {row.date}</p> : null}
            </div>
            <span style={{ ...shell.badge, color: 'var(--color-primary-dark)', borderColor: 'rgba(159, 23, 77, 0.26)' }}>{valuePrefix}{money(row.value || 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HRDashboard() {
  const role = useMemo(() => roleFlags(), []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [filterOptions, setFilterOptions] = useState({ departments: [], roles: [], locations: [], statuses: [] });
  const [filters, setFilters] = useState({ search: '', department: '', role: '', location: '', status: '' });

  const [summary, setSummary] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [payrollQuick, setPayrollQuick] = useState(null);
  const [employees, setEmployees] = useState([]);

  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Paid Leave', fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), days: 1, reason: '' });

  const headers = useMemo(() => baseHeaders(), []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const queryParams = useMemo(() => ({
    month,
    year,
    search: filters.search || undefined,
    department: filters.department || undefined,
    role: filters.role || undefined,
    location: filters.location || undefined,
    status: filters.status || undefined
  }), [filters, month, year]);

  const fetchAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setBusy(true);
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/api/hr/filters`, { headers }),
        axios.get(`${API_BASE}/api/hr/dashboard-summary`, { params: queryParams, headers }),
        axios.get(`${API_BASE}/api/hr/leaves`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/hr/leaves/balance`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/hr/payroll-summary`, { params: queryParams, headers }),
        axios.get(`${API_BASE}/api/employees`, { headers })
      ]);

      const hasFailure = results.some((entry) => entry.status === 'rejected');
      const getData = (index, fallback) => (
        results[index]?.status === 'fulfilled' ? results[index].value?.data : fallback
      );

      setFilterOptions(getData(0, { departments: [], roles: [], locations: [], statuses: [] }));
      setSummary(getData(1, null));
      setLeaves(Array.isArray(getData(2, [])) ? getData(2, []) : []);
      setLeaveBalances(Array.isArray(getData(3, [])) ? getData(3, []) : []);
      setPayrollQuick(getData(4, null));
      setEmployees(Array.isArray(getData(5, [])) ? getData(5, []) : []);
      setStatus(hasFailure ? 'Some HR data could not be loaded. Showing available data.' : '');
    } catch (error) {
      console.error('HR dashboard load failed', error);
      setStatus(error?.response?.data?.error || 'Unable to load HR dashboard right now.');
    } finally {
      if (!silent) setBusy(false);
    }
  }, [headers, month, queryParams, year]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const refreshOnFocus = () => fetchAll(true);
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') fetchAll(true);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll(true);
    }, 30000);

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [fetchAll]);

  const submitLeave = async () => {
    try {
      await axios.post(`${API_BASE}/api/hr/leaves`, leaveForm, { headers });
      setStatus('Leave request submitted.');
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to submit leave request.');
    }
  };

  const decideLeave = async (id, decision) => {
    try {
      await axios.put(`${API_BASE}/api/hr/leaves/${id}/decision`, { decision }, { headers });
      setStatus(`Leave ${decision}.`);
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to update leave status.');
    }
  };

  const generatePayrollQuick = async () => {
    try {
      await axios.post(`${API_BASE}/api/payroll/generate`, { month, year, forceRegenerate: true }, { headers });
      setStatus('Payroll regenerated successfully.');
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to generate payroll.');
    }
  };

  const cards = summary?.cards || {};
  const departmentChart = summary?.charts?.departmentEmployeeCount || [];
  const salaryChart = summary?.charts?.salaryExpenseChart || [];
  const leaveChart = summary?.charts?.leaveTypeDistribution || [];
  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const chartGridStyle = isMobile ? { ...shell.chartGrid, gridTemplateColumns: '1fr' } : shell.chartGrid;
  const leaveFormGridStyle = isMobile
    ? { ...shell.filters, gridTemplateColumns: '1fr' }
    : { ...shell.filters, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' };
  const {
    getColumnWidth: getLeaveColumnWidth,
    startResize: startLeaveResize,
    resetColumns: resetLeaveColumns
  } = useColumnResize({
    storageKey: 'hr_dashboard_leave_table_widths',
    columns: hrLeaveColumns.map((column) => column.key),
    defaultColumnWidths: hrLeaveWidths,
    columnBounds: hrLeaveBounds,
    minWidth: 80,
  });
  const {
    getColumnWidth: getBalanceColumnWidth,
    startResize: startBalanceResize,
    resetColumns: resetBalanceColumns
  } = useColumnResize({
    storageKey: 'hr_dashboard_balance_table_widths',
    columns: hrBalanceColumns.map((column) => column.key),
    defaultColumnWidths: hrBalanceWidths,
    columnBounds: hrBalanceBounds,
    minWidth: 80,
  });
  const {
    getColumnWidth: getPayrollColumnWidth,
    startResize: startPayrollResize,
    resetColumns: resetPayrollColumns
  } = useColumnResize({
    storageKey: 'hr_dashboard_payroll_table_widths',
    columns: hrPayrollColumns.map((column) => column.key),
    defaultColumnWidths: hrPayrollWidths,
    columnBounds: hrPayrollBounds,
    minWidth: 80,
  });
  const leaveTableMinWidth = hrLeaveColumns.reduce((sum, column) => sum + (getLeaveColumnWidth(column.key) || hrLeaveWidths[column.key] || 80), 0);
  const balanceTableMinWidth = hrBalanceColumns.reduce((sum, column) => sum + (getBalanceColumnWidth(column.key) || hrBalanceWidths[column.key] || 80), 0);
  const payrollTableMinWidth = hrPayrollColumns.reduce((sum, column) => sum + (getPayrollColumnWidth(column.key) || hrPayrollWidths[column.key] || 80), 0);
  const leaveTableStyle = { ...shell.table, minWidth: `${Math.max(920, leaveTableMinWidth)}px` };
  const balanceTableStyle = { ...shell.table, minWidth: `${Math.max(920, balanceTableMinWidth)}px` };
  const payrollTableStyle = { ...shell.table, minWidth: `${Math.max(920, payrollTableMinWidth)}px` };
  const headStyle = (getWidth, key, align = 'left') => ({
    ...shell.th,
    position: 'relative',
    width: `${getWidth(key)}px`,
    minWidth: `${getWidth(key)}px`,
    maxWidth: `${getWidth(key)}px`,
    textAlign: align
  });
  const bodyStyle = (getWidth, key, align = 'left') => ({
    ...shell.td,
    width: `${getWidth(key)}px`,
    minWidth: `${getWidth(key)}px`,
    maxWidth: `${getWidth(key)}px`,
    textAlign: align
  });

  return (
    <div style={shell.page}>
      <section style={shell.hero}>
        <h1 style={shell.title}>HR Dashboard</h1>
        <p style={shell.subtitle}>Eagle-eye view for workforce, attendance, payroll, leaves, productivity, and employee lifecycle actions.</p>
      </section>

      {status ? <div style={{ ...shell.panel, borderColor: 'rgba(159, 23, 77, 0.3)', color: 'var(--color-primary-deep)', fontWeight: 700 }}>{status}</div> : null}
      {busy ? <div style={shell.panelSub}>Loading HR dashboard data...</div> : null}

      <section style={shell.panel}>
        <h3 style={shell.panelTitle}><Activity size={16} /> Workforce Snapshot</h3>
        <div style={shell.statGrid}>
          <div style={shell.statCard}><p style={shell.statLabel}>Total Employees</p><p style={shell.statValue}>{cards.totalEmployees || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Technicians On Duty</p><p style={shell.statValue}>{cards.techniciansOnDutyToday || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Absent Today</p><p style={shell.statValue}>{cards.absentToday || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>On Leave Today</p><p style={shell.statValue}>{cards.onLeaveToday || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Total Payroll (Month)</p><p style={shell.statValue}>₹{money(cards.totalPayrollCurrentMonth || 0)}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Pending Salary</p><p style={shell.statValue}>₹{money(cards.pendingSalaryPayments || 0)}</p></div>
        </div>
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><Users size={16} /> Department-wise Employee Count</h3>
          <MiniBarChart rows={departmentChart} nameKey="name" valueKey="value" color="var(--color-primary)" />
        </div>

        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><Wallet size={16} /> Salary Expense Chart</h3>
          <MiniBarChart rows={salaryChart} nameKey="month" valueKey="amount" color="var(--color-primary-dark)" />
        </div>

        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><CalendarCheck size={16} /> Leave Type Distribution</h3>
          <MiniBarChart rows={leaveChart} nameKey="name" valueKey="value" color="#0f766e" />
        </div>
      </section>

      <section style={chartGridStyle}>
        <InsightList title="Employees with Highest Leaves" rows={summary?.quickInsights?.highestLeaves || []} />
        <InsightList title="Frequent Late Marks" rows={summary?.quickInsights?.frequentLateMarks || []} />
        <InsightList title="Top Performing Technicians" rows={summary?.quickInsights?.topPerformers || []} />
        <InsightList title="Upcoming Birthdays" rows={summary?.quickInsights?.upcomingBirthdays || []} />
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><CalendarCheck size={16} /> Leave Management</h3>
          <p style={shell.panelSub}>Approve/reject requests with leave balances visible per employee.</p>
          <div style={leaveFormGridStyle}>
            <div style={shell.field}>
              <p style={shell.label}>Employee</p>
              <select style={shell.input} value={leaveForm.employeeId} onChange={(event) => setLeaveForm((prev) => ({ ...prev, employeeId: event.target.value }))}>
                <option value="">Select</option>
                {employees.map((employee) => <option key={employee._id} value={employee._id}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.empCode}</option>)}
              </select>
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Leave Type</p>
              <select style={shell.input} value={leaveForm.leaveType} onChange={(event) => setLeaveForm((prev) => ({ ...prev, leaveType: event.target.value }))}>
                {leaveOptions.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </div>
            <div style={shell.field}><p style={shell.label}>From</p><input style={shell.input} type="date" value={leaveForm.fromDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, fromDate: event.target.value }))} /></div>
            <div style={shell.field}><p style={shell.label}>To</p><input style={shell.input} type="date" value={leaveForm.toDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, toDate: event.target.value }))} /></div>
            <div style={shell.field}><p style={shell.label}>Days</p><input style={shell.input} type="number" min="0.5" step="0.5" value={leaveForm.days} onChange={(event) => setLeaveForm((prev) => ({ ...prev, days: Number(event.target.value) || 1 }))} /></div>
            <div style={shell.field}><p style={shell.label}>Reason</p><input style={shell.input} value={leaveForm.reason} onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))} /></div>
            <div style={{ ...shell.field, alignSelf: 'end' }}><button type="button" style={shell.btn} onClick={submitLeave}>Submit Leave</button></div>
          </div>

          <div style={shell.tableWrap}>
            <table style={leaveTableStyle}>
              <colgroup>
                {hrLeaveColumns.map((column) => (
                  <col key={column.key} style={{ width: `${getLeaveColumnWidth(column.key)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={headStyle(getLeaveColumnWidth, 'employee')}>Employee</th>
                  <th style={headStyle(getLeaveColumnWidth, 'type', 'center')}>Type</th>
                  <th style={headStyle(getLeaveColumnWidth, 'period', 'center')}>From/To</th>
                  <th style={headStyle(getLeaveColumnWidth, 'days', 'center')}>Days</th>
                  <th style={headStyle(getLeaveColumnWidth, 'status', 'center')}>Status</th>
                  <th style={headStyle(getLeaveColumnWidth, 'action', 'center')}>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaves.slice(0, 12).map((entry) => (
                  <tr key={entry._id}>
                    <td style={bodyStyle(getLeaveColumnWidth, 'employee')}>{entry.employeeName}</td>
                    <td style={bodyStyle(getLeaveColumnWidth, 'type', 'center')}>{entry.displayLeaveType || entry.leaveType}</td>
                    <td style={bodyStyle(getLeaveColumnWidth, 'period', 'center')}>{entry.fromDate} to {entry.toDate}</td>
                    <td style={bodyStyle(getLeaveColumnWidth, 'days', 'center')}>{entry.days}</td>
                    <td style={bodyStyle(getLeaveColumnWidth, 'status', 'center')}><span style={shell.badge}>{entry.status}</span></td>
                    <td style={bodyStyle(getLeaveColumnWidth, 'action', 'center')}>
                      {role.canManage && entry.status === 'Pending' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" style={shell.btnLight} onClick={() => decideLeave(entry._id, 'approved')}>Approve</button>
                          <button type="button" style={shell.btnLight} onClick={() => decideLeave(entry._id, 'rejected')}>Reject</button>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={shell.tableWrap}>
            <table style={balanceTableStyle}>
              <colgroup>
                {hrBalanceColumns.map((column) => (
                  <col key={column.key} style={{ width: `${getBalanceColumnWidth(column.key)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={headStyle(getBalanceColumnWidth, 'employee')}>Employee</th>
                  <th style={headStyle(getBalanceColumnWidth, 'paid', 'center')}>Paid Leave Balance</th>
                  <th style={headStyle(getBalanceColumnWidth, 'sick', 'center')}>Sick Leave Balance</th>
                  <th style={headStyle(getBalanceColumnWidth, 'unpaid', 'center')}>Unpaid Used</th>
                </tr>
              </thead>
              <tbody>
                {leaveBalances.slice(0, 10).map((entry) => (
                  <tr key={entry.employeeId}>
                    <td style={bodyStyle(getBalanceColumnWidth, 'employee')}>{entry.employeeName}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'paid', 'center')}>{entry.paidLeave?.balance ?? 0}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'sick', 'center')}>{entry.sickLeave?.balance ?? 0}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'unpaid', 'center')}>{entry.unpaidLeave?.used ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><BadgeIndianRupee size={16} /> Payroll Quick View</h3>
          <div style={shell.statGrid}>
            <div style={shell.statCard}><p style={shell.statLabel}>Processed</p><p style={shell.statValue}>{payrollQuick?.salaryProcessedThisMonth || 0}</p></div>
            <div style={shell.statCard}><p style={shell.statLabel}>Paid Amount</p><p style={shell.statValue}>₹{money(payrollQuick?.paidSalaryAmount || 0)}</p></div>
            <div style={shell.statCard}><p style={shell.statLabel}>Pending Amount</p><p style={shell.statValue}>₹{money(payrollQuick?.pendingSalaryAmount || 0)}</p></div>
            <div style={shell.statCard}><p style={shell.statLabel}>Advance Given</p><p style={shell.statValue}>₹{money(payrollQuick?.advanceSalaryGiven || 0)}</p></div>
            <div style={shell.statCard}><p style={shell.statLabel}>Deductions</p><p style={shell.statValue}>₹{money(payrollQuick?.deductionsSummary || 0)}</p></div>
            <div style={shell.statCard}><p style={shell.statLabel}>Advance Balance</p><p style={shell.statValue}>₹{money(payrollQuick?.advanceSalaryBalance || 0)}</p></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" style={shell.btn} onClick={generatePayrollQuick} disabled={!role.canManage}>Generate Payroll</button>
          </div>
          <div style={shell.tableWrap}>
            <table style={payrollTableStyle}>
              <colgroup>
                {hrPayrollColumns.map((column) => (
                  <col key={column.key} style={{ width: `${getPayrollColumnWidth(column.key)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={headStyle(getPayrollColumnWidth, 'employee')}>Pending Employee</th>
                  <th style={headStyle(getPayrollColumnWidth, 'amount', 'center')}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(payrollQuick?.employeesWithPendingSalary || []).slice(0, 12).map((entry) => (
                  <tr key={`${entry.employeeId}-${entry.employeeName}`}>
                    <td style={bodyStyle(getPayrollColumnWidth, 'employee')}>{entry.employeeName}</td>
                    <td style={bodyStyle(getPayrollColumnWidth, 'amount', 'center')}>₹{money(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
