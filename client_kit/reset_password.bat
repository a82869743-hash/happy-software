@echo off
setlocal
echo ===================================================
echo Resetting Happy Car Wash Admin Password
echo ===================================================
node -e "const bcrypt = require('C:/HappyCarWash/app/backend/node_modules/bcryptjs'); require('C:/HappyCarWash/app/backend/node_modules/dotenv').config({path: 'C:/HappyCarWash/app/backend/.env'}); const mysql = require('C:/HappyCarWash/app/backend/node_modules/mysql2/promise'); (async () => { const hash = await bcrypt.hash('admin123', 10); const conn = await mysql.createConnection({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME}); await conn.execute('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, 'admin']); console.log('SUCCESS! Admin password is now set to: admin123'); await conn.end(); })();"
echo.
pause
