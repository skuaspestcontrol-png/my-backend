const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const normalizeDateOnly = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '0000-00-00') return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeEmploymentStatus = (value, fallback = 'Active') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['active', 'working', 'currently working'].includes(raw)) return 'Active';
  if (['resigned', 'left', 'quit'].includes(raw)) return 'Resigned';
  if (['inactive', 'not active', 'disabled'].includes(raw)) return 'Inactive';
  return String(value || fallback).trim();
};

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || process.env.DB_HOST,
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306)
  });

  try {
    await connection.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_status VARCHAR(40) NULL');
    await connection.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_date DATE NULL');
  } catch (_error) {
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees'"
    );
    const names = new Set((Array.isArray(columns) ? columns : []).map((row) => String(row.COLUMN_NAME || '').trim()).filter(Boolean));
    if (!names.has('employment_status')) {
      await connection.query('ALTER TABLE employees ADD COLUMN employment_status VARCHAR(40) NULL');
    }
    if (!names.has('resignation_date')) {
      await connection.query('ALTER TABLE employees ADD COLUMN resignation_date DATE NULL');
    }
  }

  try {
    const [rows] = await connection.query(
      `SELECT id, external_id, joining_date, employment_status, resignation_date, payload
       FROM employees
       ORDER BY id ASC`
    );

    let updated = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
      let payload = {};
      if (row?.payload && typeof row.payload === 'object') {
        payload = row.payload;
      } else if (typeof row?.payload === 'string') {
        try {
          payload = JSON.parse(row.payload);
        } catch (_error) {
          payload = {};
        }
      }

      const payloadStatus = payload.employmentStatus || payload.employment_status || '';
      const payloadResignDate = normalizeDateOnly(payload.resignationDate || payload.resignation_date || '');
      const nextStatus = normalizeEmploymentStatus(
        row.employment_status || payloadStatus || (payloadResignDate ? 'Resigned' : ''),
        'Active'
      );
      const nextResignDate = nextStatus === 'Resigned'
        ? (payloadResignDate || normalizeDateOnly(row.resignation_date || ''))
        : '';
      const nextPayload = {
        ...payload,
        employmentStatus: nextStatus,
        resignationDate: nextResignDate
      };

      const payloadChanged = JSON.stringify(nextPayload) !== JSON.stringify(payload);
      const columnChanged = normalizeEmploymentStatus(row.employment_status || '', 'Active') !== nextStatus
        || normalizeDateOnly(row.resignation_date || '') !== nextResignDate;
      if (!payloadChanged && !columnChanged) continue;

      await connection.query(
        `UPDATE employees
         SET employment_status = ?, resignation_date = ?, payload = ?
         WHERE id = ?`,
        [nextStatus, nextResignDate || null, JSON.stringify(nextPayload), row.id]
      );
      updated += 1;
    }

    console.log(`Employee employment-status backfill complete. updated=${updated}`);
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('Employee employment-status backfill failed:', error.message);
  process.exitCode = 1;
});
