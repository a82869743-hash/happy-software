CREATE TABLE IF NOT EXISTS concern_presets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  concern_text VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

TRUNCATE TABLE concern_presets;

INSERT INTO concern_presets (concern_text, category, sort_order) VALUES
('Engine oil level and condition', 'Engine', 1),
('Oil leaks', 'Engine', 2),
('Engine noise or vibration', 'Engine', 3),
('Air filter condition', 'Engine', 4),

('Battery health and voltage', 'Battery', 5),
('Terminal corrosion', 'Battery', 6),
('Charging system performance', 'Battery', 7),

('Brake pad wear', 'Brakes', 8),
('Brake fluid level', 'Brakes', 9),
('Brake disc/drum condition', 'Brakes', 10),
('Brake performance', 'Brakes', 11),

('Tyre pressure', 'Tyres', 12),
('Tread depth', 'Tyres', 13),
('Uneven wear', 'Tyres', 14),
('Wheel alignment issues', 'Tyres', 15),

('Coolant level', 'Fluids', 16),
('Brake fluid level', 'Fluids', 17),
('Windshield washer fluid', 'Fluids', 18),
('Power steering fluid (if applicable)', 'Fluids', 19),
('Transmission fluid (if applicable)', 'Fluids', 20),

('Headlights', 'Lights & Electrical', 21),
('Tail lights', 'Lights & Electrical', 22),
('Brake lights', 'Lights & Electrical', 23),
('Indicators', 'Lights & Electrical', 24),
('Horn operation', 'Lights & Electrical', 25),

('AC cooling performance', 'AC & Cabin', 26),
('Cabin air filter condition', 'AC & Cabin', 27),
('Unusual odors', 'AC & Cabin', 28),

('Suspension noise', 'Suspension & Steering', 29),
('Shock absorber condition', 'Suspension & Steering', 30),
('Steering play or vibration', 'Suspension & Steering', 31),

('Cracked or worn belts', 'Belts & Hoses', 32),
('Coolant hose leaks', 'Belts & Hoses', 33),
('Loose connections', 'Belts & Hoses', 34),

('Windshield wipers condition', 'Safety & General', 35),
('Windshield cracks', 'Safety & General', 36),
('Door locks and windows', 'Safety & General', 37),
('Seat belts', 'Safety & General', 38),

('Strange engine noise', 'Common Customer Concerns', 39),
('Reduced mileage (fuel efficiency)', 'Common Customer Concerns', 40),
('Vehicle pulling to one side', 'Common Customer Concerns', 41),
('Brake noise or weak braking', 'Common Customer Concerns', 42),
('AC not cooling properly', 'Common Customer Concerns', 43),
('Hard starting or battery issues', 'Common Customer Concerns', 44),
('Excessive smoke from exhaust', 'Common Customer Concerns', 45),
('Vibrations while driving', 'Common Customer Concerns', 46),
('Warning lights on dashboard', 'Common Customer Concerns', 47),
('Fluid leaks under the vehicle', 'Common Customer Concerns', 48);
