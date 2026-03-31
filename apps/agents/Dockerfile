FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy application code
COPY . .

# Environment variables
ENV PORT=8080
ENV HOST=0.0.0.0

# Start application
CMD ["uvicorn", "kuratormind.api.main:app", "--host", "0.0.0.0", "--port", "8080"]
