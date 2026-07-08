import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ChartSurface,
  getBarChartProps,
  getChartAxisProps,
  getChartHeight,
  getChartMargin,
  getCurrencyAxisProps,
  SalesChartTooltip,
  salesChartTheme
} from '../pages/sales-performance/SalesChartPrimitives';
import { apiGet, currentYear, money, safeRows, subscribeSalesPerformanceRefresh } from '../pages/sales-performance/salesPerformanceApi';
import { subscribeDashboardRefresh } from '../utils/dashboardRefresh';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const DASHBOARD_CACHE_KEY = 'skuasmaster-dashboard-cache-v1';

const readDashboardCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      summary: parsed.summary || null,
    settings: parsed.settings || {},
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
    vendorBills: Array.isArray(parsed.vendorBills) ? parsed.vendorBills : [],
    leads: Array.isArray(parsed.leads) ? parsed.leads : [],
    paymentReceiveds: Array.isArray(parsed.paymentReceiveds) ? parsed.paymentReceiveds : [],
    updatedAt: Number(parsed.updatedAt || 0) || 0
  };
  } catch (_error) {
    return null;
  }
};

const writeDashboardCache = (snapshot = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
      summary: snapshot.summary || null,
      settings: snapshot.settings || {},
      invoices: Array.isArray(snapshot.invoices) ? snapshot.invoices : [],
      vendorBills: Array.isArray(snapshot.vendorBills) ? snapshot.vendorBills : [],
      leads: Array.isArray(snapshot.leads) ? snapshot.leads : [],
      paymentReceiveds: Array.isArray(snapshot.paymentReceiveds) ? snapshot.paymentReceiveds : [],
      updatedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore storage failures so the dashboard still works in restricted environments.
  }
};

const shell = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    backdropFilter: 'none'
  },
  hero: {
    background: 'var(--color-primary)',
    color: '#ffffff',
    borderRadius: '24px',
    padding: '30px',
    display: 'grid',
    gridTemplateColumns: '1.25fr 0.75fr',
    gap: '20px',
    boxShadow: 'var(--shadow)',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    backdropFilter: 'blur(14px)'
  },
  badge: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#FCE7F3' },
  title: { margin: '12px 0 10px 0', fontSize: '34px', lineHeight: 1.05, letterSpacing: '-0.04em' },
  description: { margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '14px', lineHeight: 1.8, maxWidth: '720px', fontWeight: 600 },
  tagline: { margin: 0, color: 'rgba(255,255,255,0.94)', fontSize: '24px', lineHeight: 1.35, maxWidth: '720px', fontWeight: 500 },
  heroCard: { background: 'rgba(255,255,255,0.66)', border: '1px solid rgba(159, 23, 77, 0.22)', borderRadius: '20px', padding: '18px', backdropFilter: 'blur(10px)' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' },
  metric: { background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(159, 23, 77, 0.18)', borderRadius: '18px', padding: '18px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)' },
  targetSection: { display: 'grid', gap: '12px', padding: '2px 0 0' },
  targetSectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.84)',
    border: '1px solid #dbe4f0',
    borderRadius: '18px',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(10px)'
  },
  targetSectionTitle: { margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
  targetSectionHint: { margin: '4px 0 0 0', color: '#64748b', fontSize: '12px', fontWeight: 600, lineHeight: 1.35 },
  targetMetrics: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' },
  targetMetric: { background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(148, 163, 184, 0.26)', borderRadius: '16px', padding: '16px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)', minHeight: '120px' },
  targetMetricValue: { margin: '8px 0 0 0', color: '#0f172a', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.04em' },
  targetMetricSub: { margin: '6px 0 0 0', color: '#64748b', fontSize: '12px', fontWeight: 600 },
  metricLabel: { margin: 0, color: 'var(--color-primary-dark)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' },
  metricValue: { margin: '10px 0 0 0', color: '#0f172a', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em' },
  metricSub: { margin: '6px 0 0 0', color: '#475569', fontSize: '13px' },
  graphGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' },
  panel: { background: '#fff', borderRadius: '22px', border: '1px solid #dbe4f0', padding: '18px 18px 20px', boxShadow: 'none' },
  sourcePanel: { background: '#fff', borderRadius: '22px', border: '1px solid #dbe4f0', padding: 0, overflow: 'hidden', boxShadow: 'none' },
  sourceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 16px', background: '#f8fafc', borderBottom: '1px solid #dbe4f0' },
  sourceHeaderTitle: { margin: 0, color: '#334155', fontSize: '16px', fontWeight: 700, lineHeight: 1.1 },
  sourceHeaderBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px', minWidth: '84px', color: '#111827', fontWeight: 700, background: '#f1f5f9', borderRadius: '10px', padding: '0 10px', fontSize: '11px', lineHeight: 1.1, boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.10)', textAlign: 'center' },
  sourceHeaderSelect: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px', minWidth: '92px', color: '#111827', fontWeight: 700, background: '#f1f5f9', borderRadius: '10px', padding: '0 10px', fontSize: '11px', lineHeight: 1.1, boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.10)', border: 'none', outline: 'none', appearance: 'none', textAlign: 'center' },
  sourceBody: { padding: '14px 14px 14px', display: 'grid', gap: '12px', alignItems: 'center' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  panelTitle: { margin: 0, color: '#475569', fontSize: '17px', fontWeight: 700 },
  panelSub: { margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 600 },
  total: { margin: '8px 0 12px 0', color: '#111827', fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em' },
  incomePanelHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  incomeLegend: { display: 'flex', alignItems: 'flex-start', gap: '28px', flexWrap: 'wrap' },
  incomeLegendItem: { display: 'grid', gap: '4px' },
  incomeLegendLabel: { display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '12px', fontWeight: 600, lineHeight: 1.1 },
  incomeLegendValue: { margin: 0, color: '#111827', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 },
  modeToggle: { display: 'inline-flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '10px', overflow: 'hidden', background: '#fff', flexShrink: 0 },
  modeToggleBtn: { border: 'none', background: '#fff', color: '#111827', minHeight: '42px', height: '42px', padding: '0 14px', fontSize: '16px', fontWeight: 500, cursor: 'pointer' },
  modeToggleBtnActive: { background: '#e5e7eb', color: '#111827' },
  incomeChartWrap: { display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: '12px', alignItems: 'stretch', marginTop: '18px' },
  incomeYAxis: { display: 'grid', alignContent: 'space-between', padding: '8px 0 30px 0' },
  incomeYAxisLabel: { color: '#64748b', fontSize: '12px', fontWeight: 700, lineHeight: 1 },
  incomeChart: { position: 'relative', minHeight: '280px', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', padding: '10px 12px 8px 12px', background: '#fff' },
  incomeGridLine: { position: 'absolute', left: 0, right: 0, borderTop: '1px dashed #dbe4f0' },
  incomeBars: { position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '8px', alignItems: 'end', height: '100%' },
  incomeMonth: { display: 'grid', gridTemplateRows: '1fr auto', gap: '10px', alignItems: 'end', minHeight: 0 },
  incomeBarCluster: { display: 'flex', alignItems: 'end', justifyContent: 'center', gap: '4px', minHeight: 0, height: '100%' },
  incomeBarItem: { width: '18px', borderRadius: '4px 4px 0 0', minHeight: '1px' },
  incomeMonthLabel: { display: 'grid', gap: '2px', justifyItems: 'center', color: '#64748b', fontSize: '10px', fontWeight: 700, lineHeight: 1.05, textAlign: 'center' },
  progressTrack: { width: '100%', height: '20px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', display: 'flex' },
  legendRow: { display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '14px' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '13px', fontWeight: 600 },
  dot: { width: '12px', height: '12px', borderRadius: '999px', display: 'inline-block' },
  barWrap: { marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' },
  bars: { display: 'grid', gap: '10px' },
  barRow: { display: 'grid', gridTemplateColumns: '42px 1fr auto auto', alignItems: 'center', gap: '10px' },
  donutWrap: { display: 'grid', gridTemplateColumns: '1fr', gap: '14px', justifyItems: 'center', marginTop: '2px' },
  donut: { width: '268px', height: '268px', borderRadius: '50%', position: 'relative' },
  donutInner: { position: 'absolute', inset: '30%', borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px' },
  sourceLegend: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px', width: '100%', alignContent: 'start' },
  sourceLegendItem: { display: 'grid', gridTemplateColumns: '13px minmax(0, 1fr) auto', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '12px', fontWeight: 600, lineHeight: 1.2 },
  sourceLegendDot: { width: '13px', height: '13px', borderRadius: '999px', display: 'inline-block', flexShrink: 0 }
};

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isOverdue = (dueDate) => {
  const due = toDate(dueDate);
  if (!due) return false;
  const now = new Date();
  due.setHours(23, 59, 59, 999);
  return due < now;
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (date) => date.toLocaleString('en-IN', { month: 'short' });
const normalizeLeadStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeLeadSource = (value) => String(value || '').trim();
const leadSourceOrder = ['Website', 'Google Ads', 'Google Business Profile', 'Facebook', 'WhatsApp', 'Call', 'Referral'];
const leadSourcePalette = {
  Website: '#4f6bed',
  'Google Ads': '#10b981',
  'Google Business Profile': '#f59e0b',
  Facebook: '#06b6d4',
  WhatsApp: '#8b5cf6',
  Call: '#f43f5e',
  Referral: '#f97316',
  Other: '#94a3b8'
};
const mapLeadSourceLabel = (value) => {
  const raw = normalizeLeadSource(value);
  const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!compact) return 'Unknown';
  if (['website', 'web', 'site'].includes(compact)) return 'Website';
  if (['googleads', 'googlead', 'adwords', 'googleadvertising'].includes(compact)) return 'Google Ads';
  if (['gmb', 'googlebusinessprofile', 'googlemybusiness', 'googlegbp', 'googlebusiness'].includes(compact)) return 'Google Business Profile';
  if (['facebook', 'fb'].includes(compact)) return 'Facebook';
  if (['whatsapp', 'wa'].includes(compact)) return 'WhatsApp';
  if (['call', 'phone', 'telecall', 'telephone'].includes(compact)) return 'Call';
  if (['referral', 'reference', 'rpci', 'refer', 'ref'].includes(compact)) return 'Referral';
  return raw || 'Unknown';
};

const mapLeadSourceDisplayLabel = (value) => {
  const raw = String(value || '').trim();
  if (raw === 'Google Business Profile') return 'GMB';
  if (raw === 'Existing Customer') return 'Existing';
  return raw;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const hasLoadedRef = useRef(false);
  const loadDashboardRef = useRef(() => {});
  const loadSalesPerformanceSummaryRef = useRef(() => {});
  const loadSalesPerformanceRef = useRef(() => {});
  const dashboardLoadingRef = useRef(false);
  const cachedDashboardState = useMemo(() => readDashboardCache(), []);
  const [summary, setSummary] = useState(() => cachedDashboardState?.summary || null);
  const [settings, setSettings] = useState(() => cachedDashboardState?.settings || {});
  const [invoices, setInvoices] = useState(() => cachedDashboardState?.invoices || []);
  const [vendorBills, setVendorBills] = useState(() => cachedDashboardState?.vendorBills || []);
  const [leads, setLeads] = useState(() => cachedDashboardState?.leads || []);
  const [salesPerformanceSummary, setSalesPerformanceSummary] = useState(null);
  const [salesPerformanceData, setSalesPerformanceData] = useState(null);
  const [salesPerformanceLoading, setSalesPerformanceLoading] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [selectedContractYear, setSelectedContractYear] = useState(() => String(new Date().getFullYear()));
  const [selectedTargetYear, setSelectedTargetYear] = useState(() => String(new Date().getFullYear()));
  const [selectedSalesPerformanceYear, setSelectedSalesPerformanceYear] = useState(() => String(new Date().getFullYear()));
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState('');
  const [hoveredIncomeBar, setHoveredIncomeBar] = useState(null);

  useEffect(() => {
    if (hasLoadedRef.current) return undefined;
    hasLoadedRef.current = true;
    let active = true;

    const load = async () => {
      if (dashboardLoadingRef.current) return;
      dashboardLoadingRef.current = true;
      try {
        const stamp = Date.now();
        const summaryPromise = axios.get(`${API_BASE_URL}/api/dashboard/summary`, { params: { _: stamp } }).catch(() => ({ data: null }));
        const settingsPromise = axios.get(`${API_BASE_URL}/api/settings`, { params: { _: stamp } }).catch(() => ({ data: {} }));
        const supportPromise = Promise.all([
          axios.get(`${API_BASE_URL}/api/invoices`, { params: { _: stamp } }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/vendor-bills`, { params: { _: stamp } }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/leads`, { params: { _: stamp } }).catch(() => ({ data: [] }))
        ]);

        const [summaryRes, settingsRes] = await Promise.all([summaryPromise, settingsPromise]);

        if (!active) return;
        setSummary(summaryRes?.data || null);
        setSettings(settingsRes.data || {});

        const [invoicesRes, vendorBillsRes, leadsRes] = await supportPromise;
        if (!active) return;
        const nextInvoices = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];
        const nextVendorBills = Array.isArray(vendorBillsRes.data) ? vendorBillsRes.data : [];
        const nextLeads = Array.isArray(leadsRes.data) ? leadsRes.data : [];
        setInvoices(nextInvoices);
        setVendorBills(nextVendorBills);
        setLeads(nextLeads);
        writeDashboardCache({
          summary: summaryRes?.data || null,
          settings: settingsRes.data || {},
          invoices: nextInvoices,
          vendorBills: nextVendorBills,
          leads: nextLeads
        });
      } catch (error) {
        if (!active) return;
        console.error('Dashboard load failed', error);
      } finally {
        dashboardLoadingRef.current = false;
      }
    };

    loadDashboardRef.current = load;
    load();
    const timer = window.setInterval(load, 15000);
    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeDashboardRefresh(() => {
      loadDashboardRef.current();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSalesPerformanceRefresh(() => {
      loadSalesPerformanceSummaryRef.current();
      loadSalesPerformanceRef.current();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectedYearNumber = Number(selectedContractYear) || new Date().getFullYear();
  const selectedTargetYearNumber = Number(selectedTargetYear) || new Date().getFullYear();
  const selectedSalesPerformanceYearNumber = Number(selectedSalesPerformanceYear) || new Date().getFullYear();

  useEffect(() => {
    let active = true;

    const loadSalesPerformanceSummary = async () => {
      try {
        const stamp = Date.now();
        const res = await apiGet('/api/sales-performance/dashboard', {
          year: selectedTargetYearNumber,
          _: stamp
        });
        if (!active) return;
        setSalesPerformanceSummary(res?.summary || null);
      } catch (error) {
        if (!active) return;
        console.error('Sales performance summary load failed', error);
        setSalesPerformanceSummary(null);
      }
    };

    loadSalesPerformanceSummaryRef.current = loadSalesPerformanceSummary;
    loadSalesPerformanceSummary();
    return () => {
      active = false;
    };
  }, [selectedTargetYearNumber]);

  useEffect(() => {
    let active = true;

    const loadSalesPerformanceData = async () => {
      setSalesPerformanceLoading(true);
      try {
        const stamp = Date.now();
        const res = await apiGet('/api/sales-performance/dashboard', {
          year: selectedSalesPerformanceYearNumber,
          employeeId: selectedSalesPersonId,
          _: stamp
        });
        if (!active) return;
        setSalesPerformanceData(res || null);
      } catch (error) {
        if (!active) return;
        console.error('Sales performance load failed', error);
        setSalesPerformanceData(null);
      } finally {
        if (active) setSalesPerformanceLoading(false);
      }
    };

    loadSalesPerformanceRef.current = loadSalesPerformanceData;
    loadSalesPerformanceData();
    return () => {
      active = false;
    };
  }, [selectedSalesPerformanceYearNumber, selectedSalesPersonId]);

  const contractYears = useMemo(() => {
    const years = new Set();
    const collectYear = (value) => {
      const date = toDate(value);
      if (date) years.add(date.getFullYear());
    };

    invoices.forEach((invoice) => {
      collectYear(invoice.contractStartDate);
      collectYear(invoice.contractEndDate);
      collectYear(invoice.servicePeriodStart);
      collectYear(invoice.servicePeriodEnd);
      collectYear(invoice.date);
      collectYear(invoice.createdAt);
    });

    vendorBills.forEach((bill) => {
      collectYear(bill.date);
      collectYear(bill.dueDate);
      collectYear(bill.createdAt);
    });

    return Array.from(years).sort((a, b) => a - b);
  }, [invoices, vendorBills]);

  useEffect(() => {
    if (contractYears.length === 0) return;
    setSelectedContractYear((current) => {
      if (contractYears.some((year) => String(year) === String(current))) return String(current);
      return String(contractYears[contractYears.length - 1]);
    });
  }, [contractYears]);

  useEffect(() => {
    if (contractYears.length === 0) return;
    setSelectedTargetYear((current) => {
      if (contractYears.some((year) => String(year) === String(current))) return String(current);
      return String(contractYears[contractYears.length - 1]);
    });
  }, [contractYears]);

  useEffect(() => {
    if (contractYears.length === 0) return;
    setSelectedSalesPerformanceYear((current) => {
      if (contractYears.some((year) => String(year) === String(current))) return String(current);
      return String(contractYears[contractYears.length - 1]);
    });
  }, [contractYears]);

  const analytics = useMemo(() => {
    const totalReceivables = invoices.reduce((sum, invoice) => sum + toNum(invoice.balanceDue), 0);
    const receivableCurrent = invoices.reduce((sum, invoice) => sum + (isOverdue(invoice.dueDate) ? 0 : toNum(invoice.balanceDue)), 0);
    const receivableOverdue = Math.max(totalReceivables - receivableCurrent, 0);

    const totalPayables = vendorBills.reduce((sum, bill) => sum + toNum(bill.balanceDue), 0);
    const payableCurrent = vendorBills.reduce((sum, bill) => sum + (isOverdue(bill.dueDate) ? 0 : toNum(bill.balanceDue)), 0);
    const payableOverdue = Math.max(totalPayables - payableCurrent, 0);

    const today = new Date();
    const months = Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (11 - idx), 1);
      return { key: monthKey(d), label: monthLabel(d) };
    });

    const incomeMap = new Map(months.map((m) => [m.key, 0]));
    const expenseMap = new Map(months.map((m) => [m.key, 0]));

    invoices.forEach((invoice) => {
      const d = toDate(invoice.date || invoice.createdAt);
      if (!d) return;
      const key = monthKey(d);
      if (!incomeMap.has(key)) return;
      incomeMap.set(key, incomeMap.get(key) + toNum(invoice.total || invoice.amount));
    });

    vendorBills.forEach((bill) => {
      const d = toDate(bill.date || bill.createdAt || bill.dueDate);
      if (!d) return;
      const key = monthKey(d);
      if (!expenseMap.has(key)) return;
      expenseMap.set(key, expenseMap.get(key) + toNum(bill.total || bill.amount || bill.balanceDue));
    });

    const incomeSeries = months.map((m) => ({ label: m.label, value: incomeMap.get(m.key) || 0 }));
    const expenseSeries = months.map((m) => ({ label: m.label, value: expenseMap.get(m.key) || 0 }));

    const expenseBuckets = new Map();
    vendorBills.forEach((bill) => {
      const lines = Array.isArray(bill.items) ? bill.items : [];
      if (lines.length === 0) {
        const key = String(bill.vendorName || 'General').trim() || 'General';
        expenseBuckets.set(key, (expenseBuckets.get(key) || 0) + toNum(bill.total || bill.amount || bill.balanceDue));
        return;
      }
      lines.forEach((line) => {
        const key = String(line.itemName || line.name || 'General').trim() || 'General';
        const amount = toNum(line.amount, toNum(line.quantity, 0) * toNum(line.rate, 0));
        expenseBuckets.set(key, (expenseBuckets.get(key) || 0) + amount);
      });
    });

    const topExpenses = Array.from(expenseBuckets.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const totalExpenseAmount = topExpenses.reduce((sum, x) => sum + x.amount, 0);

    return {
      totalReceivables,
      receivableCurrent,
      receivableOverdue,
      totalPayables,
      payableCurrent,
      payableOverdue,
      incomeSeries,
      expenseSeries,
      totalIncome: incomeSeries.reduce((sum, x) => sum + x.value, 0),
      totalExpenses: expenseSeries.reduce((sum, x) => sum + x.value, 0),
      topExpenses,
      totalExpenseAmount
    };
  }, [invoices, vendorBills]);

  const selectedYearAnalytics = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, idx) => {
      const date = new Date(selectedYearNumber, idx, 1);
      return { key: monthKey(date), label: monthLabel(date) };
    });

    const incomeMap = new Map(months.map((month) => [month.key, 0]));
    const expenseMap = new Map(months.map((month) => [month.key, 0]));

    const getIncomeDate = (invoice) => (
      toDate(invoice.contractStartDate)
      || toDate(invoice.contractEndDate)
      || toDate(invoice.servicePeriodStart)
      || toDate(invoice.servicePeriodEnd)
      || toDate(invoice.date)
      || toDate(invoice.createdAt)
    );

    const getExpenseDate = (bill) => (
      toDate(bill.date)
      || toDate(bill.dueDate)
      || toDate(bill.createdAt)
    );

    invoices.forEach((invoice) => {
      const date = getIncomeDate(invoice);
      if (!date || date.getFullYear() !== selectedYearNumber) return;
      const key = monthKey(date);
      if (!incomeMap.has(key)) return;
      incomeMap.set(key, incomeMap.get(key) + toNum(invoice.total || invoice.amount || invoice.totalAmount));
    });

    vendorBills.forEach((bill) => {
      const date = getExpenseDate(bill);
      if (!date || date.getFullYear() !== selectedYearNumber) return;
      const key = monthKey(date);
      if (!expenseMap.has(key)) return;
      expenseMap.set(key, expenseMap.get(key) + toNum(bill.total || bill.amount || bill.balanceDue));
    });

    const incomeSeries = months.map((month) => ({ label: month.label, value: incomeMap.get(month.key) || 0 }));
    const expenseSeries = months.map((month) => ({ label: month.label, value: expenseMap.get(month.key) || 0 }));

    const expenseBuckets = new Map();
    vendorBills.forEach((bill) => {
      const date = getExpenseDate(bill);
      if (!date || date.getFullYear() !== selectedYearNumber) return;
      const lines = Array.isArray(bill.items) ? bill.items : [];
      if (lines.length === 0) {
        const key = String(bill.vendorName || 'General').trim() || 'General';
        expenseBuckets.set(key, (expenseBuckets.get(key) || 0) + toNum(bill.total || bill.amount || bill.balanceDue));
        return;
      }
      lines.forEach((line) => {
        const key = String(line.itemName || line.name || 'General').trim() || 'General';
        const amount = toNum(line.amount, toNum(line.quantity, 0) * toNum(line.rate, 0));
        expenseBuckets.set(key, (expenseBuckets.get(key) || 0) + amount);
      });
    });

    const topExpenses = Array.from(expenseBuckets.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const totalExpenseAmount = topExpenses.reduce((sum, x) => sum + x.amount, 0);

    return {
      months,
      incomeSeries,
      expenseSeries,
      topExpenses,
      totalIncome: incomeSeries.reduce((sum, x) => sum + x.value, 0),
      totalExpenses: expenseSeries.reduce((sum, x) => sum + x.value, 0),
      totalExpenseAmount
    };
  }, [invoices, vendorBills, selectedYearNumber]);

  const topCards = useMemo(() => ({
    leadsCount: leads.length || Number(summary?.leadsCount || 0),
    customersCount: Number(summary?.customersCount || 0),
    employeesCount: Number(summary?.employeesCount || 0),
    jobsCount: Number(summary?.jobsCount || 0),
    invoicesCount: Number(summary?.invoicesCount || invoices.length),
    invoicesTotalAmount: invoices.reduce((sum, invoice) => sum + toNum(invoice.total || invoice.amount || invoice.totalAmount), 0) || Number(summary?.invoicesTotalAmount || 0)
  }), [summary, invoices, leads.length]);

  const leadPipeline = useMemo(() => {
    const selectedYearLeads = leads.filter((lead) => {
      const leadDate = toDate(lead.date || lead.createdAt);
      return leadDate ? leadDate.getFullYear() === selectedYearNumber : false;
    });
    const totalLeads = selectedYearLeads.length;
    const interested = selectedYearLeads.filter((lead) => ['interested', 'warm', 'hot'].includes(normalizeLeadStatus(lead.status || lead.leadStatus))).length;
    const converted = selectedYearLeads.filter((lead) => ['converted', 'booked'].includes(normalizeLeadStatus(lead.status || lead.leadStatus))).length;
    const cancelled = selectedYearLeads.filter((lead) => normalizeLeadStatus(lead.status || lead.leadStatus) === 'cancelled').length;
    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;
    const selectedYearInvoices = invoices.filter((invoice) => {
      const invoiceDate = toDate(invoice.date || invoice.createdAt);
      return invoiceDate ? invoiceDate.getFullYear() === selectedYearNumber : false;
    });
    const pipelineValue = selectedYearInvoices.reduce((sum, invoice) => sum + toNum(invoice.total || invoice.amount || invoice.totalAmount), 0);
    const avgDealValue = converted > 0 ? pipelineValue / converted : 0;

    const sourceCounts = new Map();
    selectedYearLeads.forEach((lead) => {
      const key = mapLeadSourceLabel(lead.leadSource);
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    });
    const orderedSources = [
      ...leadSourceOrder,
      ...Array.from(sourceCounts.keys()).filter((name) => !leadSourceOrder.includes(name) && name !== 'Unknown').sort((a, b) => a.localeCompare(b))
    ];
    const sourceSeries = orderedSources
      .map((name) => ({ name, count: sourceCounts.get(name) || 0 }))
      .filter((entry) => entry.count > 0);
    const sourceTotal = sourceSeries.reduce((sum, row) => sum + row.count, 0);

    return {
      totalLeads,
      interested,
      converted,
      cancelled,
      conversionRate,
      pipelineValue,
      avgDealValue,
      sourceSeries,
      sourceTotal
    };
  }, [leads, invoices, analytics.totalReceivables, selectedYearNumber]);

  const yearlyTargetSummary = useMemo(() => {
    const target = Number(salesPerformanceSummary?.totalYearlyTarget || 0);
    const achieved = Number(salesPerformanceSummary?.totalYearlyAchieved || 0);
    const pending = Number(salesPerformanceSummary?.yearlyPending || Math.max(target - achieved, 0));
    const achievementPercent = Number(salesPerformanceSummary?.yearlyAchievementPercent || (target > 0 ? (achieved / target) * 100 : 0));
    return { target, achieved, pending, achievementPercent };
  }, [salesPerformanceSummary]);

  const yearlyTargetCards = useMemo(() => ([
    {
      label: 'TOTAL YEARLY TARGET',
      value: formatCurrency(yearlyTargetSummary.target),
      sub: `FY ${selectedTargetYearNumber}`
    },
    {
      label: 'TOTAL YEARLY ACHIEVED',
      value: formatCurrency(yearlyTargetSummary.achieved),
      sub: 'Actual achievement'
    },
    {
      label: 'TOTAL YEARLY PENDING',
      value: formatCurrency(yearlyTargetSummary.pending),
      sub: 'Target remaining'
    },
    {
      label: 'ACHIEVEMENT',
      value: `${Math.round(yearlyTargetSummary.achievementPercent)}%`,
      sub: 'Target completion'
    }
  ]), [selectedTargetYearNumber, yearlyTargetSummary]);
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth <= 991;
  const isLaptop = viewportWidth >= 992 && viewportWidth <= 1199;
  const isSmallMobile = viewportWidth < 420;
  const salesPerformanceEmployees = safeRows(salesPerformanceData?.employees);
  const salesPerformanceTrend = safeRows(salesPerformanceData?.monthlyTrend);
  const salesPerformanceChartHeight = getChartHeight({ mobile: isMobile });
  const salesPerformanceChartProps = getBarChartProps(salesPerformanceTrend.length, { mobile: isMobile });
  const salesPerformanceAxisProps = getChartAxisProps({ mobile: isMobile });
  const salesPerformanceCurrencyAxisProps = getCurrencyAxisProps({ mobile: isMobile });
  const salesPerformanceMargin = getChartMargin({ mobile: isMobile });
  const salesPerformanceChartMinWidth = isMobile
    ? Math.max(760, salesPerformanceTrend.length * 76)
    : 0;
  const salesPerformanceMonthlyTarget = salesPerformanceTrend.reduce((sum, row) => sum + toNum(row.target), 0);
  const salesPerformanceMonthlyAchieved = salesPerformanceTrend.reduce((sum, row) => sum + toNum(row.achieved), 0);
  const selectedSalesPersonLabel = selectedSalesPersonId
    ? salesPerformanceEmployees.find((person) => String(person.id) === String(selectedSalesPersonId))?.name || 'Selected Sales Person'
    : 'All Team';
  const salesPerformanceYearOptions = contractYears.length > 0
    ? contractYears
    : Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

  const companyName = String(settings.companyName || settings.gstCompanyName || 'SKUAS Pest Control Private Limited').trim();
  const aboutTagline = String(settings.aboutTagline || 'Professional in Pest Control').trim();

  const heroStyle = isMobile
    ? { ...shell.hero, gridTemplateColumns: '1fr', padding: isSmallMobile ? '16px' : '20px' }
    : isTablet || isLaptop
      ? { ...shell.hero, gridTemplateColumns: '1fr', padding: isTablet ? '22px' : '26px' }
      : shell.hero;

  const metricsStyle = isMobile
    ? { ...shell.metrics, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }
    : isTablet
      ? { ...shell.metrics, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : isLaptop
        ? { ...shell.metrics, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
        : shell.metrics;
  const heroFinanceCardStyle = {
    ...shell.heroCard,
    border: 'none',
    padding: isMobile ? '8px 12px' : '14px',
    borderRadius: isMobile ? '16px' : shell.heroCard.borderRadius,
    background: '#ffffff',
    display: 'grid',
    placeItems: 'center'
  };
  const heroFinanceTextStyle = {
    margin: 0,
    textAlign: 'center',
    color: 'var(--color-primary-dark)',
    lineHeight: isMobile ? 1.35 : 1.7,
    fontSize: isMobile ? '12px' : '15px',
    fontWeight: 700
  };
  const receivableColor = '#16a34a';
  const payableColor = '#dc2626';
  const taglineStyle = isMobile
    ? { ...shell.tagline, fontSize: isSmallMobile ? '18px' : '20px', lineHeight: 1.3 }
    : isTablet || isLaptop
      ? { ...shell.tagline, fontSize: '22px' }
      : shell.tagline;
  const metricStyle = isMobile
    ? { ...shell.metric, padding: '12px 14px', borderRadius: '10px', minHeight: '122px' }
    : shell.metric;
  const metricLabelStyle = isMobile
    ? { ...shell.metricLabel, fontSize: '9px', lineHeight: 1.25 }
    : shell.metricLabel;
  const metricValueStyle = isMobile
    ? { ...shell.metricValue, margin: '8px 0 0 0', fontSize: '23px', lineHeight: 1.05 }
    : shell.metricValue;
  const metricSubStyle = isMobile
    ? { ...shell.metricSub, margin: '6px 0 0 0', fontSize: '11px', lineHeight: 1.35 }
    : shell.metricSub;

  const graphGridStyle = viewportWidth >= 1200
    ? { ...shell.graphGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignItems: 'start' }
    : { ...shell.graphGrid, gridTemplateColumns: '1fr' };
  const graphCardStyle = viewportWidth >= 1200
    ? { minHeight: '390px', boxSizing: 'border-box' }
    : {};
  const graphSourceCardStyle = viewportWidth >= 1200
    ? { ...shell.sourcePanel, minHeight: '390px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }
    : shell.sourcePanel;
  const sourceBodyStyle = isMobile
    ? { ...shell.sourceBody, justifyItems: 'center' }
    : viewportWidth >= 1200
      ? { ...shell.sourceBody, gridTemplateColumns: 'minmax(180px, 0.92fr) minmax(130px, 0.78fr)', justifyItems: 'stretch', alignContent: 'center', gap: '8px', flex: 1 }
      : { ...shell.sourceBody, gridTemplateColumns: 'minmax(280px, 520px) minmax(220px, 1fr)', justifyItems: 'stretch' };
  const sourceLegendStyle = isMobile
    ? { ...shell.sourceLegend, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px', justifyItems: 'stretch', textAlign: 'left', maxWidth: '100%' }
    : { ...shell.sourceLegend, justifyItems: 'stretch', textAlign: 'left', maxWidth: '250px' };
  const sourceLegendItemStyle = isMobile
    ? { ...shell.sourceLegendItem, gridTemplateColumns: '11px minmax(0, 1fr) auto', gap: '6px', fontSize: '11px', width: '100%', justifyContent: 'start' }
    : { ...shell.sourceLegendItem, fontSize: '11px', gap: '8px' };
  const salesChartSectionStyle = {
    display: 'grid',
    gap: '12px',
    width: '100%',
    minWidth: 0,
    marginTop: '2px'
  };
  const salesChartCardStyle = {
    background: '#fff',
    border: '1px solid #dbe4f0',
    borderRadius: '22px',
    overflow: 'hidden',
    boxShadow: 'none',
    minHeight: isMobile ? 'auto' : '390px',
    display: 'flex',
    flexDirection: 'column'
  };
  const salesChartCardHeaderStyle = {
    padding: '11px 16px',
    background: '#f8fafc',
    borderBottom: '1px solid #dbe4f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap'
  };
  const salesChartTitleStyle = { margin: 0, color: '#334155', fontSize: '16px', fontWeight: 700, lineHeight: 1.1 };
  const salesChartSubtitleStyle = { margin: '4px 0 0 0', color: '#64748b', fontSize: '12px', fontWeight: 600, lineHeight: 1.2 };
  const salesChartHeaderControlsStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'nowrap',
    width: isMobile ? '100%' : 'auto',
    marginLeft: 'auto'
  };
  const salesChartSelectStyle = {
    ...shell.sourceHeaderSelect,
    minWidth: 0,
    height: '32px',
    minHeight: '32px',
    padding: '0 10px',
    background: '#fff',
    flex: '1 1 0'
  };
  const salesChartYearSelectStyle = isMobile
    ? { ...salesChartSelectStyle, flex: '0 0 92px', minWidth: '92px' }
    : { ...salesChartSelectStyle, flex: '0 0 98px', minWidth: '98px' };
  const salesChartPersonSelectStyle = isMobile
    ? { ...salesChartSelectStyle, flex: '1 1 0', minWidth: 0 }
    : { ...salesChartSelectStyle, flex: '0 0 150px', minWidth: '150px' };
  const salesChartBodyStyle = {
    padding: '14px 16px 16px',
    display: 'grid',
    gap: '12px',
    flex: 1
  };
  const salesChartLegendStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap'
  };
  const salesChartLegendItemStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#334155',
    fontSize: '12px',
    fontWeight: 700
  };
  const salesChartChartWrapStyle = {
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr)',
    gap: '12px',
    alignItems: 'stretch'
  };
  const salesChartScrollStyle = {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x',
    overscrollBehaviorX: 'contain'
  };
  const salesChartYAxisStyle = {
    display: 'grid',
    alignContent: 'space-between',
    padding: '8px 0 26px 0'
  };
  const salesChartYAxisLabelStyle = { color: '#64748b', fontSize: '12px', fontWeight: 700, lineHeight: 1 };
  const yearlySummaryGridStyle = isMobile
    ? { ...shell.targetMetrics, gridTemplateColumns: '1fr' }
    : isTablet
      ? { ...shell.targetMetrics, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : shell.targetMetrics;
  const targetSectionHeadStyle = isMobile
    ? { ...shell.targetSectionHead, flexDirection: 'column', alignItems: 'stretch', padding: '14px' }
    : shell.targetSectionHead;
  const targetSectionHintStyle = isMobile
    ? { ...shell.targetSectionHint, maxWidth: '100%' }
    : shell.targetSectionHint;
  const targetYearSelectStyle = {
    border: '1px solid #dbe4f0',
    background: '#fff',
    color: '#334155',
    fontWeight: 700,
    borderRadius: '12px',
    padding: '8px 12px',
    fontSize: '12px',
    outline: 'none',
    minWidth: isMobile ? '100%' : '120px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
  };
  const targetMetricValueStyle = isMobile
    ? { ...shell.targetMetricValue, fontSize: '22px' }
    : shell.targetMetricValue;
  const targetMetricSubStyle = isMobile
    ? { ...shell.targetMetricSub, fontSize: '11px' }
    : shell.targetMetricSub;

  const successGreen = '#16A34A';
  const incomeGreen = '#24c17f';
  const dangerRed = '#DC2626';
  const axisGray = '#94a3b8';
  const gridGray = '#dbe4f0';
  const expenseColors = ['#16A34A', '#DC2626', '#111827', '#8B5CF6', '#0F766E'];
  const leadFunnelRows = [
    { label: 'Total Leads', value: leadPipeline.totalLeads, color: '#4965dd' },
    { label: 'Interested', value: leadPipeline.interested, color: '#12abc4' },
    { label: 'Converted', value: leadPipeline.converted, color: '#18b985' }
  ];
  const maxLeadFunnel = Math.max(...leadFunnelRows.map((row) => row.value), 1);
  const incomeExpenseMaxValue = Math.max(
    selectedYearAnalytics.totalIncome,
    selectedYearAnalytics.totalExpenses,
    ...selectedYearAnalytics.incomeSeries.map((row) => row.value),
    ...selectedYearAnalytics.expenseSeries.map((row) => row.value),
    1
  );
  const incomeExpenseYAxisStep = Math.max(20000, Math.ceil((incomeExpenseMaxValue || 1) / 5 / 10000) * 10000);
  const incomeExpenseYAxisMax = incomeExpenseYAxisStep * 5;
  const incomeExpenseYAxisValues = Array.from({ length: 6 }, (_, idx) => idx * incomeExpenseYAxisStep);
  const incomeExpenseChartHeight = isMobile ? 220 : 225;
  const incomeExpenseScale = incomeExpenseYAxisMax > 0 ? incomeExpenseChartHeight / incomeExpenseYAxisMax : 1;
  const currencyLabel = (value) => (value >= 1000 ? `${Math.round(value / 1000)} K` : `${Math.round(value)}`);
  const incomeExpenseChartStyle = isMobile
    ? { ...shell.incomeChart, minHeight: '250px', padding: '10px 8px 8px 8px' }
    : viewportWidth >= 1200
      ? { ...shell.incomeChart, minHeight: '200px', padding: '8px 10px 6px 10px' }
    : shell.incomeChart;
  const incomeExpenseYAxisStyle = isMobile
    ? { ...shell.incomeYAxis, padding: '8px 0 24px 0' }
    : viewportWidth >= 1200
      ? { ...shell.incomeYAxis, padding: '6px 0 18px 0' }
    : shell.incomeYAxis;
  const incomeExpenseLegendValueStyle = { ...shell.incomeLegendValue, fontSize: '13px', lineHeight: 1.1 };
  const incomeExpenseLegendLabelStyle = { ...shell.incomeLegendLabel, fontSize: '13px', lineHeight: 1.1 };
  const formatCurrencyPrecise = (value) => Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const renderRoundedDonut = (segments, total, colors, size, strokeWidth, label, value, labelSize = '13px', valueSize = '22px') => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const gap = circumference * 0.012;
    let offset = 0;

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          position: 'relative',
          flexShrink: 0
        }}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-label={label}
          role="img"
          style={{ display: 'block' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {segments.map((segment, idx) => {
            const segmentValue = Number(segment.value ?? segment.count ?? 0);
            const portion = total > 0 ? segmentValue / total : 0;
            const dashLength = Math.max(circumference * portion - gap, 0);
            const dashOffset = circumference * offset + gap / 2;
            offset += portion;
            return (
              <circle
                key={`${segment.name}-${idx}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colors[idx % colors.length]}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{ color: '#64748b', fontWeight: 700, fontSize: labelSize, lineHeight: 1.15 }}
          >
            {label}
          </div>
          <div style={{ color: '#0f172a', fontSize: valueSize, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
        </div>
      </div>
    );
  };
  return (
    <div style={shell.page}>
      <section className="hero-section command-center" style={heroStyle}>
        <div>
          <h1 style={{ ...shell.title, color: '#ffffff' }}>{companyName}</h1>
          <p style={taglineStyle}>
            {aboutTagline}
          </p>
        </div>

        <div style={heroFinanceCardStyle}>
          <p style={heroFinanceTextStyle}>
            <span style={{ color: receivableColor }}>
              Receivables: <strong>{formatCurrency(analytics.totalReceivables)}</strong>
            </span>
            {' '}
            <span style={{ color: '#111827' }}>|</span>
            {' '}
            <span style={{ color: payableColor }}>
              Payables: <strong>{formatCurrency(analytics.totalPayables)}</strong>
            </span>
          </p>
        </div>
      </section>

      <section className="stats-grid dashboard-grid" style={metricsStyle}>
        <div style={metricStyle}>
          <p style={metricLabelStyle}>Leads</p>
          <p style={metricValueStyle}>{topCards.leadsCount}</p>
          <p style={metricSubStyle}>Total leads</p>
        </div>
        <div style={metricStyle}>
          <p style={metricLabelStyle}>Customers</p>
          <p style={metricValueStyle}>{topCards.customersCount}</p>
          <p style={metricSubStyle}>Active customers</p>
        </div>
        <div style={metricStyle}>
          <p style={metricLabelStyle}>Employees</p>
          <p style={metricValueStyle}>{topCards.employeesCount}</p>
          <p style={metricSubStyle}>Workforce</p>
        </div>
        <div style={metricStyle}>
          <p style={metricLabelStyle}>Invoices Value</p>
          <p style={metricValueStyle}>{formatCurrency(topCards.invoicesTotalAmount)}</p>
          <p style={metricSubStyle}>{topCards.invoicesCount} invoices</p>
        </div>
      </section>

      <section style={shell.targetSection}>
        <div style={targetSectionHeadStyle}>
          <div>
            <h2 style={shell.targetSectionTitle}>Yearly Target vs Achievement</h2>
            <p style={targetSectionHintStyle}>Choose a year to review sales targets and progress.</p>
          </div>
          <select
            value={selectedTargetYear}
            onChange={(event) => setSelectedTargetYear(event.target.value)}
            style={targetYearSelectStyle}
            aria-label="Select yearly target year"
          >
            {contractYears.length === 0 ? <option value={String(selectedTargetYearNumber)}>{selectedTargetYearNumber}</option> : contractYears.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </div>

        <div style={yearlySummaryGridStyle}>
          {yearlyTargetCards.map((card) => (
            <article key={card.label} style={shell.targetMetric}>
              <p style={shell.metricLabel}>{card.label}</p>
              <p style={targetMetricValueStyle}>{card.value}</p>
              <p style={targetMetricSubStyle}>{card.sub}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={graphGridStyle}>
        <article style={graphSourceCardStyle}>
          <div style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}>Lead Pipeline</h2>
            <select
              value={selectedContractYear}
              onChange={(event) => setSelectedContractYear(event.target.value)}
              style={{ ...shell.sourceHeaderSelect, width: '84px', minWidth: '84px' }}
              aria-label="Select lead pipeline year"
            >
              {contractYears.length === 0 ? <option value={String(selectedYearNumber)}>{selectedYearNumber}</option> : contractYears.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>
          <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ display: 'grid', gap: '14px' }}>
            {leadFunnelRows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => navigate('/leads')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '92px minmax(0, 1fr) 44px' : '110px minmax(0, 1fr) 48px',
                  alignItems: 'center',
                  gap: isMobile ? '10px' : '10px',
                  width: '100%',
                  textAlign: 'left',
                  minHeight: '48px'
                }}
              >
                <span style={{ color: '#42526a', fontWeight: 800, fontSize: isMobile ? '13px' : '13px', textAlign: 'left', justifySelf: 'start' }}>{row.label}</span>
                <span style={{ display: 'block', width: '100%', minWidth: 0 }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: isMobile ? '42px' : '42px',
                      width: `${Math.max(row.value > 0 ? 12 : 0, (row.value / maxLeadFunnel) * 100)}%`,
                      minWidth: row.value > 0 ? (isMobile ? '54px' : '70px') : '0',
                      borderRadius: '7px',
                      background: row.color,
                      color: '#fff',
                      padding: row.value > 0 ? '0 12px' : 0,
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                  >
                    <strong style={{ fontSize: isMobile ? '16px' : '16px', lineHeight: 1 }}>{row.value}</strong>
                  </span>
                </span>
                <span style={{ color: '#64748b', fontWeight: 700, fontSize: isMobile ? '13px' : '13px', textAlign: 'left' }}>
                  {`${leadPipeline.totalLeads > 0 ? Math.round((row.value / leadPipeline.totalLeads) * 100) : 0}%`}
                </span>
              </button>
            ))}
            </div>
            <div style={{ ...shell.legendRow, marginTop: '14px', justifyContent: 'space-between' }}>
              <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
                <strong style={{ color: '#4965dd', fontSize: '19px' }}>{`${leadPipeline.conversionRate.toFixed(0)}%`}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Conversion Rate</span>
              </span>
              <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
                <strong style={{ color: '#16A34A', fontSize: '19px' }}>{formatCurrency(leadPipeline.pipelineValue)}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Pipeline Value</span>
              </span>
              <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
                <strong style={{ color: '#45ABC8', fontSize: '19px' }}>{formatCurrency(leadPipeline.avgDealValue)}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Avg Deal Value</span>
              </span>
            </div>
          </div>
        </article>

        <article style={graphSourceCardStyle}>
          <div style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}>Income and Expense</h2>
            <select
              value={selectedContractYear}
              onChange={(event) => setSelectedContractYear(event.target.value)}
              style={{ ...shell.sourceHeaderSelect, width: '84px', minWidth: '84px' }}
              aria-label="Select contract year"
              >
              {contractYears.length === 0 ? <option value={String(selectedYearNumber)}>{selectedYearNumber}</option> : contractYears.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>

          <div style={{ padding: '18px 18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', color: '#64748b', fontSize: '13px', fontWeight: 700, lineHeight: 1.1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ ...shell.dot, width: '10px', height: '10px', background: incomeGreen }} />
                  <span style={incomeExpenseLegendLabelStyle}>Total Income-</span>
                  <span style={{ ...incomeExpenseLegendValueStyle, color: '#111827' }}>{formatCurrency(selectedYearAnalytics.totalIncome)}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ ...shell.dot, width: '10px', height: '10px', background: dangerRed }} />
                  <span style={incomeExpenseLegendLabelStyle}>Total Expenses-</span>
                  <span style={{ ...incomeExpenseLegendValueStyle, color: '#111827' }}>{formatCurrency(selectedYearAnalytics.totalExpenses)}</span>
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: '12px', alignItems: 'stretch', marginTop: '18px' }}>
              <div style={incomeExpenseYAxisStyle}>
                {incomeExpenseYAxisValues.slice().reverse().map((value) => (
                  <span key={value} style={{ ...shell.incomeYAxisLabel, color: value === 0 ? '#64748b' : axisGray }}>
                    {value === 0 ? '0' : currencyLabel(value)}
                  </span>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: 0 }}>
                <div style={{ ...incomeExpenseChartStyle, height: `${incomeExpenseChartHeight + 42}px` }}>
                  {incomeExpenseYAxisValues.slice(1).map((value) => (
                    <div
                      key={value}
                      style={{
                        ...shell.incomeGridLine,
                        bottom: `${(value / incomeExpenseYAxisMax) * 100}%`
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '8px 10px 6px 10px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      gap: isMobile ? '6px' : '8px',
                      alignItems: 'end',
                      overflow: 'visible'
                    }}
                  >
                    {selectedYearAnalytics.months.map((month, index) => {
                      const income = selectedYearAnalytics.incomeSeries[index]?.value || 0;
                      const expense = selectedYearAnalytics.expenseSeries[index]?.value || 0;
                      const incomeHeight = Math.max(income * incomeExpenseScale, income > 0 ? 6 : 0);
                      const expenseHeight = Math.max(expense * incomeExpenseScale, expense > 0 ? 6 : 0);

                      return (
                        <div
                          key={month.key}
                          style={{ ...shell.incomeMonth, position: 'relative' }}
                          onMouseLeave={() => setHoveredIncomeBar(null)}
                        >
                          <div style={shell.incomeBarCluster}>
                            <div style={{ display: 'flex', alignItems: 'end', gap: '4px', height: '100%' }}>
                              <button
                                type="button"
                                aria-label={`${month.label} income ${formatCurrencyPrecise(income)}`}
                                onMouseEnter={() => setHoveredIncomeBar({
                                  monthKey: month.key,
                                  monthLabel: month.label,
                                  year: selectedYearNumber,
                                  value: income
                                })}
                                onFocus={() => setHoveredIncomeBar({
                                  monthKey: month.key,
                                  monthLabel: month.label,
                                  year: selectedYearNumber,
                                  value: income
                                })}
                                style={{
                                  ...shell.incomeBarItem,
                                  height: `${incomeHeight}px`,
                                  background: incomeGreen,
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer'
                                }}
                              />
                              <button
                                type="button"
                                aria-label={`${month.label} expense ${formatCurrencyPrecise(expense)}`}
                                onMouseEnter={() => setHoveredIncomeBar({
                                  monthKey: month.key,
                                  monthLabel: month.label,
                                  year: selectedYearNumber,
                                  value: expense
                                })}
                                onFocus={() => setHoveredIncomeBar({
                                  monthKey: month.key,
                                  monthLabel: month.label,
                                  year: selectedYearNumber,
                                  value: expense
                                })}
                                style={{
                                  ...shell.incomeBarItem,
                                  height: `${expenseHeight}px`,
                                  background: dangerRed,
                                  opacity: 0.78,
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer'
                                }}
                              />
                            </div>
                          </div>
                          <div style={shell.incomeMonthLabel}>
                            <span>{month.label}</span>
                          </div>
                          {hoveredIncomeBar?.monthKey === month.key ? (
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                bottom: 'calc(100% + 14px)',
                                transform: 'translateX(-50%)',
                                background: '#fff',
                                border: '1px solid #dbe4f0',
                                borderRadius: '18px',
                                boxShadow: '0 16px 34px rgba(15, 23, 42, 0.12)',
                                padding: '14px 16px 12px',
                                minWidth: '168px',
                                pointerEvents: 'none',
                                textAlign: 'left',
                                zIndex: 20
                              }}
                            >
                              <div style={{ color: '#0f172a', fontSize: '22px', fontWeight: 800, lineHeight: 1.08 }}>
                                {formatCurrencyPrecise(hoveredIncomeBar.value)}
                              </div>
                              <div style={{ marginTop: '10px', color: '#334155', fontSize: '16px', fontWeight: 500, lineHeight: 1.1 }}>
                                {`${hoveredIncomeBar.monthLabel} ${hoveredIncomeBar.year}`}
                              </div>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  bottom: '-7px',
                                  width: '14px',
                                  height: '14px',
                                  background: '#fff',
                                  borderRight: '1px solid #dbe4f0',
                                  borderBottom: '1px solid #dbe4f0',
                                  transform: 'translateX(-50%) rotate(45deg)'
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article style={graphSourceCardStyle}>
          <div style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}>Lead Sources</h2>
            <span style={shell.sourceHeaderBadge}>{leadPipeline.sourceTotal} total</span>
          </div>
          <div style={sourceBodyStyle}>
            {renderRoundedDonut(
              leadPipeline.sourceSeries,
              leadPipeline.sourceTotal,
              leadPipeline.sourceSeries.map((entry) => leadSourcePalette[entry.name] || leadSourcePalette.Other),
              viewportWidth >= 1200 ? 220 : 268,
              22,
              'Lead Sources',
              leadPipeline.sourceTotal,
              '13px',
              '22px'
            )}
            {leadPipeline.sourceSeries.length === 0 ? (
              <div style={{ color: '#64748b', fontWeight: 700 }}>No lead source data available.</div>
            ) : (
              <div style={sourceLegendStyle}>
                {leadPipeline.sourceSeries.map((entry) => (
                  <span key={entry.name} style={sourceLegendItemStyle}>
                    <span
                      style={{
                        ...shell.sourceLegendDot,
                        background: leadSourcePalette[entry.name] || leadSourcePalette.Other
                      }}
                    />
                    <span>{mapLeadSourceDisplayLabel(entry.name)}</span>
                    <span style={{ color: '#64748b', fontWeight: 700 }}>{entry.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>

        <article style={graphSourceCardStyle}>
          <div style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}>Top Expenses</h2>
            <span style={shell.sourceHeaderBadge}>{selectedYearNumber}</span>
          </div>
          <div style={{ ...shell.donutWrap, padding: '18px 18px 14px' }}>
            {renderRoundedDonut(
              selectedYearAnalytics.topExpenses.map((entry) => ({ name: entry.name, value: entry.amount })),
              selectedYearAnalytics.totalExpenses,
              expenseColors,
              viewportWidth >= 1200 ? 220 : 268,
              22,
              'All Expenses',
              formatCurrency(selectedYearAnalytics.totalExpenses),
              '13px',
              '24px'
            )}
            <div style={{ display: 'grid', gap: '10px' }}>
              {selectedYearAnalytics.topExpenses.length === 0 ? (
                <div style={{ color: '#64748b', fontWeight: 700 }}>No expense data available.</div>
              ) : selectedYearAnalytics.topExpenses.map((entry, idx) => (
                <div key={`${entry.name}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: '10px', alignItems: 'center' }}>
                  <span style={{ ...shell.dot, width: '16px', height: '16px', borderRadius: '5px', background: expenseColors[idx % expenseColors.length] }} />
                  <span style={{ color: '#334155', fontWeight: 700 }}>{entry.name}</span>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>{formatCurrency(entry.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section style={salesChartSectionStyle}>
        <div style={salesChartCardStyle}>
          <div style={salesChartCardHeaderStyle}>
            <div>
              <h2 style={salesChartTitleStyle}>Sales Team Performance</h2>
              <p style={isMobile ? { ...salesChartSubtitleStyle, display: 'none' } : salesChartSubtitleStyle}>Month-wise target vs achievement for the selected year and salesperson.</p>
            </div>
            <div style={salesChartHeaderControlsStyle}>
              <select
                value={selectedSalesPerformanceYear}
                onChange={(event) => setSelectedSalesPerformanceYear(event.target.value)}
                style={salesChartYearSelectStyle}
                aria-label="Select sales performance year"
              >
                {salesPerformanceYearOptions.map((year) => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
              <select
                value={selectedSalesPersonId}
                onChange={(event) => setSelectedSalesPersonId(event.target.value)}
                style={salesChartPersonSelectStyle}
                aria-label="Select sales person"
              >
                <option value="">All Team</option>
                {salesPerformanceEmployees.map((person) => (
                  <option key={person.id} value={String(person.id)}>{person.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={salesChartBodyStyle}>
            <div style={salesChartLegendStyle}>
              <span style={salesChartLegendItemStyle}>
                <span style={{ ...shell.dot, width: '10px', height: '10px', background: '#111827' }} />
                <span>Target</span>
                <strong style={{ color: '#111827' }}>{formatCurrency(salesPerformanceMonthlyTarget)}</strong>
              </span>
              <span style={salesChartLegendItemStyle}>
                <span style={{ ...shell.dot, width: '10px', height: '10px', background: '#16A34A' }} />
                <span>Achieved</span>
                <strong style={{ color: '#16A34A' }}>{formatCurrency(salesPerformanceMonthlyAchieved)}</strong>
              </span>
              <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                {selectedSalesPersonLabel}
              </span>
            </div>

            {salesPerformanceLoading ? (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: salesPerformanceChartHeight }}>
                <div style={{ color: '#64748b', fontWeight: 700 }}>Loading sales performance...</div>
              </div>
            ) : salesPerformanceTrend.length ? (
              <div style={salesChartChartWrapStyle}>
                <div style={salesChartYAxisStyle}>
                  {(() => {
                    const maxValue = Math.max(
                      salesPerformanceMonthlyTarget,
                      salesPerformanceMonthlyAchieved,
                      ...salesPerformanceTrend.map((row) => Math.max(toNum(row.target), toNum(row.achieved))),
                      1
                    );
                    return Array.from({ length: 6 }, (_, index) => 5 - index).map((step) => {
                      const value = (maxValue / 5) * step;
                      return (
                        <span key={step} style={salesChartYAxisLabelStyle}>
                          {step === 0 ? '0' : money(value)}
                        </span>
                      );
                    });
                  })()}
                </div>
                <div style={salesChartScrollStyle}>
                  <ChartSurface height={salesPerformanceChartHeight} minWidth={salesPerformanceChartMinWidth}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={salesPerformanceTrend}
                        margin={salesPerformanceMargin}
                        barCategoryGap={salesPerformanceChartProps.barCategoryGap}
                        barGap={0}
                      >
                        <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                        <XAxis dataKey="label" {...salesPerformanceAxisProps} />
                        <YAxis {...salesPerformanceCurrencyAxisProps} />
                        <Tooltip
                          cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                          content={<SalesChartTooltip valueFormatter={(value) => money(value || 0)} />}
                        />
                        <Bar dataKey="target" name="Target" fill="#111827" radius={0} maxBarSize={salesPerformanceChartProps.maxBarSize} />
                        <Bar dataKey="achieved" name="Achieved" radius={0} maxBarSize={salesPerformanceChartProps.maxBarSize}>
                          {salesPerformanceTrend.map((entry) => (
                            <Cell key={entry.month} fill={Number(entry.achieved || 0) >= Number(entry.target || 0) ? '#16A34A' : '#DC2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: salesPerformanceChartHeight, color: '#64748b', fontWeight: 700 }}>
                No sales performance data available.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
