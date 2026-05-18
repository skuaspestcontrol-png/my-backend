import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
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
import { apiGet, currentMonth, currentYear, downloadCsv, monthOptions, money, percent, safeRows } from './salesPerformanceApi';

const chartWrap = { width: '100%', height: 300 };

const reportTypeOptions = [
  { value: 'monthly', label: 'Monthly target vs achievement' },
  { value: 'yearly', label: 'Yearly target vs achievement' },
  { value: 'team', label: 'Team overall performance' },
  { value: 'sales', label: 'Sales person wise performance' }
];

export default function SalesPerformanceReports() {
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
      setError(err?.response?.data?.error || err?.message || 'Unable to load sales reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const employeeOptions = useMemo(() => safeRows(employees), [employees]);
  const chartData = useMemo(() => rows.map((row) => ({
    employeeName: row.employeeName,
    monthlyTarget: Number(row.monthlyTarget || 0),
    monthlyAchieved: Number(row.monthlyAchieved || 0),
    yearlyTarget: Number(row.yearlyTarget || 0),
    yearlyAchieved: Number(row.yearlyAchieved || 0),
    monthlyAchievementPercent: Number(row.monthlyAchievementPercent || 0),
    yearlyAchievementPercent: Number(row.yearlyAchievementPercent || 0)
  })), [rows]);

  const summaryCards = [
    { title: 'Rows', value: summary?.rows || 0 },
    { title: 'Monthly Target', value: money(summary?.totalMonthlyTarget || 0) },
    { title: 'Monthly Achieved', value: money(summary?.totalMonthlyAchieved || 0) },
    { title: 'Yearly Target', value: money(summary?.totalYearlyTarget || 0) },
    { title: 'Yearly Achieved', value: money(summary?.totalYearlyAchieved || 0) }
  ];

  const exportCsv = () => {
    downloadCsv(rows.map((row) => ({
      SalesPerson: row.employeeName,
      Month: row.month,
      Year: row.year,
      MonthlyTarget: row.monthlyTarget,
      MonthlyAchieved: row.monthlyAchieved,
      MonthlyPending: row.monthlyPending,
      MonthlyAchievementPercent: row.monthlyAchievementPercent,
      YearlyTarget: row.yearlyTarget,
      YearlyAchieved: row.yearlyAchieved,
      YearlyPending: row.yearlyPending,
      YearlyAchievementPercent: row.yearlyAchievementPercent,
      LeadsAssigned: row.leadsAssigned,
      LeadsConverted: row.leadsConverted,
      RevenueGenerated: row.revenueGenerated,
      Status: row.status
    })), 'sales-performance-reports.csv');
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Reports"
        subtitle="Review target vs achievement reports and export the current result set as CSV."
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>
            <AppButton variant="outline" iconLeft={<Download size={16} />} onClick={exportCsv} disabled={!rows.length}>CSV Export</AppButton>
          </div>
        )}
      />

      <AppCard title="Filters">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <AppSelect label="Report Type" value={filters.reportType} onChange={(e) => setFilters({ ...filters, reportType: e.target.value })}>
            {reportTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Start Date" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          <AppInput label="End Date" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <AppButton onClick={() => load(filters)}>Apply Filters</AppButton>
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
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {summaryCards.map((card) => (
              <AppCard key={card.title} title={card.title}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>{card.value}</div>
              </AppCard>
            ))}
          </div>

          <AppCard title="Monthly Target vs Achievement">
            {chartData.length ? (
              <div style={chartWrap}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="employeeName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="monthlyTarget" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="monthlyAchieved" fill="#0F766E" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No report data" message="Choose filters and load sales rows to see the report." />
            )}
          </AppCard>

          <AppCard title="Yearly Target vs Achievement">
            {chartData.length ? (
              <div style={chartWrap}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="employeeName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="yearlyTarget" fill="#94A3B8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="yearlyAchieved" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No yearly report data" message="Yearly totals will appear here when data is available." />
            )}
          </AppCard>

          <AppCard title="Report Table">
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
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Leads</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Converted</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Revenue</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.employeeId}-${row.year}-${row.month}`}>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{row.employeeName}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.monthlyTarget)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.monthlyAchieved)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{percent(row.monthlyAchievementPercent)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.yearlyTarget)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.yearlyAchieved)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{percent(row.yearlyAchievementPercent)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{row.leadsAssigned}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{row.leadsConverted}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{money(row.revenueGenerated)}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>{row.status}</td>
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
