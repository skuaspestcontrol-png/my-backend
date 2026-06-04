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
  const frequency = String(draft.frequency || '').trim().toLowerCase();
  const weekdays = normalizeServiceScheduleWeekdays(draft.weekdays || []);
  const repeatEvery = Math.max(1, Number(draft.repeatEvery || 1));
  const repeatUnit = String(draft.repeatUnit || 'weeks').toLowerCase();
  const weekdayLabel = weekdays.map((value) => getServiceScheduleWeekdayLabel(value)).filter(Boolean).join(', ');

  if (frequency === 'daily') return 'Every day';
  if (frequency === 'weekly') {
    return weekdayLabel ? `Every week on ${weekdayLabel}` : 'Every week';
  }
  if (frequency === 'fortnightly') {
    return weekdayLabel ? `Every 2 weeks on ${weekdayLabel}` : 'Every 2 weeks';
  }
  if (frequency === 'monthly') return 'Every month';
  if (frequency === 'quarterly') return 'Every 3 months';
  if (frequency === 'half_yearly') return 'Every 6 months';
  if (frequency === 'yearly') return 'Every year';
  if (frequency === 'custom') {
    const unitLabel = repeatEvery === 1 ? repeatUnit.replace(/s$/, '') : repeatUnit;
    return repeatUnit === 'weeks' && weekdayLabel
      ? `Every ${repeatEvery} ${repeatUnit} on ${weekdayLabel}`
      : `Every ${repeatEvery} ${unitLabel}${repeatEvery === 1 ? '' : ''}`;
  }
  return 'Custom rule';
};

export const generateServiceScheduleDates = (draft = {}, maxVisits = 500) => {
  const start = parseDateOnly(draft.startDate);
  const end = parseDateOnly(draft.endDate);
  if (!start || !end || end < start) return [];

  const frequency = String(draft.frequency || '').trim().toLowerCase();
  const weekdays = normalizeServiceScheduleWeekdays(draft.weekdays || []);
  const repeatEvery = Math.max(1, Number(draft.repeatEvery || 1));
  const repeatUnit = String(draft.repeatUnit || 'weeks').toLowerCase();

  if (frequency === 'weekly' || frequency === 'fortnightly' || (frequency === 'custom' && repeatUnit === 'weeks')) {
    if (weekdays.length === 0) return [];
    const stepWeeks = frequency === 'fortnightly' ? 2 : frequency === 'weekly' ? 1 : repeatEvery;
    return buildWeekdaySeries({ start, end, stepWeeks: Math.max(1, stepWeeks), weekdays, maxVisits });
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
    return buildAnchoredMonthSeries({ start, end, stepMonths: Math.max(1, stepMonths), maxVisits });
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
      status: String(row?.status || 'Scheduled').trim() || 'Scheduled'
    }))
    .filter((row) => Boolean(row.serviceDate))
    .sort((left, right) => {
      const leftStamp = `${left.serviceDate || ''}T${left.serviceTime || '00:00'}`;
      const rightStamp = `${right.serviceDate || ''}T${right.serviceTime || '00:00'}`;
      if (leftStamp === rightStamp) return Number(left.serviceNumber || 0) - Number(right.serviceNumber || 0);
      return leftStamp.localeCompare(rightStamp);
    })
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
  return dates.map((serviceDate, index) => ({
    serviceNumber: index + 1,
    serviceDate,
    serviceTime: normalizedTime,
    itemId: String(itemMeta.itemId || '').trim(),
    itemName: String(itemMeta.itemName || 'Service Visit').trim() || 'Service Visit',
    itemDescription: String(itemMeta.itemDescription || '').trim(),
    status: 'Scheduled'
  }));
};

export const buildServiceScheduleDraftFromInvoice = (invoice = {}, fallbackTime = '10:00') => {
  const firstLine = Array.isArray(invoice.items) ? (invoice.items.find((line) => line) || {}) : {};
  const scheduleRows = normalizeServiceScheduleRows(invoice.serviceSchedules, fallbackTime);
  const firstSchedule = scheduleRows[0] || null;
  const lastSchedule = scheduleRows[scheduleRows.length - 1] || null;
  const serviceFrequency = String(firstLine.serviceFrequency || '').trim().toLowerCase();
  const repeatEvery = serviceFrequency === 'fortnightly' ? 2 : 1;
  const repeatUnit = serviceFrequency === 'monthly' || serviceFrequency === 'quarterly' || serviceFrequency === 'half_yearly' || serviceFrequency === 'yearly'
    ? 'months'
    : 'weeks';

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
    frequency: serviceFrequency,
    weekdays: normalizeServiceScheduleWeekdays(
      firstLine.serviceWeekday != null && firstLine.serviceWeekday !== ''
        ? [firstLine.serviceWeekday]
        : []
    ),
    repeatEvery,
    repeatUnit,
    defaultTime: normalizeServiceScheduleTime(invoice.serviceScheduleDefaultTime, fallbackTime)
  };
};

export const serviceScheduleFrequencyOptions = FREQUENCY_OPTIONS;
export const serviceScheduleRepeatUnitOptions = REPEAT_UNIT_OPTIONS;
export const serviceScheduleWeekdayOptions = WEEKDAY_LABELS;
