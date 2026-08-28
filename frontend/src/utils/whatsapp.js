import axios from 'axios';

const trimTrailingSlash = (value = '') => String(value || '').trim().replace(/\/+$/, '');

export const buildTextWhatsAppPayload = ({
  moduleType,
  templateType = 'custom_message',
  recipientName = '',
  recipientPhone = '',
  recipientType = 'Customer',
  sentByUser = 'User',
  moduleName = moduleType || '',
  message = '',
  contextData = {},
  ...rest
} = {}) => ({
  moduleType,
  templateType,
  recipientName,
  recipientPhone,
  recipientType,
  sentByUser,
  moduleName,
  message,
  contextData,
  ...rest
});

export const sendTextWhatsAppMessage = (baseUrl, payload, config = {}) => {
  const root = trimTrailingSlash(baseUrl);
  const endpoint = `${root}/api/whatsapp/send`;
  return axios.post(endpoint, payload, config);
};
