-- sales_performance_simple_mysql.sql
-- Simple Sales Performance Target Management
-- Safe import: does not drop old tables

CREATE TABLE IF NOT EXISTS sales_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(120) NOT NULL,
  sales_person_id INT NOT NULL,
  target_type ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  target_month TINYINT NULL,
  target_year INT NOT NULL,
  revenue_target DECIMAL(12,2) DEFAULT 0,
  collection_target DECIMAL(12,2) DEFAULT 0,
  notes TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sales_targets_person (sales_person_id),
  INDEX idx_sales_targets_type (target_type),
  INDEX idx_sales_targets_month_year (target_month, target_year),
  UNIQUE KEY uk_sales_targets_external_id (external_id),
  UNIQUE KEY unique_sales_target (sales_person_id, target_type, target_month, target_year)
);
