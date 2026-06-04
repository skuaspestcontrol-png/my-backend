import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, Settings, X } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ITEMS_PER_PAGE = 20;
const VISIBLE_COLUMNS_STORAGE_KEY = 'items_visible_columns_v2';
const ITEMS_DASHBOARD_CACHE_KEY = 'items_dashboard_cache_v1';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'hsnSac', label: 'HSN/SAC' },
  { key: 'rate', label: 'Rate' },
  { key: 'purchaseDescription', label: 'Purchase Description' },
  { key: 'purchaseRate', label: 'Purchase Rate' },
  { key: 'unit', label: 'Unit' },
  { key: 'itemType', label: 'Type' }
];

const units = [
  { value: 'pcs', label: 'pcs' },
  { value: 'box', label: 'box' },
  { value: 'ltr', label: 'ltr' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'num', label: 'Number' }
];
const taxPreferences = ['Taxable', 'Non-Taxable'];
const salesAccounts = ['Sales', 'Service Income', 'Other Income'];
const purchaseAccounts = ['Cost of Goods Sold', 'Purchases', 'Direct Expenses'];
const preferredVendors = ['No vendor', 'Vendor A', 'Vendor B'];
const taxRateOptions = ['18%'];
const defaultColumnWidths = {
  name: 220,
  description: 360,
  hsnSac: 140,
  rate: 120,
  purchaseDescription: 240,
  purchaseRate: 140,
  unit: 90,
  itemType: 100
};
const itemColumnResizeBounds = {
  name: { min: 180, max: 360 },
  description: { min: 260, max: 560 },
  hsnSac: { min: 110, max: 180 },
  rate: { min: 100, max: 160 },
  purchaseDescription: { min: 180, max: 420 },
  purchaseRate: { min: 110, max: 180 },
  unit: { min: 80, max: 120 },
  itemType: { min: 90, max: 140 }
};
const defaultVisibleColumns = ['name', 'description', 'hsnSac'];

const emptyForm = {
  itemType: 'service',
  name: '',
  aboutPest: '',
  pestsCovered: '',
  serviceDescription: '',
  frequency: '',
  whatWeDo: '',
  unit: 'pcs',
  sac: '',
  taxPreference: 'Taxable',
  sellable: true,
  purchasable: true,
  sellingPrice: '',
  salesAccount: 'Sales',
  salesDescription: '',
  costPrice: '',
  purchaseAccount: 'Cost of Goods Sold',
  purchaseInfoDescription: '',
  preferredVendor: 'No vendor',
  intraTaxRate: '18%',
  interTaxRate: '18%'
};

const shell = {
  page: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.94) 100%)',
    border: '1px solid var(--color-border)',
    borderRadius: '20px',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    backgroundClip: 'padding-box'
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 18px',
    borderBottom: '1px solid var(--brand-border-color)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    backgroundClip: 'padding-box'
  },
  titleWrap: { display: 'grid', gap: '2px', minWidth: 0 },
  titleLine: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  title: { margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  topActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  buttonPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid var(--color-primary-dark)',
    borderRadius: '10px',
    minHeight: '34px',
    height: '34px',
    padding: '0 14px',
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px'
  },
  buttonGhost: {
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#111827',
    borderRadius: '12px',
    width: '48px',
    height: '48px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  toolbar: {
    padding: '12px 18px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    background: '#fff',
    backgroundClip: 'padding-box'
  },
  toolLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    lineHeight: 1.1
  },
  customizeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--color-primary-soft)',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary-dark)',
    borderRadius: '10px',
    width: '34px',
    height: '34px',
    minWidth: '34px',
    minHeight: '34px',
    padding: 0,
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)'
  },
  tableWrap: {
    overflowX: 'auto',
    overflowY: 'hidden',
    background: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: '16px',
    backgroundClip: 'padding-box'
  },
  table: { width: '100%', minWidth: '820px', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  headCell: {
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: 700,
    color: '#6b7280',
    padding: '2px 10px',
    borderBottom: '1px solid var(--color-border)',
    textTransform: 'uppercase',
    position: 'relative',
    lineHeight: 1.05,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minHeight: '22px' },
  headerLabelButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 'inherit',
    textTransform: 'inherit',
    cursor: 'pointer'
  },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '7px 10px', fontSize: '12px', fontWeight: 400, color: '#334155', verticalAlign: 'middle', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nameCell: { color: 'var(--color-primary)', fontWeight: 700 },
  checkboxWrap: { width: '40px', textAlign: 'center', paddingTop: '2px', paddingBottom: '2px' },
  checkbox: { width: '15px', height: '15px', accentColor: 'var(--color-primary)' },
  menu: {
    position: 'absolute',
    right: 0,
    top: '44px',
    background: '#fff',
    border: '1px solid rgba(239, 68, 68, 0.14)',
    borderRadius: '12px',
    minWidth: '170px',
    boxShadow: '0 14px 32px rgba(15,23,42,0.12)',
    zIndex: 20,
    overflow: 'hidden'
  },
  menuButton: {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: '#fff',
    cursor: 'pointer',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  popover: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    background: '#fff',
    border: '1px solid var(--color-primary-soft)',
    borderRadius: '12px',
    boxShadow: '0 14px 30px rgba(15,23,42,0.12)',
    width: '300px',
    zIndex: 40
  },
  popoverHeader: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border)',
    fontWeight: 800,
    fontSize: '12px',
    color: '#334155'
  },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.45)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 3000,
    padding: 'clamp(12px, 3vh, 24px)',
    overflowY: 'auto',
    backdropFilter: 'blur(12px)',
    WebkitOverflowScrolling: 'touch'
  },
  modal: {
    background: '#fff',
    width: 'min(100%, 760px)',
    borderRadius: '24px',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow)',
    height: 'min(92vh, calc(100dvh - 24px))',
    maxHeight: 'min(92vh, calc(100dvh - 24px))',
    overflow: 'hidden',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    flexShrink: 0,
    padding: '16px 20px',
    borderBottom: '1px solid var(--brand-border-color)',
    fontSize: '18px',
    fontWeight: 800,
    color: '#fff',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px'
  },
  modalHeaderTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  modalCloseButton: {
    border: 'none',
    background: 'transparent',
    color: '#fff',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  formContent: {
    padding: '10px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: '1 1 auto',
    overflowX: 'hidden',
    overflowY: 'auto',
    minHeight: 0,
    background: '#fff',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain'
  },
  topGrid: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', columnGap: '8px', rowGap: '8px', alignItems: 'center' },
  typeRadios: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#111827' },
  sectionSplit: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' },
  sectionTitle: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  sectionFields: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', columnGap: '8px', rowGap: '8px', alignItems: 'center' },
  label: { fontSize: '12px', color: '#111827' },
  requiredLabel: { color: '#dc2626' },
  input: {
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '12px',
    outline: 'none',
    width: '100%'
  },
  textArea: {
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    minHeight: '58px',
    resize: 'vertical'
  },
  amountRow: { display: 'grid', gridTemplateColumns: '60px 1fr', gap: '0' },
  currencyTag: {
    border: '1px solid var(--color-border)',
    borderRight: 'none',
    borderRadius: '8px 0 0 8px',
    padding: '8px 10px',
    fontSize: '13px',
    color: '#334155',
    background: '#f8fafc'
  },
  amountInput: {
    border: '1px solid #D1D5DB',
    borderRadius: '0 8px 8px 0',
    padding: '8px 10px',
    fontSize: '13px',
    outline: 'none',
    width: '100%'
  },
  taxPanel: {
    borderTop: '1px solid var(--color-border)',
    paddingTop: '12px',
    display: 'grid',
    gridTemplateColumns: '140px minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'center'
  },
  modalFooter: {
    flexShrink: 0,
    padding: '10px 12px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    background: '#fff'
  },
  cancelButton: {
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#334155',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  saveButton: {
    border: 'none',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  pagination: {
    padding: '9px 12px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#475569',
    background: '#fff',
    backgroundClip: 'padding-box'
  },
  paginationInfo: { fontSize: '12px', color: '#475569', fontWeight: 700 },
  pageButton: {
    border: '1px solid var(--color-border)',
    background: '#fff',
    color: '#334155',
    borderRadius: '8px',
    width: '34px',
    minWidth: '34px',
    minHeight: '32px',
    padding: 0,
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

const formatINR = (value) => `₹${Number(value || 0).toFixed(2)}`;

const readItemsDashboardCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(ITEMS_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mergeItemsDashboardCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readItemsDashboardCache() || {};
    window.sessionStorage.setItem(ITEMS_DASHBOARD_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Cache is a best-effort performance hint.
  }
};

export default function ItemsDashboard() {
  const [cachedDashboard] = useState(() => readItemsDashboardCache());
  const [items, setItems] = useState(() => Array.isArray(cachedDashboard?.items) ? cachedDashboard.items : []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [nameSortDirection, setNameSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
    if (!saved) return defaultVisibleColumns;
    try {
      const parsed = JSON.parse(saved);
      const keys = columns.map((column) => column.key);
      const normalized = Array.isArray(parsed) ? parsed.filter((entry) => keys.includes(entry)) : [];
      return normalized.length > 0 ? normalized : defaultVisibleColumns;
    } catch {
      return defaultVisibleColumns;
    }
  });
  const [form, setForm] = useState(emptyForm);
  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreMenuButtonRef = useRef(null);
  const loadRequestRef = useRef(null);
  const {
    getColumnStyle,
    startResize,
    resetColumns: resetItemColumns
  } = useColumnResize({
    storageKey: 'items_column_widths',
    columns,
    defaultColumnWidths,
    columnBounds: itemColumnResizeBounds,
    minWidth: 90,
    enabled: !showAddModal
  });

  const visibleColumnDefs = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );
  const sortedItems = useMemo(() => {
    const direction = nameSortDirection === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }) * direction);
  }, [items, nameSortDirection]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedItems.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, sortedItems]);
  const pageStart = sortedItems.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, sortedItems.length);
  const paginationText = sortedItems.length ? `${pageStart}-${pageEnd} of ${sortedItems.length} records` : '0 records';

  const loadItems = async (options = {}) => {
    if (loadRequestRef.current) {
      if (options.force) {
        await loadRequestRef.current;
      } else {
        return loadRequestRef.current;
      }
    }
    const request = (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/items`);
        const nextItems = Array.isArray(res.data) ? res.data : [];
        setItems(nextItems);
        if (!options.preserveSelection) setSelectedIds([]);
        mergeItemsDashboardCache({ items: nextItems });
      } catch (error) {
        console.error('Failed to load items', error);
        if (!options.preserveSelection && !cachedDashboard) {
          setItems([]);
          setSelectedIds([]);
        }
      }
    })();
    loadRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (loadRequestRef.current === request) loadRequestRef.current = null;
    }
  };

  useEffect(() => {
    loadItems({ preserveSelection: true });
  }, [cachedDashboard]);

  useAutoRefresh(() => loadItems({ preserveSelection: true }), { enabled: !showAddModal });

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
  }, [totalPages]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;

      if (
        showCustomize &&
        customizePanelRef.current &&
        !customizePanelRef.current.contains(target) &&
        customizeButtonRef.current &&
        !customizeButtonRef.current.contains(target)
      ) {
        setShowCustomize(false);
      }

      if (
        showMoreMenu &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(target) &&
        moreMenuButtonRef.current &&
        !moreMenuButtonRef.current.contains(target)
      ) {
        setShowMoreMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowCustomize(false);
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCustomize, showMoreMenu]);

  const visibleItemIds = paginatedItems.map((item) => item._id).filter(Boolean);
  const isAllSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleItemIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleItemIds])));
  };

  const toggleSelectOne = (itemId) => {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnKey)) {
        if (prev.length === 1) return prev;
        return prev.filter((key) => key !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const updateForm = (key, value) => {
    setForm((prev) => {
      if (key !== 'itemType') {
        return { ...prev, [key]: value };
      }

      if (value === 'goods') {
        return {
          ...prev,
          itemType: value,
          aboutPest: '',
          pestsCovered: '',
          serviceDescription: '',
          frequency: '',
          whatWeDo: '',
          salesDescription: ''
        };
      }

      return {
        ...prev,
        itemType: value,
        purchaseInfoDescription: '',
        preferredVendor: 'No vendor'
      };
    });
  };

  const openNewItemForm = () => {
    setEditingItemId(null);
    setForm(emptyForm);
    setSaveError('');
    setShowAddModal(true);
  };

  const mapItemToForm = (item) => ({
    itemType: item.itemType || 'service',
    name: item.name || '',
    aboutPest: item.aboutPest ?? item.about_pest ?? item.serviceDescription ?? item.salesDescription ?? item.description ?? '',
    pestsCovered: item.pestsCovered || '',
    serviceDescription: item.serviceDescription ?? item.salesDescription ?? item.description ?? '',
    frequency: item.frequency ?? item.description ?? '',
    whatWeDo: item.whatWeDo ?? item.what_we_do ?? item.treatmentMethod ?? '',
    unit: item.unit || 'pcs',
    sac: item.sac || item.hsnSac || '',
    taxPreference: item.taxPreference || 'Taxable',
    sellable: item.sellable !== false,
    purchasable: item.purchasable !== false,
    sellingPrice: String(item.sellingPrice ?? item.rate ?? ''),
    salesAccount: item.salesAccount || 'Sales',
    salesDescription: item.salesDescription ?? item.description ?? '',
    costPrice: String(item.costPrice ?? item.purchaseRate ?? ''),
    purchaseAccount: item.purchaseAccount || 'Cost of Goods Sold',
    purchaseInfoDescription: item.purchaseInfoDescription ?? item.purchaseDescription ?? '',
    preferredVendor: item.preferredVendor || 'No vendor',
    intraTaxRate: item.intraTaxRate || '18%',
    interTaxRate: item.interTaxRate || '18%'
  });

  const openEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const selected = items.find((item) => item._id === selectedIds[0]);
    if (!selected) return;
    openEditItem(selected);
  };

  const openEditItem = (item) => {
    if (!item?._id) return;
    setEditingItemId(item._id);
    setForm(mapItemToForm(item));
    setSaveError('');
    setShowAddModal(true);
    setShowMoreMenu(false);
  };

  const handleAddItem = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const isServiceItem = form.itemType === 'service';
    const aboutPest = isServiceItem ? form.aboutPest.trim() : '';
    const pestsCovered = isServiceItem ? form.pestsCovered.trim() : '';
    const serviceDescription = isServiceItem ? form.serviceDescription.trim() : '';
    const frequency = isServiceItem ? form.frequency.trim() : '';
    const whatWeDo = isServiceItem ? form.whatWeDo.trim() : '';
    const salesDescription = form.salesDescription.trim() || frequency || serviceDescription;

    const payload = {
      itemType: form.itemType,
      name: form.name.trim(),
      aboutPest,
      pestsCovered,
      serviceDescription,
      frequency,
      whatWeDo,
      unit: form.unit,
      sac: form.sac.trim(),
      hsnSac: form.sac.trim(),
      taxPreference: form.taxPreference,
      sellable: form.sellable,
      purchasable: form.purchasable,
      rate: Number(form.sellingPrice || 0),
      sellingPrice: Number(form.sellingPrice || 0),
      salesAccount: form.salesAccount,
      description: frequency || salesDescription,
      salesDescription,
      purchaseRate: Number(form.costPrice || 0),
      costPrice: Number(form.costPrice || 0),
      purchaseAccount: form.purchaseAccount,
      purchaseDescription: form.purchaseInfoDescription.trim(),
      purchaseInfoDescription: form.purchaseInfoDescription.trim(),
      preferredVendor: form.preferredVendor,
      intraTaxRate: form.intraTaxRate,
      interTaxRate: form.interTaxRate
    };

    try {
      setIsSaving(true);
      setSaveError('');
      if (editingItemId) {
        await axios.put(`${API_BASE_URL}/api/items/${editingItemId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/items`, payload);
      }
      setForm(emptyForm);
      setEditingItemId(null);
      setShowAddModal(false);
      await loadItems({ preserveSelection: false, force: true });
    } catch (error) {
      console.error('Failed to add item', error);
      setSaveError('Unable to save item. Please ensure backend server is running.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map((id) => axios.delete(`${API_BASE_URL}/api/items/${id}`)));
      setShowMoreMenu(false);
      await loadItems({ preserveSelection: false, force: true });
    } catch (error) {
      console.error('Failed to delete selected items', error);
    }
  };

  const handleCellValue = (item, key) => {
    if (key === 'purchaseRate' || key === 'rate') return formatINR(item[key]);
    if (key === 'description') {
      return item.description || item.serviceDescription || item.salesDescription || item.purchaseDescription || '';
    }
    if (key === 'hsnSac') return item.hsnSac || item.sac || '';
    return item[key] || '';
  };
  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const isTiny = viewportWidth <= 380;
  const topbarStyle = isMobile
    ? { ...shell.topbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '10px 12px' : shell.topbar.padding }
    : shell.topbar;
  const topActionsStyle = isMobile ? { ...shell.topActions, width: '100%', justifyContent: 'space-between' } : shell.topActions;
  const tableStyle = isMobile
    ? { ...shell.table, minWidth: isTiny ? '700px' : '760px' }
    : isTablet
      ? { ...shell.table, minWidth: '920px' }
      : shell.table;
  const modalStyle = isMobile ? { ...shell.modal, width: 'min(100%, 96vw)', borderRadius: isTiny ? '14px' : shell.modal.borderRadius } : shell.modal;
  const topGridStyle = isMobile ? { ...shell.topGrid, gridTemplateColumns: '1fr' } : shell.topGrid;
  const sectionSplitStyle = isMobile ? { ...shell.sectionSplit, gridTemplateColumns: '1fr' } : shell.sectionSplit;
  const sectionFieldsStyle = isMobile ? { ...shell.sectionFields, gridTemplateColumns: '1fr' } : shell.sectionFields;
  const taxPanelStyle = isMobile ? { ...shell.taxPanel, gridTemplateColumns: '1fr' } : shell.taxPanel;
  const taxGridStyle = isMobile
    ? { display: 'grid', gridTemplateColumns: '1fr', rowGap: '8px', columnGap: '8px' }
    : { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', rowGap: '8px', columnGap: '8px' };
  const modalFooterStyle = isMobile ? { ...shell.modalFooter, flexWrap: 'wrap' } : shell.modalFooter;
  const titleStyle = isTiny ? { ...shell.title, fontSize: '24px' } : shell.title;
  const buttonPrimaryStyle = isTiny ? { ...shell.buttonPrimary, padding: '8px 12px', fontSize: '13px' } : shell.buttonPrimary;
  const toolbarIconButtonStyle = isTiny ? { ...shell.customizeButton, width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' } : shell.customizeButton;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const paginationStyle = isMobile ? { ...shell.pagination, flexDirection: 'column', alignItems: 'stretch' } : shell.pagination;
  const paginationActionsStyle = isMobile ? { display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' } : { display: 'inline-flex', alignItems: 'center', gap: '8px' };

  return (
    <section className="crm-page crm-section" style={shell.page}>
      <div style={topbarStyle}>
        <div style={shell.titleWrap}>
          <div style={shell.titleLine}>
            <h1 style={titleStyle}>All Items</h1>
            <ChevronDown size={20} color="var(--color-primary)" />
          </div>
          <span style={shell.toolLabel}>Item Master</span>
        </div>
        <div style={topActionsStyle}>
          <button type="button" style={buttonPrimaryStyle} onClick={openNewItemForm}>
            <Plus size={18} />
            New Item
          </button>
          <div style={{ position: 'relative' }}>
            <button
              ref={moreMenuButtonRef}
              type="button"
              style={toolbarIconButtonStyle}
              aria-label="More options"
              onClick={() => setShowMoreMenu((prev) => !prev)}
            >
              <MoreHorizontal size={14} />
            </button>
            {showMoreMenu ? (
              <div ref={moreMenuRef} style={shell.menu}>
                <button type="button" style={shell.menuButton} onClick={loadItems}>Refresh Items</button>
                <button
                  type="button"
                  style={{ ...shell.menuButton, opacity: selectedIds.length === 1 ? 1 : 0.45 }}
                  onClick={openEditSelected}
                >
                  Edit Selected
                </button>
                <button type="button" style={shell.menuButton} onClick={deleteSelected}>
                  Delete Selected ({selectedIds.length})
                </button>
              </div>
            ) : null}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              ref={customizeButtonRef}
              type="button"
              style={toolbarIconButtonStyle}
              aria-label="Customize fields"
              title="Customize fields"
              onClick={() => setShowCustomize((prev) => !prev)}
            >
              <Settings size={14} />
            </button>
            {showCustomize ? (
              <div ref={customizePanelRef} style={shell.popover}>
                <div style={shell.popoverHeader}>Table Columns</div>
                <div style={shell.popoverBody}>
                  <button
                    type="button"
                    style={{ ...shell.menuButton, border: '1px solid var(--color-border)', borderRadius: '8px', justifyContent: 'center' }}
                    onClick={() => {
                      setVisibleColumns(defaultVisibleColumns);
                      resetItemColumns();
                    }}
                  >
                    Reset Default Columns
                  </button>
                  {columns.map((column) => (
                    <label key={column.key} style={shell.popoverItem}>
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...shell.headCell, ...shell.checkboxWrap }}>
                <input type="checkbox" style={shell.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumnDefs.map((column) => (
                <th key={column.key} style={{ ...shell.headCell, ...getColumnStyle(column.key) }}>
                  <div style={shell.headerInner}>
                    {column.key === 'name' ? (
                      <button
                        type="button"
                        style={shell.headerLabelButton}
                        onClick={() => setNameSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        aria-label={`Sort name ${nameSortDirection === 'asc' ? 'descending' : 'ascending'}`}
                      >
                        <span>{column.label}</span>
                        {nameSortDirection === 'asc' ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
                      </button>
                    ) : (
                      <span>{column.label}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item._id || item.name} style={shell.row}>
                <td style={{ ...shell.cell, ...shell.checkboxWrap }}>
                  <input
                    type="checkbox"
                    style={shell.checkbox}
                    checked={selectedIds.includes(item._id)}
                    onChange={() => toggleSelectOne(item._id)}
                  />
                </td>
                {visibleColumnDefs.map((column) => (
                  <td
                    key={`${item._id || item.name}-${column.key}`}
                    style={
                      column.key === 'name'
                        ? {
                            ...shell.cell,
                            ...shell.nameCell,
                            ...getColumnStyle(column.key),
                            cursor: 'pointer'
                          }
                        : { ...shell.cell, ...getColumnStyle(column.key) }
                    }
                    onClick={column.key === 'name' ? () => item._id && setSelectedIds([item._id]) : undefined}
                    onDoubleClick={column.key === 'name' ? () => openEditItem(item) : undefined}
                    title={column.key === 'name' ? 'Double-click to edit' : undefined}
                  >
                    {handleCellValue(item, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={paginationStyle}>
          <div style={shell.paginationInfo}>{paginationText}</div>
          <div style={paginationActionsStyle}>
            <button
              type="button"
              style={{ ...shell.pageButton, opacity: currentPage === 1 ? 0.45 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              style={{ ...shell.pageButton, opacity: currentPage === totalPages ? 0.45 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {showAddModal ? createPortal(
        <div style={shell.modalOverlay}>
          <form className="crm-modal-surface" style={modalStyle} onSubmit={handleAddItem}>
            <div className="crm-modal-surface-header" style={modalHeaderStyle}>
              <h3 style={shell.modalHeaderTitle}>{editingItemId ? 'Edit Item' : 'New Item'}</h3>
              <button
                type="button"
                style={shell.modalCloseButton}
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItemId(null);
                  setSaveError('');
                  setForm(emptyForm);
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="crm-modal-surface-body" style={shell.formContent}>
              <div style={topGridStyle}>
                <label style={shell.label}>Type</label>
                <div style={shell.typeRadios}>
                  <label>
                    <input
                      type="radio"
                      name="itemType"
                      checked={form.itemType === 'goods'}
                      onChange={() => updateForm('itemType', 'goods')}
                    />{' '}
                    Goods
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="itemType"
                      checked={form.itemType === 'service'}
                      onChange={() => updateForm('itemType', 'service')}
                    />{' '}
                    Service
                  </label>
                </div>

                <label style={{ ...shell.label, ...shell.requiredLabel }}>Name*</label>
                <input style={shell.input} required value={form.name} onChange={(event) => updateForm('name', event.target.value)} />

                {form.itemType === 'service' ? (
                  <>
                    <label style={shell.label}>About Pest</label>
                    <textarea
                      style={shell.textArea}
                      value={form.aboutPest}
                      onChange={(event) => updateForm('aboutPest', event.target.value)}
                    />

                    <label style={shell.label}>Pests Covered</label>
                    <input
                      style={shell.input}
                      value={form.pestsCovered}
                      onChange={(event) => updateForm('pestsCovered', event.target.value)}
                    />

                    <label style={shell.label}>Service Description</label>
                    <textarea
                      style={shell.textArea}
                      value={form.serviceDescription}
                      onChange={(event) => updateForm('serviceDescription', event.target.value)}
                    />

                    <label style={shell.label}>Frequency</label>
                    <input
                      style={shell.input}
                      value={form.frequency}
                      onChange={(event) => updateForm('frequency', event.target.value)}
                    />

                    <label style={shell.label}>What We Do?</label>
                    <textarea
                      style={shell.textArea}
                      value={form.whatWeDo}
                      onChange={(event) => updateForm('whatWeDo', event.target.value)}
                    />
                  </>
                ) : null}

                <label style={shell.label}>Unit</label>
                <select style={shell.input} value={form.unit} onChange={(event) => updateForm('unit', event.target.value)}>
                  {units.map((unit) => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>

                <label style={shell.label}>SAC</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px', gap: '8px' }}>
                  <input style={shell.input} value={form.sac} onChange={(event) => updateForm('sac', event.target.value)} />
                  <button type="button" style={{ ...shell.buttonGhost, width: '36px', height: '36px' }} aria-label="Find SAC">
                    <Search size={16} color="var(--color-primary)" />
                  </button>
                </div>

                <label style={{ ...shell.label, ...shell.requiredLabel }}>Tax Preference*</label>
                <select style={shell.input} value={form.taxPreference} onChange={(event) => updateForm('taxPreference', event.target.value)}>
                  {taxPreferences.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div style={sectionSplitStyle}>
                <div>
                  <div style={shell.sectionHeader}>
                    <h3 style={shell.sectionTitle}>Sales Information</h3>
                    <label style={shell.checkLabel}>
                      <input type="checkbox" checked={form.sellable} onChange={(event) => updateForm('sellable', event.target.checked)} />
                      Sellable
                    </label>
                  </div>
                  <div style={sectionFieldsStyle}>
                    <label style={{ ...shell.label, ...shell.requiredLabel }}>Selling Price*</label>
                    <div style={shell.amountRow}>
                      <span style={shell.currencyTag}>INR</span>
                      <input
                        style={shell.amountInput}
                        type="number"
                        step="0.01"
                        value={form.sellingPrice}
                        onChange={(event) => updateForm('sellingPrice', event.target.value)}
                      />
                    </div>

                    <label style={{ ...shell.label, ...shell.requiredLabel }}>Account*</label>
                    <select style={shell.input} value={form.salesAccount} onChange={(event) => updateForm('salesAccount', event.target.value)}>
                      {salesAccounts.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>

                    <label style={shell.label}>Description</label>
                    <textarea
                      style={shell.textArea}
                      value={form.salesDescription}
                      onChange={(event) => updateForm('salesDescription', event.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div style={shell.sectionHeader}>
                    <h3 style={shell.sectionTitle}>Purchase Information</h3>
                    <label style={shell.checkLabel}>
                      <input type="checkbox" checked={form.purchasable} onChange={(event) => updateForm('purchasable', event.target.checked)} />
                      Purchasable
                    </label>
                  </div>
                  <div style={sectionFieldsStyle}>
                    <label style={{ ...shell.label, ...shell.requiredLabel }}>Cost Price*</label>
                    <div style={shell.amountRow}>
                      <span style={shell.currencyTag}>INR</span>
                      <input
                        style={shell.amountInput}
                        type="number"
                        step="0.01"
                        value={form.costPrice}
                        onChange={(event) => updateForm('costPrice', event.target.value)}
                      />
                    </div>

                    <label style={{ ...shell.label, ...shell.requiredLabel }}>Account*</label>
                    <select style={shell.input} value={form.purchaseAccount} onChange={(event) => updateForm('purchaseAccount', event.target.value)}>
                      {purchaseAccounts.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>

                    <label style={shell.label}>Description</label>
                    <textarea
                      style={shell.textArea}
                      value={form.purchaseInfoDescription}
                      onChange={(event) => updateForm('purchaseInfoDescription', event.target.value)}
                    />

                    <label style={shell.label}>Preferred Vendor</label>
                    <select style={shell.input} value={form.preferredVendor} onChange={(event) => updateForm('preferredVendor', event.target.value)}>
                      {preferredVendors.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={taxPanelStyle}>
                <h3 style={{ ...shell.sectionTitle, margin: 0 }}>Default Tax Rates</h3>
                <div style={taxGridStyle}>
                  <label style={shell.label}>Intra State Tax Rate</label>
                  <select style={shell.input} value={form.intraTaxRate} onChange={(event) => updateForm('intraTaxRate', event.target.value)}>
                    {taxRateOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>

                  <label style={shell.label}>Inter State Tax Rate</label>
                  <select style={shell.input} value={form.interTaxRate} onChange={(event) => updateForm('interTaxRate', event.target.value)}>
                    {taxRateOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="crm-modal-surface-footer" style={modalFooterStyle}>
              {saveError ? (
                <div style={{ marginRight: 'auto', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                  {saveError}
                </div>
              ) : null}
              <button
                type="button"
                style={shell.cancelButton}
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItemId(null);
                  setSaveError('');
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
              <button type="submit" style={shell.saveButton} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingItemId ? 'Update Item' : 'Save Item'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
