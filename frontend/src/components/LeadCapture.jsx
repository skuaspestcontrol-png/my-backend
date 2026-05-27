import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  attachPlacesAutocomplete,
  hasGoogleMapsApiKey,
  loadGooglePlacesScript,
  formatGoogleAddressParts,
  getGoogleFormattedAddressText
} from '../utils/googlePlaces';
import {
  extractGoogleMapsCoordinates,
  isAllowedGoogleMapsUrl,
  isGoogleMapsShortLink,
  resolveGoogleMapsUrl
} from '../utils/googleMaps';
import useColumnResize from './table/useColumnResize';
import { pestIssueLabel, pestIssueShort } from '../utils/pestIssueCodes';
import { PHONE_VALIDATION_ERROR, normalizeIndianMobileNumber } from '../utils/phone';
import { getPortalUserName } from '../utils/portalAuth';
import useAutoRefresh from '../hooks/useAutoRefresh';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  MoreHorizontal,
  PhoneCall,
  Plus,
  Search,
  Settings,
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
const LEAD_STATUSES = ['Cold', 'Warm', 'Hot', 'Booked', 'Decline'];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ALL_FILTER_VALUE = '__all__';
const LEAD_PAGE_SIZE = 20;
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
  { key: 'quotationValue', label: 'Quotation Value' },
  { key: 'followupDate', label: 'Followup Date' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'referenceCustomerName', label: 'Reference Customer' },
  { key: 'referenceCustomerDate', label: 'Reference Customer Date' },
  { key: 'remarks', label: 'Remarks' }
];
const legacyDefaultVisibleLeadColumns = ['date', 'customerName', 'mobile', 'pestIssue', 'leadSource', 'status', 'quotationValue', 'assignedTo', 'followupDate', 'city', 'state'];
const defaultVisibleLeadColumns = ['date', 'customerName', 'mobile', 'pestIssue', 'leadSource', 'status', 'followupDate', 'assignedTo'];
const defaultOverviewFilters = {
  year: ALL_FILTER_VALUE,
  month: ALL_FILTER_VALUE,
  pestIssue: ALL_FILTER_VALUE,
  leadSource: ALL_FILTER_VALUE,
  status: ALL_FILTER_VALUE,
  assignedTo: ALL_FILTER_VALUE
};

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
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
  pinCode: '',
  postalCode: '',
  postal_code: '',
  zip: '',
  latitude: '',
  longitude: '',
  googlePlaceId: '',
  googlePlaceName: '',
  googlePhone: '',
  googleWebsite: '',
  pestIssue: '',
  quotationValue: '',
  leadSource: 'Call',
  propertyType: 'Residential',
  status: 'Cold',
  followupDate: '',
  assignedTo: '',
  remarks: '',
  referenceCustomerId: '',
  referenceCustomerName: '',
  referenceCustomerDate: ''
};

const s = {
  ov: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto', backdropFilter: 'blur(12px)' },
  cn: { background: 'rgba(255,255,255,0.96)', width: '96%', maxWidth: '1040px', borderRadius: '16px', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)' },
  hd: { minHeight: '64px', background: 'var(--color-primary)', padding: '16px 22px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '24px', lineHeight: 1.2, fontWeight: 800, letterSpacing: 0, borderBottom: '1px solid var(--brand-border-color)' },
  body: { padding: '20px 24px', overflowY: 'auto', background: '#fff' },
  section: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', marginBottom: '14px', boxShadow: 'var(--shadow-soft)' },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' },
  gd: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 18px' },
  fieldWide: { gridColumn: 'span 2' },
  fieldHalf: { gridColumn: 'span 2' },
  in: { width: '100%', minHeight: '40px', padding: '0 12px', borderRadius: '11px', fontSize: '14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.96)', outline: 'none' },
  ta: { width: '100%', padding: '10px 12px', borderRadius: '11px', fontSize: '14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.96)', minHeight: '80px', resize: 'vertical', outline: 'none' },
  lb: { display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-muted)', letterSpacing: '0.02em', textTransform: 'uppercase' },
  actionBox: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', border: '1px solid var(--color-border)', transition: 'all 0.2s', background: 'rgba(255,255,255,0.78)' },
  smallButton: {
    border: '1px solid var(--color-border)',
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
  mapsButton: { minWidth: '136px', minHeight: '40px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.02em', fontSize: '14px' },
  referenceHint: { marginTop: '6px', fontSize: '11px', color: '#64748b' },
  referenceBadge: { marginTop: '8px', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(159,23,77,0.2)', background: 'rgba(252,231,243,0.55)', fontSize: '12px', color: '#1e293b', lineHeight: 1.5 },
  analyticsWrap: { background: 'rgba(255,255,255,0.82)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '12px', marginBottom: '10px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)', display: 'grid', gap: '10px' },
  analyticsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  analyticsTitleWrap: { display: 'grid', gap: '2px' },
  analyticsTitle: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111111' },
  analyticsSub: { margin: 0, color: '#64748b', fontSize: '12px', fontWeight: 600 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  metricCard: { border: '1px solid rgba(17,17,17,0.08)', borderRadius: '10px', background: '#fff', padding: '8px 10px', display: 'grid', gap: '4px' },
  metricLabel: { margin: 0, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 },
  metricValue: { margin: 0, color: '#111111', fontSize: '24px', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em' },
  metricSub: { margin: 0, color: '#7c8797', fontSize: '10px', fontWeight: 700 },
  filtersPanel: { border: '1px solid var(--color-border)', borderRadius: '10px', background: 'rgba(255,255,255,0.95)', padding: '10px', display: 'grid', gap: '8px', overflowX: 'auto' },
  filtersGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr)) minmax(100px, auto)', gap: '8px', alignItems: 'end', minWidth: '920px' },
  filterField: { display: 'grid', gap: '4px', minWidth: 0 },
  filterLabel: { fontSize: '10px', color: '#4b5563', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  filterSelect: { width: '100%', minWidth: 0, minHeight: '34px', border: '1px solid var(--color-border)', background: '#fff', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#334155', outline: 'none', boxSizing: 'border-box' },
  filterActions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' },
  applyButton: { border: '1px solid rgba(159, 23, 77, 0.34)', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', padding: '0 12px', minHeight: '34px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  clearButton: { border: '1px solid var(--color-border)', background: '#fff', color: '#334155', borderRadius: '8px', minWidth: '34px', minHeight: '34px', fontSize: '16px', lineHeight: 1, cursor: 'pointer' },
  registerCard: { background: '#fff', borderRadius: '16px', border: '1px solid var(--color-border)', overflow: 'visible', boxShadow: 'var(--shadow-sm)', backdropFilter: 'none', backgroundClip: 'padding-box' },
  registerHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid var(--brand-border-color)', background: '#fff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', backgroundClip: 'padding-box' },
  registerTitleWrap: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '8px', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-soft)' },
  registerTitle: { margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937' },
  registerActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '8px', padding: '7px 10px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '12px' },
  buttonGhost: { border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', borderRadius: '10px', width: '46px', height: '46px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  menu: { position: 'absolute', right: 0, top: '44px', background: '#fff', border: '1px solid var(--brand-border-color)', borderRadius: '10px', minWidth: '170px', boxShadow: '0 14px 32px rgba(15,23,42,0.12)', zIndex: 35, overflow: 'hidden' },
  menuButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  registerToolbar: { padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: '#fff' },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'nowrap', whiteSpace: 'nowrap' },
  toolLabel: { fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  toolbarMeta: { fontSize: '11px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' },
  customizeButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-primary-soft)', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '9px', width: '32px', height: '32px', padding: 0, fontSize: '11px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)' },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--brand-border-color)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', width: '260px', zIndex: 45 },
  popoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  tableWrap: { overflowX: 'hidden', overflowY: 'hidden', background: '#fff', position: 'relative', borderTop: '1px solid var(--color-border)', backgroundClip: 'padding-box' },
  table: { width: '100%', minWidth: 0, borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', tableLayout: 'fixed' },
  headCell: { textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#6b7280', padding: '5px 6px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  headCellResizable: { position: 'relative', paddingRight: '16px' },
  headLabelWrap: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headLabelWithSort: { display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0, maxWidth: '100%' },
  dateSortButton: { width: '18px', height: '18px', border: '1px solid rgba(107,114,128,0.28)', borderRadius: '6px', background: '#fff', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flexShrink: 0 },
  headActionCell: { background: 'var(--color-primary-light)' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '7px 6px', fontSize: '10px', fontWeight: 400, color: '#334155', verticalAlign: 'middle', lineHeight: 1.15 },
  actionCell: { background: '#ffffff' },
  checkboxWrap: { width: '40px', textAlign: 'center' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  statusBadge: { background: 'rgba(159, 23, 77, 0.14)', color: 'var(--color-primary-dark)', padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 500, display: 'inline-block', whiteSpace: 'nowrap' },
  statusBadgeButton: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#334155',
    padding: '0 10px',
    borderRadius: '7px',
    width: '92px',
    height: '32px',
    minWidth: '92px',
    minHeight: '32px',
    fontSize: '10px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1
  },
  statusInlineSelect: {
    width: '92px',
    height: '32px',
    minHeight: '32px',
    borderRadius: '8px',
    border: '1px solid rgba(159, 23, 77, 0.3)',
    background: '#fff',
    color: '#0f172a',
    fontSize: '10px',
    fontWeight: 400,
    padding: '0 8px',
    outline: 'none',
    minWidth: '92px',
    boxSizing: 'border-box'
  },
  rowActionWrap: { position: 'relative', display: 'inline-flex', justifyContent: 'center', width: '100%' },
  rowActionButton: { border: '1px solid rgba(17,17,17,0.16)', background: '#fff', color: '#1f2937', borderRadius: '10px', minWidth: '86px', minHeight: '32px', padding: '0 8px 0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, lineHeight: 1, transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease' },
  rowActionIconBox: { width: '16px', height: '16px', borderRadius: '5px', border: '1px solid #d1d5db', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexShrink: 0 },
  rowActionMenu: { position: 'fixed', width: '170px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 8px 18px rgba(15,23,42,0.1)', zIndex: 1200, overflow: 'hidden' },
  rowActionMenuBtn: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', color: '#1f2937', cursor: 'pointer', padding: '6px 10px', fontSize: '11px', fontWeight: 600, lineHeight: 1.1, minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  rowActionMenuBtnDisabled: { width: '100%', textAlign: 'left', border: 'none', background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed', padding: '6px 10px', fontSize: '11px', fontWeight: 600, lineHeight: 1.1, minHeight: '30px' },
  pagination: { padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', background: '#fff', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', backgroundClip: 'padding-box' },
  paginationInfo: { color: '#64748b', fontSize: '12px', fontWeight: 700 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  paginationButton: { width: '34px', minWidth: '34px', minHeight: '32px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#334155', padding: 0, fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  paginationButtonDisabled: { opacity: 0.48, cursor: 'not-allowed' },
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
  followupModal: { width: 'min(640px, 96vw)', background: 'rgba(255,255,255,0.98)', border: '1px solid var(--color-border)', borderRadius: '16px', boxShadow: '0 24px 54px rgba(15,23,42,0.25)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  followupHead: { padding: '14px 16px', borderBottom: '1px solid var(--brand-border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-primary)' },
  followupTitle: { margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  followupBody: { padding: '14px 16px', display: 'grid', gap: '12px', background: '#ffffff', overflowY: 'auto' },
  followupLeadBadge: { border: '1px solid var(--color-border)', borderRadius: '10px', background: '#F3F4F6', padding: '10px 12px', color: '#334155', fontSize: '14px', fontWeight: 700, lineHeight: 1.35, wordBreak: 'break-word' },
  followupGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', alignItems: 'start' },
  followupField: { minWidth: 0, display: 'grid', gap: '6px' },
  followupInput: { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: '40px' },
  followupTextarea: { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: '86px' },
  followupActions: { padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--color-primary-light)' },
  followupCancelBtn: { minHeight: '42px', padding: '0 20px', borderRadius: '10px', border: '1px solid var(--color-border)', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' },
  followupSaveBtn: { minHeight: '42px', padding: '0 20px', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.35)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, cursor: 'pointer' }
};

const formatEmployeeName = (employee) => {
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  return fullName || employee.empCode || 'Unnamed';
};

const normalizePhoneNumber = normalizeIndianMobileNumber;
const normalizePincode = (value) => String(value || '').replace(/\D+/g, '').slice(0, 6);
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
  if (!raw) return 'Cold';
  if (normalized === 'new lead') return 'Cold';
  if (normalized === 'interested') return 'Warm';
  if (normalized === 'not interested' || normalized === 'not intersted') return 'Decline';
  if (normalized === 'cancalled' || normalized === 'cancelled') return 'Decline';
  if (normalized === 'converted') return 'Booked';
  if (normalized === '25%') return 'Cold';
  if (normalized === '50%') return 'Warm';
  if (normalized === '75%') return 'Hot';
  if (normalized === '100%') return 'Booked';
  return raw;
};
const getLeadStatus = (lead) => toCanonicalLeadStatus(lead.status || lead.leadStatus || 'Cold');
const normalizeLeadStatus = (value) => String(value || '').trim().toLowerCase();
const isLeadConverted = (lead) => normalizeLeadStatus(getLeadStatus(lead)) === 'booked';
const getLeadStatusBadgeStyle = (statusValue) => {
  const normalized = normalizeLeadStatus(statusValue);
  if (normalized === 'booked' || normalized === 'converted') {
    return { background: '#14532d', color: '#ffffff', borderColor: '#14532d' };
  }
  if (normalized === 'decline' || normalized === 'cancalled' || normalized === 'cancelled' || normalized === 'not interested' || normalized === 'not intersted') {
    return { background: '#b91c1c', color: '#ffffff', borderColor: '#b91c1c' };
  }
  return { background: '#ffffff', color: '#334155', borderColor: '#d1d5db' };
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
const ROW_ACTION_MENU_APPROX_WIDTH = 170;
const ROW_ACTION_MENU_APPROX_HEIGHT = 190;
const ROW_ACTION_MENU_GAP = 4;
const FOLLOWUP_TYPES = ['Phone Call', 'WhatsApp', 'Site Visit', 'Email', 'Meeting'];
const FOLLOWUP_OUTCOMES = ['Callback Required', 'Interested', 'Not Interested', 'Converted', 'No Response'];
const mobileLeadColumnWidths = {
  date: 112,
  customerName: 148,
  mobile: 108,
  whatsappNumber: 118,
  emailId: 156,
  address: 176,
  areaName: 120,
  city: 100,
  state: 104,
  pincode: 90,
  pestIssue: 118,
  leadSource: 90,
  propertyType: 104,
  status: 92,
  quotationValue: 108,
  followupDate: 108,
  assignedTo: 122,
  referenceCustomerName: 138,
  referenceCustomerDate: 130,
  remarks: 160
};
const desktopLeadColumnWidths = {
  date: 82,
  customerName: 136,
  mobile: 96,
  whatsappNumber: 116,
  emailId: 150,
  address: 170,
  areaName: 112,
  city: 96,
  state: 76,
  pincode: 78,
  pestIssue: 126,
  leadSource: 92,
  propertyType: 110,
  status: 100,
  quotationValue: 94,
  followupDate: 98,
  assignedTo: 118,
  referenceCustomerName: 136,
  referenceCustomerDate: 128,
  remarks: 150
};
const leadColumnResizeBounds = {
  date: { min: 72, max: 130 },
  customerName: { min: 120, max: 260 },
  mobile: { min: 88, max: 150 },
  whatsappNumber: { min: 96, max: 170 },
  emailId: { min: 120, max: 240 },
  address: { min: 150, max: 320 },
  areaName: { min: 100, max: 180 },
  city: { min: 80, max: 140 },
  state: { min: 72, max: 140 },
  pincode: { min: 72, max: 120 },
  pestIssue: { min: 120, max: 220 },
  leadSource: { min: 88, max: 160 },
  propertyType: { min: 90, max: 150 },
  status: { min: 90, max: 150 },
  quotationValue: { min: 88, max: 150 },
  followupDate: { min: 92, max: 150 },
  assignedTo: { min: 110, max: 200 },
  referenceCustomerName: { min: 130, max: 260 },
  referenceCustomerDate: { min: 120, max: 180 },
  remarks: { min: 150, max: 320 }
};

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
  const location = useLocation();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sameAsMobile, setSameAsMobile] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
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
  const [leadSortDirection, setLeadSortDirection] = useState('desc');
  const [leadPage, setLeadPage] = useState(1);
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
      const isLegacyDefault = valid.length === legacyDefaultVisibleLeadColumns.length
        && legacyDefaultVisibleLeadColumns.every((key, index) => valid[index] === key);
      if (isLegacyDefault) return defaultVisibleLeadColumns;
      return valid.length > 0 ? valid : defaultVisibleLeadColumns;
    } catch {
      return defaultVisibleLeadColumns;
    }
  });
  const {
    getColumnStyle: getResizableColumnStyle,
    resetColumns: resetLeadColumns,
    startResize: startColumnResize
  } = useColumnResize({
    storageKey: 'leads_column_widths',
    columns: leadColumns.map((column) => column.key),
    defaultColumnWidths: desktopLeadColumnWidths,
    columnBounds: leadColumnResizeBounds,
    minWidth: 72,
    enabled: viewportWidth > 900
  });

  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreMenuButtonRef = useRef(null);
  const importFileRef = useRef(null);
  const searchAddressInputRef = useRef(null);
  const suggestionSeqRef = useRef(0);

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

  const sortedLeads = useMemo(() => {
    const direction = leadSortDirection === 'asc' ? 1 : -1;
    return [...filteredLeads].sort((a, b) => {
      const aTime = getLeadDateValue(a)?.getTime() || 0;
      const bTime = getLeadDateValue(b)?.getTime() || 0;
      return (aTime - bTime) * direction;
    });
  }, [filteredLeads, leadSortDirection]);

  const totalLeadPages = Math.max(1, Math.ceil(sortedLeads.length / LEAD_PAGE_SIZE));
  const safeLeadPage = Math.min(leadPage, totalLeadPages);
  const paginatedLeads = useMemo(() => {
    const start = (safeLeadPage - 1) * LEAD_PAGE_SIZE;
    return sortedLeads.slice(start, start + LEAD_PAGE_SIZE);
  }, [sortedLeads, safeLeadPage]);
  const firstLeadRecord = sortedLeads.length ? ((safeLeadPage - 1) * LEAD_PAGE_SIZE) + 1 : 0;
  const lastLeadRecord = Math.min(safeLeadPage * LEAD_PAGE_SIZE, sortedLeads.length);

  useEffect(() => {
    setLeadPage(1);
  }, [overviewFilters, leadSortDirection]);

  useEffect(() => {
    setLeadPage((current) => Math.min(current, totalLeadPages));
  }, [totalLeadPages]);

  const visibleLeadIds = useMemo(
    () => paginatedLeads.map((lead) => lead._id).filter(Boolean),
    [paginatedLeads]
  );

  const isAllSelected = useMemo(
    () => visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id)),
    [visibleLeadIds, selectedLeadIds]
  );

  const leadOverviewSummary = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const newLeads = filteredLeads.filter((lead) => getLeadStatus(lead) === 'New Lead').length;
    const convertedLeads = filteredLeads.filter((lead) => getLeadStatus(lead) === 'Booked').length;
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
    date: toDateInput(lead.date || lead.createdAt) || new Date().toISOString().slice(0, 10),
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
    pincode: lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '',
    pinCode: lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '',
    postalCode: lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '',
    postal_code: lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '',
    zip: lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '',
    latitude: lead.latitude || '',
    longitude: lead.longitude || '',
    googlePlaceId: lead.googlePlaceId || lead.google_place_id || '',
    googlePlaceName: lead.googlePlaceName || lead.google_place_name || '',
    googlePhone: lead.googlePhone || lead.google_phone || '',
    googleWebsite: lead.googleWebsite || lead.google_website || '',
    pestIssue: lead.pestIssue || '',
    quotationValue: String(lead.quotationValue || lead.quotation_value || '').trim(),
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

  useAutoRefresh(async () => {
    const [leadRes, employeeRes, customerRes] = await Promise.allSettled([
      axios.get(`${API_BASE_URL}/api/leads`),
      axios.get(`${API_BASE_URL}/api/employees`),
      axios.get(`${API_BASE_URL}/api/customers`)
    ]);
    if (leadRes.status === 'fulfilled') setLeads(toObjectList(leadRes.value?.data));
    if (employeeRes.status === 'fulfilled') setEmployees(toObjectList(employeeRes.value?.data));
    if (customerRes.status === 'fulfilled') setCustomers(toObjectList(customerRes.value?.data));
  }, { enabled: !show && !viewLeadId && !logFollowupLeadId });

  useEffect(() => {
    try {
      localStorage.setItem('leads_visible_columns', JSON.stringify(visibleColumns));
    } catch {
      // Ignore storage failures (private mode / blocked storage)
    }
  }, [visibleColumns]);

  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((lead) => lead._id === id)));
  }, [leads]);

  useEffect(() => {
    const requestedLeadId = String(location.state?.openLogFollowupLeadId || '').trim();
    if (!requestedLeadId || leads.length === 0) return;
    const targetLead = leads.find((lead) => String(lead._id || '') === requestedLeadId);
    if (!targetLead) return;
    openLogFollowupModal(targetLead);
    navigate(location.pathname, { replace: true, state: null });
  }, [leads, location.pathname, location.state, navigate]);

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
    if (normalizedStatus === 'Booked') {
      closeStatusEditor();
      await convertToContract(lead);
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
    const viewportPadding = ROW_ACTION_MENU_GAP;
    const maxLeft = window.innerWidth - ROW_ACTION_MENU_APPROX_WIDTH - viewportPadding;
    const anchorLeft = Math.max(
      viewportPadding,
      Math.min(maxLeft, triggerRect.right - ROW_ACTION_MENU_APPROX_WIDTH)
    );

    const belowTop = triggerRect.bottom + ROW_ACTION_MENU_GAP;
    const aboveTop = triggerRect.top - ROW_ACTION_MENU_APPROX_HEIGHT - ROW_ACTION_MENU_GAP;
    const maxTop = window.innerHeight - ROW_ACTION_MENU_APPROX_HEIGHT - viewportPadding;
    const hasRoomBelow = belowTop + ROW_ACTION_MENU_APPROX_HEIGHT <= window.innerHeight - viewportPadding;
    const anchorTop = Math.max(
      viewportPadding,
      Math.min(maxTop, hasRoomBelow ? belowTop : aboveTop)
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
    navigate('/quotations/new', { state: { lead: mapLeadForWorkflow(lead) } });
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

  const sendWelcomeEmailToLead = async (lead) => {
    const recipientEmail = String(lead?.emailId || lead?.email || '').trim();
    if (!recipientEmail) {
      window.alert('Lead email address is required to share welcome email.');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/email/send`, {
        moduleType: 'lead',
        moduleName: 'Lead Master',
        templateType: 'lead_welcome',
        recipientEmail,
        recipientName: lead.customerName || 'Customer',
        recipientType: 'Customer',
        sentByUser: getPortalUserName() || 'User',
        contextData: {
          customer_name: lead.customerName || 'Customer',
          customer_email: recipientEmail,
          customer_phone: getLeadMobile(lead) || '',
          service_type: lead.pestIssue || '',
          address: lead.address || '',
          company_name: 'SKUAS Pest Control'
        }
      });
      window.alert(response.data?.success ? 'Welcome email sent successfully.' : 'Welcome email queued.');
    } catch (error) {
      console.error('Failed to send lead welcome email', error);
      window.alert(error?.response?.data?.error || 'Could not send welcome email.');
    }
  };

  const convertToContract = async (lead) => {
    if (lead?._id) {
      try {
        await axios.put(`${API_BASE_URL}/api/leads/${lead._id}`, {
          status: 'Booked',
          leadStatus: 'Booked'
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
      pincode: selectedLead.pincode || selectedLead.pinCode || selectedLead.postalCode || selectedLead.postal_code || selectedLead.zip || '',
      pinCode: selectedLead.pincode || selectedLead.pinCode || selectedLead.postalCode || selectedLead.postal_code || selectedLead.zip || '',
      postalCode: selectedLead.pincode || selectedLead.pinCode || selectedLead.postalCode || selectedLead.postal_code || selectedLead.zip || '',
      postal_code: selectedLead.pincode || selectedLead.pinCode || selectedLead.postalCode || selectedLead.postal_code || selectedLead.zip || '',
      zip: selectedLead.pincode || selectedLead.pinCode || selectedLead.postalCode || selectedLead.postal_code || selectedLead.zip || ''
    }));
  };

  const withPincodeAliases = (value) => {
    const pincode = normalizePincode(value);
    return {
      pincode,
      pinCode: pincode,
      postalCode: pincode,
      postal_code: pincode,
      zip: pincode
    };
  };

  const updatePincode = (value) => {
    const pincode = normalizePincode(value);
    setForm((current) => ({
      ...current,
      ...withPincodeAliases(pincode)
    }));
  };

  const extractAddressFields = (best = {}) => formatGoogleAddressParts(best);

  const validateLatLngRange = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Invalid coordinates. Please paste a valid latitude and longitude.';
    if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
    if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
    return '';
  };

  const parseLatLngFromGoogleUrl = (rawText) => {
    const parsed = extractGoogleMapsCoordinates(rawText);
    if (!parsed) return null;
    const validationError = validateLatLngRange(parsed.latitude, parsed.longitude);
    if (validationError) return { error: validationError };
    return {
      lat: String(parsed.latitude),
      lng: String(parsed.longitude)
    };
  };

  const applySearchCoordinates = (rawText) => {
    const parsed = parseLatLngFromGoogleUrl(rawText);
    if (!parsed) return false;

    if (parsed.error) {
      setSearchError(parsed.error);
      setShowSearchSuggestions(false);
      setSearchSuggestions([]);
      setForm((prev) => ({
        ...prev,
        latitude: '',
        longitude: ''
      }));
      return true;
    }

    setSearchError('');
    setShowSearchSuggestions(false);
    setSearchSuggestions([]);
    setForm((prev) => ({
      ...prev,
      latitude: parsed.lat,
      longitude: parsed.lng
    }));
    void enrichAddressFromLatLng(parsed.lat, parsed.lng, { preserveSearchAddress: true });
    return true;
  };

  const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

  const getSearchUnavailableMessage = (error, { forShortLink = false } = {}) => {
    const code = String(error?.code || '').trim();
    if (forShortLink) {
      return 'Short Google Maps links need resolver API. Please paste full Google Maps URL or coordinates.';
    }
    if (code === 'GOOGLE_MAPS_KEY_MISSING' || code === 'GOOGLE_MAPS_AUTH_FAILED' || code === 'GOOGLE_MAPS_SCRIPT_LOAD_FAILED' || code === 'GOOGLE_MAPS_INIT_FAILED') {
      return 'Google Maps search unavailable. You can still paste full Google Maps URL or coordinates.';
    }
    return 'Google search failed. Please try full place name with city.';
  };

  const buildAreaSearchFields = (entry = {}) => ([
    entry.areaName,
    entry.area,
    entry.billingArea,
    entry.shippingArea
  ].map((field) => normalizeSearchText(field)).filter(Boolean));

  const resolveMapSearchInput = async (rawText, { preserveSearchAddress = true } = {}) => {
    const query = String(rawText || '').trim();
    if (!query) return false;

    const directCoordinatesHandled = applySearchCoordinates(query);
    if (directCoordinatesHandled) return true;

    if (!isAllowedGoogleMapsUrl(query) && !isGoogleMapsShortLink(query)) return false;

    try {
      const result = await resolveGoogleMapsUrl(query, { apiBaseUrl: API_BASE_URL });
      if (!result?.success || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
        setSearchError(isGoogleMapsShortLink(query)
          ? 'Short Google Maps links need resolver API. Please paste full Google Maps URL or coordinates.'
          : 'Could not extract coordinates from this Google Maps URL. Please paste full Google Maps URL or coordinates.');
        return true;
      }

      setSearchError('');
      setShowSearchSuggestions(false);
      setSearchSuggestions([]);
      setForm((prev) => ({
        ...prev,
        latitude: String(result.latitude),
        longitude: String(result.longitude)
      }));
      void enrichAddressFromLatLng(result.latitude, result.longitude, { preserveSearchAddress });
      return true;
    } catch (error) {
      setSearchError(getSearchUnavailableMessage(error, { forShortLink: isGoogleMapsShortLink(query) }));
      return true;
    }
  };

  const handleSearchAddressChange = (value) => {
    updateForm('searchAddress', value);
    if (!applySearchCoordinates(value)) {
      if (isAllowedGoogleMapsUrl(value) || isGoogleMapsShortLink(value)) {
        setSearchError('');
        setShowSearchSuggestions(false);
        setSearchSuggestions([]);
        return;
      }
      setSearchError('');
      fetchLiveSearchSuggestions(value);
    }
  };

  const handleSearchAddressPaste = (event) => {
    const pastedText = event?.clipboardData?.getData('text') || '';
    const normalized = String(pastedText || '').trim();
    if (!normalized) return;

    window.setTimeout(() => {
      const currentValue = searchAddressInputRef.current?.value || normalized;
      void resolveMapSearchInput(currentValue, { preserveSearchAddress: true });
    }, 0);
  };

  const applySearchSuggestion = (place, queryText = '') => {
    const placeName = place.displayName?.text || place.displayName || '';
    const extracted = {
      address: String(place.address || '').trim(),
      areaName: String(place.areaName || '').trim(),
      city: String(place.city || '').trim(),
      state: String(place.state || '').trim(),
      pincode: String(place.pincode || '').trim(),
      ...extractAddressFields(place)
    };
    const address = extracted.address || getGoogleFormattedAddressText(place);
    const googlePhone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
    const googleWebsite = place.websiteURI || '';
    const lat = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat;
    const lng = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng;
    setForm((prev) => {
      const nextPincode = extracted.pincode || prev.pincode;
      return {
        ...prev,
        searchAddress: String(queryText || placeName || prev.searchAddress || '').trim(),
        address: address || prev.address,
        areaName: extracted.areaName || prev.areaName,
        city: extracted.city || prev.city,
        state: extracted.state || prev.state,
        ...withPincodeAliases(nextPincode),
        googlePlaceName: placeName || prev.googlePlaceName,
        googlePlaceId: place.id || prev.googlePlaceId,
        googlePhone: googlePhone || prev.googlePhone,
        googleWebsite: googleWebsite || prev.googleWebsite,
        latitude: Number.isFinite(Number(lat)) ? String(lat) : prev.latitude,
        longitude: Number.isFinite(Number(lng)) ? String(lng) : prev.longitude
      };
    });
  };

  const enrichAddressFromLatLng = async (lat, lng, { preserveSearchAddress = false } = {}) => {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || !window.google?.maps?.Geocoder) return;
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
      const first = response?.results?.[0];
      if (!first) return;
      const extracted = extractAddressFields(first);
      const formattedAddress = extracted.address || getGoogleFormattedAddressText(first);
      setForm((prev) => {
        const nextPincode = extracted.pincode || prev.pincode;
        return {
          ...prev,
          searchAddress: preserveSearchAddress ? prev.searchAddress : (formattedAddress || prev.searchAddress || ''),
          address: formattedAddress || prev.address || '',
          areaName: extracted.areaName || prev.areaName,
          city: extracted.city || prev.city,
          state: extracted.state || prev.state,
          ...withPincodeAliases(nextPincode)
        };
      });
    } catch (_error) {
      // ignore geocode enrichment failures
    }
  };

  const handleMapLocationChange = (lat, lng) => {
    setSearchError('');
    setShowSearchSuggestions(false);
    setSearchSuggestions([]);
    setForm((prev) => ({
      ...prev,
      latitude: String(lat),
      longitude: String(lng)
    }));
    void enrichAddressFromLatLng(lat, lng, { preserveSearchAddress: true });
  };

  useEffect(() => {
    if (!show || !searchAddressInputRef.current) return undefined;
    if (!hasGoogleMapsApiKey()) return undefined;

    let cleanup = () => {};
    let cancelled = false;

    attachPlacesAutocomplete({
      input: searchAddressInputRef.current,
      onSelected: (details) => {
        if (cancelled) return;
        const lat = Number(details?.latitude);
        const lng = Number(details?.longitude);
        const inputValue = String(searchAddressInputRef.current?.value || details?.formatted_address || details?.name || '').trim();
        if (!inputValue && !Number.isFinite(lat) && !Number.isFinite(lng)) return;

        const selectedPlace = {
          id: details?.place_id || '',
          displayName: details?.name || '',
          formattedAddress: details?.formatted_address || inputValue,
          address: details?.address || '',
          areaName: details?.areaName || '',
          city: details?.city || '',
          state: details?.state || '',
          pincode: details?.pincode || '',
          location: {
            lat: () => lat,
            lng: () => lng
          },
          addressComponents: []
        };

        applySearchSuggestion(selectedPlace, inputValue);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          void enrichAddressFromLatLng(lat, lng);
        }
        setShowSearchSuggestions(false);
        setSearchSuggestions([]);
        setSearchError('');
      },
      onRequireSelection: (message) => {
        if (!cancelled) setSearchError(message);
      },
      onError: (error) => {
        if (!cancelled) setSearchError(getSearchUnavailableMessage(error));
      }
    }).then((dispose) => {
      if (cancelled) {
        dispose?.();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [show]);

  const fetchLiveSearchSuggestions = async (value) => {
    if (!hasGoogleMapsApiKey()) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }
    const queryText = String(value || '').trim();
    if (queryText.length < 2) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }

    const reqId = ++suggestionSeqRef.current;
    try {
      await loadGooglePlacesScript();
      const { Place } = await window.google.maps.importLibrary('places');
      const { places } = await Place.searchByText({
        textQuery: queryText,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteURI'],
        maxResultCount: 5
      });
      if (reqId !== suggestionSeqRef.current) return;
      const results = Array.isArray(places) ? places : [];
      setSearchSuggestions(results);
      setShowSearchSuggestions(results.length > 0);
    } catch {
      if (reqId !== suggestionSeqRef.current) return;
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    }
  };

  const searchGooglePlace = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (isFetchingAddress) return;
    const query = String(form.searchAddress || '').trim();
    if (!query) {
      if (searchAddressInputRef.current) searchAddressInputRef.current.focus();
      setSearchError('Please enter company name or address.');
      return;
    }

    setIsFetchingAddress(true);
    setSearchError('');

    try {
      if (await resolveMapSearchInput(query, { preserveSearchAddress: true })) {
        return;
      }

      if (!hasGoogleMapsApiKey()) {
        setSearchError('Google Maps search unavailable. You can still paste full Google Maps URL or coordinates.');
        return;
      }

      await loadGooglePlacesScript();
      const { Place } = await window.google.maps.importLibrary('places');
      const request = {
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
      };
      const { places } = await Place.searchByText(request);

      if (!places || places.length === 0) {
        setSearchError('No business/address found. Try full name with city.');
        return;
      }

      const place = places[0];
      applySearchSuggestion(place, query);
      const lat = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat;
      const lng = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng;
      enrichAddressFromLatLng(lat, lng);
      setShowSearchSuggestions(false);
      setSearchSuggestions([]);

      setSearchError('');
    } catch (error) {
      console.error('Place.searchByText error:', error);
      setSearchError(getSearchUnavailableMessage(error));
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

  const getMobileColumnStyle = (columnKey) => {
    const width = mobileLeadColumnWidths[columnKey] || 128;
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` };
  };

  const getColumnStyle = (columnKey) => {
    if (isMobile) return getMobileColumnStyle(columnKey);
    return getResizableColumnStyle(columnKey);
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
    if (key === 'pincode') return lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '';
    if (key === 'pestIssue') return pestIssueShort(lead.pestIssue);
    if (key === 'leadSource') return lead.leadSource || '';
    if (key === 'propertyType') return lead.propertyType || lead.customerSegment || '';
    if (key === 'status') return getLeadStatus(lead);
    if (key === 'quotationValue') return lead.quotationValue || lead.quotation_value || '';
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
      pincode: String(record.pincode || record.pinCode || record.postalCode || record.postal_code || record.zip || '').trim(),
      pinCode: String(record.pincode || record.pinCode || record.postalCode || record.postal_code || record.zip || '').trim(),
      postalCode: String(record.pincode || record.pinCode || record.postalCode || record.postal_code || record.zip || '').trim(),
      postal_code: String(record.pincode || record.pinCode || record.postalCode || record.postal_code || record.zip || '').trim(),
      zip: String(record.pincode || record.pinCode || record.postalCode || record.postal_code || record.zip || '').trim(),
      pestIssue: String(record.pestIssue || '').trim(),
      quotationValue: String(record.quotationValue || record.quotation_value || '').trim(),
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
      alert(PHONE_VALIDATION_ERROR);
      return;
    }
    if (form.whatsappNumber && form.whatsappNumber.length !== 10) {
      alert(PHONE_VALIDATION_ERROR);
      return;
    }
    const pincode = normalizePincode(form.pincode);
    if (pincode && pincode.length !== 6) {
      alert('Pincode must be exactly 6 digits.');
      return;
    }
    if (form.leadSource === 'Reference' && !form.referenceCustomerId) {
      alert('Please select the reference customer.');
      return;
    }

    try {
      const payload = {
        ...form,
        ...withPincodeAliases(pincode),
        date: form.date || new Date().toISOString().slice(0, 10),
        mobileNumber: form.mobile,
        pestIssue: form.pestIssue,
        customerSegment: form.propertyType,
        leadStatus: form.status,
        notes: form.remarks,
        quotationValue: form.quotationValue ? Number(form.quotationValue) : 0,
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
  const filtersGridStyle = isMobile
    ? { ...s.filtersGrid, gridTemplateColumns: '1fr', minWidth: 0 }
    : isTablet
      ? { ...s.filtersGrid, gridTemplateColumns: 'repeat(3, minmax(120px, 1fr)) minmax(100px, auto)', minWidth: 0 }
      : s.filtersGrid;
  const registerHeadStyle = isMobile ? { ...s.registerHead, flexDirection: 'column', alignItems: 'stretch' } : s.registerHead;
  const registerActionsStyle = isMobile ? { ...s.registerActions, width: '100%', justifyContent: 'space-between' } : s.registerActions;
  const registerToolbarStyle = isMobile ? { ...s.registerToolbar, flexDirection: 'column', alignItems: 'stretch' } : s.registerToolbar;
  const toolbarLeftStyle = isMobile ? { ...s.toolbarLeft, flexWrap: 'wrap' } : s.toolbarLeft;
  const tableStyle = s.table;
  const viewGridStyle = isMobile ? { ...s.viewGrid, gridTemplateColumns: '1fr' } : s.viewGrid;
  const isFollowupCompact = viewportWidth <= 980;
  const followupGridStyle = isFollowupCompact ? { ...s.followupGrid, gridTemplateColumns: '1fr' } : s.followupGrid;
  const followupNoteStyle = { ...s.followupField, gridColumn: isFollowupCompact ? '1 / -1' : 'span 2' };
  const leadOverlayStyle = isMobile
    ? { ...s.ov, padding: isTiny ? '6px' : '10px', overflowX: 'hidden', placeItems: 'center' }
    : s.ov;
  const leadModalStyle = isMobile
    ? { ...s.cn, width: '100%', maxWidth: 'calc(100vw - 20px)', maxHeight: '92vh', boxSizing: 'border-box' }
    : s.cn;
  const leadModalHeadStyle = isMobile ? { ...s.hd, minHeight: '60px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', fontSize: '22px', padding: '14px 16px' } : s.hd;
  const leadModalBodyStyle = isMobile ? { ...s.body, padding: '14px', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' } : s.body;
  const leadGridStyle = isTablet || isMobile ? { ...s.gd, gridTemplateColumns: '1fr' } : s.gd;
  const leadFieldHalfStyle = isTablet || isMobile ? { ...s.fieldHalf, gridColumn: '1 / -1' } : s.fieldHalf;
  const leadFieldWideStyle = isTablet || isMobile ? { ...s.fieldWide, gridColumn: '1 / -1' } : s.fieldWide;
  const mapsRowStyle = isTablet || isMobile ? { ...s.mapsRow, flexDirection: 'column' } : s.mapsRow;
  const leadSectionStyle = isMobile ? { ...s.section, width: '100%', boxSizing: 'border-box', overflow: 'hidden' } : s.section;
  const leadInlineLabelRowStyle = isMobile
    ? { ...s.inlineLabelRow, alignItems: 'flex-start', gap: '6px', flexWrap: 'wrap' }
    : s.inlineLabelRow;
  const leadSmallToggleStyle = isMobile
    ? { ...s.smallToggle, maxWidth: '100%', whiteSpace: 'normal', lineHeight: 1.2 }
    : s.smallToggle;
  const leadDateInputStyle = { ...s.in, minHeight: '46px', height: '46px', lineHeight: 1.2, WebkitAppearance: 'none', appearance: 'none' };
  const analyticsTitleStyle = isTiny ? { ...s.analyticsTitle, fontSize: '20px' } : s.analyticsTitle;
  const registerTitleStyle = isTiny ? { ...s.registerTitle, fontSize: '16px' } : s.registerTitle;
  const buttonPrimaryStyle = isTiny ? { ...s.buttonPrimary, fontSize: '11px', padding: '7px 9px' } : s.buttonPrimary;
  const toolbarIconButtonStyle = isTiny ? { ...s.customizeButton, width: '32px', height: '32px' } : s.customizeButton;
  const leadModalCompactBodyStyle = isTiny ? { ...leadModalBodyStyle, padding: '10px' } : leadModalBodyStyle;
  const leadTableMinWidth = isMobile
    ? `${40 + visibleColumnDefs.reduce((sum, column) => sum + (mobileLeadColumnWidths[column.key] || 128), 0) + 92}px`
    : '100%';
  const leadMobileColumns = `40px ${visibleColumnDefs.map((column) => `${mobileLeadColumnWidths[column.key] || 128}px`).join(' ')} 92px`;
  const tableWrapStyle = isMobile
    ? { ...s.tableWrap, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', maxWidth: '100%' }
    : { ...s.tableWrap, overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%' };
  const tableStyleTiny = isMobile
    ? { ...tableStyle, width: leadTableMinWidth, minWidth: leadTableMinWidth, tableLayout: 'fixed', '--mobile-table-columns': leadMobileColumns, '--mobile-table-min-width': leadTableMinWidth }
    : { ...tableStyle, minWidth: leadTableMinWidth };
  const statusBadgeButtonStyle = isMobile
    ? {
        ...s.statusBadgeButton,
        width: '88px',
        minWidth: '88px',
        height: '30px',
        minHeight: '30px',
        padding: '0 8px',
        justifyContent: 'center',
        fontSize: '10px'
      }
    : s.statusBadgeButton;
  const statusInlineSelectStyle = isMobile
    ? {
        ...s.statusInlineSelect,
        width: '88px',
        minWidth: '88px',
        height: '30px',
        minHeight: '30px',
        padding: '0 6px',
        fontSize: '10px'
      }
    : s.statusInlineSelect;
  const actionColumnStyle = isMobile
    ? { width: '92px', minWidth: '92px', maxWidth: '92px' }
    : { width: '84px', minWidth: '84px', maxWidth: '84px' };
  const rowActionButtonStyle = isMobile
    ? { ...s.rowActionButton, width: '34px', minWidth: '34px', minHeight: '34px', padding: 0, borderRadius: '8px', justifyContent: 'center' }
    : { ...s.rowActionButton, width: '34px', minWidth: '34px', minHeight: '34px', padding: 0, borderRadius: '8px', justifyContent: 'center' };
  const rowActionIconBoxStyle = isMobile
    ? { ...s.rowActionIconBox, width: '14px', height: '14px', borderRadius: '4px' }
    : s.rowActionIconBox;
  const filterActionFieldStyle = isMobile || isTablet
    ? { ...s.filterField, justifyContent: 'flex-end', alignItems: 'stretch', gridColumn: 'auto' }
    : { ...s.filterField, justifyContent: 'flex-end', alignItems: 'flex-end', gridColumn: '7 / 8' };
  const filterActionsStyle = isMobile ? { ...s.filterActions, justifyContent: 'stretch', width: '100%' } : s.filterActions;
  const applyButtonStyle = isMobile ? { ...s.applyButton, flex: 1 } : s.applyButton;
  const leadRecordCellStyle = isMobile
    ? { ...s.cell, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'normal', fontSize: '11px', lineHeight: 1.2 }
    : { ...s.cell, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'normal' };
  const leadStatusCellStyle = isMobile
    ? { ...s.cell, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px', lineHeight: 1.2 }
    : { ...s.cell, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <div style={pageStyle}>
      <div style={s.analyticsWrap}>
        <div style={analyticsHeaderStyle}>
          <div style={s.analyticsTitleWrap}>
            <h3 style={analyticsTitleStyle}>Lead Master Overview Summary</h3>
            <p style={s.analyticsSub}>Year-wise, month-wise, pest issue-wise, source-wise, status-wise, and assigned-wise lead analytics.</p>
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

        {!isMobile ? (
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
                    <option key={issue} value={issue}>{pestIssueLabel(issue)}</option>
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
        ) : null}
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
                style={toolbarIconButtonStyle}
                aria-label="More options"
                onClick={() => setShowMoreMenu((prev) => !prev)}
              >
                <MoreHorizontal size={14} />
              </button>
              {showMoreMenu ? (
                <div ref={moreMenuRef} style={s.menu}>
                  <button type="button" style={s.menuButton} onClick={openEditSelectedLead}>
                    Edit Lead
                  </button>
                  <button type="button" style={s.menuButton} onClick={deleteSelectedLeads}>
                    Delete
                  </button>
                  <button type="button" style={s.menuButton} onClick={exportData}>
                    Export Data
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
                <div ref={customizePanelRef} style={s.popover}>
                  <div style={s.popoverHeader}>Show/Hide Columns</div>
                  <div style={s.popoverBody}>
                    <button
                      type="button"
                      style={{ ...s.menuButton, border: '1px solid var(--color-border)', borderRadius: '8px', justifyContent: 'center' }}
                      onClick={() => {
                        setVisibleColumns(defaultVisibleLeadColumns);
                        resetLeadColumns();
                      }}
                    >
                      Reset Default Columns
                    </button>
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
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={importDataFromFile}
        />

        <div style={tableWrapStyle} className="crm-table-shell crm-table-shell--clipped">
          <table style={tableStyleTiny} className="crm-compact-table crm-stack-mobile">
            <colgroup>
              <col style={s.checkboxWrap} />
              {visibleColumnDefs.map((column) => (
                <col key={column.key} style={getColumnStyle(column.key)} />
              ))}
              <col style={actionColumnStyle} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...s.headCell, ...s.checkboxWrap }}>
                  <input type="checkbox" style={s.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
                </th>
                {visibleColumnDefs.map((column) => (
                  <th key={column.key} style={{ ...s.headCell, ...s.headCellResizable, ...getColumnStyle(column.key) }}>
                    {column.key === 'date' ? (
                      <span style={s.headLabelWithSort}>
                        <span style={s.headLabelWrap}>{column.label}</span>
                        <button
                          type="button"
                          style={s.dateSortButton}
                          onClick={() => setLeadSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                          title={leadSortDirection === 'desc' ? 'Newest leads first' : 'Oldest leads first'}
                          aria-label={leadSortDirection === 'desc' ? 'Sort lead date oldest first' : 'Sort lead date newest first'}
                        >
                          {leadSortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                        </button>
                      </span>
                    ) : (
                      <span style={s.headLabelWrap}>{column.label}</span>
                    )}
                  </th>
                ))}
                <th style={{ ...s.headCell, ...s.headActionCell, ...actionColumnStyle, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnDefs.length + 2} style={{ ...s.cell, textAlign: 'center', color: '#64748b', padding: '24px' }}>
                    No active leads found.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr key={lead._id} style={s.row}>
                    <td style={{ ...s.cell, ...s.checkboxWrap }} data-label="Select">
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
                          <td key={`${lead._id}-${column.key}`} style={{ ...leadStatusCellStyle, ...getColumnStyle(column.key) }} data-label={column.label}>
                            <div data-lead-status-editor="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {statusEditorLeadId === lead._id && !convertedLead ? (
                                <select
                                  autoFocus
                                  value={statusDraftValue}
                                  style={statusInlineSelectStyle}
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
                                  style={{ ...statusBadgeButtonStyle, ...statusTone, cursor: convertedLead ? 'not-allowed' : 'pointer', opacity: convertedLead ? 0.9 : 1 }}
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
                          style={{ ...leadRecordCellStyle, ...getColumnStyle(column.key) }}
                          title={String(value || '')}
                          data-label={column.label}
                        >
                          <span className="crm-cell-wrap">{value || '-'}</span>
                        </td>
                      );
                    })}
                    <td style={{ ...s.cell, ...s.actionCell, ...actionColumnStyle, textAlign: 'center' }} data-label="Action">
                      <div style={s.rowActionWrap} data-lead-row-action="true">
                        <button
                          type="button"
                          className="crm-action-chip"
                          style={rowActionButtonStyle}
                          onClick={(event) => openRowActionMenu(event, lead._id)}
                          title="More actions"
                          aria-label="More actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {rowActionLeadId === lead._id && rowActionMenuPosition
                          ? createPortal(
                            <div
                              className="crm-action-menu-panel"
                              style={{
                                ...s.rowActionMenu,
                                left: `${rowActionMenuPosition.left}px`,
                                top: `${rowActionMenuPosition.top}px`
                              }}
                              data-lead-row-action="true"
                            >
                              <button
                                type="button"
                                className="crm-action-menu-item"
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
                                className="crm-action-menu-item"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  openEditLeadModal(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Edit Lead
                              </button>
                              <button
                                type="button"
                                className="crm-action-menu-item"
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
                                className="crm-action-menu-item"
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
                                className="crm-action-menu-item"
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
                                className="crm-action-menu-item"
                                style={s.rowActionMenuBtn}
                                onClick={() => {
                                  sendWelcomeEmailToLead(lead);
                                  closeRowActionMenu();
                                }}
                              >
                                Share Email
                              </button>
                              <button
                                type="button"
                                className="crm-action-menu-item"
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
                                className="crm-action-menu-item"
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
        <div style={registerToolbarStyle}>
          <div style={toolbarLeftStyle}>
            <span style={s.toolLabel}>Lead Master</span>
            <span style={s.toolbarMeta}>
              {sortedLeads.length ? `${firstLeadRecord}-${lastLeadRecord} of ${sortedLeads.length} records` : '0 records'}
            </span>
          </div>
        </div>
        <div style={s.pagination}>
          <div style={s.paginationActions}>
            <button
              type="button"
              style={{ ...s.paginationButton, ...(safeLeadPage <= 1 ? s.paginationButtonDisabled : {}) }}
              disabled={safeLeadPage <= 1}
              onClick={() => setLeadPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              style={{ ...s.paginationButton, ...(safeLeadPage >= totalLeadPages ? s.paginationButtonDisabled : {}) }}
              disabled={safeLeadPage >= totalLeadPages}
              onClick={() => setLeadPage((current) => Math.min(totalLeadPages, current + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
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
                    <span style={s.viewItemValue}>{viewedLead.pestIssue ? pestIssueLabel(viewedLead.pestIssue) : '-'}</span>
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
          <div className="crm-modal-surface" style={s.followupModal}>
            <div className="crm-modal-surface-header" style={s.followupHead}>
              <h3 style={s.followupTitle}><PhoneCall size={22} /> Log Follow-up</h3>
              <X size={22} style={{ cursor: 'pointer', color: '#ffffff', flexShrink: 0 }} onClick={closeLogFollowupModal} />
            </div>
            <div className="crm-modal-surface-body" style={s.followupBody}>
              <div style={s.followupLeadBadge}>
                {(followupLead.customerName || 'Lead')} ({normalizePhoneNumber(getLeadMobile(followupLead)) || 'No Mobile'})
              </div>
              <div style={followupGridStyle}>
                <div style={s.followupField}>
                  <label style={s.lb}>Follow-up Type</label>
                  <select value={followupForm.type} style={{ ...s.in, ...s.followupInput }} onChange={(event) => setFollowupForm((prev) => ({ ...prev, type: event.target.value }))}>
                    {FOLLOWUP_TYPES.map((entry) => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                </div>
                <div style={s.followupField}>
                  <label style={s.lb}>Outcome</label>
                  <select value={followupForm.outcome} style={{ ...s.in, ...s.followupInput }} onChange={(event) => setFollowupForm((prev) => ({ ...prev, outcome: event.target.value }))}>
                    {FOLLOWUP_OUTCOMES.map((entry) => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                </div>
                <div style={s.followupField}>
                  <label style={s.lb}>Next Follow-up Date</label>
                  <div style={{ position: 'relative', minWidth: 0 }}>
                    <input
                      type="date"
                      value={followupForm.nextFollowupDate}
                      style={{ ...s.in, ...s.followupInput, paddingRight: '38px' }}
                      onChange={(event) => setFollowupForm((prev) => ({ ...prev, nextFollowupDate: event.target.value }))}
                    />
                    <CalendarDays size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div style={s.followupField}>
                  <label style={s.lb}>Followed Up By</label>
                  <select value={followupForm.followedUpBy} style={{ ...s.in, ...s.followupInput }} onChange={(event) => setFollowupForm((prev) => ({ ...prev, followedUpBy: event.target.value }))}>
                    <option value="">-- Select --</option>
                    {salesEmployees.map((employee) => (
                      <option key={employee._id} value={formatEmployeeName(employee)}>
                        {formatEmployeeName(employee)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={followupNoteStyle}>
                  <label style={s.lb}>Notes</label>
                  <textarea
                    value={followupForm.notes}
                    style={{ ...s.ta, ...s.followupTextarea }}
                    placeholder="Key discussion points..."
                    onChange={(event) => setFollowupForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="crm-modal-surface-footer" style={s.followupActions}>
              <button type="button" style={s.followupCancelBtn} onClick={closeLogFollowupModal}>Cancel</button>
              <button type="button" style={s.followupSaveBtn} onClick={saveLogFollowup} disabled={isSavingFollowup}>
                {isSavingFollowup ? 'Saving...' : 'Save Follow-up'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {show && (
        <div style={leadOverlayStyle}>
          <form className="crm-modal-surface" style={leadModalStyle} onSubmit={save}>
            <div className="crm-modal-surface-header" style={leadModalHeadStyle}>
              <span>{editingLeadId ? 'Edit Lead Form' : 'Lead Entry Form'}</span>
              <X onClick={resetForm} style={{ cursor: 'pointer' }} />
            </div>

            <div className="crm-modal-surface-body" style={leadModalCompactBodyStyle}>
              <div style={leadSectionStyle}>
                <div style={s.sectionTitle}><User size={14} /> Customer Details</div>
                <div style={leadGridStyle}>
                  <div>
                    <label style={s.lb}>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      style={leadDateInputStyle}
                      onChange={(e) => updateForm('date', e.target.value)}
                    />
                  </div>
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
                      pattern="[0-9]{10}"
                      placeholder="10 digit mobile number"
                      required
                    />
                  </div>
                  <div>
                    <div style={leadInlineLabelRowStyle}>
                      <label style={{ ...s.lb, marginBottom: 0 }}>Whatsapp Number</label>
                      <label style={{ ...leadSmallToggleStyle, opacity: form.mobile.trim() ? 1 : 0.45, cursor: form.mobile.trim() ? 'pointer' : 'not-allowed' }}>
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
                      pattern="[0-9]{10}"
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

              <div style={leadSectionStyle}>
                <div style={s.sectionTitle}><MapPin size={14} /> Property Details</div>
                <div style={leadGridStyle}>
                  <div style={leadFieldWideStyle}>
                    <label style={s.lb}>Search Address</label>
                    <div style={mapsRowStyle}>
                      <input
                        ref={searchAddressInputRef}
                        value={form.searchAddress}
                        style={{ ...s.in, marginBottom: 0, flex: 1, minWidth: 0 }}
                        onChange={(e) => handleSearchAddressChange(e.target.value)}
                        onPaste={handleSearchAddressPaste}
                        onFocus={() => setShowSearchSuggestions(searchSuggestions.length > 0)}
                        onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 160)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          e.stopPropagation();
                          searchGooglePlace(e);
                        }}
                        placeholder="Search company, shop, office, area, or address"
                      />
                      <button
                        type="button"
                        formNoValidate
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          searchGooglePlace(e);
                        }}
                        style={s.mapsButton}
                        disabled={isFetchingAddress}
                      >
                        <Search size={14} /> {isFetchingAddress ? 'Fetching...' : 'Search Only'}
                      </button>
                    </div>
                    {showSearchSuggestions ? (
                      <div style={{ marginTop: '6px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#fff', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)', maxHeight: '220px', overflowY: 'auto' }}>
                        {searchSuggestions.map((place) => {
                          const name = place.displayName?.text || place.displayName || place.formattedAddress || '';
                          const address = place.formattedAddress || '';
                          return (
                            <button
                              key={String(place.id || `${name}-${address}`)}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                applySearchSuggestion(place, form.searchAddress);
                                const lat = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat;
                                const lng = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng;
                                enrichAddressFromLatLng(lat, lng);
                                setShowSearchSuggestions(false);
                                setSearchSuggestions([]);
                                setSearchError('');
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
                    <input value={form.pincode} style={s.in} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" onChange={(e) => updatePincode(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={leadSectionStyle}>
                <div style={s.sectionTitle}><ClipboardList size={14} /> Lead Details</div>
                <div style={leadGridStyle}>
                  <div className="field">
                    <label style={s.lb}>Pest Issue</label>
                    <select
                      value={form.pestIssue}
                      style={s.in}
                      onChange={(e) => updateForm('pestIssue', e.target.value)}
                      required
                    >
                      <option value="">Select service</option>
                      {PEST_ISSUES.map((issue) => (
                        <option key={issue} value={issue}>{pestIssueLabel(issue)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={s.lb}>Quotation Value</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quotationValue}
                      style={s.in}
                      placeholder="Enter amount"
                      onChange={(e) => updateForm('quotationValue', e.target.value)}
                    />
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

            <div className="crm-modal-surface-footer" style={{ padding: '12px 24px', textAlign: 'right', background: '#fff', borderTop: '1px solid var(--color-border)', position: 'sticky', bottom: 0 }}>
              <button type="button" onClick={resetForm} style={{ marginRight: '10px', minHeight: '40px', padding: '0 16px', border: '1px solid rgba(17,17,17,0.1)', borderRadius: '12px', cursor: 'pointer', background: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 700 }}>
                Cancel
              </button>
              <button type="submit" style={{ minHeight: '40px', background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {editingLeadId ? 'Update' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
