# QuickBill & Inventory Management System

> **Mobile-first POS billing, inventory tracking, business accounting, and reporting platform for retail & wholesale businesses.**

---

## 📌 Overview

This project is a high-speed, multi-tenant billing and inventory management application designed to empower shop owners and staff to manage their business operations directly from mobile devices and web interfaces.

### Core Capabilities
- ⚡ **Rapid Mobile POS Billing**: Sub-15 second invoice creation with automated tax & discounts.
- 📷 **Integrated QR Engine**: Generate product QR codes (`ITEM:<publicItemId>`) and scan via mobile camera to auto-add items to cart.
- 📦 **Immutable Stock Movement Ledger**: Complete audit trail for sales, purchases, returns, and manual adjustments.
- 👥 **Parties & Balance Tracking**: Comprehensive customer receivables and supplier payables with running statement ledgers.
- 📊 **Financial & Operational Intelligence**: Real-time Day Book, Profit & Loss (COGS vs Net Sales), Simplified Balance Sheet, and Stock Valuation.
- 📄 **Invoice PDF & Sharing**: One-tap PDF generation (A4 & Thermal POS formats) with direct WhatsApp / Email sharing.
- 🛡️ **Multi-Tenant Security**: Tenant isolation enforced at the repository layer using `businessId`.

---

## 🏛️ System Architecture

```text
                                  ┌────────────────────────┐
                                  │   Mobile Application   │
                                  │  (React Native + Expo) │
                                  │   Camera + QR Scanner  │
                                  └───────────┬────────────┘
                                              │ HTTPS / JSON
                                              │ (Auth: Bearer JWT + X-Business-ID)
                                  ┌───────────▼────────────┐
                                  │    FastAPI Backend     │
                                  │  (Python 3.11+ / REST) │
                                  │  Auth, Engine, RBAC    │
                                  └─────┬────────────┬─────┘
                                        │            │
                         ┌──────────────▼─────┐    ┌─▼──────────────────┐
                         │   MongoDB (7.0+)   │    │  Object Storage    │
                         │ Multi-Tenant DB    │    │ (Invoices, Assets) │
                         └──────────────┬─────┘    └────────────────────┘
                                        │
                                 ┌──────▼───────┐
                                 │ Redis (7.2+) │
                                 │ Idempotency  │
                                 └──────────────┘
                                        ▲
                                        │ HTTPS
                                  ┌─────┴──────────────────┐
                                  │   Web Admin Console    │
                                  │  (Next.js + TypeScript)│
                                  │  Bulk Ops & Reporting  │
                                  └────────────────────────┘
```

---

## 📁 Repository Structure

```text
.
├── .agents/
│   └── skills/                      # 18 Antigravity workspace skills & runbooks
│       ├── auth-rbac/               # JWT, password hashing, and role guards
│       ├── billing-engine/          # Authoritative financial math & tax calculations
│       ├── devops-ci-cd/            # Docker, CI/CD, and MongoDB backup scripts
│       ├── fastapi-backend/         # FastAPI clean architecture & schemas
│       ├── inventory-ledger/        # Immutable stock ledger & adjustment rules
│       ├── invoice-pdf-print-share/ # PDF rendering & mobile sharing
│       ├── mobile-react-native/     # React Native + Expo standards
│       ├── mongodb-data-modeling/   # Schemas, indexes, and Decimal128 handling
│       ├── multi-tenant-security/   # businessId scoping & IDOR prevention
│       ├── observability/           # Structured JSON logs & OpenTelemetry
│       ├── offline-sync/            # Local cache, sync queue, and idempotency
│       ├── payments-and-ledger/     # Payment In/Out & party ledger
│       ├── product-requirements/    # Domain rules, workflows & acceptance criteria
│       ├── qr-billing/              # QR payload formats & camera scanning
│       ├── reporting-analytics/     # P&L, Balance Sheet, and sales reports
│       ├── secure-coding/           # OWASP mitigations & NoSQL protection
│       ├── testing-quality/         # Pytest / Jest test suites & DoD
│       └── ui-design-system/        # Color tokens, typography, and UI states
│
├── apps/                            # Application packages (Monorepo)
│   ├── api/                         # FastAPI Backend REST service
│   ├── mobile/                      # React Native / Expo Mobile App
│   └── web/                         # Next.js Web Admin Console
│
├── packages/                        # Shared libraries
│   ├── contracts/                   # Shared TypeScript interfaces & API types
│   └── design-tokens/               # Centralized design tokens (colors, spacing)
│
├── docker/                          # Docker configuration & init scripts
│   ├── Dockerfile.dev               # API development container
│   ├── mongo-init.js                # Database initialization & index seeding
│   └── scripts/                     # Backup and restore utilities
│
├── docker-compose.yml               # Local multi-container development environment
└── README.md                        # Project documentation
```

---

## 🧠 Antigravity Skills Index

This repository includes specialized Antigravity build skills located in `.agents/skills/`:

| Skill | Description | Path |
| :--- | :--- | :--- |
| **`product-requirements`** | Product specifications, user roles, and MVP scope | [.agents/skills/product-requirements/SKILL.md](file:///.agents/skills/product-requirements/SKILL.md) |
| **`mobile-react-native`** | React Native Expo mobile patterns & hardware camera access | [.agents/skills/mobile-react-native/SKILL.md](file:///.agents/skills/mobile-react-native/SKILL.md) |
| **`qr-billing`** | QR encoding `ITEM:<publicItemId>` and POS scan flows | [.agents/skills/qr-billing/SKILL.md](file:///.agents/skills/qr-billing/SKILL.md) |
| **`fastapi-backend`** | FastAPI architecture, Pydantic v2 schemas, and DI | [.agents/skills/fastapi-backend/SKILL.md](file:///.agents/skills/fastapi-backend/SKILL.md) |
| **`mongodb-data-modeling`** | MongoDB schemas, compound indexes, and Decimal128 money | [.agents/skills/mongodb-data-modeling/SKILL.md](file:///.agents/skills/mongodb-data-modeling/SKILL.md) |
| **`multi-tenant-security`** | Logical tenant isolation and IDOR protection | [.agents/skills/multi-tenant-security/SKILL.md](file:///.agents/skills/multi-tenant-security/SKILL.md) |
| **`billing-engine`** | Authoritative calculations for subtotals, GST, and round-offs | [.agents/skills/billing-engine/SKILL.md](file:///.agents/skills/billing-engine/SKILL.md) |
| **`inventory-ledger`** | Immutable stock movements and real-time quantities | [.agents/skills/inventory-ledger/SKILL.md](file:///.agents/skills/inventory-ledger/SKILL.md) |
| **`payments-and-ledger`** | Payment In/Out allocations and party balances | [.agents/skills/payments-and-ledger/SKILL.md](file:///.agents/skills/payments-and-ledger/SKILL.md) |
| **`reporting-analytics`** | Profit & Loss, Balance Sheet, and sales reports | [.agents/skills/reporting-analytics/SKILL.md](file:///.agents/skills/reporting-analytics/SKILL.md) |
| **`invoice-pdf-print-share`**| Invoice PDF generation, thermal printing, and sharing | [.agents/skills/invoice-pdf-print-share/SKILL.md](file:///.agents/skills/invoice-pdf-print-share/SKILL.md) |
| **`auth-rbac`** | JWT authentication, refresh lifecycles, and RBAC guards | [.agents/skills/auth-rbac/SKILL.md](file:///.agents/skills/auth-rbac/SKILL.md) |
| **`offline-sync`** | Offline caching, sync queues, and idempotency handling | [.agents/skills/offline-sync/SKILL.md](file:///.agents/skills/offline-sync/SKILL.md) |
| **`testing-quality`** | Test pyramid (Pytest, Jest), isolation tests, and DoD | [.agents/skills/testing-quality/SKILL.md](file:///.agents/skills/testing-quality/SKILL.md) |
| **`observability`** | Structured JSON logging and OpenTelemetry tracing | [.agents/skills/observability/SKILL.md](file:///.agents/skills/observability/SKILL.md) |
| **`secure-coding`** | OWASP Top 10 mitigation and NoSQL protection | [.agents/skills/secure-coding/SKILL.md](file:///.agents/skills/secure-coding/SKILL.md) |
| **`ui-design-system`** | Mobile and Web design tokens, components, and UX states | [.agents/skills/ui-design-system/SKILL.md](file:///.agents/skills/ui-design-system/SKILL.md) |
| **`devops-ci-cd`** | Docker configurations, GitHub Actions CI, and backups | [.agents/skills/devops-ci-cd/SKILL.md](file:///.agents/skills/devops-ci-cd/SKILL.md) |

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Docker** & **Docker Compose**
- **Python 3.11+**
- **Node.js 20+** & **npm** / **pnpm**
- **Expo Go App** (on your iOS/Android device for mobile testing)

---

### Step 1: Start Infrastructure (MongoDB & Redis)

Start the local database and cache services using Docker Compose:
```bash
docker compose up -d mongodb redis
```

- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

---

### Step 2: Run the FastAPI Backend

```bash
cd apps/api

# Create and activate Python virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the development server with live reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 📖 **Interactive API Documentation (Swagger)**: `http://localhost:8000/docs`
- 🩺 **Health Check**: `http://localhost:8000/health/ready`

---

### Step 3: Run the Mobile Application (Expo)

```bash
cd apps/mobile

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

- Scan the QR code displayed in the terminal using **Expo Go** (Android) or the **Camera App** (iOS).

---

### Step 4: Run the Web Admin (Next.js)

```bash
cd apps/web

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

- Web Admin URL: `http://localhost:3000`

---

## 🧪 Testing & Quality Assurance

### Run Backend Tests (Pytest)
```bash
cd apps/api
pytest -v --cov=app tests/
```

### Run Multi-Tenant Security & Isolation Tests
```bash
cd apps/api
pytest tests/test_multi_tenant_isolation.py -v
```

### Run Mobile Unit Tests (Jest)
```bash
cd apps/mobile
npm test
```

### Linting and Type Checking
```bash
# Backend (Python)
ruff check apps/api
mypy apps/api --strict

# Frontend (TypeScript)
cd apps/mobile && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

---

## 🔄 Recommended Build Sequence

When adding new modules or building out the MVP, follow the phased order:
1. **01. Project skeleton + architecture**
2. **02. MongoDB connection + base models**
3. **03. Authentication (JWT + refresh)**
4. **04. Business tenancy + RBAC**
5. **05. Item / Category / Unit master**
6. **06. Party / Customer / Supplier master**
7. **07. QR generation (`ITEM:<publicItemId>`)**
8. **08. Mobile QR scanner + item lookup**
9. **09. Billing calculation engine**
10. **10. Sales transaction + stock movement**
11. **11. Inventory movement engine & stock alerts**
12. **12. Purchase transaction**
13. **13. Payments In / Out**
14. **14. Expenses**
15. **15. Invoice PDF / Share**
16. **16. Home Dashboard & Quick Actions**
17. **17. Reports (P&L, Day Book, Stock Summary)**
18. **18. Audit + Observability**
19. **19. End-to-end testing**
20. **20. Production deployment**

---

## 📄 License
Private & Proprietary. All rights reserved.
