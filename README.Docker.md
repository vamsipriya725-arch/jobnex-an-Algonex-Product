# Docker Deployment Guide for JobNex

This file contains instructions on how to build, run, and manage the JobNex application container.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v20.10+ / Docker 24+)
- Docker Compose v2+

## Project Files

- **`Dockerfile`**: Production-ready, multi-layer image based on `python:3.11-slim`, running with a non-root security user and integrated `/health` check.
- **`.dockerignore`**: Excludes virtual environments (`.venv`), `node_modules`, `.git`, temporary artifacts, and sensitive files.
- **`compose.yaml`**: Multi-container and service orchestration spec exposing the unified application on port `3000`.

## Quick Start

### 1. Build the Docker Image
```bash
docker build -t myapp:latest .
```

### 2. Run with Docker Run
```bash
docker run -d -p 3000:3000 --name jobnex-app myapp:latest
```

Open your browser to:
- **Web Portal**: [http://localhost:3000/](http://localhost:3000/)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **API Documentation**: [http://localhost:3000/docs](http://localhost:3000/docs)

### 3. Run with Docker Compose
```bash
docker compose up -d
```

View live logs:
```bash
docker compose logs -f
```

Stop the service:
```bash
docker compose down
```

