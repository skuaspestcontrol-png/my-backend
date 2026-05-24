const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const validateEmailAddress = (value) => {
  const email = normalizeEmail(value);
  if (!email || !EMAIL_RE.test(email)) return { ok: false, email: '', error: 'Valid email address is required.' };
  return { ok: true, email };
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
};

const normalizeTextValue = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return '';
  return raw;
};

const firstDefined = (...values) => values.find((value) => normalizeTextValue(value) !== '');

const resolveActiveFlag = (settings = {}) => {
  if (settings.emailApiActive !== undefined) return toBool(settings.emailApiActive);
  if (settings.active !== undefined) return toBool(settings.active);
  if (settings.smtpActive !== undefined) return toBool(settings.smtpActive);
  return false;
};

const buildEmailConfig = (settings = {}) => ({
  provider: normalizeTextValue(firstDefined(settings.emailProvider, settings.mailProvider, 'SMTP')) || 'SMTP',
  smtpHost: normalizeTextValue(firstDefined(settings.smtpHost, settings.smtp_host, settings.emailSmtpHost, '')),
  smtpPort: Number(firstDefined(settings.smtpPort, settings.smtp_port, settings.emailSmtpPort, 587) || 587),
  smtpSecure: toBool(firstDefined(settings.smtpSecure, settings.smtp_secure, settings.emailSmtpSecure, false)),
  smtpUsername: normalizeTextValue(firstDefined(settings.smtpUser, settings.smtp_username, settings.smtpUsername, settings.emailSmtpUsername, '')),
  smtpPassword: normalizeTextValue(firstDefined(settings.smtpPass, settings.smtp_password, settings.smtpPassword, settings.emailSmtpPassword, '')),
  fromEmail: normalizeTextValue(firstDefined(settings.smtpFromEmail, settings.fromEmail, settings.from_email, settings.emailFromEmail, '')),
  fromName: normalizeTextValue(firstDefined(settings.smtpSenderName, settings.fromName, settings.from_name, settings.emailFromName, '')),
  replyToEmail: normalizeTextValue(firstDefined(settings.replyToEmail, settings.reply_to_email, settings.emailReplyToEmail, '')),
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
  if (attachmentUrl) {
    resolvedAttachments.push({
      filename: attachmentName || 'attachment.pdf',
      path: attachmentUrl
    });
  }
  const message = {
    from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
    to: toCheck.email,
    subject: String(subject || '').trim() || 'CRM Notification',
    html: String(htmlBody || ''),
    text: String(textBody || '').trim() || String(htmlBody || '').replace(/<[^>]+>/g, ' '),
    replyTo: config.replyToEmail || undefined,
    attachments: resolvedAttachments
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
