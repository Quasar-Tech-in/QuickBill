import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload

TENANT_ID = "65f2a1b9a000000000000001"

@pytest.fixture
def superadmin_headers():
    payload = TokenPayload(
        sub="usr_superadmin",
        email="superadmin@quickbill.local",
        name="Super Admin",
        roles=["SUPER_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def tenant_admin_headers():
    payload = TokenPayload(
        sub="usr_admin_a",
        email="admin_a@store.local",
        name="Store Admin A",
        roles=["TENANT_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def cashier_headers():
    payload = TokenPayload(
        sub="usr_cashier_a",
        email="cashier_a@store.local",
        name="Cashier Amit",
        roles=["CASHIER"],
        permissions=["sales:read", "sales:write"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_non_superadmin_cannot_update_persona_direct(tenant_admin_headers):
    """Verify Tenant Admin receives 403 Forbidden when attempting direct businessPersona update."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"businessPersona": "CAFE"},
            headers=tenant_admin_headers
        )
        assert res.status_code == 403
        data = res.json()
        assert "Only Super Administrators are authorized to configure business persona." in data["detail"]

@pytest.mark.asyncio
async def test_non_superadmin_cannot_update_persona_nested_camel_case(tenant_admin_headers):
    """Verify Tenant Admin receives 403 Forbidden when smuggling businessPersona inside settings dict (camelCase)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"settings": {"businessPersona": "HYBRID"}},
            headers=tenant_admin_headers
        )
        assert res.status_code == 403
        data = res.json()
        assert "Only Super Administrators are authorized to configure business persona." in data["detail"]

@pytest.mark.asyncio
async def test_non_superadmin_cannot_update_persona_nested_snake_case(tenant_admin_headers):
    """Verify Tenant Admin receives 403 Forbidden when smuggling business_persona inside settings dict (snake_case)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"settings": {"business_persona": "CAFE"}},
            headers=tenant_admin_headers
        )
        assert res.status_code == 403
        data = res.json()
        assert "Only Super Administrators are authorized to configure business persona." in data["detail"]

@pytest.mark.asyncio
async def test_non_superadmin_regular_profile_and_settings_update_succeeds(tenant_admin_headers):
    """Verify Tenant Admin can update normal store profile and general settings without persona changes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={
                "name": "Updated Store A",
                "phone": "+91 98765 43210",
                "settings": {
                    "currency": "INR",
                    "currencySymbol": "₹",
                    "defaultTaxRate": 12.0
                }
            },
            headers=tenant_admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["profile"]["name"] == "Updated Store A"
        assert data["profile"]["phone"] == "+91 98765 43210"
        assert data["profile"]["settings.currency"] == "INR"
        assert data["profile"]["settings.defaultTaxRate"] == 12.0

@pytest.mark.asyncio
async def test_superadmin_can_assign_all_personas(superadmin_headers):
    """Verify Super Admin can successfully assign RETAIL, CAFE, and HYBRID personas."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for persona in ["CAFE", "HYBRID", "RETAIL"]:
            res = await client.put(
                f"/api/v1/tenants/{TENANT_ID}",
                json={"businessPersona": persona},
                headers=superadmin_headers
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["profile"]["settings.businessPersona"] == persona

            # Verify retrieval reflects new persona
            get_res = await client.get("/api/v1/tenants/current", headers=superadmin_headers)
            assert get_res.status_code == 200
            get_data = get_res.json()
            assert get_data.get("settings", {}).get("businessPersona") == persona

@pytest.mark.asyncio
async def test_superadmin_invalid_persona_returns_400(superadmin_headers):
    """Verify Super Admin passing an invalid persona string receives HTTP 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Direct invalid persona
        res_direct = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"businessPersona": "INVALID_PERSONA"},
            headers=superadmin_headers
        )
        assert res_direct.status_code == 400
        data_direct = res_direct.json()
        assert "Invalid business persona 'INVALID_PERSONA'." in data_direct["detail"]
        assert "Valid personas are: CAFE, HYBRID, RETAIL." in data_direct["detail"]

        # 2. Nested invalid persona
        res_nested = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"settings": {"businessPersona": "NOT_A_PERSONA"}},
            headers=superadmin_headers
        )
        assert res_nested.status_code == 400
        data_nested = res_nested.json()
        assert "Invalid business persona 'NOT_A_PERSONA'." in data_nested["detail"]

@pytest.mark.asyncio
async def test_cashier_forbidden_from_store_profile_update(cashier_headers):
    """Verify unprivileged staff (Cashier) receives 403 Forbidden on store profile update."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"name": "Hacked Store Name"},
            headers=cashier_headers
        )
        assert res.status_code == 403
        data = res.json()
        assert "Only Store Administrators or Super Admins can update the business profile." in data["detail"]

@pytest.mark.asyncio
async def test_schemas_persona_and_normalization():
    """Verify BusinessPersona enum, TableResponse qrCodeToken, and PublicOrderSubmitRequest token alias."""
    from app.schemas.cafe import BusinessPersona, TenantSettings, TableResponse, PublicOrderSubmitRequest, TableSettleRequest

    # 1. BusinessPersona enum
    assert BusinessPersona.RETAIL.value == "RETAIL"
    assert BusinessPersona.CAFE.value == "CAFE"
    assert BusinessPersona.HYBRID.value == "HYBRID"

    # 2. TenantSettings enum
    ts_default = TenantSettings()
    assert ts_default.business_persona == BusinessPersona.RETAIL
    ts_cafe = TenantSettings(businessPersona="CAFE")
    assert ts_cafe.business_persona == BusinessPersona.CAFE

    # 3. TableResponse qrCodeToken
    tr = TableResponse(
        _id="tbl_123",
        businessId="biz_123",
        tableNumber="T-01",
        label="Table 1",
        qrCodeToken="secret_token_123"
    )
    assert tr.qr_code_token == "secret_token_123"
    assert tr.model_dump(by_alias=True)["qrCodeToken"] == "secret_token_123"

    # 4. PublicOrderSubmitRequest accepts "token" alias without 422
    order_with_token = PublicOrderSubmitRequest(
        tableId="tbl_123",
        token="my_hmac_token",
        items=[{"itemId": "item_1", "unitPrice": 10.0, "quantity": 1.0}]
    )
    assert order_with_token.qr_token == "my_hmac_token"

    # 5. TableSettleRequest accepts discountAmount
    settle_req = TableSettleRequest(discountAmount=50.0)
    assert settle_req.discount_amount == 50.0

@pytest.mark.asyncio
async def test_superadmin_create_tenant_with_persona(superadmin_headers):
    """Verify Super Admin can specify businessPersona at tenant provisioning and invalid persona is rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid persona on create
        invalid_payload = {
            "name": "Invalid Persona Store",
            "slug": "invalid-store",
            "adminEmail": "admin@invalid.local",
            "adminPassword": "password123",
            "businessPersona": "INVALID_TYPE",
            "databaseConfig": {"isolationMode": "SHARED"}
        }
        res_invalid = await client.post("/api/v1/tenants", json=invalid_payload, headers=superadmin_headers)
        assert res_invalid.status_code == 400
        assert "Invalid business persona 'INVALID_TYPE'." in res_invalid.json()["detail"]

        # Valid persona CAFE on create
        valid_payload = {
            "name": "Bistro Cafe Store",
            "slug": "bistro-cafe-store",
            "adminEmail": "admin@bistro.local",
            "adminPassword": "password123",
            "businessPersona": "CAFE",
            "databaseConfig": {"isolationMode": "SHARED"}
        }
        res_valid = await client.post("/api/v1/tenants", json=valid_payload, headers=superadmin_headers)
        assert res_valid.status_code == 201
        data = res_valid.json()
        assert data.get("settings", {}).get("businessPersona") == "CAFE"
