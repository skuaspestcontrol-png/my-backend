const DEFAULT_TEMPLATE_DEFS = [
  { templateKey: 'lead_welcome', templateName: 'Lead Welcome', templateType: 'lead_welcome', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nThank you for contacting {{company_name}}. Our team will connect with you shortly.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'lead_follow_up', templateName: 'Lead Follow Up', templateType: 'lead_follow_up', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nJust following up on your enquiry with {{company_name}}. Please let us know if you need any help.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'invoice_send', templateName: 'Invoice Send', templateType: 'invoice_send', sendToType: 'Customer', attachmentOption: 'Invoice PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nThank you for choosing {{company_name}}.\n\nYour invoice {{invoice_no}} of ₹{{invoice_amount}} has been generated.\n\nPlease find the invoice attached.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'payment_reminder', templateName: 'Payment Reminder', templateType: 'payment_reminder', sendToType: 'Customer', attachmentOption: 'Invoice PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nThis is a reminder for invoice {{invoice_no}} amount ₹{{invoice_amount}} due on {{due_date}}.\n\nPayment link: {{payment_link}}\n\nRegards,\n{{company_name}}' },
  { templateKey: 'payment_received', templateName: 'Payment Received', templateType: 'payment_received', sendToType: 'Customer', attachmentOption: 'Receipt PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nWe have received your payment for invoice {{invoice_no}}.\n\nAmount received: ₹{{invoice_amount}}\n\nThank you for choosing {{company_name}}.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'quotation_send', templateName: 'Quotation Send', templateType: 'quotation_send', sendToType: 'Customer', attachmentOption: 'Quotation PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nPlease find quotation {{quotation_no}} attached for your review.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'job_confirmation', templateName: 'Job Confirmation', templateType: 'job_confirmation', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nYour job {{job_number}} has been confirmed for {{job_date}} at {{job_time}}.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'service_reminder', templateName: 'Service Reminder', templateType: 'service_reminder', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nService reminder for {{service_type}} at {{address}} on {{job_date}} {{job_time}}.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'service_completed', templateName: 'Service Completed', templateType: 'service_completed', sendToType: 'Customer', attachmentOption: 'Service Report PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nYour service {{service_type}} is completed. Service report attached.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'renewal_reminder', templateName: 'Renewal Reminder', templateType: 'renewal_reminder', sendToType: 'Customer', attachmentOption: 'Renewal Letter PDF', isActive: true, messageBody: 'Dear {{customer_name}},\n\nYour service plan renewal is due soon. Please contact us to renew.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'job_assigned_technician', templateName: 'Job Assigned to Technician', templateType: 'job_assigned_technician', sendToType: 'Technician', attachmentOption: 'Manual Upload', isActive: true, messageBody: 'New job assigned.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nService: {{service_type}}\nAddress: {{address}}\nDate: {{job_date}}\nTime: {{job_time}}\n\nPlease check your technician app.' },
  { templateKey: 'lead_assigned_sales', templateName: 'Lead Assigned to Sales', templateType: 'lead_assigned_sales', sendToType: 'Sales', attachmentOption: 'None', isActive: true, messageBody: 'Lead assigned to you.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nAddress: {{address}}\n\nRegards,\n{{company_name}}' },
  { templateKey: 'complaint_registered', templateName: 'Complaint Registered', templateType: 'complaint_registered', sendToType: 'Customer', attachmentOption: 'None', isActive: true, messageBody: 'Dear {{customer_name}},\n\nYour complaint {{complaint_number}} has been registered. Our team will review it and update you shortly.\n\nRegards,\n{{company_name}}' },
  { templateKey: 'complaint_assigned', templateName: 'Complaint Assigned', templateType: 'complaint_assigned', sendToType: 'Technician', attachmentOption: 'None', isActive: true, messageBody: 'Complaint assigned.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nComplaint: {{complaint_number}}\nAddress: {{address}}\n\nRegards,\n{{company_name}}' },
  { templateKey: 'custom_message', templateName: 'Custom Message', templateType: 'custom_message', sendToType: 'Admin', attachmentOption: 'Manual Upload', isActive: true, messageBody: 'Dear {{customer_name}},\n\n{{company_name}} update: {{service_type}}\n\nRegards,\n{{company_name}}' }
];

const TEMPLATE_TYPE_BY_MODULE = {
  lead: 'lead_welcome',
  invoice: 'invoice_send',
  payment: 'payment_reminder',
  quotation: 'quotation_send',
  service: 'service_reminder',
  renewal: 'renewal_reminder',
  job: 'job_assigned_technician',
  complaint: 'complaint_registered'
};

const ALLOWED_ATTACHMENT_OPTIONS = new Set(['None', 'Invoice PDF', 'Quotation PDF', 'Job Card PDF', 'Renewal Letter PDF', 'Service Report PDF', 'Receipt PDF', 'Manual Upload']);

const normalizeTemplateValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' || typeof value === 'function') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(raw)) return '';
  if (/^(undefined|null)$/i.test(raw)) return '';
  return raw;
};

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
    return normalizeTemplateValue(value);
  });
};

module.exports = {
  DEFAULT_TEMPLATE_DEFS,
  TEMPLATE_TYPE_BY_MODULE,
  ALLOWED_ATTACHMENT_OPTIONS,
  normalizeTemplateValue,
  normalizeTemplate,
  ensureDefaultTemplates,
  getTemplateTypeFromModule,
  replaceVariables
};
