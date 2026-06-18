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

const PREFERRED_DAY_OPTIONS = [
  { value: '', label: 'Normal dates' },
  ...WEEKDAY_LABELS
];

const CONTRACT_PERIOD_CONFIG = {
  single_time: { unit: 'days', value: 1, endOffset: 1 },
  single_time_plus_7: { unit: 'days', value: 7, endOffset: 0 },
  single_time_plus_10: { unit: 'days', value: 10, endOffset: 0 },
  weekly: { unit: 'days', value: 7 },
  fortnightly_visits: { unit: 'days', value: 14 },
  monthly: { unit: 'months', value: 1 },
  three_months: { unit: 'months', value: 3 },
  bi_monthly: { unit: 'months', value: 2 },
  quarterly: { unit: 'months', value: 3 },
  half_yearly: { unit: 'months', value: 6 },
  annual: { unit: 'months', value: 12 },
  two_years: { unit: 'months', value: 24 },
  three_years: { unit: 'months', value: 36 },
  five_years: { unit: 'months', value: 60 },
  ten_years: { unit: 'months', value: 120 }
};

const SPECIAL_SINGLE_VISIT_PERIODS = new Set(['single_time_plus_7', 'single_time_plus_10']);

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

export const normalizeServiceSchedulePreferredDay = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'normal' || raw === 'normal dates') return '';
  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 6 ? String(numeric) : '';
};

export const getServiceSchedulePreferredDayLabel = (value) => {
  const normalized = normalizeServiceSchedulePreferredDay(value);
  return normalized === '' ? 'Normal dates' : getServiceScheduleWeekdayLabel(normalized) || 'Normal dates';
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

export const buildContractWindow = (startDateValue, contractPeriod) => {
  const cfg = CONTRACT_PERIOD_CONFIG[String(contractPeriod || '').trim()];
  const start = parseDateOnly(startDateValue);
  if (!cfg || !start) {
    return {
      contractStartDate: '',
      contractEndDate: '',
      renewalDate: ''
    };
  }

  let end = new Date(start);
  if (cfg.unit === 'days') {
    const offset = Number.isFinite(Number(cfg.endOffset)) ? Number(cfg.endOffset) : 1;
    end.setDate(end.getDate() + cfg.value - offset);
  } else {
    end = addMonthsClamped(start, cfg.value);
    end.setDate(end.getDate() - 1);
  }

  const renewal = new Date(end);
  renewal.setDate(renewal.getDate() + 1);

  return {
    contractStartDate: formatDateInput(start),
    contractEndDate: formatDateInput(end),
    renewalDate: formatDateInput(renewal)
  };
};

const resolveFrequencyConfig = (frequency, repeatEvery, repeatUnit) => {
  const normalized = normalizeServiceScheduleFrequencyConfig(frequency, repeatEvery, repeatUnit);
  const resolved = normalized.frequency;
  if (resolved === 'single_once') return { mode: 'single_once' };
  if (resolved === 'daily') return { unit: 'days', step: 1 };
  if (resolved === 'weekly') return { unit: 'days', step: 7 };
  if (resolved === 'fortnightly') return { unit: 'days', step: 14 };
  if (resolved === 'monthly') return { unit: 'months', step: 1 };
  if (resolved === 'quarterly') return { unit: 'months', step: 3 };
  if (resolved === 'half_yearly') return { unit: 'months', step: 6 };
  if (resolved === 'yearly') return { unit: 'months', step: 12 };
  if (resolved === 'custom') {
    return {
      unit: normalized.repeatUnit,
      step: Math.max(1, Number(normalized.repeatEvery || 1))
    };
  }
  return null;
};

const buildBaseServiceDates = ({ start, end, frequency, repeatEvery, repeatUnit, maxVisits = 500 }) => {
  const config = resolveFrequencyConfig(frequency, repeatEvery, repeatUnit);
  const dates = [];
  if (!config || !start || !end || end < start) return dates;
  if (config.mode === 'single_once') return [formatDateInput(start)];

  let cursor = new Date(start);
  while (cursor <= end && dates.length < maxVisits) {
    const stamp = formatDateInput(cursor);
    if (stamp) dates.push(stamp);
    if (config.unit === 'days') {
      cursor = addDuration(cursor, 'days', config.step);
    } else if (config.unit === 'weeks') {
      cursor = addDuration(cursor, 'weeks', config.step);
    } else if (config.unit === 'months') {
      cursor = addMonthsClamped(cursor, config.step);
    } else if (config.unit === 'years') {
      cursor = addMonthsClamped(cursor, config.step * 12);
    } else {
      break;
    }
    if (!Number.isFinite(cursor.getTime())) break;
    if (cursor <= start) break;
  }
  return Array.from(new Set(dates));
};

const buildWeekdayCandidatesInRange = (start, end, weekday) => {
  const target = Number(weekday);
  if (!Number.isInteger(target) || target < 0 || target > 6 || !start || !end || end < start) return [];
  const candidates = [];
  const cursor = new Date(start);
  const offset = (target - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + offset);
  while (cursor <= end) {
    const stamp = formatDateInput(cursor);
    if (stamp) candidates.push(stamp);
    cursor.setDate(cursor.getDate() + 7);
  }
  return candidates;
};

const findNearestPreferredDate = (baseDateValue, preferredDay, start, end) => {
  const target = normalizeServiceSchedulePreferredDay(preferredDay);
  const base = parseDateOnly(baseDateValue);
  if (!base) return '';
  if (target === '') return formatDateInput(base);
  const candidates = buildWeekdayCandidatesInRange(start, end, target)
    .map((stamp) => parseDateOnly(stamp))
    .filter(Boolean);
  if (candidates.length === 0) return '';

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate) => {
    const distance = Math.abs(candidate.getTime() - base.getTime());
    if (distance < bestDistance || (distance === bestDistance && (!best || candidate.getTime() > best.getTime()))) {
      best = candidate;
      bestDistance = distance;
    }
  });

  return best ? formatDateInput(best) : '';
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
  return buildServiceScheduleRows(draft, '', {}, maxVisits).map((row) => row.serviceDate).filter(Boolean);
};

export const formatServiceScheduleDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
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
      baseServiceDate: toDateStamp(row?.baseServiceDate || row?.baseDate || row?.serviceDate),
      preferredDay: normalizeServiceSchedulePreferredDay(row?.preferredDay || row?.serviceWeekday || ''),
      preferredDayLabel: String(row?.preferredDayLabel || getServiceSchedulePreferredDayLabel(row?.preferredDay || row?.serviceWeekday || '')).trim(),
      serviceDate: toDateStamp(row?.finalServiceDate || row?.serviceDate),
      finalServiceDate: toDateStamp(row?.finalServiceDate || row?.serviceDate),
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
  const start = parseDateOnly(draft.startDate);
  const end = parseDateOnly(draft.endDate);
  if (!start || !end || end < start) return [];
  const normalizedTime = normalizeServiceScheduleTime(defaultTime, '10:00');
  const scheduleRuleLabel = getServiceScheduleRuleLabel(draft);
  const normalized = normalizeServiceScheduleFrequencyConfig(draft.frequency, draft.repeatEvery, draft.repeatUnit);
  const preferredDay = normalizeServiceSchedulePreferredDay(draft.preferredDay || (Array.isArray(draft.weekdays) && draft.weekdays.length > 0 ? draft.weekdays[0] : ''));
  const contractPeriod = String(draft.contractPeriod || '').trim();

  if (SPECIAL_SINGLE_VISIT_PERIODS.has(contractPeriod)) {
    const dates = [formatDateInput(start), formatDateInput(end)].filter(Boolean);
    return dates.map((serviceDate, index) => ({
      serviceNumber: index + 1,
      baseServiceDate: serviceDate,
      preferredDay,
      preferredDayLabel: getServiceSchedulePreferredDayLabel(preferredDay),
      serviceDate,
      finalServiceDate: serviceDate,
      serviceTime: normalizedTime,
      itemId: String(itemMeta.itemId || '').trim(),
      itemName: String(itemMeta.itemName || 'Service Visit').trim() || 'Service Visit',
      itemDescription: String(itemMeta.itemDescription || '').trim(),
      scheduleRuleLabel,
      status: 'Scheduled'
    }));
  }

  const baseDates = buildBaseServiceDates({
    start,
    end,
    frequency: normalized.frequency,
    repeatEvery: normalized.repeatEvery,
    repeatUnit: normalized.repeatUnit,
    maxVisits
  });
  return baseDates
    .map((baseServiceDate, index) => {
      const finalServiceDate = preferredDay === ''
        ? baseServiceDate
        : findNearestPreferredDate(baseServiceDate, preferredDay, start, end);
      if (!finalServiceDate) return null;
      return {
        serviceNumber: index + 1,
        baseServiceDate,
        preferredDay,
        preferredDayLabel: getServiceSchedulePreferredDayLabel(preferredDay),
        serviceDate: finalServiceDate,
        finalServiceDate,
        serviceTime: normalizedTime,
        itemId: String(itemMeta.itemId || '').trim(),
        itemName: String(itemMeta.itemName || 'Service Visit').trim() || 'Service Visit',
        itemDescription: String(itemMeta.itemDescription || '').trim(),
        scheduleRuleLabel,
        status: 'Scheduled'
      };
    })
    .filter(Boolean);
};

export const buildServiceSchedulePlan = ({
  draft = {},
  defaultTime = '10:00',
  itemMeta = {},
  maxVisits = 500
} = {}) => {
  const rows = buildServiceScheduleRows({ draft, defaultTime, itemMeta, maxVisits });
  return {
    startDate: String(draft.startDate || '').trim(),
    endDate: String(draft.endDate || '').trim(),
    totalServices: rows.length,
    rows
  };
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
    contractPeriod: String(firstLine.contractPeriod || '').trim(),
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
export const serviceSchedulePreferredDayOptions = PREFERRED_DAY_OPTIONS;
