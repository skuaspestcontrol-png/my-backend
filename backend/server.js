const express = require('express');
const cors = require("cors");
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { execFile } = require('child_process');
const PDFDocument = require('pdfkit');
const { generateInvoicePdfBuffer, formatINR, formatDate, amountToWords } = require('./invoicePdf');
const { pool, query: dbQuery, getConnection } = require('./lib/db');
const { runAutoMigrations, getLastMigrationStatus } = require('./lib/autoMigrate');
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
  getTasksClient,
  saveIntegrationRow,
  ensureTaskList,
  syncGoogleTaskForJob,
  syncGoogleCalendarEventForJob,
  getGoogleClient
} = require('./lib/googleTasks');

if (!global.__SKUAS_DOTENV_LOADED__) {
  require('dotenv').config();
  global.__SKUAS_DOTENV_LOADED__ = true;
}

if (!global.__SKUAS_PROCESS_GUARDS_INSTALLED__) {
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT_EXCEPTION:', error && error.stack ? error.stack : error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED_REJECTION:', reason && reason.stack ? reason.stack : reason);
  });

  global.__SKUAS_PROCESS_GUARDS_INSTALLED__ = true;
}

console.log('PID:', process.pid);
if (!global.__SKUAS_MEMORY_LOG_INTERVAL__) {
  global.__SKUAS_MEMORY_LOG_INTERVAL__ = setInterval(() => {
    const usage = process.memoryUsage();
    console.log('MEMORY_USAGE:', {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    });
  }, 30000);
  if (typeof global.__SKUAS_MEMORY_LOG_INTERVAL__.unref === 'function') {
    global.__SKUAS_MEMORY_LOG_INTERVAL__.unref();
  }
}

const app = express();
const SKUAS_API_URL = String(process.env.SKUAS_API_URL || 'https://api.skuaspestcontrol.com').replace(/\/+$/, '');
const SKUAS_API_KEY = String(process.env.SKUAS_API_KEY || process.env.APP_API_KEY || '').trim();
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

app.post('/api/integrations/push/test', async (req, res) => {
  try {
    const demoJob = {
      id: req.body?.jobId || 'demo',
      customerName: req.body?.customerName || 'Test Customer',
      serviceName: req.body?.serviceName || 'General Pest Control',
      scheduledDate: req.body?.scheduledDate || new Date().toISOString().slice(0, 10),
      technicianName: req.body?.technicianName || '',
      technicianMobile: req.body?.technicianMobile || '',
      employeeCode: req.body?.employeeCode || '',
      technicianId: req.body?.technicianId || '',
      status: 'Assigned',
    };
    await notifyTechnicianPush(demoJob, 'job_assigned');
    return res.json({ success: true, message: 'Push test triggered' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'skuas-backend'
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

const notifyTechnicianPush = async (job = {}, event = 'job_updated') => {
  try {
    const technicianName = String(job.technicianName || '').trim();
    const employeeCode = String(job.employeeCode || job.technicianEmpCode || '').trim();
    const mobile = String(job.technicianMobile || '').trim();
    const technicianId = job.technicianId || null;

    if (!technicianName && !employeeCode && !mobile && !technicianId) return;

    const title = event === 'job_assigned'
      ? 'New Job Assigned'
      : event === 'job_completed'
        ? 'Job Completed'
        : 'Job Updated';
    const body = `${String(job.customerName || 'Customer')} • ${String(job.serviceName || 'Service')} • ${String(job.scheduledDate || '-')}`;

    await fetch(`${SKUAS_API_URL}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SKUAS_API_KEY ? { 'x-api-key': SKUAS_API_KEY } : {}),
      },
      body: JSON.stringify({
        title,
        body,
        employeeCode: employeeCode || undefined,
        technicianId: technicianId || undefined,
        mobile: mobile || undefined,
        data: {
          route: 'tasks/detail',
          jobId: job.id || job._id || undefined,
          job: {
            id: job.id || job._id || undefined,
            customer_name: job.customerName || '',
            service_type: job.serviceName || '',
            status: job.status || '',
          },
        },
      }),
    });
  } catch (error) {
    console.error('Technician push notify failed:', error.message);
  }
};

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
    "https://www.skuaspestcontrol.com",
    "https://skuaspestcontrol.com",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
const readAdminMigrationToken = (req) => String(
  req.headers['x-admin-migration-token']
  || req.headers.authorization?.replace(/^Bearer\s+/i, '')
  || req.body?.token
  || req.query?.token
  || ''
).trim();

app.get('/api/admin/migration-status', (req, res) => {
  res.json({
    success: true,
    status: getLastMigrationStatus()
  });
});

app.post('/api/admin/run-migrations', async (req, res) => {
  const expectedToken = String(process.env.ADMIN_MIGRATION_TOKEN || '').trim();
  if (!expectedToken) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_MIGRATION_TOKEN is not configured'
    });
  }
  if (readAdminMigrationToken(req) !== expectedToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid migration token'
    });
  }
  if (!canUseMysql()) {
    return res.status(500).json({
      success: false,
      error: 'MySQL is not configured',
      status: getLastMigrationStatus()
    });
  }

  const status = await runAutoMigrations(pool);
  return res.status(status.errors?.length ? 207 : 200).json({
    success: status.errors?.length === 0,
    status
  });
});
app.use('/api', quotationRouter);
const resolvePort = () => {
  const candidates = [
    process.env.PORT,
    process.env.APP_PORT,
    process.env.NODEJS_PORT,
    process.env.SERVER_PORT,
    process.env.HTTP_PORT,
    process.env.HOSTINGER_PORT
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 3000;
};
const PORT = resolvePort();
const SERVER_ORIGIN = String(process.env.SERVER_ORIGIN || '').trim();
const resolveServerOrigin = (req) => SERVER_ORIGIN || `${req.protocol}://${req.get('host')}`;
const MASTER_RESET_EMAIL = String(process.env.MASTER_RESET_EMAIL || 'skuaspestcontrol@gmail.com').trim().toLowerCase();
const RESET_OTP_TTL_MS = 10 * 60 * 1000;
const resetOtpStore = new Map();
const googleOauthStateStore = new Map();

const ensureStartupDir = (preferredDir, fallbackDir, label) => {
  const preferred = String(preferredDir || '').trim();
  const fallback = String(fallbackDir || '').trim();
  try {
    if (preferred) {
      fs.mkdirSync(preferred, { recursive: true });
      return preferred;
    }
  } catch (error) {
    console.error(`${label} directory unavailable: ${preferred}`, error.message);
  }

  fs.mkdirSync(fallback, { recursive: true });
  console.warn(`${label} directory fallback active: ${fallback}`);
  return fallback;
};

const preferredUploadsRootDir = String(
  process.env.UPLOADS_DIR
  || process.env.UPLOADS_ROOT_DIR
  || '/home/u610009593/uploads-skuas-crm'
).trim();
const uploadsRootDir = ensureStartupDir(
  preferredUploadsRootDir,
  path.join(__dirname, '..', 'storage', 'uploads'),
  'Uploads'
);
const uploadsDir = uploadsRootDir;
const employeeUploadsDir = path.join(uploadsDir, 'employees');
const employeePhotoUploadsDir = path.join(employeeUploadsDir, 'photos');
const employeeAadhaarUploadsDir = path.join(employeeUploadsDir, 'aadhaar');
const employeePanUploadsDir = path.join(employeeUploadsDir, 'pan');
const employeeDocumentsUploadsDir = path.join(employeeUploadsDir, 'documents');
const uploadsMirrorDir = String(process.env.UPLOADS_MIRROR_DIR || '').trim();
[
  uploadsDir,
  employeeUploadsDir,
  employeePhotoUploadsDir,
  employeeAadhaarUploadsDir,
  employeePanUploadsDir,
  employeeDocumentsUploadsDir
].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
if (uploadsMirrorDir) {
  try {
    fs.mkdirSync(uploadsMirrorDir, { recursive: true });
  } catch (error) {
    console.error('Uploads mirror directory unavailable:', uploadsMirrorDir, error.message);
  }
}
console.log('Employee upload root:', employeeUploadsDir);
console.log('Employee upload photos dir:', employeePhotoUploadsDir);
console.log('Employee upload aadhaar dir:', employeeAadhaarUploadsDir);
console.log('Employee upload pan dir:', employeePanUploadsDir);
console.log('Employee upload documents dir:', employeeDocumentsUploadsDir);
console.log('Uploads static directory:', uploadsRootDir);
console.log('Uploads dir exists:', fs.existsSync(uploadsRootDir));
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
  const normalized = safeName.replace(/\\/g, '/');
  if (normalized.includes('..')) return;
  const src = path.join(uploadsDir, normalized);
  const dest = path.join(uploadsMirrorDir, normalized);
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  } catch (error) {
    console.error('Failed to mirror uploaded file:', error.message);
  }
};

const deleteUploadFile = (uploadUrlOrPath = '') => {
  const raw = String(uploadUrlOrPath || '').trim();
  if (!raw) return;

  let relative = raw;
  try {
    const parsed = new URL(raw);
    relative = parsed.pathname || '';
  } catch (_error) {
    // Treat non-URL input as a local upload path.
  }

  if (relative.includes('/uploads/')) {
    relative = relative.slice(relative.indexOf('/uploads/') + '/uploads/'.length);
  }
  relative = relative.replace(/^\/?uploads\/?/, '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!relative || relative.includes('..')) return;

  const deleteFrom = (rootDir) => {
    if (!rootDir) return;
    const root = path.resolve(rootDir);
    const target = path.resolve(rootDir, relative);
    if (!target.startsWith(root + path.sep) && target !== root) return;
    try {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    } catch (error) {
      console.error('Failed to delete uploaded file:', error.message);
    }
  };

  deleteFrom(uploadsDir);
  deleteFrom(uploadsMirrorDir);
};

const recoverUploadsFromMirror = () => {
  if (!uploadsMirrorDir) return;
  const walk = (rootDir, relativePrefix = '') => {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    entries.forEach((entry) => {
      const nextRelative = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      const src = path.join(rootDir, entry.name);
      const dest = path.join(uploadsDir, nextRelative);
      if (entry.isDirectory()) {
        walk(src, nextRelative);
        return;
      }
      if (!entry.isFile()) return;
      if (fs.existsSync(dest)) return;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    });
  };
  try {
    walk(uploadsMirrorDir);
  } catch (error) {
    console.error('Failed to recover uploads from mirror:', error.message);
  }
};
recoverUploadsFromMirror();

app.use(
  '/uploads',
  express.static(uploadsRootDir)
);

app.get('/uploads-test', (req, res) => {
  const fs = require('fs');
  res.json({
    uploadsRootDir,
    exists: fs.existsSync(uploadsRootDir),
    files: fs.existsSync(uploadsRootDir)
      ? fs.readdirSync(uploadsRootDir).slice(0, 20)
      : []
  });
});

const uploadsPublicBaseUrl = String(process.env.UPLOADS_PUBLIC_BASE_URL || '').trim();
const normalizeUploadRelativePath = (value) => {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.includes('..')) return '';
  if (raw.startsWith('/uploads/')) return raw;
  return `/uploads/${raw.replace(/^\/+/, '')}`;
};
const resolveUploadPublicUrl = (req, relativePathOrFileName) => {
  const normalizedPath = normalizeUploadRelativePath(relativePathOrFileName);
  if (!normalizedPath) return '';
  const encodedPath = normalizedPath
    .split('/')
    .map((part, index) => (index === 0 ? '' : encodeURIComponent(part)))
    .join('/');
  if (uploadsPublicBaseUrl) {
    return `${uploadsPublicBaseUrl.replace(/\/+$/, '')}${encodedPath}`;
  }
  return `${resolveServerOrigin(req)}${encodedPath}`;
};
const resolveUploadRelativePath = (relativePathOrFileName) => normalizeUploadRelativePath(relativePathOrFileName);
const toSafeUploadBaseName = (rawName = '') => {
  const base = String(rawName || '').toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';
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
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    const baseName = path.basename(String(file.originalname || ''), ext);
    const safeBase = toSafeUploadBaseName(baseName);
    cb(null, `${timestamp}-${safeBase}${ext}`);
  }
});
const employeePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Employee photo multer destination:', employeePhotoUploadsDir);
    cb(null, employeePhotoUploadsDir);
  },
  filename: (req, file, cb) => {
    const empCode = toSafeUploadBaseName(String(req.body?.empCode || req.body?.emp_code || 'emp').trim());
    const originalBase = toSafeUploadBaseName(path.basename(String(file.originalname || ''), path.extname(String(file.originalname || ''))));
    const timestamp = Date.now();
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    cb(null, `emp-${empCode}-${timestamp}-${originalBase}${ext}`);
  }
});
const resolveEmployeeDocumentType = (rawType = '') => {
  const type = String(rawType || '').trim().toLowerCase();
  if (type === 'aadhaar' || type === 'aadhar') return 'aadhaar';
  if (type === 'pan') return 'pan';
  if (type === 'documents' || type === 'document' || type === 'other') return 'documents';
  return 'documents';
};
const employeeDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const docType = resolveEmployeeDocumentType(req.body?.documentType || req.body?.docType);
    const destinationByType = {
      aadhaar: employeeAadhaarUploadsDir,
      pan: employeePanUploadsDir,
      documents: employeeDocumentsUploadsDir
    };
    const destination = destinationByType[docType] || employeeDocumentsUploadsDir;
    console.log('Employee document multer destination:', destination, '| documentType:', docType);
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const docType = resolveEmployeeDocumentType(req.body?.documentType || req.body?.docType);
    const empCode = toSafeUploadBaseName(String(req.body?.empCode || req.body?.emp_code || 'emp').trim());
    const timestamp = Date.now();
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    const originalBase = toSafeUploadBaseName(path.basename(String(file.originalname || ''), ext));
    cb(null, `${docType}-${empCode}-${timestamp}-${originalBase}${ext}`);
  }
});
const upload = multer({ storage });
const employeePhotoUpload = multer({
  storage: employeePhotoStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'));
    }
  }
});
const employeeDocumentUpload = multer({ storage: employeeDocumentStorage });
const jobCompletionUpload = upload.fields([
  { name: 'beforePhotoFile', maxCount: 1 },
  { name: 'afterPhotoFile', maxCount: 1 }
]);

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

const isCustomersJsonFallbackEnabled = () => {
  const value = String(process.env.CUSTOMERS_JSON_FALLBACK || process.env.ENABLE_CUSTOMERS_JSON_FALLBACK || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
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
  renewalLetterTermsAndConditions: '',
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
  renewalPrefix: 'REN-',
  renewalNextNumber: 1,
  renewalNumberPadding: 4,
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

const normalizeUploadBackedAssetPath = (value, fallback = '') => {
  const raw = String(value ?? '').trim();
  const fallbackValue = String(fallback ?? '').trim();
  if (!raw) return fallbackValue;
  if (/^data:image\//i.test(raw)) return fallbackValue;
  if (/^\/uploads\//i.test(raw)) return raw;

  const extractUploadsPath = (input) => {
    const normalized = String(input || '').replace(/\\/g, '/');
    const marker = '/uploads/';
    const index = normalized.toLowerCase().indexOf(marker);
    if (index === -1) return '';
    const filePart = normalized.slice(index + marker.length).split('?')[0].split('#')[0].trim();
    if (!filePart) return '';
    return `/uploads/${filePart}`;
  };

  const fromText = extractUploadsPath(raw);
  if (fromText) return fromText;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const fromUrl = extractUploadsPath(parsed.pathname || '');
      if (fromUrl) return fromUrl;
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return fallbackValue;
    } catch (_error) {
      // ignore parse error
    }
  }

  if (!raw.includes('/') && !raw.includes('\\') && /\.[a-z0-9]{2,8}$/i.test(raw)) {
    return `/uploads/${raw}`;
  }
  return raw;
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
    renewalLetterTermsAndConditions: normalizeSettingsText(source.renewalLetterTermsAndConditions ?? defaultSettings.renewalLetterTermsAndConditions),
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
    renewalPrefix: String(source.renewalPrefix ?? defaultSettings.renewalPrefix),
    renewalNextNumber: Math.max(1, Number(source.renewalNextNumber ?? defaultSettings.renewalNextNumber) || defaultSettings.renewalNextNumber),
    renewalNumberPadding: Math.max(1, Number(source.renewalNumberPadding ?? defaultSettings.renewalNumberPadding) || defaultSettings.renewalNumberPadding),
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
  const logoLikeKeys = [
    'gstCompanyLogoUrl',
    'dashboardImageUrl',
    'nonGstCompanyLogoUrl',
    'gstDigitalSignatureUrl',
    'nonGstDigitalSignatureUrl',
    'gstCompanyStampUrl',
    'gstBankQrUrl',
    'nonGstBankQrUrl'
  ];
  logoLikeKeys.forEach((key) => {
    const currentValue = String((current || {})[key] || '').trim();
    if (!Object.prototype.hasOwnProperty.call(base, key)) {
      base[key] = normalizeUploadBackedAssetPath(currentValue, '');
      return;
    }
    base[key] = normalizeUploadBackedAssetPath(base[key], currentValue);
  });

  // Keep legacy sync behavior between dashboard and GST logo fields.
  if (!String(base.gstCompanyLogoUrl || '').trim() && String(base.dashboardImageUrl || '').trim()) {
    base.gstCompanyLogoUrl = base.dashboardImageUrl;
  }
  if (!String(base.dashboardImageUrl || '').trim() && String(base.gstCompanyLogoUrl || '').trim()) {
    base.dashboardImageUrl = base.gstCompanyLogoUrl;
  }
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

const createJobId = () => {
  const stamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `JOB-${stamp}-${randomPart}`;
};

const updateSettingsNextJobNumber = async (usedJobNumber, settings) => {
  try {
    const seq = extractJobSequence(usedJobNumber, settings.jobPrefix);
    if (!Number.isFinite(seq)) return;
    const nextValue = Math.max(1, Number(settings.jobNextNumber || defaultSettings.jobNextNumber));
    if (seq >= nextValue) {
      const updated = {
        ...settings,
        jobNextNumber: seq + 1
      };
      if (canUseMysql()) {
        await saveSettingsToMysql(updated);
      } else {
        fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
      }
    }
  } catch (error) {
    console.error('Failed to update next job number settings:', error.message);
  }
};

const parseJobLogoPath = (dashboardImageUrl = '') => {
  const raw = String(dashboardImageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) {
    const direct = path.resolve(__dirname, `.${raw}`);
    if (fs.existsSync(direct)) return direct;
    const uploadIndex = raw.indexOf('/uploads/');
    if (uploadIndex >= 0) {
      const uploadRelative = raw.slice(uploadIndex + '/uploads/'.length).replace(/^\/+/, '');
      const uploadPath = path.join(uploadsDir, uploadRelative);
      if (fs.existsSync(uploadPath)) return uploadPath;
    }
  }
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const cleanRelative = raw.replace(/^\/?uploads\/?/, '').replace(/^\/+/, '');
    const byRelative = path.join(uploadsDir, cleanRelative);
    if (fs.existsSync(byRelative)) return byRelative;
    const byName = path.join(uploadsDir, path.basename(raw));
    if (fs.existsSync(byName)) return byName;
    if (fs.existsSync(raw)) return raw;
  }
  try {
    const url = new URL(raw);
    const pathname = url.pathname || '';
    if (pathname.includes('/uploads/')) {
      const uploadRelative = pathname.slice(pathname.indexOf('/uploads/') + '/uploads/'.length).replace(/^\/+/, '');
      const local = path.join(uploadsDir, uploadRelative);
      if (fs.existsSync(local)) return local;
    }
  } catch (_error) {
    if (fs.existsSync(raw)) return raw;
  }
  return '';
};

const resolveGstCompanyLogoPath = (settings = {}) => {
  const gstLogo = parseJobLogoPath(settings.gstCompanyLogoUrl || '');
  if (gstLogo) return gstLogo;
  return parseJobLogoPath(settings.dashboardImageUrl || '');
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

  const logoPath = resolveGstCompanyLogoPath(settings);
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

    const settings = await loadCurrentSettingsForNumbering();
    await sendPasswordResetOtpEmail({ settings, recipient: incomingEmail, otp });

    res.json({ message: 'OTP sent to master email' });
  } catch (error) {
    console.error('Failed to send reset OTP:', error.message);
    res.status(500).json({ error: 'Could not send reset OTP. Check SMTP settings in backend.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
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

  const current = await loadCurrentSettingsForNumbering();
  const next = sanitizeSettings({
    ...current,
    adminPassword: newPassword
  });
  if (canUseMysql()) {
    await saveSettingsToMysql(next);
  } else {
    fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2));
  }
  resetOtpStore.delete(incomingEmail);
  res.json({ message: 'Password reset successful' });
});

app.post('/api/settings/upload-dashboard-image', upload.single('dashboardImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  syncUploadToMirror(req.file.filename);
  const relativePath = resolveUploadRelativePath(req.file.filename);
  const imageUrl = resolveUploadPublicUrl(req, req.file.filename);
  res.json({ imageUrl, relativePath });
});

app.post('/api/settings/upload-branding-image', upload.single('brandingImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  syncUploadToMirror(req.file.filename);
  const relativePath = resolveUploadRelativePath(req.file.filename);
  const imageUrl = resolveUploadPublicUrl(req, req.file.filename);
  res.json({ imageUrl, relativePath });
});

app.post('/api/employees/upload-document', employeeDocumentUpload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const docType = resolveEmployeeDocumentType(req.body?.documentType || req.body?.docType);
  const relativePath = `/uploads/employees/${docType}/${req.file.filename}`;
  const mirrorPath = `employees/${docType}/${req.file.filename}`;
  syncUploadToMirror(mirrorPath);
  console.log('Employee document uploaded path:', req.file.path);
  console.log('Employee document saved path:', relativePath);
  res.json({
    fileUrl: relativePath,
    filePublicUrl: resolveUploadPublicUrl(req, relativePath),
    fileName: req.file.filename,
    documentType: docType
  });
});
app.post('/api/uploads/delete', (req, res) => {
  const relativePath = normalizeUploadRelativePath(req.body?.fileUrl || req.body?.path || '');
  if (!relativePath) return res.status(400).json({ error: 'Valid upload path is required' });
  if (!relativePath.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Only /uploads files can be deleted' });
  }
  const filePart = relativePath.replace(/^\/uploads\//, '');
  const normalizedPart = filePart.replace(/\\/g, '/');
  if (!normalizedPart || normalizedPart.includes('..')) {
    return res.status(400).json({ error: 'Unsafe upload path' });
  }

  const localPath = path.join(uploadsDir, normalizedPart);
  const localResolved = path.resolve(localPath);
  const uploadsResolved = path.resolve(uploadsDir);
  if (!localResolved.startsWith(uploadsResolved + path.sep) && localResolved !== uploadsResolved) {
    return res.status(400).json({ error: 'Invalid upload path' });
  }

  let deletedLocal = false;
  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      deletedLocal = true;
    }
  } catch (error) {
    console.error('Upload delete failed (local):', error.message);
    return res.status(500).json({ error: 'Could not delete local upload file' });
  }

  let deletedMirror = false;
  if (uploadsMirrorDir) {
    const mirrorPath = path.join(uploadsMirrorDir, normalizedPart);
    try {
      if (fs.existsSync(mirrorPath)) {
        fs.unlinkSync(mirrorPath);
        deletedMirror = true;
      }
    } catch (error) {
      console.error('Upload delete failed (mirror):', error.message);
    }
  }

  console.log('Upload delete path:', relativePath);
  console.log('Upload delete local file:', localPath, 'deleted:', deletedLocal);
  if (uploadsMirrorDir) {
    console.log('Upload delete mirror checked:', normalizedPart, 'deleted:', deletedMirror);
  }
  return res.json({ message: 'Upload deleted', fileUrl: relativePath, deletedLocal, deletedMirror });
});

const parseMysqlLeadPayload = (rawPayload) => {
  if (!rawPayload) return null;
  if (typeof rawPayload === 'string') {
    try { return JSON.parse(rawPayload); } catch { return null; }
  }
  if (typeof rawPayload === 'object') return rawPayload;
  return null;
};

const normalizeLeadMobile = (value) => String(value || '').replace(/\D/g, '').slice(-10);

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
  const pincode = String(source.pincode || source.pinCode || source.postalCode || source.postal_code || source.zip || '').trim();
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
  const serviceRequired = String(source.serviceRequired || source.serviceName || '').trim();
  const serviceName = String(source.serviceName || serviceRequired).trim();
  const notes = String(source.notes || source.message || '').trim();
  const remarks = String(source.remarks || notes).trim();
  const websitePage = String(source.websitePage || '').trim();
  const sourceName = String(source.source || leadSource).trim();
  const leadDate = String(source.leadDate || source.date || '').trim();
  const createdAt = String(source.createdAt || new Date().toISOString()).trim();

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
    pinCode: pincode,
    postalCode: pincode,
    postal_code: pincode,
    zip: pincode,
    pestIssue,
    serviceRequired,
    serviceName,
    leadSource,
    source: sourceName,
    status: leadStatus,
    leadStatus,
    notes,
    remarks,
    websitePage,
    leadDate,
    assignedTo,
    followupDate,
    date,
    createdAt,
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
    { name: 'pincode', definition: 'VARCHAR(20) NULL' },
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

let employeeAuthColumnsEnsured = false;
const ensureEmployeeAuthColumns = async (conn) => {
  if (employeeAuthColumnsEnsured) return;
  await ensureColumnsIfMissing(conn, 'employees', [
    { name: 'password', definition: 'VARCHAR(255) NULL' },
    { name: 'portal_password', definition: 'VARCHAR(255) NULL' }
  ]);
  employeeAuthColumnsEnsured = true;
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

const saveLeadToJsonFallback = (lead) => {
  try {
    const rows = readJsonFile(leadsFile, []);
    const list = Array.isArray(rows) ? rows : [];
    const leadId = String(lead?._id || '').trim();
    const nextRows = leadId && list.some((entry) => String(entry?._id || '').trim() === leadId)
      ? list.map((entry) => (String(entry?._id || '').trim() === leadId ? lead : entry))
      : [lead, ...list];
    fs.writeFileSync(leadsFile, JSON.stringify(nextRows, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save lead JSON fallback:', error.message);
    return false;
  }
};

const loadRecentLeadPayloads = async () => {
  const payloads = [];
  if (canUseMysql()) {
    try {
      const mysqlRows = await withMysqlConnection(async (conn) => {
        const [rows] = await conn.query('SELECT payload FROM leads ORDER BY id DESC LIMIT 500');
        return Array.isArray(rows) ? rows : [];
      });
      mysqlRows.forEach((row) => {
        const parsed = parseMysqlLeadPayload(row?.payload);
        if (parsed) payloads.push(parsed);
      });
    } catch (error) {
      console.error('Failed to check recent MySQL leads:', error.message);
    }
  }
  const jsonRows = readJsonFile(leadsFile, []);
  if (Array.isArray(jsonRows)) payloads.push(...jsonRows);
  return payloads;
};

const hasRecentWebsiteLeadByMobile = async (mobile) => {
  const normalizedMobile = normalizeLeadMobile(mobile);
  if (!normalizedMobile) return false;
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
  const payloads = await loadRecentLeadPayloads();
  return payloads.some((entry) => {
    const entryMobile = normalizeLeadMobile(entry?.mobile || entry?.mobileNumber || entry?.whatsappNumber);
    if (entryMobile !== normalizedMobile) return false;
    const createdSource = entry?.createdAt || entry?.date || entry?.leadDate;
    const createdTime = createdSource ? new Date(createdSource).getTime() : 0;
    return Number.isFinite(createdTime) && createdTime >= tenMinutesAgo;
  });
};

const buildWebsiteLead = (body = {}) => {
  const now = new Date();
  const name = String(body.name || body.customerName || '').trim();
  const mobile = String(body.mobile || body.mobileNumber || '').trim();
  const email = String(body.email || body.emailId || '').trim();
  const serviceRequired = String(body.serviceRequired || body.serviceName || body.pestIssue || '').trim();
  const message = String(body.message || body.notes || body.remarks || '').trim();
  const city = String(body.city || '').trim();
  const address = String(body.address || '').trim();
  const websitePage = String(body.websitePage || '').trim();
  const leadId = `web-${now.getTime()}-${crypto.randomBytes(3).toString('hex')}`;

  return normalizeLeadShape({
    _id: leadId,
    customerName: name,
    displayName: name,
    contactPersonName: name,
    mobile,
    mobileNumber: mobile,
    whatsappNumber: mobile,
    emailId: email,
    serviceRequired,
    serviceName: serviceRequired,
    pestIssue: serviceRequired,
    notes: message,
    remarks: message,
    city,
    address,
    source: 'Website',
    leadSource: 'Website',
    websitePage,
    leadDate: now.toISOString().slice(0, 10),
    date: now.toISOString(),
    createdAt: now.toISOString(),
    status: 'New',
    leadStatus: 'New'
  }, leadId);
};

app.post('/api/public/website-lead', async (req, res) => {
  try {
    const expectedKey = String(process.env.WEBSITE_LEAD_API_KEY || '').trim();
    const suppliedKey = String(req.headers['x-website-lead-key'] || '').trim();
    if (!expectedKey || suppliedKey !== expectedKey) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const name = String(req.body?.name || req.body?.customerName || '').trim();
    const mobile = String(req.body?.mobile || req.body?.mobileNumber || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    if (!mobile) return res.status(400).json({ success: false, error: 'Mobile is required' });
    if (await hasRecentWebsiteLeadByMobile(mobile)) {
      return res.status(429).json({ success: false, error: 'Lead already submitted recently' });
    }

    const lead = buildWebsiteLead(req.body || {});
    let savedToMysql = false;
    let mysqlError = '';
    if (canUseMysql()) {
      try {
        await withMysqlConnection(async (conn) => {
          await upsertLeadToMysql(conn, lead);
        });
        savedToMysql = true;
      } catch (error) {
        mysqlError = error.message || 'Failed to save lead in MySQL';
        console.error('Website lead MySQL save failed:', mysqlError);
      }
    }
    const savedToJson = saveLeadToJsonFallback(lead);

    if (canUseMysql() && !savedToMysql) {
      return res.status(500).json({
        success: false,
        error: mysqlError || 'Failed to save lead in MySQL',
        jsonBackupSaved: savedToJson
      });
    }
    if (!savedToMysql && !savedToJson) {
      return res.status(500).json({ success: false, error: 'Failed to save lead' });
    }

    return res.json({ success: true, message: 'Lead created', leadId: lead._id });
  } catch (error) {
    console.error('Website lead create failed:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create lead' });
  }
});

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
    const rows = readJsonFile(employeesFile, []);
    return res.json(Array.isArray(rows) ? rows : []);
  }
  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      await ensureEmployeeAuthColumns(conn);
      const [rows] = await conn.query(
        `SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, password, email, portal_password, city, pincode, profile_photo, present_address, salary, joining_date, status, payload
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
        profile_photo: String(row?.profile_photo ?? payload.profile_photo ?? '').trim(),
        present_address: String(row?.present_address ?? payload.present_address ?? '').trim(),
        portalAccess,
        portalPassword: String(row?.password ?? row?.portal_password ?? payload?.portalPassword ?? '').trim()
      };
    };
    return res.json(mysqlRows.map(toEmployeeResponse));
  } catch (error) {
    console.error('MySQL employees read failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch employees from MySQL' });
  }
});

app.post("/api/employees", employeePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const emp = req.body || {};
    if (req.file) {
      const relativePath = `/uploads/employees/photos/${req.file.filename}`;
      emp.profile_photo = relativePath;
      syncUploadToMirror(`employees/photos/${req.file.filename}`);
      console.log('Employee profile photo uploaded path:', req.file.path);
      console.log('Employee profile photo saved path:', relativePath);
    }
    if (!canUseMysql()) {
      const rows = readJsonFile(employeesFile, []);
      const externalId = String(emp._id || Date.now().toString()).trim();
      const next = { ...emp, _id: externalId };
      const nextRows = Array.isArray(rows) ? [...rows] : [];
      const existingIndex = nextRows.findIndex((entry) => String(entry?._id || '').trim() === externalId);
      if (existingIndex >= 0) nextRows[existingIndex] = { ...nextRows[existingIndex], ...next };
      else nextRows.push(next);
      fs.writeFileSync(employeesFile, JSON.stringify(nextRows, null, 2));
      return res.json({ success: true, _id: externalId });
    }

    const externalId = emp._id || Date.now().toString();

    await withMysqlConnection(async (conn) => {
      await ensureEmployeeAuthColumns(conn);
      await conn.query(
        `INSERT INTO employees (
          external_id,
          emp_code,
          first_name,
          last_name,
          full_name,
          mobile,
          password,
          email,
          portal_password,
          role,
          role_name,
          salary,
          joining_date,
          city,
          pincode,
          profile_photo,
          present_address,
          payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          emp_code = VALUES(emp_code),
          first_name = VALUES(first_name),
          last_name = VALUES(last_name),
          full_name = VALUES(full_name),
          mobile = VALUES(mobile),
          password = VALUES(password),
          email = VALUES(email),
          portal_password = VALUES(portal_password),
          role = VALUES(role),
          role_name = VALUES(role_name),
          salary = VALUES(salary),
          joining_date = VALUES(joining_date),
          city = VALUES(city),
          pincode = VALUES(pincode),
          profile_photo = VALUES(profile_photo),
          present_address = VALUES(present_address),
          payload = VALUES(payload)
        `,
        [
          externalId,
          emp.empCode || "",
          emp.firstName || "",
          emp.lastName || "",
          `${emp.firstName || ""} ${emp.lastName || ""}`,
          emp.mobile || "",
          emp.portalPassword || "",
          emp.email || emp.emailId || "",
          emp.portalPassword || "",
          emp.role || "",
          emp.roleName || "",
          emp.salary || emp.salaryPerMonth || 0,
          emp.dateOfJoining || null,
          emp.city || "",
          emp.pincode || "",
          emp.profile_photo || "",
          emp.present_address || "",
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
      await ensureEmployeeAuthColumns(conn);
      const isNumeric = /^\d+$/.test(target);
      const query = isNumeric
        ? `SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, password, email, portal_password, city, pincode, profile_photo, present_address, salary, joining_date, payload
           FROM employees
           WHERE external_id = ? OR id = ? LIMIT 1`
        : `SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, password, email, portal_password, city, pincode, profile_photo, present_address, salary, joining_date, payload
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
        portalPassword: String(payload.portalPassword ?? row.password ?? row.portal_password ?? '').trim(),
        city: String(payload.city ?? row.city ?? '').trim(),
        pincode: String(payload.pincode ?? row.pincode ?? '').trim(),
        profile_photo: String(row?.profile_photo ?? payload.profile_photo ?? '').trim(),
        present_address: String(row?.present_address ?? payload.present_address ?? '').trim(),
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

app.put('/api/employees/:id', employeePhotoUpload.single('profilePhoto'), async (req, res) => {
  const employeeId = String(req.params.id || '').trim();
  const incoming = req.body && typeof req.body === 'object' ? req.body : {};

  // Handle profile photo upload
  if (req.file) {
    const relativePath = `/uploads/employees/photos/${req.file.filename}`;
    incoming.profile_photo = relativePath;
    syncUploadToMirror(`employees/photos/${req.file.filename}`);
    console.log('Employee profile photo uploaded path:', req.file.path);
    console.log('Employee profile photo saved path:', relativePath);
  }

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

  if (!canUseMysql()) {
    try {
      const rows = readJsonFile(employeesFile, []);
      const nextRows = Array.isArray(rows) ? [...rows] : [];
      const index = nextRows.findIndex((entry) => String(entry?._id || '').trim() === employeeId);
      if (index === -1) return res.status(404).json({ error: 'Employee not found' });
      nextRows[index] = { ...nextRows[index], ...payloadToSave, ...updatedEmployee };
      fs.writeFileSync(employeesFile, JSON.stringify(nextRows, null, 2));
      return res.json({ success: true, employee: nextRows[index] });
    } catch (error) {
      console.error('Employees JSON update failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to update employee in JSON storage' });
    }
  }

  try {
    const affectedRows = await withMysqlConnection(async (conn) => {
      await ensureEmployeeAuthColumns(conn);
      const numericId = Number(employeeId);
      const safeNumericId = Number.isFinite(numericId) ? numericId : -1;
      const [result] = await conn.query(
        `UPDATE employees
         SET external_id = ?, emp_code = ?, first_name = ?, last_name = ?, full_name = ?, mobile = ?, password = ?, email = ?, portal_password = ?, role = ?, role_name = ?, salary = ?, joining_date = ?, city = ?, pincode = ?, profile_photo = ?, present_address = ?, status = ?, payload = ?
         WHERE external_id = ? OR id = ?`,
        [
          updatedEmployee._id,
          updatedEmployee.empCode || '',
          updatedEmployee.firstName || '',
          updatedEmployee.lastName || '',
          `${updatedEmployee.firstName || ''} ${updatedEmployee.lastName || ''}`.trim(),
          updatedEmployee.mobile || '',
          String(payloadToSave.portalPassword || '').trim(),
          updatedEmployee.email || '',
          String(payloadToSave.portalPassword || '').trim(),
          updatedEmployee.role || '',
          updatedEmployee.roleName || '',
          updatedEmployee.salary || 0,
          updatedEmployee.dateOfJoining || null,
          updatedEmployee.city || '',
          updatedEmployee.pincode || '',
          String(incoming.profile_photo || '').trim(),
          String(incoming.present_address || '').trim(),
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
  try {
    const employeeId = String(req.params.id || '').trim();
    if (!canUseMysql()) {
      const rows = readJsonFile(employeesFile, []);
      const nextRows = (Array.isArray(rows) ? rows : []).filter((entry) => String(entry?._id || '').trim() !== employeeId);
      if (nextRows.length === (Array.isArray(rows) ? rows.length : 0)) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      fs.writeFileSync(employeesFile, JSON.stringify(nextRows, null, 2));
      return res.json({ message: 'Employee deleted' });
    }
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

  let employee = null;
  try {
    employee = await fetchEmployeeByAnyId(employeeId);
  } catch (error) {
    console.error('Employee lookup failed during attendance save:', error.message);
  }

  const employeeName = employee
    ? ([employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee')
    : String(req.body?.employeeName || req.body?.name || 'Employee').trim();
  const employeeCode = employee
    ? String(employee.empCode || '').trim()
    : String(req.body?.employeeCode || '').trim();
  const stableExternalId = `ATT-${employeeId.replace(/[^a-zA-Z0-9_-]/g, '')}-${date.replace(/[^0-9-]/g, '')}`;

  const nextRecord = sanitizeAttendanceRecord({
    _id: req.body?._id || stableExternalId,
    employeeId,
    employeeCode,
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

  if (canUseMysql()) {
    try {
      await pullGoogleTaskUpdatesToCrmSafely();
      const mysqlRows = await withMysqlConnection(async (conn) => {
        const [rows] = await conn.query('SELECT payload FROM jobs ORDER BY id DESC');
        return Array.isArray(rows) ? rows : [];
      });
      const parsed = (Array.isArray(mysqlRows) ? mysqlRows : [])
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean);
      return res.json(filterJobs(parsed));
    } catch (error) {
      console.error('MySQL jobs read failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to fetch jobs from MySQL' });
    }
  }

  const jobs = readJsonFile(jobsFile, []);
  res.json(filterJobs(jobs));
});

app.post('/api/jobs', async (req, res) => {
  if (canUseMysql()) {
    try {
      const settings = await readSettingsFromMysql();
      const mysqlRows = await withMysqlConnection(async (conn) => {
        const [rows] = await conn.query('SELECT payload FROM jobs ORDER BY id DESC');
        return Array.isArray(rows) ? rows : [];
      });
      const mysqlJobs = (Array.isArray(mysqlRows) ? mysqlRows : [])
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean);

      const generatedJobNumber = createNextJobNumber(mysqlJobs, settings);
      const providedJobNumber = normalizeSettingsText(req.body?.jobNumber || '');
      const jobNumber = providedJobNumber || generatedJobNumber;
      const newJob = {
        _id: createJobId(),
        ...req.body,
        jobNumber,
        status: req.body.status || 'Scheduled',
        createdAt: new Date().toISOString()
      };

      await syncJobToMysql(newJob);
      await updateSettingsNextJobNumber(jobNumber, settings);

      const markCompleted = String(newJob.status || '').trim().toLowerCase() === 'completed';
      Promise.allSettled([
        syncJobGoogleTaskSafely(newJob, { markCompleted }),
        syncJobGoogleCalendarSafely(newJob)
      ]).then(() => {
        syncJobToMysql(newJob).catch((error) => {
          console.error('MySQL re-sync after Google sync failed:', error.message);
        });
      }).catch((error) => {
        console.error('Background Google sync failed on create:', error.message);
      });

      // Optional JSON shadow write for emergency fallback cache.
      try {
        const jobs = readJsonFile(jobsFile, []);
        jobs.push(newJob);
        fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
      } catch (error) {
        console.error('JSON jobs shadow write failed:', error.message);
      }

      notifyTechnicianPush(newJob, 'job_assigned');

      return res.json(newJob);
    } catch (error) {
      console.error('MySQL job create failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to create job in MySQL' });
    }
  }

  const settings = readSettings();
  const jobs = readJsonFile(jobsFile, []);
  const generatedJobNumber = createNextJobNumber(jobs, settings);
  const providedJobNumber = normalizeSettingsText(req.body?.jobNumber || '');
  const jobNumber = providedJobNumber || generatedJobNumber;
  const newJob = {
    _id: createJobId(),
    ...req.body,
    jobNumber,
    status: req.body.status || 'Scheduled',
    createdAt: new Date().toISOString()
  };

  jobs.push(newJob);
  fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
  await updateSettingsNextJobNumber(jobNumber, settings);

  try {
    await syncJobToMysql(newJob);
  } catch (error) {
    console.error('MySQL job write failed (JSON saved):', error.message);
  }

  // Google sync should never block job creation response.
  const markCompleted = String(newJob.status || '').trim().toLowerCase() === 'completed';
  Promise.allSettled([
    syncJobGoogleTaskSafely(newJob, { markCompleted }),
    syncJobGoogleCalendarSafely(newJob)
  ]).then(() => {
    syncJobToMysql(newJob).catch((error) => {
      console.error('MySQL re-sync after Google sync failed:', error.message);
    });
  }).catch((error) => {
    console.error('Background Google sync failed on create:', error.message);
  });

  notifyTechnicianPush(newJob, 'job_assigned');

  res.json(newJob);
});

app.put('/api/jobs/:id', async (req, res) => {
  if (canUseMysql()) {
    try {
      const targetId = String(req.params.id || '').trim();
      const safeNumericId = /^\d+$/.test(targetId) ? Number(targetId) : null;
      const mysqlJob = await withMysqlConnection(async (conn) => {
        const sql = safeNumericId !== null
          ? 'SELECT payload, external_id FROM jobs WHERE external_id = ? OR id = ? ORDER BY id DESC LIMIT 1'
          : 'SELECT payload, external_id FROM jobs WHERE external_id = ? ORDER BY id DESC LIMIT 1';
        const params = safeNumericId !== null ? [targetId, safeNumericId] : [targetId];
        const [rows] = await conn.query(sql, params);
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;
        const raw = row.payload;
        if (!raw) return null;
        if (typeof raw === 'string') {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return raw;
      });
      if (!mysqlJob || String(mysqlJob?._id || '').trim() === '') {
        return res.status(404).json({ error: 'Job not found' });
      }

      const updatedJob = {
        ...mysqlJob,
        ...req.body,
        _id: mysqlJob._id
      };

      const nextStatus = String(req.body?.status || '').trim().toLowerCase();

      await syncJobToMysql(updatedJob);

      Promise.allSettled([
        syncJobGoogleTaskSafely(updatedJob, { markCompleted: nextStatus === 'completed' }),
        syncJobGoogleCalendarSafely(updatedJob)
      ]).then(() => {
        syncJobToMysql(updatedJob).catch((error) => {
          console.error('MySQL re-sync after Google sync failed:', error.message);
        });
      }).catch((error) => {
        console.error('Background Google sync failed on update:', error.message);
      });

      // Optional JSON shadow sync.
      try {
        const jsonJobs = readJsonFile(jobsFile, []);
        const idx = jsonJobs.findIndex((job) => String(job?._id || '').trim() === targetId);
        if (idx === -1) jsonJobs.push(updatedJob);
        else jsonJobs[idx] = updatedJob;
        fs.writeFileSync(jobsFile, JSON.stringify(jsonJobs, null, 2));
      } catch (error) {
        console.error('JSON jobs shadow update failed:', error.message);
      }

      notifyTechnicianPush(updatedJob, nextStatus === 'completed' ? 'job_completed' : 'job_updated');

      return res.json(updatedJob);
    } catch (error) {
      console.error('MySQL job update failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to update job in MySQL' });
    }
  }

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
  Promise.allSettled([
    syncJobGoogleTaskSafely(updatedJob, { markCompleted: nextStatus === 'completed' }),
    syncJobGoogleCalendarSafely(updatedJob)
  ]).then(() => {
    syncJobToMysql(updatedJob).catch((error) => {
      console.error('MySQL re-sync after Google sync failed:', error.message);
    });
  }).catch((error) => {
    console.error('Background Google sync failed on update:', error.message);
  });

  notifyTechnicianPush(updatedJob, nextStatus === 'completed' ? 'job_completed' : 'job_updated');

  res.json(updatedJob);
});

app.post('/api/jobs/:id/complete', jobCompletionUpload, async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim();
    const safeNumericId = /^\d+$/.test(targetId) ? Number(targetId) : null;
    const signature = String(req.body?.customerSignature || '').trim();
    const uploadedBeforeFile = req.files?.beforePhotoFile?.[0];
    const uploadedAfterFile = req.files?.afterPhotoFile?.[0];
    const uploadedBeforeUrl = uploadedBeforeFile ? `${resolveServerOrigin(req)}/uploads/${uploadedBeforeFile.filename}` : '';
    const uploadedAfterUrl = uploadedAfterFile ? `${resolveServerOrigin(req)}/uploads/${uploadedAfterFile.filename}` : '';
    const providedBeforeUrl = String(req.body?.beforePhoto || '').trim();
    const providedAfterUrl = String(req.body?.afterPhoto || '').trim();

    const nextFields = {
      status: String(req.body?.status || 'Completed').trim() || 'Completed',
      punchInTime: String(req.body?.punchInTime || '').trim(),
      punchOutTime: String(req.body?.punchOutTime || '').trim(),
      completionCardNumber: String(req.body?.completionCardNumber || '').trim(),
      completionCardGeneratedAt: String(req.body?.completionCardGeneratedAt || '').trim(),
      beforePhoto: uploadedBeforeUrl || providedBeforeUrl || '',
      afterPhoto: uploadedAfterUrl || providedAfterUrl || '',
      customerSignature: signature
    };

    if (canUseMysql()) {
      const mysqlJob = await withMysqlConnection(async (conn) => {
        const sql = safeNumericId !== null
          ? 'SELECT payload FROM jobs WHERE external_id = ? OR id = ? ORDER BY id DESC LIMIT 1'
          : 'SELECT payload FROM jobs WHERE external_id = ? ORDER BY id DESC LIMIT 1';
        const params = safeNumericId !== null ? [targetId, safeNumericId] : [targetId];
        const [rows] = await conn.query(sql, params);
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row?.payload) return null;
        if (typeof row.payload === 'string') {
          try { return JSON.parse(row.payload); } catch { return null; }
        }
        return row.payload;
      });
      if (!mysqlJob || String(mysqlJob?._id || '').trim() === '') {
        return res.status(404).json({ error: 'Job not found' });
      }

      const updatedJob = {
        ...mysqlJob,
        ...nextFields,
        _id: mysqlJob._id
      };

      await syncJobToMysql(updatedJob);
      Promise.allSettled([
        syncJobGoogleTaskSafely(updatedJob, { markCompleted: String(updatedJob.status || '').trim().toLowerCase() === 'completed' }),
        syncJobGoogleCalendarSafely(updatedJob)
      ]).catch((error) => {
        console.error('Background Google sync failed on complete:', error.message);
      });

      try {
        const jsonJobs = readJsonFile(jobsFile, []);
        const idx = jsonJobs.findIndex((job) => String(job?._id || '').trim() === targetId);
        if (idx === -1) jsonJobs.push(updatedJob);
        else jsonJobs[idx] = updatedJob;
        fs.writeFileSync(jobsFile, JSON.stringify(jsonJobs, null, 2));
      } catch (error) {
        console.error('JSON jobs shadow update failed:', error.message);
      }

      notifyTechnicianPush(updatedJob, 'job_completed');

      return res.json(updatedJob);
    }

    const jobs = readJsonFile(jobsFile, []);
    const jobIndex = jobs.findIndex((job) => String(job?._id || '').trim() === targetId);
    if (jobIndex === -1) return res.status(404).json({ error: 'Job not found' });

    const updatedJob = { ...jobs[jobIndex], ...nextFields, _id: jobs[jobIndex]._id };
    jobs[jobIndex] = updatedJob;
    fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
    notifyTechnicianPush(updatedJob, 'job_completed');
    return res.json(updatedJob);
  } catch (error) {
    console.error('Complete job submit failed:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to complete job' });
  }
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
  const normalizedFrequency = String(source.frequency || source.description || '').trim();
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
    frequency: normalizedFrequency,
    description: normalizedFrequency,
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
  const allowFallback = isCustomersJsonFallbackEnabled();
  if (!canUseMysql()) {
    if (allowFallback) {
      console.warn('[Customers API] source=fallback-json reason=mysql_not_configured');
      return res.json(readJsonFile(customersFile, []));
    }
    console.error('[Customers API] source=none reason=mysql_not_configured fallback_disabled');
    return res.status(503).json({ error: 'Customer data source unavailable: MySQL is not configured.' });
  }

  try {
    const mysqlRows = await withMysqlConnection(async (conn) => {
      await ensureCustomerPlaceColumns(conn);
      const [rows] = await conn.query('SELECT id, external_id, payload FROM customers ORDER BY id DESC');
      return Array.isArray(rows) ? rows : [];
    });
    if (Array.isArray(mysqlRows) && mysqlRows.length > 0) {
      const parsed = mysqlRows
        .map((row) => {
          const raw = row?.payload;
          const externalId = String(row?.external_id || '').trim();
          const idText = row?.id != null ? String(row.id).trim() : '';
          if (!raw) {
            return externalId || idText ? { _id: externalId || idText } : null;
          }
          if (typeof raw === 'string') {
            try {
              const payload = JSON.parse(raw);
              if (!payload || typeof payload !== 'object') return null;
              return {
                ...payload,
                _id: String(externalId || idText || payload._id || '').trim()
              };
            } catch { return null; }
          }
          if (typeof raw === 'object') {
            return {
              ...raw,
              _id: String(externalId || idText || raw._id || '').trim()
            };
          }
          return null;
        })
        .filter((row) => row && String(row._id || '').trim());
      console.info(`[Customers API] source=mysql rows=${parsed.length}`);
      return res.json(parsed);
    }
  } catch (error) {
    console.error('[Customers API] mysql_read_failed:', error.message);
    if (allowFallback) {
      console.warn('[Customers API] source=fallback-json reason=mysql_read_failed');
      return res.json(readJsonFile(customersFile, []));
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch customers from MySQL' });
  }
  console.info('[Customers API] source=mysql rows=0');
  return res.json([]);
});

app.post('/api/customers', async (req, res) => {
  try {
    const allowFallback = isCustomersJsonFallbackEnabled();
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

    if (!canUseMysql()) {
      if (allowFallback) {
        const rows = readJsonFile(customersFile, []);
        const nextRows = Array.isArray(rows) ? [...rows, newCustomer] : [newCustomer];
        fs.writeFileSync(customersFile, JSON.stringify(nextRows, null, 2));
        console.warn('[Customers API] source=fallback-json action=create reason=mysql_not_configured');
        return res.json(newCustomer);
      }
      return res.status(503).json({ error: 'Customer create unavailable: MySQL is not configured.' });
    }

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
    const allowFallback = isCustomersJsonFallbackEnabled();
    if (!canUseMysql()) {
      if (!allowFallback) {
        return res.status(503).json({ error: 'Customer update unavailable: MySQL is not configured.' });
      }
      const rows = readJsonFile(customersFile, []);
      const targetId = String(req.params.id || '').trim();
      const list = Array.isArray(rows) ? [...rows] : [];
      const index = list.findIndex((row) => String(row?._id || '').trim() === targetId);
      if (index === -1) return res.status(404).json({ error: 'Customer not found' });
      const existingCustomer = list[index] || {};
      const updatedCustomer = { ...existingCustomer, ...req.body, _id: existingCustomer._id || targetId };
      list[index] = updatedCustomer;
      fs.writeFileSync(customersFile, JSON.stringify(list, null, 2));
      console.warn('[Customers API] source=fallback-json action=update reason=mysql_not_configured');
      return res.json(updatedCustomer);
    }

    const existingCustomer = await withMysqlConnection(async (conn) => {
      await ensureCustomerPlaceColumns(conn);
      const targetId = String(req.params.id || '').trim();
      const numericId = Number(targetId);
      const isNumeric = Number.isFinite(numericId) && /^\d+$/.test(targetId);
      const [rows] = await conn.query(
        isNumeric
          ? 'SELECT id, external_id, payload FROM customers WHERE external_id = ? OR id = ? LIMIT 1'
          : 'SELECT id, external_id, payload FROM customers WHERE external_id = ? LIMIT 1',
        isNumeric ? [targetId, numericId] : [targetId]
      );
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!row?.payload) return null;
      if (typeof row.payload === 'string') {
        try {
          const payload = JSON.parse(row.payload);
          return {
            ...(payload && typeof payload === 'object' ? payload : {}),
            _id: String(payload?._id || row.external_id || row.id || '').trim()
          };
        } catch { return null; }
      }
      return {
        ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
        _id: String(row.payload?._id || row.external_id || row.id || '').trim()
      };
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
    const allowFallback = isCustomersJsonFallbackEnabled();
    if (!canUseMysql()) {
      if (!allowFallback) {
        return res.status(503).json({ error: 'Customer delete unavailable: MySQL is not configured.' });
      }
      const rows = readJsonFile(customersFile, []);
      const targetId = String(req.params.id || '').trim();
      const list = Array.isArray(rows) ? rows : [];
      const nextRows = list.filter((row) => String(row?._id || '').trim() !== targetId);
      if (nextRows.length === list.length) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      fs.writeFileSync(customersFile, JSON.stringify(nextRows, null, 2));
      console.warn('[Customers API] source=fallback-json action=delete reason=mysql_not_configured');
      return res.json({ message: 'Customer deleted' });
    }

    const deletedRows = await withMysqlConnection(async (conn) => {
      const targetId = String(req.params.id || '').trim();
      const numericId = Number(targetId);
      const isNumeric = Number.isFinite(numericId) && /^\d+$/.test(targetId);
      const [result] = await conn.query(
        isNumeric
          ? 'DELETE FROM customers WHERE external_id = ? OR id = ?'
          : 'DELETE FROM customers WHERE external_id = ?',
        isNumeric ? [targetId, numericId] : [targetId]
      );
      return Number(result?.affectedRows || 0);
    });

    if (!deletedRows) {
      console.warn(`[Customers API] source=mysql action=delete id=${String(req.params.id || '').trim()} result=not_found`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    console.info(`[Customers API] source=mysql action=delete id=${String(req.params.id || '').trim()} result=deleted`);
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

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const inclusiveDaysBetween = (start, end) => {
  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / 86400000) + 1;
};

const contractDurationLabel = (start, end) => {
  const days = inclusiveDaysBetween(start, end);
  if (!days) return '0 days';
  let months = 0;
  while (months < 600) {
    const candidateEnd = addDays(addMonthsClamped(start, months + 1), -1);
    if (candidateEnd > end) break;
    months += 1;
  }
  if (months >= 1) return `${months} ${months === 1 ? 'month' : 'months'}`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
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
  const toMysqlDateTimeOrNull = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 19).replace('T', ' ');
  };
  await withMysqlConnection(async (conn) => {
    await ensureJobsGoogleColumns(conn);
    try {
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_external_id VARCHAR(80) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_external_id VARCHAR(80) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number VARCHAR(120) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_name VARCHAR(255) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_type VARCHAR(120) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS area_name VARCHAR(255) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_date DATE NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(40) NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_created_at DATETIME NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_updated_at DATETIME NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS before_photo_url TEXT NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS after_photo_url TEXT NULL');
      await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_signature_url LONGTEXT NULL');
    } catch (_error) {
      const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='jobs'");
      const names = new Set((cols || []).map((c) => String(c.COLUMN_NAME || '')));
      if (!names.has('customer_external_id')) await conn.query('ALTER TABLE jobs ADD COLUMN customer_external_id VARCHAR(80) NULL');
      if (!names.has('invoice_external_id')) await conn.query('ALTER TABLE jobs ADD COLUMN invoice_external_id VARCHAR(80) NULL');
      if (!names.has('job_number')) await conn.query('ALTER TABLE jobs ADD COLUMN job_number VARCHAR(120) NULL');
      if (!names.has('service_name')) await conn.query('ALTER TABLE jobs ADD COLUMN service_name VARCHAR(255) NULL');
      if (!names.has('service_type')) await conn.query('ALTER TABLE jobs ADD COLUMN service_type VARCHAR(120) NULL');
      if (!names.has('area_name')) await conn.query('ALTER TABLE jobs ADD COLUMN area_name VARCHAR(255) NULL');
      if (!names.has('scheduled_date')) await conn.query('ALTER TABLE jobs ADD COLUMN scheduled_date DATE NULL');
      if (!names.has('scheduled_time')) await conn.query('ALTER TABLE jobs ADD COLUMN scheduled_time VARCHAR(40) NULL');
      if (!names.has('source_created_at')) await conn.query('ALTER TABLE jobs ADD COLUMN source_created_at DATETIME NULL');
      if (!names.has('source_updated_at')) await conn.query('ALTER TABLE jobs ADD COLUMN source_updated_at DATETIME NULL');
      if (!names.has('before_photo_url')) await conn.query('ALTER TABLE jobs ADD COLUMN before_photo_url TEXT NULL');
      if (!names.has('after_photo_url')) await conn.query('ALTER TABLE jobs ADD COLUMN after_photo_url TEXT NULL');
      if (!names.has('customer_signature_url')) await conn.query('ALTER TABLE jobs ADD COLUMN customer_signature_url LONGTEXT NULL');
    }
    const [existingCols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='jobs'");
    const columnSet = new Set((existingCols || []).map((c) => String(c.COLUMN_NAME || '').trim()).filter(Boolean));
    const serviceDate = job.scheduledDate || job.serviceDate || null;
    const serviceTime = job.scheduledTime || job.serviceTime || null;
    const candidateValues = {
      external_id: job._id,
      customer_external_id: job.customerId || null,
      customer_id: job.customerId || null,
      invoice_external_id: job.invoiceId || job.contractId || null,
      invoice_id: job.invoiceId || job.contractId || null,
      customer_name: job.customerName || null,
      job_number: job.jobNumber || null,
      assigned_to: job.technicianName || null,
      technician_name: job.technicianName || null,
      service_name: job.serviceName || null,
      service_type: job.serviceType || job.serviceName || null,
      description: job.serviceInstructions || job.notes || null,
      address: job.address || null,
      area_name: job.areaName || null,
      city: job.city || null,
      state: job.state || null,
      pincode: job.pincode || null,
      scheduled_date: serviceDate,
      service_date: serviceDate,
      scheduled_time: serviceTime,
      service_time: serviceTime,
      status: job.status || null,
      before_photo_url: job.beforePhoto || null,
      after_photo_url: job.afterPhoto || null,
      customer_signature_url: job.customerSignature || null,
      google_task_id: job.google_task_id || null,
      google_calendar_event_id: job.google_calendar_event_id || null,
      google_sync_status: job.google_sync_status || null,
      google_last_synced_at: toMysqlDateTimeOrNull(job.google_last_synced_at),
      payload: JSON.stringify(job),
      source_created_at: toMysqlDateTimeOrNull(job.createdAt),
      source_updated_at: toMysqlDateTimeOrNull(new Date())
    };

    const columns = Object.keys(candidateValues).filter((key) => columnSet.has(key));
    if (!columns.includes('external_id')) {
      throw new Error('jobs.external_id column is required for sync');
    }

    const values = columns.map((key) => candidateValues[key]);
    const updateColumns = columns.filter((key) => key !== 'external_id');
    const sql = `INSERT INTO jobs (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})
      ON DUPLICATE KEY UPDATE ${updateColumns.map((key) => `${key}=VALUES(${key})`).join(', ')}`;
    await conn.query(sql, values);
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
  await ensureColumnsIfMissing(conn, 'attendance', [
    { name: 'employee_external_id', definition: 'VARCHAR(120) NULL' },
    { name: 'employee_code', definition: 'VARCHAR(120) NULL' },
    { name: 'employee_name', definition: 'VARCHAR(255) NULL' },
    { name: 'attendance_date', definition: 'DATE NULL' },
    { name: 'check_in', definition: 'TIME NULL' },
    { name: 'check_out', definition: 'TIME NULL' },
    { name: 'working_hours', definition: 'DECIMAL(8,2) NOT NULL DEFAULT 0' },
    { name: 'payload', definition: 'JSON NULL' },
    { name: 'source_created_at', definition: 'DATETIME NULL' },
    { name: 'source_updated_at', definition: 'DATETIME NULL' }
  ]);
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

const syncJobGoogleCalendarSafely = async (job) => {
  if (!job || !job._id || !canUseMysql()) return job;
  try {
    const result = await withMysqlConnection(async (conn) => {
      const syncData = await syncGoogleCalendarEventForJob({ conn, job });
      if (syncData?.google_calendar_event_id) {
        return {
          google_calendar_event_id: syncData.google_calendar_event_id,
          google_sync_status: 'synced',
          google_last_synced_at: new Date().toISOString()
        };
      }
      return null;
    });
    if (result) {
      job.google_calendar_event_id = result.google_calendar_event_id;
      job.google_sync_status = result.google_sync_status;
      job.google_last_synced_at = result.google_last_synced_at;
    }
  } catch (error) {
    console.error('Google calendar sync failed:', error.message);
    job.google_sync_status = `error: ${String(error.message || 'calendar_sync_failed').slice(0, 120)}`;
    job.google_last_synced_at = new Date().toISOString();
  }
  return job;
};

let lastGoogleTaskPullAtMs = 0;
const GOOGLE_TASK_PULL_MIN_INTERVAL_MS = 45 * 1000;
const parseGoogleTaskNotes = (notes = '') => {
  const lines = String(notes || '').split('\n');
  const mapped = {};
  lines.forEach((line) => {
    const idx = line.indexOf(':');
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) return;
    mapped[key] = value;
  });
  return mapped;
};

const normalizeGoogleDueToDate = (dueValue = '') => {
  const raw = String(dueValue || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const pullGoogleTaskUpdatesToCrmSafely = async () => {
  if (!canUseMysql()) return;
  const now = Date.now();
  if (now - lastGoogleTaskPullAtMs < GOOGLE_TASK_PULL_MIN_INTERVAL_MS) return;
  lastGoogleTaskPullAtMs = now;
  try {
    await withMysqlConnection(async (conn) => {
      const client = await getTasksClient(conn);
      if (!client) return;
      const tasklistId = String(client.row?.tasklist_id || '').trim();
      if (!tasklistId) return;
      const [rows] = await conn.query('SELECT payload FROM jobs WHERE google_task_id IS NOT NULL AND google_task_id <> "" ORDER BY id DESC LIMIT 300');
      const jobs = (Array.isArray(rows) ? rows : [])
        .map((row) => {
          const raw = row?.payload;
          if (!raw) return null;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return null; }
          }
          return raw;
        })
        .filter(Boolean);
      for (const job of jobs) {
        const taskId = String(job.google_task_id || '').trim();
        if (!taskId) continue;
        try {
          const taskRes = await client.tasks.tasks.get({ tasklist: tasklistId, task: taskId });
          const task = taskRes?.data || {};
          const taskTitle = String(task.title || '').trim();
          const taskNotes = String(task.notes || '').trim();
          const notesMapped = parseGoogleTaskNotes(taskNotes);
          const parsedTaskDate = normalizeGoogleDueToDate(task.due || '');
          const parsedTaskTime = String(notesMapped.time || '').trim();
          let jobChanged = false;

          if (taskTitle && taskTitle !== String(job.serviceName || '').trim()) {
            job.serviceName = taskTitle;
            jobChanged = true;
          }

          const parsedInstructions = String(notesMapped.description || '').trim();
          if (parsedInstructions && parsedInstructions !== String(job.serviceInstructions || '').trim()) {
            job.serviceInstructions = parsedInstructions;
            jobChanged = true;
          }

          if (parsedTaskDate && parsedTaskDate !== String(job.scheduledDate || '').trim()) {
            job.scheduledDate = parsedTaskDate;
            jobChanged = true;
          }

          if (parsedTaskTime && parsedTaskTime !== String(job.scheduledTime || '').trim()) {
            job.scheduledTime = parsedTaskTime;
            jobChanged = true;
          }

          const taskStatus = String(task.status || '').trim().toLowerCase();
          const crmStatus = String(job.status || '').trim().toLowerCase();
          if (taskStatus === 'completed' && crmStatus !== 'completed') {
            job.status = 'Completed';
            job.punchOutTime = job.punchOutTime || new Date().toLocaleString();
            jobChanged = true;
          } else if (taskStatus === 'needsaction' && crmStatus === 'completed') {
            // Optional reopen behavior when Google task is reopened.
            job.status = 'In Progress';
            jobChanged = true;
          }

          if (jobChanged) {
            job.google_sync_status = 'synced';
            job.google_last_synced_at = new Date().toISOString();
            await syncJobToMysql(job);
          }
        } catch (_error) {
          // Keep pull robust even if one task fetch fails.
        }
      }
    });
  } catch (error) {
    console.error('Google->CRM task pull failed:', error.message);
  }
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
        'https://www.googleapis.com/auth/calendar.events',
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
  await syncJobGoogleCalendarSafely(job);
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
    google_calendar_event_id: job.google_calendar_event_id || '',
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
  if (canUseMysql()) {
    try {
      const mysqlRows = await withMysqlConnection(async (conn) => {
        const [rows] = await conn.query('SELECT payload FROM invoices ORDER BY id DESC');
        return Array.isArray(rows) ? rows : [];
      });
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
      return res.json(parsed);
    } catch (error) {
      console.error('MySQL invoices read failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to fetch invoices from MySQL' });
    }
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
  const invoices = canUseMysql() ? await loadInvoicesForContext() : readJsonFile(invoicesFile, []);
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

  if (canUseMysql()) {
    try {
      await syncInvoiceToMysql(newInvoice);
      await updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);
    } catch (error) {
      console.error('MySQL invoice write failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to create invoice in MySQL' });
    }
    try {
      const shadowInvoices = readJsonFile(invoicesFile, []);
      shadowInvoices.push(newInvoice);
      fs.writeFileSync(invoicesFile, JSON.stringify(shadowInvoices, null, 2));
    } catch (error) {
      console.error('JSON invoice shadow write failed:', error.message);
    }
  } else {
    invoices.push(newInvoice);
    fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
    await updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);
  }

  res.json(newInvoice);
});

app.put('/api/invoices/:id', async (req, res) => {
  const invoices = canUseMysql() ? await loadInvoicesForContext() : readJsonFile(invoicesFile, []);
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

  if (canUseMysql()) {
    try {
      await syncInvoiceToMysql(updatedInvoice);
      await updateSettingsNextInvoiceNumber(updatedInvoice.invoiceNumber, settings);
    } catch (error) {
      console.error('MySQL invoice update failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to update invoice in MySQL' });
    }
    try {
      const jsonInvoices = readJsonFile(invoicesFile, []);
      const jsonIndex = jsonInvoices.findIndex((invoice) => String(invoice?._id || '') === String(updatedInvoice._id || ''));
      if (jsonIndex === -1) jsonInvoices.push(updatedInvoice);
      else jsonInvoices[jsonIndex] = updatedInvoice;
      fs.writeFileSync(invoicesFile, JSON.stringify(jsonInvoices, null, 2));
    } catch (error) {
      console.error('JSON invoice shadow update failed:', error.message);
    }
  } else {
    invoices[invoiceIndex] = updatedInvoice;
    fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
    await updateSettingsNextInvoiceNumber(updatedInvoice.invoiceNumber, settings);
  }

  res.json(updatedInvoice);
});

app.delete('/api/invoices/:id', async (req, res) => {
  if (canUseMysql()) {
    try {
      const deletedRows = await withMysqlConnection(async (conn) => {
        await conn.query('DELETE FROM invoice_items WHERE invoice_external_id = ?', [req.params.id]);
        const [result] = await conn.query('DELETE FROM invoices WHERE external_id = ?', [req.params.id]);
        return Number(result?.affectedRows || 0);
      });
      if (!deletedRows) return res.status(404).json({ error: 'Invoice not found' });
    } catch (error) {
      console.error('MySQL invoice delete failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to delete invoice from MySQL' });
    }
    try {
      const invoices = readJsonFile(invoicesFile, []);
      const updatedInvoices = invoices.filter((invoice) => invoice._id !== req.params.id);
      fs.writeFileSync(invoicesFile, JSON.stringify(updatedInvoices, null, 2));
    } catch (error) {
      console.error('JSON invoice shadow delete failed:', error.message);
    }
  } else {
    const invoices = readJsonFile(invoicesFile, []);
    const updatedInvoices = invoices.filter((invoice) => invoice._id !== req.params.id);
    if (updatedInvoices.length === invoices.length) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    fs.writeFileSync(invoicesFile, JSON.stringify(updatedInvoices, null, 2));
  }

  res.json({ message: 'Invoice deleted' });
});

app.get('/api/service-schedules', async (req, res) => {
  const invoices = canUseMysql() ? await loadInvoicesForContext() : readJsonFile(invoicesFile, []);
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

const renewalStatusesNew = new Set(['Pending', 'Follow-up', 'Done', 'Declined', 'Overdue']);
const renewalSqlDate = (value) => {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
};
const renewalSqlDateTime = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
};
const renewalCleanStatus = (status) => renewalStatusesNew.has(String(status || '').trim())
  ? String(status || '').trim()
  : 'Pending';
const computeRenewalStatus = (row = {}) => {
  const stored = renewalCleanStatus(row.status);
  if (stored === 'Done' || stored === 'Declined') return stored;
  if (row.followup_date || row.followupDate) return 'Follow-up';
  const due = parseDateOnly(row.renewal_due_date || row.renewalDueDate || row.previous_contract_end || row.contractEndDate);
  const today = parseDateOnly(new Date());
  if (due && today && due < today) return 'Overdue';
  return stored === 'Overdue' ? 'Pending' : stored;
};
const renewalPublicRow = (row = {}) => {
  const payload = parseMysqlPayloadObject(row.payload) || {};
  const merged = { ...payload, ...row };
  const renewalId = String(merged.renewal_id || merged.renewalId || merged.external_id || merged._id || '').trim();
  return {
    id: merged.id,
    _id: renewalId,
    renewalId,
    renewal_id: renewalId,
    customerId: merged.customer_id ?? merged.customerId ?? null,
    customerName: merged.customer_name || merged.customerName || '',
    mobile: merged.mobile || merged.mobileNumber || '',
    email: merged.email || merged.emailId || '',
    address: merged.address || merged.billingAddressText || merged.shippingAddressText || '',
    areaName: merged.area_name || merged.areaName || merged.billingArea || '',
    serviceType: merged.service_type || merged.serviceType || '',
    contractId: merged.contract_id || merged.contractId || merged.invoiceId || '',
    previousContractStart: renewalSqlDate(merged.previous_contract_start || merged.previousContractStart || merged.contractStartDate),
    previousContractEnd: renewalSqlDate(merged.previous_contract_end || merged.previousContractEnd || merged.contractEndDate),
    renewalDueDate: renewalSqlDate(merged.renewal_due_date || merged.renewalDueDate || merged.previous_contract_end || merged.contractEndDate),
    previousAmount: toNumber(merged.previous_amount ?? merged.previousAmount ?? merged.totalAmount, 0),
    proposedAmount: toNumber(merged.proposed_amount ?? merged.proposedAmount ?? merged.previous_amount, 0),
    finalRenewalAmount: toNumber(merged.final_renewal_amount ?? merged.finalRenewalAmount, 0),
    assignedSalesPersonId: merged.assigned_sales_person_id || merged.assignedSalesPersonId || '',
    assignedSalesPersonName: merged.assigned_sales_person_name || merged.assignedSalesPersonName || '',
    renewedBySalesPersonId: merged.renewed_by_sales_person_id || merged.renewedBySalesPersonId || '',
    renewedBySalesPersonName: merged.renewed_by_sales_person_name || merged.renewedBySalesPersonName || '',
    status: computeRenewalStatus(merged),
    storedStatus: renewalCleanStatus(merged.status),
    followupDate: renewalSqlDate(merged.followup_date || merged.followupDate),
    lastFollowupNote: merged.last_followup_note || merged.lastFollowupNote || '',
    declineReason: merged.decline_reason || merged.declineReason || '',
    renewedAt: merged.renewed_at || merged.renewedAt || null,
    convertedContractId: merged.converted_contract_id || merged.convertedContractId || '',
    renewalLetterUrl: merged.renewal_letter_url || merged.renewalLetterUrl || '',
    createdAt: merged.created_at || merged.createdAt || '',
    updatedAt: merged.updated_at || merged.updatedAt || ''
  };
};
const renewalIdFromContract = (contractId, customerName = '') => {
  const source = String(contractId || customerName || Date.now()).trim();
  const safe = source.replace(/[^A-Za-z0-9]/g, '').slice(-34) || crypto.createHash('sha1').update(source).digest('hex').slice(0, 18);
  return `REN-${safe}`;
};
const createNextRenewalNumber = (existingRows = [], settings = {}) => {
  const prefix = String(settings?.renewalPrefix || 'REN-');
  const padding = Math.max(1, Number(settings?.renewalNumberPadding || 4) || 4);
  const configuredNext = Math.max(1, Number(settings?.renewalNextNumber || 1) || 1);
  let max = 0;
  existingRows.forEach((row) => {
    const raw = String(row?.renewalId || row?.renewal_id || row?.external_id || '').trim();
    if (!raw || (prefix && !raw.startsWith(prefix))) return;
    const match = raw.slice(prefix.length).match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  });
  const next = Math.max(configuredNext, max + 1);
  return {
    renewalId: `${prefix}${String(next).padStart(padding, '0')}`,
    nextNumber: next + 1
  };
};
const updateSettingsNextRenewalNumber = async (nextNumber, settings = {}) => {
  if (!canUseMysql()) return;
  const current = await readSettingsFromMysql().catch(() => settings);
  await saveSettingsToMysql({
    ...(current || settings || {}),
    renewalPrefix: String(settings?.renewalPrefix || current?.renewalPrefix || 'REN-'),
    renewalNumberPadding: Math.max(1, Number(settings?.renewalNumberPadding || current?.renewalNumberPadding || 4) || 4),
    renewalNextNumber: Math.max(1, Number(nextNumber || 1) || 1)
  });
};
const ensureRenewalTables = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS renewals (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NULL,
      renewal_id VARCHAR(100) NULL,
      customer_id INT NULL,
      customer_name VARCHAR(255) NULL,
      mobile VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      address TEXT NULL,
      area_name VARCHAR(255) NULL,
      service_type VARCHAR(255) NULL,
      contract_id VARCHAR(100) NULL,
      previous_contract_start DATE NULL,
      previous_contract_end DATE NULL,
      renewal_due_date DATE NULL,
      previous_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      proposed_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      final_renewal_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      assigned_sales_person_id VARCHAR(100) NULL,
      assigned_sales_person_name VARCHAR(255) NULL,
      renewed_by_sales_person_id VARCHAR(100) NULL,
      renewed_by_sales_person_name VARCHAR(255) NULL,
      status VARCHAR(80) NULL,
      followup_date DATE NULL,
      last_followup_note TEXT NULL,
      decline_reason TEXT NULL,
      renewed_at DATETIME NULL,
      converted_contract_id VARCHAR(100) NULL,
      renewal_letter_url TEXT NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_renewals_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumnsIfMissing(conn, 'renewals', [
    { name: 'renewal_id', definition: 'VARCHAR(100) NULL' },
    { name: 'customer_id', definition: 'INT NULL' },
    { name: 'mobile', definition: 'VARCHAR(50) NULL' },
    { name: 'email', definition: 'VARCHAR(255) NULL' },
    { name: 'address', definition: 'TEXT NULL' },
    { name: 'area_name', definition: 'VARCHAR(255) NULL' },
    { name: 'service_type', definition: 'VARCHAR(255) NULL' },
    { name: 'contract_id', definition: 'VARCHAR(100) NULL' },
    { name: 'previous_contract_start', definition: 'DATE NULL' },
    { name: 'previous_contract_end', definition: 'DATE NULL' },
    { name: 'renewal_due_date', definition: 'DATE NULL' },
    { name: 'previous_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' },
    { name: 'proposed_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' },
    { name: 'final_renewal_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' },
    { name: 'assigned_sales_person_id', definition: 'VARCHAR(100) NULL' },
    { name: 'assigned_sales_person_name', definition: 'VARCHAR(255) NULL' },
    { name: 'renewed_by_sales_person_id', definition: 'VARCHAR(100) NULL' },
    { name: 'renewed_by_sales_person_name', definition: 'VARCHAR(255) NULL' },
    { name: 'followup_date', definition: 'DATE NULL' },
    { name: 'last_followup_note', definition: 'TEXT NULL' },
    { name: 'decline_reason', definition: 'TEXT NULL' },
    { name: 'renewed_at', definition: 'DATETIME NULL' },
    { name: 'converted_contract_id', definition: 'VARCHAR(100) NULL' },
    { name: 'renewal_letter_url', definition: 'TEXT NULL' }
  ]);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS renewal_followups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NULL,
      renewal_id VARCHAR(100) NULL,
      followup_date DATE NULL,
      note TEXT NULL,
      status VARCHAR(50) NULL,
      created_by VARCHAR(255) NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS renewal_letters (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NULL,
      renewal_id VARCHAR(100) NULL,
      pdf_url TEXT NULL,
      customer_name VARCHAR(255) NULL,
      generated_by VARCHAR(255) NULL,
      generated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const ensureIndex = async (table, indexName, sql) => {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName]
    );
    if (Number(rows?.[0]?.count || 0) === 0) {
      try { await conn.query(sql); } catch (error) { if (!/duplicate|already exists/i.test(error.message || '')) throw error; }
    }
  };
  await ensureIndex('renewals', 'uk_renewals_renewal_id', 'CREATE UNIQUE INDEX uk_renewals_renewal_id ON renewals (renewal_id)');
  await ensureIndex('renewals', 'idx_renewals_due_date', 'CREATE INDEX idx_renewals_due_date ON renewals (renewal_due_date)');
  await ensureIndex('renewals', 'idx_renewals_status', 'CREATE INDEX idx_renewals_status ON renewals (status)');
  await ensureIndex('renewals', 'idx_renewals_assigned_sales', 'CREATE INDEX idx_renewals_assigned_sales ON renewals (assigned_sales_person_id)');
  await ensureIndex('renewals', 'idx_renewals_customer_id', 'CREATE INDEX idx_renewals_customer_id ON renewals (customer_id)');
  await ensureIndex('renewals', 'idx_renewals_contract_id', 'CREATE INDEX idx_renewals_contract_id ON renewals (contract_id)');
  await ensureIndex('renewal_followups', 'idx_renewal_followups_renewal_id', 'CREATE INDEX idx_renewal_followups_renewal_id ON renewal_followups (renewal_id)');
  await ensureIndex('renewal_letters', 'idx_renewal_letters_renewal_id', 'CREATE INDEX idx_renewal_letters_renewal_id ON renewal_letters (renewal_id)');
};
const loadRenewalRows = async () => {
  if (!canUseMysql()) {
    const { list } = buildRenewalDataset();
    return list.map((row) => renewalPublicRow({
      renewal_id: row._id,
      customer_name: row.customerName,
      mobile: row.mobileNumber,
      email: row.email,
      address: row.address,
      area_name: row.areaName,
      service_type: row.serviceType,
      contract_id: row.invoiceId,
      previous_contract_start: row.contractStartDate,
      previous_contract_end: row.contractEndDate,
      renewal_due_date: row.contractEndDate,
      previous_amount: row.totalAmount,
      proposed_amount: row.quotation?.amount || row.totalAmount,
      status: row.status === 'Renewed' ? 'Done' : row.status === 'Lost' ? 'Declined' : 'Pending',
      payload: row
    }));
  }
  return withMysqlConnection(async (conn) => {
    await ensureRenewalTables(conn);
    const [rows] = await conn.query('SELECT * FROM renewals ORDER BY renewal_due_date ASC, customer_name ASC');
    return (Array.isArray(rows) ? rows : []).map(renewalPublicRow);
  });
};
const findRenewalRow = async (id) => {
  const lookup = String(id || '').trim();
  if (!lookup) return null;
  if (!canUseMysql()) return (await loadRenewalRows()).find((row) => row.renewalId === lookup || String(row.id) === lookup) || null;
  return withMysqlConnection(async (conn) => {
    await ensureRenewalTables(conn);
    const [rows] = await conn.query('SELECT * FROM renewals WHERE renewal_id = ? OR external_id = ? OR id = ? LIMIT 1', [lookup, lookup, lookup]);
    return rows?.[0] ? renewalPublicRow(rows[0]) : null;
  });
};
const applyRenewalFilters = (rows, query = {}) => {
  const now = parseDateOnly(new Date());
  const year = Number(query.year || now.getFullYear());
  const month = Number(query.month || now.getMonth() + 1);
  let from = query.fromDate ? parseDateOnly(query.fromDate) : null;
  let to = query.toDate ? parseDateOnly(query.toDate) : null;
  if (!from && !to) {
    if (query.range === 'thisMonth') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (query.range === 'nextMonth') {
      from = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    } else if (query.range === 'threeMonths') {
      from = now;
      to = addMonthsClamped(now, 3);
    } else if (query.range === 'custom') {
      from = new Date(year, month - 1, 1);
      to = new Date(year, month, 0);
    } else if (query.range === 'year') {
      from = new Date(year, 0, 1);
      to = new Date(year, 11, 31);
    }
  }
  const search = String(query.search || '').trim().toLowerCase();
  const status = String(query.status || '').trim();
  const assigned = String(query.assignedSalesPersonId || '').trim();
  return rows.filter((row) => {
    const due = parseDateOnly(row.renewalDueDate);
    if (from && due && due < from) return false;
    if (to && due && due > to) return false;
    if (status && status !== 'All' && row.status !== status) return false;
    if (assigned && String(row.assignedSalesPersonId || '') !== assigned) return false;
    if (search) {
      const hay = `${row.customerName} ${row.mobile} ${row.serviceType} ${row.areaName}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
};
const summarizeRenewals = (rows = []) => {
  const customers = new Set(rows.map((row) => String(row.customerId || row.customerName || '').trim()).filter(Boolean));
  const bySales = new Map();
  const byMonth = new Map();
  const byYear = new Map();
  rows.forEach((row) => {
    const salesKey = row.assignedSalesPersonName || 'Unassigned';
    const sales = bySales.get(salesKey) || { name: salesKey, total: 0, done: 0, pending: 0, amount: 0 };
    sales.total += 1;
    if (row.status === 'Done') sales.done += 1;
    if (row.status !== 'Done' && row.status !== 'Declined') sales.pending += 1;
    sales.amount += toNumber(row.proposedAmount, 0);
    bySales.set(salesKey, sales);
    const due = parseDateOnly(row.renewalDueDate);
    const monthKey = due ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}` : 'No date';
    const yearKey = due ? String(due.getFullYear()) : 'No date';
    const m = byMonth.get(monthKey) || { period: monthKey, count: 0, amount: 0 };
    m.count += 1; m.amount += toNumber(row.proposedAmount, 0); byMonth.set(monthKey, m);
    const y = byYear.get(yearKey) || { year: yearKey, count: 0, amount: 0 };
    y.count += 1; y.amount += toNumber(row.proposedAmount, 0); byYear.set(yearKey, y);
  });
  return {
    totalRenewals: rows.length,
    totalRenewalAmount: rows.reduce((sum, row) => sum + toNumber(row.proposedAmount || row.finalRenewalAmount, 0), 0),
    customerCount: customers.size,
    doneCount: rows.filter((row) => row.status === 'Done').length,
    pendingCount: rows.filter((row) => row.status === 'Pending').length,
    declinedCount: rows.filter((row) => row.status === 'Declined').length,
    followupCount: rows.filter((row) => row.status === 'Follow-up').length,
    overdueCount: rows.filter((row) => row.status === 'Overdue').length,
    assignedSalesPersonCount: new Set(rows.map((row) => row.assignedSalesPersonId || row.assignedSalesPersonName).filter(Boolean)).size,
    salespersonWiseSummary: Array.from(bySales.values()),
    monthWiseSummary: Array.from(byMonth.values()).sort((a, b) => String(a.period).localeCompare(String(b.period))),
    yearWiseSummary: Array.from(byYear.values()).sort((a, b) => String(a.year).localeCompare(String(b.year)))
  };
};
const sourceRenewalCandidates = async () => {
  const invoices = await loadInvoicesForContext();
  const customers = await loadCustomersForContext();
  const customerById = new Map(customers.map((customer) => [String(customer?._id || ''), customer]));
  const today = parseDateOnly(new Date());
  const horizon = addMonthsClamped(today, 3);
  return (Array.isArray(invoices) ? invoices : [])
    .map((invoice) => {
      const window = deriveInvoiceContractWindow(invoice);
      const end = parseDateOnly(window.contractEndDate || invoice.servicePeriodEnd || invoice.dueDate);
      if (!end || end > horizon) return null;
      const customer = customerById.get(String(invoice.customerId || '')) || {};
      const firstItem = Array.isArray(invoice.items) ? invoice.items[0] || {} : {};
      const customerName = invoice.customerName || customer.displayName || customer.name || customer.customerName || '';
      const mobile = customer.mobileNumber || customer.workPhone || invoice.mobileNumber || '';
      if (!customerName || !mobile) return null;
      const amount = toNumber(invoice.total ?? invoice.amount, 0);
      return {
        sourceRenewalKey: renewalIdFromContract(invoice._id, customerName),
        customerId: Number(customer.id || customer.customerId) || null,
        customerName,
        mobile,
        email: customer.emailId || customer.email || invoice.email || '',
        address: invoice.billingAddressText || invoice.shippingAddressText || customer.billingAddress || customer.shippingAddress || customer.address || '',
        areaName: customer.billingArea || customer.areaName || customer.area || '',
        serviceType: firstItem.itemName || invoice.subject || invoice.serviceType || 'Pest Control Service',
        contractId: invoice._id,
        previousContractStart: renewalSqlDate(window.contractStartDate || invoice.servicePeriodStart),
        previousContractEnd: renewalSqlDate(window.contractEndDate || invoice.servicePeriodEnd || invoice.dueDate),
        renewalDueDate: renewalSqlDate(window.contractEndDate || invoice.servicePeriodEnd || invoice.dueDate),
        previousAmount: amount,
        proposedAmount: amount,
        assignedSalesPersonId: invoice.salespersonId || '',
        assignedSalesPersonName: invoice.salesperson || invoice.salesPerson || '',
        sourceInvoice: invoice
      };
    })
    .filter(Boolean);
};

app.get('/api/renewals', async (req, res) => {
  try {
    const rows = applyRenewalFilters(await loadRenewalRows(), req.query);
    return res.json(rows);
  } catch (error) {
    console.error('Renewals list failed:', error.message);
    return res.status(500).json({ error: 'Unable to load renewals right now.' });
  }
});

app.get('/api/renewals/summary', async (req, res) => {
  try {
    const rows = applyRenewalFilters(await loadRenewalRows(), req.query);
    return res.json(summarizeRenewals(rows));
  } catch (error) {
    console.error('Renewals summary failed:', error.message);
    return res.status(500).json({ error: 'Unable to load renewal summary right now.' });
  }
});

app.post('/api/renewals/sync', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to sync renewal records.' });
  try {
    const candidates = await sourceRenewalCandidates();
    let inserted = 0;
    let nextRenewalNumber = null;
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      const settings = await loadCurrentSettingsForNumbering();
      const [existingRows] = await conn.query('SELECT renewal_id, external_id FROM renewals ORDER BY id ASC');
      const existingByContract = new Map((existingRows || []).map((entry) => [String(entry.external_id || '').trim(), String(entry.renewal_id || entry.external_id || '').trim()]));
      for (const row of candidates) {
        const existingRenewalId = existingByContract.get(row.sourceRenewalKey) || '';
        const prefix = String(settings?.renewalPrefix || 'REN-');
        const hasConfiguredNumber = existingRenewalId && existingRenewalId.startsWith(prefix) && /\d+$/.test(existingRenewalId.slice(prefix.length));
        const renewalId = hasConfiguredNumber ? existingRenewalId : createNextRenewalNumber(existingRows, settings).renewalId;
        if (!hasConfiguredNumber) {
          existingRows.push({ renewal_id: renewalId, external_id: row.sourceRenewalKey });
          const parsed = createNextRenewalNumber(existingRows, settings);
          nextRenewalNumber = parsed.nextNumber;
        }
        const payload = { source: 'invoice-sync', syncedAt: new Date().toISOString(), sourceInvoice: row.sourceInvoice };
        const [result] = await conn.query(
          `INSERT INTO renewals (
            external_id, renewal_id, customer_id, customer_name, mobile, email, address, area_name, service_type,
            contract_id, previous_contract_start, previous_contract_end, renewal_due_date, previous_amount,
            proposed_amount, assigned_sales_person_id, assigned_sales_person_name, status, payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            customer_name=VALUES(customer_name),
            renewal_id=IF(renewal_id IS NULL OR renewal_id = '' OR renewal_id = external_id, VALUES(renewal_id), renewal_id),
            mobile=VALUES(mobile),
            email=VALUES(email),
            address=VALUES(address),
            area_name=VALUES(area_name),
            service_type=VALUES(service_type),
            previous_contract_start=VALUES(previous_contract_start),
            previous_contract_end=VALUES(previous_contract_end),
            renewal_due_date=VALUES(renewal_due_date),
            previous_amount=VALUES(previous_amount),
            proposed_amount=IF(proposed_amount IS NULL OR proposed_amount = 0, VALUES(proposed_amount), proposed_amount),
            assigned_sales_person_id=IF(assigned_sales_person_id IS NULL OR assigned_sales_person_id = '', VALUES(assigned_sales_person_id), assigned_sales_person_id),
            assigned_sales_person_name=IF(assigned_sales_person_name IS NULL OR assigned_sales_person_name = '', VALUES(assigned_sales_person_name), assigned_sales_person_name),
            payload=VALUES(payload)`,
          [
            row.sourceRenewalKey, renewalId, row.customerId, row.customerName, row.mobile, row.email, row.address, row.areaName,
            row.serviceType, row.contractId, row.previousContractStart, row.previousContractEnd, row.renewalDueDate,
            row.previousAmount, row.proposedAmount, row.assignedSalesPersonId, row.assignedSalesPersonName,
            computeRenewalStatus({ renewal_due_date: row.renewalDueDate, status: 'Pending' }),
            JSON.stringify(payload)
          ]
        );
        if (result?.affectedRows === 1) inserted += 1;
      }
    });
    if (nextRenewalNumber) await updateSettingsNextRenewalNumber(nextRenewalNumber);
    return res.json({ success: true, message: 'Renewal synced successfully', inserted, totalCandidates: candidates.length });
  } catch (error) {
    console.error('Renewal sync failed:', error.message);
    return res.status(500).json({ error: 'Unable to sync renewals right now.' });
  }
});

app.post('/api/renewals/:id/assign', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to assign renewal sales person.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  const salesId = String(req.body.salesPersonId || req.body.assignedSalesPersonId || '').trim();
  const salesName = String(req.body.salesPersonName || req.body.assignedSalesPersonName || '').trim();
  if (!salesId && !salesName) return res.status(400).json({ error: 'Sales person is required.' });
  try {
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query(
        'UPDATE renewals SET assigned_sales_person_id = ?, assigned_sales_person_name = ? WHERE renewal_id = ?',
        [salesId, salesName, renewal.renewalId]
      );
    });
    return res.json({ success: true, message: 'Sales person assigned', renewal: await findRenewalRow(renewal.renewalId) });
  } catch (error) {
    console.error('Renewal assign failed:', error.message);
    return res.status(500).json({ error: 'Unable to assign sales person right now.' });
  }
});

app.post('/api/renewals/:id/edit', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to edit renewal records.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  const proposedAmount = toNumber(req.body.proposedAmount, renewal.proposedAmount);
  if (proposedAmount < 0) return res.status(400).json({ error: 'Amount must be numeric.' });
  try {
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query(
        `UPDATE renewals
         SET service_type = ?, renewal_due_date = ?, proposed_amount = ?, status = ?, last_followup_note = ?
         WHERE renewal_id = ?`,
        [
          String(req.body.serviceType || renewal.serviceType || '').trim(),
          renewalSqlDate(req.body.renewalDueDate || renewal.renewalDueDate),
          proposedAmount,
          renewalCleanStatus(req.body.status || renewal.storedStatus || renewal.status),
          String(req.body.note || renewal.lastFollowupNote || '').trim(),
          renewal.renewalId
        ]
      );
    });
    return res.json({ success: true, message: 'Renewal updated', renewal: await findRenewalRow(renewal.renewalId) });
  } catch (error) {
    console.error('Renewal edit failed:', error.message);
    return res.status(500).json({ error: 'Unable to update renewal right now.' });
  }
});

app.delete('/api/renewals/:id', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to delete renewal records.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  try {
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      const letterUrls = new Set();
      if (renewal.renewalLetterUrl) letterUrls.add(renewal.renewalLetterUrl);
      const [letterRows] = await conn.query('SELECT pdf_url FROM renewal_letters WHERE renewal_id = ?', [renewal.renewalId]);
      (Array.isArray(letterRows) ? letterRows : []).forEach((letter) => {
        if (letter?.pdf_url) letterUrls.add(letter.pdf_url);
      });
      letterUrls.forEach((url) => deleteUploadFile(url));
      await conn.query('DELETE FROM renewal_followups WHERE renewal_id = ?', [renewal.renewalId]);
      await conn.query('DELETE FROM renewal_letters WHERE renewal_id = ?', [renewal.renewalId]);
      await conn.query('DELETE FROM renewals WHERE renewal_id = ?', [renewal.renewalId]);
    });
    return res.json({ success: true, message: 'Renewal deleted' });
  } catch (error) {
    console.error('Renewal delete failed:', error.message);
    return res.status(500).json({ error: 'Unable to delete renewal right now.' });
  }
});

app.post('/api/renewals/:id/followup', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to save renewal follow-up.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  const note = String(req.body.note || req.body.lastFollowupNote || '').trim();
  const followupDate = renewalSqlDate(req.body.followupDate || req.body.followup_date);
  if (!followupDate && !note) return res.status(400).json({ error: 'Follow-up date or note is required.' });
  try {
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query('UPDATE renewals SET status = ?, followup_date = ?, last_followup_note = ? WHERE renewal_id = ?', ['Follow-up', followupDate, note, renewal.renewalId]);
      await conn.query(
        'INSERT INTO renewal_followups (external_id, renewal_id, followup_date, note, status, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`RFU-${Date.now()}`, renewal.renewalId, followupDate, note, 'Follow-up', readUserMeta(req), JSON.stringify(req.body || {})]
      );
    });
    return res.json({ success: true, message: 'Follow-up saved', renewal: await findRenewalRow(renewal.renewalId) });
  } catch (error) {
    console.error('Renewal follow-up failed:', error.message);
    return res.status(500).json({ error: 'Unable to save follow-up right now.' });
  }
});

app.post('/api/renewals/:id/generate-letter', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to generate renewal letters.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  try {
    const settings = await loadCurrentSettingsForNumbering();
    const lettersDir = path.join(uploadsDir, 'renewal-letters');
    fs.mkdirSync(lettersDir, { recursive: true });
    const fileName = `${renewal.renewalId}-${Date.now()}.pdf`;
    const relativePath = `renewal-letters/${fileName}`;
    const fullPath = path.join(lettersDir, fileName);
    const doc = new PDFDocument({ size: 'A4', margin: 46 });
    const stream = fs.createWriteStream(fullPath);
    doc.pipe(stream);

    const companyName = String(settings?.gstCompanyName || settings?.companyName || 'Skuas Pest Control Private Limited').trim();
    const companyAddress = String(settings?.gstBillingAddress || settings?.companyAddress || '22 Ground Floor,Sarai Jullena,Okhla Road').trim();
    const companyCityLine = [
      String(settings?.gstCity || settings?.companyCity || 'New Delhi').trim(),
      String(settings?.gstState || settings?.companyState || 'Delhi').trim()
    ].filter(Boolean).join(',');
    const companyPin = String(settings?.gstPincode || settings?.companyPincode || '110025').trim();
    const companyEmail = String(settings?.gstEmail || settings?.companyEmail || 'skuaspestcontrol@gmail.com').trim();
    const companyPhone = String(settings?.gstPhone || settings?.companyMobile || '9316666656').trim();
    const companyWebsite = String(settings?.companyWebsite || 'www.skuaspestcontrol.com').trim();
    const companyGst = String(settings?.companyGstNumber || settings?.gstRegistrationNumber || '07ABMCS7628G1ZW').trim();
    const pageRight = doc.page.width - 46;
    const detailX = 46;
    const detailY = 54;
    const detailWidth = pageRight - detailX;
    doc.font('Helvetica-Bold').fontSize(10.8).fillColor('#334155').text(companyName, detailX, detailY, { width: detailWidth, align: 'left' });
    doc.font('Helvetica').fontSize(9.2).fillColor('#334155');
    const addressLines = [
      companyAddress,
      `${companyCityLine}${companyPin ? `- ${companyPin}` : ''}, India`
    ].filter(Boolean);
    addressLines.forEach((line) => {
      doc.text(line, detailX, doc.y + 1, { width: detailWidth, align: 'left' });
    });
    const red = '#e11d48';
    doc.fillColor('#334155').text('E Mail: ', detailX, doc.y + 1, { continued: true });
    doc.fillColor(red).text(companyEmail || '-');
    doc.fillColor('#334155').text('Tel: ', detailX, doc.y + 1, { continued: true });
    doc.fillColor(red).text(companyPhone || '-');
    doc.fillColor('#334155').text('Web: ', detailX, doc.y + 1, { continued: true });
    doc.fillColor(red).text(companyWebsite || '-');
    doc.fillColor('#334155').text('GST: ', detailX, doc.y + 1, { continued: true });
    doc.fillColor(red).text(companyGst || '-');

    doc.moveTo(46, 204).lineTo(pageRight, 204).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#9F174D').text('Renewal Letter', 46, 222, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#111827').text(`Date: ${formatDate(new Date())}`);
    const renewalPrefix = String(settings?.renewalPrefix || 'REN-').trim() || 'REN-';
    const renewalIdText = String(renewal.renewalId || '').startsWith(renewalPrefix)
      ? renewal.renewalId
      : `${renewalPrefix}${String(renewal.renewalId || '').replace(/^[A-Z]+-?/i, '')}`;
    doc.text(`Renewal ID: ${renewalIdText}`);
    doc.moveDown();
    doc.fontSize(11).text(`Dear ${renewal.customerName},`);
    doc.moveDown(0.5);
    const formatRenewalLetterDate = (value) => {
      const date = parseDateOnly(value);
      if (!date) return formatDate(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('en-GB', { month: 'short' });
      return `${day}/${month}/${date.getFullYear()}`;
    };
    const previousEndDate = parseDateOnly(renewal.previousContractEnd || renewal.renewalDueDate);
    const contractStartDate = parseDateOnly(renewal.previousContractStart) || (previousEndDate ? addDays(previousEndDate, 1) : null);
    const contractEndText = formatRenewalLetterDate(previousEndDate || renewal.renewalDueDate);
    const contractStartText = formatRenewalLetterDate(contractStartDate);
    const contractRangeEndText = formatRenewalLetterDate(previousEndDate || renewal.renewalDueDate);
    const durationText = contractDurationLabel(contractStartDate, previousEndDate);
    const serviceName = String(renewal.serviceType || 'Pest Management Services').trim();
    const drawBodyPart = (text, bold = false, options = {}) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor('#111827').text(text, {
        width: pageRight - 46,
        align: 'left',
        ...options
      });
    };
    drawBodyPart('It is our privilege to have been of service to you over the past year. We value our association and trust you have found our services exemplary and to your complete satisfaction.');
    doc.moveDown();
    drawBodyPart('Your current contract for ', false, { continued: true });
    drawBodyPart(serviceName, true, { continued: true });
    drawBodyPart(' concludes on ', false, { continued: true });
    drawBodyPart(contractEndText, true, { continued: true });
    drawBodyPart('. In order to enjoy uninterrupted service for a pest-free environment, we recommend you to renew the contract at the earliest. Our renewal charges mentioned below at terms and conditions for a ', false, { continued: true });
    drawBodyPart(durationText, true, { continued: true });
    drawBodyPart(' contract', false, { continued: true });
    drawBodyPart(' (', false, { continued: true });
    drawBodyPart(`${contractStartText} to ${contractRangeEndText}`, true, { continued: true });
    drawBodyPart(').');
    doc.moveDown();
    const amountWithGst = Math.max(0, toNumber(renewal.proposedAmount, 0));
    const amountWithoutGst = amountWithGst > 0 ? amountWithGst / 1.18 : 0;
    const formatTableAmount = (value) => `${Math.round(toNumber(value, 0)).toLocaleString('en-IN')}/-`;
    const formatTableAmountWords = (value) => {
      const words = amountToWords(Math.round(toNumber(value, 0)));
      const match = words.match(/^(.*) Rupees Only$/i);
      return match ? `Rupees ${match[1]} Only/-` : `${words}/-`;
    };
    const tableX = 46;
    const tableY = doc.y + 4;
    const colWidths = [30, 190, 136, pageRight - tableX - 30 - 190 - 136];
    const rowHeights = [24, 26, 26];
    const drawTableCell = (x, y, w, h, text, options = {}) => {
      doc.rect(x, y, w, h).lineWidth(0.8).strokeColor('#111827').stroke();
      doc
        .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(options.fontSize || 10)
        .fillColor(options.color || '#111827')
        .text(text, x + 4, y + 7, {
          width: w - 8,
          align: options.align || 'center',
          lineGap: 0
        });
    };
    const headerY = tableY;
    const itemY = tableY + rowHeights[0];
    const totalY = itemY + rowHeights[1];
    let cursorX = tableX;
    ['Sn', 'Service Name', 'Amount without GST', 'Amount with GST'].forEach((heading, index) => {
      drawTableCell(cursorX, headerY, colWidths[index], rowHeights[0], heading, {
        bold: true,
        fontSize: 10,
        color: '#ffffff'
      });
      doc.rect(cursorX, headerY, colWidths[index], rowHeights[0]).fillOpacity(1).fillAndStroke('#808080', '#111827');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(heading, cursorX + 4, headerY + 7, { width: colWidths[index] - 8, align: 'center' });
      cursorX += colWidths[index];
    });
    cursorX = tableX;
    [1, serviceName, formatTableAmount(amountWithoutGst), formatTableAmount(amountWithGst)].forEach((value, index) => {
      drawTableCell(cursorX, itemY, colWidths[index], rowHeights[1], String(value), {
        bold: index === 1,
        fontSize: 10,
        align: index === 1 ? 'left' : 'center'
      });
      cursorX += colWidths[index];
    });
    const leftTotalWidth = colWidths[0] + colWidths[1];
    const rightTotalWidth = colWidths[2] + colWidths[3];
    drawTableCell(tableX, totalY, leftTotalWidth, rowHeights[2], `Total Price with GST (In Words) = ${formatTableAmount(amountWithGst)}`, { bold: true, fontSize: 10, align: 'left' });
    drawTableCell(tableX + leftTotalWidth, totalY, rightTotalWidth, rowHeights[2], formatTableAmountWords(amountWithGst), { bold: true, fontSize: 10, align: 'center' });
    doc.y = totalY + rowHeights[2] + 10;
    doc.moveDown();
    const renewalTerms = String(settings?.renewalLetterTermsAndConditions || '').trim();
    if (renewalTerms) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Terms & Conditions');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#111827').text(renewalTerms, { align: 'left' });
    }
    doc.moveDown(2);
    doc.text('Authorized Signature');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#64748b').text('This is a system-generated renewal letter.');
    doc.end();
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    syncUploadToMirror(relativePath);
    const pdfUrl = `/uploads/${relativePath}`;
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query('UPDATE renewals SET renewal_letter_url = ? WHERE renewal_id = ?', [pdfUrl, renewal.renewalId]);
      await conn.query(
        'INSERT INTO renewal_letters (external_id, renewal_id, pdf_url, customer_name, generated_by, payload) VALUES (?, ?, ?, ?, ?, ?)',
        [`RLT-${Date.now()}`, renewal.renewalId, pdfUrl, renewal.customerName, readUserMeta(req), JSON.stringify({ renewal, request: req.body || {} })]
      );
    });
    return res.json({ success: true, message: 'Renewal letter generated', pdfUrl, renewal: await findRenewalRow(renewal.renewalId) });
  } catch (error) {
    console.error('Renewal letter failed:', error.message);
    return res.status(500).json({ error: 'Unable to generate renewal letter right now.' });
  }
});

app.post('/api/renewals/:id/mark-done', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to mark renewal done.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  const finalAmount = toNumber(req.body.finalAmount || req.body.finalRenewalAmount, renewal.proposedAmount);
  if (finalAmount < 0) return res.status(400).json({ error: 'Final amount must be numeric.' });
  try {
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query(
        `UPDATE renewals
         SET status = 'Done', final_renewal_amount = ?, renewed_by_sales_person_id = ?, renewed_by_sales_person_name = ?, renewed_at = ?, last_followup_note = ?
         WHERE renewal_id = ?`,
        [
          finalAmount,
          String(req.body.renewedBySalesPersonId || renewal.assignedSalesPersonId || '').trim(),
          String(req.body.renewedBySalesPersonName || renewal.assignedSalesPersonName || '').trim(),
          renewalSqlDateTime(req.body.renewedAt || new Date()),
          String(req.body.notes || renewal.lastFollowupNote || '').trim(),
          renewal.renewalId
        ]
      );
    });
    return res.json({ success: true, message: 'Renewal marked done', renewal: await findRenewalRow(renewal.renewalId) });
  } catch (error) {
    console.error('Renewal mark done failed:', error.message);
    return res.status(500).json({ error: 'Unable to mark renewal done right now.' });
  }
});

app.post('/api/renewals/:id/decline', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to decline renewal.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  const reason = String(req.body.reason || req.body.declineReason || '').trim();
  if (!reason) return res.status(400).json({ error: 'Decline reason is required.' });
  try {
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query('UPDATE renewals SET status = ?, decline_reason = ?, last_followup_note = ? WHERE renewal_id = ?', ['Declined', reason, reason, renewal.renewalId]);
    });
    return res.json({ success: true, message: 'Renewal declined', renewal: await findRenewalRow(renewal.renewalId) });
  } catch (error) {
    console.error('Renewal decline failed:', error.message);
    return res.status(500).json({ error: 'Unable to decline renewal right now.' });
  }
});

app.post('/api/renewals/:id/convert-contract', async (req, res) => {
  if (!canUseMysql()) return res.status(503).json({ error: 'MySQL is required to convert renewal to contract.' });
  const renewal = await findRenewalRow(req.params.id);
  if (!renewal) return res.status(404).json({ error: 'Renewal not found' });
  if (renewal.convertedContractId) return res.status(400).json({ error: 'Renewal is already converted to a contract.' });
  if (renewal.status !== 'Done') return res.status(400).json({ error: 'Mark renewal done before converting to contract.' });
  try {
    const invoices = await loadInvoicesForContext();
    const sourceInvoice = invoices.find((entry) => String(entry?._id || '') === String(renewal.contractId || '')) || {};
    const settings = await loadCurrentSettingsForNumbering();
    const startBase = parseDateOnly(req.body.contractStartDate || renewal.previousContractEnd || new Date()) || new Date();
    const nextStart = renewalSqlDate(req.body.contractStartDate || addMonthsClamped(startBase, 0));
    const nextEnd = renewalSqlDate(req.body.contractEndDate || addMonthsClamped(parseDateOnly(nextStart) || new Date(), 12));
    const amount = toNumber(req.body.amount || renewal.finalRenewalAmount || renewal.proposedAmount, 0);
    const sourceItems = Array.isArray(sourceInvoice.items) ? sourceInvoice.items : [];
    const items = sourceItems.length ? sourceItems.map((item) => ({
      ...item,
      contractStartDate: nextStart,
      contractEndDate: nextEnd,
      serviceStartDate: nextStart,
      serviceEndDate: nextEnd,
      renewalDate: nextEnd,
      rate: toNumber(item.rate, amount || item.rate),
      amount: toNumber(item.amount, amount || item.amount)
    })) : [{
      itemName: renewal.serviceType || 'Renewed Service Contract',
      description: `Renewal for ${renewal.customerName}`,
      quantity: 1,
      rate: amount,
      amount,
      taxRate: 0,
      contractStartDate: nextStart,
      contractEndDate: nextEnd,
      serviceStartDate: nextStart,
      serviceEndDate: nextEnd,
      renewalDate: nextEnd
    }];
    const newInvoice = {
      ...sourceInvoice,
      _id: `INV-${Date.now()}`,
      customerId: sourceInvoice.customerId || renewal.customerId || '',
      customerName: renewal.customerName,
      invoiceNumber: req.body.invoiceNumber || createNextInvoiceNumber(invoices, settings),
      date: renewalSqlDate(req.body.date || new Date()),
      dueDate: renewalSqlDate(req.body.dueDate || new Date()),
      salesperson: req.body.salesPersonName || renewal.renewedBySalesPersonName || renewal.assignedSalesPersonName || sourceInvoice.salesperson || '',
      servicePeriodStart: nextStart,
      servicePeriodEnd: nextEnd,
      items,
      subtotal: amount,
      total: amount,
      amount,
      balanceDue: amount,
      status: 'SENT',
      notes: String(req.body.notes || `Converted from renewal ${renewal.renewalId}`),
      createdAt: new Date().toISOString()
    };
    await syncInvoiceToMysql(newInvoice);
    await updateSettingsNextInvoiceNumber(newInvoice.invoiceNumber, settings);
    try {
      const shadowInvoices = readJsonFile(invoicesFile, []);
      shadowInvoices.push(newInvoice);
      fs.writeFileSync(invoicesFile, JSON.stringify(shadowInvoices, null, 2));
    } catch (error) {
      console.error('Renewal converted invoice JSON shadow failed:', error.message);
    }
    await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      await conn.query('UPDATE renewals SET converted_contract_id = ? WHERE renewal_id = ?', [newInvoice._id, renewal.renewalId]);
    });
    return res.json({ success: true, message: 'Converted to contract', renewal: await findRenewalRow(renewal.renewalId), contract: newInvoice });
  } catch (error) {
    console.error('Renewal convert failed:', error.message);
    return res.status(500).json({ error: 'Unable to convert renewal to contract right now.' });
  }
});

app.get('/api/renewals/letters', async (req, res) => {
  if (!canUseMysql()) return res.json([]);
  try {
    const letters = await withMysqlConnection(async (conn) => {
      await ensureRenewalTables(conn);
      const [rows] = await conn.query(`
        SELECT rl.*
        FROM renewal_letters rl
        INNER JOIN (
          SELECT renewal_id, MAX(id) AS latest_id
          FROM renewal_letters
          GROUP BY renewal_id
        ) latest ON latest.latest_id = rl.id
        ORDER BY rl.generated_at DESC, rl.id DESC
        LIMIT 200
      `);
      return rows || [];
    });
    return res.json(letters);
  } catch (error) {
    console.error('Renewal letters failed:', error.message);
    return res.status(500).json({ error: 'Unable to load renewal letters right now.' });
  }
});

app.get('/api/renewals/legacy-json', (req, res) => {
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
  const settings = await loadCurrentSettingsForNumbering();
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

app.post('/api/renewals/:id/assign-technician', async (req, res) => {
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

  const settings = await loadCurrentSettingsForNumbering();
  const jobs = readJsonFile(jobsFile, []);
  const createdJobs = [];
  let lastGeneratedJobNumber = '';
  selectedRows.forEach((row) => {
    technicians.forEach((tech) => {
      const generatedJobNumber = createNextJobNumber([...jobs, ...createdJobs], settings);
      lastGeneratedJobNumber = generatedJobNumber;
      const newJob = {
        _id: createJobId(),
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
    });
  });
  await updateSettingsNextJobNumber(lastGeneratedJobNumber, settings);

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
  serverOrigin: SERVER_ORIGIN,
  withMysqlConnection
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

const ensureTechnicianLocationTable = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS technician_live_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      technician_id VARCHAR(64) NULL,
      employee_code VARCHAR(64) NULL,
      technician_name VARCHAR(191) NULL,
      latitude DECIMAL(10,7) NOT NULL,
      longitude DECIMAL(10,7) NOT NULL,
      accuracy DECIMAL(10,2) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tech_loc_tid (technician_id),
      KEY idx_tech_loc_emp_code (employee_code),
      KEY idx_tech_loc_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

app.post('/api/technicians/location', async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const accuracy = Number(req.body?.accuracy || 0);
  const technicianId = String(req.body?.technicianId || '').trim();
  const employeeCode = String(req.body?.employeeCode || '').trim();
  const technicianName = String(req.body?.technicianName || '').trim();
  const recordedAt = req.body?.recordedAt ? new Date(req.body.recordedAt) : new Date();

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ success: false, error: 'latitude and longitude are required' });
  }

  if (!withMysqlConnection) {
    return res.status(500).json({ success: false, error: 'MySQL is not configured' });
  }

  try {
    await withMysqlConnection(async (conn) => {
      await ensureTechnicianLocationTable(conn);
      await conn.query(
        `
          INSERT INTO technician_live_locations
            (technician_id, employee_code, technician_name, latitude, longitude, accuracy, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          technicianId || null,
          employeeCode || null,
          technicianName || null,
          latitude,
          longitude,
          Number.isFinite(accuracy) ? accuracy : null,
          Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
        ]
      );
    });
    return res.json({ success: true, message: 'Location saved' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to save location' });
  }
});

app.get('/api/technicians/live', async (req, res) => {
  if (!withMysqlConnection) return res.json({ success: true, items: [] });

  try {
    const items = await withMysqlConnection(async (conn) => {
      await ensureTechnicianLocationTable(conn);
      const [rows] = await conn.query(
        `
          SELECT t1.id, t1.technician_id, t1.employee_code, t1.technician_name, t1.latitude, t1.longitude, t1.created_at AS last_seen
          FROM technician_live_locations t1
          INNER JOIN (
            SELECT COALESCE(NULLIF(technician_id, ''), employee_code) AS tech_key, MAX(id) AS max_id
            FROM technician_live_locations
            GROUP BY COALESCE(NULLIF(technician_id, ''), employee_code)
          ) t2 ON t1.id = t2.max_id
          ORDER BY t1.id DESC
          LIMIT 200
        `
      );
      return rows.map((row) => ({
        id: row.technician_id || row.employee_code || row.id,
        technician_id: row.technician_id,
        emp_code: row.employee_code,
        full_name: row.technician_name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        last_seen: row.last_seen,
        status: 'Active',
      }));
    });
    return res.json({ success: true, items });
  } catch {
    return res.json({ success: true, items: [] });
  }
});

app.get('/api/technicians/:id/route-history', async (req, res) => {
  if (!withMysqlConnection) return res.json({ success: true, items: [] });
  const id = String(req.params?.id || '').trim();
  if (!id) return res.json({ success: true, items: [] });

  try {
    const items = await withMysqlConnection(async (conn) => {
      await ensureTechnicianLocationTable(conn);
      const [rows] = await conn.query(
        `
          SELECT id, latitude, longitude, created_at AS timestamp
          FROM technician_live_locations
          WHERE technician_id = ? OR employee_code = ?
          ORDER BY id DESC
          LIMIT 500
        `,
        [id, id]
      );
      return rows.map((row) => ({
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        timestamp: row.timestamp,
      }));
    });
    return res.json({ success: true, items });
  } catch {
    return res.json({ success: true, items: [] });
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  res.json({ imageUrl: `${resolveServerOrigin(req)}/uploads/${req.file.filename}` });
});

if (activeFrontendBuildDir && activeFrontendIndexFile) {
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(activeFrontendIndexFile);
  });
}

let serverInstance = null;

const listenOnce = () => {
  if (global.__SKUAS_SERVER_LISTENING__ || serverInstance) {
    console.warn('SERVER LISTEN SKIPPED: already listening in this process');
    return serverInstance;
  }

  global.__SKUAS_SERVER_LISTENING__ = true;
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server Live on Port ${PORT}`);
    console.log(`Health endpoint ready at /health`);
  });

  serverInstance.on('error', (error) => {
    global.__SKUAS_SERVER_LISTENING__ = false;
    console.error('SERVER LISTEN ERROR:', error && error.stack ? error.stack : error);
  });

  return serverInstance;
};

const startServer = async () => {
  if (global.__SKUAS_STARTUP_RUNNING__) {
    console.warn('SERVER STARTUP SKIPPED: startup already running in this process');
    return;
  }

  global.__SKUAS_STARTUP_RUNNING__ = true;
  if (canUseMysql()) {
    try {
      await runAutoMigrations(pool);
    } catch (error) {
      console.error('AUTO MIGRATION STARTUP ERROR:', error && error.stack ? error.stack : error);
    }
  } else {
    console.warn('AUTO MIGRATION SKIPPED: MySQL is not configured.');
  }

  listenOnce();
};

startServer().catch((error) => {
  console.error('SERVER STARTUP ERROR:', error && error.stack ? error.stack : error);
  listenOnce();
});
