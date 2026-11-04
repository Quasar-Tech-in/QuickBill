# QuickBill Café Persona — 09: Granular Developer Task Checklist

This checklist provides atomic, actionable engineering tasks for implementing the Café Persona across the QuickBill codebase. Every task defines its exact requirements, code references, schema changes, testing rules, and rollback procedures.

---

## Release 1: Café MVP (Core Dine-In & KOT)

### Task R1-BE-01: Tenant Persona & Café Config Schema Extension
- **Requirement**: Allow tenant stores to configure their persona as `RETAIL` or `CAFE`.
- **Existing Code Reference**: `apps/api/app/schemas/common.py`, `apps/api/app/api/v1/tenants.py` (`TenantResponse`, `TenantUpdateRequest`).
- **Files to Change**: 
  - `apps/api/app/schemas/common.py`
  - `apps/api/app/api/v1/tenants.py`
- **Database Changes**: Add `settings.businessPersona` and `settings.cafeConfig` to `tenants` collection.
- **Backend Changes**: Update Pydantic models to accept and serialize `businessPersona` (`RETAIL` | `CAFE`).
- **Frontend Changes**: Add Business Persona dropdown in store Settings (`SettingsView.tsx`).
- **Dependencies**: None.
- **Complexity & Effort**: Low (0.5 Days).
- **Test Cases**: `test_tenant_persona_update()`, verify default is `RETAIL` for existing tenants.
- **Acceptance Criteria**: Existing stores default to `RETAIL`; updating to `CAFE` persists and returns in `/tenants/current`.
- **Rollback**: Remove the fields from projection or set default fallback to `RETAIL`.

---

### Task R1-BE-02: Table Management Model & CRUD Endpoints
- **Requirement**: Create, view, update, and soft-delete café dining tables.
- **Existing Code Reference**: `apps/api/app/api/v1/locations.py` (pattern for location-scoped entities).
- **Files to Change**:
  - `apps/api/app/schemas/cafe.py` [NEW]
  - `apps/api/app/api/v1/cafe_tables.py` [NEW]
  - `apps/api/app/main.py` (register router)
- **Database Changes**: New `tables` collection with index `{ businessId: 1, locationId: 1, tableNumber: 1 }`.
- **Backend Changes**: Implement `GET /api/v1/cafe/tables`, `POST /api/v1/cafe/tables`, `PUT /api/v1/cafe/tables/{id}`, `DELETE /api/v1/cafe/tables/{id}`.
- **Frontend Changes**: Table Management UI (`TableManagementView.tsx`).
- **Dependencies**: R1-BE-01.
- **Complexity & Effort**: Medium (1.0 Day).
- **Test Cases**: Create table, verify duplicate tableNumber in same branch returns 409 Conflict, verify tenant isolation.
- **Acceptance Criteria**: Admin/Manager can create tables with number, capacity, and section.
- **Rollback**: Drop router from `main.py`.

---

### Task R1-BE-03: Signed QR Code Generation for Tables
- **Requirement**: Generate unique QR code URL and image for each café table.
- **Existing Code Reference**: `apps/api/app/services/label_service.py` (barcode/QR generation patterns).
- **Files to Change**:
  - `apps/api/app/services/cafe_session_service.py` [NEW]
  - `apps/api/app/api/v1/cafe_tables.py`
- **Database Changes**: Store `qrCodeSecret` and `qrCodeUrl` on table document.
- **Backend Changes**: Implement HMAC-SHA256 signature algorithm embedding `businessId`, `locationId`, and `tableId`.
- **Frontend Changes**: Display QR modal and printable SVG in table list.
- **Dependencies**: R1-BE-02.
- **Complexity & Effort**: Low (0.5 Days).
- **Test Cases**: Verify QR token decodes and matches table; verify expired or tampered token fails.
- **Acceptance Criteria**: Table QR code can be scanned by smartphone camera and opens digital menu link.
- **Rollback**: Revert endpoint in `cafe_tables.py`.

---

### Task R1-BE-04: Public Digital Menu & Customer Order API
- **Requirement**: Allow unauthenticated walk-in diners to view active menu and submit orders.
- **Existing Code Reference**: `apps/api/app/api/v1/items.py` (`list_items`).
- **Files to Change**:
  - `apps/api/app/api/v1/cafe_public.py` [NEW]
  - `apps/api/app/main.py`
- **Database Changes**: Read-only query on `items` collection filtering `isActive: true` and `isCustomerVisible: true`.
- **Backend Changes**:
  - `GET /api/v1/public/cafe/{businessSlug}/menu`
  - `POST /api/v1/public/cafe/orders` (validates QR token, appends order to table session)
- **Frontend Changes**: Customer digital menu web views (`DigitalMenuPage.tsx`).
- **Dependencies**: R1-BE-03.
- **Complexity & Effort**: High (1.5 Days).
- **Test Cases**: Public menu filters out raw materials; order submission requires valid table token.
- **Acceptance Criteria**: Customer submits cart with variants and item notes; table status updates to `ORDERING`.
- **Rollback**: Remove public router.

---

### Task R1-BE-05: Table Session & Kitchen Order Ticket (KOT) Engine
- **Requirement**: Maintain multi-round table sessions and generate incremental KOTs for the kitchen.
- **Existing Code Reference**: `apps/api/app/services/staged_order_service.py`.
- **Files to Change**:
  - `apps/api/app/services/cafe_session_service.py` [NEW]
  - `apps/api/app/api/v1/cafe_sessions.py` [NEW]
- **Database Changes**: New `table_sessions` and `kots` collections.
- **Backend Changes**:
  - Cashier order approval: `POST /api/v1/cafe/sessions/{id}/orders/{orderId}/accept` $\rightarrow$ generates `KOT-001`.
  - Cashier order rejection: `POST /api/v1/cafe/sessions/{id}/orders/{orderId}/reject`.
  - Incremental KOT logic: subsequent orders generate `KOT-002` containing only delta items.
- **Frontend Changes**: Cashier Incoming Queue and Kitchen Orders View.
- **Dependencies**: R1-BE-04.
- **Complexity & Effort**: High (2.0 Days).
- **Test Cases**: Verify order approval creates KOT document; verify round 2 creates separate KOT with only new items.
- **Acceptance Criteria**: Kitchen gets clear slip with table #, KOT #, and items without financial pricing.
- **Rollback**: Drop `cafe_sessions` router.

---

### Task R1-BE-06: Table Bill Consolidation & Settle Endpoint
- **Requirement**: Consolidate all accepted table rounds into an official tax invoice.
- **Existing Code Reference**: `apps/api/app/services/billing_engine.py`, `apps/api/app/services/sale_service.py`.
- **Files to Change**:
  - `apps/api/app/api/v1/cafe_sessions.py`
  - `apps/api/app/services/sale_service.py`
- **Database Changes**: Writes to existing `sales_invoices` and `inventory_movements` collections.
- **Backend Changes**: `POST /api/v1/cafe/sessions/{id}/settle` executes MongoDB ACID transaction: computes totals via `BillingEngine`, saves invoice, decrements inventory, closes session, and sets table to `CLEANING`.
- **Frontend Changes**: Table card "Settle Bill" button and payment collection modal.
- **Dependencies**: R1-BE-05.
- **Complexity & Effort**: Medium (1.0 Day).
- **Test Cases**: Verify stock decrements, tax amounts match, session marks SETTLED, and table marks CLEANING.
- **Acceptance Criteria**: Final tax invoice matches standard QuickBill invoice and appears in `/invoices`.
- **Rollback**: Normal transaction abort on failure.

---

### Task R1-FE-01: Navigation & Persona Switcher Integration
- **Requirement**: Display café-specific navigation items when tenant persona is `CAFE`.
- **Existing Code Reference**: `apps/web/src/components/Sidebar.tsx`, `Header.tsx`.
- **Files to Change**:
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/src/App.tsx`
- **Dependencies**: R1-BE-01.
- **Complexity & Effort**: Low (0.5 Days).
- **Acceptance Criteria**: Retail tenants see standard sidebar; Café tenants see Café Dashboard, Tables, Kitchen, and Incoming Orders.

---

### Task R1-FE-02: Café Dashboard & Floor Plan View
- **Requirement**: Render interactive floor plan showing table cards with live statuses, elapsed timers, and subtotals.
- **Existing Code Reference**: `apps/web/src/views/DashboardView.tsx`, `PosBillingView.tsx`.
- **Files to Change**:
  - `apps/web/src/views/CafeDashboardView.tsx` [NEW]
  - `apps/web/src/components/cafe/TableCard.tsx` [NEW]
- **Dependencies**: R1-BE-02, R1-BE-05.
- **Complexity & Effort**: High (2.0 Days).
- **Acceptance Criteria**: Table cards reflect live states; clicking table opens session drawer; section tabs filter tables.

---

### Task R1-FE-03: Table Management & Standee Export Screen
- **Requirement**: Table creation, section editing, and printable QR standee generation.
- **Files to Change**: `apps/web/src/views/TableManagementView.tsx` [NEW].
- **Dependencies**: R1-BE-02, R1-BE-03.
- **Complexity & Effort**: Medium (1.0 Day).
- **Acceptance Criteria**: High-res QR standees exportable to PDF and printable.

---

### Task R1-FE-04: Incoming Orders Queue with Audio Alerts
- **Requirement**: Cashier queue for accepting or rejecting customer QR orders.
- **Existing Code Reference**: `apps/web/src/utils/audio.ts` (`playScanSuccess`).
- **Files to Change**:
  - `apps/web/src/views/IncomingOrdersView.tsx` [NEW]
  - `apps/web/src/components/cafe/IncomingOrderCard.tsx` [NEW]
- **Dependencies**: R1-BE-05.
- **Complexity & Effort**: Medium (1.0 Day).
- **Acceptance Criteria**: Real-time polling updates order count; gentle audio alert fires on new order; Accept/Reject buttons dispatch API.

---

### Task R1-FE-05: Thermal 80mm KOT Print Modal
- **Requirement**: Preview and print 80mm kitchen order ticket slips.
- **Existing Code Reference**: `apps/web/src/components/InvoicePrintModal.tsx`.
- **Files to Change**: `apps/web/src/components/cafe/KOTPrintModal.tsx` [NEW].
- **Dependencies**: R1-BE-05.
- **Complexity & Effort**: Medium (1.0 Day).
- **Acceptance Criteria**: Clean thermal chit formatted with Table #, KOT #, server name, items, and special instructions. Excludes monetary totals.

---

### Task R1-FE-06: Customer Digital Menu & Mobile Ordering Page
- **Requirement**: Lightweight, responsive public menu for smartphones.
- **Files to Change**:
  - `apps/web/src/customer/DigitalMenuPage.tsx` [NEW]
  - `apps/web/src/customer/CustomerCartDrawer.tsx` [NEW]
- **Dependencies**: R1-BE-04.
- **Complexity & Effort**: High (2.5 Days).
- **Acceptance Criteria**: Mobile menu loads $<1.5$s; allows item customization, veg/non-veg filtering, and cart submission.

---

## Release 2: Inventory Enhancements (Raw Materials & Stock Register)

### Task R2-BE-01: Item Master Classification (`itemType`)
- **Requirement**: Classify items into `MENU_ITEM`, `RAW_MATERIAL`, and `PACKAGING`.
- **Files to Change**: `apps/api/app/schemas/item.py`, `apps/api/app/api/v1/items.py`.
- **Database Changes**: Add `itemType: str` and `isCustomerVisible: bool` to `items` collection.
- **Complexity & Effort**: Medium (1.0 Day).
- **Acceptance Criteria**: Raw materials excluded from customer-facing menus.

---

### Task R2-BE-02: Daily Stock Register Collection & Endpoints
- **Requirement**: Track morning opening stock and evening physical closing stock.
- **Files to Change**: `apps/api/app/api/v1/cafe_inventory.py` [NEW].
- **Database Changes**: New `stock_sessions` collection.
- **Complexity & Effort**: Medium (1.5 Days).
- **Acceptance Criteria**: Records physical closing count and computes exact variance.

---

### Task R2-BE-03: Automated Carry-Forward Logic
- **Requirement**: Auto-populate morning opening stock from yesterday's closing stock.
- **Files to Change**: `apps/api/app/services/stock_session_service.py` [NEW].
- **Complexity & Effort**: Medium (1.0 Day).
- **Acceptance Criteria**: If yesterday's closing was 10.5L milk, today's default opening is 10.5L milk.

---

### Task R2-FE-01: Daily Stock Register Entry View & Calendar Grid
- **Files to Change**: 
  - `apps/web/src/views/StockRegisterView.tsx` [NEW]
  - `apps/web/src/components/cafe/StockCalendarGrid.tsx` [NEW]
- **Complexity & Effort**: High (3.0 Days).
- **Acceptance Criteria**: Staff can enter opening and closing counts; calendar highlights incomplete audit days in red.

---

## Release 3: Operational Improvements

### Task R3-FE-01: One-Click Web WhatsApp Invoice Share
- **Files to Change**: `apps/web/src/components/InvoicePrintModal.tsx`.
- **Complexity & Effort**: Low (0.5 Days).
- **Acceptance Criteria**: Click opens `https://wa.me/{phone}` with formatted receipt text and invoice link.

### Task R3-FE-02: Kitchen Display System (KDS) Live View
- **Files to Change**: `apps/web/src/views/KitchenOrdersView.tsx` [NEW].
- **Complexity & Effort**: High (2.0 Days).
- **Acceptance Criteria**: Paperless tablet view for chefs to view and mark orders "Ready".

### Task R3-BE-01: Table Bill Splitting Logic
- **Files to Change**: `apps/api/app/services/cafe_session_service.py`.
- **Complexity & Effort**: Medium (1.5 Days).
- **Acceptance Criteria**: Allows splitting a table tab equally among $N$ guests with separate payment vouchers.

---

## Release 4: External Integrations (Swiggy, Zomato & Recipes)

### Task R4-INT-01: Swiggy / Zomato Partner Webhook Ingestion
- **Files to Change**: `apps/api/app/api/v1/integrations/aggregators.py` [NEW].
- **Complexity & Effort**: High (3.0 Days).
- **Acceptance Criteria**: Online delivery orders auto-injected into KOT stream with duplicate protection.

### Task R4-INT-02: Bill of Materials (BOM) Recipe Engine
- **Files to Change**: `apps/api/app/services/recipe_engine.py` [NEW].
- **Complexity & Effort**: High (3.5 Days).
- **Acceptance Criteria**: Selling 1 Cappuccino automatically auto-depletes 200ml milk and 18g coffee beans from raw inventory.

