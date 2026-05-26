import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCcw, RotateCcw, Send } from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import AppTextarea from '../../components/ui/AppTextarea';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import useColumnResize from '../../components/table/useColumnResize';
import { apiGet, apiPost, number, safeRows } from './stockApi';

const today = new Date().toISOString().slice(0, 10);

const tabStyle = (active) => ({
  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
  background: active ? 'var(--color-primary)' : '#fff',
  color: active ? '#fff' : '#111827',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer'
});

const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 13, verticalAlign: 'top' };
const headerCellStyle = { ...cellStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' };

const balanceColumns = [
  { key: 'technician', label: 'Technician' },
  { key: 'item', label: 'Item' },
  { key: 'balance', label: 'Balance' }
];
const balanceWidths = {
  technician: 200,
  item: 180,
  balance: 120
};
const balanceBounds = {
  technician: { min: 160, max: 280 },
  item: { min: 150, max: 240 },
  balance: { min: 100, max: 150 }
};

const issueInitial = {
  technicianId: '',
  date: today,
  itemId: '',
  quantity: '',
  customerId: '',
  contractId: '',
  jobId: '',
  notes: ''
};

const usageInitial = {
  technicianId: '',
  date: today,
  itemId: '',
  quantity: '',
  customerId: '',
  contractId: '',
  jobId: '',
  serviceType: '',
  notes: ''
};

const movementInitial = {
  technicianId: '',
  date: today,
  sourceLocation: 'technician',
  type: 'return',
  adjustmentMode: 'decrease',
  itemId: '',
  quantity: '',
  reason: '',
  notes: ''
};

const employeeLabel = (row) =>
  String(
    row.full_name
    || row.name
    || [row.firstName, row.lastName].filter(Boolean).join(' ')
    || [row.first_name, row.last_name].filter(Boolean).join(' ')
    || row.empCode
    || `Employee ${row.id || row._id || ''}`
  ).trim();

const customerLabel = (row) =>
  String(row.name || row.displayName || row.customerName || row.companyName || `Customer ${row.id || row._id || ''}`).trim();

export default function StockIssueUsage() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [activeTab, setActiveTab] = useState('issue');
  const [items, setItems] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [issueForm, setIssueForm] = useState(issueInitial);
  const [usageForm, setUsageForm] = useState(usageInitial);
  const [movementForm, setMovementForm] = useState(movementInitial);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsRes, balanceRes, customersRes, employeesRes] = await Promise.all([
        apiGet('/api/stock/items'),
        apiGet('/api/stock/technician-balances'),
        apiGet('/api/customers').catch(() => []),
        apiGet('/api/employees').catch(() => [])
      ]);
      setItems(safeRows(itemsRes.items));
      setBalances(safeRows(balanceRes.balances));
      setCustomers(safeRows(customersRes));
      const employeeRows = safeRows(employeesRes);
      const techRows = employeeRows.filter((row) => {
        const role = String(row.role || row.role_name || row.department || '').toLowerCase();
        const status = String(row.status || 'active').toLowerCase();
        return status === 'active' && (role.includes('technician') || role.includes('field') || role.includes('service') || role.includes('ops'));
      });
      setTechnicians((techRows.length ? techRows : employeeRows.filter((row) => String(row.status || 'active').toLowerCase() === 'active')).map((row) => ({
        ...row,
        displayName: employeeLabel(row)
      })));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load issue and usage data.');
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

  const itemOptions = useMemo(() => safeRows(items), [items]);
  const techOptions = useMemo(() => safeRows(technicians), [technicians]);
  const customerOptions = useMemo(() => safeRows(customers), [customers]);
  const formGridStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 12, gridTemplateColumns: '1fr' }
    : viewportWidth <= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
  const submitRowStyle = viewportWidth <= 480 ? { display: 'grid', gap: 8, width: '100%' } : { display: 'flex', justifyContent: 'flex-end' };
  const submitButtonStyle = viewportWidth <= 480 ? { width: '100%', justifyContent: 'center' } : undefined;
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'stock_issue_usage_balance_widths',
    columns: balanceColumns.map((column) => column.key),
    defaultColumnWidths: balanceWidths,
    columnBounds: balanceBounds,
    minWidth: 90,
    enabled: true
  });
  const balanceTableMinWidth = balanceColumns.reduce((sum, column) => sum + (getColumnWidth(column.key) || balanceWidths[column.key] || 90), 0);
  const balanceTableStyle = { ...tableStyle, minWidth: `${Math.max(500, balanceTableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => ({
    ...headerCellStyle,
    position: 'relative',
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const bodyStyle = (key, align = 'left') => ({
    ...cellStyle,
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });

  const submitIssue = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/stock/issue', {
        ...issueForm,
        technicianId: issueForm.technicianId || null,
        itemId: issueForm.itemId || null,
        quantity: Number(issueForm.quantity || 0),
        customerId: issueForm.customerId || null,
        contractId: issueForm.contractId || null,
        jobId: issueForm.jobId || null
      });
      setIssueForm(issueInitial);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to issue stock.');
    } finally {
      setSaving(false);
    }
  };

  const submitUsage = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/stock/usage', {
        ...usageForm,
        technicianId: usageForm.technicianId || null,
        itemId: usageForm.itemId || null,
        quantity: Number(usageForm.quantity || 0),
        customerId: usageForm.customerId || null,
        contractId: usageForm.contractId || null,
        jobId: usageForm.jobId || null
      });
      setUsageForm(usageInitial);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to save usage.');
    } finally {
      setSaving(false);
    }
  };

  const submitMovement = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/stock/return-wastage', {
        ...movementForm,
        technicianId: movementForm.technicianId || null,
        itemId: movementForm.itemId || null,
        quantity: Number(movementForm.quantity || 0)
      });
      setMovementForm(movementInitial);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to save movement.');
    } finally {
      setSaving(false);
    }
  };

  const renderIssue = () => (
    <form onSubmit={submitIssue} style={{ display: 'grid', gap: 12 }}>
      <div style={formGridStyle}>
        <AppSelect label="Technician" value={issueForm.technicianId} onChange={(e) => setIssueForm({ ...issueForm, technicianId: e.target.value })} required>
          <option value="">Select technician</option>
          {techOptions.map((tech) => <option key={tech.id} value={tech.id}>{tech.displayName || employeeLabel(tech)}</option>)}
        </AppSelect>
        <AppInput type="date" label="Date" value={issueForm.date} onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })} required />
        <AppSelect label="Item" value={issueForm.itemId} onChange={(e) => setIssueForm({ ...issueForm, itemId: e.target.value })} required>
          <option value="">Select item</option>
          {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
        </AppSelect>
        <AppInput type="number" step="0.001" min="0.001" label="Quantity" value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} required />
        <AppSelect label="Customer" value={issueForm.customerId} onChange={(e) => setIssueForm({ ...issueForm, customerId: e.target.value })}>
          <option value="">Optional</option>
          {customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>)}
        </AppSelect>
        <AppInput label="Job / Contract Ref" value={issueForm.jobId} onChange={(e) => setIssueForm({ ...issueForm, jobId: e.target.value })} />
      </div>
      <AppTextarea label="Notes" value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} />
      <div style={submitRowStyle}>
        <AppButton type="submit" loading={saving} iconLeft={<Send size={16} />} style={submitButtonStyle}>Issue Stock</AppButton>
      </div>
    </form>
  );

  const renderUsage = () => (
    <form onSubmit={submitUsage} style={{ display: 'grid', gap: 12 }}>
      <div style={formGridStyle}>
        <AppSelect label="Technician" value={usageForm.technicianId} onChange={(e) => setUsageForm({ ...usageForm, technicianId: e.target.value })} required>
          <option value="">Select technician</option>
          {techOptions.map((tech) => <option key={tech.id} value={tech.id}>{tech.displayName || employeeLabel(tech)}</option>)}
        </AppSelect>
        <AppInput type="date" label="Date" value={usageForm.date} onChange={(e) => setUsageForm({ ...usageForm, date: e.target.value })} required />
        <AppSelect label="Item" value={usageForm.itemId} onChange={(e) => setUsageForm({ ...usageForm, itemId: e.target.value })} required>
          <option value="">Select item</option>
          {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
        </AppSelect>
        <AppInput type="number" step="0.001" min="0.001" label="Quantity Used" value={usageForm.quantity} onChange={(e) => setUsageForm({ ...usageForm, quantity: e.target.value })} required />
        <AppSelect label="Customer" value={usageForm.customerId} onChange={(e) => setUsageForm({ ...usageForm, customerId: e.target.value })}>
          <option value="">Optional</option>
          {customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>)}
        </AppSelect>
        <AppInput label="Service Type" value={usageForm.serviceType} onChange={(e) => setUsageForm({ ...usageForm, serviceType: e.target.value })} />
        <AppInput label="Job / Contract Ref" value={usageForm.jobId} onChange={(e) => setUsageForm({ ...usageForm, jobId: e.target.value })} />
      </div>
      <AppTextarea label="Notes" value={usageForm.notes} onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })} />
      <div style={submitRowStyle}>
        <AppButton type="submit" loading={saving} iconLeft={<CheckCircle2 size={16} />} style={submitButtonStyle}>Save Usage</AppButton>
      </div>
    </form>
  );

  const renderMovement = () => (
    <form onSubmit={submitMovement} style={{ display: 'grid', gap: 12 }}>
      <div style={formGridStyle}>
        <AppSelect label="Technician" value={movementForm.technicianId} onChange={(e) => setMovementForm({ ...movementForm, technicianId: e.target.value })}>
          <option value="">Optional</option>
          {techOptions.map((tech) => <option key={tech.id} value={tech.id}>{tech.displayName || employeeLabel(tech)}</option>)}
        </AppSelect>
        <AppInput type="date" label="Date" value={movementForm.date} onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} required />
        <AppSelect label="Source" value={movementForm.sourceLocation} onChange={(e) => setMovementForm({ ...movementForm, sourceLocation: e.target.value })}>
          <option value="technician">Technician</option>
          <option value="office">Office</option>
        </AppSelect>
        <AppSelect label="Type" value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}>
          <option value="return">Return</option>
          <option value="wastage">Wastage</option>
          <option value="damage">Damage</option>
          <option value="expired">Expired</option>
          <option value="adjustment">Adjustment</option>
        </AppSelect>
        {movementForm.type === 'adjustment' ? (
          <AppSelect label="Adjustment Mode" value={movementForm.adjustmentMode} onChange={(e) => setMovementForm({ ...movementForm, adjustmentMode: e.target.value })}>
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </AppSelect>
        ) : null}
        <AppSelect label="Item" value={movementForm.itemId} onChange={(e) => setMovementForm({ ...movementForm, itemId: e.target.value })} required>
          <option value="">Select item</option>
          {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
        </AppSelect>
        <AppInput type="number" step="0.001" min="0.001" label="Quantity" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} required />
      </div>
      <AppInput label="Reason / Notes" value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} />
      <div style={submitRowStyle}>
        <AppButton type="submit" loading={saving} iconLeft={<RotateCcw size={16} />} style={submitButtonStyle}>Save Movement</AppButton>
      </div>
    </form>
  );

  return (
    <div className="crm-page crm-section" style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Issue & Usage"
        subtitle="Issue items to technicians, record site usage, and capture returns or wastage."
        action={viewportWidth > 768 ? <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={load} loading={loading}>Refresh</AppButton> : null}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setActiveTab('issue')} style={tabStyle(activeTab === 'issue')}>Issue to Technician</button>
        <button type="button" onClick={() => setActiveTab('usage')} style={tabStyle(activeTab === 'usage')}>Usage at Site</button>
        <button type="button" onClick={() => setActiveTab('movement')} style={tabStyle(activeTab === 'movement')}>Return / Wastage</button>
      </div>

      {error ? <AppCard><EmptyState title="Stock movement error" message={error} /></AppCard> : null}

      <AppCard title={activeTab === 'issue' ? 'Issue to Technician' : activeTab === 'usage' ? 'Usage at Site' : 'Return / Wastage'} className="crm-filter-card">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : activeTab === 'issue' ? renderIssue() : activeTab === 'usage' ? renderUsage() : renderMovement()}
      </AppCard>

      <AppCard title="Technician Stock Balances" className="crm-table-card">
        {balances.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={balanceTableStyle}>
              <colgroup>
                {balanceColumns.map((column) => (
                  <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={headStyle('technician')}>Technician</th>
                  <th style={headStyle('item')}>Item</th>
                  <th style={headStyle('balance', 'center')}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((row, index) => (
                  <tr key={`${row.technicianId}-${row.itemId}-${index}`}>
                    <td style={bodyStyle('technician')}>{row.technicianName}</td>
                    <td style={bodyStyle('item')}>{row.itemName}</td>
                    <td style={bodyStyle('balance', 'center')}>{number(row.currentBalance)} {row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No technician balances yet" message="Balances will appear after stock is issued or used." />
        )}
      </AppCard>
    </div>
  );
}
