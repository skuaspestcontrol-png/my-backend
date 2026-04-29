const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { generateInvoicePdfBuffer, formatINR, formatDate } = require('./invoicePdf');
const { registerPayrollModule } = require('./payrollModule');
const { registerHrModule } = require('./hrModule');
const { registerCustomerDedupModule } = require('./customerDedupModule');
require('dotenv').config();

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://skuaspestcontrol.com'
];
const configuredAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredAllowedOrigins.length > 0 ? configuredAllowedOrigins : defaultAllowedOrigins;
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin) and explicitly allow listed browser origins.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-role', 'x-user-name', 'x-user-id'],
  credentials: true
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
const PORT = Math.max(1, Number(process.env.PORT || 5000) || 5000);
const SERVER_ORIGIN = String(process.env.SERVER_ORIGIN || `http://localhost:${PORT}`).trim();

const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
[uploadsDir, dataDir].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir); });

app.use('/uploads', express.static(uploadsDir));
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndexFile = path.join(frontendDistDir, 'index.html');
if (fs.existsSync(frontendDistDir) && fs.existsSync(frontendIndexFile)) {
  app.use(express.static(frontendDistDir));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage });

const settingsFile = path.join(dataDir, 'settings.json');
const leadsFile = path.join(dataDir, 'leads.json');
const employeesFile = path.join(dataDir, 'employees.json');
const jobsFile = path.join(dataDir, 'jobs.json');
const itemsFile = path.join(dataDir, 'items.json');
const customersFile = path.join(dataDir, 'customers.json');
const invoicesFile = path.join(dataDir, 'invoices.json');
const paymentsFile = path.join(dataDir, 'payments.json');
const attendanceFile = path.join(dataDir, 'attendance.json');
const renewalsFile = path.join(dataDir, 'renewals.json');
const complaintsFile = path.join(dataDir, 'complaints.json');
const salaryStructuresFile = path.join(dataDir, 'salary_structures.json');
const payrollHolidaysFile = path.join(dataDir, 'payroll_holidays.json');
const payrollAdvancesFile = path.join(dataDir, 'advance_salaries.json');
const payrollRunsFile = path.join(dataDir, 'payroll_runs.json');
const payrollItemsFile = path.join(dataDir, 'payroll_items.json');
const salaryPaymentsFile = path.join(dataDir, 'salary_payments.json');
const payrollAuditFile = path.join(dataDir, 'payroll_audit.json');
const hrLeavesFile = path.join(dataDir, 'hr_leaves.json');
const hrNotificationsFile = path.join(dataDir, 'hr_notifications.json');
const hrWorkflowFile = path.join(dataDir, 'hr_workflow.json');
const hrPerformanceFile = path.join(dataDir, 'hr_performance.json');
const customerAddressesFile = path.join(dataDir, 'customer_addresses.json');
const customerContactsFile = path.join(dataDir, 'customer_contacts.json');
const customerImportBatchesFile = path.join(dataDir, 'customer_import_batches.json');
const customerImportRowsFile = path.join(dataDir, 'customer_import_rows.json');
const customerDuplicateMatchesFile = path.join(dataDir, 'customer_duplicate_matches.json');
const customerMergeHistoryFile = path.join(dataDir, 'customer_merge_history.json');
const customerDedupAuditFile = path.join(dataDir, 'customer_dedup_audit.json');

const readJsonFile = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const data = fs.readFileSync(filePath, 'utf8').trim();
    return data ? JSON.parse(data) : fallback;
  } catch (error) {
    console.error(`Failed to read ${path.basename(filePath)}:`, error.message);
    return fallback;
  }
};

const invoiceColumnKeys = ['date', 'invoiceNumber', 'customerName', 'dueDate', 'amount', 'balanceDue', 'status'];
const defaultInvoiceFieldSettings = {
  showSubject: true,
  showServicePeriod: true,
  showPaymentSummary: true,
  showCustomerNotes: true,
  showTermsAndConditions: true,
  showCompanyGst: true,
  showCompanyWebsite: true,
  showGoogleReviewLink: true
};
const allowedInvoiceTemplates = new Set(['classic', 'clean', 'executive']);
const allowedOnOff = new Set(['On', 'Off']);
const allowedYesNo = new Set(['Yes', 'No']);
const allowedSmtpEncryptions = new Set(['TLS', 'SSL', 'NONE']);
const defaultSettings = {
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
  companyName: '',
  companyAddress: '',
  companyCity: '',
  companyState: '',
  companyPincode: '',
  companyGstNumber: '',
  companyEmail: '',
  companyMobile: '',
  companyWebsite: '',
  googleReviewLink: '',
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
  gstBankOpeningBalance: 0,
  gstBankCurrentBalance: 0,
  gstBankQrUrl: '',
  gstBankPrimary: true,
  nonGstBankName: '',
  nonGstBankAccountNumber: '',
  nonGstBankIfsc: '',
  nonGstBankBranch: '',
  nonGstBankUpiId: '',
  nonGstBankOpeningBalance: 0,
  nonGstBankCurrentBalance: 0,
  nonGstBankQrUrl: '',
  nonGstBankPrimary: false,
  employeeCodePrefix: 'EMP-',
  employeeCodeNextNumber: 1001,
  employeeCodePadding: 4,
  jobPrefix: 'JOB-',
  jobNextNumber: 1,
  jobNumberPadding: 6,
  adminUsername: 'admin',
  adminPassword: 'admin123',
  termsAndConditionsDefault: '',
  gstTermsAndConditions: '',
  nonGstTermsAndConditions: '',
  customerNotesDefault: '',
  settingsAccessPin: '',
  smtpSenderName: '',
  smtpHost: '',
  smtpPort: 587,
  smtpEncryption: 'TLS',
  smtpActive: 'Yes',
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  smtpFromEmail: '',
  smtpTestTargetEmail: '',
  whatsappApiVersion: 'v23.0',
  whatsappPhoneNumber: '',
  whatsappInstanceId: '',
  whatsappPhoneNumberId: '',
  whatsappAccessToken: '',
  whatsappContractExpiryToOwner: 'On',
  whatsappContractExpiryToCustomer: 'Off',
  whatsappLeadFollowupToOwner: 'On',
  whatsappLeadFollowupToCustomer: 'Off',
  whatsappLoginAlertToOwner: 'On',
  whatsappLoginAlertToCustomer: 'Off',
  whatsappBusinessDigestToOwner: 'Off',
  whatsappBusinessDigestToCustomer: 'Off',
  dashboardImageUrl: '',
  brandingAppearance: 'light',
  brandingAccentColor: '#9F174D',
  invoiceNumberMode: 'auto',
  invoicePrefix: 'SPC-',
  invoiceNextNumber: 66,
  invoiceNumberPadding: 4,
  invoiceTemplate: 'classic',
  invoiceVisibleColumns: [...invoiceColumnKeys],
  invoiceFieldSettings: { ...defaultInvoiceFieldSettings }
};

const normalizeSettingsText = (value) => String(value ?? '').trim();
const normalizeSettingsNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
  }
  if (typeof value === 'number') return value === 1;
  return fallback;
};
const normalizeOnOff = (value, fallback = 'Off') => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'on') return 'On';
  if (raw === 'off') return 'Off';
  return allowedOnOff.has(fallback) ? fallback : 'Off';
};
const normalizeYesNo = (value, fallback = 'Yes') => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'yes') return 'Yes';
  if (raw === 'no') return 'No';
  return allowedYesNo.has(fallback) ? fallback : 'Yes';
};
const normalizeSmtpEncryption = (value, fallback = 'TLS') => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (allowedSmtpEncryptions.has(normalized)) return normalized;
  const safeFallback = String(fallback ?? '').trim().toUpperCase();
  return allowedSmtpEncryptions.has(safeFallback) ? safeFallback : 'TLS';
};

const normalizeInvoiceVisibleColumns = (value) => {
  const source = Array.isArray(value) ? value : defaultSettings.invoiceVisibleColumns;
  const seen = new Set();
  const next = [];
  source.forEach((entry) => {
    const key = String(entry || '').trim();
    if (!invoiceColumnKeys.includes(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    next.push(key);
  });
  return next.length > 0 ? next : [...defaultSettings.invoiceVisibleColumns];
};

const normalizeInvoiceFieldSettings = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const next = { ...defaultInvoiceFieldSettings };
  Object.keys(defaultInvoiceFieldSettings).forEach((key) => {
    if (source[key] === undefined) return;
    next[key] = Boolean(source[key]);
  });
  return next;
};

const sanitizeSettings = (raw = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const invoiceTemplate = String(source.invoiceTemplate || '').trim();
  const smtpEncryption = normalizeSmtpEncryption(
    source.smtpEncryption,
    normalizeBoolean(source.smtpSecure, defaultSettings.smtpSecure) ? 'SSL' : defaultSettings.smtpEncryption
  );
  const smtpSecure = smtpEncryption === 'SSL';
  const gstTermsAndConditions = normalizeSettingsText(
    source.gstTermsAndConditions ?? source.termsAndConditionsDefault ?? defaultSettings.gstTermsAndConditions
  );
  const whatsappInstanceId = normalizeSettingsText(
    source.whatsappInstanceId ?? source.whatsappPhoneNumberId ?? defaultSettings.whatsappInstanceId
  );
  const whatsappPhoneNumberId = normalizeSettingsText(
    source.whatsappPhoneNumberId ?? whatsappInstanceId ?? defaultSettings.whatsappPhoneNumberId
  );
  return {
    ...defaultSettings,
    ...source,
    gstCompanyName: normalizeSettingsText(source.gstCompanyName ?? source.companyName ?? defaultSettings.gstCompanyName),
    gstPanNumber: normalizeSettingsText(source.gstPanNumber ?? defaultSettings.gstPanNumber).toUpperCase(),
    gstLicenseNumber: normalizeSettingsText(source.gstLicenseNumber ?? defaultSettings.gstLicenseNumber),
    gstRegistrationNumber: normalizeSettingsText(source.gstRegistrationNumber ?? defaultSettings.gstRegistrationNumber),
    gstBillingAddress: normalizeSettingsText(source.gstBillingAddress ?? source.companyAddress ?? defaultSettings.gstBillingAddress),
    gstCity: normalizeSettingsText(source.gstCity ?? source.companyCity ?? defaultSettings.gstCity),
    gstState: normalizeSettingsText(source.gstState ?? source.companyState ?? defaultSettings.gstState),
    gstStateCode: normalizeSettingsText(source.gstStateCode ?? defaultSettings.gstStateCode),
    gstPincode: normalizeSettingsText(source.gstPincode ?? source.companyPincode ?? defaultSettings.gstPincode),
    gstPhone: normalizeSettingsText(source.gstPhone ?? source.companyMobile ?? defaultSettings.gstPhone),
    gstAlternatePhone: normalizeSettingsText(source.gstAlternatePhone ?? defaultSettings.gstAlternatePhone),
    gstEmail: normalizeSettingsText(source.gstEmail ?? source.companyEmail ?? defaultSettings.gstEmail),
    gstCompanyLogoUrl: normalizeSettingsText(source.gstCompanyLogoUrl ?? source.dashboardImageUrl ?? defaultSettings.gstCompanyLogoUrl),
    gstDigitalSignatureUrl: normalizeSettingsText(source.gstDigitalSignatureUrl ?? defaultSettings.gstDigitalSignatureUrl),
    gstCompanyStampUrl: normalizeSettingsText(source.gstCompanyStampUrl ?? defaultSettings.gstCompanyStampUrl),
    companyName: normalizeSettingsText(source.companyName ?? source.gstCompanyName ?? defaultSettings.companyName),
    companyAddress: normalizeSettingsText(source.companyAddress ?? source.gstBillingAddress ?? defaultSettings.companyAddress),
    companyCity: normalizeSettingsText(source.companyCity ?? source.gstCity ?? defaultSettings.companyCity),
    companyState: normalizeSettingsText(source.companyState ?? source.gstState ?? defaultSettings.companyState),
    companyPincode: normalizeSettingsText(source.companyPincode ?? source.gstPincode ?? defaultSettings.companyPincode),
    companyGstNumber: normalizeSettingsText(source.companyGstNumber ?? defaultSettings.companyGstNumber).toUpperCase(),
    companyEmail: normalizeSettingsText(source.companyEmail ?? source.gstEmail ?? defaultSettings.companyEmail),
    companyMobile: normalizeSettingsText(source.companyMobile ?? source.gstPhone ?? defaultSettings.companyMobile),
    companyWebsite: normalizeSettingsText(source.companyWebsite ?? defaultSettings.companyWebsite),
    googleReviewLink: normalizeSettingsText(source.googleReviewLink ?? defaultSettings.googleReviewLink),
    aboutTagline: normalizeSettingsText(source.aboutTagline ?? defaultSettings.aboutTagline),
    companyServices: normalizeSettingsText(source.companyServices ?? defaultSettings.companyServices),
    nonGstCompanyName: normalizeSettingsText(source.nonGstCompanyName ?? defaultSettings.nonGstCompanyName),
    nonGstBillingAddress: normalizeSettingsText(source.nonGstBillingAddress ?? source.nonGstAddress ?? defaultSettings.nonGstBillingAddress),
    nonGstCity: normalizeSettingsText(source.nonGstCity ?? defaultSettings.nonGstCity),
    nonGstAddress: normalizeSettingsText(source.nonGstAddress ?? source.nonGstBillingAddress ?? defaultSettings.nonGstAddress),
    nonGstState: normalizeSettingsText(source.nonGstState ?? defaultSettings.nonGstState),
    nonGstPincode: normalizeSettingsText(source.nonGstPincode ?? defaultSettings.nonGstPincode),
    nonGstPhone: normalizeSettingsText(source.nonGstPhone ?? defaultSettings.nonGstPhone),
    nonGstAlternatePhone: normalizeSettingsText(source.nonGstAlternatePhone ?? defaultSettings.nonGstAlternatePhone),
    nonGstEmail: normalizeSettingsText(source.nonGstEmail ?? defaultSettings.nonGstEmail),
    nonGstCompanyLogoUrl: normalizeSettingsText(source.nonGstCompanyLogoUrl ?? defaultSettings.nonGstCompanyLogoUrl),
    gstBankName: normalizeSettingsText(source.gstBankName ?? defaultSettings.gstBankName),
    gstBankAccountNumber: normalizeSettingsText(source.gstBankAccountNumber ?? defaultSettings.gstBankAccountNumber),
    gstBankIfsc: normalizeSettingsText(source.gstBankIfsc ?? defaultSettings.gstBankIfsc).toUpperCase(),
    gstBankBranch: normalizeSettingsText(source.gstBankBranch ?? defaultSettings.gstBankBranch),
    gstBankUpiId: normalizeSettingsText(source.gstBankUpiId ?? defaultSettings.gstBankUpiId),
    gstBankOpeningBalance: Number(normalizeSettingsNumber(source.gstBankOpeningBalance ?? defaultSettings.gstBankOpeningBalance, defaultSettings.gstBankOpeningBalance).toFixed(2)),
    gstBankCurrentBalance: Number(normalizeSettingsNumber(source.gstBankCurrentBalance ?? defaultSettings.gstBankCurrentBalance, defaultSettings.gstBankCurrentBalance).toFixed(2)),
    gstBankQrUrl: normalizeSettingsText(source.gstBankQrUrl ?? defaultSettings.gstBankQrUrl),
    gstBankPrimary: normalizeBoolean(source.gstBankPrimary, defaultSettings.gstBankPrimary),
    nonGstBankName: normalizeSettingsText(source.nonGstBankName ?? defaultSettings.nonGstBankName),
    nonGstBankAccountNumber: normalizeSettingsText(source.nonGstBankAccountNumber ?? defaultSettings.nonGstBankAccountNumber),
    nonGstBankIfsc: normalizeSettingsText(source.nonGstBankIfsc ?? defaultSettings.nonGstBankIfsc).toUpperCase(),
    nonGstBankBranch: normalizeSettingsText(source.nonGstBankBranch ?? defaultSettings.nonGstBankBranch),
    nonGstBankUpiId: normalizeSettingsText(source.nonGstBankUpiId ?? defaultSettings.nonGstBankUpiId),
    nonGstBankOpeningBalance: Number(normalizeSettingsNumber(source.nonGstBankOpeningBalance ?? defaultSettings.nonGstBankOpeningBalance, defaultSettings.nonGstBankOpeningBalance).toFixed(2)),
    nonGstBankCurrentBalance: Number(normalizeSettingsNumber(source.nonGstBankCurrentBalance ?? defaultSettings.nonGstBankCurrentBalance, defaultSettings.nonGstBankCurrentBalance).toFixed(2)),
    nonGstBankQrUrl: normalizeSettingsText(source.nonGstBankQrUrl ?? defaultSettings.nonGstBankQrUrl),
    nonGstBankPrimary: normalizeBoolean(source.nonGstBankPrimary, defaultSettings.nonGstBankPrimary),
    employeeCodePrefix: normalizeSettingsText(source.employeeCodePrefix ?? defaultSettings.employeeCodePrefix) || defaultSettings.employeeCodePrefix,
    employeeCodeNextNumber: Math.max(1, normalizeSettingsNumber(source.employeeCodeNextNumber ?? defaultSettings.employeeCodeNextNumber, defaultSettings.employeeCodeNextNumber)),
    employeeCodePadding: Math.max(1, normalizeSettingsNumber(source.employeeCodePadding ?? defaultSettings.employeeCodePadding, defaultSettings.employeeCodePadding)),
    jobPrefix: normalizeSettingsText(source.jobPrefix ?? defaultSettings.jobPrefix) || defaultSettings.jobPrefix,
    jobNextNumber: Math.max(1, normalizeSettingsNumber(source.jobNextNumber ?? defaultSettings.jobNextNumber, defaultSettings.jobNextNumber)),
    jobNumberPadding: Math.max(1, normalizeSettingsNumber(source.jobNumberPadding ?? defaultSettings.jobNumberPadding, defaultSettings.jobNumberPadding)),
    adminUsername: normalizeSettingsText(source.adminUsername ?? defaultSettings.adminUsername) || defaultSettings.adminUsername,
    adminPassword: normalizeSettingsText(source.adminPassword ?? defaultSettings.adminPassword) || defaultSettings.adminPassword,
    gstTermsAndConditions,
    nonGstTermsAndConditions: normalizeSettingsText(source.nonGstTermsAndConditions ?? defaultSettings.nonGstTermsAndConditions),
    customerNotesDefault: normalizeSettingsText(source.customerNotesDefault ?? defaultSettings.customerNotesDefault),
    termsAndConditionsDefault: normalizeSettingsText(source.termsAndConditionsDefault ?? gstTermsAndConditions),
    settingsAccessPin: normalizeSettingsText(source.settingsAccessPin ?? defaultSettings.settingsAccessPin),
    smtpSenderName: normalizeSettingsText(source.smtpSenderName ?? defaultSettings.smtpSenderName),
    smtpHost: normalizeSettingsText(source.smtpHost ?? defaultSettings.smtpHost),
    smtpPort: Math.max(1, normalizeSettingsNumber(source.smtpPort ?? defaultSettings.smtpPort, defaultSettings.smtpPort)),
    smtpEncryption,
    smtpActive: normalizeYesNo(source.smtpActive ?? defaultSettings.smtpActive, defaultSettings.smtpActive),
    smtpSecure,
    smtpUser: normalizeSettingsText(source.smtpUser ?? defaultSettings.smtpUser),
    smtpPass: normalizeSettingsText(source.smtpPass ?? defaultSettings.smtpPass),
    smtpFromEmail: normalizeSettingsText(source.smtpFromEmail ?? defaultSettings.smtpFromEmail),
    smtpTestTargetEmail: normalizeSettingsText(source.smtpTestTargetEmail ?? defaultSettings.smtpTestTargetEmail),
    whatsappApiVersion: normalizeSettingsText(source.whatsappApiVersion ?? defaultSettings.whatsappApiVersion) || defaultSettings.whatsappApiVersion,
    whatsappPhoneNumber: normalizeSettingsText(source.whatsappPhoneNumber ?? defaultSettings.whatsappPhoneNumber),
    whatsappInstanceId,
    whatsappPhoneNumberId,
    whatsappAccessToken: normalizeSettingsText(source.whatsappAccessToken ?? defaultSettings.whatsappAccessToken),
    whatsappContractExpiryToOwner: normalizeOnOff(
      source.whatsappContractExpiryToOwner ?? defaultSettings.whatsappContractExpiryToOwner,
      defaultSettings.whatsappContractExpiryToOwner
    ),
    whatsappContractExpiryToCustomer: normalizeOnOff(
      source.whatsappContractExpiryToCustomer ?? defaultSettings.whatsappContractExpiryToCustomer,
      defaultSettings.whatsappContractExpiryToCustomer
    ),
    whatsappLeadFollowupToOwner: normalizeOnOff(
      source.whatsappLeadFollowupToOwner ?? defaultSettings.whatsappLeadFollowupToOwner,
      defaultSettings.whatsappLeadFollowupToOwner
    ),
    whatsappLeadFollowupToCustomer: normalizeOnOff(
      source.whatsappLeadFollowupToCustomer ?? defaultSettings.whatsappLeadFollowupToCustomer,
      defaultSettings.whatsappLeadFollowupToCustomer
    ),
    whatsappLoginAlertToOwner: normalizeOnOff(
      source.whatsappLoginAlertToOwner ?? defaultSettings.whatsappLoginAlertToOwner,
      defaultSettings.whatsappLoginAlertToOwner
    ),
    whatsappLoginAlertToCustomer: normalizeOnOff(
      source.whatsappLoginAlertToCustomer ?? defaultSettings.whatsappLoginAlertToCustomer,
      defaultSettings.whatsappLoginAlertToCustomer
    ),
    whatsappBusinessDigestToOwner: normalizeOnOff(
      source.whatsappBusinessDigestToOwner ?? defaultSettings.whatsappBusinessDigestToOwner,
      defaultSettings.whatsappBusinessDigestToOwner
    ),
    whatsappBusinessDigestToCustomer: normalizeOnOff(
      source.whatsappBusinessDigestToCustomer ?? defaultSettings.whatsappBusinessDigestToCustomer,
      defaultSettings.whatsappBusinessDigestToCustomer
    ),
    dashboardImageUrl: normalizeSettingsText(source.dashboardImageUrl ?? source.gstCompanyLogoUrl ?? defaultSettings.dashboardImageUrl),
    brandingAppearance: String(source.brandingAppearance || defaultSettings.brandingAppearance).trim().toLowerCase() === 'dark' ? 'dark' : 'light',
    brandingAccentColor: normalizeSettingsText(source.brandingAccentColor ?? defaultSettings.brandingAccentColor) || defaultSettings.brandingAccentColor,
    invoiceNumberMode: source.invoiceNumberMode === 'manual' ? 'manual' : 'auto',
    invoicePrefix: String(source.invoicePrefix ?? defaultSettings.invoicePrefix),
    invoiceNextNumber: Math.max(1, Number(source.invoiceNextNumber ?? defaultSettings.invoiceNextNumber) || defaultSettings.invoiceNextNumber),
    invoiceNumberPadding: Math.max(1, Number(source.invoiceNumberPadding ?? defaultSettings.invoiceNumberPadding) || defaultSettings.invoiceNumberPadding),
    invoiceTemplate: allowedInvoiceTemplates.has(invoiceTemplate) ? invoiceTemplate : defaultSettings.invoiceTemplate,
    invoiceVisibleColumns: normalizeInvoiceVisibleColumns(source.invoiceVisibleColumns),
    invoiceFieldSettings: normalizeInvoiceFieldSettings(source.invoiceFieldSettings)
  };
};

const readSettings = () => sanitizeSettings(readJsonFile(settingsFile, {}));

const getEmployeeCodeSeq = (empCode, prefix) => {
  const code = String(empCode || '').trim();
  if (!code || !prefix || !code.startsWith(prefix)) return null;
  const suffix = code.slice(prefix.length).match(/(\d+)$/);
  if (!suffix) return null;
  const parsed = Number(suffix[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildNextEmployeeCode = (settings, employees) => {
  const prefix = String(settings?.employeeCodePrefix || defaultSettings.employeeCodePrefix || 'EMP-');
  const padding = Math.max(1, Number(settings?.employeeCodePadding || defaultSettings.employeeCodePadding || 4));
  const configuredNext = Math.max(1, Number(settings?.employeeCodeNextNumber || defaultSettings.employeeCodeNextNumber || 1001));
  const maxExisting = (Array.isArray(employees) ? employees : []).reduce((acc, entry) => {
    const seq = getEmployeeCodeSeq(entry?.empCode, prefix);
    if (!Number.isFinite(seq)) return acc;
    return Math.max(acc, seq);
  }, 0);
  const next = Math.max(configuredNext, maxExisting + 1);
  return {
    prefix,
    padding,
    next,
    employeeCode: `${prefix}${String(next).padStart(padding, '0')}`
  };
};

const extractJobSequence = (jobNumber, prefix = '') => {
  const raw = String(jobNumber || '').trim();
  if (!raw) return null;
  if (prefix && raw.startsWith(prefix)) {
    const suffix = raw.slice(prefix.length).match(/(\d+)$/);
    if (!suffix) return null;
    const parsed = Number(suffix[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const digits = raw.match(/(\d+)$/);
  if (!digits) return null;
  const parsed = Number(digits[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const createNextJobNumber = (jobs, settings) => {
  const prefix = String(settings?.jobPrefix ?? defaultSettings.jobPrefix);
  const padding = Math.max(1, Number(settings?.jobNumberPadding ?? defaultSettings.jobNumberPadding) || defaultSettings.jobNumberPadding);
  const configuredNext = Math.max(1, Number(settings?.jobNextNumber ?? defaultSettings.jobNextNumber) || defaultSettings.jobNextNumber);
  const max = (Array.isArray(jobs) ? jobs : []).reduce((acc, job) => {
    const seq = extractJobSequence(job?.jobNumber, prefix);
    if (!Number.isFinite(seq)) return acc;
    return Math.max(acc, seq);
  }, 0);
  const next = Math.max(configuredNext, max + 1);
  return `${prefix}${String(next).padStart(padding, '0')}`;
};

const updateSettingsNextJobNumber = (usedJobNumber, settings) => {
  const seq = extractJobSequence(usedJobNumber, settings.jobPrefix);
  if (!Number.isFinite(seq)) return;
  const nextValue = Math.max(1, Number(settings.jobNextNumber || defaultSettings.jobNextNumber));
  if (seq >= nextValue) {
    const updated = {
      ...settings,
      jobNextNumber: seq + 1
    };
    fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
  }
};

const parseJobLogoPath = (dashboardImageUrl = '') => {
  const raw = String(dashboardImageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) {
    const direct = path.resolve(__dirname, `.${raw}`);
    if (fs.existsSync(direct)) return direct;
  }
  try {
    const url = new URL(raw);
    const pathname = url.pathname || '';
    if (pathname.includes('/uploads/')) {
      const fileName = path.basename(pathname);
      const local = path.join(__dirname, 'uploads', fileName);
      if (fs.existsSync(local)) return local;
    }
  } catch (_error) {
    if (fs.existsSync(raw)) return raw;
  }
  return '';
};

const buildJobPdfBuffer = ({ job = {}, settings = {} }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const companyName = String(settings.companyName || '').trim() || 'Your Company';
  const addressParts = [
    String(settings.companyAddress || '').trim(),
    [String(settings.companyCity || '').trim(), String(settings.companyState || '').trim(), String(settings.companyPincode || '').trim()].filter(Boolean).join(', ')
  ].filter(Boolean);
  const contactParts = [String(settings.companyEmail || '').trim(), String(settings.companyMobile || '').trim()].filter(Boolean);
  const website = String(settings.companyWebsite || '').trim();
  const gst = String(settings.companyGstNumber || '').trim();

  const logoPath = parseJobLogoPath(settings.gstCompanyLogoUrl || settings.dashboardImageUrl);
  if (logoPath) {
    try {
      doc.image(logoPath, 42, 36, { fit: [84, 84], align: 'left' });
    } catch (_error) {
      // ignore logo load errors and continue
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#0f172a')
    .text(companyName, 140, 42, { width: 380, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569');

  let companyMetaY = 70;
  addressParts.forEach((line) => {
    doc.text(line, 140, companyMetaY, { width: 380, align: 'right' });
    companyMetaY += 13;
  });
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | '), 140, companyMetaY, { width: 380, align: 'right' });
    companyMetaY += 13;
  }
  if (website) {
    doc.text(website, 140, companyMetaY, { width: 380, align: 'right' });
    companyMetaY += 13;
  }
  if (gst) {
    doc.text(`GSTIN: ${gst}`, 140, companyMetaY, { width: 380, align: 'right' });
  }

  doc.moveTo(42, 130).lineTo(553, 130).lineWidth(1).strokeColor('#cbd5e1').stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text('Job Completion Card', 42, 145);

  const fields = [
    ['Job Number', String(job.jobNumber || '').trim() || '-'],
    ['Completion Card', String(job.completionCardNumber || '').trim() || '-'],
    ['Job Status', String(job.status || '').trim() || '-'],
    ['Customer', String(job.customerName || '').trim() || '-'],
    ['Mobile', String(job.mobileNumber || '').trim() || '-'],
    ['Address', [job.address, job.areaName, job.city, job.state, job.pincode].map((v) => String(v || '').trim()).filter(Boolean).join(', ') || '-'],
    ['Service', String(job.serviceName || job.serviceInstructions || '').trim() || '-'],
    ['Visit', String(job.scheduleVisit || '').trim() || '-'],
    ['Scheduled Date', String(job.scheduledDate || '').trim() || '-'],
    ['Scheduled Time', String(job.scheduledTime || '').trim() || '-'],
    ['Technician', String(job.technicianName || '').trim() || '-'],
    ['Technician Mobile', String(job.technicianMobile || '').trim() || '-'],
    ['Punch In', String(job.punchInTime || '').trim() || '-'],
    ['Punch Out', String(job.punchOutTime || '').trim() || '-'],
    ['Completed At', String(job.completionCardGeneratedAt || '').trim() || '-']
  ];

  let y = 178;
  fields.forEach(([label, value]) => {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(`${label}:`, 42, y, { width: 150 });
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(value, 190, y, { width: 363 });
    y = doc.y + 5;
  });

  doc.end();
});

const buildContractJobCardPdfBuffer = ({ invoice = {}, jobs = [], settings = {} }) => new Promise((resolve, reject) => {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#111827').text(String(settings.companyName || 'Service Team').trim() || 'Service Team', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor('#334155').text('Contract Job Card');
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor('#1f2937').text(`Contract #: ${invoice.invoiceNumber || '-'}`);
    doc.text(`Customer: ${invoice.customerName || '-'}`);
    doc.text(`Generated On: ${new Date().toLocaleString('en-IN')}`);
    doc.moveDown(0.6);

    doc.fontSize(10).fillColor('#111827').text('Service Records', { underline: true });
    doc.moveDown(0.4);

    if (jobs.length === 0) {
      doc.fontSize(10).fillColor('#64748b').text('No service records found for this contract.');
      doc.end();
      return;
    }

    jobs.forEach((job, index) => {
      if (doc.y > 740) doc.addPage();
      const row = [
        `${index + 1}. ${job.serviceName || '-'}`,
        `Visit: ${job.scheduleVisit || '-'}`,
        `Date: ${formatDate(job.scheduledDate)}`,
        `Time: ${job.scheduledTime || '-'}`,
        `Technician: ${job.technicianName || '-'}`,
        `Status: ${job.status || '-'}`
      ];
      doc.fontSize(10).fillColor('#1f2937').text(row.join(' | '), { width: 520 });
      doc.moveDown(0.35);
    });

    doc.end();
  } catch (error) {
    reject(error);
  }
});

const allowedAttendanceStatus = new Set(['present', 'absent', 'leave', 'half-day', 'weekly-off']);
const attendanceTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeAttendanceStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (allowedAttendanceStatus.has(raw)) return raw;
  return 'absent';
};

const normalizeAttendanceTime = (value) => {
  const raw = String(value || '').trim();
  return attendanceTimePattern.test(raw) ? raw : '';
};

const toMinutesFromTime = (value) => {
  const normalized = normalizeAttendanceTime(value);
  if (!normalized) return null;
  const [hours, mins] = normalized.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return (hours * 60) + mins;
};

const computeWorkingHours = ({ status, checkIn, checkOut }) => {
  if (status === 'absent' || status === 'weekly-off' || status === 'leave') return 0;
  const inMins = toMinutesFromTime(checkIn);
  const outMins = toMinutesFromTime(checkOut);
  if (inMins === null || outMins === null || outMins <= inMins) return 0;
  const rawHours = (outMins - inMins) / 60;
  const clampedHours = status === 'half-day' ? Math.min(rawHours, 4) : rawHours;
  return Number(clampedHours.toFixed(2));
};

const sanitizeAttendanceRecord = (raw = {}) => {
  const status = normalizeAttendanceStatus(raw.status);
  const defaultCheckIn = status === 'present' ? '09:00' : '';
  const defaultCheckOut = status === 'present' ? '17:00' : '';
  const checkIn = normalizeAttendanceTime(raw.checkIn || defaultCheckIn);
  const checkOut = normalizeAttendanceTime(raw.checkOut || defaultCheckOut);
  return {
    _id: String(raw._id || `ATT-${Date.now()}`),
    employeeId: String(raw.employeeId || '').trim(),
    employeeCode: String(raw.employeeCode || '').trim(),
    employeeName: String(raw.employeeName || '').trim(),
    date: String(raw.date || '').trim(),
    status,
    checkIn,
    checkOut,
    leaveType: String(raw.leaveType || '').trim(),
    leaveReason: String(raw.leaveReason || '').trim(),
    notes: String(raw.notes || '').trim(),
    workingHours: computeWorkingHours({ status, checkIn, checkOut }),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
};

app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

app.post('/api/settings/save', (req, res) => {
  const current = readSettings();
  const next = sanitizeSettings({
    ...current,
    ...(req.body || {})
  });
  fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2));
  res.json({ message: 'Saved', settings: next });
});

app.post('/api/settings/upload-dashboard-image', upload.single('dashboardImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ imageUrl: `${SERVER_ORIGIN}/uploads/${req.file.filename}` });
});

app.post('/api/settings/upload-branding-image', upload.single('brandingImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ imageUrl: `${SERVER_ORIGIN}/uploads/${req.file.filename}` });
});

app.post('/api/employees/upload-document', upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ fileUrl: `${SERVER_ORIGIN}/uploads/${req.file.filename}` });
});

app.get('/api/leads', (req, res) => {
  res.json(readJsonFile(leadsFile, []));
});

app.post('/api/leads', (req, res) => {
  const leads = readJsonFile(leadsFile, []);
  const newLead = { _id: Date.now().toString(), ...req.body, date: new Date().toISOString() };
  leads.push(newLead);
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
  res.json(newLead);
});

app.post('/api/maps/geocode', async (req, res) => {
  const address = String(req.body?.address || '').trim();
  const lat = String(req.body?.lat || '').trim();
  const lng = String(req.body?.lng || '').trim();
  const mapsApiKey = String(
    process.env.GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_GEOCODING_API_KEY
    || process.env.VITE_GOOGLE_MAPS_API_KEY
    || ''
  ).trim();

  if ((!address) && (!lat || !lng)) {
    res.status(400).json({ error: 'Address or coordinates are required.' });
    return;
  }

  const buildGoogleLikeResultFromOsm = (payload = {}) => {
    const osmAddress = payload.address || {};
    const formatted = String(payload.display_name || '').trim();
    const latNum = Number(payload.lat || payload.latitude || 0);
    const lngNum = Number(payload.lon || payload.longitude || 0);
    const components = [];
    const pushPart = (value, types = []) => {
      const text = String(value || '').trim();
      if (!text) return;
      components.push({ long_name: text, short_name: text, types });
    };

    pushPart(osmAddress.suburb || osmAddress.neighbourhood || osmAddress.residential || osmAddress.road, ['sublocality_level_1', 'sublocality']);
    pushPart(osmAddress.city || osmAddress.town || osmAddress.village || osmAddress.hamlet || osmAddress.county, ['locality', 'political']);
    pushPart(osmAddress.state, ['administrative_area_level_1', 'political']);
    pushPart(osmAddress.postcode, ['postal_code']);

    return {
      formatted_address: formatted || [osmAddress.road, osmAddress.city || osmAddress.town || osmAddress.village, osmAddress.state, osmAddress.postcode].filter(Boolean).join(', '),
      address_components: components,
      geometry: { location: { lat: Number.isFinite(latNum) ? latNum : 0, lng: Number.isFinite(lngNum) ? lngNum : 0 } }
    };
  };

  let googleError = '';
  try {
    if (mapsApiKey) {
      const googleEndpoint = lat && lng
        ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${mapsApiKey}`
        : `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`;
      const response = await fetch(googleEndpoint);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          res.json({ result: data.results[0] });
          return;
        }
        googleError = data.error_message || `No location found (${data.status || 'UNKNOWN'})`;
      } else {
        googleError = `Google Maps request failed (${response.status}).`;
      }
    }
  } catch (error) {
    googleError = error?.message || 'Google Maps lookup failed';
  }

  try {
    const osmEndpoint = lat && lng
      ? `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`
      : `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
    const osmResponse = await fetch(osmEndpoint, {
      headers: {
        'User-Agent': 'SKUAS-ERP/1.0 (support@skuaspestcontrol.com)'
      }
    });

    if (!osmResponse.ok) {
      throw new Error(`Fallback geocoding failed (${osmResponse.status})`);
    }

    const osmData = await osmResponse.json();
    const best = Array.isArray(osmData) ? osmData[0] : osmData;
    if (!best) {
      throw new Error('No location found');
    }

    res.json({ result: buildGoogleLikeResultFromOsm(best) });
  } catch (error) {
    res.status(400).json({ error: googleError || error?.message || 'Failed to fetch location from maps provider' });
  }
});

app.put('/api/leads/:id', (req, res) => {
  const leads = readJsonFile(leadsFile, []);
  const leadIndex = leads.findIndex((lead) => lead._id === req.params.id);

  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const updatedLead = {
    ...leads[leadIndex],
    ...req.body,
    _id: leads[leadIndex]._id
  };

  leads[leadIndex] = updatedLead;
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
  res.json(updatedLead);
});

app.delete('/api/leads/:id', (req, res) => {
  const leads = readJsonFile(leadsFile, []);
  const updatedLeads = leads.filter((lead) => lead._id !== req.params.id);

  if (updatedLeads.length === leads.length) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  fs.writeFileSync(leadsFile, JSON.stringify(updatedLeads, null, 2));
  res.json({ message: 'Lead deleted' });
});

app.get('/api/employees', (req, res) => {
  res.json(readJsonFile(employeesFile, []));
});

app.post('/api/employees', (req, res) => {
  const settings = readSettings();
  const employees = readJsonFile(employeesFile, []);
  const generated = buildNextEmployeeCode(settings, employees);
  const providedCode = normalizeSettingsText(req.body?.empCode || '');
  const empCode = providedCode || generated.employeeCode;
  const createdSeq = getEmployeeCodeSeq(empCode, generated.prefix);
  const nextSettings = sanitizeSettings({
    ...settings,
    employeeCodePrefix: generated.prefix,
    employeeCodePadding: generated.padding,
    employeeCodeNextNumber: Math.max(generated.next + 1, (Number(settings.employeeCodeNextNumber) || 1), Number.isFinite(createdSeq) ? createdSeq + 1 : generated.next + 1)
  });
  const newEmp = { _id: Date.now().toString(), ...req.body, empCode };
  employees.push(newEmp);
  fs.writeFileSync(employeesFile, JSON.stringify(employees, null, 2));
  fs.writeFileSync(settingsFile, JSON.stringify(nextSettings, null, 2));
  res.json(newEmp);
});

app.put('/api/employees/:id', (req, res) => {
  const employees = readJsonFile(employeesFile, []);
  const employeeIndex = employees.findIndex((employee) => employee._id === req.params.id);

  if (employeeIndex === -1) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const updatedEmployee = {
    ...employees[employeeIndex],
    ...req.body,
    _id: employees[employeeIndex]._id
  };

  employees[employeeIndex] = updatedEmployee;
  fs.writeFileSync(employeesFile, JSON.stringify(employees, null, 2));
  res.json(updatedEmployee);
});

app.delete('/api/employees/:id', (req, res) => {
  const employees = readJsonFile(employeesFile, []);
  const updatedEmployees = employees.filter((employee) => employee._id !== req.params.id);

  if (updatedEmployees.length === employees.length) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  fs.writeFileSync(employeesFile, JSON.stringify(updatedEmployees, null, 2));
  res.json({ message: 'Employee deleted' });
});

app.get('/api/attendance', (req, res) => {
  const records = readJsonFile(attendanceFile, [])
    .map((entry) => sanitizeAttendanceRecord(entry))
    .filter((entry) => entry.employeeId && entry.date);
  const dateFilter = String(req.query.date || '').trim();
  const employeeFilter = String(req.query.employeeId || '').trim();
  const filtered = records.filter((entry) => {
    if (dateFilter && entry.date !== dateFilter) return false;
    if (employeeFilter && entry.employeeId !== employeeFilter) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.employeeName.localeCompare(b.employeeName);
  });
  res.json(filtered);
});

app.post('/api/attendance', (req, res) => {
  const employees = readJsonFile(employeesFile, []);
  const employeeId = String(req.body?.employeeId || '').trim();
  const date = String(req.body?.date || '').trim();
  if (!employeeId || !date) {
    return res.status(400).json({ error: 'employeeId and date are required' });
  }

  const employee = employees.find((entry) => String(entry?._id || '').trim() === employeeId);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee';
  const nextRecord = sanitizeAttendanceRecord({
    _id: req.body?._id || `ATT-${Date.now()}`,
    employeeId,
    employeeCode: employee.empCode || '',
    employeeName,
    date,
    status: req.body?.status,
    checkIn: req.body?.checkIn,
    checkOut: req.body?.checkOut,
    leaveType: req.body?.leaveType,
    leaveReason: req.body?.leaveReason,
    notes: req.body?.notes,
    updatedAt: new Date().toISOString()
  });

  const records = readJsonFile(attendanceFile, []);
  const recordIndex = records.findIndex((entry) => String(entry.employeeId) === employeeId && String(entry.date) === date);
  if (recordIndex === -1) {
    records.push(nextRecord);
  } else {
    const existingRecord = sanitizeAttendanceRecord(records[recordIndex]);
    records[recordIndex] = {
      ...existingRecord,
      ...nextRecord,
      _id: existingRecord._id || nextRecord._id
    };
  }

  fs.writeFileSync(attendanceFile, JSON.stringify(records, null, 2));
  res.json(nextRecord);
});

app.get('/api/jobs', (req, res) => {
  const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
  const jobs = readJsonFile(jobsFile, []);
  if (includeInactive) {
    res.json(jobs);
    return;
  }

  const filtered = jobs.filter((job) => {
    const status = String(job?.status || '').trim().toLowerCase();
    if (job?.isDeleted || job?.deletedAt) return false;
    return !['completed', 'deleted', 'cancelled', 'canceled', 'archived', 'closed'].includes(status);
  });

  res.json(filtered);
});

app.post('/api/jobs', (req, res) => {
  const settings = readSettings();
  const jobs = readJsonFile(jobsFile, []);
  const generatedJobNumber = createNextJobNumber(jobs, settings);
  const providedJobNumber = normalizeSettingsText(req.body?.jobNumber || '');
  const jobNumber = providedJobNumber || generatedJobNumber;
  const newJob = {
    _id: `JOB-${Date.now()}`,
    ...req.body,
    jobNumber,
    status: req.body.status || 'Scheduled',
    createdAt: new Date().toISOString()
  };

  jobs.push(newJob);
  fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
  updateSettingsNextJobNumber(jobNumber, settings);
  res.json(newJob);
});

app.put('/api/jobs/:id', (req, res) => {
  const jobs = readJsonFile(jobsFile, []);
  const jobIndex = jobs.findIndex((job) => job._id === req.params.id);

  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const updatedJob = {
    ...jobs[jobIndex],
    ...req.body,
    _id: jobs[jobIndex]._id
  };

  jobs[jobIndex] = updatedJob;

  // If one duplicate assignment is completed, close all matching duplicates
  // so stale "In Progress/Scheduled" rows for the same visit don't remain visible.
  const nextStatus = String(req.body?.status || '').trim().toLowerCase();
  if (nextStatus === 'completed') {
    const scheduleKey = String(updatedJob.scheduleKey || '').trim();
    const technicianId = String(updatedJob.technicianId || '').trim();
    const completionPatch = {
      status: 'Completed',
      punchInTime: req.body?.punchInTime ?? updatedJob.punchInTime,
      punchOutTime: req.body?.punchOutTime ?? updatedJob.punchOutTime,
      beforePhoto: req.body?.beforePhoto ?? updatedJob.beforePhoto,
      afterPhoto: req.body?.afterPhoto ?? updatedJob.afterPhoto,
      customerSignature: req.body?.customerSignature ?? updatedJob.customerSignature,
      completionCardNumber: req.body?.completionCardNumber ?? updatedJob.completionCardNumber,
      completionCardGeneratedAt: req.body?.completionCardGeneratedAt ?? updatedJob.completionCardGeneratedAt
    };

    jobs.forEach((job, index) => {
      if (index === jobIndex) return;
      if (String(job.status || '').trim().toLowerCase() === 'completed') return;
      const jobScheduleKey = String(job.scheduleKey || '').trim();
      const jobTechnicianId = String(job.technicianId || '').trim();
      if (!scheduleKey || !technicianId) return;
      if (jobScheduleKey === scheduleKey && jobTechnicianId === technicianId) {
        jobs[index] = {
          ...job,
          ...completionPatch,
          _id: job._id
        };
      }
    });
  }

  fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
  res.json(updatedJob);
});

app.get('/api/jobs/:id/pdf', async (req, res) => {
  try {
    const jobs = readJsonFile(jobsFile, []);
    const job = jobs.find((entry) => String(entry?._id || '') === String(req.params.id || ''));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const settings = readSettings();
    const pdfBuffer = await buildJobPdfBuffer({ job, settings });
    const asAttachment = String(req.query.download || '').trim() === '1';
    const fileNameBase = String(job.jobNumber || job._id || `JOB_${Date.now()}`).replace(/[^\w.-]+/g, '_');
    const fileName = `${fileNameBase}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${asAttachment ? 'attachment' : 'inline'}; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Failed to generate job PDF:', error.message);
    res.status(500).json({ error: 'Could not generate job PDF' });
  }
});

app.get('/api/contracts/:invoiceId/job-card-pdf', async (req, res) => {
  try {
    const invoices = readJsonFile(invoicesFile, []);
    const jobs = readJsonFile(jobsFile, []);
    const invoice = invoices.find((entry) => String(entry?._id || '') === String(req.params.invoiceId || ''));
    if (!invoice) return res.status(404).json({ error: 'Contract not found' });

    const contractNumber = String(invoice.invoiceNumber || '').trim().toLowerCase();
    const relatedJobs = jobs.filter((entry) => (
      String(entry?.contractId || '') === String(invoice._id || '')
      || String(entry?.contractNumber || '').trim().toLowerCase() === contractNumber
    ));
    const settings = readSettings();
    const pdfBuffer = await buildContractJobCardPdfBuffer({ invoice, jobs: relatedJobs, settings });
    const fileName = `${String(invoice.invoiceNumber || invoice._id || 'contract').replace(/[^\w.-]+/g, '_')}_job_card.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=\"${fileName}\"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Failed to generate contract job card PDF:', error.message);
    res.status(500).json({ error: 'Could not generate contract job card PDF' });
  }
});

app.get('/api/complaints', (req, res) => {
  res.json(readJsonFile(complaintsFile, []));
});

app.post('/api/complaints', (req, res) => {
  const records = readJsonFile(complaintsFile, []);
  const next = {
    _id: `CMP-${Date.now()}`,
    ticketNumber: `CMP-${records.length + 1}`,
    customerId: String(req.body.customerId || ''),
    customerName: String(req.body.customerName || ''),
    mobileNumber: String(req.body.mobileNumber || ''),
    property: String(req.body.property || ''),
    contractId: String(req.body.contractId || ''),
    contractNumber: String(req.body.contractNumber || ''),
    type: String(req.body.type || 'Service Issue'),
    priority: String(req.body.priority || 'Normal'),
    status: String(req.body.status || 'Open'),
    subject: String(req.body.subject || ''),
    description: String(req.body.description || ''),
    reportedBy: String(req.body.reportedBy || ''),
    reportedVia: String(req.body.reportedVia || ''),
    dueDate: String(req.body.dueDate || ''),
    technicians: Array.isArray(req.body.technicians) ? req.body.technicians.map((entry) => String(entry || '')).filter(Boolean) : [],
    technicianNames: Array.isArray(req.body.technicianNames) ? req.body.technicianNames.map((entry) => String(entry || '')).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  records.unshift(next);
  fs.writeFileSync(complaintsFile, JSON.stringify(records, null, 2));
  res.status(201).json(next);
});

app.get('/api/items', (req, res) => {
  res.json(readJsonFile(itemsFile, []));
});

app.post('/api/items', (req, res) => {
  const items = readJsonFile(itemsFile, []);
  const isServiceItem = String(req.body.itemType || 'service').toLowerCase() === 'service';
  const newItem = {
    _id: `ITEM-${Date.now()}`,
    name: req.body.name || '',
    itemType: req.body.itemType || 'service',
    treatmentMethod: isServiceItem ? (req.body.treatmentMethod || '') : '',
    pestsCovered: isServiceItem ? (req.body.pestsCovered || '') : '',
    serviceDescription: isServiceItem ? (req.body.serviceDescription || '') : '',
    unit: req.body.unit || '',
    sac: req.body.sac || '',
    taxPreference: req.body.taxPreference || 'Taxable',
    sellable: req.body.sellable !== false,
    purchasable: req.body.purchasable !== false,
    salesAccount: req.body.salesAccount || 'Sales',
    purchaseAccount: req.body.purchaseAccount || 'Cost of Goods Sold',
    preferredVendor: req.body.preferredVendor || '',
    salesDescription: req.body.salesDescription || '',
    purchaseInfoDescription: req.body.purchaseInfoDescription || '',
    intraTaxRate: req.body.intraTaxRate || '18%',
    interTaxRate: req.body.interTaxRate || '18%',
    purchaseDescription: req.body.purchaseDescription || '',
    purchaseRate: Number(req.body.purchaseRate || 0),
    description: req.body.description || '',
    rate: Number(req.body.rate || 0),
    hsnSac: req.body.hsnSac || '',
    createdAt: new Date().toISOString()
  };

  items.push(newItem);
  fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2));
  res.json(newItem);
});

app.put('/api/items/:id', (req, res) => {
  const items = readJsonFile(itemsFile, []);
  const itemIndex = items.findIndex((item) => item._id === req.params.id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const updatedItem = {
    ...items[itemIndex],
    ...req.body,
    _id: items[itemIndex]._id
  };

  items[itemIndex] = updatedItem;
  fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2));
  res.json(updatedItem);
});

app.delete('/api/items/:id', (req, res) => {
  const items = readJsonFile(itemsFile, []);
  const updatedItems = items.filter((item) => item._id !== req.params.id);

  if (updatedItems.length === items.length) {
    return res.status(404).json({ error: 'Item not found' });
  }

  fs.writeFileSync(itemsFile, JSON.stringify(updatedItems, null, 2));
  res.json({ message: 'Item deleted' });
});

app.get('/api/customers', (req, res) => {
  res.json(readJsonFile(customersFile, []));
});

app.post('/api/customers', (req, res) => {
  const customers = readJsonFile(customersFile, []);
  const positionValue = req.body.position === 'Edit type'
    ? (req.body.positionCustom || '').trim() || 'Edit type'
    : (req.body.position || '');
  const emailValue = req.body.emailId || req.body.email || '';
  const mobileValue = req.body.mobileNumber || req.body.workPhone || '';
  const billingStateValue = req.body.billingState || req.body.state || req.body.placeOfSupply || '';
  const hasGstValue = !!req.body.hasGst || !!req.body.gstRegistered;
  const displayNameValue =
    (req.body.displayName || '').trim() ||
    req.body.contactPersonName ||
    req.body.companyName ||
    req.body.name ||
    '';
  const newCustomer = {
    _id: `CUST-${Date.now()}`,
    name: displayNameValue,
    displayName: displayNameValue,
    segment: req.body.segment || 'Residential',
    companyName: req.body.companyName || req.body.name || '',
    contactPersonName: req.body.contactPersonName || req.body.name || '',
    position: positionValue,
    positionCustom: req.body.positionCustom || '',
    mobileNumber: mobileValue,
    whatsappNumber: req.body.whatsappNumber || mobileValue,
    altNumber: req.body.altNumber || '',
    emailId: emailValue,
    email: emailValue,
    hasGst: hasGstValue,
    gstRegistered: hasGstValue,
    gstNumber: hasGstValue ? (req.body.gstNumber || '') : '',
    billingAddress: req.body.billingAddress || '',
    billingArea: req.body.billingArea || req.body.area || '',
    billingState: billingStateValue,
    billingPincode: req.body.billingPincode || req.body.pincode || '',
    shippingAddress: req.body.shippingAddress || '',
    shippingArea: req.body.shippingArea || '',
    shippingState: req.body.shippingState || '',
    shippingPincode: req.body.shippingPincode || '',
    area: req.body.area || '',
    state: billingStateValue,
    pincode: req.body.pincode || '',
    areaSqft: Number(req.body.areaSqft || 0),
    workPhone: mobileValue,
    placeOfSupply: billingStateValue,
    receivables: Number(req.body.receivables || 0),
    unusedCredits: Number(req.body.unusedCredits || 0),
    createdAt: new Date().toISOString()
  };

  customers.push(newCustomer);
  fs.writeFileSync(customersFile, JSON.stringify(customers, null, 2));
  res.json(newCustomer);
});

app.put('/api/customers/:id', (req, res) => {
  const customers = readJsonFile(customersFile, []);
  const customerIndex = customers.findIndex((customer) => customer._id === req.params.id);

  if (customerIndex === -1) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const updatedCustomer = {
    ...customers[customerIndex],
    ...req.body,
    _id: customers[customerIndex]._id,
    displayName:
      (req.body.displayName || '').trim() ||
      req.body.contactPersonName ||
      req.body.companyName ||
      req.body.name ||
      customers[customerIndex].displayName ||
      customers[customerIndex].name ||
      '',
    name:
      (req.body.displayName || '').trim() ||
      req.body.contactPersonName ||
      req.body.companyName ||
      req.body.name ||
      customers[customerIndex].name ||
      '',
    position:
      req.body.position === 'Edit type'
        ? (req.body.positionCustom || '').trim() || 'Edit type'
        : (req.body.position ?? customers[customerIndex].position ?? ''),
    emailId: req.body.emailId ?? req.body.email ?? customers[customerIndex].emailId ?? customers[customerIndex].email ?? '',
    email: req.body.emailId ?? req.body.email ?? customers[customerIndex].email ?? customers[customerIndex].emailId ?? '',
    mobileNumber: req.body.mobileNumber ?? req.body.workPhone ?? customers[customerIndex].mobileNumber ?? customers[customerIndex].workPhone ?? '',
    workPhone: req.body.mobileNumber ?? req.body.workPhone ?? customers[customerIndex].workPhone ?? customers[customerIndex].mobileNumber ?? '',
    billingArea: req.body.billingArea ?? req.body.area ?? customers[customerIndex].billingArea ?? customers[customerIndex].area ?? '',
    billingState: req.body.billingState ?? req.body.state ?? req.body.placeOfSupply ?? customers[customerIndex].billingState ?? customers[customerIndex].state ?? customers[customerIndex].placeOfSupply ?? '',
    billingPincode: req.body.billingPincode ?? req.body.pincode ?? customers[customerIndex].billingPincode ?? customers[customerIndex].pincode ?? '',
    shippingArea: req.body.shippingArea ?? customers[customerIndex].shippingArea ?? '',
    shippingState: req.body.shippingState ?? customers[customerIndex].shippingState ?? '',
    shippingPincode: req.body.shippingPincode ?? customers[customerIndex].shippingPincode ?? '',
    state: req.body.billingState ?? req.body.state ?? req.body.placeOfSupply ?? customers[customerIndex].state ?? customers[customerIndex].placeOfSupply ?? '',
    placeOfSupply: req.body.billingState ?? req.body.state ?? req.body.placeOfSupply ?? customers[customerIndex].placeOfSupply ?? customers[customerIndex].state ?? '',
    hasGst: req.body.hasGst ?? req.body.gstRegistered ?? customers[customerIndex].hasGst ?? customers[customerIndex].gstRegistered ?? false,
    gstRegistered: req.body.hasGst ?? req.body.gstRegistered ?? customers[customerIndex].gstRegistered ?? customers[customerIndex].hasGst ?? false,
    gstNumber:
      (req.body.hasGst ?? req.body.gstRegistered ?? customers[customerIndex].hasGst ?? customers[customerIndex].gstRegistered)
        ? (req.body.gstNumber ?? customers[customerIndex].gstNumber ?? '')
        : '',
    areaSqft: Number(req.body.areaSqft ?? customers[customerIndex].areaSqft ?? 0),
    receivables: Number(req.body.receivables ?? customers[customerIndex].receivables ?? 0),
    unusedCredits: Number(req.body.unusedCredits ?? customers[customerIndex].unusedCredits ?? 0)
  };

  customers[customerIndex] = updatedCustomer;
  fs.writeFileSync(customersFile, JSON.stringify(customers, null, 2));
  res.json(updatedCustomer);
});

app.delete('/api/customers/:id', (req, res) => {
  const customers = readJsonFile(customersFile, []);
  const updatedCustomers = customers.filter((customer) => customer._id !== req.params.id);

  if (updatedCustomers.length === customers.length) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  fs.writeFileSync(customersFile, JSON.stringify(updatedCustomers, null, 2));
  res.json({ message: 'Customer deleted' });
});

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizePaymentSplits = (rawSplits) => {
  if (!Array.isArray(rawSplits)) return [];
  return rawSplits.map((split) => ({
    mode: split?.mode || 'Cheque',
    depositTo: split?.depositTo || 'Billing',
    amount: toNumber(split?.amount, 0)
  }));
};

const serviceFrequencyConfig = {
  single_followup_7: { type: 'followup_days', value: 7 },
  single_followup_10: { type: 'followup_days', value: 10 },
  weekly: { type: 'interval_days', value: 7 },
  fortnightly: { type: 'interval_days', value: 14 },
  monthly: { type: 'interval_months', value: 1 },
  bi_monthly: { type: 'interval_months', value: 2 },
  quarterly_visits: { type: 'interval_months', value: 3 },
  three_treatment_every_4_months: { type: 'interval_months', value: 4 }
};

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

const buildContractEndDate = (contractStartDate, contractPeriod) => {
  const cfg = contractPeriodConfig[contractPeriod];
  const start = parseDateOnly(contractStartDate);
  if (!cfg || !start) return '';

  let end = new Date(start);
  if (cfg.unit === 'days') {
    end.setDate(end.getDate() + cfg.value - 1);
  } else {
    end = addMonthsClamped(start, cfg.value);
    end.setDate(end.getDate() - 1);
  }
  return formatDateInput(end);
};

const normalizeServiceScheduleTime = (value, fallback = '10:00') => {
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

  if (cfg.type === 'followup_days') {
    const dates = [formatDateInput(start)];
    const followup = new Date(start);
    followup.setDate(followup.getDate() + cfg.value);
    if (followup <= end) dates.push(formatDateInput(followup));
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

const normalizeServiceSchedules = (rawSchedules, defaultTime = '10:00') => {
  if (!Array.isArray(rawSchedules)) return [];
  return rawSchedules
    .map((schedule, index) => ({
      serviceNumber: Number.isFinite(Number(schedule?.serviceNumber)) && Number(schedule?.serviceNumber) > 0
        ? Number(schedule.serviceNumber)
        : index + 1,
      serviceDate: String(schedule?.serviceDate || '').slice(0, 10),
      serviceTime: normalizeServiceScheduleTime(schedule?.serviceTime, defaultTime),
      itemId: schedule?.itemId || '',
      itemName: schedule?.itemName || '',
      itemDescription: schedule?.itemDescription || '',
      status: schedule?.status || 'Scheduled'
    }))
    .filter((schedule) => parseDateOnly(schedule.serviceDate));
};

const buildServiceScheduleEntries = (invoiceLike) => {
  const defaultTime = normalizeServiceScheduleTime(invoiceLike?.serviceScheduleDefaultTime, '10:00');
  const lines = Array.isArray(invoiceLike?.items) ? invoiceLike.items : [];
  const schedules = [];

  lines.forEach((line, lineIndex) => {
    const lineStartDate = line?.contractStartDate || line?.serviceStartDate || '';
    const lineEndDate =
      line?.contractEndDate ||
      line?.serviceEndDate ||
      buildContractEndDate(line?.contractStartDate || '', line?.contractPeriod || '');
    const baseDates = buildServiceDatesByFrequency(lineStartDate, lineEndDate, line?.serviceFrequency || '');
    if (baseDates.length === 0) return;

    const requestedServices = toNumber(line?.totalServices, 0);
    const dates = requestedServices > 0 ? baseDates.slice(0, requestedServices) : baseDates;

    dates.forEach((serviceDate, serviceIndex) => {
      schedules.push({
        serviceNumber: serviceIndex + 1,
        serviceDate,
        serviceTime: defaultTime,
        itemId: line?.itemId || '',
        itemName: line?.itemName || `Item ${lineIndex + 1}`,
        itemDescription: line?.description || '',
        status: 'Scheduled'
      });
    });
  });

  return schedules.sort((a, b) => {
    const aStamp = `${a.serviceDate || ''}T${a.serviceTime || '00:00'}`;
    const bStamp = `${b.serviceDate || ''}T${b.serviceTime || '00:00'}`;
    return aStamp.localeCompare(bStamp);
  });
};

const extractInvoiceSequence = (invoiceNumber, prefix = '') => {
  const raw = String(invoiceNumber || '').trim();
  if (!raw) return null;
  if (prefix && raw.startsWith(prefix)) {
    const suffix = raw.slice(prefix.length).match(/(\d+)$/);
    if (suffix) return Number(suffix[1]);
  }
  const match = raw.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
};

const createNextInvoiceNumber = (invoices, settings) => {
  const prefix = String(settings?.invoicePrefix ?? defaultSettings.invoicePrefix);
  const padding = Math.max(1, Number(settings?.invoiceNumberPadding ?? defaultSettings.invoiceNumberPadding) || defaultSettings.invoiceNumberPadding);
  const configuredNext = Math.max(1, Number(settings?.invoiceNextNumber ?? defaultSettings.invoiceNextNumber) || defaultSettings.invoiceNextNumber);
  const max = invoices.reduce((acc, invoice) => {
    const seq = extractInvoiceSequence(invoice.invoiceNumber, prefix);
    if (!Number.isFinite(seq)) return acc;
    return Math.max(acc, seq);
  }, 0);
  const next = Math.max(configuredNext, max + 1);
  return `${prefix}${String(next).padStart(padding, '0')}`;
};

const updateSettingsNextInvoiceNumber = (usedInvoiceNumber, settings) => {
  const seq = extractInvoiceSequence(usedInvoiceNumber, settings.invoicePrefix);
  if (!Number.isFinite(seq)) return;
  const nextValue = Math.max(1, Number(settings.invoiceNextNumber || defaultSettings.invoiceNextNumber));
  if (seq >= nextValue) {
    const updated = {
      ...settings,
      invoiceNextNumber: seq + 1
    };
    fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
  }
};

const sanitizeFileName = (value) => {
  const base = String(value || '').trim().replace(/[^\w.-]+/g, '_');
  return base || `invoice_${Date.now()}`;
};

const buildInvoicePdfFileName = (invoice) => {
  const invoiceNo = sanitizeFileName(invoice?.invoiceNumber || invoice?._id || `INV_${Date.now()}`);
  return `${invoiceNo}.pdf`;
};

const resolveInvoiceContext = (invoiceId) => {
  const invoices = readJsonFile(invoicesFile, []);
  const invoice = invoices.find((entry) => entry._id === invoiceId);
  if (!invoice) return null;

  const customers = readJsonFile(customersFile, []);
  const customer = customers.find((entry) =>
    (invoice.customerId && entry._id === invoice.customerId) ||
    String(entry.displayName || entry.name || '').trim().toLowerCase() === String(invoice.customerName || '').trim().toLowerCase()
  ) || null;

  return {
    invoice,
    customer,
    settings: readSettings()
  };
};

const normalizeWhatsappPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
};

const resolveEmailConfig = (settings = {}) => ({
  host: settings.smtpHost || process.env.SMTP_HOST || '',
  port: Math.max(1, Number(settings.smtpPort || process.env.SMTP_PORT || 587) || 587),
  secure: normalizeSmtpEncryption(
    settings.smtpEncryption,
    normalizeBoolean(settings.smtpSecure, normalizeBoolean(process.env.SMTP_SECURE, false)) ? 'SSL' : 'TLS'
  ) === 'SSL',
  active: normalizeYesNo(settings.smtpActive, 'Yes'),
  fromName: settings.smtpSenderName || settings.companyName || '',
  user: settings.smtpUser || process.env.SMTP_USER || '',
  pass: settings.smtpPass || process.env.SMTP_PASS || '',
  fromEmail: settings.smtpFromEmail || process.env.SMTP_FROM_EMAIL || settings.companyEmail || ''
});

const resolveWhatsappConfig = (settings = {}) => ({
  apiVersion: settings.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v23.0',
  phoneNumberId: settings.whatsappInstanceId || settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || ''
});

const buildDefaultShareMessage = (invoice, settings) => {
  const lines = [
    `${settings.companyName || 'Service Team'} Invoice`,
    `Invoice No: ${invoice.invoiceNumber || '-'}`,
    `Invoice Date: ${formatDate(invoice.date)}`,
    `Total Amount: ${formatINR(invoice.total || invoice.amount || 0)}`,
    `Balance Due: ${formatINR(invoice.balanceDue || 0)}`
  ];
  if (settings.companyWebsite) lines.push(`Website: ${settings.companyWebsite}`);
  if (settings.googleReviewLink) lines.push(`Google Review: ${settings.googleReviewLink}`);
  return lines.join('\n');
};

const renewalStatusOptions = new Set(['Upcoming', 'Contacted', 'Follow-up', 'Confirmed', 'Renewed', 'Lost']);
const renewalPaymentStatusOptions = new Set(['Pending', 'Paid', 'Partial']);
const renewalReminderChannels = new Set(['whatsapp', 'email', 'sms']);

const normalizeRenewalStatus = (value, fallback = 'Upcoming') => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'upcoming') return 'Upcoming';
  if (raw === 'contacted') return 'Contacted';
  if (raw === 'follow-up' || raw === 'followup') return 'Follow-up';
  if (raw === 'confirmed') return 'Confirmed';
  if (raw === 'renewed') return 'Renewed';
  if (raw === 'lost') return 'Lost';
  return renewalStatusOptions.has(fallback) ? fallback : 'Upcoming';
};

const normalizeRenewalPaymentStatus = (value, fallback = 'Pending') => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'pending') return 'Pending';
  if (raw === 'paid') return 'Paid';
  if (raw === 'partial') return 'Partial';
  return renewalPaymentStatusOptions.has(fallback) ? fallback : 'Pending';
};

const normalizeReminderChannelList = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const next = [];
  value.forEach((entry) => {
    const channel = String(entry || '').trim().toLowerCase();
    if (!renewalReminderChannels.has(channel) || seen.has(channel)) return;
    seen.add(channel);
    next.push(channel);
  });
  return next;
};

const toDateInputSafe = (value) => {
  const parsed = parseDateOnly(value);
  if (!parsed) return '';
  return formatDateInput(parsed);
};

const getExpiryBucket = (daysToExpiry) => {
  if (!Number.isFinite(daysToExpiry)) return 'later';
  if (daysToExpiry < 0) return 'expired';
  if (daysToExpiry === 0) return 'today';
  if (daysToExpiry <= 7) return '7_days';
  if (daysToExpiry <= 15) return '15_days';
  if (daysToExpiry <= 30) return '30_days';
  return 'later';
};

const deriveInvoiceContractWindow = (invoice) => {
  const lines = Array.isArray(invoice?.items) ? invoice.items : [];
  const startCandidates = [];
  const endCandidates = [];
  let firstServiceType = '';

  lines.forEach((line) => {
    if (!firstServiceType) firstServiceType = String(line?.itemName || line?.name || '').trim();
    if (line?.contractStartDate) startCandidates.push(line.contractStartDate);
    if (line?.serviceStartDate) startCandidates.push(line.serviceStartDate);
    if (line?.contractEndDate) endCandidates.push(line.contractEndDate);
    if (line?.serviceEndDate) endCandidates.push(line.serviceEndDate);
    if (line?.renewalDate) endCandidates.push(line.renewalDate);
    const builtEnd = buildContractEndDate(line?.contractStartDate || line?.serviceStartDate || '', line?.contractPeriod || '');
    if (builtEnd) endCandidates.push(builtEnd);
  });

  startCandidates.push(invoice?.servicePeriodStart, invoice?.date);
  endCandidates.push(invoice?.servicePeriodEnd, invoice?.dueDate);

  const starts = startCandidates.map(parseDateOnly).filter(Boolean);
  const ends = endCandidates.map(parseDateOnly).filter(Boolean);
  const startDate = starts.length > 0 ? new Date(Math.min(...starts.map((entry) => entry.getTime()))) : null;
  const endDate = ends.length > 0 ? new Date(Math.max(...ends.map((entry) => entry.getTime()))) : startDate;

  return {
    contractStartDate: startDate ? formatDateInput(startDate) : '',
    contractEndDate: endDate ? formatDateInput(endDate) : '',
    serviceType: firstServiceType || 'General Pest Control'
  };
};

const createRenewalRecordBase = (invoice) => ({
  _id: `REN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  invoiceId: String(invoice?._id || ''),
  invoiceNumber: String(invoice?.invoiceNumber || ''),
  customerId: String(invoice?.customerId || ''),
  customerName: String(invoice?.customerName || ''),
  status: 'Upcoming',
  followUpNotes: [],
  lostReason: '',
  reminderPlan: {
    autoEnabled: false,
    channels: [],
    nextReminderDate: ''
  },
  reminderLogs: [],
  quotation: null,
  convertedInvoiceId: '',
  technicianAssignments: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const normalizeFollowUpNotes = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      _id: String(entry?._id || `NOTE-${Date.now()}-${Math.floor(Math.random() * 10000)}`),
      note: String(entry?.note || '').trim(),
      createdAt: String(entry?.createdAt || new Date().toISOString()),
      createdBy: String(entry?.createdBy || 'System')
    }))
    .filter((entry) => entry.note);
};

const buildRenewalDataset = () => {
  const invoices = readJsonFile(invoicesFile, []);
  const customers = readJsonFile(customersFile, []);
  const jobs = readJsonFile(jobsFile, []);
  const payments = readJsonFile(paymentsFile, []);
  const storedRecords = readJsonFile(renewalsFile, []);
  const today = parseDateOnly(new Date());
  const customerById = new Map();
  const customerByName = new Map();

  customers.forEach((customer) => {
    const id = String(customer?._id || '').trim();
    const name = String(customer?.displayName || customer?.name || '').trim().toLowerCase();
    if (id) customerById.set(id, customer);
    if (name && !customerByName.has(name)) customerByName.set(name, customer);
  });

  const renewalByInvoiceId = new Map();
  storedRecords.forEach((entry) => {
    const invoiceId = String(entry?.invoiceId || '').trim();
    if (!invoiceId) return;
    renewalByInvoiceId.set(invoiceId, entry);
  });

  const list = invoices.map((invoice) => {
    const invoiceId = String(invoice?._id || '').trim();
    const customer = customerById.get(String(invoice?.customerId || '').trim())
      || customerByName.get(String(invoice?.customerName || '').trim().toLowerCase())
      || null;
    const window = deriveInvoiceContractWindow(invoice);
    const endDate = parseDateOnly(window.contractEndDate);
    const daysToExpiry = endDate && today
      ? Math.round((endDate.getTime() - today.getTime()) / 86400000)
      : Number.POSITIVE_INFINITY;
    const expiryBucket = getExpiryBucket(daysToExpiry);
    const totalAmount = toNumber(invoice?.total ?? invoice?.amount, 0);
    const balanceDue = toNumber(invoice?.balanceDue, totalAmount);
    const paidFromPayments = payments.reduce((sum, payment) => {
      if (String(payment?.invoiceId || '') !== invoiceId) return sum;
      return sum + toNumber(payment?.amount, 0);
    }, 0);
    const paidAmount = Math.max(0, Math.max(totalAmount - balanceDue, paidFromPayments));
    const paymentStatus = balanceDue <= 0 || paidAmount >= totalAmount
      ? 'Paid'
      : paidAmount > 0
        ? 'Partial'
        : 'Pending';

    const assignedTechMap = new Map();
    jobs.forEach((job) => {
      const sameInvoice = String(job?.contractId || '') === invoiceId
        || String(job?.contractNumber || '').trim().toLowerCase() === String(invoice?.invoiceNumber || '').trim().toLowerCase();
      if (!sameInvoice) return;
      const techName = String(job?.technicianName || '').trim();
      if (!techName) return;
      assignedTechMap.set(techName.toLowerCase(), techName);
    });
    const assignedTechnicians = Array.from(assignedTechMap.values());

    const stored = renewalByInvoiceId.get(invoiceId);
    const normalizedStoredStatus = normalizeRenewalStatus(
      stored?.status,
      String(invoice?.status || '').trim().toLowerCase().includes('renew')
        ? 'Renewed'
        : 'Upcoming'
    );
    const followUpNotes = normalizeFollowUpNotes(stored?.followUpNotes);
    const reminderLogs = Array.isArray(stored?.reminderLogs) ? stored.reminderLogs : [];
    const reminderPlan = stored?.reminderPlan && typeof stored.reminderPlan === 'object'
      ? {
          autoEnabled: Boolean(stored.reminderPlan.autoEnabled),
          channels: normalizeReminderChannelList(stored.reminderPlan.channels),
          nextReminderDate: toDateInputSafe(stored.reminderPlan.nextReminderDate)
        }
      : { autoEnabled: false, channels: [], nextReminderDate: '' };

    return {
      _id: String(stored?._id || `REN-VIRTUAL-${invoiceId}`),
      invoiceId,
      invoiceNumber: String(invoice?.invoiceNumber || ''),
      customerId: String(invoice?.customerId || ''),
      customerName: String(invoice?.customerName || customer?.displayName || customer?.name || ''),
      mobileNumber: String(customer?.mobileNumber || customer?.workPhone || ''),
      email: String(customer?.emailId || customer?.email || ''),
      whatsappNumber: String(customer?.whatsappNumber || customer?.mobileNumber || customer?.workPhone || ''),
      contractStartDate: window.contractStartDate,
      contractEndDate: window.contractEndDate,
      expiryBucket,
      daysToExpiry,
      serviceType: String(stored?.serviceType || window.serviceType || 'General Pest Control'),
      status: normalizedStoredStatus,
      paymentStatus: normalizeRenewalPaymentStatus(stored?.paymentStatus, paymentStatus),
      totalAmount: Number(totalAmount.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      balanceDue: Number(balanceDue.toFixed(2)),
      followUpNotes,
      lostReason: String(stored?.lostReason || '').trim(),
      reminderPlan,
      reminderLogs,
      quotation: stored?.quotation || null,
      convertedInvoiceId: String(stored?.convertedInvoiceId || ''),
      technicianAssignments: Array.isArray(stored?.technicianAssignments) && stored.technicianAssignments.length > 0
        ? stored.technicianAssignments
        : assignedTechnicians,
      lastReminderAt: String(stored?.lastReminderAt || ''),
      createdAt: String(stored?.createdAt || invoice?.createdAt || ''),
      updatedAt: String(stored?.updatedAt || invoice?.updatedAt || invoice?.createdAt || '')
    };
  });

  return { list, invoices, customers, jobs, payments, storedRecords };
};

const saveRenewalRecords = (records) => {
  fs.writeFileSync(renewalsFile, JSON.stringify(records, null, 2));
};

const appendFollowUpNote = (record, note, createdBy = 'System') => {
  const text = String(note || '').trim();
  if (!text) return record;
  const existing = normalizeFollowUpNotes(record?.followUpNotes);
  const next = [
    ...existing,
    {
      _id: `NOTE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      note: text,
      createdAt: new Date().toISOString(),
      createdBy: String(createdBy || 'System')
    }
  ];
  return {
    ...record,
    followUpNotes: next
  };
};

const readUserMeta = (req) => String(req?.body?.updatedBy || req?.headers?.['x-user-name'] || 'System');

app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const context = resolveInvoiceContext(req.params.id);
    if (!context) return res.status(404).json({ error: 'Invoice not found' });

    const pdfBuffer = await generateInvoicePdfBuffer(context);
    const fileName = buildInvoicePdfFileName(context.invoice);
    const asAttachment = String(req.query.download || '').trim() === '1';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${asAttachment ? 'attachment' : 'inline'}; filename=\"${fileName}\"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Failed to generate invoice PDF:', error.message);
    res.status(500).json({ error: 'Could not generate invoice PDF' });
  }
});

app.post('/api/invoices/:id/send-email', async (req, res) => {
  try {
    const context = resolveInvoiceContext(req.params.id);
    if (!context) return res.status(404).json({ error: 'Invoice not found' });

    const recipient = String(
      req.body?.to ||
      context.customer?.emailId ||
      context.customer?.email ||
      context.invoice?.customerEmail ||
      ''
    ).trim();

    if (!recipient) return res.status(400).json({ error: 'Recipient email is required' });

    const mailConfig = resolveEmailConfig(context.settings);
    if (mailConfig.active === 'No') {
      return res.status(400).json({
        error: 'Email sender is disabled in settings. Enable it before sending invoice emails.'
      });
    }
    if (!mailConfig.host || !mailConfig.user || !mailConfig.pass || !mailConfig.fromEmail) {
      return res.status(400).json({
        error: 'SMTP settings are incomplete. Configure host, user, pass and from email in Settings.'
      });
    }

    const pdfBuffer = await generateInvoicePdfBuffer(context);
    const fileName = buildInvoicePdfFileName(context.invoice);
    const defaultSubject = `Invoice ${context.invoice.invoiceNumber || ''}`.trim();
    const subject = String(req.body?.subject || defaultSubject || 'Invoice').trim();
    const message = String(req.body?.message || buildDefaultShareMessage(context.invoice, context.settings)).trim();

    const transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass
      }
    });

    const info = await transporter.sendMail({
      from: mailConfig.fromName
        ? `"${String(mailConfig.fromName).replace(/"/g, '\\"')}" <${mailConfig.fromEmail}>`
        : mailConfig.fromEmail,
      to: recipient,
      cc: String(req.body?.cc || '').trim() || undefined,
      bcc: String(req.body?.bcc || '').trim() || undefined,
      subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    res.json({
      message: 'Invoice email sent successfully',
      to: recipient,
      messageId: info.messageId || ''
    });
  } catch (error) {
    console.error('Failed to send invoice email:', error.message);
    res.status(500).json({ error: 'Could not send invoice email' });
  }
});

app.post('/api/invoices/:id/send-whatsapp', async (req, res) => {
  try {
    const context = resolveInvoiceContext(req.params.id);
    if (!context) return res.status(404).json({ error: 'Invoice not found' });

    const phoneRaw = String(
      req.body?.phoneNumber ||
      context.customer?.whatsappNumber ||
      context.customer?.mobileNumber ||
      context.customer?.workPhone ||
      ''
    ).trim();
    const phone = normalizeWhatsappPhone(phoneRaw);
    if (!phone) return res.status(400).json({ error: 'Valid WhatsApp phone number is required' });

    const waConfig = resolveWhatsappConfig(context.settings);
    if (!waConfig.phoneNumberId || !waConfig.accessToken) {
      return res.status(400).json({
        error: 'WhatsApp API settings are incomplete. Configure Phone Number ID and Access Token in Settings.'
      });
    }

    const graphBase = `https://graph.facebook.com/${waConfig.apiVersion}`;
    const pdfBuffer = await generateInvoicePdfBuffer(context);
    const fileName = buildInvoicePdfFileName(context.invoice);
    const defaultMessage = buildDefaultShareMessage(context.invoice, context.settings);
    const message = String(req.body?.message || defaultMessage).trim();

    const mediaForm = new FormData();
    mediaForm.append('messaging_product', 'whatsapp');
    mediaForm.append('type', 'application/pdf');
    mediaForm.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName);

    const uploadResponse = await fetch(`${graphBase}/${waConfig.phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${waConfig.accessToken}`
      },
      body: mediaForm
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('WhatsApp media upload failed:', errorText);
      return res.status(502).json({ error: 'Could not upload invoice PDF to WhatsApp API' });
    }

    const uploadJson = await uploadResponse.json();
    const mediaId = uploadJson?.id;
    if (!mediaId) return res.status(502).json({ error: 'WhatsApp media upload did not return media id' });

    const sendDocResponse = await fetch(`${graphBase}/${waConfig.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${waConfig.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'document',
        document: {
          id: mediaId,
          filename: fileName,
          caption: message.slice(0, 1024)
        }
      })
    });

    if (!sendDocResponse.ok) {
      const errorText = await sendDocResponse.text();
      console.error('WhatsApp document send failed:', errorText);
      return res.status(502).json({ error: 'Could not send invoice document to WhatsApp' });
    }

    const sendDocJson = await sendDocResponse.json();
    res.json({
      message: 'Invoice sent on WhatsApp successfully',
      phone,
      whatsappResponse: sendDocJson
    });
  } catch (error) {
    console.error('Failed to send invoice WhatsApp message:', error.message);
    res.status(500).json({ error: 'Could not send invoice on WhatsApp' });
  }
});

app.get('/api/invoices', (req, res) => {
  res.json(readJsonFile(invoicesFile, []));
});

app.post('/api/invoices', (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const settings = readSettings();
  const amount = toNumber(req.body.amount, 0);
  const paymentReceivedEnabled = Boolean(req.body.paymentReceivedEnabled);
  const paymentSplits = paymentReceivedEnabled ? normalizePaymentSplits(req.body.paymentSplits) : [];
  const fallbackPaymentReceivedTotal = paymentSplits.reduce((sum, split) => sum + toNumber(split.amount, 0), 0);
  const paymentReceivedTotal = paymentReceivedEnabled
    ? Number(toNumber(req.body.paymentReceivedTotal, fallbackPaymentReceivedTotal).toFixed(2))
    : 0;

  if (paymentReceivedEnabled && paymentReceivedTotal > amount + 0.0001) {
    return res.status(400).json({ error: 'Amount received cannot be more than invoice total amount.' });
  }

  const baseStatus = (req.body.status || 'DRAFT').toUpperCase();
  const status = paymentReceivedEnabled
    ? paymentReceivedTotal >= amount && amount > 0
      ? 'PAID'
      : paymentReceivedTotal > 0 || baseStatus === 'PAID'
        ? 'SENT'
        : baseStatus
    : baseStatus;
  const balanceDue = paymentReceivedEnabled
    ? Number(Math.max(amount - paymentReceivedTotal, 0).toFixed(2))
    : status === 'PAID'
      ? 0
      : toNumber(req.body.balanceDue, amount);
  const invoiceDate = req.body.date || new Date().toISOString().slice(0, 10);
  const dueDate = req.body.dueDate || invoiceDate;
  const serviceScheduleDefaultTime = normalizeServiceScheduleTime(req.body.serviceScheduleDefaultTime, '10:00');
  const manualServiceSchedules = normalizeServiceSchedules(req.body.serviceSchedules, serviceScheduleDefaultTime);
  const serviceSchedules = manualServiceSchedules.length > 0
    ? manualServiceSchedules
    : buildServiceScheduleEntries({ ...req.body, serviceScheduleDefaultTime });

  const newInvoice = {
    _id: `INV-${Date.now()}`,
    customerId: req.body.customerId || '',
    date: invoiceDate,
    invoiceNumber: req.body.invoiceNumber || createNextInvoiceNumber(invoices, settings),
    orderNumber: req.body.orderNumber || '',
    customerName: req.body.customerName || '',
    invoiceType: String(req.body.invoiceType || (toNumber(req.body.totalTax, 0) > 0 ? 'GST' : 'NON GST')).trim().toUpperCase() === 'NON GST' ? 'NON GST' : 'GST',
    billingAddressSource: req.body.billingAddressSource || 'billing',
    shippingAddressSource: req.body.shippingAddressSource || 'shipping',
    customShippingAddresses: Array.isArray(req.body.customShippingAddresses) ? req.body.customShippingAddresses : [],
    placeOfSupply: req.body.placeOfSupply || '',
    billingAddressText: req.body.billingAddressText || '',
    shippingAddressText: req.body.shippingAddressText || '',
    terms: req.body.terms || 'Paid',
    salesperson: req.body.salesperson || '',
    servicePeriod: req.body.servicePeriod || '',
    servicePeriodStart: req.body.servicePeriodStart || '',
    servicePeriodEnd: req.body.servicePeriodEnd || '',
    subject: req.body.subject || '',
    items: Array.isArray(req.body.items) ? req.body.items : [],
    subtotal: toNumber(req.body.subtotal, amount),
    totalTax: toNumber(req.body.totalTax, 0),
    withholdingType: req.body.withholdingType || 'TDS',
    withholdingRate: toNumber(req.body.withholdingRate, 0),
    withholdingAmount: toNumber(req.body.withholdingAmount, 0),
    roundOff: toNumber(req.body.roundOff, 0),
    total: toNumber(req.body.total, amount),
    customerNotes: req.body.customerNotes || '',
    termsAndConditions: req.body.termsAndConditions || '',
    serviceScheduleDefaultTime,
    serviceSchedules,
    paymentReceivedEnabled,
    paymentSplits,
    paymentReceivedTotal,
    attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    status,
    dueDate,
    amount,
    balanceDue,
    notes: req.body.notes || '',
    createdAt: new Date().toISOString()
  };

  invoices.push(newInvoice);
  fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);
  res.json(newInvoice);
});

app.put('/api/invoices/:id', (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const settings = readSettings();
  const invoiceIndex = invoices.findIndex((invoice) => invoice._id === req.params.id);

  if (invoiceIndex === -1) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const current = invoices[invoiceIndex];
  const amount = toNumber(req.body.amount ?? current.amount, 0);
  const paymentReceivedEnabled = req.body.paymentReceivedEnabled == null
    ? Boolean(current.paymentReceivedEnabled)
    : Boolean(req.body.paymentReceivedEnabled);
  const paymentSplitsSource = req.body.paymentSplits == null ? current.paymentSplits : req.body.paymentSplits;
  const paymentSplits = paymentReceivedEnabled ? normalizePaymentSplits(paymentSplitsSource) : [];
  const fallbackPaymentReceivedTotal = paymentSplits.reduce((sum, split) => sum + toNumber(split.amount, 0), 0);
  const paymentReceivedTotal = paymentReceivedEnabled
    ? Number(toNumber(req.body.paymentReceivedTotal, fallbackPaymentReceivedTotal).toFixed(2))
    : 0;

  if (paymentReceivedEnabled && paymentReceivedTotal > amount + 0.0001) {
    return res.status(400).json({ error: 'Amount received cannot be more than invoice total amount.' });
  }

  const baseStatus = (req.body.status || current.status || 'DRAFT').toUpperCase();
  const status = paymentReceivedEnabled
    ? paymentReceivedTotal >= amount && amount > 0
      ? 'PAID'
      : paymentReceivedTotal > 0 || baseStatus === 'PAID'
        ? 'SENT'
        : baseStatus
    : baseStatus;
  const nextBalanceDue = paymentReceivedEnabled
    ? Number(Math.max(amount - paymentReceivedTotal, 0).toFixed(2))
    : status === 'PAID'
      ? 0
      : toNumber(req.body.balanceDue ?? current.balanceDue, amount);
  const serviceScheduleDefaultTime = normalizeServiceScheduleTime(
    req.body.serviceScheduleDefaultTime ?? current.serviceScheduleDefaultTime,
    '10:00'
  );
  const manualServiceSchedules = req.body.serviceSchedules == null
    ? normalizeServiceSchedules(current.serviceSchedules, serviceScheduleDefaultTime)
    : normalizeServiceSchedules(req.body.serviceSchedules, serviceScheduleDefaultTime);
  const serviceSchedules = manualServiceSchedules.length > 0
    ? manualServiceSchedules
    : buildServiceScheduleEntries({ ...current, ...req.body, serviceScheduleDefaultTime });

  const updatedInvoice = {
    ...current,
    ...req.body,
    _id: current._id,
    date: req.body.date ?? current.date ?? new Date().toISOString().slice(0, 10),
    invoiceNumber: req.body.invoiceNumber ?? current.invoiceNumber ?? createNextInvoiceNumber(invoices, settings),
    orderNumber: req.body.orderNumber ?? current.orderNumber ?? '',
    customerName: req.body.customerName ?? current.customerName ?? '',
    invoiceType: String(req.body.invoiceType ?? current.invoiceType ?? ((toNumber(req.body.totalTax ?? current.totalTax, 0) > 0) ? 'GST' : 'NON GST')).trim().toUpperCase() === 'NON GST' ? 'NON GST' : 'GST',
    servicePeriodStart: req.body.servicePeriodStart ?? current.servicePeriodStart ?? '',
    servicePeriodEnd: req.body.servicePeriodEnd ?? current.servicePeriodEnd ?? '',
    serviceScheduleDefaultTime,
    serviceSchedules,
    status,
    dueDate: req.body.dueDate ?? current.dueDate ?? current.date,
    amount,
    balanceDue: nextBalanceDue,
    paymentReceivedEnabled,
    paymentSplits,
    paymentReceivedTotal,
    notes: req.body.notes ?? current.notes ?? ''
  };

  invoices[invoiceIndex] = updatedInvoice;
  fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  updateSettingsNextInvoiceNumber(updatedInvoice.invoiceNumber, settings);
  res.json(updatedInvoice);
});

app.delete('/api/invoices/:id', (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const updatedInvoices = invoices.filter((invoice) => invoice._id !== req.params.id);

  if (updatedInvoices.length === invoices.length) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  fs.writeFileSync(invoicesFile, JSON.stringify(updatedInvoices, null, 2));
  res.json({ message: 'Invoice deleted' });
});

app.get('/api/service-schedules', (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const schedules = invoices
    .flatMap((invoice) => {
      const defaultTime = normalizeServiceScheduleTime(invoice.serviceScheduleDefaultTime, '10:00');
      const savedSchedules = normalizeServiceSchedules(invoice.serviceSchedules, defaultTime);
      const sourceSchedules = savedSchedules.length > 0 ? savedSchedules : buildServiceScheduleEntries(invoice);

      return sourceSchedules.map((schedule, index) => ({
        _id: `${invoice._id}-${schedule.serviceDate}-${schedule.serviceNumber}-${index}`,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || '',
        customerId: invoice.customerId || '',
        customerName: invoice.customerName || '',
        serviceNumber: Number(schedule.serviceNumber || index + 1),
        serviceDate: schedule.serviceDate,
        serviceTime: normalizeServiceScheduleTime(schedule.serviceTime, defaultTime),
        itemId: schedule.itemId || '',
        itemName: schedule.itemName || '',
        itemDescription: schedule.itemDescription || '',
        status: schedule.status || 'Scheduled'
      }));
    })
    .filter((schedule) => parseDateOnly(schedule.serviceDate))
    .sort((a, b) => {
      const aStamp = `${a.serviceDate || ''}T${a.serviceTime || '00:00'}`;
      const bStamp = `${b.serviceDate || ''}T${b.serviceTime || '00:00'}`;
      if (aStamp === bStamp) {
        return String(a.customerName || '').localeCompare(String(b.customerName || ''));
      }
      return aStamp.localeCompare(bStamp);
    });

  res.json(schedules);
});

app.get('/api/payments', (req, res) => {
  res.json(readJsonFile(paymentsFile, []));
});

const recalculateInvoiceFromPayments = (invoice, payments) => {
  const invoiceAmount = toNumber(invoice?.amount, 0);
  const totalPaid = payments.reduce((sum, payment) => {
    if (payment?.invoiceId !== invoice?._id) return sum;
    return sum + toNumber(payment?.amount, 0);
  }, 0);
  const balanceDue = Number(Math.max(invoiceAmount - totalPaid, 0).toFixed(2));
  return {
    ...invoice,
    balanceDue,
    status: balanceDue === 0 ? 'PAID' : 'SENT'
  };
};

app.post('/api/payments', (req, res) => {
  const payments = readJsonFile(paymentsFile, []);
  const invoices = readJsonFile(invoicesFile, []);

  const invoice = invoices.find((entry) =>
    (req.body.invoiceId && entry._id === req.body.invoiceId) ||
    (req.body.invoiceNumber && entry.invoiceNumber === req.body.invoiceNumber)
  );

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found for payment' });
  }

  const paymentAmount = toNumber(req.body.amount, 0);
  const invoiceAmount = toNumber(invoice.amount, 0);
  const currentBalance = toNumber(invoice.balanceDue, invoiceAmount);

  if (paymentAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero' });
  }

  if (paymentAmount > currentBalance) {
    return res.status(400).json({ error: 'Payment amount cannot exceed invoice balance due' });
  }

  const nextBalance = Number((currentBalance - paymentAmount).toFixed(2));
  invoice.balanceDue = nextBalance;
  invoice.status = nextBalance === 0 ? 'PAID' : 'SENT';
  fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));

  const payment = {
    _id: `PAY-${Date.now()}`,
    paymentNumber: `RCPT-${Date.now().toString().slice(-6)}`,
    paymentDate: req.body.paymentDate || new Date().toISOString().slice(0, 10),
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber || '',
    customerName: invoice.customerName || req.body.customerName || '',
    amount: paymentAmount,
    previousBalance: currentBalance,
    balanceAfterPayment: nextBalance,
    mode: req.body.mode || 'Bank Transfer',
    reference: req.body.reference || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString()
  };

  payments.push(payment);
  fs.writeFileSync(paymentsFile, JSON.stringify(payments, null, 2));
  res.json({ payment, invoice });
});

app.delete('/api/payments/:id', (req, res) => {
  const payments = readJsonFile(paymentsFile, []);
  const invoices = readJsonFile(invoicesFile, []);
  const paymentIndex = payments.findIndex((entry) => entry._id === req.params.id);

  if (paymentIndex < 0) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  const [deletedPayment] = payments.splice(paymentIndex, 1);
  const invoiceIndex = invoices.findIndex((entry) => entry._id === deletedPayment.invoiceId);
  let updatedInvoice = null;

  if (invoiceIndex >= 0) {
    updatedInvoice = recalculateInvoiceFromPayments(invoices[invoiceIndex], payments);
    invoices[invoiceIndex] = updatedInvoice;
    fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  }

  fs.writeFileSync(paymentsFile, JSON.stringify(payments, null, 2));
  return res.json({ message: 'Payment deleted', payment: deletedPayment, invoice: updatedInvoice });
});

app.get('/api/renewals', (req, res) => {
  const { list } = buildRenewalDataset();
  const fromDate = parseDateOnly(req.query.from);
  const toDate = parseDateOnly(req.query.to);
  const customerQuery = String(req.query.customer || '').trim().toLowerCase();
  const serviceTypeQuery = String(req.query.serviceType || '').trim().toLowerCase();
  const technicianQuery = String(req.query.technician || '').trim().toLowerCase();
  const statusQuery = String(req.query.status || '').trim().toLowerCase();
  const paymentStatusQuery = String(req.query.paymentStatus || '').trim().toLowerCase();
  const bucketQuery = String(req.query.bucket || '').trim().toLowerCase();

  const filtered = list.filter((entry) => {
    const endDate = parseDateOnly(entry.contractEndDate);
    if (fromDate && endDate && endDate < fromDate) return false;
    if (toDate && endDate && endDate > toDate) return false;
    if (customerQuery) {
      const hay = `${entry.customerName || ''} ${entry.mobileNumber || ''}`.toLowerCase();
      if (!hay.includes(customerQuery)) return false;
    }
    if (serviceTypeQuery && !String(entry.serviceType || '').toLowerCase().includes(serviceTypeQuery)) return false;
    if (technicianQuery) {
      const joined = Array.isArray(entry.technicianAssignments) ? entry.technicianAssignments.join(' ').toLowerCase() : '';
      if (!joined.includes(technicianQuery)) return false;
    }
    if (statusQuery && statusQuery !== 'all' && String(entry.status || '').toLowerCase() !== statusQuery) return false;
    if (paymentStatusQuery && paymentStatusQuery !== 'all' && String(entry.paymentStatus || '').toLowerCase() !== paymentStatusQuery) return false;
    if (bucketQuery && bucketQuery !== 'all' && String(entry.expiryBucket || '').toLowerCase() !== bucketQuery) return false;
    return true;
  });

  res.json(filtered.sort((a, b) => {
    const aDate = String(a.contractEndDate || '');
    const bDate = String(b.contractEndDate || '');
    if (aDate === bDate) return String(a.customerName || '').localeCompare(String(b.customerName || ''));
    return aDate.localeCompare(bDate);
  }));
});

app.post('/api/renewals', (req, res) => {
  const invoiceId = String(req.body.invoiceId || '').trim();
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' });

  const invoices = readJsonFile(invoicesFile, []);
  const invoice = invoices.find((entry) => String(entry?._id || '') === invoiceId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found for renewal' });

  const records = readJsonFile(renewalsFile, []);
  const existingIndex = records.findIndex((entry) => String(entry?.invoiceId || '') === invoiceId);
  const nowIso = new Date().toISOString();
  const base = existingIndex >= 0 ? records[existingIndex] : createRenewalRecordBase(invoice);
  const nextStatus = normalizeRenewalStatus(req.body.status, base.status || 'Upcoming');
  const nextLostReason = String(req.body.lostReason || base.lostReason || '').trim();
  if (nextStatus === 'Lost' && !nextLostReason) {
    return res.status(400).json({ error: 'Lost reason is required when status is Lost' });
  }

  let nextRecord = {
    ...base,
    invoiceId,
    invoiceNumber: String(invoice.invoiceNumber || ''),
    customerId: String(invoice.customerId || ''),
    customerName: String(invoice.customerName || ''),
    serviceType: String(req.body.serviceType || base.serviceType || '').trim(),
    status: nextStatus,
    paymentStatus: normalizeRenewalPaymentStatus(req.body.paymentStatus, base.paymentStatus || 'Pending'),
    lostReason: nextStatus === 'Lost' ? nextLostReason : '',
    reminderPlan: {
      autoEnabled: Boolean(req.body.reminderPlan?.autoEnabled ?? base.reminderPlan?.autoEnabled),
      channels: normalizeReminderChannelList(req.body.reminderPlan?.channels ?? base.reminderPlan?.channels),
      nextReminderDate: toDateInputSafe(req.body.reminderPlan?.nextReminderDate ?? base.reminderPlan?.nextReminderDate)
    },
    quotation: req.body.quotation ?? base.quotation ?? null,
    technicianAssignments: Array.isArray(req.body.technicianAssignments) ? req.body.technicianAssignments : (base.technicianAssignments || []),
    updatedAt: nowIso
  };

  if (!base.createdAt) nextRecord.createdAt = nowIso;
  if (req.body.followUpNote) {
    nextRecord = appendFollowUpNote(nextRecord, req.body.followUpNote, readUserMeta(req));
  } else {
    nextRecord.followUpNotes = normalizeFollowUpNotes(nextRecord.followUpNotes);
  }

  if (!Array.isArray(nextRecord.reminderLogs)) nextRecord.reminderLogs = [];

  if (existingIndex >= 0) {
    records[existingIndex] = nextRecord;
  } else {
    records.push(nextRecord);
  }

  saveRenewalRecords(records);
  return res.json(nextRecord);
});

app.put('/api/renewals/:id', (req, res) => {
  const records = readJsonFile(renewalsFile, []);
  const recordIndex = records.findIndex((entry) => String(entry?._id || '') === String(req.params.id || ''));
  if (recordIndex < 0) return res.status(404).json({ error: 'Renewal not found' });

  const current = records[recordIndex];
  const nextStatus = normalizeRenewalStatus(req.body.status, current.status || 'Upcoming');
  const nextLostReason = String(req.body.lostReason ?? current.lostReason ?? '').trim();
  if (nextStatus === 'Lost' && !nextLostReason) {
    return res.status(400).json({ error: 'Lost reason is required when status is Lost' });
  }

  let updated = {
    ...current,
    ...req.body,
    _id: current._id,
    status: nextStatus,
    paymentStatus: normalizeRenewalPaymentStatus(req.body.paymentStatus ?? current.paymentStatus, current.paymentStatus || 'Pending'),
    lostReason: nextStatus === 'Lost' ? nextLostReason : '',
    reminderPlan: {
      autoEnabled: Boolean(req.body.reminderPlan?.autoEnabled ?? current.reminderPlan?.autoEnabled),
      channels: normalizeReminderChannelList(req.body.reminderPlan?.channels ?? current.reminderPlan?.channels),
      nextReminderDate: toDateInputSafe(req.body.reminderPlan?.nextReminderDate ?? current.reminderPlan?.nextReminderDate)
    },
    followUpNotes: normalizeFollowUpNotes(req.body.followUpNotes ?? current.followUpNotes),
    updatedAt: new Date().toISOString()
  };

  if (req.body.followUpNote) {
    updated = appendFollowUpNote(updated, req.body.followUpNote, readUserMeta(req));
  }

  records[recordIndex] = updated;
  saveRenewalRecords(records);
  return res.json(updated);
});

app.get('/api/renewals/:id/history', (req, res) => {
  const { list, invoices } = buildRenewalDataset();
  const renewal = list.find((entry) => String(entry._id) === String(req.params.id || ''));
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });

  const customerName = String(renewal.customerName || '').trim().toLowerCase();
  const customerId = String(renewal.customerId || '').trim();
  const history = invoices
    .filter((invoice) => {
      const sameById = customerId && String(invoice?.customerId || '') === customerId;
      const sameByName = String(invoice?.customerName || '').trim().toLowerCase() === customerName;
      return sameById || sameByName;
    })
    .map((invoice) => {
      const window = deriveInvoiceContractWindow(invoice);
      return {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || '',
        contractStartDate: window.contractStartDate,
        contractEndDate: window.contractEndDate,
        totalAmount: toNumber(invoice.total ?? invoice.amount, 0),
        balanceDue: toNumber(invoice.balanceDue, toNumber(invoice.total ?? invoice.amount, 0)),
        status: invoice.status || 'SENT',
        createdAt: invoice.createdAt || ''
      };
    })
    .sort((a, b) => String(b.contractEndDate || '').localeCompare(String(a.contractEndDate || '')));

  return res.json({
    renewal,
    history
  });
});

app.post('/api/renewals/:id/send-reminder', async (req, res) => {
  const records = readJsonFile(renewalsFile, []);
  const recordIndex = records.findIndex((entry) => String(entry?._id || '') === String(req.params.id || ''));
  if (recordIndex < 0) return res.status(404).json({ error: 'Renewal not found' });

  const record = records[recordIndex];
  const channel = String(req.body.channel || '').trim().toLowerCase();
  if (!renewalReminderChannels.has(channel)) {
    return res.status(400).json({ error: 'channel must be one of whatsapp, email, sms' });
  }

  const customers = readJsonFile(customersFile, []);
  const customer = customers.find((entry) =>
    String(entry?._id || '') === String(record.customerId || '')
    || String(entry?.displayName || entry?.name || '').trim().toLowerCase() === String(record.customerName || '').trim().toLowerCase()
  ) || null;
  const settings = readSettings();
  const defaultMessage = String(req.body.message || `Dear ${record.customerName || 'Customer'}, your pest-control contract is expiring on ${formatDate(record.contractEndDate)}. Please confirm renewal.`).trim();

  let recipient = '';
  if (channel === 'whatsapp') {
    recipient = normalizeWhatsappPhone(req.body.recipient || customer?.whatsappNumber || customer?.mobileNumber || customer?.workPhone || '');
    if (!recipient) return res.status(400).json({ error: 'Valid WhatsApp recipient is required' });
  } else if (channel === 'email') {
    recipient = String(req.body.recipient || customer?.emailId || customer?.email || '').trim();
    if (!recipient) return res.status(400).json({ error: 'Recipient email is required' });
  } else {
    recipient = String(req.body.recipient || customer?.mobileNumber || customer?.workPhone || '').replace(/\D/g, '');
    if (!recipient) return res.status(400).json({ error: 'SMS recipient mobile number is required' });
  }

  let deliveryStatus = 'queued';
  let deliveryError = '';

  try {
    if (channel === 'email') {
      const mailConfig = resolveEmailConfig(settings);
      if (mailConfig.active === 'Yes' && mailConfig.host && mailConfig.user && mailConfig.pass && mailConfig.fromEmail) {
        const transporter = nodemailer.createTransport({
          host: mailConfig.host,
          port: mailConfig.port,
          secure: mailConfig.secure,
          auth: { user: mailConfig.user, pass: mailConfig.pass }
        });
        await transporter.sendMail({
          from: mailConfig.fromName
            ? `"${String(mailConfig.fromName).replace(/"/g, '\\"')}" <${mailConfig.fromEmail}>`
            : mailConfig.fromEmail,
          to: recipient,
          subject: String(req.body.subject || `Renewal Reminder - ${record.invoiceNumber || 'Contract'}`),
          text: defaultMessage
        });
        deliveryStatus = 'sent';
      } else {
        deliveryStatus = 'queued';
      }
    } else if (channel === 'whatsapp') {
      const waConfig = resolveWhatsappConfig(settings);
      if (waConfig.phoneNumberId && waConfig.accessToken) {
        const response = await fetch(`https://graph.facebook.com/${waConfig.apiVersion}/${waConfig.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waConfig.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'text',
            text: { body: defaultMessage.slice(0, 4000) }
          })
        });
        deliveryStatus = response.ok ? 'sent' : 'queued';
      }
    }
  } catch (error) {
    deliveryStatus = 'failed';
    deliveryError = error?.message || 'delivery_error';
  }

  const log = {
    _id: `REM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    channel,
    recipient,
    message: defaultMessage,
    status: deliveryStatus,
    error: deliveryError,
    triggeredBy: readUserMeta(req),
    createdAt: new Date().toISOString()
  };

  const existingLogs = Array.isArray(record.reminderLogs) ? record.reminderLogs : [];
  records[recordIndex] = {
    ...record,
    reminderLogs: [...existingLogs, log],
    lastReminderAt: log.createdAt,
    updatedAt: log.createdAt
  };
  saveRenewalRecords(records);
  return res.json(log);
});

app.post('/api/renewals/:id/quotation', (req, res) => {
  const records = readJsonFile(renewalsFile, []);
  const recordIndex = records.findIndex((entry) => String(entry?._id || '') === String(req.params.id || ''));
  if (recordIndex < 0) return res.status(404).json({ error: 'Renewal not found' });

  const record = records[recordIndex];
  const amount = toNumber(req.body.amount, toNumber(record.totalAmount, 0));
  if (amount <= 0) return res.status(400).json({ error: 'Quotation amount must be greater than zero' });

  const quotation = {
    quoteNumber: String(req.body.quoteNumber || record?.quotation?.quoteNumber || `RQT-${Date.now().toString().slice(-6)}`),
    amount: Number(amount.toFixed(2)),
    validTill: toDateInputSafe(req.body.validTill || record?.quotation?.validTill || ''),
    terms: String(req.body.terms || record?.quotation?.terms || '').trim(),
    notes: String(req.body.notes || record?.quotation?.notes || '').trim(),
    generatedAt: new Date().toISOString()
  };

  records[recordIndex] = {
    ...record,
    quotation,
    status: normalizeRenewalStatus(req.body.status, record.status || 'Contacted'),
    updatedAt: new Date().toISOString()
  };
  saveRenewalRecords(records);
  return res.json(records[recordIndex]);
});

app.post('/api/renewals/:id/convert-invoice', (req, res) => {
  const records = readJsonFile(renewalsFile, []);
  const recordIndex = records.findIndex((entry) => String(entry?._id || '') === String(req.params.id || ''));
  if (recordIndex < 0) return res.status(404).json({ error: 'Renewal not found' });

  const renewal = records[recordIndex];
  const invoices = readJsonFile(invoicesFile, []);
  const sourceInvoice = invoices.find((entry) => String(entry?._id || '') === String(renewal.invoiceId || ''));
  if (!sourceInvoice) return res.status(404).json({ error: 'Source invoice not found for renewal' });

  const settings = readSettings();
  const nextDate = toDateInputSafe(req.body.date || new Date());
  const dueDate = toDateInputSafe(req.body.dueDate || nextDate);
  const nextStart = toDateInputSafe(req.body.servicePeriodStart || nextDate);
  const sourceEnd = parseDateOnly(renewal.contractEndDate || sourceInvoice.servicePeriodEnd || sourceInvoice.dueDate || nextDate);
  const defaultEnd = sourceEnd ? addMonthsClamped(sourceEnd, 12) : addMonthsClamped(parseDateOnly(nextStart) || new Date(), 12);
  const nextEnd = toDateInputSafe(req.body.servicePeriodEnd || defaultEnd);

  const sourceItems = Array.isArray(sourceInvoice.items) ? sourceInvoice.items : [];
  const items = sourceItems.map((line) => ({
    ...line,
    contractStartDate: nextStart,
    serviceStartDate: nextStart,
    contractEndDate: nextEnd,
    serviceEndDate: nextEnd,
    renewalDate: nextEnd
  }));

  const amount = toNumber(req.body.amount, toNumber(sourceInvoice.total ?? sourceInvoice.amount, 0));
  const paymentReceivedEnabled = Boolean(req.body.paymentReceivedEnabled);
  const paymentSplits = paymentReceivedEnabled ? normalizePaymentSplits(req.body.paymentSplits) : [];
  const paymentReceivedTotal = paymentReceivedEnabled
    ? Number(paymentSplits.reduce((sum, split) => sum + toNumber(split.amount, 0), 0).toFixed(2))
    : 0;
  const balanceDue = paymentReceivedEnabled ? Number(Math.max(amount - paymentReceivedTotal, 0).toFixed(2)) : amount;
  const status = balanceDue <= 0 ? 'PAID' : 'SENT';
  const serviceScheduleDefaultTime = normalizeServiceScheduleTime(req.body.serviceScheduleDefaultTime || sourceInvoice.serviceScheduleDefaultTime, '10:00');
  const serviceSchedules = buildServiceScheduleEntries({
    ...sourceInvoice,
    items,
    serviceScheduleDefaultTime
  });

  const newInvoice = {
    ...sourceInvoice,
    ...req.body,
    _id: `INV-${Date.now()}`,
    invoiceNumber: req.body.invoiceNumber || createNextInvoiceNumber(invoices, settings),
    date: nextDate,
    dueDate,
    servicePeriodStart: nextStart,
    servicePeriodEnd: nextEnd,
    items,
    amount,
    total: amount,
    balanceDue,
    status,
    paymentReceivedEnabled,
    paymentSplits,
    paymentReceivedTotal,
    serviceScheduleDefaultTime,
    serviceSchedules,
    createdAt: new Date().toISOString(),
    notes: String(req.body.notes || sourceInvoice.notes || '').trim()
  };

  invoices.push(newInvoice);
  fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);

  records[recordIndex] = {
    ...renewal,
    status: 'Renewed',
    convertedInvoiceId: newInvoice._id,
    updatedAt: new Date().toISOString()
  };
  saveRenewalRecords(records);
  return res.json({ renewal: records[recordIndex], invoice: newInvoice });
});

app.post('/api/renewals/:id/assign-technician', (req, res) => {
  const records = readJsonFile(renewalsFile, []);
  const recordIndex = records.findIndex((entry) => String(entry?._id || '') === String(req.params.id || ''));
  if (recordIndex < 0) return res.status(404).json({ error: 'Renewal not found' });

  const renewal = records[recordIndex];
  const invoices = readJsonFile(invoicesFile, []);
  const targetInvoiceId = renewal.convertedInvoiceId || renewal.invoiceId;
  const invoice = invoices.find((entry) => String(entry?._id || '') === String(targetInvoiceId || ''));
  if (!invoice) return res.status(404).json({ error: 'Renewal invoice not found for technician assignment' });

  const employees = readJsonFile(employeesFile, []);
  const technicianIds = Array.isArray(req.body.technicianIds) ? req.body.technicianIds.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
  if (technicianIds.length === 0) return res.status(400).json({ error: 'technicianIds is required' });

  const technicians = technicianIds
    .map((id) => employees.find((entry) => String(entry?._id || '') === id))
    .filter((entry) => entry && String(entry.role || '').trim().toLowerCase() === 'technician');

  if (technicians.length === 0) {
    return res.status(400).json({ error: 'No valid technicians found for assignment' });
  }

  const customers = readJsonFile(customersFile, []);
  const customer = customers.find((entry) =>
    String(entry?._id || '') === String(invoice.customerId || '')
    || String(entry?.displayName || entry?.name || '').trim().toLowerCase() === String(invoice.customerName || '').trim().toLowerCase()
  ) || null;

  const defaultTime = normalizeServiceScheduleTime(invoice.serviceScheduleDefaultTime, '10:00');
  const schedules = normalizeServiceSchedules(invoice.serviceSchedules, defaultTime);
  const sourceSchedules = schedules.length > 0 ? schedules : buildServiceScheduleEntries(invoice);
  const selectedScheduleKeys = Array.isArray(req.body.scheduleKeys) ? req.body.scheduleKeys.map((entry) => String(entry || '')) : [];
  const selectedRows = sourceSchedules
    .map((schedule, index) => ({
      key: `${invoice._id}-${index}-${schedule.serviceNumber || index + 1}`,
      schedule,
      visit: `#${schedule.serviceNumber || index + 1}`
    }))
    .filter((row) => selectedScheduleKeys.length === 0 || selectedScheduleKeys.includes(row.key));

  if (selectedRows.length === 0) {
    return res.status(400).json({ error: 'No service schedules found for assignment' });
  }

  const settings = readSettings();
  const jobs = readJsonFile(jobsFile, []);
  const createdJobs = [];
  selectedRows.forEach((row) => {
    technicians.forEach((tech) => {
      const generatedJobNumber = createNextJobNumber([...jobs, ...createdJobs], settings);
      const newJob = {
        _id: `JOB-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        jobNumber: generatedJobNumber,
        customerId: customer?._id || invoice.customerId || '',
        customerName: customer?.displayName || customer?.name || invoice.customerName || '',
        mobileNumber: customer?.mobileNumber || customer?.workPhone || '',
        address: customer?.billingAddress || customer?.shippingAddress || '',
        areaName: customer?.billingArea || customer?.area || '',
        city: customer?.city || customer?.billingState || customer?.state || '',
        state: customer?.billingState || customer?.state || '',
        pincode: customer?.billingPincode || customer?.pincode || '',
        contractId: invoice._id,
        contractNumber: invoice.invoiceNumber || '',
        priority: String(req.body.priority || 'Normal'),
        accessInstructions: String(req.body.accessInstructions || ''),
        latitude: String(req.body.latitude || ''),
        longitude: String(req.body.longitude || ''),
        notes: String(req.body.notes || ''),
        scheduleKey: row.key,
        scheduleVisit: row.visit,
        serviceName: row.schedule.itemName || 'Service',
        sourceScheduleStatus: row.schedule.status || 'Scheduled',
        scheduledDate: String(req.body.workStartDate || row.schedule.serviceDate || ''),
        scheduledTime: String(req.body.workStartTime || row.schedule.serviceTime || defaultTime),
        serviceInstructions: String(req.body.notes || row.schedule.itemDescription || row.schedule.itemName || ''),
        technicianId: tech._id || '',
        technicianName: [tech.firstName, tech.lastName].filter(Boolean).join(' ').trim() || tech.empCode || 'Technician',
        technicianEmpCode: tech.empCode || '',
        technicianMobile: tech.mobile || '',
        status: 'Scheduled',
        createdAt: new Date().toISOString()
      };
      createdJobs.push(newJob);
      updateSettingsNextJobNumber(generatedJobNumber, settings);
    });
  });

  fs.writeFileSync(jobsFile, JSON.stringify([...jobs, ...createdJobs], null, 2));
  records[recordIndex] = {
    ...renewal,
    technicianAssignments: technicians.map((tech) => [tech.firstName, tech.lastName].filter(Boolean).join(' ').trim() || tech.empCode || 'Technician'),
    updatedAt: new Date().toISOString()
  };
  saveRenewalRecords(records);
  return res.json({ message: 'Technician assignment created', jobs: createdJobs, renewal: records[recordIndex] });
});

registerPayrollModule({
  app,
  readJsonFile,
  files: {
    employeesFile,
    attendanceFile,
    salaryStructuresFile,
    holidaysFile: payrollHolidaysFile,
    advancesFile: payrollAdvancesFile,
    payrollRunsFile,
    payrollItemsFile,
    salaryPaymentsFile,
    payrollAuditFile
  },
  readSettings,
  serverOrigin: SERVER_ORIGIN
});

registerHrModule({
  app,
  readJsonFile,
  files: {
    employeesFile,
    attendanceFile,
    jobsFile,
    invoicesFile,
    payrollItemsFile,
    salaryStructuresFile,
    advancesFile: payrollAdvancesFile,
    leavesFile: hrLeavesFile,
    notificationsFile: hrNotificationsFile,
    workflowFile: hrWorkflowFile,
    performanceFile: hrPerformanceFile
  }
});

registerCustomerDedupModule({
  app,
  readJsonFile,
  files: {
    customersFile,
    invoicesFile,
    paymentsFile,
    jobsFile,
    renewalsFile,
    addressesFile: customerAddressesFile,
    contactsFile: customerContactsFile,
    importBatchesFile: customerImportBatchesFile,
    importRowsFile: customerImportRowsFile,
    duplicateMatchesFile: customerDuplicateMatchesFile,
    mergeHistoryFile: customerMergeHistoryFile,
    dedupAuditFile: customerDedupAuditFile
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  res.json({ imageUrl: `${SERVER_ORIGIN}/uploads/${req.file.filename}` });
});

if (fs.existsSync(frontendDistDir) && fs.existsSync(frontendIndexFile)) {
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(frontendIndexFile);
  });
}

app.listen(PORT, () => console.log(`Backend Server Live on Port ${PORT}`));
