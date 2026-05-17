const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const PDFDocument = require('pdfkit');
const { query: dbQuery } = require('../lib/db');

const router = express.Router();

const dataDir = path.join(__dirname, '..', 'data');
const storageDataDir = path.join(__dirname, '..', '..', 'storage', 'data');
const jsonFilePaths = {
  leads: [path.join(dataDir, 'leads.json'), path.join(storageDataDir, 'leads.json')],
  customers: [path.join(dataDir, 'customers.json'), path.join(storageDataDir, 'customers.json')],
  employees: [path.join(dataDir, 'employees.json'), path.join(storageDataDir, 'employees.json')],
  invoices: [path.join(dataDir, 'invoices.json'), path.join(storageDataDir, 'invoices.json')],
  payments: [path.join(dataDir, 'payments.json'), path.join(storageDataDir, 'payments.json')],
  renewals: [path.join(dataDir, 'renewals.json'), path.join(storageDataDir, 'renewals.json')],
  quotations: [path.join(dataDir, 'quotations.json'), path.join(storageDataDir, 'quotations.json')]
};

const qid = () => `SP-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const dateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};
const isoDate = (value) => {
  const parsed = dateOnly(value);
  return parsed ? parsed.toISOString().slice(0, 10) : '';
};
const monthName = (month) => new Date(2026, Math.max(0, Number(month) - 1), 1).toLocaleString('en-IN', { month: 'long' });
const weekOfYear = (value) => {
  const dt = dateOnly(value);
  if (!dt) return 0;
  const temp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
};
const yearOf = (value) => {
  const dt = dateOnly(value);
  return dt ? dt.getFullYear() : null;
};
const monthOf = (value) => {
  const dt = dateOnly(value);
  return dt ? dt.getMonth() + 1 : null;
};
const sameDayOrAfter = (value, minDate) => {
  const dt = dateOnly(value);
  const min = dateOnly(minDate);
  if (!dt || !min) return false;
  return dt.getTime() >= min.getTime();
};
const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const periodLabel = (row) => {
  if (row.periodType === 'weekly') return `Week ${row.weekNumber || '-'}`;
  if (row.periodType === 'monthly') return `${monthName(row.month || 1)} ${row.year || ''}`.trim();
  return `${row.year || ''}`.trim();
};
const rate = (achieved, target) => {
  const t = num(target, 0);
  if (t <= 0) return 0;
  return Math.round((num(achieved, 0) / t) * 1000) / 10;
};
const safeJson = (raw, fallback) => {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return fallback;
    }
  }
  return fallback;
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
const getExistingColumns = async (tableName) => {
  try {
    const rows = await dbQuery(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    return new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.COLUMN_NAME || row.column_name || '').toLowerCase()).filter(Boolean));
  } catch (_error) {
    return new Set();
  }
};
const ensureMissingColumns = async (tableName, columns = []) => {
  const existing = await getExistingColumns(tableName);
  for (const column of columns) {
    const columnName = String(column.name || '').trim().toLowerCase();
    if (!columnName || existing.has(columnName)) continue;
    try {
      await dbQuery(`ALTER TABLE ${tableName} ADD COLUMN ${column.ddl}`);
    } catch (_error) {
      // Best-effort only.
    }
  }
};
const mysqlQueryRows = async (sql) => {
  try {
    const rows = await dbQuery(sql);
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
};
const loadTableRows = async (_table, sql, jsonKey) => {
  const mysqlRows = await mysqlQueryRows(sql);
  if (mysqlRows.length) return mysqlRows;
  return readJsonCandidates(jsonFilePaths[jsonKey] || []);
};
const normalizeEmployee = (row = {}) => {
  const payload = safeJson(row.payload, {});
  const employeeId = text(row.external_id || row._id || payload._id || row.id);
  const name = text(
    row.full_name
      || payload.fullName
      || [row.first_name, row.last_name].filter(Boolean).join(' ')
      || payload.name
      || payload.displayName
      || row.name
  );
  const role = text(row.role || payload.role || '');
  const roleName = text(row.role_name || payload.roleName || '');
  const department = text(row.department || payload.department || payload.team || payload.group || '');
  const status = text(row.status || payload.status || 'Active');
  const active = !status || ['active', '1', 'true', 'yes', 'enabled'].includes(status.toLowerCase());
  const salesKeywords = ['sales', 'marketing', 'business development', 'bd', 'revenue', 'lead'];
  const haystack = `${role} ${roleName} ${department}`.toLowerCase();
  return {
    id: employeeId || row.id || qid(),
    dbId: row.id || null,
    employeeCode: text(row.emp_code || payload.empCode || payload.employeeCode || ''),
    name: name || text(row.employee_name || payload.employeeName || row.name || 'Employee'),
    role,
    roleName,
    department,
    status,
    active,
    isSales: salesKeywords.some((word) => haystack.includes(word))
  };
};
const employeeMatchesValue = (employee, value) => {
  const ref = text(value);
  if (!ref) return false;
  const options = [
    employee.id,
    employee.dbId,
    employee.employeeCode,
    employee.name,
    employee.role,
    employee.roleName
  ].map(text).filter(Boolean);
  return options.some((candidate) => candidate.toLowerCase() === ref.toLowerCase());
};
const buildEmployeeLookup = (employees = []) => {
  const byId = new Map();
  const byName = new Map();
  const byCode = new Map();
  employees.forEach((employee) => {
    if (employee.id) byId.set(text(employee.id).toLowerCase(), employee);
    if (employee.dbId !== null && employee.dbId !== undefined) byId.set(text(employee.dbId).toLowerCase(), employee);
    if (employee.employeeCode) byCode.set(text(employee.employeeCode).toLowerCase(), employee);
    if (employee.name) byName.set(text(employee.name).toLowerCase(), employee);
  });
  return { byId, byName, byCode };
};
const pickEmployee = (lookup, value) => {
  const ref = text(value);
  if (!ref) return null;
  const key = ref.toLowerCase();
  return lookup.byId.get(key) || lookup.byCode.get(key) || lookup.byName.get(key) || null;
};
const normalizeLead = (row = {}, lookup = null) => {
  const payload = safeJson(row.payload, {});
  const source = { ...payload, ...row };
  const assignedRaw = text(
    source.assigned_to
      || source.assignedTo
      || source.sales_person
      || source.salesPerson
      || source.sales_person_name
      || source.salesPersonName
      || source.created_by
      || source.createdBy
      || ''
  );
  const assignedEmployee = lookup ? pickEmployee(lookup, assignedRaw) : null;
  const date = isoDate(source.lead_date || source.leadDate || source.created_at || source.createdAt || source.date || source.updatedAt);
  const status = text(source.lead_status || source.status || source.leadStatus || '');
  const converted = /converted|booked|won|closed/i.test(status);
  return {
    id: text(source.external_id || source._id || source.id || qid()),
    employeeId: assignedEmployee?.id || text(source.sales_person_id || source.assigned_to_id || source.employee_id || ''),
    employeeName: assignedEmployee?.name || assignedRaw || '',
    date,
    source: text(source.lead_source || source.source || source.leadSource || ''),
    serviceType: text(source.service_type || source.serviceType || source.pest_issue || source.pestIssue || ''),
    status,
    converted,
    value: num(source.quotation_value || source.value || source.amount || 0),
    payload: source
  };
};
const normalizeQuotation = (row = {}, lookup = null) => {
  const payload = safeJson(row.payload, {});
  const source = { ...payload, ...row };
  const assignedRaw = text(source.sales_person || source.salesPerson || source.prepared_by || source.preparedBy || source.created_by || source.createdBy || '');
  const assignedEmployee = lookup ? pickEmployee(lookup, assignedRaw) : null;
  return {
    id: text(source.external_id || source._id || source.id || qid()),
    employeeId: assignedEmployee?.id || text(source.sales_person_id || source.assigned_to_id || source.employee_id || ''),
    employeeName: assignedEmployee?.name || assignedRaw || '',
    date: isoDate(source.quotation_date || source.date || source.created_at || source.createdAt),
    source: text(source.source_type || source.quotation_source || source.lead_source || ''),
    serviceType: text(source.service_type || source.serviceType || source.service_name || source.serviceName || ''),
    value: num(source.grand_total || source.total_amount || source.amount || 0),
    payload: source
  };
};
const normalizeInvoice = (row = {}, lookup = null) => {
  const payload = safeJson(row.payload, row);
  const source = { ...payload, ...row };
  const assignedRaw = text(
    source.sales_person
      || source.salesPerson
      || source.prepared_by
      || source.preparedBy
      || source.created_by
      || source.createdBy
      || source.assigned_to
      || source.assignedTo
      || ''
  );
  const assignedEmployee = lookup ? pickEmployee(lookup, assignedRaw) : null;
  return {
    id: text(source.external_id || source._id || source.id || qid()),
    employeeId: assignedEmployee?.id || text(source.sales_person_id || source.assigned_to_id || source.employee_id || ''),
    employeeName: assignedEmployee?.name || assignedRaw || '',
    date: isoDate(source.invoice_date || source.date || source.created_at || source.createdAt),
    source: text(source.invoice_type || source.source_type || source.source || ''),
    serviceType: text(source.service_type || source.serviceType || source.invoiceServiceType || ''),
    customerId: text(source.customer_external_id || source.customerId || ''),
    invoiceNumber: text(source.invoice_number || source.invoiceNumber || ''),
    amount: num(source.total_amount || source.total || source.amount || 0),
    balanceDue: num(source.balance_due || source.balanceDue || 0),
    status: text(source.invoice_status || source.status || ''),
    payload: source
  };
};
const normalizePayment = (row = {}, invoiceLookup = null, employeeLookup = null) => {
  const payload = safeJson(row.payload, row);
  const source = { ...payload, ...row };
  const invoiceRef = text(source.linked_invoice_external_id || source.invoiceId || source.invoice_id || source.invoice_external_id || '');
  const invoice = invoiceLookup ? invoiceLookup.get(invoiceRef.toLowerCase()) || invoiceLookup.get(text(source.invoiceNumber || source.invoice_number || '').toLowerCase()) || null : null;
  const assignedRaw = text(source.sales_person || source.salesPerson || source.created_by || source.createdBy || invoice?.employeeName || '');
  const assignedEmployee = employeeLookup ? pickEmployee(employeeLookup, assignedRaw) : null;
  return {
    id: text(source.external_id || source._id || source.id || qid()),
    employeeId: assignedEmployee?.id || invoice?.employeeId || text(source.employee_id || ''),
    employeeName: assignedEmployee?.name || invoice?.employeeName || assignedRaw || '',
    date: isoDate(source.payment_date || source.date || source.created_at || source.createdAt),
    amount: num(source.amount || 0),
    source,
    invoiceId: invoiceRef,
    invoiceNumber: text(source.invoiceNumber || source.invoice_number || invoice?.invoiceNumber || ''),
    mode: text(source.payment_mode || source.mode || ''),
    reference: text(source.reference_number || source.reference || ''),
    notes: text(source.notes || '')
  };
};
const normalizeRenewal = (row = {}, lookup = null) => {
  const payload = safeJson(row.payload, row);
  const source = { ...payload, ...row };
  const assignedRaw = text(
    source.renewed_by_sales_person_name
      || source.assigned_sales_person_name
      || source.renewedBySalesPersonName
      || source.assignedSalesPersonName
      || source.created_by
      || source.createdBy
      || ''
  );
  const assignedEmployee = lookup ? pickEmployee(lookup, assignedRaw) : null;
  const status = text(source.status || source.payment_status || '');
  const converted = /done|renewed|converted|closed/i.test(status);
  return {
    id: text(source.external_id || source.renewal_id || source.id || qid()),
    employeeId: assignedEmployee?.id || text(source.assigned_sales_person_id || source.renewed_by_sales_person_id || source.employee_id || ''),
    employeeName: assignedEmployee?.name || assignedRaw || '',
    date: isoDate(source.renewed_at || source.updated_at || source.created_at || source.followup_date),
    source: text(source.service_type || source.type || ''),
    serviceType: text(source.service_type || ''),
    value: num(source.final_renewal_amount || source.total_amount || source.proposed_amount || 0),
    status,
    converted,
    payload: source
  };
};
const ensureTables = async () => {
  await dbQuery(`CREATE TABLE IF NOT EXISTS sales_targets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_id VARCHAR(120) NOT NULL,
    employee_id VARCHAR(120) NULL,
    employee_name VARCHAR(255) NULL,
    employee_code VARCHAR(120) NULL,
    period_type VARCHAR(20) NOT NULL,
    week_number INT NULL,
    month INT NULL,
    year INT NULL,
    revenue_target DECIMAL(18,2) NOT NULL DEFAULT 0,
    lead_target INT NOT NULL DEFAULT 0,
    quotation_target INT NOT NULL DEFAULT 0,
    conversion_target INT NOT NULL DEFAULT 0,
    collection_target DECIMAL(18,2) NOT NULL DEFAULT 0,
    renewal_target INT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sales_targets_external_id (external_id),
    KEY idx_sales_targets_employee_period (employee_id, period_type),
    KEY idx_sales_targets_year_month_week (year, month, week_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS sales_performance_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_id VARCHAR(120) NOT NULL,
    snapshot_key VARCHAR(180) NOT NULL,
    employee_id VARCHAR(120) NULL,
    employee_name VARCHAR(255) NULL,
    period_type VARCHAR(20) NOT NULL,
    week_number INT NULL,
    month INT NULL,
    year INT NULL,
    target_json JSON NULL,
    achievement_json JSON NULL,
    payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sales_performance_snapshots_external_id (external_id),
    UNIQUE KEY uk_sales_performance_snapshots_key (snapshot_key),
    KEY idx_sales_performance_snapshots_employee_period (employee_id, period_type),
    KEY idx_sales_performance_snapshots_year_month_week (year, month, week_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS sales_incentive_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_id VARCHAR(120) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    min_achievement_percent DECIMAL(8,2) NOT NULL DEFAULT 100,
    max_achievement_percent DECIMAL(8,2) NULL,
    fixed_bonus DECIMAL(18,2) NOT NULL DEFAULT 0,
    commission_percent DECIMAL(8,2) NOT NULL DEFAULT 0,
    extra_bonus DECIMAL(18,2) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sales_incentive_rules_external_id (external_id),
    KEY idx_sales_incentive_rules_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS sales_incentive_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_id VARCHAR(120) NOT NULL,
    employee_id VARCHAR(120) NULL,
    employee_name VARCHAR(255) NULL,
    period_type VARCHAR(20) NULL,
    month INT NULL,
    year INT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    note TEXT NULL,
    created_by VARCHAR(255) NULL,
    payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sales_incentive_adjustments_external_id (external_id),
    KEY idx_sales_incentive_adjustments_employee_period (employee_id, period_type),
    KEY idx_sales_incentive_adjustments_year_month (year, month)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureMissingColumns('sales_targets', [
    { name: 'employee_id', ddl: 'employee_id VARCHAR(120) NULL' },
    { name: 'employee_name', ddl: 'employee_name VARCHAR(255) NULL' },
    { name: 'employee_code', ddl: 'employee_code VARCHAR(120) NULL' },
    { name: 'period_type', ddl: "period_type VARCHAR(20) NOT NULL DEFAULT 'monthly'" },
    { name: 'week_number', ddl: 'week_number INT NULL' },
    { name: 'month', ddl: 'month INT NULL' },
    { name: 'year', ddl: 'year INT NULL' },
    { name: 'revenue_target', ddl: 'revenue_target DECIMAL(18,2) NOT NULL DEFAULT 0' },
    { name: 'lead_target', ddl: 'lead_target INT NOT NULL DEFAULT 0' },
    { name: 'quotation_target', ddl: 'quotation_target INT NOT NULL DEFAULT 0' },
    { name: 'conversion_target', ddl: 'conversion_target INT NOT NULL DEFAULT 0' },
    { name: 'collection_target', ddl: 'collection_target DECIMAL(18,2) NOT NULL DEFAULT 0' },
    { name: 'renewal_target', ddl: 'renewal_target INT NOT NULL DEFAULT 0' },
    { name: 'notes', ddl: 'notes TEXT NULL' },
    { name: 'payload', ddl: 'payload JSON NULL' },
    { name: 'created_at', ddl: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', ddl: 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
  ]);
  await ensureMissingColumns('sales_performance_snapshots', [
    { name: 'snapshot_key', ddl: 'snapshot_key VARCHAR(180) NOT NULL' },
    { name: 'employee_id', ddl: 'employee_id VARCHAR(120) NULL' },
    { name: 'employee_name', ddl: 'employee_name VARCHAR(255) NULL' },
    { name: 'period_type', ddl: "period_type VARCHAR(20) NOT NULL DEFAULT 'monthly'" },
    { name: 'week_number', ddl: 'week_number INT NULL' },
    { name: 'month', ddl: 'month INT NULL' },
    { name: 'year', ddl: 'year INT NULL' },
    { name: 'target_json', ddl: 'target_json JSON NULL' },
    { name: 'achievement_json', ddl: 'achievement_json JSON NULL' },
    { name: 'payload', ddl: 'payload JSON NULL' },
    { name: 'created_at', ddl: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', ddl: 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
  ]);
  await ensureMissingColumns('sales_incentive_rules', [
    { name: 'rule_name', ddl: 'rule_name VARCHAR(255) NOT NULL' },
    { name: 'min_achievement_percent', ddl: 'min_achievement_percent DECIMAL(8,2) NOT NULL DEFAULT 100' },
    { name: 'max_achievement_percent', ddl: 'max_achievement_percent DECIMAL(8,2) NULL' },
    { name: 'fixed_bonus', ddl: 'fixed_bonus DECIMAL(18,2) NOT NULL DEFAULT 0' },
    { name: 'commission_percent', ddl: 'commission_percent DECIMAL(8,2) NOT NULL DEFAULT 0' },
    { name: 'extra_bonus', ddl: 'extra_bonus DECIMAL(18,2) NOT NULL DEFAULT 0' },
    { name: 'active', ddl: 'active TINYINT(1) NOT NULL DEFAULT 1' },
    { name: 'payload', ddl: 'payload JSON NULL' },
    { name: 'created_at', ddl: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', ddl: 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
  ]);
  await ensureMissingColumns('sales_incentive_adjustments', [
    { name: 'employee_id', ddl: 'employee_id VARCHAR(120) NULL' },
    { name: 'employee_name', ddl: 'employee_name VARCHAR(255) NULL' },
    { name: 'period_type', ddl: 'period_type VARCHAR(20) NULL' },
    { name: 'month', ddl: 'month INT NULL' },
    { name: 'year', ddl: 'year INT NULL' },
    { name: 'amount', ddl: 'amount DECIMAL(18,2) NOT NULL DEFAULT 0' },
    { name: 'note', ddl: 'note TEXT NULL' },
    { name: 'created_by', ddl: 'created_by VARCHAR(255) NULL' },
    { name: 'payload', ddl: 'payload JSON NULL' },
    { name: 'created_at', ddl: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', ddl: 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
  ]);

  const [ruleCountRows] = await Promise.all([dbQuery('SELECT COUNT(*) AS c FROM sales_incentive_rules')]);
  const ruleCount = Number(ruleCountRows?.[0]?.c || 0);
  if (!ruleCount) {
    await dbQuery(`INSERT INTO sales_incentive_rules (
      external_id, rule_name, min_achievement_percent, max_achievement_percent, fixed_bonus, commission_percent, extra_bonus, active, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`, [
      qid(),
      'Default Sales Incentive',
      100,
      120,
      2500,
      1.5,
      2000,
      JSON.stringify({ note: 'Baseline incentive for sales team' })
    ]);
  }
};

const ensureReady = (() => {
  let promise = null;
  return async () => {
    if (!promise) promise = ensureTables();
    return promise;
  };
})();

const loadSalesData = async () => {
  const [employeesRaw, leadsRaw, quotationsRaw, invoicesRaw, paymentsRaw, renewalsRaw, targetsRaw, rulesRaw, adjustmentsRaw] = await Promise.all([
    loadTableRows('employees', 'SELECT * FROM employees ORDER BY id ASC', 'employees'),
    loadTableRows('leads', 'SELECT * FROM leads ORDER BY id DESC', 'leads'),
    loadTableRows('quotations', 'SELECT * FROM quotations ORDER BY id DESC', 'quotations'),
    loadTableRows('invoices', 'SELECT * FROM invoices ORDER BY id DESC', 'invoices'),
    loadTableRows('payment_received', 'SELECT * FROM payment_received ORDER BY id DESC', 'payments'),
    loadTableRows('renewals', 'SELECT * FROM renewals ORDER BY id DESC', 'renewals'),
    loadTableRows('sales_targets', 'SELECT * FROM sales_targets ORDER BY id DESC', 'targets'),
    loadTableRows('sales_incentive_rules', 'SELECT * FROM sales_incentive_rules ORDER BY id DESC', 'rules'),
    loadTableRows('sales_incentive_adjustments', 'SELECT * FROM sales_incentive_adjustments ORDER BY id DESC', 'adjustments')
  ]);

  const employees = employeesRaw.map(normalizeEmployee);
  const activeEmployees = employees.filter((employee) => employee.active);
  const salesEmployees = employees.filter((employee) => employee.active && employee.isSales);
  const people = salesEmployees.length > 0 ? salesEmployees : activeEmployees;
  const lookup = buildEmployeeLookup(people.length > 0 ? people : activeEmployees);
  const leads = leadsRaw.map((row) => normalizeLead(row, lookup));
  const quotations = quotationsRaw.map((row) => normalizeQuotation(row, lookup));
  const invoices = invoicesRaw.map((row) => normalizeInvoice(row, lookup));
  const invoiceLookup = new Map();
  invoices.forEach((invoice) => {
    if (invoice.id) invoiceLookup.set(invoice.id.toLowerCase(), invoice);
    if (invoice.invoiceNumber) invoiceLookup.set(invoice.invoiceNumber.toLowerCase(), invoice);
  });
  const payments = paymentsRaw.map((row) => normalizePayment(row, invoiceLookup, lookup));
  const renewals = renewalsRaw.map((row) => normalizeRenewal(row, lookup));
  const targets = targetsRaw.map((row) => ({
    id: text(row.external_id || row._id || row.id || qid()),
    employeeId: text(row.employee_id || row.employeeId || ''),
    employeeName: text(row.employee_name || row.employeeName || ''),
    employeeCode: text(row.employee_code || row.employeeCode || ''),
    periodType: text(row.period_type || row.periodType || 'monthly').toLowerCase(),
    weekNumber: row.week_number || row.weekNumber || null,
    month: row.month || null,
    year: row.year || null,
    revenueTarget: num(row.revenue_target || row.revenueTarget || 0),
    leadTarget: num(row.lead_target || row.leadTarget || 0),
    quotationTarget: num(row.quotation_target || row.quotationTarget || 0),
    conversionTarget: num(row.conversion_target || row.conversionTarget || 0),
    collectionTarget: num(row.collection_target || row.collectionTarget || 0),
    renewalTarget: num(row.renewal_target || row.renewalTarget || 0),
    notes: text(row.notes || ''),
    payload: safeJson(row.payload, row)
  }));
  const rules = rulesRaw.map((row) => ({
    id: text(row.external_id || row._id || row.id || qid()),
    ruleName: text(row.rule_name || row.ruleName || 'Default Sales Incentive'),
    minAchievementPercent: num(row.min_achievement_percent || row.minAchievementPercent || 100),
    maxAchievementPercent: row.max_achievement_percent ?? row.maxAchievementPercent ?? null,
    fixedBonus: num(row.fixed_bonus || row.fixedBonus || 0),
    commissionPercent: num(row.commission_percent || row.commissionPercent || 0),
    extraBonus: num(row.extra_bonus || row.extraBonus || 0),
    active: Boolean(num(row.active, 1)),
    payload: safeJson(row.payload, row)
  }));
  const adjustments = adjustmentsRaw.map((row) => ({
    id: text(row.external_id || row._id || row.id || qid()),
    employeeId: text(row.employee_id || row.employeeId || ''),
    employeeName: text(row.employee_name || row.employeeName || ''),
    periodType: text(row.period_type || row.periodType || ''),
    month: row.month || null,
    year: row.year || null,
    amount: num(row.amount || 0),
    note: text(row.note || ''),
    createdBy: text(row.created_by || row.createdBy || ''),
    payload: safeJson(row.payload, row)
  }));
  return { employees: people, lookup, leads, quotations, invoices, payments, renewals, targets, rules, adjustments };
};

const getPeriodRange = (periodType, year, month, weekNumber) => {
  const y = Number(year);
  if (periodType === 'weekly') {
    const targetWeek = Number(weekNumber);
    return (date) => yearOf(date) === y && weekOfYear(date) === targetWeek;
  }
  if (periodType === 'monthly') {
    const targetMonth = Number(month);
    return (date) => yearOf(date) === y && monthOf(date) === targetMonth;
  }
  return (date) => yearOf(date) === y;
};

const filterByPeriod = (rows = [], predicate) => rows.filter((row) => row.date && predicate(row.date));

const summarizeEmployee = (employee, source, targetRow, predicate, filters = {}) => {
  const leadRows = filterByPeriod(source.leads.filter((lead) => employeeMatchesValue(employee, lead.employeeId) || employeeMatchesValue(employee, lead.employeeName)), predicate)
    .filter((lead) => (!filters.serviceType || lower(lead.serviceType).includes(lower(filters.serviceType)))
      && (!filters.leadSource || lower(lead.source).includes(lower(filters.leadSource))));
  const quotationRows = filterByPeriod(source.quotations.filter((row) => employeeMatchesValue(employee, row.employeeId) || employeeMatchesValue(employee, row.employeeName)), predicate)
    .filter((row) => (!filters.serviceType || lower(row.serviceType).includes(lower(filters.serviceType)))
      && (!filters.leadSource || lower(row.source).includes(lower(filters.leadSource))));
  const invoiceRows = filterByPeriod(source.invoices.filter((row) => employeeMatchesValue(employee, row.employeeId) || employeeMatchesValue(employee, row.employeeName)), predicate)
    .filter((row) => (!filters.serviceType || lower(row.serviceType).includes(lower(filters.serviceType)))
      && (!filters.leadSource || lower(row.source).includes(lower(filters.leadSource))));
  const paymentRows = filterByPeriod(source.payments.filter((row) => employeeMatchesValue(employee, row.employeeId) || employeeMatchesValue(employee, row.employeeName)), predicate);
  const renewalRows = filterByPeriod(source.renewals.filter((row) => employeeMatchesValue(employee, row.employeeId) || employeeMatchesValue(employee, row.employeeName)), predicate)
    .filter((row) => (!filters.serviceType || lower(row.serviceType).includes(lower(filters.serviceType))));

  const achievedRevenue = invoiceRows.reduce((sum, row) => sum + num(row.amount, 0), 0) + renewalRows.reduce((sum, row) => sum + num(row.value, 0), 0);
  const collectionAmount = paymentRows.reduce((sum, row) => sum + num(row.amount, 0), 0);
  const leadsAssigned = leadRows.length;
  const leadsConverted = leadRows.filter((row) => row.converted).length;
  const quotationsSent = quotationRows.length;
  const invoicesGenerated = invoiceRows.length;
  const renewalsConverted = renewalRows.filter((row) => row.converted).length;
  const revenueTarget = num(targetRow?.revenueTarget, 0);
  const leadTarget = num(targetRow?.leadTarget, 0);
  const quotationTarget = num(targetRow?.quotationTarget, 0);
  const conversionTarget = num(targetRow?.conversionTarget, 0);
  const collectionTarget = num(targetRow?.collectionTarget, 0);
  const renewalTarget = num(targetRow?.renewalTarget, 0);
  const pendingRevenue = Math.max(revenueTarget - achievedRevenue, 0);
  const achievementPercent = rate(achievedRevenue, revenueTarget);
  const conversionPercent = rate(leadsConverted, leadsAssigned);
  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: employee.name,
    target: {
      revenueTarget,
      leadTarget,
      quotationTarget,
      conversionTarget,
      collectionTarget,
      renewalTarget
    },
    achievement: {
      achievedRevenue,
      collectionAmount,
      leadsAssigned,
      leadsConverted,
      quotationsSent,
      invoicesGenerated,
      renewalsConverted,
      pendingRevenue,
      achievementPercent,
      conversionPercent,
      pendingTarget: pendingRevenue
    },
    targetRow
  };
};

const buildMonthlyComparison = (source, year) => {
  return Array.from({ length: 12 }).map((_, index) => {
    const month = index + 1;
    const monthRows = source.invoices.filter((row) => yearOf(row.date) === year && monthOf(row.date) === month);
    const renewalRows = source.renewals.filter((row) => yearOf(row.date) === year && monthOf(row.date) === month);
    const paymentRows = source.payments.filter((row) => yearOf(row.date) === year && monthOf(row.date) === month);
    const monthlyTarget = source.targets
      .filter((target) => text(target.periodType) === 'monthly' && Number(target.year) === Number(year) && Number(target.month) === month)
      .reduce((sum, target) => sum + num(target.revenueTarget, 0), 0);
    const monthlyAchievement = monthRows.reduce((sum, row) => sum + num(row.amount, 0), 0) + renewalRows.reduce((sum, row) => sum + num(row.value, 0), 0);
    const collectionAmount = paymentRows.reduce((sum, row) => sum + num(row.amount, 0), 0);
    return {
      month,
      monthLabel: monthName(month),
      target: monthlyTarget,
      achievement: monthlyAchievement,
      pending: Math.max(monthlyTarget - monthlyAchievement, 0),
      achievementPercent: rate(monthlyAchievement, monthlyTarget),
      collectionAmount
    };
  });
};

const estimateIncentive = (employeeSummary, source) => {
  const rules = source.rules.filter((rule) => rule.active);
  const adjustments = source.adjustments.filter((adj) => employeeMatchesValue(employeeSummary, adj.employeeId) || employeeMatchesValue(employeeSummary, adj.employeeName))
    .reduce((sum, row) => sum + num(row.amount, 0), 0);
  const achievementPercent = num(employeeSummary?.achievement?.achievementPercent, 0);
  const achievedRevenue = num(employeeSummary?.achievement?.achievedRevenue, 0);
  const baseRule = rules[0] || { minAchievementPercent: 100, maxAchievementPercent: 120, fixedBonus: 0, commissionPercent: 0, extraBonus: 0 };
  let incentive = 0;
  if (achievementPercent >= num(baseRule.minAchievementPercent, 100)) incentive += num(baseRule.fixedBonus, 0);
  incentive += (achievedRevenue * num(baseRule.commissionPercent, 0)) / 100;
  if (achievementPercent >= num(baseRule.maxAchievementPercent, 120)) incentive += num(baseRule.extraBonus, 0);
  incentive += adjustments;
  return Number(incentive.toFixed(2));
};

const toMonthlyTargetRows = (source, year) => {
  const rows = [];
  source.employees.forEach((employee) => {
    for (let month = 1; month <= 12; month += 1) {
      const targetRow = source.targets.find((target) => employeeMatchesValue(employee, target.employeeId) && text(target.periodType) === 'monthly' && Number(target.year) === Number(year) && Number(target.month) === Number(month))
        || source.targets.find((target) => employeeMatchesValue(employee, target.employeeName) && text(target.periodType) === 'monthly' && Number(target.year) === Number(year) && Number(target.month) === Number(month))
        || null;
      const summary = summarizeEmployee(employee, source, targetRow, getPeriodRange('monthly', year, month), {});
      rows.push({
        ...summary,
        month,
        year,
        periodType: 'monthly',
        periodLabel: `${monthName(month)} ${year}`
      });
    }
  });
  return rows;
};

const saveSnapshot = async (summary) => {
  try {
    await dbQuery(`INSERT INTO sales_performance_snapshots (
      external_id, snapshot_key, employee_id, employee_name, period_type, week_number, month, year, target_json, achievement_json, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      employee_id=VALUES(employee_id),
      employee_name=VALUES(employee_name),
      period_type=VALUES(period_type),
      week_number=VALUES(week_number),
      month=VALUES(month),
      year=VALUES(year),
      target_json=VALUES(target_json),
      achievement_json=VALUES(achievement_json),
      payload=VALUES(payload)`, [
      qid(),
      summary.snapshotKey,
      summary.employeeId,
      summary.employeeName,
      summary.periodType,
      summary.weekNumber || null,
      summary.month || null,
      summary.year || null,
      JSON.stringify(summary.target || {}),
      JSON.stringify(summary.achievement || {}),
      JSON.stringify(summary)
    ]);
  } catch (_error) {
    // Snapshots are best-effort.
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureReady();
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get('/sales-performance/dashboard', async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || new Date().getMonth() + 1);
    const source = await loadSalesData();
    const monthlyRows = source.employees.map((employee) => {
      const targetRow = source.targets.find((target) => employeeMatchesValue(employee, target.employeeId) && text(target.periodType) === 'monthly' && Number(target.year) === year && Number(target.month) === month)
        || source.targets.find((target) => employeeMatchesValue(employee, target.employeeName) && text(target.periodType) === 'monthly' && Number(target.year) === year && Number(target.month) === month)
        || null;
      return summarizeEmployee(employee, source, targetRow, getPeriodRange('monthly', year, month), {});
    });
    const yearRows = source.employees.map((employee) => {
      const targetRow = source.targets.find((target) => employeeMatchesValue(employee, target.employeeId) && text(target.periodType) === 'yearly' && Number(target.year) === year)
        || source.targets.find((target) => employeeMatchesValue(employee, target.employeeName) && text(target.periodType) === 'yearly' && Number(target.year) === year)
        || null;
      return summarizeEmployee(employee, source, targetRow, getPeriodRange('yearly', year), {});
    });
    const teamTarget = monthlyRows.reduce((sum, row) => sum + num(row.target.revenueTarget, 0), 0);
    const teamAchievement = monthlyRows.reduce((sum, row) => sum + num(row.achievement.achievedRevenue, 0), 0);
    const pendingTarget = Math.max(teamTarget - teamAchievement, 0);
    const leadsAssigned = monthlyRows.reduce((sum, row) => sum + num(row.achievement.leadsAssigned, 0), 0);
    const leadsConverted = monthlyRows.reduce((sum, row) => sum + num(row.achievement.leadsConverted, 0), 0);
    const collectionAmount = monthlyRows.reduce((sum, row) => sum + num(row.achievement.collectionAmount, 0), 0);
    const bestPerformer = [...yearRows].sort((a, b) => num(b.achievement.achievementPercent, 0) - num(a.achievement.achievementPercent, 0))[0] || null;
    const lowPerformer = [...yearRows].filter((row) => num(row.target.revenueTarget, 0) > 0 || num(row.achievement.leadsAssigned, 0) > 0)
      .sort((a, b) => num(a.achievement.achievementPercent, 0) - num(b.achievement.achievementPercent, 0))[0] || null;
    const response = {
      year,
      month,
      summary: {
        totalTeamTarget: teamTarget,
        totalTeamAchievement: teamAchievement,
        pendingTarget,
        achievementPercent: rate(teamAchievement, teamTarget),
        leadsAssigned,
        leadsConverted,
        conversionPercent: rate(leadsConverted, leadsAssigned),
        collectionAmount,
        bestPerformer: bestPerformer ? { employeeId: bestPerformer.employeeId, employeeName: bestPerformer.employeeName, achievementPercent: bestPerformer.achievement.achievementPercent } : null,
        lowPerformer: lowPerformer ? { employeeId: lowPerformer.employeeId, employeeName: lowPerformer.employeeName, achievementPercent: lowPerformer.achievement.achievementPercent } : null
      },
      monthlyRows,
      yearlyRows: yearRows,
      employeeCount: source.employees.length
    };
    await saveSnapshot({
      snapshotKey: `dashboard-${year}-${month}`,
      periodType: 'monthly',
      month,
      year,
      target: { totalTeamTarget: teamTarget },
      achievement: { totalTeamAchievement: teamAchievement },
      ...response
    });
    return res.json(response);
  } catch (error) {
    console.error('Sales performance dashboard failed:', error.message);
    return res.status(500).json({ error: 'Unable to load sales performance dashboard.' });
  }
});

router.get('/sales-performance/targets', async (req, res) => {
  try {
    const source = await loadSalesData();
    const employeeId = text(req.query.employeeId || '');
    const periodType = text(req.query.periodType || '').toLowerCase();
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    const rows = source.targets.filter((row) => {
      if (employeeId && !employeeMatchesValue({ id: employeeId, dbId: employeeId, employeeCode: employeeId, name: employeeId, role: '', roleName: '' }, row.employeeId) && !employeeMatchesValue({ id: employeeId, dbId: employeeId, employeeCode: employeeId, name: employeeId, role: '', roleName: '' }, row.employeeName)) return false;
      if (periodType && row.periodType !== periodType) return false;
      if (month && Number(row.month || 0) !== month) return false;
      if (year && Number(row.year || 0) !== year) return false;
      return true;
    }).map((row) => ({
      ...row,
      label: periodLabel(row)
    }));
    return res.json({ rows, employees: source.employees });
  } catch (error) {
    console.error('Sales targets failed:', error.message);
    return res.status(500).json({ error: 'Unable to load targets.' });
  }
});

router.post('/sales-performance/targets', async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {
      external_id: text(body.external_id || body.id || qid()),
      employee_id: text(body.employeeId || body.employee_id || ''),
      employee_name: text(body.employeeName || body.employee_name || ''),
      employee_code: text(body.employeeCode || body.employee_code || ''),
      period_type: text(body.periodType || body.period_type || 'monthly').toLowerCase(),
      week_number: body.weekNumber || body.week_number || null,
      month: body.month || null,
      year: body.year || null,
      revenue_target: num(body.revenueTarget || body.revenue_target || 0),
      lead_target: num(body.leadTarget || body.lead_target || 0),
      quotation_target: num(body.quotationTarget || body.quotation_target || 0),
      conversion_target: num(body.conversionTarget || body.conversion_target || 0),
      collection_target: num(body.collectionTarget || body.collection_target || 0),
      renewal_target: num(body.renewalTarget || body.renewal_target || 0),
      notes: text(body.notes || ''),
      payload: JSON.stringify(body || {})
    };
    await dbQuery(`INSERT INTO sales_targets (
      external_id, employee_id, employee_name, employee_code, period_type, week_number, month, year, revenue_target,
      lead_target, quotation_target, conversion_target, collection_target, renewal_target, notes, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      employee_id=VALUES(employee_id),
      employee_name=VALUES(employee_name),
      employee_code=VALUES(employee_code),
      period_type=VALUES(period_type),
      week_number=VALUES(week_number),
      month=VALUES(month),
      year=VALUES(year),
      revenue_target=VALUES(revenue_target),
      lead_target=VALUES(lead_target),
      quotation_target=VALUES(quotation_target),
      conversion_target=VALUES(conversion_target),
      collection_target=VALUES(collection_target),
      renewal_target=VALUES(renewal_target),
      notes=VALUES(notes),
      payload=VALUES(payload)`, [
      payload.external_id,
      payload.employee_id,
      payload.employee_name,
      payload.employee_code,
      payload.period_type,
      payload.week_number,
      payload.month,
      payload.year,
      payload.revenue_target,
      payload.lead_target,
      payload.quotation_target,
      payload.conversion_target,
      payload.collection_target,
      payload.renewal_target,
      payload.notes,
      payload.payload
    ]);
    return res.json({ success: true, message: 'Target saved', target: payload });
  } catch (error) {
    console.error('Save target failed:', error.message);
    return res.status(500).json({ error: 'Unable to save target.' });
  }
});

router.put('/sales-performance/targets/:id', async (req, res) => {
  try {
    const id = text(req.params.id);
    const body = req.body || {};
    await dbQuery(`UPDATE sales_targets SET
      employee_id=?, employee_name=?, employee_code=?, period_type=?, week_number=?, month=?, year=?,
      revenue_target=?, lead_target=?, quotation_target=?, conversion_target=?, collection_target=?, renewal_target=?,
      notes=?, payload=?
      WHERE external_id = ?`, [
      text(body.employeeId || body.employee_id || ''),
      text(body.employeeName || body.employee_name || ''),
      text(body.employeeCode || body.employee_code || ''),
      text(body.periodType || body.period_type || 'monthly').toLowerCase(),
      body.weekNumber || body.week_number || null,
      body.month || null,
      body.year || null,
      num(body.revenueTarget || body.revenue_target || 0),
      num(body.leadTarget || body.lead_target || 0),
      num(body.quotationTarget || body.quotation_target || 0),
      num(body.conversionTarget || body.conversion_target || 0),
      num(body.collectionTarget || body.collection_target || 0),
      num(body.renewalTarget || body.renewal_target || 0),
      text(body.notes || ''),
      JSON.stringify(body || {}),
      id
    ]);
    return res.json({ success: true, message: 'Target updated' });
  } catch (error) {
    console.error('Update target failed:', error.message);
    return res.status(500).json({ error: 'Unable to update target.' });
  }
});

router.delete('/sales-performance/targets/:id', async (req, res) => {
  try {
    await dbQuery('DELETE FROM sales_targets WHERE external_id = ?', [text(req.params.id)]);
    return res.json({ success: true, message: 'Target deleted' });
  } catch (error) {
    console.error('Delete target failed:', error.message);
    return res.status(500).json({ error: 'Unable to delete target.' });
  }
});

router.get('/sales-performance/weekly', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
    const weekNumber = req.query.week ? Number(req.query.week) : null;
    const filters = {
      serviceType: text(req.query.serviceType || ''),
      leadSource: text(req.query.leadSource || '')
    };
    const weeks = [...new Set(source.targets.filter((row) => row.periodType === 'weekly' && Number(row.year) === year).map((row) => Number(row.weekNumber || 0)).filter(Boolean))];
    const weeksToRender = weekNumber ? [weekNumber] : (weeks.length ? weeks : [...new Set(source.leads.map((lead) => weekOfYear(lead.date)).filter(Boolean))].sort((a, b) => a - b));
    const rows = [];
    source.employees.forEach((employee) => {
      weeksToRender.forEach((week) => {
        const targetRow = source.targets.find((target) => target.periodType === 'weekly' && Number(target.year) === year && Number(target.weekNumber) === week && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
        const predicate = (date) => yearOf(date) === year && weekOfYear(date) === week;
        const summary = summarizeEmployee(employee, source, targetRow, predicate, filters);
        rows.push({
          ...summary,
          periodType: 'weekly',
          weekNumber: week,
          weekLabel: `Week ${week}`,
          pending: summary.achievement.pendingRevenue,
          status: summary.achievement.achievementPercent >= 100 ? 'On Track' : summary.achievement.achievementPercent >= 75 ? 'Needs Push' : 'At Risk'
        });
      });
    });
    return res.json({ year, rows: rows.sort((a, b) => (a.weekNumber - b.weekNumber) || a.employeeName.localeCompare(b.employeeName)) });
  } catch (error) {
    console.error('Weekly performance failed:', error.message);
    return res.status(500).json({ error: 'Unable to load weekly performance.' });
  }
});

router.get('/sales-performance/monthly', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
    const month = req.query.month ? Number(req.query.month) : null;
    const filters = {
      serviceType: text(req.query.serviceType || ''),
      leadSource: text(req.query.leadSource || '')
    };
    const months = month ? [month] : [...new Set(source.targets.filter((row) => row.periodType === 'monthly' && Number(row.year) === year).map((row) => Number(row.month || 0)).filter(Boolean))];
    const rows = [];
    source.employees.forEach((employee) => {
      months.forEach((monthValue) => {
        const targetRow = source.targets.find((target) => target.periodType === 'monthly' && Number(target.year) === year && Number(target.month) === monthValue && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
        const summary = summarizeEmployee(employee, source, targetRow, getPeriodRange('monthly', year, monthValue), filters);
        rows.push({
          ...summary,
          periodType: 'monthly',
          month: monthValue,
          monthLabel: monthName(monthValue),
          year,
          pending: summary.achievement.pendingRevenue,
          status: summary.achievement.achievementPercent >= 100 ? 'On Track' : summary.achievement.achievementPercent >= 75 ? 'Needs Push' : 'At Risk'
        });
      });
    });
    return res.json({ year, rows: rows.sort((a, b) => (a.month - b.month) || a.employeeName.localeCompare(b.employeeName)) });
  } catch (error) {
    console.error('Monthly performance failed:', error.message);
    return res.status(500).json({ error: 'Unable to load monthly performance.' });
  }
});

router.get('/sales-performance/yearly', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
    const rows = source.employees.map((employee) => {
      const targetRow = source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
      return {
        ...summarizeEmployee(employee, source, targetRow, getPeriodRange('yearly', year), {}),
        periodType: 'yearly',
        year,
        status: targetRow ? 'Assigned' : 'No Target'
      };
    });
    return res.json({ year, rows });
  } catch (error) {
    console.error('Yearly performance failed:', error.message);
    return res.status(500).json({ error: 'Unable to load yearly performance.' });
  }
});

router.get('/sales-performance/yearly-comparison', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
    const months = buildMonthlyComparison(source, year);
    const yearTarget = months.reduce((sum, row) => sum + num(row.target, 0), 0);
    const yearAchieved = months.reduce((sum, row) => sum + num(row.achievement, 0), 0);
    return res.json({
      year,
      months,
      summary: {
        yearTarget,
        yearAchieved,
        yearPending: Math.max(yearTarget - yearAchieved, 0),
        yearAchievementPercent: rate(yearAchieved, yearTarget)
      }
    });
  } catch (error) {
    console.error('Yearly comparison failed:', error.message);
    return res.status(500).json({ error: 'Unable to load yearly comparison.' });
  }
});

router.get('/sales-performance/team-comparison', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
  const rows = source.employees.map((employee) => {
      const targetRow = source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
      const summary = summarizeEmployee(employee, source, targetRow, getPeriodRange('yearly', year), {});
      return {
        ...summary,
        incentive: estimateIncentive(summary, source),
        achievementPercent: summary.achievement.achievementPercent,
        achievedRevenue: summary.achievement.achievedRevenue,
        targetRevenue: summary.target.revenueTarget
      };
    }).sort((a, b) => num(b.achievementPercent, 0) - num(a.achievementPercent, 0));
    const leaderboard = rows.slice(0, 10);
    const lowPerformers = rows.slice().reverse().slice(0, 10);
    return res.json({ year, rows, leaderboard, lowPerformers });
  } catch (error) {
    console.error('Team comparison failed:', error.message);
    return res.status(500).json({ error: 'Unable to load team comparison.' });
  }
});

router.get('/sales-performance/person/:employeeId', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const employeeId = text(req.params.employeeId);
    const employee = source.employees.find((entry) => employeeMatchesValue(entry, employeeId) || text(entry.id).toLowerCase() === employeeId.toLowerCase() || text(entry.employeeCode).toLowerCase() === employeeId.toLowerCase())
      || source.employees.find((entry) => text(entry.name).toLowerCase() === employeeId.toLowerCase())
      || null;
    if (!employee) {
      return res.status(404).json({ error: 'Sales person not found.' });
    }
    const monthTarget = source.targets.find((target) => target.periodType === 'monthly' && Number(target.year) === year && Number(target.month) === month && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
    const yearTarget = source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
    const monthSummary = summarizeEmployee(employee, source, monthTarget, getPeriodRange('monthly', year, month), {});
    const yearSummary = summarizeEmployee(employee, source, yearTarget, getPeriodRange('yearly', year), {});
    const teamRank = [...source.employees.map((entry) => summarizeEmployee(entry, source, source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(entry, target.employeeId) || employeeMatchesValue(entry, target.employeeName))) || null, getPeriodRange('yearly', year), {}))]
      .sort((a, b) => num(b.achievement.achievementPercent, 0) - num(a.achievement.achievementPercent, 0))
      .findIndex((entry) => entry.employeeId === employee.id);
    const response = {
      employee,
      month,
      year,
      monthly: monthSummary,
      yearly: yearSummary,
      rank: teamRank >= 0 ? teamRank + 1 : null,
      estimatedIncentive: estimateIncentive({ employeeId: employee.id, employeeName: employee.name, achievement: yearSummary.achievement }, source),
      charts: {
        leadConversion: [
          { name: 'Assigned', value: monthSummary.achievement.leadsAssigned },
          { name: 'Converted', value: monthSummary.achievement.leadsConverted }
        ],
        collection: [
          { name: 'Target', value: yearSummary.target.collectionTarget },
          { name: 'Achieved', value: yearSummary.achievement.collectionAmount }
        ]
      }
    };
    return res.json(response);
  } catch (error) {
    console.error('Sales person report failed:', error.message);
    return res.status(500).json({ error: 'Unable to load sales person report.' });
  }
});

router.get('/sales-performance/incentives', async (req, res) => {
  try {
    const source = await loadSalesData();
    const year = Number(req.query.year || new Date().getFullYear());
    const rows = source.employees.map((employee) => {
      const yearTarget = source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null;
      const summary = summarizeEmployee(employee, source, yearTarget, getPeriodRange('yearly', year), {});
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        achievementPercent: summary.achievement.achievementPercent,
        achievedRevenue: summary.achievement.achievedRevenue,
        estimatedIncentive: estimateIncentive(summary, source)
      };
    });
    return res.json({ rules: source.rules, adjustments: source.adjustments, rows });
  } catch (error) {
    console.error('Incentives failed:', error.message);
    return res.status(500).json({ error: 'Unable to load incentives.' });
  }
});

router.post('/sales-performance/incentive-rules', async (req, res) => {
  try {
    const body = req.body || {};
    const row = {
      external_id: text(body.external_id || body.id || qid()),
      rule_name: text(body.ruleName || body.rule_name || 'Incentive Rule'),
      min_achievement_percent: num(body.minAchievementPercent || body.min_achievement_percent || 100),
      max_achievement_percent: body.maxAchievementPercent || body.max_achievement_percent || null,
      fixed_bonus: num(body.fixedBonus || body.fixed_bonus || 0),
      commission_percent: num(body.commissionPercent || body.commission_percent || 0),
      extra_bonus: num(body.extraBonus || body.extra_bonus || 0),
      active: body.active === false ? 0 : 1,
      payload: JSON.stringify(body || {})
    };
    await dbQuery(`INSERT INTO sales_incentive_rules (
      external_id, rule_name, min_achievement_percent, max_achievement_percent, fixed_bonus, commission_percent, extra_bonus, active, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      rule_name=VALUES(rule_name),
      min_achievement_percent=VALUES(min_achievement_percent),
      max_achievement_percent=VALUES(max_achievement_percent),
      fixed_bonus=VALUES(fixed_bonus),
      commission_percent=VALUES(commission_percent),
      extra_bonus=VALUES(extra_bonus),
      active=VALUES(active),
      payload=VALUES(payload)`, [
      row.external_id,
      row.rule_name,
      row.min_achievement_percent,
      row.max_achievement_percent,
      row.fixed_bonus,
      row.commission_percent,
      row.extra_bonus,
      row.active,
      row.payload
    ]);
    return res.json({ success: true, message: 'Rule saved' });
  } catch (error) {
    console.error('Save incentive rule failed:', error.message);
    return res.status(500).json({ error: 'Unable to save incentive rule.' });
  }
});

router.put('/sales-performance/incentive-rules/:id', async (req, res) => {
  try {
    const body = req.body || {};
    await dbQuery(`UPDATE sales_incentive_rules SET
      rule_name=?, min_achievement_percent=?, max_achievement_percent=?, fixed_bonus=?, commission_percent=?, extra_bonus=?, active=?, payload=?
      WHERE external_id = ?`, [
      text(body.ruleName || body.rule_name || 'Incentive Rule'),
      num(body.minAchievementPercent || body.min_achievement_percent || 100),
      body.maxAchievementPercent || body.max_achievement_percent || null,
      num(body.fixedBonus || body.fixed_bonus || 0),
      num(body.commissionPercent || body.commission_percent || 0),
      num(body.extraBonus || body.extra_bonus || 0),
      body.active === false ? 0 : 1,
      JSON.stringify(body || {}),
      text(req.params.id)
    ]);
    return res.json({ success: true, message: 'Rule updated' });
  } catch (error) {
    console.error('Update incentive rule failed:', error.message);
    return res.status(500).json({ error: 'Unable to update incentive rule.' });
  }
});

router.delete('/sales-performance/incentive-rules/:id', async (req, res) => {
  try {
    await dbQuery('DELETE FROM sales_incentive_rules WHERE external_id = ?', [text(req.params.id)]);
    return res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    console.error('Delete incentive rule failed:', error.message);
    return res.status(500).json({ error: 'Unable to delete incentive rule.' });
  }
});

router.get('/sales-performance/export', async (req, res) => {
  try {
    const format = text(req.query.format || 'xls').toLowerCase();
    const scope = text(req.query.scope || 'dashboard').toLowerCase();
    const year = Number(req.query.year || new Date().getFullYear());
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const week = req.query.week ? Number(req.query.week) : null;
    const source = await loadSalesData();
    let title = 'Sales Performance Report';
    let rows = [];
    if (scope === 'weekly') {
      title = `Weekly Performance ${year}`;
      const weeks = week
        ? [week]
        : [...new Set(source.targets.filter((target) => target.periodType === 'weekly' && Number(target.year) === year).map((target) => Number(target.weekNumber || 0)).filter(Boolean))];
      rows = source.employees.flatMap((employee) => weeks.map((weekNumber) => {
        const summary = summarizeEmployee(
          employee,
          source,
          source.targets.find((target) => target.periodType === 'weekly' && Number(target.year) === year && Number(target.weekNumber) === weekNumber && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null,
          (date) => yearOf(date) === year && weekOfYear(date) === weekNumber,
          {}
        );
        return {
          employee: employee.name,
          week: weekNumber,
          target: summary.target.revenueTarget,
          achieved: summary.achievement.achievedRevenue,
          pending: summary.achievement.pendingRevenue,
          achievementPercent: summary.achievement.achievementPercent,
          leadsAssigned: summary.achievement.leadsAssigned,
          leadsConverted: summary.achievement.leadsConverted,
          collection: summary.achievement.collectionAmount,
          status: summary.achievement.achievementPercent >= 100 ? 'On Track' : summary.achievement.achievementPercent >= 75 ? 'Needs Push' : 'At Risk'
        };
      }));
    } else if (scope === 'monthly') {
      title = `Monthly Performance ${monthName(month)} ${year}`;
      rows = source.employees.map((employee) => {
        const summary = summarizeEmployee(employee, source, source.targets.find((target) => target.periodType === 'monthly' && Number(target.year) === year && Number(target.month) === month && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null, getPeriodRange('monthly', year, month), {});
        return {
          employee: employee.name,
          target: summary.target.revenueTarget,
          achieved: summary.achievement.achievedRevenue,
          pending: summary.achievement.pendingRevenue,
          achievementPercent: summary.achievement.achievementPercent,
          leadsAssigned: summary.achievement.leadsAssigned,
          leadsConverted: summary.achievement.leadsConverted,
          collection: summary.achievement.collectionAmount
        };
      });
    } else if (scope === 'yearly') {
      title = `Yearly Performance ${year}`;
      rows = source.employees.map((employee) => {
        const summary = summarizeEmployee(employee, source, source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null, getPeriodRange('yearly', year), {});
        return {
          employee: employee.name,
          target: summary.target.revenueTarget,
          achieved: summary.achievement.achievedRevenue,
          pending: summary.achievement.pendingRevenue,
          achievementPercent: summary.achievement.achievementPercent,
          leadsAssigned: summary.achievement.leadsAssigned,
          leadsConverted: summary.achievement.leadsConverted,
          collection: summary.achievement.collectionAmount,
          incentive: estimateIncentive(summary, source)
        };
      });
    } else if (scope === 'yearly-comparison') {
      title = `Yearly Comparison ${year}`;
      rows = buildMonthlyComparison(source, year);
    } else if (scope === 'team') {
      title = `Team Comparison ${year}`;
      rows = source.employees.map((employee) => {
        const summary = summarizeEmployee(employee, source, source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null, getPeriodRange('yearly', year), {});
        return {
          employee: employee.name,
          target: summary.target.revenueTarget,
          achieved: summary.achievement.achievedRevenue,
          pending: summary.achievement.pendingRevenue,
          achievementPercent: summary.achievement.achievementPercent,
          leadsAssigned: summary.achievement.leadsAssigned,
          leadsConverted: summary.achievement.leadsConverted,
          collection: summary.achievement.collectionAmount,
          incentive: estimateIncentive(summary, source)
        };
      }).sort((a, b) => num(b.achievementPercent, 0) - num(a.achievementPercent, 0));
    } else if (scope === 'person') {
      title = `Sales Person Report ${req.query.employeeId || ''}`;
      const employeeId = text(req.query.employeeId || '');
      const employee = source.employees.find((entry) => employeeMatchesValue(entry, employeeId) || text(entry.id).toLowerCase() === employeeId.toLowerCase() || text(entry.employeeCode).toLowerCase() === employeeId.toLowerCase() || text(entry.name).toLowerCase() === employeeId.toLowerCase()) || null;
      if (employee) {
        const monthSummary = summarizeEmployee(employee, source, source.targets.find((target) => target.periodType === 'monthly' && Number(target.year) === year && Number(target.month) === month && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null, getPeriodRange('monthly', year, month), {});
        const yearSummary = summarizeEmployee(employee, source, source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null, getPeriodRange('yearly', year), {});
        rows = [
          { metric: 'Monthly Target', value: monthSummary.target.revenueTarget },
          { metric: 'Monthly Achieved', value: monthSummary.achievement.achievedRevenue },
          { metric: 'Yearly Target', value: yearSummary.target.revenueTarget },
          { metric: 'Yearly Achieved', value: yearSummary.achievement.achievedRevenue },
          { metric: 'Pending Amount', value: yearSummary.achievement.pendingRevenue },
          { metric: 'Leads Assigned', value: yearSummary.achievement.leadsAssigned },
          { metric: 'Leads Converted', value: yearSummary.achievement.leadsConverted },
          { metric: 'Payments Collected', value: yearSummary.achievement.collectionAmount }
        ];
      }
    }
    if (rows.length === 0) {
      rows = source.employees.map((employee) => {
        const summary = summarizeEmployee(employee, source, source.targets.find((target) => target.periodType === 'yearly' && Number(target.year) === year && (employeeMatchesValue(employee, target.employeeId) || employeeMatchesValue(employee, target.employeeName))) || null, getPeriodRange('yearly', year), {});
        return {
          employee: employee.name,
          target: summary.target.revenueTarget,
          achieved: summary.achievement.achievedRevenue,
          pending: summary.achievement.pendingRevenue,
          achievementPercent: summary.achievement.achievementPercent,
          leadsAssigned: summary.achievement.leadsAssigned,
          leadsConverted: summary.achievement.leadsConverted,
          collection: summary.achievement.collectionAmount
        };
      });
    }
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf"`);
        return res.send(buffer);
      });
      doc.fontSize(18).fillColor('#111827').text(title);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#475569').text(`Generated ${new Date().toLocaleString('en-IN')}`);
      doc.moveDown(0.8);
      rows.slice(0, 60).forEach((row) => {
        if (doc.y > 760) doc.addPage();
        doc.fontSize(10).fillColor('#111827').text(Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(' | '), { width: 520 });
        doc.moveDown(0.25);
      });
      doc.end();
      return;
    }
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><table border="1"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${String(row[header] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xls"`);
    return res.send(html);
  } catch (error) {
    console.error('Sales export failed:', error.message);
    return res.status(500).json({ error: 'Unable to export sales report.' });
  }
});

module.exports = { salesPerformanceRouter: router };
