-- HAPPY CAR WASH GMS V5.0 â€” Link job_card_services to customer_concerns
USE happy_gms;

-- Add concern_id to job_card_services if not exists
ALTER TABLE job_card_services ADD COLUMN IF NOT EXISTS concern_id INT UNSIGNED NULL AFTER job_card_id;

-- Add foreign key constraint if it doesn't already exist (handled in runner script to avoid duplicates)

