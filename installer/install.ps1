# Video Downloader — Windows Installer
#
# Run with:
#   irm https://raw.githubusercontent.com/VictorGothensten/video-downloader/main/installer/install.ps1 | iex

$ErrorActionPreference = "Stop"
$REPO = "https://raw.githubusercontent.com/VictorGothensten/video-downloader/main"
$APP_DIR = "$env:USERPROFILE\.video-downloader"
$SHORTCUT_PATH = "$env:USERPROFILE\Desktop\Video Downloader.lnk"
$START_MENU_PATH = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Video Downloader.lnk"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Video Downloader — Installer" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# --- Check/install Python ---
$python = $null
foreach ($p in @("python", "python3", "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe")) {
    try {
        $ver = & $p --version 2>&1
        if ($ver -match "Python 3") {
            $python = $p
            break
        }
    } catch {}
}

if (-not $python) {
    Write-Host "Installing Python via winget..." -ForegroundColor Yellow
    try {
        winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        $python = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    } catch {
        Write-Host "Could not install Python automatically." -ForegroundColor Red
        Write-Host "Please install Python 3.12+ from https://www.python.org/downloads/" -ForegroundColor Red
        Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Host "[OK] Python found: $python" -ForegroundColor Green

# --- Install ffmpeg ---
$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
    Write-Host "Installing ffmpeg..." -ForegroundColor Yellow
    try {
        winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    } catch {
        Write-Host "Could not install ffmpeg automatically." -ForegroundColor Red
        Write-Host "Please install ffmpeg from https://ffmpeg.org/download.html" -ForegroundColor Red
    }
}
Write-Host "[OK] ffmpeg installed" -ForegroundColor Green

# --- Install Python packages ---
Write-Host "Installing Python packages..." -ForegroundColor Yellow
& $python -m pip install --upgrade pip 2>&1 | Out-Null
& $python -m pip install flask yt-dlp 2>&1 | Out-Null
Write-Host "[OK] Python packages installed" -ForegroundColor Green

# --- Download app files ---
Write-Host "Downloading application..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$APP_DIR\templates" | Out-Null
New-Item -ItemType Directory -Force -Path "$APP_DIR\static" | Out-Null
New-Item -ItemType Directory -Force -Path "$APP_DIR\downloads" | Out-Null

Invoke-WebRequest -Uri "$REPO/app.py" -OutFile "$APP_DIR\app.py"
Invoke-WebRequest -Uri "$REPO/templates/index.html" -OutFile "$APP_DIR\templates\index.html"
Invoke-WebRequest -Uri "$REPO/static/style.css" -OutFile "$APP_DIR\static\style.css"
Invoke-WebRequest -Uri "$REPO/static/favicon.png" -OutFile "$APP_DIR\static\favicon.png"
Write-Host "[OK] Application files downloaded" -ForegroundColor Green

# --- Create launcher batch file ---
$launcherContent = @"
@echo off
setlocal

:: Find Python
set PYTHON=
for %%p in (python python3 "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe") do (
    %%~p -c "import flask" >nul 2>&1
    if not errorlevel 1 (
        set PYTHON=%%~p
        goto :found
    )
)

echo Python with Flask not found. Please re-run the installer.
pause
exit /b 1

:found
:: Kill any existing instance
taskkill /f /fi "WINDOWTITLE eq Video Downloader Server" >nul 2>&1

:: Start server
cd /d "%USERPROFILE%\.video-downloader"
start "Video Downloader Server" /min %PYTHON% app.py --port 5050

:: Wait for server
:wait
timeout /t 1 /nobreak >nul
curl -s -o nul http://127.0.0.1:5050/ >nul 2>&1
if errorlevel 1 goto :wait

:: Open browser
start http://127.0.0.1:5050
"@

Set-Content -Path "$APP_DIR\launch.bat" -Value $launcherContent -Encoding ASCII
Write-Host "[OK] Launcher created" -ForegroundColor Green

# --- Create desktop shortcut ---
$WshShell = New-Object -ComObject WScript.Shell

$shortcut = $WshShell.CreateShortcut($SHORTCUT_PATH)
$shortcut.TargetPath = "$APP_DIR\launch.bat"
$shortcut.WorkingDirectory = $APP_DIR
$shortcut.WindowStyle = 7  # Minimized
$shortcut.Description = "Video Downloader"
$shortcut.Save()

# Also add to Start Menu
$startShortcut = $WshShell.CreateShortcut($START_MENU_PATH)
$startShortcut.TargetPath = "$APP_DIR\launch.bat"
$startShortcut.WorkingDirectory = $APP_DIR
$startShortcut.WindowStyle = 7
$startShortcut.Description = "Video Downloader"
$startShortcut.Save()

Write-Host "[OK] Shortcuts created (Desktop + Start Menu)" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Installation complete!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Double-click 'Video Downloader' on"
Write-Host "  your Desktop, or find it in the"
Write-Host "  Start Menu."
Write-Host ""
Write-Host "  Starting it now..."
Write-Host ""

# Launch the app
Start-Process "$APP_DIR\launch.bat" -WindowStyle Minimized
