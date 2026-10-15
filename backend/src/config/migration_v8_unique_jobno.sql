-- Migration v8: Unique constraints on job_no and rfe_no
-- These prevent duplicate job/RFE numbers even under race conditions

-- Add unique index on job_no (skip if already exists)
SET @exists_job_no = (SELECT COUNT(1) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND INDEX_NAME = 'uq_job_cards_job_no');
SET @sql_job_no = IF(@exists_job_no = 0, 
  'ALTER TABLE job_cards ADD UNIQUE INDEX uq_job_cards_job_no (job_no)', 
  'SELECT 1');
PREPARE stmt FROM @sql_job_no;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unique index on rfe_no (skip if already exists)
SET @exists_rfe_no = (SELECT COUNT(1) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND INDEX_NAME = 'uq_job_cards_rfe_no');
SET @sql_rfe_no = IF(@exists_rfe_no = 0, 
  'ALTER TABLE job_cards ADD UNIQUE INDEX uq_job_cards_rfe_no (rfe_no)', 
  'SELECT 1');
PREPARE stmt FROM @sql_rfe_no;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
