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
            "id": "item_1_1",
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
            "id": "item_1_2",
            "publicItemId": "ITM-1002",
            "name": "Refined Sunflower Oil (1L)",
            "sku": "OIL-002",
            "barcode": "8901234567891",
            "category": "Grocery",
            "salePrice": 145.0,
            "purchasePrice": 120.0,
            "taxRate": 5.0,
            "unit": "ltr",
            "currentStock": 128,
            "minStockAlert": 15,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 145.0,
                    "purchasePrice": 120.0,
                    "currentStock": 8,
                    "minStockAlert": 15,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 150.0,
                    "purchasePrice": 120.0,
                    "currentStock": 20,
                    "minStockAlert": 10,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 140.0,
                    "purchasePrice": 115.0,
                    "currentStock": 100,
                    "minStockAlert": 25,
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
            "id": "item_1_3",
            "publicItemId": "ITM-1003",
            "name": "Wireless Optical Mouse",
            "sku": "ACC-003",
            "barcode": "8901234567892",
            "category": "Electronics & Gadgets",
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
            "qrPayload": "ITEM:ITM-1003",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000104"),
            "businessId": TENANT_1_ID,
            "id": "item_1_4",
            "publicItemId": "ITM-1004",
            "name": "Bluetooth Neckband Earphones",
            "sku": "AUD-004",
            "barcode": "8901234567893",
            "category": "Electronics & Gadgets",
            "salePrice": 249.0,
            "purchasePrice": 160.0,
            "taxRate": 18.0,
            "unit": "pcs",
            "currentStock": 42,
            "minStockAlert": 5,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 249.0,
                    "purchasePrice": 160.0,
                    "currentStock": 12,
                    "minStockAlert": 5,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 269.0,
                    "purchasePrice": 160.0,
                    "currentStock": 5,
                    "minStockAlert": 3,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 235.0,
                    "purchasePrice": 150.0,
                    "currentStock": 25,
                    "minStockAlert": 10,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1004",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000105"),
            "businessId": TENANT_1_ID,
            "id": "item_1_5",
            "publicItemId": "ITM-1005",
            "name": "Dairy Milk Silk Chocolate (150g)",
            "sku": "SNK-005",
            "barcode": "8901234567894",
            "category": "Snacks & Sweets",
            "salePrice": 90.0,
            "purchasePrice": 72.0,
            "taxRate": 12.0,
            "unit": "pcs",
            "currentStock": 250,
            "minStockAlert": 20,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 90.0,
                    "purchasePrice": 72.0,
                    "currentStock": 50,
                    "minStockAlert": 12,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 95.0,
                    "purchasePrice": 72.0,
                    "currentStock": 40,
                    "minStockAlert": 10,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 85.0,
                    "purchasePrice": 68.0,
                    "currentStock": 160,
                    "minStockAlert": 40,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1005",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000106"),
            "businessId": TENANT_1_ID,
            "id": "item_1_6",
            "publicItemId": "ITM-1006",
            "name": "Organic Green Tea (25 Bags)",
            "sku": "BEV-006",
            "barcode": "8901234567895",
            "category": "Beverages",
            "salePrice": 185.0,
            "purchasePrice": 135.0,
            "taxRate": 5.0,
            "unit": "box",
            "currentStock": 89,
            "minStockAlert": 8,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 185.0,
                    "purchasePrice": 135.0,
                    "currentStock": 19,
                    "minStockAlert": 8,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 195.0,
                    "purchasePrice": 135.0,
                    "currentStock": 20,
                    "minStockAlert": 5,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 175.0,
                    "purchasePrice": 125.0,
                    "currentStock": 50,
                    "minStockAlert": 15,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1006",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000107"),
            "businessId": TENANT_1_ID,
            "id": "item_1_7",
            "publicItemId": "ITM-1007",
            "name": "Industrial Heavy Duty Drill Machine 650W",
            "sku": "PWR-DRL-650",
            "barcode": "8901234567896",
            "category": "Electronics & Gadgets",
            "salePrice": 3250.0,
            "purchasePrice": 2200.0,
            "taxRate": 18.0,
            "unit": "set",
            "currentStock": 52,
            "minStockAlert": 4,
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": 3250.0,
                    "purchasePrice": 2200.0,
                    "currentStock": 12,
                    "minStockAlert": 3,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": 3390.0,
                    "purchasePrice": 2200.0,
                    "currentStock": 8,
                    "minStockAlert": 2,
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": 3100.0,
                    "purchasePrice": 2100.0,
                    "currentStock": 32,
                    "minStockAlert": 10,
                    "isListed": False
                }
            ],
            "qrPayload": "ITEM:ITM-1007",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        }
    ]
    await client[STORE_1_DB].items.delete_many({})
    await client[STORE_1_DB].items.insert_many(store_1_items)
    await client[STORE_1_DB].locations.delete_many({})
    await client[STORE_1_DB].locations.insert_many(locations)

    # 4. Seed Parties
    parties = [
        {
            "_id": ObjectId("65f2a1b9a000000000000201"),
            "businessId": TENANT_1_ID,
            "name": "Aarav Sharma",
            "type": "CUSTOMER",
            "phone": "+91 98765 43210",
            "email": "aarav.sharma@example.com",
            "address": "B-42, Hauz Khas Enclave, New Delhi, 110016",
            "gstin": "07AAAAA0000A1Z5",
            "currentBalance": 0.0,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000202"),
            "businessId": TENANT_1_ID,
            "name": "Downtown Coffee Lounge & Cafe",
            "type": "CUSTOMER",
            "phone": "+91 98112 23344",
            "email": "procurement@downtowncafe.in",
            "address": "Shop 12, City Walk Center, Downtown",
            "gstin": "07BBBBB1111B2Z6",
            "currentBalance": 450.0,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000203"),
            "businessId": TENANT_1_ID,
            "name": "National FMCG Distributors Ltd",
            "type": "SUPPLIER",
            "phone": "+91 11 2345 6789",
            "email": "sales@nationalfmcg.com",
            "address": "Logistics Hub Phase 2, Delhi",
            "gstin": "07CCCCC2222C3Z7",
            "currentBalance": -12500.0,
            "isActive": True,
            "createdAt": now
        }
    ]
    await client[STORE_1_DB].parties.delete_many({})
    await client[STORE_1_DB].parties.insert_many(parties)

    # 5. Seed Invoices with Full Customer, Location & Biller Tags
    invoices = [
        {
            "_id": ObjectId("65f2a1b9a000000000000301"),
            "businessId": TENANT_1_ID,
            "invoiceNumber": "INV-2026-001",
            "partyId": ObjectId("65f2a1b9a000000000000201"),
            "partyNameSnapshot": "Aarav Sharma",
            "partyPhoneSnapshot": "+91 98765 43210",
            "consumerName": "Aarav Sharma",
            "consumerPhone": "+91 98765 43210",
            "locationId": str(LOC_1_ID),
            "locationName": "Main Flagship Counter",
            "locationCode": "MAIN-01",
            "locationAddress": "Ground Floor, Metro Retail Plaza, Sector 18",
            "locationPhone": "+91 9876543210",
            "billedById": "65f2a1b9a000000000000012",
            "billedByName": "Priya Verma",
            "billedByRole": "CASHIER",
            "status": "CONFIRMED",
            "paymentStatus": "PAID",
            "paymentMode": "UPI",
            "items": [
                {
                    "itemId": "65f2a1b9a000000000000101",
                    "nameSnapshot": "Basmati Rice (1kg Pack)",
                    "skuSnapshot": "RICE-001",
                    "quantity": 2.0,
                    "unitPrice": 120.0,
                    "discount": 0.0,
                    "taxableAmount": 228.57,
                    "taxRate": 5.0,
                    "taxAmount": 11.43,
                    "lineTotal": 240.0
                },
                {
                    "itemId": "65f2a1b9a000000000000102",
                    "nameSnapshot": "Wireless Optical Mouse",
                    "skuSnapshot": "ACC-003",
                    "quantity": 1.0,
                    "unitPrice": 499.0,
                    "discount": 0.0,
                    "taxableAmount": 422.88,
                    "taxRate": 18.0,
                    "taxAmount": 76.12,
                    "lineTotal": 499.0
                }
            ],
            "subtotal": 651.45,
            "taxTotal": 87.55,
            "discountTotal": 0.0,
            "discountType": None,
            "discountValue": 0.0,
            "additionalCharges": 0.0,
            "roundOff": 0.0,
            "grandTotal": 739.0,
            "paidAmount": 739.0,
            "balanceDue": 0.0,
            "notes": "Retail POS Counter Bill",
            "createdByUserId": "65f2a1b9a000000000000012",
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000302"),
            "businessId": TENANT_1_ID,
            "invoiceNumber": "INV-2026-002",
            "partyId": ObjectId("65f2a1b9a000000000000202"),
            "partyNameSnapshot": "Downtown Coffee Lounge & Cafe",
            "partyPhoneSnapshot": "+91 98112 23344",
            "consumerName": "Downtown Coffee Lounge & Cafe",
            "consumerPhone": "+91 98112 23344",
            "locationId": str(LOC_2_ID),
            "locationName": "Downtown Express Branch",
            "locationCode": "DT-02",
            "locationAddress": "Shop 14, City Walk Center, Downtown",
            "locationPhone": "+91 9811223344",
            "billedById": "65f2a1b9a000000000000011",
            "billedByName": "Rajesh Kumar",
            "billedByRole": "STORE_MANAGER",
            "status": "CONFIRMED",
            "paymentStatus": "PAID",
            "paymentMode": "CASH",
            "items": [
                {
                    "itemId": "65f2a1b9a000000000000103",
                    "nameSnapshot": "Sunflower Cooking Oil (5L)",
                    "skuSnapshot": "OIL-005",
                    "quantity": 2.0,
                    "unitPrice": 675.0,
                    "discount": 50.0,
                    "taxableAmount": 1238.10,
                    "taxRate": 5.0,
                    "taxAmount": 61.90,
                    "lineTotal": 1300.0
                }
            ],
            "subtotal": 1238.10,
            "taxTotal": 61.90,
            "discountTotal": 50.0,
            "discountType": "FLAT",
            "discountValue": 50.0,
            "additionalCharges": 0.0,
            "roundOff": 0.0,
            "grandTotal": 1300.0,
            "paidAmount": 1300.0,
            "balanceDue": 0.0,
            "notes": "Downtown Express Bulk Supply Bill",
            "createdByUserId": "65f2a1b9a000000000000011",
            "createdAt": now
        }
    ]
    await client[STORE_1_DB].invoices.delete_many({})
    await client[STORE_1_DB].invoices.insert_many(invoices)

    # 6. Seed Payments & Inventory Movements
    payments = [
        {
            "_id": ObjectId("65f2a1b9a000000000000401"),
            "businessId": TENANT_1_ID,
            "paymentNumber": "PAY-2026-000001",
            "direction": "IN",
            "partyId": ObjectId("65f2a1b9a000000000000201"),
            "partyNameSnapshot": "Aarav Sharma",
            "invoiceId": ObjectId("65f2a1b9a000000000000301"),
            "invoiceNumber": "INV-2026-001",
            "amount": 739.0,
            "paymentMode": "UPI",
            "paidAt": now,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000402"),
            "businessId": TENANT_1_ID,
            "paymentNumber": "PAY-2026-000002",
            "direction": "IN",
            "partyId": ObjectId("65f2a1b9a000000000000202"),
            "partyNameSnapshot": "Downtown Coffee Lounge & Cafe",
            "invoiceId": ObjectId("65f2a1b9a000000000000302"),
            "invoiceNumber": "INV-2026-002",
            "amount": 1300.0,
            "paymentMode": "CASH",
            "paidAt": now,
            "createdAt": now
        }
    ]
    await client[STORE_1_DB].payments.delete_many({})
    await client[STORE_1_DB].payments.insert_many(payments)

    print("Store items, locations, parties, invoices, and payments seeded successfully into quickbill_main_db.")

    # 7. Verify Root DB collections list
    final_root_colls = await primary_db.list_collection_names()
    print(f"\nFinal Collections in Root DB ({PRIMARY_DB_NAME}): {final_root_colls}")
    final_tenant_colls = await client[STORE_1_DB].list_collection_names()
    print(f"Final Collections in Tenant DB ({STORE_1_DB}): {final_tenant_colls}")

    client.close()
    print("\nDatabase architecture cleanup and single-tenant multi-location initialization COMPLETED!")

if __name__ == "__main__":
    asyncio.run(cleanup_and_init_db())
