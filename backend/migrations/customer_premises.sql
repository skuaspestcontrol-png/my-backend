CREATE TABLE IF NOT EXISTS customer_premises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  premise_id VARCHAR(100) UNIQUE,
  customer_id INT NOT NULL,
  premise_label VARCHAR(255) NULL,
  premise_type ENUM('Billing','Shipping','Service','Other') DEFAULT 'Service',
  contact_person VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address TEXT NOT NULL,
  area_name VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  pincode VARCHAR(20) NULL,
  country VARCHAR(100) DEFAULT 'India',
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  google_place_id VARCHAR(255) NULL,
  google_place_name VARCHAR(255) NULL,
  google_map_url TEXT NULL,
  gst_number VARCHAR(50) NULL,
  place_of_supply VARCHAR(100) NULL,
  is_default TINYINT(1) DEFAULT 0,
  is_billing TINYINT(1) DEFAULT 0,
  is_shipping TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_premises_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_customer_premises_customer_id (customer_id),
  KEY idx_customer_premises_premise_id (premise_id),
  KEY idx_customer_premises_pincode (pincode),
  KEY idx_customer_premises_is_default (is_default),
  KEY idx_customer_premises_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE customer_premises DROP COLUMN gstin',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'customer_premises' AND COLUMN_NAME = 'gstin'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @schema_name := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE contracts ADD COLUMN customer_premise_id VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contracts' AND COLUMN_NAME = 'customer_premise_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE jobs ADD COLUMN customer_premise_id VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'customer_premise_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE quotations ADD COLUMN customer_premise_id VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'customer_premise_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE invoices ADD COLUMN customer_premise_id VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'customer_premise_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO customer_premises (
  premise_id, customer_id, premise_label, premise_type, contact_person, phone, email, address,
  area_name, city, state, pincode, country, gst_number, place_of_supply, is_default, is_billing, is_shipping, is_active, payload
)
SELECT
  CONCAT('PREM-', COALESCE(c.external_id, c.id), '-MAIN'),
  c.id,
  'Main / Billing Address',
  'Billing',
  COALESCE(c.contact_person_name, c.customer_name, c.display_name, ''),
  COALESCE(c.mobile_number, ''),
  COALESCE(c.email_id, ''),
  COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingAddress')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.shippingAddress')), ''),
    'Address not provided'
  ),
  COALESCE(c.area_name, JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingArea')), ''),
  COALESCE(c.city, ''),
  COALESCE(c.state, JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingState')), ''),
  COALESCE(c.pincode, JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingPincode')), ''),
  'India',
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.gstNumber')), ''),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.placeOfSupply')), c.state, ''),
  1,
  1,
  0,
  1,
  c.payload
FROM customers c
LEFT JOIN customer_premises cp ON cp.customer_id = c.id AND cp.is_active = 1
WHERE cp.id IS NULL
  AND COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.billingAddress')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.payload, '$.shippingAddress')), ''),
    NULLIF(c.area_name, ''),
    NULLIF(c.state, '')
  ) IS NOT NULL;
