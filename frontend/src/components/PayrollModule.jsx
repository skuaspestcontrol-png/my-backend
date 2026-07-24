import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Download, FileText, Filter, HandCoins, Landmark, Pencil, ShieldCheck, Trash2, UserRoundCheck } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import PdfPreviewModal from './PdfPreviewModal';
import { buildPortalAuthHeaders, getPortalUserId, getPortalUserName, getPortalUserRole } from '../utils/portalAuth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const PAYROLL_DASHBOARD_CACHE_KEY = 'payroll_dashboard_cache_v1';

const roleFlags = () => {
  const roleRaw = String(getPortalUserRole() || 'Admin').trim().toLowerCase();
  const isAdmin = roleRaw === 'admin' || roleRaw === '';
  const isHr = roleRaw.includes('hr');
  const isAccountant = roleRaw.includes('account');
  const canManage = isAdmin || isHr;
  const canMarkPaid = isAdmin || isAccountant;
  const canGenerate = isAdmin || isHr;
  const canViewOwn = !canManage && !canMarkPaid;
  return { roleRaw, canManage, canMarkPaid, canGenerate, canViewOwn };
};

const tabKeys = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'generate', label: 'Salary Processing' },
  { key: 'list', label: 'Salary History' },
  { key: 'slips', label: 'Salary Slips' },
  { key: 'setup', label: 'Settings' }
];

const thisDate = new Date();
const defaultMonth = thisDate.getMonth() + 1;
const defaultYear = thisDate.getFullYear();
const monthOptions = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: new Date(defaultYear, index, 1).toLocaleDateString('en-IN', { month: 'long' })
}));

const money = (value) => {
  const amount = Number(value || 0);
  const formatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
};
const getEmployeeKey = (entry = {}) => String(
  entry?._id
  || entry?.external_id
  || entry?.id
  || entry?.empCode
  || entry?.employeeCode
  || ''
).trim();
const getEmployeeDisplayName = (entry = {}) => {
  const fullName = [
    entry?.firstName || entry?.first_name,
    entry?.lastName || entry?.last_name
  ].filter(Boolean).join(' ').trim();
  return fullName || String(entry?.employeeName || entry?.name || entry?.displayName || entry?.empCode || entry?.employeeCode || '').trim();
};

const statusBadgeStyle = (statusRaw) => {
  const status = String(statusRaw || '').toLowerCase();
  if (status === 'paid') return { background: 'rgba(22,163,74,0.16)', color: '#166534', border: '1px solid rgba(22,163,74,0.32)' };
  if (status === 'hold') return { background: 'rgba(234,179,8,0.15)', color: '#92400e', border: '1px solid rgba(217,119,6,0.32)' };
  if (status === 'generated') return { background: 'rgba(159, 23, 77, 0.16)', color: 'var(--color-primary-dark)', border: '1px solid rgba(159, 23, 77, 0.32)' };
  return { background: 'rgba(100,116,139,0.14)', color: '#334155', border: '1px solid rgba(100,116,139,0.22)' };
};

const payrollHistoryColumns = [
  { key: 'employee', label: 'Employee' },
  { key: 'month', label: 'Month' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'gross', label: 'Gross' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'net', label: 'Net' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'payment', label: 'Payment' },
  { key: 'action', label: 'Action' }
];
const payrollHistoryDefaultWidths = {
  employee: 180,
  month: 120,
  attendance: 150,
  gross: 120,
  deductions: 120,
  net: 120,
  payroll: 120,
  payment: 120,
  action: 240
};
const payrollHistoryColumnBounds = {
  employee: { min: 150, max: 260 },
  month: { min: 100, max: 160 },
  attendance: { min: 130, max: 220 },
  gross: { min: 100, max: 150 },
  deductions: { min: 100, max: 150 },
  net: { min: 100, max: 150 },
  payroll: { min: 100, max: 150 },
  payment: { min: 100, max: 150 },
  action: { min: 220, max: 320 }
};

const payrollSlipColumns = [
  { key: 'employee', label: 'Employee' },
  { key: 'month', label: 'Month' },
  { key: 'net', label: 'Net Salary' },
  { key: 'payment', label: 'Payment' },
  { key: 'slip', label: 'Slip' },
  { key: 'actions', label: 'Actions' }
];
const payrollSlipDefaultWidths = {
  employee: 180,
  month: 120,
  net: 130,
  payment: 120,
  slip: 120,
  actions: 260
};
const payrollSlipColumnBounds = {
  employee: { min: 150, max: 260 },
  month: { min: 100, max: 160 },
  net: { min: 110, max: 160 },
  payment: { min: 100, max: 150 },
  slip: { min: 100, max: 150 },
  actions: { min: 220, max: 320 }
};

const shell = {
  page: { display: 'grid', gap: '14px' },
  hero: {
    background: 'var(--color-primary)',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    borderRadius: '18px',
    padding: '16px'
  },
  title: { margin: 0, color: '#ffffff', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  subtitle: { margin: '6px 0 0 0', color: 'rgba(255,255,255,0.92)', fontWeight: 600, fontSize: '13px' },
  tabStrip: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tabStripMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  tab: {
    border: '1px solid rgba(159, 23, 77, 0.24)',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '999px',
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  tabMobile: {
    width: '100%',
    minHeight: '32px',
    padding: '0 10px',
    fontSize: '11px'
  },
  panel: {
    border: '1px solid rgba(159, 23, 77, 0.18)',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: 'var(--shadow-soft)',
    padding: '14px',
    display: 'grid',
    gap: '12px'
  },
  panelTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', gap: '8px', alignItems: 'center' },
  sub: { margin: 0, fontSize: '12px', color: '#475569' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' },
  card: { border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '12px', padding: '12px', background: '#fff' },
  cardLabel: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  cardValue: { margin: '6px 0 0 0', fontSize: '20px', color: '#0f172a', fontWeight: 800 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  field: { display: 'grid', gap: '5px' },
  label: { margin: 0, fontSize: '10px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', minHeight: '34px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '7px 9px', fontSize: '12px', background: '#fff' },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  btn: {
    border: '1px solid rgba(159, 23, 77, 0.32)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '8px',
    minHeight: '26px',
    padding: '0 8px',
    fontSize: '10px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  btnLight: {
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '8px',
    minHeight: '26px',
    padding: '0 8px',
    fontSize: '10px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  payrollTable: { width: '100%', borderCollapse: 'collapse', minWidth: '1280px', tableLayout: 'fixed' },
  payrollActionCell: { width: '260px', minWidth: '260px' },
  payrollActionGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
    alignItems: 'stretch'
  },
  payrollActionButton: {
    minHeight: '34px',
    width: '100%',
    padding: '0 10px',
    justifyContent: 'center',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  payrollIconButton: {
    minHeight: '34px',
    width: '34px',
    minWidth: '34px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tableWrap: { border: '1px solid var(--color-primary-soft)', borderRadius: '10px', overflowX: 'auto', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '920px' },
  th: { textAlign: 'left', padding: '6px 7px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.25, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', minHeight: '38px', height: 'auto' },
  td: { padding: '6px 7px', borderBottom: '1px solid #eef2f7', fontSize: '10px', color: '#334155', fontWeight: 600, verticalAlign: 'top', lineHeight: 1.25 },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 7px', fontSize: '10px', fontWeight: 700 },
  footer: { margin: 0, fontSize: '12px', color: '#475569', fontWeight: 700 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 90, padding: '16px' },
  modal: { width: 'min(620px, 100%)', background: '#fff', borderRadius: '14px', border: '1px solid rgba(159, 23, 77, 0.2)', padding: '14px', display: 'grid', gap: '10px' },
  modalStack: { display: 'grid', gap: '10px' },
  modalActions: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  modalActionButton: { minHeight: '32px', padding: '0 10px', fontSize: '11px' },
  modalFrame: { width: '100%', height: '72vh', border: '1px solid #D1D5DB', borderRadius: '10px', background: '#fff' },
  modalCard: { width: 'min(980px, 100%)', background: '#fff', borderRadius: '14px', border: '1px solid rgba(159, 23, 77, 0.2)', padding: '14px', display: 'grid', gap: '10px' },
  chartRow: { display: 'grid', gap: '7px' },
  chartBarWrap: { height: '10px', borderRadius: '999px', background: 'var(--color-border)', overflow: 'hidden' },
  chartBar: { height: '100%', background: 'var(--color-primary)' },
  compactGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(240px, 0.85fr)', gap: '10px', alignItems: 'start' },
  miniStack: { display: 'grid', gap: '8px' },
  miniCard: { border: '1px solid rgba(159, 23, 77, 0.16)', borderRadius: '12px', background: '#fff', padding: '10px' },
  miniCardLabel: { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  miniCardValue: { margin: '4px 0 0 0', fontSize: '16px', color: '#0f172a', fontWeight: 800 },
  employeeChecklist: { display: 'grid', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' },
  employeeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 10px', background: '#fff' },
  employeeMeta: { display: 'grid', gap: '2px', minWidth: 0 },
  employeeName: { margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  employeeSub: { margin: 0, fontSize: '10px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  pillButton: {
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '8px',
    minHeight: '30px',
    padding: '0 10px',
    fontSize: '10px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  historyCardList: { display: 'grid', gap: '10px' },
  historyCard: { border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff', padding: '12px', display: 'grid', gap: '10px' },
  historyHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' },
  historyTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' },
  historySub: { margin: '2px 0 0 0', fontSize: '11px', fontWeight: 700, color: '#64748b' },
  historyMetaGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  historyMetric: { border: '1px solid #eef2f7', borderRadius: '10px', padding: '8px 10px', background: '#f8fafc' },
  historyMetricLabel: { margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  historyMetricValue: { margin: '3px 0 0 0', fontSize: '12px', fontWeight: 800, color: '#0f172a' },
  historyActionWrap: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' },
  historyActionButton: {
    minHeight: '30px',
    padding: '0 8px',
    width: '100%',
    justifyContent: 'center',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  slipCardList: { display: 'grid', gap: '10px' },
  slipCard: { border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff', padding: '12px', display: 'grid', gap: '10px' },
  slipCardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' },
  slipCardTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' },
  slipCardSub: { margin: '2px 0 0 0', fontSize: '11px', fontWeight: 700, color: '#64748b' },
  slipMetricGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  slipMetric: { border: '1px solid #eef2f7', borderRadius: '10px', padding: '8px 10px', background: '#f8fafc' },
  slipMetricLabel: { margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  slipMetricValue: { margin: '3px 0 0 0', fontSize: '12px', fontWeight: 800, color: '#0f172a' },
  slipActionWrap: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' },
  slipActionButton: {
    minHeight: '30px',
    padding: '0 8px',
    width: '100%',
    justifyContent: 'center',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  dashboardCardList: { display: 'grid', gap: '10px' },
  dashboardCardRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  dashboardCard: { border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '12px', padding: '11px', background: '#fff' },
  dashboardCardLabel: { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dashboardCardValue: { margin: '6px 0 0 0', fontSize: '17px', color: '#0f172a', fontWeight: 800, lineHeight: 1.2 },
  dashboardChartStack: { display: 'grid', gap: '10px' },
  dashboardChartCard: { border: '1px solid rgba(159, 23, 77, 0.16)', borderRadius: '12px', background: '#fff', padding: '12px' },
  dashboardChartCardMobile: { border: '1px solid rgba(159, 23, 77, 0.16)', borderRadius: '12px', background: '#fff', padding: '10px' },
  dashboardChartLabel: { margin: 0, fontSize: '11px', color: '#334155', fontWeight: 700 },
  dashboardChartLabelMobile: { margin: 0, fontSize: '10px', color: '#334155', fontWeight: 700 },
  chartBarWrapMobile: { height: '8px', borderRadius: '999px', background: 'var(--color-border)', overflow: 'hidden' },
  dashboardChartStackCompact: { display: 'grid', gap: '8px' }
  ,
  filterPanel: { display: 'grid', gap: '10px' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', alignItems: 'end' },
  filterActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' },
  filterCard: { display: 'grid', gap: '5px' },
  filterBadge: {
    minHeight: '34px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    padding: '7px 9px',
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: 700
  },
  filterButton: { minHeight: '34px', padding: '0 12px', fontSize: '11px' }
  ,
  setupSection: { display: 'grid', gap: '8px' },
  setupSectionTitle: { margin: '2px 0 0 0', fontSize: '12px', fontWeight: 800, color: '#0f172a' },
  setupHint: { margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.45 },
  setupActionRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  setupButton: { minHeight: '32px', padding: '0 10px', fontSize: '11px' },
  setupTableWrap: { border: '1px solid var(--color-primary-soft)', borderRadius: '10px', overflowX: 'auto', background: '#fff', marginTop: '2px' }
};

const salaryFormDefaults = {
  employeeId: '',
  effectiveDate: new Date().toISOString().slice(0, 10),
  salaryType: 'monthly',
  basicSalary: '',
  dailyRate: '',
  hourlyRate: '',
  overtimeRate: '',
  hra: '',
  conveyance: '',
  mobile: '',
  bonus: '',
  incentive: '',
  otherAllowance: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  upiId: '',
  pan: '',
  aadhaar: '',
  joiningDate: '',
  leaveDeduction: '',
  lateDeduction: '',
  latePerMark: '',
  advanceDeduction: '',
  loanDeduction: '',
  pf: '',
  esi: '',
  otherDeduction: '',
  notes: ''
};

const readPayrollDashboardCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PAYROLL_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mergePayrollDashboardCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readPayrollDashboardCache() || {};
    window.sessionStorage.setItem(PAYROLL_DASHBOARD_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Cache is best effort only.
  }
};

export default function PayrollModule() {
  const role = useMemo(() => roleFlags(), []);
  const [cachedDashboard] = useState(() => readPayrollDashboardCache());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  const [employees, setEmployees] = useState(() => Array.isArray(cachedDashboard?.employees) ? cachedDashboard.employees : []);
  const [salaryStructures, setSalaryStructures] = useState(() => Array.isArray(cachedDashboard?.salaryStructures) ? cachedDashboard.salaryStructures : []);
  const [holidays, setHolidays] = useState(() => Array.isArray(cachedDashboard?.holidays) ? cachedDashboard.holidays : []);
  const [advances, setAdvances] = useState(() => Array.isArray(cachedDashboard?.advances) ? cachedDashboard.advances : []);
  const [dashboard, setDashboard] = useState(() => cachedDashboard?.dashboard || null);
  const [payrollItems, setPayrollItems] = useState(() => Array.isArray(cachedDashboard?.payrollItems) ? cachedDashboard.payrollItems : []);
  const [meta, setMeta] = useState(() => cachedDashboard?.meta || { config: { weeklyOffDay: 0, lateMarkGraceMinutes: 15, workStartTime: '09:00' } });

  const [filters, setFilters] = useState({ employeeId: '', department: '', paymentStatus: '', payrollStatus: '', search: '' });
  const [salaryForm, setSalaryForm] = useState(salaryFormDefaults);
  const [holidayForm, setHolidayForm] = useState({ date: '', title: '', type: 'paid', notes: '' });
  const [advanceForm, setAdvanceForm] = useState({ employeeId: '', amount: '', monthlyDeduction: '', deductionMode: 'partial', reason: '', issuedDate: new Date().toISOString().slice(0, 10) });
  const [selectedGenerateEmployees, setSelectedGenerateEmployees] = useState([]);
  const [paymentModal, setPaymentModal] = useState({ open: false, item: null, paymentMode: 'Bank transfer', paymentDate: new Date().toISOString().slice(0, 10), transactionRef: '', remarks: '' });
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null, manualAdjustmentAmount: '', manualAdjustmentReason: '', manualOverrideEnabled: false, overrideNetSalary: '', payrollStatus: 'Generated' });
  const [slipViewer, setSlipViewer] = useState({ open: false, url: '', title: '', item: null });
  const [page, setPage] = useState(1);
  const [screenWidth, setScreenWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  const reloadRef = useRef(null);

  const pageSize = 10;
  const canResizeDesktopTables = screenWidth >= 960;
  const {
    getColumnWidth: getHistoryColumnWidth,
    startResize: startHistoryResize,
    resetColumns: resetHistoryColumns
  } = useColumnResize({
    storageKey: 'payroll_history_column_widths',
    columns: payrollHistoryColumns.map((column) => column.key),
    defaultColumnWidths: payrollHistoryDefaultWidths,
    columnBounds: payrollHistoryColumnBounds,
    minWidth: 96,
  });
  const {
    getColumnWidth: getSlipColumnWidth,
    startResize: startSlipResize,
    resetColumns: resetSlipColumns
  } = useColumnResize({
    storageKey: 'payroll_slip_column_widths',
    columns: payrollSlipColumns.map((column) => column.key),
    defaultColumnWidths: payrollSlipDefaultWidths,
    columnBounds: payrollSlipColumnBounds,
    minWidth: 96,
  });
  const historyTableMinWidth = payrollHistoryColumns.reduce((sum, column) => sum + (getHistoryColumnWidth(column.key) || payrollHistoryDefaultWidths[column.key] || 96), 0);
  const slipTableMinWidth = payrollSlipColumns.reduce((sum, column) => sum + (getSlipColumnWidth(column.key) || payrollSlipDefaultWidths[column.key] || 96), 0);
  const historyTableStyle = { ...shell.payrollTable, minWidth: `${Math.max(1280, historyTableMinWidth)}px` };
  const slipTableStyle = { ...shell.payrollTable, minWidth: `${Math.max(960, slipTableMinWidth)}px` };
  const historyHeadCellStyle = (key, align = 'left') => ({
    ...shell.th,
    position: 'relative',
    width: `${getHistoryColumnWidth(key)}px`,
    minWidth: `${getHistoryColumnWidth(key)}px`,
    maxWidth: `${getHistoryColumnWidth(key)}px`,
    textAlign: align
  });
  const historyBodyCellStyle = (key, align = 'left') => ({
    ...shell.td,
    width: `${getHistoryColumnWidth(key)}px`,
    minWidth: `${getHistoryColumnWidth(key)}px`,
    maxWidth: `${getHistoryColumnWidth(key)}px`,
    textAlign: align
  });
  const slipHeadCellStyle = (key, align = 'left') => ({
    ...shell.th,
    position: 'relative',
    width: `${getSlipColumnWidth(key)}px`,
    minWidth: `${getSlipColumnWidth(key)}px`,
    maxWidth: `${getSlipColumnWidth(key)}px`,
    textAlign: align
  });
  const slipBodyCellStyle = (key, align = 'left') => ({
    ...shell.td,
    width: `${getSlipColumnWidth(key)}px`,
    minWidth: `${getSlipColumnWidth(key)}px`,
    maxWidth: `${getSlipColumnWidth(key)}px`,
    textAlign: align
  });
  const payrollSetupColumns = [
    { key: 'employee', width: 220 },
    { key: 'effectiveDate', width: 140 },
    { key: 'type', width: 120 },
    { key: 'basic', width: 120 },
    { key: 'allowances', width: 140 },
    { key: 'deductions', width: 140 }
  ];
  const payrollAdvanceColumns = [
    { key: 'employee', width: 220 },
    { key: 'issuedDate', width: 130 },
    { key: 'amount', width: 120 },
    { key: 'recovered', width: 120 },
    { key: 'balance', width: 120 },
    { key: 'monthlyDeduction', width: 140 },
    { key: 'status', width: 120 },
    { key: 'action', width: 110 }
  ];
  const payrollHolidayColumns = [
    { key: 'date', width: 120 },
    { key: 'holiday', width: 220 },
    { key: 'type', width: 120 },
    { key: 'notes', width: 220 },
    { key: 'action', width: 110 }
  ];
  const {
    getColumnWidth: getSetupColumnWidth,
    startResize: startSetupResize,
    resetColumns: resetSetupColumns
  } = useColumnResize({
    storageKey: 'payroll_setup_column_widths',
    columns: payrollSetupColumns.map((column) => column.key),
    defaultColumnWidths: payrollSetupColumns.reduce((acc, column) => ({ ...acc, [column.key]: column.width }), {}),
    columnBounds: {
      employee: { min: 180, max: 320 },
      effectiveDate: { min: 120, max: 160 },
      type: { min: 100, max: 150 },
      basic: { min: 100, max: 160 },
      allowances: { min: 120, max: 200 },
      deductions: { min: 120, max: 200 }
    },
    minWidth: 96,
  });
  const {
    getColumnWidth: getAdvanceColumnWidth,
    startResize: startAdvanceResize,
    resetColumns: resetAdvanceColumns
  } = useColumnResize({
    storageKey: 'payroll_advance_column_widths',
    columns: payrollAdvanceColumns.map((column) => column.key),
    defaultColumnWidths: payrollAdvanceColumns.reduce((acc, column) => ({ ...acc, [column.key]: column.width }), {}),
    columnBounds: {
      employee: { min: 180, max: 320 },
      issuedDate: { min: 110, max: 160 },
      amount: { min: 100, max: 160 },
      recovered: { min: 100, max: 160 },
      balance: { min: 100, max: 160 },
      monthlyDeduction: { min: 120, max: 200 },
      status: { min: 100, max: 150 },
      action: { min: 100, max: 140 }
    },
    minWidth: 96,
  });
  const {
    getColumnWidth: getHolidayColumnWidth,
    startResize: startHolidayResize,
    resetColumns: resetHolidayColumns
  } = useColumnResize({
    storageKey: 'payroll_holiday_column_widths',
    columns: payrollHolidayColumns.map((column) => column.key),
    defaultColumnWidths: payrollHolidayColumns.reduce((acc, column) => ({ ...acc, [column.key]: column.width }), {}),
    columnBounds: {
      date: { min: 100, max: 160 },
      holiday: { min: 180, max: 320 },
      type: { min: 100, max: 150 },
      notes: { min: 160, max: 280 },
      action: { min: 100, max: 140 }
    },
    minWidth: 96,
  });
  const setupTableMinWidth = payrollSetupColumns.reduce((sum, column) => sum + (getSetupColumnWidth(column.key) || column.width), 0);
  const advanceTableMinWidth = payrollAdvanceColumns.reduce((sum, column) => sum + (getAdvanceColumnWidth(column.key) || column.width), 0);
  const holidayTableMinWidth = payrollHolidayColumns.reduce((sum, column) => sum + (getHolidayColumnWidth(column.key) || column.width), 0);
  const cacheMatchesSelection = Boolean(cachedDashboard && String(cachedDashboard.month) === String(month) && String(cachedDashboard.year) === String(year));
  const setupTableStyle = { ...shell.table, minWidth: `${Math.max(920, setupTableMinWidth)}px`, tableLayout: 'fixed' };
  const advanceTableStyle = { ...shell.table, minWidth: `${Math.max(980, advanceTableMinWidth)}px`, tableLayout: 'fixed' };
  const holidayTableStyle = { ...shell.table, minWidth: `${Math.max(760, holidayTableMinWidth)}px`, tableLayout: 'fixed' };
  const setupHeadCellStyle = (key, align = 'left') => {
    const width = getSetupColumnWidth(key);
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const setupBodyCellStyle = (key, align = 'left') => {
    const width = getSetupColumnWidth(key);
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const advanceHeadCellStyle = (key, align = 'left') => {
    const width = getAdvanceColumnWidth(key);
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const advanceBodyCellStyle = (key, align = 'left') => {
    const width = getAdvanceColumnWidth(key);
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const holidayHeadCellStyle = (key, align = 'left') => {
    const width = getHolidayColumnWidth(key);
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const holidayBodyCellStyle = (key, align = 'left') => {
    const width = getHolidayColumnWidth(key);
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const headers = useMemo(() => buildPortalAuthHeaders(), []);

  const reloadAll = async (options = {}) => {
    if (reloadRef.current) {
      if (options.force) {
        await reloadRef.current;
      } else {
        return reloadRef.current;
      }
    }
    const request = (async () => {
      try {
        if (!options.silent) setBusy(true);
        const [empRes, metaRes, structureRes, holidayRes, advanceRes, dashboardRes, payrollRes, payrollAllRes] = await Promise.all([
          axios.get(`${API_BASE}/api/employees`),
          axios.get(`${API_BASE}/api/payroll/meta`, { headers }),
          axios.get(`${API_BASE}/api/payroll/salary-structures`, { headers }),
          axios.get(`${API_BASE}/api/payroll/holidays`, { params: { month, year }, headers }),
          axios.get(`${API_BASE}/api/payroll/advances`, { headers }),
          axios.get(`${API_BASE}/api/payroll/dashboard`, { params: { month, year }, headers }),
          axios.get(`${API_BASE}/api/payroll/items`, { params: { month, year }, headers }),
          axios.get(`${API_BASE}/api/payroll/items`, { headers })
        ]);
        const rawEmployees = Array.isArray(empRes.data) ? empRes.data : [];
        const normalizedEmployees = rawEmployees
          .map((entry) => {
            const employeeId = getEmployeeKey(entry);
            if (!employeeId) return null;
            return {
              ...entry,
              _id: employeeId,
              empCode: String(entry?.empCode || entry?.employeeCode || employeeId).trim()
            };
          })
          .filter(Boolean);
        const nextMeta = metaRes.data || {};
        const nextSalaryStructures = Array.isArray(structureRes.data) ? structureRes.data : [];
        const nextHolidays = Array.isArray(holidayRes.data) ? holidayRes.data : [];
        const nextAdvances = Array.isArray(advanceRes.data) ? advanceRes.data : [];
        const nextDashboard = dashboardRes.data || null;
        const scopedItems = Array.isArray(payrollRes.data) ? payrollRes.data : [];
        const allItems = Array.isArray(payrollAllRes.data) ? payrollAllRes.data : [];

        setEmployees(normalizedEmployees);
        setMeta(nextMeta);
        setSalaryStructures(nextSalaryStructures);
        setHolidays(nextHolidays);
        setAdvances(nextAdvances);
        setDashboard(nextDashboard);
        setPayrollItems(scopedItems);
        if (scopedItems.length === 0 && allItems.length > 0) {
          setStatus('No payroll rows found for selected month. You can generate payroll for this month.');
        } else {
          setStatus('');
        }

        mergePayrollDashboardCache({
          month,
          year,
          employees: normalizedEmployees,
          meta: nextMeta,
          salaryStructures: nextSalaryStructures,
          holidays: nextHolidays,
          advances: nextAdvances,
          dashboard: nextDashboard,
          payrollItems: scopedItems
        });
      } catch (error) {
        console.error('Payroll fetch failed', error);
        setStatus(error?.response?.data?.error || 'Unable to load payroll module right now.');
      } finally {
        if (!options.silent) setBusy(false);
      }
    })();
    reloadRef.current = request;
    try {
      return await request;
    } finally {
      if (reloadRef.current === request) reloadRef.current = null;
    }
  };

  useEffect(() => {
    reloadAll({ silent: cacheMatchesSelection });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, cacheMatchesSelection]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useAutoRefresh(() => reloadAll({ silent: true }), { enabled: !paymentModal.open && !adjustModal.open && !slipViewer.open });

  const employeeMap = useMemo(() => {
    const next = new Map();
    employees.forEach((entry) => {
      [
        entry?._id,
        entry?.id,
        entry?.external_id,
        entry?.empCode,
        entry?.employeeCode
      ].forEach((key) => {
        const safeKey = String(key || '').trim();
        if (safeKey) next.set(safeKey, entry);
      });
    });
    return next;
  }, [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((entry) => String(entry.role || '').trim()).filter(Boolean))), [employees]);
  const getSalaryStructureEmployeeLabel = (entry = {}) => {
    const matchedEmployee = employeeMap.get(String(entry.employeeId || '').trim());
    if (matchedEmployee) {
      return `${getEmployeeDisplayName(matchedEmployee)} (${matchedEmployee.empCode || '-'})`;
    }
    const storedName = String(
      entry.employeeName
      || entry.employee_name
      || entry.name
      || ''
    ).trim();
    const storedCode = String(
      entry.employeeCode
      || entry.employee_code
      || entry.empCode
      || ''
    ).trim();
    if (storedName && storedCode) return `${storedName} (${storedCode})`;
    if (storedName) return storedName;
    if (storedCode) return storedCode;
    return String(entry.employeeId || '-');
  };
  const getLatestSalaryStructure = (employeeId) => {
    const list = salaryStructures.filter((entry) => String(entry.employeeId || '') === String(employeeId || ''));
    if (list.length === 0) return null;
    return [...list].sort((a, b) => String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || ''))).pop();
  };

  const getEmployeeMasterSalary = (employeeId) => {
    const employee = employeeMap.get(String(employeeId || ''));
    const currentSalary = Number(employee?.salaryPerMonth ?? employee?.salary ?? 0);
    return currentSalary > 0 ? currentSalary : null;
  };

  const latestSalaryStructureIdByEmployee = useMemo(() => {
    const latestByEmployee = new Map();
    salaryStructures.forEach((entry) => {
      const employeeId = String(entry.employeeId || '');
      if (!employeeId) return;
      const currentLatest = latestByEmployee.get(employeeId);
      if (!currentLatest || String(entry.effectiveDate || '') >= String(currentLatest.effectiveDate || '')) {
        latestByEmployee.set(employeeId, entry);
      }
    });
    const idMap = new Map();
    latestByEmployee.forEach((entry, employeeId) => {
      idMap.set(employeeId, String(entry._id || ''));
    });
    return idMap;
  }, [salaryStructures]);

  const getVisibleSalaryStructureAmount = (entry = {}) => {
    const employeeId = String(entry.employeeId || '');
    const currentSalary = getEmployeeMasterSalary(employeeId);
    const latestStructureId = latestSalaryStructureIdByEmployee.get(employeeId);
    if (currentSalary !== null && latestStructureId && latestStructureId === String(entry._id || '')) {
      return currentSalary;
    }
    return Number(entry.basicSalary || 0);
  };

  const loadEmployeeToSalaryForm = (employeeId) => {
    const employee = employeeMap.get(String(employeeId || ''));
    const latest = getLatestSalaryStructure(employeeId);
    const employeeMasterSalary = getEmployeeMasterSalary(employeeId);
    if (!employeeId) {
      setSalaryForm(salaryFormDefaults);
      return;
    }
    if (latest) {
      setSalaryForm({
        employeeId: String(employeeId),
        effectiveDate: latest.effectiveDate || new Date().toISOString().slice(0, 10),
        salaryType: latest.salaryType || 'monthly',
        basicSalary: String(employeeMasterSalary ?? latest.basicSalary ?? ''),
        dailyRate: String(latest.dailyRate ?? ''),
        hourlyRate: String(latest.hourlyRate ?? ''),
        overtimeRate: String(latest.overtimeRate ?? ''),
        hra: String(latest.allowances?.hra ?? ''),
        conveyance: String(latest.allowances?.conveyance ?? ''),
        mobile: String(latest.allowances?.mobile ?? ''),
        bonus: String(latest.allowances?.bonus ?? ''),
        incentive: String(latest.allowances?.incentive ?? ''),
        otherAllowance: String(latest.allowances?.other ?? ''),
        bankName: String(latest.bankName ?? ''),
        accountNumber: String(latest.accountNumber ?? ''),
        ifsc: String(latest.ifsc ?? ''),
        upiId: String(latest.upiId ?? ''),
        pan: String(latest.pan ?? ''),
        aadhaar: String(latest.aadhaar ?? ''),
        joiningDate: String(latest.joiningDate ?? ''),
        leaveDeduction: String(latest.deductions?.leave ?? ''),
        lateDeduction: String(latest.deductions?.late ?? ''),
        latePerMark: String(latest.deductions?.latePerMark ?? ''),
        advanceDeduction: String(latest.deductions?.advance ?? ''),
        loanDeduction: String(latest.deductions?.loan ?? ''),
        pf: String(latest.deductions?.pf ?? ''),
        esi: String(latest.deductions?.esi ?? ''),
        otherDeduction: String(latest.deductions?.other ?? ''),
        notes: latest.notes || ''
      });
      return;
    }
    setSalaryForm({
      ...salaryFormDefaults,
      employeeId: String(employeeId),
      basicSalary: String(employeeMasterSalary ?? employee?.salaryPerMonth ?? employee?.salary ?? ''),
      notes: 'Loaded from Employee Master'
    });
  };

  const filteredPayrollItems = useMemo(() => {
    const search = String(filters.search || '').trim().toLowerCase();
    return payrollItems.filter((entry) => {
      if (filters.employeeId && String(entry.employeeId || '') !== filters.employeeId) return false;
      if (filters.department && String(entry.department || '').toLowerCase() !== filters.department.toLowerCase()) return false;
      if (filters.paymentStatus && String(entry.paymentStatus || '').toLowerCase() !== filters.paymentStatus.toLowerCase()) return false;
      if (filters.payrollStatus && String(entry.payrollStatus || '').toLowerCase() !== filters.payrollStatus.toLowerCase()) return false;
      if (search) {
        const joined = `${entry.employeeName || ''} ${entry.employeeCode || ''}`.toLowerCase();
        if (!joined.includes(search)) return false;
      }
      if (role.canViewOwn) {
        const loggedEmployeeId = String(getPortalUserId() || '').trim();
        if (loggedEmployeeId && String(entry.employeeId || '') !== loggedEmployeeId) return false;
      }
      return true;
    });
  }, [payrollItems, filters, role.canViewOwn]);

  const totalPages = Math.max(1, Math.ceil(filteredPayrollItems.length / pageSize));
  const pagedPayrollItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPayrollItems.slice(start, start + pageSize);
  }, [filteredPayrollItems, page]);
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages]);

  const saveSalaryStructure = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can manage salary structures.');
      if (!salaryForm.employeeId) return window.alert('Select employee.');
      const payload = {
        employeeId: salaryForm.employeeId,
        effectiveDate: salaryForm.effectiveDate,
        salaryType: salaryForm.salaryType,
        basicSalary: Number(salaryForm.basicSalary || 0),
        dailyRate: Number(salaryForm.dailyRate || 0),
        hourlyRate: Number(salaryForm.hourlyRate || 0),
        overtimeRate: Number(salaryForm.overtimeRate || 0),
        bankName: salaryForm.bankName,
        accountNumber: salaryForm.accountNumber,
        ifsc: salaryForm.ifsc,
        upiId: salaryForm.upiId,
        pan: salaryForm.pan,
        aadhaar: salaryForm.aadhaar,
        joiningDate: salaryForm.joiningDate,
        allowances: {
          hra: Number(salaryForm.hra || 0),
          conveyance: Number(salaryForm.conveyance || 0),
          mobile: Number(salaryForm.mobile || 0),
          bonus: Number(salaryForm.bonus || 0),
          incentive: Number(salaryForm.incentive || 0),
          other: Number(salaryForm.otherAllowance || 0)
        },
        deductions: {
          leave: Number(salaryForm.leaveDeduction || 0),
          late: Number(salaryForm.lateDeduction || 0),
          latePerMark: Number(salaryForm.latePerMark || 0),
          advance: Number(salaryForm.advanceDeduction || 0),
          loan: Number(salaryForm.loanDeduction || 0),
          pf: Number(salaryForm.pf || 0),
          esi: Number(salaryForm.esi || 0),
          other: Number(salaryForm.otherDeduction || 0)
        },
        notes: salaryForm.notes
      };
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/salary-structures`, payload, { headers });
      setStatus('Salary structure saved.');
      setSalaryForm(salaryFormDefaults);
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Salary save failed', error);
      window.alert(error?.response?.data?.error || 'Failed to save salary structure.');
    } finally {
      setBusy(false);
    }
  };

  const syncEmployeeMasterSalary = async (updateExisting = false) => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can sync Employee Master.');
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/payroll/salary-structures/sync-employees`, { updateExisting }, { headers });
      setStatus(`${res?.data?.message || 'Sync complete'} (Created: ${res?.data?.createdCount || 0}, Updated: ${res?.data?.updatedCount || 0})`);
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Employee master sync failed', error);
      window.alert(error?.response?.data?.error || 'Unable to sync Employee Master data.');
    } finally {
      setBusy(false);
    }
  };

  const generatePayroll = async (forceRegenerate = false) => {
    try {
      if (!role.canGenerate) return window.alert('Only Admin/HR can generate payroll.');
      setBusy(true);
      setStatus('');
      const res = await axios.post(`${API_BASE}/api/payroll/generate`, {
        month,
        year,
        employeeIds: selectedGenerateEmployees,
        forceRegenerate
      }, { headers });
      const generatedCount = Array.isArray(res?.data?.generated) ? res.data.generated.length : Number(res?.data?.run?.generatedCount || 0);
      const skippedRows = Array.isArray(res?.data?.skipped) ? res.data.skipped : [];
      const skippedCount = skippedRows.length;
      const skippedText = skippedCount > 0
        ? `\nSkipped (${skippedCount}): ${skippedRows.map((entry) => `${entry.employeeId || 'Unknown'} - ${entry.reason || 'Skipped'}`).join('; ')}`
        : '';
      const baseText = forceRegenerate ? 'Payroll regenerated.' : 'Payroll generated.';
      setStatus(`${baseText} Generated: ${generatedCount}.${skippedText}`);
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Payroll generate failed', error);
      const message = error?.response?.data?.error || 'Unable to generate payroll.';
      setStatus(message);
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const saveHoliday = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can manage holidays.');
      if (!holidayForm.date || !holidayForm.title) return window.alert('Date and holiday title are required.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/holidays`, holidayForm, { headers });
      setHolidayForm({ date: '', title: '', type: 'paid', notes: '' });
      setStatus('Holiday saved.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Holiday save failed', error);
      window.alert(error?.response?.data?.error || 'Unable to save holiday.');
    } finally {
      setBusy(false);
    }
  };

  const removeHoliday = async (id) => {
    if (!role.canManage) return;
    if (!window.confirm('Delete this holiday?')) return;
    try {
      setBusy(true);
      await axios.delete(`${API_BASE}/api/payroll/holidays/${id}`, { headers });
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Holiday delete failed', error);
      window.alert(error?.response?.data?.error || 'Unable to delete holiday.');
    } finally {
      setBusy(false);
    }
  };

  const saveAdvance = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can manage advance salary.');
      if (!advanceForm.employeeId || Number(advanceForm.amount || 0) <= 0) return window.alert('Employee and valid amount are required.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/advances`, {
        employeeId: advanceForm.employeeId,
        amount: Number(advanceForm.amount || 0),
        monthlyDeduction: Number(advanceForm.monthlyDeduction || 0),
        deductionMode: advanceForm.deductionMode,
        reason: advanceForm.reason,
        issuedDate: advanceForm.issuedDate
      }, { headers });
      setAdvanceForm({ employeeId: '', amount: '', monthlyDeduction: '', deductionMode: 'partial', reason: '', issuedDate: new Date().toISOString().slice(0, 10) });
      setStatus('Advance saved.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Advance save failed', error);
      window.alert(error?.response?.data?.error || 'Unable to save advance.');
    } finally {
      setBusy(false);
    }
  };

  const removeAdvance = async (id) => {
    if (!role.canManage) return;
    if (!window.confirm('Delete this advance record?')) return;
    try {
      setBusy(true);
      const safeId = encodeURIComponent(String(id || '').trim());
      try {
        await axios.delete(`${API_BASE}/api/payroll/advances/${safeId}`, { headers });
      } catch (primaryError) {
        const code = primaryError?.response?.status;
        if (code === 404 || code === 405 || code === 501) {
          try {
            await axios.post(`${API_BASE}/api/payroll/advances/${safeId}/delete`, {}, { headers });
          } catch (_fallbackError) {
            await axios.post(`${API_BASE}/api/payroll/advances/delete`, { id }, { headers });
          }
        } else {
          throw primaryError;
        }
      }
      setStatus('Advance record deleted.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Advance delete failed', error);
      const isNetwork = error?.message && String(error.message).toLowerCase().includes('network');
      const message = error?.response?.data?.error
        || (isNetwork ? 'Unable to reach backend server. Please restart backend and try again.' : 'Unable to delete advance record.');
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const openPayment = (item) => {
    setPaymentModal({
      open: true,
      item,
      paymentMode: 'Bank transfer',
      paymentDate: new Date().toISOString().slice(0, 10),
      transactionRef: '',
      remarks: ''
    });
  };

  const markPaid = async () => {
    try {
      if (!role.canMarkPaid) return window.alert('Only Admin/Accountant can mark salary as paid.');
      if (!paymentModal.item) return;
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/items/${paymentModal.item._id}/mark-paid`, {
        paymentMode: paymentModal.paymentMode,
        paymentDate: paymentModal.paymentDate,
        transactionRef: paymentModal.transactionRef,
        remarks: paymentModal.remarks
      }, { headers });
      setPaymentModal((prev) => ({ ...prev, open: false, item: null }));
      setStatus('Salary marked as paid.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Mark paid failed', error);
      window.alert(error?.response?.data?.error || 'Unable to mark as paid.');
    } finally {
      setBusy(false);
    }
  };

  const openAdjust = (item) => {
    setAdjustModal({
      open: true,
      item,
      manualAdjustmentAmount: String(item.manualAdjustmentAmount || 0),
      manualAdjustmentReason: item.manualAdjustmentReason || '',
      manualOverrideEnabled: !!item.manualOverrideEnabled,
      overrideNetSalary: item.overrideNetSalary != null ? String(item.overrideNetSalary) : '',
      payrollStatus: item.payrollStatus || 'Generated'
    });
  };

  const saveAdjustment = async () => {
    try {
      if (!role.canManage && !role.canGenerate) return window.alert('No permission for salary adjustment.');
      if (!adjustModal.item) return;
      setBusy(true);
      await axios.put(`${API_BASE}/api/payroll/items/${adjustModal.item._id}`, {
        manualAdjustmentAmount: Number(adjustModal.manualAdjustmentAmount || 0),
        manualAdjustmentReason: adjustModal.manualAdjustmentReason,
        manualOverrideEnabled: adjustModal.manualOverrideEnabled,
        overrideNetSalary: Number(adjustModal.overrideNetSalary || 0),
        payrollStatus: adjustModal.payrollStatus
      }, { headers });
      setAdjustModal((prev) => ({ ...prev, open: false, item: null }));
      setStatus('Payroll item updated.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Adjustment update failed', error);
      window.alert(error?.response?.data?.error || 'Unable to update payroll item.');
    } finally {
      setBusy(false);
    }
  };

  const deletePayrollItem = async (item) => {
    if (!role.canManage && !role.canGenerate) return window.alert('Only Admin/HR can delete payroll rows.');
    if (!item?._id) return;
    if (!window.confirm('Delete this payroll row? This cannot be undone.')) return;
    try {
      setBusy(true);
      await axios.delete(`${API_BASE}/api/payroll/items/${encodeURIComponent(String(item._id))}`, { headers });
      setStatus('Payroll row deleted.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Delete payroll row failed', error);
      const payload = error?.response?.data || {};
      const paidDeleteBlocked = payload?.code === 'PAYROLL_ROW_PAID';
      const message = paidDeleteBlocked
        ? 'Paid payroll row cannot be deleted. First unlock/edit the row and change status from Paid, then delete.'
        : (payload?.error || 'Unable to delete payroll row.');
      setStatus(message);
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const unlockPayrollItem = async (item) => {
    if (!role.canManage && !role.canGenerate) return window.alert('Only Admin/HR can unlock payroll rows.');
    if (!item?._id) return;
    if (!window.confirm('Unlock this paid row and move it back to Generated/Pending?')) return;
    try {
      setBusy(true);
      await axios.put(`${API_BASE}/api/payroll/items/${item._id}`, {
        unlock: true,
        payrollStatus: 'Generated',
        paymentStatus: 'Pending'
      }, { headers });
      setStatus('Payroll row unlocked. You can now edit or delete it.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Unlock payroll row failed', error);
      const message = error?.response?.data?.error || 'Unable to unlock payroll row.';
      setStatus(message);
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const openSlipViewer = (item) => {
    const userRole = encodeURIComponent(getPortalUserRole() || 'Admin');
    const userId = encodeURIComponent(getPortalUserId() || '');
    const userName = encodeURIComponent(getPortalUserName() || 'System');
    const url = `${API_BASE}/api/payroll/items/${item._id}/slip/pdf?role=${userRole}&userId=${userId}&userName=${userName}&_ts=${Date.now()}`;
    setSlipViewer({
      open: true,
      url,
      item,
      title: `${item.employeeName} - ${monthOptions.find((entry) => entry.value === Number(item.month))?.label || item.month} ${item.year}`
    });
  };

  const shareSlip = async (channel) => {
    try {
      if (!slipViewer.item) return;
      const employee = employeeMap.get(String(slipViewer.item.employeeId || ''));
      if (channel === 'email') {
        const toDefault = String(employee?.emailId || employee?.email || '').trim();
        const to = window.prompt('Recipient email', toDefault);
        if (!to) return;
        setBusy(true);
        const res = await axios.post(`${API_BASE}/api/payroll/items/${slipViewer.item._id}/share-email`, { to }, { headers });
        setStatus(res?.data?.message || 'Salary slip email queued.');
      } else {
        const phoneDefault = String(employee?.mobile || '').trim();
        const phoneNumber = window.prompt('Recipient WhatsApp number', phoneDefault);
        if (!phoneNumber) return;
        setBusy(true);
        const res = await axios.post(`${API_BASE}/api/payroll/items/${slipViewer.item._id}/share-whatsapp`, { phoneNumber }, { headers });
        setStatus(res?.data?.message || 'Salary slip sent on WhatsApp.');
      }
    } catch (error) {
      console.error('Salary slip share failed', error);
      window.alert(error?.response?.data?.error || 'Unable to share salary slip.');
    } finally {
      setBusy(false);
    }
  };

  const sendSlipForItem = async (item, channel) => {
    const employee = employeeMap.get(String(item?.employeeId || ''));
    const userRole = encodeURIComponent(getPortalUserRole() || 'Admin');
    const userId = encodeURIComponent(getPortalUserId() || '');
    const userName = encodeURIComponent(getPortalUserName() || 'System');
    if (channel === 'email') {
      const toDefault = String(employee?.emailId || employee?.email || '').trim();
      const to = window.prompt('Recipient email', toDefault);
      if (!to) return;
      setBusy(true);
      try {
        const res = await axios.post(`${API_BASE}/api/payroll/items/${item._id}/share-email`, { to }, { headers });
        setStatus(res?.data?.message || 'Salary slip email queued.');
      } finally {
        setBusy(false);
      }
      return;
    }
    const phoneDefault = String(employee?.mobile || '').trim();
    const phoneNumber = window.prompt('Recipient WhatsApp number', phoneDefault);
    if (!phoneNumber) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE}/api/payroll/items/${item._id}/share-whatsapp`, { phoneNumber }, { headers });
      setStatus(res?.data?.message || 'Salary slip sent on WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  const seedData = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can seed sample data.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/seed-sample`, {}, { headers });
      setStatus('Payroll seed data created.');
      await reloadAll({ force: true });
    } catch (error) {
      console.error('Seed failed', error);
      window.alert(error?.response?.data?.error || 'Unable to seed payroll data.');
    } finally {
      setBusy(false);
    }
  };

  const exportReport = (type, format = 'json') => {
    const url = `${API_BASE}/api/payroll/reports?type=${encodeURIComponent(type)}&month=${month}&year=${year}&format=${format}`;
    window.open(url, '_blank');
  };

  const renderPayrollHistoryActions = (entry, compact = false) => {
    const actionButtonStyle = compact
      ? { ...shell.btnLight, ...shell.historyActionButton }
      : { ...shell.btnLight, ...shell.payrollActionButton };
    const editButtonStyle = compact
      ? { ...shell.btnLight, ...shell.historyActionButton, minWidth: 0 }
      : { ...shell.btnLight, ...shell.payrollIconButton };
    const paidButtonStyle = compact
      ? { ...shell.btn, ...shell.historyActionButton }
      : { ...shell.btn, ...shell.payrollActionButton };
    const actionWrapStyle = compact ? shell.historyActionWrap : shell.payrollActionGroup;
    return (
      <div style={actionWrapStyle}>
        <button type="button" style={actionButtonStyle} onClick={() => openSlipViewer(entry)}>Slip</button>
        {(entry.payrollStatus === 'Paid' || entry.paymentStatus === 'Paid')
          ? <button type="button" style={actionButtonStyle} onClick={() => unlockPayrollItem(entry)} disabled={busy || (!role.canManage && !role.canGenerate)}>Unlock</button>
          : null}
        {entry.payrollStatus !== 'Paid' ? (
          <button
            type="button"
            style={editButtonStyle}
            onClick={() => openAdjust(entry)}
            disabled={busy || (!role.canManage && !role.canGenerate)}
            title="Edit payroll"
            aria-label="Edit payroll"
          >
            <Pencil size={15} />
          </button>
        ) : null}
        {entry.paymentStatus !== 'Paid' ? <button type="button" style={paidButtonStyle} onClick={() => openPayment(entry)} disabled={busy || !role.canMarkPaid}>Paid</button> : null}
        <button
          type="button"
          style={editButtonStyle}
          onClick={() => deletePayrollItem(entry)}
          disabled={busy || (!role.canManage && !role.canGenerate)}
          title="Delete payroll"
          aria-label="Delete payroll"
        >
          <Trash2 size={15} />
        </button>
      </div>
    );
  };

  const renderSlipActions = (entry, compact = false) => {
    const actionButtonStyle = compact
      ? { ...shell.btnLight, ...shell.slipActionButton }
      : { ...shell.btnLight, ...shell.payrollActionButton };
    const wrapStyle = compact ? shell.slipActionWrap : shell.payrollActionGroup;
    return (
      <div style={wrapStyle}>
        <button type="button" style={actionButtonStyle} onClick={() => openSlipViewer(entry)}>View</button>
        <button
          type="button"
          style={actionButtonStyle}
          onClick={() => window.open(`${API_BASE}/api/payroll/items/${entry._id}/slip/pdf?role=${encodeURIComponent(getPortalUserRole() || 'Admin')}&userId=${encodeURIComponent(getPortalUserId() || '')}&userName=${encodeURIComponent(getPortalUserName() || 'System')}&download=1&_ts=${Date.now()}`, '_blank')}
        >
          Download
        </button>
        <button type="button" style={actionButtonStyle} onClick={() => sendSlipForItem(entry, 'email')} disabled={busy}>Email</button>
        <button type="button" style={actionButtonStyle} onClick={() => sendSlipForItem(entry, 'whatsapp')} disabled={busy}>WhatsApp</button>
      </div>
    );
  };

  const getModalStyle = (large = false) => {
    if (screenWidth < 640) {
      return {
        width: '100%',
        maxWidth: '100%',
        borderRadius: '12px',
        padding: '12px'
      };
    }
    return large
      ? shell.modalCard
      : shell.modal;
  };

  const getModalActionStyle = () => ({
    ...shell.modalActions,
    flexDirection: screenWidth < 640 ? 'column' : 'row'
  });

  const renderDashboard = () => (
    screenWidth < 960 ? (
      <div style={shell.dashboardCardList}>
        <div style={{ ...shell.dashboardCardRow, gridTemplateColumns: screenWidth < 560 ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
          <div style={shell.dashboardCard}><p style={shell.dashboardCardLabel}>Total Employees</p><p style={shell.dashboardCardValue}>{dashboard?.cards?.totalEmployees || 0}</p></div>
          <div style={shell.dashboardCard}><p style={shell.dashboardCardLabel}>This Month Payroll</p><p style={shell.dashboardCardValue}>INR {money(dashboard?.cards?.thisMonthPayroll)}</p></div>
          <div style={shell.dashboardCard}><p style={shell.dashboardCardLabel}>Paid Salaries</p><p style={shell.dashboardCardValue}>{dashboard?.cards?.paidSalaries || 0}</p></div>
          <div style={shell.dashboardCard}><p style={shell.dashboardCardLabel}>Pending Salaries</p><p style={shell.dashboardCardValue}>{dashboard?.cards?.pendingSalaries || 0}</p></div>
          <div style={shell.dashboardCard}><p style={shell.dashboardCardLabel}>Advance Salary</p><p style={shell.dashboardCardValue}>INR {money(dashboard?.cards?.advanceSalary)}</p></div>
          <div style={shell.dashboardCard}><p style={shell.dashboardCardLabel}>Total Expense</p><p style={shell.dashboardCardValue}>INR {money(dashboard?.cards?.totalExpense)}</p></div>
        </div>
        <div style={shell.dashboardChartStack}>
          <div style={shell.dashboardChartCardMobile}>
            <p style={{ ...shell.cardLabel, marginBottom: '8px' }}>Monthly Salary Expense</p>
            <div style={screenWidth < 420 ? shell.dashboardChartStackCompact : shell.chartRow}>
              {(dashboard?.monthWiseChart || []).map((entry) => {
                const max = Math.max(...(dashboard?.monthWiseChart || [{ total: 1 }]).map((item) => Number(item.total || 0)), 1);
                const width = `${Math.max(4, (Number(entry.total || 0) / max) * 100)}%`;
                return (
                  <div key={entry.key}>
                    <p style={screenWidth < 420 ? shell.dashboardChartLabelMobile : shell.dashboardChartLabel}>{entry.key} - INR {money(entry.total)}</p>
                    <div style={screenWidth < 420 ? shell.chartBarWrapMobile : shell.chartBarWrap}><div style={{ ...shell.chartBar, width }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={shell.dashboardChartCardMobile}>
            <p style={{ ...shell.cardLabel, marginBottom: '8px' }}>Paid vs Pending</p>
            <div style={screenWidth < 420 ? shell.dashboardChartStackCompact : shell.chartRow}>
              {(dashboard?.paidVsPendingChart || []).map((entry) => {
                const max = Math.max(...(dashboard?.paidVsPendingChart || [{ total: 1 }]).map((item) => Number(item.total || 0)), 1);
                const width = `${Math.max(4, (Number(entry.total || 0) / max) * 100)}%`;
                return (
                  <div key={entry.key}>
                    <p style={screenWidth < 420 ? shell.dashboardChartLabelMobile : shell.dashboardChartLabel}>{entry.key} - INR {money(entry.total)}</p>
                    <div style={screenWidth < 420 ? shell.chartBarWrapMobile : shell.chartBarWrap}><div style={{ ...shell.chartBar, width }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    ) : (
      <>
        <div style={shell.grid}>
          <div style={shell.card}><p style={shell.cardLabel}>Total Employees</p><p style={shell.cardValue}>{dashboard?.cards?.totalEmployees || 0}</p></div>
          <div style={shell.card}><p style={shell.cardLabel}>This Month Payroll</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.thisMonthPayroll)}</p></div>
          <div style={shell.card}><p style={shell.cardLabel}>Paid Salaries</p><p style={shell.cardValue}>{dashboard?.cards?.paidSalaries || 0}</p></div>
          <div style={shell.card}><p style={shell.cardLabel}>Pending Salaries</p><p style={shell.cardValue}>{dashboard?.cards?.pendingSalaries || 0}</p></div>
          <div style={shell.card}><p style={shell.cardLabel}>Advance Salary</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.advanceSalary)}</p></div>
          <div style={shell.card}><p style={shell.cardLabel}>Total Expense</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.totalExpense)}</p></div>
        </div>
        <div style={shell.row}>
          <div style={shell.card}>
            <p style={{ ...shell.cardLabel, marginBottom: '8px' }}>Monthly Salary Expense</p>
            <div style={shell.chartRow}>
              {(dashboard?.monthWiseChart || []).map((entry) => {
                const max = Math.max(...(dashboard?.monthWiseChart || [{ total: 1 }]).map((item) => Number(item.total || 0)), 1);
                const width = `${Math.max(4, (Number(entry.total || 0) / max) * 100)}%`;
                return (
                  <div key={entry.key}>
                    <p style={{ margin: 0, fontSize: '11px', color: '#334155', fontWeight: 700 }}>{entry.key} - INR {money(entry.total)}</p>
                    <div style={shell.chartBarWrap}><div style={{ ...shell.chartBar, width }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={shell.card}>
            <p style={{ ...shell.cardLabel, marginBottom: '8px' }}>Paid vs Pending</p>
            <div style={shell.chartRow}>
              {(dashboard?.paidVsPendingChart || []).map((entry) => {
                const max = Math.max(...(dashboard?.paidVsPendingChart || [{ total: 1 }]).map((item) => Number(item.total || 0)), 1);
                const width = `${Math.max(4, (Number(entry.total || 0) / max) * 100)}%`;
                return (
                  <div key={entry.key}>
                    <p style={{ margin: 0, fontSize: '11px', color: '#334155', fontWeight: 700 }}>{entry.key} - INR {money(entry.total)}</p>
                    <div style={shell.chartBarWrap}><div style={{ ...shell.chartBar, width }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    )
  );

  const renderSalarySetup = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><Landmark size={16} /> Employee Salary Setup</h3>
        <div style={shell.setupSection}>
          <p style={shell.setupSectionTitle}>Core Salary</p>
          <p style={shell.setupHint}>Keep the employee rate and effective date short, then fill the profile below only if needed.</p>
        </div>
        <div style={screenWidth < 720 ? { ...shell.row, gridTemplateColumns: '1fr' } : shell.row}>
          <div style={shell.field}><p style={shell.label}>Employee</p><select style={shell.input} value={salaryForm.employeeId} onChange={(event) => loadEmployeeToSalaryForm(event.target.value)}><option value="">Select employee</option>{employees.map((entry) => <option key={entry._id} value={entry._id}>{[entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.empCode} ({entry.empCode})</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Effective Date</p><input type="date" style={shell.input} value={salaryForm.effectiveDate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, effectiveDate: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Salary Type</p><select style={shell.input} value={salaryForm.salaryType} onChange={(event) => setSalaryForm((prev) => ({ ...prev, salaryType: event.target.value }))}><option value="monthly">Monthly</option><option value="daily">Daily</option><option value="hourly">Hourly</option></select></div>
          <div style={shell.field}><p style={shell.label}>Basic Salary</p><input type="number" style={shell.input} value={salaryForm.basicSalary} onChange={(event) => setSalaryForm((prev) => ({ ...prev, basicSalary: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Daily Rate</p><input type="number" style={shell.input} value={salaryForm.dailyRate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, dailyRate: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Hourly Rate</p><input type="number" style={shell.input} value={salaryForm.hourlyRate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, hourlyRate: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Overtime Rate</p><input type="number" style={shell.input} value={salaryForm.overtimeRate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, overtimeRate: event.target.value }))} /></div>
        </div>
        <div style={shell.setupSection}>
          <p style={shell.setupSectionTitle}>Payroll Profile</p>
          <p style={shell.setupHint}>Bank and identity fields are optional. Add them when the employee is ready for salary slip generation.</p>
        </div>
        <div style={screenWidth < 720 ? { ...shell.row, gridTemplateColumns: '1fr' } : shell.row}>
          <div style={shell.field}><p style={shell.label}>Bank Name</p><input style={shell.input} value={salaryForm.bankName} onChange={(event) => setSalaryForm((prev) => ({ ...prev, bankName: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Account Number</p><input style={shell.input} value={salaryForm.accountNumber} onChange={(event) => setSalaryForm((prev) => ({ ...prev, accountNumber: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>IFSC</p><input style={shell.input} value={salaryForm.ifsc} onChange={(event) => setSalaryForm((prev) => ({ ...prev, ifsc: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>UPI ID</p><input style={shell.input} value={salaryForm.upiId} onChange={(event) => setSalaryForm((prev) => ({ ...prev, upiId: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>PAN</p><input style={shell.input} value={salaryForm.pan} onChange={(event) => setSalaryForm((prev) => ({ ...prev, pan: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Aadhaar</p><input style={shell.input} value={salaryForm.aadhaar} onChange={(event) => setSalaryForm((prev) => ({ ...prev, aadhaar: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Joining Date</p><input type="date" style={shell.input} value={salaryForm.joiningDate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, joiningDate: event.target.value }))} /></div>
        </div>
        <div style={shell.setupSection}>
          <p style={shell.setupSectionTitle}>Allowances</p>
        </div>
        <div style={screenWidth < 720 ? { ...shell.row, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.row}>
          <div style={shell.field}><p style={shell.label}>HRA</p><input type="number" style={shell.input} value={salaryForm.hra} onChange={(event) => setSalaryForm((prev) => ({ ...prev, hra: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Conveyance</p><input type="number" style={shell.input} value={salaryForm.conveyance} onChange={(event) => setSalaryForm((prev) => ({ ...prev, conveyance: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Mobile</p><input type="number" style={shell.input} value={salaryForm.mobile} onChange={(event) => setSalaryForm((prev) => ({ ...prev, mobile: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Bonus</p><input type="number" style={shell.input} value={salaryForm.bonus} onChange={(event) => setSalaryForm((prev) => ({ ...prev, bonus: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Incentive</p><input type="number" style={shell.input} value={salaryForm.incentive} onChange={(event) => setSalaryForm((prev) => ({ ...prev, incentive: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Other Allowance</p><input type="number" style={shell.input} value={salaryForm.otherAllowance} onChange={(event) => setSalaryForm((prev) => ({ ...prev, otherAllowance: event.target.value }))} /></div>
        </div>
        <div style={shell.setupSection}>
          <p style={shell.setupSectionTitle}>Deductions</p>
        </div>
        <div style={screenWidth < 720 ? { ...shell.row, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.row}>
          <div style={shell.field}><p style={shell.label}>Leave Deduction</p><input type="number" style={shell.input} value={salaryForm.leaveDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, leaveDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Late Deduction</p><input type="number" style={shell.input} value={salaryForm.lateDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, lateDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Late Per Mark</p><input type="number" style={shell.input} value={salaryForm.latePerMark} onChange={(event) => setSalaryForm((prev) => ({ ...prev, latePerMark: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Advance Deduction</p><input type="number" style={shell.input} value={salaryForm.advanceDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, advanceDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Loan Deduction</p><input type="number" style={shell.input} value={salaryForm.loanDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, loanDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>PF</p><input type="number" style={shell.input} value={salaryForm.pf} onChange={(event) => setSalaryForm((prev) => ({ ...prev, pf: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>ESI</p><input type="number" style={shell.input} value={salaryForm.esi} onChange={(event) => setSalaryForm((prev) => ({ ...prev, esi: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Other Deduction</p><input type="number" style={shell.input} value={salaryForm.otherDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, otherDeduction: event.target.value }))} /></div>
        </div>
        <div style={shell.field}><p style={shell.label}>Notes</p><textarea style={{ ...shell.input, minHeight: '72px' }} value={salaryForm.notes} onChange={(event) => setSalaryForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        <div style={shell.setupActionRow}>
          <button type="button" style={{ ...shell.btn, ...shell.setupButton }} onClick={saveSalaryStructure} disabled={!role.canManage || busy}>Save Salary Structure</button>
          <button type="button" style={{ ...shell.btnLight, ...shell.setupButton }} onClick={() => syncEmployeeMasterSalary(false)} disabled={!role.canManage || busy}>Sync Employee Master</button>
          <button type="button" style={{ ...shell.btnLight, ...shell.setupButton }} onClick={() => syncEmployeeMasterSalary(true)} disabled={!role.canManage || busy}>Sync + Update Existing</button>
          <button type="button" style={{ ...shell.btnLight, ...shell.setupButton }} onClick={() => setSalaryForm(salaryFormDefaults)}>Reset</button>
        </div>
      </div>
      <div style={shell.setupTableWrap}>
        <table style={setupTableStyle}>
          <colgroup>{payrollSetupColumns.map((column) => <col key={column.key} style={{ width: `${getSetupColumnWidth(column.key)}px` }} />)}</colgroup>
          <thead>
            <tr>
              <th style={setupHeadCellStyle('employee')}>Employee</th>
              <th style={setupHeadCellStyle('effectiveDate', 'center')}>Effective Date</th>
              <th style={setupHeadCellStyle('type', 'center')}>Type</th>
              <th style={setupHeadCellStyle('basic', 'center')}>Basic</th>
              <th style={setupHeadCellStyle('allowances', 'center')}>Allowances</th>
              <th style={setupHeadCellStyle('deductions', 'center')}>Deductions</th>
            </tr>
          </thead>
          <tbody>
            {salaryStructures.map((entry) => (
              <tr key={entry._id}>
                <td style={setupBodyCellStyle('employee')}>{getSalaryStructureEmployeeLabel(entry)}</td>
                <td style={setupBodyCellStyle('effectiveDate', 'center')}>{entry.effectiveDate}</td>
                <td style={setupBodyCellStyle('type', 'center')}>{entry.salaryType}</td>
                <td style={setupBodyCellStyle('basic', 'center')}>INR {money(getVisibleSalaryStructureAmount(entry))}</td>
                <td style={setupBodyCellStyle('allowances', 'center')}>INR {money(Object.values(entry.allowances || {}).reduce((sum, value) => sum + Number(value || 0), 0))}</td>
                <td style={setupBodyCellStyle('deductions', 'center')}>INR {money(Object.values(entry.deductions || {}).reduce((sum, value) => sum + Number(value || 0), 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderGenerate = () => (
    <div style={shell.panel}>
      <h3 style={shell.panelTitle}><UserRoundCheck size={16} /> Salary Processing</h3>
      <p style={shell.sub}>Generate payroll for all staff or only selected employees. Keep the month focused, fast, and ready for approval.</p>
      <div style={shell.compactGrid}>
        <div style={shell.miniStack}>
          <div style={shell.miniCard}>
            <p style={shell.miniCardLabel}>Payroll Scope</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', marginTop: '8px' }}>
              <div style={shell.card}>
                <p style={shell.cardLabel}>Month</p>
                <p style={shell.miniCardValue}>{monthOptions.find((entry) => entry.value === Number(month))?.label}</p>
              </div>
              <div style={shell.card}>
                <p style={shell.cardLabel}>Year</p>
                <p style={shell.miniCardValue}>{year}</p>
              </div>
              <div style={shell.card}>
                <p style={shell.cardLabel}>Scope</p>
                <p style={shell.miniCardValue}>{selectedGenerateEmployees.length > 0 ? selectedGenerateEmployees.length : 'All'}</p>
              </div>
              <div style={shell.card}>
                <p style={shell.cardLabel}>Weekly Off</p>
                <p style={shell.miniCardValue}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(meta?.config?.weeklyOffDay || 0)]}</p>
              </div>
            </div>
          </div>
          <div style={shell.miniCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <p style={shell.miniCardLabel}>Selected Employees</p>
              <button type="button" style={shell.pillButton} onClick={() => setSelectedGenerateEmployees([])} disabled={selectedGenerateEmployees.length === 0 || busy}>Clear</button>
            </div>
            <select
              multiple
              size={6}
              style={{ ...shell.input, minHeight: '180px', marginTop: '8px' }}
              value={selectedGenerateEmployees}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                setSelectedGenerateEmployees(values);
              }}
            >
              {employees.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {[entry.firstName, entry.lastName].filter(Boolean).join(' ').trim() || entry.empCode} ({entry.empCode || '-'}) - {entry.role || '-'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={shell.miniStack}>
          <div style={shell.miniCard}>
            <p style={shell.miniCardLabel}>Quick Summary</p>
            <div style={{ marginTop: '8px', display: 'grid', gap: '6px', fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
              <div>Processing: <strong>{selectedGenerateEmployees.length > 0 ? 'Selected employees only' : 'All employees'}</strong></div>
              <div>Late Grace: <strong>{meta?.config?.lateMarkGraceMinutes || 15} min</strong></div>
              <div>Shift Start: <strong>{meta?.config?.workStartTime || '09:00'}</strong></div>
              <div>Mode: <strong>{role.canGenerate ? 'Ready to generate' : 'Read only'}</strong></div>
            </div>
          </div>
          <div style={shell.miniCard}>
            <p style={shell.miniCardLabel}>Selected Count</p>
            <p style={shell.miniCardValue}>{selectedGenerateEmployees.length}</p>
            <p style={{ ...shell.sub, marginTop: '8px' }}>Use selected mode for targeted salary runs. Leave blank to process everyone.</p>
          </div>
          <div style={{ ...shell.actionRow, gap: '6px' }}>
            <button type="button" style={shell.btn} onClick={() => generatePayroll(false)} disabled={!role.canGenerate || busy}>Generate Payroll</button>
            <button type="button" style={shell.btnLight} onClick={() => generatePayroll(true)} disabled={!role.canGenerate || busy}>Regenerate</button>
            <button type="button" style={shell.btnLight} onClick={seedData} disabled={!role.canManage || busy}>Seed Sample</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPayrollList = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><Filter size={16} /> Salary History</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Employee</p><select style={shell.input} value={filters.employeeId} onChange={(event) => setFilters((prev) => ({ ...prev, employeeId: event.target.value }))}><option value="">All</option>{employees.map((entry) => <option key={entry._id} value={entry._id}>{[entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.empCode}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Department</p><select style={shell.input} value={filters.department} onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}><option value="">All</option>{departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Payment Status</p><select style={shell.input} value={filters.paymentStatus} onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}><option value="">All</option><option value="Pending">Pending</option><option value="Paid">Paid</option><option value="Hold">Hold</option></select></div>
          <div style={shell.field}><p style={shell.label}>Payroll Status</p><select style={shell.input} value={filters.payrollStatus} onChange={(event) => setFilters((prev) => ({ ...prev, payrollStatus: event.target.value }))}><option value="">All</option><option value="Draft">Draft</option><option value="Generated">Generated</option><option value="Paid">Paid</option><option value="Hold">Hold</option></select></div>
          <div style={shell.field}><p style={shell.label}>Search Name / ID</p><input style={shell.input} value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Search employee" /></div>
        </div>
      </div>
      {screenWidth < 960 ? (
        <div style={shell.historyCardList}>
          {pagedPayrollItems.map((entry) => (
            <div key={entry._id} style={shell.historyCard}>
              <div style={shell.historyHeader}>
                <div style={shell.employeeMeta}>
                  <p style={shell.historyTitle}>{entry.employeeName}</p>
                  <p style={shell.historySub}>{entry.employeeCode} • {entry.department || '-'} • {monthOptions.find((item) => Number(item.value) === Number(entry.month))?.label || entry.month} {entry.year}</p>
                </div>
                <span style={{ ...shell.badge, ...statusBadgeStyle(entry.payrollStatus) }}>{entry.payrollStatus}</span>
              </div>
              <div style={shell.historyMetaGrid}>
                <div style={shell.historyMetric}>
                  <p style={shell.historyMetricLabel}>Net Salary</p>
                  <p style={shell.historyMetricValue}>INR {money(entry.netSalary)}</p>
                </div>
                <div style={shell.historyMetric}>
                  <p style={shell.historyMetricLabel}>Payment</p>
                  <p style={shell.historyMetricValue}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.paymentStatus) }}>{entry.paymentStatus}</span></p>
                </div>
                <div style={shell.historyMetric}>
                  <p style={shell.historyMetricLabel}>Gross</p>
                  <p style={shell.historyMetricValue}>INR {money(entry.grossSalary)}</p>
                </div>
                <div style={shell.historyMetric}>
                  <p style={shell.historyMetricLabel}>Deductions</p>
                  <p style={shell.historyMetricValue}>INR {money(entry?.deductions?.total)}</p>
                </div>
              </div>
              <div style={shell.historyMetaGrid}>
                <div style={shell.historyMetric}>
                  <p style={shell.historyMetricLabel}>Attendance</p>
                  <p style={shell.historyMetricValue}>
                    P {entry?.attendanceSummary?.presentDays || 0} • PL {entry?.attendanceSummary?.paidLeaveDays || 0} • UL {entry?.attendanceSummary?.unpaidLeaveDays || 0}
                  </p>
                </div>
                <div style={shell.historyMetric}>
                  <p style={shell.historyMetricLabel}>Working Days</p>
                  <p style={shell.historyMetricValue}>{entry?.attendanceSummary?.totalWorkingDays || 0}</p>
                </div>
              </div>
              {renderPayrollHistoryActions(entry, true)}
            </div>
          ))}
          {pagedPayrollItems.length === 0 ? <div style={{ ...shell.historyCard, textAlign: 'center', color: '#64748b' }}>No payroll rows found for selected filter.</div> : null}
        </div>
      ) : (
        <div style={shell.tableWrap}>
          <table style={historyTableStyle}>
            <colgroup>
              {payrollHistoryColumns.map((column) => (
                <col key={column.key} style={{ width: `${getHistoryColumnWidth(column.key)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={historyHeadCellStyle('employee')}>Employee</th>
                <th style={historyHeadCellStyle('month', 'center')}>Month</th>
                <th style={historyHeadCellStyle('attendance', 'center')}>Attendance</th>
                <th style={historyHeadCellStyle('gross', 'center')}>Gross</th>
                <th style={historyHeadCellStyle('deductions', 'center')}>Deductions</th>
                <th style={historyHeadCellStyle('net', 'center')}>Net</th>
                <th style={historyHeadCellStyle('payroll', 'center')}>Payroll</th>
                <th style={historyHeadCellStyle('payment', 'center')}>Payment</th>
                <th style={historyHeadCellStyle('action', 'center')}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedPayrollItems.map((entry) => (
                <tr key={entry._id}>
                  <td style={historyBodyCellStyle('employee')}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{entry.employeeName}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{entry.employeeCode} • {entry.department || '-'}</div>
                  </td>
                  <td style={historyBodyCellStyle('month', 'center')}>{monthOptions.find((item) => Number(item.value) === Number(entry.month))?.label || entry.month} {entry.year}</td>
                  <td style={historyBodyCellStyle('attendance', 'center')}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>WD {entry?.attendanceSummary?.totalWorkingDays || 0}</div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>P {entry?.attendanceSummary?.presentDays || 0} • PL {entry?.attendanceSummary?.paidLeaveDays || 0} • UL {entry?.attendanceSummary?.unpaidLeaveDays || 0}</div>
                  </td>
                  <td style={historyBodyCellStyle('gross', 'center')}>INR {money(entry.grossSalary)}</td>
                  <td style={historyBodyCellStyle('deductions', 'center')}>INR {money(entry?.deductions?.total)}</td>
                  <td style={historyBodyCellStyle('net', 'center')}><strong>INR {money(entry.netSalary)}</strong></td>
                  <td style={historyBodyCellStyle('payroll', 'center')}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.payrollStatus) }}>{entry.payrollStatus}</span></td>
                  <td style={historyBodyCellStyle('payment', 'center')}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.paymentStatus) }}>{entry.paymentStatus}</span></td>
                  <td style={historyBodyCellStyle('action', 'center')}>{renderPayrollHistoryActions(entry, false)}</td>
                </tr>
              ))}
              {pagedPayrollItems.length === 0 ? (
                <tr><td colSpan={9} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No payroll rows found for selected filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...shell.actionRow, justifyContent: 'flex-end' }}>
        <div style={shell.actionRow}>
          <button type="button" style={{ ...shell.btnLight, width: 34, minWidth: 34, minHeight: 32, height: 32, padding: 0, justifyContent: 'center' }} disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} /></button>
          <button type="button" style={{ ...shell.btnLight, width: 34, minWidth: 34, minHeight: 32, height: 32, padding: 0, justifyContent: 'center' }} disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} aria-label="Next page" title="Next page"><ChevronRight size={16} /></button>
        </div>
      </div>
    </>
  );

  const renderAdvance = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><HandCoins size={16} /> Advance Salary / Loan</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Employee</p><select style={shell.input} value={advanceForm.employeeId} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, employeeId: event.target.value }))}><option value="">Select</option>{employees.map((entry) => <option key={entry._id} value={entry._id}>{[entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.empCode}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Advance Amount</p><input type="number" style={shell.input} value={advanceForm.amount} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, amount: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Monthly Deduction</p><input type="number" style={shell.input} value={advanceForm.monthlyDeduction} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, monthlyDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Mode</p><select style={shell.input} value={advanceForm.deductionMode} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, deductionMode: event.target.value }))}><option value="partial">Partial</option><option value="full">Full</option></select></div>
          <div style={shell.field}><p style={shell.label}>Issued Date</p><input type="date" style={shell.input} value={advanceForm.issuedDate} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, issuedDate: event.target.value }))} /></div>
        </div>
        <div style={shell.field}><p style={shell.label}>Reason</p><input style={shell.input} value={advanceForm.reason} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, reason: event.target.value }))} /></div>
        <div style={shell.actionRow}><button type="button" style={shell.btn} onClick={saveAdvance} disabled={busy || !role.canManage}>Save Advance</button></div>
      </div>
      <div style={shell.tableWrap}>
        <table style={advanceTableStyle}>
          <colgroup>{payrollAdvanceColumns.map((column) => <col key={column.key} style={{ width: `${getAdvanceColumnWidth(column.key)}px` }} />)}</colgroup>
          <thead>
            <tr>
              <th style={advanceHeadCellStyle('employee')}>Employee</th>
              <th style={advanceHeadCellStyle('issuedDate', 'center')}>Issued Date</th>
              <th style={advanceHeadCellStyle('amount', 'center')}>Amount</th>
              <th style={advanceHeadCellStyle('recovered', 'center')}>Recovered</th>
              <th style={advanceHeadCellStyle('balance', 'center')}>Balance</th>
              <th style={advanceHeadCellStyle('monthlyDeduction', 'center')}>Monthly Deduction</th>
              <th style={advanceHeadCellStyle('status', 'center')}>Status</th>
              <th style={advanceHeadCellStyle('action', 'center')}>Action</th>
            </tr>
          </thead>
          <tbody>
            {advances.map((entry) => (
              <tr key={entry._id}>
                <td style={advanceBodyCellStyle('employee')}>{employeeMap.get(String(entry.employeeId || '')) ? getEmployeeDisplayName(employeeMap.get(String(entry.employeeId || ''))) : entry.employeeId}</td>
                <td style={advanceBodyCellStyle('issuedDate', 'center')}>{entry.issuedDate}</td>
                <td style={advanceBodyCellStyle('amount', 'center')}>INR {money(entry.amount)}</td>
                <td style={advanceBodyCellStyle('recovered', 'center')}>INR {money(entry.recoveredAmount)}</td>
                <td style={advanceBodyCellStyle('balance', 'center')}><strong>INR {money(entry.balanceAmount)}</strong></td>
                <td style={advanceBodyCellStyle('monthlyDeduction', 'center')}>INR {money(entry.monthlyDeduction)}</td>
                <td style={advanceBodyCellStyle('status', 'center')}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.status) }}>{entry.status}</span></td>
                <td style={advanceBodyCellStyle('action', 'center')}>
                  <button type="button" style={shell.btnLight} onClick={() => removeAdvance(entry._id)} disabled={!role.canManage || busy}>Delete</button>
                </td>
              </tr>
            ))}
            {advances.length === 0 ? <tr><td colSpan={8} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No advance records.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderHoliday = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><CalendarDays size={16} /> Holiday Management</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Date</p><input type="date" style={shell.input} value={holidayForm.date} onChange={(event) => setHolidayForm((prev) => ({ ...prev, date: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Holiday Name</p><input style={shell.input} value={holidayForm.title} onChange={(event) => setHolidayForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Type</p><select style={shell.input} value={holidayForm.type} onChange={(event) => setHolidayForm((prev) => ({ ...prev, type: event.target.value }))}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></div>
          <div style={shell.field}><p style={shell.label}>Notes</p><input style={shell.input} value={holidayForm.notes} onChange={(event) => setHolidayForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        </div>
        <div style={shell.actionRow}>
          <button type="button" style={shell.btn} onClick={saveHoliday} disabled={!role.canManage || busy}>Save Holiday</button>
          <button type="button" style={shell.btnLight} disabled={!role.canManage || busy} onClick={async () => {
            try {
              setBusy(true);
              await axios.post(`${API_BASE}/api/payroll/meta`, { ...meta.config }, { headers });
              setStatus('Payroll settings saved.');
            } catch (error) {
              window.alert(error?.response?.data?.error || 'Unable to save payroll settings.');
            } finally {
              setBusy(false);
            }
          }}>Save Weekly Off Settings</button>
        </div>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Weekly Off Day</p><select style={shell.input} value={meta?.config?.weeklyOffDay ?? 0} onChange={(event) => setMeta((prev) => ({ ...prev, config: { ...(prev.config || {}), weeklyOffDay: Number(event.target.value) } }))}><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option></select></div>
          <div style={shell.field}><p style={shell.label}>Late Grace (Minutes)</p><input type="number" style={shell.input} value={meta?.config?.lateMarkGraceMinutes ?? 15} onChange={(event) => setMeta((prev) => ({ ...prev, config: { ...(prev.config || {}), lateMarkGraceMinutes: Number(event.target.value || 0) } }))} /></div>
          <div style={shell.field}><p style={shell.label}>Shift Start Time</p><input style={shell.input} value={meta?.config?.workStartTime ?? '09:00'} onChange={(event) => setMeta((prev) => ({ ...prev, config: { ...(prev.config || {}), workStartTime: event.target.value } }))} /></div>
        </div>
      </div>
      <div style={shell.tableWrap}>
        <table style={holidayTableStyle}>
          <colgroup>{payrollHolidayColumns.map((column) => <col key={column.key} style={{ width: `${getHolidayColumnWidth(column.key)}px` }} />)}</colgroup>
          <thead>
            <tr>
              <th style={holidayHeadCellStyle('date', 'center')}>Date</th>
              <th style={holidayHeadCellStyle('holiday')}>Holiday</th>
              <th style={holidayHeadCellStyle('type', 'center')}>Type</th>
              <th style={holidayHeadCellStyle('notes')}>Notes</th>
              <th style={holidayHeadCellStyle('action', 'center')}>Action</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((entry) => (
              <tr key={entry._id}>
                <td style={holidayBodyCellStyle('date', 'center')}>{entry.date}</td>
                <td style={holidayBodyCellStyle('holiday')}>{entry.title}</td>
                <td style={holidayBodyCellStyle('type', 'center')}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.type) }}>{entry.type}</span></td>
                <td style={holidayBodyCellStyle('notes')}>{entry.notes || '-'}</td>
                <td style={holidayBodyCellStyle('action', 'center')}><button type="button" style={shell.btnLight} onClick={() => removeHoliday(entry._id)} disabled={!role.canManage || busy}>Delete</button></td>
              </tr>
            ))}
            {holidays.length === 0 ? <tr><td colSpan={5} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No holidays for selected month.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderSlips = () => (
    <div style={shell.panel}>
      <h3 style={shell.panelTitle}><FileText size={16} /> Salary Slips</h3>
      <p style={shell.sub}>Open, download, email, or WhatsApp salary slips for the selected month/year. Use the filters above for the current salary cycle.</p>
      <div style={shell.actionRow}>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('monthly', 'json')}>Monthly Summary</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('employee-wise', 'json')}>Employee-wise</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('deduction', 'json')}>Deduction Summary</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('advance', 'json')}>Advance Recovery</button>
      </div>
      <div style={shell.actionRow}>
        <button type="button" style={shell.btn} onClick={() => exportReport('monthly', 'excel')}><Download size={14} /> Export Slips (Excel)</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('monthly', 'excel')}>Download CSV</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('deduction', 'excel')}>Download Deduction CSV</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('advance', 'excel')}>Download Advance CSV</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('monthly', 'pdf')}>Download Slips PDF</button>
      </div>
      {screenWidth < 960 ? (
        <div style={shell.slipCardList}>
          {pagedPayrollItems.map((entry) => (
            <div key={entry._id} style={shell.slipCard}>
              <div style={shell.slipCardHeader}>
                <div style={shell.employeeMeta}>
                  <p style={shell.slipCardTitle}>{entry.employeeName}</p>
                  <p style={shell.slipCardSub}>{entry.employeeCode} • {monthOptions.find((item) => Number(item.value) === Number(entry.month))?.label || entry.month} {entry.year}</p>
                </div>
                <span style={{ ...shell.badge, ...statusBadgeStyle(entry.paymentStatus) }}>{entry.paymentStatus}</span>
              </div>
              <div style={shell.slipMetricGrid}>
                <div style={shell.slipMetric}>
                  <p style={shell.slipMetricLabel}>Net Salary</p>
                  <p style={shell.slipMetricValue}>INR {money(entry.netSalary)}</p>
                </div>
                <div style={shell.slipMetric}>
                  <p style={shell.slipMetricLabel}>Slip</p>
                  <p style={shell.slipMetricValue}>{entry.slipPath ? 'Ready' : 'Generate'}</p>
                </div>
              </div>
              <div style={shell.slipMetricGrid}>
                <div style={shell.slipMetric}>
                  <p style={shell.slipMetricLabel}>Payment</p>
                  <p style={shell.slipMetricValue}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.paymentStatus) }}>{entry.paymentStatus}</span></p>
                </div>
                <div style={shell.slipMetric}>
                  <p style={shell.slipMetricLabel}>Gross</p>
                  <p style={shell.slipMetricValue}>INR {money(entry.grossSalary)}</p>
                </div>
              </div>
              {renderSlipActions(entry, true)}
            </div>
          ))}
          {pagedPayrollItems.length === 0 ? <div style={{ ...shell.slipCard, textAlign: 'center', color: '#64748b' }}>No salary slips for selected filter.</div> : null}
        </div>
      ) : (
        <div style={shell.tableWrap}>
          <table style={slipTableStyle}>
            <colgroup>
              {payrollSlipColumns.map((column) => (
                <col key={column.key} style={{ width: `${getSlipColumnWidth(column.key)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={slipHeadCellStyle('employee')}>Employee</th>
                <th style={slipHeadCellStyle('month', 'center')}>Month</th>
                <th style={slipHeadCellStyle('net', 'center')}>Net Salary</th>
                <th style={slipHeadCellStyle('payment', 'center')}>Payment</th>
                <th style={slipHeadCellStyle('slip', 'center')}>Slip</th>
                <th style={slipHeadCellStyle('actions', 'center')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedPayrollItems.map((entry) => (
                <tr key={entry._id}>
                  <td style={slipBodyCellStyle('employee')}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{entry.employeeName}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{entry.employeeCode}</div>
                  </td>
                  <td style={slipBodyCellStyle('month', 'center')}>{monthOptions.find((item) => Number(item.value) === Number(entry.month))?.label || entry.month} {entry.year}</td>
                  <td style={slipBodyCellStyle('net', 'center')}>INR {money(entry.netSalary)}</td>
                  <td style={slipBodyCellStyle('payment', 'center')}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.paymentStatus) }}>{entry.paymentStatus}</span></td>
                  <td style={slipBodyCellStyle('slip', 'center')}>{entry.slipPath ? 'Ready' : 'Generate'}</td>
                  <td style={slipBodyCellStyle('actions', 'center')}>{renderSlipActions(entry, false)}</td>
                </tr>
              ))}
              {pagedPayrollItems.length === 0 ? <tr><td colSpan={6} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No salary slips for selected filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Payroll</h2>
        <p style={shell.subtitle}>
          Compact salary processing, history, slips, and employee payroll settings in one clean view.
        </p>
      </div>

      <div style={shell.panel}>
        {screenWidth < 720 ? (
          <div style={shell.filterPanel}>
            <div style={shell.filterGrid}>
              <div style={shell.filterCard}><p style={shell.label}>Month</p><select style={shell.input} value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div>
              <div style={shell.filterCard}><p style={shell.label}>Year</p><input type="number" style={shell.input} value={year} onChange={(event) => setYear(Number(event.target.value || defaultYear))} /></div>
              <div style={shell.filterCard}><p style={shell.label}>Role Access</p><div style={shell.filterBadge}>{role.canManage ? 'Admin/HR (Full Control)' : role.canMarkPaid ? 'Accountant (Payment Control)' : 'Employee/Technician (Own Salary Slip View)'}</div></div>
              <div style={shell.filterCard}><p style={shell.label}>Actions</p><button type="button" style={{ ...shell.btn, ...shell.filterButton, width: '100%' }} onClick={reloadAll} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh'}</button></div>
            </div>
          </div>
        ) : (
          <div style={shell.row}>
            <div style={shell.field}><p style={shell.label}>Month</p><select style={shell.input} value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div>
            <div style={shell.field}><p style={shell.label}>Year</p><input type="number" style={shell.input} value={year} onChange={(event) => setYear(Number(event.target.value || defaultYear))} /></div>
            <div style={shell.field}><p style={shell.label}>Role Access</p><div style={{ ...shell.input, display: 'flex', alignItems: 'center', fontWeight: 700, color: '#0f172a' }}>{role.canManage ? 'Admin/HR (Full Control)' : role.canMarkPaid ? 'Accountant (Payment Control)' : 'Employee/Technician (Own Salary Slip View)'}</div></div>
            <div style={{ ...shell.field, justifyContent: 'end' }}>
              <p style={shell.label}>Actions</p>
              <div style={shell.actionRow}>
                <button type="button" style={shell.btn} onClick={reloadAll} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh'}</button>
              </div>
            </div>
          </div>
        )}
        <div style={screenWidth < 540 ? shell.tabStripMobile : shell.tabStrip}>
          {tabKeys.map((entry) => (
            <button
              key={entry.key}
              type="button"
              style={{
                ...shell.tab,
                ...(screenWidth < 540 ? shell.tabMobile : null),
                ...(activeTab === entry.key ? { background: 'var(--color-primary)', color: '#fff', border: '1px solid rgba(159, 23, 77, 0.38)' } : null)
              }}
              onClick={() => setActiveTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div style={shell.panel}>
        <h3 style={shell.panelTitle}>
          {activeTab === 'dashboard' ? <CircleDollarSign size={16} /> : null}
          {activeTab === 'generate' ? <ShieldCheck size={16} /> : null}
          {activeTab === 'list' ? <Filter size={16} /> : null}
          {activeTab === 'setup' ? <Landmark size={16} /> : null}
          {activeTab === 'slips' ? <FileText size={16} /> : null}
          {tabKeys.find((entry) => entry.key === activeTab)?.label}
        </h3>
        <p style={shell.sub}>
          Business rules enforced: paid leave/holiday not deducted, unpaid leave deducted, half-day deducts half day, and no duplicate paid payroll generation.
        </p>
        {activeTab === 'dashboard' ? renderDashboard() : null}
        {activeTab === 'generate' ? renderGenerate() : null}
        {activeTab === 'list' ? renderPayrollList() : null}
        {activeTab === 'setup' ? (
          <>
            {renderSalarySetup()}
            {renderAdvance()}
            {renderHoliday()}
          </>
        ) : null}
        {activeTab === 'slips' ? renderSlips() : null}
      </div>

      {status ? <p style={{ ...shell.footer, whiteSpace: 'pre-line' }}>{status}</p> : null}

      {paymentModal.open ? (
        <div style={shell.modalBg}>
          <div style={getModalStyle()}>
            <h3 style={shell.panelTitle}><CircleDollarSign size={16} /> Mark Salary as Paid</h3>
            <p style={shell.sub}>{paymentModal.item?.employeeName} - Net INR {money(paymentModal.item?.netSalary)}</p>
            <div style={{ ...shell.row, gridTemplateColumns: screenWidth < 640 ? '1fr' : 'repeat(3, minmax(0, 1fr))' }}>
              <div style={shell.field}><p style={shell.label}>Payment Mode</p><select style={shell.input} value={paymentModal.paymentMode} onChange={(event) => setPaymentModal((prev) => ({ ...prev, paymentMode: event.target.value }))}><option>Cash</option><option>Bank transfer</option><option>UPI</option><option>Cheque</option></select></div>
              <div style={shell.field}><p style={shell.label}>Payment Date</p><input type="date" style={shell.input} value={paymentModal.paymentDate} onChange={(event) => setPaymentModal((prev) => ({ ...prev, paymentDate: event.target.value }))} /></div>
              <div style={shell.field}><p style={shell.label}>Transaction / Ref No.</p><input style={shell.input} value={paymentModal.transactionRef} onChange={(event) => setPaymentModal((prev) => ({ ...prev, transactionRef: event.target.value }))} /></div>
            </div>
            <div style={shell.field}><p style={shell.label}>Remarks</p><textarea style={{ ...shell.input, minHeight: '70px' }} value={paymentModal.remarks} onChange={(event) => setPaymentModal((prev) => ({ ...prev, remarks: event.target.value }))} /></div>
            <div style={getModalActionStyle()}>
              <button type="button" style={{ ...shell.btn, ...shell.modalActionButton, width: screenWidth < 640 ? '100%' : 'auto' }} onClick={markPaid} disabled={busy}>Confirm Payment</button>
              <button type="button" style={{ ...shell.btnLight, ...shell.modalActionButton, width: screenWidth < 640 ? '100%' : 'auto' }} onClick={() => setPaymentModal((prev) => ({ ...prev, open: false, item: null }))}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustModal.open ? (
        <div style={shell.modalBg}>
          <div style={getModalStyle()}>
            <h3 style={shell.panelTitle}><ShieldCheck size={16} /> Manual Salary Override</h3>
            <p style={shell.sub}>Admin/HR can adjust salary with reason for audit log.</p>
            <div style={{ ...shell.row, gridTemplateColumns: screenWidth < 640 ? '1fr' : 'repeat(4, minmax(0, 1fr))' }}>
              <div style={shell.field}><p style={shell.label}>Payroll Status</p><select style={shell.input} value={adjustModal.payrollStatus} onChange={(event) => setAdjustModal((prev) => ({ ...prev, payrollStatus: event.target.value }))}><option value="Draft">Draft</option><option value="Generated">Generated</option><option value="Hold">Hold</option></select></div>
              <div style={shell.field}><p style={shell.label}>Manual Adjustment Amount (+/-)</p><input type="number" style={shell.input} value={adjustModal.manualAdjustmentAmount} onChange={(event) => setAdjustModal((prev) => ({ ...prev, manualAdjustmentAmount: event.target.value }))} /></div>
              <div style={shell.field}><p style={shell.label}>Override Net Salary</p><input type="number" style={shell.input} value={adjustModal.overrideNetSalary} onChange={(event) => setAdjustModal((prev) => ({ ...prev, overrideNetSalary: event.target.value }))} /></div>
              <div style={shell.field}><p style={shell.label}>Override Mode</p><select style={shell.input} value={adjustModal.manualOverrideEnabled ? 'yes' : 'no'} onChange={(event) => setAdjustModal((prev) => ({ ...prev, manualOverrideEnabled: event.target.value === 'yes' }))}><option value="no">Adjustment Mode</option><option value="yes">Absolute Override Net</option></select></div>
            </div>
            <div style={shell.field}><p style={shell.label}>Reason</p><textarea style={{ ...shell.input, minHeight: '72px' }} value={adjustModal.manualAdjustmentReason} onChange={(event) => setAdjustModal((prev) => ({ ...prev, manualAdjustmentReason: event.target.value }))} /></div>
            <div style={getModalActionStyle()}>
              <button type="button" style={{ ...shell.btn, ...shell.modalActionButton, width: screenWidth < 640 ? '100%' : 'auto' }} onClick={saveAdjustment} disabled={busy}>Save Adjustment</button>
              <button type="button" style={{ ...shell.btnLight, ...shell.modalActionButton, width: screenWidth < 640 ? '100%' : 'auto' }} onClick={() => setAdjustModal((prev) => ({ ...prev, open: false, item: null }))}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      <PdfPreviewModal
        open={slipViewer.open}
        title={`Salary Slip - ${slipViewer.title}`}
        pdfUrl={slipViewer.url}
        downloadFileName={`${String(slipViewer.title || 'salary-slip').replace(/[^\w.-]+/g, '_')}.pdf`}
        onClose={() => setSlipViewer({ open: false, url: '', title: '', item: null })}
        onShareEmail={() => shareSlip('email')}
        onShareWhatsApp={() => shareSlip('whatsapp')}
        publicShareUrl={slipViewer.url}
      />
    </section>
  );
}
