-- Add job category, description and amount columns to job_cards table
ALTER TABLE job_cards ADD COLUMN job_category VARCHAR(255) NULL AFTER notes;
ALTER TABLE job_cards ADD COLUMN job_category_desc TEXT NULL AFTER job_category;
ALTER TABLE job_cards ADD COLUMN job_category_amount DECIMAL(10,2) NULL DEFAULT 0.00 AFTER job_category_desc;
