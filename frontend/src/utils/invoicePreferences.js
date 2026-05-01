export const invoiceColumns = [
  { key: 'date', label: 'Date' },
  { key: 'invoiceNumber', label: 'Invoice#' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'balanceDue', label: 'Balance Due' },
  { key: 'status', label: 'Status' }
];

export const defaultInvoiceVisibleColumns = ['date', 'invoiceNumber', 'customerName', 'dueDate', 'amount', 'balanceDue', 'status'];

export const invoiceTemplateOptions = [
  { value: 'classic', label: 'Classic Red' },
  { value: 'clean', label: 'Clean Minimal' },
  { value: 'executive', label: 'Executive Dark' }
];

export const defaultInvoiceTemplate = 'classic';

export const invoiceFieldOptions = [
  { key: 'showSubject', label: 'Subject Line' },
  { key: 'showServicePeriod', label: 'Service Period' },
  { key: 'showPaymentSummary', label: 'Payment Summary' },
  { key: 'showCustomerNotes', label: 'Customer Notes' },
  { key: 'showTermsAndConditions', label: 'Terms & Conditions' },
  { key: 'showCompanyGst', label: 'Company GST Number' },
  { key: 'showCompanyWebsite', label: 'Website' },
  { key: 'showGoogleReviewLink', label: 'Google Review Link' }
];

export const defaultInvoiceFieldSettings = {
  showSubject: true,
  showServicePeriod: true,
  showPaymentSummary: true,
  showCustomerNotes: true,
  showTermsAndConditions: true,
  showCompanyGst: true,
  showCompanyWebsite: true,
  showGoogleReviewLink: true
};

export const defaultCompanyProfileSettings = {
  companyName: '',
  companyAddress: '',
  companyCity: '',
  companyState: '',
  companyPincode: '',
  companyGstNumber: '',
  companyEmail: '',
  companyMobile: '',
  companyWebsite: '',
  googleReviewLink: '',
  dashboardImageUrl: ''
};

export const normalizeInvoiceVisibleColumns = (value) => {
  const validKeys = new Set(invoiceColumns.map((column) => column.key));
  const source = Array.isArray(value) ? value : defaultInvoiceVisibleColumns;
  const unique = [];

  source.forEach((entry) => {
    const key = String(entry || '').trim();
    if (!validKeys.has(key)) return;
    if (!unique.includes(key)) unique.push(key);
  });

  return unique.length > 0 ? unique : [...defaultInvoiceVisibleColumns];
};

export const normalizeInvoiceTemplate = (value) => {
  const normalized = String(value || '').trim();
  const allowed = new Set(invoiceTemplateOptions.map((option) => option.value));
  return allowed.has(normalized) ? normalized : defaultInvoiceTemplate;
};

export const normalizeInvoiceFieldSettings = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const next = { ...defaultInvoiceFieldSettings };

  Object.keys(defaultInvoiceFieldSettings).forEach((key) => {
    if (raw[key] === undefined) return;
    next[key] = Boolean(raw[key]);
  });

  return next;
};
