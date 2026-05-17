-- stock_management_mysql.sql
-- SKUAS Pest Control CRM - Stock Management Tables
-- Safe for Hostinger phpMyAdmin import

CREATE TABLE IF NOT EXISTS stock_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO stock_categories (name, description) VALUES
('Chemical', 'Liquid pest control chemicals'),
('Gel / Bait', 'Gel tubes and bait products'),
('Rodent Control', 'Glue pads, bromadiolone cake, rodent boxes'),
('Equipment', 'Sprayers and pest control equipment'),
('PPE', 'Gloves, masks and safety items'),
('Consumable', 'Daily use consumable items'),
('Other', 'Other stock items');

CREATE TABLE IF NOT EXISTS stock_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_code VARCHAR(100) NULL UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  category_id INT NULL,
  unit VARCHAR(50) NOT NULL,
  opening_stock DECIMAL(12,3) DEFAULT 0,
  current_stock DECIMAL(12,3) DEFAULT 0,
  min_stock_level DECIMAL(12,3) DEFAULT 0,
  purchase_rate DECIMAL(12,2) DEFAULT 0,
  internal_rate DECIMAL(12,2) DEFAULT 0,
  default_vendor_id INT NULL,
  batch_number VARCHAR(100) NULL,
  expiry_date DATE NULL,
  storage_location VARCHAR(255) NULL,
  description TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stock_products_category (category_id),
  INDEX idx_stock_products_name (product_name),
  INDEX idx_stock_products_expiry (expiry_date)
);

CREATE TABLE IF NOT EXISTS stock_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NULL,
  purchase_date DATE NOT NULL,
  invoice_number VARCHAR(100) NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  rate DECIMAL(12,2) DEFAULT 0,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  batch_number VARCHAR(100) NULL,
  expiry_date DATE NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_purchases_product (product_id),
  INDEX idx_stock_purchases_vendor (vendor_id),
  INDEX idx_stock_purchases_date (purchase_date)
);

CREATE TABLE IF NOT EXISTS stock_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  issue_date DATE NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  customer_id INT NULL,
  contract_id INT NULL,
  job_id INT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_issues_technician (technician_id),
  INDEX idx_stock_issues_product (product_id),
  INDEX idx_stock_issues_date (issue_date)
);

CREATE TABLE IF NOT EXISTS stock_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  usage_date DATE NOT NULL,
  product_id INT NOT NULL,
  quantity_used DECIMAL(12,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  customer_id INT NULL,
  contract_id INT NULL,
  job_id INT NULL,
  service_type VARCHAR(150) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_usage_technician (technician_id),
  INDEX idx_stock_usage_product (product_id),
  INDEX idx_stock_usage_date (usage_date)
);

CREATE TABLE IF NOT EXISTS stock_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NULL,
  return_date DATE NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  return_type ENUM('return_to_office','wastage','damage','expired','adjustment') DEFAULT 'return_to_office',
  source_location ENUM('office','technician') DEFAULT 'technician',
  reason VARCHAR(255) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_returns_technician (technician_id),
  INDEX idx_stock_returns_product (product_id),
  INDEX idx_stock_returns_date (return_date)
);

CREATE TABLE IF NOT EXISTS technician_stock_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  product_id INT NOT NULL,
  current_balance DECIMAL(12,3) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_technician_product (technician_id, product_id),
  INDEX idx_tech_stock_technician (technician_id),
  INDEX idx_tech_stock_product (product_id)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  product_id INT NOT NULL,
  movement_type ENUM('opening','purchase','issue','usage','return','wastage','damage','expired','adjustment') NOT NULL,
  source_type VARCHAR(50) NULL,
  reference_table VARCHAR(100) NULL,
  reference_id INT NULL,
  technician_id INT NULL,
  vendor_id INT NULL,
  customer_id INT NULL,
  in_qty DECIMAL(12,3) DEFAULT 0,
  out_qty DECIMAL(12,3) DEFAULT 0,
  office_balance_after DECIMAL(12,3) DEFAULT 0,
  technician_balance_after DECIMAL(12,3) DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_ledger_product (product_id),
  INDEX idx_stock_ledger_date (movement_date),
  INDEX idx_stock_ledger_type (movement_type),
  INDEX idx_stock_ledger_technician (technician_id)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  adjustment_date DATE NOT NULL,
  product_id INT NOT NULL,
  technician_id INT NULL,
  source_location ENUM('office','technician') DEFAULT 'office',
  adjustment_type ENUM('increase','decrease') DEFAULT 'increase',
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  reason VARCHAR(255) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_adjustments_product (product_id),
  INDEX idx_stock_adjustments_date (adjustment_date),
  INDEX idx_stock_adjustments_technician (technician_id)
);

CREATE TABLE IF NOT EXISTS stock_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO stock_settings (setting_key, setting_value) VALUES
('default_units', 'ml,litre,gram,kg,tube,piece,box,packet,bottle,can'),
('low_stock_alert_enabled', '1'),
('expiry_alert_days', '30');
