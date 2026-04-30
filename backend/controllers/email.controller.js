const fs = require('fs');
const path = require('path');
const {
  ensureDefaultEmailTemplates,
  normalizeEmailTemplate,
  getEmailTemplateTypeFromModule,
  replaceTemplateVariables
} = require('../services/emailTemplate.service');
const { sendEmailMessage, validateEmailAddress } = require('../services/email.service');

const nowIso = () => new Date().toISOString();
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const parseJsonSafe = (raw, fallback) => {
  try { return JSON.parse(raw); } catch (error) { return fallback; }
};

function createEmailController(deps) {
  const {
    dataDir,
    settingsFile,
    readJsonFile,
    withMysqlConnection,
    resolveServerOrigin
  } = deps;

  const templatesFile = path.join(dataDir, 'email_templates.json');
  const logsFile = path.join(dataDir, 'email_message_logs.json');
  const attachmentsFile = path.join(dataDir, 'email_attachments.json');

  const writeJsonFile = (filePath, value) => fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  const readSettings = () => {
    const raw = readJsonFile(settingsFile, {});
    return raw && typeof raw === 'object' ? raw : {};
  };
  const saveSettings = (next) => writeJsonFile(settingsFile, next);

  const getTemplates = () => {
    const list = ensureDefaultEmailTemplates(readJsonFile(templatesFile, []));
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
          `INSERT INTO email_message_logs
          (id, sent_at, sent_by_user, recipient_name, recipient_email, recipient_type, module_name, template_id, email_subject, email_body, attachment_url, status, provider_response, error_message, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            log.id,
            log.sentAt,
            log.sentByUser,
            log.recipientName,
            log.recipientEmail,
            log.recipientType,
            log.moduleName,
            log.templateId,
            log.subject,
            log.body,
            log.attachmentUrl,
            log.status,
            JSON.stringify(log.providerResponse || {}),
            log.errorMessage,
            JSON.stringify(log.originalPayload || {})
          ]
        );
      });
    } catch (error) {
      console.error('MySQL email log write failed:', error.message);
    }
  };

  const saveLog = async (payload) => {
    const entry = {
      id: `EMLOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sentAt: nowIso(),
      sentByUser: String(payload.sentByUser || 'System').trim(),
      recipientName: String(payload.recipientName || '').trim(),
      recipientEmail: String(payload.recipientEmail || '').trim(),
      recipientType: String(payload.recipientType || '').trim(),
      moduleName: String(payload.moduleName || '').trim(),
      templateId: String(payload.templateId || '').trim(),
      subject: String(payload.subject || '').trim(),
      body: String(payload.body || ''),
      attachmentUrl: String(payload.attachmentUrl || ''),
      attachmentName: String(payload.attachmentName || ''),
      status: String(payload.status || 'pending'),
      providerResponse: payload.providerResponse || null,
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
    const targetType = String(templateType || getEmailTemplateTypeFromModule(moduleType)).trim().toLowerCase();
    return templates.find((entry) => entry.isActive && entry.templateType === targetType)
      || templates.find((entry) => entry.templateType === 'custom_email')
      || templates[0];
  };

  const buildContextPayload = (payload = {}, settings = {}) => {
    const safe = payload && typeof payload === 'object' ? payload : {};
    return {
      customer_name: safe.customer_name || safe.customerName || '',
      customer_email: safe.customer_email || safe.customerEmail || '',
      customer_phone: safe.customer_phone || safe.customerPhone || '',
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

  const getEmailSettings = (req, res) => {
    const settings = readSettings();
    res.json({
      mailProvider: settings.emailProvider || 'SMTP',
      smtpHost: settings.smtpHost || '',
      smtpPort: Number(settings.smtpPort || 587),
      smtpSecure: Boolean(settings.smtpSecure),
      smtpUsername: settings.smtpUser || '',
      smtpPassword: settings.smtpPass || '',
      fromEmail: settings.smtpFromEmail || '',
      fromName: settings.smtpSenderName || '',
      replyToEmail: settings.replyToEmail || '',
      active: Boolean(settings.emailApiActive),
      testEmailAddress: settings.smtpTestTargetEmail || ''
    });
  };

  const saveEmailSettings = (req, res) => {
    const body = req.body || {};
    const current = readSettings();
    const next = {
      ...current,
      emailProvider: String(body.mailProvider || 'SMTP').trim(),
      smtpHost: String(body.smtpHost || '').trim(),
      smtpPort: Number(body.smtpPort || 587),
      smtpSecure: Boolean(body.smtpSecure),
      smtpUser: String(body.smtpUsername || '').trim(),
      smtpPass: String(body.smtpPassword || '').trim(),
      smtpFromEmail: String(body.fromEmail || '').trim(),
      smtpSenderName: String(body.fromName || '').trim(),
      replyToEmail: String(body.replyToEmail || '').trim(),
      emailApiActive: Boolean(body.active),
      smtpTestTargetEmail: String(body.testEmailAddress || '').trim(),
      smtpActive: Boolean(body.active) ? 'Yes' : 'No'
    };
    saveSettings(next);
    res.json({ success: true, settings: next });
  };

  const sendTestEmail = async (req, res) => {
    try {
      const settings = readSettings();
      const to = String(req.body?.testEmailAddress || settings.smtpTestTargetEmail || '').trim();
      const check = validateEmailAddress(to);
      if (!check.ok) return res.status(400).json({ error: check.error });
      const subject = String(req.body?.subject || 'CRM Email API test message').trim();
      const htmlBody = String(req.body?.body || '<p>This is a test email from CRM Email API settings.</p>');
      const sent = await sendEmailMessage({ settings, to: check.email, subject, htmlBody });
      await saveLog({
        sentByUser: String(req.body?.sentByUser || 'Admin').trim() || 'Admin',
        recipientName: 'Test Recipient',
        recipientEmail: check.email,
        recipientType: 'Admin',
        moduleName: 'settings-test',
        templateId: 'test_email',
        subject,
        body: htmlBody,
        status: 'sent',
        providerResponse: sent.response,
        originalPayload: { test: true }
      });
      res.json({ success: true, response: sent.response });
    } catch (error) {
      await saveLog({
        sentByUser: String(req.body?.sentByUser || 'Admin').trim() || 'Admin',
        recipientName: 'Test Recipient',
        recipientEmail: String(req.body?.testEmailAddress || '').trim(),
        recipientType: 'Admin',
        moduleName: 'settings-test',
        templateId: 'test_email',
        subject: String(req.body?.subject || ''),
        body: String(req.body?.body || ''),
        status: 'failed',
        providerResponse: null,
        errorMessage: error.message,
        originalPayload: { test: true }
      });
      res.status(400).json({ error: error.message });
    }
  };

  const listTemplates = (req, res) => res.json(getTemplates());

  const createTemplate = (req, res) => {
    const template = normalizeEmailTemplate(req.body || {});
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
    templates[index] = normalizeEmailTemplate({ ...templates[index], ...req.body, id, updatedAt: nowIso() });
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
    if (!template) return res.status(404).json({ error: 'No email template found.' });

    res.json({
      moduleType,
      template,
      contextData,
      previewSubject: replaceTemplateVariables(template.emailSubject, contextData),
      previewBody: replaceTemplateVariables(template.emailBody, contextData),
      attachmentOption: template.attachmentOption,
      suggestedAttachmentUrl: String(req.body?.suggestedAttachmentUrl || contextData.attachment_url || '')
    });
  };

  const send = async (req, res) => {
    const settings = readSettings();
    const body = req.body || {};
    const moduleType = String(body.moduleType || '').trim().toLowerCase();
    const templateType = String(body.templateType || '').trim().toLowerCase();
    const template = resolveTemplate(moduleType, templateType);
    const contextData = buildContextPayload(body.contextData || {}, settings);

    const subject = String(body.subject || replaceTemplateVariables(template?.emailSubject || '', contextData)).trim();
    const emailBody = String(body.body || replaceTemplateVariables(template?.emailBody || '', contextData)).trim();
    const recipientEmail = String(body.recipientEmail || contextData.customer_email || '').trim();

    if (!subject) return res.status(400).json({ error: 'Email subject is required.' });
    if (!emailBody) return res.status(400).json({ error: 'Email body is required.' });

    const logPayload = {
      sentByUser: String(body.sentByUser || 'User').trim(),
      recipientName: String(body.recipientName || contextData.customer_name || '').trim(),
      recipientEmail,
      recipientType: String(body.recipientType || template?.sendToType || 'Customer').trim(),
      moduleName: String(body.moduleName || moduleType || 'custom').trim(),
      templateId: String(template?.id || body.templateId || '').trim(),
      subject,
      body: emailBody,
      attachmentUrl: String(body.attachmentUrl || '').trim(),
      attachmentName: String(body.attachmentName || '').trim(),
      originalPayload: body
    };

    try {
      const sent = await sendEmailMessage({
        settings,
        to: recipientEmail,
        subject,
        htmlBody: emailBody,
        attachmentUrl: logPayload.attachmentUrl,
        attachmentName: logPayload.attachmentName
      });

      const log = await saveLog({ ...logPayload, status: 'sent', providerResponse: sent.response });
      res.json({ success: true, log, response: sent.response });
    } catch (error) {
      const log = await saveLog({ ...logPayload, status: 'failed', providerResponse: null, errorMessage: error.message });
      res.status(400).json({ error: error.message, log });
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
          id: `EMATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: attachmentUrl,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          moduleName: String(body.moduleName || '').trim(),
          createdAt: nowIso()
        });
        saveAttachments(attachments);
      }

      req.body = { ...body, attachmentUrl, attachmentName };
      return send(req, res);
    } catch (error) {
      res.status(400).json({ error: error.message || 'Unable to send email with attachment.' });
    }
  };

  const listLogs = (req, res) => res.json(getLogs());

  const retryLog = async (req, res) => {
    const id = String(req.params.id || '').trim();
    const logs = getLogs();
    const target = logs.find((entry) => entry.id === id);
    if (!target) return res.status(404).json({ error: 'Log not found.' });

    req.body = {
      ...(target.originalPayload || {}),
      subject: target.subject,
      body: target.body,
      recipientEmail: target.recipientEmail,
      recipientName: target.recipientName,
      recipientType: target.recipientType,
      moduleName: target.moduleName,
      templateId: target.templateId,
      attachmentUrl: target.attachmentUrl,
      attachmentName: target.attachmentName,
      sentByUser: req.body?.sentByUser || target.sentByUser || 'User'
    };

    return send(req, res);
  };

  return {
    getEmailSettings,
    saveEmailSettings,
    sendTestEmail,
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
  createEmailController
};
