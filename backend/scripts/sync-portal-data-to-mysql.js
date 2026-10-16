const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../lib/db');
const { migrateJobsJsonToMysql, syncPortalJsonSnapshotsToMysql } = require('../lib/autoMigrate');

const resolveDataDirectory = () => {
  const configured = String(process.env.DATA_DIR || process.env.PERSISTENT_DATA_DIR || '').trim();
  return configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(__dirname, '..', configured))
    : path.join(__dirname, '..', 'data');
};

const inspectSource = () => {
  const dataDirectory = resolveDataDirectory();
  const files = fs.existsSync(dataDirectory)
    ? fs.readdirSync(dataDirectory).filter((name) => name.endsWith('.json')).sort()
    : [];
  const jobsFile = path.join(dataDirectory, 'jobs.json');
  let jobs = 0;
  if (fs.existsSync(jobsFile)) {
    const parsed = JSON.parse(fs.readFileSync(jobsFile, 'utf8') || '[]');
    jobs = Array.isArray(parsed) ? parsed.length : 0;
  }
  return { dataDirectory, files, jobs };
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  const source = inspectSource();
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', source }, null, 2));
    return;
  }

  const snapshots = await syncPortalJsonSnapshotsToMysql(pool);
  if (snapshots.errors.length) {
    throw new Error(`Snapshot sync failed: ${JSON.stringify(snapshots.errors)}`);
  }

  const connection = await pool.getConnection();
  let jobsMigrated = 0;
  try {
    await connection.beginTransaction();
    jobsMigrated = await migrateJobsJsonToMysql(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [jobRows] = await pool.query('SELECT COUNT(*) AS count FROM jobs');
  const [snapshotRows] = await pool.query('SELECT COUNT(*) AS count FROM portal_data_snapshots');
  console.log(JSON.stringify({
    mode: 'applied',
    source,
    jobsMigrated,
    mysqlJobCount: Number(jobRows?.[0]?.count || 0),
    snapshots,
    mysqlSnapshotCount: Number(snapshotRows?.[0]?.count || 0)
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
