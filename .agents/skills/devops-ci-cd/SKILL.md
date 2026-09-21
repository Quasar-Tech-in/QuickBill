---
name: devops-ci-cd
description: >-
  DevOps configurations, Docker multi-stage builds, docker-compose local environments,
  GitHub Actions CI/CD workflows, automated MongoDB backup/restore, and deployment runbooks.
---

# DevOps, Containerization & CI/CD Pipelines

## 1. Local Development Environment (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: business_mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secretpassword
    volumes:
      - mongo_data:/data/db
      - ./docker/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro

  redis:
    image: redis:7.2-alpine
    container_name: business_redis
    restart: unless-stopped
    ports:
      - "6379:6379"

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    container_name: business_api
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URI=mongodb://admin:secretpassword@mongodb:27017/business_app?authSource=admin
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=dev_jwt_secret_key_change_in_production
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./apps/api:/app

volumes:
  mongo_data:
```

---

## 2. Multi-Stage Production Dockerfile (`apps/api/Dockerfile`)

```dockerfile
# Stage 1: Build Dependencies
FROM python:3.11-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc build-essential
COPY pyproject.toml requirements.txt ./
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime Image
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpango-1.0-0 libharfbuzz0b libpangoft2-1.0-0 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
COPY . /app
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

---

## 3. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)

```yaml
name: CI Quality & Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-checks:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install dependencies
        run: |
          pip install ruff mypy pytest pytest-asyncio httpx
          pip install -r apps/api/requirements.txt
      - name: Run Linter (Ruff)
        run: ruff check apps/api
      - name: Run Type Check (Mypy)
        run: mypy apps/api --strict
      - name: Run Test Suite
        env:
          MONGODB_URI: mongodb://localhost:27017/test_business_db
        run: pytest apps/api/tests -v --cov=apps/api/app

  mobile-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: |
          cd apps/mobile
          npm ci
      - name: TypeScript & Lint Check
        run: |
          cd apps/mobile
          npx tsc --noEmit
          npm run lint
```

---

## 4. Automated MongoDB Backup & Restore Scripts

### 4.1. Backup Script (`docker/scripts/backup_mongodb.sh`)
```bash
#!/usr/bin/env bash
set -e
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups"
FILENAME="mongo_backup_${TIMESTAMP}.gz"

mongodump --uri="${MONGODB_URI}" --archive="${BACKUP_DIR}/${FILENAME}" --gzip
echo "Backup created at ${BACKUP_DIR}/${FILENAME}"
```

---

## 5. Verification Checklist
- [ ] Docker compose brings up MongoDB, Redis, and API without port collisions.
- [ ] GitHub Actions CI workflow validates backend and frontend on every PR.
- [ ] Production Docker image uses multi-stage build without compiler dependencies.
- [ ] Database backup scripts successfully generate gzipped archive dumps.
