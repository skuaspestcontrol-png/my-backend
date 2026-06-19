import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import PdfPreviewModal from './PdfPreviewModal';
import { subscribeRenewalsRefresh } from '../pages/sales-performance/salesPerformanceApi';
import { getPortalUserName } from '../utils/portalAuth';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  XCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const RENEWAL_PAGE_SIZE = 20;
const RENEWAL_DASHBOARD_CACHE_KEY = 'renewal_dashboard_cache_v1';
const statuses = ['All', 'Pending', 'Follow-up', 'Done', 'Declined', 'Overdue'];
const ranges = [
  { value: 'threeMonths', label: 'Coming 3 Months' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'nextMonth', label: 'Next Month' },
  { value: 'custom', label: 'Custom Month' },
  { value: 'year', label: 'Year Wise' }
];
const tabs = ['Renewal Dashboard', 'Renewal Letters', 'Renewal List', 'Month Wise View', 'Year Wise View', 'Sales Person Wise View'];
const renewalColumns = [
  { key: 'customer', label: 'Customer' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'area', label: 'Area' },
  { key: 'svc', label: 'Svc' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'previousAmount', label: 'Prev Amt' },
  { key: 'proposedAmount', label: 'Proposed' },
  { key: 'salesPerson', label: 'Sales' },
  { key: 'status', label: 'Status' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'actions', label: 'Actions' }
];
const renewalDefaultWidths = {
  customer: 180,
  mobile: 120,
  area: 130,
  svc: 90,
  start: 110,
  end: 110,
  previousAmount: 110,
  proposedAmount: 120,
  salesPerson: 120,
  status: 100,
  followup: 150,
  actions: 218
};
const renewalColumnBounds = {
  customer: { min: 150, max: 260 },
  mobile: { min: 100, max: 160 },
  area: { min: 110, max: 200 },
  svc: { min: 80, max: 120 },
  start: { min: 90, max: 140 },
  end: { min: 90, max: 140 },
  previousAmount: { min: 100, max: 160 },
  proposedAmount: { min: 100, max: 170 },
  salesPerson: { min: 110, max: 180 },
  status: { min: 90, max: 150 },
  followup: { min: 130, max: 220 },
  actions: { min: 180, max: 260 }
};

const shell = {
  page: { display: 'grid', gap: 12, fontFamily: 'var(--font-sans)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 13, fontWeight: 650 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' },
  primaryBtn: { minHeight: 34, height: 34, border: 'none', borderRadius: 9, padding: '0 12px', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' },
  ghostBtn: { minHeight: 34, height: 34, border: '1px solid #d1d5db', borderRadius: 9, padding: '0 12px', background: '#fff', color: '#1f2937', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' },
  dangerBtn: { minHeight: 34, border: '1px solid #fecaca', borderRadius: 9, padding: '0 12px', background: '#fff1f2', color: '#b91c1c', fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  panel: { border: '1px solid var(--color-border)', borderRadius: 12, background: '#fff', overflow: 'hidden', boxShadow: '0 10px 28px rgba(15, 23, 42, 0.04)' },
  panelPad: { padding: 12 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: 7 },
  stat: { border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 9px', background: '#fff', minHeight: 82, display: 'grid', alignContent: 'space-between', minWidth: 0 },
  statLabel: { fontSize: 9.5, lineHeight: 1.25, textTransform: 'uppercase', color: '#64748b', fontWeight: 800, letterSpacing: 0, whiteSpace: 'normal', overflow: 'hidden' },
  statValue: { marginTop: 4, fontSize: 20, lineHeight: 1.05, fontWeight: 850, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 8, alignItems: 'end' },
  field: { display: 'grid', gap: 4 },
  label: { fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' },
  input: { width: '100%', minHeight: 34, height: 34, border: '1px solid #d1d5db', borderRadius: 11, background: '#fff', color: '#111827', fontSize: 14, fontWeight: 500, padding: '0 12px', boxSizing: 'border-box' },
  tabs: { display: 'flex', gap: 6, padding: 8, overflowX: 'auto', borderBottom: '1px solid var(--color-border)' },
  tabsMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: 10, overflowX: 'visible', borderBottom: '1px solid var(--color-border)' },
  tab: { flex: '0 0 auto', border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: '#475569', minHeight: 30, padding: '0 10px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer' },
  tabMobile: { width: '100%', minHeight: 44, padding: '8px 10px', whiteSpace: 'normal', lineHeight: 1.2, textAlign: 'center', justifyContent: 'center' },
  activeTab: { background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderColor: 'var(--color-primary-soft)' },
  tableWrap: { width: '100%', overflowX: 'auto', overflowY: 'hidden' },
  table: { width: '100%', minWidth: 1080, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '8px 7px', fontSize: 11, color: '#64748b', fontWeight: 850, textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', letterSpacing: '0.03em', lineHeight: 1.25, minHeight: '42px', height: 'auto' },
  td: { padding: '7px', fontSize: 11.5, color: '#1f2937', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 },
  rowActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 5, flexWrap: 'nowrap' },
  iconBtn: { width: 30, height: 30, minWidth: 30, minHeight: 30, padding: 0, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  status: { display: 'inline-flex', alignItems: 'center', minHeight: 24, borderRadius: 999, padding: '0 8px', fontSize: 11, fontWeight: 850 },
  chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 },
  miniRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 70px 90px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 },
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', padding: 14 },
  modal: { width: 'min(760px, 96vw)', maxHeight: '92vh', background: '#fff', borderRadius: 16, border: '1px solid var(--color-border)', boxShadow: '0 24px 70px rgba(15,23,42,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHead: { minHeight: 60, padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, fontWeight: 800 },
  modalBody: { padding: 18, display: 'grid', gap: 12, overflowY: 'auto' },
  mobileCard: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8, background: '#fff' },
  mobileMeta: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#475569' },
  mobileCustomerStack: { display: 'grid', gap: 2, alignItems: 'start', minWidth: 0 },
  mobileCustomerName: { margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' },
  mobileCustomerMobile: { fontSize: 12, color: '#64748b', fontWeight: 700, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pagination: { padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: '#fff' },
  paginationInfo: { color: '#64748b', fontSize: 12, fontWeight: 700 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  paginationBtn: { width: 34, minWidth: 34, minHeight: 32, height: 32, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: 'var(--color-primary)', padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  paginationBtnDisabled: { opacity: 0.48, cursor: 'not-allowed' }
};

const formatDate = (value) => {
  if (!value) return '-';
  const raw = String(value).slice(0, 10);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) return `${parts[3]}/${parts[2]}/${parts[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN');
};
const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const serviceShort = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const known = {
    'cockroach control': 'CC',
    'termite control': 'TC',
    'general pest control': 'GPC',
    'rodent control': 'RC',
    'bed bug control': 'BBC',
    'mosquito control': 'MC',
    'wood borer control': 'WBC'
  };
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  if (known[normalized]) return known[normalized];
  return text
    .split(/[\s/&+-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
};
const statusStyle = (status) => {
  const map = {
    Done: ['#dcfce7', '#166534'],
    Declined: ['#fee2e2', '#991b1b'],
    Overdue: ['#ffedd5', '#9a3412'],
    'Follow-up': ['#dbeafe', '#1d4ed8'],
    Pending: ['#f1f5f9', '#334155']
  };
  const [bg, color] = map[status] || map.Pending;
  return { ...shell.status, background: bg, color };
};
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 'all', label: 'All' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2026, i, 1).toLocaleString('en-IN', { month: 'short' }) }))
];

const readRenewalDashboardCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(RENEWAL_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mergeRenewalDashboardCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readRenewalDashboardCache() || {};
    window.sessionStorage.setItem(RENEWAL_DASHBOARD_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best effort only.
  }
};

export default function RenewalDashboard() {
  const autoSyncAttempted = useRef(false);
  const autoGeneratedLetterIds = useRef(new Set());
  const [cachedDashboard] = useState(() => readRenewalDashboardCache());
  const [rows, setRows] = useState(() => Array.isArray(cachedDashboard?.rows) ? cachedDashboard.rows : []);
  const [summary, setSummary] = useState(() => (cachedDashboard?.summary && typeof cachedDashboard.summary === 'object' ? cachedDashboard.summary : {}));
  const [employees, setEmployees] = useState(() => Array.isArray(cachedDashboard?.employees) ? cachedDashboard.employees : []);
  const [letters, setLetters] = useState(() => Array.isArray(cachedDashboard?.letters) ? cachedDashboard.letters : []);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [loading, setLoading] = useState(() => !cachedDashboard);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState({ type: '', row: null });
  const [form, setForm] = useState({});
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', renewalId: '', shareContext: null });
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    range: 'threeMonths',
    month: new Date().getMonth() + 1,
    year: currentYear,
    fromDate: '',
    toDate: '',
    status: 'All',
    assignedSalesPersonId: '',
    search: ''
  });
  const loadRequestRef = useRef(0);
  const sortedLetters = useMemo(() => {
    const toLetterDateValue = (letter) => {
      const raw = letter?.conclude_date || letter?.concludeDate || letter?.generated_at || letter?.generatedAt || '';
      const date = raw ? new Date(raw) : null;
      return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
    };
    return [...(letters || [])].sort((a, b) => {
      const left = toLetterDateValue(a);
      const right = toLetterDateValue(b);
      if (left === right) return String(a.customer_name || '').localeCompare(String(b.customer_name || ''));
      return left - right;
    });
  }, [letters]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 760);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadData = async (overrideFilters = filters, options = {}) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    try {
      if (!options.silent) setLoading(true);
      const params = { ...overrideFilters, t: Date.now() };
      const [renewalRes, summaryRes, employeeRes, letterRes] = await Promise.all([
        axios.get(`${API_BASE}/api/renewals`, { params }),
        axios.get(`${API_BASE}/api/renewals/summary`, { params }),
        axios.get(`${API_BASE}/api/employees`, { params: { t: Date.now() } }),
        axios.get(`${API_BASE}/api/renewals/letters`, { params: { t: Date.now() } }).catch(() => ({ data: [] }))
      ]);
      if (loadRequestRef.current !== requestId) return;
      const renewalRows = Array.isArray(renewalRes.data) ? renewalRes.data : [];
      const letterRows = Array.isArray(letterRes.data) ? letterRes.data : [];
      setRows(renewalRows);
      setSummary(summaryRes.data || {});
      setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      setLetters(letterRows);
      mergeRenewalDashboardCache({
        rows: renewalRows,
        summary: summaryRes.data || {},
        employees: Array.isArray(employeeRes.data) ? employeeRes.data : [],
        letters: letterRows
      });
      if (options.autoSync && !autoSyncAttempted.current && Array.isArray(renewalRes.data) && renewalRes.data.length === 0) {
        autoSyncAttempted.current = true;
        await axios.post(`${API_BASE}/api/renewals/sync`);
        return loadData(overrideFilters, { autoSync: false });
      }
      if (options.autoGenerateLetters !== false) {
        const letterRenewalIds = new Set(letterRows.map((letter) => String(letter.renewal_id || letter.renewalId || '').trim()).filter(Boolean));
        const missingLetterRows = renewalRows.filter((row) => {
          const renewalId = String(row.renewalId || '').trim();
          if (!renewalId) return false;
          if (row.renewalLetterUrl || letterRenewalIds.has(renewalId)) return false;
          return !autoGeneratedLetterIds.current.has(renewalId);
        });
        if (missingLetterRows.length > 0) {
          missingLetterRows.forEach((row) => autoGeneratedLetterIds.current.add(String(row.renewalId || '').trim()));
          const results = await Promise.allSettled(
            missingLetterRows.map((row) => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/generate-letter`))
          );
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              autoGeneratedLetterIds.current.delete(String(missingLetterRows[index]?.renewalId || '').trim());
            }
          });
          if (results.some((result) => result.status === 'fulfilled')) {
            const [renewalRefresh, letterRefresh] = await Promise.all([
              axios.get(`${API_BASE}/api/renewals`, { params: { ...overrideFilters, t: Date.now() } }),
              axios.get(`${API_BASE}/api/renewals/letters`, { params: { t: Date.now() } }).catch(() => ({ data: [] }))
            ]);
            if (loadRequestRef.current !== requestId) return;
            setRows(Array.isArray(renewalRefresh.data) ? renewalRefresh.data : renewalRows);
            setLetters(Array.isArray(letterRefresh.data) ? letterRefresh.data : letterRows);
            mergeRenewalDashboardCache({
              rows: Array.isArray(renewalRefresh.data) ? renewalRefresh.data : renewalRows,
              summary: summaryRes.data || {},
              employees: Array.isArray(employeeRes.data) ? employeeRes.data : [],
              letters: Array.isArray(letterRefresh.data) ? letterRefresh.data : letterRows
            });
          }
        }
      }
    } catch (error) {
      console.error('Renewal load failed', error);
      setMessage(error?.response?.data?.error || 'Unable to load renewals right now.');
    } finally {
      if (loadRequestRef.current === requestId && !options.silent) setLoading(false);
    }
  };

  const openRenewalPdfPreview = (row) => {
    const titleName = String(row?.customerName || row?.customer_name || 'Customer').trim();
    const pdfUrl = String(row?.renewalLetterUrl ? `${API_BASE}${row.renewalLetterUrl}` : row?.pdf_url ? `${API_BASE}${row.pdf_url}` : '').trim();
    if (!pdfUrl) return;
    const fileLabel = String(row?.renewalDisplayId || row?.renewal_display_id || titleName || row?.renewalId || row?.renewal_id || 'renewal-letter').trim();
    const downloadName = `REN-${titleName || fileLabel || 'Renewal'}.pdf`;
    setPdfPreview({
      open: true,
      title: `Renewal Letter - ${titleName}`,
      pdfUrl,
      downloadFileName: downloadName,
      publicShareUrl: pdfUrl,
      renewalId: String(row?.renewalId || row?.renewal_id || row?.id || '').trim(),
      shareContext: {
        customerName: titleName,
        customerEmail: String(row?.email || row?.customerEmail || row?.customer_email || '').trim(),
        customerPhone: String(row?.mobile || row?.phone || '').trim(),
        renewalDisplayId: fileLabel,
        serviceType: String(row?.serviceType || row?.service_type || 'Renewal Letter').trim() || 'Renewal Letter',
        pdfUrl
      }
    });
  };

  const shareRenewalLetterByEmail = async () => {
    const context = pdfPreview.shareContext || {};
    const defaultEmail = String(context.customerEmail || '').trim();
    const recipientEmail = String(window.prompt('Enter recipient email', defaultEmail) || '').trim();
    if (!recipientEmail) return;

    const customerName = String(context.customerName || 'Customer').trim() || 'Customer';
    const renewalDisplayId = String(context.renewalDisplayId || pdfPreview.title.replace(/^Renewal Letter -\s*/i, '') || 'Renewal').trim();
    const shareUrl = String(pdfPreview.publicShareUrl || pdfPreview.pdfUrl || '').trim();
    const subject = `Renewal Letter - ${renewalDisplayId} from SKUAS Pest Control`;
    const body = `
      <div style="font-family:Arial,sans-serif;color:#111827;font-size:14px;line-height:1.5">
        <p>Dear ${customerName},</p>
        <p>Please find attached your renewal letter for <strong>${renewalDisplayId}</strong>.</p>
        ${shareUrl ? `<p>PDF link: <a href="${shareUrl}" target="_blank" rel="noreferrer">${shareUrl}</a></p>` : ''}
        <p>Regards,<br/>SKUAS Pest Control</p>
      </div>
    `;

    try {
      const response = await axios.post(`${API_BASE}/api/email/send`, {
        moduleType: 'renewal',
        moduleName: 'Renewal Letter',
        templateType: 'custom_email',
        recipientEmail,
        recipientName: customerName,
        recipientType: 'Customer',
        sentByUser: getPortalUserName() || 'User',
        subject,
        body,
        attachmentUrl: shareUrl,
        attachmentName: `REN-${String(context.customerName || renewalDisplayId || 'Renewal').trim()}.pdf`,
        contextData: {
          customer_name: customerName,
          customer_email: recipientEmail,
          customer_phone: String(context.customerPhone || '').trim(),
          service_type: String(context.serviceType || 'Renewal Letter').trim(),
          address: '',
          company_name: 'SKUAS Pest Control'
        }
      });
      window.alert(response.data?.success ? 'Renewal letter email sent successfully.' : 'Renewal letter email queued.');
    } catch (error) {
      console.error('Failed to send renewal letter email', error);
      window.alert(error?.response?.data?.error || 'Could not send renewal letter email.');
    }
  };

  useEffect(() => {
    const initialLoad = async () => {
      try {
        if (!cachedDashboard) {
          autoSyncAttempted.current = true;
          await axios.post(`${API_BASE}/api/renewals/sync`);
        }
      } catch (error) {
        console.error('Initial renewal sync skipped', error);
      }
      await loadData(filters, { autoSync: false, silent: Boolean(cachedDashboard) });
    };
    initialLoad();
  }, [cachedDashboard]);

  useEffect(() => subscribeRenewalsRefresh(() => {
    void loadData(filters, { autoSync: false, autoGenerateLetters: false });
  }), [filters]);

  useAutoRefresh(() => loadData(filters, { autoSync: false, autoGenerateLetters: false }), { enabled: !modal.type });

  const salesPeople = useMemo(() => {
    const list = employees
      .filter((employee) => String(employee.role || employee.roleName || '').toLowerCase().includes('sales'))
      .map((employee) => ({
        id: employee._id || employee.empCode || employee.id || '',
        name: employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || employee.empCode || 'Sales Person'
      }));
    const assigned = rows
      .filter((row) => row.assignedSalesPersonName)
      .map((row) => ({ id: row.assignedSalesPersonId || row.assignedSalesPersonName, name: row.assignedSalesPersonName }));
    const seenNames = new Set();
    const seenIds = new Set();
    return [...list, ...assigned].filter((person) => {
      const nameKey = String(person.name || '').trim().toLowerCase();
      const idKey = String(person.id || '').trim().toLowerCase();
      if (!nameKey) return false;
      if (seenNames.has(nameKey)) return false;
      if (idKey && seenIds.has(idKey)) return false;
      seenNames.add(nameKey);
      if (idKey) seenIds.add(idKey);
      return true;
    });
  }, [employees, rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / RENEWAL_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * RENEWAL_PAGE_SIZE;
    return rows.slice(start, start + RENEWAL_PAGE_SIZE);
  }, [rows, safePage]);
  const firstRecord = rows.length ? ((safePage - 1) * RENEWAL_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * RENEWAL_PAGE_SIZE, rows.length);
  const paginationText = rows.length ? `${firstRecord}-${lastRecord} of ${rows.length} records` : '0 records';
  const paginationStyle = isMobile ? { ...shell.pagination, flexDirection: 'column', alignItems: 'stretch' } : shell.pagination;
  const paginationActionsStyle = isMobile ? { ...shell.paginationActions, justifyContent: 'flex-end' } : shell.paginationActions;

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);
  const {
    getColumnWidth,
    startResize,
    resetColumns: resetRenewalColumns
  } = useColumnResize({
    storageKey: 'renewal_column_widths',
    columns: renewalColumns.map((column) => column.key),
    defaultColumnWidths: renewalDefaultWidths,
    columnBounds: renewalColumnBounds,
    minWidth: 80,
  });

  const renewalTableMinWidth = renewalColumns.reduce((sum, column) => sum + (getColumnWidth(column.key) || renewalDefaultWidths[column.key] || 80), 0);
  const renewalTableStyle = {
    ...shell.table,
    minWidth: `${Math.max(1080, renewalTableMinWidth)}px`,
    width: '100%'
  };
  const renewalHeadCellStyle = (key, align = 'left') => ({
    ...shell.th,
    position: 'relative',
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const renewalBodyCellStyle = (key, align = 'left') => ({
    ...shell.td,
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const renewalActionCellStyle = {
    ...renewalBodyCellStyle('actions', 'left'),
    overflow: 'visible'
  };

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const openModal = (type, row) => {
    setModal({ type, row });
    setForm({
      salesPersonId: row?.assignedSalesPersonId || '',
      salesPersonName: row?.assignedSalesPersonName || '',
      followupDate: row?.followupDate || '',
      note: row?.lastFollowupNote || '',
      finalAmount: row?.finalRenewalAmount || row?.proposedAmount || '',
      renewedBySalesPersonId: row?.assignedSalesPersonId || '',
      renewedBySalesPersonName: row?.assignedSalesPersonName || '',
      reason: '',
      serviceType: row?.serviceType || '',
      renewalDueDate: row?.renewalDueDate || '',
      proposedAmount: row?.proposedAmount || '',
      status: row?.status || 'Pending',
      contractStartDate: '',
      contractEndDate: '',
      amount: row?.finalRenewalAmount || row?.proposedAmount || ''
    });
  };
  const closeModal = () => setModal({ type: '', row: null });
  const runAction = async (label, callback) => {
    try {
      setBusy(true);
      const response = await callback();
      setMessage(response?.data?.message || label);
      closeModal();
      await loadData();
    } catch (error) {
      console.error(label, error);
      setMessage(error?.response?.data?.error || `Unable to complete: ${label}`);
    } finally {
      setBusy(false);
    }
  };
  const syncRenewals = () => runAction('Renewal synced successfully', () => axios.post(`${API_BASE}/api/renewals/sync`));
  const deleteRenewal = (row) => {
    if (!row?.renewalId) return;
    if (!window.confirm(`Delete renewal ${row.renewalId}?`)) return;
    runAction('Renewal deleted', () => axios.delete(`${API_BASE}/api/renewals/${row.renewalId}`));
  };
  const applyFilters = () => {
    setPage(1);
    loadData();
  };
  const resetFilters = () => {
    const next = { range: 'threeMonths', month: new Date().getMonth() + 1, year: currentYear, fromDate: '', toDate: '', status: 'All', assignedSalesPersonId: '', search: '' };
    setPage(1);
    setFilters(next);
    loadData(next);
  };

  const stats = [
    ['Total Renewals', summary.totalRenewals || 0],
    ['Total Renewal Amount', formatINR(summary.totalRenewalAmount || 0)],
    ['No. of Customers', summary.customerCount || 0],
    ['Renewal Done', summary.doneCount || 0],
    ['Pending Renewal', summary.pendingCount || 0],
    ['Declined Renewal', summary.declinedCount || 0],
    ['Follow-up Renewals', summary.followupCount || 0],
    ['Overdue Renewals', summary.overdueCount || 0],
    ['Assigned Sales Person', summary.assignedSalesPersonCount || 0]
  ];

  const renderFilters = () => (
    <div style={shell.panel}>
      <div style={{ ...shell.panelPad, ...shell.filters, gridTemplateColumns: isMobile ? '1fr' : shell.filters.gridTemplateColumns }}>
        <label style={shell.field}><span style={shell.label}>Range</span><select style={shell.input} value={filters.range} onChange={(e) => updateFilter('range', e.target.value)}>{ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Month</span><select style={shell.input} value={filters.month} onChange={(e) => updateFilter('month', e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Year</span><select style={shell.input} value={filters.year} onChange={(e) => updateFilter('year', e.target.value)}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Status</span><select style={shell.input} value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Sales Person</span><select style={shell.input} value={filters.assignedSalesPersonId} onChange={(e) => updateFilter('assignedSalesPersonId', e.target.value)}><option value="">All Sales</option>{salesPeople.map((p) => <option key={p.id || p.name} value={p.id || p.name}>{p.name}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Search</span><span style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 8, top: 10, color: '#94a3b8' }} /><input style={{ ...shell.input, paddingLeft: 28 }} value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} placeholder="Customer/mobile/service" /></span></label>
        <div style={{ ...shell.actions, justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
          <button type="button" style={shell.primaryBtn} onClick={applyFilters}>Apply</button>
          <button type="button" style={shell.ghostBtn} onClick={resetFilters}>Reset</button>
        </div>
      </div>
    </div>
  );

  const renderRows = () => {
    const displayRenewalId = (row) => row.renewalDisplayId || row.renewal_display_id || row.renewalId || row.renewal_id || '';
    if (isMobile) {
      return (
        <div style={{ display: 'grid', gap: 8, padding: 10 }}>
          {pagedRows.map((row) => (
            <div key={row.renewalId} style={shell.mobileCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={shell.mobileCustomerStack}>
                  <strong style={shell.mobileCustomerName}>{row.customerName}</strong>
                  <span style={shell.mobileCustomerMobile}>{row.mobile || '-'}</span>
                </div>
                <span style={statusStyle(row.status)}>{row.status}</span>
              </div>
              <div style={shell.mobileMeta}>
                <span>Conclude Date: {formatDate(row.previousContractEnd || row.renewalDueDate)}</span>
                <span style={{ textAlign: 'center', justifySelf: 'center', width: '100%' }} title={row.serviceType}>{serviceShort(row.serviceType)}</span>
                <span>{formatINR(row.proposedAmount)}</span>
              </div>
              <div style={{ ...shell.rowActions, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <button style={shell.ghostBtn} onClick={() => openModal('view', row)}>View</button>
                <button style={shell.ghostBtn} onClick={() => openModal('assign', row)}>Assign</button>
                <button style={shell.ghostBtn} onClick={() => openModal('followup', row)}>Follow-up</button>
                <button style={shell.primaryBtn} onClick={() => openModal('done', row)}>Done</button>
                <button style={shell.dangerBtn} onClick={() => deleteRenewal(row)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={shell.tableWrap}>
        <table className="crm-compact-table" style={renewalTableStyle}>
          <colgroup>
            {renewalColumns.map((column) => (
              <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={renewalHeadCellStyle('customer')}>Customer</th>
              <th style={renewalHeadCellStyle('mobile', 'center')}>Mobile</th>
              <th style={renewalHeadCellStyle('area')}>Area</th>
              <th style={renewalHeadCellStyle('svc', 'center')}>Svc</th>
              <th style={renewalHeadCellStyle('start', 'center')}>Start</th>
              <th style={renewalHeadCellStyle('end', 'center')}>End</th>
              <th style={renewalHeadCellStyle('previousAmount', 'center')}>Prev Amt</th>
              <th style={renewalHeadCellStyle('proposedAmount', 'center')}>Proposed</th>
              <th style={renewalHeadCellStyle('salesPerson')}>Sales</th>
              <th style={renewalHeadCellStyle('status', 'center')}>Status</th>
              <th style={renewalHeadCellStyle('followup', 'center')}>Follow-up</th>
              <th style={renewalHeadCellStyle('actions', 'center')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr key={row.renewalId}>
                <td style={renewalBodyCellStyle('customer')} title={`${row.customerName} • ${displayRenewalId(row)}`}><strong>{row.customerName}</strong></td>
                <td style={renewalBodyCellStyle('mobile', 'center')}>{row.mobile || '-'}</td>
                <td style={renewalBodyCellStyle('area')} title={`${row.address || ''} ${row.areaName || ''}`}>{row.areaName || row.address || '-'}</td>
                <td style={renewalBodyCellStyle('svc', 'center')} title={row.serviceType}>{serviceShort(row.serviceType)}</td>
                <td style={renewalBodyCellStyle('start', 'center')}>{formatDate(row.previousContractStart)}</td>
                <td style={renewalBodyCellStyle('end', 'center')}>{formatDate(row.previousContractEnd)}</td>
                <td style={renewalBodyCellStyle('previousAmount', 'center')}>{formatINR(row.previousAmount)}</td>
                <td style={renewalBodyCellStyle('proposedAmount', 'center')}>{formatINR(row.proposedAmount)}</td>
                <td style={renewalBodyCellStyle('salesPerson')} title={row.assignedSalesPersonName}>{row.assignedSalesPersonName || '-'}</td>
                <td style={renewalBodyCellStyle('status', 'center')}><span style={statusStyle(row.status)}>{row.status}</span></td>
                <td style={renewalBodyCellStyle('followup', 'center')} title={row.lastFollowupNote}>{formatDate(row.followupDate)} {row.lastFollowupNote ? `- ${row.lastFollowupNote}` : ''}</td>
                <td style={renewalActionCellStyle}>
                  <div style={shell.rowActions}>
                    <button className="crm-icon-action-btn" style={shell.iconBtn} title="View" onClick={() => openModal('view', row)}><FileText size={15} /></button>
                    <button className="crm-icon-action-btn" style={shell.iconBtn} title="Assign Sales Person" onClick={() => openModal('assign', row)}><UserCheck size={15} /></button>
                    <button className="crm-icon-action-btn" style={shell.iconBtn} title="Log Follow-up" onClick={() => openModal('followup', row)}><CalendarClock size={15} /></button>
                    <button className="crm-icon-action-btn" style={shell.iconBtn} title="Mark Done" onClick={() => openModal('done', row)}><CheckCircle2 size={15} /></button>
                    <button className="crm-icon-action-btn" style={{ ...shell.iconBtn, color: '#b91c1c', borderColor: '#fecaca' }} title="Decline" onClick={() => openModal('decline', row)}><XCircle size={15} /></button>
                    <button className="crm-icon-action-btn" style={{ ...shell.iconBtn, color: '#b91c1c', borderColor: '#fecaca' }} title="Delete Renewal" onClick={() => deleteRenewal(row)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={paginationStyle}>
          <div style={shell.paginationInfo}>{paginationText}</div>
          <div style={paginationActionsStyle}>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryList = (items, labelKey, valueKey = 'count') => (
    <div style={shell.panel}>
      <div style={shell.panelPad}>
        {(items || []).length === 0 ? <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>No records.</p> : items.map((item) => (
          <div key={item[labelKey] || item.name} style={shell.miniRow}>
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item[labelKey] || item.name}</strong>
            <span>{item[valueKey] ?? item.total ?? 0}</span>
            <span>{formatINR(item.amount || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderModal = () => {
    if (!modal.type || !modal.row) return null;
    const row = modal.row;
    const displayRenewalId = row.renewalDisplayId || row.renewal_display_id || row.renewalId || row.renewal_id || '';
    const titleMap = { view: 'Renewal Details', edit: 'Edit Renewal', assign: 'Assign Sales Person', followup: 'Log Follow-up', done: 'Mark Renewal Done', decline: 'Decline Renewal', convert: 'Convert to Contract' };
    return (
      <div style={shell.modalOverlay}>
        <div style={shell.modal}>
          <div style={shell.modalHead}><strong>{titleMap[modal.type]}</strong><button style={shell.iconBtn} onClick={closeModal}>×</button></div>
          <div style={shell.modalBody}>
            {modal.type === 'view' && (
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <strong>{row.customerName}</strong>
                <span>Renewal ID: {displayRenewalId || '-'}</span>
                <span>Mobile: {row.mobile || '-'}</span>
                <span>Service: {row.serviceType || '-'}</span>
                <span>Conclude Date: {formatDate(row.previousContractEnd || row.renewalDueDate)}</span>
                <span>Proposed Amount: {formatINR(row.proposedAmount)}</span>
                <span>Sales Person: {row.assignedSalesPersonName || '-'}</span>
                {row.renewalLetterUrl ? <a href={`${API_BASE}${row.renewalLetterUrl}`} onClick={(event) => { event.preventDefault(); openRenewalPdfPreview(row); }} rel="noreferrer">Open renewal letter</a> : null}
                <button style={shell.ghostBtn} onClick={() => openModal('edit', row)}>Edit Renewal</button>
                {row.status === 'Done' && !row.convertedContractId ? <button style={shell.primaryBtn} onClick={() => openModal('convert', row)}>Convert to New Contract</button> : null}
              </div>
            )}
            {modal.type === 'edit' && (
              <>
                <label style={shell.field}><span style={shell.label}>Service Type</span><input style={shell.input} value={form.serviceType} onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Renewal Due Date</span><input type="date" style={shell.input} value={form.renewalDueDate} onChange={(e) => setForm((p) => ({ ...p, renewalDueDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Proposed Amount</span><input style={shell.input} value={form.proposedAmount} onChange={(e) => setForm((p) => ({ ...p, proposedAmount: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Status</span><select style={shell.input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>{statuses.filter((s) => s !== 'All').map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Renewal updated', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/edit`, form))}>Save Renewal</button>
              </>
            )}
            {modal.type === 'assign' && (
              <>
                <label style={shell.field}><span style={shell.label}>Sales Person</span><select style={shell.input} value={form.salesPersonId} onChange={(e) => {
                  const selected = salesPeople.find((p) => String(p.id || p.name) === e.target.value);
                  setForm((prev) => ({ ...prev, salesPersonId: e.target.value, salesPersonName: selected?.name || '' }));
                }}><option value="">Select sales person</option>{salesPeople.map((p) => <option key={p.id || p.name} value={p.id || p.name}>{p.name}</option>)}</select></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Sales person assigned', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/assign`, form))}>Assign</button>
              </>
            )}
            {modal.type === 'followup' && (
              <>
                <label style={shell.field}><span style={shell.label}>Follow-up Date</span><input type="date" style={shell.input} value={form.followupDate} onChange={(e) => setForm((p) => ({ ...p, followupDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Note</span><textarea style={{ ...shell.input, height: 86, paddingTop: 8 }} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} /></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Follow-up saved', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/followup`, form))}>Save Follow-up</button>
              </>
            )}
            {modal.type === 'done' && (
              <>
                <label style={shell.field}><span style={shell.label}>Final Amount</span><input style={shell.input} value={form.finalAmount} onChange={(e) => setForm((p) => ({ ...p, finalAmount: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Notes</span><textarea style={{ ...shell.input, height: 76, paddingTop: 8 }} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value, notes: e.target.value }))} /></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Renewal marked done', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/mark-done`, form))}>Mark Done</button>
              </>
            )}
            {modal.type === 'decline' && (
              <>
                <label style={shell.field}><span style={shell.label}>Decline Reason</span><textarea style={{ ...shell.input, height: 86, paddingTop: 8 }} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} /></label>
                <button style={shell.dangerBtn} disabled={busy} onClick={() => runAction('Renewal declined', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/decline`, form))}>Mark Declined</button>
              </>
            )}
            {modal.type === 'convert' && (
              <>
                <label style={shell.field}><span style={shell.label}>New Contract Start</span><input type="date" style={shell.input} value={form.contractStartDate} onChange={(e) => setForm((p) => ({ ...p, contractStartDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>New Contract End</span><input type="date" style={shell.input} value={form.contractEndDate} onChange={(e) => setForm((p) => ({ ...p, contractEndDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Amount</span><input style={shell.input} value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Converted to contract', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/convert-contract`, form))}>Convert to Contract</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={shell.page}>
      <div style={shell.hero}>
        <div>
          <h1 style={shell.title}>Renewal Dashboard</h1>
          <p style={shell.subtitle}>Expired and expiring customer contracts, follow-ups, renewal letters, and conversion tracking.</p>
        </div>
        <div style={shell.actions}>
          <button type="button" style={shell.ghostBtn} onClick={loadData}><RefreshCw size={15} />Refresh</button>
          <button type="button" style={shell.primaryBtn} onClick={syncRenewals}><RefreshCw size={15} />Sync Renewals</button>
        </div>
      </div>

      {message ? <div style={{ ...shell.panelPad, border: '1px solid var(--color-primary-soft)', borderRadius: 10, background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', fontSize: 13, fontWeight: 800 }}>{message}</div> : null}

      <section style={isMobile ? { ...shell.stats, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.stats}>
        {stats.map(([label, value]) => <div key={label} style={shell.stat}><div style={shell.statLabel}>{label}</div><div style={shell.statValue}>{value}</div></div>)}
      </section>

      {renderFilters()}

      <section style={shell.panel}>
        <div style={isMobile ? shell.tabsMobile : shell.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              style={{
                ...shell.tab,
                ...(isMobile ? shell.tabMobile : {}),
                ...(activeTab === tab ? shell.activeTab : {})
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {loading ? <div style={shell.panelPad}>Loading renewals...</div> : null}
        {!loading && (activeTab === 'Renewal Dashboard' || activeTab === 'Renewal List') ? renderRows() : null}
        {!loading && activeTab === 'Month Wise View' ? <div style={shell.chartGrid}>{renderSummaryList(summary.monthWiseSummary, 'period')}</div> : null}
        {!loading && activeTab === 'Year Wise View' ? <div style={shell.chartGrid}>{renderSummaryList(summary.yearWiseSummary, 'year')}</div> : null}
        {!loading && activeTab === 'Sales Person Wise View' ? <div style={shell.chartGrid}>{renderSummaryList(summary.salespersonWiseSummary, 'name', 'total')}</div> : null}
        {!loading && activeTab === 'Renewal Letters' ? (
          <div style={shell.panelPad}>
            {(sortedLetters || []).length === 0 ? <p style={{ margin: 0, color: '#64748b' }}>No renewal letters generated yet.</p> : sortedLetters.map((letter) => (
              <div key={letter.id || letter.pdf_url} style={shell.miniRow}>
                <strong>{letter.customer_name || '-'}</strong>
                <span>{formatDate(letter.conclude_date || letter.concludeDate || letter.generated_at)}</span>
                <a href={`${API_BASE}${letter.pdf_url}`} onClick={(event) => { event.preventDefault(); openRenewalPdfPreview(letter); }} rel="noreferrer">Open PDF</a>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', renewalId: '', shareContext: null })}
        onShareEmail={shareRenewalLetterByEmail}
        publicShareUrl={pdfPreview.publicShareUrl}
      />
      {renderModal()}
    </div>
  );
}
