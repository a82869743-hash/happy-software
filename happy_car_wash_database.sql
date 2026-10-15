-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: happy_gms
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `role` enum('admin','service_advisor','technician','staff') COLLATE utf8mb4_general_ci DEFAULT 'admin',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,'admin','$2b$10$h9zESEpon6wro6/5w2aZkOhXXKyapNEj3zqV953ntwLJHRbIQMFke','Admin','admin','2026-06-02 12:17:55','2026-08-28 21:17:15');
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `advance_bookings`
--

DROP TABLE IF EXISTS `advance_bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_bookings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `booking_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `mobile_no` varchar(15) COLLATE utf8mb4_general_ci NOT NULL,
  `reg_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `car_name` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `service_type` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `status` enum('pending','confirmed','arrived','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `job_card_id` int unsigned DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_no` (`booking_no`),
  KEY `idx_booking_date` (`booking_date`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_bookings`
--

LOCK TABLES `advance_bookings` WRITE;
/*!40000 ALTER TABLE `advance_bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `advance_bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `advance_payments`
--

DROP TABLE IF EXISTS `advance_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `payment_type` enum('cash','upi','bank','cheque') COLLATE utf8mb4_general_ci NOT NULL,
  `bank_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cheque_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `job_card_id` (`job_card_id`),
  CONSTRAINT `advance_payments_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_payments`
--

LOCK TABLES `advance_payments` WRITE;
/*!40000 ALTER TABLE `advance_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `advance_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `advance_payments_log`
--

DROP TABLE IF EXISTS `advance_payments_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_payments_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int DEFAULT NULL,
  `staff_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `advance_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `used_amount` decimal(10,2) DEFAULT '0.00',
  `remaining_amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `history` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_payments_log`
--

LOCK TABLES `advance_payments_log` WRITE;
/*!40000 ALTER TABLE `advance_payments_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `advance_payments_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `after_service_concerns`
--

DROP TABLE IF EXISTS `after_service_concerns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `after_service_concerns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `resolved_status` enum('resolved','partially_resolved','not_resolved') COLLATE utf8mb4_general_ci DEFAULT 'not_resolved',
  `remarks` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asc_job` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `after_service_concerns`
--

LOCK TABLES `after_service_concerns` WRITE;
/*!40000 ALTER TABLE `after_service_concerns` DISABLE KEYS */;
/*!40000 ALTER TABLE `after_service_concerns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `status` enum('present','absent','half') COLLATE utf8mb4_general_ci NOT NULL,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bill_dispatch_log`
--

DROP TABLE IF EXISTS `bill_dispatch_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_dispatch_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `dispatch_type` enum('sms','whatsapp','both') COLLATE utf8mb4_general_ci NOT NULL,
  `recipient_no` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `template_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `template_key` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `trigger_event` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `channel` enum('sms','whatsapp','both') COLLATE utf8mb4_general_ci DEFAULT 'sms',
  `status` enum('sent','failed','pending') COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `provider_ref` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_general_ci,
  `dispatched_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dispatched_by` (`dispatched_by`),
  KEY `idx_dispatch_job` (`job_card_id`),
  KEY `idx_dispatch_date` (`created_at`),
  CONSTRAINT `bill_dispatch_log_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bill_dispatch_log_ibfk_2` FOREIGN KEY (`dispatched_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bill_dispatch_log`
--

LOCK TABLES `bill_dispatch_log` WRITE;
/*!40000 ALTER TABLE `bill_dispatch_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `bill_dispatch_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_ledger`
--

DROP TABLE IF EXISTS `cash_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_type` enum('in','out') COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `entry_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_ledger_date` (`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_ledger`
--

LOCK TABLES `cash_ledger` WRITE;
/*!40000 ALTER TABLE `cash_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `concern_presets`
--

DROP TABLE IF EXISTS `concern_presets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `concern_presets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `concern_text` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `concern_presets`
--

LOCK TABLES `concern_presets` WRITE;
/*!40000 ALTER TABLE `concern_presets` DISABLE KEYS */;
INSERT INTO `concern_presets` VALUES (1,'Engine oil level and condition','Engine',1,1,'2026-07-11 01:46:26'),(2,'Oil leaks','Engine',2,1,'2026-07-11 01:46:26'),(3,'Engine noise or vibration','Engine',3,1,'2026-07-11 01:46:26'),(4,'Air filter condition','Engine',4,1,'2026-07-11 01:46:26'),(5,'Battery health and voltage','Battery',5,1,'2026-07-11 01:46:26'),(6,'Terminal corrosion','Battery',6,1,'2026-07-11 01:46:26'),(7,'Charging system performance','Battery',7,1,'2026-07-11 01:46:26'),(8,'Brake pad wear','Brakes',8,1,'2026-07-11 01:46:26'),(9,'Brake fluid level','Brakes',9,1,'2026-07-11 01:46:26'),(10,'Brake disc/drum condition','Brakes',10,1,'2026-07-11 01:46:26'),(11,'Brake performance','Brakes',11,1,'2026-07-11 01:46:26'),(12,'Tyre pressure','Tyres',12,1,'2026-07-11 01:46:26'),(13,'Tread depth','Tyres',13,1,'2026-07-11 01:46:26'),(14,'Uneven wear','Tyres',14,1,'2026-07-11 01:46:26'),(15,'Wheel alignment issues','Tyres',15,1,'2026-07-11 01:46:26'),(16,'Coolant level','Fluids',16,1,'2026-07-11 01:46:26'),(17,'Brake fluid level','Fluids',17,1,'2026-07-11 01:46:26'),(18,'Windshield washer fluid','Fluids',18,1,'2026-07-11 01:46:26'),(19,'Power steering fluid (if applicable)','Fluids',19,1,'2026-07-11 01:46:26'),(20,'Transmission fluid (if applicable)','Fluids',20,1,'2026-07-11 01:46:26'),(21,'Headlights','Lights & Electrical',21,1,'2026-07-11 01:46:26'),(22,'Tail lights','Lights & Electrical',22,1,'2026-07-11 01:46:26'),(23,'Brake lights','Lights & Electrical',23,1,'2026-07-11 01:46:26'),(24,'Indicators','Lights & Electrical',24,1,'2026-07-11 01:46:26'),(25,'Horn operation','Lights & Electrical',25,1,'2026-07-11 01:46:26'),(26,'AC cooling performance','AC & Cabin',26,1,'2026-07-11 01:46:26'),(27,'Cabin air filter condition','AC & Cabin',27,1,'2026-07-11 01:46:26'),(28,'Unusual odors','AC & Cabin',28,1,'2026-07-11 01:46:26'),(29,'Suspension noise','Suspension & Steering',29,1,'2026-07-11 01:46:26'),(30,'Shock absorber condition','Suspension & Steering',30,1,'2026-07-11 01:46:26'),(31,'Steering play or vibration','Suspension & Steering',31,1,'2026-07-11 01:46:26'),(32,'Cracked or worn belts','Belts & Hoses',32,1,'2026-07-11 01:46:26'),(33,'Coolant hose leaks','Belts & Hoses',33,1,'2026-07-11 01:46:26'),(34,'Loose connections','Belts & Hoses',34,1,'2026-07-11 01:46:26'),(35,'Windshield wipers condition','Safety & General',35,1,'2026-07-11 01:46:26'),(36,'Windshield cracks','Safety & General',36,1,'2026-07-11 01:46:26'),(37,'Door locks and windows','Safety & General',37,1,'2026-07-11 01:46:26'),(38,'Seat belts','Safety & General',38,1,'2026-07-11 01:46:26'),(39,'Strange engine noise','Common Customer Concerns',39,1,'2026-07-11 01:46:26'),(40,'Reduced mileage (fuel efficiency)','Common Customer Concerns',40,1,'2026-07-11 01:46:26'),(41,'Vehicle pulling to one side','Common Customer Concerns',41,1,'2026-07-11 01:46:26'),(42,'Brake noise or weak braking','Common Customer Concerns',42,1,'2026-07-11 01:46:26'),(43,'AC not cooling properly','Common Customer Concerns',43,1,'2026-07-11 01:46:26'),(44,'Hard starting or battery issues','Common Customer Concerns',44,1,'2026-07-11 01:46:26'),(45,'Excessive smoke from exhaust','Common Customer Concerns',45,1,'2026-07-11 01:46:26'),(46,'Vibrations while driving','Common Customer Concerns',46,1,'2026-07-11 01:46:26'),(47,'Warning lights on dashboard','Common Customer Concerns',47,1,'2026-07-11 01:46:26'),(48,'Fluid leaks under the vehicle','Common Customer Concerns',48,1,'2026-07-11 01:46:26');
/*!40000 ALTER TABLE `concern_presets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `custom_categories`
--

DROP TABLE IF EXISTS `custom_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `custom_categories`
--

LOCK TABLES `custom_categories` WRITE;
/*!40000 ALTER TABLE `custom_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `custom_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_concerns`
--

DROP TABLE IF EXISTS `customer_concerns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_concerns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int unsigned NOT NULL,
  `concern_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_completed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_job_card_id` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_concerns`
--

LOCK TABLES `customer_concerns` WRITE;
/*!40000 ALTER TABLE `customer_concerns` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_concerns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_payments`
--

DROP TABLE IF EXISTS `customer_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'cash',
  `transaction_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_date` date NOT NULL,
  `remarks` text COLLATE utf8mb4_general_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estimate_id` int DEFAULT NULL,
  `staff_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cp_job` (`job_card_id`),
  KEY `idx_cp_date` (`payment_date`),
  KEY `fk_cp_estimate` (`estimate_id`),
  CONSTRAINT `fk_cp_estimate` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_payments`
--

LOCK TABLES `customer_payments` WRITE;
/*!40000 ALTER TABLE `customer_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_type` enum('individual','corporate','fleet') COLLATE utf8mb4_general_ci DEFAULT 'individual',
  `customer_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `company_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gstin` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ref_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile_no` varchar(15) COLLATE utf8mb4_general_ci NOT NULL,
  `alt_mobile` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contact_person` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `driver_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line` text COLLATE utf8mb4_general_ci,
  `colony_street` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state_code` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pincode` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `is_sez` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_mobile` (`mobile_no`),
  KEY `idx_customers_name` (`customer_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimate_audit_log`
--

DROP TABLE IF EXISTS `estimate_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimate_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `action` enum('created','edited','converted','archived','restored','bulk_archived') COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_general_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estimate_audit_estimate` (`estimate_id`),
  KEY `idx_estimate_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimate_audit_log`
--

LOCK TABLES `estimate_audit_log` WRITE;
/*!40000 ALTER TABLE `estimate_audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `estimate_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimate_history_vault`
--

DROP TABLE IF EXISTS `estimate_history_vault`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimate_history_vault` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `estimate_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `estimate_type` enum('gst_estimate','non_gst_estimate') COLLATE utf8mb4_general_ci NOT NULL,
  `customer_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reg_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `car_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vehicle_make` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vehicle_model` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `gst_percentage` decimal(5,2) DEFAULT '0.00',
  `gst_amount` decimal(10,2) DEFAULT '0.00',
  `total_amount` decimal(10,2) DEFAULT '0.00',
  `payment_mode` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `services_json` json DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `vault_action` enum('archived','created','converted') COLLATE utf8mb4_general_ci DEFAULT 'archived',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimate_history_vault`
--

LOCK TABLES `estimate_history_vault` WRITE;
/*!40000 ALTER TABLE `estimate_history_vault` DISABLE KEYS */;
/*!40000 ALTER TABLE `estimate_history_vault` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimate_job_mapping`
--

DROP TABLE IF EXISTS `estimate_job_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimate_job_mapping` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimate_job_mapping`
--

LOCK TABLES `estimate_job_mapping` WRITE;
/*!40000 ALTER TABLE `estimate_job_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `estimate_job_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimate_services`
--

DROP TABLE IF EXISTS `estimate_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimate_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `service_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `item_type` enum('labour','part','consumable','external') COLLATE utf8mb4_general_ci DEFAULT 'labour',
  `part_code` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `qty` decimal(10,2) DEFAULT '1.00',
  `rate` decimal(10,2) DEFAULT '0.00',
  `amount` decimal(10,2) DEFAULT '0.00',
  `hsn_sac` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `estimate_id` (`estimate_id`),
  CONSTRAINT `estimate_services_ibfk_1` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimate_services`
--

LOCK TABLES `estimate_services` WRITE;
/*!40000 ALTER TABLE `estimate_services` DISABLE KEYS */;
/*!40000 ALTER TABLE `estimate_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimates`
--

DROP TABLE IF EXISTS `estimates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int DEFAULT NULL,
  `estimate_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `estimate_type` enum('gst_estimate','non_gst_estimate') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'non_gst_estimate',
  `gst_percentage` decimal(5,2) DEFAULT '0.00',
  `gst_amount` decimal(10,2) DEFAULT '0.00',
  `total_amount` decimal(10,2) DEFAULT '0.00',
  `is_archived` tinyint(1) DEFAULT '0',
  `archived_at` datetime DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  `customer_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reg_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `car_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vehicle_make` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vehicle_model` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimates`
--

LOCK TABLES `estimates` WRITE;
/*!40000 ALTER TABLE `estimates` DISABLE KEYS */;
/*!40000 ALTER TABLE `estimates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `global_suggestions`
--

DROP TABLE IF EXISTS `global_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `global_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `suggestion_text` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `usage_count` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_type_text` (`suggestion_type`,`suggestion_text`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `global_suggestions`
--

LOCK TABLES `global_suggestions` WRITE;
/*!40000 ALTER TABLE `global_suggestions` DISABLE KEYS */;
INSERT INTO `global_suggestions` VALUES (1,'service_name','brake pads',1),(2,'gstin','gst123',1),(3,'odometer','12000',1),(4,'mobile_no','8238538098',1);
/*!40000 ALTER TABLE `global_suggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_download_log`
--

DROP TABLE IF EXISTS `invoice_download_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_download_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `downloaded_by` int DEFAULT NULL,
  `downloaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_idl_invoice` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_download_log`
--

LOCK TABLES `invoice_download_log` WRITE;
/*!40000 ALTER TABLE `invoice_download_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_download_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `invoice_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `gst_percent` decimal(5,2) NOT NULL DEFAULT '18.00',
  `gst_amount` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'cash',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `gst_type` enum('with_gst','without_gst') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'with_gst',
  `payment_status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'outstanding',
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_card_id` (`job_card_id`),
  UNIQUE KEY `invoice_no` (`invoice_no`),
  KEY `idx_invoices_date` (`created_at`),
  KEY `idx_inv_job` (`job_card_id`),
  KEY `idx_inv_date` (`created_at`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices_non_gst`
--

DROP TABLE IF EXISTS `invoices_non_gst`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices_non_gst` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `invoice_no` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_mode` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'cash',
  `customer_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile_no` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reg_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `car_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `payment_status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'outstanding',
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_card_id` (`job_card_id`),
  UNIQUE KEY `invoice_no` (`invoice_no`),
  KEY `idx_nongst_job` (`job_card_id`),
  KEY `idx_nongst_date` (`created_at`),
  KEY `idx_nongst_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices_non_gst`
--

LOCK TABLES `invoices_non_gst` WRITE;
/*!40000 ALTER TABLE `invoices_non_gst` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices_non_gst` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_card_concern_checklist`
--

DROP TABLE IF EXISTS `job_card_concern_checklist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_card_concern_checklist` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `is_checked` tinyint(1) DEFAULT '0',
  `checked_by` int DEFAULT NULL,
  `checked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jcc_job` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_card_concern_checklist`
--

LOCK TABLES `job_card_concern_checklist` WRITE;
/*!40000 ALTER TABLE `job_card_concern_checklist` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_card_concern_checklist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_card_media`
--

DROP TABLE IF EXISTS `job_card_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_card_media` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int unsigned NOT NULL,
  `media_type` enum('image','video') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'image',
  `stage` enum('before','after','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'before',
  `file_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_size` int unsigned DEFAULT NULL COMMENT 'bytes',
  `caption` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_card_id` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_card_media`
--

LOCK TABLES `job_card_media` WRITE;
/*!40000 ALTER TABLE `job_card_media` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_card_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_card_services`
--

DROP TABLE IF EXISTS `job_card_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_card_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_id` int unsigned DEFAULT NULL,
  `service_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `item_type` enum('part','labour') COLLATE utf8mb4_general_ci DEFAULT 'labour',
  `part_code` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `part_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `labour_code` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `price_type` enum('price','mrp','fixed','variable') COLLATE utf8mb4_general_ci DEFAULT 'price',
  `qty` decimal(10,2) DEFAULT '1.00',
  `rate` decimal(10,2) DEFAULT NULL,
  `discount_pct` decimal(5,2) DEFAULT '0.00',
  `hsn_sac` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tax_pct` decimal(5,2) DEFAULT '18.00',
  `tax_amount` decimal(10,2) DEFAULT '0.00',
  `is_selected` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `unit` varchar(20) COLLATE utf8mb4_general_ci DEFAULT 'pc',
  `job_category` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `package_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `old_part` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_jcs_job_card` (`job_card_id`),
  KEY `idx_jcs_job` (`job_card_id`),
  KEY `fk_jcs_concern` (`concern_id`),
  CONSTRAINT `fk_jcs_concern` FOREIGN KEY (`concern_id`) REFERENCES `customer_concerns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `job_card_services_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_card_services`
--

LOCK TABLES `job_card_services` WRITE;
/*!40000 ALTER TABLE `job_card_services` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_card_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_cards`
--

DROP TABLE IF EXISTS `job_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `rfe_no` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reg_no` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `car_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `owner_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `mobile_no` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `vehicle_id` int DEFAULT NULL,
  `odometer` int DEFAULT NULL,
  `avg_km_day` int DEFAULT '25',
  `service_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `service_advisor` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `estimated_delivery` date DEFAULT NULL,
  `is_inhouse` tinyint(1) DEFAULT '0',
  `assigned_staff_id` int DEFAULT NULL,
  `status` enum('rfe','estimation','spares_pending','wip','ready','delivered','invoiced','cancelled','active','done') COLLATE utf8mb4_general_ci DEFAULT 'estimation',
  `completion_type` enum('invoice','estimate') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `final_amount` decimal(10,2) DEFAULT NULL,
  `payment_mode` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `job_category` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `job_category_desc` text COLLATE utf8mb4_general_ci,
  `job_category_amount` decimal(10,2) DEFAULT '0.00',
  `job_category_gst_pct` decimal(5,2) DEFAULT '18.00',
  `job_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `closed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `public_token` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_quick_job` tinyint(1) NOT NULL DEFAULT '0',
  `insurance_claim_no` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `insurance_company` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vehicle_make` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vehicle_model` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fuel_level` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fuel_level_percent` int DEFAULT NULL,
  `fuel_photo` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `claim_no` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `policy_no` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `corporate_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `accident_date` date DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_general_ci DEFAULT NULL,
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
  `pointers` text COLLATE utf8mb4_general_ci,
  `charging_pct` int DEFAULT NULL,
  `gst_invoice_status` enum('pending','approved','paid') COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `non_gst_invoice_status` enum('pending','approved','paid') COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `invoice_status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'unpaid',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_cards`
--

LOCK TABLES `job_cards` WRITE;
/*!40000 ALTER TABLE `job_cards` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_cards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `non_gst_kill_switch_log`
--

DROP TABLE IF EXISTS `non_gst_kill_switch_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `non_gst_kill_switch_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `deleted_by` int DEFAULT NULL,
  `deleted_by_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `records_deleted` int NOT NULL DEFAULT '0',
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `non_gst_kill_switch_log`
--

LOCK TABLES `non_gst_kill_switch_log` WRITE;
/*!40000 ALTER TABLE `non_gst_kill_switch_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `non_gst_kill_switch_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parts`
--

DROP TABLE IF EXISTS `parts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `part_code` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `part_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci DEFAULT 'General',
  `unit` varchar(20) COLLATE utf8mb4_general_ci DEFAULT 'pc',
  `buying_price` decimal(10,2) DEFAULT '0.00',
  `selling_price` decimal(10,2) NOT NULL,
  `stock_qty` decimal(10,2) DEFAULT '0.00',
  `low_stock_alert` decimal(10,2) DEFAULT '5.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hsn_sac` varchar(20) COLLATE utf8mb4_general_ci DEFAULT '8708',
  PRIMARY KEY (`id`),
  UNIQUE KEY `part_code` (`part_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parts`
--

LOCK TABLES `parts` WRITE;
/*!40000 ALTER TABLE `parts` DISABLE KEYS */;
/*!40000 ALTER TABLE `parts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parts_sales`
--

DROP TABLE IF EXISTS `parts_sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parts_sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `part_id` int NOT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_mode` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `job_card_id` int DEFAULT NULL,
  `sale_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `part_id` (`part_id`),
  CONSTRAINT `parts_sales_ibfk_1` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parts_sales`
--

LOCK TABLES `parts_sales` WRITE;
/*!40000 ALTER TABLE `parts_sales` DISABLE KEYS */;
/*!40000 ALTER TABLE `parts_sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `post_service_inspection`
--

DROP TABLE IF EXISTS `post_service_inspection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_service_inspection` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `concern_resolved` tinyint(1) DEFAULT '0',
  `vehicle_cleaned` tinyint(1) DEFAULT '0',
  `photos_uploaded` tinyint(1) DEFAULT '0',
  `quality_check` tinyint(1) DEFAULT '0',
  `inspected_by` int DEFAULT NULL,
  `inspected_at` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_card_id` (`job_card_id`),
  KEY `idx_psi_job` (`job_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `post_service_inspection`
--

LOCK TABLES `post_service_inspection` WRITE;
/*!40000 ALTER TABLE `post_service_inspection` DISABLE KEYS */;
/*!40000 ALTER TABLE `post_service_inspection` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_sales`
--

DROP TABLE IF EXISTS `product_sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `customer_name` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_mode` enum('cash','upi','card','bank') COLLATE utf8mb4_general_ci NOT NULL,
  `sale_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_sales_date` (`sale_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_sales`
--

LOCK TABLES `product_sales` WRITE;
/*!40000 ALTER TABLE `product_sales` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quick_services`
--

DROP TABLE IF EXISTS `quick_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quick_services` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `service_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `default_rate` decimal(10,2) NOT NULL DEFAULT '0.00',
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_service_name` (`service_name`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quick_services`
--

LOCK TABLES `quick_services` WRITE;
/*!40000 ALTER TABLE `quick_services` DISABLE KEYS */;
INSERT INTO `quick_services` VALUES (1,'Exterior Wash',300.00,1,1,'2026-07-09 10:27:30'),(2,'Interior Vacuum',400.00,2,1,'2026-07-09 10:27:30'),(3,'Full Car Wash',600.00,3,1,'2026-07-09 10:27:30'),(4,'Engine Bay Cleaning',800.00,4,1,'2026-07-09 10:27:30'),(5,'Tyre Dressing',250.00,5,1,'2026-07-09 10:27:30'),(6,'Dashboard Polish',350.00,6,1,'2026-07-09 10:27:30'),(7,'Foam Wash',500.00,7,1,'2026-07-09 10:27:30'),(8,'Ceramic Coating',5000.00,8,1,'2026-07-09 10:27:30');
/*!40000 ALTER TABLE `quick_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recommended_services`
--

DROP TABLE IF EXISTS `recommended_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recommended_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `item_type` enum('part','labour') COLLATE utf8mb4_general_ci DEFAULT 'labour',
  `period` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recommended_services`
--

LOCK TABLES `recommended_services` WRITE;
/*!40000 ALTER TABLE `recommended_services` DISABLE KEYS */;
/*!40000 ALTER TABLE `recommended_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin',1,1,1,1,1,1,1,1,1),(2,'service_advisor',1,0,0,1,1,1,1,0,0),(3,'technician',0,0,0,0,0,0,0,0,0);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_bookings`
--

DROP TABLE IF EXISTS `service_bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_bookings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `booking_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `mobile_no` varchar(15) COLLATE utf8mb4_general_ci NOT NULL,
  `car_number` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `car_name` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time DEFAULT NULL,
  `concerns` text COLLATE utf8mb4_general_ci,
  `advance_amount` decimal(10,2) DEFAULT '0.00',
  `advance_mode` enum('cash','upi','card','bank_transfer') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `booking_status` enum('scheduled','confirmed','completed','cancelled') COLLATE utf8mb4_general_ci DEFAULT 'scheduled',
  `notes` text COLLATE utf8mb4_general_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_no` (`booking_no`),
  KEY `idx_sb_date` (`booking_date`),
  KEY `idx_sb_status` (`booking_status`),
  KEY `idx_sb_mobile` (`mobile_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_bookings`
--

LOCK TABLES `service_bookings` WRITE;
/*!40000 ALTER TABLE `service_bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_catalog`
--

DROP TABLE IF EXISTS `service_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_catalog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('mechanical','electrical','body','detailing','ac','tyre','oil','general','parts') COLLATE utf8mb4_general_ci DEFAULT 'general',
  `item_type` enum('part','labour') COLLATE utf8mb4_general_ci DEFAULT 'labour',
  `default_rate` decimal(10,2) DEFAULT '0.00',
  `hsn_sac` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tax_pct` decimal(5,2) DEFAULT '18.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_category` (`category`),
  KEY `idx_catalog_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=412 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_catalog`
--

LOCK TABLES `service_catalog` WRITE;
/*!40000 ALTER TABLE `service_catalog` DISABLE KEYS */;
INSERT INTO `service_catalog` VALUES (1,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(2,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(3,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(4,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(5,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(6,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(7,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(8,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(9,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(10,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(11,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(12,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(13,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(14,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(15,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(16,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(17,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(18,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(19,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(20,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(21,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(22,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(23,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(24,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(25,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(26,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(27,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(28,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(29,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(30,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(31,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(32,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(33,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(34,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(35,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(36,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(37,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(38,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(39,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(40,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(41,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-06-02 16:13:21','2026-06-02 16:13:21'),(42,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(43,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(44,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(45,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(46,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(47,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(48,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(49,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(50,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(51,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(52,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(53,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(54,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(55,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(56,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(57,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(58,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(59,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(60,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(61,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(62,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(63,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(64,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(65,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(66,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(67,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(68,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(69,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(70,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(71,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(72,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(73,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(74,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(75,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(76,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(77,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(78,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(79,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(80,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(81,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(82,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-06-09 18:21:14','2026-06-09 18:21:14'),(83,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(84,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(85,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(86,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(87,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(88,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(89,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(90,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(91,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(92,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(93,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(94,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(95,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(96,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(97,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(98,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(99,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(100,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(101,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(102,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(103,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(104,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(105,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(106,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(107,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(108,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(109,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(110,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(111,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(112,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(113,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(114,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(115,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(116,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(117,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(118,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(119,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(120,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(121,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(122,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(123,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-06-09 18:21:24','2026-06-09 18:21:24'),(124,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(125,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(126,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(127,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(128,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(129,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(130,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(131,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(132,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(133,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(134,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(135,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(136,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(137,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(138,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(139,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(140,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(141,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(142,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(143,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(144,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(145,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(146,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(147,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(148,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(149,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(150,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(151,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(152,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(153,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(154,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(155,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(156,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(157,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(158,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(159,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(160,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(161,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(162,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(163,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(164,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-06-09 18:46:21','2026-06-09 18:46:21'),(165,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(166,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(167,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(168,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(169,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(170,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(171,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(172,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(173,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(174,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(175,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(176,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(177,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(178,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(179,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(180,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(181,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(182,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(183,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(184,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(185,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(186,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(187,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(188,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(189,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(190,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(191,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(192,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(193,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(194,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(195,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(196,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(197,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(198,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(199,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(200,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(201,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(202,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(203,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(204,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(205,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-07-09 15:57:30','2026-07-09 15:57:30'),(206,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(207,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(208,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(209,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(210,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(211,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(212,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(213,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(214,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(215,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(216,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(217,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(218,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(219,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(220,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(221,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(222,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(223,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(224,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(225,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(226,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(227,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(228,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(229,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(230,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(231,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(232,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(233,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(234,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(235,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(236,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(237,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(238,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(239,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(240,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(241,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(242,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(243,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(244,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(245,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(246,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-07-09 15:58:30','2026-07-09 15:58:30'),(247,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(248,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(249,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(250,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(251,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(252,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(253,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(254,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(255,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(256,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(257,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(258,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(259,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(260,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(261,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(262,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(263,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(264,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(265,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(266,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(267,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(268,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(269,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(270,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(271,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(272,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(273,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(274,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(275,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(276,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(277,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(278,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(279,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(280,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(281,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(282,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(283,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(284,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(285,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(286,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(287,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-07-10 14:50:39','2026-07-10 14:50:39'),(288,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(289,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(290,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(291,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(292,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(293,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(294,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(295,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(296,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(297,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(298,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(299,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(300,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(301,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(302,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(303,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(304,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(305,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(306,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(307,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(308,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(309,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(310,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(311,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(312,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(313,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(314,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(315,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(316,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(317,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(318,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(319,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(320,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(321,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(322,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(323,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(324,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(325,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(326,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(327,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(328,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-07-11 07:15:31','2026-07-11 07:15:31'),(329,'Engine Oil Change','oil','labour',500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(330,'Oil Filter Replacement','oil','part',350.00,'842123',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(331,'Air Filter Cleaning','mechanical','labour',200.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(332,'Air Filter Replacement','mechanical','part',450.00,'842131',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(333,'Brake Pad Replacement (Front)','mechanical','part',1800.00,'681381',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(334,'Brake Pad Replacement (Rear)','mechanical','part',1500.00,'681381',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(335,'Disc Skimming','mechanical','labour',800.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(336,'Clutch Plate Replacement','mechanical','part',4500.00,'870893',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(337,'Timing Belt Replacement','mechanical','part',3500.00,'401039',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(338,'Coolant Flush','mechanical','labour',600.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(339,'Radiator Repair','mechanical','labour',1200.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(340,'Suspension Check & Repair','mechanical','labour',2000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(341,'Battery Replacement','electrical','part',4500.00,'850710',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(342,'Alternator Repair','electrical','labour',2500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(343,'Starter Motor Repair','electrical','labour',2000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(344,'Head Light Replacement','electrical','part',1500.00,'851210',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(345,'Wiring Harness Repair','electrical','labour',1800.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(346,'Denting','body','labour',3000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(347,'Painting (Per Panel)','body','labour',4000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(348,'Full Body Polish','body','labour',5000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(349,'Bumper Repair','body','labour',2500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(350,'Windshield Replacement','body','part',8000.00,'700711',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(351,'Interior Deep Clean','detailing','labour',2500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(352,'Exterior Wash & Wax','detailing','labour',800.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(353,'Ceramic Coating','detailing','labour',15000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(354,'PPF Installation (Per Panel)','detailing','labour',5000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(355,'Seat Cover Installation','detailing','labour',1500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(356,'AC Gas Top-Up','ac','labour',1500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(357,'AC Compressor Repair','ac','labour',5000.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(358,'AC Condenser Cleaning','ac','labour',800.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(359,'Cabin Filter Replacement','ac','part',600.00,'842139',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(360,'Wheel Alignment','tyre','labour',600.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(361,'Wheel Balancing','tyre','labour',400.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(362,'Tyre Rotation','tyre','labour',300.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(363,'Puncture Repair','tyre','labour',150.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(364,'Tyre Replacement','tyre','part',4000.00,'401110',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(365,'Scanning / Diagnostics','general','labour',500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(366,'Road Test','general','labour',0.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(367,'Pickup & Drop','general','labour',300.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(368,'Towing Charges','general','labour',1500.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25'),(369,'General Inspection','general','labour',0.00,'998714',18.00,1,'2026-07-11 07:16:25','2026-07-11 07:16:25');
/*!40000 ALTER TABLE `service_catalog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_package_items`
--

DROP TABLE IF EXISTS `service_package_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_package_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `package_id` int unsigned NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `item_type` enum('part','labour') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'labour',
  PRIMARY KEY (`id`),
  KEY `package_id` (`package_id`),
  CONSTRAINT `service_package_items_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `service_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_package_items`
--

LOCK TABLES `service_package_items` WRITE;
/*!40000 ALTER TABLE `service_package_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_package_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_packages`
--

DROP TABLE IF EXISTS `service_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_packages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'General',
  `description` text COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_packages`
--

LOCK TABLES `service_packages` WRITE;
/*!40000 ALTER TABLE `service_packages` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_packages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_reminders`
--

DROP TABLE IF EXISTS `service_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_reminders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `vehicle_reg_no` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `job_no` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `customer_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `customer_mobile` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reminder_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reminder_date` date NOT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `km_at_next` int DEFAULT NULL,
  `notify_via` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'whatsapp',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_reminders`
--

LOCK TABLES `service_reminders` WRITE;
/*!40000 ALTER TABLE `service_reminders` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_suggestions`
--

DROP TABLE IF EXISTS `service_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_text` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `suggestion_type` enum('service_name','part_name','category') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'service_name',
  `hsn_sac` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tax_pct` decimal(5,2) DEFAULT '18.00',
  `usage_count` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suggestion` (`suggestion_text`,`suggestion_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_suggestions`
--

LOCK TABLES `service_suggestions` WRITE;
/*!40000 ALTER TABLE `service_suggestions` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_suggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_general_ci,
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  UNIQUE KEY `uk_setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=245 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (238,'sms_enabled','false',NULL,'2026-08-28 15:38:36'),(239,'whatsapp_enabled','false',NULL,'2026-08-28 15:38:36'),(240,'sms_job_opened_enabled','true',NULL,'2026-08-28 15:38:36'),(241,'sms_status_update_enabled','true',NULL,'2026-08-28 15:38:36'),(242,'sms_invoice_manual_enabled','true',NULL,'2026-08-28 15:38:36'),(243,'msg91_auth_key','',NULL,'2026-08-28 15:38:36'),(244,'msg91_sender_id','HAPPY',NULL,'2026-08-28 15:38:36');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `role` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile_no` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_ledger`
--

DROP TABLE IF EXISTS `staff_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int DEFAULT NULL,
  `staff_name` varchar(150) NOT NULL,
  `entry_date` date NOT NULL,
  `veh_no` varchar(50) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `credit_amount` decimal(10,2) DEFAULT '0.00',
  `debit_amount` decimal(10,2) DEFAULT '0.00',
  `is_cash_ledger_synced` tinyint(1) DEFAULT '0',
  `cash_ledger_id` int DEFAULT NULL,
  `job_card_id` int DEFAULT NULL,
  `estimate_id` int DEFAULT NULL,
  `payment_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_staff_id` (`staff_id`),
  KEY `idx_staff_name` (`staff_name`),
  KEY `idx_entry_date` (`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_ledger`
--

LOCK TABLES `staff_ledger` WRITE;
/*!40000 ALTER TABLE `staff_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_payments`
--

DROP TABLE IF EXISTS `staff_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `payment_month` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `days_present` int DEFAULT '0',
  `calculated_salary` decimal(10,2) DEFAULT '0.00',
  `paid_amount` decimal(10,2) NOT NULL,
  `payment_type` enum('salary','advance','bonus','deduction') COLLATE utf8mb4_general_ci NOT NULL,
  `payment_mode` enum('cash','bank','upi') COLLATE utf8mb4_general_ci NOT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `advance_deducted` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_payments_staff` (`staff_id`),
  KEY `idx_payments_date` (`payment_date`),
  CONSTRAINT `staff_payments_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_payments`
--

LOCK TABLES `staff_payments` WRITE;
/*!40000 ALTER TABLE `staff_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `status_notifications`
--

DROP TABLE IF EXISTS `status_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `status_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_card_id` int NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `message` text COLLATE utf8mb4_general_ci NOT NULL,
  `recipient_no` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider_ref` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dispatch_type` varchar(30) COLLATE utf8mb4_general_ci DEFAULT 'whatsapp',
  `dispatch_status` varchar(30) COLLATE utf8mb4_general_ci DEFAULT 'sent',
  `error_message` text COLLATE utf8mb4_general_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_notif_job` (`job_card_id`),
  KEY `idx_status_notif_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `status_notifications`
--

LOCK TABLES `status_notifications` WRITE;
/*!40000 ALTER TABLE `status_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `status_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_master`
--

DROP TABLE IF EXISTS `vehicle_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_master` (
  `id` int NOT NULL AUTO_INCREMENT,
  `make` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `fuel_types` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `variants` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vm_make` (`make`),
  KEY `idx_vm_model` (`model`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_master`
--

LOCK TABLES `vehicle_master` WRITE;
/*!40000 ALTER TABLE `vehicle_master` DISABLE KEYS */;
INSERT INTO `vehicle_master` VALUES (1,'Aston Martin','Db 11','[\"Petrol\"]',1,'[\"V12\"]'),(2,'Aston Martin','Rapide','[\"Petrol\"]',1,'[\"Luxe\"]'),(3,'Aston Martin','Vantage','[\"Petrol\"]',1,'[\"Coupe\"]'),(4,'Audi','A3','[\"Diesel\", \"Petrol\"]',1,'[\"35 Tdi Premium Plus\", \"35 Tdi Technology\", \"35 Tfsi Premium Plus\", \"35 Tfsi Technology\"]'),(5,'Audi','A3 Cabriolet','[\"Petrol\"]',1,'[\"40 Tfsi\"]'),(6,'Audi','A4','[\"Petrol\"]',1,'[\"Premium Plus 35 Tfsi\", \"Technology 35 Tfsi\", \"Premium\", \"Premium Plus\", \"Technology\"]'),(7,'Audi','A5','[\"Diesel\"]',1,'[\"Sportback\"]'),(8,'Audi','A5 Cabriolet','[\"Diesel\"]',1,'[\"2.0 Tdi\"]'),(9,'Audi','A6','[\"Petrol\"]',1,'[\"Premium Plus 45 Tfsi\", \"Technology 45 Tfsi\", \"Premium Plus\", \"Technology\"]'),(10,'Audi','A8 L','[\"Petrol\"]',1,'[\"55 Tfsi Quattro\"]'),(11,'Audi','A8L','[\"Petrol\"]',1,'[\"Celebration\", \"Technology\"]'),(12,'Audi','Q3','[\"Diesel\", \"Petrol\"]',1,'[\"30 Tdi Premium Fwd\", \"35 Tdi Quattro Premium Plus\", \"35 Tdi Quattro Technology\", \"30 Tfsi Premium\", \"Premium\", \"Premium Plus\", \"Technology\"]'),(13,'Audi','Q5','[\"Diesel\", \"Petrol\"]',1,'[\"35 Tdi Premium Plus\", \"35 Tdi Technology\", \"45 Tfsi Premium Plus\", \"45 Tfsi Technology\", \"Premium Plus\", \"Technology\"]'),(14,'Audi','Q7','[\"Diesel\", \"Petrol\"]',1,'[\"45 Tdi Premium Plus\", \"45 Tdi Technology Pack\", \"40 Tfsi Quattro Premium Plus\", \"40 Tfsi Quattro Technology Pack\", \"45 Tdi Black Styling\", \"40 Tfsi Quattro Black Styling\", \"Premium Plus\", \"Technology\"]'),(15,'Audi','Q8','[\"Petrol\"]',1,'[\"55 Tfsi Quattro Tiptronic\", \"Celebration\", \"Technology\", \"RS Q8\"]'),(16,'Audi','R8','[\"Petrol\"]',1,'[\"V10 Plus\"]'),(17,'Audi','Rs5','[\"Petrol\"]',1,'[\"Coupe\"]'),(18,'Audi','Rs7','[\"Petrol\"]',1,'[\"Sportback\"]'),(19,'Audi','S5','[\"Petrol\"]',1,'[\"Sportback\"]'),(20,'Bajaj','Qute (Re60)','[\"Petrol\", \"CNG\"]',1,'[\"Qcar\", \"Qcar Cng\"]'),(21,'Bentley','Bentayga','[\"Petrol\"]',1,'[\"W12\", \"V8\"]'),(22,'Bentley','Continental Gt','[\"Petrol\"]',1,'[\"Coupe\"]'),(23,'Bentley','Flying Spur','[\"Petrol\"]',1,'[\"V8\", \"W12\"]'),(24,'Bentley','Mulsanne','[\"Petrol\"]',1,'[\"Sedan\"]'),(25,'BMW','3 Series','[\"Petrol\", \"Diesel\"]',1,'[\"330i\", \"320d\", \"M340i\"]'),(26,'BMW','3-Series','[\"Diesel\", \"Petrol\"]',1,'[\"320D Sport\", \"320D Luxury Line\", \"330I M Sport\"]'),(27,'BMW','5 Series','[\"Petrol\", \"Diesel\"]',1,'[\"530i\", \"520d\", \"530d\"]'),(28,'BMW','5-Series','[\"Diesel\", \"Petrol\"]',1,'[\"520D Luxury Line\", \"530D M Sport\", \"530I M Sport\"]');
/*!40000 ALTER TABLE `vehicle_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `reg_no` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `make` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year` int DEFAULT NULL,
  `variant` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vin` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `engine_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fuel_type` enum('petrol','diesel','cng','electric','hybrid') COLLATE utf8mb4_general_ci DEFAULT 'petrol',
  `vehicle_color` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `insurance_company` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `policy_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `insurance_expiry` date DEFAULT NULL,
  `claim_type` enum('own_damage','third_party','comprehensive') COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vehicles_reg` (`reg_no`),
  KEY `idx_vehicles_customer` (`customer_id`),
  CONSTRAINT `vehicles_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-30 20:41:26
