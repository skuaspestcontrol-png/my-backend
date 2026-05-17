const PHONE_VALIDATION_ERROR = 'Please enter a valid 10 digit mobile number.';

const normalizeIndianMobileNumber = (value) => {
  let digits = String(value ?? '').replace(/\D+/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const isValidIndianMobileNumber = (value) => /^\d{10}$/.test(normalizeIndianMobileNumber(value));

const normalizeOptionalIndianMobileNumber = (value) => {
  const normalized = normalizeIndianMobileNumber(value);
  return normalized ? normalized : '';
};

const assertValidIndianMobileNumber = (value) => {
  const normalized = normalizeIndianMobileNumber(value);
  if (!/^\d{10}$/.test(normalized)) {
    const error = new Error(PHONE_VALIDATION_ERROR);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const normalizePhoneFields = (source = {}, fieldNames = [], requiredFieldNames = []) => {
  const next = { ...(source && typeof source === 'object' ? source : {}) };
  const required = new Set(requiredFieldNames);
  fieldNames.forEach((fieldName) => {
    const hasValue = Object.prototype.hasOwnProperty.call(next, fieldName);
    if (!hasValue && !required.has(fieldName)) return;
    const raw = next[fieldName];
    if (raw == null || raw === '') {
      if (required.has(fieldName)) {
        const error = new Error(PHONE_VALIDATION_ERROR);
        error.statusCode = 400;
        throw error;
      }
      next[fieldName] = '';
      return;
    }
    next[fieldName] = required.has(fieldName)
      ? assertValidIndianMobileNumber(raw)
      : normalizeOptionalIndianMobileNumber(raw);
    if (next[fieldName] && !/^\d{10}$/.test(next[fieldName])) {
      const error = new Error(PHONE_VALIDATION_ERROR);
      error.statusCode = 400;
      throw error;
    }
  });
  return next;
};

module.exports = {
  PHONE_VALIDATION_ERROR,
  normalizeIndianMobileNumber,
  isValidIndianMobileNumber,
  normalizeOptionalIndianMobileNumber,
  assertValidIndianMobileNumber,
  normalizePhoneFields
};
