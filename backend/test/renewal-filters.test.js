const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const parseDateOnly = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0); return date;
};
const addMonthsClamped = (value, count) => {
  const date = new Date(value), day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + count);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())); return date;
};
const start = source.indexOf('const applyRenewalFilters =');
const end = source.indexOf('const summarizeRenewals =', start);
const filter = new Function('parseDateOnly', 'addMonthsClamped', 'normalizeRenewalRelationshipType', 'normalizeRenewalDurationUnit', 'toNumber', `${source.slice(start, end)}; return applyRenewalFilters;`)(parseDateOnly, addMonthsClamped, value => String(value || '').toUpperCase(), value => String(value || '').toUpperCase(), (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback);
const base = { renewalId: 'R1', renewalDueDate: '2026-06-30', customerName: 'Client Alpha', mobile: '9876543210', serviceType: 'Termite', serviceRelationshipType: 'CONTRACT', contractDurationValue: 2, contractDurationUnit: 'YEAR', status: 'Overdue', assignedSalesPersonId: 'ext-a', assignedSalesPersonName: 'Mohd Shahrukh', lastFollowupNote: 'Call next week', followupDate: '2026-06-20' };
const ids = (rows) => rows.map(row => row.renewalId);
const assigned = { assignedSalesPersonId: 'ext-a', assignedSalesPersonName: 'Mohd Shahrukh', assignedSalesPersonIds: '["ext-a","EMP-21","21"]' };
test('sales filter includes canonical, employee-code and name-only assignments but excludes conflicting IDs', () => {
  const rows = [base, { ...base, renewalId: 'code', assignedSalesPersonId: 'EMP-21' }, { ...base, renewalId: 'legacy', assignedSalesPersonId: '', assignedSalesPersonName: ' mohd   SHAHRUKH ' }, { ...base, renewalId: 'wrong', assignedSalesPersonId: 'ext-b' }];
  assert.deepEqual(ids(filter(rows, assigned)), ['R1', 'code', 'legacy']);
  assert.deepEqual(ids(filter(rows, {})), ['R1', 'code', 'legacy', 'wrong']);
});
test('old name-only query stays supported; malformed aliases cannot remove the chosen ID', () => {
  assert.equal(filter([{ ...base, assignedSalesPersonId: '' }], { assignedSalesPersonId: 'Mohd Shahrukh' }).length, 1);
  assert.equal(filter([base], { assignedSalesPersonId: 'ext-a', assignedSalesPersonIds: 'bad JSON' }).length, 1);
});
test('all search scopes search only their intended fields', () => {
  for (const [searchScope, search] of Object.entries({ all: 'Termite', customer: 'ALPHA', mobile: '7654', service: 'termite', salesPerson: 'shahrukh', status: 'overdue', renewalId: 'R1', followup: 'next week' })) {
    assert.equal(filter([base], { searchScope, search }).length, 1, searchScope);
  }
  assert.equal(filter([base], { searchScope: 'mobile', search: 'Alpha' }).length, 0);
  assert.equal(filter([base], { searchScope: 'salesPerson', search: 'Alpha' }).length, 0);
});
test('month/year, yearly range and explicit date bounds combine with salesperson filtering', () => {
  const rows = [base, { ...base, renewalId: 'July', renewalDueDate: '2026-07-01' }, { ...base, renewalId: 'old', renewalDueDate: '2025-06-30' }, { ...base, renewalId: 'missing', renewalDueDate: '' }];
  assert.deepEqual(ids(filter(rows, { ...assigned, range: 'custom', year: 2026, month: 6 })), ['R1']);
  assert.deepEqual(ids(filter(rows, { range: 'year', year: 2026, month: 6 })), ['R1', 'July']);
  assert.deepEqual(ids(filter(rows, { fromDate: '2026-06-30', toDate: '2026-06-30' })), ['R1']);
  assert.equal(filter(rows, {}).length, 4, 'unfiltered API keeps all years and undated rows');
});
test('relative Range presets override a stale custom month and year', () => {
  const now = parseDateOnly(new Date());
  const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const current = { ...base, renewalId: 'current', renewalDueDate: key(now) };
  const next = { ...base, renewalId: 'next', renewalDueDate: key(new Date(now.getFullYear(), now.getMonth()+1, 1)) };
  const past = { ...base, renewalId: 'past', renewalDueDate: key(new Date(now.getFullYear(), now.getMonth()-1, 1)) };
  const rows = [past, current, next];
  assert.deepEqual(ids(filter(rows, { range: 'thisMonth', month: 1, year: 1999 })), ['current']);
  assert.deepEqual(ids(filter(rows, { range: 'nextMonth', month: 1, year: 1999 })), ['next']);
  assert.deepEqual(ids(filter(rows, { range: 'threeMonths', month: 1, year: 1999 })), ['current', 'next']);
});
test('relationship, duration, service and status filters intersect without losing legacy Won/Lost', () => {
  const rows = [base, { ...base, renewalId: 'won', status: 'Done' }, { ...base, renewalId: 'lost', status: 'Declined' }, { ...base, renewalId: 'job', serviceRelationshipType: 'ONE_TIME', contractDurationValue: 1 }];
  assert.deepEqual(ids(filter(rows, { relationshipType: 'ONE_TIME' })), ['job']);
  assert.deepEqual(ids(filter(rows, { duration: '1_year' })), ['job']);
  assert.equal(filter(rows, { duration: '2_years', relationshipType: 'CONTRACT', serviceType: 'TERMITE' }).length, 3);
  assert.deepEqual(ids(filter(rows, { status: 'Won' })), ['won']);
  assert.deepEqual(ids(filter(rows, { status: 'Lost' })), ['lost']);
  assert.deepEqual(ids(filter(rows, { searchScope: 'status', search: 'won' })), ['won']);
});

function route(method, name, dependencies) {
  const begin = source.indexOf(`app.${method}('${name}'`), finish = source.indexOf('\napp.', begin+1);
  let handler;
  new Function('app', ...Object.keys(dependencies), source.slice(begin, finish))({ [method]: (_url, fn) => { handler = fn; } }, ...Object.values(dependencies));
  return handler;
}
test('letters beyond the old 200-row cap use current sales, duration and followup fields before filtering', async () => {
  const current = { ...base, renewalId: 'late-match', previousContractEnd: base.renewalDueDate };
  let sql = '';
  const handler = route('get', '/api/renewals/letters', {
    canUseMysql: () => true, loadRenewalRows: async () => [current],
    withMysqlConnection: async fn => fn({ query: async query => { sql = query; return [Array.from({ length: 205 }, (_, index) => ({ id: index, renewal_id: index===204 ? 'late-match' : `other-${index}`, contract_end_date: '2025-01-01' }))]; } }),
    ensureRenewalTables: async () => {}, parseMysqlPayloadObject: () => ({}), renewalUiStatus: x => x, renewalCleanStatus: x => x, toNumber: (value, fallback) => Number(value || fallback), applyRenewalFilters: filter
  });
  let result;
  await handler({ query: { ...assigned, range:'custom', year:2026, month:6, duration:'2_years', searchScope:'followup', search:'next week' } }, { json: value => { result=value; }, status: () => { throw Error('Unexpected route error'); } });
  assert.doesNotMatch(sql, /LIMIT\s+200/i);
  assert.deepEqual(ids(result), ['late-match']);
  assert.equal(result[0].lastFollowupNote, base.lastFollowupNote);
});
test('displayed renewal records take precedence over letter snapshots when merging filtered results', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/RenewalDashboard.jsx'), 'utf8');
  const begin = frontend.indexOf('  const mergedVisibleRows = useMemo(() => {');
  const finish = frontend.indexOf('  }, [rows, visibleLetterRows]);', begin);
  const body = frontend.slice(begin, finish).split('useMemo(() => {')[1];
  const merge = new Function('rows', 'visibleLetterRows', body);
  const [record] = merge([{ ...base, proposedAmount:15000 }], [{ ...base, status:'Declined', assignedSalesPersonName:'Old assignment', proposedAmount:999 }]);
  assert.equal(record.status, 'Overdue');
  assert.equal(record.assignedSalesPersonName, 'Mohd Shahrukh');
  assert.equal(record.proposedAmount, 15000);
});
test('Reset skips a redundant search refresh only when the search dependencies actually change', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/RenewalDashboard.jsx'), 'utf8');
  const begin = frontend.indexOf('  const resetFilters =');
  const finish = frontend.indexOf('  const isFinalRow', begin);
  for (const search of ['', 'Client Alpha']) {
    const skipNextSearchSyncRef = { current:false }; let applied;
    const reset = new Function('filters', 'currentYear', 'setPage', 'skipNextSearchSyncRef', 'setFilters', 'loadData', frontend.slice(begin,finish)+';return resetFilters;')({ search, searchScope:'all', assignedSalesPersonId:'ext-a' },2026,()=>{},skipNextSearchSyncRef,()=>{},value=>{applied=value;});
    reset();
    assert.equal(skipNextSearchSyncRef.current, Boolean(search));
    assert.equal(applied.assignedSalesPersonId, '');
    assert.equal(applied.search, '');
  }
});
test('having a saved letter does not turn Review or Recurring results into renewal contracts', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/RenewalDashboard.jsx'), 'utf8');
  const begin = frontend.indexOf('const isLetterRow =');
  const finish = frontend.indexOf('const addMonthsClampedInput', begin);
  const isContract = new Function('jobbingContractPeriods', frontend.slice(begin,finish)+';return isRenewalContractSummaryRow;')(new Set(['single_time']));
  assert.equal(Boolean(isContract({ ...base, renewalEligible:true, pdf_url:'/qa.pdf' })), true);
  for (const serviceRelationshipType of ['NEEDS_REVIEW', 'RECURRING', 'ONE_TIME']) {
    assert.equal(Boolean(isContract({ ...base, serviceRelationshipType, renewalEligible:false, pdf_url:'/qa.pdf' })), false);
  }
});
