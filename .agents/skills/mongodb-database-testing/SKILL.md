---
name: mongodb-database-testing
description: >-
  Database testing, schema validation, ACID transaction integrity, multi-tenant index optimization,
  query deduplication, and security auditing for MongoDB collections.
---

# MongoDB Database Testing, Schema Integrity & Security Audit Standards

This skill defines the testing, validation, optimization, and security audit guidelines for the MongoDB database layer supporting the billing and inventory platform.

---

## 1. Schema Validation & Data Type Integrity Testing

### 1.1. Monetary & Precision Rules (Zero-Float Policy)
- **Rule**: Currency, unit prices, discounts, tax rates, balances, and stock quantities with fractional units **MUST NEVER** be stored as standard IEEE 754 floating point numbers (`double`).
- **Standard**: Store as `Decimal128` (BSON type 19) or integer cents/paise.
- **Test Assertion**: Verify all monetary and quantity fields deserialize to Python `decimal.Decimal` and round accurately.

```python
import pytest
from decimal import Decimal
from bson import Decimal128
from app.models.item import ItemDocument

def test_item_schema_rejects_float_precision_loss():
    # Attempting to assign floating-point to decimal monetary field must be guarded
    doc = ItemDocument(
        business_id="biz_123",
        name="Rice (Basmati)",
        sale_price=Decimal("120.50"),
        purchase_price=Decimal("95.25"),
        current_stock=Decimal("50.750")  # Fractional kg
    )
    doc_dict = doc.to_mongo()
    
    # Assert BSON type is Decimal128 in MongoDB payload
    assert isinstance(doc_dict["sale_price"], Decimal128)
    assert doc_dict["sale_price"].to_decimal() == Decimal("120.50")
    assert isinstance(doc_dict["current_stock"], Decimal128)
```

### 1.2. Schema Drift & Required Field Test
- Automated schema validation suite checking that every collection document contains required tenant keys, timestamps (`created_at`, `updated_at`), and status enums.
- Tests to detect obsolete fields or missing migration defaults across document versions.

---

## 2. Multi-Tenant Indexing & Query Performance Testing

```text
┌────────────────────────────────────────────────────────────────────────┐
│                     INDEX DESIGN MANDATORY RULES                       │
├─────────────────────────┬──────────────────────────────────────────────┤
│ 1. Compound Prefix      │ ALL indexes MUST have { business_id: 1, ...} │
│ 2. Unique Constraints   │ Must be compound: { business_id: 1, sku: 1 } │
│ 3. Sort Optimization    │ Equality first, Sort second, Range last (ESR)│
│ 4. No Full Collscans    │ Every find/aggregate query must hit an index │
└─────────────────────────┴──────────────────────────────────────────────┘
```

### 2.1. Tenant Index Completeness Automated Test
```python
import pytest

MANDATORY_INDEXES = {
    "items": [
        [("business_id", 1), ("sku", 1)],
        [("business_id", 1), ("name", 1)],
        [("business_id", 1), ("is_active", 1), ("category_id", 1)],
    ],
    "sales_invoices": [
        [("business_id", 1), ("invoice_number", 1)],
        [("business_id", 1), ("invoice_date", -1)],
        [("business_id", 1), ("customer_id", 1), ("payment_status", 1)],
    ],
    "stock_ledger": [
        [("business_id", 1), ("item_id", 1), ("created_at", -1)],
        [("business_id", 1), ("reference_id", 1)],
    ]
}

@pytest.mark.asyncio
async def test_all_collections_have_tenant_scoped_indexes(db_client):
    for collection_name, required_indexes in MANDATORY_INDEXES.items():
        existing_indexes = await db_client[collection_name].index_information()
        existing_key_sets = [idx["key"] for idx in existing_indexes.values()]
        
        for required_idx in required_indexes:
            assert required_idx in existing_key_sets, (
                f"Missing index on {collection_name}: {required_idx}. "
                "Queries will result in COLLSCAN across tenants!"
            )
```

### 2.2. Query Plan & ESR Rule Audit
- Check `explain("executionStats")` in query tests to verify `totalDocsExamined == nReturned` and `stage != "COLLSCAN"`.
- Reject non-prefixed unique indexes (e.g., unique `{ sku: 1 }` breaks multi-tenancy because Tenant B cannot use Tenant A's SKU).

---

## 3. ACID Multi-Document Transactions & Race Condition Testing

### 3.1. Inventory & Ledger Atomicity Test
When an invoice is created, the system must atomically:
1. Insert the `sales_invoices` record.
2. Insert entries into `stock_ledger`.
3. Decrement `current_stock` in `items`.
4. Update `customer_balance` in `parties`.

If any step fails (e.g., insufficient stock or network timeout), the entire transaction **must roll back**:

```python
@pytest.mark.asyncio
async def test_atomic_rollback_on_invoice_stock_failure(db_session, sales_service, item_repository):
    # Setup initial stock of 5 units
    item = await item_repository.create({"name": "Special Tea", "current_stock": Decimal("5.0")})
    
    # Attempt to sell 10 units with strict stock validation enabled
    with pytest.raises(InsufficientStockException):
        await sales_service.create_invoice(
            items=[{"item_id": item.id, "quantity": Decimal("10.0")}],
            session=db_session
        )
    
    # Verify rollback: Stock must still be 5, no orphan ledger entry, no orphan invoice
    reloaded_item = await item_repository.get_by_id(item.id)
    assert reloaded_item.current_stock == Decimal("5.0")
    
    ledger_entries = await db_session.client.db.stock_ledger.count_documents({"item_id": item.id})
    assert ledger_entries == 0
```

### 3.2. Concurrency & Optimistic Concurrency Control (OCC)
- Use version keys (`version: int`) or atomic operators (`$inc`, `$set` with filter conditions) to prevent race conditions during concurrent POS sales.

---

## 4. Query Deduplication & Anti-Pattern Detection

1. **N+1 Aggregation & Lookup Anti-Pattern**:
   - *Bad*: Querying 100 sales invoices, then looping in Python to perform 100 separate `find_one({"_id": customer_id})` queries.
   - *Good*: Use a single `$lookup` stage with `$pipeline` scoped by `business_id` or batch-fetch party IDs via `$in` map.
2. **Duplicate Aggregation Pipelines**:
   - Consolidate reusable aggregation pipeline stages (e.g., standard tenant filter stage, date-range filter stage, monetary sum stages) into shared pipeline builder utilities.
3. **Over-Fetching / Unbounded Queries**:
   - Every `find()` query without an explicit `limit()` is a critical anti-pattern. Enforce default pagination (max 50-100 records).

---

## 5. Security Patterns & Penetration Hardening for MongoDB

1. **NoSQL Query Operator Injection**:
   - Never allow user input dicts directly into filter predicates (e.g., `{ "password": { "$ne": null } }`).
   - Cast all ID params to valid `ObjectId` or validate strings through Pydantic schemas.
2. **Strict Multi-Tenant Query Scoping**:
   - Every read, update, delete, and aggregation **must explicitly start with** `{"business_id": tenant_id}`.
3. **Data Masking & Sensitive Field Protection**:
   - Mask credentials, auth tokens, banking passwords, and sensitive tax credentials. Never store unhashed passwords or raw payment card details.

---

## 6. Database Quality Rating Scorecard

| Assessment Dimension | Weight | Target Criteria |
|---|:---:|---|
| **Schema Strictness & Monetary Precision** | 25% | 100% `Decimal128`/exact integer for currency & quantities; explicit Pydantic-to-BSON mapping; no float drift. |
| **Multi-Tenant Index Optimization** | 25% | All indexes prefixed with `business_id`; zero global unique indexes; zero unindexed collection scans. |
| **ACID Multi-Document Transactions** | 20% | All multi-collection mutations executed inside transactional sessions with verified rollback tests. |
| **Query Performance & Deduplication** | 15% | Reusable aggregation stages; zero N+1 query patterns; mandatory pagination limits on all collections. |
| **Security & Injection Immunity** | 15% | Zero raw dict filter ingestion; strict ObjectId validation; sensitive field masking and encryption. |

### Quality Gates
- **Score >= 90**: Approved for High-Volume Production.
- **Score < 75**: Block deployment until missing indexes, float precision, or non-transactional stock mutations are resolved.
