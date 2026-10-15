# ==============================================================================
# Happy Car Wash GMS - Production Backup Script
# Features:
# - Authenticates via temporary --defaults-extra-file (UTF-8 no BOM)
# - Reads DB_USER/DB_PASS/DB_NAME from backend\.env
# - Uses --result-file (no shell redirection)
# - Verifies dump ends with "Dump completed" and performs size check
# - Mirrors backend\uploads (using /E, no /MIR or /PURGE)
# - Logs all errors to C:\HappyCarWash\logs\backup.log and exits non-zero on failure
# - Enforces minimum 30-day retention
# - Supports optional second backup destination (USB pendrive / OneDrive)
# ==============================================================================

param(
    [string]$TargetDir = "C:\HappyCarWash",
    [int]$RetentionDays = 30,
    [string]$SecondBackupDir = ""
)

$ErrorActionPreference = "Stop"

$logsDir = Join-Path $TargetDir "logs"
$backupDir = Join-Path $TargetDir "backups"

if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$logFile = Join-Path $logsDir "backup.log"

function Write-BackupLog([string]$msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$ts] $msg" -ErrorAction SilentlyContinue
}

$tempCnf = $null

try {
    # 1. Locate mysqldump.exe
    $dumpExe = Get-ChildItem -Path (Join-Path $TargetDir "mysql\*\bin\mysqldump.exe") -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    if (-not $dumpExe) {
        $dumpCmd = Get-Command "mysqldump.exe" -ErrorAction SilentlyContinue
        if ($dumpCmd) { $dumpExe = $dumpCmd.Source }
    }
    if (-not $dumpExe) {
        $dumpExe = Get-ChildItem -Path "C:\Program Files\MySQL\MySQL Server *\bin\mysqldump.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    }

    if (-not $dumpExe -or !(Test-Path $dumpExe)) {
        Write-BackupLog "ERROR: mysqldump.exe not found."
        exit 1
    }

    # 2. Read DB_USER, DB_PASS, DB_NAME from backend\.env
    $envFile = Join-Path $TargetDir "app\backend\.env"
    if (!(Test-Path $envFile)) {
        Write-BackupLog "ERROR: Environment file not found at $envFile"
        exit 1
    }

    $dbUser = ""
    $dbPass = ""
    $dbName = "happy_gms"

    foreach ($line in (Get-Content $envFile)) {
        if ($line -match '^\s*DB_USER\s*=\s*(.*)$') { $dbUser = $matches[1].Trim() }
        if ($line -match '^\s*DB_PASS\s*=\s*(.*)$') { $dbPass = $matches[1].Trim() }
        if ($line -match '^\s*DB_NAME\s*=\s*(.*)$') { $dbName = $matches[1].Trim() }
    }

    # Fallback to root password file if user/pass is empty in .env
    if (-not $dbPass) {
        $pwFile = Join-Path $TargetDir "mysql_root_password.txt"
        if (Test-Path $pwFile) {
            $dbUser = "root"
            $dbPass = (Get-Content $pwFile -Raw).Trim()
        }
    }

    if (-not $dbPass) {
        Write-BackupLog "ERROR: No database password found. Refusing to run mysqldump without authentication."
        exit 1
    }
    if (-not $dbUser) {
        $dbUser = "root"
    }

    # 3. Create temporary --defaults-extra-file (UTF-8 without BOM)
    $tempCnf = [System.IO.Path]::GetTempFileName()
    $cnfContent = @"
[client]
user=$dbUser
password=$dbPass
host=127.0.0.1
port=3306
"@
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempCnf, $cnfContent, $utf8NoBom)

    $backupFileName = "happy_gms_backup_{0}.sql" -f (Get-Date -Format "yyyyMMdd_HHmmss")
    $backupFilePath = Join-Path $backupDir $backupFileName

    # 4. Execute mysqldump with --defaults-extra-file and --result-file
    & $dumpExe "--defaults-extra-file=$tempCnf" --single-transaction --routines --triggers --events --default-character-set=utf8mb4 --result-file="$backupFilePath" $dbName
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0 -or !(Test-Path $backupFilePath)) {
        Write-BackupLog "ERROR: mysqldump failed with exit code $exitCode."
        exit $exitCode
    }

    # 5. Verify dump ends with "Dump completed"
    $tail = Get-Content -Path $backupFilePath -Tail 10
    if (($tail -join "`n") -notmatch "Dump completed") {
        Write-BackupLog "ERROR: Backup created but 'Dump completed' marker not found. Incomplete dump."
        exit 1
    }

    # 6. Verify file size check (minimum 100 KB for database data)
    $item = Get-Item $backupFilePath
    if ($item.Length -lt 10KB) {
        Write-BackupLog "ERROR: Backup file size is suspiciously small ($($item.Length) bytes)."
        exit 1
    }

    $sizeKB = [math]::Round($item.Length / 1KB, 2)
    Write-BackupLog "SUCCESS: Database dump $backupFileName created ($sizeKB KB)."

    # 7. Mirror backend\uploads directory (using /E, no /MIR or /PURGE)
    $uploadsSrc = Join-Path $TargetDir "app\backend\uploads"
    $uploadsMirror = Join-Path $backupDir "uploads_mirror"
    if (Test-Path $uploadsSrc) {
        if (!(Test-Path $uploadsMirror)) {
            New-Item -ItemType Directory -Path $uploadsMirror -Force | Out-Null
        }
        & robocopy $uploadsSrc $uploadsMirror /E /NFL /NDL /NJH /NJS /nc /ns | Out-Null
        Write-BackupLog "SUCCESS: Mirrored backend\uploads to $uploadsMirror."
    }

    # 8. Retain at least 30 days of database dumps
    $retentionLimit = [math]::Max(30, $RetentionDays)
    $cutoff = (Get-Date).AddDays(-$retentionLimit)
    Get-ChildItem -Path $backupDir -Filter "happy_gms_backup_*.sql" | Where-Object { $_.CreationTime -lt $cutoff } | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-BackupLog "PRUNED: Removed backup older than $retentionLimit days: $($_.Name)."
    }

    # 9. Support optional second folder (pendrive / external drive / OneDrive)
    $secondFolderConfig = Join-Path $TargetDir "second_backup_path.txt"
    if (-not $SecondBackupDir -and (Test-Path $secondFolderConfig)) {
        $SecondBackupDir = (Get-Content $secondFolderConfig -Raw).Trim()
    }

    if ($SecondBackupDir) {
        if (Test-Path $SecondBackupDir) {
            Copy-Item -Path $backupFilePath -Destination $SecondBackupDir -Force
            if (Test-Path $uploadsMirror) {
                $secondUploads = Join-Path $SecondBackupDir "uploads_mirror"
                if (!(Test-Path $secondUploads)) { New-Item -ItemType Directory -Path $secondUploads -Force | Out-Null }
                & robocopy $uploadsMirror $secondUploads /E /NFL /NDL /NJH /NJS /nc /ns | Out-Null
            }
            # Clean old dumps in second folder
            Get-ChildItem -Path $SecondBackupDir -Filter "happy_gms_backup_*.sql" | Where-Object { $_.CreationTime -lt $cutoff } | ForEach-Object {
                Remove-Item $_.FullName -Force
            }
            Write-BackupLog "SUCCESS: Replicated backup to secondary location: $SecondBackupDir."
        } else {
            Write-BackupLog "WARNING: Secondary backup location '$SecondBackupDir' is not accessible."
        }
    }
}
catch {
    Write-BackupLog "FATAL: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($tempCnf -and (Test-Path $tempCnf)) {
        Remove-Item $tempCnf -Force -ErrorAction SilentlyContinue
    }
}
