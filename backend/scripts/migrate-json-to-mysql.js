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
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

const toJson = (v) => JSON.stringify(v || {});

// ================= EMPLOYEES FIXED =================

const upsertEmployees = async (conn) => {
  const rows = readJsonArray('employees.json');

  for (const emp of rows) {
    const externalId = text(emp._id);

    await conn.query(
      `INSERT INTO employees (
        external_id, emp_code, first_name, last_name, full_name,
        mobile, email, role, role_name, salary,
        joining_date, city, pincode, status, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        emp_code=VALUES(emp_code),
        first_name=VALUES(first_name),
        last_name=VALUES(last_name),
        full_name=VALUES(full_name),
        mobile=VALUES(mobile),
        email=VALUES(email),
        role=VALUES(role),
        role_name=VALUES(role_name),
        salary=VALUES(salary),
        joining_date=VALUES(joining_date),
        city=VALUES(city),
        pincode=VALUES(pincode),
        status=VALUES(status),
        payload=VALUES(payload)
      `,
      [
        externalId,
        text(emp.empCode),
        text(emp.firstName),
        text(emp.lastName),
        `${emp.firstName || ''} ${emp.lastName || ''}`,
        text(emp.mobile),
        text(emp.email || emp.emailId),
        text(emp.role),
        text(emp.roleName),
        Number(emp.salaryPerMonth || emp.salary || 0),
        toDate(emp.dateOfJoining),
        text(emp.city),
        text(emp.pincode),
        emp.portalAccess === "Yes" ? "Active" : "Inactive",
        toJson(emp)
      ]
    );
  }

  return rows.length;
};

// ================= MAIN =================

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

    console.log("✅ Employees migrated:", employeeCount);
  } finally {
    await conn.end();
  }
};

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
});