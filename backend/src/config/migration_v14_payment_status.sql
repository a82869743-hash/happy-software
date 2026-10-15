-- Migration V14: Invoice payment_status column and custom_categories table
-- Default payment_status to 'outstanding' for new invoices, backfill existing rows to 'approved'

ALTER TABLE invoices ADD COLUMN payment_status ENUM('outstanding', 'approved') NOT NULL DEFAULT 'outstanding';
ALTER TABLE invoices_non_gst ADD COLUMN payment_status ENUM('outstanding', 'approved') NOT NULL DEFAULT 'outstanding';

UPDATE invoices SET payment_status = 'approved';
UPDATE invoices_non_gst SET payment_status = 'approved';

CREATE TABLE IF NOT EXISTS custom_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
