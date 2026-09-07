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

const buildDeropoSendUrl = (baseUrl, params = {}) => {
  const url = new URL(`${String(baseUrl || '').replace(/\/+$/, '')}/send`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
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

  return {
    ...safe,
    customer_name: normalizeText(safe.customer_name || safe.customerName || safe.recipientName || safe.name || ''),
    customer_phone: normalizeText(safe.customer_phone || safe.customerPhone || safe.phone || safe.mobile || ''),
    company_name: companyName,
    company_phone: normalizeText(safe.company_phone || safe.companyPhone || settings.companyMobile || settings.companyPhone || settings.whatsappPhoneNumber || ''),
    company_website: normalizeText(safe.company_website || safe.companyWebsite || settings.companyWebsite || ''),
    lead_number: normalizeText(safe.lead_number || safe.leadNumber || safe.lead_no || safe.leadNo || ''),
    quotation_number: normalizeText(safe.quotation_number || safe.quotationNumber || safe.quotation_no || safe.quotationNo || ''),
    invoice_number: normalizeText(safe.invoice_number || safe.invoiceNumber || safe.invoice_no || safe.invoiceNo || ''),
    invoice_amount: normalizeText(safe.invoice_amount || safe.invoiceAmount || ''),
    balance_due: normalizeText(safe.balance_due || safe.balanceDue || ''),
    due_date: normalizeText(safe.due_date || safe.dueDate || ''),
    service_name: normalizeText(safe.service_name || safe.serviceName || safe.service_type || safe.serviceType || ''),
    job_number: normalizeText(safe.job_number || safe.jobNumber || safe.job_no || safe.jobNo || ''),
    job_date: normalizeText(safe.job_date || safe.jobDate || ''),
    job_time: normalizeText(safe.job_time || safe.jobTime || ''),
    technician_name: normalizeText(safe.technician_name || safe.technicianName || ''),
    technician_phone: normalizeText(safe.technician_phone || safe.technicianPhone || ''),
    sales_person: normalizeText(safe.sales_person || safe.salesPerson || safe.sales_person_name || safe.salesPersonName || ''),
    renewal_date: normalizeText(safe.renewal_date || safe.renewalDate || ''),
    complaint_number: normalizeText(safe.complaint_number || safe.complaintNumber || safe.ticket_number || safe.ticketNumber || ''),
    payment_link: normalizeText(safe.payment_link || safe.paymentLink || ''),
    ...safe,
    company_name: companyName
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

    const attachmentType = attachmentUrl ? getAttachmentType(attachmentUrl, attachmentName) : '';
    const params = {
      number: phoneCheck.normalized,
      message: String(message || ''),
      access_token: provider.accessToken,
      type: 'text'
    };

    if (attachmentUrl) {
      params.type = attachmentType;
      if (attachmentType === 'image') params.image_url = attachmentUrl;
      else if (attachmentType === 'audio') params.audio_url = attachmentUrl;
      else params.document_url = attachmentUrl;
      if (attachmentType === 'document' && attachmentName) params.file_name = attachmentName;
    }

    const response = await fetch(buildDeropoSendUrl(provider.baseUrl, params), { method: 'GET' });
    const raw = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = { raw };
    }

    if (!response.ok) {
      const error = new Error(parsed?.message || `WhatsApp API failed (${response.status})`);
      error.response = parsed;
      error.statusCode = response.status;
      throw error;
    }

    return {
      success: true,
      provider: provider.providerType,
      normalizedPhone: phoneCheck.normalized,
      response: parsed
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

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.accessToken}`
  };

  const response = await fetch(provider.baseUrl, {
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
    const error = new Error(parsed?.message || `WhatsApp API failed (${response.status})`);
    error.response = parsed;
    error.statusCode = response.status;
    throw error;
  }

  return {
    success: true,
    provider: provider.providerType,
    normalizedPhone: phoneCheck.normalized,
    response: parsed
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
  buildTemplateContext,
  renderTemplate,
  sendTextMessage,
  sendDocumentMessage,
  testConnection,
  sendWhatsAppMessage
};
