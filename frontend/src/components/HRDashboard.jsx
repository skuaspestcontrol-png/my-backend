import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './HRDashboard.css';
import {
  Activity,
  CalendarCheck,
  Pencil,
  Users
} from 'lucide-react';
import useColumnResize from './table/useColumnResize';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { buildPortalAuthHeaders, getPortalUserRole, getPortalUserId } from '../utils/portalAuth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const now = new Date();
const HR_DASHBOARD_CACHE_KEY = 'hr_dashboard_cache_v1';

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
    border: '1px solid var(--border)',
    background: 'var(--surface-card)',
    boxShadow: 'var(--shadow)',
    padding: '14px',
    display: 'grid',
    gap: '10px',
    backgroundClip: 'padding-box'
  },
  panelTitle: { margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '7px' },
  panelSub: { margin: 0, fontSize: '12px', color: 'var(--text-secondary)' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' },
  field: { display: 'grid', gap: '4px' },
  label: { margin: 0, fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', minHeight: '35px', borderRadius: '9px', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '13px', background: 'var(--input-bg)', color: 'var(--input-text)' },
  btn: {
    border: '1px solid rgba(159, 23, 77, 0.36)',
    borderRadius: '9px',
    minHeight: '38px',
    height: '38px',
    padding: '0 11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer'
  },
  btnLight: {
    border: '1px solid var(--border)',
    borderRadius: '9px',
    minHeight: '35px',
    padding: '0 11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--surface-card-elevated)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  iconActionBtn: {
    width: '36px',
    minWidth: '36px',
    height: '36px',
    minHeight: '36px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface-card-elevated)',
    color: 'var(--text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer'
  },
  iconActionBtnActive: {
    border: '1px solid rgba(159, 23, 77, 0.42)',
    background: 'var(--color-primary)',
    color: '#fff'
  },
  iconActionBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  statCard: { borderRadius: '13px', border: '1px solid var(--border)', background: 'var(--surface-card-elevated)', padding: '10px', display: 'grid', gap: '6px', boxShadow: '0 10px 24px rgba(2, 6, 23, 0.2)', backgroundClip: 'padding-box' },
  statLabel: { margin: 0, fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' },
  split2: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '10px' },
  chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '10px' },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '8px' },
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '8px 10px',
    background: 'var(--surface-card-elevated)',
    boxShadow: '0 8px 20px rgba(2, 6, 23, 0.16)',
    backgroundClip: 'padding-box'
  },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', border: '1px solid rgba(159, 23, 77, 0.25)', padding: '3px 8px', fontSize: '11px', fontWeight: 700 },
  kanbanBoard: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))', gap: '10px', overflowX: 'auto', paddingBottom: '4px' },
  kanbanCol: { minHeight: '240px', borderRadius: '13px', border: '1px solid var(--border)', background: 'var(--surface-card-elevated)', padding: '8px', display: 'grid', gap: '8px', alignContent: 'start', boxShadow: '0 10px 24px rgba(2, 6, 23, 0.2)', backgroundClip: 'padding-box' },
  kanbanHead: { margin: 0, fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  card: { borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-card-elevated)', padding: '8px', display: 'grid', gap: '6px', cursor: 'pointer', boxShadow: '0 8px 18px rgba(2, 6, 23, 0.18)', backgroundClip: 'padding-box' },
  tiny: { margin: 0, fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 },
  cardTitle: { margin: 0, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 800 },
  tableWrap: { borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto', background: 'var(--table-bg)', boxShadow: '0 12px 28px rgba(2, 6, 23, 0.2)', backgroundClip: 'padding-box' },
  table: { width: '100%', minWidth: '760px', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 9px', borderBottom: '1px solid var(--border)', background: 'var(--table-header-bg)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.25, minHeight: '42px', height: 'auto' },
  td: { padding: '8px 9px', borderBottom: '1px solid var(--border-soft)', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, verticalAlign: 'top' },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.46)', display: 'grid', placeItems: 'center', zIndex: 99, padding: '14px' },
  modal: { width: 'min(860px, 100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface-card)', padding: '14px', display: 'grid', gap: '10px', boxShadow: 'var(--shadow)', backgroundClip: 'padding-box', color: 'var(--text-primary)' },
  modalGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }
};

const monthOptions = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: new Date(now.getFullYear(), index, 1).toLocaleString('en-IN', { month: 'long' })
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

const entitlementLeaveTypes = ['Casual Leave (CL)', 'Sick Leave (SL)'];
const maxLeaveEntitlementAllocation = 99;

const normalizeLeaveEntitlementAllocationInput = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 2);

const toLeaveEntitlementAllocation = (value) => {
  const numericText = normalizeLeaveEntitlementAllocationInput(value);
  return Math.min(maxLeaveEntitlementAllocation, Math.max(0, Number(numericText) || 0));
};

const roleFlags = () => {
  const roleRaw = String(getPortalUserRole() || 'Admin').trim().toLowerCase();
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
  { key: 'casual', label: 'Casual Available' },
  { key: 'sick', label: 'Sick Available' },
  { key: 'pending', label: 'Pending' },
  { key: 'unpaid', label: 'Unpaid Used' }
];
const hrBalanceWidths = {
  employee: 180,
  casual: 150,
  sick: 150,
  pending: 120,
  unpaid: 120
};
const hrBalanceBounds = {
  employee: { min: 150, max: 260 },
  casual: { min: 130, max: 220 },
  sick: { min: 130, max: 220 },
  pending: { min: 100, max: 160 },
  unpaid: { min: 100, max: 160 }
};

const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const baseHeaders = () => ({
  ...buildPortalAuthHeaders()
});

const buildHrDashboardCacheKey = ({ month, year, filters }) => JSON.stringify({
  actor: String(getPortalUserId() || ''),
  actorRole: String(getPortalUserRole() || ''),
  month,
  year,
  search: String(filters?.search || '').trim(),
  department: String(filters?.department || '').trim(),
  role: String(filters?.role || '').trim(),
  location: String(filters?.location || '').trim(),
  status: String(filters?.status || '').trim()
});

const readHrDashboardCache = (key) => {
  try {
    const raw = window.sessionStorage.getItem(HR_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.queryKey !== key) return null;
    return {
      filterOptions: parsed.filterOptions || { departments: [], roles: [], locations: [], statuses: [] },
      summary: parsed.summary || null,
      leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
      leaveBalances: Array.isArray(parsed.leaveBalances) ? parsed.leaveBalances : [],
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      status: String(parsed.status || '').trim(),
      updatedAt: Number(parsed.updatedAt || 0) || 0
    };
  } catch (_error) {
    return null;
  }
};

const writeHrDashboardCache = (queryKey, next = {}) => {
  try {
    window.sessionStorage.setItem(HR_DASHBOARD_CACHE_KEY, JSON.stringify({
      queryKey,
      filterOptions: next.filterOptions || { departments: [], roles: [], locations: [], statuses: [] },
      summary: next.summary || null,
      leaves: Array.isArray(next.leaves) ? next.leaves : [],
      leaveBalances: Array.isArray(next.leaveBalances) ? next.leaveBalances : [],
      employees: Array.isArray(next.employees) ? next.employees : [],
      status: String(next.status || '').trim(),
      updatedAt: Number(next.updatedAt || Date.now()) || Date.now()
    }));
  } catch (_error) {
    // Ignore sessionStorage issues.
  }
};

function MiniBarChart({ rows = [], nameKey = 'name', valueKey = 'value', color = 'var(--color-primary)' }) {
  if (!rows.length) return <p style={shell.panelSub}>No data available.</p>;
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const percent = Math.max(0, Math.round((value / max) * 100));
        return (
          <div key={`${row[nameKey]}-${value}`} style={{ display: 'grid', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{row[nameKey]}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{value}</span>
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
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{row.employeeName}</p>
              {row.date ? <p style={shell.tiny}>Date: {row.date}</p> : null}
            </div>
            <span style={{ ...shell.badge, color: 'var(--color-primary-dark)', borderColor: 'rgba(159, 23, 77, 0.26)' }}>{Number.isFinite(row.days) ? (row.days === 0 ? 'Today' : `${row.days} days`) : row.value != null ? `${valuePrefix}${money(row.value)}` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HRDashboard() {
  const role = useMemo(() => roleFlags(), []);
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();
  const initialQueryKey = buildHrDashboardCacheKey({
    month: initialMonth,
    year: initialYear,
    filters: { search: '', department: '', role: '', location: '', status: '' }
  });
  const [cachedHrData] = useState(() => readHrDashboardCache(initialQueryKey));
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const canViewHr = ['admin', 'hr', 'hr manager', 'human resources'].includes(String(getPortalUserRole() || '').trim().toLowerCase());
  const [loadStates, setLoadStates] = useState({ overview: 'loading', leaves: 'loading', balances: 'loading', employees: 'loading' });
  const requestVersion = useRef(0);
  const entitlementVersion = useRef(0);
  const liveScope = useRef({});
  const [entitlementState, setEntitlementState] = useState('loading');
  const [loadedSnapshotKey, setLoadedSnapshotKey] = useState('');
  const [loadedLeavePeriod, setLoadedLeavePeriod] = useState('');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const [filterOptions, setFilterOptions] = useState({ departments: [], roles: [], locations: [], statuses: [] });
  const [filters, setFilters] = useState({ search: '', department: '', role: '', location: '', status: '' });

  const [summary, setSummary] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [leaveEntitlementEmployeeId, setLeaveEntitlementEmployeeId] = useState('');
  const [leaveEntitlementYear, setLeaveEntitlementYear] = useState(new Date().getFullYear());
  const [leaveEntitlementRows, setLeaveEntitlementRows] = useState([]);
  const [leaveEntitlementBusy, setLeaveEntitlementBusy] = useState(false);
  const [editingLeaveEntitlementType, setEditingLeaveEntitlementType] = useState('');
  const [editingLeaveEntitlementOriginal, setEditingLeaveEntitlementOriginal] = useState(null);
  const [employees, setEmployees] = useState([]);
  liveScope.current = {
    query: buildHrDashboardCacheKey({ month, year, filters }),
    entitlement: JSON.stringify([leaveEntitlementEmployeeId, leaveEntitlementYear])
  };

  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Paid Leave', fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), days: 1, reason: '' });

  const headers = useMemo(() => baseHeaders(), []);
  const loadRequestRef = useRef(null);

  useEffect(() => {
    if (!cachedHrData) return;
    setFilterOptions(cachedHrData.filterOptions);
    setSummary(cachedHrData.summary);
    setLeaves(cachedHrData.leaves);
    setLeaveBalances(cachedHrData.leaveBalances);
    setEmployees(cachedHrData.employees);
    setStatus(cachedHrData.status);
  }, [cachedHrData]);

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
    if (!canViewHr) return;
    const queryKey = buildHrDashboardCacheKey({ month, year, filters });
    if (queryKey !== liveScope.current.query) return;
    if (loadRequestRef.current?.key === queryKey) return loadRequestRef.current.promise;
    const version = ++requestVersion.current;
    const cachedForQuery = readHrDashboardCache(queryKey);
    const shouldSilenceLoad = silent || Boolean(cachedForQuery);
    const refreshToken = Date.now();
    const request = (async () => {
      try {
        if (!shouldSilenceLoad) setBusy(true);
        const results = await Promise.allSettled([
          axios.get(`${API_BASE}/api/hr/filters`, { params: { _ts: refreshToken }, headers }),
          axios.get(`${API_BASE}/api/hr/dashboard-summary`, { params: { ...queryParams, _ts: refreshToken }, headers }),
          axios.get(`${API_BASE}/api/hr/leaves`, { params: { month, year, _ts: refreshToken }, headers }),
          axios.get(`${API_BASE}/api/hr/leaves/balance`, { params: { month, year, _ts: refreshToken }, headers }),
          axios.get(`${API_BASE}/api/hr/employees/overview`, { params: { _ts: refreshToken }, headers })
        ]);

        if (version !== requestVersion.current || queryKey !== liveScope.current.query) return;
        const hasFailure = results.some((entry) => entry.status === 'rejected');
        const getData = (index, fallback) => (
          results[index]?.status === 'fulfilled' ? results[index].value?.data : fallback
        );
        const rawFilters = getData(0, null);
        const nextFilterOptions = Object.fromEntries(['departments', 'roles', 'locations', 'statuses'].map((key) => [key, Array.isArray(rawFilters?.[key]) ? rawFilters[key].filter((value) => typeof value === 'string') : []]));
        const rawSummary = getData(1, null);
        const nextSummary = rawSummary?.cards && typeof rawSummary.cards === 'object' ? rawSummary : null;
        setLoadStates({ overview: nextSummary ? 'ready' : 'unavailable', leaves: results[2].status === 'fulfilled' && Array.isArray(getData(2, null)) ? 'ready' : 'unavailable', balances: results[3].status === 'fulfilled' && Array.isArray(getData(3, null)) ? 'ready' : 'unavailable', employees: results[4].status === 'fulfilled' && Array.isArray(getData(4, null)) ? 'ready' : 'unavailable' });
        const nextLeaves = Array.isArray(getData(2, [])) ? getData(2, []) : [];
        const nextLeaveBalances = Array.isArray(getData(3, [])) ? getData(3, []) : [];
        const nextEmployees = Array.isArray(getData(4, [])) ? getData(4, []) : [];
        const nextStatus = hasFailure ? 'Some HR data could not be loaded. Showing available data.' : '';

        setLoadedSnapshotKey(queryKey);
        setLoadedLeavePeriod(`${year}-${month}`);
        setFilterOptions(nextFilterOptions);
        setSummary(nextSummary);
        setLeaves(nextLeaves);
        setLeaveBalances(nextLeaveBalances);
        setEmployees(nextEmployees);
        setStatus(nextStatus);
        writeHrDashboardCache(queryKey, {
          filterOptions: nextFilterOptions,
          summary: nextSummary,
          leaves: nextLeaves,
          leaveBalances: nextLeaveBalances,
          employees: nextEmployees,
          status: nextStatus,
          updatedAt: Date.now()
        });
      } catch (error) {
        if (queryKey !== liveScope.current.query) return;
        console.error('HR dashboard load failed', error);
        setStatus(error?.response?.data?.error || 'Unable to load HR dashboard right now.');
      } finally {
        if (version === requestVersion.current) setBusy(false);
      }
    })();

    loadRequestRef.current = { key: queryKey, promise: request };
    request.finally(() => {
      if (loadRequestRef.current?.promise === request) {
        loadRequestRef.current = null;
      }
    });
    return request;
  }, [canViewHr, filters, headers, month, queryParams, year]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useAutoRefresh(() => fetchAll(true), { intervalMs: 15000 });

  useEffect(() => () => {
    window.clearTimeout(window.__hrDashboardUpdatedTimer);
  }, []);

  const submitLeave = async () => {
    try {
      await axios.post(`${API_BASE}/api/hr/leaves`, leaveForm, { headers });
      setStatus('Leave request submitted.');
      await fetchAll();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to submit leave request.');
    }
  };

  useEffect(() => {
    if (employees.some((employee) => employee._id === leaveEntitlementEmployeeId)) return;
    setLeaveEntitlementEmployeeId(employees[0]?._id || '');
  }, [employees, leaveEntitlementEmployeeId]);

  const fetchLeaveEntitlements = useCallback(async () => {
    const selectionKey = JSON.stringify([leaveEntitlementEmployeeId, leaveEntitlementYear]);
    if (selectionKey !== liveScope.current.entitlement) return;
    const version = ++entitlementVersion.current;
    if (!leaveEntitlementEmployeeId) {
      setEntitlementState('unavailable');
      setLeaveEntitlementRows([]);
      return;
    }
    try {
      setLeaveEntitlementBusy(true);
      setEntitlementState('loading');
      setLeaveEntitlementRows([]);
      const response = await axios.get(`${API_BASE}/api/hr/leave-entitlements`, {
        params: { employeeId: leaveEntitlementEmployeeId, year: leaveEntitlementYear },
        headers
      });
      if (version !== entitlementVersion.current || selectionKey !== liveScope.current.entitlement) return;
      setEntitlementState(Array.isArray(response.data?.balances) ? 'ready' : 'unavailable');
      setLeaveEntitlementRows(Array.isArray(response.data?.balances) ? response.data.balances : []);
    } catch (error) {
      if (version !== entitlementVersion.current || selectionKey !== liveScope.current.entitlement) return;
      setEntitlementState('unavailable');
      setLeaveEntitlementRows([]);
      setStatus(error?.response?.data?.error || 'Unable to load leave entitlements.');
    } finally {
      if (version === entitlementVersion.current) setLeaveEntitlementBusy(false);
    }
  }, [headers, leaveEntitlementEmployeeId, leaveEntitlementYear]);

  useEffect(() => {
    fetchLeaveEntitlements();
  }, [fetchLeaveEntitlements]);

  useEffect(() => {
    setEditingLeaveEntitlementType('');
    setEditingLeaveEntitlementOriginal(null);
  }, [leaveEntitlementEmployeeId, leaveEntitlementYear]);

  const updateLeaveEntitlement = async (leaveType, allocated) => {
    if (!role.canManage) return false;
    const nextAllocated = toLeaveEntitlementAllocation(allocated);
    const currentRow = leaveEntitlementRows.find((entry) => entry.leaveType === leaveType);
    const used = Number(currentRow?.used || 0);
    if (!Number.isFinite(nextAllocated) || nextAllocated < 0) {
      setStatus('Allocation cannot be negative.');
      return false;
    }
    if (nextAllocated > maxLeaveEntitlementAllocation) {
      setStatus('Allocation must be 2 digits or less.');
      return false;
    }
    if (nextAllocated < used) {
      setStatus('Allocation cannot be below already-used leave.');
      return false;
    }
    try {
      setLeaveEntitlementBusy(true);
      await axios.put(`${API_BASE}/api/hr/leave-entitlements`, {
        employeeId: leaveEntitlementEmployeeId,
        year: leaveEntitlementYear,
        leaveType,
        allocated: nextAllocated
      }, { headers });
      setStatus('Leave entitlement updated.');
      await fetchLeaveEntitlements();
      await fetchAll(true);
      return true;
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to update leave entitlement.');
      return false;
    } finally {
      setLeaveEntitlementBusy(false);
    }
  };

  const saveLeaveEntitlement = async (leaveType, allocated) => {
    const saved = await updateLeaveEntitlement(leaveType, allocated);
    if (!saved) return;
    setEditingLeaveEntitlementType('');
    setEditingLeaveEntitlementOriginal(null);
  };

  const startLeaveEntitlementEdit = (row) => {
    setEditingLeaveEntitlementType(row.leaveType);
    setEditingLeaveEntitlementOriginal({ leaveType: row.leaveType, allocated: row.allocated ?? 0 });
  };

  const cancelLeaveEntitlementEdit = () => {
    if (editingLeaveEntitlementOriginal) {
      setLeaveEntitlementRows((prev) => {
        const existing = prev.find((entry) => entry.leaveType === editingLeaveEntitlementOriginal.leaveType);
        if (existing) {
          return prev.map((entry) => (
            entry.leaveType === editingLeaveEntitlementOriginal.leaveType
              ? { ...entry, allocated: editingLeaveEntitlementOriginal.allocated }
              : entry
          ));
        }
        return [...prev, {
          leaveType: editingLeaveEntitlementOriginal.leaveType,
          allocated: editingLeaveEntitlementOriginal.allocated,
          used: 0,
          pending: 0,
          available: editingLeaveEntitlementOriginal.allocated
        }];
      });
    }
    setEditingLeaveEntitlementType('');
    setEditingLeaveEntitlementOriginal(null);
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

  const cards = summary?.cards || {};
  const departmentChart = summary?.charts?.departmentEmployeeCount || [];
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
  const leaveTableMinWidth = hrLeaveColumns.reduce((sum, column) => sum + (getLeaveColumnWidth(column.key) || hrLeaveWidths[column.key] || 80), 0);
  const balanceTableMinWidth = hrBalanceColumns.reduce((sum, column) => sum + (getBalanceColumnWidth(column.key) || hrBalanceWidths[column.key] || 80), 0);
  const leaveTableStyle = { ...shell.table, minWidth: `${Math.max(920, leaveTableMinWidth)}px` };
  const balanceTableStyle = { ...shell.table, minWidth: `${Math.max(920, balanceTableMinWidth)}px` };
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

  const isMetricValue = (value) => value != null && typeof value !== 'boolean' && String(value).trim() !== '' && Number.isFinite(Number(value));
  const displayCount = (value) => isMetricValue(value) ? Number(value).toLocaleString('en-IN') : '—';
  const snapshotLoading = loadedSnapshotKey !== buildHrDashboardCacheKey({ month, year, filters });
  const overviewReady = !snapshotLoading && loadStates.overview === 'ready' && Boolean(summary);
  const leavePeriodReady = loadedLeavePeriod === `${year}-${month}`;
  const visibleLeaves = leavePeriodReady ? leaves : [];
  const visibleLeaveBalances = leavePeriodReady ? leaveBalances : [];
  const period = `${monthOptions.find((entry) => entry.value === month)?.label || month} ${year}`;
  const pendingRequests = leavePeriodReady && loadStates.leaves === 'ready' ? visibleLeaves.filter((entry) => entry.status === 'Pending').length : null;
  const metric = (label, value, caption, tone = 'blue', currency = false) => (
    <article className={`hr-metric ${tone}`} key={label}>
      <div className="hr-metric-icon">{currency ? <span aria-hidden="true">₹</span> : <Users size={18} />}</div>
      <h3>{label}</h3><strong>{isMetricValue(value) && overviewReady ? `${currency ? '₹' : ''}${currency ? money(value) : displayCount(value)}` : '—'}</strong><p>{!overviewReady ? busy || snapshotLoading ? 'Loading…' : 'Data unavailable' : !isMetricValue(value) && !caption.startsWith('Unavailable') ? 'Data unavailable' : caption}</p>
    </article>
  );
  if (!canViewHr) return <div role="status" style={shell.panel}>HR dashboard access is restricted to authorised HR users.</div>;
  return (
    <div className="hr-dashboard-page hr-live-overview">
      <div className="hr-heading"><div><p className="hr-eyebrow">PEOPLE &amp; WORKFORCE</p><h1>HR Dashboard</h1><p>Workforce, attendance, leave and monthly payroll.</p></div><span className="hr-period-label">{period}</span></div>
      {status ? <div role="status" className="hr-data-notice">{status}</div> : null}
      {Object.values(summary?.dataState || {}).includes('unavailable') ? <p role="status" className="hr-data-notice">Some source data is unavailable. Affected figures are not replaced with zero.</p> : null}
      {busy ? <p role="status" className="hr-data-note">Loading live HR data…</p> : null}
      {!summary && !busy ? <p role="status" className="hr-data-notice">Overview unavailable. No zero values have been substituted.</p> : null}
      <details className="hr-filter-panel" open={viewportWidth >= 768}><summary><h2>Snapshot filters</h2></summary><p>Department, role, location, workflow and search apply to snapshot cards and employee distribution. Leave requests use the selected month; entitlements use their own employee/year.</p><div className="hr-filters">
        <label>Month<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        <label>Year<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 101 }, (_, index) => 2000 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {['department', 'role', 'location', 'status'].map((key) => <label key={key}>{key === 'status' ? 'Workflow status' : key.charAt(0).toUpperCase() + key.slice(1)}<select value={filters[key]} onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}><option value="">All</option>{(filterOptions[key === 'department' ? 'departments' : key === 'role' ? 'roles' : key === 'location' ? 'locations' : 'statuses'] || []).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}
        <label>Search<input value={filters.search} placeholder="Search employees" onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} /></label>
      </div></details>
      <section className="hr-card-section"><div className="hr-section-title"><h2>Workforce &amp; today's records</h2><span>{summary?.attendanceReferenceDate || 'Date unavailable'} · {summary?.reportingTimeZone || 'Timezone unavailable'}</span></div><div className="hr-workforce-cards">
        {metric('Total Employees', cards.totalEmployees, 'All employment statuses')}
        {metric('Active Employees', cards.activeEmployees, 'Employment status: Active', 'green')}
        {metric('Present Today', cards.presentToday, 'Explicit recorded Present; half-days separate', 'teal')}
        {metric('Technicians On Duty', summary?.reviewRequired?.technicianDuty === false ? cards.techniciansOnDutyToday : null, summary?.reviewRequired?.technicianDuty === false ? 'Recorded technician duty' : 'Unavailable · technician role definition requires review')}
        {metric('Absent Today', summary?.reviewRequired?.absence === false ? cards.absentToday : null, summary?.reviewRequired?.absence === false ? 'Verified attendance coverage' : 'Unavailable · calendar and sync coverage require review', 'rose')}
        {metric('On Leave Today', cards.onLeaveToday, 'Recorded leave; not a verified approved-leave count', 'amber')}
      </div></section>
      <section className="hr-card-section"><div className="hr-section-title"><h2>Selected month</h2><span>{period} · separate from today's records</span></div><div className="hr-month-cards">
        {metric('Total Payroll (Month)', cards.totalPayrollCurrentMonth, 'Stored net payroll · snapshot filters applied', 'purple', true)}
        {metric('Pending Salary', cards.pendingSalaryPayments, 'Full net of non-Paid rows; partial-payment basis unverified', 'rose', true)}
        <article className="hr-metric amber"><div className="hr-metric-icon"><CalendarCheck size={18} /></div><h3>Pending Leave Requests</h3><strong>{displayCount(pendingRequests)}</strong><p>{!leavePeriodReady ? 'Loading selected month…' : loadStates.leaves === 'ready' ? 'All accessible requests starting in this month' : 'Leave requests unavailable'}</p></article>
      </div></section>
      <div className="hr-insights-grid">
        <section style={shell.panel}><h3 style={shell.panelTitle}><Users size={16} /> Department-wise Employee Count</h3><p style={shell.panelSub}>Uses role where department is not set.</p>{summary?.dataState?.employees === 'unavailable' || !overviewReady ? <p>Employee distribution unavailable.</p> : <MiniBarChart rows={departmentChart} nameKey="name" valueKey="value" color="var(--chart-target-bar)" />}</section>
        <section style={shell.panel}><h3 style={shell.panelTitle}><CalendarCheck size={16} /> Leave request status</h3><p style={shell.panelSub}>{period} · request counts, not leave days</p>{!leavePeriodReady ? <p>Loading selected month…</p> : loadStates.leaves !== 'ready' ? <p>Leave requests unavailable.</p> : <div className="hr-leave-status">{['Approved', 'Pending', 'Rejected'].map((value) => <div key={value}><span>{value}</span><strong>{visibleLeaves.filter((entry) => entry.status === value).length}</strong></div>)}</div>}</section>
        {summary?.dataState?.employees === 'unavailable' || !overviewReady ? <section style={shell.panel}><h3 style={shell.panelTitle}>Upcoming Birthdays</h3><p>Birthday data unavailable.</p></section> : <InsightList title="Upcoming Birthdays" rows={summary?.quickInsights?.upcomingBirthdays || []} />}
      </div>

      {summary?.reviewRequired?.conflictingAttendanceEmployees > 0 ? <p role="status" className="hr-data-notice">Attendance figures unavailable: some same-day records have conflicting statuses. No attendance records were changed.</p> : null}
      {summary?.reviewRequired?.unmatchedAttendanceRecords > 0 ? <p role="status" className="hr-data-notice">Attendance figures unavailable: some records do not match a current employee ID. No identity guesses were applied.</p> : null}
      {summary?.reviewRequired?.unmatchedPayrollRecords > 0 ? <p role="status" className="hr-data-notice">Payroll totals unavailable: some stored records do not match a current employee ID. No name matching or historical changes were applied.</p> : null}
      <section className="hr-leave-workspace" id="hr-leave-management">
        <div className="hr-actions-grid">
        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><CalendarCheck size={16} /> Leave Management</h3>
          <p style={shell.panelSub}>Approve/reject requests with leave balances visible per employee.</p>
          {leavePeriodReady && loadStates.leaves === 'ready' ? <div className="hr-pending-list">
            {visibleLeaves.filter((entry) => entry.status === 'Pending').length === 0 ? <p style={shell.panelSub}>No pending requests for this month.</p> : visibleLeaves.filter((entry) => entry.status === 'Pending').map((entry) => <article className="hr-pending-card" key={entry._id}>
              <div><strong>{entry.employeeName || entry.employeeCode || 'Employee unavailable'}</strong><p>{entry.displayLeaveType || entry.leaveType} · {entry.fromDate} to {entry.toDate} · {entry.days} days</p></div>
              <span style={shell.badge}>{entry.status}</span>
              {role.canManage ? <div className="hr-pending-actions"><button type="button" style={shell.btnLight} onClick={() => decideLeave(entry._id, 'approved')}>Approve</button><button type="button" style={shell.btnLight} onClick={() => decideLeave(entry._id, 'rejected')}>Reject</button></div> : null}
            </article>)}
          </div> : null}
          <details className="hr-leave-form-disclosure" id="hr-leave-form"><summary>Submit a leave request</summary>
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
            <div style={{ ...shell.field, alignSelf: 'end' }}><button type="button" style={shell.btn} disabled={loadStates.employees !== 'ready' || !leaveForm.employeeId} onClick={submitLeave}>Submit Leave</button></div>
          </div>

          </details>
          {!leavePeriodReady ? <p role="status">Loading selected month…</p> : loadStates.leaves !== 'ready' ? <p role="status">Leave requests unavailable.</p> : visibleLeaves.length === 0 ? <p>No leave requests for this month.</p> : null}
          <details className="hr-history-disclosure"><summary>Leave history · all statuses</summary>
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

          </details>
        </div>
        <aside className="hr-shortcut-panel" style={shell.panel}><h3 style={shell.panelTitle}>HR shortcuts</h3>
      <nav className="hr-shortcuts" aria-label="HR shortcuts"><Link to="/employees">Employee Master</Link><Link to="/attendance">View Attendance</Link><a href="#hr-leave-management">Review Leave Requests</a><Link to="/payroll">Open Payroll</Link><a href="#hr-leave-form" onClick={() => { const form = document.getElementById('hr-leave-form'); if (form) form.open = true; }}>Submit Leave</a><a href="#hr-entitlements">Leave Entitlements</a></nav>
        </aside>
        </div>
        <div className="hr-alloc-grid">
          <div style={{ ...shell.panel, boxShadow: 'none', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <h4 id="hr-entitlements" style={{ ...shell.panelTitle, fontSize: '14px' }}>Leave Entitlements</h4>
                <p style={shell.panelSub}>Calendar-year allocation for requestable casual and sick leave.</p>
              </div>
              {leaveEntitlementBusy ? <span style={shell.badge}>Saving...</span> : null}
            </div>
            <div style={leaveFormGridStyle}>
              <div style={shell.field}>
                <p style={shell.label}>Employee</p>
                <select style={shell.input} value={leaveEntitlementEmployeeId} onChange={(event) => setLeaveEntitlementEmployeeId(event.target.value)}>
                  {employees.map((employee) => <option key={employee._id} value={employee._id}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.empCode}</option>)}
                </select>
              </div>
              <div style={shell.field}>
                <p style={shell.label}>Year</p>
                <input
                  style={shell.input}
                  type="number"
                  min="2000"
                  max="2100"
                  value={leaveEntitlementYear}
                  onChange={(event) => setLeaveEntitlementYear(Number(event.target.value) || new Date().getFullYear())}
                />
              </div>
            </div>
            <div style={shell.tableWrap}>
              <table style={shell.table}>
                <thead>
                  <tr>
                    <th style={shell.th}>Leave Type</th>
                    <th style={{ ...shell.th, textAlign: 'center' }}>Allocated</th>
                    <th style={{ ...shell.th, textAlign: 'center' }}>Used</th>
                    <th style={{ ...shell.th, textAlign: 'center' }}>Pending</th>
                    <th style={{ ...shell.th, textAlign: 'center' }}>Available</th>
                    <th style={{ ...shell.th, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entitlementLeaveTypes.map((leaveType) => {
                    const row = leaveEntitlementRows.find((entry) => entry.leaveType === leaveType) || { leaveType, allocated: null, used: null, pending: null, available: null };
                    const isEditingEntitlement = editingLeaveEntitlementType === leaveType;
                    const actionDisabled = !role.canManage || leaveEntitlementBusy || entitlementState !== 'ready' || row.allocated == null;
                    return (
                      <tr key={leaveType}>
                        <td style={shell.td}>{leaveType}</td>
                        <td style={{ ...shell.td, textAlign: 'center' }}>
                          <input
                            style={{ ...shell.input, minHeight: '32px', textAlign: 'center' }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{0,2}"
                            maxLength={2}
                            value={normalizeLeaveEntitlementAllocationInput(row.allocated ?? '')}
                            onChange={(event) => setLeaveEntitlementRows((prev) => {
                              const nextValue = toLeaveEntitlementAllocation(event.target.value);
                              const existing = prev.find((entry) => entry.leaveType === leaveType);
                              if (existing) {
                                return prev.map((entry) => entry.leaveType === leaveType ? { ...entry, allocated: nextValue } : entry);
                              }
                              return [...prev, { ...row, allocated: nextValue }];
                            })}
                            disabled={!isEditingEntitlement || actionDisabled}
                          />
                        </td>
                        <td style={{ ...shell.td, textAlign: 'center' }}>{row.used ?? '—'}</td>
                        <td style={{ ...shell.td, textAlign: 'center' }}>{row.pending ?? '—'}</td>
                        <td style={{ ...shell.td, textAlign: 'center' }}>{row.available ?? '—'}</td>
                        <td style={{ ...shell.td, textAlign: 'center' }}>
                          {isEditingEntitlement ? (
                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={{
                                  ...shell.btn,
                                  minHeight: '32px',
                                  height: '32px',
                                  ...(actionDisabled ? shell.iconActionBtnDisabled : {})
                                }}
                                disabled={actionDisabled}
                                onClick={() => saveLeaveEntitlement(leaveType, row.allocated ?? 0)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...shell.btnLight,
                                  minHeight: '32px',
                                  height: '32px',
                                  ...(actionDisabled ? shell.iconActionBtnDisabled : {})
                                }}
                                disabled={actionDisabled}
                                onClick={cancelLeaveEntitlementEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              style={{
                                ...shell.iconActionBtn,
                                ...(actionDisabled ? shell.iconActionBtnDisabled : {})
                              }}
                              disabled={actionDisabled}
                              onClick={() => startLeaveEntitlementEdit(row)}
                              aria-label={`Edit ${leaveType} entitlement`}
                              title="Edit entitlement"
                            >
                              <Pencil size={16} strokeWidth={2.4} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <section style={shell.panel}><h3 style={shell.panelTitle}>Employee leave balances</h3>
          {!leavePeriodReady ? <p role="status">Loading selected month…</p> : loadStates.balances !== 'ready' ? <p role="status">Leave balances unavailable.</p> : visibleLeaveBalances.length === 0 ? <p>No leave balances available for this month.</p> : null}
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
                  <th style={headStyle(getBalanceColumnWidth, 'casual', 'center')}>Casual Available</th>
                  <th style={headStyle(getBalanceColumnWidth, 'sick', 'center')}>Sick Leave Balance</th>
                  <th style={headStyle(getBalanceColumnWidth, 'pending', 'center')}>Pending</th>
                  <th style={headStyle(getBalanceColumnWidth, 'unpaid', 'center')}>Unpaid Used</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeaveBalances.map((entry) => (
                  <tr key={entry.employeeId}>
                    <td style={bodyStyle(getBalanceColumnWidth, 'employee')}>{entry.employeeName}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'casual', 'center')}>{entry.paidLeave?.balance ?? '—'}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'sick', 'center')}>{entry.sickLeave?.balance ?? '—'}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'pending', 'center')}>{entry.paidLeave?.pending != null && entry.sickLeave?.pending != null ? Number(entry.paidLeave.pending) + Number(entry.sickLeave.pending) : '—'}</td>
                    <td style={bodyStyle(getBalanceColumnWidth, 'unpaid', 'center')}>{entry.unpaidLeave?.used ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </section>
        </div>
      </section>

    </div>
  );
}
