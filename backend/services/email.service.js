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

const buildEmailConfig = (settings = {}) => ({
  provider: String(settings.emailProvider || 'SMTP').trim(),
  smtpHost: String(settings.smtpHost || settings.emailSmtpHost || '').trim(),
  smtpPort: Number(settings.smtpPort || settings.emailSmtpPort || 587),
  smtpSecure: toBool(settings.smtpSecure ?? settings.emailSmtpSecure),
  smtpUsername: String(settings.smtpUser || settings.smtpUsername || settings.emailSmtpUsername || '').trim(),
  smtpPassword: String(settings.smtpPass || settings.smtpPassword || settings.emailSmtpPassword || '').trim(),
  fromEmail: String(settings.smtpFromEmail || settings.fromEmail || settings.emailFromEmail || '').trim(),
  fromName: String(settings.smtpSenderName || settings.fromName || settings.emailFromName || '').trim(),
  replyToEmail: String(settings.replyToEmail || settings.emailReplyToEmail || '').trim(),
  active: toBool(settings.emailApiActive)
});

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

const sendEmailMessage = async ({ settings, to, subject, htmlBody, textBody, attachmentUrl, attachmentName }) => {
  const config = buildEmailConfig(settings);
  const toCheck = validateEmailAddress(to);
  if (!toCheck.ok) throw new Error(toCheck.error);
  if (!config.active) throw new Error('Email API is inactive.');
  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword || !config.fromEmail) {
    throw new Error('Email SMTP credentials are incomplete.');
  }

  const transporter = createTransporter(config);
  const message = {
    from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
    to: toCheck.email,
    subject: String(subject || '').trim() || 'CRM Notification',
    html: String(htmlBody || ''),
    text: String(textBody || '').trim() || String(htmlBody || '').replace(/<[^>]+>/g, ' '),
    replyTo: config.replyToEmail || undefined,
    attachments: []
  };

  if (attachmentUrl) {
    message.attachments.push({
      filename: attachmentName || 'attachment.pdf',
      path: attachmentUrl
    });
  }

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
  sendEmailMessage
};
