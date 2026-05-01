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

export const defaultInvoiceTemplateSettings = {
  primaryColor: '#0F766E',
  accentColor: '#2563EB',
  textColor: '#111827',
  borderColor: '#E5E7EB',
  fontFamily: 'Helvetica',
  fontSize: '9',
  headerStyle: 'modern',
  showLogo: true,
  showTagline: true,
  showCustomerGst: true,
  showServiceLocation: true,
  showContractDetails: true,
  showTechnician: true,
  showSalesPerson: true,
  showHsnSac: true,
  showDiscount: false,
  showTax: true,
  showAmountPaid: true,
  showBalanceDue: true,
  showBankDetails: true,
  showUpi: true,
  showQrCode: false,
  showTerms: true,
  showSignature: true,
  showFooterNote: true,
  taxType: 'GST',
  gstMode: 'AUTO',
  defaultTaxPercentage: 18,
  enableRoundOff: true,
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  upiId: '',
  qrCodeUrl: '',
  paymentInstruction: '',
  termsConditions: '',
  warrantyNote: '',
  serviceDisclaimer: '',
  footerText: 'This is a computer-generated invoice.',
  thankYouText: 'Thank you for your business',
  invoicePrefix: 'SPC-INV-',
  startingInvoiceNumber: 1,
  dateFormat: 'DD/MM/YYYY',
  currencySymbol: '₹',
  showAmountInWords: true,
  signatureUrl: ''
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

export const normalizeInvoiceTemplateSettings = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const next = { ...defaultInvoiceTemplateSettings };
  Object.keys(defaultInvoiceTemplateSettings).forEach((key) => {
    if (raw[key] === undefined) return;
    const base = defaultInvoiceTemplateSettings[key];
    if (typeof base === 'boolean') next[key] = Boolean(raw[key]);
    else if (typeof base === 'number') {
      const n = Number(raw[key]);
      next[key] = Number.isFinite(n) ? n : base;
    } else next[key] = String(raw[key] ?? '').trim();
  });
  next.defaultTaxPercentage = Math.max(0, Number(next.defaultTaxPercentage || 0));
  next.startingInvoiceNumber = Math.max(1, Number(next.startingInvoiceNumber || 1));
  next.taxType = ['GST', 'VAT', 'NONE'].includes(String(next.taxType || '').toUpperCase()) ? String(next.taxType).toUpperCase() : 'GST';
  next.gstMode = ['AUTO', 'CGST_SGST', 'IGST'].includes(String(next.gstMode || '').toUpperCase()) ? String(next.gstMode).toUpperCase() : 'AUTO';
  next.headerStyle = ['classic', 'modern', 'minimal'].includes(String(next.headerStyle || '').toLowerCase()) ? String(next.headerStyle).toLowerCase() : 'modern';
  next.dateFormat = ['DD/MM/YYYY', 'YYYY-MM-DD'].includes(String(next.dateFormat || '').toUpperCase()) ? String(next.dateFormat).toUpperCase() : 'DD/MM/YYYY';
  return next;
};
