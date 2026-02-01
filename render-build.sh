#!/usr/bin/env bash
# render-build.sh - Build script for Render deployment

set -e  # Exit on error

echo "=== Installing native dependencies for node-canvas ==="

# Check if running on Linux (Render uses Ubuntu)
if [ "$(uname)" = "Linux" ]; then
    # Install Cairo, Pango, and other dependencies for node-canvas
    # Note: This requires Render's paid plan or Docker environment for apt-get
    if command -v apt-get &> /dev/null; then
        echo "Installing system dependencies..."
        apt-get update
        apt-get install -y \
            build-essential \
            libcairo2-dev \
            libpango1.0-dev \
            libjpeg-dev \
            libgif-dev \
            librsvg2-dev \
            libpixman-1-dev
        echo "System dependencies installed successfully!"
    else
        echo "apt-get not available. Trying with pre-built canvas binaries..."
    fi
fi

echo "=== Installing npm dependencies ==="
npm install

echo "=== Setting up Python environment ==="
chmod +x setup_python.sh
./setup_python.sh

echo "=== Installing Chrome for Puppeteer ==="
# Set the cache directory to match .puppeteerrc.cjs
export PUPPETEER_CACHE_DIR="$(pwd)/.puppeteer_cache"
echo "PUPPETEER_CACHE_DIR set to: $PUPPETEER_CACHE_DIR"
echo "Current directory: $(pwd)"

# Ensure cache directory exists
mkdir -p "$PUPPETEER_CACHE_DIR"

# Chrome installation for Puppeteer extraction
echo "Running: npx puppeteer browsers install chrome"
npx puppeteer browsers install chrome

echo "=== Verifying Chrome installation ==="
echo "Checking cache directory contents..."
ls -laR "$PUPPETEER_CACHE_DIR" 2>/dev/null | head -50 || echo "Cache directory listing failed"

echo ""
echo "Looking for Chrome binary..."
find "$PUPPETEER_CACHE_DIR" -name "chrome" -o -name "chrome-linux64" 2>/dev/null | head -10 || echo "Chrome binary not found"

echo ""
echo "Checking if Chrome executable exists..."
CHROME_PATH=$(find "$PUPPETEER_CACHE_DIR" -name "chrome" -type f 2>/dev/null | head -1)
if [ -n "$CHROME_PATH" ]; then
    echo "✅ Chrome found at: $CHROME_PATH"
    ls -la "$CHROME_PATH"
else
    echo "❌ Chrome executable not found in $PUPPETEER_CACHE_DIR"
    echo "Directory structure:"
    find "$PUPPETEER_CACHE_DIR" -type d 2>/dev/null | head -20
fi

echo "=== Build complete ==="
