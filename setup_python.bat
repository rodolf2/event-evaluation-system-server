@echo off
REM Setup script for Python dependencies on Windows
REM This script sets up the Python environment for the text analysis module

echo Setting up Python environment for text analysis...

REM Check if Python 3 is installed
python3 --version >nul 2>&1
if errorlevel 1 (
    echo Python 3 is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python3 -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
pip install --upgrade pip setuptools wheel

REM Install required packages
echo Installing Python dependencies...
pip install -r requirements.txt

REM Download textblob corpora
echo Downloading TextBlob corpora...
python3 -c "import nltk; nltk.download('punkt'); nltk.download('wordnet'); from textblob import TextBlob; print('TextBlob setup complete!')"

echo Python environment setup complete!
echo To activate the virtual environment in the future, run: venv\Scripts\activate.bat
pause