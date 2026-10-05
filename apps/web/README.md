# 💻 QuickBill Web Admin & POS Console (`apps/web`)

> **Modern, responsive Web Admin Console and High-Speed Point-of-Sale (POS) interface built with React 18, Vite, and TypeScript.**

---

## 📌 Architecture & Technologies

- **Core Framework**: [React 18](https://react.dev) with [Vite](https://vitejs.dev) for lightning-fast HMR and bundling.
- **Language**: TypeScript with strict type-safety.
- **Styling**: TailwindCSS with custom design tokens for rich aesthetics, dark modes, and glassmorphism.
- **Icons**: [Lucide React](https://lucide.dev)
- **State Management**: React Context API (`AuthContext`, `BusinessContext`, `CartContext`) combined with local storage persistence.

---

## 📁 Source Code Structure

```text
apps/web/src/
├── api/                    # Axios / Fetch client with JWT interceptor & businessId injection
├── components/             # Reusable UI elements (Modals, Tables, Cards, Badges, Dropdowns)
├── context/                # Global React Contexts (Auth, Business, Location state)
├── types/                  # Authoritative TypeScript interfaces (Invoice, Item, Party, StagedOrder)
├── views/                  # Primary Application Views:
│   ├── PosBillingView.tsx  # High-Speed POS Checkout, Barcode & Held Carts
│   ├── InventoryView.tsx   # Location-Scoped Stock Ledger & Adjustment Modals
│   ├── LabelGeneratorView.tsx # Product Barcode & QR Label Printing
│   ├── InvoicesView.tsx    # Invoices Directory & Full/Partial Returns Processing
│   ├── PurchasesView.tsx   # Purchase Orders & Supplier Inward Bills
│   ├── PartiesView.tsx     # Customers, Suppliers, Khata Ledgers & Payment In/Out
│   ├── ReportsView.tsx     # Day Book, P&L, GSTR-1 Rate Slabs & Stock Valuation
│   └── SettingsView.tsx    # Store Branding, Branch GSTIN, 2FA & Receipt Templates
├── App.tsx                 # Root router and layout shell
└── main.tsx                # React entry point
```

---

## 🚀 Key Interface Views

### 1. POS Billing View (`PosBillingView.tsx`)
- **Fast Lookup & Barcode Input**: Press `F2` to search or scan barcodes.
- **Category Filter Popover**: Quick filter popover with high z-index overlay.
- **Cart Staging & Parked Orders**: Save carts in-flight (`F8`) with local + server synchronization, resume held orders, and discard confirmation modals.
- **Tax-Inclusive Pricing**: Automatically displays item rates, taxable base, and output GST without double reduction.
- **Multiple Payment Modes**: Cash, UPI QR code generation, Card, Split payment, and Customer Credit (Khata).
- **Receipt Actions**: Instant Thermal POS (2-inch / 3-inch) printing and WhatsApp sharing.

### 2. Inventory & Stock View (`InventoryView.tsx`)
- **Location-Scoped Stocks**: Displays inventory specific to the active branch selected in the header.
- **Stock Adjustments**: Restock, Damage/Loss, and Physical Count audits with mandatory reason logging.

### 3. Reports & Analytics View (`ReportsView.tsx`)
- **Day Book**: Real-time sales, collections, and expense turnover.
- **Trading & Income (P&L) Statement**: Gross Billed Sales $\rightarrow$ Output GST $\rightarrow$ Net Taxable Turnover $\rightarrow$ Actual Catalog COGS $\rightarrow$ Gross Margin $\rightarrow$ Net Profit.
- **GSTR-1 GST Rate Slab Breakdown**: Taxable base, CGST, SGST, and total tax for 0%, 5%, 12%, 18%, and 28% slabs.
- **Stock Valuation**: Real-time asset inventory valuation by purchase and retail value.
- **Exporting**: One-click CSV and PDF reports.

---

## 🏃 Getting Started & Scripts

### 1. Install Dependencies
```bash
cd apps/web
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
- Available at: [http://localhost:3000](http://localhost:3000)

### 3. Production Build
```bash
npm run build
```
- Outputs optimized static bundle to `dist/`.

### 4. Preview Production Build
```bash
npm run preview
```
