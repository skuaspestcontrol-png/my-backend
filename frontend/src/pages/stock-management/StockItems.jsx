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
import { apiDelete, apiGet, apiPost, apiPut, number, safeRows, stockCategories, stockUnits } from './stockApi';

const vendorLabel = (row) => String(row.name || row.vendor_name || row.company_name || row.displayName || `Vendor ${row.id || row._id || ''}`).trim();

const initialForm = {
  id: '',
  itemName: '',
  itemCode: '',
  category: 'Other',
  unit: 'piece',
  openingStock: '0',
  currentStock: '0',
  minStockLevel: '0',
  purchaseRate: '0',
  vendorId: '',
  batchNumber: '',
  expiryDate: '',
  storageLocation: '',
  description: '',
  isActive: true
};

const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 13, verticalAlign: 'top' };
const headerCellStyle = { ...cellStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' };

export default function StockItems() {
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

  const vendorOptions = useMemo(() => safeRows(vendors), [vendors]);

  const resetForm = () => setForm(initialForm);

  const editRow = (row) => {
    setForm({
      id: row.id,
      itemName: row.itemName || '',
      itemCode: row.itemCode || '',
      category: row.category || 'Other',
      unit: row.unit || 'piece',
      openingStock: String(row.openingStock ?? 0),
      currentStock: String(row.currentStock ?? 0),
      minStockLevel: String(row.minStockLevel ?? 0),
      purchaseRate: String(row.purchaseRate ?? 0),
      vendorId: row.vendorId || '',
      batchNumber: row.batchNumber || '',
      expiryDate: row.expiryDate || '',
      storageLocation: row.storageLocation || '',
      description: row.description || '',
      isActive: Boolean(row.isActive)
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        vendorId: form.vendorId || null,
        openingStock: Number(form.openingStock || 0),
        currentStock: Number(form.currentStock || 0),
        minStockLevel: Number(form.minStockLevel || 0),
        purchaseRate: Number(form.purchaseRate || 0)
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
    if (!window.confirm('Deactivate this item?')) return;
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
    <div style={{ display: 'grid', gap: 16 }}>
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

      <AppCard title={form.id ? 'Edit Item' : 'Add Item'}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <AppInput label="Item Name" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} required />
            <AppInput label="Item Code" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} />
            <AppSelect label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {stockCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </AppSelect>
            <AppSelect label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {stockUnits.map((item) => <option key={item} value={item}>{item}</option>)}
            </AppSelect>
            <AppInput type="number" step="0.001" min="0" label="Opening Stock" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value })} />
            <AppInput type="number" step="0.001" min="0" label="Current Office Stock" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
            <AppInput type="number" step="0.001" min="0" label="Minimum Stock Alert" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} />
            <AppInput type="number" step="0.01" min="0" label="Purchase Rate" value={form.purchaseRate} onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })} />
            <AppSelect label="Vendor" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">Optional</option>
              {vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendorLabel(vendor)}</option>)}
            </AppSelect>
            <AppInput label="Batch Number" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            <AppInput type="date" label="Expiry Date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            <AppInput label="Storage Location" value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} />
            <AppSelect label="Status" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </AppSelect>
          </div>
          <AppTextarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {form.id ? <AppButton variant="outline" onClick={resetForm} type="button">Cancel Edit</AppButton> : null}
            <AppButton type="submit" loading={saving}>{form.id ? 'Update Item' : 'Save Item'}</AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard title="Stock Items List">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><LoadingSpinner size={26} /></div>
        ) : items.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Item</th>
                  <th style={headerCellStyle}>Category</th>
                  <th style={headerCellStyle}>Unit</th>
                  <th style={headerCellStyle}>Current Stock</th>
                  <th style={headerCellStyle}>Minimum</th>
                  <th style={headerCellStyle}>Status</th>
                  <th style={headerCellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{row.itemName}</div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>{row.itemCode || 'No code'}</div>
                    </td>
                    <td style={cellStyle}>{row.category}</td>
                    <td style={cellStyle}>{row.unit}</td>
                    <td style={cellStyle}>{number(row.currentStock)}</td>
                    <td style={cellStyle}>{number(row.minStockLevel)}</td>
                    <td style={cellStyle}>
                      <StatusBadge status={row.status === 'In Stock' ? 'active' : row.status === 'Low Stock' ? 'pending' : 'danger'}>
                        {row.status}
                      </StatusBadge>
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
          <EmptyState title="No items yet" message="Create the first stock item to start tracking stock." />
        )}
      </AppCard>
    </div>
  );
}
