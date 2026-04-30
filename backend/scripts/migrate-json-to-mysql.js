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

const text = (value) => {
  const str = String(value ?? '').trim();
  return str || null;
};

const toDate = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const toDateTime = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const toTime = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hh = String(Math.min(23, Number(match[1]))).padStart(2, '0');
  const mm = String(Math.min(59, Number(match[2]))).padStart(2, '0');
  const ss = String(Math.min(59, Number(match[3] || 0))).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toJson = (value) => JSON.stringify(value ?? {});

const upsertCustomers = async (conn) => {
  const rows = readJsonArray('customers.json');
  for (const row of rows) {
    const externalId = text(row._id) || `customer-${Date.now()}-${Math.random()}`;
    await conn.query(
      `INSERT INTO customers (
        external_id, display_name, customer_name, company_name, contact_person_name,
        mobile_number, whatsapp_number, email_id, area_name, city, state, pincode,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        display_name=VALUES(display_name),
        customer_name=VALUES(customer_name),
        company_name=VALUES(company_name),
        contact_person_name=VALUES(contact_person_name),
        mobile_number=VALUES(mobile_number),
        whatsapp_number=VALUES(whatsapp_number),
        email_id=VALUES(email_id),
        area_name=VALUES(area_name),
        city=VALUES(city),
        state=VALUES(state),
        pincode=VALUES(pincode),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        externalId,
        text(row.displayName || row.name),
        text(row.name || row.customerName || row.displayName),
        text(row.companyName),
        text(row.contactPersonName),
        text(row.mobileNumber || row.workPhone),
        text(row.whatsappNumber),
        text(row.emailId || row.email),
        text(row.billingArea || row.area),
        text(row.city || row.billingCity),
        text(row.state || row.billingState),
        text(row.pincode || row.billingPincode),
        toJson(row),
        toDateTime(row.createdAt || row.date),
        toDateTime(row.updatedAt || row.modifiedAt)
      ]
    );
  }
  return rows.length;
};

const upsertEmployees = async (conn) => {
  const rows = readJsonArray('employees.json');
  for (const row of rows) {
    const externalId = text(row._id) || `employee-${Date.now()}-${Math.random()}`;
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
        source_updated_at=VALUES(source_updated_at)`,
      [
        externalId,
        text(row.empCode),
        text(row.firstName),
        text(row.lastName),
        text(row.role),
        text(row.roleName),
        text(row.mobile),
        text(row.email || row.emailId),
        text(row.city),
        text(row.pincode),
        toJson(row),
        toDateTime(row.createdAt || row.dateOfJoining),
        toDateTime(row.updatedAt || row.modifiedAt)
      ]
    );
  }
  return rows.length;
};

const upsertLeads = async (conn) => {
  const rows = readJsonArray('leads.json');
  for (const row of rows) {
    const externalId = text(row._id) || `lead-${Date.now()}-${Math.random()}`;
    await conn.query(
      `INSERT INTO leads (
        external_id, customer_name, display_name, company_name, contact_person_name, title,
        mobile, whatsapp_number, email_id, address, area_name, city, state, pincode,
        pest_issue, lead_source, lead_status, assigned_to, followup_date,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_name=VALUES(customer_name),
        display_name=VALUES(display_name),
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
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        externalId,
        text(row.customerName),
        text(row.displayName || row.customerName),
        text(row.companyName),
        text(row.contactPersonName),
        text(row.title || row.position),
        text(row.mobile || row.mobileNumber),
        text(row.whatsappNumber),
        text(row.emailId),
        text(row.address),
        text(row.areaName || row.area),
        text(row.city),
        text(row.state),
        text(row.pincode || row.pinCode),
        text(row.pestIssue),
        text(row.leadSource),
        text(row.status || row.leadStatus),
        text(row.assignedTo),
        toDate(row.followupDate),
        toJson(row),
        toDateTime(row.date || row.createdAt),
        toDateTime(row.updatedAt || row.modifiedAt)
      ]
    );
  }
  return rows.length;
};

const upsertInvoices = async (conn) => {
  const rows = readJsonArray('invoices.json');
  let itemCount = 0;
  for (const row of rows) {
    const externalId = text(row._id) || `invoice-${Date.now()}-${Math.random()}`;
    await conn.query(
      `INSERT INTO invoices (
        external_id, customer_external_id, customer_name, invoice_number, invoice_type, invoice_status,
        invoice_date, due_date, total_amount, balance_due,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_external_id=VALUES(customer_external_id),
        customer_name=VALUES(customer_name),
        invoice_number=VALUES(invoice_number),
        invoice_type=VALUES(invoice_type),
        invoice_status=VALUES(invoice_status),
        invoice_date=VALUES(invoice_date),
        due_date=VALUES(due_date),
        total_amount=VALUES(total_amount),
        balance_due=VALUES(balance_due),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        externalId,
        text(row.customerId),
        text(row.customerName),
        text(row.invoiceNumber),
        text(row.invoiceType),
        text(row.status),
        toDate(row.date),
        toDate(row.dueDate),
        toNum(row.total || row.amount),
        toNum(row.balanceDue),
        toJson(row),
        toDateTime(row.createdAt || row.date),
        toDateTime(row.updatedAt || row.modifiedAt)
      ]
    );

    const items = Array.isArray(row.items) ? row.items : [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await conn.query(
        `INSERT INTO invoice_items (
          invoice_external_id, line_index, item_id, item_name, description, quantity, rate, tax_rate, amount, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          item_id=VALUES(item_id),
          item_name=VALUES(item_name),
          description=VALUES(description),
          quantity=VALUES(quantity),
          rate=VALUES(rate),
          tax_rate=VALUES(tax_rate),
          amount=VALUES(amount),
          payload=VALUES(payload)`,
        [
          externalId,
          i,
          text(item.itemId),
          text(item.itemName || item.name),
          text(item.description),
          toNum(item.quantity),
          toNum(item.rate),
          toNum(item.taxRate),
          toNum(item.amount || (Number(item.quantity || 0) * Number(item.rate || 0))),
          toJson(item)
        ]
      );
      itemCount += 1;
    }
  }
  return { rows: rows.length, itemRows: itemCount };
};

const upsertJobs = async (conn) => {
  const rows = readJsonArray('jobs.json');
  for (const row of rows) {
    const externalId = text(row._id) || `job-${Date.now()}-${Math.random()}`;
    await conn.query(
      `INSERT INTO jobs (
        external_id, customer_external_id, invoice_external_id, customer_name, job_number, status,
        service_name, service_type, area_name, city, state, pincode, scheduled_date, scheduled_time,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_external_id=VALUES(customer_external_id),
        invoice_external_id=VALUES(invoice_external_id),
        customer_name=VALUES(customer_name),
        job_number=VALUES(job_number),
        status=VALUES(status),
        service_name=VALUES(service_name),
        service_type=VALUES(service_type),
        area_name=VALUES(area_name),
        city=VALUES(city),
        state=VALUES(state),
        pincode=VALUES(pincode),
        scheduled_date=VALUES(scheduled_date),
        scheduled_time=VALUES(scheduled_time),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        externalId,
        text(row.customerId),
        text(row.invoiceId),
        text(row.customerName),
        text(row.jobNumber),
        text(row.status),
        text(row.serviceName || row.itemName),
        text(row.serviceType || row.propertyType),
        text(row.areaName || row.area),
        text(row.city),
        text(row.state),
        text(row.pincode),
        toDate(row.scheduledDate || row.scheduleDate),
        text(row.scheduledTime || row.scheduleTime),
        toJson(row),
        toDateTime(row.createdAt || row.date),
        toDateTime(row.updatedAt || row.modifiedAt)
      ]
    );
  }
  return rows.length;
};

const upsertAttendance = async (conn) => {
  const rows = readJsonArray('attendance.json');
  for (const row of rows) {
    const externalId = text(row._id) || `attendance-${Date.now()}-${Math.random()}`;
    await conn.query(
      `INSERT INTO attendance (
        external_id, employee_external_id, employee_code, employee_name, attendance_date,
        status, check_in, check_out, working_hours,
        payload, source_created_at, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        employee_external_id=VALUES(employee_external_id),
        employee_code=VALUES(employee_code),
        employee_name=VALUES(employee_name),
        attendance_date=VALUES(attendance_date),
        status=VALUES(status),
        check_in=VALUES(check_in),
        check_out=VALUES(check_out),
        working_hours=VALUES(working_hours),
        payload=VALUES(payload),
        source_created_at=VALUES(source_created_at),
        source_updated_at=VALUES(source_updated_at)`,
      [
        externalId,
        text(row.employeeId),
        text(row.employeeCode || row.empCode),
        text(row.employeeName),
        toDate(row.date),
        text(row.status),
        toTime(row.checkIn),
        toTime(row.checkOut),
        toNum(row.workingHours),
        toJson(row),
        toDateTime(row.createdAt || row.updatedAt || row.date),
        toDateTime(row.updatedAt || row.createdAt || row.date)
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
    const customerCount = await upsertCustomers(conn);
    const employeeCount = await upsertEmployees(conn);
    const leadCount = await upsertLeads(conn);
    const invoiceStats = await upsertInvoices(conn);
    const jobCount = await upsertJobs(conn);
    const attendanceCount = await upsertAttendance(conn);

    console.log('MySQL phase-1 migration complete.');
    console.log(`customers: ${customerCount}`);
    console.log(`employees: ${employeeCount}`);
    console.log(`leads: ${leadCount}`);
    console.log(`invoices: ${invoiceStats.rows}`);
    console.log(`invoice_items: ${invoiceStats.itemRows}`);
    console.log(`jobs: ${jobCount}`);
    console.log(`attendance: ${attendanceCount}`);
  } finally {
    await conn.end();
  }
};

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
