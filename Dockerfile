# Production-ready Dockerfile for JobNex
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000 \
    HOST=0.0.0.0

# Install minimal runtime system dependencies (curl for healthchecks, ca-certificates for HTTPS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create a non-privileged user for security compliance
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Copy dependency requirements first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application backend and frontend assets
COPY --chown=appuser:appgroup backend/ ./backend/
COPY --chown=appuser:appgroup Frontend/ ./Frontend/
COPY --chown=appuser:appgroup main.py run.py ./

# Switch to non-root user
USER appuser

# Expose default application port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run FastAPI backend via Uvicorn on port 3000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]

