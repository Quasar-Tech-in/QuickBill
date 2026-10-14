"""
repair_imported_locations.py
===========================
Automated Migration and Repair Script for Imported Products.

Problem Solved:
Legacy product imports previously queried tenant_db for locations instead of primary_db,
defaulting 123+ items and their stock movements to dummy branch 'MAIN-01'.
Because the active store location in the UI is e.g. '6ac1b8519ee45a2d259bbf91',
those products were omitted from list_items queries and skipped in POS billing.

What This Script Does:
1. Reads all registered tenants from primary_db ('quickbill_db').
2. Reads all real branch locations from primary_db.locations.
3. For each tenant operational DB (e.g. quickbill_demo_db, quickbill_main_db):
   a. Identifies items with dummy 'MAIN-01' locationId or missing tenant locations.
   b. Remaps 'MAIN-01' stock, prices, and alerts to the tenant's primary default branch.
   c. Populates all other tenant branches on each item with isListed=True.
   d. Updates inventory_movements referencing 'MAIN-01' to point to the tenant's default branch.
"""

import sys
import os
import asyncio
from typing import Dict, List, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings


async def repair_locations():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    primary_db = client[settings.DATABASE_NAME]
    
    print("=" * 70)
    print("STARTING IMPORTED PRODUCT & LOCATION REPAIR ROUTINE")
    print("=" * 70)
    
    # 1. Fetch all tenants
    tenants = await primary_db.tenants.find({}).to_list(length=100)
    print(f"Found {len(tenants)} tenant(s) in primary database '{settings.DATABASE_NAME}'.\n")
    
    total_items_repaired = 0
    total_movements_repaired = 0
    
    for tenant in tenants:
        t_id = str(tenant["_id"])
        t_oid = tenant["_id"]
        t_name = tenant.get("name", "Unknown Tenant")
        t_slug = tenant.get("slug", "")
        
        # Determine operational DB name
        db_config = tenant.get("databaseConfig", {})
        op_db_name = db_config.get("databaseName") or settings.DEFAULT_TENANT_DATABASE_NAME
        op_db = client[op_db_name]
        
        print(f"--- Tenant: {t_name} (slug: {t_slug}, ID: {t_id}) -> DB: '{op_db_name}' ---")
        
        # Fetch real tenant locations from primary_db
        b_queries = [{"businessId": t_id}, {"businessId": t_oid}]
        loc_cursor = primary_db.locations.find({"$or": b_queries})
        tenant_locs: List[Dict[str, Any]] = []
        default_loc = None
        
        async for loc in loc_cursor:
            loc_dict = {
                "id": str(loc["_id"]),
                "name": loc.get("name", "Main Branch"),
                "code": loc.get("code", "MAIN"),
                "isDefault": bool(loc.get("isDefault", False)),
            }
            tenant_locs.append(loc_dict)
            if loc.get("isDefault") and not default_loc:
                default_loc = loc_dict
                
        if not default_loc and tenant_locs:
            default_loc = tenant_locs[0]
            
        if not tenant_locs:
            # Auto-create default location in primary_db if none exist
            print(f"  Warning: No locations found for tenant '{t_name}'. Auto-creating default location...")
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            new_loc_doc = {
                "businessId": t_oid,
                "name": "Main Flagship Counter",
                "code": "MAIN-01",
                "isDefault": True,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            }
            ins = await primary_db.locations.insert_one(new_loc_doc)
            default_loc = {
                "id": str(ins.inserted_id),
                "name": new_loc_doc["name"],
                "code": new_loc_doc["code"],
                "isDefault": True,
            }
            tenant_locs = [default_loc]
            
        print(f"  Available Locations ({len(tenant_locs)}):")
        for tl in tenant_locs:
            print(f"    - [{tl['code']}] {tl['name']} (ID: {tl['id']}) {'[DEFAULT]' if tl.get('isDefault') else ''}")
            
        def_loc_id = default_loc["id"]
        def_loc_name = default_loc["name"]
        
        # 2. Repair Items
        tenant_item_queries = [{"businessId": t_id}, {"businessId": t_oid}]
        items_cursor = op_db.items.find({"$or": tenant_item_queries})
        tenant_items_count = await op_db.items.count_documents({"$or": tenant_item_queries})
        print(f"  Scanning {tenant_items_count} items in '{op_db_name}'...")
        
        tenant_items_repaired = 0
        async for item in items_cursor:
            item_id = item["_id"]
            existing_locs = list(item.get("locations") or [])
            
            # Check if repair is needed:
            has_main_01 = any(str(l.get("locationId")) == "MAIN-01" for l in existing_locs)
            missing_tenant_locs = not all(
                any(str(l.get("locationId")) == tl["id"] for l in existing_locs)
                for tl in tenant_locs
            )
            
            if not has_main_01 and not missing_tenant_locs:
                continue
                
            # Extract stock/pricing from MAIN-01 entry if present
            main_01_stock = 0.0
            main_01_mrp = item.get("mrp") or item.get("salePrice") or 0.0
            main_01_sale_price = item.get("salePrice") or 0.0
            main_01_purch_price = item.get("purchasePrice") or 0.0
            main_01_alert = item.get("minStockAlert") or 5.0
            
            for l in existing_locs:
                if str(l.get("locationId")) == "MAIN-01":
                    main_01_stock = float(l.get("currentStock", 0.0) or 0.0)
                    if l.get("mrp") is not None:
                        main_01_mrp = float(l.get("mrp"))
                    if l.get("salePrice") is not None:
                        main_01_sale_price = float(l.get("salePrice"))
                    if l.get("purchasePrice") is not None:
                        main_01_purch_price = float(l.get("purchasePrice"))
                    if l.get("minStockAlert") is not None:
                        main_01_alert = float(l.get("minStockAlert"))
                    break
                    
            # Filter out legacy dummy MAIN-01
            cleaned_locs = [l for l in existing_locs if str(l.get("locationId")) != "MAIN-01"]
            
            # Map of already present location IDs
            present_map = {str(l.get("locationId")): l for l in cleaned_locs if l.get("locationId")}
            
            # Ensure primary default branch entry
            if def_loc_id in present_map:
                def_entry = present_map[def_loc_id]
                def_entry["isListed"] = True
                if main_01_stock > 0 and float(def_entry.get("currentStock", 0.0) or 0.0) == 0.0:
                    def_entry["currentStock"] = main_01_stock
            else:
                stock_to_assign = main_01_stock if main_01_stock > 0 else float(item.get("currentStock", 0.0) or 0.0)
                cleaned_locs.insert(0, {
                    "locationId": def_loc_id,
                    "locationName": def_loc_name,
                    "mrp": float(main_01_mrp),
                    "salePrice": float(main_01_sale_price),
                    "purchasePrice": float(main_01_purch_price),
                    "currentStock": stock_to_assign,
                    "minStockAlert": float(main_01_alert),
                    "isListed": True,
                    "hasDiscount": bool(item.get("hasDiscount", False)),
                    "discountType": item.get("discountType", "PERCENT"),
                    "discountValue": float(item.get("discountValue", 0.0)),
                })
                present_map[def_loc_id] = cleaned_locs[0]
                
            # Ensure all other tenant branches are populated
            for tl in tenant_locs:
                tl_id = tl["id"]
                if tl_id not in present_map:
                    cleaned_locs.append({
                        "locationId": tl_id,
                        "locationName": tl["name"],
                        "mrp": float(main_01_mrp),
                        "salePrice": float(main_01_sale_price),
                        "purchasePrice": float(main_01_purch_price),
                        "currentStock": 0.0,
                        "minStockAlert": float(main_01_alert),
                        "isListed": True,
                        "hasDiscount": False,
                        "discountType": "PERCENT",
                        "discountValue": 0.0,
                    })
                    present_map[tl_id] = cleaned_locs[-1]
                    
            await op_db.items.update_one(
                {"_id": item_id},
                {"$set": {"locations": cleaned_locs}}
            )
            tenant_items_repaired += 1
            
        print(f"  -> Repaired {tenant_items_repaired} items for tenant '{t_name}'.")
        total_items_repaired += tenant_items_repaired
        
        # 3. Repair Inventory Movements
        mov_query = {
            "$or": tenant_item_queries,
            "locationId": "MAIN-01"
        }
        mov_count = await op_db.inventory_movements.count_documents(mov_query)
        if mov_count > 0:
            up_res = await op_db.inventory_movements.update_many(
                mov_query,
                {"$set": {
                    "locationId": def_loc_id,
                    "locationName": def_loc_name
                }}
            )
            print(f"  -> Remapped {up_res.modified_count} inventory movements from 'MAIN-01' to '{def_loc_name}' ({def_loc_id}).")
            total_movements_repaired += up_res.modified_count
        else:
            print("  -> 0 inventory movements needed remapping for this tenant.")
            
        print()
        
    print("=" * 70)
    print(f"REPAIR COMPLETED SUCCESSFULLY!")
    print(f"Total Items Repaired Across Databases:      {total_items_repaired}")
    print(f"Total Movements Repaired Across Databases: {total_movements_repaired}")
    print("=" * 70)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(repair_locations())
