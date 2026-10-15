-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Estimation Management V2
-- Run this BEFORE deploying the new backend/frontend code
-- ═══════════════════════════════════════════════════════════════

-- 1. Add GST columns to existing estimates table
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS estimate_type ENUM('gst_estimate','non_gst_estimate') NOT NULL DEFAULT 'non_gst_estimate' AFTER payment_mode,
  ADD COLUMN IF NOT EXISTS gst_percentage DECIMAL(5,2) DEFAULT 0 AFTER estimate_type,
  ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0 AFTER gst_percentage,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0 AFTER gst_amount,
  ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) DEFAULT 0 AFTER total_amount,
  ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL AFTER is_archived,
  ADD COLUMN IF NOT EXISTS archived_by INT NULL AFTER archived_at;

-- Remove UNIQUE constraint on job_card_id so estimates can be standalone
ALTER TABLE estimates DROP INDEX job_card_id;
ALTER TABLE estimates MODIFY job_card_id INT NULL;

-- Add customer/vehicle snapshot fields for standalone estimates
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) NULL AFTER archived_by,
  ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(20) NULL AFTER customer_name,
  ADD COLUMN IF NOT EXISTS reg_no VARCHAR(20) NULL AFTER mobile_no,
  ADD COLUMN IF NOT EXISTS car_name VARCHAR(100) NULL AFTER reg_no,
  ADD COLUMN IF NOT EXISTS vehicle_make VARCHAR(50) NULL AFTER car_name,
  ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(50) NULL AFTER vehicle_make,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER vehicle_model,
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER notes;

-- 2. Estimate services table (for standalone estimates not tied to job cards)
CREATE TABLE IF NOT EXISTS estimate_services (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id     INT NOT NULL,
  service_name    VARCHAR(200) NOT NULL,
  item_type       ENUM('labour','part','consumable','external') DEFAULT 'labour',
  part_code       VARCHAR(30) NULL,
  qty             INT DEFAULT 1,
  rate            DECIMAL(10,2) DEFAULT 0,
  amount          DECIMAL(10,2) DEFAULT 0,
  hsn_sac         VARCHAR(20) NULL,
  FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
);

-- 3. Estimate-to-Job-Card mapping
CREATE TABLE IF NOT EXISTS estimate_job_mapping (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id     INT NOT NULL,
  job_card_id     INT NOT NULL,
  converted_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  converted_by    INT NULL,
  FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

-- 4. History Vault — Permanent, immutable business history
CREATE TABLE IF NOT EXISTS estimate_history_vault (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id     INT NOT NULL,
  estimate_no     VARCHAR(30) NOT NULL,
  estimate_type   ENUM('gst_estimate','non_gst_estimate') NOT NULL,
  customer_name   VARCHAR(100) NULL,
  mobile_no       VARCHAR(20) NULL,
  reg_no          VARCHAR(20) NULL,
  car_name        VARCHAR(100) NULL,
  vehicle_make    VARCHAR(50) NULL,
  vehicle_model   VARCHAR(50) NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  gst_percentage  DECIMAL(5,2) DEFAULT 0,
  gst_amount      DECIMAL(10,2) DEFAULT 0,
  total_amount    DECIMAL(10,2) DEFAULT 0,
  payment_mode    VARCHAR(20) NULL,
  services_json   JSON NULL,
  notes           TEXT NULL,
  created_at      DATETIME NOT NULL,
  archived_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  vault_action    ENUM('archived','created','converted') DEFAULT 'archived'
);

-- 5. Audit Log
CREATE TABLE IF NOT EXISTS estimate_audit_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id     INT NOT NULL,
  action          ENUM('created','edited','converted','archived','restored','bulk_archived') NOT NULL,
  user_id         INT NULL,
  user_name       VARCHAR(100) NULL,
  details         TEXT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_estimate_audit_estimate ON estimate_audit_log(estimate_id);
CREATE INDEX idx_estimate_audit_action ON estimate_audit_log(action);
CREATE INDEX idx_estimates_archived ON estimates(is_archived);
CREATE INDEX idx_estimates_type ON estimates(estimate_type);
