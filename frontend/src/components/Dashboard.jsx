import { shouldAutoRefresh } from '../hooks/autoRefreshPolicy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowUpRight, Users, ContactRound, BriefcaseBusiness, Receipt, Target, CircleCheck, Clock3, TrendingUp, Wallet, CalendarDays, ChartNoAxesColumnIncreasing, Megaphone, FileText } from 'lucide-react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Trapezoid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import { loadPortalTheme } from '../utils/themePreference';
import { formatMonthlyTargetCurrency, getIndiaMonthPeriod, getMonthlyTargetSummary } from '../utils/monthlyTargetSummary';

// Keep phone tooltips below the plot, and bring the dock into view after a tap.
function MobileDashboardTooltip({ active, payload, label }) {
  const tooltipRef = useRef(null);
  useEffect(() => {
    if (!active || !payload?.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      tooltipRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, payload, label]);
  if (!active || !payload?.length) return null;
  return (
    <div ref={tooltipRef} className="dashboard-mobile-tooltip" style={{ gridTemplateColumns: `28px repeat(${payload.length}, minmax(0, 1fr))` }}>
      <strong className="dashboard-tooltip-month">{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey} className="dashboard-tooltip-value">
          <span><i style={{ background: entry.color || 'var(--chart-target-bar)' }} />{entry.name}</span>
          <strong>{money(entry.value || 0)}</strong>
        </span>
      ))}
    </div>
  );
}

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

// Presentation tokens stay local to the Main Dashboard.
const shell = {
  page: { display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 },
  title: { margin: 0, fontSize: 'clamp(22px, 2.2vw, 32px)', lineHeight: 1.2, letterSpacing: '-0.035em' },
  metricLabel: { margin: 0, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 },
  sourceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', background: 'var(--dashboard-header)' },
  sourceHeaderTitle: { margin: 0, color: '#ffffff', fontSize: 15, fontWeight: 700 },
  sourceHeaderBadge: { color: '#ffffff', background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 10px', fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  legendRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  legendItem: { display: 'inline-flex', gap: 8, color: 'var(--text-secondary)', fontSize: 12 },
  donutWrap: { display: 'grid', gap: 20, justifyItems: 'center' },
  sourceLegendDot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }
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
  const loadMonthlyTargetRef = useRef(() => {});
  const dashboardLoadingRef = useRef(false);
  const [themeMode, setThemeMode] = useState(() => (
    typeof document === 'undefined'
      ? 'light'
      : document.documentElement.dataset.theme || loadPortalTheme()
  ));
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
  const [monthlyPeriod, setMonthlyPeriod] = useState(() => getIndiaMonthPeriod());
  const [monthlyTargetState, setMonthlyTargetState] = useState({ status: 'loading', data: null });

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
    let lastPassiveRefresh = Date.now();
    const passiveRefresh = () => {
      const now = Date.now();
      if (!shouldAutoRefresh({ visibilityState: document.visibilityState, running: dashboardLoadingRef.current, lastStartedAt: lastPassiveRefresh, now })) return;
      lastPassiveRefresh = now;
      load();
    };
    const timer = window.setInterval(passiveRefresh, 15000);
    const onFocus = passiveRefresh;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') passiveRefresh();
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
      loadMonthlyTargetRef.current();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const syncTheme = () => setThemeMode(root.dataset.theme || loadPortalTheme());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const selectedYearNumber = Number(selectedContractYear) || new Date().getFullYear();
  const selectedTargetYearNumber = Number(selectedTargetYear) || new Date().getFullYear();
  const selectedSalesPerformanceYearNumber = Number(selectedSalesPerformanceYear) || new Date().getFullYear();
  const dashboardYearOptions = useMemo(() => {
    const years = new Set([
      ...contractYears,
      new Date().getFullYear(),
      selectedYearNumber,
      selectedTargetYearNumber,
      selectedSalesPerformanceYearNumber
    ]);
    return Array.from(years).filter((year) => Number.isFinite(Number(year))).sort((a, b) => Number(a) - Number(b));
  }, [contractYears, selectedYearNumber, selectedTargetYearNumber, selectedSalesPerformanceYearNumber]);

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

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let controller;
    const loadMonthlyTarget = async () => {
      const currentRequest = ++requestId;
      controller?.abort();
      controller = new AbortController();
      setMonthlyTargetState({ status: 'loading', data: null });
      try {
        const response = await axios.get(`${API_BASE_URL}/api/sales-performance/dashboard`, {
          params: { year: monthlyPeriod.year, month: monthlyPeriod.month, _: Date.now() },
          timeout: 15000, signal: controller.signal
        });
        const res = response.data;
        if (!active || currentRequest !== requestId) return;
        if (res?.success === false || Number(res?.year) !== monthlyPeriod.year || Number(res?.month) !== monthlyPeriod.month) {
          throw new Error('Monthly sales period is unavailable.');
        }
        const data = getMonthlyTargetSummary(res?.summary);
        setMonthlyTargetState({ status: 'ready', data, period: monthlyPeriod });
      } catch (error) {
        if (!active || currentRequest !== requestId) return;
        console.error('Monthly target load failed', error);
        setMonthlyTargetState({ status: 'error', data: null });
      }
    };
    loadMonthlyTargetRef.current = loadMonthlyTarget;
    loadMonthlyTarget();
    const onFocus = () => loadMonthlyTarget();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [monthlyPeriod]);

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
  const monthlyTargetData = monthlyTargetState.status === 'ready'
    && monthlyTargetState.period?.year === monthlyPeriod.year
    && monthlyTargetState.period?.month === monthlyPeriod.month ? monthlyTargetState.data : null;
  const monthlyTargetStatus = monthlyTargetState.status === 'error' ? 'error' : monthlyTargetData ? 'ready' : 'loading';
  const monthlyPeriodLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    .format(new Date(Date.UTC(monthlyPeriod.year, monthlyPeriod.month - 1, 1)));
  const monthlyYearOptions = Array.from(new Set([
    ...dashboardYearOptions, getIndiaMonthPeriod().year - 1, getIndiaMonthPeriod().year,
    getIndiaMonthPeriod().year + 1, monthlyPeriod.year
  ])).sort((a, b) => a - b);
  const missingMonthlyTargetLabel = monthlyTargetData?.configurationKnown ? 'Target not configured' : 'Target configuration unavailable';
  const monthlyTargetCards = [
    {
      label: 'Monthly Target',
      value: monthlyTargetData?.targetConfigured ? formatMonthlyTargetCurrency(monthlyTargetData.target) : '—',
      sub: monthlyTargetData?.targetConfigured ? monthlyPeriodLabel : missingMonthlyTargetLabel
    },
    {
      label: 'Monthly Achieved', value: monthlyTargetData ? formatMonthlyTargetCurrency(monthlyTargetData.achieved) : '—',
      sub: 'GST-inclusive invoice sales'
    },
    {
      label: 'Monthly Pending Target',
      value: monthlyTargetData && monthlyTargetData.pending !== null ? formatMonthlyTargetCurrency(monthlyTargetData.pending) : '—',
      sub: monthlyTargetData?.overachievement > 0
        ? `${formatMonthlyTargetCurrency(monthlyTargetData.overachievement)} above target`
        : monthlyTargetData?.targetConfigured ? 'Target remaining' : missingMonthlyTargetLabel
    },
    {
      label: 'Monthly Achievement Percentage',
      value: monthlyTargetData && monthlyTargetData.achievementPercent !== null
        ? `${monthlyTargetData.achievementPercent.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%` : '—',
      sub: monthlyTargetData?.targetConfigured
        ? monthlyTargetData.target > 0 ? 'Target completion' : 'Percentage unavailable for a ₹0 target'
        : missingMonthlyTargetLabel
    }
  ];
  const isMobile = viewportWidth < 768;
  // Mobile presentation only; the original monthly series and financial values stay intact.
  const mobileChartAxisProps = isMobile ? {
    tick: { fontSize: 10, fontWeight: 600, fill: 'var(--chart-axis)' },
    angle: 0,
    textAnchor: 'middle',
    height: 24,
    interval: 'preserveStartEnd',
    minTickGap: 8
  } : {};
  const mobileChartMargin = { top: 8, right: 8, left: 0, bottom: 0 };
  const mobileTooltipProps = isMobile ? {
    trigger: 'click',
    isAnimationActive: false,
    wrapperStyle: { maxWidth: '100%', pointerEvents: 'none' }
  } : {};
  const salesPerformanceEmployees = safeRows(salesPerformanceData?.employees);
  const salesPerformanceTrend = safeRows(salesPerformanceData?.monthlyTrend);
  const salesPerformanceChartHeight = getChartHeight({ mobile: isMobile });
  const salesPerformanceChartProps = getBarChartProps(salesPerformanceTrend.length, { mobile: isMobile });
  const salesPerformanceAxisProps = { ...getChartAxisProps({ mobile: isMobile }), ...mobileChartAxisProps };
  const salesPerformanceCurrencyAxisProps = { ...getCurrencyAxisProps({ mobile: isMobile }), width: isMobile ? 58 : 76 };
  const salesPerformanceMargin = isMobile ? mobileChartMargin : getChartMargin({ mobile: isMobile });
  const salesPerformanceChartMinWidth = 0;
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
  const isDarkTheme = themeMode === 'dark';
  const darkDashboardText = 'var(--text-primary)';
  const darkDashboardMuted = 'var(--text-secondary)';
  const taglineStyle = { margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: 15 };
  const metricLabelStyle = shell.metricLabel;
  const metricValueStyle = { margin: '14px 0 6px', color: 'var(--text-primary)', fontSize: 'clamp(24px, 2.3vw, 32px)', fontWeight: 800, letterSpacing: '-.035em', overflowWrap: 'anywhere' };
  const metricSubStyle = { margin: 0, color: 'var(--text-secondary)', fontSize: 12 };
  const sourceBodyStyle = { display: 'grid', gap: 24, alignItems: 'center', padding: 24, flex: 1 };
  const salesChartSectionStyle = { minWidth: 0 };
  const salesChartCardHeaderStyle = { ...shell.sourceHeader, flexWrap: 'wrap' };
  const salesChartTitleStyle = shell.sourceHeaderTitle;
  const salesChartSubtitleStyle = { margin: '6px 0 0', color: '#d7daee', fontSize: 12, lineHeight: 1.4 };
  const salesChartHeaderControlsStyle = { display: 'flex', flexWrap: 'wrap', gap: 8 };
  const compactHeaderSelectStyle = { minWidth: 92 };
  const salesChartYearSelectStyle = { minWidth: 92 };
  const salesChartPersonSelectStyle = { minWidth: 140, maxWidth: '100%' };
  const salesChartBodyStyle = { display: 'grid', gap: 24, padding: 20, minWidth: 0 };
  const salesChartLegendStyle = { display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' };
  const salesChartLegendItemStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 };
  const salesChartChartWrapStyle = { minWidth: 0 };
  const salesChartScrollStyle = { width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' };
  const targetSectionTitleStyle = { margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' };
  const targetYearSelectStyle = { minWidth: 100 };
  const targetMetricValueStyle = { ...metricValueStyle, fontSize: 'clamp(22px, 2vw, 28px)' };
  const targetMetricSubStyle = metricSubStyle;
  const incomeGreen = '#14a777';
  const dangerRed = '#e05b71';
  const expenseColors = ['#8b5cf6', '#14a777', '#3b82f6', '#f59e0b', '#e05b71'];
  const leadFunnelRows = [
    { label: 'Total Leads', value: leadPipeline.totalLeads, color: '#4965dd' },
    { label: 'Interested', value: leadPipeline.interested, color: '#12abc4' },
    { label: 'Converted', value: leadPipeline.converted, color: '#18b985' }
  ];
  // Row height only: wrap every existing source label without dropping categories.
  const sourceChartRowHeight = Math.max(52, ...leadPipeline.sourceSeries.map((entry) => Math.ceil(mapLeadSourceDisplayLabel(entry.name).length / (isMobile ? 12 : 16)) * 16 + 12));
  // Adapt the existing monthly series for rendering; accounting totals stay above.
  const incomeExpenseChartData = selectedYearAnalytics.months.map((month, index) => ({
    label: month.label,
    income: selectedYearAnalytics.incomeSeries[index]?.value || 0,
    expense: selectedYearAnalytics.expenseSeries[index]?.value || 0
  }));
  const incomeExpenseLegendValueStyle = { margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 800 };
  const incomeExpenseLegendLabelStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 };
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
            stroke={isDarkTheme ? 'rgba(148, 163, 184, 0.22)' : '#e5e7eb'}
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
            style={{ color: isDarkTheme ? darkDashboardMuted : '#334155', fontWeight: 800, fontSize: labelSize, lineHeight: 1.15 }}
          >
            {label}
          </div>
          <div style={{ color: isDarkTheme ? darkDashboardText : '#0f172a', fontSize: valueSize, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
        </div>
      </div>
    );
  };
  return (
    <div className="dashboard-page dashboard-main" style={shell.page}>
      <section className="hero-section command-center">
        <div>
          <h1 style={{ ...shell.title, color: 'var(--text-primary)' }}>{companyName}</h1>
          <p className="dashboard-tagline" style={taglineStyle}>
            {aboutTagline}
          </p>
        </div>

          <div className="dashboard-monthly-controls" title="Monthly target period"><CalendarDays size={17} aria-hidden="true" />
            <select value={monthlyPeriod.month} aria-label="Select monthly target month"
              onChange={(event) => setMonthlyPeriod((period) => ({ ...period, month: Number(event.target.value) }))}>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(Date.UTC(2000, index, 1)))}</option>
              ))}
            </select>
            <select value={monthlyPeriod.year} aria-label="Select monthly target year"
              onChange={(event) => setMonthlyPeriod((period) => ({ ...period, year: Number(event.target.value) }))}>
              {monthlyYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
      </section>

      <section className="stats-grid dashboard-grid">
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-heading"><p style={metricLabelStyle}>Leads</p><span className="dashboard-icon dashboard-icon-purple"><Users size={20} /></span></div>
          <p className="dashboard-kpi-value" style={metricValueStyle}>{topCards.leadsCount}</p>
          <p className="dashboard-kpi-support" style={metricSubStyle}>Total leads</p>
        </div>
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-heading"><p style={metricLabelStyle}>Customers</p><span className="dashboard-icon dashboard-icon-blue"><ContactRound size={20} /></span></div>
          <p className="dashboard-kpi-value" style={metricValueStyle}>{topCards.customersCount}</p>
          <p className="dashboard-kpi-support" style={metricSubStyle}>Active customers</p>
        </div>
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-heading"><p style={metricLabelStyle}>Employees</p><span className="dashboard-icon dashboard-icon-teal"><BriefcaseBusiness size={20} /></span></div>
          <p className="dashboard-kpi-value" style={metricValueStyle}>{topCards.employeesCount}</p>
          <p className="dashboard-kpi-support" style={metricSubStyle}>Workforce</p>
        </div>
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-heading"><p style={metricLabelStyle}>Invoices Value</p><span className="dashboard-icon dashboard-icon-amber"><Receipt size={20} /></span></div>
          <p className="dashboard-kpi-value" style={metricValueStyle}>{formatCurrency(topCards.invoicesTotalAmount)}</p>
          <p className="dashboard-kpi-support" style={metricSubStyle}>{topCards.invoicesCount} invoices</p>
        </div>
        <div className="dashboard-metric-card dashboard-finance-card">
          <span className="dashboard-icon dashboard-icon-green" aria-hidden="true">₹</span>
          <div><p style={metricLabelStyle}>Receivables</p>
            <p className="dashboard-kpi-value" style={metricValueStyle}>{formatCurrency(analytics.totalReceivables)}</p>
            <p className="dashboard-kpi-support" style={metricSubStyle}>Pending payments</p></div>
        </div>
        <div className="dashboard-metric-card dashboard-finance-card">
          <span className="dashboard-icon dashboard-icon-rose"><ArrowUpRight size={20} aria-hidden="true" /></span>
          <div><p style={metricLabelStyle}>Payables</p>
            <p className="dashboard-kpi-value" style={metricValueStyle}>{formatCurrency(analytics.totalPayables)}</p>
            <p className="dashboard-kpi-support" style={metricSubStyle}>Pending bills</p></div>
        </div>
      </section>

      <div className="dashboard-summary-panels">
      <section className="dashboard-target-section dashboard-monthly-target" aria-labelledby="monthly-target-heading" aria-busy={monthlyTargetStatus === 'loading'}>
        <div className="dashboard-section-head dashboard-monthly-head">
          <div>
            <h2 id="monthly-target-heading" style={targetSectionTitleStyle}><CalendarDays size={17} aria-hidden="true" />Current Month ({monthlyPeriodLabel})</h2>
          </div>
        </div>
        {monthlyTargetStatus === 'error' ? (
          <div className="dashboard-monthly-status" role="alert">
            <span>Unable to load monthly sales data. Please try again.</span>
            <button type="button" onClick={() => loadMonthlyTargetRef.current()}>Retry</button>
          </div>
        ) : <p className="dashboard-monthly-status" role="status">{monthlyTargetStatus === 'loading' ? 'Loading monthly sales data…' : !monthlyTargetData.targetConfigured ? missingMonthlyTargetLabel : ''}</p>}
        <div className="dashboard-target-grid">
          {monthlyTargetCards.slice(0, 3).map((card, index) => (
            <article key={card.label} className={`dashboard-target-card dashboard-summary-${index}`}>
              <div className="dashboard-metric-heading"><p style={shell.metricLabel}>{['Target', 'Achieved', 'Pending'][index]}</p><span className="dashboard-target-icon">{React.createElement([Target, CircleCheck, Clock3, TrendingUp][index], { size: 18, 'aria-hidden': true })}</span></div>
              <p className="dashboard-target-value" style={targetMetricValueStyle}>{monthlyTargetStatus === 'loading' ? '—' : card.value}</p>
              <p className={`dashboard-target-support ${monthlyTargetStatus !== 'ready' || !monthlyTargetData?.targetConfigured || monthlyTargetData.target === 0 || index === 2 && monthlyTargetData.overachievement > 0 ? 'dashboard-target-exception' : ''}`} style={targetMetricSubStyle}>{monthlyTargetStatus === 'ready' ? index === 1 && monthlyTargetData.targetConfigured && monthlyTargetData.target === 0 ? monthlyTargetCards[3].sub : card.sub : monthlyTargetStatus === 'loading' ? 'Loading…' : 'Data unavailable'}</p>
              {index === 1 ? <div className="dashboard-summary-progress"><progress className="dashboard-achievement-progress" max={100} value={monthlyTargetData?.progress ?? 0} aria-label="Monthly target achievement"
                aria-valuetext={monthlyTargetData && monthlyTargetData.achievementPercent !== null ? `${monthlyTargetCards[3].value} achieved` : 'Achievement percentage unavailable'} /><span aria-label="Monthly Achievement Percentage">{monthlyTargetCards[3].value}</span></div> : null}
              {index === 2 ? <div className="dashboard-summary-progress"><progress className="dashboard-achievement-progress" max={100} value={monthlyTargetData?.target > 0 && monthlyTargetData.pending !== null ? Math.min(100, Math.max(0, monthlyTargetData.pending / monthlyTargetData.target * 100)) : 0} aria-label="Monthly pending target percentage" /><span>{monthlyTargetData?.target > 0 && monthlyTargetData.pending !== null ? `${(monthlyTargetData.pending / monthlyTargetData.target * 100).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%` : '—'}</span></div> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-target-section dashboard-yearly-target" aria-labelledby="yearly-target-heading">
        <div className="dashboard-section-head">
          <div>
            <h2 id="yearly-target-heading" style={targetSectionTitleStyle}><TrendingUp size={17} aria-hidden="true" />Yearly (FY {selectedTargetYearNumber})</h2>
          </div>
          <select
            value={selectedTargetYear}
            onChange={(event) => setSelectedTargetYear(event.target.value)}
            style={targetYearSelectStyle}
            aria-label="Select yearly target year"
          >
            {dashboardYearOptions.length === 0 ? <option value={String(selectedTargetYearNumber)}>{selectedTargetYearNumber}</option> : dashboardYearOptions.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </div>

        <div className="dashboard-target-grid">
          {yearlyTargetCards.slice(0, 3).map((card, index) => (
            <article key={card.label} className={`dashboard-target-card dashboard-summary-${index}`}>
              <div className="dashboard-metric-heading"><p style={shell.metricLabel}>{['Target', 'Achieved', 'Pending'][index]}</p><span className="dashboard-target-icon">{React.createElement([Target, CircleCheck, Clock3, TrendingUp][index], { size: 18 })}</span></div>
              <p className="dashboard-target-value" style={targetMetricValueStyle}>{card.value}</p>
              <p className="dashboard-target-support" style={targetMetricSubStyle}>{card.sub}</p>
              {index === 1 ? <div className="dashboard-summary-progress"><progress className="dashboard-achievement-progress" max={100} value={Math.min(100, Math.max(0, yearlyTargetSummary.achievementPercent))} aria-label="Yearly target achievement" /><span aria-label="Yearly Achievement Percentage">{yearlyTargetCards[3].value}</span></div> : null}
              {index === 2 ? <div className="dashboard-summary-progress"><progress className="dashboard-achievement-progress" max={100} value={yearlyTargetSummary.target > 0 ? Math.min(100, Math.max(0, yearlyTargetSummary.pending / yearlyTargetSummary.target * 100)) : 0} aria-label="Yearly pending target percentage" /><span>{yearlyTargetSummary.target > 0 ? `${Math.round(yearlyTargetSummary.pending / yearlyTargetSummary.target * 100)}%` : '—'}</span></div> : null}
            </article>
          ))}
        </div>
      </section>

      </div>

      <section className="dashboard-chart-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-header" style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}><span className="dashboard-icon dashboard-icon-blue"><Users size={22} /></span>Lead Pipeline</h2>
            <select
              value={selectedContractYear}
              onChange={(event) => setSelectedContractYear(event.target.value)}
              style={compactHeaderSelectStyle}
              aria-label="Select lead pipeline year"
            >
              {dashboardYearOptions.length === 0 ? <option value={String(selectedYearNumber)}>{selectedYearNumber}</option> : dashboardYearOptions.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>
          <div className="dashboard-pipeline-body" style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div className="dashboard-funnel-layout">
              <div className="dashboard-funnel-chart" aria-label="Lead pipeline funnel">
                {leadFunnelRows.some((row) => row.value > 0) ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <FunnelChart margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
                      <Funnel data={leadFunnelRows} dataKey="value" nameKey="label" isAnimationActive={false} onClick={() => navigate('/leads')}
                        shape={(props) => <Trapezoid {...props} height={Math.max(0, props.height - 6)} lowerWidth={props.name === 'Converted' ? props.upperWidth * .65 : props.lowerWidth} stroke={props.fill} strokeWidth={2} strokeLinejoin="round" />}>
                        {leadFunnelRows.map((row) => <Cell key={row.label} fill={row.color} />)}
                        <LabelList dataKey="value" position="center" content={({ viewBox, value }) => viewBox?.width > 40 ? <text x={viewBox.x + viewBox.width / 2} y={viewBox.y + viewBox.height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={18} fontWeight={700}>{value}</text> : null} />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
              <div className="dashboard-funnel-labels">
                {leadFunnelRows.map((row) => (
                  <button className="dashboard-funnel-label" key={row.label} type="button" onClick={() => navigate('/leads')}>
                    <i style={{ background: row.color }} />
                    <span>{row.label}<strong style={{ color: row.color }}>{row.value} ({`${leadPipeline.totalLeads > 0 ? Math.round((row.value / leadPipeline.totalLeads) * 100) : 0}%`})</strong></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="dashboard-pipeline-summary" style={{ ...shell.legendRow, marginTop: '14px', justifyContent: 'space-between' }}>
              <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
                <strong style={{ color: '#4965dd', fontSize: '19px' }}>{`${leadPipeline.conversionRate.toFixed(0)}%`}</strong>
                <span style={{ fontSize: '13px', color: isDarkTheme ? darkDashboardMuted : '#334155', fontWeight: 800 }}>Conversion Rate</span>
              </span>
              <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
                <strong style={{ color: '#16A34A', fontSize: '19px' }}>{formatCurrency(leadPipeline.pipelineValue)}</strong>
                <span style={{ fontSize: '13px', color: isDarkTheme ? darkDashboardMuted : '#334155', fontWeight: 800 }}>Pipeline Value</span>
              </span>
              <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
                <strong style={{ color: '#45ABC8', fontSize: '19px' }}>{formatCurrency(leadPipeline.avgDealValue)}</strong>
                <span style={{ fontSize: '13px', color: isDarkTheme ? darkDashboardMuted : '#334155', fontWeight: 800 }}>Avg Deal Value</span>
              </span>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header" style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}><span className="dashboard-icon dashboard-icon-green"><ChartNoAxesColumnIncreasing size={22} /></span>Income and Expense</h2>
            <select
              value={selectedContractYear}
              onChange={(event) => setSelectedContractYear(event.target.value)}
              style={compactHeaderSelectStyle}
              aria-label="Select contract year"
              >
              {dashboardYearOptions.length === 0 ? <option value={String(selectedYearNumber)}>{selectedYearNumber}</option> : dashboardYearOptions.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>

          <div className="dashboard-income-body" style={{ padding: '18px 18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div className="dashboard-income-legend" style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', color: isDarkTheme ? darkDashboardText : '#334155', fontSize: '13px', fontWeight: 800, lineHeight: 1.1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ ...shell.dot, width: '10px', height: '10px', background: incomeGreen }} />
                  <span style={incomeExpenseLegendLabelStyle}>Total Income-</span>
                  <span style={{ ...incomeExpenseLegendValueStyle, color: isDarkTheme ? darkDashboardText : '#111827' }}>{formatCurrency(selectedYearAnalytics.totalIncome)}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ ...shell.dot, width: '10px', height: '10px', background: dangerRed }} />
                  <span style={incomeExpenseLegendLabelStyle}>Total Expenses-</span>
                  <span style={{ ...incomeExpenseLegendValueStyle, color: isDarkTheme ? darkDashboardText : '#111827' }}>{formatCurrency(selectedYearAnalytics.totalExpenses)}</span>
                </span>
              </div>
            </div>

            <div className="dashboard-income-chart">
              <div style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                  <BarChart data={incomeExpenseChartData} margin={isMobile ? mobileChartMargin : getChartMargin({ mobile: isMobile })} barGap={3} barCategoryGap="18%">
                    <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                    <XAxis dataKey="label" {...getChartAxisProps({ mobile: isMobile })} {...mobileChartAxisProps} />
                    <YAxis {...getCurrencyAxisProps({ mobile: isMobile })} width={isMobile ? 58 : 76} />
                    <Tooltip {...mobileTooltipProps} position={isMobile ? { x: 0, y: 220 } : undefined} cursor={{ fill: 'var(--selected-bg)' }} content={isMobile ? <MobileDashboardTooltip /> : <SalesChartTooltip valueFormatter={(value) => money(value || 0)} />} />
                    <Bar dataKey="income" name="Income" fill={incomeGreen} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="expense" name="Expenses" fill={dangerRed} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {isMobile ? <div className="dashboard-mobile-chart-dock"><span>Tap a month to view amounts.</span></div> : null}
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header" style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}><span className="dashboard-icon dashboard-icon-blue"><Megaphone size={22} /></span>Lead Sources</h2>
            <span style={shell.sourceHeaderBadge}>{leadPipeline.sourceTotal} total</span>
          </div>
          <div className="dashboard-source-body dashboard-horizontal-sources" style={sourceBodyStyle}>
            {leadPipeline.sourceSeries.length === 0 ? (
              <div style={{ color: isDarkTheme ? darkDashboardMuted : '#334155', fontWeight: 800, fontSize: '13px' }}>No lead source data available.</div>
            ) : (
              <div className="dashboard-source-bars">
                <ResponsiveContainer width="100%" height={Math.max(180, leadPipeline.sourceSeries.length * sourceChartRowHeight + 32)}>
                  <BarChart data={leadPipeline.sourceSeries} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }} barCategoryGap="30%">
                    <CartesianGrid stroke={salesChartTheme.gridStroke} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...getChartAxisProps({ mobile: isMobile })} />
                    <YAxis type="category" dataKey="name" width={isMobile ? 88 : 110} axisLine={false} tickLine={false} interval={0}
                      tick={({ x, y, payload }) => <foreignObject x={0} y={y - sourceChartRowHeight / 2} width={Math.max(0, x - 6)} height={sourceChartRowHeight}><div className="dashboard-source-category" title={payload.value}>{mapLeadSourceDisplayLabel(payload.value)}</div></foreignObject>} />
                    <Bar dataKey="count" name="Leads" radius={[0, 5, 5, 0]} maxBarSize={24} isAnimationActive={false}>
                      {leadPipeline.sourceSeries.map((entry) => <Cell key={entry.name} fill={leadSourcePalette[entry.name] || leadSourcePalette.Other} />)}
                      <LabelList dataKey="count" position="right" fill="var(--text-primary)" fontSize={12} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header" style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}><span className="dashboard-icon dashboard-icon-purple"><FileText size={22} /></span>Top Expenses</h2>
            <select value={selectedContractYear} onChange={(event) => setSelectedContractYear(event.target.value)} aria-label="Select expense year" style={compactHeaderSelectStyle}>
              {dashboardYearOptions.map((year) => <option key={year} value={String(year)}>{year}</option>)}
            </select>
          </div>
          <div className="dashboard-expense-body" style={{ ...shell.donutWrap, padding: '18px 18px 14px' }}>
            {selectedYearAnalytics.totalExpenses !== 0 || selectedYearAnalytics.topExpenses.some((entry) => entry.amount !== 0) ? renderRoundedDonut(
              selectedYearAnalytics.topExpenses.map((entry) => ({ name: entry.name, value: entry.amount })),
              selectedYearAnalytics.totalExpenses,
              expenseColors,
              isMobile ? 148 : 220,
              isMobile ? 16 : 22,
              'All Expenses',
              formatCurrency(selectedYearAnalytics.totalExpenses),
              isMobile ? '11px' : '13px',
              isMobile ? '17px' : '24px'
            ) : (
              <div className="dashboard-empty-state">
                <span className="dashboard-icon dashboard-icon-purple"><Wallet size={26} /></span>
                <strong>No expenses recorded</strong>
                <p>Expense categories will appear here when data is available for {selectedYearNumber}.</p>
              </div>
            )}
            <div style={{ display: 'grid', gap: '10px' }}>
              {selectedYearAnalytics.topExpenses.map((entry, idx) => (
                <div key={`${entry.name}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: '10px', alignItems: 'center' }}>
                  <span style={{ ...shell.dot, width: '16px', height: '16px', borderRadius: '5px', background: expenseColors[idx % expenseColors.length] }} />
                  <span style={{ color: isDarkTheme ? darkDashboardText : '#334155', fontWeight: 700 }}>{entry.name}</span>
                  <span style={{ color: isDarkTheme ? darkDashboardText : '#0f172a', fontWeight: 800 }}>{formatCurrency(entry.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section style={salesChartSectionStyle}>
        <div className="dashboard-panel dashboard-sales-panel">
          <div className="dashboard-panel-header dashboard-sales-header" style={salesChartCardHeaderStyle}>
            <div>
              <h2 style={salesChartTitleStyle}><span className="dashboard-icon dashboard-icon-blue"><ChartNoAxesColumnIncreasing size={22} /></span>Sales Team Performance</h2>
              <p style={isMobile ? { ...salesChartSubtitleStyle, display: 'none' } : salesChartSubtitleStyle}>Month-wise target vs achievement for the selected year and salesperson.</p>
            </div>
            <div className="dashboard-sales-controls" style={salesChartHeaderControlsStyle}>
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
          <div className="dashboard-sales-body" style={salesChartBodyStyle}>
            <div className="dashboard-sales-legend" style={salesChartLegendStyle}>
              <span style={salesChartLegendItemStyle}>
                <span style={{ ...shell.dot, width: '10px', height: '10px', background: 'var(--chart-target-bar)' }} />
                <span>Target</span>
                <strong style={{ color: 'var(--chart-target-bar)' }}>{formatCurrency(salesPerformanceMonthlyTarget)}</strong>
              </span>
              <span style={salesChartLegendItemStyle}>
                <span style={{ ...shell.dot, width: '10px', height: '10px', background: '#16A34A' }} />
                <span>Achieved</span>
                <strong style={{ color: '#16A34A' }}>{formatCurrency(salesPerformanceMonthlyAchieved)}</strong>
              </span>
              <span style={{ color: isDarkTheme ? darkDashboardMuted : '#64748b', fontSize: '12px', fontWeight: 700 }}>
                {selectedSalesPersonLabel}
              </span>
            </div>

            {salesPerformanceLoading ? (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: salesPerformanceChartHeight }}>
                <div style={{ color: isDarkTheme ? darkDashboardMuted : '#64748b', fontWeight: 700 }}>Loading sales performance...</div>
              </div>
            ) : salesPerformanceTrend.length ? (
              <div style={salesChartChartWrapStyle}>
                <div className="dashboard-sales-chart-scroll" style={salesChartScrollStyle}>
                  <ChartSurface height={salesPerformanceChartHeight} minWidth={salesPerformanceChartMinWidth}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={salesPerformanceTrend}
                        margin={salesPerformanceMargin}
                        barCategoryGap={salesPerformanceChartProps.barCategoryGap}
                        barGap={4}
                      >
                        <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                        <XAxis dataKey="label" {...salesPerformanceAxisProps} />
                        <YAxis {...salesPerformanceCurrencyAxisProps} />
                        <Tooltip
                          {...mobileTooltipProps}
                          position={isMobile ? { x: 0, y: salesPerformanceChartHeight } : undefined}
                          cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                          content={isMobile ? <MobileDashboardTooltip /> : <SalesChartTooltip valueFormatter={(value) => money(value || 0)} />}
                        />
                        <Bar dataKey="target" name="Target" fill="var(--chart-target-bar)" radius={[4, 4, 0, 0]} maxBarSize={salesPerformanceChartProps.maxBarSize} />
                        <Bar dataKey="achieved" name="Achieved" radius={[4, 4, 0, 0]} maxBarSize={salesPerformanceChartProps.maxBarSize}>
                          {salesPerformanceTrend.map((entry) => (
                            <Cell key={entry.month} fill={Number(entry.achieved || 0) >= Number(entry.target || 0) ? '#16A34A' : '#DC2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                </div>
                {isMobile ? <div className="dashboard-mobile-chart-dock"><span>Tap a month to view amounts.</span></div> : null}
              </div>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', minHeight: salesPerformanceChartHeight, color: isDarkTheme ? darkDashboardMuted : '#64748b', fontWeight: 700 }}>
                No sales performance data available.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
