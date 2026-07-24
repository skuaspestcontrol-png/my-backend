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

export const normalizePackUnit = (value) => {
  const unit = String(value || '').trim().toLowerCase();
  if (!unit) return '';
  if (['ml', 'millilitre', 'milliliter', 'millilitres', 'milliliters'].includes(unit)) return 'ml';
  if (['l', 'lt', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(unit)) return 'litre';
  if (['g', 'gram', 'grams'].includes(unit)) return 'gram';
  if (['kg', 'kilogram', 'kilograms'].includes(unit)) return 'kg';
  return unit;
};

export const getStockUnitLabel = (unit) => {
  const normalized = String(unit || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'ml' || normalized === 'litre' || normalized === 'liter') return 'Ltr';
  if (normalized === 'gram' || normalized === 'g') return 'gm';
  if (normalized === 'kg') return 'kg';
  if (normalized === 'piece' || normalized === 'pcs') return 'piece';
  if (normalized === 'bottle') return 'bottle';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const formatStockNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  const rounded = Number(parsed.toFixed(3));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

export const parsePackSizePerBottle = (value) => {
  const raw = String(value || '').trim().replace(/,/g, '');
  if (!raw) return { quantity: 0, unit: '', valid: false };
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return { quantity: 0, unit: '', valid: false };
  return {
    quantity: Number(match[1]),
    unit: normalizePackUnit(match[2]),
    valid: true
  };
};

export const computeStockFromPackSize = (packSizePerBottle, bottleCount, itemUnit = '') => {
  const parsed = parsePackSizePerBottle(packSizePerBottle);
  const bottles = Number(bottleCount || 0);
  const normalizedItemUnit = String(itemUnit || '').trim().toLowerCase();
  if (!parsed.valid || parsed.quantity <= 0 || bottles <= 0) {
    return {
      value: 0,
      unit: '',
      unitLabel: '',
      bottles,
      packQuantity: parsed.quantity,
      packUnit: parsed.unit,
      formula: ''
    };
  }

  let value = parsed.quantity * bottles;
  let unit = parsed.unit;
  const shouldConvertMl = unit === 'ml' || (!unit && ['ml', 'litre', 'liter'].includes(normalizedItemUnit));
  if (shouldConvertMl) {
    value /= 1000;
    unit = 'litre';
  }

  const rounded = Number(value.toFixed(3));
  const bottleLabel = bottles === 1 ? 'bottle' : 'bottles';
  const displayUnit = getStockUnitLabel(unit);
  return {
    value: rounded,
    unit,
    unitLabel: displayUnit,
    bottles,
    packQuantity: parsed.quantity,
    packUnit: parsed.unit,
    formula: `${formatStockNumber(parsed.quantity)}${parsed.unit || ''} × ${formatStockNumber(bottles)} ${bottleLabel}`
  };
};

export const formatCurrentStockDisplay = (row = {}) => {
  if (row.currentStockDisplay) return String(row.currentStockDisplay);
  const stockMeta = computeStockFromPackSize(row.packSizePerBottle || row.pack_size_per_bottle, row.noOfBottles || row.no_of_bottles, row.unit || row.itemUnit || row.item_unit);
  if (stockMeta.value > 0 && stockMeta.unitLabel) {
    return `${formatStockNumber(stockMeta.value)} ${stockMeta.unitLabel}`;
  }
  const rawValue = Number(row.currentStock ?? row.current_stock ?? 0);
  const unit = String(row.unit || row.itemUnit || row.item_unit || '').trim().toLowerCase();
  if (unit === 'ml' && Number.isFinite(rawValue) && rawValue > 0) {
    return `${formatStockNumber(rawValue / 1000)} Ltr`;
  }
  if (Number.isFinite(rawValue) && rawValue > 0 && unit) {
    const label = getStockUnitLabel(unit);
    const liquidUnits = ['ml', 'litre', 'liter'];
    if (liquidUnits.includes(unit)) return `${formatStockNumber(rawValue)} ${label || 'Ltr'}`;
    return label ? `${formatStockNumber(rawValue)} ${label}` : formatStockNumber(rawValue);
  }
  const value = rawValue;
  return formatStockNumber(value);
};

export const formatDateInputValue = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const dateOnly = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : '';
};

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

export const money = (value = 0) => {
  const formatted = Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted}`;
};

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
