const test = require('node:test');
const assert = require('node:assert/strict');
const { createHrPortalReaders, getHrBusinessDate } = require('../lib/hrPortalReaders');
const { registerHrModule } = require('../hrModule');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('canonical HR readers issue only SELECTs and use saved payroll totals without recalculation', async () => {
  const queries = [];
  const readers = createHrPortalReaders({ canUseMysql: () => true, readJsonFile: () => { throw Error('No JSON fallback'); }, files: {}, mapEmployee: row => ({ _id: row.external_id }), withMysqlConnection: async fn => fn({ query: async sql => { queries.push(sql); assert.match(sql, /^SELECT\b/); return [sql.includes('FROM employees') ? [{ external_id: 'employee-1' }] : [{ payroll_key: 'pay-1', employee_id: 'employee-1', month: 10, year: 2026, net_salary: '123.45', payment_status: 'Partial', payroll_status: 'Hold', payload: JSON.stringify({ netSalary: 900, grossSalary: 1000 }) }]]; } }) });
  assert.deepEqual(await readers.employees(), [{ _id: 'employee-1' }]);
  const [payroll] = await readers.payroll();
  assert.equal(payroll.netSalary, 123.45); assert.equal(payroll.paymentStatus, 'Partial'); assert.equal(payroll.payrollStatus, 'Hold'); assert.equal(payroll.grossSalary, 1000);
  assert.equal(queries.length, 2); assert.doesNotMatch(queries[0], /\bpassword\b|\bportal_password\b/i);
});

test('empty canonical tables remain genuinely empty and SQL failures do not fall back to stale JSON', async () => {
  const base = { canUseMysql: () => true, files: {}, readJsonFile: () => [{ netSalary: 99 }], mapEmployee: x => x };
  const empty = createHrPortalReaders({ ...base, withMysqlConnection: async fn => fn({ query: async () => [[]] }) });
  assert.deepEqual(await empty.payroll(), []); assert.deepEqual(await empty.employees(), []);
  const failed = createHrPortalReaders({ ...base, withMysqlConnection: async () => { throw Error('Source unavailable'); } });
  await assert.rejects(failed.payroll()); await assert.rejects(failed.employees());
});

test('missing saved payroll amounts are unavailable, not fabricated zeros', async () => {
  const readers = createHrPortalReaders({ canUseMysql: () => true, files: {}, readJsonFile: () => [], mapEmployee: x => x, withMysqlConnection: async fn => fn({ query: async () => [[{ net_salary: null }]] }) });
  await assert.rejects(readers.payroll(), /Stored payroll total unavailable/);
});

function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-live-read-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keys = ['employeesFile','attendanceFile','jobsFile','invoicesFile','payrollItemsFile','salaryStructuresFile','advancesFile','leavesFile','notificationsFile','workflowFile','performanceFile'];
  const files = Object.fromEntries(keys.map(k => [k, path.join(dir, k + '.json')]));
  const routes = new Map(), queries = [];
  const employees = [{ _id: 'employee-1', firstName: 'Fixture', lastName: 'One', role: 'Technician', employmentStatus: 'Active' }];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
  registerHrModule({ app: Object.fromEntries(['get','put','post'].map(method => [method, (url, fn) => routes.set(method + url, fn)])), files, readJsonFile: () => [], dataProviders: { canUseMysql: () => true, employees: async () => employees, payroll: async () => [{ employeeId: 'employee-1', month: 10, year: 2026, netSalary: 123.45, paymentStatus: 'Pending' }], ...overrides }, withMysqlConnection: async fn => fn({ query: async sql => { queries.push(sql); assert.match(sql, /^\s*SELECT\b/); return [sql.includes('FROM attendance ') ? [{ external_id: 'attendance-1', payload: { employeeId: 'employee-1', date: today, status: 'present' } }] : []]; } }) });
  const call = async (query = {}, role = 'HR') => { let data, status = 200; const res = { json: value => { data = value; }, status: value => { status = value; return res; } }; await routes.get('get/api/hr/dashboard-summary')({ query, portalUser: { role } }, res); return { data, status }; };
  return { call, queries, today, routes };
}

test('overview does not seed records and today is independent of selected month', async t => {
  const f = fixture(t); const { data, status } = await f.call({ month: 9, year: 2020 });
  assert.equal(status, 200); assert.equal(data.attendanceReferenceDate, f.today); assert.equal(data.cards.presentToday, 1); assert.equal(data.cards.totalPayrollCurrentMonth, 0); assert.equal(data.reportingTimeZone, 'Asia/Kolkata'); assert.ok(f.queries.every(sql => /^\s*SELECT\b/.test(sql)));
});

test('overview returns persisted money using existing sums and marks failed payroll unavailable', async t => {
  const f = fixture(t); let { data } = await f.call({ month: 10, year: 2026 }); assert.equal(data.cards.totalPayrollCurrentMonth, 123.45); assert.equal(data.cards.pendingSalaryPayments, 123.45);
  const failed = fixture(t, { payroll: async () => { throw Error('unavailable'); } }); ({ data } = await failed.call({ month: 10, year: 2026 })); assert.equal(data.cards.totalPayrollCurrentMonth, null); assert.equal(data.cards.pendingSalaryPayments, null); assert.equal(data.dataState.payroll, 'unavailable'); assert.equal(data.cards.totalEmployees, 1);
});

test('unmatched payroll IDs fail closed and employee roles cannot read the overview', async t => {
  const f = fixture(t, { payroll: async () => [{ employeeId: 'unknown', month: 10, year: 2026, netSalary: 800 }] }); const { data } = await f.call({ month: 10, year: 2026 }); assert.equal(data.reviewRequired.unmatchedPayrollRecords, 1); assert.equal(data.cards.totalPayrollCurrentMonth, null); assert.equal((await f.call({}, 'Employee')).status, 403);
});

test('attendance uses the portal relational fallbacks without schema setup or identity guesses', async () => {
  const readers = createHrPortalReaders({ canUseMysql: () => true, readJsonFile: () => [], files: {}, mapEmployee: x => x, withMysqlConnection: async fn => fn({ query: async sql => {
    assert.match(sql, /^SELECT\b/); assert.match(sql, /FROM attendance/); assert.doesNotMatch(sql, /CREATE|ALTER|UPDATE|INSERT|DELETE/i);
    return [[{ id: 1, external_id: 'a1', employee_external_id: 'e1', attendance_date_value: '2026-10-26', status: 'present', check_in_value: '10:14:00', check_out_value: '17:30:00', payload: '{}' }]];
  } }) });
  const [row] = await readers.attendance(); assert.equal(row.employeeId, 'e1'); assert.equal(row.date, '2026-10-26'); assert.equal(row.status, 'present'); assert.equal(row.checkIn, '10:14:00');
});

test('unmatched attendance identities are unavailable rather than counted as zero present', async t => {
  const f = fixture(t, { attendance: async () => [{ employeeId: 'unknown', date: new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), status: 'present' }] });
  const { data } = await f.call(); assert.equal(data.reviewRequired.unmatchedAttendanceRecords, 1); assert.equal(data.cards.presentToday, null);
});

test('the employee overview feed minimises personal fields and keeps the HR access boundary', async t => {
  const f = fixture(t, { employees: async () => [{ _id: 'e1', firstName: 'Fixture', salary: 123, password: 'fixture-secret', email: 'fixture@example.invalid' }] });
  const route = f.routes.get('get/api/hr/employees/overview'); let result, status = 200;
  const res = { json: x => { result = x; }, status: x => { status = x; return res; } };
  await route({ portalUser: { role: 'HR' } }, res); assert.equal(result[0]._id, 'e1'); assert.ok(!('salary' in result[0])); assert.ok(!('password' in result[0])); assert.ok(!('email' in result[0]));
  await route({ portalUser: { role: 'Employee' } }, res); assert.equal(status, 403);
});

test('Present Today never inherits the legacy display fallback for a missing status', async t => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
  const f = fixture(t, { attendance: async () => [{ employeeId:'employee-1',date:today }] }); const { data } = await f.call(); assert.equal(data.cards.presentToday, 0);
});

test('a birthday on the current business date stays today rather than rolling into next year', async t => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
  const f = fixture(t, { employees: async () => [{ _id:'employee-1',firstName:'Fixture',dateOfBirth:'2000-'+today.slice(5) }] }); const { data } = await f.call(); assert.equal(data.quickInsights.upcomingBirthdays[0].days, 0);
});

test('ambiguous canonical employee IDs fail closed instead of inflating the roster', async () => {
  const readers = createHrPortalReaders({ canUseMysql: () => true, files: {}, readJsonFile: () => [], mapEmployee: () => ({ _id:'duplicate' }), withMysqlConnection: async fn => fn({ query: async () => [[{id:1},{id:2}]] }) });
  await assert.rejects(readers.employees(), /Employee identity unavailable/);
});


test('the business date respects India midnight and year rollover independently of server timezone', () => {
  assert.equal(getHrBusinessDate(new Date('2026-12-31T18:29:59Z')), '2026-12-31');
  assert.equal(getHrBusinessDate(new Date('2026-12-31T18:30:00Z')), '2027-01-01');
  assert.equal(getHrBusinessDate(new Date('2026-10-25T18:30:00Z')), '2026-10-26');
});

test('a failed employee source does not masquerade as confirmed unmatched identities or zero staff', async t => {
  const f = fixture(t, { employees: async () => { throw Error('Unavailable'); } }); const { data } = await f.call({month:10,year:2026});
  assert.equal(data.cards.totalEmployees, null); assert.equal(data.cards.totalPayrollCurrentMonth, null); assert.equal(data.reviewRequired.unmatchedPayrollRecords, null); assert.equal(data.reviewRequired.unmatchedAttendanceRecords, null);
});

test('conflicting same-day statuses are surfaced rather than choosing a payroll/attendance rule', async t => {
  const today = getHrBusinessDate(); const f = fixture(t, { attendance: async () => [{employeeId:'employee-1',date:today,status:'present'},{employeeId:'employee-1',date:today,status:'absent'}] });
  const { data } = await f.call(); assert.equal(data.reviewRequired.conflictingAttendanceEmployees, 1); assert.equal(data.cards.presentToday, null); assert.equal(data.cards.onLeaveToday, null);
});

test('a read-only overview does not invent workflow statuses for unseeded employees', async t => {
  const f = fixture(t); const { data } = await f.call({status:'Active Employees'}); assert.equal(data.cards.totalEmployees, 0); assert.ok(f.queries.every(sql=>/^\s*SELECT\b/.test(sql)));
});
