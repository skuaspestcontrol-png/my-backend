// Presentation only. API payloads, form values and schedule arithmetic stay ISO/24-hour.
export const PORTAL_TIME_ZONE = 'Asia/Kolkata';
const pad = value => String(value).padStart(2, '0');
const portalPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PORTAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const validDateParts = (year, month, day) => {
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day);
};
const dateParts = value => {
  const raw = typeof value === 'string' ? value.trim() : '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (iso || dmy) {
    const [year, month, day] = iso ? iso.slice(1) : [dmy[3], dmy[2], dmy[1]];
    return validDateParts(year, month, day) ? { year, month: pad(month), day: pad(day) } : null;
  }
  const prefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (prefix && !validDateParts(prefix[1], prefix[2], prefix[3])) return null;
  const clock12 = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (clock12) {
    if (Number(clock12[4]) < 1 || Number(clock12[4]) > 12 || Number(clock12[5]) > 59) return null;
    return { year: clock12[1], month: clock12[2], day: clock12[3], hour: pad(Number(clock12[4]) % 12 + (clock12[6].toUpperCase() === 'PM' ? 12 : 0)), minute: clock12[5] };
  }
  // datetime-local strings describe wall time, not a UTC instant.
  const wall = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::([0-5]\d)(?:\.\d+)?)?$/);
  if (wall) return validDateParts(wall[1], wall[2], wall[3]) && Number(wall[4]) < 24 && Number(wall[5]) < 60
    ? { year: wall[1], month: wall[2], day: wall[3], hour: wall[4], minute: wall[5] } : null;
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Object.fromEntries(portalPartsFormatter.formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
};
export const formatPortalDate = (value, fallback = '-') => {
  const parts = dateParts(value);
  return parts ? `${parts.day}-${parts.month}-${String(parts.year).padStart(4, '0')}` : fallback;
};
export const formatPortalTime = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  const raw = typeof value === 'string' ? value.trim() : '';
  const time = raw.match(/^(\d{1,2}):(\d{2})(?::([0-5]\d))?\s*([AP]M)?$/i);
  const hourOnly = raw.match(/^(\d{1,2})\s*([AP]M)$/i);
  let hours, minutes;
  if (time || hourOnly) {
    hours = Number(time?.[1] ?? hourOnly[1]);
    minutes = Number(time?.[2] ?? 0);
    const period = (time?.[4] ?? hourOnly?.[2])?.toUpperCase();
    if (minutes > 59 || hours > (period ? 12 : 23) || (period && hours < 1)) return fallback;
    if (period) hours = hours % 12 + (period === 'PM' ? 12 : 0);
  } else {
    // Do not let Date coerce partial text into invented times; numbers represent epoch milliseconds.
    if (!(value instanceof Date) && typeof value !== 'number' && !/^\d{4}-\d{2}-\d{2}[T\s]/.test(raw)) return fallback;
    const parts = dateParts(value);
    if (!parts?.hour || !parts?.minute) return fallback;
    hours = Number(parts.hour); minutes = Number(parts.minute);
  }
  return `${pad(hours % 12 || 12)}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`;
};
export const formatPortalDateTime = (value, fallback = '-') => {
  const date = formatPortalDate(value, '');
  const time = formatPortalTime(value, '');
  return date ? [date, time].filter(Boolean).join(' ') : fallback;
};
// Wizard reviews retain field values, formatting only date/time-shaped display strings.
export const formatPortalReviewValue = value => {
  if (typeof value !== 'string') return String(value ?? '').trim() || '—';
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(raw)) return formatPortalDateTime(raw, raw);
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(raw)) return formatPortalDate(raw, raw);
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?$/i.test(raw)) return formatPortalTime(raw, raw);
  return raw || '—';
};

// Preserve numbers, elements, empty cells and all non-date text in generic tables.
export const formatPortalValue = value => {
  if (value instanceof Date) return formatPortalDateTime(value);
  if (typeof value !== 'string' || !/^(?:\d{4}-\d{2}-\d{2}(?:[T\s].*)?|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?)$/i.test(value.trim())) return value;
  return formatPortalReviewValue(value);
};
