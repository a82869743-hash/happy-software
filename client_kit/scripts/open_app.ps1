# ==============================================================================
# Happy Car Wash GMS - Desktop Launcher Script
# Features:
# - Sleeps 1s after every failed OR non-ok health attempt (up to 90s max)
# - Opens with msedge.exe --app=http://localhost:5000 if Edge exists
# - Else opens with chrome.exe --app=http://localhost:5000 if Chrome exists
# - Else falls back to default browser
# - Displays Windows error MessageBox on timeout
# ==============================================================================

param(
    [string]$TargetDir = "C:\HappyCarWash"
)

$ErrorActionPreference = "Continue"

# 1. Trigger background server task or script if not already running
$serverTask = Get-ScheduledTask -TaskName "HappyCarWashServer" -ErrorAction SilentlyContinue
if ($serverTask) {
    if ($serverTask.State -ne "Running") {
        Start-ScheduledTask -TaskName "HappyCarWashServer" -ErrorAction SilentlyContinue
    }
} else {
    $silentStarter = Join-Path $TargetDir "app\client_kit\scripts\start_server_silent.vbs"
    if (Test-Path $silentStarter) {
        Start-Process "wscript.exe" -ArgumentList "`"$silentStarter`"" -WindowStyle Hidden
    }
}

# 2. Wait up to 90s for http://127.0.0.1:5000/api/health returning 200
$healthUrl = "http://127.0.0.1:5000/api/health"
$appUrl = "http://localhost:5000"
$serverReady = $false
$maxWaitSeconds = 90
$sw = [System.Diagnostics.Stopwatch]::StartNew()

while ($sw.Elapsed.TotalSeconds -lt $maxWaitSeconds) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2 -ErrorAction Stop
        if ($response -and $response.status -eq "ok") {
            $serverReady = $true
            break
        }
    } catch {
        # Request failed or returned non-200
    }
    # Sleep 1s after every failed OR non-ok attempt
    Start-Sleep -Seconds 1
}

# 3. Launch application or display error
if ($serverReady) {
    # Check for Microsoft Edge
    $edgeExe = $null
    $edgeCandidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($cand in $edgeCandidates) {
        if ($cand -and (Test-Path $cand)) { $edgeExe = $cand; break }
    }
    if (-not $edgeExe) {
        $edgeCmd = Get-Command "msedge.exe" -ErrorAction SilentlyContinue
        if ($edgeCmd) { $edgeExe = $edgeCmd.Source }
    }

    # Check for Google Chrome
    $chromeExe = $null
    $chromeCandidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($cand in $chromeCandidates) {
        if ($cand -and (Test-Path $cand)) { $chromeExe = $cand; break }
    }
    if (-not $chromeExe) {
        $chromeCmd = Get-Command "chrome.exe" -ErrorAction SilentlyContinue
        if ($chromeCmd) { $chromeExe = $chromeCmd.Source }
    }

    if ($edgeExe) {
        Start-Process -FilePath $edgeExe -ArgumentList "--app=$appUrl"
    } elseif ($chromeExe) {
        Start-Process -FilePath $chromeExe -ArgumentList "--app=$appUrl"
    } else {
        Start-Process $appUrl
    }
    exit 0
} else {
    Add-Type -AssemblyName System.Windows.Forms
    $errorMsg = "Happy Car Wash GMS failed to start within $maxWaitSeconds seconds.`n`n" +
                "Possible causes:`n" +
                "1. MySQL service ('HappyCarWashMySQL') is stopped.`n" +
                "2. Port 5000 is occupied by another application.`n" +
                "3. Backend encountered an error on startup.`n`n" +
                "Please inspect the log files in $TargetDir\logs\"
    [System.Windows.Forms.MessageBox]::Show(
        $errorMsg,
        "Happy Car Wash GMS - Startup Error",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}
