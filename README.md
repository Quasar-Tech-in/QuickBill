# ⚡ QuickBill & Inventory Management System

> **A high-speed, multi-tenant POS billing, real-time inventory ledger, business accounting, and GST reporting platform for retail & wholesale businesses.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_Python_3.11+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_+_Vite-61DAFB.svg?logo=react)](https://vitejs.dev)
[![React Native](https://img.shields.io/badge/Mobile-React_Native_+_Expo-000020.svg?logo=expo)](https://expo.dev)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_7.0+-47A248.svg?logo=mongodb)](https://www.mongodb.com)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_Strict-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Language-Python_3.8%2B%20%2F%203.11%2B-3776AB.svg?logo=python)](https://www.python.org)

---

## 📌 Executive Summary & User Guide

For store owners, cashiers, inventory managers, and accountants seeking a complete operational guide and feature walkthrough, please refer to the dedicated:
👉 **[📖 Complete End-User Manual (`USER_GUIDE.md`)](USER_GUIDE.md)**

---

## 🚀 Core Capabilities

- ⚡ **High-Speed POS Billing**: Sub-15 second invoice checkout with barcode scanner support, keyboard shortcuts (`F2`, `F8`, `F9`), and instant calculations.
- 🛍️ **Cart Staging & Parked Orders**: Hold multiple customer carts in-flight with backend database sync, conflict resolution, and discard confirmations.
- 🏪 **Multi-Store & Branch Tenancy**: Logical tenant isolation (`businessId`) and branch scoping (`locationId`) with custom store branding, GSTIN, and receipt headers.
- 📦 **Immutable Inventory Ledger**: Real-time stock levels, movement audit trails (Sales, Purchases, Returns, Adjustments), and location-specific stock visibility.
- 🔄 **Sales Returns & Defect Auditing**: Partial & full returns with reason classification (`RESTOCKABLE_RETURN` vs. `DEFECTIVE_DAMAGED`) and automated stock replenishment.
- 🏷️ **Barcode & QR Label Generator**: Generate and print product barcode labels and QR codes (`ITEM:<publicItemId>`) directly to thermal sticker printers.
- 👥 **Parties & Customer Khata**: Comprehensive customer receivables and supplier payables with running statement ledgers and credit limit enforcement.
- 📊 **Financial & GST Analytics**: Real-time Day Book, Trading & Profit & Loss Statement (tax-inclusive gross sales, output tax segregation, true catalog COGS), and GSTR-1 Rate Slab Breakdown (0%, 5%, 12%, 18%, 28%).
- 📄 **Invoice PDF & Multi-Channel Sharing**: Thermal POS (2-inch / 3-inch) receipts, A4 tax invoices, and direct WhatsApp sharing.
- 🔐 **Enterprise Security**: Two-Factor Authentication (TOTP / 2FA), Argon2/bcrypt password hashing, JWT access & refresh lifecycle, and granular RBAC.

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
                                  │  Billing Engine & RBAC │
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
                                  │   Web Admin & POS      │
                                  │ (Vite + React + TS)    │
                                  │ Multi-Store Operations │
                                  └────────────────────────┘
```

---

## 📁 Monorepo Structure

```text
.
├── apps/
│   ├── api/                         # FastAPI Python Backend REST Service
│   │   ├── app/                     # Routers, Services, Models, Repositories
│   │   ├── tests/                   # Pytest test suite (Unit, Integration, RBAC)
│   │   └── README.md                # [Backend Developer Guide](apps/api/README.md)
│   ├── web/                         # Vite + React + TypeScript Web Admin & POS
│   │   ├── src/                     # Views, Components, Context, Types
│   │   └── README.md                # [Web Frontend Developer Guide](apps/web/README.md)
│   └── mobile/                      # React Native / Expo Mobile Application
│       ├── src/                     # Mobile Screens, Scanner & Offline Hooks
│       └── README.md                # [Mobile Developer Guide](apps/mobile/README.md)
│
├── .agents/skills/                  # 21 Antigravity workspace skills & specifications
├── docker/                          # Dockerfiles, MongoDB init scripts, and backup tools
├── docker-compose.yml               # Local containerized infrastructure
├── USER_GUIDE.md                    # Complete End-User & Operational Manual
└── README.md                        # Master repository documentation
```

---

## 🛠️ Quickstart & Local Development

### Prerequisites
- **Python 3.11+** (or Python 3.8+)
- **Node.js 20+** & **npm**
- **Docker** & **Docker Compose**
- **Expo Go App** (Optional: for mobile device testing)

---

### Step 1: Start Database (MongoDB)

```bash
docker compose up -d mongodb
```
- MongoDB connects on: `mongodb://localhost:27017`

---

### Step 2: Start FastAPI Backend

```bash
cd apps/api

# Create & activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 📖 **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🩺 **Health Check**: [http://localhost:8000/health/ready](http://localhost:8000/health/ready)

---

### Step 3: Start Web Admin & POS Console

```bash
cd apps/web

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

- 🌐 **Web Admin & POS**: [http://localhost:3000](http://localhost:3000)

---

### Step 4: Start Mobile App (Expo)

```bash
cd apps/mobile

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

---

## 🧪 Testing & Quality Assurance

### Run Backend Tests (Pytest)
```bash
cd apps/api
pytest -v
```

### Run Multi-Tenant Isolation Tests
```bash
cd apps/api
pytest tests/test_multi_tenant_isolation.py -v
```

### Run Frontend Typecheck & Build
```bash
cd apps/web
npm run build
```

---

## 📚 Specialized Documentation Index

- **[End-User Operational Manual (`USER_GUIDE.md`)](USER_GUIDE.md)**
- **[Backend Service Documentation (`apps/api/README.md`)](apps/api/README.md)**
- **[Web Console Documentation (`apps/web/README.md`)](apps/web/README.md)**
- **[Mobile Application Documentation (`apps/mobile/README.md`)](apps/mobile/README.md)**
- **[MongoDB Database Architecture & Schemas (`MONGODB_SCHEMA_AND_INTEGRATION_ARCHITECTURE.md`)](MONGODB_SCHEMA_AND_INTEGRATION_ARCHITECTURE.md)**

---

## 📄 License
Proprietary & Confidential — QuickBill Team.
