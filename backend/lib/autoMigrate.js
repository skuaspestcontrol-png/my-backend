const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const defaultStatus = () => ({
  startedAt: null,
  completedAt: null,
  success: false,
  tablesChecked: [],
  tablesCreated: [],
  columnsAdded: [],
  indexesAdded: [],
  payrollRowsMigrated: {},
  errors: []
});

let lastMigrationStatus = defaultStatus();

const quoteIdent = (value) => `\`${String(value || '').replace(/`/g, '``')}\``;
const normalizeText = (value) => String(value ?? '').trim();
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
const toDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 19).replace('T', ' ');
};
const toJson = (value) => JSON.stringify(value ?? null);
const stableExternalId = (prefix, value) => {
  const raw = JSON.stringify(value ?? {});
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 24);
  return `${prefix}-${hash}`;
};

const getQueryTarget = async (poolOrConnection) => {
  if (!poolOrConnection || typeof poolOrConnection.query !== 'function') {
    throw new Error('A mysql2 pool or connection with query() is required.');
  }
  return poolOrConnection;
};

const query = async (target, sql, params = []) => {
  const [rows] = await target.query(sql, params);
  return rows;
};

const tableExists = async (target, tableName) => {
  const rows = await query(
    target,
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
};

const columnExists = async (target, tableName, columnName) => {
  const rows = await query(
    target,
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
};

const indexExists = async (target, tableName, indexName) => {
  const rows = await query(
    target,
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows?.[0]?.count || 0) > 0;
};

const createBaseTableSql = (tableName, extraColumns = [], extraIndexes = []) => `
  CREATE TABLE IF NOT EXISTS ${quoteIdent(tableName)} (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_id VARCHAR(120) NULL,
    ${extraColumns.join(',\n    ')}${extraColumns.length ? ',' : ''}
    payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ${quoteIdent(`uk_${tableName}_external_id`)} (external_id)
    ${extraIndexes.length ? `,\n    ${extraIndexes.join(',\n    ')}` : ''}
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const tableDefinitions = [
  {
    name: 'app_settings',
    createSql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        external_id VARCHAR(120) NULL,
        setting_key VARCHAR(120) NOT NULL,
        setting_value JSON NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_app_settings_key (setting_key),
        UNIQUE KEY uk_app_settings_external_id (external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    columns: {
      external_id: 'VARCHAR(120) NULL',
      setting_key: 'VARCHAR(120) NULL',
      setting_value: 'JSON NULL',
      payload: 'JSON NULL',
      created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    },
    indexes: {
      uk_app_settings_external_id: 'CREATE UNIQUE INDEX uk_app_settings_external_id ON app_settings (external_id)'
    }
  },
  {
    name: 'leads',
    createSql: createBaseTableSql('leads', [
      'lead_date DATE NULL',
      'customer_name VARCHAR(255) NULL',
      'display_name VARCHAR(255) NULL',
      'company_name VARCHAR(255) NULL',
      'contact_person_name VARCHAR(255) NULL',
      'title VARCHAR(255) NULL',
      'mobile VARCHAR(30) NULL',
      'whatsapp_number VARCHAR(30) NULL',
      'email_id VARCHAR(255) NULL',
      'address TEXT NULL',
      'area_name VARCHAR(255) NULL',
      'city VARCHAR(255) NULL',
      'state VARCHAR(255) NULL',
      'pincode VARCHAR(30) NULL',
      'pest_issue VARCHAR(255) NULL',
      'quotation_value DECIMAL(18,2) NULL',
      'lead_source VARCHAR(120) NULL',
      'lead_status VARCHAR(120) NULL',
      'assigned_to VARCHAR(255) NULL',
      'followup_date DATE NULL',
      'google_place_id VARCHAR(255) NULL',
      'google_place_name VARCHAR(255) NULL',
      'google_phone VARCHAR(50) NULL',
      'google_website VARCHAR(255) NULL',
      'latitude DECIMAL(10,8) NULL',
      'longitude DECIMAL(11,8) NULL'
    ], [
      'KEY idx_leads_mobile (mobile)',
      'KEY idx_leads_status (lead_status)',
      'KEY idx_leads_place (google_place_id)'
    ])
  },
  {
    name: 'customers',
    createSql: createBaseTableSql('customers', [
      'display_name VARCHAR(255) NULL',
      'customer_name VARCHAR(255) NULL',
      'company_name VARCHAR(255) NULL',
      'contact_person_name VARCHAR(255) NULL',
      'mobile_number VARCHAR(30) NULL',
      'whatsapp_number VARCHAR(30) NULL',
      'email_id VARCHAR(255) NULL',
      'area_name VARCHAR(255) NULL',
      'city VARCHAR(255) NULL',
      'state VARCHAR(255) NULL',
      'pincode VARCHAR(30) NULL',
      'google_place_id VARCHAR(255) NULL',
      'google_place_name VARCHAR(255) NULL',
      'google_phone VARCHAR(50) NULL',
      'google_website VARCHAR(255) NULL',
      'latitude DECIMAL(10,8) NULL',
      'longitude DECIMAL(11,8) NULL'
    ], [
      'KEY idx_customers_mobile (mobile_number)',
      'KEY idx_customers_name (display_name, customer_name)'
    ])
  },
  {
    name: 'customer_premises',
    createSql: `
      CREATE TABLE IF NOT EXISTS customer_premises (
        id INT NOT NULL AUTO_INCREMENT,
        premise_id VARCHAR(100) NOT NULL,
        customer_id INT NOT NULL,
        premise_label VARCHAR(255) NULL,
        premise_type ENUM('Billing','Shipping','Service','Other') DEFAULT 'Service',
        contact_person VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        address TEXT NOT NULL,
        area_name VARCHAR(255) NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        pincode VARCHAR(20) NULL,
        country VARCHAR(100) DEFAULT 'India',
        latitude DECIMAL(10,8) NULL,
        longitude DECIMAL(11,8) NULL,
        google_place_id VARCHAR(255) NULL,
        google_place_name VARCHAR(255) NULL,
        google_map_url TEXT NULL,
        gstin VARCHAR(50) NULL,
        place_of_supply VARCHAR(100) NULL,
        is_default TINYINT(1) DEFAULT 0,
        is_billing TINYINT(1) DEFAULT 0,
        is_shipping TINYINT(1) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        payload JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_customer_premises_premise_id (premise_id),
        KEY idx_customer_premises_customer_id (customer_id),
        KEY idx_customer_premises_pincode (pincode),
        KEY idx_customer_premises_is_default (is_default),
        KEY idx_customer_premises_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    columns: {
      premise_id: 'VARCHAR(100) NULL',
      customer_id: 'INT NOT NULL',
      premise_label: 'VARCHAR(255) NULL',
      premise_type: "ENUM('Billing','Shipping','Service','Other') DEFAULT 'Service'",
      contact_person: 'VARCHAR(255) NULL',
      phone: 'VARCHAR(50) NULL',
      email: 'VARCHAR(255) NULL',
      address: 'TEXT NULL',
      area_name: 'VARCHAR(255) NULL',
      city: 'VARCHAR(100) NULL',
      state: 'VARCHAR(100) NULL',
      pincode: 'VARCHAR(20) NULL',
      country: "VARCHAR(100) DEFAULT 'India'",
      latitude: 'DECIMAL(10,8) NULL',
      longitude: 'DECIMAL(11,8) NULL',
      google_place_id: 'VARCHAR(255) NULL',
      google_place_name: 'VARCHAR(255) NULL',
      google_map_url: 'TEXT NULL',
      gstin: 'VARCHAR(50) NULL',
      place_of_supply: 'VARCHAR(100) NULL',
      is_default: 'TINYINT(1) DEFAULT 0',
      is_billing: 'TINYINT(1) DEFAULT 0',
      is_shipping: 'TINYINT(1) DEFAULT 0',
      is_active: 'TINYINT(1) DEFAULT 1',
      payload: 'JSON NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    },
    indexes: {
      uk_customer_premises_premise_id: 'CREATE UNIQUE INDEX uk_customer_premises_premise_id ON customer_premises (premise_id)',
      idx_customer_premises_customer_id: 'CREATE INDEX idx_customer_premises_customer_id ON customer_premises (customer_id)',
      idx_customer_premises_pincode: 'CREATE INDEX idx_customer_premises_pincode ON customer_premises (pincode)',
      idx_customer_premises_is_default: 'CREATE INDEX idx_customer_premises_is_default ON customer_premises (is_default)',
      idx_customer_premises_is_active: 'CREATE INDEX idx_customer_premises_is_active ON customer_premises (is_active)'
    }
  },
  {
    name: 'employees',
    createSql: createBaseTableSql('employees', [
      'emp_code VARCHAR(120) NULL',
      'first_name VARCHAR(255) NULL',
      'last_name VARCHAR(255) NULL',
      'full_name VARCHAR(255) NULL',
      'mobile VARCHAR(30) NULL',
      'password VARCHAR(255) NULL',
      'email VARCHAR(255) NULL',
      'portal_password VARCHAR(255) NULL',
      'role VARCHAR(120) NULL',
      'role_name VARCHAR(255) NULL',
      'salary DECIMAL(18,2) NULL',
      'joining_date DATE NULL',
      'city VARCHAR(255) NULL',
      'pincode VARCHAR(30) NULL',
      'profile_photo TEXT NULL',
      'present_address TEXT NULL',
      'status VARCHAR(80) NULL'
    ], [
      'KEY idx_employees_emp_code (emp_code)',
      'KEY idx_employees_role (role)',
      'KEY idx_employees_mobile (mobile)'
    ])
  },
  {
    name: 'jobs',
    createSql: createBaseTableSql('jobs', [
      'customer_external_id VARCHAR(120) NULL',
      'customer_id VARCHAR(120) NULL',
      'invoice_external_id VARCHAR(120) NULL',
      'invoice_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'job_number VARCHAR(120) NULL',
      'assigned_to VARCHAR(255) NULL',
      'technician_name VARCHAR(255) NULL',
      'service_name VARCHAR(255) NULL',
      'service_type VARCHAR(120) NULL',
      'description TEXT NULL',
      'address TEXT NULL',
      'area_name VARCHAR(255) NULL',
      'city VARCHAR(255) NULL',
      'state VARCHAR(255) NULL',
      'pincode VARCHAR(30) NULL',
      'scheduled_date DATE NULL',
      'service_date DATE NULL',
      'scheduled_time VARCHAR(40) NULL',
      'service_time VARCHAR(40) NULL',
      'status VARCHAR(120) NULL',
      'before_photo_url TEXT NULL',
      'after_photo_url TEXT NULL',
      'customer_signature_url LONGTEXT NULL',
      'google_task_id VARCHAR(255) NULL',
      'google_calendar_event_id VARCHAR(255) NULL',
      'google_sync_status VARCHAR(50) NULL',
      'google_last_synced_at DATETIME NULL',
      'source_created_at DATETIME NULL',
      'source_updated_at DATETIME NULL'
    ], [
      'KEY idx_jobs_number (job_number)',
      'KEY idx_jobs_customer_external (customer_external_id)',
      'KEY idx_jobs_invoice_external (invoice_external_id)'
    ])
  },
  {
    name: 'invoices',
    createSql: createBaseTableSql('invoices', [
      'customer_external_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'invoice_number VARCHAR(120) NULL',
      'invoice_type VARCHAR(80) NULL',
      'invoice_status VARCHAR(80) NULL',
      'invoice_date DATE NULL',
      'due_date DATE NULL',
      'total_amount DECIMAL(18,2) NULL',
      'balance_due DECIMAL(18,2) NULL',
      'source_created_at DATETIME NULL',
      'source_updated_at DATETIME NULL'
    ], [
      'KEY idx_invoices_number (invoice_number)',
      'KEY idx_invoices_customer_external (customer_external_id)'
    ])
  },
  {
    name: 'contracts',
    createSql: createBaseTableSql('contracts', [
      'customer_external_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'contract_number VARCHAR(120) NULL',
      'contract_status VARCHAR(80) NULL',
      'contract_start_date DATE NULL',
      'contract_end_date DATE NULL',
      'total_amount DECIMAL(18,2) NULL',
      'source_created_at DATETIME NULL',
      'source_updated_at DATETIME NULL'
    ], [
      'KEY idx_contracts_number (contract_number)',
      'KEY idx_contracts_customer_external (customer_external_id)'
    ])
  },
  {
    name: 'invoice_items',
    createSql: `
      CREATE TABLE IF NOT EXISTS invoice_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        external_id VARCHAR(120) NULL,
        invoice_external_id VARCHAR(120) NULL,
        line_index INT NOT NULL DEFAULT 0,
        item_id VARCHAR(120) NULL,
        item_name VARCHAR(255) NULL,
        description TEXT NULL,
        quantity DECIMAL(12,2) NULL,
        rate DECIMAL(18,2) NULL,
        tax_rate DECIMAL(8,2) NULL,
        amount DECIMAL(18,2) NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_invoice_items_external_id (external_id),
        UNIQUE KEY uk_invoice_items_line (invoice_external_id, line_index),
        KEY idx_invoice_items_invoice (invoice_external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'items',
    createSql: createBaseTableSql('items', [
      'name VARCHAR(255) NULL',
      'item_type VARCHAR(100) NULL',
      'treatment_method VARCHAR(255) NULL',
      'pests_covered TEXT NULL',
      'service_description TEXT NULL',
      'unit VARCHAR(100) NULL',
      'sac VARCHAR(100) NULL',
      'hsn_sac VARCHAR(100) NULL',
      'tax_preference VARCHAR(100) NULL',
      'sellable TINYINT(1) NOT NULL DEFAULT 1',
      'purchasable TINYINT(1) NOT NULL DEFAULT 1',
      'sales_account VARCHAR(255) NULL',
      'purchase_account VARCHAR(255) NULL',
      'preferred_vendor VARCHAR(255) NULL',
      'sales_description TEXT NULL',
      'purchase_description TEXT NULL',
      'purchase_rate DECIMAL(18,2) NULL',
      'description TEXT NULL',
      'rate DECIMAL(18,2) NULL'
    ], ['KEY idx_items_name (name)'])
  },
  {
    name: 'vendors',
    createSql: createBaseTableSql('vendors', [
      'vendor_name VARCHAR(255) NULL',
      'company_name VARCHAR(255) NULL',
      'contact_person_name VARCHAR(255) NULL',
      'mobile VARCHAR(30) NULL',
      'whatsapp_number VARCHAR(30) NULL',
      'email_id VARCHAR(255) NULL',
      'gst_number VARCHAR(80) NULL',
      'address TEXT NULL',
      'city VARCHAR(255) NULL',
      'state VARCHAR(255) NULL',
      'pincode VARCHAR(30) NULL',
      'opening_balance DECIMAL(18,2) NULL'
    ], ['KEY idx_vendors_mobile (mobile)'])
  },
  {
    name: 'vendor_bills',
    createSql: createBaseTableSql('vendor_bills', [
      'vendor_external_id VARCHAR(120) NULL',
      'vendor_name VARCHAR(255) NULL',
      'bill_number VARCHAR(120) NULL',
      'bill_date DATE NULL',
      'due_date DATE NULL',
      'status VARCHAR(80) NULL',
      'subtotal DECIMAL(18,2) NULL',
      'tax_amount DECIMAL(18,2) NULL',
      'total_amount DECIMAL(18,2) NULL',
      'balance_due DECIMAL(18,2) NULL',
      'notes TEXT NULL'
    ], [
      'KEY idx_vendor_bills_vendor (vendor_external_id)',
      'KEY idx_vendor_bills_number (bill_number)'
    ])
  },
  {
    name: 'vendor_bill_items',
    createSql: `
      CREATE TABLE IF NOT EXISTS vendor_bill_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        external_id VARCHAR(120) NULL,
        bill_external_id VARCHAR(120) NULL,
        line_index INT NOT NULL DEFAULT 0,
        item_name VARCHAR(255) NULL,
        description TEXT NULL,
        quantity DECIMAL(12,2) NULL,
        rate DECIMAL(18,2) NULL,
        tax_rate DECIMAL(8,2) NULL,
        amount DECIMAL(18,2) NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_vendor_bill_items_external_id (external_id),
        KEY idx_vendor_bill_items_bill_external_id (bill_external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'payment_received',
    createSql: createBaseTableSql('payment_received', [
      'customer_external_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'payment_date DATE NULL',
      'payment_mode VARCHAR(80) NULL',
      'reference_number VARCHAR(255) NULL',
      'amount DECIMAL(18,2) NULL',
      'notes TEXT NULL',
      'linked_invoice_external_id VARCHAR(120) NULL'
    ], [
      'KEY idx_payment_received_customer (customer_external_id)',
      'KEY idx_payment_received_invoice (linked_invoice_external_id)'
    ])
  },
  {
    name: 'attendance',
    createSql: createBaseTableSql('attendance', [
      'employee_external_id VARCHAR(120) NULL',
      'employee_code VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'attendance_date DATE NULL',
      'status VARCHAR(80) NULL',
      'check_in TIME NULL',
      'check_out TIME NULL',
      'working_hours DECIMAL(8,2) NOT NULL DEFAULT 0',
      'source_created_at DATETIME NULL',
      'source_updated_at DATETIME NULL'
    ], [
      'KEY idx_attendance_employee_date (employee_external_id, attendance_date)',
      'KEY idx_attendance_status (status)'
    ])
  },
  {
    name: 'complaints',
    createSql: createBaseTableSql('complaints', [
      'ticket_number VARCHAR(120) NULL',
      'customer_external_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'mobile_number VARCHAR(30) NULL',
      'contract_external_id VARCHAR(120) NULL',
      'subject VARCHAR(255) NULL',
      'priority VARCHAR(80) NULL',
      'status VARCHAR(80) NULL',
      'due_date DATE NULL'
    ], ['KEY idx_complaints_status (status)'])
  },
  {
    name: 'renewals',
    createSql: createBaseTableSql('renewals', [
      'renewal_id VARCHAR(100) NULL',
      'renewal_display_id VARCHAR(100) NULL',
      'customer_id INT NULL',
      'mobile VARCHAR(50) NULL',
      'email VARCHAR(255) NULL',
      'address TEXT NULL',
      'area_name VARCHAR(255) NULL',
      'service_type VARCHAR(255) NULL',
      'contract_id VARCHAR(100) NULL',
      'previous_contract_start DATE NULL',
      'previous_contract_end DATE NULL',
      'renewal_due_date DATE NULL',
      'previous_amount DECIMAL(12,2) NOT NULL DEFAULT 0',
      'proposed_amount DECIMAL(12,2) NOT NULL DEFAULT 0',
      'final_renewal_amount DECIMAL(12,2) NOT NULL DEFAULT 0',
      'assigned_sales_person_id VARCHAR(100) NULL',
      'assigned_sales_person_name VARCHAR(255) NULL',
      'renewed_by_sales_person_id VARCHAR(100) NULL',
      'renewed_by_sales_person_name VARCHAR(255) NULL',
      'followup_date DATE NULL',
      'last_followup_note TEXT NULL',
      'decline_reason TEXT NULL',
      'renewed_at DATETIME NULL',
      'converted_contract_id VARCHAR(100) NULL',
      'renewal_letter_url TEXT NULL',
      'invoice_external_id VARCHAR(120) NULL',
      'invoice_number VARCHAR(120) NULL',
      'customer_external_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'contract_start_date DATE NULL',
      'contract_end_date DATE NULL',
      'status VARCHAR(80) NULL',
      'payment_status VARCHAR(80) NULL',
      'total_amount DECIMAL(18,2) NULL',
      'balance_due DECIMAL(18,2) NULL'
    ], [
      'UNIQUE KEY uk_renewals_renewal_id (renewal_id)',
      'KEY idx_renewals_due_date (renewal_due_date)',
      'KEY idx_renewals_assigned_sales (assigned_sales_person_id)',
      'KEY idx_renewals_customer_id (customer_id)',
      'KEY idx_renewals_contract_id (contract_id)',
      'KEY idx_renewals_invoice (invoice_external_id)',
      'KEY idx_renewals_status (status)'
    ]),
    indexes: {
      uk_renewals_renewal_id: 'CREATE UNIQUE INDEX uk_renewals_renewal_id ON renewals (renewal_id)',
      idx_renewals_due_date: 'CREATE INDEX idx_renewals_due_date ON renewals (renewal_due_date)',
      idx_renewals_status: 'CREATE INDEX idx_renewals_status ON renewals (status)',
      idx_renewals_assigned_sales: 'CREATE INDEX idx_renewals_assigned_sales ON renewals (assigned_sales_person_id)',
      idx_renewals_customer_id: 'CREATE INDEX idx_renewals_customer_id ON renewals (customer_id)',
      idx_renewals_contract_id: 'CREATE INDEX idx_renewals_contract_id ON renewals (contract_id)'
    }
  },
  {
    name: 'renewal_followups',
    createSql: createBaseTableSql('renewal_followups', [
      'renewal_id VARCHAR(100) NULL',
      'followup_date DATE NULL',
      'note TEXT NULL',
      'status VARCHAR(50) NULL',
      'created_by VARCHAR(255) NULL'
    ], [
      'KEY idx_renewal_followups_renewal_id (renewal_id)',
      'KEY idx_renewal_followups_date (followup_date)'
    ]),
    indexes: {
      idx_renewal_followups_renewal_id: 'CREATE INDEX idx_renewal_followups_renewal_id ON renewal_followups (renewal_id)',
      idx_renewal_followups_date: 'CREATE INDEX idx_renewal_followups_date ON renewal_followups (followup_date)'
    }
  },
  {
    name: 'renewal_letters',
    createSql: createBaseTableSql('renewal_letters', [
      'renewal_id VARCHAR(100) NULL',
      'pdf_url TEXT NULL',
      'customer_name VARCHAR(255) NULL',
      'generated_by VARCHAR(255) NULL',
      'generated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
    ], ['KEY idx_renewal_letters_renewal_id (renewal_id)']),
    indexes: {
      idx_renewal_letters_renewal_id: 'CREATE INDEX idx_renewal_letters_renewal_id ON renewal_letters (renewal_id)'
    }
  },
  {
    name: 'payroll_runs',
    createSql: createBaseTableSql('payroll_runs', [
      'run_key VARCHAR(160) NULL',
      'month INT NULL',
      'year INT NULL',
      'status VARCHAR(80) NULL',
      'generated_by VARCHAR(255) NULL',
      'generated_at DATETIME NULL',
      'total_employees INT NULL',
      'gross_total DECIMAL(18,2) NULL',
      'net_total DECIMAL(18,2) NULL'
    ], ['KEY idx_payroll_runs_month_year (month, year)'])
  },
  {
    name: 'payroll_items',
    createSql: createBaseTableSql('payroll_items', [
      'payroll_key VARCHAR(180) NULL',
      'employee_id VARCHAR(120) NULL',
      'employee_code VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'month INT NULL',
      'year INT NULL',
      'basic_salary DECIMAL(18,2) NOT NULL DEFAULT 0',
      'gross_salary DECIMAL(18,2) NOT NULL DEFAULT 0',
      'deductions_total DECIMAL(18,2) NOT NULL DEFAULT 0',
      'net_salary DECIMAL(18,2) NOT NULL DEFAULT 0',
      'payment_status VARCHAR(80) NULL',
      'payroll_status VARCHAR(80) NULL',
      'is_locked TINYINT(1) NOT NULL DEFAULT 0'
    ], [
      'KEY idx_payroll_items_employee (employee_id)',
      'KEY idx_payroll_items_month_year (month, year)',
      'KEY idx_payroll_items_key (payroll_key)'
    ])
  },
  {
    name: 'payroll_salary_structures',
    createSql: createBaseTableSql('payroll_salary_structures', [
      'employee_id VARCHAR(120) NULL',
      'employee_code VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'effective_date DATE NULL',
      'salary_type VARCHAR(80) NULL',
      'basic_salary DECIMAL(18,2) NOT NULL DEFAULT 0',
      'gross_salary DECIMAL(18,2) NOT NULL DEFAULT 0',
      'deductions_total DECIMAL(18,2) NOT NULL DEFAULT 0',
      'net_salary DECIMAL(18,2) NOT NULL DEFAULT 0',
      'is_active TINYINT(1) NOT NULL DEFAULT 1'
    ], ['KEY idx_payroll_salary_structures_employee (employee_id)'])
  },
  {
    name: 'payroll_holidays',
    createSql: createBaseTableSql('payroll_holidays', [
      'holiday_date DATE NULL',
      'title VARCHAR(255) NULL',
      'type VARCHAR(80) NULL',
      'notes TEXT NULL'
    ], ['KEY idx_payroll_holidays_date (holiday_date)'])
  },
  {
    name: 'payroll_advances',
    createSql: createBaseTableSql('payroll_advances', [
      'employee_id VARCHAR(120) NULL',
      'employee_code VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'issued_date DATE NULL',
      'amount DECIMAL(18,2) NOT NULL DEFAULT 0',
      'recovered_amount DECIMAL(18,2) NOT NULL DEFAULT 0',
      'balance_amount DECIMAL(18,2) NOT NULL DEFAULT 0',
      'monthly_deduction DECIMAL(18,2) NOT NULL DEFAULT 0',
      'status VARCHAR(80) NULL'
    ], ['KEY idx_payroll_advances_employee (employee_id)'])
  },
  {
    name: 'payroll_salary_payments',
    createSql: createBaseTableSql('payroll_salary_payments', [
      'payroll_item_id VARCHAR(120) NULL',
      'employee_id VARCHAR(120) NULL',
      'employee_code VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'payment_date DATE NULL',
      'payment_mode VARCHAR(80) NULL',
      'transaction_ref VARCHAR(255) NULL',
      'amount DECIMAL(18,2) NOT NULL DEFAULT 0'
    ], ['KEY idx_payroll_salary_payments_item (payroll_item_id)'])
  },
  {
    name: 'payroll_audit',
    createSql: createBaseTableSql('payroll_audit', [
      'actor VARCHAR(255) NULL',
      'actor_employee_id VARCHAR(120) NULL',
      'action VARCHAR(120) NULL',
      'entity_type VARCHAR(120) NULL',
      'entity_id VARCHAR(120) NULL',
      'message TEXT NULL'
    ], ['KEY idx_payroll_audit_action (action)'])
  },
  {
    name: 'payroll_settings',
    createSql: `
      CREATE TABLE IF NOT EXISTS payroll_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        setting_key VARCHAR(120) NOT NULL,
        setting_value JSON NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_payroll_settings_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'payroll_records',
    createSql: `
      CREATE TABLE IF NOT EXISTS payroll_records (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        payroll_key VARCHAR(180) NOT NULL,
        employee_id VARCHAR(120) NOT NULL,
        employee_code VARCHAR(120) NULL,
        employee_name VARCHAR(255) NULL,
        designation VARCHAR(255) NULL,
        department VARCHAR(255) NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        present_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        absent_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        leave_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
        gross_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_allowances DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_deductions DECIMAL(18,2) NOT NULL DEFAULT 0,
        net_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
        payment_status VARCHAR(80) NULL,
        payment_date DATE NULL,
        payment_method VARCHAR(80) NULL,
        remarks TEXT NULL,
        payroll_status VARCHAR(80) NULL,
        is_locked TINYINT(1) NOT NULL DEFAULT 0,
        manual_adjustment_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        manual_adjustment_reason TEXT NULL,
        manual_override_enabled TINYINT(1) NOT NULL DEFAULT 0,
        override_net_salary DECIMAL(18,2) NULL,
        basic_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
        salary_type VARCHAR(80) NULL,
        per_day_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
        attendance_summary JSON NULL,
        allowances JSON NULL,
        deductions JSON NULL,
        advance_breakdown JSON NULL,
        salary_in_words TEXT NULL,
        slip_path TEXT NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_payroll_records_key (payroll_key),
        KEY idx_payroll_records_employee (employee_id),
        KEY idx_payroll_records_month_year (month, year),
        KEY idx_payroll_records_status (payment_status, payroll_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'salary_components',
    createSql: `
      CREATE TABLE IF NOT EXISTS salary_components (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        employee_id VARCHAR(120) NOT NULL,
        structure_key VARCHAR(180) NOT NULL,
        component_name VARCHAR(120) NOT NULL,
        component_type VARCHAR(80) NOT NULL,
        amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        recurring TINYINT(1) NOT NULL DEFAULT 1,
        effective_date DATE NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_salary_components_row (structure_key, component_name, component_type),
        KEY idx_salary_components_employee (employee_id),
        KEY idx_salary_components_effective_date (effective_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'salary_advances',
    createSql: `
      CREATE TABLE IF NOT EXISTS salary_advances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        advance_key VARCHAR(180) NOT NULL,
        employee_id VARCHAR(120) NOT NULL,
        amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        reason TEXT NULL,
        advance_date DATE NULL,
        recovery_month VARCHAR(20) NULL,
        status VARCHAR(80) NULL,
        monthly_deduction DECIMAL(18,2) NOT NULL DEFAULT 0,
        deduction_mode VARCHAR(80) NULL,
        recovered_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        balance_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        auto_deduct TINYINT(1) NOT NULL DEFAULT 1,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_salary_advances_key (advance_key),
        KEY idx_salary_advances_employee (employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'salary_slips',
    createSql: `
      CREATE TABLE IF NOT EXISTS salary_slips (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        payroll_record_id VARCHAR(120) NOT NULL,
        pdf_path TEXT NOT NULL,
        generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_salary_slips_record (payroll_record_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'hr_leaves',
    createSql: createBaseTableSql('hr_leaves', [
      'employee_id VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'leave_type VARCHAR(80) NULL',
      'start_date DATE NULL',
      'end_date DATE NULL',
      'status VARCHAR(80) NULL'
    ], ['KEY idx_hr_leaves_employee (employee_id)'])
  },
  {
    name: 'hr_notifications',
    createSql: createBaseTableSql('hr_notifications', [
      'employee_id VARCHAR(120) NULL',
      'title VARCHAR(255) NULL',
      'message TEXT NULL',
      'status VARCHAR(80) NULL',
      'read_at DATETIME NULL'
    ])
  },
  {
    name: 'hr_workflow',
    createSql: createBaseTableSql('hr_workflow', [
      'workflow_type VARCHAR(120) NULL',
      'entity_id VARCHAR(120) NULL',
      'status VARCHAR(80) NULL',
      'assigned_to VARCHAR(255) NULL'
    ])
  },
  {
    name: 'hr_performance',
    createSql: createBaseTableSql('hr_performance', [
      'employee_id VARCHAR(120) NULL',
      'employee_name VARCHAR(255) NULL',
      'review_period VARCHAR(120) NULL',
      'rating DECIMAL(5,2) NULL',
      'status VARCHAR(80) NULL'
    ], ['KEY idx_hr_performance_employee (employee_id)'])
  },
  {
    name: 'quotation_template_settings',
    createSql: createBaseTableSql('quotation_template_settings', [
      'company_name VARCHAR(255) NULL',
      'logo_url TEXT NULL',
      'primary_color VARCHAR(40) NULL',
      'font_family VARCHAR(120) NULL',
      'footer_text TEXT NULL'
    ])
  },
  {
    name: 'quotation_prefix_settings',
    createSql: createBaseTableSql('quotation_prefix_settings', [
      'prefix VARCHAR(80) NULL',
      'financial_year VARCHAR(40) NULL',
      'next_number INT NULL',
      'padding_digits INT NULL',
      'format_template VARCHAR(255) NULL'
    ])
  },
  {
    name: 'quotation_service_templates',
    createSql: createBaseTableSql('quotation_service_templates', [
      'service_name VARCHAR(255) NULL',
      'service_code VARCHAR(60) NULL',
      'pest_name VARCHAR(255) NULL',
      'default_frequency VARCHAR(120) NULL',
      'default_rate_without_gst DECIMAL(18,2) NULL',
      'default_rate_with_gst DECIMAL(18,2) NULL',
      'is_active TINYINT(1) NOT NULL DEFAULT 1'
    ], ['KEY idx_quotation_service_templates_active (is_active, service_name)'])
  },
  {
    name: 'quotation_common_paragraphs',
    createSql: createBaseTableSql('quotation_common_paragraphs', [
      'opening_paragraph TEXT NULL',
      'closing_paragraph TEXT NULL',
      'payment_terms TEXT NULL',
      'general_terms TEXT NULL',
      'warranty_paragraph TEXT NULL',
      'disclaimer_paragraph TEXT NULL'
    ])
  },
  {
    name: 'quotations',
    createSql: createBaseTableSql('quotations', [
      'quotation_number VARCHAR(120) NULL',
      'source_type VARCHAR(40) NULL',
      'lead_id VARCHAR(120) NULL',
      'customer_id VARCHAR(120) NULL',
      'customer_name VARCHAR(255) NULL',
      'company_name VARCHAR(255) NULL',
      'quotation_date DATE NULL',
      'status VARCHAR(80) NULL',
      'grand_total DECIMAL(18,2) NULL'
    ], [
      'UNIQUE KEY uq_quotations_number (quotation_number)',
      'KEY idx_quotations_customer (customer_id)'
    ])
  },
  {
    name: 'quotation_items',
    createSql: `
      CREATE TABLE IF NOT EXISTS quotation_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        external_id VARCHAR(120) NULL,
        quotation_id BIGINT UNSIGNED NULL,
        quotation_external_id VARCHAR(120) NULL,
        service_template_id BIGINT UNSIGNED NULL,
        service_name VARCHAR(255) NULL,
        service_code VARCHAR(60) NULL,
        pest_name VARCHAR(255) NULL,
        quantity DECIMAL(12,2) NULL,
        rate_without_gst DECIMAL(18,2) NULL,
        gst_percentage DECIMAL(8,2) NULL,
        total_amount DECIMAL(18,2) NULL,
        sort_order INT NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_quotation_items_external_id (external_id),
        KEY idx_quotation_items_quotation (quotation_id),
        KEY idx_quotation_items_quotation_external (quotation_external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'uploaded_files',
    createSql: createBaseTableSql('uploaded_files', [
      'module_name VARCHAR(120) NULL',
      'entity_type VARCHAR(120) NULL',
      'entity_id VARCHAR(120) NULL',
      'file_role VARCHAR(120) NULL',
      'file_name VARCHAR(255) NULL',
      'original_name VARCHAR(255) NULL',
      'mime_type VARCHAR(120) NULL',
      'file_size BIGINT UNSIGNED NULL',
      'relative_path TEXT NULL',
      'public_url TEXT NULL',
      'uploaded_by VARCHAR(255) NULL'
    ], [
      'KEY idx_uploaded_files_entity (entity_type, entity_id)',
      'KEY idx_uploaded_files_module (module_name)'
    ])
  }
];

const collectColumns = () => {
  const map = new Map();
  const add = (table, columns) => {
    map.set(table, {
      external_id: 'VARCHAR(120) NULL',
      payload: 'JSON NULL',
      created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ...(columns || {})
    });
  };

  tableDefinitions.forEach((definition) => add(definition.name, definition.columns));

  add('leads', {
    lead_date: 'DATE NULL', customer_name: 'VARCHAR(255) NULL', display_name: 'VARCHAR(255) NULL', company_name: 'VARCHAR(255) NULL',
    contact_person_name: 'VARCHAR(255) NULL', title: 'VARCHAR(255) NULL', mobile: 'VARCHAR(30) NULL', whatsapp_number: 'VARCHAR(30) NULL',
    email_id: 'VARCHAR(255) NULL', address: 'TEXT NULL', area_name: 'VARCHAR(255) NULL', city: 'VARCHAR(255) NULL', state: 'VARCHAR(255) NULL',
    pincode: 'VARCHAR(30) NULL', pest_issue: 'VARCHAR(255) NULL', quotation_value: 'DECIMAL(18,2) NULL', lead_source: 'VARCHAR(120) NULL',
    lead_status: 'VARCHAR(120) NULL', assigned_to: 'VARCHAR(255) NULL', followup_date: 'DATE NULL', google_place_id: 'VARCHAR(255) NULL',
    google_place_name: 'VARCHAR(255) NULL', google_phone: 'VARCHAR(50) NULL', google_website: 'VARCHAR(255) NULL', latitude: 'DECIMAL(10,8) NULL',
    longitude: 'DECIMAL(11,8) NULL'
  });
  add('customers', {
    display_name: 'VARCHAR(255) NULL', customer_name: 'VARCHAR(255) NULL', company_name: 'VARCHAR(255) NULL', contact_person_name: 'VARCHAR(255) NULL',
    mobile_number: 'VARCHAR(30) NULL', whatsapp_number: 'VARCHAR(30) NULL', email_id: 'VARCHAR(255) NULL', area_name: 'VARCHAR(255) NULL',
    city: 'VARCHAR(255) NULL', state: 'VARCHAR(255) NULL', pincode: 'VARCHAR(30) NULL', google_place_id: 'VARCHAR(255) NULL',
    google_place_name: 'VARCHAR(255) NULL', google_phone: 'VARCHAR(50) NULL', google_website: 'VARCHAR(255) NULL', latitude: 'DECIMAL(10,8) NULL',
    longitude: 'DECIMAL(11,8) NULL'
  });
  add('customer_premises', {
    premise_id: 'VARCHAR(100) NULL', customer_id: 'INT NOT NULL', premise_label: 'VARCHAR(255) NULL',
    premise_type: "ENUM('Billing','Shipping','Service','Other') DEFAULT 'Service'", contact_person: 'VARCHAR(255) NULL',
    phone: 'VARCHAR(50) NULL', email: 'VARCHAR(255) NULL', address: 'TEXT NULL', area_name: 'VARCHAR(255) NULL',
    city: 'VARCHAR(100) NULL', state: 'VARCHAR(100) NULL', pincode: 'VARCHAR(20) NULL', country: "VARCHAR(100) DEFAULT 'India'",
    latitude: 'DECIMAL(10,8) NULL', longitude: 'DECIMAL(11,8) NULL', google_place_id: 'VARCHAR(255) NULL',
    google_place_name: 'VARCHAR(255) NULL', google_map_url: 'TEXT NULL', gstin: 'VARCHAR(50) NULL',
    place_of_supply: 'VARCHAR(100) NULL', is_default: 'TINYINT(1) DEFAULT 0', is_billing: 'TINYINT(1) DEFAULT 0',
    is_shipping: 'TINYINT(1) DEFAULT 0', is_active: 'TINYINT(1) DEFAULT 1'
  });
  add('employees', {
    emp_code: 'VARCHAR(120) NULL', first_name: 'VARCHAR(255) NULL', last_name: 'VARCHAR(255) NULL', full_name: 'VARCHAR(255) NULL',
    mobile: 'VARCHAR(30) NULL', password: 'VARCHAR(255) NULL', email: 'VARCHAR(255) NULL', portal_password: 'VARCHAR(255) NULL',
    role: 'VARCHAR(120) NULL', role_name: 'VARCHAR(255) NULL', salary: 'DECIMAL(18,2) NULL', joining_date: 'DATE NULL',
    city: 'VARCHAR(255) NULL', pincode: 'VARCHAR(30) NULL', profile_photo: 'TEXT NULL', present_address: 'TEXT NULL', status: 'VARCHAR(80) NULL'
  });
  add('jobs', {
    customer_external_id: 'VARCHAR(120) NULL', customer_id: 'VARCHAR(120) NULL', invoice_external_id: 'VARCHAR(120) NULL', invoice_id: 'VARCHAR(120) NULL',
    customer_name: 'VARCHAR(255) NULL', job_number: 'VARCHAR(120) NULL', assigned_to: 'VARCHAR(255) NULL', technician_name: 'VARCHAR(255) NULL',
    service_name: 'VARCHAR(255) NULL', service_type: 'VARCHAR(120) NULL', description: 'TEXT NULL', address: 'TEXT NULL', area_name: 'VARCHAR(255) NULL',
    city: 'VARCHAR(255) NULL', state: 'VARCHAR(255) NULL', pincode: 'VARCHAR(30) NULL', scheduled_date: 'DATE NULL', service_date: 'DATE NULL',
    scheduled_time: 'VARCHAR(40) NULL', service_time: 'VARCHAR(40) NULL', status: 'VARCHAR(120) NULL', before_photo_url: 'TEXT NULL',
    after_photo_url: 'TEXT NULL', customer_signature_url: 'LONGTEXT NULL', google_task_id: 'VARCHAR(255) NULL',
    google_calendar_event_id: 'VARCHAR(255) NULL', google_sync_status: 'VARCHAR(50) NULL', google_last_synced_at: 'DATETIME NULL',
    source_created_at: 'DATETIME NULL', source_updated_at: 'DATETIME NULL',
    customer_premise_id: 'VARCHAR(100) NULL', premise_label: 'VARCHAR(255) NULL', premise_address: 'TEXT NULL',
    premise_area_name: 'VARCHAR(255) NULL', premise_city: 'VARCHAR(100) NULL', premise_state: 'VARCHAR(100) NULL',
    premise_pincode: 'VARCHAR(20) NULL', premise_google_map_url: 'TEXT NULL'
  });
  add('invoices', {
    customer_external_id: 'VARCHAR(120) NULL', customer_name: 'VARCHAR(255) NULL', invoice_number: 'VARCHAR(120) NULL',
    invoice_type: 'VARCHAR(80) NULL', invoice_status: 'VARCHAR(80) NULL', invoice_date: 'DATE NULL', due_date: 'DATE NULL',
    total_amount: 'DECIMAL(18,2) NULL', balance_due: 'DECIMAL(18,2) NULL', source_created_at: 'DATETIME NULL', source_updated_at: 'DATETIME NULL',
    customer_premise_id: 'VARCHAR(100) NULL', premise_label: 'VARCHAR(255) NULL', premise_address: 'TEXT NULL',
    premise_area_name: 'VARCHAR(255) NULL', premise_city: 'VARCHAR(100) NULL', premise_state: 'VARCHAR(100) NULL',
    premise_pincode: 'VARCHAR(20) NULL', premise_google_map_url: 'TEXT NULL'
  });
  add('invoice_items', {
    invoice_external_id: 'VARCHAR(120) NULL', line_index: 'INT NOT NULL DEFAULT 0', item_id: 'VARCHAR(120) NULL', item_name: 'VARCHAR(255) NULL',
    description: 'TEXT NULL', quantity: 'DECIMAL(12,2) NULL', rate: 'DECIMAL(18,2) NULL', tax_rate: 'DECIMAL(8,2) NULL', amount: 'DECIMAL(18,2) NULL'
  });
  add('items', {
    name: 'VARCHAR(255) NULL', item_type: 'VARCHAR(100) NULL', treatment_method: 'VARCHAR(255) NULL', pests_covered: 'TEXT NULL',
    service_description: 'TEXT NULL', unit: 'VARCHAR(100) NULL', sac: 'VARCHAR(100) NULL', hsn_sac: 'VARCHAR(100) NULL',
    tax_preference: 'VARCHAR(100) NULL', sellable: 'TINYINT(1) NOT NULL DEFAULT 1', purchasable: 'TINYINT(1) NOT NULL DEFAULT 1',
    sales_account: 'VARCHAR(255) NULL', purchase_account: 'VARCHAR(255) NULL', preferred_vendor: 'VARCHAR(255) NULL',
    sales_description: 'TEXT NULL', purchase_description: 'TEXT NULL', purchase_rate: 'DECIMAL(18,2) NULL',
    description: 'TEXT NULL', rate: 'DECIMAL(18,2) NULL'
  });
  add('vendors', {
    vendor_name: 'VARCHAR(255) NULL', company_name: 'VARCHAR(255) NULL', contact_person_name: 'VARCHAR(255) NULL',
    mobile: 'VARCHAR(30) NULL', whatsapp_number: 'VARCHAR(30) NULL', email_id: 'VARCHAR(255) NULL',
    gst_number: 'VARCHAR(80) NULL', address: 'TEXT NULL', city: 'VARCHAR(255) NULL', state: 'VARCHAR(255) NULL',
    pincode: 'VARCHAR(30) NULL', opening_balance: 'DECIMAL(18,2) NULL'
  });
  add('vendor_bills', {
    vendor_external_id: 'VARCHAR(120) NULL', vendor_name: 'VARCHAR(255) NULL', bill_number: 'VARCHAR(120) NULL',
    bill_date: 'DATE NULL', due_date: 'DATE NULL', status: 'VARCHAR(80) NULL', subtotal: 'DECIMAL(18,2) NULL',
    tax_amount: 'DECIMAL(18,2) NULL', total_amount: 'DECIMAL(18,2) NULL', balance_due: 'DECIMAL(18,2) NULL',
    notes: 'TEXT NULL'
  });
  add('vendor_bill_items', {
    bill_external_id: 'VARCHAR(120) NULL', line_index: 'INT NOT NULL DEFAULT 0', item_name: 'VARCHAR(255) NULL', description: 'TEXT NULL',
    quantity: 'DECIMAL(12,2) NULL', rate: 'DECIMAL(18,2) NULL', tax_rate: 'DECIMAL(8,2) NULL', amount: 'DECIMAL(18,2) NULL'
  });
  add('payment_received', {
    customer_external_id: 'VARCHAR(120) NULL', customer_name: 'VARCHAR(255) NULL', payment_date: 'DATE NULL',
    payment_mode: 'VARCHAR(80) NULL', reference_number: 'VARCHAR(255) NULL', amount: 'DECIMAL(18,2) NULL',
    notes: 'TEXT NULL', linked_invoice_external_id: 'VARCHAR(120) NULL'
  });
  add('attendance', {
    employee_external_id: 'VARCHAR(120) NULL', employee_code: 'VARCHAR(120) NULL', employee_name: 'VARCHAR(255) NULL',
    attendance_date: 'DATE NULL', status: 'VARCHAR(80) NULL', check_in: 'TIME NULL', check_out: 'TIME NULL',
    working_hours: 'DECIMAL(8,2) NOT NULL DEFAULT 0', source_created_at: 'DATETIME NULL', source_updated_at: 'DATETIME NULL'
  });
  add('complaints', {
    ticket_number: 'VARCHAR(120) NULL', customer_external_id: 'VARCHAR(120) NULL', customer_name: 'VARCHAR(255) NULL',
    mobile_number: 'VARCHAR(30) NULL', contract_external_id: 'VARCHAR(120) NULL', subject: 'VARCHAR(255) NULL',
    priority: 'VARCHAR(80) NULL', status: 'VARCHAR(80) NULL', due_date: 'DATE NULL'
  });
  add('renewals', {
    renewal_id: 'VARCHAR(100) NULL', renewal_display_id: 'VARCHAR(100) NULL', customer_id: 'INT NULL', mobile: 'VARCHAR(50) NULL',
    email: 'VARCHAR(255) NULL', address: 'TEXT NULL', area_name: 'VARCHAR(255) NULL',
    service_type: 'VARCHAR(255) NULL', contract_id: 'VARCHAR(100) NULL',
    previous_contract_start: 'DATE NULL', previous_contract_end: 'DATE NULL', renewal_due_date: 'DATE NULL',
    previous_amount: 'DECIMAL(12,2) NOT NULL DEFAULT 0', proposed_amount: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
    final_renewal_amount: 'DECIMAL(12,2) NOT NULL DEFAULT 0', assigned_sales_person_id: 'VARCHAR(100) NULL',
    assigned_sales_person_name: 'VARCHAR(255) NULL', renewed_by_sales_person_id: 'VARCHAR(100) NULL',
    renewed_by_sales_person_name: 'VARCHAR(255) NULL', followup_date: 'DATE NULL',
    last_followup_note: 'TEXT NULL', decline_reason: 'TEXT NULL', renewed_at: 'DATETIME NULL',
    converted_contract_id: 'VARCHAR(100) NULL', renewal_letter_url: 'TEXT NULL',
    invoice_external_id: 'VARCHAR(120) NULL', invoice_number: 'VARCHAR(120) NULL', customer_external_id: 'VARCHAR(120) NULL',
    customer_name: 'VARCHAR(255) NULL', contract_start_date: 'DATE NULL', contract_end_date: 'DATE NULL',
    status: 'VARCHAR(80) NULL', payment_status: 'VARCHAR(80) NULL', total_amount: 'DECIMAL(18,2) NULL',
    balance_due: 'DECIMAL(18,2) NULL'
  });
  add('renewal_followups', {
    renewal_id: 'VARCHAR(100) NULL', followup_date: 'DATE NULL', note: 'TEXT NULL',
    status: 'VARCHAR(50) NULL', created_by: 'VARCHAR(255) NULL'
  });
  add('renewal_letters', {
    renewal_id: 'VARCHAR(100) NULL', pdf_url: 'TEXT NULL', customer_name: 'VARCHAR(255) NULL',
    generated_by: 'VARCHAR(255) NULL', generated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
  });
  add('payroll_runs', {
    run_key: 'VARCHAR(160) NULL', month: 'INT NULL', year: 'INT NULL', status: 'VARCHAR(80) NULL',
    generated_by: 'VARCHAR(255) NULL', generated_at: 'DATETIME NULL', total_employees: 'INT NULL',
    gross_total: 'DECIMAL(18,2) NULL', net_total: 'DECIMAL(18,2) NULL'
  });
  add('payroll_items', {
    payroll_key: 'VARCHAR(180) NULL', employee_id: 'VARCHAR(120) NULL', employee_code: 'VARCHAR(120) NULL',
    employee_name: 'VARCHAR(255) NULL', month: 'INT NULL', year: 'INT NULL',
    basic_salary: 'DECIMAL(18,2) NOT NULL DEFAULT 0', gross_salary: 'DECIMAL(18,2) NOT NULL DEFAULT 0',
    deductions_total: 'DECIMAL(18,2) NOT NULL DEFAULT 0', net_salary: 'DECIMAL(18,2) NOT NULL DEFAULT 0',
    payment_status: 'VARCHAR(80) NULL', payroll_status: 'VARCHAR(80) NULL', is_locked: 'TINYINT(1) NOT NULL DEFAULT 0'
  });
  add('payroll_salary_structures', {
    employee_id: 'VARCHAR(120) NULL', employee_code: 'VARCHAR(120) NULL', employee_name: 'VARCHAR(255) NULL',
    effective_date: 'DATE NULL', salary_type: 'VARCHAR(80) NULL', basic_salary: 'DECIMAL(18,2) NOT NULL DEFAULT 0',
    gross_salary: 'DECIMAL(18,2) NOT NULL DEFAULT 0', deductions_total: 'DECIMAL(18,2) NOT NULL DEFAULT 0',
    net_salary: 'DECIMAL(18,2) NOT NULL DEFAULT 0', is_active: 'TINYINT(1) NOT NULL DEFAULT 1'
  });
  add('payroll_holidays', {
    holiday_date: 'DATE NULL', title: 'VARCHAR(255) NULL', type: 'VARCHAR(80) NULL', notes: 'TEXT NULL'
  });
  add('payroll_advances', {
    employee_id: 'VARCHAR(120) NULL', employee_code: 'VARCHAR(120) NULL', employee_name: 'VARCHAR(255) NULL',
    issued_date: 'DATE NULL', amount: 'DECIMAL(18,2) NOT NULL DEFAULT 0',
    recovered_amount: 'DECIMAL(18,2) NOT NULL DEFAULT 0', balance_amount: 'DECIMAL(18,2) NOT NULL DEFAULT 0',
    monthly_deduction: 'DECIMAL(18,2) NOT NULL DEFAULT 0', status: 'VARCHAR(80) NULL'
  });
  add('payroll_salary_payments', {
    payroll_item_id: 'VARCHAR(120) NULL', employee_id: 'VARCHAR(120) NULL', employee_code: 'VARCHAR(120) NULL',
    employee_name: 'VARCHAR(255) NULL', payment_date: 'DATE NULL', payment_mode: 'VARCHAR(80) NULL',
    transaction_ref: 'VARCHAR(255) NULL', amount: 'DECIMAL(18,2) NOT NULL DEFAULT 0'
  });
  add('payroll_audit', {
    actor: 'VARCHAR(255) NULL', actor_employee_id: 'VARCHAR(120) NULL', action: 'VARCHAR(120) NULL',
    entity_type: 'VARCHAR(120) NULL', entity_id: 'VARCHAR(120) NULL', message: 'TEXT NULL'
  });
  add('hr_leaves', {
    employee_id: 'VARCHAR(120) NULL', employee_name: 'VARCHAR(255) NULL', leave_type: 'VARCHAR(80) NULL',
    start_date: 'DATE NULL', end_date: 'DATE NULL', status: 'VARCHAR(80) NULL'
  });
  add('hr_notifications', {
    employee_id: 'VARCHAR(120) NULL', title: 'VARCHAR(255) NULL', message: 'TEXT NULL',
    status: 'VARCHAR(80) NULL', read_at: 'DATETIME NULL'
  });
  add('hr_workflow', {
    workflow_type: 'VARCHAR(120) NULL', entity_id: 'VARCHAR(120) NULL', status: 'VARCHAR(80) NULL',
    assigned_to: 'VARCHAR(255) NULL'
  });
  add('hr_performance', {
    employee_id: 'VARCHAR(120) NULL', employee_name: 'VARCHAR(255) NULL', review_period: 'VARCHAR(120) NULL',
    rating: 'DECIMAL(5,2) NULL', status: 'VARCHAR(80) NULL'
  });
  add('quotation_template_settings', {
    company_name: 'VARCHAR(255) NULL', logo_url: 'TEXT NULL', primary_color: 'VARCHAR(40) NULL',
    font_family: 'VARCHAR(120) NULL', footer_text: 'TEXT NULL'
  });
  add('quotation_prefix_settings', {
    prefix: 'VARCHAR(80) NULL', financial_year: 'VARCHAR(40) NULL', next_number: 'INT NULL',
    padding_digits: 'INT NULL', format_template: 'VARCHAR(255) NULL'
  });
  add('quotation_service_templates', {
    service_name: 'VARCHAR(255) NULL', service_code: 'VARCHAR(60) NULL', pest_name: 'VARCHAR(255) NULL',
    default_frequency: 'VARCHAR(120) NULL', default_rate_without_gst: 'DECIMAL(18,2) NULL',
    default_rate_with_gst: 'DECIMAL(18,2) NULL', is_active: 'TINYINT(1) NOT NULL DEFAULT 1'
  });
  add('quotation_common_paragraphs', {
    opening_paragraph: 'TEXT NULL', closing_paragraph: 'TEXT NULL', payment_terms: 'TEXT NULL',
    general_terms: 'TEXT NULL', warranty_paragraph: 'TEXT NULL', disclaimer_paragraph: 'TEXT NULL'
  });
  add('quotations', {
    quotation_number: 'VARCHAR(120) NULL', source_type: 'VARCHAR(40) NULL', lead_id: 'VARCHAR(120) NULL',
    customer_id: 'VARCHAR(120) NULL', customer_name: 'VARCHAR(255) NULL', company_name: 'VARCHAR(255) NULL',
    quotation_date: 'DATE NULL', status: 'VARCHAR(80) NULL', grand_total: 'DECIMAL(18,2) NULL',
    customer_premise_id: 'VARCHAR(100) NULL', premise_label: 'VARCHAR(255) NULL', premise_address: 'TEXT NULL',
    premise_area_name: 'VARCHAR(255) NULL', premise_city: 'VARCHAR(100) NULL', premise_state: 'VARCHAR(100) NULL',
    premise_pincode: 'VARCHAR(20) NULL', premise_google_map_url: 'TEXT NULL'
  });
  add('quotation_items', {
    quotation_id: 'BIGINT UNSIGNED NULL', quotation_external_id: 'VARCHAR(120) NULL', service_template_id: 'BIGINT UNSIGNED NULL',
    service_name: 'VARCHAR(255) NULL', service_code: 'VARCHAR(60) NULL', pest_name: 'VARCHAR(255) NULL', quantity: 'DECIMAL(12,2) NULL',
    rate_without_gst: 'DECIMAL(18,2) NULL', gst_percentage: 'DECIMAL(8,2) NULL', total_amount: 'DECIMAL(18,2) NULL', sort_order: 'INT NULL'
  });
  add('uploaded_files', {
    module_name: 'VARCHAR(120) NULL', entity_type: 'VARCHAR(120) NULL', entity_id: 'VARCHAR(120) NULL',
    file_role: 'VARCHAR(120) NULL', file_name: 'VARCHAR(255) NULL', original_name: 'VARCHAR(255) NULL',
    mime_type: 'VARCHAR(120) NULL', file_size: 'BIGINT UNSIGNED NULL', relative_path: 'TEXT NULL',
    public_url: 'TEXT NULL', uploaded_by: 'VARCHAR(255) NULL'
  });

  return map;
};

const tableColumnDefinitions = collectColumns();

const readJsonFile = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === undefined || parsed === null ? fallback : parsed;
  } catch (error) {
    lastMigrationStatus.errors.push({ step: `read_json:${path.basename(filePath)}`, error: error.message });
    return fallback;
  }
};

const resolveDataFile = (fileName) => {
  const dataDir = String(process.env.DATA_DIR || process.env.PERSISTENT_DATA_DIR || '').trim()
    || path.join(__dirname, '..', '..', 'storage', 'data');
  const primary = path.join(dataDir, fileName);
  if (fs.existsSync(primary)) return primary;
  return path.join(__dirname, '..', 'data', fileName);
};

const ensureTableFactory = (target, status) => async function ensureTable(tableName, createSql) {
  const existed = await tableExists(target, tableName);
  await target.query(createSql);
  status.tablesChecked.push(tableName);
  if (!existed) status.tablesCreated.push(tableName);
  console.log(`AUTO MIGRATION TABLE OK: ${tableName}`);
};

const ensureColumnFactory = (target, status) => async function ensureColumn(tableName, columnName, columnDefinition) {
  const exists = await columnExists(target, tableName, columnName);
  if (exists) return;
  await target.query(`ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(columnName)} ${columnDefinition}`);
  status.columnsAdded.push(`${tableName}.${columnName}`);
  console.log(`AUTO MIGRATION COLUMN ADDED: ${tableName}.${columnName}`);
};

const ensureIndexFactory = (target, status) => async function ensureIndex(tableName, indexName, indexSql) {
  const exists = await indexExists(target, tableName, indexName);
  if (exists) return;
  try {
    await target.query(indexSql);
    status.indexesAdded.push(`${tableName}.${indexName}`);
  } catch (error) {
    if (/duplicate|already exists/i.test(String(error.message || ''))) return;
    throw error;
  }
};

const addUniqueExternalIndexSafely = async (target, ensureIndex, tableName) => {
  if (!(await columnExists(target, tableName, 'external_id'))) return;
  await ensureIndex(tableName, `uk_${tableName}_external_id`, `CREATE UNIQUE INDEX ${quoteIdent(`uk_${tableName}_external_id`)} ON ${quoteIdent(tableName)} (external_id)`);
};

const upsertPayloadRow = async (target, tableName, externalId, columns, payload) => {
  const normalizedId = normalizeText(externalId);
  if (!normalizedId) return false;
  const tableColumns = await query(
    target,
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  const available = new Set((tableColumns || []).map((row) => String(row.COLUMN_NAME || '')));
  const candidate = { external_id: normalizedId, ...(columns || {}), payload: toJson(payload) };
  const insertColumns = Object.keys(candidate).filter((key) => available.has(key));
  if (!insertColumns.includes('external_id')) return false;
  const values = insertColumns.map((key) => candidate[key]);
  const updateColumns = insertColumns.filter((key) => key !== 'external_id');
  await target.query(
    `INSERT INTO ${quoteIdent(tableName)} (${insertColumns.map(quoteIdent).join(', ')})
     VALUES (${insertColumns.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${updateColumns.map((key) => `${quoteIdent(key)}=VALUES(${quoteIdent(key)})`).join(', ')}`,
    values
  );
  return true;
};

const migratePayrollJsonToMysql = async (target) => {
  const counts = {};
  const migrateArray = async (fileName, tableName, mapper) => {
    const rows = readJsonFile(resolveDataFile(fileName), []);
    const list = Array.isArray(rows) ? rows : [];
    let count = 0;
    for (const row of list) {
      const mapped = mapper(row || {});
      if (await upsertPayloadRow(target, tableName, mapped.externalId, mapped.columns, row)) count += 1;
    }
    counts[tableName] = count;
  };

  await migrateArray('salary_structures.json', 'payroll_salary_structures', (row) => ({
    externalId: row._id || `${row.employeeId || row.employee_id || 'employee'}-${row.effectiveDate || 'salary'}`,
    columns: {
      employee_id: row.employeeId || row.employee_id || null,
      employee_code: row.employeeCode || row.employee_code || null,
      employee_name: row.employeeName || row.employee_name || null,
      effective_date: toDate(row.effectiveDate || row.effective_date),
      salary_type: row.salaryType || row.salary_type || null,
      basic_salary: toNumber(row.basicSalary || row.basic_salary, 0),
      gross_salary: toNumber(row.grossSalary || row.gross_salary || row.basicSalary, 0),
      deductions_total: toNumber(row.deductions?.total || row.deductions_total, 0),
      net_salary: toNumber(row.netSalary || row.net_salary || row.basicSalary, 0),
      is_active: row.isActive === false ? 0 : 1
    }
  }));

  await migrateArray('payroll_items.json', 'payroll_items', (row) => ({
    externalId: row._id || row.external_id || row.payrollKey || `${row.employeeId || 'employee'}-${row.month || 'm'}-${row.year || 'y'}`,
    columns: {
      payroll_key: row.payrollKey || row.payroll_key || null,
      employee_id: row.employeeId || row.employee_id || null,
      employee_code: row.employeeCode || row.employee_code || null,
      employee_name: row.employeeName || row.employee_name || null,
      month: toNumber(row.month, null),
      year: toNumber(row.year, null),
      basic_salary: toNumber(row.basicSalary || row.basic_salary, 0),
      gross_salary: toNumber(row.grossSalary || row.gross_salary, 0),
      deductions_total: toNumber(row.deductions?.total || row.deductions_total, 0),
      net_salary: toNumber(row.netSalary || row.net_salary, 0),
      payment_status: row.paymentStatus || row.payment_status || null,
      payroll_status: row.payrollStatus || row.payroll_status || null,
      is_locked: row.isLocked || row.is_locked ? 1 : 0
    }
  }));

  const runsPayload = readJsonFile(resolveDataFile('payroll_runs.json'), { config: {}, runs: [] });
  const runs = Array.isArray(runsPayload) ? runsPayload : (Array.isArray(runsPayload.runs) ? runsPayload.runs : []);
  let runCount = 0;
  if (!Array.isArray(runsPayload)) {
    await upsertPayloadRow(target, 'payroll_runs', 'payroll-config', { run_key: 'payroll-config', status: 'Config' }, runsPayload);
    runCount += 1;
  }
  for (const run of runs) {
    const externalId = run._id || run.external_id || run.runKey || stableExternalId('RUN', run);
    if (await upsertPayloadRow(target, 'payroll_runs', externalId, {
      run_key: run.runKey || run.run_key || externalId,
      month: toNumber(run.month, null),
      year: toNumber(run.year, null),
      status: run.status || null,
      generated_by: run.generatedBy || run.actor || null,
      generated_at: toDateTime(run.generatedAt || run.createdAt),
      total_employees: toNumber(run.totalEmployees, null),
      gross_total: toNumber(run.grossTotal, null),
      net_total: toNumber(run.netTotal, null)
    }, run)) runCount += 1;
  }
  counts.payroll_runs = runCount;

  await migrateArray('advance_salaries.json', 'payroll_advances', (row) => ({
    externalId: row._id || stableExternalId('ADV', row),
    columns: {
      employee_id: row.employeeId || null,
      employee_code: row.employeeCode || null,
      employee_name: row.employeeName || null,
      issued_date: toDate(row.issuedDate),
      amount: toNumber(row.amount, 0),
      recovered_amount: toNumber(row.recoveredAmount, 0),
      balance_amount: toNumber(row.balanceAmount, 0),
      monthly_deduction: toNumber(row.monthlyDeduction, 0),
      status: row.status || null
    }
  }));

  await migrateArray('payroll_holidays.json', 'payroll_holidays', (row) => ({
    externalId: row._id || row.date || row.holidayDate || stableExternalId('HOL', row),
    columns: {
      holiday_date: toDate(row.date || row.holidayDate),
      title: row.title || row.name || null,
      type: row.type || null,
      notes: row.notes || null
    }
  }));

  await migrateArray('salary_payments.json', 'payroll_salary_payments', (row) => ({
    externalId: row._id || stableExternalId('PAY', row),
    columns: {
      payroll_item_id: row.payrollItemId || row.payroll_item_id || null,
      employee_id: row.employeeId || null,
      employee_code: row.employeeCode || null,
      employee_name: row.employeeName || null,
      payment_date: toDate(row.paymentDate),
      payment_mode: row.paymentMode || null,
      transaction_ref: row.transactionRef || null,
      amount: toNumber(row.amount, 0)
    }
  }));

  await migrateArray('payroll_audit.json', 'payroll_audit', (row) => ({
    externalId: row._id || stableExternalId('AUDIT', row),
    columns: {
      actor: row.actor || row.createdBy || null,
      actor_employee_id: row.actorEmployeeId || null,
      action: row.action || null,
      entity_type: row.entityType || null,
      entity_id: row.entityId || null,
      message: row.message || row.reason || null
    }
  }));

  return counts;
};

const migrateCustomerPremises = async (target) => {
  if (!(await tableExists(target, 'customers')) || !(await tableExists(target, 'customer_premises'))) return 0;
  const [result] = await target.query(`
    INSERT INTO customer_premises (
      premise_id, customer_id, premise_label, premise_type, contact_person, phone, email, address,
      area_name, city, state, pincode, country, gstin, place_of_supply, is_default, is_billing, is_shipping, is_active, payload
    )
    SELECT
      CONCAT('PREM-', COALESCE(c.external_id, c.id), '-MAIN'),
      c.id,
      'Main / Billing Address',
      'Billing',
      COALESCE(c.contact_person_name, c.customer_name, c.display_name, ''),
      COALESCE(c.mobile_number, ''),
      COALESCE(c.email_id, ''),
      COALESCE(
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingAddress')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.shippingAddress')), ''),
        'Address not provided'
      ),
      COALESCE(c.area_name, JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingArea')), ''),
      COALESCE(c.city, ''),
      COALESCE(c.state, JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingState')), ''),
      COALESCE(c.pincode, JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingPincode')), ''),
      'India',
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.gstNumber')), ''),
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.placeOfSupply')), c.state, ''),
      1,
      1,
      0,
      1,
      c.payload
    FROM customers c
    LEFT JOIN customer_premises cp ON cp.customer_id = c.id AND cp.is_active = 1
    WHERE cp.id IS NULL
      AND COALESCE(
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingAddress')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.shippingAddress')), ''),
        NULLIF(c.area_name, ''),
        NULLIF(c.state, '')
      ) IS NOT NULL
  `);
  return Number(result?.affectedRows || 0);
};

const syncPayrollJsonFilesToMysql = async (poolOrConnection) => {
  const target = await getQueryTarget(poolOrConnection);
  return migratePayrollJsonToMysql(target);
};

async function runAutoMigrations(poolOrConnection) {
  if (global.__AUTO_MIGRATIONS_COMPLETED__) {
    console.log('AUTO MIGRATION SKIPPED: already completed in this process');
    return lastMigrationStatus;
  }
  if (global.__AUTO_MIGRATIONS_RUNNING__) {
    console.log('AUTO MIGRATION SKIPPED: already running in this process');
    return lastMigrationStatus;
  }

  global.__AUTO_MIGRATIONS_RUNNING__ = true;
  const status = defaultStatus();
  lastMigrationStatus = status;
  status.startedAt = new Date().toISOString();
  console.log('AUTO MIGRATION STARTED');

  try {
    const target = await getQueryTarget(poolOrConnection);
    const ensureTable = ensureTableFactory(target, status);
    const ensureColumn = ensureColumnFactory(target, status);
    const ensureIndex = ensureIndexFactory(target, status);

    for (const definition of tableDefinitions) {
      try {
        await ensureTable(definition.name, definition.createSql);
        const columns = tableColumnDefinitions.get(definition.name) || {};
        for (const [columnName, columnDefinition] of Object.entries(columns)) {
          await ensureColumn(definition.name, columnName, columnDefinition);
        }
        await addUniqueExternalIndexSafely(target, ensureIndex, definition.name);
        if (definition.indexes) {
          for (const [indexName, indexSql] of Object.entries(definition.indexes)) {
            await ensureIndex(definition.name, indexName, indexSql);
          }
        }
      } catch (error) {
        status.errors.push({ table: definition.name, error: error.message });
        console.error(`AUTO MIGRATION ERROR ${definition.name}:`, error.message);
      }
    }

    try {
      status.payrollRowsMigrated = await migratePayrollJsonToMysql(target);
    } catch (error) {
      status.errors.push({ step: 'payroll_json_to_mysql', error: error.message });
      console.error('AUTO MIGRATION PAYROLL JSON ERROR:', error.message);
    }

    try {
      const migratedPremises = await migrateCustomerPremises(target);
      if (migratedPremises) status.tablesChecked.push(`customer_premises:migrated:${migratedPremises}`);
    } catch (error) {
      status.errors.push({ step: 'customer_premises_migration', error: error.message });
      console.error('AUTO MIGRATION CUSTOMER PREMISES ERROR:', error.message);
    }

    status.success = status.errors.length === 0;
    status.completedAt = new Date().toISOString();
    console.log('AUTO MIGRATION COMPLETED');
    return status;
  } catch (error) {
    status.success = false;
    status.completedAt = new Date().toISOString();
    status.errors.push({ step: 'startup', error: error.message });
    console.error('AUTO MIGRATION FAILED:', error.message);
    return status;
  } finally {
    global.__AUTO_MIGRATIONS_COMPLETED__ = true;
    global.__AUTO_MIGRATIONS_RUNNING__ = false;
  }
}

const getLastMigrationStatus = () => lastMigrationStatus;

module.exports = {
  runAutoMigrations,
  syncPayrollJsonFilesToMysql,
  getLastMigrationStatus
};
