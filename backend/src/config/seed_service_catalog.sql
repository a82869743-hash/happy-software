-- ============================================================
-- SEED: Service Catalog — Common Indian Auto Service Items
-- Run AFTER migration_autorox.sql
-- ============================================================

INSERT IGNORE INTO service_catalog (name, item_type, category, default_rate, tax_pct, hsn_sac) VALUES
-- RELEVANT PARTS
('Engine Oil 5W-30 (4L)', 'part', 'relevant_parts', 1200.00, 18.00, '27101990'),
('Oil Filter', 'part', 'relevant_parts', 350.00, 18.00, '84212300'),
('Air Filter', 'part', 'relevant_parts', 450.00, 18.00, '84214300'),
('Cabin Filter / AC Filter', 'part', 'relevant_parts', 600.00, 18.00, '84214300'),
('Spark Plug (Set of 4)', 'part', 'relevant_parts', 1800.00, 18.00, '85111000'),
('Brake Pad Front (Set)', 'part', 'relevant_parts', 2200.00, 18.00, '68131000'),
('Brake Pad Rear (Set)', 'part', 'relevant_parts', 1800.00, 18.00, '68131000'),
('Wiper Blade (Pair)', 'part', 'relevant_parts', 650.00, 18.00, '85129000'),
('Coolant (1L)', 'part', 'relevant_parts', 300.00, 18.00, '38200000'),
('Battery 12V 65Ah', 'part', 'relevant_parts', 5500.00, 28.00, '85071000'),

-- ALL SERVICES (general labour)
('Engine Oil Change', 'labour', 'all_services', 500.00, 18.00, '998714'),
('Full Body Inspection', 'labour', 'all_services', 800.00, 18.00, '998714'),
('Brake Fluid Replacement', 'labour', 'all_services', 400.00, 18.00, '998714'),
('Clutch Adjustment', 'labour', 'all_services', 600.00, 18.00, '998714'),
('Suspension Check & Repair', 'labour', 'all_services', 1500.00, 18.00, '998714'),

-- WHEEL ALIGNMENT
('2-Wheel Alignment', 'labour', 'wheel_alignment', 800.00, 18.00, '998714'),
('4-Wheel Alignment (Computerized)', 'labour', 'wheel_alignment', 1500.00, 18.00, '998714'),
('Toe-In / Toe-Out Correction', 'labour', 'wheel_alignment', 600.00, 18.00, '998714'),

-- WHEEL BALANCING
('Wheel Balancing (Per Wheel)', 'labour', 'wheel_balancing', 200.00, 18.00, '998714'),
('Wheel Balancing (All 4 Wheels)', 'labour', 'wheel_balancing', 700.00, 18.00, '998714'),
('Alloy Wheel Repair', 'labour', 'wheel_balancing', 1200.00, 18.00, '998714'),

-- WASH & DETAILING
('Exterior Wash', 'labour', 'wash_detailing', 300.00, 18.00, '998714'),
('Interior + Exterior Wash', 'labour', 'wash_detailing', 500.00, 18.00, '998714'),
('Full Detailing (Interior + Exterior + Polish)', 'labour', 'wash_detailing', 3500.00, 18.00, '998714'),
('Ceramic Coating', 'labour', 'wash_detailing', 8000.00, 18.00, '998714'),
('Teflon Coating', 'labour', 'wash_detailing', 3000.00, 18.00, '998714'),
('Underbody Anti-Rust Coating', 'labour', 'wash_detailing', 2500.00, 18.00, '998714'),

-- PMS & CHECK-UPS
('PMS - Basic (Oil + Filter + Check)', 'labour', 'pms_checkup', 1500.00, 18.00, '998714'),
('PMS - Standard (Basic + Brakes + AC)', 'labour', 'pms_checkup', 3000.00, 18.00, '998714'),
('PMS - Comprehensive (Full Service)', 'labour', 'pms_checkup', 5000.00, 18.00, '998714'),
('AC Gas Top-Up (R134a)', 'labour', 'pms_checkup', 1500.00, 18.00, '998714'),
('AC Gas Filling (Complete)', 'labour', 'pms_checkup', 2500.00, 18.00, '998714'),
('Battery Health Check', 'labour', 'pms_checkup', 200.00, 18.00, '998714'),

-- TYRES & SERVICES
('Tubeless Tyre Puncture Repair', 'labour', 'tyres_services', 200.00, 18.00, '998714'),
('Tyre Rotation (All 4)', 'labour', 'tyres_services', 400.00, 18.00, '998714'),
('Tyre 185/65 R15 (MRF)', 'part', 'tyres_services', 4200.00, 28.00, '40112010'),
('Tyre 205/55 R16 (CEAT)', 'part', 'tyres_services', 5500.00, 28.00, '40112010'),
('Nitrogen Filling (All 4)', 'labour', 'tyres_services', 200.00, 18.00, '998714'),

-- GENERAL
('Denting & Painting (Per Panel)', 'labour', 'general', 3000.00, 18.00, '998714'),
('Headlight Restoration', 'labour', 'general', 1200.00, 18.00, '998714'),
('Windshield Replacement', 'part', 'general', 8000.00, 28.00, '70071100'),
('Side Mirror Replacement', 'part', 'general', 2500.00, 28.00, '70091000');
