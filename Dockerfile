FROM node:20-slim

# Install Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy requirements.txt
COPY requirements.txt ./

# Create virtual environment and install Python dependencies
RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN /app/venv/bin/python -c "import nltk; nltk.download('punkt'); nltk.download('averaged_perceptron_tagger'); nltk.download('wordnet')"

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 10000

# Start command
CMD ["npm", "start"]
