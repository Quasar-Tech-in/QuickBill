---
name: multi-tenant-security
description: >-
  Rules and architectural patterns for multi-tenant data isolation, businessId context
  extraction, cross-tenant leak prevention, IDOR protection, and tenant-scoped repository queries.
---

# Multi-Tenant Security & Tenant Isolation

## 1. Core Tenancy Model
The application operates as a **logical multi-tenant system**:
- A single MongoDB database instance contains all tenant data.
- Every tenant represents a distinct business (`businesses` collection).
- Users can belong to one or more businesses through the `business_members` collection with specific roles (`ADMIN`, `CASHIER`, `INVENTORY_STAFF`, `ACCOUNTANT`).
- Every business-scoped resource carries a mandatory `businessId` foreign key.

---

## 2. Inviolable Tenancy Rules

1. **NEVER TRUST CLIENT-SUPPLIED `businessId`**:
   The tenant ID must be resolved authoritatively by the backend authentication layer from the user's verified JWT session and business membership table.
2. **EVERY REPOSITORY QUERY MUST INCLUDE `businessId`**:
   Even if querying by a globally unique primary key (`_id`), the filter MUST ALWAYS include `businessId`:
   ```python
   # ❌ VULNERABLE TO IDOR (Cross-tenant data leak)
   item = await db.items.find_one({"_id": ObjectId(item_id)})

   # ✅ SECURE (Tenant-isolated)
   item = await db.items.find_one({"_id": ObjectId(item_id), "businessId": ObjectId(business_id)})
   ```
3. **FAIL CLOSED (404 NOT FOUND)**:
   If a user requests a resource ID that exists in the database but belongs to a different tenant, the API must return `404 Not Found` (NOT `403 Forbidden` with entity details), preventing tenant ID enumeration.
4. **QR CODE LOOKUP IS STRICTLY TENANT-SCOPED**:
   Scanning a valid `ITEM:<publicItemId>` from Store A while logged into Store B must return `404 Not Found`.

---

## 3. Implementation Pattern: Base Tenant Repository

```python
from typing import TypeVar, Generic, Optional, List, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class BaseTenantRepository(Generic[T]):
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self.collection = db[collection_name]

    async def get_by_id(self, business_id: str, document_id: str) -> Optional[dict]:
        return await self.collection.find_one({
            "_id": ObjectId(document_id),
            "businessId": ObjectId(business_id)
        })

    async def list_paginated(
        self,
        business_id: str,
        filter_query: dict,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "createdAt",
        sort_dir: int = -1
    ) -> List[dict]:
        # Enforce tenant isolation on custom filter query
        filter_query["businessId"] = ObjectId(business_id)
        cursor = self.collection.find(filter_query).sort(sort_by, sort_dir).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def delete_by_id(self, business_id: str, document_id: str) -> bool:
        res = await self.collection.delete_one({
            "_id": ObjectId(document_id),
            "businessId": ObjectId(business_id)
        })
        return res.deleted_count > 0
```

---

## 4. Cross-Tenant Security Testing Pattern

Always write automated integration tests verifying tenant isolation:

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_cross_tenant_item_access_blocked(api_client: AsyncClient, token_tenant_a: str, token_tenant_b: str):
    # 1. Create item in Tenant A
    headers_a = {"Authorization": f"Bearer {token_tenant_a}"}
    create_res = await api_client.post("/api/v1/items", json={
        "name": "Secret Product A",
        "purchase_price": "100.00",
        "sale_price": "150.00"
    }, headers=headers_a)
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # 2. Attempt to read Tenant A's item using Tenant B's credentials
    headers_b = {"Authorization": f"Bearer {token_tenant_b}"}
    read_res = await api_client.get(f"/api/v1/items/{item_id}", headers=headers_b)
    
    # Must return 404 (or 403), never 200
    assert read_res.status_code == 404
```

---

## 5. Verification Checklist
- [ ] No database query omits `{ "businessId": ... }`.
- [ ] Cross-tenant resource IDs return 404.
- [ ] QR lookups are constrained to the logged-in store.
- [ ] Automated cross-tenant tests pass in CI.
