-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Estimate Payment support
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE customer_payments MODIFY COLUMN job_card_id INT NULL;
ALTER TABLE customer_payments ADD COLUMN estimate_id INT NULL;
ALTER TABLE customer_payments ADD CONSTRAINT fk_cp_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE;
