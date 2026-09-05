# ==============================================================================
# SIH 2026 PS-26166: Lunar Image Correspondence & Pipeline Backend API
# Production Dockerfile for Railway Deployment (Backend Service)
# ==============================================================================

FROM python:3.12-slim AS runner

WORKDIR /app

# Install system dependencies for OpenCV, GDAL/rasterio, Git, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Optimize PyTorch installation: install CPU wheels first to prevent downloading 2.5GB CUDA packages
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining requirements
COPY requirements.txt ./
RUN grep -v -E '^(torch|torchvision)([>=<~]|$)' requirements.txt > reqs_no_torch.txt && \
    pip install --no-cache-dir -r reqs_no_torch.txt

# Copy backend application source code, metadata, configs, and scripts
COPY api/ ./api/
COPY data/ ./data/
COPY configs/ ./configs/
COPY models/ ./models/
COPY scripts/ ./scripts/
COPY src/ ./src/

# Ensure runtime directories exist
RUN mkdir -p data/processed data/raw data/calibrated data/pairs results

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start FastAPI server on dynamic $PORT provided by Railway
CMD ["sh", "-c", "python -m uvicorn api.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
