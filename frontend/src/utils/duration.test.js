import assert from 'node:assert/strict';
import test from 'node:test';

import { decimalHoursToMinutes, formatDurationHours } from './duration.js';

test('formatDurationHours converts decimal hours to human-readable hours and minutes', () => {
  assert.equal(formatDurationHours(9.1666667), '9h 10m');
  assert.equal(formatDurationHours(9.17), '9h 10m');
  assert.equal(formatDurationHours(7.8333333), '7h 50m');
  assert.equal(formatDurationHours(8), '8h');
  assert.equal(formatDurationHours(1.1666667), '1h 10m');
  assert.equal(formatDurationHours(2.5), '2h 30m');
  assert.equal(formatDurationHours(0.5), '30m');
  assert.equal(formatDurationHours(0), '0h');
});

test('formatDurationHours handles floating point minute rollover without 60m output', () => {
  assert.equal(decimalHoursToMinutes(59.999 / 60), 60);
  assert.equal(formatDurationHours(59.999 / 60), '1h');
});
