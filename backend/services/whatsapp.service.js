const { safeFetch } = require('../lib/safeFetch');
const {
  normalizeWhatsAppPhoneNumber,
  isValidWhatsAppPhoneNumber
} = require('../lib/phone');
const {
  replaceVariables
} = require('./whatsappTemplate.service');

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
};

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' || typeof value === 'function') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^(undefined|null)$/i.test(raw)) return '';
  return raw;
};

const maskSecret = (value) => {
  const raw = normalizeText(value);
  if (!raw) return '';
  if (raw.length <= 4) return '********';
  return `********${raw.slice(-4)}`;
};

const resolveActiveFlag = (settings = {}) => {
  if (settings.whatsappApiActive !== undefined) return toBool(settings.whatsappApiActive);
  if (settings.whatsappActive !== undefined) return toBool(settings.whatsappActive);
  if (settings.active !== undefined) return toBool(settings.active);
  const hasDeropoCredentials = Boolean(
    String(settings.whatsappApiBaseUrl || settings.apiBaseUrl || '').trim()
    && String(settings.whatsappAccessToken || settings.accessToken || '').trim()
  );
  const hasCustomCredentials = Boolean(
    String(settings.whatsappApiBaseUrl || settings.apiBaseUrl || '').trim()
    && String(settings.whatsappInstanceId || settings.instanceId || settings.whatsappPhoneNumberId || '').trim()
    && String(settings.whatsappAccessToken || settings.accessToken || '').trim()
  );
  const hasStoredIntegration = Boolean(
    String(settings.whatsappProviderType || '').trim()
    || String(settings.whatsappPhoneNumber || settings.phoneNumber || '').trim()
  );

  if (hasDeropoCredentials || hasCustomCredentials || hasStoredIntegration) return true;
  return false;
};

const getProviderSettings = (settings = {}) => {
  const baseUrl = normalizeText(settings.whatsappApiBaseUrl || settings.apiBaseUrl || '');
  const instanceId = normalizeText(settings.whatsappInstanceId || settings.instanceId || settings.whatsappPhoneNumberId || '');
  const accessToken = normalizeText(settings.whatsappAccessToken || settings.accessToken || '');
  const phoneNumber = normalizeText(settings.whatsappPhoneNumber || settings.phoneNumber || '');
  const providerType = normalizeText(settings.whatsappProviderType || 'custom').toLowerCase() || 'custom';
  const active = resolveActiveFlag(settings);

  return {
    baseUrl,
    phoneNumber,
    instanceId,
    accessToken,
    accessTokenMasked: maskSecret(accessToken),
    providerType,
    active
  };
};

const buildWhatsAppCredentialDiagnostics = (settings = {}) => {
  const provider = getProviderSettings(settings);
  const missingFields = [];

  if (!provider.baseUrl) missingFields.push('API Base URL');
  if (provider.providerType !== 'deropo' && !provider.instanceId) missingFields.push('Instance ID');
  if (!provider.accessToken) missingFields.push('Access Token');

  return {
    providerType: provider.providerType,
    active: provider.active,
    baseUrlPresent: Boolean(provider.baseUrl),
    instanceIdPresent: Boolean(provider.instanceId),
    accessTokenPresent: Boolean(provider.accessToken),
    phoneNumberPresent: Boolean(provider.phoneNumber),
    missingFields,
    isConfigured: missingFields.length === 0
  };
};

const getAttachmentType = (attachmentUrl = '', attachmentName = '') => {
  const source = String(attachmentName || attachmentUrl || '').toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/.test(source)) return 'image';
  if (/\.(mp3|m4a|wav|ogg)$/.test(source)) return 'audio';
  return 'document';
};

const isPrivateIpv4 = (hostname) => {
  const parts = String(hostname || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
};

const validateWhatsAppAttachmentUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { ok: true, url: '' };
  if (/^(file:|\/|[A-Za-z]:[\\/]|\\\\)/i.test(raw)) {
    return { ok: false, url: '', error: 'Public server origin is not configured for WhatsApp attachments.' };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_error) {
    return { ok: false, url: '', error: 'Public server origin is not configured for WhatsApp attachments.' };
  }

  const hostname = String(parsed.hostname || '').toLowerCase();
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  const isUnsafeHost = parsed.protocol !== 'https:'
    || !hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || /hostinger/i.test(hostname)
    || isPrivateIpv4(normalizedHostname)
    || normalizedHostname === '::1'
    || normalizedHostname === '0.0.0.0'
    || /^(fc|fd|fe80:)/i.test(normalizedHostname);

  if (isUnsafeHost || parsed.username || parsed.password) {
    return { ok: false, url: '', error: 'Public server origin is not configured for WhatsApp attachments.' };
  }
  return { ok: true, url: parsed.toString() };
};

const createAttachmentValidationError = () => {
  const error = new Error('Public server origin is not configured for WhatsApp attachments.');
  error.statusCode = 400;
  return error;
};

const sanitizeProviderResponse = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeProviderResponse);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/(access.?token|authorization|password|secret|api.?key|credential)/i.test(key)) return [key, '[redacted]'];
    return [key, sanitizeProviderResponse(entry)];
  }));
};

const buildDeropoSendUrl = (baseUrl, params = {}) => {
  const url = new URL(`${String(baseUrl || '').replace(/\/+$/, '')}/send`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const extractProviderMessageId = (providerResponse) => {
  if (!providerResponse || typeof providerResponse !== 'object') return null;
  const value = providerResponse.messageId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getProviderErrorMessage = (status) => {
  if (status === 401 || status === 403) return 'WhatsApp provider authentication failed.';
  if (status >= 400 && status < 500) return 'WhatsApp provider rejected the request.';
  if (status >= 500) return 'WhatsApp provider server error.';
  return 'WhatsApp provider request failed.';
};

const createProviderError = ({ status, parsed, cause } = {}) => {
  const providerResponse = sanitizeProviderResponse(parsed && typeof parsed === 'object' ? parsed : { raw: String(parsed || '') });
  const error = new Error(status ? getProviderErrorMessage(status) : 'WhatsApp provider is unreachable.');
  error.isProviderError = true;
  error.statusCode = status ? 502 : 503;
  error.httpStatus = status || null;
  error.provider = 'deropo';
  error.ok = false;
  error.providerMessageId = extractProviderMessageId(providerResponse);
  error.providerResponse = providerResponse;
  error.response = providerResponse;
  error.providerErrorMessage = typeof providerResponse.message === 'string' ? providerResponse.message : '';
  error.errorMessage = error.providerErrorMessage || error.message;
  if (cause) error.cause = cause;
  return error;
};

const requestDeropo = async (baseUrl, params) => {
  let response;
  try {
    response = await safeFetch(buildDeropoSendUrl(baseUrl, params), { method: 'GET' });
  } catch (error) {
    throw createProviderError({ cause: error });
  }
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    parsed = { raw };
  }
  if (!response.ok) throw createProviderError({ status: response.status, parsed });
  const providerResponse = sanitizeProviderResponse(parsed);
  return {
    provider: 'deropo',
    httpStatus: response.status,
    ok: true,
    providerMessageId: extractProviderMessageId(parsed),
    providerResponse,
    errorMessage: null,
    response: providerResponse
  };
};

const sendDeropoText = async ({ provider, to, message }) => requestDeropo(provider.baseUrl, {
  number: to,
  message: String(message || ''),
  access_token: provider.accessToken,
  type: 'text'
});

const sendDeropoDocument = async ({ provider, to, message, attachmentUrl, attachmentName }) => {
  // Deropo document/media contract requires provider verification before modification.
  const params = {
    number: to,
    message: String(message || ''),
    access_token: provider.accessToken,
    type: getAttachmentType(attachmentUrl, attachmentName)
  };
  if (params.type === 'image') params.image_url = attachmentUrl;
  else if (params.type === 'audio') params.audio_url = attachmentUrl;
  else params.document_url = attachmentUrl;
  if (params.type === 'document' && attachmentName) params.file_name = attachmentName;
  return requestDeropo(provider.baseUrl, params);
};

const normalizePhoneNumber = (value) => {
  return normalizeWhatsAppPhoneNumber(value);
};

const validatePhoneNumber = (value) => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized || !isValidWhatsAppPhoneNumber(value)) {
    return { ok: false, normalized: '', error: 'Please enter a valid WhatsApp number.' };
  }
  return { ok: true, normalized };
};

const buildProviderConfig = (settings = {}) => {
  return getProviderSettings(settings);
};

const buildTemplateContext = (payload = {}, settings = {}) => {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const companyName = normalizeText(
    safe.company_name
    || safe.companyName
    || settings.companyName
    || settings.company_name
    || 'SKUAS Pest Control'
  );

  const customerName = normalizeText(safe.customer_name || safe.customerName || safe.recipientName || safe.name || '');
  const customerPhone = normalizeText(safe.customer_phone || safe.customerPhone || safe.phone || safe.mobile || '');
  const companyPhone = normalizeText(safe.company_phone || safe.companyPhone || settings.companyMobile || settings.companyPhone || settings.whatsappPhoneNumber || '');
  const companyWebsite = normalizeText(safe.company_website || safe.companyWebsite || settings.companyWebsite || '');
  const quotationNumber = normalizeText(safe.quotation_number || safe.quotationNumber || safe.quotation_no || safe.quotationNo || '');
  const invoiceNumber = normalizeText(safe.invoice_number || safe.invoiceNumber || safe.invoice_no || safe.invoiceNo || '');
  const invoiceAmount = normalizeText(safe.invoice_amount || safe.invoiceAmount || safe.total_amount || safe.totalAmount || '');
  const balanceDue = normalizeText(safe.balance_due || safe.balanceDue || '');
  const dueDate = normalizeText(safe.due_date || safe.dueDate || '');
  const serviceName = normalizeText(safe.service_name || safe.serviceName || safe.service_type || safe.serviceType || '');
  const jobNumber = normalizeText(safe.job_number || safe.jobNumber || safe.job_no || safe.jobNo || '');
  const jobDate = normalizeText(safe.job_date || safe.jobDate || '');
  const jobTime = normalizeText(safe.job_time || safe.jobTime || '');
  const technicianName = normalizeText(safe.technician_name || safe.technicianName || '');
  const technicianPhone = normalizeText(safe.technician_phone || safe.technicianPhone || '');
  const salesPerson = normalizeText(safe.sales_person || safe.salesPerson || safe.sales_person_name || safe.salesPersonName || '');
  const renewalDate = normalizeText(safe.renewal_date || safe.renewalDate || '');
  const complaintNumber = normalizeText(safe.complaint_number || safe.complaintNumber || safe.ticket_number || safe.ticketNumber || '');
  const paymentLink = normalizeText(safe.payment_link || safe.paymentLink || '');
  const invoiceDate = normalizeText(safe.invoice_date || safe.invoiceDate || safe.date || '');
  const quotationDate = normalizeText(safe.quotation_date || safe.quotationDate || safe.date || '');
  return {
    ...safe,
    customer_name: customerName,
    customer_phone: customerPhone,
    company_name: companyName,
    company_phone: companyPhone,
    company_website: companyWebsite,
    lead_number: normalizeText(safe.lead_number || safe.leadNumber || safe.lead_no || safe.leadNo || ''),
    quotation_number: quotationNumber,
    quotation_no: quotationNumber,
    quotation_date: quotationDate,
    invoice_number: invoiceNumber,
    invoice_no: invoiceNumber,
    invoice_date: invoiceDate,
    invoice_amount: invoiceAmount,
    total_amount: invoiceAmount,
    balance_due: balanceDue,
    due_date: dueDate,
    service_name: serviceName,
    service_type: serviceName,
    job_number: jobNumber,
    job_date: jobDate,
    job_time: jobTime,
    technician_name: technicianName,
    technician_phone: technicianPhone,
    sales_person: salesPerson,
    renewal_date: renewalDate,
    complaint_number: complaintNumber,
    payment_link: paymentLink
  };
};

const renderTemplate = (messageBody = '', contextData = {}, settings = {}) => {
  const payload = buildTemplateContext(contextData, settings);
  return replaceVariables(messageBody, payload).trim();
};

const sendWhatsAppMessage = async ({ settings, to, message, attachmentUrl, attachmentName }) => {
  const provider = buildProviderConfig(settings);
  const diagnostics = buildWhatsAppCredentialDiagnostics(settings);
  const phoneCheck = validatePhoneNumber(to);
  if (!phoneCheck.ok) throw new Error(phoneCheck.error);

  if (!diagnostics.isConfigured) {
    const error = new Error(`WhatsApp API credentials are incomplete. Missing: ${diagnostics.missingFields.join(', ')}.`);
    error.details = diagnostics;
    throw error;
  }

  if (!provider.active) {
    const error = new Error('WhatsApp API is inactive. Enable it in Settings > WhatsApp API Settings.');
    error.details = diagnostics;
    throw error;
  }

  if (provider.providerType === 'deropo') {
    if (!provider.baseUrl || !provider.accessToken) {
      throw new Error('WhatsApp API credentials are incomplete.');
    }

    if (attachmentUrl) {
      const attachmentCheck = validateWhatsAppAttachmentUrl(attachmentUrl);
      if (!attachmentCheck.ok) throw createAttachmentValidationError();
      return {
        success: true,
        normalizedPhone: phoneCheck.normalized,
        ...(await sendDeropoDocument({
          provider,
          to: phoneCheck.normalized,
          message,
          attachmentUrl: attachmentCheck.url,
          attachmentName
        }))
      };
    }
    return {
      success: true,
      normalizedPhone: phoneCheck.normalized,
      ...(await sendDeropoText({ provider, to: phoneCheck.normalized, message }))
    };
  }

  if (!provider.baseUrl || !provider.instanceId || !provider.accessToken) {
    throw new Error('WhatsApp API credentials are incomplete.');
  }

  const payload = {
    to: phoneCheck.normalized,
    phone: phoneCheck.normalized,
    number: phoneCheck.normalized,
    recipient: phoneCheck.normalized,
    message: String(message || ''),
    text: String(message || ''),
    instanceId: provider.instanceId,
    phoneNumber: provider.phoneNumber,
    attachmentUrl: attachmentUrl || '',
    attachmentName: attachmentName || ''
  };

  if (attachmentUrl) {
    const attachmentCheck = validateWhatsAppAttachmentUrl(attachmentUrl);
    if (!attachmentCheck.ok) throw createAttachmentValidationError();
    payload.attachmentUrl = attachmentCheck.url;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.accessToken}`
  };

  const response = await safeFetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    parsed = { raw };
  }

  if (!response.ok) {
    const error = new Error(`WhatsApp provider request failed (${response.status}).`);
    error.response = sanitizeProviderResponse(parsed);
    error.providerResponse = error.response;
    error.provider = provider.providerType;
    error.isProviderError = true;
    error.httpStatus = response.status;
    error.statusCode = 502;
    error.providerMessageId = extractProviderMessageId(error.response);
    throw error;
  }

  return {
    success: true,
    provider: provider.providerType,
    httpStatus: response.status,
    ok: true,
    providerMessageId: extractProviderMessageId(parsed),
    providerResponse: sanitizeProviderResponse(parsed),
    errorMessage: null,
    normalizedPhone: phoneCheck.normalized,
    response: sanitizeProviderResponse(parsed)
  };
};

const sendTextMessage = async (options = {}) => sendWhatsAppMessage(options);

const sendDocumentMessage = async (options = {}) => sendWhatsAppMessage(options);

const testConnection = async ({ settings, to, message, attachmentUrl, attachmentName } = {}) => {
  const provider = buildProviderConfig(settings);
  const diagnostics = buildWhatsAppCredentialDiagnostics(settings);
  if (!diagnostics.isConfigured) {
    const error = new Error(`WhatsApp API credentials are incomplete. Missing: ${diagnostics.missingFields.join(', ')}.`);
    error.details = diagnostics;
    throw error;
  }
  return sendWhatsAppMessage({
    settings,
    to,
    message: normalizeText(message) || 'WhatsApp API test message from CRM.',
    attachmentUrl,
    attachmentName
  });
};

module.exports = {
  normalizePhoneNumber,
  validatePhoneNumber,
  buildProviderConfig,
  getProviderSettings,
  buildWhatsAppCredentialDiagnostics,
  validateWhatsAppAttachmentUrl,
  extractProviderMessageId,
  buildTemplateContext,
  renderTemplate,
  sendTextMessage,
  sendDocumentMessage,
  testConnection,
  sendWhatsAppMessage
};
