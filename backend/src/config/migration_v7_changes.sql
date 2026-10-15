-- HAPPY CAR WASH GMS V7.0 â€” Add old_part column to job_card_services
ALTER TABLE job_card_services ADD COLUMN IF NOT EXISTS old_part TINYINT(1) DEFAULT 0;

