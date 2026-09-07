const fs = require('fs');
const path = require('path');

const nowIso = () => new Date().toISOString();

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' || typeof value === 'function') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^(undefined|null)$/i.test(raw)) return '';
  return raw;
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeStatus = (value, fallback = 'draft') => {
  const status = normalizeText(value).toLowerCase();
  if (['draft', 'scheduled', 'sending', 'sent', 'failed', 'partial'].includes(status)) return status;
  return fallback;
};

const normalizeCampaignType = (value, fallback = 'custom campaign') => {
  const type = normalizeText(value);
  return type || fallback;
};

const normalizeCampaignRecord = (payload = {}) => {
  const recipientCount = toNumber(payload.recipientCount, 0);
  const uniqueRecipientCount = toNumber(payload.uniqueRecipientCount, recipientCount);
  const duplicateCount = toNumber(payload.duplicateCount, Math.max(0, recipientCount - uniqueRecipientCount));
  const sentCount = toNumber(payload.sentCount, 0);
  const failedCount = toNumber(payload.failedCount, 0);
  const optedOutCount = toNumber(payload.optedOutCount, 0);
  const status = normalizeStatus(payload.status, payload.scheduleAt ? 'scheduled' : 'draft');

  return {
    id: normalizeText(payload.id) || `WMK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    campaignName: normalizeText(payload.campaignName),
    campaignType: normalizeCampaignType(payload.campaignType),
    audienceLabel: normalizeText(payload.audienceLabel) || 'Custom Audience',
    templateId: normalizeText(payload.templateId),
    templateName: normalizeText(payload.templateName),
    message: normalizeText(payload.message),
    attachmentUrl: normalizeText(payload.attachmentUrl),
    attachmentName: normalizeText(payload.attachmentName),
    scheduleAt: normalizeText(payload.scheduleAt),
    senderStatus: normalizeText(payload.senderStatus) || (status === 'scheduled' ? 'Scheduled' : 'Ready'),
    notes: normalizeText(payload.notes),
    status,
    recipientCount,
    uniqueRecipientCount,
    duplicateCount,
    sentCount,
    failedCount,
    optedOutCount,
    selectedCustomerIds: Array.isArray(payload.selectedCustomerIds)
      ? payload.selectedCustomerIds.map((id) => normalizeText(id)).filter(Boolean)
      : [],
    recipients: Array.isArray(payload.recipients)
      ? payload.recipients.map((recipient) => ({
          id: normalizeText(recipient?.id),
          name: normalizeText(recipient?.name),
          phone: normalizeText(recipient?.phone),
          customerId: normalizeText(recipient?.customerId),
          optedOut: Boolean(recipient?.optedOut),
          duplicateOf: normalizeText(recipient?.duplicateOf),
          skippedReason: normalizeText(recipient?.skippedReason)
        }))
      : [],
    filters: payload.filters && typeof payload.filters === 'object' ? payload.filters : {},
    createdBy: normalizeText(payload.createdBy) || 'System',
    createdAt: normalizeText(payload.createdAt) || nowIso(),
    updatedAt: nowIso()
  };
};

function createWhatsAppMarketingController(deps) {
  const { dataDir, readJsonFile } = deps;
  const campaignsFile = path.join(dataDir, 'whatsapp_marketing_campaigns.json');

  const writeJsonFile = (filePath, value) => {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  };

  const getCampaigns = () => ensureArray(readJsonFile(campaignsFile, []));

  const saveCampaigns = (next) => writeJsonFile(campaignsFile, next);

  const getSummary = (campaigns = []) => {
    const rows = ensureArray(campaigns);
    const recipientCount = rows.reduce((sum, row) => sum + toNumber(row.recipientCount, 0), 0);
    const uniqueRecipientCount = rows.reduce((sum, row) => sum + toNumber(row.uniqueRecipientCount, row.recipientCount || 0), 0);
    const duplicateCount = rows.reduce((sum, row) => sum + toNumber(row.duplicateCount, 0), 0);
    const sent = rows.reduce((sum, row) => sum + toNumber(row.sentCount, row.status === 'sent' ? row.uniqueRecipientCount || row.recipientCount || 0 : 0), 0);
    const failed = rows.reduce((sum, row) => sum + toNumber(row.failedCount, row.status === 'failed' ? row.uniqueRecipientCount || row.recipientCount || 0 : 0), 0);
    const optedOut = rows.reduce((sum, row) => sum + toNumber(row.optedOutCount, 0), 0);
    const scheduled = rows.filter((row) => row.status === 'scheduled').length;
    return {
      totalCampaigns: rows.length,
      scheduled,
      sent,
      failed,
      recipients: recipientCount,
      uniqueRecipients: uniqueRecipientCount,
      duplicatesRemoved: duplicateCount,
      optedOut
    };
  };

  const listCampaigns = (_req, res) => {
    const campaigns = getCampaigns().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({
      campaigns,
      summary: getSummary(campaigns)
    });
  };

  const createCampaign = (req, res) => {
    const body = req.body || {};
    if (!normalizeText(body.campaignName)) {
      return res.status(400).json({ error: 'Campaign name is required.' });
    }
    if (!normalizeText(body.campaignType)) {
      return res.status(400).json({ error: 'Campaign type is required.' });
    }
    if (!normalizeText(body.message) && !normalizeText(body.templateId)) {
      return res.status(400).json({ error: 'Message or template is required.' });
    }

    const campaign = normalizeCampaignRecord({
      ...body,
      status: body.status || (normalizeText(body.scheduleAt) ? 'scheduled' : 'draft')
    });
    const campaigns = getCampaigns();
    campaigns.unshift(campaign);
    saveCampaigns(campaigns);
    res.status(201).json(campaign);
  };

  return {
    listCampaigns,
    createCampaign,
    getSummary,
    _getCampaigns: getCampaigns,
    parseJsonSafe: (raw, fallback) => {
      try {
        return JSON.parse(raw);
      } catch (_error) {
        return fallback;
      }
    }
  };
}

module.exports = {
  createWhatsAppMarketingController
};
