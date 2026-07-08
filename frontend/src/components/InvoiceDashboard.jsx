import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { Check, ChevronLeft, ChevronRight, FileText, MoreHorizontal, Pencil, PlusCircle, Settings, Trash2, X } from 'lucide-react';
import SortChevronIcon from './ui/SortChevronIcon';
import {
  defaultInvoiceVisibleColumns,
  invoiceColumns as columns,
  normalizeInvoiceVisibleColumns
} from '../utils/invoicePreferences';
import { normalizeIndianMobileNumber } from '../utils/phone';
import { triggerSalesPerformanceRefresh } from '../pages/sales-performance/salesPerformanceApi';
import { triggerContractsRefresh } from '../pages/sales-performance/salesPerformanceApi';
import { subscribeDashboardRefresh, triggerDashboardRefresh } from '../utils/dashboardRefresh';
import { clearPortalUser } from '../utils/portalAuth';
import PdfPreviewModal from './PdfPreviewModal';
import ServiceScheduleBuilder from './ServiceScheduleBuilder';
import { DEFAULT_LEAD_SOURCES, mergeLeadSourceOptions } from '../utils/leadSources';
import {
  buildContractWindow,
  buildServiceScheduleDraftFromInvoice,
  buildServiceSchedulePlan,
  buildServiceScheduleRows,
  normalizeServiceScheduleRows,
  normalizeServiceScheduleTime,
  serviceSchedulePreferredDayOptions
} from '../utils/serviceScheduleBuilder';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const INVOICE_PAGE_SIZE = 20;
const INVOICE_DASHBOARD_CACHE_KEY = 'skuasmaster-invoice-dashboard-cache-v1';
const INVOICE_NEW_CONTRACT_DRAFT_CACHE_KEY = 'skuasmaster-invoice-new-contract-draft-v1';
const currentInvoiceYear = new Date().getFullYear();
const currentInvoiceYearShort = String(currentInvoiceYear).slice(-2);
const defaultGstInvoicePrefix = `SPC/${currentInvoiceYear}/`;
const defaultNonGstInvoicePrefix = `SPC/N-${currentInvoiceYearShort}/`;

const readInvoiceDashboardCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INVOICE_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      itemsCatalog: Array.isArray(parsed.itemsCatalog) ? parsed.itemsCatalog : [],
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      companySettings: parsed.companySettings || {},
      invoiceNumberPrefs: parsed.invoiceNumberPrefs || defaultInvoiceNumberPrefs,
      visibleColumns: Array.isArray(parsed.visibleColumns) ? parsed.visibleColumns : null,
      updatedAt: Number(parsed.updatedAt || 0) || 0
    };
  } catch (_error) {
    return null;
  }
};

const writeInvoiceDashboardCache = (snapshot = {}) => {
  if (typeof window === 'undefined') return;
  try {
    const current = readInvoiceDashboardCache() || {};
    window.sessionStorage.setItem(INVOICE_DASHBOARD_CACHE_KEY, JSON.stringify({
      invoices: Array.isArray(snapshot.invoices) ? snapshot.invoices : (Array.isArray(current.invoices) ? current.invoices : []),
      payments: Array.isArray(snapshot.payments) ? snapshot.payments : (Array.isArray(current.payments) ? current.payments : []),
      customers: Array.isArray(snapshot.customers) ? snapshot.customers : (Array.isArray(current.customers) ? current.customers : []),
      itemsCatalog: Array.isArray(snapshot.itemsCatalog) ? snapshot.itemsCatalog : (Array.isArray(current.itemsCatalog) ? current.itemsCatalog : []),
      employees: Array.isArray(snapshot.employees) ? snapshot.employees : (Array.isArray(current.employees) ? current.employees : []),
      companySettings: snapshot.companySettings || current.companySettings || {},
      invoiceNumberPrefs: snapshot.invoiceNumberPrefs || current.invoiceNumberPrefs || defaultInvoiceNumberPrefs,
      visibleColumns: Array.isArray(snapshot.visibleColumns) ? snapshot.visibleColumns : (Array.isArray(current.visibleColumns) ? current.visibleColumns : null),
      updatedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore storage failures so the page still works in restricted environments.
  }
};

const readInvoiceDraftCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INVOICE_NEW_CONTRACT_DRAFT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      form: parsed.form && typeof parsed.form === 'object' ? parsed.form : null,
      serviceScheduleDraft: parsed.serviceScheduleDraft && typeof parsed.serviceScheduleDraft === 'object' ? parsed.serviceScheduleDraft : null,
      serviceScheduleRows: Array.isArray(parsed.serviceScheduleRows) ? parsed.serviceScheduleRows : null,
      serviceScheduleExpanded: Boolean(parsed.serviceScheduleExpanded),
      serviceScheduleTime: String(parsed.serviceScheduleTime || '').trim(),
      showModal: Boolean(parsed.showModal),
      modalOpenedFromContract: Boolean(parsed.modalOpenedFromContract),
      savedAt: Number(parsed.savedAt || 0) || 0
    };
  } catch (_error) {
    return null;
  }
};

const writeInvoiceDraftCache = (snapshot = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(INVOICE_NEW_CONTRACT_DRAFT_CACHE_KEY, JSON.stringify({
      form: snapshot.form && typeof snapshot.form === 'object' ? snapshot.form : null,
      serviceScheduleDraft: snapshot.serviceScheduleDraft && typeof snapshot.serviceScheduleDraft === 'object' ? snapshot.serviceScheduleDraft : null,
      serviceScheduleRows: Array.isArray(snapshot.serviceScheduleRows) ? snapshot.serviceScheduleRows : null,
      serviceScheduleExpanded: Boolean(snapshot.serviceScheduleExpanded),
      serviceScheduleTime: String(snapshot.serviceScheduleTime || '').trim(),
      showModal: Boolean(snapshot.showModal),
      modalOpenedFromContract: Boolean(snapshot.modalOpenedFromContract),
      savedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore storage failures so the page still works in restricted environments.
  }
};

const clearInvoiceDraftCache = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(INVOICE_NEW_CONTRACT_DRAFT_CACHE_KEY);
  } catch (_error) {
    // Ignore storage failures so the page still works in restricted environments.
  }
};

const termsOptions = ['Paid', 'Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const termsToDays = { Paid: 0, 'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Net 60': 60 };
const taxOptions = [0, 5, 12, 18];
const paymentModeOptions = ['Cheque', 'Cash', 'Bank Transfer', 'UPI', 'Card', 'Razorpay'];
const paymentDepositOptions = ['Current Account', 'Saving Account'];
const contractCustomerTypeOptions = ['New', 'Existing', 'Renewal'];
const getDefaultPaymentDepositTo = (invoiceType = 'GST') => String(invoiceType || '').trim().toUpperCase() === 'NON GST'
  ? 'Saving Account'
  : 'Current Account';
const getDefaultPaymentModeForDepositTo = (depositTo, invoiceType = 'GST') => {
  const normalizedDepositTo = normalizePaymentDepositTo(depositTo, invoiceType);
  if (normalizedDepositTo === 'Saving Account') return 'UPI';
  if (normalizedDepositTo === 'Current Account') return 'Bank Transfer';
  if (normalizedDepositTo === 'Cash') return 'Cash';
  return 'Cheque';
};
const normalizePaymentDepositTo = (value, invoiceType = 'GST') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return getDefaultPaymentDepositTo(invoiceType);
  if (['cash', 'billing', 'undeposited funds', 'undeposited fund'].includes(raw)) return 'Cash';
  if (['current account', 'current', 'bank', 'bank transfer'].includes(raw)) return 'Current Account';
  if (['saving account', 'savings account', 'saving', 'savings'].includes(raw)) return 'Saving Account';
  return getDefaultPaymentDepositTo(invoiceType);
};
const contractPeriodOptions = [
  { value: 'single_time', label: 'Single time' },
  { value: 'single_time_plus_7', label: 'Single time +7 days' },
  { value: 'single_time_plus_10', label: 'Single time +10 days' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'three_months', label: '3 months' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual' },
  { value: 'two_years', label: '2 years' },
  { value: 'three_years', label: '3 years' },
  { value: 'five_years', label: '5 years' },
  { value: 'ten_years', label: '10 years' }
];
const serviceFrequencyOptions = [
  { value: 'initial_treatment_one_year_warranty', label: 'Initial treatment with One year Warranty' },
  { value: 'initial_treatment_two_year_warranty', label: 'Initial treatment with Two years Warranty' },
  { value: 'initial_treatment_three_year_warranty', label: 'Initial treatment with Three years Warranty' },
  { value: 'single_treatment_no_followup', label: 'Single treatment without any followup' },
  { value: 'single_followup_7', label: 'Single Visit then on followup visit after 7 days' },
  { value: 'single_followup_10', label: 'Single Visit then on followup visit after 10 days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_monthly', label: 'Bi-Monthly' },
  { value: 'quarterly_visits', label: 'Quarterly Visits' },
  { value: 'three_treatment_every_4_months', label: 'Three treatments every 4 months' },
  { value: 'initial_spray_gel_batting_7_then_4m', label: 'Initial spray treatment with gel batting after 7 days, then every 4 months' }
].sort((a, b) => a.label.localeCompare(b.label));
const contractPeriodConfig = {
  single_time: { unit: 'days', value: 1 },
  weekly: { unit: 'days', value: 7 },
  fortnightly_visits: { unit: 'days', value: 14 },
  monthly: { unit: 'months', value: 1 },
  bi_monthly: { unit: 'months', value: 2 },
  quarterly: { unit: 'months', value: 3 },
  half_yearly: { unit: 'months', value: 6 },
  annual: { unit: 'months', value: 12 },
  two_years: { unit: 'months', value: 24 },
  three_years: { unit: 'months', value: 36 },
  five_years: { unit: 'months', value: 60 },
  ten_years: { unit: 'months', value: 120 }
};
const serviceFrequencyConfig = {
  initial_treatment_one_year_warranty: { type: 'single_once' },
  initial_treatment_two_year_warranty: { type: 'single_once' },
  initial_treatment_three_year_warranty: { type: 'single_once' },
  single_treatment_no_followup: { type: 'single_once' },
  single_followup_7: { type: 'followup_days', value: 7 },
  single_followup_10: { type: 'followup_days', value: 10 },
  weekly: { type: 'interval_days', value: 7 },
  fortnightly: { type: 'interval_days', value: 14 },
  monthly: { type: 'interval_months', value: 1 },
  bi_monthly: { type: 'interval_months', value: 2 },
  quarterly_visits: { type: 'interval_months', value: 3 },
  three_treatment_every_4_months: { type: 'interval_months', value: 4, maxServices: 3 },
  initial_spray_gel_batting_7_then_4m: { type: 'followup_then_interval_months', followupDays: 7, intervalMonths: 4 }
};
const gstStateOptions = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TG', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UT', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' }
];
const getGstStateLabel = (option) => `[${option.code}] - ${option.name}`;
const gstStateLabels = gstStateOptions.map(getGstStateLabel);
const gstStateOptionsWithDelhiFirst = [
  ...gstStateOptions.filter((state) => state.name === 'Delhi'),
  ...gstStateOptions.filter((state) => state.name !== 'Delhi')
];
const normalizeGstState = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = gstStateLabels.find((label) => label.toLowerCase() === raw.toLowerCase());
  if (direct) return direct;
  const codeMatch = raw.match(/^\[?([A-Za-z]{2})\]?(?:\s*-\s*.*)?$/);
  if (codeMatch) {
    const byCode = gstStateOptions.find((entry) => entry.code.toLowerCase() === codeMatch[1].toLowerCase());
    if (byCode) return getGstStateLabel(byCode);
  }
  const byName = gstStateOptions.find((entry) => entry.name.toLowerCase() === raw.toLowerCase());
  if (byName) return getGstStateLabel(byName);
  return raw;
};

const createEmptyLine = (defaults = {}) => ({
  itemId: '',
  itemName: '',
  description: '',
  frequency: '',
  sac: '',
  itemType: 'service',
  contractPeriod: '',
  contractStartDate: defaults.contractStartDate || '',
  contractStartDateSource: defaults.contractStartDateSource || (defaults.contractStartDate ? 'manual' : 'invoice-date'),
  serviceWeekday: defaults.serviceWeekday || '',
  contractEndDate: '',
  renewalDate: '',
  serviceFrequency: '',
  totalServices: '',
  serviceStartDate: '',
  serviceEndDate: '',
  quantity: '1',
  rate: '0',
  taxRate: '18'
});

const createEmptyPaymentSplit = (depositTo = getDefaultPaymentDepositTo('GST')) => ({
  mode: getDefaultPaymentModeForDepositTo(depositTo),
  depositTo: normalizePaymentDepositTo(depositTo),
  amount: '0'
});

const emptyForm = {
  customerId: '',
  customerName: '',
  invoiceType: 'GST',
  billingAddressSource: 'billing',
  shippingAddressSource: 'shipping',
  billingAddressText: '',
  shippingAddressText: '',
  customerType: 'New',
  customerPremiseId: '',
  premiseLabel: '',
  premiseAddress: '',
  premiseAreaName: '',
  premiseCity: '',
  premiseState: '',
  premisePincode: '',
  premiseGoogleMapUrl: '',
  customShippingAddresses: [],
  placeOfSupply: '',
  leadSource: '',
  invoiceNumber: '',
  date: new Date().toISOString().slice(0, 10),
  terms: 'Paid',
  dueDate: new Date().toISOString().slice(0, 10),
  salesperson: '',
  servicePeriod: '',
  servicePeriodStart: '',
  servicePeriodEnd: '',
  subject: '',
  items: [createEmptyLine()],
  customerNotes: '',
  termsAndConditions: '',
  serviceScheduleDefaultTime: '10:00',
  showPaymentDetailsInPdf: true,
  showGstNumberInPdf: true,
  paymentReceivedEnabled: true,
  paymentSplits: [createEmptyPaymentSplit()],
  paymentReceivedTotal: '0',
  attachments: [],
  status: 'DRAFT',
  amount: '0',
  balanceDue: '0',
  subtotal: '0',
  totalTax: '0',
  withholdingType: 'TDS',
  withholdingRate: '0',
  withholdingAmount: '0',
  discount: '0',
  roundOff: '0',
  total: '0'
};

const defaultInvoiceNumberPrefs = {
  mode: 'auto',
  gstPrefix: defaultGstInvoicePrefix,
  gstNextNumber: 66,
  nonGstPrefix: defaultNonGstInvoicePrefix,
  nonGstNextNumber: 1,
  padding: 4
};

const normalizeLegacyInvoicePrefix = (value, fallback = '') => {
  const raw = String(value || '').trim();
  if (!raw) return String(fallback || '').trim();
  const legacyMatch = raw.match(/^(.*[\/\-_ ])(\d+)$/);
  return legacyMatch ? legacyMatch[1] : raw;
};

const sanitizeDecimalInput = (value) => {
  const raw = String(value ?? '');
  if (!raw) return '';
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const [integerPart = '', ...fractionParts] = cleaned.split('.');
  if (fractionParts.length === 0) return integerPart;
  const fraction = fractionParts.join('').slice(0, 2);
  const normalizedInteger = integerPart === '' ? '0' : integerPart;
  return `${normalizedInteger}.${fraction}`;
};

const sanitizeSignedDecimalInput = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const sign = raw.startsWith('-') ? '-' : raw.startsWith('+') ? '+' : '';
  const unsigned = raw.replace(/^[+-]/, '');
  const cleaned = sanitizeDecimalInput(unsigned);
  if (!cleaned) return sign;
  return `${sign}${cleaned}`;
};

const parseDecimalNumber = (value, fallback = 0) => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseInvoiceLikeDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const parsed = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }
  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    const parsed = new Date(Number(year), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const normalizeConfiguredInvoicePrefix = (value, fallback = '', invoiceType = 'GST') => {
  const raw = normalizeLegacyInvoicePrefix(value, fallback);
  if (!raw) return String(fallback || '').trim();

  if (normalizeInvoiceType(invoiceType) === 'NON GST') {
    if (/^SPC\/N-\d{2}\/$/.test(raw) || raw === 'SPC-NG-' || raw === 'SPC/N-' || raw === 'SPC-') {
      return defaultNonGstInvoicePrefix;
    }
    return raw;
  }

  if (/^SPC\/\d{4}\/$/.test(raw) || raw === 'SPC-NG-' || raw === 'SPC/' || raw === 'SPC-' || raw === 'SPC') {
    return defaultGstInvoicePrefix;
  }
  return raw;
};

const sanitizeInvoiceNumberPrefs = (raw = {}) => ({
  mode: raw.mode === 'manual' ? 'manual' : 'auto',
  gstPrefix: normalizeConfiguredInvoicePrefix(raw.gstPrefix ?? raw.prefix, defaultInvoiceNumberPrefs.gstPrefix, 'GST'),
  gstNextNumber: Math.max(1, Number(raw.gstNextNumber ?? raw.nextNumber ?? defaultInvoiceNumberPrefs.gstNextNumber) || defaultInvoiceNumberPrefs.gstNextNumber),
  nonGstPrefix: normalizeConfiguredInvoicePrefix(raw.nonGstPrefix, defaultInvoiceNumberPrefs.nonGstPrefix, 'NON GST'),
  nonGstNextNumber: Math.max(1, Number(raw.nonGstNextNumber ?? defaultInvoiceNumberPrefs.nonGstNextNumber) || defaultInvoiceNumberPrefs.nonGstNextNumber),
  padding: Math.max(1, Number(raw.padding ?? defaultInvoiceNumberPrefs.padding) || defaultInvoiceNumberPrefs.padding),
  gstNumberWidth: Math.max(0, Number(raw.gstNumberWidth ?? raw.gstInvoiceNumberWidth) || 0),
  nonGstNumberWidth: Math.max(0, Number(raw.nonGstNumberWidth ?? raw.nonGstInvoiceNumberWidth) || 0)
});

const toInvoiceNumberPrefsDraft = (raw = {}) => {
  const clean = sanitizeInvoiceNumberPrefs(raw);
  return {
    ...clean,
    gstNextNumber: String(raw.gstNextNumber ?? raw.nextNumber ?? clean.gstNextNumber ?? ''),
    nonGstNextNumber: String(raw.nonGstNextNumber ?? clean.nonGstNextNumber ?? ''),
    padding: String(raw.padding ?? clean.padding ?? '')
  };
};

const extractInvoiceSeq = (invoiceNumber, prefix) => {
  const raw = String(invoiceNumber || '').trim();
  if (!raw) return null;
  if (prefix && raw.startsWith(prefix)) {
    const suffix = raw.slice(prefix.length).match(/(\d+)$/);
    if (suffix) return Number(suffix[1]);
  }
  const match = raw.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
};

const formatInvoiceSequence = (value, width = 0) => {
  const safeNumber = Math.max(1, Number(value) || 1);
  const digits = String(safeNumber);
  const minWidth = Math.max(0, Number(width) || 0);
  return minWidth > digits.length ? digits.padStart(minWidth, '0') : digits;
};

const normalizeInvoiceNumberKey = (value) => String(value || '').trim().toLowerCase();

const shell = {
  page: { background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.94) 100%)', border: '1px solid var(--color-border)', borderRadius: '20px', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)', overflow: 'visible', position: 'relative', backgroundClip: 'padding-box' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 18px', borderBottom: '1px solid var(--brand-border-color)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', backgroundClip: 'padding-box' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: 0, borderRadius: 0, background: 'transparent', border: 'none' },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937' },
  topActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  toolLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  paginationInfo: { fontSize: '12px', color: '#475569', fontWeight: 700 },
  customizeButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-primary-soft)', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '10px', width: '34px', height: '34px', padding: 0, fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)', transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '10px', padding: '9px 14px', background: '#6b7280', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' },
  buttonGhost: { border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', borderRadius: '12px', width: '48px', height: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  summaryWrap: { padding: '16px 18px', background: 'rgba(255,255,255,0.94)' },
  summaryCard: { display: 'grid', gap: '12px' },
  summaryTitle: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px' },
  summaryMetric: { border: '1px solid var(--color-border)', borderRadius: '16px', padding: '12px 14px', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,252,0.96) 100%)', minHeight: '96px', boxShadow: '0 10px 28px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.72)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' },
  summaryLabel: { color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.25 },
  summaryValue: { color: '#111827', fontSize: '24px', fontWeight: 800, lineHeight: 1.05 },
  summaryHint: { color: '#64748b', fontSize: '12px', fontWeight: 700, lineHeight: 1.35 },
  summaryAccent: { color: '#d97706' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', backgroundClip: 'padding-box' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  headCell: { textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280', padding: '10px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.25, minHeight: '42px', height: 'auto' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '10px 10px', fontSize: '8px', fontWeight: 400, color: '#111827', verticalAlign: 'top', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  invoiceCell: { color: 'var(--color-primary)', fontWeight: 400, textDecoration: 'underline dotted rgba(159,23,77,0.4)' },
  checkboxWrap: { width: '38px', textAlign: 'center' },
  resizableHeadCell: { position: 'relative', paddingRight: '18px' },
  headCellContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  statusBadge: { fontWeight: 700 },
  menu: { position: 'absolute', right: 16, top: '56px', background: '#fff', border: '1px solid var(--brand-border-color)', borderRadius: '12px', minWidth: '200px', boxShadow: '0 14px 32px rgba(15,23,42,0.12)', zIndex: 30, overflow: 'hidden' },
  menuButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  rowActionWrap: { position: 'relative', display: 'block', width: '100%', textAlign: 'left' },
  rowActionButton: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  rowActionMenu: { position: 'fixed', minWidth: '168px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 12px 26px rgba(15,23,42,0.14)', zIndex: 3500, overflow: 'hidden' },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--brand-border-color)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', width: '250px', zIndex: 30 },
  popoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '270px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto', backdropFilter: 'blur(12px)' },
  modal: { background: '#fff', width: 'min(100%, 1040px)', borderRadius: '16px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', height: 'auto', display: 'flex', flexDirection: 'column' },
  modalHeader: { height: '64px', minHeight: '64px', boxSizing: 'border-box', padding: '0 22px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '24px', lineHeight: 1.2, fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  modalHeaderTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  modalCloseButton: { border: 'none', background: 'transparent', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  formBody: { padding: '20px 24px', overflowY: 'auto', overflowX: 'hidden', display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: '14px', flex: 1, minHeight: 0 },
  customerRow: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', columnGap: '16px', rowGap: '12px', alignItems: 'center' },
  addressSplit: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' },
  addressCard: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px', background: '#fff' },
  addressHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', minHeight: '28px' },
  addressHeadActions: { display: 'flex', alignItems: 'center', gap: '6px' },
  addressHeadSpacer: { width: '28px', height: '28px', flex: '0 0 auto' },
  addressTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' },
  addressText: { margin: 0, fontSize: '13px', color: '#0f172a', lineHeight: 1.45, whiteSpace: 'pre-line' },
  addressPickerOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.28)', display: 'grid', placeItems: 'center', zIndex: 3200, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto' },
  addressPicker: { background: '#fff', width: 'min(100%, 720px)', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden' },
  addressPickerHead: { padding: '10px 12px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-primary)' },
  addressPickerTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' },
  addressPickerCloseButton: { border: 'none', background: 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 700, padding: '0 4px' },
  addressList: { padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px', maxHeight: '250px', overflowY: 'auto' },
  addressChoiceCard: {
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
    cursor: 'pointer',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,252,0.96) 100%)',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease'
  },
  addressChoiceCardActive: {
    background: 'linear-gradient(180deg, rgba(255,247,250,0.98) 0%, rgba(253,242,248,0.96) 100%)',
    borderColor: 'var(--color-primary)',
    boxShadow: '0 8px 22px rgba(159,23,77,0.12)',
    transform: 'translateY(-1px)'
  },
  addressChoiceTitle: { margin: 0, fontSize: '12px', fontWeight: 800, color: '#334155' },
  addressChoiceText: { margin: '4px 0 0 0', fontSize: '12px', color: '#0f172a', whiteSpace: 'pre-line' },
  addressEditor: { padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', columnGap: '10px', rowGap: '10px', alignItems: 'center' },
  supplyRow: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 150px minmax(0, 1fr)', columnGap: '16px', rowGap: '10px', alignItems: 'center' },
  topGrid: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 150px minmax(0, 1fr)', columnGap: '16px', rowGap: '12px', alignItems: 'center' },
  secondGrid: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 150px minmax(0, 1fr)', columnGap: '16px', rowGap: '12px', alignItems: 'center' },
  subjectRow: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', columnGap: '16px', rowGap: '12px', alignItems: 'center' },
  label: { fontSize: '12px', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' },
  labelRequired: { color: '#dc2626' },
  input: { border: '1px solid #D1D5DB', borderRadius: '11px', padding: '0 12px', fontSize: '14px', outline: 'none', width: '100%', minHeight: '40px', boxSizing: 'border-box' },
  textArea: { border: '1px solid #D1D5DB', borderRadius: '11px', padding: '10px 12px', fontSize: '14px', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' },
  inputWithAction: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 28px', gap: '0' },
  inputMainWithButton: { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' },
  inputActionButton: { border: '1px solid var(--color-primary)', borderRadius: '0 8px 8px 0', minHeight: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: 'var(--color-primary)', cursor: 'pointer' },
  miniCloseButton: { border: 'none', background: 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, width: '28px', height: '28px' },
  miniModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 3300, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto' },
  miniModal: { width: 'min(100%, 680px)', background: '#fff', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden' },
  miniModalHead: { padding: '14px 18px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-primary)', color: '#fff' },
  miniModalTitle: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#ffffff' },
  miniModalBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' },
  miniModalNote: { margin: 0, fontSize: '16px', color: '#1f2937', lineHeight: 1.4 },
  miniRadioRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 600, color: '#1f2937' },
  miniPrefsGrid: { display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: '12px', alignItems: 'end', paddingLeft: '30px' },
  miniFooter: { padding: '14px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '10px' },
  itemSection: { border: '1px solid #d1d5db', borderRadius: '12px', overflow: 'hidden', background: '#fff' },
  itemHead: { padding: '10px 12px', borderBottom: '1px solid #d1d5db', background: '#f8fafc', fontWeight: 800, fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  itemTableWrap: { width: '100%', overflowX: 'auto', overflowY: 'hidden' },
  itemTable: { width: '100%', minWidth: '860px', borderCollapse: 'collapse' },
  itemTh: { padding: '8px 10px', borderBottom: '1px solid #d1d5db', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' },
  itemTd: { padding: '8px 10px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', color: '#111827', verticalAlign: 'top' },
  itemMetaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', width: '100%' },
  itemMetaField: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, width: '100%' },
  itemMetaLabel: { fontSize: '11px', color: '#64748b', fontWeight: 700 },
  itemMetaInput: { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '0 10px', fontSize: '12px', outline: 'none', width: '100%', minWidth: 0, maxWidth: '100%', minHeight: '28px', height: '28px', boxSizing: 'border-box', display: 'block' },
  iconButton: { border: '1px solid var(--color-border)', borderRadius: '10px', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#475569', cursor: 'pointer' },
  tinyText: { fontSize: '11px', color: '#64748b', fontWeight: 700 },
  addRowBtn: { border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', padding: '0 11px', height: '34px', minHeight: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  actionLinkBtn: { border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  itemActionsRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
  newAddressBtn: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  copyBillingBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  totalsWrap: { marginTop: '8px', marginLeft: 'auto', width: '340px', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fafafa' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: '12px', color: '#334155', borderBottom: '1px solid var(--color-border)' },
  gstRowsWrap: { margin: 0, padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'grid', gap: '10px' },
  gstRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#111827' },
  taxControlRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', fontSize: '12px', color: '#334155', borderBottom: '1px solid var(--color-border)' },
  tinySelect: { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', outline: 'none', minWidth: '120px' },
  totalLast: { fontSize: '16px', fontWeight: 800, color: '#111827' },
  totalSummaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderTop: '1px solid var(--color-border)' },
  splitBottom: { display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '12px' },
  serviceScheduleBlock: { border: '1px solid var(--color-border)', borderRadius: '10px', background: '#f8fafc', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  serviceScheduleHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  serviceScheduleCount: { fontSize: '12px', color: '#475569', fontWeight: 700 },
  serviceScheduleTimeControl: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', fontWeight: 700 },
  serviceScheduleTableWrap: { border: '1px solid var(--color-primary-soft)', borderRadius: '8px', background: '#fff', overflow: 'auto' },
  serviceScheduleTable: { width: '100%', minWidth: '640px', borderCollapse: 'collapse' },
  serviceScheduleTh: { padding: '8px 10px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.2, minHeight: '42px', height: 'auto' },
  serviceScheduleTd: { padding: '8px 10px', fontSize: '12px', color: '#0f172a', borderBottom: '1px solid #eef2f7', verticalAlign: 'top' },
  serviceScheduleEmpty: { fontSize: '12px', color: '#64748b' },
  paymentBlock: { borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  paymentToggle: { display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#1f2937', fontWeight: 700 },
  paymentToggleGroup: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', alignItems: 'center' },
  paymentTableWrap: { border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' },
  paymentTable: { width: '100%', borderCollapse: 'collapse' },
  paymentTh: { padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#667085', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', textAlign: 'left' },
  paymentTd: { padding: '8px 12px', borderBottom: '1px solid #eef2f7' },
  paymentInput: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', outline: 'none', width: '100%', minHeight: '36px', boxSizing: 'border-box' },
  splitPaymentRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' },
  splitPaymentBtn: { border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0 },
  paymentTotals: { marginLeft: 'auto', minWidth: '300px', display: 'grid', gap: '6px' },
  paymentTotalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#111827', fontSize: '16px', fontWeight: 500 },
  paymentBalanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ef4444', fontSize: '16px', fontWeight: 700 },
  paymentWarn: { color: '#dc2626', fontSize: '12px', fontWeight: 700 },
  modalFooter: { height: '64px', minHeight: '64px', boxSizing: 'border-box', padding: '0 24px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', background: '#fff' },
  cancelButton: { minHeight: '40px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '12px', padding: '0 16px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { minHeight: '40px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '12px', padding: '0 16px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }
};

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDisplayDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const shortYearMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})(?:[T\s].*)?$/);
  if (shortYearMatch) {
    return `20${shortYearMatch[3]}-${String(shortYearMatch[2]).padStart(2, '0')}-${String(shortYearMatch[1]).padStart(2, '0')}`;
  }
  const parsed = parseDateOnly(raw);
  return parsed ? formatDateInput(parsed) : '';
};

const addMonthsClamped = (date, months) => {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const monthLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, monthLastDay));
  return next;
};

const normalizeTimeInput = (value, fallback = '10:00') => {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
};

const parseWeekdayValue = (value) => {
  const weekday = Number(value);
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : null;
};

const shiftDateToWeekday = (date, weekday) => {
  const cursor = new Date(date);
  const target = Number(weekday);
  if (!Number.isInteger(target) || target < 0 || target > 6) return cursor;
  const offset = (target - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + offset);
  return cursor;
};

const alignDatesToWeekday = (dates = [], weekday, endDate = null) => {
  const target = parseWeekdayValue(weekday);
  const aligned = (Array.isArray(dates) ? dates : [])
    .map((stamp) => {
      const date = parseDateOnly(stamp);
      if (!date || target === null) return '';
      return formatDateInput(shiftDateToWeekday(date, target));
    })
    .filter(Boolean)
    .filter((stamp) => {
      if (!endDate) return true;
      const date = parseDateOnly(stamp);
      return date ? date <= endDate : false;
    });
  return Array.from(new Set(aligned)).sort();
};

const buildServiceDatesByFrequency = (startDateStr, endDateStr, frequency, serviceWeekday = '', maxServices = 500) => {
  const cfg = serviceFrequencyConfig[frequency];
  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);
  if (!cfg || !start || !end || end < start) return [];
  const targetWeekday = parseWeekdayValue(serviceWeekday);

  if (cfg.type === 'single_once') {
    return targetWeekday === null
      ? [formatDateInput(start)]
      : alignDatesToWeekday([formatDateInput(start)], targetWeekday, end);
  }

  if (cfg.type === 'followup_days') {
    const dates = [formatDateInput(start)];
    const followup = new Date(start);
    followup.setDate(followup.getDate() + cfg.value);
    if (followup <= end) dates.push(formatDateInput(followup));
    return targetWeekday === null ? dates : alignDatesToWeekday(dates, targetWeekday, end);
  }

  if (cfg.type === 'followup_then_interval_months') {
    const dates = [formatDateInput(start)];
    const intervalMonths = Number(cfg.intervalMonths || 0);
    if (intervalMonths <= 0) return dates;
    const followup = new Date(start);
    followup.setDate(followup.getDate() + Number(cfg.followupDays || 0));
    if (followup <= end && dates.length < maxServices) {
      dates.push(formatDateInput(followup));
    }

    // Keep 4-month cadence anchored to contract start date.
    let cursor = new Date(start);
    while (dates.length < maxServices) {
      cursor = addMonthsClamped(cursor, intervalMonths);
      if (cursor > end) break;
      const nextDate = formatDateInput(cursor);
      if (!dates.includes(nextDate)) dates.push(nextDate);
    }
    return targetWeekday === null ? dates : alignDatesToWeekday(dates, targetWeekday, end);
  }

  if (frequency === 'weekly' && cfg.type === 'interval_days' && cfg.value === 7) {
    if (targetWeekday === null) {
      const dates = [formatDateInput(start)];
      let cursor = new Date(start);
      let guard = 1;
      while (cursor <= end && guard < maxServices) {
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + cfg.value);
        if (cursor > end) break;
        const nextDate = formatDateInput(cursor);
        if (!dates.includes(nextDate)) {
          dates.push(nextDate);
          guard += 1;
        }
      }
      return dates.length > 0 ? dates : [formatDateInput(start)];
    }

    const dates = [];
    const cursor = new Date(start);
    const offset = (targetWeekday - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + offset);
    while (cursor <= end && dates.length < maxServices) {
      const nextDate = formatDateInput(cursor);
      if (!dates.includes(nextDate)) {
        dates.push(nextDate);
      }
      cursor.setDate(cursor.getDate() + 7);
    }
    return alignDatesToWeekday(dates, targetWeekday, end);
  }

  const dates = [formatDateInput(start)];
  let cursor = new Date(start);
  let guard = 1;
  while (cursor <= end && guard < maxServices) {
    if (cfg.type === 'interval_days') {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + cfg.value);
    } else {
      cursor = addMonthsClamped(cursor, cfg.value);
    }
    if (cursor > end) break;
    const nextDate = formatDateInput(cursor);
    if (!dates.includes(nextDate)) {
      dates.push(nextDate);
      guard += 1;
    }
    if (cfg.maxServices && dates.length >= cfg.maxServices) break;
  }
  const baseDates = dates.length > 0 ? dates : [formatDateInput(start)];
  return targetWeekday === null ? baseDates : alignDatesToWeekday(baseDates, targetWeekday, end);
};

const countServicesByFrequency = (startDateStr, endDateStr, frequency, serviceWeekday = '') => {
  const dates = buildServiceDatesByFrequency(startDateStr, endDateStr, frequency, serviceWeekday);
  return dates.length > 0 ? String(dates.length) : '';
};

const buildServiceScheduleEntries = (items = [], defaultTime = '10:00') => {
  const normalizedTime = normalizeTimeInput(defaultTime, '10:00');
  const schedule = [];

  items.forEach((line, lineIndex) => {
    const lineStartDate = line.contractStartDate || line.serviceStartDate;
    const lineEndDate = line.contractEndDate || line.serviceEndDate;
    const contractPeriod = String(line.contractPeriod || '').trim();

    if (['single_time_plus_7', 'single_time_plus_10'].includes(contractPeriod)) {
      [lineStartDate, lineEndDate].filter(Boolean).forEach((serviceDate, serviceIndex) => {
        schedule.push({
          key: `${lineIndex}-${line.itemId || line.itemName || 'line'}-${serviceIndex + 1}`,
          itemId: line.itemId || '',
          itemName: line.itemName || `Item ${lineIndex + 1}`,
          itemDescription: line.frequency || line.description || '',
          serviceNumber: serviceIndex + 1,
          serviceDate,
          serviceTime: normalizedTime
        });
      });
      return;
    }

    const baseDates = buildServiceDatesByFrequency(
      lineStartDate,
      lineEndDate,
      line.serviceFrequency,
      line.serviceWeekday
    );
    if (baseDates.length === 0) return;

    const requestedServices = Number(line.totalServices || 0);
    const dates = Number.isFinite(requestedServices) && requestedServices > 0
      ? baseDates.slice(0, requestedServices)
      : baseDates;
    const anchoredStartDate = String(lineStartDate || '').trim();

    dates.forEach((serviceDate, serviceIndex) => {
      schedule.push({
        key: `${lineIndex}-${line.itemId || line.itemName || 'line'}-${serviceIndex + 1}`,
        itemId: line.itemId || '',
        itemName: line.itemName || `Item ${lineIndex + 1}`,
        itemDescription: line.frequency || line.description || '',
        serviceNumber: serviceIndex + 1,
        serviceDate: serviceIndex === 0 && anchoredStartDate ? anchoredStartDate : serviceDate,
        serviceTime: normalizedTime
      });
    });
  });

  return schedule.sort((a, b) => {
    const aStamp = `${a.serviceDate || ''}T${a.serviceTime || '00:00'}`;
    const bStamp = `${b.serviceDate || ''}T${b.serviceTime || '00:00'}`;
    if (aStamp === bStamp) {
      return String(a.itemName || '').localeCompare(String(b.itemName || ''));
    }
    return aStamp.localeCompare(bStamp);
  });
};

const withContractSchedule = (line) => {
  const window = buildContractWindow(line.contractStartDate, line.contractPeriod);
  if (!window.contractEndDate) {
    return {
      ...line,
      contractEndDate: '',
      renewalDate: '',
      totalServices: ''
    };
  }

  const plan = buildServiceSchedulePlan({
    draft: {
      startDate: window.contractStartDate,
      endDate: window.contractEndDate,
      contractPeriod: line.contractPeriod,
      frequency: line.serviceFrequency,
      preferredDay: line.serviceWeekday
    },
    defaultTime: '10:00',
    itemMeta: {}
  });

  return {
    ...line,
    contractEndDate: window.contractEndDate,
    renewalDate: window.renewalDate,
    totalServices: String(plan.totalServices || '')
  };
};

const addDays = (dateStr, days) => {
  const date = parseDateOnly(dateStr) || new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const getStatusColor = (status) => {
  if (status === 'PAID') return '#16a34a';
  if (status === 'DRAFT') return '#64748b';
  if (status === 'OVERDUE') return '#dc2626';
  return 'var(--color-primary-dark)';
};

const parsePercent = (value) => {
  const n = Number(String(value || '').replace('%', '').trim());
  return Number.isFinite(n) ? n : 0;
};

const sumPaymentSplits = (splits = []) =>
  Number(
    splits
      .reduce((sum, split) => {
        const amount = Number(split?.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return sum;
        return sum + amount;
      }, 0)
      .toFixed(2)
  );

const withholdingRates = [0, 1, 2, 5, 10];

const buildAddressText = (customer, source, fallbackText = '') => {
  const fallback = String(fallbackText || '').trim();
  if (!customer) return fallback || 'No customer selected';
  if (String(source || '').startsWith('premise:')) {
    const premiseId = String(source).replace('premise:', '');
    const premise = (customer.premises || []).find((entry) => String(entry.premiseId || entry.premise_id || '') === premiseId);
    if (premise) {
      const resolvedPremise = addressOptionText(premiseToAddressOption(premise));
      if (resolvedPremise && resolvedPremise !== 'No address selected') return resolvedPremise;
    }
    return fallback || 'No address selected';
  }
  const prefix = source === 'shipping' ? 'shipping' : 'billing';
  const displayName = customer.displayName || customer.name || '';
  const street1 = customer[`${prefix}Street1`] || customer[`${prefix}Address`] || '';
  const area = customer[`${prefix}Area`] || '';
  const statePin = [customer[`${prefix}State`], customer[`${prefix}Pincode`]].filter(Boolean).join(' ');
  const resolved = [displayName, street1, area, statePin].filter(Boolean).join('\n');
  return resolved || fallback || 'No address selected';
};

const buildAddressOption = (id, label, customer, prefix) => {
  const fallbackPrefix = prefix === 'billing' ? 'shipping' : 'billing';
  return {
    id,
    label,
    company: customer?.displayName || customer?.name || '',
    street1:
      customer?.[`${prefix}Street1`]
      || customer?.[`${prefix}Address`]
      || customer?.[`${fallbackPrefix}Street1`]
      || customer?.[`${fallbackPrefix}Address`]
      || '',
    line1:
      customer?.[`${prefix}Address`]
      || customer?.[`${prefix}Street1`]
      || customer?.[`${fallbackPrefix}Address`]
      || customer?.[`${fallbackPrefix}Street1`]
      || '',
    area: customer?.[`${prefix}Area`] || customer?.[`${fallbackPrefix}Area`] || '',
    state: customer?.[`${prefix}State`] || customer?.[`${fallbackPrefix}State`] || '',
    pincode: customer?.[`${prefix}Pincode`] || customer?.[`${fallbackPrefix}Pincode`] || '',
    gstin: customer?.gstNumber || '',
    placeOfSupply: normalizeGstState(
      customer?.[`${prefix}State`]
      || customer?.[`${fallbackPrefix}State`]
      || customer?.state
      || ''
    )
  };
};

const premiseToAddressOption = (premise = {}) => ({
  id: `premise:${premise.premiseId || premise.premise_id || ''}`,
  premiseId: premise.premiseId || premise.premise_id || '',
  label: premise.premiseLabel || premise.premise_label || 'Premise',
  company: premise.contactPerson || '',
  street1: premise.address || '',
  line1: premise.address || '',
  area: premise.areaName || premise.area_name || '',
  city: premise.city || '',
  state: premise.state || '',
  pincode: premise.pincode || '',
  gstNumber: premise.gstNumber || premise.gst_number || '',
  placeOfSupply: normalizeGstState(premise.placeOfSupply || premise.place_of_supply || premise.state || ''),
  googleMapUrl: premise.googleMapUrl || premise.google_map_url || '',
  premiseType: premise.premiseType || premise.premise_type || 'Service',
  isDefault: Boolean(premise.isDefault || premise.is_default),
  isBilling: Boolean(premise.isBilling || premise.is_billing),
  isShipping: Boolean(premise.isShipping || premise.is_shipping)
});

const addressOptionText = (option) => {
  if (!option) return 'No address selected';
  const displayName = option.company || '';
  const street1 = option.street1 || option.line1 || '';
  const area = option.area || '';
  const statePin = [option.state, option.pincode].filter(Boolean).join(' ');
  return [displayName, street1, area, statePin].filter(Boolean).join('\n');
};

const displayAddressLabel = (option) => {
  const rawLabel = String(option?.label || '').trim();
  if (!rawLabel) return 'Address';
  if (option?.id === 'billing') return 'Main Billing Address';
  if (option?.id === 'shipping') return 'Main Shipping Address';
  if (option?.id?.startsWith('premise:') && /^billing address$/i.test(rawLabel)) return 'Saved Billing Address';
  if (option?.id?.startsWith('premise:') && /^shipping address$/i.test(rawLabel)) return 'Saved Shipping Address';
  return rawLabel;
};

const normalizeAddressOptionSignature = (option) => {
  const label = String(option?.label || '').trim().toLowerCase();
  const text = addressOptionText(option)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return `${label}|${text}`;
};

const dedupeAddressOptions = (options = []) => {
  const seen = new Set();
  return options.filter((option) => {
    const signature = normalizeAddressOptionSignature(option);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

const getAddressDisplayText = (option, fallbackText = '') => {
  const resolved = addressOptionText(option);
  if (resolved !== 'No address selected') return resolved;
  const fallback = String(fallbackText || '').trim();
  return fallback || 'No address selected';
};

const findAddressOptionByText = (options = [], addressText = '') => {
  const target = String(addressText || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!target) return null;
  return options.find((option) => {
    const candidate = addressOptionText(option).trim().toLowerCase().replace(/\s+/g, ' ');
    return candidate && candidate === target;
  }) || null;
};

const getEmployeeDisplayName = (employee = {}) => {
  const first = String(employee.firstName || '').trim();
  const last = String(employee.lastName || '').trim();
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  return String(employee.name || employee.empCode || '').trim();
};

const normalizeInvoiceType = (value) => (String(value || '').trim().toUpperCase() === 'NON GST' ? 'NON GST' : 'GST');
const toSixDigitPincode = (value) => String(value || '').replace(/\D+/g, '').slice(0, 6);

const invoiceColumnWidthStorageKey = 'invoice_column_widths';
const invoiceDefaultColumnWidths = {
  date: 130,
  invoiceNumber: 160,
  customerName: null,
  dueDate: 130,
  amount: 130,
  balanceDue: 140,
  status: 110,
  action: 90
};
const invoiceColumnResizeBounds = {
  date: { min: 110, max: 220 },
  invoiceNumber: { min: 120, max: 260 },
  customerName: { min: 220, max: 640 },
  dueDate: { min: 110, max: 220 },
  amount: { min: 100, max: 180 },
  balanceDue: { min: 110, max: 200 },
  status: { min: 90, max: 160 },
  action: { min: 80, max: 140 }
};

const normalizeInvoiceColumnWidths = (raw = {}) => {
  const next = {};
  Object.entries(invoiceDefaultColumnWidths).forEach(([key, fallback]) => {
    const bounds = invoiceColumnResizeBounds[key] || { min: 80, max: 640 };
    if (key === 'customerName') {
      const rawValue = Number(raw[key]);
      next[key] = Number.isFinite(rawValue) && rawValue >= bounds.min ? Math.min(Math.max(Math.round(rawValue), bounds.min), bounds.max) : fallback;
      return;
    }
    const rawValue = Number(raw[key]);
    next[key] = Number.isFinite(rawValue) && rawValue >= bounds.min ? Math.min(Math.max(Math.round(rawValue), bounds.min), bounds.max) : fallback;
  });
  return next;
};

const getInvoiceColumnResizeBounds = (columnKey) => invoiceColumnResizeBounds[columnKey] || { min: 80, max: 640 };

const emptyAddressDraft = {
  label: 'Additional Address',
  company: '',
  line1: '',
  city: '',
  area: '',
  state: 'Delhi',
  pincode: '',
  gstin: '',
};

const normalizeRouteReference = (value) => String(value || '').trim().toLowerCase();

const matchesInvoiceReference = (invoice, reference) => {
  const target = normalizeRouteReference(reference);
  if (!target) return false;
  return [
    invoice?._id,
    invoice?.external_id,
    invoice?.invoiceNumber,
    invoice?.invoice_number,
    invoice?.contractNumber,
    invoice?.contractNo
  ].some((candidate) => normalizeRouteReference(candidate) === target);
};

function CompactCalendarDateInput({ value, onChange, style, ariaLabel, readOnly = false }) {
  const handlePaste = (event) => {
    if (readOnly || typeof onChange !== 'function') return;
    const pasted = String(event.clipboardData?.getData('text') || '').trim();
    if (!pasted) return;
    const normalized = normalizeDateInput(pasted);
    if (!normalized) return;
    event.preventDefault();
    onChange({ target: { value: normalized } });
  };

  return (
    <input
      type="date"
      style={style}
      value={value || ''}
      onChange={onChange}
      onPaste={handlePaste}
      readOnly={readOnly}
      aria-label={ariaLabel}
    />
  );
}

const getServiceScheduleItemMeta = (invoiceForm = emptyForm) => {
  const firstLine = Array.isArray(invoiceForm.items) ? (invoiceForm.items[0] || {}) : {};
  return {
    itemId: firstLine.itemId || '',
    itemName: firstLine.itemName || firstLine.frequency || 'Service Visit',
    itemDescription: firstLine.frequency || firstLine.description || ''
  };
};

export default function InvoiceDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeInvoiceParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const cachedInvoiceState = useMemo(() => readInvoiceDashboardCache(), []);
  const routeModalRequest = Boolean(
    location.state?.openInvoiceNumberPrefs
      || location.state?.openNewInvoice
      || location.state?.openInvoiceId
      || String(location.state?.openInvoiceNumber || '').trim()
      || routeInvoiceParams.get('openInvoiceNumberPrefs')
      || routeInvoiceParams.get('openNewInvoice')
      || routeInvoiceParams.get('openInvoiceId')
      || String(routeInvoiceParams.get('openInvoiceNumber') || '').trim()
  );
  const routeFromContract = Boolean(location.state?.fromContract) || ['1', 'true', 'yes'].includes(String(routeInvoiceParams.get('fromContract') || '').toLowerCase());
  const routeEditContract = Boolean(location.state?.editContract) || ['1', 'true', 'yes'].includes(String(routeInvoiceParams.get('editContract') || '').toLowerCase());
  const routeViewContract = Boolean(location.state?.viewContract) || ['1', 'true', 'yes'].includes(String(routeInvoiceParams.get('viewContract') || '').toLowerCase());
  const contractViewOnly = routeViewContract && !routeEditContract;
  const routeOpenInvoiceNumberPrefs = Boolean(location.state?.openInvoiceNumberPrefs) || ['1', 'true', 'yes'].includes(String(routeInvoiceParams.get('openInvoiceNumberPrefs') || '').toLowerCase());
  const routeOpenNewInvoice = Boolean(location.state?.openNewInvoice) || ['1', 'true', 'yes'].includes(String(routeInvoiceParams.get('openNewInvoice') || '').toLowerCase());
  const routeOpenInvoiceId = String(location.state?.openInvoiceId || routeInvoiceParams.get('openInvoiceId') || '').trim();
  const routeOpenInvoiceNumber = String(location.state?.openInvoiceNumber || routeInvoiceParams.get('openInvoiceNumber') || '').trim();
  const routeHasQueryParams = Boolean(
    routeInvoiceParams.get('openInvoiceNumberPrefs')
      || routeInvoiceParams.get('openNewInvoice')
      || routeInvoiceParams.get('openInvoiceId')
      || routeInvoiceParams.get('openInvoiceNumber')
      || routeInvoiceParams.get('fromContract')
      || routeInvoiceParams.get('editContract')
      || routeInvoiceParams.get('viewContract')
  );
  const savedNewContractDraft = readInvoiceDraftCache();
  const canRestoreNewContractDraft = Boolean(
    savedNewContractDraft?.showModal
      && !routeOpenInvoiceId
      && !routeOpenInvoiceNumber
      && !routeOpenInvoiceNumberPrefs
  );
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [invoices, setInvoices] = useState(() => cachedInvoiceState?.invoices || []);
  const [payments, setPayments] = useState(() => cachedInvoiceState?.payments || []);
  const [customers, setCustomers] = useState(() => cachedInvoiceState?.customers || []);
  const [customerPremises, setCustomerPremises] = useState({});
  const [itemsCatalog, setItemsCatalog] = useState(() => cachedInvoiceState?.itemsCatalog || []);
  const [employees, setEmployees] = useState(() => cachedInvoiceState?.employees || []);
  const [leadSourceOptions, setLeadSourceOptions] = useState(() => [...DEFAULT_LEAD_SOURCES]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [invoiceSort, setInvoiceSort] = useState({ key: 'date', direction: 'desc' });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showBillingAddressPicker, setShowBillingAddressPicker] = useState(false);
  const [showShippingAddressPicker, setShowShippingAddressPicker] = useState(false);
  const [editingShippingAddressId, setEditingShippingAddressId] = useState('');
  const [addressDraftTarget, setAddressDraftTarget] = useState('shipping');
  const [shippingAddressDraft, setShippingAddressDraft] = useState(emptyAddressDraft);
  const [showModal, setShowModal] = useState(() => canRestoreNewContractDraft);
  const [modalOpenedFromContract, setModalOpenedFromContract] = useState(() => Boolean(
    canRestoreNewContractDraft
      ? savedNewContractDraft?.modalOpenedFromContract
      : routeFromContract || routeEditContract || routeViewContract
  ));
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showInvoiceNumberPrefs, setShowInvoiceNumberPrefs] = useState(false);
  const [invoiceNumberPrefs, setInvoiceNumberPrefs] = useState(defaultInvoiceNumberPrefs);
  const [invoiceNumberPrefsDraft, setInvoiceNumberPrefsDraft] = useState(() => toInvoiceNumberPrefsDraft(defaultInvoiceNumberPrefs));
  const [companySettings, setCompanySettings] = useState({});
  const [settingsHydrated, setSettingsHydrated] = useState(Boolean(cachedInvoiceState));
  const [invoicesHydrated, setInvoicesHydrated] = useState(Boolean(cachedInvoiceState));
  const [invoicesLoadedFromApi, setInvoicesLoadedFromApi] = useState(false);
  const [form, setForm] = useState(() => (canRestoreNewContractDraft && savedNewContractDraft?.form ? savedNewContractDraft.form : emptyForm));
  const [serviceScheduleDraft, setServiceScheduleDraft] = useState(() => (
    canRestoreNewContractDraft && savedNewContractDraft?.serviceScheduleDraft
      ? savedNewContractDraft.serviceScheduleDraft
      : buildServiceScheduleDraftFromInvoice(emptyForm, '10:00')
  ));
  const [serviceScheduleRows, setServiceScheduleRows] = useState(() => (
    canRestoreNewContractDraft ? savedNewContractDraft?.serviceScheduleRows || null : null
  ));
  const [serviceScheduleExpanded, setServiceScheduleExpanded] = useState(() => (
    canRestoreNewContractDraft ? Boolean(savedNewContractDraft?.serviceScheduleExpanded) : false
  ));
  const [serviceScheduleErrors, setServiceScheduleErrors] = useState({});
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', invoiceId: '' });
  const [invoiceColumnWidths, setInvoiceColumnWidths] = useState(() => {
    const saved = localStorage.getItem(invoiceColumnWidthStorageKey);
    if (!saved) return normalizeInvoiceColumnWidths();
    try {
      return normalizeInvoiceColumnWidths(JSON.parse(saved));
    } catch {
      return normalizeInvoiceColumnWidths();
    }
  });
  const [resizingInvoiceColumn, setResizingInvoiceColumn] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (Array.isArray(cachedInvoiceState?.visibleColumns) && cachedInvoiceState.visibleColumns.length > 0) {
      return normalizeInvoiceVisibleColumns(cachedInvoiceState.visibleColumns);
    }
    const saved = localStorage.getItem('invoice_visible_columns');
    if (!saved) return [...defaultInvoiceVisibleColumns];
    try {
      return normalizeInvoiceVisibleColumns(JSON.parse(saved));
    } catch {
      return [...defaultInvoiceVisibleColumns];
    }
  });

  const handleInvoiceActionError = (error, fallbackMessage) => {
    const responseMessage = String(error?.response?.data?.error || error?.message || '').trim();
    const isUnauthorized = error?.response?.status === 401 || responseMessage.toLowerCase() === 'unauthorized';

    if (isUnauthorized) {
      clearPortalUser();
      setSaveError('Session expired. Please sign in again to continue.');
      navigate('/', { replace: true });
      return;
    }

    setSaveError(responseMessage || fallbackMessage);
  };
  const preventRateStepper = (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
    }
  };

  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const invoiceResizeStateRef = useRef(null);
  const invoicesLoadRef = useRef(false);
  const masterDataLoadRef = useRef(false);
  const termsAutoSeededRef = useRef(false);
  const invoiceNumberAutoSeededRef = useRef(false);
  const invoiceNumberManuallyEditedRef = useRef(false);

  const visibleColumnDefs = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );
  const isCompactInvoiceViewport = viewportWidth > 900 && viewportWidth <= 1199;
  const getInvoiceColumnWidth = (columnKey) => {
    if (columnKey === 'checkbox') return shell.checkboxWrap.width;
    const stored = invoiceColumnWidths[columnKey];
    if (columnKey === 'customerName') {
      return Number.isFinite(Number(stored)) && Number(stored) >= 0 ? Number(stored) || null : invoiceDefaultColumnWidths.customerName;
    }
    if (Number.isFinite(Number(stored)) && Number(stored) > 0) return Math.round(Number(stored));
    return invoiceDefaultColumnWidths[columnKey] ?? null;
  };
  const getColumnAlign = (columnKey) => {
    if (columnKey === 'checkbox') return 'center';
    if (columnKey === 'status') return 'left';
    if (columnKey === 'action') return 'center';
    return 'left';
  };
  const getColumnStyle = (columnKey) => {
    const width = getInvoiceColumnWidth(columnKey);
    const align = getColumnAlign(columnKey);
    if (columnKey === 'customerName') {
      if (Number.isFinite(width) && width > 0) {
        return {
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
          textAlign: align
        };
      }
      return {
        minWidth: `${invoiceColumnResizeBounds.customerName.min}px`,
        textAlign: align
      };
    }
    if (Number.isFinite(width) && width > 0) {
      return {
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        textAlign: align,
        fontVariantNumeric: columnKey === 'date' || columnKey === 'dueDate' || columnKey === 'amount' || columnKey === 'balanceDue' ? 'tabular-nums' : undefined
      };
    }
    return {
      textAlign: align
    };
  };

  useEffect(() => {
    localStorage.setItem(invoiceColumnWidthStorageKey, JSON.stringify(normalizeInvoiceColumnWidths(invoiceColumnWidths)));
  }, [invoiceColumnWidths]);

  useEffect(() => {
    const handleResizeMove = (event) => {
      const session = invoiceResizeStateRef.current;
      if (!session) return;
      event.preventDefault();
      const bounds = getInvoiceColumnResizeBounds(session.columnKey);
      const nextWidth = Math.min(bounds.max, Math.max(bounds.min, Math.round(session.startWidth + (event.clientX - session.startX))));
      setInvoiceColumnWidths((prev) => ({
        ...prev,
        [session.columnKey]: nextWidth
      }));
    };
    const handleResizeEnd = () => {
      if (!invoiceResizeStateRef.current) return;
      invoiceResizeStateRef.current = null;
      setResizingInvoiceColumn('');
    };
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd);
    window.addEventListener('pointercancel', handleResizeEnd);
    return () => {
      window.removeEventListener('pointermove', handleResizeMove);
      window.removeEventListener('pointerup', handleResizeEnd);
      window.removeEventListener('pointercancel', handleResizeEnd);
    };
  }, []);

  const startInvoiceColumnResize = (columnKey, event) => {
    if (isMobile) return;
    const target = event.currentTarget?.closest('th');
    const fallbackWidth = getInvoiceColumnWidth(columnKey);
    const measuredWidth = target?.getBoundingClientRect?.().width;
    const startWidth = Number.isFinite(measuredWidth) && measuredWidth > 0
      ? measuredWidth
      : Number.isFinite(fallbackWidth) && fallbackWidth > 0
        ? fallbackWidth
        : invoiceColumnResizeBounds[columnKey]?.min || 120;
    invoiceResizeStateRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth
    };
    setResizingInvoiceColumn(columnKey);
    event.preventDefault();
    event.stopPropagation();
  };
  const resetInvoiceColumnWidths = () => {
    const reset = normalizeInvoiceColumnWidths();
    setInvoiceColumnWidths(reset);
    localStorage.removeItem(invoiceColumnWidthStorageKey);
    setShowCustomize(false);
  };

  const customerOptions = useMemo(
    () => {
      const options = [];
      const seen = new Set();
      customers.forEach((customer) => {
        const aliases = [
          customer?.displayName,
          customer?.name,
          customer?.companyName
        ];
        aliases.forEach((alias) => {
          const value = String(alias || '').trim();
          if (!value) return;
          const signature = `${String(customer?._id || '').trim()}::${value.toLowerCase()}`;
          if (seen.has(signature)) return;
          seen.add(signature);
          options.push({ id: customer._id, name: value });
        });
      });
      return options.sort((left, right) => {
        const leftName = String(left.name || '').trim().toLowerCase();
        const rightName = String(right.name || '').trim().toLowerCase();
        if (!leftName && !rightName) return 0;
        if (!leftName) return 1;
        if (!rightName) return -1;
        const nameCompare = leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;
        return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'variant' });
      });
    },
    [customers]
  );
  const customerNameDatalistId = 'invoice-customer-name-options';
  const selectedCustomer = useMemo(
    () => {
      const customer = customers.find((entry) => entry._id === form.customerId) || null;
      if (!customer) return null;
      return { ...customer, premises: customerPremises[customer._id] || [] };
    },
    [customers, customerPremises, form.customerId]
  );
  const billingAddressOptions = useMemo(
    () => {
      const premises = (selectedCustomer?.premises || []).map(premiseToAddressOption);
      return dedupeAddressOptions([
        buildAddressOption('billing', 'Billing Address', selectedCustomer, 'billing'),
        buildAddressOption('shipping', 'Shipping Address', selectedCustomer, 'shipping'),
        ...premises
      ]);
    },
    [selectedCustomer]
  );
  const selectedBillingAddress = useMemo(
    () => {
      const found = billingAddressOptions.find((address) => address.id === form.billingAddressSource);
      if (found) return found;
      const matchedByText = findAddressOptionByText(billingAddressOptions, form.billingAddressText || form.premiseAddress);
      if (matchedByText) return matchedByText;
      return form.billingAddressSource ? null : (billingAddressOptions[0] || null);
    },
    [billingAddressOptions, form.billingAddressSource, form.billingAddressText, form.premiseAddress]
  );
  const shippingAddressOptions = useMemo(() => {
    const base = [
      buildAddressOption('shipping', 'Shipping Address', selectedCustomer, 'shipping')
    ];
    const premises = (selectedCustomer?.premises || []).map(premiseToAddressOption);
    const shippingPremises = premises.filter(
      (entry) => entry.isShipping || entry.isDefault || entry.premiseType !== 'Billing'
    );
    const custom = (form.customShippingAddresses || []).map((address, idx) => ({
      ...address,
      street1: address.street1 || address.line1 || '',
      placeOfSupply: normalizeGstState(address.state || ''),
      id: `custom-${idx}`
    }));
    return dedupeAddressOptions([...base, ...shippingPremises, ...custom]);
  }, [selectedCustomer, form.customShippingAddresses]);
  const selectedShippingAddress = useMemo(
    () => {
      const found = shippingAddressOptions.find((address) => address.id === form.shippingAddressSource);
      if (found) return found;
      const matchedByText = findAddressOptionByText(shippingAddressOptions, form.shippingAddressText || form.premiseAddress);
      if (matchedByText) return matchedByText;
      return form.shippingAddressSource ? null : (shippingAddressOptions[0] || null);
    },
    [shippingAddressOptions, form.shippingAddressSource, form.shippingAddressText, form.premiseAddress]
  );

  useEffect(() => {
    const customerId = String(form.customerId || '').trim();
    if (!customerId) return;
    if (customerPremises[customerId]) return;

    let alive = true;
    axios.get(`${API_BASE_URL}/api/customers/${customerId}/premises`)
      .then((res) => {
        if (!alive) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setCustomerPremises((prev) => ({ ...prev, [customerId]: rows }));
      })
      .catch((error) => {
        if (!alive) return;
        console.error('Failed to load customer premises', error);
      });

    return () => {
      alive = false;
    };
  }, [form.customerId, customerPremises]);

  const salespersonOptions = useMemo(() => {
    const team = Array.isArray(employees) ? employees : [];
    const salesTeam = team.filter((employee) => String(employee.role || '').toLowerCase().includes('sales'));
    const source = salesTeam.length > 0 ? salesTeam : team;
    const names = new Set();
    source.forEach((employee) => {
      const person = getEmployeeDisplayName(employee);
      if (person) names.add(person);
    });
    return Array.from(names);
  }, [employees]);
  const sortedItemsCatalog = useMemo(() => (
    [...itemsCatalog].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
  ), [itemsCatalog]);
  const serviceScheduleItemMeta = useMemo(() => getServiceScheduleItemMeta(form), [form.items]);

  const serviceScheduleTime = useMemo(
    () => normalizeServiceScheduleTime(form.serviceScheduleDefaultTime, '10:00'),
    [form.serviceScheduleDefaultTime]
  );
  const serviceScheduleSourceLine = useMemo(
    () => {
      if (!Array.isArray(form.items)) return null;
      return form.items.find((line) => (
        String(line?.contractStartDate || '').trim()
        || String(line?.contractEndDate || '').trim()
        || String(line?.serviceFrequency || '').trim()
        || String(line?.serviceWeekday || '').trim()
      )) || form.items[0] || null;
    },
    [form.items]
  );
  const liveServiceScheduleDraft = useMemo(
    () => buildServiceScheduleDraftFromInvoice({
      ...form,
      items: Array.isArray(form.items) ? form.items : [],
      serviceScheduleDefaultTime: form.serviceScheduleDefaultTime || '10:00'
    }, serviceScheduleTime),
    [form, serviceScheduleTime]
  );
  const liveMultiItemScheduleRows = useMemo(
    () => buildServiceScheduleEntries(Array.isArray(form.items) ? form.items : [], serviceScheduleTime).map((row, index) => ({
      serviceNumber: index + 1,
      baseServiceDate: row.serviceDate || '',
      preferredDay: '',
      preferredDayLabel: 'Normal dates',
      serviceDate: row.serviceDate || '',
      finalServiceDate: row.serviceDate || '',
      serviceTime: row.serviceTime || serviceScheduleTime,
      itemId: row.itemId || '',
      itemName: row.itemName || '',
      itemDescription: row.itemDescription || '',
      scheduleRuleLabel: '',
      status: 'Scheduled'
    })),
    [form.items, serviceScheduleTime]
  );

  const computeTotals = (lines, invoiceType = 'GST') => {
    const nonGst = normalizeInvoiceType(invoiceType) === 'NON GST';
    let subtotal = 0;
    let totalTax = 0;
    lines.forEach((line) => {
      const qty = parseDecimalNumber(line.quantity, 0);
      const rate = parseDecimalNumber(line.rate, 0);
      const taxRate = parseDecimalNumber(line.taxRate, 0);
      if (!Number.isFinite(qty) || !Number.isFinite(rate) || qty <= 0 || rate < 0) return;
      const lineBase = qty * rate;
      const lineTax = nonGst ? 0 : (lineBase * taxRate) / 100;
      subtotal += lineBase;
      totalTax += lineTax;
    });
    const total = subtotal + totalTax;
    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  };

  const applyComputedTotals = (nextForm) => {
    const totals = computeTotals(nextForm.items, nextForm.invoiceType);
    const withholdingRate = Number(nextForm.withholdingRate || 0);
    const withholdingAmount = Number(((totals.subtotal * withholdingRate) / 100).toFixed(2));
    const discount = Number(nextForm.discount || 0);
    const roundOff = Number(nextForm.roundOff || 0);
    const grandTotal = Number((totals.total - withholdingAmount - discount + roundOff).toFixed(2));
    const status = (nextForm.status || 'DRAFT').toUpperCase();
    const paymentSplits = Array.isArray(nextForm.paymentSplits) && nextForm.paymentSplits.length > 0
      ? nextForm.paymentSplits
      : [createEmptyPaymentSplit(getDefaultPaymentDepositTo(nextForm.invoiceType))];
    const paymentReceivedTotal = nextForm.paymentReceivedEnabled ? sumPaymentSplits(paymentSplits) : 0;
    const paymentBalance = Number((grandTotal - paymentReceivedTotal).toFixed(2));
    const nextBalance = nextForm.paymentReceivedEnabled
      ? Number(Math.max(paymentBalance, 0).toFixed(2))
      : status === 'PAID'
        ? 0
        : Number(grandTotal || 0);
    const nextStatus = nextForm.paymentReceivedEnabled
      ? nextBalance === 0 && grandTotal > 0
        ? 'PAID'
        : paymentReceivedTotal > 0 || status === 'PAID'
          ? 'SENT'
          : status
      : status;
    return {
      ...nextForm,
      subtotal: String(totals.subtotal),
      totalTax: String(totals.totalTax),
      amount: String(grandTotal),
      total: String(grandTotal),
      withholdingAmount: String(withholdingAmount),
      discount: String(nextForm.discount ?? ''),
      roundOff: String(nextForm.roundOff ?? ''),
      paymentSplits,
      paymentReceivedTotal: String(paymentReceivedTotal),
      status: nextStatus,
      balanceDue: String(nextBalance)
    };
  };

  const createNextInvoiceNumber = (prefs = invoiceNumberPrefs, invoiceType = form?.invoiceType || 'GST') => {
    const safePrefs = sanitizeInvoiceNumberPrefs(prefs);
    const normalizedType = normalizeInvoiceType(invoiceType);
    const prefix = normalizedType === 'NON GST' ? safePrefs.nonGstPrefix : safePrefs.gstPrefix;
    const nextNumber = normalizedType === 'NON GST' ? safePrefs.nonGstNextNumber : safePrefs.gstNextNumber;
    const numberWidth = normalizedType === 'NON GST' ? safePrefs.nonGstNumberWidth : safePrefs.gstNumberWidth;
    const usedNumbers = new Set(
      invoices
        .map((invoice) => normalizeInvoiceNumberKey(invoice?.invoiceNumber))
        .filter(Boolean)
    );
    let candidate = Math.max(1, Number(nextNumber) || 1);
    let guard = 0;
    while (guard < 100000) {
      const invoiceNumber = `${prefix}${formatInvoiceSequence(candidate, numberWidth)}`;
      if (!usedNumbers.has(normalizeInvoiceNumberKey(invoiceNumber))) return invoiceNumber;
      candidate += 1;
      guard += 1;
    }
    return `${prefix}${formatInvoiceSequence(candidate, numberWidth)}`;
  };

  const addPdfCacheBust = (url, stamp = Date.now()) => {
    const base = String(url || '').trim();
    if (!base) return '';
    try {
      const parsed = new URL(base, window.location.origin);
      parsed.searchParams.set('_v', String(stamp));
      return parsed.toString();
    } catch {
      const separator = base.includes('?') ? '&' : '?';
      return `${base}${separator}_v=${encodeURIComponent(String(stamp))}`;
    }
  };

  const getDefaultTermsForInvoiceType = (invoiceType) => {
    const normalized = normalizeInvoiceType(invoiceType);
    if (normalized === 'NON GST') {
      return String(companySettings.nonGstTermsAndConditions || '').trim();
    }
    return String(companySettings.gstTermsAndConditions || '').trim();
  };

  const loadInvoices = async (options = {}) => {
    if (invoicesLoadRef.current) return;
    invoicesLoadRef.current = true;
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/invoices`),
        axios.get(`${API_BASE_URL}/api/payments`)
      ]);
      const nextInvoices = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];
      const nextPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
      setInvoices(nextInvoices);
      setPayments(nextPayments);
      if (!options.preserveSelection) setSelectedIds([]);
      if (!options.preservePage) setPage(1);
      writeInvoiceDashboardCache({
        invoices: nextInvoices,
        payments: nextPayments
      });
      setInvoicesLoadedFromApi(true);
    } catch (error) {
      console.error('Failed to load invoices', error);
    } finally {
      setInvoicesHydrated(true);
      invoicesLoadRef.current = false;
    }
  };

  const loadMasterData = async () => {
    if (masterDataLoadRef.current) return;
    masterDataLoadRef.current = true;
    try {
      const [customersRes, itemsRes, employeesRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/customers`),
        axios.get(`${API_BASE_URL}/api/items`),
        axios.get(`${API_BASE_URL}/api/employees`),
        axios.get(`${API_BASE_URL}/api/settings`)
      ]);
      let nextLeadSources = [...DEFAULT_LEAD_SOURCES];
      try {
        const leadSourceRes = await axios.get(`${API_BASE_URL}/api/leads/sources`);
        nextLeadSources = mergeLeadSourceOptions(leadSourceRes.data, DEFAULT_LEAD_SOURCES);
      } catch (error) {
        console.error('Lead sources fetch failed', error);
      }
      const nextCustomers = Array.isArray(customersRes.data) ? customersRes.data : [];
      const nextItemsCatalog = Array.isArray(itemsRes.data) ? itemsRes.data : [];
      const nextEmployees = Array.isArray(employeesRes.data) ? employeesRes.data : [];
      const settingsData = settingsRes.data || {};
      const prefs = sanitizeInvoiceNumberPrefs({
        mode: settingsData.invoiceNumberMode || 'auto',
        gstPrefix: normalizeConfiguredInvoicePrefix(settingsData.gstInvoicePrefix ?? settingsData.invoicePrefix, defaultGstInvoicePrefix, 'GST'),
        gstNextNumber: settingsData.gstInvoiceNextNumber ?? settingsData.invoiceNextNumber ?? 66,
        nonGstPrefix: normalizeConfiguredInvoicePrefix(settingsData.nonGstInvoicePrefix, defaultNonGstInvoicePrefix, 'NON GST'),
        nonGstNextNumber: settingsData.nonGstInvoiceNextNumber ?? 1,
        padding: settingsData.invoiceNumberPadding ?? 4,
        gstNumberWidth: settingsData.gstInvoiceNumberWidth ?? 0,
        nonGstNumberWidth: settingsData.nonGstInvoiceNumberWidth ?? 0
      });
      setCustomers(nextCustomers);
      setItemsCatalog(nextItemsCatalog);
      setEmployees(nextEmployees);
      setLeadSourceOptions(nextLeadSources);
      setInvoiceNumberPrefs(prefs);
      setInvoiceNumberPrefsDraft(toInvoiceNumberPrefsDraft(prefs));
      const nextVisibleColumns = normalizeInvoiceVisibleColumns(settingsData.invoiceVisibleColumns);
      setVisibleColumns(nextVisibleColumns);
      const nextCompanySettings = {
        companyName: settingsData.companyName || settingsData.gstCompanyName || '',
        companyAddress: settingsData.companyAddress || settingsData.gstBillingAddress || '',
        companyCity: settingsData.companyCity || settingsData.gstCity || '',
        companyState: settingsData.companyState || settingsData.gstState || '',
        companyPincode: settingsData.companyPincode || settingsData.gstPincode || '',
        companyGstNumber: settingsData.companyGstNumber || '',
        companyEmail: settingsData.companyEmail || settingsData.gstEmail || '',
        companyMobile: settingsData.companyMobile || settingsData.gstPhone || '',
        companyWebsite: settingsData.companyWebsite || '',
        dashboardImageUrl: settingsData.gstCompanyLogoUrl || settingsData.dashboardImageUrl || '',
        gstTermsAndConditions: settingsData.gstTermsAndConditions || settingsData.termsAndConditionsDefault || '',
        nonGstTermsAndConditions: settingsData.nonGstTermsAndConditions || '',
        customerNotesDefault: settingsData.customerNotesDefault || ''
      };
      setCompanySettings(nextCompanySettings);
      setSettingsHydrated(true);
      writeInvoiceDashboardCache({
        customers: nextCustomers,
        itemsCatalog: nextItemsCatalog,
        employees: nextEmployees,
        companySettings: nextCompanySettings,
        invoiceNumberPrefs: prefs,
        visibleColumns: nextVisibleColumns
      });
    } catch (error) {
      console.error('Failed to load master data for invoice form', error);
    } finally {
      masterDataLoadRef.current = false;
    }
  };

  useEffect(() => {
    if (!showModal || editingId) {
      termsAutoSeededRef.current = false;
      invoiceNumberAutoSeededRef.current = false;
      return;
    }
    if (!settingsHydrated) return;
    if (termsAutoSeededRef.current) return;
    if (String(form.termsAndConditions || '').trim()) {
      termsAutoSeededRef.current = true;
      return;
    }
    const nextTerms = getDefaultTermsForInvoiceType(form.invoiceType);
    if (!nextTerms) {
      termsAutoSeededRef.current = true;
      return;
    }
    termsAutoSeededRef.current = true;
    setFormWithTotals((prev) => {
      if (String(prev.termsAndConditions || '').trim()) return prev;
      return { ...prev, termsAndConditions: nextTerms };
    });
  }, [editingId, form.invoiceType, form.termsAndConditions, getDefaultTermsForInvoiceType, settingsHydrated, showModal]);

  useEffect(() => {
    if (!showModal || editingId || contractViewOnly) {
      invoiceNumberAutoSeededRef.current = false;
      return;
    }
    if (!settingsHydrated || invoiceNumberPrefs.mode !== 'auto') return;
    if (invoiceNumberAutoSeededRef.current) return;

    const normalizedType = normalizeInvoiceType(form.invoiceType);
    const expectedPrefix = normalizedType === 'NON GST' ? invoiceNumberPrefs.nonGstPrefix : invoiceNumberPrefs.gstPrefix;
    const currentInvoiceNumber = String(form.invoiceNumber || '').trim();
    if (currentInvoiceNumber && currentInvoiceNumber.startsWith(expectedPrefix)) {
      invoiceNumberAutoSeededRef.current = true;
      return;
    }
    if (invoiceNumberManuallyEditedRef.current) {
      invoiceNumberAutoSeededRef.current = true;
      return;
    }

    const nextInvoiceNumber = createNextInvoiceNumber(invoiceNumberPrefs, normalizedType);
    invoiceNumberAutoSeededRef.current = true;
    setFormWithTotals((prev) => {
      const currentValue = String(prev.invoiceNumber || '').trim();
      if (currentValue === nextInvoiceNumber || currentValue.startsWith(expectedPrefix)) return prev;
      return { ...prev, invoiceNumber: nextInvoiceNumber };
    });
  }, [contractViewOnly, editingId, form.invoiceNumber, form.invoiceType, invoiceNumberPrefs, settingsHydrated, showModal]);

  useEffect(() => {
    loadInvoices();
    loadMasterData();
  }, []);

  useEffect(() => {
    const refreshFromDashboard = () => {
      setCustomerPremises({});
      loadInvoices({ preserveSelection: true, preservePage: true });
      loadMasterData();
    };

    return subscribeDashboardRefresh(refreshFromDashboard);
  }, []);

  useAutoRefresh(() => loadInvoices({ preserveSelection: true, preservePage: true }), { enabled: !showModal });

  useEffect(() => {
    localStorage.setItem('invoice_visible_columns', JSON.stringify(normalizeInvoiceVisibleColumns(visibleColumns)));
  }, [visibleColumns]);

  useEffect(() => {
    if (!settingsHydrated) return;
    const normalized = normalizeInvoiceVisibleColumns(visibleColumns);
    const timer = setTimeout(() => {
      axios.post(`${API_BASE_URL}/api/settings/save`, { invoiceVisibleColumns: normalized }).catch((error) => {
        console.error('Failed to sync invoice visible columns to settings', error);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [settingsHydrated, visibleColumns]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'invoice_sync_tick') {
        loadInvoices();
        loadMasterData();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

      if (
        showMoreMenu &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setShowMoreMenu(false);
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowCustomize(false);
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [showCustomize, showMoreMenu]);

  useEffect(() => {
    if (serviceScheduleRows !== null) return;
    if (!serviceScheduleSourceLine) return;
    setServiceScheduleDraft(buildServiceScheduleDraftFromInvoice({
      ...form,
      items: [serviceScheduleSourceLine],
      serviceScheduleDefaultTime: form.serviceScheduleDefaultTime || '10:00'
    }, serviceScheduleTime));
  }, [
    form.serviceScheduleDefaultTime,
    serviceScheduleRows,
    serviceScheduleSourceLine,
    serviceScheduleSourceLine?.contractEndDate,
    serviceScheduleSourceLine?.contractStartDate,
    serviceScheduleSourceLine?.serviceFrequency,
    serviceScheduleSourceLine?.serviceWeekday,
    serviceScheduleTime
  ]);

  const sortedInvoices = useMemo(() => {
    const list = [...invoices];
    list.sort((left, right) => {
      const leftValue = (() => {
        switch (invoiceSort.key) {
          case 'date': return new Date(left.date || left.invoiceDate || left.createdAt || 0).getTime() || 0;
          case 'invoiceNumber': return String(left.invoiceNumber || '');
          case 'customerName': return String(left.customerName || '');
          case 'dueDate': return new Date(left.dueDate || left.renewalDate || 0).getTime() || 0;
          case 'amount': return Number(left.amount || left.total || 0);
          case 'balanceDue': return Number(left.balanceDue || 0);
          case 'status': return String(left.status || '');
          default: return String(left[invoiceSort.key] || '');
        }
      })();
      const rightValue = (() => {
        switch (invoiceSort.key) {
          case 'date': return new Date(right.date || right.invoiceDate || right.createdAt || 0).getTime() || 0;
          case 'invoiceNumber': return String(right.invoiceNumber || '');
          case 'customerName': return String(right.customerName || '');
          case 'dueDate': return new Date(right.dueDate || right.renewalDate || 0).getTime() || 0;
          case 'amount': return Number(right.amount || right.total || 0);
          case 'balanceDue': return Number(right.balanceDue || 0);
          case 'status': return String(right.status || '');
          default: return String(right[invoiceSort.key] || '');
        }
      })();
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return invoiceSort.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
      return invoiceSort.direction === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [invoices, invoiceSort]);

  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / INVOICE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedInvoices = useMemo(() => {
    const start = (safePage - 1) * INVOICE_PAGE_SIZE;
    return sortedInvoices.slice(start, start + INVOICE_PAGE_SIZE);
  }, [sortedInvoices, safePage]);
  const firstRecord = sortedInvoices.length ? ((safePage - 1) * INVOICE_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * INVOICE_PAGE_SIZE, sortedInvoices.length);
  const visibleInvoiceIds = pagedInvoices.map((invoice) => invoice._id).filter(Boolean);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const toggleInvoiceSort = (key) => {
    setInvoiceSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const isAllSelected = visibleInvoiceIds.length > 0 && visibleInvoiceIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleInvoiceIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleInvoiceIds])));
  };

  const toggleSelectOne = (invoiceId) => {
    setSelectedIds((prev) =>
      prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId]
    );
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => {
      const next = normalizeInvoiceVisibleColumns(prev);
      if (next.includes(columnKey)) {
        if (next.length === 1) return next;
        return next.filter((key) => key !== columnKey);
      }
      return normalizeInvoiceVisibleColumns([...next, columnKey]);
    });
  };

  const resetServiceScheduleBuilder = (invoiceLike = null, nextForm = null) => {
    const source = invoiceLike || {};
    const targetForm = nextForm || form;
    const normalizedRows = normalizeServiceScheduleRows(source.serviceSchedules || [], targetForm.serviceScheduleDefaultTime || source.serviceScheduleDefaultTime || '10:00');
    setServiceScheduleRows(normalizedRows.length > 0 ? normalizedRows : null);
    setServiceScheduleExpanded(false);
    setServiceScheduleErrors({});
    setServiceScheduleDraft(buildServiceScheduleDraftFromInvoice({
      ...source,
      items: Array.isArray(targetForm.items) && targetForm.items.length > 0 ? targetForm.items : source.items || [],
      serviceScheduleDefaultTime: targetForm.serviceScheduleDefaultTime || source.serviceScheduleDefaultTime || '10:00'
    }, targetForm.serviceScheduleDefaultTime || source.serviceScheduleDefaultTime || '10:00'));
  };

  const validateServiceScheduleDraft = () => {
    const nextErrors = {};
    const startDate = String(serviceScheduleDraft.startDate || '').trim();
    const endDate = String(serviceScheduleDraft.endDate || '').trim();
    const frequency = String(serviceScheduleDraft.frequency || '').trim();
    const weekdays = Array.isArray(serviceScheduleDraft.weekdays) ? serviceScheduleDraft.weekdays.filter(Boolean) : [];
    const repeatEvery = Math.max(1, Number(serviceScheduleDraft.repeatEvery || 1));
    const repeatUnit = String(serviceScheduleDraft.repeatUnit || 'weeks').trim().toLowerCase();

    if (!startDate) nextErrors.startDate = 'Start date is required.';
    if (!endDate) nextErrors.endDate = 'End date is required.';
    if (startDate && endDate && endDate <= startDate) {
      nextErrors.endDate = 'End date must be after start date.';
    }
    if (!frequency) nextErrors.frequency = 'Frequency is required.';
    if (frequency === 'custom' && repeatEvery < 1) {
      nextErrors.repeatEvery = 'Repeat every must be at least 1.';
    }

    setServiceScheduleErrors(nextErrors);
    return nextErrors;
  };

  const handleGenerateServiceSchedule = () => {
    const nextErrors = validateServiceScheduleDraft();
    if (Object.keys(nextErrors).length > 0) return;
    const rows = buildServiceScheduleRows({
      draft: liveServiceScheduleDraft,
      defaultTime: serviceScheduleTime,
      itemMeta: serviceScheduleItemMeta
    });
    setServiceScheduleRows(rows.length > 0 ? rows : null);
  };

  const handleResetServiceSchedule = () => {
    setServiceScheduleRows(null);
    setServiceScheduleExpanded(false);
    setServiceScheduleErrors({});
  };

  const handleServiceScheduleRowsChange = (rows) => {
    const nextRows = normalizeServiceScheduleRows(rows, serviceScheduleTime);
    setServiceScheduleRows(nextRows.length > 0 ? nextRows : null);
  };

  useEffect(() => {
    if (showModal && editingId) {
      clearInvoiceDraftCache();
      return;
    }

    if (!showModal || editingId) return;

    writeInvoiceDraftCache({
      form,
      serviceScheduleDraft,
      serviceScheduleRows,
      serviceScheduleExpanded,
      serviceScheduleTime,
      showModal,
      modalOpenedFromContract
    });
  }, [
    editingId,
    form,
    modalOpenedFromContract,
    serviceScheduleDraft,
    serviceScheduleExpanded,
    serviceScheduleRows,
    serviceScheduleTime,
    showModal
  ]);

  const openNewForm = () => {
    setEditingId(null);
    setSaveError('');
    invoiceNumberAutoSeededRef.current = false;
    invoiceNumberManuallyEditedRef.current = false;
    const invoiceType = 'GST';
    const invoiceNumber = invoiceNumberPrefs.mode === 'auto' ? createNextInvoiceNumber(invoiceNumberPrefs, invoiceType) : '';
    const invoiceDate = new Date().toISOString().slice(0, 10);
    const nextForm = applyComputedTotals({
      ...emptyForm,
      invoiceNumber,
      invoiceType,
      date: invoiceDate,
      items: [createEmptyLine({ contractStartDate: invoiceDate, contractStartDateSource: 'invoice-date' })],
      customerNotes: '',
      termsAndConditions: '',
      status: 'DRAFT'
    });
    setForm(nextForm);
    resetServiceScheduleBuilder(nextForm, nextForm);
    setShowModal(true);
  };

  const closeInvoiceModal = () => {
    clearInvoiceDraftCache();
    invoiceNumberAutoSeededRef.current = false;
    invoiceNumberManuallyEditedRef.current = false;
    setShowBillingAddressPicker(false);
    setShowShippingAddressPicker(false);
    setEditingShippingAddressId('');
    setShippingAddressDraft(emptyAddressDraft);
    setShowModal(false);
    setEditingId(null);
    setSaveError('');
    setForm(emptyForm);
    setServiceScheduleDraft(buildServiceScheduleDraftFromInvoice(emptyForm, '10:00'));
    setServiceScheduleRows(null);
    setServiceScheduleExpanded(false);
    setServiceScheduleErrors({});

    if (modalOpenedFromContract) {
      setModalOpenedFromContract(false);
      navigate('/sales/contracts', { replace: true });
    } else if (routeHasQueryParams) {
      navigate(location.pathname, { replace: true });
    }
  };

  const openInvoiceNumberPrefs = () => {
    setInvoiceNumberPrefsDraft(toInvoiceNumberPrefsDraft(invoiceNumberPrefs));
    setShowInvoiceNumberPrefs(true);
  };

  const saveInvoiceNumberPrefs = async () => {
    const clean = sanitizeInvoiceNumberPrefs(invoiceNumberPrefsDraft);
    const gstDraftDigits = String(invoiceNumberPrefsDraft.gstNextNumber || '').replace(/\D/g, '');
    const nonGstDraftDigits = String(invoiceNumberPrefsDraft.nonGstNextNumber || '').replace(/\D/g, '');
    const nextPrefs = {
      ...clean,
      gstNumberWidth: gstDraftDigits.length,
      nonGstNumberWidth: nonGstDraftDigits.length
    };
    try {
      await axios.post(`${API_BASE_URL}/api/settings/save`, {
        invoiceNumberMode: nextPrefs.mode,
        gstInvoicePrefix: nextPrefs.gstPrefix,
        gstInvoiceNextNumber: nextPrefs.gstNextNumber,
        nonGstInvoicePrefix: nextPrefs.nonGstPrefix,
        nonGstInvoiceNextNumber: nextPrefs.nonGstNextNumber,
        gstInvoiceNumberWidth: nextPrefs.gstNumberWidth,
        nonGstInvoiceNumberWidth: nextPrefs.nonGstNumberWidth,
        invoicePrefix: nextPrefs.gstPrefix,
        invoiceNextNumber: nextPrefs.gstNextNumber,
        invoiceNumberPadding: nextPrefs.padding
      });
      setInvoiceNumberPrefs(nextPrefs);
      invoiceNumberAutoSeededRef.current = false;
      invoiceNumberManuallyEditedRef.current = false;
      if (!editingId && showModal && nextPrefs.mode === 'auto') {
        const nextNumber = createNextInvoiceNumber(nextPrefs, form.invoiceType);
        setFormWithTotals((prev) => ({ ...prev, invoiceNumber: nextNumber }));
      }
      setShowInvoiceNumberPrefs(false);
    } catch (error) {
      console.error('Failed to save invoice number preferences', error);
      window.alert('Could not save invoice number preferences.');
    }
  };

  const mapInvoiceToForm = (invoice) => {
    const invoiceType = normalizeInvoiceType(invoice.invoiceType || (Number(invoice.totalTax || 0) > 0 ? 'GST' : 'NON GST'));
    const invoiceDate = normalizeDateInput(invoice.date || invoice.invoiceDate || invoice.createdAt);
    const mappedItems = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items.map((line) => withContractSchedule({
        itemId: line.itemId || '',
        itemName: line.itemName || '',
        description: line.frequency || line.description || '',
        frequency: line.frequency || line.description || '',
        sac: line.sac || '',
        itemType: line.itemType || 'service',
        contractPeriod: line.contractPeriod || '',
        contractStartDate: line.contractStartDate || '',
        contractStartDateSource: line.contractStartDate && invoiceDate && normalizeDateInput(line.contractStartDate) !== invoiceDate
          ? 'manual'
          : 'invoice-date',
        serviceWeekday: line.serviceWeekday || '',
        contractEndDate: line.contractEndDate || '',
        renewalDate: line.renewalDate || '',
        serviceFrequency: line.serviceFrequency || '',
        totalServices: line.totalServices ? String(line.totalServices) : '',
        serviceStartDate: line.serviceStartDate || '',
        serviceEndDate: line.serviceEndDate || '',
        quantity: String(line.quantity ?? 1),
        rate: String(line.rate ?? 0),
        taxRate: invoiceType === 'NON GST' ? '0' : String(line.taxRate ?? 18)
      }))
      : [createEmptyLine()];
    const mappedPaymentSplits = Array.isArray(invoice.paymentSplits) && invoice.paymentSplits.length > 0
      ? invoice.paymentSplits.map((split) => ({
        mode: split.mode || getDefaultPaymentModeForDepositTo(split.depositTo, invoiceType),
        depositTo: normalizePaymentDepositTo(split.depositTo, invoiceType),
        amount: String(split.amount ?? 0)
      }))
      : [createEmptyPaymentSplit(getDefaultPaymentDepositTo(invoiceType))];

    return applyComputedTotals({
      customerId: invoice.customerId || '',
      customerName: invoice.customerName || '',
      invoiceType,
      billingAddressSource: invoice.billingAddressSource || 'billing',
      shippingAddressSource: invoice.shippingAddressSource || 'shipping',
      billingAddressText: invoice.billingAddressText || '',
      shippingAddressText: invoice.shippingAddressText || '',
      customerType: String(invoice.customerType || invoice.customer_type || 'New').trim() || 'New',
      customerPremiseId: invoice.customerPremiseId || '',
      premiseLabel: invoice.premiseLabel || '',
      premiseAddress: invoice.premiseAddress || '',
      premiseAreaName: invoice.premiseAreaName || '',
      premiseCity: invoice.premiseCity || '',
      premiseState: invoice.premiseState || '',
      premisePincode: invoice.premisePincode || '',
      premiseGoogleMapUrl: invoice.premiseGoogleMapUrl || '',
      customShippingAddresses: Array.isArray(invoice.customShippingAddresses)
        ? invoice.customShippingAddresses.map((address) => ({
          ...address,
          placeOfSupply: normalizeGstState(address.placeOfSupply || address.state || '')
        }))
        : [],
      placeOfSupply: normalizeGstState(invoice.placeOfSupply || ''),
      leadSource: String(invoice.leadSource || invoice.lead_source || '').trim(),
      invoiceNumber: invoice.invoiceNumber || '',
      date: normalizeDateInput(
        invoice.date
          || invoice.invoiceDate
          || invoice.createdAt
          || invoice.invoice_date
          || invoice.contractDate
      ) || new Date().toISOString().slice(0, 10),
      terms: invoice.terms || 'Paid',
      dueDate: normalizeDateInput(invoice.dueDate || invoice.date || invoice.invoiceDate || invoice.createdAt) || new Date().toISOString().slice(0, 10),
      salesperson: invoice.salesperson || '',
      servicePeriod: invoice.servicePeriod || '',
      servicePeriodStart: invoice.servicePeriodStart || '',
      servicePeriodEnd: invoice.servicePeriodEnd || '',
      subject: invoice.subject || '',
      items: mappedItems,
      customerNotes: invoice.customerNotes || '',
      termsAndConditions: invoice.termsAndConditions || getDefaultTermsForInvoiceType(invoiceType),
      serviceScheduleDefaultTime: normalizeTimeInput(invoice.serviceScheduleDefaultTime || '', '10:00'),
      showPaymentDetailsInPdf: invoice.showPaymentDetailsInPdf == null ? true : Boolean(invoice.showPaymentDetailsInPdf),
      showGstNumberInPdf: invoice.showGstNumberInPdf == null ? true : Boolean(invoice.showGstNumberInPdf),
      paymentReceivedEnabled: Boolean(invoice.paymentReceivedEnabled),
      paymentSplits: mappedPaymentSplits,
      paymentReceivedTotal: String(invoice.paymentReceivedTotal ?? 0),
      attachments: Array.isArray(invoice.attachments) ? invoice.attachments : [],
      status: (invoice.status || 'DRAFT').toUpperCase(),
      amount: String(invoice.amount ?? 0),
      balanceDue: String(invoice.balanceDue ?? 0),
      subtotal: String(invoice.subtotal ?? 0),
      totalTax: String(invoice.totalTax ?? 0),
      withholdingType: invoice.withholdingType || 'TDS',
      withholdingRate: String(invoice.withholdingRate ?? 0),
      withholdingAmount: String(invoice.withholdingAmount ?? 0),
      discount: String(invoice.discount ?? 0),
      roundOff: String(invoice.roundOff ?? invoice.round_off ?? 0),
      total: String(invoice.total ?? invoice.amount ?? 0)
    });
  };

  const openEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const selected = invoices.find((invoice) => invoice._id === selectedIds[0]);
    if (!selected) return;
    setModalOpenedFromContract(false);
    setEditingId(selected._id);
    const nextForm = mapInvoiceToForm(selected);
    setForm(nextForm);
    resetServiceScheduleBuilder(selected, nextForm);
    setSaveError('');
    setShowModal(true);
    setShowMoreMenu(false);
  };

  const findCustomerForInvoice = (invoice) =>
    customers.find((customer) =>
      (invoice.customerId && customer._id === invoice.customerId) ||
      String(customer.displayName || customer.name || '').trim().toLowerCase() === String(invoice.customerName || '').trim().toLowerCase()
    ) || null;

  const openInvoicePdfPreview = (invoice) => {
    const invoiceNumber = String(invoice.invoiceNumber || invoice.invoice_number || invoice._id || 'Invoice').trim();
    const invoiceRef = String(invoice.invoiceNumber || invoice.invoice_number || invoice._id || '').trim();
    if (!invoiceRef) return;
    const primaryRef = String(invoice._id || invoiceRef).trim();
    const pdfUrl = addPdfCacheBust(`${API_BASE_URL}/api/invoices/${encodeURIComponent(primaryRef)}/pdf?ref=${encodeURIComponent(invoiceRef)}`);
    setPdfPreview({
      open: true,
      title: `Invoice - ${invoiceNumber}`,
      pdfUrl,
      downloadFileName: `${invoiceNumber.replace(/[^\w.-]+/g, '_')}.pdf`,
      publicShareUrl: pdfUrl,
      invoiceId: String(invoice._id || invoiceRef).trim()
    });
  };

  const buildShareText = (invoice, customer) => {
    const invoiceNumber = String(invoice.invoiceNumber || '').trim() || 'Invoice';
    const customerName = String(invoice.customerName || customer?.displayName || customer?.name || '').trim() || 'Customer';
    const lines = [
      `${companySettings.companyName || 'Service Team'} Invoice`,
      `Invoice No: ${invoiceNumber}`,
      `Customer: ${customerName}`,
      `Invoice Date: ${formatDisplayDate(invoice.date)}`,
      `Total Amount: ${formatINR(invoice.total || invoice.amount || 0)}`,
      `Balance Due: ${formatINR(invoice.balanceDue || 0)}`
    ];
    if (companySettings.companyWebsite) lines.push(`Website: ${companySettings.companyWebsite}`);
    lines.push('Please find attached invoice PDF.');
    return lines.join('\\n');
  };

  const apiErrorMessage = (error, fallback) =>
    error?.response?.data?.error || fallback;

  const runInvoiceAction = async (invoice, action) => {
    if (!invoice) return;
    const customer = findCustomerForInvoice(invoice);
    const invoiceNumber = String(invoice.invoiceNumber || '').trim() || 'Invoice';
    const customerEmail = String(customer?.emailId || customer?.email || '').trim();
    const customerWhatsapp = normalizeIndianMobileNumber(customer?.whatsappNumber || customer?.mobileNumber || customer?.workPhone || '');
    const shareText = buildShareText(invoice, customer);

    if (action === 'download') {
      openInvoicePdfPreview(invoice);
      return;
    }

    if (action === 'preview') {
      openInvoicePdfPreview(invoice);
      return;
    }

    if (action === 'print') {
      openInvoicePdfPreview(invoice);
      return;
    }

    if (action === 'whatsapp') {
      const targetPhone = normalizeIndianMobileNumber(window.prompt('Enter WhatsApp number with country code', customerWhatsapp || ''));
      if (!targetPhone) return;
      try {
        const response = await axios.post(`${API_BASE_URL}/api/invoices/${invoice._id}/send-whatsapp`, {
          phoneNumber: targetPhone,
          message: shareText
        });
        window.alert(response.data?.message || 'Invoice sent on WhatsApp.');
      } catch (error) {
        console.error('Failed to send invoice on WhatsApp', error);
        window.alert(apiErrorMessage(error, 'Could not send invoice on WhatsApp.'));
      }
      return;
    }

    if (action === 'email') {
      const recipient = window.prompt('Enter recipient email', customerEmail || '');
      if (!recipient) return;
      try {
        const response = await axios.post(`${API_BASE_URL}/api/invoices/${invoice._id}/send-email`, {
          to: recipient,
          templateType: 'invoice_send'
        });
        window.alert(response.data?.message || 'Invoice email sent successfully.');
      } catch (error) {
        console.error('Failed to send invoice email', error);
        window.alert(apiErrorMessage(error, 'Could not send invoice email.'));
      }
    }
  };

  useEffect(() => {
    if (showModal || showInvoiceNumberPrefs) return;

    if (routeOpenInvoiceNumberPrefs) {
      if (!settingsHydrated || !invoicesHydrated) return;
      setModalOpenedFromContract(routeFromContract);
      openNewForm();
      setTimeout(() => openInvoiceNumberPrefs(), 0);
      if (location.state?.openInvoiceNumberPrefs) navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (routeOpenNewInvoice) {
      if (!settingsHydrated || !invoicesHydrated) return;
      setModalOpenedFromContract(routeFromContract || routeEditContract || routeOpenNewInvoice);
      openNewForm();
      if (location.state?.openNewInvoice) navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const targetId = routeOpenInvoiceId;
    const targetNumber = routeOpenInvoiceNumber;
    if (!targetId && !targetNumber) return;
    if (routeFromContract && !invoicesLoadedFromApi) return;
    if (!invoicesHydrated) return;
    if (!Array.isArray(invoices) || invoices.length === 0) return;

    const matched = invoices.find((invoice) => {
      if (targetId && matchesInvoiceReference(invoice, targetId)) return true;
      if (targetNumber) return matchesInvoiceReference(invoice, targetNumber);
      return false;
    });
    if (!matched) return;

    const nextForm = mapInvoiceToForm(matched);
    setSelectedIds([matched._id]);
    setModalOpenedFromContract(routeFromContract || routeEditContract || routeViewContract);
    setEditingId(contractViewOnly ? null : matched._id);
    setForm(nextForm);
    resetServiceScheduleBuilder(matched, nextForm);
    setSaveError('');
    setShowModal(true);
    setShowMoreMenu(false);
    if (location.state?.openInvoiceId || location.state?.openInvoiceNumber) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [
    invoices,
    invoicesHydrated,
    location.pathname,
    location.state,
    navigate,
    routeEditContract,
    routeFromContract,
    routeViewContract,
    invoicesLoadedFromApi,
    routeOpenInvoiceId,
    routeOpenInvoiceNumber,
    routeOpenInvoiceNumberPrefs,
    routeOpenNewInvoice,
    settingsHydrated,
    showInvoiceNumberPrefs,
    showModal
  ]);

  const setFormWithTotals = (updater) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return applyComputedTotals(next);
    });
  };

  const scheduleResetKeys = new Set(['contractStartDate', 'contractPeriod', 'serviceFrequency', 'serviceWeekday', 'serviceStartDate', 'serviceEndDate']);

  const updateLine = (index, patch) => {
    setFormWithTotals((prev) => {
      const nextItems = [...prev.items];
      const currentLine = nextItems[index] || createEmptyLine();
      nextItems[index] = withContractSchedule({
        ...currentLine,
        ...patch,
        contractStartDateSource: Object.prototype.hasOwnProperty.call(patch, 'contractStartDate')
          ? 'manual'
          : currentLine.contractStartDateSource || 'invoice-date'
      });
      return { ...prev, items: nextItems };
    });
    if (Object.keys(patch || {}).some((key) => scheduleResetKeys.has(key))) {
      setServiceScheduleRows(null);
    }
  };

  const updatePaymentSplit = (index, patch) => {
    setFormWithTotals((prev) => {
      const nextSplits = Array.isArray(prev.paymentSplits) ? [...prev.paymentSplits] : [createEmptyPaymentSplit(getDefaultPaymentDepositTo(prev.invoiceType))];
      if (!nextSplits[index]) nextSplits[index] = createEmptyPaymentSplit(getDefaultPaymentDepositTo(prev.invoiceType));
      const nextSplit = { ...nextSplits[index], ...patch };
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'depositTo') && !Object.prototype.hasOwnProperty.call(patch || {}, 'mode')) {
        nextSplit.mode = getDefaultPaymentModeForDepositTo(nextSplit.depositTo, prev.invoiceType);
      }
      nextSplits[index] = nextSplit;
      return { ...prev, paymentSplits: nextSplits };
    });
  };

  const addPaymentSplit = () => {
    setFormWithTotals((prev) => ({
      ...prev,
      paymentSplits: [...(Array.isArray(prev.paymentSplits) ? prev.paymentSplits : []), createEmptyPaymentSplit(getDefaultPaymentDepositTo(prev.invoiceType))]
    }));
  };

  const removeLine = (index) => {
    setFormWithTotals((prev) => {
      if (prev.items.length === 1) {
        return { ...prev, items: [createEmptyLine({ contractStartDate: prev.date || new Date().toISOString().slice(0, 10), contractStartDateSource: 'invoice-date' })] };
      }
      return { ...prev, items: prev.items.filter((_, idx) => idx !== index) };
    });
    setServiceScheduleRows(null);
  };

  const addLine = () => {
    setFormWithTotals((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        prev.invoiceType === 'NON GST'
          ? { ...createEmptyLine({ contractStartDate: prev.date || new Date().toISOString().slice(0, 10), contractStartDateSource: 'invoice-date' }), taxRate: '0' }
          : createEmptyLine({ contractStartDate: prev.date || new Date().toISOString().slice(0, 10), contractStartDateSource: 'invoice-date' })
      ]
    }));
    setServiceScheduleRows(null);
  };

  const scanItem = () => {
    const query = window.prompt('Scan/enter item name or code');
    if (!query) return;
    const q = query.toLowerCase().trim();
    const match = itemsCatalog.find((item) =>
      String(item.name || '').toLowerCase().includes(q) ||
      String(item._id || '').toLowerCase().includes(q) ||
      String(item.hsnSac || '').toLowerCase().includes(q)
    );
    if (!match) {
      window.alert('Item not found in Items module.');
      return;
    }
    setFormWithTotals((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemId: match._id,
          itemName: match.name || '',
          description: match.description || match.salesDescription || '',
          frequency: match.frequency || match.description || match.salesDescription || '',
          sac: match.hsnSac || match.sac || '',
          itemType: match.itemType || 'service',
          contractPeriod: '',
          contractStartDate: prev.date || new Date().toISOString().slice(0, 10),
          contractStartDateSource: 'invoice-date',
          contractEndDate: '',
          renewalDate: '',
          serviceFrequency: '',
          totalServices: '',
          serviceStartDate: prev.servicePeriodStart || '',
          serviceEndDate: prev.servicePeriodEnd || '',
          quantity: '1',
          rate: String(parseDecimalNumber(match.sellingPrice || match.rate || 0, 0)),
          taxRate: prev.invoiceType === 'NON GST' ? '0' : String(parsePercent(match.intraTaxRate || '18%'))
        }
      ]
    }));
    setServiceScheduleRows(null);
  };

  const applyBulkTax = () => {
    if (form.invoiceType === 'NON GST') {
      window.alert('Bulk tax is disabled for Non GST invoices.');
      return;
    }
    const selectedTax = window.prompt('Enter tax % for all rows (e.g. 18)');
    if (selectedTax == null) return;
    const tax = Number(selectedTax);
    if (!Number.isFinite(tax) || tax < 0) return;
    setFormWithTotals((prev) => ({
      ...prev,
      items: prev.items.map((line) => ({ ...line, taxRate: String(tax) }))
    }));
  };

  const handleItemSelect = (index, itemId) => {
    const selected = itemsCatalog.find((item) => item._id === itemId);
    if (!selected) {
      updateLine(index, {
        itemId: '',
        itemName: '',
        description: '',
        frequency: '',
        sac: '',
        itemType: 'service',
        serviceStartDate: '',
        serviceEndDate: '',
        rate: '0',
        taxRate: form.invoiceType === 'NON GST' ? '0' : '18'
      });
      return;
    }
    const rate = parseDecimalNumber(selected.sellingPrice || selected.rate || 0, 0);
    const taxRate = form.invoiceType === 'NON GST' ? 0 : parsePercent(selected.intraTaxRate || '18%');
    updateLine(index, {
      itemId: selected._id,
      itemName: selected.name || '',
      description: selected.description || selected.salesDescription || '',
      frequency: selected.frequency || selected.description || selected.salesDescription || '',
      sac: selected.hsnSac || selected.sac || '',
      itemType: selected.itemType || 'service',
      serviceStartDate: form.servicePeriodStart || '',
      serviceEndDate: form.servicePeriodEnd || '',
      rate: String(rate),
      taxRate: String(taxRate)
    });
  };

  const handleTermsChange = (terms) => {
    const days = termsToDays[terms] ?? 0;
    setFormWithTotals((prev) => ({
      ...prev,
      terms,
      dueDate: addDays(prev.date, days),
      status: terms === 'Paid' ? 'PAID' : prev.status === 'PAID' ? 'SENT' : prev.status
    }));
  };

  const handleInvoiceTypeChange = (invoiceType) => {
    const normalized = normalizeInvoiceType(invoiceType);
    const previousDefaultDepositTo = getDefaultPaymentDepositTo(form.invoiceType);
    const nextDefaultDepositTo = getDefaultPaymentDepositTo(normalized);
    setFormWithTotals((prev) => ({
      ...prev,
      invoiceNumber: !editingId && invoiceNumberPrefs.mode === 'auto'
        ? createNextInvoiceNumber(invoiceNumberPrefs, normalized)
        : prev.invoiceNumber,
      invoiceType: normalized,
      items: (prev.items || []).map((line) => ({
        ...line,
        taxRate: normalized === 'NON GST' ? '0' : '18'
      })),
      paymentSplits: Array.isArray(prev.paymentSplits)
        ? prev.paymentSplits.map((split) => {
          const normalizedDepositTo = normalizePaymentDepositTo(split?.depositTo, prev.invoiceType);
          return normalizedDepositTo === previousDefaultDepositTo
            ? { ...split, depositTo: nextDefaultDepositTo }
            : split;
        })
        : prev.paymentSplits,
      termsAndConditions: getDefaultTermsForInvoiceType(normalized)
    }));
  };

  const handleDateChange = (date) => {
    setFormWithTotals((prev) => {
      const days = termsToDays[prev.terms] ?? 0;
      const nextItems = Array.isArray(prev.items)
        ? prev.items.map((line) => {
          const shouldFollowInvoiceDate = String(line.contractStartDateSource || 'invoice-date') !== 'manual';
          return shouldFollowInvoiceDate
            ? { ...line, contractStartDate: date }
            : line;
        })
        : prev.items;
      return { ...prev, date, dueDate: addDays(date, days), items: nextItems };
    });
    setServiceScheduleRows(null);
  };

  const openContractForEditing = () => {
    if (!routeOpenInvoiceId && !editingId) return;
    const targetId = String(routeOpenInvoiceId || editingId || '').trim();
    if (!targetId) return;
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('openInvoiceId', targetId);
    nextParams.set('fromContract', '1');
    nextParams.set('editContract', '1');
    nextParams.delete('viewContract');
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
    setShowModal(false);
  };

  const resolveCustomerMatch = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const normalized = raw.toLowerCase();
    return customers.find((entry) => {
      const entryId = String(entry?._id || '').trim();
      const entryName = String(entry?.displayName || entry?.name || '').trim();
      const entryCompanyName = String(entry?.companyName || '').trim();
      return (
        entryId === raw
        || entryName.toLowerCase() === normalized
        || entryCompanyName.toLowerCase() === normalized
      );
    }) || null;
  };

  const handleCustomerChange = (value) => {
    const customer = resolveCustomerMatch(value);
    const customerName = String(value || '').trim();
    setFormWithTotals((prev) => ({
      ...prev,
      customerId: customer?._id || '',
      customerName,
      billingAddressSource: 'billing',
      shippingAddressSource: 'shipping',
      customShippingAddresses: [],
      placeOfSupply: customer ? normalizeGstState(customer.billingState || customer.state || '') : ''
    }));
    if (customer?._id) {
      axios.get(`${API_BASE_URL}/api/customers/${customer._id}/premises`)
        .then((res) => {
          const rows = Array.isArray(res.data) ? res.data : [];
          setCustomerPremises((prev) => ({ ...prev, [customer._id]: rows }));
          const defaultPremise = rows.find((row) => row.isDefault || row.is_default) || rows[0];
          if (defaultPremise?.premiseId || defaultPremise?.premise_id) {
            const source = `premise:${defaultPremise.premiseId || defaultPremise.premise_id}`;
            setFormWithTotals((prev) => ({
              ...prev,
              billingAddressSource: source,
              shippingAddressSource: source,
              placeOfSupply: normalizeGstState(defaultPremise.placeOfSupply || defaultPremise.place_of_supply || defaultPremise.state || prev.placeOfSupply)
            }));
          }
        })
        .catch((error) => console.error('Failed to load customer premises', error));
    }
  };

  const openCustomerAddressDraft = (target = 'shipping') => {
    if (!selectedCustomer?._id) {
      setSaveError('Select a customer before adding an address.');
      return;
    }
    setAddressDraftTarget(target);
    setEditingShippingAddressId('new-premise');
    setShippingAddressDraft({
      ...emptyAddressDraft,
      label: target === 'billing' ? 'Additional Billing Address' : 'Additional Shipping Address',
      company: selectedCustomer?.displayName || selectedCustomer?.name || '',
      gstin: selectedCustomer?.gstNumber || '',
      placeOfSupply: normalizeGstState(selectedCustomer?.billingState || selectedCustomer?.state || '')
    });
    if (target === 'billing') {
      setShowBillingAddressPicker(true);
      setShowShippingAddressPicker(false);
    } else {
      setShowShippingAddressPicker(true);
      setShowBillingAddressPicker(false);
    }
  };

  const openShippingAddressPicker = () => {
    if (!selectedCustomer) {
      setSaveError('Select a customer before choosing a shipping address.');
      return;
    }
    setShowBillingAddressPicker(false);
    setEditingShippingAddressId('');
    setAddressDraftTarget('shipping');
    setShippingAddressDraft(emptyAddressDraft);
    setShowShippingAddressPicker(true);
  };

  const openBillingAddressPicker = () => {
    if (!selectedCustomer) {
      setSaveError('Select a customer before choosing a billing address.');
      return;
    }
    setShowShippingAddressPicker(false);
    setEditingShippingAddressId('');
    setAddressDraftTarget('billing');
    setShippingAddressDraft(emptyAddressDraft);
    setShowBillingAddressPicker(true);
  };

  const selectBillingAddressOption = (id) => {
    setFormWithTotals((prev) => ({
      ...prev,
      billingAddressSource: id
    }));
    setShowBillingAddressPicker(false);
  };

  const selectShippingAddressOption = (id) => {
    const option = shippingAddressOptions.find((address) => address.id === id);
    setFormWithTotals((prev) => ({
      ...prev,
      shippingAddressSource: id,
      placeOfSupply: normalizeGstState(option?.placeOfSupply || prev.placeOfSupply)
    }));
    setShowShippingAddressPicker(false);
    setEditingShippingAddressId('');
    setShippingAddressDraft(emptyAddressDraft);
  };

  const startNewShippingAddress = () => {
    openCustomerAddressDraft('shipping');
  };

  const startNewBillingAddress = () => {
    openCustomerAddressDraft('billing');
  };

  const startNewCustomShippingAddress = () => {
    setAddressDraftTarget('shipping');
    setEditingShippingAddressId('new');
    setShippingAddressDraft({
      ...emptyAddressDraft,
      company: selectedCustomer?.displayName || selectedCustomer?.name || '',
      gstin: selectedCustomer?.gstNumber || '',
      placeOfSupply: normalizeGstState(selectedCustomer?.billingState || selectedCustomer?.state || '')
    });
  };

  const startEditShippingAddress = (id) => {
    const address = shippingAddressOptions.find((entry) => entry.id === id);
    if (!address || !id.startsWith('custom-')) return;
    setAddressDraftTarget('shipping');
    setEditingShippingAddressId(id);
    setShippingAddressDraft({
      label: address.label || 'Additional Address',
      company: address.company || '',
      line1: address.line1 || address.street1 || '',
      city: address.city || '',
      area: address.area || '',
      state: address.state || 'Delhi',
      pincode: toSixDigitPincode(address.pincode || ''),
    });
  };

  const saveShippingAddressDraft = () => {
    if (!shippingAddressDraft.line1.trim()) return;
    const pincode = toSixDigitPincode(shippingAddressDraft.pincode);
    if (pincode && pincode.length !== 6) {
      setSaveError(`${addressDraftTarget === 'billing' ? 'Billing' : 'Shipping'} address pincode must be exactly 6 digits.`);
      return;
    }
    if (editingShippingAddressId === 'new-premise') {
      if (!selectedCustomer?._id) {
        setSaveError('Select a customer before adding an address.');
        return;
      }
      const payload = {
        premiseLabel: shippingAddressDraft.label || (addressDraftTarget === 'billing' ? 'Additional Billing Address' : 'Additional Shipping Address'),
        premiseType: addressDraftTarget === 'billing' ? 'Billing' : 'Shipping',
        contactPerson: shippingAddressDraft.company || selectedCustomer.displayName || selectedCustomer.name || '',
        address: shippingAddressDraft.line1,
        areaName: shippingAddressDraft.area || '',
        city: shippingAddressDraft.city || '',
        state: shippingAddressDraft.state || '',
        pincode,
        country: 'India',
        isBilling: addressDraftTarget === 'billing',
        isShipping: addressDraftTarget === 'shipping',
        isDefault: false
      };
      axios.post(`${API_BASE_URL}/api/customers/${selectedCustomer._id}/premises`, payload)
        .then(async (res) => {
          const created = res.data || {};
          const rowsRes = await axios.get(`${API_BASE_URL}/api/customers/${selectedCustomer._id}/premises`);
          const rows = Array.isArray(rowsRes.data) ? rowsRes.data : [];
          setCustomerPremises((prev) => ({ ...prev, [selectedCustomer._id]: rows }));
          const premiseId = created.premiseId || created.premise_id || rows[rows.length - 1]?.premiseId || rows[rows.length - 1]?.premise_id || '';
          const source = premiseId ? `premise:${premiseId}` : '';
          if (source) {
            setFormWithTotals((prev) => ({
              ...prev,
              ...(addressDraftTarget === 'billing' ? { billingAddressSource: source } : { shippingAddressSource: source }),
              placeOfSupply: addressDraftTarget === 'shipping'
                ? normalizeGstState(payload.state || prev.placeOfSupply)
                : prev.placeOfSupply
            }));
          }
          setShowBillingAddressPicker(false);
          setShowShippingAddressPicker(false);
          setEditingShippingAddressId('');
          setShippingAddressDraft(emptyAddressDraft);
          setSaveError('');
        })
        .catch((error) => {
          console.error('Failed to save customer address', error);
          handleInvoiceActionError(error, 'Unable to save customer address.');
        });
      return;
    }
    setFormWithTotals((prev) => {
      const list = [...(prev.customShippingAddresses || [])];
      const payload = {
        ...shippingAddressDraft,
        pincode,
        street1: shippingAddressDraft.line1 || '',
        placeOfSupply: normalizeGstState(shippingAddressDraft.state || '')
      };
      if (editingShippingAddressId.startsWith('custom-')) {
        const index = Number(editingShippingAddressId.split('-')[1] || 0);
        list[index] = payload;
        return {
          ...prev,
          customShippingAddresses: list,
          shippingAddressSource: `custom-${index}`,
          placeOfSupply: payload.placeOfSupply || prev.placeOfSupply
        };
      }
      list.push(payload);
      const index = list.length - 1;
      return {
        ...prev,
        customShippingAddresses: list,
        shippingAddressSource: `custom-${index}`,
        placeOfSupply: payload.placeOfSupply || prev.placeOfSupply
      };
    });
    setEditingShippingAddressId('');
    setShippingAddressDraft(emptyAddressDraft);
  };

  const copyBillingIntoNewAddressDraft = () => {
    if (!selectedCustomer) return;
    setShippingAddressDraft((prev) => ({
      ...prev,
      company: selectedCustomer.displayName || selectedCustomer.name || prev.company,
      line1: selectedCustomer.billingStreet1 || selectedCustomer.billingAddress || '',
      city: selectedCustomer.billingCity || selectedCustomer.city || prev.city || '',
      area: selectedCustomer.billingArea || '',
      state: selectedCustomer.billingState || selectedCustomer.state || 'Delhi',
      pincode: selectedCustomer.billingPincode || '',
      gstin: selectedCustomer.gstNumber || '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customerName.trim()) {
      setSaveError('Customer Name is required.');
      return;
    }

    const invoiceType = normalizeInvoiceType(form.invoiceType);
    const validItems = form.items
      .map((line) => ({
        ...line,
        description: String(line.frequency || line.description || '').trim(),
        frequency: String(line.frequency || line.description || '').trim(),
        quantity: parseDecimalNumber(line.quantity, 0),
        rate: parseDecimalNumber(line.rate, 0),
        taxRate: invoiceType === 'NON GST' ? 0 : parseDecimalNumber(line.taxRate, 0)
      }))
      .filter((line) => line.itemName && line.quantity > 0);

    if (validItems.length === 0) {
      setSaveError('Add at least one item in Item Table.');
      return;
    }

    const totals = computeTotals(validItems, invoiceType);
    const invoiceTotal = Number(form.total || totals.total || 0);
    const paymentSplitsSource = Array.isArray(form.paymentSplits) && form.paymentSplits.length > 0
      ? form.paymentSplits
      : [createEmptyPaymentSplit(getDefaultPaymentDepositTo(invoiceType))];
    const normalizedPaymentSplits = [];
    for (const split of paymentSplitsSource) {
      const amountValue = Number(split?.amount || 0);
      if (!Number.isFinite(amountValue) || amountValue < 0) {
        setSaveError('Amount Received must be a valid number.');
        return;
      }
      normalizedPaymentSplits.push({
        mode: split?.mode || 'Cheque',
        depositTo: normalizePaymentDepositTo(split?.depositTo, invoiceType),
        amount: Number(amountValue.toFixed(2))
      });
    }
    const paymentReceivedTotal = form.paymentReceivedEnabled ? sumPaymentSplits(normalizedPaymentSplits) : 0;
    const baseStatus = (form.status || 'DRAFT').toUpperCase();
    const status = form.paymentReceivedEnabled
      ? paymentReceivedTotal >= invoiceTotal && invoiceTotal > 0
        ? 'PAID'
        : paymentReceivedTotal > 0 || baseStatus === 'PAID'
          ? 'SENT'
          : baseStatus
      : baseStatus;
    const computedBalance = form.paymentReceivedEnabled
      ? Number(Math.max(invoiceTotal - paymentReceivedTotal, 0).toFixed(2))
      : status === 'PAID'
        ? 0
        : Number(form.balanceDue || invoiceTotal);

    if (!Number.isFinite(invoiceTotal) || invoiceTotal < 0) {
      setSaveError('Amount must be a valid number.');
      return;
    }
    if (form.paymentReceivedEnabled && paymentReceivedTotal > invoiceTotal + 0.0001) {
      setSaveError('Amount received cannot be more than total amount.');
      return;
    }
    if (!Number.isFinite(computedBalance) || computedBalance < 0) {
      setSaveError('Balance Due must be a valid number.');
      return;
    }

    const normalizedServiceSchedules = Array.isArray(serviceScheduleRows)
      ? normalizeServiceScheduleRows(serviceScheduleRows, serviceScheduleTime)
      : buildServiceScheduleRows({
        draft: liveServiceScheduleDraft,
        defaultTime: serviceScheduleTime,
        itemMeta: serviceScheduleItemMeta
      }).map((schedule) => ({
        serviceNumber: schedule.serviceNumber,
        serviceDate: schedule.serviceDate,
        serviceTime: schedule.serviceTime,
        itemId: schedule.itemId || '',
        itemName: schedule.itemName || '',
        itemDescription: schedule.itemDescription || '',
        scheduleRuleLabel: schedule.scheduleRuleLabel || '',
        status: schedule.status || 'Scheduled'
      }));

    const payload = {
      customerId: form.customerId,
      customerName: form.customerName.trim(),
      invoiceType,
      customerType: String(form.customerType || 'New').trim() || 'New',
      billingAddressSource: form.billingAddressSource,
      shippingAddressSource: form.shippingAddressSource,
      customShippingAddresses: form.customShippingAddresses || [],
      placeOfSupply: normalizeGstState(selectedShippingAddress?.placeOfSupply || form.placeOfSupply),
      billingAddressText: buildAddressText(
        selectedCustomer,
        form.billingAddressSource,
        selectedBillingAddress ? addressOptionText(selectedBillingAddress) : form.billingAddressText || form.premiseAddress
      ),
      shippingAddressText: getAddressDisplayText(selectedShippingAddress, form.shippingAddressText || form.premiseAddress),
      customerPremiseId: selectedShippingAddress?.premiseId || selectedBillingAddress?.premiseId || form.customerPremiseId || '',
      premiseLabel: selectedShippingAddress?.label || selectedBillingAddress?.label || form.premiseLabel || '',
      premiseAddress: selectedShippingAddress ? addressOptionText(selectedShippingAddress) : (form.premiseAddress || form.shippingAddressText || ''),
      premiseAreaName: selectedShippingAddress?.area || form.premiseAreaName || '',
      premiseCity: selectedShippingAddress?.city || form.premiseCity || '',
      premiseState: selectedShippingAddress?.state || form.premiseState || '',
      premisePincode: selectedShippingAddress?.pincode || form.premisePincode || '',
      premiseGoogleMapUrl: selectedShippingAddress?.googleMapUrl || form.premiseGoogleMapUrl || '',
      leadSource: String(form.leadSource || '').trim(),
      invoiceNumber: form.invoiceNumber.trim() || createNextInvoiceNumber(invoiceNumberPrefs, invoiceType),
      date: form.date,
      terms: form.terms,
      dueDate: form.dueDate,
      salesperson: form.salesperson.trim(),
      servicePeriod: form.servicePeriod.trim(),
      servicePeriodStart: form.servicePeriodStart || '',
      servicePeriodEnd: form.servicePeriodEnd || '',
      subject: form.subject.trim(),
      items: validItems,
      customerNotes: form.customerNotes.trim(),
      termsAndConditions: form.termsAndConditions.trim(),
      serviceScheduleDefaultTime: serviceScheduleTime,
      serviceSchedules: normalizedServiceSchedules,
      showPaymentDetailsInPdf: Boolean(form.showPaymentDetailsInPdf),
      showGstNumberInPdf: Boolean(form.showGstNumberInPdf),
      paymentReceivedEnabled: Boolean(form.paymentReceivedEnabled),
      paymentSplits: form.paymentReceivedEnabled ? normalizedPaymentSplits : [],
      paymentReceivedTotal: form.paymentReceivedEnabled ? paymentReceivedTotal : 0,
      attachments: form.attachments,
      status,
      subtotal: totals.subtotal,
      totalTax: totals.totalTax,
      amount: invoiceTotal,
      withholdingType: form.withholdingType,
      withholdingRate: Number(form.withholdingRate || 0),
      withholdingAmount: Number(form.withholdingAmount || 0),
      discount: Number(form.discount || 0),
      roundOff: Number(form.roundOff || 0),
      total: Number(form.total || invoiceTotal),
      balanceDue: computedBalance,
      notes: form.customerNotes.trim()
    };

    const invoiceNumberKey = normalizeInvoiceNumberKey(payload.invoiceNumber);
    const duplicateInvoice = invoices.find((invoice) => {
      if (editingId && String(invoice?._id || '') === String(editingId)) return false;
      return normalizeInvoiceNumberKey(invoice?.invoiceNumber) === invoiceNumberKey;
    });
    if (duplicateInvoice) {
      setSaveError('Invoice number already exists. Please use a unique invoice number.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError('');
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/invoices/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/invoices`, payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowBillingAddressPicker(false);
      setShowShippingAddressPicker(false);
      setEditingShippingAddressId('');
      setShippingAddressDraft(emptyAddressDraft);
      setShowModal(false);
      setServiceScheduleDraft(buildServiceScheduleDraftFromInvoice(emptyForm, '10:00'));
      setServiceScheduleRows(null);
      setServiceScheduleExpanded(false);
      setServiceScheduleErrors({});
      setModalOpenedFromContract(false);
      clearInvoiceDraftCache();
      await loadInvoices();
      if (pdfPreview.open && String(pdfPreview.invoiceId || '') === String(editingId || '')) {
        const refreshedPdfUrl = addPdfCacheBust(`${API_BASE_URL}/api/invoices/${editingId}/pdf`);
        setPdfPreview((prev) => ({
          ...prev,
          pdfUrl: refreshedPdfUrl,
          publicShareUrl: refreshedPdfUrl
        }));
      }
      triggerSalesPerformanceRefresh();
      triggerContractsRefresh();
      triggerDashboardRefresh();
      if (modalOpenedFromContract) {
        setModalOpenedFromContract(false);
        navigate('/sales/contracts', { replace: true });
      } else if (routeHasQueryParams) {
        navigate(location.pathname, { replace: true });
      }
    } catch (error) {
      console.error('Failed to save invoice', error);
      handleInvoiceActionError(error, 'Unable to save invoice. Please ensure backend server is running on port 5000.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map((id) => axios.delete(`${API_BASE_URL}/api/invoices/${id}`)));
      setShowMoreMenu(false);
      await loadInvoices();
      triggerSalesPerformanceRefresh();
      triggerContractsRefresh();
      triggerDashboardRefresh();
    } catch (error) {
      console.error('Failed to delete invoices', error);
    }
  };

  const exportData = () => {
    const sourceRows = selectedIds.length > 0
      ? invoices.filter((invoice) => selectedIds.includes(invoice._id))
      : invoices;

    if (sourceRows.length === 0) {
      window.alert('No invoice data available to export.');
      return;
    }

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = columns.map((column) => column.key);
    const sortedRows = [...sourceRows].sort((left, right) => {
      const leftDate = parseInvoiceLikeDate(left?.date || left?.invoiceDate || left?.createdAt);
      const rightDate = parseInvoiceLikeDate(right?.date || right?.invoiceDate || right?.createdAt);
      if (leftDate && rightDate) return rightDate.getTime() - leftDate.getTime();
      if (leftDate) return -1;
      if (rightDate) return 1;
      return 0;
    });
    const rows = [
      headers.join(','),
      ...sortedRows.map((invoice) => headers.map((key) => escapeCsv(invoice[key] ?? '')).join(','))
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
  };

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day30 = new Date(today);
    day30.setDate(day30.getDate() + 30);

    let totalOutstanding = 0;
    let dueToday = 0;
    let dueWithin30 = 0;
    let overdue = 0;

    invoices.forEach((invoice) => {
      const bal = Number(invoice.balanceDue || 0);
      if (bal <= 0) return;
      totalOutstanding += bal;
      const due = parseDateOnly(invoice.dueDate);
      if (!due) return;
      if (due.getTime() === today.getTime()) dueToday += bal;
      if (due > today && due <= day30) dueWithin30 += bal;
      if (due < today) overdue += bal;
    });

    const latestPaymentDateByInvoiceId = new Map();
    (Array.isArray(payments) ? payments : []).forEach((payment) => {
      const invoiceId = String(payment?.invoiceId || '').trim();
      if (!invoiceId) return;
      const paidAt = parseDateOnly(payment?.paymentDate || payment?.date || payment?.createdAt);
      if (!paidAt) return;
      const prev = latestPaymentDateByInvoiceId.get(invoiceId);
      if (!prev || paidAt > prev) {
        latestPaymentDateByInvoiceId.set(invoiceId, paidAt);
      }
    });

    const paidInvoiceDayDiffsByCustomer = invoices.reduce((acc, invoice) => {
      if (String(invoice?.status || '').toUpperCase() !== 'PAID') return acc;
      const invoiceId = String(invoice?._id || '').trim();
      const invoiceDate = parseDateOnly(invoice?.date || invoice?.createdAt);
      const paymentDate = latestPaymentDateByInvoiceId.get(invoiceId);
      if (!invoiceDate || !paymentDate) return acc;
      const diff = Math.max(0, Math.round((paymentDate.getTime() - invoiceDate.getTime()) / 86400000));
      const customerIdKey = String(invoice?.customerId || '').trim();
      const customerNameKey = String(invoice?.customerName || '').trim().toLowerCase();
      const customerKey = customerIdKey || customerNameKey;
      if (!customerKey) return acc;
      if (!acc.has(customerKey)) acc.set(customerKey, []);
      acc.get(customerKey).push(diff);
      return acc;
    }, new Map());

    const customerAverages = Array.from(paidInvoiceDayDiffsByCustomer.values())
      .filter((list) => Array.isArray(list) && list.length > 0)
      .map((list) => list.reduce((sum, days) => sum + days, 0) / list.length);

    const avgDays = customerAverages.length > 0
      ? Math.round(customerAverages.reduce((sum, avg) => sum + avg, 0) / customerAverages.length)
      : 0;

    return { totalOutstanding, dueToday, dueWithin30, overdue, avgDays };
  }, [invoices, payments]);

  const gstDisplay = useMemo(() => {
    const rates = (form.items || [])
      .map((line) => Number(line.taxRate || 0))
      .filter((rate) => Number.isFinite(rate) && rate > 0);
    const effectiveRate = rates.length > 0 ? Math.max(...rates) : 18;
    const halfRate = Number((effectiveRate / 2).toFixed(2));
    const halfTaxAmount = Number((Number(form.totalTax || 0) / 2).toFixed(2));
    return {
      halfRate,
      cgstAmount: halfTaxAmount,
      sgstAmount: halfTaxAmount
    };
  }, [form.items, form.totalTax]);

  const paymentSummary = useMemo(() => {
    const totalAmount = Number(form.total || 0);
    const receivedAmount = form.paymentReceivedEnabled ? sumPaymentSplits(form.paymentSplits || []) : 0;
    const balanceAmount = Number((totalAmount - receivedAmount).toFixed(2));
    return {
      totalAmount,
      receivedAmount,
      balanceAmount,
      isExceeded: receivedAmount > totalAmount + 0.0001
    };
  }, [form.paymentReceivedEnabled, form.paymentSplits, form.total]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const isTiny = viewportWidth <= 380;
  const topbarStyle = isMobile
    ? { ...shell.topbar, alignItems: 'center', padding: isTiny ? '10px 12px' : shell.topbar.padding }
    : shell.topbar;
  const topActionsStyle = isMobile ? { ...shell.topActions, width: 'auto', justifyContent: 'flex-end', gap: isTiny ? '6px' : shell.topActions.gap } : shell.topActions;
  const summaryGridStyle = isMobile
    ? { ...shell.summaryGrid, gridTemplateColumns: isTiny ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '10px' }
    : isTablet
      ? { ...shell.summaryGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : shell.summaryGrid;
  const summaryMetricStyle = isMobile
    ? { ...shell.summaryMetric, minHeight: '112px', padding: isTiny ? '12px' : '12px 14px' }
    : shell.summaryMetric;
  const summaryValueStyle = isMobile ? { ...shell.summaryValue, fontSize: isTiny ? '22px' : '24px' } : shell.summaryValue;
  const customerRowStyle = isMobile ? { ...shell.customerRow, gridTemplateColumns: '1fr' } : shell.customerRow;
  const addressSplitStyle = isMobile
    ? { ...shell.addressSplit, gridTemplateColumns: '1fr', gap: isTiny ? '10px' : '12px' }
    : shell.addressSplit;
  const addressStackStyle = isTiny
    ? {
      ...shell.addressCard,
      padding: '10px 12px',
      display: 'grid',
      gap: '10px'
    }
    : shell.addressCard;
  const addressStackSectionStyle = isTiny
    ? { display: 'grid', gap: '10px' }
    : null;
  const addressCardStyle = isMobile
    ? { ...shell.addressCard, padding: isTiny ? '10px' : '11px' }
    : shell.addressCard;
  const addressTitleStyle = isMobile ? { ...shell.addressTitle, fontSize: isTiny ? '12px' : '13px' } : shell.addressTitle;
  const addressTextStyle = isMobile
    ? { ...shell.addressText, fontSize: isTiny ? '12px' : '12px', lineHeight: 1.32 }
    : shell.addressText;
  const compactContractControlStyle = {
    ...shell.input,
    minHeight: '28px',
    height: '28px',
    fontSize: '13px',
    padding: '0 10px'
  };
  const compactContractDateStyle = {
    ...compactContractControlStyle,
    WebkitAppearance: 'none',
    appearance: 'none'
  };
  const compactContractButtonStyle = {
    ...shell.inputActionButton,
    minHeight: '28px',
    height: '28px',
    minWidth: '28px',
    width: '28px',
    padding: 0
  };
  const customerTypeRowStyle = customerRowStyle;
  const customerTypeOptionsWrapStyle = isMobile
    ? {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '6px'
    }
    : {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '8px',
      alignItems: 'center'
    };
  const customerTypeOptionStyle = (selected) => ({
    minHeight: '28px',
    height: '28px',
    borderRadius: '10px',
    border: selected ? '1px solid var(--color-primary)' : '1px solid #d1d5db',
    background: selected ? 'rgba(215, 34, 74, 0.08)' : '#fff',
    color: selected ? 'var(--color-primary-dark)' : '#334155',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: selected ? 'inset 0 0 0 1px rgba(215, 34, 74, 0.12)' : 'none'
  });
  const topGridStyle = isMobile ? { ...shell.topGrid, gridTemplateColumns: '1fr' } : shell.topGrid;
  const secondGridStyle = isMobile ? { ...shell.secondGrid, gridTemplateColumns: '1fr' } : shell.secondGrid;
  const subjectRowStyle = isMobile ? { ...shell.subjectRow, gridTemplateColumns: '1fr' } : shell.subjectRow;
  const supplyRowStyle = isMobile ? { ...shell.supplyRow, gridTemplateColumns: '1fr' } : shell.supplyRow;
  const totalsWrapStyle = isMobile ? { ...shell.totalsWrap, width: '100%', marginLeft: 0 } : shell.totalsWrap;
  const paymentTotalsStyle = isMobile ? { ...shell.paymentTotals, minWidth: '100%', marginLeft: 0 } : shell.paymentTotals;
  const paymentToggleGroupStyle = isMobile ? { ...shell.paymentToggleGroup, gridTemplateColumns: '1fr', gap: '10px' } : shell.paymentToggleGroup;
  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '16px 10px' } : shell.modalOverlay;
  const modalOverlayLockedStyle = {
    ...modalOverlayStyle,
    overscrollBehavior: 'contain'
  };
  const modalStyle = isMobile
    ? {
      ...shell.modal,
      width: '96vw',
      maxHeight: '92dvh',
      height: '92dvh',
      borderRadius: '16px',
      border: '1px solid rgba(159, 23, 77, 0.24)'
    }
    : {
      ...shell.modal,
      height: '92vh'
    };
  const formBodyStyle = isMobile
    ? {
      ...shell.formBody,
      padding: isTiny ? '10px 12px' : '12px 14px',
      paddingBottom: 'calc(130px + env(safe-area-inset-bottom))',
      WebkitOverflowScrolling: 'touch',
      overflowY: 'scroll',
      scrollbarGutter: 'stable'
    }
    : {
      ...shell.formBody,
      overflowY: 'scroll',
      scrollbarGutter: 'stable'
    };
  const modalFooterStyle = isMobile
    ? {
      ...shell.modalFooter,
      flexDirection: 'column',
      alignItems: 'stretch',
      height: 'auto',
      minHeight: 'unset',
      position: 'sticky',
      bottom: 0,
      background: '#fff',
      padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
      gap: '8px',
      justifyContent: 'flex-start'
    }
    : shell.modalFooter;
  const modalFooterButtonStyle = isMobile
    ? { width: '100%', justifyContent: 'center', minHeight: '42px' }
    : null;
  const miniPrefsGridStyle = isMobile ? { ...shell.miniPrefsGrid, gridTemplateColumns: '1fr', paddingLeft: 0 } : shell.miniPrefsGrid;
  const titleStyle = isTiny ? { ...shell.title, fontSize: '24px' } : shell.title;
  const tinyGhostButtonStyle = isTiny ? { ...shell.buttonGhost, width: '44px', height: '44px' } : shell.buttonGhost;
  const toolbarIconButtonStyle = {
    ...shell.customizeButton,
    width: '34px',
    height: '34px',
    minWidth: '34px',
    minHeight: '34px'
  };
  const topActionIconStyle = {
    ...shell.customizeButton,
    width: '34px',
    height: '34px',
    minWidth: '34px',
    minHeight: '34px'
  };
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, minHeight: '64px', fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const dateInputStyle = {
    ...shell.input,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    textAlign: 'left',
    WebkitAppearance: 'none',
    appearance: 'none'
  };
  const invoiceMobileColumnWidths = ['38px', ...visibleColumnDefs.map((column) => {
    const width = getInvoiceColumnWidth(column.key);
    const fallback = column.key === 'customerName' ? invoiceColumnResizeBounds.customerName.min : 150;
    const resolved = Number.isFinite(width) && width > 0 ? width : fallback;
    return `${resolved}px`;
  }), '84px'];
  const invoiceTableMinWidth = 38 + visibleColumnDefs.reduce((sum, column) => {
      const width = getInvoiceColumnWidth(column.key);
      const fallback = column.key === 'customerName' ? invoiceColumnResizeBounds.customerName.min : 150;
      return sum + (Number.isFinite(width) && width > 0 ? width : fallback);
    }, 0) + 84;
  const tableStyle = {
    ...shell.table,
    width: '100%',
    minWidth: `${invoiceTableMinWidth}px`,
    tableLayout: 'fixed',
    '--invoice-table-min-width': `${invoiceTableMinWidth}px`,
    '--mobile-table-columns': invoiceMobileColumnWidths.join(' '),
    '--mobile-table-min-width': `${invoiceTableMinWidth}px`
  };
  const rowActionButtonStyle = isCompactInvoiceViewport
    ? { ...shell.rowActionButton, width: '28px', height: '28px' }
    : shell.rowActionButton;
  const itemMetaGridStyle = isTiny
    ? { ...shell.itemMetaGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }
    : isMobile
      ? { ...shell.itemMetaGrid, gridTemplateColumns: '1fr' }
      : { ...shell.itemMetaGrid, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2px' };
  const itemMetaFieldStyle = isTiny ? { ...shell.itemMetaField, gap: '3px' } : { ...shell.itemMetaField, gap: '1px' };
  const itemMetaLabelStyle = isTiny ? { ...shell.itemMetaLabel, fontSize: '10px' } : shell.itemMetaLabel;
  const compactItemInputStyle = isTiny
    ? { ...shell.input, minHeight: '28px', height: '28px', fontSize: '12px', padding: '0 10px' }
    : { ...shell.input, minHeight: '28px', height: '28px', fontSize: '13px', padding: '0 8px' };
  const compactItemMetaInputStyle = isTiny
    ? {
      ...shell.itemMetaInput,
      fontSize: '11px'
    }
    : { ...shell.itemMetaInput, minHeight: '28px', height: '28px', padding: '0 7px', fontSize: '11px' };
  const itemTableStyle = isMobile ? { ...shell.itemTable, minWidth: '0', width: '100%', tableLayout: 'fixed' } : { ...shell.itemTable, minWidth: '0', width: '100%', tableLayout: 'fixed' };
  const itemTableWrapStyle = isMobile ? { ...shell.itemTableWrap, overflowX: 'hidden' } : shell.itemTableWrap;
  const serviceScheduleTableStyle = isMobile ? { ...shell.serviceScheduleTable, minWidth: '100%', tableLayout: 'fixed' } : shell.serviceScheduleTable;
  const serviceScheduleThStyle = isMobile ? { ...shell.serviceScheduleTh, fontSize: '11px', padding: '7px 6px' } : shell.serviceScheduleTh;
  const serviceScheduleTdStyle = isMobile ? { ...shell.serviceScheduleTd, fontSize: '11px', padding: '7px 6px', wordBreak: 'break-word' } : shell.serviceScheduleTd;
  const itemMetaDateInputStyle = {
    ...shell.itemMetaInput,
    lineHeight: '1.2',
    textAlign: 'left',
    WebkitAppearance: 'none',
    appearance: 'none'
  };
  const noNumberSpinnerStyle = {
    MozAppearance: 'textfield'
  };
  const compactContractDateInputStyle = {
    ...itemMetaDateInputStyle,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    padding: '0 6px',
    fontSize: '10px'
  };
  const itemRowCellStyle = isMobile ? shell.itemTd : { ...shell.itemTd, padding: '4px 6px', borderBottom: 'none' };
  const numericItemCellStyle = isMobile
    ? itemRowCellStyle
    : { ...itemRowCellStyle, verticalAlign: 'top', padding: '4px 5px', borderBottom: 'none' };
  const itemDetailStackStyle = isMobile
    ? { display: 'flex', flexDirection: 'column', gap: '4px' }
    : { display: 'flex', flexDirection: 'column', gap: '6px' };
  const isAnyOverlayOpen = showModal || showInvoiceNumberPrefs || showBillingAddressPicker || showShippingAddressPicker || Boolean(pdfPreview.open);

  useEffect(() => {
    if (!isAnyOverlayOpen) return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      htmlOverflow: documentElement.style.overflow,
      scrollRestoration: window.history.scrollRestoration
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    documentElement.style.overflow = 'hidden';
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      documentElement.style.overflow = previous.htmlOverflow;
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = previous.scrollRestoration || 'auto';
      }
      window.scrollTo(0, scrollY);
    };
  }, [isAnyOverlayOpen]);
  const compactItemAmountBoxStyle = {
    ...compactItemMetaInputStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '28px',
    height: '28px',
    padding: '0 8px',
    minWidth: '72px'
  };
  const compactItemAmountValueStyle = {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  const shippingAddressEditButtonStyle = {
    ...shell.iconButton,
    width: '28px',
    height: '28px',
    minHeight: '28px',
    borderRadius: '8px'
  };
  const amountActionRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };
  const itemRowDeleteButtonStyle = {
    ...shell.iconButton,
    width: '28px',
    height: '28px',
    minHeight: '28px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    background: '#fff',
    padding: 0,
    flex: '0 0 auto',
    alignSelf: 'center',
    marginTop: 0
  };
  const hideInvoiceShellWhileOpeningModal = routeModalRequest && !showModal && !showInvoiceNumberPrefs;
  const mobileItemInlineGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: isTiny ? '6px' : '8px',
    marginTop: '8px'
  };

  return (
    <section
      className="crm-page crm-section"
      style={{
        ...shell.page,
        visibility: hideInvoiceShellWhileOpeningModal ? 'hidden' : 'visible'
      }}
    >
      <div style={topbarStyle}>
        <div style={shell.titleWrap}>
          <h1 style={titleStyle}>All Invoices</h1>
        </div>
        <div style={topActionsStyle}>
          <button
            ref={menuButtonRef}
            type="button"
            style={toolbarIconButtonStyle}
            aria-label="More options"
            onClick={() => setShowMoreMenu((prev) => !prev)}
          >
            <MoreHorizontal size={12} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              ref={customizeButtonRef}
              type="button"
              style={topActionIconStyle}
              aria-label="Customize fields"
              title="Customize fields"
              onClick={() => setShowCustomize((prev) => !prev)}
            >
              <Settings size={12} />
            </button>
            {showCustomize ? (
              <div ref={customizePanelRef} style={shell.popover}>
                <div style={shell.popoverHeader}>Show/Hide Columns</div>
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
                  <button type="button" style={shell.menuButton} onClick={resetInvoiceColumnWidths}>
                    Reset Column Widths
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showMoreMenu ? (
        <div ref={menuRef} style={shell.menu}>
          <button type="button" style={shell.menuButton} onClick={loadInvoices}>Refresh Invoices</button>
          <button type="button" style={shell.menuButton} onClick={exportData}>Export Data</button>
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

      <div style={shell.summaryWrap}>
        <div style={shell.summaryCard}>
          <h3 style={shell.summaryTitle}>Payment Summary</h3>
          <div style={summaryGridStyle}>
            <div style={summaryMetricStyle}>
              <span style={shell.summaryLabel}>Total Outstanding Receivables</span>
              <span style={summaryValueStyle}>{formatINR(summary.totalOutstanding)}</span>
              <span style={shell.summaryHint}>Unpaid balance</span>
            </div>
            <div style={summaryMetricStyle}>
              <span style={shell.summaryLabel}>Due Today</span>
              <span style={{ ...summaryValueStyle, ...shell.summaryAccent }}>{formatINR(summary.dueToday)}</span>
              <span style={shell.summaryHint}>Today receivables</span>
            </div>
            <div style={summaryMetricStyle}>
              <span style={shell.summaryLabel}>Due Within 30 Days</span>
              <span style={summaryValueStyle}>{formatINR(summary.dueWithin30)}</span>
              <span style={shell.summaryHint}>Upcoming dues</span>
            </div>
            <div style={summaryMetricStyle}>
              <span style={shell.summaryLabel}>Overdue Invoice</span>
              <span style={summaryValueStyle}>{formatINR(summary.overdue)}</span>
              <span style={shell.summaryHint}>Past due amount</span>
            </div>
            <div style={summaryMetricStyle}>
              <span style={shell.summaryLabel}>Average Customer Payment Day</span>
              <span style={summaryValueStyle}>{summary.avgDays} Days</span>
              <span style={shell.summaryHint}>Payment cycle</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...shell.tableWrap, overflowX: 'auto' }} className="crm-table-shell crm-table-shell--clipped">
        <table style={tableStyle} className="crm-compact-table invoice-register-table">
          <colgroup>
            <col style={shell.checkboxWrap} />
            {visibleColumnDefs.map((column) => (
              <col key={column.key} style={getColumnStyle(column.key)} />
            ))}
            <col style={getColumnStyle('action')} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...shell.headCell, ...shell.checkboxWrap, textAlign: 'center' }}>
                <input type="checkbox" style={shell.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumnDefs.map((column) => (
                <th
                  key={column.key}
                  style={{
                    ...shell.headCell,
                    ...getColumnStyle(column.key),
                    ...(isMobile ? {} : shell.resizableHeadCell)
                  }}
                  aria-sort={invoiceSort.key === column.key ? (invoiceSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    onClick={() => toggleInvoiceSort(column.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                      textAlign: 'inherit',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                      color: 'inherit',
                      font: 'inherit',
                      fontWeight: 'inherit',
                      cursor: 'pointer'
                    }}
                    aria-label={`Sort ${column.label} ${invoiceSort.key === column.key && invoiceSort.direction === 'asc' ? 'descending' : 'ascending'}`}
                    title={`Sort ${column.label} ${invoiceSort.key === column.key && invoiceSort.direction === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <span>{column.label}</span>
                    {column.key !== 'action' ? <SortChevronIcon size={12} color="#111827" /> : null}
                  </button>
                </th>
              ))}
              <th
                style={{
                  ...shell.headCell,
                  ...getColumnStyle('action'),
                  ...(isMobile ? {} : shell.resizableHeadCell),
                  textAlign: 'center'
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedInvoices.map((invoice) => (
              <tr key={invoice._id} style={shell.row}>
                <td style={{ ...shell.cell, ...shell.checkboxWrap }} data-label="Select">
                  <input
                    type="checkbox"
                    style={shell.checkbox}
                    checked={selectedIds.includes(invoice._id)}
                    onChange={() => toggleSelectOne(invoice._id)}
                  />
                </td>
                {visibleColumnDefs.map((column) => {
                  let value = invoice[column.key] || '';
                  if (column.key === 'date' || column.key === 'dueDate') value = formatDisplayDate(value);
                  if (column.key === 'amount' || column.key === 'balanceDue') value = formatINR(value);
                  if (column.key === 'status') {
                    return (
                      <td key={`${invoice._id}-${column.key}`} style={{ ...shell.cell, ...shell.statusBadge, ...getColumnStyle(column.key), color: getStatusColor(String(invoice.status || '').toUpperCase()) }} data-label={column.label}>
                        {String(invoice.status || '').toUpperCase()}
                      </td>
                    );
                  }
                  if (column.key === 'invoiceNumber') {
                    return (
                      <td
                        key={`${invoice._id}-${column.key}`}
                        style={{ ...shell.cell, ...shell.invoiceCell, ...getColumnStyle(column.key) }}
                        data-label={column.label}
                        onClick={() => {
                          setSelectedIds([invoice._id]);
                          setModalOpenedFromContract(false);
                          setEditingId(invoice._id);
                          setForm(mapInvoiceToForm(invoice));
                          setShowModal(true);
                        }}
                      >
                        {value}
                      </td>
                    );
                  }
                  return (
                    <td key={`${invoice._id}-${column.key}`} style={{ ...shell.cell, ...getColumnStyle(column.key) }} data-label={column.label}>
                      <span className="crm-cell-wrap">{value}</span>
                    </td>
                  );
                })}
                <td style={{ ...shell.cell, ...getColumnStyle('action'), textAlign: 'left', overflow: 'visible' }} data-label="Action">
                  <div style={shell.rowActionWrap}>
                    <button
                      type="button"
                      style={{ ...rowActionButtonStyle, margin: 0 }}
                      onClick={() => openInvoicePdfPreview(invoice)}
                      title="Preview Invoice"
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backgroundClip: 'padding-box', boxShadow: 'inset 1px 0 0 var(--brand-border-color), inset -1px 0 0 var(--brand-border-color), inset 0 -1px 0 var(--brand-border-color)' }}>
        <div style={shell.paginationInfo}>{firstRecord}-{lastRecord} of {invoices.length} records</div>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <button type="button" style={{ ...tinyGhostButtonStyle, width: '34px', minWidth: '34px', height: '32px', minHeight: '32px', padding: 0 }} disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} /></button>
          <button type="button" style={{ ...tinyGhostButtonStyle, width: '34px', minWidth: '34px', height: '32px', minHeight: '32px', padding: 0 }} disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" title="Next page"><ChevronRight size={16} /></button>
        </div>
      </div>

      {showModal ? createPortal(
        <div style={modalOverlayLockedStyle}>
          <form className="crm-modal-surface" style={modalStyle} onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
            <div className="crm-modal-surface-header" style={modalHeaderStyle}>
              <h3 style={shell.modalHeaderTitle}>{contractViewOnly ? 'View Contract' : editingId ? 'Edit Contract' : 'New Contract'}</h3>
              <button type="button" style={shell.modalCloseButton} onClick={closeInvoiceModal} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            <fieldset
              disabled={contractViewOnly}
              style={{
                border: 'none',
                margin: 0,
                padding: 0,
                minWidth: 0,
                minHeight: 0,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
            <div className="crm-modal-surface-body" style={formBodyStyle}>
              <div style={customerTypeRowStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Customer Type*</label>
                <div style={customerTypeOptionsWrapStyle}>
                  {contractCustomerTypeOptions.map((option) => {
                    const selected = form.customerType === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        style={customerTypeOptionStyle(selected)}
                        onClick={() => setFormWithTotals((prev) => ({ ...prev, customerType: option }))}
                      >
                        <Check size={14} style={{ opacity: selected ? 1 : 0, flexShrink: 0 }} />
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={customerRowStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Customer Name*</label>
                <input
                  list={customerNameDatalistId}
                  style={compactContractControlStyle}
                  value={form.customerName}
                  placeholder="Type to search or add a customer"
                  onChange={(event) => handleCustomerChange(event.target.value)}
                />
                <datalist id={customerNameDatalistId}>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.name} />
                  ))}
                </datalist>
              </div>

              {isTiny ? (
                <div style={addressStackStyle}>
                  <div style={addressStackSectionStyle}>
                    <div style={shell.addressHead}>
                      <h4 style={addressTitleStyle}>Billing Address</h4>
                      <div style={shell.addressHeadActions}>
                        <button
                          type="button"
                          style={shippingAddressEditButtonStyle}
                          onClick={openBillingAddressPicker}
                          title="Edit Billing Address"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                    <p style={addressTextStyle}>{getAddressDisplayText(selectedBillingAddress, form.billingAddressText || (selectedShippingAddress ? addressOptionText(selectedShippingAddress) : ''))}</p>
                  </div>
                  <div style={{ height: '1px', background: 'var(--color-border)', opacity: 0.75 }} />
                  <div style={addressStackSectionStyle}>
                    <div style={shell.addressHead}>
                      <h4 style={addressTitleStyle}>Shipping Address</h4>
                      <div style={shell.addressHeadActions}>
                        <button
                          type="button"
                          style={shippingAddressEditButtonStyle}
                          onClick={openShippingAddressPicker}
                          title="Edit Shipping Address"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                    <p style={addressTextStyle}>{getAddressDisplayText(selectedShippingAddress, form.shippingAddressText || form.premiseAddress)}</p>
                  </div>
                </div>
              ) : (
                <div style={addressSplitStyle}>
                  <div style={addressCardStyle}>
                    <div style={shell.addressHead}>
                      <h4 style={addressTitleStyle}>Billing Address</h4>
                      <div style={shell.addressHeadActions}>
                        <button
                          type="button"
                          style={shippingAddressEditButtonStyle}
                          onClick={openBillingAddressPicker}
                          title="Edit Billing Address"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                    <p style={addressTextStyle}>{getAddressDisplayText(selectedBillingAddress, form.billingAddressText || (selectedShippingAddress ? addressOptionText(selectedShippingAddress) : ''))}</p>
                  </div>
                  <div style={addressCardStyle}>
                    <div style={shell.addressHead}>
                      <h4 style={addressTitleStyle}>Shipping Address</h4>
                      <div style={shell.addressHeadActions}>
                        <button
                          type="button"
                          style={shippingAddressEditButtonStyle}
                          onClick={openShippingAddressPicker}
                          title="Edit Shipping Address"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                    <p style={addressTextStyle}>{getAddressDisplayText(selectedShippingAddress, form.shippingAddressText || form.premiseAddress)}</p>
                  </div>
                </div>
              )}

              <div style={supplyRowStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Place of Supply*</label>
                <select
                  style={compactContractControlStyle}
                  value={form.placeOfSupply}
                  onChange={(event) => setFormWithTotals((prev) => ({ ...prev, placeOfSupply: event.target.value }))}
                >
                  <option value="">Select GST state</option>
                  {gstStateOptions.map((state) => {
                    const label = getGstStateLabel(state);
                    return (
                      <option key={state.code} value={label}>{label}</option>
                    );
                  })}
                </select>
                <label style={shell.label}>Lead Source</label>
                <select
                  style={compactContractControlStyle}
                  value={form.leadSource}
                  onChange={(event) => setFormWithTotals((prev) => ({ ...prev, leadSource: event.target.value }))}
                >
                  <option value="">Select lead source</option>
                  {leadSourceOptions.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div style={topGridStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Invoice#*</label>
                <div style={shell.inputWithAction}>
                  <input
                    style={{ ...compactContractControlStyle, ...shell.inputMainWithButton }}
                    value={form.invoiceNumber}
                    onChange={(event) => {
                      invoiceNumberManuallyEditedRef.current = true;
                      setFormWithTotals((prev) => ({ ...prev, invoiceNumber: event.target.value }));
                    }}
                  />
                  <button
                    type="button"
                    style={compactContractButtonStyle}
                    onClick={openInvoiceNumberPrefs}
                    title="Configure invoice number"
                  >
                    <Settings size={20} />
                  </button>
                </div>

                <label style={{ ...shell.label, ...shell.labelRequired }}>Invoice Date*</label>
                <CompactCalendarDateInput
                  style={compactContractDateStyle}
                  value={form.date}
                  onChange={(event) => handleDateChange(event.target.value)}
                  ariaLabel="invoice date"
                />

                <label style={shell.label}>Terms</label>
                <select
                  style={compactContractControlStyle}
                  value={form.terms}
                  onChange={(event) => handleTermsChange(event.target.value)}
                >
                  {termsOptions.map((terms) => (
                    <option key={terms} value={terms}>{terms}</option>
                  ))}
                </select>

                <label style={shell.label}>Due Date</label>
                <CompactCalendarDateInput
                  style={compactContractDateStyle}
                  value={form.dueDate}
                  onChange={(event) => setFormWithTotals((prev) => ({ ...prev, dueDate: event.target.value }))}
                  ariaLabel="due date"
                />
              </div>

              <div style={secondGridStyle}>
                <label style={shell.label}>Sales Person</label>
                <select
                  style={compactContractControlStyle}
                  value={form.salesperson}
                  onChange={(event) => setFormWithTotals((prev) => ({ ...prev, salesperson: event.target.value }))}
                >
                  <option value="">Select Sales Team Member</option>
                  {form.salesperson && !salespersonOptions.includes(form.salesperson) ? (
                    <option value={form.salesperson}>{form.salesperson}</option>
                  ) : null}
                  {salespersonOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <label style={shell.label}>Invoice Type</label>
                <select
                  style={compactContractControlStyle}
                  value={form.invoiceType}
                  onChange={(event) => handleInvoiceTypeChange(event.target.value)}
                >
                  <option value="GST">GST Invoice</option>
                  <option value="NON GST">Non GST Invoice</option>
                </select>
              </div>

              {!modalOpenedFromContract ? (
                <div style={subjectRowStyle}>
                  <label style={shell.label}>Subject</label>
                  <input
                    style={compactContractControlStyle}
                    placeholder="Let your customer know what this Invoice is for"
                    value={form.subject}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, subject: event.target.value }))}
                  />
                </div>
              ) : null}

              <div style={shell.itemSection}>
                <div style={itemTableWrapStyle}>
                  <table style={itemTableStyle}>
                    <thead>
                      {isMobile ? (
                        <tr>
                          <th style={{ ...shell.itemTh, width: '100%' }}>Item Details</th>
                        </tr>
                      ) : (
                        <tr style={{ boxShadow: 'inset 0 -1px 0 #d1d5db' }}>
                          <th style={{ ...shell.itemTh, width: '52%' }}>Item Details</th>
                          <th style={{ ...shell.itemTh, width: '10%' }}>Quantity</th>
                          <th style={{ ...shell.itemTh, width: '12%' }}>Rate</th>
                          <th style={{ ...shell.itemTh, width: '12%' }}>Tax</th>
                          <th style={{ ...shell.itemTh, width: '14%' }}>Amount</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {form.items.map((line, index) => {
                        const qty = parseDecimalNumber(line.quantity, 0);
                        const rate = parseDecimalNumber(line.rate, 0);
                        const base = qty * rate;
                        const amount = base;
                        return (
                          <tr key={`${index}-${line.itemId || 'line'}`}>
                            <td style={itemRowCellStyle}>
                              <div style={itemDetailStackStyle}>
                                <select
                                  style={compactItemInputStyle}
                                  value={line.itemId}
                                  onChange={(event) => handleItemSelect(index, event.target.value)}
                                >
                                  <option value="">Type or click to select an item.</option>
                                  {sortedItemsCatalog.map((item) => (
                                    <option key={item._id} value={item._id}>{item.name}</option>
                                  ))}
                                </select>
                                <input
                                  style={compactItemInputStyle}
                                  placeholder="Frequency"
                                  value={line.frequency || ''}
                                  onChange={(event) => updateLine(index, { frequency: event.target.value })}
                                />
                                <span style={shell.tinyText}>
                                  {line.itemType?.toUpperCase() || 'SERVICE'} SAC: {line.sac || '-'}
                                </span>
                                <div style={itemMetaGridStyle}>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Contract Period</span>
                                    <select
                                      style={compactItemMetaInputStyle}
                                      value={line.contractPeriod || ''}
                                      onChange={(event) => updateLine(index, { contractPeriod: event.target.value })}
                                    >
                                      <option value="">Select period</option>
                                      {contractPeriodOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Contract Start Date</span>
                                    <CompactCalendarDateInput
                                      style={compactContractDateInputStyle}
                                      value={line.contractStartDate || ''}
                                      onChange={(event) => updateLine(index, { contractStartDate: event.target.value })}
                                      ariaLabel="contract start date"
                                    />
                                  </div>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Contract End Date</span>
                                    <CompactCalendarDateInput
                                      style={compactContractDateInputStyle}
                                      value={line.contractEndDate || ''}
                                      readOnly
                                      ariaLabel="contract end date"
                                    />
                                  </div>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Renewal Date</span>
                                    <CompactCalendarDateInput
                                      style={compactContractDateInputStyle}
                                      value={line.renewalDate || ''}
                                      readOnly
                                      ariaLabel="renewal date"
                                    />
                                  </div>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Service Frequency</span>
                                    <select
                                      style={compactItemMetaInputStyle}
                                      value={line.serviceFrequency || ''}
                                      onChange={(event) => updateLine(index, { serviceFrequency: event.target.value })}
                                    >
                                      <option value="">Select frequency</option>
                                      {serviceFrequencyOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Preferred Day</span>
                                    <select
                                      style={compactItemMetaInputStyle}
                                      value={line.serviceWeekday || ''}
                                      onChange={(event) => updateLine(index, { serviceWeekday: event.target.value })}
                                    >
                                      {serviceSchedulePreferredDayOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={itemMetaFieldStyle}>
                                    <span style={itemMetaLabelStyle}>Total Services</span>
                                    <input
                                      style={compactItemMetaInputStyle}
                                      value={line.totalServices || ''}
                                      readOnly
                                    />
                                  </div>
                                </div>
                                {isMobile ? (
                                  <>
                                    <div style={mobileItemInlineGridStyle}>
                                      <div style={itemMetaFieldStyle}>
                                        <span style={itemMetaLabelStyle}>Quantity</span>
                                        <input
                                          style={{ ...compactItemMetaInputStyle, ...noNumberSpinnerStyle, WebkitAppearance: 'none', appearance: 'textfield' }}
                                          type="text"
                                          inputMode="decimal"
                                          pattern="[0-9]*[.,]?[0-9]*"
                                          value={line.quantity}
                                          onChange={(event) => updateLine(index, { quantity: sanitizeDecimalInput(event.target.value) })}
                                        />
                                      </div>
                                      <div style={itemMetaFieldStyle}>
                                        <span style={itemMetaLabelStyle}>Rate</span>
                                        <input
                                          style={compactItemMetaInputStyle}
                                          type="text"
                                          inputMode="decimal"
                                          pattern="[0-9]*[.,]?[0-9]*"
                                          value={line.rate}
                                          onChange={(event) => updateLine(index, { rate: sanitizeDecimalInput(event.target.value) })}
                                        />
                                      </div>
                                    </div>
                                    <div style={mobileItemInlineGridStyle}>
                                      <div style={itemMetaFieldStyle}>
                                        <span style={itemMetaLabelStyle}>Tax</span>
                                        <select
                                          style={compactItemMetaInputStyle}
                                          value={line.taxRate}
                                          onChange={(event) => updateLine(index, { taxRate: event.target.value })}
                                          disabled={form.invoiceType === 'NON GST'}
                                        >
                                          {(form.invoiceType === 'NON GST' ? [0] : taxOptions).map((tax) => (
                                            <option key={tax} value={String(tax)}>{tax}%</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div style={itemMetaFieldStyle}>
                                        <span style={itemMetaLabelStyle}>Amount</span>
                                        <div style={amountActionRowStyle}>
                                          <div style={compactItemAmountBoxStyle}>
                                            <strong style={compactItemAmountValueStyle}>{formatINR(amount)}</strong>
                                          </div>
                                          <button type="button" style={itemRowDeleteButtonStyle} onClick={() => removeLine(index)} title="Remove row">
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                  </div>
                                </>
                              ) : null}
                            </div>
                            </td>
                            {!isMobile ? (
                              <>
                                <td style={numericItemCellStyle}>
                                  <input
                                    style={{ ...compactItemMetaInputStyle, ...noNumberSpinnerStyle, WebkitAppearance: 'none', appearance: 'textfield' }}
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]*"
                                    value={line.quantity}
                                    onChange={(event) => updateLine(index, { quantity: sanitizeDecimalInput(event.target.value) })}
                                  />
                                </td>
                                <td style={numericItemCellStyle}>
                                  <input
                                    style={compactItemMetaInputStyle}
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]*"
                                    value={line.rate}
                                    onChange={(event) => updateLine(index, { rate: sanitizeDecimalInput(event.target.value) })}
                                  />
                                </td>
                                <td style={numericItemCellStyle}>
                                  <select
                                    style={compactItemMetaInputStyle}
                                    value={line.taxRate}
                                    onChange={(event) => updateLine(index, { taxRate: event.target.value })}
                                    disabled={form.invoiceType === 'NON GST'}
                                  >
                                    {(form.invoiceType === 'NON GST' ? [0] : taxOptions).map((tax) => (
                                      <option key={tax} value={String(tax)}>{tax}%</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ ...numericItemCellStyle, fontWeight: 700, verticalAlign: 'top' }}>
                                  <div style={amountActionRowStyle}>
                                    <div style={compactItemAmountBoxStyle}>
                                      <span style={compactItemAmountValueStyle}>{formatINR(amount)}</span>
                                    </div>
                                    <button type="button" style={itemRowDeleteButtonStyle} onClick={() => removeLine(index)} title="Remove row">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={shell.itemActionsRow}>
                <button type="button" style={shell.addRowBtn} onClick={addLine}>Add New Row</button>
              </div>

              <div style={totalsWrapStyle}>
                <div style={shell.totalRow}><span>Sub Total</span><strong>{formatINR(form.subtotal)}</strong></div>
                {form.invoiceType === 'GST' ? (
                  <div style={shell.gstRowsWrap}>
                    <div style={shell.gstRow}>
                      <span>{`CGST [${gstDisplay.halfRate}%]`}</span>
                      <strong>{formatINR(gstDisplay.cgstAmount)}</strong>
                    </div>
                    <div style={shell.gstRow}>
                      <span>{`SGST [${gstDisplay.halfRate}%]`}</span>
                      <strong>{formatINR(gstDisplay.sgstAmount)}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={shell.totalRow}>
                    <span>GST</span>
                    <strong>{formatINR(0)}</strong>
                  </div>
                )}
                <div style={shell.totalRow}>
                  <span>Discount</span>
                  <input
                    style={{ ...shell.input, width: '88px', minHeight: '32px', height: '32px', textAlign: 'right', ...noNumberSpinnerStyle, WebkitAppearance: 'none', appearance: 'textfield' }}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={form.discount}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, discount: sanitizeDecimalInput(event.target.value) }))}
                  />
                </div>
                <div style={shell.totalRow}>
                  <span>Round Off</span>
                  <input
                    style={{ ...shell.input, width: '88px', minHeight: '32px', height: '32px', textAlign: 'right', ...noNumberSpinnerStyle, WebkitAppearance: 'none', appearance: 'textfield' }}
                    type="text"
                    inputMode="decimal"
                    pattern="[+-]?[0-9]*[.,]?[0-9]*"
                    value={form.roundOff}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, roundOff: sanitizeSignedDecimalInput(event.target.value) }))}
                  />
                </div>
                <div style={shell.totalSummaryRow}>
                  <span style={shell.totalLast}>Total ( ₹ )</span>
                  <strong style={shell.totalLast}>{formatINR(form.total)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={shell.label}>Terms & Conditions</label>
                  <textarea
                    style={{ ...shell.textArea, borderRadius: '6px', minHeight: '64px' }}
                    placeholder="Enter the terms and conditions of your business"
                    value={form.termsAndConditions}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, termsAndConditions: event.target.value }))}
                  />
                  {!editingId && settingsHydrated && String(form.termsAndConditions || '').trim() && String(form.termsAndConditions || '').trim() === getDefaultTermsForInvoiceType(form.invoiceType) ? (
                    <span style={shell.helperText}>Loaded from Settings</span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <ServiceScheduleBuilder
                    draft={liveServiceScheduleDraft}
                    time={serviceScheduleTime}
                    defaultItemMeta={serviceScheduleItemMeta}
                    scheduleRows={Array.isArray(serviceScheduleRows) && serviceScheduleRows.length > 0 ? serviceScheduleRows : liveMultiItemScheduleRows}
                    onDraftChange={setServiceScheduleDraft}
                    onTimeChange={(nextTime) =>
                      setFormWithTotals((prev) => ({
                        ...prev,
                        serviceScheduleDefaultTime: nextTime
                      }))
                    }
                    onGenerate={handleGenerateServiceSchedule}
                    onReset={handleResetServiceSchedule}
                    onRowsChange={handleServiceScheduleRowsChange}
                    errors={serviceScheduleErrors}
                    expanded={serviceScheduleExpanded}
                    onExpandedChange={setServiceScheduleExpanded}
                  />
                </div>
                <div style={shell.paymentBlock}>
                  <div style={paymentToggleGroupStyle}>
                    <label style={shell.paymentToggle}>
                      <input
                        type="checkbox"
                        style={shell.checkbox}
                        checked={Boolean(form.showPaymentDetailsInPdf)}
                        onChange={(event) =>
                          setFormWithTotals((prev) => ({
                            ...prev,
                            showPaymentDetailsInPdf: event.target.checked
                          }))
                        }
                      />
                      Show payment details in PDF
                    </label>

                    <label style={shell.paymentToggle}>
                      <input
                        type="checkbox"
                        style={shell.checkbox}
                        checked={Boolean(form.showGstNumberInPdf)}
                        onChange={(event) =>
                          setFormWithTotals((prev) => ({
                            ...prev,
                            showGstNumberInPdf: event.target.checked
                          }))
                        }
                      />
                      Customer GST No. in PDF
                    </label>

                    <label style={shell.paymentToggle}>
                      <input
                        type="checkbox"
                        style={shell.checkbox}
                        checked={Boolean(form.paymentReceivedEnabled)}
                        onChange={(event) =>
                          setFormWithTotals((prev) => ({
                            ...prev,
                            paymentReceivedEnabled: event.target.checked,
                            paymentSplits: event.target.checked
                              ? (Array.isArray(prev.paymentSplits) && prev.paymentSplits.length > 0 ? prev.paymentSplits : [createEmptyPaymentSplit(getDefaultPaymentDepositTo(prev.invoiceType))])
                              : prev.paymentSplits
                          }))
                        }
                      />
                      I have received the payment
                    </label>
                  </div>

                  {form.paymentReceivedEnabled ? (
                    <>
                      <div style={shell.paymentTableWrap}>
                        <table style={shell.paymentTable}>
                          <thead>
                            <tr>
                              <th style={shell.paymentTh}>Payment Mode</th>
                              <th style={shell.paymentTh}>Deposit To</th>
                              <th style={{ ...shell.paymentTh, textAlign: 'right' }}>Amount Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(form.paymentSplits || []).map((split, index) => (
                              <tr key={`payment-split-${index}`}>
                                <td style={shell.paymentTd}>
                                  <select
                                    style={shell.paymentInput}
                                    value={split.mode || 'Cheque'}
                                    onChange={(event) => updatePaymentSplit(index, { mode: event.target.value })}
                                  >
                                    {paymentModeOptions.map((mode) => (
                                      <option key={mode} value={mode}>{mode}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={shell.paymentTd}>
                                  <select
                                    style={shell.paymentInput}
                                    value={normalizePaymentDepositTo(split.depositTo, form.invoiceType)}
                                    onChange={(event) => updatePaymentSplit(index, { depositTo: event.target.value })}
                                  >
                                    {paymentDepositOptions.map((account) => (
                                      <option key={account} value={account}>{account}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={shell.paymentTd}>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]*"
                                    style={{ ...shell.paymentInput, textAlign: 'right' }}
                                    value={split.amount ?? '0'}
                                    onChange={(event) => updatePaymentSplit(index, { amount: sanitizeDecimalInput(event.target.value) })}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={shell.splitPaymentRow}>
                        <button type="button" style={shell.splitPaymentBtn} onClick={addPaymentSplit}>
                          <PlusCircle size={16} />
                          Add Split Payment
                        </button>
                        <div style={paymentTotalsStyle}>
                          <div style={shell.paymentTotalRow}>
                            <span>Total (₹) :</span>
                            <strong>{formatINR(paymentSummary.totalAmount)}</strong>
                          </div>
                          <div style={shell.paymentTotalRow}>
                            <span>Amount Received (₹) :</span>
                            <strong>{formatINR(paymentSummary.receivedAmount)}</strong>
                          </div>
                          <div style={shell.paymentBalanceRow}>
                            <span>Balance Amount (₹) :</span>
                            <strong>{formatINR(Math.max(paymentSummary.balanceAmount, 0))}</strong>
                          </div>
                        </div>
                      </div>
                      {paymentSummary.isExceeded ? (
                        <div style={shell.paymentWarn}>Amount received cannot be more than total amount.</div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            </fieldset>

            <div className="crm-modal-surface-footer" style={modalFooterStyle}>
              {saveError ? (
                <div style={{ marginRight: 'auto', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                  {saveError}
                </div>
              ) : null}
              <button
                type="button"
                style={modalFooterButtonStyle ? { ...shell.cancelButton, ...modalFooterButtonStyle } : shell.cancelButton}
                onClick={closeInvoiceModal}
              >
                {contractViewOnly ? 'Close' : 'Cancel'}
              </button>
              {contractViewOnly ? (
                <button
                  type="button"
                  style={modalFooterButtonStyle ? { ...shell.saveButton, ...modalFooterButtonStyle } : shell.saveButton}
                  onClick={openContractForEditing}
                >
                  Edit Contract
                </button>
              ) : null}
              {contractViewOnly ? null : (
                <button type="submit" style={modalFooterButtonStyle ? { ...shell.saveButton, ...modalFooterButtonStyle } : shell.saveButton} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Contract' : 'Save Contract'}
                </button>
              )}
            </div>
          </form>
        </div>,
        document.body
      ) : null}

      {showInvoiceNumberPrefs ? createPortal(
        <div style={shell.miniModalOverlay}>
          <div style={shell.miniModal}>
            <div style={shell.miniModalHead}>
              <h3 style={shell.miniModalTitle}>Configure Invoice Number Preferences</h3>
              <button
                type="button"
                style={shell.miniCloseButton}
                onClick={() => setShowInvoiceNumberPrefs(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div style={shell.miniModalBody}>
              <p style={shell.miniModalNote}>
                Your invoice numbers can be auto-generated to save time. You can still edit the invoice number manually in the form.
              </p>
              <label style={shell.miniRadioRow}>
                <input
                  type="radio"
                  checked={invoiceNumberPrefsDraft.mode === 'auto'}
                  onChange={() => setInvoiceNumberPrefsDraft((prev) => ({ ...prev, mode: 'auto' }))}
                />
                Continue auto-generating invoice numbers
              </label>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={miniPrefsGridStyle}>
                  <div>
                    <label style={shell.label}>GST Prefix</label>
                    <input
                      style={shell.input}
                      value={invoiceNumberPrefsDraft.gstPrefix}
                      onChange={(event) =>
                        setInvoiceNumberPrefsDraft((prev) => ({ ...prev, gstPrefix: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label style={shell.label}>GST Next Number</label>
                    <input
                      style={shell.input}
                      inputMode="numeric"
                      value={String(invoiceNumberPrefsDraft.gstNextNumber ?? '')}
                      onChange={(event) =>
                        setInvoiceNumberPrefsDraft((prev) => ({
                          ...prev,
                          gstNextNumber: event.target.value.replace(/\D/g, '')
                        }))
                      }
                    />
                  </div>
                </div>
                <div style={miniPrefsGridStyle}>
                  <div>
                    <label style={shell.label}>NON GST Prefix</label>
                    <input
                      style={shell.input}
                      value={invoiceNumberPrefsDraft.nonGstPrefix}
                      onChange={(event) =>
                        setInvoiceNumberPrefsDraft((prev) => ({ ...prev, nonGstPrefix: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label style={shell.label}>NON GST Next Number</label>
                    <input
                      style={shell.input}
                      inputMode="numeric"
                      value={String(invoiceNumberPrefsDraft.nonGstNextNumber ?? '')}
                      onChange={(event) =>
                        setInvoiceNumberPrefsDraft((prev) => ({
                          ...prev,
                          nonGstNextNumber: event.target.value.replace(/\D/g, '')
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <label style={shell.miniRadioRow}>
                <input
                  type="radio"
                  checked={invoiceNumberPrefsDraft.mode === 'manual'}
                  onChange={() => setInvoiceNumberPrefsDraft((prev) => ({ ...prev, mode: 'manual' }))}
                />
                Enter invoice numbers manually
              </label>
            </div>
            <div style={shell.miniFooter}>
              <button type="button" style={shell.saveButton} onClick={saveInvoiceNumberPrefs}>Save</button>
              <button type="button" style={shell.cancelButton} onClick={() => setShowInvoiceNumberPrefs(false)}>Cancel</button>
            </div>
          </div>
        </div>
      , document.body) : null}

      {showBillingAddressPicker ? (
        <div style={shell.addressPickerOverlay}>
          <div style={{ ...shell.addressPicker, width: 'min(100%, 640px)' }}>
            <div style={shell.addressPickerHead}>
              <h3 style={shell.addressPickerTitle}>Billing Address</h3>
              <button
                type="button"
                style={shell.addressPickerCloseButton}
                onClick={() => setShowBillingAddressPicker(false)}
              >
                Close
              </button>
            </div>
            <div style={shell.addressList}>
              {billingAddressOptions.map((option) => (
                <div
                  key={option.id}
                  style={{
                    ...shell.addressChoiceCard,
                    ...(form.billingAddressSource === option.id ? shell.addressChoiceCardActive : {})
                  }}
                  onClick={() => selectBillingAddressOption(option.id)}
                >
                  <div>
                    <p style={shell.addressChoiceTitle}>{displayAddressLabel(option)}</p>
                    <p style={shell.addressChoiceText}>{addressOptionText(option)}</p>
                  </div>
                </div>
              ))}
              <button type="button" style={shell.newAddressBtn} onClick={startNewBillingAddress}>
                <PlusCircle size={14} /> New address
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showShippingAddressPicker ? (
        <div style={shell.addressPickerOverlay}>
          <div style={shell.addressPicker}>
            <div style={shell.addressPickerHead}>
              <h3 style={shell.addressPickerTitle}>Shipping Address</h3>
              <button
                type="button"
                style={shell.addressPickerCloseButton}
                onClick={() => {
                  setShowShippingAddressPicker(false);
                  setEditingShippingAddressId('');
                  setShippingAddressDraft(emptyAddressDraft);
                }}
              >
                Close
              </button>
            </div>
            <div style={shell.addressList}>
              {shippingAddressOptions.map((option) => (
                <div
                  key={option.id}
                  style={{
                    ...shell.addressChoiceCard,
                    ...(form.shippingAddressSource === option.id ? shell.addressChoiceCardActive : {})
                  }}
                  onClick={() => selectShippingAddressOption(option.id)}
                >
                  <div>
                    <p style={shell.addressChoiceTitle}>{displayAddressLabel(option)}</p>
                    <p style={shell.addressChoiceText}>{addressOptionText(option)}</p>
                  </div>
                  {option.id.startsWith('custom-') ? (
                    <button
                      type="button"
                      style={shell.iconButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        startEditShippingAddress(option.id);
                      }}
                      title="Edit this address"
                    >
                      <Pencil size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
              <button type="button" style={shell.newAddressBtn} onClick={startNewShippingAddress}>
                <PlusCircle size={14} /> New address
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showShippingAddressPicker && editingShippingAddressId ? (
        <div style={shell.miniModalOverlay}>
          <div style={{ ...shell.miniModal, width: 'min(100%, 900px)' }}>
            <div style={shell.miniModalHead}>
              <h3 style={shell.miniModalTitle}>
                {editingShippingAddressId === 'new' || editingShippingAddressId === 'new-premise' ? 'Add New Address' : 'Edit Address'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(editingShippingAddressId === 'new' || editingShippingAddressId === 'new-premise') && addressDraftTarget === 'shipping' ? (
                  <button
                    type="button"
                    style={shell.copyBillingBtn}
                    onClick={copyBillingIntoNewAddressDraft}
                  >
                    Copy billing address
                  </button>
                ) : null}
                <button
                  type="button"
                  style={shell.cancelButton}
                  onClick={() => {
                    setEditingShippingAddressId('');
                    setShippingAddressDraft(emptyAddressDraft);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div
              style={{
                ...shell.miniModalBody,
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '170px minmax(0, 1fr)',
                columnGap: '12px',
                rowGap: '10px'
              }}
            >
              <label style={shell.label}>Label</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.label}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, label: event.target.value }))}
              />
              <label style={shell.label}>Display Name</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.company}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, company: event.target.value }))}
              />
              <label style={shell.label}>Address</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.line1}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, line1: event.target.value }))}
              />
              <label style={shell.label}>Area Name</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.area}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, area: event.target.value }))}
              />
              <label style={shell.label}>City</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.city}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, city: event.target.value }))}
              />
              <label style={shell.label}>State</label>
              <select
                style={shell.input}
                value={shippingAddressDraft.state}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, state: event.target.value }))}
              >
                {gstStateOptionsWithDelhiFirst.map((state) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
              <label style={shell.label}>Pincode</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.pincode}
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, pincode: toSixDigitPincode(event.target.value) }))}
              />
            </div>
            <div style={shell.miniFooter}>
              <button type="button" style={shell.saveButton} onClick={saveShippingAddressDraft}>
                Save Address
              </button>
              <button
                type="button"
                style={shell.cancelButton}
                onClick={() => {
                  setEditingShippingAddressId('');
                  setShippingAddressDraft(emptyAddressDraft);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', invoiceId: '' })}
        onShareEmail={async () => {
          const invoice = invoices.find((entry) => String(entry._id) === String(pdfPreview.invoiceId));
          if (invoice) await runInvoiceAction(invoice, 'email');
        }}
        onShareWhatsApp={async () => {
          const invoice = invoices.find((entry) => String(entry._id) === String(pdfPreview.invoiceId));
          if (invoice) await runInvoiceAction(invoice, 'whatsapp');
        }}
        publicShareUrl={pdfPreview.publicShareUrl}
      />
    </section>
  );
}
