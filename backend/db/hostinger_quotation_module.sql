-- Hostinger MySQL import file for Quotation Module
-- Safe to run multiple times (uses IF NOT EXISTS)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS quotation_template_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  logo_url TEXT NULL,
  logo_width INT DEFAULT 90,
  logo_height INT DEFAULT 70,
  header_alignment VARCHAR(20) DEFAULT 'left',
  company_name VARCHAR(255) DEFAULT '',
  company_address TEXT NULL,
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  website VARCHAR(255) DEFAULT '',
  gstin VARCHAR(64) DEFAULT '',
  header_line_color VARCHAR(20) DEFAULT '#9F174D',
  primary_color VARCHAR(20) DEFAULT '#9F174D',
  border_color VARCHAR(20) DEFAULT '#cbd5e1',
  font_family VARCHAR(80) DEFAULT 'Helvetica',
  font_size INT DEFAULT 10,
  heading_font_size INT DEFAULT 14,
  body_font_size INT DEFAULT 10,
  table_font_size INT DEFAULT 9,
  footer_text TEXT NULL,
  signature_image_url TEXT NULL,
  default_sales_person VARCHAR(255) DEFAULT '',
  default_designation VARCHAR(255) DEFAULT '',
  default_mobile VARCHAR(50) DEFAULT '',
  show_logo TINYINT(1) DEFAULT 1,
  show_gstin TINYINT(1) DEFAULT 1,
  show_signature TINYINT(1) DEFAULT 1,
  show_page_number TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_prefix_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prefix VARCHAR(50) DEFAULT 'SPC/',
  financial_year VARCHAR(20) DEFAULT '',
  enable_service_code TINYINT(1) DEFAULT 1,
  next_number INT DEFAULT 1,
  padding_digits INT DEFAULT 4,
  format_template VARCHAR(255) DEFAULT '{{prefix}}{{year}}/{{service_code}}/{{number}}',
  service_code_map_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_service_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_name VARCHAR(255) NOT NULL,
  service_code VARCHAR(30) DEFAULT '',
  pest_name VARCHAR(255) DEFAULT '',
  quotation_title VARCHAR(255) DEFAULT '',
  about_pest TEXT NULL,
  what_we_do TEXT NULL,
  treatment_points TEXT NULL,
  default_infestation_level VARCHAR(100) DEFAULT '',
  default_frequency VARCHAR(120) DEFAULT '',
  default_recommendation TEXT NULL,
  default_gst_percentage DECIMAL(10,2) DEFAULT 18,
  default_rate_without_gst DECIMAL(12,2) DEFAULT 0,
  default_rate_with_gst DECIMAL(12,2) DEFAULT 0,
  warranty_note TEXT NULL,
  service_terms TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_quotation_service_templates_active (is_active, service_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_common_paragraphs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  opening_paragraph TEXT NULL,
  closing_paragraph TEXT NULL,
  payment_terms TEXT NULL,
  general_terms TEXT NULL,
  warranty_paragraph TEXT NULL,
  disclaimer_paragraph TEXT NULL,
  relationship_closing_paragraph TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS infestation_levels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  level_name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  recommendation_text TEXT NULL,
  image_url TEXT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_infestation_levels_sort (sort_order, level_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_number VARCHAR(120) NOT NULL,
  source_type VARCHAR(40) DEFAULT 'Manual',
  lead_id VARCHAR(80) NULL,
  customer_id VARCHAR(80) NULL,
  customer_name VARCHAR(255) DEFAULT '',
  company_name VARCHAR(255) DEFAULT '',
  address TEXT NULL,
  phone VARCHAR(50) DEFAULT '',
  whatsapp VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  gstin VARCHAR(64) DEFAULT '',
  quotation_date DATE NULL,
  validity_days INT DEFAULT 15,
  prepared_by VARCHAR(255) DEFAULT '',
  sales_person VARCHAR(255) DEFAULT '',
  designation VARCHAR(255) DEFAULT '',
  mobile VARCHAR(50) DEFAULT '',
  contract_start_date DATE NULL,
  contract_end_date DATE NULL,
  subtotal_without_gst DECIMAL(12,2) DEFAULT 0,
  gst_total DECIMAL(12,2) DEFAULT 0,
  round_off DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,
  amount_in_words TEXT NULL,
  rate_type VARCHAR(40) DEFAULT 'With GST',
  status VARCHAR(40) DEFAULT 'Draft',
  opening_paragraph TEXT NULL,
  payment_terms TEXT NULL,
  warranty_note TEXT NULL,
  disclaimer TEXT NULL,
  closing_paragraph TEXT NULL,
  internal_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_quotation_number (quotation_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  service_template_id INT NULL,
  service_name VARCHAR(255) DEFAULT '',
  service_code VARCHAR(30) DEFAULT '',
  pest_name VARCHAR(255) DEFAULT '',
  service_title VARCHAR(255) DEFAULT '',
  about_pest TEXT NULL,
  what_we_do TEXT NULL,
  treatment_points TEXT NULL,
  infestation_level VARCHAR(100) DEFAULT '',
  infestation_image_url TEXT NULL,
  frequency VARCHAR(120) DEFAULT '',
  recommendation TEXT NULL,
  area_covered VARCHAR(255) DEFAULT '',
  quantity DECIMAL(12,2) DEFAULT 1,
  rate_without_gst DECIMAL(12,2) DEFAULT 0,
  gst_percentage DECIMAL(10,2) DEFAULT 18,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  rate_with_gst DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  contract_start_date DATE NULL,
  contract_end_date DATE NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_quotation_items_quotation_id (quotation_id),
  CONSTRAINT fk_quotation_items_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO quotation_template_settings (company_name, company_address, phone, email, website, gstin, header_alignment, logo_width, logo_height, primary_color, header_line_color, border_color, font_family, font_size, heading_font_size, body_font_size, table_font_size, show_logo, show_gstin, show_signature, show_page_number)
SELECT 'SKUAS Pest Control Private Limited', '', '', '', '', '', 'left', 90, 70, '#9F174D', '#9F174D', '#cbd5e1', 'Helvetica', 10, 14, 10, 9, 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM quotation_template_settings LIMIT 1);

INSERT INTO quotation_prefix_settings (prefix, financial_year, enable_service_code, next_number, padding_digits, format_template, service_code_map_json)
SELECT 'SPC/', YEAR(CURDATE()), 1, 20, 4, '{{prefix}}{{year}}/{{service_code}}/{{number}}',
       JSON_OBJECT('Cockroach Control','CC','Termite Control','TC','Rodent Control','RC','General Pest Control','GPC','Bed Bug Control','BBC','Mosquito Control','MC','AMC Pest Control','AMC')
WHERE NOT EXISTS (SELECT 1 FROM quotation_prefix_settings LIMIT 1);

INSERT INTO quotation_common_paragraphs (opening_paragraph, closing_paragraph, payment_terms, general_terms, warranty_paragraph, disclaimer_paragraph, relationship_closing_paragraph)
SELECT 'Thank you for the kind courtesy extended to us. We are pleased to submit our offer for your pest control requirement.',
       'We look forward to working with you and delivering consistent, safe, and effective pest management services.',
       '50% advance and remaining on completion unless otherwise agreed in writing.',
       'Service scheduling is subject to site readiness and safety compliance.',
       'Warranty is applicable as per selected service plan and infestation profile.',
       'This proposal is based on current visible infestation and may vary if site conditions change significantly.',
       'We value a long-term relationship and assure responsive service support.'
WHERE NOT EXISTS (SELECT 1 FROM quotation_common_paragraphs LIMIT 1);

INSERT INTO quotation_service_templates (service_name, service_code, pest_name, quotation_title, about_pest, what_we_do, default_infestation_level, default_frequency, default_recommendation, default_gst_percentage, default_rate_without_gst, default_rate_with_gst, warranty_note, is_active)
SELECT 'Cockroach Control','CC','Cockroach','Quotation for Cockroach Control','Cockroaches are resilient pests that contaminate food and surfaces.','Targeted gel baiting and spray treatment in critical hotspots.','Medium','Single treatment with follow-up','Maintain kitchen hygiene and close drain entries.',18,2000,2360,'Warranty as per plan.',1
WHERE NOT EXISTS (SELECT 1 FROM quotation_service_templates WHERE service_name='Cockroach Control');

INSERT INTO quotation_service_templates (service_name, service_code, pest_name, quotation_title, about_pest, what_we_do, default_infestation_level, default_frequency, default_recommendation, default_gst_percentage, default_rate_without_gst, default_rate_with_gst, warranty_note, is_active)
SELECT 'Termite Control','TC','Termite','Quotation for Termite Control','Termites damage wood structures silently over time.','Drill-fill and trenching treatment with anti-termite chemicals.','High','One-time intensive + periodic checks','Avoid moisture accumulation near wood contact areas.',18,5000,5900,'Warranty as per contract.',1
WHERE NOT EXISTS (SELECT 1 FROM quotation_service_templates WHERE service_name='Termite Control');

INSERT INTO quotation_service_templates (service_name, service_code, pest_name, quotation_title, about_pest, what_we_do, default_infestation_level, default_frequency, default_recommendation, default_gst_percentage, default_rate_without_gst, default_rate_with_gst, warranty_note, is_active)
SELECT 'Rodent Control','RC','Rodent','Quotation for Rodent Control','Rodents spread disease and damage wiring/material.','Baiting, trapping, and proofing recommendations.','Medium','Monthly','Seal entry points and maintain waste control.',18,2500,2950,'Warranty as per plan.',1
WHERE NOT EXISTS (SELECT 1 FROM quotation_service_templates WHERE service_name='Rodent Control');

INSERT INTO quotation_service_templates (service_name, service_code, pest_name, quotation_title, about_pest, what_we_do, default_infestation_level, default_frequency, default_recommendation, default_gst_percentage, default_rate_without_gst, default_rate_with_gst, warranty_note, is_active)
SELECT 'General Pest Control','GPC','General Pest','Quotation for General Pest Control','General pests include ants, flies, and crawling insects.','Integrated spray and gel treatment in affected zones.','Low','Quarterly','Keep food sealed and reduce standing water.',18,1800,2124,'Warranty as per plan.',1
WHERE NOT EXISTS (SELECT 1 FROM quotation_service_templates WHERE service_name='General Pest Control');

INSERT INTO quotation_service_templates (service_name, service_code, pest_name, quotation_title, about_pest, what_we_do, default_infestation_level, default_frequency, default_recommendation, default_gst_percentage, default_rate_without_gst, default_rate_with_gst, warranty_note, is_active)
SELECT 'Bed Bug Control','BBC','Bed Bug','Quotation for Bed Bug Control','Bed bugs hide in cracks and upholstery and spread quickly.','Detailed inspection with focused chemical and non-chemical treatment.','High','Two visits','Hot wash linens and isolate infested items.',18,3500,4130,'Warranty as per plan.',1
WHERE NOT EXISTS (SELECT 1 FROM quotation_service_templates WHERE service_name='Bed Bug Control');

INSERT INTO infestation_levels (level_name, description, recommendation_text, sort_order, is_active)
SELECT 'Low','Limited signs in isolated zones','Preventive treatment and monitoring recommended.',1,1
WHERE NOT EXISTS (SELECT 1 FROM infestation_levels WHERE level_name='Low');

INSERT INTO infestation_levels (level_name, description, recommendation_text, sort_order, is_active)
SELECT 'Medium','Visible activity in multiple points','Corrective treatment with follow-up recommended.',2,1
WHERE NOT EXISTS (SELECT 1 FROM infestation_levels WHERE level_name='Medium');

INSERT INTO infestation_levels (level_name, description, recommendation_text, sort_order, is_active)
SELECT 'High','Frequent activity across critical areas','Intensive treatment and strict sanitation required.',3,1
WHERE NOT EXISTS (SELECT 1 FROM infestation_levels WHERE level_name='High');

INSERT INTO infestation_levels (level_name, description, recommendation_text, sort_order, is_active)
SELECT 'Severe','Heavy and recurring activity','Immediate multi-stage treatment and close monitoring needed.',4,1
WHERE NOT EXISTS (SELECT 1 FROM infestation_levels WHERE level_name='Severe');

SET FOREIGN_KEY_CHECKS = 1;
