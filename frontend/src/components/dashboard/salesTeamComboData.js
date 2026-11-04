import { formatRupees } from '../../utils/currencyDisplay.js';
export const SALES_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function finiteSalesValue(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Same rule and one-decimal rounding as salesPerformanceRoutes.percent; no cap.
export function crmAchievementPercent(achieved, target) {
  const actual = finiteSalesValue(achieved), plan = finiteSalesValue(target);
  if (actual === null || plan === null) return null;
  return plan <= 0 ? 0 : Math.round((actual / plan) * 1000) / 10;
}

export function prepareSalesComboTrend(trend = []) {
  const source = Array.isArray(trend) ? trend : [];
  const invalidMonth = source.some(row => !Number.isInteger(Number(row?.month)) || Number(row.month) < 1 || Number(row.month) > 12);
  const months = SALES_MONTHS.map((name, index) => {
    const entries = source.filter(row => Number(row?.month) === index + 1);
    const duplicate = entries.length > 1, row = entries.length === 1 ? entries[0] : null;
    const target = finiteSalesValue(row?.target), achieved = finiteSalesValue(row?.achieved);
    const complete = target !== null && achieved !== null;
    const reportedRate = finiteSalesValue(row?.achievementPercent);
    return { month: index + 1, name, label: name.slice(0, 3), target, achieved,
      achievementPercent: complete ? (reportedRate ?? crmAchievementPercent(achieved, target)) : null,
      nonPositiveTarget: complete && target <= 0, duplicate,
      note: duplicate ? 'Conflicting month records; values unavailable.' : !row ? 'Month not supplied by the API.' : !complete ? 'Missing or invalid amount; unavailable values are not zero.' : target <= 0 ? 'CRM reports 0% for a non-positive target; a target ratio is not defined.' : '' };
  });
  return { months, invalidMonth, duplicate: months.some(row => row.duplicate),
    complete: !invalidMonth && months.every(row => row.target !== null && row.achieved !== null && !row.duplicate),
    targetMonths: months.filter(row => row.target !== null).length, achievedMonths: months.filter(row => row.achieved !== null).length };
}

// Reuse the caller's existing totals; never substitute the separate annual-target summary.
export function salesComboTotals(prepared, target, achieved) {
  const ambiguous = prepared.invalidMonth || prepared.duplicate;
  const totalTarget = ambiguous || !prepared.targetMonths ? null : finiteSalesValue(target);
  const totalAchieved = ambiguous || !prepared.achievedMonths ? null : finiteSalesValue(achieved);
  const complete = prepared.complete && totalTarget !== null && totalAchieved !== null;
  return { target: totalTarget, achieved: totalAchieved, complete,
    achievementPercent: complete ? crmAchievementPercent(totalAchieved, totalTarget) : null,
    variance: complete ? totalAchieved - totalTarget : null };
}

export function comboAxisDomain(values, percent = false) {
  const finite = values.map(finiteSalesValue).filter(value => value !== null);
  const min = Math.min(0, ...finite), max = Math.max(percent ? 100 : finite.some(value => value !== 0) ? 1 : 1000, ...finite);
  return [min < 0 ? min - Math.abs(min) * 0.1 : 0, max + Math.abs(max) * 0.1];
}
export const exactSalesMoney = value => finiteSalesValue(value) === null ? 'Unavailable' : formatRupees(value);
export const exactSalesPercent = value => finiteSalesValue(value) === null ? 'Unavailable' : `${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 20 })}%`;
