@echo off
setlocal EnableDelayedExpansion
title Happy Car Wash GMS - Installer

echo ============================================================
echo           HAPPY CAR WASH GMS - ONE-CLICK INSTALLER
echo ============================================================
echo.

:: Check for Administrator permissions
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Run PowerShell installer script with elevated permissions
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Installation exited with an error.
    echo.
    pause
    exit /b %errorLevel%
)

exit /b 0
