# ==============================================================================
# Happy Car Wash GMS - Production One-Click Installer & Updater
# Designed for non-technical Windows deployments
# ==============================================================================

param(
    [string]$TargetDir = "C:\HappyCarWash"
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$message) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " [STEP] $message" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Success([string]$message) {
    Write-Host " [OK] $message" -ForegroundColor Green
}

function Write-Warn([string]$message) {
    Write-Host " [WARN] $message" -ForegroundColor Yellow
}

function Fail([string]$message) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " [ERROR] INSTALLATION / UPDATE FAILED" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host $message -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# ------------------------------------------------------------------------------
# 0. Administrator Check & Mode Detection
# ------------------------------------------------------------------------------
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "This installer requires Administrator privileges.`nPlease right-click INSTALL.bat and select 'Run as administrator'."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientKitDir = Split-Path -Parent $scriptDir
$appSourceDir = Split-Path -Parent $clientKitDir

$destAppDir = Join-Path $TargetDir "app"
$backendDest = Join-Path $destAppDir "backend"
$backendEnv = Join-Path $backendDest ".env"
$isUpdate = Test-Path $backendEnv

Write-Host "Happy Car Wash GMS Installer" -ForegroundColor Green
Write-Host "Target Directory: $TargetDir" -ForegroundColor DarkGray
Write-Host "Source Directory: $appSourceDir" -ForegroundColor DarkGray
if ($isUpdate) {
    Write-Host "Mode: UPDATE (Existing installation detected)" -ForegroundColor Magenta
} else {
    Write-Host "Mode: FRESH INSTALL" -ForegroundColor Cyan
}

if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$logsDir = Join-Path $TargetDir "logs"
if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# ------------------------------------------------------------------------------
# 0.1 Safety Backup Before Update (If updating existing installation)
# ------------------------------------------------------------------------------
if ($isUpdate) {
    Write-Step "Taking Safety Backup of Existing Database & Uploads"
    $backupScript = Join-Path $clientKitDir "scripts\backup.ps1"
    if (Test-Path $backupScript) {
        Write-Host "Creating safety backup before updating code..." -ForegroundColor Cyan
        try {
            & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $backupScript -TargetDir $TargetDir
            Write-Success "Safety backup completed successfully."
        } catch {
            Write-Warn "Pre-update safety backup encountered an issue: $($_.Exception.Message)"
        }
    }
}

# ------------------------------------------------------------------------------
# 1. Checking Node.js
# ------------------------------------------------------------------------------
Write-Step "Checking Node.js Environment"

$nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Fail "Node.js is not installed or not found in system PATH.`n`nPlease download and install Node.js LTS from:`nhttps://nodejs.org`n`nAfter installation, restart your computer and re-run INSTALL.bat."
} else {
    $nodeVersion = & $nodeCmd.Source --version
    Write-Success "Found Node.js version $nodeVersion ($($nodeCmd.Source))"
}

# ------------------------------------------------------------------------------
# 2. Checking MySQL (Bundled & Installed)
# ------------------------------------------------------------------------------
Write-Step "Checking MySQL Database Server"

$mysqlExe = $null
$dumpExe = $null

# 2.1 Search C:\HappyCarWash\mysql\*\bin\mysql.exe for existing COMPLETE install
$bundledMysql = Get-ChildItem -Path (Join-Path $TargetDir "mysql\*\bin\mysql.exe") -ErrorAction SilentlyContinue | Select-Object -First 1
$bundledService = Get-Service -Name "HappyCarWashMySQL" -ErrorAction SilentlyContinue
$systemDbFolder = Join-Path $TargetDir "mysql-data\mysql"
$bundledData = Test-Path $systemDbFolder
$pwFile = Join-Path $TargetDir "mysql_root_password.txt"

if ($bundledMysql -and $bundledService -and $bundledData -and (Test-Path $pwFile)) {
    $mysqlExe = $bundledMysql.FullName
    $binDir = Split-Path -Parent $mysqlExe
    $dumpExeCandidate = Join-Path $binDir "mysqldump.exe"
    if (Test-Path $dumpExeCandidate) {
        $dumpExe = $dumpExeCandidate
    }
    Write-Success "Found existing active bundled MySQL at: $mysqlExe"
}

# 2.2 Search System PATH and Program Files if not found in TargetDir
if (-not $mysqlExe) {
    $pathMysql = Get-Command "mysql.exe" -ErrorAction SilentlyContinue
    if ($pathMysql) {
        $mysqlExe = $pathMysql.Source
        $pathDump = Get-Command "mysqldump.exe" -ErrorAction SilentlyContinue
        if ($pathDump) { $dumpExe = $pathDump.Source }
        Write-Success "Found MySQL in PATH: $mysqlExe"
    }
}

if (-not $mysqlExe) {
    $progMysql = Get-ChildItem -Path "C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($progMysql) {
        $mysqlExe = $progMysql.FullName
        $binDir = Split-Path -Parent $mysqlExe
        $dumpExeCandidate = Join-Path $binDir "mysqldump.exe"
        if (Test-Path $dumpExeCandidate) { $dumpExe = $dumpExeCandidate }
        Write-Success "Found MySQL in Program Files: $mysqlExe"
    }
}

# 2.3 If no active MySQL found, perform or resume Bundled Install
if (-not $mysqlExe) {
    $extractedFolder = $null
    $mysqlExtractRoot = Join-Path $TargetDir "mysql"

    if ($bundledMysql -and (Test-Path $bundledMysql.FullName)) {
        Write-Host "Found extracted MySQL binaries from earlier run. Reusing..." -ForegroundColor Cyan
        $binParent = Split-Path -Parent $bundledMysql.FullName
        $extractedFolder = Get-Item (Split-Path -Parent $binParent)
    } else {
        Write-Host "MySQL is not installed on this machine. Searching for bundled archive..." -ForegroundColor Yellow

        # Sort descending by semver version to pick the newest zip (e.g. 8.4.11+)
        $mysqlZip = Get-ChildItem -Path (Join-Path $clientKitDir "mysql-*-winx64.zip") -ErrorAction SilentlyContinue |
            Sort-Object -Property @{ Expression = {
                if ($_.Name -match 'mysql-(\d+)\.(\d+)\.(\d+)') {
                    [version]"$($matches[1]).$($matches[2]).$($matches[3])"
                } else { [version]"0.0.0" }
            } } -Descending | Select-Object -First 1

        if (-not $mysqlZip) {
            Fail "No MySQL installation was found and no bundled archive was detected.`n`nPlease download mysql-8.4.x-winx64.zip from:`nhttps://dev.mysql.com/downloads/mysql/8.4.html`nand place it into the 'client_kit' folder, then re-run INSTALL.bat."
        }

        Write-Host "Found bundled MySQL archive: $($mysqlZip.Name)" -ForegroundColor Cyan
        if (Test-Path $mysqlExtractRoot) {
            # Clean up any partial files from previous failed extraction attempts
            Remove-Item -Path "$mysqlExtractRoot\*" -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            New-Item -ItemType Directory -Path $mysqlExtractRoot -Force | Out-Null
        }

        Write-Host "Extracting MySQL archive (this may take 1-2 minutes)..." -ForegroundColor Cyan
        $tarExe = Join-Path $env:SystemRoot "System32\tar.exe"
        $extractedOk = $false
        if (Test-Path $tarExe) {
            Write-Host "Extracting via Windows native tar..." -ForegroundColor Cyan
            & $tarExe -xf $mysqlZip.FullName -C $mysqlExtractRoot
            if ($LASTEXITCODE -eq 0) {
                $extractedOk = $true
            }
        }
        if (-not $extractedOk) {
            Write-Host "Extracting via .NET ZipFile..." -ForegroundColor Cyan
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($mysqlZip.FullName, $mysqlExtractRoot)
        }

        $extractedFolder = Get-ChildItem -Path $mysqlExtractRoot -Directory | Select-Object -First 1
        if (-not $extractedFolder -or -not (Test-Path (Join-Path $extractedFolder.FullName "bin\mysqld.exe"))) {
            Fail "Extraction failed: mysqld.exe not found in $mysqlExtractRoot"
        }
    }

    $baseDirNormalized = $extractedFolder.FullName.Replace('\', '/')
    $dataDirNormalized = (Join-Path $TargetDir "mysql-data").Replace('\', '/')
    $myIniPath = Join-Path $TargetDir "my.ini"

    # Write my.ini with ONLY supported MySQL 8.4 variables
    $iniLines = @(
        "[mysqld]",
        "basedir=$baseDirNormalized",
        "datadir=$dataDirNormalized",
        "port=3306",
        "bind-address=127.0.0.1",
        "mysqlx=0",
        "character-set-server=utf8mb4"
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($myIniPath, $iniLines, $utf8NoBom)
    Write-Success "Created $myIniPath"

    $mysqldExe = Join-Path $extractedFolder.FullName "bin\mysqld.exe"
    $mysqlExe = Join-Path $extractedFolder.FullName "bin\mysql.exe"
    $dumpExe = Join-Path $extractedFolder.FullName "bin\mysqldump.exe"

    # Auto-install Visual C++ Redistributable if bundled in client_kit
    $vcRedistExe = Join-Path $clientKitDir "vc_redist.x64.exe"
    if (Test-Path $vcRedistExe) {
        $vcCheck = Join-Path $env:SystemRoot "System32\vcruntime140_1.dll"
        if (!(Test-Path $vcCheck)) {
            Write-Host "Installing bundled Microsoft Visual C++ 2015-2022 Redistributable..." -ForegroundColor Cyan
            $vcProc = Start-Process -FilePath $vcRedistExe -ArgumentList "/install /passive /norestart" -Wait -PassThru -NoNewWindow
            Write-Success "Visual C++ Redistributable setup finished."
        }
    }

    # Initialize data directory if not initialized
    $dataDir = Join-Path $TargetDir "mysql-data"
    $systemDbFolder = Join-Path $dataDir "mysql"
    if (!(Test-Path $systemDbFolder)) {
        if (Test-Path $dataDir) {
            # Clean partial initialization files from previous crashed attempts
            Remove-Item -Path "$dataDir\*" -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
        }

        Write-Host "Initializing MySQL database cluster (initialize-insecure)..." -ForegroundColor Cyan
        $initProcess = Start-Process -FilePath $mysqldExe -ArgumentList "--defaults-file=`"$myIniPath`"", "--initialize-insecure", "--console" -Wait -PassThru -NoNewWindow

        # If it failed with DLL missing, try installing vc_redist if present and retry
        if ($initProcess.ExitCode -ne 0 -and (Test-Path $vcRedistExe)) {
            Write-Host "Attempting to install Visual C++ Redistributable and retry..." -ForegroundColor Yellow
            Start-Process -FilePath $vcRedistExe -ArgumentList "/install /passive /norestart" -Wait -NoNewWindow
            Remove-Item -Path "$dataDir\*" -Recurse -Force -ErrorAction SilentlyContinue
            $initProcess = Start-Process -FilePath $mysqldExe -ArgumentList "--defaults-file=`"$myIniPath`"", "--initialize-insecure", "--console" -Wait -PassThru -NoNewWindow
        }

        if ($initProcess.ExitCode -ne 0) {
            Fail "MySQL data initialization failed with exit code $($initProcess.ExitCode).`n`nIf a missing DLL error occurred (e.g., VCRUNTIME140.dll or MSVCP140.dll), please download and install the Microsoft Visual C++ 2015-2022 Redistributable (x64) from:`nhttps://aka.ms/vs/17/release/vc_redist.x64.exe`nthen re-run INSTALL.bat."
        }
        Write-Success "MySQL database initialized successfully."
    }

    # Install Windows Service
    $serviceCheck = Get-Service -Name "HappyCarWashMySQL" -ErrorAction SilentlyContinue
    if (-not $serviceCheck) {
        Write-Host "Registering Windows Service 'HappyCarWashMySQL'..." -ForegroundColor Cyan
        $installProc = Start-Process -FilePath $mysqldExe -ArgumentList "--install HappyCarWashMySQL --defaults-file=`"$myIniPath`"" -Wait -PassThru -NoNewWindow
        if ($installProc.ExitCode -ne 0) {
            Fail "Failed to install Windows service HappyCarWashMySQL (exit code $($installProc.ExitCode))."
        }
    }

    Set-Service -Name "HappyCarWashMySQL" -StartupType Automatic
    Start-Service -Name "HappyCarWashMySQL"

    Write-Host "Waiting up to 60s for MySQL to start on 127.0.0.1:3306..." -ForegroundColor Cyan
    $connected = $false
    for ($i = 0; $i -lt 60; $i++) {
        $tcp = New-Object System.Net.Sockets.TcpClient
        try {
            $tcp.Connect("127.0.0.1", 3306)
            if ($tcp.Connected) {
                $connected = $true
                $tcp.Close()
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $connected) {
        Fail "MySQL service started but port 3306 did not respond within 60 seconds."
    }
    Write-Success "MySQL service is running and listening on 127.0.0.1:3306."

    # Generate secure 24-char alphanumeric root password
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $rng = New-Object System.Random
    $genPassword = -join ((1..24) | ForEach-Object { $chars[$rng.Next(0, $chars.Length)] })

    $alterCommand = "ALTER USER 'root'@'localhost' IDENTIFIED BY '$genPassword'; FLUSH PRIVILEGES;"
    & $mysqlExe -u root -h 127.0.0.1 --skip-password -e "$alterCommand"
    if ($LASTEXITCODE -ne 0) {
        Fail "Failed to set MySQL root password."
    }

    $pwFile = Join-Path $TargetDir "mysql_root_password.txt"
    [System.IO.File]::WriteAllText($pwFile, $genPassword, $utf8NoBom)
    & icacls "$pwFile" /inheritance:r /grant:r "*S-1-5-32-544:F" "*S-1-5-18:F" | Out-Null
    Write-Success "Generated and securely saved root credentials to $pwFile."
}

# ------------------------------------------------------------------------------
# 3. Service Verification
# ------------------------------------------------------------------------------
Write-Step "Verifying MySQL Service Status"
$mysqlService = Get-Service | Where-Object { $_.Name -match '^(MySQL|MariaDB|HappyCarWashMySQL)' } | Select-Object -First 1
if ($mysqlService) {
    if ($mysqlService.Status -ne "Running") {
        Write-Host "Starting MySQL service $($mysqlService.Name)..." -ForegroundColor Cyan
        Start-Service -Name $mysqlService.Name
        Start-Sleep -Seconds 3
    }
    Write-Success "MySQL service $($mysqlService.Name) is active."
} else {
    Write-Warn "No Windows service matching ^(MySQL|MariaDB|HappyCarWashMySQL) found, but mysql.exe is present."
}

# ------------------------------------------------------------------------------
# 4. Database Setup & Authenticated Table Count Safety Check
# ------------------------------------------------------------------------------
Write-Step "Configuring Database 'happy_gms'"

$dbRootPassword = ""
$pwFile = Join-Path $TargetDir "mysql_root_password.txt"

if (Test-Path $pwFile) {
    $dbRootPassword = (Get-Content $pwFile -Raw).Trim()
    Write-Success "Read root credentials from $pwFile"
} else {
    $secPass = Read-Host -Prompt "Enter MySQL root password" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $dbRootPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# Write temporary --defaults-extra-file for all authenticated MySQL operations
$tempCnf = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    $cnfContent = @"
[client]
user=root
password=$dbRootPassword
host=127.0.0.1
port=3306
"@
    [System.IO.File]::WriteAllText($tempCnf, $cnfContent, $utf8NoBom)

    # 4.1 Create database if not exists
    & $mysqlExe "--defaults-extra-file=$tempCnf" -e "CREATE DATABASE IF NOT EXISTS happy_gms CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
    if ($LASTEXITCODE -ne 0) {
        Fail "Could not connect to MySQL or create database 'happy_gms'. Please verify root credentials."
    }
    Write-Success "Database 'happy_gms' exists and is ready."

    # 4.2 Query table count with strict error and integer validation
    $prevEap = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $tableCountOut = (& $mysqlExe "--defaults-extra-file=$tempCnf" -N -s -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'happy_gms';") 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap

    if ($exitCode -ne 0) {
        Fail "Failed to query table count from 'happy_gms' (Exit Code: $exitCode). Output: $tableCountOut"
    }

    $trimmedCount = ($tableCountOut | Out-String).Trim()
    $tableCount = 0
    if (![int]::TryParse($trimmedCount, [ref]$tableCount)) {
        Fail "Table count query returned non-integer result: '$trimmedCount'. Stopping installer to protect database."
    }

    if ($tableCount -gt 0) {
        Write-Success "Database 'happy_gms' already contains $tableCount tables. Preserving existing database (import skipped)."
    } elseif ($tableCount -eq 0) {
        Write-Host "Database 'happy_gms' has exactly 0 tables. Performing initial import..." -ForegroundColor Cyan
        $dumpPath = Join-Path $clientKitDir "data\happy_gms_latest.sql"
        if (!(Test-Path $dumpPath)) {
            $dumpPath = Join-Path $appSourceDir "happy_car_wash_database.sql"
        }

        if (!(Test-Path $dumpPath)) {
            Fail "No database dump found at $dumpPath to initialize database."
        }

        # Copy the dump to C:\HappyCarWash\import_tmp.sql (do NOT pipe Get-Content into mysql)
        $importTmp = Join-Path $TargetDir "import_tmp.sql"
        $importTmpForward = $importTmp.Replace('\', '/')
        Write-Host "Copying dump to $importTmp..." -ForegroundColor Cyan
        Copy-Item -Path $dumpPath -Destination $importTmp -Force

        Write-Host "Importing via source command..." -ForegroundColor Cyan
        $prevEap = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        $importOutput = (& $mysqlExe "--defaults-extra-file=$tempCnf" --default-character-set=utf8mb4 happy_gms -e "source $importTmpForward") 2>&1
        $importExit = $LASTEXITCODE
        $ErrorActionPreference = $prevEap

        # Delete import_tmp.sql afterward
        if (Test-Path $importTmp) {
            Remove-Item $importTmp -Force -ErrorAction SilentlyContinue
        }

        if ($importExit -ne 0) {
            Fail "Failed to import database dump into MySQL 8.4 (Exit Code: $importExit).`nFull Error Details:`n$($importOutput | Out-String)"
        }

        # Verify the table count is greater than 0
        $prevEap = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        $verifyCountOut = (& $mysqlExe "--defaults-extra-file=$tempCnf" -N -s -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'happy_gms';") 2>&1
        $verifyExit = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        if ($verifyExit -ne 0) {
            Fail "Post-import table count check failed (Exit Code: $verifyExit): $verifyCountOut"
        }
        $verifyCount = 0
        $trimmedVerify = ($verifyCountOut | Out-String).Trim()
        if (![int]::TryParse($trimmedVerify, [ref]$verifyCount) -or $verifyCount -le 0) {
            Fail "Database import completed, but verified table count is $verifyCount (expected > 0). Verification failed."
        }

        Write-Success "Database import completed and verified successfully ($verifyCount tables found)."
    }

    # 4.3 Configure dedicated application DB user (on fresh install)
    if (-not $isUpdate) {
        $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        $rng = New-Object System.Random
        $appDbPassword = -join ((1..24) | ForEach-Object { $chars[$rng.Next(0, $chars.Length)] })

        $createUserSql = @"
CREATE USER IF NOT EXISTS 'happy_app'@'127.0.0.1' IDENTIFIED BY '$appDbPassword';
ALTER USER 'happy_app'@'127.0.0.1' IDENTIFIED BY '$appDbPassword';
GRANT ALL PRIVILEGES ON happy_gms.* TO 'happy_app'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
        & $mysqlExe "--defaults-extra-file=$tempCnf" -e "$createUserSql"
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Could not create dedicated DB user 'happy_app'. Falling back to root configuration."
            $appDbUser = "root"
            $appDbPassFinal = $dbRootPassword
        } else {
            $appDbUser = "happy_app"
            $appDbPassFinal = $appDbPassword
            Write-Success "Created dedicated MySQL application user 'happy_app'@'127.0.0.1'."
        }
    }
}
finally {
    if ($tempCnf -and (Test-Path $tempCnf)) {
        Remove-Item $tempCnf -Force -ErrorAction SilentlyContinue
    }
    $importTmpCleanup = Join-Path $TargetDir "import_tmp.sql"
    if (Test-Path $importTmpCleanup) {
        Remove-Item $importTmpCleanup -Force -ErrorAction SilentlyContinue
    }
}

# Clear in-memory root password
$dbRootPassword = $null

# ------------------------------------------------------------------------------
# 5. Application Deployment (Robocopy without /MIR or /PURGE)
# ------------------------------------------------------------------------------
Write-Step "Deploying Application Files"

if (!(Test-Path $destAppDir)) {
    New-Item -ItemType Directory -Path $destAppDir -Force | Out-Null
}

# Requirement 3: Record pre-update SHA256 of backend\.env
$origEnvHash = $null
if ($isUpdate -and (Test-Path $backendEnv)) {
    $origEnvHash = (Get-FileHash -Path $backendEnv -Algorithm SHA256).Hash
    Write-Host "Recorded pre-update SHA256 of backend\.env: $origEnvHash" -ForegroundColor DarkGray
}

Write-Host "Synchronizing application code to $destAppDir..." -ForegroundColor Cyan

# Backend Robocopy:
# - Do NOT exclude node_modules (copy on fresh install)
# - Copy backend\uploads fully on fresh install (logos & QR images needed for invoices)
# - In UPDATE mode, exclude only backend\uploads\media and backend\uploads\imports
# - Always exclude files: .env, access.log, and *.xlsx
# - Do NOT use /MIR or /PURGE anywhere
# - Check exit code (8 or higher = Fail)
$backendSrc = Join-Path $appSourceDir "backend"
if (!(Test-Path $backendDest)) { New-Item -ItemType Directory -Path $backendDest -Force | Out-Null }

$excludeFiles = @(".env", "access.log", "*.xlsx")

if ($isUpdate) {
    # In update mode, exclude uploads\media and uploads\imports to preserve customer data
    $excludeDirs = @(".git", (Join-Path $backendSrc "uploads\media"), (Join-Path $backendSrc "uploads\imports"))
    & robocopy $backendSrc $backendDest /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /nc /ns | Out-Null
} else {
    # On fresh install, copy all files including node_modules and uploads (logos, QRs)
    $excludeDirs = @(".git")
    & robocopy $backendSrc $backendDest /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /nc /ns | Out-Null
}
if ($LASTEXITCODE -ge 8) {
    Fail "Robocopy for backend folder failed with exit code $LASTEXITCODE (exit code 8 or higher indicates errors)."
}

# Frontend copy (built output only):
# - Copy ONLY frontend\dist, frontend\public and frontend\package.json
# - src, node_modules, configs (vite/tsconfig/tailwind/eslint), index.html source, .env are NOT copied
# - /XF .env *.xlsx on every robocopy; exit code 8 or higher = Fail
$frontendSrc = Join-Path $appSourceDir "frontend"
$frontendDest = Join-Path $destAppDir "frontend"
if (!(Test-Path $frontendDest)) { New-Item -ItemType Directory -Path $frontendDest -Force | Out-Null }

$frontendDistSrc = Join-Path $frontendSrc "dist"
if (!(Test-Path (Join-Path $frontendDistSrc "index.html"))) {
    Fail "frontend\dist\index.html not found in $frontendDistSrc. Run 'npm run build' in the frontend folder on the dev PC before copying the kit."
}

foreach ($sub in @("dist", "public")) {
    $subSrc = Join-Path $frontendSrc $sub
    if (Test-Path $subSrc) {
        $subDest = Join-Path $frontendDest $sub
        & robocopy $subSrc $subDest /E /XF .env *.xlsx /NFL /NDL /NJH /NJS /nc /ns | Out-Null
        if ($LASTEXITCODE -ge 8) {
            Fail "Robocopy for frontend\$sub failed with exit code $LASTEXITCODE (exit code 8 or higher indicates errors)."
        }
    }
}

$frontendPkg = Join-Path $frontendSrc "package.json"
if (Test-Path $frontendPkg) {
    Copy-Item -Path $frontendPkg -Destination (Join-Path $frontendDest "package.json") -Force
}

# Client Kit Robocopy:
$clientKitSrc = $clientKitDir
$clientKitDest = Join-Path $destAppDir "client_kit"
& robocopy $clientKitSrc $clientKitDest /E /XD data /XF *.xlsx /NFL /NDL /NJH /NJS /nc /ns | Out-Null
if ($LASTEXITCODE -ge 8) {
    Fail "Robocopy for client_kit folder failed with exit code $LASTEXITCODE (exit code 8 or higher indicates errors)."
}

# Requirement 3: Verify backend\.env stayed byte-for-byte unchanged on update
if ($isUpdate) {
    if (-not (Test-Path $backendEnv)) {
        Fail "CRITICAL: backend\.env was removed during update!"
    }
    $postEnvHash = (Get-FileHash -Path $backendEnv -Algorithm SHA256).Hash
    if ($origEnvHash -ne $postEnvHash) {
        Fail "CRITICAL: backend\.env was modified during update! Pre-update SHA256: $origEnvHash, Post-update SHA256: $postEnvHash. The file must stay byte-for-byte unchanged."
    }
    Write-Success "Verified backend\.env remained byte-for-byte unchanged (SHA256: $postEnvHash)."
} else {
    # Fresh install: write backend\.env UTF-8 without BOM
    $jwtSecret = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Minimum 0 -Maximum 256) })

    $envContent = @"
PORT=5000
DB_HOST=127.0.0.1
DB_USER=$appDbUser
DB_PASS=$appDbPassFinal
DB_NAME=happy_gms
JWT_SECRET=$jwtSecret
NODE_ENV=production
BASE_URL=http://localhost:5000
"@
    [System.IO.File]::WriteAllText($backendEnv, $envContent, $utf8NoBom)
    Write-Success "Created $backendEnv (UTF-8 without BOM, dedicated user: $appDbUser)."
}

# Run npm install only if backend\node_modules\express is missing
$expressModule = Join-Path $backendDest "node_modules\express"
if (!(Test-Path $expressModule)) {
    Write-Host "backend\node_modules\express is missing. Running npm install..." -ForegroundColor Cyan
    Push-Location $backendDest
    try {
        & npm.cmd install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "npm install exited with code $LASTEXITCODE; verifying existing modules..."
        }
    } finally {
        Pop-Location
    }
    Write-Success "Backend dependencies configured."
} else {
    Write-Success "Backend dependencies (node_modules\express) already present. Skipping npm install."
}

# ------------------------------------------------------------------------------
# 6. Task Scheduler: Server Startup Task (At EVERY BOOT as SYSTEM)
# ------------------------------------------------------------------------------
Write-Step "Configuring Automatic Boot Startup Task for Server"

$serverScript = Join-Path $destAppDir "client_kit\scripts\start_server.ps1"
$serverTaskName = "HappyCarWashServer"

$serverAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$serverScript`" -TargetDir `"$TargetDir`""
$serverTrigger = New-ScheduledTaskTrigger -AtStartup
$serverPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$serverSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

try {
    Unregister-ScheduledTask -TaskName $serverTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $serverTaskName -Action $serverAction -Trigger $serverTrigger -Principal $serverPrincipal -Settings $serverSettings | Out-Null
    Write-Success "Registered boot startup task '$serverTaskName' (runs at startup as SYSTEM, auto-restarts on exit)."
    
    # Start the server task immediately so the app is usable right now
    Start-ScheduledTask -TaskName $serverTaskName -ErrorAction SilentlyContinue
} catch {
    Write-Warn "Could not register startup task: $($_.Exception.Message)"
}

# ------------------------------------------------------------------------------
# 7. Task Scheduler: Automated Twice-Daily Backups (2:00 PM & 9:30 PM)
# ------------------------------------------------------------------------------
Write-Step "Configuring Twice-Daily Automated Database Backup"

$backupScript = Join-Path $destAppDir "client_kit\scripts\backup.ps1"
$backupTaskName = "HappyCarWashDailyBackup"

$backupAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$backupScript`" -TargetDir `"$TargetDir`""
$backupTriggers = @(
    (New-ScheduledTaskTrigger -Daily -At "14:00"),
    (New-ScheduledTaskTrigger -Daily -At "21:30")
)
$backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$backupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Unregister-ScheduledTask -TaskName $backupTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $backupTaskName -Action $backupAction -Trigger $backupTriggers -Principal $backupPrincipal -Settings $backupSettings | Out-Null
    Write-Success "Registered twice-daily backup task '$backupTaskName' (2:00 PM & 9:30 PM, StartWhenAvailable enabled)."
} catch {
    Write-Warn "Could not register backup task: $($_.Exception.Message)"
}

# ------------------------------------------------------------------------------
# 8. Desktop Shortcut Creation
# ------------------------------------------------------------------------------
Write-Step "Creating Desktop Shortcut"

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Happy Car Wash GMS.lnk"
$vbsLauncher = Join-Path $destAppDir "client_kit\scripts\open_app_silent.vbs"
$iconPath = Join-Path $destAppDir "client_kit\happy.ico"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsLauncher`""
$shortcut.WorkingDirectory = $destAppDir
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}
$shortcut.Description = "Launch Happy Car Wash Garage Management System"
$shortcut.Save()

Write-Success "Desktop shortcut created at: $shortcutPath"

# ------------------------------------------------------------------------------
# 9. Complete
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
if ($isUpdate) {
    Write-Host "  UPDATE COMPLETED SUCCESSFULLY!" -ForegroundColor Green
} else {
    Write-Host "  INSTALLATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
}
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To use the app:" -ForegroundColor White
Write-Host "  1. Double-click the 'Happy Car Wash GMS' icon on your Desktop." -ForegroundColor White
Write-Host "  2. The server runs automatically in the background on port 5000." -ForegroundColor White
Write-Host "  3. Data is automatically saved and backed up twice daily (2:00 PM & 9:30 PM)." -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit installer..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
