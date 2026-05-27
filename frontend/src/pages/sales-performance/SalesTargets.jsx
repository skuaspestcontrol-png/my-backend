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
import useColumnResize from '../../components/table/useColumnResize';
import { apiDelete, apiGet, apiPost, apiPut, currentMonth, currentYear, monthOptions, money, number, percent, safeRows, subscribeSalesPerformanceRefresh, triggerSalesPerformanceRefresh } from './salesPerformanceApi';
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

const tableStyle = { width: '100%', minWidth: 1660, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' };
const cellStyle = {
  padding: '10px 12px',
  fontSize: 13,
  lineHeight: 1.3,
  verticalAlign: 'middle',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};
const headerStyle = {
  padding: '12px 12px',
  fontSize: 13,
  lineHeight: 1.2,
  letterSpacing: '0.02em',
  color: '#6B7280',
  verticalAlign: 'middle',
  whiteSpace: 'normal',
  overflow: 'visible',
  textOverflow: 'unset',
  wordBreak: 'normal',
  overflowWrap: 'anywhere'
};
const nameCellStyle = { ...cellStyle, fontWeight: 700, color: '#111827' };
const headerLabelStyle = {
  display: 'block',
  width: '100%',
  lineHeight: 1.15,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  textAlign: 'center'
};
const actionButtonStyle = {
  minWidth: 38,
  width: 38,
  height: 38,
  padding: 0,
  gap: 0,
  borderRadius: 12,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)'
};
const firstHeaderLabelStyle = { ...headerLabelStyle, textAlign: 'left' };
const successColor = '#16A34A';
const dangerColor = '#DC2626';
const neutralTextColor = '#111827';
const formatTargetActivityTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const yearlyColumns = [
  { key: 'salesPerson', label: 'Sales Person' },
  { key: 'year', label: 'Year' },
  { key: 'monthlyRevenue', label: 'Monthly Revenue' },
  { key: 'monthlyCollection', label: 'Monthly Collection' },
  { key: 'yearlyRevenue', label: 'Yearly Revenue' },
  { key: 'yearlyCollection', label: 'Yearly Collection' },
  { key: 'monthlyRows', label: 'Monthly Rows' },
  { key: 'yearlyRows', label: 'Yearly Rows' }
];
const yearlyWidths = {
  salesPerson: 220,
  year: 90,
  monthlyRevenue: 160,
  monthlyCollection: 170,
  yearlyRevenue: 160,
  yearlyCollection: 170,
  monthlyRows: 110,
  yearlyRows: 110
};
const yearlyBounds = {
  salesPerson: { min: 180, max: 280 },
  year: { min: 80, max: 120 },
  monthlyRevenue: { min: 140, max: 220 },
  monthlyCollection: { min: 150, max: 230 },
  yearlyRevenue: { min: 140, max: 220 },
  yearlyCollection: { min: 150, max: 230 },
  monthlyRows: { min: 90, max: 140 },
  yearlyRows: { min: 90, max: 140 }
};

const targetColumns = [
  { key: 'salesPerson', label: 'Sales Person' },
  { key: 'type', label: 'Type' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'revenueTarget', label: 'Revenue Target' },
  { key: 'revenueAchieved', label: 'Revenue Achieved' },
  { key: 'revenuePending', label: 'Revenue Pending' },
  { key: 'revenuePercent', label: 'Revenue %' },
  { key: 'collectionTarget', label: 'Collection Target' },
  { key: 'collectionAchieved', label: 'Collection Achieved' },
  { key: 'collectionPending', label: 'Collection Pending' },
  { key: 'collectionPercent', label: 'Collection %' },
  { key: 'action', label: 'Actions' }
];
const targetWidths = {
  salesPerson: 190,
  type: 110,
  month: 110,
  year: 90,
  revenueTarget: 145,
  revenueAchieved: 145,
  revenuePending: 145,
  revenuePercent: 100,
  collectionTarget: 145,
  collectionAchieved: 145,
  collectionPending: 145,
  collectionPercent: 100,
  action: 96
};
const targetBounds = {
  salesPerson: { min: 170, max: 260 },
  type: { min: 90, max: 140 },
  month: { min: 90, max: 140 },
  year: { min: 80, max: 120 },
  revenueTarget: { min: 120, max: 200 },
  revenueAchieved: { min: 120, max: 200 },
  revenuePending: { min: 120, max: 200 },
  revenuePercent: { min: 80, max: 130 },
  collectionTarget: { min: 120, max: 200 },
  collectionAchieved: { min: 120, max: 200 },
  collectionPending: { min: 120, max: 200 },
  collectionPercent: { min: 80, max: 130 },
  action: { min: 90, max: 130 }
};

export default function SalesTargets() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [targets, setTargets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ year: '', month: '', salesPersonId: '' });
  const [form, setForm] = useState(initialForm);
  const {
    getColumnWidth: getYearlyWidth,
    startResize: startYearlyResize,
    resetColumns: resetYearlyColumns
  } = useColumnResize({
    storageKey: 'sales_targets_yearly_table_widths',
    columns: yearlyColumns,
    defaultColumnWidths: yearlyWidths,
    columnBounds: yearlyBounds,
    minWidth: 80,
    enabled: true
  });
  const {
    getColumnWidth: getTargetWidth,
    startResize: startTargetResize,
    resetColumns: resetTargetColumns
  } = useColumnResize({
    storageKey: 'sales_targets_target_table_widths',
    columns: targetColumns,
    defaultColumnWidths: targetWidths,
    columnBounds: targetBounds,
    minWidth: 80,
    enabled: true
  });
  const yearlyMinWidth = yearlyColumns.reduce((sum, column) => sum + (getYearlyWidth(column.key) || yearlyWidths[column.key] || 80), 0);
  const targetMinWidth = targetColumns.reduce((sum, column) => sum + (getTargetWidth(column.key) || targetWidths[column.key] || 80), 0);
  const yearlyTableStyle = { ...tableStyle, minWidth: Math.max(1660, yearlyMinWidth), tableLayout: 'fixed' };
  const targetTableStyle = { ...tableStyle, minWidth: Math.max(1660, targetMinWidth), tableLayout: 'fixed' };
  const yearlyHead = (key, align = 'left') => ({ ...headerStyle, position: 'relative', width: `${getYearlyWidth(key)}px`, minWidth: `${getYearlyWidth(key)}px`, maxWidth: `${getYearlyWidth(key)}px`, textAlign: align });
  const yearlyBody = (key, align = 'left') => ({ ...nameCellStyle, width: `${getYearlyWidth(key)}px`, minWidth: `${getYearlyWidth(key)}px`, maxWidth: `${getYearlyWidth(key)}px`, textAlign: align });
  const targetHead = (key, align = 'left') => ({ ...headerStyle, position: 'relative', width: `${getTargetWidth(key)}px`, minWidth: `${getTargetWidth(key)}px`, maxWidth: `${getTargetWidth(key)}px`, textAlign: align });
  const targetBody = (key, align = 'left') => ({ ...cellStyle, width: `${getTargetWidth(key)}px`, minWidth: `${getTargetWidth(key)}px`, maxWidth: `${getTargetWidth(key)}px`, textAlign: align });

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/sales-performance/targets', nextFilters);
      setTargets(safeRows(res.rows));
      setEmployees(safeRows(res.employees));
      setRecentActivity(safeRows(res.recentActivity));
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
  const employeeNameMap = useMemo(() => {
    const map = new Map();
    employeeOptions.forEach((person) => {
      const keys = [person.id, person.dbId, person.employeeCode, person.name]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);
      keys.forEach((key) => {
        if (!map.has(key.toLowerCase())) map.set(key.toLowerCase(), person.name);
      });
    });
    return map;
  }, [employeeOptions]);
  const displaySalesPersonName = (row) => (
    row.salesPersonName
    || row.employeeName
    || row.sales_person_name
    || row.employee_name
    || employeeNameMap.get(String(row.salesPersonId || row.sales_person_id || row.employeeId || row.employee_id || row.salesPersonCode || row.employeeCode || '').trim().toLowerCase())
    || row.salesPersonId
    || row.sales_person_id
    || '---'
  );
  const yearlySummaryRows = useMemo(() => {
    const map = new Map();
    safeRows(targets).forEach((row) => {
      const salesPersonKey = String(
        row.salesPersonId
        || row.sales_person_id
        || row.employeeId
        || row.employee_id
        || row.salesPersonCode
        || row.employeeCode
        || row.salesPersonName
        || row.employeeName
        || ''
      ).trim();
      const year = Number(row.targetYear || 0);
      if (!salesPersonKey || !year) return;
      const key = `${salesPersonKey.toLowerCase()}::${year}`;
      if (!map.has(key)) {
        map.set(key, {
          salesPersonName: displaySalesPersonName(row),
          year,
          monthlyRevenueTarget: 0,
          monthlyCollectionTarget: 0,
          yearlyRevenueTarget: 0,
          yearlyCollectionTarget: 0,
          monthlyCount: 0,
          yearlyCount: 0
        });
      }
      const entry = map.get(key);
      const targetType = String(row.targetType || 'monthly').toLowerCase();
      const revenueTarget = Number(row.revenueTarget || 0);
      const collectionTarget = Number(row.collectionTarget || 0);
      if (targetType === 'yearly') {
        entry.yearlyRevenueTarget += revenueTarget;
        entry.yearlyCollectionTarget += collectionTarget;
        entry.yearlyCount += 1;
      } else {
        entry.monthlyRevenueTarget += revenueTarget;
        entry.monthlyCollectionTarget += collectionTarget;
        entry.monthlyCount += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year || a.salesPersonName.localeCompare(b.salesPersonName));
  }, [targets]);
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
      triggerSalesPerformanceRefresh();
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
      triggerSalesPerformanceRefresh();
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
          <AppSelect label="Year" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">All Years</option>
            {Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </AppSelect>
          <AppSelect label="Month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">All Months</option>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
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

      <AppCard title="Yearly Target Rollup" style={{ width: '100%', minWidth: 0 }}>
        {yearlySummaryRows.length ? (
          <div className="crm-scroll-table" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table-clean sales-targets-table sales-performance-table" style={yearlyTableStyle}>
              <colgroup>
                {yearlyColumns.map((column) => <col key={column.key} style={{ width: `${getYearlyWidth(column.key)}px` }} />)}
              </colgroup>
              <thead>
                <tr>
                  {yearlyColumns.map((column) => (
                    <th
                      key={column.key}
                      className={`table-header-cell ${column.key === 'salesPerson' ? 'table-text-cell table-sticky-first sticky-sales-person' : 'table-number-cell'}`}
                      style={yearlyHead(column.key, column.key === 'salesPerson' ? 'left' : 'center')}
                    >
                      <span style={column.key === 'salesPerson' ? firstHeaderLabelStyle : headerLabelStyle}>{column.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlySummaryRows.map((row) => (
                  <tr key={`${row.salesPersonName}-${row.year}`} style={{ height: 48 }}>
                    <td className="table-name-cell table-sticky-first sticky-sales-person" style={{ ...yearlyBody('salesPerson'), background: '#fff' }}>{row.salesPersonName}</td>
                    <td className="table-number-cell" style={yearlyBody('year', 'center')}>{row.year}</td>
                    <td className="table-number-cell" style={yearlyBody('monthlyRevenue', 'center')}>{money(row.monthlyRevenueTarget)}</td>
                    <td className="table-number-cell" style={yearlyBody('monthlyCollection', 'center')}>{money(row.monthlyCollectionTarget)}</td>
                    <td className="table-number-cell" style={yearlyBody('yearlyRevenue', 'center')}>{money(row.yearlyRevenueTarget)}</td>
                    <td className="table-number-cell" style={yearlyBody('yearlyCollection', 'center')}>{money(row.yearlyCollectionTarget)}</td>
                    <td className="table-number-cell" style={yearlyBody('monthlyRows', 'center')}>{row.monthlyCount}</td>
                    <td className="table-number-cell" style={yearlyBody('yearlyRows', 'center')}>{row.yearlyCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No yearly rollup yet" message="Create monthly targets for a sales person to see the annual total here." />
        )}
      </AppCard>

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

      <AppCard title="Recent Target Activity" style={{ width: '100%', minWidth: 0 }}>
        {recentActivity.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentActivity.map((entry) => (
              <div
                key={`${entry.id || entry.targetId || entry.createdAt}-${entry.action}`}
                style={{
                  border: '1px solid rgba(159, 23, 77, 0.16)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  background: '#fff',
                  display: 'grid',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ color: '#111827' }}>{entry.targetLabel || 'Target'}</strong>
                  <StatusBadge status={entry.action === 'deleted' ? 'danger' : entry.action === 'updated' ? 'info' : 'success'}>
                    {entry.action}
                  </StatusBadge>
                </div>
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                  {entry.salesPersonName || '---'} • {money(entry.revenueTarget || 0)} revenue • {money(entry.collectionTarget || 0)} collection
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                  {entry.actor || 'System'} • {formatTargetActivityTime(entry.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No target activity yet" message="Save or update a target to see the recent audit trail here." />
        )}
      </AppCard>

      <AppCard title="Target List" style={{ width: '100%', minWidth: 0 }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : safeRows(targets).length ? (
          <div className="crm-scroll-table" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table-clean sales-targets-table sales-performance-table" style={targetTableStyle}>
              <colgroup>
                {targetColumns.map((column) => <col key={column.key} style={{ width: `${getTargetWidth(column.key)}px` }} />)}
              </colgroup>
              <thead>
                <tr>
                  {targetColumns.map((column) => {
                    const className =
                      column.key === 'salesPerson'
                        ? 'table-header-cell table-text-cell table-sticky-first sticky-sales-person'
                        : column.key === 'type'
                          ? 'table-header-cell table-status-cell'
                          : column.key === 'revenuePercent' || column.key === 'collectionPercent'
                            ? 'table-header-cell table-percent-cell'
                            : column.key === 'action'
                              ? 'table-header-cell table-actions-cell'
                              : 'table-header-cell table-number-cell';
                    const align = column.key === 'salesPerson' ? 'left' : column.key === 'action' ? 'center' : 'center';
                    return (
                      <th key={column.key} className={className} style={targetHead(column.key, align)}>
                        <span style={column.key === 'salesPerson' ? firstHeaderLabelStyle : headerLabelStyle}>{column.label}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {targets.map((row) => (
                  <tr key={row.id} style={{ height: 48 }}>
                    <td className="table-name-cell table-sticky-first sticky-sales-person" style={{ ...targetBody('salesPerson'), background: '#fff' }}>{displaySalesPersonName(row)}</td>
                    <td className="table-status-cell" style={targetBody('type', 'center')}>
                      <StatusBadge status={row.targetType === 'yearly' ? 'info' : 'active'}>
                        {row.targetType === 'yearly' ? 'Yearly' : 'Monthly'}
                      </StatusBadge>
                    </td>
                    <td className="table-number-cell" style={targetBody('month', 'center')}>{row.targetType === 'monthly' ? monthOptions.find((month) => month.value === Number(row.targetMonth))?.label || '---' : '---'}</td>
                    <td className="table-number-cell" style={targetBody('year', 'center')}>{row.targetYear}</td>
                    <td className="table-number-cell" style={targetBody('revenueTarget', 'center')}>{money(row.revenueTarget)}</td>
                    <td className="table-number-cell" style={targetBody('revenueAchieved', 'center')}>
                      <span style={{ color: metricColor(row.achievedRevenue, row.revenueTarget), fontWeight: 700 }}>
                        {money(row.achievedRevenue)}
                      </span>
                    </td>
                    <td className="table-number-cell" style={targetBody('revenuePending', 'center')}>
                      <span style={{ color: metricColor(row.achievedRevenue, row.revenueTarget), fontWeight: 700 }}>
                        {money(row.pendingRevenue)}
                      </span>
                    </td>
                    <td className="table-percent-cell" style={targetBody('revenuePercent', 'center')}>
                      <span style={{ color: metricColor(row.achievedRevenue, row.revenueTarget), fontWeight: 700 }}>
                        {percent(row.achievementPercent)}
                      </span>
                    </td>
                    <td className="table-number-cell" style={targetBody('collectionTarget', 'center')}>{money(row.collectionTarget)}</td>
                    <td className="table-number-cell" style={targetBody('collectionAchieved', 'center')}>
                      <span style={{ color: metricColor(row.achievedCollection, row.collectionTarget), fontWeight: 700 }}>
                        {money(row.achievedCollection)}
                      </span>
                    </td>
                    <td className="table-number-cell" style={targetBody('collectionPending', 'center')}>
                      <span style={{ color: metricColor(row.achievedCollection, row.collectionTarget), fontWeight: 700 }}>
                        {money(row.pendingCollection)}
                      </span>
                    </td>
                    <td className="table-percent-cell" style={targetBody('collectionPercent', 'center')}>
                      <span style={{ color: metricColor(row.achievedCollection, row.collectionTarget), fontWeight: 700 }}>
                        {percent(row.collectionAchievementPercent)}
                      </span>
                    </td>
                    <td className="table-actions-cell" style={targetBody('action', 'center')}>
                      <div className="sales-targets-action-wrap">
                        <AppButton
                          variant="outline"
                          size="sm"
                          iconLeft={<Edit3 size={14} />}
                          onClick={() => editRow(row)}
                          aria-label="Edit target"
                          title="Edit target"
                          className="sales-targets-action-btn"
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
                          className="sales-targets-action-btn"
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
