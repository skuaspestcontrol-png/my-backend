import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import CustomerImportDedupWizard from './CustomerImportDedupWizard';
import CustomerPremisesPanel from './CustomerPremisesPanel';
import MapPicker from './MapPicker';
import useAutoRefresh from '../hooks/useAutoRefresh';
import {
  attachPlacesAutocomplete,
  loadGooglePlacesScript,
  formatGoogleAddressParts,
  getGoogleFormattedAddressText,
  stripAutoFilledIndiaSuffix
} from '../utils/googlePlaces';
import {
  extractGoogleMapsCoordinates,
  isAllowedGoogleMapsUrl,
  isGoogleMapsShortLink,
  resolveGoogleMapsUrl
} from '../utils/googleMaps';
import { PHONE_VALIDATION_ERROR, normalizeIndianMobileNumber } from '../utils/phone';

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

const allColumns = [
  { key: 'name', label: 'Display Name' },
  { key: 'segment', label: 'Segment' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'contactPersonName', label: 'Contact Person' },
  { key: 'position', label: 'Position' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'whatsappNumber', label: 'WhatsApp Number' },
  { key: 'altNumber', label: 'Alt Number' },
  { key: 'emailId', label: 'Email Id' },
  { key: 'hasGst', label: 'GST Registered' },
  { key: 'gstNumber', label: 'GST Number' },
  { key: 'billingAttention', label: 'Billing Attention' },
  { key: 'billingStreet1', label: 'Billing Street 1' },
  { key: 'billingStreet2', label: 'Billing Street 2' },
  { key: 'billingAddress', label: 'Billing Address' },
  { key: 'billingArea', label: 'Billing Area' },
  { key: 'billingState', label: 'Billing State' },
  { key: 'billingPincode', label: 'Billing Pincode' },
  { key: 'shippingAttention', label: 'Shipping Attention' },
  { key: 'shippingStreet1', label: 'Shipping Street 1' },
  { key: 'shippingStreet2', label: 'Shipping Street 2' },
  { key: 'shippingAddress', label: 'Shipping Address' },
  { key: 'shippingArea', label: 'Shipping Area' },
  { key: 'shippingState', label: 'Shipping State' },
  { key: 'shippingPincode', label: 'Shipping Pincode' },
  { key: 'areaSqft', label: 'Area in sqft' }
];

const customerImportExportColumns = [
  { key: 'segment', label: 'Segment' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'contactPersonName', label: 'Contact Person Name' },
  { key: 'displayName', label: 'Display Name' },
  { key: 'position', label: 'Position' },
  { key: 'positionCustom', label: 'Position Custom' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'whatsappSameAsMobile', label: 'WhatsApp Same As Mobile' },
  { key: 'whatsappNumber', label: 'WhatsApp Number' },
  { key: 'altNumber', label: 'Alt Number' },
  { key: 'emailId', label: 'Email Id' },
  { key: 'hasGst', label: 'GST Registered' },
  { key: 'gstNumber', label: 'GST Number' },
  { key: 'billingAttention', label: 'Billing Attention' },
  { key: 'billingStreet1', label: 'Billing Street 1' },
  { key: 'billingStreet2', label: 'Billing Street 2' },
  { key: 'billingAddress', label: 'Billing Address' },
  { key: 'billingArea', label: 'Billing Area' },
  { key: 'billingState', label: 'Billing State' },
  { key: 'billingPincode', label: 'Billing Pincode' },
  { key: 'billingPhoneCode', label: 'Billing Phone Code' },
  { key: 'billingPhone', label: 'Billing Phone' },
  { key: 'shippingSameAsBilling', label: 'Shipping Same As Billing' },
  { key: 'shippingAttention', label: 'Shipping Attention' },
  { key: 'shippingStreet1', label: 'Shipping Street 1' },
  { key: 'shippingStreet2', label: 'Shipping Street 2' },
  { key: 'shippingAddress', label: 'Shipping Address' },
  { key: 'shippingArea', label: 'Shipping Area' },
  { key: 'shippingState', label: 'Shipping State' },
  { key: 'shippingPincode', label: 'Shipping Pincode' },
  { key: 'shippingPhoneCode', label: 'Shipping Phone Code' },
  { key: 'shippingPhone', label: 'Shipping Phone' },
  { key: 'areaSqft', label: 'Area in sqft' },
  { key: 'googlePlaceId', label: 'Google Place Id' },
  { key: 'googlePlaceName', label: 'Google Place Name' },
  { key: 'googlePhone', label: 'Google Phone' },
  { key: 'googleWebsite', label: 'Google Website' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' }
];

const defaultVisibleColumns = ['name', 'segment', 'companyName', 'contactPersonName', 'mobileNumber', 'emailId', 'billingState', 'shippingState'];
const mobileCustomerColumnWidths = {
  name: 190,
  segment: 130,
  companyName: 180,
  contactPersonName: 170,
  position: 130,
  mobileNumber: 150,
  whatsappNumber: 160,
  altNumber: 140,
  emailId: 200,
  hasGst: 130,
  gstNumber: 170,
  billingAttention: 170,
  billingStreet1: 190,
  billingStreet2: 190,
  billingAddress: 220,
  billingArea: 160,
  billingState: 150,
  billingPincode: 150,
  shippingAttention: 180,
  shippingStreet1: 190,
  shippingStreet2: 190,
  shippingAddress: 220,
  shippingArea: 170,
  shippingState: 160,
  shippingPincode: 160,
  areaSqft: 130
};
const mobileCustomerDefaultColumnWidth = 150;
const stateOptions = [
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
const positionOptions = ['Owner', 'Manager', 'Edit type'];

const createAddressSearchState = () => ({
  billing: { error: '', suggestions: [], showSuggestions: false, fetching: false },
  shipping: { error: '', suggestions: [], showSuggestions: false, fetching: false }
});

const emptyForm = {
  segment: 'Residential',
  companyName: '',
  contactPersonName: '',
  displayName: '',
  position: 'Owner',
  positionCustom: '',
  mobileNumber: '',
  whatsappSameAsMobile: false,
  whatsappNumber: '',
  altNumber: '',
  emailId: '',
  hasGst: false,
  gstNumber: '',
  billingAttention: '',
  billingSearchAddress: '',
  billingStreet1: '',
  billingStreet2: '',
  billingAddress: '',
  billingArea: '',
  billingState: 'Delhi',
  billingPincode: '',
  billingLatitude: '',
  billingLongitude: '',
  billingGooglePlaceId: '',
  billingGooglePlaceName: '',
  billingGooglePhone: '',
  billingGoogleWebsite: '',
  billingPhoneCode: '+91',
  billingPhone: '',
  shippingSameAsBilling: false,
  shippingAttention: '',
  shippingSearchAddress: '',
  shippingStreet1: '',
  shippingStreet2: '',
  shippingAddress: '',
  shippingArea: '',
  shippingState: 'Delhi',
  shippingPincode: '',
  shippingLatitude: '',
  shippingLongitude: '',
  shippingGooglePlaceId: '',
  shippingGooglePlaceName: '',
  shippingPhoneCode: '+91',
  shippingPhone: '',
  areaSqft: '',
  googlePlaceId: '',
  googlePlaceName: '',
  googlePhone: '',
  googleWebsite: '',
  latitude: '',
  longitude: ''
};

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

const shell = {
  page: { background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.94) 100%)', border: '1px solid var(--color-border)', borderRadius: '20px', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)', overflow: 'visible', position: 'relative', backgroundClip: 'padding-box' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 18px', borderBottom: '1px solid var(--color-border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', backgroundClip: 'padding-box' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: 0, borderRadius: 0, background: 'transparent', border: 'none' },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937' },
  topActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '9px', padding: '7px 11px', minHeight: '34px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '12px' },
  buttonGhost: { border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', borderRadius: '9px', width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  toolbar: { padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.96)' },
  toolLabel: { fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  customizeButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' },
  duplicateFilterButton: { display: 'inline-flex', alignItems: 'center', border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '999px', padding: '4px 8px', minHeight: '24px', fontSize: '11px', lineHeight: 1.2, fontWeight: 800, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', maxWidth: '100%', backgroundClip: 'padding-box' },
  table: { width: '100%', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  headCell: { textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#6b7280', padding: '3px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', lineHeight: 1.05 },
  headCellResizable: { position: 'relative', paddingRight: '16px' },
  headLabelWrap: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headSortButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', padding: 0, color: '#6b7280', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' },
  resizeHandle: { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '7px 10px', fontSize: '12px', fontWeight: 500, color: '#334155', verticalAlign: 'middle', lineHeight: 1.25 },
  cellClamp: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nameCell: { color: 'var(--color-primary)', fontWeight: 400, cursor: 'pointer', textDecoration: 'underline dotted rgba(159,23,77,0.45)' },
  rowActionButton: {
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    borderRadius: '8px',
    minWidth: '68px',
    minHeight: '30px',
    padding: '0 10px',
    fontSize: '12px',
    lineHeight: 1.2,
    fontWeight: 700,
    cursor: 'pointer'
  },
  checkboxWrap: { width: '40px', textAlign: 'center' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  menu: { position: 'absolute', right: 0, top: '38px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', width: '188px', boxShadow: '0 12px 28px rgba(15,23,42,0.12)', zIndex: 20, overflow: 'hidden', padding: '3px 0' },
  menuButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', lineHeight: 1.1, whiteSpace: 'normal', wordSpacing: '-1px' },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--color-primary-soft)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', width: '250px', zIndex: 40 },
  popoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '270px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto', backdropFilter: 'blur(12px)' },
  modal: { background: '#fff', width: 'min(100%, 1040px)', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { minHeight: '64px', padding: '16px 22px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '24px', lineHeight: 1.2, fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  modalHeaderTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  modalCloseButton: { border: 'none', background: 'transparent', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalBody: { padding: '20px 24px', display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', columnGap: '16px', rowGap: '12px', alignItems: 'center', overflowY: 'auto', background: '#fff' },
  addressSplit: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px', marginTop: '6px' },
  addressCard: { border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px', background: '#fff' },
  addressTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: 1.2 },
  addressHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  addressCopy: { fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', border: 'none', background: 'transparent', padding: 0, lineHeight: 1.2 },
  addressGrid: { display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', rowGap: '10px', columnGap: '10px', alignItems: 'center' },
  label: { fontSize: '12px', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' },
  input: { border: '1px solid #D1D5DB', borderRadius: '11px', padding: '0 12px', fontSize: '14px', outline: 'none', width: '100%', minHeight: '40px' },
  textarea: { border: '1px solid #D1D5DB', borderRadius: '11px', padding: '10px 12px', fontSize: '14px', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical' },
  amountRow: { display: 'grid', gridTemplateColumns: '56px 1fr', gap: 0 },
  currencyTag: { border: '1px solid #D1D5DB', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '6px 8px', fontSize: '12px', color: '#334155', background: '#f8fafc' },
  amountInput: { border: '1px solid #D1D5DB', borderRadius: '0 8px 8px 0', padding: '6px 8px', fontSize: '12px', outline: 'none', width: '100%' },
  inlineChecks: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#111827' },
  modalFooter: { padding: '12px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fff' },
  cancelButton: { minHeight: '40px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '12px', padding: '0 16px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { minHeight: '40px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '12px', padding: '0 16px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' },
  historyOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.52)', zIndex: 3000, display: 'grid', placeItems: 'center', padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto' },
  historyModal: { width: 'min(100%, 1260px)', maxHeight: '94vh', background: '#fff', borderRadius: '12px', border: '1px solid var(--color-primary-soft)', boxShadow: '0 20px 44px rgba(15,23,42,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  historyHeader: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  historyTitle: { margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  historySubTitle: { margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 },
  historyClose: { border: '1px solid #d1d5db', background: '#fff', borderRadius: '10px', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155' },
  historyBody: { padding: '12px 14px', overflowY: 'auto', display: 'grid', gap: '12px' },
  historyTabs: { display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' },
  historyTabBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  historyTabBtnActive: { borderColor: '#93c5fd', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' },
  historyStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  historyStatCard: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px', background: '#fff' },
  historyStatLabel: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' },
  historyStatValue: { margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  historyProfitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
  historyProfitCard: { border: '1px solid rgba(148,163,184,0.18)', borderRadius: '12px', padding: '10px 12px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: '0 8px 20px rgba(15,23,42,0.05)' },
  historyProfitCardProfit: { borderColor: 'rgba(22,163,74,0.22)', background: 'rgba(22,163,74,0.08)' },
  historyProfitCardLoss: { borderColor: 'rgba(220,38,38,0.22)', background: 'rgba(220,38,38,0.08)' },
  historyProfitCardAmber: { borderColor: 'rgba(217,119,6,0.22)', background: 'rgba(217,119,6,0.08)' },
  historyProfitLabel: { margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  historyProfitValue: { margin: '6px 0 0 0', fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  historyBreakdownGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '8px' },
  historyBreakdownCard: { border: '1px solid rgba(148,163,184,0.16)', borderRadius: '12px', background: '#fff', padding: '10px 12px', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' },
  historyBreakdownLabel: { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  historyBreakdownValue: { margin: '4px 0 0', fontSize: '15px', color: '#0f172a', fontWeight: 800 },
  historySectionTitleSmall: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' },
  historyTableCompact: { width: '100%', minWidth: '880px', borderCollapse: 'separate', borderSpacing: 0 },
  historyHeadCellCompact: { textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#6b7280', padding: '9px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', background: '#f8fafc' },
  historyCellCompact: { padding: '9px 10px', fontSize: '12px', color: '#111827', verticalAlign: 'top', borderBottom: '1px solid #eef2f7', background: '#fff' },
  historyProfitNote: { margin: 0, padding: '10px 12px', borderRadius: '12px', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', border: '1px solid rgba(148,163,184,0.18)', fontSize: '12px', color: '#475569', fontWeight: 600, lineHeight: 1.5 },
  historyGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' },
  historySection: { border: '1px solid rgba(148,163,184,0.18)', borderRadius: '12px', background: '#fff', overflow: 'hidden', boxShadow: '0 10px 24px rgba(15,23,42,0.05)' },
  historySectionHead: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' },
  historySectionTitle: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' },
  historyTableWrap: { overflowX: 'auto' },
  historyTable: { width: '100%', minWidth: '760px', borderCollapse: 'collapse' },
  historyHeadCell: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '10px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  historyRow: { borderBottom: '1px solid #eef2f7' },
  historyCell: { padding: '10px 10px', fontSize: '14px', color: '#111827', verticalAlign: 'top' },
  historyMetaBox: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' },
  historyMetaLabel: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  historyMetaValue: { margin: '4px 0 0 0', fontSize: '14px', color: '#0f172a', fontWeight: 600 },
  historyEmpty: { margin: 0, padding: '16px 12px', fontSize: '13px', color: '#64748b' },
  paginationBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    borderTop: '1px solid var(--color-border)',
    background: '#fff',
    borderBottomLeftRadius: '20px',
    borderBottomRightRadius: '20px',
    backgroundClip: 'padding-box',
    boxShadow: 'inset 1px 0 0 rgba(203, 213, 225, 0.9), inset -1px 0 0 rgba(203, 213, 225, 0.9), inset 0 -1px 0 rgba(203, 213, 225, 0.9)'
  },
  paginationText: { fontSize: '12px', color: '#475569', fontWeight: 600 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  paginationButton: { border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '8px', width: '34px', minWidth: '34px', minHeight: '32px', padding: 0, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
};

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isCustomerRecord = (customer) => Boolean(customer && typeof customer === 'object' && !Array.isArray(customer));
const sanitizeCustomerRows = (rows) => (Array.isArray(rows) ? rows.filter(isCustomerRecord) : []);

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showDuplicateReport, setShowDuplicateReport] = useState(false);
  const [duplicateSummary, setDuplicateSummary] = useState(null);
  const [duplicateRows, setDuplicateRows] = useState([]);
  const [possibleDuplicateIds, setPossibleDuplicateIds] = useState([]);
  const [showPossibleDuplicatesOnly, setShowPossibleDuplicatesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState('');
  const [historyTab, setHistoryTab] = useState('transactions');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyProfitLoading, setHistoryProfitLoading] = useState(false);
  const [historyProfitError, setHistoryProfitError] = useState('');
  const [historyProfitSnapshot, setHistoryProfitSnapshot] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [similarCustomers, setSimilarCustomers] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addressSearchState, setAddressSearchState] = useState(createAddressSearchState);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('customers_visible_columns');
    return saved ? JSON.parse(saved) : defaultVisibleColumns;
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('customers_column_widths');
    return saved ? JSON.parse(saved) : {};
  });
  const [nameSortDirection, setNameSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreMenuButtonRef = useRef(null);
  const resizeStateRef = useRef(null);
  const billingAreaInputRef = useRef(null);
  const billingSearchInputRef = useRef(null);
  const shippingSearchInputRef = useRef(null);
  const addressSuggestionSeqRef = useRef({ billing: 0, shipping: 0 });

  const visibleColumnDefs = useMemo(
    () => allColumns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );
  const rowsPerPage = 20;
  const toTenDigitNumber = normalizeIndianMobileNumber;
  const toSixDigitPincode = (value) => String(value || '').replace(/\D+/g, '').slice(0, 6);
  const isValidPincode = (value) => !value || /^\d{6}$/.test(value);
  const normalizeIncomingCustomerPrefill = (prefill = {}) => {
    const next = {
      ...emptyForm,
      ...(prefill && typeof prefill === 'object' ? prefill : {})
    };

    const mobileNumber = toTenDigitNumber(next.mobileNumber || next.workPhone || '');
    const whatsappNumber = toTenDigitNumber(next.whatsappNumber || mobileNumber);
    const altNumber = toTenDigitNumber(next.altNumber || '');
    const hasGst = Boolean(next.hasGst || next.gstRegistered);

    return {
      ...next,
      segment: next.segment === 'Commercial' ? 'Commercial' : 'Residential',
      mobileNumber,
      whatsappNumber,
      altNumber,
      billingSearchAddress: String(next.billingSearchAddress || next.searchAddress || next.billingAddress || next.address || '').trim(),
      billingLatitude: String(next.billingLatitude || next.latitude || '').trim(),
      billingLongitude: String(next.billingLongitude || next.longitude || '').trim(),
      billingGooglePlaceId: String(next.billingGooglePlaceId || next.googlePlaceId || '').trim(),
      billingGooglePlaceName: String(next.billingGooglePlaceName || next.googlePlaceName || '').trim(),
      billingGooglePhone: String(next.billingGooglePhone || next.googlePhone || '').trim(),
      billingGoogleWebsite: String(next.billingGoogleWebsite || next.googleWebsite || '').trim(),
      billingPincode: toSixDigitPincode(next.billingPincode || next.pincode || ''),
      shippingSearchAddress: String(next.shippingSearchAddress || next.shippingAddress || '').trim(),
      shippingLatitude: String(next.shippingLatitude || '').trim(),
      shippingLongitude: String(next.shippingLongitude || '').trim(),
      shippingGooglePlaceId: String(next.shippingGooglePlaceId || '').trim(),
      shippingGooglePlaceName: String(next.shippingGooglePlaceName || '').trim(),
      shippingPincode: toSixDigitPincode(next.shippingPincode || ''),
      whatsappSameAsMobile: Boolean(next.whatsappSameAsMobile) || (whatsappNumber && whatsappNumber === mobileNumber),
      hasGst,
      gstNumber: hasGst ? String(next.gstNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) : '',
      shippingSameAsBilling: Boolean(next.shippingSameAsBilling)
    };
  };

  const loadCustomers = async (options = {}) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`);
      setCustomers(sanitizeCustomerRows(res.data));
      if (!options.preserveSelection) setSelectedIds([]);
    } catch (error) {
      console.error('Failed to load customers', error);
      setCustomers([]);
      if (!options.preserveSelection) setSelectedIds([]);
    }
  };

  const loadDuplicateReport = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/duplicates/report`);
      setDuplicateSummary(res.data?.summary || null);
      setDuplicateRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
      setPossibleDuplicateIds(Array.isArray(res.data?.possibleDuplicateCustomerIds) ? res.data.possibleDuplicateCustomerIds : []);
    } catch (error) {
      console.error('Failed to load duplicate report', error);
      setDuplicateSummary(null);
      setDuplicateRows([]);
      setPossibleDuplicateIds([]);
    }
  };

  const loadTransactions = async () => {
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/invoices`),
        axios.get(`${API_BASE_URL}/api/payments`)
      ]);
      setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
      return true;
    } catch (error) {
      console.error('Failed to load customer transactions', error);
      setInvoices([]);
      setPayments([]);
      return false;
    }
  };

  const loadCustomerProfitSnapshot = async (customerId) => {
    if (!customerId) return false;
    try {
      setHistoryProfitLoading(true);
      setHistoryProfitError('');
      const res = await axios.get(`${API_BASE_URL}/api/customers/${customerId}/profit-loss`);
      setHistoryProfitSnapshot(res.data || null);
      return true;
    } catch (error) {
      console.error('Failed to load customer profit summary', error);
      setHistoryProfitSnapshot(null);
      setHistoryProfitError(error?.response?.data?.error || 'Could not load profit and cost summary.');
      return false;
    } finally {
      setHistoryProfitLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
      loadTransactions();
      loadDuplicateReport();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useAutoRefresh(async () => {
    await Promise.all([
      loadCustomers({ preserveSelection: true }),
      loadTransactions(),
      loadDuplicateReport()
    ]);
  }, { enabled: !showModal && !showImportWizard });

  useEffect(() => {
    const incomingState = location.state;
    if (!incomingState || !incomingState.openNewCustomer) return;

    setEditingId(null);
    setForm(normalizeIncomingCustomerPrefill(incomingState.prefillCustomerFromLead));
    setAddressSearchState(createAddressSearchState());
    setSaveError('');
    setShowModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    localStorage.setItem('customers_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('customers_column_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    if (!showModal) setAddressSearchState(createAddressSearchState());
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return () => {};
    let cleanups = [];

    const initPlaces = async () => {
      const billingCleanup = await attachPlacesAutocomplete({
        input: billingAreaInputRef.current,
        onSelected: (place) => {
          applyCustomerAddressSuggestion('billing', place, place.formatted_address || place.name || '', { fillCompanyNameIfEmpty: true });
        },
        onError: (error) => alert(error?.message || 'Google Maps API key not configured'),
        onRequireSelection: (message) => alert(message || 'Please select address/company from suggestions')
      });

      const billingSearchCleanup = await attachPlacesAutocomplete({
        input: billingSearchInputRef.current,
        onSelected: (place) => {
          const queryText = String(billingSearchInputRef.current?.value || place.formatted_address || place.name || '').trim();
          applyCustomerAddressSuggestion('billing', place, queryText);
          setAddressSearchState((prev) => ({
            ...prev,
            billing: { ...prev.billing, error: '', suggestions: [], showSuggestions: false }
          }));
        },
        onError: () => setAddressSearchState((prev) => ({
          ...prev,
          billing: { ...prev.billing, error: '' }
        })),
        onRequireSelection: (message) => setAddressSearchState((prev) => ({
          ...prev,
          billing: { ...prev.billing, error: message || 'Please select address/company from suggestions' }
        }))
      });

      const shippingSearchCleanup = await attachPlacesAutocomplete({
        input: shippingSearchInputRef.current,
        onSelected: (place) => {
          const queryText = String(shippingSearchInputRef.current?.value || place.formatted_address || place.name || '').trim();
          applyCustomerAddressSuggestion('shipping', place, queryText);
          setAddressSearchState((prev) => ({
            ...prev,
            shipping: { ...prev.shipping, error: '', suggestions: [], showSuggestions: false }
          }));
        },
        onError: () => setAddressSearchState((prev) => ({
          ...prev,
          shipping: { ...prev.shipping, error: '' }
        })),
        onRequireSelection: (message) => setAddressSearchState((prev) => ({
          ...prev,
          shipping: { ...prev.shipping, error: message || 'Please select address/company from suggestions' }
        }))
      });

      cleanups = [billingCleanup, billingSearchCleanup, shippingSearchCleanup];
    };

    initPlaces();
    return () => {
      cleanups.forEach((fn) => {
        if (typeof fn === 'function') fn();
      });
    };
  }, [showModal]);

  const displayNameOptions = useMemo(() => {
    const options = [form.companyName.trim(), form.contactPersonName.trim()].filter(Boolean);
    return Array.from(new Set(options));
  }, [form.companyName, form.contactPersonName]);

  const selectedHistoryCustomer = useMemo(
    () => customers.find((customer) => customer?._id === historyCustomerId) || null,
    [customers, historyCustomerId]
  );

  const historyCustomerNames = useMemo(() => {
    if (!selectedHistoryCustomer) return new Set();
    const names = [
      selectedHistoryCustomer.displayName,
      selectedHistoryCustomer.name,
      selectedHistoryCustomer.companyName,
      selectedHistoryCustomer.contactPersonName
    ]
      .map(normalizeText)
      .filter(Boolean);
    return new Set(names);
  }, [selectedHistoryCustomer]);

  const historyInvoices = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    return invoices.filter((invoice) => {
      if (invoice.customerId && selectedHistoryCustomer._id && invoice.customerId === selectedHistoryCustomer._id) return true;
      const invoiceCustomerName = normalizeText(invoice.customerName);
      return invoiceCustomerName && historyCustomerNames.has(invoiceCustomerName);
    });
  }, [historyCustomerNames, invoices, selectedHistoryCustomer]);

  const historyPayments = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    const invoiceIds = new Set(historyInvoices.map((invoice) => String(invoice._id || '')));
    const invoiceNumbers = new Set(historyInvoices.map((invoice) => normalizeText(invoice.invoiceNumber)));
    return payments.filter((payment) => {
      if (payment.invoiceId && invoiceIds.has(String(payment.invoiceId))) return true;
      const paymentInvoiceNumber = normalizeText(payment.invoiceNumber);
      if (paymentInvoiceNumber && invoiceNumbers.has(paymentInvoiceNumber)) return true;
      const paymentCustomerName = normalizeText(payment.customerName);
      return paymentCustomerName && historyCustomerNames.has(paymentCustomerName);
    });
  }, [historyCustomerNames, historyInvoices, payments, selectedHistoryCustomer]);

  const historySummary = useMemo(() => {
    const totalInvoiceAmount = historyInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || invoice.total || 0), 0);
    const totalBalanceDue = historyInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);
    const totalReceived = historyPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const avgInvoiceValue = historyInvoices.length > 0 ? totalInvoiceAmount / historyInvoices.length : 0;
    return {
      totalInvoiceAmount,
      totalBalanceDue,
      totalReceived,
      invoiceCount: historyInvoices.length,
      paymentCount: historyPayments.length,
      avgInvoiceValue
    };
  }, [historyInvoices, historyPayments]);

  const historyInvoicesSorted = useMemo(
    () => [...historyInvoices].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [historyInvoices]
  );

  const historyPaymentsSorted = useMemo(
    () => [...historyPayments].sort((a, b) => new Date(b.paymentDate || b.date || 0).getTime() - new Date(a.paymentDate || a.date || 0).getTime()),
    [historyPayments]
  );

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
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCustomize, showMoreMenu]);

  const sortedCustomers = useMemo(() => {
    const multiplier = nameSortDirection === 'asc' ? 1 : -1;
    const sourceRows = showPossibleDuplicatesOnly
      ? customers.filter((customer) => customer?._id && possibleDuplicateIds.includes(customer._id))
      : customers;
    return sanitizeCustomerRows(sourceRows).sort((a, b) => {
      const aName = String(a.displayName || a.name || '').trim();
      const bName = String(b.displayName || b.name || '').trim();
      return aName.localeCompare(bName, 'en', { sensitivity: 'base', numeric: true }) * multiplier;
    });
  }, [customers, nameSortDirection, possibleDuplicateIds, showPossibleDuplicatesOnly]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / rowsPerPage));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedCustomers.slice(start, start + rowsPerPage);
  }, [currentPage, rowsPerPage, sortedCustomers]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const isAllSelected = paginatedCustomers.length > 0 && paginatedCustomers.every((customer) => customer?._id && selectedIds.includes(customer._id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const currentPageIds = new Set(paginatedCustomers.map((customer) => customer?._id).filter(Boolean));
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const ids = new Set(prev);
      paginatedCustomers.forEach((customer) => {
        if (customer?._id) ids.add(customer._id);
      });
      return Array.from(ids);
    });
  };

  const toggleSelectOne = (customerId) => {
    setSelectedIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
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

  const getColumnStyle = (columnKey) => {
    const savedWidth = Number(columnWidths[columnKey]) || 0;
    const mobileWidth = mobileCustomerColumnWidths[columnKey] || mobileCustomerDefaultColumnWidth;
    const width = isMobile ? Math.max(savedWidth, mobileWidth) : savedWidth;
    if (!width) return {};
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` };
  };

  const startColumnResize = (event, columnKey) => {
    event.preventDefault();
    event.stopPropagation();
    const th = event.currentTarget.closest('th');
    const startWidth = columnWidths[columnKey] || th?.offsetWidth || 160;
    resizeStateRef.current = { columnKey, startX: event.clientX, startWidth };

    const onMouseMove = (moveEvent) => {
      if (!resizeStateRef.current) return;
      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const nextWidth = Math.max(110, resizeStateRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [columnKey]: nextWidth }));
    };

    const onMouseUp = () => {
      resizeStateRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const copyBillingToShipping = (source) => ({
    shippingAttention: source.billingAttention,
    shippingSearchAddress: source.billingSearchAddress,
    shippingStreet1: source.billingStreet1,
    shippingStreet2: source.billingStreet2,
    shippingAddress: source.billingAddress,
    shippingArea: source.billingArea,
    shippingState: source.billingState,
    shippingPincode: source.billingPincode,
    shippingLatitude: source.billingLatitude || source.latitude,
    shippingLongitude: source.billingLongitude || source.longitude,
    shippingGooglePlaceId: source.billingGooglePlaceId || source.googlePlaceId,
    shippingGooglePlaceName: source.billingGooglePlaceName || source.googlePlaceName,
    shippingPhoneCode: source.billingPhoneCode,
    shippingPhone: source.billingPhone
  });

  const updateBillingField = (key, value) => {
    setForm((prev) => {
      const nextValue = key === 'billingPincode' ? toSixDigitPincode(value) : value;
      const next = { ...prev, [key]: nextValue };
      if (key === 'billingStreet1') next.billingAddress = nextValue;
      if (prev.shippingSameAsBilling) {
        return { ...next, ...copyBillingToShipping(next) };
      }
      return next;
    });
  };

  const updateShippingField = (key, value) => {
    setForm((prev) => {
      const nextValue = key === 'shippingPincode' ? toSixDigitPincode(value) : value;
      const next = { ...prev, [key]: nextValue };
      if (key === 'shippingStreet1') next.shippingAddress = nextValue;
      return next;
    });
  };

  const setSectionAddressSearchState = (section, patch) => {
    const target = section === 'shipping' ? 'shipping' : 'billing';
    setAddressSearchState((prev) => {
      const current = prev[target] || {};
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      return {
        ...prev,
        [target]: {
          ...current,
          ...(nextPatch || {})
        }
      };
    });
  };

  const validateLatLngRange = (lat, lng) => {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return 'Invalid coordinates. Please paste a valid latitude and longitude.';
    }
    if (Number(lat) < -90 || Number(lat) > 90) return 'Latitude must be between -90 and 90.';
    if (Number(lng) < -180 || Number(lng) > 180) return 'Longitude must be between -180 and 180.';
    return '';
  };

  const validateCoordinatePair = (label, lat, lng) => {
    const latText = String(lat || '').trim();
    const lngText = String(lng || '').trim();
    if (!latText && !lngText) return '';
    if (!latText || !lngText) return `${label} latitude and longitude must both be provided.`;
    const rangeError = validateLatLngRange(latText, lngText);
    return rangeError ? `${label}: ${rangeError}` : '';
  };

  const parseLatLngFromGoogleUrl = (rawText) => {
    const parsed = extractGoogleMapsCoordinates(rawText);
    if (!parsed) return null;
    const validationError = validateLatLngRange(parsed.latitude, parsed.longitude);
    if (validationError) return { error: validationError };
    return {
      latitude: String(parsed.latitude),
      longitude: String(parsed.longitude)
    };
  };

  const extractCustomerAddressFields = (best = {}) => {
    const extracted = formatGoogleAddressParts(best);
    return {
      ...extracted,
      pincode: toSixDigitPincode(extracted.pincode)
    };
  };

  const getCustomerPlaceLatLng = (place = {}) => {
    const rawLat = place.latitude ?? (typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat);
    const rawLng = place.longitude ?? (typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng);
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    return {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null
    };
  };

  const buildCustomerAddressPatch = (section, data = {}, prev = {}) => {
    const isShipping = section === 'shipping';
    const prefix = isShipping ? 'shipping' : 'billing';
    const searchKey = `${prefix}SearchAddress`;
    const streetKey = `${prefix}Street1`;
    const addressKey = `${prefix}Address`;
    const areaKey = `${prefix}Area`;
    const stateKey = `${prefix}State`;
    const pincodeKey = `${prefix}Pincode`;
    const latitudeKey = `${prefix}Latitude`;
    const longitudeKey = `${prefix}Longitude`;
    const placeIdKey = `${prefix}GooglePlaceId`;
    const placeNameKey = `${prefix}GooglePlaceName`;
    const extracted = extractCustomerAddressFields(data);
    const address = extracted.address || getGoogleFormattedAddressText(data) || stripAutoFilledIndiaSuffix(data.address || data.formattedAddress || '', data);
    const area = String(extracted.areaName || data.areaName || data.city || '').trim();
    const state = String(extracted.state || data.state || '').trim();
    const pincode = toSixDigitPincode(extracted.pincode || data.pincode || '');
    const placeId = String(data.placeId || data.googlePlaceId || '').trim();
    const placeName = String(data.placeName || data.googlePlaceName || '').trim();
    const lat = data.latitude !== null && data.latitude !== undefined && data.latitude !== '' ? String(data.latitude).trim() : '';
    const lng = data.longitude !== null && data.longitude !== undefined && data.longitude !== '' ? String(data.longitude).trim() : '';
    const searchAddress = data.preserveSearchAddress
      ? prev[searchKey]
      : String(data.searchAddress || address || placeName || prev[searchKey] || '').trim();

    const patch = {};
    if (searchAddress !== undefined) patch[searchKey] = searchAddress;
    if (address) {
      patch[streetKey] = address;
      patch[addressKey] = address;
    }
    if (area) patch[areaKey] = area;
    if (state) patch[stateKey] = state;
    if (pincode) patch[pincodeKey] = pincode;
    if (lat && lng) {
      patch[latitudeKey] = lat;
      patch[longitudeKey] = lng;
    }
    if (placeId) patch[placeIdKey] = placeId;
    if (placeName) patch[placeNameKey] = placeName;

    if (!isShipping) {
      if (lat && lng) {
        patch.latitude = lat;
        patch.longitude = lng;
      }
      if (placeId) patch.googlePlaceId = placeId;
      if (placeName) patch.googlePlaceName = placeName;
      if (data.googlePhone) {
        patch.googlePhone = String(data.googlePhone || '').trim();
        patch.billingGooglePhone = String(data.googlePhone || '').trim();
      }
      if (data.googleWebsite) {
        patch.googleWebsite = String(data.googleWebsite || '').trim();
        patch.billingGoogleWebsite = String(data.googleWebsite || '').trim();
      }
    }

    return patch;
  };

  const applyCustomerAddressPatch = (section, data = {}, options = {}) => {
    setForm((prev) => {
      const patch = buildCustomerAddressPatch(section, data, prev);
      if (section !== 'shipping') {
        if (options.updateCompanyName) patch.companyName = data.placeName || prev.companyName;
        if (options.fillCompanyNameIfEmpty) patch.companyName = prev.companyName || data.placeName || '';
      }
      const next = { ...prev, ...patch };
      if (section !== 'shipping' && prev.shippingSameAsBilling) {
        return { ...next, ...copyBillingToShipping(next) };
      }
      return next;
    });
  };

  const applyCustomerAddressSuggestion = (section, place = {}, queryText = '', options = {}) => {
    const placeName = place.displayName?.text || place.displayName || place.name || '';
    const extracted = extractCustomerAddressFields(place);
    const address = extracted.address || getGoogleFormattedAddressText(place);
    const googlePhone = place.nationalPhoneNumber || place.internationalPhoneNumber || place.formatted_phone_number || place.international_phone_number || '';
    const googleWebsite = place.websiteURI || place.website || '';
    const { lat, lng } = getCustomerPlaceLatLng(place);
    applyCustomerAddressPatch(section, {
      searchAddress: address || placeName || queryText,
      address,
      areaName: extracted.areaName,
      city: extracted.city,
      state: extracted.state,
      pincode: extracted.pincode,
      latitude: lat,
      longitude: lng,
      placeId: place.id || place.place_id || '',
      placeName,
      googlePhone,
      googleWebsite
    }, options);

    if (lat !== null && lng !== null) {
      void enrichCustomerAddressFromLatLng(section, lat, lng);
    }
  };

  const enrichCustomerAddressFromLatLng = async (section, lat, lng, { preserveSearchAddress = false } = {}) => {
    try {
      await loadGooglePlacesScript();
    } catch {
      // Continue; geocoder may still already be available.
    }
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
    if (!window.google?.maps?.Geocoder) {
      applyCustomerAddressPatch(section, { latitude: lat, longitude: lng, preserveSearchAddress });
      return null;
    }
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
      const first = response?.results?.[0];
      if (!first) return null;

      const extracted = extractCustomerAddressFields(first);
      const formattedAddress = extracted.address || getGoogleFormattedAddressText(first);
      applyCustomerAddressPatch(section, {
        address: formattedAddress,
        areaName: extracted.areaName,
        city: extracted.city,
        state: extracted.state,
        pincode: extracted.pincode,
        latitude: lat,
        longitude: lng,
        preserveSearchAddress
      });

      return {
        formattedAddress,
        ...extracted
      };
    } catch {
      return null;
    }
  };

  const applyCustomerCoordinates = (section, rawText) => {
    const parsed = parseLatLngFromGoogleUrl(rawText);
    if (!parsed) return false;

    if (parsed.error) {
      setSectionAddressSearchState(section, { error: parsed.error, suggestions: [], showSuggestions: false });
      setForm((prev) => {
        const isShipping = section === 'shipping';
        const patch = isShipping
          ? { shippingLatitude: '', shippingLongitude: '' }
          : { billingLatitude: '', billingLongitude: '', latitude: '', longitude: '' };
        const next = { ...prev, ...patch };
        return !isShipping && prev.shippingSameAsBilling ? { ...next, ...copyBillingToShipping(next) } : next;
      });
      return true;
    }

    setSectionAddressSearchState(section, { error: '', suggestions: [], showSuggestions: false });
    applyCustomerAddressPatch(section, {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      preserveSearchAddress: true
    });
    void enrichCustomerAddressFromLatLng(section, parsed.latitude, parsed.longitude, { preserveSearchAddress: true });
    return true;
  };

  const resolveCustomerAddressSearchInput = async (section, rawValue, { preserveSearchAddress = true } = {}) => {
    const text = String(rawValue || '').trim();
    if (!text) return false;

    if (applyCustomerCoordinates(section, text)) return true;

    if (!isAllowedGoogleMapsUrl(text) && !isGoogleMapsShortLink(text)) return false;

    try {
      const resolvedLink = await resolveGoogleMapsUrl(text, { apiBaseUrl: API_BASE_URL });
      if (!resolvedLink?.success || !Number.isFinite(Number(resolvedLink.latitude)) || !Number.isFinite(Number(resolvedLink.longitude))) {
        setSectionAddressSearchState(section, {
          error: 'Could not read this Google Maps short link. Please paste full Google Maps URL or coordinates.',
          suggestions: [],
          showSuggestions: false
        });
        return true;
      }

      const validationError = validateLatLngRange(resolvedLink.latitude, resolvedLink.longitude);
      if (validationError) {
        setSectionAddressSearchState(section, { error: validationError, suggestions: [], showSuggestions: false });
        return true;
      }

      setSectionAddressSearchState(section, { error: '', suggestions: [], showSuggestions: false });
      applyCustomerAddressPatch(section, {
        latitude: resolvedLink.latitude,
        longitude: resolvedLink.longitude,
        preserveSearchAddress
      });
      void enrichCustomerAddressFromLatLng(section, resolvedLink.latitude, resolvedLink.longitude, { preserveSearchAddress });
      return true;
    } catch {
      setSectionAddressSearchState(section, {
        error: 'Could not read this Google Maps short link. Please paste full Google Maps URL or coordinates.',
        suggestions: [],
        showSuggestions: false
      });
      return true;
    }
  };

  const handleCustomerSearchAddressChange = (section, value) => {
    const isShipping = section === 'shipping';
    const key = isShipping ? 'shippingSearchAddress' : 'billingSearchAddress';
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (!isShipping && prev.shippingSameAsBilling) {
        return { ...next, ...copyBillingToShipping(next) };
      }
      return next;
    });

    if (!applyCustomerCoordinates(section, value)) {
      if (isAllowedGoogleMapsUrl(value) || isGoogleMapsShortLink(value)) {
        setSectionAddressSearchState(section, { error: '', suggestions: [], showSuggestions: false });
        return;
      }
      setSectionAddressSearchState(section, { error: '' });
      void fetchCustomerLiveSearchSuggestions(section, value);
    }
  };

  const handleCustomerSearchAddressPaste = (section, event) => {
    const pastedText = event?.clipboardData?.getData('text') || '';
    const normalized = String(pastedText || '').trim();
    if (!normalized) return;

    window.setTimeout(() => {
      const inputRef = section === 'shipping' ? shippingSearchInputRef : billingSearchInputRef;
      const currentValue = inputRef.current?.value || normalized;
      void resolveCustomerAddressSearchInput(section, currentValue, { preserveSearchAddress: true });
    }, 0);
  };

  const fetchCustomerLiveSearchSuggestions = async (section, value) => {
    const queryText = String(value || '').trim();
    if (queryText.length < 2) {
      setSectionAddressSearchState(section, { suggestions: [], showSuggestions: false });
      return;
    }

    const seq = addressSuggestionSeqRef.current;
    seq[section] = (seq[section] || 0) + 1;
    const reqId = seq[section];
    try {
      await loadGooglePlacesScript();
      const { Place } = await window.google.maps.importLibrary('places');
      const { places } = await Place.searchByText({
        textQuery: queryText,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteURI'],
        maxResultCount: 5
      });
      if (addressSuggestionSeqRef.current[section] !== reqId) return;
      const suggestions = Array.isArray(places) ? places : [];
      setSectionAddressSearchState(section, {
        suggestions,
        showSuggestions: suggestions.length > 0
      });
    } catch {
      if (addressSuggestionSeqRef.current[section] !== reqId) return;
      setSectionAddressSearchState(section, { suggestions: [], showSuggestions: false });
    }
  };

  const searchCustomerGooglePlace = async (section, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const isShipping = section === 'shipping';
    const searchKey = isShipping ? 'shippingSearchAddress' : 'billingSearchAddress';
    const query = String(form[searchKey] || '').trim();

    if (addressSearchState[section]?.fetching) return;
    if (!query) {
      const inputRef = isShipping ? shippingSearchInputRef : billingSearchInputRef;
      inputRef.current?.focus();
      setSectionAddressSearchState(section, { error: 'Please enter address or Google Maps link.' });
      return;
    }

    setSectionAddressSearchState(section, { fetching: true, error: '' });
    try {
      if (await resolveCustomerAddressSearchInput(section, query, { preserveSearchAddress: true })) {
        return;
      }

      await loadGooglePlacesScript();
      const { Place } = await window.google.maps.importLibrary('places');
      const { places } = await Place.searchByText({
        textQuery: query,
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'addressComponents',
          'nationalPhoneNumber',
          'internationalPhoneNumber',
          'websiteURI'
        ],
        maxResultCount: 10
      });

      if (!places || places.length === 0) {
        setSectionAddressSearchState(section, { error: 'No address found. Try full address with city.' });
        return;
      }

      applyCustomerAddressSuggestion(section, places[0], query);
      setSectionAddressSearchState(section, { error: '', suggestions: [], showSuggestions: false });
    } catch {
      setSectionAddressSearchState(section, { error: 'Google search failed. Please try full address with city.' });
    } finally {
      setSectionAddressSearchState(section, { fetching: false });
    }
  };

  const handleCustomerMapLocationChange = (section, lat, lng) => {
    setSectionAddressSearchState(section, { error: '', suggestions: [], showSuggestions: false });
    applyCustomerAddressPatch(section, {
      latitude: lat,
      longitude: lng,
      preserveSearchAddress: true
    });
    void enrichCustomerAddressFromLatLng(section, lat, lng, { preserveSearchAddress: true });
  };

  const resolveCustomerMapInput = async (rawValue) => (
    resolveCustomerAddressSearchInput('billing', rawValue, { preserveSearchAddress: true })
  );

  const fetchSimilarCustomers = async (draft = form) => {
    const name = String(draft.displayName || draft.contactPersonName || draft.companyName || '').trim();
    const mobile = toTenDigitNumber(draft.mobileNumber || draft.workPhone || '');
    const address = String(draft.billingAddress || draft.billingStreet1 || '').trim();
    if (!name && !mobile && !address) {
      setSimilarCustomers([]);
      return;
    }
    try {
      setSimilarLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/customers/similar-search`, {
        params: {
          name,
          mobile,
          address,
          email: draft.emailId || ''
        }
      });
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const filtered = rows.filter((row) => (editingId ? row.customerId !== editingId : true));
      setSimilarCustomers(filtered);
    } catch (error) {
      console.error('Failed to search similar customers', error);
      setSimilarCustomers([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  useEffect(() => {
    if (!showModal) return undefined;
    const timer = setTimeout(() => {
      fetchSimilarCustomers(form);
    }, 320);
    return () => clearTimeout(timer);
  }, [form.displayName, form.contactPersonName, form.companyName, form.mobileNumber, form.billingAddress, form.emailId, showModal]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mapCustomerToForm = (customer) => {
    if (!isCustomerRecord(customer)) return emptyForm;
    const mobile = customer.mobileNumber || customer.workPhone || '';
    const whatsapp = customer.whatsappNumber || '';
    return {
      segment: customer.segment || 'Residential',
      companyName: customer.companyName || '',
      contactPersonName: customer.contactPersonName || customer.name || '',
      displayName: customer.displayName || customer.name || customer.contactPersonName || customer.companyName || '',
      position: positionOptions.includes(customer.position) ? customer.position : 'Edit type',
      positionCustom: positionOptions.includes(customer.position) ? (customer.positionCustom || '') : (customer.position || ''),
      mobileNumber: mobile,
      whatsappSameAsMobile: whatsapp && mobile ? whatsapp === mobile : false,
      whatsappNumber: whatsapp || mobile,
      altNumber: customer.altNumber || '',
      emailId: customer.emailId || customer.email || '',
      hasGst: customer.hasGst ?? customer.gstRegistered ?? false,
      gstNumber: customer.gstNumber || '',
      billingAttention: customer.billingAttention || '',
      billingSearchAddress: customer.billingSearchAddress || customer.searchAddress || customer.billingAddress || customer.billingStreet1 || '',
      billingStreet1: customer.billingStreet1 || '',
      billingStreet2: customer.billingStreet2 || '',
      billingAddress: customer.billingAddress || '',
      billingArea: customer.billingArea || customer.area || '',
      billingState: customer.billingState || customer.state || customer.placeOfSupply || 'Delhi',
      billingPincode: toSixDigitPincode(customer.billingPincode || customer.pincode || ''),
      billingLatitude: String(customer.billingLatitude ?? customer.latitude ?? '').trim(),
      billingLongitude: String(customer.billingLongitude ?? customer.longitude ?? '').trim(),
      billingGooglePlaceId: customer.billingGooglePlaceId || customer.googlePlaceId || '',
      billingGooglePlaceName: customer.billingGooglePlaceName || customer.googlePlaceName || '',
      billingGooglePhone: customer.billingGooglePhone || customer.googlePhone || '',
      billingGoogleWebsite: customer.billingGoogleWebsite || customer.googleWebsite || '',
      billingPhoneCode: customer.billingPhoneCode || '+91',
      billingPhone: customer.billingPhone || '',
      shippingAttention: customer.shippingAttention || '',
      shippingSearchAddress: customer.shippingSearchAddress || customer.shippingAddress || customer.shippingStreet1 || '',
      shippingStreet1: customer.shippingStreet1 || '',
      shippingStreet2: customer.shippingStreet2 || '',
      shippingAddress: customer.shippingAddress || '',
      shippingArea: customer.shippingArea || '',
      shippingState: customer.shippingState || 'Delhi',
      shippingPincode: toSixDigitPincode(customer.shippingPincode || ''),
      shippingLatitude: String(customer.shippingLatitude ?? '').trim(),
      shippingLongitude: String(customer.shippingLongitude ?? '').trim(),
      shippingGooglePlaceId: customer.shippingGooglePlaceId || '',
      shippingGooglePlaceName: customer.shippingGooglePlaceName || '',
      shippingPhoneCode: customer.shippingPhoneCode || '+91',
      shippingPhone: customer.shippingPhone || '',
      shippingSameAsBilling:
        (customer.shippingAddress || '') === (customer.billingAddress || '') &&
        (customer.shippingStreet1 || '') === (customer.billingStreet1 || '') &&
        (customer.shippingStreet2 || '') === (customer.billingStreet2 || '') &&
        (customer.shippingArea || '') === (customer.billingArea || customer.area || '') &&
        (customer.shippingState || '') === (customer.billingState || customer.state || customer.placeOfSupply || '') &&
        (customer.shippingPincode || '') === (customer.billingPincode || customer.pincode || '') &&
        !!(customer.billingAddress || customer.shippingAddress),
      areaSqft: String(customer.areaSqft ?? ''),
      googlePlaceId: customer.googlePlaceId || customer.billingGooglePlaceId || '',
      googlePlaceName: customer.googlePlaceName || customer.billingGooglePlaceName || '',
      googlePhone: customer.googlePhone || customer.billingGooglePhone || '',
      googleWebsite: customer.googleWebsite || customer.billingGoogleWebsite || '',
      latitude: String(customer.latitude ?? customer.billingLatitude ?? '').trim(),
      longitude: String(customer.longitude ?? customer.billingLongitude ?? '').trim()
    };
  };

  const openNewForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSimilarCustomers([]);
    setAddressSearchState(createAddressSearchState());
    setSaveError('');
    setShowModal(true);
  };

  const openEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const selected = customers.find((customer) => customer?._id === selectedIds[0]);
    if (!selected) return;
    setEditingId(selected._id);
    setForm(mapCustomerToForm(selected));
    setSimilarCustomers([]);
    setAddressSearchState(createAddressSearchState());
    setSaveError('');
    setShowModal(true);
    setShowMoreMenu(false);
  };

  const openCustomerHistory = async (customer) => {
    if (!customer?._id) return;
    setSelectedIds([customer._id]);
    setHistoryCustomerId(customer._id);
    setHistoryTab('transactions');
    setHistoryError('');
    setHistoryProfitError('');
    setHistoryProfitSnapshot(null);
    setShowHistory(true);
    setHistoryLoading(true);
    const [loadedTransactions, loadedProfit] = await Promise.all([
      loadTransactions(),
      loadCustomerProfitSnapshot(customer._id)
    ]);
    if (!loadedTransactions) {
      setHistoryError('Could not load customer history.');
    }
    if (!loadedProfit) {
      setHistoryProfitError('Could not load profit and cost summary.');
    }
    setHistoryLoading(false);
  };

  const closeCustomerHistory = () => {
    setShowHistory(false);
    setHistoryError('');
    setHistoryProfitError('');
    setHistoryProfitSnapshot(null);
    setHistoryLoading(false);
    setHistoryProfitLoading(false);
  };

  const closeModal = () => {
    if (isSaving) return;
    setShowModal(false);
    setEditingId(null);
    setSaveError('');
    setSimilarCustomers([]);
  };

  const openInvoiceInInvoiceModule = (invoice) => {
    if (!invoice) return;
    navigate('/sales/invoices', {
      state: {
        openInvoiceId: invoice._id || '',
        openInvoiceNumber: invoice.invoiceNumber || ''
      }
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const contactName = form.contactPersonName.trim();
    const companyName = form.companyName.trim();
    if (!contactName && !companyName) {
      setSaveError('Please enter Contact Person Name or Company Name.');
      return;
    }

    const finalPosition = form.position === 'Edit type' ? form.positionCustom.trim() || 'Edit type' : form.position;
    const mobile = toTenDigitNumber(form.mobileNumber);
    const whatsapp = form.whatsappSameAsMobile ? mobile : toTenDigitNumber(form.whatsappNumber);
    const altNumber = toTenDigitNumber(form.altNumber);

    if (mobile.length !== 10) {
      setSaveError(PHONE_VALIDATION_ERROR);
      return;
    }
    if (!form.whatsappSameAsMobile && whatsapp && whatsapp.length !== 10) {
      setSaveError(PHONE_VALIDATION_ERROR);
      return;
    }
    if (altNumber && altNumber.length !== 10) {
      setSaveError(PHONE_VALIDATION_ERROR);
      return;
    }
    const gstNumber = String(form.gstNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    if (form.hasGst && !gstinRegex.test(gstNumber)) {
      setSaveError('Enter a valid 15-character GSTIN (e.g., 29ABCDE9999F1Z8).');
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
    const billingLatitude = String(form.billingLatitude || form.latitude || '').trim();
    const billingLongitude = String(form.billingLongitude || form.longitude || '').trim();
    const shippingLatitude = String(form.shippingLatitude || '').trim();
    const shippingLongitude = String(form.shippingLongitude || '').trim();
    const coordinateError = validateCoordinatePair('Billing', billingLatitude, billingLongitude)
      || validateCoordinatePair('Shipping', shippingLatitude, shippingLongitude);
    if (coordinateError) {
      setSaveError(coordinateError);
      return;
    }

    const highRiskMatch = !editingId && similarCustomers.some((row) => Number(row.confidence || 0) >= 75);
    let duplicateOverrideReason = '';
    if (highRiskMatch) {
      const reason = window.prompt('Similar customer already exists. Enter reason to create new customer anyway, or Cancel to review existing records.', '');
      if (reason === null) return;
      duplicateOverrideReason = String(reason || '').trim();
      if (!duplicateOverrideReason) {
        setSaveError('Reason is required to create new customer when duplicate warning exists.');
        return;
      }
    }

    const payload = {
      displayName: form.displayName.trim() || contactName || companyName,
      name: form.displayName.trim() || contactName || companyName,
      segment: form.segment,
      companyName: companyName || contactName,
      contactPersonName: contactName || companyName,
      position: form.position,
      positionCustom: form.position === 'Edit type' ? form.positionCustom.trim() : '',
      mobileNumber: mobile,
      whatsappNumber: whatsapp,
      altNumber,
      emailId: form.emailId.trim(),
      email: form.emailId.trim(),
      hasGst: form.hasGst,
      gstRegistered: form.hasGst,
      gstNumber: form.hasGst ? gstNumber : '',
      billingAttention: form.billingAttention.trim(),
      billingSearchAddress: form.billingSearchAddress.trim(),
      billingStreet1: form.billingStreet1.trim(),
      billingStreet2: form.billingStreet2.trim(),
      billingAddress: form.billingAddress.trim() || [form.billingStreet1, form.billingStreet2].filter(Boolean).join(', '),
      billingArea: form.billingArea.trim(),
      billingState: form.billingState,
      billingPincode,
      billingLatitude,
      billingLongitude,
      billingGooglePlaceId: form.billingGooglePlaceId.trim() || form.googlePlaceId.trim(),
      billingGooglePlaceName: form.billingGooglePlaceName.trim() || form.googlePlaceName.trim(),
      billingGooglePhone: form.billingGooglePhone.trim() || form.googlePhone.trim(),
      billingGoogleWebsite: form.billingGoogleWebsite.trim() || form.googleWebsite.trim(),
      billingPhoneCode: form.billingPhoneCode,
      billingPhone: form.billingPhone.trim(),
      shippingSameAsBilling: form.shippingSameAsBilling,
      shippingAttention: form.shippingAttention.trim(),
      shippingSearchAddress: form.shippingSearchAddress.trim(),
      shippingStreet1: form.shippingStreet1.trim(),
      shippingStreet2: form.shippingStreet2.trim(),
      shippingAddress: form.shippingAddress.trim() || [form.shippingStreet1, form.shippingStreet2].filter(Boolean).join(', '),
      shippingArea: form.shippingArea.trim(),
      shippingState: form.shippingState,
      shippingPincode,
      shippingLatitude,
      shippingLongitude,
      shippingGooglePlaceId: form.shippingGooglePlaceId.trim(),
      shippingGooglePlaceName: form.shippingGooglePlaceName.trim(),
      shippingPhoneCode: form.shippingPhoneCode,
      shippingPhone: form.shippingPhone.trim(),
      area: form.billingArea.trim(),
      state: form.billingState,
      pincode: billingPincode,
      areaSqft: Number(form.areaSqft || 0),
      workPhone: mobile,
      placeOfSupply: form.billingState,
      finalPosition,
      googlePlaceId: form.googlePlaceId.trim() || form.billingGooglePlaceId.trim(),
      googlePlaceName: form.googlePlaceName.trim() || form.billingGooglePlaceName.trim(),
      googlePhone: form.googlePhone.trim() || form.billingGooglePhone.trim(),
      googleWebsite: form.googleWebsite.trim() || form.billingGoogleWebsite.trim(),
      latitude: billingLatitude,
      longitude: billingLongitude,
      duplicateOverrideReason
    };

    try {
      setIsSaving(true);
      setSaveError('');
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/customers/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/customers`, payload);
      }
      setForm(emptyForm);
      setSimilarCustomers([]);
      setEditingId(null);
      setShowModal(false);
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to save customer.');
      console.error('Failed to save customer', {
        message,
        status: error?.response?.status,
        data: error?.response?.data,
        editingId,
        payload
      });
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Delete ${selectedIds.length} selected customer${selectedIds.length === 1 ? '' : 's'}?`);
    if (!ok) return;
    try {
      await Promise.all(selectedIds.map((id) => axios.delete(`${API_BASE_URL}/api/customers/${id}`)));
      setShowMoreMenu(false);
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
    } catch (error) {
      console.error('Failed to delete customers', error);
    }
  };

  const deleteAllCustomers = async () => {
    const ids = customers.map((customer) => customer?._id).filter(Boolean);
    if (ids.length === 0) return;
    const ok = window.confirm(`Delete all ${ids.length} customers? This cannot be undone.`);
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => axios.delete(`${API_BASE_URL}/api/customers/${id}`)));
      setShowMoreMenu(false);
      setSelectedIds([]);
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
    } catch (error) {
      console.error('Failed to delete all customers', error);
      window.alert(error?.response?.data?.error || 'Unable to delete all customers.');
    }
  };

  const deleteDuplicateReportCustomers = async () => {
    const ids = Array.from(new Set((duplicateRows || []).map((row) => row.customerBId).filter(Boolean)));
    if (ids.length === 0) {
      window.alert('No duplicate report customers found to delete.');
      setShowMoreMenu(false);
      return;
    }
    const ok = window.confirm(`Delete ${ids.length} duplicate customer${ids.length === 1 ? '' : 's'} from the duplicate report? The first customer in each pair will be kept.`);
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => axios.delete(`${API_BASE_URL}/api/customers/${id}`)));
      setShowMoreMenu(false);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
    } catch (error) {
      console.error('Failed to delete duplicate report customers', error);
      window.alert(error?.response?.data?.error || 'Unable to delete duplicate report customers.');
    }
  };

  const deleteOneCustomer = async (customerId) => {
    if (!customerId) return;
    const ok = window.confirm('Delete this customer?');
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customerId}`);
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
      setSelectedIds((prev) => prev.filter((id) => id !== customerId));
    } catch (error) {
      console.error('Failed to delete customer', error);
      window.alert(error?.response?.data?.error || 'Unable to delete customer.');
    }
  };

  const csvEscape = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportData = () => {
    const sourceRows = selectedIds.length > 0
      ? customers.filter((customer) => customer?._id && selectedIds.includes(customer._id))
      : customers;
    if (sourceRows.length === 0) {
      window.alert('No customer data available to export.');
      return;
    }

    const headers = customerImportExportColumns.map((column) => column.key);
    const csvRows = [
      headers.join(','),
      ...sourceRows.map((customer) =>
        headers.map((key) => csvEscape(handleCellValue(customer, key))).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
  };

  const downloadSampleImportCsv = () => {
    const link = document.createElement('a');
    link.href = '/customers-import-sample-dedupe.csv';
    link.download = 'customers-import-sample-dedupe.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowMoreMenu(false);
  };

  const mergeSelectedCustomers = async () => {
    if (selectedIds.length !== 2) {
      window.alert('Select exactly 2 customers to merge.');
      setShowMoreMenu(false);
      return;
    }
    const targetCustomerId = selectedIds[0];
    const sourceCustomerId = selectedIds[1];
    const reason = window.prompt('Merge reason (required):', 'Duplicate customer cleanup');
    if (!reason || !String(reason).trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/api/customers/merge`, {
        targetCustomerId,
        sourceCustomerId,
        reason,
        actor: localStorage.getItem('portal_user_name') || 'Admin'
      });
      window.alert('Customers merged successfully.');
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
      setSelectedIds([]);
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Customer merge failed', error);
      window.alert(error?.response?.data?.error || 'Unable to merge selected customers.');
    }
  };

  const exportDuplicateReport = async (format = 'csv') => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/duplicates/report`, {
        params: { format },
        responseType: 'blob'
      });
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customer-duplicate-report.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export duplicate report', error);
      window.alert('Unable to export duplicate report.');
    }
  };

  const handleCellValue = (customer, key) => {
    if (!isCustomerRecord(customer)) return '';
    if (key === 'displayName') return customer.displayName || customer.name || '';
    if (key === 'name') return customer.displayName || customer.name || '';
    if (key === 'hasGst') return customer.hasGst || customer.gstRegistered ? 'Yes' : 'No';
    if (key === 'whatsappSameAsMobile') return (customer.whatsappNumber || '') && (customer.mobileNumber || customer.workPhone || '') && customer.whatsappNumber === (customer.mobileNumber || customer.workPhone) ? 'Yes' : 'No';
    if (key === 'shippingSameAsBilling') {
      const billing = [
        customer.billingAttention,
        customer.billingStreet1,
        customer.billingStreet2,
        customer.billingAddress,
        customer.billingArea,
        customer.billingState,
        customer.billingPincode
      ].map((value) => String(value || '').trim()).join('|');
      const shipping = [
        customer.shippingAttention,
        customer.shippingStreet1,
        customer.shippingStreet2,
        customer.shippingAddress,
        customer.shippingArea,
        customer.shippingState,
        customer.shippingPincode
      ].map((value) => String(value || '').trim()).join('|');
      return billing && billing === shipping ? 'Yes' : 'No';
    }
    if (key === 'position') return customer.positionCustom || customer.position || '';
    if (key === 'emailId') return customer.emailId || customer.email || '';
    if (key === 'mobileNumber') return customer.mobileNumber || customer.workPhone || '';
    if (key === 'billingAttention') return customer.billingAttention || '';
    if (key === 'billingStreet1') return customer.billingStreet1 || '';
    if (key === 'billingStreet2') return customer.billingStreet2 || '';
    if (key === 'billingAddress') return customer.billingAddress || [customer.billingStreet1, customer.billingStreet2].filter(Boolean).join(', ');
    if (key === 'billingArea') return customer.billingArea || customer.area || '';
    if (key === 'billingState') return customer.billingState || customer.state || customer.placeOfSupply || '';
    if (key === 'billingPincode') return customer.billingPincode || customer.pincode || '';
    if (key === 'shippingAttention') return customer.shippingAttention || '';
    if (key === 'shippingStreet1') return customer.shippingStreet1 || '';
    if (key === 'shippingStreet2') return customer.shippingStreet2 || '';
    if (key === 'shippingAddress') return customer.shippingAddress || [customer.shippingStreet1, customer.shippingStreet2].filter(Boolean).join(', ');
    if (key === 'shippingArea') return customer.shippingArea || '';
    if (key === 'shippingState') return customer.shippingState || '';
    if (key === 'shippingPincode') return customer.shippingPincode || '';
    if (key === 'areaSqft') return customer.areaSqft ? String(customer.areaSqft) : '';
    if (key === 'billingPhoneCode') return customer.billingPhoneCode || '+91';
    if (key === 'shippingPhoneCode') return customer.shippingPhoneCode || '+91';
    return customer[key] || '';
  };

  const toggleNameSort = () => {
    setNameSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(1);
  };

  const pageStart = sortedCustomers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const pageEnd = Math.min(currentPage * rowsPerPage, sortedCustomers.length);
  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const isTiny = viewportWidth <= 380;
  const topbarStyle = isMobile
    ? { ...shell.topbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '10px 12px' : shell.topbar.padding }
    : shell.topbar;
  const topActionsStyle = isMobile ? { ...shell.topActions, width: '100%', justifyContent: 'space-between' } : shell.topActions;
  const toolbarStyle = isMobile ? { ...shell.toolbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '8px 12px' : shell.toolbar.padding } : shell.toolbar;
  const mobileTableMinWidth = 56 + visibleColumnDefs.reduce((sum, column) => (
    sum + Math.max(Number(columnWidths[column.key]) || 0, mobileCustomerColumnWidths[column.key] || mobileCustomerDefaultColumnWidth)
  ), 0) + 150;
  const tableStyle = isMobile
    ? { ...shell.table, minWidth: `${mobileTableMinWidth}px`, tableLayout: 'auto' }
    : shell.table;
  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '16px 10px' } : shell.modalOverlay;
  const modalStyle = isMobile
    ? {
      ...shell.modal,
      width: '96vw',
      maxHeight: '92dvh',
      height: 'auto',
      borderRadius: '16px',
      border: '1px solid rgba(159, 23, 77, 0.24)'
    }
    : shell.modal;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, minHeight: '60px', fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const modalBodyStyle = isMobile
    ? {
      ...shell.modalBody,
      gridTemplateColumns: '1fr',
      padding: '16px 14px',
      paddingBottom: 'calc(130px + env(safe-area-inset-bottom))',
      WebkitOverflowScrolling: 'touch'
    }
    : shell.modalBody;
  const addressSplitStyle = isMobile ? { ...shell.addressSplit, gridTemplateColumns: '1fr' } : shell.addressSplit;
  const addressGridStyle = isMobile ? { ...shell.addressGrid, gridTemplateColumns: '1fr' } : shell.addressGrid;
  const historyModalStyle = isMobile ? { ...shell.historyModal, width: 'min(100%, 96vw)' } : shell.historyModal;
  const historyHeaderStyle = isMobile ? { ...shell.historyHeader, flexDirection: 'column', alignItems: 'stretch' } : shell.historyHeader;
  const historyTitleStyle = isMobile ? { ...shell.historyTitle, fontSize: '22px' } : shell.historyTitle;
  const modalFooterStyle = isMobile
    ? {
      ...shell.modalFooter,
      flexWrap: 'wrap',
      position: 'sticky',
      bottom: 0,
      background: '#fff',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
    }
    : shell.modalFooter;
  const duplicateModalBodyStyle = isTablet || isMobile ? { ...modalBodyStyle, display: 'grid', gap: '10px' } : { ...shell.modalBody, display: 'grid', gap: '10px' };
  const titleStyle = isTiny ? { ...shell.title, fontSize: '24px' } : shell.title;
  const ghostButtonStyle = isTiny ? { ...shell.buttonGhost, width: '32px', height: '32px' } : shell.buttonGhost;
  const primaryButtonStyle = isTiny ? { ...shell.buttonPrimary, padding: '6px 10px', fontSize: '11px', minHeight: '32px' } : shell.buttonPrimary;
  const customizeButtonStyle = isTiny ? { ...shell.customizeButton, padding: '7px 10px', fontSize: '11px' } : shell.customizeButton;
  const historyTitleTinyStyle = isTiny ? { ...historyTitleStyle, fontSize: '20px' } : historyTitleStyle;
  const addressSearchRowStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto',
    gap: '8px',
    alignItems: 'center'
  };
  const addressSearchButtonStyle = {
    ...shell.saveButton,
    minHeight: '40px',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap'
  };

  const renderAddressSearchControls = (section) => {
    const isShipping = section === 'shipping';
    const searchKey = isShipping ? 'shippingSearchAddress' : 'billingSearchAddress';
    const inputRef = isShipping ? shippingSearchInputRef : billingSearchInputRef;
    const state = addressSearchState[section] || {};
    const latitude = isShipping ? form.shippingLatitude : (form.billingLatitude || form.latitude);
    const longitude = isShipping ? form.shippingLongitude : (form.billingLongitude || form.longitude);

    return (
      <>
        <label style={shell.label}>Search Address</label>
        <div style={{ minWidth: 0 }}>
          <div style={addressSearchRowStyle}>
            <input
              ref={inputRef}
              style={shell.input}
              value={form[searchKey]}
              onChange={(event) => handleCustomerSearchAddressChange(section, event.target.value)}
              onPaste={(event) => handleCustomerSearchAddressPaste(section, event)}
              onFocus={() => setSectionAddressSearchState(section, { showSuggestions: (state.suggestions || []).length > 0 })}
              onBlur={() => window.setTimeout(() => setSectionAddressSearchState(section, { showSuggestions: false }), 160)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                void searchCustomerGooglePlace(section, event);
              }}
              placeholder="Search address or paste Google Maps link"
            />
            <button
              type="button"
              formNoValidate
              style={addressSearchButtonStyle}
              disabled={state.fetching}
              onClick={(event) => searchCustomerGooglePlace(section, event)}
            >
              <Search size={14} /> {state.fetching ? 'Fetching...' : 'Search Only'}
            </button>
          </div>
          {state.showSuggestions ? (
            <div style={{ marginTop: '6px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#fff', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)', maxHeight: '220px', overflowY: 'auto' }}>
              {(state.suggestions || []).map((place) => {
                const name = place.displayName?.text || place.displayName || place.formattedAddress || '';
                const address = place.formattedAddress || '';
                return (
                  <button
                    key={String(place.id || `${name}-${address}`)}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      applyCustomerAddressSuggestion(section, place, form[searchKey]);
                      setSectionAddressSearchState(section, { error: '', suggestions: [], showSuggestions: false });
                    }}
                    style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
                  >
                    <div style={{ width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{name}</div>
                    <div style={{ width: '100%', textAlign: 'left', fontSize: '11px', color: '#64748b' }}>{address}</div>
                  </button>
                );
              })}
            </div>
          ) : null}
          {state.error ? (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>
              {state.error}
            </div>
          ) : null}
          <MapPicker
            latitude={latitude}
            longitude={longitude}
            onLocationChange={(lat, lng) => handleCustomerMapLocationChange(section, lat, lng)}
            height={156}
            markerTitle={isShipping ? 'Shipping location' : 'Billing location'}
            unavailableMessage="Map preview unavailable. You can still save the customer manually."
          />
        </div>
      </>
    );
  };

  return (
    <section className="crm-page crm-section" style={shell.page}>
      <div style={topbarStyle}>
        <div style={shell.titleWrap}>
          <h1 style={titleStyle}>Active Customers</h1>
        </div>
        <div style={topActionsStyle}>
          <button type="button" style={primaryButtonStyle} onClick={openNewForm}>
            <Plus size={16} />
            New Customer
          </button>
          <div style={{ position: 'relative' }}>
            <button
              ref={moreMenuButtonRef}
              type="button"
              style={ghostButtonStyle}
              aria-label="More options"
              onClick={() => setShowMoreMenu((prev) => !prev)}
            >
              <MoreHorizontal size={24} />
            </button>
            {showMoreMenu ? (
              <div ref={moreMenuRef} style={shell.menu}>
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
                <button
                  type="button"
                  style={shell.menuButton}
                  onClick={() => {
                    setShowImportWizard(true);
                    setShowMoreMenu(false);
                  }}
                >
                  Import Data (Dedup Wizard)
                </button>
                <button type="button" style={shell.menuButton} onClick={exportData}>
                  Export Data
                </button>
                <button
                  type="button"
                  style={shell.menuButton}
                  onClick={() => {
                    setShowDuplicateReport(true);
                    setShowMoreMenu(false);
                  }}
                >
                  Duplicate Report
                </button>
                <button type="button" style={shell.menuButton} onClick={downloadSampleImportCsv}>
                  Download Sample Import CSV
                </button>
                <button type="button" style={shell.menuButton} onClick={deleteDuplicateReportCustomers}>
                  Delete Duplicate Report Customers ({duplicateRows.length})
                </button>
                <button type="button" style={shell.menuButton} onClick={deleteAllCustomers}>
                  Delete All Customers ({customers.length})
                </button>
                <button
                  type="button"
                  style={{ ...shell.menuButton, opacity: selectedIds.length === 2 ? 1 : 0.45, cursor: selectedIds.length === 2 ? 'pointer' : 'not-allowed' }}
                  disabled={selectedIds.length !== 2}
                  onClick={mergeSelectedCustomers}
                >
                  Merge Selected ({selectedIds.length}/2)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={toolbarStyle}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={shell.toolLabel}>Customer Master</span>
          {!isMobile ? (
            <>
              <span style={{ border: '1px solid rgba(159, 23, 77, 0.25)', background: 'var(--color-primary-light)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                Data Health: {duplicateSummary?.customerDataHealthScore ?? 100}
              </span>
              <span style={{ border: '1px solid rgba(217,119,6,0.28)', background: 'rgba(254,243,199,0.7)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, color: '#92400e' }}>
                Possible Duplicates: {possibleDuplicateIds.length}
              </span>
              <button
                type="button"
                style={{ ...shell.duplicateFilterButton, background: showPossibleDuplicatesOnly ? '#fee2e2' : 'var(--color-primary-light)', borderColor: showPossibleDuplicatesOnly ? '#fca5a5' : '#c7d2fe', color: showPossibleDuplicatesOnly ? '#991b1b' : 'var(--color-primary-dark)' }}
                onClick={() => setShowPossibleDuplicatesOnly((prev) => !prev)}
              >
                {showPossibleDuplicatesOnly ? 'Show All Customers' : 'Filter Possible Duplicates'}
              </button>
            </>
          ) : null}
        </div>
        {!isMobile ? (
          <div style={{ position: 'relative' }}>
            <button
              ref={customizeButtonRef}
              type="button"
              style={customizeButtonStyle}
              onClick={() => setShowCustomize((prev) => !prev)}
            >
              Customize Fields
            </button>
            {showCustomize ? (
              <div ref={customizePanelRef} style={shell.popover}>
                <div style={shell.popoverHeader}>Show/Hide Columns</div>
                <div style={shell.popoverBody}>
                  {allColumns.map((column) => (
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
        ) : null}
      </div>

      <div style={shell.tableWrap} className="crm-table-shell crm-table-shell--clipped">
        <table style={tableStyle} className="crm-compact-table crm-readable-mobile-table">
          <thead>
            <tr>
              <th style={{ ...shell.headCell, ...shell.checkboxWrap, ...(isMobile ? { width: '56px', minWidth: '56px', maxWidth: '56px' } : {}) }}>
                <input type="checkbox" style={shell.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumnDefs.map((column) => (
                <th key={column.key} style={{ ...shell.headCell, ...shell.headCellResizable, ...getColumnStyle(column.key) }}>
                  {column.key === 'name' ? (
                    <button type="button" className="crm-readable-header-button" style={{ ...shell.headSortButton, ...shell.headLabelWrap }} onClick={toggleNameSort} title="Sort by customer name">
                      <span>{column.label}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  ) : (
                    <span style={shell.headLabelWrap}>{column.label}</span>
                  )}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    title="Drag to resize"
                    style={shell.resizeHandle}
                    onMouseDown={(event) => startColumnResize(event, column.key)}
                  />
                </th>
              ))}
              <th style={{ ...shell.headCell, width: '150px', minWidth: '150px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.length === 0 ? (
              <tr style={shell.row}>
                <td style={{ ...shell.cell, textAlign: 'center', color: '#64748b' }} colSpan={visibleColumnDefs.length + 2}>
                  No customers found.
                </td>
              </tr>
            ) : null}
            {paginatedCustomers.map((customer) => (
              <tr key={customer._id || customer.name} style={shell.row}>
                <td style={{ ...shell.cell, ...shell.checkboxWrap }}>
                  <input
                    type="checkbox"
                    style={shell.checkbox}
                    checked={selectedIds.includes(customer._id)}
                    onChange={() => toggleSelectOne(customer._id)}
                  />
                </td>
                {visibleColumnDefs.map((column) => (
                  <td
                    key={`${customer._id || customer.name}-${column.key}`}
                    style={
                      column.key === 'name' || column.key === 'companyName'
                        ? { ...shell.cell, ...shell.nameCell, ...shell.cellClamp, ...getColumnStyle(column.key) }
                        : { ...shell.cell, ...shell.cellClamp, ...getColumnStyle(column.key) }
                    }
                    onClick={
                      column.key === 'name' || column.key === 'companyName'
                        ? () => openCustomerHistory(customer)
                        : undefined
                    }
                    title={String(handleCellValue(customer, column.key) || '')}
                  >
                    {handleCellValue(customer, column.key)}
                  </td>
                ))}
                <td style={{ ...shell.cell, whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    style={{ ...shell.rowActionButton, marginRight: '8px' }}
                    onClick={() => {
                      setEditingId(customer._id);
                      setForm(mapCustomerToForm(customer));
                      setSaveError('');
                      setShowModal(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    style={{ ...shell.rowActionButton, color: '#dc2626', borderColor: '#fecaca', background: '#fff' }}
                    onClick={() => deleteOneCustomer(customer._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={shell.paginationBar}>
        <div style={shell.paginationActions}>
          <button
            type="button"
            style={{ ...shell.paginationButton, opacity: currentPage === 1 ? 0.45 : 1 }}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            style={{ ...shell.paginationButton, opacity: currentPage === totalPages ? 0.45 : 1 }}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {showHistory ? (
        <div style={shell.historyOverlay}>
          <div style={historyModalStyle}>
            <div style={historyHeaderStyle}>
              <div>
                <h3 style={historyTitleTinyStyle}>
                  {selectedHistoryCustomer?.displayName || selectedHistoryCustomer?.name || 'Customer History'}
                </h3>
                <p style={shell.historySubTitle}>
                  {selectedHistoryCustomer?.companyName || selectedHistoryCustomer?.contactPersonName || 'Customer ledger and transactions'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  style={shell.cancelButton}
                  onClick={() => {
                    if (!selectedHistoryCustomer?._id) return;
                    setEditingId(selectedHistoryCustomer._id);
                    setForm(mapCustomerToForm(selectedHistoryCustomer));
                    setSaveError('');
                    setShowHistory(false);
                    setShowModal(true);
                  }}
                >
                  Edit
                </button>
                <button type="button" style={shell.historyClose} onClick={closeCustomerHistory} aria-label="Close history">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={shell.historyBody}>
              <div style={shell.historyTabs}>
                <button
                  type="button"
                  style={historyTab === 'overview' ? { ...shell.historyTabBtn, ...shell.historyTabBtnActive } : shell.historyTabBtn}
                  onClick={() => setHistoryTab('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  style={historyTab === 'transactions' ? { ...shell.historyTabBtn, ...shell.historyTabBtnActive } : shell.historyTabBtn}
                  onClick={() => setHistoryTab('transactions')}
                >
                  Transactions
                </button>
                <button
                  type="button"
                  style={historyTab === 'profit-cost' ? { ...shell.historyTabBtn, ...shell.historyTabBtnActive } : shell.historyTabBtn}
                  onClick={() => setHistoryTab('profit-cost')}
                >
                  Profit & Cost
                </button>
              </div>

              {historyLoading ? (
                <p style={shell.historyEmpty}>Loading customer history...</p>
              ) : historyTab === 'profit-cost' && historyProfitLoading ? (
                <p style={shell.historyEmpty}>Loading profit and cost summary...</p>
              ) : historyTab === 'profit-cost' && historyProfitError ? (
                <p style={{ ...shell.historyEmpty, color: '#dc2626', fontWeight: 700 }}>{historyProfitError}</p>
              ) : historyTab === 'profit-cost' ? (
                historyProfitSnapshot ? (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={shell.historyProfitGrid}>
                      <div style={{ ...shell.historyProfitCard, ...(historyProfitSnapshot.profit?.amount >= 0 ? shell.historyProfitCardProfit : shell.historyProfitCardLoss) }}>
                        <p style={shell.historyProfitLabel}>Profit / Loss</p>
                        <p style={shell.historyProfitValue}>{formatINR(historyProfitSnapshot.profit?.amount || 0)}</p>
                      </div>
                      <div style={shell.historyProfitCard}>
                        <p style={shell.historyProfitLabel}>Revenue Excl. GST</p>
                        <p style={shell.historyProfitValue}>{formatINR(historyProfitSnapshot.revenue?.base || 0)}</p>
                      </div>
                      <div style={shell.historyProfitCard}>
                        <p style={shell.historyProfitLabel}>Total Service Cost</p>
                        <p style={shell.historyProfitValue}>{formatINR(historyProfitSnapshot.costs?.total || 0)}</p>
                      </div>
                      <div style={{ ...shell.historyProfitCard, ...(Number(historyProfitSnapshot.profit?.marginPercent || 0) < Number(historyProfitSnapshot.profit?.lowMarginWarningPercent || 0) ? shell.historyProfitCardAmber : {}) }}>
                        <p style={shell.historyProfitLabel}>Profit Margin %</p>
                        <p style={shell.historyProfitValue}>{Number(historyProfitSnapshot.profit?.marginPercent || 0).toFixed(2)}%</p>
                      </div>
                      <div style={shell.historyProfitCard}>
                        <p style={shell.historyProfitLabel}>Total Visits</p>
                        <p style={shell.historyProfitValue}>{historyProfitSnapshot.totals?.totalVisits || 0}</p>
                      </div>
                      <div style={shell.historyProfitCard}>
                        <p style={shell.historyProfitLabel}>Complaint Visits</p>
                        <p style={shell.historyProfitValue}>{historyProfitSnapshot.totals?.complaintVisits || 0}</p>
                      </div>
                    </div>

                    <div style={shell.historyBreakdownGrid}>
                      {[
                        ['Chemical', historyProfitSnapshot.costs?.breakdown?.chemical || 0],
                        ['Manpower', historyProfitSnapshot.costs?.breakdown?.manpower || 0],
                        ['Conveyance', historyProfitSnapshot.costs?.breakdown?.conveyance || 0],
                        ['Materials', historyProfitSnapshot.costs?.breakdown?.material || 0],
                        ['Complaint / Revisit', historyProfitSnapshot.costs?.breakdown?.complaint || 0],
                        ['Other', historyProfitSnapshot.costs?.breakdown?.other || 0]
                      ].map(([labelText, amount]) => (
                        <div key={labelText} style={shell.historyBreakdownCard}>
                          <p style={shell.historyBreakdownLabel}>{labelText}</p>
                          <p style={shell.historyBreakdownValue}>{formatINR(amount || 0)}</p>
                        </div>
                      ))}
                    </div>

                    {historyProfitSnapshot.contractRows?.length > 0 ? (
                      <div style={shell.historySection}>
                        <div style={shell.historySectionHead}>
                          <h4 style={shell.historySectionTitleSmall}>Contract-wise Profit</h4>
                        </div>
                        <div style={shell.historyTableWrap}>
                          <table style={shell.historyTableCompact}>
                            <thead>
                              <tr>
                                <th style={shell.historyHeadCellCompact}>Contract</th>
                                <th style={shell.historyHeadCellCompact}>Revenue</th>
                                <th style={shell.historyHeadCellCompact}>Cost</th>
                                <th style={shell.historyHeadCellCompact}>Profit</th>
                                <th style={shell.historyHeadCellCompact}>Margin</th>
                                <th style={shell.historyHeadCellCompact}>Visits</th>
                                <th style={shell.historyHeadCellCompact}>Complaints</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historyProfitSnapshot.contractRows.map((row, index) => (
                                <tr key={row.contractId || row.invoiceId || row.contractNumber} style={{ background: index % 2 === 0 ? '#fff' : '#fafcff' }}>
                                  <td style={shell.historyCellCompact}>{row.contractNumber || '-'}</td>
                                  <td style={shell.historyCellCompact}>{formatINR(row.revenue || 0)}</td>
                                  <td style={shell.historyCellCompact}>{formatINR(row.totalCost || 0)}</td>
                                  <td style={{ ...shell.historyCellCompact, fontWeight: 800, color: row.profit >= 0 ? '#166534' : '#b91c1c' }}>{formatINR(row.profit || 0)}</td>
                                  <td style={shell.historyCellCompact}>{Number(row.marginPercent || 0).toFixed(2)}%</td>
                                  <td style={shell.historyCellCompact}>{row.totalVisits || 0}</td>
                                  <td style={shell.historyCellCompact}>{row.complaintVisits || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}

                    {historyProfitSnapshot.visitRows?.length > 0 ? (
                      <div style={shell.historySection}>
                        <div style={shell.historySectionHead}>
                          <h4 style={shell.historySectionTitleSmall}>Visit-wise Cost History</h4>
                        </div>
                        <div style={shell.historyTableWrap}>
                          <table style={shell.historyTableCompact}>
                            <thead>
                              <tr>
                                <th style={shell.historyHeadCellCompact}>Date</th>
                                <th style={shell.historyHeadCellCompact}>Contract</th>
                                <th style={shell.historyHeadCellCompact}>Service</th>
                                <th style={shell.historyHeadCellCompact}>Visit Type</th>
                                <th style={shell.historyHeadCellCompact}>Revenue</th>
                                <th style={shell.historyHeadCellCompact}>Total Cost</th>
                                <th style={shell.historyHeadCellCompact}>Profit</th>
                                <th style={shell.historyHeadCellCompact}>Margin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historyProfitSnapshot.visitRows.slice(0, 20).map((row, index) => (
                                <tr key={row.id} style={{ background: index % 2 === 0 ? '#fff' : '#fafcff' }}>
                                  <td style={shell.historyCellCompact}>{formatDisplayDate(row.date)}</td>
                                  <td style={shell.historyCellCompact}>{row.contract || '-'}</td>
                                  <td style={shell.historyCellCompact}>{row.service || '-'}</td>
                                  <td style={shell.historyCellCompact}>{row.visitType || '-'}</td>
                                  <td style={shell.historyCellCompact}>{formatINR(row.revenue || 0)}</td>
                                  <td style={shell.historyCellCompact}>{formatINR(row.totalCost || 0)}</td>
                                  <td style={{ ...shell.historyCellCompact, fontWeight: 800, color: row.profit >= 0 ? '#166534' : '#b91c1c' }}>{formatINR(row.profit || 0)}</td>
                                  <td style={shell.historyCellCompact}>{Number(row.marginPercent || 0).toFixed(2)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}

                    <p style={shell.historyProfitNote}>
                      GST is excluded from revenue calculations. Cost items can be edited per service visit using the Add Cost action on the job card.
                    </p>
                  </div>
                ) : (
                  <p style={shell.historyEmpty}>No profit and cost data found for this customer yet.</p>
                )
              ) : historyError ? (
                <p style={{ ...shell.historyEmpty, color: '#dc2626', fontWeight: 700 }}>{historyError}</p>
              ) : historyTab === 'overview' ? (
                <>
                  <div style={shell.historyStats}>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Total Invoices</p>
                      <p style={shell.historyStatValue}>{historySummary.invoiceCount}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Total Invoice Amount</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.totalInvoiceAmount)}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Total Received</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.totalReceived)}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Balance Due</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.totalBalanceDue)}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Payments Count</p>
                      <p style={shell.historyStatValue}>{historySummary.paymentCount}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Avg Invoice Value</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.avgInvoiceValue)}</p>
                    </div>
                  </div>

                  <div style={shell.historyMetaBox}>
                    <div>
                      <p style={shell.historyMetaLabel}>Contact Person</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.contactPersonName || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Mobile Number</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.mobileNumber || selectedHistoryCustomer?.workPhone || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Email</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.emailId || selectedHistoryCustomer?.email || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>GST Number</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.gstNumber || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Billing State</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.billingState || selectedHistoryCustomer?.state || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Billing Area</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.billingArea || selectedHistoryCustomer?.area || '-'}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div style={shell.historyGrid}>
                  <div style={shell.historySection}>
                    <div style={shell.historySectionHead}>
                      <h4 style={shell.historySectionTitle}>Invoices</h4>
                    </div>
                    {historyInvoicesSorted.length === 0 ? (
                      <p style={shell.historyEmpty}>No invoices found for this customer.</p>
                    ) : (
                      <div style={shell.historyTableWrap}>
                        <table style={shell.historyTable}>
                          <thead>
                            <tr>
                              <th style={shell.historyHeadCell}>Date</th>
                              <th style={shell.historyHeadCell}>Invoice#</th>
                              <th style={shell.historyHeadCell}>Amount</th>
                              <th style={shell.historyHeadCell}>Balance Due</th>
                              <th style={shell.historyHeadCell}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyInvoicesSorted.map((invoice) => (
                              <tr key={invoice._id || `${invoice.invoiceNumber}-${invoice.date}`} style={shell.historyRow}>
                                <td style={shell.historyCell}>{formatDisplayDate(invoice.date)}</td>
                                <td style={{ ...shell.historyCell, color: 'var(--color-primary)', fontWeight: 700 }}>
                                  {invoice.invoiceNumber ? (
                                    <button
                                      type="button"
                                      onClick={() => openInvoiceInInvoiceModule(invoice)}
                                      style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                                    >
                                      {invoice.invoiceNumber}
                                    </button>
                                  ) : '-'}
                                </td>
                                <td style={shell.historyCell}>{formatINR(invoice.amount ?? invoice.total ?? 0)}</td>
                                <td style={shell.historyCell}>{formatINR(invoice.balanceDue ?? 0)}</td>
                                <td style={shell.historyCell}>{String(invoice.status || '-').toUpperCase()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={shell.historySection}>
                    <div style={shell.historySectionHead}>
                      <h4 style={shell.historySectionTitle}>Customer Payments</h4>
                    </div>
                    {historyPaymentsSorted.length === 0 ? (
                      <p style={shell.historyEmpty}>No payments found for this customer.</p>
                    ) : (
                      <div style={shell.historyTableWrap}>
                        <table style={shell.historyTable}>
                          <thead>
                            <tr>
                              <th style={shell.historyHeadCell}>Date</th>
                              <th style={shell.historyHeadCell}>Payment#</th>
                              <th style={shell.historyHeadCell}>Invoice#</th>
                              <th style={shell.historyHeadCell}>Payment Mode</th>
                              <th style={shell.historyHeadCell}>Amount</th>
                              <th style={shell.historyHeadCell}>Balance After Payment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyPaymentsSorted.map((payment) => (
                              <tr key={payment._id || `${payment.paymentNumber}-${payment.paymentDate}`} style={shell.historyRow}>
                                <td style={shell.historyCell}>{formatDisplayDate(payment.paymentDate || payment.date)}</td>
                                <td style={{ ...shell.historyCell, color: 'var(--color-primary)', fontWeight: 700 }}>{payment.paymentNumber || '-'}</td>
                                <td style={shell.historyCell}>{payment.invoiceNumber || '-'}</td>
                                <td style={shell.historyCell}>{payment.mode || '-'}</td>
                                <td style={shell.historyCell}>{formatINR(payment.amount || 0)}</td>
                                <td style={shell.historyCell}>{formatINR(payment.balanceAfterPayment || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? createPortal(
        <div style={modalOverlayStyle}>
          <form className="crm-modal-surface" style={modalStyle} onSubmit={handleSubmit}>
            <div className="crm-modal-surface-header" style={modalHeaderStyle}>
              <h3 style={shell.modalHeaderTitle}>{editingId ? 'Edit Customer' : 'New Customer'}</h3>
              <button type="button" style={shell.modalCloseButton} onClick={closeModal} aria-label="Close">
                <X size={24} />
              </button>
            </div>

            <div className="crm-modal-surface-body" style={modalBodyStyle}>
              <label style={shell.label}>Duplicate Check</label>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                {similarLoading ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontWeight: 600 }}>Checking similar customers...</p>
                ) : null}
                {!similarLoading && similarCustomers.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#166534', fontWeight: 700 }}>No similar customer found.</p>
                ) : null}
                {!similarLoading && similarCustomers.length > 0 ? (
                  <div style={{ display: 'grid', gap: '7px' }}>
                    {similarCustomers.slice(0, 5).map((entry) => (
                      <div key={entry.customerId} style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '8px', padding: '8px', background: 'rgba(252,231,243,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{entry.customerName}</div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e' }}>{entry.confidence}%</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>{entry.mobileNumber || '-'} | {entry.email || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{entry.reason || entry.status}</div>
                        <div style={{ marginTop: '6px' }}>
                          <button
                            type="button"
                            style={{ border: '1px solid #93c5fd', borderRadius: '8px', background: '#fff', color: 'var(--color-primary-dark)', fontSize: '11px', fontWeight: 700, padding: '4px 8px', cursor: 'pointer' }}
                            onClick={() => {
                              const existing = customers.find((customer) => customer._id === entry.customerId);
                              if (existing) openCustomerHistory(existing);
                            }}
                          >
                            Use Existing Customer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <label style={shell.label}>Segment</label>
              <div style={shell.inlineChecks}>
                <label>
                  <input
                    type="radio"
                    name="segment"
                    checked={form.segment === 'Residential'}
                    onChange={() => setForm((prev) => ({ ...prev, segment: 'Residential' }))}
                  />{' '}
                  Residential
                </label>
                <label>
                  <input
                    type="radio"
                    name="segment"
                    checked={form.segment === 'Commercial'}
                    onChange={() => setForm((prev) => ({ ...prev, segment: 'Commercial' }))}
                  />{' '}
                  Commercial
                </label>
              </div>

              <label style={shell.label}>Company Name</label>
              <input
                style={shell.input}
                value={form.companyName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    companyName: event.target.value
                  }))
                }
              />

              <label style={shell.label}>Contact Person Name</label>
              <input
                style={shell.input}
                value={form.contactPersonName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    contactPersonName: event.target.value
                  }))
                }
              />

                <label style={shell.label}>Display Name</label>
                <select
                  style={shell.input}
                  value={displayNameOptions.includes(form.displayName) ? form.displayName : ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                >
                {displayNameOptions.length === 0 ? (
                  <option value="">Select from Company/Contact</option>
                ) : null}
                {displayNameOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>

              <label style={shell.label}>Position</label>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                <select
                  style={shell.input}
                  value={form.position}
                  onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                >
                  {positionOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <input
                  style={shell.input}
                  placeholder="Edit type"
                  disabled={form.position !== 'Edit type'}
                  value={form.positionCustom}
                  onChange={(event) => setForm((prev) => ({ ...prev, positionCustom: event.target.value }))}
                />
              </div>

              <label style={shell.label}>Mobile Number</label>
              <input
                style={shell.input}
                value={form.mobileNumber}
                inputMode="numeric"
                onChange={(event) =>
                  setForm((prev) => {
                    const mobileNumber = toTenDigitNumber(event.target.value);
                    return {
                      ...prev,
                      mobileNumber,
                      whatsappNumber: prev.whatsappSameAsMobile ? mobileNumber : prev.whatsappNumber
                    };
                  })
                }
              />

              <label style={shell.label}>WhatsApp Number</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                <input
                  style={shell.input}
                  value={form.whatsappSameAsMobile ? form.mobileNumber : form.whatsappNumber}
                  disabled={form.whatsappSameAsMobile}
                  inputMode="numeric"
                  onChange={(event) => setForm((prev) => ({ ...prev, whatsappNumber: toTenDigitNumber(event.target.value) }))}
                />
                <label style={{ fontSize: '11px', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={form.whatsappSameAsMobile}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        whatsappSameAsMobile: event.target.checked,
                        whatsappNumber: event.target.checked ? prev.mobileNumber : prev.whatsappNumber
                      }))
                    }
                  />{' '}
                  Same as mobile
                </label>
              </div>

              <label style={shell.label}>Alt Number</label>
              <input
                style={shell.input}
                value={form.altNumber}
                inputMode="numeric"
                onChange={(event) => setForm((prev) => ({ ...prev, altNumber: toTenDigitNumber(event.target.value) }))}
              />

              <label style={shell.label}>Email Id</label>
              <input
                style={shell.input}
                type="email"
                value={form.emailId}
                onChange={(event) => setForm((prev) => ({ ...prev, emailId: event.target.value }))}
              />

              <label style={shell.label}>GST Number</label>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px' }}>
                <label style={{ ...shell.inlineChecks, fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={form.hasGst}
                    onChange={(event) => setForm((prev) => ({ ...prev, hasGst: event.target.checked, gstNumber: event.target.checked ? prev.gstNumber : '' }))}
                  />
                  Yes
                </label>
                <input
                  style={shell.input}
                  placeholder="Enter GSTIN (e.g., 29ABCDE9999F1Z8)"
                  disabled={!form.hasGst}
                  value={form.gstNumber}
                  inputMode="text"
                  maxLength={15}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      gstNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
                    }))
                  }
                />
              </div>

              <label style={shell.label}>Billing Address</label>
              <div style={addressSplitStyle}>
                <div style={shell.addressCard}>
                  <div style={shell.addressHead}>
                    <h4 style={shell.addressTitle}>Billing Address</h4>
                  </div>
                  <div style={addressGridStyle}>
                    <label style={shell.label}>Attention</label>
                    <input style={shell.input} value={form.billingAttention} onChange={(event) => updateBillingField('billingAttention', event.target.value)} />

                    <label style={shell.label}>Address</label>
                    <textarea style={shell.textarea} placeholder="Address" value={form.billingStreet1} onChange={(event) => updateBillingField('billingStreet1', event.target.value)} />

                    <label style={shell.label}>Area</label>
                    <input
                      ref={billingAreaInputRef}
                      style={shell.input}
                      value={form.billingArea}
                      onPaste={(event) => {
                        const pastedText = String(event.clipboardData?.getData('text') || '').trim();
                        if (!pastedText) return;
                        if (extractGoogleMapsCoordinates(pastedText) || isAllowedGoogleMapsUrl(pastedText) || isGoogleMapsShortLink(pastedText)) {
                          event.preventDefault();
                          void resolveCustomerMapInput(pastedText, { sourceField: 'billingArea' });
                        }
                      }}
                      onChange={(event) => updateBillingField('billingArea', event.target.value)}
                    />

                    <label style={shell.label}>State</label>
                    <select style={shell.input} value={form.billingState} onChange={(event) => updateBillingField('billingState', event.target.value)}>
                      {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>

                    <label style={shell.label}>Pin Code</label>
                    <input style={shell.input} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={form.billingPincode} onChange={(event) => updateBillingField('billingPincode', event.target.value)} />

                  </div>
                </div>

                <div style={shell.addressCard}>
                  <div style={shell.addressHead}>
                    <h4 style={shell.addressTitle}>Shipping Address</h4>
                    <button
                      type="button"
                      style={shell.addressCopy}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          shippingSameAsBilling: true,
                          ...copyBillingToShipping(prev)
                        }))
                      }
                    >
                      ↓ Copy billing address
                    </button>
                  </div>
                  <div style={addressGridStyle}>
                    <label style={shell.label}>Attention</label>
                    <input style={shell.input} value={form.shippingAttention} onChange={(event) => updateShippingField('shippingAttention', event.target.value)} />

                    <label style={shell.label}>Address</label>
                    <textarea style={shell.textarea} placeholder="Address" value={form.shippingStreet1} onChange={(event) => updateShippingField('shippingStreet1', event.target.value)} />

                    <label style={shell.label}>Area</label>
                    <input style={shell.input} value={form.shippingArea} onChange={(event) => updateShippingField('shippingArea', event.target.value)} />

                    <label style={shell.label}>State</label>
                    <select style={shell.input} value={form.shippingState} onChange={(event) => updateShippingField('shippingState', event.target.value)}>
                      {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>

                    <label style={shell.label}>Pin Code</label>
                    <input style={shell.input} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={form.shippingPincode} onChange={(event) => updateShippingField('shippingPincode', event.target.value)} />

                  </div>
                </div>
              </div>

              <label style={shell.label}>Area in sqft</label>
              <input
                style={shell.input}
                type="number"
                value={form.areaSqft}
                onChange={(event) => setForm((prev) => ({ ...prev, areaSqft: event.target.value }))}
              />

              {renderAddressSearchControls('shipping')}

              <CustomerPremisesPanel
                customerId={editingId}
                customer={customers.find((customer) => customer._id === editingId) || null}
                form={form}
                onError={setSaveError}
              />

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
                  setShowModal(false);
                  setEditingId(null);
                  setSaveError('');
                  setSimilarCustomers([]);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
              <button type="submit" style={shell.saveButton} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingId ? 'Update Customer' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}

      {showImportWizard ? (
        <CustomerImportDedupWizard
          open={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onComplete={async () => {
            await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
          }}
        />
      ) : null}

      {showDuplicateReport ? createPortal(
        <div style={modalOverlayStyle}>
          <div className="crm-modal-surface" style={{ ...modalStyle, width: 'min(1180px, 100%)' }}>
            <div className="crm-modal-surface-header" style={modalHeaderStyle}>Duplicate Report & Data Health</div>
            <div className="crm-modal-surface-body" style={duplicateModalBodyStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', gridColumn: '1 / -1' }}>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Active Customers</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{duplicateSummary?.totalActiveCustomers || 0}</p>
                </div>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Exact Duplicate Pairs</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#991b1b' }}>{duplicateSummary?.exactDuplicatePairs || 0}</p>
                </div>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Possible Duplicate Pairs</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#92400e' }}>{duplicateSummary?.possibleDuplicatePairs || 0}</p>
                </div>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Customer Data Health Score</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{duplicateSummary?.customerDataHealthScore ?? 100}</p>
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fff' }}>
                <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={shell.headCell}>Customer A</th>
                      <th style={shell.headCell}>Customer B</th>
                      <th style={shell.headCell}>Score</th>
                      <th style={shell.headCell}>Status</th>
                      <th style={shell.headCell}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRows.length === 0 ? (
                      <tr><td style={shell.cell} colSpan={5}>No duplicate pairs found.</td></tr>
                    ) : duplicateRows.slice(0, 200).map((row) => (
                      <tr key={row.pairId}>
                        <td style={shell.cell}>{row.customerAName} ({row.customerAId})</td>
                        <td style={shell.cell}>{row.customerBName} ({row.customerBId})</td>
                        <td style={shell.cell}>{row.score}%</td>
                        <td style={shell.cell}>{row.status}</td>
                        <td style={shell.cell}>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="crm-modal-surface-footer" style={modalFooterStyle}>
              <button type="button" style={shell.cancelButton} onClick={() => setShowDuplicateReport(false)}>Close</button>
              <button type="button" style={shell.cancelButton} onClick={() => exportDuplicateReport('csv')}>Export CSV</button>
              <button type="button" style={shell.saveButton} onClick={() => exportDuplicateReport('pdf')}>Export PDF</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
