import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Check, MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { formatGoogleAddressParts, loadGooglePlacesScript } from '../utils/googlePlaces';
import {
  extractGoogleMapsCoordinates,
  isAllowedGoogleMapsUrl,
  isGoogleMapsShortLink,
  resolveGoogleMapsUrl
} from '../utils/googleMaps';
import { normalizeIndianMobileNumber } from '../utils/phone';

const normalizeApiBase = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return parsed.origin === 'http://localhost' && !/^https?:\/\//i.test(raw) ? '' : parsed.origin.replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '').replace(/\/sales\/customers$/i, '');
  }
};

const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);
const getApiErrorMessage = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const emptyPremise = {
  premiseLabel: '',
  premiseType: 'Shipping',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  areaName: '',
  city: '',
  state: 'Delhi',
  pincode: '',
  country: 'India',
  gstNumber: '',
  placeOfSupply: '',
  googleMapUrl: '',
  isDefault: false,
  isShipping: true
};

const styles = {
  wrap: { gridColumn: '1 / -1', display: 'grid', gap: 10, border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, background: '#fff' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' },
  sub: { margin: '3px 0 0', fontSize: 12, fontWeight: 600, color: '#64748b' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 },
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8, background: '#fff', cursor: 'pointer' },
  activeCard: { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px rgba(159,23,77,0.14)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  cardTitle: { margin: 0, fontSize: 13, fontWeight: 800, color: '#111827' },
  text: { margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.45, color: '#334155' },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: { borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 800, background: '#f1f5f9', color: '#334155' },
  defaultTag: { background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' },
  pendingTag: { background: '#fff7ed', color: '#9a3412' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  addBtn: { minHeight: 34, borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  form: { border: '1px solid var(--color-border)', borderRadius: 10, padding: 10, display: 'grid', gap: 10, background: '#f8fafc' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 },
  label: { display: 'grid', gap: 4, fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' },
  input: { minHeight: 36, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', padding: '0 9px', fontSize: 13, color: '#111827' },
  textarea: { minHeight: 68, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', padding: 9, fontSize: 13, color: '#111827', resize: 'vertical' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: { minHeight: 34, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#334155', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }
};

const normalizePremise = (premise = {}) => ({
  ...emptyPremise,
  ...premise,
  premiseLabel: premise.premiseLabel || premise.premise_label || '',
  premiseType: 'Shipping',
  contactPerson: premise.contactPerson || premise.contact_person || '',
  areaName: premise.areaName || premise.area_name || '',
  googleMapUrl: premise.googleMapUrl || premise.google_map_url || '',
  placeOfSupply: premise.placeOfSupply || premise.place_of_supply || '',
  isDefault: Boolean(premise.isDefault || premise.is_default),
  isShipping: true
});

const buildLegacyPremise = (customer = {}, form = {}) => {
  const safeCustomer = customer && typeof customer === 'object' ? customer : {};
  const safeForm = form && typeof form === 'object' ? form : {};

  return normalizePremise({
  premiseId: 'legacy-main',
  premiseLabel: 'Shipping Address',
  premiseType: 'Shipping',
  contactPerson: safeForm.contactPersonName || safeCustomer.contactPersonName || safeCustomer.name || '',
  phone: safeForm.mobileNumber || safeCustomer.mobileNumber || safeCustomer.workPhone || '',
  email: safeForm.emailId || safeCustomer.emailId || safeCustomer.email || '',
  address: safeForm.shippingAddress || safeCustomer.shippingAddress || [safeForm.shippingStreet1, safeForm.shippingStreet2].filter(Boolean).join(', '),
  areaName: safeForm.shippingArea || safeCustomer.shippingArea || safeCustomer.area || '',
  city: safeCustomer.city || '',
  state: safeForm.shippingState || safeCustomer.shippingState || safeCustomer.state || 'Delhi',
  pincode: safeForm.shippingPincode || safeCustomer.shippingPincode || safeCustomer.pincode || '',
  country: 'India',
  gstNumber: safeForm.gstNumber || safeCustomer.gstNumber || '',
  placeOfSupply: safeForm.shippingState || safeCustomer.placeOfSupply || safeCustomer.state || '',
  isDefault: true,
  isShipping: true
  });
};

const premiseAddressText = (premise = {}) => [
  premise.address,
  premise.areaName,
  [premise.city, premise.state].filter(Boolean).join(', '),
  [premise.country, premise.pincode].filter(Boolean).join(' ')
].filter(Boolean).join('\n');

export default function CustomerPremisesPanel({
  customerId,
  customer,
  form,
  onError,
  pendingPremises = [],
  onPendingPremisesChange = () => {}
}) {
  const [premises, setPremises] = useState([]);
  const [draft, setDraft] = useState(emptyPremise);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);

  const legacyPremise = useMemo(() => buildLegacyPremise(customer, form), [customer, form]);
  const visiblePremises = useMemo(() => {
    const base = customerId ? premises : [legacyPremise, ...pendingPremises];
    const seen = new Set();
    return base.filter((premise) => {
      const key = String(premise?.premiseId || premise?.premise_id || premise?.premiseLabel || premise?.premise_label || premise?.address || '').trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customerId, legacyPremise, pendingPremises, premises]);

  const loadPremises = async () => {
    if (!customerId) {
      setPremises([]);
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/customers/${customerId}/premises`);
      setPremises(Array.isArray(res.data) ? res.data.map(normalizePremise) : []);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to load customer premises.');
      console.error('Failed to load premises', { message, status: error?.response?.status, data: error?.response?.data, customerId });
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPremises();
  }, [customerId]);

  const beginAdd = () => {
    setEditingId('new');
    setDraft({
      ...emptyPremise,
      contactPerson: form?.contactPersonName || customer?.contactPersonName || '',
      phone: form?.mobileNumber || customer?.mobileNumber || '',
      email: form?.emailId || customer?.emailId || '',
      gstNumber: form?.gstNumber || customer?.gstNumber || '',
      placeOfSupply: form?.billingState || customer?.placeOfSupply || ''
    });
  };

  const beginEdit = (premise) => {
    setEditingId(premise.premiseId || premise.premise_id || '');
    setDraft(normalizePremise(premise));
  };

  const saveDraft = async () => {
    if (!String(draft.address || '').trim()) {
      onError?.('Premise address is required.');
      return;
    }
    if (draft.pincode && !/^\d{6}$/.test(String(draft.pincode))) {
      onError?.('Pincode should be exactly 6 digits.');
      return;
    }
    if (!customerId) {
      const tempPremiseId = editingId && editingId !== 'new'
        ? editingId
        : `TEMP-${Date.now()}`;
      const nextPremise = normalizePremise({
        ...draft,
        premiseId: tempPremiseId,
        premise_id: tempPremiseId,
        premiseLabel: draft.premiseLabel || 'Shipping Address',
        premiseType: 'Shipping',
        isDefault: Boolean(draft.isDefault),
        isShipping: true
      });
      onPendingPremisesChange((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((premise) => String(premise?.premiseId || premise?.premise_id || '') === tempPremiseId);
        if (idx >= 0) {
          list[idx] = nextPremise;
        } else {
          list.push(nextPremise);
        }
        return list;
      });
      onError?.('');
      setEditingId('');
      setDraft(emptyPremise);
      return;
    }
    try {
      if (editingId === 'new') {
        await axios.post(`${API_BASE_URL}/api/customers/${customerId}/premises`, draft);
      } else {
        await axios.put(`${API_BASE_URL}/api/customers/${customerId}/premises/${editingId}`, draft);
      }
      setEditingId('');
      setDraft(emptyPremise);
      await loadPremises();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to save premise.');
      console.error('Failed to save premise', { message, status: error?.response?.status, data: error?.response?.data, customerId, editingId, draft });
      onError?.(message);
    }
  };

  const deletePremise = async (premise) => {
    if (!premise?.premiseId) return;
    if (!customerId || String(premise.premiseId).startsWith('TEMP-')) {
      onPendingPremisesChange((prev) => (Array.isArray(prev)
        ? prev.filter((row) => String(row?.premiseId || row?.premise_id || '') !== String(premise.premiseId))
        : []));
      return;
    }
    if (!window.confirm('Delete this premise? At least one active premise must remain.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customerId}/premises/${premise.premiseId}`);
      await loadPremises();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to delete premise.');
      console.error('Failed to delete premise', { message, status: error?.response?.status, data: error?.response?.data, customerId, premise });
      onError?.(message);
    }
  };

  const setDefault = async (premise) => {
    if (!premise?.premiseId) return;
    if (!customerId || String(premise.premiseId).startsWith('TEMP-')) {
      onPendingPremisesChange((prev) => (Array.isArray(prev)
        ? prev.map((row) => ({
          ...row,
          isDefault: String(row?.premiseId || row?.premise_id || '') === String(premise.premiseId)
        }))
        : []));
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/customers/${customerId}/premises/${premise.premiseId}/set-default`);
      await loadPremises();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to set default premise.');
      console.error('Failed to set default premise', { message, status: error?.response?.status, data: error?.response?.data, customerId, premise });
      onError?.(message);
    }
  };

  const reverseGeocodePremise = async (lat, lng) => {
    try {
      await loadGooglePlacesScript();
    } catch {
      // Geocoder may already be available.
    }

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || !window.google?.maps?.Geocoder) return null;

    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
      const first = response?.results?.[0];
      if (!first) return null;
      const extracted = formatGoogleAddressParts(first);
      const formattedAddress = extracted.address || String(first.formatted_address || '').trim();
      const areaName = extracted.areaName;
      const city = extracted.city;
      const state = extracted.state;
      const pincode = extracted.pincode;

      setDraft((prev) => ({
        ...prev,
        address: formattedAddress || prev.address,
        areaName: areaName || prev.areaName,
        city: city || prev.city,
        state: state || prev.state,
        pincode: pincode ? pincode.slice(0, 6) : prev.pincode
      }));

      return { formattedAddress, areaName, city, state, pincode };
    } catch {
      return null;
    }
  };

  const resolvePremiseMapInput = async (rawValue) => {
    const text = String(rawValue || '').trim();
    if (!text) return false;

    const coords = extractGoogleMapsCoordinates(text);
    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
      await reverseGeocodePremise(coords.latitude, coords.longitude);
      setDraft((prev) => ({
        ...prev,
        googleMapUrl: text
      }));
      return true;
    }

    if (!isAllowedGoogleMapsUrl(text) && !isGoogleMapsShortLink(text)) return false;

    try {
      const result = await resolveGoogleMapsUrl(text, { apiBaseUrl: API_BASE_URL });
      if (!result?.success || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
        onError?.('Could not read this Google Maps short link. Please paste full Google Maps URL or coordinates.');
        return true;
      }

      await reverseGeocodePremise(result.latitude, result.longitude);
      setDraft((prev) => ({
        ...prev,
        googleMapUrl: text
      }));
      return true;
    } catch {
      onError?.('Could not read this Google Maps short link. Please paste full Google Maps URL or coordinates.');
      return true;
    }
  };

  const handlePremiseTextPaste = (event) => {
    const pastedText = String(event.clipboardData?.getData('text') || '').trim();
    if (!pastedText) return;
    if (extractGoogleMapsCoordinates(pastedText) || isAllowedGoogleMapsUrl(pastedText) || isGoogleMapsShortLink(pastedText)) {
      event.preventDefault();
      void resolvePremiseMapInput(pastedText);
    }
  };

  return (
    <section style={styles.wrap}>
      <div style={styles.head}>
        <div>
          <h3 style={styles.title}>Shipping Addresses</h3>
          <p style={styles.sub}>{customerId ? 'Manage shipping addresses.' : 'Main shipping address will become the default premise after saving.'}</p>
        </div>
        <button type="button" style={styles.addBtn} onClick={beginAdd}>
          <Plus size={15} /> Add New Address
        </button>
      </div>

      <div style={styles.grid}>
        {visiblePremises.map((premise) => {
          const normalized = normalizePremise(premise);
          const active = normalized.isDefault;
          const isPending = String(normalized.premiseId || normalized.premise_id || '').startsWith('TEMP-');
          return (
            <article key={normalized.premiseId || normalized.premise_id || 'legacy'} style={{ ...styles.card, ...(active ? styles.activeCard : {}) }}>
              <div style={styles.cardTop}>
                <div>
                  <p style={styles.cardTitle}><MapPin size={14} /> Shipping Address</p>
                  {normalized.premiseLabel ? <p style={styles.text}>{normalized.premiseLabel}</p> : null}
                  <p style={styles.text}>{premiseAddressText(normalized) || 'Address not entered'}</p>
                </div>
                <div style={styles.actions}>
                  {customerId ? (
                    <button type="button" style={styles.iconBtn} onClick={() => beginEdit(normalized)} title="Edit premise"><Pencil size={14} /></button>
                  ) : null}
                  {customerId && !normalized.isDefault ? (
                    <button type="button" style={styles.iconBtn} onClick={() => deletePremise(normalized)} title="Delete premise"><Trash2 size={14} /></button>
                  ) : null}
                </div>
              </div>
              <div style={styles.tags}>
                {normalized.isDefault ? <span style={{ ...styles.tag, ...styles.defaultTag }}><Star size={11} /> Default</span> : null}
                {normalized.isShipping ? <span style={styles.tag}>Shipping</span> : null}
                {isPending ? <span style={{ ...styles.tag, ...styles.pendingTag }}>Pending</span> : null}
              </div>
              {customerId && !normalized.isDefault ? (
                <button type="button" style={styles.secondaryBtn} onClick={() => setDefault(normalized)}><Check size={14} /> Set Default</button>
              ) : null}
            </article>
          );
        })}
      </div>

      {loading ? <p style={styles.text}>Loading premises...</p> : null}

      {editingId ? (
        <div style={styles.form}>
          <div style={styles.formGrid}>
            <label style={styles.label}>Address Label<input style={styles.input} value={draft.premiseLabel} onChange={(e) => setDraft((p) => ({ ...p, premiseLabel: e.target.value }))} /></label>
            <label style={styles.label}>Premise Type<select style={styles.input} value="Shipping" disabled><option>Shipping</option></select></label>
            <label style={styles.label}>Contact Person<input style={styles.input} value={draft.contactPerson} onChange={(e) => setDraft((p) => ({ ...p, contactPerson: e.target.value }))} /></label>
            <label style={styles.label}>Phone<input style={styles.input} inputMode="numeric" value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: normalizeIndianMobileNumber(e.target.value) }))} /></label>
            <label style={styles.label}>Email<input style={styles.input} value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} /></label>
            <label style={{ ...styles.label, gridColumn: '1 / -1' }}>Full Address<textarea style={styles.textarea} value={draft.address} onPaste={handlePremiseTextPaste} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} /></label>
            <label style={styles.label}>Area Name<input style={styles.input} value={draft.areaName} onChange={(e) => setDraft((p) => ({ ...p, areaName: e.target.value }))} /></label>
            <label style={styles.label}>City<input style={styles.input} value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} /></label>
            <label style={styles.label}>State<input style={styles.input} value={draft.state} onChange={(e) => setDraft((p) => ({ ...p, state: e.target.value, placeOfSupply: p.placeOfSupply || e.target.value }))} /></label>
            <label style={styles.label}>Pincode<input style={styles.input} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={draft.pincode} onChange={(e) => setDraft((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} /></label>
            <label style={styles.label}>Country<input style={styles.input} value={draft.country} onChange={(e) => setDraft((p) => ({ ...p, country: e.target.value }))} /></label>
            <label style={styles.label}>Place of Supply<input style={styles.input} value={draft.placeOfSupply} onChange={(e) => setDraft((p) => ({ ...p, placeOfSupply: e.target.value }))} /></label>
            <label style={styles.label}>Google Map URL<input style={styles.input} value={draft.googleMapUrl} onPaste={(event) => {
              const pastedText = String(event.clipboardData?.getData('text') || '').trim();
              if (!pastedText) return;
              if (extractGoogleMapsCoordinates(pastedText) || isAllowedGoogleMapsUrl(pastedText) || isGoogleMapsShortLink(pastedText)) {
                event.preventDefault();
                void resolvePremiseMapInput(pastedText);
              }
            }} onChange={(e) => setDraft((p) => ({ ...p, googleMapUrl: e.target.value }))} /></label>
          </div>
          <div style={styles.tags}>
            <label><input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft((p) => ({ ...p, isDefault: e.target.checked }))} /> Default</label>
          </div>
          <div style={styles.footer}>
            <button type="button" style={styles.secondaryBtn} onClick={() => { setEditingId(''); setDraft(emptyPremise); }}><X size={14} /> Cancel</button>
            <button type="button" style={styles.addBtn} onClick={saveDraft}><Check size={14} /> Save Address</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
