# Mobile Billing, Inventory & Business Management App

## Product Overview and Build Specification

**Document purpose:** Define the product, architecture, modules, data
model, APIs, mobile requirements, QR workflows, security, delivery
phases, and Antigravity skills needed to build a mobile-first business
billing application

------------------------------------------------------------------------

## 1. Product Vision

Build a **mobile-first billing, inventory, sales, purchase, expense,
customer/supplier, and business reporting application** for small and
medium businesses.

The application should let a shop owner perform the majority of daily
operations directly from a phone:

-   Create sales invoices quickly.
-   Add or scan products during billing.
-   Generate QR codes for products/items.
-   Scan QR codes using the mobile camera.
-   Track stock automatically.
-   Record purchases and expenses.
-   Maintain customer and supplier balances.
-   Track money received and money paid.
-   View transaction history.
-   View Profit & Loss and Balance Sheet summaries.
-   Search and filter business records.
-   Share/download invoices.
-   Manage business/store information.
-   Eventually support an online store/catalog.

The backend database will be **MongoDB**.

------------------------------------------------------------------------

## 2. Primary Users

### Business Owner / Admin

Has complete access to the business, users, products, billing,
purchases, expenses, reports, and configuration.

### Cashier / Billing Staff

Creates invoices, scans items, accepts payments, finds customers, and
views permitted sales information.

### Inventory / Store Staff

Creates and updates products, generates QR codes, records stock
movements, and performs stock adjustments.

### Accountant / Manager

Reviews transactions, expenses, receivables, payables, Profit & Loss,
Balance Sheet, and reports.

A user may belong to one or more businesses in the future, so the system
should be designed as **multi-tenant from the beginning**.

------------------------------------------------------------------------

## 3. Core Navigation

A simple mobile navigation structure is recommended:

1.  **Home**
2.  **Transactions**
3.  **New Transaction**
4.  **Items**
5.  **Reports**
6.  **More / Business Settings**

The Home dashboard should provide quick actions for the most frequent
tasks.

------------------------------------------------------------------------

## 4. Home Dashboard

The dashboard should show a concise view of the business.

### Suggested cards

-   Total Sales
-   Total Purchases
-   Money In
-   Money Out
-   Receivables
-   Payables
-   Cash / Bank Balance
-   Low Stock Items
-   Total Orders
-   Total Customers

### Quick actions

-   New Sale
-   New Purchase
-   Add Expense
-   Payment In
-   Payment Out
-   Add Item
-   Scan QR
-   Add Customer
-   Reports

The dashboard should support date filters such as:

-   Today
-   Yesterday
-   This Week
-   This Month
-   Custom Range

------------------------------------------------------------------------

## 5. Transaction Management

The application should maintain a unified transaction history.

### Transaction types

-   Sale
-   Sale Return
-   Purchase
-   Purchase Return
-   Payment In
-   Payment Out
-   Expense
-   Stock Adjustment
-   Opening Balance
-   Credit Note / Debit Note, if introduced later

### Transaction List

Each transaction should contain:

-   Transaction number
-   Transaction type
-   Party/customer/supplier
-   Date and time
-   Total amount
-   Amount paid
-   Balance due
-   Payment status
-   Payment mode
-   Created by
-   Business/store
-   Notes
-   Optional attachment
-   Reference number

### Filters

-   Date range
-   Transaction type
-   Customer/supplier
-   Payment status
-   Payment mode
-   User/cashier
-   Amount range

------------------------------------------------------------------------

## 6. Sales & Billing

Sales billing is one of the most important workflows and should require
very few taps.

### New Sale flow

1.  Tap **New Sale**.
2.  Select an existing customer or create a new customer.
3.  Add products by:
    -   searching,
    -   browsing items,
    -   scanning a QR code,
    -   scanning a barcode if enabled.
4.  Set quantity.
5.  Apply item-level discount if allowed.
6.  Apply invoice-level discount if allowed.
7.  Apply tax/GST rules.
8.  Add shipping/other charges if applicable.
9.  Select payment mode.
10. Enter paid amount.
11. Calculate balance/credit automatically.
12. Save invoice.
13. Reduce stock.
14. Create accounting/payment entries.
15. Generate invoice PDF.
16. Show options to print/share/download.

### Invoice fields

-   Invoice number
-   Invoice date
-   Customer
-   Billing address
-   Shipping address
-   Customer phone/email
-   Item
-   SKU
-   QR/product code
-   Quantity
-   Unit
-   Unit price
-   Discount
-   Tax
-   Line total
-   Subtotal
-   Additional charges
-   Round-off
-   Grand total
-   Paid amount
-   Balance due
-   Payment method
-   Notes
-   Terms
-   Business details

### Invoice numbering

Invoice numbering must be configurable per business, for example:

`INV-2026-000001`

The sequence must be generated safely on the server to prevent duplicate
invoice numbers.

------------------------------------------------------------------------

## 7. QR Code Capability

QR support should be a first-class mobile capability rather than an
add-on.

### Product QR generation

Each item should have a unique immutable internal identifier. A QR code
can encode a safe application identifier such as:

`ITEM:<publicItemId>`

Do **not** expose MongoDB internal IDs or sensitive business information
directly in the QR payload.

### QR generation workflow

1.  Create or edit item.
2.  System generates `publicItemId`.
3.  Generate QR code.
4.  Display QR.
5.  Save QR as an image/PDF label.
6.  Print/share label if required.

### QR scanning during billing

1.  Cashier opens New Sale.
2.  Tap **Scan Item**.
3.  Mobile camera opens.
4.  Scan QR.
5.  App validates the code.
6.  Product is retrieved.
7.  Product is added to the invoice.
8.  Re-scanning the same item increments quantity.
9.  Current stock is displayed.
10. Out-of-stock rules are enforced.

### Other QR use cases

Later versions can support:

-   Invoice QR
-   Customer QR
-   Order pickup QR
-   Payment QR
-   Stock count QR
-   Warehouse/bin QR

QR scanning should use the device camera and work efficiently on Android
and iOS.

------------------------------------------------------------------------

## 8. Item & Inventory Management

### Item master

Each item should support:

-   Item name
-   Description
-   SKU
-   Public item ID
-   QR code
-   Optional barcode
-   Category
-   Unit
-   Purchase price
-   Sale price
-   Wholesale price, optional
-   Tax rate
-   Opening stock
-   Current stock
-   Minimum stock level
-   Location
-   Supplier
-   Image
-   Active/inactive status

### Stock movement

Stock should **not** be maintained only by directly changing a quantity
field.

Every stock change should create an inventory movement:

-   Opening stock
-   Purchase
-   Sale
-   Sale return
-   Purchase return
-   Manual adjustment
-   Damaged stock
-   Transfer, future

This creates an auditable inventory ledger.

### Stock alerts

Generate warnings for:

-   Low stock
-   Out of stock
-   Negative stock
-   Unusual manual adjustment

------------------------------------------------------------------------

## 9. Purchase Management

### Purchase workflow

1.  Select supplier.
2.  Add items manually or by QR scan.
3.  Enter quantity and purchase price.
4.  Apply taxes/discounts.
5.  Enter supplier invoice number.
6.  Choose payment status.
7.  Save.
8.  Increase stock.
9.  Update supplier payable.
10. Create transaction/payment records.

Support:

-   Paid
-   Partially Paid
-   Unpaid/Credit

------------------------------------------------------------------------

## 10. Expense Management

Users should be able to record business expenses.

### Expense fields

-   Expense category
-   Amount
-   Date
-   Payment account
-   Vendor/payee
-   Description
-   Attachment/receipt
-   Tax, if applicable
-   Created by

### Example categories

-   Rent
-   Salary
-   Electricity
-   Transport
-   Packaging
-   Marketing
-   Office supplies
-   Maintenance
-   Miscellaneous

Expense categories must be configurable.

------------------------------------------------------------------------

## 11. Parties: Customers & Suppliers

Use a unified **Party** model where a party can be:

-   Customer
-   Supplier
-   Both

### Party fields

-   Name
-   Phone
-   Email
-   Billing address
-   Shipping address
-   Tax/GST number
-   Opening balance
-   Credit limit
-   Notes
-   Tags
-   Current receivable/payable

### Party ledger

Show:

-   Sales
-   Purchases
-   Payments
-   Returns
-   Opening balance
-   Running balance

------------------------------------------------------------------------

## 12. Payment Management

Support:

-   Cash
-   UPI
-   Card
-   Bank Transfer
-   Cheque
-   Wallet
-   Custom payment mode

Separate payment records from invoices so that one invoice can have
multiple payments.

### Payment In

Used for money received from a customer.

### Payment Out

Used for money paid to a supplier or another payable party.

------------------------------------------------------------------------

## 13. Reports

The supplied workflow demonstrates reporting as a major part of the
product. The new app should provide reports such as:

### Business reports

-   Sales Report
-   Purchase Report
-   Expense Report
-   Transaction Report
-   Day Book
-   Cash Flow
-   Profit & Loss
-   Balance Sheet

### Party reports

-   Party Statement
-   Receivables
-   Payables
-   Customer Sales
-   Supplier Purchases

### Inventory reports

-   Stock Summary
-   Stock Detail
-   Low Stock
-   Item Sales
-   Item Purchase
-   Stock Movement
-   Inventory Valuation

### Tax reports

If Indian GST support is included:

-   Tax Summary
-   GST Sales
-   GST Purchases
-   HSN/SAC Summary
-   GSTR-oriented exports in a later phase

Reports should support date filters and export to CSV/PDF where
appropriate.

------------------------------------------------------------------------

## 14. Profit & Loss

A basic P&L should calculate:

**Gross Profit = Net Sales - Cost of Goods Sold**

**Net Profit = Gross Profit + Other Income - Operating Expenses**

Care must be taken to define inventory valuation and returns
consistently. Financial reports should be treated as business reporting
and validated before being positioned as formal statutory accounting.

------------------------------------------------------------------------

## 15. Balance Sheet

A simplified business balance sheet can include:

### Assets

-   Cash
-   Bank
-   Accounts Receivable
-   Inventory
-   Other Assets

### Liabilities

-   Accounts Payable
-   Loans
-   Taxes Payable
-   Other Liabilities

### Equity

-   Opening Capital
-   Owner Contributions
-   Drawings
-   Retained Earnings / Current Profit

The accounting design should use ledger entries rather than attempting
to reconstruct every balance only from UI totals.

------------------------------------------------------------------------

## 16. Online Store / Catalog --- Later Phase

The reference workflow includes an online-store concept. Treat this as
Phase 2 or Phase 3.

Potential capabilities:

-   Public product catalog
-   Shareable store URL
-   Product availability
-   Customer ordering
-   Order management
-   Store theme
-   Delivery/pickup settings
-   Order status
-   Payment integration

The billing/POS system should remain functional without the online
store.

------------------------------------------------------------------------

## 17. Mobile Application

### Recommended approach

Use a cross-platform application so Android and iOS share most of the
codebase.

**Recommended:** React Native + Expo + TypeScript

Alternative: Flutter.

### Required native capabilities

-   Camera permission
-   QR scanner
-   QR generation
-   Share sheet
-   Local secure storage
-   Push notifications
-   File/PDF handling
-   Optional Bluetooth/thermal printer support
-   Offline local cache

### Mobile UX principles

-   Large tap targets.
-   Search-first item selection.
-   Scan button accessible from billing screen.
-   Minimum steps for common transactions.
-   Numeric keyboard for quantity/price.
-   Fast customer creation.
-   Clear success/error feedback.
-   Optimistic UI only where consistency is safe.

------------------------------------------------------------------------

## 18. Web Admin

Although mobile is primary, a responsive web admin is strongly
recommended for:

-   Bulk item management
-   Reports
-   Business configuration
-   User management
-   Data export
-   Larger-screen accounting workflows

Suggested frontend:

-   Next.js
-   TypeScript
-   Responsive component system
-   Shared validation/types with the API where practical

------------------------------------------------------------------------

## 19. Proposed Technology Stack

  Layer            Recommended Technology
  ---------------- ----------------------------------------
  Mobile           React Native + Expo + TypeScript
  Web              Next.js + TypeScript
  API              FastAPI + Python
  Database         MongoDB
  ODM              Beanie or PyMongo
  Authentication   JWT/OAuth-compatible authentication
  Cache / Queue    Redis when needed
  Object Storage   S3-compatible object storage
  QR Generation    Standards-compliant QR library
  QR Scanning      Expo Camera / compatible scanner
  PDF              Server-side invoice PDF generation
  API Docs         OpenAPI
  Testing          Pytest + frontend/mobile testing stack
  Containers       Docker
  CI/CD            GitHub Actions or equivalent
  Monitoring       OpenTelemetry + logs/metrics/traces

------------------------------------------------------------------------

## 20. High-Level Architecture

``` text
                 ┌──────────────────────┐
                 │   React Native App   │
                 │ Android / iOS        │
                 │ Camera + QR Scanner  │
                 └──────────┬───────────┘
                            │ HTTPS
                 ┌──────────▼───────────┐
                 │      API Layer       │
                 │ FastAPI / REST       │
                 │ Auth + Validation    │
                 └──────┬───────┬───────┘
                        │       │
             ┌──────────▼──┐  ┌─▼────────────────┐
             │  MongoDB    │  │ Object Storage   │
             │ Business DB │  │ invoices/images  │
             └─────────────┘  └──────────────────┘
                        │
                 ┌──────▼───────┐
                 │ Redis/Worker │
                 │ optional     │
                 └──────────────┘

                 ┌──────────────────────┐
                 │ Responsive Web App   │
                 │ Next.js Admin        │
                 └──────────┬───────────┘
                            │
                            └──── same API
```

------------------------------------------------------------------------

## 21. MongoDB Data Model

Every business-owned document must contain a `businessId` to enforce
tenant isolation.

### `users`

``` json
{
  "_id": "ObjectId",
  "name": "User Name",
  "email": "user@example.com",
  "phone": "+91...",
  "status": "active",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `businesses`

``` json
{
  "_id": "ObjectId",
  "name": "Cosmetic Solution",
  "legalName": "...",
  "phone": "...",
  "email": "...",
  "taxId": "...",
  "currency": "INR",
  "timezone": "Asia/Kolkata",
  "invoicePrefix": "INV",
  "settings": {},
  "createdAt": "datetime"
}
```

### `business_members`

``` json
{
  "businessId": "ObjectId",
  "userId": "ObjectId",
  "role": "admin",
  "permissions": [],
  "status": "active"
}
```

### `items`

``` json
{
  "_id": "ObjectId",
  "businessId": "ObjectId",
  "publicItemId": "random-public-id",
  "name": "Product",
  "sku": "SKU-001",
  "qrPayload": "ITEM:random-public-id",
  "barcode": null,
  "categoryId": "ObjectId",
  "unit": "pcs",
  "purchasePrice": 100,
  "salePrice": 150,
  "taxRate": 18,
  "currentStock": 20,
  "minStock": 5,
  "active": true
}
```

### `parties`

``` json
{
  "_id": "ObjectId",
  "businessId": "ObjectId",
  "type": ["customer"],
  "name": "Customer Name",
  "phone": "...",
  "email": "...",
  "taxId": "...",
  "billingAddress": {},
  "shippingAddress": {},
  "openingBalance": 0
}
```

### `invoices`

``` json
{
  "_id": "ObjectId",
  "businessId": "ObjectId",
  "invoiceNumber": "INV-2026-000001",
  "type": "sale",
  "partyId": "ObjectId",
  "status": "confirmed",
  "paymentStatus": "partial",
  "items": [
    {
      "itemId": "ObjectId",
      "nameSnapshot": "Product",
      "skuSnapshot": "SKU-001",
      "quantity": 2,
      "unitPrice": 150,
      "discount": 0,
      "taxRate": 18,
      "taxAmount": 54,
      "lineTotal": 354
    }
  ],
  "subtotal": 300,
  "taxTotal": 54,
  "discountTotal": 0,
  "grandTotal": 354,
  "paidAmount": 200,
  "balanceDue": 154,
  "createdBy": "ObjectId",
  "createdAt": "datetime"
}
```

### `payments`

``` json
{
  "_id": "ObjectId",
  "businessId": "ObjectId",
  "partyId": "ObjectId",
  "invoiceId": "ObjectId",
  "direction": "in",
  "amount": 200,
  "method": "upi",
  "reference": "...",
  "paidAt": "datetime"
}
```

### `inventory_movements`

``` json
{
  "_id": "ObjectId",
  "businessId": "ObjectId",
  "itemId": "ObjectId",
  "type": "sale",
  "referenceType": "invoice",
  "referenceId": "ObjectId",
  "quantityChange": -2,
  "quantityAfter": 18,
  "unitCost": 100,
  "createdAt": "datetime"
}
```

### Other collections

-   `expenses`
-   `expense_categories`
-   `categories`
-   `units`
-   `accounts`
-   `ledger_entries`
-   `stock_adjustments`
-   `invoice_sequences`
-   `audit_logs`
-   `notifications`
-   `files`
-   `business_settings`

------------------------------------------------------------------------

## 22. MongoDB Indexing

At minimum:

``` text
items:
  unique (businessId, publicItemId)
  unique/sparse (businessId, sku)
  (businessId, name)
  (businessId, categoryId)

invoices:
  unique (businessId, invoiceNumber)
  (businessId, createdAt)
  (businessId, partyId, createdAt)
  (businessId, type, createdAt)

payments:
  (businessId, partyId, paidAt)
  (businessId, invoiceId)

inventory_movements:
  (businessId, itemId, createdAt)

parties:
  (businessId, phone)
  (businessId, name)
```

Every query must be tenant-scoped.

------------------------------------------------------------------------

## 23. Consistency and Transactions

Billing affects several entities simultaneously:

-   invoice,
-   stock,
-   inventory movement,
-   party balance,
-   payment,
-   ledger.

Where atomic consistency is required, use **MongoDB transactions** with
a replica set/managed MongoDB deployment that supports transactions.

Never allow the mobile client to independently update stock after
creating an invoice. The server owns the transaction.

------------------------------------------------------------------------

## 24. Suggested REST API

``` text
/auth/login
/auth/refresh
/auth/logout

/businesses
/businesses/{id}
/businesses/{id}/members

/items
/items/{id}
/items/lookup/qr/{publicItemId}
/items/{id}/qr
/items/{id}/stock

/parties
/parties/{id}
/parties/{id}/ledger

/sales
/sales/{id}
/sales/{id}/pdf
/sales/{id}/payments
/sales/{id}/return

/purchases
/purchases/{id}
/purchases/{id}/return

/expenses
/payments
/inventory/movements
/inventory/adjustments

/reports/dashboard
/reports/sales
/reports/purchases
/reports/expenses
/reports/stock
/reports/party-statement
/reports/profit-loss
/reports/balance-sheet
```

Use API versioning, for example `/api/v1/...`.

------------------------------------------------------------------------

## 25. Authentication & Authorization

### Requirements

-   Secure login.
-   Short-lived access token.
-   Refresh-token strategy.
-   Password hashing using a modern algorithm.
-   Role-based access control.
-   Business-level tenant authorization.
-   Device/session management.
-   Rate limiting.
-   Audit logs for important mutations.

### Example permissions

``` text
sales.create
sales.read
sales.refund
purchase.create
inventory.read
inventory.adjust
expenses.create
reports.read
users.manage
business.settings.manage
```

Do not rely only on hiding buttons in the mobile UI. Permissions must be
checked by the API.

------------------------------------------------------------------------

## 26. Offline and Poor-Network Behaviour

A shop billing application should tolerate temporary network problems.

### MVP

Cache:

-   item catalog,
-   customer list,
-   recent transactions,
-   basic settings.

### Later

Introduce an offline transaction queue with:

-   locally generated request ID,
-   idempotency key,
-   sync status,
-   conflict handling,
-   retry policy.

Offline billing must be implemented carefully because inventory and
invoice-number conflicts can occur across multiple devices.

------------------------------------------------------------------------

## 27. Security Requirements

-   HTTPS only.
-   Secrets never stored in source control.
-   Secure mobile token storage.
-   Tenant isolation on every API.
-   Input validation.
-   No direct MongoDB access from mobile/web clients.
-   Audit critical actions.
-   Validate uploaded files.
-   Rate-limit login and sensitive APIs.
-   Use opaque public IDs in QR codes.
-   Do not embed prices, auth tokens, database IDs, or customer PII in
    product QR codes.
-   Encrypt sensitive data at rest using infrastructure capabilities.
-   Backup MongoDB.
-   Test restore procedures.
-   Log security-sensitive events without logging secrets.

------------------------------------------------------------------------

## 28. Observability

Instrument backend services with OpenTelemetry.

Track:

-   API latency
-   API errors
-   Invoice creation failures
-   QR lookup failures
-   Payment failures
-   Stock inconsistencies
-   Database latency
-   Authentication failures
-   Background job failures

Use structured logs with:

-   request ID
-   business ID
-   user ID
-   endpoint
-   status
-   duration

Avoid sensitive customer data in logs.

------------------------------------------------------------------------

## 29. Testing Strategy

### Unit tests

-   Invoice calculations
-   Tax calculations
-   Discounts
-   Stock calculations
-   P&L calculations
-   Permission rules
-   QR parser

### API integration tests

-   Sale creation
-   Purchase creation
-   Partial payment
-   Returns
-   Stock adjustments
-   Tenant isolation
-   Duplicate invoice protection

### Mobile tests

-   Camera permission
-   QR scan
-   Add item to invoice
-   Repeated scan increments quantity
-   Offline/cache behaviour
-   Invoice sharing

### End-to-end tests

``` text
Create business
→ create item
→ generate QR
→ scan QR
→ create sale
→ stock decreases
→ payment recorded
→ invoice generated
→ dashboard changes
→ report reflects transaction
```

------------------------------------------------------------------------

## 30. MVP Scope

The first production-ready version should include:

-   Authentication
-   Business setup
-   Roles/basic permissions
-   Dashboard
-   Customers and suppliers
-   Item/category/unit management
-   QR generation
-   QR scanning
-   Sales invoice
-   Purchase entry
-   Expenses
-   Payment In/Out
-   Inventory movements
-   Transaction list
-   Party ledger
-   Sales/Purchase/Expense reports
-   Stock report
-   Basic Profit & Loss
-   Invoice PDF/share
-   Audit log
-   MongoDB backup strategy

Avoid putting online-store, complex accounting, advanced GST filing,
warehouse transfers, loyalty, and extensive integrations into the first
MVP unless they become explicit launch requirements.

------------------------------------------------------------------------

## 31. Delivery Phases

### Phase 0 --- Discovery and UX

-   Confirm business rules.
-   Define tax/GST requirements.
-   Define invoice format.
-   Define roles.
-   Produce wireframes.
-   Confirm offline expectations.

### Phase 1 --- Foundation

-   Monorepo/project setup.
-   MongoDB.
-   API.
-   Authentication.
-   Business tenancy.
-   Mobile navigation.
-   CI/CD.
-   Logging.

### Phase 2 --- Master Data

-   Items.
-   Categories.
-   Units.
-   Customers/suppliers.
-   QR generation/scanning.

### Phase 3 --- Billing & Inventory

-   Sales.
-   Purchases.
-   Payments.
-   Inventory ledger.
-   Invoice PDF.
-   Sharing.

### Phase 4 --- Expenses & Reporting

-   Expenses.
-   Dashboard.
-   Party statements.
-   Stock reports.
-   P&L.
-   Balance Sheet foundation.

### Phase 5 --- Production Hardening

-   RBAC.
-   Audit.
-   Backups.
-   Performance.
-   Security tests.
-   End-to-end tests.
-   Store deployment.

### Phase 6 --- Enhancements

-   Online store.
-   GST-specific exports.
-   Thermal printer.
-   Barcode support.
-   Multi-location.
-   Advanced accounting.
-   Notifications.
-   Payment integrations.

------------------------------------------------------------------------

# Antigravity Build Skills

The following skills should be created/available to the Antigravity
coding agent. Each skill should contain conventions, architecture
decisions, reusable patterns, validation rules, and completion checks so
the agent does not reinvent the implementation on every task.

## Skill 1 --- `product-requirements`

**Purpose:** Keep implementation aligned with this product
specification.

Should teach the agent:

-   Product modules and terminology.
-   MVP vs later scope.
-   User roles.
-   Critical billing workflows.
-   Acceptance-criteria format.
-   Rule: ask/flag unresolved financial business rules instead of
    inventing them.

------------------------------------------------------------------------

## Skill 2 --- `mobile-react-native`

**Purpose:** Build the Android/iOS application consistently.

Should include:

-   React Native + Expo conventions.
-   TypeScript strict mode.
-   Navigation structure.
-   Screen/component conventions.
-   Forms.
-   Keyboard handling.
-   Camera permissions.
-   Loading/error/empty states.
-   Accessibility.
-   Mobile performance.
-   Secure token storage.
-   Deep linking if introduced.

------------------------------------------------------------------------

## Skill 3 --- `qr-billing`

**Purpose:** Own all QR-related workflows.

Should include:

-   QR payload format.
-   QR generation.
-   Camera scanning.
-   Parser and validation.
-   Product lookup.
-   Duplicate/repeated scan behaviour.
-   Invalid QR behaviour.
-   Cross-business QR protection.
-   Label generation.
-   Security rules.

Example:

``` text
ITEM:<opaque-public-item-id>
```

Never encode credentials, MongoDB ObjectIds, customer PII, or mutable
price information.

------------------------------------------------------------------------

## Skill 4 --- `fastapi-backend`

**Purpose:** Standardize API development.

Should include:

-   Router/service/repository separation.
-   Pydantic request/response models.
-   Dependency injection.
-   Authentication dependencies.
-   Tenant context.
-   Error contract.
-   Pagination.
-   Filtering.
-   OpenAPI documentation.
-   Idempotency for financial writes.
-   Test conventions.

------------------------------------------------------------------------

## Skill 5 --- `mongodb-data-modeling`

**Purpose:** Make MongoDB usage safe and scalable.

Should include:

-   Collection definitions.
-   Index rules.
-   `businessId` tenancy.
-   Immutable transaction snapshots.
-   MongoDB transactions.
-   Decimal/money storage strategy.
-   Pagination.
-   Aggregation pipelines.
-   Migration/versioning approach.
-   Backup/restore expectations.

**Important:** Define one canonical monetary representation. Avoid
uncontrolled floating-point arithmetic for financial values.

------------------------------------------------------------------------

## Skill 6 --- `multi-tenant-security`

**Purpose:** Prevent data leakage between businesses.

Rules:

-   Every business resource carries `businessId`.
-   API derives authorized business context from authenticated
    membership.
-   Never trust `businessId` from the client without authorization.
-   Every repository query is tenant-scoped.
-   Add automated cross-tenant tests.
-   QR lookup must also enforce tenant access.

------------------------------------------------------------------------

## Skill 7 --- `billing-engine`

**Purpose:** Centralize invoice calculations.

Should define:

-   Quantity × unit price.
-   Item discount.
-   Invoice discount.
-   Tax.
-   Additional charges.
-   Round-off.
-   Grand total.
-   Paid amount.
-   Balance.
-   Return calculations.
-   Calculation precision.
-   Server-side authoritative totals.

Mobile/web clients may preview totals, but the server recalculates and
validates them.

------------------------------------------------------------------------

## Skill 8 --- `inventory-ledger`

**Purpose:** Protect stock correctness.

Rules:

-   Stock changes only through inventory services.
-   Every change creates an inventory movement.
-   Sale decreases stock.
-   Purchase increases stock.
-   Returns reverse appropriate movements.
-   Manual adjustment requires reason.
-   Concurrency must be considered.
-   Never silently edit historical movement records.

------------------------------------------------------------------------

## Skill 9 --- `payments-and-ledger`

**Purpose:** Keep payments and balances consistent.

Should include:

-   Payment In.
-   Payment Out.
-   Partial payment.
-   Multiple payments per invoice.
-   Refunds.
-   Party balances.
-   Cash/bank accounts.
-   Ledger entry patterns.
-   Reconciliation rules.
-   Reversal rather than destructive deletion for posted financial
    records.

------------------------------------------------------------------------

## Skill 10 --- `reporting-analytics`

**Purpose:** Implement reliable reports.

Should include:

-   Date-range handling.
-   Business timezone.
-   Sales aggregation.
-   Purchase aggregation.
-   Expense aggregation.
-   Stock valuation.
-   Receivable/payable.
-   P&L.
-   Balance Sheet.
-   CSV/PDF export.
-   Reconciliation tests between source transactions and reports.

------------------------------------------------------------------------

## Skill 11 --- `invoice-pdf-print-share`

**Purpose:** Produce customer-facing invoices.

Should include:

-   Invoice template.
-   Business branding.
-   Tax details.
-   PDF generation.
-   Mobile share flow.
-   Download.
-   A4 format.
-   Future thermal-printer format.
-   Snapshotting invoice data so old invoices do not change when an
    item/customer is renamed.

------------------------------------------------------------------------

## Skill 12 --- `auth-rbac`

**Purpose:** Implement authentication and permissions.

Should define:

-   Login.
-   Token refresh.
-   Session revocation.
-   Password rules.
-   Role mapping.
-   Permission checks.
-   API authorization.
-   Secure storage.
-   Audit events.

------------------------------------------------------------------------

## Skill 13 --- `offline-sync`

**Purpose:** Handle unreliable mobile connectivity.

Should include:

-   Local cache.
-   Sync state.
-   Idempotency keys.
-   Retry strategy.
-   Conflict resolution.
-   Pending transaction UI.
-   Rules for features that are unsafe offline.

This can be implemented after the online-first MVP but the architecture
should leave room for it.

------------------------------------------------------------------------

## Skill 14 --- `testing-quality`

**Purpose:** Require tests as part of implementation.

Definition of Done should include:

-   Unit tests.
-   API integration tests.
-   Tenant-isolation test.
-   Financial calculation tests.
-   Inventory consistency tests.
-   Mobile critical-path test.
-   Lint/type-check.
-   No failing tests.
-   Acceptance criteria verified.

------------------------------------------------------------------------

## Skill 15 --- `observability`

**Purpose:** Make production debugging possible.

Should include:

-   Structured logging.
-   Correlation/request IDs.
-   OpenTelemetry traces.
-   Metrics.
-   Error tracking.
-   Health/readiness endpoints.
-   Database timing.
-   Redaction of PII/secrets.

------------------------------------------------------------------------

## Skill 16 --- `secure-coding`

**Purpose:** Apply security controls during implementation.

Checklist:

-   Validate all inputs.
-   Authorize all resources.
-   Prevent NoSQL injection.
-   Limit upload types/sizes.
-   Secure secrets.
-   Rate limits.
-   Dependency scanning.
-   Avoid sensitive logs.
-   Validate QR payloads.
-   Prevent IDOR.
-   Safe error messages.
-   Audit privileged actions.

------------------------------------------------------------------------

## Skill 17 --- `ui-design-system`

**Purpose:** Keep mobile and web interfaces visually and behaviorally
consistent.

Should define:

-   Typography.
-   Spacing.
-   Cards.
-   Buttons.
-   Forms.
-   Tables/lists.
-   Status chips.
-   Confirmation dialogs.
-   Destructive-action treatment.
-   Loading skeletons.
-   Empty states.
-   Error states.
-   Responsive breakpoints.

------------------------------------------------------------------------

## Skill 18 --- `devops-ci-cd`

**Purpose:** Build and release reliably.

Should include:

-   Environment strategy: dev/staging/prod.
-   Docker.
-   Environment variables.
-   Secret management.
-   CI checks.
-   Automated tests.
-   Backend deployment.
-   Mobile build pipeline.
-   Database backup.
-   Rollback.
-   Release tagging.

------------------------------------------------------------------------

## 32. Suggested Antigravity Repository Instructions

Antigravity should follow these rules globally:

``` text
1. Read the relevant skill before implementing a module.
2. Never bypass tenant authorization.
3. Never update stock directly from a UI request.
4. Never trust invoice totals calculated by the client.
5. Never use floating-point arithmetic casually for money.
6. Never expose MongoDB ObjectIds in QR payloads.
7. Never delete posted financial history without an explicit reversal design.
8. Every financial mutation must be idempotent or protected against duplicate submission.
9. Every new endpoint requires validation, authorization, error handling, and tests.
10. Every new collection requires indexes and tenant strategy.
11. Mobile screens must include loading, empty, success, and error states.
12. Critical actions must create audit records.
13. API changes must update OpenAPI/schema contracts.
14. Build MVP functionality before optional enhancements.
15. Do not copy branding or proprietary UI assets from the reference application.
```

------------------------------------------------------------------------

## 33. Suggested Repository Structure

``` text
business-app/
├── apps/
│   ├── mobile/
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── navigation/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   └── utils/
│   │   └── tests/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── tests/
│   │
│   └── api/
│       ├── app/
│       │   ├── api/
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── security/
│       │   ├── reports/
│       │   └── core/
│       └── tests/
│
├── packages/
│   ├── contracts/
│   └── design-tokens/
│
├── skills/
│   ├── product-requirements/
│   ├── mobile-react-native/
│   ├── qr-billing/
│   ├── fastapi-backend/
│   ├── mongodb-data-modeling/
│   ├── multi-tenant-security/
│   ├── billing-engine/
│   ├── inventory-ledger/
│   ├── payments-and-ledger/
│   ├── reporting-analytics/
│   ├── invoice-pdf-print-share/
│   ├── auth-rbac/
│   ├── offline-sync/
│   ├── testing-quality/
│   ├── observability/
│   ├── secure-coding/
│   ├── ui-design-system/
│   └── devops-ci-cd/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── data-model.md
│   ├── security.md
│   └── decisions/
│
├── docker/
├── .github/workflows/
└── README.md
```

------------------------------------------------------------------------

## 34. Definition of Done for the MVP

The MVP is considered functionally complete when a new business can:

1.  Register/login.
2.  Configure business details.
3.  Add staff with controlled permissions.
4.  Create customers and suppliers.
5.  Create an item.
6.  Generate the item's QR code.
7.  Scan that QR from a mobile device.
8.  Add the scanned item to a sale.
9.  Complete a sale.
10. Generate/share the invoice.
11. Observe the correct stock reduction.
12. Record a purchase and observe stock increase.
13. Record an expense.
14. Record partial/full payments.
15. View customer/supplier balances.
16. Search transaction history.
17. View stock, sales, purchase, expense, P&L, and basic balance-sheet
    reports.
18. Prevent a user from accessing another business's data.
19. Maintain an audit trail for critical operations.
20. Recover business data from a tested backup.

------------------------------------------------------------------------

## 35. Recommended First Antigravity Build Sequence

Antigravity should **not attempt the entire product in one generation**.

Use this order:

``` text
01. Project skeleton + architecture
02. MongoDB connection + base models
03. Authentication
04. Business tenancy + RBAC
05. Item/category/unit master
06. Party/customer/supplier master
07. QR generation
08. Mobile QR scanner + item lookup
09. Billing calculation engine
10. Sales transaction
11. Inventory movement engine
12. Purchase transaction
13. Payments
14. Expenses
15. Invoice PDF/share
16. Dashboard
17. Reports
18. Audit + observability
19. End-to-end testing
20. Production deployment
```

At the end of each step, Antigravity should run tests and update the
relevant documentation before proceeding.

------------------------------------------------------------------------

## 36. Final Product Goal

The result should be a clean, fast, mobile-first business application in
which a shop owner can move from **item creation → QR generation → QR
scan → billing → payment → inventory update → reporting** with minimal
friction.

MongoDB acts as the operational datastore, while the API remains the
authoritative layer for financial calculations, inventory consistency,
authorization, and reporting.

The design should start simple enough for a single small shop but retain
the architecture needed for multiple users, multiple businesses, larger
inventories, additional locations, integrations, and an online
storefront later.
