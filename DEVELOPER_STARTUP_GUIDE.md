# 🛠️ QuickBill — Developer Startup & Contribution Guide

> **The definitive engineering manual for setting up, developing, testing, debugging, and contributing to the QuickBill platform across the Backend REST API, Web Admin & POS Console, and Mobile Application.**

---

## 📑 Table of Contents

1. [Architecture Overview & Monorepo Structure](#1-architecture-overview--monorepo-structure)
2. [Prerequisites & System Setup](#2-prerequisites--system-setup)
3. [Step-by-Step Local Environment Startup](#3-step-by-step-local-environment-startup)
   - [3.1. Database: MongoDB Cluster Setup](#31-database-mongodb-cluster-setup)
   - [3.2. Backend: FastAPI Python Service (`apps/api`)](#32-backend-fastapi-python-service-appsapi)
   - [3.3. Web Frontend: React + Vite Console (`apps/web`)](#33-web-frontend-react--vite-console-appsweb)
   - [3.4. Mobile App: React Native + Expo (`apps/mobile`)](#34-mobile-app-react-native--expo-appsmobile)
   - [3.5. Full-Stack Docker Compose Mode](#35-full-stack-docker-compose-mode)
4. [Environment Configuration Reference](#4-environment-configuration-reference)
5. [Core Architectural Invariants & Patterns](#5-core-architectural-invariants--patterns)
   - [5.1. Multi-Tenant Scoping & Strict 404 Security Guard](#51-multi-tenant-scoping--strict-404-security-guard)
   - [5.2. Server-Authoritative Financial Math](#52-server-authoritative-financial-math)
   - [5.3. Immutable Stock Movement Ledger](#53-immutable-stock-movement-ledger)
   - [5.4. Hardware Scanner Gun vs. Camera Protocols](#54-hardware-scanner-gun-vs-camera-protocols)
6. [Step-by-Step Guide: Contributing a New Feature](#6-step-by-step-guide-contributing-a-new-feature)
7. [Testing & Quality Assurance](#7-testing--quality-assurance)
   - [7.1. Backend Pytest Suites](#71-backend-pytest-suites)
   - [7.2. Web TypeScript & Lint Auditing](#72-web-typescript--lint-auditing)
   - [7.3. Mobile TypeScript & Lint Auditing](#73-mobile-typescript--lint-auditing)
8. [Building & Deploying Standalone Mobile APK](#8-building--deploying-standalone-mobile-apk)
   - [8.1. Cloud EAS Build](#81-cloud-eas-build)
   - [8.2. Offline Local Gradle Build](#82-offline-local-gradle-build)
9. [Contribution Guidelines & Git Workflow](#9-contribution-guidelines--git-workflow)
   - [8.1. Branch Naming Conventions](#91-branch-naming-conventions)
   - [8.2. Commit Message Standards](#92-commit-message-standards)
   - [8.3. Pull Request Checklist](#93-pull-request-checklist)
10. [Developer FAQ, Hardware Simulation & Gotchas](#10-developer-faq-hardware-simulation--gotchas)

---

## 1. Architecture Overview & Monorepo Structure

QuickBill is structured as a modular monorepo containing three primary applications sharing common business domain standards:

```text
inventory-bill management system/
├── apps/
│   ├── api/                   # FastAPI Python 3.11+ REST Backend
│   │   ├── app/
│   │   │   ├── api/v1/        # Routers: auth, sales, items, parties, reports, etc.
│   │   │   ├── core/          # Config, security, database lifecycle, middleware
│   │   │   ├── models/        # MongoDB ODM / Document models
│   │   │   ├── repositories/  # Database queries (strictly tenant-scoped)
│   │   │   ├── schemas/       # Pydantic v2 request & response schemas
│   │   │   └── services/      # Business logic: billing engine, stock, reports
│   │   ├── tests/             # Pytest test suites (isolation, billing math)
│   │   ├── Dockerfile         # Multi-stage production container
│   │   └── requirements.txt   # Backend dependencies
│   ├── web/                   # Vite + React 18 + TypeScript Web Admin & POS
│   │   ├── src/
│   │   │   ├── api/           # Axios client with JWT interceptor & tenant headers
│   │   │   ├── components/    # Reusable UI widgets, modals, and scanner dialogs
│   │   │   ├── context/       # Global React Contexts (Auth, Business, Location)
│   │   │   ├── types/         # TypeScript contracts (Invoice, Item, Party, etc.)
│   │   │   └── views/         # Primary views (POS, Inventory, Reports, etc.)
│   │   ├── package.json       # Web dependencies & build scripts
│   │   └── vite.config.ts     # Vite configuration
│   └── mobile/                # React Native 0.86 + Expo 57 Mobile App
│       ├── src/
│       │   ├── components/    # Native components & QRScannerModal (Gun primary)
│       │   ├── screens/       # Mobile screens (POSScreen, ItemsScreen, LoginScreen)
│       │   ├── services/      # MobileStore singleton & API client
│       │   └── theme/         # Color tokens and styling definitions
│       ├── app.json           # Expo project configuration and permissions
│       └── package.json       # Mobile dependencies & EAS build scripts
├── docker/                    # MongoDB initialization scripts and schema indexes
├── docker-compose.yml         # Container orchestrator for local MongoDB and API
├── README.md                  # Master Product Encyclopedia & Use Cases
├── USER_GUIDE.md              # User Manual for Store Cashiers & Managers
└── DEVELOPER_STARTUP_GUIDE.md # This Developer Manual
```

### Technology Matrix

| Layer | Technology | Key Specifications |
| :--- | :--- | :--- |
| **Backend API** | Python 3.11+ / FastAPI | Pydantic v2, Motor (Async MongoDB), PyJWT, Argon2/Passlib, Pytest |
| **Web Console** | React 18, Vite 5, TypeScript | Lucide-React, JsBarcode, html5-qrcode, Vanilla CSS / Tokens |
| **Mobile App** | React Native 0.86, Expo 57 | Expo Camera, Expo Print, Expo Sharing, React Navigation, Axios |
| **Database** | MongoDB 7.0+ | Compound indexes, multi-document ACID transactions, Decimal128 |
| **Containerization** | Docker & Docker Compose | Multi-stage Dockerfile, automated persistence volumes |

---

## 2. Prerequisites & System Setup

Ensure your local machine has the following tools installed:

- **Node.js**: `v20.x` or higher (verify with `node -v`)
- **npm**: `v10.x` or higher (verify with `npm -v`)
- **Python**: `3.11+` recommended (or `3.8+`) (verify with `python --version`)
- **Docker & Docker Compose**: Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- **Git**: Latest release
- *(Optional for Mobile Phone Testing)*: **Expo Go** app on Android or iOS
- *(Optional for Offline Mobile APK Build)*: **Java 17 JDK** and **Android SDK Command-line Tools**

---

## 3. Step-by-Step Local Environment Startup

### 3.1. Database: MongoDB Cluster Setup

QuickBill uses MongoDB for high-throughput, multi-tenant document storage. A complete initialization script (`docker/mongo-init.js`) is provided to set up required collections and compound tenant indexes automatically.

```bash
# 1. Start MongoDB via Docker Compose
docker compose up -d mongodb

# 2. Verify MongoDB container status
docker compose ps

# 3. Check initialization logs
docker compose logs mongodb
```

- **Connection URL**: `mongodb://localhost:27017`
- **Database Name**: `quickbill_db`
- **Admin Username**: `admin`
- **Admin Password**: `secretpassword`
- **Persistence**: Data is saved in the Docker volume `mongo_data`.

*(Optional: If running a local native MongoDB instance, start the `mongod` service on port `27017`).*

---

### 3.2. Backend: FastAPI Python Service (`apps/api`)

The backend REST API handles all business logic, tax calculations, inventory movements, and multi-tenant isolation.

```bash
cd apps/api

# 1. Create a Python virtual environment
python -m venv .venv

# 2. Activate the virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd):
.venv\Scripts\activate.bat
# macOS / Linux:
source .venv/bin/activate

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Create local environment file
cp .env.example .env

# 5. Launch FastAPI development server with hot-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Verifying Backend Health:
- 📖 **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🩺 **Health Readiness Endpoint**: [http://localhost:8000/health/ready](http://localhost:8000/health/ready)
- 📋 **ReDoc Specification**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

> [!NOTE]
> On initial startup, the backend automatically seeds the default Super Administrator account if not already present:
> - **Email**: `superadmin@quickbill.local`
> - **Password**: `superadmin123`

---

### 3.3. Web Frontend: React + Vite Console (`apps/web`)

The Web Console provides the widescreen desktop POS billing desk, inventory master, financial analytics, and store administration.

```bash
cd apps/web

# 1. Install Node dependencies
npm install

# 2. Start Vite development server
npm run dev
```

- 🌐 **Web Console URL**: [http://localhost:3000](http://localhost:3000)
- **Hot Module Replacement (HMR)**: Changes to React components, styles, and hooks reload instantly in the browser.

---

### 3.4. Mobile App: React Native + Expo (`apps/mobile`)

The mobile application runs on iOS and Android smartphones and tablets.

```bash
cd apps/mobile

# 1. Install Node dependencies
npm install

# 2. Start Expo Metro bundler
npx expo start
```

#### Running on Devices:
- **Physical Phone**: Install the **Expo Go** app from Google Play Store or Apple App Store. Scan the QR code displayed in your terminal.
- **Android Emulator**: Press `a` in the terminal (requires Android Studio Emulator running).
- **iOS Simulator**: Press `i` in the terminal (macOS only, requires Xcode).
- **Web Preview**: Press `w` in the terminal to preview mobile screens in your desktop browser.

---

### 3.5. Full-Stack Docker Compose Mode

If you prefer to run both the database and the backend API inside Docker containers simultaneously:

```bash
# Start MongoDB and API together
docker compose up -d

# View live API logs
docker compose logs -f api
```

The API will be available at [http://localhost:8000](http://localhost:8000) and hot-reloads code edits mounted from `./apps/api`.

---

## 4. Environment Configuration Reference

### Backend (`apps/api/.env`)
```env
APP_ENV=development
DEBUG=True
PROJECT_NAME="QuickBill API"
VERSION=1.0.0

# MongoDB Database Connection
MONGODB_URI=mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin
DATABASE_NAME=quickbill_db

# Security & JWT Secrets
JWT_SECRET=development_jwt_secret_key_32_characters_minimum_quickbill_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=30

# Initial SuperAdmin Credentials
SUPERADMIN_EMAIL=superadmin@quickbill.local
SUPERADMIN_PASSWORD=superadmin123
SUPERADMIN_NAME="Super Administrator"

# CORS Allowed Origins
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","http://localhost:8081","https://quick-bill-alpha.vercel.app"]
```

### Web Frontend (`apps/web/.env`)
```env
# Backend API Base URL
VITE_API_BASE_URL=http://localhost:8000/api/v1
# VITE_API_BASE_URL=https://quick-bill-alpha.vercel.app/api/v1

VITE_APP_TITLE="QuickBill Enterprise"
```

### Mobile App (`apps/mobile/.env`)
```env
# Mobile API Target (Defaults to authoritative QuickBill cloud backend)
EXPO_PUBLIC_API_BASE_URL=https://quick-bill-alpha.vercel.app/api/v1
VITE_API_BASE_URL=https://quick-bill-alpha.vercel.app/api/v1
```

---

## 5. Core Architectural Invariants & Patterns

When modifying or contributing code to QuickBill, you must strictly uphold the following 4 engineering invariants:

### 5.1. Multi-Tenant Scoping & Strict 404 Security Guard

Every business on QuickBill is strictly isolated using a tenant identifier (`businessId`).

```python
# Rule: Repositories MUST filter every read, update, and delete by business_id
async def get_item_by_sku(self, business_id: str, sku: str) -> Optional[Item]:
    return await self.collection.find_one({
        "business_id": business_id,
        "sku": sku.strip()
    })
```

> [!CAUTION]
> **Cross-Tenant Security Invariant**: If a user attempts to access an item, invoice, or party ID belonging to a different `businessId`, the API **MUST return an HTTP 404 Not Found** (not 403 Forbidden). A 403 leaks the existence of another tenant's private resource.

---

### 5.2. Server-Authoritative Financial Math

The client application **never** dictates final financial figures. The backend recalculates all item line totals, discounts, taxes, and grand totals upon checkout.

```python
# Formula: Tax-Inclusive Reverse Calculation
taxable_base = round(selling_price / (1 + (gst_rate / 100)), 2)
output_tax = round(selling_price - taxable_base, 2)
cgst = round(output_tax / 2, 2)
sgst = round(output_tax - cgst, 2)
```

- All currency amounts must maintain 2 decimal places using exact monetary representations.
- Round-offs (`roundOffAmount`) are strictly calculated to round grand totals to the nearest whole currency unit without penny drift.

---

### 5.3. Immutable Stock Movement Ledger

Stock counts are **never** blindly overwritten with `UPDATE items SET stock = 50`. Every change must write an audit record to `inventory_movements`:

```python
movement_record = {
    "business_id": business_id,
    "location_id": location_id,
    "item_id": item_id,
    "movement_type": "SALE", # or "RESTOCKABLE_RETURN", "DAMAGE", "SURPLUS", "PURCHASE"
    "quantity_delta": -2.0,
    "previous_stock": 25.0,
    "resulting_stock": 23.0,
    "reference_invoice_id": invoice_id,
    "timestamp": datetime.utcnow()
}
```

---

### 5.4. Hardware Scanner Gun vs. Camera Protocols

1. **Hardware Scanner Gun (Primary)**:
   - When users click `Scan` on SKU Code or Barcode Number fields, the modal **must initialize in `GUN` mode (`initialTab="GUN"`)**.
   - Do **not** request camera access or start video streams on modal open.
   - Physical guns act as an HID keyboard wedge emitting characters in `<60ms` bursts followed by `Enter`.
2. **Camera Viewfinder (Secondary / On-Demand)**:
   - Provide a prominent toggle (`📷 Switch to Camera Scanner`) for phone/tablet operators without a physical gun.
   - Only initialize camera permissions and video streams when the user explicitly clicks the camera tab.

---

## 6. Step-by-Step Guide: Contributing a New Feature

Follow this standard end-to-end flow when introducing a new feature (e.g., adding an "Item Brand" field or new report):

### Step 1: Backend Domain Models & Validation
1. Update Pydantic schemas in `apps/api/app/schemas/`.
2. Ensure fields validate data types, max lengths, and defaults.

### Step 2: Database Repository Scoping
1. Update the repository in `apps/api/app/repositories/`.
2. Always ensure the query filter includes:
   ```python
   query = {"_id": ObjectId(entity_id), "business_id": tenant_context.business_id}
   ```

### Step 3: Service Layer Business Logic
1. Implement business rules in `apps/api/app/services/`.
2. If changing stock or monetary balances, wrap updates inside a MongoDB ACID transaction session (`async with client.start_session() as session:`).

### Step 4: Router & OpenAPI Endpoint
1. Define the endpoint in `apps/api/app/api/v1/`.
2. Enforce authentication dependencies (`current_user = Depends(get_current_active_user)`).
3. Return standard HTTP status codes (`201 Created`, `200 OK`, `404 Not Found`).

### Step 5: Web Frontend Integration
1. Add the TypeScript contract in `apps/web/src/types/`.
2. Update the API client in `apps/web/src/api/`.
3. Add or update the UI component or view in `apps/web/src/views/`.
4. Validate types with `npx tsc --noEmit`.

### Step 6: Mobile Screen Integration
1. Update TypeScript types in `apps/mobile/src/types/`.
2. Update the mobile service in `apps/mobile/src/services/`.
3. Update the mobile screen in `apps/mobile/src/screens/`.
4. Verify layout responsiveness and keyboard avoidance.

---

## 7. Testing & Quality Assurance

Before committing any code or submitting pull requests, run all quality suites across the monorepo:

### 7.1. Backend Pytest Suites

```bash
cd apps/api
source .venv/bin/activate # or .venv\Scripts\activate on Windows

# Run full test suite
pytest -v

# Run multi-tenant isolation security tests
pytest tests/test_multi_tenant_isolation.py -v

# Run billing calculation tests
pytest tests/test_billing_engine.py -v
```

---

### 7.2. Web TypeScript & Lint Auditing

```bash
cd apps/web

# Check TypeScript types across all views and components
npx tsc --noEmit

# Test production bundle build
npm run build
```

---

### 7.3. Mobile TypeScript & Lint Auditing

```bash
cd apps/mobile

# Verify mobile TypeScript compilation
npx tsc --noEmit

# Run unit tests
npm test
```

---

## 8. Building & Deploying Standalone Mobile APK

You can build an installable Android APK file using either EAS Cloud or Local Gradle:

### 8.1. Cloud EAS Build (Fastest — No Android Studio Required)

```bash
cd apps/mobile

# 1. Install EAS CLI globally
npm install -g eas-cli

# 2. Log in with your Expo account
eas login

# 3. Trigger APK build
npm run build:apk
# Or run directly:
eas build --platform android --profile preview
```
*The build output provides a direct `.apk` download link and QR code to install directly on physical phones.*

---

### 8.2. Offline Local Gradle Build (Requires Android SDK & Java 17)

```bash
cd apps/mobile

# 1. Generate the native android directory
npm run prebuild:android

# 2. Compile release APK
# Windows (PowerShell):
cd android; .\gradlew assembleRelease
# macOS / Linux:
cd android && ./gradlew assembleRelease
```
- **Output APK**: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- **Deploy via ADB**:
  ```bash
  adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
  ```

---

## 9. Contribution Guidelines & Git Workflow

### 9.1. Branch Naming Conventions
- `feature/<feature-name>`: New functionality (e.g., `feature/pos-split-payment-upi`).
- `bugfix/<issue-name>`: Bug fixes (e.g., `bugfix/mobile-login-keyboard-avoidance`).
- `perf/<optimization>`: Performance optimizations (e.g., `perf/gstr1-aggregation-index`).
- `docs/<doc-update>`: Documentation enhancements.

### 9.2. Commit Message Standards
We follow Conventional Commits:
```text
feat(pos): add hardware barcode gun priority in add product popup
fix(mobile): resolve keyboard overlap on phone login screen
perf(reports): optimize GSTR-1 aggregation pipeline with compound index
docs(readme): add developer startup guide and real-world use cases
```

### 9.3. Pull Request Checklist
- [ ] Code compiles with `npx tsc --noEmit` on both `apps/web` and `apps/mobile`.
- [ ] Backend tests pass with `pytest -v` on `apps/api`.
- [ ] Every new repository query includes `business_id` in its filter.
- [ ] All financial computations use 2 decimal places.
- [ ] No hardcoded local machine IP addresses in client code.
- [ ] Preserve existing comments and docstrings.

---

## 10. Developer FAQ, Hardware Simulation & Gotchas

#### Q1: "How can I test hardware barcode scanner gun input if I do not own a physical gun?"
- **Answer**: You can simulate a hardware gun in your browser console by pasting and running this snippet:
  ```javascript
  function simulateBarcodeGun(code) {
    let index = 0;
    const interval = setInterval(() => {
      if (index < code.length) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: code[index], bubbles: true }));
        index++;
      } else {
        clearInterval(interval);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    }, 20); // 20ms simulates hardware scanner timing
  }
  // Run in console:
  simulateBarcodeGun('8901234567890');
  ```

#### Q2: "Cannot connect to backend server at localhost:8000 from physical phone."
- **Reason**: On a physical phone, `localhost` points to the phone itself, not your development PC.
- **Solution**: Set `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` to the cloud backend (`https://quick-bill-alpha.vercel.app/api/v1`) or your machine's local Wi-Fi IP (e.g., `http://192.168.1.50:8000/api/v1`).

#### Q3: "Why does the scanner modal open in Gun mode instead of Camera?"
- **Reason**: In retail point-of-sale environments, opening the camera on desktop freezes or takes time to initialize webcam permissions. Hardware scanner guns require zero camera overhead. If you are on a phone without a gun, simply click `📷 Switch to Camera Scanner`.

#### Q4: "MongoDB query is slow on large catalogs."
- **Reason**: Missing compound indexes.
- **Solution**: Ensure your collection has compound indexes on `{ "business_id": 1, "sku": 1 }` and `{ "business_id": 1, "barcode": 1 }`. Run `docker/mongo-init.js` to ensure all indexes exist.

#### Q5: "How do I test Two-Factor Authentication locally?"
- **Solution**: Use any authenticator app (e.g., Google Authenticator) on your phone to scan the QR code rendered in **Settings $\rightarrow$ Security**, or use a desktop CLI tool like `oathtool --totp -b <SECRET_KEY>`.
