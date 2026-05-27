import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
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
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
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
import { apiGet, currentMonth, currentYear, formatCompactIndianCurrency, monthOptions, money, number, percent, safeRows, subscribeSalesPerformanceRefresh } from './salesPerformanceApi';
import './salesPerformance.css';

const targetColor = '#111827';
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const neutralTextColor = '#111827';
const currencyTooltipLabel = {
  monthlyTarget: 'Monthly Target',
  monthlyAchieved: 'Monthly Achieved'
};

export default function SalesTeamPerformance() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [filters, setFilters] = useState({ year: currentYear, month: currentMonth, salesPersonId: '' });
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/sales-performance/team-performance', nextFilters);
      setRows(safeRows(res.rows));
      setEmployees(safeRows(res.employees));
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
    const unsubscribe = subscribeSalesPerformanceRefresh(() => {
      load(filters);
    });
    return unsubscribe;
  }, [filters]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const employeeOptions = useMemo(() => safeRows(employees), [employees]);
  const isMobile = viewportWidth <= 640;
  const filtersGridStyle = viewportWidth >= 1100
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' };
  const chartGridStyle = getChartGridStyle(viewportWidth);
  const tableWrapStyle = { width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
  const headCellStyle = {
    padding: viewportWidth <= 640 ? '9px 10px' : '12px 14px',
    whiteSpace: 'normal',
    wordBreak: 'keep-all',
    overflowWrap: 'normal',
    verticalAlign: 'middle',
    height: viewportWidth <= 640 ? 46 : 54,
    lineHeight: 1.2,
    fontSize: viewportWidth <= 640 ? 12 : 13
  };
  const bodyCellStyle = {
    padding: viewportWidth <= 640 ? '9px 10px' : '12px 14px',
    whiteSpace: 'nowrap',
    wordBreak: 'normal',
    verticalAlign: 'middle',
    height: viewportWidth <= 640 ? 46 : 50,
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };
  const teamColumns = [
    { key: 'salesPerson', label: 'Sales Person' },
    { key: 'monthlyTarget', label: 'Monthly Target' },
    { key: 'monthlyAchieved', label: 'Monthly Achieved' },
    { key: 'monthlyPercent', label: 'Monthly %' },
    { key: 'yearlyTarget', label: 'Yearly Target' },
    { key: 'yearlyAchieved', label: 'Yearly Achieved' },
    { key: 'yearlyPercent', label: 'Yearly %' },
    { key: 'leadsAssigned', label: 'Leads Assigned' },
    { key: 'leadsConverted', label: 'Leads Converted' },
    { key: 'revenueGenerated', label: 'Revenue Generated' },
    { key: 'status', label: 'Status' }
  ];
  const teamWidths = {
    salesPerson: 180,
    monthlyTarget: 130,
    monthlyAchieved: 130,
    monthlyPercent: 95,
    yearlyTarget: 130,
    yearlyAchieved: 130,
    yearlyPercent: 95,
    leadsAssigned: 120,
    leadsConverted: 120,
    revenueGenerated: 140,
    status: 110
  };
  const teamBounds = {
    salesPerson: { min: 160, max: 260 },
    monthlyTarget: { min: 110, max: 170 },
    monthlyAchieved: { min: 110, max: 170 },
    monthlyPercent: { min: 80, max: 130 },
    yearlyTarget: { min: 110, max: 170 },
    yearlyAchieved: { min: 110, max: 170 },
    yearlyPercent: { min: 80, max: 130 },
    leadsAssigned: { min: 100, max: 160 },
    leadsConverted: { min: 100, max: 160 },
    revenueGenerated: { min: 120, max: 180 },
    status: { min: 90, max: 140 }
  };
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'sales_team_performance_table_widths',
    columns: teamColumns.map((column) => column.key),
    defaultColumnWidths: teamWidths,
    columnBounds: teamBounds,
    minWidth: 80,
    enabled: true
  });
  const tableMinWidth = teamColumns.reduce((sum, column) => sum + (getColumnWidth(column.key) || teamWidths[column.key] || 80), 0);
  const tableStyle = {
    width: '100%',
    minWidth: viewportWidth <= 640 ? `${Math.max(930, tableMinWidth)}px` : `${Math.max(1360, tableMinWidth)}px`,
    tableLayout: 'fixed',
    borderCollapse: 'collapse'
  };
  const headCell = (key, align = 'left') => ({
    ...headCellStyle,
    position: 'relative',
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const bodyCell = (key, align = 'left') => ({
    ...bodyCellStyle,
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const chartAxisProps = getChartAxisProps({ mobile: isMobile });
  const chartHeight = getChartHeight({ mobile: isMobile });
  const currencyAxisProps = getCurrencyAxisProps({ mobile: isMobile });
  const percentAxisProps = getPercentAxisProps({ mobile: isMobile });
  const barChartProps = getBarChartProps(rows.length, { mobile: isMobile });
  const scrollHintStyle = {
    marginBottom: 8,
    color: '#6B7280',
    fontSize: isMobile ? 11 : 12,
    fontWeight: 600
  };

  const isTargetMet = (actual, target) => Number(actual || 0) >= Number(target || 0);
  const statusColor = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'excellent') return successColor;
    if (value === 'low') return dangerColor;
    return neutralTextColor;
  };
  const metricColor = (actual, target) => {
    const targetValue = Number(target || 0);
    if (targetValue <= 0) return neutralTextColor;
    return Number(actual || 0) >= targetValue ? successColor : dangerColor;
  };

  return (
    <div
      className="crm-page sales-performance-page sales-team-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 12 : 16,
        width: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        alignItems: 'stretch',
        justifyContent: 'flex-start'
      }}
    >
      <PageHeader
        title="Team Performance"
        subtitle="Compare sales team members by monthly and yearly achievement."
        titleStyle={isMobile ? { fontSize: 24, lineHeight: 1.1 } : undefined}
        subtitleStyle={isMobile ? { fontSize: 13, lineHeight: 1.3 } : undefined}
        action={viewportWidth <= 640 ? null : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>
          </div>
        )}
      />

      <AppCard title="Filters" className="crm-filter-card" style={{ width: '100%', minWidth: 0 }}>
        <div className="sales-filters-grid" style={filtersGridStyle}>
          <AppSelect label="Month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </AppSelect>
          <AppSelect label="Year" value={filters.year} onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}>
            {Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </AppSelect>
          <AppSelect label="Sales Person" value={filters.salesPersonId} onChange={(e) => setFilters({ ...filters, salesPersonId: e.target.value })}>
            <option value="">All</option>
            {employeeOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </AppSelect>
          {!isMobile ? <AppInput label="Team View" value="Monthly + Yearly comparison" readOnly /> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: viewportWidth <= 480 ? 'stretch' : 'flex-end', marginTop: 12 }}>
          <AppButton onClick={() => load(filters)} fullWidth={viewportWidth <= 480} style={viewportWidth <= 480 ? { width: '100%' } : undefined}>Apply Filters</AppButton>
        </div>
      </AppCard>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><LoadingSpinner size={26} /></div>
      ) : error ? (
        <AppCard><EmptyState title="Team performance error" message={error} /></AppCard>
      ) : (
        <>
          <div style={chartGridStyle}>
            <CompactChartCard title="Target vs Achievement" isMobile={isMobile}>
              {rows.length ? (
                <ChartSurface height={chartHeight}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={getChartMargin({ mobile: isMobile })} barCategoryGap={barChartProps.barCategoryGap} barGap={barChartProps.barGap}>
                      <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                      <XAxis dataKey="employeeName" {...chartAxisProps} />
                      <YAxis {...currencyAxisProps} />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        content={<SalesChartTooltip valueFormatter={(value) => formatCompactIndianCurrency(value || 0)} />}
                      />
                      <Bar dataKey="monthlyTarget" name={currencyTooltipLabel.monthlyTarget} fill={targetColor} radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize} />
                      <Bar dataKey="monthlyAchieved" name={currencyTooltipLabel.monthlyAchieved} radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize}>
                        {rows.map((entry) => (
                          <Cell
                            key={entry.employeeId}
                            fill={isTargetMet(entry.monthlyAchieved, entry.monthlyTarget) ? successColor : dangerColor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartSurface>
              ) : <EmptyState title="No comparison data" message="Team target vs achievement chart will appear here." />}
            </CompactChartCard>

            <CompactChartCard title="Achievement %" isMobile={isMobile}>
              {rows.length ? (
                <ChartSurface height={chartHeight}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={getChartMargin({ mobile: isMobile })} barCategoryGap={barChartProps.barCategoryGap} barGap={barChartProps.barGap}>
                      <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                      <XAxis dataKey="employeeName" {...chartAxisProps} />
                      <YAxis {...percentAxisProps} />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        content={<SalesChartTooltip valueFormatter={(value) => percent(value || 0)} />}
                      />
                      <Bar dataKey="yearlyAchievementPercent" name="Yearly %" radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize}>
                        {rows.map((entry) => (
                          <Cell
                            key={entry.employeeId}
                            fill={Number(entry.yearlyAchievementPercent || 0) >= 100 ? successColor : dangerColor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartSurface>
              ) : <EmptyState title="No achievement data" message="Achievement percentage chart will appear here." />}
            </CompactChartCard>
          </div>

          <AppCard title="Team Performance Table" className="crm-table-card" style={{ width: '100%', minWidth: 0 }}>
            {rows.length ? (
              <div className="table-scroll-x sales-team-table-scroll" style={{ ...tableWrapStyle, touchAction: 'pan-x' }}>
                {isMobile ? <div style={scrollHintStyle}>Swipe left or right to see all columns.</div> : null}
                <table className="table-clean sales-team-performance-table sales-performance-table" style={tableStyle}>
                  <colgroup>
                    {teamColumns.map((column) => (
                      <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="table-header-cell table-text-cell table-sticky-first sticky-sales-person" style={headCell('salesPerson')}>Sales Person</th>
                      <th className="table-header-cell table-number-cell" style={headCell('monthlyTarget', 'center')}>Monthly Target</th>
                      <th className="table-header-cell table-number-cell" style={headCell('monthlyAchieved', 'center')}>Monthly Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCell('monthlyPercent', 'center')}>Monthly %</th>
                      <th className="table-header-cell table-number-cell" style={headCell('yearlyTarget', 'center')}>Yearly Target</th>
                      <th className="table-header-cell table-number-cell" style={headCell('yearlyAchieved', 'center')}>Yearly Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCell('yearlyPercent', 'center')}>Yearly %</th>
                      <th className="table-header-cell table-number-cell" style={headCell('leadsAssigned', 'center')}>Leads Assigned</th>
                      <th className="table-header-cell table-number-cell" style={headCell('leadsConverted', 'center')}>Leads Converted</th>
                      <th className="table-header-cell table-number-cell" style={headCell('revenueGenerated', 'center')}>Revenue Generated</th>
                      <th className="table-header-cell table-status-cell" style={headCell('status', 'center')}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} style={{ height: viewportWidth <= 640 ? 46 : 50 }}>
                        <td className="table-name-cell table-sticky-first sticky-sales-person" style={{ ...bodyCell('salesPerson'), background: '#fff' }}>{row.employeeName}</td>
                        <td className="table-number-cell" style={bodyCell('monthlyTarget', 'center')}>{money(row.monthlyTarget)}</td>
                        <td className="table-number-cell" style={bodyCell('monthlyAchieved', 'center')}>
                          <span style={{ color: metricColor(row.monthlyAchieved, row.monthlyTarget), fontWeight: 700 }}>
                            {money(row.monthlyAchieved)}
                          </span>
                        </td>
                        <td className="table-percent-cell" style={bodyCell('monthlyPercent', 'center')}>
                          <span style={{ color: metricColor(row.monthlyAchieved, row.monthlyTarget), fontWeight: 700 }}>
                            {percent(row.monthlyAchievementPercent)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCell('yearlyTarget', 'center')}>{money(row.yearlyTarget)}</td>
                        <td className="table-number-cell" style={bodyCell('yearlyAchieved', 'center')}>
                          <span style={{ color: metricColor(row.yearlyAchieved, row.yearlyTarget), fontWeight: 700 }}>
                            {money(row.yearlyAchieved)}
                          </span>
                        </td>
                        <td className="table-percent-cell" style={bodyCell('yearlyPercent', 'center')}>
                          <span style={{ color: metricColor(row.yearlyAchieved, row.yearlyTarget), fontWeight: 700 }}>
                            {percent(row.yearlyAchievementPercent)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCell('leadsAssigned', 'center')}>{number(row.leadsAssigned)}</td>
                        <td className="table-number-cell" style={bodyCell('leadsConverted', 'center')}>{number(row.leadsConverted)}</td>
                        <td className="table-number-cell" style={bodyCell('revenueGenerated', 'center')}>{money(row.revenueGenerated)}</td>
                        <td className="table-status-cell" style={bodyCell('status', 'center')}>
                          <span style={{ color: statusColor(row.status), fontWeight: 700 }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No team data" message="Add targets and source records to compare the team." />}
          </AppCard>
        </>
      )}
    </div>
  );
}
