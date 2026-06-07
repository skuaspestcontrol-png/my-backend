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

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || process.env.DB_HOST,
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306)
  });

  try {
    const [rows] = await connection.query(
      `SELECT id, external_id, joining_date, payload
       FROM employees
       ORDER BY id ASC`
    );

    let inspected = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of Array.isArray(rows) ? rows : []) {
      inspected += 1;

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

      const currentColumn = normalizeDateOnly(row?.joining_date);
      const payloadDate = normalizeDateOnly(payload.dateOfJoining || payload.joiningDate || '');
      const nextDate = payloadDate || currentColumn;
      if (!nextDate) {
        skipped += 1;
        continue;
      }

      const nextPayload = {
        ...payload,
        dateOfJoining: nextDate
      };
      const payloadChanged = JSON.stringify(nextPayload) !== JSON.stringify(payload);
      const columnChanged = currentColumn !== nextDate;

      if (!payloadChanged && !columnChanged) continue;

      await connection.query(
        `UPDATE employees
         SET joining_date = ?, payload = ?
         WHERE id = ?`,
        [nextDate, JSON.stringify(nextPayload), row.id]
      );
      updated += 1;
    }

    console.log(`Employee joining-date backfill complete. inspected=${inspected} updated=${updated} skipped=${skipped}`);
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('Employee joining-date backfill failed:', error.message);
  process.exitCode = 1;
});
