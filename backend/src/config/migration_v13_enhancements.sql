-- Migration v13: Enhancements for custom categories persistence and estimate payments
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- Ensure service_suggestions table has hsn_sac and tax_pct columns
-- (may already exist from jobCards.js auto-creation)
SET @col_exists_hsn = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_suggestions' AND COLUMN_NAME = 'hsn_sac');
SET @sql_hsn = IF(@col_exists_hsn = 0, 'ALTER TABLE service_suggestions ADD COLUMN hsn_sac VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_hsn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_tax = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_suggestions' AND COLUMN_NAME = 'tax_pct');
SET @sql_tax = IF(@col_exists_tax = 0, 'ALTER TABLE service_suggestions ADD COLUMN tax_pct DECIMAL(5,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_tax;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure customer_payments has estimate_id column (may already exist)
SET @col_exists_est = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_payments' AND COLUMN_NAME = 'estimate_id');
SET @sql_est = IF(@col_exists_est = 0, 'ALTER TABLE customer_payments ADD COLUMN estimate_id INT UNSIGNED NULL AFTER job_card_id', 'SELECT 1');
PREPARE stmt FROM @sql_est;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
