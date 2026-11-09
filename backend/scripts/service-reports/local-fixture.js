// Local/disposable QA only. Deliberately never loads .env or application server.js.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const root = "/tmp/skuas-service-reports-phase2";
const socketPath = `${root}/mysql.sock`;
async function setup({ reset = false } = {}) {
  if (!fs.existsSync(socketPath))
    throw new Error(
      "Start the isolated /tmp MySQL instance with --skip-networking first",
    );
  const bootstrap = await mysql.createConnection({
    socketPath,
    user: "root",
    multipleStatements: true,
  });
  const [[server]] = await bootstrap.query(
    "SELECT @@datadir AS datadir, @@skip_networking AS isolated",
  );
  if (
    !server.isolated ||
    fs.realpathSync(server.datadir) !==
      fs.realpathSync(path.join(root, "mysql-data"))
  ) {
    await bootstrap.end();
    throw new Error(
      "Refusing a database outside the networking-disabled disposable data directory",
    );
  }
  const db = "service_reports_phase2_qa";
  // This fixed database name and Unix socket cannot select a production target.
  if (reset) await bootstrap.query(`DROP DATABASE IF EXISTS ${db}`);
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrap.end();
  const pool = mysql.createPool({
    socketPath,
    user: "root",
    database: db,
    multipleStatements: true,
    connectionLimit: 6,
  });
  if (reset) {
    await pool.query(
      `CREATE TABLE customers(id BIGINT PRIMARY KEY,external_id VARCHAR(80),payload JSON);CREATE TABLE jobs(id BIGINT PRIMARY KEY,external_id VARCHAR(80),customer_external_id VARCHAR(80),invoice_external_id VARCHAR(80),payload JSON);CREATE TABLE invoices(id BIGINT PRIMARY KEY,external_id VARCHAR(80),payload JSON);CREATE TABLE contracts(id BIGINT PRIMARY KEY,external_id VARCHAR(80),customer_external_id VARCHAR(80),contract_number VARCHAR(120),payload JSON);CREATE TABLE customer_premises(id INT PRIMARY KEY,premise_id VARCHAR(100),customer_id INT,premise_label VARCHAR(255),address_line_1 TEXT,area_name VARCHAR(255),city VARCHAR(100),state VARCHAR(100),pincode VARCHAR(20),contact_person VARCHAR(255),mobile VARCHAR(50),email VARCHAR(255),is_active TINYINT);CREATE TABLE employees(id BIGINT PRIMARY KEY,external_id VARCHAR(80),full_name VARCHAR(255),emp_code VARCHAR(120),payload JSON);CREATE TABLE items(id BIGINT PRIMARY KEY,external_id VARCHAR(80),payload JSON)`,
    );
    await pool.query("INSERT INTO customers VALUES (1,?,?),(2,?,?)", [
      "QA-CUSTOMER-1",
      JSON.stringify({
        displayName: "QA Example Customer — SYNTHETIC",
        shippingAddress: "100 Synthetic Test Lane, QA City 110001",
        contactPersonName: "QA Representative",
        emailId: "customer@example.invalid",
        mobileNumber: "9000000000",
      }),
      "QA-CUSTOMER-2",
      JSON.stringify({ displayName: "QA Unassigned Customer" }),
    ]);
    await pool.query("INSERT INTO jobs VALUES(1,?,?,?,?)", [
      "QA-JOB-1",
      "QA-CUSTOMER-1",
      "QA-INVOICE-1",
      JSON.stringify({
        jobNumber: "QA/JOB/1",
        customerId: "QA-CUSTOMER-1",
        technicianIds: ["QA-EMP-2"],
        serviceType: "General Pest Control",
      }),
    ]);
    await pool.query(
      "INSERT INTO contracts VALUES(1,NULL,'QA-CUSTOMER-1','QA/CONTRACT/1',JSON_OBJECT())",
    );
    await pool.query("INSERT INTO invoices VALUES(3,?,?)", [
      "QA-LEGACY-NON-GST",
      JSON.stringify({
        customerId: "QA-CUSTOMER-1",
        invoiceNumber: "QA/LEGACY/1",
        totalTax: "0.00",
        serviceSchedules: [],
      }),
    ]);
    await pool.query("INSERT INTO invoices VALUES(1,?,?)", [
      "QA-INVOICE-1",
      JSON.stringify({
        customerId: "QA-CUSTOMER-1",
        invoiceNumber: "QA/AMC/1",
        invoiceType: "GST",
        serviceSchedules: [
          {
            serviceDate: "2026-11-07",
            serviceNumber: 1,
            itemName: "General Pest Control",
          },
        ],
      }),
    ]);
    await pool.query("INSERT INTO invoices VALUES(2,?,?)", [
      "QA-INVOICE-NON-GST",
      JSON.stringify({
        customerId: "QA-CUSTOMER-1",
        invoiceNumber: "QA/NON-GST/1",
        invoiceType: "NON GST",
        serviceSchedules: [
          {
            serviceDate: "2026-11-07",
            serviceNumber: 1,
            itemName: "General Pest Control",
          },
        ],
      }),
    ]);
    await pool.query(
      "INSERT INTO customer_premises VALUES(1,'QA-SITE-1',1,'QA Commercial Kitchen','100 Synthetic Test Lane','QA Area','QA City','Delhi','110001','QA Representative','9000000000','customer@example.invalid',1)",
    );
    await pool.query(
      "INSERT INTO employees VALUES(1,'QA-EMP-1','QA Manager','QA001',NULL),(2,'QA-EMP-2','QA Technician','QA002',NULL),(3,'QA-EMP-3','QA Reviewer','QA003',NULL),(4,'QA-EMP-4','QA Other Staff','QA004',NULL)",
    );
    await pool.query("INSERT INTO items VALUES(1,?,?)", [
      "QA-ITEM-1",
      JSON.stringify({ itemName: "General Pest Control", itemType: "Service" }),
    ]);
    const up = fs.readFileSync(
        path.join(__dirname, "../../migrations/service_reports.up.sql"),
        "utf8",
      ),
      down = fs.readFileSync(
        path.join(__dirname, "../../migrations/service_reports.down.sql"),
        "utf8",
      );
    const [before] = await pool.query("SELECT * FROM customers ORDER BY id");
    await pool.query(up);
    await pool.query(down);
    await pool.query(up);
    const [after] = await pool.query("SELECT * FROM customers ORDER BY id");
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Migration changed existing customer data");
    await pool.query(
      "INSERT INTO service_report_permissions(employee_id,capabilities,access_scope,updated_by) VALUES(?,?,?,?),(?,?,?,?),(?,?,?,?)",
      [
        "QA-EMP-2",
        JSON.stringify(["view", "create", "edit", "submit", "pdf", "history"]),
        "assigned",
        "1",
        "QA-EMP-3",
        JSON.stringify(["view", "review", "pdf", "share", "history"]),
        "all",
        "1",
        "QA-EMP-4",
        JSON.stringify(["view", "create", "edit", "submit", "history"]),
        "assigned",
        "1",
      ],
    );
  }
  return pool;
}
function branding() {
  return {
    gstCompanyName: "Skuas Pest Control Private Limited",
    gstBillingAddress: "100 Synthetic QA Address",
    gstCity: "QA City",
    gstState: "Delhi",
    gstPincode: "110001",
    gstEmail: "qa@example.invalid",
    gstPhone: "9000000000",
    companyGstNumber: "QA GST — SYNTHETIC",
    nonGstCompanyName: "SKUAS Non-GST — Synthetic QA Identity",
    nonGstBillingAddress: "200 Synthetic QA Address",
    nonGstCity: "QA City",
    nonGstState: "Delhi",
    nonGstPincode: "110002",
    nonGstEmail: "non-gst@example.invalid",
    nonGstPhone: "9000000000",
    gstCompanyLogoUrl: "official-logo.png",
    nonGstCompanyLogoUrl: "official-logo.png",
    companyWebsite: "www.skuaspestcontrol.com",
    brandingAccentColor: "#1d2547",
    smtpPassword: "CONFIDENTIAL_SECRET_SENTINEL",
    gstBankAccountNumber: "CONFIDENTIAL_BANK_SENTINEL",
  };
}
const logoPath = path.join(
  __dirname,
  "../../test/fixtures/service-reports/official-logo.png",
);
module.exports = { setup, branding, logoPath, root };
