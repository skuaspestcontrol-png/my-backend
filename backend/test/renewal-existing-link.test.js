const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExistingCandidates, buildExistingHistory, contractStatusLabel, createExistingLinkService, dateOnly } = require('../lib/renewalExistingLink');

const clone = (value) => JSON.parse(JSON.stringify(value));
const source = { _id: 'OLD', customerId: 'C1', customerName: 'Customer', customerPremiseId: 'P1' };
const renewal = { renewalId: 'R1', contractId: 'OLD', previousContractId: 'OLD', customerExternalId: 'C1',
  serviceType: 'Pest control', previousContractEnd: '2025-12-31', previousContractAmount: 100,
  renewalOutcome: 'PENDING', status: 'Upcoming', payload: { reminderPlan: { autoEnabled: true } } };
const target = { _id: 'NEW', customerId: 'C1', customerName: 'Customer', customerPremiseId: 'P1',
  invoiceNumber: 'INV-1', status: 'PAID', invoiceType: 'GST', date: '2026-01-01', total: 118,
  items: [{ itemName: 'Pest control', contractStartDate: '2026-01-01', contractEndDate: '2026-12-31', amount: 100, taxRate: 18 }] };
const deriveWindow = (invoice) => ({ contractEndDate: invoice.items?.[0]?.contractEndDate });
const classifySource = (invoice) => ({ relationshipType: invoice.serviceRelationshipType || 'CONTRACT' });
const itemTotals = (items) => ({ total: items.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity) * Number(item.rate)) * (1 + Number(item.taxRate || 0) / 100), 0) });
const candidates = (invoices = [target], row = renewal, predecessor = source) => buildExistingCandidates({ renewal: row, sourceInvoice: predecessor, invoices, deriveWindow, classifySource, itemTotals });

test('matches canonical customer, premises, service and next period; excludes source invoice', () => {
  assert.equal(candidates([source, target]).length, 1);
  for (const patch of [
    { customerId: 'OTHER' }, { customerPremiseId: 'OTHER' }, { customerPremiseId: '' },
    { status: 'CANCELLED' }, { status: 'DRAFT' }, { invoiceNumber: '' }, { total: null, amount: null },
    { serviceRelationshipType: 'ONE_TIME' },
    { items: [{ ...target.items[0], itemName: 'Different service' }] },
    { items: [{ ...target.items[0], contractStartDate: '2025-12-01' }] },
    { items: [{ ...target.items[0], contractEndDate: '' }] }
  ]) assert.equal(candidates([{ ...target, ...patch }]).length, 0, JSON.stringify(patch));
  assert.throws(() => candidates([target], { ...renewal, customerExternalId: 'WRONG' }), /verified customer ID/);
  assert.throws(() => candidates([target], { ...renewal, previousContractEnd: '' }), /valid end date/);
});

test('legacy premises need an exact verified address; name-only matching is never used', () => {
  assert.equal(candidates([{ ...target, customerPremiseId: '', shippingAddressText: '10 Main Road' }], renewal,
    { ...source, customerPremiseId: '', shippingAddressText: '10 Main Road' }).length, 1);
  assert.equal(candidates([{ ...target, customerPremiseId: '' }], renewal, { ...source, customerPremiseId: '' }).length, 0);
});

test('multi-service invoices allocate actual invoice total once, including tax, discount and rounding', () => {
  const second = { ...target.items[0], itemName: 'Termite control', amount: 200 };
  const invoice = { ...target, total: 300, items: [...target.items, second] };
  const firstMatch = candidates([invoice])[0];
  const secondMatch = candidates([invoice], { ...renewal, serviceType: second.itemName })[0];
  assert.equal(firstMatch.amount, 100);
  assert.equal(secondMatch.amount, 200);
  assert.notEqual(firstMatch.key, secondMatch.key);
  const tiny = { ...target, total: 0.03, items: Array.from({ length: 5 }, (_, index) => ({ ...target.items[0], itemName: `Service ${index}`, amount: 1 })) };
  const amounts = tiny.items.map((item) => candidates([tiny], { ...renewal, serviceType: item.itemName })[0].amount);
  assert.equal(Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100), 3);
  assert(amounts.every((amount) => amount >= 0));
});

test('dates are real calendar dates and missing contracts are not inferred from invoice billing dates', () => {
  assert.equal(dateOnly('2026-02-30'), '');
  assert.equal(dateOnly('01/02/2026'), '');
  assert.equal(candidates([{ ...target, items: [{ itemName: 'Pest control', amount: 100 }], dueDate: '2026-12-31' }]).length, 0);
});

test('customer history includes both expired and active renewal invoices, including expiry-day starts', () => {
  const row = { ...renewal, serviceType: 'General Pest Control', previousContractEnd: '2026-01-23' };
  const old = { ...source, invoiceNumber: 'SPC/2025/040', servicePeriodStart: '2025-07-24', servicePeriodEnd: '2026-01-23' };
  const expired = { ...target, _id: 'EXPIRED', invoiceNumber: 'SPC/2026/002', status: 'EXPIRED', items: [{ ...target.items[0],
    itemName: row.serviceType, contractStartDate: '2026-01-23', contractEndDate: '2026-07-22' }] };
  const active = { ...expired, _id: 'ACTIVE', invoiceNumber: 'SPC/2026/040', status: 'PAID', items: [{ ...expired.items[0],
    contractStartDate: '2026-07-23', contractEndDate: '2027-01-22' }] };
  const history = buildExistingHistory({ renewal: row, sourceInvoice: old, invoices: [old, expired, active], deriveWindow, classifySource, itemTotals, today: '2026-10-21' });
  const expiredMatch = history.find((item) => item.invoiceNumber === 'SPC/2026/002');
  assert.equal(expiredMatch.contractStatusLabel, 'Expired Contract'); assert.equal(expiredMatch.eligible, true);
  assert.equal(history.find((item) => item.invoiceNumber === 'SPC/2026/040').contractStatusLabel, 'Active Contract');
  assert.equal(history.find((item) => item.invoiceNumber === old.invoiceNumber).eligible, false);
});

test('history exposes excluded expired invoice numbers with reasons instead of hiding them', () => {
  const invoices = [
    { ...target, _id: 'WRONG-SITE', invoiceNumber: 'OLD-SITE', customerPremiseId: 'OTHER', servicePeriodEnd: '2026-06-30' },
    { ...target, _id: 'OLD-PERIOD', invoiceNumber: 'OLD-CYCLE', items: [{ ...target.items[0], contractStartDate: '2025-01-01', contractEndDate: '2025-12-31' }] },
    { ...target, _id: 'OTHER-CUSTOMER', invoiceNumber: 'PRIVATE', customerId: 'C2' }
  ];
  const history = buildExistingHistory({ renewal, sourceInvoice: source, invoices, deriveWindow, classifySource, itemTotals, today: '2026-10-21' });
  assert.equal(history.length, 2);
  assert.equal(history.find((item) => item.invoiceNumber === 'OLD-SITE').eligible, false);
  assert.match(history.find((item) => item.invoiceNumber === 'OLD-SITE').eligibilityReason, /Premises/);
  const expired = history.find((item) => item.invoiceNumber === 'OLD-CYCLE');
  assert.equal(expired.contractStatusLabel, 'Expired Contract'); assert.equal(expired.eligible, false);
  assert.match(expired.eligibilityReason, /does not follow/);
});

test('contract state uses end dates inclusively and does not treat payment due dates as expiry', () => {
  assert.equal(contractStatusLabel('2026-01-01', '2026-10-20', '2026-10-21'), 'Expired Contract');
  assert.equal(contractStatusLabel('2026-01-01', '2026-10-21', '2026-10-21'), 'Active Contract');
  assert.equal(contractStatusLabel('2026-11-01', '2027-10-31', '2026-10-21'), 'Upcoming Contract');
  assert.equal(contractStatusLabel('', '', '2026-10-21'), 'Period unavailable');
  const history = buildExistingHistory({ renewal, sourceInvoice: source, invoices: [{ ...target, items: [{ itemName: renewal.serviceType, amount: 100 }], dueDate: '2020-01-01' }], deriveWindow, classifySource, itemTotals });
  assert.equal(history[0].contractStatusLabel, 'Period unavailable'); assert.equal(history[0].eligible, false);
});

function setup(extraRows = [], invoices = [source, target]) {
  const state = { rows: [clone(renewal), ...clone(extraRows)], invoices: clone(invoices), audit: [], queries: [], commits: 0, rollbacks: 0, releases: 0 };
  let queue = Promise.resolve();
  const toRenewal = (row) => ({ ...row, payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload });
  const getConnection = async () => {
    let unlock, snapshot;
    return {
      async beginTransaction() { const before = queue; queue = new Promise((resolve) => { unlock = resolve; }); await before; snapshot = clone(state.rows); },
      async commit() { state.commits += 1; if (unlock) unlock(); unlock = null; },
      async rollback() { state.rollbacks += 1; if (snapshot) state.rows = snapshot; if (unlock) unlock(); unlock = null; },
      release() { state.releases += 1; },
      async query(sql, values) {
        assert.equal((sql.match(/\?/g) || []).length, values.length, 'SQL placeholder count');
        state.queries.push(sql);
        if (sql.startsWith('SELECT * FROM invoices WHERE external_id')) return [[...state.invoices.filter((row) => row._id === values[0])]];
        if (sql.startsWith('SELECT * FROM invoices WHERE customer_external_id')) return [[...state.invoices.filter((row) => row.customerId === values[0])]];
        if (sql.startsWith('SELECT * FROM renewals WHERE renewal_id')) return [[...state.rows.filter((row) => row.renewalId === values[0])]];
        if (sql.startsWith('SELECT * FROM renewals WHERE converted_contract_id')) return [[...state.rows]];
        if (sql.startsWith('UPDATE renewals SET')) {
          const row = state.rows.find((entry) => entry.renewalId === values[17]);
          Object.assign(row, { status: 'Done', renewalOutcome: 'WON', convertedContractId: values[0], newContractId: values[1],
            agreementDate: values[2], outcomeDecisionDate: values[3], outcomeRecordedAt: values[4], renewedAt: values[6],
            newContractStartDate: values[7], newContractEndDate: values[8], finalRenewalAmount: values[10], payload: values[16] });
          return [{ affectedRows: 1 }];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    };
  };
  const service = createExistingLinkService({ getConnection, toRenewal, toInvoice: (row) => ({ ...row, external_id: row._id }), deriveWindow, classifySource, itemTotals,
    deriveTiming: ({ outcome_decision_date, previous_contract_end }) => outcome_decision_date <= previous_contract_end ? 'ON_TIME' : 'LATE',
    priceDelta: (before, after) => ({ difference: after - before, percentage: (after - before) / before * 100 }),
    audit: async (_conn, event) => { if (state.auditError) throw new Error('Audit unavailable'); state.audit.push(event); }
  });
  const candidate = candidates(invoices)[0];
  const request = { renewalId: 'R1', body: { candidateKey: candidate.key, invoiceId: candidate.invoiceId, invoiceVersion: candidate.invoiceVersion, agreementDate: '2025-12-20' }, actor: 'Manager', authorize: () => {} };
  // Hydration mirrors the stable raw columns present in both list and save queries.
  const selected = buildExistingCandidates({ renewal, sourceInvoice: source, invoices: invoices.map((row) => ({ ...row, external_id: row._id })), deriveWindow, classifySource, itemTotals })[0];
  request.body.invoiceVersion = selected.invoiceVersion;
  return { state, service, request };
}

test('link only updates renewal and audit; historical agreement date and recording time stay separate', async () => {
  const { state, service, request } = setup(); const beforeInvoices = clone(state.invoices);
  await service.link(request);
  const row = state.rows[0], payload = JSON.parse(row.payload);
  assert.equal(row.status, 'Done'); assert.equal(row.renewalOutcome, 'WON'); assert.equal(row.convertedContractId, 'NEW');
  assert.equal(row.finalRenewalAmount, 118); assert.equal(row.agreementDate, '2025-12-20'); assert.equal(row.renewedAt, '2025-12-20 00:00:00');
  assert.notEqual(row.outcomeRecordedAt.slice(0, 10), row.agreementDate);
  assert.equal(payload.existingRenewalLink.linkedBy, 'Manager'); assert.equal(payload.reminderPlan.autoEnabled, false);
  assert.deepEqual(state.invoices, beforeInvoices); assert.equal(state.audit.length, 1); assert.equal(state.commits, 1);
  assert(state.queries.every((sql) => sql.startsWith('SELECT ') || sql.startsWith('UPDATE renewals SET')));
});

test('concurrent double submit is idempotent and produces only one outcome audit', async () => {
  const { state, service, request } = setup();
  const result = await Promise.all([service.link(request), service.link(request)]);
  assert.deepEqual(result.map((item) => item.alreadyLinked).sort(), [false, true]);
  assert.equal(state.audit.length, 1); assert.equal(state.releases, 2);
});

test('another renewal cannot claim the same service and period; separate services remain possible', async () => {
  const other = { ...renewal, renewalId: 'R2', convertedContractId: 'NEW', serviceType: 'Pest control' };
  const first = setup([other]);
  await assert.rejects(first.service.link(first.request), /already linked to another renewal/);
  assert.equal(first.state.commits, 0);
  const second = setup([{ ...other, serviceType: 'Other service' }]);
  await second.service.link(second.request); assert.equal(second.state.commits, 1);
});

test('same period on different invoices is blocked only for the same premises', async () => {
  const otherTarget = { ...target, _id: 'SECOND', invoiceNumber: 'INV-2' };
  const other = { ...renewal, renewalId: 'R2', convertedContractId: 'SECOND',
    newContractStartDate: '2026-01-01', newContractEndDate: '2026-12-31' };
  const first = setup([other], [source, target, otherTarget]);
  await assert.rejects(first.service.link(first.request), /already linked to another renewal/);
  const second = setup([other], [source, target, { ...otherTarget, customerPremiseId: 'OTHER-SITE' }]);
  await second.service.link(second.request); assert.equal(second.state.commits, 1);
});

test('concurrent different renewals cannot claim the same service period', async () => {
  const { state, service, request } = setup([{ ...renewal, renewalId: 'R2' }]);
  const results = await Promise.allSettled([service.link(request), service.link({ ...request, renewalId: 'R2' })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(state.audit.length, 1);
});

test('read-only candidate search checks access and never updates records', async () => {
  const { state, service } = setup();
  await assert.rejects(service.list({ renewalId: 'R1', authorize: () => { throw new Error('Forbidden'); } }), /Forbidden/);
  const rows = await service.list({ renewalId: 'R1', authorize: () => {} });
  assert.equal(rows.length, 1); assert.equal(state.commits, 0); assert.equal(state.audit.length, 0);
  assert(state.queries.every((sql) => sql.startsWith('SELECT ')));
});

test('picker hides contracts already linked to another renewal through either link field', async () => {
  for (const field of ['convertedContractId', 'newContractId']) {
    const { state, service } = setup([{ ...renewal, renewalId: 'R2', [field]: 'NEW', renewalOutcome: 'WON' }]);
    const history = await service.list({ renewalId: 'R1', authorize: () => {} });
    assert.equal(history.some((item) => item.invoiceId === 'NEW'), false);
    assert.equal(state.commits, 0); assert.equal(state.audit.length, 0);
  }
});

test('picker retains unused services on shared invoices and contracts with their own pending letters', async () => {
  const first = setup([{ ...renewal, renewalId: 'R2', serviceType: 'Another service', convertedContractId: 'NEW', renewalOutcome: 'WON' }]);
  assert.equal((await first.service.list({ renewalId: 'R1', authorize: () => {} })).some((item) => item.invoiceId === 'NEW'), true);
  const second = setup([{ ...renewal, renewalId: 'R2', contractId: 'NEW', previousContractId: 'NEW', renewalLetterUrl: '/next-cycle.pdf' }]);
  assert.equal((await second.service.list({ renewalId: 'R1', authorize: () => {} })).some((item) => item.invoiceId === 'NEW'), true);
});

test('picker hides the previous contract but keeps this renewal own link for corrections', async () => {
  const { state, service, request } = setup();
  Object.assign(state.invoices[0], { invoiceNumber: 'OLD-INVOICE', servicePeriodStart: '2025-01-01', servicePeriodEnd: '2025-12-31' });
  assert.equal((await service.list({ renewalId: 'R1', authorize: () => {} })).some((item) => item.invoiceId === 'OLD'), false);
  await service.link(request);
  assert.equal((await service.list({ renewalId: 'R1', authorize: () => {} })).some((item) => item.invoiceId === 'NEW'), true);
});

test('picker hides duplicate service periods on different invoices at the same premises', async () => {
  const otherTarget = { ...target, _id: 'SECOND', invoiceNumber: 'INV-2' };
  const other = { ...renewal, renewalId: 'R2', convertedContractId: 'SECOND',
    newContractStartDate: '2026-01-01', newContractEndDate: '2026-12-31' };
  const { service } = setup([other], [source, target, otherTarget]);
  const history = await service.list({ renewalId: 'R1', authorize: () => {} });
  assert.equal(history.some((item) => item.invoiceId === 'NEW' || item.invoiceId === 'SECOND'), false);
});

test('discovery of an expired mismatched record does not bypass server-side link validation', async () => {
  const mismatch = { ...target, _id: 'WRONG-SITE', invoiceNumber: 'EXPIRED-OTHER-SITE', customerPremiseId: 'OTHER',
    items: [{ ...target.items[0], contractEndDate: '2026-06-30' }] };
  const { state, service, request } = setup([], [source, target, mismatch]);
  const history = await service.list({ renewalId: 'R1', authorize: () => {} });
  const record = history.find((item) => item.invoiceNumber === mismatch.invoiceNumber);
  assert.equal(record.eligible, false);
  await assert.rejects(service.link({ ...request, body: { ...request.body, invoiceId: record.invoiceId, candidateKey: record.key } }), /no longer matches/);
  assert.equal(state.commits, 0); assert.equal(state.audit.length, 0);
});

test('stale invoice, lost renewal, forged selection and invalid date fail without changes', async () => {
  for (const variant of ['stale', 'lost', 'forged', 'date']) {
    const { state, service, request } = setup();
    if (variant === 'stale') state.invoices[1].total = 500;
    if (variant === 'lost') state.rows[0].renewalOutcome = 'LOST';
    if (variant === 'forged') request.body.invoiceId = 'OTHER';
    if (variant === 'date') request.body.agreementDate = '2026-02-30';
    await assert.rejects(service.link(request)); assert.equal(state.commits, 0); assert.equal(state.audit.length, 0);
    assert.equal(state.rows[0].convertedContractId, undefined);
  }
});

test('permission is checked again under lock; audit failure rolls back the update', async () => {
  const first = setup(); let calls = 0;
  first.request.authorize = () => { if (++calls === 2) throw new Error('Permission changed'); };
  await assert.rejects(first.service.link(first.request), /Permission changed/); assert.equal(first.state.commits, 0);
  const second = setup(); second.state.auditError = true;
  await assert.rejects(second.service.link(second.request), /Audit unavailable/);
  assert.equal(second.state.rows[0].convertedContractId, undefined); assert.equal(second.state.rollbacks, 1);
});

test('correction requires manager permission and a reason; generated links cannot be silently replaced', async () => {
  const { state, service, request } = setup(); await service.link(request);
  const correction = { ...request, body: { ...request.body, agreementDate: '2025-12-21', correctLink: true, notes: 'Correct agreement date' } };
  await assert.rejects(service.link(correction), /Only a manager/);
  await assert.rejects(service.link({ ...correction, canCorrect: true, body: { ...correction.body, notes: '' } }), /reason/);
  await service.link({ ...correction, canCorrect: true });
  assert.equal(state.audit[1].action, 'renewal_correct_existing_link'); assert.equal(state.audit[1].previousValue.existingRenewalLink.agreementDate, '2025-12-20');
  const generated = setup(); generated.state.rows[0].convertedContractId = 'GENERATED';
  await assert.rejects(generated.service.link({ ...generated.request, canCorrect: true, body: { ...generated.request.body, correctLink: true, notes: 'Try replacement' } }), /already has a linked contract/);
});
