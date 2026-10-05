import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload

from app.core.database import connect_to_mongo, close_mongo_connection, db_manager

TENANT_A_ID = "65f2a1b9a000000000000001"
TENANT_B_ID = "65f2a1b9a000000000000002"

@pytest.fixture(autouse=True)
async def init_db():
    try:
        await connect_to_mongo()
        db = db_manager.get_primary_database()
        from bson import ObjectId
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        
        # Ensure test tenant A
        await db.tenants.update_one(
            {"_id": ObjectId(TENANT_A_ID)},
            {"$set": {
                "_id": ObjectId(TENANT_A_ID),
                "name": "QuickBill Enterprise Retail",
                "slug": "quickbill-enterprise",
                "plan": "ENTERPRISE",
                "status": "ACTIVE",
                "subscription": {
                    "plan": "ENTERPRISE",
                    "status": "ACTIVE",
                    "startDate": now.isoformat(),
                    "endDate": (now + timedelta(days=365)).isoformat(),
                    "billingCycle": "ANNUAL",
                    "pricePerCycle": 49999.0,
                    "maxUsers": 50,
                    "maxLocations": 20,
                    "autoRenew": True
                },
                "databaseConfig": {
                    "isolationMode": "SHARED",
                    "databaseName": "quickbill_db"
                }
            }},
            upsert=True
        )

        # Ensure test tenant B
        await db.tenants.update_one(
            {"_id": ObjectId(TENANT_B_ID)},
            {"$set": {
                "_id": ObjectId(TENANT_B_ID),
                "name": "Apex Supermart West",
                "slug": "apex-supermart",
                "plan": "PROFESSIONAL",
                "status": "ACTIVE",
                "subscription": {
                    "plan": "PROFESSIONAL",
                    "status": "ACTIVE",
                    "startDate": now.isoformat(),
                    "endDate": (now + timedelta(days=180)).isoformat(),
                    "billingCycle": "MONTHLY",
                    "pricePerCycle": 2499.0,
                    "maxUsers": 10,
                    "maxLocations": 3,
                    "autoRenew": True
                },
                "databaseConfig": {
                    "isolationMode": "SHARED",
                    "databaseName": "quickbill_db"
                }
            }},
            upsert=True
        )
    except Exception as e:
        print(f"Error in init_db fixture: {e}")
    yield
    # Clean up test tenant B after test run to leave DB clean
    try:
        db = db_manager.get_primary_database()
        from bson import ObjectId
        await db.tenants.delete_one({"_id": ObjectId(TENANT_B_ID)})
    except Exception:
        pass

@pytest.fixture
def superadmin_token():
    payload = TokenPayload(
        sub="usr_superadmin",
        email="superadmin@quickbill.local",
        roles=["super_admin", "admin"],
        permissions=["all"],
        default_business_id=TENANT_A_ID,
        authorized_business_ids=[TENANT_A_ID, TENANT_B_ID]
    )
    return create_access_token(payload)

@pytest.mark.asyncio
async def test_api_health_live():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_auth_login_demo():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/login", json={
            "email": "admin@quickbill.local",
            "password": "admin123"
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["email"] == "admin@quickbill.local"

@pytest.mark.asyncio
async def test_super_admin_login_and_tenant_list(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        tenants_res = await ac.get("/api/v1/tenants", headers=headers)
        assert tenants_res.status_code == 200
        tenants = tenants_res.json()
        assert len(tenants) >= 1
        assert "database_config" in tenants[0]

@pytest.mark.asyncio
async def test_cross_tenant_item_isolation(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers_tenant_a = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_A_ID
        }
        headers_tenant_b = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_B_ID
        }

        import uuid
        test_sku = f"SKU-A-{uuid.uuid4().hex[:6]}"
        # 1. Create item in Store A
        create_res = await ac.post("/api/v1/items", json={
            "name": "Store A Premium Item",
            "sku": test_sku,
            "unit": "pcs",
            "purchase_price": "50.00",
            "sale_price": "100.00",
            "tax_rate": "18.0",
            "opening_stock": 100,
            "min_stock_alert": 10
        }, headers=headers_tenant_a)
        
        # Item creation in Store A must succeed
        assert create_res.status_code == 201
        item_a = create_res.json()
        item_id = item_a.get("_id") or item_a.get("id")
        public_id = item_a.get("publicItemId") or item_a.get("public_item_id")

        # 2. Store A can access the item
        get_res_a = await ac.get(f"/api/v1/items/{item_id}", headers=headers_tenant_a)
        assert get_res_a.status_code == 200
        assert get_res_a.json()["name"] == "Store A Premium Item"

        # 3. Store B CANNOT access Store A's item (must return 404 Not Found)
        get_res_b = await ac.get(f"/api/v1/items/{item_id}", headers=headers_tenant_b)
        assert get_res_b.status_code == 404

        # 4. Store B CANNOT scan or lookup Store A's item QR code
        qr_res_b = await ac.get(f"/api/v1/items/lookup/qr/{public_id}", headers=headers_tenant_b)
        assert qr_res_b.status_code == 404

        # 5. Clean up test item in Store A so test does not pollute DB
        del_res = await ac.delete(f"/api/v1/items/{item_id}", headers=headers_tenant_a)
        assert del_res.status_code == 204

@pytest.mark.asyncio
async def test_cross_tenant_party_isolation(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers_tenant_a = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_A_ID
        }
        headers_tenant_b = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_B_ID
        }

        # 1. Create party in Store A
        party_res = await ac.post("/api/v1/parties", json={
            "name": "Store A Exclusive VIP Customer",
            "phone": "+91 9999900001",
            "type": "customer",
            "opening_balance": "5000.00"
        }, headers=headers_tenant_a)

        assert party_res.status_code == 201
        party_a = party_res.json()
        party_id = party_a.get("_id") or party_a.get("id")

        # Store A can access
        res_a = await ac.get(f"/api/v1/parties/{party_id}", headers=headers_tenant_a)
        assert res_a.status_code == 200

        # Store B CANNOT access (must be 404)
        res_b = await ac.get(f"/api/v1/parties/{party_id}", headers=headers_tenant_b)
        assert res_b.status_code == 404

        # Cleanup
        del_res = await ac.delete(f"/api/v1/parties/{party_id}", headers=headers_tenant_a)
        assert del_res.status_code == 204

@pytest.mark.asyncio
async def test_customers_crm_and_marketing_isolation(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers_tenant_a = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_A_ID
        }
        headers_tenant_b = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_B_ID
        }

        # 1. Create dedicated customer in Store A
        import uuid
        phone_a = f"98{uuid.uuid4().int % 100000000:08d}"
        cust_res = await ac.post("/api/v1/customers", json={
            "name": "Campaign Target VIP Customer",
            "phone": phone_a,
            "email": "vip.marketing@example.com",
            "tags": ["VIP", "FestivalCampaign"],
            "marketingConsent": True,
            "openingBalance": "0.00"
        }, headers=headers_tenant_a)

        assert cust_res.status_code == 201
        cust_a = cust_res.json()
        cust_id = cust_a["_id"]

        # 2. Store A phone lookup works
        lookup_res_a = await ac.get(f"/api/v1/customers/lookup/by-phone?phone={phone_a}", headers=headers_tenant_a)
        assert lookup_res_a.status_code == 200
        assert lookup_res_a.json()["name"] == "Campaign Target VIP Customer"

        # 3. Store B cannot lookup Store A's customer
        lookup_res_b = await ac.get(f"/api/v1/customers/lookup/by-phone?phone={phone_a}", headers=headers_tenant_b)
        assert lookup_res_b.status_code == 200
        assert lookup_res_b.json() is None

        # 4. Store A marketing export includes the customer
        export_res_a = await ac.get("/api/v1/customers/export/marketing", headers=headers_tenant_a)
        assert export_res_a.status_code == 200
        exports = export_res_a.json()
        assert any(c["id"] == cust_id for c in exports)

        # Cleanup
        del_cust = await ac.delete(f"/api/v1/customers/{cust_id}", headers=headers_tenant_a)
        assert del_cust.status_code in [200, 204]


@pytest.mark.asyncio
async def test_category_crud_and_expense_type_isolation(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers_tenant_a = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_A_ID
        }

        # 1. Create an EXPENSE category in Store A
        create_res = await ac.post("/api/v1/categories", json={
            "name": "Shop Electricity Bill",
            "type": "EXPENSE",
            "description": "Monthly utility power expenses"
        }, headers=headers_tenant_a)
        assert create_res.status_code == 201
        created_cat = create_res.json()
        cat_id = created_cat["_id"]
        assert created_cat["name"] == "Shop Electricity Bill"
        assert created_cat["type"] == "EXPENSE"

        # 2. Filter by type=EXPENSE returns it, filter by type=PRODUCT does not
        list_exp = await ac.get("/api/v1/categories?type=EXPENSE", headers=headers_tenant_a)
        assert list_exp.status_code == 200
        assert any(c["_id"] == cat_id for c in list_exp.json())

        list_prod = await ac.get("/api/v1/categories?type=PRODUCT", headers=headers_tenant_a)
        assert list_prod.status_code == 200
        assert not any(c["_id"] == cat_id for c in list_prod.json())

        # 3. Update category name
        update_res = await ac.put(f"/api/v1/categories/{cat_id}", json={
            "name": "Shop Electricity & Power Bill",
            "type": "EXPENSE"
        }, headers=headers_tenant_a)
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "Shop Electricity & Power Bill"

        # 4. Delete category from database
        del_res = await ac.delete(f"/api/v1/categories/{cat_id}", headers=headers_tenant_a)
        assert del_res.status_code == 204

        # 5. Verify it is gone from database
        verify_res = await ac.get("/api/v1/categories?type=EXPENSE", headers=headers_tenant_a)
        assert not any(c["_id"] == cat_id for c in verify_res.json())


@pytest.mark.asyncio
async def test_super_admin_subscription_renewal_and_quotas(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # 1. List tenants and verify subscription object exists
        tenants_res = await ac.get("/api/v1/tenants", headers=headers)
        assert tenants_res.status_code == 200
        tenants = tenants_res.json()
        assert len(tenants) >= 1
        t1 = tenants[0]
        assert "subscription" in t1
        assert "max_users" in t1["subscription"]
        assert "max_locations" in t1["subscription"]
        assert "days_remaining" in t1["subscription"]

        # 2. Renew subscription for tenant
        renew_res = await ac.post(
            f"/api/v1/tenants/{t1['id']}/renew-subscription",
            json={
                "extend_days": 30,
                "plan": "ENTERPRISE",
                "max_users": 25,
                "max_locations": 10,
                "amount": 49999.0,
                "notes": "Automated test renewal +30 days"
            },
            headers=headers
        )
        assert renew_res.status_code == 200
        renew_data = renew_res.json()
        assert renew_data["success"] is True
        assert renew_data["status"] == "ACTIVE"
        assert renew_data["maxUsers"] == 25
        assert renew_data["maxLocations"] == 10

        # 3. Test database link test endpoint
        ping_res = await ac.post(
            "/api/v1/tenants/test-db-connection",
            json={
                "mongodb_uri": "mongodb://admin:secretpassword@localhost:27017/?authSource=admin",
                "database_name": "quickbill_db"
            },
            headers=headers
        )
        assert ping_res.status_code == 200
        assert "status" in ping_res.json()


@pytest.mark.asyncio
async def test_store_suspension_login_and_operational_lockdown(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sa_headers = {"Authorization": f"Bearer {superadmin_token}"}
        primary_db = db_manager.get_primary_database()
        from app.core.security import get_password_hash
        from bson import ObjectId

        # 1. Ensure test store owner and cashier exist in Store B
        hashed_pw = get_password_hash("StoreStaff@2026")
        await primary_db.users.update_one(
            {"email": "cashier_b@store.local"},
            {"$set": {
                "name": "Store B Cashier",
                "email": "cashier_b@store.local",
                "passwordHash": hashed_pw,
                "roles": ["CASHIER"],
                "tenantId": ObjectId(TENANT_B_ID),
                "authorizedTenantIds": [TENANT_B_ID],
                "isActive": True
            }},
            upsert=True
        )
        await primary_db.users.update_one(
            {"email": "owner_b@store.local"},
            {"$set": {
                "name": "Store B Owner",
                "email": "owner_b@store.local",
                "passwordHash": hashed_pw,
                "roles": ["TENANT_ADMIN"],
                "tenantId": ObjectId(TENANT_B_ID),
                "authorizedTenantIds": [TENANT_B_ID],
                "isActive": True
            }},
            upsert=True
        )

        # 2. Super Admin suspends Store B
        suspend_res = await ac.patch(
            f"/api/v1/tenants/{TENANT_B_ID}/status",
            json={"status": "SUSPENDED"},
            headers=sa_headers
        )
        assert suspend_res.status_code == 200
        assert suspend_res.json()["status"] == "SUSPENDED"

        # Verify DB document
        b_doc = await primary_db.tenants.find_one({"_id": ObjectId(TENANT_B_ID)})
        assert b_doc["status"] == "SUSPENDED"
        assert b_doc.get("subscription", {}).get("status") == "SUSPENDED"

        # 3. Cashier login must be FORBIDDEN (403)
        cashier_login = await ac.post("/api/v1/auth/login", json={
            "email": "cashier_b@store.local",
            "password": "StoreStaff@2026"
        })
        assert cashier_login.status_code == 403
        assert "suspended" in cashier_login.json()["detail"].lower()

        # 4. Store Owner login must SUCCEED (200) in restricted mode
        owner_login = await ac.post("/api/v1/auth/login", json={
            "email": "owner_b@store.local",
            "password": "StoreStaff@2026"
        })
        assert owner_login.status_code == 200
        owner_data = owner_login.json()
        assert owner_data["store_status"] == "SUSPENDED"
        assert owner_data["is_store_locked"] is True
        owner_token = owner_data["access_token"]
        owner_headers = {
            "Authorization": f"Bearer {owner_token}",
            "X-Business-ID": TENANT_B_ID
        }

        # 5. POS billing creation must be BLOCKED (403)
        pos_res = await ac.post("/api/v1/sales", json={
            "customerName": "Walkin Customer",
            "items": [{
                "itemId": "item_001",
                "name": "Test Product",
                "quantity": 1,
                "salePrice": 100.0,
                "taxRate": 18.0
            }],
            "paymentMode": "CASH",
            "amountPaid": 118.0
        }, headers=owner_headers)
        assert pos_res.status_code == 403
        assert "locked" in pos_res.json()["detail"].lower()

        # 6. Read-only analytics (list sales) must SUCCEED (200)
        sales_list_res = await ac.get("/api/v1/sales", headers=owner_headers)
        assert sales_list_res.status_code == 200

        # 7. Super Admin activates Store B
        activate_res = await ac.patch(
            f"/api/v1/tenants/{TENANT_B_ID}/status",
            json={"status": "ACTIVE"},
            headers=sa_headers
        )
        assert activate_res.status_code == 200
        assert activate_res.json()["status"] == "ACTIVE"

        # 8. Cashier login now SUCCEEDS
        cashier_login_active = await ac.post("/api/v1/auth/login", json={
            "email": "cashier_b@store.local",
            "password": "StoreStaff@2026"
        })
        assert cashier_login_active.status_code == 200
        assert cashier_login_active.json()["store_status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_tenant_current_subscription_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        primary_db = db_manager.get_primary_database()
        from app.core.security import get_password_hash
        from bson import ObjectId

        hashed_pw = get_password_hash("OwnerSecret@2026")
        await primary_db.users.update_one(
            {"email": "owner_sync@store.local"},
            {"$set": {
                "name": "Sync Store Owner",
                "email": "owner_sync@store.local",
                "passwordHash": hashed_pw,
                "roles": ["TENANT_ADMIN"],
                "tenantId": ObjectId(TENANT_A_ID),
                "authorizedTenantIds": [TENANT_A_ID],
                "isActive": True
            }},
            upsert=True
        )

        # Login as tenant owner
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "owner_sync@store.local",
            "password": "OwnerSecret@2026"
        })
        token = login_res.json()["access_token"]
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Business-ID": TENANT_A_ID
        }

        # Update Tenant A subscription in DB to test custom limits (3 users, 3 locations)
        await primary_db.tenants.update_one(
            {"_id": ObjectId(TENANT_A_ID)},
            {"$set": {
                "subscription.maxUsers": 3,
                "subscription.maxLocations": 3,
                "subscription.status": "ACTIVE",
                "subscription.plan": "PRO"
            }}
        )

        # Fetch /tenants/current
        res = await ac.get("/api/v1/tenants/current", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == TENANT_A_ID
        assert "subscription" in data
        assert data["subscription"]["max_users"] == 3
        assert data["subscription"]["max_locations"] == 3
        assert data["subscription"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_cross_tenant_invoice_and_sales_isolation(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers_tenant_a = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_A_ID
        }
        headers_tenant_b = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_B_ID
        }

        # 1. Create an item in Store A
        import uuid
        sku_a = f"SKU-INV-{uuid.uuid4().hex[:6]}"
        item_res = await ac.post("/api/v1/items", json={
            "name": "Invoice Isolation Test Item",
            "sku": sku_a,
            "unit": "pcs",
            "purchase_price": "80.00",
            "sale_price": "120.00",
            "tax_rate": "18.0",
            "opening_stock": 50,
            "min_stock_alert": 5
        }, headers=headers_tenant_a)
        assert item_res.status_code == 201
        item_data = item_res.json()
        item_id_a = item_data.get("_id") or item_data.get("id")

        # 2. Create a sale invoice in Store A
        sale_res_a = await ac.post("/api/v1/sales", json={
            "consumerName": "Store A Customer",
            "consumerPhone": "+91 9876543210",
            "items": [{
                "itemId": item_id_a,
                "name": "Invoice Isolation Test Item",
                "quantity": 2,
                "unitPrice": 120.00,
                "taxRate": 18.00
            }],
            "paymentMode": "CASH",
            "paidAmount": 283.20,
            "enableRoundOff": True
        }, headers=headers_tenant_a)
        assert sale_res_a.status_code == 201
        sale_doc_a = sale_res_a.json()
        invoice_id_a = sale_doc_a.get("_id") or sale_doc_a.get("id")
        assert invoice_id_a is not None
        assert sale_doc_a.get("businessId") == TENANT_A_ID

        # 3. Store A can retrieve the invoice directly by ID
        get_res_a = await ac.get(f"/api/v1/sales/{invoice_id_a}", headers=headers_tenant_a)
        assert get_res_a.status_code == 200
        assert get_res_a.json()["consumerName"] == "Store A Customer"

        # 4. Store A sees the invoice in /sales list
        list_res_a = await ac.get("/api/v1/sales", headers=headers_tenant_a)
        assert list_res_a.status_code == 200
        a_invoices = list_res_a.json()["data"]
        assert any(inv.get("id") == invoice_id_a or inv.get("_id") == invoice_id_a for inv in a_invoices)

        # 5. Store B CANNOT see Store A's invoice in /sales list
        list_res_b = await ac.get("/api/v1/sales", headers=headers_tenant_b)
        assert list_res_b.status_code == 200
        b_invoices = list_res_b.json()["data"]
        assert not any(inv.get("id") == invoice_id_a or inv.get("_id") == invoice_id_a for inv in b_invoices)

        # 6. Store B CANNOT fetch Store A's invoice by ID (must return 404 Not Found)
        get_res_b = await ac.get(f"/api/v1/sales/{invoice_id_a}", headers=headers_tenant_b)
        assert get_res_b.status_code == 404

        # 7. Store B CANNOT return / update Store A's invoice (must return 404 Not Found)
        put_res_b = await ac.put(f"/api/v1/sales/{invoice_id_a}", json={
            "items": [{
                "itemId": item_id_a,
                "quantity": 2,
                "returnedQuantity": 1,
                "returnReason": "DEFECTIVE_DAMAGED"
            }]
        }, headers=headers_tenant_b)
        assert put_res_b.status_code == 404

        # Clean up Store A test item
        await ac.delete(f"/api/v1/items/{item_id_a}", headers=headers_tenant_a)


@pytest.mark.asyncio
async def test_cross_tenant_stock_integrity_on_sales(superadmin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers_tenant_a = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_A_ID
        }
        headers_tenant_b = {
            "Authorization": f"Bearer {superadmin_token}",
            "X-Business-ID": TENANT_B_ID
        }

        # 1. Create item in Store A with stock = 100
        import uuid
        sku_val = f"SKU-STOCK-{uuid.uuid4().hex[:6]}"
        item_res = await ac.post("/api/v1/items", json={
            "name": "Store A Stock Protected Item",
            "sku": sku_val,
            "unit": "pcs",
            "purchase_price": "100.00",
            "sale_price": "150.00",
            "tax_rate": "18.0",
            "opening_stock": 100,
            "min_stock_alert": 10
        }, headers=headers_tenant_a)
        assert item_res.status_code == 201
        item_a = item_res.json()
        item_id_a = item_a.get("_id") or item_a.get("id")

        # 2. Store B creates a sale using Store A's item ID
        sale_res_b = await ac.post("/api/v1/sales", json={
            "consumerName": "Store B Buyer",
            "items": [{
                "itemId": item_id_a,
                "name": "Attempting cross tenant deduction",
                "quantity": 5,
                "unitPrice": 150.00,
                "taxRate": 18.00
            }],
            "paymentMode": "CASH",
            "paidAmount": 885.00
        }, headers=headers_tenant_b)
        assert sale_res_b.status_code == 201

        # 3. Check Store A's item stock: must STILL be exactly 100!
        item_check_a = await ac.get(f"/api/v1/items/{item_id_a}", headers=headers_tenant_a)
        assert item_check_a.status_code == 200
        assert float(item_check_a.json()["currentStock"]) == 100.0

        # Clean up
        await ac.delete(f"/api/v1/items/{item_id_a}", headers=headers_tenant_a)






