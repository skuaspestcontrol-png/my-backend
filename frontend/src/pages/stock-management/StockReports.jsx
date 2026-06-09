import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, RefreshCcw } from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { apiGet, exportUrl, money, number, reportTypes, safeRows, stockCategories, movementTypes, stockCategoryDisplayLabel } from './stockApi';

const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0 };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 13, verticalAlign: 'top' };
const headerCellStyle = { ...cellStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' };
const greenColor = '#16A34A';
const redColor = '#DC2626';
const blackColor = '#111827';
const badgeStyle = (status) => {
  const value = String(status || '').toLowerCase();
  let bg = '#F3F4F6';
  let fg = blackColor;
  if (value === 'in stock' || value === 'excellent') {
    bg = '#DCFCE7';
    fg = greenColor;
  } else if (value === 'low stock' || value === 'out of stock' || value === 'expired' || value === 'expiring soon') {
    bg = '#FEE2E2';
    fg = redColor;
  }
  return { display: 'inline-flex', alignItems: 'center', minHeight: 24, borderRadius: 999, padding: '0 10px', fontSize: 12, fontWeight: 700, background: bg, color: fg };
};

const initialFilters = {
  reportType: 'current-stock',
  startDate: '',
  endDate: '',
  itemId: '',
  category: '',
  vendorId: '',
  technicianId: '',
  movementType: ''
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

const vendorLabel = (row) => String(row.name || row.vendor_name || row.company_name || row.displayName || `Vendor ${row.id || row._id || ''}`).trim();

const reportColumns = {
  'current-stock': ['Item', 'Category', 'Unit', 'Current Stock', 'Minimum', 'Value', 'Status'],
  'technician-stock': ['Technician', 'Item', 'Balance'],
  ledger: ['Date', 'Type', 'Item', 'In', 'Out', 'Office', 'Technician', 'Source', 'Notes'],
  purchase: ['Date', 'Item', 'Vendor', 'Qty', 'Rate', 'Total', 'Batch / Expiry'],
  usage: ['Date', 'Technician', 'Item', 'Qty', 'Customer', 'Service', 'Notes'],
  'low-stock': ['Item', 'Category', 'Current', 'Minimum', 'Status'],
  expiry: ['Item', 'Category', 'Expiry', 'Current', 'Status']
};

export default function StockReports() {
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFilters = async () => {
    try {
      const [itemsRes, vendorsRes, employeesRes] = await Promise.all([
        apiGet('/api/stock/items'),
        apiGet('/api/vendors').catch(() => ({ vendors: [] })),
        apiGet('/api/employees').catch(() => [])
      ]);
      setItems(safeRows(itemsRes.items));
      setVendors(safeRows(vendorsRes.vendors || vendorsRes.rows || vendorsRes));
      const employees = safeRows(employeesRes);
      const techRows = employees.filter((row) => {
        const role = String(row.role || row.role_name || row.department || '').toLowerCase();
        const status = String(row.status || 'active').toLowerCase();
        return status === 'active' && (role.includes('technician') || role.includes('field') || role.includes('service') || role.includes('ops'));
      });
      setTechnicians((techRows.length ? techRows : employees).map((row) => ({ ...row, displayName: employeeLabel(row) })));
    } catch (_error) {
      // Filters can still work without option lists.
    }
  };

  const loadReport = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/stock/reports', nextFilters);
      setRows(safeRows(res.rows));
      setSummary(res.summary || {});
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load stock reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
    loadReport(initialFilters);
  }, []);

  const filteredItemOptions = useMemo(() => safeRows(items).filter((row) => !filters.category || row.category === filters.category), [items, filters.category]);

  const onSearch = async () => {
    await loadReport(filters);
  };

  const renderRows = () => {
    if (!rows.length) return <EmptyState title="No report data" message="Try another filter combination." />;

    if (filters.reportType === 'current-stock') {
      return (
        <table className="table-clean" style={tableStyle}>
          <thead>
            <tr>{reportColumns['current-stock'].map((label) => <th key={label} className={['Current Stock', 'Minimum', 'Value'].includes(label) ? 'table-header-cell table-number-cell' : label === 'Status' ? 'table-header-cell table-status-cell' : 'table-header-cell table-text-cell'} style={headerCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
                <td className="table-text-cell" style={cellStyle}>{stockCategoryDisplayLabel(row.category)}</td>
                <td className="table-text-cell" style={cellStyle}>{row.unit}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.currentStock)}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.minStockLevel)}</td>
                <td className="table-number-cell" style={cellStyle}>{money((Number(row.currentStock || 0) * Number(row.purchaseRate || 0)))}</td>
                <td className="table-status-cell" style={cellStyle}><span style={badgeStyle(row.status)}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (filters.reportType === 'technician-stock') {
      return (
        <table className="table-clean" style={tableStyle}>
          <thead>
            <tr>{reportColumns['technician-stock'].map((label) => <th key={label} style={headerCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.technicianId}-${row.itemId}-${index}`}>
                <td className="table-text-cell" style={cellStyle}>{row.technicianName}</td>
                <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.currentBalance)} {row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (filters.reportType === 'purchase') {
      return (
        <table className="table-clean" style={tableStyle}>
          <thead>
            <tr>{reportColumns.purchase.map((label) => <th key={label} style={headerCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-text-cell" style={cellStyle}>{row.purchaseDate}</td>
                <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
                <td className="table-text-cell" style={cellStyle}>{row.vendorName || '---'}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.quantity)}</td>
                <td className="table-number-cell" style={cellStyle}>{money(row.rate)}</td>
                <td className="table-number-cell" style={cellStyle}>{money(row.totalAmount)}</td>
                <td className="table-text-cell" style={cellStyle}>{row.batchNumber || '---'}<div style={{ color: '#6B7280', fontSize: 12 }}>{row.expiryDate || 'No expiry'}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (filters.reportType === 'usage') {
      return (
        <table className="table-clean" style={tableStyle}>
          <thead>
            <tr>{reportColumns.usage.map((label) => <th key={label} style={headerCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-text-cell" style={cellStyle}>{row.movementDate ? String(row.movementDate).slice(0, 10) : row.movementDate}</td>
                <td className="table-text-cell" style={cellStyle}>{row.technicianName}</td>
                <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.outQty)}</td>
                <td className="table-text-cell" style={cellStyle}>{row.customerName || '---'}</td>
                <td className="table-text-cell" style={cellStyle}>{row.serviceType || '---'}</td>
                <td className="table-text-cell" style={cellStyle}>{row.notes || '---'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (filters.reportType === 'low-stock') {
      return (
        <table className="table-clean" style={tableStyle}>
          <thead>
            <tr>{reportColumns['low-stock'].map((label) => <th key={label} style={headerCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
                <td className="table-text-cell" style={cellStyle}>{stockCategoryDisplayLabel(row.category)}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.currentStock)}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.minStockLevel)}</td>
                <td className="table-status-cell" style={cellStyle}><span style={badgeStyle(row.status)}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (filters.reportType === 'expiry') {
      return (
        <table className="table-clean" style={tableStyle}>
          <thead>
            <tr>{reportColumns.expiry.map((label) => <th key={label} style={headerCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
                <td className="table-text-cell" style={cellStyle}>{stockCategoryDisplayLabel(row.category)}</td>
                <td className="table-text-cell" style={cellStyle}>{row.expiryDate || '---'}</td>
                <td className="table-number-cell" style={cellStyle}>{number(row.currentStock)}</td>
                <td className="table-status-cell" style={cellStyle}><span style={badgeStyle('Expiring Soon')}>Expiring Soon</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="table-clean" style={tableStyle}>
        <thead>
          <tr>{reportColumns.ledger.map((label) => <th key={label} style={headerCellStyle}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="table-text-cell" style={cellStyle}>{String(row.movementDate || '').slice(0, 10)}</td>
              <td className="table-text-cell" style={cellStyle}>{row.movementType}</td>
              <td className="table-name-cell" style={cellStyle}>{row.itemName}</td>
              <td className="table-number-cell" style={cellStyle}>{number(row.inQty)}</td>
              <td className="table-number-cell" style={cellStyle}>{number(row.outQty)}</td>
              <td className="table-number-cell" style={cellStyle}>{number(row.officeBalanceAfter)}</td>
              <td className="table-text-cell" style={cellStyle}>{row.technicianName || '---'}</td>
              <td className="table-text-cell" style={cellStyle}>{row.sourceLocation || 'office'}</td>
              <td className="table-text-cell" style={cellStyle}>{row.notes || '---'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="crm-page crm-section" style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Reports"
        subtitle="Filter stock movements, balances, purchases, usage, low stock, and expiry records."
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={() => loadReport(filters)} loading={loading}>Refresh</AppButton>
            <AppButton variant="outline" iconLeft={<FileDown size={16} />} onClick={() => window.open(exportUrl({ reportType: filters.reportType, format: 'csv', params: filters }), '_blank')}>CSV</AppButton>
            <AppButton variant="outline" iconLeft={<FileDown size={16} />} onClick={() => window.open(exportUrl({ reportType: filters.reportType, format: 'pdf', params: filters }), '_blank')}>PDF</AppButton>
          </div>
        )}
      />

      <AppCard title="Filters" className="crm-filter-card">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <AppSelect label="Report Type" value={filters.reportType} onChange={(e) => setFilters({ ...filters, reportType: e.target.value })}>
            {reportTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </AppSelect>
          <AppInput type="date" label="Start Date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          <AppInput type="date" label="End Date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          <AppSelect label="Item" value={filters.itemId} onChange={(e) => setFilters({ ...filters, itemId: e.target.value })}>
            <option value="">All Items</option>
            {filteredItemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
          </AppSelect>
          <AppSelect label="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value, itemId: '' })}>
            <option value="">All Categories</option>
            {stockCategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </AppSelect>
          <AppSelect label="Vendor" value={filters.vendorId} onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}>
            <option value="">All Vendors</option>
            {safeRows(vendors).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendorLabel(vendor)}</option>)}
          </AppSelect>
          <AppSelect label="Technician" value={filters.technicianId} onChange={(e) => setFilters({ ...filters, technicianId: e.target.value })}>
            <option value="">All Technicians</option>
            {safeRows(technicians).map((tech) => <option key={tech.id} value={tech.id}>{tech.displayName || employeeLabel(tech)}</option>)}
          </AppSelect>
          <AppSelect label="Movement Type" value={filters.movementType} onChange={(e) => setFilters({ ...filters, movementType: e.target.value })}>
            {movementTypes.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}
          </AppSelect>
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <AppButton onClick={onSearch}>Apply Filters</AppButton>
        </div>
      </AppCard>

      {error ? <AppCard><EmptyState title="Report error" message={error} /></AppCard> : null}

      <AppCard title={`${reportTypes.find((item) => item.value === filters.reportType)?.label || 'Report'} Summary`} className="crm-kpi-card">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div><strong>Rows:</strong> {summary.rows ?? rows.length}</div>
          {summary.value !== undefined ? <div><strong>Value:</strong> {money(summary.value)}</div> : null}
          {summary.quantity !== undefined ? <div><strong>Quantity:</strong> {number(summary.quantity)}</div> : null}
        </div>
      </AppCard>

      <AppCard title="Report Table" className="crm-table-card">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {renderRows()}
          </div>
        )}
      </AppCard>
    </div>
  );
}
