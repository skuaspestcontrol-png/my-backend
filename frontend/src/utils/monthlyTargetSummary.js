// Defaults use the CRM's India timezone; sales totals remain authoritative API values.
export const getIndiaMonthPeriod = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit'
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value)
  };
};

const finiteAmount = (value) => {
  if (value === null || value === undefined || value === '' || !['number', 'string'].includes(typeof value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getMonthlyTargetSummary = (summary) => {
  const target = finiteAmount(summary?.totalMonthlyTarget);
  const achieved = finiteAmount(summary?.totalMonthlyAchieved);
  if (target === null || achieved === null || target < 0) throw new Error('Monthly sales data is unavailable.');
  const count = finiteAmount(summary?.monthlyTargetCount);
  const hasCount = count !== null && Number.isInteger(count) && count >= 0;
  const targetConfigured = hasCount ? count > 0 : target > 0;
  const configurationKnown = hasCount || target > 0;
  // Match salesPerformanceRoutes.percent, including its existing rounding convention.
  const rawPercentage = target > 0 ? Math.round((achieved / target) * 1000) / 10 : null;
  const achievementPercent = Number.isFinite(rawPercentage) ? rawPercentage : null;
  return {
    target, achieved, targetConfigured, configurationKnown,
    pending: targetConfigured ? Math.max(0, target - achieved) : null,
    overachievement: targetConfigured && target > 0 ? Math.max(0, achieved - target) : 0,
    achievementPercent: targetConfigured ? achievementPercent : null,
    progress: targetConfigured && achievementPercent !== null ? Math.min(100, Math.max(0, achievementPercent)) : 0
  };
};

export const formatMonthlyTargetCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);
