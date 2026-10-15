-- SQL migration to add charging_pct to job_cards and job_category to job_card_services
ALTER TABLE job_cards ADD COLUMN charging_pct INT DEFAULT NULL;
ALTER TABLE job_card_services ADD COLUMN job_category VARCHAR(255) DEFAULT NULL;
