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
import { apiGet, currentMonth, currentYear, monthOptions, money, number, percent, safeRows } from './salesPerformanceApi';
import './salesPerformance.css';

const chartWrap = { width: '100%', height: 300 };
const targetColor = '#111827';
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const neutralTextColor = '#111827';

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
  const chartWrap = { width: '100%', height: isMobile ? 220 : 300 };
  const filtersGridStyle = viewportWidth >= 1100
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : viewportWidth >= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' };
  const chartGridStyle = viewportWidth >= 900
    ? { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : { display: 'grid', gap: 16, gridTemplateColumns: '1fr' };
  const tableWrapStyle = { width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
  const tableStyle = {
    width: '100%',
    minWidth: viewportWidth <= 640 ? '850px' : '1260px',
    tableLayout: 'fixed',
    borderCollapse: 'collapse'
  };
  const headCellStyle = {
    padding: viewportWidth <= 640 ? '7px 8px' : '10px 12px',
    textAlign: 'left',
    whiteSpace: 'normal',
    wordBreak: 'keep-all',
    overflowWrap: 'normal',
    verticalAlign: 'middle',
    height: viewportWidth <= 640 ? 44 : 56,
    lineHeight: 1.15,
    fontSize: viewportWidth <= 640 ? 11 : 12
  };
  const bodyCellStyle = {
    padding: viewportWidth <= 640 ? '7px 8px' : '10px 12px',
    borderTop: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    wordBreak: 'normal',
    verticalAlign: 'middle',
    height: viewportWidth <= 640 ? 44 : 48,
    lineHeight: 1.15,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };
  const teamColWidths = viewportWidth <= 640
    ? ['18%', '10%', '10%', '8%', '10%', '10%', '8%', '9%', '9%', '10%', '8%']
    : ['20%', '10%', '10%', '8%', '10%', '10%', '8%', '9%', '9%', '10%', '8%'];
  const chartAxisProps = {
    tick: { fontSize: isMobile ? 10 : 12 },
    height: isMobile ? 36 : 30,
    interval: 0,
    angle: isMobile ? -15 : 0,
    textAnchor: isMobile ? 'end' : 'middle'
  };
  const mobileCardStyle = {
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    background: '#fff',
    padding: 12,
    display: 'grid',
    gap: 10
  };
  const mobileGridStyle = {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
  };
  const mobileMetricStyle = {
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '8px 10px',
    background: '#F9FAFB',
    display: 'grid',
    gap: 4
  };
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
    <div className="sales-performance-page sales-team-page" style={{ display: 'grid', gap: 16, width: '100%', minWidth: 0, overflowX: 'hidden' }}>
      <PageHeader
        title="Team Performance"
        subtitle="Compare sales team members by monthly and yearly achievement."
        titleStyle={isMobile ? { fontSize: 28, lineHeight: 1.15 } : undefined}
        subtitleStyle={isMobile ? { fontSize: 15, lineHeight: 1.4 } : undefined}
        action={viewportWidth <= 640 ? null : <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>}
      />

      <AppCard title="Filters" style={{ width: '100%', minWidth: 0 }}>
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
          <AppCard title="Team Performance Table" style={{ width: '100%', minWidth: 0 }}>
            {rows.length ? (
              <div className="table-scroll-x sales-team-table-scroll" style={{ ...tableWrapStyle, touchAction: 'pan-x' }}>
                {isMobile ? <div style={scrollHintStyle}>Swipe left or right to see all columns.</div> : null}
                <table style={tableStyle}>
                  <colgroup>
                    {teamColWidths.map((width, index) => (
                      <col key={index} style={{ width }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={headCellStyle}>Sales Person</th>
                      <th style={headCellStyle}>Monthly Target</th>
                      <th style={headCellStyle}>Monthly Achieved</th>
                      <th style={headCellStyle}>Monthly %</th>
                      <th style={headCellStyle}>Yearly Target</th>
                      <th style={headCellStyle}>Yearly Achieved</th>
                      <th style={headCellStyle}>Yearly %</th>
                      <th style={headCellStyle}>Leads Assigned</th>
                      <th style={headCellStyle}>Leads Converted</th>
                      <th style={headCellStyle}>Revenue Generated</th>
                      <th style={headCellStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} style={{ height: viewportWidth <= 640 ? 44 : 48 }}>
                        <td style={bodyCellStyle}>{row.employeeName}</td>
                        <td style={bodyCellStyle}>{money(row.monthlyTarget)}</td>
                        <td style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyAchieved, row.monthlyTarget), fontWeight: 700 }}>
                            {money(row.monthlyAchieved)}
                          </span>
                        </td>
                        <td style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.monthlyAchieved, row.monthlyTarget), fontWeight: 700 }}>
                            {percent(row.monthlyAchievementPercent)}
                          </span>
                        </td>
                        <td style={bodyCellStyle}>{money(row.yearlyTarget)}</td>
                        <td style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyAchieved, row.yearlyTarget), fontWeight: 700 }}>
                            {money(row.yearlyAchieved)}
                          </span>
                        </td>
                        <td style={bodyCellStyle}>
                          <span style={{ color: metricColor(row.yearlyAchieved, row.yearlyTarget), fontWeight: 700 }}>
                            {percent(row.yearlyAchievementPercent)}
                          </span>
                        </td>
                        <td style={bodyCellStyle}>{number(row.leadsAssigned)}</td>
                        <td style={bodyCellStyle}>{number(row.leadsConverted)}</td>
                        <td style={bodyCellStyle}>{money(row.revenueGenerated)}</td>
                        <td style={bodyCellStyle}>
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

          <div style={chartGridStyle}>
            <AppCard title="Target vs Achievement" style={{ width: '100%', minWidth: 0 }}>
              {rows.length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={rows} margin={{ top: 8, right: 8, left: isMobile ? -8 : 0, bottom: isMobile ? 12 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="employeeName" {...chartAxisProps} />
                    <YAxis width={isMobile ? 32 : 40} tick={{ fontSize: isMobile ? 10 : 12 }} />
                    <Tooltip />
                      <Bar dataKey="monthlyTarget" fill={targetColor} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="monthlyAchieved" radius={[8, 8, 0, 0]}>
                        {rows.map((entry) => (
                          <Cell
                            key={entry.employeeId}
                            fill={isTargetMet(entry.monthlyAchieved, entry.monthlyTarget) ? successColor : dangerColor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No comparison data" message="Team target vs achievement chart will appear here." />}
            </AppCard>

            <AppCard title="Achievement %" style={{ width: '100%', minWidth: 0 }}>
              {rows.length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={rows} margin={{ top: 8, right: 8, left: isMobile ? -8 : 0, bottom: isMobile ? 12 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="employeeName" {...chartAxisProps} />
                    <YAxis width={isMobile ? 32 : 40} tick={{ fontSize: isMobile ? 10 : 12 }} />
                    <Tooltip />
                      <Bar dataKey="yearlyAchievementPercent" radius={[8, 8, 0, 0]}>
                        {rows.map((entry) => (
                          <Cell
                            key={entry.employeeId}
                            fill={Number(entry.yearlyAchievementPercent || 0) >= 100 ? successColor : dangerColor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No achievement data" message="Achievement percentage chart will appear here." />}
            </AppCard>
          </div>
        </>
      )}
    </div>
  );
}
