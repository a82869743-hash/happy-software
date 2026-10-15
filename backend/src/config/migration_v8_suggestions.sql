-- Migration v8: Service suggestions table for auto-complete
-- Stores all previously used service names, part names, and categories

CREATE TABLE IF NOT EXISTS service_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_text VARCHAR(255) NOT NULL,
  suggestion_type ENUM('service_name', 'part_name', 'category') NOT NULL DEFAULT 'service_name',
  usage_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_suggestion (suggestion_text, suggestion_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
