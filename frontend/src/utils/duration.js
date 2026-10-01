export const decimalHoursToMinutes = (value) => {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(0, Math.round(hours * 60));
};

export const formatDurationHours = (value) => {
  const totalMinutes = decimalHoursToMinutes(value);
  if (totalMinutes <= 0) return '0h';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};
