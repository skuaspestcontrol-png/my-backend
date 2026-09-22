const fs = require('fs');
const path = require('path');
const {
  ensureDefaultTemplates,
  normalizeTemplate,
  getTemplateTypeFromModule
} = require('../services/whatsappTemplate.service');
const {
  buildTemplateContext,
  getProviderSettings,
  renderTemplate,
  sendDocumentMessage,
  sendTextMessage,
  testConnection,
  validatePhoneNumber,
  buildWhatsAppCredentialDiagnostics
} = require('../services/whatsapp.service');

const nowIso = () => new Date().toISOString();
const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
};

const parseJsonSafe = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const sanitizeWhatsAppLogRequest = (payload = {}) => {
  const contextData = payload.contextData && typeof payload.contextData === 'object' ? payload.contextData : {};
  return {
    module: String(payload.moduleName || payload.module || '').trim(),
    recordId: String(payload.recordId || contextData.recordId || contextData.id || '').trim(),
    recipientName: String(payload.recipientName || '').trim(),
    recipientPhone: String(payload.recipientPhone || '').trim(),
    templateKey: String(payload.templateKey || payload.templateType || payload.templateId || '').trim().toLowerCase(),
    message: String(payload.message || '').trim(),
    attachmentUrl: String(payload.attachmentUrl || '').trim(),
    attachmentName: String(payload.attachmentName || '').trim()
  };

};

const getProviderLogData = (result = {}) => ({
  provider: String(result.provider || 'deropo').trim(),
  httpStatus: Number.isInteger(Number(result.httpStatus)) ? Number(result.httpStatus) : null,
  ok: result.ok === true,
  providerMessageId: result.providerMessageId || null,
  providerResponse: result.providerResponse || result.response || null
});

const getErrorClientStatus = (error) => {
  if (error?.isProviderError) return Number(error.statusCode) || 502;
  return Number(error?.statusCode) >= 400 && Number(error.statusCode) < 600 ? Number(error.statusCode) : 400;
};

const sanitizeWhatsAppSettingsForResponse = (settings = {}) => {
  const provider = getProviderSettings(settings);
  return {
    apiBaseUrl: provider.baseUrl,
    phoneNumber: provider.phoneNumber,
    instanceId: provider.instanceId,
    accessToken: '',
    accessTokenMasked: provider.accessTokenMasked,
    hasAccessToken: Boolean(provider.accessToken),
    active: provider.active,
    testNumber: String(settings.whatsappTestNumber || '').trim(),
    providerType: provider.providerType,
    diagnostic: buildWhatsAppCredentialDiagnostics(settings)
  };
};

const resolveAttachmentUrl = (rawUrl, req, resolveServerOrigin) => {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const origin = typeof resolveServerOrigin === 'function' ? String(resolveServerOrigin(req) || '').trim() : '';
  if (!origin) return value;
  return `${origin.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
};

function createWhatsAppController(deps) {
  const {
    dataDir,
    uploadsDir,
    settingsFile,
    readJsonFile,
    withMysqlConnection,
    loadRuntimeSettings,
    saveRuntimeSettings,
    resolveServerOrigin
  } = deps;

  const templatesFile = path.join(dataDir, 'whatsapp_templates.json');
  const logsFile = path.join(dataDir, 'whatsapp_message_logs.json');
  const attachmentsFile = path.join(dataDir, 'whatsapp_attachments.json');

  const writeJsonFile = (filePath, value) => {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  };

  const readSettingsFile = () => {
    const raw = readJsonFile(settingsFile, {});
    return raw && typeof raw === 'object' ? raw : {};
  };

  const readSettings = async () => {
    if (typeof loadRuntimeSettings === 'function') {
      const raw = await loadRuntimeSettings();
      return raw && typeof raw === 'object' ? raw : {};
    }
    return readSettingsFile();
  };

  const saveSettings = async (next) => {
    if (typeof saveRuntimeSettings === 'function') {
      const saved = await saveRuntimeSettings(next);
      return saved && typeof saved === 'object' ? saved : next;
    }
    writeJsonFile(settingsFile, next);
    return next;
  };

  const getTemplates = () => {
    const list = ensureDefaultTemplates(readJsonFile(templatesFile, []));
    writeJsonFile(templatesFile, list);
    return list;
  };

  const saveTemplates = (next) => writeJsonFile(templatesFile, next);

  const getLogs = () => ensureArray(readJsonFile(logsFile, []));
  const saveLogs = (next) => writeJsonFile(logsFile, next);

  const getAttachments = () => ensureArray(readJsonFile(attachmentsFile, []));
  const saveAttachments = (next) => writeJsonFile(attachmentsFile, next);

  const persistLogMysql = async (log) => {
    try {
      if (!withMysqlConnection) return;
      await withMysqlConnection(async (conn) => {
        await conn.query(
          `INSERT INTO whatsapp_message_logs
          (id, sent_at, sent_by_user, recipient_name, recipient_phone, recipient_type, module_name, template_id, message_body, attachment_url, status, api_response, error_message, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(log.id),
            log.sentAt,
            log.sentByUser,
            log.recipientName,
            log.recipientPhone,
            log.recipientType,
            log.moduleName,
            log.templateId,
            log.message,
            log.attachmentUrl,
            log.status,
            JSON.stringify(log.apiResponse || {}),
            log.errorMessage || '',
            JSON.stringify(log.originalPayload || {})
          ]
        );
      });
    } catch (error) {
      console.error('MySQL WhatsApp log write failed:', error.message);
    }
  };

  const saveLog = async (payload) => {
    const entry = {
      id: `WALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sentAt: nowIso(),
      sentByUser: String(payload.sentByUser || 'System').trim(),
      recipientName: String(payload.recipientName || '').trim(),
      recipientPhone: String(payload.recipientPhone || '').trim(),
      recipientType: String(payload.recipientType || '').trim(),
      moduleName: String(payload.moduleName || '').trim(),
      templateKey: String(payload.templateKey || '').trim().toLowerCase(),
      templateId: String(payload.templateId || '').trim(),
      message: String(payload.message || ''),
      attachmentUrl: String(payload.attachmentUrl || ''),
      attachmentName: String(payload.attachmentName || ''),
      status: String(payload.status || 'pending'),
      apiResponse: payload.apiResponse || null,
      errorMessage: String(payload.errorMessage || ''),
      provider: String(payload.provider || '').trim(),
      httpStatus: payload.httpStatus ?? null,
      providerMessageId: payload.providerMessageId || null,
      originalPayload: sanitizeWhatsAppLogRequest(payload.originalPayload || {}),
      updatedAt: nowIso()
    };
    const logs = getLogs();
    logs.unshift(entry);
    saveLogs(logs);
    await persistLogMysql(entry);
    return entry;
  };

  const resolveTemplate = (moduleType, templateType) => {
    const templates = getTemplates();
    const targetType = String(templateType || getTemplateTypeFromModule(moduleType)).trim().toLowerCase();
    return templates.find((entry) => entry.templateType === targetType) || null;
  };

  const buildContextPayload = (payload = {}, settings = {}) => buildTemplateContext(payload, settings);

  const getWhatsAppSettings = async (req, res) => {
    try {
      const settings = await readSettings();
      res.json(sanitizeWhatsAppSettingsForResponse(settings));
    } catch (error) {
      console.error('Failed to load WhatsApp settings:', error.message);
      res.status(500).json({ error: 'Failed to load WhatsApp settings' });
    }
  };

  const saveWhatsAppSettings = async (req, res) => {
    try {
      const body = req.body || {};
      const current = await readSettings();
      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(body, key);
      const bodyText = (...keys) => {
        for (const key of keys) {
          if (hasOwn(key)) return String(body[key] || '').trim();
        }
        return '';
      };
      const firstSaved = (...keys) => {
        for (const key of keys) {
          const value = String(current[key] || '').trim();
          if (value) return value;
        }
        return '';
      };

      const apiBaseUrlInput = bodyText('apiBaseUrl', 'whatsappApiBaseUrl');
      const phoneNumberInput = bodyText('phoneNumber', 'whatsappPhoneNumber');
      const instanceIdInput = bodyText('instanceId', 'whatsappInstanceId', 'whatsappPhoneNumberId');
      const accessTokenInput = bodyText('accessToken', 'whatsappAccessToken');
      const testNumberInput = bodyText('testNumber', 'whatsappTestNumber');
      const providerTypeInput = bodyText('providerType', 'whatsappProviderType').toLowerCase();
      const activeProvided = hasOwn('active') || hasOwn('whatsappApiActive') || hasOwn('whatsappActive');
      const activeValue = hasOwn('active')
        ? body.active
        : hasOwn('whatsappApiActive')
          ? body.whatsappApiActive
          : body.whatsappActive;
      const nextApiBaseUrl = apiBaseUrlInput || firstSaved('whatsappApiBaseUrl', 'apiBaseUrl');
      const nextProviderType = providerTypeInput
        || String(current.whatsappProviderType || current.providerType || '').trim().toLowerCase()
        || (nextApiBaseUrl && /deropo/i.test(nextApiBaseUrl) ? 'deropo' : 'custom');
      const nextInstanceId = instanceIdInput || firstSaved('whatsappInstanceId', 'whatsappPhoneNumberId', 'instanceId');

      const next = {
        ...current,
        whatsappApiBaseUrl: nextApiBaseUrl,
        whatsappPhoneNumber: phoneNumberInput || firstSaved('whatsappPhoneNumber', 'phoneNumber'),
        whatsappInstanceId: nextInstanceId,
        whatsappPhoneNumberId: nextInstanceId,
        whatsappAccessToken: accessTokenInput || firstSaved('whatsappAccessToken', 'accessToken'),
        whatsappApiActive: activeProvided ? toBool(activeValue) : toBool(current.whatsappApiActive),
        whatsappTestNumber: testNumberInput || firstSaved('whatsappTestNumber', 'testNumber'),
        whatsappProviderType: nextProviderType
      };
      const saved = await saveSettings(next);
      res.json({ success: true, settings: sanitizeWhatsAppSettingsForResponse(saved) });
    } catch (error) {
      console.error('Failed to save WhatsApp settings:', error.message);
      res.status(500).json({ error: 'Failed to save WhatsApp settings' });
    }
  };

  const sendTestMessage = async (req, res) => {
    try {
      const settings = await readSettings();
      const to = String(req.body?.testNumber || settings.whatsappTestNumber || '').trim();
      const phone = validatePhoneNumber(to);
      if (!phone.ok) return res.status(400).json({ error: phone.error });
      const message = String(req.body?.message || 'WhatsApp API test message from CRM.').trim();
      const sent = await testConnection({ settings, to: phone.normalized, message });
      await saveLog({
        sentByUser: String(req.body?.sentByUser || 'Admin').trim() || 'Admin',
        recipientName: 'Test Number',
        recipientPhone: phone.normalized,
        recipientType: 'Admin',
        moduleName: 'settings-test',
        templateId: 'test_message',
        message,
        status: 'sent',
        ...getProviderLogData(sent),
        apiResponse: sent.providerResponse || sent.response,
        originalPayload: { moduleName: 'settings-test' }
      });
      res.json({ success: true, message: 'Test connection succeeded.', response: sent.providerResponse || sent.response });
    } catch (error) {
      const providerLog = getProviderLogData(error);
      await saveLog({
        sentByUser: String(req.body?.sentByUser || 'Admin').trim() || 'Admin',
        recipientName: 'Test Number',
        recipientPhone: String(req.body?.testNumber || '').trim(),
        recipientType: 'Admin',
        moduleName: 'settings-test',
        templateId: 'test_message',
        message: String(req.body?.message || ''),
        status: 'failed',
        ...providerLog,
        apiResponse: providerLog.providerResponse,
        errorMessage: error.providerErrorMessage || error.message,
        originalPayload: { moduleName: 'settings-test' }
      });
      res.status(getErrorClientStatus(error)).json({ error: error.message, response: providerLog.providerResponse });
    }
  };

  const listTemplates = (req, res) => {
    res.json(getTemplates());
  };

  const createTemplate = (req, res) => {
    const template = normalizeTemplate(req.body || {});
    if (!template.templateName || !template.templateType) {
      return res.status(400).json({ error: 'Template name and type are required.' });
    }
    const templates = getTemplates();
    templates.push(template);
    saveTemplates(templates);
    res.json(template);
  };

  const updateTemplate = (req, res) => {
    const id = String(req.params.id || '').trim();
    const templates = getTemplates();
    const index = templates.findIndex((entry) => entry.id === id);
    if (index === -1) return res.status(404).json({ error: 'Template not found.' });
    templates[index] = normalizeTemplate({ ...templates[index], ...req.body, id, updatedAt: nowIso() });
    saveTemplates(templates);
    res.json(templates[index]);
  };

  const deleteTemplate = (req, res) => {
    const id = String(req.params.id || '').trim();
    const templates = getTemplates();
    const next = templates.filter((entry) => entry.id !== id);
    if (next.length === templates.length) return res.status(404).json({ error: 'Template not found.' });
    saveTemplates(next);
    res.json({ success: true });
  };

  const preview = async (req, res) => {
    const settings = await readSettings();
    const moduleType = String(req.body?.moduleType || '').trim().toLowerCase();
    const templateType = String(req.body?.templateType || '').trim().toLowerCase();
    const contextData = buildContextPayload(req.body?.contextData || {}, settings);
    const template = resolveTemplate(moduleType, templateType);
    if (!template) return res.status(404).json({ error: 'No WhatsApp template found.' });
    if (!template.isActive) return res.status(409).json({ error: `${template.templateName || template.templateType || 'WhatsApp'} template is inactive.` });

    const message = renderTemplate(template.messageBody, contextData, settings);
    res.json({
      moduleType,
      template,
      contextData,
      previewMessage: message,
      attachmentOption: template.attachmentOption,
      suggestedAttachmentUrl: String(req.body?.suggestedAttachmentUrl || contextData.attachment_url || ''),
      officialTemplateRequired: true
    });
  };

  const send = async (req, res) => {
    const settings = await readSettings();
    const body = req.body || {};
    const moduleType = String(body.moduleType || '').trim().toLowerCase();
    const templateType = String(body.templateType || '').trim().toLowerCase();
    const template = resolveTemplate(moduleType, templateType);
    const contextData = buildContextPayload(body.contextData || {}, settings);
    if (!template) return res.status(404).json({ error: 'No WhatsApp template found.' });
    if (!template.isActive) return res.status(409).json({ error: `${template.templateName || template.templateType || 'WhatsApp'} template is inactive.` });
    const message = String(body.message || renderTemplate(template?.messageBody || '', contextData, settings)).trim();
    const recipientPhone = String(body.recipientPhone || contextData.customer_phone || '').trim();
    const attachmentUrl = resolveAttachmentUrl(body.attachmentUrl, req, resolveServerOrigin);

    if (!message) return res.status(400).json({ error: 'Message body is required.' });

    const logPayload = {
      sentByUser: String(body.sentByUser || 'User').trim(),
      recipientName: String(body.recipientName || contextData.customer_name || '').trim(),
      recipientPhone,
      recipientType: String(body.recipientType || template?.sendToType || 'Customer').trim(),
      moduleName: String(body.moduleName || moduleType || 'custom').trim(),
      templateKey: String(template?.templateKey || template?.templateType || templateType || '').trim().toLowerCase(),
      templateId: String(template?.id || body.templateId || '').trim(),
      message,
      attachmentUrl,
      attachmentName: String(body.attachmentName || '').trim(),
      originalPayload: sanitizeWhatsAppLogRequest({ ...body, moduleName: body.moduleName || moduleType, templateId: template?.id || body.templateId })
    };

    try {
      const sent = attachmentUrl
        ? await sendDocumentMessage({
          settings,
          to: recipientPhone,
          message,
          attachmentUrl,
          attachmentName: logPayload.attachmentName
        })
        : await sendTextMessage({
          settings,
          to: recipientPhone,
          message,
          attachmentUrl,
          attachmentName: logPayload.attachmentName
        });

      const providerLog = getProviderLogData(sent);
      const log = await saveLog({ ...logPayload, ...providerLog, status: 'sent', apiResponse: providerLog.providerResponse });
      res.json({ success: true, log, response: providerLog.providerResponse });
    } catch (error) {
      const providerLog = getProviderLogData(error);
      const log = await saveLog({ ...logPayload, ...providerLog, status: 'failed', apiResponse: providerLog.providerResponse, errorMessage: error.providerErrorMessage || error.message });
      res.status(getErrorClientStatus(error)).json({ error: error.message, log, response: providerLog.providerResponse });
    }
  };

  const sendWithAttachment = async (req, res) => {
    try {
      const file = req.file;
      const body = req.body || {};
      let attachmentUrl = String(body.attachmentUrl || '').trim();
      let attachmentName = String(body.attachmentName || '').trim();

      if (file) {
        attachmentUrl = `${resolveServerOrigin(req)}/uploads/${file.filename}`;
        attachmentName = file.originalname;
        const attachments = getAttachments();
        attachments.unshift({
          id: `WAATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: attachmentUrl,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          createdAt: nowIso(),
          moduleName: String(body.moduleName || '').trim()
        });
        saveAttachments(attachments);
      }

      req.body = {
        ...body,
        attachmentUrl,
        attachmentName
      };

      return send(req, res);
    } catch (error) {
      res.status(400).json({ error: error.message || 'Unable to send message with attachment.' });
    }
  };

  const listLogs = (req, res) => {
    const logs = getLogs();
    res.json(logs);
  };

  const retryLog = async (req, res) => {
    const id = String(req.params.id || '').trim();
    const logs = getLogs();
    const target = logs.find((entry) => entry.id === id);
    if (!target) return res.status(404).json({ error: 'Log not found.' });

    const retryPayload = {
      ...(target.originalPayload || {}),
      message: target.message,
      recipientPhone: target.recipientPhone,
      recipientName: target.recipientName,
      recipientType: target.recipientType,
      moduleName: target.moduleName,
      templateId: target.templateId,
      attachmentUrl: target.attachmentUrl,
      attachmentName: target.attachmentName,
      sentByUser: req.body?.sentByUser || target.sentByUser || 'User'
    };

    req.body = retryPayload;
    return send(req, res);
  };

  return {
    getWhatsAppSettings,
    saveWhatsAppSettings,
    sendTestMessage,
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    preview,
    send,
    sendWithAttachment,
    listLogs,
    retryLog,
    parseJsonSafe
  };
}

module.exports = {
  createWhatsAppController
};
