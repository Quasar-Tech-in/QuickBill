# QuickBill Café Persona — 01: Current System Audit & Codebase Inspection

## 1. Executive Summary

This document presents a comprehensive, code-level architectural audit of the existing **QuickBill** enterprise platform. QuickBill is a multi-tenant Point of Sale (POS), real-time inventory ledger, GST accounting, and franchise management system built for desktop web and mobile environments. 

The audit evaluates the readiness of the existing codebase to support a dedicated **Café Persona** (table management, QR self-ordering, Kitchen Order Tickets [KOT], and raw ingredient tracking) while guaranteeing zero regressions for retail/wholesale tenants.

---

## 2. Technology Stack & Deployment Topology

| Layer | Technologies & Frameworks | Version / Spec | Primary Locations |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | FastAPI (Python), Starlette, Uvicorn | Python 3.11+, FastAPI 0.110+ | `apps/api/app/main.py` |
| **Async Mongo Driver** | Motor, PyMongo, BSON (ObjectId, Decimal128) | Motor 3.3+, PyMongo 4.6+ | `apps/api/app/core/database.py` |
| **Validation & Schema** | Pydantic v2 (`BaseModel`, `Field`, `BaseSchema`) | Pydantic 2.6+ | `apps/api/app/schemas/` |
| **Auth & Cryptography** | JWT (`pyjwt`), Passlib / bcrypt, PyOTP (TOTP 2FA) | Argon2 / bcrypt | `apps/api/app/core/security.py` |
| **Web Console** | React 18, Vite, TypeScript Strict, React Router v7 | React 18.2, TS 5.3, Vite 5.1 | `apps/web/src/` |
| **Web UI & Icons** | Vanilla CSS Tokens, Lucide React, html5-qrcode, JsBarcode | Lucide 0.363, JsBarcode 3.12 | `apps/web/src/components/` |
| **Mobile App** | React Native, Expo SDK 57, React 19, TypeScript | Expo ~57.0.24, RN 0.86.3 | `apps/mobile/src/` |
| **Mobile Hardware** | Expo Camera, Expo Print, Expo Sharing, SecureStore | Native Expo Modules | `apps/mobile/src/utils/` |
| **Primary Database** | MongoDB 7.0+ (Replica Set / Atlas / Docker) | BSON Spec 19 (Decimal128) | Docker `mongo:7.0` |
| **Containerization** | Docker, Docker Compose, Multi-stage Dockerfiles | Compose v2 | `docker-compose.yml`, `docker/` |

---

## 3. Architecture & Repository Structure

```
inventory-bill-management-system/
├── apps/
│   ├── api/                     # FastAPI Python Backend
│   │   ├── app/
│   │   │   ├── api/v1/          # Modular API Routers (auth, sales, items, staged_orders, etc.)
│   │   │   ├── core/            # Database manager, security, config, TOTP 2FA
│   │   │   ├── repositories/    # Data access layer (ItemRepository, BaseRepository)
│   │   │   ├── schemas/         # Pydantic v2 DTOs (sale, item, inventory, staged_order, etc.)
│   │   │   └── services/        # Business logic (BillingEngine, SaleService, StagedOrderService)
│   │   └── tests/               # Pytest suite (isolation, billing engine, staged orders, etc.)
│   ├── web/                     # React 18 + Vite Web Admin & POS Console
│   │   └── src/
│   │       ├── components/      # UI components (Header, Sidebar, InvoicePrintModal, Barcode)
│   │       ├── hooks/           # Hardware scanner hook (useBarcodeScanner)
│   │       ├── services/        # Store singleton (store.ts), Supabase storage
│   │       ├── types/           # TypeScript contracts (Item, Invoice, StagedOrder, User)
│   │       └── views/           # Views (PosBillingView, InventoryView, TransactionsView, etc.)
│   └── mobile/                  # Expo + React Native Smartphone Application
│       └── src/
│           ├── components/      # Mobile UI & POS camera viewfinders
│           ├── screens/         # Native screens (POSScreen, ItemsScreen, TransactionsScreen)
│           ├── services/        # Mobile store singleton (store.ts)
│           └── utils/           # Thermal print (printInvoice.ts), WhatsApp share (shareInvoice.ts)
├── docker/                      # Deployment configs & MongoDB initialization scripts
└── docs/                        # Architectural documentation & planning artifacts
```

---

## 4. Comprehensive Feature-by-Feature Code Audit

The following table categorizes all existing QuickBill capabilities against production code inspection:

| Capability / Module | Status | Code References (Files & Functions) | Audit Findings & Café Relevance |
| :--- | :---: | :--- | :--- |
| **Multi-Tenant Isolation** | **Implemented** | `apps/api/app/core/database.py` (`MultiTenantDatabaseManager.get_tenant_database`)<br>`apps/api/app/core/security.py` (`get_current_business_id`, `enforce_active_store_operations`) | Dynamic tenant resolution by `businessId`. Supports SHARED, DEDICATED, and CUSTOM MongoDB clusters. Tenant isolation verified by tests. |
| **Multi-Branch Topologies** | **Implemented** | `apps/api/app/api/v1/locations.py`<br>`apps/web/src/components/Header.tsx`<br>`apps/mobile/src/services/store.ts` | Allows branching into multiple physical locations (`locationId`). Stock and pricing can be overridden per branch. |
| **Business Persona Switching** | **Missing** | `apps/api/app/schemas/common.py`<br>`apps/api/app/api/v1/tenants.py` | Currently no persona concept. All tenants run the standard retail POS. Needs `businessPersona: "RETAIL" \| "CAFE"` in `tenants.settings`. |
| **POS Fast Billing Engine** | **Implemented** | `apps/api/app/services/billing_engine.py` (`BillingEngine.calculate`)<br>`apps/web/src/views/PosBillingView.tsx`<br>`apps/mobile/src/screens/POSScreen.tsx` | Highly optimized reverse tax-inclusive calculation, fractional quantities (`allowParts`), line & bill discounts, cash round-off. Completely reusable for café checkout. |
| **Cart Staging / Parked Orders** | **Partially Implemented** | `apps/api/app/api/v1/staged_orders.py`<br>`apps/api/app/services/staged_order_service.py`<br>`apps/web/src/views/PosBillingView.tsx` (`stagedOrders`) | Supports holding carts with labels (`Table 1` to `Table 6` are already quick presets in `PosBillingView.tsx`). However, does not track table statuses, kitchen routing, or customer tokens. |
| **Table Management & Layout** | **Missing** | N/A | No dedicated table entities (`tables` collection), floor sections, capacity, or table state tracking (`AVAILABLE`, `OCCUPIED`, `ORDERING`, `BILLING`, `CLEANING`). |
| **Customer QR Self-Ordering** | **Missing** | N/A | No customer-facing web menu or unauthenticated/session-signed order placement workflow. QR codes exist only for UPI payments and product labels. |
| **Kitchen Order Ticket (KOT)** | **Missing** | N/A | No KOT generation, incremental ticket versioning (KOT 1, KOT 2), kitchen display view, or kitchen slip printing. Bills convert directly from cart to invoice. |
| **Product Master Data** | **Implemented** | `apps/api/app/api/v1/items.py`<br>`apps/api/app/schemas/item.py` (`ItemBase`, `ItemCreate`, `LocationInventorySchema`) | Full SKU, barcode, category, taxes, images, multi-branch overrides, and FIFO lot tracking. |
| **Raw Materials vs. Menu Items** | **Missing** | `apps/api/app/schemas/item.py` | All items are currently treated as sellable retail inventory. Lacks `itemType: "MENU_ITEM" \| "RAW_MATERIAL" \| "PACKAGING"`, recipe/BOM linking, or menu visibility toggles. |
| **Stock Ledger & Audit Trail** | **Implemented** | `apps/api/app/api/v1/inventory.py`<br>`apps/api/app/schemas/inventory.py`<br>`apps/api/app/services/sale_service.py` (`create_sale`) | Immutable movement ledger (`inventory_movements`) tracking `SALE`, `PURCHASE`, `MANUAL_ADJUSTMENT`, `RETURN_RESTOCK`, `DAMAGE`, etc. |
| **Opening / Closing Stock Flow** | **Missing** | `apps/api/app/api/v1/inventory.py` | `openingStock` is only an initial scalar field during item creation. There is no daily opening/closing reconciliation, carry-forward scheduler, or stock variance grid. |
| **Purchase Orders & Inwarding** | **Implemented** | `apps/api/app/api/v1/purchase_orders.py`<br>`apps/web/src/views/PurchaseOrdersView.tsx`<br>`apps/mobile/src/screens/PurchaseOrdersScreen.tsx` | Full PO procurement, partial receipt of goods (GRN), moving weighted average cost (WAC) update, supplier ledger integration. Completely reusable for bulk raw materials. |
| **Role-Based Access Control** | **Implemented** | `apps/api/app/core/security.py`<br>`apps/api/app/api/v1/users.py` (`UserCreateRequest`) | Roles: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `CASHIER`. Lacks `KITCHEN_STAFF` / `CHEF` and `WAITER` / `CAPTAIN` roles. |
| **Invoice Thermal & A4 Printing** | **Implemented** | `apps/web/src/components/InvoicePrintModal.tsx`<br>`apps/mobile/src/utils/printInvoice.ts` | 80mm/58mm thermal receipts and full A4 tax invoices with store branding and GST breakdown. Completely reusable for customer final checkout. |
| **WhatsApp Invoice Delivery** | **Partially Implemented** | `apps/mobile/src/utils/shareInvoice.ts` (`shareInvoiceOnWhatsApp`, `openWhatsAppChat`)<br>`apps/web/src/views/WorkspacePreviewView.tsx` | Mobile has native WhatsApp document sharing and deep-links (`wa.me`). Web UI currently lacks a one-click WhatsApp share button in `InvoicePrintModal.tsx`. Cloud API backend is missing. |
| **Customer CRM & Khata** | **Implemented** | `apps/api/app/api/v1/customers.py`<br>`apps/api/app/api/v1/parties.py`<br>`apps/web/src/views/PartiesView.tsx` | Dual-party ledger, running balances, receivables tracking, customer auto-creation by phone number during checkout. |
| **Promotions & Coupons** | **Partially Implemented** | `apps/api/app/services/billing_engine.py` | Line item and bill-level discounts exist, but there is no coupon code validation engine (`COUPON_CODE`), minimum spend requirements, or campaign management. |
| **Aggregator Integrations** | **Missing** | N/A | No Swiggy/Zomato webhook listeners, order injection pipelines, or external food delivery sync. |
| **Automated Test Coverage** | **Implemented** | `apps/api/tests/` (13 test files, 58+ unit/integration tests) | Covers billing engine math, staged orders, inventory ledger, tenant isolation, and TOTP auth. Frontend tests are currently unconfigured in `apps/web`. |

---

## 5. Analysis of Reusable Assets

QuickBill has solid foundations that can be repurposed directly:

1. **`BillingEngine` (`apps/api/app/services/billing_engine.py`)**: Authoritative calculation of taxes, fractional portions, line discounts, and round-offs. Will compute table totals and final bills without code duplication.
2. **`StagedOrderService` (`apps/api/app/services/staged_order_service.py`)**: Can serve as the architectural basis for **Table Sessions & In-Flight Cart Holding**, needing extensions for table linkage, KOT ticketing, and customer order queues.
3. **`PurchaseOrderService` (`apps/api/app/api/v1/purchase_orders.py`)**: Already tracks moving weighted average cost (WAC), vendor bills, and Goods Receipt Notes (GRN). Directly handles procurement of café raw materials (coffee beans, milk, dairy, syrups).
4. **`InvoicePrintModal` (`apps/web/src/components/InvoicePrintModal.tsx`)**: Reusable for thermal customer invoices and can be adapted into a specialized `KOTPrintModal` for kitchen chits.
5. **Mobile WhatsApp Deep Linking (`apps/mobile/src/utils/shareInvoice.ts`)**: Logic can be ported to the web console for one-click customer WhatsApp invoice sharing.

