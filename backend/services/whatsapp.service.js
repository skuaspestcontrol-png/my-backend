const { normalizeIndianMobileNumber } = require('../lib/phone');

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
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

const buildWhatsAppCredentialDiagnostics = (settings = {}) => {
  const providerType = String(settings.whatsappProviderType || 'custom').trim().toLowerCase();
  const baseUrl = String(settings.whatsappApiBaseUrl || settings.apiBaseUrl || '').trim();
  const instanceId = String(settings.whatsappInstanceId || settings.instanceId || settings.whatsappPhoneNumberId || '').trim();
  const accessToken = String(settings.whatsappAccessToken || settings.accessToken || '').trim();
  const phoneNumber = String(settings.whatsappPhoneNumber || settings.phoneNumber || '').trim();
  const missingFields = [];

  if (!baseUrl) missingFields.push('API Base URL');
  if (providerType !== 'deropo' && !instanceId) missingFields.push('Instance ID');
  if (!accessToken) missingFields.push('Access Token');

  const active = resolveActiveFlag(settings);

  return {
    providerType,
    active,
    baseUrlPresent: Boolean(baseUrl),
    instanceIdPresent: Boolean(instanceId),
    accessTokenPresent: Boolean(accessToken),
    phoneNumberPresent: Boolean(phoneNumber),
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
  const digits = normalizeIndianMobileNumber(value);
  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  return '';
};

const validatePhoneNumber = (value) => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return { ok: false, normalized: '', error: 'Please enter a valid 10 digit mobile number.' };
  return { ok: true, normalized };
};

const buildProviderConfig = (settings = {}) => {
  return {
    baseUrl: String(settings.whatsappApiBaseUrl || settings.apiBaseUrl || '').trim(),
    phoneNumber: String(settings.whatsappPhoneNumber || settings.phoneNumber || '').trim(),
    instanceId: String(settings.whatsappInstanceId || settings.instanceId || settings.whatsappPhoneNumberId || '').trim(),
    accessToken: String(settings.whatsappAccessToken || settings.accessToken || '').trim(),
    providerType: String(settings.whatsappProviderType || 'custom').trim().toLowerCase(),
    active: resolveActiveFlag(settings)
  };
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

module.exports = {
  normalizePhoneNumber,
  validatePhoneNumber,
  buildProviderConfig,
  buildWhatsAppCredentialDiagnostics,
  sendWhatsAppMessage
};
