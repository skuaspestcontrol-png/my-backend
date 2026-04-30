-- Email module tables
CREATE TABLE IF NOT EXISTS email_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mail_provider VARCHAR(64) NOT NULL DEFAULT 'SMTP',
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_secure TINYINT(1) NOT NULL DEFAULT 0,
  smtp_username VARCHAR(255) NOT NULL,
  smtp_password TEXT,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) DEFAULT '',
  reply_to_email VARCHAR(255) DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  test_email_address VARCHAR(255) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(128) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(128) NOT NULL,
  send_to_type VARCHAR(64) NOT NULL,
  email_subject VARCHAR(512) NOT NULL,
  email_body MEDIUMTEXT NOT NULL,
  attachment_option VARCHAR(64) NOT NULL DEFAULT 'None',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email_template_type (template_type),
  INDEX idx_email_template_active (is_active)
);

CREATE TABLE IF NOT EXISTS email_attachments (
  id VARCHAR(64) PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(128) DEFAULT '',
  file_size BIGINT DEFAULT 0,
  module_name VARCHAR(64) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_message_logs (
  id VARCHAR(64) PRIMARY KEY,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_by_user VARCHAR(128) DEFAULT '',
  recipient_name VARCHAR(255) DEFAULT '',
  recipient_email VARCHAR(255) DEFAULT '',
  recipient_type VARCHAR(64) DEFAULT '',
  module_name VARCHAR(64) DEFAULT '',
  template_id VARCHAR(64) DEFAULT '',
  email_subject VARCHAR(512) NOT NULL,
  email_body MEDIUMTEXT NOT NULL,
  attachment_url VARCHAR(1024) DEFAULT '',
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  provider_response JSON NULL,
  error_message TEXT,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email_logs_status (status),
  INDEX idx_email_logs_sent_at (sent_at),
  INDEX idx_email_logs_module (module_name)
);

INSERT IGNORE INTO email_templates
(id, template_key, template_name, template_type, send_to_type, email_subject, email_body, attachment_option, is_active)
VALUES
('EMTPL-DEF-LEAD', 'lead_welcome', 'Lead Welcome', 'lead_welcome', 'Customer', 'Welcome from {{company_name}}', 'Dear {{customer_name}},<br/><br/>Thank you for contacting {{company_name}}. Our team will connect shortly.<br/><br/>Regards,<br/>{{company_name}}', 'None', 1),
('EMTPL-DEF-INV', 'invoice_send', 'Invoice Send', 'invoice_send', 'Customer', 'Invoice {{invoice_no}} from {{company_name}}', 'Dear {{customer_name}},<br/><br/>Thank you for choosing {{company_name}}.<br/><br/>Your invoice {{invoice_no}} of ₹{{invoice_amount}} has been generated.<br/><br/>Please find the invoice attached.<br/><br/>Regards,<br/>{{company_name}}', 'Invoice PDF', 1),
('EMTPL-DEF-PAY', 'payment_reminder', 'Payment Reminder', 'payment_reminder', 'Customer', 'Payment reminder for invoice {{invoice_no}}', 'Dear {{customer_name}},<br/><br/>This is a reminder for invoice {{invoice_no}} amount ₹{{invoice_amount}} due on {{due_date}}.<br/><br/>Payment link: {{payment_link}}<br/><br/>Regards,<br/>{{company_name}}', 'Invoice PDF', 1),
('EMTPL-DEF-QUO', 'quotation_send', 'Quotation Send', 'quotation_send', 'Customer', 'Quotation {{quotation_no}} from {{company_name}}', 'Dear {{customer_name}},<br/><br/>Please find quotation {{quotation_no}} attached for your review.<br/><br/>Regards,<br/>{{company_name}}', 'Quotation PDF', 1),
('EMTPL-DEF-SRM', 'service_reminder', 'Service Reminder', 'service_reminder', 'Customer', 'Service reminder - {{service_type}}', 'Dear {{customer_name}},<br/><br/>Service reminder for {{service_type}} at {{address}} on {{job_date}} {{job_time}}.<br/><br/>Regards,<br/>{{company_name}}', 'None', 1),
('EMTPL-DEF-SCM', 'service_completed', 'Service Completed', 'service_completed', 'Customer', 'Service completed - {{service_type}}', 'Dear {{customer_name}},<br/><br/>Your service {{service_type}} is completed. Service report attached.<br/><br/>Regards,<br/>{{company_name}}', 'Service Report PDF', 1),
('EMTPL-DEF-REN', 'renewal_reminder', 'Renewal Reminder', 'renewal_reminder', 'Customer', 'Renewal reminder from {{company_name}}', 'Dear {{customer_name}},<br/><br/>Your service plan renewal is due soon. Please contact us to renew.<br/><br/>Regards,<br/>{{company_name}}', 'None', 1),
('EMTPL-DEF-JOB', 'job_assigned_technician', 'Job Assigned to Technician', 'job_assigned_technician', 'Technician', 'New job assigned - {{job_date}} {{job_time}}', 'New job assigned.<br/><br/>Customer: {{customer_name}}<br/>Phone: {{customer_phone}}<br/>Service: {{service_type}}<br/>Address: {{address}}<br/>Date: {{job_date}}<br/>Time: {{job_time}}<br/><br/>Please check your technician app.', 'Manual Upload', 1),
('EMTPL-DEF-LAS', 'lead_assigned_sales', 'Lead Assigned to Sales', 'lead_assigned_sales', 'Sales', 'Lead assigned - {{customer_name}}', 'Lead assigned to you.<br/><br/>Customer: {{customer_name}}<br/>Email: {{customer_email}}<br/>Phone: {{customer_phone}}<br/>Address: {{address}}<br/><br/>Regards,<br/>{{company_name}}', 'None', 1),
('EMTPL-DEF-CUS', 'custom_email', 'Custom Email', 'custom_email', 'Admin', 'Custom email from {{company_name}}', 'Dear {{customer_name}},<br/><br/>{{company_name}} update: {{service_type}}<br/><br/>Regards,<br/>{{company_name}}', 'Manual Upload', 1);
