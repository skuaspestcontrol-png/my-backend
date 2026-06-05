const WEEKDAY_LABELS = [
  { value: '0', short: 'Sun', label: 'Sunday' },
  { value: '1', short: 'Mon', label: 'Monday' },
  { value: '2', short: 'Tue', label: 'Tuesday' },
  { value: '3', short: 'Wed', label: 'Wednesday' },
  { value: '4', short: 'Thu', label: 'Thursday' },
  { value: '5', short: 'Fri', label: 'Friday' },
  { value: '6', short: 'Sat', label: 'Saturday' }
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' }
];

const REPEAT_UNIT_OPTIONS = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
  { value: 'years', label: 'years' }
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SERVICE_FREQUENCY_ALIASES = {
  fortnightly_visits: { frequency: 'fortnightly' },
  quarterly_visits: { frequency: 'quarterly' },
  annual: { frequency: 'yearly' },
  bi_monthly: { frequency: 'custom', repeatEvery: 2, repeatUnit: 'months' },
  three_treatment_every_4_months: { frequency: 'custom', repeatEvery: 4, repeatUnit: 'months' },
  initial_spray_gel_batting_7_then_4m: { frequency: 'custom', repeatEvery: 4, repeatUnit: 'months' },
  single_followup_7: { frequency: 'custom', repeatEvery: 7, repeatUnit: 'days' },
  single_followup_10: { frequency: 'custom', repeatEvery: 10, repeatUnit: 'days' },
  initial_treatment_one_year_warranty: { frequency: 'single_once' },
  initial_treatment_two_year_warranty: { frequency: 'single_once' },
  initial_treatment_three_year_warranty: { frequency: 'single_once' },
  single_treatment_no_followup: { frequency: 'single_once' }
};

const normalizeServiceScheduleFrequencyConfig = (value, repeatEvery, repeatUnit) => {
  const raw = String(value || '').trim().toLowerCase();
  const alias = SERVICE_FREQUENCY_ALIASES[raw];
  if (alias) {
    return {
      frequency: alias.frequency,
      repeatEvery: Math.max(1, Number(alias.repeatEvery || repeatEvery || 1)),
      repeatUnit: String(alias.repeatUnit || repeatUnit || 'weeks').toLowerCase()
    };
  }
  return {
    frequency: raw,
    repeatEvery: Math.max(1, Number(repeatEvery || 1)),
    repeatUnit: String(repeatUnit || 'weeks').toLowerCase()
  };
};

const normalizeDateOnly = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const parseDateOnly = (value) => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeServiceScheduleTime = (value, fallback = '10:00') => {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
};

export const normalizeServiceScheduleWeekdays = (values = []) => {
  const numeric = Array.isArray(values)
    ? values
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];
  return Array.from(new Set(numeric)).sort((a, b) => a - b).map((value) => String(value));
};

export const getServiceScheduleWeekdayLabel = (value, short = false) => {
  const weekday = WEEKDAY_LABELS.find((entry) => entry.value === String(value));
  if (!weekday) return '';
  return short ? weekday.short : weekday.label;
};

const describeWeekdaySelection = (weekdays = []) => {
  const normalized = normalizeServiceScheduleWeekdays(weekdays);
  if (normalized.length === 0) return '';
  if (normalized.length === 7) return 'any day';
  const labels = normalized.map((value) => getServiceScheduleWeekdayLabel(value)).filter(Boolean);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
};

export const addMonthsClamped = (date, months) => {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + Number(months || 0));
  const monthLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, monthLastDay));
  return next;
};

const addDuration = (date, unit, amount) => {
  const next = new Date(date);
  const step = Number(amount || 0);
  if (!Number.isFinite(step) || step <= 0) return next;
  if (unit === 'days') {
    next.setDate(next.getDate() + step);
    return next;
  }
  if (unit === 'weeks') {
    next.setDate(next.getDate() + (step * 7));
    return next;
  }
  if (unit === 'months') {
    return addMonthsClamped(next, step);
  }
  if (unit === 'years') {
    return addMonthsClamped(next, step * 12);
  }
  return next;
};

const toDateStamp = (value) => {
  const date = parseDateOnly(value);
  return date ? formatDateInput(date) : '';
};

const buildWeekdaySeries = ({ start, end, stepWeeks, weekdays, maxVisits }) => {
  const dates = [];
  const seen = new Set();
  weekdays.forEach((weekdayValue) => {
    const weekday = Number(weekdayValue);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return;
    const cursor = new Date(start);
    const offset = (weekday - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + offset);
    while (cursor <= end && dates.length < maxVisits) {
      const stamp = formatDateInput(cursor);
      if (stamp && !seen.has(stamp)) {
        seen.add(stamp);
        dates.push(stamp);
      }
      cursor.setDate(cursor.getDate() + (stepWeeks * 7));
    }
  });
  return dates.sort();
};

const buildIntervalSeries = ({ start, end, stepDays, maxVisits }) => {
  const dates = [];
  const step = Number(stepDays || 0);
  if (!Number.isFinite(step) || step <= 0) return dates;

  let cursor = new Date(start);
  while (cursor <= end && dates.length < maxVisits) {
    const stamp = formatDateInput(cursor);
    if (stamp) dates.push(stamp);
    cursor = addDuration(cursor, 'days', step);
    if (!Number.isFinite(cursor.getTime())) break;
    if (cursor <= start) break;
  }

  return Array.from(new Set(dates)).sort();
};

const shiftDateToWeekday = (date, weekday) => {
  const cursor = new Date(date);
  const target = Number(weekday);
  if (!Number.isInteger(target) || target < 0 || target > 6) return cursor;
  const offset = (target - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + offset);
  return cursor;
};

const buildAnchoredMonthSeries = ({ start, end, stepMonths, maxVisits }) => {
  const dates = [];
  const anchorDay = start.getDate();
  let monthOffset = 0;

  while (dates.length < maxVisits) {
    const cursor = new Date(start);
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + monthOffset);
    const monthLastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    cursor.setDate(Math.min(anchorDay, monthLastDay));
    if (cursor > end) break;
    const stamp = formatDateInput(cursor);
    if (stamp) dates.push(stamp);
    monthOffset += stepMonths;
    if (stepMonths <= 0) break;
  }

  return Array.from(new Set(dates)).sort();
};

export const getServiceScheduleRuleLabel = (draft = {}) => {
  const normalized = normalizeServiceScheduleFrequencyConfig(draft.frequency, draft.repeatEvery, draft.repeatUnit);
  const frequency = normalized.frequency;
  const repeatEvery = normalized.repeatEvery;
  const repeatUnit = normalized.repeatUnit;
  const weekdays = normalizeServiceScheduleWeekdays(draft.weekdays || []);
  const weekdayLabel = describeWeekdaySelection(weekdays);

  if (frequency === 'daily') return 'Every day';
  if (frequency === 'weekly') {
    return weekdayLabel ? `Every week on ${weekdayLabel}` : 'Every week on any day';
  }
  if (frequency === 'fortnightly') {
    return weekdayLabel ? `Every 2 weeks on ${weekdayLabel}` : 'Every 2 weeks on any day';
  }
  if (frequency === 'monthly') return weekdayLabel ? `Every month on ${weekdayLabel}` : 'Every month';
  if (frequency === 'quarterly') return weekdayLabel ? `Every 3 months on ${weekdayLabel}` : 'Every 3 months';
  if (frequency === 'half_yearly') return weekdayLabel ? `Every 6 months on ${weekdayLabel}` : 'Every 6 months';
  if (frequency === 'yearly') return weekdayLabel ? `Every year on ${weekdayLabel}` : 'Every year';
  if (frequency === 'custom') {
    const unitLabel = repeatEvery === 1 ? repeatUnit.replace(/s$/, '') : repeatUnit;
    return repeatUnit === 'weeks' && weekdayLabel
      ? `Every ${repeatEvery} ${repeatUnit} on ${weekdayLabel}`
      : repeatUnit !== 'weeks' && weekdayLabel
        ? `Every ${repeatEvery} ${unitLabel} on ${weekdayLabel}`
      : repeatUnit === 'weeks'
        ? `Every ${repeatEvery} ${repeatUnit} on any day`
        : `Every ${repeatEvery} ${unitLabel}${repeatEvery === 1 ? '' : ''}`;
  }
  return 'Custom rule';
};

export const generateServiceScheduleDates = (draft = {}, maxVisits = 500) => {
  const start = parseDateOnly(draft.startDate);
  const end = parseDateOnly(draft.endDate);
  if (!start || !end || end < start) return [];

  const normalized = normalizeServiceScheduleFrequencyConfig(draft.frequency, draft.repeatEvery, draft.repeatUnit);
  const frequency = normalized.frequency;
  const repeatEvery = normalized.repeatEvery;
  const repeatUnit = normalized.repeatUnit;
  const weekdays = normalizeServiceScheduleWeekdays(draft.weekdays || []);
  const preferredWeekday = weekdays.length > 0 ? Number(weekdays[0]) : null;

  if (frequency === 'weekly' || frequency === 'fortnightly' || (frequency === 'custom' && repeatUnit === 'weeks')) {
    if (weekdays.length === 0) {
      const stepWeeks = frequency === 'fortnightly' ? 2 : frequency === 'weekly' ? 1 : repeatEvery;
      return buildIntervalSeries({ start, end, stepDays: Math.max(1, stepWeeks) * 7, maxVisits });
    }
    if (weekdays.length === 7) {
      const stepWeeks = frequency === 'fortnightly' ? 2 : frequency === 'weekly' ? 1 : repeatEvery;
      return buildIntervalSeries({ start, end, stepDays: Math.max(1, stepWeeks) * 7, maxVisits });
    }
    const stepWeeks = frequency === 'fortnightly' ? 2 : frequency === 'weekly' ? 1 : repeatEvery;
    return buildWeekdaySeries({ start, end, stepWeeks: Math.max(1, stepWeeks), weekdays, maxVisits });
  }

  if (frequency === 'daily') {
    const dates = [];
    let cursor = new Date(start);
    while (cursor <= end && dates.length < maxVisits) {
      if (weekdays.length === 0 || weekdays.includes(String(cursor.getDay()))) {
        const stamp = formatDateInput(cursor);
        if (stamp) dates.push(stamp);
      }
      cursor = addDuration(cursor, 'days', 1);
      if (!Number.isFinite(cursor.getTime())) break;
      if (cursor <= start) break;
    }
    return Array.from(new Set(dates)).sort();
  }

  let unit = '';
  let step = 1;
  if (frequency === 'daily') {
    unit = 'days';
  } else if (frequency === 'monthly') {
    unit = 'months';
  } else if (frequency === 'quarterly') {
    unit = 'months';
    step = 3;
  } else if (frequency === 'half_yearly') {
    unit = 'months';
    step = 6;
  } else if (frequency === 'yearly') {
    unit = 'years';
  } else if (frequency === 'custom') {
    unit = repeatUnit;
    step = repeatEvery;
  }

  if (!unit) return [];

  if (unit === 'months' || unit === 'years') {
    const stepMonths = unit === 'years' ? step * 12 : step;
    const baseDates = buildAnchoredMonthSeries({ start, end, stepMonths: Math.max(1, stepMonths), maxVisits });
    if (weekdays.length === 0) return baseDates;
    const shifted = baseDates
      .map((stamp) => {
        const date = parseDateOnly(stamp);
        if (!date) return '';
        return formatDateInput(shiftDateToWeekday(date, preferredWeekday));
      })
      .filter(Boolean)
      .filter((stamp) => parseDateOnly(stamp) <= end);
    return Array.from(new Set(shifted)).sort();
  }

  const dates = [];
  let cursor = new Date(start);
  while (cursor <= end && dates.length < maxVisits) {
    const stamp = formatDateInput(cursor);
    if (stamp) dates.push(stamp);
    cursor = addDuration(cursor, unit, step);
    if (!Number.isFinite(cursor.getTime())) break;
    if (cursor <= start) break;
  }

  return Array.from(new Set(dates)).sort();
};

export const formatServiceScheduleDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatServiceScheduleDateWithWeekday = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  const weekday = getServiceScheduleWeekdayLabel(date.getDay(), true);
  return [weekday, formatServiceScheduleDate(value)].filter(Boolean).join(', ');
};

export const formatServiceScheduleTime = (value) => {
  const raw = normalizeServiceScheduleTime(value, '10:00');
  const [hoursRaw, minutes] = raw.split(':');
  const hours = Number(hoursRaw);
  if (!Number.isFinite(hours)) return raw;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${suffix}`;
};

export const formatServiceScheduleDateTime = (dateValue, timeValue) =>
  [formatServiceScheduleDate(dateValue), formatServiceScheduleTime(timeValue)].filter(Boolean).join(', ');

export const normalizeServiceScheduleRows = (rows = [], defaultTime = '10:00') => {
  const normalizedTime = normalizeServiceScheduleTime(defaultTime, '10:00');
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      serviceNumber: Number.isFinite(Number(row?.serviceNumber)) && Number(row.serviceNumber) > 0
        ? Number(row.serviceNumber)
        : index + 1,
      serviceDate: toDateStamp(row?.serviceDate),
      serviceTime: normalizeServiceScheduleTime(row?.serviceTime, normalizedTime),
      itemId: String(row?.itemId || '').trim(),
      itemName: String(row?.itemName || '').trim(),
      itemDescription: String(row?.itemDescription || '').trim(),
      scheduleRuleLabel: String(row?.scheduleRuleLabel || row?.scheduleRule || '').trim(),
      status: String(row?.status || 'Scheduled').trim() || 'Scheduled'
    }))
    .filter((row) => Boolean(row.serviceDate))
    .map((row, index) => ({
      ...row,
      serviceNumber: index + 1
    }));
};

export const buildServiceScheduleRows = ({
  draft = {},
  defaultTime = '10:00',
  itemMeta = {},
  maxVisits = 500
} = {}) => {
  const dates = generateServiceScheduleDates(draft, maxVisits);
  const normalizedTime = normalizeServiceScheduleTime(defaultTime, '10:00');
  const scheduleRuleLabel = getServiceScheduleRuleLabel(draft);
  return dates.map((serviceDate, index) => ({
    serviceNumber: index + 1,
    serviceDate,
    serviceTime: normalizedTime,
    itemId: String(itemMeta.itemId || '').trim(),
    itemName: String(itemMeta.itemName || 'Service Visit').trim() || 'Service Visit',
    itemDescription: String(itemMeta.itemDescription || '').trim(),
    scheduleRuleLabel,
    status: 'Scheduled'
  }));
};

export const buildServiceScheduleDraftFromInvoice = (invoice = {}, fallbackTime = '10:00') => {
  const firstLine = Array.isArray(invoice.items) ? (invoice.items.find((line) => line) || {}) : {};
  const scheduleRows = normalizeServiceScheduleRows(invoice.serviceSchedules, fallbackTime);
  const sortedSchedules = [...scheduleRows].sort((left, right) => {
    const leftStamp = `${left.serviceDate || ''}T${left.serviceTime || '00:00'}`;
    const rightStamp = `${right.serviceDate || ''}T${right.serviceTime || '00:00'}`;
    if (leftStamp === rightStamp) return Number(left.serviceNumber || 0) - Number(right.serviceNumber || 0);
    return leftStamp.localeCompare(rightStamp);
  });
  const firstSchedule = sortedSchedules[0] || null;
  const lastSchedule = sortedSchedules[sortedSchedules.length - 1] || null;
  const serviceFrequencyConfig = normalizeServiceScheduleFrequencyConfig(firstLine.serviceFrequency, 1, 'weeks');

  return {
    startDate: toDateStamp(
      firstLine.contractStartDate
      || firstLine.serviceStartDate
      || invoice.servicePeriodStart
      || firstSchedule?.serviceDate
      || invoice.date
      || invoice.invoiceDate
    ),
    endDate: toDateStamp(
      firstLine.contractEndDate
      || firstLine.serviceEndDate
      || invoice.servicePeriodEnd
      || lastSchedule?.serviceDate
    ),
    frequency: serviceFrequencyConfig.frequency,
    weekdays: normalizeServiceScheduleWeekdays(
      firstLine.serviceWeekday != null && firstLine.serviceWeekday !== ''
        ? [firstLine.serviceWeekday]
        : []
    ),
    repeatEvery: serviceFrequencyConfig.repeatEvery,
    repeatUnit: serviceFrequencyConfig.repeatUnit,
    defaultTime: normalizeServiceScheduleTime(invoice.serviceScheduleDefaultTime, fallbackTime)
  };
};

export const serviceScheduleFrequencyOptions = FREQUENCY_OPTIONS;
export const serviceScheduleRepeatUnitOptions = REPEAT_UNIT_OPTIONS;
export const serviceScheduleWeekdayOptions = WEEKDAY_LABELS;
