#!/bin/bash
# Video Downloader — One-time installer
# Double-click this file to install everything needed.

set -e

echo ""
echo "======================================"
echo "  Video Downloader — Installer"
echo "======================================"
echo ""

APP_DIR="$HOME/.video-downloader"
APP_NAME="Video Downloader"
APPLICATIONS_DIR="/Applications"

# --- Install Homebrew if needed ---
if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew (macOS package manager)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for this session
    if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

echo "✓ Homebrew installed"

# --- Install dependencies ---
echo "Installing ffmpeg and yt-dlp..."
brew install ffmpeg yt-dlp python3 2>/dev/null || brew upgrade ffmpeg yt-dlp python3 2>/dev/null || true
echo "✓ ffmpeg and yt-dlp installed"

# --- Install Python dependencies ---
echo "Installing Python packages..."
pip3 install --user flask yt-dlp 2>/dev/null || python3 -m pip install --user flask yt-dlp
echo "✓ Python packages installed"

# --- Copy app files ---
echo "Setting up application..."
mkdir -p "$APP_DIR"

# Download app.py from the repo (or copy locally)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/../app.py" ]; then
    cp "$SCRIPT_DIR/../app.py" "$APP_DIR/app.py"
else
    echo "Error: app.py not found. Make sure you're running this from the project folder."
    exit 1
fi

mkdir -p "$APP_DIR/downloads"
mkdir -p "$APP_DIR/templates"
mkdir -p "$APP_DIR/static"

# Copy templates and static if they exist
if [ -d "$SCRIPT_DIR/../templates" ]; then
    cp -r "$SCRIPT_DIR/../templates/"* "$APP_DIR/templates/" 2>/dev/null || true
fi
if [ -d "$SCRIPT_DIR/../static" ]; then
    cp -r "$SCRIPT_DIR/../static/"* "$APP_DIR/static/" 2>/dev/null || true
fi

echo "✓ Application files installed"

# --- Create macOS .app bundle ---
echo "Creating application..."

APP_BUNDLE="$APPLICATIONS_DIR/$APP_NAME.app"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Create the launcher script
cat > "$APP_BUNDLE/Contents/MacOS/launcher" << 'LAUNCHER'
#!/bin/bash

# Add Homebrew to PATH
if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi
export PATH="/opt/homebrew/bin:$HOME/Library/Python/3.9/bin:$HOME/Library/Python/3.11/bin:$HOME/Library/Python/3.12/bin:$PATH"

APP_DIR="$HOME/.video-downloader"
PORT=5050
LOG_FILE="$APP_DIR/server.log"

# Find a python3 that has flask
PYTHON=""
for p in /opt/homebrew/bin/python3 /usr/bin/python3 python3; do
    if $p -c "import flask" 2>/dev/null; then
        PYTHON="$p"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    osascript -e 'display alert "Video Downloader" message "Python with Flask not found. Please re-run the installer."'
    exit 1
fi

# Kill any existing instance
pkill -f "python3.*app\.py.*$PORT" 2>/dev/null || true
sleep 1

# Export fresh cookies from Chrome (if available)
if command -v yt-dlp &>/dev/null; then
    yt-dlp --cookies-from-browser chrome --cookies "$APP_DIR/cookies.txt" --skip-download "https://www.youtube.com" 2>/dev/null || true
fi

# Start the server
cd "$APP_DIR"
$PYTHON app.py --port $PORT > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Wait for server to start
for i in $(seq 1 10); do
    if curl -s -o /dev/null http://127.0.0.1:$PORT/ 2>/dev/null; then
        break
    fi
    sleep 1
done

# Open browser
open "http://127.0.0.1:$PORT"

# Keep running (closing the app kills the server)
wait $SERVER_PID
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

# Create Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Video Downloader</string>
    <key>CFBundleDisplayName</key>
    <string>Video Downloader</string>
    <key>CFBundleIdentifier</key>
    <string>se.weapp.video-downloader</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
PLIST

echo "✓ Application created at $APP_BUNDLE"

echo ""
echo "======================================"
echo "  Installation complete!"
echo "======================================"
echo ""
echo "  You can now open '$APP_NAME' from"
echo "  your Applications folder, or Spotlight."
echo ""
echo "  Just double-click it — your browser"
echo "  will open with the video downloader."
echo ""
echo "======================================"
echo ""

# Open the app for the first time
open "$APP_BUNDLE"
