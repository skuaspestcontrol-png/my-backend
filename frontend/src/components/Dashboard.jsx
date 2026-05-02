import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
  heroCard: { background: 'rgba(255,255,255,0.66)', border: '1px solid rgba(159, 23, 77, 0.22)', borderRadius: '20px', padding: '18px', backdropFilter: 'blur(10px)' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' },
  metric: { background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(159, 23, 77, 0.18)', borderRadius: '18px', padding: '18px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)' },
  metricLabel: { margin: 0, color: 'var(--color-primary-dark)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' },
  metricValue: { margin: '10px 0 0 0', color: '#0f172a', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em' },
  metricSub: { margin: '6px 0 0 0', color: '#475569', fontSize: '13px' },
  graphGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' },
  panel: { background: 'rgba(255,255,255,0.9)', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.15)', padding: '20px', boxShadow: 'var(--shadow-soft)' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  panelTitle: { margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: 800 },
  panelSub: { margin: 0, color: '#334155', fontSize: '15px', fontWeight: 700 },
  total: { margin: '10px 0 14px 0', color: '#111827', fontSize: '44px', fontWeight: 800, letterSpacing: '-0.03em' },
  progressTrack: { width: '100%', height: '22px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', display: 'flex' },
  legendRow: { display: 'flex', gap: '22px', flexWrap: 'wrap', marginTop: '16px' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '14px', fontWeight: 700 },
  dot: { width: '14px', height: '14px', borderRadius: '4px', display: 'inline-block' },
  barWrap: { marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' },
  bars: { display: 'grid', gap: '10px' },
  barRow: { display: 'grid', gridTemplateColumns: '42px 1fr auto auto', alignItems: 'center', gap: '10px' },
  donutWrap: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '18px', alignItems: 'center', marginTop: '8px' },
  donut: { width: '200px', height: '200px', borderRadius: '50%', position: 'relative' },
  donutInner: { position: 'absolute', inset: '25%', borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px' }
};

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

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

export default function Dashboard() {
  const navigate = useNavigate();
  const hasLoadedRef = useRef(false);
  const [summary, setSummary] = useState(null);
  const [settings, setSettings] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [leads, setLeads] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    if (hasLoadedRef.current) return undefined;
    hasLoadedRef.current = true;
    let active = true;

    const load = async () => {
      try {
        const [summaryRes, settingsRes, invoicesRes, vendorBillsRes, leadsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/dashboard/summary`).catch(() => ({ data: null })),
          axios.get(`${API_BASE_URL}/api/settings`),
          axios.get(`${API_BASE_URL}/api/invoices`),
          axios.get(`${API_BASE_URL}/api/vendor-bills`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/leads`).catch(() => ({ data: [] }))
        ]);

        if (!active) return;
        setSummary(summaryRes?.data || null);
        setSettings(settingsRes.data || {});
        setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
        setVendorBills(Array.isArray(vendorBillsRes.data) ? vendorBillsRes.data : []);
        setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);
      } catch (error) {
        console.error('Dashboard load failed', error);
      }
    };

    load();
    const timer = window.setInterval(load, 60000);
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
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const topCards = useMemo(() => ({
    leadsCount: Number(summary?.leadsCount || 0),
    customersCount: Number(summary?.customersCount || 0),
    employeesCount: Number(summary?.employeesCount || 0),
    jobsCount: Number(summary?.jobsCount || 0),
    invoicesCount: Number(summary?.invoicesCount || invoices.length),
    invoicesTotalAmount: Number(summary?.invoicesTotalAmount || 0)
  }), [summary, invoices.length]);

  const leadPipeline = useMemo(() => {
    const totalLeads = leads.length;
    const interested = leads.filter((lead) => normalizeLeadStatus(lead.status || lead.leadStatus) === 'interested').length;
    const converted = leads.filter((lead) => normalizeLeadStatus(lead.status || lead.leadStatus) === 'converted').length;
    const cancelled = leads.filter((lead) => normalizeLeadStatus(lead.status || lead.leadStatus) === 'cancelled').length;
    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;
    const avgDealValue = converted > 0 ? analytics.totalReceivables / converted : 0;

    const sourceCounts = new Map();
    leads.forEach((lead) => {
      const key = normalizeLeadSource(lead.leadSource) || 'Unknown';
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    });
    const sourceSeries = Array.from(sourceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
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
  }, [leads, analytics.totalReceivables]);

  const companyName = settings.companyName || 'SKUAS MASTER ERP';
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
    ? { ...shell.metrics, gridTemplateColumns: '1fr' }
    : isTablet
      ? { ...shell.metrics, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : isLaptop
        ? { ...shell.metrics, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
        : shell.metrics;

  const graphGridStyle = viewportWidth >= 1200
    ? shell.graphGrid
    : { ...shell.graphGrid, gridTemplateColumns: '1fr' };

  const incomeExpenseMax = Math.max(
    ...analytics.incomeSeries.map((x) => x.value),
    ...analytics.expenseSeries.map((x) => x.value),
    1
  );

  const expenseColors = ['#56B881', '#EC7E37', '#3A6ECC', '#D45D79', '#8B5CF6'];
  const leadSourceColors = ['#3A6ECC', '#56B881', '#E8A03A', '#E14F61', '#45ABC8', '#7B61E8'];
  const leadFunnelRows = [
    { label: 'Total Leads', value: leadPipeline.totalLeads, color: '#4965dd' },
    { label: 'Interested', value: leadPipeline.interested, color: '#46a9cd' },
    { label: 'Converted', value: leadPipeline.converted, color: '#58b381' },
    { label: 'Cancelled', value: leadPipeline.cancelled, color: '#d9534f' }
  ];
  const maxLeadFunnel = Math.max(...leadFunnelRows.map((row) => row.value), 1);

  return (
    <div style={shell.page}>
      <section className="hero-section command-center" style={heroStyle}>
        <div>
          <div style={shell.badge}>
            <LayoutDashboard size={14} />
            Command Center
          </div>
          <h1 style={{ ...shell.title, color: '#ffffff' }}>{companyName}</h1>
          <p style={shell.description}>
            Live financial dashboard with real-time receivables, payables, income, and top expense trends.
          </p>
        </div>

        <div style={shell.heroCard}>
          <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-dark)' }}>
            Auto Refresh
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
            Every 60 seconds
          </div>
          <p style={{ margin: '10px 0 0 0', color: '#334155', lineHeight: 1.7, fontSize: '14px', fontWeight: 600 }}>
            Receivables: <strong>{formatCurrency(analytics.totalReceivables)}</strong> | Payables: <strong>{formatCurrency(analytics.totalPayables)}</strong>
          </p>
        </div>
      </section>

      <section className="stats-grid dashboard-grid" style={metricsStyle}>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Leads</p>
          <p style={shell.metricValue}>{topCards.leadsCount}</p>
          <p style={shell.metricSub}>Total leads</p>
        </div>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Customers</p>
          <p style={shell.metricValue}>{topCards.customersCount}</p>
          <p style={shell.metricSub}>Active customers</p>
        </div>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Employees / Jobs</p>
          <p style={shell.metricValue}>{topCards.employeesCount} / {topCards.jobsCount}</p>
          <p style={shell.metricSub}>Workforce and dispatch</p>
        </div>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Invoices Value</p>
          <p style={shell.metricValue}>{topCards.invoicesCount}</p>
          <p style={shell.metricSub}>{formatCurrency(topCards.invoicesTotalAmount)}</p>
        </div>
      </section>

      <section style={graphGridStyle}>
        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Lead Pipeline</h2>
            <span style={{ color: '#475569', fontWeight: 700 }}>This FY</span>
          </div>
          <p style={shell.panelSub}>Sales Funnel</p>
          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            {leadFunnelRows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => navigate('/leads')}
                style={{
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: row.color,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  width: `${Math.max(8, (row.value / maxLeadFunnel) * 100)}%`,
                  minWidth: '90px',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '14px' }}>{row.label}</span>
                <span style={{ fontWeight: 800, fontSize: '14px' }}>{row.value}</span>
              </button>
            ))}
          </div>
          <div style={{ ...shell.legendRow, marginTop: '18px', justifyContent: 'space-between' }}>
            <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
              <strong style={{ color: '#4965dd', fontSize: '22px' }}>{`${leadPipeline.conversionRate.toFixed(0)}%`}</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Conversion Rate</span>
            </span>
            <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
              <strong style={{ color: '#58b381', fontSize: '22px' }}>{formatCurrency(leadPipeline.pipelineValue)}</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Pipeline Value</span>
            </span>
            <span style={{ ...shell.legendItem, display: 'grid', gap: '4px' }}>
              <strong style={{ color: '#45ABC8', fontSize: '22px' }}>{formatCurrency(leadPipeline.avgDealValue)}</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Avg Deal Value</span>
            </span>
          </div>
        </article>

        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Lead Sources</h2>
            <span style={{ color: '#0f172a', fontWeight: 800, background: '#f1f5f9', borderRadius: '8px', padding: '4px 8px', fontSize: '13px' }}>{leadPipeline.sourceTotal} total</span>
          </div>
          <div style={shell.donutWrap}>
            <div
              style={{
                ...shell.donut,
                background: `conic-gradient(${leadPipeline.sourceSeries.map((item, idx) => {
                  const start = leadPipeline.sourceSeries.slice(0, idx).reduce((sum, e) => sum + e.count, 0);
                  const startPct = leadPipeline.sourceTotal > 0 ? (start / leadPipeline.sourceTotal) * 100 : 0;
                  const endPct = leadPipeline.sourceTotal > 0 ? ((start + item.count) / leadPipeline.sourceTotal) * 100 : startPct;
                  return `${leadSourceColors[idx % leadSourceColors.length]} ${startPct}% ${endPct}%`;
                }).join(', ') || '#e5e7eb 0 100%'})`
              }}
            >
              <div style={shell.donutInner}>
                <div style={{ color: '#64748b', fontWeight: 700 }}>Lead Sources</div>
                <div style={{ color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>{leadPipeline.sourceTotal}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {leadPipeline.sourceSeries.length === 0 ? (
                <div style={{ color: '#64748b', fontWeight: 700 }}>No lead source data available.</div>
              ) : leadPipeline.sourceSeries.map((entry, idx) => (
                <button
                  key={`${entry.name}-${idx}`}
                  type="button"
                  onClick={() => navigate('/leads')}
                  style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: '10px', alignItems: 'center' }}>
                    <span style={{ ...shell.dot, width: '16px', height: '16px', borderRadius: '5px', background: leadSourceColors[idx % leadSourceColors.length] }} />
                    <span style={{ color: '#334155', fontWeight: 700 }}>{entry.name}</span>
                    <span style={{ color: '#0f172a', fontWeight: 800 }}>{entry.count}</span>
                  </div>
                </button>
              ))}
            </div>
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
            <div style={{ width: `${analytics.totalReceivables > 0 ? (analytics.receivableCurrent / analytics.totalReceivables) * 100 : 0}%`, background: '#3A6ECC' }} />
            <div style={{ width: `${analytics.totalReceivables > 0 ? (analytics.receivableOverdue / analytics.totalReceivables) * 100 : 0}%`, background: '#EC7E37' }} />
          </div>
          <div style={shell.legendRow}>
            <span style={shell.legendItem}><span style={{ ...shell.dot, background: '#3A6ECC' }} />Current: {formatCurrency(analytics.receivableCurrent)}</span>
            <span style={shell.legendItem}><span style={{ ...shell.dot, background: '#EC7E37' }} />Overdue: {formatCurrency(analytics.receivableOverdue)}</span>
          </div>
        </article>

        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Total Payables</h2>
          </div>
          <p style={shell.panelSub}>Total Unpaid Bills</p>
          <p style={shell.total}>{formatCurrency(analytics.totalPayables)}</p>
          <div style={shell.progressTrack}>
            <div style={{ width: `${analytics.totalPayables > 0 ? (analytics.payableCurrent / analytics.totalPayables) * 100 : 0}%`, background: '#3A6ECC' }} />
            <div style={{ width: `${analytics.totalPayables > 0 ? (analytics.payableOverdue / analytics.totalPayables) * 100 : 0}%`, background: '#EC7E37' }} />
          </div>
          <div style={shell.legendRow}>
            <span style={shell.legendItem}><span style={{ ...shell.dot, background: '#3A6ECC' }} />Current: {formatCurrency(analytics.payableCurrent)}</span>
            <span style={shell.legendItem}><span style={{ ...shell.dot, background: '#EC7E37' }} />Overdue: {formatCurrency(analytics.payableOverdue)}</span>
          </div>
        </article>
      </section>

      <section style={graphGridStyle}>
        <article style={shell.panel}>
          <div style={shell.panelHead}>
            <h2 style={shell.panelTitle}>Income and Expense</h2>
            <span style={{ color: '#475569', fontWeight: 700 }}>This Fiscal Year</span>
          </div>
          <div style={shell.legendRow}>
            <span style={shell.legendItem}><span style={{ ...shell.dot, background: '#56B881' }} />Total Income: {formatCurrency(analytics.totalIncome)}</span>
            <span style={shell.legendItem}><span style={{ ...shell.dot, background: '#D45D79' }} />Total Expense: {formatCurrency(analytics.totalExpenses)}</span>
          </div>
          <div style={shell.barWrap}>
            <div style={shell.bars}>
              {analytics.incomeSeries.map((m, index) => {
                const income = m.value;
                const expense = analytics.expenseSeries[index]?.value || 0;
                return (
                  <div key={m.label} style={shell.barRow}>
                    <span style={{ color: '#64748b', fontWeight: 700 }}>{m.label}</span>
                    <div style={{ position: 'relative', height: '16px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(income / incomeExpenseMax) * 100}%`, background: '#56B881' }} />
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(expense / incomeExpenseMax) * 100}%`, background: '#D45D79', opacity: 0.72 }} />
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
            <span style={{ color: '#475569', fontWeight: 700 }}>This Fiscal Year</span>
          </div>
          <div style={shell.donutWrap}>
            <div
              style={{
                ...shell.donut,
                background: `conic-gradient(${analytics.topExpenses.map((item, idx) => {
                  const start = analytics.topExpenses.slice(0, idx).reduce((sum, e) => sum + e.amount, 0);
                  const startPct = analytics.totalExpenseAmount > 0 ? (start / analytics.totalExpenseAmount) * 100 : 0;
                  const endPct = analytics.totalExpenseAmount > 0 ? ((start + item.amount) / analytics.totalExpenseAmount) * 100 : startPct;
                  return `${expenseColors[idx % expenseColors.length]} ${startPct}% ${endPct}%`;
                }).join(', ') || '#e5e7eb 0 100%'})`
              }}
            >
              <div style={shell.donutInner}>
                <div style={{ color: '#64748b', fontWeight: 700 }}>All Expenses</div>
                <div style={{ color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>{formatCurrency(analytics.totalExpenseAmount)}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {analytics.topExpenses.length === 0 ? (
                <div style={{ color: '#64748b', fontWeight: 700 }}>No expense data available.</div>
              ) : analytics.topExpenses.map((entry, idx) => (
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
