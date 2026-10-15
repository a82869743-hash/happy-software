-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HAPPY CAR WASH GMS V3.0 â€” Status Guard & Settings Migration
-- Run AFTER migration_v3_features.sql
-- Safe to re-run: uses IF NOT EXISTS patterns
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€ 1. Settings Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS settings (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  setting_key   VARCHAR(100)     NOT NULL,
  setting_value TEXT             NULL,
  updated_by    INT UNSIGNED     NULL,
  updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default settings
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('business_name', 'Happy Car Wash'),
  ('business_gstin', '00AAAAA0000A1Z5'),
  ('business_phone', '0000000000'),
  ('business_email', 'contact@yourgarage.com'),
  ('default_gst_percent', '18'),
  ('low_stock_threshold', '5'),
  ('whatsapp_enabled', 'false'),
  ('sms_enabled', 'false');

-- â”€â”€â”€ 2. Status Notifications Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS status_notifications (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  job_card_id     INT UNSIGNED     NOT NULL,
  status          VARCHAR(30)      NOT NULL,
  message         TEXT             NULL,
  recipient_no    VARCHAR(20)      NULL,
  dispatch_type   VARCHAR(30)      NOT NULL DEFAULT 'whatsapp',
  is_sent         TINYINT(1)      NOT NULL DEFAULT 0,
  created_by      INT UNSIGNED     NULL,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_card (job_card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- â”€â”€â”€ 3. Invoice Download Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS invoice_download_log (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  invoice_id      INT UNSIGNED     NOT NULL,
  downloaded_by   INT UNSIGNED     NULL,
  downloaded_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- â”€â”€â”€ 4. Post-Service Inspection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS post_service_inspection (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  job_card_id       INT UNSIGNED     NOT NULL UNIQUE,
  concern_resolved  TINYINT(1)      NOT NULL DEFAULT 0,
  vehicle_cleaned   TINYINT(1)      NOT NULL DEFAULT 0,
  photos_uploaded   TINYINT(1)      NOT NULL DEFAULT 0,
  quality_check     TINYINT(1)      NOT NULL DEFAULT 0,
  inspector_id      INT UNSIGNED     NULL,
  notes             TEXT             NULL,
  created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_card (job_card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- â”€â”€â”€ 5. Add missing columns to bill_dispatch_log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- (safe: columns added individually with IF NOT EXISTS pattern via procedure)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_dispatch_log' AND COLUMN_NAME = 'provider_ref');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE bill_dispatch_log ADD COLUMN provider_ref VARCHAR(200) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_dispatch_log' AND COLUMN_NAME = 'error_message');
SET @sql2 = IF(@col_exists2 = 0, 'ALTER TABLE bill_dispatch_log ADD COLUMN error_message TEXT NULL', 'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @col_exists3 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_dispatch_log' AND COLUMN_NAME = 'dispatched_by');
SET @sql3 = IF(@col_exists3 = 0, 'ALTER TABLE bill_dispatch_log ADD COLUMN dispatched_by INT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- â”€â”€â”€ 6. Add is_completed to customer_concerns if missing â”€â”€â”€â”€â”€â”€â”€â”€
SET @col_cc = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_concerns' AND COLUMN_NAME = 'is_completed');
SET @sql_cc = IF(@col_cc = 0, 'ALTER TABLE customer_concerns ADD COLUMN is_completed TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt_cc FROM @sql_cc; EXECUTE stmt_cc; DEALLOCATE PREPARE stmt_cc;

-- â”€â”€â”€ 7. Ensure advance_payments table exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS advance_payments (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  job_card_id     INT UNSIGNED     NOT NULL,
  payment_type    VARCHAR(30)      NOT NULL DEFAULT 'cash',
  bank_name       VARCHAR(150)     NULL,
  cheque_no       VARCHAR(50)      NULL,
  amount          DECIMAL(12,2)   NOT NULL DEFAULT 0,
  payment_date    DATE             NULL,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_card (job_card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- â”€â”€â”€ 8. Add fuel_level_percent and fuel_photo to job_cards â”€â”€â”€â”€â”€â”€
SET @col_flp = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'fuel_level_percent');
SET @sql_flp = IF(@col_flp = 0, 'ALTER TABLE job_cards ADD COLUMN fuel_level_percent INT NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt_flp FROM @sql_flp; EXECUTE stmt_flp; DEALLOCATE PREPARE stmt_flp;

SET @col_fp = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'fuel_photo');
SET @sql_fp = IF(@col_fp = 0, 'ALTER TABLE job_cards ADD COLUMN fuel_photo VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt_fp FROM @sql_fp; EXECUTE stmt_fp; DEALLOCATE PREPARE stmt_fp;



