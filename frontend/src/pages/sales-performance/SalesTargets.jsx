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
import './salesPerformance.css';

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

const tableStyle = { width: '100%', minWidth: 1240, borderCollapse: 'collapse', tableLayout: 'fixed' };
const cellStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 12,
  lineHeight: 1.1,
  verticalAlign: 'middle',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};
const headerStyle = { ...cellStyle, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' };
const nameCellStyle = { ...cellStyle, fontWeight: 700, color: '#111827' };
const actionButtonStyle = {
  minWidth: 34,
  width: 34,
  height: 34,
  padding: 0,
  gap: 0,
  borderRadius: 10
};
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const neutralTextColor = '#111827';

export default function SalesTargets() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
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

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const employeeOptions = useMemo(() => safeRows(employees), [employees]);
  const isMobile = viewportWidth <= 768;
  const pageGridStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    minWidth: 0,
    overflowX: 'hidden'
  };
  const filtersGridStyle = viewportWidth >= 1200
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: '100%', minWidth: 0 }
    : viewportWidth >= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', width: '100%', minWidth: 0 }
      : { display: 'grid', gap: 12, gridTemplateColumns: '1fr', width: '100%', minWidth: 0 };
  const formGridStyle = viewportWidth >= 1200
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: '100%', minWidth: 0 }
    : viewportWidth >= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', width: '100%', minWidth: 0 }
      : { display: 'grid', gap: 12, gridTemplateColumns: '1fr', width: '100%', minWidth: 0 };

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
    <div className="crm-page sales-performance-page sales-targets-page" style={pageGridStyle}>
      <PageHeader
        title="Targets"
        subtitle="Set monthly and yearly sales targets and see achieved vs pending amounts."
        titleStyle={isMobile ? { fontSize: 24, lineHeight: 1.1 } : undefined}
        subtitleStyle={isMobile ? { fontSize: 13, lineHeight: 1.3 } : undefined}
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => load(filters)} loading={loading}>Refresh</AppButton>
            <AppButton iconLeft={<Plus size={16} />} onClick={resetForm}>New Target</AppButton>
          </div>
        )}
      />

      <AppCard title="Filters" style={{ width: '100%', minWidth: 0 }}>
        <div style={filtersGridStyle}>
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
          <div style={{ display: 'flex', alignItems: 'end', minWidth: 0 }}>
            <AppButton onClick={() => load(filters)}>Apply Filters</AppButton>
          </div>
        </div>
      </AppCard>

      {error ? <AppCard><EmptyState title="Sales target error" message={error} /></AppCard> : null}

      <AppCard title={form.id ? 'Edit Target' : 'Add Target'} style={{ width: '100%', minWidth: 0 }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, width: '100%', minWidth: 0 }}>
          <div style={formGridStyle}>
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

      <AppCard title="Target List" style={{ width: '100%', minWidth: 0 }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : safeRows(targets).length ? (
          <div className="crm-scroll-table" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                  <tr key={row.id} style={{ height: 42 }}>
                    <td style={nameCellStyle}>{row.salesPersonName || '---'}</td>
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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                        <AppButton
                          variant="outline"
                          size="sm"
                          iconLeft={<Edit3 size={14} />}
                          onClick={() => editRow(row)}
                          aria-label="Edit target"
                          title="Edit target"
                          style={actionButtonStyle}
                        />
                        <AppButton
                          variant="danger"
                          size="sm"
                          iconLeft={<Trash2 size={14} />}
                          onClick={() => handleDelete(row.id)}
                          loading={saving}
                          aria-label="Delete target"
                          title="Delete target"
                          style={actionButtonStyle}
                        />
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
