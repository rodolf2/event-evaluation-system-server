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
# Chrome installation for Puppeteer extraction
npx puppeteer browsers install chrome

echo "=== Build complete ==="
