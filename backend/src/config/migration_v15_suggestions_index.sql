-- Migration v15: Suggestions index optimization for sub-50ms ranking
CREATE TABLE IF NOT EXISTS global_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_type VARCHAR(50) NOT NULL,
  suggestion_text VARCHAR(255) NOT NULL,
  usage_count INT DEFAULT 1,
  UNIQUE KEY uq_type_text (suggestion_type, suggestion_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_gs_type_count ON global_suggestions (suggestion_type, usage_count);
