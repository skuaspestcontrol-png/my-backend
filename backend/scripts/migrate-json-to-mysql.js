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
    console.log('Employees migrated:', employeeCount);
    console.log('Leads migrated:', leadCount);
    console.log('Items migrated:', itemCount);
  } finally {
    await conn.end();
  }
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
