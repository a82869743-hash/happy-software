-- 1. Alter payment_mode column to support cheque, pending, and manual settlement
ALTER TABLE invoices MODIFY COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash';
ALTER TABLE invoices_non_gst MODIFY COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash';
ALTER TABLE customer_payments MODIFY COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash';

-- 2. Create roles table
DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  perm_create_job_card TINYINT(1) DEFAULT 1,
  perm_delete_invoice TINYINT(1) DEFAULT 1,
  perm_view_accounts TINYINT(1) DEFAULT 1,
  perm_view_payments TINYINT(1) DEFAULT 1,
  perm_edit_estimate TINYINT(1) DEFAULT 1,
  perm_inventory TINYINT(1) DEFAULT 1,
  perm_customer TINYINT(1) DEFAULT 1,
  perm_reports TINYINT(1) DEFAULT 1,
  perm_settings TINYINT(1) DEFAULT 1
);

-- Seed default roles
INSERT IGNORE INTO roles (role_name, perm_create_job_card, perm_delete_invoice, perm_view_accounts, perm_view_payments, perm_edit_estimate, perm_inventory, perm_customer, perm_reports, perm_settings) VALUES
('admin', 1, 1, 1, 1, 1, 1, 1, 1, 1),
('service_advisor', 1, 0, 0, 1, 1, 1, 1, 0, 0),
('technician', 0, 0, 0, 0, 0, 0, 0, 0, 0);

-- 3. Create global suggestions table
CREATE TABLE IF NOT EXISTS global_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_type VARCHAR(50) NOT NULL,
  suggestion_text VARCHAR(255) NOT NULL,
  usage_count INT DEFAULT 1,
  UNIQUE KEY uq_type_text (suggestion_type, suggestion_text)
);

-- 4. Create advance payments log table
CREATE TABLE IF NOT EXISTS advance_payments_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id INT NULL,
  staff_id INT NULL,
  customer_id INT NULL,
  advance_type VARCHAR(50) NOT NULL, -- 'current_invoice', 'future_invoice', 'next_month', 'salary', 'misc'
  amount DECIMAL(10,2) NOT NULL,
  used_amount DECIMAL(10,2) DEFAULT 0.00,
  remaining_amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  reason VARCHAR(255) NULL,
  history TEXT NULL, -- JSON string detailing usages
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
