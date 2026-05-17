const express = require('express');
const PDFDocument = require('pdfkit');
const { query: dbQuery, getConnection } = require('../lib/db');

const router = express.Router();

const STOCK_CATEGORIES = [
  ['Chemical', 'Liquid pest control chemicals'],
  ['Gel / Bait', 'Gel tubes and bait products'],
  ['Rodent Control', 'Glue pads, bromadiolone cake, rodent boxes'],
  ['Equipment', 'Sprayers and pest control equipment'],
  ['PPE', 'Gloves, masks and safety items'],
  ['Consumable', 'Daily use consumable items'],
  ['Other', 'Other stock items']
];

const STOCK_UNITS = ['ml', 'litre', 'gram', 'kg', 'tube', 'piece', 'box', 'packet', 'bottle', 'can'];

const text = (value) => String(value ?? '').trim();
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const dateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};
const monthKey = (year, month) => `${Number(year)}-${String(Number(month)).padStart(2, '0')}`;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const expiryThresholdDays = () => {
  const raw = process.env.STOCK_EXPIRY_ALERT_DAYS || process.env.STOCK_ALERT_DAYS || '30';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
};

const safeJson = (value, fallback) => {
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

const normalizeEmployee = (row = {}) => {
  const payload = safeJson(row.payload, {});
  const firstName = text(row.first_name || payload.firstName || '');
  const lastName = text(row.last_name || payload.lastName || '');
  const fullName = text(row.full_name || payload.fullName || [firstName, lastName].filter(Boolean).join(' ') || payload.name || row.name || row.employee_name || 'Employee');
  const role = text(row.role || payload.role || '');
  const roleName = text(row.role_name || payload.roleName || '');
  const department = text(row.department || payload.department || payload.team || payload.group || '');
  const status = text(row.status || payload.status || 'Active');
  const active = !status || ['active', '1', 'true', 'yes', 'enabled'].includes(status.toLowerCase());
  const techHaystack = `${role} ${roleName} ${department}`.toLowerCase();
  const hasRoleColumns = Boolean(role || roleName || department);
  return {
    id: String(row.id ?? payload.id ?? row.external_id ?? '').trim(),
    dbId: row.id ?? null,
    employeeCode: text(row.emp_code || payload.empCode || payload.employeeCode || ''),
    name: fullName,
    role,
    roleName,
    department,
    status,
    active,
    isTechnician: hasRoleColumns ? techHaystack.includes('technician') : active
  };
};

const normalizeVendor = (row = {}) => {
  const payload = safeJson(row.payload, {});
  return {
    id: String(row.id ?? payload.id ?? row.external_id ?? '').trim(),
    name: text(row.vendor_name || row.company_name || payload.vendorName || payload.companyName || payload.displayName || 'Vendor'),
    companyName: text(row.company_name || payload.companyName || ''),
    status: text(row.status || payload.status || 'Active')
  };
};

const normalizeCategory = (row = {}) => ({
  id: Number(row.id || 0),
  name: text(row.name || ''),
  description: text(row.description || '')
});

const getExistingColumns = async (tableName) => {
  try {
    const rows = await dbQuery(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    return new Set((Array.isArray(rows) ? rows : []).map((row) => text(row.COLUMN_NAME || row.column_name || '').toLowerCase()).filter(Boolean));
  } catch (_error) {
    return new Set();
  }
};

const ensureColumn = async (tableName, columnName, ddl) => {
  const existing = await getExistingColumns(tableName);
  if (existing.has(String(columnName).toLowerCase())) return;
  try {
    await dbQuery(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  } catch (_error) {
    // Best effort only.
  }
};

const ensureStockSchema = async () => {
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS stock_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS stock_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(100) NULL UNIQUE,
      product_name VARCHAR(255) NOT NULL,
      category_id INT NULL,
      unit VARCHAR(50) NOT NULL,
      opening_stock DECIMAL(12,3) DEFAULT 0,
      current_stock DECIMAL(12,3) DEFAULT 0,
      min_stock_level DECIMAL(12,3) DEFAULT 0,
      purchase_rate DECIMAL(12,2) DEFAULT 0,
      internal_rate DECIMAL(12,2) DEFAULT 0,
      default_vendor_id INT NULL,
      batch_number VARCHAR(100) NULL,
      expiry_date DATE NULL,
      storage_location VARCHAR(255) NULL,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_stock_products_category (category_id),
      INDEX idx_stock_products_name (product_name),
      INDEX idx_stock_products_expiry (expiry_date)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NULL,
      purchase_date DATE NOT NULL,
      invoice_number VARCHAR(100) NULL,
      product_id INT NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      rate DECIMAL(12,2) DEFAULT 0,
      gst_percent DECIMAL(5,2) DEFAULT 0,
      total_amount DECIMAL(12,2) DEFAULT 0,
      batch_number VARCHAR(100) NULL,
      expiry_date DATE NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_purchases_product (product_id),
      INDEX idx_stock_purchases_vendor (vendor_id),
      INDEX idx_stock_purchases_date (purchase_date)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_issues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      technician_id INT NOT NULL,
      issue_date DATE NOT NULL,
      product_id INT NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      customer_id INT NULL,
      contract_id INT NULL,
      job_id INT NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_issues_technician (technician_id),
      INDEX idx_stock_issues_product (product_id),
      INDEX idx_stock_issues_date (issue_date)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_usage (
      id INT AUTO_INCREMENT PRIMARY KEY,
      technician_id INT NOT NULL,
      usage_date DATE NOT NULL,
      product_id INT NOT NULL,
      quantity_used DECIMAL(12,3) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      customer_id INT NULL,
      contract_id INT NULL,
      job_id INT NULL,
      service_type VARCHAR(150) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_usage_technician (technician_id),
      INDEX idx_stock_usage_product (product_id),
      INDEX idx_stock_usage_date (usage_date)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_returns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      technician_id INT NULL,
      return_date DATE NOT NULL,
      product_id INT NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      return_type ENUM('return_to_office','wastage','damage','expired','adjustment') DEFAULT 'return_to_office',
      source_location ENUM('office','technician') DEFAULT 'technician',
      reason VARCHAR(255) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_returns_technician (technician_id),
      INDEX idx_stock_returns_product (product_id),
      INDEX idx_stock_returns_date (return_date)
    )`,
    `CREATE TABLE IF NOT EXISTS technician_stock_balances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      technician_id INT NOT NULL,
      product_id INT NOT NULL,
      current_balance DECIMAL(12,3) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_technician_product (technician_id, product_id),
      INDEX idx_tech_stock_technician (technician_id),
      INDEX idx_tech_stock_product (product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      product_id INT NOT NULL,
      movement_type ENUM('opening','purchase','issue','usage','return','wastage','damage','expired','adjustment') NOT NULL,
      source_type VARCHAR(50) NULL,
      reference_table VARCHAR(100) NULL,
      reference_id INT NULL,
      technician_id INT NULL,
      vendor_id INT NULL,
      customer_id INT NULL,
      in_qty DECIMAL(12,3) DEFAULT 0,
      out_qty DECIMAL(12,3) DEFAULT 0,
      office_balance_after DECIMAL(12,3) DEFAULT 0,
      technician_balance_after DECIMAL(12,3) DEFAULT 0,
      unit VARCHAR(50) NOT NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_ledger_product (product_id),
      INDEX idx_stock_ledger_date (movement_date),
      INDEX idx_stock_ledger_type (movement_type),
      INDEX idx_stock_ledger_technician (technician_id)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      adjustment_date DATE NOT NULL,
      product_id INT NOT NULL,
      technician_id INT NULL,
      source_location ENUM('office','technician') DEFAULT 'office',
      adjustment_type ENUM('increase','decrease') DEFAULT 'increase',
      quantity DECIMAL(12,3) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      reason VARCHAR(255) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_adjustments_product (product_id),
      INDEX idx_stock_adjustments_date (adjustment_date),
      INDEX idx_stock_adjustments_technician (technician_id)
    )`
  ];

  for (const statement of createStatements) {
    await dbQuery(statement);
  }

  for (const [name, description] of STOCK_CATEGORIES) {
    await dbQuery(
      'INSERT IGNORE INTO stock_categories (name, description) VALUES (?, ?)',
      [name, description]
    );
  }

  await dbQuery(
    `INSERT IGNORE INTO stock_settings (setting_key, setting_value) VALUES
     ('default_units', ?),
     ('low_stock_alert_enabled', '1'),
     ('expiry_alert_days', ?)`,
    [STOCK_UNITS.join(','), String(expiryThresholdDays())]
  );

  await ensureColumn('stock_products', 'category_id', 'category_id INT NULL');
  await ensureColumn('stock_products', 'current_stock', 'current_stock DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_products', 'opening_stock', 'opening_stock DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_products', 'min_stock_level', 'min_stock_level DECIMAL(12,3) DEFAULT 0');
  await ensureColumn('stock_products', 'purchase_rate', 'purchase_rate DECIMAL(12,2) DEFAULT 0');
  await ensureColumn('stock_products', 'internal_rate', 'internal_rate DECIMAL(12,2) DEFAULT 0');
  await ensureColumn('stock_products', 'default_vendor_id', 'default_vendor_id INT NULL');
  await ensureColumn('stock_products', 'batch_number', 'batch_number VARCHAR(100) NULL');
  await ensureColumn('stock_products', 'expiry_date', 'expiry_date DATE NULL');
  await ensureColumn('stock_products', 'storage_location', 'storage_location VARCHAR(255) NULL');
  await ensureColumn('stock_products', 'description', 'description TEXT NULL');
  await ensureColumn('stock_products', 'is_active', 'is_active TINYINT(1) DEFAULT 1');
};

let stockSchemaPromise = null;
const ensureStockSchemaReady = async () => {
  if (!stockSchemaPromise) {
    stockSchemaPromise = ensureStockSchema().catch((error) => {
      console.error('Stock schema bootstrap failed:', error);
      throw error;
    });
  }
  return stockSchemaPromise;
};

const canUseRows = (value) => Array.isArray(value) ? value : [];
const firstRow = (rows) => (Array.isArray(rows) ? rows[0] : null);
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const productUnit = (value) => {
  const unit = text(value).toLowerCase();
  return STOCK_UNITS.includes(unit) ? unit : text(value || 'piece');
};
const isPositive = (value) => toNumber(value) > 0;
const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthRange = (year, month) => {
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
};

const loadEmployees = async () => {
  try {
    const rows = await dbQuery(
      `SELECT id, external_id, emp_code, first_name, last_name, full_name, role, role_name, department, status, payload
       FROM employees
       ORDER BY id DESC`
    );
    return canUseRows(rows).map(normalizeEmployee);
  } catch (_error) {
    return [];
  }
};

const loadVendors = async () => {
  try {
    const rows = await dbQuery('SELECT id, external_id, vendor_name, company_name, status, payload FROM vendors ORDER BY id DESC');
    return canUseRows(rows).map(normalizeVendor);
  } catch (_error) {
    return [];
  }
};

const loadCustomers = async () => {
  try {
    const rows = await dbQuery('SELECT id, external_id, payload FROM customers ORDER BY id DESC');
    return canUseRows(rows).map((row) => {
      const payload = safeJson(row.payload, {});
      return {
        id: String(row.id ?? payload.id ?? row.external_id ?? '').trim(),
        name: text(payload.displayName || payload.customerName || payload.companyName || payload.name || 'Customer')
      };
    });
  } catch (_error) {
    return [];
  }
};

const loadCategories = async () => {
  try {
    const rows = await dbQuery('SELECT id, name, description FROM stock_categories ORDER BY name ASC');
    return canUseRows(rows).map(normalizeCategory);
  } catch (_error) {
    return [];
  }
};

const loadProducts = async () => {
  try {
    const rows = await dbQuery(
      `SELECT p.*, c.name AS category_name, v.vendor_name AS vendor_name, v.company_name AS vendor_company_name
       FROM stock_products p
       LEFT JOIN stock_categories c ON c.id = p.category_id
       LEFT JOIN vendors v ON v.id = p.default_vendor_id
       ORDER BY p.is_active DESC, p.product_name ASC`
    );
    return canUseRows(rows).map((row) => ({
      id: Number(row.id),
      productCode: text(row.product_code || ''),
      productName: text(row.product_name || ''),
      categoryId: row.category_id ?? null,
      categoryName: text(row.category_name || ''),
      unit: text(row.unit || ''),
      openingStock: Number(row.opening_stock || 0),
      currentStock: Number(row.current_stock || 0),
      minStockLevel: Number(row.min_stock_level || 0),
      purchaseRate: Number(row.purchase_rate || 0),
      internalRate: Number(row.internal_rate || 0),
      defaultVendorId: row.default_vendor_id ?? null,
      defaultVendorName: text(row.vendor_name || row.vendor_company_name || ''),
      batchNumber: text(row.batch_number || ''),
      expiryDate: row.expiry_date ? dateOnly(row.expiry_date) : null,
      storageLocation: text(row.storage_location || ''),
      description: text(row.description || ''),
      active: Number(row.is_active || 0) !== 0,
      status: Number(row.current_stock || 0) <= 0 ? 'Out of Stock' : Number(row.current_stock || 0) <= Number(row.min_stock_level || 0) ? 'Low Stock' : 'In Stock'
    }));
  } catch (_error) {
    return [];
  }
};

const loadTechnicianBalances = async () => {
  try {
    const rows = await dbQuery(
      `SELECT t.current_balance, t.updated_at, p.product_name, p.product_code, p.unit, p.current_stock, e.id AS employee_id,
              e.first_name, e.last_name, e.full_name, e.role, e.role_name, e.department
       FROM technician_stock_balances t
       LEFT JOIN stock_products p ON p.id = t.product_id
       LEFT JOIN employees e ON e.id = t.technician_id
       ORDER BY e.full_name ASC, p.product_name ASC`
    );
    return canUseRows(rows).map((row) => {
      const employee = normalizeEmployee(row);
      return {
        technicianId: row.employee_id ?? null,
        technicianName: employee.name,
        productName: text(row.product_name || ''),
        productCode: text(row.product_code || ''),
        unit: text(row.unit || ''),
        issuedQuantity: Number(row.current_balance || 0),
        usedQuantity: 0,
        returnedQuantity: 0,
        wastedQuantity: 0,
        currentBalance: Number(row.current_balance || 0),
        updatedAt: row.updated_at || null
      };
    });
  } catch (_error) {
    return [];
  }
};

const loadLedgerRows = async (whereClause = '', params = [], limit = 250) => {
  const sql = `
    SELECT l.*, p.product_name, p.product_code,
           e.full_name AS technician_name,
           v.vendor_name AS vendor_name,
           c.payload AS customer_payload
    FROM stock_ledger l
    LEFT JOIN stock_products p ON p.id = l.product_id
    LEFT JOIN employees e ON e.id = l.technician_id
    LEFT JOIN vendors v ON v.id = l.vendor_id
    LEFT JOIN customers c ON c.id = l.customer_id
    ${whereClause}
    ORDER BY l.movement_date DESC, l.id DESC
    LIMIT ${Number(limit) || 250}
  `;
  const rows = await dbQuery(sql, params);
  return canUseRows(rows).map((row) => {
    const customerPayload = safeJson(row.customer_payload, {});
    return {
      id: Number(row.id),
      movementDate: row.movement_date,
      productId: row.product_id,
      productName: text(row.product_name || ''),
      productCode: text(row.product_code || ''),
      movementType: text(row.movement_type || ''),
      sourceType: text(row.source_type || ''),
      referenceTable: text(row.reference_table || ''),
      referenceId: row.reference_id ?? null,
      technicianId: row.technician_id ?? null,
      technicianName: text(row.technician_name || ''),
      vendorId: row.vendor_id ?? null,
      vendorName: text(row.vendor_name || ''),
      customerId: row.customer_id ?? null,
      customerName: text(customerPayload.displayName || customerPayload.customerName || customerPayload.companyName || customerPayload.name || ''),
      inQty: Number(row.in_qty || 0),
      outQty: Number(row.out_qty || 0),
      officeBalanceAfter: Number(row.office_balance_after || 0),
      technicianBalanceAfter: Number(row.technician_balance_after || 0),
      unit: text(row.unit || ''),
      notes: text(row.notes || '')
    };
  });
};

const stockSummaryQuery = async () => {
  const products = await loadProducts();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = monthRange(currentYear, currentMonth).start;
  const [purchaseRows, issueRows, usageRows, balanceRows] = await Promise.all([
    dbQuery('SELECT COALESCE(SUM(total_amount), 0) AS total FROM stock_purchases WHERE purchase_date BETWEEN ? AND ?', [monthStart, today]),
    dbQuery('SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_issues WHERE issue_date = ?', [today]),
    dbQuery('SELECT COALESCE(SUM(quantity_used), 0) AS total FROM stock_usage WHERE usage_date = ?', [today]),
    dbQuery('SELECT COALESCE(SUM(current_balance), 0) AS total FROM technician_stock_balances')
  ]);

  const lowStockItems = products.filter((row) => row.currentStock <= row.minStockLevel && row.currentStock > 0);
  const outOfStockItems = products.filter((row) => row.currentStock <= 0);
  const totalValue = products.reduce((sum, row) => sum + (Number(row.currentStock || 0) * Number(row.purchaseRate || 0)), 0);
  const totalTarget = products.reduce((sum, row) => sum + Number(row.minStockLevel || 0), 0);
  const totalStock = products.reduce((sum, row) => sum + Number(row.currentStock || 0), 0);
  return {
    totalProducts: products.length,
    totalStockValue: totalValue,
    lowStockItems: lowStockItems.length,
    outOfStockItems: outOfStockItems.length,
    todayStockIssued: Number(firstRow(issueRows)?.total || 0),
    todayStockUsed: Number(firstRow(usageRows)?.total || 0),
    stockWithTechnicians: Number(firstRow(balanceRows)?.total || 0),
    monthlyPurchaseValue: Number(firstRow(purchaseRows)?.total || 0),
    totalMinStock: totalTarget,
    totalCurrentStock: totalStock
  };
};

const lockProduct = async (conn, productId) => {
  const rows = await conn.query('SELECT * FROM stock_products WHERE id = ? LIMIT 1 FOR UPDATE', [productId]);
  return firstRow(rows[0]);
};

const lockTechnicianBalance = async (conn, technicianId, productId) => {
  const rows = await conn.query(
    'SELECT * FROM technician_stock_balances WHERE technician_id = ? AND product_id = ? LIMIT 1 FOR UPDATE',
    [technicianId, productId]
  );
  return firstRow(rows[0]);
};

const writeLedger = async (conn, entry) => {
  await conn.query(
    `INSERT INTO stock_ledger (
      movement_date, product_id, movement_type, source_type, reference_table, reference_id,
      technician_id, vendor_id, customer_id, in_qty, out_qty, office_balance_after,
      technician_balance_after, unit, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.movementDate || new Date(),
      entry.productId,
      entry.movementType,
      entry.sourceType || null,
      entry.referenceTable || null,
      entry.referenceId || null,
      entry.technicianId || null,
      entry.vendorId || null,
      entry.customerId || null,
      entry.inQty || 0,
      entry.outQty || 0,
      entry.officeBalanceAfter || 0,
      entry.technicianBalanceAfter || 0,
      entry.unit || 'piece',
      entry.notes || null,
      entry.createdBy || null
    ]
  );
};

const saveProduct = async (body, id = null) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const values = {
      productCode: text(body.productCode || body.product_code || ''),
      productName: text(body.productName || body.product_name || ''),
      categoryId: body.categoryId ? Number(body.categoryId) : body.category_id ? Number(body.category_id) : null,
      unit: productUnit(body.unit || 'piece'),
      openingStock: Math.max(0, num(body.openingStock || body.opening_stock, 0)),
      minStockLevel: Math.max(0, num(body.minStockLevel || body.min_stock_level, 0)),
      purchaseRate: Math.max(0, num(body.purchaseRate || body.purchase_rate, 0)),
      internalRate: Math.max(0, num(body.internalRate || body.internal_rate, 0)),
      defaultVendorId: body.defaultVendorId ? Number(body.defaultVendorId) : body.default_vendor_id ? Number(body.default_vendor_id) : null,
      batchNumber: text(body.batchNumber || body.batch_number || ''),
      expiryDate: dateOnly(body.expiryDate || body.expiry_date),
      storageLocation: text(body.storageLocation || body.storage_location || ''),
      description: text(body.description || ''),
      active: body.active === false || body.isActive === false || body.is_active === 0 ? 0 : 1
    };
    if (!values.productName) throw new Error('Product name is required');
    if (!values.unit) throw new Error('Unit is required');

    if (id) {
      await conn.query(
        `UPDATE stock_products SET
         product_code=?, product_name=?, category_id=?, unit=?, opening_stock=?, min_stock_level=?, purchase_rate=?,
         internal_rate=?, default_vendor_id=?, batch_number=?, expiry_date=?, storage_location=?, description=?, is_active=?
         WHERE id=?`,
        [
          values.productCode || null,
          values.productName,
          values.categoryId,
          values.unit,
          values.openingStock,
          values.minStockLevel,
          values.purchaseRate,
          values.internalRate,
          values.defaultVendorId,
          values.batchNumber || null,
          values.expiryDate,
          values.storageLocation || null,
          values.description || null,
          values.active,
          id
        ]
      );
    } else {
      const currentStock = values.openingStock;
      const [result] = await conn.query(
        `INSERT INTO stock_products (
          product_code, product_name, category_id, unit, opening_stock, current_stock, min_stock_level,
          purchase_rate, internal_rate, default_vendor_id, batch_number, expiry_date, storage_location,
          description, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          values.productCode || null,
          values.productName,
          values.categoryId,
          values.unit,
          values.openingStock,
          currentStock,
          values.minStockLevel,
          values.purchaseRate,
          values.internalRate,
          values.defaultVendorId,
          values.batchNumber || null,
          values.expiryDate,
          values.storageLocation || null,
          values.description || null,
          values.active
        ]
      );
      if (values.openingStock > 0) {
        const productRow = await lockProduct(conn, result.insertId);
        await writeLedger(conn, {
          movementDate: new Date(),
          productId: result.insertId,
          movementType: 'opening',
          sourceType: 'office',
          referenceTable: 'stock_products',
          referenceId: result.insertId,
          inQty: values.openingStock,
          outQty: 0,
          officeBalanceAfter: Number(productRow?.current_stock || currentStock),
          technicianBalanceAfter: 0,
          unit: values.unit,
          notes: 'Opening stock',
          createdBy: body.createdBy || null
        });
      }
    }

    await conn.commit();
    const savedId = id || result?.insertId || null;
    if (!savedId) return null;
    const [rows] = await conn.query(
      `SELECT p.*, c.name AS category_name, v.vendor_name AS vendor_name, v.company_name AS vendor_company_name
       FROM stock_products p
       LEFT JOIN stock_categories c ON c.id = p.category_id
       LEFT JOIN vendors v ON v.id = p.default_vendor_id
       WHERE p.id = ?
       LIMIT 1`,
      [savedId]
    );
    return firstRow(rows);
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
};

const decreaseOfficeStock = async (conn, productId, qty) => {
  const product = await lockProduct(conn, productId);
  const current = Number(product?.current_stock || 0);
  if (current < qty) throw new Error('Issue quantity cannot exceed available office stock.');
  await conn.query('UPDATE stock_products SET current_stock = current_stock - ? WHERE id = ?', [qty, productId]);
  return current - qty;
};

const getOrCreateBalance = async (conn, technicianId, productId) => {
  const existing = await lockTechnicianBalance(conn, technicianId, productId);
  if (existing) return existing;
  await conn.query('INSERT INTO technician_stock_balances (technician_id, product_id, current_balance) VALUES (?, ?, 0)', [technicianId, productId]);
  const fresh = await lockTechnicianBalance(conn, technicianId, productId);
  return fresh;
};

const updateTechnicianBalance = async (conn, technicianId, productId, delta) => {
  const balance = await getOrCreateBalance(conn, technicianId, productId);
  const current = Number(balance?.current_balance || 0);
  const next = current + delta;
  if (next < 0) throw new Error('Technician stock cannot go below zero.');
  await conn.query(
    'UPDATE technician_stock_balances SET current_balance = ? WHERE technician_id = ? AND product_id = ?',
    [next, technicianId, productId]
  );
  return next;
};

router.use(async (_req, _res, next) => {
  try {
    await ensureStockSchemaReady();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/stock/options', async (_req, res) => {
  try {
    const [categories, vendors, employees, customers] = await Promise.all([
      loadCategories(),
      loadVendors(),
      loadEmployees(),
      loadCustomers()
    ]);
    const technicians = employees.filter((employee) => employee.active && employee.isTechnician);
    res.json({ categories, vendors, employees, technicians, customers, units: STOCK_UNITS });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load stock options.' });
  }
});

router.get('/stock/dashboard', async (_req, res) => {
  try {
    const [summary, products, categories, technicianStock, ledgerRows] = await Promise.all([
      stockSummaryQuery(),
      loadProducts(),
      loadCategories(),
      loadTechnicianBalances(),
      loadLedgerRows('', [], 30)
    ]);

    const categoryWise = categories.map((category) => ({
      name: category.name,
      value: products.filter((product) => String(product.categoryId || '') === String(category.id)).reduce((sum, row) => sum + Number(row.currentStock || 0), 0)
    })).filter((row) => row.value > 0);

    const monthMap = new Map();
    const now = new Date();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const dt = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      monthMap.set(monthKey(dt.getFullYear(), dt.getMonth() + 1), {
        month: dt.toLocaleString('en-IN', { month: 'short' }),
        purchaseValue: 0,
        usageValue: 0
      });
    }

    const purchaseRows = canUseRows(await dbQuery(
      `SELECT purchase_date, total_amount FROM stock_purchases
       WHERE purchase_date >= ?`,
      [new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10)]
    ));
    purchaseRows.forEach((row) => {
      const dt = dateOnly(row.purchase_date);
      if (!dt) return;
      const key = monthKey(dt.getFullYear(), dt.getMonth() + 1);
      const item = monthMap.get(key);
      if (item) item.purchaseValue += Number(row.total_amount || 0);
    });

    const usageRows = canUseRows(await dbQuery(
      `SELECT usage_date, quantity_used FROM stock_usage
       WHERE usage_date >= ?`,
      [new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10)]
    ));
    usageRows.forEach((row) => {
      const dt = dateOnly(row.usage_date);
      if (!dt) return;
      const key = monthKey(dt.getFullYear(), dt.getMonth() + 1);
      const item = monthMap.get(key);
      if (item) item.usageValue += Number(row.quantity_used || 0);
    });

    const monthlyComparison = Array.from(monthMap.values());
    const lowStockItems = products
      .filter((row) => row.currentStock <= row.minStockLevel)
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        productName: row.productName,
        unit: row.unit,
        currentStock: row.currentStock,
        minStockLevel: row.minStockLevel,
        status: row.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'
      }));

    const technicianIssued = canUseRows(await dbQuery(
      `SELECT e.id AS employee_id, e.full_name, e.first_name, e.last_name, t.quantity
       FROM stock_issues t
       LEFT JOIN employees e ON e.id = t.technician_id
       ORDER BY t.id DESC`
    ))
      .reduce((acc, row) => {
        const name = text(row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Technician');
        const existing = acc.get(String(row.employee_id || name));
        const nextQty = Number(row.quantity || 0);
        if (existing) {
          existing.quantity += nextQty;
        } else {
          acc.set(String(row.employee_id || name), { technicianId: row.employee_id || null, technicianName: name, quantity: nextQty });
        }
        return acc;
      }, new Map());

    res.json({
      summary,
      categoryWise,
      monthlyComparison,
      lowStockItems,
      technicianIssued: Array.from(technicianIssued.values()),
      recentMovements: ledgerRows,
      technicianStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load stock dashboard.' });
  }
});

router.get('/stock/products', async (_req, res) => {
  try {
    const [products, categories, vendors, technicians] = await Promise.all([
      loadProducts(),
      loadCategories(),
      loadVendors(),
      loadEmployees()
    ]);
    res.json({ products, categories, vendors, technicians: technicians.filter((employee) => employee.active), units: STOCK_UNITS });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load products.' });
  }
});

router.post('/stock/products', async (req, res) => {
  try {
    const saved = await saveProduct(req.body || {});
    res.status(201).json({ success: true, item: saved });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save product.' });
  }
});

router.put('/stock/products/:id', async (req, res) => {
  try {
    const saved = await saveProduct(req.body || {}, req.params.id);
    res.json({ success: true, item: saved });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update product.' });
  }
});

router.delete('/stock/products/:id', async (req, res) => {
  try {
    await dbQuery('UPDATE stock_products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to delete product.' });
  }
});

router.get('/stock/purchases', async (_req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT p.*, pr.product_name, pr.product_code, v.vendor_name, v.company_name, e.full_name AS created_by_name
       FROM stock_purchases p
       LEFT JOIN stock_products pr ON pr.id = p.product_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN employees e ON e.id = p.created_by
       ORDER BY p.purchase_date DESC, p.id DESC`
    );
    res.json(canUseRows(rows).map((row) => ({
      id: Number(row.id),
      vendorId: row.vendor_id ?? null,
      vendorName: text(row.vendor_name || row.company_name || ''),
      purchaseDate: row.purchase_date,
      invoiceNumber: text(row.invoice_number || ''),
      productId: Number(row.product_id),
      productName: text(row.product_name || ''),
      productCode: text(row.product_code || ''),
      quantity: Number(row.quantity || 0),
      unit: text(row.unit || ''),
      rate: Number(row.rate || 0),
      gstPercent: Number(row.gst_percent || 0),
      totalAmount: Number(row.total_amount || 0),
      batchNumber: text(row.batch_number || ''),
      expiryDate: row.expiry_date || null,
      notes: text(row.notes || ''),
      createdByName: text(row.created_by_name || '')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load purchases.' });
  }
});

router.post('/stock/purchases', async (req, res) => {
  const conn = await getConnection();
  try {
    const body = req.body || {};
    const purchaseDate = dateOnly(body.purchaseDate || body.purchase_date || new Date()) || new Date().toISOString().slice(0, 10);
    const productId = Number(body.productId || body.product_id || 0);
    const quantity = num(body.quantity, 0);
    const unit = productUnit(body.unit || 'piece');
    const rate = Math.max(0, num(body.rate, 0));
    const gstPercent = Math.max(0, num(body.gstPercent || body.gst_percent, 0));
    const totalAmount = Math.max(0, num(body.totalAmount || body.total_amount, quantity * rate));
    if (!productId) throw new Error('Product is required');
    if (!isPositive(quantity)) throw new Error('Quantity must be greater than zero');
    await conn.beginTransaction();
    const product = await lockProduct(conn, productId);
    if (!product) throw new Error('Product not found');
    const [result] = await conn.query(
      `INSERT INTO stock_purchases (
        vendor_id, purchase_date, invoice_number, product_id, quantity, unit, rate, gst_percent,
        total_amount, batch_number, expiry_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.vendorId || body.vendor_id || null,
        purchaseDate,
        text(body.invoiceNumber || body.invoice_number || '') || null,
        productId,
        quantity,
        unit,
        rate,
        gstPercent,
        totalAmount,
        text(body.batchNumber || body.batch_number || '') || null,
        dateOnly(body.expiryDate || body.expiry_date),
        text(body.notes || '') || null,
        body.createdBy || null
      ]
    );
    const officeAfter = Number(product.current_stock || 0) + quantity;
    await conn.query('UPDATE stock_products SET current_stock = ? WHERE id = ?', [officeAfter, productId]);
    await writeLedger(conn, {
      movementDate: purchaseDate,
      productId,
      movementType: 'purchase',
      sourceType: 'office',
      referenceTable: 'stock_purchases',
      referenceId: result.insertId,
      vendorId: body.vendorId || body.vendor_id || null,
      inQty: quantity,
      outQty: 0,
      officeBalanceAfter: officeAfter,
      technicianBalanceAfter: 0,
      unit,
      notes: text(body.notes || '') || 'Stock purchase',
      createdBy: body.createdBy || null
    });
    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId, officeStock: officeAfter });
  } catch (error) {
    await conn.rollback().catch(() => {});
    res.status(400).json({ error: error.message || 'Unable to save purchase.' });
  } finally {
    conn.release();
  }
});

router.get('/stock/issues', async (_req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT i.*, p.product_name, p.product_code, e.full_name AS technician_name, c.payload AS customer_payload
       FROM stock_issues i
       LEFT JOIN stock_products p ON p.id = i.product_id
       LEFT JOIN employees e ON e.id = i.technician_id
       LEFT JOIN customers c ON c.id = i.customer_id
       ORDER BY i.issue_date DESC, i.id DESC`
    );
    res.json(canUseRows(rows).map((row) => {
      const customerPayload = safeJson(row.customer_payload, {});
      return {
        id: Number(row.id),
        technicianId: row.technician_id ?? null,
        technicianName: text(row.technician_name || ''),
        issueDate: row.issue_date,
        productId: Number(row.product_id),
        productName: text(row.product_name || ''),
        productCode: text(row.product_code || ''),
        quantity: Number(row.quantity || 0),
        unit: text(row.unit || ''),
        customerId: row.customer_id ?? null,
        customerName: text(customerPayload.displayName || customerPayload.customerName || customerPayload.companyName || customerPayload.name || ''),
        contractId: row.contract_id ?? null,
        jobId: row.job_id ?? null,
        notes: text(row.notes || '')
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load issues.' });
  }
});

router.post('/stock/issues', async (req, res) => {
  const conn = await getConnection();
  try {
    const body = req.body || {};
    const technicianId = Number(body.technicianId || body.technician_id || 0);
    const productId = Number(body.productId || body.product_id || 0);
    const quantity = num(body.quantity, 0);
    const issueDate = dateOnly(body.issueDate || body.issue_date || new Date()) || new Date().toISOString().slice(0, 10);
    const unit = productUnit(body.unit || 'piece');
    if (!technicianId) throw new Error('Technician is required');
    if (!productId) throw new Error('Product is required');
    if (!isPositive(quantity)) throw new Error('Quantity must be greater than zero');

    await conn.beginTransaction();
    const product = await lockProduct(conn, productId);
    if (!product) throw new Error('Product not found');
    const officeAfter = await decreaseOfficeStock(conn, productId, quantity);
    const technicianAfter = await updateTechnicianBalance(conn, technicianId, productId, quantity);
    const [result] = await conn.query(
      `INSERT INTO stock_issues (
        technician_id, issue_date, product_id, quantity, unit, customer_id, contract_id, job_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        technicianId,
        issueDate,
        productId,
        quantity,
        unit,
        body.customerId || body.customer_id || null,
        body.contractId || body.contract_id || null,
        body.jobId || body.job_id || null,
        text(body.notes || '') || null,
        body.createdBy || null
      ]
    );
    await writeLedger(conn, {
      movementDate: issueDate,
      productId,
      movementType: 'issue',
      sourceType: 'office',
      referenceTable: 'stock_issues',
      referenceId: result.insertId,
      technicianId,
      customerId: body.customerId || body.customer_id || null,
      outQty: quantity,
      inQty: 0,
      officeBalanceAfter: officeAfter,
      technicianBalanceAfter: technicianAfter,
      unit,
      notes: text(body.notes || '') || 'Issued to technician',
      createdBy: body.createdBy || null
    });
    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId, officeStock: officeAfter, technicianStock: technicianAfter });
  } catch (error) {
    await conn.rollback().catch(() => {});
    res.status(400).json({ error: error.message || 'Unable to save issue.' });
  } finally {
    conn.release();
  }
});

router.get('/stock/technician-stock', async (_req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT b.*, p.product_name, p.product_code, p.unit, e.full_name, e.first_name, e.last_name, e.role, e.role_name, e.department
       FROM technician_stock_balances b
       LEFT JOIN stock_products p ON p.id = b.product_id
       LEFT JOIN employees e ON e.id = b.technician_id
       ORDER BY e.full_name ASC, p.product_name ASC`
    );
    res.json(canUseRows(rows).map((row) => ({
      technicianId: row.technician_id ?? null,
      technicianName: text(row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Technician'),
      productId: Number(row.product_id),
      productName: text(row.product_name || ''),
      productCode: text(row.product_code || ''),
      unit: text(row.unit || ''),
      issuedQuantity: Number(row.current_balance || 0),
      usedQuantity: 0,
      returnedQuantity: 0,
      wastedQuantity: 0,
      currentBalance: Number(row.current_balance || 0),
      updatedAt: row.updated_at || null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load technician stock.' });
  }
});

router.get('/stock/usage', async (_req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT u.*, p.product_name, p.product_code, e.full_name AS technician_name, c.payload AS customer_payload
       FROM stock_usage u
       LEFT JOIN stock_products p ON p.id = u.product_id
       LEFT JOIN employees e ON e.id = u.technician_id
       LEFT JOIN customers c ON c.id = u.customer_id
       ORDER BY u.usage_date DESC, u.id DESC`
    );
    res.json(canUseRows(rows).map((row) => {
      const customerPayload = safeJson(row.customer_payload, {});
      return {
        id: Number(row.id),
        technicianId: row.technician_id ?? null,
        technicianName: text(row.technician_name || ''),
        usageDate: row.usage_date,
        productId: Number(row.product_id),
        productName: text(row.product_name || ''),
        productCode: text(row.product_code || ''),
        quantityUsed: Number(row.quantity_used || 0),
        unit: text(row.unit || ''),
        customerId: row.customer_id ?? null,
        customerName: text(customerPayload.displayName || customerPayload.customerName || customerPayload.companyName || customerPayload.name || ''),
        serviceType: text(row.service_type || ''),
        notes: text(row.notes || '')
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load usage.' });
  }
});

router.post('/stock/usage', async (req, res) => {
  const conn = await getConnection();
  try {
    const body = req.body || {};
    const technicianId = Number(body.technicianId || body.technician_id || 0);
    const productId = Number(body.productId || body.product_id || 0);
    const quantityUsed = num(body.quantityUsed || body.quantity_used || body.quantity, 0);
    const usageDate = dateOnly(body.usageDate || body.usage_date || new Date()) || new Date().toISOString().slice(0, 10);
    const unit = productUnit(body.unit || 'piece');
    if (!technicianId) throw new Error('Technician is required');
    if (!productId) throw new Error('Product is required');
    if (!isPositive(quantityUsed)) throw new Error('Quantity used must be greater than zero');

    await conn.beginTransaction();
    const balance = await getOrCreateBalance(conn, technicianId, productId);
    const currentBalance = Number(balance?.current_balance || 0);
    if (currentBalance < quantityUsed) throw new Error('Usage quantity cannot exceed technician stock balance.');
    const nextBalance = currentBalance - quantityUsed;
    await conn.query(
      'UPDATE technician_stock_balances SET current_balance = ? WHERE technician_id = ? AND product_id = ?',
      [nextBalance, technicianId, productId]
    );
    const [result] = await conn.query(
      `INSERT INTO stock_usage (
        technician_id, usage_date, product_id, quantity_used, unit, customer_id, contract_id, job_id, service_type, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        technicianId,
        usageDate,
        productId,
        quantityUsed,
        unit,
        body.customerId || body.customer_id || null,
        body.contractId || body.contract_id || null,
        body.jobId || body.job_id || null,
        text(body.serviceType || body.service_type || '') || null,
        text(body.notes || '') || null,
        body.createdBy || null
      ]
    );
    const product = await lockProduct(conn, productId);
    await writeLedger(conn, {
      movementDate: usageDate,
      productId,
      movementType: 'usage',
      sourceType: 'technician',
      referenceTable: 'stock_usage',
      referenceId: result.insertId,
      technicianId,
      customerId: body.customerId || body.customer_id || null,
      outQty: quantityUsed,
      inQty: 0,
      officeBalanceAfter: Number(product?.current_stock || 0),
      technicianBalanceAfter: nextBalance,
      unit,
      notes: text(body.notes || '') || 'Stock used at customer site',
      createdBy: body.createdBy || null
    });
    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId, technicianStock: nextBalance });
  } catch (error) {
    await conn.rollback().catch(() => {});
    res.status(400).json({ error: error.message || 'Unable to save usage.' });
  } finally {
    conn.release();
  }
});

router.get('/stock/returns', async (_req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT r.*, p.product_name, p.product_code, e.full_name AS technician_name
       FROM stock_returns r
       LEFT JOIN stock_products p ON p.id = r.product_id
       LEFT JOIN employees e ON e.id = r.technician_id
       ORDER BY r.return_date DESC, r.id DESC`
    );
    res.json(canUseRows(rows).map((row) => ({
      id: Number(row.id),
      technicianId: row.technician_id ?? null,
      technicianName: text(row.technician_name || ''),
      returnDate: row.return_date,
      productId: Number(row.product_id),
      productName: text(row.product_name || ''),
      productCode: text(row.product_code || ''),
      quantity: Number(row.quantity || 0),
      unit: text(row.unit || ''),
      returnType: text(row.return_type || ''),
      sourceLocation: text(row.source_location || ''),
      reason: text(row.reason || ''),
      notes: text(row.notes || '')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load returns.' });
  }
});

router.post('/stock/returns', async (req, res) => {
  const conn = await getConnection();
  try {
    const body = req.body || {};
    const productId = Number(body.productId || body.product_id || 0);
    const quantity = num(body.quantity, 0);
    const returnDate = dateOnly(body.returnDate || body.return_date || new Date()) || new Date().toISOString().slice(0, 10);
    const unit = productUnit(body.unit || 'piece');
    const returnType = text(body.returnType || body.return_type || 'return_to_office');
    const sourceLocation = text(body.sourceLocation || body.source_location || 'technician');
    const technicianId = body.technicianId || body.technician_id ? Number(body.technicianId || body.technician_id) : null;
    if (!productId) throw new Error('Product is required');
    if (!isPositive(quantity)) throw new Error('Quantity must be greater than zero');

    await conn.beginTransaction();
    const product = await lockProduct(conn, productId);
    if (!product) throw new Error('Product not found');
    let officeAfter = Number(product.current_stock || 0);
    let technicianAfter = technicianId ? Number((await lockTechnicianBalance(conn, technicianId, productId))?.current_balance || 0) : 0;

    if (returnType === 'return_to_office') {
      if (!technicianId) throw new Error('Technician is required for return to office.');
      technicianAfter = await updateTechnicianBalance(conn, technicianId, productId, -quantity);
      officeAfter = Number(product.current_stock || 0) + quantity;
      await conn.query('UPDATE stock_products SET current_stock = ? WHERE id = ?', [officeAfter, productId]);
    } else if (['wastage', 'damage', 'expired'].includes(returnType)) {
      if (sourceLocation === 'office') {
        if (Number(product.current_stock || 0) < quantity) throw new Error('Insufficient office stock.');
        officeAfter = Number(product.current_stock || 0) - quantity;
        await conn.query('UPDATE stock_products SET current_stock = ? WHERE id = ?', [officeAfter, productId]);
      } else {
        if (!technicianId) throw new Error('Technician is required for technician stock wastage/damage.');
        technicianAfter = await updateTechnicianBalance(conn, technicianId, productId, -quantity);
      }
    } else {
      throw new Error('Invalid return type');
    }

    const [result] = await conn.query(
      `INSERT INTO stock_returns (
        technician_id, return_date, product_id, quantity, unit, return_type, source_location, reason, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        technicianId,
        returnDate,
        productId,
        quantity,
        unit,
        returnType,
        sourceLocation,
        text(body.reason || '') || null,
        text(body.notes || '') || null,
        body.createdBy || null
      ]
    );
    const movementType = returnType === 'return_to_office' ? 'return' : returnType;
    await writeLedger(conn, {
      movementDate: returnDate,
      productId,
      movementType,
      sourceType: sourceLocation,
      referenceTable: 'stock_returns',
      referenceId: result.insertId,
      technicianId,
      outQty: returnType === 'return_to_office' ? 0 : quantity,
      inQty: returnType === 'return_to_office' ? quantity : 0,
      officeBalanceAfter: officeAfter,
      technicianBalanceAfter: technicianAfter,
      unit,
      notes: text(body.reason || body.notes || '') || 'Stock return / wastage / damage',
      createdBy: body.createdBy || null
    });
    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId, officeStock: officeAfter, technicianStock: technicianAfter });
  } catch (error) {
    await conn.rollback().catch(() => {});
    res.status(400).json({ error: error.message || 'Unable to save return.' });
  } finally {
    conn.release();
  }
});

router.get('/stock/adjustments', async (_req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT a.*, p.product_name, p.product_code, e.full_name AS technician_name
       FROM stock_adjustments a
       LEFT JOIN stock_products p ON p.id = a.product_id
       LEFT JOIN employees e ON e.id = a.technician_id
       ORDER BY a.adjustment_date DESC, a.id DESC`
    );
    res.json(canUseRows(rows).map((row) => ({
      id: Number(row.id),
      adjustmentDate: row.adjustment_date,
      productId: Number(row.product_id),
      productName: text(row.product_name || ''),
      productCode: text(row.product_code || ''),
      technicianId: row.technician_id ?? null,
      technicianName: text(row.technician_name || ''),
      sourceLocation: text(row.source_location || ''),
      adjustmentType: text(row.adjustment_type || ''),
      quantity: Number(row.quantity || 0),
      unit: text(row.unit || ''),
      reason: text(row.reason || ''),
      notes: text(row.notes || '')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load adjustments.' });
  }
});

router.post('/stock/adjustments', async (req, res) => {
  const conn = await getConnection();
  try {
    const body = req.body || {};
    const adjustmentDate = dateOnly(body.adjustmentDate || body.adjustment_date || new Date()) || new Date().toISOString().slice(0, 10);
    const productId = Number(body.productId || body.product_id || 0);
    const technicianId = body.technicianId || body.technician_id ? Number(body.technicianId || body.technician_id) : null;
    const sourceLocation = text(body.sourceLocation || body.source_location || 'office');
    const adjustmentType = text(body.adjustmentType || body.adjustment_type || 'increase');
    const quantity = num(body.quantity, 0);
    const unit = productUnit(body.unit || 'piece');
    if (!productId) throw new Error('Product is required');
    if (!isPositive(quantity)) throw new Error('Quantity must be greater than zero');

    await conn.beginTransaction();
    const product = await lockProduct(conn, productId);
    if (!product) throw new Error('Product not found');
    let officeAfter = Number(product.current_stock || 0);
    let technicianAfter = technicianId ? Number((await lockTechnicianBalance(conn, technicianId, productId))?.current_balance || 0) : 0;

    if (sourceLocation === 'office') {
      const next = adjustmentType === 'decrease' ? officeAfter - quantity : officeAfter + quantity;
      if (next < 0) throw new Error('Office stock cannot go below zero.');
      officeAfter = next;
      await conn.query('UPDATE stock_products SET current_stock = ? WHERE id = ?', [officeAfter, productId]);
    } else {
      if (!technicianId) throw new Error('Technician is required for technician adjustment.');
      const delta = adjustmentType === 'decrease' ? -quantity : quantity;
      technicianAfter = await updateTechnicianBalance(conn, technicianId, productId, delta);
    }

    const [result] = await conn.query(
      `INSERT INTO stock_adjustments (
        adjustment_date, product_id, technician_id, source_location, adjustment_type, quantity, unit, reason, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adjustmentDate,
        productId,
        technicianId,
        sourceLocation,
        adjustmentType,
        quantity,
        unit,
        text(body.reason || '') || null,
        text(body.notes || '') || null,
        body.createdBy || null
      ]
    );

    await writeLedger(conn, {
      movementDate: adjustmentDate,
      productId,
      movementType: 'adjustment',
      sourceType: sourceLocation,
      referenceTable: 'stock_adjustments',
      referenceId: result.insertId,
      technicianId,
      inQty: sourceLocation === 'office' && adjustmentType === 'increase' ? quantity : 0,
      outQty: sourceLocation === 'office' && adjustmentType === 'decrease' ? quantity : 0,
      officeBalanceAfter: officeAfter,
      technicianBalanceAfter: technicianAfter,
      unit,
      notes: text(body.reason || body.notes || '') || 'Manual stock adjustment',
      createdBy: body.createdBy || null
    });

    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId, officeStock: officeAfter, technicianStock: technicianAfter });
  } catch (error) {
    await conn.rollback().catch(() => {});
    res.status(400).json({ error: error.message || 'Unable to save adjustment.' });
  } finally {
    conn.release();
  }
});

router.get('/stock/low-stock', async (_req, res) => {
  try {
    const rows = await loadProducts();
    const expiryDays = expiryThresholdDays();
    const today = new Date();
    const soon = new Date(today);
    soon.setDate(soon.getDate() + expiryDays);
    res.json(rows
      .filter((row) => row.currentStock <= row.minStockLevel || (row.expiryDate && row.expiryDate <= soon.toISOString().slice(0, 10)))
      .map((row) => ({
        ...row,
        status: row.currentStock <= 0 ? 'Out of Stock' : row.currentStock <= row.minStockLevel ? 'Low Stock' : 'Expiring Soon'
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load low stock items.' });
  }
});

router.get('/stock/ledger', async (req, res) => {
  try {
    const { startDate, endDate, productId, categoryId, vendorId, technicianId, customerId, movementType, limit } = req.query || {};
    const conditions = [];
    const params = [];
    if (startDate) {
      conditions.push('DATE(l.movement_date) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('DATE(l.movement_date) <= ?');
      params.push(endDate);
    }
    if (productId) {
      conditions.push('l.product_id = ?');
      params.push(productId);
    }
    if (technicianId) {
      conditions.push('l.technician_id = ?');
      params.push(technicianId);
    }
    if (vendorId) {
      conditions.push('l.vendor_id = ?');
      params.push(vendorId);
    }
    if (customerId) {
      conditions.push('l.customer_id = ?');
      params.push(customerId);
    }
    if (movementType) {
      conditions.push('l.movement_type = ?');
      params.push(String(movementType).toLowerCase());
    }
    if (categoryId) {
      conditions.push('p.category_id = ?');
      params.push(categoryId);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await loadLedgerRows(whereClause, params, limit ? Number(limit) : 250);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load ledger.' });
  }
});

const buildReportRows = async (type, filters = {}) => {
  if (type === 'current-stock') {
    const rows = await loadProducts();
    return {
      summary: {
        totalRows: rows.length,
        totalValue: rows.reduce((sum, row) => sum + Number(row.currentStock || 0) * Number(row.purchaseRate || 0), 0)
      },
      rows
    };
  }
  if (type === 'purchase') {
    const rows = await dbQuery(
      `SELECT p.*, pr.product_name, pr.product_code, v.vendor_name, v.company_name
       FROM stock_purchases p
       LEFT JOIN stock_products pr ON pr.id = p.product_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       WHERE (? IS NULL OR p.purchase_date >= ?)
         AND (? IS NULL OR p.purchase_date <= ?)
         AND (? IS NULL OR p.product_id = ?)
         AND (? IS NULL OR p.vendor_id = ?)
       ORDER BY p.purchase_date DESC, p.id DESC`,
      [
        filters.startDate || null, filters.startDate || null,
        filters.endDate || null, filters.endDate || null,
        filters.productId || null, filters.productId || null,
        filters.vendorId || null, filters.vendorId || null
      ]
    );
    return { rows: canUseRows(rows), summary: { totalRows: rows.length, totalValue: rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0) } };
  }
  if (type === 'issue') {
    const rows = await dbQuery(
      `SELECT i.*, p.product_name, e.full_name AS technician_name
       FROM stock_issues i
       LEFT JOIN stock_products p ON p.id = i.product_id
       LEFT JOIN employees e ON e.id = i.technician_id
       WHERE (? IS NULL OR i.issue_date >= ?)
         AND (? IS NULL OR i.issue_date <= ?)
         AND (? IS NULL OR i.product_id = ?)
         AND (? IS NULL OR i.technician_id = ?)
       ORDER BY i.issue_date DESC, i.id DESC`,
      [
        filters.startDate || null, filters.startDate || null,
        filters.endDate || null, filters.endDate || null,
        filters.productId || null, filters.productId || null,
        filters.technicianId || null, filters.technicianId || null
      ]
    );
    return { rows: canUseRows(rows), summary: { totalRows: rows.length, totalValue: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0) } };
  }
  if (type === 'usage') {
    const rows = await dbQuery(
      `SELECT u.*, p.product_name, e.full_name AS technician_name
       FROM stock_usage u
       LEFT JOIN stock_products p ON p.id = u.product_id
       LEFT JOIN employees e ON e.id = u.technician_id
       WHERE (? IS NULL OR u.usage_date >= ?)
         AND (? IS NULL OR u.usage_date <= ?)
         AND (? IS NULL OR u.product_id = ?)
         AND (? IS NULL OR u.technician_id = ?)
       ORDER BY u.usage_date DESC, u.id DESC`,
      [
        filters.startDate || null, filters.startDate || null,
        filters.endDate || null, filters.endDate || null,
        filters.productId || null, filters.productId || null,
        filters.technicianId || null, filters.technicianId || null
      ]
    );
    return { rows: canUseRows(rows), summary: { totalRows: rows.length, totalValue: rows.reduce((sum, row) => sum + Number(row.quantity_used || 0), 0) } };
  }
  if (type === 'wastage' || type === 'damage' || type === 'expiry') {
    const movementType = type === 'expiry' ? 'expired' : type;
    const rows = await dbQuery(
      `SELECT r.*, p.product_name, e.full_name AS technician_name
       FROM stock_returns r
       LEFT JOIN stock_products p ON p.id = r.product_id
       LEFT JOIN employees e ON e.id = r.technician_id
       WHERE r.return_type = ?
         AND (? IS NULL OR r.return_date >= ?)
         AND (? IS NULL OR r.return_date <= ?)
         AND (? IS NULL OR r.product_id = ?)
         AND (? IS NULL OR r.technician_id = ?)
       ORDER BY r.return_date DESC, r.id DESC`,
      [
        movementType,
        filters.startDate || null, filters.startDate || null,
        filters.endDate || null, filters.endDate || null,
        filters.productId || null, filters.productId || null,
        filters.technicianId || null, filters.technicianId || null
      ]
    );
    return { rows: canUseRows(rows), summary: { totalRows: rows.length, totalValue: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0) } };
  }
  const rows = await loadLedgerRows('', [], 1000);
  return { rows, summary: { totalRows: rows.length, totalValue: rows.reduce((sum, row) => sum + Number(row.inQty || 0) + Number(row.outQty || 0), 0) } };
};

router.get('/stock/reports', async (req, res) => {
  try {
    const reportType = String(req.query.reportType || req.query.type || 'current-stock').trim().toLowerCase();
    const result = await buildReportRows(reportType, {
      startDate: req.query.startDate || req.query.start_date || null,
      endDate: req.query.endDate || req.query.end_date || null,
      productId: req.query.productId || req.query.product_id || null,
      vendorId: req.query.vendorId || req.query.vendor_id || null,
      technicianId: req.query.technicianId || req.query.technician_id || null
    });
    res.json({
      reportType,
      summary: result.summary,
      rows: result.rows,
      filters: req.query
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load stock reports.' });
  }
});

const csvEscape = (value) => {
  const raw = String(value ?? '');
  if (/[,"\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
};

router.get('/stock/export', async (req, res) => {
  try {
    const format = String(req.query.format || 'excel').toLowerCase();
    const reportType = String(req.query.reportType || req.query.type || 'current-stock').trim().toLowerCase();
    const result = await buildReportRows(reportType, {
      startDate: req.query.startDate || req.query.start_date || null,
      endDate: req.query.endDate || req.query.end_date || null,
      productId: req.query.productId || req.query.product_id || null,
      vendorId: req.query.vendorId || req.query.vendor_id || null,
      technicianId: req.query.technicianId || req.query.technician_id || null
    });

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=stock-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
      doc.pipe(res);
      doc.fontSize(18).text('SKUAS Pest Control CRM', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(14).text(`Stock Report: ${reportType}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString('en-IN')}`);
      doc.moveDown();
      doc.fontSize(11).text(`Rows: ${result.rows.length}`);
      doc.moveDown();
      result.rows.slice(0, 50).forEach((row) => {
        doc.fontSize(9).text(JSON.stringify(row));
        doc.moveDown(0.2);
      });
      doc.end();
      return;
    }

    const rows = Array.isArray(result.rows) ? result.rows : [];
    const headers = rows.length ? Object.keys(rows[0]) : ['message'];
    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => headers.map((header) => csvEscape(row?.[header])).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=stock-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to export stock report.' });
  }
});

module.exports = { stockManagementRouter: router };
