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
import DashboardStatCard from '../../components/ui/DashboardStatCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { apiGet, currentMonth, currentYear, formatCompactIndianCurrency, monthOptions, money, number, percent, safeRows } from './salesPerformanceApi';
import './salesPerformance.css';

const chartWrap = { width: '100%', height: 300 };
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

export default function SalesPerformanceDashboard() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [filters, setFilters] = useState({ year: currentYear, month: currentMonth, employeeId: '' });
  const [data, setData] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [employees, setEmployees] = useState([]);
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
  const chartWrap = { width: '100%', height: isMobile ? 220 : 300 };
  const monthByValue = useMemo(() => new Map(monthOptions.map((month) => [month.value, month.label])), []);
  const filtersGridStyle = viewportWidth >= 1100
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' };

  const summaryGridStyle = viewportWidth >= 1200
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 700
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', width: '100%' };
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

  const summaryValue = (key) => {
    if (key === 'bestPerformer') return data?.summary?.bestPerformer?.employeeName || '---';
    if (String(key).includes('Percent')) return percent(data?.summary?.[key] || 0);
    return money(data?.summary?.[key] || 0);
  };
  const isTargetMet = (actual, target) => Number(actual || 0) >= Number(target || 0);
  const formatCurrencyTooltip = (value, name) => [formatCompactIndianCurrency(value), currencyTooltipLabel[name] || name];

  return (
    <div
      className="crm-page sales-performance-page sales-dashboard-page"
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
                style={isMobile ? { width: '100%', minWidth: 0 } : undefined}
                contentStyle={isMobile ? { padding: 12, gap: 8 } : undefined}
                titleStyle={isMobile ? { fontSize: 11 } : undefined}
                valueStyle={isMobile ? { fontSize: 22 } : undefined}
              />
            ))}
          </div>

      <AppCard title="Monthly Target vs Achievement" className="crm-chart-card" style={{ width: '100%', minWidth: 0 }}>
            {safeRows(data?.monthlyTrend).length ? (
              <div className="sales-chart-scroll">
                <div className="sales-chart-inner sales-chart-inner--wide" style={{ ...chartWrap, minWidth: isMobile ? 650 : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={safeRows(data?.monthlyTrend)} margin={{ top: 8, right: 8, left: isMobile ? -8 : 0, bottom: isMobile ? 12 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      height={isMobile ? 36 : 30}
                      interval={0}
                      angle={isMobile ? -15 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                    />
                    <YAxis width={isMobile ? 40 : 52} tick={{ fontSize: isMobile ? 10 : 12 }} tickFormatter={formatCompactIndianCurrency} />
                    <Tooltip formatter={formatCurrencyTooltip} />
                    <Bar dataKey="target" fill={targetColor} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="achieved" radius={[8, 8, 0, 0]}>
                      {safeRows(data?.monthlyTrend).map((entry) => (
                        <Cell key={entry.month} fill={isTargetMet(entry.achieved, entry.target) ? successColor : dangerColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
            ) : <EmptyState title="No monthly data" message="Targets and achievements will appear here." />}
          </AppCard>

          <AppCard title="Year-Month Matrix" className="crm-table-card" style={{ width: '100%', minWidth: 0 }}>
            {safeRows(matrix).length ? (
              <div className="table-scroll-x sales-matrix-scroll" style={matrixScrollStyle}>
                {isMobile ? <div style={scrollHintStyle}>Swipe left or right to see all months.</div> : null}
                <div style={matrixInnerStyle}>
                  <table
                    className="table-clean"
                    style={{
                      width: '100%',
                      borderCollapse: 'separate',
                      borderSpacing: 0,
                      tableLayout: 'fixed'
                    }}
                  >
                    <colgroup>
                      <col style={{ width: isMobile ? '72px' : '10%' }} />
                      {monthOptions.map((month) => (
                        <col key={month.value} style={{ width: isMobile ? '92px' : '7.5%' }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="table-header-cell table-text-cell table-sticky-first" style={{ padding: isMobile ? '9px 10px' : '12px 14px', whiteSpace: 'nowrap' }}>Year</th>
                        {monthOptions.map((month) => (
                          <th key={month.value} className="table-header-cell table-number-cell" style={{ padding: isMobile ? '9px 10px' : '12px 14px', whiteSpace: 'nowrap' }}>
                            {month.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row) => (
                        <tr key={row.year} style={{ height: isMobile ? 44 : 48 }}>
                          <td className="table-name-cell table-sticky-first" style={{ padding: isMobile ? '9px 10px' : '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', background: '#fff' }}>
                            {row.year}
                          </td>
                          {safeRows(row.cells).map((cell) => (
                            <td
                              key={`${row.year}-${cell.month}`}
                              className="table-number-cell"
                              style={{
                                padding: isMobile ? '9px 10px' : '12px 14px',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              <div style={{ fontWeight: 800, lineHeight: 1.1, textAlign: 'right' }}>{percent(cell.achievementPercent)}</div>
                              <div style={{ color: '#6B7280', fontSize: isMobile ? 11 : 12, lineHeight: 1.2, textAlign: 'right' }}>
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

          <AppCard title="Sales Person Performance" className="crm-chart-card" style={{ width: '100%', minWidth: 0 }}>
            {safeRows(data?.salesPersonPerformance).length ? (
              <div className="sales-chart-scroll">
                <div className="sales-chart-inner" style={{ ...chartWrap, minWidth: isMobile ? 650 : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={safeRows(data?.salesPersonPerformance)} margin={{ top: 8, right: 8, left: isMobile ? -10 : 0, bottom: isMobile ? 12 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="employeeName"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      height={isMobile ? 36 : 30}
                      interval={0}
                      angle={isMobile ? -15 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                    />
                    <YAxis width={isMobile ? 28 : 40} tick={{ fontSize: isMobile ? 10 : 12 }} />
                    <Tooltip />
                    <Bar dataKey="yearlyAchievementPercent" radius={[8, 8, 0, 0]}>
                      {safeRows(data?.salesPersonPerformance).map((entry) => (
                        <Cell
                          key={entry.employeeId}
                          fill={Number(entry.yearlyAchievementPercent || 0) >= 100 ? successColor : dangerColor}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
            ) : <EmptyState title="No team performance yet" message="Add targets and records to compare people here." />}
          </AppCard>
        </>
      )}
    </div>
  );
}
