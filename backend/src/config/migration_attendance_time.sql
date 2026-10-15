-- ============================================================
-- STAFF ENTRY & EXIT TIME IN ATTENDANCE
-- migration_attendance_time.sql
-- Run AFTER migration_quick_jobcard.sql
-- ============================================================

-- Add entry_time and exit_time columns to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS entry_time TIME DEFAULT NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS exit_time TIME DEFAULT NULL;

-- ============================================================
