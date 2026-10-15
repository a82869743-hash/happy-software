-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HAPPY CAR WASH GMS â€” SMS Module Migration
-- Run AFTER all existing migrations
-- Safe to re-run: all statements use IF NOT EXISTS / INSERT IGNORE
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

USE happy_gms;

-- 1. Ensure bill_dispatch_log has all required columns
-- (table already exists from migration_autorox.sql â€” only add missing columns)
ALTER TABLE bill_dispatch_log
  ADD COLUMN IF NOT EXISTS template_key VARCHAR(100) NULL AFTER template_name,
  ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(50) NULL AFTER template_key,
  ADD COLUMN IF NOT EXISTS channel ENUM('sms','whatsapp','both') DEFAULT 'sms' AFTER trigger_event;

-- Modify dispatch_type ENUM to support 'both' as a valid channel
ALTER TABLE bill_dispatch_log MODIFY COLUMN dispatch_type ENUM('sms','whatsapp','both') NOT NULL;

-- 2. Add sms_template_* rows to settings table
-- These are the actual DLT-approved message templates stored in the DB
-- Admin can update them via the Settings UI after DLT registration
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('sms_enabled',                    'false'),
  ('whatsapp_enabled',               'false'),
  ('sms_job_opened_enabled',         'true'),
  ('sms_status_update_enabled',      'true'),
  ('sms_invoice_manual_enabled',     'true'),
  ('msg91_auth_key',                 ''),
  ('msg91_sender_id',                'HAPPY'),
  ('msg91_dlt_entity_id',            ''),
  ('msg91_job_opened_template_id',   ''),
  ('msg91_status_rfe_template_id',   ''),
  ('msg91_status_estimation_template_id', ''),
  ('msg91_status_spares_pending_template_id', ''),
  ('msg91_status_wip_template_id',   ''),
  ('msg91_status_ready_template_id', ''),
  ('msg91_status_delivered_template_id', ''),
  ('msg91_status_invoiced_template_id', ''),
  ('msg91_status_cancelled_template_id', ''),
  ('msg91_invoice_template_id',      ''),
  ('sms_template_job_opened',
   'Dear {#var#}, your vehicle {#var#} has been received at Happy Car Wash. Track your service live: {#var#} - HAPPY'),
  ('sms_template_status_rfe',
   'Dear {#var#}, your vehicle {#var#} has been accepted at Happy Car Wash. We will begin estimation shortly. - HAPPY'),
  ('sms_template_status_estimation',
   'Dear {#var#}, estimation for your vehicle {#var#} is being prepared. We will update you soon. - HAPPY'),
  ('sms_template_status_spares_pending',
   'Dear {#var#}, spares are being arranged for your vehicle {#var#}. We will update you once work begins. - HAPPY'),
  ('sms_template_status_wip',
   'Dear {#var#}, your vehicle {#var#} is now under service at Happy Car Wash. - HAPPY'),
  ('sms_template_status_ready',
   'Dear {#var#}, great news! Your vehicle {#var#} is ready for pickup at Happy Car Wash, Vadodara. - HAPPY'),
  ('sms_template_status_delivered',
   'Dear {#var#}, your vehicle {#var#} has been delivered. Thank you for choosing Happy Car Wash! - HAPPY'),
  ('sms_template_status_invoiced',
   'Dear {#var#}, your invoice has been generated for vehicle {#var#}. Thank you for your business! - HAPPY'),
  ('sms_template_status_cancelled',
   'Dear {#var#}, the service request for your vehicle {#var#} has been cancelled. Please contact us for details. - HAPPY'),
  ('sms_template_invoice',
   'Dear {#var#}, your invoice {#var#} for vehicle {#var#} totalling Rs.{#var#} is ready. Thank you - Happy Car Wash, Vadodara. - HAPPY');

