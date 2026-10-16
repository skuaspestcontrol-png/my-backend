const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const autoMigrateSource = fs.readFileSync(path.join(__dirname, '../lib/autoMigrate.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const { syncPortalJsonSnapshotsToMysql } = require('../lib/autoMigrate');

test('portal JSON snapshots are upserted into MySQL with counts and checksums', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-json-snapshot-'));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  fs.writeFileSync(path.join(directory, 'jobs.json'), JSON.stringify([{ _id: 'JOB-1' }, { _id: 'JOB-2' }]));
  fs.writeFileSync(path.join(directory, 'settings.json'), JSON.stringify({ companyName: 'SKUAS' }));
  const calls = [];
  const target = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return [[], []];
    }
  };

  try {
    const result = await syncPortalJsonSnapshotsToMysql(target);
    assert.equal(result.files, 2);
    assert.equal(result.records, 3);
    assert.deepEqual(result.errors, []);
    const inserts = calls.filter((entry) => /INSERT INTO portal_data_snapshots/.test(entry.sql));
    assert.equal(inserts.length, 2);
    assert.deepEqual(inserts.map((entry) => entry.params[1]).sort(), ['jobs.json', 'settings.json']);
    assert.ok(inserts.every((entry) => /^[a-f0-9]{64}$/.test(entry.params[4])));
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('startup migration moves legacy jobs and continuously reconciles JSON snapshots', () => {
  assert.match(autoMigrateSource, /status\.coreRowsMigrated\.jobs = await migrateJobsJsonToMysql\(target\)/);
  assert.match(autoMigrateSource, /status\.portalJsonSnapshots = await syncPortalJsonSnapshotsToMysql\(target\)/);
  assert.match(autoMigrateSource, /ON DUPLICATE KEY UPDATE[\s\S]+payload=VALUES\(payload\)/);
  assert.match(serverSource, /startPortalJsonSnapshotSync\(\)/);
  assert.match(serverSource, /app\.get\('\/api\/admin\/persistence-audit'/);
});

test('job list reads never delete orphaned MySQL records', () => {
  const listStart = serverSource.indexOf("app.get('/api/jobs'");
  const listEnd = serverSource.indexOf('\nconst loadJobsFromMysql', listStart);
  const listBlock = serverSource.slice(listStart, listEnd);
  const cleanupStart = serverSource.indexOf('const pruneOrphanAssignedJobs = async');
  const cleanupEnd = serverSource.indexOf('\nconst loadJobByIdFromMysql', cleanupStart);
  const cleanupBlock = serverSource.slice(cleanupStart, cleanupEnd);

  assert.doesNotMatch(listBlock, /pruneOrphanAssignedJobs/);
  assert.doesNotMatch(cleanupBlock, /DELETE FROM jobs/);
  assert.match(cleanupBlock, /UPDATE jobs/);
  assert.match(cleanupBlock, /'\$\.isDeleted', true/);
});

test('completed jobs are archived instead of physically deleted', () => {
  assert.doesNotMatch(serverSource, /DELETE FROM jobs/);
  assert.match(serverSource, /app\.delete\('\/api\/jobs\/:id'[\s\S]+JSON_SET[\s\S]+'\$\.isDeleted', true/);
});
