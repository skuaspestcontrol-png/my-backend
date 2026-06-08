import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { Trash2, X, Pencil } from 'lucide-react';
import { attachPlacesAutocomplete } from '../utils/googlePlaces';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import { PHONE_VALIDATION_ERROR, normalizeIndianMobileNumber } from '../utils/phone';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const VENDOR_DASHBOARD_CACHE_KEY = 'vendor_dashboard_cache_v1';
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

const emptyForm = {
  companyName: '',
  contactPersonName: '',
  emailId: '',
  mobileNumber: '',
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
  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: '14px', border: '1px solid var(--color-border)', marginTop: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  td: { padding: '12px 10px', fontSize: '14px', color: '#111827', borderBottom: '1px solid #eef2f7' },
  iconBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '8px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)' },
  modal: { background: '#fff', width: 'min(100%, 1040px)', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { minHeight: '64px', padding: '16px 22px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '24px', lineHeight: 1.2, fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
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
  addressTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' },
  addressCopy: { fontSize: '14px', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', border: 'none', background: 'transparent', padding: 0, lineHeight: 1.2 },
  addressGrid: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', rowGap: '8px', columnGap: '10px', alignItems: 'center' },
  footer: { padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' },
  cancelButton: { border: '1px solid #d1d5db', background: '#fff', color: '#2563eb', borderRadius: '18px', padding: '10px 18px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '18px', padding: '10px 20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }
};

const vendorColumns = ['company', 'contact', 'email', 'mobile', 'gst', 'billing', 'shipping', 'actions'];
const vendorWidths = { company: 180, contact: 160, email: 180, mobile: 130, gst: 140, billing: 220, shipping: 220, actions: 120 };
const vendorBounds = {
  company: { min: 150, max: 260 },
  contact: { min: 140, max: 220 },
  email: { min: 150, max: 260 },
  mobile: { min: 110, max: 160 },
  gst: { min: 120, max: 180 },
  billing: { min: 180, max: 320 },
  shipping: { min: 180, max: 320 },
  actions: { min: 100, max: 160 }
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
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const loadRequestRef = useRef(null);
  const companyNameInputRef = useRef(null);
  const billingAreaInputRef = useRef(null);

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
    if (!showModal) return () => {};
    let cleanups = [];

    const initPlaces = async () => {
      const companyCleanup = await attachPlacesAutocomplete({
        input: companyNameInputRef.current,
        onSelected: (place) => {
          setForm((prev) => ({
            ...prev,
            companyName: place.name || prev.companyName,
            billingAddress: place.formatted_address || prev.billingAddress,
            billingArea: place.areaName || prev.billingArea,
            billingState: place.state || prev.billingState,
            billingPincode: place.pincode ? toSixDigitPincode(place.pincode) : prev.billingPincode,
            googlePlaceId: place.place_id || prev.googlePlaceId,
            googlePlaceName: place.name || prev.googlePlaceName,
            googlePhone: place.formatted_phone_number || place.international_phone_number || prev.googlePhone,
            googleWebsite: place.website || prev.googleWebsite,
            latitude: place.latitude !== null ? String(place.latitude) : prev.latitude,
            longitude: place.longitude !== null ? String(place.longitude) : prev.longitude
          }));
        },
        onError: (error) => alert(error?.message || 'Google Maps API key not configured'),
        onRequireSelection: (message) => alert(message || 'Please select address/company from suggestions')
      });

      const billingCleanup = await attachPlacesAutocomplete({
        input: billingAreaInputRef.current,
        onSelected: (place) => {
          setForm((prev) => ({
            ...prev,
            companyName: prev.companyName || place.name || '',
            billingAddress: place.formatted_address || prev.billingAddress,
            billingArea: place.areaName || prev.billingArea,
            billingState: place.state || prev.billingState,
            billingPincode: place.pincode ? toSixDigitPincode(place.pincode) : prev.billingPincode,
            googlePlaceId: place.place_id || prev.googlePlaceId,
            googlePlaceName: place.name || prev.googlePlaceName,
            googlePhone: place.formatted_phone_number || place.international_phone_number || prev.googlePhone,
            googleWebsite: place.website || prev.googleWebsite,
            latitude: place.latitude !== null ? String(place.latitude) : prev.latitude,
            longitude: place.longitude !== null ? String(place.longitude) : prev.longitude
          }));
        },
        onError: (error) => alert(error?.message || 'Google Maps API key not configured'),
        onRequireSelection: (message) => alert(message || 'Please select address/company from suggestions')
      });

      cleanups = [companyCleanup, billingCleanup];
    };

    initPlaces();
    return () => {
      cleanups.forEach((fn) => {
        if (typeof fn === 'function') fn();
      });
    };
  }, [showModal]);

  const openNew = () => {
    setEditingId('');
    setForm(emptyForm);
    setSaveError('');
    setShowModal(true);
  };

  const openEdit = (vendor) => {
    setEditingId(String(vendor?._id || ''));
    setForm({
      ...emptyForm,
      ...(vendor || {}),
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
      const payload = { ...form, mobileNumber: mobile, gstNumber, billingPincode, shippingPincode };
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
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, minHeight: '60px', fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const bodyStyle = isMobile ? { ...shell.body, padding: '12px 14px', paddingBottom: 'calc(130px + env(safe-area-inset-bottom))' } : shell.body;
  const gridStyle = isMobile ? { ...shell.grid, gridTemplateColumns: '1fr' } : shell.grid;
  const addressSplitStyle = isMobile ? { ...shell.addressSplit, gridTemplateColumns: '1fr', gap: '10px' } : shell.addressSplit;
  const addressCardStyle = isMobile ? { ...shell.addressCard, padding: '10px 11px' } : shell.addressCard;
  const addressGridStyle = isMobile ? { ...shell.addressGrid, gridTemplateColumns: '1fr' } : shell.addressGrid;
  const addressTitleStyle = isMobile ? { ...shell.addressTitle, fontSize: '13px' } : shell.addressTitle;
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
  const tableMinWidth = vendorColumns.reduce((sum, key) => sum + (getColumnWidth(key) || vendorWidths[key] || 100), 0);
  const tableStyle = { ...shell.table, minWidth: `${Math.max(900, tableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => ({ ...shell.th, position: 'relative', width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px`, textAlign: align });
  const cellStyle = (key, align = 'left') => ({ ...shell.td, width: `${getColumnWidth(key)}px`, minWidth: `${getColumnWidth(key)}px`, maxWidth: `${getColumnWidth(key)}px`, textAlign: align });

  return (
    <section style={shell.page}>
      <div style={shell.topbar}>
        <h1 style={shell.title}>Vendors Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={shell.buttonPrimary} onClick={openNew}>
            + New Vendor
          </button>
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={tableStyle}>
          <colgroup>{vendorColumns.map((key) => <col key={key} style={{ width: `${getColumnWidth(key)}px` }} />)}</colgroup>
          <thead>
            <tr>
              <th style={headStyle('company')}>Company Name</th>
              <th style={headStyle('contact')}>Contact Person</th>
              <th style={headStyle('email')}>Email</th>
              <th style={headStyle('mobile', 'center')}>Mobile</th>
              <th style={headStyle('gst')}>GST Number</th>
              <th style={headStyle('billing')}>Billing Address</th>
              <th style={headStyle('shipping')}>Shipping Address</th>
              <th style={headStyle('actions', 'center')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor._id}>
                <td style={cellStyle('company')}>{vendor.companyName || '-'}</td>
                <td style={cellStyle('contact')}>{vendor.contactPersonName || '-'}</td>
                <td style={cellStyle('email')}>{vendor.emailId || '-'}</td>
                <td style={cellStyle('mobile', 'center')}>{vendor.mobileNumber || '-'}</td>
                <td style={cellStyle('gst')}>{vendor.gstNumber || '-'}</td>
                <td style={cellStyle('billing')}>{vendor.billingAddress || '-'}</td>
                <td style={cellStyle('shipping')}>{vendor.shippingAddress || '-'}</td>
                <td style={cellStyle('actions', 'center')}>
                  <button type="button" style={shell.iconBtn} onClick={() => openEdit(vendor)}><Pencil size={14} /></button>
                  <button type="button" style={shell.iconBtn} onClick={() => deleteVendor(vendor._id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 ? (
              <tr><td style={shell.td} colSpan={8}>No vendors found.</td></tr>
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
                  <div style={shell.field}><label style={shell.label}>Company Name*</label><input ref={companyNameInputRef} style={shell.input} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Contact Person Name*</label><input style={shell.input} value={form.contactPersonName} onChange={(e) => update('contactPersonName', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Email Address*</label><input style={shell.input} type="email" value={form.emailId} onChange={(e) => update('emailId', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Mobile*</label><input style={shell.input} inputMode="numeric" value={form.mobileNumber} onChange={(e) => update('mobileNumber', toTenDigitNumber(e.target.value))} /></div>
                  <div style={shell.field}><label style={shell.label}>GST Number*</label><input style={shell.input} inputMode="text" maxLength={15} value={form.gstNumber} onChange={(e) => update('gstNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))} /></div>
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
                    <textarea style={shell.textarea} placeholder="Enter address" value={form.billingAddress} onChange={(e) => update('billingAddress', e.target.value)} />

                    <label style={shell.label}>Area</label>
                    <input ref={billingAreaInputRef} style={shell.input} value={form.billingArea} onChange={(e) => update('billingArea', e.target.value)} />

                    <label style={shell.label}>State</label>
                    <input style={shell.input} value={form.billingState} onChange={(e) => update('billingState', e.target.value)} />

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
                    <textarea style={shell.textarea} placeholder="Enter address" value={form.shippingAddress} onChange={(e) => update('shippingAddress', e.target.value)} />

                    <label style={shell.label}>Area</label>
                    <input style={shell.input} value={form.shippingArea} onChange={(e) => update('shippingArea', e.target.value)} />

                    <label style={shell.label}>State</label>
                    <input style={shell.input} value={form.shippingState} onChange={(e) => update('shippingState', e.target.value)} />

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
