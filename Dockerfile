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

# Create virtual environment
RUN python3 -m venv /app/venv

# Install Python dependencies - nltk first without deps to avoid scipy
RUN /app/venv/bin/pip install --no-cache-dir nltk==3.8.1 --no-deps
RUN /app/venv/bin/pip install --no-cache-dir regex click joblib tqdm
RUN /app/venv/bin/pip install --no-cache-dir textblob langid

# Create NLTK data directory and download only essential data
RUN mkdir -p /app/nltk_data
RUN /app/venv/bin/python -c "import nltk; nltk.download('punkt', download_dir='/app/nltk_data'); nltk.download('punkt_tab', download_dir='/app/nltk_data'); print('NLTK data downloaded')"

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 10000

# Start command
CMD ["npm", "start"]
