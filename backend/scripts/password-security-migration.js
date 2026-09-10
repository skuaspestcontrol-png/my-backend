#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: false, quiet: true });

const { hashPassword, isHash } = require('../lib/passwords');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = !apply || args.has('--dry-run');
const backupConfirmed = args.has('--backup-confirmed');
const includeMysql = args.has('--mysql');

if (apply && !backupConfirmed) {
  console.error('Refusing to run migration without --backup-confirmed. Back up MySQL plus DATA_DIR JSON files first.');
  process.exit(2);
}

const dataDir = path.resolve(__dirname, '..', process.env.DATA_DIR || process.env.PERSISTENT_DATA_DIR || 'data');
const settingsFile = path.join(dataDir, 'settings.json');
const employeesFile = path.join(dataDir, 'employees.json');

const totals = () => ({ total: 0, alreadyHashed: 0, legacyPlaintext: 0, invalidOrMissing: 0, migrated: 0, ids: [] });
const summary = { mode: dryRun ? 'dry-run' : 'apply', jsonSettings: totals(), jsonEmployees: totals(), mysqlSettings: totals(), mysqlEmployees: totals() };

const classify = (value, bucket, id) => {
  bucket.total += 1;
  const text = String(value || '').trim();
  if (!text) bucket.invalidOrMissing += 1;
  else if (isHash(text)) bucket.alreadyHashed += 1;
  else bucket.legacyPlaintext += 1;
  if (id) bucket.ids.push(String(id));
  return text && !isHash(text);
};

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

const writeJson = (file, value) => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};

const migrateJson = async () => {
  const settings = readJson(settingsFile, {});
  if (settings && typeof settings === 'object') {
    if (classify(settings.adminPassword, summary.jsonSettings, 'settings:adminPassword') && !dryRun) {
      settings.adminPassword = await hashPassword(String(settings.adminPassword));
      summary.jsonSettings.migrated += 1;
      writeJson(settingsFile, settings);
    }
  }
  const employees = readJson(employeesFile, []);
  if (Array.isArray(employees)) {
    let changed = false;
    for (const employee of employees) {
      const id = employee?._id || employee?.empCode || 'employee';
      if (classify(employee?.portalPassword ?? employee?.password ?? employee?.portal_password, summary.jsonEmployees, id) && !dryRun) {
        employee.portalPassword = await hashPassword(String(employee.portalPassword ?? employee.password ?? employee.portal_password));
        delete employee.password;
        delete employee.portal_password;
        summary.jsonEmployees.migrated += 1;
        changed = true;
      }
    }
    if (changed) writeJson(employeesFile, employees);
  }
};

const migrateMysql = async () => {
  let db;
  if (!includeMysql) return;
  try { db = require('../lib/db'); } catch { return; }
  if (!process.env.MYSQL_HOST && !process.env.DB_HOST && !process.env.DATABASE_URL) return;
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const [settingsRows] = await conn.query('SELECT id, setting_value FROM app_settings WHERE setting_key = ?', ['main']);
    for (const row of Array.isArray(settingsRows) ? settingsRows : []) {
      const value = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value || '{}') : (row.setting_value || {});
      if (classify(value.adminPassword, summary.mysqlSettings, `app_settings:${row.id}`) && !dryRun) {
        value.adminPassword = await hashPassword(String(value.adminPassword));
        await conn.query('UPDATE app_settings SET setting_value = ? WHERE id = ?', [JSON.stringify(value), row.id]);
        summary.mysqlSettings.migrated += 1;
      }
    }
    const [employeeRows] = await conn.query('SELECT id, external_id, emp_code, password, portal_password, payload FROM employees');
    for (const row of Array.isArray(employeeRows) ? employeeRows : []) {
      const id = row.external_id || row.emp_code || row.id;
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : (row.payload || {});
      const stored = payload.portalPassword ?? row.portal_password ?? row.password;
      if (classify(stored, summary.mysqlEmployees, `employee:${id}`) && !dryRun) {
        const hashed = await hashPassword(String(stored));
        payload.portalPassword = hashed;
        await conn.query('UPDATE employees SET password = ?, portal_password = ?, payload = ? WHERE id = ?', [hashed, hashed, JSON.stringify(payload), row.id]);
        summary.mysqlEmployees.migrated += 1;
      }
    }
    if (dryRun) await conn.rollback();
    else await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

(async () => {
  await migrateJson();
  await migrateMysql();
  for (const bucket of Object.values(summary)) {
    if (bucket && bucket.ids) bucket.ids = bucket.ids.slice(0, 200);
  }
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error('Password migration failed:', error.message);
  process.exit(1);
});
