const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/RenewalDashboard.jsx'), 'utf8');
const names = ['parseDateOnly', 'formatDateInput', 'addMonthsClamped', 'addDays', 'inclusiveDaysBetween', 'contractDurationLabel', 'buildContractEndDate', 'deriveInvoiceContractWindow', 'deriveRenewalDuration', 'calculateRenewalContractEndDate', 'renewalLetterDates', 'enrichRenewalsWithCurrentContractWindows'];
const declarations = names.map((name) => {
  const start = source.indexOf(`const ${name} =`);
  assert(start >= 0);
  return source.slice(start, source.indexOf('\n};', start) + 3);
}).join('\n');
const { dates, iso, enrich } = new Function('contractPeriodConfig', 'normalizeRenewalDurationUnit', 'renewalCleanStatus', 'computeRenewalStatus', 'renewalUiStatus', `${declarations}; return { dates: renewalLetterDates, iso: formatDateInput, enrich: enrichRenewalsWithCurrentContractWindows };`)({ half_yearly: { unit: 'months', value: 6 } }, (unit) => unit || 'MONTH', (status) => status, () => 'OVERDUE', (status) => status);
const previous = { previousContractStart: '2025-07-24', previousContractEnd: '2026-01-23', contractDurationValue: 6, contractDurationUnit: 'MONTH' };

test('Education Today six-month renewal follows the inclusive previous expiry', () => {
  const result = dates(previous);
  assert.equal(iso(result.previousEnd), '2026-01-23');
  assert.equal(iso(result.start), '2026-01-24');
  assert.equal(iso(result.end), '2026-07-23');
  assert.equal(result.duration, '6 months');
  assert.equal(previous.previousContractEnd, '2026-01-23');
});

test('stale renewal expiry uses the current source invoice without rewriting either record', () => {
  const stored = { ...previous, contractId: 'EDUCATION', previousContractEnd: '2026-01-24' };
  const invoice = { _id: 'EDUCATION', items: [{ contractStartDate: '2025-07-24', contractEndDate: '2026-01-23', contractPeriod: 'half_yearly' }] };
  const [current] = enrich([stored], [invoice]);
  assert.equal(current.previousContractEnd, '2026-01-23');
  assert.equal(current.renewalDueDate, '2026-01-23');
  assert.equal(iso(dates(current).start), '2026-01-24');
  assert.equal(stored.previousContractEnd, '2026-01-24');
  assert.equal(invoice.items[0].contractEndDate, '2026-01-23');
});

test('existing linked agreement dates take precedence over proposed contiguous dates', () => {
  const result = dates({ ...previous, newContractStartDate: '2026-01-23', newContractEndDate: '2026-07-22' });
  assert.equal(iso(result.start), '2026-01-23');
  assert.equal(iso(result.end), '2026-07-22');
});

test('missing duration is inferred and month-end and leap-day renewals remain inclusive', () => {
  assert.equal(iso(dates({ previousContractStart: '2025-07-24', previousContractEnd: '2026-01-23' }).end), '2026-07-23');
  const result = dates({ previousContractStart: '2024-01-01', previousContractEnd: '2024-01-30', contractDurationValue: 1, contractDurationUnit: 'MONTH' });
  assert.equal(iso(result.start), '2024-01-31');
  assert.equal(iso(result.end), '2024-02-28');
  assert.equal(iso(dates({ ...previous, contractDurationValue: 10, contractDurationUnit: 'DAY' }).end), '2026-02-02');
});

test('missing or reversed contract periods are rejected before PDF generation', () => {
  assert.throws(() => dates({}), /Valid previous contract dates/);
  assert.throws(() => dates({ ...previous, previousContractEnd: '2025-01-01' }), /Valid previous contract dates/);
  assert.throws(() => dates({ ...previous, newContractStartDate: '2026-07-24', newContractEndDate: '2026-01-23' }), /Valid renewal contract dates/);
});

test('PDF generation uses the same invoice enrichment as the dashboard before computing dates', () => {
  const start = source.indexOf("app.post('/api/renewals/:id/generate-letter'");
  const block = source.slice(start, source.indexOf('\napp.', start + 1));
  assert.match(block, /enrichRenewalsWithConvertedContractPeriods\(enrichRenewalsWithCurrentContractWindows\(\[renewal\], invoices\), invoices\)/);
  assert(block.indexOf('renewalLetterDates(renewal)') < block.indexOf('fs.createWriteStream'));
  assert.match(block, /previous contract for/);
  assert.match(block, /proposed renewal is for/);
  assert.doesNotMatch(block, /over the past year/);
});

test('Letter Date cells show issue timestamps and preserve them when rows are merged', () => {
  assert.match(frontend, /generated_at: next.generated_at \|\| next.generatedAt \|\| existing.generated_at \|\| existing.generatedAt/);
  assert.match(frontend, /formatDate\(row.generated_at \|\| row.generatedAt\)/);
  assert.match(frontend, /formatDate\(letter.generated_at \|\| letter.generatedAt\)/);
  assert.doesNotMatch(frontend, /formatDate\((?:row|letter).conclude_date/);
});
