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
  service_relationship_type VARCHAR(30) NOT NULL DEFAULT 'NEEDS_REVIEW',
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
  renewal_outcome VARCHAR(20) NULL,
  outcome_decision_date DATE NULL,
  outcome_recorded_at DATETIME NULL,
  renewal_timing VARCHAR(30) NULL,
  previous_contract_id VARCHAR(100) NULL,
  new_contract_id VARCHAR(100) NULL,
  previous_contract_amount DECIMAL(12,2) NULL,
  agreed_contract_amount DECIMAL(12,2) NULL,
  price_difference DECIMAL(12,2) NULL,
  price_change_percent DECIMAL(8,2) NULL,
  agreement_date DATE NULL,
  new_contract_start_date DATE NULL,
  new_contract_end_date DATE NULL,
  lost_reason VARCHAR(120) NULL,
  lost_notes TEXT NULL,
  outcome_updated_by VARCHAR(255) NULL,
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
  KEY idx_renewals_eligible (renewal_eligible),
  KEY idx_renewals_outcome (renewal_outcome),
  KEY idx_renewals_timing (renewal_timing)
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
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN service_relationship_type VARCHAR(30) NOT NULL DEFAULT ''NEEDS_REVIEW''', 'SELECT 1');
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

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'renewal_outcome');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN renewal_outcome VARCHAR(20) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'outcome_decision_date');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN outcome_decision_date DATE NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'outcome_recorded_at');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN outcome_recorded_at DATETIME NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'renewal_timing');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN renewal_timing VARCHAR(30) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'previous_contract_id');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN previous_contract_id VARCHAR(100) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'new_contract_id');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN new_contract_id VARCHAR(100) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'previous_contract_amount');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN previous_contract_amount DECIMAL(12,2) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'agreed_contract_amount');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN agreed_contract_amount DECIMAL(12,2) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'price_difference');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN price_difference DECIMAL(12,2) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'price_change_percent');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN price_change_percent DECIMAL(8,2) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'agreement_date');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN agreement_date DATE NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'new_contract_start_date');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN new_contract_start_date DATE NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'new_contract_end_date');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN new_contract_end_date DATE NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'lost_reason');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN lost_reason VARCHAR(120) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'lost_notes');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN lost_notes TEXT NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND COLUMN_NAME = 'outcome_updated_by');
SET @renewal_col_sql := IF(@renewal_col_exists = 0, 'ALTER TABLE renewals ADD COLUMN outcome_updated_by VARCHAR(255) NULL', 'SELECT 1');
PREPARE renewal_col_stmt FROM @renewal_col_sql; EXECUTE renewal_col_stmt; DEALLOCATE PREPARE renewal_col_stmt;

SET @renewal_index_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND INDEX_NAME = 'idx_renewals_outcome');
SET @renewal_index_sql := IF(@renewal_index_exists = 0, 'CREATE INDEX idx_renewals_outcome ON renewals (renewal_outcome)', 'SELECT 1');
PREPARE renewal_index_stmt FROM @renewal_index_sql; EXECUTE renewal_index_stmt; DEALLOCATE PREPARE renewal_index_stmt;

SET @renewal_index_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'renewals' AND INDEX_NAME = 'idx_renewals_timing');
SET @renewal_index_sql := IF(@renewal_index_exists = 0, 'CREATE INDEX idx_renewals_timing ON renewals (renewal_timing)', 'SELECT 1');
PREPARE renewal_index_stmt FROM @renewal_index_sql; EXECUTE renewal_index_stmt; DEALLOCATE PREPARE renewal_index_stmt;

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
