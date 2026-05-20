const fs = require('fs');
const path = require('path');
const express = require('express');
const { query: dbQuery, getConnection } = require('../lib/db');

const router = express.Router();

const dataDir = path.join(__dirname, '..', 'data');
const storageDataDir = path.join(__dirname, '..', '..', 'storage', 'data');
const jsonPaths = {
  leads: [path.join(dataDir, 'leads.json'), path.join(storageDataDir, 'leads.json')],
  customers: [path.join(dataDir, 'customers.json'), path.join(storageDataDir, 'customers.json')],
  employees: [path.join(dataDir, 'employees.json'), path.join(storageDataDir, 'employees.json')],
  invoices: [path.join(dataDir, 'invoices.json'), path.join(storageDataDir, 'invoices.json')],
  payments: [path.join(dataDir, 'payments.json'), path.join(storageDataDir, 'payments.json')],
  renewals: [path.join(dataDir, 'renewals.json'), path.join(storageDataDir, 'renewals.json')],
  quotations: [path.join(dataDir, 'quotations.json'), path.join(storageDataDir, 'quotations.json')],
  contracts: [path.join(dataDir, 'contracts.json'), path.join(storageDataDir, 'contracts.json')]
};

const text = (value) => String(value ?? '').trim();
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const safeRows = (value) => (Array.isArray(value) ? value : []);
const safeJson = (value, fallback = {}) => {
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
const sendError = (res, status, error) => res.status(status).json({ success: false, error });
const monthLabel = (month) => new Date(2026, Math.max(0, Number(month) - 1), 1).toLocaleString('en-IN', { month: 'short' });
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const defaultYears = [currentYear - 1, currentYear, currentYear + 1];
const monthList = Array.from({ length: 12 }, (_, index) => index + 1);
const monthKey = (year, month) => `${Number(year)}-${String(Number(month)).padStart(2, '0')}`;
const getSafeTargetMonth = (value) => {
  const month = Number(value);
  return Number.isFinite(month) && month > 0 ? month : null;
};
const percent = (achieved, target) => {
  const total = num(target);
  if (total <= 0) return 0;
  return Math.round((num(achieved) / total) * 1000) / 10;
};
const monthName = (month) => {
  const value = Number(month);
  if (!value) return '';
  return new Date(2026, Math.max(0, value - 1), 1).toLocaleString('en-IN', { month: 'short' });
};
const displayTargetTypeLabel = (targetType) => {
  const value = text(targetType).toLowerCase();
  if (value === 'yearly') return 'Yearly';
  return 'Monthly';
};
const displayTargetLabel = (row = {}) => {
  const type = text(row.targetType || row.target_type || 'monthly').toLowerCase();
  const year = Number(row.targetYear || row.target_year || 0) || null;
  const month = Number(row.targetMonth || row.target_month || 0) || null;
  const typeLabel = displayTargetTypeLabel(type);
  if (type === 'yearly') {
    return year ? `${typeLabel} ${year}` : typeLabel;
  }
  const monthLabelText = month ? monthName(month) : '';
  if (monthLabelText && year) return `${typeLabel} ${monthLabelText} ${year}`;
  if (monthLabelText) return `${typeLabel} ${monthLabelText}`;
  if (year) return `${typeLabel} ${year}`;
  return typeLabel;
};
const requestActor = (req = {}) => text(req.headers?.['x-user-name'] || req.headers?.['x-portal-user'] || req.body?.actor || 'System');
const valueOf = (source, keys = []) => {
  for (const key of keys) {
    const raw = source?.[key];
    if (raw !== undefined && raw !== null && raw !== '') return raw;
  }
  return null;
};
const hasColumn = (columns, ...names) => names.some((name) => columns.has(String(name).toLowerCase()));
const stableTargetExternalId = (salesPersonId, targetType, targetYear, targetMonth = null) => {
  const person = text(salesPersonId).replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'TARGET';
  const type = text(targetType).replace(/[^a-z0-9]/gi, '') || 'monthly';
  const year = Number(targetYear) || currentYear;
  const month = targetType === 'monthly' ? String(Number(targetMonth) || 0).padStart(2, '0') : '00';
  return `SPT-${person}-${type}-${year}-${month}`;
};
const extractSalesPersonRefFromExternalId = (externalId = '') => {
  const value = text(externalId);
  if (!value.startsWith('SPT-')) return '';
  const payload = value.slice(4);
  const firstDash = payload.indexOf('-');
  if (firstDash <= 0) return '';
  return payload.slice(0, firstDash);
};
const legacyTargetExternalId = (row = {}) => {
  const salesPersonId = text(row.sales_person_id || row.employee_id || row.salesPersonId || row.employeeId || '');
  const targetType = text(row.target_type || row.period_type || 'monthly').toLowerCase() || 'monthly';
  const targetYear = Number(row.target_year || row.year || currentYear) || currentYear;
  const targetMonth = targetType === 'monthly'
    ? getSafeTargetMonth(row.target_month || row.month || null)
    : null;
  if (salesPersonId) return stableTargetExternalId(salesPersonId, targetType, targetYear, targetMonth);
  return `SPT-LEGACY-${Number(row.id) || Date.now()}`;
};
const readJsonFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};
const readJsonCandidates = (files = []) => {
  for (const file of files) {
    const rows = readJsonFile(file);
    if (rows.length) return rows;
  }
  return [];
};
const getColumns = async (tableName) => {
  try {
    const rows = await dbQuery(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
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
  await dbQuery(`CREATE TABLE IF NOT EXISTS sales_targets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    external_id VARCHAR(120) NOT NULL,
    sales_person_id INT NOT NULL,
    target_type ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
    target_month TINYINT NULL,
    target_year INT NOT NULL,
    revenue_target DECIMAL(12,2) DEFAULT 0,
    collection_target DECIMAL(12,2) DEFAULT 0,
    notes TEXT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sales_targets_person (sales_person_id),
    INDEX idx_sales_targets_type (target_type),
    INDEX idx_sales_targets_month_year (target_month, target_year),
    UNIQUE KEY uk_sales_targets_external_id (external_id),
    UNIQUE KEY unique_sales_target (sales_person_id, target_type, target_month, target_year)
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS sales_target_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_id INT NULL,
    external_id VARCHAR(120) NULL,
    action VARCHAR(30) NOT NULL,
    actor VARCHAR(255) NULL,
    target_type VARCHAR(20) NULL,
    target_month TINYINT NULL,
    target_year INT NULL,
    sales_person_id VARCHAR(80) NULL,
    sales_person_name VARCHAR(255) NULL,
    revenue_target DECIMAL(12,2) DEFAULT 0,
    collection_target DECIMAL(12,2) DEFAULT 0,
    payload_json LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sales_target_audit_target (target_id),
    INDEX idx_sales_target_audit_action (action),
    INDEX idx_sales_target_audit_created_at (created_at)
  )`);

  await ensureColumn('sales_targets', 'external_id', 'external_id VARCHAR(120) NULL');
  await ensureColumn('sales_targets', 'sales_person_id', 'sales_person_id INT NULL');
  await ensureColumn('sales_targets', 'target_type', "target_type ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly'");
  await ensureColumn('sales_targets', 'target_month', 'target_month TINYINT NULL');
  await ensureColumn('sales_targets', 'target_year', 'target_year INT NULL');
  await ensureColumn('sales_targets', 'revenue_target', 'revenue_target DECIMAL(12,2) DEFAULT 0');
  await ensureColumn('sales_targets', 'collection_target', 'collection_target DECIMAL(12,2) DEFAULT 0');
  await ensureColumn('sales_targets', 'notes', 'notes TEXT NULL');
  await ensureColumn('sales_targets', 'is_active', 'is_active TINYINT(1) DEFAULT 1');
  await ensureColumn('sales_targets', 'created_by', 'created_by INT NULL');
  await ensureColumn('sales_targets', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('sales_targets', 'updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  const oldColumns = await getColumns('sales_targets');
  if (oldColumns.has('employee_id')) {
    try {
      await dbQuery('UPDATE sales_targets SET sales_person_id = COALESCE(sales_person_id, employee_id) WHERE sales_person_id IS NULL OR sales_person_id = 0');
    } catch (_error) {}
  }
  if (oldColumns.has('period_type')) {
    try {
      await dbQuery("UPDATE sales_targets SET target_type = COALESCE(target_type, period_type) WHERE (target_type IS NULL OR target_type = '') AND period_type IN ('monthly','yearly')");
    } catch (_error) {}
  }
  if (oldColumns.has('month')) {
    try {
      await dbQuery('UPDATE sales_targets SET target_month = COALESCE(target_month, month) WHERE target_month IS NULL');
    } catch (_error) {}
  }
  if (oldColumns.has('year')) {
    try {
      await dbQuery('UPDATE sales_targets SET target_year = COALESCE(target_year, year) WHERE target_year IS NULL OR target_year = 0');
    } catch (_error) {}
  }
  if (oldColumns.has('external_id')) {
    try {
      const legacyRows = await queryRows(
        `SELECT id, external_id, sales_person_id, employee_id, target_type, period_type, target_month, month, target_year, year
         FROM sales_targets
         WHERE external_id IS NULL OR external_id = ''`
      );
      for (const row of legacyRows) {
        const nextExternalId = legacyTargetExternalId(row);
        try {
          await dbQuery('UPDATE sales_targets SET external_id = ? WHERE id = ? AND (external_id IS NULL OR external_id = \'\')', [nextExternalId, row.id]);
        } catch (_error) {}
      }
    } catch (_error) {}
  }
};
let schemaReadyPromise = null;
const ensureSchemaReady = async () => {
  if (!schemaReadyPromise) schemaReadyPromise = ensureSchema();
  return schemaReadyPromise;
};
const loadJsonSource = (key) => readJsonCandidates(jsonPaths[key] || []);
const queryRows = async (sql, params = []) => {
  try {
    const rows = await dbQuery(sql, params);
    return safeRows(rows);
  } catch (_error) {
    return [];
  }
};
const loadRows = async (table, key, limit = 3000) => {
  const rows = await queryRows(`SELECT * FROM ${table} ORDER BY id DESC LIMIT ${Number(limit) || 3000}`);
  if (rows.length) return rows;
  return loadJsonSource(key);
};
const normalizeEmployee = (row = {}, hasRoleColumns = true) => {
  const payload = safeJson(row.payload, {});
  const status = text(row.status || payload.status || 'Active');
  const active = !status || ['active', '1', 'true', 'yes', 'enabled'].includes(status.toLowerCase());
  const role = text(row.role || payload.role || '');
  const roleName = text(row.role_name || payload.roleName || '');
  const department = text(row.department || payload.department || '');
  const name = text(row.full_name || payload.fullName || [row.first_name, row.last_name].filter(Boolean).join(' ') || payload.name || row.name || `Employee ${row.id || ''}`);
  const salesKeywords = ['sales', 'marketing', 'business development', 'lead', 'revenue', 'bd'];
  const isSales = hasRoleColumns ? salesKeywords.some((word) => `${role} ${roleName} ${department}`.toLowerCase().includes(word)) : true;
  return {
    id: text(row.external_id || row._id || row.id || payload._id || name),
    dbId: row.id ?? null,
    employeeCode: text(row.emp_code || payload.empCode || payload.employeeCode || ''),
    name,
    role,
    roleName,
    department,
    status,
    active,
    isSales
  };
};
const buildEmployeeLookup = (employees = []) => {
  const byId = new Map();
  const byName = new Map();
  const byCode = new Map();
  employees.forEach((employee) => {
    if (employee.id) byId.set(String(employee.id).toLowerCase(), employee);
    if (employee.dbId !== null && employee.dbId !== undefined) byId.set(String(employee.dbId).toLowerCase(), employee);
    if (employee.employeeCode) byCode.set(String(employee.employeeCode).toLowerCase(), employee);
    if (employee.name) byName.set(String(employee.name).toLowerCase(), employee);
  });
  return { byId, byName, byCode };
};
const pickEmployee = (lookup, value) => {
  const ref = text(value).toLowerCase();
  if (!ref) return null;
  return lookup.byId.get(ref) || lookup.byCode.get(ref) || lookup.byName.get(ref) || null;
};
const employeeHasValue = (employee, value) => {
  const ref = text(value).toLowerCase();
  if (!ref) return false;
  return [employee.id, employee.dbId, employee.employeeCode, employee.name, employee.role, employee.roleName].map(text).filter(Boolean).some((item) => item.toLowerCase() === ref);
};
const resolveEmployee = (lookup, employeeValue, employeeNameValue = '') => {
  const direct = pickEmployee(lookup, employeeValue);
  if (direct) return direct;
  const byName = pickEmployee(lookup, employeeNameValue);
  if (byName) return byName;
  return null;
};
const normalizeTargetRow = (row = {}, lookup = null) => {
  const payload = safeJson(row.payload, {});
  const source = { ...payload, ...row };
  const salesPersonRaw = valueOf(source, [
    'sales_person_id', 'salesPersonId', 'employee_id', 'employeeId', 'sales_person', 'salesPerson', 'assigned_to', 'assignedTo',
    'sales_id', 'salesId', 'created_by', 'createdBy', 'employee_external_id', 'employeeExternalId'
  ]);
  const salesPersonRef = salesPersonRaw || extractSalesPersonRefFromExternalId(source.external_id || source.target_external_id || '');
  const salesPersonNameRaw = valueOf(source, [
    'sales_person_name', 'salesPersonName', 'employee_name', 'employeeName', 'assigned_to_name', 'assignedToName',
    'created_by_name', 'createdByName'
  ]);
  const employee = lookup ? resolveEmployee(lookup, salesPersonRef, salesPersonNameRaw) : null;
  const targetType = text(source.target_type || source.period_type || 'monthly').toLowerCase() || 'monthly';
  const targetMonth = getSafeTargetMonth(valueOf(source, ['target_month', 'month', 'week_number']));
  const targetYear = Number(valueOf(source, ['target_year', 'year'])) || null;
  const revenueTarget = num(valueOf(source, ['revenue_target', 'target_amount', 'amount', 'grand_total', 'total_amount']), 0);
  const collectionTarget = num(valueOf(source, ['collection_target', 'lead_target', 'quotation_target', 'conversion_target']), 0);
  return {
    id: row.id,
    externalId: text(source.external_id || source.target_external_id || ''),
    salesPersonId: text(employee?.id || salesPersonRef || ''),
    salesPersonName: text(employee?.name || salesPersonNameRaw || ''),
    salesPersonCode: text(employee?.employeeCode || source.employee_code || source.employeeCode || ''),
    targetType,
    targetMonth,
    targetYear,
    createdAt: text(source.created_at || source.createdAt || ''),
    updatedAt: text(source.updated_at || source.updatedAt || ''),
    createdBy: text(source.created_by || source.createdBy || ''),
    revenueTarget,
    collectionTarget,
    notes: text(source.notes || source.remark || ''),
    isActive: Number(source.is_active ?? 1) !== 0,
    employee,
    targetLabel: displayTargetLabel({
      targetType,
      targetMonth,
      targetYear
    })
  };
};
const writeTargetAudit = async (client = { query: dbQuery }, { action = 'saved', targetId = null, externalId = '', payload = {}, actor = '' }) => {
  try {
    await client.query(
      `INSERT INTO sales_target_audit (
        target_id, external_id, action, actor, target_type, target_month, target_year,
        sales_person_id, sales_person_name, revenue_target, collection_target, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetId,
        text(externalId),
        text(action || 'saved'),
        text(actor || ''),
        text(payload.targetType || payload.target_type || ''),
        payload.targetMonth ?? payload.target_month ?? null,
        payload.targetYear ?? payload.target_year ?? null,
        text(payload.salesPersonId || payload.sales_person_id || ''),
        text(payload.salesPersonName || payload.sales_person_name || ''),
        num(payload.revenueTarget || payload.revenue_target || 0),
        num(payload.collectionTarget || payload.collection_target || 0),
        JSON.stringify(payload || {})
      ]
    );
  } catch (_error) {}
};
const syncSalesTargetEmployeeFields = async (rows = [], lookup = null) => {
  if (!lookup || !Array.isArray(rows) || rows.length === 0) return;
  const columns = await getColumns('sales_targets');
  const hasSalesPersonId = columns.has('sales_person_id');
  const hasEmployeeId = columns.has('employee_id');
  const hasEmployeeName = columns.has('employee_name');
  const hasEmployeeCode = columns.has('employee_code');
  const hasSalesPersonName = columns.has('sales_person_name');
  const hasSalesPersonCode = columns.has('sales_person_code');
  const hasUpdatedAt = columns.has('updated_at');
  if (!hasSalesPersonId && !hasEmployeeId && !hasEmployeeName && !hasEmployeeCode && !hasSalesPersonName && !hasSalesPersonCode) return;

  for (const row of safeRows(rows)) {
    const normalized = normalizeTargetRow(row, lookup);
    const employee = normalized.employee;
    if (!employee) continue;

    const resolvedId = text(employee.id || employee.dbId || normalized.salesPersonId || '');
    const resolvedName = text(employee.name || normalized.salesPersonName || '');
    const resolvedCode = text(employee.employeeCode || normalized.salesPersonCode || '');
    const updates = [];
    const params = [];

    const numericId = Number(resolvedId);
    const safeSalesPersonId = Number.isFinite(numericId) && numericId > 0 && numericId <= 2147483647 ? Math.trunc(numericId) : null;

    if (hasSalesPersonId && safeSalesPersonId && (row.sales_person_id === null || row.sales_person_id === undefined || row.sales_person_id === '' || Number(row.sales_person_id) <= 0)) {
      updates.push('sales_person_id = ?');
      params.push(safeSalesPersonId);
    }
    if (hasEmployeeId && resolvedId && (!text(row.employee_id))) {
      updates.push('employee_id = ?');
      params.push(resolvedId);
    }
    if (hasEmployeeName && resolvedName && (!text(row.employee_name))) {
      updates.push('employee_name = ?');
      params.push(resolvedName);
    }
    if (hasEmployeeCode && resolvedCode && (!text(row.employee_code))) {
      updates.push('employee_code = ?');
      params.push(resolvedCode);
    }
    if (hasSalesPersonName && resolvedName && (!text(row.sales_person_name))) {
      updates.push('sales_person_name = ?');
      params.push(resolvedName);
    }
    if (hasSalesPersonCode && resolvedCode && (!text(row.sales_person_code))) {
      updates.push('sales_person_code = ?');
      params.push(resolvedCode);
    }
    if (!updates.length) continue;
    if (hasUpdatedAt) updates.push('updated_at = CURRENT_TIMESTAMP');
    try {
      await dbQuery(`UPDATE sales_targets SET ${updates.join(', ')} WHERE id = ?`, [...params, row.id]);
    } catch (_error) {}
  }
};
const buildTargetPersistData = async (columns, body = {}, lookup = null) => {
  const employee = lookup ? resolveEmployee(lookup, body.salesPersonId || body.sales_person_id || '', body.salesPersonName || body.sales_person_name || body.employeeName || body.employee_name || '') : null;
  const salesPersonId = text(body.salesPersonId || body.sales_person_id || employee?.id || '');
  const targetType = text(body.targetType || body.target_type || 'monthly').toLowerCase();
  const targetMonth = targetType === 'monthly' ? getSafeTargetMonth(body.targetMonth || body.target_month || body.month) : null;
  const targetYear = Number(body.targetYear || body.target_year || body.year || 0);
  const revenueTarget = num(body.revenueTarget || body.revenue_target || body.amount || 0);
  const collectionTarget = num(body.collectionTarget || body.collection_target || body.leadTarget || body.lead_target || 0);
  const externalId = stableTargetExternalId(salesPersonId, targetType, targetYear, targetMonth);
  const employeeName = text(employee?.name || body.salesPersonName || body.sales_person_name || body.employeeName || body.employee_name || '');
  const employeeCode = text(employee?.employeeCode || body.salesPersonCode || body.sales_person_code || body.employeeCode || body.employee_code || '');
  const numericSalesPersonId = Number(salesPersonId);
  const safeSalesPersonId = Number.isFinite(numericSalesPersonId) && numericSalesPersonId > 0 && numericSalesPersonId <= 2147483647 ? Math.trunc(numericSalesPersonId) : null;
  const data = {};
  if (hasColumn(columns, 'external_id')) data.external_id = externalId;
  if (hasColumn(columns, 'sales_person_id') && safeSalesPersonId !== null) data.sales_person_id = safeSalesPersonId;
  if (hasColumn(columns, 'employee_id')) data.employee_id = salesPersonId;
  if (hasColumn(columns, 'employee_name')) data.employee_name = employeeName;
  if (hasColumn(columns, 'employee_code')) data.employee_code = employeeCode;
  if (hasColumn(columns, 'sales_person_name')) data.sales_person_name = employeeName;
  if (hasColumn(columns, 'sales_person_code')) data.sales_person_code = employeeCode;
  if (hasColumn(columns, 'target_type')) data.target_type = targetType;
  if (hasColumn(columns, 'target_month')) data.target_month = targetMonth;
  if (hasColumn(columns, 'target_year')) data.target_year = targetYear;
  if (hasColumn(columns, 'revenue_target')) data.revenue_target = revenueTarget;
  if (hasColumn(columns, 'collection_target')) data.collection_target = collectionTarget;
  if (hasColumn(columns, 'notes')) data.notes = text(body.notes || '');
  if (hasColumn(columns, 'is_active')) data.is_active = 1;
  if (hasColumn(columns, 'created_by')) data.created_by = body.createdBy || body.created_by || null;
  return { data, externalId, salesPersonId, targetType, targetMonth, targetYear, collectionTarget, revenueTarget, employeeName, employeeCode };
};
const normalizeSource = (kind, row = {}, lookup = null) => {
  const payload = safeJson(row.payload, {});
  const source = { ...payload, ...row };
  const employeeRaw = valueOf(source, [
    'sales_person_id', 'sales_person', 'salesPerson', 'assigned_to', 'assignedTo', 'employee_id', 'employeeId',
    'created_by', 'createdBy', 'sales_id', 'salesId', 'sold_by', 'soldBy'
  ]);
  const employeeNameRaw = valueOf(source, [
    'sales_person_name', 'salesPersonName', 'assigned_to_name', 'assignedToName', 'employee_name', 'employeeName',
    'created_by_name', 'createdByName'
  ]);
  const employee = lookup ? pickEmployee(lookup, employeeRaw) || pickEmployee(lookup, employeeNameRaw) : null;
  const dateValue = valueOf(source, kind === 'payments'
    ? ['payment_date', 'received_date', 'date', 'created_at', 'createdAt']
    : kind === 'invoices'
      ? ['invoice_date', 'date', 'created_at', 'createdAt']
      : kind === 'quotations'
        ? ['quotation_date', 'date', 'created_at', 'createdAt']
        : kind === 'contracts'
          ? ['contract_date', 'start_date', 'date', 'created_at', 'createdAt']
          : ['lead_date', 'date', 'created_at', 'createdAt']);
  const amountValue = valueOf(source, kind === 'payments'
    ? ['payment_amount', 'amount', 'paid_amount', 'received_amount', 'receipt_amount', 'total_amount']
    : kind === 'invoices'
      ? ['grand_total', 'total_amount', 'invoice_total', 'amount', 'net_amount']
      : kind === 'quotations'
        ? ['quotation_value', 'grand_total', 'total_amount', 'amount', 'value']
        : kind === 'contracts'
          ? ['contract_value', 'total_amount', 'amount', 'annual_value', 'value']
          : ['quotation_value', 'value', 'amount', 'estimated_value']);
  const status = text(source.lead_status || source.status || source.leadStatus || '');
  const converted = /converted|booked|won|closed/i.test(status);
  return {
    kind,
    employeeId: employee?.id || text(employeeRaw || employeeNameRaw || ''),
    employeeName: employee?.name || text(employeeNameRaw || ''),
    date: dateValue ? new Date(dateValue) : null,
    amount: num(amountValue, 0),
    converted,
    status,
    source
  };
};
const getDatesInRange = (year) => monthList.map((month) => new Date(Number(year), month - 1, 1));
const matchesDate = (dt, year, month) => dt && dt.getFullYear() === Number(year) && dt.getMonth() + 1 === Number(month);
const matchesYear = (dt, year) => dt && dt.getFullYear() === Number(year);
const matchesRange = (dt, startDate, endDate) => {
  if (!dt) return false;
  if (startDate && dt < new Date(`${startDate}T00:00:00`)) return false;
  if (endDate && dt > new Date(`${endDate}T23:59:59`)) return false;
  return true;
};
const summarizeRecords = (records = [], employee, year, month, startDate = '', endDate = '') => {
  const personRecords = records.filter((record) => {
    const matchesEmployee = employee ? employeeHasValue(employee, record.employeeId) || employeeHasValue(employee, record.employeeName) : true;
    return matchesEmployee && matchesRange(record.date, startDate, endDate);
  });
  const monthly = personRecords.filter((record) => matchesDate(record.date, year, month));
  const yearly = personRecords.filter((record) => matchesYear(record.date, year));
  const monthlyLeadsAssigned = monthly.filter((record) => record.kind === 'leads').length;
  const monthlyLeadsConverted = monthly.filter((record) => record.kind === 'leads' && record.converted).length;
  const yearlyLeadsAssigned = yearly.filter((record) => record.kind === 'leads').length;
  const yearlyLeadsConverted = yearly.filter((record) => record.kind === 'leads' && record.converted).length;
  const monthlyInvoices = monthly.filter((record) => record.kind === 'invoices').reduce((sum, record) => sum + num(record.amount), 0);
  const monthlyQuotations = monthly.filter((record) => record.kind === 'quotations').reduce((sum, record) => sum + num(record.amount), 0);
  const monthlyPayments = monthly.filter((record) => record.kind === 'payments').reduce((sum, record) => sum + num(record.amount), 0);
  const yearlyPayments = yearly.filter((record) => record.kind === 'payments').reduce((sum, record) => sum + num(record.amount), 0);
  const yearlyInvoices = yearly.filter((record) => record.kind === 'invoices').reduce((sum, record) => sum + num(record.amount), 0);
  const yearlyQuotations = yearly.filter((record) => record.kind === 'quotations').reduce((sum, record) => sum + num(record.amount), 0);
  const monthlyRevenueAchieved = monthlyInvoices || monthlyQuotations || monthlyPayments;
  const yearlyRevenueAchieved = yearlyInvoices || yearlyQuotations || yearlyPayments;
  return {
    employeeId: employee?.id || '',
    employeeName: employee?.name || 'Employee',
    monthlyTarget: 0,
    monthlyRevenueAchieved,
    monthlyCollectionAchieved: monthlyPayments,
    monthlyPending: 0,
    monthlyAchievementPercent: 0,
    yearlyTarget: 0,
    yearlyRevenueAchieved,
    yearlyCollectionAchieved: yearlyPayments,
    yearlyPending: 0,
    yearlyAchievementPercent: 0,
    leadsAssigned: yearlyLeadsAssigned,
    leadsConverted: yearlyLeadsConverted,
    revenueGenerated: yearlyRevenueAchieved || 0,
    status: 'Low',
    monthlyLeadsAssigned,
    monthlyLeadsConverted,
    summary: {
      monthlyPayments,
      monthlyInvoices,
      monthlyQuotations,
      yearlyPayments,
      yearlyInvoices,
      yearlyQuotations
    }
  };
};
const attachTargets = (row, monthlyTargetRow, yearlyTargetRow) => {
  const monthlyRevenueTarget = monthlyTargetRow ? num(monthlyTargetRow.revenue_target) : 0;
  const monthlyCollectionTarget = monthlyTargetRow ? num(monthlyTargetRow.collection_target ?? monthlyTargetRow.lead_target ?? 0) : 0;
  const monthlyRevenueAchieved = num(row.monthlyRevenueAchieved);
  const monthlyCollectionAchieved = num(row.monthlyCollectionAchieved);
  const yearlyRevenueTarget = yearlyTargetRow ? num(yearlyTargetRow.revenue_target) : 0;
  const yearlyCollectionTarget = yearlyTargetRow ? num(yearlyTargetRow.collection_target ?? yearlyTargetRow.lead_target ?? 0) : 0;
  const yearlyRevenueAchieved = num(row.yearlyRevenueAchieved);
  const yearlyCollectionAchieved = num(row.yearlyCollectionAchieved);
  const monthlyRevenuePercent = percent(monthlyRevenueAchieved, monthlyRevenueTarget);
  const monthlyCollectionPercent = percent(monthlyCollectionAchieved, monthlyCollectionTarget);
  const yearlyRevenuePercent = percent(yearlyRevenueAchieved, yearlyRevenueTarget);
  const yearlyCollectionPercent = percent(yearlyCollectionAchieved, yearlyCollectionTarget);
  const monthlyRevenuePending = Math.max(monthlyRevenueTarget - monthlyRevenueAchieved, 0);
  const monthlyCollectionPending = Math.max(monthlyCollectionTarget - monthlyCollectionAchieved, 0);
  const yearlyRevenuePending = Math.max(yearlyRevenueTarget - yearlyRevenueAchieved, 0);
  const yearlyCollectionPending = Math.max(yearlyCollectionTarget - yearlyCollectionAchieved, 0);
  const status = yearlyRevenuePercent >= 100 ? 'Excellent' : yearlyRevenuePercent >= 75 ? 'Good' : 'Low';
  return {
    ...row,
    monthlyTarget: monthlyRevenueTarget,
    monthlyRevenueTarget,
    monthlyCollectionTarget,
    monthlyRevenueAchieved,
    monthlyCollectionAchieved,
    monthlyAchieved: monthlyRevenueAchieved,
    monthlyRevenuePending,
    monthlyCollectionPending,
    monthlyRevenuePercent,
    monthlyCollectionPercent,
    monthlyPending: monthlyRevenuePending,
    monthlyAchievementPercent: monthlyRevenuePercent,
    yearlyTarget: yearlyRevenueTarget,
    yearlyRevenueTarget,
    yearlyCollectionTarget,
    yearlyRevenueAchieved,
    yearlyCollectionAchieved,
    yearlyAchieved: yearlyRevenueAchieved,
    yearlyRevenuePending,
    yearlyCollectionPending,
    yearlyRevenuePercent,
    yearlyCollectionPercent,
    yearlyPending: yearlyRevenuePending,
    yearlyAchievementPercent: yearlyRevenuePercent,
    status,
    targetMonth: monthlyTargetRow?.target_month ?? null,
    targetYear: monthlyTargetRow?.target_year ?? yearlyTargetRow?.target_year ?? null,
    targetType: monthlyTargetRow?.target_type || yearlyTargetRow?.target_type || 'monthly',
    notes: monthlyTargetRow?.notes || yearlyTargetRow?.notes || ''
  };
};
const loadSalesPeople = async () => {
  const [rows, employeeColumns] = await Promise.all([
    loadRows('employees', 'employees', 3000),
    getColumns('employees')
  ]);
  const hasRoleColumns = ['role', 'role_name', 'department'].some((column) => employeeColumns.has(column));
  const mapped = rows.map((row) => normalizeEmployee(row, hasRoleColumns));
  const active = mapped.filter((row) => row.active);
  const sales = hasRoleColumns ? active.filter((row) => row.isSales) : active;
  return sales.length ? sales : active;
};
const loadSalesContext = async () => {
  const [employees, leadRows, invoiceRows, paymentRows, quotationRows, contractRows, targetRows] = await Promise.all([
    loadSalesPeople(),
    loadRows('leads', 'leads', 4000),
    loadRows('invoices', 'invoices', 4000),
    loadRows('payments', 'payments', 4000),
    loadRows('quotations', 'quotations', 4000),
    loadRows('contracts', 'contracts', 4000),
    queryRows('SELECT * FROM sales_targets WHERE is_active = 1 ORDER BY target_year DESC, target_month DESC, id DESC')
  ]);
  const lookup = buildEmployeeLookup(employees);
  const records = [
    ...safeRows(leadRows).map((row) => normalizeSource('leads', row, lookup)),
    ...safeRows(invoiceRows).map((row) => normalizeSource('invoices', row, lookup)),
    ...safeRows(paymentRows).map((row) => normalizeSource('payments', row, lookup)),
    ...safeRows(quotationRows).map((row) => normalizeSource('quotations', row, lookup)),
    ...safeRows(contractRows).map((row) => normalizeSource('contracts', row, lookup))
  ];
  const normalizedTargets = safeRows(targetRows).map((row) => normalizeTargetRow(row, lookup));
  await syncSalesTargetEmployeeFields(safeRows(targetRows), lookup);
  return { employees, records, targets: normalizedTargets, lookup };
};
const findTargetRow = (targets, employee, targetType, year, month = null) => {
  const rows = targets.filter((row) => row.isActive && text(row.targetType) === text(targetType) && Number(row.targetYear) === Number(year));
  const candidate = rows.find((row) => {
    const rowMonth = row.targetMonth === null || row.targetMonth === undefined || row.targetMonth === '' ? null : Number(row.targetMonth);
    if (targetType === 'monthly' && Number(rowMonth) !== Number(month)) return false;
    if (targetType === 'yearly' && rowMonth !== null) return false;
    return employeeHasValue(employee, row.salesPersonId) || employeeHasValue(employee, row.salesPersonCode) || employeeHasValue(employee, row.employeeName) || employeeHasValue(employee, row.salesPersonName);
  });
  return candidate || null;
};
const applyTargets = (employee, context, year, month, startDate = '', endDate = '') => {
  const summary = summarizeRecords(context.records, employee, year, month, startDate, endDate);
  const monthlyTargetRow = findTargetRow(context.targets, employee, 'monthly', year, month);
  const yearlyTargetRow = findTargetRow(context.targets, employee, 'yearly', year);
  return attachTargets(summary, monthlyTargetRow, yearlyTargetRow);
};
const buildMonthlyTrend = (context, year) => monthList.map((month) => {
  const monthlyTargetRows = context.targets.filter((row) => row.isActive && text(row.targetType) === 'monthly' && Number(row.targetYear) === Number(year) && Number(row.targetMonth) === Number(month));
  const monthlyRecords = context.records.filter((record) => matchesDate(record.date, year, month));
  const monthlyInvoices = monthlyRecords.filter((record) => record.kind === 'invoices').reduce((sum, record) => sum + num(record.amount), 0);
  const monthlyQuotations = monthlyRecords.filter((record) => record.kind === 'quotations').reduce((sum, record) => sum + num(record.amount), 0);
  const monthlyPayments = monthlyRecords.filter((record) => record.kind === 'payments').reduce((sum, record) => sum + num(record.amount), 0);
  const target = monthlyTargetRows.reduce((sum, row) => sum + num(row.revenueTarget), 0);
  const achieved = monthlyInvoices || monthlyQuotations || monthlyPayments;
  return { month, label: monthLabel(month), target, achieved, achievementPercent: percent(achieved, target) };
});
const buildYearMatrix = (context, years = []) => years.map((year) => ({
  year,
  cells: monthList.map((month) => {
    const rows = context.employees.map((employee) => applyTargets(employee, context, year, month));
    const target = rows.reduce((sum, row) => sum + num(row.monthlyTarget), 0);
    const achieved = rows.reduce((sum, row) => sum + num(row.monthlyAchieved), 0);
    return { month, target, achieved, achievementPercent: percent(achieved, target) };
  })
}));
const parseYearList = async (context) => {
  const years = new Set(defaultYears);
  context.targets.forEach((row) => {
    if (row.targetYear) years.add(Number(row.targetYear));
  });
  context.records.forEach((row) => {
    if (row.date) years.add(row.date.getFullYear());
  });
  return Array.from(years).filter(Boolean).sort((a, b) => a - b);
};
const buildTargetRows = (context, filters = {}) => {
  const year = filters.year ? Number(filters.year) : null;
  const month = filters.month ? Number(filters.month) : null;
  const salesPersonId = text(filters.salesPersonId || '');
  const targetType = text(filters.targetType || '');
  const rows = context.targets.filter((row) => {
    if (year && Number(row.targetYear) !== year) return false;
    if (month && Number(row.targetMonth || 0) !== month) return false;
    if (targetType && row.targetType !== targetType) return false;
    if (salesPersonId && !employeeHasValue({ id: row.salesPersonId, dbId: row.salesPersonId, employeeCode: row.salesPersonId, name: row.salesPersonName || '' }, salesPersonId)) return false;
    return true;
  });
  return rows.map((row) => {
    const employee = context.employees.find((item) => employeeHasValue(item, row.salesPersonId) || employeeHasValue(item, row.salesPersonCode) || employeeHasValue(item, row.employeeName) || employeeHasValue(item, row.salesPersonName)) || null;
    const targetTypeResolved = row.targetType === 'yearly' ? 'yearly' : 'monthly';
    const summary = applyTargets(employee || { id: row.salesPersonId, name: row.salesPersonName || row.employeeName || '---' }, context, Number(row.targetYear), Number(row.targetMonth || currentMonth));
    const achievedRevenue = targetTypeResolved === 'yearly' ? num(summary.yearlyRevenueAchieved) : num(summary.monthlyRevenueAchieved);
    const achievedCollection = targetTypeResolved === 'yearly' ? num(summary.yearlyCollectionAchieved) : num(summary.monthlyCollectionAchieved);
    const targetRevenue = num(row.revenueTarget);
    const targetCollection = num(row.collectionTarget);
    return {
      id: row.id,
      salesPersonId: row.salesPersonId,
      salesPersonName: employee?.name || row.salesPersonName || row.employeeName || '---',
      employeeName: employee?.name || row.salesPersonName || row.employeeName || '---',
      sales_person_name: employee?.name || row.salesPersonName || row.employeeName || '---',
      targetType: targetTypeResolved,
      targetLabel: row.targetLabel || displayTargetLabel(row),
      targetMonth: row.targetMonth || null,
      targetYear: row.targetYear,
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
      createdBy: row.createdBy || '',
      revenueTarget: targetRevenue,
      collectionTarget: targetCollection,
      achievedRevenue,
      achievedCollection,
      pendingRevenue: Math.max(targetRevenue - achievedRevenue, 0),
      achievementPercent: percent(achievedRevenue, targetRevenue),
      pendingCollection: Math.max(targetCollection - achievedCollection, 0),
      collectionAchievementPercent: percent(achievedCollection, targetCollection),
      notes: row.notes || ''
    };
  });
};
const buildTeamRows = (context, filters = {}) => {
  const year = Number(filters.year || currentYear);
  const month = Number(filters.month || currentMonth);
  const salesPersonId = text(filters.salesPersonId || '');
  return context.employees
    .filter((employee) => !salesPersonId || employeeHasValue(employee, salesPersonId))
    .map((employee) => {
        const summary = applyTargets(employee, context, year, month, filters.startDate || '', filters.endDate || '');
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          monthlyTarget: summary.monthlyRevenueTarget,
          monthlyAchieved: summary.monthlyRevenueAchieved,
          monthlyPending: summary.monthlyRevenuePending,
          monthlyAchievementPercent: summary.monthlyRevenuePercent,
          yearlyTarget: summary.yearlyRevenueTarget,
          yearlyAchieved: summary.yearlyRevenueAchieved,
          yearlyPending: summary.yearlyRevenuePending,
          yearlyAchievementPercent: summary.yearlyRevenuePercent,
          monthlyCollectionTarget: summary.monthlyCollectionTarget,
          monthlyCollectionAchieved: summary.monthlyCollectionAchieved,
          monthlyCollectionPending: summary.monthlyCollectionPending,
          monthlyCollectionPercent: summary.monthlyCollectionPercent,
          yearlyCollectionTarget: summary.yearlyCollectionTarget,
          yearlyCollectionAchieved: summary.yearlyCollectionAchieved,
          yearlyCollectionPending: summary.yearlyCollectionPending,
          yearlyCollectionPercent: summary.yearlyCollectionPercent,
          leadsAssigned: summary.leadsAssigned,
          leadsConverted: summary.leadsConverted,
          revenueGenerated: summary.revenueGenerated,
        status: summary.status
      };
    })
    .sort((a, b) => num(b.yearlyAchievementPercent) - num(a.yearlyAchievementPercent));
};
const findBestPerformer = (rows = []) => {
  const filtered = rows.filter((row) => num(row.yearlyTarget, 0) > 0 || num(row.yearlyAchieved, 0) > 0 || num(row.monthlyTarget, 0) > 0 || num(row.monthlyAchieved, 0) > 0);
  return [...filtered].sort((a, b) => num(b.yearlyAchievementPercent, 0) - num(a.yearlyAchievementPercent, 0))[0] || null;
};
router.use(async (_req, _res, next) => {
  try {
    await ensureSchemaReady();
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const context = await loadSalesContext();
    const year = Number(req.query.year || currentYear);
    const month = Number(req.query.month || currentMonth);
    const employeeId = text(req.query.employeeId || '');
    const teamRows = buildTeamRows(context, { year, month, salesPersonId: employeeId });
    const monthlyRows = teamRows.map((row) => row);
    const yearlyRows = context.employees
      .filter((employee) => !employeeId || employeeHasValue(employee, employeeId))
      .map((employee) => {
        const summary = applyTargets(employee, context, year, month);
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          yearlyTarget: summary.yearlyTarget,
          yearlyAchieved: summary.yearlyAchieved,
          yearlyPending: summary.yearlyPending,
          yearlyAchievementPercent: summary.yearlyAchievementPercent
        };
      });
    const totalMonthlyTarget = teamRows.reduce((sum, row) => sum + num(row.monthlyTarget), 0);
    const totalMonthlyAchieved = teamRows.reduce((sum, row) => sum + num(row.monthlyAchieved), 0);
    const totalYearlyTarget = teamRows.reduce((sum, row) => sum + num(row.yearlyTarget), 0);
    const totalYearlyAchieved = teamRows.reduce((sum, row) => sum + num(row.yearlyAchieved), 0);
    const bestPerformer = findBestPerformer(yearlyRows);
    const monthlyTrend = buildMonthlyTrend(context, year);
    const years = await parseYearList(context);
    const matrix = buildYearMatrix(context, years.slice(-4));
    return res.json({
      success: true,
      employees: context.employees,
      summary: {
        totalMonthlyTarget,
        totalMonthlyAchieved,
        monthlyPending: Math.max(totalMonthlyTarget - totalMonthlyAchieved, 0),
        monthlyAchievementPercent: percent(totalMonthlyAchieved, totalMonthlyTarget),
        totalYearlyTarget,
        totalYearlyAchieved,
        yearlyPending: Math.max(totalYearlyTarget - totalYearlyAchieved, 0),
        yearlyAchievementPercent: percent(totalYearlyAchieved, totalYearlyTarget),
        bestPerformer: bestPerformer ? { employeeId: bestPerformer.employeeId, employeeName: bestPerformer.employeeName, yearlyAchievementPercent: bestPerformer.yearlyAchievementPercent } : null
      },
      monthlyTrend,
      matrix,
      salesPersonPerformance: teamRows,
      month,
      year
    });
  } catch (error) {
    console.error('Sales performance dashboard failed:', error.message);
    return sendError(res, 500, 'Unable to load sales performance dashboard.');
  }
});

router.get('/targets', async (req, res) => {
  try {
    const context = await loadSalesContext();
    const rows = buildTargetRows(context, req.query || {});
    const auditRows = await queryRows('SELECT * FROM sales_target_audit ORDER BY created_at DESC, id DESC LIMIT 25');
    const recentActivity = safeRows(auditRows).map((entry) => ({
      id: entry.id,
      targetId: entry.target_id,
      action: entry.action,
      actor: entry.actor,
      targetLabel: displayTargetLabel({
        targetType: entry.target_type,
        targetMonth: entry.target_month,
        targetYear: entry.target_year
      }),
      salesPersonName: entry.sales_person_name || '---',
      revenueTarget: num(entry.revenue_target, 0),
      collectionTarget: num(entry.collection_target, 0),
      createdAt: entry.created_at || ''
    }));
    return res.json({ success: true, rows, employees: context.employees, recentActivity });
  } catch (error) {
    console.error('Sales targets failed:', error.message);
    return sendError(res, 500, 'Unable to load sales targets.');
  }
});

router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const rows = await queryRows(`SELECT * FROM sales_target_audit ORDER BY created_at DESC, id DESC LIMIT ${limit}`);
    return res.json({
      success: true,
      rows: safeRows(rows).map((entry) => ({
        id: entry.id,
        targetId: entry.target_id,
        action: entry.action,
        actor: entry.actor,
        targetLabel: displayTargetLabel({
          targetType: entry.target_type,
          targetMonth: entry.target_month,
          targetYear: entry.target_year
        }),
        salesPersonId: entry.sales_person_id,
        salesPersonName: entry.sales_person_name || '---',
        revenueTarget: num(entry.revenue_target, 0),
        collectionTarget: num(entry.collection_target, 0),
        createdAt: entry.created_at || '',
        payload: safeJson(entry.payload_json, {})
      }))
    });
  } catch (error) {
    console.error('Sales target audit failed:', error.message);
    return sendError(res, 500, 'Unable to load sales target audit.');
  }
});

router.post('/targets', async (req, res) => {
  try {
    const body = req.body || {};
    const salesPersonId = text(body.salesPersonId || body.sales_person_id || '');
    const targetType = text(body.targetType || body.target_type || 'monthly').toLowerCase();
    const targetMonth = targetType === 'monthly' ? Number(body.targetMonth || body.target_month || 0) || null : null;
    const targetYear = Number(body.targetYear || body.target_year || 0);
    const revenueTarget = num(body.revenueTarget || body.revenue_target || 0);
    const collectionTarget = num(body.collectionTarget || body.collection_target || body.leadTarget || body.lead_target || 0);
    if (!salesPersonId) return sendError(res, 400, 'Sales person is required.');
    if (!['monthly', 'yearly'].includes(targetType)) return sendError(res, 400, 'Target type must be monthly or yearly.');
    if (!targetYear) return sendError(res, 400, 'Year is required.');
    if (targetType === 'monthly' && !targetMonth) return sendError(res, 400, 'Month is required for monthly targets.');

    const conn = await getConnection();
    try {
      const columns = await getColumns('sales_targets');
      const employees = await loadSalesPeople();
      const lookup = buildEmployeeLookup(employees);
      const persist = await buildTargetPersistData(columns, body, lookup);
      await conn.beginTransaction();
      const [existingRows] = await conn.query(
        `SELECT id FROM sales_targets
         WHERE (external_id = ? OR sales_person_id = ? OR employee_id = ?)
         AND target_type = ? AND target_year = ? AND ${targetType === 'monthly' ? 'target_month = ?' : 'target_month IS NULL'}
         LIMIT 1`,
        targetType === 'monthly'
          ? [persist.externalId, salesPersonId, salesPersonId, targetType, targetYear, targetMonth]
          : [persist.externalId, salesPersonId, salesPersonId, targetType, targetYear]
      );
      const existing = safeRows(existingRows)[0];
      if (existing) {
        const updateData = { ...persist.data, is_active: 1 };
        const updateFields = Object.keys(updateData);
        const updateValues = updateFields.map((field) => updateData[field]);
        await conn.query(
          `UPDATE sales_targets SET ${updateFields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
          [...updateValues, existing.id]
        );
        await writeTargetAudit(conn, {
          action: 'updated',
          targetId: existing.id,
          externalId: persist.externalId,
          payload: { ...persist.data, salesPersonId, salesPersonName: persist.employeeName, targetType, targetMonth, targetYear, revenueTarget, collectionTarget },
          actor: requestActor(req)
        });
      } else {
        const insertData = persist.data;
        const insertFields = Object.keys(insertData);
        const insertValues = insertFields.map((field) => insertData[field]);
        const [insertResult] = await conn.query(
          `INSERT INTO sales_targets (${insertFields.join(', ')})
           VALUES (${insertFields.map(() => '?').join(', ')})`,
          insertValues
        );
        await writeTargetAudit(conn, {
          action: 'created',
          targetId: Number(insertResult?.insertId || 0) || null,
          externalId: persist.externalId,
          payload: { ...persist.data, salesPersonId, salesPersonName: persist.employeeName, targetType, targetMonth, targetYear, revenueTarget, collectionTarget },
          actor: requestActor(req)
        });
      }
      await conn.commit();
      return res.json({ success: true, message: 'Target saved.' });
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Sales target save failed:', error.message);
    return sendError(res, 400, error.message || 'Unable to save target.');
  }
});

router.put('/targets/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const targetId = Number(req.params.id);
    const salesPersonId = text(body.salesPersonId || body.sales_person_id || '');
    const targetType = text(body.targetType || body.target_type || 'monthly').toLowerCase();
    const targetMonth = targetType === 'monthly' ? Number(body.targetMonth || body.target_month || 0) || null : null;
    const targetYear = Number(body.targetYear || body.target_year || 0);
    const revenueTarget = num(body.revenueTarget || body.revenue_target || 0);
    const collectionTarget = num(body.collectionTarget || body.collection_target || body.leadTarget || body.lead_target || 0);
    if (!targetId) return sendError(res, 400, 'Target id is required.');
    if (!salesPersonId) return sendError(res, 400, 'Sales person is required.');
    if (!['monthly', 'yearly'].includes(targetType)) return sendError(res, 400, 'Target type must be monthly or yearly.');
    if (!targetYear) return sendError(res, 400, 'Year is required.');
    if (targetType === 'monthly' && !targetMonth) return sendError(res, 400, 'Month is required for monthly targets.');

    const columns = await getColumns('sales_targets');
    const employees = await loadSalesPeople();
    const lookup = buildEmployeeLookup(employees);
    const persist = await buildTargetPersistData(columns, body, lookup);
    const updateData = { ...persist.data, is_active: 1 };
    const updateFields = Object.keys(updateData);
    const updateValues = updateFields.map((field) => updateData[field]);
    const result = await dbQuery(
      `UPDATE sales_targets SET ${updateFields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
      [...updateValues, targetId]
    );
    if (!result || Number(result.affectedRows) === 0) return sendError(res, 404, 'Target not found.');
    await writeTargetAudit(dbQuery, {
      action: 'updated',
      targetId,
      externalId: persist.externalId,
      payload: { ...persist.data, salesPersonId, salesPersonName: persist.employeeName, targetType, targetMonth, targetYear, revenueTarget, collectionTarget },
      actor: requestActor(req)
    });
    return res.json({ success: true, message: 'Target updated.' });
  } catch (error) {
    console.error('Sales target update failed:', error.message);
    return sendError(res, 400, error.message || 'Unable to update target.');
  }
});

router.delete('/targets/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const [existingRows] = await dbQuery('SELECT * FROM sales_targets WHERE id = ? LIMIT 1', [targetId]);
    const existing = safeRows(existingRows)[0] || null;
    const result = await dbQuery('DELETE FROM sales_targets WHERE id = ?', [targetId]);
    if (!result || Number(result.affectedRows) === 0) return sendError(res, 404, 'Target not found.');
    await writeTargetAudit(dbQuery, {
      action: 'deleted',
      targetId,
      externalId: existing?.external_id || '',
      payload: existing || {},
      actor: requestActor(req)
    });
    return res.json({ success: true, message: 'Target deleted.' });
  } catch (error) {
    console.error('Sales target delete failed:', error.message);
    return sendError(res, 500, 'Unable to delete target.');
  }
});

router.get('/team-performance', async (req, res) => {
  try {
    const context = await loadSalesContext();
    const year = Number(req.query.year || currentYear);
    const month = Number(req.query.month || currentMonth);
    const rows = buildTeamRows(context, { year, month, salesPersonId: req.query.salesPersonId || '' });
    return res.json({ success: true, rows, employees: context.employees, year, month });
  } catch (error) {
    console.error('Sales team performance failed:', error.message);
    return sendError(res, 500, 'Unable to load team performance.');
  }
});

router.get('/year-month-matrix', async (req, res) => {
  try {
    const context = await loadSalesContext();
    const years = (req.query.years ? String(req.query.years).split(',').map((value) => Number(value.trim())).filter(Boolean) : await parseYearList(context)).slice(-4);
    const matrix = buildYearMatrix(context, years);
    return res.json({ success: true, years, matrix, employees: context.employees });
  } catch (error) {
    console.error('Sales year month matrix failed:', error.message);
    return sendError(res, 500, 'Unable to load year month matrix.');
  }
});

router.get('/reports', async (req, res) => {
  try {
    const context = await loadSalesContext();
    const year = Number(req.query.year || currentYear);
    const month = Number(req.query.month || currentMonth);
    const salesPersonId = text(req.query.salesPersonId || '');
    const reportType = text(req.query.reportType || 'monthly').toLowerCase();
    const filteredEmployees = context.employees.filter((employee) => !salesPersonId || employeeHasValue(employee, salesPersonId));
    const rows = filteredEmployees.map((employee) => {
      const summary = applyTargets(employee, context, year, month, req.query.startDate || '', req.query.endDate || '');
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        month,
        year,
        reportType,
        monthlyTarget: summary.monthlyTarget,
        monthlyAchieved: summary.monthlyAchieved,
        monthlyPending: summary.monthlyPending,
        monthlyAchievementPercent: summary.monthlyAchievementPercent,
        yearlyTarget: summary.yearlyTarget,
        yearlyAchieved: summary.yearlyAchieved,
        yearlyPending: summary.yearlyPending,
        yearlyAchievementPercent: summary.yearlyAchievementPercent,
        leadsAssigned: summary.leadsAssigned,
        leadsConverted: summary.leadsConverted,
        revenueGenerated: summary.revenueGenerated,
        status: summary.status
      };
    });
    const summary = {
      rows: rows.length,
      totalMonthlyTarget: rows.reduce((sum, row) => sum + num(row.monthlyTarget), 0),
      totalMonthlyAchieved: rows.reduce((sum, row) => sum + num(row.monthlyAchieved), 0),
      totalYearlyTarget: rows.reduce((sum, row) => sum + num(row.yearlyTarget), 0),
      totalYearlyAchieved: rows.reduce((sum, row) => sum + num(row.yearlyAchieved), 0)
    };
    return res.json({ success: true, rows, summary, reportType, employees: context.employees });
  } catch (error) {
    console.error('Sales reports failed:', error.message);
    return sendError(res, 500, 'Unable to load sales reports.');
  }
});

module.exports = { salesPerformanceRoutes: router };
