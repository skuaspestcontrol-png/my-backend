const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const onceAsync = require('../lib/onceAsync');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/RenewalDashboard.jsx'), 'utf8');

function extract(source, name, next, dependencies) {
  const start = source.indexOf(`const ${name} =`);
  const end = source.indexOf(`const ${next} =`, start + 1);
  assert(start >= 0 && end > start);
  return new Function(...Object.keys(dependencies), `${source.slice(start, end)}; return ${name};`)(...Object.values(dependencies));
}
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Operation stalled')), 1000); })]); }
  finally { clearTimeout(timer); }
}

test('schema initialization is shared across concurrent requests and cached after success', async () => {
  let calls = 0, finish;
  const initialize = onceAsync(async () => { calls += 1; await new Promise((resolve) => { finish = resolve; }); });
  const work = Array.from({ length: 5 }, () => initialize());
  await Promise.resolve(); assert.equal(calls, 1);
  finish(); await Promise.all(work); await initialize(); assert.equal(calls, 1);
});

test('failed schema initialization can be retried', async () => {
  let calls = 0;
  const initialize = onceAsync(async () => { if (++calls === 1) throw new Error('Temporary database error'); });
  await assert.rejects(initialize(), /Temporary database error/);
  await initialize(); await initialize(); assert.equal(calls, 2);
});

test('parallel renewal reads complete with a single database connection and never auto-sync', async () => {
  let active = false, syncCalls = 0, invoiceReads = 0;
  const waiters = [];
  const acquire = async () => { if (active) await new Promise((resolve) => waiters.push(resolve)); else active = true; };
  const release = () => { if (waiters.length) waiters.shift()(); else active = false; };
  const withMysqlConnection = async (callback) => {
    await acquire();
    try { return await callback({ query: async () => [[{ renewalId: 'R1' }]] }); } finally { release(); }
  };
  const read = extract(server, 'loadRenewalRows', 'markMatchingRenewalCompleteForInvoice', {
    cleanupStoredRenewalAddresses: async () => {}, canUseMysql: () => true,
    syncRenewalsFromContracts: async () => { syncCalls += 1; }, withMysqlConnection,
    ensureRenewalTables: async () => {}, renewalPublicRow: (row) => row,
    loadInvoicesForContext: async () => withMysqlConnection(async () => { invoiceReads += 1; return []; }),
    enrichRenewalsWithConvertedContractPeriods: (rows) => rows,
    enrichRenewalsWithCurrentContractWindows: (rows) => rows
  });
  const results = await bounded(Promise.all([read(), read(), read(), read()]));
  assert.equal(results.length, 4); assert.equal(invoiceReads, 4); assert.equal(syncCalls, 0); assert.equal(active, false);
  await bounded(read({ autoSync: true })); assert.equal(syncCalls, 1);
});

function saveDependencies(data = { renewal: { renewalId: 'R1', renewalOutcome: 'WON' } }) {
  const events = [];
  return { events, dependencies: {
    busy: false, existingLinks: { candidates: [{ key: 'K', invoiceId: 'I', invoiceVersion: 'V', invoiceNumber: 'INV-1', start: '2026-01-01', end: '2026-12-31' }] },
    form: { wonMode: 'new', existingCandidateKey: 'K', agreementDate: '2026-01-01', contractStartDate: '2026-01-01', contractEndDate: '2026-12-31', amount: 100 },
    modal: { row: { renewalId: 'R1' } }, filters: {}, API_BASE: '',
    window: { confirm: () => true }, formatDate: String, formatINR: String,
    axios: { post: async () => ({ data }) },
    setBusy: (value) => events.push(['busy', value]), setMessage: (value) => events.push(['message', value]),
    setExistingLinks: () => {}, applySavedRenewal: (row) => events.push(['saved', row]),
    closeModal: () => events.push(['close']), triggerContractsRefresh: () => events.push(['notify']),
    navigate: (url) => events.push(['navigate', url]),
    loadData: (_filters, options) => { events.push(['refresh', options]); return new Promise(() => {}); }
  } };
}

test('Won existing-record save completes even when dashboard refresh never finishes', async () => {
  const { events, dependencies } = saveDependencies();
  const save = extract(frontend, 'handleLinkExisting', 'handleConvertToContract', dependencies);
  await bounded(save());
  assert(events.some(([event]) => event === 'saved'));
  assert(events.some(([event]) => event === 'close'));
  assert.deepEqual(events.at(-1), ['busy', false]);
  assert.equal(events.find(([event]) => event === 'refresh')[1].afterSave, true);
});

test('new contract save navigates immediately without waiting for the renewal dashboard reload', async () => {
  const { events, dependencies } = saveDependencies({ renewal: { renewalId: 'R1' }, contract: { _id: 'EXISTING-ID' } });
  const save = extract(frontend, 'handleConvertToContract', 'runAction', dependencies);
  await bounded(save());
  assert(events.some(([event]) => event === 'navigate'));
  assert(!events.some(([event]) => event === 'refresh'));
  assert.deepEqual(events.at(-1), ['busy', false]);
});

test('Lost and other renewal actions also release busy state before refresh completes', async () => {
  const { events, dependencies } = saveDependencies();
  const run = extract(frontend, 'runAction', 'loadRenewalAudit', dependencies);
  await bounded(run('Saved', async () => ({ data: { renewal: { renewalId: 'R1', renewalOutcome: 'LOST' } } })));
  assert.equal(events.find(([event]) => event === 'saved')[1].renewalOutcome, 'LOST');
  assert.deepEqual(events.at(-1), ['busy', false]);
});

test('save failures never apply success state or close the form', async () => {
  const { events, dependencies } = saveDependencies();
  dependencies.axios.post = async () => { throw new Error('Save rejected'); };
  const save = extract(frontend, 'handleLinkExisting', 'handleConvertToContract', dependencies);
  await bounded(save());
  assert(!events.some(([event]) => event === 'saved' || event === 'close' || event === 'refresh'));
  assert.deepEqual(events.at(-1), ['busy', false]);
});
