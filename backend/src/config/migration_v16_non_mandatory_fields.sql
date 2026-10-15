-- Migration v16: Make all vehicle & customer fields optional across Car Wash, Detailing Studio, and Accessories
ALTER TABLE job_cards MODIFY COLUMN reg_no VARCHAR(20) NULL DEFAULT '';
ALTER TABLE job_cards MODIFY COLUMN car_name VARCHAR(100) NULL DEFAULT '';
ALTER TABLE job_cards MODIFY COLUMN owner_name VARCHAR(150) NULL DEFAULT 'Customer';
ALTER TABLE job_cards MODIFY COLUMN mobile_no VARCHAR(20) NULL DEFAULT '';

ALTER TABLE customers MODIFY COLUMN customer_name VARCHAR(200) NULL DEFAULT 'Customer';
ALTER TABLE customers MODIFY COLUMN mobile_no VARCHAR(20) NULL DEFAULT NULL;
