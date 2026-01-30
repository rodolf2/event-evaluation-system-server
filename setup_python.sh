#!/bin/bash

# Setup script for Python dependencies
# This script sets up the Python environment for the text analysis module

echo "Setting up Python environment for text analysis..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install required packages
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create local nltk_data directory for persistence on Render
mkdir -p ./nltk_data

# Download textblob corpora to local directory
echo "Downloading TextBlob corpora to ./nltk_data..."
python3 -c "import nltk; nltk.download('punkt', download_dir='./nltk_data'); nltk.download('wordnet', download_dir='./nltk_data'); nltk.download('punkt_tab', download_dir='./nltk_data'); from textblob import TextBlob; print('TextBlob setup complete!')"

echo "Python environment setup complete!"
echo "To activate the virtual environment in the future, run: source venv/bin/activate"