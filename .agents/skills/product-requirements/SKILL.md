---
name: product-requirements
description: >-
  Provides product domain specifications, core workflows, user personas, MVP vs
  future scope boundaries, and acceptance criteria for the mobile-first billing,
  inventory, and business management application.
---

# Product Requirements & Domain Specifications

## 1. Product Vision & Overview
The system is a **mobile-first billing, inventory, sales, purchase, expense, customer/supplier, and business reporting platform** designed specifically for small and medium retail/wholesale businesses. The primary interface is a high-speed mobile application (Android/iOS) backed by a robust FastAPI REST API and MongoDB.

---

## 2. User Roles & Personas

| Role | Responsibilities | Key Capabilities |
| :--- | :--- | :--- |
| **Business Owner / Admin** | Full business oversight and configuration. | Manage users, view financial reports (P&L, Balance Sheet), set tax rules, configure invoice sequence, manage store profile. |
| **Cashier / Billing Staff** | High-velocity point-of-sale operations. | Create sales invoices, scan item QR codes, process cash/UPI/card payments, create customer records on the fly, share/print receipts. |
| **Inventory / Store Staff** | Product and stock management. | Create/edit items, generate product QR labels, record purchase receipts, perform stock count adjustments, set low-stock alert thresholds. |
| **Accountant / Manager** | Financial auditing and reporting. | Review expense entries, track receivables/payables, audit day-book entries, export CSV/PDF reports, verify party ledgers. |

---

## 3. Scope Boundaries: MVP vs. Future Phases

### In-Scope for MVP (Phase 1–5)
- **Multi-Tenant Architecture**: Strict data isolation per `businessId`.
- **Authentication & RBAC**: JWT login, token refresh, role-based authorization.
- **Master Data**: Items, Categories, Units, Parties (Customers & Suppliers).
- **QR Code Capabilities**: Generate `ITEM:<publicItemId>` QR codes, scan via device camera to populate invoice items.
- **Sales & Billing**: Item lookup, quantity, discounts, tax computation, payment recording, balance tracking, PDF generation/sharing.
- **Purchase Management**: Supplier purchases, inward stock movement, supplier balance updates.
- **Inventory Ledger**: Immutable stock movement audit trail for every addition, sale, return, and manual adjustment.
- **Expense Tracking**: Configurable categories, receipt attachments, cash/bank payment source.
- **Financial & Business Reports**: Dashboard summaries, Sales/Purchase reports, Stock summary & valuation, Party statements, Basic Profit & Loss, simplified Balance Sheet.

### Out-of-Scope for MVP (Deferred to Phase 6+)
- Public e-commerce / online customer storefront.
- Statutory GST E-Way bill & automatic GSTR filing integrations.
- Multi-warehouse stock transfers.
- Customer loyalty/points program.
- Direct payment gateway merchant settlement webhooks.

---

## 4. Critical Business Workflows

### 4.1. Fast Mobile Billing Workflow
1. Cashier taps **New Sale** from Home or Navigation.
2. Selects existing customer or quickly enters Name + Phone for a new customer.
3. Adds items via:
   - **Camera QR Scanner** (instant lookup via `ITEM:<publicItemId>`).
   - Incremental scanning: Scanning the same QR again increments item quantity.
   - Text search / category catalog.
4. Item-level and invoice-level discounts applied (with validation rules).
5. Tax/GST rates automatically computed on taxable subtotal.
6. Cashier selects payment mode (Cash, UPI, Card, Bank, Credit/Due) and enters amount received.
7. Backend validates stock, creates invoice, updates party ledger, decrements stock via `inventory_movements`, and returns finalized invoice.
8. Instant invoice PDF preview with WhatsApp/Share sheet trigger.

### 4.2. Purchase & Inward Stock Workflow
1. Select Supplier party.
2. Scan or select items; enter purchase price and batch/quantity received.
3. Enter supplier invoice reference number.
4. Save transaction: Stock increases immediately via ledger, supplier payable balance updates.

---

## 5. Domain Rules & Invariants

1. **Server Authoritative**: The client NEVER directly writes stock levels or sets final invoice totals. The API recalculates all subtotals, taxes, discounts, and balances.
2. **Immutable Transaction History**: Once an invoice or payment is posted, it cannot be silently modified or deleted. Modifications require explicit credit notes, debit notes, or cancellation entries.
3. **Monetary Precision**: All currency values must be represented with exact decimal precision (e.g., Decimal128 in MongoDB, integer cents/paise, or Python `Decimal`), never IEEE-754 floating point.
4. **Tenant Isolation**: Every database read and write must be explicitly qualified by `businessId`.

---

## 6. Acceptance Criteria Checklist

- [ ] Can complete a sale in under 15 seconds using camera QR scanning.
- [ ] Product QR codes contain only safe opaque identifiers (`ITEM:<publicItemId>`).
- [ ] Stock count decreases immediately upon invoice creation and logs an inventory movement record.
- [ ] Partial payments update party balance due accurately.
- [ ] Cross-tenant access attempts return 403/404 without leaking data existence.
