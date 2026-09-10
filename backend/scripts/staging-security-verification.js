#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const env = process.env;
const baseUrl = String(env.STAGING_BASE_URL || '').replace(/\/+$/, '');
const outFile = String(env.STAGING_SECURITY_REPORT || path.join(__dirname, '..', '..', 'docs', 'security', 'staging-verification-results.json'));
const trustedOrigin = String(env.STAGING_TRUSTED_ORIGIN || baseUrl || '').replace(/\/+$/, '');
const untrustedOrigin = String(env.STAGING_UNTRUSTED_ORIGIN || 'https://attacker.invalid');

const roles = ['ADMIN', 'SALES', 'SALES_PERSON', 'OPERATIONS', 'HR', 'TECHNICIAN'];
const roleNames = {
  ADMIN: 'Admin',
  SALES: 'Sales',
  SALES_PERSON: 'Sales Person',
  OPERATIONS: 'Operations',
  HR: 'HR',
  TECHNICIAN: 'Technician'
};

const now = () => new Date().toISOString();
const passCodes = new Set([200, 201, 204, 304]);
const deniedCodes = new Set([401, 403, 404, 405]);
const results = [];
const tokens = {};
const cookies = {};

if (!baseUrl) {
  console.error('Set STAGING_BASE_URL to a non-production CRM/API origin before running staging verification.');
  process.exit(2);
}

const redact = (value) => String(value || '').replace(/Bearer\s+[A-Za-z0-9._~-]+/g, 'Bearer [redacted]').replace(/skuas_portal_session=[^;\s]+/g, 'skuas_portal_session=[redacted]');

const add = (area, name, status, detail = {}) => {
  results.push({ area, name, status, detail, checkedAt: now() });
};

const request = async (pathname, options = {}) => {
  const url = `${baseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const headers = { ...(options.headers || {}) };
  if (options.origin !== false) headers.Origin = options.origin || trustedOrigin;
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(url, {
    method: options.method || 'GET',
    headers,
    redirect: 'manual',
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
};

const readBody = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text.slice(0, 200); }
};

const login = async (role) => {
  const username = env[`STAGING_${role}_USERNAME`];
  const password = env[`STAGING_${role}_PASSWORD`];
  if (!username || !password) {
    add('auth', `${roleNames[role]} login`, 'SKIPPED', { reason: 'missing credentials env' });
    return;
  }
  const response = await request('/api/auth/login', { method: 'POST', body: { username, password } });
  const body = await readBody(response);
  const setCookie = response.headers.get('set-cookie') || '';
  if (!passCodes.has(response.status) || !body?.user) {
    add('auth', `${roleNames[role]} login`, 'FAIL', { status: response.status });
    return;
  }
  tokens[role] = setCookie ? '' : '';
  cookies[role] = setCookie.split(';')[0];
  add('auth', `${roleNames[role]} login`, 'PASS', { status: response.status, role: body.user.role || roleNames[role] });
};

const checkDenied = async (area, name, pathname, role, options = {}) => {
  if (!cookies[role] && role !== 'ANON') {
    add(area, name, 'SKIPPED', { reason: `missing ${roleNames[role] || role} login` });
    return;
  }
  const response = await request(pathname, { method: options.method || 'GET', cookie: role === 'ANON' ? '' : cookies[role], body: options.body });
  add(area, name, deniedCodes.has(response.status) ? 'PASS' : 'FAIL', { status: response.status, expected: 'denied' });
};

const checkAllowed = async (area, name, pathname, role, options = {}) => {
  if (!cookies[role]) {
    add(area, name, 'SKIPPED', { reason: `missing ${roleNames[role] || role} login` });
    return;
  }
  const response = await request(pathname, { method: options.method || 'GET', cookie: cookies[role], body: options.body });
  add(area, name, passCodes.has(response.status) ? 'PASS' : 'FAIL', { status: response.status, expected: 'allowed' });
};

const headerChecks = async () => {
  const response = await request('/api/health');
  const headers = {
    csp: response.headers.get('content-security-policy') || '',
    hsts: response.headers.get('strict-transport-security') || '',
    nosniff: response.headers.get('x-content-type-options') || '',
    referrer: response.headers.get('referrer-policy') || '',
    permissions: response.headers.get('permissions-policy') || '',
    frame: response.headers.get('x-frame-options') || ''
  };
  add('headers', 'security headers present', Object.values(headers).every(Boolean) ? 'PASS' : 'FAIL', headers);
  add('headers', 'geolocation allowed for self', /geolocation=\((self|"self")\)/i.test(headers.permissions) ? 'PASS' : 'FAIL', { permissionsPolicy: headers.permissions });
};

const corsCsrfChecks = async () => {
  const allowed = await request('/api/public/settings', { origin: trustedOrigin });
  add('cors', 'trusted origin accepted', allowed.status < 500 ? 'PASS' : 'FAIL', { status: allowed.status });
  const denied = await request('/api/public/settings', { origin: untrustedOrigin });
  add('cors', 'untrusted origin denied', denied.status === 403 || denied.status === 500 ? 'PASS' : 'FAIL', { status: denied.status });
  if (cookies.ADMIN) {
    const missing = await request('/api/settings', { method: 'POST', cookie: cookies.ADMIN, origin: false, body: {} });
    add('csrf', 'missing origin denied for cookie write', deniedCodes.has(missing.status) ? 'PASS' : 'FAIL', { status: missing.status });
    const bad = await request('/api/settings', { method: 'POST', cookie: cookies.ADMIN, origin: untrustedOrigin, body: {} });
    add('csrf', 'untrusted origin denied for cookie write', deniedCodes.has(bad.status) ? 'PASS' : 'FAIL', { status: bad.status });
  } else {
    add('csrf', 'cookie mutation checks', 'SKIPPED', { reason: 'missing admin login' });
  }
};

const privateUploadChecks = async () => {
  const raw = String(env.STAGING_PRIVATE_UPLOAD_PATHS || '').split(',').map((entry) => entry.trim()).filter(Boolean);
  const paths = raw.length ? raw : [
    '/uploads/employees/aadhaar/sample.pdf',
    '/uploads/employees/pan/sample.pdf',
    '/uploads/employees/documents/sample.pdf',
    '/uploads/payroll/salary-slips/sample.pdf',
    '/uploads/imports/sample.csv',
    '/uploads/customer-imports/sample.csv'
  ];
  for (const [index, pathname] of paths.entries()) {
    const anon = await request(pathname, { method: 'HEAD', origin: false });
    add('private_uploads', `anonymous private file ${index + 1}`, deniedCodes.has(anon.status) ? 'PASS' : 'FAIL', { status: anon.status });
    if (cookies.TECHNICIAN) {
      const tech = await request(pathname, { method: 'HEAD', cookie: cookies.TECHNICIAN });
      add('private_uploads', `technician private file ${index + 1}`, deniedCodes.has(tech.status) ? 'PASS' : 'FAIL', { status: tech.status });
    }
    if (cookies.HR) {
      const hr = await request(pathname, { method: 'HEAD', cookie: cookies.HR });
      add('private_uploads', `HR private file ${index + 1}`, passCodes.has(hr.status) || hr.status === 404 ? 'PASS' : 'FAIL', { status: hr.status });
    }
  }
};

const roleChecks = async () => {
  await checkDenied('role', 'technician cannot change settings', '/api/settings', 'TECHNICIAN', { method: 'POST', body: {} });
  await checkDenied('role', 'sales cannot read payroll', '/api/payroll/items', 'SALES');
  await checkDenied('role', 'operations cannot modify admin settings', '/api/settings', 'OPERATIONS', { method: 'POST', body: {} });
  await checkDenied('role', 'technician cannot run marketing action', '/api/whatsapp-marketing/campaigns/test/action', 'TECHNICIAN', { method: 'POST', body: { action: 'resume' } });
  await checkAllowed('role', 'admin can read settings', '/api/settings', 'ADMIN');
  await checkAllowed('role', 'HR can read payroll items', '/api/payroll/items', 'HR');
};

const idorChecks = async () => {
  const checks = [
    ['TECHNICIAN_OTHER_JOB_ID', 'technician other job denied', (id) => `/api/jobs/${encodeURIComponent(id)}`],
    ['SALES_OTHER_CUSTOMER_ID', 'sales other customer write denied or reviewed', (id) => `/api/customers/${encodeURIComponent(id)}`],
    ['SALES_OTHER_INVOICE_ID', 'sales other invoice write denied or reviewed', (id) => `/api/invoices/${encodeURIComponent(id)}`],
    ['TECHNICIAN_OTHER_ATTENDANCE_ID', 'technician other attendance audit denied', (id) => `/api/attendance/${encodeURIComponent(id)}/audit`],
    ['SALES_EMPLOYEE_ID', 'sales employee write denied', (id) => `/api/employees/${encodeURIComponent(id)}`],
    ['SALES_PAYROLL_ID', 'sales payroll item denied', (id) => `/api/payroll/items/${encodeURIComponent(id)}`]
  ];
  for (const [envKey, name, makePath] of checks) {
    const id = env[envKey];
    if (!id) {
      add('idor', name, 'SKIPPED', { reason: `missing ${envKey}` });
      continue;
    }
    const role = envKey.startsWith('TECHNICIAN') ? 'TECHNICIAN' : 'SALES';
    await checkDenied('idor', name, makePath(id), role, { method: name.includes('write') ? 'PUT' : 'GET', body: name.includes('write') ? { status: 'test' } : undefined });
  }
};

const invalidLoginCheck = async () => {
  const response = await request('/api/auth/login', { method: 'POST', body: { username: 'invalid-staging-user', password: 'invalid-password' } });
  add('auth', 'invalid login rejected', response.status === 401 || response.status === 400 ? 'PASS' : 'FAIL', { status: response.status });
};

const logoutCheck = async () => {
  if (!cookies.ADMIN) {
    add('auth', 'logout revokes admin session', 'SKIPPED', { reason: 'missing admin login' });
    return;
  }
  const before = await request('/api/auth/me', { cookie: cookies.ADMIN });
  const logout = await request('/api/auth/logout', { method: 'POST', cookie: cookies.ADMIN, body: {} });
  const after = await request('/api/auth/me', { cookie: cookies.ADMIN });
  add('auth', 'logout revokes admin session', passCodes.has(before.status) && passCodes.has(logout.status) && deniedCodes.has(after.status) ? 'PASS' : 'FAIL', { before: before.status, logout: logout.status, after: after.status });
};

const run = async () => {
  add('deployment', 'staging URL configured', /prod|crm\.skuaspestcontrol\.com$/i.test(baseUrl) ? 'FAIL' : 'PASS', { baseUrl });
  await headerChecks();
  await invalidLoginCheck();
  for (const role of roles) await login(role);
  await corsCsrfChecks();
  await roleChecks();
  await idorChecks();
  await privateUploadChecks();
  await logoutCheck();

  const summary = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const report = { generatedAt: now(), baseUrl, trustedOrigin, summary, results: JSON.parse(redact(JSON.stringify(results))) };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ generatedAt: report.generatedAt, baseUrl, summary, outFile }, null, 2));
  if (summary.FAIL) process.exitCode = 1;
};

run().catch((error) => {
  console.error('Staging verification failed:', error.message);
  process.exit(1);
});
