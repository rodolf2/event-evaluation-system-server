#!/bin/bash

# Setup script for Python dependencies
# This script sets up the Python environment for the text analysis module

echo "Setting up Python environment for text analysis..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Create directory for Python libraries
mkdir -p python_libs

# Install required packages to local directory
echo "Installing Python dependencies to ./python_libs..."
pip install -r requirements.txt -t python_libs --no-cache-dir

# Create local nltk_data directory for persistence on Render
mkdir -p ./nltk_data

# Download textblob corpora to local directory
# We need to add python_libs to PYTHONPATH for this to work
echo "Downloading TextBlob corpora to ./nltk_data..."
export PYTHONPATH=$PYTHONPATH:$(pwd)/python_libs
python3 -c "import sys; sys.path.append('./python_libs'); import nltk; nltk.download('punkt', download_dir='./nltk_data'); nltk.download('wordnet', download_dir='./nltk_data'); nltk.download('punkt_tab', download_dir='./nltk_data'); from textblob import TextBlob; print('TextBlob setup complete!')"

echo "Python environment setup complete!"
echo "Libraries installed in: python_libs"