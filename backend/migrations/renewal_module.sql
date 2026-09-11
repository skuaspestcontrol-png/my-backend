CREATE TABLE IF NOT EXISTS renewals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(120) NULL,
  renewal_id VARCHAR(100) NOT NULL,
  renewal_display_id VARCHAR(100) NULL,
  customer_id INT NULL,
  customer_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  area_name VARCHAR(255) NULL,
  service_type VARCHAR(255) NULL,
  contract_id VARCHAR(100) NULL,
  service_relationship_type VARCHAR(30) NOT NULL DEFAULT 'ONE_TIME',
  renewal_eligible TINYINT(1) NOT NULL DEFAULT 0,
  contract_duration_value INT NULL,
  contract_duration_unit VARCHAR(20) NULL,
  contract_start_date DATE NULL,
  contract_end_date DATE NULL,
  renewal_status VARCHAR(40) NULL,
  renewal_excluded TINYINT(1) NOT NULL DEFAULT 0,
  audit_suggestion VARCHAR(80) NULL,
  audit_evidence JSON NULL,
  previous_contract_start DATE NULL,
  previous_contract_end DATE NULL,
  renewal_due_date DATE NULL,
  previous_amount DECIMAL(12,2) DEFAULT 0,
  proposed_amount DECIMAL(12,2) DEFAULT 0,
  final_renewal_amount DECIMAL(12,2) DEFAULT 0,
  assigned_sales_person_id VARCHAR(100) NULL,
  assigned_sales_person_name VARCHAR(255) NULL,
  renewed_by_sales_person_id VARCHAR(100) NULL,
  renewed_by_sales_person_name VARCHAR(255) NULL,
  status ENUM('Pending','Follow-up','Done','Declined','Overdue') DEFAULT 'Pending',
  followup_date DATE NULL,
  last_followup_note TEXT NULL,
  decline_reason TEXT NULL,
  renewed_at DATETIME NULL,
  converted_contract_id VARCHAR(100) NULL,
  renewal_letter_url TEXT NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_renewals_renewal_id (renewal_id),
  UNIQUE KEY uk_renewals_external_id (external_id),
  KEY idx_renewals_due_date (renewal_due_date),
  KEY idx_renewals_status (status),
  KEY idx_renewals_assigned_sales (assigned_sales_person_id),
  KEY idx_renewals_customer_id (customer_id),
  KEY idx_renewals_contract_id (contract_id),
  KEY idx_renewals_relationship_type (service_relationship_type),
  KEY idx_renewals_renewal_status (renewal_status),
  KEY idx_renewals_eligible (renewal_eligible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @renewal_display_id_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'renewals'
    AND COLUMN_NAME = 'renewal_display_id'
);
SET @renewal_display_id_sql := IF(
  @renewal_display_id_exists = 0,
  'ALTER TABLE renewals ADD COLUMN renewal_display_id VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE renewal_display_id_stmt FROM @renewal_display_id_sql;
EXECUTE renewal_display_id_stmt;
DEALLOCATE PREPARE renewal_display_id_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'service_relationship_type');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN service_relationship_type VARCHAR(30) NOT NULL DEFAULT ''ONE_TIME''', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'renewal_eligible');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN renewal_eligible TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'contract_duration_value');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN contract_duration_value INT NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'contract_duration_unit');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN contract_duration_unit VARCHAR(20) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'contract_start_date');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN contract_start_date DATE NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'contract_end_date');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN contract_end_date DATE NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'renewal_status');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN renewal_status VARCHAR(40) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'renewal_excluded');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN renewal_excluded TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'audit_suggestion');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN audit_suggestion VARCHAR(80) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'audit_evidence');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN audit_evidence JSON NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

CREATE TABLE IF NOT EXISTS renewal_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  renewal_id VARCHAR(100) NOT NULL,
  followup_date DATE NULL,
  note TEXT,
  status VARCHAR(50),
  created_by VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_renewal_followups_renewal_id (renewal_id),
  KEY idx_renewal_followups_date (followup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS renewal_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  renewal_id VARCHAR(100) NOT NULL,
  pdf_url TEXT NULL,
  customer_name VARCHAR(255),
  generated_by VARCHAR(255) NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payload JSON NULL,
  KEY idx_renewal_letters_renewal_id (renewal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS renewal_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  renewal_id VARCHAR(100) NULL,
  action VARCHAR(80) NOT NULL,
  previous_value JSON NULL,
  next_value JSON NULL,
  created_by VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_renewal_audit_logs_renewal_id (renewal_id),
  KEY idx_renewal_audit_logs_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
