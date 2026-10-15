-- SQL migration to add spare_wheel, pointers to job_cards, and hsn_sac to parts (standard syntax)

ALTER TABLE job_cards ADD COLUMN spare_wheel TINYINT(1) DEFAULT 0;
ALTER TABLE job_cards ADD COLUMN pointers TEXT DEFAULT NULL;
ALTER TABLE parts ADD COLUMN hsn_sac VARCHAR(20) DEFAULT '8708';
ALTER TABLE vehicles ADD COLUMN insurance_expiry DATE DEFAULT NULL;

