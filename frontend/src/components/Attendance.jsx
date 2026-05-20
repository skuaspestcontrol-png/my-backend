import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Clock3,
  Download,
  Eye,
  Fingerprint,
  MapPinned,
  RefreshCcw,
  Search,
  UserCheck,
  UserMinus,
  Users
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const leaveTypes = ['', 'Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave'];

const todayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const monthFromDate = (value) => String(value || '').slice(0, 7);
const formatDateTimeInput = (value) => (String(value || '').includes('T') ? String(value).slice(0, 16) : '');
const timeFromDateTime = (value) => (String(value || '').includes('T') ? String(value).slice(11, 16) : String(value || ''));
const formatHours = (value) => `${Number(value || 0).toFixed(2)} hrs`;
const isSundayDate = (value) => new Date(`${value}T00:00:00`).getDay() === 0;

const getEmployeeName = (employee = {}) => [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee';

const buildMapUrl = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

const liveStatusOf = (row = {}, selectedDate = todayDate()) => {
  const status = String(row.status || '').trim().toLowerCase();
  if (status === 'leave') return 'Leave';
  if (status === 'weekly-off') return 'Weekly Off';
  if (status === 'absent') return 'Absent';
  if (status === 'half-day') return 'Half Day';
  if (row.checkOutTime || row.checkOut) return 'Punched Out';
  if (row.checkInTime || row.checkIn) return 'Punched In';
  if (status === 'present') return 'Present';
  return selectedDate === todayDate() ? 'Not Punched' : (isSundayDate(selectedDate) ? 'Weekly Off' : 'Absent');
};

const statusStyles = {
  Present: { background: 'rgba(22,163,74,0.12)', color: '#166534', border: '1px solid rgba(22,163,74,0.28)' },
  'Punched In': { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.24)' },
  'Punched Out': { background: 'rgba(14,116,144,0.12)', color: '#0f766e', border: '1px solid rgba(14,116,144,0.24)' },
  'Not Punched': { background: 'rgba(148,163,184,0.14)', color: '#475569', border: '1px solid rgba(148,163,184,0.24)' },
  Absent: { background: 'rgba(220,38,38,0.1)', color: '#991b1b', border: '1px solid rgba(220,38,38,0.24)' },
  Leave: { background: 'rgba(217,119,6,0.12)', color: '#92400e', border: '1px solid rgba(217,119,6,0.24)' },
  'Weekly Off': { background: 'rgba(100,116,139,0.14)', color: '#334155', border: '1px solid rgba(100,116,139,0.24)' },
  'Half Day': { background: 'rgba(217,119,6,0.12)', color: '#92400e', border: '1px solid rgba(217,119,6,0.24)' }
};

const shell = {
  page: { display: 'grid', gap: '16px' },
  hero: {
    display: 'grid',
    gap: '12px',
    padding: '20px',
    borderRadius: '20px',
    border: '1px solid rgba(159, 23, 77, 0.16)',
    background: 'rgba(255,255,255,0.9)',
    boxShadow: 'var(--shadow-soft)'
  },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' },
  subtitle: { margin: 0, fontSize: '13px', color: '#475569', fontWeight: 600 },
  filterPanel: {
    display: 'grid',
    gap: '12px',
    padding: '18px',
    borderRadius: '18px',
    border: '1px solid rgba(159, 23, 77, 0.16)',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: 'var(--shadow-soft)'
  },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  panelTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  button: {
    minHeight: '40px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    background: '#fff',
    color: '#0f172a',
    padding: '0 14px',
    fontSize: '12px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    textDecoration: 'none'
  },
  primaryButton: {
    minHeight: '40px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.3)',
    background: 'var(--color-primary)',
    color: '#fff',
    padding: '0 14px',
    fontSize: '12px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  field: { display: 'grid', gap: '6px' },
  label: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    width: '100%',
    minHeight: '40px',
    borderRadius: '10px',
    border: '1px solid #D1D5DB',
    background: '#fff',
    padding: '0 12px',
    fontSize: '13px',
    color: '#0f172a'
  },
  textarea: {
    width: '100%',
    minHeight: '96px',
    borderRadius: '10px',
    border: '1px solid #D1D5DB',
    background: '#fff',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#0f172a',
    resize: 'vertical'
  },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
  summaryCard: {
    display: 'grid',
    gap: '8px',
    borderRadius: '16px',
    border: '1px solid rgba(159, 23, 77, 0.14)',
    background: '#fff',
    padding: '14px',
    boxShadow: 'var(--shadow-soft)'
  },
  summaryLabel: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryValue: { margin: 0, fontSize: '26px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.04em' },
  summarySub: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 },
  tableCard: {
    borderRadius: '20px',
    border: '1px solid rgba(159, 23, 77, 0.16)',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: 'var(--shadow-soft)',
    overflow: 'hidden'
  },
  tableHeader: { padding: '18px 20px 12px', borderBottom: '1px solid var(--color-border)' },
  tableTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' },
  tableSub: { margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: 600 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', minWidth: '1520px', borderCollapse: 'collapse' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' },
  td: { padding: '14px', fontSize: '13px', color: '#0f172a', borderBottom: '1px solid #eef2f7', verticalAlign: 'top' },
  badge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px', padding: '0 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' },
  noteText: { margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 },
  smallMeta: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 700 },
  rowActionGroup: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  rowActionButton: {
    minHeight: '30px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#0f172a',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  mapButton: {
    minHeight: '28px',
    borderRadius: '8px',
    border: '1px solid rgba(37,99,235,0.18)',
    background: 'rgba(37,99,235,0.08)',
    color: '#1d4ed8',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  emptyState: { padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px', fontWeight: 600 },
  footerNote: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', padding: '16px', zIndex: 90 },
  modal: { width: 'min(760px, 100%)', maxHeight: '88vh', overflowY: 'auto', display: 'grid', gap: '12px', padding: '18px', background: '#fff', borderRadius: '18px', border: '1px solid rgba(159, 23, 77, 0.18)', boxShadow: 'var(--shadow-soft)' },
  modalGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }
};

const defaultEditorState = {
  _id: '',
  employeeId: '',
  employeeName: '',
  date: '',
  status: 'present',
  checkInTime: '',
  checkOutTime: '',
  leaveType: '',
  notes: '',
  manualLocationAddress: '',
  editReason: ''
};

export default function Attendance() {
  const [date, setDate] = useState(() => todayDate());
  const [month, setMonth] = useState(() => monthFromDate(todayDate()));
  const [employees, setEmployees] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [filters, setFilters] = useState({ department: '', status: '', search: '' });
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [editModal, setEditModal] = useState({ open: false, saving: false, draft: defaultEditorState });
  const [auditModal, setAuditModal] = useState({ open: false, loading: false, employeeName: '', entries: [] });

  const loadAttendancePage = async ({ nextDate = date, nextMonth = month } = {}) => {
    try {
      setBusy(true);
      setStatusMessage('');
      const [employeesRes, attendanceRes] = await Promise.all([
        axios.get(`${API_BASE}/api/employees`),
        axios.get(`${API_BASE}/api/attendance`, { params: { date: nextDate } })
      ]);
      setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      setAttendanceRows(Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
      setMonth(nextMonth || monthFromDate(nextDate));
    } catch (error) {
      console.error('Failed to load attendance page', error);
      setStatusMessage(error?.response?.data?.error || 'Unable to load attendance right now.');
      setEmployees([]);
      setAttendanceRows([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadAttendancePage({ nextDate: date, nextMonth: monthFromDate(date) });
  }, [date]);

  const rowLookup = useMemo(() => {
    const map = new Map();
    attendanceRows.forEach((row) => {
      map.set(String(row.employeeId || ''), row);
    });
    return map;
  }, [attendanceRows]);

  const mergedRows = useMemo(() => employees.map((employee) => {
    const employeeId = String(employee._id || '').trim();
    const record = rowLookup.get(employeeId) || {
      employeeId,
      employeeCode: employee.empCode || '',
      employeeName: getEmployeeName(employee),
      employeeRole: employee.role || employee.roleName || '',
      date,
      status: '',
      checkIn: '',
      checkOut: '',
      checkInTime: '',
      checkOutTime: '',
      workingHours: 0,
      leaveType: '',
      notes: '',
      source: '',
      punchInMapUrl: '',
      punchOutMapUrl: '',
      punchInLatitude: null,
      punchInLongitude: null,
      punchOutLatitude: null,
      punchOutLongitude: null
    };
    const liveStatus = liveStatusOf(record, date);
    return {
      ...record,
      employeeName: record.employeeName || getEmployeeName(employee),
      employeeCode: record.employeeCode || employee.empCode || '',
      employeeRole: record.employeeRole || employee.role || employee.roleName || '',
      liveStatus,
      inMapUrl: record.punchInMapUrl || buildMapUrl(record.punchInLatitude, record.punchInLongitude),
      outMapUrl: record.punchOutMapUrl || buildMapUrl(record.punchOutLatitude, record.punchOutLongitude)
    };
  }), [employees, rowLookup, date]);

  const filteredRows = useMemo(() => mergedRows.filter((row) => {
    const roleText = String(row.employeeRole || '').trim().toLowerCase();
    const searchText = `${row.employeeName || ''} ${row.employeeCode || ''}`.toLowerCase();
    if (filters.department && roleText !== filters.department.toLowerCase()) return false;
    if (filters.status && row.liveStatus !== filters.status) return false;
    if (filters.search && !searchText.includes(filters.search.toLowerCase())) return false;
    return true;
  }), [mergedRows, filters]);

  const departments = useMemo(() => Array.from(new Set(
    employees.map((entry) => String(entry.role || entry.roleName || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b)), [employees]);

  const summary = useMemo(() => filteredRows.reduce((acc, row) => {
    acc.totalEmployees += 1;
    acc.totalHours += Number(row.workingHours || 0);
    if (row.liveStatus === 'Present' || row.liveStatus === 'Punched Out') acc.present += 1;
    if (row.liveStatus === 'Punched In') acc.punchedIn += 1;
    if (row.liveStatus === 'Not Punched') acc.notPunched += 1;
    if (row.liveStatus === 'Absent') acc.absent += 1;
    if (row.liveStatus === 'Leave') acc.leave += 1;
    if (row.liveStatus === 'Weekly Off') acc.weeklyOff += 1;
    return acc;
  }, {
    totalEmployees: 0,
    present: 0,
    punchedIn: 0,
    notPunched: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    totalHours: 0
  }), [filteredRows]);

  const averageHours = summary.totalEmployees ? Number((summary.totalHours / summary.totalEmployees).toFixed(2)) : 0;

  const openEditor = (row) => {
    setEditModal({
      open: true,
      saving: false,
      draft: {
        _id: row._id || '',
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        date: row.date || date,
        status: String(row.status || '').trim().toLowerCase() || 'present',
        checkInTime: formatDateTimeInput(row.checkInTime || (row.checkIn ? `${row.date || date}T${row.checkIn}` : '')),
        checkOutTime: formatDateTimeInput(row.checkOutTime || (row.checkOut ? `${row.date || date}T${row.checkOut}` : '')),
        leaveType: row.leaveType || '',
        notes: row.notes || '',
        manualLocationAddress: row.manualLocationAddress || '',
        editReason: ''
      }
    });
  };

  const saveManualAttendance = async (payload) => {
    const endpoint = payload._id ? `${API_BASE}/api/attendance/${payload._id}` : `${API_BASE}/api/attendance/manual-upsert`;
    const method = payload._id ? axios.put : axios.post;
    await method(endpoint, payload, {
      headers: {
        'x-user-name': localStorage.getItem('portal_user_name') || 'Admin',
        'x-user-role': localStorage.getItem('portal_user_role') || 'Admin'
      }
    });
  };

  const handleQuickStatus = async (row, status) => {
    try {
      setStatusMessage('');
      const nextPayload = {
        _id: row._id || '',
        employeeId: row.employeeId,
        date: row.date || date,
        status,
        checkIn: status === 'present' ? (row.checkIn || '09:00') : '',
        checkOut: status === 'present' ? (row.checkOut || '18:00') : '',
        checkInTime: status === 'present' && !row.checkInTime ? `${row.date || date}T09:00` : (row.checkInTime || ''),
        checkOutTime: status === 'present' && !row.checkOutTime ? `${row.date || date}T18:00` : (row.checkOutTime || ''),
        leaveType: status === 'leave' ? (row.leaveType || 'Casual Leave') : '',
        notes: row.notes || '',
        manualLocationAddress: row.manualLocationAddress || '',
        editReason: `Quick status update to ${status}`
      };
      await saveManualAttendance(nextPayload);
      await loadAttendancePage({ nextDate: date, nextMonth: month });
      setStatusMessage('Attendance updated.');
    } catch (error) {
      console.error('Quick status update failed', error);
      setStatusMessage(error?.response?.data?.error || 'Unable to update attendance.');
    }
  };

  const submitEditor = async () => {
    try {
      setEditModal((prev) => ({ ...prev, saving: true }));
      const draft = editModal.draft;
      await saveManualAttendance({
        _id: draft._id || '',
        employeeId: draft.employeeId,
        date: draft.date,
        status: draft.status,
        checkInTime: draft.checkInTime ? `${draft.checkInTime}:00` : '',
        checkOutTime: draft.checkOutTime ? `${draft.checkOutTime}:00` : '',
        checkIn: timeFromDateTime(draft.checkInTime),
        checkOut: timeFromDateTime(draft.checkOutTime),
        leaveType: draft.leaveType,
        notes: draft.notes,
        manualLocationAddress: draft.manualLocationAddress,
        editReason: draft.editReason
      });
      setEditModal({ open: false, saving: false, draft: defaultEditorState });
      await loadAttendancePage({ nextDate: date, nextMonth: month });
      setStatusMessage('Attendance saved successfully.');
    } catch (error) {
      console.error('Attendance editor save failed', error);
      setStatusMessage(error?.response?.data?.error || 'Unable to save manual attendance update.');
      setEditModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const openAudit = async (row) => {
    if (!row._id) {
      setStatusMessage('No audit log yet for this employee on the selected date.');
      return;
    }
    try {
      setAuditModal({ open: true, loading: true, employeeName: row.employeeName, entries: [] });
      const res = await axios.get(`${API_BASE}/api/attendance/${row._id}/audit`);
      setAuditModal({ open: true, loading: false, employeeName: row.employeeName, entries: Array.isArray(res.data) ? res.data : [] });
    } catch (error) {
      console.error('Attendance audit load failed', error);
      setAuditModal({ open: true, loading: false, employeeName: row.employeeName, entries: [] });
      setStatusMessage(error?.response?.data?.error || 'Unable to load attendance audit.');
    }
  };

  const exportCsv = () => {
    const headers = ['Employee', 'Role', 'Status', 'Punch In', 'Punch Out', 'Working Hours', 'Location', 'Source', 'Leave Type', 'Notes'];
    const lines = filteredRows.map((row) => [
      row.employeeName,
      row.employeeRole,
      row.liveStatus,
      row.checkIn || '',
      row.checkOut || '',
      Number(row.workingHours || 0).toFixed(2),
      [row.inMapUrl ? 'Punch In Map' : '', row.outMapUrl ? 'Punch Out Map' : '', row.manualLocationAddress || ''].filter(Boolean).join(' | '),
      row.source || '-',
      row.leaveType || '-',
      row.notes || '-'
    ]);
    const csv = [headers, ...lines]
      .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Attendance</h2>
        <p style={shell.subtitle}>Daily attendance, app punch-in/out, live location, and payroll-ready working hours.</p>
      </div>

      <div style={shell.filterPanel}>
        <div style={shell.panelHeader}>
          <h3 style={shell.panelTitle}>Daily Controls</h3>
          <div style={shell.actionRow}>
            <Link to="/employees" style={shell.button}><Users size={14} /> Employee Master</Link>
            <button type="button" style={shell.button} onClick={exportCsv}><Download size={14} /> Export</button>
            <button type="button" style={shell.primaryButton} onClick={() => loadAttendancePage({ nextDate: date, nextMonth: month })} disabled={busy}>
              <RefreshCcw size={14} /> {busy ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={shell.filterGrid}>
          <div style={shell.field}>
            <p style={shell.label}>Month</p>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setMonth(nextMonth);
                if (nextMonth && !String(date).startsWith(nextMonth)) setDate(`${nextMonth}-01`);
              }}
              style={shell.input}
            />
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Date</p>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={shell.input} />
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Department / Role</p>
            <select style={shell.input} value={filters.department} onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}>
              <option value="">All</option>
              {departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Status</p>
            <select style={shell.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="">All</option>
              {Object.keys(statusStyles).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Employee Search</p>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '13px', color: '#64748b' }} />
              <input
                style={{ ...shell.input, paddingLeft: '32px' }}
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Search employee"
              />
            </div>
          </div>
        </div>
      </div>

      <div style={shell.summaryGrid}>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Total Employees</p><p style={shell.summaryValue}>{summary.totalEmployees}</p><p style={shell.summarySub}>Visible for selected filters</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Present</p><p style={shell.summaryValue}>{summary.present}</p><p style={shell.summarySub}>Completed attendance day</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Punched In</p><p style={shell.summaryValue}>{summary.punchedIn}</p><p style={shell.summarySub}>Still on field work</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Not Punched</p><p style={shell.summaryValue}>{summary.notPunched}</p><p style={shell.summarySub}>No app/manual entry yet</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Absent</p><p style={shell.summaryValue}>{summary.absent}</p><p style={shell.summarySub}>Marked absent</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Leave</p><p style={shell.summaryValue}>{summary.leave}</p><p style={shell.summarySub}>Paid or unpaid leave</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Weekly Off</p><p style={shell.summaryValue}>{summary.weeklyOff}</p><p style={shell.summarySub}>Configured rest day</p></div>
        <div style={shell.summaryCard}><p style={shell.summaryLabel}>Average Hours</p><p style={shell.summaryValue}>{averageHours}</p><p style={shell.summarySub}>Per visible employee</p></div>
      </div>

      <div style={shell.tableCard}>
        <div style={shell.tableHeader}>
          <h3 style={shell.tableTitle}>Attendance Register</h3>
          <p style={shell.tableSub}>Technician punches, manual corrections, location links, and payroll-ready hours stay together in one operational view.</p>
        </div>
        <div style={shell.tableWrap}>
          <table style={shell.table}>
            <thead>
              <tr>
                <th style={shell.th}>Employee</th>
                <th style={shell.th}>Role</th>
                <th style={shell.th}>Status</th>
                <th style={shell.th}>Punch In</th>
                <th style={shell.th}>Punch Out</th>
                <th style={shell.th}>Working Hours</th>
                <th style={shell.th}>Location</th>
                <th style={shell.th}>Source</th>
                <th style={shell.th}>Leave Type</th>
                <th style={shell.th}>Notes</th>
                <th style={shell.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.employeeId}-${row.date}`}>
                  <td style={shell.td}>
                    <p style={{ margin: 0, fontWeight: 800 }}>{row.employeeName}</p>
                    <p style={shell.smallMeta}>{row.employeeCode || 'No Code'}</p>
                  </td>
                  <td style={shell.td}>{row.employeeRole || '-'}</td>
                  <td style={shell.td}>
                    <span style={{ ...shell.badge, ...(statusStyles[row.liveStatus] || statusStyles.Absent) }}>{row.liveStatus}</span>
                  </td>
                  <td style={shell.td}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{row.checkIn || '--:--'}</p>
                    <p style={shell.smallMeta}>{row.checkInTime ? row.checkInTime.replace('T', ' ').slice(0, 16) : '-'}</p>
                  </td>
                  <td style={shell.td}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{row.checkOut || '--:--'}</p>
                    <p style={shell.smallMeta}>{row.checkOutTime ? row.checkOutTime.replace('T', ' ').slice(0, 16) : '-'}</p>
                  </td>
                  <td style={shell.td}>{formatHours(row.workingHours)}</td>
                  <td style={shell.td}>
                    <div style={shell.rowActionGroup}>
                      {row.inMapUrl ? <button type="button" style={shell.mapButton} onClick={() => window.open(row.inMapUrl, '_blank', 'noopener,noreferrer')}><MapPinned size={13} /> In Map</button> : null}
                      {row.outMapUrl ? <button type="button" style={shell.mapButton} onClick={() => window.open(row.outMapUrl, '_blank', 'noopener,noreferrer')}><MapPinned size={13} /> Out Map</button> : null}
                    </div>
                    {row.manualLocationAddress ? <p style={{ ...shell.smallMeta, marginTop: '6px' }}>{row.manualLocationAddress}</p> : null}
                  </td>
                  <td style={shell.td}>{row.source || '-'}</td>
                  <td style={shell.td}>{row.leaveType || '-'}</td>
                  <td style={shell.td}><p style={shell.noteText}>{row.notes || '-'}</p></td>
                  <td style={shell.td}>
                    <div style={shell.rowActionGroup}>
                      <button type="button" style={shell.rowActionButton} onClick={() => openEditor(row)}>Edit Time</button>
                      <button type="button" style={shell.rowActionButton} onClick={() => handleQuickStatus(row, 'present')}>Mark Present</button>
                      <button type="button" style={shell.rowActionButton} onClick={() => handleQuickStatus(row, 'absent')}>Mark Absent</button>
                      <button type="button" style={shell.rowActionButton} onClick={() => handleQuickStatus(row, 'leave')}>Mark Leave</button>
                      <button type="button" style={shell.rowActionButton} onClick={() => openAudit(row)}>View Audit</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr><td style={shell.emptyState} colSpan={11}>No employees or attendance rows match the current filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p style={shell.footerNote}>{statusMessage || 'Punch records from the technician app appear here automatically, and admin edits are tracked in audit history.'}</p>

      {editModal.open ? (
        <div style={shell.modalBg}>
          <div style={shell.modal}>
            <div style={shell.panelHeader}>
              <div>
                <h3 style={shell.panelTitle}>Edit Attendance</h3>
                <p style={shell.tableSub}>{editModal.draft.employeeName} • {editModal.draft.date}</p>
              </div>
              <button type="button" style={shell.button} onClick={() => setEditModal({ open: false, saving: false, draft: defaultEditorState })}>Close</button>
            </div>
            <div style={shell.modalGrid}>
              <div style={shell.field}>
                <p style={shell.label}>Status</p>
                <select style={shell.input} value={editModal.draft.status} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, status: event.target.value } }))}>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="leave">Leave</option>
                  <option value="weekly-off">Weekly Off</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>
              <div style={shell.field}>
                <p style={shell.label}>Check In Time</p>
                <input type="datetime-local" style={shell.input} value={editModal.draft.checkInTime} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, checkInTime: event.target.value } }))} />
              </div>
              <div style={shell.field}>
                <p style={shell.label}>Check Out Time</p>
                <input type="datetime-local" style={shell.input} value={editModal.draft.checkOutTime} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, checkOutTime: event.target.value } }))} />
              </div>
              <div style={shell.field}>
                <p style={shell.label}>Leave Type</p>
                <select style={shell.input} value={editModal.draft.leaveType} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, leaveType: event.target.value } }))}>
                  {leaveTypes.map((entry) => <option key={entry || 'none'} value={entry}>{entry || 'None'}</option>)}
                </select>
              </div>
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Manual Location / Address</p>
              <input style={shell.input} value={editModal.draft.manualLocationAddress} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, manualLocationAddress: event.target.value } }))} placeholder="Optional manual location note" />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Notes</p>
              <textarea style={shell.textarea} value={editModal.draft.notes} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, notes: event.target.value } }))} />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Edit Reason</p>
              <textarea style={{ ...shell.textarea, minHeight: '72px' }} value={editModal.draft.editReason} onChange={(event) => setEditModal((prev) => ({ ...prev, draft: { ...prev.draft, editReason: event.target.value } }))} placeholder="Optional audit note for this admin change" />
            </div>
            <div style={shell.actionRow}>
              <button type="button" style={shell.primaryButton} onClick={submitEditor} disabled={editModal.saving}>{editModal.saving ? 'Saving...' : 'Save Attendance'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {auditModal.open ? (
        <div style={shell.modalBg}>
          <div style={shell.modal}>
            <div style={shell.panelHeader}>
              <div>
                <h3 style={shell.panelTitle}>Attendance Audit</h3>
                <p style={shell.tableSub}>{auditModal.employeeName}</p>
              </div>
              <button type="button" style={shell.button} onClick={() => setAuditModal({ open: false, loading: false, employeeName: '', entries: [] })}>Close</button>
            </div>
            {auditModal.loading ? <p style={shell.footerNote}>Loading audit history...</p> : null}
            {!auditModal.loading && auditModal.entries.length === 0 ? <p style={shell.footerNote}>No audit entries found for this attendance row.</p> : null}
            {!auditModal.loading && auditModal.entries.map((entry, index) => (
              <div key={`${entry.changedAt || 'audit'}-${index}`} style={shell.summaryCard}>
                <p style={shell.summaryLabel}>{entry.source || 'manual_admin'}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{entry.changedBy || 'System'}</p>
                <p style={shell.smallMeta}>{entry.changedAt ? String(entry.changedAt).replace('T', ' ').slice(0, 16) : '-'}</p>
                <p style={shell.noteText}>Status: {entry.oldStatus || '-'} → {entry.newStatus || '-'}</p>
                <p style={shell.noteText}>Check In: {entry.oldCheckInTime ? String(entry.oldCheckInTime).replace('T', ' ').slice(0, 16) : '-'} → {entry.newCheckInTime ? String(entry.newCheckInTime).replace('T', ' ').slice(0, 16) : '-'}</p>
                <p style={shell.noteText}>Check Out: {entry.oldCheckOutTime ? String(entry.oldCheckOutTime).replace('T', ' ').slice(0, 16) : '-'} → {entry.newCheckOutTime ? String(entry.newCheckOutTime).replace('T', ' ').slice(0, 16) : '-'}</p>
                {entry.reason ? <p style={shell.noteText}>Reason: {entry.reason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
