const fs = require('fs');
const path = require('path');
const {
  ensureDefaultTemplates,
  normalizeTemplate,
  getTemplateTypeFromModule,
  replaceVariables
} = require('../services/whatsappTemplate.service');
const {
  sendWhatsAppMessage,
  validatePhoneNumber
} = require('../services/whatsapp.service');

const nowIso = () => new Date().toISOString();

const parseJsonSafe = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

function createWhatsAppController(deps) {
  const {
    dataDir,
    uploadsDir,
    settingsFile,
    readJsonFile,
    withMysqlConnection,
    resolveServerOrigin
  } = deps;

  const templatesFile = path.join(dataDir, 'whatsapp_templates.json');
  const logsFile = path.join(dataDir, 'whatsapp_message_logs.json');
  const attachmentsFile = path.join(dataDir, 'whatsapp_attachments.json');

  const writeJsonFile = (filePath, value) => {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  };

  const readSettings = () => {
    const raw = readJsonFile(settingsFile, {});
    return raw && typeof raw === 'object' ? raw : {};
  };

  const saveSettings = (next) => writeJsonFile(settingsFile, next);

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
      templateId: String(payload.templateId || '').trim(),
      message: String(payload.message || ''),
      attachmentUrl: String(payload.attachmentUrl || ''),
      attachmentName: String(payload.attachmentName || ''),
      status: String(payload.status || 'pending'),
      apiResponse: payload.apiResponse || null,
      errorMessage: String(payload.errorMessage || ''),
      originalPayload: payload.originalPayload || {},
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
    const template = templates.find((entry) => entry.isActive && entry.templateType === targetType)
      || templates.find((entry) => entry.templateType === 'custom_message')
      || templates[0];
    return template;
  };

  const buildContextPayload = (payload = {}, settings = {}) => {
    const safe = payload && typeof payload === 'object' ? payload : {};
    return {
      customer_name: safe.customer_name || safe.customerName || '',
      customer_phone: safe.customer_phone || safe.customerPhone || safe.phone || '',
      service_type: safe.service_type || safe.serviceType || '',
      address: safe.address || '',
      invoice_no: safe.invoice_no || safe.invoiceNumber || '',
      invoice_amount: safe.invoice_amount || safe.invoiceAmount || '',
      due_date: safe.due_date || safe.dueDate || '',
      quotation_no: safe.quotation_no || safe.quotationNumber || '',
      technician_name: safe.technician_name || safe.technicianName || '',
      sales_person_name: safe.sales_person_name || safe.salesPersonName || '',
      job_date: safe.job_date || safe.jobDate || '',
      job_time: safe.job_time || safe.jobTime || '',
      company_name: safe.company_name || settings.companyName || 'SKUAS Pest Control',
      payment_link: safe.payment_link || safe.paymentLink || '',
      ...safe
    };
  };

  const getWhatsAppSettings = (req, res) => {
    const settings = readSettings();
    res.json({
      apiBaseUrl: settings.whatsappApiBaseUrl || '',
      phoneNumber: settings.whatsappPhoneNumber || '',
      instanceId: settings.whatsappInstanceId || settings.whatsappPhoneNumberId || '',
      accessToken: settings.whatsappAccessToken || '',
      active: Boolean(settings.whatsappApiActive),
      testNumber: settings.whatsappTestNumber || '',
      providerType: settings.whatsappProviderType || 'custom'
    });
  };

  const saveWhatsAppSettings = (req, res) => {
    const body = req.body || {};
    const current = readSettings();
    const next = {
      ...current,
      whatsappApiBaseUrl: String(body.apiBaseUrl || '').trim(),
      whatsappPhoneNumber: String(body.phoneNumber || '').trim(),
      whatsappInstanceId: String(body.instanceId || '').trim(),
      whatsappPhoneNumberId: String(body.instanceId || '').trim(),
      whatsappAccessToken: String(body.accessToken || '').trim(),
      whatsappApiActive: Boolean(body.active),
      whatsappTestNumber: String(body.testNumber || '').trim(),
      whatsappProviderType: String(body.providerType || 'custom').trim().toLowerCase()
    };
    saveSettings(next);
    res.json({ success: true, settings: next });
  };

  const sendTestMessage = async (req, res) => {
    try {
      const settings = readSettings();
      const to = String(req.body?.testNumber || settings.whatsappTestNumber || '').trim();
      const phone = validatePhoneNumber(to);
      if (!phone.ok) return res.status(400).json({ error: phone.error });
      const message = String(req.body?.message || 'WhatsApp API test message from CRM.').trim();
      const sent = await sendWhatsAppMessage({ settings, to: phone.normalized, message });
      await saveLog({
        sentByUser: String(req.body?.sentByUser || 'Admin').trim() || 'Admin',
        recipientName: 'Test Number',
        recipientPhone: phone.normalized,
        recipientType: 'Admin',
        moduleName: 'settings-test',
        templateId: 'test_message',
        message,
        status: 'sent',
        apiResponse: sent.response,
        originalPayload: { test: true }
      });
      res.json({ success: true, response: sent.response });
    } catch (error) {
      await saveLog({
        sentByUser: String(req.body?.sentByUser || 'Admin').trim() || 'Admin',
        recipientName: 'Test Number',
        recipientPhone: String(req.body?.testNumber || '').trim(),
        recipientType: 'Admin',
        moduleName: 'settings-test',
        templateId: 'test_message',
        message: String(req.body?.message || ''),
        status: 'failed',
        apiResponse: error.response || null,
        errorMessage: error.message,
        originalPayload: { test: true }
      });
      res.status(400).json({ error: error.message, response: error.response || null });
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

  const preview = (req, res) => {
    const settings = readSettings();
    const moduleType = String(req.body?.moduleType || '').trim().toLowerCase();
    const templateType = String(req.body?.templateType || '').trim().toLowerCase();
    const contextData = buildContextPayload(req.body?.contextData || {}, settings);
    const template = resolveTemplate(moduleType, templateType);
    if (!template) return res.status(404).json({ error: 'No WhatsApp template found.' });

    const message = replaceVariables(template.messageBody, contextData);
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
    const settings = readSettings();
    const body = req.body || {};
    const moduleType = String(body.moduleType || '').trim().toLowerCase();
    const templateType = String(body.templateType || '').trim().toLowerCase();
    const template = resolveTemplate(moduleType, templateType);
    const contextData = buildContextPayload(body.contextData || {}, settings);
    const message = String(body.message || replaceVariables(template?.messageBody || '', contextData)).trim();
    const recipientPhone = String(body.recipientPhone || contextData.customer_phone || '').trim();

    if (!message) return res.status(400).json({ error: 'Message body is required.' });

    const logPayload = {
      sentByUser: String(body.sentByUser || 'User').trim(),
      recipientName: String(body.recipientName || contextData.customer_name || '').trim(),
      recipientPhone,
      recipientType: String(body.recipientType || template?.sendToType || 'Customer').trim(),
      moduleName: String(body.moduleName || moduleType || 'custom').trim(),
      templateId: String(template?.id || body.templateId || '').trim(),
      message,
      attachmentUrl: String(body.attachmentUrl || '').trim(),
      attachmentName: String(body.attachmentName || '').trim(),
      originalPayload: body
    };

    try {
      const sent = await sendWhatsAppMessage({
        settings,
        to: recipientPhone,
        message,
        attachmentUrl: logPayload.attachmentUrl,
        attachmentName: logPayload.attachmentName
      });

      const log = await saveLog({ ...logPayload, status: 'sent', apiResponse: sent.response });
      res.json({ success: true, log, response: sent.response });
    } catch (error) {
      const log = await saveLog({ ...logPayload, status: 'failed', apiResponse: error.response || null, errorMessage: error.message });
      res.status(400).json({ error: error.message, log, response: error.response || null });
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
