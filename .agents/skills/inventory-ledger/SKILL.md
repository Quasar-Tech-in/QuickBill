---
name: inventory-ledger
description: >-
  Rules, schema structures, and transaction patterns for maintaining an immutable stock
  movement ledger, tracking real-time inventory, handling adjustments, and low-stock alerts.
---

# Inventory Ledger & Stock Movement Engine

## 1. Core Principles

1. **NO DIRECT STOCK MUTATION WITHOUT A LEDGER RECORD**:
   The `currentStock` field on an `item` is a materialized view. It **MUST NEVER** be mutated without appending an immutable audit record to `inventory_movements`.
2. **IMMUTABLE LEDGER ENTRIES**:
   Ledger movement documents cannot be updated or deleted. Corrections must be handled via compensating reversal movements (e.g., `ADJUSTMENT_INCREASE`, `ADJUSTMENT_DECREASE`, `SALE_RETURN`).
3. **RECONCILIATION INVARIANT**:
   At any time $t$, the sum of all historical movement quantities for an item must equal its current stock:
   $$\text{Current Stock} = \text{Opening Stock} + \sum \Delta \text{QuantityMovements}$$

---

## 2. Movement Types & Effect on Stock

| Movement Type | Code | Quantity Delta ($\Delta Q$) | Trigger Event |
| :--- | :--- | :--- | :--- |
| **Opening Stock** | `OPENING_STOCK` | $+Q$ | Initial product creation. |
| **Sale Outward** | `SALE` | $-Q$ | Sales Invoice confirmation. |
| **Sale Return** | `SALE_RETURN` | $+Q$ | Customer returns merchandise. |
| **Purchase Inward**| `PURCHASE` | $+Q$ | Purchase Bill / Goods received from supplier. |
| **Purchase Return**| `PURCHASE_RETURN` | $-Q$ | Goods returned back to vendor. |
| **Physical Count Adjustment** | `MANUAL_ADJUSTMENT` | $\pm Q$ | Stock audit / discrepancy reconciliation. |
| **Damaged / Expired** | `DAMAGED_WRITE_OFF`| $-Q$ | Stock discarded or expired. |

---

## 3. Inventory Movement Document Schema

```json
{
  "_id": ObjectId("65f2a1b9f55..."),
  "businessId": ObjectId("65f2a1b9a00..."),
  "itemId": ObjectId("65f2a1b9e01..."),
  "type": "SALE",
  "referenceType": "INVOICE",
  "referenceId": ObjectId("65f2a1b9e99..."),
  "referenceNumber": "INV-2026-000142",
  "quantityChange": -2,
  "quantityBefore": 45,
  "quantityAfter": 43,
  "unitCost": Decimal128("180.00"),
  "reason": "Sale to Aarav Sharma",
  "createdByUserId": ObjectId("65f2a1b9u01..."),
  "createdAt": ISODate("2026-09-20T10:15:00Z")
}
```

---

## 4. Atomic Stock Mutation Service (Python)

```python
from decimal import Decimal
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException, status

class InventoryLedgerService:
    @staticmethod
    async def record_stock_movement(
        client: AsyncIOMotorClient,
        session,
        business_id: str,
        item_id: str,
        movement_type: str,
        quantity_change: int,
        reference_type: str,
        reference_id: str,
        reference_number: str,
        unit_cost: Decimal,
        user_id: str,
        reason: str = ""
    ) -> int:
        db = client.get_default_database()
        
        # 1. Fetch current stock with lock / within transaction
        item = await db.items.find_one(
            {"_id": ObjectId(item_id), "businessId": ObjectId(business_id)},
            session=session
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        qty_before = item["currentStock"]
        qty_after = qty_before + quantity_change

        # 2. Enforce negative stock prevention if configured
        if qty_after < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{item['name']}'. Available: {qty_before}, Requested: {abs(quantity_change)}"
            )

        # 3. Create movement document
        movement_doc = {
            "businessId": ObjectId(business_id),
            "itemId": ObjectId(item_id),
            "type": movement_type,
            "referenceType": reference_type,
            "referenceId": ObjectId(reference_id),
            "referenceNumber": reference_number,
            "quantityChange": quantity_change,
            "quantityBefore": qty_before,
            "quantityAfter": qty_after,
            "unitCost": unit_cost,
            "reason": reason,
            "createdByUserId": ObjectId(user_id),
            "createdAt": datetime.utcnow()
        }
        await db.inventory_movements.insert_one(movement_doc, session=session)

        # 4. Atomically update materialized currentStock
        await db.items.update_one(
            {"_id": ObjectId(item_id), "businessId": ObjectId(business_id)},
            {"$set": {"currentStock": qty_after, "updatedAt": datetime.utcnow()}},
            session=session
        )

        return qty_after
```

---

## 5. Low-Stock Alert Calculation
Low-stock queries use indexed compound queries:
```python
async def get_low_stock_items(db, business_id: str):
    return await db.items.find({
        "businessId": ObjectId(business_id),
        "isActive": True,
        "$expr": { "$lte": ["$currentStock", "$minStockAlert"] }
    }).to_list(length=100)
```

---

## 6. Verification Checklist
- [ ] No stock update occurs without an accompanying `inventory_movements` record.
- [ ] Negative inventory restrictions block invalid sales transactions.
- [ ] Stock adjustments audit records track user ID and discrepancy reasons.
- [ ] Low-stock banner reflects on Home dashboard when items reach threshold.
