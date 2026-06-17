import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { Trash2, X, Pencil, Settings } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import { PHONE_VALIDATION_ERROR, normalizeIndianMobileNumber } from '../utils/phone';
import { theme } from '../styles/theme';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const VENDOR_DASHBOARD_CACHE_KEY = 'vendor_dashboard_cache_v1';
const VENDOR_VISIBLE_COLUMNS_KEY = 'vendor_dashboard_visible_columns_v1';
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const indiaStates = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

const emptyForm = {
  companyName: '',
  contactPersonName: '',
  emailId: '',
  mobileNumber: '',
  whatsappSameAsMobile: false,
  whatsappNumber: '',
  gstNumber: '',
  billingAttention: '',
  billingAddress: '',
  billingArea: '',
  billingState: '',
  billingPincode: '',
  shippingAttention: '',
  shippingAddress: '',
  shippingArea: '',
  shippingState: '',
  shippingPincode: '',
  googlePlaceId: '',
  googlePlaceName: '',
  googlePhone: '',
  googleWebsite: '',
  latitude: '',
  longitude: ''
};

const shell = {
  page: { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', overflow: 'visible', position: 'relative' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: '#fff' },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '10px', minHeight: '34px', height: '34px', padding: '0 14px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', flexWrap: 'nowrap' },
  customizeButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-primary-soft)', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '10px', width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', padding: 0, cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)' },
  customizeWrap: { position: 'relative', display: 'inline-flex' },
  customizePopover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', minWidth: '200px', zIndex: 40, overflow: 'hidden' },
  customizePopoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  customizePopoverButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937' },
  customizePopoverItem: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937' },
  tableWrap: { overflowX: 'hidden', background: '#fff', borderRadius: '14px', border: '1px solid var(--color-border)', marginTop: '12px' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  th: {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 800,
    color: theme.colors.muted,
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.colors.borderSoft}`,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
    lineHeight: 1.25,
    minHeight: '42px',
    height: 'auto',
    background: 'color-mix(in srgb, var(--color-surface-soft) 92%, var(--color-surface))'
  },
  td: { padding: '10px 12px', fontSize: '13px', color: '#111827', borderBottom: `1px solid ${theme.colors.borderSoft}`, fontWeight: 400, verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: theme.colors.surface },
  iconBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '12px', width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)' },
  modal: { background: '#fff', width: 'min(100%, 1040px)', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { height: '64px', minHeight: '64px', boxSizing: 'border-box', padding: '0 22px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '24px', lineHeight: 1.2, fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  modalTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  closeBtn: { border: 'none', background: 'transparent', color: '#fff', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  body: { padding: '20px 24px', overflowY: 'auto', display: 'grid', gap: '14px' },
  card: { border: '1px solid var(--color-border)', borderRadius: '16px', padding: '14px', background: '#fff' },
  sectionTitle: { margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  field: { display: 'grid', gap: '6px' },
  label: { fontSize: '13px', color: '#3f3f46', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '0 14px', fontSize: '15px', outline: 'none', width: '100%', height: '40px', minHeight: '40px', boxSizing: 'border-box' },
  textarea: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', lineHeight: 1.2, outline: 'none', width: '100%', height: '40px', minHeight: '40px', resize: 'vertical', boxSizing: 'border-box' },
  addressSplit: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '12px' },
  addressCard: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px', background: '#fff' },
  addressHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', minHeight: '28px' },
  addressTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#475569' },
  addressCopy: { fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', border: 'none', background: 'transparent', padding: 0, lineHeight: 1.2 },
  addressGrid: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', rowGap: '8px', columnGap: '10px', alignItems: 'center' },
  footer: { padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' },
  footer: { height: '64px', minHeight: '64px', boxSizing: 'border-box', padding: '0 24px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', background: '#fff' },
  cancelButton: { border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '18px', padding: '10px 18px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '18px', padding: '10px 20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }
};

const vendorColumns = ['company', 'contact', 'email', 'mobile', 'gst', 'billing', 'shipping', 'actions'];
const vendorColumnsMeta = [
  { key: 'company', label: 'Company Name' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'gst', label: 'GST Number' },
  { key: 'billing', label: 'Billing Address' },
  { key: 'shipping', label: 'Shipping Address' }
];
const vendorWidths = { company: 180, contact: 150, email: 210, mobile: 120, gst: 160, billing: 210, shipping: 210, actions: 120 };
const vendorBounds = {
  company: { min: 140, max: 240 },
  contact: { min: 120, max: 190 },
  email: { min: 170, max: 280 },
  mobile: { min: 100, max: 150 },
  gst: { min: 130, max: 200 },
  billing: { min: 170, max: 280 },
  shipping: { min: 170, max: 280 },
  actions: { min: 100, max: 140 }
};

const toTenDigitNumber = normalizeIndianMobileNumber;
const toSixDigitPincode = (value) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const isValidPincode = (value) => !value || /^\d{6}$/.test(value);

const readVendorDashboardCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(VENDOR_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const readVendorVisibleColumns = () => {
  try {
    if (typeof window === 'undefined') return vendorColumns;
    const raw = window.localStorage.getItem(VENDOR_VISIBLE_COLUMNS_KEY);
    if (!raw) return vendorColumns;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return vendorColumns;
    const valid = parsed.filter((key) => vendorColumns.includes(key));
    return valid.length > 0 ? valid : vendorColumns;
  } catch {
    return vendorColumns;
  }
};

const writeVendorVisibleColumns = (columns) => {
  try {
    if (typeof window === 'undefined') return;
    const valid = Array.isArray(columns) ? columns.filter((key) => vendorColumns.includes(key)) : vendorColumns;
    window.localStorage.setItem(VENDOR_VISIBLE_COLUMNS_KEY, JSON.stringify(valid));
  } catch {
    // Best effort only.
  }
};

const mergeVendorDashboardCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readVendorDashboardCache() || {};
    window.sessionStorage.setItem(VENDOR_DASHBOARD_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best effort only.
  }
};

export default function VendorDashboard() {
  const [cachedDashboard] = useState(() => readVendorDashboardCache());
  const [vendors, setVendors] = useState(() => Array.isArray(cachedDashboard?.vendors) ? cachedDashboard.vendors : []);
  const [visibleColumns, setVisibleColumns] = useState(() => readVendorVisibleColumns());
  const [showModal, setShowModal] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const loadRequestRef = useRef(null);
  const customizeWrapRef = useRef(null);

  const isMobile = viewportWidth <= 900;

  const loadVendors = async (options = {}) => {
    if (loadRequestRef.current) return loadRequestRef.current;
    const request = (async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/vendors`);
      const nextVendors = Array.isArray(res.data) ? res.data : [];
      setVendors(nextVendors);
      mergeVendorDashboardCache({ vendors: nextVendors });
    } catch (error) {
      console.error('Failed to load vendors', error);
      if (!options.silent && !cachedDashboard) setVendors([]);
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
    loadVendors({ silent: Boolean(cachedDashboard) });
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [cachedDashboard]);

  useAutoRefresh(() => loadVendors({ silent: true }), { enabled: !showModal });

  useEffect(() => {
    if (!showCustomize) return undefined;
    const handlePointerDown = (event) => {
      if (customizeWrapRef.current && !customizeWrapRef.current.contains(event.target)) {
        setShowCustomize(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showCustomize]);

  const openNew = () => {
    setEditingId('');
    setForm(emptyForm);
    setSaveError('');
    setShowModal(true);
  };

  const openEdit = (vendor) => {
    const mobileNumber = toTenDigitNumber(vendor?.mobileNumber || vendor?.mobile || '');
    const whatsappNumber = toTenDigitNumber(vendor?.whatsappNumber || '');
    setEditingId(String(vendor?._id || ''));
    setForm({
      ...emptyForm,
      ...(vendor || {}),
      mobileNumber,
      whatsappNumber,
      whatsappSameAsMobile: Boolean(mobileNumber && whatsappNumber && mobileNumber === whatsappNumber),
      billingPincode: toSixDigitPincode(vendor?.billingPincode || vendor?.pincode || ''),
      shippingPincode: toSixDigitPincode(vendor?.shippingPincode || '')
    });
    setSaveError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setShowModal(false);
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateMobileNumber = (value) => {
    const mobileNumber = toTenDigitNumber(value);
    setForm((prev) => ({
      ...prev,
      mobileNumber,
      whatsappNumber: prev.whatsappSameAsMobile ? mobileNumber : prev.whatsappNumber
    }));
  };
  const updateWhatsappNumber = (value) => {
    const whatsappNumber = toTenDigitNumber(value);
    setForm((prev) => ({ ...prev, whatsappNumber }));
  };
  const copyBillingToShipping = (source) => ({
    shippingAttention: source.billingAttention,
    shippingAddress: source.billingAddress,
    shippingArea: source.billingArea,
    shippingState: source.billingState,
    shippingPincode: source.billingPincode
  });

  const requiredMissing = useMemo(() => {
    return !String(form.companyName || '').trim()
      || !String(form.contactPersonName || '').trim()
      || !String(form.emailId || '').trim()
      || !String(form.mobileNumber || '').trim()
      || !String(form.gstNumber || '').trim();
  }, [form]);

  const saveVendor = async (event) => {
    event.preventDefault();
    if (requiredMissing) {
      setSaveError('Please fill all required fields.');
      return;
    }
    const mobile = toTenDigitNumber(form.mobileNumber);
    if (mobile.length !== 10) {
      setSaveError(PHONE_VALIDATION_ERROR);
      return;
    }
    const whatsappNumber = form.whatsappSameAsMobile ? mobile : toTenDigitNumber(form.whatsappNumber);
    if (!form.whatsappSameAsMobile && whatsappNumber && whatsappNumber.length !== 10) {
      setSaveError(PHONE_VALIDATION_ERROR);
      return;
    }
    const gstNumber = String(form.gstNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    if (!gstinRegex.test(gstNumber)) {
      setSaveError('Enter a valid 15-character GSTIN (e.g., 08ABCDE9999F1Z8).');
      return;
    }
    const billingPincode = toSixDigitPincode(form.billingPincode);
    const shippingPincode = toSixDigitPincode(form.shippingPincode);
    if (!isValidPincode(billingPincode)) {
      setSaveError('Billing Pin Code must be exactly 6 digits.');
      return;
    }
    if (!isValidPincode(shippingPincode)) {
      setSaveError('Shipping Pin Code must be exactly 6 digits.');
      return;
    }

    setSaveError('');
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        mobileNumber: mobile,
        whatsappNumber: whatsappNumber || (form.whatsappSameAsMobile ? mobile : ''),
        gstNumber,
        billingPincode,
        shippingPincode
      };
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/vendors/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/vendors`, payload);
      }
      setShowModal(false);
      await loadVendors({ silent: true });
    } catch (error) {
      setSaveError(error?.response?.data?.error || 'Unable to save vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteVendor = async (vendorId) => {
    if (!vendorId) return;
    if (!window.confirm('Delete this vendor?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/vendors/${vendorId}`);
      await loadVendors({ silent: true });
    } catch (error) {
      window.alert(error?.response?.data?.error || 'Unable to delete vendor');
    }
  };

  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '16px 10px' } : shell.modalOverlay;
  const modalStyle = isMobile
    ? { ...shell.modal, width: '96vw', maxHeight: '92dvh', height: '92dvh', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.24)' }
    : shell.modal;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, minHeight: '64px', fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const bodyStyle = isMobile ? { ...shell.body, padding: '12px 14px', paddingBottom: 'calc(130px + env(safe-area-inset-bottom))' } : shell.body;
  const gridStyle = isMobile ? { ...shell.grid, gridTemplateColumns: '1fr' } : shell.grid;
  const addressSplitStyle = isMobile ? { ...shell.addressSplit, gridTemplateColumns: '1fr', gap: '10px' } : shell.addressSplit;
  const addressCardStyle = isMobile ? { ...shell.addressCard, padding: '10px 11px' } : shell.addressCard;
  const addressGridStyle = isMobile ? { ...shell.addressGrid, gridTemplateColumns: '1fr' } : shell.addressGrid;
  const addressTitleStyle = isMobile ? { ...shell.addressTitle, fontSize: '13px' } : shell.addressTitle;
  const addressTextareaStyle = { ...shell.textarea, height: '65px', minHeight: '65px' };
  const {
    getColumnWidth,
    startResize,
    resetColumns
  } = useColumnResize({
    storageKey: 'vendor_dashboard_table_widths',
    columns: vendorColumns,
    defaultColumnWidths: vendorWidths,
    columnBounds: vendorBounds,
    minWidth: 100,
    enabled: true
  });
  const tableMinWidth = [...visibleColumns, 'actions'].reduce((sum, key) => sum + (getColumnWidth(key) || vendorWidths[key] || 100), 0);
  const tableStyle = { ...shell.table, minWidth: `${Math.max(600, tableMinWidth)}px` };
  const headStyle = (key, align = 'left') => ({ ...shell.th, position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px`, textAlign: align });
  const cellStyle = (key, align = 'left') => ({ ...shell.td, width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px`, textAlign: align });
  const visibleVendorColumns = vendorColumnsMeta.filter((column) => visibleColumns.includes(column.key));
  const toggleVendorColumn = (columnKey) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(columnKey) ? prev.filter((key) => key !== columnKey) : [...prev, columnKey];
      writeVendorVisibleColumns(next);
      return next;
    });
  };
  const resetVendorColumns = () => {
    setVisibleColumns(vendorColumns);
    writeVendorVisibleColumns(vendorColumns);
  };

  return (
    <section style={shell.page}>
      <div style={shell.topbar}>
        <h1 style={shell.title}>Vendors Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={shell.buttonPrimary} onClick={openNew}>
            + New Vendor
          </button>
          <div ref={customizeWrapRef} style={shell.customizeWrap}>
            <button
              type="button"
              style={shell.customizeButton}
              aria-label="Customize columns"
              title="Customize columns"
              onClick={() => setShowCustomize((prev) => !prev)}
            >
              <Settings size={14} />
            </button>
            {showCustomize ? (
              <div style={shell.customizePopover}>
                <div style={shell.customizePopoverHeader}>Show / Hide Columns</div>
                <button type="button" style={shell.customizePopoverButton} onClick={() => {
                  resetVendorColumns();
                  resetColumns();
                  setShowCustomize(false);
                }}>
                  Reset Default Columns
                </button>
                {vendorColumnsMeta.map((column) => (
                  <label key={column.key} style={{ ...shell.customizePopoverItem, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.key)}
                      onChange={() => toggleVendorColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={tableStyle}>
          <colgroup>
            {visibleVendorColumns.map((column) => (
              <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
            ))}
            <col style={{ width: `${getColumnWidth('actions')}px` }} />
          </colgroup>
          <thead>
            <tr>
              {visibleVendorColumns.map((column) => (
                <th key={column.key} style={headStyle(column.key, column.key === 'mobile' ? 'center' : 'left')}>
                  {column.label}
                </th>
              ))}
              <th style={headStyle('actions', 'center')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor._id}>
                {visibleVendorColumns.map((column) => {
                  const value =
                    column.key === 'company' ? vendor.companyName :
                    column.key === 'contact' ? vendor.contactPersonName :
                    column.key === 'email' ? vendor.emailId :
                    column.key === 'mobile' ? vendor.mobileNumber :
                    column.key === 'gst' ? vendor.gstNumber :
                    column.key === 'billing' ? vendor.billingAddress :
                    column.key === 'shipping' ? vendor.shippingAddress : '';
                  return (
                    <td key={`${vendor._id}-${column.key}`} style={cellStyle(column.key, column.key === 'mobile' ? 'center' : 'left')}>
                      <span style={{ display: 'block', fontWeight: 400, fontSize: '13px', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={value || '-'}>
                        {value || '-'}
                      </span>
                    </td>
                  );
                })}
                <td style={cellStyle('actions', 'left')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', justifyContent: 'flex-start' }}>
                    <button type="button" style={shell.iconBtn} onClick={() => openEdit(vendor)} aria-label="Edit vendor" title="Edit vendor"><Pencil size={15} strokeWidth={2.25} /></button>
                    <button type="button" style={shell.iconBtn} onClick={() => deleteVendor(vendor._id)} aria-label="Delete vendor" title="Delete vendor"><Trash2 size={15} strokeWidth={2.25} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {vendors.length === 0 ? (
              <tr><td style={shell.td} colSpan={visibleVendorColumns.length + 1}>No vendors found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showModal ? createPortal(
        <div style={modalOverlayStyle} onClick={closeModal}>
          <form className="crm-modal-surface" style={modalStyle} onSubmit={saveVendor} onClick={(event) => event.stopPropagation()}>
            <div className="crm-modal-surface-header" style={modalHeaderStyle}>
              <h3 style={shell.modalTitle}>{editingId ? 'Edit Vendor' : 'New Vendor'}</h3>
              <button type="button" style={shell.closeBtn} onClick={closeModal}><X size={24} /></button>
            </div>
            <div className="crm-modal-surface-body" style={bodyStyle}>
              <div style={shell.card}>
                <p style={shell.sectionTitle}>Vendor Details</p>
                <div style={gridStyle}>
                  <div style={shell.field}><label style={shell.label}>Company Name</label><input style={shell.input} placeholder="Enter company name" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Contact Person Name</label><input style={shell.input} value={form.contactPersonName} onChange={(e) => update('contactPersonName', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Email Address</label><input style={shell.input} type="email" value={form.emailId} onChange={(e) => update('emailId', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Mobile</label><input style={shell.input} inputMode="numeric" value={form.mobileNumber} onChange={(e) => updateMobileNumber(e.target.value)} /></div>
                  <div style={shell.field}>
                    <label style={shell.label}>WhatsApp Number</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                      <input
                        style={shell.input}
                        inputMode="numeric"
                        value={form.whatsappSameAsMobile ? form.mobileNumber : form.whatsappNumber}
                        disabled={form.whatsappSameAsMobile}
                        onChange={(e) => updateWhatsappNumber(e.target.value)}
                      />
                      <label style={{ fontSize: '11px', color: '#334155', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={form.whatsappSameAsMobile}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              whatsappSameAsMobile: e.target.checked,
                              whatsappNumber: e.target.checked ? prev.mobileNumber : prev.whatsappNumber
                            }))
                          }
                        />{' '}
                        Same as mobile
                      </label>
                    </div>
                  </div>
                  <div style={shell.field}><label style={shell.label}>GST Number</label><input style={shell.input} inputMode="text" maxLength={15} value={form.gstNumber} onChange={(e) => update('gstNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))} /></div>
                </div>
              </div>

              <div style={addressSplitStyle}>
                <div style={addressCardStyle}>
                  <div style={shell.addressHead}>
                    <h4 style={addressTitleStyle}>Billing Address</h4>
                  </div>
                  <div style={addressGridStyle}>
                    <label style={shell.label}>Attention</label>
                    <input style={shell.input} value={form.billingAttention} onChange={(e) => update('billingAttention', e.target.value)} />

                    <label style={shell.label}>Address</label>
                    <textarea style={addressTextareaStyle} placeholder="Enter address" value={form.billingAddress} onChange={(e) => update('billingAddress', e.target.value)} />

                    <label style={shell.label}>Area</label>
                    <input style={shell.input} value={form.billingArea} onChange={(e) => update('billingArea', e.target.value)} />

                    <label style={shell.label}>State</label>
                    <select style={shell.input} value={form.billingState} onChange={(e) => update('billingState', e.target.value)}>
                      <option value="">Select state</option>
                      {indiaStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>

                    <label style={shell.label}>Pin Code</label>
                    <input style={shell.input} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={form.billingPincode} onChange={(e) => update('billingPincode', toSixDigitPincode(e.target.value))} />
                  </div>
                </div>

                <div style={addressCardStyle}>
                  <div style={shell.addressHead}>
                    <h4 style={addressTitleStyle}>Shipping Address</h4>
                    <button type="button" style={shell.addressCopy} onClick={() => setForm((prev) => ({ ...prev, ...copyBillingToShipping(prev) }))}>
                      ↓ Copy billing address
                    </button>
                  </div>
                  <div style={addressGridStyle}>
                    <label style={shell.label}>Attention</label>
                    <input style={shell.input} value={form.shippingAttention} onChange={(e) => update('shippingAttention', e.target.value)} />

                    <label style={shell.label}>Address</label>
                    <textarea style={addressTextareaStyle} placeholder="Enter address" value={form.shippingAddress} onChange={(e) => update('shippingAddress', e.target.value)} />

                    <label style={shell.label}>Area</label>
                    <input style={shell.input} value={form.shippingArea} onChange={(e) => update('shippingArea', e.target.value)} />

                    <label style={shell.label}>State</label>
                    <select style={shell.input} value={form.shippingState} onChange={(e) => update('shippingState', e.target.value)}>
                      <option value="">Select state</option>
                      {indiaStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>

                    <label style={shell.label}>Pin Code</label>
                    <input style={shell.input} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={form.shippingPincode} onChange={(e) => update('shippingPincode', toSixDigitPincode(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="crm-modal-surface-footer" style={shell.footer}>
              {saveError ? <div style={{ marginRight: 'auto', color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>{saveError}</div> : null}
              <button type="button" style={shell.cancelButton} onClick={closeModal}>Cancel</button>
              <button type="submit" style={shell.saveButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Vendor'}</button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
