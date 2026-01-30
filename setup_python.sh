#!/bin/bash

# Setup script for Python dependencies
# This script sets up the Python environment for the text analysis module

echo "Setting up Python environment for text analysis..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Install required packages to user site-packages (persists and auto-discovered by Python)
echo "Installing Python dependencies to user site-packages..."
pip3 install --user -r requirements.txt --no-cache-dir

# Log where packages were installed for debugging
echo "Python user site-packages location:"
python3 -m site --user-site

# Create local nltk_data directory for persistence on Render
mkdir -p ./nltk_data

# Download textblob corpora to local directory
echo "Downloading TextBlob corpora to ./nltk_data..."
python3 -c "import nltk; nltk.download('punkt', download_dir='./nltk_data'); nltk.download('wordnet', download_dir='./nltk_data'); nltk.download('punkt_tab', download_dir='./nltk_data'); from textblob import TextBlob; print('TextBlob setup complete!')"

echo "Python environment setup complete!"