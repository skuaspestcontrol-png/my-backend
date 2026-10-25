import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMonthlyTargetCurrency, getIndiaMonthPeriod, getMonthlyTargetSummary } from './monthlyTargetSummary.js';
const summarize = (target, achieved, count = 1) => getMonthlyTargetSummary({ totalMonthlyTarget: target, totalMonthlyAchieved: achieved, monthlyTargetCount: count });

test('monthly target formulas handle no sales, below, exact and overachievement', () => {
  for (const [achieved, pending, percent, over, progress] of [[0, 100000, 0, 0, 0], [25000, 75000, 25, 0, 25], [100000, 0, 100, 0, 100], [150000, 0, 150, 50000, 100]]) {
    const result = summarize(100000, achieved);
    assert.equal(result.pending, pending);
    assert.equal(result.achievementPercent, percent);
    assert.equal(result.overachievement, over);
    assert.equal(result.progress, progress);
  }
});
test('missing target preserves actual sales without invented target, pending or percentage', () => {
  const result = summarize(0, 50000, 0);
  assert.equal(result.targetConfigured, false);
  assert.equal(result.configurationKnown, true);
  assert.equal(result.achieved, 50000);
  assert.equal(result.pending, null);
  assert.equal(result.achievementPercent, null);
  assert.equal(result.overachievement, 0);
});
test('an explicitly configured zero target has zero pending and no division', () => {
  for (const achieved of [0, 10000]) {
    const result = summarize(0, achieved);
    assert.equal(result.targetConfigured, true);
    assert.equal(result.pending, 0);
    assert.equal(result.achievementPercent, null);
    assert.equal(result.progress, 0);
  }
});
test('older API metadata is handled honestly, without labelling unknown zero as configured or missing', () => {
  assert.equal(getMonthlyTargetSummary({ totalMonthlyTarget: 100, totalMonthlyAchieved: 50 }).targetConfigured, true);
  const unknown = getMonthlyTargetSummary({ totalMonthlyTarget: 0, totalMonthlyAchieved: 50 });
  assert.equal(unknown.configurationKnown, false);
  assert.equal(unknown.pending, null);
});
test('missing or invalid financial data fails rather than presenting fabricated zeroes', () => {
  for (const summary of [null, {}, { totalMonthlyTarget: null, totalMonthlyAchieved: 10 }, { totalMonthlyTarget: 20, totalMonthlyAchieved: '' }, { totalMonthlyTarget: 'invalid', totalMonthlyAchieved: 10 }, { totalMonthlyTarget: -1, totalMonthlyAchieved: 0 }, { totalMonthlyTarget: Infinity, totalMonthlyAchieved: 10 }]) {
    assert.throws(() => getMonthlyTargetSummary(summary));
  }
});
test('finite decimal currency strings preserve INR precision and percentages', () => {
  const result = summarize('125000.50', '50000.20');
  assert.equal(result.achievementPercent, 40);
  assert.equal(result.pending, 75000.3);
  assert.equal(formatMonthlyTargetCurrency(12345678.9), '₹1,23,45,678.90');
});
test('India defaults cross December to January independently of the browser timezone', () => {
  assert.deepEqual(getIndiaMonthPeriod(new Date('2026-12-31T18:29:59Z')), { year: 2026, month: 12 });
  assert.deepEqual(getIndiaMonthPeriod(new Date('2026-12-31T18:30:00Z')), { year: 2027, month: 1 });
  assert.deepEqual(getIndiaMonthPeriod(new Date('2026-10-31T18:30:00Z')), { year: 2026, month: 11 });
});

test('monthly percentages match the API decimal rounding convention, including halfway values', () => {
  for (const [target, achieved, expected] of [
    [100000, 450, 0.5],
    [100000, 449, 0.4],
    [100000, 451, 0.5],
    [100000, 12345, 12.3],
    [100000, 12350, 12.4],
    [100000, 150050, 150.1],
    // Preserve the existing API's binary floating-point behaviour at a decimal tie.
    [100, 1.45, 1.4]
  ]) {
    const result = summarize(target, achieved);
    assert.equal(result.achievementPercent, expected);
    assert.equal(result.achievementPercent.toLocaleString('en-IN', { maximumFractionDigits: 1 }), String(expected));
    assert.equal(result.target, target);
    assert.equal(result.achieved, achieved);
    assert.equal(result.pending, Math.max(0, target - achieved));
    assert.equal(result.progress, Math.min(100, expected));
  }
});

test('percentage rounding never invents progress for missing or zero targets', () => {
  for (const [target, count] of [[0, 0], [0, 1]]) {
    const result = summarize(target, 450, count);
    assert.equal(result.achievementPercent, null);
    assert.equal(result.progress, 0);
    assert.equal(result.pending, count ? 0 : null);
    assert.equal(result.achieved, 450);
  }
});
