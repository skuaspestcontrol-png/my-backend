import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, ShoppingCart } from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import AppTextarea from '../../components/ui/AppTextarea';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import useColumnResize from '../../components/table/useColumnResize';
import { apiGet, apiPost, money, number, safeRows, stockCategoryDisplayLabel, toNumber } from './stockApi';

const vendorLabel = (row) => String(row.name || row.vendor_name || row.company_name || row.displayName || `Vendor ${row.id || row._id || ''}`).trim();

const today = new Date().toISOString().slice(0, 10);

const initialForm = {
  vendorId: '',
  purchaseDate: today,
  invoiceNumber: '',
  itemId: '',
  quantity: '',
  rate: '',
  gstPercent: '',
  totalAmount: '',
  batchNumber: '',
  expiryDate: '',
  notes: ''
};

const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 13, verticalAlign: 'top' };
const headerCellStyle = { ...cellStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' };

const purchaseColumns = [
  { key: 'date', label: 'Date' },
  { key: 'item', label: 'Item' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'qty', label: 'Qty' },
  { key: 'rate', label: 'Rate' },
  { key: 'total', label: 'Total' },
  { key: 'batchExpiry', label: 'Batch / Expiry' }
];
const purchaseWidths = {
  date: 110,
  item: 220,
  vendor: 180,
  qty: 90,
  rate: 100,
  total: 110,
  batchExpiry: 170
};
const purchaseBounds = {
  date: { min: 95, max: 140 },
  item: { min: 180, max: 300 },
  vendor: { min: 150, max: 260 },
  qty: { min: 80, max: 120 },
  rate: { min: 90, max: 140 },
  total: { min: 90, max: 150 },
  batchExpiry: { min: 150, max: 240 }
};

export default function StockPurchase() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsRes, purchasesRes, vendorsRes] = await Promise.all([
        apiGet('/api/stock/items'),
        apiGet('/api/stock/purchases'),
        apiGet('/api/vendors').catch(() => ({ vendors: [] }))
      ]);
      setItems(safeRows(itemsRes.items));
      setPurchases(safeRows(purchasesRes.purchases));
      setVendors(safeRows(vendorsRes.vendors || vendorsRes.rows || vendorsRes));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load purchases.');
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

  useEffect(() => {
    const qty = toNumber(form.quantity, 0);
    const rate = toNumber(form.rate, 0);
    const gst = toNumber(form.gstPercent, 0);
    if (!qty || !rate) return;
    setForm((prev) => ({ ...prev, totalAmount: String((qty * rate * (1 + gst / 100)).toFixed(2)) }));
  }, [form.quantity, form.rate, form.gstPercent]);

  const itemOptions = useMemo(() => safeRows(items), [items]);
  const vendorOptions = useMemo(() => safeRows(vendors), [vendors]);
  const formGridStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 12, gridTemplateColumns: '1fr' }
    : viewportWidth <= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
  const actionRowStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 8, width: '100%' }
    : { display: 'flex', justifyContent: 'flex-end' };
  const actionButtonStyle = viewportWidth <= 480 ? { width: '100%', justifyContent: 'center' } : undefined;
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'stock_purchase_table_widths',
    columns: purchaseColumns.map((column) => column.key),
    defaultColumnWidths: purchaseWidths,
    columnBounds: purchaseBounds,
    minWidth: 90,
    enabled: true
  });
  const tableMinWidth = purchaseColumns.reduce((sum, column) => sum + (getColumnWidth(column.key) || purchaseWidths[column.key] || 90), 0);
  const purchaseTableStyle = { ...tableStyle, minWidth: `${Math.max(900, tableMinWidth)}px`, tableLayout: 'fixed' };
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

  const resetForm = () => setForm(initialForm);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/stock/purchases', {
        ...form,
        vendorId: form.vendorId || null,
        itemId: form.itemId || null,
        quantity: Number(form.quantity || 0),
        rate: Number(form.rate || 0),
        gstPercent: Number(form.gstPercent || 0),
        totalAmount: Number(form.totalAmount || 0)
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-page crm-section" style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Stock In / Purchase"
        subtitle="Record purchases from vendors and add stock to office balance automatically."
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={load} loading={loading}>Refresh</AppButton>
            <AppButton iconLeft={<Plus size={16} />} onClick={resetForm}>New Purchase</AppButton>
          </div>
        )}
      />

      {error ? <AppCard><EmptyState title="Purchase error" message={error} /></AppCard> : null}

      <AppCard title="Add Purchase" className="crm-filter-card">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={formGridStyle}>
            <AppSelect label="Vendor" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">Optional</option>
              {vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendorLabel(vendor)}</option>)}
            </AppSelect>
            <AppInput type="date" label="Purchase Date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required />
            <AppInput label="Invoice Number" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            <AppSelect label="Item" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} required>
              <option value="">Select item</option>
              {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
            </AppSelect>
            <AppInput type="number" step="0.001" min="0.001" label="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            <AppInput type="number" step="0.01" min="0" label="Rate" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <AppInput type="number" step="0.01" min="0" label="GST %" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} />
            <AppInput type="number" step="0.01" min="0" label="Total Amount" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
            <AppInput label="Batch Number" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            <AppInput type="date" label="Expiry Date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </div>
          <AppTextarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div style={actionRowStyle}>
            <AppButton type="submit" loading={saving} iconLeft={<ShoppingCart size={16} />} style={actionButtonStyle}>Save Purchase</AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard title="Recent Purchases" className="crm-table-card">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : purchases.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={purchaseTableStyle}>
              <colgroup>
                {purchaseColumns.map((column) => (
                  <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={headStyle('date', 'center')}>Date</th>
                  <th style={headStyle('item')}>Item</th>
                  <th style={headStyle('vendor')}>Vendor</th>
                  <th style={headStyle('qty', 'center')}>Qty</th>
                  <th style={headStyle('rate', 'center')}>Rate</th>
                  <th style={headStyle('total', 'center')}>Total</th>
                  <th style={headStyle('batchExpiry')}>Batch / Expiry</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => (
                  <tr key={row.id}>
                    <td style={bodyStyle('date', 'center')}>{row.purchaseDate}</td>
                    <td style={bodyStyle('item')}>
                      <div style={{ fontWeight: 700 }}>{row.itemName}</div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>{stockCategoryDisplayLabel(row.category)}</div>
                    </td>
                    <td style={bodyStyle('vendor')}>{row.vendorName || '---'}</td>
                    <td style={bodyStyle('qty', 'center')}>{number(row.quantity)}</td>
                    <td style={bodyStyle('rate', 'center')}>{money(row.rate)}</td>
                    <td style={bodyStyle('total', 'center')}>{money(row.totalAmount)}</td>
                    <td style={bodyStyle('batchExpiry')}>
                      <div>{row.batchNumber || '---'}</div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>{row.expiryDate || 'No expiry'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No purchases yet" message="Saved purchases will appear here." />
        )}
      </AppCard>
    </div>
  );
}
