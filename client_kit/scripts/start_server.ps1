# ==============================================================================
# Happy Car Wash GMS - Continuous Server Supervisor Script
# Runs at system startup as SYSTEM or on-demand
# Features:
# - Waits for MySQL port 3306 (up to 3 minutes)
# - Redirects node stdout/stderr to C:\HappyCarWash\logs\app_output.log
# - Rotates log files at 10 MB
# - Logs each start and exit with exit code and timestamp
# - Automatically restarts node if it exits
# ==============================================================================

param(
    [string]$TargetDir = "C:\HappyCarWash"
)

$ErrorActionPreference = "Continue"

$appDir = Join-Path $TargetDir "app"
$backendDir = Join-Path $appDir "backend"
$logsDir = Join-Path $TargetDir "logs"

if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

$serverLog = Join-Path $logsDir "server.log"
$appOutLog = Join-Path $logsDir "app_output.log"
$maxLogBytes = 10MB

function Rotate-LogFile([string]$path) {
    if (Test-Path $path) {
        $item = Get-Item $path -ErrorAction SilentlyContinue
        if ($item -and $item.Length -ge $maxLogBytes) {
            $oldPath = "$path.old"
            if (Test-Path $oldPath) {
                Remove-Item $oldPath -Force -ErrorAction SilentlyContinue
            }
            Rename-Item -Path $path -NewName (Split-Path $oldPath -Leaf) -Force -ErrorAction SilentlyContinue
        }
    }
}

function Write-Log([string]$msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Rotate-LogFile $serverLog
    Add-Content -Path $serverLog -Value "[$ts] $msg" -ErrorAction SilentlyContinue
}

Write-Log "Starting Happy Car Wash GMS Server Supervisor..."

# 1. Ensure MySQL service is running
$mySqlService = Get-Service | Where-Object { $_.Name -match '^(MySQL|MariaDB|HappyCarWashMySQL)' } | Select-Object -First 1
if ($mySqlService) {
    if ($mySqlService.Status -ne "Running") {
        Write-Log "Starting MySQL service: $($mySqlService.Name)..."
        Start-Service -Name $mySqlService.Name -ErrorAction SilentlyContinue
    }
}

# 2. Wait for MySQL port 3306 (up to 3 minutes / 180 seconds)
Write-Log "Waiting for MySQL port 3306 to become ready (up to 3 minutes)..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$mysqlReady = $false

while ($sw.Elapsed.TotalSeconds -lt 180) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $tcp.Connect("127.0.0.1", 3306)
        if ($tcp.Connected) {
            $mysqlReady = $true
            $tcp.Close()
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $mysqlReady) {
    Write-Log "ERROR: MySQL port 3306 did not respond within 3 minutes. Exiting."
    exit 1
}

Write-Log "MySQL port 3306 is ready."

# 3. Locate Node.js executable
$nodeExe = "node.exe"
$nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeExe = $nodeCmd.Source
} elseif (Test-Path "C:\Program Files\nodejs\node.exe") {
    $nodeExe = "C:\Program Files\nodejs\node.exe"
}

if (!(Test-Path $backendDir)) {
    Write-Log "ERROR: Backend directory does not exist: $backendDir"
    exit 1
}

# 4. Supervisor loop: starts node src/server.js, captures stdout/stderr, auto-restarts on exit
Write-Log "Entering supervisor loop for backend server in $backendDir..."

while ($true) {
    Rotate-LogFile $appOutLog
    $startTs = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Log "START: Launching Node.js backend server ($nodeExe src/server.js)..."

    try {
        $cmdArgs = "/c `"`"$nodeExe`" src/server.js >> `"$appOutLog`" 2>&1`""
        $proc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WorkingDirectory $backendDir -NoNewWindow -Wait -PassThru
        $exitCode = $proc.ExitCode
        $exitTs = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Log "EXIT: Node.js process exited with code $exitCode at $exitTs. Automatically restarting in 3 seconds..."
    } catch {
        Write-Log "EXCEPTION: Error executing Node.js process: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 3
}
