import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const SALES_PERFORMANCE_REFRESH_KEY = 'sales_performance_refresh_at';
const CONTRACTS_REFRESH_KEY = 'contracts_refresh_at';
const RENEWALS_REFRESH_KEY = 'renewals_refresh_at';

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth() + 1;

export const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2026, index, 1).toLocaleString('en-IN', { month: 'short' })
}));

export const safeRows = (value) => (Array.isArray(value) ? value : []);

export const number = (value = 0) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const floorToDecimals = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.floor(Number(value || 0) * factor) / factor;
};
export const formatCompactIndianCurrency = (value = 0) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '₹0';

  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);
  const formatValue = (nextValue, { minimumFractionDigits = 0, maximumFractionDigits = 1 } = {}) => (
    Number(nextValue).toLocaleString('en-IN', { minimumFractionDigits, maximumFractionDigits })
  );

  if (absolute >= 10000000) {
    return `${sign}₹${formatValue(floorToDecimals(absolute / 10000000, 2), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}Cr`;
  }

  if (absolute >= 100000) {
    return `${sign}₹${formatValue(floorToDecimals(absolute / 100000, 2), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}L`;
  }

  return `${sign}₹${formatValue(floorToDecimals(absolute / 100000, 2), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}L`;
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

export const triggerSalesPerformanceRefresh = () => {
  const stamp = String(Date.now());
  try {
    window.localStorage.setItem(SALES_PERFORMANCE_REFRESH_KEY, stamp);
  } catch (_error) {}
  try {
    window.dispatchEvent(new CustomEvent('sales-performance:refresh', { detail: { stamp } }));
  } catch (_error) {}
};

export const subscribeSalesPerformanceRefresh = (handler) => {
  const onCustomRefresh = () => handler();
  const onStorageRefresh = (event) => {
    if (event.key === SALES_PERFORMANCE_REFRESH_KEY) handler();
  };
  window.addEventListener('sales-performance:refresh', onCustomRefresh);
  window.addEventListener('storage', onStorageRefresh);
  return () => {
    window.removeEventListener('sales-performance:refresh', onCustomRefresh);
    window.removeEventListener('storage', onStorageRefresh);
  };
};

export const triggerContractsRefresh = () => {
  const stamp = String(Date.now());
  try {
    window.localStorage.setItem(CONTRACTS_REFRESH_KEY, stamp);
  } catch (_error) {}
  try {
    window.dispatchEvent(new CustomEvent('contracts:refresh', { detail: { stamp } }));
  } catch (_error) {}
};

export const subscribeContractsRefresh = (handler) => {
  const onCustomRefresh = () => handler();
  const onStorageRefresh = (event) => {
    if (event.key === CONTRACTS_REFRESH_KEY) handler();
  };
  window.addEventListener('contracts:refresh', onCustomRefresh);
  window.addEventListener('storage', onStorageRefresh);
  return () => {
    window.removeEventListener('contracts:refresh', onCustomRefresh);
    window.removeEventListener('storage', onStorageRefresh);
  };
};

export const triggerRenewalsRefresh = () => {
  const stamp = String(Date.now());
  try {
    window.localStorage.setItem(RENEWALS_REFRESH_KEY, stamp);
  } catch (_error) {}
  try {
    window.dispatchEvent(new CustomEvent('renewals:refresh', { detail: { stamp } }));
  } catch (_error) {}
};

export const subscribeRenewalsRefresh = (handler) => {
  const onCustomRefresh = () => handler();
  const onStorageRefresh = (event) => {
    if (event.key === RENEWALS_REFRESH_KEY) handler();
  };
  window.addEventListener('renewals:refresh', onCustomRefresh);
  window.addEventListener('storage', onStorageRefresh);
  return () => {
    window.removeEventListener('renewals:refresh', onCustomRefresh);
    window.removeEventListener('storage', onStorageRefresh);
  };
};

export const buildCsv = (rows = [], columns = []) => {
  const safeValue = (value) => {
    const text = String(value ?? '');
    const excelSafeText = /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(text) ? `'${text}` : text;
    if (/[,"\n]/.test(excelSafeText)) return `"${excelSafeText.replace(/"/g, '""')}"`;
    return excelSafeText;
  };
  const headers = columns.length ? columns : rows.length ? Object.keys(rows[0]) : [];
  return [
    headers.map(safeValue).join(','),
    ...rows.map((row) => headers.map((header) => safeValue(row?.[header])).join(','))
  ].join('\n');
};

export const downloadCsv = (rows = [], filename = 'sales-performance.csv', columns = []) => {
  const csv = buildCsv(rows, columns);
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
