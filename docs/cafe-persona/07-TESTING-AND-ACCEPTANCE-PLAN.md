# QuickBill Café Persona — 07: Testing Strategy & Acceptance Plan

## 1. Testing Philosophy & Quality Guardrails

The QA strategy enforces strict zero-regression criteria: **under no circumstance should the implementation of café tables, digital menus, or KOTs impact existing retail billing, inventory movements, or multi-tenant database isolation.**

---

## 2. Test Architecture & Frameworks

| Test Layer | Framework / Tool | Target Modules | Execution Frequency |
| :--- | :--- | :--- | :--- |
| **Backend Unit Tests** | `pytest`, `pytest-asyncio` | `BillingEngine`, HMAC signing, KOT numbering | Every commit / PR |
| **API Integration Tests** | `httpx.AsyncClient` | Table CRUD, public ordering, cashier queue, KOTs | CI pipeline |
| **Multi-Tenant Isolation** | Custom Pytest suite | Scoped collections (`tables`, `table_sessions`, `kots`) | CI pipeline |
| **Concurrency & ACID** | Parallel `asyncio.gather` | Race conditions on table session settlement & cart edits | Pre-release |
| **Retail Regression** | Existing tests (`apps/api/tests/`) | Sales returns, PO inwarding, parked carts, TOTP | Pre-release |
| **E2E Customer Simulation** | Playwright / Vitest | QR scan $\rightarrow$ Menu load $\rightarrow$ Cart submit $\rightarrow$ KOT | Release testing |

---

## 3. Detailed Test Suites

### 3.1. Café MVP Integration Test Suite (`test_cafe_mvp.py`)

#### Test Cases:
1. `test_table_crud_and_tenant_isolation`:
   - Tenant A creates Table `T-01` in "Indoor AC".
   - Tenant B lists tables $\rightarrow$ confirms `T-01` is not visible.
   - Verify unique constraint prevents duplicate `T-01` in Tenant A's same location.
2. `test_qr_token_signing_and_validation`:
   - Generate QR code for Table `T-04`.
   - Verify valid HMAC signature resolves table metadata.
   - Verify tampered `tableId` or invalid signature yields `403 Forbidden`.
3. `test_public_digital_menu_filtering`:
   - Create 1 `MENU_ITEM` (Cappuccino) and 1 `RAW_MATERIAL` (Fresh Milk).
   - Fetch public menu $\rightarrow$ Cappuccino is returned; Fresh Milk is excluded.
4. `test_customer_order_submission_to_cashier_queue`:
   - Customer submits cart via `POST /api/v1/public/cafe/orders`.
   - Order enters `SUBMITTED` state in table session.
   - Cashier polling `/api/v1/cafe/sessions/active` receives new pending order.
5. `test_order_acceptance_and_kot_generation`:
   - Cashier accepts order $\rightarrow$ state becomes `ACCEPTED`.
   - Verifies `kots` collection has `KOT-001` with correct item snapshots and notes.
6. `test_incremental_kot_round_two`:
   - Customer submits Round 2 (1 Brownie) $\rightarrow$ Cashier accepts.
   - Verifies new `KOT-002` contains only the Brownie, not the previously prepared items.
7. `test_table_bill_settlement_and_invoice_creation`:
   - Cashier settles table bill via `POST /api/v1/cafe/sessions/{id}/settle`.
   - Verifies single `sales_invoices` record generated containing all Round 1 + Round 2 items.
   - Verifies `inventory_movements` ledger decrements stock.
   - Verifies table transitions to `CLEANING` and session is closed.

---

### 3.2. Concurrency & Race Condition Scenarios

#### Scenario 1: Simultaneous Ordering by Multiple Diners at Same Table
- **Setup**: Two guests seated at Table `T-04` scan the QR code and submit different carts at the exact same millisecond.
- **Expected Behavior**: Both carts append as separate order rounds (`ord_round_1`, `ord_round_2`) inside the same atomic `table_sessions` document using MongoDB `$push`. Neither order is lost or overwritten.

#### Scenario 2: Customer Submits Item While Cashier is Settling Bill
- **Setup**: Customer taps "Place Order" at the moment cashier clicks "Confirm Payment & Print Bill".
- **Expected Behavior**: The settlement transaction locks the table session (`sessionStatus: BILLING`). The late order submission is rejected with: *"Table bill is currently being settled. Please ask your cashier to reopen the bill or place order at counter."*

---

### 3.3. Retail Regression Suite (Zero Breakage Guarantee)

The following existing test suites in `apps/api/tests/` must pass with $100\%$ success rate:

```bash
# Run existing authoritative test suites
pytest apps/api/tests/test_billing_engine.py
pytest apps/api/tests/test_multi_tenant_isolation.py
pytest apps/api/tests/test_staged_orders_api.py
pytest apps/api/tests/test_inventory_and_supplier_ledger.py
pytest apps/api/tests/test_sale_return_flow.py
pytest apps/api/tests/test_purchase_orders_api.py
```

---

## 4. Acceptance Criteria Checklist

### Release 1 – Café MVP Acceptance
- [ ] Tenant persona toggle works seamlessly in store settings.
- [ ] Tables can be created, updated, and rendered in floor section tabs.
- [ ] QR code export produces high-resolution, printable table cards.
- [ ] Public customer menu loads on mobile browsers in $<1.5$ seconds.
- [ ] Customer order submission alerts the cashier dashboard with visual badge and audio chime.
- [ ] Cashier can accept orders, instantly generating `KOT-001`.
- [ ] Subsequent orders at the same table generate incremental KOTs (`KOT-002`).
- [ ] Final bill settlement consolidates all rounds into an official tax invoice.
- [ ] All existing retail tests pass without modification.

### Release 2 – Inventory Enhancements Acceptance
- [ ] Raw materials cannot be viewed or purchased from customer digital menus.
- [ ] Morning opening stock carries forward yesterday's closing stock count.
- [ ] Evening closing count computes exact variance and monetary loss.
- [ ] Calendar grid flags missing audit dates.

### Release 3 – Operational Improvements Acceptance
- [ ] Web POS has a 1-click "Share on WhatsApp" button generating pre-filled customer links.
- [ ] Kitchen staff can toggle orders on tablet KDS view.
- [ ] Tables can be split among multiple payers.

