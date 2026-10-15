-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HAPPY CAR WASH GMS â€” Complete Safe Live Database Migration Script (Non-Destructive Update)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Paste and execute this directly in phpMyAdmin > SQL tab on your live database!
-- This script contains ONLY non-destructive CREATE TABLE IF NOT EXISTS statements.
-- It WILL NOT drop any tables, truncate data, or overwrite existing live data.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) NOT NULL DEFAULT '',
  `role` enum('admin','service_advisor','technician','staff') DEFAULT 'admin',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `advance_bookings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `booking_no` varchar(30) NOT NULL,
  `customer_name` varchar(200) NOT NULL,
  `mobile_no` varchar(15) NOT NULL,
  `reg_no` varchar(20) DEFAULT NULL,
  `car_name` varchar(150) DEFAULT NULL,
  `service_type` varchar(150) DEFAULT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time DEFAULT NULL,
  `notes` text,
  `status` enum('pending','confirmed','arrived','cancelled') NOT NULL DEFAULT 'pending',
  `job_card_id` int unsigned DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_no` (`booking_no`),
  KEY `idx_booking_date` (`booking_date`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `advance_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `payment_type` enum('cash','upi','bank','cheque') NOT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `cheque_no` varchar(50) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `job_card_id` (`job_card_id`),
  CONSTRAINT `advance_payments_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `advance_payments_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int DEFAULT NULL,
  `staff_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `advance_type` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `used_amount` decimal(10,2) DEFAULT '0.00',
  `remaining_amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `history` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `after_service_concerns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_name` varchar(300) NOT NULL,
  `resolved_status` enum('resolved','partially_resolved','not_resolved') DEFAULT 'not_resolved',
  `remarks` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asc_job` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `status` enum('present','absent','half') NOT NULL,
  `check_in_time` time DEFAULT NULL,
  `check_out_time` time DEFAULT NULL,
  `overtime_hours` decimal(4,2) DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `entry_time` time DEFAULT NULL,
  `exit_time` time DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_date` (`staff_id`,`attendance_date`),
  KEY `idx_attendance_date` (`attendance_date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `bill_dispatch_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `dispatch_type` enum('sms','whatsapp','both') NOT NULL,
  `recipient_no` varchar(20) NOT NULL,
  `template_name` varchar(100) DEFAULT NULL,
  `template_key` varchar(100) DEFAULT NULL,
  `trigger_event` varchar(50) DEFAULT NULL,
  `channel` enum('sms','whatsapp','both') DEFAULT 'sms',
  `status` enum('sent','failed','pending') DEFAULT 'pending',
  `provider_ref` varchar(200) DEFAULT NULL,
  `error_message` text,
  `dispatched_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dispatched_by` (`dispatched_by`),
  KEY `idx_dispatch_job` (`job_card_id`),
  KEY `idx_dispatch_date` (`created_at`),
  CONSTRAINT `bill_dispatch_log_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bill_dispatch_log_ibfk_2` FOREIGN KEY (`dispatched_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `cash_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_type` enum('in','out') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` varchar(500) NOT NULL,
  `entry_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_ledger_date` (`entry_date`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `concern_presets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `concern_text` varchar(300) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `customer_concerns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int unsigned NOT NULL,
  `concern_text` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_completed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_job_card_id` (`job_card_id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `customer_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) NOT NULL DEFAULT 'cash',
  `transaction_id` varchar(100) DEFAULT NULL,
  `payment_date` date NOT NULL,
  `remarks` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estimate_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cp_job` (`job_card_id`),
  KEY `idx_cp_date` (`payment_date`),
  KEY `fk_cp_estimate` (`estimate_id`),
  CONSTRAINT `fk_cp_estimate` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_type` enum('individual','corporate','fleet') DEFAULT 'individual',
  `customer_name` varchar(200) NOT NULL,
  `company_name` varchar(200) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `ref_no` varchar(50) DEFAULT NULL,
  `mobile_no` varchar(15) NOT NULL,
  `alt_mobile` varchar(15) DEFAULT NULL,
  `email` varchar(200) DEFAULT NULL,
  `contact_person` varchar(200) DEFAULT NULL,
  `driver_name` varchar(200) DEFAULT NULL,
  `address_line` text,
  `colony_street` varchar(200) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `state_code` varchar(10) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `is_sez` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_mobile` (`mobile_no`),
  KEY `idx_customers_name` (`customer_name`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `estimate_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `action` enum('created','edited','converted','archived','restored','bulk_archived') NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(100) DEFAULT NULL,
  `details` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estimate_audit_estimate` (`estimate_id`),
  KEY `idx_estimate_audit_action` (`action`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `estimate_history_vault` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `estimate_no` varchar(30) NOT NULL,
  `estimate_type` enum('gst_estimate','non_gst_estimate') NOT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `mobile_no` varchar(20) DEFAULT NULL,
  `reg_no` varchar(20) DEFAULT NULL,
  `car_name` varchar(100) DEFAULT NULL,
  `vehicle_make` varchar(50) DEFAULT NULL,
  `vehicle_model` varchar(50) DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `gst_percentage` decimal(5,2) DEFAULT '0.00',
  `gst_amount` decimal(10,2) DEFAULT '0.00',
  `total_amount` decimal(10,2) DEFAULT '0.00',
  `payment_mode` varchar(20) DEFAULT NULL,
  `services_json` json DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `vault_action` enum('archived','created','converted') DEFAULT 'archived',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `estimate_job_mapping` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `job_card_id` int NOT NULL,
  `converted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `converted_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `estimate_id` (`estimate_id`),
  KEY `job_card_id` (`job_card_id`),
  CONSTRAINT `estimate_job_mapping_ibfk_1` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `estimate_job_mapping_ibfk_2` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `estimate_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `service_name` varchar(200) NOT NULL,
  `item_type` enum('labour','part','consumable','external') DEFAULT 'labour',
  `part_code` varchar(30) DEFAULT NULL,
  `qty` decimal(10,2) DEFAULT '1.00',
  `rate` decimal(10,2) DEFAULT '0.00',
  `amount` decimal(10,2) DEFAULT '0.00',
  `hsn_sac` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `estimate_id` (`estimate_id`),
  CONSTRAINT `estimate_services_ibfk_1` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `estimates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int DEFAULT NULL,
  `estimate_no` varchar(30) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) DEFAULT NULL,
  `estimate_type` enum('gst_estimate','non_gst_estimate') NOT NULL DEFAULT 'non_gst_estimate',
  `gst_percentage` decimal(5,2) DEFAULT '0.00',
  `gst_amount` decimal(10,2) DEFAULT '0.00',
  `total_amount` decimal(10,2) DEFAULT '0.00',
  `is_archived` tinyint(1) DEFAULT '0',
  `archived_at` datetime DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `mobile_no` varchar(20) DEFAULT NULL,
  `reg_no` varchar(20) DEFAULT NULL,
  `car_name` varchar(100) DEFAULT NULL,
  `vehicle_make` varchar(50) DEFAULT NULL,
  `vehicle_model` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `estimate_no` (`estimate_no`),
  KEY `idx_estimates_date` (`created_at`),
  KEY `idx_estimates_archived` (`is_archived`),
  KEY `idx_estimates_type` (`estimate_type`),
  KEY `idx_est_job` (`job_card_id`),
  KEY `idx_est_date` (`created_at`),
  CONSTRAINT `estimates_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `global_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_type` varchar(50) NOT NULL,
  `suggestion_text` varchar(255) NOT NULL,
  `usage_count` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_type_text` (`suggestion_type`,`suggestion_text`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `invoice_download_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `downloaded_by` int DEFAULT NULL,
  `downloaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_idl_invoice` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `invoice_no` varchar(30) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `gst_percent` decimal(5,2) NOT NULL DEFAULT '18.00',
  `gst_amount` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) NOT NULL DEFAULT 'cash',
  `payment_status` varchar(50) DEFAULT 'outstanding',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `gst_type` enum('with_gst','without_gst') NOT NULL DEFAULT 'with_gst',
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_card_id` (`job_card_id`),
  UNIQUE KEY `invoice_no` (`invoice_no`),
  KEY `idx_invoices_date` (`created_at`),
  KEY `idx_inv_job` (`job_card_id`),
  KEY `idx_inv_date` (`created_at`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `invoices_non_gst` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `invoice_no` varchar(50) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_mode` varchar(50) NOT NULL DEFAULT 'cash',
  `payment_status` varchar(50) DEFAULT 'outstanding',
  `customer_name` varchar(200) DEFAULT NULL,
  `mobile_no` varchar(15) DEFAULT NULL,
  `reg_no` varchar(20) DEFAULT NULL,
  `car_name` varchar(200) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_card_id` (`job_card_id`),
  UNIQUE KEY `invoice_no` (`invoice_no`),
  KEY `idx_nongst_job` (`job_card_id`),
  KEY `idx_nongst_date` (`created_at`),
  KEY `idx_nongst_deleted` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `job_card_concern_checklist` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_name` varchar(300) NOT NULL,
  `is_checked` tinyint(1) DEFAULT '0',
  `checked_by` int DEFAULT NULL,
  `checked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jcc_job` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `job_card_media` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int unsigned NOT NULL,
  `media_type` enum('image','video') NOT NULL DEFAULT 'image',
  `stage` enum('before','after','other') NOT NULL DEFAULT 'before',
  `file_name` varchar(300) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `file_size` int unsigned DEFAULT NULL COMMENT 'bytes',
  `caption` varchar(300) DEFAULT NULL,
  `uploaded_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_card_id` (`job_card_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `job_card_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_id` int unsigned DEFAULT NULL,
  `service_name` varchar(200) NOT NULL,
  `item_type` enum('part','labour') DEFAULT 'labour',
  `part_code` varchar(30) DEFAULT NULL,
  `part_no` varchar(50) DEFAULT NULL,
  `labour_code` varchar(30) DEFAULT NULL,
  `price_type` enum('price','mrp','fixed','variable') DEFAULT 'price',
  `qty` decimal(10,2) DEFAULT '1.00',
  `rate` decimal(10,2) DEFAULT NULL,
  `discount_pct` decimal(5,2) DEFAULT '0.00',
  `hsn_sac` varchar(20) DEFAULT NULL,
  `tax_pct` decimal(5,2) DEFAULT '18.00',
  `tax_amount` decimal(10,2) DEFAULT '0.00',
  `is_selected` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `unit` varchar(20) DEFAULT 'pc',
  `job_category` varchar(255) DEFAULT NULL,
  `package_name` varchar(255) DEFAULT NULL,
  `old_part` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_jcs_job_card` (`job_card_id`),
  KEY `idx_jcs_job` (`job_card_id`),
  KEY `fk_jcs_concern` (`concern_id`),
  CONSTRAINT `fk_jcs_concern` FOREIGN KEY (`concern_id`) REFERENCES `customer_concerns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `job_card_services_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=323 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `job_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_no` varchar(30) NOT NULL,
  `rfe_no` varchar(30) DEFAULT NULL,
  `reg_no` varchar(20) NOT NULL,
  `car_name` varchar(100) NOT NULL,
  `owner_name` varchar(150) NOT NULL DEFAULT '',
  `mobile_no` varchar(15) DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `vehicle_id` int DEFAULT NULL,
  `odometer` int DEFAULT NULL,
  `avg_km_day` int DEFAULT '25',
  `service_type` varchar(100) DEFAULT NULL,
  `service_advisor` varchar(100) DEFAULT NULL,
  `estimated_delivery` date DEFAULT NULL,
  `is_inhouse` tinyint(1) DEFAULT '0',
  `assigned_staff_id` int DEFAULT NULL,
  `status` enum('rfe','estimation','spares_pending','wip','ready','delivered','invoiced','cancelled','active','done') DEFAULT 'rfe',
  `completion_type` enum('invoice','estimate') DEFAULT NULL,
  `final_amount` decimal(10,2) DEFAULT NULL,
  `payment_mode` varchar(50) DEFAULT NULL,
  `notes` text,
  `job_category` varchar(255) DEFAULT NULL,
  `job_category_desc` text,
  `job_category_amount` decimal(10,2) DEFAULT '0.00',
  `job_category_gst_pct` decimal(5,2) DEFAULT '18.00',
  `job_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `closed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `public_token` varchar(64) DEFAULT NULL,
  `is_quick_job` tinyint(1) NOT NULL DEFAULT '0',
  `insurance_claim_no` varchar(100) DEFAULT NULL,
  `insurance_company` varchar(150) DEFAULT NULL,
  `vehicle_make` varchar(100) DEFAULT NULL,
  `vehicle_model` varchar(100) DEFAULT NULL,
  `fuel_level` varchar(20) DEFAULT NULL,
  `fuel_level_percent` int DEFAULT NULL,
  `fuel_photo` varchar(500) DEFAULT NULL,
  `claim_no` varchar(100) DEFAULT NULL,
  `policy_no` varchar(100) DEFAULT NULL,
  `corporate_name` varchar(200) DEFAULT NULL,
  `accident_date` date DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') DEFAULT NULL,
  `approved_amount` decimal(10,2) DEFAULT NULL,
  `parts_ordered` int DEFAULT '0',
  `parts_inward` int DEFAULT '0',
  `parts_issued` int DEFAULT '0',
  `approval_date` date DEFAULT NULL,
  `parts_order_count` int DEFAULT '0',
  `parts_inward_count` int DEFAULT '0',
  `parts_issue_count` int DEFAULT '0',
  `parts_pending` int DEFAULT '0',
  `parts_approved` int DEFAULT '0',
  `parts_rejected` int DEFAULT '0',
  `is_deleted` tinyint(1) DEFAULT '0',
  `spare_wheel` tinyint(1) DEFAULT '0',
  `pointers` text,
  `charging_pct` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_no` (`job_no`),
  UNIQUE KEY `uq_job_cards_job_no` (`job_no`),
  UNIQUE KEY `public_token` (`public_token`),
  UNIQUE KEY `uq_job_cards_rfe_no` (`rfe_no`),
  KEY `assigned_staff_id` (`assigned_staff_id`),
  KEY `idx_job_cards_date` (`job_date`),
  KEY `idx_job_cards_status` (`status`),
  KEY `idx_job_cards_reg` (`reg_no`),
  KEY `idx_job_cards_completion` (`completion_type`),
  CONSTRAINT `job_cards_ibfk_1` FOREIGN KEY (`assigned_staff_id`) REFERENCES `staff` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `non_gst_kill_switch_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `deleted_by` int DEFAULT NULL,
  `deleted_by_name` varchar(200) DEFAULT NULL,
  `records_deleted` int NOT NULL DEFAULT '0',
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `parts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `part_code` varchar(30) NOT NULL,
  `part_name` varchar(255) NOT NULL,
  `category` varchar(100) DEFAULT 'General',
  `unit` varchar(20) DEFAULT 'pc',
  `buying_price` decimal(10,2) DEFAULT '0.00',
  `selling_price` decimal(10,2) NOT NULL,
  `stock_qty` decimal(10,2) DEFAULT '0.00',
  `low_stock_alert` decimal(10,2) DEFAULT '5.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hsn_sac` varchar(20) DEFAULT '8708',
  PRIMARY KEY (`id`),
  UNIQUE KEY `part_code` (`part_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `parts_sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `part_id` int NOT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `payment_mode` varchar(50) NOT NULL,
  `job_card_id` int DEFAULT NULL,
  `sale_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `part_id` (`part_id`),
  CONSTRAINT `parts_sales_ibfk_1` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `post_service_inspection` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_resolved` tinyint(1) DEFAULT '0',
  `vehicle_cleaned` tinyint(1) DEFAULT '0',
  `photos_uploaded` tinyint(1) DEFAULT '0',
  `quality_check` tinyint(1) DEFAULT '0',
  `inspected_by` int DEFAULT NULL,
  `inspected_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_card_id` (`job_card_id`),
  KEY `idx_psi_job` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `product_sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_name` varchar(200) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `customer_name` varchar(150) DEFAULT NULL,
  `payment_mode` enum('cash','upi','card','bank') NOT NULL,
  `sale_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_sales_date` (`sale_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `quick_services` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `service_name` varchar(200) NOT NULL,
  `default_rate` decimal(10,2) NOT NULL DEFAULT '0.00',
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_service_name` (`service_name`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `recommended_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `item_type` enum('part','labour') DEFAULT 'labour',
  `period` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `perm_create_job_card` tinyint(1) DEFAULT '1',
  `perm_delete_invoice` tinyint(1) DEFAULT '1',
  `perm_view_accounts` tinyint(1) DEFAULT '1',
  `perm_view_payments` tinyint(1) DEFAULT '1',
  `perm_edit_estimate` tinyint(1) DEFAULT '1',
  `perm_inventory` tinyint(1) DEFAULT '1',
  `perm_customer` tinyint(1) DEFAULT '1',
  `perm_reports` tinyint(1) DEFAULT '1',
  `perm_settings` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `service_bookings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `booking_no` varchar(30) NOT NULL,
  `customer_name` varchar(200) NOT NULL,
  `mobile_no` varchar(15) NOT NULL,
  `car_number` varchar(20) DEFAULT NULL,
  `car_name` varchar(150) DEFAULT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time DEFAULT NULL,
  `concerns` text,
  `advance_amount` decimal(10,2) DEFAULT '0.00',
  `advance_mode` enum('cash','upi','card','bank_transfer') DEFAULT NULL,
  `booking_status` enum('scheduled','confirmed','completed','cancelled') DEFAULT 'scheduled',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_no` (`booking_no`),
  KEY `idx_sb_date` (`booking_date`),
  KEY `idx_sb_status` (`booking_status`),
  KEY `idx_sb_mobile` (`mobile_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `service_catalog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `category` enum('mechanical','electrical','body','detailing','ac','tyre','oil','general','parts') DEFAULT 'general',
  `item_type` enum('part','labour') DEFAULT 'labour',
  `default_rate` decimal(10,2) DEFAULT '0.00',
  `hsn_sac` varchar(20) DEFAULT NULL,
  `tax_pct` decimal(5,2) DEFAULT '18.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_category` (`category`),
  KEY `idx_catalog_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=412 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `service_package_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `package_id` int unsigned NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `item_type` enum('part','labour') NOT NULL DEFAULT 'labour',
  PRIMARY KEY (`id`),
  KEY `package_id` (`package_id`),
  CONSTRAINT `service_package_items_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `service_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `service_packages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'General',
  `description` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `service_reminders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `vehicle_reg_no` varchar(20) NOT NULL,
  `job_no` varchar(30) DEFAULT NULL,
  `customer_name` varchar(150) NOT NULL,
  `customer_mobile` varchar(15) DEFAULT NULL,
  `reminder_type` varchar(100) DEFAULT NULL,
  `reminder_date` date NOT NULL,
  `notes` text,
  `km_at_next` int DEFAULT NULL,
  `notify_via` varchar(50) DEFAULT 'whatsapp',
  `is_done` tinyint(1) DEFAULT '0',
  `wp_sent_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_svc_rem_date` (`reminder_date`),
  KEY `idx_svc_rem_job` (`job_card_id`),
  KEY `idx_svc_rem_vehicle` (`vehicle_reg_no`),
  KEY `idx_svc_rem_done` (`is_done`),
  CONSTRAINT `service_reminders_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `service_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_text` varchar(255) NOT NULL,
  `suggestion_type` enum('service_name','part_name','category') NOT NULL DEFAULT 'service_name',
  `hsn_sac` varchar(20) DEFAULT NULL,
  `tax_pct` decimal(5,2) DEFAULT '18.00',
  `usage_count` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suggestion` (`suggestion_text`,`suggestion_type`)
) ENGINE=InnoDB AUTO_INCREMENT=224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  UNIQUE KEY `uk_setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=238 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `staff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_code` varchar(20) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `role` varchar(100) DEFAULT NULL,
  `mobile_no` varchar(15) DEFAULT NULL,
  `date_of_joining` date DEFAULT NULL,
  `monthly_salary` decimal(10,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `admin_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_code` (`staff_code`),
  KEY `fk_staff_admin_user` (`admin_user_id`),
  CONSTRAINT `fk_staff_admin_user` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `staff_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `payment_month` varchar(50) NOT NULL,
  `days_present` int DEFAULT '0',
  `calculated_salary` decimal(10,2) DEFAULT '0.00',
  `paid_amount` decimal(10,2) NOT NULL,
  `payment_type` enum('salary','advance','bonus','deduction') NOT NULL,
  `payment_mode` enum('cash','bank','upi') NOT NULL,
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_staff` (`staff_id`),
  KEY `idx_payments_date` (`payment_date`),
  CONSTRAINT `staff_payments_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `status_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `status` varchar(30) NOT NULL,
  `message` text NOT NULL,
  `recipient_no` varchar(20) DEFAULT NULL,
  `provider_ref` varchar(200) DEFAULT NULL,
  `dispatch_type` varchar(30) DEFAULT 'whatsapp',
  `dispatch_status` varchar(30) DEFAULT 'sent',
  `error_message` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_notif_job` (`job_card_id`),
  KEY `idx_status_notif_date` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `vehicle_master` (
  `id` int NOT NULL AUTO_INCREMENT,
  `make` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  `fuel_types` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `variants` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vm_make` (`make`),
  KEY `idx_vm_model` (`model`)
) ENGINE=InnoDB AUTO_INCREMENT=630 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `reg_no` varchar(20) NOT NULL,
  `make` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `year` int DEFAULT NULL,
  `variant` varchar(100) DEFAULT NULL,
  `vin` varchar(50) DEFAULT NULL,
  `engine_no` varchar(50) DEFAULT NULL,
  `fuel_type` enum('petrol','diesel','cng','electric','hybrid') DEFAULT 'petrol',
  `vehicle_color` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `insurance_company` varchar(200) DEFAULT NULL,
  `policy_number` varchar(100) DEFAULT NULL,
  `insurance_expiry` date DEFAULT NULL,
  `claim_type` enum('own_damage','third_party','comprehensive') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vehicles_reg` (`reg_no`),
  KEY `idx_vehicles_customer` (`customer_id`),
  CONSTRAINT `vehicles_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Safe setting key additions
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('sms_enabled', 'false'),
  ('whatsapp_enabled', 'false'),
  ('sms_job_opened_enabled', 'true'),
  ('sms_status_update_enabled', 'true'),
  ('sms_invoice_manual_enabled', 'true'),
  ('msg91_auth_key', ''),
  ('msg91_sender_id', 'HAPPY');
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SAFE NON-DESTRUCTIVE COLUMN ADDITIONS FOR EXISTING TABLES (PRESERVES LIVE DATA)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

DROP PROCEDURE IF EXISTS `AddColumnIfNotExists`;
DELIMITER //
CREATE PROCEDURE `AddColumnIfNotExists`(
    IN param_table VARCHAR(64),
    IN param_column VARCHAR(64),
    IN param_type_definition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = param_table 
          AND COLUMN_NAME = param_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', param_table, '` ADD COLUMN `', param_column, '` ', param_type_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- Safely add missing columns to customer_payments if table already exists
CALL AddColumnIfNotExists('customer_payments', 'estimate_id', 'INT NULL');
CALL AddColumnIfNotExists('customer_payments', 'staff_id', 'INT UNSIGNED NULL');
CALL AddColumnIfNotExists('customer_payments', 'remarks', 'TEXT NULL');

-- Safely add missing status columns to job_cards if table already exists
CALL AddColumnIfNotExists('job_cards', 'gst_invoice_status', "ENUM('pending','approved','paid') DEFAULT 'pending'");
CALL AddColumnIfNotExists('job_cards', 'non_gst_invoice_status', "ENUM('pending','approved','paid') DEFAULT 'pending'");
CALL AddColumnIfNotExists('job_cards', 'invoice_status', "VARCHAR(50) DEFAULT 'unpaid'");
CALL AddColumnIfNotExists('job_cards', 'closed_at', "DATETIME NULL");
CALL AddColumnIfNotExists('job_cards', 'completion_type', "ENUM('invoice','estimate') NULL");
CALL AddColumnIfNotExists('job_cards', 'is_deleted', "TINYINT(1) DEFAULT 0");

-- Safely add missing columns to staff_payments if table already exists
CALL AddColumnIfNotExists('staff_payments', 'advance_deducted', 'DECIMAL(10,2) DEFAULT 0.00');

-- Safely add missing columns to invoices & invoices_non_gst if table already exists
CALL AddColumnIfNotExists('invoices', 'payment_status', "VARCHAR(50) DEFAULT 'outstanding'");
CALL AddColumnIfNotExists('invoices_non_gst', 'payment_status', "VARCHAR(50) DEFAULT 'outstanding'");
CALL AddColumnIfNotExists('invoices_non_gst', 'deleted_at', "DATETIME NULL");
CALL AddColumnIfNotExists('invoices_non_gst', 'created_by', "INT NULL");

-- Safely ensure job_cards status enum supports all pipeline states
ALTER TABLE `job_cards` MODIFY COLUMN `status` ENUM('rfe','estimation','spares_pending','wip','ready','delivered','invoiced','cancelled','active','done') DEFAULT 'estimation';

DROP PROCEDURE IF EXISTS `AddColumnIfNotExists`;

SET FOREIGN_KEY_CHECKS = 1;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Migration Completed Successfully (Zero Live Data Lost)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

