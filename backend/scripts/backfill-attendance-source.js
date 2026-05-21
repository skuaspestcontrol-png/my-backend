const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const run = async () => {
  const host = process.env.MYSQL_HOST || process.env.DB_HOST;
  const user = process.env.MYSQL_USER || process.env.DB_USER;
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME;
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);

  const missing = [];
  if (!host) missing.push('MYSQL_HOST/DB_HOST');
  if (!user) missing.push('MYSQL_USER/DB_USER');
  if (!database) missing.push('MYSQL_DATABASE/DB_NAME');
  if (missing.length) {
    throw new Error(`Missing DB env vars: ${missing.join(', ')}`);
  }

  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true
  });

  try {
    await connection.query(`
      UPDATE attendance
      SET
        source = 'admin',
        payload = CASE
          WHEN payload IS NULL THEN payload
          WHEN JSON_VALID(payload) THEN JSON_SET(payload, '$.source', 'admin')
          ELSE payload
        END
      WHERE source IS NULL OR source = '' OR LOWER(source) IN ('manual_admin', 'manual admin')
    `);

    console.log('Attendance source backfill completed successfully.');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  const details = {
    message: error?.message || 'Unknown error',
    code: error?.code || '',
    errno: error?.errno || '',
    sqlState: error?.sqlState || '',
    sqlMessage: error?.sqlMessage || ''
  };
  console.error('Failed to backfill attendance source fields:', details);
  process.exit(1);
});
