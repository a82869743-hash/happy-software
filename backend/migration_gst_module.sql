USE happy_gms;

-- TABLE 1: GST Invoices (job cards completed WITH GST)
-- This replaces / extends the existing `invoices` table usage
-- Add a gst_type column to existing invoices table to tag them
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_type ENUM('with_gst', 'without_gst') NOT NULL DEFAULT 'with_gst';

-- TABLE 2: Non-GST Job Cards (separate table for WITHOUT GST completions)
CREATE TABLE IF NOT EXISTS invoices_non_gst (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_card_id     INT NOT NULL UNIQUE,
  invoice_no      VARCHAR(50) NOT NULL UNIQUE,
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_mode    ENUM('cash','upi','card','bank') NOT NULL DEFAULT 'cash',
  customer_name   VARCHAR(200) NULL,
  mobile_no       VARCHAR(15) NULL,
  reg_no          VARCHAR(20) NULL,
  car_name        VARCHAR(200) NULL,
  created_by      INT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_nongst_job (job_card_id),
  KEY idx_nongst_date (created_at),
  KEY idx_nongst_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TABLE 3: Audit log for kill switch (non-GST deletion events)
CREATE TABLE IF NOT EXISTS non_gst_kill_switch_log (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  deleted_by      INT NULL,
  deleted_by_name VARCHAR(200) NULL,
  records_deleted INT NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address      VARCHAR(45) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

