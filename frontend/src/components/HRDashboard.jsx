import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  BadgeIndianRupee,
  Bell,
  CalendarCheck,
  Clock3,
  Download,
  Filter,
  IdCard,
  KanbanSquare,
  TrendingUp,
  UserCheck,
  Users,
  Wallet
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
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

const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const baseHeaders = () => ({
  'x-role': localStorage.getItem('portal_user_role') || 'Admin',
  'x-user-name': localStorage.getItem('portal_user_name') || 'System',
  'x-user-id': localStorage.getItem('portal_user_id') || ''
});

function MiniLineChart({ rows = [], valueKey = 'onDuty', stroke = 'var(--color-primary)' }) {
  if (!rows.length) return <p style={shell.panelSub}>No data available.</p>;
  const width = 460;
  const height = 140;
  const padding = 20;
  const values = rows.map((row) => Number(row[valueKey] || 0));
  const max = Math.max(1, ...values);

  const points = rows.map((row, index) => {
    const x = padding + (index * ((width - (padding * 2)) / Math.max(1, rows.length - 1)));
    const y = height - padding - ((Number(row[valueKey] || 0) / max) * (height - (padding * 2)));
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '140px', overflow: 'visible' }}>
      <rect x="0" y="0" width={width} height={height} fill="rgba(252,231,243,0.6)" rx="12" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((row, index) => {
        const x = padding + (index * ((width - (padding * 2)) / Math.max(1, rows.length - 1)));
        const y = height - padding - ((Number(row[valueKey] || 0) / max) * (height - (padding * 2)));
        return <circle key={`${row.label}-${index}`} cx={x} cy={y} r="2.8" fill={stroke} />;
      })}
    </svg>
  );
}

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

const workflowColumns = ['New Joiners', 'Active Employees', 'On Probation', 'On Leave', 'Under Review', 'Resigned', 'Terminated'];

export default function HRDashboard() {
  const role = useMemo(() => roleFlags(), []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [filterOptions, setFilterOptions] = useState({ departments: [], roles: [], locations: [], statuses: workflowColumns });
  const [filters, setFilters] = useState({ search: '', department: '', role: '', location: '', status: '' });

  const [summary, setSummary] = useState(null);
  const [kanban, setKanban] = useState({ columns: workflowColumns.map((name) => ({ name, items: [] })) });
  const [attendanceToday, setAttendanceToday] = useState({ summary: {}, rows: [] });
  const [leaves, setLeaves] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [performance, setPerformance] = useState({ leaderboard: [], lowPerformanceAlerts: [], chart: [] });
  const [payrollQuick, setPayrollQuick] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [attendanceForm, setAttendanceForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), status: 'present', checkIn: '09:00', checkOut: '18:00', notes: '' });
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Paid Leave', fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), days: 1, reason: '' });

  const [dragState, setDragState] = useState({ employeeId: '', fromColumn: '' });
  const [profileModal, setProfileModal] = useState({ open: false, loading: false, profile: null });

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

  const fetchAll = async () => {
    try {
      setBusy(true);
      const [
        optionsRes,
        summaryRes,
        kanbanRes,
        attendanceRes,
        leavesRes,
        leaveBalanceRes,
        performanceRes,
        payrollQuickRes,
        notificationsRes,
        employeesRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/api/hr/filters`, { headers }),
        axios.get(`${API_BASE}/api/hr/dashboard-summary`, { params: queryParams, headers }),
        axios.get(`${API_BASE}/api/hr/kanban`, { params: queryParams, headers }),
        axios.get(`${API_BASE}/api/hr/attendance/today`, { headers }),
        axios.get(`${API_BASE}/api/hr/leaves`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/hr/leaves/balance`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/hr/performance`, { params: queryParams, headers }),
        axios.get(`${API_BASE}/api/hr/payroll-summary`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/hr/notifications`, { headers }),
        axios.get(`${API_BASE}/api/employees`, { headers })
      ]);

      setFilterOptions(optionsRes.data || { departments: [], roles: [], locations: [], statuses: workflowColumns });
      setSummary(summaryRes.data || null);
      setKanban(kanbanRes.data || { columns: workflowColumns.map((name) => ({ name, items: [] })) });
      setAttendanceToday(attendanceRes.data || { summary: {}, rows: [] });
      setLeaves(Array.isArray(leavesRes.data) ? leavesRes.data : []);
      setLeaveBalances(Array.isArray(leaveBalanceRes.data) ? leaveBalanceRes.data : []);
      setPerformance(performanceRes.data || { leaderboard: [], lowPerformanceAlerts: [], chart: [] });
      setPayrollQuick(payrollQuickRes.data || null);
      setNotifications(Array.isArray(notificationsRes.data) ? notificationsRes.data : []);
      setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      setStatus('');
    } catch (error) {
      console.error('HR dashboard load failed', error);
      setStatus(error?.response?.data?.error || 'Unable to load HR dashboard right now.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, filters.search, filters.department, filters.role, filters.location, filters.status]);

  const handleDropToColumn = async (columnName) => {
    if (!dragState.employeeId || !role.canManage) return;
    try {
      await axios.put(`${API_BASE}/api/hr/employees/${dragState.employeeId}/status`, {
        status: columnName,
        currentTask: 'Updated from HR dashboard workflow board'
      }, { headers });
      setStatus(`Workflow status moved to ${columnName}.`);
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to update workflow status.');
    } finally {
      setDragState({ employeeId: '', fromColumn: '' });
    }
  };

  const openProfile = async (employeeId) => {
    try {
      setProfileModal({ open: true, loading: true, profile: null });
      const res = await axios.get(`${API_BASE}/api/hr/employees/${employeeId}/profile`, { headers });
      setProfileModal({ open: true, loading: false, profile: res.data || null });
    } catch (error) {
      setProfileModal({ open: true, loading: false, profile: null });
      setStatus(error?.response?.data?.error || 'Unable to load employee profile.');
    }
  };

  const submitManualAttendance = async () => {
    try {
      await axios.post(`${API_BASE}/api/hr/attendance/manual`, attendanceForm, { headers });
      setStatus('Attendance marked successfully.');
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to mark attendance.');
    }
  };

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

  const markNotificationRead = async (id) => {
    try {
      await axios.put(`${API_BASE}/api/hr/notifications/${id}/read`, {}, { headers });
      setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, isRead: true } : item)));
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to mark notification read.');
    }
  };

  const generatePayrollQuick = async () => {
    try {
      await axios.post(`${API_BASE}/api/payroll/generate`, { month, year }, { headers });
      setStatus('Payroll generated successfully.');
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to generate payroll.');
    }
  };

  const downloadReport = async (reportType, format = 'csv') => {
    try {
      const url = `${API_BASE}/api/hr/reports/${reportType}`;
      const response = await axios.get(url, {
        params: { month, year, format },
        headers,
        responseType: 'blob'
      });
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const blobUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${reportType}_${year}_${String(month).padStart(2, '0')}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to export report.');
    }
  };

  const cards = summary?.cards || {};
  const attendanceTrend = summary?.charts?.attendanceTrend || [];
  const departmentChart = summary?.charts?.departmentEmployeeCount || [];
  const salaryChart = summary?.charts?.salaryExpenseChart || [];
  const leaveChart = summary?.charts?.leaveTypeDistribution || [];
  const productivityChart = summary?.charts?.technicianProductivity || [];

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 12),
    [notifications]
  );
  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const chartGridStyle = isMobile ? { ...shell.chartGrid, gridTemplateColumns: '1fr' } : shell.chartGrid;
  const kanbanBoardStyle = isMobile ? { ...shell.kanbanBoard, gridTemplateColumns: 'repeat(7, minmax(240px, 1fr))' } : shell.kanbanBoard;
  const tableStyle = isMobile ? { ...shell.table, minWidth: '920px' } : shell.table;
  const modalStyle = isMobile ? { ...shell.modal, width: '100%', maxWidth: '100%' } : shell.modal;
  const modalGridStyle = isTablet || isMobile ? { ...shell.modalGrid, gridTemplateColumns: '1fr' } : shell.modalGrid;
  const attendanceFormGridStyle = isMobile
    ? { ...shell.filters, gridTemplateColumns: '1fr' }
    : { ...shell.filters, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' };
  const leaveFormGridStyle = isMobile
    ? { ...shell.filters, gridTemplateColumns: '1fr' }
    : { ...shell.filters, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' };

  return (
    <div style={shell.page}>
      <section style={shell.hero}>
        <h1 style={shell.title}>HR Dashboard</h1>
        <p style={shell.subtitle}>Eagle-eye view for workforce, attendance, payroll, leaves, productivity, and employee lifecycle actions.</p>
      </section>

      <section style={shell.panel}>
        <h3 style={shell.panelTitle}><Filter size={16} /> Filters & Search</h3>
        <div style={shell.filters}>
          <div style={shell.field}>
            <p style={shell.label}>Search</p>
            <input style={shell.input} value={filters.search} placeholder="Employee name or ID" onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Department</p>
            <select style={shell.input} value={filters.department} onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}>
              <option value="">All</option>
              {(filterOptions.departments || []).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Role</p>
            <select style={shell.input} value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}>
              <option value="">All</option>
              {(filterOptions.roles || []).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Location</p>
            <select style={shell.input} value={filters.location} onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}>
              <option value="">All</option>
              {(filterOptions.locations || []).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Status</p>
            <select style={shell.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="">All</option>
              {(filterOptions.statuses || workflowColumns).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Month</p>
            <select style={shell.input} value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Year</p>
            <input style={shell.input} type="number" value={year} min="2020" max="2100" onChange={(event) => setYear(Number(event.target.value) || now.getFullYear())} />
          </div>
          <div style={{ ...shell.field, alignSelf: 'end' }}>
            <button type="button" style={shell.btnLight} onClick={() => setFilters({ search: '', department: '', role: '', location: '', status: '' })}>Reset Filters</button>
          </div>
        </div>
      </section>

      {status ? <div style={{ ...shell.panel, borderColor: 'rgba(159, 23, 77, 0.3)', color: 'var(--color-primary-deep)', fontWeight: 700 }}>{status}</div> : null}
      {busy ? <div style={shell.panelSub}>Loading HR dashboard data...</div> : null}

      <section style={shell.panel}>
        <h3 style={shell.panelTitle}><Activity size={16} /> Workforce Snapshot</h3>
        <div style={shell.statGrid}>
          <div style={shell.statCard}><p style={shell.statLabel}>Total Employees</p><p style={shell.statValue}>{cards.totalEmployees || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Active Employees</p><p style={shell.statValue}>{cards.activeEmployees || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Inactive Employees</p><p style={shell.statValue}>{cards.inactiveEmployees || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Technicians On Duty</p><p style={shell.statValue}>{cards.techniciansOnDutyToday || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Absent Today</p><p style={shell.statValue}>{cards.absentToday || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>On Leave Today</p><p style={shell.statValue}>{cards.onLeaveToday || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Late Check-ins</p><p style={shell.statValue}>{cards.lateCheckins || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Total Payroll (Month)</p><p style={shell.statValue}>₹{money(cards.totalPayrollCurrentMonth || 0)}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Pending Salary</p><p style={shell.statValue}>₹{money(cards.pendingSalaryPayments || 0)}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>Overtime Hours</p><p style={shell.statValue}>{cards.totalOvertimeHours || 0}</p></div>
          <div style={shell.statCard}><p style={shell.statLabel}>New Joinees (Month)</p><p style={shell.statValue}>{cards.newJoineesThisMonth || 0}</p></div>
        </div>
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><TrendingUp size={16} /> Attendance Trend</h3>
          <MiniLineChart rows={attendanceTrend} valueKey="onDuty" />
        </div>

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

        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><UserCheck size={16} /> Technician Productivity</h3>
          <MiniBarChart rows={productivityChart} nameKey="employeeName" valueKey="jobsCompleted" color="var(--color-primary-dark)" />
        </div>
      </section>

      <section style={chartGridStyle}>
        <InsightList title="Employees with Highest Leaves" rows={summary?.quickInsights?.highestLeaves || []} />
        <InsightList title="Frequent Late Marks" rows={summary?.quickInsights?.frequentLateMarks || []} />
        <InsightList title="Top Performing Technicians" rows={summary?.quickInsights?.topPerformers || []} />
        <InsightList title="Employees Pending Salary" rows={summary?.quickInsights?.pendingSalary || []} valuePrefix="₹" />
        <InsightList title="Upcoming Birthdays" rows={summary?.quickInsights?.upcomingBirthdays || []} />
      </section>

      <section style={shell.panel}>
        <h3 style={shell.panelTitle}><KanbanSquare size={16} /> HR Workflow Board</h3>
        <p style={shell.panelSub}>Drag employee cards across lifecycle columns to update HR status in real-time.</p>
        <div style={kanbanBoardStyle}>
          {(kanban.columns || []).map((column) => (
            <div
              key={column.name}
              style={shell.kanbanCol}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDropToColumn(column.name)}
            >
              <p style={shell.kanbanHead}>
                <span>{column.name}</span>
                <span style={shell.badge}>{(column.items || []).length}</span>
              </p>

              {(column.items || []).map((item) => (
                <div
                  key={item.employeeId}
                  style={shell.card}
                  draggable={role.canManage}
                  onDragStart={() => setDragState({ employeeId: item.employeeId, fromColumn: column.name })}
                  onClick={() => openProfile(item.employeeId)}
                  title="Click to open employee profile"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '7px' }}>
                    <p style={shell.cardTitle}>{item.employeeName}</p>
                    <span style={{ ...shell.badge, color: '#0f766e', borderColor: 'rgba(15,118,110,0.25)' }}>{item.priority || 'Normal'}</span>
                  </div>
                  <p style={shell.tiny}>{item.employeeCode} • {item.role}</p>
                  <p style={shell.tiny}>P/A/L: {item.attendanceSummary?.present || 0}/{item.attendanceSummary?.absent || 0}/{item.attendanceSummary?.leave || 0}</p>
                  <p style={shell.tiny}>Task: {item.currentTask || '-'}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ ...shell.badge, color: 'var(--color-primary-dark)', borderColor: 'rgba(159, 23, 77, 0.28)' }}>{item.status}</span>
                    <span style={{ ...shell.badge, color: item.salaryStatus?.toLowerCase() === 'paid' ? '#166534' : '#92400e', borderColor: item.salaryStatus?.toLowerCase() === 'paid' ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.3)' }}>{item.salaryStatus || 'Pending'}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><Clock3 size={16} /> Attendance Monitoring</h3>
          <p style={shell.panelSub}>Live attendance list with manual marking and bulk action readiness.</p>
          <div style={attendanceFormGridStyle}>
            <div style={shell.field}>
              <p style={shell.label}>Employee</p>
              <select style={shell.input} value={attendanceForm.employeeId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, employeeId: event.target.value }))}>
                <option value="">Select</option>
                {employees.map((employee) => <option key={employee._id} value={employee._id}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.empCode}</option>)}
              </select>
            </div>
            <div style={shell.field}><p style={shell.label}>Date</p><input style={shell.input} type="date" value={attendanceForm.date} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))} /></div>
            <div style={shell.field}><p style={shell.label}>Status</p><select style={shell.input} value={attendanceForm.status} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, status: event.target.value }))}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option><option value="half-day">Half Day</option></select></div>
            <div style={shell.field}><p style={shell.label}>Check-in</p><input style={shell.input} type="time" value={attendanceForm.checkIn} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, checkIn: event.target.value }))} /></div>
            <div style={shell.field}><p style={shell.label}>Check-out</p><input style={shell.input} type="time" value={attendanceForm.checkOut} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, checkOut: event.target.value }))} /></div>
            <div style={{ ...shell.field, alignSelf: 'end' }}>
              <button type="button" style={shell.btn} onClick={submitManualAttendance} disabled={!role.canManage}>Mark Attendance</button>
            </div>
          </div>

          <div style={shell.tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={shell.th}>Employee</th>
                  <th style={shell.th}>Role</th>
                  <th style={shell.th}>Status</th>
                  <th style={shell.th}>Check In</th>
                  <th style={shell.th}>Check Out</th>
                  <th style={shell.th}>Late</th>
                </tr>
              </thead>
              <tbody>
                {(attendanceToday.rows || []).slice(0, 12).map((entry) => (
                  <tr key={`${entry.employeeId}-${entry.status}`}>
                    <td style={shell.td}>{entry.employeeName} ({entry.employeeCode})</td>
                    <td style={shell.td}>{entry.role}</td>
                    <td style={shell.td}><span style={shell.badge}>{entry.status}</span></td>
                    <td style={shell.td}>{entry.checkIn || '-'}</td>
                    <td style={shell.td}>{entry.checkOut || '-'}</td>
                    <td style={shell.td}>{entry.late ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
            <div style={shell.field}><p style={shell.label}>Leave Type</p><select style={shell.input} value={leaveForm.leaveType} onChange={(event) => setLeaveForm((prev) => ({ ...prev, leaveType: event.target.value }))}><option>Paid Leave</option><option>Sick Leave</option><option>Unpaid Leave</option></select></div>
            <div style={shell.field}><p style={shell.label}>From</p><input style={shell.input} type="date" value={leaveForm.fromDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, fromDate: event.target.value }))} /></div>
            <div style={shell.field}><p style={shell.label}>To</p><input style={shell.input} type="date" value={leaveForm.toDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, toDate: event.target.value }))} /></div>
            <div style={shell.field}><p style={shell.label}>Days</p><input style={shell.input} type="number" min="0.5" step="0.5" value={leaveForm.days} onChange={(event) => setLeaveForm((prev) => ({ ...prev, days: Number(event.target.value) || 1 }))} /></div>
            <div style={shell.field}><p style={shell.label}>Reason</p><input style={shell.input} value={leaveForm.reason} onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))} /></div>
            <div style={{ ...shell.field, alignSelf: 'end' }}><button type="button" style={shell.btn} onClick={submitLeave}>Submit Leave</button></div>
          </div>

          <div style={shell.tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={shell.th}>Employee</th>
                  <th style={shell.th}>Type</th>
                  <th style={shell.th}>From/To</th>
                  <th style={shell.th}>Days</th>
                  <th style={shell.th}>Status</th>
                  <th style={shell.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaves.slice(0, 12).map((entry) => (
                  <tr key={entry._id}>
                    <td style={shell.td}>{entry.employeeName}</td>
                    <td style={shell.td}>{entry.leaveType}</td>
                    <td style={shell.td}>{entry.fromDate} to {entry.toDate}</td>
                    <td style={shell.td}>{entry.days}</td>
                    <td style={shell.td}><span style={shell.badge}>{entry.status}</span></td>
                    <td style={shell.td}>
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
            <table style={shell.table}>
              <thead>
                <tr>
                  <th style={shell.th}>Employee</th>
                  <th style={shell.th}>Paid Leave Balance</th>
                  <th style={shell.th}>Sick Leave Balance</th>
                  <th style={shell.th}>Unpaid Used</th>
                </tr>
              </thead>
              <tbody>
                {leaveBalances.slice(0, 10).map((entry) => (
                  <tr key={entry.employeeId}>
                    <td style={shell.td}>{entry.employeeName}</td>
                    <td style={shell.td}>{entry.paidLeave?.balance ?? 0}</td>
                    <td style={shell.td}>{entry.sickLeave?.balance ?? 0}</td>
                    <td style={shell.td}>{entry.unpaidLeave?.used ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><TrendingUp size={16} /> Employee Performance Tracking</h3>
          <p style={shell.panelSub}>Leaderboard, low performance alerts, and monthly scores.</p>
          <MiniBarChart rows={performance.chart || []} nameKey="employeeName" valueKey="score" color="var(--color-primary-dark)" />
          <div style={shell.tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={shell.th}>Employee</th>
                  <th style={shell.th}>Jobs</th>
                  <th style={shell.th}>On-Time %</th>
                  <th style={shell.th}>Feedback</th>
                  <th style={shell.th}>Complaints</th>
                  <th style={shell.th}>Revenue</th>
                  <th style={shell.th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {(performance.leaderboard || []).slice(0, 12).map((entry) => (
                  <tr key={entry.employeeId}>
                    <td style={shell.td}>{entry.employeeName}</td>
                    <td style={shell.td}>{entry.jobsCompleted}</td>
                    <td style={shell.td}>{entry.onTimeCompletion}%</td>
                    <td style={shell.td}>{entry.customerFeedback}</td>
                    <td style={shell.td}>{entry.repeatComplaints}</td>
                    <td style={shell.td}>₹{money(entry.revenueGenerated)}</td>
                    <td style={shell.td}><span style={shell.badge}>{entry.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('monthly-payroll', 'csv')}><Download size={14} /> Export Payroll CSV</button>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('monthly-payroll', 'pdf')}><Download size={14} /> Export Payroll PDF</button>
          </div>
          <div style={shell.tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={shell.th}>Pending Employee</th>
                  <th style={shell.th}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(payrollQuick?.employeesWithPendingSalary || []).slice(0, 12).map((entry) => (
                  <tr key={`${entry.employeeId}-${entry.employeeName}`}>
                    <td style={shell.td}>{entry.employeeName}</td>
                    <td style={shell.td}>₹{money(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={chartGridStyle}>
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><Bell size={16} /> Notifications & Alerts</h3>
          <ul style={shell.list}>
            {sortedNotifications.length === 0 ? <li style={shell.panelSub}>No alerts right now.</li> : null}
            {sortedNotifications.map((entry) => (
              <li key={entry._id} style={shell.listRow}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{entry.title}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>{entry.message}</p>
                  <p style={shell.tiny}>{new Date(entry.createdAt || '').toLocaleString('en-IN')}</p>
                </div>
                <div style={{ display: 'grid', gap: '6px', justifyItems: 'end' }}>
                  <span style={{ ...shell.badge, color: entry.isRead ? '#166534' : '#92400e', borderColor: entry.isRead ? 'rgba(22,163,74,0.26)' : 'rgba(217,119,6,0.28)' }}>{entry.isRead ? 'Read' : 'Unread'}</span>
                  {!entry.isRead ? <button type="button" style={shell.btnLight} onClick={() => markNotificationRead(entry._id)}>Mark Read</button> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><Download size={16} /> Reports Export</h3>
          <p style={shell.panelSub}>Export monthly payroll, employee salary, deductions, and advance reports.</p>
          <div style={{ display: 'grid', gap: '8px' }}>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('monthly-payroll', 'csv')}>Monthly Payroll (Excel/CSV)</button>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('employee-salary', 'csv')}>Employee Salary Report (Excel/CSV)</button>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('deductions', 'csv')}>Deduction Report (Excel/CSV)</button>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('advances', 'csv')}>Advance Salary Report (Excel/CSV)</button>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('monthly-payroll', 'pdf')}>Monthly Payroll PDF</button>
            <button type="button" style={shell.btnLight} onClick={() => downloadReport('employee-salary', 'pdf')}>Employee Salary PDF</button>
          </div>
        </div>
      </section>

      {profileModal.open ? (
        <div style={shell.modalBg}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ ...shell.panelTitle, margin: 0 }}><IdCard size={17} /> Employee Profile Quick View</h3>
              <button type="button" style={shell.btnLight} onClick={() => setProfileModal({ open: false, loading: false, profile: null })}>Close</button>
            </div>

            {profileModal.loading ? <p style={shell.panelSub}>Loading profile...</p> : null}
            {!profileModal.loading && !profileModal.profile ? <p style={shell.panelSub}>Profile not available.</p> : null}

            {!profileModal.loading && profileModal.profile ? (
              <>
                <div style={modalGridStyle}>
                  <div style={shell.statCard}><p style={shell.statLabel}>Employee</p><p style={shell.statValue}>{profileModal.profile.personal?.employeeName || '-'}</p><p style={shell.tiny}>{profileModal.profile.personal?.employeeCode || ''}</p></div>
                  <div style={shell.statCard}><p style={shell.statLabel}>Role</p><p style={shell.statValue}>{profileModal.profile.job?.designation || '-'}</p><p style={shell.tiny}>{profileModal.profile.job?.department || ''}</p></div>
                  <div style={shell.statCard}><p style={shell.statLabel}>Attendance (Month)</p><p style={shell.statValue}>{profileModal.profile.attendanceSummary?.present || 0}</p><p style={shell.tiny}>Present days</p></div>
                  <div style={shell.statCard}><p style={shell.statLabel}>Salary Net</p><p style={shell.statValue}>₹{money(profileModal.profile.salary?.netSalary || 0)}</p><p style={shell.tiny}>{profileModal.profile.salary?.paymentStatus || '-'}</p></div>
                  <div style={shell.statCard}><p style={shell.statLabel}>Leave Balance</p><p style={shell.statValue}>{profileModal.profile.leaveBalance?.paid?.balance || 0}</p><p style={shell.tiny}>Paid leave left</p></div>
                  <div style={shell.statCard}><p style={shell.statLabel}>Performance Score</p><p style={shell.statValue}>{profileModal.profile.performance?.score || 0}</p><p style={shell.tiny}>Monthly performance</p></div>
                </div>

                <div style={shell.tableWrap}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={shell.th}>Assigned Services</th>
                        <th style={shell.th}>Customer</th>
                        <th style={shell.th}>Date</th>
                        <th style={shell.th}>Time</th>
                        <th style={shell.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(profileModal.profile.assignedTasks || []).map((task) => (
                        <tr key={task.jobId}>
                          <td style={shell.td}>{task.serviceName}</td>
                          <td style={shell.td}>{task.customerName}</td>
                          <td style={shell.td}>{task.scheduledDate}</td>
                          <td style={shell.td}>{task.scheduledTime}</td>
                          <td style={shell.td}><span style={shell.badge}>{task.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
