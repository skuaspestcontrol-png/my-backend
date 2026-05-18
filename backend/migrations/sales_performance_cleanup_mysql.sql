-- sales_performance_cleanup_mysql.sql
-- Optional cleanup migration for an existing legacy sales_targets table.
-- Keeps a backup copy of the old table and recreates sales_targets with only the required columns.
-- Run this only after taking a backup of your database.

RENAME TABLE sales_targets TO sales_targets_legacy_backup;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO sales_targets (
  external_id,
  sales_person_id,
  target_type,
  target_month,
  target_year,
  revenue_target,
  collection_target,
  notes,
  is_active,
  created_by,
  created_at,
  updated_at
)
SELECT
  CASE
    WHEN COALESCE(sales_person_id, employee_id) IS NOT NULL THEN
      CONCAT(
        'SPT-',
        COALESCE(CAST(sales_person_id AS CHAR), CAST(employee_id AS CHAR)),
        '-',
        COALESCE(NULLIF(target_type, ''), NULLIF(period_type, ''), 'monthly'),
        '-',
        COALESCE(CAST(COALESCE(target_year, year, YEAR(CURDATE())) AS CHAR), CAST(YEAR(CURDATE()) AS CHAR)),
        '-',
        CASE
          WHEN COALESCE(NULLIF(target_type, ''), NULLIF(period_type, ''), 'monthly') = 'monthly'
            THEN LPAD(COALESCE(target_month, month, 0), 2, '0')
          ELSE '00'
        END
      )
    ELSE CONCAT('SPT-LEGACY-', id)
  END AS external_id,
  COALESCE(sales_person_id, employee_id, 0) AS sales_person_id,
  COALESCE(NULLIF(target_type, ''), NULLIF(period_type, ''), 'monthly') AS target_type,
  CASE
    WHEN COALESCE(NULLIF(target_type, ''), NULLIF(period_type, ''), 'monthly') = 'monthly'
      THEN COALESCE(target_month, month)
    ELSE NULL
  END AS target_month,
  COALESCE(target_year, year, YEAR(CURDATE())) AS target_year,
  COALESCE(revenue_target, target_amount, amount, 0) AS revenue_target,
  COALESCE(collection_target, lead_target, 0) AS collection_target,
  COALESCE(notes, remark, '') AS notes,
  COALESCE(is_active, 1) AS is_active,
  created_by,
  created_at,
  updated_at
FROM sales_targets_legacy_backup;
