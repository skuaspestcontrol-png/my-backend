export const INDIA_TIME_ZONE = 'Asia/Kolkata';

const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatWithIntl = (value, options, fallback = '-') => {
  const date = toDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TIME_ZONE, ...options }).format(date);
  } catch {
    return fallback;
  }
};

export const formatIndiaDateTime = (value, options = {}) =>
  formatWithIntl(
    value,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...options
    }
  );

export const formatIndiaDate = (value, options = {}) =>
  formatWithIntl(
    value,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options
    }
  );

export const formatIndiaTime = (value, options = {}) =>
  formatWithIntl(
    value,
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    }
  );

