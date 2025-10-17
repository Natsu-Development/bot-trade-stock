# Use Python 3.10 as base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Note: .dockerignore is honored only at build context root; we set
# the build context to broker/ in CI so broker/.dockerignore will apply.

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy gRPC generated files
COPY grpc-broker/vnstock/ ./grpc-broker/vnstock/

# Copy server script
COPY vnstock_server.py .

# Expose gRPC port
EXPOSE 50051

# Run the gRPC server
CMD ["python3", "vnstock_server.py"]

