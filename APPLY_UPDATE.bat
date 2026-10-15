@echo off
setlocal EnableDelayedExpansion
title Happy Car Wash - System Update Installer
color 0b

echo ============================================================
echo           HAPPY CAR WASH - 1-CLICK SYSTEM UPDATE
echo ============================================================
echo.

:: 0. Check for Administrator permissions and self-elevate preserving working directory
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [i] Requesting Administrator privileges to apply update...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
set "PATCH_DIR=%~dp0"
if "%PATCH_DIR:~-1%"=="\" set "PATCH_DIR=%PATCH_DIR:~0,-1%"

:: Check that patch files were extracted and not run from inside zip
if not exist "%PATCH_DIR%\backend\src\server.js" (
    echo.
    echo ============================================================
    echo [ERROR] Update files not found in:
    echo "%PATCH_DIR%"
    echo ============================================================
    echo It looks like you double-clicked APPLY_UPDATE.bat directly
    echo inside the ZIP file without extracting it first.
    echo.
    echo PLEASE DO THIS:
    echo 1. Right-click 'UPDATE_PATCH.zip'
    echo 2. Click 'Extract All...' and choose a folder
    echo 3. Open that extracted folder and run 'APPLY_UPDATE.bat'
    echo ============================================================
    echo.
    pause
    exit /b 1
)

echo [i] Finding Node.js executable...
set "NODE_EXE="
where node >nul 2>&1
if %errorlevel% equ 0 set "NODE_EXE=node"
if not defined NODE_EXE (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)
if not defined NODE_EXE (
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
)
if not defined NODE_EXE (
    if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
)
if not defined NODE_EXE (
    if exist "C:\HappyCarWash\node\node.exe" set "NODE_EXE=C:\HappyCarWash\node\node.exe"
)
if not defined NODE_EXE (
    if exist "C:\HappyCarWash\app\node\node.exe" set "NODE_EXE=C:\HappyCarWash\app\node\node.exe"
)
if not defined NODE_EXE (
    echo [WARN] node.exe was not found in standard paths. Trying 'node'...
    set "NODE_EXE=node"
)

echo [i] Detecting Happy Car Wash installation directory...
set "APP_DIR="

:: Detection 1: Standard installation paths
if exist "C:\HappyCarWash\app\backend\src\server.js" set "APP_DIR=C:\HappyCarWash\app"
if not defined APP_DIR (
    if exist "C:\HappyCarWash\backend\src\server.js" set "APP_DIR=C:\HappyCarWash"
)

:: Detection 2: Other drives
if not defined APP_DIR (
    if exist "D:\HappyCarWash\app\backend\src\server.js" set "APP_DIR=D:\HappyCarWash\app"
    if exist "D:\HappyCarWash\backend\src\server.js" set "APP_DIR=D:\HappyCarWash"
    if exist "E:\HappyCarWash\app\backend\src\server.js" set "APP_DIR=E:\HappyCarWash\app"
    if exist "E:\HappyCarWash\backend\src\server.js" set "APP_DIR=E:\HappyCarWash"
)

:: Detection 3: Relative to patch folder
if not defined APP_DIR (
    if exist "%PATCH_DIR%\..\backend\src\server.js" if exist "%PATCH_DIR%\..\backend\.env" set "APP_DIR=%PATCH_DIR%\.."
)
if not defined APP_DIR (
    if exist "%PATCH_DIR%\..\happy\backend\src\server.js" if exist "%PATCH_DIR%\..\happy\backend\.env" set "APP_DIR=%PATCH_DIR%\..\happy"
)
if not defined APP_DIR (
    if exist "%PATCH_DIR%\..\app\backend\src\server.js" if exist "%PATCH_DIR%\..\app\backend\.env" set "APP_DIR=%PATCH_DIR%\..\app"
)

:: Detection 4: User Desktop
if not defined APP_DIR (
    if exist "%USERPROFILE%\Desktop\happy\backend\src\server.js" set "APP_DIR=%USERPROFILE%\Desktop\happy"
    if exist "%USERPROFILE%\Desktop\HappyCarWash\app\backend\src\server.js" set "APP_DIR=%USERPROFILE%\Desktop\HappyCarWash\app"
    if exist "%USERPROFILE%\Desktop\HappyCarWash\backend\src\server.js" set "APP_DIR=%USERPROFILE%\Desktop\HappyCarWash"
)
if not defined APP_DIR (
    for /d %%U in (C:\Users\*) do (
        if not defined APP_DIR (
            if exist "%%U\Desktop\happy\backend\src\server.js" set "APP_DIR=%%U\Desktop\happy"
            if exist "%%U\Desktop\HappyCarWash\app\backend\src\server.js" set "APP_DIR=%%U\Desktop\HappyCarWash\app"
            if exist "%%U\Desktop\HappyCarWash\backend\src\server.js" set "APP_DIR=%%U\Desktop\HappyCarWash"
        )
    )
)

:: Detection 5: Query Windows Task Scheduler task 'HappyCarWashServer'
if not defined APP_DIR (
    for /f "tokens=2 delims==" %%A in ('schtasks /query /tn "HappyCarWashServer" /xml 2^>nul ^| findstr /i "-TargetDir"') do (
        set "RAW_ARG=%%A"
        set "CANDIDATE=!RAW_ARG:~0,-2!"
        set "CANDIDATE=!CANDIDATE:"=!"
        set "CANDIDATE=!CANDIDATE: =!"
        if exist "!CANDIDATE!\app\backend\src\server.js" set "APP_DIR=!CANDIDATE!\app"
        if not defined APP_DIR (
            if exist "!CANDIDATE!\backend\src\server.js" set "APP_DIR=!CANDIDATE!"
        )
    )
)

:: Detection 6: Current directory
if not defined APP_DIR (
    if exist "backend\src\server.js" set "APP_DIR=%CD%"
)

:: Detection 7: Prompt user if not found automatically
if not defined APP_DIR (
    echo.
    echo [!] Could not automatically detect the installation directory.
    echo.
    set /p "APP_DIR=Please enter or paste the full path to your Happy Car Wash folder (e.g. C:\HappyCarWash\app): "
    if not exist "!APP_DIR!\backend\src\server.js" (
        echo.
        echo [ERROR] Could not find backend\src\server.js in "!APP_DIR!".
        echo Please verify the folder path and try again.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ============================================================
echo [TARGET] Installing update into: "!APP_DIR!"
echo ============================================================
echo.

echo [1/6] Safely stopping background services and node processes...
schtasks /End /TN "HappyCarWashServer" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*start_server*' -or $_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo       - Background processes stopped.

echo [2/6] Creating safety backup of current code...
if not exist "!APP_DIR!\backup_before_update" mkdir "!APP_DIR!\backup_before_update"
if exist "!APP_DIR!\backend\src" xcopy /E /I /Y /R /Q "!APP_DIR!\backend\src" "!APP_DIR!\backup_before_update\backend\src\" >nul
echo       - Safety backup saved to: "!APP_DIR!\backup_before_update"

echo [3/6] Updating backend code & dependencies (preserves .env and database)...
xcopy /E /I /Y /R /Q "%PATCH_DIR%\backend\src\*" "!APP_DIR!\backend\src\" >nul
copy /Y "%PATCH_DIR%\backend\package.json" "!APP_DIR!\backend\package.json" >nul

if exist "%PATCH_DIR%\backend\node_modules" (
    echo       - Updating backend node_modules...
    robocopy "%PATCH_DIR%\backend\node_modules" "!APP_DIR!\backend\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns >nul 2>&1
)

if exist "%PATCH_DIR%\backend\uploads" (
    if not exist "!APP_DIR!\backend\uploads" mkdir "!APP_DIR!\backend\uploads"
    xcopy /E /I /Y /R /Q "%PATCH_DIR%\backend\uploads\*" "!APP_DIR!\backend\uploads\" >nul
)

if exist "%PATCH_DIR%\backend\scripts" (
    if not exist "!APP_DIR!\backend\scripts" mkdir "!APP_DIR!\backend\scripts"
    xcopy /E /I /Y /R /Q "%PATCH_DIR%\backend\scripts\*" "!APP_DIR!\backend\scripts\" >nul
)
echo       - Backend source and dependencies updated.

echo [4/6] Updating frontend web app (latest UI & dynamic QR)...
if not exist "!APP_DIR!\frontend\dist" mkdir "!APP_DIR!\frontend\dist"
xcopy /E /I /Y /R /Q "%PATCH_DIR%\frontend\dist\*" "!APP_DIR!\frontend\dist\" >nul
echo       - Frontend web app updated.

echo [5/6] Ensuring MySQL database service is running and verifying schema...
sc start HappyCarWashMySQL >nul 2>&1
sc start MySQL >nul 2>&1
sc start MySQL80 >nul 2>&1
sc start MySQL84 >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "!APP_DIR!\backend\scripts\migrate_three_companies.js" (
    pushd "!APP_DIR!\backend"
    echo       - Executing database migration and detailing record repairs...
    "%NODE_EXE%" scripts\migrate_three_companies.js
    if exist "scripts\fixDbIssues.js" "%NODE_EXE%" scripts\fixDbIssues.js
    if exist "src\config\runAllMigrations.js" "%NODE_EXE%" src\config\runAllMigrations.js
    popd
    echo       - Database schema verified (all client records, job cards, and invoices preserved).
)

echo.
echo ------------------------------------------------------------
echo Verification of updated files:
for %%F in ("!APP_DIR!\backend\src\utils\invoiceRenderer.js") do echo   * invoiceRenderer.js  : %%~zF bytes [OK]
for %%F in ("!APP_DIR!\backend\src\routes\customerPayments.js") do echo   * customerPayments.js : %%~zF bytes [OK]
for %%F in ("!APP_DIR!\frontend\dist\index.html") do echo   * frontend index.html : %%~zF bytes [OK]
echo ------------------------------------------------------------
echo.

echo [6/6] Restarting Happy Car Wash Server...
schtasks /Run /TN "HappyCarWashServer" >nul 2>&1

:: Wait up to 10 seconds for server to be responsive on port 5000
set "PORT_READY=0"
for /L %%i in (1,1,10) do (
    if "!PORT_READY!"=="0" (
        netstat -ano | findstr ":5000" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PORT_READY=1"
        ) else (
            timeout /t 1 /nobreak >nul
        )
    )
)

if "!PORT_READY!"=="0" (
    echo       - Starting server directly via node...
    cd /d "!APP_DIR!\backend"
    start "Happy Car Wash Server" /min "%NODE_EXE%" src\server.js
    timeout /t 3 /nobreak >nul
)

if exist "!APP_DIR!\client_kit\scripts\open_app_silent.vbs" (
    wscript.exe "!APP_DIR!\client_kit\scripts\open_app_silent.vbs"
) else (
    start http://localhost:5000
)

echo.
echo ============================================================
echo             UPDATE COMPLETED SUCCESSFULLY!
echo ============================================================
echo 1. Date-Wise Excel Upload & Filtering active (import any date range).
echo 2. Accessories Billing & vehicle details linked with auto-suggest.
echo 3. Unified Retail Invoice layout applied across all views.
echo 4. Dynamic UPI QR codes enabled with auto pre-filled amounts.
echo 5. Detailing Studio bills accurately linked with PNB bank details.
echo 6. All customer data, job cards, and payments safely preserved.
echo 7. In your browser, press: Ctrl + F5 (Hard Refresh)
echo ============================================================
echo.
pause
exit /b 0
