const express = require('express');
const PDFDocument = require('pdfkit');
const { query: dbQuery, getConnection } = require('../lib/db');

const router = express.Router();

const CATEGORIES = ['Chemical', 'Gel / Bait', 'Glue Pad Traps-Big', 'Glue Pad Traps-Small', 'Roda Boxes', 'Equipment', 'PPE', 'Consumable', 'Other'];
const UNITS = ['ml', 'litre', 'gram', 'kg', 'tube', 'piece', 'box', 'packet', 'bottle', 'can'];
const EXPIRY_ALERT_DAYS = 30;
const DEFAULT_LIMIT = 1000;

const text = (value) => String(value ?? '').trim();
const normalizeUnit = (value) => {
  const unit = text(value).toLowerCase();
  if (!unit) return '';
  if (unit === 'pcs') return 'piece';
  return unit;
};
const normalizePackUnit = (value) => {
  const unit = text(value).toLowerCase();
  if (!unit) return '';
  if (['ml', 'millilitre', 'milliliter', 'millilitres', 'milliliters'].includes(unit)) return 'ml';
  if (['l', 'lt', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(unit)) return 'litre';
  if (['g', 'gram', 'grams'].includes(unit)) return 'gram';
  if (['kg', 'kilogram', 'kilograms'].includes(unit)) return 'kg';
  return unit;
};
const getStockUnitLabel = (unit) => {
  const normalized = text(unit).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'ml' || normalized === 'litre' || normalized === 'liter') return 'Ltr';
  if (normalized === 'gram' || normalized === 'g') return 'gm';
  if (normalized === 'kg') return 'kg';
  if (normalized === 'piece' || normalized === 'pcs') return 'piece';
  if (normalized === 'bottle') return 'bottle';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
const formatStockNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  const rounded = Number(parsed.toFixed(3));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};
const parsePackSizePerBottle = (value) => {
  const raw = text(value).replace(/,/g, '');
  if (!raw) return { quantity: 0, unit: '', valid: false };
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return { quantity: 0, unit: '', valid: false };
  return {
    quantity: num(match[1]),
    unit: normalizePackUnit(match[2]),
    valid: true
  };
};
const computeStockFromPackSize = (packSizePerBottle, bottleCount, itemUnit = '') => {
  const parsed = parsePackSizePerBottle(packSizePerBottle);
  const bottles = num(bottleCount);
  const normalizedItemUnit = text(itemUnit).toLowerCase();
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

  const valueRounded = round3(value);
  const bottleLabel = bottles === 1 ? 'bottle' : 'bottles';
  const displayUnit = getStockUnitLabel(unit);
  return {
    value: valueRounded,
    unit,
    unitLabel: displayUnit,
    bottles,
    packQuantity: parsed.quantity,
    packUnit: parsed.unit,
    formula: `${formatStockNumber(parsed.quantity)}${parsed.unit || ''} × ${formatStockNumber(bottles)} ${bottleLabel}`
  };
};
const formatCurrentStockDisplay = (row = {}) => {
  const stockMeta = computeStockFromPackSize(row.pack_size_per_bottle, row.no_of_bottles, row.unit);
  if (stockMeta.value > 0 && stockMeta.unitLabel) {
    return {
      value: stockMeta.value,
      unitLabel: stockMeta.unitLabel,
      display: `${formatStockNumber(stockMeta.value)} ${stockMeta.unitLabel}`,
      formula: stockMeta.formula
    };
  }
  const rawValue = num(row.current_stock);
  const unit = text(row.unit || '').toLowerCase();
  if (unit === 'ml' && rawValue > 0) {
    const liters = round3(rawValue / 1000);
    return {
      value: liters,
      unitLabel: 'Ltr',
      display: `${formatStockNumber(liters)} Ltr`,
      formula: ''
    };
  }
  return {
    value: rawValue,
    unitLabel: unit ? getStockUnitLabel(unit) : '',
    display: unit ? `${formatStockNumber(rawValue)} ${getStockUnitLabel(unit)}` : formatStockNumber(rawValue),
    formula: ''
  };
};
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const round3 = (value) => Number(num(value).toFixed(3));
const round2 = (value) => Number(num(value).toFixed(2));
const intOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const dateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};
const monthKey = (year, month) => `${Number(year)}-${String(Number(month)).padStart(2, '0')}`;
const monthLabel = (year, month) => new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-IN', { month: 'short' });
const safeRows = (value) => (Array.isArray(value) ? value : []);
const sendError = (res, status, message) => res.status(status).json({ success: false, error: message });
const jsonSafe = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }
  return fallback;
};

const getColumns = async (tableName) => {
  try {
    const rows = await dbQuery(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    return new Set(safeRows(rows).map((row) => text(row.COLUMN_NAME).toLowerCase()).filter(Boolean));
  } catch (_error) {
    return new Set();
  }
};

const ensureColumn = async (tableName, columnName, ddl) => {
  const columns = await getColumns(tableName);
  if (columns.has(String(columnName).toLowerCase())) return;
  await dbQuery(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
};

const ensureSchema = async () => {
  await dbQuery(`CREATE TABLE IF NOT EXISTS stock_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    item_code VARCHAR(100) NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'Other',
    unit VARCHAR(50) NOT NULL,
    hsn_sac VARCHAR(100) NULL,
    pack_size_per_bottle VARCHAR(100) NULL,
    no_of_bottles DECIMAL(12,3) DEFAULT 0,
    opening_stock DECIMAL(12,3) DEFAULT 0,
    current_stock DECIMAL(12,3) DEFAULT 0,
    min_stock_level DECIMAL(12,3) DEFAULT 0,
    purchase_rate DECIMAL(12,2) DEFAULT 0,
    gst_percent DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    vendor_id INT NULL,
    batch_number VARCHAR(100) NULL,
    expiry_date DATE NULL,
    storage_location VARCHAR(255) NULL,
    description TEXT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_stock_items_name (item_name),
    INDEX idx_stock_items_category (category),
    INDEX idx_stock_items_expiry (expiry_date)
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS stock_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NULL,
    purchase_date DATE NOT NULL,
    invoice_number VARCHAR(100) NULL,
    item_id INT NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    rate DECIMAL(12,2) DEFAULT 0,
    gst_percent DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    batch_number VARCHAR(100) NULL,
    expiry_date DATE NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_purchases_item (item_id),
    INDEX idx_stock_purchases_vendor (vendor_id),
    INDEX idx_stock_purchases_date (purchase_date)
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS stock_technician_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    technician_id INT NOT NULL,
    item_id INT NOT NULL,
    current_balance DECIMAL(12,3) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_technician_item (technician_id, item_id),
    INDEX idx_stock_tech_balance_technician (technician_id),
    INDEX idx_stock_tech_balance_item (item_id)
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    movement_type ENUM('opening','purchase','issue','usage','return','wastage','damage','expired','adjustment') NOT NULL,
    item_id INT NOT NULL,
    technician_id INT NULL,
    vendor_id INT NULL,
    customer_id INT NULL,
    contract_id INT NULL,
    job_id INT NULL,
    service_type VARCHAR(150) NULL,
    source_location ENUM('office','technician') DEFAULT 'office',
    in_qty DECIMAL(12,3) DEFAULT 0,
    out_qty DECIMAL(12,3) DEFAULT 0,
    office_balance_after DECIMAL(12,3) DEFAULT 0,
    technician_balance_after DECIMAL(12,3) DEFAULT 0,
    unit VARCHAR(50) NOT NULL,
    reference_type VARCHAR(100) NULL,
    reference_id INT NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_movements_item (item_id),
    INDEX idx_stock_movements_date (movement_date),
    INDEX idx_stock_movements_type (movement_type),
    INDEX idx_stock_movements_technician (technician_id)
  )`);

  await ensureColumn('stock_purchases', 'item_id', 'item_id INT NULL');
  await ensureColumn('stock_movements', 'source_location', "source_location ENUM('office','technician') DEFAULT 'office'");
  await ensureColumn('stock_movements', 'reference_type', 'reference_type VARCHAR(100) NULL');
  await ensureColumn('stock_movements', 'reference_id', 'reference_id INT NULL');
  await ensureColumn('stock_movements', 'customer_id', 'customer_id INT NULL');
  await ensureColumn('stock_movements', 'contract_id', 'contract_id INT NULL');
  await ensureColumn('stock_movements', 'job_id', 'job_id INT NULL');
  await ensureColumn('stock_movements', 'service_type', 'service_type VARCHAR(150) NULL');
  await ensureColumn('stock_movements', 'office_balance_after', 'office_balance_after DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_movements', 'technician_balance_after', 'technician_balance_after DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_movements', 'unit', 'unit VARCHAR(50) NULL');
  await ensureColumn('stock_movements', 'created_by', 'created_by INT NULL');
  await ensureColumn('stock_items', 'current_stock', 'current_stock DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_items', 'min_stock_level', 'min_stock_level DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_items', 'purchase_rate', 'purchase_rate DECIMAL(12,2) DEFAULT 0');
  await ensureColumn('stock_items', 'gst_percent', 'gst_percent DECIMAL(5,2) DEFAULT 0');
  await ensureColumn('stock_items', 'total_amount', 'total_amount DECIMAL(12,2) DEFAULT 0');
  await ensureColumn('stock_items', 'vendor_id', 'vendor_id INT NULL');
  await ensureColumn('stock_items', 'batch_number', 'batch_number VARCHAR(100) NULL');
  await ensureColumn('stock_items', 'expiry_date', 'expiry_date DATE NULL');
  await ensureColumn('stock_items', 'hsn_sac', 'hsn_sac VARCHAR(100) NULL');
  await ensureColumn('stock_items', 'pack_size_per_bottle', 'pack_size_per_bottle VARCHAR(100) NULL');
  await ensureColumn('stock_items', 'no_of_bottles', 'no_of_bottles DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_items', 'storage_location', 'storage_location VARCHAR(255) NULL');
  await ensureColumn('stock_items', 'description', 'description TEXT NULL');
  await ensureColumn('stock_items', 'is_active', 'is_active TINYINT(1) DEFAULT 1');
  await ensureColumn('stock_technician_balances', 'current_balance', 'current_balance DECIMAL(12,3) DEFAULT 0');

  const purchaseColumns = await getColumns('stock_purchases');
  if (purchaseColumns.has('product_id') && purchaseColumns.has('item_id')) {
    await dbQuery('UPDATE stock_purchases SET item_id = COALESCE(item_id, product_id) WHERE item_id IS NULL AND product_id IS NOT NULL');
  }
  await dbQuery("UPDATE stock_items SET category = 'Glue Pad Traps-Big' WHERE category = 'Rodent Control'");
  await dbQuery("UPDATE stock_items SET unit = 'piece' WHERE LOWER(unit) = 'pcs'");
};

let schemaReadyPromise = null;
const ensureSchemaReady = async () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema();
  }
  return schemaReadyPromise;
};

const firstRow = (rows) => (Array.isArray(rows) ? rows[0] : null);
const isPositive = (value) => num(value) > 0;
const stockStatus = (item) => {
  const current = num(item.current_stock);
  const min = num(item.min_stock_level);
  if (current <= 0) return 'Out of Stock';
  if (current <= min) return 'Low Stock';
  return 'In Stock';
};

const safeName = (value, fallback) => text(value) || fallback;
const getProvidedValue = (body, ...keys) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) return body[key];
  }
  return undefined;
};
const coerceStockValue = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return round3(fallback);
  return round3(value);
};
const coerceOptionalText = (value, fallback = null) => {
  if (value === undefined) return fallback;
  const cleaned = text(value);
  return cleaned || null;
};
const resolveItemStockFields = (body = {}, existing = null) => {
  const packSizePerBottle = coerceOptionalText(getProvidedValue(body, 'packSizePerBottle', 'pack_size_per_bottle'), text(existing?.pack_size_per_bottle));
  const noOfBottles = coerceStockValue(getProvidedValue(body, 'noOfBottles', 'no_of_bottles'), num(existing?.no_of_bottles));
  const stockMeta = computeStockFromPackSize(packSizePerBottle, noOfBottles);
  const fallbackOpening = coerceStockValue(getProvidedValue(body, 'openingStock', 'opening_stock'), num(existing?.opening_stock));
  const fallbackCurrent = coerceStockValue(getProvidedValue(body, 'currentStock', 'current_stock'), num(existing?.current_stock ?? fallbackOpening));
  const computedStock = stockMeta.value > 0 ? stockMeta.value : fallbackCurrent;
  const openingStock = stockMeta.value > 0 ? stockMeta.value : fallbackOpening;
  return {
    packSizePerBottle,
    noOfBottles,
    openingStock: round3(openingStock),
    currentStock: round3(computedStock),
    stockMeta
  };
};

const loadVendors = async () => {
  try {
    const rows = await dbQuery('SELECT * FROM vendors ORDER BY id DESC');
    return safeRows(rows).map((row) => ({
      id: row.id,
      name: safeName(row.vendor_name || row.company_name || row.name || row.display_name, `Vendor ${row.id}`)
    }));
  } catch (_error) {
    return [];
  }
};

const loadTechnicians = async () => {
  try {
    const rows = await dbQuery('SELECT * FROM employees ORDER BY id DESC');
    const mapped = safeRows(rows).map((row) => {
      const payload = jsonSafe(row.payload, {});
      const name = safeName(
        row.full_name || payload.fullName || [row.first_name, row.last_name].filter(Boolean).join(' ') || payload.name || row.name,
        `Employee ${row.id}`
      );
      const role = text(row.role || row.role_name || payload.role || payload.roleName || '');
      const department = text(row.department || payload.department || '');
      const status = text(row.status || payload.status || 'Active');
      const active = !status || ['active', '1', 'true', 'yes', 'enabled'].includes(status.toLowerCase());
      const descriptor = `${role} ${department}`.toLowerCase();
      return {
        id: row.id,
        name,
        role,
        department,
        active,
        isTechnician: descriptor.includes('technician') || descriptor.includes('field') || descriptor.includes('service') || descriptor.includes('ops')
      };
    });
    const technicians = mapped.filter((row) => row.active && row.isTechnician);
    return technicians.length ? technicians : mapped.filter((row) => row.active);
  } catch (_error) {
    return [];
  }
};

const loadCustomers = async () => {
  try {
    const rows = await dbQuery('SELECT * FROM customers ORDER BY id DESC');
    return safeRows(rows).map((row) => {
      const payload = jsonSafe(row.payload, {});
      return {
        id: row.id,
        name: safeName(payload.displayName || payload.customerName || payload.companyName || payload.name || row.name, `Customer ${row.id}`)
      };
    });
  } catch (_error) {
    return [];
  }
};

const loadItems = async () => {
  try {
    const rows = await dbQuery(
      `SELECT i.*, v.vendor_name, v.company_name
       FROM stock_items i
       LEFT JOIN vendors v ON v.id = i.vendor_id
       ORDER BY i.is_active DESC, i.item_name ASC`
    );
    return safeRows(rows).map((row) => ({
      ...(() => {
        const stockDisplay = formatCurrentStockDisplay(row);
        return {
          currentStock: stockDisplay.value,
          currentStockUnitLabel: stockDisplay.unitLabel,
          currentStockDisplay: stockDisplay.display,
          currentStockFormula: stockDisplay.formula
        };
      })(),
      id: row.id,
      itemName: safeName(row.item_name, `Item ${row.id}`),
      itemCode: text(row.item_code),
      category: safeName(row.category, 'Other'),
      unit: safeName(normalizeUnit(row.unit) || 'piece', 'piece'),
      hsnSac: text(row.hsn_sac),
      packSizePerBottle: text(row.pack_size_per_bottle),
      noOfBottles: num(row.no_of_bottles),
      openingStock: num(row.opening_stock),
      minStockLevel: num(row.min_stock_level),
      purchaseRate: num(row.purchase_rate),
      gstPercent: num(row.gst_percent),
      totalAmount: num(row.total_amount) || round2(num(row.purchase_rate) * (1 + num(row.gst_percent) / 100)),
      vendorId: row.vendor_id ?? null,
      vendorName: safeName(row.vendor_name || row.company_name, ''),
      batchNumber: text(row.batch_number),
      expiryDate: row.expiry_date || null,
      storageLocation: text(row.storage_location),
      description: text(row.description),
      isActive: Number(row.is_active || 0) !== 0,
      status: stockStatus({
        current_stock: (() => {
          const stockDisplay = formatCurrentStockDisplay(row);
          return stockDisplay.value;
        })(),
        min_stock_level: row.min_stock_level
      })
    }));
  } catch (_error) {
    return [];
  }
};

const loadPurchases = async () => {
  try {
    const rows = await dbQuery(
      `SELECT p.*,
              i.item_name,
              i.item_code,
              i.category,
              i.unit AS item_unit,
              v.vendor_name,
              v.company_name
       FROM stock_purchases p
       LEFT JOIN stock_items i ON i.id = p.item_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       ORDER BY p.purchase_date DESC, p.id DESC`
    );
    return safeRows(rows).map((row) => ({
      id: row.id,
      vendorId: row.vendor_id ?? null,
      vendorName: safeName(row.vendor_name || row.company_name, ''),
      purchaseDate: row.purchase_date,
      invoiceNumber: text(row.invoice_number),
      itemId: row.item_id ?? null,
      itemName: safeName(row.item_name, ''),
      itemCode: text(row.item_code),
      category: safeName(row.category, 'Other'),
      quantity: num(row.quantity),
      rate: num(row.rate),
      gstPercent: num(row.gst_percent),
      totalAmount: num(row.total_amount),
      batchNumber: text(row.batch_number),
      expiryDate: row.expiry_date || null,
      notes: text(row.notes)
    }));
  } catch (_error) {
    return [];
  }
};

const loadTechnicianBalances = async () => {
  try {
    const rows = await dbQuery(
      `SELECT b.*, i.item_name, i.item_code, i.unit, e.full_name, e.first_name, e.last_name, e.role, e.role_name, e.department
       FROM stock_technician_balances b
       LEFT JOIN stock_items i ON i.id = b.item_id
       LEFT JOIN employees e ON e.id = b.technician_id
       ORDER BY e.full_name ASC, i.item_name ASC`
    );
    return safeRows(rows).map((row) => ({
      technicianId: row.technician_id,
      technicianName: safeName(row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' '), `Technician ${row.technician_id}`),
      itemId: row.item_id,
      itemName: safeName(row.item_name, ''),
      itemCode: text(row.item_code),
      unit: safeName(row.unit, ''),
      currentBalance: num(row.current_balance),
      updatedAt: row.updated_at || null
    }));
  } catch (_error) {
    return [];
  }
};

const loadMovements = async (filters = {}, limit = DEFAULT_LIMIT) => {
  const where = [];
  const params = [];

  if (filters.startDate) {
    where.push('DATE(m.movement_date) >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push('DATE(m.movement_date) <= ?');
    params.push(filters.endDate);
  }
  if (filters.itemId) {
    where.push('m.item_id = ?');
    params.push(filters.itemId);
  }
  if (filters.vendorId) {
    where.push('m.vendor_id = ?');
    params.push(filters.vendorId);
  }
  if (filters.technicianId) {
    where.push('m.technician_id = ?');
    params.push(filters.technicianId);
  }
  if (filters.customerId) {
    where.push('m.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.category) {
    where.push('i.category = ?');
    params.push(text(filters.category));
  }
  if (filters.movementType) {
    where.push('m.movement_type = ?');
    params.push(text(filters.movementType).toLowerCase());
  }

  const query = `
    SELECT m.*, i.item_name, i.item_code, i.category,
           v.vendor_name, v.company_name,
           e.full_name AS technician_name,
           c.payload AS customer_payload
    FROM stock_movements m
    LEFT JOIN stock_items i ON i.id = m.item_id
    LEFT JOIN vendors v ON v.id = m.vendor_id
    LEFT JOIN employees e ON e.id = m.technician_id
    LEFT JOIN customers c ON c.id = m.customer_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY m.movement_date DESC, m.id DESC
    LIMIT ${Number(limit) || DEFAULT_LIMIT}
  `;

  const rows = await dbQuery(query, params);
  return safeRows(rows).map((row) => {
    const customerPayload = jsonSafe(row.customer_payload, {});
    return {
      id: row.id,
      movementDate: row.movement_date,
      movementType: row.movement_type,
      itemId: row.item_id,
      itemName: safeName(row.item_name, ''),
      itemCode: text(row.item_code),
      category: safeName(row.category, 'Other'),
      technicianId: row.technician_id ?? null,
      technicianName: safeName(row.technician_name, ''),
      vendorId: row.vendor_id ?? null,
      vendorName: safeName(row.vendor_name || row.company_name, ''),
      customerId: row.customer_id ?? null,
      customerName: safeName(customerPayload.displayName || customerPayload.customerName || customerPayload.companyName || customerPayload.name, ''),
      contractId: row.contract_id ?? null,
      jobId: row.job_id ?? null,
      serviceType: text(row.service_type),
      sourceLocation: text(row.source_location || 'office'),
      inQty: num(row.in_qty),
      outQty: num(row.out_qty),
      officeBalanceAfter: num(row.office_balance_after),
      technicianBalanceAfter: num(row.technician_balance_after),
      unit: safeName(row.unit, ''),
      referenceType: text(row.reference_type),
      referenceId: row.reference_id ?? null,
      notes: text(row.notes)
    };
  });
};

const validateItem = (body = {}) => {
  const itemName = text(body.itemName || body.item_name);
  const unit = normalizeUnit(body.unit);
  if (!itemName) return 'Item name is required.';
  if (!unit) return 'Unit is required.';
  if (!UNITS.includes(unit.toLowerCase())) return 'Please choose a valid unit.';
  return '';
};

const getItemById = async (id) => {
  const rows = await dbQuery('SELECT * FROM stock_items WHERE id = ? LIMIT 1', [id]);
  return firstRow(rows);
};

const getTechnicianBalance = async (conn, technicianId, itemId) => {
  const [rows] = await conn.query(
    'SELECT * FROM stock_technician_balances WHERE technician_id = ? AND item_id = ? LIMIT 1 FOR UPDATE',
    [technicianId, itemId]
  );
  return firstRow(rows);
};

const getItemForUpdate = async (conn, itemId) => {
  const [rows] = await conn.query('SELECT * FROM stock_items WHERE id = ? LIMIT 1 FOR UPDATE', [itemId]);
  return firstRow(rows);
};

const upsertTechnicianBalance = async (conn, technicianId, itemId, delta) => {
  const current = await getTechnicianBalance(conn, technicianId, itemId);
  const nextBalance = round3(num(current?.current_balance) + num(delta));
  if (nextBalance < 0) throw new Error('Technician stock cannot go below zero.');
  if (current) {
    await conn.query('UPDATE stock_technician_balances SET current_balance = ? WHERE technician_id = ? AND item_id = ?', [nextBalance, technicianId, itemId]);
  } else {
    await conn.query('INSERT INTO stock_technician_balances (technician_id, item_id, current_balance) VALUES (?, ?, ?)', [technicianId, itemId, nextBalance]);
  }
  return nextBalance;
};

const insertMovement = async (conn, payload) => {
  const {
    movementDate = new Date(),
    movementType,
    itemId,
    technicianId = null,
    vendorId = null,
    customerId = null,
    contractId = null,
    jobId = null,
    serviceType = null,
    sourceLocation = 'office',
    inQty = 0,
    outQty = 0,
    officeBalanceAfter = 0,
    technicianBalanceAfter = 0,
    unit,
    referenceType = null,
    referenceId = null,
    notes = null,
    createdBy = null
  } = payload;

  await conn.query(
    `INSERT INTO stock_movements (
      movement_date, movement_type, item_id, technician_id, vendor_id, customer_id, contract_id, job_id,
      service_type, source_location, in_qty, out_qty, office_balance_after, technician_balance_after, unit,
      reference_type, reference_id, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movementDate,
      movementType,
      itemId,
      technicianId,
      vendorId,
      customerId,
      contractId,
      jobId,
      serviceType,
      sourceLocation,
      round3(inQty),
      round3(outQty),
      round3(officeBalanceAfter),
      round3(technicianBalanceAfter),
      unit,
      referenceType,
      referenceId,
      notes,
      createdBy
    ]
  );
};

const loadDashboardData = async () => {
  const [items, purchases, balances, movements, vendors, technicians, customers] = await Promise.all([
    loadItems(),
    loadPurchases(),
    loadTechnicianBalances(),
    loadMovements({}, DEFAULT_LIMIT),
    loadVendors(),
    loadTechnicians(),
    loadCustomers()
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const thisMonthPurchase = purchases
    .filter((row) => {
      const purchaseDate = dateOnly(row.purchaseDate);
      return purchaseDate && purchaseDate >= monthStart.toISOString().slice(0, 10) && purchaseDate < nextMonth.toISOString().slice(0, 10);
    })
    .reduce((sum, row) => sum + num(row.totalAmount), 0);

  const thisMonthUsage = movements
    .filter((row) => {
      const movementDate = dateOnly(row.movementDate);
      return row.movementType === 'usage' && movementDate && movementDate >= monthStart.toISOString().slice(0, 10) && movementDate < nextMonth.toISOString().slice(0, 10);
    })
    .reduce((sum, row) => sum + num(row.outQty), 0);

  const summary = {
    totalItems: items.filter((row) => row.isActive).length,
    totalOfficeStockValue: items.reduce((sum, row) => sum + num(row.currentStock) * num(row.purchaseRate), 0),
    lowStockItems: items.filter((row) => row.currentStock > 0 && row.currentStock <= row.minStockLevel).length,
    outOfStockItems: items.filter((row) => row.currentStock <= 0).length,
    stockWithTechnicians: balances.reduce((sum, row) => sum + num(row.currentBalance), 0),
    thisMonthPurchase,
    thisMonthUsage,
    expiringSoon: items.filter((row) => row.expiryDate && row.expiryDate <= new Date(now.getTime() + EXPIRY_ALERT_DAYS * 86400000).toISOString().slice(0, 10)).length
  };

  const categoryWise = CATEGORIES.map((category) => ({
    category,
    currentStock: items.filter((item) => text(item.category || 'Other') === category).reduce((sum, row) => sum + num(row.currentStock), 0)
  }));

  const monthlyTrendMap = new Map();
  for (let offset = 11; offset >= 0; offset -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    monthlyTrendMap.set(monthKey(dt.getFullYear(), dt.getMonth() + 1), {
      month: monthLabel(dt.getFullYear(), dt.getMonth() + 1),
      purchase: 0,
      usage: 0
    });
  }
  purchases.forEach((row) => {
    const purchaseDate = dateOnly(row.purchaseDate);
    if (!purchaseDate) return;
    const parsed = new Date(purchaseDate);
    const key = monthKey(parsed.getFullYear(), parsed.getMonth() + 1);
    const entry = monthlyTrendMap.get(key);
    if (entry) entry.purchase += num(row.quantity);
  });
  movements.filter((row) => row.movementType === 'usage').forEach((row) => {
    const movementDate = dateOnly(row.movementDate);
    if (!movementDate) return;
    const parsed = new Date(movementDate);
    const key = monthKey(parsed.getFullYear(), parsed.getMonth() + 1);
    const entry = monthlyTrendMap.get(key);
    if (entry) entry.usage += num(row.outQty);
  });

  const lowStockItems = items.filter((row) => row.currentStock > 0 && row.currentStock <= row.minStockLevel).slice(0, 10);
  const technicianWise = balances.reduce((list, row) => {
    const existing = list.find((entry) => entry.technicianId === row.technicianId);
    if (existing) {
      existing.currentBalance += num(row.currentBalance);
    } else {
      list.push({
        technicianId: row.technicianId,
        technicianName: row.technicianName,
        currentBalance: num(row.currentBalance)
      });
    }
    return list;
  }, []);

  return {
    summary,
    categoryWise,
    monthlyTrend: Array.from(monthlyTrendMap.values()),
    lowStockItems,
    technicianWise,
    recentMovements: movements.slice(0, 20),
    items,
    purchases,
    balances,
    vendors,
    technicians,
    customers
  };
};

router.use(async (_req, _res, next) => {
  try {
    await ensureSchemaReady();
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get('/dashboard', async (_req, res) => {
  try {
    const data = await loadDashboardData();
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('stock dashboard error:', error);
    return sendError(res, 500, error.message || 'Unable to load stock dashboard.');
  }
});

router.get('/items', async (_req, res) => {
  try {
    const [items, vendors] = await Promise.all([loadItems(), loadVendors()]);
    return res.json({ success: true, items, vendors });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to load stock items.');
  }
});

router.post('/items', async (req, res) => {
  try {
    const validationError = validateItem(req.body || {});
    if (validationError) return sendError(res, 400, validationError);

    const body = req.body || {};
    const itemName = text(body.itemName || body.item_name);
    const itemCode = text(body.itemCode || body.item_code) || null;
    const category = text(body.category || 'Other') || 'Other';
    const unit = normalizeUnit(body.unit) || 'piece';
    const hsnSac = coerceOptionalText(getProvidedValue(body, 'hsnSac', 'hsn_sac'));
    const stockFields = resolveItemStockFields(body);
    const packSizePerBottle = stockFields.packSizePerBottle;
    const noOfBottles = stockFields.noOfBottles;
    const openingStock = stockFields.openingStock;
    const currentStock = stockFields.currentStock;
    const minStockLevel = coerceStockValue(getProvidedValue(body, 'minStockLevel', 'min_stock_level'));
    const purchaseRate = round3(body.purchaseRate ?? body.purchase_rate ?? 0);
    const gstPercent = round2(body.gstPercent ?? body.gst_percent ?? 0);
    const totalAmount = round2(body.totalAmount ?? body.total_amount ?? noOfBottles * purchaseRate * (1 + gstPercent / 100));
    const vendorId = body.vendorId || body.vendor_id ? Number(body.vendorId || body.vendor_id) : null;
    const batchNumber = text(body.batchNumber || body.batch_number) || null;
    const expiryDate = dateOnly(body.expiryDate || body.expiry_date);
    const storageLocation = coerceOptionalText(getProvidedValue(body, 'storageLocation', 'storage_location'));
    const description = coerceOptionalText(getProvidedValue(body, 'description'));
    const isActive = body.isActive === false || body.is_active === 0 ? 0 : 1;
    if ([openingStock, currentStock, minStockLevel, purchaseRate, gstPercent, totalAmount].some((value) => value < 0)) {
      return sendError(res, 400, 'Stock and rate values cannot be negative.');
    }
    const createdBy = body.createdBy || body.created_by || null;

    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const [insertResult] = await conn.query(
        `INSERT INTO stock_items (
          item_name, item_code, category, unit, hsn_sac, pack_size_per_bottle, no_of_bottles, opening_stock, current_stock, min_stock_level,
          purchase_rate, gst_percent, total_amount, vendor_id, batch_number, expiry_date, storage_location, description, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemName, itemCode, category, unit, hsnSac, packSizePerBottle, noOfBottles, openingStock, currentStock, minStockLevel, purchaseRate, gstPercent, totalAmount, vendorId, batchNumber, expiryDate, storageLocation, description, isActive]
      );

      if (currentStock > 0) {
        await insertMovement(conn, {
          movementType: 'opening',
          itemId: insertResult.insertId,
          vendorId,
          sourceLocation: 'office',
          inQty: currentStock,
          outQty: 0,
          officeBalanceAfter: currentStock,
          technicianBalanceAfter: 0,
          unit,
          referenceType: 'stock_items',
          referenceId: insertResult.insertId,
          notes: 'Opening stock',
          createdBy
        });
      }

      await conn.commit();
      return res.status(201).json({ success: true, message: 'Item created.' });
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    return sendError(res, 400, error.message || 'Unable to save item.');
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const validationError = validateItem(req.body || {});
    if (validationError) return sendError(res, 400, validationError);

    const body = req.body || {};
    const itemId = Number(req.params.id);
    if (!Number.isFinite(itemId)) {
      return sendError(res, 400, 'Invalid item id.');
    }
    const existingRows = await dbQuery('SELECT * FROM stock_items WHERE id = ? LIMIT 1', [itemId]);
    const existing = firstRow(existingRows);
    if (!existing) {
      return sendError(res, 404, 'Item not found.');
    }
    const itemName = text(body.itemName || body.item_name);
    const itemCode = text(body.itemCode || body.item_code) || null;
    const category = text(body.category || 'Other') || 'Other';
    const unit = normalizeUnit(body.unit) || 'piece';
    const hsnSac = coerceOptionalText(getProvidedValue(body, 'hsnSac', 'hsn_sac'), text(existing.hsn_sac));
    const stockFields = resolveItemStockFields(body, existing);
    const packSizePerBottle = stockFields.packSizePerBottle;
    const noOfBottles = stockFields.noOfBottles;
    const openingStock = stockFields.openingStock;
    const currentStock = stockFields.currentStock;
    const minStockLevel = coerceStockValue(getProvidedValue(body, 'minStockLevel', 'min_stock_level'), num(existing.min_stock_level));
    const purchaseRate = round3(body.purchaseRate ?? body.purchase_rate ?? 0);
    const gstPercent = round2(body.gstPercent ?? body.gst_percent ?? num(existing.gst_percent));
    const totalAmount = round2(body.totalAmount ?? body.total_amount ?? noOfBottles * purchaseRate * (1 + gstPercent / 100));
    const vendorId = body.vendorId || body.vendor_id ? Number(body.vendorId || body.vendor_id) : null;
    const batchNumber = text(body.batchNumber || body.batch_number) || null;
    const expiryDate = dateOnly(body.expiryDate || body.expiry_date);
    const storageLocation = coerceOptionalText(getProvidedValue(body, 'storageLocation', 'storage_location'), text(existing.storage_location));
    const description = coerceOptionalText(getProvidedValue(body, 'description'), text(existing.description));
    const isActive = body.isActive === false || body.is_active === 0 ? 0 : 1;
    if ([openingStock, currentStock, minStockLevel, purchaseRate, gstPercent, totalAmount].some((value) => value < 0)) {
      return sendError(res, 400, 'Stock and rate values cannot be negative.');
    }

    const result = await dbQuery(
      `UPDATE stock_items SET
        item_name = ?,
        item_code = ?,
        category = ?,
        unit = ?,
        hsn_sac = ?,
        pack_size_per_bottle = ?,
        no_of_bottles = ?,
        opening_stock = ?,
        current_stock = ?,
        min_stock_level = ?,
        purchase_rate = ?,
        gst_percent = ?,
        total_amount = ?,
        vendor_id = ?,
        batch_number = ?,
        expiry_date = ?,
        storage_location = ?,
        description = ?,
        is_active = ?
       WHERE id = ?`,
      [itemName, itemCode, category, unit, hsnSac, packSizePerBottle, noOfBottles, openingStock, currentStock, minStockLevel, purchaseRate, gstPercent, totalAmount, vendorId, batchNumber, expiryDate, storageLocation, description, isActive, itemId]
    );
    if (Number(result?.affectedRows || 0) === 0) {
      return sendError(res, 404, 'Item not found.');
    }
    return res.json({ success: true, message: 'Item updated.' });
  } catch (error) {
    return sendError(res, 400, error.message || 'Unable to update item.');
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isFinite(itemId)) {
      return sendError(res, 400, 'Invalid item id.');
    }

    const refs = await dbQuery(
      `SELECT
         (SELECT COUNT(*) FROM stock_purchases WHERE item_id = ?) AS purchaseCount,
         (SELECT COUNT(*) FROM stock_movements WHERE item_id = ?) AS movementCount,
         (SELECT COUNT(*) FROM stock_technician_balances WHERE item_id = ?) AS balanceCount`,
      [itemId, itemId, itemId]
    );
    const purchaseCount = Number(firstRow(refs)?.purchaseCount || 0);
    const movementCount = Number(firstRow(refs)?.movementCount || 0);
    const balanceCount = Number(firstRow(refs)?.balanceCount || 0);
    const hasHistory = purchaseCount > 0 || movementCount > 0 || balanceCount > 0;

    if (hasHistory) {
      const updateResult = await dbQuery('UPDATE stock_items SET is_active = 0 WHERE id = ?', [itemId]);
      if (Number(updateResult?.affectedRows || 0) === 0) {
        return sendError(res, 404, 'Item not found.');
      }
      return res.json({
        success: true,
        message: 'Item has history, so it was deactivated instead of deleted.',
        deleted: false,
        deactivated: true
      });
    }

    const deleteResult = await dbQuery('DELETE FROM stock_items WHERE id = ?', [itemId]);
    if (Number(deleteResult?.affectedRows || 0) === 0) {
      return sendError(res, 404, 'Item not found.');
    }
    return res.json({ success: true, message: 'Item deleted.', deleted: true });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to delete item.');
  }
});

router.get('/purchases', async (_req, res) => {
  try {
    return res.json({ success: true, purchases: await loadPurchases() });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to load stock purchases.');
  }
});

router.post('/purchases', async (req, res) => {
  const body = req.body || {};
  const itemId = Number(body.itemId || body.item_id || 0);
  const quantity = round3(body.quantity);
  const rate = round3(body.rate);
  const gstPercent = round3(body.gstPercent || body.gst_percent || 0);
  const totalAmount = round3(body.totalAmount || body.total_amount || quantity * rate * (1 + gstPercent / 100));
  const purchaseDate = dateOnly(body.purchaseDate || body.purchase_date || new Date());
  const vendorId = body.vendorId || body.vendor_id ? Number(body.vendorId || body.vendor_id) : null;
  const createdBy = body.createdBy || body.created_by || null;

  try {
    if (!itemId) return sendError(res, 400, 'Item is required.');
    if (!purchaseDate) return sendError(res, 400, 'Purchase date is required.');
    if (!isPositive(quantity)) return sendError(res, 400, 'Quantity must be greater than zero.');

    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const item = await getItemForUpdate(conn, itemId);
      if (!item) throw new Error('Item not found.');

      const nextOffice = round3(num(item.current_stock) + quantity);
      const [purchaseResult] = await conn.query(
        `INSERT INTO stock_purchases (
          vendor_id, purchase_date, invoice_number, item_id, quantity, rate, gst_percent,
          total_amount, batch_number, expiry_date, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vendorId,
          purchaseDate,
          text(body.invoiceNumber || body.invoice_number) || null,
          itemId,
          quantity,
          rate,
          gstPercent,
          totalAmount,
          text(body.batchNumber || body.batch_number) || null,
          dateOnly(body.expiryDate || body.expiry_date),
          text(body.notes || '') || null,
          createdBy
        ]
      );

      await conn.query('UPDATE stock_items SET current_stock = ? WHERE id = ?', [nextOffice, itemId]);
      await insertMovement(conn, {
        movementDate: purchaseDate,
        movementType: 'purchase',
        itemId,
        vendorId,
        sourceLocation: 'office',
        inQty: quantity,
        outQty: 0,
        officeBalanceAfter: nextOffice,
        technicianBalanceAfter: 0,
        unit: item.unit,
        referenceType: 'stock_purchases',
        referenceId: purchaseResult.insertId,
        notes: text(body.notes || '') || 'Purchase stock',
        createdBy
      });

      await conn.commit();
      return res.status(201).json({ success: true, message: 'Purchase saved.', officeBalanceAfter: nextOffice });
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    return sendError(res, 400, error.message || 'Unable to save purchase.');
  }
});

router.get('/technician-balances', async (_req, res) => {
  try {
    return res.json({ success: true, balances: await loadTechnicianBalances() });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to load technician balances.');
  }
});

router.post('/issue', async (req, res) => {
  const body = req.body || {};
  const technicianId = Number(body.technicianId || body.technician_id || 0);
  const itemId = Number(body.itemId || body.item_id || 0);
  const quantity = round3(body.quantity);
  const movementDate = dateOnly(body.date || body.issueDate || body.issue_date || new Date());
  const customerId = intOrNull(body.customerId || body.customer_id);
  const contractId = intOrNull(body.contractId || body.contract_id);
  const jobId = intOrNull(body.jobId || body.job_id);
  const createdBy = body.createdBy || body.created_by || null;
  try {
    if (!technicianId) return sendError(res, 400, 'Technician is required.');
    if (!itemId) return sendError(res, 400, 'Item is required.');
    if (!movementDate) return sendError(res, 400, 'Date is required.');
    if (!isPositive(quantity)) return sendError(res, 400, 'Quantity must be greater than zero.');

    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const item = await getItemForUpdate(conn, itemId);
      if (!item) throw new Error('Item not found.');
      const nextOffice = round3(num(item.current_stock) - quantity);
      if (nextOffice < 0) throw new Error('Office stock is not enough for this issue.');

      const nextTechnician = await upsertTechnicianBalance(conn, technicianId, itemId, quantity);
      await conn.query('UPDATE stock_items SET current_stock = ? WHERE id = ?', [nextOffice, itemId]);
      await insertMovement(conn, {
        movementDate,
        movementType: 'issue',
        itemId,
        technicianId,
        customerId,
        contractId,
        jobId,
        sourceLocation: 'office',
        inQty: 0,
        outQty: quantity,
        officeBalanceAfter: nextOffice,
        technicianBalanceAfter: nextTechnician,
        unit: item.unit,
        referenceType: 'issue',
        notes: text(body.notes || '') || 'Issued to technician',
        createdBy
      });
      await conn.commit();
      return res.status(201).json({ success: true, message: 'Stock issued.', officeBalanceAfter: nextOffice, technicianBalanceAfter: nextTechnician });
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    return sendError(res, 400, error.message || 'Unable to issue stock.');
  }
});

router.post('/usage', async (req, res) => {
  const body = req.body || {};
  const technicianId = Number(body.technicianId || body.technician_id || 0);
  const itemId = Number(body.itemId || body.item_id || 0);
  const quantity = round3(body.quantity || body.quantityUsed || body.quantity_used);
  const movementDate = dateOnly(body.date || body.usageDate || body.usage_date || new Date());
  const customerId = intOrNull(body.customerId || body.customer_id);
  const contractId = intOrNull(body.contractId || body.contract_id);
  const jobId = intOrNull(body.jobId || body.job_id);
  const createdBy = body.createdBy || body.created_by || null;
  try {
    if (!technicianId) return sendError(res, 400, 'Technician is required.');
    if (!itemId) return sendError(res, 400, 'Item is required.');
    if (!movementDate) return sendError(res, 400, 'Date is required.');
    if (!isPositive(quantity)) return sendError(res, 400, 'Quantity must be greater than zero.');

    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const item = await getItemForUpdate(conn, itemId);
      if (!item) throw new Error('Item not found.');
      const techBalance = await getTechnicianBalance(conn, technicianId, itemId);
      const currentTech = num(techBalance?.current_balance || 0);
      const nextTech = round3(currentTech - quantity);
      if (nextTech < 0) throw new Error('Technician stock is not enough for this usage.');

      await conn.query('UPDATE stock_technician_balances SET current_balance = ? WHERE technician_id = ? AND item_id = ?', [nextTech, technicianId, itemId]);
      await insertMovement(conn, {
        movementDate,
        movementType: 'usage',
        itemId,
        technicianId,
        customerId,
        contractId,
        jobId,
        serviceType: text(body.serviceType || '') || null,
        sourceLocation: 'technician',
        inQty: 0,
        outQty: quantity,
        officeBalanceAfter: num(item.current_stock),
        technicianBalanceAfter: nextTech,
        unit: item.unit,
        referenceType: 'usage',
        notes: text(body.notes || '') || 'Usage at site',
        createdBy
      });

      await conn.commit();
      return res.status(201).json({ success: true, message: 'Usage saved.', technicianBalanceAfter: nextTech });
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    return sendError(res, 400, error.message || 'Unable to save usage.');
  }
});

router.post('/return-wastage', async (req, res) => {
  const body = req.body || {};
  const itemId = Number(body.itemId || body.item_id || 0);
  const technicianId = intOrNull(body.technicianId || body.technician_id);
  const quantity = round3(body.quantity);
  const movementDate = dateOnly(body.date || body.returnDate || body.return_date || new Date());
  const sourceLocation = text(body.sourceLocation || body.source_location || 'technician').toLowerCase() === 'office' ? 'office' : 'technician';
  const movementType = text(body.type || body.returnType || body.return_type || 'return').toLowerCase();
  const adjustmentMode = text(body.adjustmentMode || body.adjustment_mode || 'decrease').toLowerCase();
  const notes = text(body.reason || body.notes || '');
  const customerId = body.customerId || body.customer_id ? Number(body.customerId || body.customer_id) : null;
  const contractId = body.contractId || body.contract_id ? Number(body.contractId || body.contract_id) : null;
  const jobId = body.jobId || body.job_id ? Number(body.jobId || body.job_id) : null;
  const createdBy = body.createdBy || body.created_by || null;
  try {
    if (!itemId) return sendError(res, 400, 'Item is required.');
    if (!movementDate) return sendError(res, 400, 'Date is required.');
    if (!isPositive(quantity)) return sendError(res, 400, 'Quantity must be greater than zero.');

    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const item = await getItemForUpdate(conn, itemId);
      if (!item) throw new Error('Item not found.');

      let officeDelta = 0;
      let technicianDelta = 0;
      let finalMovement = movementType;

      if (movementType === 'return') {
        if (sourceLocation === 'technician') {
          if (!technicianId) throw new Error('Technician is required for technician returns.');
          technicianDelta = -quantity;
          officeDelta = quantity;
        } else {
          officeDelta = quantity;
        }
      } else if (['wastage', 'damage', 'expired'].includes(movementType)) {
        finalMovement = movementType;
        if (sourceLocation === 'technician') {
          if (!technicianId) throw new Error('Technician is required for technician-side movement.');
          technicianDelta = -quantity;
        } else {
          officeDelta = -quantity;
        }
      } else if (movementType === 'adjustment') {
        finalMovement = 'adjustment';
        if (adjustmentMode === 'increase') {
          if (sourceLocation === 'technician') {
            if (!technicianId) throw new Error('Technician is required for technician adjustment.');
            technicianDelta = quantity;
          } else {
            officeDelta = quantity;
          }
        } else {
          if (sourceLocation === 'technician') {
            if (!technicianId) throw new Error('Technician is required for technician adjustment.');
            technicianDelta = -quantity;
          } else {
            officeDelta = -quantity;
          }
        }
      } else {
        return sendError(res, 400, 'Invalid movement type.');
      }

      const officeNext = round3(num(item.current_stock) + officeDelta);
      if (officeNext < 0) throw new Error('Office stock is not enough for this movement.');

      let technicianNext = 0;
      if (technicianId !== null) {
        const currentBalance = await getTechnicianBalance(conn, technicianId, itemId);
        technicianNext = round3(num(currentBalance?.current_balance || 0) + technicianDelta);
        if (technicianNext < 0) throw new Error('Technician stock is not enough for this movement.');
        if (currentBalance) {
          await conn.query('UPDATE stock_technician_balances SET current_balance = ? WHERE technician_id = ? AND item_id = ?', [technicianNext, technicianId, itemId]);
        } else {
          await conn.query('INSERT INTO stock_technician_balances (technician_id, item_id, current_balance) VALUES (?, ?, ?)', [technicianId, itemId, technicianNext]);
        }
      }

      await conn.query('UPDATE stock_items SET current_stock = ? WHERE id = ?', [officeNext, itemId]);
      await insertMovement(conn, {
        movementDate,
        movementType: finalMovement,
        itemId,
        technicianId,
        customerId,
        contractId,
        jobId,
        sourceLocation,
        inQty: officeDelta > 0 ? quantity : 0,
        outQty: officeDelta < 0 ? quantity : 0,
        officeBalanceAfter: officeNext,
        technicianBalanceAfter: technicianId !== null ? technicianNext : 0,
        unit: item.unit,
        referenceType: 'manual',
        notes: notes || 'Stock movement',
        createdBy
      });

      await conn.commit();
      return res.status(201).json({
        success: true,
        message: 'Movement saved.',
        officeBalanceAfter: officeNext,
        technicianBalanceAfter: technicianId !== null ? technicianNext : 0
      });
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    return sendError(res, 400, error.message || 'Unable to save movement.');
  }
});

router.get('/ledger', async (req, res) => {
  try {
    const rows = await loadMovements({
      startDate: req.query.startDate || req.query.start_date || '',
      endDate: req.query.endDate || req.query.end_date || '',
      itemId: req.query.itemId || req.query.item_id || '',
      vendorId: req.query.vendorId || req.query.vendor_id || '',
      technicianId: req.query.technicianId || req.query.technician_id || '',
      customerId: req.query.customerId || req.query.customer_id || '',
      movementType: req.query.movementType || req.query.movement_type || ''
    }, num(req.query.limit, DEFAULT_LIMIT));
    return res.json({ success: true, rows });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to load stock ledger.');
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reportType = text(req.query.reportType || req.query.type || 'current-stock').toLowerCase();
    const filters = {
      startDate: req.query.startDate || req.query.start_date || '',
      endDate: req.query.endDate || req.query.end_date || '',
      itemId: req.query.itemId || req.query.item_id || '',
      category: req.query.category || '',
      vendorId: req.query.vendorId || req.query.vendor_id || '',
      technicianId: req.query.technicianId || req.query.technician_id || '',
      movementType: req.query.movementType || req.query.movement_type || ''
    };

    const items = await loadItems();
    const balances = await loadTechnicianBalances();
    const movements = await loadMovements(filters, DEFAULT_LIMIT);
    const purchases = await loadPurchases();

    if (reportType === 'purchase') {
      const rows = purchases.filter((row) => {
        const rowDate = dateOnly(row.purchaseDate);
        if (filters.startDate && rowDate && rowDate < filters.startDate) return false;
        if (filters.endDate && rowDate && rowDate > filters.endDate) return false;
        if (filters.itemId && String(row.itemId) !== String(filters.itemId)) return false;
        if (filters.vendorId && String(row.vendorId || '') !== String(filters.vendorId)) return false;
        if (filters.category && text(row.category) !== text(filters.category)) return false;
        return true;
      });
      return res.json({
        success: true,
        reportType,
        rows,
        summary: { rows: rows.length, value: rows.reduce((sum, row) => sum + num(row.totalAmount), 0) }
      });
    }

    if (reportType === 'usage') {
      const rows = movements.filter((row) => {
        if (row.movementType !== 'usage') return false;
        if (filters.category && text(row.category) !== text(filters.category)) return false;
        return true;
      });
      return res.json({
        success: true,
        reportType,
        rows,
        summary: { rows: rows.length, quantity: rows.reduce((sum, row) => sum + num(row.outQty), 0) }
      });
    }

    if (reportType === 'low-stock') {
      const rows = items.filter((row) => {
        if (filters.itemId && String(row.id) !== String(filters.itemId)) return false;
        if (filters.category && text(row.category) !== text(filters.category)) return false;
        if (filters.vendorId && String(row.vendorId || '') !== String(filters.vendorId)) return false;
        return row.currentStock > 0 && row.currentStock <= row.minStockLevel;
      });
      return res.json({ success: true, reportType, rows, summary: { rows: rows.length } });
    }

    if (reportType === 'expiry') {
      const soonDate = new Date(Date.now() + EXPIRY_ALERT_DAYS * 86400000).toISOString().slice(0, 10);
      const rows = items.filter((row) => {
        if (filters.itemId && String(row.id) !== String(filters.itemId)) return false;
        if (filters.category && text(row.category) !== text(filters.category)) return false;
        if (filters.vendorId && String(row.vendorId || '') !== String(filters.vendorId)) return false;
        return row.expiryDate && row.expiryDate <= soonDate;
      });
      return res.json({ success: true, reportType, rows, summary: { rows: rows.length } });
    }

    if (reportType === 'technician-stock') {
      const rows = balances.filter((row) => {
        if (filters.technicianId && String(row.technicianId) !== String(filters.technicianId)) return false;
        if (filters.itemId && String(row.itemId) !== String(filters.itemId)) return false;
        return true;
      });
      return res.json({ success: true, reportType, rows, summary: { rows: rows.length } });
    }

    if (reportType === 'ledger') {
      return res.json({ success: true, reportType, rows: movements, summary: { rows: movements.length } });
    }

    const rows = items.filter((row) => {
      if (filters.itemId && String(row.id) !== String(filters.itemId)) return false;
      if (filters.category && text(row.category || 'Other') !== text(filters.category)) return false;
      if (filters.vendorId && String(row.vendorId || '') !== String(filters.vendorId)) return false;
      return true;
    });
    return res.json({
      success: true,
      reportType: 'current-stock',
      rows,
      summary: {
        rows: rows.length,
        value: rows.reduce((sum, row) => sum + num(row.currentStock) * num(row.purchaseRate), 0)
      }
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to load stock reports.');
  }
});

const csvEscape = (value) => {
  const raw = String(value ?? '');
  if (/[,"\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
};

const stockExportColumns = {
  'current-stock': [
    ['itemName', 'Item'],
    ['category', 'Category'],
    ['unit', 'Unit'],
    ['currentStock', 'Current Stock'],
    ['minStockLevel', 'Minimum'],
    ['value', 'Value'],
    ['status', 'Status']
  ],
  'technician-stock': [
    ['technicianName', 'Technician'],
    ['itemName', 'Item'],
    ['currentBalance', 'Balance']
  ],
  ledger: [
    ['movementDate', 'Date'],
    ['movementType', 'Type'],
    ['itemName', 'Item'],
    ['inQty', 'In'],
    ['outQty', 'Out'],
    ['officeBalanceAfter', 'Office'],
    ['technicianName', 'Technician'],
    ['sourceLocation', 'Source'],
    ['notes', 'Notes']
  ],
  purchase: [
    ['purchaseDate', 'Date'],
    ['itemName', 'Item'],
    ['vendorName', 'Vendor'],
    ['quantity', 'Qty'],
    ['rate', 'Rate'],
    ['totalAmount', 'Total'],
    ['batchInfo', 'Batch / Expiry']
  ],
  usage: [
    ['movementDate', 'Date'],
    ['technicianName', 'Technician'],
    ['itemName', 'Item'],
    ['outQty', 'Qty'],
    ['customerName', 'Customer'],
    ['serviceType', 'Service'],
    ['notes', 'Notes']
  ],
  'low-stock': [
    ['itemName', 'Item'],
    ['category', 'Category'],
    ['currentStock', 'Current'],
    ['minStockLevel', 'Minimum'],
    ['status', 'Status']
  ],
  expiry: [
    ['itemName', 'Item'],
    ['category', 'Category'],
    ['expiryDate', 'Expiry'],
    ['currentStock', 'Current'],
    ['status', 'Status']
  ]
};

const buildStockExportRows = (reportType, rows = []) => {
  const columns = stockExportColumns[reportType] || stockExportColumns['current-stock'];
  const normalizeDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.slice(0, 10);
  };
  const normalizeValue = (row, key) => {
    if (key === 'value') return num(row.currentStock) * num(row.purchaseRate);
    if (key === 'batchInfo') return [row.batchNumber || '---', row.expiryDate ? `Exp: ${normalizeDate(row.expiryDate)}` : 'No expiry'].filter(Boolean).join(' | ');
    if (key === 'movementDate' || key === 'purchaseDate' || key === 'expiryDate') return normalizeDate(row[key]);
    if (key === 'currentStock') return row.currentStockDisplay || row.currentStock;
    if (key === 'minStockLevel' || key === 'currentBalance' || key === 'inQty' || key === 'outQty' || key === 'rate' || key === 'totalAmount') return row[key];
    if (key === 'technicianName') return row.technicianName || row.technician || '---';
    if (key === 'vendorName') return row.vendorName || '---';
    if (key === 'customerName') return row.customerName || '---';
    if (key === 'serviceType') return row.serviceType || '---';
    if (key === 'sourceLocation') return row.sourceLocation || 'office';
    if (key === 'notes') return row.notes || '---';
    if (key === 'status') return row.status || (reportType === 'expiry' ? 'Expiring Soon' : '');
    return row[key];
  };
  return {
    columns,
    headers: columns.map(([, label]) => label),
    rows: rows.map((row) => columns.map(([key]) => normalizeValue(row, key)))
  };
};

router.get('/export', async (req, res) => {
  try {
    const reportType = text(req.query.reportType || req.query.type || 'current-stock').toLowerCase();
    const format = text(req.query.format || 'csv').toLowerCase();
    const reportRes = await new Promise((resolve, reject) => {
      const mockReq = { query: req.query };
      const mockRes = {
        json(payload) { resolve(payload); },
        status(code) {
          return {
            json(payload) {
              reject(new Error(payload?.error || `Report error (${code})`));
            }
          };
        }
      };
      router.handle({ ...mockReq, method: 'GET', url: '/reports' }, mockRes, (error) => {
        if (error) reject(error);
      });
    });
    const rows = safeRows(reportRes.rows);
    const exportData = buildStockExportRows(reportType, rows);

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=stock-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
      doc.pipe(res);
      doc.fontSize(18).text('SKUAS Pest Control CRM', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(13).text(`Stock Report: ${reportType}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(9).text(exportData.headers.join(' | '));
      doc.moveDown(0.3);
      exportData.rows.slice(0, 50).forEach((row) => {
        doc.fontSize(9).text(row.map((value) => String(value ?? '')).join(' | '));
        doc.moveDown(0.2);
      });
      doc.end();
      return;
    }

    const headers = exportData.headers.length ? exportData.headers : ['message'];
    const csv = [
      headers.map(csvEscape).join(','),
      ...exportData.rows.map((row) => row.map((value) => csvEscape(value)).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=stock-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csv);
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to export stock report.');
  }
});

module.exports = { stockRoutes: router };
