const normalizePhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
};

const validatePhoneNumber = (value) => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return { ok: false, normalized: '', error: 'Valid phone number is required.' };
  return { ok: true, normalized };
};

const buildProviderConfig = (settings = {}) => {
  return {
    baseUrl: String(settings.whatsappApiBaseUrl || settings.apiBaseUrl || '').trim(),
    phoneNumber: String(settings.whatsappPhoneNumber || settings.phoneNumber || '').trim(),
    instanceId: String(settings.whatsappInstanceId || settings.instanceId || settings.whatsappPhoneNumberId || '').trim(),
    accessToken: String(settings.whatsappAccessToken || settings.accessToken || '').trim(),
    providerType: String(settings.whatsappProviderType || 'custom').trim().toLowerCase(),
    active: Boolean(settings.whatsappApiActive)
  };
};

const sendWhatsAppMessage = async ({ settings, to, message, attachmentUrl, attachmentName }) => {
  const provider = buildProviderConfig(settings);
  const phoneCheck = validatePhoneNumber(to);
  if (!phoneCheck.ok) throw new Error(phoneCheck.error);
  if (!provider.active) throw new Error('WhatsApp API is inactive.');
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
  sendWhatsAppMessage
};
