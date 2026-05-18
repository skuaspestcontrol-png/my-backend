import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import AppTextarea from '../../components/ui/AppTextarea';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiDelete, apiGet, apiPost, apiPut, currentMonth, currentYear, monthOptions, money, number, percent, safeRows } from './salesPerformanceApi';

const initialForm = {
  id: '',
  salesPersonId: '',
  targetType: 'monthly',
  targetMonth: currentMonth,
  targetYear: currentYear,
  revenueTarget: '',
  collectionTarget: '',
  notes: ''
};

const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 13, verticalAlign: 'top' };
const headerStyle = { ...cellStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' };
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const neutralTextColor = '#111827';

export default function SalesTargets() {
  const [targets, setTargets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ year: currentYear, targetType: '', salesPersonId: '' });
  const [form, setForm] = useState(initialForm);

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/sales-performance/targets', nextFilters);
      setTargets(safeRows(res.rows));
      setEmployees(safeRows(res.employees));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load sales targets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const employeeOptions = useMemo(() => safeRows(employees), [employees]);

  const resetForm = () => setForm(initialForm);
  const metricColor = (actual, target) => {
    const targetValue = Number(target || 0);
    if (targetValue <= 0) return neutralTextColor;
    return Number(actual || 0) >= targetValue ? successColor : dangerColor;
  };

  const editRow = (row) => {
    setForm({
      id: row.id,
      salesPersonId: row.salesPersonId,
      targetType: row.targetType,
      targetMonth: row.targetMonth || currentMonth,
      targetYear: row.targetYear,
      revenueTarget: String(row.revenueTarget || 0),
      collectionTarget: String(row.collectionTarget || 0),
      notes: row.notes || ''
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        salesPersonId: form.salesPersonId,
        targetType: form.targetType,
        targetMonth: form.targetType === 'monthly' ? Number(form.targetMonth) : null,
        targetYear: Number(form.targetYear),
        revenueTarget: Number(form.revenueTarget || 0),
        collectionTarget: Number(form.collectionTarget || 0),
        notes: form.notes
      };
      if (form.id) await apiPut(`/api/sales-performance/targets/${form.id}`, payload);
      else await apiPost('/api/sales-performance/targets', payload);
      resetForm();
      await load(filters);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to save target.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this target?')) return;
    setSaving(true);
    setError('');
    try {
      await apiDelete(`/api/sales-performance/targets/${id}`);
      if (form.id === id) resetForm();
      await load(filters);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to delete target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Targets"
        subtitle="Set monthly and yearly sales targets and see achieved vs pending amounts."
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>
            <AppButton iconLeft={<Plus size={16} />} onClick={resetForm}>New Target</AppButton>
          </div>
        )}
      />

      <AppCard title="Filters">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <AppSelect label="Year" value={filters.year} onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}>
            {Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </AppSelect>
          <AppSelect label="Type" value={filters.targetType} onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}>
            <option value="">All</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </AppSelect>
          <AppSelect label="Sales Person" value={filters.salesPersonId} onChange={(e) => setFilters({ ...filters, salesPersonId: e.target.value })}>
            <option value="">All</option>
            {employeeOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </AppSelect>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <AppButton onClick={() => load(filters)}>Apply Filters</AppButton>
          </div>
        </div>
      </AppCard>

      {error ? <AppCard><EmptyState title="Sales target error" message={error} /></AppCard> : null}

      <AppCard title={form.id ? 'Edit Target' : 'Add Target'}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <AppSelect label="Sales Person" value={form.salesPersonId} onChange={(e) => setForm({ ...form, salesPersonId: e.target.value })} required>
              <option value="">Select person</option>
              {employeeOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </AppSelect>
            <AppSelect label="Target Type" value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value, targetMonth: e.target.value === 'monthly' ? form.targetMonth : '' })} required>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </AppSelect>
            {form.targetType === 'monthly' ? (
              <AppSelect label="Month" value={form.targetMonth} onChange={(e) => setForm({ ...form, targetMonth: Number(e.target.value) })} required>
                {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </AppSelect>
            ) : null}
            <AppInput type="number" min="0" step="0.01" label="Year" value={form.targetYear} onChange={(e) => setForm({ ...form, targetYear: e.target.value })} required />
            <AppInput type="number" min="0" step="0.01" label="Revenue Target" value={form.revenueTarget} onChange={(e) => setForm({ ...form, revenueTarget: e.target.value })} required />
            <AppInput type="number" min="0" step="0.01" label="Collection Target" value={form.collectionTarget} onChange={(e) => setForm({ ...form, collectionTarget: e.target.value })} required />
          </div>
          <AppTextarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            {form.id ? <AppButton variant="outline" type="button" onClick={resetForm}>Cancel Edit</AppButton> : null}
            <AppButton type="submit" loading={saving}>{form.id ? 'Update Target' : 'Save Target'}</AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard title="Target List">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : safeRows(targets).length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerStyle}>Sales Person</th>
                  <th style={headerStyle}>Type</th>
                  <th style={headerStyle}>Month</th>
                  <th style={headerStyle}>Year</th>
                  <th style={headerStyle}>Revenue Target</th>
                  <th style={headerStyle}>Revenue Achieved</th>
                  <th style={headerStyle}>Revenue Pending</th>
                  <th style={headerStyle}>Revenue %</th>
                  <th style={headerStyle}>Collection Target</th>
                  <th style={headerStyle}>Collection Achieved</th>
                  <th style={headerStyle}>Collection Pending</th>
                  <th style={headerStyle}>Collection %</th>
                  <th style={headerStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((row) => (
                  <tr key={row.id}>
                    <td style={cellStyle}>{row.salesPersonName}</td>
                    <td style={cellStyle}>
                      <StatusBadge status={row.targetType === 'yearly' ? 'info' : 'active'}>
                        {row.targetType}
                      </StatusBadge>
                    </td>
                    <td style={cellStyle}>{row.targetType === 'monthly' ? monthOptions.find((month) => month.value === Number(row.targetMonth))?.label || '---' : '---'}</td>
                    <td style={cellStyle}>{row.targetYear}</td>
                    <td style={cellStyle}>{money(row.revenueTarget)}</td>
                    <td style={cellStyle}>
                      <span style={{ color: metricColor(row.achievedRevenue, row.revenueTarget), fontWeight: 700 }}>
                        {money(row.achievedRevenue)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: metricColor(row.achievedRevenue, row.revenueTarget), fontWeight: 700 }}>
                        {money(row.pendingRevenue)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: metricColor(row.achievedRevenue, row.revenueTarget), fontWeight: 700 }}>
                        {percent(row.achievementPercent)}
                      </span>
                    </td>
                    <td style={cellStyle}>{money(row.collectionTarget)}</td>
                    <td style={cellStyle}>
                      <span style={{ color: metricColor(row.achievedCollection, row.collectionTarget), fontWeight: 700 }}>
                        {money(row.achievedCollection)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: metricColor(row.achievedCollection, row.collectionTarget), fontWeight: 700 }}>
                        {money(row.pendingCollection)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: metricColor(row.achievedCollection, row.collectionTarget), fontWeight: 700 }}>
                        {percent(row.collectionAchievementPercent)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <AppButton variant="outline" size="sm" iconLeft={<Edit3 size={14} />} onClick={() => editRow(row)}>Edit</AppButton>
                        <AppButton variant="danger" size="sm" iconLeft={<Trash2 size={14} />} onClick={() => handleDelete(row.id)} loading={saving}>Delete</AppButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No targets yet" message="Create monthly and yearly targets for your sales team." />
        )}
      </AppCard>
    </div>
  );
}
