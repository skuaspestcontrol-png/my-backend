import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
  metricLabel: { margin: 0, color: 'var(--color-primary-dark)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' },
  metricValue: { margin: '10px 0 0 0', color: '#0f172a', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em' },
  metricSub: { margin: '6px 0 0 0', color: '#475569', fontSize: '13px' },
  graphGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' },
  panel: { background: '#fff', borderRadius: '22px', border: '1px solid #dbe4f0', padding: '18px 18px 20px', boxShadow: 'none' },
  sourcePanel: { background: '#fff', borderRadius: '22px', border: '1px solid #dbe4f0', padding: 0, overflow: 'hidden', boxShadow: 'none' },
  sourceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '15px 22px', background: '#f8fafc', borderBottom: '1px solid #dbe4f0' },
  sourceHeaderTitle: { margin: 0, color: '#475569', fontSize: '19px', fontWeight: 700 },
  sourceHeaderBadge: { color: '#111827', fontWeight: 700, background: '#f1f5f9', borderRadius: '10px', padding: '6px 10px', fontSize: '13px', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.10)' },
  sourceBody: { padding: '18px 18px 18px', display: 'grid', gap: '14px', alignItems: 'center' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  panelTitle: { margin: 0, color: '#475569', fontSize: '19px', fontWeight: 700 },
  panelSub: { margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 600 },
  total: { margin: '8px 0 12px 0', color: '#111827', fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em' },
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
  const dashboardLoadingRef = useRef(false);
  const cachedDashboardState = useMemo(() => readDashboardCache(), []);
  const [summary, setSummary] = useState(() => cachedDashboardState?.summary || null);
  const [settings, setSettings] = useState(() => cachedDashboardState?.settings || {});
  const [invoices, setInvoices] = useState(() => cachedDashboardState?.invoices || []);
  const [vendorBills, setVendorBills] = useState(() => cachedDashboardState?.vendorBills || []);
  const [leads, setLeads] = useState(() => cachedDashboardState?.leads || []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [selectedContractYear, setSelectedContractYear] = useState(() => String(new Date().getFullYear()));

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

  useEffect(() => {
    if (contractYears.length === 0) return;
    setSelectedContractYear((current) => {
      if (contractYears.some((year) => String(year) === String(current))) return String(current);
      return String(contractYears[contractYears.length - 1]);
    });
  }, [contractYears]);

  const selectedYearNumber = Number(selectedContractYear) || new Date().getFullYear();

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
    const avgDealValue = converted > 0 ? analytics.totalReceivables / converted : 0;

    const sourceCounts = new Map();
    selectedYearLeads.forEach((lead) => {
      const key = mapLeadSourceLabel(lead.leadSource);
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    });
    invoices.forEach((invoice) => {
      const rawSource = String(invoice?.leadSource || invoice?.lead_source || '').trim();
      if (!rawSource) return;
      const key = mapLeadSourceLabel(rawSource);
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
      pipelineValue: 0,
      avgDealValue,
      sourceSeries,
      sourceTotal
    };
  }, [leads, invoices, analytics.totalReceivables, selectedYearNumber]);

  const companyName = String(settings.companyName || settings.gstCompanyName || 'SKUAS Pest Control Private Limited').trim();
  const aboutTagline = String(settings.aboutTagline || 'Professional in Pest Control').trim();
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth <= 991;
  const isLaptop = viewportWidth >= 992 && viewportWidth <= 1199;
  const isSmallMobile = viewportWidth < 420;

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
    ? shell.graphGrid
    : { ...shell.graphGrid, gridTemplateColumns: '1fr' };
  const sourceBodyStyle = isMobile
    ? { ...shell.sourceBody, justifyItems: 'center' }
    : { ...shell.sourceBody, gridTemplateColumns: 'minmax(280px, 520px) minmax(220px, 1fr)', justifyItems: 'stretch' };
  const sourceLegendStyle = isMobile
    ? { ...shell.sourceLegend, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px', justifyItems: 'center', textAlign: 'center', maxWidth: '100%' }
    : { ...shell.sourceLegend, justifyItems: 'stretch', textAlign: 'left', maxWidth: '280px' };
  const sourceLegendItemStyle = isMobile
    ? { ...shell.sourceLegendItem, gridTemplateColumns: '11px auto auto', gap: '7px', fontSize: '11px', justifyContent: 'center' }
    : shell.sourceLegendItem;

  const incomeExpenseMax = Math.max(
    ...selectedYearAnalytics.incomeSeries.map((x) => x.value),
    ...selectedYearAnalytics.expenseSeries.map((x) => x.value),
    1
  );

  const successGreen = '#16A34A';
  const dangerRed = '#DC2626';
  const neutralBlack = '#111827';
  const expenseColors = ['#16A34A', '#DC2626', '#111827', '#8B5CF6', '#0F766E'];
  const leadFunnelRows = [
    { label: 'Total Leads', value: leadPipeline.totalLeads, color: '#4965dd' },
    { label: 'Interested', value: leadPipeline.interested, color: '#12abc4' },
    { label: 'Converted', value: leadPipeline.converted, color: '#18b985' }
  ];
  const maxLeadFunnel = Math.max(...leadFunnelRows.map((row) => row.value), 1);

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
          <p style={metricValueStyle}>{topCards.invoicesCount}</p>
          <p style={metricSubStyle}>{formatCurrency(topCards.invoicesTotalAmount)}</p>
        </div>
      </section>

      <section style={graphGridStyle}>
        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Lead Pipeline</h2>
            <select
              value={selectedContractYear}
              onChange={(event) => setSelectedContractYear(event.target.value)}
              style={{
                border: '1px solid #dbe4f0',
                background: '#f8fafc',
                color: '#334155',
                fontWeight: 700,
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '12px',
                outline: 'none',
                minWidth: '110px'
              }}
              aria-label="Select lead pipeline year"
            >
              {contractYears.length === 0 ? <option value={String(selectedYearNumber)}>{selectedYearNumber}</option> : contractYears.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '14px', marginTop: '18px' }}>
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
                  gridTemplateColumns: isMobile ? '92px minmax(0, 1fr) 44px' : '126px minmax(0, 1fr) 56px',
                  alignItems: 'center',
                  gap: isMobile ? '10px' : '14px',
                  width: '100%',
                  textAlign: 'left',
                  minHeight: '56px'
                }}
              >
                <span style={{ color: '#42526a', fontWeight: 800, fontSize: isMobile ? '13px' : '15px', textAlign: 'left', justifySelf: 'start' }}>{row.label}</span>
                <span style={{ display: 'block', width: '100%', minWidth: 0 }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: isMobile ? '42px' : '48px',
                      width: `${Math.max(row.value > 0 ? 12 : 0, (row.value / maxLeadFunnel) * 100)}%`,
                      minWidth: row.value > 0 ? (isMobile ? '54px' : '70px') : '0',
                      borderRadius: '7px',
                      background: row.color,
                      color: '#fff',
                      padding: row.value > 0 ? '0 14px' : 0,
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                  >
                    <strong style={{ fontSize: isMobile ? '16px' : '18px', lineHeight: 1 }}>{row.value}</strong>
                  </span>
                </span>
                <span style={{ color: '#64748b', fontWeight: 700, fontSize: isMobile ? '13px' : '15px', textAlign: 'left' }}>
                  {`${leadPipeline.totalLeads > 0 ? Math.round((row.value / leadPipeline.totalLeads) * 100) : 0}%`}
                </span>
              </button>
            ))}
          </div>
          <div style={{ ...shell.legendRow, marginTop: '18px', justifyContent: 'space-between' }}>
            <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
              <strong style={{ color: '#4965dd', fontSize: '22px' }}>{`${leadPipeline.conversionRate.toFixed(0)}%`}</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Conversion Rate</span>
            </span>
            <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
              <strong style={{ color: '#16A34A', fontSize: '22px' }}>{formatCurrency(leadPipeline.pipelineValue)}</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Pipeline Value</span>
            </span>
            <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
              <strong style={{ color: '#45ABC8', fontSize: '22px' }}>{formatCurrency(leadPipeline.avgDealValue)}</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Avg Deal Value</span>
            </span>
          </div>
        </article>

        <article style={shell.sourcePanel}>
          <div style={shell.sourceHeader}>
            <h2 style={shell.sourceHeaderTitle}>Lead Sources</h2>
            <span style={shell.sourceHeaderBadge}>{leadPipeline.sourceTotal} total</span>
          </div>
          <div style={sourceBodyStyle}>
            <div
              style={{
                ...shell.donut,
                justifySelf: 'center',
                background: `conic-gradient(${leadPipeline.sourceSeries.reduce((segments, item, index, list) => {
                  const entryColor = leadSourcePalette[item.name] || leadSourcePalette.Other;
                  const start = list.slice(0, index).reduce((sum, e) => sum + e.count, 0);
                  const startPct = leadPipeline.sourceTotal > 0 ? (start / leadPipeline.sourceTotal) * 100 : 0;
                  const endPct = leadPipeline.sourceTotal > 0 ? ((start + item.count) / leadPipeline.sourceTotal) * 100 : startPct;
                  segments.push(`${entryColor} ${startPct}% ${endPct}%`);
                  return segments;
                }, []).join(', ') || '#e5e7eb 0 100%'})`
              }}
            >
              <div style={shell.donutInner}>
                <div style={{ color: '#64748b', fontWeight: 700, fontSize: '14px' }}>Lead Sources</div>
                <div style={{ color: '#0f172a', fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>{leadPipeline.sourceTotal}</div>
              </div>
            </div>
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
      </section>

      <section style={graphGridStyle}>
        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Total Receivables</h2>
          </div>
          <p style={shell.panelSub}>Total Unpaid Invoices</p>
          <p style={shell.total}>{formatCurrency(analytics.totalReceivables)}</p>
          <div style={shell.progressTrack}>
            <div style={{ width: `${analytics.totalReceivables > 0 ? (analytics.receivableCurrent / analytics.totalReceivables) * 100 : 0}%`, background: successGreen }} />
            <div style={{ width: `${analytics.totalReceivables > 0 ? (analytics.receivableOverdue / analytics.totalReceivables) * 100 : 0}%`, background: dangerRed }} />
          </div>
          <div style={shell.legendRow}>
            <span style={{ ...shell.legendItem, color: '#166534' }}><span style={{ ...shell.dot, background: successGreen }} />Current: {formatCurrency(analytics.receivableCurrent)}</span>
            <span style={{ ...shell.legendItem, color: '#9f1239' }}><span style={{ ...shell.dot, background: dangerRed }} />Overdue: {formatCurrency(analytics.receivableOverdue)}</span>
          </div>
        </article>

        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Total Payables</h2>
          </div>
          <p style={shell.panelSub}>Total Unpaid Bills</p>
          <p style={shell.total}>{formatCurrency(analytics.totalPayables)}</p>
          <div style={shell.progressTrack}>
            <div style={{ width: `${analytics.totalPayables > 0 ? (analytics.payableCurrent / analytics.totalPayables) * 100 : 0}%`, background: successGreen }} />
            <div style={{ width: `${analytics.totalPayables > 0 ? (analytics.payableOverdue / analytics.totalPayables) * 100 : 0}%`, background: dangerRed }} />
          </div>
          <div style={shell.legendRow}>
            <span style={{ ...shell.legendItem, color: '#166534' }}><span style={{ ...shell.dot, background: successGreen }} />Current: {formatCurrency(analytics.payableCurrent)}</span>
            <span style={{ ...shell.legendItem, color: '#9f1239' }}><span style={{ ...shell.dot, background: dangerRed }} />Overdue: {formatCurrency(analytics.payableOverdue)}</span>
          </div>
        </article>
      </section>

      <section style={graphGridStyle}>
        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Income and Expense</h2>
            <select
              value={selectedContractYear}
              onChange={(event) => setSelectedContractYear(event.target.value)}
              style={{
                border: '1px solid #dbe4f0',
                background: '#f8fafc',
                color: '#334155',
                fontWeight: 700,
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '12px',
                outline: 'none',
                minWidth: '110px'
              }}
              aria-label="Select contract year"
            >
              {contractYears.length === 0 ? <option value={String(selectedYearNumber)}>{selectedYearNumber}</option> : contractYears.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>
          <div style={shell.legendRow}>
            <span style={{ ...shell.legendItem, color: '#166534' }}><span style={{ ...shell.dot, background: successGreen }} />Total Income: {formatCurrency(selectedYearAnalytics.totalIncome)}</span>
            <span style={{ ...shell.legendItem, color: '#9f1239' }}><span style={{ ...shell.dot, background: dangerRed }} />Total Expense: {formatCurrency(selectedYearAnalytics.totalExpenses)}</span>
          </div>
          <div style={shell.barWrap}>
            <div style={shell.bars}>
              {selectedYearAnalytics.incomeSeries.map((m, index) => {
                const income = m.value;
                const expense = selectedYearAnalytics.expenseSeries[index]?.value || 0;
                return (
                  <div key={m.label} style={shell.barRow}>
                    <span style={{ color: '#64748b', fontWeight: 700 }}>{m.label}</span>
                    <div style={{ position: 'relative', height: '16px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(income / incomeExpenseMax) * 100}%`, background: successGreen }} />
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(expense / incomeExpenseMax) * 100}%`, background: dangerRed, opacity: 0.72 }} />
                    </div>
                    <span style={{ color: '#166534', fontWeight: 700, fontSize: '12px' }}>{formatCurrency(income)}</span>
                    <span style={{ color: '#9f1239', fontWeight: 700, fontSize: '12px' }}>{formatCurrency(expense)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Top Expenses</h2>
            <span style={{ color: '#475569', fontWeight: 700 }}>{selectedYearNumber}</span>
          </div>
          <div style={shell.donutWrap}>
            <div
              style={{
                ...shell.donut,
                background: `conic-gradient(${selectedYearAnalytics.topExpenses.map((item, idx) => {
                  const start = selectedYearAnalytics.topExpenses.slice(0, idx).reduce((sum, e) => sum + e.amount, 0);
                  const startPct = selectedYearAnalytics.totalExpenseAmount > 0 ? (start / selectedYearAnalytics.totalExpenseAmount) * 100 : 0;
                  const endPct = selectedYearAnalytics.totalExpenseAmount > 0 ? ((start + item.amount) / selectedYearAnalytics.totalExpenseAmount) * 100 : startPct;
                  return `${expenseColors[idx % expenseColors.length]} ${startPct}% ${endPct}%`;
                }).join(', ') || '#e5e7eb 0 100%'})`
              }}
            >
              <div style={shell.donutInner}>
                <div style={{ color: '#64748b', fontWeight: 700 }}>All Expenses</div>
                <div style={{ color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>{formatCurrency(selectedYearAnalytics.totalExpenseAmount)}</div>
              </div>
            </div>
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
    </div>
  );
}
