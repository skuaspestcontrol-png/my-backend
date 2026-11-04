import test from 'node:test';
import assert from 'node:assert/strict';
import { finiteSalesValue, crmAchievementPercent, prepareSalesComboTrend, salesComboTotals, comboAxisDomain, exactSalesMoney } from './salesTeamComboData.js';
const year = () => Array.from({ length: 12 }, (_, index) => ({ month: index + 1, target: 100, achieved: 150, achievementPercent: 150 }));
test('monthly percentages match CRM one-decimal definition without capping', () => {
  assert.equal(crmAchievementPercent(123, 400), 30.8);
  assert.equal(crmAchievementPercent(250, 100), 250);
  assert.equal(crmAchievementPercent(-25, 100), -25);
  for (const target of [0, -100]) assert.equal(crmAchievementPercent(100, target), 0);
});
test('missing, invalid and boolean amounts are not silently zero', () => {
  for (const value of [null, undefined, '', ' ', NaN, Infinity, 'bad', false, [], {}]) assert.equal(finiteSalesValue(value), null);
  assert.equal(finiteSalesValue('0'), 0);
  assert.equal(crmAchievementPercent(null, 100), null);
  assert.equal(crmAchievementPercent(20, null), null);
});
test('twelve calendar months retain gaps and supplied API percentage precision', () => {
  const data = prepareSalesComboTrend([{ month: 2, target: 100, achieved: 30, achievementPercent: 31.2 }, { month: 3, target: 100, achieved: null, achievementPercent: 0 }]);
  assert.equal(data.months.length, 12);
  assert.equal(data.months[0].target, null);
  assert.equal(data.months[1].achievementPercent, 31.2);
  assert.equal(data.months[2].achieved, null);
  assert.equal(data.months[2].achievementPercent, null);
  assert.equal(data.complete, false);
});
test('explicit zero and negative adjustments remain available and convention is labelled', () => {
  const data = prepareSalesComboTrend([{ month: 1, target: 0, achieved: 40, achievementPercent: 0 }, { month: 2, target: -10, achieved: -30, achievementPercent: 0 }, { month: 3, target: 100, achieved: -25 }]);
  assert.equal(data.months[0].target, 0);
  assert.equal(data.months[0].achievementPercent, 0);
  assert.equal(data.months[0].nonPositiveTarget, true);
  assert.equal(data.months[1].target, -10);
  assert.equal(data.months[1].achieved, -30);
  assert.equal(data.months[2].achievementPercent, -25);
});
test('existing caller totals are reused, never replaced with employee annual summaries', () => {
  const result = salesComboTotals(prepareSalesComboTrend(year()), 1200, 1800);
  assert.deepEqual(result, { target: 1200, achieved: 1800, complete: true, achievementPercent: 150, variance: 600 });
});
test('partial plans withhold aggregate rate and variance while flagging incomplete totals', () => {
  const result = salesComboTotals(prepareSalesComboTrend(year().slice(0, 2)), 200, 300);
  assert.equal(result.target, 200);
  assert.equal(result.achieved, 300);
  assert.equal(result.complete, false);
  assert.equal(result.achievementPercent, null);
  assert.equal(result.variance, null);
  assert.equal(salesComboTotals(prepareSalesComboTrend([]), 0, 0).target, null);
});
test('duplicate or out-of-range months are not merged into invented monthly totals', () => {
  for (const rows of [[...year(), { month: 1, target: 400, achieved: 300 }], [...year(), { month: 13, target: 400, achieved: 300 }]]) {
    const prepared = prepareSalesComboTrend(rows), result = salesComboTotals(prepared, 1600, 2100);
    assert.equal(prepared.complete, false);
    assert.equal(result.target, null);
    assert.equal(result.achieved, null);
  }
});
test('axis bounds include negative amounts and rates well above 100 percent', () => {
  const money = comboAxisDomain([-500, 1000, null]);
  assert(money[0] < -500 && money[1] > 1000);
  const rate = comboAxisDomain([-125, 725], true);
  assert(rate[0] < -125 && rate[1] > 725);
  assert(comboAxisDomain([0, 0])[1] >= 1000);
});
test('rupee displays use whole amounts and Indian grouping without changing source precision', () => {
  assert.equal(exactSalesMoney(123456.78), '₹1,23,457');
  assert.equal(exactSalesMoney(-123456.78), '-₹1,23,457');
  assert.equal(exactSalesMoney(357986.47000000003), '₹3,57,986');
  assert.equal(exactSalesMoney('357986.47000000003'), '₹3,57,986');
  assert.equal(exactSalesMoney(0), '₹0');
  assert.equal(exactSalesMoney(null), 'Unavailable');
  const prepared = prepareSalesComboTrend([{ month: 7, target: 450000, achieved: 357986.47000000003 }]);
  assert.equal(prepared.months[6].achieved, 357986.47000000003);
  assert.equal(prepared.months[6].achievementPercent, 79.6);
});
