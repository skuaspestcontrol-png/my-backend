const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const onceAsync = require('../lib/onceAsync');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const block = source.slice(source.indexOf('const ensureVendorFinanceTables ='), source.indexOf('const readMysqlPayload ='));
const load = (ensureColumnsIfMissing) => new Function('onceAsync', 'ensureColumnsIfMissing', `${block}; return ensureVendorFinanceTables;`)(onceAsync, ensureColumnsIfMissing);

test('finance GET initialization is shared and warm requests perform no schema checks', async () => {
  const statements = [], columnChecks = [];
  const initialize = load(async (_conn, table, columns) => columnChecks.push({ table, columns: columns.map((v) => v.name) }));
  const conn = { query: async (sql) => { statements.push(sql); await new Promise((r) => setTimeout(r, 1)); return [[]]; } };
  await Promise.all([initialize(conn), initialize(conn), initialize(conn), initialize(conn)]);
  assert.equal(statements.length, 4);
  assert(statements.every((sql) => /^\s*CREATE TABLE IF NOT EXISTS/.test(sql)));
  assert.deepEqual(columnChecks.map((v) => v.table), ['vendors', 'payment_received']);
  assert.equal(columnChecks.reduce((n, v) => n + v.columns.length, 0), 8);
  await initialize({ query: async () => assert.fail('Warm request repeated schema SQL') });
  assert.equal(statements.length, 4);
});

test('failed initialization retries on a later request instead of remaining stuck', async () => {
  const initialize = load(async () => {});
  await assert.rejects(initialize({ query: async () => { throw new Error('Synthetic unavailable database'); } }));
  let calls = 0;
  await initialize({ query: async () => { calls += 1; return [[]]; } });
  assert.equal(calls, 4);
});

const contractSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/ContractDashboard.jsx'), 'utf8');
const paymentStart = contractSource.indexOf('  const loadLivePayments = useCallback(');
const paymentEnd = contractSource.indexOf('\n\n  useEffect', paymentStart);
const paymentLoader = (axios, performance) => new Function('axios', 'performance', 'useCallback', 'API_BASE', 'CONTRACT_READ_TIMEOUT_MS', `${contractSource.slice(paymentStart, paymentEnd)}; return loadLivePayments;`)(axios, performance, (fn) => fn, '', 20000);

test('payment fallback shares a monotonic 20-second budget instead of extending a stalled load', async () => {
  let now = 0; const calls = [];
  const load = paymentLoader({ get: async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) { now = 12000; throw new Error('Synthetic primary failure'); }
    return { data: [] };
  } }, { now: () => now });
  await load();
  assert.equal(calls.length, 2); assert.equal(calls[0].options.timeout, 20000); assert.equal(calls[1].options.timeout, 8000);
  now = 0; let attempts = 0;
  const expired = paymentLoader({ get: async () => { attempts++; now = 21000; throw new Error('Synthetic timeout'); } }, { now: () => now });
  await expired(); assert.equal(attempts, 1);
});

test('cancelled payment reads do not start a fallback request', async () => {
  let attempts = 0;
  const load = paymentLoader({ get: async () => { attempts++; throw new Error('Synthetic cancellation'); } }, { now: () => 0 });
  await load({ aborted: true }); assert.equal(attempts, 1);
});
