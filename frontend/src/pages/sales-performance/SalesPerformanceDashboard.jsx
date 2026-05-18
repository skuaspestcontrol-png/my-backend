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
import { apiGet, currentMonth, currentYear, monthOptions, money, number, percent, safeRows } from './salesPerformanceApi';

const chartWrap = { width: '100%', height: 300 };
const targetColor = '#111827';
const successColor = '#16A34A';
const dangerColor = '#DC2626';

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
      setError(err?.response?.data?.error || err?.message || 'Unable to load sales performance dashboard.');
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
  const chartWrap = { width: '100%', height: isMobile ? 150 : 300 };
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
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
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

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%', minWidth: 0, overflowX: 'hidden' }}>
      <PageHeader
        title="Sales Performance"
        subtitle="Track monthly and yearly target vs achievement in a simple clean view."
        action={(
          viewportWidth <= 640 ? null : (
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>
              Refresh
            </AppButton>
          )
        )}
      />

      <AppCard title="Filters">
        <div style={filtersGridStyle}>
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
          <AppInput label="Selected Team" value={filters.employeeId ? 'Single Sales Person' : 'All Team'} readOnly />
        </div>
        <div style={{ display: 'flex', justifyContent: viewportWidth <= 480 ? 'stretch' : 'flex-end', marginTop: 12 }}>
          <AppButton onClick={() => load(filters)} style={viewportWidth <= 480 ? { width: '100%', justifyContent: 'center' } : undefined}>
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
          <div style={summaryGridStyle}>
            {summaryCards.map((card) => (
              <DashboardStatCard
                key={card.key}
                title={card.title}
                value={summaryValue(card.key)}
              />
            ))}
          </div>

      <AppCard title="Monthly Target vs Achievement">
            {safeRows(data?.monthlyTrend).length ? (
              <div style={chartWrap}>
                <ResponsiveContainer>
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
                    <YAxis width={isMobile ? 28 : 40} tick={{ fontSize: isMobile ? 10 : 12 }} />
                    <Tooltip />
                    <Bar dataKey="target" fill={targetColor} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="achieved" radius={[8, 8, 0, 0]}>
                      {safeRows(data?.monthlyTrend).map((entry) => (
                        <Cell key={entry.month} fill={isTargetMet(entry.achieved, entry.target) ? successColor : dangerColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="No monthly data" message="Targets and achievements will appear here." />}
          </AppCard>

          <AppCard title="Year-Month Matrix">
            {safeRows(matrix).length ? (
              <div style={matrixScrollStyle}>
                {isMobile ? <div style={scrollHintStyle}>Swipe left or right to see all months.</div> : null}
                <div style={matrixInnerStyle}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
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
                        <th style={{ padding: isMobile ? '9px 10px' : '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Year</th>
                        {monthOptions.map((month) => (
                          <th key={month.value} style={{ padding: isMobile ? '9px 10px' : '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                            {month.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row) => (
                        <tr key={row.year} style={{ height: isMobile ? 44 : 48 }}>
                          <td style={{ padding: isMobile ? '9px 10px' : '10px 12px', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {row.year}
                          </td>
                          {safeRows(row.cells).map((cell) => (
                            <td
                              key={`${row.year}-${cell.month}`}
                              style={{
                                padding: isMobile ? '9px 10px' : '10px 12px',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
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

          <AppCard title="Sales Person Performance">
            {safeRows(data?.salesPersonPerformance).length ? (
              <div style={chartWrap}>
                <ResponsiveContainer>
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
            ) : <EmptyState title="No team performance yet" message="Add targets and records to compare people here." />}
          </AppCard>
        </>
      )}
    </div>
  );
}
