import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPinned, Users } from 'lucide-react';
import useColumnResize from './table/useColumnResize';
import { buildPortalAuthHeaders } from '../utils/portalAuth';
import { formatDurationHours } from '../utils/duration';
import './Attendance.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const ATTENDANCE_CACHE_KEY = 'attendance_dashboard_cache_v1';
const leaveTypes = [
  { value: '', label: 'None' },
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

const leaveTypeAliases = new Map([
  ['cl', 'Casual Leave (CL)'],
  ['sl', 'Sick Leave (SL)'],
  ['lwp', 'Unpaid Leave (LWP)'],
  ['casual leave', 'Casual Leave (CL)'],
  ['casual leave (cl)', 'Casual Leave (CL)'],
  ['sick leave', 'Sick Leave (SL)'],
  ['sick leave (sl)', 'Sick Leave (SL)'],
  ['paid leave', 'Paid Leave'],
  ['earned leave', 'Paid Leave'],
  ['unpaid leave', 'Unpaid Leave (LWP)'],
  ['unpaid leave (lwp)', 'Unpaid Leave (LWP)'],
  ['half day leave', 'Half Day Leave'],
  ['half day', 'Half Day Leave'],
  ['weekly off', 'Weekly Off'],
  ['public holiday', 'Public Holiday'],
  ['outdoor duty', 'Outdoor Duty'],
  ['absent', 'Absent']
]);

const normalizeLeaveType = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const canonical = leaveTypeAliases.get(text.toLowerCase());
  return canonical || text;
};

const firstAttendanceValue = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const formatAttendanceSourceLabel = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const normalized = text.toLowerCase();
  if (normalized === 'manual_admin' || normalized === 'manual admin') return 'admin';
  if (normalized === 'technician_app') return 'Technician App';
  if (normalized === 'sales_app') return 'Sales App';
  if (normalized === 'self') return 'self';
  return text;
};

const formatAttendanceDisplayTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '--';
  const [hoursText, minutesText] = raw.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!/^\d{1,2}$/.test(hoursText || '') || !/^\d{2}$/.test(minutesText || '') || !Number.isFinite(hours) || !Number.isFinite(minutes)) return raw;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

const getEditableTimeValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return isValidTime(raw) ? formatAttendanceDisplayTime(raw) : raw;
};

const sanitizeManualTimeInput = (value) => {
  const digitsAndColon = String(value || '').replace(/[^\d:]/g, '');
  const [hoursPart = '', ...minuteParts] = digitsAndColon.split(':');
  if (minuteParts.length > 0) {
    return `${hoursPart.slice(0, 2)}:${minuteParts.join('').slice(0, 2)}`;
  }
  return hoursPart.slice(0, 4);
};

const normalizeManualTimeInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '--') return '';

  const normalized = raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '');
  const periodMatch = normalized.match(/(AM|PM)$/);
  const period = periodMatch?.[1] || '';
  const timeText = period ? normalized.slice(0, -period.length) : normalized;

  let hoursText = '';
  let minutesText = '';
  if (timeText.includes(':')) {
    const [hoursPart, minutesPart = ''] = timeText.split(':');
    hoursText = hoursPart;
    minutesText = minutesPart;
  } else if (/^\d{1,4}$/.test(timeText)) {
    if (timeText.length <= 2) {
      hoursText = timeText;
      minutesText = '00';
    } else {
      hoursText = timeText.slice(0, -2);
      minutesText = timeText.slice(-2);
    }
  } else {
    return null;
  }

  if (!/^\d{1,2}$/.test(hoursText) || !/^\d{1,2}$/.test(minutesText)) return null;

  let hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;

  if (period) {
    if (hours < 1 || hours > 12) return null;
    if (period === 'AM') hours = hours === 12 ? 0 : hours;
    if (period === 'PM') hours = hours === 12 ? 12 : hours + 12;
  }

  if (hours < 0 || hours > 23) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const resolveStatusForLeaveType = (leaveType, fallbackStatus = 'absent') => {
  const normalized = normalizeLeaveType(leaveType);
  switch (normalized) {
    case 'Outdoor Duty':
      return 'present';
    case 'Weekly Off':
      return 'weekly-off';
    case 'Half Day Leave':
      return 'half-day';
    case 'Absent':
      return 'absent';
    case 'Public Holiday':
    case 'Paid Leave':
    case 'Casual Leave (CL)':
    case 'Sick Leave (SL)':
    case 'Unpaid Leave (LWP)':
      return 'leave';
    default:
      return fallbackStatus;
  }
};

const attendanceColumnWidths = {
  employee: 220,
  status: 120,
  checkIn: 156,
  checkOut: 156,
  workingHours: 120,
  leaveType: 150,
  location: 140,
  source: 100,
  actions: 120
};
const attendanceColumnBounds = {
  employee: { min: 180, max: 320 },
  status: { min: 100, max: 160 },
  checkIn: { min: 148, max: 190 },
  checkOut: { min: 148, max: 190 },
  workingHours: { min: 100, max: 150 },
  leaveType: { min: 130, max: 220 },
  location: { min: 120, max: 220 },
  source: { min: 90, max: 140 },
  actions: { min: 100, max: 150 }
};

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
  title: { margin: 0, fontSize: '30px', letterSpacing: '-0.02em', color: 'var(--text-primary)', fontWeight: 800 },
  subtitle: { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 },
  topbarActions: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  dateControls: { display: 'grid', justifyItems: 'end', gap: '4px' },
  weekdayLabel: { color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em' },
  dateStepper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  dateNavButton: {
    minHeight: '34px',
    width: '34px',
    minWidth: '34px',
    borderRadius: '10px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    color: 'var(--color-primary-dark)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  dateInput: {
    minHeight: '34px',
    borderRadius: '10px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '10px'
  },
  summaryCard: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '14px',
    padding: '12px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(249,250,252,0.98) 100%)',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
    backgroundClip: 'padding-box',
    display: 'grid',
    gap: '8px'
  },
  summaryCardPresent: {
    border: '1px solid rgba(22,163,74,0.28)',
    background: 'rgba(22,163,74,0.10)'
  },
  summaryCardAbsent: {
    border: '1px solid rgba(220,38,38,0.28)',
    background: 'rgba(220,38,38,0.10)'
  },
  summaryCardLeave: {
    border: '1px solid rgba(249,115,22,0.28)',
    background: 'rgba(249,115,22,0.10)'
  },
  summaryCardWeeklyOff: {
    border: '1px solid rgba(234,179,8,0.30)',
    background: 'rgba(234,179,8,0.14)'
  },
  sectionTitle: { margin: 0, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  summaryLabel: { fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryValue: { fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 },
  tableWrap: {
    background: 'var(--table-bg)',
    borderRadius: '8px',
    border: '1px solid var(--att-border)',
    overflowX: 'auto',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
    backgroundClip: 'padding-box'
  },
  table: { width: '100%', minWidth: '1200px', borderCollapse: 'collapse', tableLayout: 'auto' },
  th: { textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'normal', lineHeight: 1.3, minHeight: '42px', height: 'auto', overflow: 'visible', textOverflow: 'clip' },
  td: { padding: '10px', borderBottom: '1px solid var(--att-border)', fontSize: '13px', color: 'var(--text-primary)', verticalAlign: 'middle', wordBreak: 'break-word' },
  nameCell: { display: 'grid', gap: '2px' },
  empName: { fontWeight: 700, color: 'var(--text-primary)' },
  empCode: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 },
  statusBtns: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    flexWrap: 'nowrap',
    width: '100%',
    minWidth: '150px'
  },
  statusBtn: {
    height: '30px',
    minHeight: '30px',
    width: '30px',
    minWidth: '30px',
    borderRadius: '8px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 800,
    padding: '0 2px',
    lineHeight: 0.95,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0'
  },
  input: {
    minHeight: '30px',
    height: '30px',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    padding: '0 10px',
    fontSize: '12px',
    color: 'var(--text-primary)'
  },
  timeInput: {
    position: 'absolute',
    inset: '0 0 0 auto',
    minHeight: '30px',
    height: '30px',
    width: '34px',
    borderRadius: '8px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    padding: 0,
    fontSize: '12px',
    color: 'var(--text-primary)',
    lineHeight: 1,
    boxSizing: 'border-box',
    opacity: 0,
    cursor: 'pointer'
  },
  timeTextInput: {
    minWidth: 0,
    flex: '1 1 auto',
    width: '100%',
    height: '28px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1,
    padding: 0,
    textAlign: 'center',
    whiteSpace: 'nowrap'
  },
  timePickerShell: {
    position: 'relative',
    minHeight: '30px',
    height: '30px',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    padding: '0 12px',
    boxSizing: 'border-box',
    overflow: 'visible'
  },
  timeIcon: {
    flex: '0 0 auto',
    color: 'var(--text-primary)',
    pointerEvents: 'none'
  },
  hoursBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '74px',
    minHeight: '30px',
    height: '30px',
    borderRadius: '999px',
    border: '1px solid rgba(159, 23, 77, 0.32)',
    background: 'rgba(159, 23, 77, 0.08)',
    color: 'var(--color-primary-dark)',
    fontSize: '12px',
    fontWeight: 800
  },
  hoursBadgeStack: {
    display: 'grid',
    gap: '4px',
    justifyItems: 'center'
  },
  overtimeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '74px',
    minHeight: '24px',
    padding: '0 10px',
    borderRadius: '999px',
    border: '1px solid transparent',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.02em'
  },
  overtimeBadgePositive: {
    borderColor: 'rgba(22,163,74,0.34)',
    background: 'rgba(22,163,74,0.10)',
    color: '#166534'
  },
  overtimeBadgeWarning: {
    borderColor: 'rgba(245,158,11,0.34)',
    background: 'rgba(245,158,11,0.12)',
    color: '#92400e'
  },
  overtimeBadgeSunday: {
    borderColor: 'rgba(14,116,144,0.28)',
    background: 'rgba(14,116,144,0.10)',
    color: '#0f766e'
  },
  overtimeBadgeNeutral: {
    borderColor: 'rgba(148,163,184,0.28)',
    background: 'rgba(148,163,184,0.12)',
    color: 'var(--text-secondary)'
  },
  mapBtn: {
    minHeight: '30px',
    height: '30px',
    borderRadius: '7px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    color: 'var(--color-primary-dark)',
    padding: '0 7px',
    fontSize: '10px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  actionBtn: {
    minHeight: '30px',
    height: '30px',
    borderRadius: '8px',
    border: '1px solid var(--att-border)',
    background: 'var(--panel)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 800,
    padding: '0 10px',
    whiteSpace: 'nowrap'
  },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', display: 'grid', placeItems: 'center', padding: '16px', zIndex: 80 },
  modal: { width: 'min(720px, 100%)', maxHeight: '80vh', overflowY: 'auto', borderRadius: '16px', border: '1px solid var(--att-border)', background: 'var(--panel)', boxShadow: 'var(--shadow-soft)', padding: '16px', display: 'grid', gap: '12px' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' },
  auditCard: { border: '1px solid var(--att-border)', borderRadius: '12px', padding: '12px', background: 'var(--panel)', display: 'grid', gap: '6px' },
  auditMeta: { margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 },
  footerNote: { margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }
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

const attendanceShift = {
  start: '09:30',
  end: '17:30',
  standardDailyHours: 8,
  lateOvertimeCutoffMinutes: 30
};

const timeToMinutes = (value) => {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
};

const formatMinutesAsClock = (minutes) => {
  if (!Number.isFinite(minutes)) return '';
  const total = Math.max(0, Math.round(minutes));
  const hours24 = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const displayHour = hours24 % 12 || 12;
  return `${String(displayHour).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
};

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

const computeAttendanceMetrics = (record = {}) => {
  const status = String(record.status || 'absent').trim().toLowerCase();
  const storedWorkingMinutes = Number(record.workingMinutes ?? record.working_minutes);
  const storedWorkingHours = Number(record.workingHours ?? record.working_hours);
  const workingHours = Number.isFinite(storedWorkingMinutes) && storedWorkingMinutes > 0
    ? Number((storedWorkingMinutes / 60).toFixed(2))
    : (Number.isFinite(storedWorkingHours) && storedWorkingHours > 0 ? storedWorkingHours : computeHours(status, record.checkIn, record.checkOut));
  const attendanceDate = String(record.date || '').trim();
  const weekdayName = attendanceDate ? getWeekdayName(attendanceDate) : '';
  const isSunday = weekdayName === 'Sunday';
  const checkInMinutes = timeToMinutes(record.checkIn);
  const checkOutMinutes = timeToMinutes(record.checkOut);
  const shiftStartMinutes = timeToMinutes(attendanceShift.start);
  const shiftEndMinutes = timeToMinutes(attendanceShift.end);

  if (!workingHours || status === 'absent' || status === 'weekly-off' || status === 'leave') {
    return {
      workingHours,
      overtimeHours: 0,
      overtimeLabel: '',
      overtimeTone: 'neutral',
      overtimeTitle: ''
    };
  }

  if (isSunday) {
    return {
      workingHours,
      overtimeHours: 0,
      overtimeLabel: `normal ${formatDurationHours(workingHours)}`,
      overtimeTone: 'sunday',
      overtimeTitle: 'Sunday work is paid at the normal daily rate, not 2x.'
    };
  }

  if (checkInMinutes === null || checkOutMinutes === null || shiftStartMinutes === null || shiftEndMinutes === null) {
    return {
      workingHours,
      overtimeHours: 0,
      overtimeLabel: 'No OT',
      overtimeTone: 'neutral',
      overtimeTitle: 'Overtime is unavailable until both check-in and check-out are valid.'
    };
  }

  const lateMinutes = Math.max(0, checkInMinutes - shiftStartMinutes);
  const overtimeStartMinutes = shiftEndMinutes + lateMinutes;
  const overtimeHours = Math.max(0, (checkOutMinutes - overtimeStartMinutes) / 60);

  if (overtimeHours > 0) {
    return {
      workingHours,
      overtimeHours: Number(overtimeHours.toFixed(2)),
      overtimeLabel: `OT ${formatDurationHours(overtimeHours)}`,
      overtimeTone: 'positive',
      overtimeTitle: `Carry-forward overtime starts at ${formatMinutesAsClock(overtimeStartMinutes)}.`
    };
  }

  if (lateMinutes > 0) {
    return {
      workingHours,
      overtimeHours: 0,
      overtimeLabel: 'Late, no OT',
      overtimeTone: 'warning',
      overtimeTitle: `Late by ${lateMinutes} minutes. Overtime starts at ${formatMinutesAsClock(overtimeStartMinutes)} if work continues.`
    };
  }

  return {
    workingHours,
    overtimeHours: 0,
    overtimeLabel: 'No OT',
    overtimeTone: 'neutral',
    overtimeTitle: 'Overtime only applies after the shift end once check-out extends beyond carry-forward time.'
  };
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

const shiftDateByDays = (value, deltaDays) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setDate(parsed.getDate() + deltaDays);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getWeekdayName = (value) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return weekdayNames[parsed.getDay()] || '';
};

const readAttendanceCache = () => {
  try {
    const raw = window.sessionStorage.getItem(ATTENDANCE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      date: String(parsed.date || ''),
      month: String(parsed.month || ''),
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
      monthRecords: Array.isArray(parsed.monthRecords) ? parsed.monthRecords : [],
      statusMessage: String(parsed.statusMessage || '')
    };
  } catch (_error) {
    return null;
  }
};

const writeAttendanceCache = (next = {}) => {
  try {
    window.sessionStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify({
      date: String(next.date || ''),
      month: String(next.month || ''),
      employees: Array.isArray(next.employees) ? next.employees : [],
      records: next.records && typeof next.records === 'object' ? next.records : {},
      monthRecords: Array.isArray(next.monthRecords) ? next.monthRecords : [],
      statusMessage: String(next.statusMessage || ''),
      updatedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore sessionStorage failures.
  }
};

export default function Attendance() {
  const initialDate = todayDate();
  const initialMonth = monthFromDate(initialDate);
  const [cachedAttendanceData] = useState(() => readAttendanceCache());
  const [date, setDate] = useState(() => cachedAttendanceData?.date || initialDate);
  const [month, setMonth] = useState(() => cachedAttendanceData?.month || initialMonth);
  const [employees, setEmployees] = useState(() => cachedAttendanceData?.employees || []);
  const [records, setRecords] = useState(() => cachedAttendanceData?.records || {});
  const [monthRecords, setMonthRecords] = useState(() => cachedAttendanceData?.monthRecords || []);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('Calendar View');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const selectionRef = useRef(date);
  selectionRef.current = date;
  const [editingTimeKey, setEditingTimeKey] = useState('');
  const [auditModal, setAuditModal] = useState({ open: false, loading: false, employeeName: '', items: [] });
  const [locationModal, setLocationModal] = useState({ open: false, title: '', address: '', timestamp: '', latitude: null, longitude: null, mapUrl: '' });
  const loadRequestRef = useRef(0);
  const {
    getColumnWidth,
    startResize,
    resetColumns: resetAttendanceColumns
  } = useColumnResize({
    storageKey: 'attendance_column_widths',
    columns: ['employee', 'status', 'checkIn', 'checkOut', 'workingHours', 'leaveType', 'location', 'source', 'actions'],
    defaultColumnWidths: attendanceColumnWidths,
    columnBounds: attendanceColumnBounds,
    minWidth: 90,
    enabled: true
  });

  const loadData = async ({ silent = false } = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!silent) setLoading(true);
    const request = (async () => {
      const attendanceDate = date;
      const attendanceMonth = monthFromDate(attendanceDate) || month;
      const cachedSelection = readAttendanceCache();
      const shouldSilenceLoad = silent || Boolean(cachedSelection && cachedSelection.date === attendanceDate && cachedSelection.month === attendanceMonth);
      const weekdayName = getWeekdayName(attendanceDate);
      const sunday = weekdayName === 'Sunday';
      try {
        const [employeesRes, attendanceRes, monthAttendanceRes] = await Promise.allSettled([
          axios.get(`${API_BASE}/api/employees`),
          axios.get(`${API_BASE}/api/attendance`, { params: { date: attendanceDate } }),
          attendanceMonth ? axios.get(`${API_BASE}/api/attendance`) : Promise.resolve({ data: [] })
        ]);

        if (requestId !== loadRequestRef.current || selectionRef.current !== attendanceDate) return;
        const employeeList = employeesRes.status === 'fulfilled' && Array.isArray(employeesRes.value.data)
          ? employeesRes.value.data
          : [];
        const attendanceRows = attendanceRes.status === 'fulfilled' && Array.isArray(attendanceRes.value.data)
          ? attendanceRes.value.data
          : [];
        const monthRows = monthAttendanceRes.status === 'fulfilled' && Array.isArray(monthAttendanceRes.value.data)
          ? monthAttendanceRes.value.data
          : [];
        const filteredMonthRows = monthRows.filter((entry) => String(entry.date || '').startsWith(attendanceMonth ? `${attendanceMonth}-` : ''));

        const recordMap = {};
        attendanceRows.forEach((entry) => {
          const key = String(entry.employeeId || '').trim();
          if (!key) return;
          const normalizedStatus = entry.status === 'half-day' ? 'leave' : (entry.status || 'absent');
          const normalizedSource = firstAttendanceValue(entry.source, entry.source_type, entry.sourceType).toLowerCase();
          const isSelfServiceSource = normalizedSource === 'technician_app' || normalizedSource === 'sales_app' || normalizedSource === 'self';
          const realCheckIn = firstAttendanceValue(
            entry.checkIn,
            entry.check_in,
            entry.check_in_time,
            entry.punchIn,
            entry.punch_in,
            entry.punchInTime,
            entry.punch_in_time
          );
          const realCheckOut = firstAttendanceValue(
            entry.checkOut,
            entry.check_out,
            entry.check_out_time,
            entry.punchOut,
            entry.punch_out,
            entry.punchOutTime,
            entry.punch_out_time
          );
          const normalizedCheckIn = normalizedStatus === 'present' ? (realCheckIn || (isSelfServiceSource ? '' : '09:30')) : '';
          const normalizedCheckOut = normalizedStatus === 'present' ? (realCheckOut || (isSelfServiceSource ? '' : '17:30')) : '';
          recordMap[key] = {
            _id: entry._id,
            recorded: true,
            actualStatus: entry.status || '',
            actualCheckIn: realCheckIn,
            actualCheckOut: realCheckOut,
            employeeId: key,
            date: attendanceDate,
            status: normalizedStatus,
            checkIn: normalizedCheckIn,
            checkOut: normalizedCheckOut,
            workingMinutes: entry.workingMinutes ?? entry.working_minutes ?? null,
            workingHours: entry.workingHours ?? entry.working_hours ?? null,
            leaveType: normalizeLeaveType(entry.leaveType),
            leaveReason: entry.leaveReason || '',
            notes: entry.notes || '',
            source: entry.source || '',
            punchInLatitude: entry.punchInLatitude ?? null,
            punchInLongitude: entry.punchInLongitude ?? null,
            punchInAccuracy: entry.punchInAccuracy ?? null,
            punchInAddress: entry.punchInAddress || '',
            punchInMapUrl: entry.punchInMapUrl || '',
            punchOutLatitude: entry.punchOutLatitude ?? null,
            punchOutLongitude: entry.punchOutLongitude ?? null,
            punchOutAccuracy: entry.punchOutAccuracy ?? null,
            punchOutAddress: entry.punchOutAddress || '',
            punchOutMapUrl: entry.punchOutMapUrl || ''
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
            notes: '',
            source: ''
          };
        });

        const nextStatusMessage = employeesRes.status === 'rejected'
          ? 'Employee data is unavailable. Please retry.'
          : attendanceRes.status === 'rejected'
          ? 'Attendance history is unavailable right now. You can still mark employee attendance.'
          : monthAttendanceRes.status === 'rejected'
            ? 'Month-wise summary is temporarily unavailable.'
            : '';

        setEmployees(employeeList);
        setRecords(recordMap);
        setMonthRecords(filteredMonthRows);
        if (!shouldSilenceLoad || nextStatusMessage) {
          setStatusMessage(nextStatusMessage);
        }
        writeAttendanceCache({
          date: attendanceDate,
          month: attendanceMonth,
          employees: employeeList,
          records: recordMap,
          monthRecords: filteredMonthRows,
          statusMessage: nextStatusMessage
        });
      } catch (error) {
        console.error('Failed to load attendance', error);
        if (!shouldSilenceLoad) {
          setStatusMessage('Failed to load attendance data.');
        }
      }
    })();

    request.finally(() => {
      if (loadRequestRef.current === requestId) setLoading(false);
    });
    return request;
  };

  useEffect(() => {
    loadData();
    return () => { loadRequestRef.current += 1; };
  }, [cachedAttendanceData, date, month]);

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
        notes: '',
        source: '',
        punchInLatitude: null,
        punchInLongitude: null,
        punchInAddress: '',
        punchInMapUrl: '',
        punchOutLatitude: null,
        punchOutLongitude: null,
        punchOutAddress: '',
        punchOutMapUrl: ''
      };
      const attendanceMetrics = computeAttendanceMetrics(record);
      return {
        employee,
        employeeId,
        record,
        workingHours: attendanceMetrics.workingHours,
        attendanceMetrics
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

  const statusLabels = { present: 'Present', absent: 'Absent', leave: 'On Leave', 'half-day': 'Half Day', 'weekly-off': 'Weekly Off', unmarked: 'Unmarked' };
  const displayStatus = (record) => !record.recorded ? 'unmarked'
    : record.leaveType === 'Half Day Leave' ? 'half-day' : (record.actualStatus || record.status || 'unmarked');
  const departmentName = (employee) => employee.department || employee.role || 'Unassigned';
  const departments = [...new Set(employees.map(departmentName))].sort();
  const filteredRows = employeeRows.filter(({ employee, record }) =>
    (!search || `${getEmployeeName(employee)} ${employee.empCode || ''}`.toLowerCase().includes(search.toLowerCase())) &&
    (!department || departmentName(employee) === department) &&
    (!statusFilter || displayStatus(record) === statusFilter)
  );
  const dayCounts = employeeRows.reduce((counts, { record }) => {
    const status = displayStatus(record);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const totalEmployees = employeeRows.length;
  const percentage = (count) => totalEmployees ? Math.round(count * 100 / totalEmployees) : 0;
  const statusOrder = ['present', 'absent', 'leave', 'half-day', 'weekly-off', 'unmarked'];
  let ringOffset = 0;
  const ringStops = statusOrder.map((status) => {
    const start = ringOffset;
    ringOffset += totalEmployees ? (dayCounts[status] || 0) * 100 / totalEmployees : 0;
    return `var(--att-${status}) ${start}% ${ringOffset}%`;
  });
  const selectedDateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const [calendarYear, calendarMonth] = month.split('-').map(Number);
  const monthStart = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const monthDays = new Date(calendarYear, calendarMonth, 0).getDate();
  const calendarRows = new Map();
  // Latest record per employee/date; never infer activity for missing dates.
  [...monthRecords].sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''))).forEach((record) => {
    if (department && !employees.some((employee) => String(employee._id) === String(record.employeeId) && departmentName(employee) === department)) return;
    calendarRows.set(`${record.date}:${record.employeeId}`, record);
  });
  const calendarStatuses = (key) => [...new Set([...calendarRows.values()].filter((record) => record.date === key).map((record) => record.leaveType === 'Half Day Leave' ? 'half-day' : record.status))];
  const shiftMonth = (delta) => {
    const next = new Date(calendarYear, calendarMonth - 1 + delta, 1);
    handleMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const renderTimeline = (rows) => <div className="att-timeline-list">
    {rows.map(({ employee, employeeId, record }) => <button type="button" className="att-person" key={employeeId} onClick={() => openAudit({ employeeId, employee, record })}>
      <span className="att-avatar" data-status={displayStatus(record)}>{getEmployeeName(employee).split(' ').map((word) => word[0]).slice(0, 2).join('')}</span>
      <span className="att-person-name"><strong>{getEmployeeName(employee)}</strong><small>{employee.empCode || 'No Code'} · {departmentName(employee)}</small></span>
      <span className="att-status" data-status={displayStatus(record)}>{statusLabels[displayStatus(record)] || record.status}</span>
      <span className="att-person-time"><span>{record.actualCheckIn || record.actualCheckOut ? `${formatAttendanceDisplayTime(record.actualCheckIn)} – ${formatAttendanceDisplayTime(record.actualCheckOut)}` : 'No punch times'}</span><small>{record.recorded ? formatDurationHours(computeAttendanceMetrics({ ...record, checkIn: record.actualCheckIn, checkOut: record.actualCheckOut }).workingHours) : 'Not recorded'} · {formatAttendanceSourceLabel(record.source)}</small></span>
    </button>)}
    {!rows.length && <p className="att-empty">No employees match these filters.</p>}
  </div>;

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
    const current = records[employeeId] || { employeeId, date, status: 'absent', checkIn: '', checkOut: '', leaveType: '', leaveReason: '', notes: '', source: '' };
    const nextCheckIn = status === 'present'
      ? (current.checkIn || '09:30')
      : '';
    const nextCheckOut = status === 'present'
      ? (current.checkOut || '17:30')
      : '';
    const next = {
      ...current,
      status,
      leaveType: status === 'leave' ? normalizeLeaveType(current.leaveType) : '',
      leaveReason: status === 'leave' ? current.leaveReason : '',
      checkIn: nextCheckIn,
      checkOut: nextCheckOut
    };
    setRecords((prev) => ({ ...prev, [employeeId]: next }));
    saveRecord(employeeId, next);
  };

  const setLeaveType = (employeeId, leaveType) => {
    const current = records[employeeId] || { employeeId, date, status: 'absent', checkIn: '', checkOut: '', leaveType: '', leaveReason: '', notes: '', source: '' };
    const nextLeaveType = normalizeLeaveType(leaveType);
    const nextStatus = resolveStatusForLeaveType(nextLeaveType, current.status || 'absent');
    const nextCheckIn = nextStatus === 'present'
      ? (current.checkIn || '09:30')
      : '';
    const nextCheckOut = nextStatus === 'present'
      ? (current.checkOut || '17:30')
      : '';
    const next = {
      ...current,
      status: nextStatus,
      leaveType: nextLeaveType,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
      leaveReason: nextStatus === 'leave' ? current.leaveReason : ''
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
        leaveType: normalizeLeaveType(row.leaveType),
        leaveReason: row.leaveReason,
        notes: row.notes
      }, {
        headers: buildPortalAuthHeaders()
      });
      if (selectionRef.current !== date) return;
      const saved = res.data || {};
      setRecords((prev) => ({
        ...prev,
        [employeeId]: {
          ...(prev[employeeId] || {}),
          _id: saved._id || row._id,
          recorded: true,
          actualStatus: saved.status || row.status,
          actualCheckIn: saved.checkIn || '',
          actualCheckOut: saved.checkOut || '',
          employeeId,
          date,
          status: saved.status || row.status,
          checkIn: saved.checkIn || '',
          checkOut: saved.checkOut || '',
          leaveType: normalizeLeaveType(saved.leaveType),
          leaveReason: saved.leaveReason || '',
          notes: saved.notes || '',
          source: saved.source || '',
          workingMinutes: saved.workingMinutes ?? saved.working_minutes ?? null,
          workingHours: saved.workingHours ?? saved.working_hours ?? null,
          punchInLatitude: saved.punchInLatitude ?? null,
          punchInLongitude: saved.punchInLongitude ?? null,
          punchInAddress: saved.punchInAddress || '',
          punchInMapUrl: saved.punchInMapUrl || '',
          punchOutLatitude: saved.punchOutLatitude ?? null,
          punchOutLongitude: saved.punchOutLongitude ?? null,
          punchOutAddress: saved.punchOutAddress || '',
          punchOutMapUrl: saved.punchOutMapUrl || ''
        }
      }));
      if (monthFromDate(date) === month) {
        loadData({ silent: true });
      }
    } catch (error) {
      console.error('Failed to save attendance', error);
      const apiMessage = String(error?.response?.data?.error || '').trim();
      setStatusMessage(apiMessage || 'Some attendance updates could not be saved.');
    }
  };

  const handleTimeBlur = (employeeId, field, value) => {
    setEditingTimeKey('');
    const current = records[employeeId] || { employeeId, date, status: 'present', checkIn: '', checkOut: '', leaveType: '', leaveReason: '', notes: '', source: '' };
    const normalizedTime = normalizeManualTimeInput(value);
    if (normalizedTime === null) {
      setStatusMessage('Enter time as 09:30, 0930, 530, or 17:30.');
      updateRecordField(employeeId, field, '');
      return;
    }
    saveRecord(employeeId, {
      ...current,
      [field]: normalizedTime
    });
  };

  const handleManualTimeChange = (employeeId, field, value) => {
    updateRecordField(employeeId, field, sanitizeManualTimeInput(value));
  };

  const handleManualTimeFocus = (employeeId, field) => {
    setEditingTimeKey(`${employeeId}:${field}`);
  };

  const handleDateChange = (nextDate) => {
    if (nextDate !== date) setLoading(true);
    setDate(nextDate);
    const nextMonth = monthFromDate(nextDate);
    if (nextMonth && nextMonth !== month) {
      setMonth(nextMonth);
    }
  };

  const handleMonthChange = (nextMonth) => {
    if (nextMonth !== month) setLoading(true);
    setMonth(nextMonth);
    if (nextMonth && !String(date).startsWith(nextMonth)) {
      setDate(`${nextMonth}-01`);
    }
  };

  const shiftSelectedDate = (deltaDays) => {
    handleDateChange(shiftDateByDays(date, deltaDays));
  };

  const openAudit = async ({ employeeId, employee, record }) => {
    try {
      setAuditModal({ open: true, loading: true, employeeName: getEmployeeName(employee), items: [] });
      const params = new URLSearchParams({ employee_id: employeeId, date: record.date || date });
      const res = await axios.get(`${API_BASE}/api/attendance/audit?${params.toString()}`);
      setAuditModal({
        open: true,
        loading: false,
        employeeName: getEmployeeName(employee),
        items: Array.isArray(res.data) ? res.data : []
      });
    } catch (error) {
      console.error('Failed to load attendance audit', error);
      setAuditModal({ open: true, loading: false, employeeName: getEmployeeName(employee), items: [] });
      setStatusMessage(error?.response?.data?.error || 'Unable to load attendance audit.');
    }
  };

  const openLocationModal = (record, type, employeeName) => {
    const isPunchIn = type === 'in';
    const latitude = isPunchIn ? record.punchInLatitude : record.punchOutLatitude;
    const longitude = isPunchIn ? record.punchInLongitude : record.punchOutLongitude;
    const mapUrl = isPunchIn ? record.punchInMapUrl : record.punchOutMapUrl;
    setLocationModal({
      open: true,
      title: `${employeeName || 'Employee'} ${isPunchIn ? 'Check In' : 'Check Out'} Location`,
      address: isPunchIn ? record.punchInAddress : record.punchOutAddress,
      timestamp: `${record.date || date} ${isPunchIn ? record.checkIn : record.checkOut}`.trim(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      mapUrl: mapUrl || (latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}` : '')
    });
  };

  return (
    <div className="attendance-page" style={shell.page}>
      <div data-page-toolbar="true" style={shell.topbar}>
        <div style={shell.titleWrap}>
          <h2 style={shell.title}>Attendance</h2>
          <p style={shell.subtitle}>Manage daily attendance, working hours, leaves and employee timelines.</p>
        </div>
        <div style={shell.dateControls}>
          <div className="att-date-actions" style={shell.topbarActions}>
        <button type="button" className="att-today" onClick={() => handleDateChange(todayDate())}>Today</button>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
            <input
              type="month"
              aria-label="Attendance month"
              required
              value={month}
              onChange={(event) => event.target.value && handleMonthChange(event.target.value)}
              style={shell.dateInput}
            />
          </label>
          <div className="att-date-stepper" style={shell.dateStepper}>
            <button
              type="button"
              onClick={() => shiftSelectedDate(-1)}
              style={shell.dateNavButton}
              aria-label="Previous date"
              title="Previous date"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              aria-label="Selected attendance date"
              required
              value={date}
              onChange={(event) => event.target.value && handleDateChange(event.target.value)}
              style={shell.dateInput}
            />
            <button
              type="button"
              onClick={() => shiftSelectedDate(1)}
              style={shell.dateNavButton}
              aria-label="Next date"
              title="Next date"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <span style={shell.weekdayLabel}>{getWeekdayName(date)}</span>
      </div>
      </div>

      <nav className="att-tabs" aria-label="Attendance views">
        {['Calendar View', 'Daily View', 'Team View', 'Location View'].map((label) => <button type="button" key={label} aria-pressed={view === label} className={view === label ? 'active' : ''} onClick={() => setView(label)}>{label}</button>)}
      </nav>
      <div className="att-metrics" aria-label="Selected date attendance totals">
        {[['total', 'Total Employees', totalEmployees, Users], ['present', 'Present', dayCounts.present || 0, Users], ['absent', 'Absent', dayCounts.absent || 0, Users], ['leave', 'On Leave', dayCounts.leave || 0, CalendarDays], ['half-day', 'Half Day', dayCounts['half-day'] || 0, Clock3], ['weekly-off', 'Weekly Off', dayCounts['weekly-off'] || 0, Clock3]].map(([status, label, count, Icon]) => <div className="att-metric" key={status} data-status={status}><span className="att-metric-icon"><Icon size={25} /></span><div><span>{label}</span><strong>{loading ? '—' : count}</strong><small>{status === 'total' ? 'Selected date' : `${percentage(count)}% of employees`}</small></div></div>)}
      </div>
      <section className="att-panel att-filters" aria-label="Attendance filters">
        <label className="att-search">Search employees<input type="search" placeholder="Search employee name or code…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Department<select aria-label="Department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All Departments</option>{departments.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Status<select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All Statuses</option>{statusOrder.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <button type="button" onClick={() => { setSearch(''); setDepartment(''); setStatusFilter(''); setRangeStart(''); setRangeEnd(''); }}>Clear filters</button>
      </section>
      {loading && <p className="att-notice" role="status">Loading attendance for {date}…</p>}
      {statusMessage && <div className="att-notice" role="status">{statusMessage} <button type="button" onClick={() => loadData()}>Refresh attendance</button></div>}
      <div className={`att-overview ${view === 'Calendar View' ? '' : 'att-overview-wide'}`} aria-busy={loading}>
        {view === 'Calendar View' && <section className="att-panel att-calendar">
          <div className="att-panel-heading"><h3><CalendarDays size={18} /> Attendance Calendar</h3><div className="att-calendar-nav"><button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button><strong>{monthHeading(month)}</strong><button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button></div></div>
          <div className="att-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="att-calendar-grid">
            {Array.from({ length: Math.ceil((monthStart + monthDays) / 7) * 7 }, (_, index) => {
              const day = index - monthStart + 1;
              if (day < 1 || day > monthDays) return <span className="att-calendar-blank" key={index} />;
              const key = `${month}-${String(day).padStart(2, '0')}`;
              const statuses = calendarStatuses(key);
              const outsideRange = (rangeStart && key < rangeStart) || (rangeEnd && key > rangeEnd);
              return <button type="button" key={key} disabled={Boolean(outsideRange)} aria-label={`${key}: ${statuses.map((status) => statusLabels[status] || status).join(', ') || 'No recorded attendance'}`} aria-pressed={date === key} className={date === key ? 'selected' : ''} onClick={() => handleDateChange(key)}><span>{day}</span><span className="att-dots">{statuses.map((status) => <i key={status} data-status={status} />)}</span></button>;
            })}
          </div>
          <div className="att-legend">{statusOrder.slice(0, 5).map((status) => <span key={status}><i data-status={status} />{statusLabels[status]}</span>)}</div>
          <details className="att-range"><summary>Filter calendar dates</summary><div><label>From<input type="date" aria-label="Calendar range start" value={rangeStart} max={rangeEnd || undefined} onChange={(event) => setRangeStart(event.target.value)} /></label><label>To<input type="date" aria-label="Calendar range end" value={rangeEnd} min={rangeStart || undefined} onChange={(event) => setRangeEnd(event.target.value)} /></label></div></details>
          <p className="att-caption">Indicators show saved records{department ? ` · ${department}` : ''}. Blank dates have no recorded activity.</p>
        </section>}
        <section className="att-panel att-day-summary">
          <div className="att-panel-heading"><h3><CalendarDays size={18} /> Selected Day Summary</h3></div>
          <h4>{selectedDateLabel}</h4>
          <div className="att-summary-content"><div className="att-ring" role="img" aria-label={`${percentage(dayCounts.present || 0)}% present, ${dayCounts.unmarked || 0} unmarked`} style={{ background: totalEmployees ? `conic-gradient(${ringStops.join(',')})` : 'var(--att-unmarked)' }}><div><strong>{totalEmployees}</strong><span>Employees</span></div></div>
          <div className="att-summary-legend">{statusOrder.map((status) => <div key={status}><span><i data-status={status} />{statusLabels[status]}</span><strong>{dayCounts[status] || 0} <small>({percentage(dayCounts[status] || 0)}%)</small></strong></div>)}</div></div>
          <div className="att-attendance-rate"><span>Attendance Percentage</span><strong>{percentage(dayCounts.present || 0)}%</strong></div>
          <p className="att-caption">Present ÷ total employees. Unmarked means no saved record. Totals include all employees returned for this date.</p>
        </section>
        <section className="att-panel att-timeline">
          <div className="att-panel-heading"><h3><Users size={18} /> {view === 'Team View' ? 'Team Attendance' : view === 'Location View' ? 'Punch Locations' : 'Employee Timeline'}</h3><span>{date}</span></div>
          {view === 'Team View' ? <div className="att-teams">{[...new Set(filteredRows.map(({ employee }) => departmentName(employee)))].map((name) => {
            const rows = filteredRows.filter(({ employee }) => departmentName(employee) === name);
            return <details key={name} open><summary>{name} · {rows.length} employees · {rows.filter(({ record }) => displayStatus(record) === 'present').length} present</summary>{renderTimeline(rows)}</details>;
          })}{!filteredRows.length && <p className="att-empty">No teams match these filters.</p>}</div>
          : view === 'Location View' ? <div className="att-locations">{filteredRows.map(({ employee, employeeId, record }) => <article key={employeeId}><strong>{getEmployeeName(employee)}</strong><small>{employee.empCode || 'No Code'} · {formatAttendanceSourceLabel(record.source)}</small><div>{['in', 'out'].map((type) => {
            const prefix = type === 'in' ? 'punchIn' : 'punchOut';
            const captured = record[`${prefix}MapUrl`] || (record[`${prefix}Latitude`] != null && record[`${prefix}Longitude`] != null);
            return captured ? <button key={type} type="button" onClick={() => openLocationModal(record, type, getEmployeeName(employee))}><MapPinned size={14} />{type === 'in' ? 'Check In' : 'Check Out'} location</button> : <span key={type}>{type === 'in' ? 'In' : 'Out'}: Not captured</span>;
          })}</div></article>)}{!filteredRows.length && <p className="att-empty">No employees match these filters.</p>}</div>
          : renderTimeline(filteredRows)}
        </section>
      </div>
      <details className="att-month-summary"><summary>Month Wise Summary · {monthHeading(month)}</summary>      <h3 style={shell.sectionTitle}>Month Wise Summary ({monthHeading(month)})</h3>
      <div style={shell.summaryGrid}>
        <div className="attendance-summary-card" style={shell.summaryCard}>
          <span style={shell.summaryLabel}><Users size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Employees Marked</span>
          <span style={shell.summaryValue}>{monthSummary.uniqueEmployees.size}</span>
        </div>
        <div className="attendance-summary-card" style={{ ...shell.summaryCard, ...shell.summaryCardPresent }}>
          <span style={shell.summaryLabel}>Present Days</span>
          <span style={shell.summaryValue}>{monthSummary.presentDays}</span>
        </div>
        <div className="attendance-summary-card" style={{ ...shell.summaryCard, ...shell.summaryCardAbsent }}>
          <span style={shell.summaryLabel}>Absent Days</span>
          <span style={shell.summaryValue}>{monthSummary.absentDays}</span>
        </div>
        <div className="attendance-summary-card" style={{ ...shell.summaryCard, ...shell.summaryCardWeeklyOff }}>
          <span style={shell.summaryLabel}>Weekly Off</span>
          <span style={shell.summaryValue}>{monthSummary.weeklyOffDays}</span>
        </div>
        <div className="attendance-summary-card" style={{ ...shell.summaryCard, ...shell.summaryCardLeave }}>
          <span style={shell.summaryLabel}>Leave Days</span>
          <span style={shell.summaryValue}>{monthSummary.leaveDays}</span>
        </div>
        <div className="attendance-summary-card" style={shell.summaryCard}>
          <span style={shell.summaryLabel}><Clock3 size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Average Hours</span>
          <span style={shell.summaryValue}>{(monthSummary.workedDays ? (monthSummary.totalHours / monthSummary.workedDays) : 0).toFixed(2)}</span>
        </div>
      </div>

      </details>
      <section className="att-panel att-records">
        <div className="att-panel-heading"><h3><CalendarDays size={18} /> Attendance Records · {date}</h3><span>{filteredRows.length} of {totalEmployees} employees · Auto-save enabled</span></div>
        <p className="att-table-hint">Select Present to enable time editing. Changes auto-save.</p>
      <fieldset className="att-editors" disabled={loading}>
      <div className="att-table-fit" style={shell.tableWrap}>
        <table className="att-records-table" style={{ ...shell.table, minWidth: 0, tableLayout: 'fixed' }}>
          <colgroup>
            {[18, 13, 11, 11, 10, 13, 9, 7, 8].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...shell.th, width: `${getColumnWidth('employee')}px`, minWidth: `${getColumnWidth('employee')}px` }}>
                Employee
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('status')}px`, minWidth: `${getColumnWidth('status')}px` }}>
                Status
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('checkIn')}px`, minWidth: `${getColumnWidth('checkIn')}px` }}>
                Check In
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('checkOut')}px`, minWidth: `${getColumnWidth('checkOut')}px` }}>
                Check Out
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('workingHours')}px`, minWidth: `${getColumnWidth('workingHours')}px` }}>
                Working Hours
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('leaveType')}px`, minWidth: `${getColumnWidth('leaveType')}px` }}>
                Leave Type
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('location')}px`, minWidth: `${getColumnWidth('location')}px` }}>
                Location
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('source')}px`, minWidth: `${getColumnWidth('source')}px` }}>
                Source
                
              </th>
              <th style={{ ...shell.th, textAlign: 'center', width: `${getColumnWidth('actions')}px`, minWidth: `${getColumnWidth('actions')}px` }}>
                Actions
                
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ employee, employeeId, record, workingHours, attendanceMetrics }) => {
              const status = record.status || 'absent';
              const timeDisabled = status !== 'present';
              const checkInPickerValue = normalizeManualTimeInput(record.checkIn) || '';
              const checkOutPickerValue = normalizeManualTimeInput(record.checkOut) || '';
              const checkInEditKey = `${employeeId}:checkIn`;
              const checkOutEditKey = `${employeeId}:checkOut`;
              return (
                <tr key={employeeId} data-employee-id={employeeId}>
                  <td data-label="Employee" style={shell.td}>
                    <div style={shell.nameCell}>
                      <span style={shell.empName}>{getEmployeeName(employee)}</span>
                      <span style={shell.empCode}>{employee.empCode || 'No Code'} • {departmentName(employee)}{!record.recorded ? ' · Unmarked' : ''}</span>
                    </div>
                  </td>
                  <td data-label="Status" style={shell.td}>
                    <div className="att-status-controls" style={shell.statusBtns}>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(status === 'present' ? statusTheme.present : {}) }}
                        data-status="present"
                        aria-label="Present"
                        aria-pressed={Boolean(record.recorded && status === 'present')}
                        onClick={() => setStatus(employeeId, 'present')}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(record.recorded && status === 'absent' ? statusTheme.absent : {}) }}
                        data-status="absent"
                        aria-label="Absent"
                        aria-pressed={Boolean(record.recorded && status === 'absent')}
                        onClick={() => setStatus(employeeId, 'absent')}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(status === 'leave' || status === 'half-day' ? statusTheme.leave : {}) }}
                        data-status="leave"
                        aria-label="Leave"
                        aria-pressed={Boolean(record.recorded && status === 'leave')}
                        onClick={() => setStatus(employeeId, 'leave')}
                      >
                        L
                      </button>
                      <button
                        type="button"
                        style={{ ...shell.statusBtn, ...(record.recorded && status === 'weekly-off' ? statusTheme['weekly-off'] : {}) }}
                        data-status="weekly-off"
                        aria-label="Weekly Off"
                        aria-pressed={Boolean(record.recorded && status === 'weekly-off')}
                        onClick={() => setStatus(employeeId, 'weekly-off')}
                      >
                        WO
                      </button>
                    </div>
                  </td>
                  <td data-label="Check In" style={shell.td}>
                    <div className="att-time-control" style={shell.timePickerShell}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingTimeKey === checkInEditKey ? sanitizeManualTimeInput(record.checkIn) : getEditableTimeValue(record.checkIn)}
                        disabled={timeDisabled}
                        placeholder="--:--"
                        aria-label="Check in time"
                        style={{ ...shell.timeTextInput, cursor: timeDisabled ? 'default' : 'text' }}
                        onFocus={() => handleManualTimeFocus(employeeId, 'checkIn')}
                        onChange={(event) => handleManualTimeChange(employeeId, 'checkIn', event.target.value)}
                        onBlur={(event) => handleTimeBlur(employeeId, 'checkIn', event.target.value)}
                      />
                      <Clock3 size={15} strokeWidth={2.4} style={shell.timeIcon} />
                      <input
                        type="time"
                        value={checkInPickerValue}
                        disabled={timeDisabled}
                        aria-label="Open check in time picker"
                        style={{ ...shell.timeInput, cursor: timeDisabled ? 'default' : 'pointer' }}
                        onChange={(event) => updateRecordField(employeeId, 'checkIn', event.target.value)}
                        onBlur={(event) => handleTimeBlur(employeeId, 'checkIn', event.target.value)}
                      />
                    </div>
                  </td>
                  <td data-label="Check Out" style={shell.td}>
                    <div className="att-time-control" style={shell.timePickerShell}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingTimeKey === checkOutEditKey ? sanitizeManualTimeInput(record.checkOut) : getEditableTimeValue(record.checkOut)}
                        disabled={timeDisabled}
                        placeholder="--:--"
                        aria-label="Check out time"
                        style={{ ...shell.timeTextInput, cursor: timeDisabled ? 'default' : 'text' }}
                        onFocus={() => handleManualTimeFocus(employeeId, 'checkOut')}
                        onChange={(event) => handleManualTimeChange(employeeId, 'checkOut', event.target.value)}
                        onBlur={(event) => handleTimeBlur(employeeId, 'checkOut', event.target.value)}
                      />
                      <Clock3 size={15} strokeWidth={2.4} style={shell.timeIcon} />
                      <input
                        type="time"
                        value={checkOutPickerValue}
                        disabled={timeDisabled}
                        aria-label="Open check out time picker"
                        style={{ ...shell.timeInput, cursor: timeDisabled ? 'default' : 'pointer' }}
                        onChange={(event) => updateRecordField(employeeId, 'checkOut', event.target.value)}
                        onBlur={(event) => handleTimeBlur(employeeId, 'checkOut', event.target.value)}
                      />
                    </div>
                  </td>
                  <td data-label="Working Hours" style={shell.td}>
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <div style={shell.hoursBadgeStack}>
                        <span className="attendance-hours-badge" style={shell.hoursBadge}>{formatDurationHours(workingHours)}</span>
                        {attendanceMetrics.overtimeLabel ? (
                          <span
                            style={{
                              ...shell.overtimeBadge,
                              ...(attendanceMetrics.overtimeTone === 'positive' ? shell.overtimeBadgePositive : {}),
                              ...(attendanceMetrics.overtimeTone === 'warning' ? shell.overtimeBadgeWarning : {}),
                              ...(attendanceMetrics.overtimeTone === 'sunday' ? shell.overtimeBadgeSunday : {}),
                              ...(attendanceMetrics.overtimeTone === 'neutral' ? shell.overtimeBadgeNeutral : {})
                            }}
                            title={attendanceMetrics.overtimeTitle}
                          >
                            {attendanceMetrics.overtimeLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td data-label="Leave Type" style={shell.td}>
                    <select
                      value={record.leaveType || ''}
                      aria-label={`Leave type for ${getEmployeeName(employee)}`}
                      style={shell.input}
                      onChange={(event) => {
                        setLeaveType(employeeId, event.target.value);
                      }}
                    >
                      {record.leaveType && !leaveTypes.some((entry) => entry.value === record.leaveType) ? <option value={record.leaveType}>{record.leaveType} (saved)</option> : null}
                      {leaveTypes.map((entry) => (
                        <option key={entry.value || 'none'} value={entry.value}>{entry.label}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Location" style={shell.td}>
                    <div className="att-location-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'nowrap', whiteSpace: 'nowrap', width: '100%' }}>
                      {record.punchInMapUrl || (record.punchInLatitude && record.punchInLongitude) ? (
                        <button
                          type="button"
                          style={shell.mapBtn}
                          onClick={() => openLocationModal(record, 'in', getEmployeeName(employee))}
                        >
                          <MapPinned size={12} /> In
                        </button>
                      ) : null}
                      {record.punchOutMapUrl || (record.punchOutLatitude && record.punchOutLongitude) ? (
                        <button
                          type="button"
                          style={shell.mapBtn}
                          onClick={() => openLocationModal(record, 'out', getEmployeeName(employee))}
                        >
                          <MapPinned size={12} /> Out
                        </button>
                      ) : null}
                      {!(record.punchInMapUrl || (record.punchInLatitude && record.punchInLongitude) || record.punchOutMapUrl || (record.punchOutLatitude && record.punchOutLongitude)) ? '-' : null}
                    </div>
                  </td>
                  <td data-label="Source" style={{ ...shell.td, textAlign: 'center' }}>{formatAttendanceSourceLabel(record.source)}</td>
                  <td data-label="Actions" style={shell.td}>
                    <button type="button" className="att-audit-action" style={shell.actionBtn} onClick={() => openAudit({ employeeId, employee, record })}>View Audit</button>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 ? (
              <tr>
                <td style={shell.td} colSpan={9}>{loading ? 'Loading attendance…' : employees.length ? 'No employees match these filters.' : 'No employees found. Add employees in Employee Master to begin attendance.'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </fieldset>
      </section>
      <p role="status" aria-live="polite" style={shell.footerNote}>{statusMessage || 'Tip: Attendance auto-saves when you change status, leave, or move out of time fields. Overtime follows the 9:30 AM - 5:30 PM shift, and Sunday work is paid normally.'}</p>

      {auditModal.open ? (
        <div style={shell.modalBg}>
          <div style={shell.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
              <div>
                <h3 style={shell.modalTitle}>Attendance Audit</h3>
                <p style={shell.auditMeta}>{auditModal.employeeName} • {date}</p>
              </div>
              <button type="button" style={shell.actionBtn} onClick={() => setAuditModal({ open: false, loading: false, employeeName: '', items: [] })}>Close</button>
            </div>
            {auditModal.loading ? <p style={shell.footerNote}>Loading audit history...</p> : null}
            {!auditModal.loading && auditModal.items.length === 0 ? <p style={shell.footerNote}>No audit history found.</p> : null}
            {!auditModal.loading && auditModal.items.map((item) => (
              <div key={item.id} style={shell.auditCard}>
                <p style={shell.auditMeta}>{item.changedBy || '-'} • {item.changedAt ? String(item.changedAt).replace('T', ' ').slice(0, 16) : '-'}</p>
                <p style={shell.footerNote}>Status: {item.oldStatus || '-'} → {item.newStatus || '-'}</p>
                <p style={shell.footerNote}>Check In: {formatAttendanceDisplayTime(item.oldCheckInTime ? String(item.oldCheckInTime).slice(11, 16) : '')} → {formatAttendanceDisplayTime(item.newCheckInTime ? String(item.newCheckInTime).slice(11, 16) : '')}</p>
                <p style={shell.footerNote}>Check Out: {formatAttendanceDisplayTime(item.oldCheckOutTime ? String(item.oldCheckOutTime).slice(11, 16) : '')} → {formatAttendanceDisplayTime(item.newCheckOutTime ? String(item.newCheckOutTime).slice(11, 16) : '')}</p>
                <p style={shell.footerNote}>Source: {item.source || '-'}</p>
                {item.reason ? <p style={shell.footerNote}>Reason: {item.reason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {locationModal.open ? (
        <div style={shell.modalBg}>
          <div style={{ ...shell.modal, width: 'min(520px, 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
              <div>
                <h3 style={shell.modalTitle}>{locationModal.title}</h3>
                <p style={shell.auditMeta}>{locationModal.timestamp || '-'}</p>
              </div>
              <button type="button" style={shell.actionBtn} onClick={() => setLocationModal({ open: false, title: '', address: '', timestamp: '', latitude: null, longitude: null, mapUrl: '' })}>Close</button>
            </div>
            <p style={shell.footerNote}>{locationModal.address || 'Address not captured by the app.'}</p>
            <p style={shell.footerNote}>Coordinates: {locationModal.latitude ?? '-'}, {locationModal.longitude ?? '-'}</p>
            {locationModal.mapUrl ? (
              <a href={locationModal.mapUrl} target="_blank" rel="noreferrer" style={{ ...shell.mapBtn, width: 'fit-content' }}>
                <MapPinned size={12} /> Open in Maps
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
