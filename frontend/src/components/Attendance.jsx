import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const leaveTypes = ['', 'Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave'];

const shell = {
  page: {
    padding: 0,
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    backdropFilter: 'none',
    display: 'grid',
    gap: '14px'
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap'
  },
  titleWrap: { display: 'grid', gap: '4px' },
  title: { margin: 0, fontSize: '30px', letterSpacing: '-0.02em', color: '#0f172a', fontWeight: 800 },
  subtitle: { margin: 0, fontSize: '13px', color: '#475569', fontWeight: 600 },
  topbarActions: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  employeeLink: {
    minHeight: '42px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.28)',
    background: '#fff',
    color: 'var(--color-primary-dark)',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  dateInput: {
    minHeight: '42px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.28)',
    background: '#fff',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#0f172a'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '10px'
  },
  summaryCard: {
    border: '1px solid rgba(159, 23, 77, 0.2)',
    borderRadius: '14px',
    padding: '12px',
    background: '#fff',
    display: 'grid',
    gap: '8px'
  },
  sectionTitle: { margin: 0, fontSize: '14px', color: 'var(--color-primary-dark)', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  summaryLabel: { fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryValue: { fontSize: '24px', fontWeight: 800, color: '#0f172a', lineHeight: 1 },
  tableWrap: {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    overflowX: 'auto'
  },
  table: { width: '100%', minWidth: '900px', borderCollapse: 'collapse', tableLayout: 'auto' },
  th: { textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#475569', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', lineHeight: 1.3 },
  td: { padding: '10px', borderBottom: '1px solid #eef2f7', fontSize: '13px', color: '#0f172a', verticalAlign: 'middle', wordBreak: 'break-word' },
  nameCell: { display: 'grid', gap: '2px' },
  empName: { fontWeight: 700, color: '#0f172a' },
  empCode: { fontSize: '11px', color: '#64748b', fontWeight: 700 },
  statusBtns: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', width: '100%' },
  statusBtn: {
    minHeight: '30px',
    minWidth: 0,
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 800,
    padding: '0 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  input: {
    minHeight: '34px',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    background: '#fff',
    padding: '0 10px',
    fontSize: '12px',
    color: '#0f172a'
  },
  hoursBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '74px',
    minHeight: '30px',
    borderRadius: '999px',
    border: '1px solid rgba(159, 23, 77, 0.32)',
    background: 'rgba(159, 23, 77, 0.08)',
    color: 'var(--color-primary-dark)',
    fontSize: '12px',
    fontWeight: 800
  },
  footerNote: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 }
};

const getEmployeeName = (employee = {}) => [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee';

const statusTheme = {
  present: { border: '1px solid rgba(22,163,74,0.44)', background: 'rgba(22,163,74,0.12)', color: '#166534' },
  absent: { border: '1px solid rgba(220,38,38,0.44)', background: 'rgba(220,38,38,0.1)', color: '#991b1b' },
  leave: { border: '1px solid rgba(217,119,6,0.46)', background: 'rgba(217,119,6,0.12)', color: '#92400e' },
  'half-day': { border: '1px solid rgba(217,119,6,0.46)', background: 'rgba(217,119,6,0.12)', color: '#92400e' },
  'weekly-off': { border: '1px solid rgba(100,116,139,0.5)', background: 'rgba(100,116,139,0.14)', color: '#334155' }
};

const isValidTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());

const computeHours = (status, checkIn, checkOut) => {
  if (status === 'absent' || status === 'weekly-off' || status === 'leave') return 0;
  if (!isValidTime(checkIn) || !isValidTime(checkOut)) return 0;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  const inMinutes = (inH * 60) + inM;
  const outMinutes = (outH * 60) + outM;
  if (outMinutes <= inMinutes) return 0;
  const rawHours = (outMinutes - inMinutes) / 60;
  const finalHours = status === 'half-day' ? Math.min(rawHours, 4) : rawHours;
  return Number(finalHours.toFixed(2));
};

const todayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const monthFromDate = (value) => String(value || '').slice(0, 7);

const monthHeading = (value) => {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return 'Selected Month';
  const [year, month] = String(value).split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const isSundayDate = (value) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getDay() === 0;
};

export default function Attendance() {
  const [date, setDate] = useState(() => todayDate());
  const [month, setMonth] = useState(() => monthFromDate(todayDate()));
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState({});
  const [monthRecords, setMonthRecords] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  const loadData = async (attendanceDate) => {
    const sunday = isSundayDate(attendanceDate);
    const employeesRes = await axios.get(`${API_BASE}/api/employees`);
    const employeeList = Array.isArray(employeesRes.data) ? employeesRes.data : [];

    let attendanceRows = [];
    try {
      const attendanceRes = await axios.get(`${API_BASE}/api/attendance`, { params: { date: attendanceDate } });
      attendanceRows = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
    } catch (error) {
      console.error('Attendance endpoint failed, showing employee list only', error);
      setStatusMessage('Attendance history is unavailable right now. You can still mark employee attendance.');
    }

    const recordMap = {};
    attendanceRows.forEach((entry) => {
      const key = String(entry.employeeId || '').trim();
      if (!key) return;
      const normalizedStatus = entry.status === 'half-day' ? 'leave' : (entry.status || 'absent');
      const normalizedCheckIn = normalizedStatus === 'present' ? (entry.checkIn || '09:00') : '';
      const normalizedCheckOut = normalizedStatus === 'present' ? (entry.checkOut || '17:00') : '';
      recordMap[key] = {
        _id: entry._id,
        employeeId: key,
        date: attendanceDate,
        status: normalizedStatus,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        leaveType: entry.leaveType || '',
        leaveReason: entry.leaveReason || '',
        notes: entry.notes || ''
      };
    });

    employeeList.forEach((entry) => {
      const key = String(entry._id || '').trim();
      if (!key || recordMap[key]) return;
      recordMap[key] = {
        employeeId: key,
        date: attendanceDate,
        status: sunday ? 'weekly-off' : 'absent',
        checkIn: '',
        checkOut: '',
        leaveType: '',
        leaveReason: '',
        notes: ''
      };
    });

    setEmployees(employeeList);
    setRecords(recordMap);
  };

  const loadMonthData = async (attendanceMonth) => {
    if (!attendanceMonth) return;
    try {
      const attendanceRes = await axios.get(`${API_BASE}/api/attendance`);
      const rows = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
      const prefix = `${attendanceMonth}-`;
      setMonthRecords(rows.filter((entry) => String(entry.date || '').startsWith(prefix)));
    } catch (error) {
      console.error('Failed to load monthly attendance data', error);
      setMonthRecords([]);
      setStatusMessage('Month-wise summary is temporarily unavailable.');
    }
  };

  useEffect(() => {
    loadData(date).catch((error) => {
      console.error('Failed to load attendance', error);
      setStatusMessage('Failed to load attendance data.');
    });
  }, [date]);

  useEffect(() => {
    loadMonthData(month);
  }, [month]);

  const employeeRows = useMemo(
    () => employees.map((employee) => {
      const employeeId = String(employee._id || '').trim();
      const record = records[employeeId] || {
        employeeId,
        date,
        status: 'absent',
        checkIn: '',
        checkOut: '',
        leaveType: '',
        leaveReason: '',
        notes: ''
      };
      const workingHours = computeHours(record.status, record.checkIn, record.checkOut);
      return {
        employee,
        employeeId,
        record,
        workingHours
      };
    }),
    [employees, records, date]
  );

  const monthSummary = useMemo(() => {
    const deduped = new Map();
    monthRecords.forEach((row) => {
      const employeeId = String(row.employeeId || '').trim();
      const recordDate = String(row.date || '').trim();
      if (!employeeId || !recordDate) return;
      const key = `${employeeId}__${recordDate}`;
      const current = deduped.get(key);
      if (!current) {
        deduped.set(key, row);
        return;
      }
      const currentTime = new Date(current.updatedAt || current.date || 0).getTime();
      const nextTime = new Date(row.updatedAt || row.date || 0).getTime();
      if (nextTime >= currentTime) deduped.set(key, row);
    });

    const dedupedRows = Array.from(deduped.values());

    const byDate = new Map();
    dedupedRows.forEach((row) => {
      const key = String(row.date || '').trim();
      if (!key) return;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(row);
    });

    const daySummary = {
      presentDays: 0,
      absentDays: 0,
      weeklyOffDays: 0,
      leaveDays: 0
    };

    byDate.forEach((rows) => {
      const statuses = rows.map((row) => String(row.status || '').trim().toLowerCase());
      const hasPresent = statuses.includes('present');
      const hasLeave = statuses.includes('leave') || statuses.includes('half-day');
      const hasAbsent = statuses.includes('absent');
      const hasWeeklyOff = statuses.includes('weekly-off');

      if (hasPresent) {
        daySummary.presentDays += 1;
        return;
      }
      if (hasLeave) {
        daySummary.leaveDays += 1;
        return;
      }
      if (hasAbsent) {
        daySummary.absentDays += 1;
        return;
      }
      if (hasWeeklyOff) {
        daySummary.weeklyOffDays += 1;
      }
    });

    const totals = dedupedRows.reduce((acc, row) => {
      const status = String(row.status || '').trim().toLowerCase();
      const hours = Number(row.workingHours);
      const computedHours = Number.isFinite(hours) ? hours : computeHours(status, row.checkIn, row.checkOut);
      acc.totalHours += computedHours;
      if (status === 'present' && computedHours > 0) {
        acc.workedDays += 1;
      }
      if (row.employeeId) acc.uniqueEmployees.add(String(row.employeeId));
      return acc;
    }, {
      totalHours: 0,
      workedDays: 0,
      uniqueEmployees: new Set()
    });

    return {
      ...daySummary,
      ...totals
    };
  }, [monthRecords]);

  const updateRecordField = (employeeId, key, value) => {
    setRecords((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || { employeeId, date, status: 'absent', checkIn: '', checkOut: '', leaveType: '', leaveReason: '', notes: '' }),
        [key]: value
      }
    }));
  };

  const setStatus = (employeeId, status) => {
    const current = records[employeeId] || { employeeId, date, status: 'absent', checkIn: '', checkOut: '', leaveType: '', leaveReason: '', notes: '' };
    const nextCheckIn = status === 'present'
      ? (current.checkIn || '09:00')
      : '';
    const nextCheckOut = status === 'present'
      ? (current.checkOut || '17:00')
      : '';
    const next = {
      ...current,
      status,
      leaveType: status === 'leave' ? current.leaveType : '',
      leaveReason: status === 'leave' ? current.leaveReason : '',
      checkIn: nextCheckIn,
      checkOut: nextCheckOut
    };
    setRecords((prev) => ({ ...prev, [employeeId]: next }));
    saveRecord(employeeId, next);
  };

  const saveRecord = async (employeeId, payload) => {
    const row = payload || records[employeeId];
    if (!row) return;

    setStatusMessage('');
    try {
      const res = await axios.post(`${API_BASE}/api/attendance`, {
        _id: row._id,
        employeeId,
        date,
        status: row.status,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        leaveType: row.leaveType,
        leaveReason: row.leaveReason,
        notes: row.notes
      });
      const saved = res.data || {};
      setRecords((prev) => ({
        ...prev,
        [employeeId]: {
          ...(prev[employeeId] || {}),
          _id: saved._id || row._id,
          employeeId,
          date,
          status: saved.status || row.status,
          checkIn: saved.checkIn || '',
          checkOut: saved.checkOut || '',
          leaveType: saved.leaveType || '',
          leaveReason: saved.leaveReason || '',
          notes: saved.notes || ''
        }
      }));
      if (monthFromDate(date) === month) {
        loadMonthData(month);
      }
    } catch (error) {
      console.error('Failed to save attendance', error);
      const apiMessage = String(error?.response?.data?.error || '').trim();
      setStatusMessage(apiMessage || 'Some attendance updates could not be saved.');
    }
  };

  const handleDateChange = (nextDate) => {
    setDate(nextDate);
    const nextMonth = monthFromDate(nextDate);
    if (nextMonth && nextMonth !== month) {
      setMonth(nextMonth);
    }
  };

  const handleMonthChange = (nextMonth) => {
    setMonth(nextMonth);
    if (nextMonth && !String(date).startsWith(nextMonth)) {
      setDate(`${nextMonth}-01`);
    }
  };

  return (
    <div style={shell.page}>
      <div style={shell.topbar}>
        <div style={shell.titleWrap}>
          <h2 style={shell.title}>Attendance</h2>
          <p style={shell.subtitle}>Maintain daily attendance, leave records, and working hours in one clean view.</p>
        </div>
        <div style={shell.topbarActions}>
          <Link to="/employees" style={shell.employeeLink}>Employee Master</Link>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
            <CalendarDays size={16} />
            <input
              type="month"
              value={month}
              onChange={(event) => handleMonthChange(event.target.value)}
              style={shell.dateInput}
            />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
            <CalendarDays size={16} />
            <input
              type="date"
              value={date}
              onChange={(event) => handleDateChange(event.target.value)}
              style={shell.dateInput}
            />
          </label>
        </div>
      </div>

      <h3 style={shell.sectionTitle}>Month Wise Summary ({monthHeading(month)})</h3>
      <div style={shell.summaryGrid}>
        <div style={shell.summaryCard}>
          <span style={shell.summaryLabel}><Users size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Employees Marked</span>
          <span style={shell.summaryValue}>{monthSummary.uniqueEmployees.size}</span>
        </div>
        <div style={shell.summaryCard}>
          <span style={shell.summaryLabel}>Present Days</span>
          <span style={shell.summaryValue}>{monthSummary.presentDays}</span>
        </div>
        <div style={shell.summaryCard}>
          <span style={shell.summaryLabel}>Absent Days</span>
          <span style={shell.summaryValue}>{monthSummary.absentDays}</span>
        </div>
        <div style={shell.summaryCard}>
          <span style={shell.summaryLabel}>Weekly Off</span>
          <span style={shell.summaryValue}>{monthSummary.weeklyOffDays}</span>
        </div>
        <div style={shell.summaryCard}>
          <span style={shell.summaryLabel}>Leave Days</span>
          <span style={shell.summaryValue}>{monthSummary.leaveDays}</span>
        </div>
        <div style={shell.summaryCard}>
          <span style={shell.summaryLabel}><Clock3 size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Average Hours</span>
          <span style={shell.summaryValue}>{(monthSummary.workedDays ? (monthSummary.totalHours / monthSummary.workedDays) : 0).toFixed(2)}</span>
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <colgroup>
            <col style={{ width: '17%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '19%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={shell.th}>Employee</th>
              <th style={shell.th}>Status</th>
              <th style={shell.th}>Check In</th>
              <th style={shell.th}>Check Out</th>
              <th style={shell.th}>Working Hours</th>
              <th style={shell.th}>Leave Type</th>
            </tr>
          </thead>
          <tbody>
            {employeeRows.map(({ employee, employeeId, record, workingHours }) => {
              const status = record.status || 'absent';
              const leaveDisabled = status !== 'leave';
              const timeDisabled = status !== 'present';
              return (
                <tr key={employeeId}>
                  <td style={shell.td}>
                    <div style={shell.nameCell}>
                      <span style={shell.empName}>{getEmployeeName(employee)}</span>
                      <span style={shell.empCode}>{employee.empCode || 'No Code'} • {employee.role || 'Employee'}</span>
                    </div>
                  </td>
                  <td style={shell.td}>
                    <div style={shell.statusBtns}>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(status === 'present' ? statusTheme.present : {}) }}
                        onClick={() => setStatus(employeeId, 'present')}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(status === 'absent' ? statusTheme.absent : {}) }}
                        onClick={() => setStatus(employeeId, 'absent')}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(status === 'leave' || status === 'half-day' ? statusTheme.leave : {}) }}
                        onClick={() => setStatus(employeeId, 'leave')}
                      >
                        L
                      </button>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(status === 'weekly-off' ? statusTheme['weekly-off'] : {}) }}
                        onClick={() => setStatus(employeeId, 'weekly-off')}
                      >
                        WO
                      </button>
                    </div>
                  </td>
                  <td style={shell.td}>
                    <input
                      type="time"
                      value={record.checkIn || ''}
                      disabled={timeDisabled}
                      style={shell.input}
                      onChange={(event) => updateRecordField(employeeId, 'checkIn', event.target.value)}
                      onBlur={() => saveRecord(employeeId)}
                    />
                  </td>
                  <td style={shell.td}>
                    <input
                      type="time"
                      value={record.checkOut || ''}
                      disabled={timeDisabled}
                      style={shell.input}
                      onChange={(event) => updateRecordField(employeeId, 'checkOut', event.target.value)}
                      onBlur={() => saveRecord(employeeId)}
                    />
                  </td>
                  <td style={shell.td}>
                    <span style={shell.hoursBadge}>{workingHours.toFixed(2)} hrs</span>
                  </td>
                  <td style={shell.td}>
                    <select
                      value={record.leaveType || ''}
                      disabled={leaveDisabled}
                      style={shell.input}
                      onChange={(event) => {
                        updateRecordField(employeeId, 'leaveType', event.target.value);
                        saveRecord(employeeId, { ...record, leaveType: event.target.value });
                      }}
                    >
                      {leaveTypes.map((entry) => (
                        <option key={entry || 'none'} value={entry}>{entry || 'None'}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {employeeRows.length === 0 ? (
              <tr>
                <td style={shell.td} colSpan={6}>No employees found. Add employees in Employee Master to begin attendance.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p style={shell.footerNote}>{statusMessage || 'Tip: Attendance auto-saves when you change status, leave, or move out of time fields.'}</p>
    </div>
  );
}
