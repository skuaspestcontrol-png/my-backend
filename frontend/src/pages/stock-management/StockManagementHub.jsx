import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileDown,
  Filter,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
  Warehouse,
  TrendingUp
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import AppTextarea from '../../components/ui/AppTextarea';
import DashboardStatCard from '../../components/ui/DashboardStatCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  currentMonth,
  currentYear,
  downloadExportUrl,
  money,
  number,
  percent,
  safeRows
} from './stockManagementApi';

const views = {
  dashboard: { title: 'Stock Dashboard', subtitle: 'Track office stock, technician stock, low stock items, and purchase versus usage trends.' },
  products: { title: 'Products / Chemicals Master', subtitle: 'Create and maintain office stock items, units, rates, categories, and batch details.' },
  purchase: { title: 'Purchase Stock', subtitle: 'Record vendor purchases and increase office stock automatically.' },
  issue: { title: 'Issue to Technician', subtitle: 'Issue stock to technicians and keep office balance in sync.' },
  technicianStock: { title: 'Technician Stock', subtitle: 'Review issued, used, returned, and damaged balance by technician and product.' },
  usage: { title: 'Stock Usage / Consumption', subtitle: 'Capture actual stock used at the customer site.' },
  returns: { title: 'Return / Wastage / Damage', subtitle: 'Return unused items, or mark wastage, damage, and expired items.' },
  lowStock: { title: 'Low Stock Alert', subtitle: 'Watch items that have reached or crossed the minimum level.' },
  vendorReport: { title: 'Vendor Stock Report', subtitle: 'Review purchase-driven stock movement and vendor contribution.' },
  ledger: { title: 'Stock Ledger', subtitle: 'See every movement in one audit trail.' },
  reports: { title: 'Reports', subtitle: 'Filter, review, and export current stock and movement reports.' }
};

const menuItems = [
  { view: 'dashboard', path: '/stock/dashboard', label: 'Dashboard' },
  { view: 'products', path: '/stock/products', label: 'Products / Chemicals Master' },
  { view: 'purchase', path: '/stock/purchase', label: 'Purchase Stock' },
  { view: 'issue', path: '/stock/issue', label: 'Issue to Technician' },
  { view: 'technicianStock', path: '/stock/technician-stock', label: 'Technician Stock' },
  { view: 'usage', path: '/stock/usage', label: 'Stock Usage / Consumption' },
  { view: 'returns', path: '/stock/returns', label: 'Return / Wastage / Damage' },
  { view: 'lowStock', path: '/stock/low-stock', label: 'Low Stock Alert' },
  { view: 'vendorReport', path: '/stock/vendor-report', label: 'Vendor Stock Report' },
  { view: 'ledger', path: '/stock/ledger', label: 'Stock Ledger' },
  { view: 'reports', path: '/stock/reports', label: 'Reports' }
];

const categoriesFallback = [
  { value: '', label: 'Select category' },
  { value: 'Chemical', label: 'Chemical' },
  { value: 'Gel / Bait', label: 'Gel / Bait' },
  { value: 'Rodent Control', label: 'Rodent Control' },
  { value: 'Equipment', label: 'Equipment' },
  { value: 'PPE', label: 'PPE' },
  { value: 'Consumable', label: 'Consumable' },
  { value: 'Other', label: 'Other' }
];

const unitFallback = ['ml', 'litre', 'gram', 'kg', 'tube', 'piece', 'box', 'packet', 'bottle', 'can'];

const today = new Date().toISOString().slice(0, 10);

const initialProductForm = () => ({
  id: '',
  productCode: '',
  productName: '',
  categoryId: '',
  unit: 'piece',
  openingStock: '',
  minStockLevel: '',
  purchaseRate: '',
  internalRate: '',
  defaultVendorId: '',
  batchNumber: '',
  expiryDate: '',
  storageLocation: '',
  description: '',
  active: true
});

const initialPurchaseForm = () => ({
  vendorId: '',
  purchaseDate: today,
  invoiceNumber: '',
  productId: '',
  quantity: '',
  unit: 'piece',
  rate: '',
  gstPercent: '',
  totalAmount: '',
  batchNumber: '',
  expiryDate: '',
  notes: ''
});

const initialIssueForm = () => ({
  technicianId: '',
  issueDate: today,
  productId: '',
  quantity: '',
  unit: 'piece',
  customerId: '',
  contractId: '',
  jobId: '',
  notes: ''
});

const initialUsageForm = () => ({
  technicianId: '',
  usageDate: today,
  productId: '',
  quantityUsed: '',
  unit: 'piece',
  customerId: '',
  contractId: '',
  jobId: '',
  serviceType: '',
  notes: ''
});

const initialReturnForm = () => ({
  technicianId: '',
  returnDate: today,
  productId: '',
  quantity: '',
  unit: 'piece',
  returnType: 'return_to_office',
  sourceLocation: 'technician',
  reason: '',
  notes: ''
});

const initialAdjustmentForm = () => ({
  adjustmentDate: today,
  productId: '',
  technicianId: '',
  sourceLocation: 'office',
  adjustmentType: 'increase',
  quantity: '',
  unit: 'piece',
  reason: '',
  notes: ''
});

const initialReportFilters = () => ({
  reportType: 'current-stock',
  startDate: '',
  endDate: '',
  productId: '',
  vendorId: '',
  technicianId: ''
});

const initialLedgerFilters = () => ({
  startDate: '',
  endDate: '',
  productId: '',
  categoryId: '',
  vendorId: '',
  technicianId: '',
  customerId: '',
  movementType: ''
});

const barColors = ['#9F174D', '#0F766E', '#2563EB', '#D97706', '#16A34A', '#7C3AED'];

const sectionStyle = {
  display: 'grid',
  gap: 16
};

const grid2 = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
};

const grid3 = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
};

const tableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  background: '#fff'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 1100
};

const thStyle = {
  textAlign: 'left',
  padding: '11px 12px',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--color-muted)',
  background: '#F9FAFB',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--color-border)'
};

const tdStyle = {
  padding: '11px 12px',
  borderBottom: '1px solid #EEF2F7',
  fontSize: 13,
  color: 'var(--color-text)',
  verticalAlign: 'top'
};

const smallButtonStyle = {
  minWidth: 'auto',
  padding: '0 12px',
  height: 34,
  borderRadius: 10,
  fontSize: 12
};

const topNavStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  padding: 12,
  border: '1px solid var(--color-border)',
  borderRadius: 16,
  background: '#fff'
};

const topNavItemStyle = (active) => ({
  padding: '8px 12px',
  borderRadius: 12,
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 800,
  border: '1px solid',
  borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
  color: active ? '#fff' : 'var(--color-text)',
  background: active ? 'var(--color-primary)' : '#fff'
});

const statusTone = (value) => {
  const key = String(value || '').toLowerCase();
  if (key.includes('out of stock')) return 'danger';
  if (key.includes('low')) return 'pending';
  return 'active';
};

const moneyOrDash = (value) => (Number.isFinite(Number(value)) ? money(value) : '-');

const buildOptionItems = (items = [], labelKey = 'name', valueKey = 'id') => [
  { value: '', label: 'Select option' },
  ...items.map((item) => ({
    value: String(item?.[valueKey] ?? ''),
    label: String(item?.[labelKey] ?? item?.name ?? item?.label ?? '')
  })).filter((item) => item.value)
];

const ensureArrayMap = (array = [], keyFn) => {
  const map = new Map();
  array.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    map.set(key, row);
  });
  return map;
};

function StockFormGrid({ children }) {
  return <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>{children}</div>;
}

function MovementBadge({ value }) {
  return <StatusBadge status={statusTone(value)}>{value}</StatusBadge>;
}

function DataTable({ rows, columns, minWidth = 1100, emptyTitle, emptyMessage }) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle || 'No records found'} message={emptyMessage || 'Nothing has been recorded for this section yet.'} />;
  }
  return (
    <div style={{ ...tableWrapStyle, minWidth: 0 }}>
      <table style={{ ...tableStyle, minWidth }}>
        <thead>
          <tr>{columns.map((column) => <th key={column.key} style={thStyle}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id || row.key || index)}>
              {columns.map((column) => (
                <td key={column.key} style={tdStyle}>
                  {typeof column.render === 'function' ? column.render(row, index) : row[column.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StockManagementHub({ view = 'dashboard' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [options, setOptions] = useState({ categories: [], vendors: [], employees: [], technicians: [], customers: [], units: unitFallback });
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [issues, setIssues] = useState([]);
  const [usage, setUsage] = useState([]);
  const [returnsRows, setReturnsRows] = useState([]);
  const [lowStockRows, setLowStockRows] = useState([]);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [technicianStockBase, setTechnicianStockBase] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [reportSummary, setReportSummary] = useState({});
  const [productForm, setProductForm] = useState(initialProductForm());
  const [purchaseForm, setPurchaseForm] = useState(initialPurchaseForm());
  const [issueForm, setIssueForm] = useState(initialIssueForm());
  const [usageForm, setUsageForm] = useState(initialUsageForm());
  const [returnForm, setReturnForm] = useState(initialReturnForm());
  const [adjustmentForm, setAdjustmentForm] = useState(initialAdjustmentForm());
  const [reportFilters, setReportFilters] = useState(initialReportFilters());
  const [ledgerFilters, setLedgerFilters] = useState(initialLedgerFilters());
  const [productFormVisible, setProductFormVisible] = useState(false);
  const [reportFetchedType, setReportFetchedType] = useState('current-stock');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const isMobile = viewportWidth < 768;
  const isCollapsed = viewportWidth < 992;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadOptions = async () => {
    try {
      const [meta, productData] = await Promise.all([
        apiGet('/api/stock/options'),
        apiGet('/api/stock/products')
      ]);
      const normalizedProducts = safeRows(productData?.products);
      setProducts(normalizedProducts);
      setOptions({
        categories: safeRows(meta?.categories),
        vendors: safeRows(meta?.vendors),
        employees: safeRows(meta?.employees),
        technicians: safeRows(meta?.technicians),
        customers: safeRows(meta?.customers),
        units: safeRows(meta?.units).length ? safeRows(meta?.units) : unitFallback
      });
    } catch (optionError) {
      console.error(optionError);
    }
  };

  const loadSectionData = async (targetView = view) => {
    setLoading(true);
    setError('');
    try {
      await loadOptions();
      if (targetView === 'dashboard') {
        const data = await apiGet('/api/stock/dashboard');
        setDashboard(data || {});
      } else if (targetView === 'products') {
        const data = await apiGet('/api/stock/products');
        setProducts(safeRows(data?.products));
        setProductFormVisible(false);
      } else if (targetView === 'purchase') {
        const data = await apiGet('/api/stock/purchases');
        setPurchases(safeRows(data));
      } else if (targetView === 'issue') {
        const data = await apiGet('/api/stock/issues');
        setIssues(safeRows(data));
      } else if (targetView === 'technicianStock') {
        const [base, issuesResp, usageResp, returnsResp] = await Promise.all([
          apiGet('/api/stock/technician-stock'),
          apiGet('/api/stock/issues'),
          apiGet('/api/stock/usage'),
          apiGet('/api/stock/returns')
        ]);
        setTechnicianStockBase(safeRows(base));
        setIssues(safeRows(issuesResp));
        setUsage(safeRows(usageResp));
        setReturnsRows(safeRows(returnsResp));
      } else if (targetView === 'usage') {
        const data = await apiGet('/api/stock/usage');
        setUsage(safeRows(data));
      } else if (targetView === 'returns') {
        const data = await apiGet('/api/stock/returns');
        setReturnsRows(safeRows(data));
      } else if (targetView === 'lowStock') {
        const data = await apiGet('/api/stock/low-stock');
        setLowStockRows(safeRows(data));
      } else if (targetView === 'vendorReport') {
        setReportFilters((prev) => ({ ...prev, reportType: 'purchase' }));
        const data = await apiGet('/api/stock/reports', { ...reportFilters, reportType: 'purchase' });
        setReportFetchedType('purchase');
        setReportRows(safeRows(data?.rows));
        setReportSummary(data?.summary || {});
      } else if (targetView === 'ledger') {
        const data = await apiGet('/api/stock/ledger', ledgerFilters);
        setLedgerRows(safeRows(data));
      } else if (targetView === 'reports') {
        const data = await apiGet('/api/stock/reports', reportFilters);
        setReportFetchedType(reportFilters.reportType);
        setReportRows(safeRows(data?.rows));
        setReportSummary(data?.summary || {});
      }
    } catch (sectionError) {
      setError(sectionError?.response?.data?.error || sectionError?.message || 'Unable to load stock data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSectionData(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const productMap = useMemo(() => ensureArrayMap(products, (row) => String(row.id || '')), [products]);
  const technicianMap = useMemo(() => ensureArrayMap(options.technicians.length ? options.technicians : options.employees, (row) => String(row.id || row.dbId || row.external_id || '')), [options]);

  const technicianStockRows = useMemo(() => {
    if (view !== 'technicianStock') return technicianStockBase;
    const makeKey = (row) => `${String(row.technicianId || row.technician_id || '')}:${String(row.productId || row.product_id || '')}`;
    const map = new Map();
    const ensureRow = (row, fallbackType = '') => {
      const key = makeKey(row);
      if (!key || key === ':') return null;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          technicianId: row.technicianId || row.technician_id || '',
          technicianName: row.technicianName || row.technician_name || '',
          productId: row.productId || row.product_id || '',
          productName: row.productName || row.product_name || '',
          productCode: row.productCode || row.product_code || '',
          unit: row.unit || '',
          issuedQuantity: 0,
          usedQuantity: 0,
          returnedQuantity: 0,
          wastedQuantity: 0,
          currentBalance: Number(row.currentBalance || row.current_balance || 0),
          updatedAt: row.updatedAt || row.updated_at || null
        });
      }
      return map.get(key);
    };

    safeRows(issues).forEach((row) => {
      const current = ensureRow(row, 'issue');
      if (current) {
        current.issuedQuantity += number(row.quantity || 0);
        if (!current.productName) current.productName = row.productName || '';
        if (!current.productCode) current.productCode = row.productCode || '';
        current.unit = current.unit || row.unit || '';
        if (!current.technicianName) current.technicianName = row.technicianName || '';
      }
    });
    safeRows(usage).forEach((row) => {
      const key = `${String(row.technicianId || '')}:${String(row.productId || '')}`;
      const current = map.get(key) || ensureRow(row, 'usage');
      if (current) {
        current.usedQuantity += number(row.quantityUsed || row.quantity_used || 0);
        current.currentBalance = current.currentBalance || 0;
        if (!current.productName) current.productName = row.productName || '';
        if (!current.technicianName) current.technicianName = row.technicianName || '';
      }
    });
    safeRows(returnsRows).forEach((row) => {
      const current = ensureRow(row, 'return');
      if (current) {
        const qty = number(row.quantity || 0);
        if (String(row.returnType || row.return_type || '').toLowerCase() === 'return_to_office') {
          current.returnedQuantity += qty;
        } else {
          current.wastedQuantity += qty;
        }
      }
    });
    technicianStockBase.forEach((row) => {
      const current = ensureRow(row, 'base');
      if (current) {
        current.currentBalance = number(row.currentBalance || row.current_balance || current.currentBalance);
      }
    });
    return Array.from(map.values());
  }, [issues, usage, returnsRows, technicianStockBase, view]);

  const productOptions = useMemo(() => buildOptionItems(products, 'productName'), [products]);
  const vendorOptions = useMemo(() => buildOptionItems(options.vendors, 'name'), [options.vendors]);
  const technicianOptions = useMemo(() => buildOptionItems(options.technicians.length ? options.technicians : options.employees, 'name'), [options]);
  const customerOptions = useMemo(() => buildOptionItems(options.customers, 'name'), [options.customers]);
  const categoryOptions = useMemo(() => {
    const dynamic = safeRows(options.categories).length
      ? safeRows(options.categories).map((category) => ({ value: String(category.id || ''), label: category.name || '' })).filter((item) => item.value)
      : categoriesFallback.slice(1);
    return [{ value: '', label: 'Select category' }, ...dynamic];
  }, [options.categories]);
  const unitOptions = useMemo(() => [{ value: '', label: 'Select unit' }, ...safeRows(options.units).map((unit) => ({ value: unit, label: unit }))], [options.units]);

  const refresh = async () => {
    await loadSectionData(view);
  };

  const pickProduct = (productId) => {
    const product = productMap.get(String(productId));
    return product || null;
  };

  const beginEditProduct = (product) => {
    setProductForm({
      id: product.id,
      productCode: product.productCode || '',
      productName: product.productName || '',
      categoryId: product.categoryId ? String(product.categoryId) : '',
      unit: product.unit || 'piece',
      openingStock: String(product.openingStock ?? 0),
      minStockLevel: String(product.minStockLevel ?? 0),
      purchaseRate: String(product.purchaseRate ?? 0),
      internalRate: String(product.internalRate ?? 0),
      defaultVendorId: product.defaultVendorId ? String(product.defaultVendorId) : '',
      batchNumber: product.batchNumber || '',
      expiryDate: product.expiryDate || '',
      storageLocation: product.storageLocation || '',
      description: product.description || '',
      active: product.active
    });
    setProductFormVisible(true);
  };

  const resetProductForm = () => {
    setProductForm(initialProductForm());
    setProductFormVisible(false);
  };

  const submitProduct = async () => {
    setSaving('product');
    setError('');
    try {
      const payload = {
        ...productForm,
        openingStock: number(productForm.openingStock || 0),
        minStockLevel: number(productForm.minStockLevel || 0),
        purchaseRate: number(productForm.purchaseRate || 0),
        internalRate: number(productForm.internalRate || 0)
      };
      if (productForm.id) {
        await apiPut(`/api/stock/products/${productForm.id}`, payload);
      } else {
        await apiPost('/api/stock/products', payload);
      }
      resetProductForm();
      await loadSectionData('products');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError?.message || 'Unable to save product.');
    } finally {
      setSaving('');
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    setSaving('product-delete');
    try {
      await apiDelete(`/api/stock/products/${productId}`);
      await loadSectionData('products');
    } catch (deleteError) {
      setError(deleteError?.response?.data?.error || deleteError?.message || 'Unable to delete product.');
    } finally {
      setSaving('');
    }
  };

  const submitPurchase = async () => {
    setSaving('purchase');
    setError('');
    try {
      await apiPost('/api/stock/purchases', {
        ...purchaseForm,
        quantity: number(purchaseForm.quantity || 0),
        rate: number(purchaseForm.rate || 0),
        gstPercent: number(purchaseForm.gstPercent || 0),
        totalAmount: number(purchaseForm.totalAmount || 0)
      });
      setPurchaseForm(initialPurchaseForm());
      await loadSectionData('purchase');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError?.message || 'Unable to save purchase.');
    } finally {
      setSaving('');
    }
  };

  const submitIssue = async () => {
    setSaving('issue');
    setError('');
    try {
      await apiPost('/api/stock/issues', {
        ...issueForm,
        quantity: number(issueForm.quantity || 0)
      });
      setIssueForm(initialIssueForm());
      await loadSectionData('issue');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError?.message || 'Unable to save issue.');
    } finally {
      setSaving('');
    }
  };

  const submitUsage = async () => {
    setSaving('usage');
    setError('');
    try {
      await apiPost('/api/stock/usage', {
        ...usageForm,
        quantityUsed: number(usageForm.quantityUsed || 0)
      });
      setUsageForm(initialUsageForm());
      await loadSectionData('usage');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError?.message || 'Unable to save usage.');
    } finally {
      setSaving('');
    }
  };

  const submitReturn = async () => {
    setSaving('return');
    setError('');
    try {
      await apiPost('/api/stock/returns', {
        ...returnForm,
        quantity: number(returnForm.quantity || 0)
      });
      setReturnForm(initialReturnForm());
      await loadSectionData('returns');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError?.message || 'Unable to save return.');
    } finally {
      setSaving('');
    }
  };

  const submitAdjustment = async () => {
    setSaving('adjustment');
    setError('');
    try {
      await apiPost('/api/stock/adjustments', {
        ...adjustmentForm,
        quantity: number(adjustmentForm.quantity || 0)
      });
      setAdjustmentForm(initialAdjustmentForm());
      await loadSectionData('dashboard');
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError?.message || 'Unable to save adjustment.');
    } finally {
      setSaving('');
    }
  };

  const loadReport = async (nextFilters = reportFilters) => {
    setSaving('report');
    setError('');
    try {
      const data = await apiGet('/api/stock/reports', nextFilters);
      setReportFetchedType(nextFilters.reportType);
      setReportRows(safeRows(data?.rows));
      setReportSummary(data?.summary || {});
    } catch (reportError) {
      setError(reportError?.response?.data?.error || reportError?.message || 'Unable to load report.');
    } finally {
      setSaving('');
    }
  };

  const loadLedger = async (nextFilters = ledgerFilters) => {
    setSaving('ledger');
    setError('');
    try {
      const data = await apiGet('/api/stock/ledger', nextFilters);
      setLedgerRows(safeRows(data));
    } catch (ledgerError) {
      setError(ledgerError?.response?.data?.error || ledgerError?.message || 'Unable to load ledger.');
    } finally {
      setSaving('');
    }
  };

  const dashboardData = dashboard || {};
  const summaryCards = [
    { title: 'Total Products', value: dashboardData.summary?.totalProducts ?? 0, icon: <Package size={18} /> },
    { title: 'Total Stock Value', value: moneyOrDash(dashboardData.summary?.totalStockValue || 0), icon: <CircleDollarSign size={18} /> },
    { title: 'Low Stock Items', value: dashboardData.summary?.lowStockItems ?? 0, icon: <AlertCircle size={18} /> },
    { title: 'Out of Stock Items', value: dashboardData.summary?.outOfStockItems ?? 0, icon: <Truck size={18} /> },
    { title: 'Today Stock Issued', value: number(dashboardData.summary?.todayStockIssued || 0).toFixed(3), icon: <ShoppingCart size={18} /> },
    { title: 'Today Stock Used', value: number(dashboardData.summary?.todayStockUsed || 0).toFixed(3), icon: <TrendingUp size={18} /> },
    { title: 'Stock With Technicians', value: number(dashboardData.summary?.stockWithTechnicians || 0).toFixed(3), icon: <Users size={18} /> },
    { title: 'Monthly Purchase Value', value: moneyOrDash(dashboardData.summary?.monthlyPurchaseValue || 0), icon: <Warehouse size={18} /> }
  ];

  const currentView = views[view] || views.dashboard;

  const renderDashboard = () => (
    <div style={sectionStyle}>
      <div style={grid3}>
        {summaryCards.map((item) => (
          <DashboardStatCard key={item.title} title={item.title} value={item.value} icon={item.icon} />
        ))}
      </div>

      <div style={grid2}>
        <AppCard title="Category wise stock">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={safeRows(dashboardData.categoryWise)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={4}>
                  {safeRows(dashboardData.categoryWise).map((entry, index) => <Cell key={entry.name || index} fill={barColors[index % barColors.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AppCard>
        <AppCard title="Monthly purchase vs usage">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeRows(dashboardData.monthlyComparison)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="purchaseValue" name="Purchase Qty/Value" fill="#9F174D" radius={[8, 8, 0, 0]} />
                <Bar dataKey="usageValue" name="Usage Qty" fill="#0F766E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AppCard>
      </div>

      <div style={grid2}>
        <AppCard title="Low stock chart">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeRows(dashboardData.lowStockItems)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="productName" interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="currentStock" name="Current Stock" fill="#D97706" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AppCard>
        <AppCard title="Technician wise issued stock">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeRows(dashboardData.technicianIssued)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="technicianName" interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" name="Issued Qty" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AppCard>
      </div>

      <div style={grid2}>
        <AppCard title="Low stock items">
          <DataTable
            minWidth={760}
            rows={safeRows(dashboardData.lowStockItems)}
            emptyTitle="No low stock items"
            emptyMessage="All tracked products are currently above their alert level."
            columns={[
              { key: 'productName', label: 'Product' },
              { key: 'unit', label: 'Unit' },
              { key: 'currentStock', label: 'Current Stock', render: (row) => number(row.currentStock || 0).toFixed(3) },
              { key: 'minStockLevel', label: 'Min Level', render: (row) => number(row.minStockLevel || 0).toFixed(3) },
              { key: 'status', label: 'Status', render: (row) => <MovementBadge value={row.status} /> }
            ]}
          />
        </AppCard>
        <AppCard title="Recent movements">
          <DataTable
            minWidth={860}
            rows={safeRows(dashboardData.recentMovements)}
            emptyTitle="No movements yet"
            emptyMessage="Purchases, issues, usage, returns, and adjustments will appear here."
            columns={[
              { key: 'movementDate', label: 'Date' },
              { key: 'productName', label: 'Product' },
              { key: 'movementType', label: 'Movement', render: (row) => <MovementBadge value={row.movementType} /> },
              { key: 'inQty', label: 'In Qty', render: (row) => number(row.inQty || 0).toFixed(3) },
              { key: 'outQty', label: 'Out Qty', render: (row) => number(row.outQty || 0).toFixed(3) },
              { key: 'officeBalanceAfter', label: 'Balance', render: (row) => number(row.officeBalanceAfter || 0).toFixed(3) }
            ]}
          />
        </AppCard>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div style={sectionStyle}>
      <AppCard
        title={productFormVisible ? (productForm.id ? 'Edit Product' : 'Add Product') : 'Products / Chemicals Master'}
        action={(
          <AppButton variant="outline" size="sm" iconLeft={<Plus size={14} />} onClick={() => setProductFormVisible((prev) => !prev)}>
            {productFormVisible ? 'Hide Form' : 'New Product'}
          </AppButton>
        )}
      >
        {productFormVisible ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <StockFormGrid>
              <AppInput label="Product name" value={productForm.productName} onChange={(e) => setProductForm((prev) => ({ ...prev, productName: e.target.value }))} />
              <AppInput label="Product code / SKU" value={productForm.productCode} onChange={(e) => setProductForm((prev) => ({ ...prev, productCode: e.target.value }))} />
              <AppSelect label="Category" value={productForm.categoryId} onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
                {categoryOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
              </AppSelect>
              <AppSelect label="Unit" value={productForm.unit} onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))}>
                <option value="">Select unit</option>
                {safeRows(options.units).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </AppSelect>
              <AppInput label="Opening stock" type="number" step="0.001" value={productForm.openingStock} onChange={(e) => setProductForm((prev) => ({ ...prev, openingStock: e.target.value }))} />
              <AppInput label="Minimum stock" type="number" step="0.001" value={productForm.minStockLevel} onChange={(e) => setProductForm((prev) => ({ ...prev, minStockLevel: e.target.value }))} />
              <AppInput label="Purchase rate" type="number" step="0.01" value={productForm.purchaseRate} onChange={(e) => setProductForm((prev) => ({ ...prev, purchaseRate: e.target.value }))} />
              <AppInput label="Internal rate" type="number" step="0.01" value={productForm.internalRate} onChange={(e) => setProductForm((prev) => ({ ...prev, internalRate: e.target.value }))} />
              <AppSelect label="Default vendor" value={productForm.defaultVendorId} onChange={(e) => setProductForm((prev) => ({ ...prev, defaultVendorId: e.target.value }))}>
                {vendorOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
              </AppSelect>
              <AppInput label="Batch number" value={productForm.batchNumber} onChange={(e) => setProductForm((prev) => ({ ...prev, batchNumber: e.target.value }))} />
              <AppInput label="Expiry date" type="date" value={productForm.expiryDate} onChange={(e) => setProductForm((prev) => ({ ...prev, expiryDate: e.target.value }))} />
              <AppInput label="Storage location" value={productForm.storageLocation} onChange={(e) => setProductForm((prev) => ({ ...prev, storageLocation: e.target.value }))} />
              <AppSelect label="Active" value={productForm.active ? '1' : '0'} onChange={(e) => setProductForm((prev) => ({ ...prev, active: e.target.value === '1' }))}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </AppSelect>
            </StockFormGrid>
            <AppTextarea label="Description" value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AppButton loading={saving === 'product'} onClick={submitProduct}>{productForm.id ? 'Update Product' : 'Save Product'}</AppButton>
              <AppButton variant="outline" onClick={resetProductForm}>Reset</AppButton>
            </div>
          </div>
        ) : null}
      </AppCard>

      <AppCard title="Product List">
        <DataTable
          minWidth={1400}
          rows={products}
          emptyTitle="No products found"
          emptyMessage="Add your first stock item to begin tracking office and technician stock."
          columns={[
            { key: 'productCode', label: 'SKU' },
            { key: 'productName', label: 'Product' },
            { key: 'categoryName', label: 'Category' },
            { key: 'unit', label: 'Unit' },
            { key: 'openingStock', label: 'Opening', render: (row) => number(row.openingStock || 0).toFixed(3) },
            { key: 'currentStock', label: 'Current', render: (row) => number(row.currentStock || 0).toFixed(3) },
            { key: 'minStockLevel', label: 'Min', render: (row) => number(row.minStockLevel || 0).toFixed(3) },
            { key: 'purchaseRate', label: 'Purchase Rate', render: (row) => money(row.purchaseRate || 0) },
            { key: 'defaultVendorName', label: 'Vendor' },
            { key: 'status', label: 'Status', render: (row) => <MovementBadge value={row.status} /> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <AppButton variant="outline" size="sm" style={smallButtonStyle} iconLeft={<Pencil size={14} />} onClick={() => beginEditProduct(row)}>Edit</AppButton>
                  <AppButton variant="danger" size="sm" style={smallButtonStyle} iconLeft={<Trash2 size={14} />} loading={saving === 'product-delete'} onClick={() => deleteProduct(row.id)}>Delete</AppButton>
                </div>
              )
            }
          ]}
        />
      </AppCard>
    </div>
  );

  const selectedProduct = pickProduct(purchaseForm.productId);
  const selectedIssueProduct = pickProduct(issueForm.productId);
  const selectedUsageProduct = pickProduct(usageForm.productId);
  const selectedReturnProduct = pickProduct(returnForm.productId);
  const selectedAdjustProduct = pickProduct(adjustmentForm.productId);

  const renderPurchase = () => (
    <div style={sectionStyle}>
      <AppCard title="Purchase Entry">
        <StockFormGrid>
          <AppSelect label="Vendor" value={purchaseForm.vendorId} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, vendorId: e.target.value }))}>
            {vendorOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Purchase date" type="date" value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, purchaseDate: e.target.value }))} />
          <AppInput label="Invoice number" value={purchaseForm.invoiceNumber} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))} />
          <AppSelect label="Product" value={purchaseForm.productId} onChange={(e) => {
            const productId = e.target.value;
            const product = pickProduct(productId);
            setPurchaseForm((prev) => ({
              ...prev,
              productId,
              unit: product?.unit || prev.unit,
              rate: product?.purchaseRate ? String(product.purchaseRate) : prev.rate
            }));
          }}>
            {productOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Quantity" type="number" step="0.001" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          <AppSelect label="Unit" value={purchaseForm.unit} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, unit: e.target.value }))}>
            {unitOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Rate" type="number" step="0.01" value={purchaseForm.rate} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, rate: e.target.value }))} />
          <AppInput label="GST %" type="number" step="0.01" value={purchaseForm.gstPercent} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, gstPercent: e.target.value }))} />
          <AppInput label="Total amount" type="number" step="0.01" value={purchaseForm.totalAmount} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, totalAmount: e.target.value }))} />
          <AppInput label="Batch number" value={purchaseForm.batchNumber} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, batchNumber: e.target.value }))} />
          <AppInput label="Expiry date" type="date" value={purchaseForm.expiryDate} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, expiryDate: e.target.value }))} />
        </StockFormGrid>
        <div style={{ marginTop: 12 }}>
          <AppTextarea label="Notes" value={purchaseForm.notes} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <AppButton loading={saving === 'purchase'} iconLeft={<ShoppingCart size={14} />} onClick={submitPurchase}>Save Purchase</AppButton>
          <AppButton variant="outline" onClick={() => setPurchaseForm(initialPurchaseForm())}>Reset</AppButton>
        </div>
      </AppCard>
      <AppCard title="Purchase History">
        <DataTable
          minWidth={1300}
          rows={purchases}
          emptyTitle="No purchase records"
          emptyMessage="Purchase transactions will appear here after saving your first vendor entry."
          columns={[
            { key: 'purchaseDate', label: 'Date' },
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'vendorName', label: 'Vendor' },
            { key: 'productName', label: 'Product' },
            { key: 'quantity', label: 'Qty', render: (row) => number(row.quantity || 0).toFixed(3) },
            { key: 'unit', label: 'Unit' },
            { key: 'rate', label: 'Rate', render: (row) => money(row.rate || 0) },
            { key: 'gstPercent', label: 'GST %', render: (row) => percent(row.gstPercent || 0) },
            { key: 'totalAmount', label: 'Total', render: (row) => money(row.totalAmount || 0) },
            { key: 'batchNumber', label: 'Batch' },
            { key: 'expiryDate', label: 'Expiry' }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderIssue = () => (
    <div style={sectionStyle}>
      <AppCard title="Issue Form">
        <StockFormGrid>
          <AppSelect label="Technician" value={issueForm.technicianId} onChange={(e) => setIssueForm((prev) => ({ ...prev, technicianId: e.target.value }))}>
            {technicianOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Issue date" type="date" value={issueForm.issueDate} onChange={(e) => setIssueForm((prev) => ({ ...prev, issueDate: e.target.value }))} />
          <AppSelect label="Product" value={issueForm.productId} onChange={(e) => {
            const productId = e.target.value;
            const product = pickProduct(productId);
            setIssueForm((prev) => ({
              ...prev,
              productId,
              unit: product?.unit || prev.unit
            }));
          }}>
            {productOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Quantity" type="number" step="0.001" value={issueForm.quantity} onChange={(e) => setIssueForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          <AppSelect label="Unit" value={issueForm.unit} onChange={(e) => setIssueForm((prev) => ({ ...prev, unit: e.target.value }))}>
            {unitOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Customer" value={issueForm.customerId} onChange={(e) => setIssueForm((prev) => ({ ...prev, customerId: e.target.value }))}>
            {customerOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Contract / job" value={issueForm.contractId} onChange={(e) => setIssueForm((prev) => ({ ...prev, contractId: e.target.value }))} />
          <AppInput label="Job ID" value={issueForm.jobId} onChange={(e) => setIssueForm((prev) => ({ ...prev, jobId: e.target.value }))} />
        </StockFormGrid>
        <div style={{ marginTop: 12 }}>
          <AppTextarea label="Notes" value={issueForm.notes} onChange={(e) => setIssueForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <AppButton loading={saving === 'issue'} iconLeft={<ShoppingCart size={14} />} onClick={submitIssue}>Issue Stock</AppButton>
          <AppButton variant="outline" onClick={() => setIssueForm(initialIssueForm())}>Reset</AppButton>
        </div>
      </AppCard>
      <AppCard title="Issue History">
        <DataTable
          minWidth={1200}
          rows={issues}
          emptyTitle="No issue records"
          emptyMessage="Issue entries will appear after stock is issued to technicians."
          columns={[
            { key: 'issueDate', label: 'Date' },
            { key: 'technicianName', label: 'Technician' },
            { key: 'productName', label: 'Product' },
            { key: 'quantity', label: 'Qty', render: (row) => number(row.quantity || 0).toFixed(3) },
            { key: 'unit', label: 'Unit' },
            { key: 'customerName', label: 'Customer' },
            { key: 'contractId', label: 'Contract' },
            { key: 'jobId', label: 'Job' },
            { key: 'notes', label: 'Notes' }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderTechnicianStock = () => (
    <div style={sectionStyle}>
      <AppCard title="Technician Stock Balances">
        <DataTable
          minWidth={1420}
          rows={technicianStockRows}
          emptyTitle="No technician stock yet"
          emptyMessage="Issue stock to a technician to start seeing balances here."
          columns={[
            { key: 'technicianName', label: 'Technician' },
            { key: 'productName', label: 'Product' },
            { key: 'issuedQuantity', label: 'Issued Qty', render: (row) => number(row.issuedQuantity || 0).toFixed(3) },
            { key: 'usedQuantity', label: 'Used Qty', render: (row) => number(row.usedQuantity || 0).toFixed(3) },
            { key: 'returnedQuantity', label: 'Returned Qty', render: (row) => number(row.returnedQuantity || 0).toFixed(3) },
            { key: 'wastedQuantity', label: 'Wasted/Damaged Qty', render: (row) => number(row.wastedQuantity || 0).toFixed(3) },
            { key: 'currentBalance', label: 'Current Balance', render: (row) => number(row.currentBalance || 0).toFixed(3) },
            { key: 'unit', label: 'Unit' }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderUsage = () => (
    <div style={sectionStyle}>
      <AppCard title="Usage Entry">
        <StockFormGrid>
          <AppSelect label="Technician" value={usageForm.technicianId} onChange={(e) => setUsageForm((prev) => ({ ...prev, technicianId: e.target.value }))}>
            {technicianOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Usage date" type="date" value={usageForm.usageDate} onChange={(e) => setUsageForm((prev) => ({ ...prev, usageDate: e.target.value }))} />
          <AppSelect label="Product" value={usageForm.productId} onChange={(e) => {
            const productId = e.target.value;
            const product = pickProduct(productId);
            setUsageForm((prev) => ({
              ...prev,
              productId,
              unit: product?.unit || prev.unit
            }));
          }}>
            {productOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Quantity used" type="number" step="0.001" value={usageForm.quantityUsed} onChange={(e) => setUsageForm((prev) => ({ ...prev, quantityUsed: e.target.value }))} />
          <AppSelect label="Unit" value={usageForm.unit} onChange={(e) => setUsageForm((prev) => ({ ...prev, unit: e.target.value }))}>
            {unitOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Customer" value={usageForm.customerId} onChange={(e) => setUsageForm((prev) => ({ ...prev, customerId: e.target.value }))}>
            {customerOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Contract / job" value={usageForm.contractId} onChange={(e) => setUsageForm((prev) => ({ ...prev, contractId: e.target.value }))} />
          <AppInput label="Job ID" value={usageForm.jobId} onChange={(e) => setUsageForm((prev) => ({ ...prev, jobId: e.target.value }))} />
          <AppInput label="Service type" value={usageForm.serviceType} onChange={(e) => setUsageForm((prev) => ({ ...prev, serviceType: e.target.value }))} />
        </StockFormGrid>
        <div style={{ marginTop: 12 }}>
          <AppTextarea label="Notes" value={usageForm.notes} onChange={(e) => setUsageForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <AppButton loading={saving === 'usage'} iconLeft={<TrendingUp size={14} />} onClick={submitUsage}>Save Usage</AppButton>
          <AppButton variant="outline" onClick={() => setUsageForm(initialUsageForm())}>Reset</AppButton>
        </div>
      </AppCard>
      <AppCard title="Usage History">
        <DataTable
          minWidth={1200}
          rows={usage}
          emptyTitle="No usage records"
          emptyMessage="Used stock at customer site will appear here after saving a usage entry."
          columns={[
            { key: 'usageDate', label: 'Date' },
            { key: 'technicianName', label: 'Technician' },
            { key: 'productName', label: 'Product' },
            { key: 'quantityUsed', label: 'Qty', render: (row) => number(row.quantityUsed || row.quantity_used || 0).toFixed(3) },
            { key: 'unit', label: 'Unit' },
            { key: 'customerName', label: 'Customer' },
            { key: 'serviceType', label: 'Service Type' },
            { key: 'notes', label: 'Notes' }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderReturns = () => (
    <div style={sectionStyle}>
      <AppCard title="Return / Wastage / Damage Entry">
        <StockFormGrid>
          <AppSelect label="Technician" value={returnForm.technicianId} onChange={(e) => setReturnForm((prev) => ({ ...prev, technicianId: e.target.value }))}>
            {technicianOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Return date" type="date" value={returnForm.returnDate} onChange={(e) => setReturnForm((prev) => ({ ...prev, returnDate: e.target.value }))} />
          <AppSelect label="Product" value={returnForm.productId} onChange={(e) => {
            const productId = e.target.value;
            const product = pickProduct(productId);
            setReturnForm((prev) => ({ ...prev, productId, unit: product?.unit || prev.unit }));
          }}>
            {productOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppInput label="Quantity" type="number" step="0.001" value={returnForm.quantity} onChange={(e) => setReturnForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          <AppSelect label="Unit" value={returnForm.unit} onChange={(e) => setReturnForm((prev) => ({ ...prev, unit: e.target.value }))}>
            {unitOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Return type" value={returnForm.returnType} onChange={(e) => setReturnForm((prev) => ({ ...prev, returnType: e.target.value }))}>
            <option value="return_to_office">Return to office</option>
            <option value="wastage">Wastage</option>
            <option value="damage">Damage</option>
            <option value="expired">Expired</option>
          </AppSelect>
          <AppSelect label="Source location" value={returnForm.sourceLocation} onChange={(e) => setReturnForm((prev) => ({ ...prev, sourceLocation: e.target.value }))}>
            <option value="technician">Technician</option>
            <option value="office">Office</option>
          </AppSelect>
          <AppInput label="Reason" value={returnForm.reason} onChange={(e) => setReturnForm((prev) => ({ ...prev, reason: e.target.value }))} />
        </StockFormGrid>
        <div style={{ marginTop: 12 }}>
          <AppTextarea label="Notes" value={returnForm.notes} onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <AppButton loading={saving === 'return'} iconLeft={<RefreshCcw size={14} />} onClick={submitReturn}>Save Entry</AppButton>
          <AppButton variant="outline" onClick={() => setReturnForm(initialReturnForm())}>Reset</AppButton>
        </div>
      </AppCard>
      <AppCard title="Return / Wastage / Damage History">
        <DataTable
          minWidth={1280}
          rows={returnsRows}
          emptyTitle="No return records"
          emptyMessage="Return, wastage, damage, and expiry movements will appear here."
          columns={[
            { key: 'returnDate', label: 'Date' },
            { key: 'technicianName', label: 'Technician' },
            { key: 'productName', label: 'Product' },
            { key: 'quantity', label: 'Qty', render: (row) => number(row.quantity || 0).toFixed(3) },
            { key: 'unit', label: 'Unit' },
            { key: 'returnType', label: 'Type', render: (row) => <MovementBadge value={row.returnType} /> },
            { key: 'sourceLocation', label: 'Source' },
            { key: 'reason', label: 'Reason' },
            { key: 'notes', label: 'Notes' }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderLowStock = () => (
    <div style={sectionStyle}>
      <AppCard title="Low Stock Alert">
        <DataTable
          minWidth={1350}
          rows={lowStockRows}
          emptyTitle="No low stock alert"
          emptyMessage="All items are currently above the low stock threshold or expiry alert window."
          columns={[
            { key: 'productName', label: 'Product' },
            { key: 'categoryName', label: 'Category' },
            { key: 'unit', label: 'Unit' },
            { key: 'currentStock', label: 'Current', render: (row) => number(row.currentStock || 0).toFixed(3) },
            { key: 'minStockLevel', label: 'Minimum', render: (row) => number(row.minStockLevel || 0).toFixed(3) },
            { key: 'expiryDate', label: 'Expiry Date' },
            { key: 'status', label: 'Status', render: (row) => <MovementBadge value={row.status} /> }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderLedger = () => (
    <div style={sectionStyle}>
      <AppCard title="Ledger Filters" action={<AppButton variant="outline" size="sm" iconLeft={<Filter size={14} />} onClick={() => loadLedger(ledgerFilters)}>Apply Filters</AppButton>}>
        <StockFormGrid>
          <AppInput label="Start date" type="date" value={ledgerFilters.startDate} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
          <AppInput label="End date" type="date" value={ledgerFilters.endDate} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
          <AppSelect label="Product" value={ledgerFilters.productId} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, productId: e.target.value }))}>
            {productOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Category" value={ledgerFilters.categoryId} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, categoryId: e.target.value }))}>
            {categoryOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Vendor" value={ledgerFilters.vendorId} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, vendorId: e.target.value }))}>
            {vendorOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Technician" value={ledgerFilters.technicianId} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, technicianId: e.target.value }))}>
            {technicianOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Customer" value={ledgerFilters.customerId} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, customerId: e.target.value }))}>
            {customerOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Movement type" value={ledgerFilters.movementType} onChange={(e) => setLedgerFilters((prev) => ({ ...prev, movementType: e.target.value }))}>
            <option value="">All movements</option>
            <option value="opening">Opening</option>
            <option value="purchase">Purchase</option>
            <option value="issue">Issue</option>
            <option value="usage">Usage</option>
            <option value="return">Return</option>
            <option value="wastage">Wastage</option>
            <option value="damage">Damage</option>
            <option value="expired">Expired</option>
            <option value="adjustment">Adjustment</option>
          </AppSelect>
        </StockFormGrid>
      </AppCard>
      <AppCard title="Stock Ledger">
        <DataTable
          minWidth={1500}
          rows={ledgerRows}
          emptyTitle="No ledger entries"
          emptyMessage="Every stock movement will appear here as an auditable trail."
          columns={[
            { key: 'movementDate', label: 'Date' },
            { key: 'productName', label: 'Product' },
            { key: 'movementType', label: 'Movement', render: (row) => <MovementBadge value={row.movementType} /> },
            { key: 'inQty', label: 'In Qty', render: (row) => number(row.inQty || 0).toFixed(3) },
            { key: 'outQty', label: 'Out Qty', render: (row) => number(row.outQty || 0).toFixed(3) },
            { key: 'officeBalanceAfter', label: 'Office Balance', render: (row) => number(row.officeBalanceAfter || 0).toFixed(3) },
            { key: 'technicianBalanceAfter', label: 'Tech Balance', render: (row) => number(row.technicianBalanceAfter || 0).toFixed(3) },
            { key: 'sourceType', label: 'Source' },
            { key: 'technicianName', label: 'Technician' },
            { key: 'vendorName', label: 'Vendor' },
            { key: 'customerName', label: 'Customer' },
            { key: 'notes', label: 'Notes' }
          ]}
        />
      </AppCard>
    </div>
  );

  const renderReports = () => (
    <div style={sectionStyle}>
      <AppCard title="Report Filters" action={<AppButton variant="outline" size="sm" iconLeft={<Filter size={14} />} onClick={() => loadReport(reportFilters)}>Run Report</AppButton>}>
        <StockFormGrid>
          <AppSelect label="Report type" value={reportFilters.reportType} onChange={(e) => setReportFilters((prev) => ({ ...prev, reportType: e.target.value }))}>
            <option value="current-stock">Current Stock</option>
            <option value="purchase">Purchase Report</option>
            <option value="issue">Technician Issue Report</option>
            <option value="usage">Usage Report</option>
            <option value="wastage">Wastage Report</option>
            <option value="damage">Damage Report</option>
            <option value="expiry">Expiry Report</option>
            <option value="ledger">Product Ledger Report</option>
          </AppSelect>
          <AppInput label="Start date" type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
          <AppInput label="End date" type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
          <AppSelect label="Product" value={reportFilters.productId} onChange={(e) => setReportFilters((prev) => ({ ...prev, productId: e.target.value }))}>
            {productOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Vendor" value={reportFilters.vendorId} onChange={(e) => setReportFilters((prev) => ({ ...prev, vendorId: e.target.value }))}>
            {vendorOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
          <AppSelect label="Technician" value={reportFilters.technicianId} onChange={(e) => setReportFilters((prev) => ({ ...prev, technicianId: e.target.value }))}>
            {technicianOptions.map((option) => <option key={option.value || option.label} value={option.value}>{option.label}</option>)}
          </AppSelect>
        </StockFormGrid>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <AppButton iconLeft={<Download size={14} />} onClick={() => window.open(downloadExportUrl({ reportType: reportFilters.reportType, format: 'excel', params: reportFilters }), '_blank', 'noopener,noreferrer')}>Excel Export</AppButton>
          <AppButton variant="outline" iconLeft={<FileDown size={14} />} onClick={() => window.open(downloadExportUrl({ reportType: reportFilters.reportType, format: 'pdf', params: reportFilters }), '_blank', 'noopener,noreferrer')}>PDF Export</AppButton>
        </div>
      </AppCard>

      <div style={grid3}>
        <DashboardStatCard title="Rows" value={number(reportSummary.totalRows || 0)} icon={<BarChart3 size={18} />} />
        <DashboardStatCard title="Total Value" value={moneyOrDash(reportSummary.totalValue || 0)} icon={<CircleDollarSign size={18} />} />
        <DashboardStatCard title="Report Type" value={String(reportFetchedType || 'current-stock')} icon={<FileDown size={18} />} />
      </div>

      <AppCard title="Report Rows">
        <DataTable
          minWidth={1300}
          rows={reportRows}
          emptyTitle="No report rows"
          emptyMessage="Run a report after selecting filters."
          columns={[
            { key: 'movementDate', label: 'Date', render: (row) => row.purchaseDate || row.issueDate || row.usageDate || row.returnDate || row.movementDate || row.adjustmentDate || '-' },
            { key: 'productName', label: 'Product' },
            { key: 'movement_type', label: 'Movement', render: (row) => row.movementType || row.returnType || row.adjustmentType || '-' },
            { key: 'quantity', label: 'Quantity', render: (row) => number(row.quantity || row.quantity_used || row.quantityUsed || row.currentStock || 0).toFixed(3) },
            { key: 'unit', label: 'Unit', render: (row) => row.unit || '-' },
            { key: 'vendorName', label: 'Vendor', render: (row) => row.vendorName || row.vendor_name || '-' },
            { key: 'technicianName', label: 'Technician', render: (row) => row.technicianName || row.technician_name || '-' },
            { key: 'status', label: 'Status', render: (row) => <MovementBadge value={row.status || row.returnType || row.movementType || 'Info'} /> }
          ]}
        />
      </AppCard>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title={currentView.title}
        subtitle={currentView.subtitle}
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="outline" iconLeft={<RefreshCcw size={14} />} onClick={refresh}>Refresh</AppButton>
            {view === 'reports' ? (
              <AppButton iconLeft={<Download size={14} />} onClick={() => window.open(downloadExportUrl({ reportType: reportFilters.reportType, format: 'excel', params: reportFilters }), '_blank', 'noopener,noreferrer')}>Export</AppButton>
            ) : null}
          </div>
        )}
      />

      <div style={topNavStyle}>
        {menuItems.map((item) => (
          <Link key={item.path} to={item.path} style={topNavItemStyle(view === item.view)}>
            {item.label}
          </Link>
        ))}
      </div>

      {error ? (
        <AppCard>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--color-danger)' }}>
            <AlertCircle size={18} />
            <div style={{ display: 'grid', gap: 4 }}>
              <strong>Unable to load stock data</strong>
              <span style={{ color: 'var(--color-muted)' }}>{error}</span>
            </div>
          </div>
        </AppCard>
      ) : null}

      {loading ? (
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <LoadingSpinner />
          </div>
        </AppCard>
      ) : null}

      {!loading ? (
        <>
          {view === 'dashboard' ? renderDashboard() : null}
          {view === 'products' ? renderProducts() : null}
          {view === 'purchase' ? renderPurchase() : null}
          {view === 'issue' ? renderIssue() : null}
          {view === 'technicianStock' ? renderTechnicianStock() : null}
          {view === 'usage' ? renderUsage() : null}
          {view === 'returns' ? renderReturns() : null}
          {view === 'lowStock' ? renderLowStock() : null}
          {view === 'vendorReport' ? renderReports() : null}
          {view === 'ledger' ? renderLedger() : null}
          {view === 'reports' ? renderReports() : null}
        </>
      ) : null}
    </div>
  );
}
