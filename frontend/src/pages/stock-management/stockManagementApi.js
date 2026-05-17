import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const safeRows = (value) => (Array.isArray(value) ? value : []);

export const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: month,
    label: new Date(2026, index, 1).toLocaleString('en-IN', { month: 'long' })
  };
});

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth() + 1;

export const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const decimal = (value = 0) => Number(value || 0).toFixed(3);

export const money = (value = 0) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const percent = (value = 0) => `${Number(value || 0).toFixed(1)}%`;

export const apiGet = async (path, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}${path}`, { params });
  return response.data;
};

export const apiPost = async (path, body = {}) => {
  const response = await axios.post(`${API_BASE_URL}${path}`, body);
  return response.data;
};

export const apiPut = async (path, body = {}) => {
  const response = await axios.put(`${API_BASE_URL}${path}`, body);
  return response.data;
};

export const apiDelete = async (path) => {
  const response = await axios.delete(`${API_BASE_URL}${path}`);
  return response.data;
};

export const downloadExportUrl = ({ reportType = 'current-stock', format = 'excel', params = {} } = {}) => {
  const search = new URLSearchParams();
  search.set('reportType', reportType);
  search.set('format', format);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return `${API_BASE_URL}/api/stock/export?${search.toString()}`;
};

