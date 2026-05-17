import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: month,
    label: new Date(2026, index, 1).toLocaleString('en-IN', { month: 'long' })
  };
});

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth() + 1;

export const currency = (value = 0) =>
  Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (value = 0) => `₹${currency(value)}`;

export const percent = (value = 0) => `${Number(value || 0).toFixed(1)}%`;

export const integer = (value = 0) => Number(value || 0).toLocaleString('en-IN');

export const safeRows = (value) => (Array.isArray(value) ? value : []);

export const buildSearchParams = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search;
};

export const apiGet = async (path, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}${path}`, { params });
  return response.data;
};

export const salesExportUrl = ({ scope, format = 'xls', params = {} }) => {
  const search = buildSearchParams({ scope, format, ...params });
  return `${API_BASE_URL}/api/sales-performance/export?${search.toString()}`;
};

export const summaryLine = (target = 0, achieved = 0) => {
  const pending = Math.max(Number(target || 0) - Number(achieved || 0), 0);
  const achievementPercent = Number(target || 0) > 0 ? (Number(achieved || 0) / Number(target || 0)) * 100 : 0;
  return { pending, achievementPercent };
};

