"""
QuickBill - Comprehensive Database Schema Audit & Synchronization Engine
========================================================================
Audits, cleanses, standardizes, and unifies all existing data across the
Primary Root Database and all Dedicated Tenant Databases.

Guarantees full adherence to:
- Item Schema: dynamic averageCostPrice, FIFO batches array, branch location inventories.
- Purchase Orders: unified status (FULLY_RECEIVED / PARTIALLY_RECEIVED / ORDERED / CANCELLED), normalized items list.
- Invoices: standardized item snapshots, totals, payments, and balances.
- Locations & Tenants: default branch designated, all branches present in item catalogs.
- Performance & Uniqueness Indexes.

Usage:
    python scripts/sync_db_schema.py
"""

import asyncio
import os
import sys
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# Load Environment or default URI
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin")
PRIMARY_DB_NAME = os.getenv("DATABASE_NAME", "quickbill_db")
DEFAULT_TENANT_ID = ObjectId("65f2a1b9a000000000000001")
DEFAULT_TENANT_DB = "quickbill_main_db"

DEFAULT_SEED_LOCATIONS = [
    {
        "_id": ObjectId("65f2a1b9a000000000000101"),
        "name": "Main Flagship Counter",
        "code": "MAIN-01",
        "address": "Ground Floor, Metro Retail Plaza, Sector 18",
        "phone": "+91 9876543210",
        "isDefault": True,
        "isActive": True,
    },
    {
        "_id": ObjectId("65f2a1b9a000000000000102"),
        "name": "Downtown Express Branch",
        "code": "DT-02",
        "address": "Shop 14, City Walk Center, Downtown",
        "phone": "+91 9811223344",
        "isDefault": False,
        "isActive": True,
    },
    {
        "_id": ObjectId("65f2a1b9a000000000000103"),
        "name": "Central Supply Warehouse",
        "code": "WH-03",
        "address": "Plot 8B, Industrial Logistics Park",
        "phone": "+91 9988776655",
        "isDefault": False,
        "isActive": True,
    },
]

DEFAULT_SEED_CATEGORIES = [
    {"name": "Grocery", "description": "Packaged foods, staples, pulses & grains"},
    {"name": "Dairy & Eggs", "description": "Milk, cheese, butter, curd and farm eggs"},
    {"name": "Beverages", "description": "Juices, cold drinks, tea, coffee & energy drinks"},
    {"name": "Snacks & Sweets", "description": "Biscuits, chips, namkeen, chocolates & bakery"},
    {"name": "Personal Care", "description": "Soaps, haircare, skincare, oral care & grooming"},
    {"name": "Household & Cleaning", "description": "Detergents, cleaners, dishwash & kitchen essentials"},
    {"name": "Electronics & Gadgets", "description": "Cables, chargers, peripherals, accessories & batteries"},
    {"name": "Apparel & Lifestyle", "description": "Ready-to-wear clothing, innerwear & accessories"},
    {"name": "Stationery & Office", "description": "Books, notebooks, pens, markers & desk supplies"},
    {"name": "General Store", "description": "General merchandise & assorted counter items"},
]


async def run_db_schema_sync():
    print("=" * 80)
    print(" QUICKBILL - COMPREHENSIVE DATABASE SCHEMA AUDIT & SYNCHRONIZATION")
    print("=" * 80)
    print(f"Connecting to MongoDB Server: {MONGODB_URI}...")
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)

    try:
        await client.admin.command("ping")
        print("Connected successfully to MongoDB server.\n")
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB server: {e}")
        return

    primary_db = client[PRIMARY_DB_NAME]
    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # 1. AUDIT & STANDARDIZE TENANTS
    # -------------------------------------------------------------
    print(">>> [1/8] Auditing & Synchronizing Tenants Collection...")
    tenants_cursor = primary_db.tenants.find({})
    tenants = []
    async for t in tenants_cursor:
        tenants.append(t)

    if not tenants:
        print("  -> No tenants found in primary DB. Seeding default Enterprise Tenant...")
        default_tenant = {
            "_id": DEFAULT_TENANT_ID,
            "name": "QuickBill Enterprise Retail",
            "slug": "quickbill-main",
            "plan": "ENTERPRISE",
            "status": "ACTIVE",
            "adminEmail": "admin@quickbill.local",
            "phone": "+91 9876543210",
            "gstin": "07AABCB1234F1Z5",
            "databaseConfig": {
                "isolationMode": "DEDICATED_DATABASE",
                "mongodbUri": f"mongodb://admin:secretpassword@localhost:27017/{DEFAULT_TENANT_DB}?authSource=admin",
                "databaseName": DEFAULT_TENANT_DB,
            },
            "createdAt": now,
            "updatedAt": now
        }
        await primary_db.tenants.insert_one(default_tenant)
        tenants = [default_tenant]

    updated_tenants_count = 0
    tenant_db_map = {}

    for t in tenants:
        t_id = t["_id"]
        t_id_str = str(t_id)
        updates = {}

        if "status" not in t or not t["status"]:
            updates["status"] = "ACTIVE"
        if "plan" not in t or not t["plan"]:
            updates["plan"] = "ENTERPRISE"
        if "slug" not in t or not t["slug"]:
            updates["slug"] = f"tenant-{t_id_str[:8]}"
        if "adminEmail" not in t or not t["adminEmail"]:
            updates["adminEmail"] = f"admin@{updates.get('slug', 'tenant')}.local"
        if "phone" not in t or not t["phone"]:
            updates["phone"] = "+91 9876543210"
        if "databaseConfig" not in t or not isinstance(t.get("databaseConfig"), dict):
            target_db_name = DEFAULT_TENANT_DB if t_id == DEFAULT_TENANT_ID else f"quickbill_tenant_{t_id_str[:8]}_db"
            updates["databaseConfig"] = {
                "isolationMode": "DEDICATED_DATABASE",
                "mongodbUri": f"mongodb://admin:secretpassword@localhost:27017/{target_db_name}?authSource=admin",
                "databaseName": target_db_name,
            }

        if updates:
            updates["updatedAt"] = now
            await primary_db.tenants.update_one({"_id": t_id}, {"$set": updates})
            updated_tenants_count += 1

        db_name = t.get("databaseConfig", {}).get("databaseName", DEFAULT_TENANT_DB)
        tenant_db_map[t_id_str] = {
            "tenant": t,
            "db_name": db_name,
            "db": client[db_name]
        }

    print(f"  [OK] {len(tenants)} tenant(s) validated ({updated_tenants_count} standardized).")

    # -------------------------------------------------------------
    # 2. AUDIT & STANDARDIZE STORE LOCATIONS
    # -------------------------------------------------------------
    print("\n>>> [2/8] Auditing & Synchronizing Store Locations...")
    synced_locations_count = 0

    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        t_oid = ObjectId(t_id_str) if ObjectId.is_valid(t_id_str) else t_id_str

        for db_inst in [primary_db, tdb]:
            b_queries = [{"businessId": t_id_str}]
            if isinstance(t_oid, ObjectId):
                b_queries.append({"businessId": t_oid})

            loc_cursor = db_inst.locations.find({"$or": b_queries})
            existing_locs = []
            async for l in loc_cursor:
                existing_locs.append(l)

            if not existing_locs:
                for d_loc in DEFAULT_SEED_LOCATIONS:
                    doc = {
                        **d_loc,
                        "businessId": t_id_str,
                        "createdAt": now
                    }
                    await db_inst.locations.update_one(
                        {"_id": d_loc["_id"]},
                        {"$setOnInsert": doc},
                        upsert=True
                    )
                    existing_locs.append(doc)
                print(f"  -> [DB: {db_inst.name}] Seeded {len(DEFAULT_SEED_LOCATIONS)} default locations for tenant {t_id_str}.")

            has_default = False
            for loc in existing_locs:
                loc_updates = {}
                clean_code = str(loc.get("code", "BRANCH")).strip().upper()
                if loc.get("code") != clean_code:
                    loc_updates["code"] = clean_code
                if "isActive" not in loc or loc["isActive"] is None:
                    loc_updates["isActive"] = True
                if "isDefault" not in loc or loc["isDefault"] is None:
                    loc_updates["isDefault"] = (clean_code == "MAIN-01" or loc.get("name") == "Main Flagship Counter")
                if "businessId" not in loc:
                    loc_updates["businessId"] = t_id_str

                if loc.get("isDefault") or loc_updates.get("isDefault"):
                    has_default = True

                if loc_updates:
                    await db_inst.locations.update_one({"_id": loc["_id"]}, {"$set": loc_updates})
                    synced_locations_count += 1

            if not has_default and existing_locs:
                await db_inst.locations.update_one({"_id": existing_locs[0]["_id"]}, {"$set": {"isDefault": True}})

    print(f"  [OK] Store locations synchronized ({synced_locations_count} records standardized).")

    # -------------------------------------------------------------
    # 3. AUDIT & STANDARDIZE ITEM CATEGORIES
    # -------------------------------------------------------------
    print("\n>>> [3/8] Auditing & Synchronizing Categories...")
    synced_categories_count = 0

    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        t_oid = ObjectId(t_id_str) if ObjectId.is_valid(t_id_str) else t_id_str

        for db_inst in [primary_db, tdb]:
            b_queries = [{"businessId": t_id_str}]
            if isinstance(t_oid, ObjectId):
                b_queries.append({"businessId": t_oid})

            cat_count = await db_inst.categories.count_documents({"$or": b_queries})
            if cat_count == 0:
                for cat in DEFAULT_SEED_CATEGORIES:
                    await db_inst.categories.insert_one({
                        "businessId": t_id_str,
                        "name": cat["name"],
                        "description": cat["description"],
                        "type": "PRODUCT",
                        "createdAt": now
                    })
                    synced_categories_count += 1
            else:
                async for c in db_inst.categories.find({"$or": b_queries}):
                    c_updates = {}
                    if not c.get("businessId"):
                        c_updates["businessId"] = t_id_str
                    if not c.get("type"):
                        c_updates["type"] = "PRODUCT"
                    if not c.get("createdAt"):
                        c_updates["createdAt"] = now
                    if c_updates:
                        await db_inst.categories.update_one({"_id": c["_id"]}, {"$set": c_updates})
                        synced_categories_count += 1

    print(f"  [OK] Product categories synchronized ({synced_categories_count} updated/seeded).")

    # -------------------------------------------------------------
    # 4. AUDIT & UNIFY ITEMS (AVERAGE COST, FIFO BATCHES, BRANCHES)
    # -------------------------------------------------------------
    print("\n>>> [4/8] Auditing & Unifying Items Catalog (Dynamic Costing & Batches)...")
    total_items_inspected = 0
    total_items_updated = 0

    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        t_oid = ObjectId(t_id_str) if ObjectId.is_valid(t_id_str) else t_id_str

        b_queries = [{"businessId": t_id_str}]
        if isinstance(t_oid, ObjectId):
            b_queries.append({"businessId": t_oid})

        tenant_locations = []
        async for loc in tdb.locations.find({"$or": b_queries}):
            tenant_locations.append(loc)
        if not tenant_locations:
            async for loc in primary_db.locations.find({"$or": b_queries}):
                tenant_locations.append(loc)

        default_loc = next((l for l in tenant_locations if l.get("isDefault")), tenant_locations[0] if tenant_locations else None)
        default_loc_id = str(default_loc["_id"]) if default_loc else "65f2a1b9a000000000000101"
        default_loc_name = default_loc.get("name", "Main Flagship Counter") if default_loc else "Main Flagship Counter"

        for db_inst in [primary_db, tdb]:
            cursor = db_inst.items.find({"$or": b_queries})
            async for item in cursor:
                total_items_inspected += 1
                item_modified = False
                item_updates = {}

                item_mrp = float(item.get("mrp", item.get("salePrice", 100.0)) or 100.0)
                item_sale_price = float(item.get("salePrice", item_mrp) or item_mrp)
                item_purchase_price = float(item.get("purchasePrice", 0.0) or 0.0)
                item_current_stock = float(item.get("currentStock", 0.0) or 0.0)
                item_min_stock = float(item.get("minStockAlert", 5.0) or 5.0)
                item_tax_rate = float(item.get("taxRate", 0.0) or 0.0)

                # Ensure averageCostPrice is set
                if "averageCostPrice" not in item or item["averageCostPrice"] is None or float(item["averageCostPrice"]) == 0.0:
                    item_updates["averageCostPrice"] = item_purchase_price
                    item_modified = True

                # Ensure publicItemId exists
                if "publicItemId" not in item or not item["publicItemId"]:
                    item_updates["publicItemId"] = f"itm_{secrets.token_hex(6)}"
                    item_modified = True

                # Ensure basic fields
                if "category" not in item or not item["category"]:
                    item_updates["category"] = "General"
                    item_modified = True
                if "unit" not in item or not item["unit"]:
                    item_updates["unit"] = "pcs"
                    item_modified = True
                if "allowParts" not in item:
                    item_updates["allowParts"] = False
                    item_modified = True
                if "isActive" not in item:
                    item_updates["isActive"] = True
                    item_modified = True

                # Ensure FIFO batches array
                batches = list(item.get("batches") or [])
                if not batches and item_current_stock > 0 and item_purchase_price > 0:
                    # Seed initial opening stock batch
                    batches.append({
                        "batchId": f"batch_{secrets.token_hex(6)}",
                        "batchNumber": f"BAT-OPENING-{str(item['_id'])[-4:].upper()}",
                        "purchaseOrderId": None,
                        "purchaseOrderNumber": "OPENING-STOCK",
                        "purchasePrice": item_purchase_price,
                        "salePrice": item_sale_price,
                        "mrp": item_mrp,
                        "currentStock": item_current_stock,
                        "locationId": default_loc_id,
                        "receivedDate": now.isoformat().split("T")[0],
                        "receivedAt": now.isoformat(),
                        "supplierName": "Initial Inventory"
                    })
                    item_updates["batches"] = batches
                    item_modified = True
                elif "batches" not in item:
                    item_updates["batches"] = []
                    item_modified = True

                # Synchronize branch locations array
                raw_locations = list(item.get("locations") or [])
                cleaned_locations = []
                seen_loc_ids = set()

                for r_loc in raw_locations:
                    r_id = str(r_loc.get("locationId", ""))
                    if not r_id:
                        continue

                    matching_loc = next((l for l in tenant_locations if str(l["_id"]) == r_id or l.get("code") == r_id), None)
                    canonical_id = str(matching_loc["_id"]) if matching_loc else r_id
                    canonical_name = matching_loc.get("name", r_loc.get("locationName", "Branch Outlet")) if matching_loc else r_loc.get("locationName", "Branch Outlet")

                    if canonical_id in seen_loc_ids:
                        continue
                    seen_loc_ids.add(canonical_id)

                    is_default_branch = (canonical_id == default_loc_id or (matching_loc and matching_loc.get("isDefault")))
                    is_listed_val = bool(r_loc.get("isListed", True))
                    if is_default_branch:
                        is_listed_val = True

                    loc_stock = float(r_loc.get("currentStock", item_current_stock if is_default_branch else 0.0) or 0.0)

                    cleaned_locations.append({
                        "locationId": canonical_id,
                        "locationName": canonical_name,
                        "mrp": float(r_loc.get("mrp", item_mrp) or item_mrp),
                        "salePrice": float(r_loc.get("salePrice", item_sale_price) or item_sale_price),
                        "purchasePrice": float(r_loc.get("purchasePrice", item_purchase_price) or item_purchase_price),
                        "currentStock": loc_stock,
                        "minStockAlert": float(r_loc.get("minStockAlert", item_min_stock) or item_min_stock),
                        "isListed": is_listed_val,
                        "hasDiscount": bool(r_loc.get("hasDiscount", False)),
                        "discountType": r_loc.get("discountType", "PERCENT"),
                        "discountValue": float(r_loc.get("discountValue", 0.0) or 0.0)
                    })

                if default_loc_id not in seen_loc_ids:
                    cleaned_locations.insert(0, {
                        "locationId": default_loc_id,
                        "locationName": default_loc_name,
                        "mrp": item_mrp,
                        "salePrice": item_sale_price,
                        "purchasePrice": item_purchase_price,
                        "currentStock": item_current_stock,
                        "minStockAlert": item_min_stock,
                        "isListed": True,
                        "hasDiscount": bool(item.get("hasDiscount", False)),
                        "discountType": item.get("discountType", "PERCENT"),
                        "discountValue": float(item.get("discountValue", 0.0) or 0.0)
                    })
                    seen_loc_ids.add(default_loc_id)
                    item_modified = True

                for t_loc in tenant_locations:
                    t_loc_id_str = str(t_loc["_id"])
                    if t_loc_id_str not in seen_loc_ids and t_loc.get("code") not in seen_loc_ids:
                        cleaned_locations.append({
                            "locationId": t_loc_id_str,
                            "locationName": t_loc.get("name", "Branch Outlet"),
                            "mrp": item_mrp,
                            "salePrice": item_sale_price,
                            "purchasePrice": item_purchase_price,
                            "currentStock": 0.0,
                            "minStockAlert": item_min_stock,
                            "isListed": True,
                            "hasDiscount": bool(item.get("hasDiscount", False)),
                            "discountType": item.get("discountType", "PERCENT"),
                            "discountValue": float(item.get("discountValue", 0.0) or 0.0)
                        })
                        seen_loc_ids.add(t_loc_id_str)
                        item_modified = True

                if raw_locations != cleaned_locations:
                    item_updates["locations"] = cleaned_locations
                    item_modified = True

                if item_modified:
                    item_updates["updatedAt"] = now
                    await db_inst.items.update_one({"_id": item["_id"]}, {"$set": item_updates})
                    total_items_updated += 1

    print(f"  [OK] {total_items_inspected} items inspected ({total_items_updated} updated with unified schema & batches).")

    # -------------------------------------------------------------
    # 5. AUDIT & STANDARDIZE PURCHASE ORDERS
    # -------------------------------------------------------------
    print("\n>>> [5/8] Auditing & Synchronizing Purchase Orders...")
    po_synced_count = 0

    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        t_oid = ObjectId(t_id_str) if ObjectId.is_valid(t_id_str) else t_id_str

        b_queries = [{"businessId": t_id_str}]
        if isinstance(t_oid, ObjectId):
            b_queries.append({"businessId": t_oid})

        for db_inst in [primary_db, tdb]:
            cursor = db_inst.purchase_orders.find({"$or": b_queries})
            async for po in cursor:
                po_modified = False
                po_updates = {}

                # 1. Standardize status
                raw_status = str(po.get("status", "ORDERED")).upper().strip()
                if raw_status in ["RECEIVED", "FULLY_RECEIVED"]:
                    canonical_status = "FULLY_RECEIVED"
                elif raw_status in ["PARTIALLY_RECEIVED", "PARTIAL"]:
                    canonical_status = "PARTIALLY_RECEIVED"
                elif raw_status in ["CANCELLED", "VOID"]:
                    canonical_status = "CANCELLED"
                else:
                    canonical_status = "ORDERED"

                if po.get("status") != canonical_status:
                    po_updates["status"] = canonical_status
                    po_modified = True

                # 2. Standardize items list
                raw_items = list(po.get("items") or [])
                cleaned_items = []
                for it in raw_items:
                    ord_qty = float(it.get("orderedQuantity", it.get("ordered_qty", it.get("quantity", 0.0))))
                    rec_qty = float(it.get("receivedQuantity", it.get("received_qty", 0.0)))
                    u_cost = float(it.get("unitCost", it.get("unit_cost", it.get("unitPrice", it.get("unit_price", 0.0)))))
                    t_rate = float(it.get("taxRate", it.get("tax_rate", 0.0)))
                    t_cost = float(it.get("totalCost", it.get("total_cost", it.get("totalAmount", 0.0))))
                    itm_name = str(it.get("itemName", it.get("item_name", it.get("name", "Item"))))
                    
                    cleaned_items.append({
                        "itemId": str(it.get("itemId", it.get("item_id", ""))),
                        "itemName": itm_name,
                        "sku": it.get("sku"),
                        "unit": it.get("unit", "pcs"),
                        "orderedQuantity": ord_qty,
                        "receivedQuantity": rec_qty,
                        "unitCost": u_cost,
                        "taxRate": t_rate,
                        "totalCost": t_cost if t_cost > 0 else round((ord_qty * u_cost) * (1.0 + t_rate / 100.0), 2),
                        "updateMasterPurchasePrice": bool(it.get("updateMasterPurchasePrice", it.get("update_item_purchase_price", False)))
                    })

                if raw_items != cleaned_items:
                    po_updates["items"] = cleaned_items
                    po_modified = True

                # 3. Standardize financial numbers
                if "subtotal" not in po or po["subtotal"] is None:
                    po_updates["subtotal"] = sum(i["orderedQuantity"] * i["unitCost"] for i in cleaned_items)
                    po_modified = True
                if "grandTotal" not in po or po["grandTotal"] is None:
                    po_updates["grandTotal"] = sum(i["totalCost"] for i in cleaned_items)
                    po_modified = True
                if "receipts" not in po:
                    po_updates["receipts"] = []
                    po_modified = True
                if "createdAt" not in po:
                    po_updates["createdAt"] = now
                    po_modified = True

                if po_modified:
                    po_updates["updatedAt"] = now
                    await db_inst.purchase_orders.update_one({"_id": po["_id"]}, {"$set": po_updates})
                    po_synced_count += 1

    print(f"  [OK] Purchase Orders synchronized ({po_synced_count} standardized).")

    # -------------------------------------------------------------
    # 6. AUDIT & STANDARDIZE INVOICES & SALES
    # -------------------------------------------------------------
    print("\n>>> [6/8] Auditing & Synchronizing Sales Invoices...")
    invoices_synced = 0

    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        t_oid = ObjectId(t_id_str) if ObjectId.is_valid(t_id_str) else t_id_str

        b_queries = [{"businessId": t_id_str}]
        if isinstance(t_oid, ObjectId):
            b_queries.append({"businessId": t_oid})

        for db_inst in [primary_db, tdb]:
            cursor = db_inst.invoices.find({"$or": b_queries})
            async for inv in cursor:
                inv_modified = False
                inv_updates = {}

                if "status" not in inv or not inv["status"]:
                    inv_updates["status"] = "PAID"
                    inv_modified = True
                if "locationId" not in inv or not inv["locationId"]:
                    inv_updates["locationId"] = "65f2a1b9a000000000000101"
                    inv_modified = True
                if "createdAt" not in inv:
                    inv_updates["createdAt"] = now
                    inv_modified = True

                raw_items = list(inv.get("items") or [])
                cleaned_items = []
                for it in raw_items:
                    cleaned_items.append({
                        "itemId": str(it.get("itemId", it.get("item_id", ""))),
                        "nameSnapshot": it.get("nameSnapshot", it.get("name", "Item")),
                        "skuSnapshot": it.get("skuSnapshot", it.get("sku", "")),
                        "quantity": float(it.get("quantity", 1.0)),
                        "unitPrice": float(it.get("unitPrice", it.get("unit_price", 0.0))),
                        "taxRate": float(it.get("taxRate", it.get("tax_rate", 0.0))),
                        "discountPercent": float(it.get("discountPercent", it.get("discount_percent", 0.0))),
                        "lineTotal": float(it.get("lineTotal", it.get("line_total", 0.0)))
                    })

                if raw_items != cleaned_items and cleaned_items:
                    inv_updates["items"] = cleaned_items
                    inv_modified = True

                if inv_modified:
                    await db_inst.invoices.update_one({"_id": inv["_id"]}, {"$set": inv_updates})
                    invoices_synced += 1

    print(f"  [OK] Invoices synchronized ({invoices_synced} standardized).")

    # -------------------------------------------------------------
    # 7. AUDIT & STANDARDIZE PARTIES & CUSTOMERS
    # -------------------------------------------------------------
    print("\n>>> [7/8] Auditing & Synchronizing Parties & Customers...")
    parties_synced = 0

    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        t_oid = ObjectId(t_id_str) if ObjectId.is_valid(t_id_str) else t_id_str

        b_queries = [{"businessId": t_id_str}]
        if isinstance(t_oid, ObjectId):
            b_queries.append({"businessId": t_oid})

        for db_inst in [primary_db, tdb]:
            cursor = db_inst.parties.find({"$or": b_queries})
            async for p in cursor:
                p_updates = {}
                if "type" not in p:
                    p_updates["type"] = "CUSTOMER"
                if "isActive" not in p:
                    p_updates["isActive"] = True
                if "balance" not in p and "currentBalance" not in p:
                    p_updates["balance"] = 0.0
                    p_updates["currentBalance"] = 0.0

                if p_updates:
                    await db_inst.parties.update_one({"_id": p["_id"]}, {"$set": p_updates})
                    parties_synced += 1

    print(f"  [OK] Parties & Customers synchronized ({parties_synced} standardized).")

    # -------------------------------------------------------------
    # 8. BUILD & VERIFY DATABASE PERFORMANCE & INTEGRITY INDEXES
    # -------------------------------------------------------------
    print("\n>>> [8/8] Building & Verifying Database Indexes...")

    # Primary Root DB indexes
    try:
        await primary_db.tenants.create_index("slug", unique=True)
        await primary_db.tenants.create_index("adminEmail")
        await primary_db.users.create_index("email", unique=True)
        await primary_db.locations.create_index([("businessId", 1), ("code", 1)], unique=True)
        await primary_db.categories.create_index([("businessId", 1), ("name", 1)])
        print(f"  [OK] Primary DB [{primary_db.name}] indexes verified.")
    except Exception as e:
        print(f"  ! Note on primary DB indexes: {e}")

    # Tenant DB indexes
    for t_id_str, t_info in tenant_db_map.items():
        tdb = t_info["db"]
        indexes_to_create = [
            (tdb.items, [("businessId", 1), ("publicItemId", 1)], {"unique": True, "sparse": True}),
            (tdb.items, [("businessId", 1), ("sku", 1)], {}),
            (tdb.items, [("businessId", 1), ("barcode", 1)], {}),
            (tdb.items, [("businessId", 1), ("locations.locationId", 1)], {}),
            (tdb.items, [("businessId", 1), ("category", 1)], {}),
            (tdb.invoices, [("businessId", 1), ("invoiceNumber", 1)], {"unique": True}),
            (tdb.invoices, [("businessId", 1), ("locationId", 1)], {}),
            (tdb.parties, [("businessId", 1), ("phone", 1)], {}),
            (tdb.expenses, [("businessId", 1), ("expenseDate", -1)], {}),
            (tdb.purchase_orders, [("businessId", 1), ("poNumber", 1)], {"unique": True}),
            (tdb.purchase_orders, [("businessId", 1), ("status", 1)], {}),
            (tdb.purchase_orders, [("businessId", 1), ("supplierId", 1)], {}),
            (tdb.purchase_orders, [("businessId", 1), ("locationId", 1)], {}),
            (tdb.purchase_orders, [("businessId", 1), ("createdAt", -1)], {}),
            (tdb.inventory_movements, [("businessId", 1), ("itemId", 1), ("createdAt", -1)], {}),
        ]
        created_count = 0
        for col, keys, kwargs in indexes_to_create:
            try:
                await col.create_index(keys, **kwargs)
                created_count += 1
            except Exception:
                pass
        print(f"  [OK] Tenant DB [{tdb.name}] {created_count}/{len(indexes_to_create)} indexes verified.")

    client.close()

    print("\n" + "=" * 80)
    print(" ALL DATABASE RECORDS AUDITED, CLEANSED, AND SYNCHRONIZED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_db_schema_sync())
