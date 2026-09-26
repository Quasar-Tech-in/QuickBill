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
    except Exception:
        pass
    yield
    # keep connection or close

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


