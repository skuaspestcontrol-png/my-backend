import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import StatusBadge from '../../components/ui/StatusBadge';
import { apiGet, currentMonth, currentYear, monthOptions, money, number, percent, safeRows } from './salesPerformanceApi';

const chartWrap = { width: '100%', height: 300 };

export default function SalesTeamPerformance() {
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
      setError(err?.response?.data?.error || err?.message || 'Unable to load team performance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const employeeOptions = useMemo(() => safeRows(employees), [employees]);

  const statusBadge = (status) => {
    const tone = status === 'Excellent' ? 'active' : status === 'Good' ? 'pending' : 'danger';
    return <StatusBadge status={tone}>{status}</StatusBadge>;
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Team Performance"
        subtitle="Compare sales team members by monthly and yearly achievement."
        action={<AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>}
      />

      <AppCard title="Filters">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
          <AppInput label="Team View" value="Monthly + Yearly comparison" readOnly />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <AppButton onClick={() => load(filters)}>Apply Filters</AppButton>
        </div>
      </AppCard>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><LoadingSpinner size={26} /></div>
      ) : error ? (
        <AppCard><EmptyState title="Team performance error" message={error} /></AppCard>
      ) : (
        <>
          <AppCard title="Team Performance Table">
            {rows.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Sales Person</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Monthly Target</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Monthly Achieved</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Monthly %</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Yearly Target</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Yearly Achieved</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Yearly %</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Leads Assigned</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Leads Converted</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Revenue Generated</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId}>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{row.employeeName}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.monthlyTarget)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.monthlyAchieved)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{percent(row.monthlyAchievementPercent)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.yearlyTarget)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.yearlyAchieved)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{percent(row.yearlyAchievementPercent)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{number(row.leadsAssigned)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{number(row.leadsConverted)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.revenueGenerated)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{statusBadge(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No team data" message="Add targets and source records to compare the team." />}
          </AppCard>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <AppCard title="Target vs Achievement">
              {rows.length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="employeeName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="monthlyTarget" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="monthlyAchieved" fill="#0F766E" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No comparison data" message="Team target vs achievement chart will appear here." />}
            </AppCard>

            <AppCard title="Achievement %">
              {rows.length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="employeeName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="yearlyAchievementPercent" fill="#2563EB" radius={[8, 8, 0, 0]} />
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
