import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const stockCategories = [
  'Chemical',
  'Gel / Bait',
  'Glue Pad Traps-Big',
  'Glue Pad Traps-Small',
  'Roda Boxes',
  'Equipment',
  'PPE',
  'Consumable',
  'Other'
];

export const stockCategoryDisplayLabel = (value) => {
  const label = String(value || '').trim();
  if (!label) return '-';
  if (label === 'Rodent Control') return 'Glue Pad Traps-Big';
  return label;
};

export const stockUnits = ['ml', 'litre', 'gram', 'kg', 'tube', 'piece', 'box', 'packet', 'bottle', 'can'];

export const reportTypes = [
  { value: 'current-stock', label: 'Current Stock' },
  { value: 'technician-stock', label: 'Technician Stock' },
  { value: 'ledger', label: 'Stock Ledger' },
  { value: 'purchase', label: 'Purchase Report' },
  { value: 'usage', label: 'Usage Report' },
  { value: 'low-stock', label: 'Low Stock Report' },
  { value: 'expiry', label: 'Expiry Report' }
];

export const movementTypes = [
  { value: '', label: 'All Movements' },
  { value: 'opening', label: 'Opening' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'issue', label: 'Issue' },
  { value: 'usage', label: 'Usage' },
  { value: 'return', label: 'Return' },
  { value: 'wastage', label: 'Wastage' },
  { value: 'damage', label: 'Damage' },
  { value: 'expired', label: 'Expired' },
  { value: 'adjustment', label: 'Adjustment' }
];

export const safeRows = (value) => (Array.isArray(value) ? value : []);

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const money = (value = 0) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const number = (value = 0) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

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

export const exportUrl = ({ reportType = 'current-stock', format = 'csv', params = {} } = {}) => {
  const search = new URLSearchParams();
  search.set('reportType', reportType);
  search.set('format', format);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return `${API_BASE_URL}/api/stock/export?${search.toString()}`;
};
