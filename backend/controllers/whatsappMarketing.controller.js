const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveMarketingAudience } = require('../services/whatsappMarketingAudience.service');
const { sendTextMessage, sendDocumentMessage } = require('../services/whatsapp.service');

const BATCH_SIZE = Math.max(1, Number(process.env.WHATSAPP_MARKETING_BATCH_SIZE || 10));
const MESSAGE_DELAY_MS = Math.max(0, Number(process.env.WHATSAPP_MARKETING_MESSAGE_DELAY_MS || 3000));
const BATCH_DELAY_MS = Math.max(1000, Number(process.env.WHATSAPP_MARKETING_BATCH_DELAY_MS || 30000));
const SCHEDULER_INTERVAL_MS = Math.max(5000, Number(process.env.WHATSAPP_MARKETING_SCHEDULER_INTERVAL_MS || 10000));
const nowIso = () => new Date().toISOString();
const text = (value) => String(value ?? '').trim();
const list = (value) => (Array.isArray(value) ? value : []);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readRows = (readJsonFile, file) => list(readJsonFile(file, []));

const normalizeStatus = (value, fallback = 'draft') => {
  const status = text(value).toLowerCase();
  return ['draft', 'scheduled', 'running', 'paused', 'sent', 'completed', 'partially_completed', 'failed', 'cancelled'].includes(status) ? status : fallback;
};

const createController = (deps) => {
  const { dataDir, readJsonFile, settingsFile, customersFile, renewalsFile, jobsFile, invoicesFile, paymentsFile, employeesFile, mysql = {} } = deps;
  const campaignsFile = path.join(dataDir, 'whatsapp_marketing_campaigns.json');
  const presetsFile = path.join(dataDir, 'whatsapp_marketing_audience_presets.json');
  const logsFile = path.join(dataDir, 'whatsapp_message_logs.json');
  const locksDir = path.join(dataDir, '.whatsapp-marketing-locks');
  fs.mkdirSync(locksDir, { recursive: true });
  const activeWorkers = new Set();
  const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
  const campaigns = () => readRows(readJsonFile, campaignsFile);
  const presets = () => readRows(readJsonFile, presetsFile);
  const crmData = () => ({
    customers: readRows(readJsonFile, customersFile), renewals: readRows(readJsonFile, renewalsFile),
    jobs: readRows(readJsonFile, jobsFile), invoices: readRows(readJsonFile, invoicesFile),
    payments: readRows(readJsonFile, paymentsFile), employees: readRows(readJsonFile, employeesFile)
  });
  const audience = (filters = {}, previous = campaigns()) => resolveMarketingAudience({ ...crmData(), filters, previousCampaigns: previous });
  const freshCustomerById = async (customerId) => {
    const id = text(customerId);
    if (!id) return null;
    if (mysql.canUseMysql && mysql.withMysqlConnection && mysql.canUseMysql()) {
      try {
        return await mysql.withMysqlConnection(async (conn) => {
          const [rows] = await conn.query('SELECT external_id, payload, whatsapp_marketing_opt_out FROM customers WHERE external_id = ? OR id = ? LIMIT 1', [id, /^\d+$/.test(id) ? Number(id) : -1]);
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row) return null;
          let payload = {};
          if (row.payload && typeof row.payload === 'object') payload = row.payload;
          if (typeof row.payload === 'string') {
            try { payload = JSON.parse(row.payload); } catch { payload = {}; }
          }
          return { ...payload, _id: text(payload._id || row.external_id || row.id || id), whatsapp_marketing_opt_out: Boolean(row.whatsapp_marketing_opt_out || payload.whatsapp_marketing_opt_out) };
        });
      } catch (error) {
        console.error('WhatsApp marketing customer recheck fell back to JSON:', error.message);
      }
    }
    return readRows(readJsonFile, customersFile).find((customer) => text(customer._id || customer.id || customer.customerId) === id) || null;
  };
  const currentlyEligible = async (campaign, recipient) => {
    const customer = await freshCustomerById(recipient.customerId || recipient.id);
    if (!customer) return null;
    return resolveMarketingAudience({
      ...crmData(),
      customers: [customer],
      filters: campaign.filters || {},
      previousCampaigns: []
    }).recipients.find(candidate => text(candidate.customerId || candidate.id) === text(recipient.customerId || recipient.id) && text(candidate.phone) === text(recipient.phone)) || null;
  };
  const counts = (campaign) => list(campaign.recipients).reduce((result, recipient) => {
    const status = text(recipient.status || (['sent', 'completed'].includes(campaign.status) ? 'sent' : campaign.status === 'failed' ? 'failed' : 'pending')).toLowerCase();
    if (status === 'sent') result.sent += 1;
    else if (status === 'failed') result.failed += 1;
    else if (status === 'skipped') result.skipped += 1;
    else if (status === 'cancelled') result.cancelled += 1;
    else result.pending += 1;
    return result;
  }, { sent: 0, failed: 0, skipped: 0, cancelled: 0, pending: 0 });
  const decorate = (campaign) => {
    const stats = counts(campaign);
    return { ...campaign, ...stats, sentCount: stats.sent, failedCount: stats.failed, recipientCount: list(campaign.recipients).length, uniqueRecipientCount: list(campaign.recipients).length, total: list(campaign.recipients).length, processed: stats.sent + stats.failed + stats.skipped + stats.cancelled, remaining: stats.pending };
  };
  const saveLog = (campaign, recipient, status, result = {}, errorMessage = '') => {
    const logs = readRows(readJsonFile, logsFile);
    logs.unshift({
      id: `WALOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sentAt: nowIso(), sentByUser: campaign.createdBy || 'System',
      recipientName: recipient.name, recipientPhone: recipient.phone, recipientType: 'Customer', moduleName: 'whatsapp-marketing',
      campaignId: campaign.id, recipientId: recipient.id, customerId: recipient.customerId,
      templateKey: text(campaign.templateId || campaign.templateName || campaign.campaignType).toLowerCase(), templateId: campaign.templateId || '',
      message: campaign.message || '', attachmentUrl: campaign.attachmentUrl || '', attachmentName: campaign.attachmentName || '', status,
      provider: text(result.provider || 'deropo'), httpStatus: result.httpStatus || null, providerMessageId: result.providerMessageId || null,
      apiResponse: result.providerResponse || result.response || null, errorMessage: text(errorMessage),
      originalPayload: { moduleName: 'whatsapp-marketing', campaignId: campaign.id, customerId: recipient.customerId }, updatedAt: nowIso()
    });
    write(logsFile, logs);
  };
  const acquireLock = (id) => {
    const lockPath = path.join(locksDir, `${crypto.createHash('sha256').update(String(id)).digest('hex')}.lock`);
    try { const handle = fs.openSync(lockPath, 'wx'); fs.writeSync(handle, `${process.pid}:${Date.now()}`); fs.closeSync(handle); return lockPath; } catch (_error) {
      try { const stat = fs.statSync(lockPath); if (Date.now() - stat.mtimeMs > Math.max(BATCH_DELAY_MS * 3, 120000)) fs.unlinkSync(lockPath); } catch (_ignored) {}
      return null;
    }
  };
  const releaseLock = (lockPath) => { if (lockPath) { try { fs.unlinkSync(lockPath); } catch (_ignored) {} } };
  const persistCampaign = (updated) => {
    const rows = campaigns(); const index = rows.findIndex((row) => String(row.id) === String(updated.id));
    if (index < 0) return null; rows[index] = { ...rows[index], ...updated, updatedAt: nowIso() }; write(campaignsFile, rows); return rows[index];
  };
  const dateDue = (value) => { const date = new Date(value); return value && !Number.isNaN(date.getTime()) && date.getTime() <= Date.now(); };

  const listCampaigns = (_req, res) => {
    const rows = campaigns().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).map(decorate);
    const summary = rows.reduce((result, row) => {
      result.totalCampaigns += 1; if (['scheduled', 'running', 'paused'].includes(row.status)) result.scheduled += 1;
      result.sent += row.sent; result.failed += row.failed; result.recipients += row.total; result.uniqueRecipients += row.total;
      result.optedOut += number(row.audienceStats?.optedOut); result.duplicatesRemoved += number(row.audienceStats?.duplicateNumbers); return result;
    }, { totalCampaigns: 0, scheduled: 0, sent: 0, failed: 0, recipients: 0, uniqueRecipients: 0, duplicatesRemoved: 0, optedOut: 0 });
    res.json({ campaigns: rows, summary });
  };
  const previewAudience = (req, res) => { const result = audience(req.body?.filters || {}); res.json({ ...result, recipients: result.recipients.slice(0, 20) }); };
  const audienceOptions = (_req, res) => {
    const data = crmData(); const sourceRows = [...data.customers, ...data.jobs, ...data.renewals]; const values = (pick) => [...new Set(sourceRows.map(pick).map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    res.json({ services: values((row) => row.serviceType || row.serviceName || row.service || row.segment), areas: values((row) => row.billingArea || row.areaName || row.area || row.shippingArea), cities: values((row) => row.billingCity || row.city || row.shippingCity), states: values((row) => row.billingState || row.state || row.shippingState), salesPersons: values((row) => row.salesPersonName || row.salesPerson || row.sales_person || row.assignedTo) });
  };
  const listPresets = (_req, res) => res.json(presets());
  const savePreset = (req, res) => {
    const name = text(req.body?.name); if (!name) return res.status(400).json({ error: 'Preset name is required.' });
    const next = { id: `WMA-${Date.now()}`, name, filters: req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : {}, createdBy: text(req.portalUser?.name || req.portalUser?.email || 'System'), createdAt: nowIso() };
    const rows = presets().filter((row) => text(row.name).toLowerCase() !== name.toLowerCase()); rows.unshift(next); write(presetsFile, rows); res.status(201).json(next);
  };
  const deletePreset = (req, res) => { const rows = presets(); const next = rows.filter((row) => String(row.id) !== String(req.params.id)); if (next.length === rows.length) return res.status(404).json({ error: 'Audience preset not found.' }); write(presetsFile, next); res.json({ success: true }); };

  const createCampaign = (req, res) => {
    const body = req.body || {};
    if (!text(body.campaignName) || !text(body.campaignType)) return res.status(400).json({ error: 'Campaign name and type are required.' });
    if (!text(body.message) && !text(body.templateId)) return res.status(400).json({ error: 'Message or template is required.' });
    const filters = body.filters && typeof body.filters === 'object' ? body.filters : {}; const resolved = audience(filters); const provided = list(body.recipients);
    const selectedIds = new Set((provided.length ? provided.map(recipient => recipient.customerId || recipient.id) : list(body.selectedCustomerIds)).map(text));
    const authoritative = [...resolved.recipients, ...resolved.excluded].filter(recipient => !selectedIds.size || selectedIds.has(text(recipient.customerId || recipient.id)));
    const recipients = authoritative.map((recipient) => ({
      id: text(recipient.id || recipient.customerId), customerId: text(recipient.customerId || recipient.id), name: text(recipient.name || recipient.displayName || 'Customer'), phone: text(recipient.phone), normalizedPhone: text(recipient.normalizedPhone || recipient.phone),
      service: text(recipient.service), area: text(recipient.area), contractStatus: text(recipient.contractStatus), renewalDate: text(recipient.renewalDate), status: text(recipient.status || 'pending').toLowerCase() || 'pending', skippedReason: text(recipient.skippedReason), sentAt: text(recipient.sentAt), errorMessage: text(recipient.errorMessage), providerHttpStatus: recipient.providerHttpStatus || null, providerMessageId: recipient.providerMessageId || null
    }));
    const scheduled = Boolean(text(body.scheduleAt));
    const campaignStatus = normalizeStatus(body.status, scheduled ? 'scheduled' : 'draft');
    const campaign = { id: `WMK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, campaignName: text(body.campaignName), campaignType: text(body.campaignType), audienceLabel: text(body.audienceLabel) || 'Smart Audience', templateId: text(body.templateId), templateName: text(body.templateName), message: text(body.message), attachmentUrl: text(body.attachmentUrl), attachmentName: text(body.attachmentName), scheduleAt: text(body.scheduleAt), senderStatus: campaignStatus === 'running' ? 'Running' : scheduled ? 'Scheduled' : 'Ready', notes: text(body.notes), filters, audienceStats: resolved.stats, selectedCustomerIds: list(body.selectedCustomerIds).map(text).filter(Boolean), recipients, status: campaignStatus, createdBy: text(req.portalUser?.name || req.portalUser?.email || body.createdBy || 'System'), createdAt: nowIso(), updatedAt: nowIso(), startedAt: '', completedAt: '', pausedAt: '', cancelledAt: '' };
    const rows = campaigns(); rows.unshift(campaign); write(campaignsFile, rows); if (campaign.status === 'running') processCampaign(campaign.id).catch((error) => console.error('WhatsApp campaign failed:', error.message)); res.status(201).json(decorate(campaign));
  };
  const getCampaign = (req, res) => { const row = campaigns().find((campaign) => String(campaign.id) === String(req.params.id)); if (!row) return res.status(404).json({ error: 'Campaign not found.' }); res.json(decorate(row)); };

  const updateCampaignStatus = (req, res) => {
    const row = campaigns().find((campaign) => String(campaign.id) === String(req.params.id)); if (!row) return res.status(404).json({ error: 'Campaign not found.' }); const action = text(req.body?.action).toLowerCase();
    if (action === 'pause' && ['running', 'scheduled'].includes(row.status)) return res.json(decorate(persistCampaign({ id: row.id, status: 'paused', pausedAt: nowIso(), senderStatus: 'Paused' })));
    if (action === 'resume' && row.status === 'paused') { const updated = persistCampaign({ id: row.id, status: 'running', startedAt: row.startedAt || nowIso(), senderStatus: 'Running' }); processCampaign(row.id).catch((error) => console.error('WhatsApp campaign resume failed:', error.message)); return res.json(decorate(updated)); }
    if (action === 'cancel' && ['scheduled', 'running', 'paused'].includes(row.status)) { const recipients = list(row.recipients).map((recipient) => recipient.status === 'pending' ? { ...recipient, status: 'cancelled', skippedReason: 'cancelled' } : recipient); return res.json(decorate(persistCampaign({ id: row.id, status: 'cancelled', cancelledAt: nowIso(), senderStatus: 'Cancelled', recipients })));
    }
    if (action === 'retry_failed') { const recipients = list(row.recipients).map((recipient) => recipient.status === 'failed' ? { ...recipient, status: 'pending', errorMessage: '', providerHttpStatus: null, providerMessageId: null } : recipient); const updated = persistCampaign({ id: row.id, status: 'running', senderStatus: 'Running', recipients }); processCampaign(row.id).catch((error) => console.error('WhatsApp campaign retry failed:', error.message)); return res.json(decorate(updated)); }
    return res.status(409).json({ error: `Campaign cannot ${action || 'change status'} from ${row.status}.` });
  };

  const processCampaign = async (campaignId) => {
    if (activeWorkers.has(campaignId)) return; const lockPath = acquireLock(campaignId); if (!lockPath) return; activeWorkers.add(campaignId);
    try {
      let row = campaigns().find((campaign) => String(campaign.id) === String(campaignId)); if (!row || !['running', 'scheduled'].includes(row.status)) return;
      if (row.status === 'scheduled') { if (!dateDue(row.scheduleAt)) return; row = persistCampaign({ id: row.id, status: 'running', startedAt: nowIso(), senderStatus: 'Running' }); }
      const settings = readJsonFile(settingsFile, {}); const batch = list(row.recipients).filter((recipient) => recipient.status === 'pending').slice(0, BATCH_SIZE);
      for (const recipient of batch) {
        const current = campaigns().find((campaign) => String(campaign.id) === String(campaignId)); if (!current || current.status !== 'running') break;
        const eligible = await currentlyEligible(current, recipient);
        if (!eligible) {
          persistCampaign({ id: campaignId, recipients: list(current.recipients).map(item => item.id === recipient.id ? { ...item, status: 'skipped', skippedReason: 'no_longer_eligible' } : item) });
          continue;
        }
        persistCampaign({ id: campaignId, recipients: list(current.recipients).map((item) => item.id === recipient.id ? { ...item, status: 'processing' } : item) });
        try {
          const result = current.attachmentUrl ? await sendDocumentMessage({ settings, to: recipient.phone, message: current.message, attachmentUrl: current.attachmentUrl, attachmentName: current.attachmentName }) : await sendTextMessage({ settings, to: recipient.phone, message: current.message });
          const latest = campaigns().find((campaign) => String(campaign.id) === String(campaignId)); const recipients = list(latest.recipients).map((item) => item.id === recipient.id ? { ...item, status: 'sent', sentAt: nowIso(), providerHttpStatus: result.httpStatus || null, providerMessageId: result.providerMessageId || null, errorMessage: '' } : item); persistCampaign({ id: campaignId, recipients }); saveLog(latest, { ...recipient, status: 'sent' }, 'sent', result);
        } catch (error) {
          const latest = campaigns().find((campaign) => String(campaign.id) === String(campaignId)); const recipients = list(latest.recipients).map((item) => item.id === recipient.id ? { ...item, status: 'failed', errorMessage: error.message, providerHttpStatus: error.httpStatus || null, providerMessageId: error.providerMessageId || null } : item); persistCampaign({ id: campaignId, recipients }); saveLog(latest, { ...recipient, status: 'failed' }, 'failed', error, error.message);
        }
        if (MESSAGE_DELAY_MS) await delay(MESSAGE_DELAY_MS);
      }
      const latest = campaigns().find((campaign) => String(campaign.id) === String(campaignId));
      if (latest && latest.status === 'running' && !list(latest.recipients).some((recipient) => recipient.status === 'pending' || recipient.status === 'processing')) {
        const summary = counts(latest); persistCampaign({ id: campaignId, status: summary.failed ? 'partially_completed' : 'completed', senderStatus: summary.failed ? 'Partially Completed' : 'Completed', completedAt: nowIso() });
      } else if (latest && latest.status === 'running' && list(latest.recipients).some((recipient) => recipient.status === 'pending')) {
        setTimeout(() => processCampaign(campaignId).catch((error) => console.error('WhatsApp batch error:', error.message)), BATCH_DELAY_MS);
      }
    } finally { activeWorkers.delete(campaignId); releaseLock(lockPath); }
  };
  const schedulerTick = () => campaigns().filter((campaign) => campaign.status === 'scheduled' && dateDue(campaign.scheduleAt)).forEach((campaign) => processCampaign(campaign.id).catch((error) => console.error('WhatsApp scheduler error:', error.message)));
  const startScheduler = () => { const timer = setInterval(schedulerTick, SCHEDULER_INTERVAL_MS); if (typeof timer.unref === 'function') timer.unref(); schedulerTick(); return timer; };
  return { listCampaigns, previewAudience, audienceOptions, listPresets, savePreset, deletePreset, createCampaign, getCampaign, updateCampaignStatus, startScheduler, _processCampaign: processCampaign };
};

module.exports = { createWhatsAppMarketingController: createController, BATCH_SIZE, MESSAGE_DELAY_MS, BATCH_DELAY_MS };
