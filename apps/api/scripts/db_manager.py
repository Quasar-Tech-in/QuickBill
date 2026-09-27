import asyncio
from datetime import datetime, timezone, timedelta
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

    # 3. Seed Locations for Single Tenant
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

    # 4. Seed Users for Primary DB
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
    print("Seeded 4 users into Primary DB.")

    # 5. Seed Dedicated Tenant Info
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
                "productsCount": 32,
                "invoicesCount": 3,
                "monthlyGmv": 12450.0,
                "usersCount": 3
            }
        },
    ]
    await primary_db.tenants.insert_many(tenants)
    print("Seeded 1 Single Clean Tenant into Primary DB.")

    # 6. Initialize Store Operational Database & Indexes
    tdb = client[STORE_1_DB]
    print(f"\n--- Initializing Isolated Tenant Database: {STORE_1_DB} ---")
    
    for coll_name in OPERATIONAL_COLLECTIONS:
        try:
            await tdb[coll_name].delete_many({})
            await tdb[coll_name].drop_indexes()
        except Exception:
            pass
    
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
    print(f"Seeded {len(categories_data)} categories into Tenant Database.")

    # Seed Locations into Tenant DB
    await tdb.locations.insert_many(locations)

    # 7. Seed 32 Rich Production-Grade Products
    raw_products = [
        # --- GROCERY (1-5) ---
        {
            "num": 1, "name": "Premium Royal Basmati Rice (1kg)", "sku": "GRO-RICE-01", "barcode": "8901030001011",
            "category": "Grocery", "salePrice": 140.0, "purchasePrice": 105.0, "taxRate": 5.0, "unit": "kg", "allowParts": True,
            "minStockAlert": 15, "st1": 45, "st2": 25, "st3": 250,
            "img": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 2, "name": "Organic Whole Wheat Atta (5kg)", "sku": "GRO-ATTA-05", "barcode": "8901030001028",
            "category": "Grocery", "salePrice": 245.0, "purchasePrice": 190.0, "taxRate": 5.0, "unit": "pack", "allowParts": False,
            "minStockAlert": 10, "st1": 30, "st2": 15, "st3": 180,
            "img": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 3, "name": "Refined Sunflower Cooking Oil (1L)", "sku": "GRO-OIL-01", "barcode": "8901030001035",
            "category": "Grocery", "salePrice": 155.0, "purchasePrice": 120.0, "taxRate": 5.0, "unit": "ltr", "allowParts": True,
            "minStockAlert": 12, "st1": 50, "st2": 20, "st3": 300,
            "img": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 4, "name": "Unpolished Toor Dal (1kg)", "sku": "GRO-DAL-01", "barcode": "8901030001042",
            "category": "Grocery", "salePrice": 165.0, "purchasePrice": 130.0, "taxRate": 5.0, "unit": "kg", "allowParts": True,
            "minStockAlert": 10, "st1": 40, "st2": 15, "st3": 160,
            "img": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 5, "name": "Pure Sulphur-Free Sugar (1kg)", "sku": "GRO-SUG-01", "barcode": "8901030001059",
            "category": "Grocery", "salePrice": 52.0, "purchasePrice": 42.0, "taxRate": 5.0, "unit": "kg", "allowParts": True,
            "minStockAlert": 20, "st1": 80, "st2": 35, "st3": 400,
            "img": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=500&auto=format&fit=crop&q=60"
        },

        # --- DAIRY & EGGS (6-8) ---
        {
            "num": 6, "name": "Fresh Pasteurized Toned Milk (1L)", "sku": "DAI-MILK-01", "barcode": "8901030002018",
            "category": "Dairy & Eggs", "salePrice": 64.0, "purchasePrice": 54.0, "taxRate": 0.0, "unit": "ltr", "allowParts": True,
            "minStockAlert": 15, "st1": 60, "st2": 40, "st3": 100,
            "img": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 7, "name": "Salted Creamy Table Butter (500g)", "sku": "DAI-BTR-500", "barcode": "8901030002025",
            "category": "Dairy & Eggs", "salePrice": 275.0, "purchasePrice": 230.0, "taxRate": 12.0, "unit": "pack", "allowParts": False,
            "minStockAlert": 8, "st1": 25, "st2": 15, "st3": 90,
            "img": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 8, "name": "Farm Fresh White Eggs (Tray of 30)", "sku": "DAI-EGG-30", "barcode": "8901030002032",
            "category": "Dairy & Eggs", "salePrice": 210.0, "purchasePrice": 165.0, "taxRate": 0.0, "unit": "tray", "allowParts": True,
            "minStockAlert": 10, "st1": 35, "st2": 20, "st3": 120,
            "img": "https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=500&auto=format&fit=crop&q=60"
        },

        # --- BEVERAGES (9-12) ---
        {
            "num": 9, "name": "Premium CTC Assam Black Tea (500g)", "sku": "BEV-TEA-500", "barcode": "8901030003015",
            "category": "Beverages", "salePrice": 290.0, "purchasePrice": 210.0, "taxRate": 5.0, "unit": "pack", "allowParts": True,
            "minStockAlert": 10, "st1": 40, "st2": 25, "st3": 150,
            "img": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 10, "name": "Classic Instant Arabica Coffee (100g)", "sku": "BEV-COF-100", "barcode": "8901030003022",
            "category": "Beverages", "salePrice": 360.0, "purchasePrice": 270.0, "taxRate": 18.0, "unit": "jar", "allowParts": False,
            "minStockAlert": 8, "st1": 30, "st2": 18, "st3": 110,
            "img": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 11, "name": "Cold Pressed Valencia Orange Juice (1L)", "sku": "BEV-JUC-01", "barcode": "8901030003039",
            "category": "Beverages", "salePrice": 145.0, "purchasePrice": 105.0, "taxRate": 12.0, "unit": "bottle", "allowParts": False,
            "minStockAlert": 10, "st1": 35, "st2": 25, "st3": 95,
            "img": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 12, "name": "Organic Detox Green Tea (25 Bags)", "sku": "BEV-GTEA-25", "barcode": "8901030003046",
            "category": "Beverages", "salePrice": 195.0, "purchasePrice": 135.0, "taxRate": 5.0, "unit": "box", "allowParts": False,
            "minStockAlert": 6, "st1": 25, "st2": 20, "st3": 75,
            "img": "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=500&auto=format&fit=crop&q=60"
        },

        # --- SNACKS & SWEETS (13-16) ---
        {
            "num": 13, "name": "Handmade Butter Cookies (400g Tin)", "sku": "SNK-CKI-400", "barcode": "8901030004012",
            "category": "Snacks & Sweets", "salePrice": 220.0, "purchasePrice": 155.0, "taxRate": 18.0, "unit": "box", "allowParts": False,
            "minStockAlert": 10, "st1": 30, "st2": 20, "st3": 120,
            "img": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 14, "name": "Artisanal Dark Chocolate 70% Cocoa (100g)", "sku": "SNK-CHOC-70", "barcode": "8901030004029",
            "category": "Snacks & Sweets", "salePrice": 175.0, "purchasePrice": 115.0, "taxRate": 18.0, "unit": "bar", "allowParts": False,
            "minStockAlert": 12, "st1": 45, "st2": 30, "st3": 140,
            "img": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 15, "name": "Crunchy Roasted Almonds Himalayan Salt (250g)", "sku": "SNK-ALM-250", "barcode": "8901030004036",
            "category": "Snacks & Sweets", "salePrice": 340.0, "purchasePrice": 250.0, "taxRate": 5.0, "unit": "pack", "allowParts": True,
            "minStockAlert": 8, "st1": 25, "st2": 15, "st3": 85,
            "img": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 16, "name": "Spiced Potato Crisps Tangy Masala (150g)", "sku": "SNK-CHP-150", "barcode": "8901030004043",
            "category": "Snacks & Sweets", "salePrice": 60.0, "purchasePrice": 42.0, "taxRate": 12.0, "unit": "pack", "allowParts": False,
            "minStockAlert": 20, "st1": 70, "st2": 50, "st3": 250,
            "img": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=60"
        },

        # --- PERSONAL CARE (17-19) ---
        {
            "num": 17, "name": "Nourishing Herbal Hair Shampoo (400ml)", "sku": "PER-SHMP-400", "barcode": "8901030005019",
            "category": "Personal Care", "salePrice": 320.0, "purchasePrice": 225.0, "taxRate": 18.0, "unit": "bottle", "allowParts": False,
            "minStockAlert": 8, "st1": 25, "st2": 15, "st3": 95,
            "img": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 18, "name": "Gentle Moisturizing Bath Soap (Pack of 4)", "sku": "PER-SOAP-04", "barcode": "8901030005026",
            "category": "Personal Care", "salePrice": 180.0, "purchasePrice": 130.0, "taxRate": 18.0, "unit": "pack", "allowParts": False,
            "minStockAlert": 10, "st1": 40, "st2": 25, "st3": 160,
            "img": "https://images.unsplash.com/photo-1607006314648-b4b6045d045d?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 19, "name": "Complete Care Herbal Toothpaste (150g)", "sku": "PER-PASTE-150", "barcode": "8901030005033",
            "category": "Personal Care", "salePrice": 95.0, "purchasePrice": 68.0, "taxRate": 18.0, "unit": "tube", "allowParts": False,
            "minStockAlert": 15, "st1": 50, "st2": 30, "st3": 200,
            "img": "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=500&auto=format&fit=crop&q=60"
        },

        # --- HOUSEHOLD & CLEANING (20-22) ---
        {
            "num": 20, "name": "Heavy Action Laundry Detergent Powder (2kg)", "sku": "HSD-DET-02", "barcode": "8901030006016",
            "category": "Household & Cleaning", "salePrice": 310.0, "purchasePrice": 220.0, "taxRate": 18.0, "unit": "pack", "allowParts": False,
            "minStockAlert": 10, "st1": 35, "st2": 20, "st3": 140,
            "img": "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 21, "name": "Concentrated Lemon Dishwash Gel (750ml)", "sku": "HSD-DISH-750", "barcode": "8901030006023",
            "category": "Household & Cleaning", "salePrice": 140.0, "purchasePrice": 98.0, "taxRate": 18.0, "unit": "bottle", "allowParts": False,
            "minStockAlert": 12, "st1": 45, "st2": 25, "st3": 180,
            "img": "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 22, "name": "Biodegradable Garbage Bags 30L (Roll of 30)", "sku": "HSD-BAG-30", "barcode": "8901030006030",
            "category": "Household & Cleaning", "salePrice": 120.0, "purchasePrice": 75.0, "taxRate": 18.0, "unit": "roll", "allowParts": False,
            "minStockAlert": 15, "st1": 50, "st2": 30, "st3": 210,
            "img": "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&auto=format&fit=crop&q=60"
        },

        # --- ELECTRONICS & GADGETS (23-26) ---
        {
            "num": 23, "name": "Braided Fast-Charging USB-C Cable (1.5m)", "sku": "ELE-CBL-TYPEC", "barcode": "8901030007013",
            "category": "Electronics & Gadgets", "salePrice": 299.0, "purchasePrice": 140.0, "taxRate": 18.0, "unit": "pcs", "allowParts": False,
            "minStockAlert": 10, "st1": 35, "st2": 25, "st3": 150,
            "img": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 24, "name": "Ergonomic Silent Wireless Optical Mouse", "sku": "ELE-MSE-WRL", "barcode": "8901030007020",
            "category": "Electronics & Gadgets", "salePrice": 599.0, "purchasePrice": 360.0, "taxRate": 18.0, "unit": "pcs", "allowParts": False,
            "minStockAlert": 6, "st1": 20, "st2": 12, "st3": 75,
            "img": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 25, "name": "High-Capacity 20000mAh Dual Port Power Bank", "sku": "ELE-PWR-20K", "barcode": "8901030007037",
            "category": "Electronics & Gadgets", "salePrice": 1499.0, "purchasePrice": 980.0, "taxRate": 18.0, "unit": "pcs", "allowParts": False,
            "minStockAlert": 4, "st1": 15, "st2": 8, "st3": 60,
            "img": "https://images.unsplash.com/photo-1609592807903-8d078b548fc1?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 26, "name": "Industrial Heavy Duty Impact Drill Machine 650W", "sku": "ELE-DRL-650", "barcode": "8901030007044",
            "category": "Electronics & Gadgets", "salePrice": 3250.0, "purchasePrice": 2200.0, "taxRate": 18.0, "unit": "set", "allowParts": False,
            "minStockAlert": 3, "st1": 12, "st2": 8, "st3": 32,
            "img": "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=60"
        },

        # --- APPAREL & LIFESTYLE (27-28) ---
        {
            "num": 27, "name": "Premium Combed Cotton Crewneck T-Shirt (Navy)", "sku": "APP-TSH-NVY", "barcode": "8901030008010",
            "category": "Apparel & Lifestyle", "salePrice": 499.0, "purchasePrice": 260.0, "taxRate": 5.0, "unit": "pcs", "allowParts": False,
            "minStockAlert": 8, "st1": 25, "st2": 18, "st3": 90,
            "img": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 28, "name": "Cushioned Athletic Ankle Socks (Pack of 3 Pairs)", "sku": "APP-SCK-03", "barcode": "8901030008027",
            "category": "Apparel & Lifestyle", "salePrice": 249.0, "purchasePrice": 120.0, "taxRate": 5.0, "unit": "pack", "allowParts": False,
            "minStockAlert": 10, "st1": 35, "st2": 25, "st3": 120,
            "img": "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=500&auto=format&fit=crop&q=60"
        },

        # --- STATIONERY & OFFICE (29-30) ---
        {
            "num": 29, "name": "Premium Multipurpose A4 Copier Paper (500 Sheets)", "sku": "STA-A4-500", "barcode": "8901030009017",
            "category": "Stationery & Office", "salePrice": 320.0, "purchasePrice": 240.0, "taxRate": 12.0, "unit": "ream", "allowParts": False,
            "minStockAlert": 12, "st1": 40, "st2": 20, "st3": 220,
            "img": "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 30, "name": "Executive Hardbound Wirebound Notebook (200 Pages)", "sku": "STA-NOTE-200", "barcode": "8901030009024",
            "category": "Stationery & Office", "salePrice": 160.0, "purchasePrice": 95.0, "taxRate": 12.0, "unit": "pcs", "allowParts": False,
            "minStockAlert": 15, "st1": 50, "st2": 30, "st3": 180,
            "img": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=60"
        },

        # --- GENERAL STORE (31-32) ---
        {
            "num": 31, "name": "Insulated Stainless Steel Water Bottle (750ml)", "sku": "GEN-BOT-750", "barcode": "8901030010013",
            "category": "General Store", "salePrice": 450.0, "purchasePrice": 280.0, "taxRate": 18.0, "unit": "pcs", "allowParts": False,
            "minStockAlert": 8, "st1": 25, "st2": 15, "st3": 80,
            "img": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60"
        },
        {
            "num": 32, "name": "Multi-Strand Copper Electrical Cable (Per Meter)", "sku": "GEN-CBL-MTR", "barcode": "8901030010020",
            "category": "General Store", "salePrice": 45.0, "purchasePrice": 32.0, "taxRate": 18.0, "unit": "meter", "allowParts": True,
            "minStockAlert": 25, "st1": 120, "st2": 80, "st3": 500,
            "img": "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500&auto=format&fit=crop&q=60"
        }
    ]

    store_1_items = []
    for p in raw_products:
        num = p["num"]
        item_obj_id = ObjectId(f"65f2a1b9a0000000000001{num:02x}")
        tot_stock = p["st1"] + p["st2"] + p["st3"]
        item_doc = {
            "_id": item_obj_id,
            "businessId": TENANT_1_ID,
            "id": f"item_1_{num}",
            "publicItemId": f"ITM-10{num:02d}",
            "name": p["name"],
            "sku": p["sku"],
            "barcode": p["barcode"],
            "category": p["category"],
            "salePrice": float(p["salePrice"]),
            "purchasePrice": float(p["purchasePrice"]),
            "taxRate": float(p["taxRate"]),
            "unit": p["unit"],
            "allowParts": p.get("allowParts", False),
            "currentStock": tot_stock,
            "minStockAlert": p["minStockAlert"],
            "images": [
                {
                    "id": f"img_{num}_1",
                    "url": p["img"],
                    "order": 0,
                    "isPrimary": True,
                    "name": p["name"]
                }
            ],
            "imageUrl": p["img"],
            "locations": [
                {
                    "locationId": str(LOC_1_ID),
                    "locationName": "Main Flagship Counter",
                    "salePrice": float(p["salePrice"]),
                    "purchasePrice": float(p["purchasePrice"]),
                    "currentStock": p["st1"],
                    "minStockAlert": p["minStockAlert"],
                    "isListed": True
                },
                {
                    "locationId": str(LOC_2_ID),
                    "locationName": "Downtown Express Branch",
                    "salePrice": round(float(p["salePrice"]) * 1.05, 2) if float(p["salePrice"]) > 100 else float(p["salePrice"]),
                    "purchasePrice": float(p["purchasePrice"]),
                    "currentStock": p["st2"],
                    "minStockAlert": max(2, p["minStockAlert"] // 2),
                    "isListed": True
                },
                {
                    "locationId": str(LOC_3_ID),
                    "locationName": "Central Supply Warehouse",
                    "salePrice": float(p["salePrice"]),
                    "purchasePrice": float(p["purchasePrice"]),
                    "currentStock": p["st3"],
                    "minStockAlert": p["minStockAlert"] * 3,
                    "isListed": False
                }
            ],
            "qrPayload": f"ITEM:ITM-10{num:02d}",
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        }
        store_1_items.append(item_doc)

    await tdb.items.insert_many(store_1_items)
    print(f"Seeded {len(store_1_items)} rich items into Isolated Tenant Database: {STORE_1_DB}")

    # 8. Seed Parties
    parties = [
        {
            "_id": ObjectId("65f2a1b9a000000000000201"),
            "businessId": TENANT_1_ID,
            "name": "Aarav Sharma",
            "type": ["customer"],
            "phone": "+91 98765 43210",
            "email": "aarav.sharma@example.com",
            "address": "B-42, Hauz Khas Enclave, New Delhi, 110016",
            "taxId": "07AAAAA0000A1Z5",
            "openingBalance": 0.0,
            "currentReceivable": 0.0,
            "currentPayable": 0.0,
            "currentBalance": 0.0,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000202"),
            "businessId": TENANT_1_ID,
            "name": "Downtown Coffee Lounge & Cafe",
            "type": ["customer"],
            "phone": "+91 98112 23344",
            "email": "procurement@downtowncafe.in",
            "address": "Shop 12, City Walk Center, Downtown",
            "taxId": "07BBBBB1111B2Z6",
            "openingBalance": 0.0,
            "currentReceivable": 450.0,
            "currentPayable": 0.0,
            "currentBalance": 450.0,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000203"),
            "businessId": TENANT_1_ID,
            "name": "National FMCG Distributors Ltd",
            "type": ["supplier"],
            "phone": "+91 11 2345 6789",
            "email": "sales@nationalfmcg.com",
            "address": "Logistics Hub Phase 2, Delhi",
            "taxId": "07CCCCC2222C3Z7",
            "openingBalance": 0.0,
            "currentReceivable": 0.0,
            "currentPayable": 12500.0,
            "currentBalance": -12500.0,
            "isActive": True,
            "createdAt": now
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000204"),
            "businessId": TENANT_1_ID,
            "name": "Meera Patel",
            "type": ["customer"],
            "phone": "+91 98223 34455",
            "email": "meera.patel@gmail.com",
            "address": "Flat 304, Palm Grove Heights, Gurgaon",
            "taxId": "",
            "openingBalance": 0.0,
            "currentReceivable": 0.0,
            "currentPayable": 0.0,
            "currentBalance": 0.0,
            "isActive": True,
            "createdAt": now
        }
    ]
    await tdb.parties.insert_many(parties)
    print(f"Seeded {len(parties)} parties into Tenant Database.")

    # 9. Seed Invoices with Full Customer & Location Snapshots
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
                    "itemId": str(ObjectId("65f2a1b9a000000000000101")),
                    "nameSnapshot": "Premium Royal Basmati Rice (1kg)",
                    "skuSnapshot": "GRO-RICE-01",
                    "quantity": 2.0,
                    "unitPrice": 140.0,
                    "discount": 0.0,
                    "taxableAmount": 266.67,
                    "taxRate": 5.0,
                    "taxAmount": 13.33,
                    "lineTotal": 280.0
                },
                {
                    "itemId": str(ObjectId("65f2a1b9a000000000000118")),
                    "nameSnapshot": "Ergonomic Silent Wireless Optical Mouse",
                    "skuSnapshot": "ELE-MSE-WRL",
                    "quantity": 1.0,
                    "unitPrice": 599.0,
                    "discount": 0.0,
                    "taxableAmount": 507.63,
                    "taxRate": 18.0,
                    "taxAmount": 91.37,
                    "lineTotal": 599.0
                }
            ],
            "subtotal": 774.30,
            "taxTotal": 104.70,
            "discountTotal": 0.0,
            "discountType": None,
            "discountValue": 0.0,
            "additionalCharges": 0.0,
            "roundOff": 0.0,
            "grandTotal": 879.0,
            "paidAmount": 879.0,
            "balanceDue": 0.0,
            "notes": "Retail POS Counter Bill",
            "createdByUserId": "65f2a1b9a000000000000012",
            "createdAt": now - timedelta(days=2)
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
            "paymentStatus": "PARTIAL",
            "paymentMode": "CASH",
            "items": [
                {
                    "itemId": str(ObjectId("65f2a1b9a00000000000010a")),
                    "nameSnapshot": "Classic Instant Arabica Coffee (100g)",
                    "skuSnapshot": "BEV-COF-100",
                    "quantity": 5.0,
                    "unitPrice": 360.0,
                    "discount": 50.0,
                    "taxableAmount": 1483.05,
                    "taxRate": 18.0,
                    "taxAmount": 266.95,
                    "lineTotal": 1750.0
                }
            ],
            "subtotal": 1483.05,
            "taxTotal": 266.95,
            "discountTotal": 50.0,
            "discountType": "FLAT",
            "discountValue": 50.0,
            "additionalCharges": 0.0,
            "roundOff": 0.0,
            "grandTotal": 1750.0,
            "paidAmount": 1300.0,
            "balanceDue": 450.0,
            "notes": "Downtown Cafe Bulk Supply Bill",
            "createdByUserId": "65f2a1b9a000000000000011",
            "createdAt": now - timedelta(days=1)
        }
    ]
    await tdb.invoices.insert_many(invoices)

    # 10. Seed Payments
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
            "amount": 879.0,
            "paymentMode": "UPI",
            "paidAt": now - timedelta(days=2),
            "createdAt": now - timedelta(days=2)
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
            "paidAt": now - timedelta(days=1),
            "createdAt": now - timedelta(days=1)
        }
    ]
    await tdb.payments.insert_many(payments)

    # 11. Seed Realistic Expenses
    expenses = [
        {
            "_id": ObjectId("65f2a1b9a000000000000501"),
            "businessId": TENANT_1_ID,
            "category": "Rent & Facilities",
            "amount": 35000.0,
            "paymentMode": "BANK_TRANSFER",
            "expenseDate": now - timedelta(days=5),
            "notes": "Monthly retail shop floor lease for Flagship Counter",
            "locationId": str(LOC_1_ID),
            "createdAt": now - timedelta(days=5)
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000502"),
            "businessId": TENANT_1_ID,
            "category": "Electricity & Utilities",
            "amount": 6200.0,
            "paymentMode": "UPI",
            "expenseDate": now - timedelta(days=3),
            "notes": "Commercial power bill for March",
            "locationId": str(LOC_1_ID),
            "createdAt": now - timedelta(days=3)
        },
        {
            "_id": ObjectId("65f2a1b9a000000000000503"),
            "businessId": TENANT_1_ID,
            "category": "Logistics & Freight",
            "amount": 2450.0,
            "paymentMode": "CASH",
            "expenseDate": now - timedelta(days=1),
            "notes": "Inter-branch stock transfer logistics van fare",
            "locationId": str(LOC_3_ID),
            "createdAt": now - timedelta(days=1)
        }
    ]
    await tdb.expenses.insert_many(expenses)
    print("Seeded expenses, payments, and invoices successfully into Tenant DB.")

    final_root_colls = await primary_db.list_collection_names()
    print(f"\nFinal Collections in Root DB ({PRIMARY_DB_NAME}): {final_root_colls}")
    final_tenant_colls = await tdb.list_collection_names()
    print(f"Final Collections in Tenant DB ({STORE_1_DB}): {final_tenant_colls}")

    client.close()
    print("\nDatabase architecture cleanup and 32-item catalog initialization COMPLETED!")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1].lower() in ["sync", "--sync", "migrate"]:
        from scripts.sync_db_schema import run_db_schema_sync
        asyncio.run(run_db_schema_sync())
    else:
        asyncio.run(cleanup_and_init_db())

