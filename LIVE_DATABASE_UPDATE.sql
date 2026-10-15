-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HAPPY CAR WASH GMS â€” SAFE LIVE DATABASE UPDATE SCRIPT
-- Paste and execute this directly in phpMyAdmin > SQL tab on your live database!
-- Safe to run on live data (Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Support for Estimate payments in customer_payments table
ALTER TABLE `customer_payments` MODIFY COLUMN `job_card_id` INT NULL;

SET @col_exists_est = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_payments' AND COLUMN_NAME = 'estimate_id');
SET @sql_est = IF(@col_exists_est = 0, 'ALTER TABLE customer_payments ADD COLUMN estimate_id INT UNSIGNED NULL AFTER job_card_id', 'SELECT 1');
PREPARE stmt FROM @sql_est;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Expand payment_mode column length to VARCHAR(50)
ALTER TABLE `job_cards` MODIFY COLUMN `payment_mode` VARCHAR(50) NULL;
ALTER TABLE `estimates` MODIFY COLUMN `payment_mode` VARCHAR(50) NULL;

-- 3. Add hsn_sac and tax_pct to service_suggestions
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

-- 4. Add payment_status column to invoices & invoices_non_gst
SET @col_exists_ps1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_status');
SET @sql_ps1 = IF(@col_exists_ps1 = 0, "ALTER TABLE invoices ADD COLUMN payment_status ENUM('outstanding', 'approved') NOT NULL DEFAULT 'approved'", 'SELECT 1');
PREPARE stmt FROM @sql_ps1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_ps2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices_non_gst' AND COLUMN_NAME = 'payment_status');
SET @sql_ps2 = IF(@col_exists_ps2 = 0, "ALTER TABLE invoices_non_gst ADD COLUMN payment_status ENUM('outstanding', 'approved') NOT NULL DEFAULT 'approved'", 'SELECT 1');
PREPARE stmt FROM @sql_ps2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Create custom_categories table if not exists
CREATE TABLE IF NOT EXISTS `custom_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_name` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

