-- WhatsApp module tables
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  api_base_url VARCHAR(512) NOT NULL,
  phone_number VARCHAR(32) DEFAULT '',
  instance_id VARCHAR(128) DEFAULT '',
  access_token TEXT,
  provider_type VARCHAR(64) DEFAULT 'custom',
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  test_number VARCHAR(32) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(128) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(128) NOT NULL,
  send_to_type VARCHAR(64) NOT NULL,
  message_body TEXT NOT NULL,
  attachment_option VARCHAR(64) NOT NULL DEFAULT 'None',
  official_template_name VARCHAR(255) DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_template_type (template_type),
  INDEX idx_whatsapp_template_active (is_active)
);

CREATE TABLE IF NOT EXISTS whatsapp_attachments (
  id VARCHAR(64) PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(128) DEFAULT '',
  file_size BIGINT DEFAULT 0,
  module_name VARCHAR(64) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id VARCHAR(64) PRIMARY KEY,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_by_user VARCHAR(128) DEFAULT '',
  recipient_name VARCHAR(255) DEFAULT '',
  recipient_phone VARCHAR(32) DEFAULT '',
  recipient_type VARCHAR(64) DEFAULT '',
  module_name VARCHAR(64) DEFAULT '',
  template_id VARCHAR(64) DEFAULT '',
  message_body TEXT NOT NULL,
  attachment_url VARCHAR(1024) DEFAULT '',
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  api_response JSON NULL,
  error_message TEXT,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_logs_status (status),
  INDEX idx_whatsapp_logs_sent_at (sent_at),
  INDEX idx_whatsapp_logs_module (module_name)
);

INSERT IGNORE INTO whatsapp_templates (id, template_key, template_name, template_type, send_to_type, message_body, attachment_option, official_template_name, is_active)
VALUES
('WATPL-DEF-LEAD', 'lead_welcome', 'Lead Welcome', 'lead_welcome', 'Customer', 'Dear {{customer_name}},\n\nThank you for contacting {{company_name}}. Our team will connect with you shortly.\n\nRegards,\n{{company_name}}', 'None', '', 1),
('WATPL-DEF-INV', 'invoice_send', 'Invoice Send', 'invoice_send', 'Customer', 'Dear {{customer_name}},\n\nThank you for choosing SKUAS Pest Control.\n\nYour invoice {{invoice_no}} of ₹{{invoice_amount}} has been generated.\n\nPlease find the invoice attached.\n\nRegards,\n{{company_name}}', 'Invoice PDF', '', 1),
('WATPL-DEF-PAY', 'payment_reminder', 'Payment Reminder', 'payment_reminder', 'Customer', 'Dear {{customer_name}},\n\nThis is a reminder for invoice {{invoice_no}} amount ₹{{invoice_amount}} due on {{due_date}}.\n\nPayment link: {{payment_link}}\n\nRegards,\n{{company_name}}', 'Invoice PDF', '', 1),
('WATPL-DEF-QUO', 'quotation_send', 'Quotation Send', 'quotation_send', 'Customer', 'Dear {{customer_name}},\n\nPlease find quotation {{quotation_no}} attached for your review.\n\nRegards,\n{{company_name}}', 'Quotation PDF', '', 1),
('WATPL-DEF-SRM', 'service_reminder', 'Service Reminder', 'service_reminder', 'Customer', 'Dear {{customer_name}},\n\nService reminder for {{service_type}} at {{address}} on {{job_date}} {{job_time}}.\n\nRegards,\n{{company_name}}', 'None', '', 1),
('WATPL-DEF-SCM', 'service_completed', 'Service Completed', 'service_completed', 'Customer', 'Dear {{customer_name}},\n\nYour service {{service_type}} is completed. Service report attached.\n\nRegards,\n{{company_name}}', 'Service Report PDF', '', 1),
('WATPL-DEF-REN', 'renewal_reminder', 'Renewal Reminder', 'renewal_reminder', 'Customer', 'Dear {{customer_name}},\n\nYour service plan renewal is due soon. Please contact us to renew.\n\nRegards,\n{{company_name}}', 'None', '', 1),
('WATPL-DEF-JOB', 'job_assigned_technician', 'Job Assigned to Technician', 'job_assigned_technician', 'Technician', 'New job assigned.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nService: {{service_type}}\nAddress: {{address}}\nDate: {{job_date}}\nTime: {{job_time}}\n\nPlease check your technician app.', 'Manual Upload', '', 1),
('WATPL-DEF-LAS', 'lead_assigned_sales', 'Lead Assigned to Sales', 'lead_assigned_sales', 'Sales', 'Lead assigned to you.\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nAddress: {{address}}\n\nRegards,\n{{company_name}}', 'None', '', 1),
('WATPL-DEF-CUS', 'custom_message', 'Custom Message', 'custom_message', 'Admin', 'Dear {{customer_name}},\n\n{{company_name}} update: {{service_type}}\n\nRegards,\n{{company_name}}', 'Manual Upload', '', 1);
