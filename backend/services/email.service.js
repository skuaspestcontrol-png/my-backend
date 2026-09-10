const fs = require('fs');
const path = require('path');
const { safeFetch } = require('../lib/safeFetch');
const { safeLocalFile } = require('../lib/security');
const nodemailer = require('nodemailer');
const {
  decryptSecret,
  isEncryptedSecret
} = require('../lib/secretCrypto');

const EMAIL_SECRET_KEY = process.env.SMTP_ENCRYPTION_KEY
  || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  || process.env.APP_API_KEY
  || process.env.SKUAS_API_KEY
  || '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const validateEmailAddress = (value) => {
  const email = normalizeEmail(value);
  if (!email || email.length > 254 || /[\r\n,;<>]/.test(email) || !EMAIL_RE.test(email)) return { ok: false, email: '', error: 'Valid email address is required.' };
  return { ok: true, email };
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const resolveActiveFlag = (settings = {}) => {
  if (settings.emailApiActive !== undefined) return toBool(settings.emailApiActive);
  if (settings.active !== undefined) return toBool(settings.active);
  if (settings.smtpActive !== undefined) return toBool(settings.smtpActive);
  return false;
};

const buildEmailConfig = (settings = {}) => ({
  provider: String(firstDefined(settings.emailProvider, settings.mailProvider, 'SMTP')).trim(),
  smtpHost: String(firstDefined(settings.smtpHost, settings.smtp_host, settings.emailSmtpHost, '')).trim(),
  smtpPort: Number(firstDefined(settings.smtpPort, settings.smtp_port, settings.emailSmtpPort, 587) || 587),
  smtpSecure: toBool(firstDefined(settings.smtpSecure, settings.smtp_secure, settings.emailSmtpSecure, false)),
  smtpUsername: String(firstDefined(settings.smtpUser, settings.smtp_username, settings.smtpUsername, settings.emailSmtpUsername, '')).trim(),
  smtpPassword: (() => {
    const raw = String(firstDefined(settings.smtpPass, settings.smtp_password, settings.smtpPassword, settings.emailSmtpPassword, '') || '').trim();
    if (!raw) return '';
    if (!isEncryptedSecret(raw)) return raw;
    return decryptSecret(raw, EMAIL_SECRET_KEY);
  })(),
  fromEmail: String(firstDefined(settings.smtpFromEmail, settings.fromEmail, settings.from_email, settings.emailFromEmail, '')).trim(),
  fromName: String(firstDefined(settings.smtpSenderName, settings.fromName, settings.from_name, settings.emailFromName, '')).trim(),
  replyToEmail: String(firstDefined(settings.replyToEmail, settings.reply_to_email, settings.emailReplyToEmail, '')).trim(),
  active: resolveActiveFlag(settings)
});

const normalizeEmailSettings = (settings = {}) => buildEmailConfig(settings || {});

const getEmailSettings = async ({ settings, loadSettings } = {}) => {
  const rawSettings = settings && typeof settings === 'object'
    ? settings
    : typeof loadSettings === 'function'
      ? await loadSettings()
      : {};
  return normalizeEmailSettings(rawSettings || {});
};

const createTransporter = (config) => {
  return nodemailer.createTransport({
    disableFileAccess: true,
    disableUrlAccess: true,
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUsername,
      pass: config.smtpPassword
    }
  });
};

const sendEmailMessage = async ({
  settings,
  loadSettings,
  to,
  subject,
  htmlBody,
  textBody,
  attachmentUrl,
  attachmentName,
  attachments = []
}) => {
  const config = await getEmailSettings({ settings, loadSettings });
  const toCheck = validateEmailAddress(to);
  if (!toCheck.ok) throw new Error(toCheck.error);
  if (!config.active) throw new Error('Email API is inactive. Enable Email API / SMTP Active in Settings.');
  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword || !config.fromEmail) {
    throw new Error('Email SMTP credentials are incomplete.');
  }

  const transporter = createTransporter(config);
  const resolvedAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (attachmentUrl && !/^https:\/\//i.test(String(attachmentUrl))) throw new Error('Attachment URL must use HTTPS');
  if (attachmentUrl) {
    resolvedAttachments.push({
      filename: attachmentName || 'attachment.pdf',
      path: attachmentUrl
    });
  }
  if (resolvedAttachments.length > 10) throw new Error('Too many attachments');
  const safeAttachments = [];
  for (const attachment of resolvedAttachments) {
    let content = attachment.content;
    if (attachment.path) {
      if (/^https:\/\//i.test(attachment.path)) {
        const response = await safeFetch(attachment.path);
        if (!response.ok) throw new Error('Unable to load attachment');
        content = Buffer.from(await response.arrayBuffer());
      } else {
        const roots = [process.env.UPLOADS_DIR, process.env.UPLOADS_ROOT, process.env.UPLOADS_ROOT_DIR, path.join(process.env.HOME || '', 'uploads-skuas-crm'), path.join(__dirname, '..', '..', 'storage', 'uploads'), path.join(__dirname, '..', 'uploads')].filter(Boolean);
        const file = roots.map(root => safeLocalFile(root, attachment.path)).find(Boolean);
        if (!file || fs.statSync(file).size > 8 * 1024 * 1024) throw new Error('Attachment path is not allowed');
        content = fs.readFileSync(file);
      }
    }
    if (!Buffer.isBuffer(content) && typeof content !== 'string') throw new Error('Invalid attachment content');
    if (Buffer.byteLength(content) > 8 * 1024 * 1024) throw new Error('Attachment is too large');
    safeAttachments.push({ filename: path.basename(String(attachment.filename || 'attachment.pdf')), content, contentType: attachment.contentType });
  }
  for (const value of [subject, config.fromName, config.fromEmail, config.replyToEmail]) {
    if (/[\r\n]/.test(String(value || ''))) throw new Error('Invalid email header');
  }
  const message = {
    from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
    to: toCheck.email,
    subject: String(subject || '').trim() || 'CRM Notification',
    html: String(htmlBody || ''),
    text: String(textBody || '').trim() || String(htmlBody || '').replace(/<[^>]+>/g, ' '),
    replyTo: config.replyToEmail || undefined,
    attachments: safeAttachments
  };

  const info = await transporter.sendMail(message);
  return {
    success: true,
    normalizedEmail: toCheck.email,
    provider: config.provider,
    response: {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    }
  };
};

module.exports = {
  normalizeEmail,
  validateEmailAddress,
  buildEmailConfig,
  normalizeEmailSettings,
  getEmailSettings,
  createTransporter,
  sendEmailMessage
};
