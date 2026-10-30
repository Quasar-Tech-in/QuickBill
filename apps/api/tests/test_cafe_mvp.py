import pytest
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from app.main import app
from app.core.security import create_access_token, TokenPayload
from app.services.cafe_session_service import generate_table_qr_token, verify_table_qr_token

TENANT_A = "65f2a1b9a000000000000001"
TENANT_B = "65f2a1b9a000000000000002"

@pytest.fixture
def auth_headers_tenant_a():
    payload = TokenPayload(
        sub="usr_admin_a",
        email="admin_a@store.local",
        name="Store Admin A",
        roles=["TENANT_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_A,
        authorized_business_ids=[TENANT_A]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_tenant_b():
    payload = TokenPayload(
        sub="usr_admin_b",
        email="admin_b@store.local",
        name="Store Admin B",
        roles=["TENANT_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_B,
        authorized_business_ids=[TENANT_B]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_cashier_a():
    payload = TokenPayload(
        sub="usr_cashier_a",
        email="cashier_a@store.local",
        name="Cashier Amit",
        roles=["CASHIER"],
        permissions=["sales:read", "sales:write"],
        default_business_id=TENANT_A,
        authorized_business_ids=[TENANT_A]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_tenant_persona_configuration(auth_headers_tenant_a):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Update tenant settings to CAFE persona
        update_payload = {
            "businessPersona": "CAFE",
            "cafeConfig": {
                "enableQrOrdering": True,
                "requireOrderApproval": True,
                "autoPrintKot": True,
                "sections": ["Indoor AC", "Outdoor Patio"]
            }
        }
        res = await client.put(f"/api/v1/tenants/{TENANT_A}", json=update_payload, headers=auth_headers_tenant_a)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

        # Fetch tenant current profile
        res_current = await client.get("/api/v1/tenants/current", headers=auth_headers_tenant_a)
        assert res_current.status_code == 200
        cur_data = res_current.json()
        assert cur_data.get("settings", {}).get("businessPersona") == "CAFE"
        assert cur_data.get("settings", {}).get("cafeConfig", {}).get("enableQrOrdering") is True

@pytest.mark.asyncio
async def test_table_crud_and_tenant_isolation(auth_headers_tenant_a, auth_headers_tenant_b):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Tenant A creates Table T-01
        table_payload = {
            "tableNumber": "T-01",
            "label": "Table 1",
            "section": "Indoor AC",
            "seatingCapacity": 4,
            "locationId": "loc_main_branch"
        }
        res = await client.post("/api/v1/cafe/tables", json=table_payload, headers=auth_headers_tenant_a)
        assert res.status_code == 201
        created_table = res.json()
        assert created_table["tableNumber"] == "T-01"
        assert created_table["currentStatus"] == "AVAILABLE"
        assert "qrCodeUrl" in created_table
        table_id = created_table["_id"]

        # 2. Duplicate table creation in same branch should fail with 409 Conflict
        res_dup = await client.post("/api/v1/cafe/tables", json=table_payload, headers=auth_headers_tenant_a)
        assert res_dup.status_code == 409

        # 3. Tenant A lists tables
        res_list_a = await client.get("/api/v1/cafe/tables", headers=auth_headers_tenant_a)
        assert res_list_a.status_code == 200
        tables_a = res_list_a.json()
        assert any(t["_id"] == table_id for t in tables_a)

        # 4. Tenant B cannot see Tenant A's table (strict multi-tenant isolation)
        res_list_b = await client.get("/api/v1/cafe/tables", headers=auth_headers_tenant_b)
        assert res_list_b.status_code == 200
        tables_b = res_list_b.json()
        assert not any(t["_id"] == table_id for t in tables_b)

        # 5. Update table status
        res_status = await client.patch(
            f"/api/v1/cafe/tables/{table_id}/status",
            json={"status": "CLEANING"},
            headers=auth_headers_tenant_a
        )
        assert res_status.status_code == 200
        assert res_status.json()["currentStatus"] == "CLEANING"

        # 6. Delete / Deactivate table
        res_del = await client.delete(f"/api/v1/cafe/tables/{table_id}", headers=auth_headers_tenant_a)
        assert res_del.status_code == 200
        assert res_del.json()["success"] is True

@pytest.mark.asyncio
async def test_qr_token_signing_and_validation():
    biz_id = TENANT_A
    table_id = str(ObjectId())
    token = generate_table_qr_token(biz_id, table_id)
    assert len(token) > 10

    # Authentic token must pass verification
    assert verify_table_qr_token(token, biz_id, table_id) is True

    # Tampered table ID must fail verification
    fake_table_id = str(ObjectId())
    assert verify_table_qr_token(token, biz_id, fake_table_id) is False

    # Tampered token string must fail verification
    assert verify_table_qr_token("invalid_token_12345", biz_id, table_id) is False

@pytest.mark.asyncio
async def test_public_menu_and_customer_ordering_flow(auth_headers_tenant_a, auth_headers_cashier_a):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a sellable menu item (Cold Coffee)
        menu_item_payload = {
            "name": "Cold Coffee",
            "salePrice": 150.0,
            "purchasePrice": 50.0,
            "category": "Beverages",
            "unit": "cup",
            "taxRate": 5.0,
            "itemType": "MENU_ITEM",
            "isCustomerVisible": True
        }
        res_item = await client.post("/api/v1/items", json=menu_item_payload, headers=auth_headers_tenant_a)
        assert res_item.status_code == 201
        coffee_id = res_item.json()["_id"]

        # 2. Create a raw material (Espresso Beans)
        raw_item_payload = {
            "name": "Raw Espresso Beans",
            "salePrice": 800.0,
            "purchasePrice": 600.0,
            "category": "Raw Material",
            "unit": "kg",
            "taxRate": 5.0,
            "itemType": "RAW_MATERIAL",
            "isCustomerVisible": False
        }
        res_raw = await client.post("/api/v1/items", json=raw_item_payload, headers=auth_headers_tenant_a)
        assert res_raw.status_code == 201

        # 3. Create a dining table T-02
        res_t = await client.post("/api/v1/cafe/tables", json={"tableNumber": "T-02", "label": "Table 2", "section": "Indoor AC", "seatingCapacity": 2}, headers=auth_headers_tenant_a)
        assert res_t.status_code == 201
        table_data = res_t.json()
        table_id = table_data["_id"]
        qr_token = generate_table_qr_token(TENANT_A, table_id)

        # 4. Public diner loads digital menu
        res_menu = await client.get(f"/api/v1/public/cafe/{TENANT_A}/menu?tableId={table_id}&token={qr_token}")
        assert res_menu.status_code == 200
        menu_data = res_menu.json()
        assert menu_data["table"]["tableNumber"] == "T-02"
        assert menu_data["table"]["isValidToken"] is True
        
        # Verify Cold Coffee is on menu, Raw Espresso Beans is excluded
        menu_item_names = [it["name"] for it in menu_data["items"]]
        assert "Cold Coffee" in menu_item_names
        assert "Raw Espresso Beans" not in menu_item_names

        # 5. Diner places order from mobile device
        order_payload = {
            "tableId": table_id,
            "qrToken": qr_token,
            "customerName": "Rohan Sharma",
            "customerPhone": "9876543210",
            "notes": "Extra sweet please",
            "items": [
                {
                    "itemId": coffee_id,
                    "name": "Cold Coffee",
                    "unitPrice": 150.0,
                    "quantity": 2.0,
                    "notes": "Less ice"
                }
            ]
        }
        res_order = await client.post(f"/api/v1/public/cafe/orders?businessId={TENANT_A}", json=order_payload)
        assert res_order.status_code == 201
        order_res = res_order.json()
        assert order_res["status"] == "SUBMITTED"
        session_id = order_res["sessionId"]
        order_id = order_res["orderId"]

        # 6. Cashier checks active sessions / incoming order queue
        res_queue = await client.get("/api/v1/cafe/sessions/active", headers=auth_headers_cashier_a)
        assert res_queue.status_code == 200
        sessions = res_queue.json()
        target_session = next((s for s in sessions if s["_id"] == session_id), None)
        assert target_session is not None
        assert len(target_session["orders"]) == 1
        assert target_session["orders"][0]["approvalStatus"] == "SUBMITTED"

        # 7. Cashier accepts the order -> Generates KOT-001
        res_accept = await client.post(
            f"/api/v1/cafe/sessions/{session_id}/orders/{order_id}/accept",
            headers=auth_headers_cashier_a
        )
        assert res_accept.status_code == 200
        accept_data = res_accept.json()
        assert accept_data["success"] is True
        kot_number = accept_data["kotNumber"]
        assert kot_number.startswith("KOT-")

        # 8. Check Kitchen KOTs
        res_kots = await client.get("/api/v1/cafe/sessions/kots", headers=auth_headers_cashier_a)
        assert res_kots.status_code == 200
        kots = res_kots.json()
        assert any(k["kotNumber"] == kot_number for k in kots)

        # 9. Cashier settles table bill into official invoice
        settle_payload = {
            "paymentMode": "CASH",
            "paidAmount": 300.0,
            "customerName": "Rohan Sharma",
            "customerPhone": "9876543210"
        }
        res_settle = await client.post(
            f"/api/v1/cafe/sessions/{session_id}/settle",
            json=settle_payload,
            headers=auth_headers_cashier_a
        )
        assert res_settle.status_code == 200
        settle_data = res_settle.json()
        assert settle_data["success"] is True
        assert "invoice" in settle_data
        assert settle_data["tableStatus"] == "CLEANING"
        assert settle_data["invoice"]["invoiceNumber"].startswith("INV-")

