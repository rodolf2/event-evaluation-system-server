FROM node:20-slim

# Install Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Environment variables for limited resource containers
ENV OPENBLAS_NUM_THREADS=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV NLTK_DATA=/app/nltk_data

# Copy package files first (better caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy requirements.txt
COPY requirements.txt ./

# Create virtual environment and install Python dependencies
RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Create NLTK data directory and download data
RUN mkdir -p /app/nltk_data
RUN /app/venv/bin/python -c "import nltk; nltk.download('punkt', download_dir='/app/nltk_data'); nltk.download('punkt_tab', download_dir='/app/nltk_data'); nltk.download('averaged_perceptron_tagger', download_dir='/app/nltk_data'); nltk.download('wordnet', download_dir='/app/nltk_data'); print('NLTK data downloaded successfully')"

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 10000

# Start command
CMD ["npm", "start"]
