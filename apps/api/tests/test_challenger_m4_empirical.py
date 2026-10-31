"""
Adversarial empirical stress tests for M4:
- Persona RBAC enforcement across RETAIL, CAFE, HYBRID
- Smuggling and parameter casing attack vectors
- IDOR and privilege escalation attacks
- Public digital ordering token forgery & cross-table replay attacks
- Schema edge conditions, nulls, and boundary values
"""

import pytest
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from app.main import app
from app.core.security import create_access_token, TokenPayload
from app.services.cafe_session_service import generate_table_qr_token

TENANT_A = "65f2a1b9a000000000000001"
TENANT_B = "65f2a1b9a000000000000002"

@pytest.fixture
def superadmin_headers():
    payload = TokenPayload(
        sub="usr_superadmin",
        email="superadmin@quickbill.local",
        name="Super Admin",
        roles=["SUPER_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_A,
        authorized_business_ids=[TENANT_A, TENANT_B]
    )
    return {"Authorization": f"Bearer {create_access_token(payload)}"}

@pytest.fixture
def tenant_a_admin_headers():
    payload = TokenPayload(
        sub="usr_admin_a",
        email="admin_a@store.local",
        name="Store Admin A",
        roles=["TENANT_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_A,
        authorized_business_ids=[TENANT_A]
    )
    return {"Authorization": f"Bearer {create_access_token(payload)}"}

@pytest.fixture
def tenant_b_admin_headers():
    payload = TokenPayload(
        sub="usr_admin_b",
        email="admin_b@store.local",
        name="Store Admin B",
        roles=["TENANT_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_B,
        authorized_business_ids=[TENANT_B]
    )
    return {"Authorization": f"Bearer {create_access_token(payload)}"}

@pytest.fixture
def cashier_headers():
    payload = TokenPayload(
        sub="usr_cashier_a",
        email="cashier_a@store.local",
        name="Cashier Amit",
        roles=["CASHIER"],
        permissions=["sales:read", "sales:write"],
        default_business_id=TENANT_A,
        authorized_business_ids=[TENANT_A]
    )
    return {"Authorization": f"Bearer {create_access_token(payload)}"}


@pytest.mark.asyncio
async def test_adversarial_persona_casing_and_smuggling(tenant_a_admin_headers, superadmin_headers):
    """
    Stress-test non-superadmin persona modification attempts across multiple smuggling vectors.
    None should succeed in elevating or altering businessPersona.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Attack vector 1: Direct camelCase businessPersona
        res1 = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"businessPersona": "CAFE"}, headers=tenant_a_admin_headers)
        assert res1.status_code == 403, f"Expected 403, got {res1.status_code}"

        # Attack vector 2: Direct snake_case business_persona
        res2 = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"business_persona": "CAFE"}, headers=tenant_a_admin_headers)
        assert res2.status_code == 403, f"Expected 403, got {res2.status_code}"

        # Attack vector 3: Nested settings.businessPersona
        res3 = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"settings": {"businessPersona": "HYBRID"}}, headers=tenant_a_admin_headers)
        assert res3.status_code == 403, f"Expected 403, got {res3.status_code}"

        # Attack vector 4: Nested settings.business_persona
        res4 = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"settings": {"business_persona": "HYBRID"}}, headers=tenant_a_admin_headers)
        assert res4.status_code == 403, f"Expected 403, got {res4.status_code}"

        # Attack vector 5: Casing spoofing (lowercase)
        res5 = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"businessPersona": "cafe"}, headers=tenant_a_admin_headers)
        assert res5.status_code == 403, f"Expected 403, got {res5.status_code}"

        # Confirm store persona remains unmodified (RETAIL)
        get_res = await client.get("/api/v1/tenants/current", headers=tenant_a_admin_headers)
        assert get_res.status_code == 200
        assert get_res.json().get("settings", {}).get("businessPersona") == "RETAIL"


@pytest.mark.asyncio
async def test_adversarial_superadmin_normalization_and_rejections(superadmin_headers):
    """
    Stress-test Super Admin persona assignment:
    - Trims and upper-cases valid inputs
    - Strictly rejects malformed, unexpected, or SQL/script-injection persona strings
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Trimming & Case Normalization
        for persona_input, expected_val in [(" CAFE ", "CAFE"), ("hybrid", "HYBRID"), (" retail\n", "RETAIL")]:
            res = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"businessPersona": persona_input}, headers=superadmin_headers)
            assert res.status_code == 200
            assert res.json()["profile"]["settings.businessPersona"] == expected_val

        # 2. Adversarial inputs rejection
        bad_inputs = [
            "INVALID",
            "RESTAURANT",
            "HOTEL",
            "BAR",
            "123",
            "",
            "   ",
            "DROP TABLE tenants; --",
            "<script>alert('xss')</script>",
            "RETAIL; CAFE",
        ]
        for bad in bad_inputs:
            res_bad = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"businessPersona": bad}, headers=superadmin_headers)
            assert res_bad.status_code == 400, f"Expected 400 for input '{bad}', got {res_bad.status_code}"


@pytest.mark.asyncio
async def test_adversarial_unauthorized_and_idor_attempts(tenant_a_admin_headers, tenant_b_admin_headers, cashier_headers):
    """
    Verify authentication boundaries, cashier restrictions, and cross-tenant IDOR protection.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Invalid authentication token -> 401 Unauthorized
        res_invalid_token = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"name": "Hacked Name"}, headers={"Authorization": "Bearer invalid_expired_token"})
        assert res_invalid_token.status_code == 401

        # 2. No authentication header -> rejected (401 or 403 depending on debug mode fallback)
        res_noauth = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"name": "Hacked Name"})
        assert res_noauth.status_code in (401, 403)

        # 2. Cashier role attempting store profile update
        res_cashier = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"name": "Cashier Store"}, headers=cashier_headers)
        assert res_cashier.status_code == 403

        # 3. IDOR: Tenant A Admin attempting to update Tenant B
        res_idor_a = await client.put(f"/api/v1/tenants/{TENANT_B}", json={"name": "Hacked Tenant B"}, headers=tenant_a_admin_headers)
        assert res_idor_a.status_code == 403
        assert "Unauthorized access to modify this store profile." in res_idor_a.json()["detail"]

        # 4. IDOR: Tenant B Admin attempting to update Tenant A
        res_idor_b = await client.put(f"/api/v1/tenants/{TENANT_A}", json={"name": "Hacked Tenant A"}, headers=tenant_b_admin_headers)
        assert res_idor_b.status_code == 403
        assert "Unauthorized access to modify this store profile." in res_idor_b.json()["detail"]


@pytest.mark.asyncio
async def test_adversarial_public_order_token_and_payload_tampering(tenant_a_admin_headers):
    """
    Stress-test public ordering endpoint against forged tokens, cross-table replay,
    and malformed or malicious payloads.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create Table 10 and Table 20 for Tenant A
        t10_res = await client.post("/api/v1/cafe/tables", json={"tableNumber": "T-10", "label": "T10"}, headers=tenant_a_admin_headers)
        assert t10_res.status_code == 201
        t10_id = t10_res.json()["_id"]
        t10_token = generate_table_qr_token(TENANT_A, t10_id)

        t20_res = await client.post("/api/v1/cafe/tables", json={"tableNumber": "T-20", "label": "T20"}, headers=tenant_a_admin_headers)
        assert t20_res.status_code == 201
        t20_id = t20_res.json()["_id"]
        t20_token = generate_table_qr_token(TENANT_A, t20_id)

        # Create a menu item
        item_res = await client.post(
            "/api/v1/items",
            json={"name": "Espresso Shot", "salePrice": 80.0, "purchasePrice": 30.0, "category": "Coffee", "unit": "cup", "taxRate": 5.0, "itemType": "MENU_ITEM"},
            headers=tenant_a_admin_headers
        )
        assert item_res.status_code == 201
        item_id = item_res.json()["_id"]

        valid_order = {
            "tableId": t10_id,
            "qrToken": t10_token,
            "customerName": "Test Customer",
            "items": [{"itemId": item_id, "unitPrice": 80.0, "quantity": 1.0}]
        }

        # Case 1: Tampered token string
        bad_token_order = dict(valid_order, qrToken="tampered_fake_hmac_token")
        res1 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=bad_token_order)
        assert res1.status_code == 403
        assert "Invalid or expired table QR token" in res1.json()["detail"]

        # Case 2: Cross-table replay attack (T-20 token sent to T-10)
        cross_table_order = dict(valid_order, tableId=t10_id, qrToken=t20_token)
        res2 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=cross_table_order)
        assert res2.status_code == 403
        assert "Invalid or expired table QR token" in res2.json()["detail"]

        # Case 3: Empty items list -> 422
        empty_items_order = dict(valid_order, items=[])
        res3 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=empty_items_order)
        assert res3.status_code == 422

        # Case 4: Negative quantity -> 422
        neg_qty_order = dict(valid_order, items=[{"itemId": item_id, "unitPrice": 80.0, "quantity": -2.0}])
        res4 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=neg_qty_order)
        assert res4.status_code == 422

        # Case 5: Zero quantity -> 422
        zero_qty_order = dict(valid_order, items=[{"itemId": item_id, "unitPrice": 80.0, "quantity": 0.0}])
        res5 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=zero_qty_order)
        assert res5.status_code == 422

        # Case 6: Non-existent table ID
        fake_table_order = dict(valid_order, tableId=str(ObjectId()))
        res6 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=fake_table_order)
        assert res6.status_code == 404

        # Case 7: Valid order succeeds with 201
        res7 = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=valid_order)
        assert res7.status_code == 201
        assert res7.json()["status"] == "SUBMITTED"


@pytest.mark.asyncio
async def test_adversarial_public_menu_resilience(tenant_a_admin_headers):
    """
    Stress-test public digital menu search and category filtering with special characters,
    regex metacharacters, and boundary inputs.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Non-existent tenant slug -> 404
        res_404 = await client.get("/api/v1/public/cafe/non_existent_slug_123/menu")
        assert res_404.status_code == 404

        # 2. Regex injection in search query
        for inj in [".*", ".*+?", "[a-z]+", "\\", "$", "^"]:
            res_inj = await client.get(f"/api/v1/public/cafe/{TENANT_A}/menu?search={inj}")
            assert res_inj.status_code == 200, f"Expected 200 for regex input '{inj}', got {res_inj.status_code}"
            assert isinstance(res_inj.json().get("items"), list)

        # 3. Non-existent category
        res_cat = await client.get(f"/api/v1/public/cafe/{TENANT_A}/menu?category=DOES_NOT_EXIST")
        assert res_cat.status_code == 200
        assert len(res_cat.json().get("items", [])) == 0
