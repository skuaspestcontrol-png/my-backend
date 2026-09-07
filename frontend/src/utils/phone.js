export const PHONE_VALIDATION_ERROR = 'Please enter a valid 10 digit mobile number.';

export const normalizeIndianMobileNumber = (value) => {
  let digits = String(value ?? '').replace(/\D+/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

export const normalizeWhatsAppPhoneNumber = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  let digits = raw.replace(/\D+/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return '';
};

export const isValidWhatsAppPhoneNumber = (value) => Boolean(normalizeWhatsAppPhoneNumber(value));

export const formatWhatsAppPhoneNumber = (value) => {
  const normalized = normalizeWhatsAppPhoneNumber(value);
  if (!normalized) return String(value ?? '').trim();
  return `+${normalized}`;
};

export const isValidIndianMobileNumber = (value) => /^\d{10}$/.test(normalizeIndianMobileNumber(value));

export const normalizeOptionalIndianMobileNumber = (value) => {
  const normalized = normalizeIndianMobileNumber(value);
  return normalized ? normalized : '';
};

export const formatIndianMobileNumber = (value) => {
  const normalized = normalizeIndianMobileNumber(value);
  if (!normalized) return String(value ?? '').trim();
  return `+91${normalized}`;
};
