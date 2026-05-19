import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth() + 1;

export const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2026, index, 1).toLocaleString('en-IN', { month: 'short' })
}));

export const safeRows = (value) => (Array.isArray(value) ? value : []);

export const number = (value = 0) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const formatCompactIndianCurrency = (value = 0) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '₹0';

  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);
  const formatValue = (nextValue, { minimumFractionDigits = 0, maximumFractionDigits = 1 } = {}) => (
    Number(nextValue).toLocaleString('en-IN', { minimumFractionDigits, maximumFractionDigits })
  );

  if (absolute >= 10000000) {
    return `${sign}₹${formatValue(absolute / 10000000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}Cr`;
  }

  if (absolute >= 100000) {
    return `${sign}₹${formatValue(absolute / 100000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}L`;
  }

  if (absolute >= 1000) {
    const scaled = absolute / 1000;
    const hasDecimal = absolute < 10000 && !Number.isInteger(scaled);
    return `${sign}₹${formatValue(scaled, { minimumFractionDigits: 0, maximumFractionDigits: hasDecimal ? 1 : 0 })}K`;
  }

  return `${sign}₹${formatValue(absolute, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
};
export const money = (value = 0) => formatCompactIndianCurrency(value);
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

export const buildCsv = (rows = []) => {
  const safeValue = (value) => {
    const text = String(value ?? '');
    if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return [
    headers.map(safeValue).join(','),
    ...rows.map((row) => headers.map((header) => safeValue(row?.[header])).join(','))
  ].join('\n');
};

export const downloadCsv = (rows = [], filename = 'sales-performance.csv') => {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
