// Happy Car Wash Server - Production Ready
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
];
// Also allow any localhost port in development
const isDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Method override: cPanel Apache may block PATCH/DELETE methods.
// Frontend sends POST with X-HTTP-Method-Override header instead.
app.use((req, res, next) => {
  if (req.method === 'POST' && req.headers['x-http-method-override']) {
    req.method = req.headers['x-http-method-override'].toUpperCase();
  }
  next();
});

// Helper to recursively convert empty strings ("") to null
function sanitizeEmptyStrings(obj) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (obj[key] === '') {
        obj[key] = null;
      } else if (typeof obj[key] === 'object') {
        sanitizeEmptyStrings(obj[key]);
      }
    }
  }
  return obj;
}

app.use((req, res, next) => {
  if (req.body) {
    sanitizeEmptyStrings(req.body);
  }
  next();
});

// Static file serving for uploads (media, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/job-cards', require('./routes/jobCards'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/staff-ledger', require('./routes/staffLedger'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/salary', require('./routes/salary'));
app.use('/api/product-sales', require('./routes/productSales'));
app.use('/api/cash-ledger', require('./routes/cashLedger'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/parts-sales', require('./routes/partsSales'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/service-catalog', require('./routes/serviceCatalog'));
app.use('/api/vehicle-master', require('./routes/vehicleMaster'));
app.use('/api/quick-job-cards', require('./routes/quickJobCards'));
app.use('/api/advance-bookings', require('./routes/advanceBookings'));
app.use('/api/customer-payments', require('./routes/customerPayments'));
app.use('/api/service-bookings', require('./routes/serviceBookings'));
app.use('/api/imports', require('./routes/imports'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/estimate-jobs', require('./routes/estimateJobs'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/service-reminders', require('./routes/serviceReminders'));

// ── Public routes (NO auth) ──
app.use('/api/public', require('./routes/publicTracking'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version check — no auth, used to verify deployment
app.get('/api/version', (req, res) => {
  res.json({ version: 'v2.1-safe-fix', deployed: new Date().toISOString(), fixes: ['try-catch-status', 'try-catch-delete', 'safe-inspection', 'safe-closed_at'] });
});

// Debug: test database connection and table existence
app.get('/api/debug/db-check', async (req, res) => {
  const db = require('./config/db');
  const results = {};
  
  // Test 1: Basic DB connection
  try {
    const [rows] = await db.query('SELECT 1 as test');
    results.db_connection = 'OK';
  } catch (e) {
    results.db_connection = 'FAIL: ' + e.message;
  }

  // Test 2: job_cards table columns
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM job_cards");
    const colNames = cols.map(c => c.Field);
    results.job_cards_columns = colNames;
    results.has_is_deleted = colNames.includes('is_deleted');
    results.has_closed_at = colNames.includes('closed_at');
    results.has_is_quick_job = colNames.includes('is_quick_job');
    results.has_status = colNames.includes('status');
  } catch (e) {
    results.job_cards_table = 'FAIL: ' + e.message;
  }

  // Test 3: Check status enum values
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM job_cards WHERE Field = 'status'");
    results.status_type = cols[0]?.Type || 'unknown';
  } catch (e) {
    results.status_enum = 'FAIL: ' + e.message;
  }

  // Test 4: post_service_inspection table
  try {
    await db.query("SELECT 1 FROM post_service_inspection LIMIT 1");
    results.post_service_inspection = 'EXISTS';
  } catch (e) {
    results.post_service_inspection = 'MISSING: ' + e.message;
  }

  // Test 5: status_notifications table
  try {
    await db.query("SELECT 1 FROM status_notifications LIMIT 1");
    results.status_notifications = 'EXISTS';
  } catch (e) {
    results.status_notifications = 'MISSING: ' + e.message;
  }

  res.json(results);
});

// Serve frontend static files in production with no-cache on HTML
app.use(express.static(path.join(__dirname, '../../frontend/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// SPA Catch-all (Must be after all API routes)
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Nodemon trigger reload - DB connected
