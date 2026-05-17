export const PHONE_VALIDATION_ERROR = 'Please enter a valid 10 digit mobile number.';

export const normalizeIndianMobileNumber = (value) => {
  let digits = String(value ?? '').replace(/\D+/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

export const isValidIndianMobileNumber = (value) => /^\d{10}$/.test(normalizeIndianMobileNumber(value));

export const normalizeOptionalIndianMobileNumber = (value) => {
  const normalized = normalizeIndianMobileNumber(value);
  return normalized ? normalized : '';
};
