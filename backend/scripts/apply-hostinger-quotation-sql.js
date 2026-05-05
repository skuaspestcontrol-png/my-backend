const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const run = async () => {
  const sqlPath = path.join(__dirname, '..', 'db', 'hostinger_quotation_module.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  if (!sql.trim()) {
    throw new Error('SQL file is empty');
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || process.env.DB_HOST,
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log('Hostinger quotation SQL applied successfully.');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('Failed to apply Hostinger quotation SQL:', error.message);
  process.exit(1);
});
