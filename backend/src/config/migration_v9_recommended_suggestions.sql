USE happy_gms;

-- 1. Create recommended_services table
CREATE TABLE IF NOT EXISTS recommended_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  item_type ENUM('part', 'labour') DEFAULT 'labour',
  period VARCHAR(100) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed with initial recommended services if empty
INSERT INTO recommended_services (name, category, item_type, period)
SELECT * FROM (
  SELECT 'Interior Detailing & Sanitisation' AS name, 'Detailing' AS category, 'labour' AS item_type, '1 yr' AS period UNION ALL
  SELECT 'Exterior Rubbing & Polishing', 'Detailing', 'labour', '6 mo' UNION ALL
  SELECT 'Windshield Treatment', 'Detailing', 'labour', '6 mo' UNION ALL
  SELECT 'AC Evaporator Cleaning', 'AC Service', 'labour', '1 yr' UNION ALL
  SELECT 'Brake System Servicing Front & Rear', 'Mechanical', 'labour', '10000 km' UNION ALL
  SELECT 'Wheel Alignment & Balancing', 'Alignment', 'labour', '5000 km' UNION ALL
  SELECT 'Engine Oil & Filter Change', 'Oil Service', 'labour', '10000 km' UNION ALL
  SELECT 'Spark Plug Replacement', 'Electrical', 'labour', '20000 km' UNION ALL
  SELECT 'Wiper Blade Replacement', 'Accessories', 'part', '1 yr' UNION ALL
  SELECT 'Coolant Flush & Refill', 'Mechanical', 'labour', '2 yr' UNION ALL
  SELECT 'Transmission Fluid Replacement', 'Mechanical', 'labour', '40000 km' UNION ALL
  SELECT 'Battery Replacement', 'Electrical', 'part', '3 yr'
) AS seed_data
WHERE NOT EXISTS (SELECT 1 FROM recommended_services);

-- 2. Alter service_suggestions table to add hsn_sac and tax_pct
ALTER TABLE service_suggestions ADD COLUMN hsn_sac VARCHAR(20) NULL AFTER suggestion_type;
ALTER TABLE service_suggestions ADD COLUMN tax_pct DECIMAL(5,2) NULL DEFAULT 18.00 AFTER hsn_sac;

