import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  BarChart3,
  CalendarDays,
  Download,
  FileDown,
  FileSpreadsheet,
  Filter,
  Gift,
  LoaderCircle,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Target,
  Trophy,
  Users,
  UserRound,
  TrendingUp,
  Wallet
} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import AppTextarea from '../../components/ui/AppTextarea';
import DashboardStatCard from '../../components/ui/DashboardStatCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { currentMonth, currentYear, integer, monthOptions, money, percent, safeRows, salesExportUrl, apiGet } from './salesPerformanceApi';

const views = {
  dashboard: {
    title: 'Sales Performance Dashboard',
    subtitle: 'Track team target versus achievement with live charts and quick action cards.'
  },
  targets: {
    title: 'Sales Target Setup',
    subtitle: 'Assign weekly, monthly, and yearly targets to each sales employee.'
  },
  weekly: {
    title: 'Weekly Performance',
    subtitle: 'Review week-wise target versus achievement for each sales person.'
  },
  monthly: {
    title: 'Monthly Performance',
    subtitle: 'Filter by person, service type, and lead source to inspect monthly performance.'
  },
  yearly: {
    title: 'Yearly Performance',
    subtitle: 'See yearly target versus achievement for the full team.'
  },
  comparison: {
    title: 'Yearly Comparison Chart',
    subtitle: 'Compare monthly team target and achievement across the selected year.'
  },
  team: {
    title: 'Team Comparison',
    subtitle: 'Compare sales people, rank the team, and find the leaders and low performers.'
  },
  person: {
    title: 'Sales Person Report',
    subtitle: 'Open an individual sales dashboard with target, conversion, collection, and incentive detail.'
  },
  incentives: {
    title: 'Incentive / Commission',
    subtitle: 'Estimate team incentive and manage commission rules from one place.'
  },
  settings: {
    title: 'Performance Settings',
    subtitle: 'Review the performance configuration and keep the module rules aligned.'
  },
  export: {
    title: 'Export Reports',
    subtitle: 'Export weekly, monthly, yearly, team, and person reports in Excel or PDF.'
  }
};

const COLORS = ['#9F174D', '#0F766E', '#2563EB', '#16A34A', '#D97706', '#7C3AED'];

const buildNumberOptions = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);

const weekOptions = () => buildNumberOptions(1, 53);

const lookupEmployeeLabel = (employee) => employee?.name || employee?.employeeName || employee?.employee_name || 'Employee';

const lookupEmployeeId = (employee) => String(employee?.id || employee?.employeeId || employee?.dbId || '').trim();

const normalizeTargetForm = (employeeId = '', year = currentYear, month = currentMonth) => ({
  employeeId,
  periodType: 'monthly',
  weekNumber: '',
  month,
  year,
  revenueTarget: '',
  leadTarget: '',
  quotationTarget: '',
  conversionTarget: '',
  collectionTarget: '',
  renewalTarget: '',
  notes: ''
});

const normalizeRuleForm = (rule = null) => ({
  id: rule?.id || '',
  ruleName: rule?.ruleName || 'Incentive Rule',
  minAchievementPercent: rule?.minAchievementPercent ?? 100,
  maxAchievementPercent: rule?.maxAchievementPercent ?? 120,
  fixedBonus: rule?.fixedBonus ?? 0,
  commissionPercent: rule?.commissionPercent ?? 0,
  extraBonus: rule?.extraBonus ?? 0,
  active: rule?.active ?? true
});

const sectionStyle = {
  display: 'grid',
  gap: 16
};

const panelStyle = {
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-sm)'
};

const panelInnerStyle = {
  padding: 16
};

const labelStyle = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
};

const valueStyle = {
  fontSize: 22,
  fontWeight: 800,
  color: 'var(--color-text)'
};

const miniStatStyle = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--color-border)',
  background: 'var(--color-primary-light)'
};

const chartCardStyle = {
  padding: 16,
  display: 'grid',
  gap: 14
};

const tableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  background: '#fff'
};

const tableStyle = {
  width: '100%',
  minWidth: 980,
  borderCollapse: 'collapse'
};

const thStyle = {
  textAlign: 'left',
  padding: '11px 12px',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--color-muted)',
  background: '#F9FAFB',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--color-border)'
};

const tdStyle = {
  padding: '11px 12px',
  borderBottom: '1px solid #EEF2F7',
  fontSize: 13,
  color: 'var(--color-text)',
  verticalAlign: 'top'
};

const statusStyle = (status) => {
  const key = String(status || '').toLowerCase();
  if (key.includes('on track') || key.includes('active') || key.includes('approved')) {
    return { background: '#DCFCE7', color: '#166534' };
  }
  if (key.includes('needs') || key.includes('hold') || key.includes('pending')) {
    return { background: '#FEF3C7', color: '#92400E' };
  }
  if (key.includes('at risk') || key.includes('inactive') || key.includes('low')) {
    return { background: '#FEE2E2', color: '#991B1B' };
  }
  return { background: '#E0F2FE', color: '#0C4A6E' };
};

const formatMonthLabel = (month) => monthOptions.find((item) => item.value === Number(month))?.label || `Month ${month}`;

const reportScopes = [
  { scope: 'weekly', label: 'Weekly' },
  { scope: 'monthly', label: 'Monthly' },
  { scope: 'yearly', label: 'Yearly' },
  { scope: 'yearly-comparison', label: 'Yearly Comparison' },
  { scope: 'team', label: 'Team Comparison' },
  { scope: 'person', label: 'Sales Person' }
];

const getDefaultPayload = (data) => ({
  summary: data?.summary || {},
  rows: safeRows(data?.rows),
  monthlyRows: safeRows(data?.monthlyRows),
  yearlyRows: safeRows(data?.yearlyRows),
  leaderboard: safeRows(data?.leaderboard),
  lowPerformers: safeRows(data?.lowPerformers),
  months: safeRows(data?.months),
  employees: safeRows(data?.employees),
  rules: safeRows(data?.rules),
  adjustments: safeRows(data?.adjustments)
});

function ChartShell({ title, subtitle, children, action }) {
  return (
    <AppCard style={{ ...panelStyle, overflow: 'hidden' }} title={title} action={action}>
      <div style={{ ...chartCardStyle, padding: 0 }}>
        {subtitle ? <div style={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{subtitle}</div> : null}
        {children}
      </div>
    </AppCard>
  );
}

function InlineAction({ icon, label, onClick, tone = 'primary', disabled = false }) {
  return (
    <AppButton
      variant={tone === 'secondary' ? 'outline' : 'primary'}
      size="sm"
      iconLeft={icon}
      disabled={disabled}
      onClick={onClick}
      style={{ minWidth: 'auto' }}
    >
      {label}
    </AppButton>
  );
}

function ReportButtons({ scope, params = {}, employeeId = '' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <AppButton iconLeft={<FileSpreadsheet size={14} />} variant="outline" size="sm" onClick={() => window.open(salesExportUrl({ scope, format: 'xls', params: { ...params, employeeId } }), '_blank', 'noopener,noreferrer')}>
        Excel
      </AppButton>
      <AppButton iconLeft={<FileDown size={14} />} variant="outline" size="sm" onClick={() => window.open(salesExportUrl({ scope, format: 'pdf', params: { ...params, employeeId } }), '_blank', 'noopener,noreferrer')}>
        PDF
      </AppButton>
    </div>
  );
}

function FiltersRow({ children }) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      {children}
    </div>
  );
}

function TargetForm({ employees = [], form, setForm, onSubmit, onReset, submitting }) {
  return (
    <AppCard style={{ ...panelStyle }} title={form.id ? 'Edit Target' : 'Add Target'} action={<AppButton size="sm" variant="outline" iconLeft={<RotateCcw size={14} />} onClick={onReset}>Reset</AppButton>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <FiltersRow>
          <AppSelect label="Sales Employee" value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={lookupEmployeeId(employee)} value={lookupEmployeeId(employee)}>
                {lookupEmployeeLabel(employee)}
              </option>
            ))}
          </AppSelect>
          <AppSelect label="Period Type" value={form.periodType} onChange={(e) => setForm((prev) => ({ ...prev, periodType: e.target.value }))}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </AppSelect>
          <AppSelect label="Week Number" value={form.weekNumber} onChange={(e) => setForm((prev) => ({ ...prev, weekNumber: e.target.value }))}>
            <option value="">Optional</option>
            {weekOptions().map((week) => <option key={week} value={week}>Week {week}</option>)}
          </AppSelect>
          <AppSelect label="Month" value={form.month} onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </AppSelect>
        </FiltersRow>
        <FiltersRow>
          <AppInput label="Year" type="number" value={form.year} onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))} />
          <AppInput label="Revenue Target" type="number" value={form.revenueTarget} onChange={(e) => setForm((prev) => ({ ...prev, revenueTarget: e.target.value }))} />
          <AppInput label="Lead Target" type="number" value={form.leadTarget} onChange={(e) => setForm((prev) => ({ ...prev, leadTarget: e.target.value }))} />
          <AppInput label="Quotation Target" type="number" value={form.quotationTarget} onChange={(e) => setForm((prev) => ({ ...prev, quotationTarget: e.target.value }))} />
        </FiltersRow>
        <FiltersRow>
          <AppInput label="Conversion Target" type="number" value={form.conversionTarget} onChange={(e) => setForm((prev) => ({ ...prev, conversionTarget: e.target.value }))} />
          <AppInput label="Collection Target" type="number" value={form.collectionTarget} onChange={(e) => setForm((prev) => ({ ...prev, collectionTarget: e.target.value }))} />
          <AppInput label="Renewal Target" type="number" value={form.renewalTarget} onChange={(e) => setForm((prev) => ({ ...prev, renewalTarget: e.target.value }))} />
        </FiltersRow>
        <AppTextarea label="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <AppButton iconLeft={<Save size={14} />} loading={submitting} onClick={onSubmit}>
            {form.id ? 'Update Target' : 'Save Target'}
          </AppButton>
          <AppButton variant="outline" iconLeft={<Plus size={14} />} onClick={onReset}>New Target</AppButton>
        </div>
      </div>
    </AppCard>
  );
}

function DataTable({ columns, rows, loading, emptyTitle, emptyMessage, actions }) {
  if (loading) {
    return (
      <AppCard style={{ ...panelStyle }}>
        <div style={{ padding: 28, display: 'grid', placeItems: 'center', gap: 8 }}>
          <LoadingSpinner size={22} />
          <div style={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 700 }}>Loading sales performance data...</div>
        </div>
      </AppCard>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle || 'No records found'} message={emptyMessage || 'No sales performance data is available for the selected filter.'} />;
  }

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} style={thStyle}>{column.label}</th>)}
            {actions ? <th style={thStyle}>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.external_id || index}>
              {columns.map((column) => (
                <td key={column.key} style={tdStyle}>
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
              {actions ? <td style={tdStyle}>{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatBlock({ label, value, tone = 'var(--color-primary)', icon }) {
  return (
    <div style={miniStatStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <p style={labelStyle}>{label}</p>
        <span style={{ color: tone, display: 'inline-flex' }}>{icon}</span>
      </div>
      <div style={{ ...valueStyle, color: tone }}>{value}</div>
    </div>
  );
}

function FilterBar({ view, filters, setFilters, employees = [] }) {
  const showLeadSource = ['weekly', 'monthly', 'export'].includes(view);
  const showEmployee = ['targets', 'person', 'export'].includes(view);
  const showMonth = ['dashboard', 'monthly', 'targets', 'person', 'export'].includes(view);
  const showWeek = ['weekly', 'targets', 'export'].includes(view);

  return (
    <AppCard style={{ ...panelStyle }}>
      <FiltersRow>
        <AppInput label="Year" type="number" value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))} />
        {showMonth ? (
          <AppSelect label="Month" value={filters.month} onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}>
            <option value="">All months</option>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </AppSelect>
        ) : null}
        {showWeek ? (
          <AppSelect label="Week" value={filters.week} onChange={(e) => setFilters((prev) => ({ ...prev, week: e.target.value }))}>
            <option value="">All weeks</option>
            {weekOptions().map((week) => <option key={week} value={week}>Week {week}</option>)}
          </AppSelect>
        ) : null}
        {showEmployee ? (
          <AppSelect label="Sales Person" value={filters.employeeId} onChange={(e) => setFilters((prev) => ({ ...prev, employeeId: e.target.value }))}>
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={lookupEmployeeId(employee)} value={lookupEmployeeId(employee)}>
                {lookupEmployeeLabel(employee)}
              </option>
            ))}
          </AppSelect>
        ) : null}
        {showLeadSource ? <AppInput label="Lead Source" value={filters.leadSource} onChange={(e) => setFilters((prev) => ({ ...prev, leadSource: e.target.value }))} /> : null}
        {showLeadSource ? <AppInput label="Service Type" value={filters.serviceType} onChange={(e) => setFilters((prev) => ({ ...prev, serviceType: e.target.value }))} /> : null}
      </FiltersRow>
    </AppCard>
  );
}

function SalesPerformanceHub({ view }) {
  const config = views[view] || views.dashboard;
  const [payload, setPayload] = useState(getDefaultPayload());
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({
    year: currentYear,
    month: currentMonth,
    week: '',
    employeeId: '',
    leadSource: '',
    serviceType: ''
  });
  const [targetForm, setTargetForm] = useState(() => normalizeTargetForm('', currentYear, currentMonth));
  const [savingTarget, setSavingTarget] = useState(false);
  const [ruleForm, setRuleForm] = useState(() => normalizeRuleForm());
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    let active = true;
    const loadEmployees = async () => {
      try {
        const res = await apiGet('/api/sales-performance/targets', { year: filters.year });
        if (!active) return;
        setEmployees(safeRows(res?.employees));
      } catch (_error) {
        if (!active) return;
        setEmployees([]);
      }
    };
    loadEmployees();
    return () => {
      active = false;
    };
  }, [filters.year]);

  useEffect(() => {
    if (view !== 'person') return;
    if (!filters.employeeId && employees.length) {
      setFilters((prev) => ({ ...prev, employeeId: lookupEmployeeId(employees[0]) }));
    }
  }, [view, employees, filters.employeeId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        let data = null;
        if (view === 'person') {
          if (!filters.employeeId) {
            setLoading(false);
            return;
          }
          data = await apiGet(`/api/sales-performance/person/${encodeURIComponent(filters.employeeId)}`, { year: filters.year, month: filters.month });
        } else if (view === 'dashboard') {
          data = await apiGet('/api/sales-performance/dashboard', { year: filters.year, month: filters.month });
        } else if (view === 'targets') {
          data = await apiGet('/api/sales-performance/targets', { year: filters.year, periodType: '', month: filters.month, employeeId: filters.employeeId });
        } else if (view === 'weekly') {
          data = await apiGet('/api/sales-performance/weekly', { year: filters.year, week: filters.week, serviceType: filters.serviceType, leadSource: filters.leadSource });
        } else if (view === 'monthly') {
          data = await apiGet('/api/sales-performance/monthly', { year: filters.year, month: filters.month, serviceType: filters.serviceType, leadSource: filters.leadSource });
        } else if (view === 'yearly') {
          data = await apiGet('/api/sales-performance/yearly', { year: filters.year });
        } else if (view === 'comparison') {
          data = await apiGet('/api/sales-performance/yearly-comparison', { year: filters.year });
        } else if (view === 'team') {
          data = await apiGet('/api/sales-performance/team-comparison', { year: filters.year });
        } else if (view === 'incentives' || view === 'settings') {
          data = await apiGet('/api/sales-performance/incentives', { year: filters.year });
        } else {
          data = {};
        }
        if (!active) return;
        setPayload(getDefaultPayload(data));
      } catch (error) {
        if (!active) return;
        setError(error?.response?.data?.error || error.message || 'Unable to load sales performance data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [view, filters.year, filters.month, filters.week, filters.employeeId, filters.leadSource, filters.serviceType, refreshKey]);

  const summary = payload.summary || {};
  const dashboardRows = payload.monthlyRows.length ? payload.monthlyRows : payload.yearlyRows;
  const targetRows = payload.rows;
  const teamRows = payload.rows.length ? payload.rows : payload.yearlyRows;
  const personData = payload;
  const dashboardChartRows = (dashboardRows || []).map((row) => ({
    label: row.monthLabel || row.weekLabel || row.employeeName || row.employee || 'Item',
    target: Number(row.target?.revenueTarget || row.targetRevenue || row.revenueTarget || row.target || 0),
    achievement: Number(row.achievement?.achievedRevenue || row.achievedRevenue || row.achievement || 0),
    pending: Number(row.achievement?.pendingRevenue || row.pendingRevenue || row.pending || 0),
    achievementPercent: Number(row.achievement?.achievementPercent || row.achievementPercent || 0),
    collectionAmount: Number(row.achievement?.collectionAmount || row.collectionAmount || row.collection || 0)
  }));
  const weeklyChartRows = payload.rows.map((row) => ({
    label: row.employeeName || lookupEmployeeLabel(row),
    target: Number(row.target?.revenueTarget || 0),
    achievement: Number(row.achievement?.achievedRevenue || 0)
  }));
  const monthlyChartRows = payload.rows.map((row) => ({
    label: row.employeeName || lookupEmployeeLabel(row),
    target: Number(row.target?.revenueTarget || 0),
    achievement: Number(row.achievement?.achievedRevenue || 0)
  }));
  const yearlyTeamChartRows = payload.rows.map((row) => ({
    label: row.employeeName || lookupEmployeeLabel(row),
    target: Number(row.target?.revenueTarget || row.targetRevenue || 0),
    achievement: Number(row.achievement?.achievedRevenue || row.achievedRevenue || 0),
    achievementPercent: Number(row.achievement?.achievementPercent || row.achievementPercent || 0)
  }));
  const yearlyComparisonRows = payload.months.length
    ? payload.months.map((row) => ({
      monthLabel: row.monthLabel,
      target: Number(row.target || 0),
      achievement: Number(row.achievement || 0),
      pending: Number(row.pending || 0),
      achievementPercent: Number(row.achievementPercent || 0)
    }))
    : dashboardChartRows;
  const topPerformer = payload.leaderboard?.[0] || summary.bestPerformer || null;
  const lowPerformer = payload.lowPerformers?.[0] || summary.lowPerformer || null;
  const filteredTargetRows = useMemo(() => {
    if (view !== 'targets') return targetRows;
    return targetRows.filter((row) => {
      if (filters.employeeId && String(row.employeeId || row.employee_id || '') !== String(filters.employeeId)) return false;
      if (filters.month && Number(row.month || row.month_number || 0) !== Number(filters.month)) return false;
      if (filters.year && Number(row.year || 0) !== Number(filters.year)) return false;
      return true;
    });
  }, [view, targetRows, filters.employeeId, filters.month, filters.year]);
  const targetChartRows = filteredTargetRows.map((row) => ({
    ...row,
    label: row.label || `${row.employeeName || row.employee_name || 'Employee'}${row.periodType === 'weekly' ? ` - Week ${row.weekNumber || '-'}` : ''}`
  }));

  const teamTotalTarget = Number(summary.totalTeamTarget || summary.yearTarget || 0);
  const teamTotalAchievement = Number(summary.totalTeamAchievement || summary.yearAchieved || 0);
  const pending = Number(summary.pendingTarget || summary.yearPending || Math.max(teamTotalTarget - teamTotalAchievement, 0));
  const achievementPercent = Number(summary.achievementPercent || summary.yearAchievementPercent || summary.yearAchievementPercent || summary.achievementPercent || summary.yearAchievementPercent || summary.yearAchievementPercent || 0);

  const headerAction = view === 'targets' ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <AppButton iconLeft={<RefreshCcw size={14} />} variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>Refresh</AppButton>
      <AppButton iconLeft={<Plus size={14} />} size="sm" onClick={() => setTargetForm(normalizeTargetForm('', filters.year, filters.month || currentMonth))}>New Target</AppButton>
    </div>
  ) : view === 'export' ? null : (
    <ReportButtons scope={view === 'comparison' ? 'yearly-comparison' : view} params={filters} employeeId={filters.employeeId} />
  );

  const submitTarget = async () => {
    try {
      setSavingTarget(true);
      const body = {
        ...targetForm,
        weekNumber: targetForm.periodType === 'weekly' ? targetForm.weekNumber : '',
        month: targetForm.periodType === 'weekly' ? '' : targetForm.month,
        year: targetForm.year,
        revenueTarget: Number(targetForm.revenueTarget || 0),
        leadTarget: Number(targetForm.leadTarget || 0),
        quotationTarget: Number(targetForm.quotationTarget || 0),
        conversionTarget: Number(targetForm.conversionTarget || 0),
        collectionTarget: Number(targetForm.collectionTarget || 0),
        renewalTarget: Number(targetForm.renewalTarget || 0)
      };
      if (targetForm.id) {
        await axios.put(`${API_BASE_URL}/api/sales-performance/targets/${encodeURIComponent(targetForm.id)}`, body);
      } else {
        await axios.post(`${API_BASE_URL}/api/sales-performance/targets`, body);
      }
      setRefreshKey((value) => value + 1);
      setTargetForm(normalizeTargetForm('', filters.year, filters.month || currentMonth));
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Unable to save target.');
    } finally {
      setSavingTarget(false);
    }
  };

  const deleteTarget = async (id) => {
    if (!window.confirm('Delete this target?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/sales-performance/targets/${encodeURIComponent(id)}`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Unable to delete target.');
    }
  };

  const saveRule = async () => {
    try {
      setSavingRule(true);
      const body = { ...ruleForm, active: Boolean(ruleForm.active) };
      if (ruleForm.id) {
        await axios.put(`${API_BASE_URL}/api/sales-performance/incentive-rules/${encodeURIComponent(ruleForm.id)}`, body);
      } else {
        await axios.post(`${API_BASE_URL}/api/sales-performance/incentive-rules`, body);
      }
      setRuleForm(normalizeRuleForm());
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Unable to save incentive rule.');
    } finally {
      setSavingRule(false);
    }
  };

  const deleteRule = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/sales-performance/incentive-rules/${encodeURIComponent(id)}`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Unable to delete incentive rule.');
    }
  };

  const loadRuleIntoForm = (rule) => setRuleForm(normalizeRuleForm(rule));

  const renderDashboard = () => (
    <div style={sectionStyle}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <DashboardStatCard title="Total Team Target" value={money(teamTotalTarget)} icon={<Target size={18} />} />
        <DashboardStatCard title="Total Team Achievement" value={money(teamTotalAchievement)} icon={<TrendingUp size={18} />} />
        <DashboardStatCard title="Pending Target" value={money(pending)} icon={<ArrowDownRight size={18} />} />
        <DashboardStatCard title="Achievement %" value={percent(achievementPercent)} icon={<ArrowUpRight size={18} />} />
        <DashboardStatCard title="Leads Assigned" value={integer(summary.leadsAssigned || 0)} icon={<Users size={18} />} />
        <DashboardStatCard title="Leads Converted" value={integer(summary.leadsConverted || 0)} icon={<BadgeIndianRupee size={18} />} />
        <DashboardStatCard title="Conversion %" value={percent(summary.conversionPercent || 0)} icon={<Filter size={18} />} />
        <DashboardStatCard title="Collection Amount" value={money(summary.collectionAmount || 0)} icon={<Wallet size={18} />} />
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <StatBlock label="Best Performer" value={topPerformer ? lookupEmployeeLabel(topPerformer) : 'No target yet'} tone="#0F766E" icon={<Trophy size={16} />} />
        <StatBlock label="Low Performer" value={lowPerformer ? lookupEmployeeLabel(lowPerformer) : 'No target yet'} tone="#DC2626" icon={<AlertCircle size={16} />} />
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <ChartShell title="Monthly Trend" subtitle="Monthly target versus achievement for the selected year">
        <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dashboardChartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => money(value)} />
              <Legend />
              <Line type="monotone" dataKey="target" stroke="#9F174D" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="achievement" stroke="#0F766E" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      <ChartShell title="Collection Chart" subtitle="Monthly collection amount versus target">
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dashboardChartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => money(value)} />
              <Area type="monotone" dataKey="collectionAmount" stroke="#2563EB" fill="#DBEAFE" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  );

  const renderTargets = () => (
    <div style={sectionStyle}>
      <TargetForm
        employees={employees}
        form={targetForm}
        setForm={setTargetForm}
        onSubmit={submitTarget}
        onReset={() => setTargetForm(normalizeTargetForm(filters.employeeId, filters.year, filters.month || currentMonth))}
        submitting={savingTarget}
      />
      <ChartShell title="Target Coverage" subtitle="Assigned target rows by period">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={targetChartRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="revenueTarget" fill="#9F174D" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <DataTable
        loading={loading}
        rows={filteredTargetRows}
        emptyTitle="No target assigned yet"
        emptyMessage="Create a sales target to begin tracking weekly, monthly, and yearly performance."
        columns={[
          { key: 'employeeName', label: 'Sales Employee', render: (_value, row) => row.employeeName || row.employee_name || 'Employee' },
          { key: 'periodType', label: 'Period Type' },
          { key: 'weekNumber', label: 'Week', render: (value) => (value ? `Week ${value}` : '-') },
          { key: 'month', label: 'Month', render: (value, row) => row.periodType === 'yearly' ? '-' : formatMonthLabel(value) },
          { key: 'year', label: 'Year' },
          { key: 'revenueTarget', label: 'Revenue', render: (value) => money(value) },
          { key: 'leadTarget', label: 'Leads' },
          { key: 'quotationTarget', label: 'Quotation' },
          { key: 'conversionTarget', label: 'Conversion' },
          { key: 'collectionTarget', label: 'Collection', render: (value) => money(value) },
          { key: 'renewalTarget', label: 'Renewal' },
          { key: 'notes', label: 'Notes' }
        ]}
        actions={(row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton size="sm" variant="outline" onClick={() => setTargetForm({ ...normalizeTargetForm(filters.employeeId, filters.year, filters.month || currentMonth), ...row, id: row.id || row.external_id || '' })}>Edit</AppButton>
            <AppButton size="sm" variant="outline" onClick={() => deleteTarget(row.id || row.external_id || '')}>Delete</AppButton>
          </div>
        )}
      />
    </div>
  );

  const renderWeekly = () => (
    <div style={sectionStyle}>
      <ChartShell title="Weekly Target vs Achievement" subtitle="Each bar pair shows the selected week's target and achievement by person">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyChartRows.slice(0, 12)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => money(value)} />
            <Legend />
            <Bar dataKey="target" fill="#9F174D" name="Target" />
            <Bar dataKey="achievement" fill="#0F766E" name="Achievement" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <DataTable
        loading={loading}
        rows={payload.rows}
        emptyTitle="No weekly data"
        emptyMessage="Set a weekly target or move leads into the selected week to see the weekly scorecard."
        columns={[
          { key: 'employeeName', label: 'Sales Person', render: (value, row) => row.employeeName || lookupEmployeeLabel(row) },
          { key: 'weekLabel', label: 'Week' },
          { key: 'target', label: 'Target', render: (_value, row) => money(row.target?.revenueTarget || row.targetRevenue || 0) },
          { key: 'achievement', label: 'Achieved', render: (_value, row) => money(row.achievement?.achievedRevenue || row.achievedRevenue || 0) },
          { key: 'pending', label: 'Pending', render: (_value, row) => money(row.pending || row.achievement?.pendingRevenue || 0) },
          { key: 'achievementPercent', label: 'Achievement %', render: (_value, row) => percent(row.achievement?.achievementPercent || row.achievementPercent || 0) },
          { key: 'leadsAssigned', label: 'Leads', render: (_value, row) => integer(row.achievement?.leadsAssigned || row.leadsAssigned || 0) },
          { key: 'leadsConverted', label: 'Converted', render: (_value, row) => integer(row.achievement?.leadsConverted || row.leadsConverted || 0) },
          { key: 'collectionAmount', label: 'Collection', render: (_value, row) => money(row.achievement?.collectionAmount || row.collectionAmount || 0) },
          { key: 'status', label: 'Status', render: (value) => <span style={{ ...statusStyle(value), display: 'inline-flex', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{value || 'Pending'}</span> }
        ]}
      />
    </div>
  );

  const renderMonthly = () => (
    <div style={sectionStyle}>
      <ChartShell title="Monthly Target vs Achievement" subtitle="Monthly comparison for the selected filters">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyChartRows.slice(0, 12)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => money(value)} />
            <Legend />
            <Bar dataKey="target" fill="#9F174D" name="Target" />
            <Bar dataKey="achievement" fill="#0F766E" name="Achievement" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <DataTable
        loading={loading}
        rows={payload.rows}
        emptyTitle="No monthly data"
        emptyMessage="No monthly target or achievement was found for this filter."
        columns={[
          { key: 'employeeName', label: 'Sales Person', render: (_value, row) => row.employeeName || lookupEmployeeLabel(row) },
          { key: 'monthLabel', label: 'Month' },
          { key: 'target', label: 'Target', render: (_value, row) => money(row.target?.revenueTarget || row.targetRevenue || 0) },
          { key: 'achievement', label: 'Achieved', render: (_value, row) => money(row.achievement?.achievedRevenue || row.achievedRevenue || 0) },
          { key: 'pending', label: 'Pending', render: (_value, row) => money(row.pending || row.achievement?.pendingRevenue || 0) },
          { key: 'achievementPercent', label: 'Achievement %', render: (_value, row) => percent(row.achievement?.achievementPercent || row.achievementPercent || 0) },
          { key: 'leadsAssigned', label: 'Leads', render: (_value, row) => integer(row.achievement?.leadsAssigned || row.leadsAssigned || 0) },
          { key: 'leadsConverted', label: 'Converted', render: (_value, row) => integer(row.achievement?.leadsConverted || row.leadsConverted || 0) },
          { key: 'collectionAmount', label: 'Collection', render: (_value, row) => money(row.achievement?.collectionAmount || row.collectionAmount || 0) },
          { key: 'status', label: 'Status', render: (value) => <span style={{ ...statusStyle(value), display: 'inline-flex', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{value || 'Pending'}</span> }
        ]}
      />
    </div>
  );

  const renderYearly = () => (
    <div style={sectionStyle}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <DashboardStatCard title="Year Total Target" value={money(teamTotalTarget)} icon={<Target size={18} />} />
        <DashboardStatCard title="Year Total Achieved" value={money(teamTotalAchievement)} icon={<TrendingUp size={18} />} />
        <DashboardStatCard title="Year Pending" value={money(pending)} icon={<ArrowDownRight size={18} />} />
        <DashboardStatCard title="Year Achievement %" value={percent(achievementPercent)} icon={<ArrowUpRight size={18} />} />
      </div>
      <ChartShell title="Yearly Team Comparison" subtitle="Bar chart for team yearly target versus achievement">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyTeamChartRows.slice(0, 14)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => money(value)} />
            <Legend />
            <Bar dataKey="target" fill="#9F174D" name="Target" />
            <Bar dataKey="achievement" fill="#0F766E" name="Achievement" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <DataTable
        loading={loading}
        rows={payload.rows}
        emptyTitle="No yearly targets yet"
        emptyMessage="Assign yearly targets to see team-wide yearly performance."
        columns={[
          { key: 'employeeName', label: 'Sales Person', render: (_value, row) => row.employeeName || lookupEmployeeLabel(row) },
          { key: 'target', label: 'Target', render: (_value, row) => money(row.target?.revenueTarget || 0) },
          { key: 'achievement', label: 'Achieved', render: (_value, row) => money(row.achievement?.achievedRevenue || 0) },
          { key: 'pending', label: 'Pending', render: (_value, row) => money(row.achievement?.pendingRevenue || 0) },
          { key: 'achievementPercent', label: 'Achievement %', render: (_value, row) => percent(row.achievement?.achievementPercent || 0) },
          { key: 'leadsAssigned', label: 'Leads', render: (_value, row) => integer(row.achievement?.leadsAssigned || 0) },
          { key: 'leadsConverted', label: 'Converted', render: (_value, row) => integer(row.achievement?.leadsConverted || 0) },
          { key: 'collectionAmount', label: 'Collection', render: (_value, row) => money(row.achievement?.collectionAmount || 0) },
          { key: 'status', label: 'Status', render: (value) => <span style={{ ...statusStyle(value), display: 'inline-flex', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{value || 'Assigned'}</span> }
        ]}
      />
    </div>
  );

  const renderComparison = () => (
    <div style={sectionStyle}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <DashboardStatCard title="Year Target" value={money(summary.yearTarget || 0)} icon={<Target size={18} />} />
        <DashboardStatCard title="Year Achieved" value={money(summary.yearAchieved || 0)} icon={<TrendingUp size={18} />} />
        <DashboardStatCard title="Year Pending" value={money(summary.yearPending || 0)} icon={<ArrowDownRight size={18} />} />
        <DashboardStatCard title="Year Achievement %" value={percent(summary.yearAchievementPercent || 0)} icon={<ArrowUpRight size={18} />} />
      </div>
      <ChartShell title="Month-wise Team Comparison" subtitle="January to December target versus achievement">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={yearlyComparisonRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => money(value)} />
            <Legend />
            <Bar dataKey="target" fill="#9F174D" name="Monthly Team Target" />
            <Bar dataKey="achievement" fill="#0F766E" name="Monthly Team Achievement" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Achievement Trend" subtitle="Achievement percentage month by month">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={yearlyComparisonRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => percent(value)} />
            <Line type="monotone" dataKey="achievementPercent" stroke="#2563EB" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
      <DataTable
        loading={loading}
        rows={yearlyComparisonRows}
        emptyTitle="No comparison data"
        columns={[
          { key: 'monthLabel', label: 'Month' },
          { key: 'target', label: 'Monthly Team Target', render: (value) => money(value) },
          { key: 'achievement', label: 'Monthly Team Achievement', render: (value) => money(value) },
          { key: 'pending', label: 'Monthly Pending', render: (value) => money(value) },
          { key: 'achievementPercent', label: 'Monthly Achievement %', render: (value) => percent(value) }
        ]}
      />
    </div>
  );

  const renderTeam = () => (
    <div style={sectionStyle}>
      <ChartShell title="Target vs Achievement" subtitle="Sales person wise target and achievement">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={yearlyTeamChartRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => money(value)} />
            <Legend />
            <Bar dataKey="target" fill="#9F174D" name="Target" />
            <Bar dataKey="achievement" fill="#0F766E" name="Achievement" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Achievement Percentage" subtitle="Performance percentage by sales person">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={yearlyTeamChartRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => percent(value)} />
            <Bar dataKey="achievementPercent" fill="#2563EB" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <ChartShell title="Top Performer Leaderboard" subtitle="Highest achievement percentage first">
          {payload.leaderboard.length === 0 ? (
            <EmptyState title="No leaderboard data" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {payload.leaderboard.slice(0, 10).map((row, index) => (
                <div key={row.employeeId || index} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 12, border: '1px solid var(--color-border)', background: index === 0 ? 'var(--color-primary-light)' : '#fff' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{index + 1}. {row.employeeName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{money(row.achievedRevenue || 0)} achieved</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#0F766E' }}>{percent(row.achievementPercent || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </ChartShell>
        <ChartShell title="Low Performer List" subtitle="Review where support is needed">
          {payload.lowPerformers.length === 0 ? (
            <EmptyState title="No low performer data" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {payload.lowPerformers.slice(0, 10).map((row, index) => (
                <div key={row.employeeId || index} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 12, border: '1px solid var(--color-border)', background: '#fff' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{row.employeeName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{money(row.pending || 0)} pending</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#DC2626' }}>{percent(row.achievementPercent || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </ChartShell>
      </div>
      <DataTable
        loading={loading}
        rows={payload.rows}
        emptyTitle="No team data"
        columns={[
          { key: 'employeeName', label: 'Sales Person' },
          { key: 'targetRevenue', label: 'Target', render: (value) => money(value) },
          { key: 'achievedRevenue', label: 'Achieved', render: (value) => money(value) },
          { key: 'pending', label: 'Pending', render: (value) => money(value) },
          { key: 'achievementPercent', label: 'Achievement %', render: (value) => percent(value) },
          { key: 'leadAssigned', label: 'Leads', render: (value) => integer(value) },
          { key: 'leadConverted', label: 'Converted', render: (value) => integer(value) },
          { key: 'collectionAmount', label: 'Collection', render: (value) => money(value) },
          { key: 'incentive', label: 'Incentive', render: (value) => money(value) }
        ]}
      />
    </div>
  );

  const renderPerson = () => (
    <div style={sectionStyle}>
      <ChartShell title="Individual Sales Person" subtitle="Choose one employee and review the detailed performance story">
        <FiltersRow>
          <AppSelect label="Sales Person" value={filters.employeeId} onChange={(e) => setFilters((prev) => ({ ...prev, employeeId: e.target.value }))}>
            {employees.map((employee) => (
              <option key={lookupEmployeeId(employee)} value={lookupEmployeeId(employee)}>
                {lookupEmployeeLabel(employee)}
              </option>
            ))}
          </AppSelect>
          <AppInput label="Year" type="number" value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))} />
          <AppSelect label="Month" value={filters.month} onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </AppSelect>
        </FiltersRow>
      </ChartShell>
      {personData.employee ? (
        <>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <StatBlock label="Monthly Target" value={money(personData.monthly?.target?.revenueTarget || 0)} icon={<Target size={16} />} />
            <StatBlock label="Monthly Achieved" value={money(personData.monthly?.achievement?.achievedRevenue || 0)} icon={<TrendingUp size={16} />} />
            <StatBlock label="Yearly Target" value={money(personData.yearly?.target?.revenueTarget || 0)} icon={<Target size={16} />} />
            <StatBlock label="Yearly Achieved" value={money(personData.yearly?.achievement?.achievedRevenue || 0)} icon={<TrendingUp size={16} />} />
            <StatBlock label="Pending Amount" value={money(personData.yearly?.achievement?.pendingRevenue || 0)} icon={<ArrowDownRight size={16} />} />
            <StatBlock label="Leads Assigned" value={integer(personData.yearly?.achievement?.leadsAssigned || 0)} icon={<Users size={16} />} />
            <StatBlock label="Leads Converted" value={integer(personData.yearly?.achievement?.leadsConverted || 0)} icon={<BadgeIndianRupee size={16} />} />
            <StatBlock label="Rank in Team" value={personData.rank ? `#${personData.rank}` : '-'} icon={<Trophy size={16} />} />
            <StatBlock label="Estimated Incentive" value={money(personData.estimatedIncentive || 0)} icon={<Gift size={16} />} />
          </div>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <ChartShell title="Lead Conversion Funnel" subtitle="Assigned leads versus converted leads">
              <ResponsiveContainer width="100%" height={300}>
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={personData.charts?.leadConversion || []} isAnimationActive>
                    {(personData.charts?.leadConversion || []).map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </ChartShell>
            <ChartShell title="Collection Chart" subtitle="Target versus actual collection">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={personData.charts?.collection || []} dataKey="value" nameKey="name" outerRadius={100} innerRadius={52} label>
                    {(personData.charts?.collection || []).map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>
          <DataTable
            loading={loading}
            rows={[
              { id: 'monthly-target', metric: 'Monthly Target', value: money(personData.monthly?.target?.revenueTarget || 0) },
              { id: 'monthly-achieved', metric: 'Monthly Achieved', value: money(personData.monthly?.achievement?.achievedRevenue || 0) },
              { id: 'yearly-target', metric: 'Yearly Target', value: money(personData.yearly?.target?.revenueTarget || 0) },
              { id: 'yearly-achieved', metric: 'Yearly Achieved', value: money(personData.yearly?.achievement?.achievedRevenue || 0) },
              { id: 'pending', metric: 'Pending', value: money(personData.yearly?.achievement?.pendingRevenue || 0) },
              { id: 'lead-assigned', metric: 'Leads Assigned', value: integer(personData.yearly?.achievement?.leadsAssigned || 0) },
              { id: 'lead-converted', metric: 'Leads Converted', value: integer(personData.yearly?.achievement?.leadsConverted || 0) },
              { id: 'quotations', metric: 'Quotations Sent', value: integer(personData.yearly?.achievement?.quotationsSent || 0) },
              { id: 'invoices', metric: 'Invoices Generated', value: integer(personData.yearly?.achievement?.invoicesGenerated || 0) },
              { id: 'payments', metric: 'Payments Collected', value: money(personData.yearly?.achievement?.collectionAmount || 0) },
              { id: 'renewals', metric: 'Renewals Converted', value: integer(personData.yearly?.achievement?.renewalsConverted || 0) },
              { id: 'rank', metric: 'Rank in Team', value: personData.rank ? `#${personData.rank}` : '-' },
              { id: 'incentive', metric: 'Estimated Incentive', value: money(personData.estimatedIncentive || 0) }
            ]}
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ]}
          />
        </>
      ) : (
        <EmptyState title="No sales person selected" message="Choose a sales employee to view the person-level dashboard." />
      )}
    </div>
  );

  const renderIncentives = () => (
    <div style={sectionStyle}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <DashboardStatCard title="Active Rules" value={integer(payload.rules.filter((rule) => rule.active !== false).length)} icon={<Gift size={18} />} />
        <DashboardStatCard title="Sales People" value={integer(payload.rows.length)} icon={<Users size={18} />} />
        <DashboardStatCard title="Total Estimated Incentive" value={money(payload.rows.reduce((sum, row) => sum + Number(row.estimatedIncentive || 0), 0))} icon={<BadgeIndianRupee size={18} />} />
      </div>
      <ChartShell title="Estimated Incentive Distribution" subtitle="Estimated incentive across the team">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={payload.rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
            <XAxis dataKey="employeeName" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => money(value)} />
            <Bar dataKey="estimatedIncentive" fill="#9F174D" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <DataTable
        loading={loading}
        rows={payload.rows}
        emptyTitle="No incentive rows"
        columns={[
          { key: 'employeeName', label: 'Sales Person' },
          { key: 'achievementPercent', label: 'Achievement %', render: (value) => percent(value) },
          { key: 'achievedRevenue', label: 'Achieved Revenue', render: (value) => money(value) },
          { key: 'estimatedIncentive', label: 'Estimated Incentive', render: (value) => money(value) }
        ]}
      />
      <ChartShell title="Incentive Rules" subtitle="Edit the fixed bonus, commission percent, and extra bonus thresholds">
        <div style={{ display: 'grid', gap: 12 }}>
          <FiltersRow>
            <AppInput label="Rule Name" value={ruleForm.ruleName} onChange={(e) => setRuleForm((prev) => ({ ...prev, ruleName: e.target.value }))} />
            <AppInput label="Min Achievement %" type="number" value={ruleForm.minAchievementPercent} onChange={(e) => setRuleForm((prev) => ({ ...prev, minAchievementPercent: e.target.value }))} />
            <AppInput label="Max Achievement %" type="number" value={ruleForm.maxAchievementPercent} onChange={(e) => setRuleForm((prev) => ({ ...prev, maxAchievementPercent: e.target.value }))} />
            <AppInput label="Fixed Bonus" type="number" value={ruleForm.fixedBonus} onChange={(e) => setRuleForm((prev) => ({ ...prev, fixedBonus: e.target.value }))} />
          </FiltersRow>
          <FiltersRow>
            <AppInput label="Commission %" type="number" value={ruleForm.commissionPercent} onChange={(e) => setRuleForm((prev) => ({ ...prev, commissionPercent: e.target.value }))} />
            <AppInput label="Extra Bonus" type="number" value={ruleForm.extraBonus} onChange={(e) => setRuleForm((prev) => ({ ...prev, extraBonus: e.target.value }))} />
            <AppSelect label="Active" value={ruleForm.active ? 'yes' : 'no'} onChange={(e) => setRuleForm((prev) => ({ ...prev, active: e.target.value === 'yes' }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </AppSelect>
          </FiltersRow>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton iconLeft={<Save size={14} />} loading={savingRule} onClick={saveRule}>Save Rule</AppButton>
            <AppButton variant="outline" iconLeft={<RotateCcw size={14} />} onClick={() => setRuleForm(normalizeRuleForm())}>Reset</AppButton>
          </div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Rule</th>
                  <th style={thStyle}>Min %</th>
                  <th style={thStyle}>Max %</th>
                  <th style={thStyle}>Fixed Bonus</th>
                  <th style={thStyle}>Commission %</th>
                  <th style={thStyle}>Extra Bonus</th>
                  <th style={thStyle}>Active</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payload.rules.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center' }}>No incentive rules found.</td></tr>
                ) : payload.rules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={tdStyle}>{rule.ruleName}</td>
                    <td style={tdStyle}>{rule.minAchievementPercent}</td>
                    <td style={tdStyle}>{rule.maxAchievementPercent ?? '-'}</td>
                    <td style={tdStyle}>{money(rule.fixedBonus)}</td>
                    <td style={tdStyle}>{rule.commissionPercent}%</td>
                    <td style={tdStyle}>{money(rule.extraBonus)}</td>
                    <td style={tdStyle}><span style={{ ...statusStyle(rule.active ? 'active' : 'inactive'), display: 'inline-flex', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{rule.active ? 'Active' : 'Inactive'}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <AppButton size="sm" variant="outline" onClick={() => loadRuleIntoForm(rule)}>Edit</AppButton>
                        <AppButton size="sm" variant="outline" onClick={() => deleteRule(rule.id)}>Delete</AppButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ChartShell>
    </div>
  );

  const renderSettings = () => (
    <div style={sectionStyle}>
      <ChartShell title="Performance Settings" subtitle="Current module configuration and behavior">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatBlock label="Target Basis" value="Weekly / Monthly / Yearly" icon={<Target size={16} />} />
          <StatBlock label="Achievement Source" value="Leads, quotations, invoices, payments" icon={<TrendingUp size={16} />} />
          <StatBlock label="Fallback Employee Logic" value="Role, department, then active employees" icon={<Users size={16} />} />
        </div>
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.7 }}>
          The backend uses the existing CRM data first and falls back safely when a sales-specific employee field is missing. Incentive rules are managed from the same commission workspace.
        </p>
      </ChartShell>
      {renderIncentives()}
    </div>
  );

  const renderExport = () => (
    <div style={sectionStyle}>
      <ChartShell title="Export Center" subtitle="Quick actions for Excel and PDF reports">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {reportScopes.map((item) => (
            <AppCard key={item.scope} style={{ border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>Export in Excel or PDF</div>
                </div>
                <ReportButtons scope={item.scope} params={filters} employeeId={filters.employeeId} />
              </div>
            </AppCard>
          ))}
        </div>
      </ChartShell>
    </div>
  );

  const content = (() => {
    if (error) {
      return (
        <AppCard style={{ ...panelStyle }}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 10, padding: 28, textAlign: 'center' }}>
            <AlertCircle size={24} color="#DC2626" />
            <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>Unable to load sales performance data</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>{error}</div>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={14} />} onClick={() => setRefreshKey((value) => value + 1)}>Try Again</AppButton>
          </div>
        </AppCard>
      );
    }

    const isPayloadEmpty = !payload.rows.length && !payload.monthlyRows.length && !payload.yearlyRows.length && !payload.months.length && !payload.leaderboard.length && !payload.lowPerformers.length;
    if (loading && isPayloadEmpty) {
      return (
        <AppCard style={{ ...panelStyle }}>
          <div style={{ padding: 28, display: 'grid', placeItems: 'center', gap: 8 }}>
            <LoadingSpinner size={22} />
            <div style={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 700 }}>Loading sales performance module...</div>
          </div>
        </AppCard>
      );
    }

    if (view === 'dashboard') return renderDashboard();
    if (view === 'targets') return renderTargets();
    if (view === 'weekly') return renderWeekly();
    if (view === 'monthly') return renderMonthly();
    if (view === 'yearly') return renderYearly();
    if (view === 'comparison') return renderComparison();
    if (view === 'team') return renderTeam();
    if (view === 'person') return renderPerson();
    if (view === 'incentives') return renderIncentives();
    if (view === 'settings') return renderSettings();
    if (view === 'export') return renderExport();
    return renderDashboard();
  })();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        action={headerAction}
      />
      <FilterBar view={view} filters={filters} setFilters={setFilters} employees={employees} />
      {view === 'targets' ? (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <DashboardStatCard title="Target Rows" value={integer(filteredTargetRows.length)} icon={<Target size={18} />} />
          <DashboardStatCard title="Employees Loaded" value={integer(employees.length)} icon={<Users size={18} />} />
          <DashboardStatCard title="Selected Year" value={integer(filters.year)} icon={<CalendarDays size={18} />} />
        </div>
      ) : null}
      {content}
    </div>
  );
}

export default SalesPerformanceHub;
