# QuickBill Café Persona — 05: UI/UX Implementation Plan & Wireframes

## 1. Design System & Theming Consistency

The Café Persona utilizes QuickBill's established design tokens (`index.css`), maintaining typography, borders, card styles, and high-contrast accessibility across desktop, tablet, and mobile browsers.

---

## 2. Screen-by-Screen Specifications & Wireframes

### 2.1. Café Dashboard & Floor Plan View (`/cafe/dashboard`)

#### Description
Visual floor plan displaying all dining tables segmented by section (e.g., *Indoor AC*, *Patio Terrace*). Cards display live table status, active session duration, guest count, and accrued bill subtotal.

#### ASCII Wireframe
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☕ QuickBill Café Console   [Branch: Flagship Café ▼]   [Incoming Orders: 🔴 3 New]  [Amit ▼] │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Floor Sections: [ All (14) ] [ Indoor AC (8) ] [ Terrace Patio (6) ]     [+ Add Table]       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐              │
│ │ TABLE T-01    (2-Pax) │  │ TABLE T-02    (4-Pax) │  │ TABLE T-03    (4-Pax) │              │
│ │ [ AVAILABLE ]         │  │ [ OCCUPIED ]  24 mins │  │ [ ORDERING ]   1 min  │              │
│ │                       │  │ Items: 4 | ₹480.00    │  │ 🔴 2 Incoming Items   │              │
│ │ [ + Seat Guests ]     │  │ [ View / Add Items ]  │  │ [ Review Order (F4) ] │              │
│ └───────────────────────┘  └───────────────────────┘  └───────────────────────┘              │
│ ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐              │
│ │ TABLE T-04    (6-Pax) │  │ TABLE T-05    (2-Pax) │  │ TABLE T-06    (4-Pax) │              │
│ │ [ BILLING ]           │  │ [ CLEANING ]          │  │ [ OCCUPIED ]  42 mins │              │
│ │ Bill: ₹1,240.00       │  │ Vacated 5 mins ago    │  │ Items: 6 | ₹820.00    │              │
│ │ [ Settle & Print F9 ] │  │ [ Mark Clean & Ready] │  │ [ View / Add Items ]  │              │
│ └───────────────────────┘  └───────────────────────┘  └───────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### User Interactions & States
- **Click Table Card**: Opens the Table Session details drawer showing previous KOT rounds, in-flight orders, and bill breakdown.
- **Color Indicators**: Green (`AVAILABLE`), Amber (`OCCUPIED`), Blue (`ORDERING`), Purple (`BILLING`), Gray (`CLEANING`).
- **Live Elapsed Timer**: Visual timer starts from when the first order is accepted.
- **Empty State**: If no tables exist: "No tables found in this section. Click '+ Add Table' to configure floor plan."

---

### 2.2. Table Management & QR Code Export Screen (`/cafe/tables`)

#### Description
Grid and list view for creating, configuring, and generating QR codes for tables. Allows bulk export of table standee cards as printable A4 PDF sheets.

#### ASCII Wireframe
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Table Management & QR Codes                                     [🖨️ Export All QR Standees]  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Search: [ 🔍 Filter table... ]   Section: [ All Sections ▼ ]               [+ New Table]      │
├───────┬────────────┬─────────────┬──────────┬──────────────┬──────────────────┬──────────────┤
│ Table │ Label      │ Section     │ Capacity │ Status       │ QR Standee Code  │ Actions      │
├───────┼────────────┼─────────────┼──────────┼──────────────┼──────────────────┼──────────────┤
│ T-01  │ Table 1    │ Indoor AC   │ 2 Guests │ Active       │ [ 📱 Preview QR ] │ ✏️ Edit  🗑️  │
│ T-02  │ Table 2    │ Indoor AC   │ 4 Guests │ Active       │ [ 📱 Preview QR ] │ ✏️ Edit  🗑️  │
│ T-03  │ Table 3    │ Patio Deck  │ 4 Guests │ Active       │ [ 📱 Preview QR ] │ ✏️ Edit  🗑️  │
│ T-04  │ Table 4    │ Patio Deck  │ 6 Guests │ Active       │ [ 📱 Preview QR ] │ ✏️ Edit  🗑️  │
└───────┴────────────┴─────────────┴──────────┴──────────────┴──────────────────┴──────────────┘
```

#### Modal: QR Standee Card Preview
- Shows high-resolution QR code with store branding, table number (`Table 4`), and text: *"Scan with your smartphone camera to browse menu & order"*.
- Action: "Print 4-per-page A4 Sheet" or "Download High-Res SVG/PNG".

---

### 2.3. Customer Digital Menu & Cart (Public Smartphone View)

#### Description
Ultra-fast, mobile-first web page loaded when diner scans table QR code. Does not require login or app download.

#### ASCII Wireframe (Mobile Viewport)
```text
┌──────────────────────────────┐
│ ☕ The Daily Roast Café       │
│ Table T-04 • Indoor AC       │
├──────────────────────────────┤
│ [ 🔍 Search dishes, coffee ] │
│ [All] [Coffee] [Bakery] [Food│
├──────────────────────────────┤
│ 🟢 VEG ONLY   [ Toggle ON ]  │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ Cappuccino         ₹120  │ │
│ │ Rich espresso & milk     │ │
│ │ [ + ADD ] [ Customize ]  │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Blueberry Muffin    ₹90  │ │
│ │ Freshly baked, vanilla   │ │
│ │ [ -  1  + ]              │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 🛒 2 Items | ₹210.00         │
│ [ View Cart & Place Order →] │
└──────────────────────────────┘
```

#### Drawer: Item Customization & Notes
- Variant Radio: `[x] Regular (₹120)` `( ) Large (₹160)`
- Add-ons Checkbox: `[ ] Extra Espresso Shot (+₹40)` `[x] Oat Milk (+₹30)`
- Kitchen Instruction: `[ Input: "Extra hot please" ]`
- Action: `[ Add to Order - ₹190.00 ]`

---

### 2.4. Incoming Orders Review Queue (`/cafe/orders/incoming`)

#### Description
Cashier queue for reviewing orders submitted by dining customers via QR code before dispatching to the kitchen.

#### ASCII Wireframe
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Incoming Table Orders (2 Pending Approval)                    [🔔 Audio Alerts: ON]       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ TABLE T-04  •  Customer: Rohan (9876543210)  •  Placed 1m ago              [₹320.00]     │ │
│ │ Items:                                                                                   │ │
│ │  • 2x Cappuccino (Large, Oat Milk) — Note: "Extra hot"                                   │ │
│ │  • 1x Butter Croissant                                                                   │ │
│ │                                                                                          │ │
│ │ [ ❌ Reject Order (Reason) ]                         [ ✅ Accept Order & Print KOT ]     │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Audio & Visual Alerts
- Triggers gentle repetitive chime (`playScanSuccess()` tone) when pending count $>0$.
- One-click keyboard shortcut (`Enter` to Accept, `Esc` to Reject).

---

### 2.5. Kitchen Order View / KDS (`/cafe/kitchen`)

#### Description
Clean, high-contrast display designed for tablet or wall monitor mounted in the kitchen.

#### ASCII Wireframe
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🍳 Kitchen Display View (KDS)     Active Tickets: 3              Time: 12:45 PM              │
├──────────────────────────────┬──────────────────────────────┬────────────────────────────────┤
│ TICKET #KOT-012   [ 8m ago ] │ TICKET #KOT-013   [ 3m ago ] │ TICKET #KOT-014   [ Just now ] │
│ Table: T-04       Round: 1   │ Table: T-02       Round: 2   │ Table: T-06       Round: 1     │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────┤
│ [ ] 2x Cappuccino (Large)    │ [ ] 1x Club Sandwich         │ [ ] 1x Iced Latte              │
│     *Note: Oat milk, hot     │     *Note: No onion, brown   │     *Note: Less ice            │
│ [ ] 1x Butter Croissant      │ [ ] 1x French Fries          │                                │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────┤
│ [ 🖨️ Re-Print ] [ ✅ READY ] │ [ 🖨️ Re-Print ] [ ✅ READY ] │ [ 🖨️ Re-Print ] [ ✅ READY ]   │
└──────────────────────────────┴──────────────────────────────┴────────────────────────────────┘
```

---

### 2.6. Daily Opening / Closing Stock Register (`/cafe/stock`)

#### Description
Enables morning opening stock logging and evening physical closing stock verification for raw ingredients.

#### ASCII Wireframe
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Daily Raw Material Stock Register — Date: [ Today (25 Mar 2026) ▼ ]     Status: OPEN_LOGGED   │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Morning Opening Stock ]  [ Evening Closing Stock ]  [ Variance & Spoilage Report ]          │
├────────────────────┬──────────┬───────────┬──────────────┬────────────┬───────────┬──────────┤
│ Raw Material       │ Unit     │ Opening   │ Inward (PO)  │ Est. Close │ Physical  │ Variance │
├────────────────────┼──────────┼───────────┼──────────────┼────────────┼───────────┼──────────┤
│ Whole Milk (Fresh) │ Litres   │ 20.00     │ +15.00       │ 12.00      │ [ 10.50 ] │ 🔴 -1.50 │
│ Arabica Beans      │ Kg       │ 8.50      │ +0.00        │ 7.20       │ [ 7.15 ]  │ ⚪ -0.05 │
│ Vanilla Syrup      │ Bottles  │ 3.00      │ +0.00        │ 2.50       │ [ 2.50 ]  │ 🟢  0.00 │
│ Brown Sugar        │ Kg       │ 12.00     │ +5.00        │ 15.00      │ [ 14.80 ] │ ⚪ -0.20 │
└────────────────────┴──────────┴───────────┴──────────────┴────────────┴───────────┴──────────┤
│ Notes: [ Spoilage or wastage comments...                                ]   [ Save Audit ]   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.7. Stock Audit Calendar / Grid (`/cafe/stock/calendar`)

#### Description
Visual monthly calendar displaying daily closing stock completion. Highlights incomplete days in red.

#### ASCII Wireframe
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Raw Material Audit History — March 2026                                                      │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬────────────┬───────────┤
│ Sun         │ Mon         │ Tue         │ Wed         │ Thu         │ Fri        │ Sat       │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼────────────┼───────────┤
│ 1           │ 2           │ 3           │ 4           │ 5           │ 6          │ 7         │
│ 🟢 Verified │ 🟢 Verified │ 🟢 Verified │ 🟢 Verified │ 🟢 Verified │ 🟢 Verified│ 🟢 Verified│
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼────────────┼───────────┤
│ 8           │ 9           │ 10          │ 11          │ 12          │ 13         │ 14        │
│ 🟢 Verified │ 🔴 MISSING  │ 🟢 Verified │ 🟢 Verified │ 🟢 Verified │ 🟢 Verified│ 🟢 Verified│
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴────────────┴───────────┘
```

