import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
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
import {
  ChartSurface,
  CompactChartCard,
  getBarChartProps,
  getChartAxisProps,
  getChartGridStyle,
  getChartHeight,
  getChartMargin,
  getCurrencyAxisProps,
  SalesChartTooltip,
  salesChartTheme
} from './SalesChartPrimitives';
import { apiGet, currentMonth, currentYear, downloadCsv, formatCompactIndianCurrency, monthOptions, money, percent, safeRows } from './salesPerformanceApi';
import './salesPerformance.css';

const targetColor = '#111827';
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const neutralTextColor = '#111827';
const reportTypeOptions = [
  { value: 'monthly', label: 'Monthly target vs achievement' },
  { value: 'yearly', label: 'Yearly target vs achievement' },
  { value: 'team', label: 'Team overall performance' },
  { value: 'sales', label: 'Sales person wise performance' }
];
const currencyTooltipLabel = {
  monthlyTarget: 'Monthly Target',
  monthlyAchieved: 'Monthly Achieved',
  yearlyTarget: 'Yearly Target',
  yearlyAchieved: 'Yearly Achieved'
};

export default function SalesPerformanceReports() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    month: currentMonth,
    year: currentYear,
    salesPersonId: '',
    reportType: 'monthly'
  });
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/sales-performance/reports', nextFilters);
      setRows(safeRows(res.rows));
      setEmployees(safeRows(res.employees));
      setSummary(res.summary || null);
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

  const employeeOptions = useMemo(() => safeRows(employees), [employees]);
  const chartData = useMemo(() => rows.map((row) => ({
    employeeName: row.employeeName,
    monthlyTarget: Number(row.monthlyTarget || 0),
    monthlyAchieved: Number(row.monthlyAchieved || 0),
    monthlyCollectionTarget: Number(row.monthlyCollectionTarget || 0),
    monthlyCollectionAchieved: Number(row.monthlyCollectionAchieved || 0),
    yearlyTarget: Number(row.yearlyTarget || 0),
    yearlyAchieved: Number(row.yearlyAchieved || 0),
    yearlyCollectionTarget: Number(row.yearlyCollectionTarget || 0),
    yearlyCollectionAchieved: Number(row.yearlyCollectionAchieved || 0),
    monthlyAchievementPercent: Number(row.monthlyAchievementPercent || 0),
    yearlyAchievementPercent: Number(row.yearlyAchievementPercent || 0)
  })), [rows]);
  const isMobile = viewportWidth <= 640;
  const isTargetMet = (actual, target) => Number(actual || 0) >= Number(target || 0);
  const metricColor = (actual, target) => {
    const targetValue = Number(target || 0);
    if (targetValue <= 0) return neutralTextColor;
    return Number(actual || 0) >= targetValue ? successColor : dangerColor;
  };
  const statusColor = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'excellent') return successColor;
    if (value === 'low') return dangerColor;
    return neutralTextColor;
  };
  const tableWrapStyle = { width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
  const tableStyle = {
    width: '100%',
    minWidth: viewportWidth <= 640 ? '1850px' : '2080px',
    tableLayout: 'fixed',
    borderCollapse: 'collapse'
  };
  const headCellStyle = {
    padding: viewportWidth <= 640 ? '9px 10px' : '12px 14px',
    whiteSpace: 'normal',
    wordBreak: 'keep-all',
    overflowWrap: 'normal',
    verticalAlign: 'middle',
    height: viewportWidth <= 640 ? 48 : 56,
    lineHeight: 1.2,
    fontSize: viewportWidth <= 640 ? 12 : 13
  };
  const bodyCellStyle = {
    padding: viewportWidth <= 640 ? '9px 10px' : '12px 14px',
    whiteSpace: 'nowrap',
    wordBreak: 'normal',
    verticalAlign: 'middle',
    height: viewportWidth <= 640 ? 46 : 50,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };
  const firstHeadCellStyle = viewportWidth <= 640
    ? { ...headCellStyle, textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11, padding: '9px 10px' }
    : headCellStyle;

  const summaryCards = [
    { title: 'Rows', value: summary?.rows || 0 },
    { title: 'Monthly Target', value: money(summary?.totalMonthlyTarget || 0) },
    { title: 'Monthly Achieved', value: money(summary?.totalMonthlyAchieved || 0) },
    { title: 'Yearly Target', value: money(summary?.totalYearlyTarget || 0) },
    { title: 'Yearly Achieved', value: money(summary?.totalYearlyAchieved || 0) }
  ];

  const filtersGridStyle = viewportWidth >= 1400
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 1100
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
      : viewportWidth >= 768
        ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
        : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
  const reportTypeSpanStyle = viewportWidth <= 640 ? { gridColumn: '1 / -1' } : undefined;
  const dateSpanStyle = viewportWidth <= 640 ? { gridColumn: '1 / -1' } : undefined;

  const summaryGridStyle = viewportWidth >= 1200
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 900
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
      : viewportWidth >= 600
        ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
        : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
  const chartGridStyle = getChartGridStyle(viewportWidth);
  const chartAxisProps = getChartAxisProps({ mobile: isMobile });
  const chartHeight = getChartHeight({ mobile: isMobile });
  const currencyAxisProps = getCurrencyAxisProps({ mobile: isMobile });
  const barChartProps = getBarChartProps(chartData.length, { mobile: isMobile });
  const scrollHintStyle = {
    marginBottom: 8,
    color: '#6B7280',
    fontSize: isMobile ? 11 : 12,
    fontWeight: 600
  };

  const exportCsv = () => {
    downloadCsv(rows.map((row) => ({
      SalesPerson: row.employeeName,
      Month: row.month,
      Year: row.year,
      MonthlyTarget: row.monthlyTarget,
      MonthlyAchieved: row.monthlyAchieved,
      MonthlyPending: row.monthlyPending,
      MonthlyAchievementPercent: row.monthlyAchievementPercent,
      MonthlyCollectionTarget: row.monthlyCollectionTarget,
      MonthlyCollectionAchieved: row.monthlyCollectionAchieved,
      MonthlyCollectionPending: row.monthlyCollectionPending,
      MonthlyCollectionPercent: row.monthlyCollectionPercent,
      YearlyTarget: row.yearlyTarget,
      YearlyAchieved: row.yearlyAchieved,
      YearlyPending: row.yearlyPending,
      YearlyAchievementPercent: row.yearlyAchievementPercent,
      YearlyCollectionTarget: row.yearlyCollectionTarget,
      YearlyCollectionAchieved: row.yearlyCollectionAchieved,
      YearlyCollectionPending: row.yearlyCollectionPending,
      YearlyCollectionPercent: row.yearlyCollectionPercent,
      LeadsAssigned: row.leadsAssigned,
      LeadsConverted: row.leadsConverted,
      RevenueGenerated: row.revenueGenerated,
      Status: row.status
    })), 'sales-performance-reports.csv');
  };

  const compactCardStyle = {
    minWidth: 0,
    width: '100%',
    borderRadius: 20
  };
  const compactHeaderStyle = {
    padding: isMobile ? '12px 14px' : '14px 18px'
  };
  const compactBodyStyle = {
    padding: isMobile ? '12px 14px 14px' : '16px 18px 18px'
  };
  const mobileButtonStyle = viewportWidth <= 480 ? { width: '100%', justifyContent: 'center' } : undefined;
  const mobileDateInputStyle = isMobile
    ? { minWidth: 0, width: '100%', maxWidth: '100%', display: 'block', WebkitAppearance: 'none', appearance: 'none' }
    : undefined;

  return (
    <div
      className="crm-page sales-performance-page sales-reports-page"
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
        title="Reports"
        subtitle="Review target vs achievement reports and export the current result set as CSV."
        titleStyle={isMobile ? { fontSize: 24, lineHeight: 1.1 } : undefined}
        subtitleStyle={isMobile ? { fontSize: 13, lineHeight: 1.3 } : undefined}
        action={(
          viewportWidth <= 640 ? null : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: viewportWidth <= 480 ? 'stretch' : 'flex-end', maxWidth: '100%' }}>
              <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading} style={mobileButtonStyle}>Refresh</AppButton>
              <AppButton variant="outline" iconLeft={<Download size={16} />} onClick={exportCsv} disabled={!rows.length} style={mobileButtonStyle}>CSV Export</AppButton>
            </div>
          )
        )}
      />

      <AppCard title="Filters" className="crm-filter-card" style={compactCardStyle} headerStyle={compactHeaderStyle} bodyStyle={compactBodyStyle}>
        <div style={filtersGridStyle}>
          <div style={reportTypeSpanStyle}>
            <AppSelect label="Report Type" value={filters.reportType} onChange={(e) => setFilters({ ...filters, reportType: e.target.value })}>
            {reportTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </AppSelect>
          </div>
          <div style={dateSpanStyle}>
            <AppInput label="Start Date" type="date" style={mobileDateInputStyle} value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          </div>
          <div style={dateSpanStyle}>
            <AppInput label="End Date" type="date" style={mobileDateInputStyle} value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <AppSelect label="Month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </AppSelect>
          <AppSelect label="Year" value={filters.year} onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}>
            {Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </AppSelect>
          <AppSelect label="Sales Person" value={filters.salesPersonId} onChange={(e) => setFilters({ ...filters, salesPersonId: e.target.value })}>
            <option value="">All Team</option>
            {employeeOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </AppSelect>
        </div>
        <div style={{ display: 'flex', justifyContent: viewportWidth <= 480 ? 'stretch' : 'flex-end', marginTop: 12 }}>
          <AppButton onClick={() => load(filters)} style={viewportWidth <= 480 ? { width: '100%', justifyContent: 'center' } : undefined}>Apply Filters</AppButton>
        </div>
      </AppCard>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
          <LoadingSpinner size={26} />
        </div>
      ) : error ? (
        <AppCard><EmptyState title="Sales report error" message={error} /></AppCard>
      ) : (
        <>
          <div style={summaryGridStyle}>
            {summaryCards.map((card) => (
          <AppCard key={card.title} title={card.title} className="crm-kpi-card" style={compactCardStyle} headerStyle={compactHeaderStyle} bodyStyle={compactBodyStyle}>
                <div style={{ fontSize: viewportWidth <= 640 ? 20 : 24, fontWeight: 800, color: 'var(--color-text)' }}>{card.value}</div>
              </AppCard>
            ))}
          </div>

          <div className="sales-analytics-grid" style={chartGridStyle}>
            <CompactChartCard title="Monthly Target vs Achievement" isMobile={isMobile} style={compactCardStyle}>
              {chartData.length ? (
                <ChartSurface height={chartHeight}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={getChartMargin({ mobile: isMobile })} barCategoryGap={barChartProps.barCategoryGap} barGap={barChartProps.barGap}>
                      <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                      <XAxis dataKey="employeeName" {...chartAxisProps} />
                      <YAxis {...currencyAxisProps} />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        content={<SalesChartTooltip valueFormatter={(value) => formatCompactIndianCurrency(value || 0)} />}
                      />
                      <Bar dataKey="monthlyTarget" name={currencyTooltipLabel.monthlyTarget} fill={targetColor} radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize} />
                      <Bar dataKey="monthlyAchieved" name={currencyTooltipLabel.monthlyAchieved} radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize}>
                        {chartData.map((entry) => (
                          <Cell
                            key={`${entry.employeeName}-monthly`}
                            fill={isTargetMet(entry.monthlyAchieved, entry.monthlyTarget) ? successColor : dangerColor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartSurface>
              ) : (
                <EmptyState title="No report data" message="Choose filters and load sales rows to see the report." />
              )}
            </CompactChartCard>

            <CompactChartCard title="Yearly Target vs Achievement" isMobile={isMobile} style={compactCardStyle}>
              {chartData.length ? (
                <ChartSurface height={chartHeight}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={getChartMargin({ mobile: isMobile })} barCategoryGap={barChartProps.barCategoryGap} barGap={barChartProps.barGap}>
                      <CartesianGrid stroke={salesChartTheme.gridStroke} vertical={false} />
                      <XAxis dataKey="employeeName" {...chartAxisProps} />
                      <YAxis {...currencyAxisProps} />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        content={<SalesChartTooltip valueFormatter={(value) => formatCompactIndianCurrency(value || 0)} />}
                      />
                      <Bar dataKey="yearlyTarget" name={currencyTooltipLabel.yearlyTarget} fill={targetColor} radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize} />
                      <Bar dataKey="yearlyAchieved" name={currencyTooltipLabel.yearlyAchieved} radius={[8, 8, 0, 0]} maxBarSize={barChartProps.maxBarSize}>
                        {chartData.map((entry) => (
                          <Cell
                            key={`${entry.employeeName}-yearly`}
                            fill={isTargetMet(entry.yearlyAchieved, entry.yearlyTarget) ? successColor : dangerColor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartSurface>
              ) : (
                <EmptyState title="No yearly report data" message="Yearly totals will appear here when data is available." />
              )}
            </CompactChartCard>
          </div>

          <AppCard title="Report Table" className="crm-table-card" style={compactCardStyle} headerStyle={compactHeaderStyle} bodyStyle={compactBodyStyle}>
            {rows.length ? (
              <div className="table-scroll-x sales-report-table-scroll" style={{ ...tableWrapStyle, touchAction: 'pan-x' }}>
                {isMobile ? <div style={scrollHintStyle}>Swipe left or right to see all columns.</div> : null}
                <table className="table-clean sales-performance-report-table sales-performance-table" style={tableStyle}>
                  <colgroup>
                    <col style={{ width: '190px' }} />
                    <col style={{ width: '135px' }} />
                    <col style={{ width: '135px' }} />
                    <col style={{ width: '95px' }} />
                    <col style={{ width: '165px' }} />
                    <col style={{ width: '165px' }} />
                    <col style={{ width: '105px' }} />
                    <col style={{ width: '135px' }} />
                    <col style={{ width: '135px' }} />
                    <col style={{ width: '95px' }} />
                    <col style={{ width: '165px' }} />
                    <col style={{ width: '165px' }} />
                    <col style={{ width: '105px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '105px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '100px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="table-header-cell table-text-cell table-sticky-first sticky-sales-person" style={firstHeadCellStyle}>Sales Person</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Monthly Target</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Monthly Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCellStyle}>Monthly %</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Monthly Collection Target</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Monthly Collection Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCellStyle}>Monthly Collection %</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Yearly Target</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Yearly Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCellStyle}>Yearly %</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Yearly Collection Target</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Yearly Collection Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCellStyle}>Yearly Collection %</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Leads</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Converted</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Revenue</th>
                      <th className="table-header-cell table-status-cell" style={headCellStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.employeeId}-${row.year}-${row.month}`} style={{ height: viewportWidth <= 640 ? 46 : 50 }}>
                        <td className="table-name-cell table-sticky-first sticky-sales-person" style={{ ...bodyCellStyle, background: '#fff' }}>{row.employeeName}</td>
                        <td className="table-number-cell" style={bodyCellStyle}>{money(row.monthlyTarget)}</td>
                        <td className="table-number-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyAchieved, row.monthlyTarget), fontWeight: 700 }}>
                            {money(row.monthlyAchieved)}
                          </span>
                        </td>
                        <td className="table-percent-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyAchieved, row.monthlyTarget), fontWeight: 700 }}>
                            {percent(row.monthlyAchievementPercent)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyCollectionAchieved, row.monthlyCollectionTarget), fontWeight: 700 }}>
                            {money(row.monthlyCollectionTarget)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyCollectionAchieved, row.monthlyCollectionTarget), fontWeight: 700 }}>
                            {money(row.monthlyCollectionAchieved)}
                          </span>
                        </td>
                        <td className="table-percent-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyCollectionAchieved, row.monthlyCollectionTarget), fontWeight: 700 }}>
                            {percent(row.monthlyCollectionPercent)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCellStyle}>{money(row.yearlyTarget)}</td>
                        <td className="table-number-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyAchieved, row.yearlyTarget), fontWeight: 700 }}>
                            {money(row.yearlyAchieved)}
                          </span>
                        </td>
                        <td className="table-percent-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyAchieved, row.yearlyTarget), fontWeight: 700 }}>
                            {percent(row.yearlyAchievementPercent)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyCollectionAchieved, row.yearlyCollectionTarget), fontWeight: 700 }}>
                            {money(row.yearlyCollectionTarget)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyCollectionAchieved, row.yearlyCollectionTarget), fontWeight: 700 }}>
                            {money(row.yearlyCollectionAchieved)}
                          </span>
                        </td>
                        <td className="table-percent-cell" style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyCollectionAchieved, row.yearlyCollectionTarget), fontWeight: 700 }}>
                            {percent(row.yearlyCollectionPercent)}
                          </span>
                        </td>
                        <td className="table-number-cell" style={bodyCellStyle}>{row.leadsAssigned}</td>
                        <td className="table-number-cell" style={bodyCellStyle}>{row.leadsConverted}</td>
                        <td className="table-number-cell" style={bodyCellStyle}>{money(row.revenueGenerated)}</td>
                        <td className="table-status-cell" style={bodyCellStyle}>
                          <span style={{ color: statusColor(row.status), fontWeight: 700 }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No rows" message="The selected filters did not return any rows." />
            )}
          </AppCard>
        </>
      )}
    </div>
  );
}
