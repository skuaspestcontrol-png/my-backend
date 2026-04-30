import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { ChevronDown, MoreHorizontal, Plus, SlidersHorizontal, Search, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'purchaseDescription', label: 'Purchase Description' },
  { key: 'purchaseRate', label: 'Purchase Rate' },
  { key: 'description', label: 'Description' },
  { key: 'rate', label: 'Rate' },
  { key: 'hsnSac', label: 'HSN/SAC' }
];

const units = ['pcs', 'box', 'ltr', 'kg', 'ml'];
const taxPreferences = ['Taxable', 'Non-Taxable'];
const salesAccounts = ['Sales', 'Service Income', 'Other Income'];
const purchaseAccounts = ['Cost of Goods Sold', 'Purchases', 'Direct Expenses'];
const preferredVendors = ['No vendor', 'Vendor A', 'Vendor B'];
const taxRateOptions = ['18%'];
const defaultColumnWidths = {
  name: 220,
  purchaseDescription: 240,
  purchaseRate: 140,
  description: 240,
  rate: 120,
  hsnSac: 140
};

const emptyForm = {
  itemType: 'service',
  name: '',
  treatmentMethod: '',
  pestsCovered: '',
  serviceDescription: '',
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
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'visible',
    position: 'relative'
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 18px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-primary-light)'
  },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  title: { margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  topActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  buttonPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid var(--color-primary-dark)',
    borderRadius: '10px',
    padding: '9px 14px',
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
    background: '#fff'
  },
  toolLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  customizeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #c7d2fe',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary-dark)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', minWidth: '1100px', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  headCell: {
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 800,
    color: '#6b7280',
    padding: '12px 10px',
    borderBottom: '1px solid var(--color-border)',
    textTransform: 'uppercase',
    position: 'relative',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  resizeHandle: { width: '8px', cursor: 'col-resize', alignSelf: 'stretch', marginRight: '-10px', marginLeft: '8px' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '12px 10px', fontSize: '14px', color: '#111827', verticalAlign: 'top', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nameCell: { color: 'var(--color-primary)', fontWeight: 700 },
  checkboxWrap: { width: '40px', textAlign: 'center' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  menu: {
    position: 'absolute',
    right: 0,
    top: '44px',
    background: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
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
    backdropFilter: 'blur(12px)'
  },
  modal: {
    background: 'rgba(255,255,255,0.9)',
    width: 'min(100%, 760px)',
    borderRadius: '24px',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    boxShadow: 'var(--shadow)',
    maxHeight: '92vh',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(159, 23, 77, 0.16)',
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
  formContent: { padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '10px', overflowX: 'hidden' },
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
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '12px',
    outline: 'none',
    width: '100%'
  },
  textArea: {
    border: '1px solid #D1D5DB',
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
    border: '1px solid #D1D5DB',
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
    padding: '10px 12px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
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
  }
};

const formatINR = (value) => `₹${Number(value || 0).toFixed(2)}`;

export default function ItemsDashboard() {
  const [items, setItems] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('items_visible_columns');
    if (!saved) return columns.map((column) => column.key);
    try {
      const parsed = JSON.parse(saved);
      const keys = columns.map((column) => column.key);
      const normalized = Array.isArray(parsed) ? parsed.filter((entry) => keys.includes(entry)) : [];
      return normalized.length > 0 ? normalized : keys;
    } catch {
      return columns.map((column) => column.key);
    }
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('items_column_widths');
    if (!saved) return { ...defaultColumnWidths };
    try {
      const parsed = JSON.parse(saved);
      const next = { ...defaultColumnWidths };
      Object.keys(defaultColumnWidths).forEach((key) => {
        const n = Number(parsed?.[key]);
        if (Number.isFinite(n) && n >= 90) next[key] = n;
      });
      return next;
    } catch {
      return { ...defaultColumnWidths };
    }
  });
  const [form, setForm] = useState(emptyForm);
  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreMenuButtonRef = useRef(null);
  const resizeRef = useRef(null);

  const visibleColumnDefs = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );

  const loadItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/items`);
      setItems(Array.isArray(res.data) ? res.data : []);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to load items', error);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    localStorage.setItem('items_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('items_column_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

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

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item._id));
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

  const startResize = (columnKey, event) => {
    event.preventDefault();
    resizeRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: Number(columnWidths[columnKey] || defaultColumnWidths[columnKey] || 120)
    };
  };

  useEffect(() => {
    const onMove = (event) => {
      const current = resizeRef.current;
      if (!current) return;
      const nextWidth = Math.max(90, current.startWidth + (event.clientX - current.startX));
      setColumnWidths((prev) => ({ ...prev, [current.columnKey]: nextWidth }));
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    treatmentMethod: item.treatmentMethod || '',
    pestsCovered: item.pestsCovered || '',
    serviceDescription: item.serviceDescription ?? item.salesDescription ?? item.description ?? '',
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
    setEditingItemId(selected._id);
    setForm(mapItemToForm(selected));
    setSaveError('');
    setShowAddModal(true);
    setShowMoreMenu(false);
  };

  const handleAddItem = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const isServiceItem = form.itemType === 'service';
    const treatmentMethod = isServiceItem ? form.treatmentMethod.trim() : '';
    const pestsCovered = isServiceItem ? form.pestsCovered.trim() : '';
    const serviceDescription = isServiceItem ? form.serviceDescription.trim() : '';
    const salesDescription = form.salesDescription.trim() || serviceDescription;

    const payload = {
      itemType: form.itemType,
      name: form.name.trim(),
      treatmentMethod,
      pestsCovered,
      serviceDescription,
      unit: form.unit,
      sac: form.sac.trim(),
      hsnSac: form.sac.trim(),
      taxPreference: form.taxPreference,
      sellable: form.sellable,
      purchasable: form.purchasable,
      rate: Number(form.sellingPrice || 0),
      sellingPrice: Number(form.sellingPrice || 0),
      salesAccount: form.salesAccount,
      description: salesDescription,
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
      await loadItems();
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
      await loadItems();
    } catch (error) {
      console.error('Failed to delete selected items', error);
    }
  };

  const handleCellValue = (item, key) => {
    if (key === 'purchaseRate' || key === 'rate') return formatINR(item[key]);
    return item[key] || '';
  };
  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const isTiny = viewportWidth <= 380;
  const topbarStyle = isMobile
    ? { ...shell.topbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '10px 12px' : shell.topbar.padding }
    : shell.topbar;
  const topActionsStyle = isMobile ? { ...shell.topActions, width: '100%', justifyContent: 'space-between' } : shell.topActions;
  const toolbarStyle = isMobile ? { ...shell.toolbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '8px 12px' : shell.toolbar.padding } : shell.toolbar;
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
  const buttonGhostStyle = isTiny ? { ...shell.buttonGhost, width: '44px', height: '44px' } : shell.buttonGhost;
  const customizeButtonStyle = isTiny ? { ...shell.customizeButton, padding: '7px 10px', fontSize: '11px' } : shell.customizeButton;
  const modalHeaderStyle = isTiny ? { ...shell.modalHeader, fontSize: '16px' } : shell.modalHeader;

  return (
    <section style={shell.page}>
      <div style={topbarStyle}>
        <div style={shell.titleWrap}>
          <h1 style={titleStyle}>All Items</h1>
          <ChevronDown size={20} color="var(--color-primary)" />
        </div>
        <div style={topActionsStyle}>
          <button type="button" style={buttonPrimaryStyle} onClick={openNewItemForm}>
            <Plus size={18} />
            New
          </button>
          <div style={{ position: 'relative' }}>
            <button
              ref={moreMenuButtonRef}
              type="button"
              style={buttonGhostStyle}
              aria-label="More options"
              onClick={() => setShowMoreMenu((prev) => !prev)}
            >
              <MoreHorizontal size={24} />
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
        </div>
      </div>

      <div style={toolbarStyle}>
        <span style={shell.toolLabel}>Item Master</span>
        <div style={{ position: 'relative' }}>
          <button
            ref={customizeButtonRef}
            type="button"
            style={customizeButtonStyle}
            onClick={() => setShowCustomize((prev) => !prev)}
          >
            <SlidersHorizontal size={15} />
            Customize Fields
          </button>
          {showCustomize ? (
            <div ref={customizePanelRef} style={shell.popover}>
              <div style={shell.popoverHeader}>Table Columns</div>
              <div style={shell.popoverBody}>
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

      <div style={shell.tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...shell.headCell, ...shell.checkboxWrap }}>
                <input type="checkbox" style={shell.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumnDefs.map((column) => (
                <th key={column.key} style={{ ...shell.headCell, width: `${columnWidths[column.key] || defaultColumnWidths[column.key] || 140}px` }}>
                  <div style={shell.headerInner}>
                    <span>{column.label}</span>
                    <span
                      style={shell.resizeHandle}
                      onMouseDown={(event) => startResize(column.key, event)}
                      role="presentation"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
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
                            width: `${columnWidths[column.key] || defaultColumnWidths[column.key] || 140}px`,
                            cursor: 'pointer',
                            textDecoration: 'underline dotted rgba(159,23,77,0.45)'
                          }
                        : { ...shell.cell, width: `${columnWidths[column.key] || defaultColumnWidths[column.key] || 140}px` }
                    }
                    onClick={column.key === 'name' ? () => item._id && setSelectedIds([item._id]) : undefined}
                  >
                    {handleCellValue(item, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal ? createPortal(
        <div style={shell.modalOverlay}>
          <form style={modalStyle} onSubmit={handleAddItem}>
            <div style={modalHeaderStyle}>
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

            <div style={shell.formContent}>
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
                    <label style={shell.label}>Treatment Method</label>
                    <input
                      style={shell.input}
                      value={form.treatmentMethod}
                      onChange={(event) => updateForm('treatmentMethod', event.target.value)}
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
                  </>
                ) : null}

                <label style={shell.label}>Unit</label>
                <select style={shell.input} value={form.unit} onChange={(event) => updateForm('unit', event.target.value)}>
                  {units.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
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

            <div style={modalFooterStyle}>
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
