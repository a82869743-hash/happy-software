const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../access.log');
function log(msg) {
  const time = new Date().toISOString();
  fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
}

module.exports = (req, res, next) => {
  // 1) Try Authorization header first
  let token = null;
  const authHeader = req.headers.authorization;
  log(`Request: ${req.method} ${req.originalUrl} | AuthHeader: ${authHeader || 'none'}`);
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2) Fallback: accept token via query string (for window.open / new-tab flows)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    log(`  => Failed: No token provided`);
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    log(`  => Success: user=${decoded.username}`);
    next();
  } catch (err) {
    log(`  => Failed: Invalid or expired token. Error: ${err.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

