const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const role = (user) => String(user?.role || '').trim().toLowerCase();
const isAdmin = (user) => role(user) === 'admin';
const isHr = (user) => isAdmin(user) || ['hr', 'hr manager', 'human resources'].includes(role(user));
const isTechnician = (user) => role(user) === 'technician';
const identities = (user) => [user?.id, user?.employeeId, user?.employeeCode].filter(Boolean).map(String);
const ownsJob = (user, job) => [...(Array.isArray(job?.technicianIds) ? job.technicianIds : []), job?.technicianId].some(id => identities(user).includes(String(id)));
const secretKeys = /^(password|currentPassword|newPassword|portalPassword|portal_password|adminPassword|smtpPass|smtpPassword|smtp_pass|smtp_password|emailSmtpPassword|accessToken|access_token|whatsappAccessToken|encrypted_refresh_token|refresh_token|settingsAccessPin)$/i;
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKeys.test(key)).map(([key, entry]) => [key, redact(entry)]));
}
function validObject(value, depth = 0) {
  if (depth > 30) return false;
  if (!value || typeof value !== 'object') return typeof value !== 'number' || Number.isFinite(value);
  return Object.entries(value).every(([key, entry]) => !['__proto__', 'constructor', 'prototype'].includes(key) && validObject(entry, depth + 1));
}
function inputGuard(req, res, next) {
  if (!validObject(req.body) || !validObject(req.query)) return res.status(400).json({ error: 'Invalid request data' });
  for (const key of ['limit', 'pageSize', 'perPage']) {
    if (req.query[key] !== undefined && (!/^\d+$/.test(String(req.query[key])) || Number(req.query[key]) < 1 || Number(req.query[key]) > 500)) return res.status(400).json({ error: 'Page size must be between 1 and 500' });
  }
  if (/^\/api\/(payment-received|payments)(\/|$)/.test(req.path) && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const value = req.body?.amount;
    if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 1e12) return res.status(400).json({ error: 'Payment amount must be positive with at most two decimal places' });
  }
  if (/^\/api\/(invoices|contracts|quotations|payroll|hr|employees)(\/|$)/.test(req.path) && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const moneyError = validateFinancialPayload(req.body);
    if (moneyError) return res.status(400).json({ error: moneyError });
  }
  if (req.path === '/api/public/website-lead') {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length > 40 || Object.values(req.body).some(v => typeof v === 'object' || String(v).length > 4000)) return res.status(400).json({ error: 'Invalid lead fields' });
  }
  next();
}
const financialKey = /(amount|total|subtotal|gst|tax|discount|balance|salary|advance|deduction|allowance|rate|quantity|price|cost|roundOff|round_off|paid|received)/i;
const nonFinancialKey = /(reason|note|status|date|number|mode|type|name|id|url|file|path|description|remarks)$/i;
const signedFinancialKey = /^(roundOff|round_off|adjustment|adjustmentAmount)$/i;
function validateMoneyValue(value, { allowNegative = false, allowZero = true } = {}) {
  if (value === '' || value === null || value === undefined) return '';
  if (!['number', 'string'].includes(typeof value)) return 'Financial values must be numeric';
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return 'Financial values must be valid decimal amounts with at most two fraction digits';
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 1e12) return 'Financial values are outside the allowed range';
  if (!allowNegative && numeric < 0) return 'Financial values cannot be negative';
  if (!allowZero && numeric <= 0) return 'Financial values must be positive';
  return '';
}
function validateFinancialPayload(value, depth = 0) {
  if (depth > 20) return 'Financial payload is too deeply nested';
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const entry of value) {
      const error = validateFinancialPayload(entry, depth + 1);
      if (error) return error;
    }
    return '';
  }
  for (const [key, entry] of Object.entries(value)) {
    if (entry && typeof entry === 'object') {
      const error = validateFinancialPayload(entry, depth + 1);
      if (error) return error;
      continue;
    }
    if (!financialKey.test(key) || nonFinancialKey.test(key)) continue;
    const error = validateMoneyValue(entry, { allowNegative: signedFinancialKey.test(key) });
    if (error) return error;
  }
  return '';
}
function csrfGuard(origins, cookieName) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieAuth = String(req.headers.cookie || '').split(';').some(part => part.trim().startsWith(`${cookieName}=`));
    const login = req.path === '/api/auth/login';
    if (!cookieAuth && !login) return next();
    // Cookie authentication takes precedence over Bearer authentication.
    let origin = req.headers.origin;
    if (!origin && req.headers.referer) { try { origin = new URL(req.headers.referer).origin; } catch {} }
    if (!origin || !origins.has(origin)) return res.status(403).json({ error: 'Request origin is not allowed' });
    next();
  };
}
function responseGuard(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500) return json({ error: 'Internal server error' });
    if (req.portalUser || req.path.startsWith('/api/auth') || req.path.includes('/settings')) res.setHeader('Cache-Control', 'no-store');
    if (req.path === '/api/employees' && Array.isArray(body) && !isHr(req.portalUser)) {
      const fields = ['_id', 'id', 'empCode', 'firstName', 'lastName', 'role', 'roleName', 'profile_photo', 'employeePhotoUrl'];
      body = body.filter(employee => !isTechnician(req.portalUser) || [employee._id, employee.id, employee.empCode].some(id => identities(req.portalUser).includes(String(id)))).map(employee => Object.fromEntries(fields.map(key => [key, employee[key]])));
    }
    if (req.securityJobs && Array.isArray(body)) {
      const keys = req.path === '/api/customers' ? ['customerId', 'customer_external_id'] : ['invoiceId', 'contractId', 'invoice_external_id'];
      const allowed = new Set(req.securityJobs.flatMap(job => keys.map(key => String(job[key] || '')).filter(Boolean)));
      body = body.filter(record => [record._id, record.id, record.external_id, ...(req.path === '/api/service-schedules' ? [record.invoiceId, record.contractId] : [])].filter(Boolean).some(id => allowed.has(String(id))));
    }
    return json(redact(body));
  };
  next();
}
function privateUploadGuard(req, res, next) {
  let name;
  try { name = decodeURIComponent(req.path).replace(/\\/g, '/').toLowerCase(); } catch { return res.sendStatus(400); }
  if (name.split('/').some(part => part === '..' || part.startsWith('.'))) return res.sendStatus(404);
  if (/^\/employees\/(aadhaar|pan|documents)(\/|$)/.test(name) || /^\/(imports|customer-imports|salary-slips|payroll)(\/|$)/.test(name)) {
    if (!req.portalUser) return res.sendStatus(401);
    if (!isHr(req.portalUser)) return res.sendStatus(403);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'attachment');
  }
  next();
}
function safeLocalFile(root, input) {
  try {
    const target = fs.realpathSync(path.resolve(root, input));
    const base = fs.realpathSync(root);
    return target.startsWith(base + path.sep) && fs.statSync(target).isFile() ? target : '';
  } catch { return ''; }
}
function imageType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return '';
}
function validateUploadedFiles(req, res, next) {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
  try {
    for (const file of files) {
      const fd = fs.openSync(file.path, 'r');
      const header = Buffer.alloc(16);
      try { fs.readSync(fd, header, 0, 16, 0); } finally { fs.closeSync(fd); }
      const ext = path.extname(file.filename).toLowerCase();
      const type = imageType(header);
      const valid = ({ '.png': type === 'png', '.jpg': type === 'jpeg', '.jpeg': type === 'jpeg', '.webp': type === 'webp', '.pdf': header.toString('ascii', 0, 5) === '%PDF-', '.xlsx': header[0] === 80 && header[1] === 75, '.xls': header.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')), '.heic': header.toString('ascii', 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(header.toString('ascii', 8, 12)), '.heif': header.toString('ascii', 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(header.toString('ascii', 8, 12)), '.csv': !header.includes(0) })[ext];
      if (!valid) throw new Error('File content does not match its extension');
    }
    if (!validObject(req.body)) throw new Error('Invalid request data');
    next();
  } catch {
    files.forEach(file => { try { fs.unlinkSync(file.path); } catch {} });
    res.status(400).json({ error: 'Invalid uploaded file content' });
  }
}
const redactForLog = (value) => redact(value);
module.exports = { role, isAdmin, isHr, isTechnician, identities, ownsJob, redact, redactForLog, validObject, inputGuard, csrfGuard, responseGuard, privateUploadGuard, safeLocalFile, imageType, validateUploadedFiles, validateMoneyValue, validateFinancialPayload };
