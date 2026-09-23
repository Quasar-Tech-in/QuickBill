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

        # 1. Create item in Store A
        create_res = await ac.post("/api/v1/items", json={
            "name": "Store A Premium Item",
            "sku": "SKU-A-999",
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

