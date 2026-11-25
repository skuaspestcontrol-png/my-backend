import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRenewalSalesPeople, buildRenewalFilterParams, mergeRenewalSalesAssignments } from './renewalFilters.js';
const employees = [
  { _id: 'ext-a', id: 21, empCode: 'EMP-21', firstName: 'Mohd', lastName: 'Shahrukh', role: 'Sales' },
  { _id: 'ext-b', empCode: 'EMP-22', fullName: 'Another Sales', role: 'Sales Manager' },
  { _id: 'tech', firstName: 'Technician', role: 'Technician' }
];
test('sales identity includes employee ID, database ID and employee code while deduplicating legacy options', () => {
  const people = buildRenewalSalesPeople(employees, [
    { assignedSalesPersonId: 'EMP-21', assignedSalesPersonName: 'Mohd Shahrukh' },
    { assignedSalesPersonName: ' MOHD   SHAHRUKH ' },
    { assignedSalesPersonId: 'former', assignedSalesPersonName: 'Former Sales' }
  ]);
  assert.equal(people.length, 3);
  assert.deepEqual(people[0].ids, ['ext-a', 'EMP-21', '21']);
  assert.equal(people[0].matchName, 'Mohd Shahrukh');
  const params = buildRenewalFilterParams({ assignedSalesPersonId: 'ext-a', month: 'all', year: 2026 }, people);
  assert.equal(params.assignedSalesPersonName, 'Mohd Shahrukh');
  assert.deepEqual(JSON.parse(params.assignedSalesPersonIds), people[0].ids);
});
test('different employees sharing a name remain separate without guessing name-only ownership', () => {
  const people = buildRenewalSalesPeople([...employees, { _id: 'other-a', fullName: 'Mohd Shahrukh', role: 'Sales' }], []);
  assert.equal(people.length, 3);
  assert.equal(people[0].matchName, '');
  assert.notEqual(people[0].label, people[2].label);
});
test('assignment choices survive empty filtered results and repeated responses', () => {
  const previous = mergeRenewalSalesAssignments([], [{ assignedSalesPersonId: 'former', assignedSalesPersonName: 'Former Sales' }]);
  assert.deepEqual(mergeRenewalSalesAssignments(previous, []), previous);
  assert.equal(mergeRenewalSalesAssignments(previous, previous).length, 1);
});
test('clearing Sales Person clears all aliases; other filters are forwarded unchanged', () => {
  const params = buildRenewalFilterParams({ assignedSalesPersonId: '', search: 'client', searchScope: 'customer', range: 'custom', month: 6, year: 2026 }, buildRenewalSalesPeople(employees));
  assert.equal(params.assignedSalesPersonName, ''); assert.equal(params.assignedSalesPersonIds, '[]');
  assert.equal(params.searchScope, 'customer'); assert.equal(params.month, 6); assert.equal(params.search, 'client');
});
test('report drilldown aliases resolve to the same canonical salesperson and filter set', () => {
  const people = buildRenewalSalesPeople(employees);
  for (const assignedSalesPersonId of ['EMP-21', '21', 'Mohd Shahrukh']) {
    const params = buildRenewalFilterParams({ assignedSalesPersonId }, people);
    assert.equal(params.assignedSalesPersonId, 'ext-a');
    assert.equal(params.assignedSalesPersonName, 'Mohd Shahrukh');
  }
});
