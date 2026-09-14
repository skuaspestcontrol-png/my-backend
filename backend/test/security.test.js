const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const express = require('express');
const security = require('../lib/security');
const auth = require('../lib/portalAuth');
const passwords = require('../lib/passwords');
const { createSessionRevocationStore } = require('../lib/sessionRevocation');
const { publicIp, safeFetch } = require('../lib/safeFetch');
const secret = 'test-only-secret-with-more-than-thirty-two-characters';
const admin = { id: 'admin', role: 'Admin' };
const technician = { id: 't1', employeeId: 't1', role: 'Technician' };
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const payroll = require('../payrollModule');

test('CRM attendance keeps Technician App punch times authoritative', () => {
  const attendanceSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/Attendance.jsx'), 'utf8');
  assert.match(attendanceSource, /normalizedSource === 'technician_app'/);
  assert.match(attendanceSource, /entry\.checkIn,[\s\S]*entry\.check_in,[\s\S]*entry\.punchIn,[\s\S]*entry\.punch_in_time/);
  assert.match(attendanceSource, /entry\.checkOut,[\s\S]*entry\.check_out,[\s\S]*entry\.punchOut,[\s\S]*entry\.punch_out_time/);
  assert.match(attendanceSource, /realCheckIn \|\| \(isSelfServiceSource \? '' : '09:30'\)/);
  assert.match(attendanceSource, /realCheckOut \|\| \(isSelfServiceSource \? '' : '17:30'\)/);
});

test('invoice MySQL insert columns, placeholders and values stay aligned', () => {
  const match = source.match(/`INSERT INTO invoices \(\n([\s\S]*?)\n\s*\) VALUES \(([\s\S]*?)\)\n\s*ON DUPLICATE KEY UPDATE[\s\S]*?`,\n\s*\[([\s\S]*?)\n\s*\]\n\s*\);/);
  assert.ok(match, 'invoice INSERT statement should be found');

  const columns = match[1].split(',').map((column) => column.trim()).filter(Boolean);
  const placeholderCount = (match[2].match(/\?/g) || []).length;
  const values = match[3].split('\n').map((value) => value.trim()).filter(Boolean).map((value) => value.replace(/,$/, ''));

  const expectedColumns = [
    'external_id',
    'customer_external_id',
    'customer_name',
    'invoice_number',
    'invoice_type',
    'invoice_status',
    'invoice_date',
    'due_date',
    'total_amount',
    'balance_due',
    'customer_type',
    'lead_source',
    'service_relationship_type',
    'renewal_eligible',
    'contract_duration_value',
    'contract_duration_unit',
    'billing_address_source',
    'shipping_address_source',
    'billing_address_text',
    'shipping_address_text',
    'custom_shipping_addresses',
    'customer_premise_id',
    'premise_label',
    'premise_address',
    'premise_area_name',
    'premise_city',
    'premise_state',
    'premise_pincode',
    'premise_google_map_url',
    'service_schedule_default_time',
    'service_schedules',
    'discount',
    'round_off',
    'payload',
    'source_created_at',
    'source_updated_at'
  ];
  const expectedValues = [
    'invoice._id',
    'invoice.customerId || null',
    'invoice.customerName || null',
    'invoice.invoiceNumber || null',
    'invoice.invoiceType || null',
    'invoice.status || null',
    'invoice.date || null',
    'invoice.dueDate || null',
    'toNumber(invoice.total ?? invoice.amount, 0)',
    'toNumber(invoice.balanceDue, 0)',
    "invoice.customerType || 'New'",
    'invoice.leadSource || null',
    'renewalClass.relationshipType',
    'renewalClass.renewalEligible ? 1 : 0',
    'renewalClass.durationValue || null',
    'renewalClass.durationUnit || null',
    'invoice.billingAddressSource || null',
    'invoice.shippingAddressSource || null',
    'invoice.billingAddressText || null',
    'invoice.shippingAddressText || null',
    'JSON.stringify(Array.isArray(invoice.customShippingAddresses) ? invoice.customShippingAddresses : [])',
    'invoice.customerPremiseId || invoice.customer_premise_id || null',
    'invoice.premiseLabel || invoice.premise_label || null',
    'invoice.premiseAddress || invoice.premise_address || invoice.billingAddressText || null',
    'invoice.premiseAreaName || invoice.premise_area_name || null',
    'invoice.premiseCity || invoice.premise_city || null',
    'invoice.premiseState || invoice.premise_state || null',
    'invoice.premisePincode || invoice.premise_pincode || null',
    'invoice.premiseGoogleMapUrl || invoice.premise_google_map_url || null',
    "String(invoice.serviceScheduleDefaultTime || '10:00').trim() || '10:00'",
    'JSON.stringify(Array.isArray(invoice.serviceSchedules) ? invoice.serviceSchedules : [])',
    'toNumber(invoice.discount, 0)',
    'toNumber(invoice.roundOff, 0)',
    'JSON.stringify(invoice)',
    "invoice.createdAt ? new Date(invoice.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null",
    "new Date().toISOString().slice(0, 19).replace('T', ' ')"
  ];

  assert.equal(columns.length, 36);
  assert.equal(placeholderCount, 36);
  assert.equal(values.length, 36);
  assert.deepEqual(columns, expectedColumns);
  assert.deepEqual(values, expectedValues);
});

test('payroll late deduction is based on morning punch-in only', () => {
  const { summarizeAttendanceForPayroll, calcPayrollItem } = payroll.__test__;
  const base = {
    employeeId: 'emp1',
    month: 9,
    year: 2026,
    holidays: [],
    weeklyOffDay: 0,
    lateMarkGraceMinutes: 15,
    workStartTime: '09:30',
    workEndTime: '17:30',
    standardDailyHours: 8,
  };

  const hoursBetween = (checkIn, checkOut) => {
    const [inHours, inMinutes] = checkIn.split(':').map(Number);
    const [outHours, outMinutes] = checkOut.split(':').map(Number);
    return Number((((outHours * 60 + outMinutes) - (inHours * 60 + inMinutes)) / 60).toFixed(2));
  };

  const summarizeOne = (checkIn, checkOut) => summarizeAttendanceForPayroll({
    ...base,
    attendance: [{
      employeeId: 'emp1',
      date: '2026-09-14',
      status: 'present',
      checkIn,
      checkOut,
      workingHours: hoursBetween(checkIn, checkOut),
    }],
  });

  const onTimeFullShift = summarizeOne('09:30', '17:30');
  assert.equal(onTimeFullShift.shortHoursDeductionHours, 0);
  assert.equal(onTimeFullShift.lateMarks, 0);
  assert.equal(onTimeFullShift.dailyBreakdown[0].workingHours, 8);

  const withinGraceFullShift = summarizeOne('09:40', '17:30');
  assert.equal(withinGraceFullShift.shortHoursDeductionHours, 0);
  assert.equal(withinGraceFullShift.lateMarks, 0);

  const graceBoundaryFullShift = summarizeOne('09:45', '17:30');
  assert.equal(graceBoundaryFullShift.shortHoursDeductionHours, 0);
  assert.equal(graceBoundaryFullShift.lateMarks, 0);

  const onTimeEarlyOut = summarizeOne('09:30', '15:00');
  assert.equal(onTimeEarlyOut.shortHoursDeductionHours, 0);
  assert.equal(onTimeEarlyOut.lateMarks, 0);
  assert.equal(onTimeEarlyOut.dailyBreakdown[0].workingHours, 5.5);
  assert.equal(onTimeEarlyOut.dailyBreakdown[0].shortHours, 0);

  const withinGraceEarlyOut = summarizeOne('09:40', '15:00');
  assert.equal(withinGraceEarlyOut.shortHoursDeductionHours, 0);
  assert.equal(withinGraceEarlyOut.lateMarks, 0);
  assert.equal(withinGraceEarlyOut.dailyBreakdown[0].workingHours, 5.33);

  const lateArrival = summarizeOne('10:00', '17:30');
  assert.equal(lateArrival.shortHoursDeductionHours, 0.5);
  assert.equal(lateArrival.lateMarks, 1);
  assert.equal(lateArrival.dailyBreakdown[0].lateMinutes, 30);
  assert.equal(lateArrival.dailyBreakdown[0].shortHours, 0.5);

  const lateArrivalEarlyOut = summarizeOne('10:00', '15:00');
  assert.equal(lateArrivalEarlyOut.shortHoursDeductionHours, 0.5);
  assert.equal(lateArrivalEarlyOut.lateMarks, 1);
  assert.equal(lateArrivalEarlyOut.dailyBreakdown[0].workingHours, 5);
  assert.equal(lateArrivalEarlyOut.dailyBreakdown[0].shortHours, 0.5);

  const payrollItem = calcPayrollItem({
    employee: { _id: 'emp1', empCode: 'EMP1', firstName: 'Test', lastName: 'Employee' },
    structure: {
      employeeId: 'emp1',
      salaryType: 'monthly',
      basicSalary: 30000,
      allowances: {},
      deductions: { late: 0, latePerMark: 0 },
    },
    attendanceSummary: onTimeEarlyOut,
    advances: [],
    month: 9,
    year: 2026,
    manualOverride: {},
  });
  assert.equal(payrollItem.deductions.shortHoursDeduction, 0);
});

// Execute the actual application middleware, excluding dotenv, DB imports, migrations,
// persistent-directory initialization, provider schedulers and application startup.
const start = source.indexOf('const app = express();');
const end = source.indexOf('app.get("/api/db-test"');
function fixture() {
  const context = {
    URL, express, security, readDocumentShare: () => null, ...auth, crypto: require('crypto'),
    helmet: require('helmet'), cors: require('cors'), rateLimit: require('express-rate-limit'),
    process: { env: { NODE_ENV: 'production', PORTAL_AUTH_SECRET: secret } },
    canUseMysql: () => false, jobsFile: 'fixture',
    readJsonFile: () => [{ _id: 'j1', technicianId: 't1', customerId: 'c1' }, { _id: 'JOB-ABC', technicianId: 't1', customerId: 'c1' }, { _id: 'j2', technicianId: 't2', customerId: 'c2' }]
  };
  const app = vm.runInNewContext(source.slice(start, end) + '\napp;', context);
  const uploadFilters = vm.runInNewContext(source.slice(source.indexOf('const allowedImageExtensions ='), source.indexOf('const toDataUrlFromUpload =')) + '\n({ createFlexibleImageUploadFileFilter });', { path });
  const multer = require('multer');
  app.post('/api/test-upload', multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 }, fileFilter: uploadFilters.createFlexibleImageUploadFileFilter('Invalid image') }).single('file'), (_req, res) => res.json({ ok: true }));
  app.use('/uploads', security.privateUploadGuard, (_req, res) => res.json({ file: true }));
  app.use((req, res) => {
    if (req.path === '/api/employees') return res.json([{ _id: 't1', firstName: 'One', portalPassword: 'sensitive', salary: 500, bankAccount: 'private' }, { _id: 't2', firstName: 'Two' }]);
    if (req.path === '/api/customers') return res.json([{ _id: 'c1' }, { _id: 'c2' }]);
    if (req.path === '/api/failure') return res.status(500).json({ error: 'SQL secret /private/path', stack: 'sensitive' });
    return res.json({ ok: true, smtpPass: 'sensitive', nested: { whatsappAccessToken: 'sensitive' } });
  });
  app.use((error, _req, res, _next) => res.status(error.message === 'CORS origin denied' ? 403 : error.status || 500).json({ error: 'Rejected' }));
  return app;
}
let server, base;
test.before(async () => {
  server = fixture().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));
function request(url, { user, method = 'GET', body, origin = 'https://crm.skuaspestcontrol.com', cookie = false } = {}) {
  const headers = { Origin: origin };
  if (user) {
    const token = auth.createPortalSession({ user, secret });
    headers[cookie ? 'Cookie' : 'Authorization'] = cookie ? `${auth.DEFAULT_COOKIE_NAME}=${token}` : `Bearer ${token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + url, { method, headers, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}
test('unauthenticated admin, business and salary PDF APIs are denied', async () => {
  for (const url of ['/api/admin/run-migrations', '/api/customers', '/api/invoices/1/pdf', '/api/payroll/items/1/slip/pdf?role=Admin', '/api/jobs/1/pdf']) assert.equal((await request(url)).status, 401, url);
});
test('employee cannot change settings or employee roles', async () => {
  for (const url of ['/api/settings', '/api/settings/save', '/api/settings/whatsapp', '/api/employees/t2']) assert.equal((await request(url, { user: technician, method: 'POST', body: { role: 'Admin' } })).status, 403, url);
});
test('admin can save settings through trusted cookie origin', async () => assert.equal((await request('/api/settings', { user: admin, cookie: true, method: 'POST', body: {} })).status, 200));
test('untrusted same-site origin cannot perform cookie writes', async () => assert.equal((await request('/api/settings', { user: admin, cookie: true, method: 'POST', body: {}, origin: 'https://www.skuaspestcontrol.com' })).status, 403));
test('arbitrary CORS origins denied', async () => assert.equal((await request('/api/public/settings', { origin: 'https://evil.example' })).status, 403));
test('technician cannot act on another job or change assignments', async () => {
  assert.equal((await request('/api/jobs/j2', { user: technician, method: 'PUT', body: { status: 'Completed' } })).status, 403);
  assert.equal((await request('/api/jobs/j1', { user: technician, method: 'PUT', body: { technicianId: 't2' } })).status, 403);
  assert.equal((await request('/api/jobs/j1', { user: technician, method: 'PUT', body: { status: 'In Progress' } })).status, 200);
});
test('technician can reach own GPS submission endpoint', async () => assert.equal((await request('/api/technicians/location', { user: technician, method: 'POST', body: { latitude: 19, longitude: 73 } })).status, 200));
test('case-sensitive external job IDs remain usable', async () => assert.equal((await request('/api/jobs/JOB-ABC', { user: technician, method: 'PUT', body: { status: 'In Progress' } })).status, 200));
test('technician cannot submit attendance for another employee or read location history', async () => {
  assert.equal((await request('/api/attendance', { user: technician, method: 'POST', body: { employeeId: 't2' } })).status, 403);
  assert.equal((await request('/api/technicians/t2/route-history', { user: technician })).status, 403);
});
test('employee directory hides credentials and HR data, scopes technicians', async () => {
  const response = await request('/api/employees', { user: technician });
  const rows = await response.json();
  assert.equal(rows.length, 1); assert.equal(rows[0]._id, 't1');
  assert.equal(rows[0].salary, undefined); assert.equal(rows[0].portalPassword, undefined); assert.equal(rows[0].bankAccount, undefined);
});
test('technician customer responses are assigned-job scoped', async () => assert.deepEqual(await (await request('/api/customers', { user: technician })).json(), [{ _id: 'c1' }]));
test('private uploads need authorized HR session', async () => {
  for (const url of ['/uploads/employees/aadhaar/a.pdf', '/uploads/employees/pan/p.png', '/uploads/payroll/salary-slips/a.pdf']) {
    assert.equal((await request(url)).status, 401);
    assert.equal((await request(url, { user: technician })).status, 403);
    const response = await request(url, { user: admin });
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  }
});
test('prototype pollution and enormous pagination rejected', async () => {
  assert.equal((await request('/api/settings', { user: admin, method: 'POST', body: '{"__proto__":{"admin":true}}' })).status, 400);
  assert.equal((await request('/api/customers?limit=999999999', { user: admin })).status, 400);
});
test('public lead fields bounded and spam throttled', async () => {
  assert.equal((await request('/api/public/website-lead', { method: 'POST', body: { message: 'x'.repeat(4001) } })).status, 400);
  let status;
  for (let i = 0; i < 16; i++) status = (await request('/api/public/website-lead', { method: 'POST', body: { name: 'Test' } })).status;
  assert.equal(status, 429);
});
test('login limiter enforces bounded burst', async () => {
  // In this fixture successful handler responses are counted until finished; create
  // a separate real middleware fixture with a failing login route.
  const app = express();
  app.use(require('express-rate-limit')({ limit: 2, windowMs: 60000, skipSuccessfulRequests: true }));
  app.post('/login', (_req, res) => res.sendStatus(401));
  const loginServer = app.listen(0, '127.0.0.1');
  await new Promise(resolve => loginServer.once('listening', resolve));
  try { const url = `http://127.0.0.1:${loginServer.address().port}/login`; await fetch(url, { method: 'POST' }); await fetch(url, { method: 'POST' }); assert.equal((await fetch(url, { method: 'POST' })).status, 429); }
  finally { await new Promise(resolve => loginServer.close(resolve)); }
});
test('campaign execution requires an authorized role', async () => assert.equal((await request('/api/whatsapp-marketing/campaigns/1/action', { user: technician, method: 'POST', body: {} })).status, 403));
test('production errors and nested response credentials are redacted', async () => {
  assert.deepEqual(await (await request('/api/failure', { user: admin })).json(), { error: 'Internal server error' });
  assert.deepEqual(await (await request('/api/settings', { user: admin })).json(), { ok: true, nested: {} });
});
test('production response headers include CSP, HSTS and frame policy', async () => {
  const response = await request('/api/health');
  for (const name of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options']) assert.ok(response.headers.get(name), name);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /unsafe-eval/);
});
test('HMAC rejects expired, missing expiry, malformed and tampered sessions', () => {
  assert.ok(auth.verifyToken(auth.createPortalSession({ user: admin, secret }), secret));
  for (const payload of [{ ...admin }, { ...admin, exp: Date.now() - 1, iat: 1 }, { ...admin, exp: 'invalid' }]) assert.equal(auth.verifyToken(auth.signToken(payload, secret), secret), null);
  assert.equal(auth.verifyToken(auth.createPortalSession({ user: admin, secret }) + '.extra', secret), null);
  assert.equal(auth.verifyToken(auth.createPortalSession({ user: admin, secret }), 'wrong'), null);
  assert.doesNotThrow(() => auth.parseCookies('bad=%E0%A4%A'));
});
test('session versions revoke previously issued tokens durably', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skuas-sessions-'));
  try {
    const store = createSessionRevocationStore({ filePath: path.join(root, 'state.json') });
    const user = { id: 't1', employeeId: 't1', role: 'Technician', type: 'employee', sessionVersion: store.getVersion({ id: 't1', type: 'employee' }) };
    const token = auth.createPortalSession({ user, secret });
    assert.ok(auth.verifyToken(token, secret));
    store.revokeUser(user, 'test');
    assert.equal(auth.readPortalUserFromRequest({ headers: { authorization: `Bearer ${token}` } }, { secret, isRevoked: payload => store.isTokenRevoked(payload) }), null);
    const nextUser = { ...user, sessionVersion: store.getVersion(user) };
    const nextToken = auth.createPortalSession({ user: nextUser, secret });
    assert.equal(auth.readPortalUserFromRequest({ headers: { authorization: `Bearer ${nextToken}` } }, { secret, isRevoked: payload => store.isTokenRevoked(payload) }).id, 't1');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('passwords hash with scrypt and preserve legacy verification', async () => {
  const hash = await passwords.hashPassword('new-test-password');
  assert.notEqual(hash, 'new-test-password');
  assert.equal(await passwords.verifyPassword('new-test-password', hash), true);
  assert.equal(await passwords.verifyPassword('wrong-password', hash), false);
  assert.equal(await passwords.verifyPassword('legacy', 'legacy'), true);
  await assert.rejects(passwords.hashPassword('short'));
});
test('financial payload validation rejects malformed money fields', () => {
  for (const body of [
    { invoiceTotal: 'NaN' },
    { items: [{ rate: '1e9' }] },
    { gstAmount: Infinity },
    { discount: '-1' },
    { salaryPerMonth: '100.001' }
  ]) {
    assert.ok(security.validateFinancialPayload(body), JSON.stringify(body));
  }
  assert.equal(security.validateFinancialPayload({ total: '100.50', items: [{ quantity: '2', rate: '50.25' }], roundOff: '-0.50' }), '');
});
test('outbound fetch rejects unsafe schemes and IP ranges', async () => {
  for (const ip of ['0.0.0.0', '127.0.0.1', '10.1.1.1', '169.254.169.254', '172.16.1.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fd00::1']) assert.equal(publicIp(ip), false, ip);
  await assert.rejects(safeFetch('file:///etc/passwd'));
  await assert.rejects(safeFetch('https://user:pass@example.com'));
});
test('path containment rejects traversal and escaping symlinks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skuas-security-'));
  try {
    fs.writeFileSync(path.join(root, 'good.png'), 'test');
    fs.symlinkSync(__filename, path.join(root, 'escape'));
    assert.equal(security.safeLocalFile(root, '../../etc/passwd'), '');
    assert.equal(security.safeLocalFile(root, 'escape'), '');
    assert.ok(security.safeLocalFile(root, 'good.png'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('spoofed file contents are rejected and removed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skuas-upload-'));
  try {
    const file = path.join(root, 'fake.png'); fs.writeFileSync(file, '<script>alert(1)</script>');
    let status;
    security.validateUploadedFiles({ file: { path: file, filename: 'fake.png' } }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('invalid upload accepted'));
    assert.equal(status, 400); assert.equal(fs.existsSync(file), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('executable extensions, mismatched MIME and oversized uploads rejected', async () => {
  for (const [name, type, size] of [['shell.js', 'image/png', 10], ['image.png', 'text/html', 10], ['image.png', 'image/png', 101]]) {
    const form = new FormData(); form.append('file', new Blob([Buffer.alloc(size)], { type }), name);
    const token = auth.createPortalSession({ user: admin, secret });
    const response = await fetch(base + '/api/test-upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://crm.skuaspestcontrol.com' }, body: form });
    assert.ok(response.status >= 400, name);
  }
});
test('payment amount rejects negative, infinite and precision-losing input', async () => {
  for (const amount of [-1, 'Infinity', 'NaN', {}, '0.001', '1e99']) assert.equal((await request('/api/payment-received', { user: admin, method: 'POST', body: { amount } })).status, 400);
  assert.equal((await request('/api/payment-received', { user: admin, method: 'POST', body: { amount: '120.50' } })).status, 200);
});
test('document shares are path-bound and cannot become login tokens', () => {
  const saved = process.env.PORTAL_AUTH_SECRET; process.env.PORTAL_AUTH_SECRET = secret;
  try {
    const shares = require('../lib/documentShares');
    const url = new URL(shares.createDocumentShare('https://crm.skuaspestcontrol.com', '/api/payroll/items/p1/slip/pdf', 't1'));
    const token = url.searchParams.get('share');
    assert.equal(shares.readDocumentShare({ method: 'GET', path: url.pathname, query: { share: token } }).employeeId, 't1');
    assert.equal(shares.readDocumentShare({ method: 'GET', path: '/api/payroll/items/p2/slip/pdf', query: { share: token } }), null);
    assert.equal(shares.readDocumentShare({ method: 'POST', path: url.pathname, query: { share: token } }), null);
    assert.equal(auth.verifyToken(token, secret), null);
  } finally { if (saved === undefined) delete process.env.PORTAL_AUTH_SECRET; else process.env.PORTAL_AUTH_SECRET = saved; }
});
test('campaigns reject injected phone numbers and recheck opt-out before sending', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skuas-campaign-'));
  const file = name => path.join(root, `${name}.json`);
  const readJsonFile = (name, fallback) => { try { return JSON.parse(fs.readFileSync(name, 'utf8')); } catch { return fallback; } };
  const customer = { _id: 'c1', name: 'Customer', mobile: '9876543210' };
  fs.writeFileSync(file('customers'), JSON.stringify([customer]));
  let sends = 0;
  const service = require('../services/whatsapp.service');
  const controllerSource = fs.readFileSync(path.join(__dirname, '../controllers/whatsappMarketing.controller.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(controllerSource, {
    module, exports: module.exports, process: { env: { WHATSAPP_MARKETING_MESSAGE_DELAY_MS: '0' } },
    setTimeout, clearTimeout, setInterval, console,
    require(name) {
      if (name === '../services/whatsapp.service') return { ...service, sendTextMessage: async () => { sends++; return {}; }, sendDocumentMessage: async () => { sends++; return {}; } };
      if (name.startsWith('../')) return require(name);
      return require(name);
    }
  });
  const controller = module.exports.createWhatsAppMarketingController({ dataDir: root, readJsonFile, settingsFile: file('settings'), customersFile: file('customers'), renewalsFile: file('renewals'), jobsFile: file('jobs'), invoicesFile: file('invoices'), paymentsFile: file('payments'), employeesFile: file('employees') });
  let result;
  const res = { status() { return this; }, json(value) { result = value; } };
  try {
    controller.createCampaign({ portalUser: admin, body: { campaignName: 'Test', campaignType: 'custom', message: 'Test', status: 'draft', recipients: [{ id: 'c1', phone: '9123456789', status: 'pending' }] } }, res);
    const campaignFile = path.join(root, 'whatsapp_marketing_campaigns.json');
    const rows = readJsonFile(campaignFile, []);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].recipients[0].phone, '9123456789');
    fs.writeFileSync(file('customers'), JSON.stringify([{ ...customer, whatsapp_marketing_opt_out: true }]));
    rows[0].status = 'running'; fs.writeFileSync(campaignFile, JSON.stringify(rows));
    await controller._processCampaign(rows[0].id);
    assert.equal(sends, 0);
    assert.equal(readJsonFile(campaignFile, [])[0].recipients[0].status, 'skipped');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('public Maps config does not return server-only geocoding keys', () => {
  const start = source.indexOf("app.get('/api/public/google-maps-config'");
  const end = source.indexOf("app.post('/api/settings'", start);
  let body;
  const run = env => vm.runInNewContext(source.slice(start, end), { process: { env }, app: { get(_path, handler) { handler({}, { json(value) { body = value; } }); } } });
  run({ GOOGLE_MAPS_API_KEY: 'server-key', GOOGLE_GEOCODING_API_KEY: 'server-key' });
  assert.equal(body.googleMapsApiKey, '');
  run({ GOOGLE_MAPS_BROWSER_API_KEY: 'browser-key', GOOGLE_GEOCODING_API_KEY: 'server-key' });
  assert.equal(body.googleMapsApiKey, 'browser-key');
});
