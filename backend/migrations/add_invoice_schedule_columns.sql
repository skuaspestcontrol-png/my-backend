SET @schema_name := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE invoices ADD COLUMN service_schedule_default_time VARCHAR(10) NULL DEFAULT ''10:00'' AFTER balance_due',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'service_schedule_default_time'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE invoices ADD COLUMN service_schedules JSON NULL AFTER service_schedule_default_time',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'service_schedules'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
