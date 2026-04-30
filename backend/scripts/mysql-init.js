const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const schemaFile = path.join(__dirname, '..', 'db', 'schema.sql');

const run = async () => {
  if (!fs.existsSync(schemaFile)) {
    throw new Error(`Schema file not found: ${schemaFile}`);
  }

  const sql = fs.readFileSync(schemaFile, 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log('MySQL schema initialized successfully.');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('Failed to initialize MySQL schema:', error.message);
  process.exit(1);
});
