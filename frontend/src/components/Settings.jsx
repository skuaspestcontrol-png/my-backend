import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  defaultCompanyProfileSettings,
  defaultInvoiceFieldSettings,
  defaultInvoiceTemplate,
  defaultInvoiceVisibleColumns,
  invoiceColumns,
  invoiceFieldOptions,
  invoiceTemplateOptions,
  normalizeInvoiceFieldSettings,
  normalizeInvoiceTemplate,
  normalizeInvoiceVisibleColumns
} from '../utils/invoicePreferences';
import { applyBrandingTheme, saveBrandingSettings } from '../utils/brandingTheme';
import WhatsAppSettings from '../pages/settings/WhatsAppSettings';
import WhatsAppTemplates from '../pages/settings/WhatsAppTemplates';
import WhatsAppLogs from '../pages/whatsapp/WhatsAppLogs';
import EmailSettings from '../pages/settings/EmailSettings';
import EmailTemplates from '../pages/settings/EmailTemplates';
import EmailLogs from '../pages/email/EmailLogs';
import GoogleIntegrationSettings from '../pages/settings/GoogleIntegrationSettings';
import { PHONE_VALIDATION_ERROR, isValidIndianMobileNumber, normalizeIndianMobileNumber } from '../utils/phone';
import { useColumnResize } from './table/useColumnResize';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

const gstStateCodeEntries = [
  { code: '01', label: 'Jammu and Kashmir' },
  { code: '02', label: 'Himachal Pradesh' },
  { code: '03', label: 'Punjab' },
  { code: '04', label: 'Chandigarh' },
  { code: '05', label: 'Uttarakhand' },
  { code: '06', label: 'Haryana' },
  { code: '07', label: 'Delhi' },
  { code: '08', label: 'Rajasthan' },
  { code: '09', label: 'Uttar Pradesh' },
  { code: '10', label: 'Bihar' },
  { code: '11', label: 'Sikkim' },
  { code: '12', label: 'Arunachal Pradesh' },
  { code: '13', label: 'Nagaland' },
  { code: '14', label: 'Manipur' },
  { code: '15', label: 'Mizoram' },
  { code: '16', label: 'Tripura' },
  { code: '17', label: 'Meghalaya' },
  { code: '18', label: 'Assam' },
  { code: '19', label: 'West Bengal' },
  { code: '20', label: 'Jharkhand' },
  { code: '21', label: 'Odisha' },
  { code: '22', label: 'Chhattisgarh' },
  { code: '23', label: 'Madhya Pradesh' },
  { code: '24', label: 'Gujarat' },
  { code: '25', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '26', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', label: 'Maharashtra' },
  { code: '28', label: 'Andhra Pradesh' },
  { code: '29', label: 'Karnataka' },
  { code: '30', label: 'Goa' },
  { code: '31', label: 'Lakshadweep' },
  { code: '32', label: 'Kerala' },
  { code: '33', label: 'Tamil Nadu' },
  { code: '34', label: 'Puducherry' },
  { code: '35', label: 'Andaman and Nicobar Islands' },
  { code: '36', label: 'Telangana' },
  { code: '37', label: 'Andhra Pradesh' },
  { code: '38', label: 'Ladakh' }
];

const gstStateCodeMap = gstStateCodeEntries.reduce((acc, entry) => {
  acc[entry.code] = entry.label;
  return acc;
}, {});

const bankColumns = ['primary', 'type', 'bankName', 'accountNumber', 'ifsc', 'upiId', 'openingBalance', 'currentBalance', 'actions'];
const bankColumnWidths = {
  primary: 86,
  type: 100,
  bankName: 180,
  accountNumber: 170,
  ifsc: 140,
  upiId: 170,
  openingBalance: 140,
  currentBalance: 140,
  actions: 210
};
const bankColumnBounds = {
  primary: { min: 72, max: 110 },
  type: { min: 80, max: 130 },
  bankName: { min: 140, max: 260 },
  accountNumber: { min: 140, max: 240 },
  ifsc: { min: 120, max: 180 },
  upiId: { min: 140, max: 260 },
  openingBalance: { min: 120, max: 180 },
  currentBalance: { min: 120, max: 180 },
  actions: { min: 180, max: 260 }
};

const defaultSecurityForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const normalizeGstinDisplay = (value) => {
  const normalized = String(value || '').toUpperCase().replace(/\s/g, '');
  return /^[0-9A-Z]{15}$/.test(normalized) ? normalized : '';
};

const normalizePanDisplay = (value) => {
  const normalized = String(value || '').toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized) ? normalized : '';
};

const normalizeEmailDisplay = (value) => {
  const normalized = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
};

const normalizePhoneDisplay = (value) => {
  const normalized = normalizeIndianMobileNumber(value || '');
  return isValidIndianMobileNumber(normalized) ? normalized : '';
};

const onOffOptions = ['On', 'Off'];
const smtpEncryptionOptions = ['TLS', 'SSL', 'None'];
const smtpActiveOptions = ['Yes', 'No'];

const sectionGroups = [
  {
    key: 'general',
    label: 'General Settings',
    items: [
      { key: 'businessIdentity', label: 'Profile' },
      { key: 'gstCompany', label: 'GST Company' },
      { key: 'nonGstCompany', label: 'Non GST Company' },
      { key: 'bankAccounts', label: 'Bank Account' },
      { key: 'documentPrefixes', label: 'Prefixes' },
      { key: 'googleIntegration', label: 'Google Integration' },
      { key: 'dataHealth', label: 'Data Health' },
      { key: 'termsConditions', label: 'Terms & Conditions' },
      { key: 'security', label: 'Change Password' }
    ]
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Settings',
    items: [
      { key: 'whatsappApiSettings', label: 'API Settings' },
      { key: 'whatsappTemplates', label: 'Templates' },
      { key: 'whatsappLogs', label: 'Logs' }
    ]
  },
  {
    key: 'email',
    label: 'Email Settings',
    items: [
      { key: 'emailApiSettings', label: 'API Settings' },
      { key: 'emailTemplates', label: 'Templates' },
      { key: 'emailLogs', label: 'Logs' }
    ]
  }
];

const defaultForm = {
  ...defaultCompanyProfileSettings,
  gstCompanyName: '',
  gstPanNumber: '',
  gstLicenseNumber: '',
  gstRegistrationNumber: '',
  gstBillingAddress: '',
  gstCity: '',
  gstState: '',
  gstStateCode: '',
  gstPincode: '',
  gstPhone: '',
  gstAlternatePhone: '',
  gstEmail: '',
  gstCompanyLogoUrl: '',
  gstDigitalSignatureUrl: '',
  gstCompanyStampUrl: '',
  aboutTagline: '',
  companyServices: '',
  nonGstCompanyName: '',
  nonGstBillingAddress: '',
  nonGstCity: '',
  nonGstAddress: '',
  nonGstState: '',
  nonGstPincode: '',
  nonGstPhone: '',
  nonGstAlternatePhone: '',
  nonGstEmail: '',
  nonGstCompanyLogoUrl: '',
  nonGstDigitalSignatureUrl: '',
  gstBankName: '',
  gstBankAccountNumber: '',
  gstBankIfsc: '',
  gstBankBranch: '',
  gstBankUpiId: '',
  gstBankOpeningBalance: '0',
  gstBankCurrentBalance: '0',
  gstBankQrUrl: '',
  gstBankPrimary: true,
  nonGstBankName: '',
  nonGstBankAccountNumber: '',
  nonGstBankIfsc: '',
  nonGstBankBranch: '',
  nonGstBankUpiId: '',
  nonGstBankOpeningBalance: '0',
  nonGstBankCurrentBalance: '0',
  nonGstBankQrUrl: '',
  nonGstBankPrimary: false,
  adminUsername: 'admin',
  adminPassword: 'admin123',
  termsAndConditionsDefault: '',
  gstTermsAndConditions: '',
  nonGstTermsAndConditions: '',
  renewalLetterTermsAndConditions: '',
  customerNotesDefault: '',
  settingsAccessPin: '',
  invoiceNumberMode: 'auto',
  invoicePrefix: 'SPC-',
  invoiceNextNumber: '66',
  invoiceNumberPadding: '4',
  quotationPrefix: 'SPC/',
  quotationFinancialYear: String(new Date().getFullYear()),
  quotationNextNumber: '1',
  quotationNumberPadding: '4',
  quotationFormatTemplate: '{{prefix}}{{year}}/{{service_code}}/{{number}}',
  quotationEnableServiceCode: true,
  renewalPrefix: 'SPC/REN/',
  renewalNextNumber: '1',
  renewalPadding: '3',
  renewalNumberPadding: '3',
  jobPrefix: 'JOB-',
  jobNextNumber: '1',
  jobNumberPadding: '6',
  employeeCodePrefix: 'EMP-',
  employeeCodeNextNumber: '1001',
  employeeCodePadding: '4',
  smtpSenderName: '',
  smtpFromEmail: '',
  smtpUser: '',
  smtpPass: '',
  smtpHost: '',
  smtpPort: '587',
  smtpEncryption: 'TLS',
  smtpActive: 'Yes',
  smtpSecure: false,
  smtpTestTargetEmail: '',
  whatsappApiVersion: 'v23.0',
  whatsappPhoneNumber: '',
  whatsappInstanceId: '',
  whatsappAccessToken: '',
  whatsappContractExpiryToOwner: 'On',
  whatsappContractExpiryToCustomer: 'Off',
  whatsappLeadFollowupToOwner: 'On',
  whatsappLeadFollowupToCustomer: 'Off',
  whatsappLoginAlertToOwner: 'On',
  whatsappLoginAlertToCustomer: 'Off',
  whatsappBusinessDigestToOwner: 'Off',
  whatsappBusinessDigestToCustomer: 'Off',
  invoiceTemplate: defaultInvoiceTemplate,
  invoiceVisibleColumns: [...defaultInvoiceVisibleColumns],
  invoiceFieldSettings: { ...defaultInvoiceFieldSettings },
  profitCostDefaultWorkingDaysPerMonth: '26',
  profitCostDefaultWorkingHoursPerDay: '8',
  profitCostDefaultManpowerCostPerVisit: '0',
  profitCostDefaultConveyanceCostPerVisit: '0',
  profitCostLowMarginWarningPercent: '20',
  profitCostExcludeGstFromRevenue: true,
  dashboardImageUrl: '',
  brandingAppearance: 'light',
  brandingAccentColor: '#EF4444'
};

const shell = {
  page: {
    display: 'grid',
    gap: '14px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    backdropFilter: 'none'
  },
  headingWrap: { display: 'grid', gap: '4px' },
  heading: { margin: 0, fontSize: '30px', letterSpacing: '-0.02em', color: 'var(--text)', fontWeight: 800 },
  subHeading: { margin: 0, fontSize: '13px', color: 'var(--muted)', fontWeight: 600 },
  workspaceShell: {
    display: 'grid',
    gap: '12px',
    background: 'transparent',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    padding: 0
  },
  controlBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap'
  },
  controlBadge: {
    minHeight: '44px',
    borderRadius: '12px',
    border: '1px solid rgba(159, 23, 77, 0.42)',
    background: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '16px',
    padding: '0 16px',
    display: 'inline-flex',
    alignItems: 'center'
  },
  progressPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: '999px',
    background: 'rgba(17, 17, 17, 0.04)',
    border: '1px solid var(--border)',
    color: '#3f3f46',
    fontSize: '14px',
    fontWeight: 800,
    padding: '8px 14px'
  },
  panel: {
    background: '#ffffff',
    borderRadius: '24px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '760px'
  },
  panelHeader: {
    borderBottom: '1px solid var(--border)',
    padding: '18px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap'
  },
  panelHeaderMain: { minWidth: '250px', flex: '1 1 340px' },
  panelHeaderSide: { display: 'grid', justifyItems: 'end', gap: '10px' },
  panelHeaderButtons: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  panelTitle: { margin: 0, color: 'var(--text)', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.01em' },
  panelStatus: { margin: '3px 0 0 0', fontSize: '12px', fontWeight: 700, color: 'var(--muted)' },
  validation: { fontSize: '14px', fontWeight: 800, color: 'var(--sky-deep)', textAlign: 'right' },
  topButton: {
    minHeight: '42px',
    borderRadius: '10px',
    border: '1px solid rgba(17, 17, 17, 0.2)',
    background: '#fff',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 800,
    padding: '0 14px',
    cursor: 'pointer'
  },
  topButtonPrimary: { borderColor: 'rgba(159, 23, 77, 0.52)', background: 'var(--color-primary)', color: '#ffffff' },
  settingsContentShell: {
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    alignItems: 'stretch',
    minHeight: 0,
    flex: 1
  },
  tabsRow: {
    display: 'grid',
    alignContent: 'start',
    gap: '6px',
    padding: '14px',
    borderRight: '1px solid var(--border)',
    background: '#fbfcff',
    justifyItems: 'stretch'
  },
  tabButton: {
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    color: 'var(--color-text)',
    padding: '9px 10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    justifyContent: 'flex-start',
    width: '100%',
    outline: 'none'
  },
  tabButtonActive: {
    color: 'var(--color-white)',
    borderColor: 'transparent',
    background: 'var(--color-primary)',
    boxShadow: 'var(--shadow-md)',
    fontWeight: 800
  },
  menuGroup: {
    display: 'grid',
    gap: '5px',
    padding: '4px',
    borderRadius: '10px',
    background: 'transparent'
  },
  groupToggle: {
    width: '100%',
    minHeight: '42px',
    border: '1px solid transparent',
    borderRadius: '12px',
    background: 'transparent',
    color: 'var(--color-text)',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  childButton: {
    marginLeft: '8px',
    width: 'calc(100% - 8px)'
  },
  panelBody: { padding: '14px 16px', display: 'grid', alignContent: 'start', gap: '10px', flex: 1 },
  sectionHeading: { margin: 0, color: '#374151', fontSize: '13px', fontWeight: 800, letterSpacing: '0.02em' },
  infoBanner: {
    borderRadius: '10px',
    border: '1px solid rgba(252, 231, 243, 0.22)',
    background: 'rgba(252, 231, 243, 0.2)',
    color: '#1f4b66',
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1.5
  },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px 14px' },
  threeCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 14px' },
  fourCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 14px' },
  field: { display: 'grid', gap: '6px' },
  fieldLabel: { margin: 0, fontSize: '11px', color: '#4b5563', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    width: '100%',
    minHeight: '44px',
    borderRadius: '12px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    background: '#fff',
    padding: '9px 12px',
    fontSize: '14px',
    color: 'var(--text)'
  },
  textArea: {
    width: '100%',
    minHeight: '66px',
    borderRadius: '12px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    background: '#fff',
    padding: '9px 12px',
    fontSize: '14px',
    color: 'var(--text)',
    resize: 'vertical'
  },
  profileCard: {
    borderRadius: '16px',
    border: '1px dashed rgba(15, 23, 42, 0.16)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.92) 100%)',
    padding: '14px',
    display: 'grid',
    gap: '10px'
  },
  profileRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  profilePreview: {
    width: '88px',
    height: '88px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    overflow: 'hidden',
    color: '#6b7280',
    fontSize: '12px',
    fontWeight: 700
  },
  profileImg: { width: '100%', height: '100%', objectFit: 'contain' },
  tinyButton: {
    minHeight: '40px',
    borderRadius: '10px',
    border: '1px solid rgba(15, 23, 42, 0.14)',
    background: '#fff',
    color: 'var(--color-primary-dark)',
    fontSize: '12px',
    fontWeight: 800,
    padding: '0 14px',
    cursor: 'pointer'
  },
  tinyButtonGhost: { border: '1px solid rgba(17, 17, 17, 0.2)', background: '#fff', color: 'var(--text)' },
  hint: { margin: 0, color: '#6b7280', fontSize: '11px', fontWeight: 700 },
  divider: { borderTop: '1px solid var(--border)', margin: '2px 0' },
  inlineActionRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'end', gap: '10px' },
  testButton: {
    minHeight: '49px',
    borderRadius: '10px',
    border: '1px solid rgba(16, 185, 129, 0.5)',
    background: 'rgba(16, 185, 129, 0.08)',
    color: '#15803d',
    fontSize: '13px',
    fontWeight: 800,
    padding: '0 14px',
    cursor: 'pointer'
  },
  checkboxGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 12px' },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: '#fff',
    minHeight: '45px',
    padding: '0 12px',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 700
  },
  bankHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  bankActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  bankCard: {
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: '#fff',
    padding: '14px',
    display: 'grid',
    gap: '12px'
  },
  bankCardTitle: { margin: 0, fontSize: '20px', fontWeight: 800, color: '#334155' },
  bankQrPreview: {
    width: '108px',
    height: '108px',
    borderRadius: '12px',
    border: '1px dashed var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    overflow: 'hidden',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 700
  },
  bankTableWrap: { border: '1px solid var(--border)', borderRadius: '14px', background: '#fff', overflowX: 'auto' },
  bankTable: { width: '100%', minWidth: '980px', borderCollapse: 'collapse' },
  bankTh: { textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: '#475569', fontWeight: 800, whiteSpace: 'nowrap' },
  bankTd: { padding: '10px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '13px', color: '#0f172a', verticalAlign: 'top' },
  smallActionBtn: {
    minHeight: '32px',
    borderRadius: '8px',
    border: '1px solid rgba(159, 23, 77, 0.36)',
    background: '#fff',
    color: 'var(--color-primary-dark)',
    fontSize: '12px',
    fontWeight: 800,
    padding: '0 10px',
    cursor: 'pointer'
  },
  strengthRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  strengthBadge: {
    minHeight: '26px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'rgba(15, 23, 42, 0.04)',
    color: '#1f2937',
    fontSize: '12px',
    fontWeight: 800,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center'
  },
  strengthTrack: {
    width: '100%',
    height: '8px',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden'
  },
  strengthFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 180ms ease',
    width: '0%'
  }
};

const isFilled = (value) => String(value || '').trim().length > 0;
const toSixDigitPincode = (value) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const isValidPincode = (value) => !value || /^\d{6}$/.test(value);

const normalizeGstStateCode = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{2})/);
  if (!match) return '';
  const code = match[1];
  const label = gstStateCodeMap[code];
  return label ? `${code} - ${label}` : code;
};

const deriveGstStateCodeFromGstin = (gstin) => {
  const match = String(gstin || '').trim().toUpperCase().match(/^(\d{2})/);
  if (!match) return '';
  const code = match[1];
  const label = gstStateCodeMap[code];
  return label ? `${code} - ${label}` : '';
};

const isStrongPassword = (value) => {
  const password = String(value || '');
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
};

const getPasswordStrength = (value) => {
  const password = String(value || '');
  if (!password) {
    return { label: 'Security: -', hint: 'Use 8+ characters with mix of letters, numbers, and symbols.', tone: '#64748b', width: '0%' };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Za-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  if (score <= 2) {
    return { label: 'Security: Weak', hint: 'Use 8+ characters with mix of letters, numbers, and symbols.', tone: '#ef4444', width: '35%' };
  }
  if (score <= 3) {
    return { label: 'Security: Medium', hint: 'Add symbols and increase length for stronger protection.', tone: '#f59e0b', width: '62%' };
  }
  return { label: 'Security: Strong', hint: 'Strong password. Keep it unique and private.', tone: '#16a34a', width: '100%' };
};

const toMoneyString = (value, fallback = '0') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : fallback;
};

const maskAccountNumber = (value) => {
  const digits = String(value || '').replace(/\s/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  return `${'X'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const getSectionCompletion = (form, securityForm) => {
  const securityTouched = [
    securityForm?.currentPassword,
    securityForm?.newPassword,
    securityForm?.confirmPassword
  ].some(isFilled);

  const securityReady = !securityTouched || (
    isFilled(securityForm?.currentPassword)
    && isStrongPassword(securityForm?.newPassword)
    && String(securityForm?.newPassword || '') === String(securityForm?.confirmPassword || '')
  );

  return {
    businessIdentity: [form.companyName, form.companyMobile, form.companyWebsite].every(isFilled),
    gstCompany: [form.gstCompanyName, form.companyGstNumber, form.gstBillingAddress, form.gstCity, form.gstState, form.gstPincode].every(isFilled),
    nonGstCompany: [form.nonGstCompanyName, form.nonGstBillingAddress, form.nonGstCity, form.nonGstState, form.nonGstPincode].every(isFilled),
    bankAccounts: [form.gstBankName, form.gstBankAccountNumber, form.gstBankIfsc, form.nonGstBankName, form.nonGstBankAccountNumber, form.nonGstBankIfsc].every(isFilled),
    documentPrefixes: [
      form.invoicePrefix,
      form.invoiceNextNumber,
      form.invoiceNumberPadding,
      form.quotationPrefix,
      form.quotationFinancialYear,
      form.quotationNextNumber,
      form.quotationNumberPadding,
      form.quotationFormatTemplate,
      form.renewalPrefix,
      form.renewalNextNumber,
      form.renewalNumberPadding,
      form.jobPrefix,
      form.jobNextNumber,
      form.jobNumberPadding,
      form.employeeCodePrefix,
      form.employeeCodeNextNumber,
      form.employeeCodePadding
    ].every(isFilled),
    whatsappApiSettings: [form.whatsappPhoneNumber, form.whatsappInstanceId, form.whatsappAccessToken].every(isFilled),
    whatsappTemplates: true,
    whatsappLogs: true,
    emailApiSettings: [form.smtpSenderName, form.smtpFromEmail, form.smtpUser, form.smtpHost, form.smtpPort].every(isFilled),
    emailTemplates: true,
    emailLogs: true,
    termsConditions: [form.gstTermsAndConditions, form.nonGstTermsAndConditions, form.renewalLetterTermsAndConditions].every(isFilled),
    invoiceSettings: Boolean(form.invoiceTemplate && Array.isArray(form.invoiceVisibleColumns) && form.invoiceVisibleColumns.length > 0),
    security: securityReady
  };
};

export default function Settings({ modalMode = false }) {
  const flatSections = useMemo(() => sectionGroups.flatMap((group) => group.items), []);
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(flatSections[0].key);
  const [expandedGroups, setExpandedGroups] = useState({
    general: false,
    whatsapp: false,
    email: false
  });
  const logoInputRef = useRef(null);
  const gstLogoInputRef = useRef(null);
  const gstSignatureInputRef = useRef(null);
  const nonGstLogoInputRef = useRef(null);
  const nonGstSignatureInputRef = useRef(null);
  const gstBankQrInputRef = useRef(null);
  const nonGstBankQrInputRef = useRef(null);
  const customAccentInputRef = useRef(null);
  const [securityForm, setSecurityForm] = useState(defaultSecurityForm);
  const [attendanceSourceHealth, setAttendanceSourceHealth] = useState(null);
  const [attendanceSourceHealthLoading, setAttendanceSourceHealthLoading] = useState(false);
  const [attendanceSourceHealthError, setAttendanceSourceHealthError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [isTouchDevice, setIsTouchDevice] = useState(() => (
    typeof window !== 'undefined'
      && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)
  ));
  const passwordStrength = useMemo(() => getPasswordStrength(securityForm.newPassword), [securityForm.newPassword]);
  const panelBodyRef = useRef(null);
  const brandingAccentOptions = ['#3B82F6', '#22C55E', '#EF4444', '#F59E0B'];
  const isMobile = viewportWidth <= 768;
  const isCompactLayout = isMobile || isTouchDevice || viewportWidth <= 1100;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const panel = panelBodyRef.current;
    if (panel) panel.scrollTop = 0;
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'dataHealth') {
      loadAttendanceSourceHealth();
    }
  }, [activeSection]);

  useEffect(() => {
    const updateTouchMode = () => {
      if (typeof window === 'undefined') return;
      setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    };
    updateTouchMode();
    window.addEventListener('resize', updateTouchMode);
    return () => window.removeEventListener('resize', updateTouchMode);
  }, []);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const [res, quotationPrefixRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/settings`),
          axios.get(`${API_BASE_URL}/api/settings/quotation-prefixes`).catch(() => ({ data: {} }))
        ]);
        if (!active) return;
        const data = res.data || {};
        const quotationPrefix = quotationPrefixRes.data || {};

        const gstCompanyName = String(data.gstCompanyName || '').trim();
        const gstBillingAddress = String(data.gstBillingAddress || '').trim();
        const gstCity = String(data.gstCity || '').trim();
        const gstState = String(data.gstState || '').trim();
        const gstPincode = toSixDigitPincode(data.gstPincode || '');
        const gstPhone = normalizePhoneDisplay(data.gstPhone);
        const gstEmail = normalizeEmailDisplay(data.gstEmail);
        const gstCompanyLogoUrl = String(data.gstCompanyLogoUrl || '').trim();
        const dashboardImageUrl = String(data.dashboardImageUrl || '').trim();
        const nonGstBillingAddress = String(data.nonGstBillingAddress || data.nonGstAddress || '').trim();
        const nonGstCity = String(data.nonGstCity || '').trim();
        const normalizedGstStateCode = normalizeGstStateCode(data.gstStateCode || deriveGstStateCodeFromGstin(data.companyGstNumber || ''));
        const companyMobile = normalizePhoneDisplay(data.companyMobile || data.gstPhone || '');
        const companyEmail = normalizeEmailDisplay(data.companyEmail || data.gstEmail || '');
        const companyGstNumber = normalizeGstinDisplay(data.companyGstNumber || '');

        const next = {
          ...defaultForm,
          ...data,
          gstCompanyName,
          gstPanNumber: normalizePanDisplay(data.gstPanNumber),
          gstLicenseNumber: data.gstLicenseNumber || '',
          gstRegistrationNumber: data.gstRegistrationNumber || '',
          gstBillingAddress,
          gstCity,
          gstState,
          gstStateCode: normalizedGstStateCode,
          gstPincode,
          gstPhone,
          gstAlternatePhone: data.gstAlternatePhone || '',
          gstEmail,
          gstCompanyLogoUrl,
          gstDigitalSignatureUrl: data.gstDigitalSignatureUrl || '',
          gstCompanyStampUrl: data.gstCompanyStampUrl || '',
          companyName: String(data.companyName || '').trim(),
          companyAddress: String(data.companyAddress || gstBillingAddress || '').trim(),
          companyCity: String(data.companyCity || gstCity || '').trim(),
          companyState: String(data.companyState || gstState || '').trim(),
          companyPincode: toSixDigitPincode(data.companyPincode || gstPincode || ''),
          companyGstNumber,
          companyEmail,
          companyMobile,
          companyWebsite: data.companyWebsite || '',
          dashboardImageUrl,
          brandingAppearance: String(data.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
          brandingAccentColor: String(data.brandingAccentColor || '#EF4444').trim() || '#EF4444',
          aboutTagline: data.aboutTagline || '',
          companyServices: data.companyServices || '',
          nonGstCompanyName: data.nonGstCompanyName || '',
          nonGstBillingAddress,
          nonGstCity,
          nonGstAddress: data.nonGstAddress || nonGstBillingAddress,
          nonGstState: data.nonGstState || '',
          nonGstPincode: toSixDigitPincode(data.nonGstPincode || ''),
          nonGstPhone: data.nonGstPhone || '',
          nonGstAlternatePhone: data.nonGstAlternatePhone || '',
          nonGstEmail: data.nonGstEmail || '',
          nonGstCompanyLogoUrl: data.nonGstCompanyLogoUrl || '',
          nonGstDigitalSignatureUrl: data.nonGstDigitalSignatureUrl || '',
          gstBankName: data.gstBankName || '',
          gstBankAccountNumber: data.gstBankAccountNumber || '',
          gstBankIfsc: data.gstBankIfsc || '',
          gstBankBranch: data.gstBankBranch || '',
          gstBankUpiId: data.gstBankUpiId || '',
          gstBankOpeningBalance: toMoneyString(data.gstBankOpeningBalance, '0'),
          gstBankCurrentBalance: toMoneyString(data.gstBankCurrentBalance, '0'),
          gstBankQrUrl: data.gstBankQrUrl || '',
          gstBankPrimary: data.gstBankPrimary !== false,
          nonGstBankName: data.nonGstBankName || '',
          nonGstBankAccountNumber: data.nonGstBankAccountNumber || '',
          nonGstBankIfsc: data.nonGstBankIfsc || '',
          nonGstBankBranch: data.nonGstBankBranch || '',
          nonGstBankUpiId: data.nonGstBankUpiId || '',
          nonGstBankOpeningBalance: toMoneyString(data.nonGstBankOpeningBalance, '0'),
          nonGstBankCurrentBalance: toMoneyString(data.nonGstBankCurrentBalance, '0'),
          nonGstBankQrUrl: data.nonGstBankQrUrl || '',
          nonGstBankPrimary: Boolean(data.nonGstBankPrimary),
          adminUsername: data.adminUsername || 'admin',
          adminPassword: data.adminPassword || 'admin123',
          gstTermsAndConditions: data.gstTermsAndConditions || data.termsAndConditionsDefault || '',
          nonGstTermsAndConditions: data.nonGstTermsAndConditions || '',
          renewalLetterTermsAndConditions: data.renewalLetterTermsAndConditions || '',
          customerNotesDefault: data.customerNotesDefault || '',
          termsAndConditionsDefault: data.termsAndConditionsDefault || data.gstTermsAndConditions || '',
          settingsAccessPin: data.settingsAccessPin || '',
          invoiceNumberMode: data.invoiceNumberMode === 'manual' ? 'manual' : 'auto',
          invoicePrefix: data.invoicePrefix || 'SPC-',
          invoiceNextNumber: String(data.invoiceNextNumber ?? 66),
          invoiceNumberPadding: String(data.invoiceNumberPadding ?? 4),
          quotationPrefix: quotationPrefix.prefix || data.quotationPrefix || 'SPC/',
          quotationFinancialYear: quotationPrefix.financial_year || data.quotationFinancialYear || String(new Date().getFullYear()),
          quotationNextNumber: String(quotationPrefix.next_number ?? data.quotationNextNumber ?? 1),
          quotationNumberPadding: String(quotationPrefix.padding_digits ?? data.quotationNumberPadding ?? 4),
          quotationFormatTemplate: quotationPrefix.format_template || data.quotationFormatTemplate || '{{prefix}}{{year}}/{{service_code}}/{{number}}',
          quotationEnableServiceCode: Number(quotationPrefix.enable_service_code ?? data.quotationEnableServiceCode ?? 1) === 1,
          renewalPrefix: data.renewalPrefix || 'SPC/REN/',
          renewalNextNumber: String(data.renewalNextNumber ?? 1),
          renewalPadding: String(data.renewalPadding ?? data.renewalNumberPadding ?? 3),
          renewalNumberPadding: String(data.renewalNumberPadding ?? data.renewalPadding ?? 3),
          jobPrefix: data.jobPrefix || 'JOB-',
          jobNextNumber: String(data.jobNextNumber ?? 1),
          jobNumberPadding: String(data.jobNumberPadding ?? 6),
          employeeCodePrefix: data.employeeCodePrefix || 'EMP-',
          employeeCodeNextNumber: String(data.employeeCodeNextNumber ?? 1001),
          employeeCodePadding: String(data.employeeCodePadding ?? 4),
          smtpSenderName: data.smtpSenderName || '',
          smtpFromEmail: data.smtpFromEmail || '',
          smtpUser: data.smtpUser || '',
          smtpPass: '',
          smtpHost: data.smtpHost || '',
          smtpPort: String(data.smtpPort ?? 587),
          smtpEncryption: data.smtpEncryption || (data.smtpSecure ? 'SSL' : 'TLS'),
          smtpActive: data.smtpActive || 'Yes',
          smtpSecure: Boolean(data.smtpSecure),
          smtpTestTargetEmail: data.smtpTestTargetEmail || '',
          whatsappApiVersion: data.whatsappApiVersion || 'v23.0',
          whatsappPhoneNumber: data.whatsappPhoneNumber || '',
          whatsappInstanceId: data.whatsappInstanceId || data.whatsappPhoneNumberId || '',
          whatsappAccessToken: data.whatsappAccessToken || '',
          whatsappContractExpiryToOwner: data.whatsappContractExpiryToOwner || 'On',
          whatsappContractExpiryToCustomer: data.whatsappContractExpiryToCustomer || 'Off',
          whatsappLeadFollowupToOwner: data.whatsappLeadFollowupToOwner || 'On',
          whatsappLeadFollowupToCustomer: data.whatsappLeadFollowupToCustomer || 'Off',
          whatsappLoginAlertToOwner: data.whatsappLoginAlertToOwner || 'On',
          whatsappLoginAlertToCustomer: data.whatsappLoginAlertToCustomer || 'Off',
          whatsappBusinessDigestToOwner: data.whatsappBusinessDigestToOwner || 'Off',
          whatsappBusinessDigestToCustomer: data.whatsappBusinessDigestToCustomer || 'Off',
          invoiceTemplate: normalizeInvoiceTemplate(data.invoiceTemplate),
          invoiceVisibleColumns: normalizeInvoiceVisibleColumns(data.invoiceVisibleColumns),
          invoiceFieldSettings: normalizeInvoiceFieldSettings(data.invoiceFieldSettings),
          profitCostDefaultWorkingDaysPerMonth: String(data.profitCostDefaultWorkingDaysPerMonth ?? 26),
          profitCostDefaultWorkingHoursPerDay: String(data.profitCostDefaultWorkingHoursPerDay ?? 8),
          profitCostDefaultManpowerCostPerVisit: toMoneyString(data.profitCostDefaultManpowerCostPerVisit, '0'),
          profitCostDefaultConveyanceCostPerVisit: toMoneyString(data.profitCostDefaultConveyanceCostPerVisit, '0'),
          profitCostLowMarginWarningPercent: String(data.profitCostLowMarginWarningPercent ?? 20),
          profitCostExcludeGstFromRevenue: data.profitCostExcludeGstFromRevenue !== false
        };

        setForm(next);
        setInitialForm(next);
        setSecurityForm(defaultSecurityForm);
        setStatus('Settings Saved');
        applyBrandingTheme(next);
        saveBrandingSettings(next);
      } catch (error) {
        console.error('Load settings failed', error);
        setStatus('Could not load settings. Please check backend server.');
      }
    };

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const statusTone = useMemo(() => {
    const raw = String(status || '').toLowerCase();
    if (raw.includes('could not') || raw.includes('failed')) return { color: '#dc2626' };
    if (raw.includes('saved')) return { color: 'var(--sky-deep)' };
    return { color: 'var(--muted)' };
  }, [status]);

  const updateField = (key, value) => {
    if (key === 'gstPincode' || key === 'companyPincode' || key === 'nonGstPincode') {
      setForm((prev) => ({ ...prev, [key]: toSixDigitPincode(value) }));
      return;
    }
    if (['companyMobile', 'gstPhone', 'gstAlternatePhone', 'nonGstPhone', 'nonGstAlternatePhone', 'whatsappPhoneNumber'].includes(key)) {
      setForm((prev) => ({ ...prev, [key]: normalizeIndianMobileNumber(value) }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateSecurityField = (key, value) => {
    setSecurityForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadAttendanceSourceHealth = async () => {
    setAttendanceSourceHealthLoading(true);
    setAttendanceSourceHealthError('');
    try {
      const headers = {
        'x-role': localStorage.getItem('portal_user_role') || 'Admin',
        'x-portal-role': localStorage.getItem('portal_user_role') || 'Admin',
        'x-user-name': localStorage.getItem('portal_user_name') || 'Admin'
      };
      const res = await axios.get(`${API_BASE_URL}/api/admin/attendance-source-health-summary`, { headers });
      setAttendanceSourceHealth(res.data || null);
    } catch (error) {
      console.error('Attendance source health load failed', error);
      setAttendanceSourceHealth(null);
      setAttendanceSourceHealthError(error?.response?.data?.error || error?.message || 'Unable to load attendance source health.');
    } finally {
      setAttendanceSourceHealthLoading(false);
    }
  };

  const handleGstinChange = (value) => {
    const normalizedGstin = String(value || '').toUpperCase().replace(/\s/g, '');
    const derivedCode = deriveGstStateCodeFromGstin(normalizedGstin);
    setForm((prev) => ({
      ...prev,
      companyGstNumber: normalizedGstin,
      gstStateCode: derivedCode || prev.gstStateCode
    }));
  };

  const toggleInvoiceColumn = (columnKey) => {
    setForm((prev) => {
      const current = normalizeInvoiceVisibleColumns(prev.invoiceVisibleColumns);
      if (current.includes(columnKey)) {
        if (current.length === 1) return prev;
        return { ...prev, invoiceVisibleColumns: current.filter((key) => key !== columnKey) };
      }
      return { ...prev, invoiceVisibleColumns: [...current, columnKey] };
    });
  };

  const toggleInvoiceField = (fieldKey) => {
    setForm((prev) => ({
      ...prev,
      invoiceFieldSettings: {
        ...prev.invoiceFieldSettings,
        [fieldKey]: !prev.invoiceFieldSettings[fieldKey]
      }
    }));
  };

  const uploadBrandingImage = async (file) => {
    const fd = new FormData();
    fd.append('brandingImage', file);
    const res = await axios.post(`${API_BASE_URL}/api/settings/upload-branding-image`, fd);
    return String(res.data?.relativePath || res.data?.imageUrl || '').trim();
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Uploading profile picture...');
      const imageUrl = await uploadBrandingImage(file);
      setForm((prev) => ({ ...prev, dashboardImageUrl: imageUrl }));
      setStatus(`Profile picture uploaded: ${imageUrl}`);
    } catch (error) {
      console.error('Logo upload failed', error);
      setStatus('Upload failed. Please try again.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleBrandingUpload = async (event, targetKey, label) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus(`Uploading ${label}...`);
      const imageUrl = await uploadBrandingImage(file);
      setForm((prev) => ({
        ...prev,
        [targetKey]: imageUrl,
      }));
      setStatus(`${label} uploaded: ${imageUrl}`);
    } catch (error) {
      console.error(`${label} upload failed`, error);
      setStatus(`Failed to upload ${label}. Please try again.`);
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleBankQrUpload = async (event, key, label) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus(`Uploading ${label} QR...`);
      const imageUrl = await uploadBrandingImage(file);
      setForm((prev) => ({ ...prev, [key]: imageUrl }));
      setStatus(`${label} QR uploaded: ${imageUrl}`);
    } catch (error) {
      console.error(`${label} QR upload failed`, error);
      setStatus(`Failed to upload ${label} QR.`);
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const resetBankSection = () => {
    setForm((prev) => ({
      ...prev,
      gstBankName: '',
      gstBankAccountNumber: '',
      gstBankIfsc: '',
      gstBankBranch: '',
      gstBankUpiId: '',
      gstBankOpeningBalance: '0',
      gstBankCurrentBalance: '0',
      gstBankQrUrl: '',
      gstBankPrimary: true,
      nonGstBankName: '',
      nonGstBankAccountNumber: '',
      nonGstBankIfsc: '',
      nonGstBankBranch: '',
      nonGstBankUpiId: '',
      nonGstBankOpeningBalance: '0',
      nonGstBankCurrentBalance: '0',
      nonGstBankQrUrl: '',
      nonGstBankPrimary: false
    }));
    setStatus('Bank details reset. Save changes to apply.');
  };

  const discardChanges = () => {
    setForm(initialForm);
    setSecurityForm(defaultSecurityForm);
    setStatus('Unsaved changes discarded.');
  };

  const saveAll = async () => {
    const hasPasswordAttempt = Object.values(securityForm).some(isFilled);
    const currentStoredPassword = String(initialForm.adminPassword || form.adminPassword || 'admin123');

    if (hasPasswordAttempt) {
      if (!isFilled(securityForm.currentPassword) || !isFilled(securityForm.newPassword) || !isFilled(securityForm.confirmPassword)) {
        setStatus('Please fill Current, New and Confirm password fields.');
        return;
      }
      if (securityForm.currentPassword !== currentStoredPassword) {
        setStatus('Current password is incorrect.');
        return;
      }
      if (!isStrongPassword(securityForm.newPassword)) {
        setStatus('New password must be 8+ characters with letters, numbers, and symbols.');
        return;
      }
      if (securityForm.newPassword !== securityForm.confirmPassword) {
        setStatus('New password and confirm password do not match.');
        return;
      }
    }

    const companyName = String(form.companyName || '').trim();
    const companyAddress = String(form.companyAddress || form.gstBillingAddress || '').trim();
    const companyCity = String(form.companyCity || form.gstCity || '').trim();
    const companyState = String(form.companyState || form.gstState || '').trim();
    const companyPincode = toSixDigitPincode(form.companyPincode || form.gstPincode || '');
    const companyMobile = normalizeIndianMobileNumber(form.companyMobile || form.gstPhone || '');
    const companyEmail = normalizeEmailDisplay(form.companyEmail || form.gstEmail || '');
    const gstCompanyName = String(form.gstCompanyName || '').trim();
    const gstBillingAddress = String(form.gstBillingAddress || '').trim();
    const gstCity = String(form.gstCity || '').trim();
    const gstState = String(form.gstState || '').trim();
    const gstPincode = toSixDigitPincode(form.gstPincode || '');
    const gstPhone = normalizePhoneDisplay(form.gstPhone);
    const gstEmail = normalizeEmailDisplay(form.gstEmail);
    const gstStateCode = normalizeGstStateCode(form.gstStateCode || deriveGstStateCodeFromGstin(form.companyGstNumber));
    const dashboardImageUrl = String(form.dashboardImageUrl || '').trim();
    const gstCompanyLogoUrl = String(form.gstCompanyLogoUrl || '').trim();
    const nonGstBillingAddress = String(form.nonGstBillingAddress || form.nonGstAddress || '').trim();
    const nonGstPincode = toSixDigitPincode(form.nonGstPincode || '');
    if (!isValidPincode(gstPincode)) {
      setStatus('GST company pincode must be exactly 6 digits.');
      return;
    }
    if (!isValidPincode(nonGstPincode)) {
      setStatus('Non-GST company pincode must be exactly 6 digits.');
      return;
    }
    const primaryPhone = String(companyMobile || gstPhone || '').trim();
    if (primaryPhone && !isValidIndianMobileNumber(primaryPhone)) {
      setStatus(PHONE_VALIDATION_ERROR);
      return;
    }
    const nextAdminPassword = hasPasswordAttempt ? securityForm.newPassword : String(form.adminPassword || currentStoredPassword || 'admin123');
    const encryption = String(form.smtpEncryption || 'TLS').toUpperCase();

    const payload = {
      gstCompanyName,
      gstPanNumber: normalizePanDisplay(form.gstPanNumber),
      gstLicenseNumber: String(form.gstLicenseNumber || '').trim(),
      gstRegistrationNumber: String(form.gstRegistrationNumber || '').trim(),
      gstBillingAddress,
      gstCity,
      gstState,
      gstStateCode,
      gstPincode,
      gstPhone,
      gstAlternatePhone: normalizeIndianMobileNumber(form.gstAlternatePhone || ''),
      gstEmail,
      gstCompanyLogoUrl,
      gstDigitalSignatureUrl: String(form.gstDigitalSignatureUrl || '').trim(),
      gstCompanyStampUrl: String(form.gstCompanyStampUrl || '').trim(),
      companyName,
      companyAddress,
      companyCity,
      companyState,
      companyPincode,
      companyGstNumber: normalizeGstinDisplay(form.companyGstNumber),
      companyEmail,
      companyMobile,
      companyWebsite: String(form.companyWebsite || '').trim(),
      dashboardImageUrl,
      brandingAppearance: form.brandingAppearance === 'dark' ? 'dark' : 'light',
      brandingAccentColor: String(form.brandingAccentColor || '#EF4444').trim() || '#EF4444',
      aboutTagline: String(form.aboutTagline || '').trim(),
      companyServices: String(form.companyServices || '').trim(),
      nonGstCompanyName: String(form.nonGstCompanyName || '').trim(),
      nonGstBillingAddress,
      nonGstCity: String(form.nonGstCity || '').trim(),
      nonGstAddress: nonGstBillingAddress,
      nonGstState: String(form.nonGstState || '').trim(),
      nonGstPincode,
      nonGstPhone: normalizeIndianMobileNumber(form.nonGstPhone || ''),
      nonGstAlternatePhone: normalizeIndianMobileNumber(form.nonGstAlternatePhone || ''),
      nonGstEmail: String(form.nonGstEmail || '').trim(),
      nonGstCompanyLogoUrl: String(form.nonGstCompanyLogoUrl || '').trim(),
      nonGstDigitalSignatureUrl: String(form.nonGstDigitalSignatureUrl || '').trim(),
      gstBankName: String(form.gstBankName || '').trim(),
      gstBankAccountNumber: String(form.gstBankAccountNumber || '').trim(),
      gstBankIfsc: String(form.gstBankIfsc || '').trim().toUpperCase(),
      gstBankBranch: String(form.gstBankBranch || '').trim(),
      gstBankUpiId: String(form.gstBankUpiId || '').trim(),
      gstBankOpeningBalance: Number(toMoneyString(form.gstBankOpeningBalance, '0')),
      gstBankCurrentBalance: Number(toMoneyString(form.gstBankCurrentBalance, '0')),
      gstBankQrUrl: String(form.gstBankQrUrl || '').trim(),
      gstBankPrimary: Boolean(form.gstBankPrimary),
      nonGstBankName: String(form.nonGstBankName || '').trim(),
      nonGstBankAccountNumber: String(form.nonGstBankAccountNumber || '').trim(),
      nonGstBankIfsc: String(form.nonGstBankIfsc || '').trim().toUpperCase(),
      nonGstBankBranch: String(form.nonGstBankBranch || '').trim(),
      nonGstBankUpiId: String(form.nonGstBankUpiId || '').trim(),
      nonGstBankOpeningBalance: Number(toMoneyString(form.nonGstBankOpeningBalance, '0')),
      nonGstBankCurrentBalance: Number(toMoneyString(form.nonGstBankCurrentBalance, '0')),
      nonGstBankQrUrl: String(form.nonGstBankQrUrl || '').trim(),
      nonGstBankPrimary: Boolean(form.nonGstBankPrimary),
      adminUsername: String(form.adminUsername || 'admin').trim() || 'admin',
      ...(hasPasswordAttempt ? { adminPassword: nextAdminPassword } : {}),
      gstTermsAndConditions: String(form.gstTermsAndConditions || '').trim(),
      nonGstTermsAndConditions: String(form.nonGstTermsAndConditions || '').trim(),
      renewalLetterTermsAndConditions: String(form.renewalLetterTermsAndConditions || '').trim(),
      customerNotesDefault: String(form.customerNotesDefault || '').trim(),
      termsAndConditionsDefault: String(form.gstTermsAndConditions || form.termsAndConditionsDefault || '').trim(),
      settingsAccessPin: String(form.settingsAccessPin || initialForm.settingsAccessPin || '').trim(),
      invoiceNumberMode: form.invoiceNumberMode === 'manual' ? 'manual' : 'auto',
      invoicePrefix: String(form.invoicePrefix || '').trim() || 'SPC-',
      invoiceNextNumber: Math.max(1, Number(form.invoiceNextNumber) || 1),
      invoiceNumberPadding: Math.max(1, Number(form.invoiceNumberPadding) || 4),
      quotationPrefix: String(form.quotationPrefix || '').trim() || 'SPC/',
      quotationFinancialYear: String(form.quotationFinancialYear || '').trim() || String(new Date().getFullYear()),
      quotationNextNumber: Math.max(1, Number(form.quotationNextNumber) || 1),
      quotationNumberPadding: Math.max(1, Number(form.quotationNumberPadding) || 4),
      quotationFormatTemplate: String(form.quotationFormatTemplate || '').trim() || '{{prefix}}{{year}}/{{service_code}}/{{number}}',
      quotationEnableServiceCode: Boolean(form.quotationEnableServiceCode),
      renewalPrefix: String(form.renewalPrefix || '').trim() || 'SPC/REN/',
      renewalNextNumber: Math.max(1, Number(form.renewalNextNumber) || 1),
      renewalPadding: Math.max(1, Number(form.renewalPadding || form.renewalNumberPadding) || 3),
      renewalNumberPadding: Math.max(1, Number(form.renewalNumberPadding || form.renewalPadding) || 3),
      jobPrefix: String(form.jobPrefix || '').trim() || 'JOB-',
      jobNextNumber: Math.max(1, Number(form.jobNextNumber) || 1),
      jobNumberPadding: Math.max(1, Number(form.jobNumberPadding) || 6),
      employeeCodePrefix: String(form.employeeCodePrefix || '').trim() || 'EMP-',
      employeeCodeNextNumber: Math.max(1, Number(form.employeeCodeNextNumber) || 1),
      employeeCodePadding: Math.max(1, Number(form.employeeCodePadding) || 4),
      smtpSenderName: String(form.smtpSenderName || '').trim(),
      smtpFromEmail: String(form.smtpFromEmail || '').trim(),
      smtpUser: String(form.smtpUser || '').trim(),
      smtpPass: String(form.smtpPass || initialForm.smtpPass || '').trim(),
      smtpHost: String(form.smtpHost || '').trim(),
      smtpPort: Math.max(1, Number(form.smtpPort) || 587),
      smtpEncryption: ['TLS', 'SSL', 'NONE'].includes(encryption) ? encryption : 'TLS',
      smtpActive: String(form.smtpActive || 'Yes').trim() === 'No' ? 'No' : 'Yes',
      smtpSecure: encryption === 'SSL',
      smtpTestTargetEmail: String(form.smtpTestTargetEmail || '').trim(),
      whatsappApiVersion: String(form.whatsappApiVersion || '').trim() || 'v23.0',
      whatsappPhoneNumber: normalizeIndianMobileNumber(form.whatsappPhoneNumber || ''),
      whatsappInstanceId: String(form.whatsappInstanceId || '').trim(),
      whatsappPhoneNumberId: String(form.whatsappInstanceId || '').trim(),
      whatsappAccessToken: String(form.whatsappAccessToken || '').trim(),
      whatsappContractExpiryToOwner: onOffOptions.includes(form.whatsappContractExpiryToOwner) ? form.whatsappContractExpiryToOwner : 'On',
      whatsappContractExpiryToCustomer: onOffOptions.includes(form.whatsappContractExpiryToCustomer) ? form.whatsappContractExpiryToCustomer : 'Off',
      whatsappLeadFollowupToOwner: onOffOptions.includes(form.whatsappLeadFollowupToOwner) ? form.whatsappLeadFollowupToOwner : 'On',
      whatsappLeadFollowupToCustomer: onOffOptions.includes(form.whatsappLeadFollowupToCustomer) ? form.whatsappLeadFollowupToCustomer : 'Off',
      whatsappLoginAlertToOwner: onOffOptions.includes(form.whatsappLoginAlertToOwner) ? form.whatsappLoginAlertToOwner : 'On',
      whatsappLoginAlertToCustomer: onOffOptions.includes(form.whatsappLoginAlertToCustomer) ? form.whatsappLoginAlertToCustomer : 'Off',
      whatsappBusinessDigestToOwner: onOffOptions.includes(form.whatsappBusinessDigestToOwner) ? form.whatsappBusinessDigestToOwner : 'Off',
      whatsappBusinessDigestToCustomer: onOffOptions.includes(form.whatsappBusinessDigestToCustomer) ? form.whatsappBusinessDigestToCustomer : 'Off',
      invoiceTemplate: normalizeInvoiceTemplate(form.invoiceTemplate),
      invoiceVisibleColumns: normalizeInvoiceVisibleColumns(form.invoiceVisibleColumns),
      invoiceFieldSettings: normalizeInvoiceFieldSettings(form.invoiceFieldSettings),
      profitCostDefaultWorkingDaysPerMonth: Math.max(1, Number(form.profitCostDefaultWorkingDaysPerMonth) || 26),
      profitCostDefaultWorkingHoursPerDay: Math.max(1, Number(form.profitCostDefaultWorkingHoursPerDay) || 8),
      profitCostDefaultManpowerCostPerVisit: Number(toMoneyString(form.profitCostDefaultManpowerCostPerVisit, '0')),
      profitCostDefaultConveyanceCostPerVisit: Number(toMoneyString(form.profitCostDefaultConveyanceCostPerVisit, '0')),
      profitCostLowMarginWarningPercent: Math.max(0, Number(form.profitCostLowMarginWarningPercent) || 20),
      profitCostExcludeGstFromRevenue: Boolean(form.profitCostExcludeGstFromRevenue)
    };

    try {
      setIsSaving(true);
      setStatus('Saving changes...');
      const res = await axios.post(`${API_BASE_URL}/api/settings/save`, payload);
      const quotationPrefixRes = await axios.get(`${API_BASE_URL}/api/settings/quotation-prefixes`).catch(() => ({ data: {} }));
      await axios.put(`${API_BASE_URL}/api/settings/quotation-prefixes`, {
        ...(quotationPrefixRes.data || {}),
        prefix: payload.quotationPrefix,
        financial_year: payload.quotationFinancialYear,
        enable_service_code: payload.quotationEnableServiceCode ? 1 : 0,
        next_number: payload.quotationNextNumber,
        padding_digits: payload.quotationNumberPadding,
        format_template: payload.quotationFormatTemplate
      });
      const savedRaw = res.data?.settings ? { ...res.data.settings, ...payload } : payload;
      const saved = {
        ...savedRaw,
        gstStateCode: normalizeGstStateCode(savedRaw.gstStateCode || deriveGstStateCodeFromGstin(savedRaw.companyGstNumber)),
        gstPanNumber: normalizePanDisplay(payload.gstPanNumber),
        gstPhone: normalizePhoneDisplay(payload.gstPhone),
        gstEmail: normalizeEmailDisplay(payload.gstEmail),
        companyGstNumber: normalizeGstinDisplay(payload.companyGstNumber),
        invoiceNextNumber: String(savedRaw.invoiceNextNumber ?? payload.invoiceNextNumber),
        invoiceNumberPadding: String(savedRaw.invoiceNumberPadding ?? payload.invoiceNumberPadding),
        quotationNextNumber: String(payload.quotationNextNumber),
        quotationNumberPadding: String(payload.quotationNumberPadding),
        jobNextNumber: String(savedRaw.jobNextNumber ?? payload.jobNextNumber),
        jobNumberPadding: String(savedRaw.jobNumberPadding ?? payload.jobNumberPadding),
        employeeCodeNextNumber: String(savedRaw.employeeCodeNextNumber ?? payload.employeeCodeNextNumber),
        employeeCodePadding: String(savedRaw.employeeCodePadding ?? payload.employeeCodePadding),
        smtpPort: String(savedRaw.smtpPort ?? payload.smtpPort),
        gstBankOpeningBalance: toMoneyString(savedRaw.gstBankOpeningBalance, '0'),
        gstBankCurrentBalance: toMoneyString(savedRaw.gstBankCurrentBalance, '0'),
        nonGstBankOpeningBalance: toMoneyString(savedRaw.nonGstBankOpeningBalance, '0'),
        nonGstBankCurrentBalance: toMoneyString(savedRaw.nonGstBankCurrentBalance, '0'),
        invoiceTemplate: normalizeInvoiceTemplate(savedRaw.invoiceTemplate),
        invoiceVisibleColumns: normalizeInvoiceVisibleColumns(savedRaw.invoiceVisibleColumns),
        invoiceFieldSettings: normalizeInvoiceFieldSettings(savedRaw.invoiceFieldSettings),
        profitCostDefaultWorkingDaysPerMonth: String(savedRaw.profitCostDefaultWorkingDaysPerMonth ?? payload.profitCostDefaultWorkingDaysPerMonth ?? 26),
        profitCostDefaultWorkingHoursPerDay: String(savedRaw.profitCostDefaultWorkingHoursPerDay ?? payload.profitCostDefaultWorkingHoursPerDay ?? 8),
        profitCostDefaultManpowerCostPerVisit: toMoneyString(savedRaw.profitCostDefaultManpowerCostPerVisit ?? payload.profitCostDefaultManpowerCostPerVisit ?? 0, '0'),
        profitCostDefaultConveyanceCostPerVisit: toMoneyString(savedRaw.profitCostDefaultConveyanceCostPerVisit ?? payload.profitCostDefaultConveyanceCostPerVisit ?? 0, '0'),
        profitCostLowMarginWarningPercent: String(savedRaw.profitCostLowMarginWarningPercent ?? payload.profitCostLowMarginWarningPercent ?? 20),
        profitCostExcludeGstFromRevenue: savedRaw.profitCostExcludeGstFromRevenue !== false,
        dashboardImageUrl: String(savedRaw.dashboardImageUrl ?? payload.dashboardImageUrl ?? '').trim(),
        gstCompanyLogoUrl: String(savedRaw.gstCompanyLogoUrl ?? payload.gstCompanyLogoUrl ?? '').trim()
      };
      setForm(saved);
      setInitialForm(saved);
      setSecurityForm(defaultSecurityForm);
      localStorage.setItem('invoice_visible_columns', JSON.stringify(saved.invoiceVisibleColumns));
      localStorage.setItem('invoice_sync_tick', String(Date.now()));
      localStorage.setItem('branding_sync_tick', String(Date.now()));
      applyBrandingTheme(saved);
      saveBrandingSettings(saved);
      setStatus('Settings Saved');
    } catch (error) {
      console.error('Save settings failed', error);
      setStatus('Save failed. Please verify backend server and retry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmailSender = () => {
    setStatus('Save settings, then click test from invoice email flow.');
  };

  const renderBrandingUploader = ({ title, fieldKey, inputRef, hint, emptyLabel = 'Image', clean = false }) => (
    <div style={shell.field}>
      <p style={shell.fieldLabel}>{title}</p>
      <div
        style={
          clean
            ? { display: 'grid', gap: '10px' }
            : shell.profileCard
        }
      >
        <div style={shell.profileRow}>
          <div style={shell.profilePreview}>
            {form[fieldKey] ? (
              <img src={form[fieldKey]} alt={title} style={shell.profileImg} />
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" style={shell.tinyButton} onClick={() => inputRef.current?.click()}>
              Upload
            </button>
            <button
              type="button"
              style={{ ...shell.tinyButton, ...shell.tinyButtonGhost }}
              onClick={() => updateField(fieldKey, '')}
            >
              Clear
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleBrandingUpload(event, fieldKey, title)}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <p style={shell.hint}>{hint}</p>
        {form[fieldKey] ? (
          <p style={{ ...shell.hint, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            Saved path: {form[fieldKey]}
          </p>
        ) : null}
      </div>
    </div>
  );

  const renderBusinessIdentity = () => (
    <>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Profile Picture</p>
          <div style={shell.profileCard}>
            <div style={shell.profileRow}>
              <div style={shell.profilePreview}>
                {form.dashboardImageUrl ? (
                  <img src={form.dashboardImageUrl} alt="Profile" style={shell.profileImg} />
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" style={shell.tinyButton} onClick={() => logoInputRef.current?.click()}>
                  Upload
                </button>
                <button
                  type="button"
                  style={{ ...shell.tinyButton, ...shell.tinyButtonGhost }}
                  onClick={() => updateField('dashboardImageUrl', '')}
                >
                  Clear
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            <p style={shell.hint}>PNG/JPG, max 2MB</p>
            {form.dashboardImageUrl ? (
              <p style={{ ...shell.hint, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                Saved path: {form.dashboardImageUrl}
              </p>
            ) : null}
          </div>
        </div>

        <div style={shell.field}>
          <p style={shell.fieldLabel}>Website</p>
          <input
            style={shell.input}
            value={form.companyWebsite}
            onChange={(event) => updateField('companyWebsite', event.target.value)}
            placeholder="www.yourcompany.com"
          />
        </div>
      </div>

      <div style={shell.threeCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone</p>
          <input
            style={shell.input}
            autoComplete="off"
            name="companyMobile"
            value={form.companyMobile}
            onChange={(event) => {
              const value = normalizeIndianMobileNumber(event.target.value);
              setForm((prev) => ({ ...prev, companyMobile: value }));
            }}
            inputMode="numeric"
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Company Name</p>
          <input
            style={shell.input}
            value={form.companyName}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, companyName: value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Email</p>
          <input
            style={shell.input}
            type="email"
            autoComplete="off"
            name="companyEmail"
            value={form.companyEmail}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, companyEmail: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>About / Tagline</p>
        <input style={shell.input} value={form.aboutTagline} onChange={(event) => updateField('aboutTagline', event.target.value)} />
      </div>

      <div style={shell.divider} />
      <h4 style={brandingSectionTitleStyle}>Branding</h4>
      <p style={{ ...shell.hint, fontSize: '14px' }}>Appearance and accent settings moved here from Branding tab.</p>
      <div style={{ ...shell.profileCard, borderStyle: 'solid' }}>
        <p style={{ ...shell.fieldLabel, margin: 0 }}>Live Preview</p>
        <div
          style={{
            border: '1px solid #d1d5db',
            borderRadius: '14px',
            overflow: 'hidden',
            background: form.brandingAppearance === 'dark' ? '#0f172a' : '#ffffff'
          }}
        >
          <div
            style={{
              height: '28px',
              background: form.brandingAccentColor || '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            <span>Brand Header</span>
            <span style={{ opacity: 0.85 }}>{form.brandingAccentColor || '#EF4444'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', minHeight: '96px' }}>
            <div
              style={{
                background: form.brandingAppearance === 'dark' ? '#111827' : '#f8fafc',
                borderRight: '1px solid rgba(148,163,184,0.25)',
                padding: '10px',
                display: 'grid',
                gap: '7px'
              }}
            >
              <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.35)' }} />
              <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.4)' }} />
              <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.25)' }} />
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontWeight: 800, color: form.brandingAppearance === 'dark' ? '#e5e7eb' : '#111827' }}>Branding Preview</div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: form.brandingAppearance === 'dark' ? '#94a3b8' : '#64748b' }}>
                Pane: {form.brandingAppearance === 'dark' ? 'Dark' : 'Light'} • Accent: {form.brandingAccentColor || '#EF4444'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.fieldLabel, margin: 0 }}>Appearance</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          alignItems: 'stretch'
        }}
      >
        <button
          type="button"
          onClick={() => updateField('brandingAppearance', 'dark')}
          style={{
            border: form.brandingAppearance === 'dark' ? '2px solid #1f2937' : '1px solid #d1d5db',
            background: '#fff',
            borderRadius: '12px',
            width: '100%',
            minHeight: isCompactLayout ? '74px' : '96px',
            cursor: 'pointer',
            fontWeight: 800,
            color: '#475569',
            fontSize: isCompactLayout ? '12px' : '13px',
            whiteSpace: 'nowrap'
          }}
        >
          DARK PANE
        </button>
        <button
          type="button"
          onClick={() => updateField('brandingAppearance', 'light')}
          style={{
            border: form.brandingAppearance === 'light' ? '2px solid var(--color-primary)' : '1px solid #d1d5db',
            background: '#fff',
            borderRadius: '12px',
            width: '100%',
            minHeight: isCompactLayout ? '74px' : '96px',
            cursor: 'pointer',
            fontWeight: 800,
            color: '#475569',
            fontSize: isCompactLayout ? '12px' : '13px',
            whiteSpace: 'nowrap'
          }}
        >
          LIGHT PANE
        </button>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.fieldLabel, margin: 0 }}>Accent Color</p>
      <div
        style={{
          display: 'flex',
          gap: isCompactLayout ? '8px' : '12px',
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}
      >
        {brandingAccentOptions.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => updateField('brandingAccentColor', entry)}
            style={{
              width: isCompactLayout ? '40px' : '44px',
              minWidth: isCompactLayout ? '40px' : '44px',
              height: isCompactLayout ? '40px' : '44px',
              borderRadius: '12px',
              border: form.brandingAccentColor === entry ? '3px solid #1f2937' : '1px solid #d1d5db',
              background: entry,
              cursor: 'pointer'
            }}
            title={entry}
          />
        ))}
        <label
          htmlFor="branding-custom-accent"
          style={{
            minHeight: isCompactLayout ? '40px' : '44px',
            height: isCompactLayout ? '40px' : '44px',
            borderRadius: '12px',
            padding: isCompactLayout ? '0 12px' : '0 14px',
            border: brandingAccentOptions.includes(form.brandingAccentColor) ? '1px solid #d1d5db' : '2px solid #1f2937',
            background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 45%, #ec4899 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: isCompactLayout ? '12px' : '13px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            position: 'relative',
            minWidth: isCompactLayout ? '78px' : '98px',
            flex: '0 0 auto'
          }}
          title="Custom Accent Color"
        >
          Custom
          <input
            id="branding-custom-accent"
            ref={customAccentInputRef}
            type="color"
            value={form.brandingAccentColor || '#EF4444'}
            onChange={(event) => updateField('brandingAccentColor', event.target.value)}
            aria-label="Choose custom accent color"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              border: 'none',
              padding: 0,
              margin: 0
            }}
          />
        </label>
      </div>
    </>
  );

  const renderGstCompany = () => (
    <>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>GST Company Name</p>
          <input
            style={shell.input}
            autoComplete="off"
            name="gstCompanyName"
            value={form.gstCompanyName}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstCompanyName: value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>GSTIN</p>
          <input
            style={shell.input}
            autoComplete="off"
            name="companyGstNumber"
            value={form.companyGstNumber}
            onChange={(event) => handleGstinChange(event.target.value)}
          />
        </div>
      </div>

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>PAN</p>
          <input
            style={shell.input}
            autoComplete="off"
            name="gstPanNumber"
            value={form.gstPanNumber}
            onChange={(event) => updateField('gstPanNumber', event.target.value.toUpperCase())}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>License Number</p>
          <input style={shell.input} value={form.gstLicenseNumber} onChange={(event) => updateField('gstLicenseNumber', event.target.value)} />
        </div>
      </div>

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Registration No</p>
          <input style={shell.input} value={form.gstRegistrationNumber} onChange={(event) => updateField('gstRegistrationNumber', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Billing Address</p>
          <input
            style={shell.input}
            value={form.gstBillingAddress}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstBillingAddress: value, companyAddress: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.fourCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>City</p>
          <input
            style={shell.input}
            value={form.gstCity}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstCity: value, companyCity: value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>State</p>
          <select
            style={shell.input}
            value={form.gstState}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstState: value, companyState: value }));
            }}
          >
            <option value="">Select State</option>
            {stateOptions.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>GST State Code</p>
          <select
            style={shell.input}
            value={normalizeGstStateCode(form.gstStateCode)}
            onChange={(event) => updateField('gstStateCode', normalizeGstStateCode(event.target.value))}
          >
            <option value="">Select GST Code</option>
            {gstStateCodeEntries.map((entry) => {
              const optionValue = `${entry.code} - ${entry.label}`;
              return (
                <option key={optionValue} value={optionValue}>{optionValue}</option>
              );
            })}
          </select>
          <p style={shell.hint}>Auto-filled from GSTIN</p>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Pincode</p>
          <input
            style={shell.input}
            value={form.gstPincode}
            onChange={(event) => {
              const value = toSixDigitPincode(event.target.value);
              setForm((prev) => ({ ...prev, gstPincode: value, companyPincode: value }));
            }}
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
          />
        </div>
      </div>

      <div style={shell.threeCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone</p>
          <input
            style={shell.input}
            autoComplete="off"
            name="gstPhone"
            value={form.gstPhone}
            onChange={(event) => {
              const value = normalizeIndianMobileNumber(event.target.value);
              setForm((prev) => ({ ...prev, gstPhone: value }));
            }}
            inputMode="numeric"
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Alternate Phone</p>
          <input style={shell.input} inputMode="numeric" value={form.gstAlternatePhone} onChange={(event) => updateField('gstAlternatePhone', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Email</p>
          <input
            style={shell.input}
            type="email"
            autoComplete="off"
            name="gstEmail"
            value={form.gstEmail}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstEmail: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.divider} />
      <h4 style={brandingSectionTitleStyle}>
        GST Company Branding
      </h4>
      <p style={{ ...shell.hint, fontSize: '14px' }}>Upload logo, signature, and stamp used on GST invoices and documents.</p>

      <div style={shell.threeCol}>
        {renderBrandingUploader({
          title: 'GST Company Logo',
          fieldKey: 'gstCompanyLogoUrl',
          inputRef: gstLogoInputRef,
          hint: 'PNG/JPG, max 2MB',
          emptyLabel: 'Logo'
        })}
        {renderBrandingUploader({
          title: 'Digital Signature',
          fieldKey: 'gstDigitalSignatureUrl',
          inputRef: gstSignatureInputRef,
          hint: 'PNG/JPG, transparent preferred',
          emptyLabel: 'Sign'
        })}
      </div>
    </>
  );

  const renderNonGstCompany = () => (
    <>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Non-GST Company Name</p>
          <input style={shell.input} value={form.nonGstCompanyName} onChange={(event) => updateField('nonGstCompanyName', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Billing Address</p>
          <input
            style={shell.input}
            value={form.nonGstBillingAddress}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, nonGstBillingAddress: value, nonGstAddress: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.fourCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>City</p>
          <input style={shell.input} value={form.nonGstCity} onChange={(event) => updateField('nonGstCity', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>State</p>
          <select style={shell.input} value={form.nonGstState} onChange={(event) => updateField('nonGstState', event.target.value)}>
            <option value="">Select State</option>
            {stateOptions.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Pincode</p>
          <input style={shell.input} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={form.nonGstPincode} onChange={(event) => updateField('nonGstPincode', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone</p>
          <input style={shell.input} inputMode="numeric" value={form.nonGstPhone} onChange={(event) => updateField('nonGstPhone', event.target.value)} />
        </div>
      </div>

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Alternate Phone</p>
          <input style={shell.input} inputMode="numeric" value={form.nonGstAlternatePhone} onChange={(event) => updateField('nonGstAlternatePhone', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Email</p>
          <input style={shell.input} type="email" value={form.nonGstEmail} onChange={(event) => updateField('nonGstEmail', event.target.value)} />
        </div>
      </div>

      <div style={shell.divider} />
      <h4 style={brandingSectionTitleStyle}>
        Non-GST Company Branding
      </h4>
      <p style={{ ...shell.hint, fontSize: '14px' }}>Upload logo used on Non-GST invoices and documents.</p>

      <div style={shell.twoCol}>
        {renderBrandingUploader({
          title: 'Non-GST Company Logo',
          fieldKey: 'nonGstCompanyLogoUrl',
          inputRef: nonGstLogoInputRef,
          hint: 'PNG/JPG, max 2MB',
          emptyLabel: 'Logo'
        })}
        {renderBrandingUploader({
          title: 'Digital Signature',
          fieldKey: 'nonGstDigitalSignatureUrl',
          inputRef: nonGstSignatureInputRef,
          hint: 'PNG/JPG, transparent preferred',
          emptyLabel: 'Sign'
        })}
      </div>
    </>
  );

  const renderBranding = () => (
    <>
      <h3 style={shell.sectionHeading}>Branding</h3>
      <p style={shell.infoBanner}>Branding form fields have been shifted to the Profile tab.</p>
    </>
  );

  const renderDocumentPrefixes = () => (
    <>
      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>Invoice Numbering</p>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Invoice Number Mode</p>
          <select style={shell.input} value={form.invoiceNumberMode} onChange={(event) => updateField('invoiceNumberMode', event.target.value)}>
            <option value="auto">Auto Generate</option>
            <option value="manual">Manual Entry</option>
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Invoice Prefix</p>
          <input style={shell.input} value={form.invoicePrefix} onChange={(event) => updateField('invoicePrefix', event.target.value)} />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Next Number</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.invoiceNextNumber}
            onChange={(event) => updateField('invoiceNextNumber', event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Number Padding</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.invoiceNumberPadding}
            onChange={(event) => updateField('invoiceNumberPadding', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>Quotation Numbering</p>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Quotation Prefix</p>
          <input style={shell.input} value={form.quotationPrefix} onChange={(event) => updateField('quotationPrefix', event.target.value)} placeholder="SPC/" />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Financial Year</p>
          <input style={shell.input} value={form.quotationFinancialYear} onChange={(event) => updateField('quotationFinancialYear', event.target.value)} />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Next Quotation Number</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.quotationNextNumber}
            onChange={(event) => updateField('quotationNextNumber', event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Quotation Number Padding</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.quotationNumberPadding}
            onChange={(event) => updateField('quotationNumberPadding', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Format Template</p>
          <input style={shell.input} value={form.quotationFormatTemplate} onChange={(event) => updateField('quotationFormatTemplate', event.target.value)} />
          <p style={shell.hint}>{'Use {{prefix}}, {{year}}, {{service_code}}, {{number}}'}</p>
        </div>
        <label style={{ ...shell.checkItem, alignSelf: 'end', minHeight: '42px' }}>
          <input
            type="checkbox"
            checked={Boolean(form.quotationEnableServiceCode)}
            onChange={(event) => updateField('quotationEnableServiceCode', event.target.checked)}
          />
          Enable Service Short Code
        </label>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>Renewal Numbering</p>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Renewal Prefix</p>
          <input style={shell.input} value={form.renewalPrefix} onChange={(event) => updateField('renewalPrefix', event.target.value)} placeholder="SPC/REN/" />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Next Renewal Number</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.renewalNextNumber}
            onChange={(event) => updateField('renewalNextNumber', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Renewal Number Padding</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.renewalNumberPadding}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '');
              setForm((prev) => ({ ...prev, renewalNumberPadding: value, renewalPadding: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>Job Numbering</p>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Job Prefix</p>
          <input style={shell.input} value={form.jobPrefix} onChange={(event) => updateField('jobPrefix', event.target.value)} placeholder="JOB-" />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Next Job Number</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.jobNextNumber}
            onChange={(event) => updateField('jobNextNumber', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Job Number Padding</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.jobNumberPadding}
            onChange={(event) => updateField('jobNumberPadding', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>Profit & Cost Defaults</p>
      <p style={shell.hint}>Used by job costing and customer profit summaries. GST is excluded by default.</p>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Working Days / Month</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.profitCostDefaultWorkingDaysPerMonth}
            onChange={(event) => updateField('profitCostDefaultWorkingDaysPerMonth', event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Working Hours / Day</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.profitCostDefaultWorkingHoursPerDay}
            onChange={(event) => updateField('profitCostDefaultWorkingHoursPerDay', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Default Manpower Cost / Visit</p>
          <input
            style={shell.input}
            inputMode="decimal"
            value={form.profitCostDefaultManpowerCostPerVisit}
            onChange={(event) => updateField('profitCostDefaultManpowerCostPerVisit', event.target.value)}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Default Conveyance Cost / Visit</p>
          <input
            style={shell.input}
            inputMode="decimal"
            value={form.profitCostDefaultConveyanceCostPerVisit}
            onChange={(event) => updateField('profitCostDefaultConveyanceCostPerVisit', event.target.value)}
          />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Low Margin Warning %</p>
          <input
            style={shell.input}
            inputMode="decimal"
            value={form.profitCostLowMarginWarningPercent}
            onChange={(event) => updateField('profitCostLowMarginWarningPercent', event.target.value)}
          />
        </div>
        <label style={{ ...shell.checkItem, alignSelf: 'end', minHeight: '42px' }}>
          <input
            type="checkbox"
            checked={Boolean(form.profitCostExcludeGstFromRevenue)}
            onChange={(event) => updateField('profitCostExcludeGstFromRevenue', event.target.checked)}
          />
          Exclude GST from revenue
        </label>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>Employee Numbering</p>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Employee Code Prefix</p>
          <input style={shell.input} value={form.employeeCodePrefix} onChange={(event) => updateField('employeeCodePrefix', event.target.value)} placeholder="EMP-" />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Next Employee Number</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.employeeCodeNextNumber}
            onChange={(event) => updateField('employeeCodeNextNumber', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Employee Number Padding</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.employeeCodePadding}
            onChange={(event) => updateField('employeeCodePadding', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
    </>
  );

  const renderWhatsappApi = () => (
    <>
      <div style={shell.infoBanner}>
        Owner/business alerts use superadmin default WhatsApp credentials. Customer alerts use this company WhatsApp API.
      </div>

      <div style={shell.threeCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone Number</p>
          <input style={shell.input} inputMode="numeric" value={form.whatsappPhoneNumber} onChange={(event) => updateField('whatsappPhoneNumber', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Instance ID</p>
          <input style={shell.input} value={form.whatsappInstanceId} onChange={(event) => updateField('whatsappInstanceId', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Access Token</p>
          <input type="password" style={shell.input} value={form.whatsappAccessToken} onChange={(event) => updateField('whatsappAccessToken', event.target.value)} />
        </div>
      </div>

      <p style={{ ...shell.sectionHeading, marginTop: '2px' }}>WhatsApp Alert Routing & Toggles</p>

      <div style={shell.fourCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Contract Expiry To Owner</p>
          <select style={shell.input} value={form.whatsappContractExpiryToOwner} onChange={(event) => updateField('whatsappContractExpiryToOwner', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Contract Expiry To Customer</p>
          <select style={shell.input} value={form.whatsappContractExpiryToCustomer} onChange={(event) => updateField('whatsappContractExpiryToCustomer', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Lead Follow-up To Owner</p>
          <select style={shell.input} value={form.whatsappLeadFollowupToOwner} onChange={(event) => updateField('whatsappLeadFollowupToOwner', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Lead Follow-up To Customer</p>
          <select style={shell.input} value={form.whatsappLeadFollowupToCustomer} onChange={(event) => updateField('whatsappLeadFollowupToCustomer', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
      </div>

      <div style={shell.fourCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Login Alert To Owner</p>
          <select style={shell.input} value={form.whatsappLoginAlertToOwner} onChange={(event) => updateField('whatsappLoginAlertToOwner', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Login Alert To Customer</p>
          <select style={shell.input} value={form.whatsappLoginAlertToCustomer} onChange={(event) => updateField('whatsappLoginAlertToCustomer', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Business Digest To Owner</p>
          <select style={shell.input} value={form.whatsappBusinessDigestToOwner} onChange={(event) => updateField('whatsappBusinessDigestToOwner', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Business Digest To Customer</p>
          <select style={shell.input} value={form.whatsappBusinessDigestToCustomer} onChange={(event) => updateField('whatsappBusinessDigestToCustomer', event.target.value)}>
            {onOffOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
      </div>
    </>
  );

  const renderEmailSender = () => (
    <>
      <div style={shell.infoBanner}>
        Configure Gmail sender account used for sending invoice and quotation emails with PDF attachments.
      </div>

      <div style={shell.threeCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Sender Name</p>
          <input style={shell.input} value={form.smtpSenderName} onChange={(event) => updateField('smtpSenderName', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Sender Email</p>
          <input style={shell.input} value={form.smtpFromEmail} onChange={(event) => updateField('smtpFromEmail', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>SMTP Username</p>
          <input style={shell.input} value={form.smtpUser} onChange={(event) => updateField('smtpUser', event.target.value)} />
        </div>
      </div>

      <div style={shell.fourCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>SMTP App Password</p>
          <input type="password" style={shell.input} value={form.smtpPass} onChange={(event) => updateField('smtpPass', event.target.value)} placeholder="Leave blank to keep existing password" />
          <p style={shell.hint}>Leave blank to keep existing password.</p>
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>SMTP Host</p>
          <input style={shell.input} value={form.smtpHost} onChange={(event) => updateField('smtpHost', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>SMTP Port</p>
          <input
            style={shell.input}
            inputMode="numeric"
            value={form.smtpPort}
            onChange={(event) => updateField('smtpPort', event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Encryption</p>
          <select style={shell.input} value={form.smtpEncryption} onChange={(event) => updateField('smtpEncryption', event.target.value)}>
            {smtpEncryptionOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
      </div>

      <div style={shell.threeCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Active</p>
          <select style={shell.input} value={form.smtpActive} onChange={(event) => updateField('smtpActive', event.target.value)}>
            {smtpActiveOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>
      </div>

      <div style={shell.divider} />

      <div style={shell.field}>
        <p style={shell.fieldLabel}>Test Target Email (Optional)</p>
        <div style={shell.inlineActionRow}>
          <input
            style={shell.input}
            value={form.smtpTestTargetEmail}
            onChange={(event) => updateField('smtpTestTargetEmail', event.target.value)}
            placeholder="Leave blank to send to Sender Email"
          />
          <button type="button" style={shell.testButton} onClick={handleTestEmailSender}>Test Email Sender</button>
          <span style={shell.hint}>Save settings, then click test.</span>
        </div>
      </div>

      <p style={{ ...shell.hint, fontSize: '13px' }}>
        For Gmail/Google Workspace, enable 2-step verification and create an App Password.
      </p>
    </>
  );

  const renderTermsConditions = () => (
    <>
      <div style={shell.field}>
        <p style={shell.fieldLabel}>GST Terms & Conditions</p>
        <textarea
          style={{ ...shell.textArea, minHeight: '165px' }}
          value={form.gstTermsAndConditions}
          onChange={(event) => updateField('gstTermsAndConditions', event.target.value)}
        />
      </div>
      <div style={shell.field}>
        <p style={shell.fieldLabel}>Non-GST Terms & Conditions</p>
        <textarea
          style={{ ...shell.textArea, minHeight: '165px' }}
          value={form.nonGstTermsAndConditions}
          onChange={(event) => updateField('nonGstTermsAndConditions', event.target.value)}
        />
      </div>
      <div style={shell.field}>
        <p style={shell.fieldLabel}>Renewal Letter Terms & Conditions</p>
        <textarea
          style={{ ...shell.textArea, minHeight: '165px' }}
          value={form.renewalLetterTermsAndConditions}
          onChange={(event) => updateField('renewalLetterTermsAndConditions', event.target.value)}
        />
      </div>
    </>
  );

  const renderInvoiceSettings = () => (
    <>
      <div style={shell.field}>
        <p style={shell.fieldLabel}>Invoice Template</p>
        <select style={shell.input} value={form.invoiceTemplate} onChange={(event) => updateField('invoiceTemplate', event.target.value)}>
          {invoiceTemplateOptions.map((template) => (
            <option key={template.value} value={template.value}>{template.label}</option>
          ))}
        </select>
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>Invoice Register Columns</p>
        <div style={shell.checkboxGrid}>
          {invoiceColumns.map((column) => (
            <label key={column.key} style={shell.checkItem}>
              <input
                type="checkbox"
                checked={form.invoiceVisibleColumns.includes(column.key)}
                onChange={() => toggleInvoiceColumn(column.key)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>Invoice PDF Fields</p>
        <div style={shell.checkboxGrid}>
          {invoiceFieldOptions.map((field) => (
            <label key={field.key} style={shell.checkItem}>
              <input
                type="checkbox"
                checked={Boolean(form.invoiceFieldSettings[field.key])}
                onChange={() => toggleInvoiceField(field.key)}
              />
              {field.label}
            </label>
          ))}
        </div>
      </div>
    </>
  );

  const renderDataHealth = () => {
    const attendance = attendanceSourceHealth?.health?.attendance || {};
    const audit = attendanceSourceHealth?.health?.audit || {};
    const summary = attendanceSourceHealth?.summary || {};
    const totalLegacyRows = Number(summary.legacyRows || 0);
    const totalRows = Number(summary.totalRows || 0);
    const canCopyHealth = Boolean(attendanceSourceHealth);
    const copyHealthJson = async () => {
      if (!attendanceSourceHealth) return;
      try {
        const payload = {
          generatedAt: new Date().toISOString(),
          ...attendanceSourceHealth
        };
        const json = `${JSON.stringify(payload, null, 2)}\n`;
        await navigator.clipboard.writeText(json);
        setStatus('Attendance source health copied to clipboard.');
      } catch (error) {
        console.error('Attendance source health copy failed', error);
        setStatus('Unable to copy attendance source health right now.');
      }
    };
    const copyLegacySummary = async () => {
      if (!attendanceSourceHealth) return;
      try {
        const summaryText = `Legacy rows remaining: ${totalLegacyRows} (attendance: ${Number(attendance.legacyRows || 0)}, audit: ${Number(audit.legacyRows || 0)}) out of ${totalRows} total rows`;
        await navigator.clipboard.writeText(summaryText);
        setStatus('Legacy rows summary copied to clipboard.');
      } catch (error) {
        console.error('Legacy rows summary copy failed', error);
        setStatus('Unable to copy legacy rows summary right now.');
      }
    };

    return (
      <div style={shell.bankCard}>
        <div style={{ ...shell.bankHeaderRow, alignItems: 'flex-start' }}>
          <div>
            <p style={sectionLeadTitleStyle}>Attendance Source Health</p>
            <p style={sectionLeadSubTitleStyle}>Quick check for legacy attendance and audit source labels.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ ...shell.topButton, minWidth: '150px' }}
              onClick={copyHealthJson}
              disabled={!canCopyHealth}
            >
              Copy JSON
            </button>
            <button
              type="button"
              style={{ ...shell.topButton, minWidth: '180px' }}
              onClick={copyLegacySummary}
              disabled={!canCopyHealth}
            >
              Copy Summary
            </button>
            <button
              type="button"
              style={{ ...shell.topButton, ...shell.topButtonPrimary, minWidth: '150px' }}
              onClick={loadAttendanceSourceHealth}
              disabled={attendanceSourceHealthLoading}
            >
              {attendanceSourceHealthLoading ? 'Checking...' : 'Refresh Counts'}
            </button>
          </div>
        </div>

        <div style={shell.twoCol}>
          <div style={shell.bankCard}>
            <h4 style={shell.bankCardTitle}>Attendance Table</h4>
            <p style={shell.hint}>Total rows: {Number(attendance.totalRows || 0)}</p>
            <p style={shell.hint}>Legacy rows: {Number(attendance.legacyRows || 0)}</p>
            <p style={shell.hint}>Admin rows: {Number(attendance.adminRows || 0)}</p>
            <p style={shell.hint}>Self rows: {Number(attendance.selfRows || 0)}</p>
          </div>
          <div style={shell.bankCard}>
            <h4 style={shell.bankCardTitle}>Audit Log Table</h4>
            <p style={shell.hint}>Total rows: {Number(audit.totalRows || 0)}</p>
            <p style={shell.hint}>Legacy rows: {Number(audit.legacyRows || 0)}</p>
            <p style={shell.hint}>Admin rows: {Number(audit.adminRows || 0)}</p>
            <p style={shell.hint}>Self rows: {Number(audit.selfRows || 0)}</p>
          </div>
        </div>

        <div style={shell.bankCard}>
          <h4 style={shell.bankCardTitle}>Combined Summary</h4>
          <p style={shell.hint}>Total rows checked: {totalRows}</p>
          <p style={shell.hint}>Legacy rows remaining: {totalLegacyRows}</p>
          <p style={shell.hint}>Status: {attendanceSourceHealth ? (totalLegacyRows === 0 ? 'Clean' : 'Needs cleanup') : 'Not loaded yet'}</p>
          {attendanceSourceHealthError ? (
            <p style={{ ...shell.hint, color: '#dc2626' }}>{attendanceSourceHealthError}</p>
          ) : null}
        </div>
      </div>
    );
  };

  const renderBankAccounts = () => {
    const rows = [
      {
        key: 'gst',
        type: 'GST',
        primary: Boolean(form.gstBankPrimary),
        bankName: form.gstBankName,
        accountNumber: form.gstBankAccountNumber,
        ifsc: form.gstBankIfsc,
        upiId: form.gstBankUpiId,
        opening: toMoneyString(form.gstBankOpeningBalance, '0'),
        current: toMoneyString(form.gstBankCurrentBalance, '0'),
        qr: form.gstBankQrUrl
      },
      {
        key: 'non-gst',
        type: 'Non-GST',
        primary: Boolean(form.nonGstBankPrimary),
        bankName: form.nonGstBankName,
        accountNumber: form.nonGstBankAccountNumber,
        ifsc: form.nonGstBankIfsc,
        upiId: form.nonGstBankUpiId,
        opening: toMoneyString(form.nonGstBankOpeningBalance, '0'),
        current: toMoneyString(form.nonGstBankCurrentBalance, '0'),
        qr: form.nonGstBankQrUrl
      }
    ];

    return (
      <>
        <div style={shell.bankHeaderRow}>
          <div>
            <p style={sectionLeadTitleStyle}>Bank Configuration</p>
            <p style={sectionLeadSubTitleStyle}>GST & Non-GST Company Bank Details</p>
          </div>
          <div style={shell.bankActions}>
            <button type="button" style={shell.topButton} onClick={resetBankSection}>Reset</button>
            <button type="button" style={{ ...shell.topButton, ...shell.topButtonPrimary }} onClick={saveAll} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Bank Accounts'}
            </button>
          </div>
        </div>

        <div style={shell.twoCol}>
          <div style={shell.bankCard}>
            <h4 style={shell.bankCardTitle}>GST Company Bank Details</h4>
            <div style={shell.field}>
              <p style={shell.fieldLabel}>Bank Name *</p>
              <input style={shell.input} value={form.gstBankName} onChange={(event) => updateField('gstBankName', event.target.value)} placeholder="e.g., HDFC Bank" />
            </div>
            <div style={shell.field}>
              <p style={shell.fieldLabel}>Account Number *</p>
              <input style={shell.input} value={form.gstBankAccountNumber} onChange={(event) => updateField('gstBankAccountNumber', event.target.value)} placeholder="Enter account number" />
            </div>
            <div style={shell.twoCol}>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>IFSC Code *</p>
                <input style={shell.input} value={form.gstBankIfsc} onChange={(event) => updateField('gstBankIfsc', event.target.value.toUpperCase())} placeholder="e.g., HDFC0001234" />
              </div>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>Branch</p>
                <input style={shell.input} value={form.gstBankBranch} onChange={(event) => updateField('gstBankBranch', event.target.value)} placeholder="Branch name" />
              </div>
            </div>
            <div style={shell.field}>
              <p style={shell.fieldLabel}>UPI ID</p>
              <input style={shell.input} value={form.gstBankUpiId} onChange={(event) => updateField('gstBankUpiId', event.target.value)} placeholder="e.g., payments@hdfc" />
            </div>
            <div style={shell.twoCol}>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>Opening Balance</p>
                <input type="number" step="0.01" style={shell.input} value={form.gstBankOpeningBalance} onChange={(event) => updateField('gstBankOpeningBalance', event.target.value)} />
              </div>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>Current Balance</p>
                <input type="number" step="0.01" style={shell.input} value={form.gstBankCurrentBalance} onChange={(event) => updateField('gstBankCurrentBalance', event.target.value)} />
              </div>
            </div>
            <div style={shell.profileRow}>
              <label style={{ ...shell.checkItem, marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.gstBankPrimary)}
                  onChange={(event) => setForm((prev) => ({ ...prev, gstBankPrimary: event.target.checked, nonGstBankPrimary: event.target.checked ? false : prev.nonGstBankPrimary }))}
                />
                Set as primary for GST invoices
              </label>
            </div>
          </div>

          <div style={shell.bankCard}>
            <h4 style={shell.bankCardTitle}>Non-GST Company Bank Details</h4>
            <div style={shell.field}>
              <p style={shell.fieldLabel}>Bank Name *</p>
              <input style={shell.input} value={form.nonGstBankName} onChange={(event) => updateField('nonGstBankName', event.target.value)} placeholder="e.g., ICICI Bank" />
            </div>
            <div style={shell.field}>
              <p style={shell.fieldLabel}>Account Number *</p>
              <input style={shell.input} value={form.nonGstBankAccountNumber} onChange={(event) => updateField('nonGstBankAccountNumber', event.target.value)} placeholder="Enter account number" />
            </div>
            <div style={shell.twoCol}>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>IFSC Code *</p>
                <input style={shell.input} value={form.nonGstBankIfsc} onChange={(event) => updateField('nonGstBankIfsc', event.target.value.toUpperCase())} placeholder="e.g., ICIC0005678" />
              </div>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>Branch</p>
                <input style={shell.input} value={form.nonGstBankBranch} onChange={(event) => updateField('nonGstBankBranch', event.target.value)} placeholder="Branch name" />
              </div>
            </div>
            <div style={shell.field}>
              <p style={shell.fieldLabel}>UPI ID</p>
              <input style={shell.input} value={form.nonGstBankUpiId} onChange={(event) => updateField('nonGstBankUpiId', event.target.value)} placeholder="e.g., collections@icici" />
            </div>
            <div style={shell.twoCol}>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>Opening Balance</p>
                <input type="number" step="0.01" style={shell.input} value={form.nonGstBankOpeningBalance} onChange={(event) => updateField('nonGstBankOpeningBalance', event.target.value)} />
              </div>
              <div style={shell.field}>
                <p style={shell.fieldLabel}>Current Balance</p>
                <input type="number" step="0.01" style={shell.input} value={form.nonGstBankCurrentBalance} onChange={(event) => updateField('nonGstBankCurrentBalance', event.target.value)} />
              </div>
            </div>
            <div style={shell.profileRow}>
              <label style={{ ...shell.checkItem, marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.nonGstBankPrimary)}
                  onChange={(event) => setForm((prev) => ({ ...prev, nonGstBankPrimary: event.target.checked, gstBankPrimary: event.target.checked ? false : prev.gstBankPrimary }))}
                />
                Set as primary for Non-GST invoices
              </label>
            </div>
          </div>
        </div>

        <div style={shell.divider} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <p style={sectionLeadTitleStyle}>Saved Bank Accounts</p>
          <button type="button" style={{ minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }} onClick={resetColumns}>Reset Columns</button>
        </div>
        <div style={shell.bankTableWrap}>
          <table style={bankTableStyle}>
            <colgroup>{bankColumns.map((key) => <col key={key} style={{ width: `${getColumnWidth(key) || bankColumnWidths[key] || 80}px` }} />)}</colgroup>
            <thead>
              <tr>
                <th style={bankHeadStyle('primary', 'center')}>Primary</th>
                <th style={bankHeadStyle('type', 'center')}>Type</th>
                <th style={bankHeadStyle('bankName')}>Bank Name</th>
                <th style={bankHeadStyle('accountNumber')}>Account Number</th>
                <th style={bankHeadStyle('ifsc')}>IFSC</th>
                <th style={bankHeadStyle('upiId')}>UPI ID</th>
                <th style={bankHeadStyle('openingBalance', 'center')}>Opening Balance</th>
                <th style={bankHeadStyle('currentBalance', 'center')}>Current Balance</th>
                <th style={bankHeadStyle('actions', 'center')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td style={bankCellStyle('primary', 'center')}><input type="radio" checked={row.primary} readOnly /></td>
                  <td style={bankCellStyle('type', 'center')}>{row.type}</td>
                  <td style={bankCellStyle('bankName')}>{row.bankName || '-'}</td>
                  <td style={bankCellStyle('accountNumber')}>{row.accountNumber ? maskAccountNumber(row.accountNumber) : '-'}</td>
                  <td style={bankCellStyle('ifsc')}>{row.ifsc || '-'}</td>
                  <td style={bankCellStyle('upiId')}>{row.upiId || '-'}</td>
                  <td style={bankCellStyle('openingBalance', 'center')}>{Number(row.opening || 0).toFixed(2)}</td>
                  <td style={bankCellStyle('currentBalance', 'center')}>{Number(row.current || 0).toFixed(2)}</td>
                  <td style={bankCellStyle('actions', 'center')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button type="button" style={shell.smallActionBtn} onClick={() => setActiveSection('bankAccounts')}>View</button>
                      <button type="button" style={{ ...shell.smallActionBtn, color: '#7c3aed', borderColor: 'rgba(124,58,237,0.36)' }} onClick={() => setActiveSection('bankAccounts')}>Edit</button>
                      <button
                        type="button"
                        style={{ ...shell.smallActionBtn, color: '#dc2626', borderColor: 'rgba(220,38,38,0.36)' }}
                        onClick={() => {
                          if (row.key === 'gst') {
                            setForm((prev) => ({ ...prev, gstBankName: '', gstBankAccountNumber: '', gstBankIfsc: '', gstBankBranch: '', gstBankUpiId: '', gstBankOpeningBalance: '0', gstBankCurrentBalance: '0', gstBankQrUrl: '' }));
                          } else {
                            setForm((prev) => ({ ...prev, nonGstBankName: '', nonGstBankAccountNumber: '', nonGstBankIfsc: '', nonGstBankBranch: '', nonGstBankUpiId: '', nonGstBankOpeningBalance: '0', nonGstBankCurrentBalance: '0', nonGstBankQrUrl: '' }));
                          }
                          setStatus(`${row.type} bank details cleared. Save changes to apply.`);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderSecurity = () => (
    <>
      <div style={shell.field}>
        <p style={shell.fieldLabel}>Current Password</p>
        <input
          type="password"
          style={shell.input}
          value={securityForm.currentPassword}
          onChange={(event) => updateSecurityField('currentPassword', event.target.value)}
          placeholder="Current password"
        />
      </div>

      <div style={shell.field}>
        <div style={shell.strengthRow}>
          <p style={shell.fieldLabel}>New Password</p>
          <span style={{ ...shell.strengthBadge, borderColor: `${passwordStrength.tone}55`, color: passwordStrength.tone }}>
            {passwordStrength.label}
          </span>
        </div>
        <input
          type="password"
          style={shell.input}
          value={securityForm.newPassword}
          onChange={(event) => updateSecurityField('newPassword', event.target.value)}
          placeholder="New password"
        />
        <div style={shell.strengthTrack}>
          <div style={{ ...shell.strengthFill, width: passwordStrength.width, background: passwordStrength.tone }} />
        </div>
        <p style={{ ...shell.hint, fontSize: '14px' }}>{passwordStrength.hint}</p>
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>Confirm New Password</p>
        <input
          type="password"
          style={shell.input}
          value={securityForm.confirmPassword}
          onChange={(event) => updateSecurityField('confirmPassword', event.target.value)}
          placeholder="Re-enter new password"
        />
        <p
          style={{
            ...shell.hint,
            fontSize: '14px',
            color: !isFilled(securityForm.confirmPassword)
              ? '#64748b'
              : securityForm.newPassword === securityForm.confirmPassword
                ? '#16a34a'
                : '#ef4444'
          }}
        >
          {!isFilled(securityForm.confirmPassword)
            ? 'Passwords have not been entered.'
            : securityForm.newPassword === securityForm.confirmPassword
              ? 'Passwords match.'
              : 'Passwords do not match.'}
        </p>
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>Settings Access PIN</p>
        <input
          type="password"
          style={shell.input}
          value={form.settingsAccessPin}
          onChange={(event) => updateField('settingsAccessPin', event.target.value)}
          placeholder="Enter or update settings access PIN"
        />
        <p style={shell.hint}>Leave it unchanged to keep the existing PIN.</p>
      </div>
    </>
  );

  const renderSectionContent = () => {
    if (activeSection === 'businessIdentity') return renderBusinessIdentity();
    if (activeSection === 'gstCompany') return renderGstCompany();
    if (activeSection === 'nonGstCompany') return renderNonGstCompany();
    if (activeSection === 'bankAccounts') return renderBankAccounts();
    if (activeSection === 'documentPrefixes') return renderDocumentPrefixes();
    if (activeSection === 'whatsappApiSettings') return <WhatsAppSettings />;
    if (activeSection === 'whatsappTemplates') return <WhatsAppTemplates />;
    if (activeSection === 'whatsappLogs') return <WhatsAppLogs />;
    if (activeSection === 'emailApiSettings') return <EmailSettings />;
    if (activeSection === 'emailTemplates') return <EmailTemplates />;
    if (activeSection === 'emailLogs') return <EmailLogs />;
    if (activeSection === 'googleIntegration') return <GoogleIntegrationSettings />;
    if (activeSection === 'dataHealth') return renderDataHealth();
    if (activeSection === 'termsConditions') return renderTermsConditions();
    if (activeSection === 'invoiceSettings') return renderInvoiceSettings();
    return renderSecurity();
  };

  const panelStyle = isCompactLayout
    ? { ...shell.panel, minHeight: 'auto' }
    : shell.panel;
  const panelHeaderStyle = isCompactLayout
    ? { ...shell.panelHeader, padding: 0, gap: 0, background: 'var(--color-primary)' }
    : { ...shell.panelHeader, padding: 0, gap: 0, background: 'var(--color-primary)' };
  const panelTitleStyle = isCompactLayout
    ? { ...shell.panelTitle, fontSize: '22px', lineHeight: 1.2 }
    : shell.panelTitle;
  const panelStatusStyle = isCompactLayout
    ? { ...shell.panelStatus, fontSize: '13px' }
    : shell.panelStatus;
  const panelHeaderSideStyle = isCompactLayout
    ? { ...shell.panelHeaderSide, justifyItems: 'start', width: '100%' }
    : shell.panelHeaderSide;
  const panelHeaderButtonsStyle = isCompactLayout
    ? { ...shell.panelHeaderButtons, width: '100%', justifyContent: 'stretch', display: 'grid', gridTemplateColumns: '1fr 1fr' }
    : shell.panelHeaderButtons;
  const topButtonStyle = isCompactLayout
    ? { ...shell.topButton, width: '100%', padding: '0 10px' }
    : shell.topButton;
  const settingsContentShellStyle = isCompactLayout
    ? { ...shell.settingsContentShell, gridTemplateColumns: '1fr' }
    : shell.settingsContentShell;
  const tabsRowStyle = isCompactLayout
    ? {
      ...shell.tabsRow,
      display: 'grid',
      gap: '10px',
      padding: '10px',
      overflow: 'visible',
      borderRight: 'none',
      borderBottom: '1px solid var(--border)',
      background: '#fff'
    }
    : shell.tabsRow;
  const tabButtonStyle = isCompactLayout
    ? { ...shell.tabButton, width: '100%', minWidth: 0, whiteSpace: 'normal', padding: '10px 12px' }
    : shell.tabButton;
  const panelBodyStyle = isCompactLayout
    ? { ...shell.panelBody, padding: '12px', overflowX: 'hidden', overflowY: 'auto' }
    : { ...shell.panelBody, overflowY: 'auto' };
  const pageStyle = modalMode
    ? { ...shell.page, gap: '10px' }
    : shell.page;
  const blockTitleStyle = modalMode
    ? { margin: 0, fontSize: '20px', lineHeight: 1.2, color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.01em' }
    : { margin: 0, fontSize: '34px', lineHeight: 1.15, color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.02em' };
  const sectionLeadTitleStyle = modalMode
    ? { ...shell.hint, marginBottom: '4px', fontSize: '16px', fontWeight: 800, color: '#334155' }
    : { ...shell.hint, marginBottom: '4px', fontSize: '22px', fontWeight: 800, color: '#334155' };
  const sectionLeadSubTitleStyle = modalMode
    ? { ...shell.hint, fontSize: '13px', fontWeight: 700, color: '#475569' }
    : { ...shell.hint, fontSize: '18px', fontWeight: 700, color: '#475569' };
  const brandingSectionTitleStyle = { margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 };
  const {
    getColumnWidth,
    resetColumns,
    startResize
  } = useColumnResize({
    storageKey: 'skuas-table-widths-settings-bank',
    columns: bankColumns,
    defaultColumnWidths: bankColumnWidths,
    columnBounds: bankColumnBounds,
    minWidth: 80,
    enabled: true
  });
  const bankTableMinWidth = bankColumns.reduce((sum, key) => sum + (getColumnWidth(key) || bankColumnWidths[key] || 80), 0);
  const bankTableStyle = { ...shell.bankTable, minWidth: `${Math.max(980, bankTableMinWidth)}px`, tableLayout: 'fixed' };
  const bankHeadStyle = (key, align = 'left') => {
    const width = getColumnWidth(key) || bankColumnWidths[key] || 80;
    return { ...shell.bankTh, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const bankCellStyle = (key, align = 'left') => {
    const width = getColumnWidth(key) || bankColumnWidths[key] || 80;
    return { ...shell.bankTd, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };

  return (
    <section style={pageStyle}>
      <div style={shell.workspaceShell}>
        <div style={panelStyle}>
          <header style={panelHeaderStyle}>
            <div
              style={{
                width: '100%',
                minHeight: isCompactLayout ? '50px' : '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isCompactLayout ? '0 14px' : '0 18px',
                color: '#ffffff',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: isCompactLayout ? '11px' : '12px'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
                <span>Settings</span>
              </span>
            </div>
          </header>

          <div style={settingsContentShellStyle}>
            <div style={tabsRowStyle}>
              {isCompactLayout ? (
                <select
                  value={activeSection}
                  onChange={(event) => setActiveSection(event.target.value)}
                  style={{ ...shell.input, minHeight: '44px' }}
                >
                  {sectionGroups.map((group) => (
                    <optgroup key={group.key} label={group.label}>
                      {group.items.map((section) => (
                        <option key={section.key} value={section.key}>{section.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : null}
              {isCompactLayout ? null : sectionGroups.map((group) => {
                const isExpanded = expandedGroups[group.key];
                return (
                  <div key={group.key} style={shell.menuGroup}>
                    <button
                      type="button"
                      style={shell.groupToggle}
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                    >
                      <span>{group.label}</span>
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {isExpanded ? group.items.map((section) => {
                      const isActive = section.key === activeSection;
                      return (
                        <button
                          key={section.key}
                          type="button"
                          style={{ ...tabButtonStyle, ...shell.childButton, ...(isActive ? shell.tabButtonActive : {}) }}
                          onClick={() => setActiveSection(section.key)}
                        >
                          {section.label}
                        </button>
                      );
                    }) : null}
                  </div>
                );
              })}
            </div>

            <div ref={panelBodyRef} style={panelBodyStyle}>{renderSectionContent()}</div>
          </div>
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: isCompactLayout ? '12px' : '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              background: '#fff'
            }}
          >
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, ...statusTone }}>
              {status || ''}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                style={{ ...topButtonStyle, minHeight: '34px', borderRadius: '8px', padding: '0 12px', fontSize: '11px' }}
                onClick={discardChanges}
              >
                Discard
              </button>
              <button
                type="button"
                style={{ ...topButtonStyle, ...shell.topButtonPrimary, minHeight: '34px', minWidth: '122px', borderRadius: '8px', padding: '0 12px', fontSize: '11px' }}
                onClick={saveAll}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
