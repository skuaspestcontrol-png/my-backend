import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Database,
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingCart,
  Truck,
  UserCheck,
  Users
} from 'lucide-react';

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
  grid: { display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '18px' },
  panel: { background: 'rgba(255,255,255,0.86)', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.16)', padding: '22px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)' },
  sectionTitle: { margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: 800 },
  sectionSub: { margin: '6px 0 0 0', color: '#475569', fontSize: '13px', lineHeight: 1.6 },
  answerGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '14px' },
  answerCard: { border: '1px solid rgba(159, 23, 77, 0.18)', borderRadius: '14px', padding: '12px', background: 'rgba(252,231,243,0.6)' },
  answerQuestion: { margin: 0, color: '#0f172a', fontSize: '12px', fontWeight: 800, lineHeight: 1.4 },
  answerValue: { margin: '8px 0 0 0', color: 'var(--color-primary-dark)', fontSize: '13px', fontWeight: 700, lineHeight: 1.5 },
  moduleGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '16px' },
  moduleCard: {
    display: 'flex',
    gap: '14px',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    background: 'rgba(255,255,255,0.76)',
    textDecoration: 'none',
    color: '#111111',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 10px 20px rgba(159, 23, 77, 0.08)'
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  listItem: { display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '14px 0', borderBottom: '1px solid rgba(159, 23, 77, 0.14)' },
  pill: { display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', border: '1px solid rgba(159, 23, 77, 0.2)', padding: '6px 10px', background: 'rgba(252,231,243,0.7)', fontSize: '12px', color: 'var(--color-primary-dark)', fontWeight: 700 }
};

const MODULES = [
  { label: 'Leads', path: '/leads', icon: Users, tone: 'var(--color-primary)', summary: 'Capture and convert inbound demand' },
  { label: 'Contract', path: '/sales/contracts', icon: Briefcase, tone: 'var(--color-primary)', summary: 'Track contracts and renewals' },
  { label: 'Customers', path: '/sales/customers', icon: Building2, tone: 'var(--color-primary-dark)', summary: 'Manage customer records and history' },
  { label: 'Invoices', path: '/sales/invoices', icon: Database, tone: 'var(--color-primary-dark)', summary: 'Track invoice lifecycle and due balances' },
  { label: 'Purchase', path: '/purchase/vendors', icon: ShoppingCart, tone: 'var(--color-primary-dark)', summary: 'Manage vendors, bills, and payouts' },
  { label: 'WhatsApp Marketing', path: '/whatsapp', icon: MessageSquare, tone: 'var(--color-primary-dark)', summary: 'Run campaign lists and followups' },
  { label: 'Assign Services', path: '/schedule-job', icon: Truck, tone: 'var(--color-primary-dark)', summary: 'Dispatch jobs to field technicians' },
  { label: 'Service Calendar', path: '/service-calendar', icon: CalendarDays, tone: 'var(--color-primary)', summary: 'View schedule commitments' },
  { label: 'Field Operations', path: '/technician-portal', icon: Building2, tone: 'var(--color-primary-dark)', summary: 'Monitor active service execution' },
  { label: 'Complaints', path: '/complaints', icon: Bell, tone: 'var(--color-primary-dark)', summary: 'Resolve escalations and callbacks' },
  { label: 'Employee Master', path: '/employees', icon: UserCheck, tone: 'var(--color-primary)', summary: 'Maintain staff records and roles' },
  { label: 'HR Dashboard', path: '/hr-dashboard', icon: LayoutDashboard, tone: 'var(--color-primary-dark)', summary: 'Eagle-eye workforce, attendance, and performance insights' },
  { label: 'Payroll', path: '/payroll', icon: CircleDollarSign, tone: 'var(--color-primary-dark)', summary: 'Salary setup, payroll run, slips, and payments' },
  { label: 'Items', path: '/items', icon: Package, tone: 'var(--color-primary)', summary: 'Manage service and product master' }
];

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const formatCountWithNames = (names) => {
  if (names.length === 0) return 'None';
  const top = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${top} +${names.length - 3} more` : top;
};

const toDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getEmployeeName = (employee) => {
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  return fullName || employee.empCode || 'Unnamed';
};

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [serviceSchedules, setServiceSchedules] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [
          leadRes,
          employeeRes,
          jobRes,
          settingsRes,
          invoicesRes,
          paymentsRes,
          schedulesRes,
          customersRes,
          itemsRes
        ] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/leads`),
          axios.get(`${API_BASE_URL}/api/employees`),
          axios.get(`${API_BASE_URL}/api/jobs`),
          axios.get(`${API_BASE_URL}/api/settings`),
          axios.get(`${API_BASE_URL}/api/invoices`),
          axios.get(`${API_BASE_URL}/api/payments`),
          axios.get(`${API_BASE_URL}/api/service-schedules`),
          axios.get(`${API_BASE_URL}/api/customers`),
          axios.get(`${API_BASE_URL}/api/items`)
        ]);

        if (!mounted) return;
        setLeads(Array.isArray(leadRes.data) ? leadRes.data : []);
        setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
        setJobs(Array.isArray(jobRes.data) ? jobRes.data : []);
        setSettings(settingsRes.data || {});
        setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
        setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
        setServiceSchedules(Array.isArray(schedulesRes.data) ? schedulesRes.data : []);
        setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      } catch (error) {
        console.error('Dashboard load failed', error);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const dashboardData = useMemo(() => {
    const now = new Date();
    const today = toDateOnly(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const next7Days = addDays(today, 7);
    const next30Days = addDays(today, 30);

    const newLeadsToday = leads.filter((lead) => {
      const leadDate = toDateOnly(lead.date || lead.createdAt);
      return leadDate && leadDate.getTime() === today.getTime();
    });

    const followupDueLeads = leads.filter((lead) => {
      const followupDate = toDateOnly(lead.followupDate);
      if (!followupDate || followupDate > today) return false;
      const status = normalizeText(lead.status || lead.leadStatus);
      return !status.includes('converted') && !status.includes('cancel');
    });

    const dueServiceEntries = serviceSchedules.filter((entry) => {
      const serviceDate = toDateOnly(entry.serviceDate);
      const status = normalizeText(entry.status);
      if (!serviceDate) return false;
      if (status.includes('completed') || status.includes('cancel')) return false;
      return serviceDate >= today && serviceDate <= next7Days;
    });

    const dueServiceCustomers = Array.from(
      new Set(
        dueServiceEntries
          .map((entry) => String(entry.customerName || '').trim())
          .filter(Boolean)
      )
    );

    const contractRows = invoices.flatMap((invoice) =>
      (Array.isArray(invoice.items) ? invoice.items : []).map((line) => ({
        customerName: invoice.customerName || '',
        itemName: line.itemName || '',
        contractEndDate: line.contractEndDate || '',
        renewalDate: line.renewalDate || ''
      }))
    );

    const contractsExpiring = contractRows.filter((row) => {
      const endDate = toDateOnly(row.contractEndDate);
      return endDate && endDate >= today && endDate <= next30Days;
    });

    const renewalReminders = contractRows.filter((row) => {
      const renewalDate = toDateOnly(row.renewalDate);
      return renewalDate && renewalDate >= today && renewalDate <= next30Days;
    });

    const unpaidInvoices = invoices.filter((invoice) => Number(invoice.balanceDue || 0) > 0.01 || normalizeText(invoice.status) !== 'paid');
    const unpaidAmount = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);

    const technicianActivities = jobs.filter((job) => {
      const scheduledDate = toDateOnly(job.scheduledDate || job.date || job.createdAt);
      const status = normalizeText(job.status);
      return (scheduledDate && scheduledDate.getTime() === today.getTime()) || status === 'in progress';
    });

    const technicianNamesToday = Array.from(
      new Set(
        technicianActivities
          .map((job) => String(job.technicianName || '').trim())
          .filter(Boolean)
      )
    );

    const monthInvoices = invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.date || invoice.createdAt || 0);
      if (Number.isNaN(invoiceDate.getTime())) return false;
      return invoiceDate >= monthStart && invoiceDate <= monthEnd;
    });

    const revenueThisMonth = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || invoice.total || 0), 0);
    const paymentsThisMonth = payments.filter((payment) => {
      const paidOn = new Date(payment.paymentDate || payment.date || payment.createdAt || 0);
      if (Number.isNaN(paidOn.getTime())) return false;
      return paidOn >= monthStart && paidOn <= monthEnd;
    });
    const collectionsThisMonth = paymentsThisMonth.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const itemPurchaseCostMap = new Map(
      items.map((item) => [String(item._id || ''), Number(item.purchaseRate || 0)])
    );

    const materialExpenseThisMonth = monthInvoices.reduce((sum, invoice) => {
      const lines = Array.isArray(invoice.items) ? invoice.items : [];
      const lineCost = lines.reduce((lineSum, line) => {
        const quantity = Number(line.quantity || 1);
        const purchaseRate = Number(line.purchaseRate ?? itemPurchaseCostMap.get(String(line.itemId || '')) ?? 0);
        return lineSum + quantity * purchaseRate;
      }, 0);
      return sum + lineCost;
    }, 0);

    const payrollExpense = employees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0);
    const expenseThisMonth = payrollExpense + materialExpenseThisMonth;

    const serviceRevenueMap = new Map();
    invoices.forEach((invoice) => {
      const lines = Array.isArray(invoice.items) ? invoice.items : [];
      lines.forEach((line) => {
        const name = String(line.itemName || 'Unspecified Service').trim();
        const quantity = Number(line.quantity || 1);
        const rate = Number(line.rate || 0);
        serviceRevenueMap.set(name, (serviceRevenueMap.get(name) || 0) + (quantity * rate));
      });
    });

    const topServices = Array.from(serviceRevenueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    let presentStaff = 0;
    let onLeaveStaff = 0;
    employees.forEach((employee) => {
      const status = normalizeText(employee.attendanceStatus || employee.attendance || employee.dayStatus || employee.status);
      if (status.includes('present')) presentStaff += 1;
      if (status.includes('leave') || status.includes('absent')) onLeaveStaff += 1;
    });

    if (presentStaff === 0 && onLeaveStaff === 0 && technicianNamesToday.length > 0) {
      const activeNameSet = new Set(technicianNamesToday.map((name) => normalizeText(name)));
      presentStaff = employees.filter((employee) => activeNameSet.has(normalizeText(getEmployeeName(employee)))).length;
    }

    const unmarkedStaff = Math.max(employees.length - presentStaff - onLeaveStaff, 0);

    const renewalCustomers = Array.from(
      new Set(
        renewalReminders
          .map((entry) => String(entry.customerName || '').trim())
          .filter(Boolean)
      )
    );

    const recentLeads = [...leads]
      .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
      .slice(0, 5);

    return {
      now,
      newLeadsToday,
      followupDueLeads,
      dueServiceCustomers,
      contractsExpiring,
      unpaidInvoices,
      unpaidAmount,
      technicianNamesToday,
      revenueThisMonth,
      collectionsThisMonth,
      expenseThisMonth,
      topServices,
      presentStaff,
      onLeaveStaff,
      unmarkedStaff,
      renewalCustomers,
      recentLeads
    };
  }, [customers, employees, invoices, items, jobs, leads, payments, serviceSchedules]);

  const questionCards = useMemo(
    () => [
      {
        question: 'How many new leads came today?',
        answer: `${dashboardData.newLeadsToday.length} new lead(s) logged today`
      },
      {
        question: 'Which leads need follow-up?',
        answer: `${dashboardData.followupDueLeads.length} due: ${formatCountWithNames(dashboardData.followupDueLeads.map((lead) => lead.customerName || lead.mobile || 'Unnamed lead'))}`
      },
      {
        question: 'Which customers are due for service?',
        answer: `${dashboardData.dueServiceCustomers.length} due in next 7 days: ${formatCountWithNames(dashboardData.dueServiceCustomers)}`
      },
      {
        question: 'Which contracts are expiring?',
        answer: `${dashboardData.contractsExpiring.length} contract line(s) expiring in next 30 days`
      },
      {
        question: 'Which invoices are unpaid?',
        answer: `${dashboardData.unpaidInvoices.length} unpaid invoice(s), pending ${formatCurrency(dashboardData.unpaidAmount)}`
      },
      {
        question: 'What are technicians doing today?',
        answer: `${dashboardData.technicianNamesToday.length} active: ${formatCountWithNames(dashboardData.technicianNamesToday)}`
      },
      {
        question: 'How much revenue vs expense this month?',
        answer: `Revenue ${formatCurrency(dashboardData.revenueThisMonth)} vs Expense ${formatCurrency(dashboardData.expenseThisMonth)}`
      },
      {
        question: 'Which services bring the most business?',
        answer:
          dashboardData.topServices.length === 0
            ? 'No service revenue data yet'
            : dashboardData.topServices.map(([name, amount]) => `${name} (${formatCurrency(amount)})`).join(' | ')
      },
      {
        question: 'Which staff are present or on leave?',
        answer: `Present ${dashboardData.presentStaff}, On Leave ${dashboardData.onLeaveStaff}, Unmarked ${dashboardData.unmarkedStaff}`
      },
      {
        question: 'Which customers need renewal reminders?',
        answer: `${dashboardData.renewalCustomers.length} customer(s): ${formatCountWithNames(dashboardData.renewalCustomers)}`
      }
    ],
    [dashboardData]
  );

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
  const gridStyle = viewportWidth >= 1200 ? shell.grid : { ...shell.grid, gridTemplateColumns: '1fr' };
  const answerGridStyle = isMobile ? { ...shell.answerGrid, gridTemplateColumns: '1fr' } : shell.answerGrid;
  const moduleGridStyle = isMobile ? { ...shell.moduleGrid, gridTemplateColumns: '1fr' } : shell.moduleGrid;
  const titleStyle = isMobile
    ? { ...shell.title, fontSize: isSmallMobile ? '22px' : '26px', lineHeight: 1.15 }
    : shell.title;

  return (
    <div style={shell.page}>
      <section className="hero-section command-center" style={heroStyle}>
        <div>
          <div style={shell.badge}>
            <LayoutDashboard size={14} />
            Command Center
          </div>
          <h1 style={{ ...titleStyle, color: '#ffffff' }}>{companyName}</h1>
          <p style={shell.description}>
            White, maroon, and soft-pink dashboard now gives instant business answers for leads, followups, services, contracts, invoices, technician activity, revenue, expense, and renewals.
          </p>
        </div>

        <div style={shell.heroCard}>
          <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-dark)' }}>
            Today&apos;s Focus
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
            {dashboardData.newLeadsToday.length > 0 ? `${dashboardData.newLeadsToday.length} new lead(s) today` : 'No new leads yet today'}
          </div>
          <p style={{ margin: '10px 0 0 0', color: '#334155', lineHeight: 1.7, fontSize: '14px', fontWeight: 600 }}>
            Collections this month: <strong>{formatCurrency(dashboardData.collectionsThisMonth)}</strong>. Keep followups and renewals active to sustain momentum.
          </p>
        </div>
      </section>

      <section className="stats-grid dashboard-grid" style={metricsStyle}>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>New Leads Today</p>
          <p style={shell.metricValue}>{dashboardData.newLeadsToday.length}</p>
          <p style={shell.metricSub}>Fresh enquiries captured today</p>
        </div>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Follow-ups Due</p>
          <p style={shell.metricValue}>{dashboardData.followupDueLeads.length}</p>
          <p style={shell.metricSub}>Leads requiring immediate callback</p>
        </div>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Unpaid Invoices</p>
          <p style={shell.metricValue}>{dashboardData.unpaidInvoices.length}</p>
          <p style={shell.metricSub}>Outstanding: {formatCurrency(dashboardData.unpaidAmount)}</p>
        </div>
        <div style={shell.metric}>
          <p style={shell.metricLabel}>Revenue This Month</p>
          <p style={shell.metricValue}>{formatCurrency(dashboardData.revenueThisMonth)}</p>
          <p style={shell.metricSub}>Compared with expense {formatCurrency(dashboardData.expenseThisMonth)}</p>
        </div>
      </section>

      <section className="content-grid dashboard-section-grid" style={gridStyle}>
        <div style={shell.panel}>
          <h2 style={shell.sectionTitle}>Instant Answers</h2>
          <p style={shell.sectionSub}>All core business questions are answered from live module data.</p>
          <div style={answerGridStyle}>
            {questionCards.map((card) => (
              <article key={card.question} style={shell.answerCard}>
                <p style={shell.answerQuestion}>{card.question}</p>
                <p style={shell.answerValue}>{card.answer}</p>
              </article>
            ))}
          </div>
        </div>

        <div style={shell.panel}>
          <h2 style={shell.sectionTitle}>Operations Snapshot</h2>
          <p style={shell.sectionSub}>Quick operating view for dispatch, contracts, and billing.</p>
          <div style={shell.list}>
            <div style={shell.listItem}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px' }}>Customers Due For Service</div>
                <div style={shell.metricSub}>{formatCountWithNames(dashboardData.dueServiceCustomers)}</div>
              </div>
              <span style={shell.pill}>{dashboardData.dueServiceCustomers.length}</span>
            </div>
            <div style={shell.listItem}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px' }}>Contracts Expiring</div>
                <div style={shell.metricSub}>Within next 30 days</div>
              </div>
              <span style={shell.pill}>{dashboardData.contractsExpiring.length}</span>
            </div>
            <div style={{ ...shell.listItem, borderBottom: 'none' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px' }}>Renewal Reminders</div>
                <div style={shell.metricSub}>{formatCountWithNames(dashboardData.renewalCustomers)}</div>
              </div>
              <span style={shell.pill}>{dashboardData.renewalCustomers.length}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid dashboard-section-grid" style={gridStyle}>
        <div style={shell.panel}>
          <h2 style={shell.sectionTitle}>Module Shortcuts</h2>
          <p style={shell.sectionSub}>Jump directly into the exact workspace that needs action.</p>
          <div style={moduleGridStyle}>
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.path} to={module.path} style={shell.moduleCard}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: module.tone,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px' }}>{module.label}</div>
                    <div style={{ marginTop: '6px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{module.summary}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div style={shell.panel}>
          <h2 style={shell.sectionTitle}>Recent Leads</h2>
          <p style={shell.sectionSub}>Latest captured opportunities in your sales queue.</p>
          <div style={shell.list}>
            {dashboardData.recentLeads.length === 0 ? (
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--color-primary-light)', border: '1px solid rgba(159, 23, 77, 0.2)', color: '#475569' }}>
                No lead records yet. Start with the Leads module to begin capturing enquiries.
              </div>
            ) : (
              dashboardData.recentLeads.map((lead) => (
                <div key={lead._id || `${lead.customerName}-${lead.mobile}`} style={shell.listItem}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{lead.customerName || 'Unnamed Lead'}</div>
                    <div style={{ marginTop: '4px', color: '#475569', fontSize: '13px' }}>
                      {lead.leadSource || 'Direct'} • {lead.city || lead.areaName || 'Location not set'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--color-primary-dark)', fontSize: '12px' }}>{lead.status || lead.leadStatus || 'New Lead'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
