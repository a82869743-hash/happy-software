-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V12: Alter payment_mode columns in job_cards and estimates to VARCHAR(50)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE job_cards MODIFY COLUMN payment_mode VARCHAR(50) NULL;
ALTER TABLE estimates MODIFY COLUMN payment_mode VARCHAR(50) NULL;
