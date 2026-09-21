---
name: mongodb-data-modeling
description: >-
  Database design conventions, schema structures, tenant scoping (businessId),
  indexing strategy, multi-document ACID transactions, monetary Decimal128 handling,
  and aggregation pipelines for MongoDB.
---

# MongoDB Data Modeling & Database Guidelines

## 1. Core Data Conventions & Principles

### 1.1. Mandatory Multi-Tenant Identifier
Every single document (except global platform users/system logs) **MUST** include:
```json
"businessId": "ObjectId(...)"
```
Every query, update, and aggregation pipeline must filter by `{ businessId: currentBusinessId }`.

### 1.2. Monetary Representation
- **NEVER** use standard BSON double (float) for money balances, prices, or line totals.
- Use `BSON Decimal128` (or integer minor currency units / paise) to eliminate floating-point rounding errors.
- In Python / Pydantic, serialize and deserialize via `decimal.Decimal` and `bson.Decimal128`.

### 1.3. Historical Snapshotting Invariant
When creating financial documents (Invoices, Purchases, Credit Notes):
- Snapshot item attributes (`name`, `sku`, `unitPrice`, `taxRate`) at the moment of billing.
- If an item's master price or name changes tomorrow, past invoice totals and line items **MUST NEVER CHANGE**.

---

## 2. Core Collections & Schemas

### 2.1. `items` Collection
```json
{
  "_id": ObjectId("65f2a1b9e01..."),
  "businessId": ObjectId("65f2a1b9a00..."),
  "publicItemId": "itm_9f8a7b6c5d4e",
  "name": "Organic Almond Milk 1L",
  "sku": "ALM-1001",
  "qrPayload": "ITEM:itm_9f8a7b6c5d4e",
  "categoryId": ObjectId("65f2a1b9c00..."),
  "unit": "pcs",
  "purchasePrice": Decimal128("180.00"),
  "salePrice": Decimal128("240.00"),
  "taxRate": Decimal128("5.0"),
  "currentStock": 45,
  "minStockAlert": 10,
  "isActive": true,
  "createdAt": ISODate("2026-09-20T10:00:00Z"),
  "updatedAt": ISODate("2026-09-20T10:00:00Z")
}
```

### 2.2. `invoices` Collection (Sales)
```json
{
  "_id": ObjectId("65f2a1b9e99..."),
  "businessId": ObjectId("65f2a1b9a00..."),
  "invoiceNumber": "INV-2026-000142",
  "partyId": ObjectId("65f2a1b9d11..."),
  "partyNameSnapshot": "Aarav Sharma",
  "partyPhoneSnapshot": "+919876543210",
  "status": "CONFIRMED",
  "paymentStatus": "PARTIAL",
  "items": [
    {
      "itemId": ObjectId("65f2a1b9e01..."),
      "nameSnapshot": "Organic Almond Milk 1L",
      "skuSnapshot": "ALM-1001",
      "quantity": 2,
      "unitPrice": Decimal128("240.00"),
      "discountAmount": Decimal128("0.00"),
      "taxRate": Decimal128("5.0"),
      "taxAmount": Decimal128("24.00"),
      "lineTotal": Decimal128("504.00")
    }
  ],
  "subtotal": Decimal128("480.00"),
  "taxTotal": Decimal128("24.00"),
  "discountTotal": Decimal128("0.00"),
  "roundOff": Decimal128("0.00"),
  "grandTotal": Decimal128("504.00"),
  "paidAmount": Decimal128("300.00"),
  "balanceDue": Decimal128("204.00"),
  "createdByUserId": ObjectId("65f2a1b9u01..."),
  "createdAt": ISODate("2026-09-20T10:15:00Z")
}
```

### 2.3. `inventory_movements` (Immutable Stock Ledger)
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
  "quantityAfter": 43,
  "unitCost": Decimal128("180.00"),
  "notes": "Point of sale transaction",
  "createdAt": ISODate("2026-09-20T10:15:00Z")
}
```

---

## 3. MongoDB Indexing Strategy

```javascript
// Items Collection Indexes
db.items.createIndex({ businessId: 1, publicItemId: 1 }, { unique: true });
db.items.createIndex({ businessId: 1, sku: 1 }, { unique: true, sparse: true });
db.items.createIndex({ businessId: 1, name: "text" });
db.items.createIndex({ businessId: 1, categoryId: 1, isActive: 1 });

// Invoices Collection Indexes
db.invoices.createIndex({ businessId: 1, invoiceNumber: 1 }, { unique: true });
db.invoices.createIndex({ businessId: 1, createdAt: -1 });
db.invoices.createIndex({ businessId: 1, partyId: 1, createdAt: -1 });
db.invoices.createIndex({ businessId: 1, paymentStatus: 1, createdAt: -1 });

// Payments Collection Indexes
db.payments.createIndex({ businessId: 1, partyId: 1, paidAt: -1 });
db.payments.createIndex({ businessId: 1, invoiceId: 1 });

// Inventory Movement Ledger Indexes
db.inventory_movements.createIndex({ businessId: 1, itemId: 1, createdAt: -1 });
db.inventory_movements.createIndex({ businessId: 1, referenceType: 1, referenceId: 1 });

// Parties Collection Indexes
db.parties.createIndex({ businessId: 1, phone: 1 });
db.parties.createIndex({ businessId: 1, name: 1 });
```

---

## 4. Multi-Document ACID Transactions

Financial mutations (e.g., Sale Invoice Creation) require atomic multi-document writes across collections:
```python
from motor.motor_asyncio import AsyncIOMotorClient

async def create_invoice_transaction(client: AsyncIOMotorClient, business_id: str, invoice_doc: dict, movements: list, payment_doc: dict = None):
    async with await client.start_session() as session:
        async with session.start_transaction():
            db = client.get_default_database()
            
            # 1. Insert Invoice Document
            await db.invoices.insert_one(invoice_doc, session=session)
            
            # 2. Insert Stock Movements & Update Current Stock
            for movement in movements:
                await db.inventory_movements.insert_one(movement, session=session)
                await db.items.update_one(
                    {"_id": movement["itemId"], "businessId": movement["businessId"]},
                    {"$inc": {"currentStock": movement["quantityChange"]}},
                    session=session
                )
            
            # 3. Record Initial Payment if paidAmount > 0
            if payment_doc:
                await db.payments.insert_one(payment_doc, session=session)
            
            # 4. Update Party Balance Due
            if invoice_doc.get("partyId") and invoice_doc.get("balanceDue") > 0:
                await db.parties.update_one(
                    {"_id": invoice_doc["partyId"], "businessId": invoice_doc["businessId"]},
                    {"$inc": {"currentReceivable": invoice_doc["balanceDue"]}},
                    session=session
                )
```

---

## 5. Verification Checklist
- [ ] Every collection has compound indexes beginning with `businessId`.
- [ ] No `float` types stored for currency fields (use Decimal128).
- [ ] Multi-document writes run inside an active MongoDB transaction session.
- [ ] Product item master modifications do not alter existing finalized invoices.
