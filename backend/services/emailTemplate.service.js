const DEFAULT_EMAIL_TEMPLATE_DEFS = [
  { templateKey: 'lead_welcome', templateName: 'Lead Welcome', templateType: 'lead_welcome', sendToType: 'Customer', emailSubject: 'Welcome from {{company_name}}', attachmentOption: 'None', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>Thank you for contacting {{company_name}}. Our team will connect shortly.<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'invoice_send', templateName: 'Invoice Send', templateType: 'invoice_send', sendToType: 'Customer', emailSubject: 'Invoice {{invoice_no}} from {{company_name}}', attachmentOption: 'Invoice PDF', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>Thank you for choosing {{company_name}}.<br/><br/>Your invoice {{invoice_no}} of ₹{{invoice_amount}} has been generated.<br/><br/>Please find the invoice attached.<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'payment_reminder', templateName: 'Payment Reminder', templateType: 'payment_reminder', sendToType: 'Customer', emailSubject: 'Payment reminder for invoice {{invoice_no}}', attachmentOption: 'Invoice PDF', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>This is a reminder for invoice {{invoice_no}} amount ₹{{invoice_amount}} due on {{due_date}}.<br/><br/>Payment link: {{payment_link}}<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'quotation_send', templateName: 'Quotation Send', templateType: 'quotation_send', sendToType: 'Customer', emailSubject: 'Quotation {{quotation_no}} from {{company_name}}', attachmentOption: 'Quotation PDF', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>Please find quotation {{quotation_no}} attached for your review.<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'service_reminder', templateName: 'Service Reminder', templateType: 'service_reminder', sendToType: 'Customer', emailSubject: 'Service reminder - {{service_type}}', attachmentOption: 'None', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>Service reminder for {{service_type}} at {{address}} on {{job_date}} {{job_time}}.<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'service_completed', templateName: 'Service Completed', templateType: 'service_completed', sendToType: 'Customer', emailSubject: 'Service completed - {{service_type}}', attachmentOption: 'Service Report PDF', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>Your service {{service_type}} is completed. Service report attached.<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'renewal_reminder', templateName: 'Renewal Reminder', templateType: 'renewal_reminder', sendToType: 'Customer', emailSubject: 'Renewal reminder from {{company_name}}', attachmentOption: 'None', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>Your service plan renewal is due soon. Please contact us to renew.<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'job_assigned_technician', templateName: 'Job Assigned to Technician', templateType: 'job_assigned_technician', sendToType: 'Technician', emailSubject: 'New job assigned - {{job_date}} {{job_time}}', attachmentOption: 'Manual Upload', isActive: true, emailBody: 'New job assigned.<br/><br/>Customer: {{customer_name}}<br/>Phone: {{customer_phone}}<br/>Service: {{service_type}}<br/>Address: {{address}}<br/>Date: {{job_date}}<br/>Time: {{job_time}}<br/><br/>Please check your technician app.' },
  { templateKey: 'lead_assigned_sales', templateName: 'Lead Assigned to Sales', templateType: 'lead_assigned_sales', sendToType: 'Sales', emailSubject: 'Lead assigned - {{customer_name}}', attachmentOption: 'None', isActive: true, emailBody: 'Lead assigned to you.<br/><br/>Customer: {{customer_name}}<br/>Email: {{customer_email}}<br/>Phone: {{customer_phone}}<br/>Address: {{address}}<br/><br/>Regards,<br/>{{company_name}}' },
  { templateKey: 'custom_email', templateName: 'Custom Email', templateType: 'custom_email', sendToType: 'Admin', emailSubject: 'Custom email from {{company_name}}', attachmentOption: 'Manual Upload', isActive: true, emailBody: 'Dear {{customer_name}},<br/><br/>{{company_name}} update: {{service_type}}<br/><br/>Regards,<br/>{{company_name}}' }
];

const TEMPLATE_TYPE_BY_MODULE = {
  lead: 'lead_welcome',
  invoice: 'invoice_send',
  payment: 'payment_reminder',
  quotation: 'quotation_send',
  service: 'service_reminder',
  renewal: 'renewal_reminder',
  job: 'job_assigned_technician'
};

const ALLOWED_ATTACHMENT_OPTIONS = new Set(['None', 'Invoice PDF', 'Quotation PDF', 'Service Report PDF', 'Manual Upload']);

const normalizeEmailTemplate = (template = {}) => {
  const now = new Date().toISOString();
  const attachmentOption = ALLOWED_ATTACHMENT_OPTIONS.has(String(template.attachmentOption || '').trim())
    ? String(template.attachmentOption || '').trim()
    : 'None';

  return {
    id: String(template.id || template._id || `EMTPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    templateKey: String(template.templateKey || template.templateType || '').trim().toLowerCase(),
    templateName: String(template.templateName || '').trim(),
    templateType: String(template.templateType || '').trim().toLowerCase(),
    sendToType: String(template.sendToType || 'Customer').trim(),
    emailSubject: String(template.emailSubject || '').trim(),
    emailBody: String(template.emailBody || '').trim(),
    attachmentOption,
    isActive: Boolean(template.isActive),
    createdAt: String(template.createdAt || now),
    updatedAt: String(template.updatedAt || now)
  };
};

const ensureDefaultEmailTemplates = (templates = []) => {
  const list = Array.isArray(templates) ? templates.map(normalizeEmailTemplate) : [];
  const hasType = new Set(list.map((entry) => entry.templateType));
  const next = [...list];
  DEFAULT_EMAIL_TEMPLATE_DEFS.forEach((tpl) => {
    if (hasType.has(tpl.templateType)) return;
    next.push(normalizeEmailTemplate(tpl));
  });
  return next;
};

const getEmailTemplateTypeFromModule = (moduleType = '') => TEMPLATE_TYPE_BY_MODULE[String(moduleType || '').trim().toLowerCase()] || 'custom_email';

const replaceTemplateVariables = (value = '', payload = {}) => {
  const safe = payload && typeof payload === 'object' ? payload : {};
  return String(value || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const found = safe[key];
    if (found === undefined || found === null) return '';
    return String(found);
  });
};

module.exports = {
  DEFAULT_EMAIL_TEMPLATE_DEFS,
  TEMPLATE_TYPE_BY_MODULE,
  ALLOWED_ATTACHMENT_OPTIONS,
  normalizeEmailTemplate,
  ensureDefaultEmailTemplates,
  getEmailTemplateTypeFromModule,
  replaceTemplateVariables
};
