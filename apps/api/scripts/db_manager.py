import asyncio
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8')[:72], bcrypt.gensalt()).decode('utf-8')

MONGODB_URI = "mongodb://admin:secretpassword@localhost:27017/?authSource=admin"
PRIMARY_DB_NAME = "quickbill_db"

TENANT_1_ID = ObjectId("65f2a1b9a000000000000001")
STORE_1_DB = "quickbill_main_db"

LOC_1_ID = ObjectId("65f2a1b9a000000000000101")
LOC_2_ID = ObjectId("65f2a1b9a000000000000102")
LOC_3_ID = ObjectId("65f2a1b9a000000000000103")

OPERATIONAL_COLLECTIONS = ["items", "invoices", "inventory_movements", "parties", "payments", "expenses", "locations", "categories"]

async def cleanup_and_init_db():
    print(f"Connecting to MongoDB at {MONGODB_URI}...")
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    
    try:
        await client.admin.command("ping")
        print("Connected successfully to MongoDB server.")
    except Exception as e:
        print(f"Could not connect to MongoDB: {e}")
        return

    # Drop any extra legacy tenant databases
    extra_dbs = ["quickbill_apex_db", "quickbill_metrotech_db"]
    for edb in extra_dbs:
        await client.drop_database(edb)
        print(f"Dropped extra database '{edb}' to keep single clean tenant.")

    # 1. CLEANUP ROOT DB
    primary_db = client[PRIMARY_DB_NAME]
    print(f"\n--- Cleaning Root/Primary DB: {PRIMARY_DB_NAME} ---")
    root_colls = await primary_db.list_collection_names()
    for coll in OPERATIONAL_COLLECTIONS:
        if coll in root_colls:
            await primary_db[coll].drop()
            print(f"Dropped operational collection '{coll}' from Primary Root DB.")

    # 2. Reset Core Collections in Primary DB
    await primary_db.tenants.delete_many({})
    await primary_db.users.delete_many({})
    await primary_db.subscriptions.delete_many({})
    await primary_db.locations.delete_many({})

    print("\n--- Creating Primary Root DB Indexes ---")
    await primary_db.tenants.create_index("slug", unique=True)
    await primary_db.tenants.create_index("adminEmail")
    await primary_db.tenants.create_index("status")
    
    await primary_db.users.create_index("email", unique=True)
    await primary_db.users.create_index("tenantId")
    await primary_db.users.create_index("isSystemRoot")
    await primary_db.users.create_index("roles")

    await primary_db.locations.create_index([("businessId", 1), ("code", 1)], unique=True)
    await primary_db.subscriptions.create_index([("businessId", 1), ("status", 1)])
    print("Primary Root DB indexes created successfully.")

    # 2. Seed Locations for the Single Tenant
    now = datetime.now(timezone.utc)
    locations = [
        {
            "_id": LOC_1_ID,
            "businessId": str(TENANT_1_ID),
            "name": "Main Flagship Counter",
            "code": "MAIN-01",
            "address": "Ground Floor, Metro Retail Plaza, Sector 18",
            "phone": "+91 9876543210",
            "isDefault": True,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": LOC_2_ID,
            "businessId": str(TENANT_1_ID),
            "name": "Downtown Express Branch",
            "code": "DT-02",
            "address": "Shop 14, City Walk Center, Downtown",
            "phone": "+91 9811223344",
            "isDefault": False,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": LOC_3_ID,
            "businessId": str(TENANT_1_ID),
            "name": "Central Supply Warehouse",
            "code": "WH-03",
            "address": "Plot 8B, Industrial Logistics Park",
            "phone": "+91 9988776655",
            "isDefault": False,
            "isActive": True,
            "createdAt": now
        }
    ]
    await primary_db.locations.insert_many(locations)
    print(f"Seeded 3 store locations for tenant {TENANT_1_ID}.")

    # 3. Seed Users for the Single Tenant
    users = [
        {
            "_id": ObjectId("65f2a1b9a000000000000010"),
            "email": "superadmin@quickbill.local",
            "hashedPassword": hash_pw("superadmin123"),
            "name": "Global Super Administrator",
            "roles": ["SUPER_ADMIN"],
            "isSystemRoot": True,
            "tenantId": None,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000011"),
            "email": "admin@quickbill.local",
            "hashedPassword": hash_pw("admin123"),
            "name": "QuickBill Store Admin",
            "roles": ["TENANT_ADMIN"],
            "isSystemRoot": False,
            "tenantId": str(TENANT_1_ID),
            "assignedLocationIds": [str(LOC_1_ID), str(LOC_2_ID), str(LOC_3_ID)],
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000012"),
            "email": "manager@quickbill.local",
            "hashedPassword": hash_pw("manager123"),
            "name": "Store Operations Manager",
            "roles": ["MANAGER"],
            "isSystemRoot": False,
            "tenantId": str(TENANT_1_ID),
            "assignedLocationIds": [str(LOC_1_ID), str(LOC_2_ID)],
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000013"),
            "email": "cashier@quickbill.local",
            "hashedPassword": hash_pw("cashier123"),
            "name": "Main POS Billing Staff",
            "roles": ["CASHIER"],
            "isSystemRoot": False,
            "tenantId": str(TENANT_1_ID),
            "assignedLocationIds": [str(LOC_1_ID)],
            "isActive": True,
            "createdAt": now
        }
    ]
    await primary_db.users.insert_many(users)
    print(f"Seeded 4 users (Super Admin, Store Admin, Manager, Cashier) into Primary DB.")

    # 4. Seed the Single Dedicated Tenant
    tenants = [
        {
            "_id": TENANT_1_ID,
            "name": "QuickBill Enterprise Retail",
            "slug": "quickbill-main",
            "plan": "ENTERPRISE",
            "status": "ACTIVE",
            "adminEmail": "admin@quickbill.local",
            "phone": "+91 9876543210",
            "gstin": "07AABCB1234F1Z5",
            "createdAt": now,
            "databaseConfig": {
                "isolationMode": "DEDICATED_DATABASE",
                "mongodbUri": f"mongodb://admin:secretpassword@localhost:27017/{STORE_1_DB}?authSource=admin",
                "databaseName": STORE_1_DB
            },
            "stats": {
                "productsCount": 3,
                "invoicesCount": 2,
                "monthlyGmv": 6149.0,
                "usersCount": 3
            }
        },
    ]
    await primary_db.tenants.insert_many(tenants)
    print(f"Seeded 1 Single Clean Tenant into Primary DB.")

    # 5. Initialize Store Operational Database & Indexes
    store_dbs = [STORE_1_DB]
    for target_db_name in store_dbs:
        tdb = client[target_db_name]
        print(f"\n--- Initializing Isolated Tenant Database: {target_db_name} ---")
        
        # Clean collections
        for coll_name in OPERATIONAL_COLLECTIONS:
            try:
                await tdb[coll_name].delete_many({})
                await tdb[coll_name].drop_indexes()
            except Exception:
                pass
        
        # Compound indexes
        await tdb.items.create_index([("businessId", 1), ("publicItemId", 1)], unique=True)
        await tdb.items.create_index([("businessId", 1), ("sku", 1)], unique=True, sparse=True)
        await tdb.items.create_index([("businessId", 1), ("name", "text")])
        await tdb.items.create_index([("businessId", 1), ("categoryId", 1), ("isActive", 1)])
        
        await tdb.categories.create_index([("businessId", 1), ("name", 1)], unique=True)
        
        await tdb.invoices.create_index([("businessId", 1), ("invoiceNumber", 1)], unique=True)
        await tdb.invoices.create_index([("businessId", 1), ("createdAt", -1)])
        await tdb.invoices.create_index([("businessId", 1), ("partyId", 1), ("createdAt", -1)])
        
        await tdb.inventory_movements.create_index([("businessId", 1), ("itemId", 1), ("createdAt", -1)])
        
        await tdb.parties.create_index([("businessId", 1), ("phone", 1)])
        await tdb.parties.create_index([("businessId", 1), ("name", 1)])
        
        await tdb.payments.create_index([("businessId", 1), ("paidAt", -1)])
        await tdb.payments.create_index([("businessId", 1), ("invoiceId", 1)])
        
        await tdb.expenses.create_index([("businessId", 1), ("expenseDate", -1)])

        # Seed Tenant-Specific Categories
        categories_data = [
            {"businessId": str(TENANT_1_ID), "name": "Grocery", "description": "Packaged foods, staples, pulses & grains", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Dairy & Eggs", "description": "Milk, cheese, butter, curd and farm eggs", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Beverages", "description": "Juices, cold drinks, tea, coffee & energy drinks", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Snacks & Sweets", "description": "Biscuits, chips, namkeen, chocolates & bakery", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Personal Care", "description": "Soaps, haircare, skincare, oral care & grooming", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Household & Cleaning", "description": "Detergents, cleaners, dishwash & kitchen essentials", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Electronics & Gadgets", "description": "Cables, chargers, peripherals, accessories & batteries", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Apparel & Lifestyle", "description": "Ready-to-wear clothing, innerwear & accessories", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "Stationery & Office", "description": "Books, notebooks, pens, markers & desk supplies", "createdAt": now},
            {"businessId": str(TENANT_1_ID), "name": "General Store", "description": "General merchandise & assorted counter items", "createdAt": now},
        ]
        await tdb.categories.insert_many(categories_data)
        print(f"Seeded {len(categories_data)} categories into Tenant Database: {target_db_name}")

    # 5. Seed Clean Isolated Items & Parties into respective Store Databases
    print("\n--- Seeding Items into Store Databases ---")
    
    # Store 1 items -> quickbill_main_db
    store_1_items = [
        {
            "_id": ObjectId("65f2a1b9a000000000000101"),
            "businessId": TENANT_1_ID,
            "publicItemId": "ITM-1001",
            "name": "Basmati Rice (1kg Pack)",
            "sku": "RICE-001",
            "barcode": "8901234567890",
            "category": "Grocery",
            "salePrice": 120.0,
            "purchasePrice": 95.0,
            "taxRate": 5.0,
            "unit": "kg",
            "currentStock": 310,
            "minStockAlert": 10,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 120.0,
                    "purchasePrice": 95.0,
                    "currentStock": 45,
                    "minStockAlert": 10,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 128.0,
                    "purchasePrice": 95.0,
                    "currentStock": 15,
                    "minStockAlert": 5,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 115.0,
                    "purchasePrice": 90.0,
                    "currentStock": 250,
                    "minStockAlert": 50,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1001",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000102"),
            "businessId": TENANT_1_ID,
            "publicItemId": "ITM-1002",
            "name": "Wireless Optical Mouse",
            "sku": "ACC-003",
            "barcode": "8901234567892",
            "category": "Electronics",
            "salePrice": 499.0,
            "purchasePrice": 320.0,
            "taxRate": 18.0,
            "unit": "pcs",
            "currentStock": 94,
            "minStockAlert": 5,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 499.0,
                    "purchasePrice": 320.0,
                    "currentStock": 24,
                    "minStockAlert": 5,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 549.0,
                    "purchasePrice": 320.0,
                    "currentStock": 10,
                    "minStockAlert": 4,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 480.0,
                    "purchasePrice": 310.0,
                    "currentStock": 60,
                    "minStockAlert": 15,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1002",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000103"),
            "businessId": TENANT_1_ID,
            "publicItemId": "ITM-1003",
            "name": "Sunflower Cooking Oil (5L)",
            "sku": "OIL-005",
            "barcode": "8901234567891",
            "category": "Grocery",
            "salePrice": 650.0,
            "purchasePrice": 520.0,
            "taxRate": 5.0,
            "unit": "ltr",
            "currentStock": 30,
            "minStockAlert": 6,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 650.0,
                    "purchasePrice": 520.0,
                    "currentStock": 10,
                    "minStockAlert": 3,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 675.0,
                    "purchasePrice": 520.0,
                    "currentStock": 5,
                    "minStockAlert": 2,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 620.0,
                    "purchasePrice": 500.0,
                    "currentStock": 15,
                    "minStockAlert": 5,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1003",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        }
    ]
    await client[STORE_1_DB].items.insert_many(store_1_items)
    await client[STORE_1_DB].locations.insert_many(locations)
    print("Store items and locations seeded successfully into quickbill_main_db.")

    # 6. Verify Root DB collections list
    final_root_colls = await primary_db.list_collection_names()
    print(f"\nFinal Collections in Root DB ({PRIMARY_DB_NAME}): {final_root_colls}")

    client.close()
    print("\nDatabase architecture cleanup and single-tenant multi-location initialization COMPLETED!")

if __name__ == "__main__":
    asyncio.run(cleanup_and_init_db())
