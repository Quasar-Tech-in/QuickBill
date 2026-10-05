# 🛠️ QuickBill Backend REST API (`apps/api`)

> **Authoritative FastAPI backend service providing multi-tenant POS billing, real-time inventory ledger, reporting engine, and authentication.**

---

## 📌 Architecture & Overview

The QuickBill API is built with **FastAPI** (Python 3.8+ / 3.11+) following a clean layered architecture:
- **Routers (`app/api/v1/`)**: Request validation, HTTP response contracts, and routing.
- **Services (`app/services/`)**: Business logic, financial calculation engine, stock reconciliation, and report aggregations.
- **Repositories (`app/repositories/`)**: Database queries strictly scoped to the active tenant (`businessId`).
- **Models / Schemas (`app/models/` / `app/schemas/`)**: Pydantic v2 schemas and MongoDB document representations.
- **Core (`app/core/`)**: Configuration, database connection lifecycle, JWT auth, and middleware.

```text
HTTP Request
     │
     ▼
┌────────────────────────────────────────────────────────┐
│ Tenant & Auth Middleware (businessId, locationId, JWT)  │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│ API Routers (/sales, /items, /reports, /staged-orders)  │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│ Business Services (BillingEngine, ReportService, etc.) │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│ Scoped Repositories (Strictly filter by businessId)    │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│ MongoDB Multi-Tenant Database Collections              │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Modules & Endpoints

| Endpoint Group | Description | Key Capabilities |
| :--- | :--- | :--- |
| `/api/v1/auth` | Authentication & 2FA | Login, Register, Refresh Token, TOTP 2FA Setup & Verification |
| `/api/v1/sales` | Invoices & Billing | Create Tax-Inclusive Invoices, Sales Returns, Invoice Receipts |
| `/api/v1/staged-orders` | Parked Carts | Create, Retrieve, Sync, and Discard Parked In-Flight Carts |
| `/api/v1/items` | Item Catalog & Inventory | CRUD Items, Adjust Stock, Barcode/QR Generation, Low-Stock |
| `/api/v1/parties` | Customers & Suppliers | Manage Parties, Receivables, Payables, Payment In / Out |
| `/api/v1/purchases` | Purchase Orders | PO Creation, Stock Intake, Vendor Payables |
| `/api/v1/reports` | Business Intelligence | Day Book, Trading & P&L (Real COGS), GSTR-1 GST Rate Slabs |
| `/api/v1/locations` | Store Branches | Branch Management, Location-Specific GSTIN & Custom Branding |

---

## ⚙️ Environment Variables

Create `.env` in `apps/api/` based on `.env.example`:

```ini
# Application
PROJECT_NAME="QuickBill API"
VERSION="1.0.0"
API_V1_STR="/api/v1"
ENVIRONMENT="development"

# Server
HOST="0.0.0.0"
PORT=8000
RELOAD=true

# MongoDB Configuration
MONGODB_URL="mongodb://localhost:27017"
MONGODB_DB_NAME="quickbill_db"

# JWT Authentication
JWT_SECRET_KEY="your-secure-jwt-secret-key"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","http://localhost:8081"]
```

---

## 🏃 Running Locally

### 1. Setup Virtual Environment & Dependencies
```bash
cd apps/api
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Launch FastAPI Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health/ready](http://localhost:8000/health/ready)

---

## 🧪 Running Pytest Test Suite

```bash
cd apps/api
pytest -v
```

### Run Multi-Tenant Security & Isolation Tests
```bash
pytest tests/test_multi_tenant_isolation.py -v
```

### Run Billing Engine & Financial Calculation Tests
```bash
pytest tests/test_billing_engine.py -v
```

---

## 📐 Financial Calculation Standards

The Billing Engine ([`app/services/billing_engine.py`](file:///e:/Personal-git/inventory-bill%20management%20system/apps/api/app/services/billing_engine.py)) strictly enforces:
- **Tax-Inclusive Pricing**:
  $$\text{Taxable Amount} = \frac{\text{Item Selling Price}}{1 + \frac{\text{GST Rate}}{100}}$$
  $$\text{Tax Amount} = \text{Item Selling Price} - \text{Taxable Amount}$$
- **Output GST Isolation**: Tax totals are segregated cleanly for GSTR-1 compliance without reducing turnover twice.
- **Cost of Goods Sold (COGS)**:
  $$\text{COGS} = \sum (\text{item.purchasePrice} \times \text{netQuantitySold})$$
