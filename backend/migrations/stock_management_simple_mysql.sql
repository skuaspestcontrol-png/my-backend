-- stock_management_simple_mysql.sql
-- Simple Stock Management for SKUAS Pest Control CRM
-- Safe import: does not drop old tables

CREATE TABLE IF NOT EXISTS stock_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  item_code VARCHAR(100) NULL UNIQUE,
  category VARCHAR(100) DEFAULT 'Other',
  unit VARCHAR(50) NOT NULL,
  pack_size_per_bottle VARCHAR(100) NULL,
  no_of_bottles DECIMAL(12,3) DEFAULT 0,
  opening_stock DECIMAL(12,3) DEFAULT 0,
  current_stock DECIMAL(12,3) DEFAULT 0,
  min_stock_level DECIMAL(12,3) DEFAULT 0,
  purchase_rate DECIMAL(12,2) DEFAULT 0,
  vendor_id INT NULL,
  batch_number VARCHAR(100) NULL,
  expiry_date DATE NULL,
  storage_location VARCHAR(255) NULL,
  description TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stock_items_name (item_name),
  INDEX idx_stock_items_category (category),
  INDEX idx_stock_items_expiry (expiry_date)
);

CREATE TABLE IF NOT EXISTS stock_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NULL,
  purchase_date DATE NOT NULL,
  invoice_number VARCHAR(100) NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  rate DECIMAL(12,2) DEFAULT 0,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  batch_number VARCHAR(100) NULL,
  expiry_date DATE NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_purchases_item (item_id),
  INDEX idx_stock_purchases_vendor (vendor_id),
  INDEX idx_stock_purchases_date (purchase_date)
);

CREATE TABLE IF NOT EXISTS stock_technician_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  item_id INT NOT NULL,
  current_balance DECIMAL(12,3) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_technician_item (technician_id, item_id),
  INDEX idx_stock_tech_balance_technician (technician_id),
  INDEX idx_stock_tech_balance_item (item_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  movement_type ENUM(
    'opening',
    'purchase',
    'issue',
    'usage',
    'return',
    'wastage',
    'damage',
    'expired',
    'adjustment'
  ) NOT NULL,
  item_id INT NOT NULL,
  technician_id INT NULL,
  vendor_id INT NULL,
  customer_id INT NULL,
  contract_id INT NULL,
  job_id INT NULL,
  service_type VARCHAR(150) NULL,
  source_location ENUM('office','technician') DEFAULT 'office',
  in_qty DECIMAL(12,3) DEFAULT 0,
  out_qty DECIMAL(12,3) DEFAULT 0,
  office_balance_after DECIMAL(12,3) DEFAULT 0,
  technician_balance_after DECIMAL(12,3) DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  reference_type VARCHAR(100) NULL,
  reference_id INT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_movements_item (item_id),
  INDEX idx_stock_movements_date (movement_date),
  INDEX idx_stock_movements_type (movement_type),
  INDEX idx_stock_movements_technician (technician_id)
);

UPDATE stock_items
SET unit = 'piece'
WHERE LOWER(unit) = 'pcs';
