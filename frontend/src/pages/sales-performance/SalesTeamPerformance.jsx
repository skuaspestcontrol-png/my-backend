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
import { apiGet, currentMonth, currentYear, monthOptions, money, number, percent, safeRows } from './salesPerformanceApi';
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
  const tableStyle = {
    width: '100%',
    minWidth: viewportWidth <= 640 ? '930px' : '1360px',
    tableLayout: 'fixed',
    borderCollapse: 'collapse'
  };
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
  const teamColWidths = viewportWidth <= 640
    ? ['170px', '120px', '120px', '90px', '120px', '120px', '90px', '110px', '110px', '130px', '100px']
    : ['180px', '130px', '130px', '95px', '130px', '130px', '95px', '120px', '120px', '140px', '110px'];
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
        action={viewportWidth <= 640 ? null : <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>}
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
                <table className="table-clean sales-team-performance-table" style={tableStyle}>
                  <colgroup>
                    {teamColWidths.map((width, index) => (
                      <col key={index} style={{ width }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="table-header-cell table-text-cell table-sticky-first" style={headCellStyle}>Sales Person</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Monthly Target</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Monthly Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCellStyle}>Monthly %</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Yearly Target</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Yearly Achieved</th>
                      <th className="table-header-cell table-percent-cell" style={headCellStyle}>Yearly %</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Leads Assigned</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Leads Converted</th>
                      <th className="table-header-cell table-number-cell" style={headCellStyle}>Revenue Generated</th>
                      <th className="table-header-cell table-status-cell" style={headCellStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} style={{ height: viewportWidth <= 640 ? 46 : 50 }}>
                        <td className="table-name-cell table-sticky-first" style={{ ...bodyCellStyle, background: '#fff' }}>{row.employeeName}</td>
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
                        <td className="table-number-cell" style={bodyCellStyle}>{number(row.leadsAssigned)}</td>
                        <td className="table-number-cell" style={bodyCellStyle}>{number(row.leadsConverted)}</td>
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
            ) : <EmptyState title="No team data" message="Add targets and source records to compare the team." />}
          </AppCard>
        </>
      )}
    </div>
  );
}
