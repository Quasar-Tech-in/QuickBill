# QuickBill Café Persona — 02: Requirements & Gap Analysis

## 1. Introduction

This document provides a comprehensive requirement-to-feature matrix comparing what QuickBill currently supports against the explicit requirements of the new **Café Persona**. For every functional domain, it highlights existing capabilities, structural gaps, required changes, and architectural recommendations.

---

## 2. Requirement vs. Feature Gap Matrix

| Domain | Café Persona Requirement | Existing QuickBill State | Gap / Action Needed |
| :--- | :--- | :--- | :--- |
| **Persona & Config** | Tenant must be able to operate as a Café with tailored views, or switch between Retail and Café. | Single retail POS persona hardcoded across all views and API models. | **GAP**: Add `businessPersona: "RETAIL" \| "CAFE"` in `tenants.settings`. Dynamically adapt navigation, dashboard, and POS. |
| **Table Layout** | Create, edit, activate, deactivate physical tables with seating capacity, floor sections, and live state. | No table entity exists in database or UI. | **GAP**: Create `tables` collection and Table Management UI (`/cafe/tables`). |
| **Table State Machine** | Track states: `AVAILABLE`, `OCCUPIED`, `ORDERING`, `BILLING`, `CLEANING`. | Parked carts have only unstructured labels (e.g., `"Table 4"`). | **GAP**: State machine on table documents with automated transitions on order placement, billing, and clearance. |
| **QR Code Generation** | Generate unique, secure QR codes per table encoding tenant, branch, table ID, and session token. | QR codes exist only for UPI payment VPAs and item barcodes. | **GAP**: Add Table QR generator endpoint (`/api/v1/cafe/tables/{id}/qr`) and PDF table standee export. |
| **Customer Digital Menu** | Mobile-responsive, unauthenticated web menu for diners scanning the table QR. | POS menu requires authenticated user JWT with cashier/manager role. | **GAP**: Create lightweight public customer route `/order/:tenantSlug/:tableId` with read-only menu access. |
| **Item Customization** | Support item variants (Size: Regular/Large), modifiers (Oat Milk, Extra Shot), and special kitchen instructions. | Flat items master with only scalar prices and no variant or modifier structures. | **GAP**: Extend item schema with `variants` and `modifiers`. Capture customer line notes. |
| **Customer Cart Submission** | Allow customers to submit orders directly from mobile browsers to the café. | Cart can only be submitted by logged-in cashier via `POST /api/v1/sales`. | **GAP**: Create public order submission endpoint `POST /api/v1/cafe/orders` generating an in-flight table session. |
| **Order Acceptance Queue** | Cashier/Manager dashboard to review, accept, or reject incoming customer orders in real time. | No incoming review queue; sales immediately finalize and commit to invoice. | **GAP**: Create Incoming Orders Queue UI with audio-visual notifications and acceptance workflow. |
| **Kitchen Order Ticket (KOT)** | Generate separate KOTs for kitchen staff with ticket numbers, table ID, items, and notes (NO pricing). | All output formats are financial customer invoices (thermal or A4). | **GAP**: Create `kots` collection, incremental KOT numbering (KOT 1, KOT 2), and thermal kitchen printer layouts. |
| **Incremental Ordering** | Customers or waiters can add more items to an ongoing table session over time. | Invoices cannot be modified to add new items post-creation. | **GAP**: Append new items to active `TableSession`, dispatching delta KOTs (KOT 2, KOT 3) without duplicate billing. |
| **Table Bill Consolidation** | Combine multiple rounds of table orders into a single final tax invoice with tax and discount. | Staged orders can be resumed, but lack multi-round consolidation into one final bill. | **GAP**: Aggregate all accepted session items into `BillingEngine` to generate single final `sales_invoices` record. |
| **Split & Partial Billing** | Support splitting bill equally or by item/seat, and multi-tender payments. | Split payment by payment mode is supported; split by item/seat is not. | **RECOMMENDATION**: MVP retains multi-mode split payment; seat-wise split planned for Release 3. |
| **Raw Materials Classification** | Distinguish raw ingredients (beans, milk, sugar) from finished sellable menu items. | Master catalog treats all items as finished goods with sale prices. | **GAP**: Add `itemType: "MENU_ITEM" \| "RAW_MATERIAL" \| "PACKAGING"`. Prevent raw materials on diner menu. |
| **Daily Opening & Closing Stock** | Morning opening stock entry and evening closing stock physical audit with carry-forward. | Stock is continuous with no daily cycle or shift register. | **GAP**: Create `stock_sessions` collection for daily opening/closing entries and automatic carry-forward. |
| **Stock Variance & Calendar** | Calendar/grid view highlighting days with missing closing stock and calculating variance/loss. | Only raw transaction movements in `inventory_movements` without calendar aggregation. | **GAP**: Develop Stock Audit Grid UI showing expected vs. counted quantities and discrepancy alerts. |
| **Café Roles & Permissions** | Kitchen Display / Chef role, Waiter / Captain role, Manager, Cashier. | Only `TENANT_ADMIN`, `MANAGER`, `CASHIER`, `SUPER_ADMIN`. | **GAP**: Introduce `KITCHEN_STAFF` and `WAITER` roles with restricted endpoint guards. |
| **WhatsApp Invoice Sharing** | Send digital thermal/A4 invoice link to customer via WhatsApp from Web POS. | Fully implemented on mobile app; web console lacks direct share trigger. | **GAP**: Add WhatsApp direct share button in Web `InvoicePrintModal` generating `https://wa.me/` URLs. |
| **Food Aggregators (Swiggy/Zomato)** | Ingest online delivery orders directly into café order stream. | No third-party delivery aggregator connectors. | **GAP**: Design webhook architecture for Zomato / Swiggy Partner APIs (Release 4 dependency). |

---

## 3. Detailed Gap Analysis by Technical Area

### 3.1. Tenant Configuration & Persona Switching
- **Current State**: A tenant document in MongoDB holds general settings (`currency`, `enableRoundOff`, `defaultTaxRate`).
- **Gap**: There is no attribute defining what type of business the tenant operates.
- **Solution**:
  1. Add `settings.businessPersona` (`"RETAIL" | "CAFE" | "HYBRID"`, default: `"RETAIL"`).
  2. Add `settings.cafeConfig` containing:
     - `enableQrOrdering: boolean`
     - `requireOrderApproval: boolean` (Cashier must accept before kitchen gets KOT)
     - `autoPrintKot: boolean`
     - `kotPrinterIp: string | null`
     - `allowCustomerOrderCancellation: boolean`
     - `serviceChargePercent: number` (0.0 to 10.0%)

### 3.2. Table Management & Dynamic QR Codes
- **Current State**: QuickBill has `locations` (physical stores) but zero awareness of internal seating, tables, or zones.
- **Gap**: Tables cannot be visually tracked, occupied, or assigned orders.
- **Solution**:
  1. Dedicated `tables` collection scoped by `{ businessId, locationId }`.
  2. Attributes: `tableNumber`, `label`, `section` (Indoor, Terrace, Balcony), `seatingCapacity`, `qrCodeUrl`, `currentStatus`, `activeSessionId`.
  3. Status progression: `AVAILABLE` $\rightarrow$ `OCCUPIED` $\rightarrow$ `ORDERING` $\rightarrow$ `BILLING` $\rightarrow$ `CLEANING` $\rightarrow$ `AVAILABLE`.

### 3.3. Customer QR Self-Ordering & Security
- **Current State**: All existing API routes require standard JWT authorization headers. Public customers have no mechanism to view menus or place orders.
- **Gap**: Creating full user accounts for walk-in diners adds prohibitive friction and violates data privacy. Unauthenticated endpoints risk malicious orders from outside the café.
- **Solution**:
  1. **Table QR Tokenization**: When a table is generated, create a cryptographically signed HMAC token embedding `businessId`, `locationId`, and `tableId`.
  2. **Geo/Local Protection**:
     - Optional short-lived daily table PIN or dynamic rotating token refreshed by cashier.
     - Cashier approval gateway (`requireOrderApproval = true`) ensures bogus orders can be rejected before entering the kitchen.
  3. Public endpoints:
     - `GET /api/v1/public/cafe/{businessSlug}/menu` (Cached, public read-only).
     - `POST /api/v1/public/cafe/orders` (Validates table token, creates pending session order).

### 3.4. Kitchen Order Ticket (KOT) & Incremental Order Pipeline
- **Current State**: When checkout happens, the cart immediately converts into an immutable `sales_invoices` record and commits inventory decrements.
- **Gap**: In a café, customers order in waves (Starters first, Mains 30 mins later, Coffee at the end). Billing happens only at the end of the dining session.
- **Solution**:
  1. **`TableSession` Model**: Persists the running tab for the table from guest arrival to settlement.
  2. **Incremental KOTs**:
     - Order wave 1: Generates `KOT-001` containing Starter items $\rightarrow$ Sent to kitchen.
     - Order wave 2: Generates `KOT-002` containing Main items $\rightarrow$ Sent to kitchen.
  3. **Settlement**: At checkout, cashier clicks "Settle Table Bill", consolidating all accepted KOT items into a single `sales_invoices` record, deducting inventory, and marking the table `CLEANING`.

### 3.5. Café Inventory & Daily Raw Material Stock Register
- **Current State**: Items are tracked as continuous balances with simple additions or sales decrements.
- **Gap**: Cafés run on perishable raw materials (dairy, fresh produce, coffee beans) requiring daily physical count audits (Opening Stock vs. Closing Stock) to measure spoilage, leakage, and consumption.
- **Solution**:
  1. Master item classification: `itemType: "MENU_ITEM" | "RAW_MATERIAL" | "PACKAGING"`.
  2. Daily Stock Register (`stock_sessions`):
     - Morning: Cashier/Chef records physical Opening Stock (or auto carries forward yesterday's closing stock).
     - Day: Inward purchases (`purchase_orders`) increment stock.
     - Night: Manager enters physical Closing Stock count.
     - Automatic Calculation:
       $$\text{Estimated Consumption} = \text{Opening Stock} + \text{Inward Purchases} - \text{Closing Stock}$$
  3. Missing Entry Indicators: Alert dashboard showing dates with incomplete closing counts.

---

## 4. MVP vs. Future Scope Boundaries

### In Scope for Café MVP (Release 1):
- Persona configuration toggle (`RETAIL` vs `CAFE`).
- Table CRUD, section layouts, and live table status indicators.
- Unique table QR code generation and printable table standee cards.
- Customer mobile-responsive digital menu with categories, veg/non-veg tags, and search.
- Customer mobile cart submission with item special instructions.
- Cashier / Manager incoming order queue with Accept / Reject controls.
- Automatic/Manual KOT generation (KOT 1, KOT 2) and thermal 80mm kitchen ticket printing.
- Bill consolidation from active table session into official QuickBill invoice.
- Existing payment collection (Cash, UPI, Card, Split) and receipt printing.
- Essential RBAC adjustments (`KITCHEN_STAFF` view).

### In Scope for Inventory Enhancements (Release 2):
- Raw materials classification (`itemType`).
- Daily opening and closing stock entry screens.
- Automated carry-forward of closing stock to next day's opening stock.
- Consumption variance calculation and spoilage logging.
- Stock calendar / audit grid with missing entry alerts.

### In Scope for Operational Improvements (Release 3):
- One-click Web WhatsApp invoice sharing.
- Table bill splitting (equal split or custom amount).
- Kitchen Display System (KDS) live web view for paperless kitchens.
- Advanced dish cancellation and kitchen item return audits.

### Future Scope / External Integrations (Release 4):
- Swiggy & Zomato direct POS order ingestion via official partner APIs.
- Bill of Materials (BOM) / ingredient recipe auto-depletion per dish sold.
- Advanced table reservations and deposit booking.

