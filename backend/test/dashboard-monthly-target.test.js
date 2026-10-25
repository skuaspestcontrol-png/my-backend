const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

const routePath = path.join(__dirname, '../routes/salesPerformanceRoutes.js');
const source = fs.readFileSync(routePath, 'utf8');
const employee = { id: 1, external_id: 'sales-1', full_name: 'Test Sales', role: 'Sales', status: 'Active', emp_code: 'S1' };
const target = (month, revenue, extra = {}) => ({ id: month, sales_person_id: 1, target_type: 'monthly', target_month: month, target_year: 2026, revenue_target: revenue, collection_target: 999, is_active: 1, ...extra });
const invoice = (id, date, total, extra = {}) => ({ id, invoice_date: date, total, sales_person_id: 1, status: 'Unpaid', ...extra });

function fixtureRouter(data = {}) {
  const queries = [];
  const query = async (sql) => {
    queries.push(sql);
    assert.match(sql, /^SELECT /, 'Read tests must not migrate or mutate data');
    if (sql.includes('INFORMATION_SCHEMA')) return ['role', 'sales_person_id'].map((COLUMN_NAME) => ({ COLUMN_NAME }));
    if (sql.includes('FROM employees ')) return data.employees || [employee];
    if (sql.includes('FROM sales_targets ')) return (data.targets || []).filter((row) => row.is_active !== 0);
    if (sql.includes('FROM invoices ')) return data.invoices || [];
    return [];
  };
  const sandbox = { module: { exports: {} }, __dirname: path.dirname(routePath), console, process,
    require(name) {
      if (name === '../lib/db') return { query, getConnection: () => { throw new Error('Unexpected write connection'); } };
      if (name === 'fs') return { existsSync: () => false };
      return require(name);
    }
  };
  // Skip existing schema-initialization middleware in this isolated read fixture.
  vm.runInNewContext(source + '\nschemaReadyPromise = Promise.resolve();', sandbox, { filename: routePath });
  return { router: sandbox.module.exports.salesPerformanceRoutes, queries };
}
async function dashboard(data, params = {}) {
  const { router, queries } = fixtureRouter(data);
  const handler = router.stack.find((layer) => layer.route?.path === '/dashboard').route.stack[0].handle;
  let body, status = 200;
  await handler({ query: { year: '2026', month: '10', ...params } }, { json(value) { body = JSON.parse(JSON.stringify(value)); }, status(code) { status = code; return this; } });
  assert.equal(status, 200);
  return { body, queries };
}

test('dashboard API metadata distinguishes absent targets and explicit zero without changing yearly revenue', async () => {
  for (const [targets, count] of [[[], 0], [[target(10, 0)], 1], [[target(10, 100000)], 1]]) {
    const { body } = await dashboard({ targets, invoices: [invoice(1, '2026-10-15', 25000), invoice(2, '2026-01-01', 10000)] });
    assert.equal(body.summary.monthlyTargetCount, count);
    assert.equal(body.summary.totalMonthlyAchieved, 25000);
    assert.equal(body.summary.totalYearlyAchieved, 35000);
    assert.equal(body.summary.totalMonthlyTarget, targets[0]?.revenue_target || 0);
  }
});
test('configuration count and totals only include active monthly targets for the selected sales team and period', async () => {
  const other = { ...employee, id: 2, external_id: 'sales-2', full_name: 'Other Sales', emp_code: 'S2' };
  const { body } = await dashboard({ employees: [employee, other], targets: [target(10, 100), target(10, 200, { id: 20, sales_person_id: 2 }), target(10, 500, { is_active: 0 }), target(9, 800), target(10, 1000, { target_year: 2025 }), target(10, 1200, { target_type: 'yearly', target_month: null }), target(10, 5000, { sales_person_id: 999 })] }, { employeeId: 'sales-1' });
  assert.equal(body.summary.monthlyTargetCount, 1);
  assert.equal(body.summary.totalMonthlyTarget, 100);
  assert.equal(body.summary.totalYearlyTarget, 1200);
});
test('invoice sales are counted once per loaded invoice, apart from payments and quotations', async () => {
  const { body } = await dashboard({ targets: [target(10, 100000)], invoices: [invoice(1, '2026-10-01', 11800, { subtotal: 10000, totalTax: 1800, paymentReceivedTotal: 1000 }), invoice(2, '2026-10-31', 23600), invoice(3, '2026-11-01', 9999)] });
  assert.equal(body.summary.totalMonthlyAchieved, 35400);
  assert.equal(body.summary.monthlyPending, 64600);
  assert.equal(body.summary.totalYearlyAchieved, 45399);
  assert.equal(body.summary.totalMonthlyAchieved, body.salesPersonPerformance.reduce((sum, row) => sum + row.monthlyAchieved, 0));
});
test('months without sales and year transitions preserve separate calendar periods', async () => {
  const data = { targets: [target(12, 100), target(1, 200, { target_year: 2027 })], invoices: [invoice(1, '2026-12-31', 50), invoice(2, '2027-01-01', 150)] };
  const december = (await dashboard(data, { month: '12' })).body.summary;
  const january = (await dashboard(data, { year: '2027', month: '1' })).body.summary;
  const empty = (await dashboard(data, { month: '9' })).body.summary;
  assert.equal(december.totalMonthlyAchieved, 50);
  assert.equal(december.totalMonthlyTarget, 100);
  assert.equal(january.totalMonthlyAchieved, 150);
  assert.equal(january.totalMonthlyTarget, 200);
  assert.equal(empty.totalMonthlyAchieved, 0);
  assert.equal(empty.monthlyTargetCount, 0);
});
test('monthly addition retains the existing reporting treatment of cancellations and duplicates', async () => {
  // Audit evidence: existing yearly reporting does not filter these. This change must not silently alter it.
  const duplicate = invoice(1, '2026-10-15', 100, { status: 'Cancelled' });
  const { body } = await dashboard({ invoices: [duplicate, { ...duplicate }] });
  assert.equal(body.summary.totalMonthlyAchieved, 200);
  assert.equal(body.summary.totalYearlyAchieved, 200);
});
test('HTTP integration preserves response contract, period parameters and no-cache headers', async () => {
  const { router } = fixtureRouter({ targets: [target(10, 1000)], invoices: [invoice(1, '2026-10-15', 1500)] });
  const app = express();
  app.use('/api/sales-performance', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/sales-performance/dashboard?year=2026&month=10`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.month, 10);
    assert.equal(body.year, 2026);
    assert.equal(body.summary.monthlyTargetCount, 1);
    assert.equal(body.summary.monthlyPending, 0);
    assert.equal(body.summary.monthlyAchievementPercent, 150);
    assert.equal(body.monthlyTrend.length, 12);
    assert(Array.isArray(body.matrix));
    assert.equal(body.summary.totalYearlyAchieved, 1500);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('existing authentication and role gates still protect the monthly dashboard API', async () => {
  const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const gateStart = serverSource.indexOf('app.use(async (req, res, next) => {', serverSource.indexOf('app.use(requirePortalAuth)'));
  const gateEnd = serverSource.indexOf('\n});', gateStart);
  assert(gateStart > 0 && gateEnd > gateStart);
  const roleGate = new Function('security', 'return ' + serverSource.slice(gateStart + 'app.use('.length, gateEnd + 2))(require('../lib/security'));
  const authStart = serverSource.indexOf('const requirePortalAuth = ');
  const authEnd = serverSource.indexOf('\n};', authStart);
  const requireAuth = new Function('isPortalPublicRoute', serverSource.slice(authStart, authEnd + 3) + '\nreturn requirePortalAuth;')(() => false);
  const auth = require('../lib/portalAuth');
  const secret = 'isolated-dashboard-role-test-secret-at-least-32-characters';
  const app = express();
  app.use((req, _res, next) => { req.portalUser = auth.readPortalUserFromRequest(req, { secret }); next(); });
  app.use(requireAuth);
  app.use(roleGate);
  app.use('/api/sales-performance', fixtureRouter({}).router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/sales-performance/dashboard?year=2026&month=10`;
    assert.equal((await fetch(url)).status, 401);
    for (const [role, status] of [['Admin', 200], ['Sales', 200], ['Operations', 200], ['Technician', 403], ['Employee', 403]]) {
      const token = auth.createPortalSession({ user: { id: 'fixture-only', role }, secret });
      assert.equal((await fetch(url, { headers: { authorization: `Bearer ${token}` } })).status, status, role);
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('Sales Performance API returns 0.5 percent for a 100000 target and 450 achieved', async () => {
  const { body } = await dashboard({ targets: [target(10, 100000)], invoices: [invoice(1, '2026-10-15', 450)] });
  assert.equal(body.summary.totalMonthlyTarget, 100000);
  assert.equal(body.summary.totalMonthlyAchieved, 450);
  assert.equal(body.summary.monthlyPending, 99550);
  assert.equal(body.summary.monthlyAchievementPercent, 0.5);
});
