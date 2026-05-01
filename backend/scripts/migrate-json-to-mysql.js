/*
SQL (run once if your DB does not already have this table):

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(100) UNIQUE,
  name VARCHAR(255),
  item_type VARCHAR(100),
  treatment_method VARCHAR(255),
  pests_covered TEXT,
  service_description TEXT,
  unit VARCHAR(100),
  sac VARCHAR(100),
  hsn_sac VARCHAR(100),
  tax_preference VARCHAR(100),
  sellable BOOLEAN DEFAULT TRUE,
  purchasable BOOLEAN DEFAULT TRUE,
  sales_account VARCHAR(255),
  purchase_account VARCHAR(255),
  preferred_vendor VARCHAR(255),
  sales_description TEXT,
  purchase_description TEXT,
  purchase_rate DECIMAL(12,2) DEFAULT 0,
  description TEXT,
  rate DECIMAL(12,2) DEFAULT 0,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
*/

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dataDir = path.join(__dirname, '..', 'data');

const readJsonArray = (fileName) => {
  const fullPath = path.join(dataDir, fileName);
  if (!fs.existsSync(fullPath)) return [];
  const raw = fs.readFileSync(fullPath, 'utf8').trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const text = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const toJson = (v) => JSON.stringify(v || {});

const upsertEmployees = async (conn) => {
  const rows = readJsonArray('employees.json');
  for (const emp of rows) {
    await conn.query(
      `INSERT INTO employees (
        external_id, emp_code, first_name, last_name, role, role_name, mobile, email, city, pincode,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        emp_code=VALUES(emp_code),
        first_name=VALUES(first_name),
        last_name=VALUES(last_name),
        role=VALUES(role),
        role_name=VALUES(role_name),
        mobile=VALUES(mobile),
        email=VALUES(email),
        city=VALUES(city),
        pincode=VALUES(pincode),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)
      `,
      [
        text(emp._id),
        text(emp.empCode),
        text(emp.firstName),
        text(emp.lastName),
        text(emp.role),
        text(emp.roleName),
        text(emp.mobile),
        text(emp.email || emp.emailId),
        text(emp.city),
        text(emp.pincode),
        toJson(emp),
        toDate(emp.createdAt || emp.dateOfJoining),
        toDate(emp.updatedAt || emp.createdAt || emp.dateOfJoining)
      ]
    );
  }
  return rows.length;
};

const upsertLeads = async (conn) => {
  const rows = readJsonArray('leads.json');
  for (const lead of rows) {
    await conn.query(
      `INSERT INTO leads (
        external_id, customer_name, company_name, contact_person_name, title,
        mobile, whatsapp_number, email_id, address, area_name, city, state, pincode,
        pest_issue, lead_source, lead_status, assigned_to, followup_date, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_name=VALUES(customer_name),
        company_name=VALUES(company_name),
        contact_person_name=VALUES(contact_person_name),
        title=VALUES(title),
        mobile=VALUES(mobile),
        whatsapp_number=VALUES(whatsapp_number),
        email_id=VALUES(email_id),
        address=VALUES(address),
        area_name=VALUES(area_name),
        city=VALUES(city),
        state=VALUES(state),
        pincode=VALUES(pincode),
        pest_issue=VALUES(pest_issue),
        lead_source=VALUES(lead_source),
        lead_status=VALUES(lead_status),
        assigned_to=VALUES(assigned_to),
        followup_date=VALUES(followup_date),
        payload=VALUES(payload)
      `,
      [
        text(lead._id),
        text(lead.customerName),
        text(lead.companyName),
        text(lead.contactPersonName),
        text(lead.title),
        text(lead.mobile || lead.mobileNumber),
        text(lead.whatsappNumber),
        text(lead.emailId),
        text(lead.address),
        text(lead.areaName || lead.area),
        text(lead.city),
        text(lead.state),
        text(lead.pincode),
        text(lead.pestIssue),
        text(lead.leadSource),
        text(lead.status || lead.leadStatus),
        text(lead.assignedTo),
        toDate(lead.followupDate),
        toJson(lead)
      ]
    );
  }
  return rows.length;
};

const normalizeItem = (item = {}) => {
  const itemType = String(item.itemType || item.item_type || 'service').trim() || 'service';
  const isServiceItem = itemType.toLowerCase() === 'service';
  return {
    externalId: String(item._id || item.external_id || '').trim() || `ITEM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: String(item.name || '').trim(),
    itemType,
    treatmentMethod: isServiceItem ? String(item.treatmentMethod || item.treatment_method || '').trim() : '',
    pestsCovered: isServiceItem ? String(item.pestsCovered || item.pests_covered || '').trim() : '',
    serviceDescription: isServiceItem ? String(item.serviceDescription || item.service_description || '').trim() : '',
    unit: String(item.unit || '').trim(),
    sac: String(item.sac || '').trim(),
    hsnSac: String(item.hsnSac || item.hsn_sac || '').trim(),
    taxPreference: String(item.taxPreference || item.tax_preference || 'Taxable').trim() || 'Taxable',
    sellable: item.sellable !== false,
    purchasable: item.purchasable !== false,
    salesAccount: String(item.salesAccount || item.sales_account || 'Sales').trim() || 'Sales',
    purchaseAccount: String(item.purchaseAccount || item.purchase_account || 'Cost of Goods Sold').trim() || 'Cost of Goods Sold',
    preferredVendor: String(item.preferredVendor || item.preferred_vendor || '').trim(),
    salesDescription: String(item.salesDescription || item.sales_description || '').trim(),
    purchaseDescription: String(item.purchaseDescription || item.purchase_description || '').trim(),
    purchaseRate: Number(item.purchaseRate || item.purchase_rate || 0),
    description: String(item.description || '').trim(),
    rate: Number(item.rate || 0)
  };
};

const upsertItems = async (conn) => {
  const rows = readJsonArray('items.json');
  for (const raw of rows) {
    const item = normalizeItem(raw);
    const payload = {
      ...raw,
      _id: item.externalId,
      itemType: item.itemType,
      treatmentMethod: item.treatmentMethod,
      pestsCovered: item.pestsCovered,
      serviceDescription: item.serviceDescription,
      hsnSac: item.hsnSac,
      taxPreference: item.taxPreference,
      sellable: item.sellable,
      purchasable: item.purchasable,
      salesAccount: item.salesAccount,
      purchaseAccount: item.purchaseAccount,
      preferredVendor: item.preferredVendor,
      salesDescription: item.salesDescription,
      purchaseDescription: item.purchaseDescription,
      purchaseRate: item.purchaseRate,
      description: item.description,
      rate: item.rate
    };

    await conn.query(
      `INSERT INTO items (
        external_id, name, item_type, treatment_method, pests_covered, service_description,
        unit, sac, hsn_sac, tax_preference, sellable, purchasable, sales_account, purchase_account,
        preferred_vendor, sales_description, purchase_description, purchase_rate, description, rate, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name=VALUES(name),
        item_type=VALUES(item_type),
        treatment_method=VALUES(treatment_method),
        pests_covered=VALUES(pests_covered),
        service_description=VALUES(service_description),
        unit=VALUES(unit),
        sac=VALUES(sac),
        hsn_sac=VALUES(hsn_sac),
        tax_preference=VALUES(tax_preference),
        sellable=VALUES(sellable),
        purchasable=VALUES(purchasable),
        sales_account=VALUES(sales_account),
        purchase_account=VALUES(purchase_account),
        preferred_vendor=VALUES(preferred_vendor),
        sales_description=VALUES(sales_description),
        purchase_description=VALUES(purchase_description),
        purchase_rate=VALUES(purchase_rate),
        description=VALUES(description),
        rate=VALUES(rate),
        payload=VALUES(payload)
      `,
      [
        item.externalId,
        item.name,
        item.itemType,
        item.treatmentMethod,
        item.pestsCovered,
        item.serviceDescription,
        item.unit,
        item.sac,
        item.hsnSac,
        item.taxPreference,
        item.sellable ? 1 : 0,
        item.purchasable ? 1 : 0,
        item.salesAccount,
        item.purchaseAccount,
        item.preferredVendor,
        item.salesDescription,
        item.purchaseDescription,
        Number.isFinite(item.purchaseRate) ? item.purchaseRate : 0,
        item.description,
        Number.isFinite(item.rate) ? item.rate : 0,
        toJson(payload)
      ]
    );
  }
  return rows.length;
};

const ensureVendorFinanceTables = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      vendor_name VARCHAR(255) NULL,
      company_name VARCHAR(255) NULL,
      contact_person_name VARCHAR(255) NULL,
      mobile VARCHAR(50) NULL,
      whatsapp_number VARCHAR(50) NULL,
      email_id VARCHAR(255) NULL,
      gst_number VARCHAR(80) NULL,
      address TEXT NULL,
      area_name VARCHAR(255) NULL,
      city VARCHAR(120) NULL,
      state VARCHAR(120) NULL,
      pincode VARCHAR(40) NULL,
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(80) NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_vendors_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS vendor_bills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      vendor_external_id VARCHAR(120) NULL,
      vendor_name VARCHAR(255) NULL,
      bill_number VARCHAR(255) NULL,
      bill_date DATE NULL,
      due_date DATE NULL,
      status VARCHAR(80) NULL,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      balance_due DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_vendor_bills_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS vendor_bill_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bill_external_id VARCHAR(120) NOT NULL,
      line_index INT NOT NULL DEFAULT 0,
      item_name VARCHAR(255) NULL,
      description TEXT NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      rate DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_vendor_bill_items_bill_external_id (bill_external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS payment_received (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(120) NOT NULL,
      customer_external_id VARCHAR(120) NULL,
      customer_name VARCHAR(255) NULL,
      payment_date DATE NULL,
      payment_mode VARCHAR(120) NULL,
      reference_number VARCHAR(255) NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      linked_invoice_external_id VARCHAR(120) NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_payment_received_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const upsertVendors = async (conn) => {
  await ensureVendorFinanceTables(conn);
  const rows = readJsonArray('vendors.json');
  for (const vendor of rows) {
    const externalId = text(vendor._id) || `VND-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await conn.query(
      `INSERT INTO vendors (
        external_id, vendor_name, company_name, contact_person_name, mobile, whatsapp_number, email_id, gst_number,
        address, area_name, city, state, pincode, opening_balance, status, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        vendor_name=VALUES(vendor_name),
        company_name=VALUES(company_name),
        contact_person_name=VALUES(contact_person_name),
        mobile=VALUES(mobile),
        whatsapp_number=VALUES(whatsapp_number),
        email_id=VALUES(email_id),
        gst_number=VALUES(gst_number),
        address=VALUES(address),
        area_name=VALUES(area_name),
        city=VALUES(city),
        state=VALUES(state),
        pincode=VALUES(pincode),
        opening_balance=VALUES(opening_balance),
        status=VALUES(status),
        payload=VALUES(payload)`,
      [
        externalId,
        text(vendor.vendorName || vendor.displayName || vendor.companyName),
        text(vendor.companyName),
        text(vendor.contactPersonName),
        text(vendor.mobileNumber || vendor.mobile),
        text(vendor.whatsappNumber),
        text(vendor.emailId),
        text(vendor.gstNumber),
        text(vendor.billingAddress || vendor.address),
        text(vendor.billingArea || vendor.areaName),
        text(vendor.city),
        text(vendor.state || vendor.billingState),
        text(vendor.billingPincode || vendor.pincode),
        Number(vendor.openingBalance || 0) || 0,
        text(vendor.status || 'active'),
        toJson({ ...vendor, _id: externalId })
      ]
    );
  }
  return rows.length;
};

const upsertVendorBills = async (conn) => {
  await ensureVendorFinanceTables(conn);
  const rows = readJsonArray('vendor_bills.json');
  let itemCount = 0;
  for (const bill of rows) {
    const externalId = text(bill._id) || `VBL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payload = { ...bill, _id: externalId };
    await conn.query(
      `INSERT INTO vendor_bills (
        external_id, vendor_external_id, vendor_name, bill_number, bill_date, due_date, status, subtotal, tax_amount, total_amount, balance_due, notes, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        vendor_external_id=VALUES(vendor_external_id),
        vendor_name=VALUES(vendor_name),
        bill_number=VALUES(bill_number),
        bill_date=VALUES(bill_date),
        due_date=VALUES(due_date),
        status=VALUES(status),
        subtotal=VALUES(subtotal),
        tax_amount=VALUES(tax_amount),
        total_amount=VALUES(total_amount),
        balance_due=VALUES(balance_due),
        notes=VALUES(notes),
        payload=VALUES(payload)`,
      [
        externalId,
        text(payload.vendorId),
        text(payload.vendorName),
        text(payload.billNumber),
        toDate(payload.date),
        toDate(payload.dueDate),
        text(payload.status),
        Number(payload.subtotal || 0) || 0,
        Number(payload.totalTax || payload.taxAmount || 0) || 0,
        Number(payload.amount || payload.total || 0) || 0,
        Number(payload.balanceDue || 0) || 0,
        text(payload.notes),
        toJson(payload)
      ]
    );
    await conn.query('DELETE FROM vendor_bill_items WHERE bill_external_id = ?', [externalId]);
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] && typeof items[index] === 'object' ? items[index] : {};
      await conn.query(
        `INSERT INTO vendor_bill_items (
          bill_external_id, line_index, item_name, description, quantity, rate, tax_rate, amount, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          externalId,
          index,
          text(item.itemName),
          text(item.description),
          Number(item.quantity || 0) || 0,
          Number(item.rate || 0) || 0,
          Number(item.taxRate || 0) || 0,
          Number(item.amount || 0) || 0,
          toJson(item)
        ]
      );
      itemCount += 1;
    }
  }
  return { bills: rows.length, items: itemCount };
};

const upsertPaymentReceived = async (conn) => {
  await ensureVendorFinanceTables(conn);
  const rows = readJsonArray('payment_received.json');
  for (const payment of rows) {
    const externalId = text(payment._id) || `PR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await conn.query(
      `INSERT INTO payment_received (
        external_id, customer_external_id, customer_name, payment_date, payment_mode, reference_number, amount, notes, linked_invoice_external_id, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_external_id=VALUES(customer_external_id),
        customer_name=VALUES(customer_name),
        payment_date=VALUES(payment_date),
        payment_mode=VALUES(payment_mode),
        reference_number=VALUES(reference_number),
        amount=VALUES(amount),
        notes=VALUES(notes),
        linked_invoice_external_id=VALUES(linked_invoice_external_id),
        payload=VALUES(payload)`,
      [
        externalId,
        text(payment.customerId || payment.customerExternalId),
        text(payment.customerName),
        toDate(payment.paymentDate),
        text(payment.mode || payment.paymentMode),
        text(payment.reference || payment.referenceNumber),
        Number(payment.amount || 0) || 0,
        text(payment.notes),
        text(payment.linkedInvoiceId || payment.linkedInvoiceExternalId),
        toJson({ ...payment, _id: externalId })
      ]
    );
  }
  return rows.length;
};

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306)
  });

  try {
    const employeeCount = await upsertEmployees(conn);
    const leadCount = await upsertLeads(conn);
    const itemCount = await upsertItems(conn);
    const vendorCount = await upsertVendors(conn);
    const vendorBillResult = await upsertVendorBills(conn);
    const paymentReceivedCount = await upsertPaymentReceived(conn);
    console.log('Employees migrated:', employeeCount);
    console.log('Leads migrated:', leadCount);
    console.log('Items migrated:', itemCount);
    console.log('Vendors migrated:', vendorCount);
    console.log('Vendor bills migrated:', vendorBillResult.bills);
    console.log('Vendor bill items migrated:', vendorBillResult.items);
    console.log('Payment received migrated:', paymentReceivedCount);
  } finally {
    await conn.end();
  }
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
