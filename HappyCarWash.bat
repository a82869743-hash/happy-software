@echo off
title Happy Car Wash GMS
echo ===================================================
echo           HAPPY CAR WASH - GMS LAUNCHER
echo ===================================================
echo.
echo Starting Happy Car Wash GMS Server...
echo.

cd /d "%~dp0backend"
start "Happy Car Wash Server" /min node src\server.js

echo Server is launching on http://localhost:5000 ...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:5000

echo.
echo App is running successfully!
echo Close the background window only when you want to stop the application.
echo.
