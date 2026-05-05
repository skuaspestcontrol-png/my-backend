import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BadgeIndianRupee,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  FileText,
  LayoutGrid,
  MapPin,
  Package,
  Receipt,
  RefreshCcw,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  Wallet,
  X,
  XCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const statusStyles = {
  Active: { background: 'rgba(22,163,74,0.16)', color: '#166534' },
  Upcoming: { background: 'rgba(159,23,77,0.16)', color: 'var(--color-primary-dark)' },
  'Expiring Soon': { background: 'rgba(217,119,6,0.16)', color: '#92400e' },
  Expired: { background: 'rgba(220,38,38,0.16)', color: '#991b1b' },
  Renewed: { background: 'rgba(8,145,178,0.16)', color: '#155e75' }
};

const quickFilterStyles = {
  All: { background: 'rgba(71,85,105,0.12)', color: '#334155' },
  Active: { background: 'rgba(22,163,74,0.16)', color: '#166534' },
  Upcoming: { background: 'rgba(159,23,77,0.16)', color: 'var(--color-primary-dark)' },
  'Expiring Soon': { background: 'rgba(217,119,6,0.16)', color: '#92400e' },
  Expired: { background: 'rgba(220,38,38,0.16)', color: '#991b1b' },
  Renewed: { background: 'rgba(8,145,178,0.16)', color: '#155e75' }
};

const shell = {
  page: {
    display: 'grid',
    gap: '10px',
    width: '100%',
    boxSizing: 'border-box',
    padding: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    overflow: 'hidden'
  },
  head: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: '10px' },
  titleWrap: { display: 'grid', gap: '2px', minWidth: 0 },
  title: { margin: 0, fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  subtitle: { margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 600 },
  headActions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  beta: { border: '1px solid rgba(159,23,77,0.2)', background: 'rgba(252,231,243,0.6)', color: 'var(--color-primary)', borderRadius: '999px', padding: '7px 12px', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' },
  newBtn: { border: '1px solid var(--color-primary-dark)', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  card: { background: 'var(--surface-elevated, #fff)', border: '1px solid var(--color-border)', borderRadius: '14px', overflow: 'hidden' },
  cardTop: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'var(--surface-soft, #f8fafc)' },
  cardTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text)' },
  shownPill: { border: '1px solid var(--color-border)', background: '#f8fafc', color: '#334155', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: 800 },
  quickWrap: { padding: '8px 12px 0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  quickLabel: { fontSize: '12px', fontWeight: 800, color: '#64748b' },
  chip: { border: '1px solid transparent', borderRadius: '999px', padding: '5px 10px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', gap: '6px', alignItems: 'center', cursor: 'pointer' },
  customizeChip: { border: '1px solid #F9A8D4', borderRadius: '999px', padding: '5px 10px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', gap: '6px', alignItems: 'center', cursor: 'pointer', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' },
  customizeMenu: { position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '198px', background: '#fff', border: '1px solid var(--color-primary-soft)', borderRadius: '10px', boxShadow: '0 12px 26px rgba(15,23,42,0.12)', padding: '8px', zIndex: 50, display: 'grid', gap: '6px' },
  customizeTitle: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' },
  customizeRow: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#334155', fontWeight: 700 },
  filtersBox: { margin: '8px 12px 10px', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '8px', display: 'grid', gap: '8px', background: 'var(--surface-elevated, #fff)' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  filterField: { display: 'grid', gap: '4px' },
  filterLabel: { fontSize: '11px', color: '#64748b', fontWeight: 800 },
  input: { width: '100%', minHeight: '30px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '0 8px', fontSize: '12px', color: '#334155', background: '#fff' },
  clearBtn: { alignSelf: 'end', minHeight: '30px', borderRadius: '8px', border: '1px solid #F9A8D4', background: '#fff', color: 'var(--color-primary-dark)', fontWeight: 800, padding: '0 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', borderTop: '1px solid var(--color-border)', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' },
  th: { textAlign: 'left', verticalAlign: 'middle', fontSize: '9px', fontWeight: 800, color: '#6b7280', padding: '8px 6px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis' },
  td: { textAlign: 'left', verticalAlign: 'middle', padding: '8px 6px', borderBottom: '1px solid #eef2f7', fontSize: '10px', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: '#fff' },
  selectedRow: { background: 'transparent' },
  selectedCell: { background: '#f1f5f9' },
  selectedText: { color: '#111827' },
  subText: { marginTop: '1px', fontSize: '9px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusPill: { borderRadius: '999px', padding: '3px 7px', fontSize: '9px', fontWeight: 800, display: 'inline-block' },
  typePill: { borderRadius: '8px', padding: '3px 7px', fontSize: '9px', fontWeight: 800, background: 'rgba(34,197,94,0.2)', color: '#15803d' },
  amountGreen: { color: '#16a34a', fontWeight: 800 },
  amountRed: { color: '#dc2626', fontWeight: 800 },
  actionBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '8px', minHeight: '24px', padding: '0 7px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' },
  footer: { padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  footText: { fontSize: '12px', color: '#475569', fontWeight: 700 },
  pager: { display: 'inline-flex', gap: '6px', alignItems: 'center' },
  pageBtn: { minWidth: '34px', height: '34px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#475569', fontWeight: 700 },
  pageBtnActive: { border: '1px solid rgba(22,163,74,0.35)', background: 'rgba(22,163,74,0.16)', color: '#15803d', fontWeight: 800 },
  workspace: { background: 'var(--surface-elevated, #fff)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '12px 14px', display: 'grid', gap: '10px' },
  workspaceTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  workspaceNote: { margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 600 },
  workspaceActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  subtleBtn: { minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', fontWeight: 700, padding: '0 12px', cursor: 'pointer' },
  printBtn: { minHeight: '34px', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.35)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, padding: '0 12px', cursor: 'pointer' },
  tabs: { display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' },
  tab: { border: '1px solid transparent', borderRadius: '10px', background: '#fff', color: '#64748b', fontSize: '13px', fontWeight: 700, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', cursor: 'pointer' },
  tabActive: { borderColor: '#F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' },
  loading: { padding: '20px 16px', color: '#64748b', fontSize: '14px', fontWeight: 600 },
  empty: { padding: '24px 16px', textAlign: 'center', color: '#64748b', fontWeight: 700 },
  actionCell: { display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  miniBtn: { border: '1px solid #F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', minHeight: '28px', padding: '0 8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
  ,
  customerLinkBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    width: '100%',
    textAlign: 'left',
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    overflow: 'visible',
    textOverflow: 'clip',
    whiteSpace: 'normal',
    lineHeight: 1.25,
    wordBreak: 'break-word'
  },
  mobileList: { display: 'grid', gap: '8px', padding: '10px' },
  mobileCard: { border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px', background: '#fff', display: 'grid', gap: '8px' },
  mobileCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
  mobileContractNo: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#111827' },
  mobileCustomer: { margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' },
  mobileMetaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  mobileMetaLabel: { fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  mobileMetaValue: { fontSize: '12px', color: '#1f2937', fontWeight: 700 },
  mobileActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modalCard: { width: 'min(860px, 100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: '14px', border: '1px solid var(--color-primary-soft)', boxShadow: '0 22px 54px rgba(15,23,42,0.2)' },
  modalHead: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  modalSub: { margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 },
  modalClose: { border: '1px solid #D1D5DB', background: '#fff', color: '#475569', borderRadius: '8px', minWidth: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalBody: { padding: '12px 14px', display: 'grid', gap: '10px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
  summaryCard: { border: '1px solid var(--color-primary-soft)', background: '#FDF2F8', borderRadius: '10px', padding: '8px 10px', textAlign: 'left' },
  summaryLabel: { fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '5px' },
  summaryValue: { marginTop: '2px', fontSize: '18px', fontWeight: 800, color: '#0f172a' },
  modalToggleBtn: { border: '1px solid #F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', minHeight: '30px', padding: '0 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content' },
  detailSection: { border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' },
  detailHead: { padding: '8px 10px', background: 'var(--surface-soft, #f8fafc)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, color: 'var(--text)' , textTransform: 'uppercase' },
  detailTable: { width: '100%', borderCollapse: 'collapse' },
  detailTh: { fontSize: '10px', fontWeight: 800, color: '#64748b', textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--color-border)', background: 'var(--surface-elevated, #fff)' },
  detailTd: { fontSize: '12px', color: 'var(--text)', padding: '7px 10px', borderBottom: '1px solid #f1f5f9', background: 'var(--surface-elevated, #fff)' },
  detailBtn: { border: '1px solid #F9A8D4', background: '#fff', color: 'var(--color-primary-dark)', borderRadius: '7px', minHeight: '26px', padding: '0 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' },
  suggestionBox: { border: '1px dashed #F9A8D4', borderRadius: '10px', background: '#FDF2F8', padding: '8px 10px', fontSize: '12px', color: '#334155', textAlign: 'left' }
};

const normalizeName = (value) => String(value || '').trim().toLowerCase();
const normalize = (value) => String(value || '').toLowerCase().trim();
const getSearchText = (item) => {
  return [
    item.name,
    item.displayName,
    item.customerName,
    item.companyName,
    item.contactPersonName,
    item.title,
    item.mobileNumber,
    item.mobile,
    item.whatsappNumber,
    item.email,
    item.emailId,
    item.billingArea,
    item.area,
    item.areaName,
    item.city,
    item.state,
    item.pincode,
    item.billingAddress,
    item.shippingAddress,
    item.customer,
    item.contractNo,
    item.contractCode,
    item.property
  ]
    .map(normalize)
    .join(' ');
};

const parseDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toInputDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const dt = parseDateOnly(value);
  if (!dt) return '-';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatINR = (num) => `₹${Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const deriveContractCode = (contractNo) => {
  const raw = String(contractNo || '').trim();
  if (!raw) return '-';
  const swapped = raw.replace(/\/(?:C?INV)\/\d+$/i, '/C');
  if (swapped !== raw) return swapped;
  const bits = raw.split('/').filter(Boolean);
  if (bits.length <= 1) return raw;
  return `${bits.slice(0, -1).join('/')}/C`;
};

const deriveContractStatus = (invoiceStatus, startDate, endDate) => {
  const statusText = String(invoiceStatus || '').trim().toLowerCase();
  if (statusText.includes('renew')) return 'Renewed';

  const today = parseDateOnly(new Date());
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (start && today && start > today) return 'Upcoming';
  if (end && today && end < today) return 'Expired';
  if (end && today) {
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 30) return 'Expiring Soon';
  }
  return 'Active';
};

const openInvoicePdf = (invoiceId) => {
  if (!invoiceId) return;
  const href = `${API_BASE}/api/invoices/${invoiceId}/pdf`;
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const openContractJobCardPdf = (invoiceId) => {
  if (!invoiceId) return;
  window.open(`${API_BASE}/api/contracts/${invoiceId}/job-card-pdf`, '_blank', 'noopener,noreferrer');
};

export default function ContractDashboard() {
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [quickFilter, setQuickFilter] = useState('All');
  const [filters, setFilters] = useState({ status: 'All Status', type: 'All Type', from: '', to: '', search: '' });
  const [activeTab, setActiveTab] = useState('Overview');
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [serviceSchedules, setServiceSchedules] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [actionMenu, setActionMenu] = useState(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    contractNo: true,
    customer: true,
    property: true,
    duration: true,
    services: true,
    status: true,
    total: true,
    paid: true,
    due: true
  });
  const [customerSummary, setCustomerSummary] = useState({ open: false, row: null, showHistory: false });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [invoiceRes, customerRes, schedulesRes, paymentsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/invoices`),
          axios.get(`${API_BASE}/api/customers`),
          axios.get(`${API_BASE}/api/service-schedules`),
          axios.get(`${API_BASE}/api/payments`)
        ]);

        if (!mounted) return;

        const nextInvoices = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
        const nextCustomers = Array.isArray(customerRes.data) ? customerRes.data : [];
        const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
        const nextPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
        setInvoices(nextInvoices);
        setCustomers(nextCustomers);
        setServiceSchedules(nextSchedules);
        setPayments(nextPayments);
      } catch (error) {
        console.error('Failed to load contracts dashboard data', error);
        if (!mounted) return;
        setLoadError('Unable to fetch contracts right now. Please refresh once.');
        setInvoices([]);
        setCustomers([]);
        setServiceSchedules([]);
        setPayments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      const target = event.target;
      const insideActionTrigger = target && typeof target.closest === 'function'
        ? target.closest('[data-contract-row-action="true"]')
        : null;
      const insideActionMenu = target && typeof target.closest === 'function'
        ? target.closest('[data-contract-action-menu="true"]')
        : null;
      const insideCustomize = target && typeof target.closest === 'function'
        ? target.closest('[data-contract-customize="true"]')
        : null;
      if (actionMenu && !insideActionTrigger && !insideActionMenu) setActionMenu(null);
      if (showCustomize && !insideCustomize) setShowCustomize(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionMenu, showCustomize]);

  useEffect(() => {
    const clearMenu = () => setActionMenu(null);
    window.addEventListener('resize', clearMenu);
    window.addEventListener('scroll', clearMenu, true);
    return () => {
      window.removeEventListener('resize', clearMenu);
      window.removeEventListener('scroll', clearMenu, true);
    };
  }, []);

  const customerIndex = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    customers.forEach((customer) => {
      if (customer?._id) byId.set(String(customer._id), customer);
      const display = normalizeName(customer?.displayName || customer?.name);
      if (display && !byName.has(display)) byName.set(display, customer);
    });
    return { byId, byName };
  }, [customers]);

  const scheduleIndex = useMemo(() => {
    const byInvoiceId = new Map();
    const byInvoiceNumber = new Map();
    const today = parseDateOnly(new Date());

    serviceSchedules.forEach((schedule) => {
      const invoiceId = String(schedule?.invoiceId || '').trim();
      const invoiceNumber = String(schedule?.invoiceNumber || '').trim().toLowerCase();
      const status = String(schedule?.status || '').trim().toLowerCase();
      const serviceDate = parseDateOnly(schedule?.serviceDate);
      if (!serviceDate) return;

      const applyTo = (target) => {
        const current = target || { total: 0, completed: 0, nextServiceDate: '', nextServiceTime: '' };
        current.total += 1;
        if (status.includes('complete')) current.completed += 1;

        const isClosed = status.includes('complete') || status.includes('cancel');
        if (!isClosed && serviceDate >= today) {
          const nextKnown = parseDateOnly(current.nextServiceDate);
          if (!nextKnown || serviceDate < nextKnown) {
            current.nextServiceDate = toInputDate(serviceDate);
            current.nextServiceTime = String(schedule?.serviceTime || '').trim();
          }
        }
        return current;
      };

      if (invoiceId) byInvoiceId.set(invoiceId, applyTo(byInvoiceId.get(invoiceId)));
      if (invoiceNumber) byInvoiceNumber.set(invoiceNumber, applyTo(byInvoiceNumber.get(invoiceNumber)));
    });

    return { byInvoiceId, byInvoiceNumber };
  }, [serviceSchedules]);

  const allContracts = useMemo(() => {
    return invoices.map((invoice, index) => {
      const lines = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [{}];
      const startCandidates = lines
        .map((line) => line.contractStartDate || line.serviceStartDate || invoice.servicePeriodStart || invoice.date)
        .filter(Boolean);
      const endCandidates = lines
        .map((line) => line.contractEndDate || line.serviceEndDate || line.renewalDate || invoice.servicePeriodEnd)
        .filter(Boolean);

      const parsedStarts = startCandidates.map(parseDateOnly).filter(Boolean);
      const parsedEnds = endCandidates.map(parseDateOnly).filter(Boolean);

      const startDate = parsedStarts.length > 0 ? new Date(Math.min(...parsedStarts.map((date) => date.getTime()))) : parseDateOnly(invoice.date);
      const endDate = parsedEnds.length > 0 ? new Date(Math.max(...parsedEnds.map((date) => date.getTime()))) : startDate;

      const customerById = invoice.customerId ? customerIndex.byId.get(String(invoice.customerId)) : null;
      const customerByName = customerIndex.byName.get(normalizeName(invoice.customerName));
      const customer = customerById || customerByName || null;

      const total = Number(invoice.total ?? invoice.amount ?? 0);
      const due = Math.max(0, Number(invoice.balanceDue ?? 0));
      const paid = Math.max(0, total - due);

      const normalizedInvoiceType = String(invoice.invoiceType || '').trim().toUpperCase();
      const type = normalizedInvoiceType === 'NON GST' ? 'Non GST' : (Number(invoice.totalTax || 0) > 0 ? 'GST' : 'Non GST');
      const startInputDate = toInputDate(startDate);
      const endInputDate = toInputDate(endDate || startDate);

      const contractNo = String(invoice.invoiceNumber || '').trim() || `CONTRACT-${index + 1}`;
      const serviceMeta = scheduleIndex.byInvoiceId.get(String(invoice._id || ''))
        || scheduleIndex.byInvoiceNumber.get(contractNo.toLowerCase())
        || { total: lines.length, completed: 0, nextServiceDate: '', nextServiceTime: '' };

      return {
        id: String(invoice._id || contractNo || index),
        invoiceId: invoice._id,
        contractNo,
        contractCode: deriveContractCode(contractNo),
        customer: String(invoice.customerName || customer?.displayName || customer?.name || 'Customer'),
        mobile: String(customer?.mobileNumber || customer?.workPhone || '').trim(),
        property: String(customer?.billingArea || customer?.shippingArea || customer?.billingAddress || customer?.shippingAddress || invoice.customerName || '-').trim(),
        city: String(customer?.billingState || customer?.shippingState || '-').trim(),
        startDate: startInputDate,
        endDate: endInputDate,
        services: Math.max(0, Number(serviceMeta.total || lines.length)),
        servicesDone: Math.max(0, Number(serviceMeta.completed || 0)),
        nextServiceDate: serviceMeta.nextServiceDate || '',
        nextServiceTime: serviceMeta.nextServiceTime || '',
        status: deriveContractStatus(invoice.status, startInputDate, endInputDate),
        type,
        total,
        paid,
        due
      };
    });
  }, [customerIndex.byId, customerIndex.byName, invoices, scheduleIndex.byInvoiceId, scheduleIndex.byInvoiceNumber]);

  useEffect(() => {
    if (!selectedContractId && allContracts.length > 0) {
      setSelectedContractId(allContracts[0].id);
      return;
    }
    if (selectedContractId && !allContracts.some((entry) => entry.id === selectedContractId)) {
      setSelectedContractId(allContracts[0]?.id || '');
    }
  }, [allContracts, selectedContractId]);

  const typeOptions = useMemo(() => {
    const uniqueTypes = Array.from(new Set(allContracts.map((row) => row.type).filter(Boolean)));
    return ['All Type', ...uniqueTypes];
  }, [allContracts]);

  const filteredContracts = useMemo(() => {
    return allContracts.filter((row) => {
      if (quickFilter !== 'All' && row.status !== quickFilter) return false;
      if (filters.status !== 'All Status' && row.status !== filters.status) return false;
      if (filters.type !== 'All Type' && row.type !== filters.type) return false;
      if (filters.from && row.startDate && row.startDate < filters.from) return false;
      if (filters.to && row.startDate && row.startDate > filters.to) return false;

      const search = normalize(filters.search);
      if (search && !getSearchText(row).includes(search)) return false;
      return true;
    });
  }, [allContracts, filters, quickFilter]);

  const sortedContracts = useMemo(() => filteredContracts, [filteredContracts]);

  const customerSummaryData = useMemo(() => {
    if (!customerSummary?.row) return null;
    const baseName = normalizeName(customerSummary.row.customer);
    const relatedInvoices = invoices.filter((invoice) => {
      const invoiceName = normalizeName(invoice?.customerName);
      if (invoiceName && invoiceName === baseName) return true;
      return customerSummary.row.invoiceId && String(invoice?._id) === String(customerSummary.row.invoiceId);
    });

    const invoiceIdSet = new Set(relatedInvoices.map((entry) => String(entry?._id || '')).filter(Boolean));
    const invoiceNoSet = new Set(relatedInvoices.map((entry) => normalizeName(entry?.invoiceNumber)).filter(Boolean));

    const relatedPayments = payments.filter((payment) => {
      const payInvoiceId = String(payment?.invoiceId || '');
      const payInvoiceNo = normalizeName(payment?.invoiceNumber);
      const payCustomer = normalizeName(payment?.customerName);
      if (payInvoiceId && invoiceIdSet.has(payInvoiceId)) return true;
      if (payInvoiceNo && invoiceNoSet.has(payInvoiceNo)) return true;
      return payCustomer && payCustomer === baseName;
    });

    const totalInvoiced = relatedInvoices.reduce((sum, entry) => sum + Number(entry?.total || entry?.amount || 0), 0);
    const totalPaid = relatedPayments.reduce((sum, entry) => sum + Number(entry?.amount || 0), 0);
    const balanceDue = Math.max(0, relatedInvoices.reduce((sum, entry) => sum + Number(entry?.balanceDue || 0), 0));
    const transactionCount = relatedPayments.length;
    const complaintsCount = 0;

    return {
      relatedInvoices,
      relatedPayments,
      totalInvoiced,
      totalPaid,
      balanceDue,
      transactionCount,
      complaintsCount
    };
  }, [customerSummary?.row, invoices, payments]);

  const summaryCounts = useMemo(() => {
    const counts = { All: allContracts.length, Active: 0, Upcoming: 0, 'Expiring Soon': 0, Expired: 0, Renewed: 0 };
    allContracts.forEach((row) => {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    return counts;
  }, [allContracts]);

  const selectedContract = useMemo(
    () => allContracts.find((row) => row.id === selectedContractId) || sortedContracts[0] || allContracts[0] || null,
    [allContracts, selectedContractId, sortedContracts]
  );

  const tabs = [
    { label: 'Overview', icon: LayoutGrid },
    { label: 'Schedules', icon: CalendarRange },
    { label: 'Payments', icon: BadgeIndianRupee },
    { label: 'Invoices', icon: Receipt },
    { label: 'Material Usage', icon: Package },
    { label: 'Site Media', icon: MapPin }
  ];

  const quickFilters = [
    { label: 'All', icon: Filter },
    { label: 'Active', icon: CheckCircle2 },
    { label: 'Upcoming', icon: CalendarDays },
    { label: 'Expiring Soon', icon: TriangleAlert },
    { label: 'Expired', icon: XCircle },
    { label: 'Renewed', icon: RefreshCcw }
  ];
  const customColumns = [
    { key: 'contractNo', label: 'Contract #' },
    { key: 'customer', label: 'Customer' },
    { key: 'property', label: 'Property' },
    { key: 'duration', label: 'Duration' },
    { key: 'services', label: 'Services' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Total (₹)' },
    { key: 'paid', label: 'Paid (₹)' },
    { key: 'due', label: 'Due (₹)' }
  ];
  const isMobile = viewportWidth <= 768;
  const quickWrapStyle = isMobile ? { ...shell.quickWrap, alignItems: 'stretch' } : shell.quickWrap;
  const filterGridStyle = isMobile ? { ...shell.filterGrid, gridTemplateColumns: '1fr' } : shell.filterGrid;
  const tableWrapStyle = isMobile ? { ...shell.tableWrap, WebkitOverflowScrolling: 'touch' } : shell.tableWrap;
  const tableStyle = isMobile ? { ...shell.table, minWidth: '100%', tableLayout: 'fixed' } : shell.table;
  const footerStyle = isMobile ? { ...shell.footer, flexDirection: 'column', alignItems: 'stretch' } : shell.footer;
  const pagerStyle = isMobile ? { ...shell.pager, justifyContent: 'center' } : shell.pager;

  const openCustomerSummary = (row) => {
    setCustomerSummary({ open: true, row, showHistory: false });
  };

  const deleteContract = async (row) => {
    if (!row?.invoiceId) return;
    const ok = window.confirm(`Delete contract ${row.contractNo}?`);
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE}/api/invoices/${row.invoiceId}`);
      setInvoices((prev) => prev.filter((invoice) => String(invoice._id) !== String(row.invoiceId)));
      setActionMenu(null);
    } catch (error) {
      console.error('Failed to delete contract', error);
      window.alert('Unable to delete contract right now.');
    }
  };

  const handleTabClick = (tabLabel) => {
    setActiveTab(tabLabel);
    if (!selectedContract) return;

    if (tabLabel === 'Payments') {
      navigate('/sales/payment-received', { state: { openContractNumber: selectedContract.contractNo } });
      return;
    }
    if (tabLabel === 'Invoices') {
      navigate('/sales/invoices', { state: { openInvoiceNumber: selectedContract.contractNo } });
      return;
    }
    if (tabLabel === 'Schedules') {
      navigate('/schedule-job', { state: { customerName: selectedContract.customer, contractNumber: selectedContract.contractNo } });
    }
  };

  const renderBody = () => {
    if (loading) {
      return <div style={shell.loading}>Loading contracts...</div>;
    }
    if (loadError) {
      return <div style={shell.empty}>{loadError}</div>;
    }
    if (sortedContracts.length === 0) {
      return <div style={shell.empty}>No contracts match your current filters.</div>;
    }
    if (isMobile) {
      return (
        <div style={shell.mobileList}>
          {sortedContracts.map((row) => {
            const statusTone = statusStyles[row.status] || statusStyles.Active;
            return (
              <div key={row.id} style={shell.mobileCard}>
                <div style={shell.mobileCardTop}>
                  <div>
                    <p style={shell.mobileContractNo}>{row.contractNo}</p>
                    <p style={shell.mobileCustomer}>{row.customer}</p>
                  </div>
                  <span style={{ ...shell.statusPill, ...statusTone }}>{row.status.toUpperCase()}</span>
                </div>
                <div style={shell.mobileMetaGrid}>
                  <div><div style={shell.mobileMetaLabel}>Property</div><div style={shell.mobileMetaValue}>{row.property || '-'}</div></div>
                  <div><div style={shell.mobileMetaLabel}>Start</div><div style={shell.mobileMetaValue}>{formatDate(row.startDate)}</div></div>
                  <div><div style={shell.mobileMetaLabel}>Total</div><div style={shell.mobileMetaValue}>{formatINR(row.total)}</div></div>
                  <div><div style={shell.mobileMetaLabel}>Due</div><div style={shell.mobileMetaValue}>{formatINR(row.due)}</div></div>
                </div>
                <div style={shell.mobileActions}>
                  <button type="button" style={shell.actionBtn} onClick={() => navigate('/sales/invoices', { state: { openInvoiceNumber: row.contractNo, fromContract: true } })}>View</button>
                  <button type="button" style={shell.actionBtn} onClick={() => openInvoicePdf(row.invoiceId)}>Invoice PDF</button>
                  <button type="button" style={shell.actionBtn} onClick={() => openContractJobCardPdf(row.invoiceId)}>Job Card</button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...shell.th, width: '3%' }}>#</th>
            {visibleColumns.contractNo ? (
              <th style={{ ...shell.th, width: '10%', minWidth: '120px' }}>Contract #</th>
            ) : null}
            {visibleColumns.customer ? (
              <th style={{ ...shell.th, width: '14%', textAlign: 'left' }}>Customer</th>
            ) : null}
            {visibleColumns.property ? <th style={{ ...shell.th, width: '10%' }}>Property</th> : null}
            {visibleColumns.duration ? <th style={{ ...shell.th, width: '12%' }}>Duration</th> : null}
            {visibleColumns.services ? <th style={{ ...shell.th, width: '8%' }}>Services</th> : null}
            {visibleColumns.status ? <th style={{ ...shell.th, width: '8%' }}>Status</th> : null}
            {visibleColumns.total ? <th style={{ ...shell.th, width: '9%' }}>Total (₹)</th> : null}
            {visibleColumns.paid ? <th style={{ ...shell.th, width: '9%' }}>Paid (₹)</th> : null}
            {visibleColumns.due ? <th style={{ ...shell.th, width: '8%' }}>Due (₹)</th> : null}
            <th style={{ ...shell.th, width: '13%' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedContracts.map((row, index) => {
            const selected = row.id === selectedContract?.id;
            const statusTone = statusStyles[row.status] || statusStyles.Active;
            return (
              <tr key={row.id} onClick={() => setSelectedContractId(row.id)} style={selected ? shell.selectedRow : undefined}>
                <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>{index + 1}</td>
                {visibleColumns.contractNo ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.contractNo}</div>
                </td> : null}
                {visibleColumns.customer ? <td style={{ ...shell.td, textAlign: 'left', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  {row.status === 'Active' ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCustomerSummary(row);
                      }}
                      style={{ ...shell.customerLinkBtn, color: '#111827' }}
                    >
                      {row.customer}
                    </button>
                  ) : (
                    <div style={{ fontSize: '11px', fontWeight: 700, overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal', lineHeight: 1.25, wordBreak: 'break-word' }}>{row.customer}</div>
                  )}
                  {String(row.customer || '').trim().length <= 24 ? (
                    <div style={{ ...shell.subText }}>{row.mobile || '-'}</div>
                  ) : null}
                </td> : null}
                {visibleColumns.property ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.property || '-'}</div>
                  <div style={{ ...shell.subText }}>{row.city || '-'}</div>
                </td> : null}
                {visibleColumns.duration ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>{formatDate(row.startDate)}</div>
                  <div style={{ ...shell.subText }}>{`to ${formatDate(row.endDate)}`}</div>
                </td> : null}
                {visibleColumns.services ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <span style={{ ...shell.shownPill, background: '#eef2f7', color: '#334155', borderColor: 'var(--color-border)' }}>{row.services}</span>
                </td> : null}
                {visibleColumns.status ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <span style={{ ...shell.statusPill, ...statusTone }}>{row.status.toUpperCase()}</span>
                </td> : null}
                {visibleColumns.total ? <td style={{ ...shell.td, fontWeight: 800, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>{formatINR(row.total)}</td> : null}
                {visibleColumns.paid ? <td style={{ ...shell.td, ...(selected ? shell.selectedCell : {}), ...(row.paid > 0 ? shell.amountGreen : (selected ? shell.selectedText : {})) }}>{formatINR(row.paid)}</td> : null}
                {visibleColumns.due ? <td style={{ ...shell.td, ...(selected ? shell.selectedCell : {}), ...(row.due > 0 ? shell.amountRed : (selected ? shell.selectedText : {})) }}>{formatINR(row.due)}</td> : null}
                <td style={{ ...shell.td, ...(selected ? shell.selectedCell : {}) }}>
                  <div style={{ position: 'relative', display: 'inline-flex' }} data-contract-row-action="true">
                    <button
                      type="button"
                      style={shell.actionBtn}
                      onClick={(event) => {
                        event.stopPropagation();
                        const menuWidth = 142;
                        const menuHeight = 136;
                        const rect = event.currentTarget.getBoundingClientRect();
                        const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
                        const top = rect.top >= menuHeight + 8 ? rect.top - menuHeight - 6 : rect.bottom + 6;
                        setActionMenu((prev) => (prev?.rowId === row.id ? null : { rowId: row.id, row, top, left }));
                      }}
                    >
                      Actions
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={shell.page}>
      <div style={shell.card}>
        <div style={shell.cardTop}>
          <h3 style={shell.cardTitle}>All Contracts</h3>
          <div style={shell.headActions}>
            <button
              type="button"
              style={shell.newBtn}
              onClick={() => navigate('/sales/invoices', { state: { openNewInvoice: true } })}
            >
              + New Contract
            </button>
          </div>
        </div>

        <div style={quickWrapStyle}>
          <span style={shell.quickLabel}>Quick Filters:</span>
          {quickFilters.map((entry) => {
            const Icon = entry.icon;
            const active = quickFilter === entry.label;
            const tone = quickFilterStyles[entry.label] || quickFilterStyles.All;
            return (
              <button
                key={entry.label}
                type="button"
                onClick={() => setQuickFilter(entry.label)}
                style={{ ...shell.chip, ...tone, boxShadow: active ? '0 8px 18px rgba(131, 24, 67, 0.15)' : 'none', borderColor: active ? 'rgba(131, 24, 67, 0.25)' : 'transparent' }}
              >
                <Icon size={13} />
                <span>{entry.label}</span>
                <span style={{ background: 'rgba(255,255,255,0.65)', borderRadius: '999px', padding: '2px 7px' }}>{summaryCounts[entry.label] || 0}</span>
              </button>
            );
          })}
          <div style={{ position: 'relative', marginLeft: 'auto' }} data-contract-customize="true">
            <button
              type="button"
              style={shell.customizeChip}
              onClick={() => setShowCustomize((prev) => !prev)}
            >
              <SlidersHorizontal size={13} />
              <span>Customize</span>
            </button>
            {showCustomize ? (
              <div style={shell.customizeMenu}>
                <p style={shell.customizeTitle}>Show Columns</p>
                {customColumns.map((col) => (
                  <label key={col.key} style={shell.customizeRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(visibleColumns[col.key])}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setVisibleColumns((prev) => ({ ...prev, [col.key]: checked }));
                      }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div style={shell.filtersBox}>
          <div style={filterGridStyle}>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Status</label>
              <select style={shell.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option>All Status</option>
                <option>Active</option>
                <option>Upcoming</option>
                <option>Expiring Soon</option>
                <option>Expired</option>
                <option>Renewed</option>
              </select>
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Type</label>
              <select style={shell.input} value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
                {typeOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Start Date From</label>
              <input type="date" style={shell.input} value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Start Date To</label>
              <input type="date" style={shell.input} value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Search</label>
              <input
                style={shell.input}
                placeholder="Customer, contract #, city..."
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <div style={{ ...shell.filterField, alignItems: 'flex-end' }}>
              <button
                type="button"
                style={shell.clearBtn}
                onClick={() => {
                  setQuickFilter('All');
                  setFilters({ status: 'All Status', type: 'All Type', from: '', to: '', search: '' });
                }}
              >
                <RefreshCcw size={13} /> Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div style={tableWrapStyle}>{renderBody()}</div>

        <div style={footerStyle}>
          <span style={shell.footText}>{`Showing 1 to ${filteredContracts.length} of ${filteredContracts.length} entries`}</span>
          <div style={pagerStyle}>
            <button type="button" style={shell.pageBtn}>«</button>
            <button type="button" style={shell.pageBtn}>‹</button>
            <button type="button" style={{ ...shell.pageBtn, ...shell.pageBtnActive }}>1</button>
            <button type="button" style={shell.pageBtn}>›</button>
            <button type="button" style={shell.pageBtn}>»</button>
          </div>
        </div>
      </div>

      {actionMenu ? createPortal(
        <div
          data-contract-action-menu="true"
          style={{
            position: 'fixed',
            left: `${actionMenu.left}px`,
            top: `${actionMenu.top}px`,
            width: '142px',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 12px 26px rgba(15,23,42,0.14)',
            zIndex: 5000,
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: '#1f2937', cursor: 'pointer', lineHeight: 1.2 }}
            onClick={() => {
              navigate('/sales/invoices', { state: { openInvoiceNumber: actionMenu.row.contractNo, fromContract: true } });
              setActionMenu(null);
            }}
          >
            View Contract
          </button>
          <button
            type="button"
            style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: '#1f2937', cursor: 'pointer', lineHeight: 1.2 }}
            onClick={() => {
              openInvoicePdf(actionMenu.row.invoiceId);
              setActionMenu(null);
            }}
          >
            Print Invoice
          </button>
          <button
            type="button"
            style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: '#1f2937', cursor: 'pointer', lineHeight: 1.2 }}
            onClick={() => {
              openContractJobCardPdf(actionMenu.row.invoiceId);
              setActionMenu(null);
            }}
          >
            Print Job Card
          </button>
          <button
            type="button"
            style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: '#dc2626', cursor: 'pointer', lineHeight: 1.2 }}
            onClick={() => deleteContract(actionMenu.row)}
          >
            Delete
          </button>
        </div>,
        document.body
      ) : null}

      {customerSummary.open && customerSummary.row ? createPortal(
        <div
          style={shell.modalOverlay}
          onClick={() => setCustomerSummary({ open: false, row: null, showHistory: false })}
        >
          <div
            style={shell.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={shell.modalHead}>
              <div>
                <h3 style={shell.modalTitle}><UserRound size={18} /> Customer Summary</h3>
                <p style={shell.modalSub}>{`${customerSummary.row.customer} • ${customerSummary.row.mobile || 'No mobile'}`}</p>
              </div>
              <button
                type="button"
                style={shell.modalClose}
                onClick={() => setCustomerSummary({ open: false, row: null, showHistory: false })}
              >
                <X size={16} />
              </button>
            </div>

            <div style={shell.modalBody}>
              <div style={shell.summaryGrid}>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><FileText size={12} /> Invoices</div>
                  <div style={shell.summaryValue}>{customerSummaryData?.relatedInvoices?.length || 0}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><Wallet size={12} /> Transactions</div>
                  <div style={shell.summaryValue}>{customerSummaryData?.transactionCount || 0}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><BadgeIndianRupee size={12} /> Paid</div>
                  <div style={shell.summaryValue}>{formatINR(customerSummaryData?.totalPaid || 0)}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><BadgeIndianRupee size={12} /> Due</div>
                  <div style={shell.summaryValue}>{formatINR(customerSummaryData?.balanceDue || 0)}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><AlertCircle size={12} /> Complaints</div>
                  <div style={shell.summaryValue}>{customerSummaryData?.complaintsCount || 0}</div>
                </div>
              </div>

              <button
                type="button"
                style={shell.modalToggleBtn}
                onClick={() => setCustomerSummary((prev) => ({ ...prev, showHistory: !prev.showHistory }))}
              >
                {customerSummary.showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {customerSummary.showHistory ? 'Hide History' : 'Show History'}
              </button>

              {customerSummary.showHistory ? (
                <>
                  <div style={shell.detailSection}>
                    <div style={shell.detailHead}>Invoice History</div>
                    <table style={shell.detailTable}>
                      <thead>
                        <tr>
                          <th style={shell.detailTh}>Invoice #</th>
                          <th style={shell.detailTh}>Date</th>
                          <th style={shell.detailTh}>Total</th>
                          <th style={shell.detailTh}>Due</th>
                          <th style={shell.detailTh}>View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerSummaryData?.relatedInvoices || []).slice(0, 8).map((invoice) => (
                          <tr key={String(invoice?._id || invoice?.invoiceNumber)}>
                            <td style={shell.detailTd}>{invoice?.invoiceNumber || '-'}</td>
                            <td style={shell.detailTd}>{formatDate(invoice?.date)}</td>
                            <td style={shell.detailTd}>{formatINR(invoice?.total || invoice?.amount || 0)}</td>
                            <td style={shell.detailTd}>{formatINR(invoice?.balanceDue || 0)}</td>
                            <td style={shell.detailTd}>
                              <button type="button" style={shell.detailBtn} onClick={() => openInvoicePdf(invoice?._id)}>PDF</button>
                            </td>
                          </tr>
                        ))}
                        {(customerSummaryData?.relatedInvoices || []).length === 0 ? (
                          <tr>
                            <td style={shell.detailTd} colSpan={5}>No invoices found.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div style={shell.detailSection}>
                    <div style={shell.detailHead}>Payment Transactions</div>
                    <table style={shell.detailTable}>
                      <thead>
                        <tr>
                          <th style={shell.detailTh}>Receipt #</th>
                          <th style={shell.detailTh}>Date</th>
                          <th style={shell.detailTh}>Invoice</th>
                          <th style={shell.detailTh}>Mode</th>
                          <th style={shell.detailTh}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerSummaryData?.relatedPayments || []).slice(0, 8).map((payment) => (
                          <tr key={String(payment?._id || payment?.paymentNumber)}>
                            <td style={shell.detailTd}>{payment?.paymentNumber || '-'}</td>
                            <td style={shell.detailTd}>{formatDate(payment?.paymentDate)}</td>
                            <td style={shell.detailTd}>{payment?.invoiceNumber || '-'}</td>
                            <td style={shell.detailTd}>{payment?.mode || '-'}</td>
                            <td style={shell.detailTd}>{formatINR(payment?.amount || 0)}</td>
                          </tr>
                        ))}
                        {(customerSummaryData?.relatedPayments || []).length === 0 ? (
                          <tr>
                            <td style={shell.detailTd} colSpan={5}>No payment transactions found.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              <div style={shell.suggestionBox}>
                Suggestion: call this customer if due amount is pending for more than 7 days, and schedule next service follow-up before contract end date.
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
