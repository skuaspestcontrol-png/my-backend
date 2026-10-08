const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const autoMigrateSource = fs.readFileSync(path.join(__dirname, '../lib/autoMigrate.js'), 'utf8');
const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/customer_premises.sql'), 'utf8');
const { __test__ } = require('../lib/autoMigrate');

const coordinateDropPattern = /ALTER\s+TABLE\s+customer_premises\s+DROP\s+COLUMN\s+`?(latitude|longitude)`?/i;

function functionBlock(source, functionName) {
  const start = source.indexOf(`const ${functionName} = async`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const next = source.indexOf('\nconst ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('startup customer premises migration preserves existing coordinate columns and values', async () => {
  const queries = [];
  const target = {
    async query(sql, params = []) {
      queries.push({ sql: String(sql), params });
      if (/INFORMATION_SCHEMA\.TABLES/i.test(sql)) return [[{ count: 1 }]];
      if (/INSERT INTO customer_premises/i.test(sql)) return [{ affectedRows: 0 }];
      return [{}];
    }
  };

  const migrated = await __test__.migrateCustomerPremises(target);
  assert.equal(migrated, 0);

  const sqlText = queries.map((entry) => entry.sql).join('\n');
  assert.doesNotMatch(sqlText, coordinateDropPattern);
  assert.doesNotMatch(sqlText, /UPDATE\s+customer_premises[\s\S]*(latitude|longitude)/i);
  assert.doesNotMatch(sqlText, /TRUNCATE\s+TABLE\s+customer_premises/i);
  assert.doesNotMatch(sqlText, /DROP\s+TABLE\s+customer_premises/i);
});

test('startup auto-migration definition creates or adds nullable coordinate columns idempotently', () => {
  assert.match(autoMigrateSource, /latitude\s+DECIMAL\(10,8\)\s+NULL/i);
  assert.match(autoMigrateSource, /longitude\s+DECIMAL\(11,8\)\s+NULL/i);
  assert.match(autoMigrateSource, /latitude:\s*'DECIMAL\(10,8\) NULL'/);
  assert.match(autoMigrateSource, /longitude:\s*'DECIMAL\(11,8\) NULL'/);

  const migrationBlock = functionBlock(autoMigrateSource, 'migrateCustomerPremises');
  assert.doesNotMatch(migrationBlock, coordinateDropPattern);
});

test('request-time customer premises infrastructure adds missing coordinates without dropping them', () => {
  const ensureBlock = functionBlock(serverSource, 'ensureCustomerPremisesInfrastructure');

  assert.match(ensureBlock, /latitude\s+DECIMAL\(10,8\)\s+NULL/i);
  assert.match(ensureBlock, /longitude\s+DECIMAL\(11,8\)\s+NULL/i);
  assert.match(ensureBlock, /name:\s*'latitude',\s*definition:\s*'DECIMAL\(10,8\) NULL'/);
  assert.match(ensureBlock, /name:\s*'longitude',\s*definition:\s*'DECIMAL\(11,8\) NULL'/);
  assert.doesNotMatch(ensureBlock, coordinateDropPattern);
});

test('standalone customer premises migration adds missing coordinate columns without destructive drops', () => {
  assert.match(migrationSql, /latitude\s+DECIMAL\(10,8\)\s+NULL/i);
  assert.match(migrationSql, /longitude\s+DECIMAL\(11,8\)\s+NULL/i);
  assert.match(migrationSql, /COUNT\(\*\)\s*=\s*0,[\s\S]*ALTER TABLE customer_premises ADD COLUMN latitude DECIMAL\(10,8\) NULL/i);
  assert.match(migrationSql, /COUNT\(\*\)\s*=\s*0,[\s\S]*ALTER TABLE customer_premises ADD COLUMN longitude DECIMAL\(11,8\) NULL/i);
  assert.doesNotMatch(migrationSql, coordinateDropPattern);
});

test('customer premises coordinate safety does not recreate or truncate existing data paths', () => {
  const combined = [serverSource, autoMigrateSource, migrationSql].join('\n');
  assert.doesNotMatch(combined, /DROP\s+TABLE\s+customer_premises/i);
  assert.doesNotMatch(combined, /TRUNCATE\s+TABLE\s+customer_premises/i);
  assert.doesNotMatch(combined, /RENAME\s+COLUMN\s+`?(latitude|longitude)`?/i);
  assert.doesNotMatch(combined, /CHANGE\s+COLUMN\s+`?(latitude|longitude)`?/i);
});
