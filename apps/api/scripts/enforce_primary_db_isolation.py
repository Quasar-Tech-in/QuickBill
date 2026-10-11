"""
Enforce Primary Database Isolation & Data Migration
===================================================
Architecture Rule:
- Primary DB ('quickbill_db') strictly contains ONLY:
    1. tenants
    2. users
    3. subscriptions
    4. locations
- Tenant Added DB ('quickbill_main_db') contains ALL operational/customer data:
    - purchase_orders, items, invoices, parties, customers, categories,
      payments, expenses, inventory_movements, staged_orders, etc.

This script:
1. Backs up / copies any missing operational documents from quickbill_db into quickbill_main_db.
2. Updates tenant databaseConfig to point to 'quickbill_main_db'.
3. Safely drops all operational collections from quickbill_db.
4. Verifies both databases and outputs the final collection inventory.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

ALLOWED_PRIMARY_COLLECTIONS = {
    "tenants",
    "users",
    "subscriptions",
    "locations",
    "system.indexes"
}

OPERATIONAL_COLLECTIONS = [
    "purchase_orders",
    "items",
    "invoices",
    "parties",
    "customers",
    "categories",
    "payments",
    "expenses",
    "inventory_movements",
    "staged_orders",
    "shipping",
]

MONGODB_URI = "mongodb://admin:secretpassword@localhost:27017/?authSource=admin"
PRIMARY_DB_NAME = "quickbill_db"
TENANT_DB_NAME = "quickbill_main_db"

async def run_migration():
    client = AsyncIOMotorClient(MONGODB_URI)
    primary_db = client[PRIMARY_DB_NAME]
    tenant_db = client[TENANT_DB_NAME]

    print("=" * 60)
    print("STEP 1: INSPECT CURRENT COLLECTIONS")
    print("=" * 60)
    primary_colls = await primary_db.list_collection_names()
    tenant_colls = await tenant_db.list_collection_names()
    print(f"Collections in '{PRIMARY_DB_NAME}': {primary_colls}")
    print(f"Collections in '{TENANT_DB_NAME}': {tenant_colls}\n")

    # 1. Sync any locations from tenant_db into primary_db if any exist
    if "locations" in tenant_colls:
        print("Checking tenant_db locations to sync to primary_db...")
        loc_cursor = tenant_db.locations.find({})
        async for loc in loc_cursor:
            existing = await primary_db.locations.find_one({"_id": loc["_id"]})
            if not existing:
                await primary_db.locations.insert_one(loc)
                print(f"  Synced location {loc.get('name')} ({loc.get('code')}) to primary_db.")

    # 2. Migrate operational collections from primary_db to tenant_db
    print("=" * 60)
    print("STEP 2: MIGRATE OPERATIONAL DATA TO TENANT DB")
    print("=" * 60)
    for coll_name in OPERATIONAL_COLLECTIONS:
        if coll_name in primary_colls:
            primary_coll = primary_db[coll_name]
            tenant_coll = tenant_db[coll_name]
            count_primary = await primary_coll.count_documents({})
            print(f"Analyzing '{coll_name}': {count_primary} documents in primary_db...")
            copied = 0
            async for doc in primary_coll.find({}):
                # Check uniqueness by _id or unique keys
                query = {"_id": doc["_id"]}
                if coll_name == "purchase_orders" and doc.get("poNumber"):
                    query = {"$or": [{"_id": doc["_id"]}, {"poNumber": doc["poNumber"]}]}
                elif coll_name == "items" and doc.get("sku"):
                    query = {"$or": [{"_id": doc["_id"]}, {"sku": doc["sku"]}]}
                elif coll_name == "invoices" and doc.get("invoiceNumber"):
                    query = {"$or": [{"_id": doc["_id"]}, {"invoiceNumber": doc["invoiceNumber"]}]}
                elif coll_name == "categories" and doc.get("name") and doc.get("businessId"):
                    query = {"$or": [{"_id": doc["_id"]}, {"businessId": doc["businessId"], "name": doc["name"]}]}

                exists = await tenant_coll.find_one(query)
                if not exists:
                    try:
                        await tenant_coll.insert_one(doc)
                        copied += 1
                    except DuplicateKeyError:
                        pass
            print(f"  Copied {copied} missing documents of '{coll_name}' into '{TENANT_DB_NAME}'.")

    # 3. Update Tenants configuration in primary_db
    print("\n" + "=" * 60)
    print("STEP 3: UPDATE TENANT DATABASE CONFIGURATION")
    print("=" * 60)
    async for tenant in primary_db.tenants.find({}):
        db_cfg = tenant.get("databaseConfig", {})
        curr_db = db_cfg.get("databaseName")
        curr_mode = db_cfg.get("isolationMode", "SHARED")
        tid = tenant["_id"]
        
        # If databaseName is primary_db or empty, set to quickbill_main_db
        if not curr_db or curr_db == PRIMARY_DB_NAME:
            await primary_db.tenants.update_one(
                {"_id": tid},
                {"$set": {
                    "databaseConfig.databaseName": TENANT_DB_NAME,
                    "databaseConfig.isolationMode": "DEDICATED_DATABASE"
                }}
            )
            print(f"Updated tenant '{tenant.get('name')}' ({tid}) db to '{TENANT_DB_NAME}' (DEDICATED_DATABASE).")
        else:
            print(f"Tenant '{tenant.get('name')}' already configured for db '{curr_db}'.")

    # 4. Drop non-allowed operational collections from primary_db
    print("\n" + "=" * 60)
    print("STEP 4: PURGE OPERATIONAL COLLECTIONS FROM PRIMARY DB")
    print("=" * 60)
    refreshed_primary_colls = await primary_db.list_collection_names()
    for coll_name in refreshed_primary_colls:
        if coll_name not in ALLOWED_PRIMARY_COLLECTIONS:
            count = await primary_db[coll_name].count_documents({})
            await primary_db.drop_collection(coll_name)
            print(f"Dropped collection '{coll_name}' ({count} docs) from '{PRIMARY_DB_NAME}'.")

    # 5. Final Verification
    print("\n" + "=" * 60)
    print("FINAL VERIFICATION: COLLECTION INVENTORY")
    print("=" * 60)
    final_primary = await primary_db.list_collection_names()
    final_tenant = await tenant_db.list_collection_names()

    print(f"Primary DB ('{PRIMARY_DB_NAME}') collections:")
    for c in sorted(final_primary):
        cnt = await primary_db[c].count_documents({})
        print(f"  - {c}: {cnt} documents")

    print(f"\nTenant DB ('{TENANT_DB_NAME}') collections:")
    for c in sorted(final_tenant):
        cnt = await tenant_db[c].count_documents({})
        print(f"  - {c}: {cnt} documents")

    illegal_in_primary = [c for c in final_primary if c not in ALLOWED_PRIMARY_COLLECTIONS]
    if illegal_in_primary:
        print(f"\n[ERROR] Illegal collections found in primary DB: {illegal_in_primary}")
    else:
        print(f"\n[SUCCESS] Primary DB strictly contains only approved platform collections: {final_primary}")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
