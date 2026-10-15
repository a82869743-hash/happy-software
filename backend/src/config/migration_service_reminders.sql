-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HAPPY CAR WASH GMS â€” Service Reminders Migration
-- Creates the service_reminders table for next-service follow-ups
-- Safe to re-run: uses IF NOT EXISTS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

USE happy_gms;

CREATE TABLE IF NOT EXISTS service_reminders (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT NOT NULL,
  vehicle_reg_no  VARCHAR(20) NOT NULL,
  job_no          VARCHAR(30) NULL,
  customer_name   VARCHAR(150) NOT NULL,
  customer_mobile VARCHAR(15),
  reminder_type   VARCHAR(100) NULL,
  reminder_date   DATE NOT NULL,
  notes           TEXT NULL,
  km_at_next      INT NULL,
  notify_via      VARCHAR(50) DEFAULT 'whatsapp',
  is_done         TINYINT(1) DEFAULT 0,
  wp_sent_at      DATETIME NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_svc_rem_date ON service_reminders(reminder_date);
CREATE INDEX idx_svc_rem_job ON service_reminders(job_card_id);
CREATE INDEX idx_svc_rem_vehicle ON service_reminders(vehicle_reg_no);
CREATE INDEX idx_svc_rem_done ON service_reminders(is_done);

