const crypto = require('crypto');
const { google } = require('googleapis');

const INTEGRATION_KEY = 'google_tasks_integration';
const TASK_LIST_TITLE = 'SKUAS CRM Tasks';

const clean = (v) => String(v ?? '').trim();

const normalizeKey = (raw) => {
  const text = clean(raw);
  if (!text) return null;
  if (/^[0-9a-fA-F]{64}$/.test(text)) {
    return Buffer.from(text, 'hex');
  }
  if (/^[A-Za-z0-9+/=]+$/.test(text)) {
    try {
      const b = Buffer.from(text, 'base64');
      if (b.length === 32) return b;
    } catch (_e) {}
  }
  const b = Buffer.from(text, 'utf8');
  if (b.length === 32) return b;
  return crypto.createHash('sha256').update(b).digest();
};

const encrypt = (plain, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
};

const decrypt = (payload, key) => {
  const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
};

const buildOAuthClient = () => {
  const clientId = clean(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = clean(process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = clean(process.env.GOOGLE_REDIRECT_URI);
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth env vars missing: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const ensureGoogleIntegrationTable = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS google_integrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      integration_key VARCHAR(120) NOT NULL,
      google_email VARCHAR(255) NULL,
      encrypted_refresh_token TEXT NULL,
      tasklist_id VARCHAR(255) NULL,
      sync_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_google_integrations_key (integration_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const ensureJobsGoogleColumns = async (conn) => {
  try {
    await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_task_id VARCHAR(255) NULL');
    await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_sync_status VARCHAR(50) NULL');
    await conn.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_last_synced_at DATETIME NULL');
  } catch (_error) {
    // fallback for MySQL variants without IF NOT EXISTS
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='jobs'");
    const names = new Set((cols || []).map((c) => String(c.COLUMN_NAME || '')));
    if (!names.has('google_task_id')) await conn.query('ALTER TABLE jobs ADD COLUMN google_task_id VARCHAR(255) NULL');
    if (!names.has('google_sync_status')) await conn.query('ALTER TABLE jobs ADD COLUMN google_sync_status VARCHAR(50) NULL');
    if (!names.has('google_last_synced_at')) await conn.query('ALTER TABLE jobs ADD COLUMN google_last_synced_at DATETIME NULL');
  }
};

const getIntegrationRow = async (conn) => {
  await ensureGoogleIntegrationTable(conn);
  const [rows] = await conn.query('SELECT * FROM google_integrations WHERE integration_key = ? LIMIT 1', [INTEGRATION_KEY]);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
};

const saveIntegrationRow = async (conn, row = {}) => {
  await ensureGoogleIntegrationTable(conn);
  await conn.query(
    `INSERT INTO google_integrations (integration_key, google_email, encrypted_refresh_token, tasklist_id, sync_enabled)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      google_email=VALUES(google_email),
      encrypted_refresh_token=VALUES(encrypted_refresh_token),
      tasklist_id=VALUES(tasklist_id),
      sync_enabled=VALUES(sync_enabled)`,
    [
      INTEGRATION_KEY,
      clean(row.google_email),
      clean(row.encrypted_refresh_token),
      clean(row.tasklist_id),
      Number(row.sync_enabled) === 0 ? 0 : 1
    ]
  );
};

const getTasksClient = async (conn) => {
  const row = await getIntegrationRow(conn);
  if (!row?.encrypted_refresh_token) return null;
  const key = normalizeKey(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  if (!key) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is missing');
  const refreshToken = decrypt(row.encrypted_refresh_token, key);
  const oauth = buildOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  const tasks = google.tasks({ version: 'v1', auth: oauth });
  return { tasks, oauth, row, refreshToken, key };
};

const ensureTaskList = async (tasks) => {
  const listRes = await tasks.tasklists.list({ maxResults: 100 });
  const found = (listRes.data.items || []).find((entry) => clean(entry.title).toLowerCase() === TASK_LIST_TITLE.toLowerCase());
  if (found?.id) return found.id;
  const created = await tasks.tasklists.insert({ requestBody: { title: TASK_LIST_TITLE } });
  return created.data?.id || '';
};

const composeTaskPayload = (job = {}) => {
  const title = clean(job.serviceName || job.service_name || job.jobNumber || 'CRM Service Job');
  const dueDate = clean(job.scheduledDate || job.scheduled_date);
  const due = dueDate ? `${dueDate}T09:00:00.000Z` : undefined;
  const notes = [
    `Job Number: ${clean(job.jobNumber || job.job_number || '-')}`,
    `Customer: ${clean(job.customerName || job.customer_name || '-')}`,
    `Address: ${clean(job.serviceAddress || job.address || '-')}`,
    `Date: ${clean(job.scheduledDate || job.scheduled_date || '-')}`,
    `Time: ${clean(job.scheduledTime || job.scheduled_time || '-')}`,
    `Technician: ${clean(job.technicianName || '-')}`,
    `Status: ${clean(job.status || '-')}`
  ].join('\n');
  return { title, due, notes };
};

const syncGoogleTaskForJob = async ({ conn, job = {}, markCompleted = false }) => {
  const client = await getTasksClient(conn);
  if (!client) return { skipped: true, reason: 'google_not_connected' };
  const { tasks, row } = client;
  const tasklistId = clean(row.tasklist_id) || await ensureTaskList(tasks);

  const payload = composeTaskPayload(job);
  const existingTaskId = clean(job.google_task_id);
  let taskId = existingTaskId;

  if (existingTaskId) {
    await tasks.tasks.patch({ tasklist: tasklistId, task: existingTaskId, requestBody: payload });
  } else {
    const created = await tasks.tasks.insert({ tasklist: tasklistId, requestBody: payload });
    taskId = clean(created.data?.id);
  }

  if (markCompleted || clean(job.status).toLowerCase() === 'completed') {
    await tasks.tasks.patch({ tasklist: tasklistId, task: taskId, requestBody: { status: 'completed' } });
  }

  const nowIso = new Date().toISOString();
  await saveIntegrationRow(conn, { ...row, tasklist_id: tasklistId, sync_enabled: 1 });

  return {
    google_task_id: taskId,
    google_sync_status: 'synced',
    google_last_synced_at: nowIso,
    tasklist_id: tasklistId
  };
};

module.exports = {
  INTEGRATION_KEY,
  TASK_LIST_TITLE,
  encrypt,
  decrypt,
  normalizeKey,
  buildOAuthClient,
  ensureGoogleIntegrationTable,
  ensureJobsGoogleColumns,
  getIntegrationRow,
  saveIntegrationRow,
  getTasksClient,
  ensureTaskList,
  syncGoogleTaskForJob
};
