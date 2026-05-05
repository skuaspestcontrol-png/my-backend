const express = require('express');
const cors = require("cors");
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { execFile } = require('child_process');
const PDFDocument = require('pdfkit');
const { generateInvoicePdfBuffer, formatINR, formatDate } = require('./invoicePdf');
const { query: dbQuery, getConnection } = require('./lib/db');
const { readCachedSettings, clearSettingsCache } = require('./lib/settings-cache');
const { registerPayrollModule } = require('./payrollModule');
const { registerHrModule } = require('./hrModule');
const { registerCustomerDedupModule } = require('./customerDedupModule');
const { createWhatsAppRouter } = require('./routes/whatsapp.routes');
const { createEmailRouter } = require('./routes/email.routes');
const { quotationRouter } = require('./routes/quotation.routes');
const {
  encrypt,
  normalizeKey,
  buildOAuthClient,
  ensureGoogleIntegrationTable,
  ensureJobsGoogleColumns,
  getIntegrationRow,
  saveIntegrationRow,
  ensureTaskList,
  syncGoogleTaskForJob,
  getGoogleClient
} = require('./lib/googleTasks');
require('dotenv').config();

const app = express();
app.get("/api/db-test", async (req, res) => {
  try {
    await dbQuery('SELECT 1');

    res.json({
      success: true,
      message: "DB Connected ✅",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
// ✅ TEST ROUTES
app.get("/api", (req, res) => {
  res.send("SKUAS CRM API is working ✅");
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend working perfectly 🚀",
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'skuas-backend'
  });
});

app.post('/api/admin/apply-hostinger-quotation-sql', (req, res) => {
  const token = String(req.headers['x-migration-token'] || req.body?.token || '').trim();
  const expectedToken = String(process.env.ADMIN_MIGRATION_TOKEN || '').trim();

  if (!expectedToken) {
    return res.status(500).json({ error: 'ADMIN_MIGRATION_TOKEN is not configured on server.' });
  }
  if (!token || token !== expectedToken) {
    return res.status(403).json({ error: 'Invalid migration token.' });
  }

  const scriptPath = path.join(__dirname, 'scripts', 'apply-hostinger-quotation-sql.js');
  execFile(process.execPath, [scriptPath], { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: 'Failed to apply Hostinger quotation SQL',
        details: String(stderr || error.message || 'Unknown error').trim()
      });
    }

    return res.json({
      success: true,
      message: 'Hostinger quotation SQL applied.',
      output: String(stdout || '').trim()
    });
  });
});

app.post('/api/admin/apply-hostinger-all-modules-sql', (req, res) => {
  const token = String(req.headers['x-migration-token'] || req.body?.token || '').trim();
  const expectedToken = String(process.env.ADMIN_MIGRATION_TOKEN || '').trim();

  if (!expectedToken) {
    return res.status(500).json({ error: 'ADMIN_MIGRATION_TOKEN is not configured on server.' });
  }
  if (!token || token !== expectedToken) {
    return res.status(403).json({ error: 'Invalid migration token.' });
  }

  const scriptPath = path.join(__dirname, 'scripts', 'apply-hostinger-all-modules-sql.js');
  execFile(process.execPath, [scriptPath], { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: 'Failed to apply Hostinger ALL modules SQL',
        details: String(stderr || error.message || 'Unknown error').trim()
      });
    }

    return res.json({
      success: true,
      message: 'Hostinger ALL modules SQL applied.',
      output: String(stdout || '').trim()
    });
  });
});
app.use(cors({
  origin: [
    "https://crm.skuaspestcontrol.com",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api', quotationRouter);
const PORT = Math.max(1, Number(process.env.PORT || 5000) || 5000);
const SERVER_ORIGIN = String(process.env.SERVER_ORIGIN || '').trim();
const resolveServerOrigin = (req) => SERVER_ORIGIN || `${req.protocol}://${req.get('host')}`;
const MASTER_RESET_EMAIL = String(process.env.MASTER_RESET_EMAIL || 'skuaspestcontrol@gmail.com').trim().toLowerCase();
const RESET_OTP_TTL_MS = 10 * 60 * 1000;
const resetOtpStore = new Map();
const googleOauthStateStore = new Map();

const uploadsDir = String(process.env.UPLOADS_DIR || process.env.PERSISTENT_UPLOADS_DIR || '')
  .trim() || path.join(__dirname, '..', 'storage', 'uploads');
const uploadsMirrorDir = String(process.env.UPLOADS_MIRROR_DIR || '').trim();
fs.mkdirSync(uploadsDir, { recursive: true });
if (uploadsMirrorDir) fs.mkdirSync(uploadsMirrorDir, { recursive: true });
const legacyDataDir = path.join(__dirname, 'data');
const dataDir = String(process.env.DATA_DIR || process.env.PERSISTENT_DATA_DIR || '').trim()
  || path.join(__dirname, '..', 'storage', 'data');

[uploadsDir, dataDir].forEach((dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

const migrateLegacyJsonDataOnce = () => {
  try {
    if (!fs.existsSync(legacyDataDir)) return;
    const legacyEntries = fs.readdirSync(legacyDataDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    if (!legacyEntries.length) return;
    legacyEntries.forEach((entry) => {
      const source = path.join(legacyDataDir, entry.name);
      const target = path.join(dataDir, entry.name);
      if (fs.existsSync(target)) return;
      fs.copyFileSync(source, target);
    });
  } catch (error) {
    console.error('Legacy data migration skipped:', error.message);
  }
};
migrateLegacyJsonDataOnce();

const syncUploadToMirror = (fileName = '') => {
  if (!uploadsMirrorDir) return;
  const safeName = String(fileName || '').trim();
  if (!safeName) return;
  const src = path.join(uploadsDir, safeName);
  const dest = path.join(uploadsMirrorDir, safeName);
  try {
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  } catch (error) {
    console.error('Failed to mirror uploaded file:', error.message);
  }
};

const recoverUploadsFromMirror = () => {
  if (!uploadsMirrorDir) return;
  try {
    const entries = fs.readdirSync(uploadsMirrorDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (!entry.isFile()) return;
      const src = path.join(uploadsMirrorDir, entry.name);
      const dest = path.join(uploadsDir, entry.name);
      if (fs.existsSync(dest)) return;
      fs.copyFileSync(src, dest);
    });
  } catch (error) {
    console.error('Failed to recover uploads from mirror:', error.message);
  }
};
recoverUploadsFromMirror();

app.use('/uploads', express.static(uploadsDir));
const uploadsPublicBaseUrl = String(process.env.UPLOADS_PUBLIC_BASE_URL || '').trim();
const resolveUploadPublicUrl = (req, fileName) => {
  const safeFileName = encodeURIComponent(String(fileName || '').trim());
  if (!safeFileName) return '';
  if (uploadsPublicBaseUrl) {
    return `${uploadsPublicBaseUrl.replace(/\/+$/, '')}/${safeFileName}`;
  }
  return `${resolveServerOrigin(req)}/uploads/${safeFileName}`;
};
const toDataUrlFromUpload = (file) => {
  try {
    if (!file?.path || !fs.existsSync(file.path)) return '';
    const mime = String(file.mimetype || 'application/octet-stream').trim() || 'application/octet-stream';
    const base64 = fs.readFileSync(file.path).toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.error('Failed to convert upload to data URL:', error.message);
    return '';
  }
};
const backendPublicDir = path.join(__dirname, 'public');
const backendPublicIndexFile = path.join(backendPublicDir, 'index.html');
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
const frontendDistIndexFile = path.join(frontendDistDir, 'index.html');
const hasBackendPublicBuild = fs.existsSync(backendPublicDir) && fs.existsSync(backendPublicIndexFile);
const hasFrontendDistBuild = fs.existsSync(frontendDistDir) && fs.existsSync(frontendDistIndexFile);
const buildMtimeMs = (filePath) => {
  try {
    return fs.statSync(filePath).mtimeMs || 0;
  } catch (error) {
    return 0;
  }
};

let activeFrontendBuildDir = null;
let activeFrontendIndexFile = null;
if (hasBackendPublicBuild && hasFrontendDistBuild) {
  const backendPublicMtime = buildMtimeMs(backendPublicIndexFile);
  const frontendDistMtime = buildMtimeMs(frontendDistIndexFile);
  const useBackendPublic = backendPublicMtime >= frontendDistMtime;
  activeFrontendBuildDir = useBackendPublic ? backendPublicDir : frontendDistDir;
  activeFrontendIndexFile = useBackendPublic ? backendPublicIndexFile : frontendDistIndexFile;
} else if (hasBackendPublicBuild) {
  activeFrontendBuildDir = backendPublicDir;
  activeFrontendIndexFile = backendPublicIndexFile;
} else if (hasFrontendDistBuild) {
  activeFrontendBuildDir = frontendDistDir;
  activeFrontendIndexFile = frontendDistIndexFile;
}

if (activeFrontendBuildDir) {
  app.use(express.static(activeFrontendBuildDir));
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
const vendorsFile = path.join(dataDir, 'vendors.json');
const invoicesFile = path.join(dataDir, 'invoices.json');
const vendorBillsFile = path.join(dataDir, 'vendor_bills.json');
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

let dashboardSummaryCache = null;
let dashboardSummaryCachedAt = 0;
const DASHBOARD_SUMMARY_TTL_MS = 60 * 1000;

const canUseMysql = () => {
  return Boolean(
    String(process.env.MYSQL_HOST || process.env.DB_HOST || '').trim()
    && String(process.env.MYSQL_USER || process.env.DB_USER || '').trim()
    && String(process.env.MYSQL_DATABASE || process.env.DB_NAME || '').trim()
  );
};

const withMysqlConnection = async (handler) => {
  if (!canUseMysql()) return null;
  const connection = await getConnection();
  try {
    return await handler(connection);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MySQL] Query failed:', error.message);
    }
    throw error;
  } finally {
    connection.release();
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
  nonGstDigitalSignatureUrl: '',
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
    nonGstDigitalSignatureUrl: normalizeSettingsText(source.nonGstDigitalSignatureUrl ?? defaultSettings.nonGstDigitalSignatureUrl),
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
const APP_SETTINGS_KEY_MAIN = 'main';
const APP_SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(120) NOT NULL,
  setting_value JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const ensureAppSettingsTable = async (conn) => {
  await conn.query(APP_SETTINGS_TABLE_SQL);
};

const readSettingsFromMysql = async () => {
  return readCachedSettings(async () => {
    const mysqlSettings = await withMysqlConnection(async (conn) => {
      await ensureAppSettingsTable(conn);
      const [rows] = await conn.query(
        'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
        [APP_SETTINGS_KEY_MAIN]
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      const raw = row.setting_value;
      if (!raw) return {};
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return {}; }
      }
      if (typeof raw === 'object') return raw;
      return {};
    });

    return sanitizeSettings(mysqlSettings || {});
  });
};

const saveSettingsToMysql = async (payload = {}) => {
  const sanitized = sanitizeSettings(payload);
  await withMysqlConnection(async (conn) => {
    await ensureAppSettingsTable(conn);
    await conn.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [APP_SETTINGS_KEY_MAIN, JSON.stringify(sanitized)]
    );
  });
  clearSettingsCache();
  return sanitized;
};

const mergeSettingsForSave = (current = {}, incoming = {}) => {
  const base = {
    ...(current && typeof current === 'object' ? current : {}),
    ...(incoming && typeof incoming === 'object' ? incoming : {})
  };
  const preserveIfBlank = [
    'gstCompanyLogoUrl',
    'dashboardImageUrl',
    'nonGstCompanyLogoUrl',
    'nonGstDigitalSignatureUrl',
    'gstDigitalSignatureUrl',
    'gstCompanyStampUrl'
  ];
  preserveIfBlank.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(incoming || {}, key)) return;
    const nextRaw = incoming[key];
    if (typeof nextRaw === 'string' && nextRaw.trim() === '') {
      const existing = String((current || {})[key] || '').trim();
      if (existing) base[key] = existing;
    }
  });
  return base;
};

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
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const byName = path.join(uploadsDir, path.basename(raw));
    if (fs.existsSync(byName)) return byName;
    if (fs.existsSync(raw)) return raw;
  }
  try {
    const url = new URL(raw);
    const pathname = url.pathname || '';
    if (pathname.includes('/uploads/')) {
      const fileName = path.basename(pathname);
      const local = path.join(uploadsDir, fileName);
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

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await readSettingsFromMysql();
    return res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings from MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const current = await readSettingsFromMysql();
    const next = await saveSettingsToMysql(mergeSettingsForSave(current, req.body || {}));
    return res.json({ message: 'Saved', settings: next });
  } catch (error) {
    console.error('Failed to save settings to MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.post('/api/settings/save', async (req, res) => {
  try {
    const current = await readSettingsFromMysql();
    const next = await saveSettingsToMysql(mergeSettingsForSave(current, req.body || {}));
    return res.json({ message: 'Saved', settings: next });
  } catch (error) {
    console.error('Failed to save settings to MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/dashboard/summary', async (req, res) => {
  const now = Date.now();
  if (dashboardSummaryCache && (now - dashboardSummaryCachedAt) < DASHBOARD_SUMMARY_TTL_MS) {
    return res.json(dashboardSummaryCache);
  }

  if (canUseMysql()) {
    try {
      const [row] = await dbQuery(`
        SELECT
          (SELECT COUNT(*) FROM leads) AS leadsCount,
          (SELECT COUNT(*) FROM customers) AS customersCount,
          (SELECT COUNT(*) FROM employees) AS employeesCount,
          (SELECT COUNT(*) FROM jobs) AS jobsCount,
          (SELECT COUNT(*) FROM invoices) AS invoicesCount,
          (SELECT COALESCE(SUM(total_amount), 0) FROM invoices) AS invoicesTotalAmount
      `);
      const summary = {
        leadsCount: Number(row?.leadsCount || 0),
        customersCount: Number(row?.customersCount || 0),
        employeesCount: Number(row?.employeesCount || 0),
        jobsCount: Number(row?.jobsCount || 0),
        invoicesCount: Number(row?.invoicesCount || 0),
        invoicesTotalAmount: Number(row?.invoicesTotalAmount || 0),
        source: 'mysql',
        cachedAt: new Date().toISOString()
      };
      dashboardSummaryCache = summary;
      dashboardSummaryCachedAt = now;
      return res.json(summary);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ error: error.message });
      }
      console.error('Dashboard summary MySQL failed, using emergency JSON fallback:', error.message);
    }
  }

  const fallback = {
    leadsCount: readJsonFile(leadsFile, []).length,
    customersCount: readJsonFile(customersFile, []).length,
    employeesCount: readJsonFile(employeesFile, []).length,
    jobsCount: readJsonFile(jobsFile, []).length,
    invoicesCount: readJsonFile(invoicesFile, []).length,
    invoicesTotalAmount: readJsonFile(invoicesFile, []).reduce((sum, invoice) => sum + Number(invoice?.totalAmount || invoice?.amount || 0), 0),
    source: 'json-fallback',
    cachedAt: new Date().toISOString()
  };
  dashboardSummaryCache = fallback;
  dashboardSummaryCachedAt = now;
  return res.json(fallback);
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const incomingEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!incomingEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (incomingEmail !== MASTER_RESET_EMAIL) {
      return res.status(403).json({ error: 'Only master email can reset admin password' });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + RESET_OTP_TTL_MS;
    resetOtpStore.set(incomingEmail, { otp, expiresAt });

    await sendPasswordResetOtpEmail({
      settings: readSettings(),
      recipient: incomingEmail,
      otp
    });

    res.json({ message: 'OTP sent to master email' });
  } catch (error) {
    console.error('Failed to send reset OTP:', error.message);
    res.status(500).json({ error: 'Could not send reset OTP. Check SMTP settings in backend.' });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  const incomingEmail = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!incomingEmail || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP and new password are required' });
  }
  if (incomingEmail !== MASTER_RESET_EMAIL) {
    return res.status(403).json({ error: 'Only master email can reset admin password' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const saved = resetOtpStore.get(incomingEmail);
  if (!saved) {
    return res.status(400).json({ error: 'OTP not found. Request a new OTP.' });
  }
  if (Date.now() > saved.expiresAt) {
    resetOtpStore.delete(incomingEmail);
    return res.status(400).json({ error: 'OTP expired. Request a new OTP.' });
  }
  if (saved.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  const current = readSettings();
  const next = sanitizeSettings({
    ...current,
    adminPassword: newPassword
  });
  fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2));
  resetOtpStore.delete(incomingEmail);
  res.json({ message: 'Password reset successful' });
});

app.post('/api/settings/upload-dashboard-image', upload.single('dashboardImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  syncUploadToMirror(req.file.filename);
  const imageUrl = toDataUrlFromUpload(req.file) || resolveUploadPublicUrl(req, req.file.filename);
  res.json({ imageUrl });
});

app.post('/api/settings/upload-branding-image', upload.single('brandingImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  syncUploadToMirror(req.file.filename);
  const imageUrl = toDataUrlFromUpload(req.file) || resolveUploadPublicUrl(req, req.file.filename);
  res.json({ imageUrl });
});

app.post('/api/employees/upload-document', upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  syncUploadToMirror(req.file.filename);
  res.json({ fileUrl: resolveUploadPublicUrl(req, req.file.filename) });
});

const parseMysqlLeadPayload = (rawPayload) => {
  if (!rawPayload) return null;
  if (typeof rawPayload === 'string') {
    try { return JSON.parse(rawPayload); } catch { return null; }
  }
  if (typeof rawPayload === 'object') return rawPayload;
  return null;
};

const normalizeLeadShape = (input = {}, fallbackId = '') => {
  const source = (input && typeof input === 'object') ? input : {};
  const leadId = String(source._id || fallbackId || Date.now().toString()).trim();
  const customerName = String(source.customerName || source.displayName || '').trim();
  const displayName = String(source.displayName || customerName).trim();
  const companyName = String(source.companyName || '').trim();
  const contactPersonName = String(source.contactPersonName || '').trim();
  const title = String(source.title || source.position || '').trim();
  const mobileValue = String(source.mobile || source.mobileNumber || '').trim();
  const whatsappNumber = String(source.whatsappNumber || '').trim();
  const emailId = String(source.emailId || '').trim();
  const address = String(source.address || '').trim();
  const areaName = String(source.areaName || source.area || '').trim();
  const city = String(source.city || '').trim();
  const state = String(source.state || '').trim();
  const pincode = String(source.pincode || source.pinCode || '').trim();
  const pestIssue = String(source.pestIssue || '').trim();
  const leadSource = String(source.leadSource || '').trim();
  const leadStatus = String(source.status || source.leadStatus || '').trim();
  const assignedTo = String(source.assignedTo || '').trim();
  const followupDate = String(source.followupDate || '').trim();
  const date = String(source.date || source.createdAt || new Date().toISOString()).trim();
  const googlePlaceId = String(source.googlePlaceId || source.google_place_id || '').trim();
  const googlePlaceName = String(source.googlePlaceName || source.google_place_name || '').trim();
  const googlePhone = String(source.googlePhone || source.google_phone || '').trim();
  const googleWebsite = String(source.googleWebsite || source.google_website || '').trim();
  const latitude = String(source.latitude || '').trim();
  const longitude = String(source.longitude || '').trim();

  return {
    _id: leadId,
    customerName,
    displayName,
    companyName,
    contactPersonName,
    title,
    mobile: mobileValue,
    mobileNumber: mobileValue,
    whatsappNumber,
    emailId,
    address,
    areaName,
    area: areaName,
    city,
    state,
    pincode,
    pestIssue,
    leadSource,
    status: leadStatus,
    leadStatus,
    assignedTo,
    followupDate,
    date,
    googlePlaceId,
    googlePlaceName,
    googlePhone,
    googleWebsite,
    latitude,
    longitude
  };
};

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
};

const ensureColumnsIfMissing = async (conn, tableName, requiredColumns = []) => {
  for (const col of requiredColumns) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, col.name]
    );
    const exists = Number(rows?.[0]?.count || 0) > 0;
    if (!exists) {
      await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.definition}`);
    }
  }
};

let leadsPlaceColumnsEnsured = false;
const ensureLeadPlaceColumns = async (conn) => {
  if (leadsPlaceColumnsEnsured) return;
  await ensureColumnsIfMissing(conn, 'leads', [
    { name: 'google_place_id', definition: 'VARCHAR(255) NULL' },
    { name: 'google_place_name', definition: 'VARCHAR(255) NULL' },
    { name: 'google_phone', definition: 'VARCHAR(50) NULL' },
    { name: 'google_website', definition: 'VARCHAR(255) NULL' },
    { name: 'latitude', definition: 'DECIMAL(10,8) NULL' },
    { name: 'longitude', definition: 'DECIMAL(11,8) NULL' }
  ]);
  leadsPlaceColumnsEnsured = true;
};

let customerPlaceColumnsEnsured = false;
const ensureCustomerPlaceColumns = async (conn) => {
  if (customerPlaceColumnsEnsured) return;
  await ensureColumnsIfMissing(conn, 'customers', [
    { name: 'google_place_id', definition: 'VARCHAR(255) NULL' },
    { name: 'google_place_name', definition: 'VARCHAR(255) NULL' },
    { name: 'google_phone', definition: 'VARCHAR(50) NULL' },
    { name: 'google_website', definition: 'VARCHAR(255) NULL' },
    { name: 'latitude', definition: 'DECIMAL(10,8) NULL' },
    { name: 'longitude', definition: 'DECIMAL(11,8) NULL' }
  ]);
  customerPlaceColumnsEnsured = true;
};

const upsertLeadToMysql = async (conn, lead) => {
  await ensureLeadPlaceColumns(conn);
  await conn.query(
    `INSERT INTO leads (
      external_id, customer_name, display_name, company_name, contact_person_name, title, mobile,
      whatsapp_number, email_id, address, area_name, city, state, pincode, pest_issue,
      lead_source, lead_status, assigned_to, followup_date,
      google_place_id, google_place_name, google_phone, google_website, latitude, longitude, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      customer_name=VALUES(customer_name),
      display_name=VALUES(display_name),
      company_name=VALUES(company_name),
      contact_person_name=VALUES(contact_person_name),
      title=VALUES(title),
      mobile=VALUES(mobile),
      whatsapp_number=VALUES(whatsapp_number),
      email_id=VALUES(email_id),
      address=VALUES(address),
      area_name=VALUES(area_name),
      city=VALUES(city),
      state=VALUES(state),
      pincode=VALUES(pincode),
      pest_issue=VALUES(pest_issue),
      lead_source=VALUES(lead_source),
      lead_status=VALUES(lead_status),
      assigned_to=VALUES(assigned_to),
      followup_date=VALUES(followup_date),
      google_place_id=VALUES(google_place_id),
      google_place_name=VALUES(google_place_name),
      google_phone=VALUES(google_phone),
      google_website=VALUES(google_website),
      latitude=VALUES(latitude),
      longitude=VALUES(longitude),
      payload=VALUES(payload)`,
    [
      lead._id,
      lead.customerName || null,
      lead.displayName || null,
      lead.companyName || null,
      lead.contactPersonName || null,
      lead.title || null,
      lead.mobile || null,
      lead.whatsappNumber || null,
      lead.emailId || null,
      lead.address || null,
      lead.areaName || null,
      lead.city || null,
      lead.state || null,
      lead.pincode || null,
      lead.pestIssue || null,
      lead.leadSource || null,
      lead.leadStatus || null,
      lead.assignedTo || null,
      lead.followupDate || null,
      lead.googlePlaceId || null,
      lead.googlePlaceName || null,
      lead.googlePhone || null,
      lead.googleWebsite || null,
      lead.latitude ? Number(lead.latitude) : null,
      lead.longitude ? Number(lead.longitude) : null,
      JSON.stringify(lead)
    ]
  );
};

app.get('/api/leads', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for leads module' });
  }
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query('SELECT payload FROM leads ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    const parsed = (Array.isArray(mysqlRows) ? mysqlRows : [])
      .map((row) => normalizeLeadShape(parseMysqlLeadPayload(row?.payload) || {}))
      .filter((entry) => String(entry._id || '').trim());
    return res.json(parsed);
  } catch (error) {
    console.error('Failed to fetch leads from MySQL:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch leads from MySQL' });
  }
});

app.post('/api/leads', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for leads module' });
  }
  try {
    const incoming = req.body || {};
    const generatedId = String(incoming._id || Date.now().toString()).trim();
    const newLead = normalizeLeadShape({ ...incoming, _id: generatedId }, generatedId);
    await withMysqlConnection(async (conn) => {
      await upsertLeadToMysql(conn, newLead);
    });
    return res.json(newLead);
  } catch (error) {
    console.error('Failed to save lead in MySQL:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to save lead in MySQL' });
  }
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
    const isGoogleMapsUrl = /^https?:\/\/(www\.)?(maps\.app\.goo\.gl|maps\.google\.com|google\.com\/maps)/i.test(address);
    const parseLatLngFromUrl = (value = '') => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (atMatch) return { lat: atMatch[1], lng: atMatch[2] };
      const markerMatch = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      if (markerMatch) return { lat: markerMatch[1], lng: markerMatch[2] };
      return null;
    };
    const parsePlaceTextFromUrl = (value = '') => {
      try {
        const target = new URL(value);
        const query = String(target.searchParams.get('q') || target.searchParams.get('query') || '').trim();
        if (query) return query;
        const placeMatch = target.pathname.match(/\/place\/([^/]+)/i);
        if (placeMatch?.[1]) return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim();
      } catch (_error) {
        // ignore
      }
      return '';
    };

    const extractReadableTextFromPath = (value = '') => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const normalized = raw.replace(/\+/g, ' ');
      const cleaned = normalized
        .replace(/^\d+\s+/, '')
        .replace(/\bdata=.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned;
    };
    const extractPotentialQueryFromMapsUrl = (value = '') => {
      try {
        const url = new URL(value);
        const byQuery = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
        if (byQuery) return byQuery;
        const placeMatch = url.pathname.match(/\/place\/([^/]+)/i);
        if (placeMatch?.[1]) return extractReadableTextFromPath(decodeURIComponent(placeMatch[1]));
      } catch (_error) {
        // ignore
      }
      return '';
    };
    const expandGoogleMapsShortUrl = async (value = '') => {
      const seen = new Set();
      let current = String(value || '').trim();
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      };

      for (let i = 0; i < 6; i += 1) {
        if (!current || seen.has(current)) break;
        seen.add(current);
        let response = null;
        try {
          response = await fetch(current, { method: 'GET', redirect: 'manual', headers });
        } catch (_error) {
          response = null;
        }
        if (!response) break;
        const status = Number(response.status || 0);
        const location = String(response.headers?.get?.('location') || '').trim();
        if (status >= 300 && status < 400 && location) {
          try {
            current = new URL(location, current).toString();
            continue;
          } catch (_error) {
            current = location;
            continue;
          }
        }
        break;
      }

      try {
        const followResponse = await fetch(current || value, { method: 'GET', redirect: 'follow', headers });
        return String(followResponse?.url || current || value).trim();
      } catch (_error) {
        return current || String(value || '').trim();
      }
    };

    let geocodeAddress = address;
    let geocodeLat = lat;
    let geocodeLng = lng;

    if (isGoogleMapsUrl) {
      try {
        const expandedUrl = await expandGoogleMapsShortUrl(address);
        const parsedCoords = parseLatLngFromUrl(expandedUrl);
        if (parsedCoords?.lat && parsedCoords?.lng) {
          geocodeLat = String(parsedCoords.lat);
          geocodeLng = String(parsedCoords.lng);
        } else {
          const parsedText = parsePlaceTextFromUrl(expandedUrl)
            || extractPotentialQueryFromMapsUrl(expandedUrl)
            || parsePlaceTextFromUrl(address)
            || extractPotentialQueryFromMapsUrl(address);
          if (parsedText) geocodeAddress = parsedText;
          else geocodeAddress = '';
        }
      } catch (_error) {
        const parsedCoords = parseLatLngFromUrl(address);
        if (parsedCoords?.lat && parsedCoords?.lng) {
          geocodeLat = String(parsedCoords.lat);
          geocodeLng = String(parsedCoords.lng);
        } else {
          const parsedText = parsePlaceTextFromUrl(address) || extractPotentialQueryFromMapsUrl(address);
          geocodeAddress = parsedText || '';
        }
      }
    }

    if (mapsApiKey) {
      if (geocodeAddress && !geocodeLat && !geocodeLng) {
        let candidate = null;
        const placesFindEndpoint = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(geocodeAddress)}&inputtype=textquery&fields=place_id,name,formatted_address,geometry,types&locationbias=ipbias&key=${mapsApiKey}`;
        const placesFindResponse = await fetch(placesFindEndpoint);
        if (placesFindResponse.ok) {
          const placesFindData = await placesFindResponse.json();
          candidate = Array.isArray(placesFindData.candidates) && placesFindData.candidates[0]
            ? placesFindData.candidates[0]
            : null;
        }

        if (!candidate) {
          const textSearchEndpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(geocodeAddress)}&region=in&key=${mapsApiKey}`;
          const textSearchResponse = await fetch(textSearchEndpoint);
          if (textSearchResponse.ok) {
            const textSearchData = await textSearchResponse.json();
            const textResult = Array.isArray(textSearchData.results) && textSearchData.results[0]
              ? textSearchData.results[0]
              : null;
            if (textResult) {
              candidate = {
                place_id: textResult.place_id,
                name: textResult.name,
                formatted_address: textResult.formatted_address,
                geometry: textResult.geometry,
                types: textResult.types
              };
            }
          }
        }

        if (candidate) {
          const placeId = String(candidate.place_id || '').trim();
          const geocodeByPlaceIdEndpoint = placeId
            ? `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${mapsApiKey}`
            : '';
          let geocodeByPlace = null;
          if (geocodeByPlaceIdEndpoint) {
            const geocodeByPlaceResponse = await fetch(geocodeByPlaceIdEndpoint);
            if (geocodeByPlaceResponse.ok) {
              const geocodeByPlaceData = await geocodeByPlaceResponse.json();
              if (geocodeByPlaceData.status === 'OK' && Array.isArray(geocodeByPlaceData.results) && geocodeByPlaceData.results[0]) {
                geocodeByPlace = geocodeByPlaceData.results[0];
              }
            }
          }

          let placeDetails = null;
          if (placeId) {
            const detailsEndpoint = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,international_phone_number,website&key=${mapsApiKey}`;
            const detailsResponse = await fetch(detailsEndpoint);
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();
              if (detailsData.status === 'OK' && detailsData.result) {
                placeDetails = detailsData.result;
              }
            }
          }

          const mergedResult = {
            ...(geocodeByPlace || {}),
            place_id: placeId || geocodeByPlace?.place_id || '',
            name: String(candidate.name || '').trim(),
            types: Array.isArray(candidate.types) ? candidate.types : (Array.isArray(geocodeByPlace?.types) ? geocodeByPlace.types : []),
            formatted_address: String(candidate.formatted_address || geocodeByPlace?.formatted_address || '').trim(),
            geometry: candidate.geometry || geocodeByPlace?.geometry || {},
            formatted_phone_number: String(placeDetails?.formatted_phone_number || '').trim(),
            international_phone_number: String(placeDetails?.international_phone_number || '').trim(),
            website: String(placeDetails?.website || '').trim()
          };
          res.json({ result: mergedResult });
          return;
        }
      }

      const googleEndpoint = (geocodeLat && geocodeLng) || (lat && lng)
        ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${geocodeLat || lat},${geocodeLng || lng}`)}&key=${mapsApiKey}`
        : geocodeAddress
          ? `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(geocodeAddress)}&key=${mapsApiKey}`
          : '';
      if (!googleEndpoint) {
        googleError = 'Unable to resolve map short link. Please paste full map address or coordinates.';
      } else {
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

app.put('/api/leads/:id', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for leads module' });
  }
  try {
    const leadId = String(req.params.id || '').trim();
    const existingRow = await withMysqlConnection(async (conn) => {
      const isNumeric = /^\d+$/.test(leadId);
      const query = isNumeric
        ? 'SELECT payload, external_id FROM leads WHERE external_id = ? OR id = ? LIMIT 1'
        : 'SELECT payload, external_id FROM leads WHERE external_id = ? LIMIT 1';
      const params = isNumeric ? [leadId, Number(leadId)] : [leadId];
      const [rows] = await conn.query(query, params);
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    });

    if (!existingRow) return res.status(404).json({ error: 'Lead not found' });

    const existingLead = normalizeLeadShape(parseMysqlLeadPayload(existingRow.payload) || {}, existingRow.external_id || leadId);
    const updatedLead = normalizeLeadShape({
      ...existingLead,
      ...(req.body && typeof req.body === 'object' ? req.body : {}),
      _id: existingLead._id
    }, existingLead._id);

    await withMysqlConnection(async (conn) => {
      await upsertLeadToMysql(conn, updatedLead);
    });

    return res.json(updatedLead);
  } catch (error) {
    console.error('Failed to update lead in MySQL:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to update lead in MySQL' });
  }
});

app.delete('/api/leads/:id', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for leads module' });
  }
  try {
    const leadId = String(req.params.id || '').trim();
    const deletedRows = await withMysqlConnection(async (conn) => {
      const isNumeric = /^\d+$/.test(leadId);
      const query = isNumeric
        ? 'DELETE FROM leads WHERE external_id = ? OR id = ?'
        : 'DELETE FROM leads WHERE external_id = ?';
      const params = isNumeric ? [leadId, Number(leadId)] : [leadId];
      const [result] = await conn.query(query, params);
      return Number(result?.affectedRows || 0);
    });
    if (!deletedRows) return res.status(404).json({ error: 'Lead not found' });
    return res.json({ message: 'Lead deleted' });
  } catch (error) {
    console.error('Failed to delete lead in MySQL:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete lead in MySQL' });
  }
});

app.get('/api/employees', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for employees module' });
  }
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, email, city, pincode, salary, joining_date, status, payload
         FROM employees
         ORDER BY id DESC`
      );
      return Array.isArray(rows) ? rows : [];
    });
    const toEmployeeResponse = (row) => {
      let payload = {};
      const rawPayload = row?.payload;
      if (rawPayload && typeof rawPayload === 'object') payload = rawPayload;
      if (typeof rawPayload === 'string') {
        try { payload = JSON.parse(rawPayload); } catch { payload = {}; }
      }
      const firstName = String(payload.firstName ?? row?.first_name ?? '').trim();
      const lastName = String(payload.lastName ?? row?.last_name ?? '').trim();
      const rawStatus = row?.status ?? payload?.status ?? '';
      const portalAccess = typeof payload?.portalAccess === 'boolean'
        ? payload.portalAccess
        : (typeof payload?.webPortalAccessEnabled === 'boolean'
          ? payload.webPortalAccessEnabled
          : ['1', 'true', 'yes', 'enabled', 'active', 'on'].includes(String(rawStatus).trim().toLowerCase()));
      const salary = Number(row?.salary ?? payload.salary ?? payload.salaryPerMonth ?? 0) || 0;
      return {
        ...payload,
        _id: String(row?.external_id ?? payload._id ?? row?.id ?? '').trim(),
        id: row?.id ?? null,
        empCode: String(row?.emp_code ?? payload.empCode ?? '').trim(),
        firstName: String(row?.first_name ?? firstName).trim(),
        lastName: String(row?.last_name ?? lastName).trim(),
        mobile: String(row?.mobile ?? payload.mobile ?? '').trim(),
        email: String(row?.email ?? payload.email ?? payload.emailId ?? '').trim(),
        role: String(row?.role ?? payload.role ?? '').trim(),
        roleName: String(row?.role_name ?? payload.roleName ?? '').trim(),
        salary,
        salaryPerMonth: salary,
        dateOfJoining: String(row?.joining_date ?? payload.dateOfJoining ?? '').trim(),
        city: String(row?.city ?? payload.city ?? '').trim(),
        pincode: String(row?.pincode ?? payload.pincode ?? '').trim(),
        portalAccess
      };
    };
    return res.json(mysqlRows.map(toEmployeeResponse));
  } catch (error) {
    console.error('MySQL employees read failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch employees from MySQL' });
  }
});

app.post("/api/employees", async (req, res) => {
  try {
    const emp = req.body || {};

    const externalId = emp._id || Date.now().toString();

    await withMysqlConnection(async (conn) => {
      await conn.query(
        `INSERT INTO employees (
          external_id,
          emp_code,
          first_name,
          last_name,
          full_name,
          mobile,
          email,
          role,
          role_name,
          salary,
          joining_date,
          city,
          pincode,
          payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          emp_code = VALUES(emp_code),
          first_name = VALUES(first_name),
          last_name = VALUES(last_name),
          full_name = VALUES(full_name),
          mobile = VALUES(mobile),
          email = VALUES(email),
          role = VALUES(role),
          role_name = VALUES(role_name),
          salary = VALUES(salary),
          joining_date = VALUES(joining_date),
          city = VALUES(city),
          pincode = VALUES(pincode),
          payload = VALUES(payload)
        `,
        [
          externalId,
          emp.empCode || "",
          emp.firstName || "",
          emp.lastName || "",
          `${emp.firstName || ""} ${emp.lastName || ""}`,
          emp.mobile || "",
          emp.email || emp.emailId || "",
          emp.role || "",
          emp.roleName || "",
          emp.salary || emp.salaryPerMonth || 0,
          emp.dateOfJoining || null,
          emp.city || "",
          emp.pincode || "",
          JSON.stringify(emp),
        ]
      );
    });

    res.json({ success: true, _id: externalId });

  } catch (error) {
    console.error("Employee save failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const fetchEmployeeByAnyId = async (employeeId) => {
  const target = String(employeeId || '').trim();
  if (!target) return null;
  if (!canUseMysql()) return null;

  try {
    const mysqlEmployee = await withMysqlConnection(async (conn) => {
      const isNumeric = /^\d+$/.test(target);
      const query = isNumeric
        ? `SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, email, city, pincode, salary, joining_date, payload
           FROM employees
           WHERE external_id = ? OR id = ? LIMIT 1`
        : `SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, email, city, pincode, salary, joining_date, payload
           FROM employees
           WHERE external_id = ? LIMIT 1`;
      const params = isNumeric ? [target, Number(target)] : [target];
      const [rows] = await conn.query(query, params);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      let payload = {};
      const rawPayload = row.payload;
      if (rawPayload && typeof rawPayload === 'object') payload = rawPayload;
      if (typeof rawPayload === 'string') {
        try { payload = JSON.parse(rawPayload); } catch { payload = {}; }
      }
      return {
        ...payload,
        _id: String(payload._id ?? row.external_id ?? row.id ?? '').trim(),
        empCode: String(payload.empCode ?? row.emp_code ?? '').trim(),
        firstName: String(payload.firstName ?? row.first_name ?? '').trim(),
        lastName: String(payload.lastName ?? row.last_name ?? '').trim(),
        role: String(payload.role ?? row.role ?? '').trim(),
        roleName: String(payload.roleName ?? row.role_name ?? '').trim(),
        mobile: String(payload.mobile ?? row.mobile ?? '').trim(),
        email: String(payload.email ?? payload.emailId ?? row.email ?? '').trim(),
        city: String(payload.city ?? row.city ?? '').trim(),
        pincode: String(payload.pincode ?? row.pincode ?? '').trim(),
        salary: Number(payload.salary ?? payload.salaryPerMonth ?? row.salary ?? 0) || 0,
        dateOfJoining: String(payload.dateOfJoining ?? row.joining_date ?? '').trim()
      };
    });
    if (mysqlEmployee && typeof mysqlEmployee === 'object') return mysqlEmployee;
  } catch (error) {
    console.error('Employee lookup in MySQL failed:', error.message);
  }

  return null;
};

app.put('/api/employees/:id', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for employees module' });
  }
  const employeeId = String(req.params.id || '').trim();
  const incoming = req.body && typeof req.body === 'object' ? req.body : {};
  const firstName = String(incoming.firstName || '').trim();
  const lastName = String(incoming.lastName || '').trim();
  const portalEnabled = incoming.portalAccess ?? incoming.webPortalAccessEnabled;
  const normalizedStatus = typeof portalEnabled === 'boolean'
    ? (portalEnabled ? 'enabled' : 'disabled')
    : String(portalEnabled || '').trim();
  const updatedEmployee = {
    ...incoming,
    _id: String(incoming._id || employeeId).trim(),
    empCode: String(incoming.empCode || '').trim(),
    firstName,
    lastName,
    mobile: String(incoming.mobile || '').trim(),
    email: String(incoming.email || incoming.emailId || '').trim(),
    role: String(incoming.role || '').trim(),
    roleName: String(incoming.roleName || '').trim(),
    salary: Number(incoming.salary ?? incoming.salaryPerMonth ?? 0) || 0,
    dateOfJoining: String(incoming.dateOfJoining || '').trim(),
    city: String(incoming.city || '').trim(),
    pincode: String(incoming.pincode || '').trim(),
    portalAccess: Boolean(portalEnabled)
  };
  const payloadToSave = {
    ...incoming,
    _id: updatedEmployee._id
  };

  try {
    const affectedRows = await withMysqlConnection(async (conn) => {
      const numericId = Number(employeeId);
      const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
      const [result] = await conn.query(
        `UPDATE employees
         SET external_id = ?, emp_code = ?, first_name = ?, last_name = ?, full_name = ?, mobile = ?, email = ?, role = ?, role_name = ?, salary = ?, joining_date = ?, city = ?, pincode = ?, status = ?, payload = ?
         WHERE external_id = ? OR id = ?`,
        [
          updatedEmployee._id,
          updatedEmployee.empCode || '',
          updatedEmployee.firstName || '',
          updatedEmployee.lastName || '',
          `${updatedEmployee.firstName || ''} ${updatedEmployee.lastName || ''}`.trim(),
          updatedEmployee.mobile || '',
          updatedEmployee.email || '',
          updatedEmployee.role || '',
          updatedEmployee.roleName || '',
          updatedEmployee.salary || 0,
          updatedEmployee.dateOfJoining || null,
          updatedEmployee.city || '',
          updatedEmployee.pincode || '',
          normalizedStatus || null,
          JSON.stringify(payloadToSave),
          employeeId,
          safeNumericId
        ]
      );
      return Number(result?.affectedRows || 0);
    });
    if (!affectedRows) return res.status(404).json({ error: 'Employee not found' });
    return res.json({ success: true, employee: updatedEmployee });
  } catch (error) {
    console.error('MySQL employees update failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to update employee in MySQL' });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for employees module' });
  }
  try {
    const employeeId = String(req.params.id || '').trim();
    const deletedRows = await withMysqlConnection(async (conn) => {
      const numericId = Number(employeeId);
      const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
      const [result] = await conn.query(
        'DELETE FROM employees WHERE external_id = ? OR id = ?',
        [employeeId, safeNumericId]
      );
      return Number(result?.affectedRows || 0);
    });
    if (!deletedRows) return res.status(404).json({ error: 'Employee not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('MySQL employees delete failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete employee from MySQL' });
  }
});

app.get('/api/attendance', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for attendance module' });
  }
  let records = [];
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      await ensureAttendanceTable(conn);
      const [rows] = await conn.query('SELECT payload FROM attendance ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    if (Array.isArray(mysqlRows) && mysqlRows.length > 0) {
      records = mysqlRows
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean)
        .map((entry) => sanitizeAttendanceRecord(entry))
        .filter((entry) => entry.employeeId && entry.date);
    }
  } catch (error) {
    console.error('MySQL attendance read failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch attendance from MySQL' });
  }

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

app.post('/api/attendance', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for attendance module' });
  }
  const employeeId = String(req.body?.employeeId || '').trim();
  const date = String(req.body?.date || '').trim();
  if (!employeeId || !date) {
    return res.status(400).json({ error: 'employeeId and date are required' });
  }

  const employee = await fetchEmployeeByAnyId(employeeId);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee';
  let existingExternalId = '';
  try {
    const foundId = await withMysqlConnection(async (conn) => {
      await ensureAttendanceTable(conn);
      const [rows] = await conn.query(
        `SELECT external_id
           FROM attendance
          WHERE employee_external_id = ? AND attendance_date = ?
          ORDER BY id DESC
          LIMIT 1`,
        [employeeId, date]
      );
      return String(rows?.[0]?.external_id || '').trim();
    });
    existingExternalId = String(foundId || '').trim();
  } catch (error) {
    console.error('MySQL attendance lookup failed, fallback to JSON lookup:', error.message);
  }

  if (!existingExternalId) {
    const existingJsonRecord = readJsonFile(attendanceFile, []).find(
      (entry) => String(entry?.employeeId || '').trim() === employeeId && String(entry?.date || '').trim() === date
    );
    existingExternalId = String(existingJsonRecord?._id || '').trim();
  }

  const nextRecord = sanitizeAttendanceRecord({
    _id: req.body?._id || existingExternalId || `ATT-${Date.now()}`,
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

  try {
    await syncAttendanceToMysql(nextRecord);
  } catch (error) {
    console.error('MySQL attendance write failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to save attendance in MySQL' });
  }

  // Keep JSON in sync as fallback cache, but MySQL is source of truth.
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

app.get('/api/jobs', async (req, res) => {
  const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
  const filterJobs = (jobs) => {
    if (includeInactive) return jobs;
    return jobs.filter((job) => {
      const status = String(job?.status || '').trim().toLowerCase();
      if (job?.isDeleted || job?.deletedAt) return false;
      return !['completed', 'deleted', 'cancelled', 'canceled', 'archived', 'closed'].includes(status);
    });
  };

  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query('SELECT payload FROM jobs ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    if (Array.isArray(mysqlRows) && mysqlRows.length > 0) {
      const parsed = mysqlRows
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean);
      if (parsed.length > 0) return res.json(filterJobs(parsed));
    }
  } catch (error) {
    console.error('MySQL jobs read failed, using JSON fallback:', error.message);
  }

  const jobs = readJsonFile(jobsFile, []);
  res.json(filterJobs(jobs));
});

app.post('/api/jobs', async (req, res) => {
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

  try {
    await syncJobToMysql(newJob);
  } catch (error) {
    console.error('MySQL job write failed (JSON saved):', error.message);
  }

  // Google sync should never block job creation response.
  syncJobGoogleTaskSafely(newJob, {
    markCompleted: String(newJob.status || '').trim().toLowerCase() === 'completed'
  }).then(() => {
    syncJobToMysql(newJob).catch((error) => {
      console.error('MySQL re-sync after Google sync failed:', error.message);
    });
  }).catch((error) => {
    console.error('Background Google sync failed on create:', error.message);
  });

  res.json(newJob);
});

app.put('/api/jobs/:id', async (req, res) => {
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

  try {
    await syncJobToMysql(updatedJob);
    if (nextStatus === 'completed') {
      const scheduleKey = String(updatedJob.scheduleKey || '').trim();
      const technicianId = String(updatedJob.technicianId || '').trim();
      await Promise.all(
        jobs
          .filter((job) => {
            if (String(job?._id || '') === String(updatedJob._id || '')) return false;
            if (String(job?.status || '').trim().toLowerCase() !== 'completed') return false;
            return String(job?.scheduleKey || '').trim() === scheduleKey
              && String(job?.technicianId || '').trim() === technicianId;
          })
          .map(async (job) => {
            await syncJobToMysql(job);
          })
      );
    }
  } catch (error) {
    console.error('MySQL job update failed (JSON saved):', error.message);
  }

  // Google sync should never block completion/update response.
  syncJobGoogleTaskSafely(updatedJob, { markCompleted: nextStatus === 'completed' }).then(() => {
    syncJobToMysql(updatedJob).catch((error) => {
      console.error('MySQL re-sync after Google sync failed:', error.message);
    });
  }).catch((error) => {
    console.error('Background Google sync failed on update:', error.message);
  });

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

const parseMysqlJsonPayload = (rawPayload) => {
  if (!rawPayload) return null;
  if (typeof rawPayload === 'string') {
    try { return JSON.parse(rawPayload); } catch { return null; }
  }
  if (typeof rawPayload === 'object') return rawPayload;
  return null;
};

const normalizeItemRecord = (input = {}, fallbackExternalId = '') => {
  const source = (input && typeof input === 'object') ? input : {};
  const externalId = String(source._id || source.external_id || fallbackExternalId || `ITEM-${Date.now()}`).trim();
  const itemType = String(source.itemType || source.item_type || 'service').trim() || 'service';
  const isServiceItem = itemType.toLowerCase() === 'service';
  const nowIso = new Date().toISOString();
  return {
    _id: externalId,
    name: String(source.name || '').trim(),
    itemType,
    treatmentMethod: isServiceItem ? String(source.treatmentMethod || source.treatment_method || '').trim() : '',
    pestsCovered: isServiceItem ? String(source.pestsCovered || source.pests_covered || '').trim() : '',
    serviceDescription: isServiceItem ? String(source.serviceDescription || source.service_description || '').trim() : '',
    unit: String(source.unit || '').trim(),
    sac: String(source.sac || '').trim(),
    hsnSac: String(source.hsnSac || source.hsn_sac || '').trim(),
    taxPreference: String(source.taxPreference || source.tax_preference || 'Taxable').trim() || 'Taxable',
    sellable: source.sellable !== false,
    purchasable: source.purchasable !== false,
    salesAccount: String(source.salesAccount || source.sales_account || 'Sales').trim() || 'Sales',
    purchaseAccount: String(source.purchaseAccount || source.purchase_account || 'Cost of Goods Sold').trim() || 'Cost of Goods Sold',
    preferredVendor: String(source.preferredVendor || source.preferred_vendor || '').trim(),
    salesDescription: String(source.salesDescription || source.sales_description || '').trim(),
    purchaseInfoDescription: String(source.purchaseInfoDescription || source.purchase_info_description || '').trim(),
    intraTaxRate: String(source.intraTaxRate || source.intra_tax_rate || '18%').trim() || '18%',
    interTaxRate: String(source.interTaxRate || source.inter_tax_rate || '18%').trim() || '18%',
    purchaseDescription: String(source.purchaseDescription || source.purchase_description || '').trim(),
    purchaseRate: Number(source.purchaseRate || source.purchase_rate || 0),
    description: String(source.description || '').trim(),
    rate: Number(source.rate || 0),
    createdAt: source.createdAt || source.created_at || nowIso,
    updatedAt: nowIso
  };
};

const upsertItemRow = async (conn, item) => {
  await conn.query(
    `INSERT INTO items (
      external_id, name, item_type, treatment_method, pests_covered, service_description,
      unit, sac, hsn_sac, tax_preference, sellable, purchasable, sales_account, purchase_account,
      preferred_vendor, sales_description, purchase_description, purchase_rate, description, rate, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name=VALUES(name),
      item_type=VALUES(item_type),
      treatment_method=VALUES(treatment_method),
      pests_covered=VALUES(pests_covered),
      service_description=VALUES(service_description),
      unit=VALUES(unit),
      sac=VALUES(sac),
      hsn_sac=VALUES(hsn_sac),
      tax_preference=VALUES(tax_preference),
      sellable=VALUES(sellable),
      purchasable=VALUES(purchasable),
      sales_account=VALUES(sales_account),
      purchase_account=VALUES(purchase_account),
      preferred_vendor=VALUES(preferred_vendor),
      sales_description=VALUES(sales_description),
      purchase_description=VALUES(purchase_description),
      purchase_rate=VALUES(purchase_rate),
      description=VALUES(description),
      rate=VALUES(rate),
      payload=VALUES(payload)
    `,
    [
      item._id,
      item.name,
      item.itemType,
      item.treatmentMethod,
      item.pestsCovered,
      item.serviceDescription,
      item.unit,
      item.sac,
      item.hsnSac,
      item.taxPreference,
      item.sellable ? 1 : 0,
      item.purchasable ? 1 : 0,
      item.salesAccount,
      item.purchaseAccount,
      item.preferredVendor,
      item.salesDescription,
      item.purchaseDescription,
      Number.isFinite(item.purchaseRate) ? item.purchaseRate : 0,
      item.description,
      Number.isFinite(item.rate) ? item.rate : 0,
      JSON.stringify(item)
    ]
  );
};

app.get('/api/items', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for items module' });
  }
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query('SELECT payload FROM items ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    const parsed = (Array.isArray(mysqlRows) ? mysqlRows : [])
      .map((row) => normalizeItemRecord(parseMysqlJsonPayload(row?.payload) || {}))
      .filter((item) => String(item._id || '').trim());
    return res.json(parsed);
  } catch (error) {
    console.error('Failed to fetch items from MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/items', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for items module' });
  }
  try {
    const newItem = normalizeItemRecord(req.body || {});
    await withMysqlConnection(async (conn) => {
      await upsertItemRow(conn, newItem);
    });
    return res.json(newItem);
  } catch (error) {
    console.error('Failed to create item in MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to create item' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for items module' });
  }
  try {
    const itemId = String(req.params.id || '').trim();
    const mysqlMatch = await withMysqlConnection(async (conn) => {
      const isNumeric = /^\d+$/.test(itemId);
      const query = isNumeric
        ? 'SELECT payload, external_id FROM items WHERE id = ? OR external_id = ? LIMIT 1'
        : 'SELECT payload, external_id FROM items WHERE external_id = ? LIMIT 1';
      const params = isNumeric ? [Number(itemId), itemId] : [itemId];
      const [rows] = await conn.query(query, params);
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    });

    if (!mysqlMatch) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const existing = normalizeItemRecord(parseMysqlJsonPayload(mysqlMatch.payload) || {}, mysqlMatch.external_id || itemId);
    const merged = normalizeItemRecord({
      ...existing,
      ...(req.body && typeof req.body === 'object' ? req.body : {}),
      _id: existing._id
    }, existing._id);

    await withMysqlConnection(async (conn) => {
      await upsertItemRow(conn, merged);
    });

    return res.json(merged);
  } catch (error) {
    console.error('Failed to update item in MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  if (!canUseMysql()) {
    return res.status(500).json({ error: 'MySQL is not configured for items module' });
  }
  try {
    const itemId = String(req.params.id || '').trim();
    const deletedRows = await withMysqlConnection(async (conn) => {
      const isNumeric = /^\d+$/.test(itemId);
      const query = isNumeric
        ? 'DELETE FROM items WHERE id = ? OR external_id = ?'
        : 'DELETE FROM items WHERE external_id = ?';
      const params = isNumeric ? [Number(itemId), itemId] : [itemId];
      const [result] = await conn.query(query, params);
      return Number(result?.affectedRows || 0);
    });

    if (!deletedRows) {
      return res.status(404).json({ error: 'Item not found' });
    }
    return res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Failed to delete item in MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      await ensureCustomerPlaceColumns(conn);
      const [rows] = await conn.query('SELECT payload FROM customers ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    if (Array.isArray(mysqlRows) && mysqlRows.length > 0) {
      const parsed = mysqlRows
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean);
      if (parsed.length > 0) return res.json(parsed);
    }
  } catch (error) {
    console.error('MySQL customers read failed, using JSON fallback:', error.message);
  }
  res.json(readJsonFile(customersFile, []));
});

app.post('/api/customers', async (req, res) => {
  try {
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
    const nowIso = new Date().toISOString();
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
      googlePlaceId: req.body.googlePlaceId || req.body.google_place_id || '',
      googlePlaceName: req.body.googlePlaceName || req.body.google_place_name || '',
      googlePhone: req.body.googlePhone || req.body.google_phone || '',
      googleWebsite: req.body.googleWebsite || req.body.google_website || '',
      latitude: req.body.latitude || '',
      longitude: req.body.longitude || '',
      createdAt: nowIso
    };

    await withMysqlConnection(async (conn) => {
      await ensureCustomerPlaceColumns(conn);
      await conn.query(
        `INSERT INTO customers (
          external_id, display_name, customer_name, company_name, contact_person_name, mobile_number,
          whatsapp_number, email_id, area_name, city, state, pincode,
          google_place_id, google_place_name, google_phone, google_website, latitude, longitude,
          payload, source_created_at, source_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          display_name=VALUES(display_name),
          customer_name=VALUES(customer_name),
          company_name=VALUES(company_name),
          contact_person_name=VALUES(contact_person_name),
          mobile_number=VALUES(mobile_number),
          whatsapp_number=VALUES(whatsapp_number),
          email_id=VALUES(email_id),
          area_name=VALUES(area_name),
          city=VALUES(city),
          state=VALUES(state),
          pincode=VALUES(pincode),
          google_place_id=VALUES(google_place_id),
          google_place_name=VALUES(google_place_name),
          google_phone=VALUES(google_phone),
          google_website=VALUES(google_website),
          latitude=VALUES(latitude),
          longitude=VALUES(longitude),
          payload=VALUES(payload),
          source_created_at=VALUES(source_created_at),
          source_updated_at=VALUES(source_updated_at)`,
        [
          newCustomer._id,
          newCustomer.displayName || null,
          newCustomer.name || null,
          newCustomer.companyName || null,
          newCustomer.contactPersonName || null,
          newCustomer.mobileNumber || null,
          newCustomer.whatsappNumber || null,
          newCustomer.emailId || null,
          newCustomer.billingArea || newCustomer.area || null,
          newCustomer.city || null,
          newCustomer.state || newCustomer.billingState || null,
          newCustomer.pincode || newCustomer.billingPincode || null,
          newCustomer.googlePlaceId || null,
          newCustomer.googlePlaceName || null,
          newCustomer.googlePhone || null,
          newCustomer.googleWebsite || null,
          newCustomer.latitude ? Number(newCustomer.latitude) : null,
          newCustomer.longitude ? Number(newCustomer.longitude) : null,
          JSON.stringify(newCustomer),
          new Date(newCustomer.createdAt).toISOString().slice(0, 19).replace('T', ' '),
          new Date(newCustomer.createdAt).toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
    });

    return res.json(newCustomer);
  } catch (error) {
    console.error('Failed to create customer in MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const existingCustomer = await withMysqlConnection(async (conn) => {
      await ensureCustomerPlaceColumns(conn);
      const [rows] = await conn.query('SELECT payload FROM customers WHERE external_id = ? LIMIT 1', [req.params.id]);
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!row?.payload) return null;
      if (typeof row.payload === 'string') {
        try { return JSON.parse(row.payload); } catch { return null; }
      }
      return row.payload;
    });

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updatedCustomer = {
      ...existingCustomer,
      ...req.body,
      _id: existingCustomer._id || req.params.id,
      displayName:
        (req.body.displayName || '').trim() ||
        req.body.contactPersonName ||
        req.body.companyName ||
        req.body.name ||
        existingCustomer.displayName ||
        existingCustomer.name ||
        '',
      name:
        (req.body.displayName || '').trim() ||
        req.body.contactPersonName ||
        req.body.companyName ||
        req.body.name ||
        existingCustomer.name ||
        '',
      position:
        req.body.position === 'Edit type'
          ? (req.body.positionCustom || '').trim() || 'Edit type'
          : (req.body.position ?? existingCustomer.position ?? ''),
      emailId: req.body.emailId ?? req.body.email ?? existingCustomer.emailId ?? existingCustomer.email ?? '',
      email: req.body.emailId ?? req.body.email ?? existingCustomer.email ?? existingCustomer.emailId ?? '',
      mobileNumber: req.body.mobileNumber ?? req.body.workPhone ?? existingCustomer.mobileNumber ?? existingCustomer.workPhone ?? '',
      workPhone: req.body.mobileNumber ?? req.body.workPhone ?? existingCustomer.workPhone ?? existingCustomer.mobileNumber ?? '',
      billingArea: req.body.billingArea ?? req.body.area ?? existingCustomer.billingArea ?? existingCustomer.area ?? '',
      billingState: req.body.billingState ?? req.body.state ?? req.body.placeOfSupply ?? existingCustomer.billingState ?? existingCustomer.state ?? existingCustomer.placeOfSupply ?? '',
      billingPincode: req.body.billingPincode ?? req.body.pincode ?? existingCustomer.billingPincode ?? existingCustomer.pincode ?? '',
      shippingArea: req.body.shippingArea ?? existingCustomer.shippingArea ?? '',
      shippingState: req.body.shippingState ?? existingCustomer.shippingState ?? '',
      shippingPincode: req.body.shippingPincode ?? existingCustomer.shippingPincode ?? '',
      state: req.body.billingState ?? req.body.state ?? req.body.placeOfSupply ?? existingCustomer.state ?? existingCustomer.placeOfSupply ?? '',
      placeOfSupply: req.body.billingState ?? req.body.state ?? req.body.placeOfSupply ?? existingCustomer.placeOfSupply ?? existingCustomer.state ?? '',
      hasGst: req.body.hasGst ?? req.body.gstRegistered ?? existingCustomer.hasGst ?? existingCustomer.gstRegistered ?? false,
      gstRegistered: req.body.hasGst ?? req.body.gstRegistered ?? existingCustomer.gstRegistered ?? existingCustomer.hasGst ?? false,
      gstNumber:
        (req.body.hasGst ?? req.body.gstRegistered ?? existingCustomer.hasGst ?? existingCustomer.gstRegistered)
          ? (req.body.gstNumber ?? existingCustomer.gstNumber ?? '')
          : '',
      areaSqft: Number(req.body.areaSqft ?? existingCustomer.areaSqft ?? 0),
      receivables: Number(req.body.receivables ?? existingCustomer.receivables ?? 0),
      unusedCredits: Number(req.body.unusedCredits ?? existingCustomer.unusedCredits ?? 0)
    };

    await withMysqlConnection(async (conn) => {
      await ensureCustomerPlaceColumns(conn);
      await conn.query(
        `INSERT INTO customers (
          external_id, display_name, customer_name, company_name, contact_person_name, mobile_number,
          whatsapp_number, email_id, area_name, city, state, pincode,
          google_place_id, google_place_name, google_phone, google_website, latitude, longitude,
          payload, source_created_at, source_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          display_name=VALUES(display_name),
          customer_name=VALUES(customer_name),
          company_name=VALUES(company_name),
          contact_person_name=VALUES(contact_person_name),
          mobile_number=VALUES(mobile_number),
          whatsapp_number=VALUES(whatsapp_number),
          email_id=VALUES(email_id),
          area_name=VALUES(area_name),
          city=VALUES(city),
          state=VALUES(state),
          pincode=VALUES(pincode),
          google_place_id=VALUES(google_place_id),
          google_place_name=VALUES(google_place_name),
          google_phone=VALUES(google_phone),
          google_website=VALUES(google_website),
          latitude=VALUES(latitude),
          longitude=VALUES(longitude),
          payload=VALUES(payload),
          source_created_at=VALUES(source_created_at),
          source_updated_at=VALUES(source_updated_at)`,
        [
          updatedCustomer._id,
          updatedCustomer.displayName || null,
          updatedCustomer.name || null,
          updatedCustomer.companyName || null,
          updatedCustomer.contactPersonName || null,
          updatedCustomer.mobileNumber || null,
          updatedCustomer.whatsappNumber || null,
          updatedCustomer.emailId || null,
          updatedCustomer.billingArea || updatedCustomer.area || null,
          updatedCustomer.city || null,
          updatedCustomer.state || updatedCustomer.billingState || null,
          updatedCustomer.pincode || updatedCustomer.billingPincode || null,
          updatedCustomer.googlePlaceId || null,
          updatedCustomer.googlePlaceName || null,
          updatedCustomer.googlePhone || null,
          updatedCustomer.googleWebsite || null,
          updatedCustomer.latitude ? Number(updatedCustomer.latitude) : null,
          updatedCustomer.longitude ? Number(updatedCustomer.longitude) : null,
          JSON.stringify(updatedCustomer),
          updatedCustomer.createdAt ? new Date(updatedCustomer.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
    });

    return res.json(updatedCustomer);
  } catch (error) {
    console.error('Failed to update customer in MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const deletedRows = await withMysqlConnection(async (conn) => {
      const [result] = await conn.query('DELETE FROM customers WHERE external_id = ?', [req.params.id]);
      return Number(result?.affectedRows || 0);
    });

    if (!deletedRows) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Failed to delete customer in MySQL:', error.message);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
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

const loadCurrentSettingsForNumbering = async () => {
  if (canUseMysql()) {
    try {
      return await readSettingsFromMysql();
    } catch (error) {
      console.error('Failed to load settings from MySQL for invoice numbering, using JSON fallback:', error.message);
    }
  }
  return readSettings();
};

const updateSettingsNextInvoiceNumber = async (usedInvoiceNumber, settings) => {
  const seq = extractInvoiceSequence(usedInvoiceNumber, settings.invoicePrefix);
  if (!Number.isFinite(seq)) return;
  const nextValue = Math.max(1, Number(settings.invoiceNextNumber || defaultSettings.invoiceNextNumber));
  if (seq >= nextValue) {
    const updated = {
      ...settings,
      invoiceNextNumber: seq + 1
    };
    if (canUseMysql()) {
      await saveSettingsToMysql(updated);
    } else {
      fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
    }
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

const parseMysqlPayloadObject = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (typeof raw === 'object') return raw;
  return null;
};

const loadInvoicesForContext = async () => {
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query('SELECT payload FROM invoices ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    const parsed = (Array.isArray(mysqlRows) ? mysqlRows : [])
      .map((row) => parseMysqlPayloadObject(row?.payload))
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  } catch (error) {
    console.error('Invoice context MySQL load failed, using JSON fallback:', error.message);
  }
  return readJsonFile(invoicesFile, []);
};

const loadCustomersForContext = async () => {
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query('SELECT payload FROM customers ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    const parsed = (Array.isArray(mysqlRows) ? mysqlRows : [])
      .map((row) => parseMysqlPayloadObject(row?.payload))
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  } catch (error) {
    console.error('Customer context MySQL load failed, using JSON fallback:', error.message);
  }
  return readJsonFile(customersFile, []);
};

const resolveInvoiceContext = async (invoiceId) => {
  const invoices = await loadInvoicesForContext();
  const invoice = (Array.isArray(invoices) ? invoices : []).find((entry) => String(entry?._id || '') === String(invoiceId || ''));
  if (!invoice) return null;

  const customers = await loadCustomersForContext();
  const customer = (Array.isArray(customers) ? customers : []).find((entry) =>
    (invoice.customerId && String(entry?._id || '') === String(invoice.customerId || '')) ||
    String(entry?.displayName || entry?.name || '').trim().toLowerCase() === String(invoice.customerName || '').trim().toLowerCase()
  ) || null;

  let settings = readSettings();
  try {
    settings = await readSettingsFromMysql();
  } catch (error) {
    console.error('Settings context MySQL load failed, using fallback:', error.message);
  }

  return {
    invoice,
    customer,
    settings
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

const sendPasswordResetOtpEmail = async ({ settings, recipient, otp }) => {
  const mailConfig = resolveEmailConfig(settings);
  if (mailConfig.active === 'No') {
    throw new Error('Email sender is disabled in settings.');
  }
  if (!mailConfig.host || !mailConfig.user || !mailConfig.pass || !mailConfig.fromEmail) {
    throw new Error('SMTP settings are incomplete.');
  }

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
    subject: 'SKUAS CRM Password Reset OTP',
    text: `Your SKUAS CRM password reset OTP is ${otp}. It will expire in 10 minutes.`,
    html: `<p>Your SKUAS CRM password reset OTP is <b>${otp}</b>.</p><p>This OTP will expire in 10 minutes.</p>`
  });
};

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

const syncInvoiceToMysql = async (invoice) => {
  if (!invoice || !invoice._id) return;
  await withMysqlConnection(async (conn) => {
    await conn.query(
      `INSERT INTO invoices (
        external_id, customer_external_id, customer_name, invoice_number, invoice_type, invoice_status,
        invoice_date, due_date, total_amount, balance_due, payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_external_id=VALUES(customer_external_id),
        customer_name=VALUES(customer_name),
        invoice_number=VALUES(invoice_number),
        invoice_type=VALUES(invoice_type),
        invoice_status=VALUES(invoice_status),
        invoice_date=VALUES(invoice_date),
        due_date=VALUES(due_date),
        total_amount=VALUES(total_amount),
        balance_due=VALUES(balance_due),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        invoice._id,
        invoice.customerId || null,
        invoice.customerName || null,
        invoice.invoiceNumber || null,
        invoice.invoiceType || null,
        invoice.status || null,
        invoice.date || null,
        invoice.dueDate || null,
        toNumber(invoice.total ?? invoice.amount, 0),
        toNumber(invoice.balanceDue, 0),
        JSON.stringify(invoice),
        invoice.createdAt ? new Date(invoice.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
        new Date().toISOString().slice(0, 19).replace('T', ' ')
      ]
    );

    await conn.query('DELETE FROM invoice_items WHERE invoice_external_id = ?', [invoice._id]);
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] || {};
      await conn.query(
        `INSERT INTO invoice_items (
          invoice_external_id, line_index, item_id, item_name, description, quantity, rate, tax_rate, amount, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoice._id,
          i,
          item.itemId || null,
          item.itemName || item.name || null,
          item.description || null,
          toNumber(item.quantity, 0),
          toNumber(item.rate, 0),
          toNumber(item.taxRate, 0),
          toNumber(item.amount, toNumber(item.quantity, 0) * toNumber(item.rate, 0)),
          JSON.stringify(item)
        ]
      );
    }
  });
};

const syncJobToMysql = async (job) => {
  if (!job || !job._id) return;
  await withMysqlConnection(async (conn) => {
    await ensureJobsGoogleColumns(conn);
    await conn.query(
      `INSERT INTO jobs (
        external_id, customer_external_id, invoice_external_id, customer_name, job_number, status,
        service_name, service_type, area_name, city, state, pincode, scheduled_date, scheduled_time,
        google_task_id, google_sync_status, google_last_synced_at,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_external_id=VALUES(customer_external_id),
        invoice_external_id=VALUES(invoice_external_id),
        customer_name=VALUES(customer_name),
        job_number=VALUES(job_number),
        status=VALUES(status),
        service_name=VALUES(service_name),
        service_type=VALUES(service_type),
        area_name=VALUES(area_name),
        city=VALUES(city),
        state=VALUES(state),
        pincode=VALUES(pincode),
        scheduled_date=VALUES(scheduled_date),
        scheduled_time=VALUES(scheduled_time),
        google_task_id=VALUES(google_task_id),
        google_sync_status=VALUES(google_sync_status),
        google_last_synced_at=VALUES(google_last_synced_at),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        job._id,
        job.customerId || null,
        job.invoiceId || null,
        job.customerName || null,
        job.jobNumber || null,
        job.status || null,
        job.serviceName || null,
        job.serviceType || null,
        job.areaName || null,
        job.city || null,
        job.state || null,
        job.pincode || null,
        job.serviceDate || null,
        job.serviceTime || null,
        job.google_task_id || null,
        job.google_sync_status || null,
        job.google_last_synced_at ? new Date(job.google_last_synced_at).toISOString().slice(0, 19).replace('T', ' ') : null,
        JSON.stringify(job),
        job.createdAt ? new Date(job.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
        new Date().toISOString().slice(0, 19).replace('T', ' ')
      ]
    );
  });
};

const ensureAttendanceTable = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      employee_external_id VARCHAR(120) NULL,
      employee_code VARCHAR(120) NULL,
      employee_name VARCHAR(255) NULL,
      attendance_date DATE NULL,
      status VARCHAR(80) NULL,
      check_in TIME NULL,
      check_out TIME NULL,
      working_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
      payload JSON NULL,
      source_created_at DATETIME NULL,
      source_updated_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_attendance_external_id (external_id),
      KEY idx_attendance_employee_date (employee_external_id, attendance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const syncJobGoogleTaskSafely = async (job, options = {}) => {
  if (!job || !job._id || !canUseMysql()) return job;
  const markCompleted = Boolean(options.markCompleted);
  try {
    const result = await withMysqlConnection(async (conn) => {
      const syncData = await syncGoogleTaskForJob({ conn, job, markCompleted });
      if (syncData?.google_task_id) {
        return {
          google_task_id: syncData.google_task_id,
          google_sync_status: syncData.google_sync_status || 'synced',
          google_last_synced_at: syncData.google_last_synced_at || new Date().toISOString()
        };
      }
      return null;
    });
    if (result) {
      job.google_task_id = result.google_task_id;
      job.google_sync_status = result.google_sync_status;
      job.google_last_synced_at = result.google_last_synced_at;
    }
  } catch (error) {
    console.error('Google task sync failed:', error.message);
    job.google_sync_status = `error: ${String(error.message || 'sync_failed').slice(0, 120)}`;
    job.google_last_synced_at = new Date().toISOString();
  }
  return job;
};

app.get('/api/google/integration/status', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured' });
  try {
    const data = await withMysqlConnection(async (conn) => {
      await ensureGoogleIntegrationTable(conn);
      const row = await getIntegrationRow(conn);
      return {
        connected: Boolean(row?.encrypted_refresh_token),
        syncEnabled: Number(row?.sync_enabled || 0) === 1,
        googleEmail: row?.google_email || '',
        tasklistId: row?.tasklist_id || ''
      };
    });
    return res.json(data || { connected: false, syncEnabled: false, googleEmail: '', tasklistId: '' });
  } catch (error) {
    console.error('Google integration status failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch Google integration status' });
  }
});

app.get('/api/google/oauth/start', async (req, res) => {
  try {
    const oauth = buildOAuthClient();
    const state = crypto.randomBytes(16).toString('hex');
    googleOauthStateStore.set(state, Date.now());
    const redirectTo = String(req.query.redirect || '/settings').trim() || '/settings';
    googleOauthStateStore.set(`${state}:redirect`, redirectTo);

    const authUrl = oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/tasks',
        'openid',
        'email',
        'profile'
      ],
      state
    });
    return res.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth start failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to start Google OAuth' });
  }
});

app.get('/api/google/oauth/callback', async (req, res) => {
  const state = String(req.query.state || '').trim();
  const code = String(req.query.code || '').trim();
  const stateCreatedAt = Number(googleOauthStateStore.get(state) || 0);
  const redirectTo = String(googleOauthStateStore.get(`${state}:redirect`) || '/settings').trim() || '/settings';
  googleOauthStateStore.delete(state);
  googleOauthStateStore.delete(`${state}:redirect`);

  if (!state || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60 * 1000) {
    return res.status(400).send('Invalid or expired OAuth state. Please retry from Settings.');
  }
  if (!code) return res.status(400).send('Missing OAuth code.');
  if (!canUseMysql()) return res.status(500).send('MySQL is not configured.');

  try {
    const oauth = buildOAuthClient();
    const tokenResponse = await oauth.getToken(code);
    const tokens = tokenResponse?.tokens || {};
    const refreshToken = String(tokens.refresh_token || '').trim();
    if (!refreshToken) {
      return res.status(400).send('Google did not return a refresh token. Please disconnect app from Google and reconnect.');
    }

    const key = normalizeKey(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
    if (!key) return res.status(500).send('GOOGLE_TOKEN_ENCRYPTION_KEY is missing or invalid.');
    const encryptedRefreshToken = encrypt(refreshToken, key);

    oauth.setCredentials(tokens);
    const google = getGoogleClient();
    const tasks = google.tasks({ version: 'v1', auth: oauth });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth });
    const profile = await oauth2.userinfo.get().catch(() => ({ data: {} }));
    const tasklistId = await ensureTaskList(tasks);

    await withMysqlConnection(async (conn) => {
      await ensureGoogleIntegrationTable(conn);
      await saveIntegrationRow(conn, {
        google_email: String(profile?.data?.email || '').trim(),
        encrypted_refresh_token: encryptedRefreshToken,
        tasklist_id: tasklistId,
        sync_enabled: 1
      });
    });

    return res.redirect(`${resolveServerOrigin(req)}${redirectTo.includes('?') ? `${redirectTo}&googleConnected=1` : `${redirectTo}?googleConnected=1`}`);
  } catch (error) {
    console.error('Google OAuth callback failed:', error.message);
    return res.status(500).send(`Google OAuth failed: ${error.message || 'Unknown error'}`);
  }
});

app.post('/api/google/tasks/sync-job/:jobId', async (req, res) => {
  const jobId = String(req.params.jobId || '').trim();
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured' });

  const jobs = readJsonFile(jobsFile, []);
  const index = jobs.findIndex((entry) => String(entry?._id || '') === jobId);
  if (index === -1) return res.status(404).json({ error: 'Job not found' });

  const job = { ...jobs[index] };
  const statusLower = String(job.status || '').trim().toLowerCase();
  const markCompleted = statusLower === 'completed';
  await syncJobGoogleTaskSafely(job, { markCompleted });
  jobs[index] = job;
  fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));

  try {
    await syncJobToMysql(job);
  } catch (error) {
    console.error('MySQL job save failed after Google sync:', error.message);
  }

  return res.json({
    success: true,
    jobId,
    google_task_id: job.google_task_id || '',
    google_sync_status: job.google_sync_status || '',
    google_last_synced_at: job.google_last_synced_at || ''
  });
});

const syncAttendanceToMysql = async (record) => {
  if (!record || !record._id) return;
  await withMysqlConnection(async (conn) => {
    await ensureAttendanceTable(conn);
    await conn.query(
      `INSERT INTO attendance (
        external_id, employee_external_id, employee_code, employee_name, attendance_date, status,
        check_in, check_out, working_hours, payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        employee_external_id=VALUES(employee_external_id),
        employee_code=VALUES(employee_code),
        employee_name=VALUES(employee_name),
        attendance_date=VALUES(attendance_date),
        status=VALUES(status),
        check_in=VALUES(check_in),
        check_out=VALUES(check_out),
        working_hours=VALUES(working_hours),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        record._id,
        record.employeeId || null,
        record.employeeCode || null,
        record.employeeName || null,
        record.date || null,
        record.status || null,
        record.checkIn ? `${record.checkIn}:00` : null,
        record.checkOut ? `${record.checkOut}:00` : null,
        toNumber(record.workingHours, 0),
        JSON.stringify(record),
        record.updatedAt ? new Date(record.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
        new Date().toISOString().slice(0, 19).replace('T', ' ')
      ]
    );
  });
};

app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const context = await resolveInvoiceContext(req.params.id);
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
    const context = await resolveInvoiceContext(req.params.id);
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
    const context = await resolveInvoiceContext(req.params.id);
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

app.get('/api/invoices', async (req, res) => {
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      const [rows] = await conn.query('SELECT payload FROM invoices ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    if (Array.isArray(mysqlRows) && mysqlRows.length > 0) {
      const parsed = mysqlRows
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean);
      if (parsed.length > 0) return res.json(parsed);
    }
  } catch (error) {
    console.error('MySQL invoices read failed, using JSON fallback:', error.message);
  }
  res.json(readJsonFile(invoicesFile, []));
});

const ensureVendorFinanceTables = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      vendor_name VARCHAR(255) NULL,
      company_name VARCHAR(255) NULL,
      contact_person_name VARCHAR(255) NULL,
      mobile VARCHAR(50) NULL,
      whatsapp_number VARCHAR(50) NULL,
      email_id VARCHAR(255) NULL,
      gst_number VARCHAR(80) NULL,
      address TEXT NULL,
      area_name VARCHAR(255) NULL,
      city VARCHAR(120) NULL,
      state VARCHAR(120) NULL,
      pincode VARCHAR(40) NULL,
      google_place_id VARCHAR(255) NULL,
      google_place_name VARCHAR(255) NULL,
      google_phone VARCHAR(50) NULL,
      google_website VARCHAR(255) NULL,
      latitude DECIMAL(10,8) NULL,
      longitude DECIMAL(11,8) NULL,
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(80) NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_vendors_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumnsIfMissing(conn, 'vendors', [
    { name: 'google_place_id', definition: 'VARCHAR(255) NULL' },
    { name: 'google_place_name', definition: 'VARCHAR(255) NULL' },
    { name: 'google_phone', definition: 'VARCHAR(50) NULL' },
    { name: 'google_website', definition: 'VARCHAR(255) NULL' },
    { name: 'latitude', definition: 'DECIMAL(10,8) NULL' },
    { name: 'longitude', definition: 'DECIMAL(11,8) NULL' }
  ]);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS vendor_bills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      vendor_external_id VARCHAR(120) NULL,
      vendor_name VARCHAR(255) NULL,
      bill_number VARCHAR(255) NULL,
      bill_date DATE NULL,
      due_date DATE NULL,
      status VARCHAR(80) NULL,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      balance_due DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_vendor_bills_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS vendor_bill_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bill_external_id VARCHAR(120) NOT NULL,
      line_index INT NOT NULL DEFAULT 0,
      item_name VARCHAR(255) NULL,
      description TEXT NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      rate DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_vendor_bill_items_bill_external_id (bill_external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS payment_received (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      customer_external_id VARCHAR(120) NULL,
      customer_name VARCHAR(255) NULL,
      payment_date DATE NULL,
      payment_mode VARCHAR(120) NULL,
      reference_number VARCHAR(255) NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      linked_invoice_external_id VARCHAR(120) NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_payment_received_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const readMysqlPayload = (rawPayload) => parseMysqlJsonPayload(rawPayload) || {};

app.get('/api/vendors', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendors module' });
  try {
    const result = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [rows] = await conn.query('SELECT * FROM vendors ORDER BY id DESC');
      return (Array.isArray(rows) ? rows : []).map((row) => {
        const payload = readMysqlPayload(row.payload);
        return {
          ...payload,
          _id: String(row.external_id || payload._id || row.id || '').trim(),
          id: row.id,
          vendorName: String(row.vendor_name ?? payload.vendorName ?? payload.displayName ?? '').trim(),
          companyName: String(row.company_name ?? payload.companyName ?? '').trim(),
          contactPersonName: String(row.contact_person_name ?? payload.contactPersonName ?? '').trim(),
          mobileNumber: String(row.mobile ?? payload.mobileNumber ?? '').trim(),
          whatsappNumber: String(row.whatsapp_number ?? payload.whatsappNumber ?? '').trim(),
          emailId: String(row.email_id ?? payload.emailId ?? '').trim(),
          gstNumber: String(row.gst_number ?? payload.gstNumber ?? '').trim(),
          billingAddress: String(row.address ?? payload.billingAddress ?? payload.address ?? '').trim(),
          billingArea: String(row.area_name ?? payload.billingArea ?? payload.areaName ?? '').trim(),
          city: String(row.city ?? payload.city ?? '').trim(),
          state: String(row.state ?? payload.state ?? '').trim(),
          billingPincode: String(row.pincode ?? payload.billingPincode ?? payload.pincode ?? '').trim(),
          googlePlaceId: String(row.google_place_id ?? payload.googlePlaceId ?? payload.google_place_id ?? '').trim(),
          googlePlaceName: String(row.google_place_name ?? payload.googlePlaceName ?? payload.google_place_name ?? '').trim(),
          googlePhone: String(row.google_phone ?? payload.googlePhone ?? payload.google_phone ?? '').trim(),
          googleWebsite: String(row.google_website ?? payload.googleWebsite ?? payload.google_website ?? '').trim(),
          latitude: row.latitude ?? payload.latitude ?? '',
          longitude: row.longitude ?? payload.longitude ?? '',
          openingBalance: toNumber(row.opening_balance ?? payload.openingBalance, 0),
          status: String(row.status ?? payload.status ?? 'active').trim()
        };
      });
    });
    return res.json(result);
  } catch (error) {
    console.error('MySQL vendors read failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch vendors from MySQL' });
  }
});

app.post('/api/vendors', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendors module' });
  try {
    const vendor = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const externalId = String(vendor._id || `VND-${Date.now()}`).trim();
    const mapped = {
      external_id: externalId,
      vendor_name: String(vendor.vendorName || vendor.displayName || vendor.companyName || '').trim(),
      company_name: String(vendor.companyName || '').trim(),
      contact_person_name: String(vendor.contactPersonName || '').trim(),
      mobile: String(vendor.mobileNumber || vendor.mobile || '').trim(),
      whatsapp_number: String(vendor.whatsappNumber || '').trim(),
      email_id: String(vendor.emailId || '').trim(),
      gst_number: String(vendor.gstNumber || '').trim(),
      address: String(vendor.billingAddress || vendor.address || '').trim(),
      area_name: String(vendor.billingArea || vendor.areaName || '').trim(),
      city: String(vendor.city || '').trim(),
      state: String(vendor.state || vendor.billingState || '').trim(),
      pincode: String(vendor.billingPincode || vendor.pincode || '').trim(),
      google_place_id: String(vendor.googlePlaceId || vendor.google_place_id || '').trim(),
      google_place_name: String(vendor.googlePlaceName || vendor.google_place_name || '').trim(),
      google_phone: String(vendor.googlePhone || vendor.google_phone || '').trim(),
      google_website: String(vendor.googleWebsite || vendor.google_website || '').trim(),
      latitude: vendor.latitude !== undefined && vendor.latitude !== '' ? Number(vendor.latitude) : null,
      longitude: vendor.longitude !== undefined && vendor.longitude !== '' ? Number(vendor.longitude) : null,
      opening_balance: toNumber(vendor.openingBalance, 0),
      status: String(vendor.status || 'active').trim()
    };
    const payload = { ...vendor, _id: externalId };
    await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      await conn.query(
        `INSERT INTO vendors (
          external_id, vendor_name, company_name, contact_person_name, mobile, whatsapp_number, email_id, gst_number,
          address, area_name, city, state, pincode,
          google_place_id, google_place_name, google_phone, google_website, latitude, longitude,
          opening_balance, status, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vendor_name=VALUES(vendor_name),
          company_name=VALUES(company_name),
          contact_person_name=VALUES(contact_person_name),
          mobile=VALUES(mobile),
          whatsapp_number=VALUES(whatsapp_number),
          email_id=VALUES(email_id),
          gst_number=VALUES(gst_number),
          address=VALUES(address),
          area_name=VALUES(area_name),
          city=VALUES(city),
          state=VALUES(state),
          pincode=VALUES(pincode),
          google_place_id=VALUES(google_place_id),
          google_place_name=VALUES(google_place_name),
          google_phone=VALUES(google_phone),
          google_website=VALUES(google_website),
          latitude=VALUES(latitude),
          longitude=VALUES(longitude),
          opening_balance=VALUES(opening_balance),
          status=VALUES(status),
          payload=VALUES(payload)`,
        [
          mapped.external_id, mapped.vendor_name, mapped.company_name, mapped.contact_person_name, mapped.mobile,
          mapped.whatsapp_number, mapped.email_id, mapped.gst_number, mapped.address, mapped.area_name, mapped.city,
          mapped.state, mapped.pincode, mapped.google_place_id, mapped.google_place_name, mapped.google_phone, mapped.google_website, mapped.latitude, mapped.longitude, mapped.opening_balance, mapped.status, JSON.stringify(payload)
        ]
      );
    });
    return res.status(201).json(payload);
  } catch (error) {
    console.error('MySQL vendors write failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to save vendor in MySQL' });
  }
});

app.put('/api/vendors/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendors module' });
  try {
    const vendorId = String(req.params.id || '').trim();
    const vendor = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const payload = { ...vendor, _id: String(vendor._id || vendorId).trim() };
    const numericId = Number(vendorId);
    const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
    const [result] = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      return conn.query(
        `UPDATE vendors SET
          external_id=?, vendor_name=?, company_name=?, contact_person_name=?, mobile=?, whatsapp_number=?, email_id=?, gst_number=?,
          address=?, area_name=?, city=?, state=?, pincode=?, google_place_id=?, google_place_name=?, google_phone=?, google_website=?, latitude=?, longitude=?, opening_balance=?, status=?, payload=?
         WHERE external_id = ? OR id = ?`,
        [
          payload._id,
          String(payload.vendorName || payload.displayName || payload.companyName || '').trim(),
          String(payload.companyName || '').trim(),
          String(payload.contactPersonName || '').trim(),
          String(payload.mobileNumber || payload.mobile || '').trim(),
          String(payload.whatsappNumber || '').trim(),
          String(payload.emailId || '').trim(),
          String(payload.gstNumber || '').trim(),
          String(payload.billingAddress || payload.address || '').trim(),
          String(payload.billingArea || payload.areaName || '').trim(),
          String(payload.city || '').trim(),
          String(payload.state || payload.billingState || '').trim(),
          String(payload.billingPincode || payload.pincode || '').trim(),
          String(payload.googlePlaceId || payload.google_place_id || '').trim(),
          String(payload.googlePlaceName || payload.google_place_name || '').trim(),
          String(payload.googlePhone || payload.google_phone || '').trim(),
          String(payload.googleWebsite || payload.google_website || '').trim(),
          payload.latitude !== undefined && payload.latitude !== '' ? Number(payload.latitude) : null,
          payload.longitude !== undefined && payload.longitude !== '' ? Number(payload.longitude) : null,
          toNumber(payload.openingBalance, 0),
          String(payload.status || 'active').trim(),
          JSON.stringify(payload),
          vendorId,
          safeNumericId
        ]
      );
    });
    if (!Number(result?.affectedRows || 0)) return res.status(404).json({ error: 'Vendor not found' });
    return res.json(payload);
  } catch (error) {
    console.error('MySQL vendors update failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to update vendor in MySQL' });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendors module' });
  try {
    const vendorId = String(req.params.id || '').trim();
    const numericId = Number(vendorId);
    const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
    const deletedRows = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [result] = await conn.query('DELETE FROM vendors WHERE external_id = ? OR id = ?', [vendorId, safeNumericId]);
      return Number(result?.affectedRows || 0);
    });
    if (!deletedRows) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('MySQL vendors delete failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete vendor from MySQL' });
  }
});

app.get('/api/vendor-bills', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendor bills module' });
  try {
    const bills = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [rows] = await conn.query('SELECT * FROM vendor_bills ORDER BY id DESC');
      const [itemRows] = await conn.query('SELECT * FROM vendor_bill_items ORDER BY line_index ASC, id ASC');
      const [catalogRows] = await conn.query('SELECT external_id, name, description, rate, payload FROM items');
      const itemCatalogById = new Map();
      const itemCatalogByName = new Map();
      (Array.isArray(catalogRows) ? catalogRows : []).forEach((catalogRow) => {
        const catalogPayload = readMysqlPayload(catalogRow.payload);
        const externalId = String(catalogRow.external_id || catalogPayload._id || '').trim();
        const name = String(catalogRow.name || catalogPayload.name || '').trim();
        const normalized = {
          _id: externalId,
          name,
          description: String(catalogRow.description || catalogPayload.description || '').trim(),
          rate: toNumber(catalogRow.rate ?? catalogPayload.rate, 0)
        };
        if (externalId) itemCatalogById.set(externalId, normalized);
        if (name) itemCatalogByName.set(name.toLowerCase(), normalized);
      });
      const itemsByBill = (Array.isArray(itemRows) ? itemRows : []).reduce((acc, itemRow) => {
        const key = String(itemRow.bill_external_id || '').trim();
        if (!acc[key]) acc[key] = [];
        const itemPayload = readMysqlPayload(itemRow.payload);
        const itemId = String(itemPayload.itemId || itemPayload._id || '').trim();
        const itemName = String(itemRow.item_name ?? itemPayload.itemName ?? '').trim();
        const catalogMatch = itemCatalogById.get(itemId) || itemCatalogByName.get(itemName.toLowerCase()) || null;
        acc[key].push({
          ...itemPayload,
          itemId: itemId || String(catalogMatch?._id || '').trim(),
          itemName: itemName || String(catalogMatch?.name || '').trim(),
          description: String(itemRow.description ?? itemPayload.description ?? catalogMatch?.description ?? '').trim(),
          quantity: toNumber(itemRow.quantity ?? itemPayload.quantity, 0),
          rate: toNumber(itemRow.rate ?? itemPayload.rate ?? catalogMatch?.rate, 0),
          taxRate: toNumber(itemRow.tax_rate ?? itemPayload.taxRate, 0),
          amount: toNumber(itemRow.amount ?? itemPayload.amount, 0)
        });
        return acc;
      }, {});
      return (Array.isArray(rows) ? rows : []).map((row) => {
        const payload = readMysqlPayload(row.payload);
        const externalId = String(row.external_id || payload._id || row.id || '').trim();
        return {
          ...payload,
          _id: externalId,
          id: row.id,
          vendorId: String(row.vendor_external_id ?? payload.vendorId ?? '').trim(),
          vendorName: String(row.vendor_name ?? payload.vendorName ?? '').trim(),
          billNumber: String(row.bill_number ?? payload.billNumber ?? '').trim(),
          date: String(row.bill_date ?? payload.date ?? '').trim(),
          dueDate: String(row.due_date ?? payload.dueDate ?? '').trim(),
          status: String(row.status ?? payload.status ?? '').trim(),
          subtotal: toNumber(row.subtotal ?? payload.subtotal, 0),
          totalTax: toNumber(row.tax_amount ?? payload.totalTax ?? payload.taxAmount, 0),
          amount: toNumber(row.total_amount ?? payload.amount ?? payload.total, 0),
          total: toNumber(row.total_amount ?? payload.total ?? payload.amount, 0),
          balanceDue: toNumber(row.balance_due ?? payload.balanceDue, 0),
          notes: String(row.notes ?? payload.notes ?? '').trim(),
          items: itemsByBill[externalId] || (Array.isArray(payload.items) ? payload.items : [])
        };
      });
    });
    return res.json(bills);
  } catch (error) {
    console.error('MySQL vendor bills read failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch vendor bills from MySQL' });
  }
});

app.post('/api/vendor-bills', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendor bills module' });
  try {
    const bill = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const externalId = String(bill._id || `VBL-${Date.now()}`).trim();
    const items = Array.isArray(bill.items) ? bill.items : [];
    const payload = { ...bill, _id: externalId, items };
    await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      await conn.query(
        `INSERT INTO vendor_bills (
          external_id, vendor_external_id, vendor_name, bill_number, bill_date, due_date, status, subtotal, tax_amount, total_amount, balance_due, notes, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vendor_external_id=VALUES(vendor_external_id),
          vendor_name=VALUES(vendor_name),
          bill_number=VALUES(bill_number),
          bill_date=VALUES(bill_date),
          due_date=VALUES(due_date),
          status=VALUES(status),
          subtotal=VALUES(subtotal),
          tax_amount=VALUES(tax_amount),
          total_amount=VALUES(total_amount),
          balance_due=VALUES(balance_due),
          notes=VALUES(notes),
          payload=VALUES(payload)`,
        [
          externalId,
          String(payload.vendorId || '').trim(),
          String(payload.vendorName || '').trim(),
          String(payload.billNumber || '').trim(),
          String(payload.date || '').trim() || null,
          String(payload.dueDate || '').trim() || null,
          String(payload.status || '').trim(),
          toNumber(payload.subtotal, 0),
          toNumber(payload.totalTax ?? payload.taxAmount, 0),
          toNumber(payload.amount ?? payload.total, 0),
          toNumber(payload.balanceDue, 0),
          String(payload.notes || '').trim(),
          JSON.stringify(payload)
        ]
      );
      await conn.query('DELETE FROM vendor_bill_items WHERE bill_external_id = ?', [externalId]);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index] && typeof items[index] === 'object' ? items[index] : {};
        await conn.query(
          `INSERT INTO vendor_bill_items (
            bill_external_id, line_index, item_name, description, quantity, rate, tax_rate, amount, payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            externalId,
            index,
            String(item.itemName || '').trim(),
            String(item.description || '').trim(),
            toNumber(item.quantity, 0),
            toNumber(item.rate, 0),
            toNumber(item.taxRate, 0),
            toNumber(item.amount, 0),
            JSON.stringify(item)
          ]
        );
      }
    });
    return res.status(201).json(payload);
  } catch (error) {
    console.error('MySQL vendor bills write failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to save vendor bill in MySQL' });
  }
});

app.put('/api/vendor-bills/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendor bills module' });
  try {
    const billId = String(req.params.id || '').trim();
    const bill = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const externalId = String(bill._id || billId).trim();
    const items = Array.isArray(bill.items) ? bill.items : [];
    const payload = { ...bill, _id: externalId, items };
    const numericId = Number(billId);
    const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
    const affectedRows = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [result] = await conn.query(
        `UPDATE vendor_bills SET
          external_id=?, vendor_external_id=?, vendor_name=?, bill_number=?, bill_date=?, due_date=?, status=?, subtotal=?, tax_amount=?, total_amount=?, balance_due=?, notes=?, payload=?
         WHERE external_id = ? OR id = ?`,
        [
          externalId,
          String(payload.vendorId || '').trim(),
          String(payload.vendorName || '').trim(),
          String(payload.billNumber || '').trim(),
          String(payload.date || '').trim() || null,
          String(payload.dueDate || '').trim() || null,
          String(payload.status || '').trim(),
          toNumber(payload.subtotal, 0),
          toNumber(payload.totalTax ?? payload.taxAmount, 0),
          toNumber(payload.amount ?? payload.total, 0),
          toNumber(payload.balanceDue, 0),
          String(payload.notes || '').trim(),
          JSON.stringify(payload),
          billId,
          safeNumericId
        ]
      );
      if (!Number(result?.affectedRows || 0)) return 0;
      await conn.query('DELETE FROM vendor_bill_items WHERE bill_external_id = ?', [externalId]);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index] && typeof items[index] === 'object' ? items[index] : {};
        await conn.query(
          `INSERT INTO vendor_bill_items (
            bill_external_id, line_index, item_name, description, quantity, rate, tax_rate, amount, payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            externalId,
            index,
            String(item.itemName || '').trim(),
            String(item.description || '').trim(),
            toNumber(item.quantity, 0),
            toNumber(item.rate, 0),
            toNumber(item.taxRate, 0),
            toNumber(item.amount, 0),
            JSON.stringify(item)
          ]
        );
      }
      return Number(result?.affectedRows || 0);
    });
    if (!affectedRows) return res.status(404).json({ error: 'Vendor bill not found' });
    return res.json(payload);
  } catch (error) {
    console.error('MySQL vendor bills update failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to update vendor bill in MySQL' });
  }
});

app.delete('/api/vendor-bills/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for vendor bills module' });
  try {
    const billId = String(req.params.id || '').trim();
    const numericId = Number(billId);
    const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
    const deletedRows = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [rows] = await conn.query('SELECT external_id FROM vendor_bills WHERE external_id = ? OR id = ? LIMIT 1', [billId, safeNumericId]);
      const externalId = Array.isArray(rows) && rows[0] ? String(rows[0].external_id || '').trim() : '';
      const [result] = await conn.query('DELETE FROM vendor_bills WHERE external_id = ? OR id = ?', [billId, safeNumericId]);
      if (externalId) {
        await conn.query('DELETE FROM vendor_bill_items WHERE bill_external_id = ?', [externalId]);
      }
      return Number(result?.affectedRows || 0);
    });
    if (!deletedRows) return res.status(404).json({ error: 'Vendor bill not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('MySQL vendor bills delete failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete vendor bill from MySQL' });
  }
});

app.get('/api/payment-received', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for payment received module' });
  try {
    const payments = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [rows] = await conn.query('SELECT * FROM payment_received ORDER BY id DESC');
      return (Array.isArray(rows) ? rows : []).map((row) => {
        const payload = readMysqlPayload(row.payload);
        return {
          ...payload,
          _id: String(row.external_id || payload._id || row.id || '').trim(),
          id: row.id,
          customerId: String(row.customer_external_id ?? payload.customerId ?? payload.customerExternalId ?? '').trim(),
          customerName: String(row.customer_name ?? payload.customerName ?? '').trim(),
          paymentDate: String(row.payment_date ?? payload.paymentDate ?? '').trim(),
          mode: String(row.payment_mode ?? payload.mode ?? payload.paymentMode ?? '').trim(),
          reference: String(row.reference_number ?? payload.reference ?? payload.referenceNumber ?? '').trim(),
          amount: toNumber(row.amount ?? payload.amount, 0),
          notes: String(row.notes ?? payload.notes ?? '').trim(),
          linkedInvoiceId: String(row.linked_invoice_external_id ?? payload.linkedInvoiceId ?? payload.linkedInvoiceExternalId ?? '').trim()
        };
      });
    });
    return res.json(payments);
  } catch (error) {
    console.error('MySQL payment received read failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch payment received from MySQL' });
  }
});

app.post('/api/payment-received', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for payment received module' });
  try {
    const payment = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const externalId = String(payment._id || `PR-${Date.now()}`).trim();
    const payload = { ...payment, _id: externalId };
    await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      await conn.query(
        `INSERT INTO payment_received (
          external_id, customer_external_id, customer_name, payment_date, payment_mode, reference_number, amount, notes, linked_invoice_external_id, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          customer_external_id=VALUES(customer_external_id),
          customer_name=VALUES(customer_name),
          payment_date=VALUES(payment_date),
          payment_mode=VALUES(payment_mode),
          reference_number=VALUES(reference_number),
          amount=VALUES(amount),
          notes=VALUES(notes),
          linked_invoice_external_id=VALUES(linked_invoice_external_id),
          payload=VALUES(payload)`,
        [
          externalId,
          String(payload.customerId || payload.customerExternalId || '').trim(),
          String(payload.customerName || '').trim(),
          String(payload.paymentDate || '').trim() || null,
          String(payload.mode || payload.paymentMode || '').trim(),
          String(payload.reference || payload.referenceNumber || '').trim(),
          toNumber(payload.amount, 0),
          String(payload.notes || '').trim(),
          String(payload.linkedInvoiceId || payload.linkedInvoiceExternalId || '').trim(),
          JSON.stringify(payload)
        ]
      );
    });
    return res.status(201).json(payload);
  } catch (error) {
    console.error('MySQL payment received write failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to save payment received in MySQL' });
  }
});

app.put('/api/payment-received/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for payment received module' });
  try {
    const paymentId = String(req.params.id || '').trim();
    const payment = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const payload = { ...payment, _id: String(payment._id || paymentId).trim() };
    const numericId = Number(paymentId);
    const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
    const affectedRows = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [result] = await conn.query(
        `UPDATE payment_received SET
          external_id=?, customer_external_id=?, customer_name=?, payment_date=?, payment_mode=?, reference_number=?, amount=?, notes=?, linked_invoice_external_id=?, payload=?
         WHERE external_id = ? OR id = ?`,
        [
          payload._id,
          String(payload.customerId || payload.customerExternalId || '').trim(),
          String(payload.customerName || '').trim(),
          String(payload.paymentDate || '').trim() || null,
          String(payload.mode || payload.paymentMode || '').trim(),
          String(payload.reference || payload.referenceNumber || '').trim(),
          toNumber(payload.amount, 0),
          String(payload.notes || '').trim(),
          String(payload.linkedInvoiceId || payload.linkedInvoiceExternalId || '').trim(),
          JSON.stringify(payload),
          paymentId,
          safeNumericId
        ]
      );
      return Number(result?.affectedRows || 0);
    });
    if (!affectedRows) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payload);
  } catch (error) {
    console.error('MySQL payment received update failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to update payment received in MySQL' });
  }
});

app.delete('/api/payment-received/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(500).json({ error: 'MySQL is not configured for payment received module' });
  try {
    const paymentId = String(req.params.id || '').trim();
    const numericId = Number(paymentId);
    const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
    const deletedRows = await withMysqlConnection(async (conn) => {
      await ensureVendorFinanceTables(conn);
      const [result] = await conn.query('DELETE FROM payment_received WHERE external_id = ? OR id = ?', [paymentId, safeNumericId]);
      return Number(result?.affectedRows || 0);
    });
    if (!deletedRows) return res.status(404).json({ error: 'Payment not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('MySQL payment received delete failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete payment received from MySQL' });
  }
});

app.post('/api/invoices', async (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const settings = await loadCurrentSettingsForNumbering();
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
  await updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);

  try {
    await syncInvoiceToMysql(newInvoice);
  } catch (error) {
    console.error('MySQL invoice write failed (JSON saved):', error.message);
  }

  res.json(newInvoice);
});

app.put('/api/invoices/:id', async (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const settings = await loadCurrentSettingsForNumbering();
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
  await updateSettingsNextInvoiceNumber(updatedInvoice.invoiceNumber, settings);

  try {
    await syncInvoiceToMysql(updatedInvoice);
  } catch (error) {
    console.error('MySQL invoice update failed (JSON saved):', error.message);
  }

  res.json(updatedInvoice);
});

app.delete('/api/invoices/:id', async (req, res) => {
  const invoices = readJsonFile(invoicesFile, []);
  const updatedInvoices = invoices.filter((invoice) => invoice._id !== req.params.id);

  if (updatedInvoices.length === invoices.length) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  fs.writeFileSync(invoicesFile, JSON.stringify(updatedInvoices, null, 2));

  try {
    await withMysqlConnection(async (conn) => {
      await conn.query('DELETE FROM invoice_items WHERE invoice_external_id = ?', [req.params.id]);
      await conn.query('DELETE FROM invoices WHERE external_id = ?', [req.params.id]);
    });
  } catch (error) {
    console.error('MySQL invoice delete failed (JSON deleted):', error.message);
  }

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

app.post('/api/renewals/:id/convert-invoice', async (req, res) => {
  const records = readJsonFile(renewalsFile, []);
  const recordIndex = records.findIndex((entry) => String(entry?._id || '') === String(req.params.id || ''));
  if (recordIndex < 0) return res.status(404).json({ error: 'Renewal not found' });

  const renewal = records[recordIndex];
  const invoices = readJsonFile(invoicesFile, []);
  const sourceInvoice = invoices.find((entry) => String(entry?._id || '') === String(renewal.invoiceId || ''));
  if (!sourceInvoice) return res.status(404).json({ error: 'Source invoice not found for renewal' });

  const settings = await loadCurrentSettingsForNumbering();
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
  await updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);

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

app.use('/api', createWhatsAppRouter({
  dataDir,
  uploadsDir,
  settingsFile,
  readJsonFile,
  withMysqlConnection,
  resolveServerOrigin
}));

app.use('/api', createEmailRouter({
  dataDir,
  uploadsDir,
  settingsFile,
  readJsonFile,
  withMysqlConnection,
  resolveServerOrigin
}));

app.post('/api/upload', upload.single('image'), (req, res) => {
  res.json({ imageUrl: `${resolveServerOrigin(req)}/uploads/${req.file.filename}` });
});

if (activeFrontendBuildDir && activeFrontendIndexFile) {
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(activeFrontendIndexFile);
  });
}

app.listen(PORT, () => console.log(`Backend Server Live on Port ${PORT}`));
