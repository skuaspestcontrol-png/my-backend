import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, MoreHorizontal, Pencil, PlusCircle, Settings, Trash2, X } from 'lucide-react';
import {
  defaultInvoiceVisibleColumns,
  invoiceColumns as columns,
  normalizeInvoiceVisibleColumns
} from '../utils/invoicePreferences';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const termsOptions = ['Paid', 'Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const termsToDays = { Paid: 0, 'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Net 60': 60 };
const taxOptions = [0, 5, 12, 18];
const paymentModeOptions = ['Cheque', 'Cash', 'Bank Transfer', 'UPI', 'Card'];
const paymentDepositOptions = ['Billing', 'Bank', 'Cash', 'Undeposited Funds'];
const contractPeriodOptions = [
  { value: 'single_time', label: 'Single time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly_visits', label: 'Fortnightly Visits' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_monthly', label: 'Bi-Monthly' },
  { value: 'quarterly', label: 'Quaterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual' },
  { value: 'two_years', label: '2 years' },
  { value: 'three_years', label: '3 years' },
  { value: 'five_years', label: '5 years' },
  { value: 'ten_years', label: '10 years' }
];
const serviceFrequencyOptions = [
  { value: 'single_treatment_no_followup', label: 'Single treatment without any followup' },
  { value: 'single_followup_7', label: 'Single Visit then on followup visit after 7 days' },
  { value: 'single_followup_10', label: 'Single Visit then on followup visit after 10 days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_monthly', label: 'Bi-Monthly' },
  { value: 'quarterly_visits', label: 'Quaterly Visits' },
  { value: 'three_treatment_every_4_months', label: 'Three treatment Every 4th Months' },
  { value: 'initial_spray_gel_batting_7_then_4m', label: 'Initial Spray treatment with Gel Batting after 7 days then Every 4 Months' }
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
  single_treatment_no_followup: { type: 'single_once' },
  single_followup_7: { type: 'followup_days', value: 7 },
  single_followup_10: { type: 'followup_days', value: 10 },
  weekly: { type: 'interval_days', value: 7 },
  fortnightly: { type: 'interval_days', value: 14 },
  monthly: { type: 'interval_months', value: 1 },
  bi_monthly: { type: 'interval_months', value: 2 },
  quarterly_visits: { type: 'interval_months', value: 3 },
  three_treatment_every_4_months: { type: 'interval_months', value: 4 },
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

const createEmptyLine = () => ({
  itemId: '',
  itemName: '',
  description: '',
  sac: '',
  itemType: 'service',
  contractPeriod: '',
  contractStartDate: '',
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

const createEmptyPaymentSplit = () => ({
  mode: 'Cheque',
  depositTo: 'Billing',
  amount: '0'
});

const emptyForm = {
  customerId: '',
  customerName: '',
  invoiceType: 'GST',
  billingAddressSource: 'billing',
  shippingAddressSource: 'shipping',
  customShippingAddresses: [],
  placeOfSupply: '',
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
  paymentReceivedEnabled: false,
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
  roundOff: '0',
  total: '0'
};

const defaultInvoiceNumberPrefs = {
  mode: 'auto',
  prefix: 'SPC-',
  nextNumber: 66,
  padding: 4
};

const sanitizeInvoiceNumberPrefs = (raw = {}) => ({
  mode: raw.mode === 'manual' ? 'manual' : 'auto',
  prefix: String(raw.prefix ?? defaultInvoiceNumberPrefs.prefix),
  nextNumber: Math.max(1, Number(raw.nextNumber ?? defaultInvoiceNumberPrefs.nextNumber) || defaultInvoiceNumberPrefs.nextNumber),
  padding: Math.max(1, Number(raw.padding ?? defaultInvoiceNumberPrefs.padding) || defaultInvoiceNumberPrefs.padding)
});

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

const shell = {
  page: { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', overflow: 'visible', position: 'relative' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: '#fff' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: 0, borderRadius: 0, background: 'transparent', border: 'none' },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  topActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  toolbar: { padding: '10px 16px', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#fff' },
  toolLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  customizeButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '10px', padding: '9px 14px', background: '#6b7280', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' },
  buttonGhost: { border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', borderRadius: '12px', width: '48px', height: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  summaryWrap: { padding: '14px 16px', background: '#fff' },
  summaryCard: { border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 16px', background: '#fbfbfd' },
  summaryTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1.4fr', gap: '18px', marginTop: '14px' },
  summaryMetric: { display: 'flex', flexDirection: 'column', gap: '4px' },
  summaryLabel: { color: '#475569', fontSize: '13px', fontWeight: 500 },
  summaryValue: { color: '#111827', fontSize: '34px', fontWeight: 800 },
  summaryAccent: { color: '#d97706' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', borderTop: '1px solid #eef2f7', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  headCell: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '12px 10px', fontSize: '14px', color: '#111827', verticalAlign: 'top', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  invoiceCell: { color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline dotted rgba(159,23,77,0.4)' },
  checkboxWrap: { width: '40px', textAlign: 'center' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  statusBadge: { fontWeight: 700 },
  menu: { position: 'absolute', right: 16, top: '56px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', minWidth: '200px', boxShadow: '0 14px 32px rgba(15,23,42,0.12)', zIndex: 30, overflow: 'hidden' },
  menuButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  rowActionWrap: { position: 'relative', display: 'inline-flex', justifyContent: 'center' },
  rowActionButton: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  rowActionMenu: { position: 'fixed', minWidth: '168px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 12px 26px rgba(15,23,42,0.14)', zIndex: 3500, overflow: 'hidden' },
  rowActionMenuBtn: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', color: '#1f2937', cursor: 'pointer', padding: '8px 10px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--color-primary-soft)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', width: '250px', zIndex: 30 },
  popoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '270px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto', backdropFilter: 'blur(12px)' },
  modal: { background: '#fff', width: 'min(100%, 1180px)', borderRadius: '24px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', height: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '28px', fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  modalHeaderTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  modalCloseButton: { border: 'none', background: 'transparent', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  formBody: { padding: '18px 22px', overflowY: 'auto', overflowX: 'hidden', display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: '16px', flex: 1, minHeight: 0 },
  customerRow: { display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', columnGap: '14px', rowGap: '10px', alignItems: 'center' },
  addressSplit: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' },
  addressCard: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px', background: '#fff' },
  addressHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  addressHeadActions: { display: 'flex', alignItems: 'center', gap: '6px' },
  addressTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' },
  addressText: { margin: 0, fontSize: '13px', color: '#0f172a', lineHeight: 1.45, whiteSpace: 'pre-line' },
  addressPickerOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.28)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto' },
  addressPicker: { background: '#fff', width: 'min(100%, 720px)', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden' },
  addressPickerHead: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  addressPickerTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' },
  addressList: { padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px', maxHeight: '250px', overflowY: 'auto' },
  addressChoiceCard: { border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '8px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', cursor: 'pointer' },
  addressChoiceCardActive: { background: 'var(--color-primary-soft)', borderColor: 'var(--color-primary)' },
  addressChoiceTitle: { margin: 0, fontSize: '12px', fontWeight: 800, color: '#334155' },
  addressChoiceText: { margin: '4px 0 0 0', fontSize: '12px', color: '#0f172a', whiteSpace: 'pre-line' },
  addressEditor: { padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', columnGap: '10px', rowGap: '10px', alignItems: 'center' },
  supplyRow: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 110px minmax(0, 1fr)', columnGap: '14px', rowGap: '10px', alignItems: 'center' },
  topGrid: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 110px minmax(0, 1fr)', columnGap: '14px', rowGap: '12px', alignItems: 'center' },
  secondGrid: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 140px minmax(0, 1fr)', columnGap: '14px', rowGap: '12px', alignItems: 'center' },
  subjectRow: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', columnGap: '14px', rowGap: '12px', alignItems: 'center' },
  label: { fontSize: '13px', color: '#3f3f46', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  labelRequired: { color: '#dc2626' },
  input: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', outline: 'none', width: '100%', minHeight: '48px', boxSizing: 'border-box' },
  textArea: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', outline: 'none', width: '100%', minHeight: '84px', resize: 'vertical', boxSizing: 'border-box' },
  inputWithAction: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 42px', gap: '0' },
  inputMainWithButton: { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' },
  inputActionButton: { border: '1px solid var(--color-primary)', borderRadius: '0 8px 8px 0', minHeight: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: 'var(--color-primary)', cursor: 'pointer' },
  miniCloseButton: { border: 'none', background: 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, width: '28px', height: '28px' },
  miniModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto' },
  miniModal: { width: 'min(100%, 680px)', background: '#fff', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden' },
  miniModalHead: { padding: '14px 18px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-primary)', color: '#fff' },
  miniModalTitle: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#ffffff' },
  miniModalBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' },
  miniModalNote: { margin: 0, fontSize: '16px', color: '#1f2937', lineHeight: 1.4 },
  miniRadioRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 600, color: '#1f2937' },
  miniPrefsGrid: { display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: '12px', alignItems: 'end', paddingLeft: '30px' },
  miniFooter: { padding: '14px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '10px' },
  itemSection: { border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', background: '#fff', minHeight: '132px' },
  itemHead: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontWeight: 800, fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  itemTableWrap: { width: '100%', overflowX: 'auto', overflowY: 'hidden' },
  itemTable: { width: '100%', minWidth: '860px', borderCollapse: 'collapse' },
  itemTh: { padding: '8px 10px', borderBottom: '1px solid var(--color-border)', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' },
  itemTd: { padding: '8px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#111827', verticalAlign: 'top' },
  itemMetaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  itemMetaField: { display: 'flex', flexDirection: 'column', gap: '4px' },
  itemMetaLabel: { fontSize: '11px', color: '#64748b', fontWeight: 700 },
  itemMetaInput: { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', outline: 'none', width: '100%', minHeight: '32px', boxSizing: 'border-box' },
  iconButton: { border: '1px solid var(--color-border)', borderRadius: '10px', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#475569', cursor: 'pointer' },
  tinyText: { fontSize: '11px', color: '#64748b', fontWeight: 700 },
  addRowBtn: { border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', padding: '7px 11px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  actionLinkBtn: { border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  itemActionsRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
  outlineBtn: { border: '1px solid var(--color-primary-soft)', background: '#FDF2F8', color: 'var(--color-primary-dark)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  totalsWrap: { marginTop: '8px', marginLeft: 'auto', width: '340px', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fafafa' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: '12px', color: '#334155', borderBottom: '1px solid var(--color-border)' },
  gstRowsWrap: { margin: '0 8px', padding: '10px 12px', borderLeft: '3px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', display: 'grid', gap: '10px' },
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
  serviceScheduleTh: { padding: '8px 10px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', textAlign: 'left' },
  serviceScheduleTd: { padding: '8px 10px', fontSize: '12px', color: '#0f172a', borderBottom: '1px solid #eef2f7', verticalAlign: 'top' },
  serviceScheduleEmpty: { fontSize: '12px', color: '#64748b' },
  paymentBlock: { borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  paymentToggle: { display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#1f2937', fontWeight: 700 },
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
  modalFooter: { padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' },
  cancelButton: { border: '1px solid #d1d5db', background: '#fff', color: '#2563eb', borderRadius: '18px', padding: '10px 18px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '18px', padding: '10px 20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }
};

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDisplayDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

const buildServiceDatesByFrequency = (startDateStr, endDateStr, frequency, maxServices = 500) => {
  const cfg = serviceFrequencyConfig[frequency];
  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);
  if (!cfg || !start || !end || end < start) return [];

  if (cfg.type === 'single_once') {
    return [formatDateInput(start)];
  }

  if (cfg.type === 'followup_days') {
    const dates = [formatDateInput(start)];
    const followup = new Date(start);
    followup.setDate(followup.getDate() + cfg.value);
    if (followup <= end) dates.push(formatDateInput(followup));
    return dates;
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
    return dates;
  }

  const dates = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < maxServices) {
    dates.push(formatDateInput(cursor));
    guard += 1;
    if (cfg.type === 'interval_days') {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + cfg.value);
    } else {
      cursor = addMonthsClamped(cursor, cfg.value);
    }
  }
  return dates;
};

const countServicesByFrequency = (startDateStr, endDateStr, frequency) => {
  const dates = buildServiceDatesByFrequency(startDateStr, endDateStr, frequency);
  return dates.length > 0 ? String(dates.length) : '';
};

const buildServiceScheduleEntries = (items = [], defaultTime = '10:00') => {
  const normalizedTime = normalizeTimeInput(defaultTime, '10:00');
  const schedule = [];

  items.forEach((line, lineIndex) => {
    const baseDates = buildServiceDatesByFrequency(
      line.contractStartDate,
      line.contractEndDate,
      line.serviceFrequency
    );
    if (baseDates.length === 0) return;

    const requestedServices = Number(line.totalServices || 0);
    const dates = Number.isFinite(requestedServices) && requestedServices > 0
      ? baseDates.slice(0, requestedServices)
      : baseDates;

    dates.forEach((serviceDate, serviceIndex) => {
      schedule.push({
        key: `${lineIndex}-${line.itemId || line.itemName || 'line'}-${serviceIndex + 1}`,
        itemId: line.itemId || '',
        itemName: line.itemName || `Item ${lineIndex + 1}`,
        itemDescription: line.description || '',
        serviceNumber: serviceIndex + 1,
        serviceDate,
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
  const cfg = contractPeriodConfig[line.contractPeriod];
  const start = parseDateOnly(line.contractStartDate);
  if (!cfg || !start) {
    return {
      ...line,
      contractEndDate: '',
      renewalDate: '',
      totalServices: ''
    };
  }

  let end = new Date(start);
  if (cfg.unit === 'days') {
    end.setDate(end.getDate() + cfg.value - 1);
  } else {
    end = addMonthsClamped(start, cfg.value);
    end.setDate(end.getDate() - 1);
  }
  const renewal = new Date(end);
  renewal.setDate(renewal.getDate() + 1);

  return {
    ...line,
    contractEndDate: formatDateInput(end),
    renewalDate: formatDateInput(renewal),
    totalServices: countServicesByFrequency(formatDateInput(start), formatDateInput(end), line.serviceFrequency)
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

const buildAddressText = (customer, source) => {
  if (!customer) return 'No customer selected';
  const prefix = source === 'shipping' ? 'shipping' : 'billing';
  const displayName = customer.displayName || customer.name || '';
  const street1 = customer[`${prefix}Street1`] || customer[`${prefix}Address`] || '';
  const street2 = customer[`${prefix}Street2`] || '';
  const area = customer[`${prefix}Area`] || '';
  const statePin = [customer[`${prefix}State`], customer[`${prefix}Pincode`]].filter(Boolean).join(' ');
  return [displayName, street1, street2, area, statePin].filter(Boolean).join('\n');
};

const buildAddressOption = (id, label, customer, prefix) => ({
  id,
  label,
  company: customer?.displayName || customer?.name || '',
  street1: customer?.[`${prefix}Street1`] || customer?.[`${prefix}Address`] || '',
  street2: customer?.[`${prefix}Street2`] || '',
  line1: customer?.[`${prefix}Address`] || '',
  area: customer?.[`${prefix}Area`] || '',
  state: customer?.[`${prefix}State`] || '',
  pincode: customer?.[`${prefix}Pincode`] || '',
  gstin: customer?.gstNumber || '',
  placeOfSupply: normalizeGstState(customer?.[`${prefix}State`] || customer?.state || '')
});

const addressOptionText = (option) => {
  if (!option) return 'No address selected';
  const displayName = option.company || '';
  const street1 = option.street1 || option.line1 || '';
  const street2 = option.street2 || '';
  const area = option.area || '';
  const statePin = [option.state, option.pincode].filter(Boolean).join(' ');
  return [displayName, street1, street2, area, statePin].filter(Boolean).join('\n');
};

const getEmployeeDisplayName = (employee = {}) => {
  const first = String(employee.firstName || '').trim();
  const last = String(employee.lastName || '').trim();
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  return String(employee.name || employee.empCode || '').trim();
};

const normalizeInvoiceType = (value) => (String(value || '').trim().toUpperCase() === 'NON GST' ? 'NON GST' : 'GST');

const emptyAddressDraft = {
  label: 'Additional Address',
  company: '',
  line1: '',
  line2: '',
  area: '',
  state: '',
  pincode: '',
  gstin: '',
  placeOfSupply: ''
};

export default function InvoiceDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [rowActionInvoiceId, setRowActionInvoiceId] = useState('');
  const [rowActionMenuPos, setRowActionMenuPos] = useState({ top: 0, left: 0 });
  const [showBillingAddressPicker, setShowBillingAddressPicker] = useState(false);
  const [showShippingAddressPicker, setShowShippingAddressPicker] = useState(false);
  const [editingShippingAddressId, setEditingShippingAddressId] = useState('');
  const [shippingAddressDraft, setShippingAddressDraft] = useState(emptyAddressDraft);
  const [showModal, setShowModal] = useState(false);
  const [modalOpenedFromContract, setModalOpenedFromContract] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showInvoiceNumberPrefs, setShowInvoiceNumberPrefs] = useState(false);
  const [invoiceNumberPrefs, setInvoiceNumberPrefs] = useState(defaultInvoiceNumberPrefs);
  const [invoiceNumberPrefsDraft, setInvoiceNumberPrefsDraft] = useState(defaultInvoiceNumberPrefs);
  const [companySettings, setCompanySettings] = useState({});
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('invoice_visible_columns');
    if (!saved) return [...defaultInvoiceVisibleColumns];
    try {
      return normalizeInvoiceVisibleColumns(JSON.parse(saved));
    } catch {
      return [...defaultInvoiceVisibleColumns];
    }
  });

  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const visibleColumnDefs = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ id: customer._id, name: customer.displayName || customer.name || '' })),
    [customers]
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer._id === form.customerId) || null,
    [customers, form.customerId]
  );
  const billingAddressOptions = useMemo(
    () => [
      buildAddressOption('billing', 'Billing Address', selectedCustomer, 'billing'),
      buildAddressOption('shipping', 'Shipping Address', selectedCustomer, 'shipping')
    ],
    [selectedCustomer]
  );
  const selectedBillingAddress = useMemo(
    () => billingAddressOptions.find((address) => address.id === form.billingAddressSource) || billingAddressOptions[0] || null,
    [billingAddressOptions, form.billingAddressSource]
  );
  const shippingAddressOptions = useMemo(() => {
    const base = [
      buildAddressOption('shipping', 'Shipping Address', selectedCustomer, 'shipping'),
      buildAddressOption('billing', 'Billing Address', selectedCustomer, 'billing')
    ];
    const custom = (form.customShippingAddresses || []).map((address, idx) => ({
      ...address,
      street1: address.street1 || address.line1 || '',
      street2: address.street2 || address.line2 || '',
      placeOfSupply: normalizeGstState(address.placeOfSupply || address.state || ''),
      id: `custom-${idx}`
    }));
    return [...base, ...custom];
  }, [selectedCustomer, form.customShippingAddresses]);
  const selectedShippingAddress = useMemo(
    () => shippingAddressOptions.find((address) => address.id === form.shippingAddressSource) || shippingAddressOptions[0] || null,
    [shippingAddressOptions, form.shippingAddressSource]
  );

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

  const serviceScheduleTime = useMemo(
    () => normalizeTimeInput(form.serviceScheduleDefaultTime, '10:00'),
    [form.serviceScheduleDefaultTime]
  );

  const generatedServiceSchedules = useMemo(
    () => buildServiceScheduleEntries(form.items, serviceScheduleTime),
    [form.items, serviceScheduleTime]
  );

  const computeTotals = (lines, invoiceType = 'GST') => {
    const nonGst = normalizeInvoiceType(invoiceType) === 'NON GST';
    let subtotal = 0;
    let totalTax = 0;
    lines.forEach((line) => {
      const qty = Number(line.quantity || 0);
      const rate = Number(line.rate || 0);
      const taxRate = Number(line.taxRate || 0);
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
    const roundOff = Number(nextForm.roundOff || 0);
    const grandTotal = Number((totals.total - withholdingAmount + roundOff).toFixed(2));
    const status = (nextForm.status || 'DRAFT').toUpperCase();
    const paymentSplits = Array.isArray(nextForm.paymentSplits) && nextForm.paymentSplits.length > 0
      ? nextForm.paymentSplits
      : [createEmptyPaymentSplit()];
    const paymentReceivedTotal = nextForm.paymentReceivedEnabled ? sumPaymentSplits(paymentSplits) : 0;
    const paymentBalance = Number((grandTotal - paymentReceivedTotal).toFixed(2));
    const nextBalance = nextForm.paymentReceivedEnabled
      ? Number(Math.max(paymentBalance, 0).toFixed(2))
      : status === 'PAID'
        ? 0
        : Number(nextForm.balanceDue || grandTotal || 0);
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
      paymentSplits,
      paymentReceivedTotal: String(paymentReceivedTotal),
      status: nextStatus,
      balanceDue: String(nextBalance)
    };
  };

  const createNextInvoiceNumber = (prefs = invoiceNumberPrefs) => {
    const safePrefs = sanitizeInvoiceNumberPrefs(prefs);
    const max = invoices.reduce((acc, invoice) => {
      const seq = extractInvoiceSeq(invoice.invoiceNumber, safePrefs.prefix);
      if (!Number.isFinite(seq)) return acc;
      return Math.max(acc, seq);
    }, 0);
    const next = Math.max(safePrefs.nextNumber, max + 1);
    return `${safePrefs.prefix}${String(next).padStart(safePrefs.padding, '0')}`;
  };

  const getDefaultTermsForInvoiceType = (invoiceType) => {
    const normalized = normalizeInvoiceType(invoiceType);
    if (normalized === 'NON GST') {
      return String(companySettings.nonGstTermsAndConditions || '').trim();
    }
    return String(companySettings.gstTermsAndConditions || '').trim();
  };

  const loadInvoices = async () => {
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/invoices`),
        axios.get(`${API_BASE_URL}/api/payments`)
      ]);
      setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to load invoices', error);
    }
  };

  const loadMasterData = async () => {
    try {
      const [customersRes, itemsRes, employeesRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/customers`),
        axios.get(`${API_BASE_URL}/api/items`),
        axios.get(`${API_BASE_URL}/api/employees`),
        axios.get(`${API_BASE_URL}/api/settings`)
      ]);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setItemsCatalog(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      const settingsData = settingsRes.data || {};
      const prefs = sanitizeInvoiceNumberPrefs({
        mode: settingsData.invoiceNumberMode || 'auto',
        prefix: settingsData.invoicePrefix || 'SPC-',
        nextNumber: settingsData.invoiceNextNumber ?? 66,
        padding: settingsData.invoiceNumberPadding ?? 4
      });
      setInvoiceNumberPrefs(prefs);
      setInvoiceNumberPrefsDraft(prefs);
      setVisibleColumns(normalizeInvoiceVisibleColumns(settingsData.invoiceVisibleColumns));
      setCompanySettings({
        companyName: settingsData.companyName || settingsData.gstCompanyName || '',
        companyAddress: settingsData.companyAddress || settingsData.gstBillingAddress || '',
        companyCity: settingsData.companyCity || settingsData.gstCity || '',
        companyState: settingsData.companyState || settingsData.gstState || '',
        companyPincode: settingsData.companyPincode || settingsData.gstPincode || '',
        companyGstNumber: settingsData.companyGstNumber || '',
        companyEmail: settingsData.companyEmail || settingsData.gstEmail || '',
        companyMobile: settingsData.companyMobile || settingsData.gstPhone || '',
        companyWebsite: settingsData.companyWebsite || '',
        googleReviewLink: settingsData.googleReviewLink || '',
        dashboardImageUrl: settingsData.gstCompanyLogoUrl || settingsData.dashboardImageUrl || '',
        gstTermsAndConditions: settingsData.gstTermsAndConditions || settingsData.termsAndConditionsDefault || '',
        nonGstTermsAndConditions: settingsData.nonGstTermsAndConditions || '',
        customerNotesDefault: settingsData.customerNotesDefault || ''
      });
      setSettingsHydrated(true);
    } catch (error) {
      console.error('Failed to load master data for invoice form', error);
    }
  };

  useEffect(() => {
    loadInvoices();
    loadMasterData();
  }, []);

  useEffect(() => {
    const refreshInvoices = () => {
      loadInvoices();
    };
    const timer = setInterval(refreshInvoices, 5000);
    const onFocus = () => {
      refreshInvoices();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshInvoices();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

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
    if (!showModal || editingId || !settingsHydrated) return;
    if (String(form.termsAndConditions || '').trim()) return;
    const nextTerms = getDefaultTermsForInvoiceType(form.invoiceType);
    if (!nextTerms) return;
    setFormWithTotals((prev) => ({ ...prev, termsAndConditions: nextTerms }));
  }, [editingId, form.invoiceType, form.termsAndConditions, settingsHydrated, showModal]);

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

      const clickedInsideRowAction = target && typeof target.closest === 'function'
        ? target.closest('[data-invoice-row-action="true"], [data-invoice-row-action-menu="true"]')
        : null;
      if (rowActionInvoiceId && !clickedInsideRowAction) {
        setRowActionInvoiceId('');
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowCustomize(false);
        setShowMoreMenu(false);
        setRowActionInvoiceId('');
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [rowActionInvoiceId, showCustomize, showMoreMenu]);

  const isAllSelected = invoices.length > 0 && selectedIds.length === invoices.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(invoices.map((invoice) => invoice._id));
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

  const getColumnStyle = (columnKey) => {
    if (columnKey === 'date' || columnKey === 'dueDate') {
      return {
        width: '130px',
        minWidth: '130px',
        maxWidth: '130px',
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums'
      };
    }
    if (columnKey === 'invoiceNumber') {
      return {
        width: '150px',
        minWidth: '150px',
        maxWidth: '150px'
      };
    }
    if (columnKey === 'amount' || columnKey === 'balanceDue') {
      return {
        width: '140px',
        minWidth: '140px',
        maxWidth: '140px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      };
    }
    if (columnKey === 'status') {
      return {
        width: '110px',
        minWidth: '110px',
        maxWidth: '110px',
        textAlign: 'center'
      };
    }
    if (columnKey === 'customerName') {
      return {
        width: 'auto',
        minWidth: '220px'
      };
    }
    return {};
  };

  const openNewForm = () => {
    setEditingId(null);
    setSaveError('');
    const invoiceNumber = invoiceNumberPrefs.mode === 'auto' ? createNextInvoiceNumber(invoiceNumberPrefs) : '';
    const invoiceType = 'GST';
    setForm(applyComputedTotals({
      ...emptyForm,
      invoiceNumber,
      invoiceType,
      customerNotes: String(companySettings.customerNotesDefault || '').trim(),
      termsAndConditions: getDefaultTermsForInvoiceType(invoiceType),
      status: 'DRAFT'
    }));
    setShowModal(true);
  };

  const closeInvoiceModal = () => {
    setShowBillingAddressPicker(false);
    setShowShippingAddressPicker(false);
    setEditingShippingAddressId('');
    setShippingAddressDraft(emptyAddressDraft);
    setShowModal(false);
    setEditingId(null);
    setSaveError('');
    setForm(emptyForm);

    if (modalOpenedFromContract) {
      setModalOpenedFromContract(false);
      navigate('/sales/contracts', { replace: true });
    }
  };

  const openInvoiceNumberPrefs = () => {
    const nextInvoiceNumber = createNextInvoiceNumber(invoiceNumberPrefs);
    const nextSeq = extractInvoiceSeq(nextInvoiceNumber, invoiceNumberPrefs.prefix) || invoiceNumberPrefs.nextNumber;
    const draft = sanitizeInvoiceNumberPrefs({ ...invoiceNumberPrefs, nextNumber: nextSeq });
    setInvoiceNumberPrefsDraft(draft);
    setShowInvoiceNumberPrefs(true);
  };

  const saveInvoiceNumberPrefs = async () => {
    const clean = sanitizeInvoiceNumberPrefs(invoiceNumberPrefsDraft);
    try {
      await axios.post(`${API_BASE_URL}/api/settings/save`, {
        invoiceNumberMode: clean.mode,
        invoicePrefix: clean.prefix,
        invoiceNextNumber: clean.nextNumber,
        invoiceNumberPadding: clean.padding
      });
      setInvoiceNumberPrefs(clean);
      setShowInvoiceNumberPrefs(false);
      if (!editingId && showModal && clean.mode === 'auto') {
        const nextNumber = createNextInvoiceNumber(clean);
        setFormWithTotals((prev) => ({ ...prev, invoiceNumber: nextNumber }));
      }
    } catch (error) {
      console.error('Failed to save invoice number preferences', error);
      window.alert('Could not save invoice number preferences.');
    }
  };

  const mapInvoiceToForm = (invoice) => {
    const invoiceType = normalizeInvoiceType(invoice.invoiceType || (Number(invoice.totalTax || 0) > 0 ? 'GST' : 'NON GST'));
    const mappedItems = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items.map((line) => withContractSchedule({
        itemId: line.itemId || '',
        itemName: line.itemName || '',
        description: line.description || '',
        sac: line.sac || '',
        itemType: line.itemType || 'service',
        contractPeriod: line.contractPeriod || '',
        contractStartDate: line.contractStartDate || '',
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
        mode: split.mode || 'Cheque',
        depositTo: split.depositTo || 'Billing',
        amount: String(split.amount ?? 0)
      }))
      : [createEmptyPaymentSplit()];

    return applyComputedTotals({
      customerId: invoice.customerId || '',
      customerName: invoice.customerName || '',
      invoiceType,
      billingAddressSource: invoice.billingAddressSource || 'billing',
      shippingAddressSource: invoice.shippingAddressSource || 'shipping',
      customShippingAddresses: Array.isArray(invoice.customShippingAddresses)
        ? invoice.customShippingAddresses.map((address) => ({
          ...address,
          placeOfSupply: normalizeGstState(address.placeOfSupply || address.state || '')
        }))
        : [],
      placeOfSupply: normalizeGstState(invoice.placeOfSupply || ''),
      invoiceNumber: invoice.invoiceNumber || '',
      date: invoice.date || new Date().toISOString().slice(0, 10),
      terms: invoice.terms || 'Paid',
      dueDate: invoice.dueDate || invoice.date || new Date().toISOString().slice(0, 10),
      salesperson: invoice.salesperson || '',
      servicePeriod: invoice.servicePeriod || '',
      servicePeriodStart: invoice.servicePeriodStart || '',
      servicePeriodEnd: invoice.servicePeriodEnd || '',
      subject: invoice.subject || '',
      items: mappedItems,
      customerNotes: invoice.customerNotes || '',
      termsAndConditions: invoice.termsAndConditions || getDefaultTermsForInvoiceType(invoiceType),
      serviceScheduleDefaultTime: normalizeTimeInput(invoice.serviceScheduleDefaultTime || '', '10:00'),
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
      roundOff: String(invoice.roundOff ?? 0),
      total: String(invoice.total ?? invoice.amount ?? 0)
    });
  };

  const openEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const selected = invoices.find((invoice) => invoice._id === selectedIds[0]);
    if (!selected) return;
    setModalOpenedFromContract(false);
    setEditingId(selected._id);
    setForm(mapInvoiceToForm(selected));
    setSaveError('');
    setShowModal(true);
    setShowMoreMenu(false);
  };

  const findCustomerForInvoice = (invoice) =>
    customers.find((customer) =>
      (invoice.customerId && customer._id === invoice.customerId) ||
      String(customer.displayName || customer.name || '').trim().toLowerCase() === String(invoice.customerName || '').trim().toLowerCase()
    ) || null;

  const triggerInvoicePdfDownload = (invoice) => {
    const href = `${API_BASE_URL}/api/invoices/${invoice._id}/pdf`;
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    if (companySettings.googleReviewLink) lines.push(`Google Review: ${companySettings.googleReviewLink}`);
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
    const customerWhatsapp = String(customer?.whatsappNumber || customer?.mobileNumber || customer?.workPhone || '').replace(/\D/g, '');
    const shareText = buildShareText(invoice, customer);

    if (action === 'download') {
      triggerInvoicePdfDownload(invoice);
      return;
    }

    if (action === 'whatsapp') {
      const targetPhone = window.prompt('Enter WhatsApp number with country code', customerWhatsapp || '');
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
      const subject = `Invoice ${invoiceNumber}`;
      const message = `Hello,\n\n${shareText}\n\nRegards,\n${companySettings.companyName || 'Accounts Team'}`;
      try {
        const response = await axios.post(`${API_BASE_URL}/api/invoices/${invoice._id}/send-email`, {
          to: recipient,
          subject,
          message
        });
        window.alert(response.data?.message || 'Invoice email sent successfully.');
      } catch (error) {
        console.error('Failed to send invoice email', error);
        window.alert(apiErrorMessage(error, 'Could not send invoice email.'));
      }
    }
  };

  useEffect(() => {
    if (location.state?.openInvoiceNumberPrefs) {
      setModalOpenedFromContract(Boolean(location.state?.fromContract));
      openNewForm();
      setTimeout(() => openInvoiceNumberPrefs(), 0);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (location.state?.openNewInvoice) {
      setModalOpenedFromContract(Boolean(location.state?.fromContract ?? true));
      openNewForm();
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const targetId = location.state?.openInvoiceId;
    const targetNumber = String(location.state?.openInvoiceNumber || '').trim();
    if (!targetId && !targetNumber) return;
    if (!Array.isArray(invoices) || invoices.length === 0) return;

    const matched = invoices.find((invoice) => {
      if (targetId && invoice._id === targetId) return true;
      if (targetNumber) {
        return String(invoice.invoiceNumber || '').trim().toLowerCase() === targetNumber.toLowerCase();
      }
      return false;
    });
    if (!matched) return;

    setSelectedIds([matched._id]);
    setModalOpenedFromContract(Boolean(location.state?.fromContract));
    setEditingId(matched._id);
    setForm(mapInvoiceToForm(matched));
    setSaveError('');
    setShowModal(true);
    setShowMoreMenu(false);
    navigate(location.pathname, { replace: true, state: null });
  }, [invoices, location.pathname, location.state, navigate]);

  const setFormWithTotals = (updater) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return applyComputedTotals(next);
    });
  };

  const updateLine = (index, patch) => {
    setFormWithTotals((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = withContractSchedule({ ...nextItems[index], ...patch });
      return { ...prev, items: nextItems };
    });
  };

  const updatePaymentSplit = (index, patch) => {
    setFormWithTotals((prev) => {
      const nextSplits = Array.isArray(prev.paymentSplits) ? [...prev.paymentSplits] : [createEmptyPaymentSplit()];
      if (!nextSplits[index]) nextSplits[index] = createEmptyPaymentSplit();
      nextSplits[index] = { ...nextSplits[index], ...patch };
      return { ...prev, paymentSplits: nextSplits };
    });
  };

  const addPaymentSplit = () => {
    setFormWithTotals((prev) => ({
      ...prev,
      paymentSplits: [...(Array.isArray(prev.paymentSplits) ? prev.paymentSplits : []), createEmptyPaymentSplit()]
    }));
  };

  const removeLine = (index) => {
    setFormWithTotals((prev) => {
      if (prev.items.length === 1) {
        return { ...prev, items: [createEmptyLine()] };
      }
      return { ...prev, items: prev.items.filter((_, idx) => idx !== index) };
    });
  };

  const addLine = () => {
    setFormWithTotals((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        prev.invoiceType === 'NON GST'
          ? { ...createEmptyLine(), taxRate: '0' }
          : createEmptyLine()
      ]
    }));
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
          sac: match.hsnSac || match.sac || '',
          itemType: match.itemType || 'service',
          contractPeriod: '',
          contractStartDate: '',
          contractEndDate: '',
          renewalDate: '',
          serviceFrequency: '',
          totalServices: '',
          serviceStartDate: prev.servicePeriodStart || '',
          serviceEndDate: prev.servicePeriodEnd || '',
          quantity: '1',
          rate: String(Number(match.sellingPrice || match.rate || 0)),
          taxRate: prev.invoiceType === 'NON GST' ? '0' : String(parsePercent(match.intraTaxRate || '18%'))
        }
      ]
    }));
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
        sac: '',
        itemType: 'service',
        serviceStartDate: '',
        serviceEndDate: '',
        rate: '0',
        taxRate: form.invoiceType === 'NON GST' ? '0' : '18'
      });
      return;
    }
    const rate = Number(selected.sellingPrice || selected.rate || 0);
    const taxRate = form.invoiceType === 'NON GST' ? 0 : parsePercent(selected.intraTaxRate || '18%');
    updateLine(index, {
      itemId: selected._id,
      itemName: selected.name || '',
      description: selected.description || selected.salesDescription || '',
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
    setFormWithTotals((prev) => ({
      ...prev,
      invoiceType: normalized,
      items: (prev.items || []).map((line) => ({
        ...line,
        taxRate: normalized === 'NON GST' ? '0' : '18'
      })),
      termsAndConditions: getDefaultTermsForInvoiceType(normalized)
    }));
  };

  const handleDateChange = (date) => {
    setFormWithTotals((prev) => {
      const days = termsToDays[prev.terms] ?? 0;
      return { ...prev, date, dueDate: addDays(date, days) };
    });
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find((entry) => entry._id === customerId);
    setFormWithTotals((prev) => ({
      ...prev,
      customerId,
      customerName: customer ? (customer.displayName || customer.name || '') : '',
      billingAddressSource: 'billing',
      shippingAddressSource: 'shipping',
      customShippingAddresses: [],
      placeOfSupply: customer ? normalizeGstState(customer.billingState || customer.state || '') : ''
    }));
  };

  const openShippingAddressPicker = () => {
    setShowBillingAddressPicker(false);
    setEditingShippingAddressId('');
    setShippingAddressDraft(emptyAddressDraft);
    setShowShippingAddressPicker(true);
  };

  const openBillingAddressPicker = () => {
    setShowShippingAddressPicker(false);
    setEditingShippingAddressId('');
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
    setEditingShippingAddressId(id);
    setShippingAddressDraft({
      label: address.label || 'Additional Address',
      company: address.company || '',
      line1: address.line1 || address.street1 || '',
      line2: address.line2 || address.street2 || '',
      area: address.area || '',
      state: address.state || '',
      pincode: address.pincode || '',
      gstin: address.gstin || '',
      placeOfSupply: normalizeGstState(address.placeOfSupply || address.state || '')
    });
  };

  const saveShippingAddressDraft = () => {
    if (!shippingAddressDraft.line1.trim()) return;
    setFormWithTotals((prev) => {
      const list = [...(prev.customShippingAddresses || [])];
      const payload = {
        ...shippingAddressDraft,
        street1: shippingAddressDraft.line1 || '',
        street2: shippingAddressDraft.line2 || '',
        placeOfSupply: normalizeGstState(shippingAddressDraft.placeOfSupply || shippingAddressDraft.state || '')
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
      line2: selectedCustomer.billingStreet2 || '',
      area: selectedCustomer.billingArea || '',
      state: selectedCustomer.billingState || selectedCustomer.state || '',
      pincode: selectedCustomer.billingPincode || '',
      gstin: selectedCustomer.gstNumber || '',
      placeOfSupply: normalizeGstState(selectedCustomer.billingState || selectedCustomer.state || '')
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
        quantity: Number(line.quantity || 0),
        rate: Number(line.rate || 0),
        taxRate: invoiceType === 'NON GST' ? 0 : Number(line.taxRate || 0)
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
      : [createEmptyPaymentSplit()];
    const normalizedPaymentSplits = [];
    for (const split of paymentSplitsSource) {
      const amountValue = Number(split?.amount || 0);
      if (!Number.isFinite(amountValue) || amountValue < 0) {
        setSaveError('Amount Received must be a valid number.');
        return;
      }
      normalizedPaymentSplits.push({
        mode: split?.mode || 'Cheque',
        depositTo: split?.depositTo || 'Billing',
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

    const normalizedServiceSchedules = buildServiceScheduleEntries(validItems, serviceScheduleTime).map((schedule) => ({
      serviceNumber: schedule.serviceNumber,
      serviceDate: schedule.serviceDate,
      serviceTime: schedule.serviceTime,
      itemId: schedule.itemId || '',
      itemName: schedule.itemName || '',
      itemDescription: schedule.itemDescription || ''
    }));

    const payload = {
      customerId: form.customerId,
      customerName: form.customerName.trim(),
      invoiceType,
      billingAddressSource: form.billingAddressSource,
      shippingAddressSource: form.shippingAddressSource,
      customShippingAddresses: form.customShippingAddresses || [],
      placeOfSupply: normalizeGstState(selectedShippingAddress?.placeOfSupply || form.placeOfSupply),
      billingAddressText: buildAddressText(selectedCustomer, form.billingAddressSource),
      shippingAddressText: addressOptionText(selectedShippingAddress),
      invoiceNumber: form.invoiceNumber.trim() || createNextInvoiceNumber(),
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
      roundOff: Number(form.roundOff || 0),
      total: Number(form.total || invoiceTotal),
      balanceDue: computedBalance,
      notes: form.customerNotes.trim()
    };

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
      setModalOpenedFromContract(false);
      await loadInvoices();
    } catch (error) {
      console.error('Failed to save invoice', error);
      setSaveError(error?.response?.data?.error || 'Unable to save invoice. Please ensure backend server is running on port 5000.');
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
    const rows = [
      headers.join(','),
      ...sourceRows.map((invoice) => headers.map((key) => escapeCsv(invoice[key] ?? '')).join(','))
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
    ? { ...shell.topbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '10px 12px' : shell.topbar.padding }
    : shell.topbar;
  const topActionsStyle = isMobile ? { ...shell.topActions, width: '100%', justifyContent: 'flex-end', gap: isTiny ? '6px' : shell.topActions.gap } : shell.topActions;
  const summaryGridStyle = isMobile
    ? { ...shell.summaryGrid, gridTemplateColumns: '1fr' }
    : isTablet
      ? { ...shell.summaryGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : shell.summaryGrid;
  const toolbarStyle = isMobile ? { ...shell.toolbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '8px 12px' : shell.toolbar.padding } : shell.toolbar;
  const customerRowStyle = isMobile ? { ...shell.customerRow, gridTemplateColumns: '1fr' } : shell.customerRow;
  const addressSplitStyle = isMobile ? { ...shell.addressSplit, gridTemplateColumns: '1fr' } : shell.addressSplit;
  const topGridStyle = isMobile ? { ...shell.topGrid, gridTemplateColumns: '1fr' } : shell.topGrid;
  const secondGridStyle = isMobile ? { ...shell.secondGrid, gridTemplateColumns: '1fr' } : shell.secondGrid;
  const subjectRowStyle = isMobile ? { ...shell.subjectRow, gridTemplateColumns: '1fr' } : shell.subjectRow;
  const supplyRowStyle = isMobile ? { ...shell.supplyRow, gridTemplateColumns: '1fr' } : shell.supplyRow;
  const totalsWrapStyle = isMobile ? { ...shell.totalsWrap, width: '100%', marginLeft: 0 } : shell.totalsWrap;
  const paymentTotalsStyle = isMobile ? { ...shell.paymentTotals, minWidth: '100%', marginLeft: 0 } : shell.paymentTotals;
  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '16px 10px' } : shell.modalOverlay;
  const modalStyle = isMobile
    ? {
      ...shell.modal,
      width: 'min(100%, 92vw)',
      maxHeight: '92dvh',
      height: '92dvh',
      borderRadius: '28px',
      border: '1px solid rgba(159, 23, 77, 0.24)'
    }
    : shell.modal;
  const formBodyStyle = isMobile
    ? {
      ...shell.formBody,
      padding: isTiny ? '10px 12px' : '12px 14px',
      paddingBottom: 'calc(130px + env(safe-area-inset-bottom))',
      WebkitOverflowScrolling: 'touch'
    }
    : shell.formBody;
  const modalFooterStyle = isMobile
    ? {
      ...shell.modalFooter,
      flexWrap: 'wrap',
      position: 'sticky',
      bottom: 0,
      background: '#fff',
      paddingBottom: 'calc(10px + env(safe-area-inset-bottom))'
    }
    : shell.modalFooter;
  const miniPrefsGridStyle = isMobile ? { ...shell.miniPrefsGrid, gridTemplateColumns: '1fr', paddingLeft: 0 } : shell.miniPrefsGrid;
  const titleStyle = isTiny ? { ...shell.title, fontSize: '24px' } : shell.title;
  const tinyGhostButtonStyle = isTiny ? { ...shell.buttonGhost, width: '44px', height: '44px' } : shell.buttonGhost;
  const tinyCustomizeBtnStyle = isTiny ? { ...shell.customizeButton, padding: '7px 10px', fontSize: '11px' } : shell.customizeButton;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const dateInputStyle = { ...shell.input, width: '100%', minWidth: 0, boxSizing: 'border-box' };
  const tableStyle = isMobile ? { ...shell.table, minWidth: isTiny ? '700px' : '760px' } : shell.table;
  const itemMetaGridStyle = isMobile ? { ...shell.itemMetaGrid, gridTemplateColumns: '1fr' } : shell.itemMetaGrid;
  const itemTableStyle = isMobile ? { ...shell.itemTable, minWidth: '0', width: '100%', tableLayout: 'fixed' } : shell.itemTable;
  const itemTableWrapStyle = isMobile ? { ...shell.itemTableWrap, overflowX: 'hidden' } : shell.itemTableWrap;
  const serviceScheduleTableStyle = isMobile ? { ...shell.serviceScheduleTable, minWidth: '100%', tableLayout: 'fixed' } : shell.serviceScheduleTable;
  const mobileItemInlineGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' };

  return (
    <section style={shell.page}>
      <div style={topbarStyle}>
        <div style={shell.titleWrap}>
          <h1 style={titleStyle}>All Invoices</h1>
          <ChevronDown size={18} color="var(--color-primary)" />
        </div>
        <div style={topActionsStyle}>
          <button
            ref={menuButtonRef}
            type="button"
            style={tinyGhostButtonStyle}
            aria-label="More options"
            onClick={() => setShowMoreMenu((prev) => !prev)}
          >
            <MoreHorizontal size={24} />
          </button>
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
            <div style={shell.summaryMetric}>
              <span style={shell.summaryLabel}>Total Outstanding Receivables</span>
              <span style={shell.summaryValue}>{formatINR(summary.totalOutstanding)}</span>
            </div>
            <div style={shell.summaryMetric}>
              <span style={shell.summaryLabel}>Due Today</span>
              <span style={{ ...shell.summaryValue, ...shell.summaryAccent }}>{formatINR(summary.dueToday)}</span>
            </div>
            <div style={shell.summaryMetric}>
              <span style={shell.summaryLabel}>Due Within 30 Days</span>
              <span style={shell.summaryValue}>{formatINR(summary.dueWithin30)}</span>
            </div>
            <div style={shell.summaryMetric}>
              <span style={shell.summaryLabel}>Overdue Invoice</span>
              <span style={shell.summaryValue}>{formatINR(summary.overdue)}</span>
            </div>
            <div style={shell.summaryMetric}>
              <span style={shell.summaryLabel}>Average Customer Payment Day</span>
              <span style={shell.summaryValue}>{summary.avgDays} Days</span>
            </div>
          </div>
        </div>
      </div>

      <div style={toolbarStyle}>
        <span style={shell.toolLabel}>Invoice Register</span>
        <div style={{ position: 'relative' }}>
          <button
            ref={customizeButtonRef}
            type="button"
            style={tinyCustomizeBtnStyle}
            onClick={() => setShowCustomize((prev) => !prev)}
          >
            Customize Fields
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
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...shell.headCell, ...shell.checkboxWrap }} />
              <th style={{ ...shell.headCell, ...shell.checkboxWrap }}>
                <input type="checkbox" style={shell.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumnDefs.map((column) => (
                <th key={column.key} style={{ ...shell.headCell, ...getColumnStyle(column.key) }}>
                  {column.label}
                </th>
              ))}
              <th style={{ ...shell.headCell, width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice._id} style={shell.row}>
                <td style={{ ...shell.cell, ...shell.checkboxWrap }} />
                <td style={{ ...shell.cell, ...shell.checkboxWrap }}>
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
                      <td key={`${invoice._id}-${column.key}`} style={{ ...shell.cell, ...shell.statusBadge, ...getColumnStyle(column.key), color: getStatusColor(String(invoice.status || '').toUpperCase()) }}>
                        {String(invoice.status || '').toUpperCase()}
                      </td>
                    );
                  }
                  if (column.key === 'invoiceNumber') {
                    return (
                      <td
                        key={`${invoice._id}-${column.key}`}
                        style={{ ...shell.cell, ...shell.invoiceCell, ...getColumnStyle(column.key) }}
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
                    <td key={`${invoice._id}-${column.key}`} style={{ ...shell.cell, ...getColumnStyle(column.key) }}>
                      {value}
                    </td>
                  );
                })}
                <td style={{ ...shell.cell, width: '80px', textAlign: 'center', overflow: 'visible' }}>
                  <div style={shell.rowActionWrap} data-invoice-row-action="true">
                    <button
                      type="button"
                      style={shell.rowActionButton}
                      onClick={(event) => {
                        if (rowActionInvoiceId === invoice._id) {
                          setRowActionInvoiceId('');
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        setRowActionMenuPos({
                          top: Math.max(10, rect.top - 8),
                          left: Math.max(10, rect.right - 176)
                        });
                        setRowActionInvoiceId(invoice._id);
                      }}
                      title="Invoice actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rowActionInvoiceId
        ? createPortal(
          <div
            data-invoice-row-action-menu="true"
            style={{
              ...shell.rowActionMenu,
              top: `${rowActionMenuPos.top}px`,
              left: `${rowActionMenuPos.left}px`
            }}
          >
            {(() => {
              const targetInvoice = invoices.find((entry) => entry._id === rowActionInvoiceId);
              if (!targetInvoice) return null;
              return (
                <>
                  <button
                    type="button"
                    style={shell.rowActionMenuBtn}
                    onClick={() => {
                      runInvoiceAction(targetInvoice, 'download');
                      setRowActionInvoiceId('');
                    }}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    style={shell.rowActionMenuBtn}
                    onClick={() => {
                      runInvoiceAction(targetInvoice, 'whatsapp');
                      setRowActionInvoiceId('');
                    }}
                  >
                    WhatsApp Invoice
                  </button>
                  <button
                    type="button"
                    style={shell.rowActionMenuBtn}
                    onClick={() => {
                      runInvoiceAction(targetInvoice, 'email');
                      setRowActionInvoiceId('');
                    }}
                  >
                    Email Invoice
                  </button>
                </>
              );
            })()}
          </div>,
          document.body
        )
        : null}

      {showModal ? createPortal(
        <div style={modalOverlayStyle} onClick={closeInvoiceModal}>
          <form style={modalStyle} onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={shell.modalHeaderTitle}>{editingId ? 'Edit Contract' : 'New Contract'}</h3>
              <button type="button" style={shell.modalCloseButton} onClick={closeInvoiceModal} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            <div style={formBodyStyle}>
              <div style={customerRowStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Customer Name*</label>
                <select
                  style={shell.input}
                  value={form.customerId}
                  onChange={(event) => handleCustomerChange(event.target.value)}
                >
                  <option value="">Select or add a customer</option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div style={addressSplitStyle}>
                <div style={shell.addressCard}>
                  <div style={shell.addressHead}>
                    <h4 style={shell.addressTitle}>Billing Address</h4>
                    <div style={shell.addressHeadActions}>
                      <button
                        type="button"
                        style={shell.iconButton}
                        onClick={openBillingAddressPicker}
                        title="Edit Billing Address"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                  <p style={shell.addressText}>{addressOptionText(selectedBillingAddress)}</p>
                </div>
                <div style={shell.addressCard}>
                  <div style={shell.addressHead}>
                    <h4 style={shell.addressTitle}>Shipping Address</h4>
                    <div style={shell.addressHeadActions}>
                      <button
                        type="button"
                        style={shell.iconButton}
                        onClick={openShippingAddressPicker}
                        title="Edit Shipping Address"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                  <p style={shell.addressText}>{addressOptionText(selectedShippingAddress)}</p>
                </div>
              </div>

              <div style={supplyRowStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Place of Supply*</label>
                <select
                  style={shell.input}
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
                <div />
                <div />
              </div>

              <div style={topGridStyle}>
                <label style={{ ...shell.label, ...shell.labelRequired }}>Invoice#*</label>
                <div style={shell.inputWithAction}>
                  <input
                    style={{ ...shell.input, ...shell.inputMainWithButton }}
                    value={form.invoiceNumber}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                  />
                  <button
                    type="button"
                    style={shell.inputActionButton}
                    onClick={openInvoiceNumberPrefs}
                    title="Configure invoice number"
                  >
                    <Settings size={20} />
                  </button>
                </div>

                <label style={{ ...shell.label, ...shell.labelRequired }}>Invoice Date*</label>
                <input
                  type="date"
                  style={dateInputStyle}
                  value={form.date}
                  onChange={(event) => handleDateChange(event.target.value)}
                />

                <label style={shell.label}>Terms</label>
                <select
                  style={shell.input}
                  value={form.terms}
                  onChange={(event) => handleTermsChange(event.target.value)}
                >
                  {termsOptions.map((terms) => (
                    <option key={terms} value={terms}>{terms}</option>
                  ))}
                </select>

                <label style={shell.label}>Due Date</label>
                <input
                  type="date"
                  style={{ ...dateInputStyle, textAlign: 'left' }}
                  value={form.dueDate}
                  onChange={(event) => setFormWithTotals((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>

              <div style={secondGridStyle}>
                <label style={shell.label}>Salesperson</label>
                <select
                  style={shell.input}
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
                  style={shell.input}
                  value={form.invoiceType}
                  onChange={(event) => handleInvoiceTypeChange(event.target.value)}
                >
                  <option value="GST">GST Invoice</option>
                  <option value="NON GST">Non GST Invoice</option>
                </select>
              </div>

              <div style={subjectRowStyle}>
                <label style={shell.label}>Subject</label>
                <input
                  style={shell.input}
                  placeholder="Let your customer know what this Invoice is for"
                  value={form.subject}
                  onChange={(event) => setFormWithTotals((prev) => ({ ...prev, subject: event.target.value }))}
                />
              </div>

              <div style={shell.itemSection}>
                <div style={shell.itemHead}>
                  <span>Item Table</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button type="button" style={shell.actionLinkBtn} onClick={scanItem}>Scan Item</button>
                    <button type="button" style={shell.actionLinkBtn} onClick={applyBulkTax}>Bulk Actions</button>
                  </div>
                </div>
                <div style={itemTableWrapStyle}>
                  <table style={itemTableStyle}>
                    <thead>
                      {isMobile ? (
                        <tr>
                          <th style={{ ...shell.itemTh, width: '100%' }}>Item Details</th>
                        </tr>
                      ) : (
                        <tr>
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
                        const qty = Number(line.quantity || 0);
                        const rate = Number(line.rate || 0);
                        const base = qty * rate;
                        const amount = base;
                        return (
                          <tr key={`${index}-${line.itemId || 'line'}`}>
                            <td style={shell.itemTd}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <select
                                  style={shell.input}
                                  value={line.itemId}
                                  onChange={(event) => handleItemSelect(index, event.target.value)}
                                >
                                  <option value="">Type or click to select an item.</option>
                                  {itemsCatalog.map((item) => (
                                    <option key={item._id} value={item._id}>{item.name}</option>
                                  ))}
                                </select>
                                <textarea
                                  style={{ ...shell.textArea, minHeight: '50px' }}
                                  placeholder="Description"
                                  value={line.description}
                                  onChange={(event) => updateLine(index, { description: event.target.value })}
                                />
                                <span style={shell.tinyText}>
                                  {line.itemType?.toUpperCase() || 'SERVICE'} SAC: {line.sac || '-'}
                                </span>
                                <div style={itemMetaGridStyle}>
                                  <div style={shell.itemMetaField}>
                                    <span style={shell.itemMetaLabel}>Contract Period</span>
                                    <select
                                      style={shell.itemMetaInput}
                                      value={line.contractPeriod || ''}
                                      onChange={(event) => updateLine(index, { contractPeriod: event.target.value })}
                                    >
                                      <option value="">Select period</option>
                                      {contractPeriodOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={shell.itemMetaField}>
                                    <span style={shell.itemMetaLabel}>Contract Start Date</span>
                                    <input
                                      type="date"
                                      style={shell.itemMetaInput}
                                      value={line.contractStartDate || ''}
                                      onChange={(event) => updateLine(index, { contractStartDate: event.target.value })}
                                    />
                                  </div>
                                  <div style={shell.itemMetaField}>
                                    <span style={shell.itemMetaLabel}>Contract End Date</span>
                                    <input
                                      type="date"
                                      style={shell.itemMetaInput}
                                      value={line.contractEndDate || ''}
                                      readOnly
                                    />
                                  </div>
                                  <div style={shell.itemMetaField}>
                                    <span style={shell.itemMetaLabel}>Renewal Date</span>
                                    <input
                                      type="date"
                                      style={shell.itemMetaInput}
                                      value={line.renewalDate || ''}
                                      readOnly
                                    />
                                  </div>
                                  <div style={shell.itemMetaField}>
                                    <span style={shell.itemMetaLabel}>Service Frequency</span>
                                    <select
                                      style={shell.itemMetaInput}
                                      value={line.serviceFrequency || ''}
                                      onChange={(event) => updateLine(index, { serviceFrequency: event.target.value })}
                                    >
                                      <option value="">Select frequency</option>
                                      {serviceFrequencyOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={shell.itemMetaField}>
                                    <span style={shell.itemMetaLabel}>Total Services</span>
                                    <input
                                      style={shell.itemMetaInput}
                                      value={line.totalServices || ''}
                                      readOnly
                                    />
                                  </div>
                                </div>
                                {isMobile ? (
                                  <>
                                    <div style={mobileItemInlineGridStyle}>
                                      <div style={shell.itemMetaField}>
                                        <span style={shell.itemMetaLabel}>Quantity</span>
                                        <input
                                          style={shell.itemMetaInput}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={line.quantity}
                                          onChange={(event) => updateLine(index, { quantity: event.target.value })}
                                        />
                                      </div>
                                      <div style={shell.itemMetaField}>
                                        <span style={shell.itemMetaLabel}>Rate</span>
                                        <input
                                          style={shell.itemMetaInput}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={line.rate}
                                          onChange={(event) => updateLine(index, { rate: event.target.value })}
                                        />
                                      </div>
                                    </div>
                                    <div style={mobileItemInlineGridStyle}>
                                      <div style={shell.itemMetaField}>
                                        <span style={shell.itemMetaLabel}>Tax</span>
                                        <select
                                          style={shell.itemMetaInput}
                                          value={line.taxRate}
                                          onChange={(event) => updateLine(index, { taxRate: event.target.value })}
                                          disabled={form.invoiceType === 'NON GST'}
                                        >
                                          {(form.invoiceType === 'NON GST' ? [0] : taxOptions).map((tax) => (
                                            <option key={tax} value={String(tax)}>{tax}%</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div style={shell.itemMetaField}>
                                        <span style={shell.itemMetaLabel}>Amount</span>
                                        <div style={{ ...shell.itemMetaInput, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <strong>{formatINR(amount)}</strong>
                                          <button type="button" style={shell.iconButton} onClick={() => removeLine(index)} title="Remove row">
                                            <Trash2 size={14} />
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
                                <td style={shell.itemTd}>
                                  <input
                                    style={shell.input}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.quantity}
                                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                                  />
                                </td>
                                <td style={shell.itemTd}>
                                  <input
                                    style={shell.input}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.rate}
                                    onChange={(event) => updateLine(index, { rate: event.target.value })}
                                  />
                                </td>
                                <td style={shell.itemTd}>
                                  <select
                                    style={shell.input}
                                    value={line.taxRate}
                                    onChange={(event) => updateLine(index, { taxRate: event.target.value })}
                                    disabled={form.invoiceType === 'NON GST'}
                                  >
                                    {(form.invoiceType === 'NON GST' ? [0] : taxOptions).map((tax) => (
                                      <option key={tax} value={String(tax)}>{tax}%</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ ...shell.itemTd, fontWeight: 700 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span>{formatINR(amount)}</span>
                                    <button type="button" style={shell.iconButton} onClick={() => removeLine(index)} title="Remove row">
                                      <Trash2 size={14} />
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
                <div style={shell.taxControlRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label>
                      <input
                        type="radio"
                        name="withholdingType"
                        checked={form.withholdingType === 'TDS'}
                        onChange={() => setFormWithTotals((prev) => ({ ...prev, withholdingType: 'TDS' }))}
                      />{' '}
                      TDS
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="withholdingType"
                        checked={form.withholdingType === 'TCS'}
                        onChange={() => setFormWithTotals((prev) => ({ ...prev, withholdingType: 'TCS' }))}
                      />{' '}
                      TCS
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <select
                      style={shell.tinySelect}
                      value={form.withholdingRate}
                      onChange={(event) => setFormWithTotals((prev) => ({ ...prev, withholdingRate: event.target.value }))}
                    >
                      {withholdingRates.map((rate) => (
                        <option key={rate} value={String(rate)}>
                          {rate === 0 ? 'Select a Tax' : `${rate}%`}
                        </option>
                      ))}
                    </select>
                    <strong style={{ color: '#64748b' }}>{`- ${formatINR(form.withholdingAmount)}`}</strong>
                  </div>
                </div>
                <div style={shell.totalRow}>
                  <span>Round Off</span>
                  <input
                    style={{ ...shell.input, width: '88px', minHeight: '30px', textAlign: 'right' }}
                    type="number"
                    step="0.01"
                    value={form.roundOff}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, roundOff: event.target.value }))}
                  />
                </div>
                <div style={shell.totalSummaryRow}>
                  <span style={shell.totalLast}>Total ( ₹ )</span>
                  <strong style={shell.totalLast}>{formatINR(form.total)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={shell.label}>Customer Notes</label>
                  <textarea
                    style={{ ...shell.textArea, borderRadius: '6px', minHeight: '64px' }}
                    value={form.customerNotes}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, customerNotes: event.target.value }))}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Will be displayed on the invoice</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={shell.label}>Terms & Conditions</label>
                  <textarea
                    style={{ ...shell.textArea, borderRadius: '6px', minHeight: '64px' }}
                    placeholder="Enter the terms and conditions of your business"
                    value={form.termsAndConditions}
                    onChange={(event) => setFormWithTotals((prev) => ({ ...prev, termsAndConditions: event.target.value }))}
                  />
                </div>
                <div style={shell.serviceScheduleBlock}>
                  <div style={shell.serviceScheduleHead}>
                    <label style={shell.label}>Service Schedules</label>
                    <div style={shell.serviceScheduleTimeControl}>
                      <span>Default Time</span>
                      <input
                        type="time"
                        style={{ ...shell.itemMetaInput, minHeight: '34px', width: '130px' }}
                        value={serviceScheduleTime}
                        onChange={(event) =>
                          setFormWithTotals((prev) => ({
                            ...prev,
                            serviceScheduleDefaultTime: normalizeTimeInput(event.target.value, '10:00')
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div style={shell.serviceScheduleCount}>
                    Auto-generated visits: {generatedServiceSchedules.length}
                  </div>
                  {generatedServiceSchedules.length > 0 ? (
                    <div style={shell.serviceScheduleTableWrap}>
                      <table style={serviceScheduleTableStyle}>
                        <thead>
                          <tr>
                            <th style={shell.serviceScheduleTh}>Service #</th>
                            <th style={shell.serviceScheduleTh}>Date</th>
                            <th style={shell.serviceScheduleTh}>Time</th>
                            <th style={shell.serviceScheduleTh}>Customer</th>
                            <th style={shell.serviceScheduleTh}>Item Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedServiceSchedules.map((entry) => (
                            <tr key={entry.key}>
                              <td style={shell.serviceScheduleTd}>{entry.serviceNumber}</td>
                              <td style={shell.serviceScheduleTd}>{formatDisplayDate(entry.serviceDate)}</td>
                              <td style={shell.serviceScheduleTd}>{entry.serviceTime}</td>
                              <td style={shell.serviceScheduleTd}>{form.customerName || '-'}</td>
                              <td style={shell.serviceScheduleTd}>
                                <div style={{ fontWeight: 700 }}>{entry.itemName || '-'}</div>
                                <div style={{ marginTop: '2px', color: '#64748b', fontSize: '11px' }}>
                                  {entry.itemDescription || 'No description'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={shell.serviceScheduleEmpty}>
                      Add Contract Start Date, Contract End Date, and Service Frequency in item rows to auto-create schedules.
                    </div>
                  )}
                </div>
                <div style={shell.paymentBlock}>
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
                            ? (Array.isArray(prev.paymentSplits) && prev.paymentSplits.length > 0 ? prev.paymentSplits : [createEmptyPaymentSplit()])
                            : prev.paymentSplits
                        }))
                      }
                    />
                    I have received the payment
                  </label>

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
                                    value={split.depositTo || 'Billing'}
                                    onChange={(event) => updatePaymentSplit(index, { depositTo: event.target.value })}
                                  >
                                    {paymentDepositOptions.map((account) => (
                                      <option key={account} value={account}>{account}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={shell.paymentTd}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    style={{ ...shell.paymentInput, textAlign: 'right' }}
                                    value={split.amount ?? '0'}
                                    onChange={(event) => updatePaymentSplit(index, { amount: event.target.value })}
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

            <div style={modalFooterStyle}>
              {saveError ? (
                <div style={{ marginRight: 'auto', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                  {saveError}
                </div>
              ) : null}
              <button
                type="button"
                style={shell.cancelButton}
                onClick={closeInvoiceModal}
              >
                Cancel
              </button>
              <button type="submit" style={shell.saveButton} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingId ? 'Update Contract' : 'Save Contract'}
              </button>
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
              <div style={miniPrefsGridStyle}>
                <div>
                  <label style={shell.label}>Prefix</label>
                  <input
                    style={shell.input}
                    value={invoiceNumberPrefsDraft.prefix}
                    onChange={(event) =>
                      setInvoiceNumberPrefsDraft((prev) => ({ ...prev, prefix: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label style={shell.label}>Next Number</label>
                  <input
                    style={shell.input}
                    inputMode="numeric"
                    value={String(invoiceNumberPrefsDraft.nextNumber)}
                    onChange={(event) =>
                      setInvoiceNumberPrefsDraft((prev) => ({
                        ...prev,
                        nextNumber: Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1)
                      }))
                    }
                  />
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
                style={shell.cancelButton}
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
                    <p style={shell.addressChoiceTitle}>{option.label}</p>
                    <p style={shell.addressChoiceText}>{addressOptionText(option)}</p>
                  </div>
                </div>
              ))}
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
                style={shell.cancelButton}
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
                    <p style={shell.addressChoiceTitle}>{option.label}</p>
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
              <button type="button" style={shell.outlineBtn} onClick={startNewShippingAddress}>
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
                {editingShippingAddressId === 'new' ? 'Add New Address' : 'Edit Address'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingShippingAddressId === 'new' ? (
                  <button
                    type="button"
                    style={shell.outlineBtn}
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
              <label style={shell.label}>Address Street 1</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.line1}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, line1: event.target.value }))}
              />
              <label style={shell.label}>Address Street 2</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.line2}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, line2: event.target.value }))}
              />
              <label style={shell.label}>Area</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.area}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, area: event.target.value }))}
              />
              <label style={shell.label}>State</label>
              <select
                style={shell.input}
                value={shippingAddressDraft.state}
                onChange={(event) =>
                  setShippingAddressDraft((prev) => ({
                    ...prev,
                    state: event.target.value,
                    placeOfSupply: normalizeGstState(event.target.value)
                  }))
                }
              >
                <option value="">Select GST state</option>
                {gstStateOptions.map((state) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
              <label style={shell.label}>Pincode</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.pincode}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, pincode: event.target.value }))}
              />
              <label style={shell.label}>GSTIN</label>
              <input
                style={shell.input}
                value={shippingAddressDraft.gstin}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, gstin: event.target.value }))}
              />
              <label style={shell.label}>Place of Supply</label>
              <select
                style={shell.input}
                value={shippingAddressDraft.placeOfSupply}
                onChange={(event) => setShippingAddressDraft((prev) => ({ ...prev, placeOfSupply: event.target.value }))}
              >
                <option value="">Select GST state</option>
                {gstStateOptions.map((state) => {
                  const label = getGstStateLabel(state);
                  return (
                    <option key={state.code} value={label}>{label}</option>
                  );
                })}
              </select>
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
    </section>
  );
}
