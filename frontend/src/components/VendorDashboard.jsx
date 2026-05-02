import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { Trash2, X, Pencil } from 'lucide-react';
import { attachPlacesAutocomplete } from '../utils/googlePlaces';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

const emptyForm = {
  companyName: '',
  contactPersonName: '',
  emailId: '',
  mobileNumber: '',
  gstNumber: '',
  billingAttention: '',
  billingStreet1: '',
  billingStreet2: '',
  billingAddress: '',
  billingArea: '',
  billingState: '',
  billingPincode: '',
  shippingAttention: '',
  shippingStreet1: '',
  shippingStreet2: '',
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
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '10px', padding: '9px 14px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', flexWrap: 'nowrap' },
  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: '14px', border: '1px solid var(--color-border)', marginTop: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  td: { padding: '12px 10px', fontSize: '14px', color: '#111827', borderBottom: '1px solid #eef2f7' },
  iconBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '8px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)' },
  modal: { background: '#fff', width: 'min(100%, 1100px)', borderRadius: '24px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '28px', fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  closeBtn: { border: 'none', background: 'transparent', color: '#fff', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  body: { padding: '16px', overflowY: 'auto', display: 'grid', gap: '16px' },
  card: { border: '1px solid var(--color-border)', borderRadius: '16px', padding: '14px', background: '#fff' },
  sectionTitle: { margin: '0 0 12px 0', fontSize: '28px', fontWeight: 700, color: '#111827' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  field: { display: 'grid', gap: '6px' },
  label: { fontSize: '13px', color: '#3f3f46', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', outline: 'none', width: '100%', minHeight: '48px', boxSizing: 'border-box' },
  textarea: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', outline: 'none', width: '100%', minHeight: '84px', resize: 'vertical', boxSizing: 'border-box' },
  addressSplit: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' },
  addressCard: { border: '1px solid var(--color-border)', borderRadius: '16px', padding: '14px', background: '#fff' },
  addressHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  addressTitle: { margin: 0, fontSize: '44px', fontWeight: 800, color: '#111827', lineHeight: 1.1 },
  addressCopy: { fontSize: '14px', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', border: 'none', background: 'transparent', padding: 0, lineHeight: 1.2 },
  addressGrid: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', rowGap: '10px', columnGap: '10px', alignItems: 'center' },
  footer: { padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' },
  cancelButton: { border: '1px solid #d1d5db', background: '#fff', color: '#2563eb', borderRadius: '18px', padding: '10px 18px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '18px', padding: '10px 20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }
};

const toTenDigitNumber = (value) => String(value || '').replace(/\D+/g, '').slice(0, 10);

export default function VendorDashboard() {
  const [vendors, setVendors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const companyNameInputRef = React.useRef(null);
  const billingAreaInputRef = React.useRef(null);

  const isMobile = viewportWidth <= 900;

  const loadVendors = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/vendors`);
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load vendors', error);
    }
  };

  useEffect(() => {
    loadVendors();
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
            billingStreet1: place.formatted_address || prev.billingStreet1,
            billingAddress: place.formatted_address || prev.billingAddress,
            billingArea: place.areaName || prev.billingArea,
            billingState: place.state || prev.billingState,
            billingPincode: place.pincode || prev.billingPincode,
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
            billingStreet1: place.formatted_address || prev.billingStreet1,
            billingAddress: place.formatted_address || prev.billingAddress,
            billingArea: place.areaName || prev.billingArea,
            billingState: place.state || prev.billingState,
            billingPincode: place.pincode || prev.billingPincode,
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
    setForm({ ...emptyForm, ...(vendor || {}) });
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
    shippingStreet1: source.billingStreet1,
    shippingStreet2: source.billingStreet2,
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
      setSaveError('Mobile number must be exactly 10 digits.');
      return;
    }
    const gstNumber = String(form.gstNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    if (!gstinRegex.test(gstNumber)) {
      setSaveError('Enter a valid 15-character GSTIN (e.g., 08ABCDE9999F1Z8).');
      return;
    }

    setSaveError('');
    setIsSaving(true);
    try {
      const payload = { ...form, mobileNumber: mobile, gstNumber };
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/vendors/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/vendors`, payload);
      }
      setShowModal(false);
      await loadVendors();
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
      await loadVendors();
    } catch (error) {
      window.alert(error?.response?.data?.error || 'Unable to delete vendor');
    }
  };

  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '16px 10px' } : shell.modalOverlay;
  const modalStyle = isMobile
    ? { ...shell.modal, width: 'min(100%, 92vw)', maxHeight: '92dvh', height: '92dvh', borderRadius: '28px', border: '1px solid rgba(159, 23, 77, 0.24)' }
    : shell.modal;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const bodyStyle = isMobile ? { ...shell.body, paddingBottom: 'calc(130px + env(safe-area-inset-bottom))', padding: '16px 14px' } : shell.body;
  const gridStyle = isMobile ? { ...shell.grid, gridTemplateColumns: '1fr' } : shell.grid;
  const addressSplitStyle = isMobile ? { ...shell.addressSplit, gridTemplateColumns: '1fr' } : shell.addressSplit;
  const addressGridStyle = isMobile ? { ...shell.addressGrid, gridTemplateColumns: '1fr' } : shell.addressGrid;
  const addressTitleStyle = isMobile ? { ...shell.addressTitle, fontSize: '20px' } : { ...shell.addressTitle, fontSize: '44px' };

  return (
    <section style={shell.page}>
      <div style={shell.topbar}>
        <h1 style={shell.title}>Vendors Dashboard</h1>
        <button type="button" style={shell.buttonPrimary} onClick={openNew}>
          + New Vendor
        </button>
      </div>

      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead>
            <tr>
              <th style={shell.th}>Company Name</th>
              <th style={shell.th}>Contact Person</th>
              <th style={shell.th}>Email</th>
              <th style={shell.th}>Mobile</th>
              <th style={shell.th}>GST Number</th>
              <th style={shell.th}>Billing Address</th>
              <th style={shell.th}>Shipping Address</th>
              <th style={shell.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor._id}>
                <td style={shell.td}>{vendor.companyName || '-'}</td>
                <td style={shell.td}>{vendor.contactPersonName || '-'}</td>
                <td style={shell.td}>{vendor.emailId || '-'}</td>
                <td style={shell.td}>{vendor.mobileNumber || '-'}</td>
                <td style={shell.td}>{vendor.gstNumber || '-'}</td>
                <td style={shell.td}>{vendor.billingAddress || '-'}</td>
                <td style={shell.td}>{vendor.shippingAddress || '-'}</td>
                <td style={shell.td}>
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
          <form style={modalStyle} onSubmit={saveVendor} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={shell.modalTitle}>{editingId ? 'Edit Vendor' : 'New Vendor'}</h3>
              <button type="button" style={shell.closeBtn} onClick={closeModal}><X size={24} /></button>
            </div>
            <div style={bodyStyle}>
              <div style={shell.card}>
                <p style={shell.sectionTitle}>Vendor Details</p>
                <div style={gridStyle}>
                  <div style={shell.field}><label style={shell.label}>Company Name*</label><input ref={companyNameInputRef} style={shell.input} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Contact Person Name*</label><input style={shell.input} value={form.contactPersonName} onChange={(e) => update('contactPersonName', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Email Address*</label><input style={shell.input} type="email" value={form.emailId} onChange={(e) => update('emailId', e.target.value)} /></div>
                  <div style={shell.field}><label style={shell.label}>Mobile*</label><input style={shell.input} inputMode="numeric" maxLength={10} value={form.mobileNumber} onChange={(e) => update('mobileNumber', toTenDigitNumber(e.target.value))} /></div>
                  <div style={shell.field}><label style={shell.label}>GST Number*</label><input style={shell.input} inputMode="text" maxLength={15} value={form.gstNumber} onChange={(e) => update('gstNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))} /></div>
                </div>
              </div>

              <div style={shell.card}>
                <p style={shell.sectionTitle}>Billing Address</p>
                <div style={addressSplitStyle}>
                  <div style={shell.addressCard}>
                    <div style={shell.addressHead}>
                      <h4 style={addressTitleStyle}>Billing Address</h4>
                    </div>
                    <div style={addressGridStyle}>
                      <label style={shell.label}>Attention</label>
                      <input style={shell.input} value={form.billingAttention} onChange={(e) => update('billingAttention', e.target.value)} />

                      <label style={shell.label}>Address</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <textarea style={shell.textarea} placeholder="Street 1" value={form.billingStreet1} onChange={(e) => update('billingStreet1', e.target.value)} />
                        <textarea style={shell.textarea} placeholder="Street 2" value={form.billingStreet2} onChange={(e) => update('billingStreet2', e.target.value)} />
                      </div>

                      <label style={shell.label}>Area</label>
                    <input ref={billingAreaInputRef} style={shell.input} value={form.billingArea} onChange={(e) => update('billingArea', e.target.value)} />

                      <label style={shell.label}>State</label>
                      <input style={shell.input} value={form.billingState} onChange={(e) => update('billingState', e.target.value)} />

                      <label style={shell.label}>Pin Code</label>
                      <input style={shell.input} inputMode="numeric" maxLength={10} value={form.billingPincode} onChange={(e) => update('billingPincode', e.target.value.replace(/\D+/g, '').slice(0, 10))} />
                    </div>
                  </div>

                  <div style={shell.addressCard}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea style={shell.textarea} placeholder="Street 1" value={form.shippingStreet1} onChange={(e) => update('shippingStreet1', e.target.value)} />
                        <textarea style={shell.textarea} placeholder="Street 2" value={form.shippingStreet2} onChange={(e) => update('shippingStreet2', e.target.value)} />
                      </div>

                      <label style={shell.label}>Area</label>
                      <input style={shell.input} value={form.shippingArea} onChange={(e) => update('shippingArea', e.target.value)} />

                      <label style={shell.label}>State</label>
                      <input style={shell.input} value={form.shippingState} onChange={(e) => update('shippingState', e.target.value)} />

                      <label style={shell.label}>Pin Code</label>
                      <input style={shell.input} inputMode="numeric" maxLength={10} value={form.shippingPincode} onChange={(e) => update('shippingPincode', e.target.value.replace(/\D+/g, '').slice(0, 10))} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={shell.footer}>
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
