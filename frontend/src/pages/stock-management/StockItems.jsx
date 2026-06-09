import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import useColumnResize from '../../components/table/useColumnResize';
import { theme } from '../../styles/theme';
import { apiDelete, apiGet, apiPost, apiPut, formatCurrentStockDisplay, number, safeRows, stockCategories, stockCategoryDisplayLabel, stockUnits } from './stockApi';

const vendorLabel = (row) => String(row.name || row.vendor_name || row.company_name || row.displayName || `Vendor ${row.id || row._id || ''}`).trim();

const initialForm = {
  id: '',
  itemName: '',
  itemCode: '',
  hsnSac: '',
  packSizePerBottle: '',
  noOfBottles: '',
  category: 'Other',
  unit: 'piece',
  purchaseRate: '0',
  gstPercent: '',
  totalAmount: '0',
  vendorId: '',
  batchNumber: '',
  minStockLevel: '',
  expiryDate: '',
  isActive: true
};

const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0 };
const cellStyle = { padding: '10px 12px', borderBottom: `1px solid ${theme.colors.borderSoft}`, fontSize: 13, verticalAlign: 'middle', color: theme.colors.text, background: theme.colors.surface };
const headerCellStyle = {
  ...cellStyle,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: theme.colors.muted,
  fontWeight: 800,
  background: 'color-mix(in srgb, var(--color-surface-soft) 92%, var(--color-surface))'
};
const actionIconButtonStyle = {
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#334155',
  borderRadius: '12px',
  width: '34px',
  height: '34px',
  minWidth: '34px',
  minHeight: '34px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
};
const badgeStyle = (status) => {
  const value = String(status || '').toLowerCase();
  let bg = 'color-mix(in srgb, var(--color-surface-soft) 90%, var(--color-surface))';
  let fg = theme.colors.text;
  if (value === 'in stock') {
    bg = 'color-mix(in srgb, var(--color-success) 14%, var(--color-surface))';
    fg = 'var(--color-success)';
  } else if (value === 'low stock' || value === 'out of stock' || value === 'expired' || value === 'expiring soon') {
    bg = 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))';
    fg = 'var(--color-danger)';
  }
  return { display: 'inline-flex', alignItems: 'center', minHeight: 24, borderRadius: 999, padding: '0 10px', fontSize: 12, fontWeight: 800, background: bg, color: fg, border: `1px solid ${theme.colors.border}` };
};

const stockItemColumns = [
  { key: 'item', label: 'Item' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
  { key: 'hsnSac', label: 'HSN Code' },
  { key: 'packSizePerBottle', label: 'Pack Size / Per Bottle' },
  { key: 'currentStock', label: 'Current Stock' },
  { key: 'minimum', label: 'Minimum' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' }
];
const stockItemWidths = {
  item: 220,
  category: 140,
  unit: 110,
  hsnSac: 130,
  packSizePerBottle: 170,
  currentStock: 130,
  minimum: 120,
  status: 120,
  actions: 130
};
const stockItemBounds = {
  item: { min: 180, max: 320 },
  category: { min: 120, max: 200 },
  unit: { min: 90, max: 150 },
  hsnSac: { min: 110, max: 180 },
  packSizePerBottle: { min: 140, max: 240 },
  currentStock: { min: 100, max: 170 },
  minimum: { min: 100, max: 170 },
  status: { min: 100, max: 160 },
  actions: { min: 120, max: 180 }
};

export default function StockItems() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsRes, vendorsRes] = await Promise.all([
        apiGet('/api/stock/items'),
        apiGet('/api/vendors').catch(() => ({ vendors: [] }))
      ]);
      setItems(safeRows(itemsRes.items));
      setVendors(safeRows(vendorsRes.vendors || vendorsRes.rows || vendorsRes));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load stock items.');
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

  const vendorOptions = useMemo(() => safeRows(vendors), [vendors]);
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'stock_items_table_widths',
    columns: stockItemColumns.map((column) => column.key),
    defaultColumnWidths: stockItemWidths,
    columnBounds: stockItemBounds,
    minWidth: 100,
    enabled: true
  });
  const tableMinWidth = stockItemColumns.reduce((sum, column) => sum + (getColumnWidth(column.key) || stockItemWidths[column.key] || 100), 0);
  const listTableStyle = { ...tableStyle, minWidth: `${Math.max(1100, tableMinWidth)}px`, tableLayout: 'fixed' };
  const isMobileForm = viewportWidth <= 768;
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
  const formGridStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 12, gridTemplateColumns: '1fr' }
    : viewportWidth <= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
  const actionRowStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 8, width: '100%' }
    : { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' };
  const actionButtonStyle = viewportWidth <= 480 ? { width: '100%', justifyContent: 'center' } : undefined;
  const formCardStyle = isMobileForm
    ? {
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'none',
        overflow: 'visible',
        borderRadius: '20px'
      }
    : undefined;
  const formBodyStyle = isMobileForm
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        overflow: 'visible'
      }
    : undefined;
  const formScrollStyle = isMobileForm
    ? {
        overflowY: 'visible',
        minHeight: 0,
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'auto',
        paddingRight: 0
      }
    : undefined;
  const panelStyle = {
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    boxShadow: theme.shadow.sm
  };
  const stockControlStyle = {
    minHeight: '40px',
    height: '40px'
  };
  const computeTotalAmount = (bottles, rate, gstPercent) => {
    const bottleCount = Number(bottles || 0);
    const purchaseRate = Number(rate || 0);
    const gst = Number(gstPercent || 0);
    if (!Number.isFinite(bottleCount) || !Number.isFinite(purchaseRate) || bottleCount <= 0 || purchaseRate <= 0) return '0.00';
    const subtotal = bottleCount * purchaseRate;
    const total = subtotal * (1 + gst / 100);
    return total.toFixed(2);
  };
  const toolbarButtonStyle = {
    minHeight: 38,
    borderRadius: 999,
    boxShadow: theme.shadow.sm
  };

  const resetForm = () => setForm(initialForm);

  const editRow = (row) => {
    setForm({
      id: row.id,
      itemName: row.itemName || '',
      itemCode: row.itemCode || '',
      hsnSac: row.hsnSac || '',
      packSizePerBottle: row.packSizePerBottle || '',
      noOfBottles: String(row.noOfBottles ?? ''),
      category: row.category || 'Other',
      unit: row.unit || 'piece',
      purchaseRate: String(row.purchaseRate ?? 0),
      gstPercent: String(row.gstPercent ?? ''),
      totalAmount: String(row.totalAmount ?? computeTotalAmount(row.noOfBottles ?? 0, row.purchaseRate ?? 0, row.gstPercent ?? 0)),
      vendorId: row.vendorId || '',
      batchNumber: row.batchNumber || '',
      minStockLevel: String(row.minStockLevel ?? ''),
      expiryDate: row.expiryDate || '',
      isActive: Boolean(row.isActive)
    });
  };

  useEffect(() => {
    setForm((prev) => {
      if (!prev) return prev;
      const totalAmount = computeTotalAmount(prev.noOfBottles, prev.purchaseRate, prev.gstPercent);
      if (prev.totalAmount === totalAmount) return prev;
      return { ...prev, totalAmount };
    });
  }, [form.noOfBottles, form.purchaseRate, form.gstPercent]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        vendorId: form.vendorId || null,
        purchaseRate: Number(form.purchaseRate || 0),
        gstPercent: Number(form.gstPercent || 0),
        totalAmount: Number(form.totalAmount || 0)
      };
      if (form.id) {
        await apiPut(`/api/stock/items/${form.id}`, payload);
      } else {
        await apiPost('/api/stock/items', payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    setSaving(true);
    setError('');
    try {
      await apiDelete(`/api/stock/items/${id}`);
      if (form.id === id) resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to delete item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-page crm-section" style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Items"
        subtitle="Manage stock items, units, rates, opening stock, and minimum levels."
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={load} loading={loading}>Refresh</AppButton>
            <AppButton iconLeft={<Plus size={16} />} onClick={resetForm}>New Item</AppButton>
          </div>
        )}
      />

      {error ? <AppCard><EmptyState title="Stock items error" message={error} /></AppCard> : null}

      <AppCard title={form.id ? 'Edit Item' : 'Add Item'} className="crm-filter-card" style={{ ...panelStyle, ...formCardStyle }} bodyStyle={formBodyStyle}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, minWidth: 0, ...formScrollStyle }}>
          <div style={formGridStyle}>
            <AppInput label="Item Name" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} required style={stockControlStyle} />
            <AppInput label="Item Code" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} style={stockControlStyle} />
            <AppInput label="HSN Code" value={form.hsnSac} onChange={(e) => setForm({ ...form, hsnSac: e.target.value })} style={stockControlStyle} />
            <AppSelect label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {stockCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </AppSelect>
            <AppSelect label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={stockControlStyle}>
              {stockUnits.map((item) => <option key={item} value={item}>{item}</option>)}
            </AppSelect>
            <AppInput label="Pack Size / Per Bottle" value={form.packSizePerBottle} onChange={(e) => setForm({ ...form, packSizePerBottle: e.target.value })} style={stockControlStyle} />
            <AppInput
              type="number"
              step="1"
              min="0"
              label="No of Bottles"
              value={form.noOfBottles}
              onChange={(e) => setForm({ ...form, noOfBottles: e.target.value })}
              style={stockControlStyle}
            />
            <AppInput type="number" step="0.01" min="0" label="Purchase Rate" value={form.purchaseRate} onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })} style={stockControlStyle} />
            <AppSelect label="GST Amount" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} style={stockControlStyle}>
              <option value="">Select GST</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="26">26%</option>
            </AppSelect>
            <AppInput
              type="number"
              step="0.01"
              min="0"
              label="Total Amount"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              style={stockControlStyle}
              readOnly
            />
            <AppSelect label="Vendor" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} style={stockControlStyle}>
              <option value="">Optional</option>
              {vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendorLabel(vendor)}</option>)}
            </AppSelect>
            <AppInput label="Batch Number" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} style={stockControlStyle} />
            <AppInput type="number" step="0.001" min="0" label="Minimum Stock Level" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} style={stockControlStyle} />
            <AppInput type="date" label="Expiry Date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} style={stockControlStyle} />
            <AppSelect label="Status" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} style={stockControlStyle}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </AppSelect>
          </div>
          <div style={actionRowStyle}>
            {form.id ? <AppButton variant="outline" onClick={resetForm} type="button">Cancel Edit</AppButton> : null}
            <AppButton type="submit" loading={saving} style={actionButtonStyle}>{form.id ? 'Update Item' : 'Save Item'}</AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard title="Stock Items List" className="crm-table-card" style={panelStyle}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : items.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-clean" style={listTableStyle}>
              <colgroup>
                {stockItemColumns.map((column) => (
                  <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="table-header-cell table-text-cell" style={headStyle('item')}>Item</th>
                  <th className="table-header-cell table-text-cell" style={headStyle('category', 'center')}>Category</th>
                  <th className="table-header-cell table-text-cell" style={headStyle('unit', 'center')}>Unit</th>
                  <th className="table-header-cell table-text-cell" style={headStyle('hsnSac', 'center')}>HSN Code</th>
                  <th className="table-header-cell table-text-cell" style={headStyle('packSizePerBottle', 'center')}>Pack Size / Per Bottle</th>
                  <th className="table-header-cell table-number-cell" style={headStyle('currentStock', 'left')}>Current Stock</th>
                  <th className="table-header-cell table-number-cell" style={headStyle('minimum', 'center')}>Minimum</th>
                  <th className="table-header-cell table-status-cell" style={headStyle('status', 'center')}>Status</th>
                  <th className="table-header-cell table-actions-cell" style={headStyle('actions', 'center')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} style={{ minHeight: 48 }}>
                    <td className="table-name-cell" style={bodyStyle('item')}>
                      <div style={{ fontWeight: 800, color: theme.colors.text, letterSpacing: '-0.01em' }}>{row.itemName}</div>
                      <div style={{ color: theme.colors.muted, fontSize: 12, fontWeight: 600 }}>{row.itemCode || 'No code'}</div>
                    </td>
                    <td className="table-text-cell" style={bodyStyle('category', 'center')}>{stockCategoryDisplayLabel(row.category)}</td>
                    <td className="table-text-cell" style={bodyStyle('unit', 'center')}>{row.unit}</td>
                    <td className="table-text-cell" style={bodyStyle('hsnSac', 'center')}>{row.hsnSac || '-'}</td>
                    <td className="table-text-cell" style={bodyStyle('packSizePerBottle', 'center')}>{row.packSizePerBottle || '-'}</td>
                    <td className="table-number-cell" style={bodyStyle('currentStock', 'left')}>
                      <div style={{ display: 'grid', gap: 2, justifyItems: 'start' }}>
                        <span style={{ fontWeight: 800, color: theme.colors.text }}>{formatCurrentStockDisplay(row)}</span>
                        {row.currentStockFormula ? <span style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 1.2 }}>{row.currentStockFormula}</span> : null}
                      </div>
                    </td>
                    <td className="table-number-cell" style={bodyStyle('minimum', 'center')}>{number(row.minStockLevel)}</td>
                    <td className="table-status-cell" style={bodyStyle('status', 'center')}><span style={badgeStyle(row.status)}>{row.status}</span></td>
                    <td className="table-actions-cell" style={bodyStyle('actions', 'left')}>
                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          style={actionIconButtonStyle}
                          onClick={() => editRow(row)}
                          title="Edit item"
                          aria-label="Edit item"
                        >
                          <Edit3 size={14} strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          style={{ ...actionIconButtonStyle, marginRight: 0 }}
                          onClick={() => handleDelete(row.id)}
                          disabled={saving}
                          title="Delete item"
                          aria-label="Delete item"
                        >
                          <Trash2 size={15} strokeWidth={2.25} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No items yet" message="Create the first stock item to start tracking stock." />
        )}
      </AppCard>
    </div>
  );
}
