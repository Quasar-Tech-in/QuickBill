# QuickBill Café Persona — 08: Risks, Mitigations & Open Questions

## 1. Technical & Operational Risks

| Risk ID | Identified Risk | Impact | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :---: | :--- |
| **RSK-01** | **Unauthorized Remote Orders via Leaked QR** | Pranksters scanning a photo of a table QR from home and placing fake food orders. | **HIGH** | **Two-Tier Defense**: (1) Cashier Approval Gateway (`requireOrderApproval = true`): food is never prepped until cashier accepts. (2) Dynamic daily token salt or cashier one-click table PIN reset. |
| **RSK-02** | **Kitchen Printer Jam or Disconnect** | Thermal kitchen printer goes offline during lunch rush, causing lost KOT chits. | **HIGH** | Web console maintains a live **Kitchen Display View (KDS)**. If paper print fails, tickets remain visible on screen, and cashier can click "Re-Print KOT" at any time. |
| **RSK-03** | **Network Drop During Table Settlement** | Internet drops while cashier is taking card payment and finalizing bill. | **MEDIUM** | MongoDB ACID multi-document transactions ensure the bill and stock decrements are committed atomically. If the request times out, the table session remains in `BILLING` state for safe retry without duplicate charges. |
| **RSK-04** | **Discrepancy Between Recipe Math vs. Real Waste** | Steaming milk, espresso grind dialing, and vegetable trimming produce variable waste that rigid recipes fail to track. | **MEDIUM** | Prioritizing **Daily Physical Closing Stock Audits** (Release 2) over rigid automatic BOM depletion. Physical counts measure true operational shrinkage and actual COGS. |
| **RSK-05** | **Third-Party Delivery API Blockers** | Delays in obtaining Zomato & Swiggy Merchant Developer API credentials. | **LOW (Isolated)** | Aggregator integration is isolated in **Release 4**. Core café dine-in operations and retail functionality are 100% independent of external aggregator APIs. |

---

## 2. Architectural Design Decisions

### Decision 1: Table State Architecture (Dedicated Collection vs. Staged Orders)
- **Evaluation**: We evaluated reusing the existing `staged_orders` collection vs. creating dedicated `tables` and `table_sessions` collections.
- **Decision**: **Create dedicated `tables` and `table_sessions` collections.** 
  - *Rationale*: Staged orders in QuickBill are designed for ephemeral held carts at a retail checkout counter. Café tables require persistent physical attributes (capacity, section, QR codes), state transitions (`AVAILABLE`, `CLEANING`), and multi-round KOT audit histories that would overburden the retail staged orders schema.

### Decision 2: Customer Ordering Gateway (Direct KOT vs. Cashier Review)
- **Evaluation**: Should a customer's submitted order print directly in the kitchen, or pause in a cashier review queue?
- **Decision**: **Cashier Review Queue by default, with tenant config toggle.**
  - *Rationale*: Direct printing to kitchen exposes restaurants to accidental customer duplicates, prank orders, or unmanageable kitchen rushes during peak hours. Cashiers can verify item availability before dispatching the KOT.

### Decision 3: Stock Tracking Methodology (BOM Auto-Depletion vs. Daily Physical Audits)
- **Evaluation**: Should selling a Cappuccino automatically deduct 200ml milk and 18g espresso beans via BOM recipes?
- **Decision**: **Daily Physical Stock Audit for MVP (Release 2); BOM Recipes in Release 4.**
  - *Rationale*: In practical café operations, recipes rarely match real consumption due to steam pitcher waste, espresso grinder calibration shots, and spillage. Morning opening and evening closing stock counts provide 100% accurate consumption without fragile recipe configurations.

---

## 3. Open Questions for Stakeholder / Product Review

> [!IMPORTANT]
> The following questions represent key business and operational decisions that should be aligned on prior to implementation.

### Q1: Automatic vs. Manual KOT Printing
*Should KOT chits trigger browser print dialogs automatically upon cashier acceptance, or should cashiers click "Print KOT"?*
- **Recommendation**: Provide a tenant setting: `autoPrintKot: boolean`. When enabled, accepting an order immediately triggers the thermal 80mm print modal; when disabled, tickets appear on the KDS tablet screen.

### Q2: Customer Order Cancellation
*Can a customer cancel an order from their smartphone after submitting it?*
- **Recommendation**: Diners can only cancel an order while it is still in the `SUBMITTED` state (before cashier acceptance). Once accepted and dispatched to the kitchen (`ACCEPTED` / `KOT_PRINTED`), cancellation must be authorized by a cashier or manager.

### Q3: Discretionary Service Charge
*Do café tenants require a configurable Service Charge (e.g. 5% or 10%) added to the table bill?*
- **Recommendation**: Add an optional `serviceChargePercent` field to `cafeConfig` and `BillingEngine`. If set to `0.0`, no service charge is applied.

### Q4: Customer Dining Bill Splitting
*For MVP (Release 1), is standard split payment (e.g. ₹500 Cash + ₹500 UPI for the single bill) sufficient, or is seat-wise split billing required immediately?*
- **Recommendation**: Support multi-tender split payment in Release 1 (already supported by QuickBill's billing engine). Defer seat-by-seat / item-by-item split invoices to Release 3.

### Q5: Waiter / Captain Mobile Order Entry
*Do café staff need a dedicated mobile smartphone view to punch table orders on the floor, or is Web POS sufficient for Release 1?*
- **Recommendation**: In Release 1, waiters can either use the table QR code on their phone or punch orders directly on the Cashier Web POS. A dedicated floor-waiter view can be added to `apps/mobile` in Release 3.

