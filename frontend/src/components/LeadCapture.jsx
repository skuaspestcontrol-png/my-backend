import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { attachPlacesAutocomplete } from '../utils/googlePlaces';
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Download,
  MapPin,
  MoreHorizontal,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  User,
  X
} from 'lucide-react';

const LEAD_SOURCES = ['Call', 'GoogleAds', 'GMB', 'Website', 'Reference', 'RPCI', 'Hometriangle', 'Justdial', 'Indiamart', 'Walkin'];
const PEST_ISSUES = [
  'Cockroach Control',
  'Rodent Control',
  'Bedbug Control',
  'Bird Netting',
  'Bird Spike',
  'Reticulation Piping System',
  'General Pest Control',
  'Termite Control',
  'Pre Construction Termite Control',
  'Ants Control',
  'Flies Control',
  'Mosquito Spray',
  'Mosquito Fogging',
  'Spider Control',
  'WASP Control',
  'Wood Borer Control'
];
const INDIA_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];
const PROPERTY_TYPES = ['Residential', 'Commercial'];
const LEAD_STATUSES = ['New Lead', 'Interested', 'Not Interested', 'Converted', 'Cancelled'];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ALL_FILTER_VALUE = '__all__';
const MONTH_FILTER_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];
const leadColumns = [
  { key: 'date', label: 'Lead Date' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'whatsappNumber', label: 'WhatsApp Number' },
  { key: 'emailId', label: 'Email Id' },
  { key: 'address', label: 'Address' },
  { key: 'areaName', label: 'Area Name' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'pestIssue', label: 'Pest Issue' },
  { key: 'leadSource', label: 'Lead Source' },
  { key: 'propertyType', label: 'Property Type' },
  { key: 'status', label: 'Lead Status' },
  { key: 'followupDate', label: 'Followup Date' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'referenceCustomerName', label: 'Reference Customer' },
  { key: 'referenceCustomerDate', label: 'Reference Customer Date' },
  { key: 'remarks', label: 'Remarks' }
];
const defaultVisibleLeadColumns = ['customerName', 'mobile', 'pestIssue', 'leadSource', 'status', 'assignedTo', 'followupDate', 'city', 'state'];
const defaultOverviewFilters = {
  year: ALL_FILTER_VALUE,
  month: ALL_FILTER_VALUE,
  pestIssue: ALL_FILTER_VALUE,
  leadSource: ALL_FILTER_VALUE,
  status: ALL_FILTER_VALUE,
  assignedTo: ALL_FILTER_VALUE
};

const emptyForm = {
  customerOption: 'New Customer',
  existingCustomerId: '',
  customerName: '',
  mobile: '',
  whatsappNumber: '',
  emailId: '',
  searchAddress: '',
  address: '',
  areaName: '',
  city: '',
  state: '',
  pincode: '',
  latitude: '',
  longitude: '',
  googlePlaceId: '',
  googlePlaceName: '',
  googlePhone: '',
  googleWebsite: '',
  pestIssue: '',
  leadSource: 'Call',
  propertyType: 'Residential',
  status: 'New Lead',
  followupDate: '',
  assignedTo: '',
  remarks: '',
  referenceCustomerId: '',
  referenceCustomerName: '',
  referenceCustomerDate: ''
};

const s = {
  ov: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto', backdropFilter: 'blur(12px)' },
  cn: { background: 'rgba(255,255,255,0.9)', width: '96%', maxWidth: '1220px', borderRadius: '24px', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)', border: '1px solid rgba(159, 23, 77, 0.24)' },
  hd: { background: 'var(--color-primary)', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, letterSpacing: '0.02em' },
  body: { padding: '22px', overflowY: 'auto', background: 'rgba(255,255,255,0.42)' },
  section: { background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(159, 23, 77, 0.14)', borderRadius: '18px', padding: '18px', marginBottom: '16px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(10px)' },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' },
  gd: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' },
  fieldWide: { gridColumn: 'span 3' },
  fieldHalf: { gridColumn: 'span 2' },
  in: { width: '100%', padding: '10px 12px', borderRadius: '12px', fontSize: '13px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.92)', outline: 'none' },
  ta: { width: '100%', padding: '10px 12px', borderRadius: '12px', fontSize: '13px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.92)', minHeight: '92px', resize: 'vertical', outline: 'none' },
  lb: { display: 'block', fontSize: '11px', fontWeight: 800, marginBottom: '6px', color: '#444', letterSpacing: '0.05em', textTransform: 'uppercase' },
  actionBox: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', border: '1px solid rgba(17,17,17,0.08)', transition: 'all 0.2s', background: 'rgba(255,255,255,0.78)' },
  smallButton: {
    border: '1px solid rgba(17,17,17,0.14)',
    background: 'rgba(255,255,255,0.95)',
    color: '#111111',
    borderRadius: '10px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer'
  },
  inlineLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  smallToggle: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#334155' },
  mapsRow: { display: 'flex', gap: '8px' },
  mapsButton: { minWidth: '148px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.04em' },
  referenceHint: { marginTop: '6px', fontSize: '11px', color: '#64748b' },
  referenceBadge: { marginTop: '8px', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(159,23,77,0.2)', background: 'rgba(252,231,243,0.55)', fontSize: '12px', color: '#1e293b', lineHeight: 1.5 },
  analyticsWrap: { background: 'rgba(255,255,255,0.82)', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.14)', padding: '12px', marginBottom: '10px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)', display: 'grid', gap: '10px' },
  analyticsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  analyticsTitleWrap: { display: 'grid', gap: '2px' },
  analyticsTitle: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111111' },
  analyticsSub: { margin: 0, color: '#64748b', fontSize: '12px', fontWeight: 600 },
  analyticsActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  analyticsBtn: { border: '1px solid rgba(17,17,17,0.16)', background: '#fff', color: '#111111', borderRadius: '8px', padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  analyticsBtnPrimary: { border: '1px solid rgba(159, 23, 77, 0.35)', background: 'rgba(252, 231, 243, 0.28)', color: 'var(--color-primary-dark)' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  metricCard: { border: '1px solid rgba(17,17,17,0.08)', borderRadius: '10px', background: '#fff', padding: '8px 10px', display: 'grid', gap: '4px' },
  metricLabel: { margin: 0, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 },
  metricValue: { margin: 0, color: '#111111', fontSize: '24px', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em' },
  metricSub: { margin: 0, color: '#7c8797', fontSize: '10px', fontWeight: 700 },
  filtersPanel: { border: '1px solid rgba(17,17,17,0.08)', borderRadius: '10px', background: 'rgba(255,255,255,0.95)', padding: '10px', display: 'grid', gap: '8px', overflowX: 'auto' },
  filtersGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr)) minmax(100px, auto)', gap: '8px', alignItems: 'end', minWidth: '920px' },
  filterField: { display: 'grid', gap: '4px', minWidth: 0 },
  filterLabel: { fontSize: '10px', color: '#4b5563', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  filterSelect: { width: '100%', minWidth: 0, minHeight: '34px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#334155', outline: 'none', boxSizing: 'border-box' },
  filterActions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' },
  applyButton: { border: '1px solid rgba(159, 23, 77, 0.34)', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', padding: '0 12px', minHeight: '34px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  clearButton: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', minWidth: '34px', minHeight: '34px', fontSize: '16px', lineHeight: 1, cursor: 'pointer' },
  registerCard: { background: '#fff', borderRadius: '16px', border: '1px solid var(--color-border)', overflow: 'visible', boxShadow: 'var(--shadow-sm)', backdropFilter: 'none' },
  registerHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: '#fff' },
  registerTitleWrap: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '8px', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-soft)' },
  registerTitle: { margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937' },
  registerActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '8px', padding: '7px 10px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '12px' },
  buttonGhost: { border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', borderRadius: '10px', width: '46px', height: '46px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  menu: { position: 'absolute', right: 0, top: '44px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', minWidth: '170px', boxShadow: '0 14px 32px rgba(15,23,42,0.12)', zIndex: 35, overflow: 'hidden' },
  menuButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  registerToolbar: { padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: '#fff' },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'nowrap', whiteSpace: 'nowrap' },
  toolLabel: { fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  toolbarMeta: { fontSize: '11px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' },
  customizeButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--color-primary-soft)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', width: '260px', zIndex: 45 },
  popoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', position: 'relative', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', tableLayout: 'fixed' },
  headCell: { textAlign: 'left', fontSize: '9px', fontWeight: 800, color: '#6b7280', padding: '6px 6px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  headCellResizable: { position: 'relative', paddingRight: '16px' },
  headLabelWrap: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headActionCell: { background: 'var(--color-primary-light)' },
  resizeHandle: { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '6px 6px', fontSize: '11px', color: '#111827', verticalAlign: 'middle', lineHeight: 1.2 },
  actionCell: { background: '#ffffff' },
  checkboxWrap: { width: '40px', textAlign: 'center' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  statusBadge: { background: 'rgba(159, 23, 77, 0.14)', color: 'var(--color-primary-dark)', padding: '5px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-block' },
  statusBadgeButton: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#334155',
    padding: '4px 8px',
    borderRadius: '7px',
    minWidth: '74px',
    minHeight: '26px',
    fontSize: '10px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1
  },
  statusInlineSelect: {
    minHeight: '26px',
    borderRadius: '8px',
    border: '1px solid rgba(159, 23, 77, 0.3)',
    background: '#fff',
    color: '#0f172a',
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 7px',
    outline: 'none',
    minWidth: '102px'
  },
  rowActionWrap: { position: 'relative', display: 'inline-flex', justifyContent: 'center', width: '100%' },
  rowActionButton: { border: '1px solid rgba(17,17,17,0.14)', background: '#fff', color: '#1f2937', borderRadius: '7px', minWidth: '62px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 700 },
  rowActionMenu: { position: 'fixed', minWidth: '196px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 12px 26px rgba(15,23,42,0.14)', zIndex: 1200, overflow: 'hidden' },
  rowActionMenuBtn: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', color: '#1f2937', cursor: 'pointer', padding: '8px 10px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  rowActionMenuBtnDisabled: { width: '100%', textAlign: 'left', border: 'none', background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed', padding: '8px 10px', fontSize: '12px', fontWeight: 600 },
  viewDrawerOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', zIndex: 2300 },
  viewDrawer: { position: 'fixed', top: 0, right: 0, width: 'min(460px, 96vw)', height: '100vh', background: '#fff', zIndex: 2400, boxShadow: '-16px 0 36px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--color-border)' },
  viewDrawerHead: { padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-primary-light)' },
  viewDrawerTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' },
  viewDrawerBody: { padding: '14px 16px', overflowY: 'auto', display: 'grid', gap: '12px' },
  viewCard: { border: '1px solid var(--color-border)', borderRadius: '12px', background: '#fff', padding: '12px', display: 'grid', gap: '8px' },
  viewCardTitle: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' },
  viewGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' },
  viewItem: { display: 'grid', gap: '2px' },
  viewItemLabel: { fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  viewItemValue: { fontSize: '13px', color: '#111827', fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word' },
  followupOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 2600, display: 'grid', placeItems: 'center', padding: '16px' },
  followupModal: { width: 'min(640px, 96vw)', background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(159, 23, 77, 0.26)', borderRadius: '16px', boxShadow: '0 24px 54px rgba(15,23,42,0.25)', overflow: 'hidden' },
  followupHead: { padding: '14px 16px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-primary)' },
  followupTitle: { margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  followupBody: { padding: '14px 16px', display: 'grid', gap: '12px', background: '#ffffff' },
  followupLeadBadge: { border: '1px solid rgba(159,23,77,0.2)', borderRadius: '10px', background: 'rgba(252,231,243,0.7)', padding: '10px 12px', color: '#334155', fontSize: '16px', fontWeight: 700 },
  followupGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  followupActions: { padding: '12px 16px', borderTop: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--color-primary-light)' },
  followupCancelBtn: { minHeight: '42px', padding: '0 20px', borderRadius: '10px', border: '1px solid #D1D5DB', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' },
  followupSaveBtn: { minHeight: '42px', padding: '0 20px', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.35)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, cursor: 'pointer' }
};

const formatEmployeeName = (employee) => {
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  return fullName || employee.empCode || 'Unnamed';
};

const normalizePhoneNumber = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);
const toObjectList = (value) => (
  Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    : []
);
const getLeadMobile = (lead) => lead.mobile || lead.mobileNumber || '';
const getLeadWhatsapp = (lead) => normalizePhoneNumber(lead.whatsappNumber || getLeadMobile(lead));
const toCanonicalLeadStatus = (value) => {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw) return 'New Lead';
  if (normalized === 'cancalled') return 'Cancelled';
  if (normalized === 'not intersted') return 'Not Interested';
  return raw;
};
const getLeadStatus = (lead) => toCanonicalLeadStatus(lead.status || lead.leadStatus || 'New Lead');
const normalizeLeadStatus = (value) => String(value || '').trim().toLowerCase();
const isLeadConverted = (lead) => normalizeLeadStatus(getLeadStatus(lead)) === 'converted';
const getLeadStatusBadgeStyle = (statusValue) => {
  const normalized = normalizeLeadStatus(statusValue);
  if (normalized === 'converted') {
    return { background: 'rgba(22, 163, 74, 0.16)', color: '#166534', borderColor: 'rgba(22,163,74,0.35)' };
  }
  if (normalized === 'cancalled' || normalized === 'cancelled') {
    return { background: 'rgba(220, 38, 38, 0.14)', color: '#991b1b', borderColor: 'rgba(220,38,38,0.35)' };
  }
  if (normalized === 'new lead') {
    return { background: 'rgba(250, 204, 21, 0.24)', color: '#854d0e', borderColor: 'rgba(234,179,8,0.4)' };
  }
  return { background: 'rgba(159, 23, 77, 0.14)', color: 'var(--color-primary-dark)', borderColor: 'rgba(159, 23, 77, 0.35)' };
};
const getLeadAssignedTo = (lead) => {
  const raw = String(lead.assignedTo || '').trim();
  return raw || 'Unassigned';
};
const isLeadUnassigned = (lead) => getLeadAssignedTo(lead) === 'Unassigned';
const getLeadDateValue = (lead) => {
  const source = lead.date || lead.createdAt || lead.followupDate;
  if (!source) return null;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
};
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const formatDisplayDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
const getCustomerMobile = (customer) => normalizePhoneNumber(customer.mobileNumber || customer.workPhone || '');
const getCustomerName = (customer) => customer.displayName || customer.name || customer.companyName || customer.contactPersonName || '';
const ROW_ACTION_MENU_APPROX_WIDTH = 212;
const ROW_ACTION_MENU_APPROX_HEIGHT = 274;
const ROW_ACTION_MENU_GAP = 8;
const FOLLOWUP_TYPES = ['Phone Call', 'WhatsApp', 'Site Visit', 'Email', 'Meeting'];
const FOLLOWUP_OUTCOMES = ['Callback Required', 'Interested', 'Not Interested', 'Converted', 'Cancelled', 'No Response'];

const mapLeadToCustomerPrefill = (lead) => {
  const customerName = String(lead.customerName || '').trim();
  const mobileNumber = normalizePhoneNumber(getLeadMobile(lead));
  const whatsappNumber = getLeadWhatsapp(lead) || mobileNumber;
  const segment = String(lead.propertyType || lead.customerSegment || '').trim() === 'Commercial' ? 'Commercial' : 'Residential';
  const billingState = String(lead.state || '').trim() || 'Delhi';
  const billingPincode = String(lead.pincode || lead.pinCode || '').trim();
  const billingArea = String(lead.areaName || '').trim();
  const billingAddress = String(lead.address || '').trim();
  const displayName = customerName || mobileNumber || 'Customer';

  return {
    segment,
    companyName: customerName,
    contactPersonName: customerName,
    displayName,
    position: 'Owner',
    positionCustom: '',
    mobileNumber,
    whatsappSameAsMobile: whatsappNumber === mobileNumber,
    whatsappNumber,
    altNumber: '',
    emailId: String(lead.emailId || '').trim(),
    hasGst: false,
    gstNumber: '',
    billingAttention: customerName,
    billingStreet1: billingAddress,
    billingStreet2: '',
    billingAddress,
    billingArea,
    billingState,
    billingPincode,
    billingPhoneCode: '+91',
    billingPhone: mobileNumber,
    shippingSameAsBilling: true,
    shippingAttention: customerName,
    shippingStreet1: billingAddress,
    shippingStreet2: '',
    shippingAddress: billingAddress,
    shippingArea: billingArea,
    shippingState: billingState,
    shippingPincode: billingPincode,
    shippingPhoneCode: '+91',
    shippingPhone: mobileNumber,
    areaSqft: ''
  };
};

export default function LeadCapture() {
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sameAsMobile, setSameAsMobile] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [rowActionLeadId, setRowActionLeadId] = useState('');
  const [rowActionMenuPosition, setRowActionMenuPosition] = useState(null);
  const [statusEditorLeadId, setStatusEditorLeadId] = useState('');
  const [statusDraftValue, setStatusDraftValue] = useState('');
  const [statusSavingLeadId, setStatusSavingLeadId] = useState('');
  const [viewLeadId, setViewLeadId] = useState('');
  const [logFollowupLeadId, setLogFollowupLeadId] = useState('');
  const [followupForm, setFollowupForm] = useState({
    type: FOLLOWUP_TYPES[0],
    outcome: FOLLOWUP_OUTCOMES[0],
    nextFollowupDate: '',
    followedUpBy: '',
    notes: ''
  });
  const [isSavingFollowup, setIsSavingFollowup] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [overviewFilters, setOverviewFilters] = useState(defaultOverviewFilters);
  const [overviewDraftFilters, setOverviewDraftFilters] = useState(defaultOverviewFilters);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    let saved = null;
    try {
      saved = localStorage.getItem('leads_visible_columns');
    } catch {
      return defaultVisibleLeadColumns;
    }
    if (!saved) return defaultVisibleLeadColumns;
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return defaultVisibleLeadColumns;
      const valid = parsed.filter((key) => leadColumns.some((column) => column.key === key));
      return valid.length > 0 ? valid : defaultVisibleLeadColumns;
    } catch {
      return defaultVisibleLeadColumns;
    }
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    let saved = null;
    try {
      saved = localStorage.getItem('leads_column_widths');
    } catch {
      return {};
    }
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreMenuButtonRef = useRef(null);
  const importFileRef = useRef(null);
  const resizeStateRef = useRef(null);
  const searchAddressInputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const salesEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const role = (employee.role || '').toString().trim().toLowerCase();
        return role.includes('sales');
      }),
    [employees]
  );

  const existingCustomers = useMemo(() => {
    const byCustomer = new Map();

    leads.forEach((lead) => {
      const key = `${lead.customerName || ''}-${getLeadMobile(lead)}`.trim();
      if (lead.customerName && !byCustomer.has(key)) byCustomer.set(key, lead);
    });

    return Array.from(byCustomer.values());
  }, [leads]);

  const referenceCustomers = useMemo(
    () =>
      [...customers]
        .filter((customer) => getCustomerName(customer))
        .sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b))),
    [customers]
  );

  const visibleColumnDefs = useMemo(
    () => leadColumns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );

  const yearFilterOptions = useMemo(() => {
    const years = new Set();
    leads.forEach((lead) => {
      const date = getLeadDateValue(lead);
      if (!date) return;
      years.add(String(date.getFullYear()));
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [leads]);

  const pestIssueFilterOptions = useMemo(() => {
    const values = new Set(PEST_ISSUES);
    leads.forEach((lead) => {
      const raw = String(lead.pestIssue || '').trim();
      if (raw) values.add(raw);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const leadSourceFilterOptions = useMemo(() => {
    const values = new Set(LEAD_SOURCES);
    leads.forEach((lead) => {
      const raw = String(lead.leadSource || '').trim();
      if (raw) values.add(raw);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const statusFilterOptions = useMemo(() => {
    const values = new Set(LEAD_STATUSES);
    leads.forEach((lead) => {
      const raw = String(getLeadStatus(lead) || '').trim();
      if (raw) values.add(raw);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const assignedToFilterOptions = useMemo(() => {
    const values = new Set(['Unassigned']);
    leads.forEach((lead) => {
      values.add(getLeadAssignedTo(lead));
    });
    return Array.from(values).sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return a.localeCompare(b);
    });
  }, [leads]);

  const matchesOverviewFilters = (lead) => {
    const date = getLeadDateValue(lead);
    const leadYear = date ? String(date.getFullYear()) : '';
    const leadMonth = date ? String(date.getMonth() + 1) : '';

    if (overviewFilters.year !== ALL_FILTER_VALUE && leadYear !== overviewFilters.year) return false;
    if (overviewFilters.month !== ALL_FILTER_VALUE && leadMonth !== overviewFilters.month) return false;
    if (overviewFilters.pestIssue !== ALL_FILTER_VALUE && String(lead.pestIssue || '').trim() !== overviewFilters.pestIssue) return false;
    if (overviewFilters.leadSource !== ALL_FILTER_VALUE && String(lead.leadSource || '').trim() !== overviewFilters.leadSource) return false;
    if (overviewFilters.status !== ALL_FILTER_VALUE && String(getLeadStatus(lead) || '').trim() !== overviewFilters.status) return false;
    if (overviewFilters.assignedTo !== ALL_FILTER_VALUE && getLeadAssignedTo(lead) !== overviewFilters.assignedTo) return false;
    return true;
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(matchesOverviewFilters);
  }, [leads, overviewFilters]);

  const visibleLeadIds = useMemo(
    () => filteredLeads.map((lead) => lead._id).filter(Boolean),
    [filteredLeads]
  );

  const isAllSelected = useMemo(
    () => visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id)),
    [visibleLeadIds, selectedLeadIds]
  );

  const leadOverviewSummary = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const newLeads = filteredLeads.filter((lead) => getLeadStatus(lead) === 'New Lead').length;
    const convertedLeads = filteredLeads.filter((lead) => getLeadStatus(lead) === 'Converted').length;
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100) : 0;
    const unassignedLeads = filteredLeads.filter((lead) => isLeadUnassigned(lead)).length;
    const followupLeads = filteredLeads.filter((lead) => Boolean(lead.followupDate)).length;

    return {
      totalLeads,
      newLeads,
      convertedLeads,
      conversionRate,
      unassignedLeads,
      followupLeads
    };
  }, [filteredLeads]);

  const mapLeadToForm = (lead) => ({
    ...emptyForm,
    customerOption: 'New Customer',
    existingCustomerId: '',
    customerName: lead.customerName || '',
    mobile: normalizePhoneNumber(getLeadMobile(lead)),
    whatsappNumber: normalizePhoneNumber(lead.whatsappNumber || getLeadMobile(lead)),
    emailId: lead.emailId || '',
    searchAddress: lead.searchAddress || lead.address || '',
    address: lead.address || '',
    areaName: lead.areaName || '',
    city: lead.city || '',
    state: lead.state || '',
    pincode: lead.pincode || lead.pinCode || '',
    latitude: lead.latitude || '',
    longitude: lead.longitude || '',
    googlePlaceId: lead.googlePlaceId || lead.google_place_id || '',
    googlePlaceName: lead.googlePlaceName || lead.google_place_name || '',
    googlePhone: lead.googlePhone || lead.google_phone || '',
    googleWebsite: lead.googleWebsite || lead.google_website || '',
    pestIssue: lead.pestIssue || '',
    leadSource: lead.leadSource || emptyForm.leadSource,
    propertyType: lead.propertyType || lead.customerSegment || emptyForm.propertyType,
    status: getLeadStatus(lead),
    followupDate: toDateInput(lead.followupDate),
    assignedTo: lead.assignedTo === 'Unassigned' ? '' : (lead.assignedTo || ''),
    remarks: lead.remarks || lead.notes || '',
    referenceCustomerId: lead.referenceCustomerId || lead.referredByCustomerId || '',
    referenceCustomerName: lead.referenceCustomerName || lead.referredByCustomerName || '',
    referenceCustomerDate: lead.referenceCustomerDate || lead.referredByCustomerDate || ''
  });

  const mapLeadForWorkflow = (lead) => ({
    ...lead,
    mobile: getLeadMobile(lead),
    mobileNumber: getLeadMobile(lead),
    status: getLeadStatus(lead)
  });

  const fetchLeadsAndEmployees = async () => {
    const [leadRes, employeeRes, customerRes] = await Promise.allSettled([
      axios.get(`${API_BASE_URL}/api/leads`),
      axios.get(`${API_BASE_URL}/api/employees`),
      axios.get(`${API_BASE_URL}/api/customers`)
    ]);

    if (leadRes.status === 'fulfilled') {
      setLeads(toObjectList(leadRes.value?.data));
    }
    if (employeeRes.status === 'fulfilled') {
      setEmployees(toObjectList(employeeRes.value?.data));
    }
    if (customerRes.status === 'fulfilled') {
      setCustomers(toObjectList(customerRes.value?.data));
    } else {
      setCustomers([]);
      console.error('Customers fetch failed in lead module:', customerRes.reason);
    }
  };

  const fetchEmployeesAndCustomers = async () => {
    const [employeeRes, customerRes] = await Promise.allSettled([
      axios.get(`${API_BASE_URL}/api/employees`),
      axios.get(`${API_BASE_URL}/api/customers`)
    ]);
    if (employeeRes.status === 'fulfilled') {
      setEmployees(toObjectList(employeeRes.value?.data));
    }
    if (customerRes.status === 'fulfilled') {
      setCustomers(toObjectList(customerRes.value?.data));
    } else {
      setCustomers([]);
      console.error('Customers fetch failed in lead module:', customerRes.reason);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [leadRes, employeeRes, customerRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/leads`),
          axios.get(`${API_BASE_URL}/api/employees`),
          axios.get(`${API_BASE_URL}/api/customers`)
        ]);

        if (!mounted) return;
        if (leadRes.status === 'fulfilled') {
          setLeads(toObjectList(leadRes.value?.data));
        } else {
          setLeads([]);
          console.error('Leads fetch failed', leadRes.reason);
        }
        if (employeeRes.status === 'fulfilled') {
          setEmployees(toObjectList(employeeRes.value?.data));
        } else {
          setEmployees([]);
          console.error('Employees fetch failed', employeeRes.reason);
        }
        if (customerRes.status === 'fulfilled') {
          setCustomers(toObjectList(customerRes.value?.data));
        } else {
          setCustomers([]);
          console.error('Customers fetch failed', customerRes.reason);
        }
      } catch (error) {
        console.error('Data fetch failed', error);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('leads_visible_columns', JSON.stringify(visibleColumns));
    } catch {
      // Ignore storage failures (private mode / blocked storage)
    }
  }, [visibleColumns]);

  useEffect(() => {
    try {
      localStorage.setItem('leads_column_widths', JSON.stringify(columnWidths));
    } catch {
      // Ignore storage failures (private mode / blocked storage)
    }
  }, [columnWidths]);

  useEffect(() => {
    let detach = () => {};
    const input = searchAddressInputRef.current;
    if (!show || !input) return () => {};

    attachPlacesAutocomplete({
      input,
      onSelected: (place) => {
        setSearchError('');
        setForm((current) => ({
          ...current,
          customerName: current.customerName || place.name || '',
          searchAddress: place.formatted_address || place.name || current.searchAddress,
          address: place.formatted_address || current.address,
          areaName: place.areaName || current.areaName,
          city: place.city || current.city,
          state: place.state || current.state,
          pincode: place.pincode || current.pincode,
          latitude: place.latitude !== null ? String(place.latitude) : current.latitude,
          longitude: place.longitude !== null ? String(place.longitude) : current.longitude,
          googlePlaceId: place.place_id || current.googlePlaceId,
          googlePlaceName: place.name || current.googlePlaceName,
          googlePhone: place.formatted_phone_number || place.international_phone_number || current.googlePhone,
          googleWebsite: place.website || current.googleWebsite
        }));
      },
      onError: (error) => {
        const message = String(error?.message || '').trim() || 'Google Places API not enabled';
        setSearchError(`${message}. Please verify API key, Places API access, domain restrictions, and billing in Google Cloud.`);
      },
      onRequireSelection: (message) => {
        setSearchError(message || 'Please select address/company from suggestions');
      }
    }).then((fn) => {
      detach = fn;
    });

    return () => detach();
  }, [show]);

  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((lead) => lead._id === id)));
  }, [leads]);

  const closeRowActionMenu = () => {
    setRowActionLeadId('');
    setRowActionMenuPosition(null);
  };

  const viewedLead = useMemo(
    () => leads.find((lead) => lead._id === viewLeadId) || null,
    [leads, viewLeadId]
  );
  const followupLead = useMemo(
    () => leads.find((lead) => lead._id === logFollowupLeadId) || null,
    [leads, logFollowupLeadId]
  );

  const openViewLeadPanel = (lead) => {
    setViewLeadId(lead?._id || '');
  };

  const closeViewLeadPanel = () => {
    setViewLeadId('');
  };

  const openLogFollowupModal = (lead) => {
    const leadId = String(lead?._id || '').trim();
    if (!leadId) return;
    setLogFollowupLeadId(leadId);
    setFollowupForm({
      type: FOLLOWUP_TYPES[0],
      outcome: FOLLOWUP_OUTCOMES[0],
      nextFollowupDate: toDateInput(lead?.followupDate),
      followedUpBy: '',
      notes: ''
    });
  };

  const closeLogFollowupModal = () => {
    setLogFollowupLeadId('');
    setFollowupForm({
      type: FOLLOWUP_TYPES[0],
      outcome: FOLLOWUP_OUTCOMES[0],
      nextFollowupDate: '',
      followedUpBy: '',
      notes: ''
    });
    setIsSavingFollowup(false);
  };

  const saveLogFollowup = async () => {
    const leadId = String(logFollowupLeadId || '').trim();
    if (!leadId || !followupLead) return;
    if (!followupForm.nextFollowupDate) {
      window.alert('Please select next follow-up date.');
      return;
    }

    const nextLog = {
      id: `FUP-${Date.now()}`,
      type: followupForm.type,
      outcome: followupForm.outcome,
      nextFollowupDate: followupForm.nextFollowupDate,
      followedUpBy: followupForm.followedUpBy || 'Unassigned',
      notes: followupForm.notes || '',
      createdAt: new Date().toISOString()
    };

    const currentLogs = Array.isArray(followupLead.followupLogs) ? followupLead.followupLogs : [];
    setIsSavingFollowup(true);
    try {
      const payload = {
        followupDate: followupForm.nextFollowupDate,
        followupLogs: [...currentLogs, nextLog],
        remarks: [String(followupLead.remarks || '').trim(), followupForm.notes.trim()].filter(Boolean).join(' | ')
      };
      const res = await axios.put(`${API_BASE_URL}/api/leads/${leadId}`, payload);
      const updated = res.data || {};
      setLeads((prev) => prev.map((entry) => (
        entry._id === leadId ? { ...entry, ...updated, _id: entry._id } : entry
      )));
      closeLogFollowupModal();
    } catch (error) {
      console.error('Log follow-up save failed', error);
      window.alert('Unable to save follow-up.');
      setIsSavingFollowup(false);
    }
  };

  const openStatusEditor = (lead) => {
    if (isLeadConverted(lead)) return;
    setStatusEditorLeadId(lead._id || '');
    setStatusDraftValue(String(getLeadStatus(lead) || 'New Lead'));
  };

  const closeStatusEditor = () => {
    setStatusEditorLeadId('');
    setStatusDraftValue('');
  };

  const updateLeadStatusInline = async (lead, nextStatus) => {
    if (isLeadConverted(lead)) return;
    const leadId = String(lead?._id || '').trim();
    const normalizedStatus = String(nextStatus || '').trim();
    if (!leadId || !normalizedStatus || !LEAD_STATUSES.includes(normalizedStatus)) return;
    if (normalizedStatus === String(getLeadStatus(lead) || '').trim()) {
      closeStatusEditor();
      return;
    }

    setStatusSavingLeadId(leadId);
    try {
      const res = await axios.put(`${API_BASE_URL}/api/leads/${leadId}`, {
        status: normalizedStatus,
        leadStatus: normalizedStatus
      });
      const updated = res.data || {};
      setLeads((prev) => prev.map((entry) => (
        entry._id === leadId
          ? {
            ...entry,
            ...updated,
            _id: entry._id,
            status: normalizedStatus,
            leadStatus: normalizedStatus
          }
          : entry
      )));
      closeStatusEditor();
    } catch (error) {
      console.error('Inline lead status update failed', error);
      window.alert('Unable to update lead status.');
    } finally {
      setStatusSavingLeadId('');
    }
  };

  const openRowActionMenu = (event, leadId) => {
    if (rowActionLeadId === leadId) {
      closeRowActionMenu();
      return;
    }

    const triggerRect = event.currentTarget.getBoundingClientRect();
    const maxLeft = window.innerWidth - ROW_ACTION_MENU_APPROX_WIDTH - ROW_ACTION_MENU_GAP;
    const anchorLeft = Math.max(
      ROW_ACTION_MENU_GAP,
      Math.min(maxLeft, triggerRect.right - ROW_ACTION_MENU_APPROX_WIDTH)
    );

    const fitsAbove = triggerRect.top >= ROW_ACTION_MENU_APPROX_HEIGHT + ROW_ACTION_MENU_GAP;
    const preferredTop = fitsAbove
      ? triggerRect.top - ROW_ACTION_MENU_APPROX_HEIGHT - 4
      : triggerRect.bottom + ROW_ACTION_MENU_GAP;
    const maxTop = window.innerHeight - ROW_ACTION_MENU_APPROX_HEIGHT - ROW_ACTION_MENU_GAP;
    const anchorTop = Math.max(
      ROW_ACTION_MENU_GAP,
      Math.min(maxTop, preferredTop)
    );

    setRowActionLeadId(leadId);
    setRowActionMenuPosition({
      left: anchorLeft,
      top: anchorTop
    });
  };

  useEffect(() => {
    const onDocClick = (event) => {
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

      const clickedInsideRowAction = target && typeof target.closest === 'function'
        ? target.closest('[data-lead-row-action=\"true\"]')
        : null;
      if (rowActionLeadId && !clickedInsideRowAction) {
        closeRowActionMenu();
      }

      const clickedInsideStatusEditor = target && typeof target.closest === 'function'
        ? target.closest('[data-lead-status-editor=\"true\"]')
        : null;
      if (statusEditorLeadId && !clickedInsideStatusEditor) {
        closeStatusEditor();
      }

      const clickedInsideViewDrawer = target && typeof target.closest === 'function'
        ? target.closest('[data-lead-view-drawer=\"true\"]')
        : null;
      if (viewLeadId && !clickedInsideViewDrawer) {
        closeViewLeadPanel();
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

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowCustomize(false);
        closeRowActionMenu();
        closeStatusEditor();
        closeViewLeadPanel();
        closeLogFollowupModal();
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [rowActionLeadId, showCustomize, showMoreMenu, statusEditorLeadId, viewLeadId]);

  useEffect(() => {
    if (!rowActionLeadId) return undefined;

    const closeMenuOnViewportChange = () => {
      setRowActionLeadId('');
      setRowActionMenuPosition(null);
    };

    window.addEventListener('resize', closeMenuOnViewportChange);
    window.addEventListener('scroll', closeMenuOnViewportChange, true);
    return () => {
      window.removeEventListener('resize', closeMenuOnViewportChange);
      window.removeEventListener('scroll', closeMenuOnViewportChange, true);
    };
  }, [rowActionLeadId]);

  const applyOverviewFilters = () => {
    setOverviewFilters({ ...overviewDraftFilters });
    setSelectedLeadIds([]);
  };

  const clearOverviewFilters = () => {
    setOverviewFilters({ ...defaultOverviewFilters });
    setOverviewDraftFilters({ ...defaultOverviewFilters });
    setSelectedLeadIds([]);
  };

  const refreshLeadData = async () => {
    try {
      await fetchLeadsAndEmployees();
      setSelectedLeadIds([]);
    } catch (error) {
      console.error('Refresh failed', error);
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSameAsMobile(false);
    setEditingLeadId(null);
    setShowReferencePicker(false);
    setShow(false);
  };

  const openLeadModal = async () => {
    setForm(emptyForm);
    setSameAsMobile(false);
    setEditingLeadId(null);
    setShowReferencePicker(false);
    setShow(true);
    try {
      await fetchEmployeesAndCustomers();
    } catch (error) {
      console.error('Employee refresh failed', error);
    }
  };

  const openEditLeadModal = async (lead, preselectAssign = false) => {
    if (isLeadConverted(lead)) {
      window.alert('Converted leads cannot be edited in Lead Portal.');
      return;
    }
    const nextForm = mapLeadToForm(lead);
    if (preselectAssign && !nextForm.assignedTo && salesEmployees.length > 0) {
      nextForm.assignedTo = formatEmployeeName(salesEmployees[0]);
    }

    setForm(nextForm);
    setEditingLeadId(lead._id);
    setSameAsMobile((nextForm.mobile || '') === (nextForm.whatsappNumber || ''));
    setShowReferencePicker(nextForm.leadSource === 'Reference' && Boolean(nextForm.referenceCustomerName || nextForm.referenceCustomerId));
    setShow(true);

    try {
      await fetchEmployeesAndCustomers();
    } catch (error) {
      console.error('Employee refresh failed', error);
    }
  };

  const openQuotationForLead = (lead) => {
    navigate('/create-quote', { state: { lead: mapLeadForWorkflow(lead) } });
  };

  const sendWelcomeMessageToLead = (lead) => {
    const whatsappNumber = getLeadWhatsapp(lead);
    if (whatsappNumber.length !== 10) {
      window.alert('Valid WhatsApp number is required to send welcome message.');
      return;
    }

    const encoded = encodeURIComponent(
      `Hello ${lead.customerName || 'Customer'}, welcome to SKUAS Master ERP. Thank you for your enquiry${lead.pestIssue ? ` for ${lead.pestIssue}` : ''}. Our team will connect with you shortly.`
    );
    window.open(`https://wa.me/91${whatsappNumber}?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  const convertToContract = async (lead) => {
    if (lead?._id) {
      try {
        await axios.put(`${API_BASE_URL}/api/leads/${lead._id}`, {
          status: 'Converted',
          leadStatus: 'Converted'
        });
      } catch (error) {
        console.error('Lead conversion status update failed', error);
      }
    }

    navigate('/sales/customers', {
      state: {
        openNewCustomer: true,
        prefillCustomerFromLead: mapLeadToCustomerPrefill(lead),
        sourceLeadId: lead?._id || ''
      }
    });
  };

  const handleCustomerOptionChange = (value) => {
    setSameAsMobile(false);
    setShowReferencePicker(false);
    setForm((current) => ({
      ...emptyForm,
      customerOption: value,
      assignedTo: current.assignedTo
    }));
  };

  const handleExistingCustomerChange = (customerKey) => {
    const selectedLead = existingCustomers.find(
      (lead) => `${lead.customerName || ''}-${getLeadMobile(lead)}` === customerKey
    );

    if (!selectedLead) {
      updateForm('existingCustomerId', customerKey);
      return;
    }

    setForm((current) => ({
      ...current,
      existingCustomerId: customerKey,
      customerName: selectedLead.customerName || '',
      mobile: normalizePhoneNumber(getLeadMobile(selectedLead)),
      whatsappNumber: normalizePhoneNumber(selectedLead.whatsappNumber || getLeadMobile(selectedLead) || ''),
      emailId: selectedLead.emailId || '',
      searchAddress: selectedLead.searchAddress || selectedLead.address || '',
      address: selectedLead.address || '',
      areaName: selectedLead.areaName || '',
      city: selectedLead.city || '',
      state: selectedLead.state || '',
      pincode: selectedLead.pincode || selectedLead.pinCode || ''
    }));
  };

  const getAddressPart = (components, ...types) => {
    for (const type of types) {
      const part = components.find((component) => component.types?.includes(type));
      if (part?.long_name) return part.long_name;
    }
    return '';
  };

  const extractAddressFields = (best = {}) => {
    const components = Array.isArray(best.address_components) ? best.address_components : [];
    const formattedAddress = String(best.formatted_address || '').trim();
    const fallbackPinMatch = formattedAddress.match(/\b\d{6}\b/);

    const areaName = getAddressPart(
      components,
      'sublocality_level_1',
      'sublocality_level_2',
      'sublocality',
      'neighborhood',
      'premise',
      'route'
    );
    const city = getAddressPart(
      components,
      'locality',
      'postal_town',
      'administrative_area_level_3',
      'administrative_area_level_2'
    );
    const state = getAddressPart(components, 'administrative_area_level_1');
    const pincode = getAddressPart(components, 'postal_code') || (fallbackPinMatch ? fallbackPinMatch[0] : '');

    return { areaName, city, state, pincode };
  };

  const parseLatLngFromGoogleUrl = (rawText) => {
    if (!rawText) return null;
    const text = rawText.trim();

    const atMatch = text.match(/@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/);
    if (atMatch) return { lat: atMatch[1], lng: atMatch[3] };

    try {
      const url = new URL(text);
      const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
      const coordsMatch = q.match(/(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
      if (coordsMatch) return { lat: coordsMatch[1], lng: coordsMatch[3] };
    } catch {
      return null;
    }

    return null;
  };

  const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

  const buildAreaSearchFields = (entry = {}) => ([
    entry.areaName,
    entry.area,
    entry.billingArea,
    entry.shippingArea
  ].map((field) => normalizeSearchText(field)).filter(Boolean));

  const fetchAddressFromGoogleMaps = async () => {
    if (isFetchingAddress) return;
    const query = String(form.searchAddress || '').trim();
    if (!query) {
      if (searchAddressInputRef.current) searchAddressInputRef.current.focus();
      setSearchError('Enter address/company text first, then search.');
      return;
    }

    setIsFetchingAddress(true);
    setSearchError('');
    try {
      const withTimeout = (promise, timeoutMs, timeoutMessage) => (
        Promise.race([
          promise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
          })
        ])
      );

      const tryClientPlacesSearch = async () => new Promise((resolve) => {
        if (!window.google?.maps?.places) {
          resolve(null);
          return;
        }
        const service = new window.google.maps.places.PlacesService(document.createElement('div'));
        service.findPlaceFromQuery(
          {
            query,
            fields: [
              'place_id',
              'name',
              'formatted_address',
              'geometry',
              'formatted_phone_number',
              'international_phone_number',
              'website',
              'types',
              'address_components'
            ]
          },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(results) && results[0]) {
              resolve(results[0]);
              return;
            }
            resolve(null);
          }
        );
      });

      const placeToServerShape = (place) => ({
        name: String(place?.name || '').trim(),
        place_id: String(place?.place_id || '').trim(),
        formatted_address: String(place?.formatted_address || '').trim(),
        geometry: place?.geometry || {},
        formatted_phone_number: String(place?.formatted_phone_number || '').trim(),
        international_phone_number: String(place?.international_phone_number || '').trim(),
        website: String(place?.website || '').trim(),
        address_components: Array.isArray(place?.address_components) ? place.address_components : [],
        types: Array.isArray(place?.types) ? place.types : []
      });

      const response = await withTimeout(
        axios.post(`${API_BASE_URL}/api/maps/geocode`, { address: query }, { timeout: 10000 }),
        12000,
        'Location lookup timed out'
      );
      let best = response?.data?.result || response?.data || {};
      if (!best || (!best.formatted_address && !best.place_id && !best.name)) {
        const place = await withTimeout(
          tryClientPlacesSearch(),
          5000,
          'Places lookup timed out'
        ).catch(() => null);
        if (place) best = placeToServerShape(place);
      }
      const formattedAddress = String(best.formatted_address || query).trim();
      const placeName = String(best.name || '').trim();
      const placeId = String(best.place_id || '').trim();
      const placePhone = String(best.formatted_phone_number || best.international_phone_number || '').trim();
      const placeWebsite = String(best.website || '').trim();
      const location = best?.geometry?.location || {};
      const lat = Number(location.lat);
      const lng = Number(location.lng);
      const extracted = extractAddressFields(best);

      setForm((current) => ({
        ...current,
        customerName: current.customerName || placeName || current.customerName,
        searchAddress: formattedAddress || current.searchAddress,
        address: formattedAddress || current.address,
        areaName: extracted.areaName || current.areaName,
        city: extracted.city || current.city,
        state: extracted.state || current.state,
        pincode: extracted.pincode || current.pincode,
        latitude: Number.isFinite(lat) ? String(lat) : current.latitude,
        longitude: Number.isFinite(lng) ? String(lng) : current.longitude,
        googlePlaceId: placeId || current.googlePlaceId,
        googlePlaceName: placeName || current.googlePlaceName,
        googlePhone: placePhone || current.googlePhone,
        googleWebsite: placeWebsite || current.googleWebsite
      }));
    } catch (error) {
      let best = null;
      try {
        const place = await withTimeout(new Promise((resolve) => {
          if (!window.google?.maps?.places) {
            resolve(null);
            return;
          }
          const service = new window.google.maps.places.PlacesService(document.createElement('div'));
          service.findPlaceFromQuery(
            {
              query,
              fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components']
            },
            (results, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(results) && results[0]) {
                resolve(results[0]);
                return;
              }
              resolve(null);
            }
          );
        }), 5000, 'Places lookup timed out');
        if (place) best = place;
      } catch {
        best = null;
      }

      if (best) {
        const normalized = {
          name: String(best?.name || '').trim(),
          place_id: String(best?.place_id || '').trim(),
          formatted_address: String(best?.formatted_address || query).trim(),
          geometry: best?.geometry || {},
          address_components: Array.isArray(best?.address_components) ? best.address_components : []
        };
        const formattedAddress = normalized.formatted_address;
        const location = normalized?.geometry?.location || {};
        const lat = Number(typeof location?.lat === 'function' ? location.lat() : location?.lat);
        const lng = Number(typeof location?.lng === 'function' ? location.lng() : location?.lng);
        const extracted = extractAddressFields(normalized);
        setForm((current) => ({
          ...current,
          customerName: current.customerName || normalized.name || current.customerName,
          searchAddress: formattedAddress || current.searchAddress,
          address: formattedAddress || current.address,
          areaName: extracted.areaName || current.areaName,
          city: extracted.city || current.city,
          state: extracted.state || current.state,
          pincode: extracted.pincode || current.pincode,
          latitude: Number.isFinite(lat) ? String(lat) : current.latitude,
          longitude: Number.isFinite(lng) ? String(lng) : current.longitude,
          googlePlaceId: normalized.place_id || current.googlePlaceId,
          googlePlaceName: normalized.name || current.googlePlaceName
        }));
        setSearchError('');
        return;
      }

      const message = String(error?.response?.data?.error || error?.message || '').trim();
      setSearchError(message || 'Unable to fetch location. Check Google Maps key, API access, domain restriction, and billing.');
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const copyMobileToWhatsapp = () => {
    if (!form.mobile.trim()) return;
    updateForm('whatsappNumber', normalizePhoneNumber(form.mobile.trim()));
  };

  const handleMobileChange = (value) => {
    const sanitized = normalizePhoneNumber(value);
    setForm((current) => ({
      ...current,
      mobile: sanitized,
      whatsappNumber: sameAsMobile ? sanitized : current.whatsappNumber
    }));
  };

  const handleWhatsappChange = (value) => {
    updateForm('whatsappNumber', normalizePhoneNumber(value));
  };

  const handleSameAsMobileToggle = (checked) => {
    setSameAsMobile(checked);
    if (checked) copyMobileToWhatsapp();
  };

  const handleLeadSourceChange = (value) => {
    setForm((current) => ({
      ...current,
      leadSource: value,
      referenceCustomerId: value === 'Reference' ? current.referenceCustomerId : '',
      referenceCustomerName: value === 'Reference' ? current.referenceCustomerName : '',
      referenceCustomerDate: value === 'Reference' ? current.referenceCustomerDate : ''
    }));
    if (value !== 'Reference') {
      setShowReferencePicker(false);
    }
  };

  const handleReferenceCustomerSelect = (customerId) => {
    const selectedCustomer = referenceCustomers.find((customer) => customer._id === customerId);
    if (!selectedCustomer) {
      setForm((current) => ({
        ...current,
        referenceCustomerId: customerId,
        referenceCustomerName: '',
        referenceCustomerDate: ''
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      referenceCustomerId: selectedCustomer._id,
      referenceCustomerName: getCustomerName(selectedCustomer),
      referenceCustomerDate: toDateInput(selectedCustomer.createdAt)
    }));
  };

  const toggleSelectLead = (leadId) => {
    setSelectedLeadIds((prev) => (
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    ));
  };

  const toggleSelectAll = () => {
    setSelectedLeadIds((prev) => {
      if (isAllSelected) {
        return prev.filter((id) => !visibleLeadIds.includes(id));
      }
      const merged = new Set([...prev, ...visibleLeadIds]);
      return Array.from(merged);
    });
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
    const width = Number(columnWidths[columnKey]);
    if (!Number.isFinite(width) || width <= 0) return {};
    const clampedWidth = Math.max(88, Math.min(220, width));
    return { width: `${clampedWidth}px`, minWidth: `${clampedWidth}px`, maxWidth: `${clampedWidth}px` };
  };

  const startColumnResize = (event, columnKey) => {
    event.preventDefault();
    event.stopPropagation();
    const th = event.currentTarget.closest('th');
    const startWidth = Number(columnWidths[columnKey]) || th?.offsetWidth || 160;
    resizeStateRef.current = { columnKey, startX: event.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      if (!resizeStateRef.current) return;
      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const nextWidth = Math.max(88, Math.min(220, resizeStateRef.current.startWidth + delta));
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

  const getLeadColumnValue = (lead, key) => {
    if (key === 'date') return formatDisplayDate(lead.date || lead.createdAt);
    if (key === 'customerName') return lead.customerName || '';
    if (key === 'mobile') return normalizePhoneNumber(getLeadMobile(lead));
    if (key === 'whatsappNumber') return normalizePhoneNumber(lead.whatsappNumber || getLeadMobile(lead));
    if (key === 'emailId') return lead.emailId || '';
    if (key === 'address') return lead.address || '';
    if (key === 'areaName') return lead.areaName || '';
    if (key === 'city') return lead.city || '';
    if (key === 'state') return lead.state || '';
    if (key === 'pincode') return lead.pincode || lead.pinCode || '';
    if (key === 'pestIssue') return lead.pestIssue || '';
    if (key === 'leadSource') return lead.leadSource || '';
    if (key === 'propertyType') return lead.propertyType || lead.customerSegment || '';
    if (key === 'status') return getLeadStatus(lead);
    if (key === 'followupDate') return formatDisplayDate(lead.followupDate);
    if (key === 'assignedTo') return lead.assignedTo || 'Unassigned';
    if (key === 'referenceCustomerName') return lead.referenceCustomerName || lead.referredByCustomerName || '';
    if (key === 'referenceCustomerDate') return formatDisplayDate(lead.referenceCustomerDate || lead.referredByCustomerDate);
    if (key === 'remarks') return lead.remarks || lead.notes || '';
    return lead[key] || '';
  };

  const csvEscape = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values;
  };

  const openEditSelectedLead = () => {
    if (selectedLeadIds.length !== 1) {
      window.alert('Select exactly one lead to edit.');
      return;
    }
    const selectedLead = leads.find((lead) => lead._id === selectedLeadIds[0]);
    if (!selectedLead) {
      window.alert('Selected lead is not available.');
      return;
    }
    if (isLeadConverted(selectedLead)) {
      window.alert('Converted leads cannot be edited in Lead Portal.');
      return;
    }
    setShowMoreMenu(false);
    openEditLeadModal(selectedLead);
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeadIds.length === 0) {
      window.alert('Select at least one lead to delete.');
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedLeadIds.length} selected lead(s)?`);
    if (!confirmed) return;

    try {
      await Promise.all(selectedLeadIds.map((id) => axios.delete(`${API_BASE_URL}/api/leads/${id}`)));
      setSelectedLeadIds([]);
      setShowMoreMenu(false);
      await fetchLeadsAndEmployees();
    } catch (error) {
      console.error('Failed to delete selected leads', error);
      window.alert('Unable to delete selected leads.');
    }
  };

  const exportData = () => {
    const sourceRows = selectedLeadIds.length > 0
      ? leads.filter((lead) => selectedLeadIds.includes(lead._id))
      : filteredLeads;

    if (sourceRows.length === 0) {
      window.alert('No lead data available to export.');
      return;
    }

    const headers = leadColumns.map((column) => column.key);
    const csvRows = [
      headers.join(','),
      ...sourceRows.map((lead) => headers.map((key) => csvEscape(getLeadColumnValue(lead, key))).join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
  };

  const normalizeLeadImportPayload = (record) => {
    const leadSourceRaw = String(record.leadSource || '').trim();
    const propertyTypeRaw = String(record.propertyType || record.customerSegment || '').trim();
    const statusRaw = toCanonicalLeadStatus(record.status || record.leadStatus);
    const followupRaw = record.followupDate || record.followUpDate || '';
    const followupDate = (() => {
      if (!followupRaw) return null;
      const parsed = new Date(followupRaw);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().slice(0, 10);
    })();

    const leadSource = LEAD_SOURCES.includes(leadSourceRaw) ? leadSourceRaw : emptyForm.leadSource;
    const propertyType = PROPERTY_TYPES.includes(propertyTypeRaw) ? propertyTypeRaw : emptyForm.propertyType;
    const status = LEAD_STATUSES.includes(statusRaw) ? statusRaw : emptyForm.status;
    const mobile = normalizePhoneNumber(record.mobile || record.mobileNumber || '');
    const whatsappNumber = normalizePhoneNumber(record.whatsappNumber || record.whatsapp || mobile);

    return {
      customerName: String(record.customerName || '').trim(),
      mobile,
      mobileNumber: mobile,
      whatsappNumber,
      emailId: String(record.emailId || record.email || '').trim(),
      searchAddress: String(record.searchAddress || record.address || '').trim(),
      address: String(record.address || '').trim(),
      areaName: String(record.areaName || '').trim(),
      city: String(record.city || '').trim(),
      state: String(record.state || '').trim(),
      pincode: String(record.pincode || record.pinCode || '').trim(),
      pinCode: String(record.pincode || record.pinCode || '').trim(),
      pestIssue: String(record.pestIssue || '').trim(),
      leadSource,
      propertyType,
      customerSegment: propertyType,
      status,
      leadStatus: status,
      followupDate,
      assignedTo: String(record.assignedTo || 'Unassigned').trim() || 'Unassigned',
      remarks: String(record.remarks || record.notes || '').trim(),
      notes: String(record.remarks || record.notes || '').trim(),
      referenceCustomerId: String(record.referenceCustomerId || record.referredByCustomerId || '').trim(),
      referenceCustomerName: String(record.referenceCustomerName || record.referredByCustomerName || '').trim(),
      referenceCustomerDate: String(record.referenceCustomerDate || record.referredByCustomerDate || '').trim()
    };
  };

  const importDataFromFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let rows = [];

      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length > 1) {
          const headers = parseCsvLine(lines[0]).map((header) => header.trim());
          rows = lines.slice(1).map((line) => {
            const values = parseCsvLine(line);
            const row = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] ?? '';
            });
            return row;
          });
        }
      }

      if (rows.length === 0) {
        window.alert('File has no lead rows to import.');
        return;
      }

      const payloads = rows
        .map(normalizeLeadImportPayload)
        .filter((row) => row.customerName || row.mobile || row.address || row.pestIssue);

      if (payloads.length === 0) {
        window.alert('No valid lead rows found to import.');
        return;
      }

      await Promise.all(payloads.map((payload) => axios.post(`${API_BASE_URL}/api/leads`, payload)));
      await fetchLeadsAndEmployees();
      setSelectedLeadIds([]);
      setShowMoreMenu(false);
      window.alert(`Imported ${payloads.length} lead(s) successfully.`);
    } catch (error) {
      console.error('Failed to import lead data', error);
      window.alert('Import failed. Please upload valid CSV or JSON data.');
    } finally {
      event.target.value = '';
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.mobile.length !== 10) {
      alert('Mobile number must be exactly 10 digits.');
      return;
    }
    if (form.whatsappNumber && form.whatsappNumber.length !== 10) {
      alert('WhatsApp number must be exactly 10 digits.');
      return;
    }
    if (form.leadSource === 'Reference' && !form.referenceCustomerId) {
      alert('Please select the reference customer.');
      return;
    }

    try {
      const payload = {
        ...form,
        mobileNumber: form.mobile,
        pinCode: form.pincode,
        customerSegment: form.propertyType,
        leadStatus: form.status,
        notes: form.remarks,
        followupDate: form.followupDate ? form.followupDate : null,
        assignedTo: form.assignedTo || 'Unassigned'
      };

      if (editingLeadId) {
        await axios.put(`${API_BASE_URL}/api/leads/${editingLeadId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/leads`, payload);
      }
      await fetchLeadsAndEmployees();
      resetForm();
    } catch (error) {
      console.error('Save failed', error);
      const message = (!error?.response && (error?.message || '').toLowerCase().includes('network'))
        ? `Cannot connect to backend at ${API_BASE_URL}. Please start backend server.`
        : error?.response?.data?.error
        || error?.response?.data?.message
        || 'Save failed';
      alert(message);
    }
  };

  const deleteLead = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/leads/${id}`);
      await fetchLeadsAndEmployees();
    } catch (error) {
      console.error('Delete failed', error);
      alert('Delete failed. Check backend route.');
    }
  };

  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const isTiny = viewportWidth <= 380;
  const pageStyle = { padding: isMobile ? '8px' : '12px' };
  const analyticsHeaderStyle = isMobile ? { ...s.analyticsHeader, flexDirection: 'column', alignItems: 'stretch' } : s.analyticsHeader;
  const analyticsActionsStyle = isMobile ? { ...s.analyticsActions, width: '100%', justifyContent: 'space-between' } : s.analyticsActions;
  const filtersGridStyle = isMobile
    ? { ...s.filtersGrid, gridTemplateColumns: '1fr', minWidth: 0 }
    : isTablet
      ? { ...s.filtersGrid, gridTemplateColumns: 'repeat(3, minmax(120px, 1fr)) minmax(100px, auto)', minWidth: 0 }
      : s.filtersGrid;
  const registerHeadStyle = isMobile ? { ...s.registerHead, flexDirection: 'column', alignItems: 'stretch' } : s.registerHead;
  const registerActionsStyle = isMobile ? { ...s.registerActions, width: '100%', justifyContent: 'space-between' } : s.registerActions;
  const registerToolbarStyle = isMobile ? { ...s.registerToolbar, flexDirection: 'column', alignItems: 'stretch' } : s.registerToolbar;
  const toolbarLeftStyle = isMobile ? { ...s.toolbarLeft, flexWrap: 'wrap' } : s.toolbarLeft;
  const tableStyle = isMobile ? { ...s.table, minWidth: '760px' } : s.table;
  const viewGridStyle = isMobile ? { ...s.viewGrid, gridTemplateColumns: '1fr' } : s.viewGrid;
  const followupGridStyle = isMobile ? { ...s.followupGrid, gridTemplateColumns: '1fr' } : s.followupGrid;
  const leadModalStyle = isMobile ? { ...s.cn, width: '100%', maxWidth: '100%' } : s.cn;
  const leadModalHeadStyle = isMobile ? { ...s.hd, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } : s.hd;
  const leadModalBodyStyle = isMobile ? { ...s.body, padding: '14px' } : s.body;
  const leadGridStyle = isTablet || isMobile ? { ...s.gd, gridTemplateColumns: '1fr' } : s.gd;
  const leadFieldHalfStyle = isTablet || isMobile ? { ...s.fieldHalf, gridColumn: '1 / -1' } : s.fieldHalf;
  const leadFieldWideStyle = isTablet || isMobile ? { ...s.fieldWide, gridColumn: '1 / -1' } : s.fieldWide;
  const mapsRowStyle = isTablet || isMobile ? { ...s.mapsRow, flexDirection: 'column' } : s.mapsRow;
  const analyticsTitleStyle = isTiny ? { ...s.analyticsTitle, fontSize: '20px' } : s.analyticsTitle;
  const registerTitleStyle = isTiny ? { ...s.registerTitle, fontSize: '16px' } : s.registerTitle;
  const buttonPrimaryStyle = isTiny ? { ...s.buttonPrimary, fontSize: '11px', padding: '7px 9px' } : s.buttonPrimary;
  const buttonGhostStyle = isTiny ? { ...s.buttonGhost, width: '42px', height: '42px' } : s.buttonGhost;
  const customizeButtonStyle = isTiny ? { ...s.customizeButton, padding: '6px 8px', fontSize: '10px' } : s.customizeButton;
  const leadModalCompactBodyStyle = isTiny ? { ...leadModalBodyStyle, padding: '10px' } : leadModalBodyStyle;
  const tableStyleTiny = isMobile ? { ...tableStyle, minWidth: isTiny ? '700px' : tableStyle.minWidth } : tableStyle;
  const filterActionFieldStyle = isMobile || isTablet
    ? { ...s.filterField, justifyContent: 'flex-end', alignItems: 'stretch', gridColumn: 'auto' }
    : { ...s.filterField, justifyContent: 'flex-end', alignItems: 'flex-end', gridColumn: '7 / 8' };
  const filterActionsStyle = isMobile ? { ...s.filterActions, justifyContent: 'stretch', width: '100%' } : s.filterActions;
  const applyButtonStyle = isMobile ? { ...s.applyButton, flex: 1 } : s.applyButton;

  return (
    <div style={pageStyle}>
      <div style={s.analyticsWrap}>
        <div style={analyticsHeaderStyle}>
          <div style={s.analyticsTitleWrap}>
            <h3 style={analyticsTitleStyle}>Lead Master Overview Summary</h3>
            <p style={s.analyticsSub}>Year-wise, month-wise, pest issue-wise, source-wise, status-wise, and assigned-wise lead analytics.</p>
          </div>
          <div style={analyticsActionsStyle}>
            <button type="button" style={s.analyticsBtn} onClick={refreshLeadData}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button type="button" style={{ ...s.analyticsBtn, ...s.analyticsBtnPrimary }} onClick={exportData}>
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        <div style={s.metricsGrid}>
          <div style={s.metricCard}>
            <p style={s.metricLabel}>Total Leads</p>
            <p style={s.metricValue}>{leadOverviewSummary.totalLeads}</p>
            <p style={s.metricSub}>Records matching current filters</p>
          </div>
          <div style={s.metricCard}>
            <p style={s.metricLabel}>New Leads</p>
            <p style={s.metricValue}>{leadOverviewSummary.newLeads}</p>
            <p style={s.metricSub}>Fresh opportunities in queue</p>
          </div>
          <div style={s.metricCard}>
            <p style={s.metricLabel}>Converted</p>
            <p style={s.metricValue}>{leadOverviewSummary.convertedLeads}</p>
            <p style={s.metricSub}>Leads moved to successful closure</p>
          </div>
          <div style={s.metricCard}>
            <p style={s.metricLabel}>Conversion Rate</p>
            <p style={s.metricValue}>{`${leadOverviewSummary.conversionRate.toFixed(1)}%`}</p>
            <p style={s.metricSub}>Converted / Total</p>
          </div>
          <div style={s.metricCard}>
            <p style={s.metricLabel}>Followups Planned</p>
            <p style={s.metricValue}>{leadOverviewSummary.followupLeads}</p>
            <p style={s.metricSub}>Leads with followup date</p>
          </div>
          <div style={s.metricCard}>
            <p style={s.metricLabel}>Unassigned Leads</p>
            <p style={s.metricValue}>{leadOverviewSummary.unassignedLeads}</p>
            <p style={s.metricSub}>Needs sales owner allocation</p>
          </div>
        </div>

        <div style={s.filtersPanel}>
          <div style={filtersGridStyle}>
            <div style={s.filterField}>
              <label style={s.filterLabel}>Year</label>
              <select
                value={overviewDraftFilters.year}
                style={s.filterSelect}
                onChange={(event) => setOverviewDraftFilters((prev) => ({ ...prev, year: event.target.value }))}
              >
                <option value={ALL_FILTER_VALUE}>All Years</option>
                {yearFilterOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div style={s.filterField}>
              <label style={s.filterLabel}>Month</label>
              <select
                value={overviewDraftFilters.month}
                style={s.filterSelect}
                onChange={(event) => setOverviewDraftFilters((prev) => ({ ...prev, month: event.target.value }))}
              >
                <option value={ALL_FILTER_VALUE}>All Months</option>
                {MONTH_FILTER_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
            <div style={s.filterField}>
              <label style={s.filterLabel}>Pest Issue</label>
              <select
                value={overviewDraftFilters.pestIssue}
                style={s.filterSelect}
                onChange={(event) => setOverviewDraftFilters((prev) => ({ ...prev, pestIssue: event.target.value }))}
              >
                <option value={ALL_FILTER_VALUE}>All Pest Issues</option>
                {pestIssueFilterOptions.map((issue) => (
                  <option key={issue} value={issue}>{issue}</option>
                ))}
              </select>
            </div>
            <div style={s.filterField}>
              <label style={s.filterLabel}>Lead Source</label>
              <select
                value={overviewDraftFilters.leadSource}
                style={s.filterSelect}
                onChange={(event) => setOverviewDraftFilters((prev) => ({ ...prev, leadSource: event.target.value }))}
              >
                <option value={ALL_FILTER_VALUE}>All Sources</option>
                {leadSourceFilterOptions.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
            <div style={s.filterField}>
              <label style={s.filterLabel}>Status</label>
              <select
                value={overviewDraftFilters.status}
                style={s.filterSelect}
                onChange={(event) => setOverviewDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value={ALL_FILTER_VALUE}>All Statuses</option>
                {statusFilterOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div style={s.filterField}>
              <label style={s.filterLabel}>Assigned To</label>
              <select
                value={overviewDraftFilters.assignedTo}
                style={s.filterSelect}
                onChange={(event) => setOverviewDraftFilters((prev) => ({ ...prev, assignedTo: event.target.value }))}
              >
                <option value={ALL_FILTER_VALUE}>All Assignees</option>
                {assignedToFilterOptions.map((assignedTo) => (
                  <option key={assignedTo} value={assignedTo}>{assignedTo}</option>
                ))}
              </select>
            </div>
            <div style={filterActionFieldStyle}>
              <label style={{ ...s.filterLabel, visibility: 'hidden', margin: 0, height: 0 }}>Actions</label>
              <div style={filterActionsStyle}>
                <button type="button" style={applyButtonStyle} onClick={applyOverviewFilters}>Apply</button>
                <button type="button" style={s.clearButton} onClick={clearOverviewFilters} title="Clear filters">×</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={s.registerCard}>
        <div style={registerHeadStyle}>
          <div style={s.registerTitleWrap}>
            <h2 style={registerTitleStyle}>Lead Master</h2>
            <ChevronDown size={16} color="var(--color-primary)" />
          </div>
          <div style={registerActionsStyle}>
            <button type="button" style={buttonPrimaryStyle} onClick={openLeadModal}>
              <Plus size={16} />
              New Lead
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
                <div ref={moreMenuRef} style={s.menu}>
                  <button type="button" style={s.menuButton} onClick={openEditSelectedLead}>
                    Edit Lead
                  </button>
                  <button type="button" style={s.menuButton} onClick={deleteSelectedLeads}>
                    Delete
                  </button>
                  <button type="button" style={s.menuButton} onClick={() => importFileRef.current?.click()}>
                    Import Data
                  </button>
                  <button type="button" style={s.menuButton} onClick={exportData}>
                    Export Data
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={importDataFromFile}
        />

        <div style={registerToolbarStyle}>
          <div style={toolbarLeftStyle}>
            <span style={s.toolLabel}>Lead Master</span>
            <span style={s.toolbarMeta}>{`${filteredLeads.length} records shown`}</span>
          </div>
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
              <div ref={customizePanelRef} style={s.popover}>
                <div style={s.popoverHeader}>Show/Hide Columns</div>
                <div style={s.popoverBody}>
                  {leadColumns.map((column) => (
                    <label key={column.key} style={s.popoverItem}>
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

        <div style={s.tableWrap}>
          <table style={tableStyleTiny}>
            <thead>
              <tr>
                <th style={{ ...s.headCell, ...s.checkboxWrap }}>
                  <input type="checkbox" style={s.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
                </th>
                {visibleColumnDefs.map((column) => (
                  <th key={column.key} style={{ ...s.headCell, ...s.headCellResizable, ...getColumnStyle(column.key) }}>
                    <span style={s.headLabelWrap}>{column.label}</span>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      title="Drag to resize"
                      style={s.resizeHandle}
                      onMouseDown={(event) => startColumnResize(event, column.key)}
                    />
                  </th>
                ))}
                <th style={{ ...s.headCell, ...s.headActionCell, width: '82px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnDefs.length + 2} style={{ ...s.cell, textAlign: 'center', color: '#64748b', padding: '24px' }}>
                    No active leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead._id} style={s.row}>
                    <td style={{ ...s.cell, ...s.checkboxWrap }}>
                      <input
                        type="checkbox"
                        style={s.checkbox}
                        checked={selectedLeadIds.includes(lead._id)}
                        onChange={() => toggleSelectLead(lead._id)}
                      />
                    </td>
                    {visibleColumnDefs.map((column) => {
                      const value = getLeadColumnValue(lead, column.key);
                      if (column.key === 'status') {
                        const statusTone = getLeadStatusBadgeStyle(value);
                        const convertedLead = isLeadConverted(lead);
                        return (
                          <td key={`${lead._id}-${column.key}`} style={{ ...s.cell, ...getColumnStyle(column.key) }}>
                            <div data-lead-status-editor="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {statusEditorLeadId === lead._id && !convertedLead ? (
                                <select
                                  autoFocus
                                  value={statusDraftValue}
                                  style={s.statusInlineSelect}
                                  disabled={statusSavingLeadId === lead._id}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    setStatusDraftValue(next);
                                    updateLeadStatusInline(lead, next);
                                  }}
                                  onBlur={() => {
                                    if (statusSavingLeadId === lead._id) return;
                                    closeStatusEditor();
                                  }}
                                >
                                  {LEAD_STATUSES.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  style={{ ...s.statusBadgeButton, ...statusTone, cursor: convertedLead ? 'not-allowed' : 'pointer', opacity: convertedLead ? 0.9 : 1 }}
                                  onClick={() => openStatusEditor(lead)}
                                  title={convertedLead ? 'Converted lead status is locked' : 'Click to change lead status'}
                                >
                                  <span>{String(value || '').trim() || 'New Lead'}</span>
                                  {convertedLead ? null : <ChevronDown size={10} />}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={`${lead._id}-${column.key}`}
                          style={{ ...s.cell, ...getColumnStyle(column.key), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={String(value || '')}
                        >
                          {value || '-'}
                        </td>
                      );
                    })}
                    <td style={{ ...s.cell, ...s.actionCell, width: '82px', textAlign: 'center' }}>
                      <div style={s.rowActionWrap} data-lead-row-action="true">
                        <button
                          type="button"
                          style={s.rowActionButton}
                          onClick={(event) => openRowActionMenu(event, lead._id)}
                          title="Manage lead"
                        >
                          <span>Action</span>
                          <ChevronDown size={11} />
                        </button>
                        {rowActionLeadId === lead._id && rowActionMenuPosition
                          ? createPortal(
                            <div
                              style={{
                                ...s.rowActionMenu,
                                left: `${rowActionMenuPosition.left}px`,
                                top: `${rowActionMenuPosition.top}px`
                              }}
                              data-lead-row-action="true"
                            >
                              <button
                                type="button"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  openViewLeadPanel(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                View Lead
                              </button>
                              <button
                                type="button"
                                style={isLeadConverted(lead) ? s.rowActionMenuBtnDisabled : s.rowActionMenuBtn}
                                onClick={() => {
                                  if (isLeadConverted(lead)) return;
                                  openEditLeadModal(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Edit Lead
                              </button>
                              <button
                                type="button"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  openLogFollowupModal(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Log Follow-up
                              </button>
                              <button
                                type="button"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  openQuotationForLead(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Create Quotation
                              </button>
                              <button
                                type="button"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  sendWelcomeMessageToLead(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Send Welcome Message
                              </button>
                              <button
                                type="button"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  convertToContract(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Convert to Contract
                              </button>
                              <button
                                type="button"
                                style={{ ...s.rowActionMenuBtn, color: '#dc2626' }}
                                onClick={() => {
                                  deleteLead(lead._id);
                                  closeRowActionMenu();
                                }}
                              >
                                Delete Lead
                              </button>
                            </div>,
                            document.body
                          )
                          : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewedLead ? (
        <>
          <div style={s.viewDrawerOverlay} onClick={closeViewLeadPanel} />
          <aside style={s.viewDrawer} data-lead-view-drawer="true">
            <div style={s.viewDrawerHead}>
              <h3 style={s.viewDrawerTitle}>View Lead</h3>
              <X size={20} style={{ cursor: 'pointer', color: '#64748b' }} onClick={closeViewLeadPanel} />
            </div>
            <div style={s.viewDrawerBody}>
              <div style={s.viewCard}>
                <p style={s.viewCardTitle}>Lead Summary</p>
                <div style={viewGridStyle}>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Customer</span>
                    <span style={s.viewItemValue}>{viewedLead.customerName || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Mobile</span>
                    <span style={s.viewItemValue}>{normalizePhoneNumber(getLeadMobile(viewedLead)) || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Status</span>
                    <span style={s.viewItemValue}>{getLeadStatus(viewedLead) || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Followup Date</span>
                    <span style={s.viewItemValue}>{formatDisplayDate(viewedLead.followupDate) || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Lead Source</span>
                    <span style={s.viewItemValue}>{viewedLead.leadSource || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Assigned To</span>
                    <span style={s.viewItemValue}>{getLeadAssignedTo(viewedLead)}</span>
                  </div>
                </div>
              </div>
              <div style={s.viewCard}>
                <p style={s.viewCardTitle}>Location</p>
                <div style={viewGridStyle}>
                  <div style={{ ...s.viewItem, gridColumn: 'span 2' }}>
                    <span style={s.viewItemLabel}>Address</span>
                    <span style={s.viewItemValue}>{viewedLead.address || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Area</span>
                    <span style={s.viewItemValue}>{viewedLead.areaName || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>City</span>
                    <span style={s.viewItemValue}>{viewedLead.city || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>State</span>
                    <span style={s.viewItemValue}>{viewedLead.state || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Pincode</span>
                    <span style={s.viewItemValue}>{viewedLead.pincode || viewedLead.pinCode || '-'}</span>
                  </div>
                </div>
              </div>
              <div style={s.viewCard}>
                <p style={s.viewCardTitle}>Additional</p>
                <div style={viewGridStyle}>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Pest Issue</span>
                    <span style={s.viewItemValue}>{viewedLead.pestIssue || '-'}</span>
                  </div>
                  <div style={s.viewItem}>
                    <span style={s.viewItemLabel}>Property Type</span>
                    <span style={s.viewItemValue}>{viewedLead.propertyType || viewedLead.customerSegment || '-'}</span>
                  </div>
                  <div style={{ ...s.viewItem, gridColumn: 'span 2' }}>
                    <span style={s.viewItemLabel}>Remarks</span>
                    <span style={s.viewItemValue}>{viewedLead.remarks || viewedLead.notes || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {followupLead ? (
        <div style={s.followupOverlay}>
          <div style={s.followupModal}>
            <div style={s.followupHead}>
              <h3 style={s.followupTitle}><PhoneCall size={22} /> Log Follow-up</h3>
              <X size={22} style={{ cursor: 'pointer', color: '#64748b' }} onClick={closeLogFollowupModal} />
            </div>
            <div style={s.followupBody}>
              <div style={s.followupLeadBadge}>
                {(followupLead.customerName || 'Lead')} ({normalizePhoneNumber(getLeadMobile(followupLead)) || 'No Mobile'})
              </div>
              <div style={followupGridStyle}>
                <div>
                  <label style={s.lb}>Follow-up Type</label>
                  <select value={followupForm.type} style={s.in} onChange={(event) => setFollowupForm((prev) => ({ ...prev, type: event.target.value }))}>
                    {FOLLOWUP_TYPES.map((entry) => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.lb}>Outcome</label>
                  <select value={followupForm.outcome} style={s.in} onChange={(event) => setFollowupForm((prev) => ({ ...prev, outcome: event.target.value }))}>
                    {FOLLOWUP_OUTCOMES.map((entry) => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.lb}>Next Follow-up Date</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      value={followupForm.nextFollowupDate}
                      style={s.in}
                      onChange={(event) => setFollowupForm((prev) => ({ ...prev, nextFollowupDate: event.target.value }))}
                    />
                    <CalendarDays size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={s.lb}>Followed Up By</label>
                  <select value={followupForm.followedUpBy} style={s.in} onChange={(event) => setFollowupForm((prev) => ({ ...prev, followedUpBy: event.target.value }))}>
                    <option value="">-- Select --</option>
                    {salesEmployees.map((employee) => (
                      <option key={employee._id} value={formatEmployeeName(employee)}>
                        {formatEmployeeName(employee)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={s.lb}>Notes</label>
                  <textarea
                    value={followupForm.notes}
                    style={s.ta}
                    placeholder="Key discussion points..."
                    onChange={(event) => setFollowupForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div style={s.followupActions}>
              <button type="button" style={s.followupCancelBtn} onClick={closeLogFollowupModal}>Cancel</button>
              <button type="button" style={s.followupSaveBtn} onClick={saveLogFollowup} disabled={isSavingFollowup}>
                {isSavingFollowup ? 'Saving...' : 'Save Follow-up'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {show && (
        <div style={s.ov}>
          <form style={leadModalStyle} onSubmit={save}>
            <div style={leadModalHeadStyle}>
              <span>{editingLeadId ? 'Edit Lead Form' : 'Lead Entry Form'}</span>
              <X onClick={resetForm} style={{ cursor: 'pointer' }} />
            </div>

            <div style={leadModalCompactBodyStyle}>
              <div style={s.section}>
                <div style={s.sectionTitle}><User size={14} /> Customer Details</div>
                <div style={leadGridStyle}>
                  <div>
                    <label style={s.lb}>Customer Option</label>
                    <select value={form.customerOption} style={s.in} onChange={(e) => handleCustomerOptionChange(e.target.value)}>
                      <option>New Customer</option>
                      <option>Existing Customer</option>
                    </select>
                  </div>

                  {form.customerOption === 'Existing Customer' && (
                    <div style={leadFieldHalfStyle}>
                      <label style={s.lb}>Select Existing Customer</label>
                      <select value={form.existingCustomerId} style={s.in} onChange={(e) => handleExistingCustomerChange(e.target.value)}>
                        <option value="">Select Customer</option>
                        {existingCustomers.map((lead) => {
                          const value = `${lead.customerName || ''}-${getLeadMobile(lead)}`;
                          return (
                            <option key={value} value={value}>
                              {lead.customerName} {getLeadMobile(lead) ? `- ${getLeadMobile(lead)}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={s.lb}>Customer Name</label>
                    <input value={form.customerName} style={s.in} onChange={(e) => updateForm('customerName', e.target.value)} required />
                  </div>
                  <div>
                    <label style={s.lb}>Mobile</label>
                    <input
                      value={form.mobile}
                      style={s.in}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                      pattern="\d{10}"
                      placeholder="10 digit mobile number"
                      required
                    />
                  </div>
                  <div>
                    <div style={s.inlineLabelRow}>
                      <label style={{ ...s.lb, marginBottom: 0 }}>Whatsapp Number</label>
                      <label style={{ ...s.smallToggle, opacity: form.mobile.trim() ? 1 : 0.45, cursor: form.mobile.trim() ? 'pointer' : 'not-allowed' }}>
                        <input
                          type="checkbox"
                          checked={sameAsMobile}
                          onChange={(e) => handleSameAsMobileToggle(e.target.checked)}
                          disabled={!form.mobile.trim()}
                          style={{ margin: 0 }}
                        />
                        Tick same as mobile number
                      </label>
                    </div>
                    <input
                      value={form.whatsappNumber}
                      style={{ ...s.in, opacity: sameAsMobile ? 0.9 : 1 }}
                      onChange={(e) => handleWhatsappChange(e.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                      pattern="\d{10}"
                      placeholder="10 digit WhatsApp number"
                      disabled={sameAsMobile}
                    />
                  </div>
                  <div>
                    <label style={s.lb}>Email Id</label>
                    <input type="email" value={form.emailId} style={s.in} onChange={(e) => updateForm('emailId', e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={s.section}>
                <div style={s.sectionTitle}><MapPin size={14} /> Property Details</div>
                <div style={leadGridStyle}>
                  <div style={leadFieldWideStyle}>
                    <label style={s.lb}>Search Address</label>
                    <div style={mapsRowStyle}>
                      <input
                        ref={searchAddressInputRef}
                        value={form.searchAddress}
                        style={{ ...s.in, marginBottom: 0, flex: 1 }}
                        onChange={(e) => {
                          setSearchError('');
                          updateForm('searchAddress', e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          fetchAddressFromGoogleMaps();
                        }}
                        placeholder="Search company, shop, office, area, or address"
                      />
                      <button type="button" onClick={fetchAddressFromGoogleMaps} style={s.mapsButton} disabled={isFetchingAddress}>
                        <Search size={14} /> {isFetchingAddress ? 'Fetching...' : 'Search Maps'}
                      </button>
                    </div>
                    {searchError ? (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>
                        {searchError}
                      </div>
                    ) : null}
                  </div>

                  <div style={leadFieldWideStyle}>
                    <label style={s.lb}>Address</label>
                    <textarea value={form.address} style={s.ta} onChange={(e) => updateForm('address', e.target.value)} required />
                  </div>
                  <div>
                    <label style={s.lb}>Area Name</label>
                    <input value={form.areaName} style={s.in} onChange={(e) => updateForm('areaName', e.target.value)} />
                  </div>
                  <div>
                    <label style={s.lb}>City</label>
                    <input
                      value={form.city}
                      style={s.in}
                      onChange={(e) => updateForm('city', e.target.value)}
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label style={s.lb}>State</label>
                    <select value={form.state} style={s.in} onChange={(e) => updateForm('state', e.target.value)}>
                      <option value="">Select State</option>
                      {INDIA_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={s.lb}>Pincode</label>
                    <input value={form.pincode} style={s.in} onChange={(e) => updateForm('pincode', e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={s.section}>
                <div style={s.sectionTitle}><ClipboardList size={14} /> Lead Details</div>
                <div style={leadGridStyle}>
                  <div className="field">
                    <label style={s.lb}>Pest Issue</label>
                    <select value={form.pestIssue} style={s.in} onChange={(e) => updateForm('pestIssue', e.target.value)} required>
                      <option value="">Select Pest Issue</option>
                      {PEST_ISSUES.map((issue) => (
                        <option key={issue} value={issue}>{issue}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={s.lb}>Lead Source</label>
                    <select value={form.leadSource} style={s.in} onChange={(e) => handleLeadSourceChange(e.target.value)}>
                      {LEAD_SOURCES.map((source) => <option key={source}>{source}</option>)}
                    </select>
                  </div>
                  {form.leadSource === 'Reference' ? (
                    <div>
                      <label style={s.lb}>Reference Customer</label>
                      <button
                        type="button"
                        style={{ ...s.smallButton, width: '100%', padding: '10px 12px', textAlign: 'left' }}
                        onClick={() => setShowReferencePicker((current) => !current)}
                      >
                        {showReferencePicker ? 'Close Customer Picker' : 'Open Customer Picker'}
                      </button>
                      <div style={s.referenceHint}>Link this lead to an existing customer from Customer module.</div>
                    </div>
                  ) : null}

                  {form.leadSource === 'Reference' && showReferencePicker ? (
                    <div style={leadFieldHalfStyle}>
                      <label style={s.lb}>Select Existing Customer</label>
                      <select
                        value={form.referenceCustomerId}
                        style={s.in}
                        onChange={(e) => handleReferenceCustomerSelect(e.target.value)}
                      >
                        <option value="">Select Customer</option>
                        {referenceCustomers.map((customer) => (
                          <option key={customer._id} value={customer._id}>
                            {getCustomerName(customer)} {getCustomerMobile(customer) ? `- ${getCustomerMobile(customer)}` : ''}
                          </option>
                        ))}
                      </select>
                      {form.referenceCustomerName ? (
                        <div style={s.referenceBadge}>
                          <div><strong>Referred By:</strong> {form.referenceCustomerName}</div>
                          <div><strong>Customer Since:</strong> {form.referenceCustomerDate || 'N/A'}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <label style={s.lb}>Property Type</label>
                    <select value={form.propertyType} style={s.in} onChange={(e) => updateForm('propertyType', e.target.value)}>
                      {PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.lb}>Lead Status</label>
                    <select value={form.status} style={s.in} onChange={(e) => updateForm('status', e.target.value)}>
                      {LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.lb}>Followup Date</label>
                    <input type="date" value={form.followupDate} style={s.in} onChange={(e) => updateForm('followupDate', e.target.value)} />
                  </div>
                  <div>
                    <label style={s.lb}>Assigned To Sales Team</label>
                    <select value={form.assignedTo} style={s.in} onChange={(e) => updateForm('assignedTo', e.target.value)}>
                      <option value="">Select Sales Person</option>
                      {salesEmployees.map((employee) => (
                        <option key={employee._id} value={formatEmployeeName(employee)}>
                          {formatEmployeeName(employee)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={leadFieldWideStyle}>
                    <label style={s.lb}>Remarks</label>
                    <textarea value={form.remarks} style={s.ta} onChange={(e) => updateForm('remarks', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '15px 20px', textAlign: 'right', background: '#fff', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" onClick={resetForm} style={{ marginRight: '10px', padding: '10px 16px', border: '1px solid rgba(17,17,17,0.1)', borderRadius: '12px', cursor: 'pointer', background: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
                Cancel
              </button>
              <button type="submit" style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {editingLeadId ? 'Update' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
