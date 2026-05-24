import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import DashboardStatCard from '../../components/ui/DashboardStatCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import useColumnResize from '../../components/table/useColumnResize';
import {
  ChartSurface,
  CompactChartCard,
  getBarChartProps,
  getChartAxisProps,
  getChartGridStyle,
  getChartHeight,
  getChartMargin,
  getCurrencyAxisProps,
  getPercentAxisProps,
  SalesChartTooltip,
  salesChartTheme
} from './SalesChartPrimitives';
import { apiGet, currentMonth, currentYear, monthOptions, money, percent, safeRows } from './salesPerformanceApi';
import './salesPerformance.css';

const targetColor = '#111827';
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const currencyTooltipLabel = {
  target: 'Target',
  achieved: 'Achieved'
};

const summaryCards = [
  { key: 'totalMonthlyTarget', title: 'Total Monthly Target' },
  { key: 'totalMonthlyAchieved', title: 'Total Monthly Achieved' },
  { key: 'monthlyPending', title: 'Monthly Pending' },
  { key: 'monthlyAchievementPercent', title: 'Monthly Achievement %' },
  { key: 'totalYearlyTarget', title: 'Total Yearly Target' },
  { key: 'totalYearlyAchieved', title: 'Total Yearly Achieved' },
  { key: 'yearlyPending', title: 'Yearly Pending' },
  { key: 'bestPerformer', title: 'Best Performer' }
];
const matrixColumns = ['year', ...monthOptions.map((month) => `month-${month.value}`)];
const matrixWidths = {
  year: 72,
  'month-1': 92,
  'month-2': 92,
  'month-3': 92,
  'month-4': 92,
  'month-5': 92,
  'month-6': 92,
  'month-7': 92,
  'month-8': 92,
  'month-9': 92,
  'month-10': 92,
  'month-11': 92,
  'month-12': 92
};
const matrixBounds = {
  year: { min: 64, max: 100 },
  'month-1': { min: 80, max: 130 },
  'month-2': { min: 80, max: 130 },
  'month-3': { min: 80, max: 130 },
  'month-4': { min: 80, max: 130 },
  'month-5': { min: 80, max: 130 },
  'month-6': { min: 80, max: 130 },
  'month-7': { min: 80, max: 130 },
  'month-8': { min: 80, max: 130 },
  'month-9': { min: 80, max: 130 },
  'month-10': { min: 80, max: 130 },
  'month-11': { min: 80, max: 130 },
  'month-12': { min: 80, max: 130 }
};

const formatTargetActivityTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function SalesPerformanceDashboard() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [filters, setFilters] = useState({ year: currentYear, month: currentMonth, employeeId: '' });
  const [data, setData] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const [dashboardRes, matrixRes] = await Promise.all([
        apiGet('/api/sales-performance/dashboard', {
          year: nextFilters.year,
          month: nextFilters.month,
          employeeId: nextFilters.employeeId
        }),
        apiGet('/api/sales-performance/year-month-matrix')
      ]);
      setData(dashboardRes);
      setMatrix(safeRows(matrixRes.matrix));
      setEmployees(safeRows(dashboardRes.employees));
      setRecentActivity(safeRows(dashboardRes.recentActivity));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load sales performance data. Please refresh or check backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const salesPeople = useMemo(() => safeRows(employees), [employees]);
  const isMobile = viewportWidth <= 640;
  const {
    getColumnWidth,
    startResize
  } = useColumnResize({
    storageKey: 'sales_performance_dashboard_matrix_widths',
    columns: matrixColumns,
    defaultColumnWidths: matrixWidths,
    columnBounds: matrixBounds,
    minWidth: 64,
    enabled: true
  });
  const filtersGridStyle = viewportWidth >= 1100
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' };

  const summaryGridStyle = viewportWidth >= 1200
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 700
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', width: '100%' };
  const compactSummaryCardStyle = isMobile
    ? { width: '100%', minWidth: 0, borderRadius: 18, minHeight: 118 }
    : { width: '100%', minWidth: 0 };
  const compactSummaryContentStyle = isMobile
    ? { padding: 12, gap: 6, minHeight: 118, justifyContent: 'space-between' }
    : { padding: 14, gap: 8 };
  const compactSummaryTitleStyle = isMobile
    ? { fontSize: 9, lineHeight: 1.15, letterSpacing: '0.02em' }
    : undefined;
  const compactSummaryValueStyle = (key) => {
    if (!isMobile) return { fontSize: 26 };
    if (key === 'bestPerformer') return { fontSize: 12, lineHeight: 1.2, wordBreak: 'break-word' };
    if (String(key).includes('Percent')) return { fontSize: 16, lineHeight: 1.05 };
    return { fontSize: 18, lineHeight: 1.05 };
  };
  const scrollHintStyle = {
    marginBottom: 8,
    color: '#6B7280',
    fontSize: isMobile ? 11 : 12,
    fontWeight: 600
  };
  const matrixScrollStyle = {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x',
    overscrollBehaviorX: 'contain'
  };
  const matrixInnerStyle = {
    width: isMobile ? '1180px' : '100%',
    minWidth: isMobile ? '1180px' : '100%'
  };
  const resizeHandleStyle = { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' };
  const matrixTableMinWidth = matrixColumns.reduce((sum, key) => sum + (getColumnWidth(key) || matrixWidths[key] || 80), 0);
  const matrixTableStyle = {
    width: '100%',
    minWidth: `${Math.max(isMobile ? 1180 : 960, matrixTableMinWidth)}px`,
    borderCollapse: 'separate',
    borderSpacing: 0,
    tableLayout: 'fixed'
  };
  const headCellStyle = (key, align = 'left') => ({
    padding: isMobile ? '9px 10px' : '12px 14px',
    whiteSpace: 'nowrap',
    position: 'relative',
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const bodyCellStyle = (key) => ({
    padding: isMobile ? '9px 10px' : '12px 14px',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    position: 'relative',
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`
  });
  const chartGridStyle = getChartGridStyle(viewportWidth);
  const chartHeight = getChartHeight({ mobile: isMobile });
  const axisProps = getChartAxisProps({ mobile: isMobile });
  const currencyAxisProps = getCurrencyAxisProps({ mobile: isMobile });
  const percentAxisProps = getPercentAxisProps({ mobile: isMobile });
  const monthlyTrendRows = safeRows(data?.monthlyTrend);
  const salesPersonRows = safeRows(data?.salesPersonPerformance);
  const monthlyBarChartProps = getBarChartProps(monthlyTrendRows.length, { mobile: isMobile });
  const salesPersonBarChartProps = getBarChartProps(salesPersonRows.length, { mobile: isMobile });

  const summaryValue = (key) => {
    if (key === 'bestPerformer') return data?.summary?.bestPerformer?.employeeName || '---';
    if (String(key).includes('Percent')) return percent(data?.summary?.[key] || 0);
    return money(data?.summary?.[key] || 0);
  };
  const isTargetMet = (actual, target) => Number(actual || 0) >= Number(target || 0);
  const formatCurrencyTooltip = (value) => money(value || 0);

  return (
    <div
      className="crm-page sales-performance-page sales-dashboard-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 10 : 12,
        width: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        alignItems: 'stretch',
        justifyContent: 'flex-start'
      }}
    >
      <PageHeader
        title="Sales Performance"
        subtitle="Track monthly and yearly target vs achievement in a simple clean view."
        titleStyle={isMobile ? { fontSize: 24, lineHeight: 1.1 } : undefined}
        subtitleStyle={isMobile ? { fontSize: 13, lineHeight: 1.3 } : undefined}
        action={(
          viewportWidth <= 640 ? null : (
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>
              Refresh
            </AppButton>
          )
        )}
      />

      <AppCard title="Filters" className="crm-filter-card" style={{ width: '100%', minWidth: 0 }}>
        <div className="sales-filters-grid" style={filtersGridStyle}>
          <AppSelect label="Year" value={filters.year} onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}>
            {Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </AppSelect>
          <AppSelect label="Month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </AppSelect>
          <AppSelect label="Sales Person" value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}>
            <option value="">All Team</option>
            {salesPeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </AppSelect>
          {!isMobile ? (
            <AppInput label="Selected Team" value={filters.employeeId ? 'Single Sales Person' : 'All Team'} readOnly />
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: viewportWidth <= 480 ? 'stretch' : 'flex-end', marginTop: 12 }}>
          <AppButton
            onClick={() => load(filters)}
            fullWidth={viewportWidth <= 480}
            style={viewportWidth <= 480 ? { width: '100%' } : undefined}
          >
            Apply Filters
          </AppButton>
        </div>
      </AppCard>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
          <LoadingSpinner size={26} />
        </div>
      ) : error ? (
        <AppCard><EmptyState title="Sales performance error" message={error} /></AppCard>
      ) : (
        <>
          <div className="sales-summary-grid" style={summaryGridStyle}>
            {summaryCards.map((card) => (
              <DashboardStatCard
                key={card.key}
                title={card.title}
                value={summaryValue(card.key)}
                style={compactSummaryCardStyle}
                contentStyle={compactSummaryContentStyle}
                titleStyle={compactSummaryTitleStyle}
                valueStyle={compactSummaryValueStyle(card.key)}
              />
            ))}
          </div>

          <div className="sales-analytics-grid" style={chartGridStyle}>
            <CompactChartCard title="Monthly Target vs Achievement" isMobile={isMobile}>
              {monthlyTrendRows.length ? (
                <div className="sales-chart-scroll">
                  <ChartSurface height={chartHeight} minWidth={isMobile ? 560 : 0}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyTrendRows}
                        margin={getChartMargin({ mobile: isMobile })}
                        barCategoryGap={monthlyBarChartProps.barCategoryGap}
                        barGap={monthlyBarChartProps.barGap}
                      >
                        <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis {...currencyAxisProps} />
                        <Tooltip
                          cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                          content={<SalesChartTooltip valueFormatter={formatCurrencyTooltip} />}
                        />
                        <Bar dataKey="target" name={currencyTooltipLabel.target} fill={targetColor} radius={[8, 8, 0, 0]} maxBarSize={monthlyBarChartProps.maxBarSize} />
                        <Bar dataKey="achieved" name={currencyTooltipLabel.achieved} radius={[8, 8, 0, 0]} maxBarSize={monthlyBarChartProps.maxBarSize}>
                          {monthlyTrendRows.map((entry) => (
                            <Cell key={entry.month} fill={isTargetMet(entry.achieved, entry.target) ? successColor : dangerColor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                </div>
              ) : <EmptyState title="No monthly data" message="Targets and achievements will appear here." />}
            </CompactChartCard>

            <CompactChartCard title="Sales Person Performance" isMobile={isMobile}>
              {salesPersonRows.length ? (
                <div className="sales-chart-scroll">
                  <ChartSurface height={chartHeight} minWidth={isMobile ? 560 : 0}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={salesPersonRows}
                        margin={getChartMargin({ mobile: isMobile })}
                        barCategoryGap={salesPersonBarChartProps.barCategoryGap}
                        barGap={salesPersonBarChartProps.barGap}
                      >
                        <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                        <XAxis dataKey="employeeName" {...axisProps} />
                        <YAxis {...percentAxisProps} />
                        <Tooltip
                          cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                          content={<SalesChartTooltip valueFormatter={(value) => percent(value || 0)} />}
                        />
                        <Bar dataKey="yearlyAchievementPercent" name="Achievement %" radius={[8, 8, 0, 0]} maxBarSize={salesPersonBarChartProps.maxBarSize}>
                          {salesPersonRows.map((entry) => (
                            <Cell
                              key={entry.employeeId}
                              fill={Number(entry.yearlyAchievementPercent || 0) >= 100 ? successColor : dangerColor}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                </div>
              ) : <EmptyState title="No team performance yet" message="Add targets and records to compare people here." />}
            </CompactChartCard>
          </div>

          <AppCard title="Recent Target Activity" className="crm-table-card" style={{ width: '100%', minWidth: 0 }}>
            {recentActivity.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Link
                    to="/sales-performance/targets"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#9F174D',
                      textDecoration: 'none'
                    }}
                  >
                    View all activity
                  </Link>
                </div>
                {recentActivity.map((entry) => (
                  <div
                    key={`${entry.id || entry.targetId || entry.createdAt}-${entry.action}`}
                    style={{
                      border: '1px solid rgba(159, 23, 77, 0.16)',
                      borderRadius: 14,
                      padding: '12px 14px',
                      background: '#fff',
                      display: 'grid',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong style={{ color: '#111827' }}>{entry.targetLabel || 'Target'}</strong>
                      <StatusBadge status={entry.action === 'deleted' ? 'danger' : entry.action === 'updated' ? 'info' : 'success'}>
                        {entry.action}
                      </StatusBadge>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                      {entry.salesPersonName || '---'} • {money(entry.revenueTarget || 0)} revenue • {money(entry.collectionTarget || 0)} collection
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                      {entry.actor || 'System'} • {formatTargetActivityTime(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No target activity yet" message="Save or update a target to see recent activity here." />
            )}
          </AppCard>

          <AppCard title="Year-Month Matrix" className="crm-table-card" style={{ width: '100%', minWidth: 0 }}>
            {safeRows(matrix).length ? (
              <div className="table-scroll-x sales-matrix-scroll" style={matrixScrollStyle}>
                {isMobile ? <div style={scrollHintStyle}>Swipe left or right to see all months.</div> : null}
                <div style={matrixInnerStyle}>
                  <table
                    className="table-clean sales-matrix-table"
                    style={matrixTableStyle}
                  >
                    <colgroup>
                      <col style={{ width: `${getColumnWidth('year')}px` }} />
                      {monthOptions.map((month) => (
                        <col key={month.value} style={{ width: `${getColumnWidth(`month-${month.value}`)}px` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="table-header-cell table-text-cell table-sticky-first" style={headCellStyle('year')}>Year<span style={resizeHandleStyle} onPointerDown={(event) => startResize('year', event)} /></th>
                        {monthOptions.map((month) => (
                          <th key={month.value} className="table-header-cell table-number-cell" style={headCellStyle(`month-${month.value}`, 'center')}>
                            {month.label}<span style={resizeHandleStyle} onPointerDown={(event) => startResize(`month-${month.value}`, event)} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row) => (
                        <tr key={row.year} style={{ height: isMobile ? 44 : 48 }}>
                          <td className="table-name-cell table-sticky-first" style={{ ...bodyCellStyle('year'), background: '#fff' }}>
                            {row.year}
                          </td>
                          {safeRows(row.cells).map((cell) => (
                            <td
                              key={`${row.year}-${cell.month}`}
                              className="table-number-cell"
                              style={{
                                ...bodyCellStyle(`month-${cell.month}`),
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              <div style={{ fontWeight: 800, lineHeight: 1.1 }}>{percent(cell.achievementPercent)}</div>
                              <div style={{ color: '#6B7280', fontSize: isMobile ? 11 : 12, lineHeight: 1.2 }}>
                                {money(cell.achieved)} / {money(cell.target)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <EmptyState title="No matrix data" message="Year and month comparisons will appear here." />}
          </AppCard>
        </>
      )}
    </div>
  );
}
