const DEFAULT_TEMPLATE_DEFS = [
  { templateKey: 'lead_welcome', templateName: 'Lead Welcome', templateType: 'lead_welcome', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nThank you for contacting {{company_name}}. Our team will connect with you shortly.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'invoice_send', templateName: 'Invoice Send', templateType: 'invoice_send', sendToType: 'Customer', attachmentOption: 'Invoice PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nThank you for choosing {{company_name}}.\n\nYour invoice {{invoice_no}} of ₹{{invoice_amount}} has been generated.\n\nPlease find the invoice attached.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'payment_reminder', templateName: 'Payment Reminder', templateType: 'payment_reminder', sendToType: 'Customer', attachmentOption: 'Invoice PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nThis is a reminder for invoice {{invoice_no}} amount ₹{{invoice_amount}} due on {{due_date}}.\n\nPayment link: {{payment_link}}\n\nRegards,\n{{company_name}}' },
  { templateKey: 'quotation_send', templateName: 'Quotation Send', templateType: 'quotation_send', sendToType: 'Customer', attachmentOption: 'Quotation PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nPlease find quotation {{quotation_no}} attached for your review.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'service_reminder', templateName: 'Service Reminder', templateType: 'service_reminder', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nService reminder for {{service_type}} at {{address}} on {{job_date}} {{job_time}}.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'service_completed', templateName: 'Service Completed', templateType: 'service_completed', sendToType: 'Customer', attachmentOption: 'Service Report PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nYour service {{service_type}} is completed. Service report attached.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'renewal_reminder', templateName: 'Renewal Reminder', templateType: 'renewal_reminder', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nYour service plan renewal is due soon. Please contact us to renew.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'job_assigned_technician', templateName: 'Job Assigned to Technician', templateType: 'job_assigned_technician', sendToType: 'Technician', attachmentOption: 'Manual Upload', isActive: true, messageBody: 'New job assigned.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nService: {{service_type}}\nAddress: {{address}}\nDate: {{job_date}}\nTime: {{job_time}}\n\nPlease check your technician app.' },
  { templateKey: 'lead_assigned_sales', templateName: 'Lead Assigned to Sales', templateType: 'lead_assigned_sales', sendToType: 'Sales', attachmentOption: 'None', isActive: true, messageBody: 'Lead assigned to you.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nAddress: {{address}}\n\nRegards,\n{{company_name}}' },
  { templateKey: 'custom_message', templateName: 'Custom Message', templateType: 'custom_message', sendToType: 'Admin', attachmentOption: 'Manual Upload', isActive: true, messageBody: 'Dear {{customer_name}},\n\n{{company_name}} update: {{service_type}}\n\nRegards,\n{{company_name}}' }
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

const normalizeTemplate = (template = {}) => {
  const now = new Date().toISOString();
  const attachmentOption = ALLOWED_ATTACHMENT_OPTIONS.has(String(template.attachmentOption || '').trim())
    ? String(template.attachmentOption || '').trim()
    : 'None';
  return {
    id: String(template.id || template._id || `WATPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    templateKey: String(template.templateKey || template.templateType || '').trim().toLowerCase(),
    templateName: String(template.templateName || '').trim(),
    templateType: String(template.templateType || '').trim().toLowerCase(),
    sendToType: String(template.sendToType || 'Customer').trim(),
    messageBody: String(template.messageBody || '').trim(),
    attachmentOption,
    isActive: Boolean(template.isActive),
    officialTemplateName: String(template.officialTemplateName || '').trim(),
    updatedAt: String(template.updatedAt || now),
    createdAt: String(template.createdAt || now)
  };
};

const ensureDefaultTemplates = (templates = []) => {
  const list = Array.isArray(templates) ? templates.map(normalizeTemplate) : [];
  const hasType = new Set(list.map((entry) => entry.templateType));
  const next = [...list];
  DEFAULT_TEMPLATE_DEFS.forEach((tpl) => {
    if (hasType.has(tpl.templateType)) return;
    next.push(normalizeTemplate(tpl));
  });
  return next;
};

const getTemplateTypeFromModule = (moduleType = '') => TEMPLATE_TYPE_BY_MODULE[String(moduleType || '').trim().toLowerCase()] || 'custom_message';

const replaceVariables = (messageBody = '', payload = {}) => {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  return String(messageBody || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = safePayload[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

module.exports = {
  DEFAULT_TEMPLATE_DEFS,
  TEMPLATE_TYPE_BY_MODULE,
  ALLOWED_ATTACHMENT_OPTIONS,
  normalizeTemplate,
  ensureDefaultTemplates,
  getTemplateTypeFromModule,
  replaceVariables
};
