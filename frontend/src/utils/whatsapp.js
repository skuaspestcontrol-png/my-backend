import axios from 'axios';

const trimTrailingSlash = (value = '') => String(value || '').trim().replace(/\/+$/, '');

export const sendTextWhatsAppMessage = (baseUrl, payload, config = {}) => {
  const root = trimTrailingSlash(baseUrl);
  const endpoint = `${root}/api/whatsapp/send`;
  return axios.post(endpoint, payload, config);
};
