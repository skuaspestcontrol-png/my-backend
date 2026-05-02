import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
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

const defaultSecurityForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const onOffOptions = ['On', 'Off'];
const smtpEncryptionOptions = ['TLS', 'SSL', 'None'];
const smtpActiveOptions = ['Yes', 'No'];

const sectionMeta = [
  { key: 'businessIdentity', label: 'Profile' },
  { key: 'branding', label: 'Branding' },
  { key: 'gstCompany', label: 'GST Company' },
  { key: 'nonGstCompany', label: 'Non GST Company' },
  { key: 'bankAccounts', label: 'Bank Account' },
  { key: 'documentPrefixes', label: 'Prefixes' },
  { key: 'whatsappApiSettings', label: 'WhatsApp API Settings' },
  { key: 'whatsappTemplates', label: 'WhatsApp Templates' },
  { key: 'whatsappLogs', label: 'WhatsApp Logs' },
  { key: 'emailApiSettings', label: 'Email API Settings' },
  { key: 'emailTemplates', label: 'Email Templates' },
  { key: 'emailLogs', label: 'Email Logs' },
  { key: 'termsConditions', label: 'Terms & Conditions' },
  { key: 'invoiceSettings', label: 'Invoice Settings' },
  { key: 'security', label: 'Change Password' }
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
  customerNotesDefault: '',
  settingsAccessPin: '',
  invoiceNumberMode: 'auto',
  invoicePrefix: 'SPC-',
  invoiceNextNumber: '66',
  invoiceNumberPadding: '4',
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
  dashboardImageUrl: '',
  brandingAppearance: 'light',
  brandingAccentColor: '#9F174D'
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
    border: '1px solid transparent',
    borderRadius: '10px',
    background: 'transparent',
    color: '#4b5563',
    padding: '8px 10px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'left',
    justifyContent: 'flex-start',
    width: '100%'
  },
  tabButtonActive: {
    color: '#0f172a',
    borderColor: 'rgba(159, 23, 77, 0.26)',
    background: 'var(--color-primary-light)',
    boxShadow: 'inset 3px 0 0 var(--color-primary)'
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
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px 18px' },
  threeCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px 18px' },
  fourCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px 18px' },
  field: { display: 'grid', gap: '8px' },
  fieldLabel: { margin: 0, fontSize: '12px', color: '#4b5563', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: {
    width: '100%',
    minHeight: '49px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    background: '#fff',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--text)'
  },
  textArea: {
    width: '100%',
    minHeight: '72px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    background: '#fff',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--text)',
    resize: 'vertical'
  },
  profileCard: {
    borderRadius: '14px',
    border: '1px dashed rgba(17, 17, 17, 0.2)',
    background: 'rgba(255, 255, 255, 0.86)',
    padding: '16px',
    display: 'grid',
    gap: '12px'
  },
  profileRow: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
  profilePreview: {
    width: '98px',
    height: '98px',
    borderRadius: '14px',
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
    minHeight: '44px',
    borderRadius: '10px',
    border: '1px solid rgba(159, 23, 77, 0.36)',
    background: 'rgba(252, 231, 243, 0.26)',
    color: 'var(--color-primary-dark)',
    fontSize: '13px',
    fontWeight: 800,
    padding: '0 16px',
    cursor: 'pointer'
  },
  tinyButtonGhost: { border: '1px solid rgba(17, 17, 17, 0.2)', background: '#fff', color: 'var(--text)' },
  hint: { margin: 0, color: '#6b7280', fontSize: '12px', fontWeight: 700 },
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
    termsConditions: [form.gstTermsAndConditions, form.nonGstTermsAndConditions].every(isFilled),
    invoiceSettings: Boolean(form.invoiceTemplate && Array.isArray(form.invoiceVisibleColumns) && form.invoiceVisibleColumns.length > 0),
    security: securityReady
  };
};

export default function Settings({ modalMode = false }) {
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(sectionMeta[0].key);
  const logoInputRef = useRef(null);
  const gstLogoInputRef = useRef(null);
  const gstSignatureInputRef = useRef(null);
  const gstStampInputRef = useRef(null);
  const nonGstLogoInputRef = useRef(null);
  const gstBankQrInputRef = useRef(null);
  const nonGstBankQrInputRef = useRef(null);
  const customAccentInputRef = useRef(null);
  const [securityForm, setSecurityForm] = useState(defaultSecurityForm);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [isTouchDevice, setIsTouchDevice] = useState(() => (
    typeof window !== 'undefined'
      && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)
  ));
  const passwordStrength = useMemo(() => getPasswordStrength(securityForm.newPassword), [securityForm.newPassword]);
  const brandingAccentOptions = ['#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#9F174D'];
  const isMobile = viewportWidth <= 768;
  const isCompactLayout = isMobile || isTouchDevice || viewportWidth <= 1100;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
        const res = await axios.get(`${API_BASE_URL}/api/settings`);
        if (!active) return;
        const data = res.data || {};

        const gstCompanyName = String(data.gstCompanyName || data.companyName || '').trim();
        const gstBillingAddress = String(data.gstBillingAddress || data.companyAddress || '').trim();
        const gstCity = String(data.gstCity || data.companyCity || '').trim();
        const gstState = String(data.gstState || data.companyState || '').trim();
        const gstPincode = String(data.gstPincode || data.companyPincode || '').trim();
        const gstPhone = String(data.gstPhone || data.companyMobile || '').trim();
        const gstEmail = String(data.gstEmail || data.companyEmail || '').trim();
        const gstCompanyLogoUrl = String(data.gstCompanyLogoUrl || data.dashboardImageUrl || '').trim();
        const nonGstBillingAddress = String(data.nonGstBillingAddress || data.nonGstAddress || '').trim();
        const nonGstCity = String(data.nonGstCity || '').trim();
        const normalizedGstStateCode = normalizeGstStateCode(data.gstStateCode || deriveGstStateCodeFromGstin(data.companyGstNumber || ''));

        const next = {
          ...defaultForm,
          ...data,
          gstCompanyName,
          gstPanNumber: data.gstPanNumber || '',
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
          companyName: data.companyName || gstCompanyName,
          companyAddress: data.companyAddress || gstBillingAddress,
          companyCity: data.companyCity || gstCity,
          companyState: data.companyState || gstState,
          companyPincode: data.companyPincode || gstPincode,
          companyGstNumber: String(data.companyGstNumber || '').toUpperCase(),
          companyEmail: data.companyEmail || gstEmail,
          companyMobile: data.companyMobile || gstPhone,
          companyWebsite: data.companyWebsite || '',
          googleReviewLink: data.googleReviewLink || '',
          dashboardImageUrl: data.dashboardImageUrl || gstCompanyLogoUrl,
          brandingAppearance: String(data.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
          brandingAccentColor: String(data.brandingAccentColor || '#9F174D').trim() || '#9F174D',
          aboutTagline: data.aboutTagline || '',
          companyServices: data.companyServices || '',
          nonGstCompanyName: data.nonGstCompanyName || '',
          nonGstBillingAddress,
          nonGstCity,
          nonGstAddress: data.nonGstAddress || nonGstBillingAddress,
          nonGstState: data.nonGstState || '',
          nonGstPincode: data.nonGstPincode || '',
          nonGstPhone: data.nonGstPhone || '',
          nonGstAlternatePhone: data.nonGstAlternatePhone || '',
          nonGstEmail: data.nonGstEmail || '',
          nonGstCompanyLogoUrl: data.nonGstCompanyLogoUrl || '',
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
          customerNotesDefault: data.customerNotesDefault || '',
          termsAndConditionsDefault: data.termsAndConditionsDefault || data.gstTermsAndConditions || '',
          settingsAccessPin: data.settingsAccessPin || '',
          invoiceNumberMode: data.invoiceNumberMode === 'manual' ? 'manual' : 'auto',
          invoicePrefix: data.invoicePrefix || 'SPC-',
          invoiceNextNumber: String(data.invoiceNextNumber ?? 66),
          invoiceNumberPadding: String(data.invoiceNumberPadding ?? 4),
          jobPrefix: data.jobPrefix || 'JOB-',
          jobNextNumber: String(data.jobNextNumber ?? 1),
          jobNumberPadding: String(data.jobNumberPadding ?? 6),
          employeeCodePrefix: data.employeeCodePrefix || 'EMP-',
          employeeCodeNextNumber: String(data.employeeCodeNextNumber ?? 1001),
          employeeCodePadding: String(data.employeeCodePadding ?? 4),
          smtpSenderName: data.smtpSenderName || '',
          smtpFromEmail: data.smtpFromEmail || '',
          smtpUser: data.smtpUser || '',
          smtpPass: data.smtpPass || '',
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
          invoiceFieldSettings: normalizeInvoiceFieldSettings(data.invoiceFieldSettings)
        };

        setForm(next);
        setInitialForm(next);
        setSecurityForm(defaultSecurityForm);
        setStatus('All changes saved.');
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

  const completionMap = useMemo(() => getSectionCompletion(form, securityForm), [form, securityForm]);
  const completedCount = useMemo(() => Object.values(completionMap).filter(Boolean).length, [completionMap]);

  const validationSummary = completedCount === sectionMeta.length
    ? 'Validation summary: all required fields complete'
    : `Validation summary: ${completedCount}/${sectionMeta.length} sections complete`;

  const statusTone = useMemo(() => {
    const raw = String(status || '').toLowerCase();
    if (raw.includes('could not') || raw.includes('failed')) return { color: '#dc2626' };
    if (raw.includes('saved')) return { color: 'var(--sky-deep)' };
    return { color: 'var(--muted)' };
  }, [status]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateSecurityField = (key, value) => {
    setSecurityForm((prev) => ({ ...prev, [key]: value }));
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
    return String(res.data?.imageUrl || '').trim();
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Uploading profile picture...');
      const imageUrl = await uploadBrandingImage(file);
      setForm((prev) => ({ ...prev, dashboardImageUrl: imageUrl, gstCompanyLogoUrl: imageUrl }));
      setStatus('Profile picture uploaded. Save changes to confirm.');
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
        ...(targetKey === 'gstCompanyLogoUrl' ? { dashboardImageUrl: imageUrl } : {}),
        ...(targetKey === 'dashboardImageUrl' ? { gstCompanyLogoUrl: imageUrl, nonGstCompanyLogoUrl: imageUrl } : {})
      }));
      setStatus(`${label} uploaded. Save changes to confirm.`);
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
      setStatus(`${label} QR uploaded. Save changes to confirm.`);
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

    const gstCompanyName = String(form.gstCompanyName || form.companyName || '').trim();
    const gstBillingAddress = String(form.gstBillingAddress || form.companyAddress || '').trim();
    const gstCity = String(form.gstCity || form.companyCity || '').trim();
    const gstState = String(form.gstState || form.companyState || '').trim();
    const gstPincode = String(form.gstPincode || form.companyPincode || '').trim();
    const gstPhone = String(form.gstPhone || form.companyMobile || '').trim();
    const gstEmail = String(form.gstEmail || form.companyEmail || '').trim();
    const gstStateCode = normalizeGstStateCode(form.gstStateCode || deriveGstStateCodeFromGstin(form.companyGstNumber));
    const dashboardImageUrl = String(form.dashboardImageUrl || form.gstCompanyLogoUrl || '').trim();
    const gstCompanyLogoUrl = String(form.gstCompanyLogoUrl || dashboardImageUrl).trim();
    const nonGstBillingAddress = String(form.nonGstBillingAddress || form.nonGstAddress || '').trim();
    const nextAdminPassword = hasPasswordAttempt ? securityForm.newPassword : String(form.adminPassword || currentStoredPassword || 'admin123');
    const encryption = String(form.smtpEncryption || 'TLS').toUpperCase();

    const payload = {
      gstCompanyName,
      gstPanNumber: String(form.gstPanNumber || '').trim().toUpperCase(),
      gstLicenseNumber: String(form.gstLicenseNumber || '').trim(),
      gstRegistrationNumber: String(form.gstRegistrationNumber || '').trim(),
      gstBillingAddress,
      gstCity,
      gstState,
      gstStateCode,
      gstPincode,
      gstPhone,
      gstAlternatePhone: String(form.gstAlternatePhone || '').trim(),
      gstEmail,
      gstCompanyLogoUrl,
      gstDigitalSignatureUrl: String(form.gstDigitalSignatureUrl || '').trim(),
      gstCompanyStampUrl: String(form.gstCompanyStampUrl || '').trim(),
      companyName: gstCompanyName,
      companyAddress: gstBillingAddress,
      companyCity: gstCity,
      companyState: gstState,
      companyPincode: gstPincode,
      companyGstNumber: String(form.companyGstNumber || '').trim().toUpperCase(),
      companyEmail: gstEmail,
      companyMobile: gstPhone,
      companyWebsite: String(form.companyWebsite || '').trim(),
      googleReviewLink: String(form.googleReviewLink || '').trim(),
      dashboardImageUrl,
      brandingAppearance: form.brandingAppearance === 'dark' ? 'dark' : 'light',
      brandingAccentColor: String(form.brandingAccentColor || '#9F174D').trim() || '#9F174D',
      aboutTagline: String(form.aboutTagline || '').trim(),
      companyServices: String(form.companyServices || '').trim(),
      nonGstCompanyName: String(form.nonGstCompanyName || '').trim(),
      nonGstBillingAddress,
      nonGstCity: String(form.nonGstCity || '').trim(),
      nonGstAddress: nonGstBillingAddress,
      nonGstState: String(form.nonGstState || '').trim(),
      nonGstPincode: String(form.nonGstPincode || '').trim(),
      nonGstPhone: String(form.nonGstPhone || '').trim(),
      nonGstAlternatePhone: String(form.nonGstAlternatePhone || '').trim(),
      nonGstEmail: String(form.nonGstEmail || '').trim(),
      nonGstCompanyLogoUrl: String(form.nonGstCompanyLogoUrl || '').trim(),
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
      adminPassword: nextAdminPassword,
      gstTermsAndConditions: String(form.gstTermsAndConditions || '').trim(),
      nonGstTermsAndConditions: String(form.nonGstTermsAndConditions || '').trim(),
      customerNotesDefault: String(form.customerNotesDefault || '').trim(),
      termsAndConditionsDefault: String(form.gstTermsAndConditions || form.termsAndConditionsDefault || '').trim(),
      settingsAccessPin: String(form.settingsAccessPin || '').trim(),
      invoiceNumberMode: form.invoiceNumberMode === 'manual' ? 'manual' : 'auto',
      invoicePrefix: String(form.invoicePrefix || '').trim() || 'SPC-',
      invoiceNextNumber: Math.max(1, Number(form.invoiceNextNumber) || 1),
      invoiceNumberPadding: Math.max(1, Number(form.invoiceNumberPadding) || 4),
      jobPrefix: String(form.jobPrefix || '').trim() || 'JOB-',
      jobNextNumber: Math.max(1, Number(form.jobNextNumber) || 1),
      jobNumberPadding: Math.max(1, Number(form.jobNumberPadding) || 6),
      employeeCodePrefix: String(form.employeeCodePrefix || '').trim() || 'EMP-',
      employeeCodeNextNumber: Math.max(1, Number(form.employeeCodeNextNumber) || 1),
      employeeCodePadding: Math.max(1, Number(form.employeeCodePadding) || 4),
      smtpSenderName: String(form.smtpSenderName || '').trim(),
      smtpFromEmail: String(form.smtpFromEmail || '').trim(),
      smtpUser: String(form.smtpUser || '').trim(),
      smtpPass: String(form.smtpPass || '').trim(),
      smtpHost: String(form.smtpHost || '').trim(),
      smtpPort: Math.max(1, Number(form.smtpPort) || 587),
      smtpEncryption: ['TLS', 'SSL', 'NONE'].includes(encryption) ? encryption : 'TLS',
      smtpActive: String(form.smtpActive || 'Yes').trim() === 'No' ? 'No' : 'Yes',
      smtpSecure: encryption === 'SSL',
      smtpTestTargetEmail: String(form.smtpTestTargetEmail || '').trim(),
      whatsappApiVersion: String(form.whatsappApiVersion || '').trim() || 'v23.0',
      whatsappPhoneNumber: String(form.whatsappPhoneNumber || '').trim(),
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
      invoiceFieldSettings: normalizeInvoiceFieldSettings(form.invoiceFieldSettings)
    };

    try {
      setIsSaving(true);
      setStatus('Saving changes...');
      const res = await axios.post(`${API_BASE_URL}/api/settings/save`, payload);
      const savedRaw = res.data?.settings ? { ...payload, ...res.data.settings } : payload;
      const saved = {
        ...savedRaw,
        gstStateCode: normalizeGstStateCode(savedRaw.gstStateCode || deriveGstStateCodeFromGstin(savedRaw.companyGstNumber)),
        invoiceNextNumber: String(savedRaw.invoiceNextNumber ?? payload.invoiceNextNumber),
        invoiceNumberPadding: String(savedRaw.invoiceNumberPadding ?? payload.invoiceNumberPadding),
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
        invoiceFieldSettings: normalizeInvoiceFieldSettings(savedRaw.invoiceFieldSettings)
      };
      setForm(saved);
      setInitialForm(saved);
      setSecurityForm(defaultSecurityForm);
      localStorage.setItem('invoice_visible_columns', JSON.stringify(saved.invoiceVisibleColumns));
      localStorage.setItem('invoice_sync_tick', String(Date.now()));
      localStorage.setItem('branding_sync_tick', String(Date.now()));
      applyBrandingTheme(saved);
      saveBrandingSettings(saved);
      setStatus('All changes saved.');
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

  const renderBrandingUploader = ({ title, fieldKey, inputRef, hint, emptyLabel = 'Image' }) => (
    <div style={shell.field}>
      <p style={shell.fieldLabel}>{title}</p>
      <div style={shell.profileCard}>
        <div style={shell.profileRow}>
          <div style={shell.profilePreview}>
            {form[fieldKey] ? (
              <img src={form[fieldKey]} alt={title} style={shell.profileImg} />
            ) : (
              <span>{emptyLabel}</span>
            )}
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
                ) : (
                  <span>Logo</span>
                )}
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

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone</p>
          <input
            style={shell.input}
            value={form.companyMobile}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, companyMobile: value, gstPhone: prev.gstPhone || value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Google Review Link</p>
          <input style={shell.input} value={form.googleReviewLink} onChange={(event) => updateField('googleReviewLink', event.target.value)} />
        </div>
      </div>

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Company Name</p>
          <input
            style={shell.input}
            value={form.companyName}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, companyName: value, gstCompanyName: prev.gstCompanyName || value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Email</p>
          <input
            style={shell.input}
            type="email"
            value={form.companyEmail}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, companyEmail: value, gstEmail: prev.gstEmail || value }));
            }}
          />
        </div>
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>About / Tagline</p>
        <input style={shell.input} value={form.aboutTagline} onChange={(event) => updateField('aboutTagline', event.target.value)} />
      </div>

      <div style={shell.field}>
        <p style={shell.fieldLabel}>Company Services</p>
        <textarea style={shell.textArea} value={form.companyServices} onChange={(event) => updateField('companyServices', event.target.value)} />
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
            value={form.gstCompanyName}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstCompanyName: value, companyName: value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>GSTIN</p>
          <input
            style={shell.input}
            value={form.companyGstNumber}
            onChange={(event) => handleGstinChange(event.target.value)}
            placeholder="07ABMCS7628G1ZW"
          />
        </div>
      </div>

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>PAN</p>
          <input
            style={shell.input}
            value={form.gstPanNumber}
            onChange={(event) => updateField('gstPanNumber', event.target.value.toUpperCase())}
            placeholder="ABMCS7628G"
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
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstPincode: value, companyPincode: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.threeCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone</p>
          <input
            style={shell.input}
            value={form.gstPhone}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstPhone: value, companyMobile: value }));
            }}
          />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Alternate Phone</p>
          <input style={shell.input} value={form.gstAlternatePhone} onChange={(event) => updateField('gstAlternatePhone', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Email</p>
          <input
            style={shell.input}
            type="email"
            value={form.gstEmail}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, gstEmail: value, companyEmail: value }));
            }}
          />
        </div>
      </div>

      <div style={shell.divider} />
      <h4 style={blockTitleStyle}>
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
        {renderBrandingUploader({
          title: 'Company Stamp',
          fieldKey: 'gstCompanyStampUrl',
          inputRef: gstStampInputRef,
          hint: 'PNG/JPG, transparent preferred',
          emptyLabel: 'Stamp'
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
          <input style={shell.input} value={form.nonGstPincode} onChange={(event) => updateField('nonGstPincode', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Phone</p>
          <input style={shell.input} value={form.nonGstPhone} onChange={(event) => updateField('nonGstPhone', event.target.value)} />
        </div>
      </div>

      <div style={shell.twoCol}>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Alternate Phone</p>
          <input style={shell.input} value={form.nonGstAlternatePhone} onChange={(event) => updateField('nonGstAlternatePhone', event.target.value)} />
        </div>
        <div style={shell.field}>
          <p style={shell.fieldLabel}>Email</p>
          <input style={shell.input} type="email" value={form.nonGstEmail} onChange={(event) => updateField('nonGstEmail', event.target.value)} />
        </div>
      </div>

      <div style={shell.divider} />
      <h4 style={blockTitleStyle}>
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
      </div>
    </>
  );

  const renderBranding = () => (
    <>
      <h3 style={shell.sectionHeading}>Branding</h3>
      <p style={shell.infoBanner}>Organization logo, appearance mode, and accent color for dashboard, PDFs and notifications.</p>
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
          <div style={{ height: '10px', background: form.brandingAccentColor || '#9F174D' }} />
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
              <div style={{ height: '8px', borderRadius: '999px', background: form.brandingAccentColor || '#9F174D' }} />
              <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.4)' }} />
              <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.25)' }} />
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontWeight: 800, color: form.brandingAppearance === 'dark' ? '#e5e7eb' : '#111827' }}>Branding Preview</div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: form.brandingAppearance === 'dark' ? '#94a3b8' : '#64748b' }}>
                Pane: {form.brandingAppearance === 'dark' ? 'Dark' : 'Light'} • Accent: {form.brandingAccentColor || '#9F174D'}
              </div>
              <button
                type="button"
                style={{
                  marginTop: '10px',
                  border: `1px solid ${form.brandingAccentColor || '#9F174D'}`,
                  color: '#fff',
                  background: form.brandingAccentColor || '#9F174D',
                  borderRadius: '8px',
                  minHeight: '28px',
                  padding: '0 10px',
                  fontWeight: 800,
                  fontSize: '11px'
                }}
              >
                Sample Action
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ ...shell.profileCard, borderStyle: 'solid' }}>
        <p style={{ ...shell.fieldLabel, margin: 0 }}>Organization Logo</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: '16px', alignItems: 'center' }}>
          {renderBrandingUploader({
            title: 'Organization Logo',
            fieldKey: 'dashboardImageUrl',
            inputRef: logoInputRef,
            hint: 'Preferred 240 x 240 pixels @ 72 DPI',
            emptyLabel: 'Logo'
          })}
          <div>
            <p style={{ margin: 0, color: '#334155', fontWeight: 600, lineHeight: 1.5 }}>This logo will be displayed in transaction PDFs and email notifications.</p>
            <p style={{ margin: '10px 0 0 0', color: '#64748b', fontWeight: 600, lineHeight: 1.5 }}>
              Preferred Image Dimensions: 240 x 240 pixels @ 72 DPI<br />
              Supported Files: jpg, jpeg, png, gif, bmp<br />
              Maximum File Size: 1MB
            </p>
            <button
              type="button"
              style={{ ...shell.tinyButton, ...shell.tinyButtonGhost, marginTop: '10px' }}
              onClick={() => updateField('dashboardImageUrl', '')}
            >
              Remove Logo
            </button>
          </div>
        </div>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.fieldLabel, margin: 0 }}>Appearance</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => updateField('brandingAppearance', 'dark')}
          style={{
            border: form.brandingAppearance === 'dark' ? '2px solid #1f2937' : '1px solid #d1d5db',
            background: '#fff',
            borderRadius: '16px',
            width: '210px',
            minHeight: '120px',
            cursor: 'pointer',
            fontWeight: 800,
            color: '#475569'
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
            borderRadius: '16px',
            width: '210px',
            minHeight: '120px',
            cursor: 'pointer',
            fontWeight: 800,
            color: '#475569'
          }}
        >
          LIGHT PANE
        </button>
      </div>

      <div style={shell.divider} />
      <p style={{ ...shell.fieldLabel, margin: 0 }}>Accent Color</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(48px, max-content))', gap: '12px', alignItems: 'center' }}>
        {brandingAccentOptions.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => updateField('brandingAccentColor', entry)}
            style={{
              width: '44px',
              height: '44px',
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
            minHeight: '44px',
            borderRadius: '12px',
            padding: '0 14px',
            border: brandingAccentOptions.includes(form.brandingAccentColor) ? '1px solid #d1d5db' : '2px solid #1f2937',
            background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 45%, #ec4899 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '13px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            position: 'relative',
            minWidth: '98px'
          }}
          title="Custom Accent Color"
        >
          Custom
          <input
            id="branding-custom-accent"
            ref={customAccentInputRef}
            type="color"
            value={form.brandingAccentColor || '#9F174D'}
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

      <div style={shell.twoCol}>
        {renderBrandingUploader({
          title: 'GST Company Logo',
          fieldKey: 'gstCompanyLogoUrl',
          inputRef: gstLogoInputRef,
          hint: 'Used on GST invoices.'
        })}
        {renderBrandingUploader({
          title: 'GST Digital Signature',
          fieldKey: 'gstDigitalSignatureUrl',
          inputRef: gstSignatureInputRef,
          hint: 'Optional invoice signature image.'
        })}
        {renderBrandingUploader({
          title: 'GST Company Stamp',
          fieldKey: 'gstCompanyStampUrl',
          inputRef: gstStampInputRef,
          hint: 'Optional stamp for GST documents.'
        })}
        {renderBrandingUploader({
          title: 'Non-GST Company Logo',
          fieldKey: 'nonGstCompanyLogoUrl',
          inputRef: nonGstLogoInputRef,
          hint: 'Used on non-GST documents.'
        })}
      </div>
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
          <input style={shell.input} value={form.whatsappPhoneNumber} onChange={(event) => updateField('whatsappPhoneNumber', event.target.value)} />
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
          <input type="password" style={shell.input} value={form.smtpPass} onChange={(event) => updateField('smtpPass', event.target.value)} placeholder="Enter new app password to update" />
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
        <p style={shell.fieldLabel}>Customer Notes</p>
        <textarea
          style={{ ...shell.textArea, minHeight: '130px' }}
          value={form.customerNotesDefault}
          onChange={(event) => updateField('customerNotesDefault', event.target.value)}
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
              <div style={shell.bankQrPreview}>
                {form.gstBankQrUrl ? <img src={form.gstBankQrUrl} alt="GST QR" style={shell.profileImg} /> : <span>QR Preview</span>}
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <p style={shell.fieldLabel}>QR Code</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" style={shell.tinyButton} onClick={() => gstBankQrInputRef.current?.click()}>Upload QR</button>
                  <button type="button" style={{ ...shell.tinyButton, ...shell.tinyButtonGhost }} onClick={() => updateField('gstBankQrUrl', '')}>Clear</button>
                  <input ref={gstBankQrInputRef} type="file" accept="image/*" onChange={(event) => handleBankQrUpload(event, 'gstBankQrUrl', 'GST')} style={{ display: 'none' }} />
                </div>
              </div>
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
              <div style={shell.bankQrPreview}>
                {form.nonGstBankQrUrl ? <img src={form.nonGstBankQrUrl} alt="Non-GST QR" style={shell.profileImg} /> : <span>QR Preview</span>}
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <p style={shell.fieldLabel}>QR Code</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" style={shell.tinyButton} onClick={() => nonGstBankQrInputRef.current?.click()}>Upload QR</button>
                  <button type="button" style={{ ...shell.tinyButton, ...shell.tinyButtonGhost }} onClick={() => updateField('nonGstBankQrUrl', '')}>Clear</button>
                  <input ref={nonGstBankQrInputRef} type="file" accept="image/*" onChange={(event) => handleBankQrUpload(event, 'nonGstBankQrUrl', 'Non-GST')} style={{ display: 'none' }} />
                </div>
              </div>
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
        <p style={sectionLeadTitleStyle}>Saved Bank Accounts</p>
        <div style={shell.bankTableWrap}>
          <table style={shell.bankTable}>
            <thead>
              <tr>
                <th style={shell.bankTh}>Primary</th>
                <th style={shell.bankTh}>Type</th>
                <th style={shell.bankTh}>Bank Name</th>
                <th style={shell.bankTh}>Account Number</th>
                <th style={shell.bankTh}>IFSC</th>
                <th style={shell.bankTh}>UPI ID</th>
                <th style={shell.bankTh}>Opening Balance</th>
                <th style={shell.bankTh}>Current Balance</th>
                <th style={shell.bankTh}>QR</th>
                <th style={shell.bankTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td style={shell.bankTd}><input type="radio" checked={row.primary} readOnly /></td>
                  <td style={shell.bankTd}>{row.type}</td>
                  <td style={shell.bankTd}>{row.bankName || '-'}</td>
                  <td style={shell.bankTd}>{row.accountNumber ? maskAccountNumber(row.accountNumber) : '-'}</td>
                  <td style={shell.bankTd}>{row.ifsc || '-'}</td>
                  <td style={shell.bankTd}>{row.upiId || '-'}</td>
                  <td style={shell.bankTd}>{Number(row.opening || 0).toFixed(2)}</td>
                  <td style={shell.bankTd}>{Number(row.current || 0).toFixed(2)}</td>
                  <td style={shell.bankTd}>{row.qr ? 'Set' : 'Not set'}</td>
                  <td style={shell.bankTd}>
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
    </>
  );

  const renderSectionContent = () => {
    if (activeSection === 'businessIdentity') return renderBusinessIdentity();
    if (activeSection === 'branding') return renderBranding();
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
    if (activeSection === 'termsConditions') return renderTermsConditions();
    if (activeSection === 'invoiceSettings') return renderInvoiceSettings();
    return renderSecurity();
  };

  const panelStyle = isCompactLayout
    ? { ...shell.panel, minHeight: 'auto' }
    : shell.panel;
  const panelHeaderStyle = isCompactLayout
    ? { ...shell.panelHeader, padding: '14px 14px 12px', gap: '10px' }
    : shell.panelHeader;
  const panelTitleStyle = isCompactLayout
    ? { ...shell.panelTitle, fontSize: '22px', lineHeight: 1.2 }
    : shell.panelTitle;
  const panelStatusStyle = isCompactLayout
    ? { ...shell.panelStatus, fontSize: '13px' }
    : shell.panelStatus;
  const panelHeaderSideStyle = isCompactLayout
    ? { ...shell.panelHeaderSide, justifyItems: 'start', width: '100%' }
    : shell.panelHeaderSide;
  const validationStyle = isCompactLayout
    ? { ...shell.validation, textAlign: 'left', fontSize: '13px' }
    : shell.validation;
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
    ? { ...shell.panelBody, padding: '12px', overflowX: 'hidden' }
    : shell.panelBody;
  const pageStyle = modalMode
    ? { ...shell.page, gap: '10px' }
    : shell.page;
  const headingStyle = modalMode
    ? { ...shell.heading, fontSize: '22px' }
    : shell.heading;
  const subHeadingStyle = modalMode
    ? { ...shell.subHeading, fontSize: '13px' }
    : shell.subHeading;
  const blockTitleStyle = modalMode
    ? { margin: 0, fontSize: '20px', lineHeight: 1.2, color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.01em' }
    : { margin: 0, fontSize: '34px', lineHeight: 1.15, color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.02em' };
  const sectionLeadTitleStyle = modalMode
    ? { ...shell.hint, marginBottom: '4px', fontSize: '16px', fontWeight: 800, color: '#334155' }
    : { ...shell.hint, marginBottom: '4px', fontSize: '22px', fontWeight: 800, color: '#334155' };
  const sectionLeadSubTitleStyle = modalMode
    ? { ...shell.hint, fontSize: '13px', fontWeight: 700, color: '#475569' }
    : { ...shell.hint, fontSize: '18px', fontWeight: 700, color: '#475569' };

  return (
    <section style={pageStyle}>
      <div style={shell.headingWrap}>
        <h2 style={headingStyle}>Company Profile</h2>
        <p style={subHeadingStyle}>Company profile settings</p>
      </div>

      <div style={shell.workspaceShell}>
        <div style={panelStyle}>
          <header style={panelHeaderStyle}>
            <div style={shell.panelHeaderMain}>
              <h3 style={panelTitleStyle}>Company Profile</h3>
              <p style={{ ...panelStatusStyle, ...statusTone }}>{status || 'All changes saved.'}</p>
            </div>
            <div style={panelHeaderSideStyle}>
              <span style={validationStyle}>{validationSummary}</span>
              <div style={panelHeaderButtonsStyle}>
                <button type="button" style={topButtonStyle} onClick={discardChanges}>Discard</button>
                <button type="button" style={{ ...topButtonStyle, ...shell.topButtonPrimary }} onClick={saveAll} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
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
                  {sectionMeta.map((section) => (
                    <option key={section.key} value={section.key}>{section.label}</option>
                  ))}
                </select>
              ) : null}
              {sectionMeta.map((section) => {
                const isActive = section.key === activeSection;
                if (isCompactLayout) return null;
                return (
                  <button
                    key={section.key}
                    type="button"
                    style={{ ...tabButtonStyle, ...(isActive ? shell.tabButtonActive : {}) }}
                    onClick={() => setActiveSection(section.key)}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>

            <div style={panelBodyStyle}>{renderSectionContent()}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
